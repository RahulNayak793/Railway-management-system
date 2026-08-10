import React, { useState } from 'react';
import { MapPin, X, Coffee, ShieldAlert, Car, ShoppingBag, Info, Navigation, ArrowRight } from 'lucide-react';

const StationMapModal = ({ isOpen, onClose, stationName = 'New Delhi Central (NDLS)' }) => {
  const [selectedPoi, setSelectedPoi] = useState(null);

  if (!isOpen) return null;

  const pois = [
    { id: 'p1', name: 'Platform 1 - 4 (Express Trains)', icon: Navigation, type: 'Platform', color: 'bg-blue-500' },
    { id: 'p2', name: 'Executive VIP Lounge', icon: Coffee, type: 'Lounge', color: 'bg-amber-500', desc: 'Complimentary buffet, AC recliner seating & high-speed Wi-Fi' },
    { id: 'p3', name: 'Railway Protection Force (RPF) Post', icon: ShieldAlert, type: 'Security', color: 'bg-rose-500', desc: '24/7 Security assistance & lost item desk' },
    { id: 'p4', name: 'Station Taxi Stand & Metro Link', icon: Car, type: 'Transport', color: 'bg-emerald-500', desc: 'Prepaid taxi booth and direct underground metro concourse' },
    { id: 'p5', name: 'IRCTC Food Plaza & Retail', icon: ShoppingBag, type: 'Food', color: 'bg-purple-500', desc: '24-hour multi-cuisine food court and travel essentials' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full text-white overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">{stationName}</h3>
              <p className="text-xs text-slate-400 font-mono">INTERACTIVE 2D STATION MAP & PLATFORM PILLAR GUIDE</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Interactive 2D Blueprint Graphic */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 relative overflow-hidden">
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>Concourse Level 1 Layout</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE PLATFORM TELEMETRY</span>
            </div>

            {/* Simulated Station Map SVG */}
            <div className="relative w-full h-64 bg-slate-900/90 rounded-xl border border-slate-800/80 p-4 flex flex-col justify-between">
              
              {/* Platforms Row Top */}
              <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <span className="text-xs font-mono font-bold text-amber-400">PLATFORMS 16 - 12 (NORTH WING)</span>
                <span className="text-[10px] text-slate-400">PILLARS 1 - 30</span>
              </div>

              {/* Central Concourse */}
              <div className="grid grid-cols-5 gap-2 my-4">
                {pois.map(poi => {
                  const Icon = poi.icon;
                  const isSelected = selectedPoi?.id === poi.id;
                  return (
                    <button
                      key={poi.id}
                      onClick={() => setSelectedPoi(poi)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                        isSelected 
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 scale-105 shadow-lg shadow-cyan-500/20' 
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-1 text-cyan-400" />
                      <span className="text-[10px] font-extrabold text-center line-clamp-1">{poi.type}</span>
                    </button>
                  );
                })}
              </div>

              {/* Platforms Row Bottom */}
              <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <span className="text-xs font-mono font-bold text-cyan-400">PLATFORMS 1 - 5 (MAIN EXPRESS WING)</span>
                <span className="text-[10px] text-slate-400">PILLARS 1 - 32</span>
              </div>
            </div>
          </div>

          {/* Selected POI Info Details Box */}
          {selectedPoi && (
            <div className="bg-slate-800/60 border border-cyan-500/30 rounded-2xl p-4 flex items-start space-x-4 animate-fade-in">
              <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Info className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">{selectedPoi.type} Location</span>
                <h4 className="text-base font-black text-white">{selectedPoi.name}</h4>
                <p className="text-xs text-slate-300 mt-1">{selectedPoi.desc || 'Located in main station central concourse.'}</p>
              </div>
            </div>
          )}

          {/* Platform Pillar Coach Boarding Guide Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-wider">Coach Platform Pillar Boarding Guide</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {[
                { coach: 'H1 (1A)', pillar: 'Pillar 4 - 6' },
                { coach: 'A1 (2A)', pillar: 'Pillar 7 - 10' },
                { coach: 'B1 - B3 (3A)', pillar: 'Pillar 11 - 18' },
                { coach: 'S1 - S4 (SL)', pillar: 'Pillar 19 - 28' },
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">COACH {item.coach}</span>
                  <span className="text-sm font-black text-amber-400 mt-0.5 block">{item.pillar}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition shadow-lg shadow-cyan-500/20"
          >
            Close Map
          </button>
        </div>

      </div>
    </div>
  );
};

export default StationMapModal;
