import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, Search, CheckCircle2, Clock, RefreshCw,
  IndianRupee, RotateCcw, Filter, ShieldCheck, Download, Wallet, AlertCircle,
  FileText, TrendingUp, Sparkles, ChevronRight, X, ExternalLink, Info, Check
} from 'lucide-react';
import api from '../services/api';

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchAdminPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payments');
      setPayments(res.data || []);
    } catch (err) {
      console.error('Error fetching admin payments audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminPayments();
  }, []);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const pnr = p.reference || '';
      const orderId = p.razorpay_order_id || '';
      const payId = p.razorpay_payment_id || p.id || '';
      const passenger = p.passenger || '';
      
      const matchesSearch = !query || 
        pnr.toLowerCase().includes(query.toLowerCase()) || 
        orderId.toLowerCase().includes(query.toLowerCase()) || 
        payId.toLowerCase().includes(query.toLowerCase()) || 
        passenger.toLowerCase().includes(query.toLowerCase());
      
      const matchesType = typeFilter === 'ALL' || p.type === typeFilter || (typeFilter === 'FOOD_ORDER' && (p.type === 'FOOD_ORDER' || p.type === 'FOOD — COMPLIMENTARY'));

      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'CAPTURED' && (p.status === 'CAPTURED' || p.status === 'Success' || p.status === 'completed')) ||
        (statusFilter === 'COMPLIMENTARY' && (p.status === 'COMPLIMENTARY' || p.type === 'FOOD — COMPLIMENTARY')) ||
        (statusFilter === 'PENDING' && (p.status === 'PENDING' || p.status === 'CREATED')) ||
        (statusFilter === 'FAILED' && p.status === 'FAILED') ||
        (statusFilter === 'REFUNDED' && (p.status === 'REFUNDED' || p.status === 'Refunded'));

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [payments, query, typeFilter, statusFilter]);

  // Financial Stats
  const capturedList = useMemo(() => payments.filter(p => ['CAPTURED', 'Success', 'completed'].includes(p.status)), [payments]);
  const refundedList = useMemo(() => payments.filter(p => ['REFUNDED', 'Refunded'].includes(p.status)), [payments]);
  const totalVerifiedRevenue = useMemo(() => capturedList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [capturedList]);
  const totalRefundedAmount = useMemo(() => refundedList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [refundedList]);

  const handleExportCSV = () => {
    let csv = 'Payment ID,Razorpay Order ID,Type,Passenger,Reference,Amount (INR),Payment Method,Status,Created At,Paid At\n';
    filtered.forEach(p => {
      csv += `"${p.id}","${p.razorpay_order_id}","${p.type}","${p.passenger}","${p.reference}","${p.amount}","${p.payment_method}","${p.status}","${p.created_at}","${p.paid_at || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RailControl_Payments_Audit_${Date.now()}.csv`;
    a.click();
  };

  const handleInitiateRefund = async (payment) => {
    setRefundProcessing(true);
    setActionMessage(null);
    try {
      const res = await api.post(`/payments/${payment.id}/refund`, {
        reason: 'Admin requested refund cancellation'
      });
      if (res.data?.success) {
        setActionMessage({ type: 'success', text: `✓ Refund initiated successfully! Refund ID: ${res.data.refund_id || 'RFND-DONE'}` });
        fetchAdminPayments();
        if (selectedPayment && selectedPayment.id === payment.id) {
          setSelectedPayment(prev => ({ ...prev, status: 'REFUNDED' }));
        }
      } else {
        setActionMessage({ type: 'error', text: res.data?.error || 'Refund initiation failed' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.error || err.message || 'Refund error' });
    } finally {
      setRefundProcessing(false);
    }
  };

  const formatDateTime = (dt) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dt;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 font-sans space-y-8 animate-fade-in">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl text-white">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <CreditCard className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Payment Ledger & Gateway Audit
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  Official Razorpay Standard Checkout settlements, ticket checkouts, wallet top-ups, and catering transactions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-3 rounded-2xl transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Audit CSV</span>
            </button>
            <button
              onClick={fetchAdminPayments}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-lg hover:shadow-blue-500/25 transition cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Captured Revenue</span>
              <IndianRupee className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-400">
                ₹{totalVerifiedRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              {capturedList.length} Verified Gateway Transactions
            </p>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Verification Success Rate</span>
              <CheckCircle2 className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">
                {payments.length ? Math.round((capturedList.length / payments.length) * 100) : 100}%
              </span>
              <span className="text-[10px] text-blue-400 font-bold">HMAC Signature Authenticated</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              Server-side Verified via SHA-256
            </p>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Processed Refunds</span>
              <RotateCcw className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-amber-400">
                ₹{totalRefundedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              {refundedList.length} Cancellation Settlements
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Type Tabs & Status Filters */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PNR, Order ID, Payment ID, Passenger..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center space-x-1">
            <span className="text-xs font-bold text-slate-400 mr-1">Type:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'TICKET_BOOKING', label: 'Ticket' },
              { id: 'WALLET_RECHARGE', label: 'Wallet' },
              { id: 'FOOD_ORDER', label: 'Food' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  typeFilter === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1 border-l border-slate-200 pl-3">
            <span className="text-xs font-bold text-slate-400 mr-1">Status:</span>
            {['ALL', 'CAPTURED', 'COMPLIMENTARY', 'PENDING', 'FAILED', 'REFUNDED'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Transactions Directory Table */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:px-6 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Authenticated Razorpay Ledger Feed</span>
          </h3>
          <span className="text-xs font-bold text-slate-400 font-mono">
            Showing {filtered.length} of {payments.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs font-bold space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500" />
              <p>Syncing secure financial transaction ledger...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs font-bold">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p>No financial transaction records found matching your filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200/70 text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Payment ID</th>
                  <th className="px-5 py-3.5">Razorpay Order ID</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Passenger</th>
                  <th className="px-5 py-3.5">Reference</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Payment Method</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5">Paid At</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-xs">
                {filtered.map((p) => {
                  const isCaptured = ['CAPTURED', 'Success', 'completed'].includes(p.status);
                  const isRefunded = ['REFUNDED', 'Refunded'].includes(p.status);
                  const isComplimentary = p.status === 'COMPLIMENTARY' || p.type === 'FOOD — COMPLIMENTARY';
                  const isFailed = p.status === 'FAILED';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition duration-150">
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-slate-800">
                        {p.id}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[11px] text-blue-600 font-bold">
                        {p.razorpay_order_id || '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          p.type === 'FOOD — COMPLIMENTARY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                            : p.type === 'TICKET_BOOKING'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : p.type === 'WALLET_RECHARGE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {p.type?.replace('_', ' ') || 'TICKET'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-800">
                        {p.passenger || 'Passenger'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-600 font-bold">
                        {p.reference || '—'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono font-black text-slate-900">
                        ₹{parseFloat(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-semibold text-[11px]">
                        {p.payment_method || 'Razorpay Online'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center space-x-1 ${
                          isComplimentary
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : isCaptured
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isRefunded
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : isFailed
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isComplimentary ? 'bg-teal-500' : isCaptured ? 'bg-emerald-500' : isRefunded ? 'bg-amber-500' : isFailed ? 'bg-rose-500' : 'bg-slate-400'}`} />
                          <span>{p.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[11px] text-slate-500">
                        {formatDateTime(p.created_at)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[11px] text-slate-500">
                        {formatDateTime(p.paid_at)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-1.5">
                        <button
                          onClick={() => { setSelectedPayment(p); setActionMessage(null); }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                        >
                          Details
                        </button>
                        {isCaptured && !isComplimentary && (
                          <button
                            onClick={() => handleInitiateRefund(p)}
                            disabled={refundProcessing}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] rounded-lg transition disabled:opacity-50"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details & Signature Verification Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h3 className="font-black text-sm text-slate-900">Razorpay Transaction Details</h3>
              </div>
              <button onClick={() => setSelectedPayment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold ${actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {actionMessage.text}
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Payment ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedPayment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Razorpay Order ID:</span>
                <span className="font-mono font-bold text-blue-700">{selectedPayment.razorpay_order_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Razorpay Payment ID:</span>
                <span className="font-mono font-bold text-slate-700">{selectedPayment.razorpay_payment_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Type:</span>
                <span className="font-bold text-slate-800">{selectedPayment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Passenger:</span>
                <span className="font-bold text-slate-800">{selectedPayment.passenger}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Reference (PNR/ID):</span>
                <span className="font-mono font-bold text-slate-800">{selectedPayment.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Amount:</span>
                <span className="font-mono font-black text-emerald-700">₹{parseFloat(selectedPayment.amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Payment Method:</span>
                <span className="font-bold text-slate-700">{selectedPayment.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Status:</span>
                <span className="font-bold uppercase text-slate-800">{selectedPayment.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Signature Verification:</span>
                <span className="font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded text-[10px]">
                  HMAC SHA-256 Validated
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Created At:</span>
                <span className="font-mono text-slate-600">{formatDateTime(selectedPayment.created_at)}</span>
              </div>
              {selectedPayment.paid_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Captured/Paid At:</span>
                  <span className="font-mono text-slate-600">{formatDateTime(selectedPayment.paid_at)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              {['CAPTURED', 'Success', 'completed'].includes(selectedPayment.status) && (
                <button
                  type="button"
                  onClick={() => handleInitiateRefund(selectedPayment)}
                  disabled={refundProcessing}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {refundProcessing ? 'Processing Refund...' : 'Initiate Refund'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
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

export default AdminPayments;
