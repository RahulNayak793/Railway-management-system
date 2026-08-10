import React, { useState } from 'react';
import { X, Sparkles, Eye, Info, RotateCw, Check } from 'lucide-react';

const CoachVRModal = ({ isOpen, onClose }) => {
  const [activeClass, setActiveClass] = useState('1A');

  if (!isOpen) return null;

  const coachTypes = [
    { id: '1A', name: 'Executive 1st AC Coupe', desc: 'Lockable 2/4 berth cabins, complimentary meals, attendant button & reading lights' },
    { id: '2A', name: 'AC 2-Tier Sleeper', desc: 'Curtained privacy berths, personal charging sockets & plush bedding' },
    { id: 'PANTRY', name: 'Gourmet Pantry Car 🍴', desc: 'Stainless steel chef kitchen, live hot meal preparation & espresso machines' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full text-white overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Eye className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>3D / 360° COACH VR PANORAMA TOUR</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">VIRTUAL REALITY EXPERIENCE • EXPLORE TRAIN INTERIORS</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Coach Class Tabs */}
          <div className="grid grid-cols-3 gap-2">
            {coachTypes.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveClass(c.id)}
                className={`p-3 rounded-2xl border text-xs font-black transition-all ${
                  activeClass === c.id 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-500/20 scale-102' 
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Simulated 360 VR View Canvas */}
          <div className="hero-mesh-bg rounded-2xl border border-slate-800 p-8 text-center relative overflow-hidden h-72 flex flex-col items-center justify-center shadow-2xl">
            <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800 text-[10px] font-mono text-purple-300 flex items-center gap-1.5">
              <RotateCw className="h-3 w-3 animate-spin-slow" /> 360° VR DRAG MODE ACTIVE
            </div>

            <div className="p-4 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 mb-3 animate-bounce">
              <Eye className="h-10 w-10" />
            </div>

            <h4 className="text-xl font-black text-white tracking-tight">
              {coachTypes.find(c => c.id === activeClass)?.name}
            </h4>
            <p className="text-xs text-slate-300 max-w-md mt-1 font-medium">
              {coachTypes.find(c => c.id === activeClass)?.desc}
            </p>

            {/* Interactive Feature Hotspots */}
            <div className="flex flex-wrap justify-center gap-2 mt-4 text-[10px] font-mono">
              <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-purple-500/30 text-purple-300">
                ✨ Personal LCD Touch Screen
              </span>
              <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/30 text-cyan-300">
                ⚡ 230V AC Power Socket
              </span>
              <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-300">
                🌡️ Individual Climate Control
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-lg shadow-purple-600/20"
          >
            Exit VR Tour
          </button>
        </div>

      </div>
    </div>
  );
};

export default CoachVRModal;
