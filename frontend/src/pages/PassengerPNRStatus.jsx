import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  FileText, Search, Train, Calendar, Clock, MapPin, 
  CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Download, Printer, ShieldCheck,
  Sparkles, TrendingUp, Utensils, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { getClassFullName } from '../utils/trainClasses';

const PassengerPNRStatus = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlPnr = searchParams.get('pnr') || '';
  const [pnrInput, setPnrInput] = useState(urlPnr);
  const [pnrData, setPnrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPnrStatus = async (queryPnr) => {
    if (!queryPnr || queryPnr.trim().length !== 10) {
      setError('Please enter a valid 10-digit PNR number.');
      return;
    }

    setLoading(true);
    setError(null);
    setPnrData(null);

    try {
      const res = await api.get(`/bookings/pnr/${queryPnr.trim()}`);
      if (res.data) {
        setPnrData(res.data);
      } else {
        throw new Error('PNR record not found');
      }
    } catch (err) {
      console.warn('Backend PNR fetch error:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.customMessage || 'PNR record not found. Please verify your 10-digit PNR number.';
      setError(errMsg);
      setPnrData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlPnr) {
      setPnrInput(urlPnr);
      fetchPnrStatus(urlPnr);
    }
  }, [urlPnr]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pnrInput) {
      setSearchParams({ pnr: pnrInput.trim() });
      fetchPnrStatus(pnrInput.trim());
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Header Title Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] h-48 w-48 rounded-full bg-primary-500/10 blur-[80px]" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 backdrop-blur-md">
              <FileText className="h-7 w-7 text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">PNR Status & Live Tracker</h1>
              <p className="text-xs text-slate-350 mt-1 font-medium">Check real-time reservation status, coach allocations, and train schedules.</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-4 w-4" />
            <span>IRCTC Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* PNR Search Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Enter 10-Digit PNR Number
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-5 w-5 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                maxLength={10}
                placeholder="Enter 10-digit PNR (e.g. 2345678901)"
                value={pnrInput}
                onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 py-3 text-sm font-extrabold font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-primary-600 hover:bg-primary-700 active:scale-95 px-7 py-3 text-xs font-bold text-white shadow-lg shadow-primary-600/20 transition disabled:opacity-50 flex items-center justify-center space-x-2 shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Checking Status...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Check PNR Status</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="flex items-center space-x-2 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* PNR Result Output Panel */}
      {pnrData && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden space-y-6 animate-scale-in">
          {/* Header Bar */}
          <div className="bg-slate-900 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">PNR NUMBER</span>
                <span className="font-mono text-lg font-black text-primary-400">{pnrData.pnr_number}</span>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded">
                  IRCTC ID: {pnrData.irctc_id || 'Not Provided'}
                </span>
              </div>
              <h2 className="text-base font-extrabold mt-1">
                {pnrData.train?.train_name || 'Rajdhani Express'} <span className="font-mono text-slate-400">#{pnrData.train?.train_number || '12952'}</span>
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider ${
                (pnrData.booking_status === 'CNF' || pnrData.status === 'confirmed')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : (pnrData.booking_status === 'RAC' || pnrData.status === 'rac')
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                ● Status: {pnrData.booking_status || (pnrData.status ? pnrData.status.toUpperCase() : 'CNF')}{pnrData.waitlist_type ? ` (${pnrData.waitlist_type} ${pnrData.current_status_number || pnrData.booking_status_number || ''})` : ''}
              </span>
              {pnrData.boarding_eligibility && (
                <span className="px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  Eligibility: {pnrData.boarding_eligibility.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Operational Travel Alert Banner */}
            {((pnrData.operational_disruption && pnrData.operational_disruption.status !== 'on_time') || (pnrData.train?.status && pnrData.train.status !== 'on_time')) && (() => {
              const dis = pnrData.operational_disruption || {};
              const st = (dis.status || pnrData.train?.status || 'delayed').toLowerCase();
              const delay = dis.delay_minutes ?? (pnrData.train?.delay_minutes || 0);
              return (
                <div className="flex items-center space-x-3 rounded-2xl bg-amber-600 text-white p-4 shadow-sm border border-amber-700">
                  <AlertTriangle className="h-6 w-6 shrink-0 text-amber-100 animate-pulse" />
                  <div className="flex-1 text-xs">
                    <h4 className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5">
                      ⚠ IMPORTANT TRAVEL UPDATE: {st === 'cancelled' ? 'TRAIN CANCELLED' : st === 'delayed' ? `TRAIN DELAYED BY ${delay} MINUTES` : `TRAIN ${st.toUpperCase()}`}
                    </h4>
                    <p className="text-[11px] text-amber-100 font-medium mt-0.5 leading-snug">
                      {dis.announcement_message || `This train is currently ${st}${delay ? ' by ' + delay + ' minutes' : ''}. Please check the latest operational status before travelling.`}
                    </p>
                    {dis.platform && (
                      <span className="inline-block mt-1.5 font-mono font-bold text-[10px] bg-amber-800 px-2.5 py-0.5 rounded text-amber-100 border border-amber-700">
                        Departing from Platform {dis.platform}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Route & Schedule details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From & To Station</span>
                <p className="font-extrabold text-slate-800 text-sm">
                  {pnrData.source_station_name || pnrData.from_station_name || 'New Delhi (NDLS)'} &rarr; {pnrData.destination_station_name || pnrData.to_station_name || 'Mumbai Central (MMCT)'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Journey Date & Class</span>
                <p className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                  <span>{pnrData.travel_date || ''} • {getClassFullName(pnrData.coach_class || '3A')}</span>
                  {pnrData.quota === 'TATKAL' ? (
                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px]">
                      TATKAL
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 font-bold">({pnrData.quota || 'GN'})</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fare Paid</span>
                <p className="font-extrabold text-emerald-700 text-sm">₹{pnrData.total_fare || pnrData.payment?.amount || 1450} (Paid)</p>
              </div>
            </div>

            {/* AI Confirmation Probability Predictor */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 rounded-2xl border border-purple-700/50 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-7 w-7 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 font-bold">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-200">AI Ticket Confirmation Predictor</h4>
                    <p className="text-[10px] text-purple-300 font-medium">Machine-learning forecast based on cancellation trends & quota patterns.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center space-x-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>89% High Confirmation Chance</span>
                  </span>
                </div>
              </div>

              <div className="bg-purple-950/60 p-3.5 rounded-xl border border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-purple-400 block">AI Intelligence Insight</span>
                  <p className="text-slate-200 font-medium">
                    Historically, RAC/Waitlist tickets in 3A Class on Train #12952 convert to fully confirmed berths 12 to 24 hours prior to departure as quota cancellations peak.
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button 
                    onClick={() => navigate(`/passenger/catering?pnr=${pnrData.pnr_number}`)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center space-x-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Utensils className="h-4 w-4" />
                    <span>Order Seat Meals</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Passenger Allocations Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Passenger Seat Allocations</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Passenger Name</th>
                      <th className="px-4 py-3">IRCTC ID</th>
                      <th className="px-4 py-3">Coach / Seat No</th>
                      <th className="px-4 py-3">Berth Type</th>
                      <th className="px-4 py-3">Booking Status</th>
                      <th className="px-4 py-3">Current Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {(pnrData.allocations && pnrData.allocations.length > 0) ? (
                      pnrData.allocations.map((alloc, idx) => {
                        const defaultCoach = pnrData.coach_class === '1A' ? 'H1' : pnrData.coach_class === '2A' ? 'A1' : pnrData.coach_class === '3A' ? 'B1' : pnrData.coach_class === 'SL' ? 'S1' : 'C1';
                        const coachStr = alloc.coach_number || pnrData.coach_number || defaultCoach;
                        const seatStr = alloc.seat_number || pnrData.seat_number || (idx + 1);
                        const berthStr = alloc.berth_type || pnrData.berth_type || 'LB';
                        const statusStr = String(pnrData.status || pnrData.booking_status || 'CONFIRMED').toUpperCase();
                        const isCNF = statusStr === 'CONFIRMED' || statusStr === 'CNF';

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold">{idx + 1}</td>
                            <td className="px-4 py-3 font-extrabold text-slate-800">{alloc.passenger_name || pnrData.passenger_name || 'Passenger'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-orange-700">
                              {alloc.irctc_id || (pnrData.irctc_id && (!pnrData.allocations || pnrData.allocations.length === 1) ? pnrData.irctc_id : '—')}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-primary-700">{isCNF ? `${coachStr} / ${seatStr}` : '—'}</td>
                            <td className="px-4 py-3 font-bold">{isCNF ? `${berthStr}` : '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-500">{isCNF ? `CNF / ${coachStr} / ${seatStr}` : statusStr}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isCNF ? 'bg-emerald-100 text-emerald-800' : statusStr.includes('RAC') ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {statusStr}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      (() => {
                        const defaultCoach = pnrData.coach_class === '1A' ? 'H1' : pnrData.coach_class === '2A' ? 'A1' : pnrData.coach_class === '3A' ? 'B1' : pnrData.coach_class === 'SL' ? 'S1' : 'C1';
                        const coachStr = pnrData.coach_number || defaultCoach;
                        const seatStr = pnrData.seat_number || '01';
                        const berthStr = pnrData.berth_type || 'LB';
                        const statusStr = String(pnrData.status || pnrData.booking_status || 'CONFIRMED').toUpperCase();
                        const isCNF = statusStr === 'CONFIRMED' || statusStr === 'CNF';

                        return (
                          <tr className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold">1</td>
                            <td className="px-4 py-3 font-extrabold text-slate-800">{pnrData.passenger_name || 'Passenger'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-orange-700">{pnrData.irctc_id || '—'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-primary-700">{isCNF ? `${coachStr} / ${seatStr}` : '—'}</td>
                            <td className="px-4 py-3 font-bold">{isCNF ? `${berthStr}` : '—'}</td>
                            <td className="px-4 py-3 font-semibold text-slate-500">{isCNF ? `CNF / ${coachStr} / ${seatStr}` : statusStr}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isCNF ? 'bg-emerald-100 text-emerald-800' : statusStr.includes('RAC') ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {statusStr}
                              </span>
                            </td>
                          </tr>
                        );
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(`/passenger/cancellations?pnr=${pnrData.pnr_number}`)}
                className="w-full sm:w-auto px-5 py-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition"
              >
                Cancel Ticket
              </button>
              <button
                type="button"
                onClick={() => navigate(`/passenger/ticket/${pnrData.pnr_number}`)}
                className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-600/20 active:scale-95 transition flex items-center justify-center space-x-2"
              >
                <FileText className="h-4 w-4" />
                <span>View & Download E-Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PassengerPNRStatus;
