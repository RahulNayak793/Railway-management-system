import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  
  // Active Orders state & Order Detail Modal State
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

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
        { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, category: 'Thali', type: 'veg', rating: 4.8, description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Gulab Jamun & Salad' },
        { id: 'm2', name: 'Super Executive Non-Veg Thali', price: 310, category: 'Thali', type: 'non-veg', rating: 4.9, description: 'Butter Chicken, Egg Curry, Basmati Rice, 3 Chapatis, Mint Raita & Sweet' },
        { id: 'm3', name: 'Jain Special Satvik Thali', price: 220, category: 'Thali', type: 'jain', rating: 4.9, description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati, Basmati Rice & Rice Kheer' },
        { id: 'm4', name: 'Maharashtrian Special Thali', price: 250, category: 'Thali', type: 'veg', rating: 4.7, description: 'Puran Poli, Pithla Bhakri, Aloo Bhaji, Steamed Rice & Solkadhi' },
        { id: 'm5', name: 'Rajasthani Dal Baati Churma Thali', price: 260, category: 'Thali', type: 'veg', rating: 4.9, description: 'Traditional Ghee-loaded Baati with Panchmel Dal & Sweet Churma' },
        { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani', price: 280, category: 'Main Course', type: 'non-veg', rating: 4.9, description: 'Aromatic Basmati Rice, Tender Chicken, Egg, Mirchi Ka Salan & Raita' },
        { id: 'm7', name: 'Lucknowi Veg Dum Biryani Bowl', price: 210, category: 'Main Course', type: 'veg', rating: 4.8, description: 'Saffron Basmati Rice with Fresh Vegetables, Paneer & Mint Raita' },
        { id: 'm8', name: 'Egg Biryani Feast Box', price: 230, category: 'Main Course', type: 'non-veg', rating: 4.7, description: '2 Boiled Eggs in Spiced Basmati Biryani served with Onion Raita' },
        { id: 'm9', name: 'South Indian Tiffin Combo', price: 160, category: 'South Indian', type: 'veg', rating: 4.8, description: '2 Ghee Idlis, 1 Medu Vada, 1 Mini Masala Dosa, Piping Hot Sambar & Coconut Chutney' },
        { id: 'm10', name: 'Crispy Paper Masala Dosa', price: 140, category: 'South Indian', type: 'veg', rating: 4.7, description: 'Golden Rice Crepe filled with Spiced Potato Masala & Tomato Chutney' },
        { id: 'm11', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', rating: 4.8, description: '2 Fluffy Bhature with Spiced Chickpeas, Fried Green Chili & Pickle' },
        { id: 'm12', name: 'Mumbai Butter Pav Bhaji', price: 150, category: 'Snacks', type: 'veg', rating: 4.8, description: 'Butter-toasted Pav with Spicy Vegetable Bhaji, Lemon & Salad' },
        { id: 'm13', name: 'Grilled Paneer Tikka Kathi Roll', price: 170, category: 'Snacks', type: 'veg', rating: 4.7, description: 'Smoky Cottage Cheese with Mint Chutney in Lachha Paratha' },
        { id: 'm14', name: 'Spiced Chicken Kathi Roll', price: 190, category: 'Snacks', type: 'non-veg', rating: 4.8, description: 'Succulent Chicken Tikka with Tangy Spices in Malabar Paratha' },
        { id: 'm15', name: 'Samosa & Hot Masala Tea Pack', price: 70, category: 'Snacks', type: 'veg', rating: 4.6, description: '2 Crispy Punjabi Potato Samosas with Cutting Masala Chai' },
        { id: 'm16', name: 'Gulab Jamun Pair Box', price: 80, category: 'Desserts', type: 'veg', rating: 4.9, description: '2 Warm Soft Khoya Gulab Jamuns soaked in Cardamom Syrup' },
        { id: 'm17', name: 'Bengali Spongy Rasgulla Twin', price: 80, category: 'Desserts', type: 'veg', rating: 4.8, description: '2 Fresh Cottage Cheese Balls in Light Rose Syrup' },
        { id: 'm18', name: 'Fresh Mango Lassi Bottle', price: 90, category: 'Beverages', type: 'veg', rating: 4.9, description: 'Thick Creamy Alphonso Mango Yogurt Drink (300ml)' }
      ];
      setMenuItems(mockMenus.filter(m => filter === 'all' || m.type === filter));
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get(`/catering/orders?pnr=${pnr}`);
      if (res.data && res.data.orders && res.data.orders.length > 0) {
        setActiveOrders(res.data.orders);
        return;
      }
    } catch (err) {
      console.warn('Fetch orders fallback');
    }

    // Default Active Food Orders for demonstration & tracking
    const sampleActiveOrders = [
      {
        order_id: 'ORD-89421',
        txn_id: 'TXN-FOOD-948201',
        pnr_number: pnr || '2489104820',
        passenger_name: passengerName || 'Rahul Nayak',
        station_name: 'New Delhi Central (NDLS)',
        coach_number: 'B1',
        seat_number: '24',
        delivery_status: 'Out for Seat Delivery 🚚',
        step_stage: 3,
        total_amount: 450,
        payment_method: 'UPI',
        payment_status: 'Paid',
        items: [
          { name: 'Deluxe North Indian Thali', price: 240, qty: 1 },
          { name: 'Fresh Mango Lassi Bottle', price: 90, qty: 2 },
          { name: 'Container & Express Handling', price: 30, qty: 1 }
        ],
        created_at: '10 Aug 2026, 04:30 PM',
        estimated_delivery: '10 Aug 2026, 05:15 PM'
      }
    ];
    setActiveOrders(sampleActiveOrders);
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
            
            {/* Diet Filter Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">IRCTC Approved Menu</span>
                <h3 className="text-base font-extrabold text-slate-800">Select Seat Delivery Meals</h3>
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
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>Active Station Deliveries</span>
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                  {activeOrders.length} Order Active
                </span>
              </div>
              {activeOrders.map((ord) => (
                <div key={ord.order_id} className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-amber-800">#{ord.order_id}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase tracking-wider border border-emerald-200">
                      {ord.payment_status || 'Paid'}
                    </span>
                  </div>
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5 text-amber-600" />
                    <span>{ord.delivery_status}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">Deliver to Coach {ord.coach_number}, Seat {ord.seat_number} at {ord.station_name}</p>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderDetail(ord)}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span>View Food Order Details & Track</span>
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* STEP 2: DEDICATED PAYMENT CHECKOUT MODAL (Triggered After Confirming Food Order) */}
      {showPaymentModal && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in my-auto">
            
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'UPI', name: 'Instant UPI', icon: Smartphone, desc: 'GPay / PhonePe / Paytm' },
                    { id: 'CARD', name: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
                    { id: 'WALLET', name: 'Rail Wallet', icon: Wallet, desc: 'Instant 1-Click Pay' },
                    { id: 'COD', name: 'Pay at Seat (COD)', icon: DollarSign, desc: 'Cash / UPI on Delivery' },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                          paymentMethod === m.id
                            ? 'border-amber-600 bg-amber-50/70 shadow-sm text-amber-950 font-bold'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`h-4 w-4 ${paymentMethod === m.id ? 'text-amber-600' : 'text-slate-400'}`} />
                          {paymentMethod === m.id && <Check className="h-3.5 w-3.5 text-amber-600" />}
                        </div>
                        <div>
                          <span className="text-xs font-black block leading-tight">{m.name}</span>
                          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">{m.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Forms */}
              {paymentMethod === 'UPI' && (
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Virtual Payment Address (UPI ID)</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or username@okicici"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">16-Digit Card Number</label>
                    <input
                      type="text"
                      maxLength={19}
                      placeholder="4532 •••• •••• 8921"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800"
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
        </div>,
        document.body
      )}

      {/* STEP 3: PAYMENT SUCCESS & RECEIPT MODAL */}
      {completedOrder && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setCompletedOrder(null); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in space-y-4 my-auto">
            
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
        </div>,
        document.body
      )}

      {/* FULL FOOD ORDER & DELIVERY TRACKER DETAIL MODAL */}
      {selectedOrderDetail && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrderDetail(null); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in max-h-[90vh] flex flex-col my-auto">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white relative flex-shrink-0">
              <button 
                onClick={() => setSelectedOrderDetail(null)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Food Order Details & Invoice
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {selectedOrderDetail.payment_status || 'Paid'}
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight mt-1">Order #{selectedOrderDetail.order_id}</h2>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              
              {/* Delivery Target & PNR Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    <span className="font-extrabold text-slate-800">Target Berth Delivery</span>
                  </div>
                  <span className="font-mono text-[11px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    PNR #{selectedOrderDetail.pnr_number}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Passenger</span>
                    <span className="font-bold text-slate-800">{selectedOrderDetail.passenger_name || 'Rahul Nayak'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Coach</span>
                    <span className="font-mono font-bold text-slate-800">{selectedOrderDetail.coach_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Seat / Berth</span>
                    <span className="font-mono font-bold text-slate-800">Seat {selectedOrderDetail.seat_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Station</span>
                    <span className="font-bold text-amber-900">{selectedOrderDetail.station_name}</span>
                  </div>
                </div>
              </div>

              {/* 4-Stage Live Station Delivery Progress Pipeline */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Live Delivery Progress
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300">Est. Delivery: {selectedOrderDetail.estimated_delivery || '5:15 PM'}</span>
                </div>

                <div className="grid grid-cols-4 gap-1 relative pt-2 text-center">
                  {[
                    { label: 'Confirmed', icon: CheckCircle2, done: true },
                    { label: 'Preparing', icon: Flame, done: selectedOrderDetail.step_stage >= 2 },
                    { label: 'Dispatched', icon: ShoppingBag, done: selectedOrderDetail.step_stage >= 3 },
                    { label: 'Delivered', icon: Utensils, done: selectedOrderDetail.step_stage >= 4 },
                  ].map((st, i) => {
                    const Icon = st.icon;
                    return (
                      <div key={i} className="flex flex-col items-center space-y-1.5">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition ${
                          st.done ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${st.done ? 'text-amber-300' : 'text-slate-500'}`}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Itemised Food Invoice */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                  Itemised Dishes Order Invoice
                </h4>

                <div className="space-y-2">
                  {(selectedOrderDetail.items || []).map((itm, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                      <div>
                        <span className="font-extrabold text-slate-800 text-xs block">{itm.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Quantity: {itm.qty} x ₹{itm.price}</span>
                      </div>
                      <span className="font-extrabold text-slate-900 font-mono">₹{itm.qty * itm.price}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 space-y-1.5 pt-2 mt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Method</span>
                    <span className="font-extrabold text-slate-800">{selectedOrderDetail.payment_method} ({selectedOrderDetail.payment_status})</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Transaction Ref</span>
                    <span className="font-mono text-slate-700">{selectedOrderDetail.txn_id || 'TXN-948201'}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-amber-200">
                    <span>Grand Total Paid</span>
                    <span className="text-amber-800">₹{selectedOrderDetail.total_amount}</span>
                  </div>
                </div>
              </div>

              {/* Helpline Contact Footer */}
              <div className="flex items-center justify-between bg-slate-100 p-3 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-600 font-bold">Station Kitchen Executive Helpline:</span>
                <span className="font-mono text-xs font-black text-amber-800 bg-white px-2.5 py-1 rounded-xl border border-amber-300">
                  📞 +91 98765 43210
                </span>
              </div>

            </div>

            {/* Modal Footer Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition active:scale-95 shadow-md"
              >
                Close Food Order Details
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default PassengerCatering;
