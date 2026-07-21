import React, { useState } from 'react';
import { Settings, ShieldCheck, DollarSign, Percent, Save } from 'lucide-react';

const AdminPolicies = () => {
  const [tatkalQuota, setTatkalQuota] = useState('15');
  const [waitlistLimit, setWaitlistLimit] = useState('300');
  const [racQuota, setRacQuota] = useState('10');
  
  const [fares, setFares] = useState([
    { coach: 'Sleeper (SL)', base: 240, permKm: 0.45, tax: 5 },
    { coach: 'AC 3-Tier (3A)', base: 650, permKm: 1.25, tax: 5 },
    { coach: 'AC 2-Tier (2A)', base: 980, permKm: 2.10, tax: 5 },
    { coach: 'AC 1-Tier (1A)', base: 1450, permKm: 3.40, tax: 5 },
    { coach: 'General (GEN)', base: 45, permKm: 0.15, tax: 0 }
  ]);

  const handleFareChange = (index, field, val) => {
    const updated = [...fares];
    updated[index][field] = parseFloat(val) || 0;
    setFares(updated);
  };

  const handleSave = () => {
    alert('System settings and fare structures saved successfully!');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-extrabold text-slate-800">Fare & Policy Configuration</h1>
        <p className="text-xs text-slate-400">Configure class-wise fare equations, seat allocation percentages, and cancellation parameters.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Class-wise Fare Config Table */}
        <div className="lg:col-span-2 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden self-start">
          <div className="bg-slate-50 border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold text-slate-800">Class-wise Fare Matrices</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Coach Class</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Base Fare (₹)</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Per-KM Rate</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Tax (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {fares.map((f, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-700">{f.coach}</td>
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        value={f.base}
                        onChange={(e) => handleFareChange(idx, 'base', e.target.value)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        step="0.05"
                        value={f.permKm}
                        onChange={(e) => handleFareChange(idx, 'permKm', e.target.value)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        value={f.tax}
                        onChange={(e) => handleFareChange(idx, 'tax', e.target.value)}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-xs font-semibold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Allocation policy settings */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-3">Allocation Policies</h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-600">
              <div>
                <label className="block mb-1 text-slate-400 uppercase text-[9px]">RAC Quota (%)</label>
                <input
                  type="number"
                  value={racQuota}
                  onChange={(e) => setRacQuota(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400 uppercase text-[9px]">Tatkal Quota Quota (%)</label>
                <input
                  type="number"
                  value={tatkalQuota}
                  onChange={(e) => setTatkalQuota(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400 uppercase text-[9px]">Waitlist Limit Bounds</label>
                <input
                  type="number"
                  value={waitlistLimit}
                  onChange={(e) => setWaitlistLimit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
                />
              </div>

              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3.5 font-bold text-white shadow"
              >
                <Save className="h-4.5 w-4.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-primary-100 bg-primary-50/30 p-4 space-y-1">
            <span className="text-[10px] font-bold text-primary-700 uppercase block tracking-wider">Policy Impact Notice</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Updating Tatkal/RAC allocation quotas will directly alter booking algorithms and seat maps generations for travel dates after 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPolicies;
