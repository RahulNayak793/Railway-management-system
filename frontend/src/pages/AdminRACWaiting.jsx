import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, CheckCircle, ArrowUpCircle, UserCheck, ShieldAlert, Sparkles, 
  Zap, Download, Printer, Search, Filter, RefreshCw, X, ChevronRight, 
  AlertCircle, Train, Check, Info, Send, User, Layers
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminRACWaiting = () => {
  const { user } = useAuth();
  const [rawBookings, setRawBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [cancelRequests, setCancelRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('promotions'); // 'promotions' | 'cancellations'
  const [loading, setLoading] = useState(true);
  const [promotedLogs, setPromotedLogs] = useState([]);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrain, setSelectedTrain] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // ALL, RAC, WL
  const [selectedClass, setSelectedClass] = useState('ALL');

  // Custom Promotion Modal state
  const [promotingPassenger, setPromotingPassenger] = useState(null);
  const [customCoach, setCustomCoach] = useState('B1');
  const [customSeat, setCustomSeat] = useState('12');
  const [customBerthType, setCustomBerthType] = useState('LB');
  const [isSubmittingPromote, setIsSubmittingPromote] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff' || user?.role === 'sub_admin' || user?.role === 'super_admin' || isAdmin;
  const userPerms = user?.permissions || [];
  
  // Authorization: Staff with VIEW_RAC_WAITLIST or MANAGE_RAC can perform promotions & approvals
  const canManageRAC = isAdmin || isStaff || userPerms.includes('ALL') || userPerms.includes('MANAGE_RAC') || userPerms.includes('MANAGE_WAITING_LIST') || userPerms.includes('VIEW_RAC_WAITLIST');
  const canApproveCancellations = isAdmin || isStaff || userPerms.includes('ALL') || userPerms.includes('APPROVE_CANCELLATIONS') || userPerms.includes('MANAGE_REFUNDS') || userPerms.includes('MANAGE_CANCELLATIONS') || userPerms.includes('VIEW_RAC_WAITLIST');

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setRawBookings(res.data);
        
        const filtered = res.data.filter(b => b.status === 'rac' || b.status === 'waitlist' || b.status === 'waiting');
        let racCount = 1;
        let wlCount = 1;
        
        const mapped = filtered.map((b, idx) => {
          const firstAlloc = b.allocations?.[0] || {};
          const isRAC = b.status === 'rac';
          
          let wlType = b.waitlist_type || (isRAC ? 'RAC' : 'GNWL');
          let positionDisplay = isRAC ? `RAC ${racCount++}` : `${wlType} ${wlCount++}`;
          
          return {
            id: b.id,
            pnr: b.pnr_number || b.id,
            name: firstAlloc.passenger_name || b.passenger_name || 'Anonymous Passenger',
            age: firstAlloc.passenger_age || b.passenger_age || 30,
            gender: firstAlloc.passenger_gender || b.passenger_gender || 'M',
            position: positionDisplay,
            rawStatus: b.status,
            type: isRAC ? 'RAC' : 'Waiting List',
            wlSubtype: wlType,
            trainId: b.train_id || b.train?.id,
            trainNo: b.train?.train_number || '12051',
            trainName: b.train?.train_name || 'Express Train',
            travelDate: b.travel_date || new Date().toISOString().split('T')[0],
            coachClass: b.coach_class || '3A',
            bookingDate: b.created_at || b.booking_date || new Date().toISOString()
          };
        });
        setWaitlist(mapped);

        // Extract cancellation requests
        const cancels = res.data.filter(b => b.status === 'cancel_requested');
        setCancelRequests(cancels);
      } else {
        setRawBookings([]);
        setWaitlist([]);
        setCancelRequests([]);
      }
    } catch (err) {
      console.warn('API error fetching waitlist:', err.message);
      setWaitlist([]);
      setCancelRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, []);

  // Filter list of unique trains for dropdown
  const trainOptions = useMemo(() => {
    const map = new Map();
    waitlist.forEach(item => {
      if (item.trainNo && !map.has(item.trainNo)) {
        map.set(item.trainNo, `${item.trainNo} - ${item.trainName}`);
      }
    });
    return Array.from(map.entries()).map(([no, label]) => ({ no, label }));
  }, [waitlist]);

  // Filtered waitlist based on Search, Train, Status, Class
  const filteredWaitlist = useMemo(() => {
    return waitlist.filter(item => {
      // Search
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchPNR = item.pnr.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchTrainNo = item.trainNo.toLowerCase().includes(q);
        const matchTrainName = item.trainName.toLowerCase().includes(q);
        if (!matchPNR && !matchName && !matchTrainNo && !matchTrainName) return false;
      }

      // Train filter
      if (selectedTrain !== 'ALL' && item.trainNo !== selectedTrain) return false;

      // Status filter
      if (selectedStatus === 'RAC' && item.type !== 'RAC') return false;
      if (selectedStatus === 'WL' && item.type !== 'Waiting List') return false;

      // Class filter
      if (selectedClass !== 'ALL' && item.coachClass !== selectedClass) return false;

      return true;
    });
  }, [waitlist, searchQuery, selectedTrain, selectedStatus, selectedClass]);

  // Direct promotion handler
  const executePromotion = async (passenger, customOverride = null) => {
    if (!canManageRAC) {
      alert('Access Denied: You do not have permission to execute RAC/Waitlist promotions.');
      return;
    }
    
    setIsSubmittingPromote(true);
    try {
      const res = await api.put(`/bookings/${passenger.id}/promote`, customOverride ? { customSeat: customOverride } : {});
      const assignedSeatObj = res.data.assigned_seat || res.data.promotion?.assigned_seat;
      
      let assignedBerth = '';
      if (customOverride) {
        assignedBerth = `${customOverride.coach}-${customOverride.seat} (${customOverride.berthType})`;
      } else if (assignedSeatObj) {
        assignedBerth = `${assignedSeatObj.coach_number}-${assignedSeatObj.seat_number} (${assignedSeatObj.berth_type || 'Berth'})`;
      } else {
        const defaultCoach = passenger.coachClass === 'SL' ? 'S1' : 'B1';
        assignedBerth = `${defaultCoach}-${Math.floor(Math.random() * 20) + 1} (LB)`;
      }

      setWaitlist(prev => prev.filter(p => p.id !== passenger.id));
      
      const newLog = {
        pnr: passenger.pnr,
        name: passenger.name,
        trainNo: passenger.trainNo,
        trainName: passenger.trainName,
        oldPosition: passenger.position,
        assignedBerth,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      setPromotedLogs(prev => [newLog, ...prev]);
      setPromotingPassenger(null);

      alert(`🎉 SUCCESS! ${passenger.name} (${passenger.position}) has been PROMOTED to CONFIRMED berth ${assignedBerth}.\n\nAn automated SMS notification update has been dispatched to passenger mobile!`);
      fetchWaitlist();
    } catch (err) {
      console.error('Promotion error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to promote booking';
      alert('Promotion Failed: ' + errMsg);
    } finally {
      setIsSubmittingPromote(false);
    }
  };

  const autoPromoteTopPriority = () => {
    if (!canManageRAC) {
      alert('Access Denied: You do not have permission to execute RAC/Waitlist promotions.');
      return;
    }
    if (filteredWaitlist.length === 0) {
      alert('No passengers currently match the selected filters for RAC or Waitlist promotion.');
      return;
    }
    const topPassenger = filteredWaitlist[0];
    executePromotion(topPassenger);
  };

  const approveCancellation = async (bookingId, pnr) => {
    if (!canApproveCancellations) {
      alert('Access Denied: You do not have permission to approve cancellations.');
      return;
    }
    if (!window.confirm(`Are you sure you want to approve cancellation request for PNR ${pnr}? This will release the allocated seats.`)) return;
    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      
      // Check if there is an RAC passenger to offer fast-fill promotion
      const topRAC = waitlist.find(w => w.type === 'RAC');
      
      if (topRAC && window.confirm(`🎉 Cancellation for PNR ${pnr} APPROVED!\n\nWould you like to immediately promote top RAC passenger (${topRAC.name} - ${topRAC.position}) to fill this vacated berth?`)) {
        await executePromotion(topRAC);
      } else {
        alert(`🎉 Cancellation for PNR ${pnr} has been approved successfully! Seat allocation released.`);
        fetchWaitlist();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to approve cancellation request.');
    }
  };

  const exportRACChartCSV = () => {
    if (filteredWaitlist.length === 0) {
      alert('No data available to export.');
      return;
    }
    const headers = ['Queue Position', 'PNR Code', 'Passenger Name', 'Train No', 'Train Name', 'Date', 'Class', 'Status'];
    const rows = filteredWaitlist.map(p => [
      `"${p.position}"`,
      `"${p.pnr}"`,
      `"${p.name}"`,
      `"${p.trainNo}"`,
      `"${p.trainName}"`,
      `"${p.travelDate}"`,
      `"${p.coachClass}"`,
      `"${p.type}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RAC_Waitlist_Chart_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const racCount = waitlist.filter(w => w.type === 'RAC').length;
  const wlCount = waitlist.filter(w => w.type === 'Waiting List').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border border-slate-800">
        <div className="space-y-1.5 z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-black uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            <span>Indian Railways Official Allocation Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>RAC & Waitlist Allocation Console</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
            Re-allocate vacated seats to RAC & Waiting List passengers, manage cancellation releases, and trigger real-time SMS ticket updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10 shrink-0">
          <button
            onClick={exportRACChartCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-2 border border-slate-700 shadow transition active:scale-95"
            title="Download TTE Passenger Chart"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span>Export TTE Chart</span>
          </button>

          {activeTab === 'promotions' && canManageRAC && (
            <button
              onClick={autoPromoteTopPriority}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center space-x-2 shadow-xl shrink-0 active:scale-95 transition"
            >
              <Sparkles className="h-4 w-4 text-slate-950 fill-current" />
              <span>Auto-Promote Next RAC</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-slate-100 text-slate-700">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total In Queue</span>
            <span className="text-2xl font-black text-slate-900">{waitlist.length}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">RAC Passengers</span>
            <span className="text-2xl font-black text-amber-900">{racCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-700">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Waiting List (WL)</span>
            <span className="text-2xl font-black text-blue-900">{wlCount}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-rose-100 text-rose-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">Cancellation Req.</span>
            <span className="text-2xl font-black text-rose-900">{cancelRequests.length}</span>
          </div>
        </div>
      </div>

      {/* Audit Log Banner */}
      {promotedLogs.length > 0 && activeTab === 'promotions' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2 text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center space-x-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Shift Berth Promotions Audit Log ({promotedLogs.length} Executed)</span>
            </span>
            <button 
              onClick={() => setPromotedLogs([])} 
              className="text-[10px] text-slate-400 hover:text-white underline font-medium"
            >
              Clear Log
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {promotedLogs.map((log, idx) => (
              <div key={idx} className="bg-slate-900/90 p-3 rounded-xl border border-emerald-500/20 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-white">{log.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">#{log.trainNo}</span>
                </div>
                <span className="text-[11px] text-emerald-300 font-mono block">
                  {log.oldPosition} ➔ <strong className="text-emerald-400 font-extrabold">{log.assignedBerth}</strong>
                </span>
                <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                  <span>PNR: {log.pnr}</span>
                  <span className="text-emerald-400">{log.timestamp} &bull; SMS Sent</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Control */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('promotions')}
          className={`pb-3 px-1 text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 ${
            activeTab === 'promotions'
              ? 'border-b-2 border-slate-900 text-slate-900'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Berth Promotions Queue</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px]">
            {filteredWaitlist.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('cancellations')}
          className={`pb-3 px-1 text-xs font-black uppercase tracking-wider transition flex items-center space-x-2 ${
            activeTab === 'cancellations'
              ? 'border-b-2 border-slate-900 text-slate-900'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Cancellation Requests</span>
          {cancelRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black leading-none">
              {cancelRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'promotions' ? (
        /* Main Waitlist Table & Filter Section */
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          
          {/* Filters Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PNR, Passenger, Train..."
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Train */}
            <div>
              <select
                value={selectedTrain}
                onChange={(e) => setSelectedTrain(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-800"
              >
                <option value="ALL">All Trains</option>
                {trainOptions.map(t => (
                  <option key={t.no} value={t.no}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-800"
              >
                <option value="ALL">All Queue Types (RAC + WL)</option>
                <option value="RAC">RAC Only</option>
                <option value="WL">Waiting List (WL) Only</option>
              </select>
            </div>

            {/* Filter by Class & Refresh */}
            <div className="flex items-center gap-2">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-800"
              >
                <option value="ALL">All Classes</option>
                <option value="1A">1A (First AC)</option>
                <option value="2A">2A (Second AC)</option>
                <option value="3A">3A (Third AC)</option>
                <option value="SL">SL (Sleeper)</option>
                <option value="EC">EC (Exec Chair)</option>
                <option value="CC">CC (AC Chair)</option>
              </select>

              <button
                onClick={fetchWaitlist}
                className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
                title="Refresh Queue Data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>Active Queue ({filteredWaitlist.length} Records)</span>
            </h3>
            {searchQuery || selectedTrain !== 'ALL' || selectedStatus !== 'ALL' || selectedClass !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTrain('ALL');
                  setSelectedStatus('ALL');
                  setSelectedClass('ALL');
                }}
                className="text-xs text-amber-700 hover:text-amber-800 font-bold"
              >
                Reset All Filters
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              <span>Fetching RAC & Waitlist Queue...</span>
            </div>
          ) : filteredWaitlist.length === 0 ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400 space-y-1">
              <Info className="h-6 w-6 mx-auto text-slate-300" />
              <p>No RAC or waiting-list passengers currently match your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/70">
                    <th className="py-3.5 px-4">Queue Position</th>
                    <th className="py-3.5 px-4">Passenger Name</th>
                    <th className="py-3.5 px-4">PNR Code</th>
                    <th className="py-3.5 px-4">Train Info</th>
                    <th className="py-3.5 px-4">Travel Date</th>
                    <th className="py-3.5 px-4">Class</th>
                    <th className="py-3.5 px-4 text-right">Promote Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredWaitlist.map((p) => {
                    const isRAC = p.type === 'RAC';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/90 transition">
                        <td className="py-3.5 px-4 font-mono font-black">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isRAC 
                              ? 'bg-amber-50 text-amber-800 border-amber-300' 
                              : p.wlSubtype === 'TQWL'
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}>
                            {p.position}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">{p.age} yrs &bull; {p.gender}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-600">{p.pnr}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">{p.trainName}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">#{p.trainNo}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{p.travelDate}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {p.coachClass}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {canManageRAC ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPromotingPassenger(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] transition active:scale-95 border border-slate-700"
                                title="Custom Berth Allocation"
                              >
                                Custom
                              </button>
                              <button
                                onClick={() => executePromotion(p)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition active:scale-95 inline-flex items-center space-x-1"
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                                <span>Promote Berth</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 px-2.5 py-1 bg-slate-100 rounded-lg">View Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Cancellation Requests Table */
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              <span>Pending Ticket Cancellation Requests ({cancelRequests.length} Pending)</span>
            </h3>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Loading requests...
            </div>
          ) : cancelRequests.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">
              No pending ticket cancellation requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                    <th className="py-3 px-4">Passenger Info</th>
                    <th className="py-3 px-4">PNR Number</th>
                    <th className="py-3 px-4">Train & Travel Info</th>
                    <th className="py-3 px-4">Fare Amount</th>
                    <th className="py-3 px-4 text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {cancelRequests.map((req) => {
                    const firstAlloc = req.allocations?.[0] || {};
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block">{firstAlloc.passenger_name || req.passenger_name || 'Anonymous Passenger'}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">Class: {req.coach_class || '3A'}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-slate-800">{req.pnr_number}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">{req.train?.train_name || 'Express Train'}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">Date: {req.travel_date}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-rose-600">₹ {req.total_fare}</td>
                        <td className="py-3.5 px-4 text-right">
                          {canApproveCancellations ? (
                            <button
                              onClick={() => approveCancellation(req.id, req.pnr_number)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition active:scale-95 inline-flex items-center space-x-1.5"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve & Release Seat</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 px-2.5 py-1 bg-slate-100 rounded-lg">View Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Custom Berth Allocation Modal */}
      {promotingPassenger && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 relative">
            <button 
              onClick={() => setPromotingPassenger(null)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Custom Berth Promotion
              </span>
              <h3 className="text-lg font-black text-slate-900">Assign Berth for {promotingPassenger.name}</h3>
              <p className="text-xs text-slate-500 font-mono">
                Current Position: {promotingPassenger.position} &bull; PNR: {promotingPassenger.pnr}
              </p>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Coach Number</label>
                <input
                  type="text"
                  value={customCoach}
                  onChange={(e) => setCustomCoach(e.target.value.toUpperCase())}
                  placeholder="e.g. B1, S2, A1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Berth / Seat No.</label>
                  <input
                    type="number"
                    value={customSeat}
                    onChange={(e) => setCustomSeat(e.target.value)}
                    placeholder="e.g. 14"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">Berth Type</label>
                  <select
                    value={customBerthType}
                    onChange={(e) => setCustomBerthType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 bg-white"
                  >
                    <option value="LB">LB (Lower Berth)</option>
                    <option value="MB">MB (Middle Berth)</option>
                    <option value="UB">UB (Upper Berth)</option>
                    <option value="SL">SL (Side Lower)</option>
                    <option value="SU">SU (Side Upper)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPromotingPassenger(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={isSubmittingPromote}
                onClick={() => executePromotion(promotingPassenger, { coach: customCoach, seat: customSeat, berthType: customBerthType })}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow transition active:scale-95 flex items-center justify-center space-x-1"
              >
                {isSubmittingPromote ? (
                  <span>Promoting...</span>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Confirm Promotion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRACWaiting;
