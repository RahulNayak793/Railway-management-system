import React, { useState, useMemo } from 'react';
import {
  Layers, Plus, Search, Edit, SlidersHorizontal, ShieldCheck, CheckCircle2,
  Zap, Coffee, Wind, IndianRupee, Users, Train, Sparkles, Trash2, X, Info,
  Filter, Settings2, RefreshCw, Check, AlertCircle, ArrowUpRight
} from 'lucide-react';

const INITIAL_CLASSES = [
  {
    id: 'cl-7',
    code: 'SL',
    name: 'Sleeper Class',
    category: 'Non-AC Reserved',
    multiplier: 1.00,
    seats: 72,
    berthType: '3-Tier Open Non-AC Bunks',
    basePriceEst: 450,
    status: 'Active',
    color: 'from-slate-700 via-slate-800 to-slate-900',
    badgeBg: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
    perks: ['Reserved Sleeper Berth', 'Catering Vendor Access', 'Window Shutter Louvers']
  },
  {
    id: 'cl-4',
    code: '3E',
    name: 'AC 3-Tier Economy',
    category: 'Economy AC',
    multiplier: 1.15,
    seats: 72,
    berthType: '3-Tier Compact AC Bunks',
    basePriceEst: 980,
    status: 'Active',
    color: 'from-cyan-600 via-teal-600 to-emerald-600',
    badgeBg: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
    perks: ['Air Conditioned', 'Bedroll Included', 'Individual AC Vents', 'Compact Design']
  },
  {
    id: 'cl-3',
    code: '3A',
    name: 'AC 3-Tier',
    category: 'Standard AC',
    multiplier: 1.30,
    seats: 64,
    berthType: '3-Tier Open Bay Bunks',
    basePriceEst: 1150,
    status: 'Active',
    color: 'from-blue-600 via-cyan-600 to-blue-700',
    badgeBg: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    perks: ['Air Conditioned', 'Bedroll Included', 'Pantry Service', 'Charging Sockets']
  },
  {
    id: 'cl-2',
    code: '2A',
    name: 'AC 2-Tier',
    category: 'High-Tier AC',
    multiplier: 1.80,
    seats: 48,
    berthType: '2-Tier Bunks with Privacy Curtains',
    basePriceEst: 1650,
    status: 'Active',
    color: 'from-purple-600 via-indigo-600 to-purple-700',
    badgeBg: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    perks: ['Air Conditioned', 'Bedroll Included', 'Pantry On-Demand', 'Privacy Curtains', 'Charging Sockets']
  },
  {
    id: 'cl-6',
    code: 'CC',
    name: 'AC Chair Car',
    category: 'Standard Express',
    multiplier: 1.10,
    seats: 78,
    berthType: '3x2 Reclining Seats',
    basePriceEst: 850,
    status: 'Active',
    color: 'from-indigo-600 via-blue-600 to-indigo-700',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
    perks: ['Air Conditioned', 'Pantry Snacks', 'Reclining Backrest', 'Overhead Luggage Rack']
  },
  {
    id: 'cl-5',
    code: 'EC',
    name: 'Executive Chair Car',
    category: 'Premium Express',
    multiplier: 2.20,
    seats: 46,
    berthType: '2x2 Reclining Plush Seats',
    basePriceEst: 1950,
    status: 'Active',
    color: 'from-emerald-600 via-teal-600 to-green-700',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    perks: ['Air Conditioned', 'Welcome Drinks & Catering', '180° Rotating Seats', 'Footrest & Tray Table']
  },
  {
    id: 'cl-8',
    code: '2S',
    name: 'Second Seating',
    category: 'Unreserved / Reserved Bench',
    multiplier: 0.60,
    seats: 108,
    berthType: 'High-Density Bench Seating',
    basePriceEst: 180,
    status: 'Active',
    color: 'from-orange-600 via-amber-600 to-orange-700',
    badgeBg: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    perks: ['Budget Travel', 'High Capacity', 'Unreserved / General Quota']
  },
  {
    id: 'cl-1',
    code: '1A',
    name: 'AC First Class',
    category: 'Premium AC',
    multiplier: 2.50,
    seats: 24,
    berthType: '2-Berth Coupe & 4-Berth Cabin',
    basePriceEst: 2450,
    status: 'Active',
    color: 'from-amber-500 via-amber-600 to-yellow-600',
    badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    perks: ['Air Conditioned', 'Bedroll Included', 'Free Hot Meals', 'Lockable Coupe', 'Personal Reading Lamp']
  }
];

const AdminClasses = () => {
  const [classes, setClasses] = useState(INITIAL_CLASSES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedClass, setSelectedClass] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form states for Edit / Add
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    multiplier: 1.0,
    seats: 64,
    berthType: '',
    basePriceEst: 500,
    status: 'Active',
    perksString: ''
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Filtered List
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchesSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [classes, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = classes.length;
    const active = classes.filter(c => c.status === 'Active').length;
    const maxMult = Math.max(...classes.map(c => c.multiplier));
    const avgSeats = Math.round(classes.reduce((sum, c) => sum + c.seats, 0) / (total || 1));
    return { total, active, maxMult, avgSeats };
  }, [classes]);

  // Handle Edit Click
  const handleOpenEdit = (c) => {
    setSelectedClass(c);
    setFormData({
      code: c.code,
      name: c.name,
      category: c.category || 'Standard',
      multiplier: c.multiplier,
      seats: c.seats,
      berthType: c.berthType || '',
      basePriceEst: c.basePriceEst || 500,
      status: c.status,
      perksString: Array.isArray(c.perks) ? c.perks.join(', ') : ''
    });
    setIsEditModalOpen(true);
  };

  // Handle Save Edit
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!selectedClass) return;

    const updated = classes.map(item => {
      if (item.id === selectedClass.id) {
        const perksArray = formData.perksString
          .split(',')
          .map(p => p.trim())
          .filter(Boolean);

        return {
          ...item,
          code: formData.code.toUpperCase(),
          name: formData.name,
          category: formData.category,
          multiplier: parseFloat(formData.multiplier),
          seats: parseInt(formData.seats, 10),
          berthType: formData.berthType,
          basePriceEst: parseInt(formData.basePriceEst, 10),
          status: formData.status,
          perks: perksArray.length > 0 ? perksArray : item.perks
        };
      }
      return item;
    });

    setClasses(updated);
    setIsEditModalOpen(false);
    showToast(`Successfully updated class rules for ${formData.code}!`);
  };

  // Handle Create New Class
  const handleCreateClass = (e) => {
    e.preventDefault();
    const perksArray = formData.perksString
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    const newClass = {
      id: `cl-${Date.now()}`,
      code: formData.code.toUpperCase(),
      name: formData.name,
      category: formData.category || 'Custom Tier',
      multiplier: parseFloat(formData.multiplier) || 1.0,
      seats: parseInt(formData.seats, 10) || 64,
      berthType: formData.berthType || 'Standard Layout',
      basePriceEst: parseInt(formData.basePriceEst, 10) || 500,
      status: formData.status || 'Active',
      color: 'from-blue-600 to-indigo-600',
      badgeBg: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      perks: perksArray.length > 0 ? perksArray : ['Standard Seating', 'Reservation Quota']
    };

    setClasses([...classes, newClass]);
    setIsAddModalOpen(false);
    showToast(`New class tier ${newClass.code} created successfully!`);
  };

  // Handle Toggle Status
  const handleToggleStatus = (id) => {
    setClasses(classes.map(c => {
      if (c.id === id) {
        const newStatus = c.status === 'Active' ? 'Maintenance' : 'Active';
        showToast(`${c.code} status changed to ${newStatus}`);
        return { ...c, status: newStatus };
      }
      return c;
    }));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 font-sans space-y-8 animate-fade-in">

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3 animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-xs font-bold font-mono">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl text-white">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Layers className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Coach Class Management
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  Configure reservation coach categories, pricing multipliers, and berth capacity thresholds.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setFormData({
                code: '',
                name: '',
                category: 'Express Tier',
                multiplier: 1.25,
                seats: 64,
                berthType: '3-Tier Layout',
                basePriceEst: 650,
                status: 'Active',
                perksString: 'Air Conditioned, Charging Sockets'
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-lg hover:shadow-blue-500/25 transition transform active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Class Tier</span>
          </button>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Configured Classes</span>
              <Train className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">{stats.total}</span>
              <span className="text-[10px] text-emerald-400 font-bold">({stats.active} Active)</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Peak Fare Multiplier</span>
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-amber-400">{stats.maxMult.toFixed(2)}x</span>
              <span className="text-[10px] text-slate-400 font-bold">(1A AC First)</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Coach Capacity</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-white">{stats.avgSeats}</span>
              <span className="text-[10px] text-slate-400 font-bold">Seats / Coach</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Catering & AC Coverage</span>
              <Coffee className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-400">75%</span>
              <span className="text-[10px] text-slate-400 font-bold">of total fleet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by class code (1A, 2A, SL...), name, or category..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
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

        {/* Filter Pills */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 flex items-center space-x-1 mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </span>
          {['All', 'Active', 'Maintenance'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Roster List */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:px-6 flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-850 flex items-center space-x-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            <span>Operational Class Specifications</span>
          </h3>
          <span className="text-xs font-bold text-slate-400 font-mono">
            Showing {filteredClasses.length} of {classes.length} class tiers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200/70 text-[10.5px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Class Code</th>
                <th className="px-6 py-4">Category & Description</th>
                <th className="px-6 py-4">Fare Multiplier</th>
                <th className="px-6 py-4">Capacity & Layout</th>
                <th className="px-6 py-4">Included Perks</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((c) => {
                  const maxMultScale = Math.min(100, Math.round((c.multiplier / stats.maxMult) * 100));

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition duration-150 group">
                      
                      {/* Class Code Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${c.color} text-white font-black text-sm font-mono flex items-center justify-center shadow-md group-hover:scale-105 transition transform`}>
                            {c.code}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block font-mono">{c.code}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{c.category || 'Standard Tier'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Name & Berth */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <span className="text-sm font-extrabold text-slate-850 block">{c.name}</span>
                          <span className="text-[11px] text-slate-500 font-medium block">{c.berthType}</span>
                        </div>
                      </td>

                      {/* Fare Multiplier */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1.5 w-32">
                          <div className="flex items-center justify-between text-xs font-black font-mono">
                            <span className="text-blue-700">{c.multiplier.toFixed(2)}x</span>
                            <span className="text-[10px] text-slate-400">~₹{c.basePriceEst || Math.round(c.multiplier * 650)}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${maxMultScale}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Avg Seats */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-black text-slate-800 font-mono">{c.seats}</span>
                          <span className="text-[11px] text-slate-400 font-semibold">seats/coach</span>
                        </div>
                      </td>

                      {/* Perks */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {c.perks && c.perks.slice(0, 3).map((perk, i) => (
                            <span
                              key={i}
                              className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/60"
                            >
                              {perk}
                            </span>
                          ))}
                          {c.perks && c.perks.length > 3 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600">
                              +{c.perks.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(c.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition cursor-pointer border flex items-center space-x-1.5 ${
                            c.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${c.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>{c.status}</span>
                        </button>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition border border-slate-200/60 hover:border-blue-200 flex items-center space-x-1 text-xs font-bold cursor-pointer"
                            title="Edit Class Specifications"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit Rules</span>
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
                    <p className="text-xs font-bold">No coach classes match your current search or filter query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Class Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Edit className="h-4 w-4" />
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Edit Specifications ({formData.code})
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-500">Class Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">Category Tag</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Class Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-500">Fare Multiplier (e.g. 1.80)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    required
                    value={formData.multiplier}
                    onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">Avg. Seats / Coach</label>
                  <input
                    type="number"
                    required
                    value={formData.seats}
                    onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Berth & Seating Layout Description</label>
                <input
                  type="text"
                  value={formData.berthType}
                  onChange={(e) => setFormData({ ...formData, berthType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Included Amenities (comma separated)</label>
                <input
                  type="text"
                  value={formData.perksString}
                  onChange={(e) => setFormData({ ...formData, perksString: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold"
                  placeholder="Air Conditioned, Bedroll Included, Pantry Service"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Operational Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold"
                >
                  <option value="Active">Active (Available for Reservation)</option>
                  <option value="Maintenance">Maintenance (Suspended)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md"
                >
                  Save Class Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Class Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Plus className="h-4 w-4" />
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Add New Coach Class Tier
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-500">Class Code (e.g. 3E)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3E"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Express AC"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Full Title Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Executive Anubhuti Class"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-500">Fare Multiplier (e.g. 1.25)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    required
                    value={formData.multiplier}
                    onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">Seats per Coach</label>
                  <input
                    type="number"
                    required
                    value={formData.seats}
                    onChange={(e) => setFormData({ ...formData, seats: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Berth Layout</label>
                <input
                  type="text"
                  placeholder="e.g. 3-Tier AC Layout with curtains"
                  value={formData.berthType}
                  onChange={(e) => setFormData({ ...formData, berthType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-500">Perks & Amenities (comma separated)</label>
                <input
                  type="text"
                  value={formData.perksString}
                  onChange={(e) => setFormData({ ...formData, perksString: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold"
                  placeholder="Air Conditioned, Charging Sockets"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-md"
                >
                  Create Class Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminClasses;
