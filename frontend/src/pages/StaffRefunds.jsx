import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, CheckCircle2, XCircle, Clock, Filter, RefreshCw, 
  Search, AlertCircle, FileText, ArrowRight, ShieldAlert, Check, X
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const StaffRefunds = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refundRecords, setRefundRecords] = useState([]);
  const [filterTab, setFilterTab] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [apiError, setApiError] = useState(null);
  const [approveModalRecord, setApproveModalRecord] = useState(null);
  const [rejectModalRecord, setRejectModalRecord] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const fetchRefunds = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await api.get('/admin/refunds');
      let rawRecords = [];
      if (res.data && Array.isArray(res.data)) {
        rawRecords = res.data;
      } else if (res.data && Array.isArray(res.data.records)) {
        rawRecords = res.data.records;
      }

      const normalized = rawRecords.map(r => {
        const passName = r.passenger_name || r.passenger || r.passengerName || r.passenger?.full_name || r.passenger?.name || r.user?.full_name || r.user?.name || (r.pnr ? `Passenger (${r.pnr})` : 'Unknown Passenger');
        const trainStr = typeof r.train === 'object' && r.train !== null
          ? (r.train.train_name ? `${r.train.train_number || ''} ${r.train.train_name}`.trim() : (r.train.train_number || 'Express Special'))
          : String(r.train || r.train_name || r.train_number || 'Express Special');
        return {
          ...r,
          train: trainStr,
          passenger: passName,
          passenger_name: passName,
          passengerName: passName
        };
      });

      setRefundRecords(normalized);
    } catch (err) {
      console.error('API error fetching refunds:', err);
      setApiError(err.response?.data?.error || err.message || 'Unable to load cancellation records.');
      setRefundRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  // Filtered List
  const filteredRecords = useMemo(() => {
    return refundRecords.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      const pnrStr = String(r.pnr || r.pnr_number || '');
      const passStr = String(r.passenger || r.passenger_name || '').toLowerCase();
      const trainStr = String(r.train || r.train_name || '').toLowerCase();
      const reasonStr = String(r.cancellationReason || r.cancellation_reason || '').toLowerCase();

      const matchesSearch = !searchTerm || 
        pnrStr.includes(searchTerm) || 
        passStr.includes(searchLower) ||
        trainStr.includes(searchLower) ||
        reasonStr.includes(searchLower);

      let matchesTab = true;
      const statusUpper = String(r.status || r.refund_status || '').toUpperCase();
      if (filterTab === 'Pending') matchesTab = statusUpper === 'PENDING';
      else if (filterTab === 'Processing') matchesTab = statusUpper === 'PROCESSING';
      else if (filterTab === 'Refunded') matchesTab = statusUpper === 'REFUNDED' || statusUpper === 'APPROVED';
      else if (filterTab === 'Rejected') matchesTab = statusUpper === 'REJECTED';

      let matchesType = true;
      const cancType = String(r.cancellationType || r.cancellation_type || 'passenger').toLowerCase();
      if (typeFilter !== 'All') {
        matchesType = cancType === typeFilter.toLowerCase();
      }

      return matchesSearch && matchesTab && matchesType;
    });
  }, [refundRecords, searchTerm, filterTab, typeFilter]);

  // Metrics
  const stats = useMemo(() => {
    let pending = 0, processing = 0, refunded = 0, rejected = 0, totalAmount = 0;
    for (const r of refundRecords) {
      const st = String(r.status || r.refund_status || '').toUpperCase();
      const orig = Number(r.originalFare || r.original_fare || 0);
      const ded = Number(r.deduction !== undefined ? r.deduction : (r.deduction_amount || 0));
      let amt = Number(r.refundAmount !== undefined ? r.refundAmount : (r.refund_amount || 0));
      if (orig > 0 && (amt > Math.max(0, orig - ded) || amt === orig)) {
        amt = Math.max(0, orig - ded);
      }

      if (st === 'PENDING') pending++;
      else if (st === 'PROCESSING') {
        processing++;
        totalAmount += amt;
      }
      else if (st === 'REFUNDED' || st === 'APPROVED') {
        refunded++;
        totalAmount += amt;
      } else if (st === 'REJECTED') rejected++;
    }
    return { pending, processing, refunded, rejected, totalAmount };
  }, [refundRecords]);

  // Actions
  const handleApprove = async () => {
    if (!approveModalRecord) return;
    setProcessingAction(true);
    try {
      await api.put(`/admin/refunds/${approveModalRecord.id}/action`, { action: 'approve' });
      showToast(`Refund claim for PNR #${approveModalRecord.pnr} approved successfully.`, 'success');
      setApproveModalRecord(null);
      fetchRefunds();
    } catch (err) {
      showToast('Action failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalRecord) return;
    if (!rejectReason || !rejectReason.trim()) {
      showToast('Rejection reason is mandatory.', 'error');
      return;
    }

    setProcessingAction(true);
    try {
      await api.put(`/admin/refunds/${rejectModalRecord.id}/action`, { action: 'reject', reason: rejectReason });
      showToast(`Refund claim for PNR #${rejectModalRecord.pnr} rejected.`, 'info');
      setRejectModalRecord(null);
      setRejectReason('');
      fetchRefunds();
    } catch (err) {
      showToast('Action failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-emerald-200">
              Financial Governance
            </span>
            <span className="text-xs text-slate-400 font-bold">• Gateway Audit Sync</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Refund & Cancellation Operations Center
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Audit passenger cancellation claims, review policy deductions, and approve automated bank gateway disbursements.
          </p>
        </div>
        <button 
          onClick={fetchRefunds} 
          disabled={loading}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition active:scale-95 border border-slate-200 self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Pending Review', value: stats.pending, sub: 'Needs Audit Action', color: 'text-amber-600 bg-amber-500/10 border-amber-100', icon: Clock },
          { label: 'Processing Gateway', value: stats.processing, sub: 'Bank Settlement', color: 'text-blue-600 bg-blue-500/10 border-blue-100', icon: RefreshCw },
          { label: 'Refunded / Approved', value: stats.refunded, sub: 'Settled Claims', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-100', icon: CheckCircle2 },
          { label: 'Rejected Claims', value: stats.rejected, sub: 'Non-compliant', color: 'text-rose-600 bg-rose-500/10 border-rose-100', icon: XCircle },
          { label: 'Total Refund Value', value: `₹${stats.totalAmount.toLocaleString('en-IN')}`, sub: 'Cumulative Value', color: 'text-purple-600 bg-purple-500/10 border-purple-100', icon: DollarSign }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/80 p-4 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                <span className="text-xl font-black text-slate-800 mt-0.5 block">{stat.value}</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{stat.sub}</span>
              </div>
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${stat.color} font-bold`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        {/* Search */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 w-full lg:w-96 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition">
          <Search className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search PNR, Passenger, Train, Cancellation Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-bold text-slate-700"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter & Tab Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-600">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="passenger">Passenger</option>
              <option value="admin">Admin</option>
              <option value="train_service">Train Service</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-200">
            {['All', 'Pending', 'Processing', 'Refunded', 'Rejected'].map(t => (
              <button
                key={t}
                onClick={() => setFilterTab(t)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                  filterTab === t ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Refund Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">PNR & Date</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Passenger</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Train & Journey</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Original Fare</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Deduction</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Net Refund</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Reason & By</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right pr-8">Audit Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {apiError ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-xs font-bold text-rose-600">
                    ⚠️ Unable to load cancellation records ({apiError}). Please check your connection or permissions.
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-xs font-bold text-slate-400">
                    {refundRecords.length === 0 
                      ? "No cancellation or refund records found." 
                      : "No refund records match your search or filter tab."}
                  </td>
                </tr>
              ) : (
                filteredRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 pl-8">
                      <span className="font-mono text-xs font-black text-primary-600 block">#{r.pnr}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{r.cancellationDate}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-slate-800">{r.passenger}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-semibold">
                      <span className="block font-bold text-slate-800">
                        {typeof r.train === 'object' && r.train !== null ? (r.train.train_name || r.train.train_number || 'Express Special') : String(r.train || 'Express Special')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Travel: {r.journeyDate}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-800">₹{Number(r.originalFare).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-rose-600">₹{Number(r.deduction).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs font-mono font-black text-emerald-700">₹{Number(r.refundAmount).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="font-bold text-slate-800 block text-[11px]">{r.cancellationReason}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">By: {r.cancelledBy}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold">
                      <span className={`inline-flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        r.status === 'APPROVED' || r.status === 'REFUNDED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : r.status === 'PROCESSING'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <span>{r.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right pr-8">
                      {r.status === 'PENDING' || r.status === 'PROCESSING' ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setApproveModalRecord(r)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition active:scale-95 flex items-center space-x-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => setRejectModalRecord(r)}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition active:scale-95 flex items-center space-x-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 italic">Audited</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {approveModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center space-x-3 text-emerald-600">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Approve Refund Claim</h3>
                <p className="text-xs text-slate-500 font-semibold">Gateway Disbursement Confirmation</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs font-semibold text-slate-700 border border-slate-200/80">
              <div className="flex justify-between">
                <span className="text-slate-500">PNR:</span>
                <span className="font-mono font-black text-slate-900">#{approveModalRecord.pnr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Passenger:</span>
                <span className="font-bold text-slate-900">{approveModalRecord.passenger}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-black text-sm pt-2 border-t border-slate-200/60">
                <span>Disbursement Amount:</span>
                <span className="font-mono">₹{Number(approveModalRecord.refundAmount).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Approving this claim will trigger automated bank gateway settlement back to the original payment source.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setApproveModalRecord(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={processingAction}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition active:scale-95 shadow-md"
              >
                {processingAction ? 'Processing...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL WITH REASON */}
      {rejectModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Reject Refund Claim</h3>
                <p className="text-xs text-slate-500 font-semibold">PNR #{rejectModalRecord.pnr}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase text-slate-700">
                Mandatory Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                placeholder="State reason for claim rejection (e.g., Non-refundable window after chart preparation)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => { setRejectModalRecord(null); setRejectReason(''); }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processingAction}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition active:scale-95 shadow-md"
              >
                {processingAction ? 'Rejecting...' : 'Reject Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffRefunds;
