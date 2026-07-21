import React, { useState } from 'react';
import { Layers, Plus, Search, HelpCircle, Edit } from 'lucide-react';

const AdminClasses = () => {
  const [classes, setClasses] = useState([
    { id: 'cl-1', code: '1A', name: 'AC First Class', multiplier: '2.50x', seats: 24, status: 'Active' },
    { id: 'cl-2', code: '2A', name: 'AC 2 Tier', multiplier: '1.80x', seats: 48, status: 'Active' },
    { id: 'cl-3', code: '3A', name: 'AC 3 Tier', multiplier: '1.30x', seats: 64, status: 'Active' },
    { id: 'cl-4', code: 'SL', name: 'Sleeper Class', multiplier: '1.00x', seats: 72, status: 'Active' },
    { id: 'cl-5', code: '2S', name: 'Second Seating', multiplier: '0.60x', seats: 108, status: 'Active' }
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Class Management</h1>
          <p className="text-xs text-slate-400">Configure coach reservation classes, capacity limits, and fare pricing ratios.</p>
        </div>
      </div>

      {/* Roster list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Layers className="h-4 w-4 text-slate-500" />
            <span>Operational Coach Classes</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Class Code</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Class Description</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Fare Multiplier</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Avg. Coach Seats</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-55/50 transition">
                  <td className="px-6 py-4 text-sm font-black text-slate-800 font-mono">{c.code}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-850">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-primary-600 font-black font-mono">{c.multiplier}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-semibold font-mono">{c.seats}</td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-primary-600 font-bold text-xs transition flex items-center space-x-1.5 ml-auto">
                      <Edit className="h-4 w-4" />
                      <span>Adjust Fare</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminClasses;
