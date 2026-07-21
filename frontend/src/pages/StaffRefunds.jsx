import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle, DollarSign, Calendar } from 'lucide-react';
import api from '../services/api';

const StaffRefunds = () => {
  const [refundRequests, setRefundRequests] = useState([
    { pnr: '423-8902514', passenger: 'Arjun Mehta', train: 'Shatabdi Exp (12002)', amount: 1250, date: '2026-07-10', status: 'Pending' },
    { pnr: '712-4591032', passenger: 'Priya Verma', train: 'Rajdhani Exp (12952)', amount: 2840, date: '2026-07-12', status: 'Pending' },
    { pnr: '289-5567120', passenger: 'Rahul Gupta', train: 'Garib Rath (12204)', amount: 850, date: '2026-07-11', status: 'Approved' },
    { pnr: '155-2231009', passenger: 'Anita Desai', train: 'Duronto Exp (12213)', amount: 1920, date: '2026-07-11', status: 'Rejected' }
  ]);
  const [loading, setLoading] = useState(false);

  const handleAction = (index, status) => {
    const updated = [...refundRequests];
    updated[index].status = status;
    setRefundRequests(updated);
    alert(`Refund claim successfully ${status.toLowerCase()}!`);
  };

  const pendingCount = refundRequests.filter(r => r.status === 'Pending').length;
  const approvedTotal = refundRequests
    .filter(r => r.status === 'Approved')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-extrabold text-slate-800">Refunds & Cancellation Processing</h1>
        <p className="text-xs text-slate-400">Process ticket cancellations and customer refund claims.</p>
      </div>

      {/* Analytics stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pending Claims</span>
          <div className="text-2xl font-black text-slate-800">{pendingCount} Requests</div>
          <p className="text-[10px] text-slate-400">SLA Target: &lt;4.5 Hours</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Refunded (Month)</span>
          <div className="text-2xl font-black text-slate-800">₹{approvedTotal.toLocaleString('en-IN')}</div>
          <p className="text-[10px] text-slate-400">Through banking gateways</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SLA Processing Time</span>
          <div className="text-2xl font-black text-emerald-600">3.2 Hours</div>
          <p className="text-[10px] text-slate-400">Exceeding SLA expectations</p>
        </div>
      </div>

      {/* Refunds Queue List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-800">Queue Management</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">PNR</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Passenger</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Train details</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Amount</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Request Date</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {refundRequests.map((r, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-xs font-mono font-bold text-slate-700">{r.pnr}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800">{r.passenger}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{r.train}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">₹{r.amount}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">{r.date}</td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className={`rounded-full px-2 py-0.5 ${
                      r.status === 'Pending' ? 'bg-amber-50 text-amber-700' : r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {r.status === 'Pending' ? (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleAction(index, 'Approved')}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(index, 'Rejected')}
                          className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold transition"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold italic">Processed</span>
                    )}
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

export default StaffRefunds;
