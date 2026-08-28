import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, Filter, Ticket, User, Calendar, Clock, Eye, X, 
  CreditCard, CheckCircle2, AlertCircle, Phone, Mail, MapPin, FileText, 
  Download, RefreshCw, ChevronRight, ShieldCheck, DollarSign, Utensils,
  XCircle, AlertTriangle, ShieldAlert
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const StaffBookings = () => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeTab, setActiveTab] = useState('passengers');

  // Cancel Modal State
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('Passenger Request');
  const [customReason, setCustomReason] = useState('');
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [overridePenalty, setOverridePenalty] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings?all=true');
      if (res.data && res.data.length > 0) {
        const mapped = res.data.map(b => {
          const firstAlloc = b.allocations?.[0] || {};
          const mappedPassengers = (b.allocations && b.allocations.length > 0) 
            ? b.allocations.map((a, i) => ({
                id: a.id || `alloc-${i}`,
                name: a.passenger_name || firstAlloc.passenger_name || 'Passenger ' + (i+1),
                age: a.passenger_age || 30,
                gender: a.passenger_gender || 'Male',
                seat: a.seat_id ? `Seat #${a.seat_id}` : 'N/A',
                berthType: a.berth_type || 'Lower Berth',
                status: b.status ? b.status.toUpperCase() : 'Confirmed',
                idType: 'Aadhaar Card',
                idNumber: 'XXXX-XXXX-4582',
                catering: 'Standard Meal'
              }))
            : [{
                id: 'alloc-0',
                name: b.passenger_name || 'Primary Passenger',
                age: 35,
                gender: 'Male',
                seat: 'Allocated Seat',
                berthType: 'Lower Berth',
                status: b.status || 'Confirmed',
                idType: 'Aadhaar Card',
                idNumber: 'XXXX-XXXX-4582',
                catering: 'Standard Meal'
              }];

          const totalFare = Number(b.total_fare || 1800);

          return {
            id: b.id,
            pnr: b.pnr_number || b.id || 'PNR' + Math.floor(Math.random()*10000000),
            bookingDate: b.created_at ? new Date(b.created_at).toLocaleString('en-IN') : 'Recent Booking',
            primaryPassenger: mappedPassengers[0].name,
            email: b.user_email || 'passenger@railway.com',
            phone: b.user_phone || '+91 9876543210',
            emergencyContact: 'Emergency Contact (+91 9800000000)',
            trainNo: b.train?.train_number || '12051',
            trainName: b.train?.train_name || 'Express Train',
            sourceCode: b.route?.source_station_code || 'NDLS',
            sourceName: 'Origin Station',
            destCode: b.route?.destination_station_code || 'MMCT',
            destName: 'Destination Station',
            depTime: b.route?.departure_time || '08:00',
            arrTime: b.route?.arrival_time || '20:00',
            distance: (b.route?.distance_km || 850) + ' km',
            duration: '12h 00m',
            journeyDate: b.travel_date || '2026-09-10',
            quota: b.quota || 'General (GN)',
            class: b.coach_class || '3A',
            status: b.status 
              ? b.status.toLowerCase() === 'cancelled'
                ? 'Cancelled'
                : b.status.toUpperCase() === 'WAITLIST' || b.status.toUpperCase() === 'WAITING'
                  ? 'Waiting' 
                  : b.status.toUpperCase() === 'RAC' 
                    ? 'RAC' 
                    : b.status.charAt(0).toUpperCase() + b.status.slice(1).toLowerCase()
              : 'Confirmed',
            passengers: mappedPassengers,
            fareDetails: {
              baseFare: totalFare,
              taxGst: Math.round(totalFare * 0.05),
              reservationFee: 40,
              tatkalCharges: 0,
              totalFare: totalFare + Math.round(totalFare * 0.05) + 40
            },
            payment: {
              txnId: b.payment?.transaction_id || 'TXN' + Math.floor(Math.random()*100000000),
              method: b.payment?.payment_method || 'Online Payment',
              status: b.payment?.status?.toUpperCase() || (b.status === 'cancelled' ? 'REFUNDED' : 'SUCCESS'),
              timestamp: b.created_at ? new Date(b.created_at).toLocaleString('en-IN') : 'Completed'
            }
          };
        });
        setBookings(mapped);
      }
    } catch (err) {
      console.warn('API error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter(bk => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        bk.primaryPassenger.toLowerCase().includes(searchLower) || 
        bk.pnr.includes(searchTerm) ||
        bk.trainName.toLowerCase().includes(searchLower) ||
        bk.trainNo.includes(searchTerm) ||
        bk.journeyDate.includes(searchTerm) ||
        bk.email.toLowerCase().includes(searchLower) ||
        bk.phone.includes(searchTerm);

      const matchesStatus = statusFilter === 'All' || bk.status === statusFilter;
      const matchesClass = classFilter === 'All' || bk.class === classFilter;

      return matchesSearch && matchesStatus && matchesClass;
    });
  }, [bookings, searchTerm, statusFilter, classFilter]);

  const totalConfirmed = bookings.filter(b => b.status === 'Confirmed').length;
  const totalRAC = bookings.filter(b => b.status === 'RAC').length;
  const totalWaiting = bookings.filter(b => b.status === 'Waiting').length;
  const totalCancelled = bookings.filter(b => b.status === 'Cancelled').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.fareDetails?.totalFare || 0), 0);

  // Policy calculation for cancel modal
  const calculatedCancelDetails = useMemo(() => {
    if (!cancelModalBooking) return { originalFare: 0, penalty: 0, refundAmount: 0 };
    const totalFare = cancelModalBooking.fareDetails?.totalFare || 0;
    
    if (isAdminOverride) {
      const penalty = Math.min(totalFare, Math.max(0, Number(overridePenalty || 0)));
      const refundAmount = Math.max(0, totalFare - penalty);
      return { originalFare: totalFare, penalty, refundAmount };
    }

    const now = new Date();
    const journeyDate = new Date(cancelModalBooking.journeyDate || now);
    const diffHours = (journeyDate - now) / (1000 * 60 * 60);

    let penalty = 0;
    if (diffHours > 48) {
      penalty = Math.min(totalFare, 240);
    } else if (diffHours >= 12) {
      penalty = Math.round(totalFare * 0.25);
    } else if (diffHours >= 4) {
      penalty = Math.round(totalFare * 0.50);
    } else {
      penalty = totalFare;
    }

    const refundAmount = Math.max(0, totalFare - penalty);
    return { originalFare: totalFare, penalty, refundAmount };
  }, [cancelModalBooking, isAdminOverride, overridePenalty]);

  const handleOpenCancelModal = (bk) => {
    setCancelModalBooking(bk);
    setCancelReason('Passenger Request');
    setCustomReason('');
    setIsAdminOverride(false);
    setOverridePenalty(0);
  };

  const handleExecuteCancel = async () => {
    if (!cancelModalBooking) return;
    const finalReason = cancelReason === 'Other' ? customReason : cancelReason;

    if (!finalReason || !finalReason.trim()) {
      showToast('Please select or specify a cancellation reason.', 'error');
      return;
    }

    setCancelling(true);
    try {
      await api.put(`/bookings/${cancelModalBooking.id || cancelModalBooking.pnr}/cancel`, {
        reason: finalReason,
        cancellation_reason: finalReason,
        is_override: isAdminOverride,
        override_penalty: overridePenalty,
        refund_amount: calculatedCancelDetails.refundAmount
      });

      showToast(`Ticket #${cancelModalBooking.pnr} cancelled successfully. Refund of ₹${calculatedCancelDetails.refundAmount.toLocaleString()} initiated.`, 'success');
      setCancelModalBooking(null);
      if (selectedBooking && selectedBooking.pnr === cancelModalBooking.pnr) {
        setSelectedBooking(null);
      }
      fetchBookings();
    } catch (err) {
      console.error('Cancellation error:', err);
      showToast('Cancellation failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-primary-50 text-primary-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-primary-200">
              Staff Control Center
            </span>
            <span className="text-xs text-slate-400 font-bold">• Master Roster Access</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Master Booking & Administrative Cancellation
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Real-time passenger dossier inspection, administrative overrides, and ticket cancellations.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchBookings} 
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition active:scale-95 border border-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings Inspected', value: bookings.length, sub: 'Active PNR Database', color: 'text-blue-600 bg-blue-500/10 border-blue-100', icon: BookOpen },
          { label: 'Confirmed Passengers', value: totalConfirmed, sub: 'Seats Reserved', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-100', icon: CheckCircle2 },
          { label: 'Cancelled Bookings', value: totalCancelled, sub: 'Refund Processed', color: 'text-rose-600 bg-rose-500/10 border-rose-100', icon: XCircle },
          { label: 'Total Ticket Value', value: `₹${totalRevenue.toLocaleString('en-IN')}`, sub: 'Audited Payment Value', color: 'text-purple-600 bg-purple-500/10 border-purple-100', icon: DollarSign }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/80 p-4 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                <span className="text-xl font-black text-slate-800 mt-0.5 block">{stat.value}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{stat.sub}</span>
              </div>
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${stat.color} font-bold`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls & Filtering Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        {/* Search */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 w-full lg:w-96 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition">
          <Search className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search PNR, Passenger, Train, Journey Date, Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-bold text-slate-700"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
              {['All', 'Confirmed', 'RAC', 'Waiting', 'Cancelled'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-black transition ${
                    statusFilter === f ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Class:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none"
            >
              {['All', '1A', '2A', '3A', 'SL', 'CC'].map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Classes' : `${c} Class`}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Bookings Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">PNR & Booking Date</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Primary Passenger</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Train & Journey</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Seats & Class</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Fare Paid</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right pr-8">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-xs font-bold text-slate-400">
                    No bookings match your current search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map(bk => (
                  <tr key={bk.pnr} className="hover:bg-slate-50/50 transition group">
                    {/* PNR & Date */}
                    <td className="px-6 py-4.5 pl-8">
                      <span className="font-mono text-xs font-black text-primary-600 block bg-primary-50/60 border border-primary-100 px-2 py-0.5 rounded-lg w-fit">
                        #{bk.pnr}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                        Booked: {bk.bookingDate}
                      </span>
                    </td>

                    {/* Primary Passenger */}
                    <td className="px-6 py-4.5">
                      <div className="flex items-center space-x-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-black text-xs">
                          {bk.primaryPassenger.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="font-black text-slate-800 text-xs block">{bk.primaryPassenger}</span>
                          <span className="text-[10px] text-slate-400 font-bold block">{bk.phone}</span>
                          {bk.passengers.length > 1 && (
                            <span className="text-[9px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                              +{bk.passengers.length - 1} Co-passengers
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Train Info */}
                    <td className="px-6 py-4.5">
                      <div className="text-xs">
                        <span className="font-black text-slate-800 block">{bk.trainName}</span>
                        <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-500 mt-0.5">
                          <span className="font-bold text-slate-700">#{bk.trainNo}</span>
                          <span>•</span>
                          <span>{bk.sourceCode} → {bk.destCode}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">
                          Date: <strong className="text-slate-700 font-bold">{bk.journeyDate}</strong>
                        </span>
                      </div>
                    </td>

                    {/* Class & Seat */}
                    <td className="px-6 py-4.5 text-xs">
                      <span className="font-black text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px] inline-block">
                        {bk.class} Class ({bk.quota})
                      </span>
                      <div className="text-[10px] font-mono font-bold text-slate-600 mt-1">
                        {bk.passengers.map(p => p.seat).join(', ')}
                      </div>
                    </td>

                    {/* Fare */}
                    <td className="px-6 py-4.5 text-xs">
                      <span className="font-black text-slate-800 block">₹{bk.fareDetails.totalFare.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block mt-0.5">
                        {bk.payment.method}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4.5 text-xs font-bold">
                      <span className={`inline-flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        bk.status === 'Confirmed' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : bk.status === 'RAC' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : bk.status === 'Cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        <span>{bk.status}</span>
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4.5 text-right pr-8">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => { setSelectedBooking(bk); setActiveTab('passengers'); }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition active:scale-95"
                          title="Inspect Passenger Dossier"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Dossier</span>
                        </button>

                        {bk.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleOpenCancelModal(bk)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition active:scale-95"
                            title="Cancel Booking"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADMIN CANCEL BOOKING MODAL */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Cancel Passenger Booking</h3>
                  <p className="text-xs text-slate-500 font-semibold">Administrative Ticket Cancellation Override</p>
                </div>
              </div>
              <button 
                onClick={() => setCancelModalBooking(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Ticket & Calculation Details */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 text-xs font-semibold text-slate-700 border border-slate-200/80">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">PNR Number:</span>
                <span className="font-mono font-black text-slate-900">#{cancelModalBooking.pnr}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Primary Passenger:</span>
                <span className="font-black text-slate-900">{cancelModalBooking.primaryPassenger}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Train Service:</span>
                <span className="font-bold text-slate-800">{cancelModalBooking.trainName} (#{cancelModalBooking.trainNo})</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Journey Date:</span>
                <span className="font-bold text-slate-800">{cancelModalBooking.journeyDate}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Original Amount Paid:</span>
                <span className="font-mono font-black text-slate-900">₹{calculatedCancelDetails.originalFare.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2 text-rose-600">
                <span>Applicable Penalty / Deduction:</span>
                <span className="font-mono font-black">₹{calculatedCancelDetails.penalty.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 pt-1 font-black text-sm">
                <span>Calculated Refund Amount:</span>
                <span className="font-mono">₹{calculatedCancelDetails.refundAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Cancellation Reason Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-primary-500"
              >
                <option value="Passenger Request">Passenger Request</option>
                <option value="Operational Issue">Operational Issue</option>
                <option value="Duplicate Booking">Duplicate Booking</option>
                <option value="Payment Issue">Payment Issue</option>
                <option value="Emergency">Emergency</option>
                <option value="Admin Override">Admin Override</option>
                <option value="Other">Other</option>
              </select>

              {cancelReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify custom cancellation reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 mt-2 focus:outline-none focus:bg-white focus:border-primary-500"
                />
              )}
            </div>

            {/* Admin Override Toggle Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAdminOverride}
                  onChange={(e) => setIsAdminOverride(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-0 h-4 w-4"
                />
                <span className="text-xs font-black text-amber-900">Enable Administrative Override</span>
              </label>

              {isAdminOverride && (
                <div className="pt-2 border-t border-amber-200/80 space-y-2 text-xs">
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                    <strong>Administrative Action Notice:</strong> Administrative override allows manual penalty adjustments. Action is logged with Staff User ID for compliance auditing.
                  </p>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">Override Penalty Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      max={calculatedCancelDetails.originalFare}
                      value={overridePenalty}
                      onChange={(e) => setOverridePenalty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                    <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">Set to ₹0 for 100% full refund</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Keep Booking
              </button>
              <button
                onClick={handleExecuteCancel}
                disabled={cancelling}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition shadow-md shadow-rose-600/20 active:scale-95 flex items-center space-x-1.5"
              >
                <XCircle className="h-4 w-4" />
                <span>{cancelling ? 'Cancelling...' : 'Confirm Ticket Cancellation'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* COMPREHENSIVE BOOKING & PASSENGER DOSSIER MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-primary-500 text-white font-mono text-xs font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    PNR: {selectedBooking.pnr}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    selectedBooking.status === 'Confirmed' ? 'bg-emerald-500 text-white' : selectedBooking.status === 'RAC' ? 'bg-amber-500 text-slate-900' : selectedBooking.status === 'Cancelled' ? 'bg-rose-500 text-white' : 'bg-indigo-500 text-white'
                  }`}>
                    {selectedBooking.status}
                  </span>
                </div>
                <h2 className="text-xl font-black mt-2 tracking-tight">
                  {selectedBooking.trainName} (#{selectedBooking.trainNo})
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center space-x-2">
                  <span>{selectedBooking.sourceName} ({selectedBooking.sourceCode})</span>
                  <span>→</span>
                  <span>{selectedBooking.destName} ({selectedBooking.destCode})</span>
                  <span>•</span>
                  <span>Travel Date: {selectedBooking.journeyDate}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                    Passenger Roster & Seat Allocations
                  </h3>
                  <div className="space-y-2">
                    {selectedBooking.passengers.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs">
                        <span className="font-bold text-slate-800">{p.name} ({p.age} Yrs, {p.gender})</span>
                        <span className="font-mono font-bold text-primary-700">{p.seat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">
                Inspected by Authorized Railway Staff
              </span>
              <div className="flex items-center space-x-3">
                {selectedBooking.status !== 'Cancelled' && (
                  <button
                    onClick={() => { handleOpenCancelModal(selectedBooking); }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition active:scale-95 flex items-center space-x-1.5"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel Ticket</span>
                  </button>
                )}
                <button 
                  onClick={() => setSelectedBooking(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black transition active:scale-95"
                >
                  Close Dossier
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default StaffBookings;
