import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Train, MapPin, Ticket, ShieldAlert, CheckCircle2, 
  Clock, XCircle, Utensils, Download, ArrowRight, ShieldCheck, RefreshCw, FileText, Star
} from 'lucide-react';
import api from '../services/api';
import { indianStations } from '../utils/stationsData';
import { useAuth } from '../context/AuthContext';

const getStationName = (code) => {
  if (!code) return '';
  const station = indianStations.find(s => s.code === code);
  return station ? `${station.name} (${code})` : code;
};

const MyBookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      if (res.data) {
        setBookings(res.data);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleRequestCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to request cancellation for this ticket?')) return;
    try {
      await api.put(`/bookings/${bookingId}/request-cancel`);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancel_requested' } : b));
      alert('Cancellation request submitted successfully to Admin. It will show as Cancelled once approved.');
      fetchBookings();
    } catch (err) {
      console.error(err);
      alert('Failed to submit cancellation request.');
    }
  };

  const isBookingCompleted = (b) => {
    if (String(b.status).toLowerCase() === 'cancelled') return false;
    if (String(b.status).toLowerCase() === 'completed') return true;

    if (b.destination_arrival_date_time) {
      const arrMs = new Date(b.destination_arrival_date_time).getTime();
      if (!isNaN(arrMs) && Date.now() >= arrMs) return true;
    }

    return false;
  };

  const isBookingCancelled = (b) => {
    return String(b.status).toLowerCase() === 'cancelled';
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this ticket reservation? This action cannot be undone.')) return;
    try {
      const res = await api.put(`/bookings/${bookingId}/cancel`);
      
      setBookings(prev => prev.map(b => b.id === bookingId ? { 
        ...b, 
        status: 'cancelled',
        cancellation_date_time: new Date().toISOString(),
        refund_status: 'REFUNDED',
        refund_amount: b.total_fare
      } : b));
      setActiveTab('cancelled');
      
      alert('Ticket cancelled successfully. Refund of ₹' + (res.data?.booking?.total_fare || 'fare') + ' has been initiated to your account.');
      fetchBookings();
    } catch (err) {
      console.error('Cancellation failed:', err);
      alert('Cancellation failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const getFilteredBookings = () => {
    return bookings.filter(b => {
      if (activeTab === 'all') return true;
      if (activeTab === 'cancelled') return isBookingCancelled(b);
      if (isBookingCancelled(b)) return false;
      if (activeTab === 'completed') return isBookingCompleted(b);
      return !isBookingCompleted(b); // 'upcoming'
    });
  };

  const filtered = getFilteredBookings();

  const upcomingCount = bookings.filter(b => !isBookingCancelled(b) && !isBookingCompleted(b)).length;
  const completedCount = bookings.filter(b => isBookingCompleted(b)).length;
  const cancelledCount = bookings.filter(b => isBookingCancelled(b)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Page Header */}
      <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary-500/20 text-primary-300 border border-primary-500/30">
              IRCTC Booking Manager
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">My Journey Reservations</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Access e-tickets, completed trip receipts, seat allocations, and meal pre-orders.</p>
        </div>

        <button
          onClick={fetchBookings}
          className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition flex items-center space-x-1.5 active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Bookings</span>
        </button>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex border-b border-slate-200 gap-4 sm:gap-6 overflow-x-auto">
        {[
          { id: 'upcoming', label: 'Upcoming Journeys', count: upcomingCount },
          { id: 'completed', label: 'Completed Journeys', count: completedCount },
          { id: 'cancelled', label: 'Cancelled Tickets', count: cancelledCount },
          { id: 'all', label: 'All Bookings', count: bookings.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-xs sm:text-sm font-black border-b-2 transition flex items-center space-x-2 shrink-0 ${
              activeTab === tab.id 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === tab.id ? 'bg-primary-100 text-primary-800 font-bold' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Helpful banner if upcoming is 0 but completed or all has tickets */}
      {activeTab === 'upcoming' && upcomingCount === 0 && (completedCount > 0 || bookings.length > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs font-semibold">
          <span>
            💡 <strong>Note:</strong> Your booked ticket date has reached or passed today's date, so it is listed in the <strong>Completed Journeys</strong> or <strong>All Bookings</strong> tab.
          </span>
          <button
            onClick={() => setActiveTab('all')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 shadow-sm transition"
          >
            View All Bookings
          </button>
        </div>
      )}

      {/* Bookings List Output */}
      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
          Loading your travel reservations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
          <Ticket className="mx-auto h-12 w-12 text-slate-300" />
          <p className="font-extrabold text-slate-700 text-sm">No {activeTab} journeys found</p>
          <p className="text-xs text-slate-400">You have no {activeTab} reservation logs associated with your account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const isCompleted = isBookingCompleted(b);
            const isCancelled = isBookingCancelled(b);

            return (
              <div 
                key={b.id} 
                className={`rounded-3xl border bg-white p-6 shadow-sm space-y-4 transition ${
                  isCancelled 
                    ? 'border-rose-200/80 bg-gradient-to-r from-rose-50/20 via-white to-white' 
                    : isCompleted 
                    ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/20 via-white to-white' 
                    : 'border-slate-200'
                }`}
              >
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isCancelled
                        ? 'bg-rose-100 text-rose-800'
                        : isCompleted 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-primary-50 text-primary-700'
                    }`}>
                      <Train className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm sm:text-base">
                        {b.train?.train_name || b.train_name || 'Train details unavailable'} {(b.train?.train_number || b.train_number) ? <span className="font-mono text-slate-400 text-xs">#{b.train?.train_number || b.train_number}</span> : null}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono font-bold">PNR: {b.pnr_number}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                    isCancelled
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-primary-100 text-primary-800 border border-primary-200'
                  }`}>
                    {isCancelled ? (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-rose-700" />
                        <span>CANCELLED</span>
                      </>
                    ) : isCompleted ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Journey Completed</span>
                      </>
                    ) : (
                      <span>● Status: {b.status ? b.status.toUpperCase() : 'CONFIRMED'}</span>
                    )}
                  </span>
                </div>

                {/* Train Disruptions / Status Banner */}
                {b.train && b.train.status && b.train.status !== 'on_time' && !isCancelled && (
                  <div className={`p-4 rounded-2xl border text-xs font-semibold flex flex-col gap-1 shadow-sm ${
                    b.train.status === 'cancelled'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : b.train.status === 'delayed'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-purple-50 border-purple-200 text-purple-900'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className={`h-2 w-2 rounded-full ${
                        b.train.status === 'cancelled'
                          ? 'bg-rose-650 animate-ping'
                          : b.train.status === 'delayed'
                          ? 'bg-amber-650 animate-pulse'
                          : 'bg-purple-650 animate-pulse'
                      }`}></span>
                      <span className="uppercase tracking-wide font-extrabold text-[10px]">
                        Service Announcement &mdash; Train Status: {b.train.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      {b.train.status === 'cancelled' && (
                        <p className="leading-relaxed">
                          ⚠️ Train has been cancelled by railway administration. {b.train.cancellation_reason ? `Reason: ${b.train.cancellation_reason}.` : ''} {b.train.cancellation_message || ''}
                        </p>
                      )}
                      {b.train.status === 'delayed' && (
                        <p className="leading-relaxed">
                          🕒 Train is delayed by {b.train.delay_minutes} minutes. {b.train.delay_reason ? `Reason: ${b.train.delay_reason}.` : ''} {b.train.delay_message || ''}
                          <br />
                          <span className="mt-1 block text-[10px] text-amber-700 font-mono">
                            Scheduled Dep: {b.train.scheduled_departure_time?.slice(0,5) || b.route?.departure_time?.slice(0,5) || '--:--'} &rarr; Updated Dep: {b.train.updated_departure_time?.slice(0,5) || '--:--'}
                          </span>
                        </p>
                      )}
                      {b.train.status === 'rescheduled' && (
                        <p className="leading-relaxed">
                          📅 Train is rescheduled. {b.train.delay_reason ? `Reason: ${b.train.delay_reason}.` : ''} {b.train.delay_message || ''}
                          <br />
                          <span className="mt-1 block text-[10px] text-purple-700 font-mono">
                            Original: {b.train.scheduled_departure_time?.slice(0,5) || b.route?.departure_time?.slice(0,5) || '--:--'} &rarr; Rescheduled: {b.train.updated_departure_time?.slice(0,5) || '--:--'}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Journey Route & Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Departure Station</span>
                    <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                      {b.route?.source_station_code ? getStationName(b.route.source_station_code) : b.train?.source ? getStationName(b.train.source) : b.source ? getStationName(b.source) : 'Not specified'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">Dep: {b.route?.departure_time || b.train?.departure_time || b.departure_time || '--:--'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Destination Station</span>
                    <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                      {b.route?.destination_station_code ? getStationName(b.route.destination_station_code) : b.train?.destination ? getStationName(b.train.destination) : b.destination ? getStationName(b.destination) : 'Not specified'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold">Arr: {b.route?.arrival_time || b.train?.arrival_time || b.arrival_time || '--:--'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Travel Date & Class</span>
                    <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{b.travel_date}</span>
                    <span className="text-[10px] font-bold text-primary-700">{b.coach_class ? `Class ${b.coach_class}` : 'Standard Class'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Fare Paid</span>
                    <span className="font-mono font-black text-emerald-700 text-sm mt-0.5 block">₹{b.total_fare}</span>
                    <span className="text-[10px] font-bold text-slate-400">{(b.allocations && b.allocations.length) || (b.passengers && b.passengers.length) || 1} Passenger(s)</span>
                  </div>
                </div>

                {/* Booked Passengers & Allocated Seats List */}
                <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 space-y-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Booked Passenger(s) & Seat Allocations
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {(b.allocations && b.allocations.length > 0 ? b.allocations : (b.passengers || [{ passenger_name: user?.full_name || 'Passenger' }])).map((p, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs">
                        <div>
                          <p className="font-extrabold text-slate-800">{p.passenger_name || p.name || user?.full_name || 'Passenger'}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{(p.passenger_age || p.age) ? `${p.passenger_age || p.age} yrs` : ''} {(p.passenger_gender || p.gender) ? `• ${p.passenger_gender || p.gender}` : ''}</p>
                        </div>
                        {(p.coach_number || p.seat_number) && (
                          <div className="text-right">
                            <span className="font-mono font-black text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg border border-primary-100 text-xs block">
                              {p.coach_number || ''}{p.seat_number ? `-${p.seat_number}` : ''}
                            </span>
                            {p.berth_type && <span className="text-[9px] font-bold text-slate-400 uppercase font-mono mt-0.5 block">{p.berth_type}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cancelled Details Highlights Banner */}
                {isCancelled && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between text-rose-950 gap-3">
                    <div>
                      <span className="font-black text-rose-900 block">Cancellation Recorded</span>
                      <span className="text-rose-700 text-[11px] block mt-0.5">
                        Cancelled on: <strong>{b.cancellation_date_time ? new Date(b.cancellation_date_time).toLocaleString() : 'Recent'}</strong>
                      </span>
                      {b.cancellation_reason && (
                        <span className="text-rose-600 text-[10px] block mt-0.5 italic">Reason: {b.cancellation_reason}</span>
                      )}
                    </div>
                    <div className="bg-white px-3 py-2 rounded-xl border border-rose-200 text-right shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Refund Status</span>
                      <span className="font-mono font-black text-emerald-700 text-xs block">
                        ₹{b.refund_amount !== undefined ? b.refund_amount : b.total_fare} ({b.refund_status || 'REFUNDED'})
                      </span>
                    </div>
                  </div>
                )}

                {/* Completed Details Highlights Banner */}
                {isCompleted && (
                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between text-emerald-950 gap-3">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span>This journey has been successfully completed. How was your experience?</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/passenger/feedback?pnr=${b.pnr_number}`)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition shadow-md flex items-center space-x-1.5 active:scale-95 shrink-0"
                    >
                      <Star className="h-3.5 w-3.5 fill-slate-950 text-slate-950" />
                      <span>Rate & Review Journey</span>
                    </button>
                  </div>
                )}

                {/* Actions Footer Bar */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  {!isCancelled && isCompleted && (
                    <button
                      type="button"
                      onClick={() => navigate(`/passenger/feedback?pnr=${b.pnr_number}`)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center space-x-1.5 shadow-sm active:scale-95"
                    >
                      <Star className="h-3.5 w-3.5 fill-slate-950 text-slate-950" />
                      <span>Rate & Review Journey</span>
                    </button>
                  )}

                  {!isCancelled && !isCompleted && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition active:scale-95 flex items-center space-x-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      <span>Request Cancellation</span>
                    </button>
                  )}

                  {!isCancelled && !isCompleted && (
                    <button
                      onClick={() => navigate(`/passenger/catering?pnr=${b.pnr_number}`)}
                      className="px-4 py-2 rounded-xl border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition flex items-center space-x-1.5"
                    >
                      <Utensils className="h-3.5 w-3.5 text-amber-700" />
                      <span>Order Seat Meals</span>
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/passenger/ticket/${b.pnr_number}`)}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-sm active:scale-95"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>View Full E-Ticket</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default MyBookings;
