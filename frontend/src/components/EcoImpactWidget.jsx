import React from 'react';
import { Leaf, ArrowRight, AlertCircle } from 'lucide-react';

const EcoImpactWidget = ({ distanceKm }) => {
  const isDistanceAvailable = typeof distanceKm === 'number' && !isNaN(distanceKm) && distanceKm > 0;

  // Compute exact values only when actual distance is available
  const flightCO2 = isDistanceAvailable ? Math.round(distanceKm * 0.1026) : null;
  const trainCO2 = isDistanceAvailable ? parseFloat((distanceKm * 0.01337).toFixed(1)) : null;
  const co2SavedKg = isDistanceAvailable ? Math.round(flightCO2 - trainCO2) : null;
  const reductionPercent = isDistanceAvailable && flightCO2 > 0 ? Math.round(((flightCO2 - trainCO2) / flightCO2) * 100) : null;

  return (
    <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 text-white space-y-4 shadow-2xl relative overflow-hidden">
      {/* Background glow accent */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-inner">
            <Leaf className="h-5 w-5 animate-pulse text-emerald-300" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-300 font-sans">
              Eco-Travel CO₂ Footprint Calculator
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-300 font-mono tracking-wider font-semibold">
              GREEN RAILWAY INITIATIVE &bull; NET ZERO COMMITMENT
            </p>
          </div>
        </div>

        {isDistanceAvailable ? (
          <span className="text-xs font-mono text-emerald-300 bg-emerald-500/25 px-3.5 py-1.5 rounded-full border border-emerald-400/40 font-black tracking-wide shadow-sm flex items-center space-x-1.5">
            <span>🌿</span>
            <span>{reductionPercent}% LOWER EMISSIONS</span>
          </span>
        ) : (
          <span className="text-xs font-mono text-slate-300 bg-slate-800/60 px-3.5 py-1.5 rounded-full border border-slate-700 font-semibold flex items-center space-x-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>DISTANCE NEEDED</span>
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10 pt-1 border-t border-emerald-500/20">
        <div>
          {isDistanceAvailable ? (
            <>
              <span className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-300 font-mono tracking-tight drop-shadow-md block">
                {co2SavedKg} kg CO₂ Saved
              </span>
              <p className="text-xs text-slate-200 font-medium leading-relaxed max-w-md mt-1">
                Calculated for your journey ({distanceKm} km) by choosing electric rail over a commercial flight!
              </p>
            </>
          ) : (
            <>
              <span className="text-xl sm:text-2xl font-black text-slate-300 font-mono tracking-tight block">
                Journey distance unavailable
              </span>
              <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-md mt-1">
                Select or book an active train journey to compute real-time electric rail CO₂ savings vs commercial flights.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4 text-xs font-mono text-slate-200 bg-slate-950/90 p-3.5 sm:p-4 rounded-2xl border border-emerald-500/30 shadow-xl shrink-0 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <span className="block text-slate-400 font-bold text-[10px] uppercase">Flight Emission</span>
            <span className="font-black text-rose-400 text-sm">
              {isDistanceAvailable ? `${flightCO2} kg CO₂` : '--'}
            </span>
          </div>

          <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0" />

          <div>
            <span className="block text-slate-400 font-bold text-[10px] uppercase">Electric Train</span>
            <span className="font-black text-emerald-300 text-sm">
              {isDistanceAvailable ? `${trainCO2} kg CO₂` : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EcoImpactWidget;
