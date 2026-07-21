import React, { useState } from 'react';
import { Building2, Plus, Search, MapPin, Trash2, Edit } from 'lucide-react';
import { indianStations } from '../utils/stationsData';
import { useToast } from '../context/ToastContext';

const AdminStations = () => {
  const { showToast } = useToast();
  const [stations, setStations] = useState(
    indianStations.map((st, idx) => ({
      id: `st-${idx + 1}`,
      code: st.code,
      name: st.name,
      state: st.state,
      platforms: st.platforms,
      status: 'Active'
    }))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [stateName, setStateName] = useState('');
  const [platforms, setPlatforms] = useState('');

  const handleCreateStation = (e) => {
    e.preventDefault();
    if (!code || !name) return;
    const newSt = {
      id: `st-${stations.length + 1}`,
      code: code.toUpperCase(),
      name,
      state: stateName || 'Unknown',
      platforms: parseInt(platforms) || 2,
      status: 'Active'
    };
    setStations([newSt, ...stations]);
    setShowAddModal(false);
    setCode('');
    setName('');
    setStateName('');
    setPlatforms('');
    showToast(`Railway station ${newSt.name} (${newSt.code}) added successfully!`, 'success', 'Station Added');
  };

  const handleDelete = (id) => {
    setStations(stations.filter(s => s.id !== id));
    showToast('Station record removed from active list.', 'info', 'Station Deleted');
  };

  const filteredStations = stations.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Station Management</h1>
          <p className="text-xs text-slate-400">Configure train junction station terminals, platforms count, and state coordinates.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 w-fit transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Station</span>
        </button>
      </div>

      {/* Stations list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Active Terminals Network</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-855">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search stations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Station Code</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Station Name</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Location State</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Platforms</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStations.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-sm font-black text-slate-800 font-mono">{s.code}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-850">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold">{s.state}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold font-mono">{s.platforms}</td>
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
              <h3 className="text-base font-black text-slate-800">Add New Station</h3>
            </div>
            <form onSubmit={handleCreateStation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Station Code</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Station Name</label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Platforms</label>
                  <input
                    type="number"
                    placeholder="e.g. 16"
                    value={platforms}
                    onChange={(e) => setPlatforms(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                  />
                </div>
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
                  Save Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStations;
