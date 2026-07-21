import React, { useState, useEffect } from 'react';
import { Users, Search, UserMinus, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([
    { id: 'usr-1', email: 'alex.rivers@railmail.com', role: 'passenger', full_name: 'Alex Rivers', phone: '+919876543210', status: 'Active' },
    { id: 'usr-2', email: 's.jenkins@globemail.org', role: 'passenger', full_name: 'Sarah Jenkins', phone: '+919999988888', status: 'Blocked' },
    { id: 'usr-3', email: 'm.thompson@transit.com', role: 'staff', full_name: 'Mark Thompson', phone: '+919123456789', status: 'Active' },
    { id: 'usr-4', email: 'lzhang@rail.net', role: 'admin', full_name: 'Lina Zhang', phone: '+919223344556', status: 'Active' }
  ]);
  const [loading, setLoading] = useState(false);

  const handleRoleChange = async (userId, currentRole) => {
    const nextRole = currentRole === 'passenger' ? 'staff' : currentRole === 'staff' ? 'admin' : 'passenger';
    
    // In-memory update
    const updated = users.map(u => {
      if (u.id === userId) {
        return { ...u, role: nextRole };
      }
      return u;
    });
    setUsers(updated);
    alert(`User role successfully changed to ${nextRole}!`);
  };

  const handleToggleStatus = (userId, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Blocked' : 'Active';
    const updated = users.map(u => {
      if (u.id === userId) {
        return { ...u, status: nextStatus };
      }
      return u;
    });
    setUsers(updated);
    alert(`Account status updated to ${nextStatus}!`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-extrabold text-slate-800">Manage Users Accounts</h1>
        <p className="text-xs text-slate-400">Perform user access auditing, workspace domain roles modifications, or block credentials access.</p>
      </div>

      {/* Roster database table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800">Operational Accounts List</h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by name / email..."
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">User Identity</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Contact Email</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Workspace Role</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Audit Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{u.full_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{u.email}</td>
                  <td className="px-6 py-4 text-xs font-semibold">
                    <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-primary-700 capitalize border border-primary-100">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <span className={`rounded-full px-2 py-0.5 ${
                      u.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleRoleChange(u.id, u.role)}
                        className="rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition"
                      >
                        Modify Role
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u.id, u.status)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${
                          u.status === 'Active' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {u.status === 'Active' ? 'Block' : 'Unblock'}
                      </button>
                    </div>
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

export default AdminUsers;
