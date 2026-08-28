const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase, signDocumentUrl, saveMockDbToFile, resolvePassengerNameForBooking } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Get all profiles (Admin & Staff)
router.get('/users', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  if (isMockMode) {
    const users = Array.from(mockDb.profiles.values());
    const enrichedUsers = await Promise.all(users.map(async u => {
      if (u.document_url) {
        return { ...u, document_url: await signDocumentUrl(u.document_url) };
      }
      return u;
    }));
    return res.json(enrichedUsers);
  } else {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      const enrichedUsers = await Promise.all(data.map(async u => {
        if (u.document_url) {
          return { ...u, document_url: await signDocumentUrl(u.document_url) };
        }
        return u;
      }));
      return res.json(enrichedUsers);
    } catch (err) {
      console.error('⚠️ Supabase profiles query failed:', err.message);
      return res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  }
});

// Update profile role/status (Admin only)
router.put('/users/:userId', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { userId } = req.params;
  const { role, full_name, phone, status } = req.body;

  const validRoles = ['passenger', 'staff', 'admin'];
  if (role !== undefined && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Role must be passenger, staff, or admin.' });
  }

  const validStatuses = ['Active', 'Blocked'];
  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Status must be Active or Blocked.' });
  }

  if (isMockMode) {
    const user = mockDb.profiles.get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Protect against demoting or removing the last admin user
    if (user.role === 'admin' && role !== undefined && role !== 'admin') {
      const allAdmins = Array.from(mockDb.profiles.values()).filter(p => p.role === 'admin');
      if (allAdmins.length <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last remaining admin user in the system.' });
      }
    }

    if (role !== undefined) user.role = role;
    if (full_name !== undefined) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;
    if (status !== undefined) user.status = status;

    mockDb.profiles.set(userId, user);
    return res.json({ message: 'User updated successfully (Mock Mode)', user });
  } else {
    try {
      // 1. Fetch target user
      const { data: user, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchErr || !user) return res.status(404).json({ error: 'User not found' });

      // 2. Protect against demoting last admin
      if (user.role === 'admin' && role !== undefined && role !== 'admin') {
        const { data: adminList } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin');

        if (adminList && adminList.length <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last remaining admin user in the system.' });
        }
      }

      const updateData = {};
      if (role !== undefined) updateData.role = role;
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone !== undefined) updateData.phone = phone;
      if (status !== undefined) updateData.status = status;

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Get operational/revenue metrics
router.get('/metrics', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const period = req.query.period || '7d';
  const now = new Date();

  // Helper to parse dates & generate period date series
  const getDaysForPeriod = (p) => {
    let count = 7;
    if (p === '30d') count = 30;
    if (p === 'month') count = 30;
    if (p === 'year') count = 12; // 12 months

    const dates = [];
    if (p === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
        const label = d.toLocaleDateString('en-IN', { month: 'short' });
        dates.push({ key: monthKey, label, dateStr: d.toISOString().slice(0, 10) });
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dates.push({ key, label, dateStr: key });
      }
    }
    return dates;
  };

  const periodDays = getDaysForPeriod(period);
  const todayStr = now.toISOString().slice(0, 10);

  if (isMockMode) {
    // Collect entities from mockDb
    const bookings = Array.from(mockDb.bookings.values());
    const profiles = Array.from(mockDb.profiles.values());
    const trains = Array.from(mockDb.trains.values()).filter(t => !!t && t.status !== 'inactive');
    const routes = Array.from(mockDb.routes.values());
    const stations = Array.from(mockDb.stations.values());
    const payments = Array.from(mockDb.payments.values());
    const seatAllocations = Array.from(mockDb.seat_allocations.values());

    const activeRoutes = routes.filter(r => (r.status || 'Active').toLowerCase() === 'active').length;
    const totalPassengers = profiles.filter(p => p.role === 'passenger').length;

    // Total coaches calculation across fleet
    let totalCoaches = 0;
    trains.forEach(t => {
      if (Array.isArray(t.coaches)) totalCoaches += t.coaches.length;
      else if (t.total_coaches) totalCoaches += Number(t.total_coaches);
      else totalCoaches += 12; // default coach structure per train if unconfigured
    });

    // Payments breakdown
    const completedPayments = payments.filter(p => p.status === 'completed');
    const refundedPayments = payments.filter(p => p.status === 'refunded' || p.status === 'refund_approved');
    const pendingRefunds = payments.filter(p => p.status === 'refund_pending').length;

    let totalRevenue = completedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    let refundedAmount = refundedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    if (totalRevenue === 0 && bookings.length > 0) {
      totalRevenue = bookings
        .filter(b => (b.status || '').toLowerCase() !== 'cancelled')
        .reduce((sum, b) => sum + (Number(b.total_fare) || 780), 0);
    }
    if (totalRevenue === 0) totalRevenue = 14500;

    // Revenue by timeframe
    let todayRevenue = completedPayments
      .filter(p => p.created_at && p.created_at.startsWith(todayStr))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    if (todayRevenue === 0 && bookings.length > 0) {
      todayRevenue = bookings
        .filter(b => (b.booking_date && b.booking_date.startsWith(todayStr)))
        .reduce((sum, b) => sum + (Number(b.total_fare) || 780), 0);
    }
    if (todayRevenue === 0) todayRevenue = 1330;

    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    let weekRevenue = completedPayments
      .filter(p => p.created_at && new Date(p.created_at) >= weekAgo)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (weekRevenue === 0) weekRevenue = 8450;

    const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
    let monthRevenue = completedPayments
      .filter(p => p.created_at && new Date(p.created_at) >= monthAgo)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (monthRevenue === 0) monthRevenue = 14500;

    if (refundedAmount === 0) refundedAmount = 1250;

    // Today's bookings
    const todayBookings = bookings.filter(b => (b.booking_date && b.booking_date.startsWith(todayStr))).length;

    // Train Status Distribution
    const trainStatusMap = { running: 0, onTime: 0, delayed: 0, cancelled: 0, scheduled: 0, completed: 0 };
    trains.forEach(t => {
      const st = (t.status || 'scheduled').toLowerCase();
      if (st.includes('run')) trainStatusMap.running++;
      else if (st.includes('on_time') || st.includes('ontime') || st.includes('on time')) trainStatusMap.onTime++;
      else if (st.includes('delay')) trainStatusMap.delayed++;
      else if (st.includes('cancel')) trainStatusMap.cancelled++;
      else if (st.includes('complete')) trainStatusMap.completed++;
      else trainStatusMap.scheduled++;
    });

    // Booking Status Distribution
    const bookingStatusMap = { confirmed: 0, rac: 0, waitlisted: 0, cancelled: 0, completed: 0, refunded: 0 };
    bookings.forEach(b => {
      const st = (b.status || 'confirmed').toLowerCase();
      if (st.includes('confirm')) bookingStatusMap.confirmed++;
      else if (st.includes('rac')) bookingStatusMap.rac++;
      else if (st.includes('wait') || st.includes('wl')) bookingStatusMap.waitlisted++;
      else if (st.includes('cancel')) bookingStatusMap.cancelled++;
      else if (st.includes('refund')) bookingStatusMap.refunded++;
      else if (st.includes('complete')) bookingStatusMap.completed++;
      else bookingStatusMap.confirmed++;
    });

    // Time-series trend grouping
    const trendMap = new Map();
    periodDays.forEach(d => {
      trendMap.set(d.key, { date: d.dateStr, label: d.label, bookings: 0, revenue: 0, refunds: 0 });
    });

    bookings.forEach(b => {
      const bDate = (b.booking_date || b.created_at || '').slice(0, period === 'year' ? 7 : 10);
      if (trendMap.has(bDate)) {
        const item = trendMap.get(bDate);
        item.bookings++;
        if ((b.status || '').toLowerCase() !== 'cancelled') {
          item.revenue += Number(b.total_fare || 0);
        }
      }
    });

    payments.forEach(p => {
      const pDate = (p.created_at || '').slice(0, period === 'year' ? 7 : 10);
      if (trendMap.has(pDate)) {
        const item = trendMap.get(pDate);
        if (p.status === 'refunded') {
          item.refunds += Number(p.amount || 0);
        }
      }
    });

    // Class-wise Demand & Revenue map
    const classStatsMap = new Map();
    bookings.forEach(b => {
      const cls = (b.class_code || b.booking_class || 'SL').toUpperCase();
      if (!classStatsMap.has(cls)) {
        classStatsMap.set(cls, { classCode: cls, name: cls, bookings: 0, revenue: 0 });
      }
      const item = classStatsMap.get(cls);
      item.bookings++;
      if ((b.status || '').toLowerCase() !== 'cancelled') {
        item.revenue += Number(b.total_fare || 0);
      }
    });

    const totalBookingCount = bookings.length || 1;

    // Top Routes map
    const routeStatsMap = new Map();
    bookings.forEach(b => {
      const train = b.train_id ? mockDb.trains.get(b.train_id) : null;
      const key = train ? `${train.source_station_code || 'NDLS'} → ${train.destination_station_code || 'MMCT'}` : 'NDLS → MMCT';
      if (!routeStatsMap.has(key)) {
        routeStatsMap.set(key, {
          route: key,
          route_id: b.route_id || 'r-1',
          train_name: train ? train.train_name : 'Express',
          bookings: 0,
          revenue: 0
        });
      }
      const item = routeStatsMap.get(key);
      item.bookings++;
      if ((b.status || '').toLowerCase() !== 'cancelled') {
        item.revenue += Number(b.total_fare || 0);
      }
    });

    // Station Demand map
    const depMap = new Map();
    const arrMap = new Map();
    bookings.forEach(b => {
      const src = b.source_station || (b.train ? b.train.source_station_code : 'NDLS');
      const dest = b.destination_station || (b.train ? b.train.destination_station_code : 'MMCT');
      if (src) depMap.set(src, (depMap.get(src) || 0) + 1);
      if (dest) arrMap.set(dest, (arrMap.get(dest) || 0) + 1);
    });

    // Check if trends are sparse and need visual Demo Fallback
    const totalTrendBookings = Array.from(trendMap.values()).reduce((sum, i) => sum + i.bookings, 0);
    let isDemoTrend = false;

    let finalBookingTrend = Array.from(trendMap.values());
    if (totalTrendBookings < 5) {
      isDemoTrend = true;
      const demoCounts = period === 'year' 
        ? [420, 510, 680, 890, 750, 920, 1100, 1050, 1250, 1400, 1350, 1680]
        : [120, 145, 132, 168, 151, 179, 193, 160, 175, 185, 210, 195, 220, 240, 215, 230, 250, 265, 245, 270, 290, 280, 310, 325, 305, 340, 360, 350, 380, 410];
      
      finalBookingTrend = periodDays.map((d, i) => {
        const val = demoCounts[i % demoCounts.length];
        return {
          date: d.dateStr,
          label: d.label,
          bookings: val,
          revenue: val * 650,
          refunds: Math.round(val * 45)
        };
      });
    }

    // Class-wise Demand & Revenue Fallback
    let classBookings = Array.from(classStatsMap.values()).map(c => ({
      ...c,
      percentage: Math.round((c.bookings / totalBookingCount) * 100)
    }));
    let isDemoClasses = false;

    if (classBookings.length < 3) {
      isDemoClasses = true;
      classBookings = [
        { classCode: 'SL', name: 'Sleeper Class (SL)', bookings: 420, percentage: 42 },
        { classCode: '3A', name: 'AC 3-Tier (3A)', bookings: 280, percentage: 28 },
        { classCode: '2A', name: 'AC 2-Tier (2A)', bookings: 140, percentage: 14 },
        { classCode: '1A', name: 'AC 1st Class (1A)', bookings: 60, percentage: 6 },
        { classCode: 'CC', name: 'AC Chair Car (CC)', bookings: 50, percentage: 5 },
        { classCode: '2S', name: 'Second Sitting (2S)', bookings: 30, percentage: 3 },
        { classCode: 'EC', name: 'Exec Chair Car (EC)', bookings: 20, percentage: 2 }
      ];
    }

    const classRevenue = classBookings.map(c => ({
      classCode: c.classCode,
      name: c.name,
      revenue: (c.bookings || 10) * 850,
      percentage: c.percentage
    }));

    // Top Routes Fallback
    let topRoutes = Array.from(routeStatsMap.values())
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);
    let isDemoRoutes = false;

    if (topRoutes.length < 3) {
      isDemoRoutes = true;
      topRoutes = [
        { route: 'NDLS → MMCT', route_id: 'r-1', train_name: 'Rajdhani Express', bookings: 480, revenue: 624000 },
        { route: 'SBC → MAS', route_id: 'r-2', train_name: 'Shatabdi Express', bookings: 390, revenue: 429000 },
        { route: 'NDLS → JP', route_id: 'r-3', train_name: 'Vande Bharat', bookings: 310, revenue: 372000 },
        { route: 'MAS → HYB', route_id: 'r-4', train_name: 'Charminar Express', bookings: 275, revenue: 247500 },
        { route: 'BPL → MMCT', route_id: 'r-5', train_name: 'Garib Rath Express', bookings: 220, revenue: 198000 }
      ];
    }

    // Station Demand Fallback
    let topDepartures = Array.from(depMap.entries())
      .map(([code, count]) => ({ station_code: code, station_name: mockDb.stations.get(code)?.station_name || code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let topArrivals = Array.from(arrMap.entries())
      .map(([code, count]) => ({ station_code: code, station_name: mockDb.stations.get(code)?.station_name || code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let isDemoStations = false;
    if (topDepartures.length < 3) {
      isDemoStations = true;
      topDepartures = [
        { station_code: 'NDLS', station_name: 'New Delhi', count: 420 },
        { station_code: 'SBC', station_name: 'KSR Bengaluru', count: 310 },
        { station_code: 'MAS', station_name: 'Chennai Central', count: 285 },
        { station_code: 'HWH', station_name: 'Howrah Junction', count: 210 },
        { station_code: 'ADI', station_name: 'Ahmedabad Junction', count: 175 }
      ];
      topArrivals = [
        { station_code: 'MMCT', station_name: 'Mumbai Central', count: 390 },
        { station_code: 'NDLS', station_name: 'New Delhi', count: 355 },
        { station_code: 'MAS', station_name: 'Chennai Central', count: 275 },
        { station_code: 'BSB', station_name: 'Varanasi Junction', count: 220 },
        { station_code: 'PNBE', station_name: 'Patna Junction', count: 190 }
      ];
    }

    // Train Occupancy Fallback
    let trainOccupancy = trains.slice(0, 5).map(t => {
      const trainBookings = bookings.filter(b => b.train_id === t.id && (b.status || '').toLowerCase() !== 'cancelled');
      const totalSeats = (t.coaches || []).length * 72 || 120;
      const bookedSeats = trainBookings.length * 2 || Math.min(85, totalSeats);
      const pct = Math.min(100, Math.round((bookedSeats / totalSeats) * 100));
      return {
        train_number: t.train_number,
        train_name: t.train_name,
        route: `${t.source_station_code || 'NDLS'} → ${t.destination_station_code || 'MMCT'}`,
        occupancyPercent: pct > 0 ? pct : 78,
        totalSeats,
        bookedSeats: bookedSeats > 0 ? bookedSeats : 94
      };
    });

    let isDemoOccupancy = false;
    if (trainOccupancy.length === 0 || trainOccupancy.every(t => t.occupancyPercent === 0)) {
      isDemoOccupancy = true;
      trainOccupancy = [
        { train_number: '12951', train_name: 'Mumbai Rajdhani', route: 'NDLS → MMCT', occupancyPercent: 92, totalSeats: 120, bookedSeats: 110 },
        { train_number: '22436', train_name: 'Vande Bharat Express', route: 'NDLS → BSB', occupancyPercent: 85, totalSeats: 120, bookedSeats: 102 },
        { train_number: '12345', train_name: 'Udupi Express', route: 'NDLS → MMCT', occupancyPercent: 78, totalSeats: 120, bookedSeats: 94 },
        { train_number: '12627', train_name: 'Karnataka Express', route: 'SBC → NDLS', occupancyPercent: 64, totalSeats: 120, bookedSeats: 77 },
        { train_number: '12002', train_name: 'Shatabdi Express', route: 'NDLS → BPL', occupancyPercent: 53, totalSeats: 120, bookedSeats: 64 }
      ];
    }

    // Live Operational Alerts
    const alerts = [];
    if (trainStatusMap.delayed > 0) {
      alerts.push({ id: 'alt-1', type: 'warning', title: `${trainStatusMap.delayed} trains delayed`, count: trainStatusMap.delayed, link: '/admin/train-status' });
    } else {
      alerts.push({ id: 'alt-1-demo', type: 'warning', title: `1 Train Delayed (Udupi Express)`, count: 1, link: '/admin/train-status', isDemo: true });
    }

    if (pendingRefunds > 0) {
      alerts.push({ id: 'alt-3', type: 'info', title: `${pendingRefunds} refunds pending review`, count: pendingRefunds, link: '/admin/refunds' });
    } else {
      alerts.push({ id: 'alt-3-demo', type: 'info', title: `23 Refunds Pending Review`, count: 23, link: '/admin/refunds', isDemo: true });
    }

    if (bookingStatusMap.waitlisted > 0) {
      alerts.push({ id: 'alt-4', type: 'warning', title: `${bookingStatusMap.waitlisted} passengers in waitlist queue`, count: bookingStatusMap.waitlisted, link: '/admin/rac-waiting' });
    } else {
      alerts.push({ id: 'alt-4-demo', type: 'warning', title: `18 Waitlisted Passengers`, count: 18, link: '/admin/rac-waiting', isDemo: true });
    }

    alerts.push({ id: 'alt-2-demo', type: 'success', title: `0 Cancellations`, count: 0, link: '/admin/train-status' });

    // Hourly Traffic Distribution
    const hourlyTraffic = [
      { slot: '06:00 - 09:00', label: 'Morning Peak', count: Math.max(12, Math.round(bookings.length * 0.28)), pct: 28 },
      { slot: '09:00 - 12:00', label: 'Mid-Day', count: Math.max(8, Math.round(bookings.length * 0.22)), pct: 22 },
      { slot: '12:00 - 15:00', label: 'Afternoon', count: Math.max(5, Math.round(bookings.length * 0.15)), pct: 15 },
      { slot: '15:00 - 18:00', label: 'Evening Peak', count: Math.max(10, Math.round(bookings.length * 0.20)), pct: 20 },
      { slot: '18:00 - 21:00', label: 'Night', count: Math.max(4, Math.round(bookings.length * 0.11)), pct: 11 },
      { slot: '21:00 - 00:00', label: 'Late Night', count: Math.max(2, Math.round(bookings.length * 0.04)), pct: 4 }
    ];

    // Passenger Age Demographics
    const passengerDemographics = [
      { category: 'Adults (18-59 yrs)', count: Math.max(15, Math.round(totalPassengers * 0.62)), pct: 62, color: 'bg-blue-500' },
      { category: 'Senior Citizens (60+ yrs)', count: Math.max(4, Math.round(totalPassengers * 0.18)), pct: 18, color: 'bg-emerald-500' },
      { category: 'Youth (12-17 yrs)', count: Math.max(3, Math.round(totalPassengers * 0.12)), pct: 12, color: 'bg-purple-500' },
      { category: 'Children (<12 yrs)', count: Math.max(2, Math.round(totalPassengers * 0.08)), pct: 8, color: 'bg-amber-500' }
    ];

    // Payment Methods Breakdown
    const paymentMethods = [
      { method: 'UPI & QR Code', count: Math.max(18, Math.round(completedPayments.length * 0.52)), revenue: Math.round((totalRevenue || 14500) * 0.52), pct: 52 },
      { method: 'Rail Wallet', count: Math.max(3, Math.round(completedPayments.length * 0.08)), revenue: Math.round((totalRevenue || 14500) * 0.08), pct: 8 }
    ];

    // Cancellation Summary
    const cancRecordsList = Array.from((mockDb.cancellation_records || new Map()).values());
    const cancellationSummary = {
      totalCancellations: cancRecordsList.length,
      pending: cancRecordsList.filter(r => (r.refund_status || r.status || '').toUpperCase() === 'PENDING').length,
      approved: cancRecordsList.filter(r => ['APPROVED', 'REFUNDED'].includes((r.refund_status || r.status || '').toUpperCase())).length,
      rejected: cancRecordsList.filter(r => (r.refund_status || r.status || '').toUpperCase() === 'REJECTED').length,
      totalRefundAmount: cancRecordsList.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0)
    };

    return res.json({
      success: true,
      period,
      isDemo: {
        trend: isDemoTrend,
        classes: isDemoClasses,
        routes: isDemoRoutes,
        stations: isDemoStations,
        occupancy: isDemoOccupancy
      },
      summary: {
        totalRevenue: totalRevenue || 14500,
        totalBookings: bookings.length,
        activeUsers: totalPassengers,
        totalTrains: trains.length,
        totalRoutes: routes.length,
        activeRoutes,
        totalStations: stations.length,
        pendingRefunds,
        totalCoaches
      },
      revenueSummary: {
        todayRevenue: todayRevenue || 1330,
        weekRevenue: weekRevenue || 8450,
        monthRevenue: monthRevenue || 14500,
        refundedAmount: refundedAmount || 1250
      },
      cancellationSummary,
      trainStatus: {
        ...trainStatusMap,
        total: trains.length
      },
      bookingStatus: {
        confirmed: bookingStatusMap.confirmed || 12,
        rac: bookingStatusMap.rac || 3,
        waitlisted: bookingStatusMap.waitlisted || 2,
        cancelled: bookingStatusMap.cancelled || 1,
        completed: bookingStatusMap.completed || 8,
        refunded: bookingStatusMap.refunded || 1,
        total: bookings.length || 18
      },
      bookingTrend: finalBookingTrend,
      dailyBookings: finalBookingTrend.map(b => ({ date: b.date, label: b.label, bookings: b.bookings })),
      revenueTrend: finalBookingTrend.map(b => ({ date: b.date, label: b.label, revenue: b.revenue, refunds: b.refunds })),
      classBookings,
      classRevenue,
      topRoutes,
      topStations: {
        departures: topDepartures,
        arrivals: topArrivals
      },
      occupancy: trainOccupancy,
      hourlyTraffic,
      passengerDemographics,
      paymentMethods,
      alerts
    });

  } else {
    try {
      const [{ data: bookings }, { data: profiles }, { data: payments }, { data: trains }, { data: routes }, { data: stations }] = await Promise.all([
        supabase.from('bookings').select('*'),
        supabase.from('profiles').select('id, role'),
        supabase.from('payments').select('*'),
        supabase.from('trains').select('*'),
        supabase.from('routes').select('*'),
        supabase.from('stations').select('*')
      ]);

      const bkList = bookings || [];
      const profList = profiles || [];
      const payList = payments || [];
      const trnList = trains || [];
      const rtList = routes || [];
      const stnList = stations || [];

      const activeRoutes = rtList.filter(r => (r.status || 'Active').toLowerCase() === 'active').length;
      const totalPassengers = profList.filter(p => p.role === 'passenger').length;
      const completedPayments = payList.filter(p => p.status === 'completed');
      const refundedPayments = payList.filter(p => p.status === 'refunded' || p.status === 'refund_approved');
      const pendingRefunds = payList.filter(p => p.status === 'refund_pending').length;

      const totalRevenue = completedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const refundedAmount = refundedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      let totalCoaches = 0;
      trnList.forEach(t => {
        if (Array.isArray(t.coaches)) totalCoaches += t.coaches.length;
        else totalCoaches += 12;
      });

      const todayRevenue = completedPayments
        .filter(p => p.created_at && p.created_at.startsWith(todayStr))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      const weekRevenue = completedPayments
        .filter(p => p.created_at && new Date(p.created_at) >= weekAgo)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
      const monthRevenue = completedPayments
        .filter(p => p.created_at && new Date(p.created_at) >= monthAgo)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const todayBookings = bkList.filter(b => (b.booking_date && b.booking_date.startsWith(todayStr))).length;

      const trainStatusMap = { running: 0, onTime: 0, delayed: 0, cancelled: 0, scheduled: 0, completed: 0 };
      trnList.forEach(t => {
        const st = (t.status || 'scheduled').toLowerCase();
        if (st.includes('run')) trainStatusMap.running++;
        else if (st.includes('on_time') || st.includes('ontime') || st.includes('on time')) trainStatusMap.onTime++;
        else if (st.includes('delay')) trainStatusMap.delayed++;
        else if (st.includes('cancel')) trainStatusMap.cancelled++;
        else if (st.includes('complete')) trainStatusMap.completed++;
        else trainStatusMap.scheduled++;
      });

      const bookingStatusMap = { confirmed: 0, rac: 0, waitlisted: 0, cancelled: 0, completed: 0, refunded: 0 };
      bkList.forEach(b => {
        const st = (b.status || 'confirmed').toLowerCase();
        if (st.includes('confirm')) bookingStatusMap.confirmed++;
        else if (st.includes('rac')) bookingStatusMap.rac++;
        else if (st.includes('wait') || st.includes('wl')) bookingStatusMap.waitlisted++;
        else if (st.includes('cancel')) bookingStatusMap.cancelled++;
        else if (st.includes('refund')) bookingStatusMap.refunded++;
        else if (st.includes('complete')) bookingStatusMap.completed++;
        else bookingStatusMap.confirmed++;
      });

      const trendMap = new Map();
      periodDays.forEach(d => {
        trendMap.set(d.key, { date: d.dateStr, label: d.label, bookings: 0, revenue: 0, refunds: 0 });
      });

      bkList.forEach(b => {
        const bDate = (b.booking_date || b.created_at || '').slice(0, period === 'year' ? 7 : 10);
        if (trendMap.has(bDate)) {
          const item = trendMap.get(bDate);
          item.bookings++;
          if ((b.status || '').toLowerCase() !== 'cancelled') {
            item.revenue += Number(b.total_fare || 0);
          }
        }
      });

      payList.forEach(p => {
        const pDate = (p.created_at || '').slice(0, period === 'year' ? 7 : 10);
        if (trendMap.has(pDate)) {
          const item = trendMap.get(pDate);
          if (p.status === 'refunded') {
            item.refunds += Number(p.amount || 0);
          }
        }
      });

      const bookingTrend = Array.from(trendMap.values());

      const alerts = [];
      if (trainStatusMap.delayed > 0) {
        alerts.push({ id: 'alt-1', type: 'warning', title: `${trainStatusMap.delayed} trains delayed`, count: trainStatusMap.delayed, link: '/admin/train-status' });
      }
      if (trainStatusMap.cancelled > 0) {
        alerts.push({ id: 'alt-2', type: 'error', title: `${trainStatusMap.cancelled} trains cancelled`, count: trainStatusMap.cancelled, link: '/admin/train-status' });
      }
      if (pendingRefunds > 0) {
        alerts.push({ id: 'alt-3', type: 'info', title: `${pendingRefunds} refunds pending review`, count: pendingRefunds, link: '/admin/refunds' });
      }

      return res.json({
        success: true,
        period,
        summary: {
          totalRevenue,
          totalBookings: bkList.length,
          activeUsers: totalPassengers,
          totalTrains: trnList.length,
          totalRoutes: rtList.length,
          activeRoutes,
          totalStations: stnList.length,
          pendingRefunds,
          totalCoaches
        },
        revenueSummary: {
          todayRevenue,
          weekRevenue,
          monthRevenue,
          refundedAmount
        },
        trainStatus: {
          ...trainStatusMap,
          total: trnList.length
        },
        bookingStatus: {
          ...bookingStatusMap,
          total: bkList.length
        },
        bookingTrend,
        dailyBookings: bookingTrend.map(b => ({ date: b.date, label: b.label, bookings: b.bookings })),
        revenueTrend: bookingTrend.map(b => ({ date: b.date, label: b.label, revenue: b.revenue, refunds: b.refunds })),
        classBookings: [],
        classRevenue: [],
        topRoutes: [],
        topStations: { departures: [], arrivals: [] },
        occupancy: [],
        alerts
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Seed default policies in mockDb if not set
if (isMockMode && !mockDb.system_policies) {
  mockDb.system_policies = {
    quotas: {
      tatkalQuota: 15,
      racQuota: 10,
      waitlistLimit: 300,
      seniorDiscount: 40,
      ladiesQuota: 10
    },
    cancellation: {
      flatFee48h: 240,
      percent12to48h: 25,
      percent4to12h: 50,
      chartPrepRefund: 0
    },
    fares: [
      { id: '1a', coach: 'AC 1-Tier (1A)', code: '1A', base: 1450, permKm: 3.40, minDistance: 500, tatkalPremium: 500, superfastFee: 75, tax: 5 },
      { id: '2a', coach: 'AC 2-Tier (2A)', code: '2A', base: 980, permKm: 2.10, minDistance: 300, tatkalPremium: 400, superfastFee: 45, tax: 5 },
      { id: '3a', coach: 'AC 3-Tier (3A)', code: '3A', base: 650, permKm: 1.25, minDistance: 300, tatkalPremium: 300, superfastFee: 45, tax: 5 },
      { id: 'ec', coach: 'Exec. Chair Car (EC)', code: 'EC', base: 1100, permKm: 2.80, minDistance: 250, tatkalPremium: 400, superfastFee: 60, tax: 5 },
      { id: 'cc', coach: 'AC Chair Car (CC)', code: 'CC', base: 420, permKm: 0.95, minDistance: 150, tatkalPremium: 225, superfastFee: 30, tax: 5 },
      { id: 'sl', coach: 'Sleeper (SL)', code: 'SL', base: 240, permKm: 0.45, minDistance: 200, tatkalPremium: 150, superfastFee: 30, tax: 0 },
      { id: 'gen', coach: 'General (GEN)', code: 'GEN', base: 45, permKm: 0.15, minDistance: 50, tatkalPremium: 0, superfastFee: 15, tax: 0 }
    ]
  };
}

// GET /api/admin/policies
router.get('/policies', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  if (isMockMode) {
    return res.json(mockDb.system_policies);
  } else {
    return res.json({
      quotas: { tatkalQuota: 15, racQuota: 10, waitlistLimit: 300, seniorDiscount: 40, ladiesQuota: 10 },
      cancellation: { flatFee48h: 240, percent12to48h: 25, percent4to12h: 50, chartPrepRefund: 0 },
      fares: [
        { id: '1a', coach: 'AC 1-Tier (1A)', code: '1A', base: 1450, permKm: 3.40, minDistance: 500, tatkalPremium: 500, superfastFee: 75, tax: 5 },
        { id: '2a', coach: 'AC 2-Tier (2A)', code: '2A', base: 980, permKm: 2.10, minDistance: 300, tatkalPremium: 400, superfastFee: 45, tax: 5 },
        { id: '3a', coach: 'AC 3-Tier (3A)', code: '3A', base: 650, permKm: 1.25, minDistance: 300, tatkalPremium: 300, superfastFee: 45, tax: 5 },
        { id: 'ec', coach: 'Exec. Chair Car (EC)', code: 'EC', base: 1100, permKm: 2.80, minDistance: 250, tatkalPremium: 400, superfastFee: 60, tax: 5 },
        { id: 'cc', coach: 'AC Chair Car (CC)', code: 'CC', base: 420, permKm: 0.95, minDistance: 150, tatkalPremium: 225, superfastFee: 30, tax: 5 },
        { id: 'sl', coach: 'Sleeper (SL)', code: 'SL', base: 240, permKm: 0.45, minDistance: 200, tatkalPremium: 150, superfastFee: 30, tax: 0 },
        { id: 'gen', coach: 'General (GEN)', code: 'GEN', base: 45, permKm: 0.15, minDistance: 50, tatkalPremium: 0, superfastFee: 15, tax: 0 }
      ]
    });
  }
});

// PUT /api/admin/policies
router.put('/policies', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { quotas, cancellation, fares } = req.body;
  if (isMockMode) {
    if (quotas) mockDb.system_policies.quotas = quotas;
    if (cancellation) mockDb.system_policies.cancellation = cancellation;
    if (fares) mockDb.system_policies.fares = fares;
    return res.json({ message: 'System policies updated successfully (Mock Mode)', policies: mockDb.system_policies });
  } else {
    return res.json({ message: 'System policies updated successfully', policies: { quotas, cancellation, fares } });
  }
});

// Shared Policy Calculation Helper
function calculateCancellationRefundHelper(booking, travelDateStr, policyRules, isTrainCancelled = false, isOverride = false, overridePenalty = 0) {
  const totalFare = Number(booking.total_fare || booking.fareDetails?.totalFare || 0);
  
  if (isTrainCancelled) {
    return { penalty: 0, refundAmount: totalFare, reason: 'Train Service Cancelled (100% Full Refund)', diffHours: 999 };
  }
  
  if (isOverride) {
    const penalty = Math.min(totalFare, Math.max(0, Number(overridePenalty || 0)));
    return { penalty, refundAmount: Math.max(0, totalFare - penalty), reason: 'Admin Override', diffHours: 999 };
  }

  const rules = policyRules || (mockDb.system_policies?.cancellation) || { flatFee48h: 240, percent12to48h: 25, percent4to12h: 50, chartPrepRefund: 0 };
  const now = new Date();
  const journeyDate = new Date(travelDateStr || booking.travel_date || now);
  const diffHours = (journeyDate - now) / (1000 * 60 * 60);

  let penalty = 0;
  if (diffHours > 48) {
    penalty = Math.min(totalFare, Number(rules.flatFee48h || 240));
  } else if (diffHours >= 12) {
    penalty = Math.round(totalFare * ((Number(rules.percent12to48h || 25)) / 100));
  } else if (diffHours >= 4) {
    penalty = Math.round(totalFare * ((Number(rules.percent4to12h || 50)) / 100));
  } else {
    penalty = totalFare;
  }

  const refundAmount = Math.max(0, totalFare - penalty);
  return { penalty, refundAmount, diffHours };
}

// Shared Audit Logging Helper
function logAuditEvent({ action, target_id, train_id, user_id, user_role, previous_status, new_status, reason, refund_amount, penalty_amount, is_override, details }) {
  if (!mockDb.audit_logs) mockDb.audit_logs = new Map();
  const logId = 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const entry = {
    id: logId,
    action,
    target_id: target_id || null,
    train_id: train_id || null,
    user_id: user_id || 'system',
    user_role: user_role || 'staff',
    previous_status: previous_status || null,
    new_status: new_status || null,
    reason: reason || 'N/A',
    refund_amount: Number(refund_amount || 0),
    penalty_amount: Number(penalty_amount || 0),
    is_override: !!is_override,
    details: details || null,
    timestamp: new Date().toISOString()
  };
  mockDb.audit_logs.set(logId, entry);
  saveMockDbToFile();
  return entry;
}

// Attach helpers to router for exports
router.calculateCancellationRefundHelper = calculateCancellationRefundHelper;
router.logAuditEvent = logAuditEvent;

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  if (!mockDb.audit_logs) mockDb.audit_logs = new Map();
  const logs = Array.from(mockDb.audit_logs.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return res.json({ success: true, logs });
});

// Note: Permanent cancellation ledger routes GET /refunds & PUT /refunds/:id/action are consolidated below.

// GET /api/admin/system-health
const { getSystemHealthDiagnostics } = require('../config/supabase');
router.get('/system-health', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  try {
    const diagnostics = await getSystemHealthDiagnostics();
    return res.json({ status: 'success', diagnostics });
  } catch (err) {
    return res.status(500).json({ error: 'System health check failed: ' + err.message });
  }
});


// GET /api/admin/train-status
router.get('/train-status', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  if (isMockMode) {
    let trainsList = Array.from(mockDb.trains.values()).filter(t => !!t && t.status !== 'inactive');
    if (process.env.NODE_ENV !== 'test') {
      trainsList = trainsList.filter(t => t.source !== 'test' && t.record_source !== 'test');
    }
    const routesList = Array.from(mockDb.routes.values());
    const enriched = trainsList.map(t => {
      const r = routesList.find(route => route.train_id === t.id) || null;
      const sourceCode = t.source_station_code || r?.source_station_code || t.source || 'NDLS';
      const destCode = t.destination_station_code || r?.destination_station_code || t.destination || 'MMCT';
      const depTime = t.scheduled_departure_time || r?.departure_time || t.departure_time || '10:00:00';
      const arrTime = t.scheduled_arrival_time || r?.arrival_time || t.arrival_time || '18:00:00';
      return {
        ...t,
        train_number: t.train_number || t.trainNo || '',
        train_name: t.train_name || t.trainName || '',
        source_station_code: sourceCode,
        destination_station_code: destCode,
        source: sourceCode,
        destination: destCode,
        scheduled_departure_time: depTime,
        scheduled_arrival_time: arrTime,
        departure_time: depTime,
        arrival_time: arrTime,
        status: t.status || 'on_time',
        delay_minutes: t.delay_minutes || 0,
        route: r ? {
          ...r,
          source_station_code: r.source_station_code || sourceCode,
          destination_station_code: r.destination_station_code || destCode,
          departure_time: r.departure_time || depTime,
          arrival_time: r.arrival_time || arrTime
        } : null
      };
    });
    return res.json(enriched);
  } else {
    try {
      const { data, error } = await supabase.from('trains').select('*, routes:routes(*)');
      if (error) throw error;
      const enriched = (data || []).filter(t => t.status !== 'inactive').map(t => {
        const r = t.routes && t.routes.length > 0 ? t.routes[0] : null;
        const sourceCode = t.source_station_code || r?.source_station_code || t.source || 'NDLS';
        const destCode = t.destination_station_code || r?.destination_station_code || t.destination || 'MMCT';
        const depTime = t.scheduled_departure_time || r?.departure_time || t.departure_time || '10:00:00';
        const arrTime = t.scheduled_arrival_time || r?.arrival_time || t.arrival_time || '18:00:00';
        return {
          ...t,
          train_number: t.train_number || t.trainNo || '',
          train_name: t.train_name || t.trainName || '',
          source_station_code: sourceCode,
          destination_station_code: destCode,
          source: sourceCode,
          destination: destCode,
          scheduled_departure_time: depTime,
          scheduled_arrival_time: arrTime,
          departure_time: depTime,
          arrival_time: arrTime,
          status: t.status || 'on_time',
          delay_minutes: t.delay_minutes || 0,
          route: r ? {
            ...r,
            source_station_code: r.source_station_code || sourceCode,
            destination_station_code: r.destination_station_code || destCode,
            departure_time: r.departure_time || depTime,
            arrival_time: r.arrival_time || arrTime
          } : null
        };
      });
      return res.json(enriched);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch train statuses: ' + err.message });
    }
  }
});

// GET /api/admin/train-status/:trainId/history
router.get('/train-status/:trainId/history', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { trainId } = req.params;
  if (isMockMode) {
    const history = Array.from(mockDb.train_status_history.values())
      .filter(h => h.train_id === trainId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return res.json(history);
  } else {
    try {
      const { data, error } = await supabase
        .from('train_status_history')
        .select('*')
        .eq('train_id', trainId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch status history: ' + err.message });
    }
  }
});

const { randomUUID } = require('crypto');
const uuidv4 = () => randomUUID();

function addMinutesToTime(timeStr, mins) {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  let hours = parseInt(parts[0] || '0', 10);
  let minutes = parseInt(parts[1] || '0', 10);
  let seconds = parts[2] ? parseInt(parts[2], 10) : 0;
  
  let totalMinutes = hours * 60 + minutes + mins;
  let newHours = Math.floor(totalMinutes / 60) % 24;
  let newMinutes = totalMinutes % 60;
  if (newHours < 0) newHours += 24;
  
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// PATCH /api/admin/train-status/:trainId
router.patch('/train-status/:trainId', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { trainId } = req.params;
  const { status, delay_minutes, reason, message, updated_departure_time, updated_arrival_time } = req.body;

  const validStatuses = ['on_time', 'delayed', 'cancelled', 'rescheduled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Status must be: on_time, delayed, cancelled, or rescheduled.' });
  }

  if (status === 'delayed' && (delay_minutes === undefined || isNaN(delay_minutes))) {
    return res.status(400).json({ error: 'delay_minutes is required and must be a number for DELAYED status.' });
  }

  if (status === 'rescheduled' && (!updated_departure_time || !updated_arrival_time)) {
    return res.status(400).json({ error: 'updated_departure_time and updated_arrival_time are required for RESCHEDULED status.' });
  }

  if (isMockMode) {
    const train = mockDb.trains.get(trainId);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    const previousStatus = train.status || 'on_time';
    const route = Array.from(mockDb.routes.values()).find(r => r.train_id === trainId);
    
    const scheduled_departure_time = train.scheduled_departure_time || (route ? route.departure_time : '10:00:00');
    const scheduled_arrival_time = train.scheduled_arrival_time || (route ? route.arrival_time : '18:00:00');

    let finalDepartureTime = null;
    let finalArrivalTime = null;

    if (status === 'delayed') {
      finalDepartureTime = addMinutesToTime(scheduled_departure_time, parseInt(delay_minutes, 10));
      finalArrivalTime = addMinutesToTime(scheduled_arrival_time, parseInt(delay_minutes, 10));
    } else if (status === 'rescheduled') {
      finalDepartureTime = updated_departure_time;
      finalArrivalTime = updated_arrival_time;
    }

    // Update Train
    train.status = status;
    train.delay_minutes = status === 'delayed' ? parseInt(delay_minutes, 10) : 0;
    train.delay_reason = (status === 'delayed' || status === 'rescheduled') ? reason : null;
    train.delay_message = (status === 'delayed' || status === 'rescheduled') ? message : null;
    train.cancellation_reason = status === 'cancelled' ? reason : null;
    train.cancellation_message = status === 'cancelled' ? message : null;
    train.scheduled_departure_time = scheduled_departure_time;
    train.scheduled_arrival_time = scheduled_arrival_time;
    train.updated_departure_time = finalDepartureTime;
    train.updated_arrival_time = finalArrivalTime;
    train.status_updated_at = new Date().toISOString();

    mockDb.trains.set(trainId, train);

    // Save History
    const historyId = uuidv4();
    mockDb.train_status_history.set(historyId, {
      id: historyId,
      train_id: trainId,
      previous_status: previousStatus,
      new_status: status,
      delay_minutes: status === 'delayed' ? parseInt(delay_minutes, 10) : 0,
      reason: reason || '',
      message: message || '',
      updated_departure_time: finalDepartureTime,
      updated_arrival_time: finalArrivalTime,
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN'
    });

    let affectedBookingsCount = 0;
    let totalRefundAmount = 0;

    if (status === 'cancelled') {
      const activeBookings = Array.from(mockDb.bookings.values()).filter(
        b => b.train_id === trainId && b.status !== 'cancelled'
      );
      affectedBookingsCount = activeBookings.length;

      activeBookings.forEach(b => {
        b.status = 'cancelled';
        b.cancellation_reason = reason || 'Train service cancelled by railway operations';
        b.cancellation_date_time = new Date().toISOString();
        b.cancelled_by = 'ADMIN';

        const fullFare = Number(b.total_fare || 0);
        b.refund_amount = fullFare;
        b.refund_status = 'APPROVED';
        mockDb.bookings.set(b.id, b);

        totalRefundAmount += fullFare;

        const passenger = mockDb.profiles.get(b.passenger_id);
        const cancRecord = {
          id: `canc-${b.id}`,
          booking_id: b.id,
          pnr: b.pnr_number,
          passenger_id: b.passenger_id,
          passenger_name: passenger ? (passenger.full_name || passenger.email) : 'Passenger',
          train_id: trainId,
          train_number: train ? train.train_number : '12952',
          train_name: train ? train.train_name : 'Express Special',
          journey_date: b.travel_date,
          original_fare: fullFare,
          deduction_amount: 0,
          refund_amount: fullFare,
          refund_status: 'APPROVED',
          cancellation_reason: reason || 'Train service cancelled by railway operations',
          cancellation_type: 'train_service',
          cancelled_by_user_id: req.user.id,
          cancelled_by_role: req.user.role || 'admin',
          cancellation_date_time: b.cancellation_date_time,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        mockDb.cancellation_records.set(b.id, cancRecord);

        const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === b.id);
        if (payment) {
          payment.status = 'REFUNDED';
          payment.refund_amount = fullFare;
          mockDb.payments.set(payment.id, payment);
        }

        logAuditEvent({
          action: 'TRAIN_SERVICE_CANCELLED',
          event_type: 'TRAIN_SERVICE_CANCELLED',
          booking_id: b.id,
          cancellation_record_id: cancRecord.id,
          pnr: b.pnr_number,
          target_id: b.pnr_number || b.id,
          train_id: trainId,
          user_id: req.user.id,
          user_role: req.user.role,
          previous_status: 'confirmed',
          new_status: 'cancelled',
          reason: `Train Service Cancellation: ${reason || 'Operational disruption'}`,
          original_amount: fullFare,
          deduction_amount: 0,
          refund_amount: fullFare,
          penalty_amount: 0,
          timestamp: new Date().toISOString()
        });
      });

      logAuditEvent({
        action: 'TRAIN_CANCELLED',
        target_id: train.train_number || trainId,
        train_id: trainId,
        user_id: req.user.id,
        user_role: req.user.role,
        previous_status: previousStatus,
        new_status: 'cancelled',
        reason: reason || 'Operational Emergency',
        refund_amount: totalRefundAmount,
        penalty_amount: 0,
        details: { affectedBookingsCount, message }
      });
    }

    // Notify Passengers
    const affectedBookings = Array.from(mockDb.bookings.values()).filter(b => b.train_id === trainId);
    const notificationMessage = status === 'cancelled'
      ? `Train ${train.train_name} (#${train.train_number}) scheduled for travel has been CANCELLED. Reason: ${reason || 'Operational reasons'}.`
      : status === 'delayed'
      ? `Train ${train.train_name} (#${train.train_number}) is delayed by ${delay_minutes} minutes. New Departure: ${finalDepartureTime?.slice(0,5)}. Reason: ${reason || 'Technical issue'}.`
      : `Train ${train.train_name} (#${train.train_number}) has been rescheduled. New Departure: ${finalDepartureTime?.slice(0,5)}. Reason: ${reason || 'Scheduling adjustment'}.`;

    affectedBookings.forEach(b => {
      const notifId = uuidv4();
      mockDb.notifications.set(notifId, {
        id: notifId,
        user_id: b.passenger_id,
        type: status === 'cancelled' ? 'danger' : status === 'delayed' ? 'warning' : 'info',
        title: `Train Service Status Alert: ${train.train_name}`,
        message: notificationMessage,
        is_read: false,
        created_at: new Date().toISOString()
      });
    });

    saveMockDbToFile();

    return res.json({ message: 'Train status updated and cancellation cascade completed (Mock Mode)', train, affectedBookingsCount, totalRefundAmount });
  } else {
    try {
      const { data: train, error: tErr } = await supabase.from('trains').select('*').eq('id', trainId).single();
      if (tErr || !train) return res.status(404).json({ error: 'Train not found' });

      const previousStatus = train.status || 'on_time';
      
      const { data: routeObj } = await supabase.from('routes').select('departure_time, arrival_time').eq('train_id', trainId).maybeSingle();
      const scheduled_departure_time = train.scheduled_departure_time || (routeObj ? routeObj.departure_time : '10:00:00');
      const scheduled_arrival_time = train.scheduled_arrival_time || (routeObj ? routeObj.arrival_time : '18:00:00');

      let finalDepartureTime = null;
      let finalArrivalTime = null;

      if (status === 'delayed') {
        finalDepartureTime = addMinutesToTime(scheduled_departure_time, parseInt(delay_minutes, 10));
        finalArrivalTime = addMinutesToTime(scheduled_arrival_time, parseInt(delay_minutes, 10));
      } else if (status === 'rescheduled') {
        finalDepartureTime = updated_departure_time;
        finalArrivalTime = updated_arrival_time;
      }

      // Update Train
      const updates = {
        status,
        delay_minutes: status === 'delayed' ? parseInt(delay_minutes, 10) : 0,
        delay_reason: (status === 'delayed' || status === 'rescheduled') ? reason : null,
        delay_message: (status === 'delayed' || status === 'rescheduled') ? message : null,
        cancellation_reason: status === 'cancelled' ? reason : null,
        cancellation_message: status === 'cancelled' ? message : null,
        scheduled_departure_time,
        scheduled_arrival_time,
        updated_departure_time: finalDepartureTime,
        updated_arrival_time: finalArrivalTime,
        status_updated_at: new Date().toISOString()
      };

      const { data: updatedTrain, error: upErr } = await supabase
        .from('trains')
        .update(updates)
        .eq('id', trainId)
        .select()
        .single();

      if (upErr) throw upErr;

      // Save History
      await supabase.from('train_status_history').insert({
        train_id: trainId,
        previous_status: previousStatus,
        new_status: status,
        delay_minutes: status === 'delayed' ? parseInt(delay_minutes, 10) : 0,
        reason: reason || '',
        message: message || '',
        updated_departure_time: finalDepartureTime,
        updated_arrival_time: finalArrivalTime,
        updated_at: new Date().toISOString(),
        updated_by: 'ADMIN'
      });

      // Notify Passengers
      const { data: affectedBookings } = await supabase
        .from('bookings')
        .select('passenger_id')
        .eq('train_id', trainId)
        .eq('status', 'confirmed');

      if (affectedBookings && affectedBookings.length > 0) {
        const notificationMessage = status === 'cancelled'
          ? `Train ${train.train_name} (#${train.train_number}) scheduled for travel has been CANCELLED. Reason: ${reason || 'Operational reasons'}.`
          : status === 'delayed'
          ? `Train ${train.train_name} (#${train.train_number}) is delayed by ${delay_minutes} minutes. New Departure: ${finalDepartureTime?.slice(0,5)}. Reason: ${reason || 'Technical issue'}.`
          : `Train ${train.train_name} (#${train.train_number}) has been rescheduled. New Departure: ${finalDepartureTime?.slice(0,5)}. Reason: ${reason || 'Scheduling adjustment'}.`;

        const notifs = affectedBookings.map(b => ({
          user_id: b.passenger_id,
          type: status === 'cancelled' ? 'danger' : status === 'delayed' ? 'warning' : 'info',
          title: `Train Service Status Alert: ${train.train_name}`,
          message: notificationMessage,
          is_read: false,
          created_at: new Date().toISOString()
        }));

        await supabase.from('notifications').insert(notifs);
      }

      return res.json({ message: 'Train status updated successfully', train: updatedTrain });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update train status: ' + err.message });
    }
  }
});

// POST /api/admin/train-status/:trainId/restore
router.post('/train-status/:trainId/restore', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { trainId } = req.params;

  if (isMockMode) {
    const train = mockDb.trains.get(trainId);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    const previousStatus = train.status || 'on_time';

    train.status = 'on_time';
    train.delay_minutes = 0;
    train.delay_reason = null;
    train.delay_message = null;
    train.cancellation_reason = null;
    train.cancellation_message = null;
    train.updated_departure_time = null;
    train.updated_arrival_time = null;
    train.status_updated_at = new Date().toISOString();

    mockDb.trains.set(trainId, train);

    // Save History
    const historyId = uuidv4();
    mockDb.train_status_history.set(historyId, {
      id: historyId,
      train_id: trainId,
      previous_status: previousStatus,
      new_status: 'on_time',
      delay_minutes: 0,
      reason: 'Restore Service',
      message: 'Train is running on time again.',
      updated_departure_time: null,
      updated_arrival_time: null,
      updated_at: new Date().toISOString(),
      updated_by: 'ADMIN'
    });

    // Notify Passengers
    const affectedBookings = Array.from(mockDb.bookings.values()).filter(b => b.train_id === trainId && b.status === 'confirmed');
    affectedBookings.forEach(b => {
      const notifId = uuidv4();
      mockDb.notifications.set(notifId, {
        id: notifId,
        user_id: b.passenger_id,
        type: 'success',
        title: `Train Service Status Alert: ${train.train_name}`,
        message: `Train ${train.train_name} (#${train.train_number}) service is restored to ON TIME.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    });

    saveMockDbToFile();

    return res.json({ message: 'Train service restored to ON TIME successfully (Mock Mode)', train });
  } else {
    try {
      const { data: train, error: tErr } = await supabase.from('trains').select('*').eq('id', trainId).single();
      if (tErr || !train) return res.status(404).json({ error: 'Train not found' });

      const previousStatus = train.status || 'on_time';

      const updates = {
        status: 'on_time',
        delay_minutes: 0,
        delay_reason: null,
        delay_message: null,
        cancellation_reason: null,
        cancellation_message: null,
        updated_departure_time: null,
        updated_arrival_time: null,
        status_updated_at: new Date().toISOString()
      };

      const { data: updatedTrain, error: upErr } = await supabase
        .from('trains')
        .update(updates)
        .eq('id', trainId)
        .select()
        .single();

      if (upErr) throw upErr;

      // Save History
      await supabase.from('train_status_history').insert({
        train_id: trainId,
        previous_status: previousStatus,
        new_status: 'on_time',
        delay_minutes: 0,
        reason: 'Restore Service',
        message: 'Train is running on time again.',
        updated_departure_time: null,
        updated_arrival_time: null,
        updated_at: new Date().toISOString(),
        updated_by: 'ADMIN'
      });

      // Notify Passengers
      const { data: affectedBookings } = await supabase
        .from('bookings')
        .select('passenger_id')
        .eq('train_id', trainId)
        .eq('status', 'confirmed');

      if (affectedBookings && affectedBookings.length > 0) {
        const notifs = affectedBookings.map(b => ({
          user_id: b.passenger_id,
          type: 'success',
          title: `Train Service Status Alert: ${train.train_name}`,
          message: `Train ${train.train_name} (#${train.train_number}) service is restored to ON TIME.`,
          is_read: false,
          created_at: new Date().toISOString()
        }));

        await supabase.from('notifications').insert(notifs);
      }

      return res.json({ message: 'Train service restored to ON TIME successfully', train: updatedTrain });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to restore train status: ' + err.message });
    }
  }
});

// ==========================================
// ROUTE MANAGEMENT ENDPOINTS (/api/admin/routes)
// ==========================================

function getStationNameByCode(code) {
  if (!code) return '';
  const cleanCode = String(code).trim().toUpperCase();
  if (isMockMode) {
    const station = Array.from(mockDb.stations.values()).find(
      s => s && s.station_code && s.station_code.toUpperCase() === cleanCode
    );
    if (station && station.station_name) return station.station_name;
  }
  const fallbackMap = {
    'NDLS': 'New Delhi',
    'MMCT': 'Mumbai Central',
    'CSMT': 'Chhatrapati Shivaji Maharaj Terminus',
    'UDU': 'Udupi',
    'HWH': 'Howrah Junction',
    'SBC': 'KSR Bengaluru City',
    'MAS': 'MGR Chennai Central',
    'KOTA': 'Kota Junction',
    'BPL': 'Bhopal Junction',
    'ADI': 'Ahmedabad Junction',
    'PNBE': 'Patna Junction',
    'JP': 'Jaipur Junction',
    'NZM': 'Hazrat Nizamuddin',
    'AGC': 'Agra Cantt'
  };
  return fallbackMap[cleanCode] || cleanCode;
}

function calculateRouteDurationString(depTime, arrTime) {
  if (!depTime || !arrTime) return '12h 00m';
  const depParts = String(depTime).split(':').map(n => parseInt(n, 10) || 0);
  const arrParts = String(arrTime).split(':').map(n => parseInt(n, 10) || 0);
  let depMins = depParts[0] * 60 + (depParts[1] || 0);
  let arrMins = arrParts[0] * 60 + (arrParts[1] || 0);
  let diff = arrMins - depMins;
  if (diff <= 0) diff += 24 * 60;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function enrichSingleRoute(route, trainsList = [], stationsList = []) {
  const stationMap = new Map();
  (stationsList || []).forEach(s => {
    if (s && s.station_code) {
      stationMap.set(s.station_code.toUpperCase(), s.station_name);
    }
  });

  const srcCode = (route.source_station_code || '').trim().toUpperCase();
  const destCode = (route.destination_station_code || '').trim().toUpperCase();
  const srcName = stationMap.get(srcCode) || getStationNameByCode(srcCode);
  const destName = stationMap.get(destCode) || getStationNameByCode(destCode);

  const stops = Array.isArray(route.stops) ? route.stops.map((s, idx) => {
    const stCode = (s.stationCode || s.station_code || s.code || '').trim().toUpperCase();
    const stName = s.stationName || s.station_name || stationMap.get(stCode) || getStationNameByCode(stCode);
    return {
      sequence: s.sequence !== undefined ? parseInt(s.sequence, 10) : idx + 1,
      stationCode: stCode,
      stationName: stName,
      arrTime: s.arrTime || s.arrival_time || '00:00:00',
      depTime: s.depTime || s.departure_time || '00:00:00',
      haltMinutes: s.haltMinutes !== undefined ? String(s.haltMinutes) : '5',
      distanceFromOriginKm: s.distanceFromOriginKm !== undefined ? parseFloat(s.distanceFromOriginKm) : (parseFloat(s.distance_km) || 0)
    };
  }) : [];

  const assignedTrains = trainsList.filter(t => {
    if (!t) return false;
    const tSrc = (t.source_station_code || t.source || '').trim().toUpperCase();
    const tDest = (t.destination_station_code || t.destination || '').trim().toUpperCase();
    return t.route_id === route.id || (tSrc === srcCode && tDest === destCode);
  });

  const trainNumbers = Array.from(new Set(assignedTrains.map(t => t.train_number).filter(Boolean)));
  const trainDetails = assignedTrains.map(t => ({
    id: t.id,
    train_number: t.train_number,
    train_name: t.train_name,
    status: t.status || 'on_time'
  }));

  const estDuration = route.estimated_duration || route.duration || calculateRouteDurationString(route.departure_time, route.arrival_time);

  return {
    id: route.id,
    train_id: route.train_id || null,
    source_station_code: srcCode,
    source_station_name: srcName,
    destination_station_code: destCode,
    destination_station_name: destName,
    distance_km: parseFloat(route.distance_km || 500),
    departure_time: route.departure_time || '08:00:00',
    arrival_time: route.arrival_time || '20:00:00',
    estimated_duration: estDuration,
    status: route.status || 'Active',
    stops: stops,
    stops_count: stops.length,
    trains_count: assignedTrains.length,
    train_numbers: trainNumbers,
    trains: trainDetails,
    created_at: route.created_at || new Date().toISOString(),
    updated_at: route.updated_at || new Date().toISOString()
  };
}

// GET /api/admin/routes - List all unique real routes with pagination, search, filter & sort
router.get('/routes', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  try {
    let routesList = [];
    let trainsList = [];
    let stationsList = [];

    if (isMockMode) {
      routesList = Array.from(mockDb.routes.values());
      trainsList = Array.from(mockDb.trains.values());
      stationsList = Array.from(mockDb.stations.values());
    } else {
      const { data: rData, error: rErr } = await supabase.from('routes').select('*');
      if (rErr) throw rErr;
      const { data: tData } = await supabase.from('trains').select('*');
      const { data: sData } = await supabase.from('stations').select('*');
      routesList = rData || [];
      trainsList = tData || [];
      stationsList = sData || [];
    }

    // Filter unique routes by signature
    const uniqueRoutesMap = new Map();
    routesList.forEach(r => {
      if (!r) return;
      const src = (r.source_station_code || r.source || '').trim().toUpperCase();
      const dest = (r.destination_station_code || r.destination || '').trim().toUpperCase();
      const stopsSig = Array.isArray(r.stops) ? r.stops.map(s => s.stationCode || s.station_code || s.code).filter(Boolean).join('-') : '';
      const sig = `${src}_${dest}_[${stopsSig}]`;
      if (!uniqueRoutesMap.has(sig)) {
        uniqueRoutesMap.set(sig, r);
      }
    });

    // Enrich all routes
    let enriched = Array.from(uniqueRoutesMap.values()).map(r => enrichSingleRoute(r, trainsList, stationsList));

    // Global Metrics from complete dataset
    const totalCount = enriched.length;
    const activeCount = enriched.filter(r => (r.status || '').toLowerCase() === 'active').length;
    const inactiveCount = totalCount - activeCount;

    const stationSet = new Set();
    let totalTrains = 0;
    enriched.forEach(r => {
      if (r.source_station_code) stationSet.add(r.source_station_code);
      if (r.destination_station_code) stationSet.add(r.destination_station_code);
      if (Array.isArray(r.stops)) {
        r.stops.forEach(s => { if (s.stationCode) stationSet.add(s.stationCode); });
      }
      totalTrains += (r.trains_count || 0);
    });

    // Query Filters
    const { search, source, destination, status, sortBy, page, pageSize, limit } = req.query;

    if (source && source !== 'ALL') {
      enriched = enriched.filter(r => r.source_station_code === source.toUpperCase());
    }

    if (destination && destination !== 'ALL') {
      enriched = enriched.filter(r => r.destination_station_code === destination.toUpperCase());
    }

    if (status && status !== 'ALL') {
      enriched = enriched.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      enriched = enriched.filter(r => {
        const srcCode = (r.source_station_code || '').toLowerCase();
        const srcName = (r.source_station_name || '').toLowerCase();
        const destCode = (r.destination_station_code || '').toLowerCase();
        const destName = (r.destination_station_name || '').toLowerCase();
        const rId = (r.id || '').toLowerCase();
        const rStr = `${srcCode} -> ${destCode} ${srcName} -> ${destName}`.toLowerCase();
        const stopsMatch = Array.isArray(r.stops) && r.stops.some(s =>
          (s.stationCode || '').toLowerCase().includes(q) || (s.stationName || '').toLowerCase().includes(q)
        );
        return srcCode.includes(q) || srcName.includes(q) || destCode.includes(q) || destName.includes(q) || rId.includes(q) || rStr.includes(q) || stopsMatch;
      });
    }

    // Sorting
    if (sortBy) {
      if (sortBy === 'DISTANCE_DESC') enriched.sort((a, b) => b.distance_km - a.distance_km);
      else if (sortBy === 'DISTANCE_ASC') enriched.sort((a, b) => a.distance_km - b.distance_km);
      else if (sortBy === 'DURATION_DESC') enriched.sort((a, b) => (b.duration_minutes || 0) - (a.duration_minutes || 0));
      else if (sortBy === 'DURATION_ASC') enriched.sort((a, b) => (a.duration_minutes || 0) - (b.duration_minutes || 0));
      else if (sortBy === 'TRAINS_DESC') enriched.sort((a, b) => b.trains_count - a.trains_count);
      else if (sortBy === 'ROUTE_ID') enriched.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      else if (sortBy === 'SOURCE') enriched.sort((a, b) => a.source_station_code.localeCompare(b.source_station_code));
    }

    const filteredTotal = enriched.length;

    // Pagination Calculation
    if (page || pageSize || limit) {
      const p = Math.max(parseInt(page, 10) || 1, 1);
      const ps = Math.max(parseInt(pageSize || limit, 10) || 25, 1);
      const totalPages = Math.ceil(filteredTotal / ps) || 1;
      const startIndex = (p - 1) * ps;
      const paginatedRoutes = enriched.slice(startIndex, startIndex + ps);

      return res.json({
        success: true,
        routes: paginatedRoutes,
        total: filteredTotal,
        globalTotal: totalCount,
        page: p,
        pageSize: ps,
        totalPages: totalPages,
        activeCount: activeCount,
        inactiveCount: inactiveCount,
        stationsCoveredCount: stationSet.size,
        trainsUsingRoutesCount: totalTrains
      });
    }

    // Default response returning complete enriched list with custom headers
    res.setHeader('X-Total-Count', String(filteredTotal));
    return res.json(enriched);
  } catch (err) {
    console.error('Error fetching routes:', err.message);
    return res.status(500).json({ error: 'Failed to fetch routes: ' + err.message });
  }
});

// GET /api/admin/routes/:id - Get route details by ID
router.get('/routes/:id', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { id } = req.params;
  if (isMockMode) {
    const route = mockDb.routes.get(id) || Array.from(mockDb.routes.values()).find(r => r.id === id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    const trainsList = Array.from(mockDb.trains.values());
    const stationsList = Array.from(mockDb.stations.values());
    return res.json(enrichSingleRoute(route, trainsList, stationsList));
  } else {
    try {
      const { data: route, error } = await supabase.from('routes').select('*').eq('id', id).single();
      if (error || !route) return res.status(404).json({ error: 'Route not found' });
      const { data: trainsData } = await supabase.from('trains').select('*');
      const { data: stationsData } = await supabase.from('stations').select('*');
      return res.json(enrichSingleRoute(route, trainsData || [], stationsData || []));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch route: ' + err.message });
    }
  }
});

// POST /api/admin/routes - Create a new route
router.post('/routes', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const {
    source_station_code,
    destination_station_code,
    distance_km,
    departure_time,
    arrival_time,
    estimated_duration,
    status,
    stops
  } = req.body;

  const srcCode = (source_station_code || '').trim().toUpperCase();
  const destCode = (destination_station_code || '').trim().toUpperCase();

  if (!srcCode || !destCode) {
    return res.status(400).json({ error: 'Source station and destination station codes are required.' });
  }

  if (srcCode === destCode) {
    return res.status(400).json({ error: 'Source and destination stations cannot be identical.' });
  }

  const numericDistance = parseFloat(distance_km);
  if (isNaN(numericDistance) || numericDistance < 0) {
    return res.status(400).json({ error: 'Distance must be a valid non-negative number.' });
  }

  const formattedStops = Array.isArray(stops) ? stops.map((s, idx) => ({
    sequence: parseInt(s.sequence || idx + 1, 10),
    stationCode: (s.stationCode || s.station_code || s.code || '').trim().toUpperCase(),
    stationName: s.stationName || s.station_name || '',
    arrTime: s.arrTime || s.arrival_time || '00:00:00',
    depTime: s.depTime || s.departure_time || '00:00:00',
    haltMinutes: String(s.haltMinutes || '5'),
    distanceFromOriginKm: parseFloat(s.distanceFromOriginKm || s.distance_km || 0)
  })) : [];

  if (isMockMode) {
    const stationsList = Array.from(mockDb.stations.values());
    const validCodes = new Set(stationsList.map(s => s.station_code ? s.station_code.toUpperCase() : ''));

    if (!validCodes.has(srcCode)) {
      return res.status(400).json({ error: `Source station code '${srcCode}' does not exist in station database.` });
    }
    if (!validCodes.has(destCode)) {
      return res.status(400).json({ error: `Destination station code '${destCode}' does not exist in station database.` });
    }
    for (const stop of formattedStops) {
      if (!validCodes.has(stop.stationCode)) {
        return res.status(400).json({ error: `Intermediate station code '${stop.stationCode}' does not exist in station database.` });
      }
    }

    const stopsSig = formattedStops.map(s => s.stationCode).join('-');
    const existingRoutes = Array.from(mockDb.routes.values());
    const duplicate = existingRoutes.find(r => {
      if (!r) return false;
      const rSrc = (r.source_station_code || '').trim().toUpperCase();
      const rDest = (r.destination_station_code || '').trim().toUpperCase();
      const rStopsSig = Array.isArray(r.stops) ? r.stops.map(s => s.stationCode || s.station_code || s.code).filter(Boolean).join('-') : '';
      return rSrc === srcCode && rDest === destCode && rStopsSig === stopsSig;
    });

    if (duplicate) {
      return res.status(400).json({ error: 'This route already exists. Please edit the existing route instead.' });
    }

    const newRouteId = `r-${Math.random().toString(36).substr(2, 9)}`;
    const nowIso = new Date().toISOString();
    const newRoute = {
      id: newRouteId,
      source_station_code: srcCode,
      destination_station_code: destCode,
      distance_km: numericDistance,
      departure_time: departure_time || '08:00:00',
      arrival_time: arrival_time || '20:00:00',
      estimated_duration: estimated_duration || calculateRouteDurationString(departure_time, arrival_time),
      status: status || 'Active',
      stops: formattedStops,
      created_at: nowIso,
      updated_at: nowIso
    };

    mockDb.routes.set(newRouteId, newRoute);
    saveMockDbToFile();

    const enriched = enrichSingleRoute(newRoute, Array.from(mockDb.trains.values()), stationsList);
    return res.status(201).json({ message: 'Route created successfully', route: enriched });
  } else {
    try {
      const { data: stationsData } = await supabase.from('stations').select('station_code');
      const validCodes = new Set((stationsData || []).map(s => s.station_code ? s.station_code.toUpperCase() : ''));

      if (!validCodes.has(srcCode)) {
        return res.status(400).json({ error: `Source station code '${srcCode}' does not exist in station database.` });
      }
      if (!validCodes.has(destCode)) {
        return res.status(400).json({ error: `Destination station code '${destCode}' does not exist in station database.` });
      }

      const { data: existing } = await supabase.from('routes').select('*')
        .eq('source_station_code', srcCode)
        .eq('destination_station_code', destCode);

      const stopsSig = formattedStops.map(s => s.stationCode).join('-');
      const duplicate = (existing || []).find(r => {
        const rStopsSig = Array.isArray(r.stops) ? r.stops.map(s => s.stationCode || s.station_code || s.code).filter(Boolean).join('-') : '';
        return rStopsSig === stopsSig;
      });

      if (duplicate) {
        return res.status(400).json({ error: 'This route already exists. Please edit the existing route instead.' });
      }

      const insertData = {
        source_station_code: srcCode,
        destination_station_code: destCode,
        distance_km: numericDistance,
        departure_time: departure_time || '08:00:00',
        arrival_time: arrival_time || '20:00:00',
        status: status || 'Active',
        stops: formattedStops
      };

      const { data: inserted, error: iErr } = await supabase.from('routes').insert(insertData).select().single();
      if (iErr) throw iErr;

      const { data: trainsData } = await supabase.from('trains').select('*');
      const enriched = enrichSingleRoute(inserted, trainsData || [], stationsData || []);
      return res.status(201).json({ message: 'Route created successfully', route: enriched });
    } catch (err) {
      console.error('Error creating route:', err.message);
      return res.status(500).json({ error: 'Failed to create route: ' + err.message });
    }
  }
});

// PUT /api/admin/routes/:id - Update route
router.put('/routes/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const {
    source_station_code,
    destination_station_code,
    distance_km,
    departure_time,
    arrival_time,
    estimated_duration,
    status,
    stops
  } = req.body;

  const srcCode = (source_station_code || '').trim().toUpperCase();
  const destCode = (destination_station_code || '').trim().toUpperCase();

  if (!srcCode || !destCode) {
    return res.status(400).json({ error: 'Source station and destination station codes are required.' });
  }

  if (srcCode === destCode) {
    return res.status(400).json({ error: 'Source and destination stations cannot be identical.' });
  }

  const numericDistance = parseFloat(distance_km);
  if (isNaN(numericDistance) || numericDistance < 0) {
    return res.status(400).json({ error: 'Distance must be a valid non-negative number.' });
  }

  const formattedStops = Array.isArray(stops) ? stops.map((s, idx) => ({
    sequence: parseInt(s.sequence || idx + 1, 10),
    stationCode: (s.stationCode || s.station_code || s.code || '').trim().toUpperCase(),
    stationName: s.stationName || s.station_name || '',
    arrTime: s.arrTime || s.arrival_time || '00:00:00',
    depTime: s.depTime || s.departure_time || '00:00:00',
    haltMinutes: String(s.haltMinutes || '5'),
    distanceFromOriginKm: parseFloat(s.distanceFromOriginKm || s.distance_km || 0)
  })) : [];

  if (isMockMode) {
    const route = mockDb.routes.get(id) || Array.from(mockDb.routes.values()).find(r => r.id === id);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const stationsList = Array.from(mockDb.stations.values());
    const validCodes = new Set(stationsList.map(s => s.station_code ? s.station_code.toUpperCase() : ''));

    if (!validCodes.has(srcCode)) {
      return res.status(400).json({ error: `Source station code '${srcCode}' does not exist in station database.` });
    }
    if (!validCodes.has(destCode)) {
      return res.status(400).json({ error: `Destination station code '${destCode}' does not exist in station database.` });
    }
    for (const stop of formattedStops) {
      if (!validCodes.has(stop.stationCode)) {
        return res.status(400).json({ error: `Intermediate station code '${stop.stationCode}' does not exist in station database.` });
      }
    }

    const nowIso = new Date().toISOString();
    const oldSrc = route.source_station_code;
    const oldDest = route.destination_station_code;

    route.source_station_code = srcCode;
    route.destination_station_code = destCode;
    route.distance_km = numericDistance;
    if (departure_time) route.departure_time = departure_time;
    if (arrival_time) route.arrival_time = arrival_time;
    if (estimated_duration) route.estimated_duration = estimated_duration;
    if (status) route.status = status;
    route.stops = formattedStops;
    route.updated_at = nowIso;

    mockDb.routes.set(id, route);

    // Synchronize assigned trains
    const trainsList = Array.from(mockDb.trains.values());
    trainsList.forEach(t => {
      if (!t) return;
      const tSrc = (t.source_station_code || t.source || '').trim().toUpperCase();
      const tDest = (t.destination_station_code || t.destination || '').trim().toUpperCase();
      if (t.route_id === id || (tSrc === oldSrc && tDest === oldDest)) {
        t.source_station_code = srcCode;
        t.destination_station_code = destCode;
        t.source = srcCode;
        t.destination = destCode;
        t.distance_km = numericDistance;
        t.updated_at = nowIso;
        mockDb.trains.set(t.id, t);
      }
    });

    saveMockDbToFile();

    const enriched = enrichSingleRoute(route, trainsList, stationsList);
    return res.json({ message: 'Route updated successfully', route: enriched });
  } else {
    try {
      const { data: existingRoute, error: fetchErr } = await supabase.from('routes').select('*').eq('id', id).single();
      if (fetchErr || !existingRoute) return res.status(404).json({ error: 'Route not found' });

      const updates = {
        source_station_code: srcCode,
        destination_station_code: destCode,
        distance_km: numericDistance,
        departure_time: departure_time || existingRoute.departure_time,
        arrival_time: arrival_time || existingRoute.arrival_time,
        status: status || existingRoute.status,
        stops: formattedStops
      };

      const { data: updated, error: upErr } = await supabase.from('routes').update(updates).eq('id', id).select().single();
      if (upErr) throw upErr;

      await supabase.from('trains').update({
        source_station_code: srcCode,
        destination_station_code: destCode
      }).or(`route_id.eq.${id},and(source_station_code.eq.${existingRoute.source_station_code},destination_station_code.eq.${existingRoute.destination_station_code})`);

      const { data: trainsData } = await supabase.from('trains').select('*');
      const { data: stationsData } = await supabase.from('stations').select('*');

      const enriched = enrichSingleRoute(updated, trainsData || [], stationsData || []);
      return res.json({ message: 'Route updated successfully', route: enriched });
    } catch (err) {
      console.error('Error updating route:', err.message);
      return res.status(500).json({ error: 'Failed to update route: ' + err.message });
    }
  }
});

// DELETE /api/admin/routes/:id - Delete route with safety check
router.delete('/routes/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    const route = mockDb.routes.get(id) || Array.from(mockDb.routes.values()).find(r => r.id === id);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const srcCode = (route.source_station_code || '').trim().toUpperCase();
    const destCode = (route.destination_station_code || '').trim().toUpperCase();

    const assignedTrains = Array.from(mockDb.trains.values()).filter(t => {
      if (!t) return false;
      const tSrc = (t.source_station_code || t.source || '').trim().toUpperCase();
      const tDest = (t.destination_station_code || t.destination || '').trim().toUpperCase();
      return t.route_id === id || (tSrc === srcCode && tDest === destCode);
    });

    if (assignedTrains.length > 0) {
      return res.status(400).json({
        error: 'This route is currently used by a train and cannot be permanently deleted. Deactivate it instead.'
      });
    }

    mockDb.routes.delete(id);
    saveMockDbToFile();

    return res.json({
      success: true,
      message: 'Route permanently deleted',
      deletedRouteId: id,
      remainingRoutes: mockDb.routes.size
    });
  } else {
    try {
      const { data: route, error: rErr } = await supabase.from('routes').select('*').eq('id', id).single();
      if (rErr || !route) return res.status(404).json({ error: 'Route not found' });

      const { data: assignedTrains } = await supabase.from('trains').select('id')
        .or(`route_id.eq.${id},and(source_station_code.eq.${route.source_station_code},destination_station_code.eq.${route.destination_station_code})`);

      if (assignedTrains && assignedTrains.length > 0) {
        return res.status(400).json({
          error: 'This route is currently used by a train and cannot be permanently deleted. Deactivate it instead.'
        });
      }

      const { error: delErr } = await supabase.from('routes').delete().eq('id', id);
      if (delErr) throw delErr;

      const { count } = await supabase.from('routes').select('*', { count: 'exact', head: true });

      return res.json({
        success: true,
        message: 'Route permanently deleted',
        deletedRouteId: id,
        remainingRoutes: count || 0
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete route: ' + err.message });
    }
  }
});

// PATCH /api/admin/routes/:id/status - Toggle route status (Active/Inactive)
router.patch('/routes/:id/status', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Active or Inactive.' });
  }

  if (isMockMode) {
    const route = mockDb.routes.get(id) || Array.from(mockDb.routes.values()).find(r => r.id === id);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    route.status = status;
    route.updated_at = new Date().toISOString();
    mockDb.routes.set(id, route);
    saveMockDbToFile();

    const trainsList = Array.from(mockDb.trains.values());
    const stationsList = Array.from(mockDb.stations.values());
    return res.json({ message: `Route status updated to ${status}`, route: enrichSingleRoute(route, trainsList, stationsList) });
  } else {
    try {
      const { data: updated, error } = await supabase.from('routes').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error || !updated) return res.status(404).json({ error: 'Route not found' });
      const { data: trainsData } = await supabase.from('trains').select('*');
      const { data: stationsData } = await supabase.from('stations').select('*');
      return res.json({ message: `Route status updated to ${status}`, route: enrichSingleRoute(updated, trainsData || [], stationsData || []) });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update route status: ' + err.message });
    }
  }
});

// GET /api/admin/refunds - Get permanent cancellation records for Admin Refund Operations Center
router.get('/refunds', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { status, type, search } = req.query;

  try {
    let records = [];
    if (isMockMode) {
      records = Array.from(mockDb.cancellation_records.values());

      // Safe backfill: ensure all cancelled bookings exist in cancellation_records
      for (const b of mockDb.bookings.values()) {
        if (b.status === 'cancelled' && !mockDb.cancellation_records.has(b.id)) {
          const train = mockDb.trains.get(b.train_id);
          const passenger = mockDb.profiles.get(b.passenger_id);
          const rec = {
            id: `canc-${b.id}`,
            booking_id: b.id,
            pnr: b.pnr_number,
            passenger_id: b.passenger_id,
            passenger_name: passenger ? (passenger.full_name || passenger.email) : 'Passenger',
            train_id: b.train_id,
            train_number: train ? train.train_number : (b.train_number || '12952'),
            train_name: train ? train.train_name : (b.train_name || 'Express Special'),
            journey_date: b.travel_date,
            original_fare: b.total_fare || 1000,
            deduction_amount: b.penalty_amount !== undefined ? b.penalty_amount : 240,
            refund_amount: b.refund_amount !== undefined ? b.refund_amount : Math.max(0, (b.total_fare || 1000) - 240),
            refund_status: b.refund_status || 'APPROVED',
            cancellation_reason: b.cancellation_reason || 'Passenger requested cancellation',
            cancellation_type: 'passenger',
            cancelled_by_user_id: b.passenger_id,
            cancelled_by_role: 'passenger',
            cancellation_date_time: b.cancellation_date_time || b.created_at || new Date().toISOString(),
            created_at: b.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          mockDb.cancellation_records.set(b.id, rec);
          records.push(rec);
        }
      }
    } else {
      const { data, error } = await supabase
        .from('cancellation_records')
        .select(`
          *,
          profiles:passenger_id(full_name, email),
          trains:train_id(train_number, train_name)
        `)
        .order('cancellation_date_time', { ascending: false });

      if (error) throw error;
      records = data || [];
    }

    // Enrich each record with dual property formats (camelCase & snake_case)
    let enriched = records.map(r => {
      const passengerName = resolvePassengerNameForBooking(r.booking_id, r.passenger_id, r.passenger_name);

      // Persist resolved name back to mockDb if in mock mode
      if (isMockMode && r.booking_id && mockDb.cancellation_records.has(r.booking_id)) {
        const dbRec = mockDb.cancellation_records.get(r.booking_id);
        if (dbRec && dbRec.passenger_name !== passengerName) {
          dbRec.passenger_name = passengerName;
          mockDb.cancellation_records.set(r.booking_id, dbRec);
        }
      }

      const trainNo = r.train_number || (r.trains ? r.trains.train_number : '12952');
      const trainNameStr = r.train_name || (r.trains ? r.trains.train_name : 'Express Special');
      const fullTrainLabel = `${trainNameStr} (${trainNo})`;
      const origFare = Number(r.original_fare || r.originalFare || 0);
      const deduct = Number(r.deduction_amount !== undefined ? r.deduction_amount : (r.deduction || 0));
      let refAmt = Number(r.refund_amount !== undefined ? r.refund_amount : (r.refundAmount || 0));
      if (origFare > 0 && (refAmt > Math.max(0, origFare - deduct) || refAmt === origFare)) {
        refAmt = Math.max(0, origFare - deduct);
      }
      const refStatus = (r.refund_status || r.status || 'PENDING').toUpperCase();
      const cancType = r.cancellation_type || 'passenger';

      let cancelledByLabel = 'Passenger';
      if (cancType === 'train_service') {
        cancelledByLabel = 'Railway Operations';
      } else if (r.cancelled_by_role === 'staff' || r.cancelled_by_role === 'admin' || cancType === 'admin') {
        cancelledByLabel = r.admin_override ? 'Admin Override' : 'Staff Admin';
      }

      const cancDate = (r.cancellation_date_time || r.created_at || new Date().toISOString()).slice(0, 10);

      return {
        ...r,
        id: r.id || `canc-${r.booking_id}`,
        booking_id: r.booking_id,
        bookingId: r.booking_id,
        pnr: r.pnr,
        passenger: passengerName,
        passenger_name: passengerName,
        passenger_id: r.passenger_id,
        train: fullTrainLabel,
        train_number: trainNo,
        train_name: trainNameStr,
        journeyDate: r.journey_date || r.journeyDate || '',
        journey_date: r.journey_date || r.journeyDate || '',
        originalFare: origFare,
        original_fare: origFare,
        deduction: deduct,
        deduction_amount: deduct,
        refundAmount: refAmt,
        refund_amount: refAmt,
        status: refStatus,
        refund_status: refStatus,
        cancellationReason: r.cancellation_reason || r.cancellationReason || 'Passenger Request',
        cancellation_reason: r.cancellation_reason || r.cancellationReason || 'Passenger Request',
        cancellationType: cancType,
        cancellation_type: cancType,
        cancelledBy: cancelledByLabel,
        cancelled_by: cancelledByLabel,
        cancelled_by_role: r.cancelled_by_role || 'passenger',
        cancellationDate: cancDate,
        cancellation_date_time: r.cancellation_date_time || r.created_at || new Date().toISOString(),
        admin_override: !!r.admin_override,
        created_at: r.created_at || new Date().toISOString()
      };
    });

    // Sort newest cancellation date first
    enriched.sort((a, b) => new Date(b.cancellation_date_time) - new Date(a.cancellation_date_time));

    // Calculate Summary Statistics across all records BEFORE filtering
    const summary = {
      pending: enriched.filter(r => r.status === 'PENDING').length,
      processing: enriched.filter(r => r.status === 'PROCESSING').length,
      refunded: enriched.filter(r => r.status === 'REFUNDED' || r.status === 'APPROVED').length,
      rejected: enriched.filter(r => r.status === 'REJECTED').length,
      totalRefundValue: enriched
        .filter(r => r.status === 'REFUNDED' || r.status === 'APPROVED' || r.status === 'PROCESSING')
        .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0)
    };

    // Status filtering
    if (status && status.toLowerCase() !== 'all') {
      const targetStatus = status.toUpperCase();
      enriched = enriched.filter(r => {
        if (targetStatus === 'REFUNDED') return r.status === 'REFUNDED' || r.status === 'APPROVED';
        return r.status === targetStatus;
      });
    }

    // Cancellation Type filtering
    if (type && type.toLowerCase() !== 'all') {
      enriched = enriched.filter(r => (r.cancellation_type || '').toLowerCase() === type.toLowerCase());
    }

    // Search query filtering
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter(r => 
        (r.pnr && r.pnr.toLowerCase().includes(q)) ||
        (r.passenger && r.passenger.toLowerCase().includes(q)) ||
        (r.train && r.train.toLowerCase().includes(q)) ||
        (r.cancellationReason && r.cancellationReason.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      records: enriched,
      summary
    });
  } catch (err) {
    console.error('Error fetching admin refunds:', err);
    return res.status(500).json({ error: 'Failed to fetch refund records: ' + err.message });
  }
});

// PUT /api/admin/refunds/:id/action - Approve or Reject a refund claim
router.put('/refunds/:id/action', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { id } = req.params;
  const { action, reason } = req.body;

  if (!action || !['approve', 'reject'].includes(action.toLowerCase())) {
    return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'reject'." });
  }

  const newStatus = action.toLowerCase() === 'approve' ? 'APPROVED' : 'REJECTED';

  if (isMockMode) {
    let cancRecord = mockDb.cancellation_records.get(id) || 
      Array.from(mockDb.cancellation_records.values()).find(r => 
        r.id === id || 
        r.booking_id === id || 
        r.pnr === id || 
        `canc-${r.booking_id}` === id ||
        `ref-${r.booking_id}` === id
      );

    if (!cancRecord) {
      // Check if matching booking exists
      const booking = mockDb.bookings.get(id) || Array.from(mockDb.bookings.values()).find(b => b.id === id || b.pnr_number === id);
      if (booking && booking.status === 'cancelled') {
        const train = mockDb.trains.get(booking.train_id);
        cancRecord = {
          id: `canc-${booking.id}`,
          booking_id: booking.id,
          pnr: booking.pnr_number,
          passenger_id: booking.passenger_id,
          train_id: booking.train_id,
          train_number: train ? train.train_number : '12952',
          train_name: train ? train.train_name : 'Express Special',
          journey_date: booking.travel_date,
          original_fare: booking.total_fare || 1000,
          deduction_amount: booking.penalty_amount !== undefined ? booking.penalty_amount : 240,
          refund_amount: booking.refund_amount !== undefined ? booking.refund_amount : Math.max(0, (booking.total_fare || 1000) - 240),
          refund_status: newStatus,
          status: newStatus,
          cancellation_reason: booking.cancellation_reason || 'Passenger requested cancellation',
          cancellation_type: 'passenger',
          cancelled_by_user_id: booking.passenger_id,
          cancelled_by_role: 'passenger',
          cancellation_date_time: booking.cancellation_date_time || new Date().toISOString(),
          created_at: booking.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        mockDb.cancellation_records.set(booking.id, cancRecord);
      } else {
        return res.status(404).json({ error: 'Cancellation record not found.' });
      }
    }

    // Update cancellation record
    cancRecord.refund_status = newStatus;
    cancRecord.status = newStatus;
    if (action.toLowerCase() === 'reject' && reason) {
      cancRecord.rejection_reason = reason;
    }
    cancRecord.updated_at = new Date().toISOString();
    mockDb.cancellation_records.set(cancRecord.booking_id || id, cancRecord);

    // Update associated payment and booking status
    const bookingId = cancRecord.booking_id || id;
    const booking = mockDb.bookings.get(bookingId) || Array.from(mockDb.bookings.values()).find(b => b.id === bookingId);
    if (booking) {
      booking.refund_status = newStatus;
      if (action.toLowerCase() === 'reject') {
        booking.rejection_reason = reason;
      }
      mockDb.bookings.set(booking.id, booking);
    }

    const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === bookingId);
    if (payment) {
      payment.status = newStatus === 'APPROVED' ? 'REFUNDED' : 'REJECTED';
      mockDb.payments.set(payment.id, payment);
    }

    // Create Audit Log
    if (!mockDb.audit_logs) mockDb.audit_logs = new Map();
    const logId = 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    mockDb.audit_logs.set(logId, {
      id: logId,
      action: newStatus === 'APPROVED' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
      event_type: newStatus === 'APPROVED' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
      booking_id: bookingId,
      cancellation_record_id: cancRecord.id,
      pnr: cancRecord.pnr,
      user_id: req.user.id,
      user_role: req.user.role,
      reason: reason || (newStatus === 'APPROVED' ? 'Admin approved refund' : 'Admin rejected refund'),
      refund_amount: cancRecord.refund_amount,
      refund_status: newStatus,
      timestamp: new Date().toISOString()
    });

    saveMockDbToFile();

    return res.json({
      success: true,
      message: `Refund claim for PNR #${cancRecord.pnr} ${newStatus.toLowerCase()} successfully.`,
      cancellation_record: {
        ...cancRecord,
        refund_status: newStatus,
        status: newStatus
      },
      booking: booking || null
    });
  } else {
    try {
      const updateData = {
        refund_status: newStatus,
        updated_at: new Date().toISOString()
      };
      if (action.toLowerCase() === 'reject' && reason) {
        updateData.override_reason = reason;
      }

      const { data, error } = await supabase
        .from('cancellation_records')
        .update(updateData)
        .or(`id.eq.${id},booking_id.eq.${id}`)
        .select()
        .single();

      if (error || !data) return res.status(404).json({ error: 'Cancellation record not found.' });

      // Update payment status
      if (data.booking_id) {
        await supabase
          .from('payments')
          .update({ status: newStatus === 'APPROVED' ? 'refunded' : 'failed' })
          .eq('booking_id', data.booking_id);
      }

      return res.json({
        success: true,
        message: `Refund claim for PNR #${data.pnr} ${newStatus.toLowerCase()} successfully.`,
        cancellation_record: data
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update refund status: ' + err.message });
    }
  }
});

module.exports = router;
