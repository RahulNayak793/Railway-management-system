import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, UserCheck, ShieldAlert, Trash2 } from 'lucide-react';
import api from '../services/api';

const DUMMY_EMAILS = new Set(['m.thompson@transit.com', 'v.malhotra@rail.net', 's.patel@railmail.com']);

const AdminStaff = () => {
  const [staff, setStaff] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('added_staff_members') || '[]');
    return stored.filter(s => s && !DUMMY_EMAILS.has(s.email));
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [role, setRole] = useState('Station Staff');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchBackendStaff = async () => {
      try {
        const res = await api.get('/admin/users');
        if (Array.isArray(res.data)) {
          const apiStaff = res.data
            .filter(u => u.role === 'staff' && !DUMMY_EMAILS.has(u.email))
            .map(u => ({
              id: u.id || `stf-${u.email}`,
              name: u.full_name || 'Staff Member',
              email: u.email,
              phone: u.phone || '+91 9876543210',
              age: u.age || 32,
              gender: u.gender || 'Male',
              role: u.designation || 'Station Staff',
              status: 'Active'
            }));

          setStaff(prev => {
            const existingEmails = new Set(prev.map(p => p.email));
            const merged = [...prev];
            apiStaff.forEach(st => {
              if (!existingEmails.has(st.email)) {
                merged.push(st);
              }
            });
            localStorage.setItem('added_staff_members', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not fetch staff from server, using local roster:', err.message);
      }
    };

    fetchBackendStaff();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!name || !email) return;

    setSaving(true);
    const newStaffObj = {
      id: `stf-${Date.now()}`,
      name,
      email,
      phone: phone || '+91 9876543210',
      age: age ? parseInt(age) : 30,
      gender: gender || 'Male',
      role,
      status: 'Active'
    };

    const updated = [newStaffObj, ...staff.filter(s => s.email !== email)];
    setStaff(updated);
    localStorage.setItem('added_staff_members', JSON.stringify(updated));

    try {
      await api.post('/auth/signup', {
        email,
        password: 'Password@123',
        full_name: name,
        phone,
        role: 'staff'
      });
    } catch (err) {
      console.warn('Staff backend signup skipped/handled locally:', err.message);
    } finally {
      setSaving(false);
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setAge('');
      setGender('Male');
    }
  };

  const handleDeleteStaff = (id) => {
    if (!window.confirm('Remove this staff member from active roster?')) return;
    const updated = staff.filter(s => s.id !== id);
    setStaff(updated);
    localStorage.setItem('added_staff_members', JSON.stringify(updated));
  };

  const filteredStaff = staff.filter(st => {
    const q = searchQuery.toLowerCase();
    return (
      (st.name && st.name.toLowerCase().includes(q)) ||
      (st.email && st.email.toLowerCase().includes(q)) ||
      (st.phone && st.phone.toLowerCase().includes(q)) ||
      (st.role && st.role.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Staff Management</h1>
          <p className="text-xs text-slate-400">Configure operational support roles and personal profiles.</p>
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
            <span>Active Operations Roster ({filteredStaff.length})</span>
          </h3>
          <div className="flex items-center space-x-2 border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent focus:outline-none placeholder:text-slate-400 font-semibold text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredStaff.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Users className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">No staff members found. Click "Add Staff Member" to add operational staff.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Staff Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Email Identity</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Phone</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Age / Gender</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Designation</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400">Status</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStaff.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{st.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">{st.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{st.phone || '+91 9876543210'}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                      {st.age ? `${st.age} yrs` : '30 yrs'} • {st.gender || 'Male'}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 font-bold">
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
                    <td className="px-6 py-4 text-xs font-bold text-right">
                      <button
                        onClick={() => handleDeleteStaff(st.id)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition"
                        title="Remove staff member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shivaraj"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. shiva@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Age</label>
                  <input
                    type="number"
                    placeholder="e.g. 32"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Designation</label>
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
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Staff'}
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
