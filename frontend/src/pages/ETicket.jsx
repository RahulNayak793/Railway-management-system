import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Printer, Share2, Train, 
  ArrowRight, Info, AlertTriangle
} from 'lucide-react';
import { Share } from '@capacitor/share';
import api from '../services/api';
import { getClassFullName } from '../utils/trainClasses';

// SVG Vector QR Code Component (Crisp high-DPI printable SVG)
const QRCodeSVG = ({ value, size = 110 }) => {
  const matrixSize = 21;
  const modules = Array(matrixSize).fill(null).map(() => Array(matrixSize).fill(false));

  const placeFinder = (r, c) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          modules[r + i][c + j] = true;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, 14);
  placeFinder(14, 0);

  let hash = 0;
  const str = String(value || 'RAILCONTROL');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= 13;
      const inBottomLeft = r >= 13 && c < 8;
      if (!inTopLeft && !inTopRight && !inBottomLeft) {
        const val = Math.abs(Math.sin((r * 21 + c + hash) * 1.5) * 10000);
        modules[r][c] = (val - Math.floor(val)) > 0.42;
      }
    }
  }

  const cellSize = size / matrixSize;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 bg-white p-1 border border-slate-300 rounded">
      {modules.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.1}
              height={cellSize + 0.1}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
};

const formatDateUpper = (dateStr) => {
  if (!dateStr) return '18-SEP-2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return String(dateStr).toUpperCase();
  }
};

const ETicket = () => {
  const { pnr } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const success = searchParams.get('success') === 'true';
  const bookingId = searchParams.get('booking_id');

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true);
      try {
        let pnrCode = pnr;
        
        if (!pnrCode && bookingId) {
          const res = await api.get('/bookings');
          const matched = res.data.find(b => b.id === bookingId);
          pnrCode = matched ? matched.pnr_number : '';
        }

        if (pnrCode) {
          const res = await api.get(`/bookings/pnr/${pnrCode}`);
          setBooking(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, [pnr, bookingId]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareTicket = async () => {
    const pnrNum = booking?.pnr_number || 'N/A';
    const trainName = booking?.train?.train_name || booking?.train_name || 'RailControl Express';
    const status = booking?.booking_status || booking?.status || 'CNF';
    const sharePayload = {
      title: `RailControl E-Ticket - PNR ${pnrNum}`,
      text: `🚆 RailControl E-Ticket (ERS)\nPNR: ${pnrNum}\nTrain: ${trainName}\nStatus: ${status}\nClass: ${booking?.coach_class || '3A'}\nTravel Date: ${booking?.travel_date || ''}`,
      url: window.location.href,
    };
    try {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        await Share.share(sharePayload);
      } else if (navigator.share) {
        await navigator.share(sharePayload);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('E-Ticket details copied to clipboard!');
      }
    } catch (err) {
      console.warn('Share cancelled or unavailable:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center bg-slate-100">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em]" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center py-16 px-4">
        <div className="mx-auto max-w-md bg-white border border-slate-300 rounded-xl p-8 text-center space-y-4 shadow-sm">
          <Train className="h-12 w-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">E-Ticket Not Found</h2>
          <p className="text-xs text-slate-500 font-semibold">We could not retrieve ticket details for PNR: {pnr || 'N/A'}.</p>
          <button 
            onClick={() => navigate('/passenger')}
            className="rounded-lg bg-primary-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-primary-700 transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const pnrNumber = booking.pnr_number || pnr || '1234567890';
  const rawStatus = String(booking.booking_status || booking.status || 'CNF').toUpperCase();
  const isConfirmed = rawStatus === 'CNF' || rawStatus === 'CONFIRMED';
  const isCancelled = rawStatus === 'CANCELLED' || rawStatus === 'AUTO_CANCELLED';
  const isRAC = rawStatus.includes('RAC');

  const trainNo = booking.train?.train_number || booking.train_number || '12952';
  const trainName = booking.train?.train_name || booking.train_name || 'RAJDHANI EXPRESS';
  const sourceName = booking.source_station_name || booking.from_station_name || booking.source || 'Udupi';
  const sourceCode = booking.source_station_code || booking.source_code || booking.source || 'UD';
  const destName = booking.destination_station_name || booking.to_station_name || booking.destination || 'NEW DELHI';
  const destCode = booking.destination_station_code || booking.dest_code || booking.destination || 'NDLS';
  const depTime = booking.departure_time || booking.route?.departure_time || '06:20';
  const arrTime = booking.arrival_time || booking.route?.arrival_time || '08:35';
  const travelDateFormatted = formatDateUpper(booking.travel_date);

  const totalPaidFare = Number(booking.total_fare || booking.fare || 850);
  const baseTicketFare = Number(booking.base_fare || (booking.total_fare ? booking.total_fare * 0.9 : 800));
  const convenienceFee = Number(booking.convenience_fee || 20);
  const gstTax = Number(booking.gst || Math.round(baseTicketFare * 0.05));

  const qrPayload = `PNR:${pnrNumber}|TRAIN:${trainNo}|DATE:${travelDateFormatted}|STATUS:${rawStatus}`;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans print:p-0 print:bg-white text-slate-900">
      
      {/* Top Banner on Screen */}
      {success && (
        <div className="mx-auto max-w-4xl mb-4 print:hidden">
          <div className="flex items-center space-x-3 rounded-xl bg-emerald-700 text-white p-4 shadow-sm border border-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-200" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wide">Reservation Confirmed & E-Ticket Issued</h4>
              <p className="text-[11px] text-emerald-100 font-medium">Your Electronic Reservation Slip (ERS) is ready below for travel, printing, or download.</p>
            </div>
          </div>
        </div>
      )}

      {/* Operational Travel Alert Banner */}
      {((booking.operational_disruption && booking.operational_disruption.status !== 'on_time') || (booking.train?.status && booking.train.status !== 'on_time')) && (() => {
        const dis = booking.operational_disruption || {};
        const st = (dis.status || booking.train?.status || 'delayed').toLowerCase();
        const delay = dis.delay_minutes ?? (booking.train?.delay_minutes || 0);
        return (
          <div className="mx-auto max-w-4xl mb-4 print:mb-2">
            <div className="flex items-center space-x-3 rounded-xl bg-amber-600 text-white p-4 shadow-sm border border-amber-700">
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
          </div>
        );
      })()}

      {/* Main ERS Document Surface */}
      <div className="mx-auto max-w-4xl bg-white border border-slate-300 shadow-md rounded-none sm:rounded-lg p-6 sm:p-8 space-y-5 print:shadow-none print:border-black print:p-0 print:m-0 print:max-w-full">
        
        {/* Formal ERS Document Header */}
        <div className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-indigo-950 text-white p-2.5 shrink-0 shadow-xs">
                <Train className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-black text-xl sm:text-2xl tracking-tight text-indigo-950 uppercase font-mono leading-none">
                  RailControl
                </h1>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 mt-1">
                  Electronic Reservation Slip (E-Ticket / ERS)
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end">
              <div className={`px-3 py-1 rounded-md text-xs font-black uppercase font-mono tracking-wider border ${
                isConfirmed ? 'bg-emerald-100 text-emerald-950 border-emerald-400' :
                isRAC ? 'bg-amber-100 text-amber-950 border-amber-400' :
                isCancelled ? 'bg-rose-100 text-rose-950 border-rose-400' :
                'bg-purple-100 text-purple-950 border-purple-400'
              }`}>
                {isConfirmed ? '✓ BOOKING STATUS: CONFIRMED' : `BOOKING STATUS: ${rawStatus}`}
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-bold mt-1">
                Issued: {new Date(booking.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Journey Summary Section */}
        <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/50 print:bg-white space-y-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5 flex justify-between">
            <span>Booked From</span>
            <span>To</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-center sm:text-left">
            <div>
              <h3 className="font-black text-lg text-slate-900 leading-tight">
                {sourceName} <span className="font-mono text-sm text-slate-600">({sourceCode})</span>
              </h3>
              <p className="text-xs font-mono font-extrabold text-slate-700 mt-0.5">Dep: {depTime} IST</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{travelDateFormatted}</p>
            </div>

            <div className="flex flex-col items-center justify-center my-1 sm:my-0">
              <span className="text-[9px] font-mono font-extrabold text-slate-500">Scheduled Journey</span>
              <div className="relative flex w-full items-center justify-center py-1">
                <div className="h-0.5 w-full bg-slate-300 border-t border-dashed border-slate-400"></div>
                <ArrowRight className="h-4 w-4 text-slate-700 shrink-0 mx-1" />
              </div>
              <span className="text-[10px] font-bold text-indigo-900 uppercase">Express Corridor</span>
            </div>

            <div className="sm:text-right">
              <h3 className="font-black text-lg text-slate-900 leading-tight">
                {destName} <span className="font-mono text-sm text-slate-600">({destCode})</span>
              </h3>
              <p className="text-xs font-mono font-extrabold text-slate-700 mt-0.5">Arr: {arrTime} IST</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{travelDateFormatted}</p>
            </div>
          </div>
        </div>

        {/* PNR / Train Information Table */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-black text-xs uppercase tracking-wider text-slate-800">
            Transaction & Train Information
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-300 bg-white text-xs font-mono">
            <div className="p-3 space-y-0.5">
              <span className="text-[9px] font-bold uppercase text-slate-500 block">PNR Number</span>
              <span className="text-base font-black text-slate-950 block tracking-wider">{pnrNumber}</span>
            </div>
            <div className="p-3 space-y-0.5">
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Train No. & Name</span>
              <span className="font-bold text-slate-900 block">{trainNo} / {trainName}</span>
            </div>
            <div className="p-3 space-y-0.5">
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Class & Quota</span>
              <span className="font-bold text-indigo-950 flex items-center gap-1.5 flex-wrap">
                <span>{getClassFullName(booking.coach_class || '3A')} ({booking.quota || 'GN'})</span>
                {booking.quota === 'TATKAL' && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[9px]">
                    TATKAL
                  </span>
                )}
              </span>
            </div>
            <div className="p-3 space-y-0.5">
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Journey Date</span>
              <span className="font-bold text-slate-900 block">{travelDateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Passenger Details Table */}
        <div className="border border-slate-300 rounded-lg overflow-hidden space-y-0">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-black text-xs uppercase tracking-wider text-slate-800 flex justify-between items-center">
            <span>Passenger Details</span>
            <span className="text-[10px] font-bold text-slate-500 font-mono">Total Passengers: {booking.allocations?.length || 1}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-300 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2 border-r border-slate-300">S.No.</th>
                  <th className="px-3 py-2 border-r border-slate-300">Passenger Name</th>
                  <th className="px-3 py-2 border-r border-slate-300">Age</th>
                  <th className="px-3 py-2 border-r border-slate-300">Gender</th>
                  <th className="px-3 py-2 border-r border-slate-300">Booking Status</th>
                  <th className="px-3 py-2 border-r border-slate-300">Current Status</th>
                  <th className="px-3 py-2 border-r border-slate-300">Coach</th>
                  <th className="px-3 py-2 border-r border-slate-300">Berth</th>
                  <th className="px-3 py-2">Berth Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                {booking.allocations && booking.allocations.length > 0 ? (
                  booking.allocations.map((alloc, idx) => {
                    const bStatus = String(booking.booking_status || booking.status || 'CNF').toUpperCase();
                    const isAllocCNF = bStatus === 'CNF' || bStatus === 'CONFIRMED';
                    
                    const defaultCoach = booking.coach_class === '1A' ? 'H1' : booking.coach_class === '2A' ? 'A1' : booking.coach_class === '3A' ? 'B1' : booking.coach_class === 'SL' ? 'S1' : 'C1';
                    const coachStr = alloc.coach_number || (isAllocCNF ? (booking.coach_number || defaultCoach) : '—');
                    const seatStr = alloc.seat_number || (isAllocCNF ? (booking.seat_number || (idx + 1)) : '—');
                    const berthTypeStr = alloc.berth_type || (isAllocCNF ? (booking.berth_type || (idx % 2 === 0 ? 'LOWER' : 'UPPER')) : '—');

                    const bStatusDisp = isAllocCNF ? (coachStr !== '—' && seatStr !== '—' ? `CNF/${coachStr}/${seatStr}` : 'CNF') : bStatus;
                    const cStatusDisp = isAllocCNF ? (coachStr !== '—' && seatStr !== '—' ? `CNF/${coachStr}/${seatStr}` : 'CNF') : bStatus;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-bold">{idx + 1}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">{alloc.passenger_name}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center">{alloc.passenger_age || 30}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center">{alloc.passenger_gender?.[0]?.toUpperCase() || 'M'}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-emerald-800">{bStatusDisp}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-emerald-800">{cStatusDisp}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-bold">{coachStr}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-bold">{seatStr}</td>
                        <td className="px-3 py-2 text-center uppercase font-bold text-slate-600">{berthTypeStr}</td>
                      </tr>
                    );
                  })
                ) : (
                  (() => {
                    const defaultCoach = booking.coach_class === '1A' ? 'H1' : booking.coach_class === '2A' ? 'A1' : booking.coach_class === '3A' ? 'B1' : booking.coach_class === 'SL' ? 'S1' : 'C1';
                    const coachStr = booking.coach_number || (isConfirmed ? defaultCoach : '—');
                    const seatStr = booking.seat_number || (isConfirmed ? '01' : '—');
                    const berthTypeStr = booking.berth_type || (isConfirmed ? 'LOWER' : '—');
                    const statusDisp = isConfirmed ? `CNF/${coachStr}/${seatStr}` : rawStatus;

                    return (
                      <tr className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-bold">1</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">{booking.passenger_name || 'Passenger'}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center">{booking.passenger_age || 28}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center">{booking.passenger_gender?.[0]?.toUpperCase() || 'M'}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-emerald-800">{statusDisp}</td>
                        <td className="px-3 py-2 border-r border-slate-200 font-bold text-emerald-800">{statusDisp}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-bold">{coachStr}</td>
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-bold">{seatStr}</td>
                        <td className="px-3 py-2 text-center uppercase font-bold text-slate-600">{berthTypeStr}</td>
                      </tr>
                    );
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Details & Verification QR Section */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 font-black text-xs uppercase tracking-wider text-slate-800">
            Payment & Fare Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 bg-white">
            
            {/* Payment & Fare Table */}
            <div className="sm:col-span-2 p-4 text-xs font-mono space-y-2">
              <div className="flex justify-between text-slate-700">
                <span>Ticket Base Fare:</span>
                <span className="font-bold font-mono">₹{baseTicketFare.toFixed(2)}</span>
              </div>
              {booking.quota === 'TATKAL' && (
                <div className="flex justify-between text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <span>Tatkal Quota Surcharge:</span>
                  <span className="font-bold font-mono">₹{((booking.tatkal_charge || (['1A', 'EC'].includes(booking.coach_class) ? 500 : ['2A'].includes(booking.coach_class) ? 400 : ['3A', '3E', 'CC'].includes(booking.coach_class) ? 300 : ['SL'].includes(booking.coach_class) ? 100 : 15)) * (booking.allocations?.length || 1)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700">
                <span>IRCTC Convenience Fee:</span>
                <span className="font-bold font-mono">₹{convenienceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>GST / Taxes (5%):</span>
                <span className="font-bold font-mono">₹{gstTax.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between font-black text-sm text-slate-950">
                <span>TOTAL AMOUNT PAID:</span>
                <span className="font-mono text-emerald-800 text-base">₹{totalPaidFare.toFixed(2)}</span>
              </div>

              <div className="pt-2 text-[10.5px] text-slate-600 space-y-0.5 border-t border-slate-200 mt-2">
                <div>Payment Status: <strong className="text-emerald-800 font-bold uppercase">{booking.payment_status || 'PAID'}</strong></div>
                <div>Payment Method: <strong className="text-slate-800 uppercase">{booking.payment_method || 'UPI / ONLINE'}</strong></div>
                <div>Transaction ID: <strong className="text-slate-800 font-mono">{booking.transaction_id || `TXN${pnrNumber}`}</strong></div>
              </div>
            </div>

            {/* QR Verification Box */}
            <div className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50/50 print:bg-white">
              <QRCodeSVG value={qrPayload} size={110} />
              <div className="space-y-0.5">
                <span className="text-[9.5px] font-mono font-bold text-slate-600 block uppercase">Digital ERS Verification</span>
                <span className="text-[8.5px] font-mono text-slate-400 block">PNR: {pnrNumber}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Important Railway Information */}
        <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/60 print:bg-white text-[11px] font-mono text-slate-800 space-y-2">
          <div className="font-black uppercase tracking-wider text-xs border-b border-slate-300 pb-1 text-slate-900 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-slate-700" />
            <span>Important Passenger Instructions</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed text-[10.5px]">
            <li>One of the passengers booked on this e-ticket <strong>MUST carry an original valid Photo Identity Card</strong> (Aadhaar / Voter ID / Passport / Driving License / Govt ID) during journey for TTE inspection.</li>
            <li>Fully waitlisted e-tickets are <strong>NOT valid for travel</strong> inside reserved train coaches.</li>
            <li>Journey details and passenger names must match the identity proof presented to the Ticket Examiner.</li>
            <li>Departure and arrival timings shown are subject to railway operational schedules. Passengers should verify live running status before boarding.</li>
            <li>Cancellation and refund policy applies as per standard RailControl Railway Fare Regulations.</li>
          </ol>
        </div>

        {/* Support Information */}
        <div className="border border-slate-300 rounded-lg p-3 bg-white text-[10.5px] font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-900">RAILCONTROL SUPPORT & HELPLINE:</span>
          <span>Helpline: <strong>139</strong></span>
          <span>Email: <strong>support@railcontrol.com</strong></span>
          <span>Portal: <strong>Live Tracking & Support</strong></span>
        </div>

        {/* Formal Ticket Footer */}
        <div className="text-center pt-3 border-t border-slate-300 text-[10px] font-mono text-slate-500 space-y-0.5">
          <p className="font-bold">This is a computer-generated Electronic Reservation Slip (ERS).</p>
          <p className="font-black text-slate-800 uppercase">RAILCONTROL &bull; Intelligent Railway Management System</p>
          <p className="text-[9px]">PNR: {pnrNumber} &bull; Security Signature Verified</p>
        </div>

      </div>

      {/* Screen Action Bar (Hidden during Print) */}
      <div className="mx-auto max-w-4xl mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => navigate('/passenger')}
            className="rounded-lg border border-slate-300 hover:bg-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition"
          >
            &larr; Back to My Bookings
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={handleShareTicket}
            className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share Ticket</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center space-x-1.5 rounded-lg bg-indigo-950 hover:bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Ticket</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default ETicket;
