import React, { useState, useEffect } from 'react';
import { Train, MapPin, Clock, Calendar, Search, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const StationSchedule = () => {
  const { t } = useLanguage();
  const [stations, setStations] = useState([]);
  const [selectedStationCode, setSelectedStationCode] = useState('');
  const [selectedStationName, setSelectedStationName] = useState('');
  const [stationQuery, setStationQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [allTrains, setAllTrains] = useState([]);
  const [matchingSchedule, setMatchingSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch stations and trains on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [stationsRes, trainsRes] = await Promise.all([
          api.get('/trains/stations'),
          api.get('/trains')
        ]);

        const stList = (stationsRes.data || []).filter(s => s.station_code !== 'ADMIN' && s.station_name !== 'ADMIN');
        setStations(stList);
        setAllTrains(trainsRes.data || []);

        if (stList.length > 0) {
          const first = stList[0];
          setSelectedStationCode(first.station_code);
          setSelectedStationName(first.station_name);
          setStationQuery(`${first.station_name} (${first.station_code})`);
        }
      } catch (err) {
        console.error('Failed to load station schedule data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Compute schedule whenever selectedStationCode or allTrains changes
  useEffect(() => {
    if (!selectedStationCode || allTrains.length === 0) {
      setMatchingSchedule([]);
      return;
    }

    const codeUpper = selectedStationCode.toUpperCase();

    const matches = [];
    allTrains.forEach(train => {
      const srcCode = (train.source_station_code || train.source || '').toUpperCase();
      const destCode = (train.destination_station_code || train.destination || '').toUpperCase();

      let isStop = false;
      let arrivalTime = '—';
      let departureTime = '—';
      let platform = train.platform || '1';

      if (srcCode === codeUpper) {
        isStop = true;
        arrivalTime = 'Origin';
        departureTime = train.departure_time || train.departure || '08:00';
      } else if (destCode === codeUpper) {
        isStop = true;
        arrivalTime = train.arrival_time || train.arrival || '20:00';
        departureTime = 'Destination';
      } else if (train.intermediate_stops && Array.isArray(train.intermediate_stops)) {
        const found = train.intermediate_stops.find(s => (s.stationCode || s.station_code || '').toUpperCase() === codeUpper);
        if (found) {
          isStop = true;
          arrivalTime = found.arrivalTime || found.arrival_time || '12:00';
          departureTime = found.departureTime || found.departure_time || '12:10';
          if (found.platform) platform = found.platform;
        }
      } else if (train.route && Array.isArray(train.route)) {
        const found = train.route.find(s => (s.stationCode || s.station_code || '').toUpperCase() === codeUpper);
        if (found) {
          isStop = true;
          arrivalTime = found.arrivalTime || found.arrival_time || '12:00';
          departureTime = found.departureTime || found.departure_time || '12:10';
          if (found.platform) platform = found.platform;
        }
      }

      if (isStop) {
        matches.push({
          id: train.id,
          train_number: train.train_number || '12952',
          train_name: train.train_name || 'Express Train',
          train_type: train.train_type || 'Express',
          source: train.source || srcCode,
          destination: train.destination || destCode,
          arrival_time: arrivalTime,
          departure_time: departureTime,
          running_days: train.running_days || (Array.isArray(train.runs_on) ? train.runs_on.join(', ') : 'Daily'),
          status: train.delay_minutes > 0 ? `DELAYED ${train.delay_minutes}M` : (train.status || 'ON TIME'),
          platform: platform
        });
      }
    });

    setMatchingSchedule(matches);
  }, [selectedStationCode, allTrains]);

  const filteredStations = stations.filter(s => {
    const q = stationQuery.toLowerCase();
    return (s.station_name || '').toLowerCase().includes(q) || (s.station_code || '').toLowerCase().includes(q);
  }).slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary-600" />
            <span>Station Timetable & Schedule</span>
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Real-time arrival and departure schedule across all network stations.
          </p>
        </div>
      </div>

      {/* Station Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
          Select Station to View Timetable
        </label>

        <div className="relative max-w-md">
          <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20">
            <MapPin className="h-5 w-5 text-primary-500 mr-2 shrink-0" />
            <input
              type="text"
              value={stationQuery}
              onChange={(e) => {
                setStationQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search station by name or code..."
              className="w-full bg-transparent text-sm font-bold text-slate-800 focus:outline-none"
            />
          </div>

          {showDropdown && (
            <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl z-20 divide-y divide-slate-100">
              {filteredStations.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 font-semibold">No matching stations</div>
              ) : (
                filteredStations.map(s => (
                  <div
                    key={s.id || s.station_code}
                    onClick={() => {
                      setSelectedStationCode(s.station_code);
                      setSelectedStationName(s.station_name);
                      setStationQuery(`${s.station_name} (${s.station_code})`);
                      setShowDropdown(false);
                    }}
                    className="p-3 hover:bg-primary-50 cursor-pointer flex justify-between items-center text-xs font-bold text-slate-800"
                  >
                    <span>{s.station_name} {s.state ? `(${s.state})` : ''}</span>
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{s.station_code}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timetable Results */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Train className="h-4 w-4 text-primary-400" />
            <span>Timetable for {selectedStationName} [{selectedStationCode}]</span>
          </h2>
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full font-mono text-slate-300 font-bold">
            {matchingSchedule.length} Train(s) Found
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold">Loading station schedule...</div>
        ) : matchingSchedule.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No trains found for this station.</p>
            <p className="text-xs text-slate-400">Select another station to view scheduled train arrivals and departures.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Train # & Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Arrival</th>
                  <th className="px-4 py-3">Departure</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Running Days</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {matchingSchedule.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      <span className="font-mono text-primary-600 mr-2">#{item.train_number}</span>
                      <span>{item.train_name}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-500 whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px] text-slate-700">
                        {item.train_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-medium">
                      {item.source} <ArrowRight className="inline h-3 w-3 text-slate-400" /> {item.destination}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.arrival_time}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.departure_time}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-600 whitespace-nowrap">PF #{item.platform}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-medium">{item.running_days}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                        item.status.includes('DELAY') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StationSchedule;
