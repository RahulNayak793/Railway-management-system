import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, Filter, Ticket, User, Calendar, Clock, Eye, X, 
  CreditCard, CheckCircle2, AlertCircle, Phone, Mail, MapPin, FileText, 
  Download, RefreshCw, ChevronRight, ShieldCheck, DollarSign, Utensils,
  XCircle, AlertTriangle, ShieldAlert, ChevronDown, Layers, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { sortClassCodes } from '../utils/trainClasses';

const StaffBookings = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeTab, setActiveTab] = useState('passengers');

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [trainFilter, setTrainFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL, TODAY, TOMORROW, UPCOMING, PAST, CUSTOM
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [quotaFilter, setQuotaFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [groupBy, setGroupBy] = useState('none');

  // Quick Filter Chips State
  const [quickChip, setQuickChip] = useState(null); // 'TODAY', 'TOMORROW', 'UPCOMING', 'CONFIRMED', 'RAC', 'WL', 'CANCELLED', 'COMPLETED'

  // Sort State
  const [sortBy, setSortBy] = useState('journey_date_asc'); // journey_date_asc, journey_date_desc, booking_date_asc, booking_date_desc, train_no_asc, train_no_desc, train_name_asc, passenger_name_asc, passenger_name_desc, pnr_asc, class_asc, status_asc

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Mobile Filters Drawer State
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Cancel Modal State
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('Passenger Request');
  const [customReason, setCustomReason] = useState('');
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [overridePenalty, setOverridePenalty] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings?all=true');
      const rawData = Array.isArray(res.data) ? res.data : (res.data?.bookings || []);
      if (rawData && rawData.length > 0) {
        const mapped = rawData.map(b => {
          const firstAlloc = b.allocations?.[0] || {};
          const mappedPassengers = (b.allocations && b.allocations.length > 0) 
            ? b.allocations.map((a, i) => ({
                id: a.id || `alloc-${i}`,
                name: a.passenger_name || firstAlloc.passenger_name || 'Passenger ' + (i+1),
                age: a.passenger_age || 30,
                gender: a.passenger_gender || 'Male',
                seat: a.seat_number ? `Seat #${a.seat_number}` : (a.seat_id ? `Seat #${a.seat_id}` : 'Allocated'),
                coach: a.coach_number || a.coach_id || 'B1',
                berthType: a.berth_type || 'Lower Berth',
                status: b.status ? b.status.toUpperCase() : 'CONFIRMED',
                idType: 'Aadhaar Card',
                idNumber: 'XXXX-XXXX-4582',
                catering: 'Standard Meal'
              }))
            : [{
                id: 'alloc-0',
                name: b.passenger_name || b.primaryPassenger || 'Primary Passenger',
                age: 35,
                gender: 'Male',
                seat: 'Allocated Seat',
                coach: b.coach_number || 'B1',
                berthType: 'Lower Berth',
                status: b.status ? b.status.toUpperCase() : 'CONFIRMED',
                idType: 'Aadhaar Card',
                idNumber: 'XXXX-XXXX-4582',
                catering: 'Standard Meal'
              }];

          const totalFare = Number(b.total_fare || 1800);
          const rawStatus = String(b.status || 'CONFIRMED').toUpperCase();
          const todayStr = new Date().toISOString().split('T')[0];
          const travelDateStr = b.travel_date ? String(b.travel_date).split('T')[0] : '2026-09-16';

          let normStatus = 'CONFIRMED';
          if (rawStatus === 'CANCELLED' || rawStatus === 'AUTO_CANCELLED') normStatus = 'CANCELLED';
          else if (rawStatus === 'RAC') normStatus = 'RAC';
          else if (rawStatus === 'WAITLIST' || rawStatus === 'WAITING' || rawStatus === 'WL') normStatus = 'WAITLIST';
          else if (rawStatus === 'COMPLETED' || (travelDateStr && travelDateStr < todayStr)) normStatus = 'COMPLETED';

          const primaryPax = mappedPassengers[0]?.name || b.passenger_name || b.primaryPassenger || 'Passenger User';
          const pnrCode = b.pnr_number || b.pnr || b.id || 'PNR' + Math.floor(Math.random()*10000000);

          return {
            id: b.id,
            pnr: pnrCode,
            pnr_number: pnrCode,
            bookingDate: b.created_at ? new Date(b.created_at).toISOString().split('T')[0] : '2026-09-01',
            created_at: b.created_at || '2026-09-01T10:00:00.000Z',
            primaryPassenger: primaryPax,
            email: b.user_email || b.passenger_email || 'passenger@railway.com',
            phone: b.user_phone || '+91 9876543210',
            irctc_user_id: b.irctc_user_id || `IRCTC_${String(b.id || '1001').slice(-6)}`,
            trainNo: b.train?.train_number || b.train_number || '12051',
            trainName: b.train?.train_name || b.train_name || 'Express Train',
            sourceCode: b.route?.source_station_code || b.source_station_code || b.source || 'NDLS',
            destCode: b.route?.destination_station_code || b.destination_station_code || b.destination || 'MMCT',
            depTime: b.route?.departure_time || b.departure_time || '08:00',
            arrTime: b.route?.arrival_time || b.arrival_time || '20:00',
            journeyDate: b.travel_date || '2026-09-16',
            quota: (b.quota || 'GN').toUpperCase(),
            class: (b.coach_class || b.class || '3A').toUpperCase(),
            status: normStatus,
            paymentStatus: (b.payment?.status || b.payment_status || (normStatus === 'CANCELLED' ? 'REFUNDED' : 'PAID')).toUpperCase(),
            coach: mappedPassengers[0]?.coach || 'B1',
            seat: mappedPassengers[0]?.seat || 'Allocated',
            passengers: mappedPassengers,
            fareDetails: {
              baseFare: totalFare,
              taxGst: Math.round(totalFare * 0.05),
              reservationFee: 40,
              totalFare: totalFare + Math.round(totalFare * 0.05) + 40
            },
            payment: {
              txnId: b.payment?.transaction_id || 'TXN' + Math.floor(Math.random()*100000000),
              method: b.payment?.payment_method || 'Online Banking / UPI',
              status: (b.payment?.status || b.payment_status || (normStatus === 'CANCELLED' ? 'REFUNDED' : 'PAID')).toUpperCase(),
              timestamp: b.created_at ? new Date(b.created_at).toLocaleString('en-IN') : 'Completed'
            },
            raw: b
          };
        });
        setBookings(mapped);
      }
    } catch (err) {
      console.warn('API error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Compute unique trains & classes present in DB
  const availableTrains = useMemo(() => {
    const map = new Map();
    bookings.forEach(b => {
      const key = `${b.trainNo} - ${b.trainName}`;
      if (!map.has(key)) map.set(key, { number: b.trainNo, name: b.trainName, label: key });
    });
    return Array.from(map.values());
  }, [bookings]);

  const availableClasses = useMemo(() => {
    const set = new Set();
    bookings.forEach(b => { if (b.class) set.add(b.class); });
    const defaults = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
    const active = defaults.filter(c => set.has(c) || bookings.length === 0);
    return sortClassCodes(active.length > 0 ? active : Array.from(set));
  }, [bookings]);

  // Apply Search, Filters, Quick Chips & Sort
  const processedBookings = useMemo(() => {
    let result = [...bookings];

    // 1. Quick Filter Chips Override
    let activeDateFilter = dateFilter;
    let activeStatusFilter = statusFilter;

    if (quickChip) {
      if (['TODAY', 'TOMORROW', 'UPCOMING'].includes(quickChip)) {
        activeDateFilter = quickChip;
      } else if (['CONFIRMED', 'RAC', 'WAITLIST', 'CANCELLED', 'COMPLETED'].includes(quickChip)) {
        activeStatusFilter = quickChip;
      }
    }

    // 2. Search Box Filter
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(b => {
        const pnrMatch = b.pnr.toLowerCase().includes(q);
        const idMatch = b.id && b.id.toLowerCase().includes(q);
        const paxMatch = b.primaryPassenger.toLowerCase().includes(q);
        const emailMatch = b.email.toLowerCase().includes(q);
        const phoneMatch = b.phone.includes(q);
        const trainNoMatch = b.trainNo.toLowerCase().includes(q);
        const trainNameMatch = b.trainName.toLowerCase().includes(q);
        const coachMatch = b.coach.toLowerCase().includes(q);
        const seatMatch = b.seat.toLowerCase().includes(q);
        const irctcMatch = b.irctc_user_id.toLowerCase().includes(q);
        
        const paxManifestMatch = b.passengers.some(p => 
          p.name.toLowerCase().includes(q) || 
          p.seat.toLowerCase().includes(q)
        );

        return pnrMatch || idMatch || paxMatch || emailMatch || phoneMatch || trainNoMatch || trainNameMatch || coachMatch || seatMatch || irctcMatch || paxManifestMatch;
      });
    }

    // 3. Train Filter
    if (trainFilter !== 'ALL') {
      result = result.filter(b => `${b.trainNo} - ${b.trainName}` === trainFilter || b.trainNo === trainFilter);
    }

    // 4. Journey Date Filter
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    if (activeDateFilter === 'TODAY') {
      result = result.filter(b => b.journeyDate === todayStr);
    } else if (activeDateFilter === 'TOMORROW') {
      result = result.filter(b => b.journeyDate === tomorrowStr);
    } else if (activeDateFilter === 'UPCOMING') {
      result = result.filter(b => b.journeyDate >= todayStr && b.status !== 'CANCELLED' && b.status !== 'AUTO_CANCELLED');
    } else if (activeDateFilter === 'PAST') {
      result = result.filter(b => b.journeyDate < todayStr);
    } else if (activeDateFilter === 'CUSTOM') {
      if (fromDate) result = result.filter(b => b.journeyDate >= fromDate);
      if (toDate) result = result.filter(b => b.journeyDate <= toDate);
    }

    // 5. Booking Status Filter
    if (activeStatusFilter !== 'ALL') {
      if (activeStatusFilter === 'COMPLETED') {
        result = result.filter(b => b.status === 'COMPLETED' || (b.journeyDate < todayStr && b.status !== 'CANCELLED' && b.status !== 'AUTO_CANCELLED'));
      } else if (activeStatusFilter === 'UPCOMING') {
        result = result.filter(b => b.journeyDate >= todayStr && b.status !== 'CANCELLED' && b.status !== 'AUTO_CANCELLED');
      } else {
        result = result.filter(b => b.status === activeStatusFilter);
      }
    }

    // 6. Class Filter
    if (classFilter !== 'ALL') {
      result = result.filter(b => b.class === classFilter);
    }

    // 7. Quota Filter
    if (quotaFilter !== 'ALL') {
      result = result.filter(b => b.quota.includes(quotaFilter));
    }

    // 8. Payment Status Filter
    if (paymentStatusFilter !== 'ALL') {
      result = result.filter(b => {
        const ps = b.paymentStatus;
        if (paymentStatusFilter === 'PAID') return ps === 'PAID' || ps === 'SUCCESS' || ps === 'COMPLETED';
        if (paymentStatusFilter === 'PENDING') return ps === 'PENDING' || ps === 'INITIATED';
        if (paymentStatusFilter === 'FAILED') return ps === 'FAILED';
        if (paymentStatusFilter === 'REFUNDED') return ps === 'REFUNDED';
        if (paymentStatusFilter === 'PARTIALLY_REFUNDED') return ps === 'PARTIALLY_REFUNDED' || ps === 'PARTIALLY REFUNDED';
        return ps === paymentStatusFilter;
      });
    }

    // 9. Sorting
    result.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'journey_date_asc':
          valA = a.journeyDate; valB = b.journeyDate; break;
        case 'journey_date_desc':
          valA = b.journeyDate; valB = a.journeyDate; break;
        case 'booking_date_asc':
          valA = a.created_at; valB = b.created_at; break;
        case 'booking_date_desc':
          valA = b.created_at; valB = a.created_at; break;
        case 'train_no_asc':
          valA = a.trainNo; valB = b.trainNo; break;
        case 'train_no_desc':
          valA = b.trainNo; valB = a.trainNo; break;
        case 'train_name_asc':
          valA = a.trainName; valB = b.trainName; break;
        case 'passenger_name_asc':
          valA = a.primaryPassenger; valB = b.primaryPassenger; break;
        case 'passenger_name_desc':
          valA = b.primaryPassenger; valB = a.primaryPassenger; break;
        case 'pnr_asc':
          valA = a.pnr; valB = b.pnr; break;
        case 'class_asc':
          valA = a.class; valB = b.class; break;
        case 'status_asc':
          valA = a.status; valB = b.status; break;
        default:
          valA = a.journeyDate; valB = b.journeyDate;
      }
      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    });

    return result;
  }, [bookings, searchTerm, trainFilter, dateFilter, fromDate, toDate, statusFilter, classFilter, quotaFilter, paymentStatusFilter, quickChip, sortBy]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, trainFilter, dateFilter, fromDate, toDate, statusFilter, classFilter, quotaFilter, paymentStatusFilter, quickChip, sortBy, itemsPerPage]);

  // Group By Processing
  const groupedBookings = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = {};
    processedBookings.forEach(b => {
      let key = 'Other';
      if (groupBy === 'train') key = `${b.trainNo} – ${b.trainName}`;
      else if (groupBy === 'journey_date') key = b.journeyDate;
      else if (groupBy === 'class') key = `${b.class} Class`;
      else if (groupBy === 'status') key = b.status;

      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return groups;
  }, [processedBookings, groupBy]);

  // Pagination Calculation
  const totalRecords = processedBookings.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBookings = useMemo(() => {
    return processedBookings.slice(startIndex, startIndex + itemsPerPage);
  }, [processedBookings, startIndex, itemsPerPage]);

  // Reset All Filters
  const handleClearAllFilters = () => {
    setSearchTerm('');
    setTrainFilter('ALL');
    setDateFilter('ALL');
    setFromDate('');
    setToDate('');
    setStatusFilter('ALL');
    setClassFilter('ALL');
    setQuotaFilter('ALL');
    setPaymentStatusFilter('ALL');
    setQuickChip(null);
    setGroupBy('none');
    setSortBy('journey_date_asc');
    setCurrentPage(1);
  };

  // Header click sorting toggle
  const handleHeaderSort = (key) => {
    if (key === 'journeyDate') {
      setSortBy(sortBy === 'journey_date_asc' ? 'journey_date_desc' : 'journey_date_asc');
    } else if (key === 'pnr') {
      setSortBy(sortBy === 'pnr_asc' ? 'booking_date_desc' : 'pnr_asc');
    } else if (key === 'passenger') {
      setSortBy(sortBy === 'passenger_name_asc' ? 'passenger_name_desc' : 'passenger_name_asc');
    } else if (key === 'train') {
      setSortBy(sortBy === 'train_no_asc' ? 'train_no_desc' : 'train_no_asc');
    } else if (key === 'class') {
      setSortBy(sortBy === 'class_asc' ? 'journey_date_asc' : 'class_asc');
    } else if (key === 'status') {
      setSortBy(sortBy === 'status_asc' ? 'journey_date_asc' : 'status_asc');
    }
  };

  // Metrics KPI Calculation
  const todayStr = new Date().toISOString().split('T')[0];
  const totalConfirmed = bookings.filter(b => b.status === 'CONFIRMED').length;
  const totalRAC = bookings.filter(b => b.status === 'RAC').length;
  const totalWaiting = bookings.filter(b => b.status === 'WAITLIST').length;
  const totalCancelled = bookings.filter(b => b.status === 'CANCELLED' || b.status === 'AUTO_CANCELLED').length;
  const totalCompleted = bookings.filter(b => b.status === 'COMPLETED' || (b.journeyDate < todayStr && b.status !== 'CANCELLED' && b.status !== 'AUTO_CANCELLED')).length;
  const totalUpcoming = bookings.filter(b => b.journeyDate >= todayStr && b.status !== 'CANCELLED' && b.status !== 'AUTO_CANCELLED').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.fareDetails?.totalFare || 0), 0);

  // Policy calculation for cancel modal
  const calculatedCancelDetails = useMemo(() => {
    if (!cancelModalBooking) return { originalFare: 0, penalty: 0, refundAmount: 0 };
    const totalFare = cancelModalBooking.fareDetails?.totalFare || 0;
    
    if (isAdminOverride) {
      const penalty = Math.min(totalFare, Math.max(0, Number(overridePenalty || 0)));
      const refundAmount = Math.max(0, totalFare - penalty);
      return { originalFare: totalFare, penalty, refundAmount };
    }

    const now = new Date();
    const journeyDate = new Date(cancelModalBooking.journeyDate || now);
    const diffHours = (journeyDate - now) / (1000 * 60 * 60);

    let penalty = 0;
    if (diffHours > 48) {
      penalty = Math.min(totalFare, 240);
    } else if (diffHours >= 12) {
      penalty = Math.round(totalFare * 0.25);
    } else if (diffHours >= 4) {
      penalty = Math.round(totalFare * 0.50);
    } else {
      penalty = totalFare;
    }

    const refundAmount = Math.max(0, totalFare - penalty);
    return { originalFare: totalFare, penalty, refundAmount };
  }, [cancelModalBooking, isAdminOverride, overridePenalty]);

  const handleOpenCancelModal = (bk) => {
    setCancelModalBooking(bk);
    setCancelReason('Passenger Request');
    setCustomReason('');
    setIsAdminOverride(false);
    setOverridePenalty(0);
  };

  const handleExecuteCancel = async () => {
    if (!cancelModalBooking) return;
    const finalReason = cancelReason === 'Other' ? customReason : cancelReason;

    if (!finalReason || !finalReason.trim()) {
      showToast('Please select or specify a cancellation reason.', 'error');
      return;
    }

    setCancelling(true);
    try {
      await api.put(`/bookings/${cancelModalBooking.id || cancelModalBooking.pnr}/cancel`, {
        reason: finalReason,
        cancellation_reason: finalReason,
        is_override: isAdminOverride,
        override_penalty: overridePenalty,
        refund_amount: calculatedCancelDetails.refundAmount
      });

      showToast(`Ticket #${cancelModalBooking.pnr} cancelled successfully. Refund of ₹${calculatedCancelDetails.refundAmount.toLocaleString()} initiated.`, 'success');
      setCancelModalBooking(null);
      if (selectedBooking && selectedBooking.pnr === cancelModalBooking.pnr) {
        setSelectedBooking(null);
      }
      fetchBookings();
    } catch (err) {
      console.error('Cancellation error:', err);
      showToast('Cancellation failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-primary-50 text-primary-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-primary-200">
              Railway Booking Management
            </span>
            <span className="text-xs text-slate-400 font-bold">• Advanced Dossier Inspection</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Master Passenger Booking Directory
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Search, filter, sort, group, and inspect railway reservations across trains, dates, classes, and quotas.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchBookings} 
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition active:scale-95 border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { id: 'TOTAL', label: 'Total Bookings', value: bookings.length, sub: 'Active PNR Database', color: 'text-blue-600 bg-blue-500/10 border-blue-100', icon: BookOpen },
          { id: 'UPCOMING', label: 'Upcoming Journeys', value: totalUpcoming, sub: 'Scheduled Travel', color: 'text-cyan-600 bg-cyan-500/10 border-cyan-100', icon: Clock },
          { id: 'COMPLETED', label: 'Completed Journeys', value: totalCompleted, sub: 'Travel Concluded', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-100', icon: CheckCircle2 },
          { id: 'CONFIRMED', label: 'Confirmed Passengers', value: totalConfirmed, sub: 'Seats Reserved', color: 'text-indigo-600 bg-indigo-500/10 border-indigo-100', icon: ShieldCheck },
          { id: 'CANCELLED', label: 'Cancelled Bookings', value: totalCancelled, sub: 'Refund Processed', color: 'text-rose-600 bg-rose-500/10 border-rose-100', icon: XCircle },
          { id: 'REVENUE', label: 'Total Ticket Value', value: `₹${totalRevenue.toLocaleString('en-IN')}`, sub: 'Audited Value', color: 'text-purple-600 bg-purple-500/10 border-purple-100', icon: DollarSign }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          const isActive = quickChip === stat.id;

          return (
            <div
              key={idx}
              onClick={() => {
                if (['UPCOMING', 'COMPLETED', 'CONFIRMED', 'CANCELLED'].includes(stat.id)) {
                  setQuickChip(isActive ? null : stat.id);
                }
              }}
              className={`bg-white border p-3.5 rounded-3xl flex flex-col justify-between shadow-xs hover:shadow-md transition cursor-pointer ${
                isActive ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/20' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">{stat.label}</span>
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${stat.color} font-bold shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <span className="text-lg font-black text-slate-800 block font-mono">{stat.value}</span>
                <span className="text-[9.5px] text-slate-400 font-bold block mt-0.5">{stat.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* QUICK FILTER CHIPS */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-lg space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            Quick Filter Chips
          </span>
          <span className="text-[11px] font-bold text-slate-300">
            Showing <strong className="text-white font-mono">{processedBookings.length}</strong> of <strong className="text-slate-300 font-mono">{bookings.length}</strong> bookings
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'TOMORROW', label: 'Tomorrow' },
            { id: 'UPCOMING', label: 'Upcoming Journeys' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'RAC', label: 'RAC' },
            { id: 'WAITLIST', label: 'Waitlist (WL)' },
            { id: 'CANCELLED', label: 'Cancelled' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map(chip => {
            const isActive = quickChip === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setQuickChip(isActive ? null : chip.id)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition flex items-center space-x-1 border ${
                  isActive 
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md scale-105' 
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/10'
                }`}
              >
                <span>{chip.label}</span>
                {isActive && <X className="h-3 w-3 ml-1" />}
              </button>
            );
          })}

          {(searchTerm || trainFilter !== 'ALL' || dateFilter !== 'ALL' || statusFilter !== 'ALL' || classFilter !== 'ALL' || quotaFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || quickChip || groupBy !== 'none') && (
            <button
              onClick={handleClearAllFilters}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-black transition ml-auto flex items-center space-x-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ADVANCED FILTER & SEARCH TOOLBAR */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          {/* SEARCH INPUT */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search PNR, Passenger, Train, Email, Seat, IRCTC ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* MOBILE TOGGLE BUTTON */}
          <div className="flex md:hidden w-full justify-between items-center">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="px-4 py-2 bg-purple-50 text-purple-700 font-bold rounded-xl text-xs flex items-center space-x-1 border border-purple-200"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{showMobileFilters ? 'Hide Filters' : 'Show Advanced Filters'}</span>
            </button>
          </div>

          {/* DESKTOP TOP RIGHT SORT & GROUP BY */}
          <div className="hidden md:flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="journey_date_asc">Journey Date (Earliest First)</option>
                <option value="journey_date_desc">Journey Date (Latest First)</option>
                <option value="booking_date_desc">Booking Date (Newest First)</option>
                <option value="booking_date_asc">Booking Date (Oldest First)</option>
                <option value="train_no_asc">Train Number (A-Z)</option>
                <option value="train_no_desc">Train Number (Z-A)</option>
                <option value="passenger_name_asc">Passenger Name (A-Z)</option>
                <option value="pnr_asc">PNR (A-Z)</option>
                <option value="class_asc">Class</option>
                <option value="status_asc">Booking Status</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Group By:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="none">None (Standard List)</option>
                <option value="train">By Train</option>
                <option value="journey_date">By Journey Date</option>
                <option value="class">By Class</option>
                <option value="status">By Booking Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* MULTI-FILTER DROPDOWNS ROW */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-2 border-t border-slate-100 ${showMobileFilters ? 'block' : 'hidden md:grid'}`}>
          
          {/* TRAIN FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Train</label>
            <select
              value={trainFilter}
              onChange={(e) => setTrainFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Trains</option>
              {availableTrains.map(t => (
                <option key={t.number} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* JOURNEY DATE FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Journey Date</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="TOMORROW">Tomorrow</option>
              <option value="UPCOMING">Upcoming Journeys</option>
              <option value="PAST">Past Journeys</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          {/* BOOKING STATUS FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Booking Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RAC">RAC</option>
              <option value="WAITLIST">Waitlist (WL)</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* CLASS FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Class</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Classes</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* QUOTA FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Quota</label>
            <select
              value={quotaFilter}
              onChange={(e) => setQuotaFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Quotas</option>
              <option value="GN">General (GN)</option>
              <option value="TQ">Tatkal (TQ)</option>
              <option value="PT">Premium Tatkal (PT)</option>
              <option value="LD">Ladies (LD)</option>
              <option value="HO">High Official / HQ (HO)</option>
            </select>
          </div>

          {/* PAYMENT STATUS FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

        </div>

        {/* CUSTOM DATE RANGE INPUTS */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">From Date:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">To Date:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* GROUPED OR UNGROUPED MAIN TABLE */}
      {groupBy !== 'none' && groupedBookings ? (
        <div className="space-y-6">
          {Object.entries(groupedBookings).map(([groupTitle, groupItems]) => (
            <div key={groupTitle} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
              <div className="bg-slate-100/90 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" />
                  {groupTitle}
                </h3>
                <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                  {groupItems.length} {groupItems.length === 1 ? 'booking' : 'bookings'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px]">PNR</th>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px]">Passenger</th>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px]">Train & Date</th>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px]">Class & Seat</th>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px]">Status</th>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px]">Payment</th>
                      <th className="px-4 py-3 font-bold uppercase text-slate-400 text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupItems.map(bk => (
                      <tr key={bk.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-mono font-bold text-purple-700">{bk.pnr}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{bk.primaryPassenger}</td>
                        <td className="px-4 py-3">{bk.trainNo} - {bk.trainName} ({bk.journeyDate})</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{bk.class} | {bk.coach}-{bk.seat}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            bk.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                            bk.status === 'COMPLETED' ? 'bg-teal-100 text-teal-800' :
                            bk.status === 'RAC' ? 'bg-blue-100 text-blue-800' :
                            bk.status === 'WAITLIST' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {bk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{bk.paymentStatus}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelectedBooking(bk)} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-[11px]">
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* STANDARD UNGROUPED BOOKINGS TABLE */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50/70">
                <tr>
                  <th 
                    onClick={() => handleHeaderSort('pnr')}
                    className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8 cursor-pointer hover:text-purple-600 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>PNR & Booking Date</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleHeaderSort('passenger')}
                    className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 cursor-pointer hover:text-purple-600 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Passenger</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleHeaderSort('train')}
                    className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 cursor-pointer hover:text-purple-600 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Train & Route</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleHeaderSort('journeyDate')}
                    className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 cursor-pointer hover:text-purple-600 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Journey Date</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleHeaderSort('class')}
                    className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 cursor-pointer hover:text-purple-600 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Class & Coach/Seat</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleHeaderSort('status')}
                    className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 cursor-pointer hover:text-purple-600 transition"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-r-transparent mx-auto" />
                    </td>
                  </tr>
                ) : paginatedBookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-xs font-bold text-slate-400">
                      No bookings match your current search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((bk) => (
                    <tr key={bk.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 pl-8">
                        <div className="font-mono font-black text-purple-700">{bk.pnr}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Booked: {bk.bookingDate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900">{bk.primaryPassenger}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{bk.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{bk.trainNo} - {bk.trainName}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{bk.sourceCode} ➔ {bk.destCode}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{bk.journeyDate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-purple-800">{bk.class} ({bk.quota})</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{bk.coach} - {bk.seat}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            bk.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            bk.status === 'COMPLETED' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                            bk.status === 'RAC' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            bk.status === 'WAITLIST' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            ● {bk.status}
                          </span>
                          <div className="text-[10px] text-slate-500 font-bold">Payment: {bk.paymentStatus}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right pr-8">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedBooking(bk)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center space-x-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect</span>
                          </button>
                          {bk.status !== 'CANCELLED' && bk.status !== 'AUTO_CANCELLED' && (
                            <button
                              onClick={() => handleOpenCancelModal(bk)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION BAR */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="flex items-center space-x-2 font-bold text-slate-600">
              <span>Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalRecords)} of {totalRecords} records</span>
              <span className="text-slate-300">•</span>
              <div className="flex items-center space-x-1">
                <span>Per Page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                title="First Page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3.5 py-1.5 bg-purple-600 text-white rounded-xl font-black text-xs">
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                title="Last Page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSENGER & BOOKING DETAIL MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                  Verified Railway Dossier
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Booking #{selectedBooking.pnr}</h3>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600 p-2 text-xl font-bold">✕</button>
            </div>

            <div className="space-y-6 text-xs">
              {/* SECTION 1: PASSENGER INFORMATION */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Passenger Identity & Contact</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Primary Passenger</span>
                    <span className="font-black text-slate-900">{selectedBooking.primaryPassenger}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Email Address</span>
                    <span className="font-mono font-bold text-slate-800">{selectedBooking.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Phone Number</span>
                    <span className="font-bold text-slate-800">{selectedBooking.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">IRCTC User ID</span>
                    <span className="font-mono font-bold text-purple-700">{selectedBooking.irctc_user_id}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: JOURNEY INFORMATION */}
              <div className="bg-purple-900 text-white p-4 rounded-2xl border border-purple-800 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-purple-300 tracking-wider">Journey & Train Itinerary</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-300 block text-[10px] font-bold">Train Name & Number</span>
                    <span className="font-black text-white">{selectedBooking.trainNo} - {selectedBooking.trainName}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-bold">Route Leg</span>
                    <span className="font-bold text-white">{selectedBooking.sourceCode} ➔ {selectedBooking.destCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-bold">Journey Date</span>
                    <span className="font-bold text-white">{selectedBooking.journeyDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-bold">Class & Quota</span>
                    <span className="font-bold text-white">{selectedBooking.class} ({selectedBooking.quota})</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PASSENGER MANIFEST */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Allocated Passenger Manifest ({selectedBooking.passengers.length} pax)</h4>
                <div className="space-y-2">
                  {selectedBooking.passengers.map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 font-medium">
                      <div>
                        <span className="font-bold text-slate-900">{i+1}. {p.name}</span> ({p.age}y, {p.gender})
                      </div>
                      <div className="font-mono font-bold text-purple-700">
                        {p.coach}-{p.seat} ({p.berthType})
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: FARE & PAYMENT DETAILS */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Fare Auditing & Payment Status</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Booking Status</span>
                    <span className="font-black text-slate-900">{selectedBooking.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Payment Status</span>
                    <span className="font-bold text-emerald-700">{selectedBooking.paymentStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Payment Method</span>
                    <span className="font-bold text-slate-700">{selectedBooking.payment.method}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Total Ticket Fare</span>
                    <span className="font-mono font-black text-slate-900 text-sm">₹{selectedBooking.fareDetails.totalFare.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 text-xs"
              >
                Close Dossier
              </button>
              {selectedBooking.status !== 'CANCELLED' && selectedBooking.status !== 'AUTO_CANCELLED' && (
                <button
                  type="button"
                  onClick={() => handleOpenCancelModal(selectedBooking)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  Administrative Cancel Ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Administrative Ticket Cancellation</h3>
              <button onClick={() => setCancelModalBooking(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              Cancel ticket for PNR <strong className="font-mono text-purple-700">{cancelModalBooking.pnr}</strong> ({cancelModalBooking.primaryPassenger}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cancellation Reason</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="Passenger Request">Passenger Request</option>
                  <option value="Train Cancellation / Disruption">Train Cancellation / Disruption</option>
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Administrative Override">Administrative Override</option>
                  <option value="Other">Other (Specify below)</option>
                </select>
              </div>

              {cancelReason === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Specify Reason</label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter custom cancellation reason..."
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-800"
                  />
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span>Ticket Base Fare:</span>
                  <span className="font-mono font-bold">₹{calculatedCancelDetails.originalFare.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Cancellation Penalty:</span>
                  <span className="font-mono">-₹{calculatedCancelDetails.penalty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-black text-sm pt-1 border-t border-slate-200">
                  <span>Net Refund Amount:</span>
                  <span className="font-mono">₹{calculatedCancelDetails.refundAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleExecuteCancel}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffBookings;
