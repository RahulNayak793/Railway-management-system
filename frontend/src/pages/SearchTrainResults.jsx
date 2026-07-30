import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, SlidersHorizontal, Train, Clock, ArrowRight, Check, 
  MapPin, Calendar, Award, Eye, X, BookOpen, Map, PhoneCall,
  Wind, Zap, Coffee, Sparkles, Shield, ShieldCheck, HelpCircle,
  Info, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import TrainSearchForm from '../components/TrainSearchForm';

const SearchTrainResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const source = searchParams.get('source') || '';
  const destination = searchParams.get('destination') || '';
  const travelDate = searchParams.get('date') || '';
  const passengers = searchParams.get('passengers') || '1';
  const quota = searchParams.get('quota') || 'GN';

  const [trains, setTrains] = useState([]);
  const [filteredTrains, setFilteredTrains] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [trainSearchQuery, setTrainSearchQuery] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [departureTimes, setDepartureTimes] = useState([]);
  const [trainTypes, setTrainTypes] = useState([]);
  const [priceRange, setPriceRange] = useState(3000);
  const [sortBy, setSortBy] = useState('price');

  // Selected schedule modal state
  const [activeScheduleTrain, setActiveScheduleTrain] = useState(null);

  // AI Recommendation State
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [aiInsights, setAiInsights] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // AI Delay Prediction State
  const [predictedDelay, setPredictedDelay] = useState(null);
  const [predictingNumber, setPredictingNumber] = useState(null);
  const [showDelayModal, setShowDelayModal] = useState(false);

  // Fetch trains on mount
  useEffect(() => {
    const fetchTrains = async () => {
      if (source && destination && source.trim().toUpperCase() === destination.trim().toUpperCase()) {
        setTrains([]);
        setFilteredTrains([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const queryStr = source && destination ? `?source=${source}&destination=${destination}` : '';
        const res = await api.get(`/trains${queryStr}`);
        let fetched = res.data || [];

        // Merge persistent staff trains from localStorage
        const storedStaffTrains = JSON.parse(localStorage.getItem('added_staff_trains') || '[]');
        const existingTrainNumbers = new Set(fetched.map(f => f.train_number));

        storedStaffTrains.forEach(st => {
          if (!existingTrainNumbers.has(st.trainNo)) {
            const matchesRoute = !source || !destination || 
              (st.source || 'NDLS').toUpperCase() === source.toUpperCase() ||
              (st.to || 'MMCT').toUpperCase() === destination.toUpperCase();

            if (matchesRoute) {
              fetched.unshift({
                id: st.id,
                train_number: st.trainNo,
                train_name: st.trainName,
                status: st.status === 'On Time' ? 'on_time' : 'delayed',
                delay_minutes: 0,
                source: st.source || source || 'NDLS',
                destination: st.to || destination || 'MMCT',
                route: {
                  source_station_code: st.source || source || 'NDLS',
                  destination_station_code: st.to || destination || 'MMCT',
                  departure_time: st.depTime || '10:00:00',
                  arrival_time: '18:00:00',
                  distance_km: 500,
                  fare_multiplier: 1.2
                }
              });
            }
          }
        });

        setTrains(fetched);
        setFilteredTrains(fetched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrains();
  }, [source, destination]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!source || !destination) return;
      setLoadingAi(true);
      try {
        const res = await api.get(`/ai/recommendations?source=${source}&destination=${destination}`);
        setAiRecommendations(res.data.recommendedTrains);
        setAiInsights(res.data.insights);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoadingAi(false);
      }
    };
    fetchRecommendations();
  }, [source, destination]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...trains];

    if (trainSearchQuery) {
      const q = trainSearchQuery.toLowerCase();
      result = result.filter(t => 
        (t.train_name && t.train_name.toLowerCase().includes(q)) ||
        (t.train_number && t.train_number.toLowerCase().includes(q)) ||
        (t.route?.source_station_code && t.route.source_station_code.toLowerCase().includes(q)) ||
        (t.route?.destination_station_code && t.route.destination_station_code.toLowerCase().includes(q))
      );
    }

    if (availableOnly) {
      result = result.filter(t => t.status !== 'cancelled');
    }

    if (trainTypes.length > 0) {
      result = result.filter(t => {
        const name = t.train_name.toLowerCase();
        if (trainTypes.includes('superfast') && name.includes('rajdhani')) return true;
        if (trainTypes.includes('express') && name.includes('shatabdi')) return true;
        if (trainTypes.includes('local') && name.includes('local')) return true;
        return false;
      });
    }

    if (departureTimes.length > 0) {
      result = result.filter(t => {
        if (!t.route || !t.route.departure_time) return false;
        const hour = parseInt(t.route.departure_time.split(':')[0]);
        if (departureTimes.includes('morning') && hour >= 6 && hour < 12) return true;
        if (departureTimes.includes('afternoon') && hour >= 12 && hour < 18) return true;
        if (departureTimes.includes('evening') && hour >= 18 && hour < 24) return true;
        if (departureTimes.includes('night') && (hour >= 0 && hour < 6)) return true;
        return false;
      });
    }

    if (sortBy === 'price') {
      result.sort((a, b) => {
        const multA = a.route?.fare_multiplier || 1.0;
        const multB = b.route?.fare_multiplier || 1.0;
        return multA - multB;
      });
    } else if (sortBy === 'departure') {
      result.sort((a, b) => {
        const timeA = a.route?.departure_time || '00:00';
        const timeB = b.route?.departure_time || '00:00';
        return timeA.localeCompare(timeB);
      });
    } else if (sortBy === 'duration') {
      result.sort((a, b) => {
        const distA = a.route?.distance_km || 1000;
        const distB = b.route?.distance_km || 1000;
        return distA - distB;
      });
    }

    setFilteredTrains(result);
  }, [trains, availableOnly, departureTimes, trainTypes, priceRange, sortBy, trainSearchQuery]);

  const toggleFilter = (list, setList, val) => {
    if (list.includes(val)) {
      setList(list.filter(item => item !== val));
    } else {
      setList([...list, val]);
    }
  };

  const handleBook = (trainId, coachClass, fare) => {
    navigate(`/passenger/booking?train_id=${trainId}&date=${travelDate}&class=${coachClass}&passengers=${passengers}&fare=${fare}&quota=${quota}`);
  };

  const getClassFare = (multiplier, className) => {
    const baseFare = 350;
    const classMult = className === '1A' ? 3.5 : className === '2A' ? 2.2 : className === '3A' ? 1.5 : 1.0;
    return Math.round(baseFare * (multiplier || 1.0) * classMult);
  };

  const getSeatStatus = (trainId, className, currentQuota) => {
    const quotaLabel = currentQuota === 'LD' ? 'Ladies' : currentQuota === 'SR' ? 'Sr Citizen' : currentQuota === 'HP' ? 'Divyang' : '';
    const prefix = quotaLabel ? `${quotaLabel} ` : '';
    
    if (className === '1A') return { code: `${prefix}AVL 08`, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' };
    if (className === '2A') return { code: `${prefix}AVL 12`, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' };
    if (className === '3A') return { code: `${prefix}RAC 5`, color: 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300' };
    return { code: `${prefix}WL 12`, color: 'text-rose-600 bg-rose-50 border-rose-100 hover:border-rose-300' };
  };

  const getClassAmenities = (className) => {
    if (className === '1A') return { label: 'AC Luxury Coupe', icons: [Sparkles, Coffee, ShieldCheck], desc: 'Private Cabin, Catering Included' };
    if (className === '2A') return { label: 'AC 2-Tier Comfort', icons: [Wind, Zap, ShieldCheck], desc: 'Curtains, Pillows, Power socket' };
    if (className === '3A') return { label: 'AC 3-Tier Economy', icons: [Wind, Zap], desc: 'Shared AC Coach, Bedding' };
    return { label: 'Sleeper Class (SL)', icons: [Zap], desc: 'Non-AC coach, Charging ports' };
  };

  const getTrainSchedule = (trainNum) => {
    if (trainNum === '12952') {
      return [
        { seq: 1, name: 'New Delhi', code: 'NDLS', arr: '--:--', dep: '16:30', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Bhopal Junction', code: 'BPL', arr: '23:40', dep: '23:50', dist: '707 km', halt: '10m' },
        { seq: 3, name: 'Mumbai Central', code: 'MMCT', arr: '08:15', dep: '--:--', dist: '1384 km', halt: '--' },
      ];
    } else if (trainNum === '12002') {
      return [
        { seq: 1, name: 'New Delhi', code: 'NDLS', arr: '--:--', dep: '06:00', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Agra Cantt', code: 'AGC', arr: '07:50', dep: '07:55', dist: '188 km', halt: '5m' },
        { seq: 3, name: 'Bhopal Junction', code: 'BPL', arr: '14:25', dep: '--:--', dist: '707 km', halt: '--' },
      ];
    } else if (trainNum === '22436') {
      return [
        { seq: 1, name: 'New Delhi', code: 'NDLS', arr: '--:--', dep: '06:00', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Agra Cantt', code: 'AGC', arr: '07:45', dep: '07:48', dist: '188 km', halt: '3m' },
        { seq: 3, name: 'Gwalior Junction', code: 'GWL', arr: '09:20', dep: '09:22', dist: '313 km', halt: '2m' },
        { seq: 4, name: 'Varanasi Junction', code: 'BSB', arr: '14:00', dep: '--:--', dist: '759 km', halt: '--' },
      ];
    } else if (trainNum === '12301') {
      return [
        { seq: 1, name: 'Howrah Junction', code: 'HWH', arr: '--:--', dep: '16:55', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Patna Junction', code: 'PAT', arr: '22:10', dep: '22:20', dist: '530 km', halt: '10m' },
        { seq: 3, name: 'Delhi Junction', code: 'DEL', arr: '09:30', dep: '09:40', dist: '1445 km', halt: '10m' },
        { seq: 4, name: 'New Delhi', code: 'NDLS', arr: '10:00', dep: '--:--', dist: '1450 km', halt: '--' },
      ];
    } else {
      return [
        { seq: 1, name: 'Hazrat Nizamuddin', code: 'NZM', arr: '--:--', dep: '08:10', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Agra Cantt', code: 'AGC', arr: '09:50', dep: '--:--', dist: '188 km', halt: '--' },
      ];
    }
  };

  const handlePredictDelay = async (trainNumber) => {
    setPredictingNumber(trainNumber);
    try {
      const res = await api.post('/ai/predict-delay', {
        train_number: trainNumber,
        travel_date: travelDate
      });
      setPredictedDelay(res.data);
      setShowDelayModal(true);
    } catch (err) {
      console.error('Error predicting delay:', err);
      alert('Failed to generate delay predictions.');
    } finally {
      setPredictingNumber(null);
    }
  };

  const getQuotaName = (code) => {
    if (code === 'LD') return 'Ladies Quota';
    if (code === 'SR') return 'Lower Berth / Senior Citizen';
    if (code === 'HP') return 'Divyangjan / Disabled';
    return 'General Quota';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Search Form Inline Banner */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-visible z-20">
        <TrainSearchForm 
          initialData={{
            source: source,
            sourceCode: source,
            destination: destination,
            destCode: destination,
            travelDate: travelDate,
            passengers: passengers,
            quota: quota
          }}
          onSearchSubmit={(data) => {
            navigate(`/passenger/search?source=${data.source}&destination=${data.destination}&date=${data.date}&passengers=${data.passengers}&quota=${data.quota}`);
          }}
          darkVariant={false}
        />
      </div>

      {/* Main Grid: Filters & Results */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Left Filter Sidebar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 self-start">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="flex items-center font-extrabold text-slate-800 text-sm">
              <SlidersHorizontal className="h-4 w-4 mr-2 text-primary-500 animate-pulse" />
              <span>Filters</span>
            </h3>
            <button 
              onClick={() => {
                setAvailableOnly(false);
                setDepartureTimes([]);
                setTrainTypes([]);
                setPriceRange(3000);
              }}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              Clear All
            </button>
          </div>

          {/* Toggle: Available Only */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Available Only</span>
            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                availableOnly ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                availableOnly ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Departure Time Filter */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Departure Time</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'morning', label: 'Morning', time: '6AM - 12PM' },
                { id: 'afternoon', label: 'Afternoon', time: '12PM - 6PM' },
                { id: 'evening', label: 'Evening', time: '6PM - 12AM' },
                { id: 'night', label: 'Night', time: '12AM - 6AM' }
              ].map(t => {
                const active = departureTimes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleFilter(departureTimes, setDepartureTimes, t.id)}
                    className={`flex flex-col items-center justify-center rounded-xl p-2 border text-center transition-all ${
                      active ? 'border-primary-500 bg-primary-50/30 text-primary-750 font-bold' : 'border-slate-100 hover:bg-slate-50 text-slate-650'
                    }`}
                  >
                    <Clock className="h-4 w-4 mb-1 text-slate-400" />
                    <span className="text-[10px] font-extrabold">{t.label}</span>
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5">{t.time}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Train Type Filter */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Train Type</h4>
            {['Superfast', 'Express', 'Local'].map(type => {
              const id = type.toLowerCase();
              const checked = trainTypes.includes(id);
              return (
                <label key={type} className="flex items-center space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFilter(trainTypes, setTrainTypes, id)}
                    className="h-4 w-4 rounded border-slate-350 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">{type}</span>
                </label>
              );
            })}
          </div>

          {/* Price Range Filter */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Max Ticket Fare</span>
              <span className="text-primary-600 font-bold">₹{priceRange}</span>
            </div>
            <input
              type="range"
              min="300"
              max="5000"
              step="100"
              value={priceRange}
              onChange={(e) => setPriceRange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-[8px] text-slate-400 font-mono">
              <span>₹300</span>
              <span>₹5000</span>
            </div>
          </div>
        </div>

        {/* Right Main Results List */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* AI Route Recommendations banner */}
          {aiRecommendations && aiRecommendations.length > 0 && (
            <div className="rounded-3xl border border-primary-500/10 bg-gradient-to-r from-primary-50/40 to-indigo-50/20 p-5 shadow-sm space-y-3.5 relative overflow-hidden">
              <div className="absolute top-[-50px] right-[-50px] h-32 w-32 rounded-full bg-primary-600/5 blur-[50px]"></div>
              
              <div className="flex items-center space-x-2 text-primary-900 relative z-10">
                <Sparkles className="h-4 w-4.5 text-primary-600 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">AI Recommended Itineraries</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                {aiRecommendations.map((rec, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-md p-3.5 flex items-start space-x-3 hover:border-primary-500/20 transition-all duration-300">
                    <div className="rounded-xl bg-primary-50 border border-primary-100 px-2 py-1 text-primary-700 font-extrabold text-[10px] flex-shrink-0">
                      {rec.matchScore}% Match
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs">{rec.train_name} <span className="font-mono text-slate-400">#{rec.train_number}</span></h4>
                      <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed mt-1">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>

              {aiInsights && (
                <div className="flex items-start space-x-2 text-[9.5px] text-indigo-850 bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl relative z-10">
                  <Info className="h-4 w-4 text-indigo-650 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{aiInsights}</span>
                </div>
              )}
            </div>
          )}

          {/* Live Train Search & Sort Toolbar */}
          <div className="flex flex-col gap-3.5 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              {/* Search Bar Input */}
              <div className="relative flex-1 w-full">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search train by name or number (e.g. Rajdhani, Shatabdi, 12952)..."
                  value={trainSearchQuery}
                  onChange={(e) => setTrainSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary-500 transition"
                />
                {trainSearchQuery && (
                  <button 
                    onClick={() => setTrainSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sort selector */}
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sort by:</span>
                <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/60 text-xs">
                  {[
                    { id: 'price', label: 'Ticket Fare' },
                    { id: 'duration', label: 'Travel Time' },
                    { id: 'departure', label: 'Departure' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSortBy(opt.id)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition ${
                        sortBy === opt.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-xs font-extrabold text-slate-600 flex flex-wrap items-center justify-between border-t border-slate-100 pt-2.5 gap-2">
              <span>Showing {filteredTrains.length} Schedules for {source} &rarr; {destination}</span>
              {trainSearchQuery && (
                <span className="text-[11px] text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded border border-primary-100">
                  Filtered by "{trainSearchQuery}"
                </span>
              )}
            </div>
          </div>

          {/* Trains Loop */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em]" />
              <p className="mt-4 text-xs font-semibold text-slate-500">Searching active schedules...</p>
            </div>
          ) : filteredTrains.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
              <Train className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="font-bold text-slate-600 mb-1">No trains matching criteria found</p>
              <p className="text-xs">Try selecting a different date or adjusting your filters.</p>
            </div>
          ) : (
            filteredTrains.map((t) => {
              const classesList = ['SL', '3A', '2A', '1A'];
              return (
                <div key={t.id} className="card-premium rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary-500/25 space-y-4">
                  
                  {/* Train Title Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3 gap-2">
                    <div className="flex items-center space-x-3.5">
                      <div className="rounded-2xl bg-primary-50 p-2.5 text-primary-600 shadow-sm">
                        <Train className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm flex flex-wrap items-center gap-2 leading-none">
                          {t.train_name}
                          <button
                            onClick={() => setActiveScheduleTrain(t)}
                            className="inline-flex items-center space-x-0.5 text-[9px] font-bold text-primary-600 hover:text-primary-850 border border-primary-100 rounded-lg px-2 py-0.5 bg-primary-50/50 hover:bg-primary-50 transition"
                          >
                            <Map className="h-3.5 w-3.5 text-primary-550" />
                            <span>Schedule Route</span>
                          </button>
                        </h4>
                        <span className="text-[10px] font-mono text-slate-400 font-bold block mt-1">Train No: {t.train_number}</span>
                      </div>
                    </div>
                    {/* Status badges, predict delay button */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <button
                        onClick={() => handlePredictDelay(t.train_number)}
                        disabled={predictingNumber === t.train_number}
                        className="inline-flex items-center space-x-1 text-[9px] font-extrabold text-indigo-700 hover:text-indigo-850 border border-indigo-150 rounded-lg px-2.5 py-1 bg-indigo-50/60 hover:bg-indigo-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3 text-indigo-600 animate-spin-slow" />
                        <span>{predictingNumber === t.train_number ? 'AI Predicting...' : 'AI Delay Risk'}</span>
                      </button>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        t.status === 'on_time' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-255' 
                          : t.status === 'delayed' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-255' 
                          : 'bg-rose-50 text-rose-700 border border-rose-255'
                      }`}>
                        {t.status === 'on_time' ? 'On Time' : t.status === 'delayed' ? `Delayed (${t.delay_minutes}m)` : 'Cancelled'}
                      </span>
                    </div>
                  </div>

                  {/* Times Schedule Block */}
                  <div className="grid grid-cols-3 items-center py-2 text-center bg-slate-50/50 rounded-2xl border border-slate-100/70 p-4 relative overflow-hidden">
                    <div>
                      <span className="text-lg font-extrabold text-slate-800 tracking-tight">{t.route?.departure_time?.slice(0,5) || '16:30'}</span>
                      <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">{source}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[8px] text-slate-400 font-mono font-bold">15 hrs 20 mins</span>
                      <div className="relative flex w-full items-center justify-center py-1">
                        <div className="h-0.5 w-full bg-slate-200 border-t border-dashed border-slate-350"></div>
                        <div className="absolute h-2 w-2 rounded-full bg-primary-600 border-2 border-white shadow-sm"></div>
                      </div>
                      <span className="text-[9px] font-bold text-primary-600">Express Corridor</span>
                    </div>
                    <div>
                      <span className="text-lg font-extrabold text-slate-800 tracking-tight">{t.route?.arrival_time?.slice(0,5) || '08:15'}</span>
                      <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">{destination}</p>
                    </div>
                  </div>

                  {/* Coach Class Seat Pricing Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {classesList.map(cName => {
                      const fare = getClassFare(t.route?.fare_multiplier, cName);
                      const availability = getSeatStatus(t.id, cName, quota);
                      const amenInfo = getClassAmenities(cName);
                      return (
                        <div 
                          key={cName}
                          onClick={() => t.status !== 'cancelled' && handleBook(t.id, cName, fare)}
                          className={`flex flex-col justify-between rounded-2xl border p-3.5 cursor-pointer transition-all duration-200 ${
                            t.status === 'cancelled' 
                              ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50/50' 
                              : 'border-slate-200 bg-white hover:border-primary-500 hover:shadow-md hover:bg-primary-50/[0.02]'
                          }`}
                        >
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">{cName === 'SL' ? 'Sleeper' : `${cName} Class`}</span>
                              <span className="text-xs font-extrabold text-slate-800 font-mono">₹{fare}</span>
                            </div>
                            
                            <div className="text-[9px] text-slate-400 font-semibold leading-normal">
                              {amenInfo.label}
                              <div className="flex items-center gap-1 mt-1 text-slate-400">
                                {amenInfo.icons.map((Icon, idx) => (
                                  <Icon key={idx} className="h-3 w-3" />
                                ))}
                                <span className="text-[8px] text-slate-450 italic ml-1 truncate max-w-[50px]">{amenInfo.desc}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`rounded-xl py-1 px-2 text-[9px] font-extrabold text-center border font-mono tracking-wider ${availability.color}`}>
                            {availability.code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ROUTE SCHEDULE DETAIL MODAL OVERLAY */}
      {activeScheduleTrain && (
        <div className="fixed inset-0 bg-slate-955/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl space-y-4">
            
            <div className="bg-gradient-to-r from-slate-950 to-primary-950 px-6 py-4.5 text-white flex justify-between items-center border-b border-white/5">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Train className="h-4.5 w-4.5 text-primary-400" />
                  {activeScheduleTrain.train_name} Route Schedule
                </h3>
                <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">Train Number: #{activeScheduleTrain.train_number}</span>
              </div>
              <button 
                onClick={() => setActiveScheduleTrain(null)}
                className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-white transition-all focus:outline-none"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto">
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 text-xs">
                {getTrainSchedule(activeScheduleTrain.train_number).map((stop) => (
                  <div key={stop.seq} className="relative pl-6">
                    <span className="absolute left-[-13.5px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-900 text-white font-extrabold text-[9px] border-2 border-white shadow-sm font-mono">
                      {stop.seq}
                    </span>

                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-slate-800 font-extrabold text-xs block">{stop.name} ({stop.code})</strong>
                        <span className="text-[9.5px] text-slate-400 font-bold block mt-0.5">Halt: {stop.halt}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-slate-700 font-bold block">Arr: {stop.arr} | Dep: {stop.dep}</span>
                        <span className="text-[9px] text-slate-400 font-mono font-bold">Dist: {stop.dist}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 bg-slate-50 font-bold">
              <span className="flex items-center gap-1.5"><PhoneCall className="h-4 w-4 text-primary-650" /> Running Status Helpline: Dial 139</span>
              <button
                onClick={() => setActiveScheduleTrain(null)}
                className="rounded-xl bg-slate-900 text-white px-5 py-2 text-xs font-bold hover:bg-slate-950 transition shadow-md shadow-slate-900/10"
              >
                Close Schedule
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AI DELAY RISK PREDICTION MODAL */}
      {showDelayModal && predictedDelay && (
        <div className="fixed inset-0 bg-slate-955/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full overflow-hidden shadow-2xl space-y-4">
            
            <div className="bg-gradient-to-r from-indigo-950 to-purple-950 px-6 py-4.5 text-white flex justify-between items-center border-b border-white/5">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-spin-slow" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">AI Delay Risk Analysis</h3>
                  <span className="text-[10px] text-slate-350 block mt-0.5">Train: #{predictedDelay.train_number} | Travel Date: {predictedDelay.travel_date}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowDelayModal(false)}
                className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-white transition-all focus:outline-none"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-700">
              
              {/* circular on time ring and delay minutes */}
              <div className="flex items-center space-x-5 bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
                
                {/* SVG Radial Gauge */}
                <div className="relative h-16 w-16 flex items-center justify-center flex-shrink-0">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-slate-200 fill-transparent" strokeWidth="5" />
                    <circle cx="32" cy="32" r="28" className="stroke-indigo-600 fill-transparent" strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - predictedDelay.onTimeProbability / 100)} 
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-extrabold text-indigo-900 font-mono">{predictedDelay.onTimeProbability}%</span>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">On-Time Probability</span>
                  <p className="text-base font-extrabold text-slate-800 leading-tight">
                    {predictedDelay.predictedDelayMinutes === 0 
                      ? 'Likely On Time' 
                      : `Expected delay: ${predictedDelay.predictedDelayMinutes} mins`}
                  </p>
                  <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Confidence score: High (92%)</span>
                </div>
              </div>

              {/* Risk Level Badge */}
              <div className="flex justify-between items-center p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-600">AI Risk Assessment:</span>
                <span className={`rounded-xl px-3 py-1 font-extrabold text-[10px] uppercase tracking-wider ${
                  predictedDelay.riskLevel === 'High' 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                    : predictedDelay.riskLevel === 'Medium'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {predictedDelay.riskLevel} Risk
                </span>
              </div>

              {/* Reasoning Block */}
              <div className="space-y-1.5 bg-slate-50 border border-slate-100/70 p-4 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">AI Model Reasoning</span>
                <p className="text-[11px] font-semibold text-slate-600 leading-relaxed font-sans">
                  {predictedDelay.reasoning}
                </p>
              </div>

            </div>

            <div className="px-6 py-4.5 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setShowDelayModal(false)}
                className="rounded-xl bg-slate-900 text-white px-5 py-2.5 font-bold hover:bg-slate-950 transition text-xs shadow-md"
              >
                Acknowledge
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SearchTrainResults;
