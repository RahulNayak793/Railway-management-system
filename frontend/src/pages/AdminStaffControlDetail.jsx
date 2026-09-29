import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Shield, Key, Briefcase, FileText, CheckCircle, 
  XCircle, ShieldAlert, RefreshCw, Mail, Phone, Calendar, Clock, Award
} from 'lucide-react';
import api from '../services/api';

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

const AdminStaffControlDetail = () => {
  const { staffId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState(null);
  const [duties, setDuties] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('profile'); // 'profile' | 'permissions' | 'duties' | 'reports'
  const [saving, setSaving] = useState(false);
  const [editedPerms, setEditedPerms] = useState([]);

  const fetchStaffDetails = async () => {
    setLoading(true);
    try {
      const [rosterRes, tasksRes] = await Promise.all([
        api.get('/staff/admin-roster'),
        api.get('/staff/tasks')
      ]);

      if (rosterRes.data && Array.isArray(rosterRes.data.staff)) {
        const found = rosterRes.data.staff.find(s => String(s.id) === String(staffId));
        if (found) {
          setStaff(found);
          setEditedPerms(found.permissions || []);
        }
      }

      if (Array.isArray(tasksRes.data)) {
        const staffTasks = tasksRes.data.filter(t => String(t.staff_id) === String(staffId));
        setDuties(staffTasks);
      }
    } catch (err) {
      console.error('Error fetching staff details:', err.message);
    } fontFinally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffDetails();
  }, [staffId]);

  const handleToggleStatus = async (newStatus) => {
    if (!staff) return;
    try {
      await api.put(`/staff/status/${staff.id}`, { status: newStatus });
      fetchStaffDetails();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleSavePermissions = async () => {
    if (!staff) return;
    setSaving(true);
    try {
      await api.put(`/staff/permissions/${staff.id}`, { permissions: editedPerms });
      alert('Permissions saved successfully!');
      fetchStaffDetails();
    } catch (err) {
      alert('Failed to save permissions: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/staff')}
          className="flex items-center space-x-2 text-indigo-600 font-bold text-xs hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>← Back to Staff Roster</span>
        </button>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Staff Account Not Found</h3>
          <p className="text-xs text-slate-500">The requested staff profile does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const initials = staff.full_name ? staff.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST';
  const reportsList = duties.filter(d => d.completion_report || d.report_status);

  return (
    <div className="space-y-6 pb-12">
      {/* BACK BUTTON */}
      <button
        onClick={() => navigate('/admin/staff')}
        className="inline-flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition border border-indigo-200"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>← Back to Staff Roster</span>
      </button>

      {/* PROFILE CONTROL HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white border-2 border-indigo-400/30 flex items-center justify-center font-black text-xl shadow-lg">
              {initials}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {staff.employee_id || `EMP-${staff.id}`}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  staff.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  staff.status === 'SUSPENDED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                }`}>
                  ● {staff.status || 'ACTIVE'}
                </span>
              </div>
              <h1 className="text-2xl font-black text-white mt-1">{staff.full_name}</h1>
              <p className="text-xs text-slate-300 font-medium">
                {staff.department || 'Passenger Services'} &bull; {staff.designation || 'Staff Officer'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {staff.status === 'ACTIVE' ? (
              <button
                onClick={() => handleToggleStatus('SUSPENDED')}
                className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/30 font-bold text-xs transition"
              >
                Suspend Account
              </button>
            ) : (
              <button
                onClick={() => handleToggleStatus('ACTIVE')}
                className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 font-bold text-xs transition"
              >
                Activate Account
              </button>
            )}
          </div>
        </div>

        {/* INNER NAVIGATION TABS */}
        <div className="flex space-x-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto text-xs">
          {[
            { id: 'profile', label: 'Staff Profile', icon: User },
            { id: 'permissions', label: 'Access & Permissions', icon: Shield },
            { id: 'duties', label: `Assigned Duties (${duties.length})`, icon: Briefcase },
            { id: 'reports', label: `Submitted Reports (${reportsList.length})`, icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold transition whitespace-nowrap ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        
        {/* PROFILE TAB */}
        {activeSubTab === 'profile' && (
          <div className="space-y-6">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">Official Staff Profile Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Full Name</span>
                <span className="font-black text-slate-900 text-sm">{staff.full_name}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Employee ID</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{staff.employee_id || `EMP-${staff.id}`}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Official Email</span>
                <span className="font-bold text-slate-900 text-sm">{staff.email}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Department</span>
                <span className="font-bold text-slate-900 text-sm">{staff.department || 'Passenger Services'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Designation</span>
                <span className="font-bold text-slate-900 text-sm">{staff.designation || 'Staff Officer'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">Joining Date</span>
                <span className="font-bold text-slate-900 text-sm">{staff.joining_date || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* PERMISSIONS TAB */}
        {activeSubTab === 'permissions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Permissions & Authorization Controls</h3>
                <p className="text-xs text-slate-500 font-medium">Select authorized functions for {staff.full_name}</p>
              </div>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {PERMISSIONS_LIST.map((perm) => {
                const isChecked = editedPerms.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex items-center space-x-3 p-3.5 rounded-2xl border transition cursor-pointer ${
                      isChecked ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const updated = e.target.checked
                          ? [...editedPerms, perm.key]
                          : editedPerms.filter(p => p !== perm.key);
                        setEditedPerms(updated);
                      }}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold">{perm.label}</div>
                      <div className="text-[10px] font-mono text-slate-400">{perm.key}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* DUTIES TAB */}
        {activeSubTab === 'duties' && (
          <div className="space-y-4">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">Website Duties Assigned to {staff.full_name}</h3>
            {duties.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                No duties currently assigned to this staff member.
              </div>
            ) : (
              <div className="space-y-3">
                {duties.map((duty) => (
                  <div key={duty.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-indigo-600">{duty.task_code || `DUTY-${duty.id}`}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 font-bold text-[10px]">{duty.category}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">{duty.priority}</span>
                      </div>
                      <h4 className="font-black text-slate-900 text-sm mt-1">{duty.title}</h4>
                      <p className="text-slate-500 mt-0.5">{duty.description}</p>
                    </div>
                    <div className="self-end sm:self-center">
                      <span className="px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {duty.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REPORTS TAB */}
        {activeSubTab === 'reports' && (
          <div className="space-y-4">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">Completion Reports Submitted by {staff.full_name}</h3>
            {reportsList.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                No completion reports submitted by this staff member yet.
              </div>
            ) : (
              <div className="space-y-3">
                {reportsList.map((duty) => (
                  <div key={duty.id} className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-900 text-sm">{duty.title}</span>
                      <span className="px-2.5 py-1 rounded-full font-black text-[10px] uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                        {duty.report_status || 'REPORT_SUBMITTED'}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium bg-white p-3 rounded-xl border border-purple-200">
                      {duty.completion_report?.work_performed || duty.completion_report?.remarks || 'No detailed report snippet'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminStaffControlDetail;
