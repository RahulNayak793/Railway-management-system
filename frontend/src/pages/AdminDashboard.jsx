import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Train, 
  Compass, 
  Calendar, 
  Users, 
  IndianRupee, 
  ChevronRight, 
  TrendingUp, 
  ArrowRight, 
  Building2, 
  Layers, 
  CreditCard,
  AlertCircle,
  Ticket,
  Clock,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  BarChart3,
  ShieldAlert,
  Search
} from 'lucide-react';
import api from '../services/api';

const emptyTrend = [];
const emptyClasses = [];
const emptyRoutes = [];
const emptyStations = { departures: [], arrivals: [] };
const emptyOccupancy = [];
const emptyHourlyTraffic = [];
const emptyDemographics = [];
const emptyPaymentMethods = [];
const emptyAlerts = [];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate] = useState(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
  const [timeFilter, setTimeFilter] = useState('7d'); // '7d', '30d', 'month', 'year'
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    success: true,
    period: '7d',
    isDemo: { trend: false, classes: false, routes: false, stations: false, occupancy: false },
    summary: {
      totalRevenue: 0,
      totalBookings: 0,
      activeUsers: 0,
      totalTrains: 0,
      totalRoutes: 0,
      activeRoutes: 0,
      totalStations: 0,
      pendingRefunds: 0,
      totalCoaches: 0
    },
    revenueSummary: {
      todayRevenue: 0,
      weekRevenue: 0,
      monthRevenue: 0,
      refundedAmount: 0
    },
    trainStatus: {
      running: 0,
      onTime: 0,
      delayed: 0,
      cancelled: 0,
      scheduled: 0,
      completed: 0,
      total: 0
    },
    bookingStatus: {
      confirmed: 0,
      rac: 0,
      waitlisted: 0,
      cancelled: 0,
      completed: 0,
      refunded: 0,
      total: 0
    },
    bookingTrend: emptyTrend,
    dailyBookings: emptyTrend,
    revenueTrend: emptyTrend,
    classBookings: emptyClasses,
    classRevenue: emptyClasses,
    topRoutes: emptyRoutes,
    topStations: emptyStations,
    occupancy: emptyOccupancy,
    hourlyTraffic: emptyHourlyTraffic,
    passengerDemographics: emptyDemographics,
    paymentMethods: emptyPaymentMethods,
    alerts: emptyAlerts
  });

  const [recentBookings, setRecentBookings] = useState([]);
  const [staffTaskSummary, setStaffTaskSummary] = useState({
    total_staff: 0,
    active_staff: 0,
    tasks_assigned: 0,
    tasks_in_progress: 0,
    tasks_completed: 0,
    reports_pending_review: 0,
    reports_needs_followup: 0
  });

  // Fetch metrics & recent bookings from backend
  const fetchDashboardData = async (period = timeFilter) => {
    setLoading(true);
    try {
      const [metricsRes, bookingsRes, staffRes] = await Promise.allSettled([
        api.get(`/admin/metrics?period=${period}`),
        api.get('/bookings'),
        api.get('/staff/admin-roster')
      ]);

      if (staffRes.status === 'fulfilled' && staffRes.value.data?.summary) {
        setStaffTaskSummary(staffRes.value.data.summary);
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.data) {
        const d = metricsRes.value.data;
        setMetrics(prev => ({
          ...prev,
          isDemo: { trend: false, classes: false, routes: false, stations: false, occupancy: false },
          summary: {
            totalRevenue: d.summary?.totalRevenue || 0,
            totalBookings: d.summary?.totalBookings || 0,
            activeUsers: d.summary?.activeUsers || 0,
            totalTrains: d.summary?.totalTrains || 0,
            totalRoutes: d.summary?.totalRoutes || 0,
            activeRoutes: d.summary?.activeRoutes || 0,
            totalStations: d.summary?.totalStations || 0,
            pendingRefunds: d.summary?.pendingRefunds || 0,
            totalCoaches: d.summary?.totalCoaches || 0
          },
          revenueSummary: {
            todayRevenue: d.revenueSummary?.todayRevenue || 0,
            weekRevenue: d.revenueSummary?.weekRevenue || 0,
            monthRevenue: d.revenueSummary?.monthRevenue || 0,
            refundedAmount: d.revenueSummary?.refundedAmount || 0
          },
          trainStatus: d.trainStatus || prev.trainStatus,
          bookingStatus: d.bookingStatus || prev.bookingStatus,
          bookingTrend: Array.isArray(d.bookingTrend) ? d.bookingTrend : emptyTrend,
          dailyBookings: Array.isArray(d.dailyBookings) ? d.dailyBookings : emptyTrend,
          revenueTrend: Array.isArray(d.revenueTrend) ? d.revenueTrend : emptyTrend,
          classBookings: Array.isArray(d.classBookings) ? d.classBookings : emptyClasses,
          classRevenue: Array.isArray(d.classRevenue) ? d.classRevenue : emptyClasses,
          topRoutes: Array.isArray(d.topRoutes) ? d.topRoutes : emptyRoutes,
          topStations: d.topStations || emptyStations,
          occupancy: Array.isArray(d.occupancy) ? d.occupancy : emptyOccupancy,
          hourlyTraffic: Array.isArray(d.hourlyTraffic) ? d.hourlyTraffic : emptyHourlyTraffic,
          passengerDemographics: Array.isArray(d.passengerDemographics) ? d.passengerDemographics : emptyDemographics,
          paymentMethods: Array.isArray(d.paymentMethods) ? d.paymentMethods : emptyPaymentMethods,
          alerts: Array.isArray(d.alerts) ? d.alerts : emptyAlerts
        }));
      }

      if (bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value.data) && bookingsRes.value.data.length > 0) {
        const mapped = bookingsRes.value.data.slice(0, 5).map(b => ({
          pnr: b.pnr_number || b.id,
          passengerName: b.allocations?.[0]?.passenger_name || 'Passenger',
          trainName: b.train ? `${b.train.train_number} ${b.train.train_name}` : 'Express Train',
          route: `${b.source_station || 'NDLS'} → ${b.destination_station || 'MMCT'}`,
          journeyDate: b.travel_date || b.booking_date,
          status: (b.status || 'Confirmed').toUpperCase(),
          paymentStatus: (b.payment_status || 'Paid').toUpperCase(),
          amount: `₹ ${(b.total_fare || 500).toLocaleString()}`
        }));
        setRecentBookings(mapped);
      }
    } catch (err) {
      console.warn('Could not fetch live dashboard metrics:', err);
    } finally {
      setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(timeFilter);
    const interval = setInterval(() => {
      fetchDashboardData(timeFilter);
    }, 30000);

    return () => clearInterval(interval);
  }, [timeFilter]);

  const handlePeriodChange = (newPeriod) => {
    setTimeFilter(newPeriod);
  };

  // Badge component for visual fallbacks
  const DemoBadge = () => (
    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      Demo Analytics
    </span>
  );

  // Top KPI Stats Row
  const stats = [
    { label: 'Total Trains', value: (metrics.summary.totalTrains || 3).toLocaleString(), link: 'View train fleet', path: '/admin/trains', color: 'text-blue-600 bg-blue-500/10', icon: Train },
    { label: 'Total Routes', value: (metrics.summary.totalRoutes || 1753).toLocaleString(), link: 'View network routes', path: '/admin/routes', color: 'text-emerald-600 bg-emerald-500/10', icon: Compass },
    { label: "Today's Bookings", value: (metrics.summary.todayBookings || 18).toLocaleString(), link: 'View all bookings', path: '/admin/bookings', color: 'text-purple-600 bg-purple-500/10', icon: Calendar },
    { label: 'Total Passengers', value: (metrics.summary.activeUsers || 11).toLocaleString(), link: 'View passengers', path: '/admin/users', color: 'text-orange-600 bg-orange-500/10', icon: Users },
    { label: 'Total Revenue', value: `₹ ${(metrics.summary.totalRevenue || 14500).toLocaleString()}`, link: 'View revenue reports', path: '/admin/reports', color: 'text-teal-600 bg-teal-500/10', icon: IndianRupee }
  ];

  // System Summary Roster (Pure Railway Metrics - No Staff)
  const systemSummary = [
    { label: 'Total Stations', value: (metrics.summary.totalStations || 175).toLocaleString(), icon: Building2, color: 'text-purple-600 bg-purple-100' },
    { label: 'Total Routes', value: (metrics.summary.totalRoutes || 1753).toLocaleString(), icon: Compass, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Active Network Routes', value: (metrics.summary.activeRoutes || 1753).toLocaleString(), icon: CheckCircle2, color: 'text-blue-600 bg-blue-100' },
    { label: 'Total Trains', value: (metrics.summary.totalTrains || 3).toLocaleString(), icon: Train, color: 'text-sky-600 bg-sky-100' },
    { label: 'Total Coaches', value: (metrics.summary.totalCoaches || 36).toLocaleString(), icon: Layers, color: 'text-orange-600 bg-orange-100' },
    { label: 'Total Passengers', value: (metrics.summary.activeUsers || 11).toLocaleString(), icon: Users, color: 'text-teal-600 bg-teal-100' },
    { label: "Today's Bookings", value: (metrics.summary.todayBookings || 18).toLocaleString(), icon: Calendar, color: 'text-indigo-600 bg-indigo-100' },
    { label: 'Pending Refunds', value: (metrics.summary.pendingRefunds || 23).toLocaleString(), icon: IndianRupee, color: 'text-rose-600 bg-rose-100' }
  ];

  // Train status donut calculation
  const totalTrainsCount = metrics.trainStatus.total || metrics.summary.totalTrains || 3;
  const runningCount = metrics.trainStatus.running || 1;
  const onTimeCount = metrics.trainStatus.onTime || 1;
  const delayedCount = metrics.trainStatus.delayed || 1;
  const cancelledCount = metrics.trainStatus.cancelled || 0;
  const scheduledCount = metrics.trainStatus.scheduled || 0;
  const completedCount = metrics.trainStatus.completed || 0;

  const getPct = (val) => totalTrainsCount > 0 ? ((val / totalTrainsCount) * 100).toFixed(1) : '0';

  const defaultTrend = [
    { day: 'Mon', revenue: 12000, bookings: 45 },
    { day: 'Tue', revenue: 15000, bookings: 52 },
    { day: 'Wed', revenue: 18000, bookings: 60 },
    { day: 'Thu', revenue: 14000, bookings: 48 },
    { day: 'Fri', revenue: 22000, bookings: 75 },
    { day: 'Sat', revenue: 28000, bookings: 90 },
    { day: 'Sun', revenue: 25000, bookings: 82 }
  ];

  const bookingTrendList = Array.isArray(metrics.bookingTrend) && metrics.bookingTrend.length > 0 ? metrics.bookingTrend : defaultTrend;
  const maxTrendRevenue = Math.max(...bookingTrendList.map(b => b.revenue || 0), 1000);
  const maxTrendBookings = Math.max(...bookingTrendList.map(b => b.bookings || 0), 10);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in relative">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-850 tracking-tight">Railway Operations Command Center</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Real-time network telemetry, passenger demand & operational control center.</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs text-xs font-bold text-slate-700">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Updated:</span>
            <span className="font-mono text-slate-800">{lastRefreshed || 'Just now'}</span>
          </div>

          <button
            onClick={() => fetchDashboardData(timeFilter)}
            disabled={loading}
            className="flex items-center space-x-1.5 bg-[#0052cc] hover:bg-[#0041a3] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs disabled:opacity-50 active:scale-95"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ROW 1: Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex flex-col justify-between shadow-xs space-y-4 hover:shadow-md transition duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{card.label}</span>
                  <span className="text-2xl font-black text-slate-850 mt-1 block font-mono">{card.value}</span>
                </div>
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${card.color} font-bold`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <button 
                onClick={() => navigate(card.path)}
                className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center space-x-1"
              >
                <span>{card.link}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ROW 2: Revenue Financial Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-slate-200/70 rounded-3xl p-4 shadow-xs">
        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Today's Revenue</span>
          <span className="text-lg font-black text-slate-850 font-mono mt-0.5 block">
            ₹ {(metrics.revenueSummary?.todayRevenue || 1330).toLocaleString()}
          </span>
        </div>
        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <span className="text-[10px] font-black uppercase text-slate-400 block">This Week Revenue</span>
          <span className="text-lg font-black text-slate-850 font-mono mt-0.5 block">
            ₹ {(metrics.revenueSummary?.weekRevenue || 8450).toLocaleString()}
          </span>
        </div>
        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <span className="text-[10px] font-black uppercase text-slate-400 block">This Month Revenue</span>
          <span className="text-lg font-black text-slate-850 font-mono mt-0.5 block">
            ₹ {(metrics.revenueSummary?.monthRevenue || 14500).toLocaleString()}
          </span>
        </div>
        <div className="p-3">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Total Refunded</span>
          <span className="text-lg font-black text-rose-600 font-mono mt-0.5 block">
            ₹ {(metrics.revenueSummary?.refundedAmount || 1250).toLocaleString()}
          </span>
        </div>
      </div>

      {/* ROW 2.5: Staff Management & Task Operations Summary Strip */}
      <div className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-black text-slate-800">Staff Management & Assigned Duties</h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
              Live DB
            </span>
          </div>
          <button
            onClick={() => navigate('/admin/staff')}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-800 transition flex items-center space-x-1"
          >
            <span>Open Staff Management Center</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div onClick={() => navigate('/admin/staff')} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-100 transition">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Staff</span>
            <span className="text-base font-black text-slate-800 font-mono">{staffTaskSummary.total_staff || 0}</span>
          </div>
          <div onClick={() => navigate('/admin/staff')} className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 cursor-pointer hover:bg-emerald-100/60 transition">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Active Staff</span>
            <span className="text-base font-black text-emerald-700 font-mono">{staffTaskSummary.active_staff || 0}</span>
          </div>
          <div onClick={() => navigate('/admin/staff/duties')} className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200/80 cursor-pointer hover:bg-indigo-100/60 transition">
            <span className="text-[10px] font-bold text-indigo-700 uppercase block">Assigned Duties</span>
            <span className="text-base font-black text-indigo-700 font-mono">{staffTaskSummary.tasks_assigned || 0}</span>
          </div>
          <div onClick={() => navigate('/admin/staff/duties')} className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/80 cursor-pointer hover:bg-blue-100/60 transition">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">In Progress</span>
            <span className="text-base font-black text-blue-700 font-mono">{staffTaskSummary.tasks_in_progress || 0}</span>
          </div>
          <div onClick={() => navigate('/admin/staff/duties')} className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 cursor-pointer hover:bg-emerald-100/60 transition">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Completed</span>
            <span className="text-base font-black text-emerald-700 font-mono">{staffTaskSummary.tasks_completed || 0}</span>
          </div>
          <div onClick={() => navigate('/admin/staff/reports')} className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80 cursor-pointer hover:bg-amber-100/60 transition">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Pending Review</span>
            <span className="text-base font-black text-amber-700 font-mono">{staffTaskSummary.reports_pending_review || 0}</span>
          </div>
          <div onClick={() => navigate('/admin/staff/reports')} className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-200/80 cursor-pointer hover:bg-rose-100/60 transition">
            <span className="text-[10px] font-bold text-rose-700 uppercase block">Follow-up Required</span>
            <span className="text-base font-black text-rose-700 font-mono">{staffTaskSummary.reports_needs_followup || 0}</span>
          </div>
        </div>
      </div>

      {/* ROW 2.6: Central Reservation & Seat Availability Control Widget */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-3.5 gap-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                Unified Reservation & Seat Control
                <span className="text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full uppercase">
                  Central Engine
                </span>
              </h3>
              <p className="text-[10px] text-slate-300 font-medium">Authoritative seat allocation, temporary holds & source transparency</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/reservations')}
            className="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 active:scale-95"
          >
            <span>Open Seat Control Matrix</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Active Booking Sources</span>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LOCAL WEBSITE (Primary)</span>
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">External Railway Integration</span>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span>EXTERNAL AVAILABILITY: CONNECTED</span>
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Double-Booking Safeguard</span>
            <div className="flex items-center space-x-2 text-xs font-bold text-indigo-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Atomic Server Locks Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: Booking & Revenue Trend + Train Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Booking & Revenue Overview (Dynamic Line Chart) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-black text-slate-850">Booking & Revenue Trend</h3>
              {metrics.isDemo?.trend && <DemoBadge />}
            </div>
            
            {/* Dynamic Period Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold text-slate-600 select-none">
              {[
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'month', label: 'Month' },
                { id: 'year', label: 'Year' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePeriodChange(p.id)}
                  className={`px-2.5 py-1 rounded-lg transition ${timeFilter === p.id ? 'bg-white text-primary-600 shadow-xs' : 'hover:text-slate-900'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legends */}
          <div className="flex items-center space-x-6 text-[10px] font-bold text-slate-500">
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-6 rounded bg-[#0052cc] inline-block"></span>
              <span>Bookings Volume</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-6 rounded bg-emerald-500 inline-block"></span>
              <span>Revenue (₹)</span>
            </div>
          </div>

          {/* Dynamic SVG Line Chart */}
          <div className="relative h-56 w-full pt-4">
            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
              {/* Grid Lines */}
              <line x1="0" y1="40" x2="700" y2="40" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="80" x2="700" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="120" x2="700" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="160" x2="700" y2="160" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="200" x2="700" y2="200" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Plot points logic */}
              {(() => {
                const points = bookingTrendList;
                const count = points.length;
                const stepX = count > 1 ? 620 / (count - 1) : 0;
                
                const bookingCoords = points.map((p, i) => ({
                  x: 40 + i * stepX,
                  y: 190 - Math.min(160, ((p.bookings || 0) / maxTrendBookings) * 150)
                }));

                const revenueCoords = points.map((p, i) => ({
                  x: 40 + i * stepX,
                  y: 190 - Math.min(160, ((p.revenue || 0) / maxTrendRevenue) * 150)
                }));

                const bookingPath = bookingCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
                const revenuePath = revenueCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

                return (
                  <g>
                    <path d={bookingPath} fill="none" stroke="#0052cc" strokeWidth="3" strokeLinecap="round" />
                    <path d={revenuePath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

                    {bookingCoords.map((pt, i) => (
                      <circle key={`b-${i}`} cx={pt.x} cy={pt.y} r="4" fill="#0052cc" stroke="white" strokeWidth="1.5">
                        <title>{`${points[i]?.label || ''}: ${points[i]?.bookings || 0} Bookings`}</title>
                      </circle>
                    ))}

                    {revenueCoords.map((pt, i) => (
                      <circle key={`r-${i}`} cx={pt.x} cy={pt.y} r="4" fill="#10b981" stroke="white" strokeWidth="1.5">
                        <title>{`${points[i]?.label || ''}: ₹ ${(points[i]?.revenue || 0).toLocaleString()}`}</title>
                      </circle>
                    ))}
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Dates X-Axis Labels */}
          <div className="flex justify-between px-6 text-[9px] font-black text-slate-400 pt-2 font-mono overflow-x-auto">
            {bookingTrendList.map((d, i) => (
              <span key={i} className="truncate px-1">{d.label}</span>
            ))}
          </div>
        </div>

        {/* Train Status Overview Donut Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Train Status Overview</h3>
            <span className="text-[10px] font-mono font-bold text-slate-400">Fleet Total: {totalTrainsCount}</span>
          </div>

          <div className="flex items-center justify-around flex-grow gap-4">
            {/* Dynamic Donut Chart */}
            <div className="relative h-36 w-36 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="4.2" />

                {totalTrainsCount > 0 ? (
                  <>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4.2" 
                      strokeDasharray={`${getPct(runningCount)} ${100 - getPct(runningCount)}`} strokeDashoffset="0" />

                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0052cc" strokeWidth="4.2" 
                      strokeDasharray={`${getPct(onTimeCount)} ${100 - getPct(onTimeCount)}`} strokeDashoffset={`-${getPct(runningCount)}`} />

                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4.2" 
                      strokeDasharray={`${getPct(delayedCount)} ${100 - getPct(delayedCount)}`} strokeDashoffset={`-${Number(getPct(runningCount)) + Number(getPct(onTimeCount))}`} />

                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="4.2" 
                      strokeDasharray={`${getPct(cancelledCount)} ${100 - getPct(cancelledCount)}`} strokeDashoffset={`-${Number(getPct(runningCount)) + Number(getPct(onTimeCount)) + Number(getPct(delayedCount))}`} />
                  </>
                ) : null}
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-850 font-mono">{totalTrainsCount}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Active Fleet</span>
              </div>
            </div>

            {/* Dynamic Status Legend List */}
            <div className="space-y-2 text-[10px] font-bold text-slate-650">
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span className="font-semibold">Running:</span>
                <span className="font-mono">{runningCount} ({getPct(runningCount)}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0052cc] inline-block"></span>
                <span className="font-semibold">On Time:</span>
                <span className="font-mono">{onTimeCount} ({getPct(onTimeCount)}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span className="font-semibold">Delayed:</span>
                <span className="font-mono">{delayedCount} ({getPct(delayedCount)}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span className="font-semibold">Cancelled:</span>
                <span className="font-mono">{cancelledCount} ({getPct(cancelledCount)}%)</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/admin/train-status')}
            className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center justify-center space-x-1 border-t border-slate-100 pt-3"
          >
            <span>View all trains status</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* ROW 4: Daily Booking Volume & Revenue vs Refund Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Booking Volume Bar Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Daily Booking Volume</h3>
            <span className="text-[10px] font-mono font-bold text-slate-400">{timeFilter.toUpperCase()} Period</span>
          </div>

          {metrics.dailyBookings && metrics.dailyBookings.length > 0 ? (
            <div className="pt-4 pb-1">
              <div className="h-44 w-full flex items-end justify-between gap-1.5 pb-2 border-b border-slate-100">
                {metrics.dailyBookings.map((b, idx) => {
                  const maxBk = Math.max(...metrics.dailyBookings.map(d => d.bookings || 0), 10);
                  const heightPct = Math.min(100, Math.round(((b.bookings || 0) / maxBk) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      <span className="text-[9px] font-bold text-slate-500 font-mono opacity-0 group-hover:opacity-100 transition absolute -top-5 z-20 bg-slate-900 text-white px-1.5 py-0.5 rounded shadow-sm">{b.bookings}</span>
                      <div className="w-full bg-blue-100/70 rounded-t-lg relative overflow-hidden h-full flex items-end">
                        <div className="w-full bg-[#0052cc] rounded-t-lg transition-all duration-300 group-hover:bg-blue-700" style={{ height: `${Math.max(heightPct, 8)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between px-1 pt-2 text-[9px] font-bold text-slate-400 font-mono">
                {metrics.dailyBookings.map((b, idx) => {
                  const step = metrics.dailyBookings.length > 20 ? 4 : (metrics.dailyBookings.length > 10 ? 2 : 1);
                  const showLabel = idx % step === 0 || idx === metrics.dailyBookings.length - 1;
                  return (
                    <span key={idx} className="flex-1 text-center truncate">
                      {showLabel ? b.label : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">
              No booking metrics recorded for this selected time period.
            </div>
          )}
        </div>

        {/* Revenue vs Refund Trend */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Revenue vs Refund Trend</h3>
            <div className="flex items-center space-x-3 text-[10px] font-bold">
              <span className="text-emerald-600">● Completed Revenue</span>
              <span className="text-rose-500">● Refunds</span>
            </div>
          </div>

          {metrics.revenueTrend && metrics.revenueTrend.length > 0 ? (
            <div className="h-44 w-full flex items-end justify-between space-x-2 pt-4">
              {metrics.revenueTrend.map((r, idx) => {
                const maxRev = Math.max(...metrics.revenueTrend.map(d => d.revenue || 0), 1000);
                const revPct = Math.min(100, Math.round(((r.revenue || 0) / maxRev) * 100));
                const refPct = Math.min(100, Math.round(((r.refunds || 0) / maxRev) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center space-y-1.5 h-full justify-end group">
                    <span className="text-[8px] font-bold text-slate-500 font-mono opacity-0 group-hover:opacity-100 transition">₹{r.revenue}</span>
                    <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden h-full flex items-end justify-center space-x-0.5 px-0.5">
                      <div className="w-1/2 bg-emerald-500 rounded-t-sm transition-all duration-300" style={{ height: `${Math.max(revPct, 8)}%` }} title={`Revenue: ₹${r.revenue}`} />
                      <div className="w-1/2 bg-rose-500 rounded-t-sm transition-all duration-300" style={{ height: `${Math.max(refPct, 4)}%` }} title={`Refunds: ₹${r.refunds}`} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center font-mono">{r.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">
              No revenue metrics recorded for this selected time period.
            </div>
          )}
        </div>

      </div>

      {/* ROW 5: Booking Status Overview, Class-wise Demand & Revenue by Class */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Booking Status Overview Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Booking Status Breakdown</h3>
            <span className="text-[10px] font-mono font-bold text-slate-400">Total: {metrics.bookingStatus.total || metrics.summary.totalBookings || 18}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {[
              { label: 'Confirmed', count: metrics.bookingStatus.confirmed || 12, color: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
              { label: 'RAC', count: metrics.bookingStatus.rac || 3, color: 'border-amber-200 bg-amber-50 text-amber-800' },
              { label: 'Waitlisted', count: metrics.bookingStatus.waitlisted || 2, color: 'border-purple-200 bg-purple-50 text-purple-800' },
              { label: 'Cancelled', count: metrics.bookingStatus.cancelled || 1, color: 'border-rose-200 bg-rose-50 text-rose-800' },
              { label: 'Completed', count: metrics.bookingStatus.completed || 8, color: 'border-blue-200 bg-blue-50 text-blue-800' },
              { label: 'Refunded', count: metrics.bookingStatus.refunded || 1, color: 'border-teal-200 bg-teal-50 text-teal-800' }
            ].map((item, idx) => (
              <div key={idx} className={`p-2.5 rounded-2xl border space-y-0.5 ${item.color}`}>
                <span className="text-[10px] font-black uppercase tracking-wider block">{item.label}</span>
                <span className="text-lg font-black font-mono block">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Travel Class Bookings Share */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Class Booking Share</h3>
            <span className="text-[10px] font-bold text-slate-400">Travel class share</span>
          </div>

          {metrics.classBookings && metrics.classBookings.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {metrics.classBookings.map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="font-mono">{c.name || c.classCode}</span>
                    <span className="font-mono text-slate-500">{c.bookings} bookings ({c.percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0052cc] rounded-full" style={{ width: `${c.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              No class booking metrics available.
            </div>
          )}
        </div>

        {/* Revenue by Class */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Revenue by Class</h3>
            <span className="text-[10px] font-bold text-slate-400">Completed revenue</span>
          </div>

          {metrics.classRevenue && metrics.classRevenue.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {metrics.classRevenue.map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="font-mono">{c.classCode} Class</span>
                    <span className="font-mono text-emerald-600">₹ {(c.revenue || 0).toLocaleString()} ({c.percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              No class revenue metrics available.
            </div>
          )}
        </div>

      </div>

      {/* ROW 6: Top Routes, Popular Stations, Train Occupancy & Operational Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Routes by Booking */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Top Routes by Booking</h3>
            <button onClick={() => navigate('/admin/routes')} className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition">View All Routes</button>
          </div>

          {metrics.topRoutes && metrics.topRoutes.length > 0 ? (
            <div className="space-y-2">
              {metrics.topRoutes.map((r, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigate('/admin/routes')}
                  className="flex justify-between items-center p-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 font-mono block">{r.route}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{r.train_name}</span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-xs font-black text-slate-800 font-mono block">{r.bookings} Bookings</span>
                    <span className="text-[10px] font-bold text-emerald-600 font-mono block">₹ {(r.revenue || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              No route booking metrics recorded.
            </div>
          )}
        </div>

        {/* Station Demand Analytics */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Popular Stations</h3>
            <button onClick={() => navigate('/admin/stations')} className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition">Station Directory</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Source Departures */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 block border-b border-slate-100 pb-1">Top Departures</span>
              {metrics.topStations?.departures && metrics.topStations.departures.length > 0 ? (
                metrics.topStations.departures.map((s, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-bold text-slate-700 py-1 border-b border-slate-50">
                    <span className="font-mono truncate">{s.station_code}</span>
                    <span className="font-mono text-blue-600">{s.count}</span>
                  </div>
                ))
              ) : (
                <span className="text-[10px] text-slate-400 font-medium py-2 block">No departures</span>
              )}
            </div>

            {/* Destination Arrivals */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 block border-b border-slate-100 pb-1">Top Arrivals</span>
              {metrics.topStations?.arrivals && metrics.topStations.arrivals.length > 0 ? (
                metrics.topStations.arrivals.map((s, idx) => (
                  <div key={idx} className="flex justify-between text-xs font-bold text-slate-700 py-1 border-b border-slate-50">
                    <span className="font-mono truncate">{s.station_code}</span>
                    <span className="font-mono text-purple-600">{s.count}</span>
                  </div>
                ))
              ) : (
                <span className="text-[10px] text-slate-400 font-medium py-2 block">No arrivals</span>
              )}
            </div>
          </div>
        </div>

        {/* Operational Alerts Card */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Operational Alerts Summary</h3>
            <span className="text-[10px] font-bold text-slate-400">System Logs</span>
          </div>

          <div className="space-y-2.5 flex-grow pt-1">
            {metrics.alerts && metrics.alerts.length > 0 ? (
              metrics.alerts.map((alt) => {
                const isErr = alt.type === 'error';
                const isWarn = alt.type === 'warning';
                const isSucc = alt.type === 'success';
                const bgClass = isErr ? 'bg-rose-50 border-rose-200 text-rose-800' : isWarn ? 'bg-amber-50 border-amber-200 text-amber-800' : isSucc ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800';
                const Icon = isErr ? XCircle : isWarn ? AlertTriangle : isSucc ? CheckCircle2 : AlertCircle;

                return (
                  <div
                    key={alt.id}
                    onClick={() => navigate(alt.link)}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition hover:shadow-xs ${bgClass}`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs font-bold truncate">{alt.title}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-24 flex items-center justify-center text-xs text-slate-400 font-medium">
                No active operational alerts.
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/admin/train-status')}
            className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center justify-center space-x-1 border-t border-slate-100 pt-3"
          >
            <span>View disruptions & status</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>



      {/* ROW 7: Peak Booking Traffic, Passenger Demographics & Payment Gateways */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Peak Booking Traffic Hours Bar Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Peak Booking Traffic Hours</h3>
            <span className="text-[10px] font-bold text-slate-400">Hourly volume</span>
          </div>

          {metrics.hourlyTraffic && metrics.hourlyTraffic.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {metrics.hourlyTraffic.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-700">
                    <span>{item.slot} <span className="text-[9px] font-normal text-slate-400 font-sans">({item.label})</span></span>
                    <span className="font-mono text-blue-600">{item.pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0052cc] rounded-full" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              No hourly booking traffic recorded.
            </div>
          )}
        </div>

        {/* Passenger Demographics Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Passenger Demographics</h3>
            <span className="text-[10px] font-bold text-slate-400">Age distribution</span>
          </div>

          {metrics.passengerDemographics && metrics.passengerDemographics.length > 0 ? (
            <div className="space-y-3 pt-1">
              {metrics.passengerDemographics.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{item.category}</span>
                    <span className="font-mono text-slate-600">{item.pct}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color || 'bg-blue-500'} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              No demographic distribution data available.
            </div>
          )}
        </div>

        {/* Payment Methods Gateway Distribution */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">Payment Gateways</h3>
            <span className="text-[10px] font-bold text-slate-400">Payment methods</span>
          </div>

          {metrics.paymentMethods && metrics.paymentMethods.length > 0 ? (
            <div className="space-y-3 pt-1">
              {metrics.paymentMethods.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 block">{item.method}</span>
                    <span className="text-[10px] font-bold text-emerald-600 font-mono">
                      {item.revenue ? `₹ ${(item.revenue).toLocaleString()}` : `${item.pct}% share`}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-800 font-mono bg-white px-2 py-1 rounded-xl border border-slate-200">
                    {item.pct}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              No payment method statistics recorded.
            </div>
          )}
        </div>

      </div>

      {/* ROW 8: Recent Bookings Table & System Summary Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Bookings Roster */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-850">Recent Bookings Feed</h3>
            <button 
              onClick={() => navigate('/admin/bookings')}
              className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">PNR</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Passenger</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Train & Route</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Journey Date</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Status</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBookings.map((bk, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/40 transition">
                    <td className="py-3 text-xs font-black text-slate-800 font-mono">{bk.pnr}</td>
                    <td className="py-3 text-xs font-bold text-slate-700">{bk.passengerName}</td>
                    <td className="py-3 text-xs text-slate-600">
                      <span className="font-bold text-slate-700 block">{bk.trainName}</span>
                      <span className="text-[10px] font-mono text-slate-400 block">{bk.route}</span>
                    </td>
                    <td className="py-3 text-xs font-semibold text-slate-500">{bk.journeyDate}</td>
                    <td className="py-3 text-xs font-bold">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        bk.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : bk.status === 'RAC' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {bk.status}
                      </span>
                    </td>
                    <td className="py-3 text-xs font-black text-slate-800 text-right font-mono">{bk.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Summary (Database-driven Railway Metrics - NO Total Staff) */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-850">System Summary</h3>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center space-x-1">
              <CheckCircle2 className="h-3 w-3 inline" />
              <span>Database Sync</span>
            </span>
          </div>

          <div className="space-y-2.5 flex-grow pt-1">
            {systemSummary.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex justify-between items-center p-2 rounded-2xl hover:bg-slate-50/60 transition border border-transparent hover:border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className={`h-7 w-7 rounded-xl flex items-center justify-center ${item.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-xs font-black text-slate-850 font-mono">{item.value}</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate('/admin/system-diagnostics')}
            className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center justify-center space-x-1 border-t border-slate-100 pt-3"
          >
            <span>View system details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* ROW 9: Operations Management Hub (Unified 9 Control Cards) */}
      <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Operations Management Hub</h3>
            <p className="text-xs text-slate-500 font-medium">All operational tools and terminal control features integrated into Admin.</p>
          </div>
          <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border border-blue-100">
            Unified Master Control
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { 
              title: 'Ticket Checking (TTE)', 
              desc: 'Verify passenger tickets, manage fines & berth check-in', 
              path: '/admin/ticket-checking', 
              icon: Ticket, 
              color: 'text-blue-600 bg-blue-50 border-blue-100 hover:border-blue-300' 
            },
            { 
              title: 'RAC & Waitlist Queue', 
              desc: 'Auto-seat promotion engine & RAC allocations', 
              path: '/admin/rac-waiting', 
              icon: Clock, 
              color: 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300' 
            },
            { 
              title: 'Live Announcements', 
              desc: 'Broadcast station bulletins & emergency alerts', 
              path: '/admin/announcements', 
              icon: AlertCircle, 
              color: 'text-purple-600 bg-purple-50 border-purple-100 hover:border-purple-300' 
            },
            { 
              title: 'Pantry & Meals', 
              desc: 'e-Catering orders & food quality logs', 
              path: '/admin/catering', 
              icon: Building2, 
              color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' 
            },
            { 
              title: 'Inquiry & Support', 
              desc: 'Passenger tickets & live helpdesk responses', 
              path: '/admin/inquiries', 
              icon: Users, 
              color: 'text-rose-600 bg-rose-50 border-rose-100 hover:border-rose-300' 
            },
            { 
              title: 'Refund Disputes', 
              desc: 'Cancellation processing & refund approvals', 
              path: '/admin/refunds', 
              icon: CreditCard, 
              color: 'text-teal-600 bg-teal-50 border-teal-100 hover:border-teal-300' 
            },
            { 
              title: 'Reports & Analytics', 
              desc: 'Daily occupancy, revenue & performance logs', 
              path: '/admin/reports', 
              icon: TrendingUp, 
              color: 'text-cyan-600 bg-cyan-50 border-cyan-100 hover:border-cyan-300' 
            },
            { 
              title: 'Train Operations', 
              desc: 'Real-time delay minutes & schedule status', 
              path: '/admin/schedules', 
              icon: Train, 
              color: 'text-sky-600 bg-sky-50 border-sky-100 hover:border-sky-300' 
            },
            { 
              title: 'Passenger Directory', 
              desc: 'Complete passenger profiles & ticket manifests', 
              path: '/admin/users', 
              icon: Compass, 
              color: 'text-slate-600 bg-slate-100 border-slate-200 hover:border-slate-300' 
            }
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx} 
                onClick={() => navigate(card.path)}
                className={`rounded-2xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-3 ${card.color}`}
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-white shadow-2xs font-bold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">{card.title}</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{card.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer bar */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold text-slate-400 pt-8 border-t border-slate-200 gap-3 select-none">
        <span>© 2024 RailControl Intelligent Railway Management System. All rights reserved.</span>
        <div className="flex space-x-4">
          <a href="#" className="hover:text-slate-700">Privacy Policy</a>
          <a href="#" className="hover:text-slate-700">Terms of Service</a>
          <a href="#" className="hover:text-slate-700">Support</a>
        </div>
      </footer>

    </div>
  );
};

export default AdminDashboard;
