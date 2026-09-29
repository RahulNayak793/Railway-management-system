import React, { useState, useEffect } from 'react';
import { 
  FileText, Send, CheckCircle, Clock, AlertTriangle, RefreshCw, 
  CheckSquare, AlertCircle, Calendar, User, Eye, ShieldCheck, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const StaffDailyReport = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Tabs: 'task' (Submit Assigned Task) | 'shift' (Daily Shift Operations Log)
  const [activeTab, setActiveTab] = useState('task');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Task Submission State
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskReportForm, setTaskReportForm] = useState({
    completion_status: 'Fully Completed',
    work_performed: '',
    findings: '',
    remarks: '',
    issues_encountered: '',
    recommended_followup: ''
  });

  // Shift Report State
  const [reports, setReports] = useState([]);
  const [shiftForm, setShiftForm] = useState({
    report_date: new Date().toISOString().split('T')[0],
    shift: 'Morning Shift (06:00 - 14:00)',
    assigned_train: '12951 - Rajdhani Express',
    assigned_station: 'NDLS',
    assigned_tasks_completed: '4',
    tickets_verified: '95',
    passenger_requests_handled: '12',
    incidents_handled: '1',
    catering_orders_handled: '15',
    summary: 'All internal website management tasks were completed smoothly during shift.',
    remarks: 'Verified PNR records and processed passenger service requests.',
    declaration_confirmed: false
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksRes, reportsRes] = await Promise.all([
        api.get('/staff/tasks').catch(() => ({ data: [] })),
        api.get('/staff/daily-reports').catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(tasksRes.data)) {
        setTasks(tasksRes.data);
        if (!selectedTaskId && tasksRes.data.length > 0) {
          const firstPending = tasksRes.data.find(t => t.status !== 'Completed' && t.status !== 'Reviewed');
          if (firstPending) {
            setSelectedTaskId(firstPending.id);
          } else {
            setSelectedTaskId(tasksRes.data[0].id);
          }
        }
      }

      if (Array.isArray(reportsRes.data)) {
        setReports(reportsRes.data);
      }
    } catch (err) {
      console.warn('Could not fetch data for task submission:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Submit Task Completion Report
  const handleSubmitTaskReport = async (e) => {
    e.preventDefault();
    if (!selectedTaskId) {
      showToast ? showToast('Please select a task to submit.', 'error') : alert('Please select a task to submit.');
      return;
    }
    if (!taskReportForm.work_performed.trim() && !taskReportForm.remarks.trim()) {
      showToast ? showToast('Please describe the work performed before submitting.', 'error') : alert('Please describe the work performed before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/staff/tasks/${selectedTaskId}/report`, taskReportForm);
      showToast ? showToast('Task completion report submitted successfully for Admin review!', 'success') : alert('Task completion report submitted successfully!');
      
      setTaskReportForm({
        completion_status: 'Fully Completed',
        work_performed: '',
        findings: '',
        remarks: '',
        issues_encountered: '',
        recommended_followup: ''
      });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to submit report';
      showToast ? showToast(msg, 'error') : alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Shift Report
  const handleSubmitShiftReport = async (e) => {
    e.preventDefault();
    if (!shiftForm.declaration_confirmed) {
      showToast ? showToast('Please check the confirmation box before submitting.', 'error') : alert('Please check the confirmation box before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/staff/daily-reports', shiftForm);
      showToast ? showToast('Daily operations shift report submitted successfully!', 'success') : alert('Daily operations report submitted successfully!');
      
      setShiftForm({
        ...shiftForm,
        summary: '',
        remarks: '',
        declaration_confirmed: false
      });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to submit shift report';
      showToast ? showToast(msg, 'error') : alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-emerald-200">
              Operations & Duty Hub
            </span>
            <span className="text-xs text-slate-400 font-bold">• Administrative Review Pipeline</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1">Submit Task & Operations Log</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Submit assigned task completion dossiers and daily shift reports directly to the Administrator Operations Center.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl transition flex items-center space-x-1.5 text-xs font-bold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('task')}
          className={`flex items-center space-x-2 px-4 py-3 font-bold text-xs border-b-2 transition cursor-pointer ${
            activeTab === 'task'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>Submit Assigned Task Completion ({tasks.filter(t => t.status !== 'Completed' && t.status !== 'Reviewed').length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('shift')}
          className={`flex items-center space-x-2 px-4 py-3 font-bold text-xs border-b-2 transition cursor-pointer ${
            activeTab === 'shift'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Daily Shift Operations Log</span>
        </button>
      </div>

      {/* TAB 1: SUBMIT ASSIGNED TASK */}
      {activeTab === 'task' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Send className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Assigned Task Completion Submission</h3>
                <p className="text-[11px] text-slate-500">Record verification findings, actions taken, and request Administrator review.</p>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No tasks currently assigned to you.</p>
                <p className="text-[11px] text-slate-400">When the Administrator assigns duties from Staff Assigned Tasks, they will appear here.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTaskReport} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Select Assigned Task to Submit *</label>
                  <select
                    required
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose an assigned task --</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.priority || 'NORMAL'}] {t.title} — Status: {t.status || 'Pending'} ({t.category || 'Operations'})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTask && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">{selectedTask.title}</span>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700">
                          {selectedTask.category || 'General Duty'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          selectedTask.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' :
                          selectedTask.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {selectedTask.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          Due: {selectedTask.due_date || 'Today'}
                        </span>
                      </div>
                    </div>
                    {selectedTask.description && (
                      <p className="text-slate-600 font-medium text-xs mt-1">{selectedTask.description}</p>
                    )}
                    {selectedTask.instructions && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-700 mt-2 font-mono">
                        <strong className="text-emerald-700">Admin Instructions:</strong> {selectedTask.instructions}
                      </div>
                    )}
                    {selectedTask.admin_review_remarks && (
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-800 mt-2">
                        <strong>Previous Review Remarks:</strong> {selectedTask.admin_review_remarks}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Completion Status</label>
                    <select
                      value={taskReportForm.completion_status}
                      onChange={(e) => setTaskReportForm({ ...taskReportForm, completion_status: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                    >
                      <option value="Fully Completed">Fully Completed</option>
                      <option value="Partially Completed">Partially Completed (Requires follow-up)</option>
                      <option value="Blocked / Issue Encountered">Blocked / Issue Encountered</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Recommended Follow-up (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Schedule re-check on Platform 2"
                      value={taskReportForm.recommended_followup}
                      onChange={(e) => setTaskReportForm({ ...taskReportForm, recommended_followup: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Work Performed / Actions Taken *</label>
                  <textarea
                    rows={3}
                    required
                    value={taskReportForm.work_performed}
                    onChange={(e) => setTaskReportForm({ ...taskReportForm, work_performed: e.target.value })}
                    placeholder="Describe specific actions taken, passengers assisted, coaches inspected, or records updated..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Key Findings & Audit Observations</label>
                    <textarea
                      rows={2}
                      value={taskReportForm.findings}
                      onChange={(e) => setTaskReportForm({ ...taskReportForm, findings: e.target.value })}
                      placeholder="Observation on coach occupancy, verification stats, etc."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Issues or Irregularities Encountered</label>
                    <textarea
                      rows={2}
                      value={taskReportForm.issues_encountered}
                      onChange={(e) => setTaskReportForm({ ...taskReportForm, issues_encountered: e.target.value })}
                      placeholder="Any unverified tickets, AC complaints, or passenger disputes..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? 'Submitting Report...' : 'Submit Task for Admin Review'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* TASKS REPORT STATUS LOG */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-3">Your Tasks Review & Approval Status</h3>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No task records found.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map(t => (
                  <div key={t.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 space-y-2 text-xs">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="font-bold text-slate-900">
                        <span>{t.title}</span>
                        <span className="text-slate-400 text-[10px] ml-2 font-mono">#{t.id}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.status === 'Completed' || t.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        t.status === 'Submitted for Review' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        t.status === 'Needs Follow-up' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        ● {t.status || 'Pending'}
                      </span>
                    </div>
                    {t.completion_remarks && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700">
                        <strong className="text-slate-500 text-[10px] block uppercase">Submitted Report:</strong>
                        <p className="font-medium mt-0.5">{t.completion_remarks}</p>
                      </div>
                    )}
                    {t.admin_review_remarks && (
                      <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-purple-900">
                        <strong className="text-purple-700 text-[10px] block uppercase">Admin Review Feedback:</strong>
                        <p className="font-semibold mt-0.5">{t.admin_review_remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY SHIFT OPERATIONS REPORT */}
      {activeTab === 'shift' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">New Internal Daily Operations Report</h3>
                <p className="text-[11px] text-slate-500">Record your shift operations summary, verification counters, and metrics.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitShiftReport} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Report Date</label>
                  <input
                    type="date"
                    required
                    value={shiftForm.report_date}
                    onChange={(e) => setShiftForm({ ...shiftForm, report_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Staff Member</label>
                  <input
                    type="text"
                    readOnly
                    value={user?.full_name || 'Staff Member'}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Shift</label>
                  <input
                    type="text"
                    value={shiftForm.shift}
                    onChange={(e) => setShiftForm({ ...shiftForm, shift: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tasks Done</label>
                  <input
                    type="number"
                    value={shiftForm.assigned_tasks_completed}
                    onChange={(e) => setShiftForm({ ...shiftForm, assigned_tasks_completed: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tickets Verified</label>
                  <input
                    type="number"
                    value={shiftForm.tickets_verified}
                    onChange={(e) => setShiftForm({ ...shiftForm, tickets_verified: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Requests Handled</label>
                  <input
                    type="number"
                    value={shiftForm.passenger_requests_handled}
                    onChange={(e) => setShiftForm({ ...shiftForm, passenger_requests_handled: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Issues Reported</label>
                  <input
                    type="number"
                    value={shiftForm.incidents_handled}
                    onChange={(e) => setShiftForm({ ...shiftForm, incidents_handled: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Catering Orders</label>
                  <input
                    type="number"
                    value={shiftForm.catering_orders_handled}
                    onChange={(e) => setShiftForm({ ...shiftForm, catering_orders_handled: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Shift Operations Summary *</label>
                <textarea
                  rows={3}
                  required
                  value={shiftForm.summary}
                  onChange={(e) => setShiftForm({ ...shiftForm, summary: e.target.value })}
                  placeholder="Summary of website management tasks completed during your shift..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Remarks & Additional Notes</label>
                <textarea
                  rows={2}
                  value={shiftForm.remarks}
                  onChange={(e) => setShiftForm({ ...shiftForm, remarks: e.target.value })}
                  placeholder="Any additional remarks..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="decl"
                  checked={shiftForm.declaration_confirmed}
                  onChange={(e) => setShiftForm({ ...shiftForm, declaration_confirmed: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="decl" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  I confirm that this report accurately reflects my internal website operations completed today.
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-95"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? 'Submitting...' : 'Submit Daily Operations Log'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* PAST SHIFT REPORTS LIST */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-3">Submitted Shift Logs</h3>

            {reports.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center font-medium">No previous reports found.</p>
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span>{r.report_date} • {r.shift}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed font-medium">
                      {r.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffDailyReport;
