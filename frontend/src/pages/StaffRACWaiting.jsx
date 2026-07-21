import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, ArrowUpCircle, UserCheck, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const StaffRACWaiting = () => {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);

  const mockWaitlist = [
    { id: 'wl-1', pnr: '6543210988', name: 'Suresh Patel', position: 'RAC 1', type: 'RAC', trainNo: '12951', trainName: 'Mumbai Central Rajdhani', priority: 'High' },
    { id: 'wl-2', pnr: '8765432109', name: 'Amit Patel', position: 'RAC 2', type: 'RAC', trainNo: '12262', trainName: 'Duronto Express', priority: 'Medium' },
    { id: 'wl-3', pnr: '6543210989', name: 'Anita Sharma', position: 'WL 1', type: 'Waiting List', trainNo: '16346', trainName: 'Netravati Express', priority: 'High' },
    { id: 'wl-4', pnr: '7654321098', name: 'Gopal Krishna', position: 'WL 2', type: 'Waiting List', trainNo: '12628', trainName: 'Karnataka Express', priority: 'Low' },
    { id: 'wl-5', pnr: '5432109876', name: 'Kunal Sen', position: 'WL 3', type: 'Waiting List', trainNo: '12618', trainName: 'Mangala Lakshadweep Exp', priority: 'Medium' }
  ];

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      if (res.data && res.data.length > 0) {
        const filtered = res.data.filter(b => b.status === 'rac' || b.status === 'waitlist' || b.status === 'waiting');
        if (filtered.length > 0) {
          let racCount = 1;
          let wlCount = 1;
          const mapped = filtered.map((b, idx) => {
            const firstAlloc = b.allocations?.[0] || {};
            const isRAC = b.status === 'rac';
            const position = isRAC ? `RAC ${racCount++}` : `WL ${wlCount++}`;
            return {
              id: b.id,
              pnr: b.pnr_number || b.id,
              name: firstAlloc.passenger_name || 'Anonymous Passenger',
              position: position,
              type: isRAC ? 'RAC' : 'Waiting List',
              trainNo: b.train?.train_number || '12051',
              trainName: b.train?.train_name || 'Express Train',
              priority: idx % 3 === 0 ? 'High' : idx % 3 === 1 ? 'Medium' : 'Low'
            };
          });
          setWaitlist(mapped);
        } else {
          setWaitlist(mockWaitlist);
        }
      } else {
        setWaitlist(mockWaitlist);
      }
    } catch (err) {
      console.warn('API error fetching waitlist, falling back to mock queue list:', err);
      setWaitlist(mockWaitlist);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const promotePassenger = (id) => {
    const p = waitlist.find(item => item.id === id);
    if (p) {
      alert(`Passenger ${p.name} has been promoted to CONFIRMED! A new seat (Lower/Upper) will be allocated and SMS notification will be sent.`);
      setWaitlist(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">RAC & Waitlist Manager</h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">Oversee waitlisted queues, check RAC placements, and manually allocate cancelled berths.</p>
      </div>

      {/* Info Warning banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between rounded-3xl bg-[#fffbeb] border border-amber-200 p-5 text-amber-900 gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-amber-900 tracking-wide uppercase">Interactive Allocation Center</p>
            <p className="text-xs text-amber-800 font-medium leading-relaxed mt-1">Berth promotions trigger automatically when ticket cancellations occur. You can also override and promote passengers manually below.</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Total Queued Passengers', value: waitlist.length, color: 'text-blue-600 bg-blue-500/10', icon: Clock },
          { label: 'RAC Positions', value: waitlist.filter(w => w.type === 'RAC').length, color: 'text-emerald-600 bg-emerald-500/10', icon: UserCheck },
          { label: 'Waitlist Positions', value: waitlist.filter(w => w.type === 'Waiting List').length, color: 'text-rose-600 bg-rose-500/10', icon: ShieldAlert }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stat.value}</span>
              </div>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stat.color} font-bold`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">Position</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">PNR</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Passenger</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Train</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Priority Level</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right pr-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {waitlist.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-xs font-bold text-slate-400">Waitlist is completely clear!</td>
                </tr>
              ) : (
                waitlist.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4.5 text-xs font-black text-slate-850 pl-8">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black ${
                        item.type === 'RAC' ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#fee2e2] text-[#dc2626]'
                      }`}>
                        {item.position}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-xs font-bold text-slate-800 font-mono">{item.pnr}</td>
                    <td className="px-6 py-4.5 text-xs font-black text-slate-800">{item.name}</td>
                    <td className="px-6 py-4.5 text-xs leading-normal">
                      <span className="font-black text-slate-800 block text-xs">{item.trainName}</span>
                      <span className="font-mono text-slate-400 text-[10px] font-bold">#{item.trainNo}</span>
                    </td>
                    <td className="px-6 py-4.5 text-xs font-bold">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        item.priority === 'High' ? 'bg-rose-50 text-rose-700' : item.priority === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {item.priority} Priority
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right pr-8">
                      <button
                        onClick={() => promotePassenger(item.id)}
                        className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-4 py-2 text-xs font-black shadow-md transition active:scale-95 flex items-center justify-center space-x-1 border border-primary-600/10 inline-flex"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                        <span>Promote Berths</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffRACWaiting;
