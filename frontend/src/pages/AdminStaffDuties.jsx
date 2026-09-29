import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, Plus, Search, Filter, RefreshCw, Calendar, Clock, 
  CheckCircle, AlertCircle, XCircle, ChevronRight, Eye, Send, Briefcase, FileText, UserCheck
} from 'lucide-react';
import api from '../services/api';

const DUTY_CATEGORIES = [
  'Passenger Support & Ticket Verification',
  'Booking & PNR Verification',
  'Train Schedule & Route Management',
  'Live Train Status & Tracking Update',
  'Catering & Meals Order Management',
  'Emergency SOS & Incident Documentation',
  'Daily Staff Operations Report'
];

export default function AdminStaffDuties() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [taskList, setTaskList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [summary, setSummary] = useState({
    total_duties: 0,
    pending: 0,
    in_progress: 0,
    pending_reports: 0,
    completed: 0
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('');

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDutyDetail, setSelectedDutyDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  // Assign Duty Form state
  const [dutyFormData, setDutyFormData] = useState({
    staff_id: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    category: 'Passenger Support & Ticket Verification',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    instructions: ''
  });

  const fetchDutiesData = async () => {
    setLoading(true);
    try {
      const [tasksRes, rosterRes] = await Promise.all([
        api.get('/staff/tasks').catch(() => ({ data: [] })),
        api.get('/staff/admin-roster').catch(() => ({ data: null }))
      ]);

      if (Array.isArray(tasksRes.data)) {
        const tasks = tasksRes.data;
        setTaskList(tasks);

        const pending = tasks.filter(t => t.status === 'PENDING').length;
        const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const pendingReports = tasks.filter(t => t.status === 'REPORT_SUBMITTED' || (t.completion_report && t.report_status === 'PENDING_REVIEW')).length;
        const completed = tasks.filter(t => t.status === 'COMPLETED').length;

        setSummary({
          total_duties: tasks.length,
          pending,
          in_progress: inProgress,
          pending_reports: pendingReports,
          completed
        });
      }

      if (rosterRes.data) {
        const staffArray = Array.isArray(rosterRes.data.staff) 
          ? rosterRes.data.staff 
          : Array.isArray(rosterRes.data) 
          ? rosterRes.data 
          : [];
        setStaffList(staffArray);
      }
    } catch (err) {
      console.error('Failed to fetch duties data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDutiesData();
  }, []);

  const handleAssignDutySubmit = async (e) => {
    e.preventDefault();
    if (!dutyFormData.staff_id || !dutyFormData.title || !dutyFormData.description) {
      alert('Please fill in required fields (Staff Member, Title, and Description).');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/staff/tasks', dutyFormData);
      if (res.data && (res.data.success || res.data.id)) {
        alert('Duty assigned to staff member successfully!');
        setShowAssignModal(false);
        setDutyFormData({
          staff_id: '',
          title: '',
          description: '',
          priority: 'MEDIUM',
          category: 'Passenger Support & Ticket Verification',
          due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          instructions: ''
        });
        fetchDutiesData();
      } else {
        alert(res.data?.message || 'Failed to assign duty.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error assigning duty');
    } finally {
      setSaving(false);
    }
  };

  // Filtered duties
  const filteredDuties = taskList.filter(duty => {
    const matchesSearch = 
      duty.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      duty.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      duty.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      duty.task_code?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStaff = staffFilter === 'ALL' || String(duty.staff_id) === String(staffFilter);
    const matchesPriority = priorityFilter === 'ALL' || duty.priority === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || duty.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || duty.category === categoryFilter;
    const matchesDueDate = !dueDateFilter || (duty.due_date && duty.due_date.startsWith(dueDateFilter));

    return matchesSearch && matchesStaff && matchesPriority && matchesStatus && matchesCategory && matchesDueDate;
  });

  return (
    <div className="space-y-6 pb-12 p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-screen">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-amber-500/30 border border-amber-400/30 rounded-2xl text-amber-300 shadow-inner">
              <ClipboardList className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Work & Duty Management
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                Staff Assigned Tasks & Duties
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                Assign, monitor and manage website-management duties assigned to registered staff.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-auto">
            <button
              onClick={fetchDutiesData}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition border border-white/15 flex items-center justify-center"
              title="Refresh Duties"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowAssignModal(true)}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm transition shadow-lg shadow-amber-500/30 flex items-center space-x-2 border border-amber-300/40 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Assign Duty to Staff</span>
            </button>
          </div>
        </div>

        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-1">
              <span>Total Duties</span>
              <ClipboardList className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{summary.total_duties}</div>
            <span className="text-[10px] text-slate-400 font-medium">All recorded duties</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-amber-300 text-xs font-bold mb-1">
              <span>Pending</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">{summary.pending}</div>
            <span className="text-[10px] text-slate-400 font-medium">Awaiting staff action</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-sky-300 text-xs font-bold mb-1">
              <span>In Progress</span>
              <RefreshCw className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-sky-300 font-mono">{summary.in_progress}</div>
            <span className="text-[10px] text-slate-400 font-medium">Active work underway</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-purple-300 text-xs font-bold mb-1">
              <span>Pending Reports</span>
              <FileText className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-300 font-mono">{summary.pending_reports}</div>
            <span className="text-[10px] text-slate-400 font-medium">Reports awaiting review</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold mb-1">
              <span>Completed</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-300 font-mono">{summary.completed}</div>
            <span className="text-[10px] text-slate-400 font-medium">Finished & verified</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT TABLE & FILTERS */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* SEARCH & FILTERS */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search duty, staff, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-600">Staff:</span>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-600">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {DUTY_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
              <span className="text-xs font-bold text-slate-600">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-r-transparent" />
          </div>
        ) : filteredDuties.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
            <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Assigned Duties Found</h3>
            <p className="text-xs text-slate-500 mt-1">Assign website management tasks to staff members using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-800 uppercase font-black tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Duty Code / Title</th>
                  <th className="p-4">Assigned Staff</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredDuties.map((duty) => (
                  <tr key={duty.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <div className="font-mono text-[10px] text-amber-700 font-bold">{duty.task_code || `DUTY-${duty.id}`}</div>
                      <div className="font-black text-slate-900 text-sm leading-tight mt-0.5">{duty.title}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-xs">{duty.staff_name || `Staff #${duty.staff_id}`}</div>
                      <div className="text-[11px] text-slate-500">{duty.staff_email || ''}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {duty.category || 'General Duty'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        duty.priority === 'URGENT' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        duty.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {duty.priority || 'MEDIUM'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {duty.due_date ? new Date(duty.due_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        duty.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        duty.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                        duty.status === 'REPORT_SUBMITTED' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        ● {duty.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedDutyDetail(duty)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-xs transition border border-indigo-200 flex items-center space-x-1 ml-auto"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ASSIGN DUTY TO STAFF MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Assign Duty to Staff</h3>
                  <p className="text-xs text-slate-500 font-medium">Assign website management tasks and duties to staff members.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignDutySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Staff Member *</label>
                <select
                  required
                  value={dutyFormData.staff_id}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, staff_id: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="">-- Select Staff Member --</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} ({staff.employee_id || `ID: ${staff.id}`}) — {staff.department || 'Passenger Services'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duty / Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verify Passenger Support Tickets & Escalation Desk"
                  value={dutyFormData.title}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, title: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide detailed description of work required..."
                  value={dutyFormData.description}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, description: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website Duty Category</label>
                  <select
                    value={dutyFormData.category}
                    onChange={(e) => setDutyFormData({ ...dutyFormData, category: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white cursor-pointer"
                  >
                    {DUTY_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={dutyFormData.priority}
                    onChange={(e) => setDutyFormData({ ...dutyFormData, priority: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dutyFormData.due_date}
                    onChange={(e) => setDutyFormData({ ...dutyFormData, due_date: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Special Instructions / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional instructions for staff member..."
                  value={dutyFormData.instructions}
                  onChange={(e) => setDutyFormData({ ...dutyFormData, instructions: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition shadow-md shadow-amber-500/20"
                >
                  {saving ? 'Assigning...' : 'Assign Duty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DUTY DETAIL MODAL */}
      {selectedDutyDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedDutyDetail.title}</h3>
                  <p className="text-xs text-amber-700 font-mono font-bold">{selectedDutyDetail.task_code || `DUTY-${selectedDutyDetail.id}`}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDutyDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Assigned Staff</span>
                  <span className="font-black text-slate-800">{selectedDutyDetail.staff_name || `Staff #${selectedDutyDetail.staff_id}`}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Priority</span>
                  <span className="font-bold text-amber-700">{selectedDutyDetail.priority}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Category</span>
                  <span className="font-bold text-slate-700">{selectedDutyDetail.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Due Date</span>
                  <span className="font-bold text-slate-700">{selectedDutyDetail.due_date ? new Date(selectedDutyDetail.due_date).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1">Description</span>
                <p className="text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {selectedDutyDetail.description}
                </p>
              </div>

              {selectedDutyDetail.instructions && (
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1">Special Instructions</span>
                  <p className="text-slate-700 font-medium italic bg-amber-50/50 p-3 rounded-xl border border-amber-200/60">
                    "{selectedDutyDetail.instructions}"
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDutyDetail(null)}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
