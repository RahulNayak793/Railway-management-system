import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Train, 
  Clock, 
  Users, 
  IndianRupee, 
  Bell, 
  ChevronRight, 
  Volume2, 
  ShieldAlert, 
  ArrowRightLeft, 
  BookOpen, 
  FileText, 
  XCircle, 
  CreditCard, 
  User, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Megaphone, 
  Ticket, 
  Search, 
  UserCheck, 
  Headphones 
} from 'lucide-react';
import api from '../services/api';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Departures & Bookings lists initialized empty
  const [departures, setDepartures] = useState([]);

  useEffect(() => {
    const fetchTrains = async () => {
      try {
        const res = await api.get('/trains');
        const formatted = res.data.map((t, idx) => {
          const actualRoute = t.route || (t.routes && t.routes.length > 0 ? t.routes[0] : null);
          return {
            id: t.id || `dep-${idx}`,
            trainNo: t.train_number,
            trainName: t.train_name,
            to: actualRoute?.destination_station_code || t.destination || 'N/A',
            depTime: actualRoute?.departure_time ? actualRoute.departure_time.substring(0,5) : (t.depTime || '10:00'),
            platform: t.platform || ('PF ' + (Math.floor(Math.random() * 4) + 1)),
            status: t.status === 'delayed' ? 'Delayed' : t.status === 'cancelled' ? 'Cancelled' : 'On Time'
          };
        });

        // Merge with persistent staff trains from localStorage
        const storedStaffTrains = JSON.parse(localStorage.getItem('added_staff_trains') || '[]');
        const existingIds = new Set(formatted.map(f => f.id));
        const merged = [...formatted];
        
        storedStaffTrains.forEach(st => {
          if (!existingIds.has(st.id)) {
            merged.push(st);
          }
        });

        setDepartures(merged);
      } catch (err) {
        console.error('Failed to fetch trains:', err);
      }
    };
    fetchTrains();
  }, []);

  const [bookings, setBookings] = useState([
    { id: 'bk-1', pnr: '6543210987', passengerName: 'Ramesh Kumar', trainNo: '12618', journeyDate: '21 May 2024', status: 'Confirmed' },
    { id: 'bk-2', pnr: '6543210988', passengerName: 'Suresh Patel', trainNo: '12951', journeyDate: '21 May 2024', status: 'RAC' },
    { id: 'bk-3', pnr: '6543210989', passengerName: 'Anita Sharma', trainNo: '16346', journeyDate: '22 May 2024', status: 'Waiting' },
    { id: 'bk-4', pnr: '6543210990', passengerName: 'Vikram Singh', trainNo: '12628', journeyDate: '22 May 2024', status: 'Confirmed' },
    { id: 'bk-5', pnr: '6543210991', passengerName: 'Neha Gupta', trainNo: '11013', journeyDate: '23 May 2024', status: 'Confirmed' },
  ]);

  const [alerts, setAlerts] = useState([
    { id: 1, type: 'alert', text: 'Train 12951 Mumbai Central Rajdhani is delayed by 45 minutes.', time: '10:20 AM', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: AlertTriangle },
    { id: 2, type: 'warning', text: 'Platform change for Train 12628 Karnataka Express to PF 4.', time: '09:45 AM', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
    { id: 3, type: 'info', text: 'Crowd alert at Platform 1. Please manage accordingly.', time: '09:30 AM', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Users },
    { id: 4, type: 'success', text: 'New announcement: Maintenance work on PF 3 from 2 PM to 4 PM.', time: '09:15 AM', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Megaphone },
  ]);

  // New Train Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [trainNumber, setTrainNumber] = useState('');
  const [trainName, setTrainName] = useState('');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [depTime, setDepTime] = useState('10:00 AM');
  const [arrTime, setArrTime] = useState('06:00 PM');
  const [distance, setDistance] = useState('500');
  const [frequency, setFrequency] = useState('Daily');

  const handleCreateTrain = async (e) => {
    e.preventDefault();
    try {
      await api.post('/trains', {
        train_number: trainNumber,
        train_name: trainName,
        source: source || 'NDLS',
        destination: destination || 'MMCT',
        departure_time: depTime,
        arrival_time: arrTime || '18:00:00',
        distance_km: parseFloat(distance),
        fare_multiplier: 1.2,
        frequency: frequency
      });

      // Append local schedule list and persist in localStorage
      const newTrainItem = {
        id: `dep-custom-${Date.now()}`,
        trainNo: trainNumber,
        trainName: trainName,
        to: destination || 'MMCT',
        depTime: depTime,
        platform: 'PF ' + (Math.floor(Math.random() * 4) + 1),
        status: 'On Time'
      };

      const storedStaffTrains = JSON.parse(localStorage.getItem('added_staff_trains') || '[]');
      storedStaffTrains.unshift(newTrainItem);
      localStorage.setItem('added_staff_trains', JSON.stringify(storedStaffTrains));

      setDepartures(prev => [newTrainItem, ...prev]);

      alert('Train schedule added successfully and saved permanently!');
      setShowAddModal(false);
      // Reset form fields
      setTrainNumber('');
      setTrainName('');
      setSource('');
      setDestination('');
      setFrequency('Daily');
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleStatus = (id) => {
    setDepartures(prev => prev.map(dep => {
      if (dep.id === id) {
        return {
          ...dep,
          status: dep.status === 'On Time' ? 'Delayed' : dep.status === 'Delayed' ? 'Cancelled' : 'On Time'
        };
      }
      return dep;
    }));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Real-time station operations overview</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm px-5 py-2.5 font-bold flex items-center gap-2 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Train Schedule</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Trains Today', value: `${departures.length || 28}`, linkText: 'View schedules',
            path: '/staff/schedules', icon: Train,
            gradient: 'linear-gradient(135deg, #2478f2, #0f5be8)',
            glow: 'rgba(36,120,242,0.4)', accent: '#93c5fd'
          },
          {
            label: 'Tickets Booked', value: '1,256', linkText: 'View bookings',
            path: '/staff/bookings', icon: Ticket,
            gradient: 'linear-gradient(135deg, #10b981, #059669)',
            glow: 'rgba(16,185,129,0.4)', accent: '#6ee7b7'
          },
          {
            label: 'Passengers Today', value: '3,842', linkText: 'View passengers',
            path: '/staff/passengers', icon: Users,
            gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
            glow: 'rgba(245,158,11,0.4)', accent: '#fde68a'
          },
          {
            label: 'Total Revenue', value: '₹8,45,320', linkText: 'View report',
            path: '/staff/reports', icon: IndianRupee,
            gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            glow: 'rgba(168,85,247,0.4)', accent: '#d8b4fe'
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex flex-col justify-between shadow-sm space-y-4 hover:shadow-md transition duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{item.label}</span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block">{item.value}</span>
                </div>
                <div 
                  className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: item.gradient, boxShadow: `0 4px 12px ${item.glow}` }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <button 
                onClick={() => navigate(item.path)}
                className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center space-x-1"
              >
                <span>{item.linkText}</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Departures & Bookings Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Upcoming Departures */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                <Train className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-slate-850">Upcoming Departures</h3>
            </div>
            <button onClick={() => navigate('/staff/schedules')} className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition">
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Train No.</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Name</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">To</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Departs</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Status</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departures.slice(0, 6).map(dep => (
                  <tr key={dep.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3 text-xs font-black text-slate-800 font-mono">#{dep.trainNo}</td>
                    <td className="py-3 text-xs font-bold text-slate-700">{dep.trainName}</td>
                    <td className="py-3 text-xs font-semibold text-slate-500">{dep.to}</td>
                    <td className="py-3 text-xs font-semibold text-slate-500">{dep.depTime}</td>
                    <td className="py-3 text-xs font-bold">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        dep.status === 'On Time' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                        dep.status === 'Delayed' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                        'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {dep.status}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => toggleStatus(dep.id)}
                        className="rounded-lg px-2.5 py-1 text-[10px] font-black text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all"
                      >
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                <Ticket className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-slate-850">Recent Bookings</h3>
            </div>
            <button onClick={() => navigate('/staff/bookings')} className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition">
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">PNR</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Passenger</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Train</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Date</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map(bk => (
                  <tr key={bk.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3 text-xs font-black text-slate-800 font-mono">{bk.pnr}</td>
                    <td className="py-3 text-xs font-bold text-slate-700">{bk.passengerName}</td>
                    <td className="py-3 text-xs font-black text-slate-800 font-mono">#{bk.trainNo}</td>
                    <td className="py-3 text-xs font-semibold text-slate-500">{bk.journeyDate}</td>
                    <td className="py-3 text-xs font-bold">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        bk.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                        bk.status === 'RAC' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                        'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {bk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Alerts & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Alerts */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600">
                <Bell className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-slate-850">Alerts & Notifications</h3>
            </div>
            <button onClick={() => navigate('/staff/inquiries')} className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {alerts.map(alert => {
              const Icon = alert.icon;
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-xl p-3 border ${alert.color}`}
                >
                  <div className="p-1.5 rounded-lg flex-shrink-0 bg-white shadow-sm border border-inherit">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-relaxed text-inherit">{alert.text}</p>
                    <span className="text-[10px] font-bold text-slate-500 mt-0.5 block">{alert.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                <Plus className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-black text-slate-850">Quick Actions</h3>
            </div>
            <button onClick={() => navigate('/staff/schedules')} className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition">
              View All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Add Announcement', icon: Megaphone, path: '/staff/announcements', color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100' },
              { name: 'Check Tickets', icon: Ticket, path: '/staff/ticket-checking', color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100' },
              { name: 'Train Status', icon: Train, path: '/staff/schedules', color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100' },
              { name: 'RAC/Waiting', icon: UserCheck, path: '/staff/rac-waiting', color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100' },
              { name: 'Generate Report', icon: FileText, path: '/staff/reports', color: 'text-cyan-600', bg: 'bg-cyan-50 hover:bg-cyan-100' },
              { name: 'Passenger Help', icon: Headphones, path: '/staff/inquiries', color: 'text-pink-600', bg: 'bg-pink-50 hover:bg-pink-100' },
            ].map((act, idx) => {
              const Icon = act.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(act.path)}
                  className={`rounded-xl p-3.5 flex flex-col items-center gap-2 text-center transition active:scale-95 border border-slate-100 shadow-sm ${act.bg}`}
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-white shadow-sm">
                    <Icon className={`h-4 w-4 ${act.color}`} />
                  </div>
                  <span className="text-[10px] font-bold leading-tight text-slate-700">{act.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Train Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="pb-3 flex justify-between items-center border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">Add Train Schedule</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTrain} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Train Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 12952"
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Train Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajdhani Express"
                    value={trainName}
                    onChange={(e) => setTrainName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Source Code</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={source}
                    onChange={(e) => setSource(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Destination Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MMCT"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Dep Time</label>
                  <input
                    type="text"
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1.5 pl-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Special">Special</option>
                  </select>
                </div>
                <div></div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold transition active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  Save Train
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
