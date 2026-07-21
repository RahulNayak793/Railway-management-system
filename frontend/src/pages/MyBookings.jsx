import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Train, MapPin, Ticket, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const MyBookings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this ticket reservation?')) return;
    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      alert('Ticket cancelled successfully. Refund processing has initiated.');
      fetchBookings();
    } catch (err) {
      alert('Cancellation failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const getFilteredBookings = () => {
    const today = new Date();
    return bookings.filter(b => {
      const travelDate = new Date(b.travel_date);
      if (activeTab === 'cancelled') {
        return b.status === 'cancelled';
      } else if (activeTab === 'completed') {
        return b.status !== 'cancelled' && travelDate < today;
      } else {
        return b.status !== 'cancelled' && travelDate >= today;
      }
    });
  };

  const filtered = getFilteredBookings();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 font-sans">My Bookings</h1>
          <p className="text-xs text-slate-400">View and manage your recent train ticket reservations.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { id: 'upcoming', label: 'Upcoming journeys' },
          { id: 'completed', label: 'Completed' },
          { id: 'cancelled', label: 'Cancelled' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-bold border-b-2 transition ${
              activeTab === tab.id 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          <Ticket className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <p className="font-bold text-slate-600 mb-1">No journeys found</p>
          <p className="text-xs">You have no {activeTab} ticket reservations logs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              {/* Card Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-slate-800 text-sm">
                    {b.train?.train_name || 'Rajdhani Express'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">PNR: {b.pnr_number}</span>
                </div>
                {/* Status indicator */}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                  b.status === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-700'
                    : b.status === 'rac' || b.status === 'waitlist'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-rose-50 text-rose-700'
                }`}>
                  {b.status}
                </span>
              </div>

              {/* Journey Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 text-center sm:text-left">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase block">FROM</span>
                  <span className="text-sm font-bold text-slate-800">New Delhi (NDLS)</span>
                </div>
                <div className="text-center">
                  <span className="text-xs text-slate-400 block font-semibold flex justify-center items-center">
                    <Calendar className="h-4 w-4 mr-1 text-primary-600" />
                    Travel: {b.travel_date}
                  </span>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">₹{b.total_fare} paid</p>
                </div>
                <div className="sm:text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase block">TO</span>
                  <span className="text-sm font-bold text-slate-800">Mumbai Central (MMCT)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-slate-50">
                {b.status !== 'cancelled' && activeTab === 'upcoming' && (
                  <button
                    onClick={() => handleCancel(b.id)}
                    className="rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 px-4 py-2 text-xs font-bold transition"
                  >
                    Cancel Journey
                  </button>
                )}
                {b.status !== 'cancelled' && (
                  <button
                    onClick={() => navigate(`/passenger/track?train_id=${b.train_id}`)}
                    className="rounded-xl border border-primary-100 text-primary-600 hover:bg-primary-50 px-4 py-2 text-xs font-bold transition"
                  >
                    Track Live Position
                  </button>
                )}
                <button
                  onClick={() => navigate(`/passenger/ticket/${b.pnr_number}`)}
                  className="rounded-xl bg-slate-900 hover:bg-slate-950 text-white px-4 py-2 text-xs font-bold transition"
                >
                  View E-Ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
