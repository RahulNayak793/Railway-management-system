import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Calendar, 
  ArrowRightLeft,
  Briefcase,
  Sparkles,
  Crown,
  Eye,
  Coffee,
  Wind,
  Shield,
  Layers,
  Zap,
  Ticket,
  Grid,
  Heart,
  UserCheck,
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';
import api from '../services/api';
import { indianStations } from '../utils/stationsData';
import CustomDropdown from './CustomDropdown';

export const CLASS_OPTIONS = [
  { value: 'ALL', code: 'ALL', label: 'All Classes', icon: Briefcase, description: 'All Travel Classes' },
  { value: 'SL', code: 'SL', label: 'Sleeper (SL)', icon: Shield, description: 'Sleeper Class (Non-AC)' },
  { value: '3E', code: '3E', label: 'AC 3 Economy (3E)', icon: Layers, description: 'AC 3-Tier Economy Sleeper' },
  { value: '3A', code: '3A', label: 'AC 3 Tier (3A)', icon: Layers, description: 'AC 3-Tier Sleeper' },
  { value: '2A', code: '2A', label: 'AC 2 Tier (2A)', icon: Wind, description: 'AC 2-Tier Sleeper' },
  { value: 'CC', code: 'CC', label: 'Chair Car (CC)', icon: Zap, description: 'AC Chair Car' },
  { value: 'EC', code: 'EC', label: 'Exec. Chair Car (EC)', icon: Coffee, description: 'Executive Chair Car' },
  { value: '2S', code: '2S', label: 'Second Sitting (2S)', icon: Ticket, description: 'Second Sitting Reserved' },
  { value: 'GEN', code: 'GEN', label: 'General / Unreserved (GEN)', icon: Ticket, description: 'General / Unreserved Class' },
  { value: '1A', code: '1A', label: 'AC First Class (1A)', icon: Crown, description: 'First AC Coupe / Cabin' },
  { value: 'FC', code: 'FC', label: 'First Class (FC)', icon: Shield, description: 'First Class Non-AC' },
  { value: 'EA', code: 'EA', label: 'Anubhuti Class (EA)', icon: Sparkles, description: 'Executive Luxury Chair Car' },
  { code: 'EV', value: 'EV', label: 'Vistadome AC (EV)', icon: Eye, description: 'Panoramic Glass Roof AC' },
  { code: 'VC', value: 'VC', label: 'Vistadome Chair Car (VC)', icon: Eye, description: 'Vistadome Non-AC' }
];

export const QUOTA_OPTIONS = [
  { value: 'GN', code: 'GN', altValues: ['GN', 'GENERAL'], label: 'GENERAL', icon: Grid, description: 'Standard Booking Quota' },
  { value: 'LD', code: 'LD', altValues: ['LD', 'LADIES'], label: 'LADIES', icon: Heart, description: 'Ladies Reserved Quota' },
  { value: 'SR', code: 'SR', altValues: ['SR', 'LOWER_BERTH', 'LOWER BERTH / SR. CITIZEN'], label: 'LOWER BERTH / SR. CITIZEN', icon: UserCheck, description: 'Senior Citizen & Lower Berth' },
  { value: 'HP', code: 'HP', altValues: ['HP', 'PERSON_WITH_DISABILITY'], label: 'PERSON WITH DISABILITY', icon: ShieldCheck, description: 'Divyangjan Concession Quota' },
  { value: 'DP', code: 'DP', altValues: ['DP', 'DUTY_PASS'], label: 'DUTY PASS', icon: Briefcase, description: 'Railway Duty Pass Holders' },
  { value: 'TQ', code: 'TQ', altValues: ['TQ', 'TATKAL'], label: 'TATKAL', icon: Zap, description: 'Tatkal Emergency Booking' },
  { value: 'PT', code: 'PT', altValues: ['PT', 'PREMIUM_TATKAL'], label: 'PREMIUM TATKAL', icon: Crown, description: 'Dynamic Fare Tatkal Quota' }
];

const normalizeDateStr = (dStr) => {
  if (!dStr) return '';
  const clean = String(dStr).trim();
  const ddmmyyyy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }
  return clean;
};

const TrainSearchForm = ({ initialData = {}, onSearchSubmit, darkVariant = false }) => {
  const navigate = useNavigate();

  const [source, setSource] = useState(initialData.source || '');
  const [sourceCode, setSourceCode] = useState(initialData.sourceCode || '');
  const [destination, setDestination] = useState(initialData.destination || '');
  const [destCode, setDestCode] = useState(initialData.destCode || '');
  const [travelDate, setTravelDate] = useState(normalizeDateStr(initialData.travelDate || initialData.date) || '');
  const [passengerCount, setPassengerCount] = useState(initialData.passengers || '1');
  const [selectedClass, setSelectedClass] = useState(initialData.selectedClass || initialData.class || 'ALL');
  const [quota, setQuota] = useState(initialData.quota || 'GN');
  const [disabilityConcession, setDisabilityConcession] = useState(initialData.disabilityConcession === true || initialData.disabilityConcession === 'true');
  const [railwayPassConcession, setRailwayPassConcession] = useState(initialData.railwayPassConcession === true || initialData.railwayPassConcession === 'true');
  
  useEffect(() => {
    setSource(initialData.source || '');
    setSourceCode(initialData.sourceCode || '');
    setDestination(initialData.destination || '');
    setDestCode(initialData.destCode || '');
    setTravelDate(normalizeDateStr(initialData.travelDate || initialData.date) || '');
    if (initialData.passengers) setPassengerCount(initialData.passengers);
    if (initialData.selectedClass || initialData.class) setSelectedClass(initialData.selectedClass || initialData.class);
    if (initialData.quota) setQuota(initialData.quota);
    if (initialData.disabilityConcession !== undefined) setDisabilityConcession(initialData.disabilityConcession === true || initialData.disabilityConcession === 'true');
    if (initialData.railwayPassConcession !== undefined) setRailwayPassConcession(initialData.railwayPassConcession === true || initialData.railwayPassConcession === 'true');
  }, [
    initialData.source, initialData.sourceCode, initialData.destination, initialData.destCode, 
    initialData.travelDate, initialData.date, initialData.passengers, initialData.selectedClass, 
    initialData.class, initialData.quota, initialData.disabilityConcession, initialData.railwayPassConcession
  ]);

  const [isSwapping, setIsSwapping] = useState(false);
  const [stations, setStations] = useState([]);
  const [showSourceList, setShowSourceList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);

  useEffect(() => {
    const fetchStations = async () => {
      const stationsMock = indianStations.map((st, idx) => {
        const rawCode = (st.code || '').toUpperCase();
        const code = (rawCode === 'UDU' || rawCode === 'UDUPI') ? 'UD' : rawCode;
        return {
          id: `st-mock-${idx}`,
          station_name: (code === 'UD' || rawCode === 'UDU') ? 'Udupi' : st.name,
          station_code: code,
          state: st.state
        };
      });

      try {
        const res = await api.get('/trains/stations');
        const validData = (res.data || []).filter(s => 
          (s.station_code || '').toUpperCase() !== 'ADMIN' &&
          (s.station_name || '').toUpperCase() !== 'ADMIN'
        );
        if (validData.length > 0) {
          setStations(validData.map((s, idx) => {
            const rawCode = (s.station_code || s.code || '').toUpperCase();
            const code = (rawCode === 'UDU' || rawCode === 'UDUPI') ? 'UD' : rawCode;
            const name = (code === 'UD' || rawCode === 'UDU') ? 'Udupi' : (s.station_name || s.name || '');
            return {
              id: s.id || `st-db-${idx}`,
              station_name: name,
              station_code: code,
              state: s.state || s.city || ''
            };
          }));
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
      const isUdupiMatch = (lowerQuery === 'udu' || lowerQuery === 'udupi') && (lowerCode === 'ud' || lowerName.includes('udupi'));
      
      if (lowerCode === lowerQuery || isUdupiMatch) {
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
    let finalSource = (sourceCode || source).trim().toUpperCase();
    if (finalSource === 'UDU' || finalSource === 'UDUPI') finalSource = 'UD';
    let finalDest = (destCode || destination).trim().toUpperCase();
    if (finalDest === 'UDU' || finalDest === 'UDUPI') finalDest = 'UD';

    if (!finalSource || !finalDest || !travelDate) {
      alert('Please fill out all search parameters (From station, To station, Journey Date)');
      return;
    }

    if (finalSource === finalDest) {
      alert('Source and Destination stations cannot be the same!');
      return;
    }

    const payload = { 
      source: finalSource, 
      destination: finalDest, 
      date: travelDate, 
      passengers: passengerCount, 
      class: selectedClass, 
      selectedClass: selectedClass,
      quota, 
      disabilityConcession, 
      railwayPassConcession 
    };

    if (onSearchSubmit) {
      onSearchSubmit(payload);
    } else {
      navigate(`/passenger/search?source=${finalSource}&destination=${finalDest}&date=${travelDate}&class=${selectedClass}&quota=${quota}&disabilityConcession=${disabilityConcession}&railwayPassConcession=${railwayPassConcession}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="p-0 sm:p-6 w-full space-y-4">
      
      {/* Row 1: From Station & To Station */}
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
                      const displayCode = (s.station_code === 'UDU' || s.station_code === 'UDUPI') ? 'UD' : s.station_code;
                      setSource(`${s.station_name} (${displayCode})`);
                      setSourceCode(displayCode);
                      setShowSourceList(false);
                    }}
                    className={`px-4 py-2.5 cursor-pointer flex justify-between border-b last:border-0 ${
                      darkVariant 
                        ? 'hover:bg-slate-800/80 hover:text-white border-slate-800' 
                        : 'hover:bg-primary-50/70 hover:text-primary-950 border-slate-50'
                    }`}
                  >
                    <span>{s.station_name}</span>
                    <span className={`font-mono font-bold ${darkVariant ? 'text-slate-400' : 'text-slate-400'}`}>{(s.station_code === 'UDU' || s.station_code === 'UDUPI') ? 'UD' : s.station_code}</span>
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
                      const displayCode = (s.station_code === 'UDU' || s.station_code === 'UDUPI') ? 'UD' : s.station_code;
                      setDestination(`${s.station_name} (${displayCode})`);
                      setDestCode(displayCode);
                      setShowDestList(false);
                    }}
                    className={`px-4 py-2.5 cursor-pointer flex justify-between border-b last:border-0 ${
                      darkVariant 
                        ? 'hover:bg-slate-800/80 hover:text-white border-slate-800' 
                        : 'hover:bg-primary-50/70 hover:text-primary-950 border-slate-50'
                    }`}
                  >
                    <span>{s.station_name}</span>
                    <span className={`font-mono font-bold ${darkVariant ? 'text-slate-400' : 'text-slate-400'}`}>{(s.station_code === 'UDU' || s.station_code === 'UDUPI') ? 'UD' : s.station_code}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>

      {/* Row 2: Journey Date & Class Dropdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        
        {/* Journey Date */}
        <div className="relative w-full">
          <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 pl-1 ${darkVariant ? 'text-slate-300' : 'text-slate-400'}`}>Journey Date</label>
          <div className={`flex items-center backdrop-blur-sm rounded-2xl px-4 py-3.5 border transition-all duration-300 shadow-sm hover:shadow-md ${
            darkVariant 
              ? 'bg-white/10 border-white/20 text-white focus-within:bg-white/20' 
              : 'bg-white/80 border-slate-200 text-slate-850 focus-within:bg-white'
          }`}>
            <Calendar className={`h-4.5 w-4.5 mr-2.5 flex-shrink-0 ${darkVariant ? 'text-primary-300' : 'text-primary-400'}`} />
            <input
              type="date"
              value={travelDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setTravelDate(e.target.value)}
              className={`w-full text-sm bg-transparent focus:outline-none font-bold cursor-pointer ${
                darkVariant ? 'text-white' : 'text-slate-800'
              }`}
              required
            />
          </div>
        </div>

        {/* Class Dropdown */}
        <CustomDropdown
          id="class-dropdown"
          label="Class"
          options={CLASS_OPTIONS}
          value={selectedClass}
          onChange={(val) => setSelectedClass(val)}
          icon={Briefcase}
          darkVariant={darkVariant}
        />

      </div>

      {/* Row 3: Quota Dropdown & Search Button */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end w-full">
        
        {/* Quota Dropdown */}
        <CustomDropdown
          id="quota-dropdown"
          label="Quota"
          options={QUOTA_OPTIONS}
          value={quota}
          onChange={(val) => setQuota(val)}
          icon={Grid}
          darkVariant={darkVariant}
        />

        {/* Search Trains Button */}
        <div className="relative w-full">
          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2.5 rounded-2xl bg-gradient-to-r from-orange-600 via-primary-600 to-indigo-600 hover:from-orange-500 hover:to-indigo-500 px-6 py-[15px] font-black text-sm text-white shadow-xl shadow-orange-600/20 hover:shadow-orange-600/30 transition-all duration-300 active:scale-[0.97] border border-white/20 group relative overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <Search className="h-4.5 w-4.5 relative z-10 group-hover:scale-110 transition-transform" />
            <span className="relative z-10 uppercase tracking-wide">Search Trains</span>
          </button>
        </div>

      </div>

      {/* Row 4: Concession Options */}
      <div className="pt-2 border-t border-slate-100/60 flex flex-wrap items-center gap-6 text-xs font-bold text-slate-700">
        
        {/* Person With Disability Concession */}
        <label 
          onClick={() => setDisabilityConcession(!disabilityConcession)}
          className="flex items-center space-x-2.5 cursor-pointer select-none group"
        >
          <div className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center transition-all ${
            disabilityConcession 
              ? 'bg-primary-600 border-primary-600 text-white shadow-xs' 
              : 'border-slate-300 bg-white group-hover:border-primary-400'
          }`}>
            {disabilityConcession && <CheckSquare className="h-3.5 w-3.5" />}
          </div>
          <span className={`text-xs font-bold transition-colors ${
            disabilityConcession ? 'text-primary-700' : 'text-slate-700 group-hover:text-slate-900'
          }`}>
            Person With Disability Concession
          </span>
        </label>

        {/* Railway Pass Concession */}
        <label 
          onClick={() => setRailwayPassConcession(!railwayPassConcession)}
          className="flex items-center space-x-2.5 cursor-pointer select-none group"
        >
          <div className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center transition-all ${
            railwayPassConcession 
              ? 'bg-primary-600 border-primary-600 text-white shadow-xs' 
              : 'border-slate-300 bg-white group-hover:border-primary-400'
          }`}>
            {railwayPassConcession && <CheckSquare className="h-3.5 w-3.5" />}
          </div>
          <span className={`text-xs font-bold transition-colors ${
            railwayPassConcession ? 'text-primary-700' : 'text-slate-700 group-hover:text-slate-900'
          }`}>
            Railway Pass Concession
          </span>
        </label>

      </div>

    </form>
  );
};

export default TrainSearchForm;
