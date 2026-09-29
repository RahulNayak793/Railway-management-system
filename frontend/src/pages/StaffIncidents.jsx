import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

const ISSUE_CATEGORIES = [
  'Passenger Service Issue',
  'Booking Issue',
  'Train Information Issue',
  'Catering Issue',
  'Website/System Issue'
];

const StaffIncidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: 'Passenger Service Issue',
    severity: 'MEDIUM',
    train_number: '12951',
    station_code: 'NDLS',
    location: 'System Data Record',
    description: '',
    action_taken: 'Logged internal service issue report.'
  });

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/incidents');
      if (Array.isArray(res.data)) {
        setIncidents(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch service issue reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) return;

    setSubmitting(true);
    try {
      await api.post('/staff/incidents', form);
      alert('Service issue report submitted successfully!');
      setShowModal(false);
      fetchIncidents();
      setForm({
        title: '',
        category: 'Passenger Service Issue',
        severity: 'MEDIUM',
        train_number: '12951',
        station_code: 'NDLS',
        location: 'System Data Record',
        description: '',
        action_taken: 'Logged internal service issue report.'
      });
    } catch (err) {
      alert('Failed to submit issue report: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Service & System Issue Reports</h1>
          <p className="text-xs text-slate-500 font-medium">Log passenger service issues, booking anomalies, train information issues, catering issues, or website bugs.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={fetchIncidents} className="p-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition flex items-center space-x-1 text-xs font-bold shadow-sm">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button onClick={() => setShowModal(true)} className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Report Issue</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-3">Recorded System & Service Issues ({incidents.length})</h3>

        {incidents.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center font-medium">No service or system issue reports filed.</p>
        ) : (
          <div className="space-y-3">
            {incidents.map(inc => (
              <div key={inc.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      inc.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : inc.severity === 'HIGH' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      {inc.severity} SEVERITY
                    </span>
                    <span className="text-xs font-black text-slate-800">{inc.title}</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">
                    STATUS: {inc.status || 'OPEN'}
                  </span>
                </div>

                <div className="flex items-center space-x-4 text-[10px] text-slate-400 font-medium">
                  <span>Category: <strong>{inc.category}</strong></span>
                  <span>Train: <strong>{inc.train_number}</strong></span>
                  <span>Station: <strong>{inc.station_code}</strong></span>
                  <span>Reported By: <strong>{inc.reported_by_name}</strong></span>
                </div>

                <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed font-medium">
                  {inc.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <h3 className="text-base font-black text-slate-800">Report Service or System Issue</h3>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Issue Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Booking PNR status discrepancy"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {ISSUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Provide detailed description of the service or system issue..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffIncidents;
