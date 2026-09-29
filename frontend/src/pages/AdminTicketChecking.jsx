import React, { useState, useEffect, useMemo } from 'react';
import { 
  Ticket, Search, CheckCircle, XCircle, AlertTriangle, User, 
  Train, Calendar, MapPin, RefreshCw, UserCheck, ShieldAlert,
  Clock, ArrowRight, X, Sparkles, Check, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminTicketChecking = () => {
  const { user } = useAuth();

  // PNR Search State
  const [pnrInput, setPnrInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [checkedResult, setCheckedResult] = useState(null);
  const [verificationError, setVerificationError] = useState(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  // Recent / All Bookings State for Quick Selection
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [tableSearch, setTableSearch] = useState('');

  // Fetch recent bookings from backend for quick test chips and table
  const fetchRecentBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await api.get('/staff/manifest/all?status=ALL');
      if (res.data && Array.isArray(res.data.manifest)) {
        setBookings(res.data.manifest);
      }
    } catch (err) {
      console.warn('Could not fetch manifest for quick PNR chips:', err.message);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchRecentBookings();
  }, []);

  // Quick PNR chips from database
  const quickTestPnrs = useMemo(() => {
    const list = [];
    bookings.forEach(b => {
      if (b.pnr && !list.some(x => x.pnr === b.pnr)) {
        list.push({
          pnr: b.pnr,
          name: b.passenger_name || 'Passenger',
          status: b.ticket_status || 'CNF',
          coach: b.coach || 'B1',
          seat: b.seat_number || '-'
        });
      }
    });
    return list.slice(0, 6);
  }, [bookings]);

  // Verify PNR
  const handleVerifyPnr = async (customPnr) => {
    const targetPnr = String(customPnr || pnrInput).trim();
    if (!targetPnr || targetPnr.length < 5) {
      setVerificationError({
        status: 'INPUT_ERROR',
        title: 'Invalid Input',
        message: 'Please enter a valid 10-digit PNR number.'
      });
      return;
    }

    setVerifying(true);
    setVerificationError(null);
    setCheckedResult(null);
    setActionSuccessMessage(null);

    try {
      const res = await api.post('/staff/ticket/verify', { pnr: targetPnr, checked_status: true });
      if (res.data && res.data.valid) {
        setCheckedResult(res.data);
        fetchRecentBookings();
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && data.status === 'CANCELLED') {
        setVerificationError({
          status: 'CANCELLED',
          title: 'TICKET CANCELLED - BOARDING DENIED',
          message: data.error || 'This ticket was cancelled in the reservation system. Boarding is not permitted.',
          details: data
        });
      } else if (data && data.status === 'NOT_FOUND') {
        setVerificationError({
          status: 'NOT_FOUND',
          title: 'PNR NOT FOUND',
          message: data.error || `No booking found for PNR "${targetPnr}" in the centralized database.`
        });
      } else {
        setVerificationError({
          status: 'ERROR',
          title: 'VERIFICATION FAILED',
          message: data?.error || err.message || 'Unable to verify PNR.'
        });
      }
    } finally {
      setVerifying(false);
    }
  };

  // Mark Present / Boarded
  const handleMarkPresent = async () => {
    if (!checkedResult?.pnr) return;
    setVerifying(true);
    try {
      const res = await api.post('/staff/ticket/verify', { pnr: checkedResult.pnr, checked_status: true });
      if (res.data && res.data.valid) {
        setCheckedResult(res.data);
        setActionSuccessMessage(`Passenger marked as VERIFIED / PRESENT on board.`);
        fetchRecentBookings();
      }
    } catch (err) {
      alert('Failed to mark verified: ' + (err.response?.data?.error || err.message));
    } finally {
      setVerifying(false);
    }
  };

  // Mark No-Show
  const handleMarkNoShow = async () => {
    if (!checkedResult?.pnr) return;
    const confirmMsg = `Mark passenger "${checkedResult.passenger_name}" (PNR: ${checkedResult.pnr}) as NO-SHOW / ABSENT?`;
    if (!window.confirm(confirmMsg)) return;

    setVerifying(true);
    try {
      const res = await api.post('/staff/ticket/no-show', {
        pnr: checkedResult.pnr,
        seat_id: `${checkedResult.coach}-${checkedResult.seat_number}`,
        reason: 'Passenger absent at boarding station'
      });
      if (res.data && res.data.success) {
        setCheckedResult(prev => prev ? { ...prev, boarding_status: 'NO_SHOW' } : null);
        setActionSuccessMessage(`Passenger marked as NO-SHOW. Berth ${checkedResult.coach}-${checkedResult.seat_number} vacated.`);
        fetchRecentBookings();
      }
    } catch (err) {
      alert('Failed to mark NO-SHOW: ' + (err.response?.data?.error || err.message));
    } finally {
      setVerifying(false);
    }
  };

  // Filtered table rows
  const filteredBookings = useMemo(() => {
    if (!tableSearch) return bookings;
    const q = tableSearch.toLowerCase().trim();
    return bookings.filter(b => 
      (b.pnr && b.pnr.toLowerCase().includes(q)) ||
      (b.passenger_name && b.passenger_name.toLowerCase().includes(q)) ||
      (b.train_number && b.train_number.toLowerCase().includes(q)) ||
      (b.coach && b.coach.toLowerCase().includes(q))
    );
  }, [bookings, tableSearch]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 font-sans space-y-6">
      


      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Ticket className="h-7 w-7 text-primary-600" />
            <span>Ticket Checking & PNR Verification</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Simple PNR inspection terminal for Ticket Examiners. Check passenger status, seat allocation, and boarding attendance.
          </p>
        </div>

        <button
          onClick={fetchRecentBookings}
          disabled={loadingBookings}
          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
          title="Refresh bookings list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingBookings ? 'animate-spin text-primary-600' : ''}`} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* Main PNR Search Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <label className="block text-sm font-black text-slate-800 uppercase tracking-wider">
            Enter 10-Digit PNR Number
          </label>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyPnr();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={pnrInput}
                onChange={(e) => setPnrInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="Enter 10-digit PNR (e.g. 5213102530)..."
                maxLength={10}
                className="w-full pl-12 pr-10 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-mono font-black text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-primary-500 focus:outline-none transition shadow-inner"
              />
              {pnrInput && (
                <button
                  type="button"
                  onClick={() => {
                    setPnrInput('');
                    setCheckedResult(null);
                    setVerificationError(null);
                    setActionSuccessMessage(null);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={verifying || !pnrInput}
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-base rounded-2xl transition shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {verifying ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Verify PNR</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Clickable Sample PNR Chips */}
          {quickTestPnrs.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Quick Test PNRs from Database:
              </span>
              <div className="flex flex-wrap gap-2">
                {quickTestPnrs.map((item) => (
                  <button
                    key={item.pnr}
                    type="button"
                    onClick={() => {
                      setPnrInput(item.pnr);
                      handleVerifyPnr(item.pnr);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-xl font-mono font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                      pnrInput === item.pnr
                        ? 'bg-primary-50 border-primary-400 text-primary-700 shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    }`}
                  >
                    <span>{item.pnr}</span>
                    <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200">
                      {item.name} ({item.status})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Success Alert */}
      {actionSuccessMessage && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 flex items-center gap-3 text-emerald-900 shadow-sm">
          <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Verification Error / Cancelled Banner */}
      {verificationError && (
        <div className={`rounded-3xl border-2 p-6 shadow-xl space-y-3 ${
          verificationError.status === 'CANCELLED' 
            ? 'bg-rose-50 border-rose-300 text-rose-900' 
            : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            {verificationError.status === 'CANCELLED' ? (
              <XCircle className="h-7 w-7 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-amber-600 shrink-0" />
            )}
            <div>
              <h3 className="text-lg font-black tracking-tight">{verificationError.title}</h3>
              <p className="text-sm font-medium">{verificationError.message}</p>
            </div>
          </div>

          {verificationError.details && (
            <div className="bg-white/80 rounded-2xl p-4 border border-rose-200 text-xs font-mono space-y-1 mt-2">
              <p><strong>Passenger:</strong> {verificationError.details.passenger_name}</p>
              <p><strong>Train:</strong> {verificationError.details.train_number} - {verificationError.details.train_name}</p>
              <p><strong>Cancellation Reason:</strong> {verificationError.details.cancellation_reason}</p>
              <p><strong>Refund Status:</strong> {verificationError.details.refund_status}</p>
            </div>
          )}
        </div>
      )}

      {/* Verified Ticket Details Card */}
      {checkedResult && (
        <div className="bg-white rounded-3xl border-2 border-emerald-300 shadow-2xl overflow-hidden animate-slide-in">
          {/* Card Top Banner */}
          <div className="bg-linear-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="h-6 w-6 text-emerald-300" />
              <div>
                <span className="text-[11px] font-mono tracking-widest text-emerald-200 font-bold uppercase block">
                  Official Verification Result
                </span>
                <span className="text-lg font-black tracking-tight">VALID RESERVED TICKET</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 text-white font-mono text-xs font-bold">
                PNR: {checkedResult.pnr}
              </span>
              <span className={`px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider ${
                checkedResult.boarding_status === 'VERIFIED' 
                  ? 'bg-emerald-300 text-emerald-950 font-black' 
                  : checkedResult.boarding_status === 'NO_SHOW'
                  ? 'bg-rose-300 text-rose-950 font-black'
                  : 'bg-amber-300 text-amber-950 font-black'
              }`}>
                {checkedResult.boarding_status === 'VERIFIED' ? 'PRESENT / VERIFIED' : checkedResult.boarding_status || 'PENDING'}
              </span>
            </div>
          </div>

          {/* Ticket Information Grid */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Passenger Info */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Passenger
                </span>
                <span className="text-base font-black text-slate-900 block truncate">
                  {checkedResult.passenger_name}
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  Age: {checkedResult.age || 30} &bull; {checkedResult.gender || 'Male'}
                </span>
              </div>

              {/* Train Info */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Train className="h-3.5 w-3.5" /> Train Service
                </span>
                <span className="text-base font-black text-slate-900 block truncate">
                  {checkedResult.train_number} - {checkedResult.train_name}
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  Class: <strong>{checkedResult.coach_class || '3A'}</strong>
                </span>
              </div>

              {/* Route & Date */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Journey Route
                </span>
                <span className="text-base font-black text-slate-900 block truncate">
                  {checkedResult.from} &rarr; {checkedResult.to}
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  Date: <strong className="font-mono">{checkedResult.travel_date}</strong>
                </span>
              </div>

              {/* Berth Allocation */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Allocated Berth
                </span>
                <span className="text-xl font-black text-emerald-900 block">
                  Coach {checkedResult.coach || 'B1'} &bull; Seat {checkedResult.seat_number}
                </span>
                <span className="text-xs font-bold text-emerald-700 block">
                  {checkedResult.berth_type === 'LB' ? 'Lower Berth (LB)' :
                   checkedResult.berth_type === 'MB' ? 'Middle Berth (MB)' :
                   checkedResult.berth_type === 'UB' ? 'Upper Berth (UB)' :
                   checkedResult.berth_type === 'SL' ? 'Side Lower (SL)' :
                   checkedResult.berth_type === 'SU' ? 'Side Upper (SU)' :
                   checkedResult.berth_type || 'Berth'}
                </span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkPresent}
                  disabled={verifying || checkedResult.boarding_status === 'VERIFIED'}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{checkedResult.boarding_status === 'VERIFIED' ? 'Verified (Present)' : 'Mark as Verified (Present)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleMarkNoShow}
                  disabled={verifying || checkedResult.boarding_status === 'NO_SHOW'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>{checkedResult.boarding_status === 'NO_SHOW' ? 'Marked No-Show' : 'Mark as No-Show'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCheckedResult(null);
                  setPnrInput('');
                  setActionSuccessMessage(null);
                }}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Clear / Check Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Bookings List (Quick Click-to-Check) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary-600" />
              <span>Active Passenger Bookings in Database</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Click any passenger to instantly load and verify their ticket details.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search Name, PNR, Coach..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {loadingBookings ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary-600" />
            <span>Loading database bookings...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">
            No bookings found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">PNR Number</th>
                  <th className="py-3 px-3">Passenger</th>
                  <th className="py-3 px-3">Train</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Coach / Seat</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Boarding</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredBookings.slice(0, 15).map((b, idx) => (
                  <tr 
                    key={b.pnr || idx} 
                    className="hover:bg-slate-50/80 transition"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {b.pnr}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {b.passenger_name || 'Passenger'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {b.train_number}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {b.travel_date}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {b.coach ? `${b.coach}-${b.seat_number || '-'}` : 'WL'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                        String(b.ticket_status).toLowerCase().includes('cnf') || String(b.ticket_status).toLowerCase().includes('confirmed')
                          ? 'bg-emerald-100 text-emerald-800'
                          : String(b.ticket_status).toLowerCase().includes('cancel')
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.ticket_status || 'CNF'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                        b.verification_status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.verification_status === 'NO_SHOW'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {b.verification_status || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPnrInput(b.pnr);
                          handleVerifyPnr(b.pnr);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Check PNR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminTicketChecking;
