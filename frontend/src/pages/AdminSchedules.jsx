import React, { useState } from 'react';
import { Clock, Plus, Search, Calendar, Edit, Trash2, MapPin, Eye, X, ArrowRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const defaultSchedules = [
  { 
    id: 'sch-1', 
    trainNo: '12951', 
    trainName: 'Mumbai Rajdhani', 
    source: 'NDLS', 
    dest: 'MMCT', 
    depTime: '04:55 PM', 
    arrTime: '08:35 AM', 
    frequency: 'Daily', 
    status: 'Active',
    stops: [
      { stationCode: 'KOTA', arrTime: '09:10 PM', depTime: '09:20 PM', haltMinutes: '10' },
      { stationCode: 'RTM', arrTime: '01:05 AM', depTime: '01:10 AM', haltMinutes: '5' },
      { stationCode: 'BRC', arrTime: '04:40 AM', depTime: '04:48 AM', haltMinutes: '8' }
    ]
  },
  { 
    id: 'sch-2', 
    trainNo: '12002', 
    trainName: 'New Delhi Shatabdi', 
    source: 'NDLS', 
    dest: 'BPL', 
    depTime: '06:00 AM', 
    arrTime: '02:40 PM', 
    frequency: 'Daily', 
    status: 'Active',
    stops: [
      { stationCode: 'MTJ', arrTime: '07:20 AM', depTime: '07:22 AM', haltMinutes: '2' },
      { stationCode: 'AGC', arrTime: '07:57 AM', depTime: '08:02 AM', haltMinutes: '5' },
      { stationCode: 'GWL', arrTime: '09:43 AM', depTime: '09:45 AM', haltMinutes: '2' },
      { stationCode: 'VGLJ', arrTime: '11:20 AM', depTime: '11:28 AM', haltMinutes: '8' }
    ]
  },
  { 
    id: 'sch-3', 
    trainNo: '22436', 
    trainName: 'Vande Bharat Exp', 
    source: 'NDLS', 
    dest: 'BSB', 
    depTime: '06:00 AM', 
    arrTime: '02:00 PM', 
    frequency: 'Except Thu', 
    status: 'Active',
    stops: [
      { stationCode: 'CNB', arrTime: '10:08 AM', depTime: '10:10 AM', haltMinutes: '2' },
      { stationCode: 'PRYJ', arrTime: '12:08 PM', depTime: '12:10 PM', haltMinutes: '2' }
    ]
  },
  { 
    id: 'sch-4', 
    trainNo: '12628', 
    trainName: 'Karnataka Express', 
    source: 'NDLS', 
    dest: 'SBC', 
    depTime: '08:15 PM', 
    arrTime: '01:40 PM', 
    frequency: 'Daily', 
    status: 'Active',
    stops: [
      { stationCode: 'AGC', arrTime: '11:15 PM', depTime: '11:20 PM', haltMinutes: '5' },
      { stationCode: 'VGLJ', arrTime: '02:50 AM', depTime: '02:58 AM', haltMinutes: '8' },
      { stationCode: 'BPL', arrTime: '06:45 AM', depTime: '06:50 AM', haltMinutes: '5' },
      { stationCode: 'ET', arrTime: '08:20 AM', depTime: '08:25 AM', haltMinutes: '5' },
      { stationCode: 'NGP', arrTime: '12:45 PM', depTime: '12:50 PM', haltMinutes: '5' }
    ]
  }
];

const AdminSchedules = () => {
  const { showToast } = useToast();

  const [schedules, setSchedules] = useState(() => {
    try {
      const stored = localStorage.getItem('added_staff_trains');
      if (stored) {
        const parsed = JSON.parse(stored);
        const mapped = parsed.map(t => ({
          id: t.id,
          trainNo: t.trainNo,
          trainName: t.trainName,
          source: t.source || t.from,
          dest: t.dest || t.to,
          depDate: t.depDate || '',
          depTime: t.depTime,
          arrDate: t.arrDate || '',
          arrTime: t.arrTime,
          frequency: t.frequency || 'Daily',
          status: t.status === 'on_time' || t.status === 'Active' || t.status === 'On Time' ? 'Active' : 'Delayed',
          stops: t.stops || []
        }));

        const all = [...mapped];
        const seen = new Set(all.map(s => s.trainNo));
        defaultSchedules.forEach(d => {
          if (!seen.has(d.trainNo)) {
            all.push(d);
          }
        });
        return all;
      }
    } catch (e) {
      console.error(e);
    }
    return defaultSchedules;
  });

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
  const [depTime, setDepTime] = useState('');
  const [arrDate, setArrDate] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [stopsInput, setStopsInput] = useState([]);

  const isDateRequired = frequency === 'Weekly' || frequency === 'Bi-Weekly';

  const saveSchedulesToStorage = (newSchedules) => {
    try {
      const formatted = newSchedules.map(s => ({
        id: s.id,
        trainNo: s.trainNo,
        trainName: s.trainName,
        source: s.source,
        from: s.source,
        dest: s.dest,
        to: s.dest,
        depDate: s.depDate,
        depTime: s.depTime,
        arrDate: s.arrDate,
        arrTime: s.arrTime,
        frequency: s.frequency,
        status: s.status,
        stops: s.stops
      }));
      localStorage.setItem('added_staff_trains', JSON.stringify(formatted));
    } catch (e) {
      console.error(e);
    }
  };

  const openAddModal = () => {
    setTrainNo('');
    setTrainName('');
    setSource('');
    setDest('');
    setDepDate('');
    setDepTime('');
    setArrDate('');
    setArrTime('');
    setFrequency('Daily');
    setStopsInput([]);
    setShowAddModal(true);
  };

  const openEditModal = (sch) => {
    setSelectedSch(sch);
    setTrainNo(sch.trainNo);
    setTrainName(sch.trainName);
    setSource(sch.source);
    setDest(sch.dest);
    setDepDate(sch.depDate || '');
    setDepTime(sch.depTime || '');
    setArrDate(sch.arrDate || '');
    setArrTime(sch.arrTime || '');
    setFrequency(sch.frequency);
    setStopsInput(sch.stops ? [...sch.stops] : []);
    setShowEditModal(true);
  };

  const openStopsModal = (sch) => {
    setSelectedSch(sch);
    setShowStopsModal(true);
  };

  const handleAddStopInput = () => {
    setStopsInput([...stopsInput, { stationCode: '', arrTime: '', depTime: '', haltMinutes: '2' }]);
  };

  const handleRemoveStopInput = (index) => {
    setStopsInput(stopsInput.filter((_, idx) => idx !== index));
  };

  const handleStopChange = (index, field, value) => {
    const updated = [...stopsInput];
    updated[index][field] = value;
    setStopsInput(updated);
  };

  const handleCreateSchedule = (e) => {
    e.preventDefault();
    if (!trainNo || !trainName || !source || !dest) return;
    
    const newSch = {
      id: `sch-${Date.now()}`,
      trainNo: trainNo.trim(),
      trainName: trainName.trim(),
      source: source.toUpperCase().trim(),
      dest: dest.toUpperCase().trim(),
      depDate: isDateRequired ? depDate : '',
      depTime: depTime.trim(),
      arrDate: isDateRequired ? arrDate : '',
      arrTime: arrTime.trim(),
      frequency,
      status: 'Active',
      stops: stopsInput.filter(s => s.stationCode)
    };

    const updated = [...schedules, newSch];
    setSchedules(updated);
    saveSchedulesToStorage(updated);
    setShowAddModal(false);
    showToast(`Train schedule ${newSch.trainName} (${newSch.trainNo}) created successfully!`, 'success');
  };

  const handleUpdateSchedule = (e) => {
    e.preventDefault();
    if (!trainNo || !trainName || !source || !dest) return;

    const updated = schedules.map(s => {
      if (s.id === selectedSch.id) {
        return {
          ...s,
          trainNo: trainNo.trim(),
          trainName: trainName.trim(),
          source: source.toUpperCase().trim(),
          dest: dest.toUpperCase().trim(),
          depDate: isDateRequired ? depDate : '',
          depTime: depTime.trim(),
          arrDate: isDateRequired ? arrDate : '',
          arrTime: arrTime.trim(),
          frequency,
          stops: stopsInput.filter(st => st.stationCode)
        };
      }
      return s;
    });

    setSchedules(updated);
    saveSchedulesToStorage(updated);
    setShowEditModal(false);
    showToast(`Train schedule ${trainName} updated successfully!`, 'success');
  };

  const handleDelete = (id) => {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    saveSchedulesToStorage(updated);
    showToast('Train schedule record removed from database.', 'info');
  };

  const filteredSchedules = schedules.filter(s => 
    s.trainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.trainNo.includes(searchQuery) ||
    s.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.dest.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
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
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-800 w-full sm:w-64">
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
                  <td className="px-6 py-4 text-sm text-slate-600 font-bold">{s.source} &rarr; {s.dest}</td>
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
                      className="text-primary-600 hover:text-primary-700 font-extrabold flex items-center space-x-1 hover:underline"
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
                    No active train schedules matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Train Number</label>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Train Name</label>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Source Terminal</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Destination Terminal</label>
                  <input
                    type="text"
                    placeholder="e.g. MMCT"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Frequency</label>
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Departure Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 04:55 PM"
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Arrival Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 08:35 AM"
                    value={arrTime}
                    onChange={(e) => setArrTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
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

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                  {stopsInput.map((stop, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white border border-slate-100 rounded-xl p-2 shadow-xs">
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Code (e.g. KOTA)"
                          value={stop.stationCode}
                          onChange={(e) => handleStopChange(idx, 'stationCode', e.target.value.toUpperCase())}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center text-slate-850 uppercase focus:outline-none focus:border-primary-500"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Arr"
                          value={stop.arrTime}
                          onChange={(e) => handleStopChange(idx, 'arrTime', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Dep"
                          value={stop.depTime}
                          onChange={(e) => handleStopChange(idx, 'depTime', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Halt"
                          value={stop.haltMinutes}
                          onChange={(e) => handleStopChange(idx, 'haltMinutes', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-center text-slate-855 focus:outline-none"
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Train Number</label>
                  <input
                    type="text"
                    value={trainNo}
                    onChange={(e) => setTrainNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Train Name</label>
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Source Terminal</label>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Destination Terminal</label>
                  <input
                    type="text"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Frequency</label>
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Departure Time</label>
                  <input
                    type="text"
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Arrival Time</label>
                  <input
                    type="text"
                    value={arrTime}
                    onChange={(e) => setArrTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
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

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                  {stopsInput.map((stop, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white border border-slate-100 rounded-xl p-2 shadow-xs">
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Code"
                          value={stop.stationCode}
                          onChange={(e) => handleStopChange(idx, 'stationCode', e.target.value.toUpperCase())}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center text-slate-850 uppercase focus:outline-none focus:border-primary-500"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Arr"
                          value={stop.arrTime}
                          onChange={(e) => handleStopChange(idx, 'arrTime', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Dep"
                          value={stop.depTime}
                          onChange={(e) => handleStopChange(idx, 'depTime', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Halt"
                          value={stop.haltMinutes}
                          onChange={(e) => handleStopChange(idx, 'haltMinutes', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-center text-slate-855 focus:outline-none"
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

      {/* View Stops Timetable Modal */}
      {showStopsModal && selectedSch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-700 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">{selectedSch.trainName} ({selectedSch.trainNo})</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Route Stops Schedule Timetable</p>
              </div>
              <button onClick={() => setShowStopsModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-2 space-y-6 max-h-80 overflow-y-auto pr-1">
              {/* Source Station */}
              <div className="relative flex items-start space-x-3.5 pl-2">
                <div className="absolute left-4 top-5 bottom-[-24px] w-0.5 bg-gradient-to-b from-primary-500 to-slate-700" />
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 ring-4 ring-primary-500/20 text-[9px] font-black text-white z-10 shrink-0 uppercase">S</div>
                <div className="leading-tight">
                  <span className="text-xs font-black text-white block uppercase tracking-wider">{selectedSch.source} &bull; Origin Terminal</span>
                  {selectedSch.depDate && (selectedSch.frequency === 'Weekly' || selectedSch.frequency === 'Bi-Weekly') && (
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                      Departure Date: <span className="text-white font-bold">{selectedSch.depDate}</span>
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    Departure Time: <span className="text-white">{selectedSch.depTime}</span>
                  </span>
                </div>
              </div>

              {/* Intermediate Stops */}
              {selectedSch.stops && selectedSch.stops.map((stop, idx) => (
                <div key={idx} className="relative flex items-start space-x-3.5 pl-2">
                  {idx < selectedSch.stops.length - 1 ? (
                    <div className="absolute left-4 top-5 bottom-[-24px] w-0.5 bg-slate-700" />
                  ) : (
                    <div className="absolute left-4 top-5 bottom-[-24px] w-0.5 bg-gradient-to-b from-slate-700 to-emerald-500" />
                  )}
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 ring-4 ring-slate-700/20 text-[9px] font-bold text-slate-300 z-10 shrink-0">{idx + 1}</div>
                  <div className="leading-tight">
                    <span className="text-xs font-black text-white block uppercase tracking-wider">{stop.stationCode}</span>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                      Arrival: {stop.arrTime} &bull; Departure: {stop.depTime}
                    </span>
                    <span className="inline-block bg-white/10 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 font-mono">
                      Halt: {stop.haltMinutes} mins
                    </span>
                  </div>
                </div>
              ))}

              {/* Destination Station */}
              <div className="relative flex items-start space-x-3.5 pl-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 text-[9px] font-black text-white z-10 shrink-0 uppercase">D</div>
                <div className="leading-tight">
                  <span className="text-xs font-black text-white block uppercase tracking-wider">{selectedSch.dest} &bull; Destination Terminal</span>
                  {selectedSch.arrDate && (selectedSch.frequency === 'Weekly' || selectedSch.frequency === 'Bi-Weekly') && (
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                      Arrival Date: <span className="text-white font-bold">{selectedSch.arrDate}</span>
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    Arrival Time: <span className="text-white">{selectedSch.arrTime}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                onClick={() => setShowStopsModal(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
              >
                Close Timetable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSchedules;
