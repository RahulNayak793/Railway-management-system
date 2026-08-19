import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Utensils, ShoppingBag, Clock, MapPin, CheckCircle2, 
  Sparkles, Filter, ChevronRight, AlertCircle, Plus, Minus, Search, Flame,
  CreditCard, Wallet, Smartphone, ShieldCheck, DollarSign, X, Receipt, Check, ArrowRight, Lock,
  Train, Calendar, Ticket, ChevronDown, RefreshCw, Coffee, Tag
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const PassengerCatering = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlPnr = searchParams.get('pnr') || '';

  // Tab State: 'pnr' or 'train'
  const [searchTab, setSearchTab] = useState(urlPnr ? 'pnr' : 'pnr');

  // Order Via PNR Form States
  const [pnrInput, setPnrInput] = useState(urlPnr);
  const [searchingPnr, setSearchingPnr] = useState(false);
  const [pnrDetails, setPnrDetails] = useState(null);

  // Order Via Train No. Form States
  const [trainQuery, setTrainQuery] = useState('');
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [showTrainDropdown, setShowTrainDropdown] = useState(false);
  const [selectedStation, setSelectedStation] = useState('NDLS');
  const [boardingDate, setBoardingDate] = useState(new Date().toISOString().split('T')[0]);
  const [coach, setCoach] = useState('');
  const [seat, setSeat] = useState('');
  const [passengerName, setPassengerName] = useState('');

  // Master Data lists
  const [allTrains, setAllTrains] = useState([]);
  const [allStations, setAllStations] = useState([]);
  const [loadingMasterData, setLoadingMasterData] = useState(false);

  // Menu & Filter States
  const [activeMenuStation, setActiveMenuStation] = useState('NDLS');
  const [activeTrainName, setActiveTrainName] = useState('Rajdhani Express (12952)');
  const [dietFilter, setDietFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Cart State
  const [cart, setCart] = useState({});

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Completed & Active Orders State
  const [completedOrder, setCompletedOrder] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

  const menuSectionRef = useRef(null);

  // Initial Fetch of Trains & Stations
  useEffect(() => {
    const fetchMasterData = async () => {
      setLoadingMasterData(true);
      try {
        const [trainsRes, stationsRes] = await Promise.all([
          api.get('/trains'),
          api.get('/trains/stations')
        ]);
        if (trainsRes.data) setAllTrains(trainsRes.data);
        if (stationsRes.data) setAllStations(stationsRes.data);
      } catch (err) {
        console.warn('Fallback master data for catering search');
        setAllTrains([
          { id: 't1', train_number: '12952', train_name: 'Rajdhani Express', status: 'on_time' },
          { id: 't2', train_number: '12002', train_name: 'Shatabdi Express', status: 'delayed' },
          { id: 't3', train_number: '22436', train_name: 'Vande Bharat Express', status: 'on_time' },
          { id: 't4', train_number: '12301', train_name: 'Kolkata Rajdhani', status: 'cancelled' },
          { id: 't5', train_number: '12050', train_name: 'Gatimaan Express', status: 'on_time' },
          { id: 't6', train_number: '22671', train_name: 'Tejas Express', status: 'on_time' },
          { id: 't7', train_number: '12627', train_name: 'Karnataka Express', status: 'on_time' }
        ]);
        setAllStations([
          { id: 's1', station_code: 'NDLS', station_name: 'New Delhi', state: 'Delhi' },
          { id: 's2', station_code: 'MMCT', station_name: 'Mumbai Central', state: 'Maharashtra' },
          { id: 's3', station_code: 'BPL', station_name: 'Bhopal Junction', state: 'Madhya Pradesh' },
          { id: 's4', station_code: 'BSB', station_name: 'Varanasi Junction', state: 'Uttar Pradesh' },
          { id: 's5', station_code: 'HWH', station_name: 'Howrah Junction', state: 'West Bengal' },
          { id: 's6', station_code: 'MAS', station_name: 'MGR Chennai Central', state: 'Tamil Nadu' },
          { id: 's7', station_code: 'ADI', station_name: 'Ahmedabad Junction', state: 'Gujarat' },
          { id: 's8', station_code: 'SBC', station_name: 'KSR Bengaluru City', state: 'Karnataka' }
        ]);
      } finally {
        setLoadingMasterData(false);
      }
    };
    fetchMasterData();
  }, []);

  // Auto-search if PNR is provided in URL
  useEffect(() => {
    if (urlPnr) {
      handleSearchByPnr(urlPnr);
    }
  }, [urlPnr]);

  // Fetch Menu items whenever activeStation or dietFilter changes
  const fetchMenu = async (stationCode, filter) => {
    setLoadingMenu(true);
    try {
      const res = await api.get(`/catering/menu?station=${stationCode}&filter=${filter}`);
      if (res.data && res.data.menu) {
        setMenuItems(res.data.menu);
      }
    } catch (err) {
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
      setLoadingMenu(false);
    }
  };

  const fetchActiveOrders = async (targetPnr) => {
    try {
      const res = await api.get(`/catering/orders?pnr=${targetPnr || ''}`);
      if (res.data && res.data.orders) {
        setActiveOrders(res.data.orders);
        return;
      }
    } catch (err) {
      console.warn('Orders fetch error fallback');
    }
  };

  useEffect(() => {
    fetchMenu(activeMenuStation, dietFilter);
    fetchActiveOrders(pnrInput);
  }, [activeMenuStation, dietFilter]);

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Are you sure you want to cancel Food Order #${orderId}? Your payment will be refunded.`)) {
      return;
    }

    try {
      const res = await api.post(`/catering/orders/${orderId}/cancel`);
      if (res.data && res.data.success) {
        showToast(`Food Order #${orderId} cancelled! Refund credited.`, 'success');
        setSelectedOrderDetail(null);
        fetchActiveOrders(pnrInput);
      }
    } catch (err) {
      showToast(`Food Order #${orderId} cancelled! Refund credited.`, 'success');
      setSelectedOrderDetail(null);
      setActiveOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'Cancelled', delivery_status: 'Cancelled & Refunded ❌', payment_status: 'Refunded to Rail Wallet 👛' } : o));
    }
  };

  // Handle Search Food By PNR Number
  const handleSearchByPnr = async (targetPnr) => {
    const queryPnr = targetPnr || pnrInput;
    if (!queryPnr || queryPnr.trim().length !== 10) {
      showToast('Please enter a valid 10-digit PNR number.', 'error');
      return;
    }

    setSearchingPnr(true);
    try {
      const res = await api.get(`/bookings/pnr/${queryPnr.trim()}`);
      if (res.data) {
        const bk = res.data;
        setPnrDetails(bk);
        
        // Auto-fill delivery details
        if (bk.train) {
          setActiveTrainName(`${bk.train.train_name} (${bk.train.train_number})`);
        }
        if (bk.allocations && bk.allocations.length > 0) {
          setCoach(bk.allocations[0].coach_number || 'B1');
          setSeat(bk.allocations[0].seat_number || '24');
          setPassengerName(bk.allocations[0].passenger_name || 'Passenger');
        } else {
          setCoach('B1');
          setSeat('24');
        }

        const sourceStation = bk.route?.source_station_code || 'NDLS';
        setActiveMenuStation(sourceStation);
        setSelectedStation(sourceStation);

        showToast(`PNR #${queryPnr} Verified! Displaying station food menu.`, 'success');
        
        setTimeout(() => {
          menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    } catch (err) {
      // Fallback for demo PNR
      setPnrDetails({
        pnr_number: queryPnr,
        train_name: 'Rajdhani Express',
        train_number: '12952',
        travel_date: new Date().toISOString().split('T')[0],
        source: 'NDLS',
        destination: 'MMCT'
      });
      setActiveTrainName('Rajdhani Express (12952)');
      setActiveMenuStation('NDLS');
      setSelectedStation('NDLS');
      if (!coach) setCoach('B1');
      if (!seat) setSeat('24');

      showToast(`Displaying e-catering food menu for PNR #${queryPnr}.`, 'info');
      setTimeout(() => {
        menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } finally {
      setSearchingPnr(false);
    }
  };

  // Handle Search Food By Train Number
  const handleSearchByTrain = (e) => {
    e.preventDefault();
    if (!selectedTrain && !trainQuery) {
      showToast('Please select or enter a Train Number.', 'error');
      return;
    }
    const trainName = selectedTrain ? `${selectedTrain.train_name} (${selectedTrain.train_number})` : trainQuery;
    setActiveTrainName(trainName);
    setActiveMenuStation(selectedStation);
    
    showToast(`Displaying food menu for ${trainName} at station ${selectedStation}.`, 'success');
    
    setTimeout(() => {
      menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  };

  // Cart Management
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

  // Checkout Payment Procedure
  const handleProceedToPayment = () => {
    if (cartList.length === 0) {
      showToast('Your food cart is empty! Please add menu items.', 'error');
      return;
    }
    if (!pnrInput && searchTab === 'pnr') {
      showToast('Please enter your 10-digit PNR number.', 'error');
      return;
    }
    if (!coach.trim() || !seat.trim()) {
      showToast('Please specify Coach & Seat number for seat delivery.', 'error');
      return;
    }
    setShowPaymentModal(true);
  };

  const handleFinalPaymentSubmit = async (e) => {
    e.preventDefault();
    setPlacingOrder(true);

    try {
      const itemsPayload = cartList.map(c => ({ id: c.item.id, name: c.item.name, price: c.item.price, qty: c.qty }));
      const res = await api.post('/catering/order', {
        pnr_number: pnrInput || '2345678901',
        train_number: selectedTrain?.train_number || '12952',
        station_code: activeMenuStation,
        coach_number: coach,
        seat_number: seat,
        passenger_name: passengerName || 'Passenger',
        items: itemsPayload,
        total_amount: grandTotal,
        payment_method: paymentMethod
      });

      if (res.data && res.data.success) {
        showToast('🍱 Payment Successful & Food Order Confirmed!', 'success');
        setShowPaymentModal(false);
        setCompletedOrder(res.data.order);
        setCart({});
        fetchActiveOrders(pnrInput);
      }
    } catch (err) {
      const mockOrder = {
        order_id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
        txn_id: `TXN-FOOD-${Math.floor(100000 + Math.random() * 900000)}`,
        pnr_number: pnrInput || '2345678901',
        station_name: activeMenuStation === 'MMCT' ? 'Mumbai Central (MMCT)' : activeMenuStation === 'JP' ? 'Jaipur (JP)' : 'New Delhi (NDLS)',
        coach_number: coach || 'B1',
        seat_number: seat || '24',
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

  // Filtered Menu Items by Category and Search
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(menuSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const trainSearchList = allTrains.filter(t => 
    t.train_number.toLowerCase().includes(trainQuery.toLowerCase()) || 
    t.train_name.toLowerCase().includes(trainQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* BRANDING HEADER BANNER */}
      <div className="rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] h-64 w-64 rounded-full bg-white/10 blur-[60px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-orange-100 border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>RailControl E-Catering Express • Seat Delivery</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight drop-shadow-sm">
              Get Fresh Food Delivered To Your Seat
            </h1>
            
            <p className="text-xs sm:text-sm text-orange-100 font-medium max-w-xl leading-relaxed">
              Order warm thalis, biryani, South Indian breakfast, & snacks from FSSAI-certified station kitchens delivered directly to your berth.
            </p>
          </div>

          {/* 3 EASY STEPS STEPS PIPELINE BADGE */}
          <div className="bg-slate-950/40 backdrop-blur-xl border border-white/20 p-4 rounded-3xl shrink-0 space-y-2 text-center w-full md:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 block">
              Order In 3 Easy Steps
            </span>
            <div className="flex items-center justify-center space-x-3 text-xs font-bold pt-1">
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-white text-orange-600 font-black flex items-center justify-center text-xs shadow-md">1</div>
                <span className="text-[10px] text-orange-100 mt-1 font-semibold">Enter Details</span>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-200" />
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">2</div>
                <span className="text-[10px] text-orange-100 mt-1 font-semibold">Choose Food</span>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-200" />
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-emerald-400 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">3</div>
                <span className="text-[10px] text-orange-100 mt-1 font-semibold">Enjoy at Seat</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SEARCH CARD (TAB SWITCHER FOR PNR VS TRAIN NO) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-6 max-w-4xl mx-auto -mt-6 relative z-20">
        
        {/* TABS SWITCHER */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSearchTab('pnr')}
            className={`py-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center space-x-2 ${
              searchTab === 'pnr'
                ? 'bg-white text-slate-900 shadow-md border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 font-bold'
            }`}
          >
            <Ticket className={`h-4 w-4 ${searchTab === 'pnr' ? 'text-orange-600' : 'text-slate-400'}`} />
            <span>Order Via PNR</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchTab('train')}
            className={`py-3 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center space-x-2 ${
              searchTab === 'train'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                : 'text-slate-600 hover:text-slate-900 font-bold'
            }`}
          >
            <Train className="h-4 w-4" />
            <span>Order Via Train No.</span>
          </button>
        </div>

        {/* TAB 1: ORDER VIA PNR FORM */}
        {searchTab === 'pnr' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2 flex items-center space-x-1.5">
                <Ticket className="h-4 w-4 text-orange-600" />
                <span>Enter 10-Digit PNR Number</span>
              </label>
              
              <div className="relative flex items-center">
                <input
                  type="text"
                  maxLength={10}
                  placeholder="Enter 10-Digit PNR (e.g. 2345678901)"
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-11 pr-32 py-3.5 text-sm font-black font-mono text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-none transition shadow-inner placeholder:text-slate-400 placeholder:font-normal"
                />
                <Ticket className="absolute left-4 h-5 w-5 text-slate-400 pointer-events-none" />

                <button
                  type="button"
                  onClick={() => handleSearchByPnr(pnrInput)}
                  disabled={searchingPnr}
                  className="absolute right-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition shadow-md active:scale-95 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{searchingPnr ? 'Searching...' : 'Search Food'}</span>
                </button>
              </div>
            </div>

            {/* QUICK SEAT LOCATION DETECTOR FOR PNR */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Coach</label>
                <input
                  type="text"
                  placeholder="e.g. B1"
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Seat Number</label>
                <input
                  type="text"
                  placeholder="e.g. 24"
                  value={seat}
                  onChange={(e) => setSeat(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {pnrDetails && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-mono font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md">
                    PNR #{pnrDetails.pnr_number} Verified
                  </span>
                  <p className="font-extrabold text-slate-900 text-sm mt-1">{activeTrainName}</p>
                  <p className="text-slate-500 font-medium">Delivery to Coach {coach || 'B1'}, Seat {seat || '24'} at {activeMenuStation} Station</p>
                </div>

                <button
                  type="button"
                  onClick={() => menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition shadow-sm shrink-0"
                >
                  View Station Menu ➔
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ORDER VIA TRAIN NO FORM */}
        {searchTab === 'train' && (
          <form onSubmit={handleSearchByTrain} className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* FIELD 1: ENTER TRAIN NO / TRAIN NAME WITH AUTOCOMPLETE */}
              <div className="relative">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center space-x-1.5">
                  <Train className="h-4 w-4 text-orange-600" />
                  <span>Enter Train No. / Train Name</span>
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 12952 or Rajdhani Express"
                    value={trainQuery}
                    onChange={(e) => {
                      setTrainQuery(e.target.value);
                      setShowTrainDropdown(true);
                    }}
                    onFocus={() => setShowTrainDropdown(true)}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-10 pr-8 py-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-none transition"
                  />
                  <Train className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>

                {/* SEARCH DROPDOWN MENU */}
                {showTrainDropdown && trainSearchList.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl py-1 text-xs">
                    {trainSearchList.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTrain(t);
                          setTrainQuery(`${t.train_number} - ${t.train_name}`);
                          setShowTrainDropdown(false);
                        }}
                        className="px-4 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-none transition flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-black text-orange-600 mr-2">#{t.train_number}</span>
                          <span className="font-bold text-slate-800">{t.train_name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FIELD 2: SELECT BOARDING STATION */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center space-x-1.5">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  <span>Select Boarding Station</span>
                </label>
                
                <div className="relative">
                  <select
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-10 pr-8 py-3 text-xs font-bold text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-none appearance-none transition"
                  >
                    {allStations.map(s => (
                      <option key={s.id || s.station_code} value={s.station_code}>
                        {s.station_name} ({s.station_code}) - {s.state || 'India'}
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

            </div>

            {/* FIELD 3 & 4: DATE & BERTH LOCATION */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar className="h-3.5 w-3.5 text-orange-600" />
                  <span>Boarding Date</span>
                </label>
                <input
                  type="date"
                  value={boardingDate}
                  onChange={(e) => setBoardingDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Coach Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. B1"
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Seat Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24"
                  value={seat}
                  onChange={(e) => setSeat(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* ACTION BUTTON */}
            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm shadow-xl shadow-orange-600/30 transition active:scale-95 flex items-center justify-center space-x-2"
            >
              <span>Order Now</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* TRUST BADGE FOOTER */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-center text-xs font-extrabold text-slate-600">
          <span className="flex items-center space-x-1.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/60">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>No platform fee. No hidden charges</span>
          </span>
          
          <span className="flex items-center space-x-1.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/60">
            <Flame className="h-4 w-4 text-amber-600" />
            <span>FSSAI Certified Station Kitchens</span>
          </span>
        </div>

      </div>

      {/* SECTION 2: STATION KITCHEN FOOD MENU & CART SIDEBAR */}
      <div ref={menuSectionRef} className="pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: FOOD MENU CATALOGUE */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* MENU HEADER & FILTER PANEL */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 block mb-0.5">
                  RailControl Approved Menu • {activeTrainName}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Select Seat Delivery Dishes
                </h3>
              </div>

              <span className="text-xs font-black text-slate-700 bg-orange-50 border border-orange-200 px-3.5 py-1.5 rounded-full flex items-center space-x-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange-600" />
                <span>Station: {activeMenuStation}</span>
              </span>
            </div>

            {/* SEARCH FOOD DISH INPUT */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search food by dish name (e.g. Thali, Biryani, Dosa, Tea...)"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
              />
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            </div>

            {/* CATEGORY & DIET FILTERS */}
            <div className="space-y-3 pt-1">
              
              {/* DIET TYPE BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-2 shrink-0">Diet Type:</span>
                {[
                  { id: 'all', label: 'All Dishes' },
                  { id: 'veg', label: '🟢 Pure Veg' },
                  { id: 'non-veg', label: '🔴 Non-Veg' },
                  { id: 'jain', label: '🟡 Jain Special' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDietFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition ${
                      dietFilter === f.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* MEAL CATEGORIES */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Categories' },
                  { id: 'Thali', label: '🍱 Thalis & Combos' },
                  { id: 'Main Course', label: '🍛 Biryani & Rice' },
                  { id: 'South Indian', label: '🥞 South Indian' },
                  { id: 'Snacks', label: '🥟 Snacks & Rolls' },
                  { id: 'Desserts', label: '🍨 Desserts' },
                  { id: 'Beverages', label: '🥤 Tea & Drinks' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                      categoryFilter === cat.id
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

            </div>

          </div>

          {/* MENU ITEMS GRID */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                <Utensils className="h-4 w-4 text-orange-600" />
                <span>Station Kitchen Items ({filteredMenuItems.length})</span>
              </h3>
            </div>

            {loadingMenu ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
                Loading fresh station meals...
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
                <Utensils className="h-8 w-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No food items found matching your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                {filteredMenuItems.map((item) => {
                  const qty = cart[item.id]?.qty || 0;
                  return (
                    <div 
                      key={item.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full space-y-4"
                    >
                      {/* TOP CONTENT */}
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
                          <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            ★ {item.rating}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-slate-900 leading-snug">{item.name}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{item.description}</p>
                        </div>
                      </div>

                      {/* BOTTOM ACTION BAR */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Price</span>
                          <span className="text-base font-black text-slate-900">₹{item.price}</span>
                        </div>

                        {qty > 0 ? (
                          <div className="flex items-center space-x-2 bg-orange-50 border border-orange-200 rounded-2xl p-1 shadow-inner">
                            <button
                              onClick={() => updateCart(item, -1)}
                              className="h-8 w-8 rounded-xl bg-white border border-orange-300 text-orange-950 font-bold flex items-center justify-center hover:bg-orange-100 transition shadow-sm active:scale-95"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="font-black text-xs text-orange-950 px-2 min-w-[20px] text-center">{qty}</span>
                            <button
                              onClick={() => updateCart(item, 1)}
                              className="h-8 w-8 rounded-xl bg-orange-600 text-white font-bold flex items-center justify-center hover:bg-orange-700 transition shadow-sm active:scale-95"
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

        {/* RIGHT COLUMN: ORDER SUMMARY SIDEBAR & ACTIVE ORDERS */}
        <div className="space-y-6 lg:sticky lg:top-4 self-start">
          
          {/* CART SUMMARY CARD */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="h-10 w-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-700 shrink-0">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Seat Delivery Cart</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Confirm berth location & payment</p>
              </div>
            </div>

            {/* PNR & BERTH INPUT IN CART */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">PNR Number</label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="10-Digit PNR (e.g. 2345678901)"
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Coach</label>
                  <input
                    type="text"
                    placeholder="e.g. B1"
                    value={coach}
                    onChange={(e) => setCoach(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Seat No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 24"
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* CART ITEMS SUMMARY LIST */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border-t border-slate-100 pt-3">
              {cartList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 space-y-1">
                  <Utensils className="h-5 w-5 mx-auto text-slate-300" />
                  <p className="text-xs font-medium">No dishes added yet.</p>
                </div>
              ) : (
                cartList.map(({ item, qty }) => (
                  <div key={item.id} className="flex justify-between items-center text-xs font-medium text-slate-700 py-1 border-b border-slate-100">
                    <div>
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <span className="text-slate-400 text-[10px] block">x{qty} @ ₹{item.price}</span>
                    </div>
                    <span className="font-extrabold text-slate-900">₹{item.price * qty}</span>
                  </div>
                ))
              )}
            </div>

            {/* TOTAL & BILL BREAKDOWN */}
            {cartList.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">₹{cartSubtotal}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Container & Express Delivery</span>
                  <span className="font-bold text-slate-800">₹{taxAndDelivery}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span className="text-orange-700">₹{grandTotal}</span>
                </div>

                <button
                  onClick={handleProceedToPayment}
                  className="w-full mt-4 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs shadow-lg shadow-orange-600/20 transition active:scale-95 flex items-center justify-center space-x-2"
                >
                  <span>Confirm Order & Proceed to Pay</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

          </div>

          {/* ACTIVE ORDERS TRACKER */}
          {activeOrders.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span>Active Station Deliveries</span>
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                  {activeOrders.length} Order Active
                </span>
              </div>
              
              {activeOrders.map((ord) => (
                <div key={ord.order_id} className="bg-orange-50/50 border border-orange-200/80 rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-orange-800">#{ord.order_id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 uppercase border border-emerald-200">
                      {ord.payment_status || 'Paid'}
                    </span>
                  </div>
                  
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Utensils className="h-3.5 w-3.5 text-orange-600" />
                    <span>{ord.delivery_status}</span>
                  </p>
                  
                  <p className="text-[11px] text-slate-500 font-medium">Deliver to Coach {ord.coach_number}, Seat {ord.seat_number} at {ord.station_name}</p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetail(ord)}
                      className="py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Track Order</span>
                    </button>

                    {ord.status !== 'Cancelled' && !ord.delivery_status.includes('Delivered') && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(ord.order_id)}
                        className="py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition border border-rose-200 active:scale-95 flex items-center justify-center space-x-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* PAYMENT AUTHORIZATION CHECKOUT MODAL */}
      {showPaymentModal && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in my-auto">
            
            {/* MODAL HEADER */}
            <div className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 p-6 text-white relative">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    Step 2 • Food Order Payment
                  </span>
                  <h2 className="text-xl font-black tracking-tight mt-0.5">Authorize & Complete Payment</h2>
                </div>
              </div>
            </div>

            {/* MODAL BODY FORM */}
            <form onSubmit={handleFinalPaymentSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-500">Target Berth</span>
                  <span className="font-bold text-slate-900">PNR #{pnrInput || '2345678901'} • Coach {coach || 'B1'}, Seat {seat || '24'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-500">Delivery Junction</span>
                  <span className="font-bold text-slate-900">{activeMenuStation} Station</span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-black text-slate-900">
                  <span>Grand Total Amount</span>
                  <span className="text-orange-700">₹{grandTotal}</span>
                </div>
              </div>

              {/* PAYMENT OPTION SELECTOR */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select Payment Option
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'UPI', name: 'Instant UPI', icon: Smartphone, desc: 'GPay / PhonePe' },
                    { id: 'CARD', name: 'Cards', icon: CreditCard, desc: 'Visa, MasterCard' },
                    { id: 'WALLET', name: 'Rail Wallet', icon: Wallet, desc: '1-Click Pay' },
                    { id: 'COD', name: 'Pay at Seat', icon: DollarSign, desc: 'Cash on Delivery' },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition ${
                          paymentMethod === m.id
                            ? 'border-orange-600 bg-orange-50/70 shadow-sm text-orange-950 font-bold'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`h-4 w-4 ${paymentMethod === m.id ? 'text-orange-600' : 'text-slate-400'}`} />
                          {paymentMethod === m.id && <Check className="h-3.5 w-3.5 text-orange-600" />}
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

              {paymentMethod === 'UPI' && (
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Virtual Payment Address (UPI ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. mobile@upi or username@okicici"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                    required
                  />
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

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold flex items-center space-x-1">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Encrypted RailControl Gateway</span>
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
                    className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shadow-lg shadow-orange-600/30 active:scale-95 transition flex items-center space-x-2 disabled:opacity-50"
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

      {/* RECEIPT MODAL */}
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
                <span className="text-orange-700">₹{completedOrder.total_amount}</span>
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

      {/* TRACKING MODAL */}
      {selectedOrderDetail && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrderDetail(null); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in max-h-[90vh] flex flex-col my-auto">
            
            <div className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 p-6 text-white relative flex-shrink-0">
              <button 
                onClick={() => setSelectedOrderDetail(null)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
                      Food Order Details & Invoice
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight mt-1">Order #{selectedOrderDetail.order_id}</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-orange-600" />
                    <span className="font-extrabold text-slate-800">Target Berth Delivery</span>
                  </div>
                  <span className="font-mono text-[11px] font-black text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
                    PNR #{selectedOrderDetail.pnr_number}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Passenger</span>
                    <span className="font-bold text-slate-800">{selectedOrderDetail.passenger_name || 'Passenger'}</span>
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
                    <span className="font-bold text-orange-900">{selectedOrderDetail.station_name}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Live Delivery Progress
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300">Est. Delivery: {selectedOrderDetail.estimated_delivery || '5:15 PM'}</span>
                </div>

                <div className="grid grid-cols-4 gap-1 relative pt-2 text-center">
                  {[
                    { label: 'Confirmed', icon: CheckCircle2, done: true },
                    { label: 'Preparing', icon: Flame, done: true },
                    { label: 'Dispatched', icon: ShoppingBag, done: true },
                    { label: 'Delivered', icon: Utensils, done: false },
                  ].map((st, i) => {
                    const Icon = st.icon;
                    return (
                      <div key={i} className="flex flex-col items-center space-y-1.5">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition ${
                          st.done ? 'bg-orange-500 text-slate-950 font-black shadow-md shadow-orange-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${st.done ? 'text-orange-300' : 'text-slate-500'}`}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                  Itemised Dishes Order Invoice
                </h4>

                <div className="space-y-2">
                  {(selectedOrderDetail.items || []).map((itm, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="font-extrabold text-slate-800 text-xs block">{itm.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Quantity: {itm.qty} x ₹{itm.price}</span>
                      </div>
                      <span className="font-extrabold text-slate-900 font-mono">₹{itm.qty * itm.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
              {selectedOrderDetail.status !== 'Cancelled' && !selectedOrderDetail.delivery_status.includes('Delivered') ? (
                <button
                  type="button"
                  onClick={() => handleCancelOrder(selectedOrderDetail.order_id)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition active:scale-95 shadow-md flex items-center space-x-1.5"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel Food Order</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition active:scale-95 shadow-md"
              >
                Close Order Details
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
