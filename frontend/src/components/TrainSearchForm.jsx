import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  ArrowRightLeft
} from 'lucide-react';
import api from '../services/api';
import { indianStations } from '../utils/stationsData';

const TrainSearchForm = ({ initialData = {}, onSearchSubmit, darkVariant = false }) => {
  const navigate = useNavigate();

  const [source, setSource] = useState(initialData.source || '');
  const [sourceCode, setSourceCode] = useState(initialData.sourceCode || '');
  const [destination, setDestination] = useState(initialData.destination || '');
  const [destCode, setDestCode] = useState(initialData.destCode || '');
  const [travelDate, setTravelDate] = useState(initialData.travelDate || '');
  const [passengerCount, setPassengerCount] = useState(initialData.passengers || '1');
  const [quota, setQuota] = useState(initialData.quota || 'GN');
  const [isSwapping, setIsSwapping] = useState(false);

  const [stations, setStations] = useState([]);
  const [showSourceList, setShowSourceList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);

  useEffect(() => {
    const fetchStations = async () => {
      const stationsMock = indianStations.map((st, idx) => ({
        id: `st-mock-${idx}`,
        station_name: st.name,
        station_code: st.code,
        state: st.state
      }));

      try {
        const res = await api.get('/trains/stations');
        if (res.data && res.data.length > 0) {
          setStations(res.data.map((s, idx) => ({
            id: s.id || `st-db-${idx}`,
            station_name: s.station_name || s.name || '',
            station_code: s.station_code || s.code || ''
          })));
        } else {
          setStations(stationsMock);
        }
      } catch (err) {
        setStations(stationsMock);
      }
    };
    fetchStations();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.station-search-container')) {
        setShowSourceList(false);
        setShowDestList(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const filterAndSortStations = (stationsList, query) => {
    if (!query) return stationsList.slice(0, 8);
    const lowerQuery = query.toLowerCase();
    
    const exactMatches = [];
    const startMatches = [];
    const includeMatches = [];
    
    stationsList.forEach(s => {
      const lowerName = s.station_name.toLowerCase();
      const lowerCode = s.station_code.toLowerCase();
      
      if (lowerCode === lowerQuery) {
        exactMatches.push(s);
      } else if (lowerName.startsWith(lowerQuery) || lowerCode.startsWith(lowerQuery)) {
        startMatches.push(s);
      } else if (lowerName.includes(lowerQuery) || lowerCode.includes(lowerQuery)) {
        includeMatches.push(s);
      }
    });
    
    return [...exactMatches, ...startMatches, ...includeMatches].slice(0, 8);
  };

  const filteredSourceStations = filterAndSortStations(stations, source);
  const filteredDestStations = filterAndSortStations(stations, destination);

  const swapStations = () => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 500);
    const tempSrc = source;
    const tempSrcCode = sourceCode;
    setSource(destination);
    setSourceCode(destCode);
    setDestination(tempSrc);
    setDestCode(tempSrcCode);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const finalSource = (sourceCode || source).trim().toUpperCase();
    const finalDest = (destCode || destination).trim().toUpperCase();

    if (!finalSource || !finalDest || !travelDate) {
      alert('Please fill out all search parameters');
      return;
    }

    if (finalSource === finalDest) {
      alert('Source and Destination stations cannot be the same!');
      return;
    }

    if (onSearchSubmit) {
      onSearchSubmit({ source: finalSource, destination: finalDest, date: travelDate, passengers: passengerCount, quota });
    } else {
      navigate(`/passenger/search?source=${finalSource}&destination=${finalDest}&date=${travelDate}&passengers=${passengerCount}&quota=${quota}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="p-0 sm:p-6 w-full">
      <div className="flex flex-col xl:flex-row gap-4 items-end relative w-full">
        
        {/* From Station */}
        <div className="relative w-full xl:flex-1 station-search-container">
          <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 pl-1 ${darkVariant ? 'text-slate-300' : 'text-slate-400'}`}>From</label>
          <div className={`flex items-center backdrop-blur-sm rounded-2xl px-4 py-3.5 border transition-all duration-300 shadow-sm hover:shadow-md ${
            darkVariant 
              ? 'bg-white/10 border-white/20 text-white focus-within:bg-white/20 focus-within:ring-white/30 focus-within:border-white/40' 
              : 'bg-white/80 border-slate-200 text-slate-850 focus-within:bg-white focus-within:ring-primary-500/20 focus-within:border-primary-500'
          }`}>
            <MapPin className={`h-4.5 w-4.5 mr-2.5 flex-shrink-0 ${darkVariant ? 'text-primary-300' : 'text-primary-400'}`} />
            <input
              type="text"
              placeholder="From Station"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setSourceCode('');
                setShowSourceList(true);
              }}
              onFocus={() => setShowSourceList(true)}
              className={`w-full text-sm bg-transparent focus:outline-none font-bold ${
                darkVariant ? 'placeholder:text-slate-300 text-white' : 'placeholder:text-slate-400 text-slate-800'
              }`}
              required
            />
          </div>
          
          {/* Desktop Swap Button floating between From and To */}
          <button 
            type="button" 
            onClick={swapStations} 
            className={`absolute right-[-24px] top-[34px] z-20 h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-sm hidden xl:flex ${
              darkVariant 
                ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                : 'bg-white hover:bg-slate-50 border border-slate-200 hover:shadow-md hover:border-primary-200'
            }`}
            title="Swap stations"
          >
            <ArrowRightLeft className={`h-4.5 w-4.5 transition-transform duration-500 ${isSwapping ? 'rotate-180' : ''} ${
              darkVariant ? 'text-primary-300' : 'text-primary-600'
            }`} />
          </button>

          {/* Autocomplete list */}
          {showSourceList && (
            <div className={`absolute left-0 right-0 mt-2 max-h-48 overflow-y-auto backdrop-blur-md rounded-2xl border shadow-2xl z-30 py-1.5 text-xs font-semibold scrollbar-thin ${
              darkVariant ? 'bg-slate-900/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200/80 text-slate-800'
            }`}>
              {filteredSourceStations.length === 0 ? (
                <div className={`px-4 py-2.5 ${darkVariant ? 'text-slate-400' : 'text-slate-400'}`}>No stations found</div>
              ) : (
                filteredSourceStations.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSource(`${s.station_name} (${s.station_code})`);
                      setSourceCode(s.station_code);
                      setShowSourceList(false);
                    }}
                    className={`px-4 py-2.5 cursor-pointer flex justify-between border-b last:border-0 ${
                      darkVariant 
                        ? 'hover:bg-slate-800/80 hover:text-white border-slate-800' 
                        : 'hover:bg-primary-50/70 hover:text-primary-950 border-slate-50'
                    }`}
                  >
                    <span>{s.station_name}</span>
                    <span className={`font-mono font-bold ${darkVariant ? 'text-slate-400' : 'text-slate-400'}`}>{s.station_code}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Mobile Swap Button displayed centered only on small screens */}
        <div className="flex items-center justify-center xl:hidden py-1 w-full">
          <button 
            type="button" 
            onClick={swapStations} 
            className={`h-10 w-10 rounded-full flex items-center justify-center transition active:scale-90 shadow-md ${
              darkVariant 
                ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600' 
                : 'bg-white hover:bg-slate-50 border border-slate-200'
            }`}
            title="Swap stations"
          >
            <ArrowRightLeft className={`h-4.5 w-4.5 transition-transform duration-500 ${isSwapping ? 'rotate-180' : ''} ${
              darkVariant ? 'text-primary-300' : 'text-primary-600'
            }`} />
          </button>
        </div>

        {/* To Station */}
        <div className="relative w-full xl:flex-1 station-search-container">
          <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 pl-1 ${darkVariant ? 'text-slate-300' : 'text-slate-400'}`}>To</label>
          <div className={`flex items-center backdrop-blur-sm rounded-2xl px-4 py-3.5 border transition-all duration-300 shadow-sm hover:shadow-md ${
            darkVariant 
              ? 'bg-white/10 border-white/20 text-white focus-within:bg-white/20 focus-within:ring-white/30 focus-within:border-white/40' 
              : 'bg-white/80 border-slate-200 text-slate-850 focus-within:bg-white focus-within:ring-primary-500/20 focus-within:border-primary-500'
          }`}>
            <MapPin className={`h-4.5 w-4.5 mr-2.5 flex-shrink-0 ${darkVariant ? 'text-primary-300' : 'text-primary-400'}`} />
            <input
              type="text"
              placeholder="To Station"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setDestCode('');
                setShowDestList(true);
              }}
              onFocus={() => setShowDestList(true)}
              className={`w-full text-sm bg-transparent focus:outline-none font-bold ${
                darkVariant ? 'placeholder:text-slate-300 text-white' : 'placeholder:text-slate-400 text-slate-800'
              }`}
              required
            />
          </div>

          {/* Autocomplete list */}
          {showDestList && (
            <div className={`absolute left-0 right-0 mt-2 max-h-48 overflow-y-auto backdrop-blur-md rounded-2xl border shadow-2xl z-30 py-1.5 text-xs font-semibold scrollbar-thin ${
              darkVariant ? 'bg-slate-900/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200/80 text-slate-800'
            }`}>
              {filteredDestStations.length === 0 ? (
                <div className={`px-4 py-2.5 ${darkVariant ? 'text-slate-400' : 'text-slate-400'}`}>No stations found</div>
              ) : (
                filteredDestStations.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setDestination(`${s.station_name} (${s.station_code})`);
                      setDestCode(s.station_code);
                      setShowDestList(false);
                    }}
                    className={`px-4 py-2.5 cursor-pointer flex justify-between border-b last:border-0 ${
                      darkVariant 
                        ? 'hover:bg-slate-800/80 hover:text-white border-slate-800' 
                        : 'hover:bg-primary-50/70 hover:text-primary-950 border-slate-50'
                    }`}
                  >
                    <span>{s.station_name}</span>
                    <span className={`font-mono font-bold ${darkVariant ? 'text-slate-400' : 'text-slate-400'}`}>{s.station_code}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Journey Date */}
        <div className="relative w-full xl:w-[170px] shrink-0">
          <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 pl-1 ${darkVariant ? 'text-slate-300' : 'text-slate-400'}`}>Journey Date</label>
          <div className={`flex items-center backdrop-blur-sm rounded-2xl px-3 py-3.5 border transition-all duration-300 shadow-sm hover:shadow-md ${
            darkVariant 
              ? 'bg-white/10 border-white/20 text-white focus-within:bg-white/20 focus-within:ring-white/30 focus-within:border-white/40' 
              : 'bg-white/80 border-slate-200 text-slate-850 focus-within:bg-white focus-within:ring-primary-500/20 focus-within:border-primary-500'
          }`}>
            <Calendar className={`h-4.5 w-4.5 mr-2 flex-shrink-0 ${darkVariant ? 'text-primary-300' : 'text-primary-400'}`} />
            <input
              type="date"
              value={travelDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setTravelDate(e.target.value)}
              className={`w-full text-sm bg-transparent focus:outline-none font-bold cursor-pointer ${
                darkVariant ? 'text-white style-color-scheme-dark' : 'text-slate-800'
              }`}
              required
            />
          </div>
        </div>

        {/* Class / Quota */}
        <div className="relative w-full xl:w-[150px] shrink-0">
          <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 pl-1 ${darkVariant ? 'text-slate-300' : 'text-slate-400'}`}>Class</label>
          <div className={`flex items-center backdrop-blur-sm rounded-2xl px-3 py-3.5 border transition-all duration-300 shadow-sm hover:shadow-md ${
            darkVariant 
              ? 'bg-white/10 border-white/20 text-white focus-within:bg-white/20 focus-within:ring-white/30 focus-within:border-white/40' 
              : 'bg-white/80 border-slate-200 text-slate-850 focus-within:bg-white focus-within:ring-primary-500/20 focus-within:border-primary-500'
          }`}>
            <Users className={`h-4.5 w-4.5 mr-1.5 flex-shrink-0 ${darkVariant ? 'text-primary-300' : 'text-primary-400'}`} />
            <select
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              className={`w-[110px] text-xs md:text-sm bg-transparent focus:outline-none font-bold cursor-pointer pr-1 ${
                darkVariant ? 'text-slate-900 bg-white' : 'text-slate-800'
              }`}
              style={darkVariant ? { color: '#0f172a' } : {}}
            >
              <option value="GN">All Classes</option>
              <option value="LD">Ladies (LD)</option>
              <option value="SR">Sr. Citizen</option>
              <option value="HP">Divyangjan</option>
            </select>
          </div>
        </div>

        {/* Search Button */}
        <div className="relative w-full xl:w-[160px] shrink-0">
          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 px-4 py-[14px] font-black text-sm text-white shadow-xl shadow-primary-600/30 hover:shadow-primary-600/40 transition-all duration-300 active:scale-[0.96] border border-white/20 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <Search className="h-4.5 w-4.5 relative z-10 group-hover:scale-110 transition-transform" />
            <span className="relative z-10">Search Trains</span>
          </button>
        </div>

      </div>
    </form>
  );
};

export default TrainSearchForm;
