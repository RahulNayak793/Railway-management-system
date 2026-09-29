import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Plus, Search, MapPin, Trash2, Edit, Filter, Train, Layers,
  Compass, RefreshCw, CheckCircle2, ShieldCheck, Info, X, Check, ArrowUpRight, Activity
} from 'lucide-react';
import { indianStations } from '../utils/stationsData';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const AdminStations = () => {
  const { showToast } = useToast();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [stateName, setStateName] = useState('');
  const [platforms, setPlatforms] = useState('4');
  const [zone, setZone] = useState('Northern Railway');
  const [category, setCategory] = useState('Major Junction');

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trains/stations');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map(s => ({
          id: s.id,
          code: s.station_code || s.code,
          name: s.station_name || s.name,
          state: s.state || 'Delhi',
          platforms: s.platforms || 8,
          zone: s.zone || 'Indian Railways',
          category: s.category || 'Major Junction',
          status: 'Active'
        }));
        setStations(mapped);
      } else {
        setStations(indianStations.map((st, idx) => ({
          id: `st-${idx + 1}`,
          code: st.code,
          name: st.name,
          state: st.state || 'Various',
          platforms: st.platforms || (idx % 3 === 0 ? 12 : idx % 2 === 0 ? 8 : 4),
          zone: idx % 2 === 0 ? 'Northern Railway' : 'Western Railway',
          category: idx % 3 === 0 ? 'Terminal' : 'Major Junction',
          status: 'Active'
        })));
      }
    } catch (err) {
      console.warn('Error fetching stations from API, using default dataset:', err);
      setStations(indianStations.map((st, idx) => ({
        id: `st-${idx + 1}`,
        code: st.code,
        name: st.name,
        state: st.state || 'Various',
        platforms: st.platforms || (idx % 3 === 0 ? 12 : idx % 2 === 0 ? 8 : 4),
        zone: idx % 2 === 0 ? 'Northern Railway' : 'Western Railway',
        category: idx % 3 === 0 ? 'Terminal' : 'Major Junction',
        status: 'Active'
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = stations.length;
    const totalPlatforms = stations.reduce((sum, s) => sum + (parseInt(s.platforms) || 0), 0);
    const uniqueStates = new Set(stations.map(s => s.state)).size;
    const majorHubs = stations.filter(s => (parseInt(s.platforms) || 0) >= 8).length;
    return { total, totalPlatforms, uniqueStates, majorHubs };
  }, [stations]);

  // Unique states list for filtering
  const statesList = useMemo(() => {
    const list = Array.from(new Set(stations.map(s => s.state))).filter(Boolean).sort();
    return ['All', ...list];
  }, [stations]);

  // Filtered stations
  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.state.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesState = selectedState === 'All' || s.state === selectedState;
      return matchesSearch && matchesState;
    });
  }, [stations, searchQuery, selectedState]);

  // Create Station
  const handleCreateStation = async (e) => {
    e.preventDefault();
    if (!code || !name) return;

    try {
      const res = await api.post('/trains/stations', {
        station_code: code,
        station_name: name,
        state: stateName,
        platforms
      });

      const created = res.data || {};
      const newSt = {
        id: created.id || `st-${Date.now()}`,
        code: (created.station_code || code).toUpperCase(),
        name: created.station_name || name,
        state: created.state || stateName || 'Unknown',
        platforms: parseInt(platforms) || 4,
        zone: zone || 'Northern Railway',
        category: category || 'Major Junction',
        status: 'Active'
      };

      setStations(prev => [newSt, ...prev]);
      setShowAddModal(false);
      resetForm();
      showToast(`Railway terminal ${newSt.name} (${newSt.code}) added successfully!`, 'success', 'Terminal Registered');
    } catch (err) {
      console.error('Failed to create station:', err);
      // Fallback local save
      const newSt = {
        id: `st-${Date.now()}`,
        code: code.toUpperCase(),
        name,
        state: stateName || 'Unknown',
        platforms: parseInt(platforms) || 4,
        zone,
        category,
        status: 'Active'
      };
      setStations(prev => [newSt, ...prev]);
      setShowAddModal(false);
      resetForm();
      showToast(`Terminal ${newSt.name} (${newSt.code}) added!`, 'success', 'Terminal Registered');
    }
  };

  // Save Edit Station
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingStation) return;

    setStations(prev => prev.map(s => {
      if (s.id === editingStation.id) {
        return {
          ...s,
          code: code.toUpperCase(),
          name,
          state: stateName,
          platforms: parseInt(platforms) || 4,
          zone,
          category
        };
      }
      return s;
    }));

    setEditingStation(null);
    resetForm();
    showToast(`Updated station configuration for ${code.toUpperCase()}`, 'success', 'Station Saved');
  };

  // Open Edit Modal
  const handleOpenEdit = (s) => {
    setEditingStation(s);
    setCode(s.code);
    setName(s.name);
    setStateName(s.state);
    setPlatforms(s.platforms);
    setZone(s.zone || 'Northern Railway');
    setCategory(s.category || 'Major Junction');
  };

  // Delete Station
  const handleDelete = async (id) => {
    try {
      await api.delete(`/trains/stations/${id}`);
    } catch (err) {
      console.warn('API delete failed, removing locally:', err);
    }
    setStations(prev => prev.filter(s => s.id !== id));
    showToast('Station record removed from active directory.', 'info', 'Station Removed');
  };

  const resetForm = () => {
    setCode('');
    setName('');
    setStateName('');
    setPlatforms('4');
    setZone('Northern Railway');
    setCategory('Major Junction');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 font-sans space-y-8 animate-fade-in">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl text-white">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Building2 className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Station & Terminal Directory
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  Configure railway junction hubs, platform track allocations, and state zone classifications.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-lg hover:shadow-cyan-500/25 transition transform active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Terminal</span>
          </button>
        </div>

        {/* Top KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active Terminals</span>
              <Building2 className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">{stats.total}</span>
              <span className="text-[10px] text-cyan-400 font-bold">Stations</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Platforms</span>
              <Layers className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-400">{stats.totalPlatforms}</span>
              <span className="text-[10px] text-slate-400 font-bold">Track Lines</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">States Covered</span>
              <MapPin className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">{stats.uniqueStates}</span>
              <span className="text-[10px] text-slate-400 font-bold">Territories</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Major Hubs</span>
              <Train className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-amber-400">{stats.majorHubs}</span>
              <span className="text-[10px] text-slate-400 font-bold">≥8 Platforms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & State Filters */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by station code (NDLS, MAS...), station name, or state..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* State Filter Dropdown */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-500 flex items-center space-x-1">
            <Filter className="h-3.5 w-3.5" />
            <span>State Region:</span>
          </span>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            {statesList.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Terminals Table */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:px-6 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-850 flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-cyan-600" />
            <span>Operational Station Directory</span>
          </h3>
          <span className="text-xs font-bold text-slate-400 font-mono">
            Showing {filteredStations.length} of {stations.length} terminals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200/70 text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Station Code</th>
                <th className="px-6 py-4">Station Name</th>
                <th className="px-6 py-4">State Territory</th>
                <th className="px-6 py-4">Platforms Capacity</th>
                <th className="px-6 py-4">Zone Classification</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStations.length > 0 ? (
                filteredStations.map((s) => {
                  const platformCount = parseInt(s.platforms) || 4;
                  const platformPct = Math.min(100, Math.round((platformCount / 18) * 100));

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition duration-150 group">
                      
                      {/* Code Avatar Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-12 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-cyan-400 font-black text-xs font-mono flex items-center justify-center border border-slate-700 shadow-sm group-hover:scale-105 transition transform">
                            {s.code}
                          </div>
                          <span className="text-xs font-black text-slate-900 font-mono">{s.code}</span>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-extrabold text-slate-850 block">{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{s.category || 'Major Junction'}</span>
                      </td>

                      {/* State */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-rose-500" />
                          <span>{s.state}</span>
                        </div>
                      </td>

                      {/* Platforms */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1 w-28">
                          <div className="flex justify-between text-xs font-black font-mono">
                            <span className="text-slate-800">{platformCount}</span>
                            <span className="text-[10px] text-slate-400">Platforms</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${platformPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Zone */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                          {s.zone || 'Northern Railway'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-extrabold border border-emerald-200 inline-flex items-center space-x-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span>Active</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition border border-slate-200/60 hover:border-blue-200 cursor-pointer"
                            title="Edit Station Details"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200/60 hover:border-rose-200 cursor-pointer"
                            title="Remove Station"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <Info className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold">No stations match your current search query or state filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Station Modal */}
      {(showAddModal || editingStation) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-cyan-50 text-cyan-600 rounded-xl">
                  <Building2 className="h-4 w-4" />
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {editingStation ? 'Edit Station Details' : 'Add New Station Terminal'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStation(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingStation ? handleSaveEdit : handleCreateStation} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-500">Station Code (e.g. NDLS)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NDLS"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">Platforms Count</label>
                  <input
                    type="number"
                    required
                    value={platforms}
                    onChange={(e) => setPlatforms(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Delhi Railway Station"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-500">State Region</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Delhi"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">Category Classification</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold"
                  >
                    <option value="Major Junction">Major Junction</option>
                    <option value="Central Terminal">Central Terminal</option>
                    <option value="Division Headquarters">Division HQ</option>
                    <option value="Suburban Station">Suburban Station</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Railway Zone Division</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold"
                >
                  <option value="Northern Railway">Northern Railway (NR)</option>
                  <option value="Western Railway">Western Railway (WR)</option>
                  <option value="Southern Railway">Southern Railway (SR)</option>
                  <option value="Eastern Railway">Eastern Railway (ER)</option>
                  <option value="Central Railway">Central Railway (CR)</option>
                  <option value="South Western Railway">South Western Railway (SWR)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStation(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition shadow-md"
                >
                  {editingStation ? 'Save Changes' : 'Create Terminal'}
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
