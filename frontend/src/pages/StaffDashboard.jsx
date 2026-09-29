import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Train, Ticket, Clock, ShieldAlert, FileText, Utensils, 
  MapPin, CheckCircle, AlertTriangle, RefreshCw, Activity, User, ChevronRight, Send,
  MessageSquare, Bell, Calendar, Search, Layers, CheckSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState({
    todays_duty: {},
    assigned_train: '12951 - Rajdhani Express',
    current_station: 'NDLS',
    assigned_tasks_count: 5,
    active_bookings_count: 18,
    todays_verifications: 14,
    assigned_trains_count: 3,
    pending_service_requests: 2,
    pending_reports: 0,
    total_trains: 5,
    active_incidents: 1,
    delayed_trains: 2
  });

  const [dutyStatus, setDutyStatus] = useState('ON DUTY');
  const [loading, setLoading] = useState(true);
  const [quickPnr, setQuickPnr] = useState('');
  const [pnrResult, setPnrResult] = useState(null);

  // Dynamic data lists fetched from backend APIs
  const [tasks, setTasks] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [trainInfo, setTrainInfo] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, tasksRes, bookingsRes, serviceRes, trainsRes] = await Promise.allSettled([
        api.get('/staff/dashboard'),
        api.get('/staff/tasks'),
        api.get('/staff/bookings'),
        api.get('/staff/service-requests'),
        api.get('/staff/trains')
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        setData(prev => ({ ...prev, ...dashRes.value.data }));
        if (dashRes.value.data.todays_duty?.duty_status) {
          setDutyStatus(dashRes.value.data.todays_duty.duty_status);
        }
      }

      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value.data)) {
        setTasks(tasksRes.value.data);
      }

      if (bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value.data)) {
        const mappedBookings = bookingsRes.value.data.slice(0, 5).map(b => {
          const trainStr = typeof b.train === 'object' && b.train !== null
            ? (b.train.train_name ? `${b.train.train_number || ''} ${b.train.train_name}`.trim() : (b.train.train_number || 'Express Special'))
            : String(b.train || b.train_number || 'Express Special');
          const passName = b.passenger_name || b.passenger || b.allocations?.[0]?.passenger_name || b.user_email || 'Passenger';
          const seatStr = b.allocations?.[0]?.seat_number ? `Seat #${b.allocations[0].seat_number}` : (b.seat || 'Allocated Seat');
          return {
            id: b.id || b.pnr_number || Math.random().toString(),
            pnr: b.pnr_number || b.pnr || b.id || 'PNR-RECORD',
            passenger: passName,
            train: trainStr,
            seat: seatStr,
            status: String(b.status || 'CONFIRMED').toUpperCase()
          };
        });
        setRecentBookings(mappedBookings);
      }

      if (trainsRes.status === 'fulfilled' && Array.isArray(trainsRes.value.data)) {
        const mappedTrains = trainsRes.value.data.slice(0, 5).map(t => ({
          id: t.id || t.train_number || Math.random().toString(),
          number: t.train_number || '12051',
          name: t.train_name || 'Express Special',
          status: String(t.status || 'ON TIME').toUpperCase(),
          route: `${t.source || t.source_station_code || 'NDLS'} → ${t.destination || t.destination_station_code || 'MMCT'}`,
          bookings: t.bookings_count || 120
        }));
        setTrainInfo(mappedTrains);
      }

      if (serviceRes.status === 'fulfilled' && Array.isArray(serviceRes.value.data)) {
        const mappedService = serviceRes.value.data.slice(0, 5).map(s => ({
          id: s.id || Math.random().toString(),
          category: s.category || s.request_type || s.issue_type || 'Passenger Assistance',
          pnr: s.pnr_number || s.pnr || 'PNR-SERVICE',
          time: s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
          status: String(s.status || 'PENDING').toUpperCase()
        }));
        setServiceRequests(mappedService);
      }

      const notifRes = await api.get('/staff/notifications').catch(() => ({ data: [] }));
      if (Array.isArray(notifRes.data)) {
        const mappedNotifs = notifRes.data.slice(0, 5).map(n => ({
          id: n.id || Math.random().toString(),
          message: n.message || n.title || 'System Notification',
          time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
        }));
        setNotifications(mappedNotifs);
      }
    } catch (err) {
      console.warn('Could not fetch staff dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTaskStatusToggle = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'In Progress' : currentStatus === 'In Progress' ? 'Completed' : 'Pending';
    try {
      await api.patch(`/staff/tasks/${taskId}`, { status: nextStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.warn('Failed to update task status:', err.message);
    }
  };

  const handleDutyStatusToggle = async (newStatus) => {
    setDutyStatus(newStatus);
    try {
      await api.put('/staff/duty-status', { duty_status: newStatus });
    } catch (err) {
      console.warn('Failed to update duty status on backend:', err.message);
    }
  };

  const handleQuickVerify = async (e) => {
    e.preventDefault();
    if (!quickPnr) return;
    try {
      const res = await api.post('/staff/ticket/verify', { pnr: quickPnr, checked_status: true });
      setPnrResult(res.data);
    } catch (err) {
      setPnrResult({
        valid: false,
        error: err.response?.data?.error || 'Verification failed. Ticket not found.'
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-8 animate-slide-in">
      
      {/* HEADER BAR */}
      <div className="bg-gradient-to-r from-[#0b1424] via-[#0d2a4a] to-[#0e3c6b] rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-700/50">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500 text-white font-black text-[9px] uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              ● Website Operations Portal
            </span>
            <span className="text-xs text-slate-300 font-mono">Staff ID: {user?.employee_id || 'EMP-10001'}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Staff Operations Dashboard</h1>
          <p className="text-xs text-slate-300 font-medium">Authorized railway website operations, passenger support and assigned work.</p>
        </div>

        {/* WEBSITE AVAILABILITY STATUS */}
        <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10 flex items-center space-x-2">
          <span className="text-[10px] font-black uppercase text-slate-300 px-2">Availability:</span>
          {['ON DUTY', 'ON BREAK', 'OFF DUTY'].map(st => (
            <button
              key={st}
              onClick={() => handleDutyStatusToggle(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dutyStatus === st 
                  ? st === 'ON DUTY' ? 'bg-emerald-500 text-white shadow-md' : 'bg-amber-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 block">My Assigned Tasks</span>
          <p className="text-2xl font-black text-blue-600">{tasks.length}</p>
          <span className="text-[10px] text-blue-500 font-bold">● Total Delegated</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Pending Tasks</span>
          <p className="text-2xl font-black text-amber-600">{tasks.filter(t => t.status !== 'Completed').length}</p>
          <span className="text-[10px] text-amber-500 font-bold">● Active Workload</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Today's Bookings</span>
          <p className="text-2xl font-black text-slate-800">{data.active_bookings_count}</p>
          <span className="text-[10px] text-slate-500 font-bold">● Website Database</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Today's PNR Checks</span>
          <p className="text-2xl font-black text-emerald-600">{data.todays_verifications}</p>
          <span className="text-[10px] text-emerald-600 font-bold">● Tickets Checked</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Pending Requests</span>
          <p className="text-2xl font-black text-indigo-600">{data.pending_service_requests}</p>
          <span className="text-[10px] text-indigo-500 font-bold">● Service Desk</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 block">Today's Report Status</span>
          <p className="text-xs font-black text-rose-600 uppercase mt-2">
            {data.pending_reports > 0 ? 'Submitted' : 'Pending Filing'}
          </p>
          <span className="text-[10px] text-rose-500 font-bold">● Shift Daily Log</span>
        </div>
      </div>

      {/* DASHBOARD SECTIONS A to I */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* SECTION A: MY ASSIGNED TASKS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <CheckSquare className="h-4 w-4 text-blue-600" />
              <span>A. My Assigned Tasks</span>
            </h3>
            <button onClick={() => navigate('/staff/tasks')} className="text-[11px] font-bold text-blue-600 hover:underline">
              View All Tasks ({tasks.length})
            </button>
          </div>

          {/* Quick Nav to Seat Monitoring */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 p-3.5 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Layers className="h-4 w-4 text-indigo-600" />
              <div>
                <span className="text-xs font-black text-indigo-950 block">Reservation & Seat Monitoring</span>
                <span className="text-[10px] text-indigo-700 font-semibold">Central seat matrix & coach occupancy</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/staff/reservations')}
              className="text-[10px] font-extrabold bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-700 transition"
            >
              Monitor Seats
            </button>
          </div>

          <div className="space-y-2.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center font-medium">No tasks currently assigned by Admin.</p>
            ) : (
              tasks.map(t => (
                <div key={t.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-800">{t.title}</p>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className={`font-bold ${t.priority === 'HIGH' ? 'text-rose-600' : 'text-amber-600'}`}>
                        Priority: {t.priority}
                      </span>
                      {t.due_date && <span className="text-slate-400 font-mono">• Due: {t.due_date}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTaskStatusToggle(t.id, t.status)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                      t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' :
                      t.status === 'In Progress' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                    title="Click to update task status"
                  >
                    {t.status}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION B: RECENT PASSENGER BOOKINGS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <Ticket className="h-4 w-4 text-emerald-600" />
              <span>B. Recent Passenger Bookings</span>
            </h3>
            <button onClick={() => navigate('/staff/manifest')} className="text-[11px] font-bold text-blue-600 hover:underline">
              View All
            </button>
          </div>

          <div className="space-y-2.5">
            {recentBookings.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                No recent passenger bookings recorded
              </div>
            ) : (
              recentBookings.map(b => (
                <div key={b.pnr} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{b.passenger}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      PNR: {b.pnr} • {typeof b.train === 'object' && b.train !== null ? (b.train.train_name || b.train.train_number || 'Express Special') : String(b.train || 'Express Special')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-700 block">{b.seat}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">{b.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION C: ASSIGNED TRAIN INFORMATION */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <Train className="h-4 w-4 text-indigo-600" />
              <span>C. Assigned Train Information</span>
            </h3>
            <button onClick={() => navigate('/staff/trains')} className="text-[11px] font-bold text-blue-600 hover:underline">
              Manage
            </button>
          </div>

          <div className="space-y-2.5">
            {trainInfo.map(t => (
              <div key={t.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between font-extrabold text-slate-800">
                  <span>{t.number} - {t.name}</span>
                  <span className="text-[10px] text-blue-600">{t.status}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Route: {t.route}</span>
                  <span>Bookings: {t.bookings}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* LOWER GRID: SECTIONS D, E, F, G, H, I */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* SECTION D: PNR / TICKET VERIFICATION CARD */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 md:col-span-2">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <Search className="h-4 w-4 text-blue-600" />
              <span>D. PNR / Ticket Verification</span>
            </h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">Website DB Lookup</span>
          </div>

          <form onSubmit={handleQuickVerify} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter 10-digit PNR number stored in system..."
              value={quickPnr}
              onChange={(e) => setQuickPnr(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition"
            >
              Verify Record
            </button>
          </form>

          {pnrResult && (
            <div className={`p-4 rounded-2xl border text-xs font-medium space-y-2 animate-scale-in ${
              pnrResult.valid 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex justify-between items-center font-bold">
                <span>PNR: {pnrResult.pnr || quickPnr}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  pnrResult.valid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                  {pnrResult.status || (pnrResult.valid ? 'VALID RECORD' : 'INVALID')}
                </span>
              </div>
              {pnrResult.valid ? (
                <p>Passenger: <strong>{pnrResult.passenger_name}</strong> • Travel Date: <strong>{pnrResult.travel_date}</strong> • Status: <strong>{pnrResult.status_badge}</strong></p>
              ) : (
                <p>{pnrResult.error}</p>
              )}
            </div>
          )}
        </div>

        {/* SECTION E: RAC / WAITING LIST SUMMARY */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>E. RAC / Waiting List Summary</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
              <span className="text-[10px] text-amber-800 font-bold uppercase block">RAC Bookings</span>
              <span className="text-xl font-black text-amber-900">12</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Waitlisted</span>
              <span className="text-xl font-black text-slate-800">28</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Automatic berth allocations are processed upon booking cancellations.</p>
        </div>

        {/* SECTION G: PASSENGER SERVICE REQUESTS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <span>G. Passenger Service Requests</span>
            </h3>
            <button onClick={() => navigate('/staff/service-requests')} className="text-[11px] font-bold text-blue-600 hover:underline">
              Handle
            </button>
          </div>

          <div className="space-y-2">
            {serviceRequests.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                No pending passenger service requests
              </div>
            ) : (
              serviceRequests.map(s => (
                <div key={s.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{s.category}</p>
                    <p className="text-[10px] text-slate-400">PNR: {s.pnr} • {s.time}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {s.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION H: RECENT SYSTEM NOTIFICATIONS & SECTION I: DAILY REPORT STATUS */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center space-x-2">
              <Bell className="h-4 w-4 text-purple-600" />
              <span>H. System Notifications</span>
            </h3>
          </div>

          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
                No recent system notifications
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs space-y-0.5">
                  <p className="font-bold text-slate-800">{n.message}</p>
                  <span className="text-[10px] text-slate-400">{n.time}</span>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h4 className="text-xs font-black text-slate-800">I. Daily Report Status</h4>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex justify-between items-center text-xs">
              <span className="font-bold text-amber-900">Today's Shift Summary</span>
              <button
                onClick={() => navigate('/staff/daily-report')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-xs"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default StaffDashboard;
