import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Filter, RefreshCw, Download, 
  CheckCircle, Clock, Eye, AlertCircle, Calendar, User, 
  CheckSquare, Activity, PhoneCall, ShieldAlert, ShoppingBag, Train, FileSpreadsheet
} from 'lucide-react';
import api from '../services/api';

const AdminStaffReports = () => {
  const [loading, setLoading] = useState(true);
  const [taskList, setTaskList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [summary, setSummary] = useState({
    submitted_reports: 0,
    pending_review: 0,
    needs_followup: 0,
    reviewed: 0
  });

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedReportModal, setSelectedReportModal] = useState(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(null);
  const [adminRemarksInput, setAdminRemarksInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const [dailyRes, tasksRes, rosterRes] = await Promise.all([
        api.get('/staff/daily-reports').catch(err => {
          console.warn('Could not fetch daily-reports:', err.message);
          return { data: [] };
        }),
        api.get('/staff/tasks').catch(err => {
          console.warn('Could not fetch tasks:', err.message);
          return { data: [] };
        }),
        api.get('/staff/admin-roster').catch(err => {
          console.warn('Could not fetch admin-roster:', err.message);
          return { data: { staff: [] } };
        })
      ]);

      const dailyItems = Array.isArray(dailyRes.data) ? dailyRes.data.map(r => {
        const rawStatus = (r.status || 'SUBMITTED').toUpperCase();
        let revStatus = 'PENDING_REVIEW';
        if (rawStatus === 'REVIEWED' || rawStatus === 'APPROVED') revStatus = 'REVIEWED';
        else if (rawStatus === 'FOLLOWUP_REQUESTED' || rawStatus === 'NEEDS_FOLLOW_UP' || rawStatus === 'NEEDS FOLLOW-UP') revStatus = 'FOLLOWUP_REQUESTED';

        return {
          id: r.id,
          report_type: 'DAILY',
          type_label: 'Daily Shift Log',
          report_code: r.id.startsWith('rep-') ? `DLR-${r.id.replace('rep-', '').slice(-6)}` : `DLR-${r.id}`,
          staff_id: r.staff_id,
          staff_name: r.staff_name || 'Staff Member',
          employee_id: r.employee_id || `EMP-${r.staff_id}`,
          department: r.department || 'Operations',
          title: `Daily Operations Report (${r.shift || 'Shift Log'})`,
          report_date: r.report_date || (r.created_at ? r.created_at.split('T')[0] : 'Today'),
          shift: r.shift || 'Morning Shift (06:00 - 14:00)',
          assigned_train: r.assigned_train || '12951 - Rajdhani Express',
          assigned_station: r.assigned_station || 'NDLS',
          
          // Operational Metrics
          assigned_tasks_completed: r.assigned_tasks_completed ?? r.trains_handled ?? 4,
          tickets_verified: r.tickets_verified ?? 95,
          passenger_requests_handled: r.passenger_requests_handled ?? r.passengers_handled ?? 12,
          incidents_handled: r.incidents_handled ?? 1,
          catering_orders_handled: r.catering_orders_handled ?? 15,
          rac_wl_handled: r.rac_wl_handled ?? 12,
          delays_observed: r.delays_observed ?? 0,

          summary: r.summary || 'All internal website management tasks were completed smoothly during shift.',
          remarks: r.remarks || r.actions_taken || '',
          delay_details: r.delay_details,
          pending_issues: r.pending_issues,

          submitted_at: r.submitted_at || r.created_at || new Date().toISOString(),
          status: rawStatus,
          report_status: revStatus,
          reviewed_by: r.reviewed_by || null,
          admin_remarks: r.admin_remarks || r.review_comments || '',
          raw: r
        };
      }) : [];

      const taskItems = Array.isArray(tasksRes.data) ? tasksRes.data
        .filter(t => t.completion_report || t.status === 'REPORT_SUBMITTED' || t.report_status || t.status === 'Submitted for Review' || t.status === 'Completed' || t.status === 'Reviewed' || t.status === 'Needs Follow-up')
        .map(t => {
          const rawStatus = (t.admin_review_status || t.report_status || t.status || '').toUpperCase().replace(/[\s-]/g, '_');
          let revStatus = 'PENDING_REVIEW';
          if (rawStatus === 'REVIEWED' || rawStatus === 'APPROVED' || t.status === 'Reviewed') revStatus = 'REVIEWED';
          else if (rawStatus === 'NEEDS_FOLLOW_UP' || rawStatus === 'FOLLOWUP_REQUESTED' || t.status === 'Needs Follow-up') revStatus = 'FOLLOWUP_REQUESTED';

          return {
            id: t.id,
            report_type: 'DUTY',
            type_label: 'Duty Completion',
            report_code: t.task_code || (t.id.startsWith('tsk-') ? `TSK-${t.id.replace('tsk-', '').slice(-6)}` : `REP-${t.id}`),
            staff_id: t.staff_id,
            staff_name: t.staff_name || `Staff #${t.staff_id}`,
            employee_id: t.employee_id || `EMP-${t.staff_id}`,
            department: t.department || 'Passenger Services',
            title: t.title || 'Assigned Duty Task',
            category: t.category || t.task_type || 'Duty',
            priority: t.priority || 'MEDIUM',

            summary: t.completion_report?.work_performed || t.completion_report?.remarks || t.completion_remarks || t.remarks || 'Duty task completed successfully.',
            findings: t.completion_report?.findings,
            issues_encountered: t.completion_report?.issues_encountered,

            submitted_at: t.completion_report?.submitted_at || t.updated_at || t.created_at || new Date().toISOString(),
            status: t.status || 'Submitted for Review',
            report_status: revStatus,
            reviewed_by: t.reviewed_by || null,
            admin_remarks: t.admin_review_remarks || t.admin_remarks || '',
            raw: t
          };
        }) : [];

      const unified = [...dailyItems, ...taskItems].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
      setTaskList(unified);

      setSummary({
        submitted_reports: unified.length,
        pending_review: unified.filter(r => r.report_status === 'PENDING_REVIEW').length,
        needs_followup: unified.filter(r => r.report_status === 'FOLLOWUP_REQUESTED').length,
        reviewed: unified.filter(r => r.report_status === 'REVIEWED').length
      });

      if (rosterRes.data && Array.isArray(rosterRes.data.staff)) {
        setStaffList(rosterRes.data.staff);
      }
    } catch (err) {
      console.error('Failed to fetch staff reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  const handleReviewStatusUpdate = async (item, newStatus, remarks = '') => {
    if (!item) return;
    setSaving(true);
    try {
      let res;
      if (item.report_type === 'DAILY') {
        res = await api.post(`/staff/admin-reports/${item.id}/review`, {
          status: newStatus,
          admin_remarks: remarks,
          review_comments: remarks,
          action: newStatus === 'FOLLOWUP_REQUESTED' ? 'REQUEST_FOLLOW_UP' : 'REVIEW'
        });
      } else {
        res = await api.post(`/staff/tasks/${item.id}/review`, {
          status: newStatus,
          admin_review_remarks: remarks,
          action: newStatus === 'FOLLOWUP_REQUESTED' ? 'REQUEST_FOLLOW_UP' : 'REVIEW'
        });
      }

      if (res.data && (res.data.success || res.status === 200)) {
        alert(`Report updated to: ${newStatus === 'REVIEWED' ? 'Reviewed & Approved' : 'Follow-up Requested'}`);
        setSelectedReportModal(null);
        setShowFollowUpModal(null);
        setAdminRemarksInput('');
        fetchReportsData();
      } else {
        alert(res.data?.message || res.data?.error || 'Failed to update report review status');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || err.message || 'Error saving review');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      alert('No report data available to export.');
      return;
    }
    const headers = ['Report Code', 'Type', 'Staff ID', 'Staff Name', 'Duty / Title', 'Submitted Date', 'Review Status', 'Work Summary', 'Admin Remarks'];
    const rows = filteredReports.map(t => [
      t.report_code,
      t.type_label,
      t.staff_id,
      `"${t.staff_name || ''}"`,
      `"${t.title || ''}"`,
      new Date(t.submitted_at).toLocaleString(),
      t.report_status,
      `"${(t.summary || '').replace(/"/g, '""')}"`,
      `"${(t.admin_remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Staff_Reports_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered reports
  const filteredReports = taskList.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      item.title?.toLowerCase().includes(query) ||
      item.staff_name?.toLowerCase().includes(query) ||
      item.report_code?.toLowerCase().includes(query) ||
      item.summary?.toLowerCase().includes(query) ||
      item.remarks?.toLowerCase().includes(query) ||
      item.findings?.toLowerCase().includes(query) ||
      item.shift?.toLowerCase().includes(query);

    const matchesType = typeFilter === 'ALL' || item.report_type === typeFilter;

    const matchesStaff = staffFilter === 'ALL' || 
      String(item.staff_id) === String(staffFilter) || 
      item.staff_name?.toLowerCase().includes(String(staffFilter).toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      matchesStatus = item.report_status === statusFilter;
    }

    return matchesSearch && matchesType && matchesStaff && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-purple-600/30 border border-purple-400/30 rounded-2xl text-purple-300 shadow-inner">
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Railway Operational Audit & Reviews
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
                Staff Submitted Tasks & Reports
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                Review internal daily operations logs, duty completion reports, operational metrics and issue follow-ups.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-auto">
            <button
              onClick={fetchReportsData}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition border border-white/15 flex items-center justify-center"
              title="Refresh Reports"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-purple-600/30 flex items-center space-x-2 border border-purple-400/30"
            >
              <Download className="h-4 w-4" />
              <span>Export Reports CSV</span>
            </button>
          </div>
        </div>

        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-1">
              <span>Total Reports Submitted</span>
              <FileText className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{summary.submitted_reports}</div>
            <span className="text-[10px] text-slate-400 font-medium">Daily shift logs & task reports</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-amber-300 text-xs font-bold mb-1">
              <span>Pending Review</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">{summary.pending_review}</div>
            <span className="text-[10px] text-slate-400 font-medium">Awaiting administrator action</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-rose-300 text-xs font-bold mb-1">
              <span>Needs Follow-up</span>
              <AlertCircle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-300 font-mono">{summary.needs_followup}</div>
            <span className="text-[10px] text-slate-400 font-medium">Clarification requested</span>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold mb-1">
              <span>Reviewed & Approved</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-300 font-mono">{summary.reviewed}</div>
            <span className="text-[10px] text-slate-400 font-medium">Verified & closed</span>
          </div>
        </div>
      </div>

      {/* MAIN TABLE CONTENT */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        {/* FILTERS BAR */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports by staff, code, shift, summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto text-xs">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Report Types</option>
              <option value="DAILY">Daily Shift Logs</option>
              <option value="DUTY">Duty Completion Reports</option>
            </select>

            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Staff Members</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.full_name || s.username}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Review Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="REVIEWED">Reviewed & Approved</option>
              <option value="FOLLOWUP_REQUESTED">Needs Follow-up</option>
            </select>
          </div>
        </div>

        {/* REPORTS TABLE */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-r-transparent" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Staff Reports Submitted</h3>
            <p className="text-xs text-slate-500 mt-1">Submitted daily operational reports and task reviews will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Report Code</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Staff Member</th>
                  <th className="p-4">Report / Duty Title</th>
                  <th className="p-4">Submitted Date</th>
                  <th className="p-4">Review Status</th>
                  <th className="p-4">Reviewed By</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredReports.map((item) => {
                  const reviewStatus = item.report_status;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-mono font-bold text-purple-700">
                        {item.report_code}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.report_type === 'DAILY' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {item.type_label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-black text-slate-900">{item.staff_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {item.employee_id || item.staff_id}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 max-w-xs truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{item.shift || item.category || 'Operations'}</div>
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap">
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          reviewStatus === 'REVIEWED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          reviewStatus === 'FOLLOWUP_REQUESTED' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          ● {reviewStatus === 'REVIEWED' ? 'REVIEWED & APPROVED' : reviewStatus === 'FOLLOWUP_REQUESTED' ? 'NEEDS FOLLOW-UP' : 'PENDING REVIEW'}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-600 whitespace-nowrap">
                        {item.reviewed_by || (reviewStatus === 'REVIEWED' ? 'System Admin' : '-')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedReportModal(item)}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-xs flex items-center space-x-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View & Review</span>
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

      {/* REPORT DETAIL & REVIEW MODAL */}
      {selectedReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            
            {/* MODAL HEADER */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-slate-900">Staff Operational Report Review</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800">
                      {selectedReportModal.type_label}
                    </span>
                  </div>
                  <p className="text-xs text-purple-700 font-mono font-bold">{selectedReportModal.report_code}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReportModal(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* SECTIONS */}
            <div className="space-y-6 text-xs">
              
              {/* SECTION 1: STAFF INFORMATION */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Section 1: Staff Member Context</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Staff Name</span>
                    <span className="font-black text-slate-900">{selectedReportModal.staff_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Employee ID</span>
                    <span className="font-mono font-bold text-slate-800">{selectedReportModal.employee_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Department</span>
                    <span className="font-bold text-slate-700">{selectedReportModal.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Report Date</span>
                    <span className="font-bold text-slate-700">{selectedReportModal.report_date || 'Today'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: OPERATIONAL METRICS (FOR DAILY REPORTS) */}
              {selectedReportModal.report_type === 'DAILY' && (
                <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white p-4 rounded-2xl border border-purple-800 space-y-3 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-purple-300">Section 2: Shift Operational Metrics</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                      <CheckSquare className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-300 font-bold block">Tasks Done</span>
                      <span className="text-lg font-black font-mono">{selectedReportModal.assigned_tasks_completed}</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                      <Activity className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-300 font-bold block">Tickets Verified</span>
                      <span className="text-lg font-black font-mono">{selectedReportModal.tickets_verified}</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                      <PhoneCall className="h-4 w-4 text-purple-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-300 font-bold block">Requests</span>
                      <span className="text-lg font-black font-mono">{selectedReportModal.passenger_requests_handled}</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                      <ShieldAlert className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-300 font-bold block">Issues</span>
                      <span className="text-lg font-black font-mono">{selectedReportModal.incidents_handled}</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                      <ShoppingBag className="h-4 w-4 text-rose-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-300 font-bold block">Catering</span>
                      <span className="text-lg font-black font-mono">{selectedReportModal.catering_orders_handled}</span>
                    </div>
                    <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                      <Train className="h-4 w-4 text-indigo-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-300 font-bold block">RAC/WL</span>
                      <span className="text-lg font-black font-mono">{selectedReportModal.rac_wl_handled}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: WORK LOG & SUMMARY */}
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-purple-700">Section 3: Staff Operations Summary & Log</h4>
                  <span className="text-[10px] font-bold text-purple-700">
                    Submitted: {new Date(selectedReportModal.submitted_at).toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Work Performed / Summary</span>
                  <p className="text-slate-900 font-medium bg-white p-3 rounded-xl border border-purple-200 leading-relaxed mt-1">
                    {selectedReportModal.summary}
                  </p>
                </div>

                {selectedReportModal.remarks && (
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Staff Remarks & Notes</span>
                    <p className="text-slate-800 font-medium bg-white p-3 rounded-xl border border-purple-200 mt-1">
                      {selectedReportModal.remarks}
                    </p>
                  </div>
                )}

                {selectedReportModal.findings && (
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Findings & Operational Analysis</span>
                    <p className="text-slate-800 font-medium bg-white p-3 rounded-xl border border-purple-200 mt-1">
                      {selectedReportModal.findings}
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION 4: ADMIN REVIEW STATUS & REMARKS */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Section 4: Administrator Audit & Review</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Review Status</span>
                    <span className="font-black text-slate-800">{selectedReportModal.report_status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Reviewed By</span>
                    <span className="font-bold text-slate-700">{selectedReportModal.reviewed_by || 'Not yet reviewed'}</span>
                  </div>
                </div>
                {selectedReportModal.admin_remarks && (
                  <div className="pt-2">
                    <span className="text-slate-400 block text-[10px] font-bold">Admin Remarks</span>
                    <p className="text-slate-800 font-medium bg-white p-2.5 rounded-xl border border-slate-200 italic mt-0.5">
                      "{selectedReportModal.admin_remarks}"
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReportModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition text-xs"
              >
                Close
              </button>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(selectedReportModal)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs transition border border-rose-200"
                >
                  Request Follow-up
                </button>
                
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleReviewStatusUpdate(selectedReportModal, 'REVIEWED', 'Verified and approved by System Administrator.')}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20"
                >
                  {saving ? 'Updating...' : 'Mark as Reviewed & Approved'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* REQUEST FOLLOW-UP MODAL */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Request Follow-up from Staff</h3>
              <button onClick={() => setShowFollowUpModal(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            
            <p className="text-xs text-slate-600 font-medium">
              Enter specific instructions or clarification requested from {showFollowUpModal.staff_name}.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Admin Remarks (Required) *</label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Please verify ticket verification logs for Morning Shift."
                value={adminRemarksInput}
                onChange={(e) => setAdminRemarksInput(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !adminRemarksInput.trim()}
                onClick={() => handleReviewStatusUpdate(showFollowUpModal, 'FOLLOWUP_REQUESTED', adminRemarksInput)}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md shadow-rose-600/20"
              >
                {saving ? 'Sending...' : 'Send Follow-up Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaffReports;
