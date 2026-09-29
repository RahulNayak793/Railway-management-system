import React, { useState } from 'react';
import { Ticket, Search, CheckCircle, XCircle, AlertTriangle, ShieldCheck, QrCode } from 'lucide-react';
import api from '../services/api';

const StaffVerify = () => {
  const [pnr, setPnr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pnr) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/staff/ticket/verify', { pnr: pnr.trim(), checked_status: true });
      setResult(res.data);
    } catch (err) {
      setResult({
        valid: false,
        status: 'INVALID / CANCELLED',
        error: err.response?.data?.error || 'Verification failed. PNR not found or cancelled.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Ticket & PNR Verification Portal</h1>
        <p className="text-xs text-slate-500 font-medium">Verify passenger e-tickets, check PNR validity, and mark boarding status in real time.</p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Ticket className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-extrabold text-slate-800">PNR Lookup & Validation</h3>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Enter 10-Digit PNR Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. 8819203941"
                value={pnr}
                onChange={(e) => setPnr(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center space-x-2"
              >
                <Search className="h-4 w-4" />
                <span>{loading ? 'Verifying...' : 'Verify Ticket'}</span>
              </button>
            </div>
          </div>
        </form>

        {result && (
          <div className={`p-6 rounded-3xl border space-y-4 animate-scale-in ${
            result.valid 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
              : 'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}>
            <div className="flex justify-between items-center border-b border-slate-200/40 pb-3">
              <div className="flex items-center space-x-2">
                {result.valid ? <CheckCircle className="h-6 w-6 text-emerald-600" /> : <XCircle className="h-6 w-6 text-rose-600" />}
                <span className="text-lg font-black">{result.valid ? 'TICKET VALID & VERIFIED' : 'VERIFICATION FAILED'}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                result.valid ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600'
              }`}>
                {result.status || (result.valid ? 'VALID' : 'INVALID')}
              </span>
            </div>

            {result.valid ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Passenger Name</span>
                  <span className="text-sm font-extrabold text-slate-900">{result.passenger_name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">PNR Number</span>
                  <span className="text-sm font-mono font-extrabold text-blue-700">{result.pnr}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Travel Date</span>
                  <span className="font-extrabold text-slate-800">{result.travel_date || '2026-09-15'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Status Badge</span>
                  <span className="font-extrabold text-emerald-700">{result.status_badge || 'VERIFIED'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-rose-700">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffVerify;
