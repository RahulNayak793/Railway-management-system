import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, RefreshCw, Search, Lock, UserCheck, AlertCircle, 
  CheckCircle2, Clock, MapPin, Ticket, ShieldAlert, ArrowRight, X, Edit, FileText, Info
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const AdminReservations = ({ isStaffView = false }) => {
  const { showToast } = useToast();

  // Filter state
  const [trainId, setTrainId] = useState('12952');
  const [journeyDate, setJourneyDate] = useState(new Date().toISOString().split('T')[0]);
  const [classCode, setClassCode] = useState('2A');
  const [quota, setQuota] = useState('GN');
  const [fromStation, setFromStation] = useState('NDLS');
  const [toStation, setToStation] = useState('MMCT');
  const [selectedCoach, setSelectedCoach] = useState(null);

  // Availability & Audit Log Data
  const [loading, setLoading] = useState(false);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('control'); // 'control' | 'audit'

  // Manual Reassignment Modal
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [targetBookingId, setTargetBookingId] = useState('');
  const [targetOldSeatId, setTargetOldSeatId] = useState('');
  const [targetNewSeatId, setTargetNewSeatId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Fetch Availability Data
  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/trains/${trainId}/seat-availability?journeyDate=${journeyDate}&fromStation=${fromStation}&toStation=${toStation}&classCode=${classCode}&quota=${quota}`);
      if (res.data) {
        setAvailabilityData(res.data);
        if (res.data.coaches && res.data.coaches.length > 0 && !selectedCoach) {
          setSelectedCoach(res.data.coaches[0].coach);
        }
        showToast(`Reservation availability updated for Train #${trainId}`, 'success');
      }
    } catch (err) {
      console.warn('Error fetching reservation availability:', err);
      showToast('Failed to load reservation availability.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const res = await api.get(`/trains/reservation/audit-logs?train_id=${trainId}&journey_date=${journeyDate}`);
      if (res.data && res.data.logs) {
        setAuditLogs(res.data.logs);
      }
    } catch (err) {
      console.warn('Error fetching audit logs');
    }
  };

  useEffect(() => {
    fetchAvailability();
    fetchAuditLogs();
  }, [trainId, journeyDate, classCode, quota]);

  // Handle Manual Seat Reassignment
  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!targetBookingId || !targetNewSeatId || !reassignReason || reassignReason.length < 5) {
      showToast('Please enter Booking ID, target Seat ID, and a valid reason (min 5 chars).', 'error');
      return;
    }

    setReassigning(true);
    try {
      const res = await api.post('/trains/reservation/reassign-seat', {
        bookingId: targetBookingId,
        oldSeatId: targetOldSeatId,
        newSeatId: targetNewSeatId,
        reason: reassignReason
      });

      if (res.data && res.data.success) {
        showToast(res.data.message, 'success');
        setShowReassignModal(false);
        setReassignReason('');
        setTargetBookingId('');
        fetchAvailability();
        fetchAuditLogs();
      } else {
        showToast(res.data?.error || 'Seat reassignment failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reassign seat.', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const currentCoachData = availabilityData?.coaches?.find(c => c.coach === selectedCoach) || availabilityData?.coaches?.[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in pb-16">
      
      {/* 1. HEADER BRANDING */}
      <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/20 border border-indigo-400/30 px-3.5 py-1 rounded-full text-xs font-black text-indigo-200 uppercase tracking-widest">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            <span>{isStaffView ? 'STAFF OPERATIONAL SEAT MATRIX & CONTROL' : 'ADMINISTRATIVE RESERVATION & SEAT CONTROL'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            {isStaffView ? 'Staff Seat Matrix & Coach Control' : 'Reservation & Seat Control'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
            {isStaffView 
              ? 'Authoritative real-time coach availability, passenger seating manifest, and station operational seat management.'
              : 'Authoritative, centralized reservation engine across all travel classes, coach layouts, seat assignments, and reservation audit logs.'}
          </p>
        </div>

        {/* TAB TOGGLE */}
        <div className="flex items-center bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shrink-0">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition min-h-[44px] ${
              activeTab === 'control' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Seat Map & Controls
          </button>
          <button
            onClick={() => { setActiveTab('audit'); fetchAuditLogs(); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition min-h-[44px] ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* 2. FILTERS PANEL */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Search & Filter Parameters</span>
          <button
            onClick={fetchAvailability}
            disabled={loading}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Availability</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-500 block mb-1">Train Number / ID</label>
            <input
              type="text"
              value={trainId}
              onChange={(e) => setTrainId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">Journey Date</label>
            <input
              type="date"
              value={journeyDate}
              onChange={(e) => setJourneyDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">Travel Class</label>
            <select
              value={classCode}
              onChange={(e) => { setClassCode(e.target.value); setSelectedCoach(null); }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
            >
              {['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">Quota</label>
            <select
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
            >
              {['GN', 'TQ', 'PT', 'LD', 'HP'].map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">From Station</label>
            <input
              type="text"
              value={fromStation}
              onChange={(e) => setFromStation(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-500 block mb-1">To Station</label>
            <input
              type="text"
              value={toStation}
              onChange={(e) => setToStation(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* ================= TAB 1: CONTROL & SEAT MAP ================= */}
      {activeTab === 'control' && availabilityData && (
        <div className="space-y-6">

          {/* DATA SOURCE & INTEGRATION STATUS HEADER BAR */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 text-white p-4 space-y-3 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-b border-white/10 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-300">Reservation System:</span>
                <span className="font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-md uppercase">
                  ACTIVE • LIVE INVENTORY
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">PRS Central System:</span>
                  <span className="font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. SUMMARY COUNTERS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Total Accommodation</span>
              <span className="text-2xl font-black text-slate-900">{availabilityData.summary.totalAccommodation}</span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] font-black uppercase text-emerald-700 block">Confirmed</span>
              <span className="text-2xl font-black text-emerald-900">{availabilityData.summary.confirmed}</span>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] font-black uppercase text-amber-700 block">RAC</span>
              <span className="text-2xl font-black text-amber-900">{availabilityData.summary.rac}</span>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] font-black uppercase text-rose-700 block">Waiting List (WL)</span>
              <span className="text-2xl font-black text-rose-900">{availabilityData.summary.waitingList}</span>
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] font-black uppercase text-teal-700 block">Available</span>
              <span className="text-2xl font-black text-teal-900">{availabilityData.summary.available}</span>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 text-center space-y-1 shadow-sm">
              <span className="text-[10px] font-black uppercase text-purple-700 block">Temporary Holds</span>
              <span className="text-2xl font-black text-purple-900">{availabilityData.summary.temporaryHolds}</span>
            </div>
          </div>

          {/* 4. COACH AVAILABILITY SELECTION TABS */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">Coach Breakdown</span>
                <h3 className="text-lg font-black text-slate-900">Coaches Mapped to {classCode} Class</h3>
              </div>

              <button
                onClick={() => setShowReassignModal(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition shadow-md flex items-center space-x-1.5 min-h-[44px]"
              >
                <Edit className="h-4 w-4" />
                <span>Reassign Seat</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {availabilityData.coaches?.map(coach => (
                <div
                  key={coach.coach}
                  onClick={() => setSelectedCoach(coach.coach)}
                  className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                    selectedCoach === coach.coach 
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-md' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-slate-900">Coach {coach.coach}</span>
                    <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">Total: {coach.total}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Confirmed</span>
                      <span className="font-extrabold text-slate-900">{coach.confirmed}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">Available</span>
                      <span className="font-extrabold text-teal-700">{coach.available}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. INTERACTIVE SEAT / BERTH MAP & LEGEND */}
          {currentCoachData && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                    Detailed Seat / Berth Map
                  </span>
                  <h3 className="text-lg font-black text-slate-900">Coach {currentCoachData.coach} ({classCode}) Seat Layout</h3>
                </div>

                {/* LEGEND BADGES */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 AVAILABLE</span>
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">🔴 CONFIRMED</span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">🟡 RAC</span>
                  <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-300">🟠 WL</span>
                  <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300">🟣 HOLD</span>
                </div>
              </div>

              {/* SEAT GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {currentCoachData.seats?.map(seat => {
                  const isAvail = seat.status === 'AVAILABLE';
                  const isConf = seat.status === 'CONFIRMED';
                  const isRac = seat.status === 'RAC';
                  const isWl = seat.status === 'WL';
                  const isHold = seat.status === 'TEMPORARY_HOLD';

                  return (
                    <div
                      key={seat.seatId}
                      className={`p-3 rounded-2xl border transition flex flex-col justify-between space-y-2 ${
                        isAvail ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400' :
                        isConf ? 'bg-rose-50/40 border-rose-200' :
                        isRac ? 'bg-amber-50/40 border-amber-200' :
                        isHold ? 'bg-purple-50/40 border-purple-200' : 'bg-orange-50/40 border-orange-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900">{seat.coach}-{seat.seatNumber}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{seat.berthType}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className={`text-[10px] font-black uppercase block ${
                          isAvail ? 'text-emerald-700' :
                          isConf ? 'text-rose-700' :
                          isRac ? 'text-amber-700' :
                          isHold ? 'text-purple-700' : 'text-orange-700'
                        }`}>
                          {seat.status}
                        </span>

                        <span className="text-[9px] font-mono text-slate-400 block">
                          Source: {seat.source || 'N/A'}
                        </span>
                      </div>

                      {seat.passengerInfo && (
                        <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 font-bold truncate">
                          PNR: {seat.passengerInfo.pnrNumber}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ================= TAB 2: AUDIT LOGS ================= */}
      {activeTab === 'audit' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">Audit Trail</span>
              <h3 className="text-lg font-black text-slate-900">Reservation Event Audit Logs</h3>
            </div>

            <button onClick={fetchAuditLogs} className="text-xs font-bold text-indigo-600 flex items-center space-x-1">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-12">No audit logs recorded for selected parameters.</p>
            ) : (
              auditLogs.map(log => (
                <div key={log.event_id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-slate-900">{log.event_type}</span>
                      <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold">{log.event_id}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.reason || 'No description'}</p>
                    <span className="text-[10px] text-slate-400 font-mono">By: {log.performed_by} • Coach: {log.coach || 'N/A'}, Seat: {log.seat_id || 'N/A'}</span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MANUAL REASSIGNMENT MODAL */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-slide-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-600">
                <Edit className="h-5 w-5" />
                <h3 className="font-black text-slate-900 text-base">Controlled Seat Reassignment</h3>
              </div>
              <button onClick={() => setShowReassignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Booking ID</label>
                <input
                  type="text"
                  placeholder="e.g. bk-98421"
                  value={targetBookingId}
                  onChange={(e) => setTargetBookingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold focus:border-indigo-500 min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Old Seat ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 12952-A1-1"
                    value={targetOldSeatId}
                    onChange={(e) => setTargetOldSeatId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold focus:border-indigo-500 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">New Seat ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 12952-A1-5"
                    value={targetNewSeatId}
                    onChange={(e) => setTargetNewSeatId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold focus:border-indigo-500 min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Reassignment Reason (Min 5 chars)</label>
                <textarea
                  placeholder="Enter reason for seat reassignment (e.g. Senior Citizen request)..."
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-medium focus:border-indigo-500 h-20"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition min-h-[44px]"
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminReservations;
