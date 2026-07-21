import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, Ticket, User, Calendar, Tag, Clock } from 'lucide-react';
import api from '../services/api';

const StaffBookings = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);

  const mockBookings = [
    { pnr: '6543210987', passengerName: 'Ramesh Kumar', trainNo: '12618', trainName: 'Mangala Lakshadweep Exp', journeyDate: '21 May 2024', status: 'Confirmed', seat: 'B2-23', class: '2A' },
    { pnr: '6543210988', passengerName: 'Suresh Patel', trainNo: '12951', trainName: 'Mumbai Central Rajdhani', journeyDate: '21 May 2024', status: 'RAC', seat: 'A1-4', class: '3A' },
    { pnr: '6543210989', passengerName: 'Anita Sharma', trainNo: '16346', trainName: 'Netravati Express', journeyDate: '22 May 2024', status: 'Waiting', seat: 'N/A', class: 'SL' },
    { pnr: '6543210990', passengerName: 'Vikram Singh', trainNo: '12628', trainName: 'Karnataka Express', journeyDate: '22 May 2024', status: 'Confirmed', seat: 'B1-12', class: '3A' },
    { pnr: '6543210991', passengerName: 'Neha Gupta', trainNo: '11013', trainName: 'Coimbatore Express', journeyDate: '23 May 2024', status: 'Confirmed', seat: 'A2-15', class: '2A' },
    { pnr: '9876543210', passengerName: 'Priya Sharma', trainNo: '12952', trainName: 'New Delhi Rajdhani', journeyDate: '24 May 2024', status: 'Confirmed', seat: 'H1-2', class: '1A' },
    { pnr: '8765432109', passengerName: 'Amit Patel', trainNo: '12262', trainName: 'Duronto Express', journeyDate: '24 May 2024', status: 'RAC', seat: 'B3-44', class: '3A' }
  ];

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      if (res.data && res.data.length > 0) {
        const mapped = res.data.map(b => {
          const firstAlloc = b.allocations?.[0] || {};
          return {
            pnr: b.pnr_number || b.id,
            passengerName: firstAlloc.passenger_name || 'Anonymous Passenger',
            trainNo: b.train?.train_number || '12051',
            trainName: b.train?.train_name || 'Express Train',
            journeyDate: b.travel_date || '21 May 2024',
            status: b.status 
              ? b.status.toUpperCase() === 'WAITLIST' || b.status.toUpperCase() === 'WAITING'
                ? 'Waiting' 
                : b.status.toUpperCase() === 'RAC' 
                  ? 'RAC' 
                  : b.status.charAt(0).toUpperCase() + b.status.slice(1).toLowerCase()
              : 'Confirmed',
            seat: firstAlloc.seat_id ? `Seat #${firstAlloc.seat_id}` : 'N/A',
            class: b.coach_class || '3A'
          };
        });
        setBookings(mapped);
      } else {
        setBookings(mockBookings);
      }
    } catch (err) {
      console.warn('API error fetching bookings, falling back to mock data:', err);
      setBookings(mockBookings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = bookings.filter(bk => {
    const matchesSearch = bk.passengerName.toLowerCase().includes(searchTerm.toLowerCase()) || bk.pnr.includes(searchTerm);
    const matchesFilter = statusFilter === 'All' || bk.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manage Bookings</h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">Review active passenger reservations, statuses, and seat allocations.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { label: 'Total Bookings Checked', value: bookings.length, color: 'text-blue-600 bg-blue-500/10', icon: BookOpen },
          { label: 'Confirmed Seats', value: bookings.filter(b => b.status === 'Confirmed').length, color: 'text-emerald-600 bg-emerald-500/10', icon: Ticket },
          { label: 'Waitlisted', value: bookings.filter(b => b.status === 'Waiting').length, color: 'text-rose-600 bg-rose-500/10', icon: Clock }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                <span className="text-2xl font-black text-slate-800 mt-1 block">{stat.value}</span>
              </div>
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${stat.color} font-bold`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Control bar */}
      <div className="bg-white border border-slate-200/70 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Search */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 w-full md:w-80 focus-within:ring-2 focus-within:ring-primary-500/15 focus-within:border-primary-500 transition">
          <Search className="h-4.5 w-4.5 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search Passenger or PNR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-bold text-slate-700"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
            {['All', 'Confirmed', 'RAC', 'Waiting'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition ${
                  statusFilter === f ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">PNR</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Passenger</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Train Info</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Journey Date</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Class & Seat</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pr-8">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-xs font-bold text-slate-400">No bookings match the filters</td>
                </tr>
              ) : (
                filteredBookings.map(bk => (
                  <tr key={bk.pnr} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4.5 text-xs font-black text-slate-800 font-mono pl-8">{bk.pnr}</td>
                    <td className="px-6 py-4.5 text-xs font-black text-slate-800 flex items-center space-x-2">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                        {bk.passengerName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span>{bk.passengerName}</span>
                    </td>
                    <td className="px-6 py-4.5 text-xs leading-normal">
                      <span className="font-bold text-slate-800 block">{bk.trainName}</span>
                      <span className="font-mono text-slate-400 text-[10px]">#{bk.trainNo}</span>
                    </td>
                    <td className="px-6 py-4.5 text-xs font-semibold text-slate-650">{bk.journeyDate}</td>
                    <td className="px-6 py-4.5 text-xs">
                      <span className="font-bold text-slate-700 block">{bk.class} Class</span>
                      <span className="font-mono text-slate-505 font-bold text-[10px]">Seat: {bk.seat}</span>
                    </td>
                    <td className="px-6 py-4.5 text-xs font-bold pr-8">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        bk.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : bk.status === 'RAC' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {bk.status}
                      </span>
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

export default StaffBookings;
