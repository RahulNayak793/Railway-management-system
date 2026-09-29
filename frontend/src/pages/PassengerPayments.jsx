import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CreditCard, Calendar, CheckCircle2, RefreshCw, Search, Ticket, FileText, ArrowRight, Wallet, ShieldCheck } from 'lucide-react';
import api from '../services/api';

const PassengerPayments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const handleViewReceipt = (p) => {
    setSelectedReceipt(p);
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // 1. Fetch real payment history records from backend API
      const historyRes = await api.get('/payments/history');
      const historyList = Array.isArray(historyRes.data) ? historyRes.data : [];

      // 2. Fetch server wallet ledger
      let walletTxns = [];
      try {
        const walletRes = await api.get('/payments/wallet');
        walletTxns = walletRes.data?.transactions || [];
      } catch (wErr) {
        console.warn('Wallet transactions fetch fallback:', wErr);
      }

      // Format payment history records
      const formattedHistory = historyList.map((p, idx) => ({
        id: p.id || `pay-${idx}`,
        txnId: p.txnId || p.payment_gateway_id || `TXN-${idx + 100}`,
        pnr: p.pnr || 'N/A',
        trainName: p.trainName || 'Train Journey',
        amount: Number(p.amount || 0),
        date: p.paymentDate || p.created_at ? String(p.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
        method: p.method || p.payment_method || 'IRCTC Rail Wallet',
        status: p.status || 'Success',
        refundStatus: p.refund_status || (p.status === 'cancelled' ? 'Refunded' : 'N/A'),
        type: 'booking'
      }));

      // Format wallet ledger records
      const formattedWallet = walletTxns.map((w, idx) => ({
        id: w.id || `w-pay-${idx}`,
        txnId: w.reference || `RW-${idx + 100}`,
        pnr: w.title?.includes('PNR:') ? w.title.split('PNR:')[1].replace(')', '').trim() : 'Rail Wallet Ledger',
        trainName: w.title || 'Rail Wallet Transaction',
        amount: Number(w.amount || 0),
        date: w.date ? String(w.date).split('T')[0] : new Date().toISOString().split('T')[0],
        method: 'IRCTC Rail Wallet',
        status: w.status === 'success' ? 'Success' : 'Completed',
        refundStatus: w.type === 'credit' && w.title?.toLowerCase().includes('refund') ? 'Refund Credit' : 'N/A',
        type: w.type || 'wallet'
      }));

      // Merge and deduplicate by Transaction ID
      const merged = [...formattedHistory, ...formattedWallet];
      const unique = Array.from(new Map(merged.map(item => [item.txnId, item])).values());
      
      // Sort newest first
      unique.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(unique);
    } catch (err) {
      console.error('Error loading payment history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter(p => {
    const matchesSearch = !searchQuery || 
      p.txnId.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.pnr.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.trainName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'SUCCESS' && (p.status === 'Success' || p.status === 'completed')) ||
      (statusFilter === 'REFUNDED' && (p.refundStatus === 'Refunded' || p.refundStatus === 'Refund Credit'));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Payment History & Receipts</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Audit log of all ticket reservations, gateway transactions, and wallet refunds.</p>
        </div>
        <button
          onClick={fetchPayments}
          className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 transition"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2 border border-slate-200 rounded-xl px-3.5 py-2 text-xs bg-slate-50 w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by Transaction ID, PNR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent focus:outline-none w-full font-semibold text-slate-700"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['ALL', 'SUCCESS', 'FAILED', 'PENDING', 'REFUNDED'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                statusFilter === f ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
            <p className="text-xs font-bold text-slate-400 mt-2">Loading verified financial ledger...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center text-slate-400">
            <CreditCard className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="font-bold text-slate-700 mb-1">No transaction records found</p>
            <p className="text-xs text-slate-500">Your verified ticket bookings and wallet debits will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Transaction ID</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">PNR Reference</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Details / Train</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Gateway</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-xs">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-mono font-black text-slate-800">{p.txnId}</td>
                    <td className="px-6 py-4 font-mono font-bold text-primary-700">
                      {p.pnr !== 'N/A' && p.pnr !== 'Rail Wallet Ledger' ? p.pnr : '-'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{p.trainName}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">{p.date}</td>
                    <td className="px-6 py-4 font-semibold text-slate-600">{p.method}</td>
                    <td className="px-6 py-4 font-mono font-black text-slate-900">₹{p.amount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] border ${
                        p.refundStatus === 'Refunded' || p.refundStatus === 'Refund Credit'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : p.status === 'FAILED' || p.status === 'Failed'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        <span>{p.refundStatus === 'Refunded' ? 'Refunded' : p.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewReceipt(p)}
                        className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer"
                        title="View Official Demo Payment Receipt"
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>Receipt</span>
                      </button>
                      {p.pnr && p.pnr !== 'N/A' && p.pnr !== 'Rail Wallet Ledger' && (
                        <button
                          onClick={() => navigate(`/passenger/ticket/${p.pnr}`)}
                          className="inline-flex items-center space-x-1 bg-primary-50 hover:bg-primary-100 text-primary-800 font-extrabold px-3 py-1 rounded-lg border border-primary-200 text-[11px] transition cursor-pointer"
                        >
                          <FileText className="h-3 w-3 text-primary-600" />
                          <span>E-Ticket</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OFFICIAL PAYMENT RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-slate-100 space-y-6 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  OFFICIAL RAILWAY PAYMENT RECEIPT
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">RailControl Payment Acknowledgment</h2>
                <p className="text-xs text-slate-400 font-mono">Ministry of Railways • Center for Railway Information Systems</p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs font-sans">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Transaction ID</span>
                <span className="font-mono font-black text-slate-900">{selectedReceipt.txnId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">PNR Reference</span>
                <span className="font-mono font-black text-primary-700">{selectedReceipt.pnr}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Service / Train</span>
                <span className="font-bold text-slate-800">{selectedReceipt.trainName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Payment Method</span>
                <span className="font-semibold text-slate-700">{selectedReceipt.method}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Amount Paid</span>
                <span className="font-mono font-black text-emerald-700 text-base">₹{Number(selectedReceipt.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Payment Status</span>
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  {selectedReceipt.refundStatus === 'Refunded' ? 'REFUNDED' : selectedReceipt.status?.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Transaction Date</span>
                <span className="font-mono text-slate-600">{selectedReceipt.date}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-extrabold shadow transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
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

export default PassengerPayments;
