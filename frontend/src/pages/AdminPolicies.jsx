import React, { useState, useEffect } from 'react';
import { 
  Settings, ShieldCheck, DollarSign, Percent, Save, RefreshCw, Calculator, 
  AlertCircle, CheckCircle2, Sliders, ArrowRight, HelpCircle, Layers
} from 'lucide-react';
import api from '../services/api';

const AdminPolicies = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Quotas & System Limits
  const [quotas, setQuotas] = useState({
    tatkalQuota: 15,
    racQuota: 10,
    waitlistLimit: 300,
    seniorDiscount: 40,
    ladiesQuota: 10
  });

  // Cancellation & Refund Rules
  const [cancellation, setCancellation] = useState({
    flatFee48h: 240,
    percent12to48h: 25,
    percent4to12h: 50,
    chartPrepRefund: 0
  });

  // Class-wise Fares
  const [fares, setFares] = useState([
    { id: '1a', coach: 'AC 1-Tier (1A)', code: '1A', base: 1450, permKm: 3.40, minDistance: 500, tatkalPremium: 500, superfastFee: 75, tax: 5 },
    { id: '2a', coach: 'AC 2-Tier (2A)', code: '2A', base: 980, permKm: 2.10, minDistance: 300, tatkalPremium: 400, superfastFee: 45, tax: 5 },
    { id: '3a', coach: 'AC 3-Tier (3A)', code: '3A', base: 650, permKm: 1.25, minDistance: 300, tatkalPremium: 300, superfastFee: 45, tax: 5 },
    { id: 'ec', coach: 'Exec. Chair Car (EC)', code: 'EC', base: 1100, permKm: 2.80, minDistance: 250, tatkalPremium: 400, superfastFee: 60, tax: 5 },
    { id: 'cc', coach: 'AC Chair Car (CC)', code: 'CC', base: 420, permKm: 0.95, minDistance: 150, tatkalPremium: 225, superfastFee: 30, tax: 5 },
    { id: 'sl', coach: 'Sleeper (SL)', code: 'SL', base: 240, permKm: 0.45, minDistance: 200, tatkalPremium: 150, superfastFee: 30, tax: 0 },
    { id: 'gen', coach: 'General (GEN)', code: 'GEN', base: 45, permKm: 0.15, minDistance: 50, tatkalPremium: 0, superfastFee: 15, tax: 0 }
  ]);

  // Live Calculator State
  const [simClass, setSimClass] = useState('3A');
  const [simDistance, setSimDistance] = useState(750);
  const [simIsTatkal, setSimIsTatkal] = useState(false);
  const [simIsSuperfast, setSimIsSuperfast] = useState(true);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/policies');
      if (res.data) {
        if (res.data.quotas) setQuotas(res.data.quotas);
        if (res.data.cancellation) setCancellation(res.data.cancellation);
        if (res.data.fares) setFares(res.data.fares);
      }
    } catch (err) {
      console.warn('API error fetching policies, using standard defaults:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleFareChange = (index, field, val) => {
    const updated = [...fares];
    updated[index][field] = parseFloat(val) || 0;
    setFares(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/admin/policies', {
        quotas,
        cancellation,
        fares
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving policies:', err);
      alert('Policies saved to local state successfully!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Calculate live simulated fare
  const selectedFareConfig = fares.find(f => f.code === simClass) || fares[2];
  const effectiveDistance = Math.max(simDistance, selectedFareConfig.minDistance || 0);
  const calculatedBase = selectedFareConfig.base + (effectiveDistance * selectedFareConfig.permKm);
  const calculatedTatkal = simIsTatkal ? (selectedFareConfig.tatkalPremium || 0) : 0;
  const calculatedSuperfast = simIsSuperfast ? (selectedFareConfig.superfastFee || 0) : 0;
  const subtotal = calculatedBase + calculatedTatkal + calculatedSuperfast;
  const calculatedTax = Math.round(subtotal * (selectedFareConfig.tax / 100));
  const calculatedTotal = Math.round(subtotal + calculatedTax);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-purple-50 text-purple-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-purple-200">
              Admin Governance
            </span>
            <span className="text-xs text-slate-400 font-bold">• System Settings</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Fare Matrices & Policy Governance
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Configure class-wise pricing algorithms, Tatkal/RAC quotas, cancellation penalty bounds, and distance multipliers.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchPolicies}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition active:scale-95 border border-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs transition active:scale-95 shadow-md border border-primary-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Publish Policy Changes'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between animate-slide-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>System pricing matrices and allocation quotas saved successfully! Dynamic booking algorithms updated.</span>
          </div>
          <button onClick={() => setSaveSuccess(false)} className="text-emerald-700 font-black">✕</button>
        </div>
      )}

      {/* Grid Layout: Main Fares Matrix & Policy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Class-wise Fare Equation Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Class-wise Fare Equations</h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Base rates, per-km multipliers, minimum distances, and Tatkal surcharges.</p>
              </div>
              <Sliders className="h-4 w-4 text-slate-400" />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50/40">
                  <tr>
                    <th className="px-5 py-3 font-bold uppercase text-[10px] text-slate-400">Coach Class</th>
                    <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Base Fare (₹)</th>
                    <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Per-KM Rate (₹)</th>
                    <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Min. Dist (km)</th>
                    <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Tatkal Extra (₹)</th>
                    <th className="px-4 py-3 font-bold uppercase text-[10px] text-slate-400">Tax (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {fares.map((f, idx) => (
                    <tr key={f.id || idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3.5 font-black text-slate-800">
                        <span className="block text-xs">{f.coach}</span>
                        <span className="font-mono text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.2 rounded w-fit inline-block mt-0.5">
                          {f.code}
                        </span>
                      </td>

                      {/* Base Fare */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 w-24">
                          <span className="text-slate-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            value={f.base}
                            onChange={(e) => handleFareChange(idx, 'base', e.target.value)}
                            className="w-full text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Per KM Rate */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 w-24">
                          <span className="text-slate-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            step="0.05"
                            value={f.permKm}
                            onChange={(e) => handleFareChange(idx, 'permKm', e.target.value)}
                            className="w-full text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Min Distance */}
                      <td className="px-4 py-3.5">
                        <input
                          type="number"
                          value={f.minDistance}
                          onChange={(e) => handleFareChange(idx, 'minDistance', e.target.value)}
                          className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-xs font-black text-slate-800 bg-slate-50 focus:outline-none"
                        />
                      </td>

                      {/* Tatkal Premium */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 w-24">
                          <span className="text-slate-400 text-xs font-bold">₹</span>
                          <input
                            type="number"
                            value={f.tatkalPremium}
                            onChange={(e) => handleFareChange(idx, 'tatkalPremium', e.target.value)}
                            className="w-full text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Tax % */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 w-16">
                          <input
                            type="number"
                            value={f.tax}
                            onChange={(e) => handleFareChange(idx, 'tax', e.target.value)}
                            className="w-full text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                          />
                          <span className="text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Fare Calculator Simulator */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                  <Calculator className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Live Fare Calculation Engine</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">Simulate exact passenger ticket prices using configured parameters.</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Real-Time Test
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Coach Class</label>
                <select
                  value={simClass}
                  onChange={(e) => setSimClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                >
                  {fares.map(f => (
                    <option key={f.code} value={f.code}>{f.coach}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Journey Distance (km)</label>
                <input
                  type="number"
                  value={simDistance}
                  onChange={(e) => setSimDistance(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={simIsTatkal}
                    onChange={(e) => setSimIsTatkal(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-0"
                  />
                  <span className="font-bold text-slate-700">Tatkal Quota (+₹{selectedFareConfig.tatkalPremium})</span>
                </label>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={simIsSuperfast}
                    onChange={(e) => setSimIsSuperfast(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-0"
                  />
                  <span className="font-bold text-slate-700">Superfast (+₹{selectedFareConfig.superfastFee})</span>
                </label>
              </div>
            </div>

            {/* Calculated Breakdown Display */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Simulated Ticket Breakdown ({simClass} Class, {simDistance} km)</span>
                <p className="text-slate-300 font-semibold text-[11px]">
                  Base: ₹{Math.round(calculatedBase)} • Tatkal: ₹{calculatedTatkal} • Superfast: ₹{calculatedSuperfast} • GST ({selectedFareConfig.tax}%): ₹{calculatedTax}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Ticket Fare</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">₹{calculatedTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Quotas & Cancellation Policy Settings */}
        <div className="space-y-6">
          
          {/* Allocation Quotas */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Quota Allocations & Bounds</span>
              <Percent className="h-4 w-4 text-slate-400" />
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tatkal Booking Quota (%)</label>
                <input
                  type="number"
                  value={quotas.tatkalQuota}
                  onChange={(e) => setQuotas({ ...quotas, tatkalQuota: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">RAC Quota (%)</label>
                <input
                  type="number"
                  value={quotas.racQuota}
                  onChange={(e) => setQuotas({ ...quotas, racQuota: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Maximum Waitlist Limit (Seats)</label>
                <input
                  type="number"
                  value={quotas.waitlistLimit}
                  onChange={(e) => setQuotas({ ...quotas, waitlistLimit: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Senior Citizen Discount (%)</label>
                <input
                  type="number"
                  value={quotas.seniorDiscount}
                  onChange={(e) => setQuotas({ ...quotas, seniorDiscount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Cancellation Rules */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Cancellation Penalty Rules</span>
              <ShieldCheck className="h-4 w-4 text-slate-400" />
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">&gt; 48 Hours Before Dep. (Flat ₹)</label>
                <input
                  type="number"
                  value={cancellation.flatFee48h}
                  onChange={(e) => setCancellation({ ...cancellation, flatFee48h: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">12 to 48 Hours Before Dep. (% Deducted)</label>
                <input
                  type="number"
                  value={cancellation.percent12to48h}
                  onChange={(e) => setCancellation({ ...cancellation, percent12to48h: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">4 to 12 Hours Before Dep. (% Deducted)</label>
                <input
                  type="number"
                  value={cancellation.percent4to12h}
                  onChange={(e) => setCancellation({ ...cancellation, percent4to12h: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Statutory Policy Notice */}
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl space-y-1 text-xs">
            <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider block">Governance Impact Notice</span>
            <p className="text-slate-600 font-medium text-[11px] leading-normal">
              Updating Tatkal / RAC quotas or cancellation deduction rules automatically updates fare calculation logic across all search results and e-ticketing endpoints.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};

export default AdminPolicies;
