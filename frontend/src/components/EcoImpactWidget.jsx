import React from 'react';
import { Leaf, Award, ShieldCheck, ArrowRight } from 'lucide-react';

const EcoImpactWidget = ({ distanceKm = 1384 }) => {
  const co2SavedKg = Math.round(distanceKm * 0.035);

  return (
    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-5 md:p-6 text-white space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Leaf className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-300">Eco-Travel CO2 Footprint Calculator</h3>
            <p className="text-[10px] text-slate-300 font-mono">GREEN RAILWAY INITIATIVE &bull; NET ZERO COMMITMENT</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 font-bold">
          🌿 84% LOWER EMISSIONS
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
        <div>
          <span className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">
            {co2SavedKg} kg CO₂ Saved
          </span>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            By choosing electric rail over a commercial flight or highway car for this trip!
          </p>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-300 bg-slate-900/80 p-3 rounded-2xl border border-emerald-500/20">
          <div>
            <span className="block text-slate-400">Flight Emission</span>
            <span className="font-bold text-rose-400">142 kg CO₂</span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-500" />
          <div>
            <span className="block text-slate-400">Electric Train</span>
            <span className="font-bold text-emerald-400">18.5 kg CO₂</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EcoImpactWidget;
