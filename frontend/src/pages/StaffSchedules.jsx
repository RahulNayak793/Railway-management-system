import React, { useState, useEffect } from 'react';
import { Train, Clock, ArrowRight, ShieldAlert, Plus, X, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import TrainScheduleModal from '../components/TrainScheduleModal';

const StaffSchedules = () => {
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status updating form states
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [status, setStatus] = useState('on_time');
  const [delay, setDelay] = useState(0);
  const [reason, setReason] = useState('Signal Maintenance');

  // Add new train schedule modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTrainNo, setNewTrainNo] = useState('');
  const [newTrainName, setNewTrainName] = useState('');
  const [newSource, setNewSource] = useState('NDLS');
  const [newDest, setNewDest] = useState('MMCT');
  const [newDepTime, setNewDepTime] = useState('06:00');
  const [newArrTime, setNewArrTime] = useState('14:30');
  const [newClasses, setNewClasses] = useState('1A,2A,3A,SL');
  const [newCapacity, setNewCapacity] = useState('720');

  const fetchTrains = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trains');
      let apiTrains = res.data || [];
      
      setTrains(apiTrains);
      if (apiTrains.length > 0 && !selectedTrain) {
        handleSelectTrain(apiTrains[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrains();
  }, []);

  const handleSelectTrain = (t) => {
    setSelectedTrain(t);
    setStatus(t.status);
    setDelay(t.delay_minutes);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedTrain) return;

    try {
      await api.put(`/trains/${selectedTrain.id}`, {
        status,
        delay_minutes: parseInt(delay)
      });
      alert(`Status updated successfully for train ${selectedTrain.train_name}!`);
      fetchTrains();
    } catch (err) {
      alert('Update failed');
    }
  };

  const handleCreateSchedule = async (payload) => {
    try {
      await api.post('/staff/trains/schedule', payload);
      alert(`Train schedule #${payload.train_number} ${payload.train_name} created successfully!`);
      setShowAddModal(false);
      fetchTrains();
    } catch (err) {
      console.error(err);
      alert('Failed to create train: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Train Operations & Schedules</h1>
          <p className="text-xs text-slate-400">Manage real-time schedule modifications, delays, platform assignments and add new train schedules.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition flex items-center space-x-2 shrink-0 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Train Schedule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left Side: Trains list */}
        <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm space-y-3 h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Train</h3>
            <span className="text-[10px] font-mono text-slate-400 font-bold">{trains.length} Active</span>
          </div>

          {loading ? (
            <div className="text-center py-6">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent align-[-0.125em]" />
            </div>
          ) : (
            <div className="space-y-2">
              {trains.map(t => {
                const isActive = selectedTrain?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTrain(t)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isActive 
                        ? 'border-primary-500 bg-primary-50/10' 
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-800 text-xs">{t.train_name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                        t.status === 'on_time' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      #{t.train_number} &bull; <span className="font-bold text-blue-600">{t.train_type || 'Superfast'}</span> &bull; Dep: {t.route?.departure_time || '16:30'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Operations Form */}
        <div className="md:col-span-2 border border-slate-200 rounded-2xl bg-white p-6 shadow-sm self-start">
          {selectedTrain ? (
            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-800 text-base">{selectedTrain.train_name}</h3>
                  <span className="font-mono text-slate-600 font-extrabold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    #{selectedTrain.train_number}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
                    {selectedTrain.train_type || 'Superfast'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Train Number</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">{selectedTrain.train_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Train Name</span>
                    <span className="font-bold text-slate-800 text-sm truncate block" title={selectedTrain.train_name}>{selectedTrain.train_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Train Type</span>
                    <span className="font-bold text-blue-600 text-sm block">{selectedTrain.train_type || 'Superfast'}</span>
                  </div>
                </div>
              </div>

              {/* Status Select Buttons */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operational Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'on_time', label: 'On Time', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                    { id: 'delayed', label: 'Delayed', color: 'border-amber-200 bg-amber-50 text-amber-700' },
                    { id: 'cancelled', label: 'Cancelled', color: 'border-rose-200 bg-rose-50 text-rose-700' }
                  ].map(opt => {
                    const active = status === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStatus(opt.id);
                          if (opt.id !== 'delayed') setDelay(0);
                        }}
                        className={`py-3 rounded-xl border text-xs font-semibold text-center transition ${
                          active ? opt.color : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delay & Reasons */}
              {status === 'delayed' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delay Duration (Minutes)</label>
                    <input
                      type="number"
                      value={delay}
                      onChange={(e) => setDelay(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none font-semibold text-slate-800"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason Code</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none font-semibold text-slate-800 cursor-pointer"
                    >
                      <option value="Signal Maintenance">Signal Maintenance</option>
                      <option value="Congestion / Traffic">Congestion / Traffic</option>
                      <option value="Weather / Visibility">Weather / Visibility</option>
                      <option value="Operational Incident">Operational Incident</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3.5 font-bold text-white shadow"
              >
                <span>Update Dispatch Status</span>
              </button>
            </form>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Train className="mx-auto h-12 w-12 text-slate-200 mb-3" />
              <p className="font-bold">No train schedule selected</p>
            </div>
          )}
        </div>
      </div>

      {/* ADD NEW TRAIN SCHEDULE MODAL */}
      <TrainScheduleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateSchedule}
        title="Staff Operational Schedule Dispatch"
        subtitle="Configure train route, timetable, and selectable travel classes."
      />
    </div>
  );
};

export default StaffSchedules;
