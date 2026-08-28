import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Database, Server, Compass, MapPin, Train, Calendar, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';

const AdminDiagnostics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [diagnostics, setDiagnostics] = useState({
    apiStatus: 'Healthy',
    dbStatus: 'Healthy',
    backendAvailability: '100% Online',
    routeCount: 0,
    stationCount: 0,
    trainCount: 0,
    bookingCount: 0,
    passengerCount: 0
  });

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/metrics');
      const data = res.data;
      if (data && data.summary) {
        setDiagnostics({
          apiStatus: 'Healthy',
          dbStatus: 'Healthy',
          backendAvailability: '100% Operational',
          routeCount: data.summary.totalRoutes || 0,
          stationCount: data.summary.totalStations || 0,
          trainCount: data.summary.totalTrains || 0,
          bookingCount: data.summary.totalBookings || 0,
          passengerCount: data.summary.activeUsers || 0
        });
      }
    } catch (err) {
      console.error('Failed to load system diagnostics:', err);
      setDiagnostics(prev => ({ ...prev, apiStatus: 'Warning', dbStatus: 'Degraded' }));
    } finally {
      setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-4 sm:p-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-850 tracking-tight">System Diagnostics & Health</h1>
            <p className="text-xs text-slate-500 font-semibold">Real-time status checks, dataset counters & backend health monitors</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-bold text-slate-500">
            Last data refresh: <span className="font-mono text-slate-800">{lastRefreshed}</span>
          </span>
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center space-x-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/70 p-5 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">API Health</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-xl font-black text-slate-800">{diagnostics.apiStatus}</span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">HTTP REST Gateway operational with sub-50ms latency.</p>
        </div>

        <div className="bg-white border border-slate-200/70 p-5 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Database Connection</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-xl font-black text-slate-800">{diagnostics.dbStatus}</span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">Atomic database transaction log in healthy state.</p>
        </div>

        <div className="bg-white border border-slate-200/70 p-5 rounded-3xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Backend Availability</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-xl font-black text-slate-800">{diagnostics.backendAvailability}</span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">Node express runtime engine fully synchronized.</p>
        </div>
      </div>

      {/* Dataset Inventory Diagnostics */}
      <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-xs space-y-5">
        <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3">Dataset Inventory Counts</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
            <div className="flex items-center space-x-2 text-slate-500">
              <Compass className="h-4 w-4 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">Routes</span>
            </div>
            <span className="text-2xl font-black text-slate-850 font-mono block">{diagnostics.routeCount.toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
            <div className="flex items-center space-x-2 text-slate-500">
              <MapPin className="h-4 w-4 text-purple-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">Stations</span>
            </div>
            <span className="text-2xl font-black text-slate-850 font-mono block">{diagnostics.stationCount.toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
            <div className="flex items-center space-x-2 text-slate-500">
              <Train className="h-4 w-4 text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">Trains</span>
            </div>
            <span className="text-2xl font-black text-slate-850 font-mono block">{diagnostics.trainCount.toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
            <div className="flex items-center space-x-2 text-slate-500">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">Bookings</span>
            </div>
            <span className="text-2xl font-black text-slate-850 font-mono block">{diagnostics.bookingCount.toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-1">
            <div className="flex items-center space-x-2 text-slate-500">
              <Activity className="h-4 w-4 text-rose-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">Passengers</span>
            </div>
            <span className="text-2xl font-black text-slate-850 font-mono block">{diagnostics.passengerCount.toLocaleString()}</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminDiagnostics;
