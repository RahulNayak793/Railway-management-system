import React, { useState } from 'react';
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
  UserCheck, 
  Building2, 
  Layers, 
  CreditCard,
  AlertCircle
} from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState('21 May 2024');
  const [timeFilter, setTimeFilter] = useState('Last 7 Days');

  // Exact metrics matching the mockup screenshot
  const stats = [
    { label: 'Total Trains', value: '256', link: 'View all trains', path: '/admin/trains', color: 'text-blue-600 bg-blue-500/10', icon: Train },
    { label: 'Total Routes', value: '78', link: 'View all routes', path: '/admin/routes', color: 'text-emerald-600 bg-emerald-500/10', icon: Compass },
    { label: 'Today\'s Bookings', value: '1,245', link: 'View bookings', path: '/admin/bookings', color: 'text-purple-600 bg-purple-500/10', icon: Calendar },
    { label: 'Total Passengers', value: '18,742', link: 'View passengers', path: '/admin/users', color: 'text-orange-600 bg-orange-500/10', icon: Users },
    { label: 'Total Revenue', value: '₹ 12,45,320', link: 'View reports', path: '/admin/reports', color: 'text-teal-600 bg-teal-500/10', icon: IndianRupee }
  ];

  const recentBookings = [
    { pnr: '6543210981', passengerName: 'Ramesh Kumar', trainName: '12951 Mumbai Rajdhani', journeyDate: '21 May 2024', status: 'Confirmed', amount: '₹ 1,250' },
    { pnr: '6543210982', passengerName: 'Suresh Patel', trainName: '12618 Mangala Express', journeyDate: '21 May 2024', status: 'RAC', amount: '₹ 780' },
    { pnr: '6543210983', passengerName: 'Anita Sharma', trainName: '16346 Netravati Express', journeyDate: '22 May 2024', status: 'Waiting', amount: '₹ 560' },
    { pnr: '6543210984', passengerName: 'Vikram Singh', trainName: '12628 Karnataka Express', journeyDate: '22 May 2024', status: 'Confirmed', amount: '₹ 980' },
    { pnr: '6543210985', passengerName: 'Neha Gupta', trainName: '11013 Coimbatore Express', journeyDate: '23 May 2024', status: 'Confirmed', amount: '₹ 1,100' }
  ];

  const systemSummary = [
    { label: 'Total Staff', value: '152', icon: UserCheck, color: 'text-blue-600 bg-blue-100' },
    { label: 'Total Stations', value: '320', icon: Building2, color: 'text-purple-600 bg-purple-100' },
    { label: 'Total Classes', value: '6', icon: Layers, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'Total Coaches', value: '1,248', icon: Train, color: 'text-orange-600 bg-orange-100' },
    { label: 'Pending Refunds', value: '23', icon: IndianRupee, color: 'text-rose-600 bg-rose-100' }
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header and Date Selector */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Welcome back, Admin! Here's what's happening in your system today.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs font-bold text-slate-700 select-none">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>{selectedDate}</span>
          <ChevronRight className="h-3 w-3 text-slate-400 rotate-90" />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex flex-col justify-between shadow-sm space-y-4 hover:shadow-md transition duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{card.label}</span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block">{card.value}</span>
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

      {/* Charts Grid Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Booking & Revenue Overview (Line chart mock) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-850">Booking & Revenue Overview</h3>
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[10px] font-bold text-slate-650 cursor-pointer select-none">
              <span>{timeFilter}</span>
              <ChevronRight className="h-3 w-3 rotate-90 text-slate-400" />
            </div>
          </div>

          {/* Legends */}
          <div className="flex items-center space-x-5 text-[10px] font-bold text-slate-500">
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-6 rounded bg-[#0052cc] inline-block"></span>
              <span>Bookings</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2.5 w-6 rounded bg-emerald-500 inline-block"></span>
              <span>Revenue (₹)</span>
            </div>
          </div>

          {/* Custom SVG Line Chart */}
          <div className="relative h-56 w-full pt-4">
            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0052cc" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#0052cc" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="700" y2="40" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="80" x2="700" y2="80" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="120" x2="700" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="160" x2="700" y2="160" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="0" y1="200" x2="700" y2="200" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Revenue Curve Gradient Fill */}
              <path 
                d="M 50 160 Q 150 140 250 150 T 450 110 T 650 130 L 650 200 L 50 200 Z" 
                fill="url(#greenGrad)" 
              />
              {/* Bookings Curve Gradient Fill */}
              <path 
                d="M 50 130 Q 150 90 250 100 T 450 80 T 650 95 L 650 200 L 50 200 Z" 
                fill="url(#blueGrad)" 
              />

              {/* Lines */}
              <path 
                d="M 50 130 Q 150 90 250 100 T 450 80 T 650 95" 
                fill="none" 
                stroke="#0052cc" 
                strokeWidth="3" 
                strokeLinecap="round"
              />
              <path 
                d="M 50 160 Q 150 140 250 150 T 450 110 T 650 130" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="3" 
                strokeLinecap="round"
              />

              {/* Data points */}
              {[
                { x: 50, y: 130 }, { x: 150, y: 90 }, { x: 250, y: 100 }, 
                { x: 350, y: 105 }, { x: 450, y: 80 }, { x: 550, y: 65 }, { x: 650, y: 95 }
              ].map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="#0052cc" stroke="white" strokeWidth="1.5" />
              ))}

              {[
                { x: 50, y: 160 }, { x: 150, y: 140 }, { x: 250, y: 150 }, 
                { x: 350, y: 153 }, { x: 450, y: 110 }, { x: 550, y: 95 }, { x: 650, y: 130 }
              ].map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
              ))}
            </svg>
            
            {/* Axis Y Left (Bookings) */}
            <div className="absolute left-0 top-7 bottom-4 flex flex-col justify-between text-[9px] font-black text-slate-400 select-none">
              <span>2000</span>
              <span>1500</span>
              <span>1000</span>
              <span>500</span>
              <span>0</span>
            </div>

            {/* Axis Y Right (Revenue) */}
            <div className="absolute right-0 top-7 bottom-4 flex flex-col justify-between text-[9px] font-black text-slate-400 text-right select-none">
              <span>10L</span>
              <span>8L</span>
              <span>6L</span>
              <span>4L</span>
              <span>2L</span>
              <span>0</span>
            </div>
          </div>

          {/* Dates row */}
          <div className="flex justify-between px-10 text-[9px] font-black text-slate-400 pt-2 font-mono">
            <span>15 May</span>
            <span>16 May</span>
            <span>17 May</span>
            <span>18 May</span>
            <span>19 May</span>
            <span>20 May</span>
            <span>21 May</span>
          </div>
        </div>

        {/* Train Status Overview Donut Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-850">Train Status Overview</h3>
          </div>

          <div className="flex items-center justify-around flex-grow gap-4">
            {/* Donut Chart */}
            <div className="relative h-32 w-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {/* Background slice */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="4.2" />

                {/* Running: 71.09% */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4.2" 
                  strokeDasharray="71.09 28.91" strokeDashoffset="0" />

                {/* On Time: 17.58% */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0052cc" strokeWidth="4.2" 
                  strokeDasharray="17.58 82.42" strokeDashoffset="-71.09" />

                {/* Delayed: 7.81% */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4.2" 
                  strokeDasharray="7.81 92.19" strokeDashoffset="-88.67" />

                {/* Cancelled: 3.52% */}
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ef4444" strokeWidth="4.2" 
                  strokeDasharray="3.52 96.48" strokeDashoffset="-96.48" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-slate-850">256</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Trains</span>
              </div>
            </div>

            {/* Legends List */}
            <div className="space-y-2 text-[10px] font-bold text-slate-650">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                <span className="font-semibold">Running:</span>
                <span className="font-mono">182 (71.09%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-[#0052cc] inline-block"></span>
                <span className="font-semibold">On Time:</span>
                <span className="font-mono">45 (17.58%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                <span className="font-semibold">Delayed:</span>
                <span className="font-mono">20 (7.81%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span>
                <span className="font-semibold">Cancelled:</span>
                <span className="font-mono">9 (3.52%)</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/admin/trains')}
            className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center justify-center space-x-1 border-t border-slate-100 pt-3"
          >
            <span>View all trains status</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Bookings Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-850">Recent Bookings</h3>
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
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Passenger Name</th>
                  <th className="pb-3 text-[9px] font-black uppercase text-slate-400">Train Name</th>
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
                    <td className="py-3 text-xs font-bold text-slate-700">{bk.trainName}</td>
                    <td className="py-3 text-xs font-semibold text-slate-500">{bk.journeyDate}</td>
                    <td className="py-3 text-xs font-bold">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        bk.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : bk.status === 'RAC' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {bk.status}
                      </span>
                    </td>
                    <td className="py-3 text-xs font-black text-slate-800 text-right">{bk.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Summary Roster */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-850">System Summary</h3>
          </div>

          <div className="space-y-3.5 flex-grow pt-2">
            {systemSummary.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex justify-between items-center p-2 rounded-2xl hover:bg-slate-50/60 transition">
                  <div className="flex items-center space-x-3">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-xs font-black text-slate-850 font-mono">{item.value}</span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => alert('Loading full system diagnostics reports...')}
            className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition flex items-center justify-center space-x-1 border-t border-slate-100 pt-3"
          >
            <span>View system details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* Quick Operational Controls Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-850">Operational Operations Center</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">All-in-one Control</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Ticket Checking', path: '/admin/ticket-checking', icon: '🎫', color: 'hover:bg-blue-50 border-blue-100' },
            { label: 'RAC / Waiting', path: '/admin/rac-waiting', icon: '⏱️', color: 'hover:bg-amber-50 border-amber-100' },
            { label: 'Announcements', path: '/admin/announcements', icon: '📢', color: 'hover:bg-purple-50 border-purple-100' },
            { label: 'Pantry & Catering', path: '/admin/catering', icon: '🍱', color: 'hover:bg-emerald-50 border-emerald-100' },
            { label: 'Staff Roster', path: '/admin/staff', icon: '👥', color: 'hover:bg-indigo-50 border-indigo-100' },
            { label: 'Support & Inquiries', path: '/admin/inquiries', icon: '💬', color: 'hover:bg-rose-50 border-rose-100' }
          ].map((op, i) => (
            <button
              key={i}
              onClick={() => navigate(op.path)}
              className={`p-3.5 rounded-2xl border border-slate-200 bg-white text-left transition flex flex-col justify-between space-y-2 group shadow-2xs ${op.color}`}
            >
              <span className="text-xl">{op.icon}</span>
              <span className="text-xs font-extrabold text-slate-800 group-hover:text-primary-700 block">{op.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold text-slate-450 pt-8 border-t border-slate-200 gap-3 select-none">
        <span>© 2024 Railway Management System. All rights reserved.</span>
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
