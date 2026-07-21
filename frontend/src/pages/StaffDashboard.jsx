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

  // Departures & Bookings lists initialized with mockup data
  const [departures, setDepartures] = useState([
    { id: 'dep-1', trainNo: '12618', trainName: 'Mangala Lakshadweep Exp', to: 'Chennai', depTime: '10:45 AM', platform: 'PF 2', status: 'On Time' },
    { id: 'dep-2', trainNo: '12951', trainName: 'Mumbai Central Rajdhani', to: 'Mumbai', depTime: '11:20 AM', platform: 'PF 1', status: 'Delayed' },
    { id: 'dep-3', trainNo: '16346', trainName: 'Netravati Express', to: 'Trivandrum', depTime: '12:10 PM', platform: 'PF 3', status: 'On Time' },
    { id: 'dep-4', trainNo: '12628', trainName: 'Karnataka Express', to: 'New Delhi', depTime: '12:45 PM', platform: 'PF 2', status: 'On Time' },
    { id: 'dep-5', trainNo: '11013', trainName: 'Coimbatore Express', to: 'Coimbatore', depTime: '01:15 PM', platform: 'PF 1', status: 'Delayed' },
  ]);

  const [bookings, setBookings] = useState([
    { id: 'bk-1', pnr: '6543210987', passengerName: 'Ramesh Kumar', trainNo: '12618', journeyDate: '21 May 2024', status: 'Confirmed' },
    { id: 'bk-2', pnr: '6543210988', passengerName: 'Suresh Patel', trainNo: '12951', journeyDate: '21 May 2024', status: 'RAC' },
    { id: 'bk-3', pnr: '6543210989', passengerName: 'Anita Sharma', trainNo: '16346', journeyDate: '22 May 2024', status: 'Waiting' },
    { id: 'bk-4', pnr: '6543210990', passengerName: 'Vikram Singh', trainNo: '12628', journeyDate: '22 May 2024', status: 'Confirmed' },
    { id: 'bk-5', pnr: '6543210991', passengerName: 'Neha Gupta', trainNo: '11013', journeyDate: '23 May 2024', status: 'Confirmed' },
  ]);

  const [alerts, setAlerts] = useState([
    { id: 1, type: 'alert', text: 'Train 12951 Mumbai Central Rajdhani is delayed by 45 minutes.', time: '10:20 AM', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: AlertTriangle },
    { id: 2, type: 'warning', text: 'Platform change for Train 12628 Karnataka Express to PF 4.', time: '09:45 AM', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
    { id: 3, type: 'info', text: 'Crowd alert at Platform 1. Please manage accordingly.', time: '09:30 AM', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Users },
    { id: 4, type: 'success', text: 'New announcement: Maintenance work on PF 3 from 2 PM to 4 PM.', time: '09:15 AM', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: Megaphone },
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
        fare_multiplier: 1.2
      });

      // Append local schedule list
      const newTrainItem = {
        id: `dep-custom-${Date.now()}`,
        trainNo: trainNumber,
        trainName: trainName,
        to: destination,
        depTime: depTime,
        platform: 'PF ' + (Math.floor(Math.random() * 4) + 1),
        status: 'On Time'
      };
      setDepartures(prev => [...prev, newTrainItem]);

      alert('Train schedule added successfully!');
      setShowAddModal(false);
      // Reset form fields
      setTrainNumber('');
      setTrainName('');
      setSource('');
      setDestination('');
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Header section matching mockup */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Welcome, Staff User 👋</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Here's what's happening at your station today.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 text-xs font-black shadow-lg shadow-primary-500/20 active:scale-95 transition"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Add Train Schedule</span>
        </button>
      </div>

      {/* Grid of 4 KPI metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Trains Today', value: '28', path: '/staff/schedules', linkText: 'View all trains', color: 'bg-blue-500 text-blue-600 border-blue-500/10', icon: Train },
          { label: 'Tickets Booked', value: '1,256', path: '/staff', linkText: 'View bookings', color: 'bg-emerald-500 text-emerald-600 border-emerald-500/10', icon: Ticket },
          { label: 'Passengers Today', value: '3,842', path: '/staff', linkText: 'View passengers', color: 'bg-amber-500 text-amber-600 border-amber-500/10', icon: Users },
          { label: 'Total Revenue', value: '₹ 8,45,320', path: '/staff/refunds', linkText: 'View report', color: 'bg-purple-500 text-purple-600 border-purple-500/10', icon: IndianRupee },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white rounded-3xl border border-slate-200/70 p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-200 group">
              <div className="flex items-center space-x-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${item.color} bg-opacity-10 shadow-inner flex-shrink-0`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{item.label}</span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block tracking-tight">{item.value}</span>
                  <button 
                    onClick={() => navigate(item.path)}
                    className="text-[10px] font-black text-primary-600 hover:text-primary-700 transition mt-1.5 flex items-center"
                  >
                    <span>{item.linkText}</span>
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid of Tables: Departures & Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Upcoming Departures */}
        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-50/50 border-b border-slate-100 p-4.5 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
                <Train className="h-4.5 w-4.5 text-primary-600" />
                <span>Upcoming Departures</span>
              </h3>
              <button 
                onClick={() => navigate('/staff/schedules')} 
                className="text-xs font-black text-primary-600 hover:underline"
              >
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50/20">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400 pl-6">Train No.</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Train Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">To</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Dep. Time</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Platform</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400 text-center pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {departures.slice(0, 5).map(dep => (
                    <tr key={dep.id} className="hover:bg-slate-50/30 transition">
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-800 font-mono pl-6">#{dep.trainNo}</td>
                      <td className="px-5 py-3.5 text-xs font-black text-slate-800 leading-tight">{dep.trainName}</td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-650">{dep.to}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-700">{dep.depTime}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-500">{dep.platform}</td>
                      <td className="px-5 py-3.5 text-xs font-bold">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          dep.status === 'On Time' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : dep.status === 'Delayed' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {dep.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center pr-6">
                        <button
                          onClick={() => toggleStatus(dep.id)}
                          className="rounded-lg bg-slate-900 hover:bg-slate-950 text-white px-2.5 py-1 text-[10px] font-black transition active:scale-95"
                          title="Toggle live schedule status"
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
        </div>

        {/* Right: Recent Bookings */}
        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-50/50 border-b border-slate-100 p-4.5 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
                <Ticket className="h-4.5 w-4.5 text-[#0052cc]" />
                <span>Recent Bookings</span>
              </h3>
              <button 
                onClick={() => navigate('/staff')} 
                className="text-xs font-black text-primary-600 hover:underline"
              >
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50/20">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400 pl-6">PNR</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Passenger Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Train No.</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400">Journey Date</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-400 pr-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bookings.map(bk => (
                    <tr key={bk.id} className="hover:bg-slate-50/30 transition">
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-800 font-mono pl-6">{bk.pnr}</td>
                      <td className="px-5 py-3.5 text-xs font-black text-slate-800 leading-tight">{bk.passengerName}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-500 font-mono">#{bk.trainNo}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-slate-700">{bk.journeyDate}</td>
                      <td className="px-5 py-3.5 text-xs font-bold pr-6">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          bk.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : bk.status === 'RAC' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
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

      </div>

      {/* Grid of Bottom Row: Alerts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Alerts & Notifications */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h3 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
              <Bell className="h-4.5 w-4.5 text-rose-550" />
              <span>Alerts & Notifications</span>
            </h3>
            <button 
              onClick={() => navigate('/staff/inquiries')}
              className="text-xs font-black text-primary-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-3.5">
            {alerts.map(alert => {
              const Icon = alert.icon;
              return (
                <div key={alert.id} className="flex items-start justify-between text-xs py-1">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${alert.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-700 leading-normal mt-0.5">{alert.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wide whitespace-nowrap mt-1 pl-3">{alert.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h3 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
              <Plus className="h-4.5 w-4.5 text-primary-600" />
              <span>Quick Actions</span>
            </h3>
            <button 
              onClick={() => navigate('/staff/schedules')}
              className="text-xs font-black text-primary-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'Add Announcement', icon: Megaphone, path: '/staff/inquiries' },
              { name: 'Check Tickets', icon: Ticket, path: '/staff' },
              { name: 'Update Train Status', icon: Train, path: '/staff/schedules' },
              { name: 'Manage RAC/Waiting', icon: UserCheck, path: '/staff' },
              { name: 'Generate Report', icon: FileText, path: '/staff/refunds' },
              { name: 'Passenger Help', icon: Headphones, path: '/staff/inquiries' }
            ].map((act, idx) => {
              const Icon = act.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(act.path)}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 hover:border-primary-400/40 hover:shadow-md hover:-translate-y-0.5 group active:scale-95"
                >
                  <Icon className="h-5 w-5 text-primary-600 mb-2.5 group-hover:scale-105 transition" />
                  <span className="text-[10px] font-black text-slate-800 leading-tight">{act.name}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Add Train Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h3 className="text-base font-black text-slate-800">Add Train Schedule</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTrain} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Train Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 12952"
                    value={trainNumber}
                    onChange={(e) => setTrainNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Train Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajdhani Express"
                    value={trainName}
                    onChange={(e) => setTrainName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Source Code</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={source}
                    onChange={(e) => setSource(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Destination Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MMCT"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Dep Time</label>
                  <input
                    type="text"
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 text-xs font-black shadow-lg shadow-primary-500/25 active:scale-95 transition"
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
