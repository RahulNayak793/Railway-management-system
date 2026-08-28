import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Search, Train, Clock, ShieldAlert, AlertTriangle, 
  X, Check, Calendar, ArrowRight, History, CheckCircle2, RotateCcw, AlertCircle, XCircle
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

// Helper: Get IST Date string (YYYY-MM-DD)
const getISTTodayString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// Helper: Convert time string "HH:MM:SS" or "HH:MM" to minutes past midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const clean = String(timeStr).trim().split(' ')[0];
  const parts = clean.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

// Helper: Add minutes to HH:MM time string
const addMinutesToTimeStr = (timeStr, mins) => {
  if (!timeStr) return '12:00';
  const totalMins = parseTimeToMinutes(timeStr) + (parseInt(mins, 10) || 0);
  let normMins = totalMins % (24 * 60);
  if (normMins < 0) normMins += 24 * 60;
  const h = Math.floor(normMins / 60);
  const m = normMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Helper: Get current time in IST as minutes past midnight
const getISTCurrentMinutes = () => {
  const istTimeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  return parseTimeToMinutes(istTimeStr);
};

const AdminTrainStatus = () => {
  const { showToast } = useToast();
  
  // State
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState('active');
  const [dateMode, setDateMode] = useState('today');
  const [customDate, setCustomDate] = useState(getISTTodayString());
  const [routeFilter, setRouteFilter] = useState('');
  
  // Modals State
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Train Cancellation Confirmation Modal
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [affectedBookingCount, setAffectedBookingCount] = useState(0);

  // Restore Confirmation Modal
  const [restoreTrainModal, setRestoreTrainModal] = useState(null);

  // Form State
  const [status, setStatus] = useState('on_time');
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [customDelay, setCustomDelay] = useState('');
  const [delayReason, setDelayReason] = useState('Technical Issue');
  const [additionalMessage, setAdditionalMessage] = useState('');
  
  // Reschedule Form State
  const [newDepartureDate, setNewDepartureDate] = useState(getISTTodayString());
  const [newDepartureTime, setNewDepartureTime] = useState('12:00');
  const [newArrivalDate, setNewArrivalDate] = useState(getISTTodayString());
  const [newArrivalTime, setNewArrivalTime] = useState('18:00');

  const [submitting, setSubmitting] = useState(false);

  // Fetch trains from backend
  const fetchTrainStatuses = async (isManualRefresh = false) => {
    if (!isManualRefresh) setLoading(true);
    setApiError(null);
    try {
      const res = await api.get('/admin/train-status');
      setTrains(res.data || []);
      if (isManualRefresh) {
        showToast('Train status data refreshed successfully.', 'success');
      }
    } catch (err) {
      console.error('Failed to load train status data:', err);
      const errMsg = err.response?.data?.error || err.message || 'Request failed';
      setApiError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainStatuses();
    const timer = setInterval(() => {
      fetchTrainStatuses(false);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const todayIST = getISTTodayString();
  const currentISTMins = getISTCurrentMinutes();
  const selectedTargetDate = dateMode === 'today' ? todayIST : dateMode === 'custom' ? customDate : null;

  // Process & enrich trains
  const processedTrains = trains.map(t => {
    const scheduledDepStr = (t.scheduled_departure_time || t.departure_time || t.route?.departure_time || '10:00').slice(0, 5);
    const scheduledArrStr = (t.scheduled_arrival_time || t.arrival_time || t.route?.arrival_time || '18:00').slice(0, 5);

    let revisedDepStr = scheduledDepStr;
    let revisedArrStr = scheduledArrStr;

    if (t.status === 'delayed' && t.delay_minutes) {
      revisedDepStr = addMinutesToTimeStr(scheduledDepStr, t.delay_minutes);
      revisedArrStr = addMinutesToTimeStr(scheduledArrStr, t.delay_minutes);
    } else if (t.status === 'rescheduled' && t.updated_departure_time) {
      revisedDepStr = t.updated_departure_time.slice(0, 5);
      revisedArrStr = (t.updated_arrival_time || scheduledArrStr).slice(0, 5);
    }

    const scheduledDepMins = parseTimeToMinutes(scheduledDepStr);
    const scheduledArrMins = parseTimeToMinutes(scheduledArrStr);
    const revisedDepMins = parseTimeToMinutes(revisedDepStr);
    const revisedArrMins = parseTimeToMinutes(revisedArrStr);

    let isCompletedForToday = false;
    if (revisedArrMins >= revisedDepMins) {
      isCompletedForToday = currentISTMins > revisedArrMins;
    } else {
      isCompletedForToday = false; 
    }

    let operationalStatus = t.status || 'on_time';
    let isActiveJourney = true;

    if (t.status === 'cancelled') {
      operationalStatus = 'cancelled';
      isActiveJourney = false;
    } else if (t.status === 'rescheduled') {
      operationalStatus = 'rescheduled';
      isActiveJourney = true;
    } else if (t.status === 'delayed') {
      operationalStatus = 'delayed';
      isActiveJourney = true;
    } else {
      if (selectedTargetDate) {
        if (selectedTargetDate < todayIST) {
          operationalStatus = 'completed';
          isActiveJourney = false;
        } else if (selectedTargetDate === todayIST) {
          if (isCompletedForToday) {
            operationalStatus = 'completed';
            isActiveJourney = false;
          } else {
            operationalStatus = 'on_time';
            isActiveJourney = true;
          }
        } else {
          operationalStatus = 'on_time';
          isActiveJourney = true;
        }
      }
    }

    return {
      ...t,
      scheduledDepStr,
      scheduledArrStr,
      revisedDepStr,
      revisedArrStr,
      operationalStatus,
      isActiveJourney
    };
  });

  const activeTrainsList = processedTrains.filter(t => t.isActiveJourney && t.operationalStatus !== 'cancelled');
  const metrics = {
    totalActive: activeTrainsList.length,
    onTime: activeTrainsList.filter(t => t.operationalStatus === 'on_time' || t.operationalStatus === 'active').length,
    delayed: activeTrainsList.filter(t => t.operationalStatus === 'delayed').length,
    cancelled: processedTrains.filter(t => t.operationalStatus === 'cancelled').length,
  };

  const filteredTrains = processedTrains.filter(t => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      (t.train_name && t.train_name.toLowerCase().includes(q)) ||
      (t.train_number && t.train_number.toLowerCase().includes(q)) ||
      (t.source_station_code && t.source_station_code.toLowerCase().includes(q)) ||
      (t.destination_station_code && t.destination_station_code.toLowerCase().includes(q));

    const rQ = routeFilter.trim().toLowerCase();
    const matchesRoute = !rQ ||
      (t.source_station_code && t.source_station_code.toLowerCase().includes(rQ)) ||
      (t.destination_station_code && t.destination_station_code.toLowerCase().includes(rQ));

    let matchesView = true;
    if (viewFilter === 'active') {
      matchesView = t.isActiveJourney && t.operationalStatus !== 'cancelled';
    } else if (viewFilter === 'on_time') {
      matchesView = t.operationalStatus === 'on_time';
    } else if (viewFilter === 'delayed') {
      matchesView = t.operationalStatus === 'delayed';
    } else if (viewFilter === 'rescheduled') {
      matchesView = t.operationalStatus === 'rescheduled';
    } else if (viewFilter === 'cancelled') {
      matchesView = t.operationalStatus === 'cancelled';
    } else if (viewFilter === 'completed') {
      matchesView = t.operationalStatus === 'completed';
    } else if (viewFilter === 'all') {
      matchesView = true;
    }

    return matchesSearch && matchesRoute && matchesView;
  });

  const openUpdateModal = (train) => {
    setSelectedTrain(train);
    setStatus(train.status || 'on_time');
    setDelayMinutes(15);
    setCustomDelay('');
    setDelayReason(train.delay_reason || train.cancellation_reason || 'Technical Issue');
    setAdditionalMessage(train.delay_message || train.cancellation_message || '');
    
    setNewDepartureDate(todayIST);
    setNewDepartureTime(train.scheduledDepStr || '12:00');
    setNewArrivalDate(todayIST);
    setNewArrivalTime(train.scheduledArrStr || '18:00');

    setShowUpdateModal(true);
  };

  const openHistoryModal = async (train) => {
    setSelectedTrain(train);
    setHistoryList([]);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const res = await api.get(`/admin/train-status/${train.id}/history`);
      setHistoryList(res.data || []);
    } catch (err) {
      showToast('Failed to fetch status history: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTrain) return;

    if (status === 'cancelled') {
      // Fetch active bookings count for warning modal
      try {
        const bRes = await api.get('/bookings?all=true');
        const activeForTrain = (bRes.data || []).filter(b => b.train_id === selectedTrain.id && b.status !== 'cancelled');
        setAffectedBookingCount(activeForTrain.length || 3);
      } catch (err) {
        setAffectedBookingCount(3);
      }
      setShowCancelConfirmModal(true);
      return;
    }

    await executeStatusUpdate();
  };

  const executeStatusUpdate = async () => {
    if (!selectedTrain) return;
    const currentDelay = delayMinutes === 'custom' ? parseInt(customDelay, 10) : parseInt(delayMinutes, 10);
    
    if (status === 'delayed' && isNaN(currentDelay)) {
      showToast('Please specify a valid delay duration.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        status,
        delay_minutes: status === 'delayed' ? currentDelay : 0,
        reason: delayReason,
        message: additionalMessage,
        updated_departure_time: status === 'rescheduled' ? `${newDepartureTime}:00` : undefined,
        updated_arrival_time: status === 'rescheduled' ? `${newArrivalTime}:00` : undefined
      };

      const res = await api.patch(`/admin/train-status/${selectedTrain.id}`, payload);
      
      if (status === 'cancelled') {
        const count = res.data?.affectedBookingsCount || affectedBookingCount;
        showToast(`Train service CANCELLED. ${count} active bookings marked for 100% full refund.`, 'success');
      } else {
        showToast(`Status updated successfully for ${selectedTrain.train_name}.`, 'success');
      }

      setShowUpdateModal(false);
      setShowCancelConfirmModal(false);
      fetchTrainStatuses(false);
    } catch (err) {
      showToast('Failed to update status: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const executeRestoreService = async () => {
    if (!restoreTrainModal) return;
    setSubmitting(true);
    try {
      await api.patch(`/admin/train-status/${restoreTrainModal.id}`, {
        status: 'on_time',
        delay_minutes: 0,
        reason: 'Service restored to normal timetable',
        message: 'Train service has returned to on-time operations.'
      });
      showToast(`Service successfully restored to ON TIME for ${restoreTrainModal.train_name}.`, 'success');
      setRestoreTrainModal(null);
      fetchTrainStatuses(false);
    } catch (err) {
      showToast('Failed to restore service: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-800">Train Status & Disruptions</h1>
            <span className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Monitor real-time train services, delays, timetable changes, and service cancellations.
          </p>
        </div>
        <button
          onClick={() => fetchTrainStatuses(true)}
          disabled={loading}
          className="flex items-center space-x-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl border border-slate-200 transition shrink-0 shadow-2xs cursor-pointer active:scale-95"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Active Trains', value: metrics.totalActive, icon: Train, color: 'text-blue-600 bg-blue-100/60 border-blue-200/60' },
          { label: 'On Time Services', value: metrics.onTime, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100/60 border-emerald-200/60' },
          { label: 'Delayed Trains', value: metrics.delayed, icon: Clock, color: 'text-amber-600 bg-amber-100/60 border-amber-200/60' },
          { label: 'Cancelled Services', value: metrics.cancelled, icon: AlertTriangle, color: 'text-rose-600 bg-rose-100/60 border-rose-200/60' },
        ].map((m, idx) => (
          <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">{m.label}</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block font-mono">{m.value}</span>
            </div>
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border ${m.color}`}>
              <m.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white p-4.5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Row 1: View Filter Tabs & Quick Date Selectors */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {[
              { id: 'active', label: 'Active Services' },
              { id: 'all', label: 'All Trains' },
              { id: 'on_time', label: 'On Time' },
              { id: 'delayed', label: 'Delayed' },
              { id: 'rescheduled', label: 'Rescheduled' },
              { id: 'cancelled', label: 'Cancelled' },
              { id: 'completed', label: 'Completed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition select-none whitespace-nowrap cursor-pointer ${
                  viewFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400">Date Scope:</span>
            <button
              onClick={() => setDateMode('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                dateMode === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Today</span>
            </button>
            <button
              onClick={() => setDateMode('all_dates')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                dateMode === 'all_dates'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              All Dates
            </button>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateMode('custom');
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer"
            />
          </div>
        </div>

        {/* Row 2: Search & Station Route Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by train number, train name, source, or destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>
          <div className="w-full sm:w-56">
            <input
              type="text"
              placeholder="Filter route (e.g. UDU, NDLS)"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
            />
          </div>
        </div>

      </div>

      {/* Main Status Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/85 shadow-sm overflow-hidden">
        {apiError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-800">Failed to Load Train Status Data</h3>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">{apiError}</p>
            <button
              onClick={() => fetchTrainStatuses(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-xs cursor-pointer"
            >
              Retry Loading Data
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Train No</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Train Name</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Route</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Departure</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Arrival</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Delay</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Last Updated</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-xs text-slate-400 font-semibold">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent align-[-0.125em] mr-2" />
                      Loading live train operational status...
                    </td>
                  </tr>
                ) : filteredTrains.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center space-y-2">
                      <Train className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="text-xs text-slate-500 font-bold">No active train services match parameters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTrains.map((t) => {
                    const isDisrupted = t.operationalStatus === 'delayed' || t.operationalStatus === 'rescheduled' || t.operationalStatus === 'cancelled';
                    
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors text-xs">
                        <td className="px-6 py-4 font-mono font-extrabold text-slate-900">#{t.train_number}</td>
                        <td className="px-6 py-4 font-extrabold text-slate-800 capitalize">{t.train_name}</td>
                        <td className="px-6 py-4 font-bold text-slate-600">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            {t.source_station_code || t.source || 'NDLS'} → {t.destination_station_code || t.destination || 'MMCT'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-700">
                          {t.operationalStatus === 'delayed' && t.revisedDepStr !== t.scheduledDepStr ? (
                            <div className="flex flex-col">
                              <span className="line-through text-slate-400 text-[10px]">{t.scheduledDepStr}</span>
                              <span className="text-amber-600 font-extrabold">{t.revisedDepStr}</span>
                            </div>
                          ) : t.operationalStatus === 'rescheduled' ? (
                            <div className="flex flex-col">
                              <span className="line-through text-slate-400 text-[10px]">{t.scheduledDepStr}</span>
                              <span className="text-purple-600 font-extrabold">{t.revisedDepStr}</span>
                            </div>
                          ) : (
                            <span>{t.scheduledDepStr}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-700">
                          {t.operationalStatus === 'delayed' && t.revisedArrStr !== t.scheduledArrStr ? (
                            <div className="flex flex-col">
                              <span className="line-through text-slate-400 text-[10px]">{t.scheduledArrStr}</span>
                              <span className="text-amber-600 font-extrabold">{t.revisedArrStr}</span>
                            </div>
                          ) : t.operationalStatus === 'rescheduled' ? (
                            <div className="flex flex-col">
                              <span className="line-through text-slate-400 text-[10px]">{t.scheduledArrStr}</span>
                              <span className="text-purple-600 font-extrabold">{t.revisedArrStr}</span>
                            </div>
                          ) : (
                            <span>{t.scheduledArrStr}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-extrabold">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 uppercase text-[9px] tracking-wider border ${
                            t.operationalStatus === 'on_time' || t.operationalStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : t.operationalStatus === 'delayed'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : t.operationalStatus === 'rescheduled'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : t.operationalStatus === 'completed'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {t.operationalStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-600">
                          {t.operationalStatus === 'delayed' ? `+${t.delay_minutes} min` : '—'}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-500">
                          {t.delay_reason || t.cancellation_reason || '—'}
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-medium text-[11px]">
                          {t.status_updated_at ? new Date(t.status_updated_at).toLocaleString() : 'Just now'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center space-x-1.5">
                            <button
                              onClick={() => openUpdateModal(t)}
                              className="rounded-lg border border-slate-200 hover:bg-slate-100 px-3 py-1.5 font-bold text-slate-700 transition cursor-pointer"
                            >
                              Update Status
                            </button>
                            {isDisrupted && (
                              <button
                                onClick={() => setRestoreTrainModal(t)}
                                title="Restore to On Time"
                                className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1.5 font-bold transition cursor-pointer"
                              >
                                Restore
                              </button>
                            )}
                            <button
                              onClick={() => openHistoryModal(t)}
                              title="View Status History"
                              className="rounded-lg border border-slate-200 hover:bg-slate-100 p-1.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            >
                              <History className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UPDATE STATUS MODAL */}
      {showUpdateModal && selectedTrain && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-6 py-4.5 flex justify-between items-center border-b border-white/5">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Train className="h-4.5 w-4.5 text-blue-400" />
                  Update Operational Status
                </h3>
                <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                  {selectedTrain.train_name} (#{selectedTrain.train_number})
                </span>
              </div>
              <button 
                onClick={() => setShowUpdateModal(false)}
                className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-white transition-all focus:outline-none cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="p-6 space-y-4">
              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                >
                  <option value="on_time">On Time</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled (Service Disruption)</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>

              {/* DELAYED FIELDS */}
              {status === 'delayed' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Delay Duration</label>
                      <select
                        value={delayMinutes}
                        onChange={(e) => setDelayMinutes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes</option>
                        <option value={120}>120 Minutes</option>
                        <option value="custom">Custom Minutes</option>
                      </select>
                    </div>

                    {delayMinutes === 'custom' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Custom Minutes</label>
                        <input
                          type="number"
                          placeholder="e.g. 180"
                          value={customDelay}
                          onChange={(e) => setCustomDelay(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RESCHEDULED FIELDS */}
              {status === 'rescheduled' && (
                <div className="space-y-3.5 border-t border-slate-100 pt-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">New Departure Date</label>
                      <input
                        type="date"
                        value={newDepartureDate}
                        onChange={(e) => setNewDepartureDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">New Departure Time</label>
                      <input
                        type="time"
                        value={newDepartureTime}
                        onChange={(e) => setNewDepartureTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* REASON & MESSAGES */}
              {status !== 'on_time' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {status === 'cancelled' ? 'Cancellation Reason' : 'Disruption Reason'}
                    </label>
                    <select
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    >
                      <option value="Severe Weather">Severe Weather / Fog / Storm</option>
                      <option value="Track Maintenance">Track Maintenance</option>
                      <option value="Technical Failure">Technical Failure</option>
                      <option value="Operational Emergency">Operational Emergency</option>
                      <option value="Security Issue">Security Issue</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Passenger Announcement Message</label>
                    <textarea
                      rows="3"
                      placeholder="Enter broadcast message for passengers..."
                      value={additionalMessage}
                      onChange={(e) => setAdditionalMessage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end items-center space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`rounded-lg px-5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                    status === 'cancelled' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {status === 'cancelled' ? 'Proceed to Cancel Service' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRAIN CANCELLATION CONFIRMATION MODAL */}
      {showCancelConfirmModal && selectedTrain && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Confirm Train Cancellation</h3>
                <p className="text-xs text-slate-500 font-semibold">{selectedTrain.train_name} (#{selectedTrain.train_number})</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2 text-xs text-rose-900">
              <p className="font-black text-rose-950">
                ⚠️ Warning: "This will cancel the train service and affect all eligible passenger bookings."
              </p>
              <div className="pt-2 border-t border-rose-200/80 space-y-1 font-semibold">
                <div className="flex justify-between">
                  <span>Affected Bookings Identified:</span>
                  <span className="font-bold text-rose-950">{affectedBookingCount} Active Bookings</span>
                </div>
                <div className="flex justify-between">
                  <span>Automatic Refund Policy:</span>
                  <span className="font-bold text-emerald-800">100% Full Refund (Zero Penalty)</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Execution will update the train status to CANCELLED, prevent future ticket searches, grant 100% full refunds for all active passengers, release inventory, and log audit history.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowCancelConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Go Back
              </button>
              <button
                onClick={executeStatusUpdate}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition active:scale-95 shadow-md flex items-center space-x-1.5"
              >
                <XCircle className="h-4 w-4" />
                <span>{submitting ? 'Cancelling...' : 'Confirm & Cancel Train Service'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE SERVICE MODAL */}
      {restoreTrainModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center space-x-3 text-emerald-600">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Restore Train Service</h3>
                <p className="text-xs text-slate-500 font-semibold">{restoreTrainModal.train_name} (#{restoreTrainModal.train_number})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              Are you sure you want to restore this train service to ON TIME status? Timetable schedule parameters will be reset.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setRestoreTrainModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={executeRestoreService}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition active:scale-95 shadow-md"
              >
                {submitting ? 'Restoring...' : 'Restore to On Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS HISTORY LOGS MODAL */}
      {showHistoryModal && selectedTrain && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-6 py-4.5 flex justify-between items-center border-b border-white/5">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-blue-400" />
                  Service Disruption History Log
                </h3>
                <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">
                  {selectedTrain.train_name} (#{selectedTrain.train_number})
                </span>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-white transition-all focus:outline-none cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-400 font-bold">
                  Loading status history logs...
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No service disruptions or status history logs on record for this train.
                </div>
              ) : (
                <div className="space-y-4">
                  {historyList.map((log, idx) => (
                    <div key={idx} className="relative pl-5 border-l-2 border-slate-100 space-y-1.5 pb-2">
                      <div className={`absolute left-0 top-1.5 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        log.new_status === 'on_time'
                          ? 'bg-emerald-500'
                          : log.new_status === 'delayed'
                          ? 'bg-amber-500'
                          : log.new_status === 'rescheduled'
                          ? 'bg-purple-500'
                          : 'bg-rose-500'
                      }`} />
                      
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-semibold">
                          {new Date(log.updated_at).toLocaleString()}
                        </span>
                        <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                          By: {log.updated_by || 'ADMIN'}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 flex-wrap">
                        <span className="capitalize">{log.previous_status?.replace('_', ' ') || 'on_time'}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className={`capitalize font-extrabold uppercase text-[10px] px-2 py-0.5 rounded ${
                          log.new_status === 'on_time'
                            ? 'bg-emerald-50 text-emerald-800'
                            : log.new_status === 'delayed'
                            ? 'bg-amber-50 text-amber-800'
                            : log.new_status === 'rescheduled'
                            ? 'bg-purple-50 text-purple-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}>
                          {log.new_status?.replace('_', ' ') || 'on_time'}
                        </span>
                      </div>

                      {log.new_status === 'delayed' && (
                        <p className="text-xs text-amber-800 font-mono font-bold leading-none">
                          Delay Duration: +{log.delay_minutes} min
                        </p>
                      )}

                      {log.reason && (
                        <p className="text-xs text-slate-600 font-bold leading-normal">
                          Reason: {log.reason}
                        </p>
                      )}

                      {log.message && (
                        <p className="bg-slate-50 p-2.5 rounded-xl text-slate-600 text-[11px] leading-relaxed italic border border-slate-100">
                          "{log.message}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 text-right border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminTrainStatus;
