import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, CheckCircle, Search, RefreshCw, User, ShieldCheck, Mail, Phone, 
  Ticket, X, Train, Calendar, Filter, Download, Printer, Check, MapPin, 
  ChevronRight, AlertTriangle, ShieldAlert, ArrowUpDown, UserCheck,
  Utensils, ShoppingBag, Clock
} from 'lucide-react';
import api from '../services/api';

const StaffManifest = () => {
  const [manifest, setManifest] = useState([]);
  const [summary, setSummary] = useState({
    total_passengers: 0,
    verified_count: 0,
    pending_count: 0,
    no_show_count: 0,
    rac_count: 0,
    wl_count: 0,
    cancelled_count: 0
  });
  const [loading, setLoading] = useState(true);

  // Manifest Mode: 'passengers' | 'catering'
  const [manifestMode, setManifestMode] = useState('passengers');
  const [cateringOrders, setCateringOrders] = useState([]);
  const [loadingCatering, setLoadingCatering] = useState(false);
  const [deliveringOrderId, setDeliveringOrderId] = useState(null);

  // Filter States
  const [trains, setTrains] = useState([]);
  const [selectedTrain, setSelectedTrain] = useState('all');
  const [travelDate, setTravelDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCoach, setSelectedCoach] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // ALL, VERIFIED, PENDING, NO_SHOW, RAC, CANCELLED
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [processingPnr, setProcessingPnr] = useState(null);

  // Fetch train list for filtering
  useEffect(() => {
    const fetchTrainList = async () => {
      try {
        const res = await api.get('/staff/checking/trains');
        if (res.data && Array.isArray(res.data.trains)) {
          setTrains(res.data.trains);
        }
      } catch (err) {
        console.warn('Failed to load trains for manifest filter:', err.message);
      }
    };
    fetchTrainList();
  }, []);

  // Fetch Manifest with active filters
  const fetchManifest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/staff/manifest/${selectedTrain}`, {
        params: {
          date: travelDate || undefined,
          coach: selectedCoach !== 'ALL' ? selectedCoach : undefined,
          class: selectedClass !== 'ALL' ? selectedClass : undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          search: searchQuery || undefined
        }
      });

      if (res.data && Array.isArray(res.data.manifest)) {
        setManifest(res.data.manifest);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.warn('Error fetching manifest:', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTrain, travelDate, selectedCoach, selectedClass, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // Fetch catering orders for selected train & date
  const fetchCateringOrders = useCallback(async () => {
    setLoadingCatering(true);
    try {
      const res = await api.get('/catering/all-orders', {
        params: {
          train_number: selectedTrain !== 'all' ? selectedTrain : undefined,
          journey_date: travelDate || undefined
        }
      });
      if (res.data && Array.isArray(res.data.orders)) {
        setCateringOrders(res.data.orders);
      }
    } catch (err) {
      console.warn('Error fetching catering orders for staff:', err.message);
    } finally {
      setLoadingCatering(false);
    }
  }, [selectedTrain, travelDate]);

  useEffect(() => {
    if (manifestMode === 'catering') {
      fetchCateringOrders();
    }
  }, [manifestMode, fetchCateringOrders]);

  const handleMarkDelivered = async (orderId) => {
    setDeliveringOrderId(orderId);
    try {
      await api.put(`/catering/orders/${orderId}/status`, {
        status: 'DELIVERED',
        delivery_status: 'Delivered at Berth 🍽️'
      });
      fetchCateringOrders();
    } catch (err) {
      alert('Failed to update delivery status: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeliveringOrderId(null);
    }
  };

  // Fast inline verification action
  const handleVerifyTicket = async (passenger) => {
    if (!passenger || !passenger.pnr) return;
    setProcessingPnr(passenger.pnr);
    try {
      await api.post('/staff/ticket/verify', { pnr: passenger.pnr, checked_status: true });
      fetchManifest();
    } catch (err) {
      alert('Verification error: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessingPnr(null);
    }
  };

  // Fast inline No-Show action
  const handleMarkNoShow = async (passenger) => {
    if (!passenger || !passenger.pnr) return;
    if (!window.confirm(`Mark passenger ${passenger.passenger_name} (PNR: ${passenger.pnr}) as NO-SHOW?`)) return;
    setProcessingPnr(passenger.pnr);
    try {
      await api.post('/staff/ticket/no-show', {
        pnr: passenger.pnr,
        seat_id: `${passenger.coach}-${passenger.seat_number}`,
        reason: 'Passenger absent at boarding'
      });
      fetchManifest();
    } catch (err) {
      alert('Failed to mark NO-SHOW: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessingPnr(null);
    }
  };

  // Export to CSV
  const exportManifestCsv = () => {
    if (manifest.length === 0) {
      alert('No manifest records to export.');
      return;
    }

    const headers = [
      'PNR', 'Passenger Name', 'Age', 'Gender', 'Train No', 'Train Name',
      'Date', 'Class', 'Coach', 'Seat', 'Berth Type', 'Boarding', 'Destination', 'Status', 'Verification'
    ];

    const rows = manifest.map(m => [
      `"${m.pnr}"`,
      `"${m.passenger_name}"`,
      `"${m.age}"`,
      `"${m.gender}"`,
      `"${m.train_number}"`,
      `"${m.train_name}"`,
      `"${m.travel_date}"`,
      `"${m.coach_class}"`,
      `"${m.coach}"`,
      `"${m.seat_number}"`,
      `"${m.berth_type}"`,
      `"${m.boarding_station}"`,
      `"${m.destination_station}"`,
      `"${m.ticket_status}"`,
      `"${m.verification_status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Train_Manifest_${selectedTrain}_${travelDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Extract unique coaches present in current dataset for coach filter
  const coachOptions = useMemo(() => {
    const set = new Set();
    manifest.forEach(m => {
      if (m.coach && m.coach !== 'WL') set.add(m.coach);
    });
    return Array.from(set).sort();
  }, [manifest]);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 font-sans space-y-6 animate-slide-in">
      


      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary-600" />
            <span>Train Onboard Manifest & Catering</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Centralized on-board boarding ledger, ticket checks, and seat-side catering delivery handshake.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setManifestMode('passengers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                manifestMode === 'passengers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-4 w-4 text-primary-600" />
              <span>Passengers</span>
            </button>
            <button
              onClick={() => { setManifestMode('catering'); fetchCateringOrders(); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                manifestMode === 'catering' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Utensils className="h-4 w-4 text-orange-600" />
              <span>Train Catering ({cateringOrders.length})</span>
            </button>
          </div>

          <button
            onClick={exportManifestCsv}
            disabled={manifest.length === 0}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print</span>
          </button>
          <button
            onClick={() => { fetchManifest(); fetchCateringOrders(); }}
            disabled={loading || loadingCatering}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition flex items-center space-x-1 text-xs font-bold cursor-pointer"
            title="Refresh Manifest & Catering"
          >
            <RefreshCw className={`h-4 w-4 ${loading || loadingCatering ? 'animate-spin text-primary-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {manifestMode === 'catering' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Food Orders</span>
            <span className="text-xl font-black text-slate-900">{cateringOrders.length}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-blue-600 font-bold uppercase tracking-wider">Out for Delivery</span>
            <span className="text-xl font-black text-blue-700">
              {cateringOrders.filter(o => o.status === 'OUT_FOR_DELIVERY' || o.status === 'OUT FOR DELIVERY').length}
            </span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Delivered at Berth</span>
            <span className="text-xl font-black text-emerald-700">
              {cateringOrders.filter(o => o.status === 'DELIVERED').length}
            </span>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-amber-600 font-bold uppercase tracking-wider">Preparing in Kitchen</span>
            <span className="text-xl font-black text-amber-700">
              {cateringOrders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'ORDER CONFIRMED', 'CONFIRMED'].includes(o.status?.toUpperCase()?.replace(/_/g, ' '))).length}
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
            <span className="text-xl font-black text-slate-900">{summary.total_passengers}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Verified</span>
            <span className="text-xl font-black text-emerald-700">{summary.verified_count}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-amber-600 font-bold uppercase tracking-wider">Pending</span>
            <span className="text-xl font-black text-amber-700">{summary.pending_count}</span>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-rose-600 font-bold uppercase tracking-wider">No-Show</span>
            <span className="text-xl font-black text-rose-700">{summary.no_show_count}</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-purple-600 font-bold uppercase tracking-wider">RAC</span>
            <span className="text-xl font-black text-purple-700">{summary.rac_count}</span>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-blue-600 font-bold uppercase tracking-wider">Waitlist</span>
            <span className="text-xl font-black text-blue-700">{summary.wl_count}</span>
          </div>
          <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-2xl shadow-2xs text-center">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cancelled</span>
            <span className="text-xl font-black text-slate-600">{summary.cancelled_count}</span>
          </div>
        </div>
      )}

      {/* Comprehensive Filter Console */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          
          {/* Train Selector */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">Train</label>
            <select
              value={selectedTrain}
              onChange={(e) => setSelectedTrain(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:border-primary-500"
            >
              <option value="all">All Trains</option>
              {trains.map(t => (
                <option key={t.id} value={t.id}>
                  {t.train_number} - {t.train_name}
                </option>
              ))}
            </select>
          </div>

          {/* Journey Date */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">Journey Date</label>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono text-slate-800 focus:outline-hidden"
            />
          </div>

          {/* Coach Filter */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">Coach</label>
            <select
              value={selectedCoach}
              onChange={(e) => setSelectedCoach(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Coaches</option>
              {coachOptions.map(c => (
                <option key={c} value={c}>Coach {c}</option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Classes</option>
              <option value="1A">1A (First AC)</option>
              <option value="2A">2A (2-Tier AC)</option>
              <option value="3A">3A (3-Tier AC)</option>
              <option value="SL">SL (Sleeper)</option>
              <option value="CC">CC (Chair Car)</option>
            </select>
          </div>

          {/* Verification Status */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified (Present)</option>
              <option value="PENDING">Pending Check-in</option>
              <option value="NO_SHOW">No-Show</option>
              <option value="RAC">RAC</option>
              <option value="WL">Waitlist</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Search Bar */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">Search</label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="PNR, Name, Seat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-bold text-slate-800 focus:outline-hidden placeholder:text-slate-400 text-xs"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Manifest Data Table / Catering Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {manifestMode === 'catering' ? (
            loadingCatering ? (
              <div className="py-20 text-center text-xs font-bold text-slate-400 space-y-2">
                <RefreshCw className="h-6 w-6 text-orange-600 animate-spin mx-auto" />
                <span>Querying train catering delivery ledger...</span>
              </div>
            ) : cateringOrders.length === 0 ? (
              <div className="py-16 text-center text-xs font-bold text-slate-400 space-y-2">
                <Utensils className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-slate-700 font-extrabold text-sm">No Catering Orders for this Train / Date</p>
                <p className="text-[11px] font-normal text-slate-500">Seat-side catering deliveries will automatically appear here once passengers place orders.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Order ID</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Passenger & PNR</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Coach / Seat</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Delivery Station</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Items & Partner</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Amount & Status</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Live Stage</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500 text-right">Staff Handshake</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cateringOrders.map((ord, idx) => {
                    const isDelivered = ord.status === 'DELIVERED';
                    const isOutForDelivery = ord.status === 'OUT_FOR_DELIVERY' || ord.status === 'OUT FOR DELIVERY';
                    const isReady = ord.status === 'READY';
                    const isCancelled = ord.status === 'CANCELLED' || ord.status === 'Cancelled';

                    return (
                      <tr key={ord.order_id || idx} className="hover:bg-slate-50/70 transition">
                        {/* Order ID */}
                        <td className="px-5 py-3.5 font-mono font-black text-orange-600 text-xs">
                          {ord.order_id}
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            {ord.created_at ? new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </td>

                        {/* Passenger & PNR */}
                        <td className="px-5 py-3.5">
                          <div className="font-extrabold text-slate-900 text-xs">{ord.passenger_name || 'Passenger'}</div>
                          <div className="text-[10px] font-mono text-slate-500 font-bold">PNR: {ord.pnr_number}</div>
                        </td>

                        {/* Coach / Seat */}
                        <td className="px-5 py-3.5 font-mono">
                          <div className="font-black text-slate-900">Coach {ord.coach_number}, Seat {ord.seat_number}</div>
                          <div className="text-[10px] font-bold text-primary-600">{ord.ticket_class || ord.coach_class || 'Standard'}</div>
                        </td>

                        {/* Delivery Station / Service */}
                        <td className="px-5 py-3.5 font-bold">
                          {ord.catering_type === 'ONBOARD' ? (
                            <span className="inline-flex items-center space-x-1 text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-xs font-black">
                              <span>🍱 On-Board Pantry</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold">
                              <MapPin className="h-3 w-3 text-blue-600" />
                              <span>{ord.delivery_station_code || ord.station_code || 'En-route'}</span>
                            </span>
                          )}
                        </td>

                        {/* Items & Partner */}
                        <td className="px-5 py-3.5">
                          <div className="text-[11px] font-extrabold text-slate-900">
                            {(ord.items || []).map(i => `${i.qty || 1}x ${i.name}`).join(', ') || 'Catering Meal'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {ord.partner_name || 'Authorized Partner'}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-3.5">
                          <div className="font-black text-slate-900 font-mono">₹{parseFloat(ord.total_amount || 0).toFixed(2)}</div>
                          <div className="text-[10px] font-bold text-emerald-600">{ord.payment_status || 'Paid'}</div>
                        </td>

                        {/* Live Stage */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border inline-flex items-center space-x-1 ${
                            isDelivered
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : isOutForDelivery
                              ? 'bg-purple-50 text-purple-700 border-purple-300'
                              : isReady
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : isCancelled
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}>
                            {isDelivered && <Check className="h-3 w-3 mr-0.5" />}
                            <span>{ord.delivery_status || ord.status}</span>
                          </span>
                        </td>

                        {/* Staff Handshake Action */}
                        <td className="px-5 py-3.5 text-right">
                          {isDelivered ? (
                            <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              ✓ Delivered
                            </span>
                          ) : isCancelled ? (
                            <span className="text-slate-400 font-medium text-[10px]">Cancelled</span>
                          ) : (
                            <button
                              onClick={() => handleMarkDelivered(ord.order_id)}
                              disabled={deliveringOrderId === ord.order_id}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-[10px] shadow-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center space-x-1"
                            >
                              <Utensils className="h-3 w-3" />
                              <span>{deliveringOrderId === ord.order_id ? 'Updating...' : 'Mark Delivered 🍽️'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            loading ? (
              <div className="py-20 text-center text-xs font-bold text-slate-400 space-y-2">
                <RefreshCw className="h-6 w-6 text-primary-600 animate-spin mx-auto" />
                <span>Querying passenger manifest ledger...</span>
              </div>
            ) : manifest.length === 0 ? (
              <div className="py-16 text-center text-xs font-bold text-slate-400 space-y-1">
                <p>No passenger records match the selected filters.</p>
                <p className="text-[11px] font-normal text-slate-500">Try adjusting train, journey date, coach, or status filters.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">PNR</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Passenger Info</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Train & Date</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Coach / Seat</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Route</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Booking</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500">Boarding Status</th>
                    <th className="px-5 py-3.5 text-[10px] font-black uppercase text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {manifest.map((m, idx) => {
                    const isVerified = m.verification_status === 'VERIFIED';
                    const isNoShow = m.verification_status === 'NO_SHOW';
                    const isCancelled = m.verification_status === 'CANCELLED' || m.ticket_status === 'CANCELLED';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        
                        {/* PNR */}
                        <td className="px-5 py-3.5 font-mono font-black text-slate-900 text-xs">
                          {m.pnr}
                        </td>

                        {/* Passenger */}
                        <td className="px-5 py-3.5">
                          <div className="font-extrabold text-slate-900 text-xs">{m.passenger_name}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {m.age} yrs &bull; {m.gender}
                          </div>
                          {m.phone && (
                            <div className="text-[10px] font-mono text-slate-400">{m.phone}</div>
                          )}
                        </td>

                        {/* Train & Date */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-800">{m.train_number}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{m.train_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{m.travel_date}</div>
                        </td>

                        {/* Coach & Seat */}
                        <td className="px-5 py-3.5 font-mono">
                          <div className="font-black text-slate-900">
                            {m.coach}-{m.seat_number}
                          </div>
                          <div className="text-[10px] font-bold text-primary-600">
                            {m.coach_class} ({m.berth_type})
                          </div>
                        </td>

                        {/* Route */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-800 flex items-center space-x-1">
                            <span>{m.boarding_station}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span>{m.destination_station}</span>
                          </div>
                        </td>

                        {/* Booking Status */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-800'
                              : m.ticket_status === 'RAC'
                              ? 'bg-purple-100 text-purple-800'
                              : m.ticket_status.includes('WL')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {m.ticket_status}
                          </span>
                        </td>

                        {/* Boarding Status */}
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border inline-flex items-center space-x-1 ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : isNoShow
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : isCancelled
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}>
                            {isVerified && <Check className="h-3 w-3 mr-0.5" />}
                            <span>{m.verification_status}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          {!isCancelled && (
                            <div className="flex items-center justify-end space-x-1.5">
                              {!isVerified && (
                                <button
                                  onClick={() => handleVerifyTicket(m)}
                                  disabled={processingPnr === m.pnr}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-2xs transition cursor-pointer disabled:opacity-50"
                                >
                                  {processingPnr === m.pnr ? '...' : 'Verify'}
                                </button>
                              )}
                              {!isNoShow && (
                                <button
                                  onClick={() => handleMarkNoShow(m)}
                                  disabled={processingPnr === m.pnr}
                                  className="px-2 py-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold rounded-lg text-[10px] transition cursor-pointer"
                                  title="Mark No-Show"
                                >
                                  No-Show
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

    </div>
  );
};

export default StaffManifest;
