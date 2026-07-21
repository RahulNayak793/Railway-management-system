import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Train, Search, Compass, MapPin, Gauge, ShieldCheck, Share2, Clock, CheckCircle2, Navigation, AlertCircle, Copy } from 'lucide-react';
import api from '../services/api';

// Route Stops configuration for seeded trains
const TRAIN_STOPS_MAP = {
  '12952': [
    { code: 'NDLS', name: 'New Delhi', arr: '--:--', dep: '16:30', plat: '12', distance: 0 },
    { code: 'KOTA', name: 'Kota Junction', arr: '21:00', dep: '21:05', plat: '1', distance: 465 },
    { code: 'RTM', name: 'Ratlam Junction', arr: '00:02', dep: '00:10', plat: '4', distance: 731 },
    { code: 'BRC', name: 'Vadodara Junction', arr: '03:30', dep: '03:35', plat: '2', distance: 992 },
    { code: 'MMCT', name: 'Mumbai Central', arr: '08:20', dep: '--:--', plat: '1', distance: 1384 }
  ],
  '12002': [
    { code: 'NDLS', name: 'New Delhi', arr: '--:--', dep: '06:00', plat: '1', distance: 0 },
    { code: 'AGC', name: 'Agra Cantt', arr: '07:50', dep: '07:55', plat: '1', distance: 188 },
    { code: 'GWL', name: 'Gwalior Junction', arr: '09:23', dep: '09:25', plat: '2', distance: 306 },
    { code: 'VGLJ', name: 'VGL Jhansi Junction', arr: '10:45', dep: '10:53', plat: '1', distance: 403 },
    { code: 'BPL', name: 'Bhopal Junction', arr: '14:25', dep: '--:--', plat: '5', distance: 707 }
  ],
  '22436': [
    { code: 'NDLS', name: 'New Delhi', arr: '--:--', dep: '06:00', plat: '16', distance: 0 },
    { code: 'CNB', name: 'Kanpur Central', arr: '10:08', dep: '10:10', plat: '1', distance: 440 },
    { code: 'PRYJ', name: 'Prayagraj Junction', arr: '12:08', dep: '12:10', plat: '6', distance: 633 },
    { code: 'BSB', name: 'Varanasi Junction', arr: '14:00', dep: '--:--', plat: '1', distance: 759 }
  ],
  '12301': [
    { code: 'HWH', name: 'Howrah Junction', arr: '--:--', dep: '16:55', plat: '8', distance: 0 },
    { code: 'ASN', name: 'Asansol Junction', arr: '18:57', dep: '18:59', plat: '4', distance: 200 },
    { code: 'PNBE', name: 'Patna Junction', arr: '22:10', dep: '22:20', plat: '1', distance: 532 },
    { code: 'DDU', name: 'Pt. Deen Dayal Upadhyaya', arr: '01:25', dep: '01:35', plat: '2', distance: 743 },
    { code: 'NDLS', name: 'New Delhi', arr: '10:00', dep: '--:--', plat: '12', distance: 1450 }
  ],
  '12050': [
    { code: 'NZM', name: 'Hazrat Nizamuddin', arr: '--:--', dep: '08:10', plat: '5', distance: 0 },
    { code: 'AGC', name: 'Agra Cantt', arr: '09:50', dep: '--:--', plat: '1', distance: 188 }
  ]
};

const LiveTracking = () => {
  const [searchParams] = useSearchParams();
  const trainIdFromParam = searchParams.get('train_id');

  const [query, setQuery] = useState('');
  const [activeTrain, setActiveTrain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Simulated live telemetry state
  const [progress, setProgress] = useState(38); // Journey progress percentage (0 - 100)
  const [speed, setSpeed] = useState(115); // Simulated locomotive speed in km/h
  const [locoStatus, setLocoStatus] = useState('Active - WAP7');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query) return;
    setLoading(true);
    try {
      const res = await api.get('/trains');
      const matched = res.data.find(t => t.train_number === query || t.train_name.toLowerCase().includes(query.toLowerCase()));
      if (matched) {
        setActiveTrain(matched);
        // Random start progress for visual simulation
        setProgress(22 + Math.floor(Math.random() * 40));
      } else {
        alert('Train not found. Try searching for a valid train number e.g. 12952.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectTrainNumber = async (number) => {
    setLoading(true);
    try {
      const res = await api.get('/trains');
      const matched = res.data.find(t => t.train_number === number);
      if (matched) {
        setActiveTrain(matched);
        setProgress(30 + Math.floor(Math.random() * 30));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadDefault = async () => {
      if (trainIdFromParam) {
        setLoading(true);
        try {
          const res = await api.get('/trains');
          const matched = res.data.find(t => t.id === trainIdFromParam);
          if (matched) {
            setActiveTrain(matched);
            setProgress(35);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    };
    loadDefault();
  }, [trainIdFromParam]);

  // Speed and Progress simulator interval
  useEffect(() => {
    if (!activeTrain) return;

    // Simulate progress speed crawl
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 0;
        return parseFloat((prev + 0.05).toFixed(2));
      });
    }, 1500);

    // Simulate speed variations
    const speedInterval = setInterval(() => {
      setSpeed(prev => {
        const variation = Math.floor(Math.random() * 9) - 4; // -4 to +4
        const nextSpeed = prev + variation;
        return Math.max(95, Math.min(nextSpeed, 135));
      });
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(speedInterval);
    };
  }, [activeTrain]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleShare = () => {
    if (!activeTrain) return;
    const shareUrl = `${window.location.origin}/passenger/track?train_id=${activeTrain.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Live tracking status link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Resolve stations stops for active train
  const activeStops = activeTrain ? (TRAIN_STOPS_MAP[activeTrain.train_number] || [
    { code: 'START', name: 'Origin Station', arr: '--:--', dep: '08:00', plat: '1', distance: 0 },
    { code: 'MID', name: 'Intermediate Station', arr: '12:00', dep: '12:05', plat: '2', distance: 400 },
    { code: 'END', name: 'Destination Station', arr: '16:00', dep: '--:--', plat: '3', distance: 800 }
  ]) : [];

  const totalDistance = activeStops[activeStops.length - 1]?.distance || 1000;
  const currentDistance = (progress / 100) * totalDistance;

  // Enrich stops status based on simulated distance progress
  const enrichedStops = activeStops.map((stop, index) => {
    const stopProgressPercent = (stop.distance / totalDistance) * 100;
    
    let status = 'upcoming';
    let label = '';
    
    if (progress >= stopProgressPercent) {
      status = 'passed';
    }
    
    return {
      ...stop,
      percent: stopProgressPercent,
      status
    };
  });

  // Identify next stop
  const nextStopIndex = enrichedStops.findIndex(s => s.status === 'upcoming');
  let nextStop = null;
  if (nextStopIndex !== -1) {
    enrichedStops[nextStopIndex].status = 'current';
    enrichedStops[nextStopIndex].label = 'NEXT STOP';
    nextStop = enrichedStops[nextStopIndex];
    if (nextStopIndex > 0) {
      enrichedStops[nextStopIndex - 1].status = 'just-passed';
    }
  }

  // Calculate dynamic ETA to next stop
  const getETA = () => {
    if (!nextStop) return 'Arrived';
    const distToNext = nextStop.distance - currentDistance;
    const hours = distToNext / speed;
    const mins = Math.round(hours * 60);
    if (mins < 1) return 'Approaching...';
    if (mins < 60) return `In ${mins} mins`;
    return `In ${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 font-sans space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 bg-slate-900 border border-slate-800 text-white text-xs font-bold py-3 px-5 rounded-xl shadow-2xl z-50 animate-bounce flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header section */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Live Train Tracking</h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">Track real-time train positions, speed, platform updates and stops timeline.</p>
        </div>

        {/* Train Lookup Search */}
        <form onSubmit={handleSearch} className="flex space-x-2 w-full sm:max-w-xs flex-shrink-0">
          <div className="flex flex-1 items-center bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 shadow-inner">
            <Search className="h-4 w-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="e.g. 12952 or Rajdhani"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none placeholder:text-slate-400 font-extrabold text-slate-850"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#003366] hover:bg-[#002550] text-white px-4 py-2 text-xs font-black transition-all shadow-sm"
          >
            Track
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#003366] border-r-transparent align-[-0.125em]" />
          <p className="text-xs text-slate-400 font-bold mt-3">Connecting to GPS telemetry sat...</p>
        </div>
      ) : activeTrain ? (
        <div className="space-y-6">
          
          {/* Active Train Status Card */}
          <div className="bg-[#f0f5fc] rounded-2xl border border-blue-150 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3.5">
              <div className="rounded-xl bg-[#003366]/10 p-3 text-[#003366]">
                <Train className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] bg-[#003366]/10 text-[#003366] font-black px-2 py-0.5 rounded-md font-mono">
                  #{activeTrain.train_number}
                </span>
                <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight mt-1">{activeTrain.train_name}</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  Route: {activeStops[0]?.name} &rarr; {activeStops[activeStops.length - 1]?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-stretch md:self-auto justify-between">
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black border uppercase ${
                activeTrain.status === 'on_time' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {activeTrain.status === 'on_time' ? 'ON TIME' : `DELAYED ${activeTrain.delay_minutes}m`}
              </span>
              <button
                onClick={handleShare}
                className="flex items-center space-x-1.5 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-700 transition active:scale-95 shadow-sm"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Live Status</span>
              </button>
            </div>
          </div>

          {/* SVG Animated Route Progress Map */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Route Progress</h3>
            
            <div className="relative pt-6 pb-2 px-6 bg-slate-50/50 rounded-xl border border-slate-100">
              <svg viewBox="0 0 1000 80" className="w-full h-auto overflow-visible" xmlns="http://www.w3.org/2000/svg">
                {/* Background tracks */}
                <line x1="50" y1="40" x2="950" y2="40" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
                {/* Covered track progress */}
                <line x1="50" y1="40" x2={50 + (progress / 100) * 900} y2="40" stroke="#0052cc" strokeWidth="4" strokeLinecap="round" />
                
                {/* Stop Nodes */}
                {enrichedStops.map((stop, idx) => {
                  const x = 50 + (stop.percent / 100) * 900;
                  
                  let fill = '#ffffff';
                  let stroke = '#94a3b8';
                  let radius = 6;
                  
                  if (stop.status === 'passed' || stop.status === 'just-passed') {
                    fill = '#0052cc';
                    stroke = '#0052cc';
                  } else if (stop.status === 'current') {
                    fill = '#22c55e';
                    stroke = '#22c55e';
                    radius = 8;
                  }
                  
                  return (
                    <g key={idx}>
                      <circle cx={x} cy="40" r={radius} fill={fill} stroke={stroke} strokeWidth="3" />
                      <text x={x} y="20" textAnchor="middle" className="text-[9px] font-black text-slate-500 font-mono tracking-wider">{stop.code}</text>
                      <text x={x} y="62" textAnchor="middle" className="text-[8px] font-extrabold text-slate-450 truncate max-w-[80px]">{stop.name.split(' ')[0]}</text>
                    </g>
                  );
                })}

                {/* Animated Train Indicator Pin */}
                {(() => {
                  const trainX = 50 + (progress / 100) * 900;
                  return (
                    <g className="animate-pulse">
                      <circle cx={trainX} cy="40" r="14" fill="#0052cc" fillOpacity="0.15" />
                      <circle cx={trainX} cy="40" r="10" fill="#0052cc" fillOpacity="0.25" />
                      <circle cx={trainX} cy="40" r="5" fill="#f83a3a" stroke="#ffffff" strokeWidth="2" />
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Grid split: Telemetry & Vertical Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Left Column: Telemetry details */}
            <div className="md:col-span-4 space-y-4">
              
              {/* Speed speedometer card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Locomotive Speed</span>
                  <div className="text-2xl font-black text-slate-850 mt-1 flex items-baseline space-x-1">
                    <span className="text-3xl font-black tracking-tight">{speed}</span>
                    <span className="text-xs font-bold text-slate-400">km/h</span>
                  </div>
                  <span className="text-[9.5px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-2 inline-block">
                    ⚡ Traction: AC Electric
                  </span>
                </div>
                <div className="p-3 rounded-full bg-blue-50 text-blue-750">
                  <Gauge className="h-8 w-8" />
                </div>
              </div>

              {/* Next stop ETA card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Next Station ETA</span>
                  <div className="text-2xl font-black text-slate-850 mt-1 flex items-baseline space-x-1">
                    <span className="text-2xl font-black tracking-tight text-blue-750">{getETA()}</span>
                  </div>
                  <span className="text-[9.5px] font-semibold text-slate-500 block mt-2">
                    Next Stop: <strong className="text-slate-700">{nextStop ? nextStop.name : 'Destination'}</strong>
                  </span>
                </div>
                <div className="p-3 rounded-full bg-slate-50 text-slate-600">
                  <Clock className="h-8 w-8" />
                </div>
              </div>

              {/* Progress distance card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Journey Progress</span>
                <div className="flex items-center justify-between text-xs font-black text-slate-750 mt-2">
                  <span>{progress}% Completed</span>
                  <span className="font-mono">{Math.round(currentDistance)} / {totalDistance} km</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden shadow-inner">
                  <div className="bg-blue-650 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              {/* Locomotive engine specs */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Telemetry specs</span>
                <div className="space-y-2.5 text-[11px] font-semibold">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Locomotive Model</span>
                    <span className="font-extrabold text-slate-800">WAP-7 (Co-Co Class)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Total Power</span>
                    <span className="font-extrabold text-slate-800">6,350 Horsepower</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Platform</span>
                    <span className="font-extrabold text-blue-750">PF {nextStop ? nextStop.plat : '1'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Vertical Timeline stops */}
            <div className="md:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Stops & Schedules Timings</h3>

              <div className="relative pl-8 border-l-2 border-slate-150 space-y-6 py-2 ml-4">
                {enrichedStops.map((stop, idx) => {
                  let pointStyle = 'border-slate-300 bg-white text-slate-300';
                  let textStyle = 'text-slate-400 font-semibold';
                  let cardStyle = 'border-transparent bg-transparent';
                  
                  if (stop.status === 'passed' || stop.status === 'just-passed') {
                    pointStyle = 'border-[#003366] bg-[#003366] text-white shadow-sm';
                    textStyle = 'text-slate-500 font-bold';
                  } else if (stop.status === 'current') {
                    pointStyle = 'border-green-500 bg-green-500 text-white ring-4 ring-green-100 animate-pulse';
                    textStyle = 'text-slate-850 font-black';
                    cardStyle = 'bg-green-50/50 border-green-100 border p-3.5 rounded-2xl shadow-sm';
                  } else {
                    textStyle = 'text-slate-700 font-bold';
                  }

                  return (
                    <div key={idx} className={`relative transition-all duration-300 ${cardStyle}`}>
                      
                      {/* Timeline locator node */}
                      <span className={`absolute left-[-45px] top-1 flex h-6 w-6 items-center justify-center rounded-full border transition-all ${pointStyle}`}>
                        {stop.status === 'passed' || stop.status === 'just-passed' ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-white" />
                        ) : stop.status === 'current' ? (
                          <Navigation className="h-3 w-3 text-white rotate-45" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        )}
                      </span>

                      {/* Content block */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-slate-100 border border-slate-200 rounded font-mono font-black px-1.5 py-0.5 text-slate-500">
                              {stop.code}
                            </span>
                            <span className={`text-sm tracking-tight ${textStyle}`}>{stop.name}</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center space-x-1.5">
                            <span>Platform {stop.plat}</span>
                            <span>&bull;</span>
                            <span>Sch Arr: {stop.arr}</span>
                            <span>&bull;</span>
                            <span>Sch Dep: {stop.dep}</span>
                          </p>
                        </div>

                        {stop.label && (
                          <span className="rounded-full bg-green-150 text-green-800 px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider animate-pulse">
                            {stop.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* Popular Quick Select list */
        <div className="space-y-6">
          
          {/* Simulated Compass select banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-xl mx-auto space-y-4">
            <div className="h-16 w-16 bg-blue-50 text-blue-750 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Compass className="h-8 w-8 animate-spin-slow" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800">Track Current Train Location</h3>
              <p className="text-xs text-slate-450 leading-relaxed">
                Enter your train number in the search input above or quick select a seeded route below to launch GPS simulation.
              </p>
            </div>
          </div>

          {/* Quick Select Grid cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Quick Select Active Routes</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { number: '12952', name: 'Mumbai Rajdhani Express', route: 'Delhi NDLS &harr; Mumbai Central', badge: 'Superfast' },
                { number: '12002', name: 'Bhopal Shatabdi Express', route: 'Delhi NDLS &harr; Bhopal Junction', badge: 'Express' },
                { number: '22436', name: 'Vande Bharat Express', route: 'Delhi NDLS &harr; Varanasi Junction', badge: 'Semi-Highspeed' },
                { number: '12301', name: 'Kolkata Rajdhani Express', route: 'Howrah HWH &harr; New Delhi', badge: 'Superfast' },
                { number: '12050', name: 'Gatimaan Express', route: 'Nizamuddin NZM &harr; Agra Cantt', badge: 'Highspeed' }
              ].map((item) => (
                <div 
                  key={item.number}
                  onClick={() => selectTrainNumber(item.number)}
                  className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-500/40 hover:-translate-y-0.5 transition duration-200 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10.5px] bg-blue-50 text-blue-750 font-black px-2 py-0.5 rounded font-mono border border-blue-100">
                        #{item.number}
                      </span>
                      <span className="text-[9px] bg-slate-50 text-slate-450 font-extrabold px-1.5 py-0.5 rounded border border-slate-100">
                        {item.badge}
                      </span>
                    </div>
                    <h5 className="text-xs font-black text-slate-800">{item.name}</h5>
                    <p className="text-[10px] text-slate-400 font-bold mt-1" dangerouslySetInnerHTML={{ __html: item.route }}></p>
                  </div>
                  
                  <button 
                    type="button" 
                    className="w-full mt-4 bg-slate-50 hover:bg-blue-50 text-[#003366] py-2 rounded-xl text-[10.5px] font-black border border-slate-200 hover:border-blue-150 transition text-center"
                  >
                    Start Live Tracking &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default LiveTracking;
