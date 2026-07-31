import React, { useState, useEffect } from 'react';
import { CreditCard, Search, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchAdminPayments = async () => {
      setLoading(true);
      try {
        const res = await api.get('/bookings');
        const list = (res.data || []).map((b, idx) => ({
          id: b.payment?.payment_gateway_id || `tx-${idx + 1}`,
          pnr: b.pnr_number,
          passengerName: b.allocations?.[0]?.passenger_name || 'Passenger',
          gate: b.payment?.payment_method || 'Rail Wallet / Online',
          amount: `₹ ${b.total_fare || 500}`,
          time: b.created_at ? new Date(b.created_at).toLocaleString() : b.booking_date,
          status: b.status === 'cancelled' ? 'Refunded' : 'Success'
        }));
        setPayments(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminPayments();
  }, []);

  const filtered = payments.filter(p => !query || p.pnr.includes(query) || p.passengerName.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-extrabold text-slate-800">Payments & Transactions Audit</h1>
        <p className="text-xs text-slate-400">Track and monitor payment gateways, booking checkout states, and refund records.</p>
      </div>

      {/* Roster list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span>Operational Transactions Feed</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-855">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search payments PNR..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              Loading financial transactions audit feed...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              No matching transaction records found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Transaction ID</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">PNR Reference</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Passenger</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Payment Gateway</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Amount Paid</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Timestamp</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-55/50 transition">
                  <td className="px-6 py-4 text-sm font-black text-slate-500 font-mono">{p.id}</td>
                  <td className="px-6 py-4 text-sm font-black text-slate-800 font-mono">{p.pnr}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-850">{p.passengerName}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">{p.gate}</td>
                  <td className="px-6 py-4 text-sm text-slate-800 font-black font-mono">{p.amount}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">{p.time}</td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className={`px-2 py-0.5 rounded border ${
                      p.status === 'Success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
