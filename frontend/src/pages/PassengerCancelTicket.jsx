import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Train, XCircle, Search, Ticket, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import CancellationModal from '../components/CancellationModal';

const PassengerCancelTicket = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [pnrQuery, setPnrQuery] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      const now = new Date();
      const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const utcTodayStr = now.toISOString().split('T')[0];

      // Exclude current (today's) journey date, completed past journeys, and cancelled bookings
      const eligibleBookings = (res.data || []).filter(b => {
        const rawStatus = String(b.status || '').toLowerCase();
        if (rawStatus.includes('cancel') || rawStatus === 'completed') return false;
        
        const travelDateStr = b.travel_date ? String(b.travel_date).split('T')[0].trim() : '';
        if (travelDateStr) {
          if (travelDateStr <= localTodayStr || travelDateStr <= utcTodayStr) return false;
        }
        return true;
      });
      setBookings(eligibleBookings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleOpenCancelModal = (booking) => {
    setSelectedBookingForCancel(booking);
  };

  const handleSearchCancel = async (e) => {
    e.preventDefault();
    if (!pnrQuery) return;
    const match = bookings.find(b => b.pnr_number === pnrQuery);
    if (match) {
      handleOpenCancelModal(match);
    } else {
      alert('No active ticket found with this PNR number.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-extrabold text-slate-800 font-sans">Cancel Ticket</h1>
        <p className="text-xs text-slate-400">Request booking cancellations and check refund eligibility.</p>
      </div>

      {/* PNR cancellation search box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase">Quick Cancel by PNR</h3>
        <form onSubmit={handleSearchCancel} className="flex gap-3">
          <div className="flex-1 relative rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-primary-500 transition-all flex items-center px-3">
            <Search className="h-4 w-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Enter 10-digit PNR Number"
              value={pnrQuery}
              onChange={(e) => setPnrQuery(e.target.value)}
              className="bg-transparent py-2.5 text-xs text-slate-800 focus:outline-none w-full font-semibold font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 active:scale-95 shadow-sm"
          >
            <XCircle className="h-4 w-4" />
            <span>Cancel PNR</span>
          </button>
        </form>
      </div>

      {/* Active Bookings List */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 pl-1">Eligible Bookings</h3>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
            <Ticket className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="font-bold text-slate-600 mb-1">No active journeys found</p>
            <p className="text-xs">There are no active reservations eligible for cancellation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition">
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center space-x-3">
                    <span className="font-extrabold text-slate-800 text-sm">
                      {b.train?.train_name || 'Rajdhani Express'}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold">
                      PNR: {b.pnr_number}
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">
                      {b.status}
                    </span>
                  </div>

                  {/* Route information */}
                  <div className="flex items-center space-x-6 text-xs font-semibold text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <Train className="h-3.5 w-3.5 text-primary-500" />
                      <span>{b.train?.train_number || '12952'}</span>
                    </div>
                    <div>
                      <span>Date: <strong className="text-slate-800">{b.travel_date}</strong></span>
                    </div>
                    <div>
                      <span>Paid: <strong className="text-slate-800">₹{b.total_fare}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Cancel Button */}
                <div className="flex items-center">
                  <button
                    onClick={() => handleOpenCancelModal(b)}
                    className="w-full md:w-auto px-5 py-2 border-2 border-red-200 hover:border-red-650 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-xl text-xs font-extrabold transition active:scale-95 flex items-center justify-center space-x-1.5"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel Ticket</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning Box */}
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800 flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Important Cancellation & Refund Policy</p>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-700 font-medium">
            <li>Cancellations done 5 or more days before journey date: 10% cancellation fee deducted.</li>
            <li>Cancellations done within 5 days of journey date: 5% cancellation fee deducted.</li>
            <li>Refunds are processed automatically and credited directly to your Rail Wallet / payment source.</li>
          </ul>
        </div>
      </div>

      {/* Cancellation Modal */}
      {selectedBookingForCancel && (
        <CancellationModal
          booking={selectedBookingForCancel}
          onClose={() => setSelectedBookingForCancel(null)}
          onSuccess={() => {
            setSelectedBookingForCancel(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

export default PassengerCancelTicket;
