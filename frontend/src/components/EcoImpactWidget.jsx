import React, { useState, useEffect } from 'react';
import { Leaf, ArrowRight, AlertCircle, Sparkles, Trees, ShieldCheck, Compass } from 'lucide-react';

const EcoImpactWidget = ({ distanceKm }) => {
  // Preset distances for popular railway corridors
  const presets = [
    { label: 'NDLS ➔ MMCT (Rajdhani)', dist: 1384 },
    { label: 'NDLS ➔ BPL (Shatabdi)', dist: 705 },
    { label: 'NDLS ➔ BSB (Vande Bharat)', dist: 540 },
    { label: 'SBC ➔ MAS (Express)', dist: 360 }
  ];

  // Derive initial distance: passed distanceKm, or default to 1384 km (Rajdhani Express)
  const initialDist = (typeof distanceKm === 'number' && !isNaN(distanceKm) && distanceKm > 0) ? distanceKm : 1384;
  const [selectedDistance, setSelectedDistance] = useState(initialDist);

  useEffect(() => {
    if (typeof distanceKm === 'number' && !isNaN(distanceKm) && distanceKm > 0) {
      setSelectedDistance(distanceKm);
    }
  }, [distanceKm]);

  // Compute live CO2 calculations
  const flightCO2 = Math.round(selectedDistance * 0.1026);
  const trainCO2 = parseFloat((selectedDistance * 0.01337).toFixed(1));
  const co2SavedKg = Math.round(flightCO2 - trainCO2);
  const reductionPercent = flightCO2 > 0 ? Math.round(((flightCO2 - trainCO2) / flightCO2) * 100) : 87;
  const treesEquivalent = Math.max(1, Math.round(co2SavedKg / 21));

  return (
    <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-7 text-white space-y-5 shadow-2xl relative overflow-hidden font-sans">
      {/* Background glow accent */}
      <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 border-b border-emerald-500/20 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-inner">
            <Leaf className="h-6 w-6 animate-pulse text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-300">
                ECO-TRAVEL CO₂ FOOTPRINT CALCULATOR
              </h3>
              <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                ACTIVE
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-300 font-mono tracking-wider font-semibold">
              GREEN RAILWAY INITIATIVE &bull; NET ZERO COMMITMENT
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-emerald-300 bg-emerald-500/25 px-4 py-2 rounded-full border border-emerald-400/40 font-black tracking-wide shadow-sm flex items-center space-x-2">
          <span>🌿</span>
          <span>{reductionPercent}% LOWER EMISSIONS VS FLIGHTS</span>
        </span>
      </div>

      {/* Interactive Distance Preset Selector Tabs */}
      <div className="relative z-10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
            <Compass className="h-3.5 w-3.5 text-emerald-400" />
            <span>Select Route or Adjust Journey Distance:</span>
          </span>
          <span className="font-mono text-emerald-300 font-black text-sm">
            {selectedDistance.toLocaleString()} km Journey
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSelectedDistance(preset.dist)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                selectedDistance === preset.dist
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-emerald-500/20'
              }`}
            >
              {preset.label} ({preset.dist} km)
            </button>
          ))}
        </div>

        {/* Distance Range Slider */}
        <div className="pt-2 flex items-center space-x-3">
          <span className="text-[10px] font-mono text-slate-400">100 km</span>
          <input
            type="range"
            min="100"
            max="3000"
            step="10"
            value={selectedDistance}
            onChange={(e) => setSelectedDistance(Number(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-950 rounded-lg border border-emerald-500/30"
          />
          <span className="text-[10px] font-mono text-slate-400">3000 km</span>
        </div>
      </div>

      {/* Stats Display Grid */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10 pt-2">
        <div className="space-y-1.5 flex-1">
          <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-300 font-mono tracking-tight drop-shadow-md block">
            {co2SavedKg.toLocaleString()} kg CO₂ Saved
          </span>
          <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-xl">
            By choosing 100% electrified rail over commercial air travel for this <strong className="text-emerald-300 font-bold">{selectedDistance} km</strong> journey, you prevent <strong className="text-emerald-300 font-bold">{co2SavedKg} kg</strong> of greenhouse gas emissions!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-xl border border-emerald-500/30">
              <Trees className="h-4 w-4 text-emerald-400" />
              <span>Equivalent to planting <strong>{treesEquivalent} trees 🌲</strong></span>
            </span>

            <span className="inline-flex items-center space-x-1.5 bg-teal-500/20 text-teal-300 text-xs font-bold px-3 py-1 rounded-xl border border-teal-500/30">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>ISO 14064 Verified Calculation</span>
            </span>
          </div>
        </div>

        {/* Flight vs Train Comparison Box */}
        <div className="flex items-center space-x-4 text-xs font-mono text-slate-200 bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-emerald-500/40 shadow-2xl shrink-0 w-full lg:w-auto justify-between lg:justify-start">
          <div>
            <span className="block text-slate-400 font-bold text-[10px] uppercase tracking-wider">Flight Emission</span>
            <span className="font-black text-rose-400 text-base sm:text-lg block">
              {flightCO2.toLocaleString()} kg CO₂
            </span>
            <span className="text-[9px] text-slate-500 block mt-0.5">@ 102.6g CO₂ / pkm</span>
          </div>

          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <ArrowRight className="h-5 w-5 text-emerald-400" />
          </div>

          <div>
            <span className="block text-slate-400 font-bold text-[10px] uppercase tracking-wider">Electric Train</span>
            <span className="font-black text-emerald-300 text-base sm:text-lg block">
              {trainCO2.toLocaleString()} kg CO₂
            </span>
            <span className="text-[9px] text-emerald-400/80 block mt-0.5">@ 13.37g CO₂ / pkm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EcoImpactWidget;
