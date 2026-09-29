import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserCheck, ShieldAlert, Plus, Search, Shield, Key, 
  RefreshCw, Filter, CheckCircle, XCircle, ChevronRight, Eye, Briefcase, Mail, Phone, Calendar,
  Edit, Trash2, Lock, Unlock, Sliders, AlertCircle
} from 'lucide-react';
import api from '../services/api';

const DEPARTMENTS = [
  'Passenger Services', 'Operations', 'Commercial', 'Catering', 'Customer Support', 'Administration'
];

const STAFF_TYPES = [
  'Passenger Support Officer', 'Booking Verification Officer', 'Catering Supervisor', 
  'Service Representative', 'Internal Audit Officer', 'Website Administrator'
];

const PERMISSIONS_LIST = [
  { key: 'VIEW_DASHBOARD', label: 'View Staff Dashboard' },
  { key: 'VIEW_ASSIGNED_TRAINS', label: 'View Assigned Train Information' },
  { key: 'VIEW_BOOKINGS', label: 'View Passenger Bookings' },
  { key: 'VIEW_PASSENGERS', label: 'View Passenger Information' },
  { key: 'VERIFY_TICKETS', label: 'Verify PNR & Ticket Data' },
  { key: 'VIEW_PNR', label: 'View PNR Details' },
  { key: 'VIEW_MANIFEST', label: 'View Passenger Manifest' },
  { key: 'VIEW_RAC_WAITLIST', label: 'View RAC & Waiting List' },
  { key: 'VIEW_CATERING_ORDERS', label: 'View Food & Catering Orders' },
  { key: 'UPDATE_CATERING_STATUS', label: 'Update Catering Order Status' },
  { key: 'HANDLE_SERVICE_REQUESTS', label: 'Handle Passenger Service Requests' },
  { key: 'CREATE_INCIDENT_REPORT', label: 'Create Service & System Issue Reports' },
  { key: 'SUBMIT_DAILY_REPORT', label: 'Submit Daily Staff Report' },
  { key: 'VIEW_TRAIN_STATUS', label: 'View Train Status Information' },
  { key: 'UPDATE_AUTHORIZED_TRAIN_STATUS', label: 'Update Website Train Status' },
  { key: 'MANAGE_TRAIN_SCHEDULES', label: 'Manage Authorized Train Schedules' },
  { key: 'VIEW_STATION_DATA', label: 'View Station Information' },
  { key: 'VIEW_NOTIFICATIONS', label: 'View Notifications' }
];

const AdminStaffRoster = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [summary, setSummary] = useState({
    total_staff: 0,
    active_staff: 0,
    inactive_suspended: 0,
    staff_with_duties: 0
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showPermsModal, setShowPermsModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Add Staff Form state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    employee_id: '',
    department: 'Passenger Services',
    designation: 'Passenger Support Officer',
    staff_type: 'Passenger Support Officer',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    permissions: [
      'VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS', 'VIEW_BOOKINGS', 'VERIFY_TICKETS',
      'VIEW_PNR', 'VIEW_MANIFEST', 'VIEW_CATERING_ORDERS', 'HANDLE_SERVICE_REQUESTS', 'SUBMIT_DAILY_REPORT'
    ]
  });

  // Edit Staff Form state
  const [editFormData, setEditFormData] = useState({
    id: '',
    full_name: '',
    email: '',
    phone: '',
    employee_id: '',
    department: '',
    designation: '',
    staff_type: '',
    status: 'ACTIVE',
    permissions: []
  });

  const fetchRosterData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/admin-roster');
      if (res.data) {
        setStaffList(res.data.staff || []);
        const rawStaff = res.data.staff || [];
        const activeCount = rawStaff.filter(s => s.status === 'ACTIVE').length;
        const inactiveCount = rawStaff.filter(s => s.status !== 'ACTIVE').length;
        const withDuties = rawStaff.filter(s => (s.active_duties_count || 0) > 0).length;

        setSummary({
          total_staff: rawStaff.length,
          active_staff: activeCount,
          inactive_suspended: inactiveCount,
          staff_with_duties: withDuties
        });
      }
    } catch (err) {
      console.error('Failed to fetch staff roster:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterData();
  }, []);

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      alert('Please fill in required fields (Name and Email).');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/staff/admin-create', formData);
      if (res.data && (res.data.success || res.data.employee_id)) {
        const staffObj = res.data.staff || res.data;
        alert(`Staff account created successfully!\nEmployee ID: ${staffObj.employee_id}\nTemp Password: ${staffObj.tempPassword || 'Staff@123'}`);
        setShowAddModal(false);
        fetchRosterData();
      } else {
        alert(res.data?.message || 'Failed to create staff account.');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || err.message || 'Error creating staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleEditStaffClick = (staff) => {
    setEditFormData({
      id: staff.id,
      full_name: staff.full_name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      employee_id: staff.employee_id || '',
      department: staff.department || 'Passenger Services',
      designation: staff.designation || 'Passenger Support Officer',
      staff_type: staff.staff_type || 'Passenger Support Officer',
      status: staff.status || 'ACTIVE',
      permissions: Array.isArray(staff.permissions) ? staff.permissions : []
    });
    setShowEditModal(staff);
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.full_name || !editFormData.email) {
      alert('Full Name and Email are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/staff/${editFormData.id}`, editFormData);
      if (res.data) {
        alert(`Staff account for ${editFormData.full_name} updated successfully!`);
        setShowEditModal(null);
        fetchRosterData();
      }
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || err.message || 'Error updating staff account');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (staff, newStatus) => {
    if (!window.confirm(`Are you sure you want to change account status of ${staff.full_name} to ${newStatus}?`)) return;
    try {
      await api.put(`/staff/status/${staff.id}`, { status: newStatus });
      alert(`Status of ${staff.full_name} updated to ${newStatus}`);
      fetchRosterData();
    } catch (err) {
      alert('Failed to update status: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE staff account ${staff.full_name} (${staff.employee_id})? This action cannot be undone.`)) return;
    try {
      await api.delete(`/staff/${staff.id}`);
      alert(`Staff account ${staff.full_name} deleted successfully.`);
      fetchRosterData();
    } catch (err) {
      alert('Failed to delete staff account: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSavePermissions = async () => {
    if (!showPermsModal) return;
    setSaving(true);
    try {
      await api.patch(`/staff/admin-permissions/${showPermsModal.id}`, {
        permissions: showPermsModal.permissions
      });
      alert('Staff permissions updated successfully!');
      setShowPermsModal(null);
      fetchRosterData();
    } catch (err) {
      alert('Failed to save permissions: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const togglePermissionKey = (key) => {
    if (!showPermsModal) return;
    const current = showPermsModal.permissions || [];
    const updated = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    setShowPermsModal({ ...showPermsModal, permissions: updated });
  };

  // Filter staff list
  const filteredStaff = staffList.filter(s => {
    const matchesSearch = searchQuery === '' || 
      (s.full_name && s.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.employee_id && s.employee_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = deptFilter === 'ALL' || s.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-100 min-h-screen">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-black uppercase tracking-widest">
              <Shield className="h-4 w-4" />
              <span>STAFF DIRECTORY & ACCESS CONTROL</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Staff Roster & Control</h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              Manage authorized staff accounts, edit profiles, toggle suspension status, and configure granular system access.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchRosterData}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
              title="Refresh Roster"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2 border border-indigo-400/30"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add New Staff Account</span>
            </button>
          </div>
        </div>

        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-1">
              <span>Total Staff Accounts</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{summary.total_staff}</div>
            <span className="text-[10px] text-slate-400 font-medium">Registered system accounts</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold mb-1">
              <span>Active Staff</span>
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-300 font-mono">{summary.active_staff}</div>
            <span className="text-[10px] text-slate-400 font-medium">Full system access</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-rose-300 text-xs font-bold mb-1">
              <span>Inactive / Suspended</span>
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-300 font-mono">{summary.inactive_suspended}</div>
            <span className="text-[10px] text-slate-400 font-medium">Restricted or disabled access</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-indigo-300 text-xs font-bold mb-1">
              <span>Staff With Active Duties</span>
              <Briefcase className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-300 font-mono">{summary.staff_with_duties}</div>
            <span className="text-[10px] text-slate-400 font-medium">Currently assigned website tasks</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT DIRECTORY TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* SEARCH & FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name, ID, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">Department:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-600">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>
        </div>

        {/* DIRECTORY TABLE */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Staff Accounts Found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-800 uppercase font-black tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Staff Member</th>
                  <th className="p-4">Department / Designation</th>
                  <th className="p-4">Official Email</th>
                  <th className="p-4">Account Status</th>
                  <th className="p-4">Permissions</th>
                  <th className="p-4 text-center">Active Duties</th>
                  <th className="p-4 text-right">Actions & Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStaff.map((staff) => {
                  const initials = staff.full_name ? staff.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST';
                  const permsCount = Array.isArray(staff.permissions) ? staff.permissions.length : 0;
                  
                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-mono font-bold text-slate-900 text-xs">
                        {staff.employee_id || `EMP-${staff.id}`}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 text-sm leading-tight">{staff.full_name}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">{staff.staff_type || 'Staff Officer'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-xs">{staff.department || 'Passenger Services'}</div>
                        <div className="text-[11px] text-slate-500">{staff.designation || 'Officer'}</div>
                      </td>
                      <td className="p-4 text-slate-700 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{staff.email}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {/* Instant Quick Status Change Dropdown Selector */}
                        <select
                          value={staff.status || 'ACTIVE'}
                          onChange={(e) => handleToggleStatus(staff, e.target.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer border outline-none ${
                            staff.status === 'ACTIVE' 
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                              : staff.status === 'SUSPENDED' 
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          <option value="ACTIVE">● ACTIVE</option>
                          <option value="SUSPENDED">● SUSPENDED</option>
                          <option value="INACTIVE">● INACTIVE</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setShowPermsModal({ ...staff, permissions: staff.permissions || [] })}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition flex items-center space-x-1"
                        >
                          <Shield className="h-3 w-3" />
                          <span>{permsCount} Granted</span>
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-black font-mono text-xs">
                          {staff.active_duties_count || 0} Duties
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* EDIT STAFF BUTTON */}
                          <button
                            onClick={() => handleEditStaffClick(staff)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-xs transition border border-indigo-200 flex items-center space-x-1"
                            title="Edit Staff Account Profile"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* SUSPEND / ACTIVATE BUTTON */}
                          {staff.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleToggleStatus(staff, 'SUSPENDED')}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-bold text-xs transition border border-rose-200 flex items-center space-x-1"
                              title="Suspend Account Access"
                            >
                              <Lock className="h-3.5 w-3.5" />
                              <span>Suspend</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(staff, 'ACTIVE')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-bold text-xs transition border border-emerald-200 flex items-center space-x-1"
                              title="Activate Account Access"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              <span>Activate</span>
                            </button>
                          )}

                          {/* CONTROL DETAILS */}
                          <button
                            onClick={() => navigate(`/admin/staff/control/${staff.id}`)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-200"
                            title="View Full Access Logs & Control"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* DELETE STAFF */}
                          <button
                            onClick={() => handleDeleteStaff(staff)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 transition border border-slate-200"
                            title="Delete Staff Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT STAFF PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Update Staff Profile</h3>
                  <p className="text-xs text-slate-500 font-medium">Modify account details and department designations.</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={editFormData.employee_id}
                    onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={editFormData.designation}
                    onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {STAFF_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Access Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Full Authorized Access)</option>
                    <option value="SUSPENDED">SUSPENDED (Access Disabled / Blocked)</option>
                    <option value="INACTIVE">INACTIVE (Off-boarded / Rested)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Save Staff Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Add New Staff Account</h3>
                  <p className="text-xs text-slate-500 font-medium">Create an authorized staff profile with system access.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Kumar"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="rajesh.kumar@railway.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-98214 (Auto-generated if empty)"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {STAFF_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Create Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMISSIONS CONFIGURATION MODAL */}
      {showPermsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Configure Granular Permissions</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Setting permissions for <span className="font-bold text-slate-800">{showPermsModal.full_name}</span> ({showPermsModal.employee_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPermsModal(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
              {PERMISSIONS_LIST.map((perm) => {
                const isChecked = (showPermsModal.permissions || []).includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    onClick={() => togglePermissionKey(perm.key)}
                    className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                      isChecked 
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold' 
                        : 'bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by label click
                      className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs">{perm.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-bold">
                {(showPermsModal.permissions || []).length} / {PERMISSIONS_LIST.length} Permissions Selected
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPermsModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePermissions}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Permissions...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Save Permissions</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaffRoster;
