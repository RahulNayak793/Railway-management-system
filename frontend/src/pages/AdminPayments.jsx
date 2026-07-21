import React, { useState } from 'react';
import { CreditCard, Search, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';

const AdminPayments = () => {
  const [payments, setPayments] = useState([
    { id: 'tx-1', pnr: '6543210981', passengerName: 'Ramesh Kumar', gate: 'UPI (PhonePe)', amount: '₹ 1,250', time: '17 Jul 2026, 10:15 AM', status: 'Success' },
    { id: 'tx-2', pnr: '6543210982', passengerName: 'Suresh Patel', gate: 'NetBanking (SBI)', amount: '₹ 780', time: '17 Jul 2026, 09:40 AM', status: 'Success' },
    { id: 'tx-3', pnr: '6543210983', passengerName: 'Anita Sharma', gate: 'Credit Card (HDFC)', amount: '₹ 560', time: '17 Jul 2026, 08:12 AM', status: 'Pending' },
    { id: 'tx-4', pnr: '6543210984', passengerName: 'Vikram Singh', gate: 'Debit Card (ICICI)', amount: '₹ 980', time: '16 Jul 2026, 09:20 PM', status: 'Success' }
  ]);

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
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {payments.map((p) => (
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
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
