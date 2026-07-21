import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, Printer, Share2, Calendar, Compass, Train, MapPin } from 'lucide-react';
import api from '../services/api';

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
        
        // If bookingId is provided instead of PNR, let's fetch my bookings and match
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

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em]" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg text-center py-12 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">No ticket records found</h2>
        <p className="text-xs text-slate-400">We couldn't retrieve booking logs for PNR {pnr || bookingId}. Please check the code.</p>
        <button 
          onClick={() => navigate('/passenger')}
          className="rounded-xl bg-primary-900 text-white px-5 py-2.5 text-xs font-bold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 font-sans space-y-6 print:py-0 print:px-0">
      {/* Success Banner */}
      {success && (
        <div className="flex items-center space-x-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 shadow-lg shadow-emerald-600/20 animate-slide-in print:hidden">
          <div className="bg-white/20 p-2.5 rounded-full shrink-0 animate-bounce">
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-base tracking-wide">Payment Successful & Ticket Confirmed!</h3>
            <p className="text-xs text-emerald-100 font-medium">Your reservation payment has been authorized. Official E-Ticket is issued below.</p>
          </div>
        </div>
      )}

      {/* Ticket Layout Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden print:border-0 print:shadow-none">
        {/* Ticket Header Banner */}
        <div className="bg-primary-900 text-white p-6 flex justify-between items-center print:bg-slate-100 print:text-slate-800">
          <div className="flex items-center space-x-2">
            <Compass className="h-6 w-6" />
            <span className="text-lg font-black tracking-tight">RailControl Ticket</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-300 print:text-slate-500 block">PNR Number</span>
            <span className="text-xl font-black font-mono tracking-wider">{booking.pnr_number}</span>
          </div>
        </div>

        {/* Ticket Body Content */}
        <div className="p-6 space-y-6">
          {/* Top section: Train title & travel class */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">{booking.train?.train_name || 'Rajdhani Express'}</h2>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono">#{booking.train?.train_number || '12952'}</span>
                <span>&bull;</span>
                <span className="font-semibold text-slate-600 capitalize">Travel Class: {booking.status === 'confirmed' ? 'CNF' : booking.status.toUpperCase()}</span>
              </div>
            </div>
            {/* Validity badge */}
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 text-center flex flex-col items-center">
              <span className="text-[8px] font-bold uppercase tracking-wider block">Ticket Validity</span>
              <span className="text-xs font-bold">Valid for Travel</span>
            </div>
          </div>

          {/* Departure & Arrival coordinates */}
          <div className="grid grid-cols-3 items-center text-center bg-slate-50 rounded-xl p-4 border border-slate-100 print:bg-white print:border-slate-200">
            <div>
              <span className="text-sm font-bold text-slate-400 block">DEPARTURE</span>
              <span className="text-lg font-bold text-slate-800">16:30</span>
              <p className="text-xs text-slate-500 font-semibold mt-0.5 flex justify-center items-center">
                <MapPin className="h-3.5 w-3.5 text-primary-500 mr-1" />
                {booking.train?.routes?.[0]?.source_station_code || 'NDLS'}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-[9px] text-slate-400 font-mono">15h 20m</span>
              <div className="relative flex w-full items-center justify-center py-1">
                <div className="h-0.5 w-full bg-slate-200"></div>
                <div className="absolute h-1.5 w-1.5 rounded-full bg-primary-500"></div>
              </div>
              <span className="text-[9px] font-bold text-slate-500 flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {booking.travel_date}
              </span>
            </div>
            <div>
              <span className="text-sm font-bold text-slate-400 block">ARRIVAL</span>
              <span className="text-lg font-bold text-slate-800">08:15</span>
              <p className="text-xs text-slate-500 font-semibold mt-0.5 flex justify-center items-center">
                <MapPin className="h-3.5 w-3.5 text-primary-500 mr-1" />
                {booking.train?.routes?.[0]?.destination_station_code || 'MMCT'}
              </p>
            </div>
          </div>

          {/* Passenger & seat layout list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Allocated Passenger Berths</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 print:bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-400">Passenger Name</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-400">Age / Gender</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-400">Coach / Seat</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {booking.allocations && booking.allocations.length > 0 ? (
                    booking.allocations.map((alloc, idx) => (
                      <tr key={idx}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">{alloc.passenger_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{alloc.passenger_age} yrs / {alloc.passenger_gender}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-slate-700">
                          {alloc.seat_id ? `H1 / Seat ${alloc.seat_id.slice(-2)}` : 'Auto-allocate'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-bold uppercase ${
                            booking.status === 'confirmed' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : booking.status === 'rac' 
                              ? 'bg-amber-50 text-amber-700' 
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">Passenger 1</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">30 yrs / Male</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-slate-700">H1 / Seat 12</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                        <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 font-bold uppercase">
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing breakdown summary */}
          <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm print:bg-white print:border-slate-200">
            <span className="font-semibold text-slate-500">Fare Payment Transaction</span>
            <span className="font-extrabold text-slate-800">Completed: ₹{booking.total_fare}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-end print:hidden">
        <button 
          onClick={() => navigate('/passenger')}
          className="rounded-xl border border-slate-200 hover:bg-slate-50 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 transition"
        >
          Go Dashboard
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 px-5 py-2.5 text-xs font-bold text-white shadow-md transition"
        >
          <Printer className="h-4 w-4" />
          <span>Print E-Ticket</span>
        </button>
      </div>
    </div>
  );
};

export default ETicket;
