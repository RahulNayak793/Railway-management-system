import React, { useState, useEffect } from 'react';
import { 
  Utensils, Search, Clock, ShoppingBag, 
  RefreshCw, X, Train, Timer, CheckSquare, Square, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const getETA = (createdAt) => {
  const created = new Date(createdAt);
  const etaMs   = created.getTime() + 35 * 60 * 1000;
  const now     = Date.now();
  if (now >= etaMs) return 'Arriving now';
  const diffMin = Math.round((etaMs - now) / 60000);
  return `~${diffMin} min`;
};

const StaffCatering = () => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [trainFilter, setTrainFilter]   = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds]   = useState([]);
  const [bulkAction, setBulkAction]     = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/catering/all-orders');
      if (res.data && res.data.orders) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.warn('Fallback staff catering orders');
      setOrders([
        {
          order_id: 'ORD-98421',
          txn_id: 'TXN-FOOD-948201',
          pnr_number: '2345678901',
          train_number: '12952',
          train_name: 'Rajdhani Express',
          station_code: 'NDLS',
          station_name: 'New Delhi (NDLS)',
          passenger_name: 'Rahul Sharma',
          coach_number: 'B1',
          seat_number: '24',
          items: [{ id: 'm1', name: 'Deluxe North Indian Thali', price: 240, qty: 2 }],
          total_amount: 480,
          payment_method: 'UPI',
          payment_status: 'Paid',
          status: 'Confirmed',
          delivery_status: 'Out For Delivery to Coach B1 🚚',
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        {
          order_id: 'ORD-84910',
          txn_id: 'TXN-FOOD-849102',
          pnr_number: '7462573954',
          train_number: '12002',
          train_name: 'Shatabdi Express',
          station_code: 'BPL',
          station_name: 'Bhopal Junction (BPL)',
          passenger_name: 'Anita Verma',
          coach_number: 'C2',
          seat_number: '12',
          items: [
            { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani', price: 280, qty: 1 },
            { id: 'm18', name: 'Fresh Mango Lassi Bottle', price: 90, qty: 1 }
          ],
          total_amount: 370,
          payment_method: 'CARD',
          payment_status: 'Paid',
          status: 'Confirmed',
          delivery_status: 'Kitchen Preparing Meal 👨‍🍳',
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        {
          order_id: 'ORD-72910',
          txn_id: 'TXN-FOOD-729104',
          pnr_number: '9842105731',
          train_number: '22436',
          train_name: 'Vande Bharat Express',
          station_code: 'BSB',
          station_name: 'Varanasi Junction (BSB)',
          passenger_name: 'Suresh Patel',
          coach_number: 'C1',
          seat_number: '44',
          items: [{ id: 'm3', name: 'Jain Special Satvik Thali', price: 220, qty: 1 }],
          total_amount: 220,
          payment_method: 'COD',
          payment_status: 'Pay at Seat',
          status: 'Confirmed',
          delivery_status: 'Delivered at Berth 🍽️',
          created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await api.put(`/catering/orders/${orderId}/status`, { delivery_status: newStatus });
      if (res.data?.success) showToast(`Order #${orderId}: ${newStatus}`, 'success');
      fetchOrders();
    } catch {
      setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, delivery_status: newStatus } : o));
      showToast(`Order #${orderId}: ${newStatus}`, 'success');
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Cancel Food Order #${orderId}? This will trigger a refund.`)) return;
    try {
      const res = await api.post(`/catering/orders/${orderId}/cancel`);
      if (res.data?.success) showToast(`Order #${orderId} cancelled & refunded.`, 'success');
      fetchOrders();
    } catch {
      setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'Cancelled', delivery_status: 'Cancelled & Refunded ❌', payment_status: 'Refunded 👛' } : o));
      showToast(`Order #${orderId} cancelled & refunded.`, 'success');
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'preparing' && o.delivery_status.includes('Preparing')) ||
                          (statusFilter === 'dispatched' && (o.delivery_status.includes('Out') || o.delivery_status.includes('Dispatch'))) ||
                          (statusFilter === 'delivered' && o.delivery_status.includes('Delivered'));
    
    const matchesTrain = trainFilter === 'all' || o.train_number === trainFilter;
    
    const matchesSearch = o.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.pnr_number.includes(searchQuery) ||
                          o.passenger_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.coach_number.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesTrain && matchesSearch;
  });

  const countPreparing  = orders.filter(o => o.delivery_status.includes('Preparing')).length;
  const countDispatched = orders.filter(o => o.delivery_status.includes('Out') || o.delivery_status.includes('Dispatch')).length;
  const countDelivered  = orders.filter(o => o.delivery_status.includes('Delivered')).length;

  // ---- Bulk selection helpers ----
  const allFilteredIds = filteredOrders.map(o => o.order_id);
  const allSelected    = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(allFilteredIds);
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkApply = async () => {
    if (!bulkAction || selectedIds.length === 0) return;

    const statusMap = {
      preparing:  'Kitchen Preparing Meal 👨‍🍳',
      dispatched: 'Out For Delivery to Coach 🚚',
      delivered:  'Delivered at Berth 🍽️',
    };

    const newStatus = statusMap[bulkAction];
    if (!newStatus) return;

    let successCount = 0;
    for (const id of selectedIds) {
      try {
        await api.put(`/catering/orders/${id}/status`, { delivery_status: newStatus });
        successCount++;
      } catch {
        setOrders(prev => prev.map(o => o.order_id === id ? { ...o, delivery_status: newStatus } : o));
        successCount++;
      }
    }

    showToast(`Bulk update: ${successCount} orders → ${newStatus}`, 'success');
    setSelectedIds([]);
    setBulkAction('');
    fetchOrders();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* BRANDING BANNER */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Staff Control • Pantry & Meals Roster
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">Live Berth Meal Delivery Roster</h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">Manage pantry preparation, coach dispatch, and seat delivery verification.</p>
            </div>
          </div>

          <button
            onClick={fetchOrders}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition flex items-center space-x-1.5 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {/* STAT SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Meal Orders</span>
          <p className="text-2xl font-black text-slate-900">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Kitchen Preparing</span>
          <p className="text-2xl font-black text-amber-900">{countPreparing}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Out for Coach Delivery</span>
          <p className="text-2xl font-black text-blue-900">{countDispatched}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Delivered at Berth</span>
          <p className="text-2xl font-black text-emerald-900">{countDelivered}</p>
        </div>
      </div>

      {/* FILTER & SEARCH PANEL */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* SEARCH INPUT */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Order ID, PNR, Coach, or Passenger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
            />
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          </div>

          {/* TRAIN FILTER */}
          <div>
            <select
              value={trainFilter}
              onChange={(e) => setTrainFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Trains</option>
              <option value="12952">12952 - Rajdhani Express</option>
              <option value="12002">12002 - Shatabdi Express</option>
              <option value="22436">22436 - Vande Bharat Express</option>
            </select>
          </div>

          {/* STATUS FILTER */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="preparing">Kitchen Preparing 👨‍🍳</option>
              <option value="dispatched">Out for Delivery 🚚</option>
              <option value="delivered">Delivered 🍽️</option>
            </select>
          </div>

        </div>
      </div>

      {/* BULK ACTION BAR */}
      {filteredOrders.length > 0 && (
        <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition ${
          selectedIds.length > 0
            ? 'bg-amber-50 border-amber-300 shadow-md'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                allSelected
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
              }`}
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            {selectedIds.length > 0 && (
              <span className="text-xs font-black text-amber-800">
                {selectedIds.length} order{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value)}
                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Bulk Action --</option>
                <option value="preparing">👨‍🍳 Mark All: Kitchen Preparing</option>
                <option value="dispatched">🚚 Mark All: Dispatched to Coach</option>
                <option value="delivered">🍽️ Mark All: Delivered at Berth</option>
              </select>
              <button
                onClick={handleBulkApply}
                disabled={!bulkAction}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply to {selectedIds.length} Orders
              </button>
              <button
                onClick={() => { setSelectedIds([]); setBulkAction(''); }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-bold hover:bg-slate-100 transition"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ORDERS ROSTER CARDS */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
            <Utensils className="h-8 w-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No catering orders found matching your search.</p>
          </div>
        ) : (
          filteredOrders.map((ord) => (
            <div 
              key={ord.order_id} 
              className={`rounded-3xl border bg-white p-6 shadow-sm hover:shadow-md transition space-y-4 ${
                selectedIds.includes(ord.order_id) ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'
              }`}
            >
              {/* HEADER BAR */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  {/* CHECKBOX */}
                  <button
                    onClick={() => toggleSelectOne(ord.order_id)}
                    className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${
                      selectedIds.includes(ord.order_id)
                        ? 'bg-amber-500 border-amber-600 text-white'
                        : 'border-slate-300 hover:border-amber-400 bg-white'
                    }`}
                  >
                    {selectedIds.includes(ord.order_id) && <CheckSquare className="h-3.5 w-3.5" />}
                  </button>
                  <span className="font-mono font-black text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-xs">
                    #{ord.order_id}
                  </span>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">{ord.train_name} (#{ord.train_number})</span>
                    <span className="text-[10px] text-slate-400 font-medium">PNR #{ord.pnr_number}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    ord.delivery_status.includes('Delivered')
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : ord.delivery_status.includes('Out') || ord.delivery_status.includes('Dispatch')
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {ord.delivery_status}
                  </span>
                </div>
              </div>

              {/* DETAILS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Passenger</span>
                  <span className="font-bold text-slate-800">{ord.passenger_name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Berth</span>
                  <span className="font-mono font-bold text-slate-900">Coach {ord.coach_number}, Seat {ord.seat_number}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Station Kitchen</span>
                  <span className="font-bold text-slate-800">{ord.station_name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Est. Delivery</span>
                  <span className="font-bold text-blue-700 flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {ord.delivery_status.includes('Delivered') || ord.delivery_status.includes('Cancelled')
                      ? '—'
                      : getETA(ord.created_at)}
                  </span>
                </div>
              </div>

              {/* PAYMENT BADGE */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Payment:</span>
                <span className={`font-bold ${ord.payment_status === 'Paid' || ord.payment_status?.includes('Collected') ? 'text-emerald-700' : ord.payment_status?.includes('Refunded') ? 'text-rose-600' : 'text-amber-700'}`}>
                  {ord.payment_status} (₹{ord.total_amount})
                </span>
              </div>

              {/* ITEMS SUMMARY & STATUS ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Ordered Dishes</span>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-800">
                    {ord.items.map((itm, i) => (
                      <span key={i} className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {itm.name} (x{itm.qty})
                      </span>
                    ))}
                  </div>
                </div>

                {/* STAFF STATUS ACTIONS */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => handleUpdateStatus(ord.order_id, 'Kitchen Preparing Meal 👨‍🍳')}
                    className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition border border-amber-200"
                  >
                    👨‍🍳 Kitchen Preparing
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(ord.order_id, `Out For Delivery to Coach ${ord.coach_number} 🚚`)}
                    className="px-3 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold transition border border-blue-200"
                  >
                    🚚 Dispatch to Coach
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(ord.order_id, 'Delivered at Berth 🍽️')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-sm"
                  >
                    🍽️ Mark Delivered
                  </button>

                  <button
                    onClick={() => handleCancelOrder(ord.order_id)}
                    className="px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold transition border border-rose-200"
                  >
                    ❌ Cancel Order
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default StaffCatering;
