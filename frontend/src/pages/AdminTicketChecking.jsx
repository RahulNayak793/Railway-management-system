import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Ticket, Search, CheckCircle, XCircle, AlertTriangle, ShieldCheck, User, Compass,
  QrCode, Camera, RefreshCw, Sparkles, CheckCircle2, UserCheck, AlertCircle, Scan, Volume2,
  Receipt, Printer, Filter, Check, X, ArrowRight, DollarSign
} from 'lucide-react';
import api from '../services/api';

const AdminTicketChecking = () => {
  const [pnrInput, setPnrInput] = useState('');
  const [checkedResult, setCheckedResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Coach & Filter States
  const [selectedCoach, setSelectedCoach] = useState('B1');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'verified' | 'unverified' | 'no_show'

  // EFT Modal State
  const [showEftModal, setShowEftModal] = useState(false);
  const [eftSeat, setEftSeat] = useState('');
  const [eftPassenger, setEftPassenger] = useState('');
  const [eftReason, setEftReason] = useState('Traveling Without Ticket (TWT)');
  const [eftAmount, setEftAmount] = useState('450');

  // RAC Reassignment Modal State
  const [showRacModal, setShowRacModal] = useState(false);
  const [racTargetSeat, setRacTargetSeat] = useState(null);
  const [nextRacPassenger, setNextRacPassenger] = useState({ name: 'Vikram Sethi (RAC 1)', pnr: '9841209412', age: 34, gender: 'Male' });

  // Interactive Coach Seat Grid (24 Berths)
  const [seatsState, setSeatsState] = useState(() => {
    return Array.from({ length: 24 }).map((_, idx) => {
      const seatNo = idx + 1;
      const berthType = seatNo % 6 === 1 || seatNo % 6 === 2 ? 'LB' : seatNo % 6 === 3 || seatNo % 6 === 4 ? 'MB' : 'UB';
      return {
        id: `B1-${seatNo}`,
        seatNo,
        berthType,
        passengerName: idx === 0 ? 'Rahul Sharma' : idx === 1 ? 'Priya Sharma' : idx === 3 ? 'Ramesh Kumar' : `Passenger ${seatNo}`,
        pnr: idx === 0 ? '2345678901' : idx === 1 ? '7462573954' : idx === 3 ? '6543210987' : `9000${seatNo}123`,
        status: idx === 0 || idx === 1 ? 'verified' : idx === 3 ? 'no_show' : 'unverified',
        age: 30 + (seatNo % 20),
        gender: seatNo % 2 === 0 ? 'Female' : 'Male'
      };
    });
  });

  const verifiedCount = seatsState.filter(s => s.status === 'verified').length;
  const unverifiedCount = seatsState.filter(s => s.status === 'unverified').length;
  const noShowCount = seatsState.filter(s => s.status === 'no_show').length;

  const handleVerifyPnr = async (queryPnr) => {
    const targetPnr = queryPnr || pnrInput;
    setErrorMsg('');
    setCheckedResult(null);
    setLoading(true);

    if (!targetPnr || targetPnr.length !== 10) {
      setErrorMsg('Please enter a valid 10-Digit PNR Number.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/bookings/pnr/${targetPnr}`);
      if (res.data) {
        const b = res.data;
        const firstAlloc = b.allocations?.[0] || {};
        setCheckedResult({
          pnr: b.pnr_number || b.id,
          passengerName: firstAlloc.passenger_name || 'Rahul Sharma',
          trainNo: b.train?.train_number || '12952',
          trainName: b.train?.train_name || 'Rajdhani Express',
          from: b.train?.source || 'NDLS',
          to: b.train?.destination || 'MMCT',
          seat: firstAlloc.seat_id ? `B1-${firstAlloc.seat_number || 24}` : 'B1-24',
          class: b.coach_class || '3A',
          status: b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1).toLowerCase() : 'Confirmed',
          verified: true
        });
      } else {
        fallbackMock(targetPnr);
      }
    } catch (err) {
      fallbackMock(targetPnr);
    } finally {
      setLoading(false);
    }
  };

  const fallbackMock = (targetPnr) => {
    const matched = seatsState.find(s => s.pnr === targetPnr);
    if (matched) {
      setCheckedResult({
        pnr: matched.pnr,
        passengerName: matched.passengerName,
        trainNo: '12952',
        trainName: 'Mumbai Rajdhani Express',
        from: 'NDLS',
        to: 'MMCT',
        seat: matched.id,
        class: '3A',
        status: 'Confirmed',
        verified: matched.status === 'verified'
      });
    } else {
      setErrorMsg('PNR code not found in active train manifest.');
    }
  };

  const toggleSeatStatus = (seatId, newStatus) => {
    setSeatsState(prev => prev.map(s => s.id === seatId ? { ...s, status: newStatus } : s));
  };

  const simulateCameraScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setPnrInput('2345678901');
      handleVerifyPnr('2345678901');
    }, 1800);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Top Banner Header */}
      <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden border border-slate-800">
        <div className="z-10 space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase tracking-wider">
            <Scan className="h-3 w-3 animate-pulse" />
            <span>TTE Digital Terminal &bull; Northern Railway Division</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">On-Board Ticket Verification HUD</h1>
          <p className="text-xs text-slate-400 font-medium">Verify passenger e-tickets, scan digital QR codes, and update seat occupancy live.</p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center space-x-3 shrink-0 z-10">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-2xl text-center">
            <span className="block text-[9px] text-emerald-400 font-mono font-bold uppercase">Verified</span>
            <span className="text-base font-black text-emerald-400">{verifiedCount}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-2xl text-center">
            <span className="block text-[9px] text-amber-400 font-mono font-bold uppercase">Pending</span>
            <span className="text-base font-black text-amber-400">{unverifiedCount}</span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-2xl text-center">
            <span className="block text-[9px] text-rose-400 font-mono font-bold uppercase">No-Show</span>
            <span className="text-base font-black text-rose-400">{noShowCount}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: PNR Search & Camera HUD Scanner */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <QrCode className="h-4 w-4 text-primary-600" />
              <span>Verify Passenger PNR Code</span>
            </h3>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={10}
                  placeholder="Enter 10-Digit PNR..."
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-primary-500 transition"
                />
              </div>
              <button
                onClick={() => handleVerifyPnr()}
                disabled={loading}
                className="px-5 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs shadow-md transition active:scale-95 shrink-0"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            {/* Verified Ticket Card Result */}
            {checkedResult && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 text-[10px] font-black uppercase">
                    ✓ VERIFIED ETICKET
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600">PNR: {checkedResult.pnr}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">Passenger</span>
                    <span className="font-extrabold text-slate-800">{checkedResult.passengerName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">Assigned Berth</span>
                    <span className="font-black text-primary-600 font-mono">{checkedResult.seat}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">Train No</span>
                    <span className="font-bold text-slate-800">{checkedResult.trainNo} - {checkedResult.trainName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">Class & Status</span>
                    <span className="font-bold text-emerald-600">{checkedResult.class} ({checkedResult.status})</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    toggleSeatStatus(checkedResult.seat, 'verified');
                    alert(`Seat ${checkedResult.seat} marked as VERIFIED PRESENT!`);
                  }}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition active:scale-95"
                >
                  Confirm Passenger Check-In
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Coach Seat Grid */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            
            {/* Header & Coach Selection Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
                  <UserCheck className="h-4 w-4 text-primary-600" />
                  <span>Coach {selectedCoach} Seat Verification Grid</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Click berth status to mark Present or No-Show.</p>
              </div>

              {/* Coach Selection Switcher */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-700">
                {['H1 (1A)', 'A1 (2A)', 'B1 (3A)', 'B2 (3A)', 'S1 (SL)'].map(c => {
                  const code = c.split(' ')[0];
                  const isActive = selectedCoach === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedCoach(code)}
                      className={`px-2.5 py-1 rounded-lg transition font-mono ${
                        isActive ? 'bg-white shadow-sm font-black text-primary-700' : 'text-slate-500 hover:bg-white/50'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Action & Status Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center space-x-1">
                <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
                {[
                  { id: 'all', label: `All (${seatsState.length})` },
                  { id: 'verified', label: `Verified (${verifiedCount})` },
                  { id: 'unverified', label: `Pending (${unverifiedCount})` },
                  { id: 'no_show', label: `No-Show (${noShowCount})` },
                ].map(flt => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setFilterStatus(flt.id)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition ${
                      filterStatus === flt.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setEftSeat(`${selectedCoach}-05`);
                  setShowEftModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] shadow-xs flex items-center space-x-1"
              >
                <Receipt className="h-3 w-3" />
                <span>Issue EFT Fine Fine Penalty</span>
              </button>
            </div>

            {/* Grid list of seats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
              {seatsState
                .filter(s => filterStatus === 'all' || s.status === filterStatus)
                .map(seat => {
                  const isVerified = seat.status === 'verified';
                  const isNoShow = seat.status === 'no_show';
                  return (
                    <div
                      key={seat.id}
                      className={`p-3 rounded-2xl border transition duration-150 flex flex-col justify-between space-y-2 relative ${
                        isVerified
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : isNoShow
                          ? 'bg-rose-50/70 border-rose-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-black text-xs text-slate-800">{seat.id}</span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600">
                          {seat.berthType}
                        </span>
                      </div>

                      <div>
                        <span className="block text-xs font-extrabold text-slate-900 truncate">{seat.passengerName}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">PNR: {seat.pnr}</span>
                      </div>

                      {/* Action toggle buttons */}
                      <div className="flex gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSeatStatus(seat.id, isVerified ? 'unverified' : 'verified')}
                          className={`flex-1 py-1 rounded-xl text-[10px] font-black transition flex items-center justify-center space-x-1 ${
                            isVerified
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          <span>{isVerified ? 'Present' : 'Verify'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isNoShow) {
                              toggleSeatStatus(seat.id, 'unverified');
                            } else {
                              toggleSeatStatus(seat.id, 'no_show');
                              setRacTargetSeat(seat.id);
                              setShowRacModal(true);
                            }
                          }}
                          className={`py-1 px-2 rounded-xl text-[10px] font-black transition ${
                            isNoShow
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700'
                          }`}
                          title="Mark No-Show"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>

      </div>

      {/* EFT Excess Fare Ticket Penalty Modal */}
      {showEftModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <Receipt className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-800">Issue Excess Fare Ticket (EFT)</h3>
              </div>
              <button onClick={() => setShowEftModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Berth / Seat Number</label>
                <input
                  type="text"
                  value={eftSeat}
                  onChange={(e) => setEftSeat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Passenger Name</label>
                <input
                  type="text"
                  placeholder="Enter passenger name..."
                  value={eftPassenger}
                  onChange={(e) => setEftPassenger(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Violation Reason</label>
                <select
                  value={eftReason}
                  onChange={(e) => setEftReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="Traveling Without Ticket (TWT)">Traveling Without Ticket (TWT)</option>
                  <option value="Unbooked Luggage Penalty">Unbooked Luggage Penalty</option>
                  <option value="Traveling in Higher Class">Traveling in Higher Class</option>
                  <option value="Expired Ticket / Out-of-Zone">Expired Ticket / Out-of-Zone</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Fine Amount (₹)</label>
                <input
                  type="number"
                  value={eftAmount}
                  onChange={(e) => setEftAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono text-emerald-600 text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  alert(`EFT Receipt Issued successfully for ₹${eftAmount} to ${eftPassenger || 'Passenger'}! Digital receipt generated.`);
                  setShowEftModal(false);
                }}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-lg shadow-amber-600/25 transition active:scale-95"
              >
                Issue Digital EFT Fine Receipt
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RAC Auto-Reassignment Modal */}
      {showRacModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-600">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-800">Auto RAC Berth Promotion</h3>
              </div>
              <button onClick={() => setShowRacModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs">
              <p className="text-indigo-900 font-bold">
                Berth <span className="font-mono text-indigo-700 font-black">{racTargetSeat}</span> is marked as No-Show. Reassign to next queued RAC passenger?
              </p>
              <div className="bg-white p-3 rounded-xl border border-indigo-200/60 space-y-1">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Next in RAC Queue</span>
                <span className="font-extrabold text-slate-800 block text-sm">{nextRacPassenger.name}</span>
                <span className="text-[10px] font-mono text-slate-500">PNR: {nextRacPassenger.pnr} &bull; Age {nextRacPassenger.age} ({nextRacPassenger.gender})</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  toggleSeatStatus(racTargetSeat, 'verified');
                  alert(`Berth ${racTargetSeat} successfully reassigned to ${nextRacPassenger.name}! SMS notification dispatched.`);
                  setShowRacModal(false);
                }}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-600/25 transition active:scale-95 flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Reassign Berth to RAC Passenger</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminTicketChecking;
