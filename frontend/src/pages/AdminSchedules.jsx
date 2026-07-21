import React, { useState } from 'react';
import { Clock, Plus, Search, Calendar, Edit, Trash2 } from 'lucide-react';

const AdminSchedules = () => {
  const [schedules, setSchedules] = useState([
    { id: 'sch-1', trainNo: '12951', trainName: 'Mumbai Rajdhani', source: 'NDLS', dest: 'MMCT', depTime: '04:55 PM', arrTime: '08:35 AM', frequency: 'Daily', status: 'Active' },
    { id: 'sch-2', trainNo: '12002', trainName: 'New Delhi Shatabdi', source: 'NDLS', dest: 'BPL', depTime: '06:00 AM', arrTime: '02:40 PM', frequency: 'Daily', status: 'Active' },
    { id: 'sch-3', trainNo: '22436', trainName: 'Vande Bharat Exp', source: 'NDLS', dest: 'BSB', depTime: '06:00 AM', arrTime: '02:00 PM', frequency: 'Except Thu', status: 'Active' },
    { id: 'sch-4', trainNo: '12628', trainName: 'Karnataka Express', source: 'NDLS', dest: 'SBC', depTime: '08:15 PM', arrTime: '01:40 PM', frequency: 'Daily', status: 'Active' }
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [trainNo, setTrainNo] = useState('');
  const [trainName, setTrainName] = useState('');
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [depTime, setDepTime] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [frequency, setFrequency] = useState('Daily');

  const handleCreateSchedule = (e) => {
    e.preventDefault();
    if (!trainNo || !trainName || !source || !dest) return;
    const newSch = {
      id: `sch-${schedules.length + 1}`,
      trainNo,
      trainName,
      source,
      dest,
      depTime,
      arrTime,
      frequency,
      status: 'Active'
    };
    setSchedules([...schedules, newSch]);
    setShowAddModal(false);
    setTrainNo('');
    setTrainName('');
    setSource('');
    setDest('');
    setDepTime('');
    setArrTime('');
    setFrequency('Daily');
  };

  const handleDelete = (id) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Schedule Management</h1>
          <p className="text-xs text-slate-400">Add, configure, or suspend train schedule times and route frequencies.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 w-fit transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Schedule</span>
        </button>
      </div>

      {/* Schedules list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>Active Schedules Timetable</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-850">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search train schedules..."
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
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
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Dep. Time</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Arr. Time</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Frequency</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-sm font-black text-slate-700 font-mono">{s.trainNo}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{s.trainName}</td>
                  <td className="px-6 py-4 text-sm text-slate-550 font-bold">{s.source} &rarr; {s.dest}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold font-mono">{s.depTime}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold font-mono">{s.arrTime}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">{s.frequency}</td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button className="p-1 text-slate-400 hover:text-primary-600 transition">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 text-slate-400 hover:text-red-650 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Add New Schedule</h3>
            </div>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Train Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 12951"
                    value={trainNo}
                    onChange={(e) => setTrainNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Train Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajdhani Exp"
                    value={trainName}
                    onChange={(e) => setTrainName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Source (Code)</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Destination (Code)</label>
                  <input
                    type="text"
                    placeholder="e.g. MMCT"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Dep. Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 04:55 PM"
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Arr. Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 08:35 AM"
                    value={arrTime}
                    onChange={(e) => setArrTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-455 uppercase">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                >
                  <option value="Daily">Daily</option>
                  <option value="Except Thu">Except Thu</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-Weekly">Bi-Weekly</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
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
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSchedules;
