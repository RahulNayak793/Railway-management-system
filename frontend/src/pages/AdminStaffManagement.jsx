import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, UserCheck, ShieldAlert, Trash2, Edit3, Shield, Key, 
  FileText, CheckCircle, XCircle, RefreshCw, Filter, Calendar, Clock, 
  Train, ChevronRight, Eye, AlertTriangle, Send, Award, Activity, AlertCircle, MessageSquare, Briefcase
} from 'lucide-react';
import api from '../services/api';

const DEPARTMENTS = [
  'Passenger Services', 'Operations', 'Commercial', 'Catering', 'Customer Support', 'Administration'
];

const STAFF_TYPES = [
  'Passenger Support Officer', 'Booking Verification Officer', 'Catering Supervisor', 
  'Service Representative', 'Internal Audit Officer', 'Website Administrator'
];

const DUTY_CATEGORIES = [
  'Passenger Support & Ticket Verification',
  'Booking & PNR Verification',
  'Train Schedule & Route Management',
  'Live Train Status & Tracking Update',
  'Catering & Meals Order Management',
  'Emergency SOS & Incident Documentation',
  'Daily Staff Operations Report'
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

const AdminStaffManagement = () => {
  const queryTab = new URLSearchParams(window.location.search).get('tab');
  // Map legacy URL parameter 'tasks' to 'duties'
  const initialTab = queryTab === 'tasks' ? 'duties' : (queryTab || 'roster');
  const [activeTab, setActiveTab] = useState(initialTab); // 'roster' | 'duties' | 'reports'

  // Summary State
  const [summary, setSummary] = useState({
    total_staff: 0,
    active_staff: 0,
    inactive_suspended: 0,
    tasks_assigned: 0,
    tasks_in_progress: 0,
    tasks_completed: 0,
    reports_pending_review: 0,
    reports_needs_followup: 0
  });

  const [staffList, setStaffList] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [taskList, setTaskList] = useState([]);
  const [selectedStaffControl, setSelectedStaffControl] = useState(null);
  const [controlSubTab, setControlSubTab] = useState('profile'); // 'profile' | 'permissions' | 'duties' | 'reports'
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignDutyModal, setShowAssignDutyModal] = useState(false);
  const [showPermsModal, setShowPermsModal] = useState(null);
  const [showDutyDetailModal, setShowDutyDetailModal] = useState(null);
  const [showReportReviewModal, setShowReportReviewModal] = useState(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(null);
  const [followUpRemarks, setFollowUpRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Assign Duty Form state
  const [dutyFormData, setDutyFormData] = useState({
    staff_id: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    category: 'Passenger Support Review',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    instructions: ''
  });

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

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/admin-roster');
      if (res.data) {
        setSummary(res.data.summary || {});
        setStaffList(res.data.staff || []);
      }
    } catch (err) {
      console.warn('Backend staff query failed, using local roster:', err.message);
    } fontFinally: {
      setLoading(false);
    }
  };

  const fetchReportsData = async () => {
    try {
      const res = await api.get('/staff/daily-reports');
      if (Array.isArray(res.data)) {
        setDailyReports(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch daily reports:', err.message);
    }
  };

  const fetchTasksData = async () => {
    try {
      const res = await api.get('/staff/tasks');
      if (Array.isArray(res.data)) {
        setTaskList(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch staff tasks/duties:', err.message);
    }
  };

  const refreshAll = () => {
    fetchStaffData();
    fetchReportsData();
    fetchTasksData();
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAssignDutySubmit = async (e) => {
    e.preventDefault();
    if (!dutyFormData.staff_id || !dutyFormData.title) {
      alert('Please select a staff member and provide a duty title.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/staff/tasks', dutyFormData);
      alert('Duty assigned successfully to staff member!');
      setShowAssignDutyModal(false);
      fetchTasksData();
      fetchStaffData();
      setDutyFormData({
        staff_id: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
        category: 'Passenger Support Review',
        due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        instructions: ''
      });
    } catch (err) {
      alert('Failed to assign duty: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDuty = async (dutyId) => {
    if (!window.confirm('Are you sure you want to cancel / delete this assigned duty?')) return;
    try {
      await api.delete(`/staff/tasks/${dutyId}`);
      fetchTasksData();
      fetchStaffData();
    } catch (err) {
      alert('Failed to delete duty: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) return;

    setSaving(true);
    try {
      const res = await api.post('/staff/admin-create', formData);
      if (res.data) {
        alert(`Staff Account created successfully! Employee ID: ${res.data.employee_id || formData.employee_id}`);
        setShowAddModal(false);
        fetchStaffData();
        setFormData({
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
      }
    } catch (err) {
      alert('Error creating staff account: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (staffId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to set this staff account status to ${nextStatus}?`)) return;

    try {
      await api.patch(`/staff/admin-status/${staffId}`, { status: nextStatus });
      fetchStaffData();
    } catch (err) {
      alert('Failed to update status: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdatePermissions = async (staffId, newPerms) => {
    try {
      await api.patch(`/staff/admin-permissions/${staffId}`, { permissions: newPerms });
      alert('Website access permissions updated successfully.');
      setShowPermsModal(null);
      fetchStaffData();
    } catch (err) {
      alert('Failed to update permissions: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDutyReviewAction = async (dutyId, action, remarks = '') => {
    try {
      await api.post(`/staff/tasks/${dutyId}/review`, {
        action,
        status: action === 'REQUEST_FOLLOW_UP' ? 'Needs Follow-up' : 'Reviewed',
        admin_review_remarks: remarks,
        review_comments: remarks
      });
      alert(action === 'REQUEST_FOLLOW_UP' ? 'Follow-up requested from staff member.' : 'Duty completion report marked as Reviewed!');
      setShowReportReviewModal(null);
      setShowFollowUpModal(null);
      setFollowUpRemarks('');
      refreshAll();
    } catch (err) {
      alert('Failed to update review status: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filtered Roster
  const filteredStaff = staffList.filter(st => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (st.full_name && st.full_name.toLowerCase().includes(q)) ||
      (st.email && st.email.toLowerCase().includes(q)) ||
      (st.employee_id && st.employee_id.toLowerCase().includes(q))
    );
    const matchesDept = deptFilter === 'ALL' || st.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || String(st.status).toUpperCase() === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  // Calculate Metrics from state
  const totalStaffCount = summary.total_staff || staffList.length;
  const activeStaffCount = summary.active_staff || staffList.filter(s => String(s.status).toUpperCase() === 'ACTIVE').length;
  const inactiveSuspendedCount = summary.inactive_suspended || staffList.filter(s => ['SUSPENDED', 'INACTIVE'].includes(String(s.status).toUpperCase())).length;
  const staffWithActiveDutiesCount = staffList.filter(st => {
    const sTasks = taskList.filter(t => t.staff_id === st.id || t.assigned_to_email === st.email);
    return sTasks.some(t => !['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_')));
  }).length;

  const totalDutiesCount = taskList.length;
  const pendingDutiesCount = taskList.filter(t => String(t.status).toUpperCase().replace(/[\s-]/g, '_') === 'PENDING').length;
  const inProgressDutiesCount = taskList.filter(t => String(t.status).toUpperCase().replace(/[\s-]/g, '_') === 'IN_PROGRESS').length;
  const completedDutiesCount = taskList.filter(t => ['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;
  const reportsPendingReviewCount = taskList.filter(t => String(t.status).toUpperCase().replace(/[\s-]/g, '_') === 'SUBMITTED_FOR_REVIEW').length + dailyReports.filter(r => r.status === 'SUBMITTED').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-8 animate-slide-in">
      
      {/* PAGE HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Staff Management Center</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-3xl">
                <strong>Website & System Management:</strong> Staff account permissions, operational duties assignment, and report reviews.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={refreshAll}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition flex items-center space-x-1.5 text-xs font-bold shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAssignDutyModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>+ Assign Duty to Staff</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Staff Account</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC SUB-MODULE SPECIFIC SUMMARY KPI CARDS */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Total Staff Accounts</span>
            <p className="text-2xl font-black text-slate-800">{totalStaffCount}</p>
            <span className="text-[10px] text-blue-600 font-bold">● System Roster</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Active Staff</span>
            <p className="text-2xl font-black text-emerald-600">{activeStaffCount}</p>
            <span className="text-[10px] text-emerald-600 font-bold">● Authorized Access</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Inactive / Suspended</span>
            <p className="text-2xl font-black text-rose-600">{inactiveSuspendedCount}</p>
            <span className="text-[10px] text-rose-600 font-bold">● Access Blocked</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Staff With Active Duties</span>
            <p className="text-2xl font-black text-indigo-600">{staffWithActiveDutiesCount}</p>
            <span className="text-[10px] text-indigo-600 font-bold">● Active Workload</span>
          </div>
        </div>
      )}

      {activeTab === 'duties' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Total Duties</span>
            <p className="text-2xl font-black text-slate-800">{totalDutiesCount}</p>
            <span className="text-[10px] text-blue-600 font-bold">● System Assignments</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Pending</span>
            <p className="text-2xl font-black text-amber-600">{pendingDutiesCount}</p>
            <span className="text-[10px] text-amber-600 font-bold">● Awaiting Start</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">In Progress</span>
            <p className="text-2xl font-black text-blue-600">{inProgressDutiesCount}</p>
            <span className="text-[10px] text-blue-600 font-bold">● Underway</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Pending Reports</span>
            <p className="text-2xl font-black text-purple-600">{reportsPendingReviewCount}</p>
            <span className="text-[10px] text-purple-600 font-bold">● Action Required</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Completed</span>
            <p className="text-2xl font-black text-emerald-600">{completedDutiesCount}</p>
            <span className="text-[10px] text-emerald-600 font-bold">● Finished</span>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Total Submitted Reports</span>
            <p className="text-2xl font-black text-slate-800">{taskList.filter(t => t.staff_report || t.status === 'Submitted for Review').length + dailyReports.length}</p>
            <span className="text-[10px] text-blue-600 font-bold">● Reports Logged</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Pending Review</span>
            <p className="text-2xl font-black text-amber-600">{reportsPendingReviewCount}</p>
            <span className="text-[10px] text-amber-600 font-bold">● Requires Action</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Needs Follow-up</span>
            <p className="text-2xl font-black text-rose-600">{taskList.filter(t => t.status === 'Needs Follow-up').length}</p>
            <span className="text-[10px] text-rose-600 font-bold">● Clarification Sent</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Reviewed / Approved</span>
            <p className="text-2xl font-black text-emerald-600">{taskList.filter(t => t.status === 'Reviewed').length + dailyReports.filter(r => r.status === 'APPROVED').length}</p>
            <span className="text-[10px] text-emerald-600 font-bold">● Approved</span>
          </div>
        </div>
      )}

      {/* DISTINCT MODULE TOP NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-bold">
        <button
          onClick={() => { setActiveTab('roster'); setSelectedStaffControl(null); }}
          className={`pb-3 transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'roster' 
              ? 'border-blue-600 text-blue-600 font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Staff Roster & Control</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {filteredStaff.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('duties'); setSelectedStaffControl(null); }}
          className={`pb-3 transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'duties' 
              ? 'border-blue-600 text-blue-600 font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>Staff Assigned Duties</span>
          {taskList.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
              {taskList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab('reports'); setSelectedStaffControl(null); }}
          className={`pb-3 transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'reports' 
              ? 'border-blue-600 text-blue-600 font-black' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Staff Reports</span>
          {reportsPendingReviewCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
              {reportsPendingReviewCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODULE 1: STAFF ROSTER & CONTROL (ACCOUNTS & PERMISSIONS) */}
      {/* ========================================================= */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          
          {/* HEADER & SUBTITLE */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Staff Roster & Control</h2>
              <p className="text-xs text-slate-500 font-medium">Manage authorized staff accounts, profiles, permissions and access.</p>
            </div>

            {/* SEARCH & FILTERS BAR */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center space-x-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search Name, ID, Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent focus:outline-none placeholder:text-slate-400 font-medium text-xs w-full text-slate-800"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-xs text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-xs text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* STAFF CONTROL DETAIL MODAL / DRAWER IF SELECTED */}
          {selectedStaffControl ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 space-y-6 animate-scale-in">
              <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-slate-800">{selectedStaffControl.full_name}</h3>
                    <span className="text-xs font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      ID: {selectedStaffControl.employee_id || 'EMP-10001'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {selectedStaffControl.designation} • Department: <strong>{selectedStaffControl.department}</strong> • Email: <span className="font-mono text-slate-700">{selectedStaffControl.email}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowPermsModal(selectedStaffControl)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Manage Permissions</span>
                  </button>
                  <button
                    onClick={() => setSelectedStaffControl(null)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Back to Roster Table
                  </button>
                </div>
              </div>

              {/* CONTROL SUB-NAVIGATION */}
              <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
                <button
                  onClick={() => setControlSubTab('profile')}
                  className={`pb-2.5 transition border-b-2 ${controlSubTab === 'profile' ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  PROFILE DETAILS
                </button>
                <button
                  onClick={() => setControlSubTab('permissions')}
                  className={`pb-2.5 transition border-b-2 ${controlSubTab === 'permissions' ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  PERMISSIONS & ACCESS
                </button>
                <button
                  onClick={() => setControlSubTab('duties')}
                  className={`pb-2.5 transition border-b-2 ${controlSubTab === 'duties' ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  CURRENT DUTIES ({taskList.filter(t => t.staff_id === selectedStaffControl.id || t.assigned_to_email === selectedStaffControl.email).length})
                </button>
                <button
                  onClick={() => setControlSubTab('reports')}
                  className={`pb-2.5 transition border-b-2 ${controlSubTab === 'reports' ? 'border-blue-600 text-blue-600 font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  REPORT HISTORY
                </button>
              </div>

              {/* PROFILE TAB */}
              {controlSubTab === 'profile' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Account Profile</span>
                    <p>Official Name: <strong className="text-slate-800">{selectedStaffControl.full_name}</strong></p>
                    <p>Official Email: <strong className="text-slate-800 font-mono">{selectedStaffControl.email}</strong></p>
                    <p>Phone Contact: <strong className="text-slate-800">{selectedStaffControl.phone || '+91 9876543210'}</strong></p>
                    <p>Base Station: <strong className="text-slate-800">{selectedStaffControl.base_station || 'NDLS'}</strong></p>
                    <p>Duty Status: <strong className="text-blue-700">{selectedStaffControl.duty_status || 'ON DUTY'}</strong></p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Department & Access</span>
                    <p>Department: <strong className="text-slate-800">{selectedStaffControl.department}</strong></p>
                    <p>Designation: <strong className="text-slate-800">{selectedStaffControl.designation || selectedStaffControl.staff_type}</strong></p>
                    <p>Joining Date: <strong className="text-slate-800">{selectedStaffControl.joining_date || '2023-01-15'}</strong></p>
                    <p>Account Status: <strong className="text-emerald-700 font-bold">{selectedStaffControl.status || 'ACTIVE'}</strong></p>
                  </div>
                </div>
              )}

              {/* PERMISSIONS TAB */}
              {controlSubTab === 'permissions' && (
                <div className="space-y-3 text-xs">
                  <span className="text-xs font-extrabold text-slate-700 block">Granted Website Access Permissions:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    {Array.isArray(selectedStaffControl.permissions) && selectedStaffControl.permissions.map(p => (
                      <div key={p} className="p-2 bg-white rounded-xl border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                        ✓ {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DUTIES TAB */}
              {controlSubTab === 'duties' && (
                <div className="space-y-3 text-xs">
                  {taskList.filter(t => t.staff_id === selectedStaffControl.id || t.assigned_to_email === selectedStaffControl.email).length === 0 ? (
                    <p className="text-slate-500 py-6 text-center font-medium">No duties currently assigned to this staff member.</p>
                  ) : (
                    <div className="space-y-3">
                      {taskList.filter(t => t.staff_id === selectedStaffControl.id || t.assigned_to_email === selectedStaffControl.email).map(tsk => (
                        <div key={tsk.id} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/60 flex justify-between items-center">
                          <div>
                            <p className="font-extrabold text-slate-800">{tsk.title}</p>
                            <p className="text-[11px] text-slate-500">{tsk.category || tsk.task_type} • Due: {tsk.due_date}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                            tsk.status === 'Completed' || tsk.status === 'Reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {tsk.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* REPORTS TAB */}
              {controlSubTab === 'reports' && (
                <div className="space-y-3 text-xs">
                  {taskList.filter(t => (t.staff_id === selectedStaffControl.id || t.assigned_to_email === selectedStaffControl.email) && (t.staff_report || t.status === 'Submitted for Review')).length === 0 ? (
                    <p className="text-slate-500 py-6 text-center font-medium">No completion reports submitted yet by this staff member.</p>
                  ) : (
                    <div className="space-y-3">
                      {taskList.filter(t => (t.staff_id === selectedStaffControl.id || t.assigned_to_email === selectedStaffControl.email) && (t.staff_report || t.status === 'Submitted for Review')).map(tsk => (
                        <div key={tsk.id} className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/60 flex justify-between items-center">
                          <div>
                            <p className="font-extrabold text-slate-800">{tsk.title}</p>
                            <p className="text-[11px] text-slate-500">Report Status: <strong>{tsk.status}</strong></p>
                          </div>
                          <button
                            onClick={() => setShowReportReviewModal(tsk)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl"
                          >
                            Review Report
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* STAFF ROSTER DIRECTORY TABLE */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                {filteredStaff.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Users className="h-10 w-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">No genuine staff records found matching criteria.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Employee ID</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Staff Name</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Department / Designation</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Account Status</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Permissions</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Active Duties</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400">Completed Duties</th>
                        <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredStaff.map((st) => {
                        const sTasks = taskList.filter(t => t.staff_id === st.id || t.assigned_to_email === st.email);
                        const activeT = sTasks.filter(t => !['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;
                        const compT = sTasks.filter(t => ['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;

                        return (
                          <tr key={st.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-5 py-4 text-xs font-mono font-bold text-blue-600">{st.employee_id || 'EMP-10001'}</td>
                            <td className="px-5 py-4">
                              <p className="text-xs font-extrabold text-slate-800">{st.full_name || st.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{st.email}</p>
                            </td>
                            <td className="px-5 py-4 text-xs">
                              <span className="font-bold text-slate-700">{st.designation || st.staff_type}</span>
                              <span className="block text-[10px] text-slate-400 font-medium">{st.department}</span>
                            </td>
                            <td className="px-5 py-4 text-xs font-bold">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${
                                String(st.status).toUpperCase() === 'ACTIVE' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {st.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-700">
                              <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-mono text-[10px]">
                                <span>{Array.isArray(st.permissions) ? (st.permissions.includes('ALL') ? 'Full Access' : `${st.permissions.length} Granted`) : 'Default Access'}</span>
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-800">
                              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-xs">{activeT}</span>
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-slate-800">
                              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-mono text-xs">{compT}</span>
                            </td>
                            <td className="px-5 py-4 text-xs font-bold text-right space-x-1.5">
                              <button
                                onClick={() => { setSelectedStaffControl(st); setControlSubTab('profile'); }}
                                className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition"
                                title="View & Manage Staff Control Profile"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setShowPermsModal(st)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                                title="Manage Website Permissions"
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleStatusToggle(st.id, String(st.status).toUpperCase())}
                                className={`p-1.5 rounded-lg transition ${
                                  String(st.status).toUpperCase() === 'ACTIVE'
                                    ? 'hover:bg-rose-50 text-rose-600'
                                    : 'hover:bg-emerald-50 text-emerald-600'
                                }`}
                                title={String(st.status).toUpperCase() === 'ACTIVE' ? 'Suspend Staff Account' : 'Activate Staff Account'}
                              >
                                {String(st.status).toUpperCase() === 'ACTIVE' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODULE 2: STAFF ASSIGNED DUTIES (WORK ASSIGNMENT ONLY)    */}
      {/* ========================================================= */}
      {activeTab === 'duties' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-800">Staff Assigned Duties</h2>
                <p className="text-xs text-slate-500 font-medium">Assign, monitor and review website-management duties assigned to staff.</p>
              </div>
              <button
                onClick={() => setShowAssignDutyModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 transition active:scale-95 shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>+ Assign Duty to Staff</span>
              </button>
            </div>

            {taskList.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-500">No duties currently assigned to staff.</p>
                <p className="text-xs text-slate-400">Click "+ Assign Duty to Staff" above to delegate operational duties.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50/70 text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Duty ID</th>
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Duty / Task Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Assigned Date</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Report Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-xs">
                    {taskList.map(tsk => (
                      <tr key={tsk.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 text-[11px]">{tsk.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-extrabold text-slate-800">{tsk.staff_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{tsk.assigned_to_email || tsk.staff_id}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{tsk.title}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{tsk.category || tsk.task_type}</td>
                        <td className="px-4 py-3 font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${
                            tsk.priority === 'HIGH' || tsk.priority === 'URGENT' ? 'bg-rose-600' : tsk.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-blue-600'
                          }`}>
                            {tsk.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{tsk.created_at ? tsk.created_at.split('T')[0] : 'Today'}</td>
                        <td className="px-4 py-3 text-slate-700 font-bold font-mono text-[11px]">{tsk.due_date}</td>
                        <td className="px-4 py-3 font-bold">
                          <span className={`px-2.5 py-0.5 rounded-xl text-[10px] border ${
                            ['Completed', 'Reviewed'].includes(tsk.status) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            tsk.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            tsk.status === 'Submitted for Review' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            tsk.status === 'Needs Follow-up' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {tsk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold">
                          {tsk.staff_report ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Submitted
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Pending Submission</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          <button
                            onClick={() => setShowDutyDetailModal(tsk)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                            title="View Duty Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {tsk.staff_report && (
                            <button
                              onClick={() => setShowReportReviewModal(tsk)}
                              className="p-1.5 hover:bg-purple-50 text-purple-600 rounded-lg transition"
                              title="Review Staff Completion Report"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDuty(tsk.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                            title="Cancel / Delete Duty"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODULE 3: STAFF REPORTS (REVIEWS & FOLLOW-UP)             */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800">Staff Reports</h2>
                <p className="text-xs text-slate-500 font-medium">Review submitted duty completion reports and daily staff operational logs.</p>
              </div>
              <span className="text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                Pending Review: {reportsPendingReviewCount}
              </span>
            </div>

            {taskList.filter(t => t.staff_report || ['Submitted for Review', 'Needs Follow-up', 'Reviewed'].includes(t.status)).length === 0 && dailyReports.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center font-medium">
                No completion or daily reports submitted by staff members yet.
              </p>
            ) : (
              <div className="space-y-4">
                {taskList.filter(t => t.staff_report || ['Submitted for Review', 'Needs Follow-up', 'Reviewed'].includes(t.status)).map(rep => (
                  <div key={rep.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-3 hover:shadow-sm transition">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200/80 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-slate-800">{rep.staff_name}</span>
                          <span className="text-[10px] font-mono text-blue-600 font-bold">({rep.assigned_to_email || rep.staff_id})</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">{rep.category || rep.task_type}</span>
                        </div>
                        <p className="text-[11px] font-extrabold text-slate-800 mt-1">Duty Title: {rep.title}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                          rep.status === 'Reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          rep.status === 'Needs Follow-up' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {rep.status}
                        </span>
                        
                        <button
                          onClick={() => setShowReportReviewModal(rep)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                        >
                          Review & Actions
                        </button>
                      </div>
                    </div>

                    {rep.staff_report && (
                      <div className="text-xs space-y-2 bg-white p-3.5 rounded-xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Work Performed:</span>
                          <p className="text-slate-800 font-medium">{rep.staff_report.work_performed}</p>
                        </div>
                        {rep.staff_report.findings && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Findings:</span>
                            <p className="text-slate-700">{rep.staff_report.findings}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS & DETAILED VIEWS */}
      {/* ========================================================= */}

      {/* ADD STAFF ACCOUNT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-5 animate-scale-in my-8">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Add New Staff Account</h3>
                <p className="text-[11px] text-slate-500 font-medium">Create an internal staff account for Railway Management System website operations.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rajesh.support@railway.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Employee ID</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Designation</label>
                  <select
                    value={formData.staff_type}
                    onChange={(e) => setFormData({ ...formData, staff_type: e.target.value, designation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {STAFF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {saving ? 'Creating Account...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN DUTY MODAL */}
      {showAssignDutyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-scale-in my-8">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Assign Duty to Staff Member</h3>
                <p className="text-xs text-slate-500 font-medium">Delegate operational website management duty to authorized staff</p>
              </div>
              <button onClick={() => setShowAssignDutyModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignDutySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Staff Member *</label>
                <select
                  required
                  value={dutyFormData.staff_id}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, staff_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  <option value="">-- Select Staff Member --</option>
                  {staffList.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.employee_id || st.email}) - {st.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Duty / Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify today's passenger booking records"
                  value={dutyFormData.title}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Category</label>
                  <select
                    value={dutyFormData.category}
                    onChange={(e) => setDutyFormData({ ...dutyFormData, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 focus:outline-none"
                  >
                    {DUTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Priority</label>
                  <select
                    value={dutyFormData.priority}
                    onChange={(e) => setDutyFormData({ ...dutyFormData, priority: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dutyFormData.due_date}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, due_date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Summary description of the duty..."
                  value={dutyFormData.description}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Instructions / Expected Output</label>
                <textarea
                  rows={2}
                  placeholder="Detailed instructions or expected output format..."
                  value={dutyFormData.instructions}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, instructions: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignDutyModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : 'Assign Duty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGNED DUTY DETAIL VIEW MODAL */}
      {showDutyDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Duty Details</h3>
                <p className="text-[11px] text-blue-600 font-mono font-bold">Duty ID: {showDutyDetailModal.id} • Status: {showDutyDetailModal.status}</p>
              </div>
              <button onClick={() => setShowDutyDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* DUTY DETAILS SECTION */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">DUTY DETAILS</span>
                <p>Title: <strong className="text-slate-800">{showDutyDetailModal.title}</strong></p>
                <p>Category: <strong className="text-slate-800">{showDutyDetailModal.category || showDutyDetailModal.task_type}</strong></p>
                <p>Priority: <strong className="text-slate-800">{showDutyDetailModal.priority}</strong></p>
                <p>Assigned Staff: <strong className="text-slate-800">{showDutyDetailModal.staff_name}</strong> ({showDutyDetailModal.assigned_to_email})</p>
                <p>Assigned By: <strong className="text-slate-800">{showDutyDetailModal.assigned_by || showDutyDetailModal.assigned_by_admin || 'System Admin'}</strong></p>
                <p>Created Date: <strong className="text-slate-800">{showDutyDetailModal.created_at ? showDutyDetailModal.created_at.split('T')[0] : 'N/A'}</strong></p>
                <p>Due Date: <strong className="text-slate-800">{showDutyDetailModal.due_date}</strong></p>
              </div>

              {/* INSTRUCTIONS SECTION */}
              {showDutyDetailModal.instructions && (
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 space-y-1">
                  <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider block">INSTRUCTIONS / EXPECTED OUTPUT</span>
                  <p className="text-slate-800 font-semibold">{showDutyDetailModal.instructions}</p>
                </div>
              )}

              {/* STAFF PROGRESS SECTION */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">STAFF PROGRESS</span>
                <p>Started At: <strong className="text-slate-800">{showDutyDetailModal.started_at ? new Date(showDutyDetailModal.started_at).toLocaleString() : 'Not Started'}</strong></p>
                <p>Completed At: <strong className="text-slate-800">{showDutyDetailModal.completed_at ? new Date(showDutyDetailModal.completed_at).toLocaleString() : 'Not Completed'}</strong></p>
              </div>

              {/* COMPLETION REPORT SECTION */}
              {showDutyDetailModal.staff_report && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">COMPLETION REPORT</span>
                  <p>Status: <strong className="text-slate-800">{showDutyDetailModal.staff_report.completion_status}</strong></p>
                  <p>Work Performed: <span className="text-slate-800 font-medium">{showDutyDetailModal.staff_report.work_performed}</span></p>
                  {showDutyDetailModal.staff_report.findings && <p>Findings: <span className="text-slate-800">{showDutyDetailModal.staff_report.findings}</span></p>}
                  {showDutyDetailModal.staff_report.issues_encountered && <p>Issues: <span className="text-rose-700">{showDutyDetailModal.staff_report.issues_encountered}</span></p>}
                  {showDutyDetailModal.staff_report.recommended_followup && <p>Recommendations: <span className="text-slate-700">{showDutyDetailModal.staff_report.recommended_followup}</span></p>}
                </div>
              )}

              {/* ADMIN REVIEW SECTION */}
              {showDutyDetailModal.admin_review_remarks && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block">ADMIN REVIEW</span>
                  <p>Review Status: <strong className="text-slate-800">{showDutyDetailModal.admin_review_status || 'REVIEWED'}</strong></p>
                  <p>Admin Remarks: <span className="text-slate-800 font-medium">{showDutyDetailModal.admin_review_remarks}</span></p>
                  {showDutyDetailModal.reviewed_at && <p>Reviewed At: <span className="text-slate-600">{new Date(showDutyDetailModal.reviewed_at).toLocaleString()}</span></p>}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDutyDetailModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PERMISSIONS MODAL */}
      {showPermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Manage Website Access Permissions</h3>
                <p className="text-[11px] text-slate-500 font-medium">Staff Account: <strong>{showPermsModal.full_name || showPermsModal.name}</strong> ({showPermsModal.employee_id})</p>
              </div>
              <button onClick={() => setShowPermsModal(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">Website Access Permissions</label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                {PERMISSIONS_LIST.map(p => {
                  const currentPerms = showPermsModal.permissions || [];
                  const isChecked = currentPerms.includes('ALL') || currentPerms.includes(p.key);
                  return (
                    <label key={p.key} className="flex items-center space-x-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let updated = [...currentPerms].filter(k => k !== 'ALL');
                          if (e.target.checked) {
                            updated.push(p.key);
                          } else {
                            updated = updated.filter(k => k !== p.key);
                          }
                          setShowPermsModal({ ...showPermsModal, permissions: updated });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPermsModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePermissions(showPermsModal.id, showPermsModal.permissions || [])}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Save Permission Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT REVIEW MODAL */}
      {showReportReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Review Staff Completion Report</h3>
                <p className="text-[11px] text-slate-500 font-medium">Duty: <strong>{showReportReviewModal.title}</strong></p>
              </div>
              <button onClick={() => setShowReportReviewModal(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <p>Staff Name: <strong className="text-slate-800">{showReportReviewModal.staff_name}</strong></p>
                <p>Category: <strong className="text-slate-800">{showReportReviewModal.category || showReportReviewModal.task_type}</strong></p>
                <p>Priority: <strong className="text-slate-800">{showReportReviewModal.priority}</strong></p>
                {showReportReviewModal.instructions && <p>Instructions: <span className="text-blue-800">{showReportReviewModal.instructions}</span></p>}
              </div>

              {showReportReviewModal.staff_report && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">Submitted Completion Report</span>
                  <p>Completion Status: <strong className="text-slate-800">{showReportReviewModal.staff_report.completion_status}</strong></p>
                  <p>Work Performed: <span className="text-slate-800 font-medium">{showReportReviewModal.staff_report.work_performed}</span></p>
                  {showReportReviewModal.staff_report.findings && <p>Results / Findings: <span className="text-slate-800">{showReportReviewModal.staff_report.findings}</span></p>}
                  {showReportReviewModal.staff_report.issues_encountered && <p>Issues: <span className="text-rose-700">{showReportReviewModal.staff_report.issues_encountered}</span></p>}
                  {showReportReviewModal.staff_report.recommended_followup && <p>Recommendations: <span className="text-slate-700">{showReportReviewModal.staff_report.recommended_followup}</span></p>}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(showReportReviewModal)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                Request Follow-up
              </button>
              <button
                type="button"
                onClick={() => handleDutyReviewAction(showReportReviewModal.id, 'REVIEW')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Mark as Reviewed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST FOLLOW-UP REMARKS MODAL */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Request Staff Follow-Up</h3>
                <p className="text-[11px] text-slate-500 font-medium">Duty: {showFollowUpModal.title}</p>
              </div>
              <button onClick={() => setShowFollowUpModal(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Admin Remarks / Specific Questions *</label>
              <textarea
                required
                rows={4}
                placeholder="e.g. Please provide additional details regarding unresolved passenger service requests."
                value={followUpRemarks}
                onChange={(e) => setFollowUpRemarks(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!followUpRemarks.trim()}
                onClick={() => handleDutyReviewAction(showFollowUpModal.id, 'REQUEST_FOLLOW_UP', followUpRemarks)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md disabled:opacity-50"
              >
                Send Follow-up Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminStaffManagement;
