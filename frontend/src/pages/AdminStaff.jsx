import React, { useState } from 'react';
import { Users, Plus, Search, UserCheck, ShieldAlert } from 'lucide-react';

const AdminStaff = () => {
  const [staff, setStaff] = useState([
    { id: 'stf-1', name: 'Mark Thompson', email: 'm.thompson@transit.com', station: 'NDLS', shift: 'Day (06:00 - 14:00)', role: 'Station Staff', status: 'Active' },
    { id: 'stf-2', name: 'Vikram Malhotra', email: 'v.malhotra@rail.net', station: 'MMCT', shift: 'Night (22:00 - 06:00)', role: 'Ticketing Agent', status: 'Active' },
    { id: 'stf-3', name: 'Sneha Patel', email: 's.patel@railmail.com', station: 'SBC', shift: 'Evening (14:00 - 22:00)', role: 'Station Staff', status: 'On Leave' }
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [station, setStation] = useState('');
  const [shift, setShift] = useState('Day (06:00 - 14:00)');
  const [role, setRole] = useState('Station Staff');

  const handleCreateStaff = (e) => {
    e.preventDefault();
    if (!name || !email) return;
    const newStaff = {
      id: `stf-${staff.length + 1}`,
      name,
      email,
      station: station.toUpperCase() || 'NDLS',
      shift,
      role,
      status: 'Active'
    };
    setStaff([...staff, newStaff]);
    setShowAddModal(false);
    setName('');
    setEmail('');
    setStation('');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Staff Management</h1>
          <p className="text-xs text-slate-400">Configure terminal operations shifts, station assignments, and support roles.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 w-fit transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Roster list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <UserCheck className="h-4 w-4 text-slate-500" />
            <span>Active Operations Roster</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-855">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Staff Name</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Email Identity</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Assigned Station</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Shift Duty</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Designation</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {staff.map((st) => (
                <tr key={st.id} className="hover:bg-slate-55/50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{st.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{st.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 font-black font-mono">{st.station}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">{st.shift}</td>
                  <td className="px-6 py-4 text-xs font-semibold">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-bold">
                      {st.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className={`px-2 py-0.5 rounded border ${
                      st.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {st.status}
                    </span>
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
              <h3 className="text-base font-black text-slate-800">Add Staff Member</h3>
            </div>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-455 uppercase">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-455 uppercase">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@rail.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Assigned Station</label>
                  <input
                    type="text"
                    placeholder="e.g. NDLS"
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-455 uppercase">Designation</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  >
                    <option value="Station Staff">Station Staff</option>
                    <option value="Ticketing Agent">Ticketing Agent</option>
                    <option value="Platform Controller">Platform Controller</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-455 uppercase">Shift Duty</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                >
                  <option value="Day (06:00 - 14:00)">Day (06:00 - 14:00)</option>
                  <option value="Evening (14:00 - 22:00)">Evening (14:00 - 22:00)</option>
                  <option value="Night (22:00 - 06:00)">Night (22:00 - 06:00)</option>
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
                  Add Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaff;
