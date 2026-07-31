import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Train, User, Plus, Trash2, ArrowRight, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const SeatSelection = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const trainId = searchParams.get('train_id') || 't1';
  const tomorrowStr = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0];
  const travelDate = searchParams.get('date') || tomorrowStr;
  const coachClass = searchParams.get('class') || '3A';
  const initialPassengersCount = parseInt(searchParams.get('passengers') || '1');
  const baseFare = parseInt(searchParams.get('fare') || '750');

  const [train, setTrain] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [passengers, setPassengers] = useState(
    Array.from({ length: initialPassengersCount }).map(() => ({ name: '', age: '', gender: 'Male', berth: 'No Preference' }))
  );
  const [savedCompanions, setSavedCompanions] = useState([]);
  const [autoAllocate, setAutoAllocate] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch saved companions on load
  useEffect(() => {
    const fetchCompanions = async () => {
      if (user && user.role === 'passenger') {
        try {
          const res = await api.get('/auth/saved-passengers');
          setSavedCompanions(res.data);
        } catch (err) {
          console.error('Error fetching saved companions:', err);
        }
      }
    };
    fetchCompanions();
  }, [user]);

  useEffect(() => {
    const fetchSeatLayout = async () => {
      setLoading(true);
      try {
        // Fetch train details
        const trainsRes = await api.get('/trains');
        const trainDetail = trainsRes.data.find(t => t.id === trainId) || trainsRes.data[0] || {
          id: trainId,
          train_name: 'Rajdhani Express',
          train_number: '12952',
          source: 'NDLS',
          destination: 'MMCT'
        };
        setTrain(trainDetail);

        // Fetch seat layout status
        const seatsRes = await api.get(`/trains/${trainId}/seats?date=${travelDate}&coach_class=${coachClass}`);
        let fetchedSeats = seatsRes.data || [];

        if (fetchedSeats.length === 0) {
          const coachNum = coachClass === 'SL' ? 'S1' : coachClass === '3A' ? 'B1' : coachClass === '2A' ? 'A1' : 'H1';
          fetchedSeats = Array.from({ length: 24 }).map((_, idx) => {
            const seatNum = idx + 1;
            const berthType = seatNum % 6 === 1 || seatNum % 6 === 2 ? 'LB' : seatNum % 6 === 3 || seatNum % 6 === 4 ? 'MB' : 'UB';
            return {
              id: `${trainId}-${coachNum}-${seatNum}`,
              train_id: trainId,
              coach_class: coachClass,
              coach_number: coachNum,
              seat_number: seatNum,
              berth_type: berthType,
              is_booked: false
            };
          });
        }
        setSeats(fetchedSeats);
      } catch (err) {
        console.error(err);
        const coachNum = coachClass === 'SL' ? 'S1' : coachClass === '3A' ? 'B1' : coachClass === '2A' ? 'A1' : 'H1';
        const fallbackSeats = Array.from({ length: 24 }).map((_, idx) => {
          const seatNum = idx + 1;
          const berthType = seatNum % 6 === 1 || seatNum % 6 === 2 ? 'LB' : seatNum % 6 === 3 || seatNum % 6 === 4 ? 'MB' : 'UB';
          return {
            id: `${trainId}-${coachNum}-${seatNum}`,
            train_id: trainId,
            coach_class: coachClass,
            coach_number: coachNum,
            seat_number: seatNum,
            berth_type: berthType,
            is_booked: false
          };
        });
        setSeats(fallbackSeats);
      } finally {
        setLoading(false);
      }
    };
    fetchSeatLayout();
  }, [trainId, travelDate, coachClass]);

  const toggleSeatSelection = (seat) => {
    if (seat.is_booked) return;
    if (autoAllocate) return;

    if (selectedSeats.find(s => s.id === seat.id)) {
      setSelectedSeats(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= passengers.length) {
        alert(`You can only select up to ${passengers.length} seats based on your passengers count.`);
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = value;
    setPassengers(updated);
  };

  const addPassenger = () => {
    setPassengers([...passengers, { name: '', age: '', gender: 'Male', berth: 'No Preference' }]);
  };

  const removePassenger = (index) => {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((_, idx) => idx !== index));
    // Reset selected seats
    setSelectedSeats([]);
  };

  const handleProceed = async (e) => {
    e.preventDefault();

    // Validations
    const invalidPassenger = passengers.some(p => !p.name || !p.age);
    if (invalidPassenger) {
      alert('Please fill out all passenger names and ages');
      return;
    }

    if (!autoAllocate && selectedSeats.length < passengers.length) {
      alert(`Please select ${passengers.length} seats on the grid or enable auto-allocate.`);
      return;
    }

    // Call Booking API
    try {
      const res = await api.post('/bookings/book', {
        train_id: trainId,
        travel_date: travelDate,
        coach_class: coachClass,
        passengers,
        total_fare: calculateTotalFare()
      });

      const { booking } = res.data;
      navigate(`/passenger/payment?booking_id=${booking.id}&amount=${calculateTotalFare()}`);
    } catch (err) {
      console.error(err);
      alert('Booking failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const calculateTotalFare = () => {
    const multiplier = passengers.length;
    const taxes = 62.50; // default booking tax/service charge
    return Math.round(baseFare * multiplier + taxes);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="rounded-xl bg-primary-900 p-2.5 text-white">
            <Train className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Seat Selection & Berth Allocation</h1>
            <p className="text-xs text-slate-400 font-semibold uppercase font-mono">
              {train?.train_name} ({train?.train_number}) &bull; {travelDate} &bull; {coachClass}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Side: Seat Layout Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Select Your Berth</h3>
              {/* Auto Allocate Toggle */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500">Auto-allocate seat</span>
                <button
                  type="button"
                  onClick={() => {
                    setAutoAllocate(!autoAllocate);
                    setSelectedSeats([]);
                  }}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    autoAllocate ? 'bg-primary-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                    autoAllocate ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Seat Colors Legend */}
            <div className="flex items-center space-x-4 text-xs font-bold border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-slate-100 border border-slate-200"></span>
                <span className="text-slate-500">Available</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-primary-600"></span>
                <span className="text-slate-500">Selected</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-red-100 border border-red-200"></span>
                <span className="text-slate-500">Booked</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em]" />
              </div>
            ) : autoAllocate ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center border border-dashed border-slate-200 text-slate-500 py-12">
                <p className="font-bold text-slate-700">Auto-Allocation Mode Enabled</p>
                <p className="text-xs mt-1">System will allocate the best available berths sequentially upon payment.</p>
              </div>
            ) : (
              /* Seat grid layout matching page 4 design */
              <div className="grid grid-cols-6 gap-3 max-w-lg mx-auto py-4">
                {seats.map((seat) => {
                  const isSelected = selectedSeats.some(s => s.id === seat.id);
                  const isBooked = seat.is_booked;
                  return (
                    <button
                      key={seat.id}
                      onClick={() => toggleSeatSelection(seat)}
                      disabled={isBooked}
                      className={`flex flex-col items-center justify-center rounded-lg border p-2 h-14 transition ${
                        isBooked 
                          ? 'bg-red-50 border-red-100 text-red-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-primary-600 border-primary-600 text-white font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-primary-400'
                      }`}
                    >
                      <span className="text-sm">{seat.seat_number}</span>
                      <span className="text-[8px] font-mono opacity-80">{seat.berth_type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Passenger Input Details List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Passenger Details</h3>
              <button
                type="button"
                onClick={addPassenger}
                className="flex items-center space-x-1 text-xs font-bold text-primary-600 hover:underline"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Passenger</span>
              </button>
            </div>

            <div className="space-y-4">
              {passengers.map((passenger, index) => (
                <div key={index} className="rounded-xl border border-slate-150 bg-slate-50/50 p-4 space-y-3 relative">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      
                      {/* Autofill Me */}
                      {user && user.role === 'passenger' && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...passengers];
                            updated[index] = {
                              name: user.full_name || '',
                              age: user.age || '',
                              gender: user.gender || 'Male',
                              berth: user.berth_preference || 'No Preference'
                            };
                            setPassengers(updated);
                          }}
                          className="text-[10px] bg-primary-50 hover:bg-primary-100 border border-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded transition flex items-center gap-1"
                        >
                          <User className="h-3 w-3" />
                          <span>Autofill Me</span>
                        </button>
                      )}

                      {/* Autofill Saved Companion */}
                      {savedCompanions.length > 0 && (
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const companion = savedCompanions.find(c => c.id === val);
                            if (companion) {
                              const updated = [...passengers];
                              updated[index] = {
                                name: companion.full_name,
                                age: companion.age || '',
                                gender: companion.gender || 'Male',
                                berth: companion.berth_preference || 'No Preference'
                              };
                              setPassengers(updated);
                            }
                            e.target.value = ''; // Reset select dropdown
                          }}
                          className="text-[10px] bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 font-bold transition focus:outline-none cursor-pointer"
                        >
                          <option value="">Fill Saved Passenger...</option>
                          {savedCompanions.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    {/* Full Name */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={passenger.name}
                        onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Age */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 30"
                        value={passenger.age}
                        onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Gender */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</label>
                      <select
                        value={passenger.gender}
                        onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    {/* Berth Preference */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Berth Preference</label>
                      <select
                        value={passenger.berth}
                        onChange={(e) => handlePassengerChange(index, 'berth', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none cursor-pointer"
                      >
                        <option value="No Preference">No Preference</option>
                        <option value="LB">Lower Berth (LB)</option>
                        <option value="MB">Middle Berth (MB)</option>
                        <option value="UB">Upper Berth (UB)</option>
                        <option value="SL">Side Lower (SL)</option>
                        <option value="SU">Side Upper (SU)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Fare Invoice Summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white">
              <h3 className="font-extrabold text-sm tracking-wide">FARE SUMMARY</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{passengers.length} Passenger(s), {coachClass} Class</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Base Fare (x{passengers.length})</span>
                <span className="font-semibold text-slate-800">₹{baseFare * passengers.length}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>IRCTC Service Charge</span>
                <span className="font-semibold text-slate-800">₹62.50</span>
              </div>
              
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Total Fare</span>
                <span className="text-xl font-extrabold text-primary-900">₹{calculateTotalFare()}</span>
              </div>

              <button
                onClick={handleProceed}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3.5 font-bold text-white shadow-lg shadow-primary-900/10 transition active:scale-95"
              >
                <span>Continue to Payment</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Secure Booking</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Your connection is protected by banking-grade SSL 256-bit encryption. Ticket cancellations receive instant refunds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatSelection;
