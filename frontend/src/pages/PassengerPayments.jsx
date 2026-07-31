import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, CheckCircle2, RefreshCw, Search, Ticket } from 'lucide-react';
import api from '../services/api';

const PassengerPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      // Map real payment records from user bookings list
      const bookingRecords = (res.data || []).map((b, idx) => {
        const txnId = b.payment?.payment_gateway_id || `TXN-${b.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10)}`;
        const actualMethod = b.payment?.payment_method || b.payment_method || 'Rail Wallet / Card';
        const trainName = b.train?.train_name ? `${b.train.train_name} (#${b.train.train_number || ''})` : 'Train Journey';
        
        return {
          id: b.id || `pay-${idx}`,
          txnId,
          pnr: b.pnr_number,
          trainName,
          amount: b.total_fare || b.payment?.amount || 500,
          date: b.booking_date || (b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          method: actualMethod,
          status: b.status === 'cancelled' ? 'Refunded' : 'Success'
        };
      });

      // Merge Rail Wallet transactions (top-ups and wallet payments) from localStorage
      const savedWalletTxns = JSON.parse(localStorage.getItem('railway_wallet_transactions') || '[]');
      const walletRecords = savedWalletTxns.map((w, idx) => ({
        id: w.id || `wallet-pay-${idx}`,
        txnId: w.reference || `RW-TXN-${idx + 100}`,
        pnr: w.title?.includes('PNR:') ? w.title.split('PNR:')[1].replace(')', '').trim() : 'Rail Wallet TopUp',
        trainName: w.title || 'Rail Wallet Credit',
        amount: w.amount,
        date: w.date ? new Date(w.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        method: 'IRCTC Rail Wallet',
        status: w.status === 'success' ? 'Success' : 'Completed'
      }));

      // Combine and deduplicate
      const allPayments = [...walletRecords, ...bookingRecords];
      const uniqueTxns = Array.from(new Map(allPayments.map(item => [item.txnId, item])).values());
      
      setPayments(uniqueTxns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 font-sans">Payment History</h1>
          <p className="text-xs text-slate-400">Audits and transaction details of all your train bookings.</p>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center text-slate-400">
            <CreditCard className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="font-bold text-slate-600 mb-1">No transaction records found</p>
            <p className="text-xs">Any booking or refund transactions will be listed here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Transaction ID</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">PNR Number</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Train details</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Date</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Method</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Amount</th>
                  <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 text-xs font-black text-slate-800 font-mono">{p.txnId}</td>
                    <td className="px-6 py-4 text-xs text-slate-550 font-semibold font-mono">{p.pnr}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-800">{p.trainName}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-semibold">{p.date}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-semibold">{p.method}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-800 font-mono">₹{p.amount}</td>
                    <td className="px-6 py-4 text-right text-xs font-bold">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full ${
                        p.status === 'Success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status === 'Success' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 text-amber-600 mr-1 animate-spin-reverse" />
                        )}
                        <span>{p.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PassengerPayments;
