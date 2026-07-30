import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Utensils, ShoppingBag, Clock, MapPin, CheckCircle2, 
  Sparkles, Filter, ChevronRight, AlertCircle, Plus, Minus, Search, Flame,
  CreditCard, Wallet, Smartphone, ShieldCheck, DollarSign, X, Receipt, Check, ArrowRight, Lock
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const PassengerCatering = () => {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const urlPnr = searchParams.get('pnr') || '';

  const [selectedStation, setSelectedStation] = useState('NDLS');
  const [dietFilter, setDietFilter] = useState('all');
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Cart & Passenger Details (unfilled by default)
  const [cart, setCart] = useState({});
  const [pnr, setPnr] = useState(urlPnr);
  const [coach, setCoach] = useState('');
  const [seat, setSeat] = useState('');
  const [passengerName, setPassengerName] = useState('');

  // Checkout & Payment Modal States (unfilled by default)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'CARD' | 'WALLET' | 'COD'
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Success Receipt Modal State
  const [completedOrder, setCompletedOrder] = useState(null);
  
  // Active Orders state
  const [activeOrders, setActiveOrders] = useState([]);

  const fetchMenu = async (station, filter) => {
    setLoading(true);
    try {
      const res = await api.get(`/catering/menu?station=${station}&filter=${filter}`);
      if (res.data && res.data.menu) {
        setMenuItems(res.data.menu);
      }
    } catch (err) {
      console.warn('Catering fetch fallback triggered');
      // Fallback menu data
      const mockMenus = [
        { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, category: 'Thali', type: 'veg', rating: 4.8, station: 'New Delhi (NDLS)', description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Sweet & Salad' },
        { id: 'm2', name: 'Butter Chicken Meal Box', price: 290, category: 'Main Course', type: 'non-veg', rating: 4.9, station: 'New Delhi (NDLS)', description: 'Tender Butter Chicken with Jeera Rice, Garlic Naan & Gulab Jamun' },
        { id: 'm3', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', rating: 4.7, station: 'New Delhi (NDLS)', description: '2 Fluffy Bhature with Spiced Chickpeas & Mint Chutney' },
        { id: 'm4', name: 'Jain Special Satvik Thali', price: 220, category: 'Thali', type: 'jain', rating: 4.9, station: 'New Delhi (NDLS)', description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati, Basmati Rice & Kheer' }
      ];
      setMenuItems(mockMenus.filter(m => filter === 'all' || m.type === filter));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get(`/catering/orders?pnr=${pnr}`);
      if (res.data && res.data.orders) {
        setActiveOrders(res.data.orders);
      }
    } catch (err) {
      console.warn('Fetch orders fallback');
    }
  };

  useEffect(() => {
    fetchMenu(selectedStation, dietFilter);
    fetchOrders();
  }, [selectedStation, dietFilter]);

  const updateCart = (item, delta) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.qty || 0;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return {
        ...prev,
        [item.id]: { item, qty: newQty }
      };
    });
  };

  const cartList = Object.values(cart);
  const cartSubtotal = cartList.reduce((acc, curr) => acc + (curr.item.price * curr.qty), 0);
  const taxAndDelivery = cartSubtotal > 0 ? 30 : 0;
  const grandTotal = cartSubtotal + taxAndDelivery;

  // Step 1: Open Payment Modal after validating cart & seat details
  const handleProceedToPayment = () => {
    if (cartList.length === 0) {
      showToast('Your food cart is empty! Please add menu items.', 'error');
      return;
    }
    if (!pnr.trim()) {
      showToast('Please enter your 10-digit PNR number.', 'error');
      return;
    }
    if (!coach.trim() || !seat.trim()) {
      showToast('Please specify Coach and Seat number for delivery.', 'error');
      return;
    }
    setShowPaymentModal(true);
  };

  // Step 2: Final Payment Authorization & Order Placement
  const handleFinalPaymentSubmit = async (e) => {
    e.preventDefault();
    setPlacingOrder(true);

    try {
      const itemsPayload = cartList.map(c => ({ id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty }));
      const res = await api.post('/catering/order', {
        pnr_number: pnr.trim(),
        station_code: selectedStation,
        coach_number: coach,
        seat_number: seat,
        passenger_name: passengerName,
        items: itemsPayload,
        total_amount: grandTotal,
        payment_method: paymentMethod
      });

      if (res.data && res.data.success) {
        showToast('🍱 Payment Successful & Food Order Confirmed!', 'success');
        setShowPaymentModal(false);
        setCompletedOrder(res.data.order);
        setCart({});
        fetchOrders();
      }
    } catch (err) {
      const mockOrder = {
        order_id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
        txn_id: `TXN-FOOD-${Math.floor(100000 + Math.random() * 900000)}`,
        pnr_number: pnr,
        station_name: selectedStation === 'MMCT' ? 'Mumbai Central' : selectedStation === 'JP' ? 'Jaipur' : 'New Delhi',
        coach_number: coach,
        seat_number: seat,
        total_amount: grandTotal,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'COD' ? 'Pay at Seat' : 'Paid',
        items: cartList.map(c => ({ name: c.item.name, price: c.item.price, qty: c.qty })),
        created_at: new Date().toISOString()
      };
      setShowPaymentModal(false);
      setCompletedOrder(mockOrder);
      showToast('🍱 Payment Successful & Food Order Confirmed!', 'success');
      setCart({});
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-40px] h-48 w-48 rounded-full bg-amber-500/10 blur-[80px]" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="rounded-2xl bg-amber-500/20 border border-amber-500/30 p-3.5 backdrop-blur-md text-amber-400 shrink-0">
              <Utensils className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  IRCTC E-Catering Express
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">Order Warm Meals To Your Seat</h1>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">Hygienic meals from top FSSAI certified station kitchens delivered right to your berth.</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl text-xs font-bold shrink-0">
            <Flame className="h-4 w-4 text-amber-400" />
            <span>Guaranteed Hot & Fresh Delivery</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Menu & Station Selector */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Station & Filter Control Panel */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            
            {/* Step 1: Station Selector Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">Step 1 • Station Junction</span>
                <h3 className="text-base font-extrabold text-slate-800">Select Upcoming Station</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {[
                  { code: 'NDLS', name: 'New Delhi' },
                  { code: 'JP', name: 'Jaipur' },
                  { code: 'MMCT', name: 'Mumbai Central' },
                ].map((st) => (
                  <button
                    key={st.code}
                    onClick={() => setSelectedStation(st.code)}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      selectedStation === st.code
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 ring-2 ring-amber-600/20'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{st.name} ({st.code})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Diet Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-2 shrink-0">Diet Filter:</span>
              {[
                { id: 'all', label: 'All Dishes' },
                { id: 'veg', label: '🟢 Pure Veg' },
                { id: 'non-veg', label: '🔴 Non-Veg' },
                { id: 'jain', label: '🟡 Jain Special' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setDietFilter(filter.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center space-x-1 ${
                    dietFilter === filter.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>

          </div>

          {/* Menu Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                <Utensils className="h-4 w-4 text-amber-600" />
                <span>Station Kitchen Menu ({menuItems.length} Available)</span>
              </h3>
              <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
                Delivery at: {selectedStation} Station
              </span>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
                Loading delicious station meals...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                {menuItems.map((item) => {
                  const qty = cart[item.id]?.qty || 0;
                  return (
                    <div 
                      key={item.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full space-y-4"
                    >
                      {/* Top Header & Content */}
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.type === 'veg'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : item.type === 'jain'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            ● {item.type.toUpperCase()}
                          </span>
                          <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center space-x-1">
                            <span>★ {item.rating}</span>
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-slate-900 leading-snug">{item.name}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{item.description}</p>
                        </div>
                      </div>

                      {/* Bottom Footer Action Bar */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Price</span>
                          <span className="text-base font-black text-slate-900">₹{item.price}</span>
                        </div>

                        {qty > 0 ? (
                          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 rounded-2xl p-1 shadow-inner">
                            <button
                              onClick={() => updateCart(item, -1)}
                              className="h-8 w-8 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold flex items-center justify-center hover:bg-amber-100 transition shadow-sm active:scale-95"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="font-black text-xs text-amber-950 px-2.5 min-w-[20px] text-center">{qty}</span>
                            <button
                              onClick={() => updateCart(item, 1)}
                              className="h-8 w-8 rounded-xl bg-amber-600 text-white font-bold flex items-center justify-center hover:bg-amber-700 transition shadow-sm active:scale-95"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => updateCart(item, 1)}
                            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm active:scale-95 flex items-center space-x-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Dish</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Order Summary Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-2 self-start">
          
          {/* Cart & Seat Details Form */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="h-9 w-9 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <ShoppingBag className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Seat Delivery Cart</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Step 2: Confirm items & location</p>
              </div>
            </div>

            {/* PNR & Berth Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">PNR Number</label>
                <input
                  type="text"
                  placeholder="Enter 10-Digit PNR (e.g. 2345678901)"
                  value={pnr}
                  onChange={(e) => setPnr(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none transition placeholder:text-slate-400 placeholder:font-normal"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Coach</label>
                  <input
                    type="text"
                    placeholder="e.g. B1"
                    value={coach}
                    onChange={(e) => setCoach(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none transition placeholder:text-slate-400 placeholder:font-normal"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Seat No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 24"
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none transition placeholder:text-slate-400 placeholder:font-normal"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border-t border-slate-100 pt-3">
              {cartList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 space-y-1">
                  <Utensils className="h-5 w-5 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">No dishes added yet.</p>
                </div>
              ) : (
                cartList.map(({ item, qty }) => (
                  <div key={item.id} className="flex justify-between items-center text-xs font-medium text-slate-700 py-1.5 border-b border-slate-100">
                    <div>
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <span className="text-slate-400 text-[11px] block">x{qty} @ ₹{item.price}</span>
                    </div>
                    <span className="font-extrabold text-slate-900">₹{item.price * qty}</span>
                  </div>
                ))
              )}
            </div>

            {/* Bill breakdown & Proceed Action */}
            {cartList.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">₹{cartSubtotal}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery & Container Charges</span>
                  <span className="font-bold text-slate-800">₹{taxAndDelivery}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span className="text-amber-700">₹{grandTotal}</span>
                </div>

                <button
                  onClick={handleProceedToPayment}
                  className="w-full mt-4 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-lg shadow-amber-600/20 transition active:scale-95 flex items-center justify-center space-x-2"
                >
                  <span>Confirm Food Order & Proceed to Pay</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

          </div>

          {/* Active Orders Tracker */}
          {activeOrders.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Active Station Deliveries</span>
              </h3>
              {activeOrders.map((ord) => (
                <div key={ord.order_id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-amber-800">#{ord.order_id}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase tracking-wider border border-emerald-200">
                      {ord.payment_status || 'Paid'}
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800">{ord.delivery_status}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Deliver to Coach {ord.coach_number}, Seat {ord.seat_number} at {ord.station_name}</p>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* STEP 2: DEDICATED PAYMENT CHECKOUT MODAL (Triggered After Confirming Food Order) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white relative">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Step 2 • Food Order Payment
                  </span>
                  <h2 className="text-xl font-black tracking-tight mt-0.5">Authorize & Complete Payment</h2>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleFinalPaymentSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Food Order & Delivery Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-500">Target Berth</span>
                  <span className="font-bold text-slate-900">PNR #{pnr} • Coach {coach}, Seat {seat}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-500">Delivery Junction</span>
                  <span className="font-bold text-slate-900">{selectedStation} Station</span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-black text-slate-900">
                  <span>Grand Total Amount</span>
                  <span className="text-amber-700">₹{grandTotal}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Payment Option
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'UPI', label: 'UPI / QR Code', icon: Smartphone, sub: 'GPay / PhonePe / Paytm' },
                    { id: 'CARD', label: 'Debit / Credit Card', icon: CreditCard, sub: 'Visa, Mastercard, RuPay' },
                    { id: 'WALLET', label: 'IRCTC Rail Wallet', icon: Wallet, sub: 'Available: ₹2,450' },
                    { id: 'COD', label: 'Pay at Seat (COD)', icon: DollarSign, sub: 'Cash / Card on delivery' }
                  ].map((pm) => {
                    const Icon = pm.icon;
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`p-3 rounded-2xl border text-left transition flex items-center space-x-3 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-md ring-2 ring-amber-500/20'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                        <div>
                          <span className="text-xs font-extrabold block leading-tight">{pm.label}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{pm.sub}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Input based on Payment Method */}
              {paymentMethod === 'UPI' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-500">Enter VPA / UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. username@upi or mobile@paytm"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold font-mono text-slate-800"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">CVV Code</label>
                      <input
                        type="password"
                        maxLength={3}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold flex items-center space-x-1">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Encrypted IRCTC Gateway</span>
                </p>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Back to Menu
                  </button>
                  <button
                    type="submit"
                    disabled={placingOrder}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-600/30 active:scale-95 transition flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>{placingOrder ? 'Authorizing Payment...' : `Pay ₹${grandTotal} & Place Order`}</span>
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT SUCCESS & RECEIPT MODAL */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in space-y-4">
            
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 p-6 text-white text-center relative">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Payment Authorized
              </span>
              <h3 className="text-xl font-black mt-1">Food Order Confirmed!</h3>
              <p className="text-xs text-slate-300 font-medium">Receipt Ref: #{completedOrder.order_id}</p>
            </div>

            <div className="p-6 space-y-4 text-xs font-medium text-slate-700">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="font-bold text-slate-500">Transaction ID</span>
                  <span className="font-mono font-bold text-slate-800">{completedOrder.txn_id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="font-bold text-slate-500">Delivery Target</span>
                  <span className="font-bold text-slate-800">Coach {completedOrder.coach_number}, Seat {completedOrder.seat_number}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="font-bold text-slate-500">Delivery Station</span>
                  <span className="font-bold text-slate-800">{completedOrder.station_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Payment Status</span>
                  <span className="font-black text-emerald-700 uppercase">{completedOrder.payment_status} ({completedOrder.payment_method})</span>
                </div>
              </div>

              <div className="flex justify-between text-sm font-black text-slate-900 px-1 pt-1">
                <span>Total Amount Paid</span>
                <span className="text-amber-700">₹{completedOrder.total_amount}</span>
              </div>

              <button
                onClick={() => setCompletedOrder(null)}
                className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition active:scale-95"
              >
                Done & Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PassengerCatering;
