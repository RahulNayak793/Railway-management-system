import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Clock, AlertTriangle, CheckCircle, Search, Filter, Calendar, 
  Send, Eye, RefreshCw, AlertCircle, FileText, ChevronRight, ArrowRight, Shield
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const PRIORITIES = ['ALL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = [
  { key: 'ALL', label: 'All Tasks' },
  { key: 'Pending', label: 'Pending' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Submitted for Review', label: 'Awaiting Review' },
  { key: 'Needs Follow-up', label: 'Needs Follow-up' },
  { key: 'Completed', label: 'Completed' }
];

const StaffTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modals
  const [showReportModal, setShowReportModal] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Completion report form data
  const [reportFormData, setReportFormData] = useState({
    completion_status: 'Fully Completed',
    work_performed: '',
    findings: '',
    remarks: '',
    issues_encountered: '',
    recommended_followup: ''
  });

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/tasks');
      if (Array.isArray(res.data)) {
        setTasks(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch staff tasks:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const handleStartTask = async (taskId) => {
    try {
      await api.patch(`/staff/tasks/${taskId}`, { status: 'In Progress' });
      fetchMyTasks();
    } catch (err) {
      alert('Failed to start task: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenReportModal = (task) => {
    setShowReportModal(task);
    setReportFormData({
      completion_status: task.staff_report?.completion_status || 'Fully Completed',
      work_performed: task.staff_report?.work_performed || task.completion_remarks || task.remarks || '',
      findings: task.staff_report?.findings || '',
      remarks: task.staff_report?.remarks || '',
      issues_encountered: task.staff_report?.issues_encountered || '',
      recommended_followup: task.staff_report?.recommended_followup || ''
    });
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!showReportModal) return;
    if (!reportFormData.work_performed.trim() && !reportFormData.remarks.trim()) {
      alert('Please describe the work performed before submitting your report.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/staff/tasks/${showReportModal.id}/report`, reportFormData);
      alert('Completion report submitted successfully! Task status is now "Submitted for Review".');
      setShowReportModal(null);
      fetchMyTasks();
    } catch (err) {
      alert('Failed to submit report: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for overdue check
  const isOverdue = (dueDate, status) => {
    if (!dueDate) return false;
    const norm = String(status).toUpperCase().replace(/[\s-]/g, '_');
    if (['COMPLETED', 'REVIEWED'].includes(norm)) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  // Filter tasks
  const filteredTasks = tasks.filter(tsk => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (tsk.title && tsk.title.toLowerCase().includes(q)) ||
      (tsk.description && tsk.description.toLowerCase().includes(q)) ||
      (tsk.category && tsk.category.toLowerCase().includes(q)) ||
      (tsk.task_type && tsk.task_type.toLowerCase().includes(q))
    );

    const normStatus = String(tsk.status).toUpperCase().replace(/[\s-]/g, '_');

    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      const targetNorm = statusFilter.toUpperCase().replace(/[\s-]/g, '_');
      if (targetNorm === 'COMPLETED') {
        matchesStatus = ['COMPLETED', 'REVIEWED'].includes(normStatus);
      } else if (targetNorm === 'SUBMITTED_FOR_REVIEW') {
        matchesStatus = normStatus === 'SUBMITTED_FOR_REVIEW' || normStatus === 'AWAITING_REVIEW';
      } else {
        matchesStatus = normStatus === targetNorm;
      }
    }

    let matchesPriority = true;
    if (priorityFilter !== 'ALL') {
      matchesPriority = String(tsk.priority).toUpperCase() === priorityFilter;
    }

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // KPI Metrics
  const pendingCount = tasks.filter(t => ['PENDING'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;
  const inProgressCount = tasks.filter(t => ['IN_PROGRESS'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;
  const awaitingReviewCount = tasks.filter(t => ['SUBMITTED_FOR_REVIEW'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;
  const followUpCount = tasks.filter(t => ['NEEDS_FOLLOW_UP'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;
  const completedCount = tasks.filter(t => ['COMPLETED', 'REVIEWED'].includes(String(t.status).toUpperCase().replace(/[\s-]/g, '_'))).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-8 animate-slide-in">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-5 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md">
            <CheckSquare className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">My Assigned Duties</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              View operational website management duties assigned to you, update status, and submit completion reports for Admin review.
            </p>
          </div>
        </div>

        <button
          onClick={fetchMyTasks}
          className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition flex items-center space-x-2 text-xs font-bold shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Duties</span>
        </button>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pending</span>
          <p className="text-2xl font-black text-amber-600">{pendingCount}</p>
          <span className="text-[10px] text-amber-600 font-bold">● Awaiting Start</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">In Progress</span>
          <p className="text-2xl font-black text-blue-600">{inProgressCount}</p>
          <span className="text-[10px] text-blue-600 font-bold">● Active Work</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Awaiting Review</span>
          <p className="text-2xl font-black text-purple-600">{awaitingReviewCount}</p>
          <span className="text-[10px] text-purple-600 font-bold">● Under Review</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Follow-up Required</span>
          <p className="text-2xl font-black text-rose-600">{followUpCount}</p>
          <span className="text-[10px] text-rose-600 font-bold">● Needs Attention</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Completed</span>
          <p className="text-2xl font-black text-emerald-600">{completedCount}</p>
          <span className="text-[10px] text-emerald-600 font-bold">● Approved</span>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex items-center space-x-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by title, category, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent focus:outline-none placeholder:text-slate-400 font-medium text-xs w-full text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 focus:outline-none"
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 focus:outline-none"
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TASK LIST CONTAINER */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading your assigned tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <CheckSquare className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No Assigned Tasks Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {tasks.length === 0 
              ? "You have no assigned tasks at the moment. System administrators will assign website operational duties to you here." 
              : "No tasks match your selected filter or search query."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => {
            const overdue = isOverdue(task.due_date, task.status);
            const normStatus = String(task.status).toUpperCase().replace(/[\s-]/g, '_');
            const isFollowUpReq = normStatus === 'NEEDS_FOLLOW_UP';

            return (
              <div 
                key={task.id} 
                className={`bg-white rounded-2xl border transition shadow-sm hover:shadow-md p-5 space-y-4 ${
                  isFollowUpReq ? 'border-rose-300 ring-2 ring-rose-500/20' : overdue ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                }`}
              >
                {/* ADMIN FOLLOW-UP ALERT BANNER */}
                {isFollowUpReq && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-3 text-xs text-rose-800">
                    <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-extrabold uppercase tracking-wide text-[11px] text-rose-700">⚠️ Admin Follow-Up Requested</p>
                      <p className="font-medium">{task.admin_review_remarks || "Administrator requested additional details or clarification on your submitted report."}</p>
                    </div>
                  </div>
                )}

                {/* TASK HEADER ROW */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Badge */}
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white ${
                        task.priority === 'URGENT' ? 'bg-rose-600 animate-pulse' :
                        task.priority === 'HIGH' ? 'bg-rose-500' :
                        task.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-blue-600'
                      }`}>
                        {task.priority || 'MEDIUM'} PRIORITY
                      </span>

                      {/* Category Tag */}
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                        {task.category || task.task_type || 'Passenger Support'}
                      </span>

                      {/* Overdue Badge */}
                      {overdue && (
                        <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>OVERDUE</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-800">{task.title}</h3>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                      ['COMPLETED', 'REVIEWED'].includes(normStatus) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      normStatus === 'SUBMITTED_FOR_REVIEW' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      normStatus === 'NEEDS_FOLLOW_UP' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      normStatus === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      ● {task.status || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* DESCRIPTION & INSTRUCTIONS */}
                {(task.description || task.instructions) && (
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                    {task.description && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Description</span>
                        <p className="text-slate-700 font-medium">{task.description}</p>
                      </div>
                    )}
                    {task.instructions && (
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Admin Instructions / Expected Output</span>
                        <p className="text-slate-800 font-semibold">{task.instructions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TASK METADATA & FOOTER ACTIONS */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-3 border-t border-slate-100 text-xs gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-slate-500 font-medium">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Assigned: <strong>{task.created_at ? task.created_at.split('T')[0] : 'Today'}</strong></span>
                    </span>
                    <span className={`flex items-center space-x-1 ${overdue ? 'text-rose-600 font-bold' : ''}`}>
                      <Clock className="h-3.5 w-3.5" />
                      <span>Due Date: <strong>{task.due_date || 'N/A'}</strong></span>
                    </span>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    {/* START TASK BUTTON */}
                    {normStatus === 'PENDING' && (
                      <button
                        onClick={() => handleStartTask(task.id)}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center justify-center space-x-2 active:scale-95"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span>Start Task</span>
                      </button>
                    )}

                    {/* SUBMIT REPORT / CONTINUE BUTTON */}
                    {['IN_PROGRESS', 'NEEDS_FOLLOW_UP'].includes(normStatus) && (
                      <button
                        onClick={() => handleOpenReportModal(task)}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md transition flex items-center justify-center space-x-2 active:scale-95"
                      >
                        <Send className="h-4 w-4" />
                        <span>{isFollowUpReq ? 'Resubmit Report' : 'Submit Completion Report'}</span>
                      </button>
                    )}

                    {/* VIEW DETAILS MODAL BUTTON */}
                    <button
                      onClick={() => setShowDetailModal(task)}
                      className="w-full sm:w-auto p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
                    >
                      <Eye className="h-4 w-4 text-slate-500" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STAFF COMPLETION REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-100 space-y-5 animate-scale-in my-8">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">Task Completion Report</h3>
                <p className="text-[11px] text-slate-500 font-medium">Task: <strong>{showReportModal.title}</strong></p>
              </div>
              <button onClick={() => setShowReportModal(null)} className="text-slate-400 hover:text-slate-600">
                <AlertCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Task Category & Target</span>
                <p className="text-slate-800 font-bold">{showReportModal.category || showReportModal.task_type} • Due: {showReportModal.due_date}</p>
                {showReportModal.instructions && (
                  <p className="text-[11px] text-slate-600 italic">Instructions: "{showReportModal.instructions}"</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Completion Status *</label>
                <select
                  value={reportFormData.completion_status}
                  onChange={(e) => setReportFormData({ ...reportFormData, completion_status: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800 focus:outline-none focus:bg-white"
                >
                  <option value="Fully Completed">Fully Completed</option>
                  <option value="Partially Completed">Partially Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Work Performed *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the actions taken, record checks made, or system updates performed..."
                  value={reportFormData.work_performed}
                  onChange={(e) => setReportFormData({ ...reportFormData, work_performed: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Results / Findings</label>
                <textarea
                  rows={2}
                  placeholder="Key findings, verification results, or data discrepancies identified..."
                  value={reportFormData.findings}
                  onChange={(e) => setReportFormData({ ...reportFormData, findings: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Issues Encountered</label>
                  <input
                    type="text"
                    placeholder="Any technical or record errors..."
                    value={reportFormData.issues_encountered}
                    onChange={(e) => setReportFormData({ ...reportFormData, issues_encountered: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Recommended Follow-up</label>
                  <input
                    type="text"
                    placeholder="Next steps or recommended action..."
                    value={reportFormData.recommended_followup}
                    onChange={(e) => setReportFormData({ ...reportFormData, recommended_followup: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReportModal(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Submitting Report...' : 'Submit Completion Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAILS MODAL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-800">{showDetailModal.title}</h3>
                <p className="text-[11px] text-blue-600 font-mono font-bold">{showDetailModal.category || showDetailModal.task_type} • Status: {showDetailModal.status}</p>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                <AlertCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <p>Priority: <strong className="text-slate-800">{showDetailModal.priority}</strong></p>
                <p>Due Date: <strong className="text-slate-800">{showDetailModal.due_date}</strong></p>
                {showDetailModal.description && <p>Description: <span className="text-slate-700">{showDetailModal.description}</span></p>}
                {showDetailModal.instructions && <p>Admin Instructions: <span className="text-blue-800 font-semibold">{showDetailModal.instructions}</span></p>}
              </div>

              {/* SUBMITTED REPORT SECTION IF PRESENT */}
              {showDetailModal.staff_report && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">Submitted Completion Report</span>
                  <p>Status: <strong className="text-slate-800">{showDetailModal.staff_report.completion_status}</strong></p>
                  <p>Work Performed: <span className="text-slate-800 font-medium">{showDetailModal.staff_report.work_performed}</span></p>
                  {showDetailModal.staff_report.findings && <p>Findings: <span className="text-slate-800">{showDetailModal.staff_report.findings}</span></p>}
                  {showDetailModal.staff_report.issues_encountered && <p>Issues: <span className="text-rose-700">{showDetailModal.staff_report.issues_encountered}</span></p>}
                </div>
              )}

              {/* ADMIN REVIEW REMARKS IF PRESENT */}
              {showDetailModal.admin_review_remarks && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block">Admin Review Remarks</span>
                  <p className="text-slate-800 font-medium">{showDetailModal.admin_review_remarks}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffTasks;
