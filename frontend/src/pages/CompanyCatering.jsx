import React, { useState, useEffect } from 'react';
import { 
  ChefHat, Utensils, ShoppingBag, Clock, CheckCircle2, AlertCircle, Plus, 
  Trash2, Edit3, Power, RefreshCw, Search, Filter, DollarSign, PackageCheck,
  Building2, ShieldCheck, MapPin, Truck, Check, X, Flame, Coffee, Tag, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const CompanyCatering = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

  // Active Company Selection (For demo testing & Vendor isolation)
  const [activeVendorId, setActiveVendorId] = useState('comp-1');
  const [companyProfile, setCompanyProfile] = useState(null);

  // Tabs: 'menu' | 'orders' | 'analytics'
  const [activeTab, setActiveTab] = useState('menu');

  // Menu State
  const [menuList, setMenuList] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Add / Edit Dish Modal State
  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishCategory, setDishCategory] = useState('Thali');
  const [dishType, setDishType] = useState('veg');
  const [dishDesc, setDishDesc] = useState('');
  const [dishPrepTime, setDishPrepTime] = useState('20');
  const [dishInStock, setDishInStock] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Preset Vendors list for easy switcher
  const DEMO_VENDORS = [
    { id: 'comp-1', name: 'IRCTC Executive Pantry', fssai: '10019011000234', station: 'NDLS, DLI, NZM, CNB, AGC' },
    { id: 'comp-2', name: 'MP Rail Catering Services', fssai: '11521004000891', station: 'BPL, GWL, VGLJ, ET, RTM' },
    { id: 'comp-3', name: 'Varanasi Satvik Kitchen', fssai: '12720002000512', station: 'BSB, PRYJ, DDU, LKO' },
    { id: 'comp-4', name: 'Coastal Rail Foods', fssai: '11222005000109', station: 'MAQ, UD, MAO, ERS, SBC' },
    { id: 'comp-5', name: 'Western Gourmet Express', fssai: '10821009000341', station: 'MMCT, BDTS, ST, BRC, ADI' }
  ];

  const [vendorList, setVendorList] = useState(DEMO_VENDORS);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/catering/companies');
        const apiComps = res.data?.companies;
        if (Array.isArray(apiComps) && apiComps.length > 0) {
          const mapped = apiComps.map(c => ({
            id: c.id,
            name: c.company_name || c.legal_name || c.name,
            fssai: c.fssai_number || c.fssai || 'N/A',
            station: Array.isArray(c.stations) ? c.stations.join(', ') : (c.station || c.address || 'NDLS')
          }));

          // Merge API vendors while avoiding duplicates
          const seenIds = new Set(mapped.map(m => m.id));
          const fallbackDemos = DEMO_VENDORS.filter(d => !seenIds.has(d.id));
          setVendorList([...mapped, ...fallbackDemos]);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic catering companies list:', err);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch Vendor Profile & Data
  const fetchVendorData = async () => {
    setLoadingMenu(true);
    setLoadingOrders(true);
    try {
      const [profileRes, menuRes, ordersRes] = await Promise.all([
        api.get(`/catering/company/profile?vendor_id=${activeVendorId}`),
        api.get(`/catering/company/menu?vendor_id=${activeVendorId}`),
        api.get(`/catering/company/orders?vendor_id=${activeVendorId}`)
      ]);

      if (profileRes.data && profileRes.data.company) {
        setCompanyProfile(profileRes.data.company);
      }
      if (menuRes.data && menuRes.data.menu) {
        setMenuList(menuRes.data.menu);
      }
      if (ordersRes.data && ordersRes.data.orders) {
        setOrders(ordersRes.data.orders);
      }
    } catch (err) {
      console.warn('Fallback company vendor data');
    } finally {
      setLoadingMenu(false);
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchVendorData();
  }, [activeVendorId]);

  // Open modal for Adding Dish
  const handleOpenAddDish = () => {
    setEditingDish(null);
    setDishName('');
    setDishPrice('');
    setDishCategory('Thali');
    setDishType('veg');
    setDishDesc('');
    setDishPrepTime('20');
    setDishInStock(true);
    setShowDishModal(true);
  };

  // Open modal for Editing Dish
  const handleOpenEditDish = (dish) => {
    setEditingDish(dish);
    setDishName(dish.name);
    setDishPrice(dish.price);
    setDishCategory(dish.category || 'Thali');
    setDishType(dish.type || 'veg');
    setDishDesc(dish.description || '');
    setDishPrepTime(dish.prep_time_mins || 20);
    setDishInStock(Boolean(dish.in_stock));
    setShowDishModal(true);
  };

  // Save Dish Submit
  const handleSubmitDish = async (e) => {
    e.preventDefault();
    if (!dishName || !dishPrice || !dishCategory) {
      showToast('Dish Name, Price, and Category are required.', 'error');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: dishName,
      price: parseFloat(dishPrice),
      category: dishCategory,
      type: dishType,
      description: dishDesc,
      prep_time_mins: parseInt(dishPrepTime, 10) || 20,
      in_stock: dishInStock
    };

    try {
      if (editingDish) {
        await api.put(`/catering/company/menu/${editingDish.id}?vendor_id=${activeVendorId}`, payload);
        showToast(`Dish "${dishName}" updated successfully.`, 'success');
      } else {
        await api.post(`/catering/company/menu?vendor_id=${activeVendorId}`, payload);
        showToast(`New dish "${dishName}" added to your menu!`, 'success');
      }
      setShowDishModal(false);
      fetchVendorData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save dish.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Dish
  const handleDeleteDish = async (dish) => {
    if (!window.confirm(`Are you sure you want to delete "${dish.name}" from your menu?`)) return;

    try {
      await api.delete(`/catering/company/menu/${dish.id}?vendor_id=${activeVendorId}`);
      showToast(`Dish "${dish.name}" removed from your menu.`, 'success');
      fetchVendorData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete dish.', 'error');
    }
  };

  // Toggle Stock Status
  const handleToggleStock = async (dish) => {
    try {
      const newStock = !dish.in_stock;
      await api.put(`/catering/company/menu/${dish.id}?vendor_id=${activeVendorId}`, { in_stock: newStock });
      showToast(`Updated stock status for ${dish.name}`, 'info');
      fetchVendorData();
    } catch (err) {
      showToast('Failed to update stock status.', 'error');
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (order, newStatus, deliveryText) => {
    try {
      await api.put(`/catering/company/orders/${order.order_id || order.id}/status?vendor_id=${activeVendorId}`, {
        status: newStatus,
        delivery_status: deliveryText
      });
      showToast(`Order #${order.order_id} updated to ${newStatus}.`, 'success');
      fetchVendorData();
    } catch (err) {
      showToast('Failed to update order status.', 'error');
    }
  };

  // Filtered Menu Items
  const filteredMenu = menuList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Filtered Orders List
  const filteredOrders = orders.filter(order => {
    if (orderStatusFilter === 'all') return true;
    return order.status === orderStatusFilter;
  });

  // Metrics
  const activeCompanyObj = vendorList.find(v => v.id === activeVendorId) || vendorList[0] || DEMO_VENDORS[0];
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Header Banner */}
      <div className="mb-8 bg-gradient-to-r from-amber-900/40 via-slate-800 to-slate-800 border border-amber-500/30 p-6 rounded-2xl backdrop-blur-md shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
            <ChefHat className="h-4 w-4" /> Authorized Catering Company Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{activeCompanyObj.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-300">
            <span className="bg-amber-500/20 text-amber-300 font-mono px-2.5 py-0.5 rounded border border-amber-500/30 font-bold">
              FSSAI: {activeCompanyObj.fssai}
            </span>
            <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> AUTHORIZED VENDOR
            </span>
            <span className="text-slate-400">
              📍 Stations: <strong className="text-slate-200">{activeCompanyObj.station}</strong>
            </span>
          </div>
        </div>

        {/* Vendor Switcher Dropdown */}
        <div className="bg-slate-900/90 border border-slate-700 p-3 rounded-xl min-w-[240px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
            Switch Catering Vendor:
          </label>
          <select
            value={activeVendorId}
            onChange={(e) => setActiveVendorId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {vendorList.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.fssai})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="flex items-center justify-between border-b border-slate-800 mb-8 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 ${
              activeTab === 'menu' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Utensils className="h-4 w-4" /> Company Menu Management ({menuList.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 ${
              activeTab === 'orders' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShoppingBag className="h-4 w-4" /> Live Food Orders ({orders.length})
          </button>
        </div>

        {activeTab === 'menu' && (
          <button
            onClick={handleOpenAddDish}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition transform active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>+ Add Food Option</span>
          </button>
        )}
      </div>

      {isStaffOrAdmin && (
        <div className="bg-blue-950/50 border border-blue-800/60 p-4 rounded-xl mb-6 text-xs text-blue-200 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" />
          <div>
            <span className="font-bold text-blue-300 block uppercase tracking-wider">Railway Operational Mode ({user?.role?.toUpperCase()})</span>
            Staff and Admin monitor station delivery statuses, verify train manifests, and handle service issues. External food delivery partners own and manage food menu items and prices.
          </div>
        </div>
      )}

      {/* ==================== TAB 1: MENU MANAGEMENT ==================== */}
      {activeTab === 'menu' && (
        <div>
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu items by dish name or description..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Categories</option>
                <option value="Thali">Thalis & Meals</option>
                <option value="Main Course">Main Course & Biryanis</option>
                <option value="South Indian">South Indian Tiffins</option>
                <option value="Snacks">Snacks & Rolls</option>
                <option value="Desserts">Desserts & Beverages</option>
              </select>

              <button
                onClick={handleOpenAddDish}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Food Item</span>
              </button>
            </div>
          </div>

          {/* Menu Items Grid */}
          {loadingMenu ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Loading menu dishes for {activeCompanyObj.name}...</p>
            </div>
          ) : filteredMenu.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <Utensils className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300">No Menu Dishes Found</h3>
              <p className="text-slate-500 text-sm mt-1">Click "Add New Dish" above to create dishes for your company.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenu.map(dish => (
                <div key={dish.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-600 transition shadow-md">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        dish.type === 'veg' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        dish.type === 'non-veg' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {dish.type}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{dish.category}</span>
                    </div>

                    <h3 className="font-black text-white text-lg">{dish.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{dish.description}</p>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/60">
                      <div>
                        <span className="font-mono font-black text-amber-400 text-lg">₹{dish.price}</span>
                        <span className="text-[11px] text-slate-400 block">Prep: {dish.prep_time_mins || 20} mins</span>
                      </div>

                      <button
                        onClick={() => handleToggleStock(dish)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                          dish.in_stock 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                      >
                        {dish.in_stock ? '✓ In Stock' : '✕ Out of Stock'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/60">
                    <button
                      onClick={() => handleOpenEditDish(dish)}
                      className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDish(dish)}
                      className="py-1.5 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: LIVE ORDERS QUEUE ==================== */}
      {activeTab === 'orders' && (
        <div>
          {/* Order Status Filters */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Company Orders Queue</h2>
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2"
            >
              <option value="all">All Order Statuses</option>
              <option value="PLACED">PLACED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="PREPARING">PREPARING</option>
              <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {loadingOrders ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Loading orders for {activeCompanyObj.name}...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <ShoppingBag className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300">No Food Orders Assigned</h3>
              <p className="text-slate-500 text-sm mt-1">Orders placed by passengers at your authorized stations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <div key={order.order_id || order.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="font-mono font-black text-amber-400 text-base">#{order.order_id}</span>
                      <span className="text-xs text-slate-400">PNR #{order.pnr_number}</span>
                      <span className="px-2.5 py-0.5 bg-slate-900 text-slate-200 border border-slate-700 text-xs font-bold rounded-md">
                        Train #{order.train_number}
                      </span>
                      <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-md">
                        📍 Station: {order.delivery_station_code || order.station_code}
                      </span>
                      {(order.food_entitlement === 'COMPLIMENTARY' || order.payment_status === 'COMPLIMENTARY' || order.ticket_class === '1A') && (
                        <>
                          <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-md flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5" /> RailControl Food Entitlement: 1A
                          </span>
                          <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-md">
                            Payment Type: COMPLIMENTARY
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 font-semibold mb-2">
                      Passenger: {order.passenger_name} • Seat: Coach {order.coach_number || 'H1'} / Seat {order.seat_number || '4'} • Class: {order.ticket_class || '1A'}
                    </div>

                    {(order.food_entitlement === 'COMPLIMENTARY' || order.payment_status === 'COMPLIMENTARY') && (
                      <div className="mb-3 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span><strong>1A Complimentary Order:</strong> Passenger Fare Charged: ₹{order.passenger_fare_charged ?? 0} | Food Entitlement: 1A | Order Status: {order.status || 'CONFIRMED'}</span>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 space-y-1">
                      {(order.items || []).map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-300">
                          <span>{it.qty || 1}x {it.name}</span>
                          <span className="font-mono font-bold text-amber-400">₹{(it.price || 0) * (it.qty || 1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Pipeline Buttons */}
                  <div className="flex flex-col justify-between items-end border-t lg:border-t-0 lg:border-l border-slate-700/60 pt-4 lg:pt-0 lg:pl-6 min-w-[240px]">
                    <div className="text-right mb-3">
                      <div className="text-lg font-black text-amber-400 font-mono">
                        {order.food_entitlement === 'COMPLIMENTARY' || order.payment_status === 'COMPLIMENTARY' ? '₹0 (Free 1A)' : `₹${order.total_amount}`}
                      </div>
                      <span className="text-xs text-slate-400 block">{order.payment_method}</span>
                      <span className="text-[11px] text-slate-400 block font-mono">Status: {order.status || 'CONFIRMED'}</span>
                      <div className="text-xs font-bold text-emerald-400 mt-1">{order.delivery_status}</div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 w-full">
                      {order.status !== 'PREPARING' && order.status !== 'DELIVERED' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order, 'PREPARING', 'Kitchen Preparing Meal 👨‍🍳')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition"
                        >
                          Mark Preparing
                        </button>
                      )}
                      {order.status !== 'OUT_FOR_DELIVERY' && order.status !== 'DELIVERED' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order, 'OUT_FOR_DELIVERY', `Out For Delivery to Coach ${order.coach_number || 'B1'}`)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition"
                        >
                          Out for Delivery
                        </button>
                      )}
                      {order.status !== 'DELIVERED' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order, 'DELIVERED', 'Delivered at Berth 🍽️')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Add / Edit Dish */}
      {showDishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Utensils className="h-5 w-5 text-amber-400" />
                {editingDish ? 'Edit Menu Dish' : 'Add New Meal Dish'}
              </h3>
              <button onClick={() => setShowDishModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitDish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deluxe North Indian Thali"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="240"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Category *</label>
                  <select
                    value={dishCategory}
                    onChange={(e) => setDishCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  >
                    <option value="Thali">Thali & Combo</option>
                    <option value="Main Course">Main Course & Biryani</option>
                    <option value="South Indian">South Indian Tiffin</option>
                    <option value="Snacks">Snacks & Rolls</option>
                    <option value="Desserts">Dessert & Beverage</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Diet Type *</label>
                  <select
                    value={dishType}
                    onChange={(e) => setDishType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                    <option value="jain">Jain / Satvik</option>
                    <option value="diabetic">Diabetic Friendly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Prep Time (Mins)</label>
                  <input
                    type="number"
                    value={dishPrepTime}
                    onChange={(e) => setDishPrepTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Ingredients and menu details..."
                  value={dishDesc}
                  onChange={(e) => setDishDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="inStockCheck"
                  checked={dishInStock}
                  onChange={(e) => setDishInStock(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="inStockCheck" className="text-xs font-bold text-slate-300">
                  Dish Available & In Stock
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowDishModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg"
                >
                  {submitting ? 'Saving...' : editingDish ? 'Update Dish' : 'Publish Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCatering;
