import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Plus,
  Search,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Train,
  X,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Clock,
  Navigation,
  ShieldAlert,
  RefreshCw,
  Power,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { indianStations } from '../utils/stationsData';

const AdminRoutes = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Search, Filter & Sort Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEFAULT');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTrainListModal, setShowTrainListModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

  // Selected route for view/edit/trains
  const [selectedRoute, setSelectedRoute] = useState(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    id: '',
    source_station_code: '',
    source_station_name: '',
    destination_station_code: '',
    destination_station_name: '',
    distance_km: '',
    departure_time: '08:00:00',
    arrival_time: '20:00:00',
    estimated_duration: '12h 00m',
    status: 'Active',
    stops: []
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline stop addition state
  const [newStop, setNewStop] = useState({
    stationCode: '',
    stationName: '',
    arrTime: '12:00:00',
    depTime: '12:05:00',
    haltMinutes: '5',
    distanceFromOriginKm: ''
  });

  const fetchRoutes = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/admin/routes');
      if (Array.isArray(res.data)) {
        setRoutes(res.data);
      } else if (res.data && Array.isArray(res.data.routes)) {
        setRoutes(res.data.routes);
      } else {
        setRoutes([]);
      }
    } catch (err) {
      console.error('Error fetching admin routes:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to load routes from database server.';
      setErrorMsg(msg);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Station name resolver
  const getStationName = (code) => {
    if (!code) return '';
    const clean = String(code).trim().toUpperCase();
    const found = indianStations.find(s => s.code.toUpperCase() === clean);
    return found ? found.name : clean;
  };

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast('');
    }, 4000);
  };

  // Unique lists for Source & Destination filter dropdowns
  const availableSourceStations = useMemo(() => {
    const set = new Set();
    routes.forEach(r => { if (r.source_station_code) set.add(r.source_station_code); });
    return Array.from(set).sort();
  }, [routes]);

  const availableDestStations = useMemo(() => {
    const set = new Set();
    routes.forEach(r => { if (r.destination_station_code) set.add(r.destination_station_code); });
    return Array.from(set).sort();
  }, [routes]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalRoutes = routes.length;
    const activeRoutes = routes.filter(r => (r.status || '').toLowerCase() === 'active').length;
    const inactiveRoutes = totalRoutes - activeRoutes;

    const stationSet = new Set();
    let totalTrains = 0;

    routes.forEach(r => {
      if (r.source_station_code) stationSet.add(r.source_station_code);
      if (r.destination_station_code) stationSet.add(r.destination_station_code);
      if (Array.isArray(r.stops)) {
        r.stops.forEach(s => {
          if (s.stationCode) stationSet.add(s.stationCode);
        });
      }
      totalTrains += (r.trains_count || 0);
    });

    return {
      totalRoutes,
      activeRoutes,
      inactiveRoutes,
      stationsCovered: stationSet.size,
      trainsUsingRoutes: totalTrains
    };
  }, [routes]);

  // Filtered & Sorted Routes
  const filteredRoutes = useMemo(() => {
    return routes.filter(route => {
      // Status filter
      if (statusFilter === 'ACTIVE' && (route.status || '').toLowerCase() !== 'active') return false;
      if (statusFilter === 'INACTIVE' && (route.status || '').toLowerCase() !== 'inactive') return false;

      // Source & Destination dropdown filters
      if (sourceFilter !== 'ALL' && route.source_station_code !== sourceFilter) return false;
      if (destFilter !== 'ALL' && route.destination_station_code !== destFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const srcCode = (route.source_station_code || '').toLowerCase();
        const srcName = (route.source_station_name || getStationName(route.source_station_code)).toLowerCase();
        const destCode = (route.destination_station_code || '').toLowerCase();
        const destName = (route.destination_station_name || getStationName(route.destination_station_code)).toLowerCase();
        const routeId = (route.id || '').toLowerCase();
        const routeStr = `${srcCode} -> ${destCode} ${srcName} -> ${destName}`.toLowerCase();

        const stopsMatch = Array.isArray(route.stops) && route.stops.some(s =>
          (s.stationCode || '').toLowerCase().includes(q) || (s.stationName || '').toLowerCase().includes(q)
        );

        if (!srcCode.includes(q) && !srcName.includes(q) && !destCode.includes(q) && !destName.includes(q) && !routeId.includes(q) && !routeStr.includes(q) && !stopsMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'DISTANCE_DESC') return (b.distance_km || 0) - (a.distance_km || 0);
      if (sortBy === 'DISTANCE_ASC') return (a.distance_km || 0) - (b.distance_km || 0);
      if (sortBy === 'DURATION_DESC') return (b.duration_minutes || 0) - (a.duration_minutes || 0);
      if (sortBy === 'DURATION_ASC') return (a.duration_minutes || 0) - (b.duration_minutes || 0);
      if (sortBy === 'TRAINS_DESC') return (b.trains_count || 0) - (a.trains_count || 0);
      if (sortBy === 'ROUTE_ID') return (a.id || '').localeCompare(b.id || '');
      if (sortBy === 'SOURCE') return (a.source_station_code || '').localeCompare(b.source_station_code || '');
      return 0;
    });
  }, [routes, searchQuery, statusFilter, sourceFilter, destFilter, sortBy]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sourceFilter, destFilter, sortBy, pageSize]);

  // Paginated Route Slice
  const totalPages = Math.ceil(filteredRoutes.length / pageSize) || 1;
  const paginatedRoutes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRoutes.slice(start, start + pageSize);
  }, [filteredRoutes, currentPage, pageSize]);

  // Toggle Route Status (Active / Inactive)
  const handleToggleStatus = async (route) => {
    const newStatus = (route.status || '').toLowerCase() === 'active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/admin/routes/${route.id}/status`, { status: newStatus });
      setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, status: newStatus } : r));
      showToast(`Route ${route.source_station_code} ➔ ${route.destination_station_code} marked as ${newStatus}`);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      // Fallback: update via PUT
      try {
        await api.put(`/admin/routes/${route.id}`, {
          source_station_code: route.source_station_code,
          destination_station_code: route.destination_station_code,
          distance_km: route.distance_km,
          status: newStatus,
          stops: route.stops
        });
        setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, status: newStatus } : r));
        showToast(`Route ${route.source_station_code} ➔ ${route.destination_station_code} marked as ${newStatus}`);
      } catch (fErr) {
        alert('Failed to toggle route status: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      id: '',
      source_station_code: '',
      source_station_name: '',
      destination_station_code: '',
      destination_station_name: '',
      distance_km: '',
      departure_time: '08:00:00',
      arrival_time: '20:00:00',
      estimated_duration: '12h 00m',
      status: 'Active',
      stops: []
    });
    setFormError('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (route) => {
    setSelectedRoute(route);
    setFormData({
      id: route.id,
      source_station_code: route.source_station_code || '',
      source_station_name: route.source_station_name || getStationName(route.source_station_code),
      destination_station_code: route.destination_station_code || '',
      destination_station_name: route.destination_station_name || getStationName(route.destination_station_code),
      distance_km: route.distance_km || 500,
      departure_time: route.departure_time || '08:00:00',
      arrival_time: route.arrival_time || '20:00:00',
      estimated_duration: route.estimated_duration || '12h 00m',
      status: route.status || 'Active',
      stops: Array.isArray(route.stops) ? JSON.parse(JSON.stringify(route.stops)) : []
    });
    setFormError('');
    setShowEditModal(true);
  };

  // Open View Modal
  const handleOpenViewModal = (route) => {
    setSelectedRoute(route);
    setShowViewModal(true);
  };

  // Open Train List Modal
  const handleOpenTrainListModal = (route) => {
    setSelectedRoute(route);
    setShowTrainListModal(true);
  };

  // Intermediate Stop Form Actions
  const handleAddStopToForm = () => {
    if (!newStop.stationCode) {
      setFormError('Please select a valid intermediate station.');
      return;
    }
    if (newStop.stationCode === formData.source_station_code || newStop.stationCode === formData.destination_station_code) {
      setFormError('Intermediate station cannot be origin or destination station.');
      return;
    }
    const exists = formData.stops.some(s => s.stationCode === newStop.stationCode);
    if (exists) {
      setFormError(`Station ${newStop.stationCode} is already included in intermediate stops.`);
      return;
    }

    const nextSeq = formData.stops.length + 1;
    const addedStop = {
      sequence: nextSeq,
      stationCode: newStop.stationCode.toUpperCase(),
      stationName: newStop.stationName || getStationName(newStop.stationCode),
      arrTime: newStop.arrTime || '12:00:00',
      depTime: newStop.depTime || '12:05:00',
      haltMinutes: String(newStop.haltMinutes || '5'),
      distanceFromOriginKm: parseFloat(newStop.distanceFromOriginKm) || (formData.distance_km ? Math.round(formData.distance_km * 0.5) : 250)
    };

    setFormData(prev => ({
      ...prev,
      stops: [...prev.stops, addedStop]
    }));

    setNewStop({
      stationCode: '',
      stationName: '',
      arrTime: '12:00:00',
      depTime: '12:05:00',
      haltMinutes: '5',
      distanceFromOriginKm: ''
    });
    setFormError('');
  };

  const handleRemoveStopFromForm = (idx) => {
    setFormData(prev => {
      const updated = prev.stops.filter((_, i) => i !== idx).map((stop, i) => ({
        ...stop,
        sequence: i + 1
      }));
      return { ...prev, stops: updated };
    });
  };

  const handleMoveStop = (idx, direction) => {
    setFormData(prev => {
      const list = [...prev.stops];
      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;

      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;

      const resequenced = list.map((stop, i) => ({
        ...stop,
        sequence: i + 1
      }));

      return { ...prev, stops: resequenced };
    });
  };

  // Submit Handler for Add / Edit Route
  const handleSubmitRoute = async (e) => {
    e.preventDefault();
    setFormError('');

    const src = formData.source_station_code.trim().toUpperCase();
    const dest = formData.destination_station_code.trim().toUpperCase();

    if (!src || !dest) {
      setFormError('Source and destination station codes are required.');
      return;
    }
    if (src === dest) {
      setFormError('Source and destination stations cannot be identical.');
      return;
    }

    const dist = parseFloat(formData.distance_km);
    if (isNaN(dist) || dist < 0) {
      setFormError('Distance must be a valid non-negative number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        source_station_code: src,
        destination_station_code: dest,
        distance_km: dist,
        departure_time: formData.departure_time,
        arrival_time: formData.arrival_time,
        estimated_duration: formData.estimated_duration,
        status: formData.status,
        stops: formData.stops
      };

      if (showEditModal && formData.id) {
        await api.put(`/admin/routes/${formData.id}`, payload);
        showToast(`Route ${src} ➔ ${dest} updated successfully!`);
        setShowEditModal(false);
      } else {
        await api.post('/admin/routes', payload);
        showToast(`New route ${src} ➔ ${dest} created successfully!`);
        setShowAddModal(false);
      }

      fetchRoutes();
    } catch (err) {
      console.error('Failed to save route:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to save route. Please check input parameters.';
      setFormError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Delete Handler
  const handleDeleteRoute = async (route) => {
    setDeleteConfirmModal(null);
    try {
      await api.delete(`/admin/routes/${route.id}`);
      showToast(`Route ${route.source_station_code} ➔ ${route.destination_station_code} deleted successfully.`);
      fetchRoutes();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to delete route.';
      alert(`⚠️ Deletion Blocked:\n\n${msg}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center space-x-3 bg-emerald-600 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl animate-fade-in border border-emerald-500">
          <CheckCircle2 className="h-5 w-5 text-emerald-200" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="h-6 w-6 text-primary-600" />
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Route Management & Network Expansion</h1>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Indian Railway Network Hub: Configure rail routes, regional corridors, distance calculations, and intermediate station schedules.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRoutes}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition flex items-center space-x-1.5 text-xs font-bold"
            title="Refresh database routes"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Route</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Routes</span>
            <Compass className="h-4 w-4 text-primary-500" />
          </div>
          <p className="text-2xl font-black text-slate-800">{summaryMetrics.totalRoutes.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">Expanded network routes</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Routes</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{summaryMetrics.activeRoutes.toLocaleString()}</p>
          <p className="text-[10px] text-emerald-600 font-semibold">Operational corridors</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Inactive Routes</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{summaryMetrics.inactiveRoutes.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">Suspended lines</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Stations Covered</span>
            <MapPin className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600">{summaryMetrics.stationsCovered}</p>
          <p className="text-[10px] text-slate-400">Unique station nodes</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Trains Using Routes</span>
            <Train className="h-4 w-4 text-sky-500" />
          </div>
          <p className="text-2xl font-black text-sky-600">{summaryMetrics.trainsUsingRoutes}</p>
          <p className="text-[10px] text-slate-400">Assigned fleet trains</p>
        </div>
      </div>

      {/* Error State Banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between text-red-700 text-xs font-semibold">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={fetchRoutes} className="underline text-red-800 font-bold hover:text-red-950">Retry</button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-0">
        {/* Search, Filter & Sort Header Bar */}
        <div className="bg-slate-50/80 border-b border-slate-100 p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-slate-700 font-bold text-sm">
              <Navigation className="h-4 w-4 text-primary-600" />
              <span>System Rail Routes</span>
              <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                {filteredRoutes.length.toLocaleString()}
              </span>
            </div>

            {/* Pagination Size Selector */}
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {/* Search Input */}
            <div className="sm:col-span-2 flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-800 shadow-sm focus-within:border-primary-500">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search station code, name, UD ➔ NDLS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Source Station Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 shadow-sm cursor-pointer truncate"
            >
              <option value="ALL">All Source Stations</option>
              {availableSourceStations.map(st => (
                <option key={st} value={st}>{st} — {getStationName(st)}</option>
              ))}
            </select>

            {/* Destination Station Filter */}
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 shadow-sm cursor-pointer truncate"
            >
              <option value="ALL">All Destination Stations</option>
              {availableDestStations.map(st => (
                <option key={st} value={st}>{st} — {getStationName(st)}</option>
              ))}
            </select>

            {/* Status & Sort Combo */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 shadow-sm cursor-pointer w-1/2"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 shadow-sm cursor-pointer w-1/2"
              >
                <option value="DEFAULT">Sort: Default</option>
                <option value="DISTANCE_DESC">Dist: High to Low</option>
                <option value="DISTANCE_ASC">Dist: Low to High</option>
                <option value="DURATION_DESC">Duration: High to Low</option>
                <option value="DURATION_ASC">Duration: Low to High</option>
                <option value="TRAINS_DESC">Most Assigned Trains</option>
                <option value="ROUTE_ID">Route ID</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary-500" />
              <p className="text-xs font-bold">Loading Indian Railway route network...</p>
            </div>
          ) : paginatedRoutes.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <Compass className="h-10 w-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No matching routes found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'ALL' || sourceFilter !== 'ALL' || destFilter !== 'ALL'
                  ? 'Try adjusting your search query or filter options.'
                  : 'Click "Add Route" to create a route.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Route ID</th>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Source Station</th>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Destination Station</th>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Distance</th>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Duration</th>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Assigned Trains</th>
                  <th className="px-4 py-3 text-[10px] font-extrabold uppercase text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRoutes.map((route) => {
                  const srcName = route.source_station_name || getStationName(route.source_station_code);
                  const destName = route.destination_station_name || getStationName(route.destination_station_code);
                  const isActive = (route.status || '').toLowerCase() === 'active';
                  const trainsCount = route.trains_count || 0;

                  return (
                    <tr key={route.id} className="hover:bg-slate-50/60 transition group">
                      {/* Route ID */}
                      <td className="px-4 py-3.5 text-xs font-mono font-bold text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {route.id}
                        </span>
                      </td>

                      {/* Source Station */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-extrabold text-slate-800">{route.source_station_code}</span>
                          <span className="text-[10px] text-slate-400">—</span>
                          <span className="text-xs text-slate-600 font-medium truncate max-w-[140px]">{srcName}</span>
                        </div>
                      </td>

                      {/* Destination Station */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-extrabold text-slate-800">{route.destination_station_code}</span>
                          <span className="text-[10px] text-slate-400">—</span>
                          <span className="text-xs text-slate-600 font-medium truncate max-w-[140px]">{destName}</span>
                        </div>
                      </td>

                      {/* Distance */}
                      <td className="px-4 py-3.5 text-xs font-extrabold font-mono text-slate-700">
                        {route.distance_km} km
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3.5 text-xs font-semibold text-slate-600 font-mono">
                        {route.estimated_duration || '12h 00m'}
                      </td>

                      {/* Number of Trains */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleOpenTrainListModal(route)}
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border flex items-center space-x-1 transition ${
                            trainsCount > 0
                              ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <Train className="h-3 w-3" />
                          <span>{trainsCount === 1 ? '1 Train' : `${trainsCount} Trains`}</span>
                        </button>
                      </td>

                      {/* Status & Activate/Deactivate Toggle */}
                      <td className="px-4 py-3.5 text-xs font-bold">
                        <button
                          onClick={() => handleToggleStatus(route)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Click to toggle status"
                        >
                          <Power className={`h-3 w-3 ${isActive ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end space-x-1">
                          <button
                            onClick={() => handleOpenViewModal(route)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="View Timeline Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(route)}
                            className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                            title="Edit Route"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmModal(route)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Route"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && filteredRoutes.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <div>
              Showing <span className="font-extrabold text-slate-800">{Math.min((currentPage - 1) * pageSize + 1, filteredRoutes.length)}</span> to{' '}
              <span className="font-extrabold text-slate-800">{Math.min(currentPage * pageSize, filteredRoutes.length)}</span> of{' '}
              <span className="font-extrabold text-slate-800">{filteredRoutes.length.toLocaleString()}</span> routes
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 flex items-center space-x-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-3 py-1 font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 flex items-center space-x-1"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW ROUTE TIMELINE DETAILS MODAL */}
      {showViewModal && selectedRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-black">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-850">Route Timeline Details</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedRoute.id}</p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Source -> Destination Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-inner space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origin</span>
                  <p className="text-xl font-black text-white">{selectedRoute.source_station_code}</p>
                  <p className="text-xs text-slate-300 font-medium">{selectedRoute.source_station_name || getStationName(selectedRoute.source_station_code)}</p>
                </div>

                <div className="flex flex-col items-center px-4">
                  <span className="text-[10px] font-mono font-bold text-primary-400">{selectedRoute.distance_km} km</span>
                  <div className="w-28 sm:w-40 border-t-2 border-dashed border-primary-500/60 my-1 relative">
                    <ArrowRight className="h-4 w-4 text-primary-400 absolute right-0 -top-2.5" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">{selectedRoute.estimated_duration || '12h 00m'}</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination</span>
                  <p className="text-xl font-black text-white">{selectedRoute.destination_station_code}</p>
                  <p className="text-xs text-slate-300 font-medium">{selectedRoute.destination_station_name || getStationName(selectedRoute.destination_station_code)}</p>
                </div>
              </div>
            </div>

            {/* Visual Route Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>Station Stops & Visual Timeline Schedule</span>
              </h4>

              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                {/* Origin Node */}
                <div className="flex items-start space-x-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1 bg-white p-3 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800">{selectedRoute.source_station_code} — {selectedRoute.source_station_name || getStationName(selectedRoute.source_station_code)}</span>
                      <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">Origin</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700">Dep: {selectedRoute.departure_time || '08:00'}</span>
                  </div>
                </div>

                {/* Intermediate Stops */}
                {Array.isArray(selectedRoute.stops) && selectedRoute.stops.map((stop, idx) => (
                  <div key={idx} className="flex items-start space-x-3 pl-2 border-l-2 border-dashed border-slate-300 ml-3 py-1">
                    <div className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 -ml-2.5 bg-white">
                      {stop.sequence || idx + 2}
                    </div>
                    <div className="flex-1 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-800">{stop.stationCode}</span>
                        <span className="text-slate-500 text-xs ml-1 font-medium">— {stop.stationName || getStationName(stop.stationCode)}</span>
                      </div>
                      <div className="text-right font-mono text-[11px] text-slate-600">
                        <span>Arr: {stop.arrTime || '00:00'}</span> | <span>Dep: {stop.depTime || '00:00'}</span>
                        <span className="ml-2 text-slate-400 font-sans">({stop.distanceFromOriginKm || 0} km)</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Destination Node */}
                <div className="flex items-start space-x-3">
                  <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                    {(selectedRoute.stops ? selectedRoute.stops.length : 0) + 2}
                  </div>
                  <div className="flex-1 bg-white p-3 rounded-xl border border-indigo-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800">{selectedRoute.destination_station_code} — {selectedRoute.destination_station_name || getStationName(selectedRoute.destination_station_code)}</span>
                      <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold uppercase">Destination</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-700">Arr: {selectedRoute.arrival_time || '20:00'} ({selectedRoute.distance_km} km)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Operating Trains */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Train className="h-4 w-4 text-sky-600" />
                <span>Operating Fleet Trains ({selectedRoute.trains_count || 0})</span>
              </h4>
              {Array.isArray(selectedRoute.trains) && selectedRoute.trains.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedRoute.trains.map((t, idx) => (
                    <div key={idx} className="bg-sky-50 text-sky-900 border border-sky-200 rounded-xl px-3 py-2 text-xs font-extrabold flex items-center space-x-2">
                      <span className="font-mono bg-sky-200/80 px-1.5 py-0.5 rounded text-[11px]">{t.train_number}</span>
                      <span>{t.train_name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No fleet trains currently linked to this exact route.</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AFFECTED TRAINS LIST MODAL */}
      {showTrainListModal && selectedRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Train className="h-5 w-5 text-sky-600" />
                <h3 className="text-base font-extrabold text-slate-800">Trains Assigned to Route</h3>
              </div>
              <button onClick={() => setShowTrainListModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Route: <span className="font-bold text-slate-800">{selectedRoute.source_station_code} ➔ {selectedRoute.destination_station_code}</span> ({selectedRoute.distance_km} km)
            </p>

            {Array.isArray(selectedRoute.trains) && selectedRoute.trains.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                {selectedRoute.trains.map((t, idx) => (
                  <div key={idx} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-extrabold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-100 mr-2">
                        #{t.train_number}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">{t.train_name}</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 uppercase">
                      {t.status || 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No trains assigned to this route line yet.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowTrainListModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT ROUTE MODAL */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100 space-y-5 animate-scale-in my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                  {showEditModal ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    {showEditModal ? `Edit Route (${formData.id})` : 'Add New Route'}
                  </h3>
                  <p className="text-xs text-slate-400">Configure route endpoints, distance, duration, and intermediate stop sequence.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Alert Banner */}
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-700 text-xs font-semibold">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-red-800">Validation Error</p>
                  <p>{formError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitRoute} className="space-y-6">
              {/* Section A: Basic Route Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Navigation className="h-4 w-4 text-primary-600" />
                  <span>A. Basic Route Information</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Source Station */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Source Station *</label>
                    <select
                      value={formData.source_station_code}
                      onChange={(e) => {
                        const code = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          source_station_code: code,
                          source_station_name: getStationName(code)
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary-500 cursor-pointer"
                      required
                    >
                      <option value="">-- Select Source Station --</option>
                      {indianStations.map(st => (
                        <option key={st.code} value={st.code}>
                          {st.code} — {st.name} ({st.state})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Destination Station */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Destination Station *</label>
                    <select
                      value={formData.destination_station_code}
                      onChange={(e) => {
                        const code = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          destination_station_code: code,
                          destination_station_name: getStationName(code)
                        }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary-500 cursor-pointer"
                      required
                    >
                      <option value="">-- Select Destination Station --</option>
                      {indianStations.map(st => (
                        <option key={st.code} value={st.code}>
                          {st.code} — {st.name} ({st.state})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Distance (km) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Total Distance (km) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      min="0"
                      step="1"
                      value={formData.distance_km}
                      onChange={(e) => setFormData(prev => ({ ...prev, distance_km: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary-500 font-mono"
                      required
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Route Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary-500 cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{showEditModal ? 'Save Route Changes' : 'Create Route'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2.5 rounded-2xl bg-red-50 text-red-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Confirm Route Deletion</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete route <span className="font-extrabold text-slate-800">{deleteConfirmModal.source_station_code} ➔ {deleteConfirmModal.destination_station_code}</span> ({deleteConfirmModal.distance_km} km)?
            </p>

            {deleteConfirmModal.trains_count > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-amber-800 text-xs font-semibold space-y-1">
                <p className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span>Assigned Fleet Warning</span>
                </p>
                <p>This route is currently assigned to {deleteConfirmModal.trains_count} train(s). The system will safely block deletion if active trains rely on it.</p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRoute(deleteConfirmModal)}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition"
              >
                Yes, Delete Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoutes;
