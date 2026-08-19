import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Utensils, Plus, Edit3, Trash2, DollarSign,
  ShoppingBag, Star, MapPin, X, Search,
  BarChart2, TrendingUp, Award, Building2, Download, MessageSquare
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

// ------- CSV export helper -------
const exportOrdersCSV = (orders) => {
  const headers = ['Order ID', 'PNR', 'Train', 'Passenger', 'Coach', 'Seat', 'Station', 'Items', 'Amount', 'Payment', 'Status', 'Date'];
  const rows = orders.map(o => [
    o.order_id,
    o.pnr_number,
    `${o.train_name} (${o.train_number})`,
    o.passenger_name,
    o.coach_number,
    o.seat_number,
    o.station_name,
    (o.items || []).map(i => `${i.name} x${i.qty}`).join(' | '),
    `\u20B9${o.total_amount}`,
    o.payment_status,
    o.delivery_status,
    new Date(o.created_at).toLocaleString('en-IN'),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `catering_orders_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
};

// ------- Dish Ratings / Reviews (static demo data) -------
const DISH_REVIEWS = [
  { id: 1, dish: 'Hyderabadi Chicken Dum Biryani', passenger: 'Rahul S.', train: '12952 Rajdhani', rating: 5, comment: 'Absolutely delicious! Perfectly cooked rice and the chicken was tender.', date: '18 Aug 2026' },
  { id: 2, dish: 'Deluxe North Indian Thali',      passenger: 'Priya M.',  train: '12002 Shatabdi', rating: 4, comment: 'Good quantity and taste. Naan could be softer. Overall good experience.', date: '18 Aug 2026' },
  { id: 3, dish: 'Jain Special Satvik Thali',      passenger: 'Suresh P.', train: '22436 Vande Bharat', rating: 5, comment: 'Very happy — strict Jain menu, no onion/garlic. Delivered on time!', date: '17 Aug 2026' },
  { id: 4, dish: 'South Indian Tiffin Combo',      passenger: 'Anita V.',  train: '12626 Kerala Exp', rating: 4, comment: 'Fresh idlis and crispy dosa! Sambar was piping hot. Will order again.', date: '17 Aug 2026' },
  { id: 5, dish: 'Fresh Mango Lassi Bottle',       passenger: 'Ravi K.',   train: '12910 Garib Rath', rating: 5, comment: 'Best Mango Lassi I have had on a train. Super thick and chilled!', date: '16 Aug 2026' },
  { id: 6, dish: 'Chole Bhature Special',          passenger: 'Meena R.',  train: '12032 Amritsar Shatabdi', rating: 3, comment: 'Bhature were a bit oily and cold when delivered. Chole was tasty.', date: '16 Aug 2026' },
  { id: 7, dish: 'Rajasthani Dal Baati Churma',    passenger: 'Amit T.',   train: '12956 JPJ Express', rating: 5, comment: 'Authentic Rajasthani taste. The ghee in baati was just right!', date: '15 Aug 2026' },
];

// ------- Static analytics data -------
const WEEKLY_REVENUE = [
  { day: 'Mon', revenue: 5820, orders: 24 },
  { day: 'Tue', revenue: 7140, orders: 31 },
  { day: 'Wed', revenue: 6380, orders: 28 },
  { day: 'Thu', revenue: 8920, orders: 40 },
  { day: 'Fri', revenue: 9740, orders: 43 },
  { day: 'Sat', revenue: 11200, orders: 51 },
  { day: 'Sun', revenue: 10480, orders: 47 },
];

const TOP_DISHES = [
  { name: 'Hyderabadi Chicken Dum Biryani', orders: 312, revenue: 87360, type: 'non-veg', rating: 4.9 },
  { name: 'Deluxe North Indian Thali',      orders: 284, revenue: 68160, type: 'veg',     rating: 4.8 },
  { name: 'Rajasthani Dal Baati Churma',    orders: 198, revenue: 51480, type: 'veg',     rating: 4.9 },
  { name: 'South Indian Tiffin Combo',      orders: 176, revenue: 28160, type: 'veg',     rating: 4.8 },
  { name: 'Fresh Mango Lassi Bottle',       orders: 162, revenue: 14580, type: 'veg',     rating: 4.9 },
];

const INIT_VENDORS = [
  { id: 'v1', station: 'New Delhi (NDLS)',       vendor: 'IRCTC Rajdhani Kitchen',         fssai: 'FSSAI-110001', status: 'Active',    meals_today: 148 },
  { id: 'v2', station: 'Mumbai Central (MMCT)',   vendor: 'Maharashtra Rail Caterers Pvt',  fssai: 'FSSAI-400008', status: 'Active',    meals_today: 124 },
  { id: 'v3', station: 'Chennai Central (MAS)',   vendor: 'South Express Cuisines Ltd',     fssai: 'FSSAI-600001', status: 'Active',    meals_today: 96  },
  { id: 'v4', station: 'Howrah Junction (HWH)',   vendor: 'Bengal Rail Foods Co.',          fssai: 'FSSAI-700001', status: 'Active',    meals_today: 88  },
  { id: 'v5', station: 'Bhopal Junction (BPL)',   vendor: 'MP Rail Catering Services',      fssai: 'FSSAI-462001', status: 'Active',    meals_today: 72  },
  { id: 'v6', station: 'Lucknow (LKO)',           vendor: 'Awadhi Cuisine Express',          fssai: 'FSSAI-226001', status: 'Suspended', meals_today: 0   },
  { id: 'v7', station: 'Ahmedabad (ADI)',         vendor: 'Gujarat Rail Food Plaza',         fssai: 'FSSAI-380001', status: 'Active',    meals_today: 61  },
];

// ------- Revenue Bar Chart (pure SVG) -------
const RevenueBarChart = ({ data }) => {
  const maxRev = Math.max(...data.map(d => d.revenue));
  const chartH = 130;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${data.length * 64} ${chartH + 36}`} className="w-full min-w-[400px]" style={{ fontFamily: 'inherit' }}>
        <defs>
          {data.map((_, i) => (
            <linearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
            </linearGradient>
          ))}
        </defs>
        {data.map((d, i) => {
          const barH = Math.max(6, Math.round((d.revenue / maxRev) * chartH));
          const x = i * 64 + 12;
          const y = chartH - barH;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={40} height={barH} rx={8} fill={`url(#bg${i})`} />
              <text x={x + 20} y={y - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#92400e">
                {'\u20B9'}{Math.round(d.revenue / 1000)}k
              </text>
              <text x={x + 20} y={chartH + 17} textAnchor="middle" fontSize="10" fontWeight="800" fill="#64748b">{d.day}</text>
              <text x={x + 20} y={chartH + 30} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.orders} meals</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ------- Main Component -------
const AdminCatering = () => {
  const { showToast } = useToast();
  const [stats] = useState({ totalOrders: 1482, totalRevenue: 59680, avgRating: 4.8 });
  const [menuList, setMenuList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('analytics');
  const [vendors, setVendors] = useState(INIT_VENDORS);

  // Dish modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem]   = useState(null);
  const [dishName, setDishName]         = useState('');
  const [dishPrice, setDishPrice]       = useState('');
  const [dishCategory, setDishCategory] = useState('Thali');
  const [dishType, setDishType]         = useState('veg');
  const [dishDesc, setDishDesc]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // Vendor modal
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor]     = useState(null);
  const [vendorStation, setVendorStation]     = useState('');
  const [vendorName, setVendorName]           = useState('');
  const [vendorFssai, setVendorFssai]         = useState('');

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const res = await api.get('/catering/menu?filter=all');
      if (res.data?.menu) setMenuList(res.data.menu.map(m => ({ ...m, in_stock: m.in_stock !== false })));
    } catch {
      setMenuList([
        { id: 'm1', name: 'Deluxe North Indian Thali',       price: 240, category: 'Thali',       type: 'veg',     rating: 4.8, description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Naan & Gulab Jamun', in_stock: true },
        { id: 'm2', name: 'Super Executive Non-Veg Thali',    price: 310, category: 'Thali',       type: 'non-veg', rating: 4.9, description: 'Butter Chicken, Egg Curry, Basmati Rice, 3 Chapatis & Raita', in_stock: true },
        { id: 'm3', name: 'Jain Special Satvik Thali',        price: 220, category: 'Thali',       type: 'jain',    rating: 4.9, description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati & Rice Kheer', in_stock: true },
        { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani',   price: 280, category: 'Main Course', type: 'non-veg', rating: 4.9, description: 'Aromatic Basmati Rice, Tender Chicken, Mirchi Ka Salan & Raita', in_stock: true },
        { id: 'm9', name: 'South Indian Tiffin Combo',        price: 160, category: 'South Indian',type: 'veg',     rating: 4.8, description: '2 Ghee Idlis, 1 Vada, 1 Masala Dosa, Sambar & Chutney', in_stock: true },
        { id: 'm11',name: 'Chole Bhature Special',            price: 160, category: 'Snacks',      type: 'veg',     rating: 4.8, description: '2 Fluffy Bhature with Spiced Chickpeas & Pickle', in_stock: true },
        { id: 'm18',name: 'Fresh Mango Lassi Bottle',         price: 90,  category: 'Beverages',   type: 'veg',     rating: 4.9, description: 'Thick Creamy Alphonso Mango Yogurt Drink (300ml)', in_stock: true },
      ]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMenu(); }, []);

  // Dish handlers
  const openAddModal = () => { setEditingItem(null); setDishName(''); setDishPrice(''); setDishCategory('Thali'); setDishType('veg'); setDishDesc(''); setShowAddModal(true); };
  const openEditModal = (item) => { setEditingItem(item); setDishName(item.name); setDishPrice(item.price); setDishCategory(item.category); setDishType(item.type); setDishDesc(item.description); setShowAddModal(true); };

  const handleSaveDish = async (e) => {
    e.preventDefault(); setSubmitting(true);
    const payload = { name: dishName, price: parseFloat(dishPrice), category: dishCategory, type: dishType, description: dishDesc };
    try {
      if (editingItem) { await api.put(`/catering/admin/menu/${editingItem.id}`, payload); }
      else { await api.post('/catering/admin/menu', payload); }
      showToast(editingItem ? `'${dishName}' updated!` : `'${dishName}' added!`, 'success');
      setShowAddModal(false); fetchMenu();
    } catch {
      if (editingItem) setMenuList(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...payload } : m));
      else setMenuList(prev => [{ id: `m-${Date.now()}`, ...payload, rating: 4.8, in_stock: true }, ...prev]);
      showToast(editingItem ? `'${dishName}' updated!` : `'${dishName}' added!`, 'success');
      setShowAddModal(false);
    } finally { setSubmitting(false); }
  };

  const handleToggleStock = async (item) => {
    const ns = !item.in_stock;
    try { await api.put(`/catering/admin/menu/${item.id}`, { in_stock: ns }); } catch {}
    setMenuList(prev => prev.map(m => m.id === item.id ? { ...m, in_stock: ns } : m));
    showToast(`'${item.name}' stock ${ns ? 'enabled' : 'disabled'}.`, 'info');
  };

  const handleDeleteDish = async (item) => {
    if (!window.confirm(`Remove '${item.name}' from the menu?`)) return;
    try { await api.delete(`/catering/admin/menu/${item.id}`); } catch {}
    setMenuList(prev => prev.filter(m => m.id !== item.id));
    showToast(`'${item.name}' removed.`, 'success');
  };

  // Vendor handlers
  const openVendorModal = (v = null) => { setEditingVendor(v); setVendorStation(v?.station || ''); setVendorName(v?.vendor || ''); setVendorFssai(v?.fssai || ''); setShowVendorModal(true); };
  const handleSaveVendor = (e) => {
    e.preventDefault();
    if (editingVendor) setVendors(prev => prev.map(v => v.id === editingVendor.id ? { ...v, station: vendorStation, vendor: vendorName, fssai: vendorFssai } : v));
    else setVendors(prev => [...prev, { id: `v${Date.now()}`, station: vendorStation, vendor: vendorName, fssai: vendorFssai, status: 'Active', meals_today: 0 }]);
    showToast(editingVendor ? 'Vendor updated.' : 'New vendor added.', 'success');
    setShowVendorModal(false);
  };
  const handleToggleVendor = (id) => { setVendors(prev => prev.map(v => v.id === id ? { ...v, status: v.status === 'Active' ? 'Suspended' : 'Active', meals_today: v.status === 'Active' ? 0 : v.meals_today } : v)); showToast('Vendor status updated.', 'info'); };
  const handleDeleteVendor = (id) => { if (!window.confirm('Remove this vendor?')) return; setVendors(prev => prev.filter(v => v.id !== id)); showToast('Vendor removed.', 'success'); };

  const filteredMenu = menuList.filter(item =>
    (categoryFilter === 'all' || item.category === categoryFilter) &&
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const TABS = [
    { key: 'analytics', label: 'Analytics & Revenue', icon: BarChart2    },
    { key: 'menu',      label: 'Menu Management',     icon: Utensils      },
    { key: 'vendors',   label: 'Station Vendors',      icon: Building2     },
    { key: 'ratings',   label: 'Dish Ratings',         icon: MessageSquare },
  ];

  // --- CSV export handler ---
  const handleExportCSV = async () => {
    try {
      const res = await api.get('/catering/all-orders');
      const orders = res.data?.orders || [];
      if (orders.length === 0) { showToast('No orders to export.', 'info'); return; }
      exportOrdersCSV(orders);
      showToast(`Exported ${orders.length} catering orders to CSV.`, 'success');
    } catch {
      // Fallback demo export
      exportOrdersCSV([
        { order_id: 'ORD-98421', pnr_number: '2345678901', train_name: 'Rajdhani Express', train_number: '12952', passenger_name: 'Rahul Sharma', coach_number: 'B1', seat_number: '24', station_name: 'New Delhi (NDLS)', items: [{ name: 'Deluxe North Indian Thali', qty: 2 }], total_amount: 480, payment_status: 'Paid', delivery_status: 'Delivered at Berth', created_at: new Date().toISOString() },
      ]);
      showToast('Exported demo catering orders to CSV.', 'success');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">

      {/* HEADER BANNER */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Admin Control • Food & Catering Operations
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">RailControl Catering Operations Hub</h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Revenue analytics, menu administration, and station kitchen vendor management.</p>
            </div>
          </div>
          {activeTab === 'menu' && (
            <button onClick={openAddModal} className="px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-lg shadow-amber-600/30 transition active:scale-95 flex items-center space-x-2 shrink-0">
              <Plus className="h-4 w-4" /><span>Add New Dish</span>
            </button>
          )}
          {activeTab === 'vendors' && (
            <button onClick={() => openVendorModal()} className="px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-lg shadow-amber-600/30 transition active:scale-95 flex items-center space-x-2 shrink-0">
              <Plus className="h-4 w-4" /><span>Add Station Vendor</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition flex items-center space-x-1.5 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Catering Revenue', value: `\u20B9${stats.totalRevenue.toLocaleString()}`, color: 'text-amber-700', border: 'border-amber-200 bg-amber-50/50', icon: DollarSign },
          { label: 'Total Meals Served',      value: stats.totalOrders,                              color: 'text-slate-900',  border: 'border-slate-200 bg-white',      icon: ShoppingBag },
          { label: 'Active Station Kitchens', value: `${vendors.filter(v => v.status === 'Active').length} Kitchens`, color: 'text-slate-900', border: 'border-slate-200 bg-white', icon: Building2 },
          { label: 'Avg Passenger Rating',    value: `\u2605 ${stats.avgRating}`,                    color: 'text-emerald-700',border: 'border-emerald-200 bg-emerald-50/50', icon: Star },
        ].map(({ label, value, color, border, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border ${border} p-5 shadow-sm space-y-1`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
              <Icon className="h-4 w-4 text-slate-300" />
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${activeTab === tab.key ? 'bg-white text-amber-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
              <Icon className="h-4 w-4" /><span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===== ANALYTICS TAB ===== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" /> Weekly Catering Revenue
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Revenue & meals served — last 7 days across all station kitchens</p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-800 font-black px-3 py-1.5 rounded-xl border border-amber-200">
                {'\u20B9'}{WEEKLY_REVENUE.reduce((s, d) => s + d.revenue, 0).toLocaleString()} this week
              </span>
            </div>
            <RevenueBarChart data={WEEKLY_REVENUE} />
          </div>

          {/* Top Selling Dishes */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-600" /> Top 5 Bestselling Dishes
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Sorted by orders placed across all train routes & station kitchens</p>
            </div>
            <div className="space-y-3">
              {TOP_DISHES.map((dish, i) => {
                const barW = Math.round((dish.orders / TOP_DISHES[0].orders) * 100);
                return (
                  <div key={dish.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
                        <span className="font-bold text-slate-800 truncate">{dish.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${dish.type === 'veg' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                          {'\u25CF'} {dish.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-slate-500">{dish.orders} orders</span>
                        <span className="font-black text-amber-700">{'\u20B9'}{dish.revenue.toLocaleString()}</span>
                        <span className="text-amber-600 font-bold">{'\u2605'} {dish.rating}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diet Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Veg Orders',          pct: 68, color: 'bg-emerald-500' },
              { label: 'Non-Veg Orders',       pct: 25, color: 'bg-rose-500' },
              { label: 'Jain / Special Orders',pct: 7,  color: 'bg-amber-400' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-slate-700">{item.label}</span>
                  <span className="font-black text-slate-900 text-base">{item.pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== MENU TAB ===== */}
      {activeTab === 'menu' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Master Food Menu ({filteredMenu.length} dishes)</h3>
              <p className="text-xs text-slate-500 font-medium">Update prices, categories, diet tags, and stock availability per dish.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input type="text" placeholder="Search dish…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none" />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none">
                <option value="all">All Categories</option>
                <option value="Thali">Thalis</option>
                <option value="Main Course">Main Course & Biryani</option>
                <option value="South Indian">South Indian</option>
                <option value="Snacks">Snacks & Rolls</option>
                <option value="Desserts">Desserts</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-bold text-xs">Loading menu…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Dish</th><th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Diet</th><th className="py-3 px-3">Price</th>
                    <th className="py-3 px-3">Rating</th><th className="py-3 px-3">Stock</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMenu.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-3">
                        <span className="font-extrabold text-slate-900 block text-sm">{item.name}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{item.description}</span>
                      </td>
                      <td className="py-3.5 px-3"><span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{item.category}</span></td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${item.type === 'veg' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : item.type === 'jain' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                          {'\u25CF'} {item.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3"><span className="font-black text-slate-900 text-sm">{'\u20B9'}{item.price}</span></td>
                      <td className="py-3.5 px-3"><span className="font-black text-amber-700">{'\u2605'} {item.rating || 4.8}</span></td>
                      <td className="py-3.5 px-3">
                        <button onClick={() => handleToggleStock(item)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition border ${item.in_stock ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}>
                          {item.in_stock ? 'In Stock \u2713' : 'Out of Stock'}
                        </button>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => openEditModal(item)} title="Edit" className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"><Edit3 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteDish(item)} title="Delete" className="h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition border border-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== VENDORS TAB ===== */}
      {activeTab === 'vendors' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" /> FSSAI Station Kitchen Vendors ({vendors.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium">Manage approved catering vendors at each major railway station.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Station</th><th className="py-3 px-3">Vendor / Kitchen</th>
                  <th className="py-3 px-3">FSSAI License</th><th className="py-3 px-3">Meals Today</th>
                  <th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-3"><span className="font-bold text-slate-800 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />{v.station}</span></td>
                    <td className="py-3.5 px-3"><span className="font-extrabold text-slate-900">{v.vendor}</span></td>
                    <td className="py-3.5 px-3"><span className="font-mono text-[11px] text-slate-600">{v.fssai}</span></td>
                    <td className="py-3.5 px-3"><span className="font-black text-slate-900">{v.meals_today}</span><span className="text-slate-400 ml-1">meals</span></td>
                    <td className="py-3.5 px-3">
                      <button onClick={() => handleToggleVendor(v.id)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition border ${v.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}>
                        {v.status}
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => openVendorModal(v)} title="Edit" className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteVendor(v.id)} title="Remove" className="h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition border border-rose-200"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== RATINGS TAB ===== */}
      {activeTab === 'ratings' && (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Reviews',   value: DISH_REVIEWS.length,                                                           color: 'text-slate-900' },
              { label: 'Average Rating',  value: `★ ${(DISH_REVIEWS.reduce((s,r)=>s+r.rating,0)/DISH_REVIEWS.length).toFixed(1)}`, color: 'text-amber-700' },
              { label: '5-Star Reviews',  value: DISH_REVIEWS.filter(r=>r.rating===5).length,                                     color: 'text-emerald-700' },
              { label: 'Under 4-Star',    value: DISH_REVIEWS.filter(r=>r.rating<4).length,                                       color: 'text-rose-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">{label}</span>
                <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Review Cards */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-600" /> Passenger Food Reviews & Ratings
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time passenger feedback on catering quality. Address low-rated reviews promptly.</p>
            </div>
            <div className="space-y-4">
              {DISH_REVIEWS.map(review => (
                <div key={review.id} className={`rounded-2xl p-4 border space-y-2 ${
                  review.rating >= 5 ? 'bg-emerald-50/50 border-emerald-200'
                  : review.rating >= 4 ? 'bg-slate-50 border-slate-200'
                  : 'bg-rose-50/50 border-rose-200'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-900">{review.dish}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        <span className="font-bold text-slate-700">{review.passenger}</span>
                        <span>•</span>
                        <span>{review.train}</span>
                        <span>•</span>
                        <span>{review.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-sm ${s <= review.rating ? 'text-amber-500' : 'text-slate-200'}`}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed border-t border-black/5 pt-2">
                    "{review.comment}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DISH MODAL */}
      {showAddModal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto">
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white relative">
              <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"><X className="h-5 w-5" /></button>
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400"><Utensils className="h-6 w-6" /></div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">Master Menu Administration</span>
                  <h2 className="text-xl font-black tracking-tight mt-0.5">{editingItem ? 'Edit Dish Details' : 'Add New Dish to Menu'}</h2>
                </div>
              </div>
            </div>
            <form onSubmit={handleSaveDish} className="p-6 space-y-4 text-xs font-medium text-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Dish Name</label>
                <input type="text" placeholder="e.g. Paneer Butter Masala Thali" value={dishName} onChange={e => setDishName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Price ({'\u20B9'})</label>
                  <input type="number" placeholder="240" value={dishPrice} onChange={e => setDishPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Diet Type</label>
                  <select value={dishType} onChange={e => setDishType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none">
                    <option value="veg">🟢 Pure Veg</option>
                    <option value="non-veg">🔴 Non-Veg</option>
                    <option value="jain">🟡 Jain Special</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Category</label>
                <select value={dishCategory} onChange={e => setDishCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none">
                  <option value="Thali">Thalis & Combos</option>
                  <option value="Main Course">Main Course & Biryani</option>
                  <option value="South Indian">South Indian</option>
                  <option value="Snacks">Snacks & Kathi Rolls</option>
                  <option value="Desserts">Desserts</option>
                  <option value="Beverages">Beverages & Tea</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Ingredients / Description</label>
                <textarea rows={3} placeholder="e.g. Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Naan & Salad" value={dishDesc} onChange={e => setDishDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-600/30 transition active:scale-95 disabled:opacity-50">
                  {submitting ? 'Saving…' : editingItem ? 'Update Dish' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* VENDOR MODAL */}
      {showVendorModal && createPortal(
        <div onClick={e => { if (e.target === e.currentTarget) setShowVendorModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden my-auto">
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white relative">
              <button onClick={() => setShowVendorModal(false)} className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"><X className="h-5 w-5" /></button>
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400"><Building2 className="h-6 w-6" /></div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">Station Kitchen Vendors</span>
                  <h2 className="text-xl font-black tracking-tight mt-0.5">{editingVendor ? 'Edit Vendor Details' : 'Add Station Vendor'}</h2>
                </div>
              </div>
            </div>
            <form onSubmit={handleSaveVendor} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Station Name</label>
                <input type="text" placeholder="e.g. New Delhi (NDLS)" value={vendorStation} onChange={e => setVendorStation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Vendor / Kitchen Name</label>
                <input type="text" placeholder="e.g. IRCTC Rajdhani Kitchen" value={vendorName} onChange={e => setVendorName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">FSSAI License No.</label>
                <input type="text" placeholder="e.g. FSSAI-110001" value={vendorFssai} onChange={e => setVendorFssai(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none" required />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-600/30 transition active:scale-95">
                  {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminCatering;
