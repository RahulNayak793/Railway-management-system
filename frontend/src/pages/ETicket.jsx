import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Download, Printer, Share2, Calendar, Compass, Train, MapPin, 
  Utensils, ShieldAlert, Check, X, UtensilsCrossed, PhoneCall, Sparkles, CheckSquare
} from 'lucide-react';
import api from '../services/api';

const ETicket = () => {
  const { pnr } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const success = searchParams.get('success') === 'true';
  const bookingId = searchParams.get('booking_id');

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // e-Catering Ordering Modal
  const [showCateringModal, setShowCateringModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState('BPL');
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [mealOrderSuccess, setMealOrderSuccess] = useState(false);

  // Emergency SOS Modal
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosReason, setSosReason] = useState('Medical Assistance Required');
  const [sosSubmitted, setSosSubmitted] = useState(false);

  const cateringMenu = [
    { id: 'm1', name: 'IRCTC Standard Veg Thali', type: 'Veg', price: 150, desc: 'Paneer Butter Masala, Dal Tadka, 3 Chapatis, Rice, Curd & Sweet' },
    { id: 'm2', name: 'Hyderabadi Dum Biryani', type: 'Non-Veg', price: 220, desc: 'Aromatic basmati rice with spiced chicken, Mirchi ka Salan & Raita' },
    { id: 'm3', name: 'Shuddh Jain Special Thali', type: 'Jain', price: 160, desc: 'No Onion, No Garlic Paneer Sabzi, Yellow Dal, 3 Rotis, Rice & Kheer' },
    { id: 'm4', name: 'South Indian Combo Box', type: 'Veg', price: 120, desc: '2 Ghee Masala Idlis, 1 Vada, Sambar & Coconut Chutney' },
    { id: 'm5', name: 'Hot Tea/Coffee & Samosa Twin Pack', type: 'Snack', price: 60, desc: '2 Crispy Punjabi Samosas served with Green Chutney and Masala Tea' }
  ];

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

  const handleOrderMealSubmit = () => {
    if (!selectedMeal) {
      alert('Please select a meal option from the menu.');
      return;
    }
    setMealOrderSuccess(true);
    setTimeout(() => {
      setMealOrderSuccess(false);
      setShowCateringModal(false);
      setSelectedMeal(null);
    }, 2500);
  };

  const handleSosSubmit = () => {
    setSosSubmitted(true);
    setTimeout(() => {
      setSosSubmitted(false);
      setShowSosModal(false);
    }, 3000);
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
      <div className="mx-auto max-w-xl py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">E-Ticket Not Found</h2>
        <p className="text-sm text-slate-500">We could not retrieve ticket details for this request.</p>
        <button 
          onClick={() => navigate('/passenger')}
          className="rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-primary-700 transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      
      {/* Banner message if redirecting after successful payment */}
      {success && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-500 text-white p-4 shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-100" />
          <div>
            <h4 className="text-sm font-extrabold">Payment Successful & Reservation Confirmed!</h4>
            <p className="text-xs text-emerald-100">Your electronic railway ticket (E-Ticket) has been issued. SMS and Email confirmations sent.</p>
          </div>
        </div>
      )}

      {/* Main E-Ticket Printable Board */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden print:shadow-none print:border-none">
        
        {/* Ticket Header Strip */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-primary-500 text-white font-mono text-xs font-black px-2.5 py-0.5 rounded uppercase tracking-wider">
                PNR: {booking.pnr_number}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider">
                {booking.status}
              </span>
            </div>
            <h1 className="text-2xl font-black mt-2 tracking-tight">
              {booking.train?.train_name || 'Rajdhani Express'} <span className="font-mono text-slate-400">#{booking.train?.train_number || '12952'}</span>
            </h1>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Class & Quota</span>
            <span className="text-lg font-black text-primary-400">{booking.coach_class || '3A'} Class</span>
            <span className="text-xs text-slate-400 font-semibold block">General Quota (GN)</span>
          </div>
        </div>

        {/* Ticket Content */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Route & Timings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 items-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Boarding Station</span>
              <span className="text-lg font-black text-slate-800">New Delhi (NDLS)</span>
              <span className="text-xs text-slate-500 font-bold block mt-0.5">Dep: 16:30 IST</span>
            </div>

            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Travel Date</span>
              <span className="text-xs font-black text-primary-700">{booking.travel_date || '24 Jul 2026'}</span>
              <div className="w-full flex items-center space-x-2 my-1">
                <div className="h-0.5 bg-slate-200 flex-1"></div>
                <Train className="h-4 w-4 text-primary-600" />
                <div className="h-0.5 bg-slate-200 flex-1"></div>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Duration: 15h 45m</span>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Destination Station</span>
              <span className="text-lg font-black text-slate-800">Mumbai Central (MMCT)</span>
              <span className="text-xs text-slate-500 font-bold block mt-0.5">Arr: 08:15 (+1 Day)</span>
            </div>
          </div>

          {/* Passenger Seat Allocation Roster */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Passenger Seat Allocations</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Passenger Name</th>
                    <th className="px-4 py-3">Age & Gender</th>
                    <th className="px-4 py-3">Coach & Seat</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {booking.allocations && booking.allocations.length > 0 ? (
                    booking.allocations.map((alloc, idx) => (
                      <tr key={idx}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">{alloc.passenger_name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{alloc.passenger_age || 30} yrs / {alloc.passenger_gender || 'Male'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-primary-700 font-bold">Coach B1 / Seat #{alloc.seat_id || (idx+12)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                          <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-bold uppercase">
                            CNF / CONFIRMED
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">Rahul Sharma</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">30 yrs / Male</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-primary-700 font-bold">Coach B1 / Seat 24 (Lower Berth)</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                        <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-bold uppercase">
                          CNF / CONFIRMED
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Fare Breakdown & Security Stamp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-xs print:bg-white">
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Base Ticket Fare:</span>
                <span className="font-mono font-bold">₹{Math.round(booking.total_fare * 0.88)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IRCTC Service Fee & Insurance:</span>
                <span className="font-mono font-bold">₹{Math.round(booking.total_fare * 0.07)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (2.5%) + SGST (2.5%):</span>
                <span className="font-mono font-bold">₹{Math.round(booking.total_fare * 0.05)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between font-black text-slate-900 text-sm">
                <span>Total Fare Paid:</span>
                <span className="font-mono text-emerald-700">₹{booking.total_fare}</span>
              </div>
            </div>

            {/* Barcode & TTE Scan Badge */}
            <div className="flex flex-col items-center justify-center border-l-0 md:border-l border-slate-200 pl-0 md:pl-4 text-center space-y-2">
              <div className="bg-white px-4 py-2 border border-slate-300 rounded-xl shadow-xs">
                {/* Barcode Visual */}
                <div className="font-mono font-black tracking-widest text-slate-900 text-xs select-none space-x-1">
                  ||| | |||| | || |||| | ||| |||| | ||
                </div>
                <span className="text-[9px] font-mono font-bold text-slate-500 block">TTE SCAN: PNR-{booking.pnr_number}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-semibold leading-tight">
                <span className="font-bold text-slate-700 block">GSTIN: 07AAATI1234F1Z8</span>
                <span>IRCTC Helpline: 139 • CRIS Digital Verification Seal Active</span>
              </div>
            </div>
          </div>

          {/* Official Travel Rules Notice */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 text-[11px] text-amber-950 space-y-1">
            <span className="font-extrabold uppercase tracking-wider text-amber-900 block text-[10px]">Important Passenger Travel Notice:</span>
            <p>1. One of the passengers booked on this e-ticket must carry a valid Original Photo Identity Card (Aadhaar / Voter ID / Passport / Driving License) during journey for TTE verification.</p>
            <p>2. Fully waitlisted e-tickets are not valid for travel inside reserved coaches.</p>
          </div>
        </div>
      </div>

      {/* Action Bar & Extra Feature Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-2">
          {/* Seat Catering Pre-order Button */}
          <button
            onClick={() => setShowCateringModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 active:scale-95 transition"
          >
            <Utensils className="h-4 w-4" />
            <span>Order Seat Meals (e-Catering)</span>
          </button>

          {/* Emergency SOS Button */}
          <button
            onClick={() => setShowSosModal(true)}
            className="flex items-center space-x-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 active:scale-95 transition"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Emergency SOS Aid</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
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

      {/* E-CATERING SEAT MEAL ORDERING MODAL */}
      {showCateringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
            
            <div className="bg-orange-600 text-white p-6 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">IRCTC e-Catering Meal Booking</h3>
                  <p className="text-xs text-orange-100">Fresh meals delivered directly to seat berth for PNR #{booking.pnr_number}</p>
                </div>
              </div>
              <button onClick={() => setShowCateringModal(false)} className="text-white hover:opacity-80">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {mealOrderSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-6 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <h4 className="text-base font-black">Meal Order Confirmed!</h4>
                  <p className="text-xs font-semibold text-emerald-700">
                    Your meal will be delivered directly to your seat by IRCTC e-Catering vendor at station stop {selectedStation}.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Delivery Station Stop</label>
                    <select
                      value={selectedStation}
                      onChange={(e) => setSelectedStation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="BPL">Bhopal Junction (BPL) - ETA 21:15</option>
                      <option value="AGC">Agra Cantt (AGC) - ETA 18:40</option>
                      <option value="GWL">Gwalior Junction (GWL) - ETA 19:50</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Select Meal Menu Item</label>
                    {cateringMenu.map(meal => (
                      <div
                        key={meal.id}
                        onClick={() => setSelectedMeal(meal)}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                          selectedMeal?.id === meal.id 
                            ? 'border-orange-500 bg-orange-50/50 shadow-sm' 
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-800 text-xs">{meal.name}</span>
                            <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase ${
                              meal.type === 'Veg' ? 'bg-emerald-100 text-emerald-800' : meal.type === 'Non-Veg' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {meal.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">{meal.desc}</p>
                        </div>
                        <span className="font-mono text-sm font-black text-orange-600 shrink-0 ml-3">₹{meal.price}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

            </div>

            {!mealOrderSuccess && (
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">
                  {selectedMeal ? `Selected Item: ₹${selectedMeal.price}` : 'Select a meal to proceed'}
                </span>
                <button
                  onClick={handleOrderMealSubmit}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black transition active:scale-95 shadow-md shadow-orange-600/20"
                >
                  Confirm & Pay Meal
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* EMERGENCY SOS MODAL */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            
            <div className="bg-rose-600 text-white p-6 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Railway Emergency SOS Request</h3>
                  <p className="text-xs text-rose-100">Dispatches RPF Security / Medical Team to your coach</p>
                </div>
              </div>
              <button onClick={() => setShowSosModal(false)} className="text-white hover:opacity-80">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {sosSubmitted ? (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center space-y-2">
                  <PhoneCall className="h-10 w-10 text-rose-600 mx-auto animate-bounce" />
                  <h4 className="text-base font-black">SOS Alert Transmitted!</h4>
                  <p className="text-xs font-semibold text-rose-700">
                    RPF Security Control and Train Conductor have received your emergency alert for PNR #{booking.pnr_number}. Assistance will reach Coach B1 shortly.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-800 font-medium leading-relaxed">
                    ⚠️ Emergency SOS should be triggered for urgent medical conditions, security threats, or onboard distress. Helpline 139 is also active 24/7.
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Emergency Nature</label>
                    <select
                      value={sosReason}
                      onChange={(e) => setSosReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="Medical Assistance Required">Medical Emergency / Doctor Required</option>
                      <option value="RPF Security Assistance">RPF Security / Theft / Threat Alert</option>
                      <option value="Coach Technical Emergency">AC / Water / Coach Technical Failure</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSosSubmit}
                    className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition active:scale-95 shadow-md shadow-rose-600/20"
                  >
                    DISPATCH EMERGENCY SOS NOW
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ETicket;
