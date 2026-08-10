import React from 'react';
import { Sparkles, CloudRain, Sun, Wind, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

const AIDelayWidget = ({ trainNumber = '12952', routeName = 'NDLS -> MMCT' }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 text-white space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-purple-300">AI Route Delay & Weather Intelligence</h3>
            <p className="text-[10px] text-slate-400 font-mono">PREDICTIVE ANALYTICS ENGINE • TRAIN #{trainNumber}</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1 font-bold">
          <ShieldCheck className="h-3 w-3" /> 94% CONFIDENCE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Delay Risk Indicator */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">On-Time Probability</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">92.5%</div>
          <span className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block"></span> Low Delay Risk
          </span>
        </div>

        {/* Monsoon Weather Telemetry */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Route Weather</span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-black text-cyan-300 font-mono">28°C Clear</span>
            <Sun className="h-6 w-6 text-amber-400" />
          </div>
          <span className="text-[10px] text-slate-400 font-bold mt-2">Visibility: 10 km • Wind: 12 km/h</span>
        </div>

        {/* Track Congestion Meter */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Track Signal Clearance</span>
          <div className="text-xl font-black text-cyan-400 font-mono flex items-center gap-1">
            <Cpu className="h-5 w-5 text-cyan-400" /> Clear Corridor
          </div>
          <span className="text-[10px] text-slate-400 font-bold mt-2">Zero signal bottleneck reported</span>
        </div>

      </div>
    </div>
  );
};

export default AIDelayWidget;
