const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase, saveMockDbToFile, resolvePassengerNameForBooking } = require('../config/supabase');
const { authenticateToken, requireRoles, requirePermission } = require('../middleware/auth');
const { extractStationCode, normalizeDateStr, formatDateFriendly } = require('../utils/routeSearch');
const { normalizeClassList, getDefaultClassesForTrain } = require('../utils/trainClasses');
const { parseAndValidateFoodConfig } = require('../utils/trainFood');

const ensure24HourTime = (timeStr) => {
  if (!timeStr) return '12:00:00';
  const cleanStr = String(timeStr).trim();
  if (cleanStr.toUpperCase().includes('AM') || cleanStr.toUpperCase().includes('PM')) {
    const parts = cleanStr.split(/\s+/);
    const timePart = parts[0];
    const ampm = parts[1] ? parts[1].toUpperCase() : 'AM';
    let [hours, minutes] = timePart.split(':');
    let h = parseInt(hours, 10);
    if (h === 12) h = 0;
    if (ampm === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${minutes || '00'}:00`;
  }
  if (cleanStr.length === 5) return `${cleanStr}:00`;
  return cleanStr;
};

// ==========================================
// 1. STAFF PROFILE & DASHBOARD
// ==========================================

// GET /api/staff/profile - Logged in staff profile & operational statistics
router.get('/profile', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  try {
    const staffId = req.user.id;
    let staffProf = mockDb.staff_profiles.get(staffId) ||
      Array.from(mockDb.staff_profiles.values()).find(s => s.email === req.user.email || s.id === staffId);

    if (!staffProf) {
      staffProf = {
        id: staffId,
        employee_id: req.user.employee_id || 'EMP-10001',
        full_name: req.user.full_name || 'Railway Staff Officer',
        email: req.user.email || 'staff@railway.com',
        phone: req.user.phone || '+91 9876543210',
        role: 'staff',
        staff_type: 'Station Master',
        department: 'Operations',
        designation: 'Station Master',
        base_station: 'NDLS',
        status: 'ACTIVE',
        duty_status: 'ON DUTY',
        joining_date: '2023-01-15',
        created_at: new Date().toISOString()
      };
      mockDb.staff_profiles.set(staffId, staffProf);
    }

    const perms = mockDb.staff_permissions.get(staffId) || staffProf.permissions || ['ALL'];
    const duties = Array.from(mockDb.staff_duties.values()).filter(d => d.staff_id === staffId);
    const reports = Array.from(mockDb.staff_daily_reports.values()).filter(r => r.staff_id === staffId);
    const incidents = Array.from(mockDb.staff_incidents.values()).filter(i => i.reported_by === staffId);

    const stats = {
      trains_handled: duties.filter(d => d.train_id).length || 12,
      passengers_verified: 148,
      tickets_checked: 165,
      incidents_reported: incidents.length,
      delay_reports_submitted: 8,
      daily_reports_submitted: reports.length,
      catering_orders_handled: 24,
      duty_days: 42
    };

    return res.json({
      staff: { ...staffProf, permissions: perms },
      stats
    });
  } catch (err) {
    console.error('Error fetching staff profile:', err.message);
    return res.status(500).json({ error: 'Failed to fetch staff profile' });
  }
});

// GET /api/staff/dashboard - Staff Dashboard operational summary metrics
router.get('/dashboard', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('VIEW_DASHBOARD'), async (req, res) => {
  try {
    const staffId = req.user.id;
    const staffProf = mockDb.staff_profiles.get(staffId) || {};
    const baseStation = staffProf.base_station || 'NDLS';

    const activeTrains = Array.from(mockDb.trains.values());
    const delayedTrains = activeTrains.filter(t => t.status === 'delayed' || t.delay_minutes > 0);
    const bookings = Array.from(mockDb.bookings.values()).filter(b => b.status === 'confirmed');
    const cateringOrders = Array.from(mockDb.catering_orders.values());
    const incidents = Array.from(mockDb.staff_incidents.values()).filter(i => i.status !== 'RESOLVED');
    const reports = Array.from(mockDb.staff_daily_reports.values()).filter(r => r.staff_id === staffId);
    const duties = Array.from(mockDb.staff_duties.values()).filter(d => d.staff_id === staffId);
    const serviceRequests = mockDb.service_requests ? Array.from(mockDb.service_requests.values()) : [];

    const currentDuty = duties.find(d => d.duty_status === 'ON DUTY' || d.duty_status === 'SCHEDULED') || {
      id: 'dt-default',
      shift: 'Morning (06:00 - 14:00)',
      train_number: '12951',
      train_name: 'Mumbai Rajdhani Express',
      station_code: baseStation,
      duty_status: staffProf.duty_status || 'ON DUTY',
      notes: 'Platform 3 passenger verification and delay reporting duty.'
    };

    const staffTasks = Array.from(mockDb.staff_tasks ? mockDb.staff_tasks.values() : []).filter(
      t => t.staff_id === staffId || req.user.role === 'admin'
    );
    const activeTasksCount = staffTasks.filter(t => t.status !== 'Completed').length;

    return res.json({
      todays_duty: currentDuty,
      assigned_train: currentDuty.train_name || '12951 - Rajdhani Express',
      current_station: baseStation,
      assigned_tasks_count: activeTasksCount,
      active_bookings_count: bookings.length || 0,
      todays_verifications: 14,
      assigned_trains_count: activeTrains.length || 1,
      pending_service_requests: serviceRequests.filter(s => s.status === 'Pending').length,
      pending_reports: reports.filter(r => r.status === 'SUBMITTED' || r.status === 'DRAFT').length,
      catering_orders: cateringOrders.length,
      total_trains: activeTrains.length,
      active_incidents: incidents.length,
      delayed_trains: delayedTrains.length
    });
  } catch (err) {
    console.error('Error fetching staff dashboard:', err.message);
    return res.status(500).json({ error: 'Failed to fetch staff dashboard summary' });
  }
});

// PUT /api/staff/duty-status - Staff update own duty status
router.put('/duty-status', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { duty_status } = req.body;
  const validStatuses = ['ON DUTY', 'OFF DUTY', 'ON BREAK', 'AVAILABLE'];
  if (!duty_status || !validStatuses.includes(duty_status.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid duty status. Must be ON DUTY, OFF DUTY, ON BREAK, or AVAILABLE' });
  }

  const staffId = req.user.id;
  let staffProf = mockDb.staff_profiles.get(staffId);
  if (!staffProf) {
    staffProf = { id: staffId, email: req.user.email, full_name: req.user.full_name, role: 'staff' };
  }

  const oldStatus = staffProf.duty_status || 'OFF DUTY';
  staffProf.duty_status = duty_status.toUpperCase();
  staffProf.last_active = new Date().toISOString();
  mockDb.staff_profiles.set(staffId, staffProf);

  // Log audit
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: staffId,
    actor_id: staffId,
    action: 'DUTY_STATUS_CHANGE',
    entity_type: 'staff_profile',
    entity_id: staffId,
    old_value: oldStatus,
    new_value: duty_status.toUpperCase(),
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();
  return res.json({ message: 'Duty status updated successfully', duty_status: staffProf.duty_status });
});

// ==========================================
// 2. TRAIN OPERATIONS & STATUS
// ==========================================

// ==========================================
// 2. TRAIN OPERATIONS & STATUS
// ==========================================

// GET /api/staff/trains - Staff assigned / managed trains
router.get('/trains', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { getTrainOperationalAndBookingStatus } = require('../services/journeyAvailabilityService');
  const targetDate = req.query.date || null;
  const isUpcomingOnly = req.query.filter === 'upcoming' || req.query.status === 'upcoming' || req.query.view === 'upcoming';

  const trains = Array.from(mockDb.trains.values());
  const routes = Array.from(mockDb.routes.values());

  let enriched = trains.filter(Boolean).map(t => {
    const route = routes.find(r => r && (r.train_id === t.id || String(r.train_number) === String(t.train_number) || r.route_code === t.train_number || r.id === t.route_id)) || {};
    const statusHist = Array.from(mockDb.train_status_history ? mockDb.train_status_history.values() : [])
      .filter(h => h.train_id === t.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const safeSource = t.source_station_code || route.source_station_code || (t.source && t.source.toUpperCase() !== 'ADMIN' ? extractStationCode(t.source) : '');
    const safeDest = t.destination_station_code || route.destination_station_code || (t.destination && t.destination.toUpperCase() !== 'ADMIN' ? extractStationCode(t.destination) : '');

    const routeStops = (Array.isArray(t.stops) && t.stops.length > 0) ? t.stops : ((route && Array.isArray(route.stops) && route.stops.length > 0) ? route.stops : []);

    const trainClasses = (Array.isArray(t.available_classes) && t.available_classes.length > 0)
      ? normalizeClassList(t.available_classes)
      : getDefaultClassesForTrain(t.train_name, t.train_type || t.trainType);

    const statusInfo = getTrainOperationalAndBookingStatus({
      train: t,
      route,
      date: targetDate
    });

    return {
      ...t,
      source: safeSource,
      destination: safeDest,
      source_station_code: safeSource,
      destination_station_code: safeDest,
      departure_time: statusInfo.departureTime || route.departure_time || t.departure_time || '06:00',
      arrival_time: statusInfo.arrivalTime || route.arrival_time || t.arrival_time || '14:30',
      departure_date: statusInfo.departureDate,
      arrival_date: statusInfo.arrivalDate,
      departure_date_formatted: statusInfo.departureDateFormatted,
      arrival_date_formatted: statusInfo.arrivalDateFormatted,
      date_route_label: statusInfo.dateRouteLabel,
      duration_formatted: statusInfo.durationFormatted,
      status: statusInfo.status,
      operational_status: statusInfo.operationalStatus,
      booking_status: statusInfo.bookingStatus,
      is_upcoming: statusInfo.isUpcoming,
      is_departed: statusInfo.isDeparted,
      is_completed: statusInfo.isCompleted,
      frequency: t.frequency || t.running_days || route.frequency || 'Daily',
      running_days: t.running_days || t.frequency || route.frequency || 'Daily',
      available_classes: trainClasses,
      description: t.description || null,
      train_type: t.train_type || 'Superfast',
      delay_minutes: t.delay_minutes || 0,
      delay_reason: t.delay_reason || t.status_reason || null,
      updated_at: t.updated_at || t.updatedAt || new Date().toISOString(),
      updated_by_name: t.updated_by_name || 'Staff Operations',
      stops: routeStops,
      route: {
        ...route,
        source_station_code: safeSource,
        destination_station_code: safeDest,
        stops: routeStops
      },
      latest_update: statusHist[0] || null
    };
  });

  if (isUpcomingOnly) {
    enriched = enriched.filter(t => t.is_upcoming);
  }

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'VIEWED_TRAINS',
    timestamp: new Date().toISOString()
  });

  return res.json(enriched);
});

// GET /api/staff/trains/:id - Get details of a single train
router.get('/trains/:id', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { id } = req.params;
  let train = mockDb.trains.get(id) || Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
  if (!train) {
    return res.status(404).json({ error: 'Train record not found in system database' });
  }

  const route = Array.from(mockDb.routes.values()).find(r => r.train_id === train.id) || {};
  const trainClasses = (Array.isArray(train.available_classes) && train.available_classes.length > 0)
    ? normalizeClassList(train.available_classes)
    : getDefaultClassesForTrain(train.train_name, train.train_type || train.trainType);

  return res.json({
    ...train,
    source: train.source_station_code || route.source_station_code || train.source || 'NDLS',
    destination: train.destination_station_code || route.destination_station_code || train.destination || 'MMCT',
    departure_time: route.departure_time || train.departure_time || '06:00',
    arrival_time: route.arrival_time || train.arrival_time || '14:30',
    frequency: train.frequency || train.running_days || route.frequency || 'Daily',
    available_classes: trainClasses,
    description: train.description || null,
    route
  });
});

// POST /api/staff/trains/schedule - Add new train schedule (Train master + timetable)
router.post('/trains/schedule', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), (req, res) => {
  const {
    train_number,
    train_name,
    train_type,
    source,
    destination,
    departure_time,
    arrival_time,
    frequency,
    running_days,
    description,
    stops
  } = req.body;

  if (!train_number || !String(train_number).trim()) {
    return res.status(400).json({ error: 'Train number is required' });
  }
  if (!train_name || !String(train_name).trim()) {
    return res.status(400).json({ error: 'Train name is required' });
  }
  if (!source || !destination) {
    return res.status(400).json({ error: 'Source and destination stations are required' });
  }

  const { extractStationCode } = require('../utils/routeSearch');
  const srcCode = extractStationCode(source);
  const destCode = extractStationCode(destination);

  if (!srcCode || !destCode || srcCode.toUpperCase() === 'ADMIN' || destCode.toUpperCase() === 'ADMIN') {
    return res.status(400).json({ error: 'Invalid source or destination station code. ADMIN cannot be used as a station.' });
  }

  if (srcCode === destCode) {
    return res.status(400).json({ error: 'Source and destination stations cannot be the same' });
  }

  const rawClasses = req.body.available_classes || req.body.availableClasses || req.body.classes;
  let available_classes = [];
  if (rawClasses !== undefined) {
    available_classes = normalizeClassList(rawClasses);
    if (available_classes.length === 0) {
      return res.status(400).json({ error: 'At least one travel class must be selected for the train.' });
    }
  } else {
    available_classes = getDefaultClassesForTrain(train_name, train_type || req.body.trainType);
  }

  const cleanTrainNo = String(train_number).trim();

  // Validate train_number uniqueness
  const duplicate = Array.from(mockDb.trains.values()).find(
    t => t && t.train_number && String(t.train_number).trim() === cleanTrainNo
  );
  if (duplicate) {
    return res.status(400).json({ error: `Train number ${cleanTrainNo} already exists in database. Update schedule instead.` });
  }

  const nowIso = new Date().toISOString();
  const trainId = 't-' + Math.random().toString(36).substr(2, 9);
  const routeId = 'r-' + Math.random().toString(36).substr(2, 9);

  const is_date_specific = req.body.is_date_specific === true || req.body.is_date_specific === 'true' || Boolean(req.body.journey_date || req.body.journeyDate);
  const rawJourneyDate = req.body.journey_date || req.body.journeyDate;
  let journey_date = null;
  if (is_date_specific) {
    const candidateDate = rawJourneyDate || req.body.service_start_date || req.body.startDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    journey_date = normalizeDateStr(candidateDate);
    if (!journey_date || !/^\d{4}-\d{2}-\d{2}$/.test(journey_date)) {
      return res.status(400).json({ error: 'Valid Journey Date (YYYY-MM-DD) is required for date-specific train.' });
    }
  }

  const freqValue = is_date_specific ? formatDateFriendly(journey_date) : (frequency || running_days || 'Daily');

  const foodVal = parseAndValidateFoodConfig(req.body);
  if (!foodVal.valid) {
    return res.status(400).json({ error: foodVal.error });
  }

  const newTrain = {
    id: trainId,
    train_number: cleanTrainNo,
    train_name: String(train_name).trim(),
    train_type: train_type || 'Superfast',
    source_station_code: String(source).trim().toUpperCase(),
    destination_station_code: String(destination).trim().toUpperCase(),
    source: String(source).trim().toUpperCase(),
    destination: String(destination).trim().toUpperCase(),
    available_classes,
    food_available: foodVal.config.food_available,
    catering_payment_mode: foodVal.config.catering_payment_mode,
    food_type: foodVal.config.food_type,
    vegetarian_food_price: foodVal.config.vegetarian_food_price,
    non_vegetarian_food_price: foodVal.config.non_vegetarian_food_price,
    class_catering: foodVal.config.class_catering,
    frequency: freqValue,
    running_days: freqValue,
    is_date_specific: Boolean(is_date_specific),
    journey_date: journey_date || null,
    service_start_date: is_date_specific ? journey_date : (req.body.service_start_date || null),
    service_end_date: is_date_specific ? journey_date : (req.body.service_end_date || null),
    specific_service_dates: is_date_specific ? [journey_date] : [],
    frequency_type: is_date_specific ? 'Specific Dates' : (req.body.frequency_type || 'Daily'),
    run_date: req.body.run_date || req.body.start_date || (is_date_specific ? journey_date : null),
    start_date: req.body.start_date || req.body.run_date || (is_date_specific ? journey_date : null),
    reached_date: req.body.reached_date || req.body.arrival_date || (is_date_specific ? journey_date : null),
    arrival_date: req.body.arrival_date || req.body.reached_date || (is_date_specific ? journey_date : null),
    description: description && String(description).trim() ? String(description).trim() : null,
    status: req.body.status || 'on_time',
    delay_minutes: req.body.delay_minutes !== undefined ? parseInt(req.body.delay_minutes) : 0,
    created_by: req.user.id,
    updated_by_id: req.user.id,
    updated_by_name: req.user.full_name || 'Staff Officer',
    created_at: nowIso,
    updated_at: nowIso,
    record_source: req.body.record_source || (process.env.NODE_ENV === 'test' ? 'test' : 'staff'),
    route_id: routeId,
    stops: (Array.isArray(stops) ? stops : []).map(s => {
      const stCode = extractStationCode(s.stationCode || s.station || s.code);
      const arr = ensure24HourTime(s.arrTime || s.arrival_time);
      const dep = ensure24HourTime(s.depTime || s.departure_time);
      return {
        ...s,
        stationCode: stCode,
        station: stCode,
        arrTime: arr.slice(0, 5),
        arrival_time: arr,
        depTime: dep.slice(0, 5),
        departure_time: dep
      };
    })
  };

  const newRoute = {
    id: routeId,
    train_id: trainId,
    train_number: cleanTrainNo,
    source_station_code: String(source).trim().toUpperCase(),
    destination_station_code: String(destination).trim().toUpperCase(),
    departure_time: departure_time || '06:00:00',
    arrival_time: arrival_time || '14:30:00',
    distance_km: parseFloat(req.body.distance_km || '500'),
    fare_multiplier: 1.2,
    is_date_specific: Boolean(is_date_specific),
    journey_date: journey_date || null,
    service_start_date: is_date_specific ? journey_date : (req.body.service_start_date || null),
    service_end_date: is_date_specific ? journey_date : (req.body.service_end_date || null),
    specific_service_dates: is_date_specific ? [journey_date] : [],
    frequency_type: is_date_specific ? 'Specific Dates' : (req.body.frequency_type || 'Daily'),
    frequency: freqValue,
    stops: newTrain.stops
  };

  mockDb.trains.set(trainId, newTrain);
  mockDb.routes.set(routeId, newRoute);

  // Seed mock seats for all available classes of the new train
  if (mockDb.seats) {
    const coachPrefixMap = {
      '1A': 'H', '2A': 'A', '3A': 'B', '3E': 'M', 'EC': 'E', 'CC': 'C', 'SL': 'S', '2S': 'D', 'GEN': 'GS'
    };
    const seatClasses = (Array.isArray(available_classes) && available_classes.length > 0)
      ? available_classes
      : ['SL', '3A', '2A', '1A'];

    seatClasses.forEach(cls => {
      const pfx = coachPrefixMap[cls] || 'C';
      const coachNum = `${pfx}1`;
      for (let i = 1; i <= 24; i++) {
        const berthType = i % 6 === 1 || i % 6 === 2 ? 'LB' : i % 6 === 3 || i % 6 === 4 ? 'MB' : 'UB';
        const sId = `${newTrain.id}-${coachNum}-${i}`;
        mockDb.seats.set(sId, {
          id: sId,
          train_id: newTrain.id,
          coach_class: cls,
          coach_number: coachNum,
          seat_number: i,
          berth_type: berthType
        });
      }
    });
  }

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'CREATED_TRAIN_SCHEDULE',
    train_id: trainId,
    train_number: cleanTrainNo,
    timestamp: nowIso
  });

  saveMockDbToFile();

  return res.status(201).json({
    message: `Train schedule #${cleanTrainNo} created successfully`,
    train: { ...newTrain, departure_time: newRoute.departure_time, arrival_time: newRoute.arrival_time, route: newRoute }
  });
});

// PATCH & PUT /api/staff/trains/:id/schedule & /api/staff/trains/:id - Edit existing train schedule
const handleUpdateTrainSchedule = (req, res) => {
  const { id } = req.params;
  let train = mockDb.trains.get(id) || Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
  if (!train) {
    return res.status(404).json({ error: 'Train record not found in system database' });
  }

  const {
    train_number,
    train_name,
    train_type,
    source,
    destination,
    departure_time,
    arrival_time,
    frequency,
    running_days,
    description,
    stops
  } = req.body;

  const rawClasses = req.body.available_classes || req.body.availableClasses || req.body.classes;
  if (rawClasses !== undefined) {
    const parsed = normalizeClassList(rawClasses);
    if (parsed.length === 0) {
      return res.status(400).json({ error: 'At least one travel class must be selected for the train.' });
    }
    train.available_classes = parsed;
  }

  // Validate duplicate train_number if changing
  if (train_number && String(train_number).trim() !== train.train_number) {
    const cleanTrainNo = String(train_number).trim();
    const dup = Array.from(mockDb.trains.values()).find(
      t => t.id !== train.id && String(t.train_number).trim() === cleanTrainNo
    );
    if (dup) {
      return res.status(400).json({ error: `Train number ${cleanTrainNo} is already assigned to another train.` });
    }
    train.train_number = cleanTrainNo;
  }

  const nowIso = new Date().toISOString();
  if (train_name !== undefined) train.train_name = String(train_name).trim();
  if (train_type !== undefined) train.train_type = String(train_type).trim();
  if (source !== undefined) {
    train.source_station_code = String(source).trim().toUpperCase();
    train.source = String(source).trim().toUpperCase();
  }
  if (destination !== undefined) {
    train.destination_station_code = String(destination).trim().toUpperCase();
    train.destination = String(destination).trim().toUpperCase();
  }
  if (frequency !== undefined || running_days !== undefined) {
    const freqVal = frequency || running_days;
    train.frequency = freqVal;
    train.running_days = freqVal;
  }
  if (req.body.run_date !== undefined || req.body.start_date !== undefined) {
    train.run_date = req.body.run_date || req.body.start_date || null;
    train.start_date = req.body.start_date || req.body.run_date || null;
  }
  if (req.body.reached_date !== undefined || req.body.arrival_date !== undefined) {
    train.reached_date = req.body.reached_date || req.body.arrival_date || null;
    train.arrival_date = req.body.arrival_date || req.body.reached_date || null;
  }
  if (description !== undefined) {
    train.description = description && String(description).trim() ? String(description).trim() : null;
  }
  if (req.body.status !== undefined) {
    train.status = req.body.status;
  }

  const foodVal = parseAndValidateFoodConfig(req.body, true, train);
  if (!foodVal.valid) {
    return res.status(400).json({ error: foodVal.error });
  }

  train.food_available = foodVal.config.food_available;
  train.catering_payment_mode = foodVal.config.catering_payment_mode;
  train.food_type = foodVal.config.food_type;
  train.vegetarian_food_price = foodVal.config.vegetarian_food_price;
  train.non_vegetarian_food_price = foodVal.config.non_vegetarian_food_price;
  train.class_catering = foodVal.config.class_catering;

  train.updated_at = nowIso;
  train.updated_by_id = req.user.id;
  train.updated_by_name = req.user.full_name || 'Staff Officer';

  const reqJourneyDate = req.body.journey_date || req.body.journeyDate;
  if (reqJourneyDate !== undefined) {
    const normJDate = normalizeDateStr(reqJourneyDate);
    if (!normJDate || !/^\d{4}-\d{2}-\d{2}$/.test(normJDate)) {
      return res.status(400).json({ error: 'Valid Journey Date (YYYY-MM-DD) is required.' });
    }
    train.journey_date = normJDate;
    train.service_start_date = normJDate;
    train.service_end_date = normJDate;
    train.specific_service_dates = [normJDate];
    train.operating_days = [];
    train.frequency_type = 'Specific Dates';
    train.frequency = formatDateFriendly(normJDate);
    train.running_days = formatDateFriendly(normJDate);
    train.is_date_specific = true;
  }

  mockDb.trains.set(train.id, train);

  // Update associated route
  let route = Array.from(mockDb.routes.values()).find(r => r && r.train_id === train.id);
  if (!route) {
    route = {
      id: 'r-' + Math.random().toString(36).substr(2, 9),
      train_id: train.id
    };
  }

  if (reqJourneyDate !== undefined) {
    const normJDate = normalizeDateStr(reqJourneyDate);
    route.journey_date = normJDate;
    route.service_start_date = normJDate;
    route.service_end_date = normJDate;
    route.specific_service_dates = [normJDate];
    route.operating_days = [];
    route.frequency_type = 'Specific Dates';
    route.frequency = formatDateFriendly(normJDate);
    route.is_date_specific = true;

    if (mockDb.train_services) {
      for (const [sKey, sVal] of mockDb.train_services.entries()) {
        if (sVal && (sVal.train_id === train.id || String(sVal.train_number) === String(train.train_number))) {
          if (sVal.service_date !== normJDate) {
            mockDb.train_services.delete(sKey);
          }
        }
      }
    }
  }

  if (source !== undefined) route.source_station_code = train.source_station_code;
  if (destination !== undefined) route.destination_station_code = train.destination_station_code;
  if (departure_time !== undefined) route.departure_time = departure_time;
  if (arrival_time !== undefined) route.arrival_time = arrival_time;
  if (frequency !== undefined || running_days !== undefined) route.frequency = train.frequency;
  if (stops !== undefined && Array.isArray(stops)) {
    route.stops = stops.map(s => {
      const stCode = extractStationCode(s.stationCode || s.station || s.code);
      const arr = ensure24HourTime(s.arrTime || s.arrival_time);
      const dep = ensure24HourTime(s.depTime || s.departure_time);
      return {
        ...s,
        stationCode: stCode,
        station: stCode,
        arrTime: arr.slice(0, 5),
        arrival_time: arr,
        depTime: dep.slice(0, 5),
        departure_time: dep
      };
    });
    train.stops = route.stops;
  }

  route.train_number = train.train_number;
  train.route_id = route.id;
  mockDb.trains.set(train.id, train);
  mockDb.routes.set(route.id, route);

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'UPDATED_TRAIN_SCHEDULE',
    train_id: train.id,
    timestamp: nowIso
  });

  saveMockDbToFile();

  return res.json({
    message: `Train schedule #${train.train_number} updated successfully`,
    train: { ...train, departure_time: route.departure_time, arrival_time: route.arrival_time, route }
  });
};

router.patch('/trains/:id/schedule', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), handleUpdateTrainSchedule);
router.put('/trains/:id/schedule', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), handleUpdateTrainSchedule);
router.patch('/trains/:id', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), handleUpdateTrainSchedule);
router.put('/trains/:id', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), handleUpdateTrainSchedule);

// PATCH /api/staff/trains/:id/status - Update train website operational status
router.patch('/trains/:id/status', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['UPDATE_AUTHORIZED_TRAIN_STATUS', 'VIEW_TRAIN_STATUS']), (req, res) => {
  const { id } = req.params;
  let train = mockDb.trains.get(id) || Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
  if (!train) {
    return res.status(404).json({ error: 'Train record not found in system database' });
  }

  const { status, delay_minutes, status_reason, delay_reason, operational_note } = req.body;

  const validStatuses = ['ON TIME', 'DELAYED', 'CANCELLED', 'RESCHEDULED', 'ARRIVED', 'DEPARTED', 'COMPLETED', 'on_time', 'delayed', 'cancelled', 'rescheduled'];
  if (status && !validStatuses.includes(status.toUpperCase()) && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be ON TIME, DELAYED, CANCELLED, RESCHEDULED, ARRIVED, DEPARTED, or COMPLETED' });
  }

  const nowIso = new Date().toISOString();
  const prevStatus = train.status;

  if (status !== undefined) {
    train.status = String(status).toLowerCase() === 'on time' ? 'on_time' : String(status).toLowerCase();
  }
  if (delay_minutes !== undefined) {
    train.delay_minutes = Math.max(0, parseInt(delay_minutes, 10) || 0);
  }

  const reasonVal = status_reason || delay_reason || operational_note || 'Authorized website operational status update';
  train.delay_reason = reasonVal;
  train.status_reason = reasonVal;
  train.operational_note = operational_note || null;
  train.updated_at = nowIso;
  train.updated_by_id = req.user.id;
  train.updated_by_name = req.user.full_name || 'Staff Officer';

  mockDb.trains.set(train.id, train);

  // Log in status history
  if (!mockDb.train_status_history) mockDb.train_status_history = new Map();
  const histId = 'hist-' + Date.now();
  mockDb.train_status_history.set(histId, {
    id: histId,
    train_id: train.id,
    train_number: train.train_number,
    previous_status: prevStatus,
    new_status: train.status,
    delay_minutes: train.delay_minutes,
    reason: reasonVal,
    updated_by: req.user.id,
    updated_by_name: req.user.full_name || 'Staff Officer',
    timestamp: nowIso
  });

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'UPDATED_TRAIN_STATUS',
    train_id: train.id,
    new_status: train.status,
    delay_minutes: train.delay_minutes,
    timestamp: nowIso
  });

  saveMockDbToFile();

  return res.json({
    message: `Operational status updated for train #${train.train_number}`,
    train
  });
});

// DELETE /api/staff/trains/:id - Block staff from deleting trains (Admin-only capability)
router.delete('/trains/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  return res.status(403).json({ error: 'Access denied. Staff members are not authorized to delete train records.' });
});

// ==========================================
// 3. PASSENGER MANIFEST & TICKET VERIFICATION
// ==========================================

// GET /api/staff/manifest/:trainId - Train Passenger Manifest
router.get('/manifest/:trainId', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['VIEW_MANIFEST', 'VIEW_PASSENGER_MANIFEST']), (req, res) => {
  const { trainId } = req.params;
  const { date, coach, class: coachClass, status, station, search } = req.query;

  // Filter bookings for the train or all trains
  let trainBookings = Array.from(mockDb.bookings.values()).filter(b => {
    if (!b || !b.pnr_number) return false;
    const bStatus = String(b.status || '').toLowerCase();
    if (bStatus === 'deleted' || bStatus === 'dummy') return false;

    // Train ID match
    if (trainId && trainId !== 'all') {
      const matchId = b.train_id === trainId || String(b.train_number) === String(trainId);
      if (!matchId) return false;
    }

    // Journey Date match
    if (date && b.travel_date && b.travel_date !== date) {
      return false;
    }

    return true;
  });

  const manifest = [];
  trainBookings.forEach(b => {
    const isCancelled = String(b.status || '').toLowerCase().includes('cancel');
    let allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a && a.booking_id === b.id);
    
    // Auto-allocate realistic seat if missing for non-cancelled booking
    if (allocations.length === 0 && !isCancelled) {
      const pName = resolvePassengerNameForBooking(b.id, b.passenger_id, b.passenger_name);
      const newAlloc = {
        id: `alloc-${b.id}-1`,
        booking_id: b.id,
        passenger_id: b.passenger_id || 'usr-1',
        passenger_name: pName,
        passenger_age: b.passenger_age || 30,
        passenger_gender: b.passenger_gender || 'Male',
        coach_number: b.coach_number && b.coach_number !== 'Unassigned' ? b.coach_number : 'B1',
        seat_number: b.seat_number && b.seat_number !== '-' ? b.seat_number : 12,
        berth_type: b.berth_type && b.berth_type !== 'Unallocated' ? b.berth_type : 'SL',
        checked_in: false,
        boarding_status: 'PENDING',
        allocated_at: new Date().toISOString()
      };
      mockDb.seat_allocations.set(newAlloc.id, newAlloc);
      allocations = [newAlloc];
    }

    const train = mockDb.trains.get(b.train_id) || Array.from(mockDb.trains.values()).find(t => t.train_number === b.train_number) || {
      train_number: b.train_number || '12952',
      train_name: b.train_name || 'Express Special',
      source_station_code: b.source || b.source_station || 'NDLS',
      destination_station_code: b.destination || b.destination_station || 'MMCT'
    };

    if (allocations.length === 0) {
      // Unallocated (e.g. waitlist or cancelled before allocation)
      const pName = resolvePassengerNameForBooking(b.id, b.passenger_id, b.passenger_name);
      const paxProfile = b.passenger_id ? mockDb.profiles.get(b.passenger_id) : null;
      manifest.push({
        booking_id: b.id,
        pnr: b.pnr_number,
        passenger_name: pName,
        email: b.user_email || b.passenger_email || paxProfile?.email || `${pName.toLowerCase().replace(/\s+/g, '.')}@railway.com`,
        phone: b.user_phone || b.passenger_phone || paxProfile?.phone || '+91 9876543210',
        age: b.passenger_age || 30,
        gender: b.passenger_gender || 'Male',
        train_id: b.train_id,
        train_number: train.train_number,
        train_name: train.train_name,
        travel_date: b.travel_date,
        coach: b.coach_number || 'WL',
        seat_number: b.seat_number || '-',
        berth_type: b.berth_type || 'WL',
        coach_class: b.coach_class || '3A',
        boarding_station: b.source_station || b.source || train.source_station_code || 'NDLS',
        destination_station: b.destination_station || b.destination || train.destination_station_code || 'MMCT',
        ticket_status: (b.status || 'WL').toUpperCase(),
        verification_status: isCancelled ? 'CANCELLED' : (b.boarding_status || 'PENDING'),
        checked_in: false,
        checked_at: null,
        checked_by_staff_id: null
      });
      return;
    }

    allocations.forEach(alloc => {
      const pName = resolvePassengerNameForBooking(b.id, alloc.passenger_id || b.passenger_id, alloc.passenger_name || b.passenger_name);
      const paxProfile = b.passenger_id ? mockDb.profiles.get(b.passenger_id) : null;

      let vStatus = 'PENDING';
      if (isCancelled) {
        vStatus = 'CANCELLED';
      } else if (alloc.boarding_status === 'NO_SHOW' || b.boarding_status === 'NO_SHOW' || alloc.checked_in === 'no_show') {
        vStatus = 'NO_SHOW';
      } else if (alloc.checked_in === true || alloc.boarding_status === 'VERIFIED' || b.boarding_status === 'VERIFIED') {
        vStatus = 'VERIFIED';
      }

      manifest.push({
        booking_id: b.id,
        allocation_id: alloc.id,
        pnr: b.pnr_number,
        passenger_name: pName,
        email: b.user_email || b.passenger_email || paxProfile?.email || `${pName.toLowerCase().replace(/\s+/g, '.')}@railway.com`,
        phone: b.user_phone || b.passenger_phone || paxProfile?.phone || '+91 9876543210',
        age: alloc.passenger_age || b.passenger_age || 30,
        gender: alloc.passenger_gender || b.passenger_gender || 'Male',
        train_id: b.train_id,
        train_number: train.train_number,
        train_name: train.train_name,
        travel_date: b.travel_date,
        coach: alloc.coach_number && alloc.coach_number !== 'Unassigned' ? alloc.coach_number : (b.coach_number || 'B1'),
        seat_number: alloc.seat_number && alloc.seat_number !== '-' ? alloc.seat_number : (b.seat_number || 12),
        berth_type: alloc.berth_type && alloc.berth_type !== 'Unallocated' ? alloc.berth_type : (b.berth_type || 'LB'),
        coach_class: b.coach_class || alloc.coach_class || '3A',
        boarding_station: b.source_station || b.source || train.source_station_code || 'NDLS',
        destination_station: b.destination_station || b.destination || train.destination_station_code || 'MMCT',
        ticket_status: (b.status || 'CNF').toUpperCase(),
        verification_status: vStatus,
        checked_in: alloc.checked_in === true || vStatus === 'VERIFIED',
        checked_at: alloc.checked_at || null,
        checked_by_staff_id: alloc.checked_by_staff_id || null
      });
    });
  });

  // Apply query filters
  let filtered = manifest;

  if (coach && coach !== 'ALL') {
    filtered = filtered.filter(m => String(m.coach).toUpperCase() === String(coach).toUpperCase());
  }

  if (coachClass && coachClass !== 'ALL') {
    filtered = filtered.filter(m => String(m.coach_class).toUpperCase() === String(coachClass).toUpperCase());
  }

  if (status && status !== 'ALL') {
    const sUpper = status.toUpperCase();
    filtered = filtered.filter(m => {
      if (sUpper === 'VERIFIED') return m.verification_status === 'VERIFIED';
      if (sUpper === 'PENDING') return m.verification_status === 'PENDING';
      if (sUpper === 'NO_SHOW') return m.verification_status === 'NO_SHOW';
      if (sUpper === 'CANCELLED') return m.verification_status === 'CANCELLED' || m.ticket_status === 'CANCELLED';
      if (sUpper === 'RAC') return m.ticket_status === 'RAC';
      if (sUpper === 'WL') return m.ticket_status.includes('WL');
      return true;
    });
  }

  if (station && station !== 'ALL') {
    filtered = filtered.filter(m => 
      String(m.boarding_station).toUpperCase() === String(station).toUpperCase() ||
      String(m.destination_station).toUpperCase() === String(station).toUpperCase()
    );
  }

  if (search) {
    const q = String(search).trim().toLowerCase();
    filtered = filtered.filter(m => 
      (m.pnr && m.pnr.toLowerCase().includes(q)) ||
      (m.passenger_name && m.passenger_name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.phone && m.phone.toLowerCase().includes(q)) ||
      (m.coach && m.coach.toLowerCase().includes(q)) ||
      (String(m.seat_number).toLowerCase().includes(q))
    );
  }

  // Calculate summary metrics
  const summary = {
    total_passengers: manifest.length,
    verified_count: manifest.filter(m => m.verification_status === 'VERIFIED').length,
    pending_count: manifest.filter(m => m.verification_status === 'PENDING').length,
    no_show_count: manifest.filter(m => m.verification_status === 'NO_SHOW').length,
    rac_count: manifest.filter(m => m.ticket_status === 'RAC').length,
    wl_count: manifest.filter(m => m.ticket_status.includes('WL')).length,
    cancelled_count: manifest.filter(m => m.verification_status === 'CANCELLED' || m.ticket_status === 'CANCELLED').length
  };

  // Audit log
  if (mockDb.staff_audit_logs) {
    const auditId = 'aud-' + Date.now();
    mockDb.staff_audit_logs.set(auditId, {
      id: auditId,
      staff_id: req.user.id,
      action: 'VIEWED_MANIFEST',
      train_id: trainId,
      timestamp: new Date().toISOString()
    });
  }

  return res.json({
    train_id: trainId,
    count: filtered.length,
    summary,
    manifest: filtered,
    data_source: {
      mode: 'PROJECT DATABASE / DEMO DATA',
      live_prs_status: 'IRCTC / PRS LIVE: NOT CONNECTED (Internal Project Engine)'
    }
  });
});

// GET /api/staff/bookings - Staff view passenger bookings with filters & RBAC
router.get('/bookings', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('VIEW_BOOKINGS'), (req, res) => {
  const bookingsList = Array.from(mockDb.bookings.values()).map(b => {
    const train = mockDb.trains.get(b.train_id);
    const route = Array.from(mockDb.routes.values()).find(r => r && r.train_id === b.train_id);
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === b.id);
    const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === b.id);
    return {
      ...b,
      train: train || (b.train_name || b.train_number ? {
        train_name: b.train_name,
        train_number: b.train_number,
        source: b.source || b.source_station_code || '',
        destination: b.destination || b.destination_station_code || ''
      } : null),
      route,
      allocations,
      payment
    };
  });

  // Audit log
  if (mockDb.staff_audit_logs) {
    const auditId = 'aud-' + Date.now();
    mockDb.staff_audit_logs.set(auditId, {
      id: auditId,
      staff_id: req.user.id,
      action: 'VIEWED_BOOKINGS',
      timestamp: new Date().toISOString()
    });
  }

  return res.json(bookingsList);
});

// GET /api/staff/passengers - Staff view passenger directory with privacy & RBAC protections
router.get('/passengers', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const allProfiles = Array.from(mockDb.profiles.values());
  const allBookings = Array.from(mockDb.bookings.values());

  // Filter passenger profiles only
  let passengers = allProfiles.filter(p => p && p.role === 'passenger');
  if (passengers.length === 0) {
    passengers = allProfiles.filter(p => p && p.role !== 'admin' && p.role !== 'staff');
  }

  const {
    search,
    status,
    registration_filter,
    booking_activity,
    from_date,
    to_date,
    sort = 'newest',
    order = 'desc',
    page = 1,
    limit = 25
  } = req.query;

  // Enrich with booking stats & sanitize sensitive fields
  let sanitized = passengers.map(p => {
    const pBookings = allBookings.filter(b => 
      b.passenger_id === p.id || 
      b.user_id === p.id || 
      (p.email && b.user_email && b.user_email.toLowerCase() === p.email.toLowerCase()) ||
      (p.email && b.passenger_email && b.passenger_email.toLowerCase() === p.email.toLowerCase())
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const hasBookings = pBookings.length > 0;
    const hasUpcoming = pBookings.some(b => b.travel_date >= todayStr && b.status !== 'cancelled');
    const hasCompleted = pBookings.some(b => b.status === 'completed' || b.travel_date < todayStr);
    const hasCancelled = pBookings.some(b => b.status === 'cancelled' || b.status === 'auto_cancelled');

    return {
      id: p.id,
      full_name: p.full_name || p.username || 'Passenger User',
      email: p.email || 'N/A',
      phone: p.phone || p.mobile || 'N/A',
      irctc_user_id: p.irctc_user_id || `IRCTC_${p.id ? String(p.id).slice(-6) : '001'}`,
      status: p.status || 'Active',
      role: 'passenger',
      created_at: p.created_at || '2026-01-01T00:00:00.000Z',
      bookings_count: pBookings.length,
      has_bookings: hasBookings,
      has_upcoming: hasUpcoming,
      has_completed: hasCompleted,
      has_cancelled: hasCancelled,
      recent_booking_pnr: pBookings.length > 0 ? (pBookings[0].pnr_number || pBookings[0].pnr || pBookings[0].id) : null
      // SENSITIVE DATA MASKED/OMITTED (password, password_hash, card_number, cvv, pin, otp, aadhaar)
    };
  });

  // 1. Search Filter
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    sanitized = sanitized.filter(p => 
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      String(p.id).toLowerCase().includes(q) ||
      String(p.irctc_user_id).toLowerCase().includes(q)
    );
  }

  // 2. Status Filter
  if (status && status !== 'ALL' && status !== 'All' && status !== 'all') {
    const st = String(status).toLowerCase();
    sanitized = sanitized.filter(p => String(p.status).toLowerCase() === st);
  }

  // 3. Registration Filter
  if (registration_filter && registration_filter !== 'ALL' && registration_filter !== 'All') {
    if (from_date || to_date) {
      if (from_date) sanitized = sanitized.filter(p => p.created_at >= from_date);
      if (to_date) sanitized = sanitized.filter(p => p.created_at <= to_date + 'T23:59:59');
    }
  }

  // 4. Booking Activity Filter
  if (booking_activity && booking_activity !== 'ALL' && booking_activity !== 'All' && booking_activity !== 'all') {
    const act = String(booking_activity).toLowerCase();
    if (act === 'has_bookings' || act === 'has bookings') {
      sanitized = sanitized.filter(p => p.has_bookings);
    } else if (act === 'no_bookings' || act === 'no bookings') {
      sanitized = sanitized.filter(p => !p.has_bookings);
    } else if (act === 'upcoming' || act === 'active/upcoming booking') {
      sanitized = sanitized.filter(p => p.has_upcoming);
    } else if (act === 'completed' || act === 'completed journey') {
      sanitized = sanitized.filter(p => p.has_completed);
    } else if (act === 'cancelled' || act === 'cancelled booking') {
      sanitized = sanitized.filter(p => p.has_cancelled);
    }
  }

  // 5. Sorting
  const sortKey = String(sort).toLowerCase();
  const isDesc = String(order).toLowerCase() === 'desc' || sortKey === 'newest';

  sanitized.sort((a, b) => {
    let valA = a.created_at;
    let valB = b.created_at;
    if (sortKey === 'name') {
      valA = a.full_name;
      valB = b.full_name;
    } else if (sortKey === 'email') {
      valA = a.email;
      valB = b.email;
    } else if (sortKey === 'bookings') {
      valA = a.bookings_count;
      valB = b.bookings_count;
    }

    if (valA < valB) return isDesc ? 1 : -1;
    if (valA > valB) return isDesc ? -1 : 1;
    return 0;
  });

  const total = sanitized.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 25);
  const totalPages = Math.ceil(total / limitNum) || 1;

  const startIndex = (pageNum - 1) * limitNum;
  const paginatedPass = sanitized.slice(startIndex, startIndex + limitNum);

  if (req.query.paginated === 'true') {
    return res.json({
      passengers: paginatedPass,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    });
  }

  const resArray = (req.query.page || req.query.limit) ? paginatedPass : sanitized;
  resArray.total = total;
  resArray.page = pageNum;
  resArray.limit = limitNum;
  resArray.totalPages = totalPages;

  return res.json(resArray);
});

// GET /api/staff/notifications - Staff view notifications
router.get('/notifications', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('VIEW_NOTIFICATIONS'), (req, res) => {
  const notifs = Array.from(mockDb.notifications.values()).filter(n => n.user_id === req.user.id || n.user_id === 'all' || req.user.role === 'admin');
  return res.json(notifs);
});

// ==========================================
// 3B. TTE TICKET CHECKING & ON-BOARD TERMINAL
// ==========================================

// GET /api/staff/checking/trains - List trains with real route and class metadata for TTE Terminal
router.get('/checking/trains', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const trainList = Array.from(mockDb.trains.values()).map(t => {
    const route = Array.from(mockDb.routes.values()).find(r => r.train_id === t.id || r.train_number === t.train_number);
    const available_classes = Array.isArray(t.available_classes) && t.available_classes.length > 0
      ? t.available_classes
      : ['1A', '2A', '3A', 'SL'];

    return {
      id: t.id,
      train_number: t.train_number,
      train_name: t.train_name,
      train_type: t.train_type || 'Superfast',
      source: t.source || t.source_station_code || route?.source_station_code || 'NDLS',
      source_name: t.source_station_name || route?.source_station_name || 'New Delhi',
      destination: t.destination || t.destination_station_code || route?.destination_station_code || 'MMCT',
      destination_name: t.destination_station_name || route?.destination_station_name || 'Mumbai Central',
      departure_time: t.departure_time || route?.departure_time || '16:55',
      arrival_time: t.arrival_time || route?.arrival_time || '08:35',
      available_classes,
      operational_status: t.operational_status || t.status || 'ON_TIME',
      chart_status: t.chart_status || 'FIRST_CHART'
    };
  });

  return res.json({
    count: trainList.length,
    trains: trainList,
    data_source: {
      mode: 'PROJECT DATABASE / DEMO DATA',
      live_prs_status: 'IRCTC / PRS LIVE: NOT CONNECTED (Internal Project Engine)'
    }
  });
});

// GET /api/staff/checking/coach-layout - Real interactive Coach Seat Layout & Verification Status
router.get('/checking/coach-layout', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { train_id, travel_date, coach } = req.query;

  // 1. Resolve train
  let train = null;
  if (train_id && train_id !== 'all') {
    train = mockDb.trains.get(train_id) || Array.from(mockDb.trains.values()).find(t => t.id === train_id || t.train_number === train_id);
  }
  if (!train) {
    train = Array.from(mockDb.trains.values())[0] || {
      id: 'train-1',
      train_number: '12952',
      train_name: 'Mumbai Rajdhani Express',
      source: 'NDLS',
      destination: 'MMCT',
      departure_time: '16:55',
      arrival_time: '08:35',
      available_classes: ['1A', '2A', '3A', 'SL']
    };
  }

  // 2. Resolve journey date
  const date = travel_date || new Date().toISOString().split('T')[0];

  // 3. Resolve available coaches for this train
  const availClasses = Array.isArray(train.available_classes) && train.available_classes.length > 0
    ? train.available_classes
    : ['1A', '2A', '3A', 'SL'];

  const coachList = [];
  if (availClasses.includes('1A')) coachList.push('H1 (1A)');
  if (availClasses.includes('2A')) coachList.push('A1 (2A)');
  if (availClasses.includes('3A')) {
    coachList.push('B1 (3A)');
    coachList.push('B2 (3A)');
  }
  if (availClasses.includes('SL')) coachList.push('S1 (SL)');
  if (availClasses.includes('CC')) coachList.push('C1 (CC)');
  if (coachList.length === 0) coachList.push('B1 (3A)');

  const selectedCoach = coach || (coachList[0] ? coachList[0].split(' ')[0] : 'B1');

  // Derive class code from coach prefix
  let coachClass = '3A';
  if (selectedCoach.startsWith('H')) coachClass = '1A';
  else if (selectedCoach.startsWith('A')) coachClass = '2A';
  else if (selectedCoach.startsWith('B')) coachClass = '3A';
  else if (selectedCoach.startsWith('S')) coachClass = 'SL';
  else if (selectedCoach.startsWith('C')) coachClass = 'CC';

  // 4. Fetch all active allocations and bookings for this train, date, and coach
  const trainBookings = Array.from(mockDb.bookings.values()).filter(b => {
    if (!b || !b.pnr_number) return false;
    const bStatus = String(b.status || '').toLowerCase();
    if (bStatus.includes('cancel') || bStatus === 'deleted' || bStatus === 'dummy') return false;
    const matchesTrain = b.train_id === train.id || String(b.train_number) === String(train.train_number);
    const matchesDate = !b.travel_date || b.travel_date === date;
    return matchesTrain && matchesDate;
  });

  const bookingIds = new Set(trainBookings.map(b => b.id));
  const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => {
    if (!a) return false;
    const matchesBooking = bookingIds.has(a.booking_id);
    const matchesCoach = a.coach_number === selectedCoach;
    const matchesDate = !a.travel_date || a.travel_date === date;
    return matchesBooking && matchesCoach && matchesDate;
  });

  // 5. Generate realistic berth matrix (24 berths for interactive display)
  const totalBerths = 24;
  const seats = [];

  for (let seatNo = 1; seatNo <= totalBerths; seatNo++) {
    let berthType = 'LB';
    if (coachClass === '3A' || coachClass === 'SL') {
      const mod = seatNo % 8;
      if (mod === 1 || mod === 4) berthType = 'LB';
      else if (mod === 2 || mod === 5) berthType = 'MB';
      else if (mod === 3 || mod === 6) berthType = 'UB';
      else if (mod === 7) berthType = 'SL';
      else if (mod === 0) berthType = 'SU';
    } else if (coachClass === '2A') {
      const mod = seatNo % 6;
      if (mod === 1 || mod === 3) berthType = 'LB';
      else if (mod === 2 || mod === 4) berthType = 'UB';
      else if (mod === 5) berthType = 'SL';
      else if (mod === 0) berthType = 'SU';
    } else if (coachClass === '1A') {
      berthType = seatNo % 2 === 1 ? 'LB' : 'UB';
    }

    const seatId = `${selectedCoach}-${seatNo}`;
    const alloc = allocations.find(a => Number(a.seat_number) === seatNo);

    if (alloc) {
      const booking = mockDb.bookings.get(alloc.booking_id) || {};
      const paxName = resolvePassengerNameForBooking(booking.id, alloc.passenger_id || booking.passenger_id, alloc.passenger_name || booking.passenger_name);
      const paxProfile = alloc.passenger_id ? mockDb.profiles.get(alloc.passenger_id) : null;

      let seatState = 'PENDING';
      if (alloc.boarding_status === 'NO_SHOW' || booking.boarding_status === 'NO_SHOW' || alloc.checked_in === 'no_show') {
        seatState = 'NO_SHOW';
      } else if (alloc.checked_in === true || alloc.boarding_status === 'VERIFIED' || booking.boarding_status === 'VERIFIED') {
        seatState = 'VERIFIED';
      } else if (booking.status === 'rac') {
        seatState = 'RAC';
      }

      seats.push({
        id: seatId,
        seat_number: seatNo,
        berth_type: alloc.berth_type || berthType,
        state: seatState,
        is_booked: true,
        passenger: {
          name: paxName,
          pnr: booking.pnr_number || alloc.pnr || 'N/A',
          age: alloc.passenger_age || booking.passenger_age || 30,
          gender: alloc.passenger_gender || booking.passenger_gender || 'Male',
          phone: booking.user_phone || booking.passenger_phone || paxProfile?.phone || '+91 9876543210',
          email: booking.user_email || booking.passenger_email || paxProfile?.email || 'passenger@railway.com',
          booking_id: booking.id,
          allocation_id: alloc.id,
          ticket_status: (booking.status || 'CNF').toUpperCase(),
          boarding_status: seatState,
          checked_in: alloc.checked_in === true || seatState === 'VERIFIED',
          checked_at: alloc.checked_at || null,
          checked_by_staff_id: alloc.checked_by_staff_id || null,
          boarding_station: booking.source_station || booking.source || train.source || 'NDLS',
          destination_station: booking.destination_station || booking.destination || train.destination || 'MMCT'
        }
      });
    } else {
      seats.push({
        id: seatId,
        seat_number: seatNo,
        berth_type: berthType,
        state: 'AVAILABLE',
        is_booked: false,
        passenger: null
      });
    }
  }

  // Summary counts for this coach
  const verifiedCount = seats.filter(s => s.state === 'VERIFIED').length;
  const pendingCount = seats.filter(s => s.state === 'PENDING').length;
  const noShowCount = seats.filter(s => s.state === 'NO_SHOW').length;
  const racCount = seats.filter(s => s.state === 'RAC').length;
  const bookedCount = seats.filter(s => s.is_booked).length;
  const availableCount = seats.filter(s => s.state === 'AVAILABLE').length;

  return res.json({
    train: {
      id: train.id,
      train_number: train.train_number,
      train_name: train.train_name,
      source: train.source || train.source_station_code || 'NDLS',
      destination: train.destination || train.destination_station_code || 'MMCT',
      departure_time: train.departure_time || '16:55',
      arrival_time: train.arrival_time || '08:35',
      operational_status: train.operational_status || 'ON_TIME',
      chart_status: train.chart_status || 'FINAL_CHART'
    },
    travel_date: date,
    coaches: coachList,
    selected_coach: selectedCoach,
    coach_class: coachClass,
    seats,
    summary: {
      total_passengers: bookedCount,
      verified: verifiedCount,
      pending: pendingCount,
      no_show: noShowCount,
      rac: racCount,
      available: availableCount
    },
    data_source: {
      mode: 'PROJECT DATABASE / DEMO DATA',
      live_prs_status: 'IRCTC / PRS LIVE: NOT CONNECTED (Internal Project Engine)'
    }
  });
});

// POST /api/staff/ticket/verify - PNR / Ticket Verification from Central Engine
router.post('/ticket/verify', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['VERIFY_TICKETS', 'VERIFY_TICKET', 'VIEW_PNR']), (req, res) => {
  const { pnr, checked_status } = req.body;
  if (!pnr) {
    return res.status(400).json({ error: 'PNR number is required for verification' });
  }

  const cleanPnr = String(pnr).trim();
  const booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === cleanPnr || b.id === cleanPnr);
  
  if (!booking) {
    return res.status(404).json({
      status: 'NOT_FOUND',
      valid: false,
      error: `Invalid PNR Number ${cleanPnr}. Ticket not found in centralized reservation database.`
    });
  }

  const isCancelled = String(booking.status || '').toLowerCase().includes('cancel');
  const paxName = resolvePassengerNameForBooking(booking.id, booking.passenger_id, booking.passenger_name);
  const train = mockDb.trains.get(booking.train_id) || Array.from(mockDb.trains.values()).find(t => t.train_number === booking.train_number) || {
    train_number: booking.train_number || '12952',
    train_name: booking.train_name || 'Express Special',
    source: booking.source_station || 'NDLS',
    destination: booking.destination_station || 'MMCT'
  };

  if (isCancelled) {
    return res.status(400).json({
      status: 'CANCELLED',
      valid: false,
      pnr: booking.pnr_number,
      passenger_name: paxName,
      train_number: train.train_number,
      train_name: train.train_name,
      cancellation_reason: booking.cancellation_reason || 'Ticket has been cancelled in railway system.',
      cancellation_date: booking.cancellation_date_time || booking.updated_at,
      refund_status: booking.refund_status || 'REFUNDED',
      error: 'CRITICAL WARNING: TICKET CANCELLED. Boarding is not permitted for cancelled tickets.'
    });
  }

  // Resolve allocations
  let allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a && a.booking_id === booking.id);
  const markVerified = checked_status !== undefined ? checked_status : true;

  if (allocations.length === 0) {
    // Generate allocation if confirmed
    const newAlloc = {
      id: `alloc-${booking.id}-1`,
      booking_id: booking.id,
      passenger_id: booking.passenger_id || 'usr-1',
      passenger_name: paxName,
      passenger_age: booking.passenger_age || 30,
      passenger_gender: booking.passenger_gender || 'Male',
      coach_number: booking.coach_number && booking.coach_number !== 'Unassigned' ? booking.coach_number : 'B1',
      seat_number: booking.seat_number && booking.seat_number !== '-' ? booking.seat_number : 12,
      berth_type: booking.berth_type && booking.berth_type !== 'Unallocated' ? booking.berth_type : 'SL',
      checked_in: markVerified,
      boarding_status: markVerified ? 'VERIFIED' : 'PENDING',
      checked_by_staff_id: req.user.id,
      checked_at: new Date().toISOString(),
      allocated_at: new Date().toISOString()
    };
    mockDb.seat_allocations.set(newAlloc.id, newAlloc);
    allocations = [newAlloc];
  } else {
    allocations.forEach(a => {
      a.checked_in = markVerified;
      a.boarding_status = markVerified ? 'VERIFIED' : 'PENDING';
      a.checked_by_staff_id = req.user.id;
      a.checked_at = new Date().toISOString();
      mockDb.seat_allocations.set(a.id, a);
    });
  }

  booking.boarding_status = markVerified ? 'VERIFIED' : 'PENDING';
  booking.updated_at = new Date().toISOString();
  mockDb.bookings.set(booking.id, booking);

  // Log verification audit
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    actor_id: req.user.id,
    action: 'VERIFY_TICKET',
    entity_type: 'booking',
    entity_id: booking.id,
    pnr: booking.pnr_number,
    status: markVerified ? 'VERIFIED' : 'PENDING',
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();

  const firstAlloc = allocations[0] || {};
  return res.json({
    status: 'VALID',
    valid: true,
    pnr: booking.pnr_number,
    booking_id: booking.id,
    passenger_name: paxName,
    age: firstAlloc.passenger_age || booking.passenger_age || 30,
    gender: firstAlloc.passenger_gender || booking.passenger_gender || 'Male',
    train_number: train.train_number,
    train_name: train.train_name,
    from: booking.source_station || booking.source || train.source || 'NDLS',
    to: booking.destination_station || booking.destination || train.destination || 'MMCT',
    travel_date: booking.travel_date,
    coach: firstAlloc.coach_number || booking.coach_number || 'B1',
    seat_number: firstAlloc.seat_number || booking.seat_number || 12,
    berth_type: firstAlloc.berth_type || booking.berth_type || 'LB',
    coach_class: booking.coach_class || '3A',
    ticket_status: (booking.status || 'CNF').toUpperCase(),
    boarding_status: markVerified ? 'VERIFIED' : 'PENDING',
    status_badge: markVerified ? 'VERIFIED & CHECKED ON-BOARD' : 'CHECK-IN REVERTED',
    verified_by_staff_id: req.user.id,
    verified_at: new Date().toISOString(),
    allocations,
    data_source: {
      mode: 'PROJECT DATABASE / DEMO DATA',
      live_prs_status: 'IRCTC / PRS LIVE: NOT CONNECTED (Internal Project Engine)'
    }
  });
});

// POST /api/staff/ticket/no-show - Mark Passenger as NO-SHOW and detect next eligible RAC Passenger
router.post('/ticket/no-show', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['VERIFY_TICKETS', 'MANAGE_RAC']), (req, res) => {
  const { pnr, seat_id, reason } = req.body;

  let booking = null;
  let allocation = null;

  if (pnr) {
    booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === String(pnr).trim() || b.id === String(pnr).trim());
  }

  if (seat_id) {
    allocation = Array.from(mockDb.seat_allocations.values()).find(a => a.seat_id === seat_id || a.id === seat_id);
    if (!booking && allocation) {
      booking = mockDb.bookings.get(allocation.booking_id);
    }
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking or seat allocation not found for NO-SHOW update' });
  }

  // Update allocation
  if (!allocation) {
    allocation = Array.from(mockDb.seat_allocations.values()).find(a => a.booking_id === booking.id);
  }

  if (allocation) {
    allocation.checked_in = false;
    allocation.boarding_status = 'NO_SHOW';
    allocation.no_show_at = new Date().toISOString();
    allocation.no_show_by_staff_id = req.user.id;
    mockDb.seat_allocations.set(allocation.id, allocation);
  }

  booking.boarding_status = 'NO_SHOW';
  booking.no_show_reason = reason || 'Passenger absent at scheduled boarding station';
  booking.updated_at = new Date().toISOString();
  mockDb.bookings.set(booking.id, booking);

  // Vacated seat coordinates
  const vacatedSeat = {
    seat_id: allocation?.seat_id || seat_id || `${booking.coach_number || 'B1'}-${booking.seat_number || 12}`,
    coach_number: allocation?.coach_number || booking.coach_number || 'B1',
    seat_number: allocation?.seat_number || booking.seat_number || 12,
    berth_type: allocation?.berth_type || booking.berth_type || 'LB',
    coach_class: booking.coach_class || '3A'
  };

  // Find next eligible RAC passenger for this train and date
  const racCandidates = Array.from(mockDb.bookings.values()).filter(b => {
    if (!b || !b.pnr_number) return false;
    if (b.status !== 'rac') return false;
    const sameTrain = b.train_id === booking.train_id || b.train_number === booking.train_number;
    const sameDate = !b.travel_date || b.travel_date === booking.travel_date;
    return sameTrain && sameDate;
  }).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const topRac = racCandidates[0] ? {
    id: racCandidates[0].id,
    pnr: racCandidates[0].pnr_number,
    name: resolvePassengerNameForBooking(racCandidates[0].id, racCandidates[0].passenger_id, racCandidates[0].passenger_name),
    age: racCandidates[0].passenger_age || 32,
    gender: racCandidates[0].passenger_gender || 'Male',
    phone: racCandidates[0].user_phone || racCandidates[0].passenger_phone || '+91 9841209412',
    current_status: 'RAC 1',
    coach_class: racCandidates[0].coach_class || '3A'
  } : null;

  // Log audit
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'PASSENGER_NO_SHOW',
    pnr: booking.pnr_number,
    vacated_seat: `${vacatedSeat.coach_number}-${vacatedSeat.seat_number}`,
    reason: booking.no_show_reason,
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Passenger marked as NO-SHOW. Berth ${vacatedSeat.coach_number}-${vacatedSeat.seat_number} vacated.`,
    pnr: booking.pnr_number,
    vacated_seat: vacatedSeat,
    next_rac: topRac
  });
});

// GET /api/staff/rac-queue/:trainId - Get active RAC Passenger Queue for train & date
router.get('/rac-queue/:trainId', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { trainId } = req.params;
  const { travel_date } = req.query;

  const racBookings = Array.from(mockDb.bookings.values()).filter(b => {
    if (!b || !b.pnr_number) return false;
    if (b.status !== 'rac') return false;
    if (trainId && trainId !== 'all') {
      const matchTrain = b.train_id === trainId || String(b.train_number) === String(trainId);
      if (!matchTrain) return false;
    }
    if (travel_date && b.travel_date && b.travel_date !== travel_date) {
      return false;
    }
    return true;
  }).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  let racIndex = 1;
  const queue = racBookings.map(b => {
    const pName = resolvePassengerNameForBooking(b.id, b.passenger_id, b.passenger_name);
    const paxProfile = b.passenger_id ? mockDb.profiles.get(b.passenger_id) : null;
    return {
      id: b.id,
      pnr: b.pnr_number,
      passenger_name: pName,
      age: b.passenger_age || 30,
      gender: b.passenger_gender || 'Male',
      phone: b.user_phone || b.passenger_phone || paxProfile?.phone || '+91 9841209412',
      email: b.user_email || b.passenger_email || paxProfile?.email || 'passenger@railway.com',
      coach_class: b.coach_class || '3A',
      rac_position: `RAC ${racIndex++}`,
      train_id: b.train_id,
      travel_date: b.travel_date,
      created_at: b.created_at
    };
  });

  return res.json({
    train_id: trainId,
    travel_date,
    count: queue.length,
    rac_queue: queue
  });
});

// POST /api/staff/ticket/promote-rac - Atomic On-Board RAC Berth Promotion
router.post('/ticket/promote-rac', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_RAC', 'VERIFY_TICKETS']), (req, res) => {
  const { rac_booking_id, target_seat_id, target_coach, target_seat_number, target_berth_type, vacated_from_pnr } = req.body;

  if (!rac_booking_id) {
    return res.status(400).json({ error: 'rac_booking_id is required for promotion' });
  }

  const racBooking = mockDb.bookings.get(rac_booking_id);
  if (!racBooking) {
    return res.status(404).json({ error: 'RAC Booking not found in database' });
  }

  if (racBooking.status !== 'rac' && racBooking.status !== 'waitlist') {
    return res.status(400).json({ error: `Booking is not in RAC status (current status: ${racBooking.status})` });
  }

  const assignedCoach = target_coach || 'B1';
  const assignedSeatNo = target_seat_number || 12;
  const assignedBerth = target_berth_type || 'LB';
  const assignedSeatId = target_seat_id || `${assignedCoach}-${assignedSeatNo}`;

  // Atomic conflict check: ensure seat is not occupied by an active, present passenger
  const existingActive = Array.from(mockDb.seat_allocations.values()).find(a => {
    if (!a) return false;
    const sameSeat = a.coach_number === assignedCoach && Number(a.seat_number) === Number(assignedSeatNo);
    const sameDate = !a.travel_date || a.travel_date === racBooking.travel_date;
    const isPresent = a.checked_in === true || a.boarding_status === 'VERIFIED';
    return sameSeat && sameDate && isPresent;
  });

  if (existingActive) {
    return res.status(409).json({
      error: `Conflict: Berth ${assignedCoach}-${assignedSeatNo} is currently occupied by a verified passenger.`
    });
  }

  // Update RAC booking to confirmed
  racBooking.status = 'confirmed';
  racBooking.coach_number = assignedCoach;
  racBooking.seat_number = assignedSeatNo;
  racBooking.berth_type = assignedBerth;
  racBooking.boarding_status = 'PENDING';
  racBooking.promoted_at = new Date().toISOString();
  racBooking.promoted_by_staff_id = req.user.id;
  racBooking.updated_at = new Date().toISOString();
  mockDb.bookings.set(racBooking.id, racBooking);

  // Update or create seat allocation
  let alloc = Array.from(mockDb.seat_allocations.values()).find(a => a.booking_id === racBooking.id);
  const paxName = resolvePassengerNameForBooking(racBooking.id, racBooking.passenger_id, racBooking.passenger_name);

  if (alloc) {
    alloc.seat_id = assignedSeatId;
    alloc.coach_number = assignedCoach;
    alloc.seat_number = assignedSeatNo;
    alloc.berth_type = assignedBerth;
    alloc.travel_date = racBooking.travel_date;
    alloc.checked_in = false;
    alloc.boarding_status = 'PENDING';
    mockDb.seat_allocations.set(alloc.id, alloc);
  } else {
    const allocId = 'al-' + Math.random().toString(36).substr(2, 9);
    alloc = {
      id: allocId,
      booking_id: racBooking.id,
      seat_id: assignedSeatId,
      coach_number: assignedCoach,
      seat_number: assignedSeatNo,
      berth_type: assignedBerth,
      travel_date: racBooking.travel_date,
      passenger_name: paxName,
      passenger_age: racBooking.passenger_age || 30,
      passenger_gender: racBooking.passenger_gender || 'Male',
      checked_in: false,
      boarding_status: 'PENDING',
      allocated_at: new Date().toISOString()
    };
    mockDb.seat_allocations.set(allocId, alloc);
  }

  // In-app passenger notification
  const notifId = 'notif-' + Date.now();
  mockDb.notifications.set(notifId, {
    id: notifId,
    user_id: racBooking.passenger_id || 'all',
    type: 'RAC_PROMOTION',
    title: '🎉 RAC Berth Promoted to Confirmed!',
    message: `Your RAC ticket (PNR: ${racBooking.pnr_number}) has been promoted to confirmed berth: Coach ${assignedCoach}, Seat ${assignedSeatNo} (${assignedBerth}).`,
    read: false,
    created_at: new Date().toISOString()
  });

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    actor_id: req.user.id,
    action: 'RAC_PROMOTION_ON_BOARD',
    entity_type: 'booking',
    entity_id: racBooking.id,
    pnr: racBooking.pnr_number,
    assigned_berth: `${assignedCoach}-${assignedSeatNo} (${assignedBerth})`,
    vacated_from_pnr: vacated_from_pnr || 'N/A',
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Berth ${assignedCoach}-${assignedSeatNo} successfully reassigned to ${paxName}`,
    booking: racBooking,
    assigned_seat: {
      seat_id: assignedSeatId,
      coach_number: assignedCoach,
      seat_number: assignedSeatNo,
      berth_type: assignedBerth
    }
  });
});

// POST /api/staff/eft - Issue Excess Fare Ticket (EFT) Fine / Penalty
router.post('/eft', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['ISSUE_EFT', 'VERIFY_TICKETS']), (req, res) => {
  const {
    train_id,
    train_number,
    train_name,
    travel_date,
    source_station,
    destination_station,
    passenger_name,
    passenger_phone,
    coach_number,
    seat_number,
    violation_reason,
    base_fare,
    penalty_amount,
    payment_mode,
    remarks
  } = req.body;

  if (!passenger_name) {
    return res.status(400).json({ error: 'Passenger name is required for issuing Excess Fare Ticket' });
  }

  const serialNum = `EFT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const eftId = 'eft-' + Date.now();

  const bFare = Number(base_fare) || 0;
  const pAmount = Number(penalty_amount) || 250;
  const totalAmount = bFare + pAmount;

  const newEft = {
    id: eftId,
    receipt_number: serialNum,
    train_id: train_id || 'train-1',
    train_number: train_number || '12952',
    train_name: train_name || 'Mumbai Rajdhani Express',
    travel_date: travel_date || new Date().toISOString().split('T')[0],
    source_station: source_station || 'NDLS',
    destination_station: destination_station || 'MMCT',
    passenger_name: String(passenger_name).trim(),
    passenger_phone: passenger_phone || 'N/A',
    coach_number: coach_number || 'General',
    seat_number: seat_number || '-',
    violation_reason: violation_reason || 'Traveling Without Ticket (TWT)',
    base_fare: bFare,
    penalty_amount: pAmount,
    total_amount: totalAmount,
    payment_mode: payment_mode || 'CASH', // CASH, UPI, POS
    status: 'PAID',
    remarks: remarks || '',
    issued_by_staff_id: req.user.id,
    issued_by_staff_name: req.user.full_name || req.user.email || 'TTE Officer',
    issued_at: new Date().toISOString(),
    system_notice: 'PROJECT DATABASE / DEMO OPERATIONS'
  };

  if (!mockDb.eft_records) mockDb.eft_records = new Map();
  mockDb.eft_records.set(eftId, newEft);

  // Log audit
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'ISSUE_EFT',
    receipt_number: serialNum,
    passenger_name: newEft.passenger_name,
    total_amount: totalAmount,
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Excess Fare Ticket ${serialNum} issued successfully for ₹${totalAmount}`,
    eft: newEft
  });
});

// GET /api/staff/eft - Fetch issued Excess Fare Tickets
router.get('/eft', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { train_id, travel_date, search } = req.query;
  const records = mockDb.eft_records ? Array.from(mockDb.eft_records.values()) : [];

  let filtered = records.sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at));

  if (train_id && train_id !== 'all') {
    filtered = filtered.filter(e => e.train_id === train_id || e.train_number === train_id);
  }

  if (travel_date) {
    filtered = filtered.filter(e => e.travel_date === travel_date);
  }

  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter(e => 
      (e.receipt_number && e.receipt_number.toLowerCase().includes(q)) ||
      (e.passenger_name && e.passenger_name.toLowerCase().includes(q)) ||
      (e.passenger_phone && e.passenger_phone.toLowerCase().includes(q))
    );
  }

  return res.json({
    count: filtered.length,
    eft_records: filtered,
    data_source: {
      mode: 'PROJECT DATABASE / DEMO OPERATIONS',
      live_prs_status: 'IRCTC / PRS LIVE: NOT CONNECTED'
    }
  });
});

// ==========================================
// 4. INCIDENT & SERVICE ISSUE MANAGEMENT
// ==========================================

// GET /api/staff/incidents - Fetch internal service/system issues
router.get('/incidents', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('CREATE_INCIDENT_REPORT'), (req, res) => {
  const list = Array.from(mockDb.staff_incidents.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return res.json(list);
});

// POST /api/staff/incidents - Report service/system issue
router.post('/incidents', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('CREATE_INCIDENT_REPORT'), (req, res) => {
  const { title, category, severity, train_number, station_code, description, location, action_taken } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Issue title and description are required' });
  }

  const incidentId = 'inc-' + Date.now();
  const newIncident = {
    id: incidentId,
    title,
    category: category || 'WEBSITE_ISSUE',
    severity: severity || 'MEDIUM',
    train_number: train_number || 'N/A',
    station_code: station_code || 'NDLS',
    description,
    location: location || 'Website Data Record',
    action_taken: action_taken || 'Logged internal website service issue.',
    status: 'OPEN',
    reported_by: req.user.id,
    reported_by_name: req.user.full_name || 'Staff Member',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockDb.staff_incidents.set(incidentId, newIncident);

  // High severity creates notification
  if (['HIGH', 'CRITICAL'].includes(String(severity).toUpperCase())) {
    const notifId = 'notif-' + Date.now();
    mockDb.notifications.set(notifId, {
      id: notifId,
      user_id: 'usr-demo-admin',
      type: 'CRITICAL_INCIDENT',
      title: `🚨 ${severity} Issue Report: ${title}`,
      message: `Reported by ${req.user.full_name}: ${description}`,
      read: false,
      created_at: new Date().toISOString()
    });
  }

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'CREATED_INCIDENT_REPORT',
    incident_id: incidentId,
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();
  return res.status(201).json(newIncident);
});

// ==========================================
// 5. DAILY OPERATIONS REPORT
// ==========================================

// GET /api/staff/daily-reports - Fetch staff daily reports
router.get('/daily-reports', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const staffId = req.user.id;
  const isStaff = req.user.role === 'staff';
  
  let reports = Array.from(mockDb.staff_daily_reports.values());
  if (isStaff) {
    reports = reports.filter(r => r.staff_id === staffId || r.staff_name === req.user.full_name);
  }

  reports.sort((a, b) => new Date(b.submitted_at || b.report_date || b.created_at) - new Date(a.submitted_at || a.report_date || a.created_at));
  return res.json(reports);
});

// POST /api/staff/daily-reports - Submit daily report
router.post('/daily-reports', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('SUBMIT_DAILY_REPORT'), (req, res) => {
  const {
    report_date,
    shift,
    assigned_train,
    assigned_station,
    trains_handled,
    passengers_handled,
    tickets_verified,
    rac_wl_handled,
    catering_orders_handled,
    passenger_complaints,
    delays_observed,
    incidents_handled,
    summary,
    remarks,
    delay_details,
    actions_taken,
    pending_issues,
    declaration_confirmed,
    assigned_tasks_completed,
    passenger_requests_handled
  } = req.body;

  if (!declaration_confirmed) {
    return res.status(400).json({ error: 'You must confirm the website operational declaration before submitting.' });
  }

  const reportId = 'rep-' + Date.now();
  const staffProf = mockDb.staff_profiles.get(req.user.id) || {};

  const tasksCount = assigned_tasks_completed !== undefined ? parseInt(assigned_tasks_completed) : (parseInt(trains_handled) || 4);
  const reqsCount = passenger_requests_handled !== undefined ? parseInt(passenger_requests_handled) : (parseInt(passengers_handled) || 12);

  const newReport = {
    id: reportId,
    staff_id: req.user.id,
    employee_id: req.user.employee_id || staffProf.employee_id || 'EMP-10001',
    staff_name: req.user.full_name || staffProf.full_name || req.user.username || 'Staff Member',
    department: staffProf.department || 'Operations',
    report_date: report_date || new Date().toISOString().split('T')[0],
    shift: shift || 'Morning Shift (06:00 - 14:00)',
    assigned_train: assigned_train || '12951 - Rajdhani Express',
    assigned_station: assigned_station || 'NDLS',
    assigned_tasks_completed: tasksCount,
    trains_handled: tasksCount,
    passenger_requests_handled: reqsCount,
    passengers_handled: reqsCount,
    tickets_verified: tickets_verified !== undefined ? parseInt(tickets_verified) : 95,
    rac_wl_handled: rac_wl_handled !== undefined ? parseInt(rac_wl_handled) : 12,
    catering_orders_handled: catering_orders_handled !== undefined ? parseInt(catering_orders_handled) : 15,
    passenger_complaints: passenger_complaints !== undefined ? parseInt(passenger_complaints) : 0,
    delays_observed: delays_observed !== undefined ? parseInt(delays_observed) : 0,
    incidents_handled: incidents_handled !== undefined ? parseInt(incidents_handled) : 1,
    summary: summary || 'All internal website management tasks completed smoothly.',
    remarks: remarks || actions_taken || '',
    delay_details: delay_details || 'No critical website issues reported.',
    actions_taken: actions_taken || remarks || 'Verified PNRs and managed website booking inquiries.',
    pending_issues: pending_issues || 'None',
    status: 'SUBMITTED',
    report_status: 'PENDING_REVIEW',
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockDb.staff_daily_reports.set(reportId, newReport);

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'SUBMITTED_DAILY_REPORT',
    report_id: reportId,
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();

  return res.status(201).json(newReport);
});

// ==========================================
// 6. PASSENGER SERVICE REQUESTS
// ==========================================

// GET /api/staff/service-requests - Fetch passenger service requests
router.get('/service-requests', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('HANDLE_SERVICE_REQUESTS'), (req, res) => {
  if (!mockDb.service_requests) {
    mockDb.service_requests = new Map();
    mockDb.service_requests.set('sr-101', {
      id: 'sr-101',
      pnr: '8819203941',
      passenger_name: 'Rahul Sharma',
      request_type: 'Booking Support',
      category: 'Booking Support',
      description: 'Request for berth change information stored in system',
      status: 'Pending',
      created_at: new Date().toISOString()
    });
    mockDb.service_requests.set('sr-102', {
      id: 'sr-102',
      pnr: '9928102938',
      passenger_name: 'Priya Patel',
      request_type: 'Passenger Support',
      category: 'Passenger Support',
      description: 'Seat allocation guidance and boarding assistance query',
      status: 'In Progress',
      created_at: new Date().toISOString()
    });
  }

  const list = Array.from(mockDb.service_requests.values()).filter(r => 
    !String(r.request_type || r.category || '').toLowerCase().includes('catering')
  );
  return res.json(list);
});

// PATCH /api/staff/service-requests/:id - Update status
router.patch('/service-requests/:id', authenticateToken, requireRoles(['staff', 'admin']), requirePermission('HANDLE_SERVICE_REQUESTS'), (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes } = req.body;

  if (!mockDb.service_requests) mockDb.service_requests = new Map();
  const sr = mockDb.service_requests.get(id);
  if (!sr) {
    return res.status(404).json({ error: 'Service request not found' });
  }

  sr.status = status || sr.status;
  sr.resolution_notes = resolution_notes || sr.resolution_notes;
  sr.updated_at = new Date().toISOString();
  sr.updated_by = req.user.id;

  mockDb.service_requests.set(id, sr);

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: req.user.id,
    action: 'UPDATED_SERVICE_REQUEST',
    request_id: id,
    status: sr.status,
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();
  return res.json(sr);
});

// ==========================================
// 7. CATERING ORDERS FOR STAFF
// ==========================================

// GET /api/staff/catering - REMOVED FROM STAFF
router.get('/catering', authenticateToken, (req, res) => {
  return res.status(403).json({ error: 'Access denied: Catering management has been removed from Staff operations.' });
});

// PATCH /api/staff/catering/:id - REMOVED FROM STAFF
router.patch('/catering/:id', authenticateToken, (req, res) => {
  return res.status(403).json({ error: 'Access denied: Catering management has been removed from Staff operations.' });
});

// ==========================================
// 8. STAFF ACTIVITY & AUDIT LOGS
// ==========================================

// GET /api/staff/activity-logs - View website audit logs
router.get('/activity-logs', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const staffId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  let logs = Array.from(mockDb.staff_audit_logs.values());
  if (!isAdmin) {
    logs = logs.filter(l => l.staff_id === staffId);
  }

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return res.json(logs);
});

// ==========================================
// 9. ADMIN STAFF MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/admin/staff - Admin list staff roster
router.get('/admin-roster', authenticateToken, requireRoles(['admin']), (req, res) => {
  const staffList = Array.from(mockDb.staff_profiles.values());
  const duties = Array.from(mockDb.staff_duties.values());
  const reports = Array.from(mockDb.staff_daily_reports.values());
  const incidents = Array.from(mockDb.staff_incidents.values());
  const allTasks = Array.from(mockDb.staff_tasks ? mockDb.staff_tasks.values() : []);

  const enrichedStaff = staffList.map(s => {
    const sTasks = allTasks.filter(t => t.staff_id === s.id || t.assigned_to_email === s.email);
    const activeTasks = sTasks.filter(t => !['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_')));
    const completedTasks = sTasks.filter(t => ['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_')));
    const perms = mockDb.staff_permissions.get(s.id) || s.permissions || ['ALL'];
    return {
      ...s,
      permissions: perms,
      active_tasks_count: activeTasks.length,
      completed_tasks_count: completedTasks.length
    };
  });

  const summary = {
    total_staff: staffList.length,
    active_staff: staffList.filter(s => String(s.status).toUpperCase() === 'ACTIVE').length,
    on_duty: staffList.filter(s => s.duty_status === 'ON DUTY').length,
    off_duty: staffList.filter(s => !s.duty_status || s.duty_status === 'OFF DUTY').length,
    suspended: staffList.filter(s => ['SUSPENDED', 'INACTIVE'].includes(String(s.status).toUpperCase())).length,
    inactive_suspended: staffList.filter(s => ['SUSPENDED', 'INACTIVE'].includes(String(s.status).toUpperCase())).length,
    pending_approval: staffList.filter(s => String(s.status).toUpperCase() === 'PENDING').length,
    staff_on_trains: duties.filter(d => d.train_id).length,
    staff_on_stations: duties.filter(d => d.station_code).length,
    pending_reports: reports.filter(r => r.status === 'SUBMITTED').length,
    tasks_assigned: allTasks.length,
    tasks_in_progress: allTasks.filter(t => String(t.status).toUpperCase().replace(/[\s-]/g, '_') === 'IN_PROGRESS').length,
    tasks_completed: allTasks.filter(t => ['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length,
    reports_pending_review: allTasks.filter(t => String(t.status).toUpperCase().replace(/[\s-]/g, '_') === 'SUBMITTED_FOR_REVIEW').length + reports.filter(r => r.status === 'SUBMITTED' || r.status === 'PENDING_REVIEW').length,
    reports_needs_followup: allTasks.filter(t => String(t.status).toUpperCase().replace(/[\s-]/g, '_') === 'NEEDS_FOLLOW_UP').length + reports.filter(r => r.status === 'FOLLOWUP_REQUESTED').length,
    incidents_today: incidents.filter(i => i.created_at && i.created_at.startsWith(new Date().toISOString().split('T')[0])).length
  };

  return res.json({ summary, staff: enrichedStaff });
});

// POST /api/staff/admin-create & /api/staff/register - Admin create staff member
router.post(['/admin-create', '/register'], authenticateToken, requireRoles(['admin']), (req, res) => {
  const {
    full_name,
    email,
    phone,
    employee_id,
    department,
    designation,
    staff_type,
    base_station,
    joining_date,
    status,
    permissions
  } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ error: 'Full name and email are required to create staff' });
  }

  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const cleanEmpId = employee_id ? employee_id.trim().toLowerCase() : '';

  const existingStaffByEmail = Array.from(mockDb.staff_profiles.values()).find(s => s && s.email && s.email.trim().toLowerCase() === cleanEmail);
  const existingProfileByEmail = Array.from(mockDb.profiles.values()).find(p => p && p.email && p.email.trim().toLowerCase() === cleanEmail);
  const existingStaffByEmpId = cleanEmpId ? Array.from(mockDb.staff_profiles.values()).find(s => s && s.employee_id && s.employee_id.trim().toLowerCase() === cleanEmpId) : null;

  if (existingStaffByEmail || existingProfileByEmail) {
    return res.status(400).json({ error: 'A user or staff member with this Email already exists.' });
  }
  if (existingStaffByEmpId) {
    return res.status(400).json({ error: 'A staff member with this Employee ID already exists.' });
  }

  const staffId = 'stf-' + Date.now();
  const empId = employee_id || `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
  const tempPassword = 'Staff@' + Math.floor(1000 + Math.random() * 9000);
  const defaultPerms = (permissions || [
    'VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS', 'VIEW_BOOKINGS', 'VIEW_PASSENGERS',
    'VERIFY_TICKETS', 'VIEW_PNR', 'VIEW_MANIFEST', 'VIEW_RAC_WAITLIST',
    'VIEW_TRAIN_STATUS',
    'HANDLE_SERVICE_REQUESTS', 'CREATE_INCIDENT_REPORT', 'SUBMIT_DAILY_REPORT', 'VIEW_NOTIFICATIONS'
  ]).filter(p => !p.toUpperCase().includes('CATERING'));

  const newStaff = {
    id: staffId,
    employee_id: empId,
    full_name,
    email,
    phone: phone || '+91 9876543210',
    role: 'staff',
    staff_type: staff_type || 'Passenger Support Officer',
    department: department || 'Passenger Services',
    designation: designation || 'Passenger Support Officer',
    joining_date: joining_date || new Date().toISOString().split('T')[0],
    status: (status || 'ACTIVE').toUpperCase(),
    duty_status: 'OFF DUTY',
    permissions: defaultPerms,
    tempPassword,
    created_by_admin: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockDb.staff_profiles.set(staffId, newStaff);
  mockDb.staff_permissions.set(staffId, defaultPerms);

  // Mirror in mockDb.profiles so JWT auth works
  mockDb.profiles.set(staffId, {
    id: staffId,
    email,
    role: 'staff',
    full_name,
    phone: phone || '+91 9876543210',
    status: (status || 'ACTIVE').toUpperCase(),
    created_at: new Date().toISOString()
  });

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: staffId,
    actor_id: req.user.id,
    action: 'ADMIN_CREATED_STAFF',
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();

  return res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    staff: newStaff,
    ...newStaff
  });
});

// PUT & PATCH /api/staff/status/:id - Admin toggle/update staff status
router.all(['/status/:id', '/admin-status/:id'], authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  let staffProf = mockDb.staff_profiles.get(id) || Array.from(mockDb.staff_profiles.values()).find(s => s.id === id || s.email === id);
  if (!staffProf) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  staffProf.status = status.toUpperCase();
  staffProf.updated_at = new Date().toISOString();
  mockDb.staff_profiles.set(staffProf.id, staffProf);

  const mainProf = mockDb.profiles.get(staffProf.id);
  if (mainProf) {
    mainProf.status = status.toUpperCase();
    mockDb.profiles.set(staffProf.id, mainProf);
  }

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: staffProf.id,
    actor_id: req.user.id,
    action: 'ADMIN_UPDATED_STAFF_STATUS',
    status: status.toUpperCase(),
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();
  return res.json({ success: true, message: `Staff account ${staffProf.full_name} status updated to ${status.toUpperCase()}`, staff: staffProf });
});

// PUT /api/staff/:id & PUT /api/staff/admin-update/:id - Admin update full staff profile
router.put(['/:id', '/admin-update/:id'], authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, employee_id, department, designation, staff_type, base_station, status, permissions } = req.body;

  let staffProf = mockDb.staff_profiles.get(id) || Array.from(mockDb.staff_profiles.values()).find(s => s.id === id || s.email === id);
  if (!staffProf) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  if (full_name) staffProf.full_name = full_name;
  if (email) staffProf.email = email;
  if (phone) staffProf.phone = phone;
  if (employee_id) staffProf.employee_id = employee_id;
  if (department) staffProf.department = department;
  if (designation) staffProf.designation = designation;
  if (staff_type) staffProf.staff_type = staff_type;
  if (base_station) staffProf.base_station = base_station;
  if (status) staffProf.status = status.toUpperCase();
  if (Array.isArray(permissions)) {
    staffProf.permissions = permissions;
    mockDb.staff_permissions.set(staffProf.id, permissions);
  }

  staffProf.updated_at = new Date().toISOString();
  mockDb.staff_profiles.set(staffProf.id, staffProf);

  const mainProf = mockDb.profiles.get(staffProf.id);
  if (mainProf) {
    if (full_name) mainProf.full_name = full_name;
    if (email) mainProf.email = email;
    if (phone) mainProf.phone = phone;
    if (status) mainProf.status = status.toUpperCase();
    mockDb.profiles.set(staffProf.id, mainProf);
  }

  saveMockDbToFile();
  return res.json({ success: true, message: 'Staff profile updated successfully', staff: staffProf });
});

// DELETE /api/staff/:id - Admin delete/remove staff account
router.delete(['/:id', '/admin-delete/:id'], authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let staffProf = mockDb.staff_profiles.get(id) || Array.from(mockDb.staff_profiles.values()).find(s => s.id === id);
  if (!staffProf) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  mockDb.staff_profiles.delete(staffProf.id);
  mockDb.profiles.delete(staffProf.id);
  saveMockDbToFile();
  return res.json({ success: true, message: `Staff member ${staffProf.full_name} account deleted successfully.` });
});

// PATCH /api/admin/staff/:id/permissions - Admin update staff permissions
router.patch('/admin-permissions/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }

  const staffProf = mockDb.staff_profiles.get(id);
  if (!staffProf) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  staffProf.permissions = permissions;
  staffProf.updated_at = new Date().toISOString();
  mockDb.staff_profiles.set(id, staffProf);
  mockDb.staff_permissions.set(id, permissions);

  // Audit log
  const auditId = 'aud-' + Date.now();
  mockDb.staff_audit_logs.set(auditId, {
    id: auditId,
    staff_id: id,
    actor_id: req.user.id,
    action: 'ADMIN_UPDATED_PERMISSIONS',
    timestamp: new Date().toISOString()
  });

  saveMockDbToFile();
  return res.json({ message: 'Permissions updated successfully', permissions });
});

// PATCH / POST /api/staff/admin-reports/:id/review - Admin review staff daily report
const handleReviewDailyReport = (req, res) => {
  const { id } = req.params;
  const { status, review_comments, admin_remarks, action } = req.body;

  const report = mockDb.staff_daily_reports.get(id);
  if (!report) {
    return res.status(404).json({ error: 'Daily report not found' });
  }

  const isFollowUp = action === 'REQUEST_FOLLOW_UP' || status === 'NEEDS_FOLLOW_UP' || status === 'FOLLOWUP_REQUESTED' || status === 'Needs Follow-up';
  const remarksText = admin_remarks || review_comments || '';

  if (isFollowUp && !remarksText.trim()) {
    return res.status(400).json({ error: 'Admin remarks are required when requesting follow-up.' });
  }

  const updatedStatus = isFollowUp ? 'FOLLOWUP_REQUESTED' : (status ? status.toUpperCase() : 'REVIEWED');
  report.status = updatedStatus;
  report.report_status = updatedStatus;
  report.admin_remarks = remarksText;
  report.review_comments = remarksText;
  report.reviewed_by = req.user.full_name || req.user.id || 'System Admin';
  report.reviewed_at = new Date().toISOString();
  report.updated_at = new Date().toISOString();

  mockDb.staff_daily_reports.set(id, report);

  if (mockDb.staff_audit_logs) {
    const auditId = 'aud-' + Date.now();
    mockDb.staff_audit_logs.set(auditId, {
      id: auditId,
      staff_id: report.staff_id,
      actor_id: req.user.id,
      action: isFollowUp ? 'DAILY_REPORT_FOLLOWUP_REQUESTED' : 'DAILY_REPORT_REVIEWED',
      report_id: id,
      details: remarksText,
      timestamp: new Date().toISOString()
    });
  }

  saveMockDbToFile();
  return res.json({ success: true, message: `Report ${report.status}`, report });
};

router.patch('/admin-reports/:id/review', authenticateToken, requireRoles(['admin']), handleReviewDailyReport);
router.post('/admin-reports/:id/review', authenticateToken, requireRoles(['admin']), handleReviewDailyReport);
router.patch('/daily-reports/:id/review', authenticateToken, requireRoles(['admin']), handleReviewDailyReport);
router.post('/daily-reports/:id/review', authenticateToken, requireRoles(['admin']), handleReviewDailyReport);

// ==========================================
// 6. STAFF TASK ASSIGNMENT & MANAGEMENT
// ==========================================

// GET /api/staff/tasks - Get assigned tasks
router.get('/tasks', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const staffId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const allTasks = Array.from(mockDb.staff_tasks ? mockDb.staff_tasks.values() : []);
  
  let tasks = isAdmin 
    ? allTasks 
    : allTasks.filter(t => 
        t.staff_id === staffId || 
        t.assigned_to_email === req.user.email ||
        t.assigned_to === staffId ||
        (t.staff_name && req.user.full_name && t.staff_name.toLowerCase() === req.user.full_name.toLowerCase())
      );
  
  // If no tasks match specific staff ID (e.g. general assigned tasks or seeded duties),
  // return allTasks so staff sees the tasks assigned from Admin!
  if (!isAdmin && tasks.length === 0 && allTasks.length > 0) {
    tasks = allTasks;
  }

  return res.json(tasks);
});

// POST /api/staff/tasks - Admin create and assign task to staff
router.post('/tasks', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { staff_id, title, description, priority, due_date, task_type, category, instructions } = req.body;
  if (!staff_id || !title) {
    return res.status(400).json({ error: 'Staff member selection and Task title are required' });
  }

  const staffProf = mockDb.staff_profiles.get(staff_id) || 
    Array.from(mockDb.staff_profiles.values()).find(s => s.id === staff_id || s.email === staff_id);

  const taskId = 'tsk-' + Date.now();
  const taskCategory = category || task_type || 'Passenger Support';
  const newTask = {
    id: taskId,
    staff_id,
    staff_name: staffProf ? staffProf.full_name : 'Assigned Staff',
    assigned_to_email: staffProf ? staffProf.email : '',
    title,
    description: description || '',
    priority: (priority || 'MEDIUM').toUpperCase(),
    category: taskCategory,
    task_type: taskCategory,
    due_date: due_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    instructions: instructions || '',
    status: 'Pending',
    remarks: '',
    completion_remarks: '',
    staff_report: null,
    admin_review_status: 'PENDING_REVIEW',
    admin_review_remarks: '',
    assigned_by_admin: req.user.id,
    assigned_by: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    reviewed_by: null,
    reviewed_at: null
  };

  mockDb.staff_tasks.set(taskId, newTask);

  // Record audit log
  if (mockDb.staff_audit_logs) {
    const auditId = 'aud-' + Date.now();
    mockDb.staff_audit_logs.set(auditId, {
      id: auditId,
      staff_id,
      actor_id: req.user.id,
      action: 'TASK_ASSIGNED',
      task_id: taskId,
      details: `Assigned task "${title}"`,
      timestamp: new Date().toISOString()
    });
  }

  saveMockDbToFile();
  return res.status(201).json(newTask);
});

// PATCH /api/staff/tasks/:id - Update task status / remarks / report (Staff or Admin)
router.patch('/tasks/:id', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { id } = req.params;
  const { status, remarks, completion_remarks, staff_report, instructions, due_date, priority, category } = req.body;

  const task = mockDb.staff_tasks ? mockDb.staff_tasks.get(id) : null;
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (req.user.role === 'staff' && task.staff_id !== req.user.id && task.assigned_to_email !== req.user.email) {
    task.staff_id = req.user.id;
    task.staff_name = req.user.full_name || task.staff_name;
    task.assigned_to_email = req.user.email || task.assigned_to_email;
  }

  if (status) {
    task.status = status;
    const normStatus = String(status).toUpperCase().replace(/[\s-]/g, '_');
    if (normStatus === 'IN_PROGRESS' && !task.started_at) {
      task.started_at = new Date().toISOString();
      if (mockDb.staff_audit_logs) {
        const auditId = 'aud-' + Date.now();
        mockDb.staff_audit_logs.set(auditId, {
          id: auditId,
          staff_id: task.staff_id,
          actor_id: req.user.id,
          action: 'TASK_STARTED',
          task_id: id,
          timestamp: new Date().toISOString()
        });
      }
    } else if (['COMPLETED', 'SUBMITTED_FOR_REVIEW'].includes(normStatus)) {
      task.completed_at = new Date().toISOString();
      if (mockDb.staff_audit_logs) {
        const auditId = 'aud-' + Date.now();
        mockDb.staff_audit_logs.set(auditId, {
          id: auditId,
          staff_id: task.staff_id,
          actor_id: req.user.id,
          action: 'TASK_COMPLETED',
          task_id: id,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  if (remarks !== undefined) task.remarks = remarks;
  if (completion_remarks !== undefined) task.completion_remarks = completion_remarks;
  if (staff_report !== undefined) task.staff_report = staff_report;
  if (instructions !== undefined && req.user.role === 'admin') task.instructions = instructions;
  if (due_date !== undefined && req.user.role === 'admin') task.due_date = due_date;
  if (priority !== undefined && req.user.role === 'admin') task.priority = priority.toUpperCase();
  if (category !== undefined && req.user.role === 'admin') {
    task.category = category;
    task.task_type = category;
  }

  task.updated_at = new Date().toISOString();

  mockDb.staff_tasks.set(id, task);
  saveMockDbToFile();

  return res.json({ message: 'Task updated successfully', task });
});

// POST /api/staff/tasks/:id/report - Staff submit task completion report
router.post('/tasks/:id/report', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { id } = req.params;
  const { completion_status, work_performed, findings, remarks, issues_encountered, recommended_followup } = req.body;

  const task = mockDb.staff_tasks ? mockDb.staff_tasks.get(id) : null;
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (req.user.role === 'staff' && task.staff_id !== req.user.id && task.assigned_to_email !== req.user.email) {
    task.staff_id = req.user.id;
    task.staff_name = req.user.full_name || task.staff_name;
    task.assigned_to_email = req.user.email || task.assigned_to_email;
  }

  const workText = work_performed || remarks || '';
  if (!workText.trim()) {
    return res.status(400).json({ error: 'Meaningful work description or remarks are required for completion report' });
  }

  const reportObj = {
    completion_status: completion_status || 'Fully Completed',
    work_performed: work_performed || workText,
    findings: findings || '',
    remarks: remarks || '',
    issues_encountered: issues_encountered || '',
    recommended_followup: recommended_followup || '',
    submitted_at: new Date().toISOString()
  };

  task.staff_report = reportObj;
  task.completion_remarks = workText;
  task.status = 'Submitted for Review';
  task.admin_review_status = 'PENDING_REVIEW';
  task.completed_at = task.completed_at || new Date().toISOString();
  task.updated_at = new Date().toISOString();

  mockDb.staff_tasks.set(id, task);

  if (mockDb.staff_audit_logs) {
    const auditId = 'aud-' + Date.now();
    mockDb.staff_audit_logs.set(auditId, {
      id: auditId,
      staff_id: task.staff_id,
      actor_id: req.user.id,
      action: 'REPORT_SUBMITTED',
      task_id: id,
      timestamp: new Date().toISOString()
    });
  }

  saveMockDbToFile();
  return res.json({ message: 'Completion report submitted successfully', task });
});

// POST /api/staff/tasks/:id/review - Admin review report / request follow-up
router.post('/tasks/:id/review', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { action, status, admin_review_remarks, review_comments } = req.body;

  const task = mockDb.staff_tasks ? mockDb.staff_tasks.get(id) : null;
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const isFollowUp = action === 'REQUEST_FOLLOW_UP' || status === 'NEEDS_FOLLOW_UP' || status === 'Needs Follow-up';
  const remarksText = admin_review_remarks || review_comments || '';

  if (isFollowUp && !remarksText.trim()) {
    return res.status(400).json({ error: 'Admin remarks are required when requesting follow-up.' });
  }

  if (isFollowUp) {
    task.status = 'Needs Follow-up';
    task.admin_review_status = 'NEEDS_FOLLOW_UP';
  } else {
    task.status = 'Reviewed';
    task.admin_review_status = 'REVIEWED';
  }

  task.admin_review_remarks = remarksText;
  task.reviewed_by = req.user.id;
  task.reviewed_at = new Date().toISOString();
  task.updated_at = new Date().toISOString();

  mockDb.staff_tasks.set(id, task);

  if (mockDb.staff_audit_logs) {
    const auditId = 'aud-' + Date.now();
    mockDb.staff_audit_logs.set(auditId, {
      id: auditId,
      staff_id: task.staff_id,
      actor_id: req.user.id,
      action: isFollowUp ? 'FOLLOW_UP_REQUESTED' : 'REPORT_REVIEWED',
      task_id: id,
      details: remarksText,
      timestamp: new Date().toISOString()
    });
  }

  saveMockDbToFile();
  return res.json({ message: isFollowUp ? 'Follow-up requested from staff' : 'Task report marked as reviewed', task });
});

// DELETE /api/staff/tasks/:id - Admin delete task
router.delete('/tasks/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  if (mockDb.staff_tasks && mockDb.staff_tasks.has(id)) {
    mockDb.staff_tasks.delete(id);
    saveMockDbToFile();
    return res.json({ message: 'Task deleted successfully' });
  }
  return res.status(404).json({ error: 'Task not found' });
});

// GET /api/staff/train-service-dates - View centralized service date availability structure (Staff & Admin)
router.get('/train-service-dates', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  try {
    const { train_id, train_number, journey_date, class_code } = req.query;
    let records = Array.from(mockDb.train_service_dates?.values() || []);
    if (train_id) {
      records = records.filter(r => r.train_id === train_id || String(r.train_number) === String(train_id));
    }
    if (train_number) {
      records = records.filter(r => String(r.train_number) === String(train_number));
    }
    if (journey_date) {
      records = records.filter(r => r.journey_date === journey_date);
    }
    if (class_code) {
      records = records.filter(r => String(r.class_code).toUpperCase() === String(class_code).toUpperCase());
    }
    return res.json({
      success: true,
      count: records.length,
      train_service_dates: records
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


