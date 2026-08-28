import React, { useState, useEffect } from 'react';
import { Clock, Plus, Search, Calendar, Edit, Trash2, MapPin, Eye, X, ArrowRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { indianStations } from '../utils/stationsData';
import api from '../services/api';

const convertTo24Hour = (timeStr) => {
  if (!timeStr) return '12:00:00';
  const cleanStr = String(timeStr).trim();
  if (!cleanStr.toUpperCase().includes('AM') && !cleanStr.toUpperCase().includes('PM')) {
    return cleanStr.length === 5 ? `${cleanStr}:00` : cleanStr;
  }
  const parts = cleanStr.split(/\s+/);
  const timePart = parts[0];
  const ampm = parts[1] ? parts[1].toUpperCase() : 'AM';
  let [hours, minutes] = timePart.split(':');
  let h = parseInt(hours, 10);
  if (h === 12) {
    h = 0;
  }
  if (ampm === 'PM') {
    h += 12;
  }
  return `${String(h).padStart(2, '0')}:${minutes || '00'}:00`;
};

// Custom Popover Time Picker that displays time in a single input-like box (24-Hour Format)
const PopoverTimePicker = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  let h = '12';
  let m = '00';
  
  if (value) {
    const cleanVal = String(value).trim();
    const timePart = cleanVal.split(/\s+/)[0];
    if (timePart.includes(':')) {
      const parts = timePart.split(':');
      h = String(parts[0]).padStart(2, '0');
      m = String(parts[1]).padStart(2, '0');
      if (h === '24') h = '00';
    }
  }
  
  const handlePartChange = (part, val) => {
    let newH = h;
    let newM = m;
    if (part === 'hour') newH = val;
    if (part === 'minute') newM = val;
    onChange(`${newH}:${newM}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="space-y-1.5 relative w-full">
      <label className="text-[10px] font-bold text-slate-550 uppercase">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer select-none"
      >
        <span>{value || '12:00'}</span>
        <Clock className="h-3.5 w-3.5 text-slate-400" />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl flex gap-1.5 animate-scale-in w-48 justify-between">
            <select
              value={h}
              onChange={(e) => handlePartChange('hour', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:outline-none w-1/2 text-center cursor-pointer"
            >
              {hours.map(hour => <option key={hour} value={hour}>{hour}</option>)}
            </select>
            <select
              value={m}
              onChange={(e) => handlePartChange('minute', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:outline-none w-1/2 text-center cursor-pointer"
            >
              {minutes.map(minute => <option key={minute} value={minute}>{minute}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
};

// Custom Popover Time Picker for Stops Routing grid (24-Hour Format)
const StopPopoverTimePicker = ({ value, onChange, placeholder = 'Select Time' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  let h = '12';
  let m = '00';
  if (value) {
    const cleanVal = String(value).trim();
    const timePart = cleanVal.split(/\s+/)[0];
    if (timePart.includes(':')) {
      const parts = timePart.split(':');
      h = String(parts[0]).padStart(2, '0');
      m = String(parts[1]).padStart(2, '0');
      if (h === '24') h = '00';
    }
  }
  
  const handleStopPartChange = (part, val) => {
    let newH = h;
    let newM = m;
    if (part === 'hour') newH = val;
    if (part === 'minute') newM = val;
    onChange(`${newH}:${newM}`);
  };

  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-800 flex items-center justify-between cursor-pointer select-none"
      >
        <span className={!value ? 'text-slate-400 font-normal' : ''}>
          {value || placeholder}
        </span>
        <Clock className="h-3 w-3 text-slate-400" />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg p-2 shadow-lg flex gap-1 animate-scale-in w-32">
            <select
              value={h}
              onChange={(e) => handleStopPartChange('hour', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-semibold text-slate-800 focus:outline-none w-1/2 text-center cursor-pointer"
            >
              {hoursList.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select
              value={m}
              onChange={(e) => handleStopPartChange('minute', e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-semibold text-slate-800 focus:outline-none w-1/2 text-center cursor-pointer"
            >
              {minutesList.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
};

const AdminSchedules = () => {
  const { showToast } = useToast();

  const getStationName = (code) => {
    if (!code) return '';
    const clean = code.trim().toUpperCase();
    const match = clean.match(/\(([^)]+)\)/);
    const stationCode = match ? match[1] : clean;
    const st = indianStations.find(s => s.code.toUpperCase() === stationCode);
    return st ? st.name : code;
  };

  const [schedules, setSchedules] = useState([]);

  const fetchSchedules = async () => {
    try {
      const res = await api.get('/trains');
      const backendTrains = res.data || [];
      
      const mapped = backendTrains.map(t => {
        const route = t.route || (t.routes && t.routes[0]) || {};
        return {
          id: t.id,
          trainNo: t.train_number,
          trainName: t.train_name,
          source: t.source || route.source_station_code || 'NDLS',
          dest: t.destination || route.destination_station_code || 'MMCT',
          depDate: '',
          depTime: route.departure_time ? route.departure_time.substring(0, 5) : '12:00',
          arrTime: route.arrival_time ? route.arrival_time.substring(0, 5) : '12:00',
          frequency: 'Daily',
          status: t.status === 'on_time' ? 'Active' : 'Delayed',
          stops: (route.stops || []).map(st => ({
            ...st,
            arrTime: st.arrTime ? st.arrTime.substring(0, 5) : '',
            depTime: st.depTime ? st.depTime.substring(0, 5) : ''
          })),
          baseFare: route.fare_multiplier ? Math.round(route.fare_multiplier * 350) : 350
        };
      });
      setSchedules(mapped);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStopsModal, setShowStopsModal] = useState(false);
  
  const [selectedSch, setSelectedSch] = useState(null);

  // Form Fields
  const [trainNo, setTrainNo] = useState('');
  const [trainName, setTrainName] = useState('');
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [depDate, setDepDate] = useState('');
  const [depTime, setDepTime] = useState('12:00');
  const [arrDate, setArrDate] = useState('');
  const [arrTime, setArrTime] = useState('12:00');
  const [frequency, setFrequency] = useState('Daily');
  const [stopsInput, setStopsInput] = useState([]);
  const [baseFare, setBaseFare] = useState(350);

  const isDateRequired = frequency === 'Weekly' || frequency === 'Bi-Weekly';

  const openAddModal = () => {
    setTrainNo('');
    setTrainName('');
    setSource('');
    setDest('');
    setDepDate('');
    setDepTime('12:00');
    setArrDate('');
    setArrTime('12:00');
    setFrequency('Daily');
    setStopsInput([]);
    setBaseFare(350);
    setShowAddModal(true);
  };

  const openEditModal = (sch) => {
    setSelectedSch(sch);
    setTrainNo(sch.trainNo);
    setTrainName(sch.trainName);
    setSource(sch.source);
    setDest(sch.dest);
    setDepDate(sch.depDate || '');
    setDepTime(sch.depTime || '12:00');
    setArrDate(sch.arrDate || '');
    setArrTime(sch.arrTime || '12:00');
    setFrequency(sch.frequency);
    setStopsInput(sch.stops ? [...sch.stops] : []);
    setBaseFare(sch.baseFare || 350);
    setShowEditModal(true);
  };

  const [stopsModalEdits, setStopsModalEdits] = useState([]);

  const openStopsModal = (sch) => {
    setSelectedSch(sch);
    setStopsModalEdits(sch.stops ? [...sch.stops] : []);
    setShowStopsModal(true);
  };

  const handleAddStopInput = () => {
    setStopsInput([...stopsInput, { stationCode: '', arrTime: '', depTime: '', haltMinutes: '2', distanceFromOriginKm: '' }]);
  };

  const handleRemoveStopInput = (index) => {
    setStopsInput(stopsInput.filter((_, idx) => idx !== index));
  };

  const handleStopChange = (index, field, value) => {
    const updated = [...stopsInput];
    updated[index][field] = value;
    setStopsInput(updated);
  };

  // Stops modal edit handlers
  const handleStopsModalChange = (index, field, value) => {
    const updated = [...stopsModalEdits];
    updated[index][field] = value;
    setStopsModalEdits(updated);
  };

  const handleAddStopsModalStop = () => {
    setStopsModalEdits([...stopsModalEdits, { stationCode: '', arrTime: '', depTime: '', haltMinutes: '2', distanceFromOriginKm: '' }]);
  };

  const handleRemoveStopsModalStop = (index) => {
    setStopsModalEdits(stopsModalEdits.filter((_, idx) => idx !== index));
  };

  const handleSaveStopsModal = async () => {
    const validStops = stopsModalEdits.filter(s => s.stationCode && s.stationCode.trim());
    try {
      await api.put(`/trains/${selectedSch.id}`, { stops: validStops });
      showToast(`Stops updated for ${selectedSch.trainName}!`, 'success');
      setShowStopsModal(false);
      fetchSchedules();
    } catch (err) {
      console.error('Error saving stops:', err);
      showToast('Failed to update stops: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!trainNo || !trainName || !source || !dest) return;
    
    const payload = {
      train_number: trainNo.trim(),
      train_name: trainName.trim(),
      source: source.toUpperCase().trim(),
      destination: dest.toUpperCase().trim(),
      departure_time: convertTo24Hour(depTime),
      arrival_time: convertTo24Hour(arrTime),
      frequency: frequency || 'Daily',
      distance_km: 500,
      fare_multiplier: parseFloat(baseFare) / 350 || 1.0,
      stops: stopsInput.filter(s => s.stationCode)
    };

    try {
      await api.post('/trains', payload);
      showToast(`Train schedule ${trainName} created successfully!`, 'success');
      setShowAddModal(false);
      fetchSchedules();
    } catch (err) {
      console.error('Error creating train schedule:', err);
      showToast('Failed to create train: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    if (!trainNo || !trainName || !source || !dest) return;

    const payload = {
      train_number: trainNo.trim(),
      train_name: trainName.trim(),
      source: source.toUpperCase().trim(),
      destination: dest.toUpperCase().trim(),
      departure_time: convertTo24Hour(depTime),
      arrival_time: convertTo24Hour(arrTime),
      frequency: frequency || 'Daily',
      distance_km: 500,
      fare_multiplier: parseFloat(baseFare) / 350 || 1.0,
      stops: stopsInput.filter(st => st.stationCode)
    };

    try {
      await api.put(`/trains/${selectedSch.id}`, payload);
      showToast(`Train schedule ${trainName} updated successfully!`, 'success');
      setShowEditModal(false);
      fetchSchedules();
    } catch (err) {
      console.error('Error updating train schedule:', err);
      showToast('Failed to update train: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this train?')) return;
    try {
      await api.delete(`/trains/${id}`);
      showToast('Train schedule record removed successfully.', 'info');
      fetchSchedules();
    } catch (err) {
      console.error('Error deleting train:', err);
      showToast('Failed to delete train: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const filteredSchedules = schedules.filter(s => 
    s.trainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.trainNo.includes(searchQuery) ||
    s.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.dest.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Train Fleet & Schedule Management</h1>
          <p className="text-xs text-slate-400">Configure rail routes, add schedule times, and manage intermediate stops.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 w-fit transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Train</span>
        </button>
      </div>

      {/* Schedules list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>Active Schedules Timetable</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-855 w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search trains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Train No.</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Train Name</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Route</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Departure (Date & Time)</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Arrival (Date & Time)</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Route Stops</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Frequency</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredSchedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-sm font-black text-slate-700 font-mono">{s.trainNo}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{s.trainName}</td>
                  <td className="px-6 py-4 text-xs text-slate-600 font-bold leading-tight">
                    <div className="text-[11px] font-black text-slate-800 uppercase">{s.source} &rarr; {s.dest}</div>
                    <div className="text-[9px] text-slate-400 font-bold truncate max-w-[200px] mt-0.5" title={`${getStationName(s.source)} to ${getStationName(s.dest)}`}>
                      {getStationName(s.source)} &rarr; {getStationName(s.dest)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-semibold font-mono">
                    {s.depDate && (s.frequency === 'Weekly' || s.frequency === 'Bi-Weekly') ? (
                      <>
                        <div className="font-bold text-slate-700">{s.depDate}</div>
                        <div className="text-slate-400">{s.depTime}</div>
                      </>
                    ) : (
                      <div className="text-slate-700 font-bold">{s.depTime}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-semibold font-mono">
                    {s.arrDate && (s.frequency === 'Weekly' || s.frequency === 'Bi-Weekly') ? (
                      <>
                        <div className="font-bold text-slate-700">{s.arrDate}</div>
                        <div className="text-slate-400">{s.arrTime}</div>
                      </>
                    ) : (
                      <div className="text-slate-700 font-bold">{s.arrTime}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                    <button
                      onClick={() => openStopsModal(s)}
                      className="text-primary-600 hover:text-primary-750 font-extrabold flex items-center space-x-1 hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{s.stops ? s.stops.length : 0} stops</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-550">{s.frequency}</td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1 text-slate-400 hover:text-primary-600 transition"
                        title="Edit Train"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                        title="Delete Train"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSchedules.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-xs font-bold text-slate-400">
                    {schedules.length === 0 ? 'No trains have been added yet.' : 'No active train schedules matching search criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Add Train Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 animate-scale-in my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Add New Train Route & Stops</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 uppercase">Train Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 12951"
                    value={trainNo}
                    onChange={(e) => setTrainNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 uppercase">Train Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajdhani Exp"
                    value={trainName}
                    onChange={(e) => setTrainName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 uppercase">Source Terminal</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    list="station-names-list"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                  {source && (
                    <span className="block text-[10px] text-slate-500 font-bold pl-1 uppercase tracking-tight truncate">
                      {getStationName(source)}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-550 uppercase">Destination Terminal</label>
                  <input
                    type="text"
                    placeholder="e.g. MMCT"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    list="station-names-list"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                  {dest && (
                    <span className="block text-[10px] text-slate-500 font-bold pl-1 uppercase tracking-tight truncate">
                      {getStationName(dest)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-550 uppercase">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                >
                  <option value="Daily">Daily</option>
                  <option value="Except Thu">Except Thu</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                </select>
              </div>

              {/* Conditional Date inputs for Weekly and Bi-Weekly */}
              {isDateRequired && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-primary-600 uppercase">Departure Date</label>
                    <input
                      type="date"
                      value={depDate}
                      onChange={(e) => setDepDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                      required={isDateRequired}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-emerald-600 uppercase">Arrival Date</label>
                    <input
                      type="date"
                      value={arrDate}
                      onChange={(e) => setArrDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                      required={isDateRequired}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <PopoverTimePicker
                  label="Departure Time"
                  value={depTime}
                  onChange={(val) => setDepTime(val)}
                />
                <PopoverTimePicker
                  label="Arrival Time"
                  value={arrTime}
                  onChange={(val) => setArrTime(val)}
                />
              </div>

              {/* Dynamic stops container */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary-500" />
                    <span>Intermediate Stops & Halts</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddStopInput}
                    className="text-[10px] font-black text-primary-600 hover:text-primary-750 flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Stop Station</span>
                  </button>
                </div>

                 {stopsInput.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 px-3.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    <div className="col-span-2 text-center">Code</div>
                    <div className="col-span-3 text-center">Arrival</div>
                    <div className="col-span-3 text-center">Departure</div>
                    <div className="col-span-2 text-center">Halt</div>
                    <div className="col-span-2 text-center">KM</div>
                  </div>
                )}

                <div className="space-y-2 pr-1 border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                  {stopsInput.map((stop, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white border border-slate-100 rounded-xl p-2 shadow-xs">
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Code"
                          value={stop.stationCode}
                          onChange={(e) => handleStopChange(idx, 'stationCode', e.target.value.toUpperCase())}
                          list="station-names-list"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center text-slate-855 uppercase focus:outline-none focus:border-primary-500"
                          required
                        />
                        {stop.stationCode && (
                          <span className="block text-[8px] text-slate-400 font-bold text-center truncate mt-0.5" title={getStationName(stop.stationCode)}>
                            {getStationName(stop.stationCode)}
                          </span>
                        )}
                      </div>
                      <div className="col-span-3">
                        <StopPopoverTimePicker value={stop.arrTime} placeholder="Arr Time" onChange={(val) => handleStopChange(idx, 'arrTime', val)} />
                      </div>
                      <div className="col-span-3">
                        <StopPopoverTimePicker value={stop.depTime} placeholder="Dep Time" onChange={(val) => handleStopChange(idx, 'depTime', val)} />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Halt"
                          value={stop.haltMinutes}
                          onChange={(e) => handleStopChange(idx, 'haltMinutes', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[11px] font-bold text-center text-slate-855 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="KM"
                          value={stop.distanceFromOriginKm ?? stop.distance_km ?? ''}
                          onChange={(e) => handleStopChange(idx, 'distanceFromOriginKm', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[11px] font-bold text-center text-slate-855 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveStopInput(idx)}
                          className="text-red-500 hover:text-red-750 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {stopsInput.length === 0 && (
                    <p className="text-[11px] font-bold text-slate-400 text-center py-4">No intermediate stops added yet. Direct train route.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-55 rounded-xl text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-xl text-xs font-bold text-white shadow-sm"
                >
                  Create Train Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Train Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 animate-scale-in my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Edit Train Route & Stops</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase">Train Number</label>
                  <input
                    type="text"
                    value={trainNo}
                    onChange={(e) => setTrainNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase">Train Name</label>
                  <input
                    type="text"
                    value={trainName}
                    onChange={(e) => setTrainName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase">Source Terminal</label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    list="station-names-list"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                  {source && (
                    <span className="block text-[10px] text-slate-500 font-bold pl-1 uppercase tracking-tight truncate">
                      {getStationName(source)}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase">Destination Terminal</label>
                  <input
                    type="text"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    list="station-names-list"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                  {dest && (
                    <span className="block text-[10px] text-slate-500 font-bold pl-1 uppercase tracking-tight truncate">
                      {getStationName(dest)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-555 uppercase">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                >
                  <option value="Daily">Daily</option>
                  <option value="Except Thu">Except Thu</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                </select>
              </div>

              {/* Conditional Date inputs for Weekly and Bi-Weekly */}
              {isDateRequired && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-primary-600 uppercase">Departure Date</label>
                    <input
                      type="date"
                      value={depDate}
                      onChange={(e) => setDepDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                      required={isDateRequired}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-emerald-600 uppercase">Arrival Date</label>
                    <input
                      type="date"
                      value={arrDate}
                      onChange={(e) => setArrDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                      required={isDateRequired}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <PopoverTimePicker
                  label="Departure Time"
                  value={depTime}
                  onChange={(val) => setDepTime(val)}
                />
                <PopoverTimePicker
                  label="Arrival Time"
                  value={arrTime}
                  onChange={(val) => setArrTime(val)}
                />
              </div>

              {/* Dynamic stops container */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary-500" />
                    <span>Intermediate Stops & Halts</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddStopInput}
                    className="text-[10px] font-black text-primary-600 hover:text-primary-750 flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Stop Station</span>
                  </button>
                </div>

                 {stopsInput.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 px-3.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    <div className="col-span-3 text-center">Code</div>
                    <div className="col-span-3 text-center">Arrival</div>
                    <div className="col-span-3 text-center">Departure</div>
                    <div className="col-span-2 text-center">Halt (min)</div>
                    <div className="col-span-1"></div>
                  </div>
                )}

                <div className="space-y-2 pr-1 border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                  {stopsInput.map((stop, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white border border-slate-100 rounded-xl p-2 shadow-xs">
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Code"
                          value={stop.stationCode}
                          onChange={(e) => handleStopChange(idx, 'stationCode', e.target.value.toUpperCase())}
                          list="station-names-list"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center text-slate-850 uppercase focus:outline-none focus:border-primary-500"
                          required
                        />
                        {stop.stationCode && (
                          <span className="block text-[8px] text-slate-400 font-bold text-center truncate mt-0.5" title={getStationName(stop.stationCode)}>
                            {getStationName(stop.stationCode)}
                          </span>
                        )}
                      </div>
                      <div className="col-span-3">
                        <StopPopoverTimePicker value={stop.arrTime} placeholder="Arr Time" onChange={(val) => handleStopChange(idx, 'arrTime', val)} />
                      </div>
                      <div className="col-span-3">
                        <StopPopoverTimePicker value={stop.depTime} placeholder="Dep Time" onChange={(val) => handleStopChange(idx, 'depTime', val)} />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Halt"
                          value={stop.haltMinutes}
                          onChange={(e) => handleStopChange(idx, 'haltMinutes', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[11px] font-bold text-center text-slate-855 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveStopInput(idx)}
                          className="text-red-500 hover:text-red-750 transition"
                        >
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {stopsInput.length === 0 && (
                    <p className="text-[11px] font-bold text-slate-400 text-center py-4">No intermediate stops added yet. Direct train route.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-xl text-xs font-bold text-white shadow-sm"
                >
                  Save Train Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Stops Modal - Editable */}
      {showStopsModal && selectedSch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-700 space-y-4 animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-white">{selectedSch.trainName} ({selectedSch.trainNo})</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Manage Intermediate Stops · {selectedSch.source} → {selectedSch.dest}</p>
              </div>
              <button onClick={() => setShowStopsModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Route header */}
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 shrink-0">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-[9px] font-black text-white uppercase shrink-0">S</div>
              <span className="text-xs font-black text-white uppercase tracking-wider">{selectedSch.source}</span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-[10px] text-slate-400 font-mono">{selectedSch.depTime}</span>
              <div className="flex-1 border-t border-dashed border-slate-600 mx-2" />
              <span className="text-[10px] text-slate-400 font-mono">{selectedSch.arrTime}</span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-xs font-black text-white uppercase tracking-wider">{selectedSch.dest}</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white uppercase shrink-0">D</div>
            </div>

            {/* Editable stops list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-36">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-3 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                <div className="col-span-2 text-center">Code</div>
                <div className="col-span-3 text-center">Arrival</div>
                <div className="col-span-3 text-center">Departure</div>
                <div className="col-span-2 text-center">Halt</div>
                <div className="col-span-2 text-center">KM</div>
              </div>

              {stopsModalEdits.map((stop, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-800 border border-slate-700 rounded-xl p-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Code"
                      value={stop.stationCode}
                      onChange={(e) => handleStopsModalChange(idx, 'stationCode', e.target.value.toUpperCase())}
                      list="station-names-list"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center text-white uppercase focus:outline-none focus:border-primary-400"
                    />
                    {stop.stationCode && (
                      <span className="block text-[8px] text-slate-400 font-bold text-center truncate mt-0.5" title={getStationName(stop.stationCode)}>
                        {getStationName(stop.stationCode)}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3">
                    <StopPopoverTimePicker value={stop.arrTime} placeholder="Arr Time" onChange={(val) => handleStopsModalChange(idx, 'arrTime', val)} />
                  </div>
                  <div className="col-span-3">
                    <StopPopoverTimePicker value={stop.depTime} placeholder="Dep Time" onChange={(val) => handleStopsModalChange(idx, 'depTime', val)} />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="min"
                      value={stop.haltMinutes}
                      onChange={(e) => handleStopsModalChange(idx, 'haltMinutes', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-1 py-1.5 text-[11px] font-bold text-center text-white focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="KM"
                      value={stop.distanceFromOriginKm ?? stop.distance_km ?? ''}
                      onChange={(e) => handleStopsModalChange(idx, 'distanceFromOriginKm', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-1 py-1.5 text-[11px] font-bold text-center text-white focus:outline-none"
                    />
                    <button type="button" onClick={() => handleRemoveStopsModalStop(idx)} className="text-red-400 hover:text-red-300 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {stopsModalEdits.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[11px] font-bold">No intermediate stops. Click "Add Stop" to add one.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAddStopsModalStop}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Stop
              </button>
              <button
                type="button"
                onClick={handleSaveStopsModal}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition"
              >
                Save Stops
              </button>
              <button
                type="button"
                onClick={() => setShowStopsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Station Names Datalist for inputs */}
      <datalist id="station-names-list">
        {indianStations.map(st => (
          <option key={st.code} value={st.code}>
            {st.name} ({st.code})
          </option>
        ))}
      </datalist>
    </>
  );
};

export default AdminSchedules;
