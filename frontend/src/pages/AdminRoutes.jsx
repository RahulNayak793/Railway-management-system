import React, { useState } from 'react';
import { Compass, Plus, Search, Trash2, Edit } from 'lucide-react';

const AdminRoutes = () => {
  const [routes, setRoutes] = useState([
    { id: 'rt-1', source: 'NDLS (New Delhi)', destination: 'MMCT (Mumbai Central)', distance: '1384 km', stops: 6, status: 'Active' },
    { id: 'rt-2', source: 'HWH (Howrah)', destination: 'NDLS (New Delhi)', distance: '1447 km', stops: 8, status: 'Active' },
    { id: 'rt-3', source: 'SBC (KSR Bengaluru)', destination: 'MAS (MGR Chennai Central)', distance: '362 km', stops: 4, status: 'Active' },
    { id: 'rt-4', source: 'NZM (Hazrat Nizamuddin)', destination: 'AGC (Agra Cantt)', distance: '188 km', stops: 1, status: 'Active' }
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [distance, setDistance] = useState('');
  const [stops, setStops] = useState('');

  const handleCreateRoute = (e) => {
    e.preventDefault();
    if (!source || !destination) return;
    const newRoute = {
      id: `rt-${routes.length + 1}`,
      source,
      destination,
      distance: `${distance || '500'} km`,
      stops: parseInt(stops) || 3,
      status: 'Active'
    };
    setRoutes([...routes, newRoute]);
    setShowAddModal(false);
    setSource('');
    setDestination('');
    setDistance('');
    setStops('');
  };

  const handleDelete = (id) => {
    setRoutes(routes.filter(r => r.id !== id));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Route Management</h1>
          <p className="text-xs text-slate-400">Configure rail routes, source/destination lines, and segment lengths.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 w-fit transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Route</span>
        </button>
      </div>

      {/* Routes Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Compass className="h-4 w-4 text-slate-500" />
            <span>Active Rail Routes</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-850">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search route lines..."
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Source Station</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Destination Station</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Distance</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Stops Count</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {routes.map((route) => (
                <tr key={route.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{route.source}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{route.destination}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold font-mono">{route.distance}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold font-mono">{route.stops}</td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                      {route.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button className="p-1 text-slate-400 hover:text-primary-600 transition">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)}
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
              <h3 className="text-base font-black text-slate-800">Add New Route</h3>
            </div>
            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-455 uppercase">Source Station</label>
                <input
                  type="text"
                  placeholder="e.g. NDLS (New Delhi)"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-455 uppercase">Destination Station</label>
                <input
                  type="text"
                  placeholder="e.g. MMCT (Mumbai Central)"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Distance (km)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1384"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-850 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">No. of Stops</label>
                  <input
                    type="number"
                    placeholder="e.g. 6"
                    value={stops}
                    onChange={(e) => setStops(e.target.value)}
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
                  Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoutes;
