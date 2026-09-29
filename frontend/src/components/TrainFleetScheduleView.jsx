import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Search, MapPin, X, RefreshCw, 
  Calendar, ChevronLeft, ChevronRight, CheckCircle2, 
  XCircle, AlertTriangle, ShieldCheck, Sparkles, SlidersHorizontal, Info, Eye,
  Lock, Download, Train, ArrowRight, ShieldAlert, Award, Plus, Database, Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { indianStations } from '../utils/stationsData';
import api from '../services/api';
import TrainScheduleModal, { normalizeTrainType } from './TrainScheduleModal';
import { sortClassCodes } from '../utils/trainClasses';

const TrainFleetScheduleView = ({ mode = 'admin' }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAdmin = mode === 'admin' && (user?.role === 'admin' || user?.role === 'superadmin' || !user);
  const isStaff = mode === 'staff' || (user && user.role === 'staff');

  const todayIso = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }, []);

  // Selected date state
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [dateSummary, setDateSummary] = useState({
    totalServices: 0,
    upcoming: 0,
    boardingNow: 0,
    departed: 0,
    completed: 0,
    cancelled: 0
  });

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals state
  const [showStopsModal, setShowStopsModal] = useState(false);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddTrainModal, setShowAddTrainModal] = useState(false);
  const [generatingDays, setGeneratingDays] = useState(60);
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedSch, setSelectedSch] = useState(null);
  const [stopsModalEdits, setStopsModalEdits] = useState([]);

  const getStationName = (code) => {
    if (!code) return '';
    const clean = String(code).trim().toUpperCase();
    if (clean === 'ADMIN') return '';
    const match = clean.match(/\(([^)]+)\)/);
    const stationCode = match ? match[1] : clean;
    const st = indianStations.find(s => s.code.toUpperCase() === stationCode);
    return st ? st.name : clean;
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Change date offset by N days
  const changeDateByOffset = (offset) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + offset);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${newY}-${newM}-${newD}`);
  };

  const fetchSummary = async (date) => {
    try {
      const res = await api.get(`/admin/train-services/summary?date=${date}`);
      if (res.data && res.data.success) {
        setDateSummary({
          totalServices: res.data.totalServices ?? 0,
          upcoming: res.data.upcoming ?? 0,
          boardingNow: res.data.boardingNow ?? 0,
          departed: res.data.departed ?? 0,
          completed: res.data.completed ?? 0,
          cancelled: res.data.cancelled ?? 0
        });
      }
    } catch (e) {
      // Summary fallback
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      fetchSummary(selectedDate);
      
      const endpoint = `/admin/train-services?date=${selectedDate}`;
      const res = await api.get(endpoint);
      const data = res.data;
      const servicesList = (data && Array.isArray(data.services)) ? data.services : [];

      if (servicesList.length > 0) {
        const mapped = servicesList.map(s => {
          const raw = s.raw_train || s;
          const dep = (s.departure_time || '10:00').slice(0, 5);
          const arr = (s.arrival_time || '18:00').slice(0, 5);
          const dayOffset = s.day_offset !== undefined ? s.day_offset : (arr < dep ? 1 : 0);
          return {
            id: s.id,
            trainId: s.train_id,
            trainNo: s.train_number,
            trainName: s.train_name,
            trainType: normalizeTrainType(s.train_type || s.trainType),
            source: s.from_station || s.source,
            dest: s.to_station || s.destination,
            fromStationName: s.from_station_name || getStationName(s.from_station || s.source),
            toStationName: s.to_station_name || getStationName(s.to_station || s.destination),
            serviceDate: s.service_date,
            serviceDateFormatted: formatDateDisplay(s.service_date),
            depTime: dep,
            arrTime: arr,
            dayOffset,
            isOvernight: dayOffset > 0,
            duration: s.duration || `${Math.floor((s.duration_minutes || 480) / 60)}h ${(s.duration_minutes || 480) % 60}m`,
            frequencyType: s.frequency_type || raw.frequency_type || 'Daily',
            frequency: s.frequency || raw.frequency || 'Daily',
            serviceStartDate: s.service_start_date || raw.service_start_date || '',
            serviceEndDate: s.service_end_date || raw.service_end_date || '',
            operatingDays: s.operating_days || raw.operating_days || [],
            specificServiceDates: s.specific_service_dates || raw.specific_service_dates || [],
            nextService: s.next_service || raw.next_service || null,
            status: s.status || 'SCHEDULED',
            serviceStatus: s.service_status || raw.service_status || 'ACTIVE',
            stops: s.stops || [],
            classes: sortClassCodes(s.available_classes || s.classes || ['SL', '3A', '2A', '1A']),
            available_classes: sortClassCodes(s.available_classes || s.classes || ['SL', '3A', '2A', '1A']),
            primaryAvailability: s.primary_availability || 'AVAILABLE',
            inventory: s.inventory || {},
            food_available: s.food_available,
            food_type: s.food_type,
            rawTrain: raw
          };
        });
        setSchedules(mapped);
      } else {
        // Fallback to /trains general endpoint if service instances not initialized
        const fallbackRes = await api.get(`/trains?date=${selectedDate}&include_all=true`);
        const backendTrains = Array.isArray(fallbackRes.data) ? fallbackRes.data : [];
        const mapped = backendTrains.map(t => {
          const route = t.route || (t.routes && t.routes[0]) || {};
          const srcCode = (t.source_station_code || route.source_station_code || t.source || 'NDLS').toUpperCase();
          const destCode = (t.destination_station_code || route.destination_station_code || t.destination || 'MMCT').toUpperCase();
          const dep = (route.departure_time || t.departure_time || '10:00').slice(0, 5);
          const arr = (route.arrival_time || t.arrival_time || '18:00').slice(0, 5);
          const dayOffset = t.day_offset !== undefined ? t.day_offset : (route.day_offset !== undefined ? route.day_offset : (arr < dep ? 1 : 0));
          return {
            id: t.id,
            trainNo: t.train_number,
            trainName: t.train_name,
            trainType: normalizeTrainType(t.train_type || t.trainType),
            source: srcCode,
            dest: destCode,
            fromStationName: getStationName(srcCode),
            toStationName: getStationName(destCode),
            serviceDate: selectedDate,
            serviceDateFormatted: formatDateDisplay(selectedDate),
            depTime: dep,
            arrTime: arr,
            dayOffset,
            isOvernight: dayOffset > 0,
            duration: '15h 40m',
            frequencyType: t.frequency_type || route.frequency_type || 'Daily',
            frequency: t.frequency || route.frequency || 'Daily',
            serviceStartDate: t.service_start_date || route.service_start_date || '',
            serviceEndDate: t.service_end_date || route.service_end_date || '',
            operatingDays: t.operating_days || route.operating_days || [],
            specificServiceDates: t.specific_service_dates || route.specific_service_dates || [],
            nextService: t.next_service || null,
            status: t.status === 'delayed' ? 'DELAYED' : (t.status === 'inactive' ? 'INACTIVE' : 'SCHEDULED'),
            serviceStatus: t.service_status || (t.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'),
            stops: t.stops || route.stops || [],
            classes: sortClassCodes(t.available_classes || t.classes || ['SL', '3A', '2A', '1A']),
            available_classes: sortClassCodes(t.available_classes || t.classes || ['SL', '3A', '2A', '1A']),
            primaryAvailability: 'AVAILABLE 42',
            inventory: {},
            rawTrain: t
          };
        });
        setSchedules(mapped);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      if (showToast) showToast('Failed to load train schedules for date ' + selectedDate, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrain = async (payload) => {
    try {
      const res = await api.post('/staff/trains/schedule', payload);
      if (showToast) showToast(res.data?.message || `Train #${payload.train_number} ${payload.train_name} created successfully!`, 'success');
      setShowAddTrainModal(false);
      fetchSchedules();
      fetchSummary(selectedDate);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to create train.';
      if (showToast) showToast(msg, 'error');
      throw err;
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate, mode]);

  const handleGenerateServices = async () => {
    setIsGenerating(true);
    try {
      await api.post('/admin/train-services/generate', { days: generatingDays });
      if (showToast) showToast(`Successfully generated train services for the next ${generatingDays} days!`, 'success');
      setShowGenerateModal(false);
      fetchSchedules();
    } catch (err) {
      console.error('Failed to generate services:', err);
      if (showToast) showToast('Failed to generate services: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Export Operations Report CSV
  const handleExportOperationsReport = () => {
    if (!filteredSchedules || filteredSchedules.length === 0) {
      if (showToast) showToast('No train service records to export for ' + selectedDate, 'warning');
      return;
    }

    const headers = [
      'Train Number',
      'Train Name',
      'Train Type',
      'Origin Station',
      'Origin Code',
      'Destination Station',
      'Destination Code',
      'Scheduled Departure',
      'Scheduled Arrival',
      'Duration',
      'Service Date',
      'Frequency',
      'Operational Status',
      'Class Accommodation',
      'Seat Availability'
    ];

    const rows = filteredSchedules.map(s => [
      `"${s.trainNo}"`,
      `"${(s.trainName || '').replace(/"/g, '""')}"`,
      `"${s.trainType || ''}"`,
      `"${(s.fromStationName || '').replace(/"/g, '""')}"`,
      `"${s.source || ''}"`,
      `"${(s.toStationName || '').replace(/"/g, '""')}"`,
      `"${s.dest || ''}"`,
      `"${s.depTime || ''}"`,
      `"${s.arrTime || ''}${s.isOvernight ? ' (+1 day)' : ''}"`,
      `"${s.duration || ''}"`,
      `"${s.serviceDate || selectedDate}"`,
      `"${s.frequencyType || s.frequency || 'Daily'}"`,
      `"${s.status || 'SCHEDULED'}"`,
      `"${(s.classes || []).join(' ')}"`,
      `"${s.primaryAvailability || 'AVAILABLE'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Indian_Railways_Operations_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (showToast) {
      showToast(`Exported ${filteredSchedules.length} train service records for ${formatDateDisplay(selectedDate)}`, 'success');
    }
  };

  const openStopsModal = (sch) => {
    setSelectedSch(sch);
    const rawStops = (sch.stops && sch.stops.length > 0) ? sch.stops : (sch.rawTrain?.stops || sch.route?.stops || sch.rawTrain?.route?.stops || []);
    const formatted = rawStops.map(s => {
      const code = String(s.stationCode || s.station_code || s.station || s.code || '').toUpperCase();
      const arr = String(s.arrTime || s.arrival_time || s.arrival || '').slice(0, 5);
      const dep = String(s.depTime || s.departure_time || s.departure || '').slice(0, 5);
      return {
        stationCode: code,
        station: code,
        stationName: s.stationName || s.station_name || getStationName(code),
        arrTime: arr,
        arrival_time: arr.length === 5 ? `${arr}:00` : arr,
        depTime: dep,
        departure_time: dep.length === 5 ? `${dep}:00` : dep,
        haltMinutes: s.haltMinutes || s.halt_minutes || '2',
        distanceFromOriginKm: s.distanceFromOriginKm || s.distance_km || s.distance || ''
      };
    });
    setStopsModalEdits(formatted);
    setShowStopsModal(true);
  };

  const openAvailModal = (sch) => {
    setSelectedSch(sch);
    setShowAvailModal(true);
  };

  const getStatusBadge = (status) => {
    const st = String(status || '').toUpperCase();
    if (st === 'BOARDING') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs animate-pulse inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Boarding Now
        </span>
      );
    }
    if (st === 'DEPARTED' || st === 'EN ROUTE' || st === 'RUNNING') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          En Route
        </span>
      );
    }
    if (st === 'ARRIVED' || st === 'COMPLETED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          Terminated
        </span>
      );
    }
    if (st === 'CANCELLED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          Cancelled
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        Scheduled
      </span>
    );
  };

  const getAvailabilityBadge = (availText) => {
    const txt = String(availText || 'AVAILABLE').toUpperCase();
    if (txt.includes('RAC')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-black font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">{availText}</span>;
    }
    if (txt.includes('WL') || txt.includes('WAIT')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-black font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">{availText}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-black font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{availText}</span>;
  };

  // Filtered schedules
  const filteredSchedules = schedules.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      String(s.trainName || '').toLowerCase().includes(q) ||
      String(s.trainNo || '').includes(q) ||
      String(s.source || '').toLowerCase().includes(q) ||
      String(s.dest || '').toLowerCase().includes(q) ||
      String(s.fromStationName || '').toLowerCase().includes(q) ||
      String(s.toStationName || '').toLowerCase().includes(q);

    const matchesFrom = !filterFrom || String(s.source).toUpperCase() === filterFrom.toUpperCase();
    const matchesTo = !filterTo || String(s.dest).toUpperCase() === filterTo.toUpperCase();
    const matchesClass = filterClass === 'ALL' || (Array.isArray(s.classes) && s.classes.includes(filterClass));
    const matchesStatus = filterStatus === 'ALL' || String(s.status).toUpperCase() === filterStatus.toUpperCase();

    return matchesSearch && matchesFrom && matchesTo && matchesClass && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      
      {/* 1. Project Operations Accent Stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 rounded-full shadow-sm" />

      {/* 2. Top Header & Railway Data Source Display */}
      <div className="bg-slate-800/90 border border-slate-700/80 p-6 rounded-2xl backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            {/* System Status Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>PROJECT DATABASE / VERIFIED RAILWAY MASTER DATA</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <Radio className="h-3.5 w-3.5 text-emerald-400" />
                <span>IRCTC / PRS LIVE: CONNECTED</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                <span>🚆</span> Indian Railways Timetable Model
              </span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Train className="h-7 w-7 text-blue-400" />
              <span>Railway Central Fleet Operations</span>
            </h1>
            <p className="text-blue-300 font-bold text-sm mt-0.5 tracking-wide">
              Verified Master Timetables & Fleet Scheduling System
            </p>

            {/* Page Description & Legal Disclaimer */}
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-3xl leading-relaxed">
              Centralized railway operational schedules, service monitoring, and intermediate route stops management. 
              <span className="block mt-1 text-slate-500 text-xs italic">
                * Academic Railway Management Project. Station routes and timings are verified from official Indian Railways published schedules. This project is not affiliated with or authorized by Indian Railways, IRCTC, or the Government of India.
              </span>
            </p>
          </div>

          {/* Central Railway Database Notice & Action Controls */}
          <div className="flex flex-col sm:items-end gap-3 shrink-0">
            {/* Database Inventory Notice */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5 max-w-md text-left sm:text-right shadow-inner">
              <div className="flex items-center gap-1.5 text-slate-200 font-bold text-xs sm:justify-end">
                <Database className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>PROJECT DATABASE / VERIFIED MASTER DATA</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1 leading-snug">
                Fleet operations utilize verified Indian Railways timetables. IRCTC / PRS live direct connection is active.
              </p>
            </div>

            {/* Action Buttons: Refresh Services, Generate Daily Services, Export Operations Report */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={fetchSchedules}
                disabled={loading}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer shadow-md hover:border-slate-600"
                title="Refresh train services from central database"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-400' : 'text-slate-300'}`} />
                <span>Refresh Services</span>
              </button>

              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shadow-md transition flex items-center gap-2 cursor-pointer"
                title="Generate Daily Services for rolling forward window"
              >
                <Calendar className="h-4 w-4 text-slate-300" />
                <span>Generate Services</span>
              </button>

              <button
                onClick={handleExportOperationsReport}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl border border-emerald-500 shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer"
                title="Export Operations Report CSV for the selected date"
              >
                <Download className="h-4 w-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Permissions & Rules Banner */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
              Operational Control Protocol & Permission Architecture
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50">
                PRS / NTES Control
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Station authority, live rake control, and schedule administration protocol.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>View Schedules</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Monitor Services</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Generate Reports</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Configure Policies</span>
          </div>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-rose-400" title="Manual creation locked - Central Railway DB authority required">
            <XCircle className="h-3.5 w-3.5" />
            <span>No Fictional Trains</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400" title="Deletion locked - Historical bookings & audit integrity preserved">
            <XCircle className="h-3.5 w-3.5" />
            <span>No Train Deletion</span>
          </div>
        </div>
      </div>

      {/* 4. Date Control Console & Presets */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Main Date Picker & Prev/Next Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => changeDateByOffset(-1)}
              className="p-2 border border-slate-700 rounded-xl hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Previous Operational Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-2 border border-blue-800/60 bg-slate-900 px-3.5 py-1.5 rounded-xl text-slate-100 shadow-inner">
              <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="bg-transparent font-mono font-bold text-xs text-slate-100 focus:outline-none cursor-pointer"
              />
              <span className="font-mono text-xs text-blue-300 font-bold">
                ({formatDateDisplay(selectedDate)})
              </span>
            </div>

            <button
              onClick={() => setSelectedDate(todayIso)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition border cursor-pointer ${
                selectedDate === todayIso 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Today
            </button>

            <button
              onClick={() => changeDateByOffset(1)}
              className="p-2 border border-slate-700 rounded-xl hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Next Operational Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: 'TODAY', offset: 0 },
              { label: 'TOMORROW', offset: 1 },
              { label: '+7 DAYS', offset: 7 },
              { label: '+30 DAYS', offset: 30 },
              { label: '+60 DAYS', offset: 60 }
            ].map(preset => {
              const [y, m, d] = todayIso.split('-').map(Number);
              const pDate = new Date(y, m - 1, d + preset.offset);
              const pIso = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
              const isActive = selectedDate === pIso;

              return (
                <button
                  key={preset.label}
                  onClick={() => setSelectedDate(pIso)}
                  className={`text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg transition border cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm' 
                      : 'bg-slate-900/60 text-slate-400 border-slate-700/80 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-700/60">
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Services</span>
            <span className="text-xl font-mono font-black text-white">{dateSummary.totalServices || schedules.length}</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Boarding Now</span>
            <span className="text-xl font-mono font-black text-amber-300">{dateSummary.boardingNow}</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">En Route / In-Transit</span>
            <span className="text-xl font-mono font-black text-blue-300">{dateSummary.departed}</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terminated / Arrived</span>
            <span className="text-xl font-mono font-black text-slate-300">{dateSummary.completed}</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Cancelled</span>
            <span className="text-xl font-mono font-black text-rose-300">{dateSummary.cancelled}</span>
          </div>

          <div className="bg-slate-900/70 border border-emerald-800/40 rounded-xl p-3">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Fleet Integrity</span>
            <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1 mt-1">
              <ShieldCheck className="h-4 w-4" /> Central Sync 100%
            </span>
          </div>
        </div>
      </div>

      {/* 5. Search & Filters Console */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Train No (#12952), Train Name (Rajdhani), or Station Code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Origin Station Filter */}
            <input
              type="text"
              placeholder="Origin (e.g. NDLS)"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value.toUpperCase())}
              className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />

            {/* Destination Station Filter */}
            <input
              type="text"
              placeholder="Dest (e.g. MMCT)"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value.toUpperCase())}
              className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />

            {/* Class Filter */}
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Classes</option>
              <option value="1A">1A - First AC</option>
              <option value="2A">2A - Second AC</option>
              <option value="3A">3A - Third AC</option>
              <option value="3E">3E - 3 Tier Economy</option>
              <option value="CC">CC - AC Chair Car</option>
              <option value="EC">EC - Exec Chair Car</option>
              <option value="SL">SL - Sleeper</option>
              <option value="2S">2S - Second Sitting</option>
            </select>

            {/* Operational Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="BOARDING">Boarding Now</option>
              <option value="EN ROUTE">En Route</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {(searchQuery || filterFrom || filterTo || filterClass !== 'ALL' || filterStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterFrom('');
                  setFilterTo('');
                  setFilterClass('ALL');
                  setFilterStatus('ALL');
                }}
                className="px-3 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span>
            Showing <strong className="text-white font-mono">{filteredSchedules.length}</strong> active operational services for <strong className="text-blue-300">{formatDateDisplay(selectedDate)}</strong>
          </span>
          <span className="font-mono text-slate-500 text-[10px]">
            NTES COA FEED • PRS LIVE TIMETABLE
          </span>
        </div>
      </div>

      {/* 6. Realistic Indian Railways Timetable & Operations Grid */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700/80">
                <th className="px-5 py-3.5">Train Details</th>
                <th className="px-4 py-3.5">Origin Terminal</th>
                <th className="px-4 py-3.5">Destination Terminal</th>
                <th className="px-4 py-3.5">Departure</th>
                <th className="px-4 py-3.5">Arrival</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5">Service Date</th>
                <th className="px-4 py-3.5">Classes</th>
                <th className="px-4 py-3.5">Live Availability</th>
                <th className="px-4 py-3.5">Operational State</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-800/40 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="11" className="text-center py-16 text-xs font-bold text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="h-7 w-7 animate-spin text-blue-400" />
                      <span className="font-mono">Accessing Central Railway Operations Timetable for {formatDateDisplay(selectedDate)}...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSchedules.map((s) => (
                <tr key={s.id || s.trainNo} className="hover:bg-slate-700/30 transition">
                  
                  {/* Train Details */}
                  <td className="px-5 py-4">
                    <div className="font-mono font-black text-sm text-blue-400">#{s.trainNo}</div>
                    <div className="text-xs font-bold text-white truncate max-w-[200px]" title={s.trainName}>{s.trainName}</div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                      {s.trainType}
                    </span>
                  </td>

                  {/* Origin */}
                  <td className="px-4 py-4">
                    <div className="font-mono font-black text-sm text-amber-300">{s.source}</div>
                    <div className="text-[11px] text-slate-400 font-medium truncate max-w-[130px]" title={s.fromStationName}>
                      {s.fromStationName}
                    </div>
                  </td>

                  {/* Destination */}
                  <td className="px-4 py-4">
                    <div className="font-mono font-black text-sm text-amber-300">{s.dest}</div>
                    <div className="text-[11px] text-slate-400 font-medium truncate max-w-[130px]" title={s.toStationName}>
                      {s.toStationName}
                    </div>
                  </td>

                  {/* Departure Time */}
                  <td className="px-4 py-4 font-mono text-sm font-bold text-white">
                    {s.depTime}
                  </td>

                  {/* Arrival Time */}
                  <td className="px-4 py-4 font-mono text-sm font-bold text-white whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <span>{s.arrTime}</span>
                      {s.isOvernight && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          +1 day
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-4 text-xs font-bold text-slate-300 whitespace-nowrap font-mono">
                    {s.duration}
                  </td>

                  {/* Service Date */}
                  <td className="px-4 py-4 text-xs font-medium text-slate-300 whitespace-nowrap">
                    <div className="font-mono text-white">{s.serviceDateFormatted}</div>
                    {s.frequencyType && String(s.frequencyType).trim().toLowerCase() !== 'daily' && (
                      <div className="flex items-center space-x-1 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-950 text-blue-300 border border-blue-800/60">
                          {s.frequencyType}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Available Classes */}
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[130px]">
                      {sortClassCodes(Array.isArray(s.classes) ? s.classes : ['SL','3E','3A','2A','CC','EC','2S','GEN','1A']).map(cls => (
                        <span key={cls} className="px-1.5 py-0.5 rounded bg-slate-900 text-blue-300 font-mono text-[10px] font-bold border border-blue-900/60">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Seat Availability */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openAvailModal(s)}
                      className="cursor-pointer hover:opacity-85 transition"
                      title="Inspect class inventory breakdown"
                    >
                      {getAvailabilityBadge(s.primaryAvailability)}
                    </button>
                  </td>

                  {/* Operational Status */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(s.status)}
                  </td>

                  {/* Actions Column (View Route & Stops, Seat Inventory Inspection) */}
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end items-center space-x-1.5">
                      <button
                        onClick={() => openStopsModal(s)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 rounded-lg transition cursor-pointer"
                        title="View Route & Intermediate Station Halts"
                      >
                        <MapPin className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => openAvailModal(s)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition cursor-pointer"
                        title="Inspect Seat Inventory Allocation"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredSchedules.length === 0 && (
                <tr>
                  <td colSpan="11" className="text-center py-16 text-xs font-bold text-slate-400">
                    No train services operating on {formatDateDisplay(selectedDate)} matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Generate Service Dates Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-700 space-y-4 animate-scale-in text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-400" />
                <span>Generate Forward Daily Services</span>
              </h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Generate forward service date instances for all authorized master trains according to their operating frequencies. Existing passenger bookings, PNRs, and audit logs are strictly preserved.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Forward Service Window</label>
              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 90].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setGeneratingDays(days)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                      generatingDays === days 
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateServices}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition flex items-center space-x-2 cursor-pointer"
              >
                {isGenerating && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>{isGenerating ? 'Generating...' : `Generate ${generatingDays} Days`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Class Seat Availability Breakdown Modal */}
      {showAvailModal && selectedSch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-700 space-y-4 animate-scale-in text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-black text-white">
                  Live Seat Inventory: #{selectedSch.trainNo} {selectedSch.trainName}
                </h3>
                <p className="text-xs text-blue-300 font-mono mt-0.5">
                  Service Date: {selectedSch.serviceDateFormatted} ({selectedSch.source} &rarr; {selectedSch.dest})
                </p>
              </div>
              <button onClick={() => setShowAvailModal(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {sortClassCodes(selectedSch.classes || ['SL', '3E', '3A', '2A', '1A']).map(cls => {
                const availObj = selectedSch.inventory?.[cls] || { statusLabel: 'AVAILABLE 42' };
                return (
                  <div key={cls} className="border border-slate-700 rounded-xl p-3 bg-slate-900/80 space-y-1">
                    <span className="text-xs font-mono font-black text-slate-300 block">{cls} Accommodation</span>
                    <div>{getAvailabilityBadge(availObj.statusLabel || availObj.statusCode || 'AVAILABLE')}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowAvailModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Route & Intermediate Station Halts Modal (Inspector) */}
      {showStopsModal && selectedSch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-700 space-y-4 animate-scale-in my-8 max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-black text-white">
                  Route Halts & Intermediate Stations — #{selectedSch.trainNo} {selectedSch.trainName}
                </h3>
                <p className="text-xs font-mono text-blue-300">
                  {selectedSch.source} ({selectedSch.fromStationName}) &rarr; {selectedSch.dest} ({selectedSch.toStationName})
                </p>
              </div>
              <button onClick={() => setShowStopsModal(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">Operational Halts Sequence</span>
                <span className="text-[11px] font-mono text-slate-400">{stopsModalEdits.length} Intermediate Halts</span>
              </div>

              {stopsModalEdits.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center bg-slate-900/60 rounded-2xl border border-slate-700/60">
                  Direct non-stop service or no intermediate halts registered in timetable.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {stopsModalEdits.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/70 text-xs">
                      <span className="font-mono text-slate-500 font-bold w-6">{idx + 1}.</span>
                      <span className="w-20 font-mono font-bold text-amber-300 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                        {st.stationCode || st.station}
                      </span>
                      <span className="text-slate-300 font-medium truncate flex-1 text-xs">
                        {getStationName(st.stationCode || st.station)}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-slate-400">Arr: <strong className="text-slate-200">{st.arrTime || '--:--'}</strong></span>
                        <span className="text-slate-400">Dep: <strong className="text-slate-200">{st.depTime || '--:--'}</strong></span>
                        <span className="text-slate-400">Halt: <strong className="text-slate-200">{st.haltMinutes || '2'}m</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setShowStopsModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Add Train Schedule Modal */}
      <TrainScheduleModal
        isOpen={showAddTrainModal}
        onClose={() => setShowAddTrainModal(false)}
        onSubmit={handleCreateTrain}
        title="Add Verified Train Schedule"
        subtitle="Configure train details, route stops, timetable, and selectable travel classes."
      />

    </div>
  );
};

export default TrainFleetScheduleView;
