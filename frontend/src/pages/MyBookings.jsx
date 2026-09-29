import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Train, MapPin, Ticket, ShieldAlert, CheckCircle2, 
  Clock, Utensils, RefreshCw, FileText, Star, User, Bell, 
  Lock, HelpCircle, LogOut, Radio, Info, ChevronRight, ShieldCheck, ArrowRight, AlertTriangle, XCircle
} from 'lucide-react';
import api from '../services/api';
import { indianStations } from '../utils/stationsData';
import { useAuth } from '../context/AuthContext';
import { getClassFullName } from '../utils/trainClasses';
import { isFoodEligibleClass } from '../utils/cateringEligibilityHelper';

const addMinutesToTime = (timeStr, mins) => {
  if (!timeStr) return '06:00';
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  const total = h * 60 + m + (parseInt(mins, 10) || 0);
  let norm = total % (24 * 60);
  if (norm < 0) norm += 24 * 60;
  const newH = Math.floor(norm / 60);
  const newM = norm % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

const getStationName = (code) => {
  if (!code || code === 'undefined') return '';
  const cleanCode = String(code).toUpperCase().trim();
  const station = indianStations.find(s => s.code === cleanCode);
  return station ? `${station.name} (${cleanCode})` : cleanCode;
};

const isInvalidStation = (val) => {
  if (!val) return true;
  const str = String(val).trim().toUpperCase();
  return str === 'ADMIN' || str === 'UNDEFINED' || str === 'NULL' || str.includes('ADMIN');
};

const formatStationDisplay = (rawName, rawCode, fallbackCode = 'NDLS') => {
  let code = (rawCode && !isInvalidStation(rawCode)) ? String(rawCode).toUpperCase().trim() : '';
  let name = (rawName && !isInvalidStation(rawName)) ? String(rawName).trim() : '';

  if (!code && !name) {
    code = fallbackCode || 'NDLS';
    name = getStationName(code) || 'New Delhi';
  }

  if (name && name.includes('(') && !isInvalidStation(name)) {
    return name;
  }

  if (code && (!name || name.toUpperCase() === code || isInvalidStation(name))) {
    const resolved = getStationName(code) || (code === 'NDLS' ? 'New Delhi' : code);
    return resolved.includes('(') ? resolved : `${resolved} (${code})`;
  }

  if (name && code) {
    const cleanName = name.replace(/\s*\([^)]*\)/g, '').trim().toUpperCase();
    return `${cleanName} (${code})`;
  }

  return name || (code ? `${code} (${code})` : 'Station');
};

const MyBookings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'all'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const isBookingCompleted = (b) => {
    if (String(b.status || b.booking_status || '').toLowerCase() === 'cancelled') return false;
    if (String(b.status || b.booking_status || '').toLowerCase() === 'completed') return true;

    const todayStr = new Date().toISOString().split('T')[0];
    if (b.travel_date && b.travel_date < todayStr) return true;

    if (b.destination_arrival_date_time) {
      const arrMs = new Date(b.destination_arrival_date_time).getTime();
      if (!isNaN(arrMs) && Date.now() >= arrMs) return true;
    }

    return false;
  };

  const isBookingCancelled = (b) => {
    const s = String(b.status || b.booking_status || '').toLowerCase();
    return s === 'cancelled' || s === 'cancel_requested';
  };

  const getFilteredBookings = () => {
    return bookings.filter(b => {
      if (activeTab === 'cancelled') return isBookingCancelled(b);
      if (activeTab === 'completed') return !isBookingCancelled(b) && isBookingCompleted(b);
      if (activeTab === 'upcoming') return !isBookingCancelled(b) && !isBookingCompleted(b);
      return true; // 'all' shows all bookings (upcoming, completed, and cancelled)
    });
  };

  const filtered = getFilteredBookings();

  const cancelledCount = bookings.filter(b => isBookingCancelled(b)).length;
  const upcomingCount = bookings.filter(b => !isBookingCancelled(b) && !isBookingCompleted(b)).length;
  const completedCount = bookings.filter(b => !isBookingCancelled(b) && isBookingCompleted(b)).length;
  const allCount = bookings.length;

  const handleLogout = () => {
    logout('passenger');
    window.location.replace('/passenger/login');
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'P';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="mx-auto max-w-7xl font-sans text-slate-900 space-y-5 animate-slide-in pb-12">
      
      {/* -------------------------------------------------- */}
      {/* TOP RAILWAY INFORMATION BAR */}
      {/* -------------------------------------------------- */}
      <div className="bg-slate-900 text-slate-300 text-[11px] px-3 py-1.5 rounded-lg flex flex-wrap items-center justify-between border border-slate-800 gap-2">
        <div className="flex items-center space-x-2 shrink-0">
          <span className="bg-blue-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded tracking-wider uppercase">
            RAILCONTROL BULLETIN
          </span>
          <span className="font-semibold text-slate-200">Travel Advisory:</span>
          <span className="text-slate-300 hidden sm:inline">Carry valid government-issued photo ID during journey.</span>
        </div>

        <div className="flex items-center space-x-4 text-[10px] font-mono shrink-0">
          <span className="flex items-center space-x-1 text-slate-300 hidden md:flex">
            <Lock className="h-3 w-3 text-emerald-400" />
            <span>256-BIT SSL ENCRYPTED</span>
          </span>
          <span className="text-slate-400 hidden md:inline">|</span>
          <button onClick={() => navigate('/passenger/support')} className="hover:text-white transition flex items-center space-x-1 text-slate-300">
            <HelpCircle className="h-3 w-3 text-blue-400" />
            <span>Passenger Support</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* MAIN PORTAL HEADER */}
      {/* -------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Brand & Designation */}
        <div className="flex items-center space-x-3">
          <div className="h-11 w-11 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 border border-blue-400/30 shadow-inner">
            <Train className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">RAILCONTROL</h1>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30 font-mono">
                PASSENGER PORTAL
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-semibold tracking-wide">
              INDIAN RAILWAYS E-TICKETING & RESERVATION SYSTEM
            </p>
          </div>
        </div>

        {/* Status, Time & Passenger Profile */}
        <div className="flex flex-wrap items-center gap-3.5 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
          <div className="text-right hidden lg:block">
            <div className="text-[11px] font-mono font-bold text-slate-200">{currentTime}</div>
          </div>

          <button 
            onClick={() => navigate('/passenger/notifications')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition relative border border-slate-700"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500"></span>
          </button>

          {/* User Profile Bar */}
          <div className="flex items-center space-x-2.5 bg-slate-800/90 p-1.5 pr-3 rounded-lg border border-slate-700">
            <div className="h-8 w-8 rounded bg-blue-600 font-black text-white text-xs flex items-center justify-center border border-blue-400/40">
              {getInitials(user?.full_name)}
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-black text-white truncate max-w-[130px]">{user?.full_name || 'Passenger User'}</p>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">PASSENGER</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* MAIN TITLE BLOCK */}
      {/* -------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
            MY JOURNEY RESERVATIONS
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Access e-tickets, completed journeys, seat allocations, and meal pre-orders.
          </p>
        </div>

        <button
          onClick={fetchBookings}
          className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition flex items-center space-x-1.5 active:scale-95 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Bookings</span>
        </button>
      </div>

      {/* -------------------------------------------------- */}
      {/* BOOKING FILTER TABS */}
      {/* -------------------------------------------------- */}
      <div className="flex border-b-2 border-slate-200 gap-2 sm:gap-6 overflow-x-auto bg-white px-3 pt-2 rounded-t-xl">
        {[
          { id: 'upcoming', label: 'Upcoming Journeys', count: upcomingCount },
          { id: 'completed', label: 'Completed Journeys', count: completedCount },
          { id: 'cancelled', label: 'Cancelled Journeys', count: cancelledCount },
          { id: 'all', label: 'All Bookings', count: allCount }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2.5 text-xs sm:text-sm font-black border-b-2 transition flex items-center space-x-2 shrink-0 ${
              activeTab === tab.id 
                ? tab.id === 'cancelled' ? 'border-rose-700 text-rose-700' : 'border-blue-700 text-blue-700' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              activeTab === tab.id 
                ? tab.id === 'cancelled' ? 'bg-rose-100 text-rose-900 border border-rose-200' : 'bg-blue-100 text-blue-900 border border-blue-200' 
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Notice Banner if upcoming is 0 but completed or all has tickets */}
      {activeTab === 'upcoming' && upcomingCount === 0 && completedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <Info className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Your travel date has reached or passed today's date, so your ticket is listed under <strong>Completed Journeys</strong> or <strong>All Bookings</strong>.</span>
          </div>
          <button
            onClick={() => setActiveTab('all')}
            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition"
          >
            View All Bookings
          </button>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* BOOKINGS LISTING */}
      {/* -------------------------------------------------- */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 font-bold text-xs space-y-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-r-transparent mx-auto"></div>
          <p>Fetching journey reservations from RailControl server...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 space-y-2">
          <Ticket className="mx-auto h-10 w-10 text-slate-300" />
          <p className="font-extrabold text-slate-800 text-sm">No {activeTab} reservations found</p>
          <p className="text-xs text-slate-500">There are no {activeTab} railway tickets associated with your passenger account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const isCompleted = isBookingCompleted(b);

            const displayTrainName = b.train?.train_name || b.train_name || 'Railway Express';
            const displayTrainNumber = b.train?.train_number || b.train_number || 'N/A';
            
            const rawStatus = (b.booking_status || b.status || 'CONFIRMED').toUpperCase();
            const isCancelled = rawStatus === 'CANCELLED' || String(b.status || b.booking_status || '').toLowerCase() === 'cancelled';
            const formattedStatus = isCompleted 
              ? '● STATUS: COMPLETED' 
              : isCancelled
              ? '● STATUS: CANCELLED'
              : rawStatus.includes('CNF') || rawStatus === 'CONFIRMED'
              ? '● STATUS: CNF'
              : rawStatus.includes('RAC')
              ? `● STATUS: RAC ${b.current_status_number || b.booking_status_number || ''}`
              : rawStatus.includes('WL') || rawStatus.includes('WAITING')
              ? `● STATUS: WL ${b.current_status_number || b.booking_status_number || ''}`
              : `● STATUS: ${rawStatus}`;

            const baseFareCalculated = b.base_fare || (b.total_fare ? Math.max(0, b.total_fare - (b.food_amount || 0)) : 0);

            return (
              <div 
                key={b.id} 
                className={`rounded-xl border bg-white shadow-2xs overflow-hidden transition-all ${
                  isCancelled
                    ? 'border-rose-300'
                    : isCompleted 
                    ? 'border-emerald-300' 
                    : 'border-slate-300'
                }`}
              >
                {/* -------------------------------------------------- */}
                {/* CARD HEADER */}
                {/* -------------------------------------------------- */}
                <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded bg-blue-600 flex items-center justify-center shrink-0 border border-blue-400/40">
                      <Train className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                          {displayTrainName}
                        </h3>
                        <span className="font-mono text-xs font-bold text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded border border-blue-700/50">
                          #{displayTrainNumber}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-300 mt-0.5 flex-wrap">
                        <span>PNR: <strong className="text-white font-mono">{b.pnr_number}</strong></span>
                        <span className="text-slate-600">|</span>
                        <span>IRCTC/RAILCONTROL ID: <strong className="text-slate-200">{b.irctc_id || 'RC' + (b.id || '001')}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Formal Railway Status Badge */}
                  <div className={`px-3 py-1 rounded text-xs font-mono font-black uppercase tracking-wider ${
                    isCancelled
                      ? 'bg-rose-900/80 text-rose-200 border border-rose-700'
                      : isCompleted
                      ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                      : rawStatus.includes('CNF') || rawStatus === 'CONFIRMED'
                      ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                      : rawStatus.includes('RAC')
                      ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                      : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                  }`}>
                    {formattedStatus}
                  </div>
                </div>

                {/* -------------------------------------------------- */}
                {/* CANCELLED TICKET NOTIFICATION BANNER */}
                {/* -------------------------------------------------- */}
                {isCancelled && (
                  <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs flex items-center justify-between flex-wrap gap-2 text-rose-900">
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" />
                      <span className="font-extrabold uppercase tracking-wide">
                        Journey Ticket Cancelled
                      </span>
                      <span className="text-[11px] text-rose-700">
                        • Refund has been processed to passenger payment source
                      </span>
                    </div>
                    {b.refund_amount != null && (
                      <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded border border-rose-200">
                        Refund: ₹{parseFloat(b.refund_amount || 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------- */}
                {/* OPERATIONAL DISRUPTION WARNING BANNER */}
                {/* -------------------------------------------------- */}
                {((b.operational_disruption && b.operational_disruption.status !== 'on_time') || (b.train && b.train.status && b.train.status !== 'on_time')) && (() => {
                  const dis = b.operational_disruption || {};
                  const activeStatus = (dis.status || b.train?.status || 'delayed').toLowerCase();
                  const delayMins = dis.delay_minutes ?? (b.train?.delay_minutes || 0);
                  const reason = dis.reason || b.train?.delay_reason || b.train?.cancellation_reason || 'Operational adjustment';
                  const origDep = b.route?.departure_time || b.train?.scheduled_departure_time || b.train?.departure_time || b.departure_time || '06:00';
                  const expDep = dis.updated_departure_time ? dis.updated_departure_time.slice(0, 5) : (b.train?.updated_departure_time ? b.train.updated_departure_time.slice(0, 5) : addMinutesToTime(origDep, delayMins));
                  const isCancelled = activeStatus === 'cancelled';
                  const isDelayed = activeStatus === 'delayed';

                  return (
                    <div className={`p-4 border-b text-xs flex flex-col gap-2 ${
                      isCancelled
                        ? 'bg-red-50 border-red-300 text-red-950'
                        : isDelayed
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-indigo-50 border-indigo-300 text-indigo-950'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${isCancelled ? 'bg-red-600 animate-ping' : 'bg-amber-600 animate-pulse'}`} />
                          <span className="font-black uppercase tracking-wider text-xs flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            {isCancelled ? '⚠ TRAIN SERVICE CANCELLED' : isDelayed ? `⚠ TRAIN DELAYED (+${delayMins} MIN)` : `⚠ TRAIN ${activeStatus.replace('_', ' ').toUpperCase()}`}
                          </span>
                        </div>
                        {dis.platform && (
                          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-white border border-amber-300 shadow-2xs">
                            Departing from Platform {dis.platform}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 font-mono text-[11px] bg-white/70 rounded-lg p-2.5 border border-amber-200/80">
                        <div>
                          <span className="text-slate-500 uppercase block text-[10px]">Original Departure:</span>
                          <strong className="text-slate-800 text-xs">{origDep.slice(0, 5)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase block text-[10px]">Expected Departure:</span>
                          <strong className={`text-xs ${isCancelled ? 'text-red-700' : 'text-amber-800'}`}>
                            {isCancelled ? 'CANCELLED' : expDep}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase block text-[10px]">Disruption Reason:</span>
                          <strong className="text-slate-800 text-xs truncate block">{reason}</strong>
                        </div>
                      </div>

                      {dis.announcement_message && (
                        <p className="text-[11px] italic bg-white/50 p-2 rounded border border-amber-200/50">
                          "{dis.announcement_message}"
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* -------------------------------------------------- */}
                {/* JOURNEY ROUTE & SCHEDULE BLOCK */}
                {/* -------------------------------------------------- */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">BOARDING STATION</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">
                        {formatStationDisplay(
                          b.source_station_name || b.from_station_name || b.source_name,
                          b.source_station_code || b.from_station_code || b.source_code || b.source
                        )}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-600 mt-0.5 block">
                        Departure: {b.route?.departure_time || b.train?.departure_time || b.departure_time || '06:00'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">DESTINATION STATION</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">
                        {formatStationDisplay(
                          b.destination_station_name || b.to_station_name || b.destination_name,
                          b.destination_station_code || b.to_station_code || b.destination_code || b.destination
                        )}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-600 mt-0.5 block">
                        Arrival: {b.route?.arrival_time || b.train?.arrival_time || b.arrival_time || '18:00'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">TRAVEL DATE & CLASS</span>
                      <span className="font-black text-slate-900 text-sm mt-0.5 block">{b.travel_date}</span>
                      <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5 flex-wrap">
                        <span>{b.coach_class ? `${b.coach_class} — ${getClassFullName(b.coach_class)}` : 'Standard Class'}</span>
                        {b.quota === 'TATKAL' && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[9px]">
                            TATKAL
                          </span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">TOTAL FARE PAID</span>
                      <span className="font-mono font-black text-emerald-700 text-base mt-0.5 block">₹{b.total_fare}</span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {(b.allocations && b.allocations.length) || (b.passengers && b.passengers.length) || 1} Passenger(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* -------------------------------------------------- */}
                {/* PASSENGER DETAILS & SEAT ALLOCATIONS TABLE */}
                {/* -------------------------------------------------- */}
                <div className="p-4 border-b border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                      <User className="h-3.5 w-3.5 text-blue-700" />
                      <span>BOOKED PASSENGER(S) & SEAT ALLOCATIONS</span>
                    </h4>
                  </div>

                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th className="p-2 border-r border-slate-200">S.No.</th>
                          <th className="p-2 border-r border-slate-200">Passenger Name</th>
                          <th className="p-2 border-r border-slate-200">Age / Gender</th>
                          <th className="p-2 border-r border-slate-200">Booking Status</th>
                          <th className="p-2 border-r border-slate-200">Current Status</th>
                          <th className="p-2 border-r border-slate-200">Coach</th>
                          <th className="p-2 border-r border-slate-200">Berth / Seat</th>
                          <th className="p-2">Berth Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-medium">
                        {(b.allocations && b.allocations.length > 0 
                          ? b.allocations 
                          : (b.passengers || [{ passenger_name: user?.full_name || 'Passenger' }])
                        ).map((p, pIdx) => {
                          const pName = p.passenger_name || p.name || user?.full_name || 'Passenger';
                          const pAge = p.passenger_age || p.age || '--';
                          const pGender = p.passenger_gender || p.gender || '--';
                          const coach = p.coach_number || p.coach || '';
                          const seat = p.seat_number || p.seat || '';
                          const berthType = p.berth_type || p.berthType || '--';
                          const statusTxt = p.booking_status || 'CNF';
                          const currStatusTxt = p.current_status || 'CNF';

                          return (
                            <tr key={pIdx} className="hover:bg-slate-50 transition text-[11px]">
                              <td className="p-2 border-r border-slate-200 font-mono text-center font-bold text-slate-500">{pIdx + 1}</td>
                              <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{pName}</td>
                              <td className="p-2 border-r border-slate-200 text-slate-600">{pAge} yrs / {pGender}</td>
                              <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-700">{statusTxt}</td>
                              <td className="p-2 border-r border-slate-200 font-mono font-bold text-emerald-700">{currStatusTxt}</td>
                              <td className="p-2 border-r border-slate-200 font-mono font-bold text-blue-800">
                                {coach || <span className="text-slate-400 font-normal italic">Pending</span>}
                              </td>
                              <td className="p-2 border-r border-slate-200 font-mono font-bold text-blue-800">
                                {seat ? seat : <span className="text-slate-400 font-normal italic">Seat Allocation Pending</span>}
                              </td>
                              <td className="p-2 font-mono uppercase text-slate-600">{berthType}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* -------------------------------------------------- */}
                {/* RAILCONTROL MEAL & CATERING DETAILS */}
                {/* -------------------------------------------------- */}
                <div className="p-4 border-b border-slate-200 bg-amber-50/30 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <Utensils className="h-3.5 w-3.5 text-orange-600" />
                      <span>RAILCONTROL MEAL & ON-BOARD CATERING</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-amber-200/80">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Food Included Status</span>
                      {b.catering_included_in_ticket ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px] mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Food Included in Ticket (₹0)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] mt-0.5">
                          Additional Paid Meal
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Meal Ordered</span>
                      {b.has_meal_ordered || b.catering_order ? (
                        <span className="font-bold text-orange-700 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-orange-600" />
                          <span>Order #{b.catering_order?.order_id || 'CONFIRMED'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium italic mt-0.5 block">No Meal Ordered Yet</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Meal Status</span>
                      {b.catering_order ? (
                        <span className="font-bold text-slate-800 block mt-0.5">
                          {b.catering_order.status || 'CONFIRMED'}
                          {b.catering_order.delivery_status && (
                            <span className="text-[10px] text-slate-500 block truncate">
                              {b.catering_order.delivery_status}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 block mt-0.5">--</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Meal Amount & Payment</span>
                      {b.catering_order ? (
                        <span className="font-mono font-bold text-slate-900 block mt-0.5">
                          ₹{parseFloat(b.catering_order.total_amount || 0).toFixed(2)} •{' '}
                          <span className={b.catering_order.payment_status === 'INCLUDED' ? 'text-emerald-700' : 'text-blue-700'}>
                            {b.catering_order.payment_status || 'Paid'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 block mt-0.5">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* -------------------------------------------------- */}
                {/* FARE BREAKDOWN SUMMARY BLOCK */}
                {/* -------------------------------------------------- */}
                <div className="p-4 border-b border-slate-200 bg-white space-y-1.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">FARE SUMMARY</span>
                  <div className="flex flex-wrap items-center justify-between text-slate-700 font-mono text-[11px] gap-2">
                    <span>Base Ticket Fare: <strong>₹{baseFareCalculated}</strong></span>
                    <span>Convenience Fee: <strong>₹0</strong></span>
                    <span className="text-emerald-700 font-black text-xs">TOTAL AMOUNT PAID: ₹{b.total_fare}</span>
                  </div>
                </div>

                {/* -------------------------------------------------- */}
                {/* ACTION BUTTONS FOOTER */}
                {/* -------------------------------------------------- */}
                <div className="p-3 bg-slate-50 flex flex-wrap items-center justify-end gap-2.5">
                  {!isCompleted && !isCancelled && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/passenger/catering?pnr=${b.pnr_number}`)}
                        className="px-3.5 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition flex items-center space-x-1.5 shadow-2xs active:scale-95"
                      >
                        <Utensils className="h-3.5 w-3.5" />
                        <span>{b.has_meal_ordered || b.catering_order ? 'View / Track RailControl Meal' : 'Order RailControl Meal'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/passenger/cancellations?pnr=${b.pnr_number}`)}
                        className="px-3.5 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition flex items-center space-x-1.5 shadow-2xs active:scale-95 cursor-pointer"
                        title="Cancel this journey ticket"
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        <span>Cancel Ticket</span>
                      </button>
                    </>
                  )}

                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => navigate(`/passenger/feedback?pnr=${b.pnr_number}`)}
                      className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Star className="h-3.5 w-3.5 fill-slate-950 text-slate-950" />
                      <span>Rate & Review Journey</span>
                    </button>
                  )}

                  {isCancelled && (
                    <span className="px-3 py-1 rounded bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1.5 border border-rose-200">
                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      <span>Cancelled Journey</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate(`/passenger/ticket/${b.pnr_number}`)}
                    className="px-4 py-1.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold transition flex items-center space-x-1.5 shadow-2xs active:scale-95"
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

      {/* -------------------------------------------------- */}
      {/* PROFESSIONAL RAILWAY PORTAL FOOTER */}
      {/* -------------------------------------------------- */}
      <footer className="mt-12 bg-slate-900 text-slate-300 text-xs rounded-xl p-6 border border-slate-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2 text-white font-black text-base">
              <Train className="h-5 w-5 text-blue-500" />
              <span>RAILCONTROL</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Official Intelligent Railway Management System. Providing secure booking, live tracking, and passenger services.
            </p>
          </div>

          <div>
            <h5 className="font-black text-white text-xs uppercase tracking-wider mb-2.5">Passenger Services</h5>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              <li><button onClick={() => navigate('/passenger/search')} className="hover:text-white transition">Book Train Ticket</button></li>
              <li><button onClick={() => navigate('/passenger/pnr')} className="hover:text-white transition">Check PNR Status</button></li>
              <li><button onClick={() => navigate('/passenger/track')} className="hover:text-white transition">Live Train Running Status</button></li>
              <li><button onClick={() => navigate('/passenger/station-schedule')} className="hover:text-white transition">Station Timetable</button></li>
              <li><button onClick={() => navigate('/passenger/history')} className="hover:text-white transition">My Booking History</button></li>
            </ul>
          </div>

          <div>
            <h5 className="font-black text-white text-xs uppercase tracking-wider mb-2.5">On-Board & Support</h5>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              <li><button onClick={() => navigate('/passenger/catering')} className="hover:text-white transition">E-Catering Food Orders</button></li>
              <li><button onClick={() => navigate('/passenger/support')} className="hover:text-white transition">Customer Support</button></li>
              <li><button onClick={() => navigate('/passenger/cancellations')} className="hover:text-white transition">Ticket Cancellation & Refunds</button></li>
              <li><button onClick={() => navigate('/passenger/feedback')} className="hover:text-white transition">Passenger Feedback</button></li>
            </ul>
          </div>

          <div>
            <h5 className="font-black text-white text-xs uppercase tracking-wider mb-2.5">Preferences & Security</h5>
            <div className="space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center space-x-1 text-emerald-400 font-mono font-bold">
                <Lock className="h-3.5 w-3.5" />
                <span>SSL Secured Portal</span>
              </div>
              <p className="text-[10px]">All transactions are protected by RailControl end-to-end security protocols.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-slate-500 gap-2">
          <span>&copy; {new Date().getFullYear()} RailControl IRCTC Booking Management System. All rights reserved.</span>
          <span>Computer-Generated Railway Reservation History Portal</span>
        </div>
      </footer>

    </div>
  );
};

export default MyBookings;
