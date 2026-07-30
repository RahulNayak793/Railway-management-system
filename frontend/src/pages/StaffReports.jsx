import React, { useState } from 'react';
import { 
  FileText, Download, TrendingUp, Users, Train, IndianRupee, 
  CheckCircle2, Filter, FileSpreadsheet, Printer, RefreshCw, Layers
} from 'lucide-react';

const StaffReports = () => {
  const [downloading, setDownloading] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  const reportFiles = [
    { id: 'rep1', name: 'Daily Revenue Statement & Payment Audits', size: '2.4 MB', date: '29 July 2026', type: 'CSV' },
    { id: 'rep2', name: 'Weekly Seat Occupancy & Class Allocation Summary', size: '1.8 MB', date: '28 July 2026', type: 'PDF' },
    { id: 'rep3', name: 'Station Train Dispatch Logs & Delay Metrics', size: '5.2 MB', date: '25 July 2026', type: 'CSV' },
    { id: 'rep4', name: 'Passenger Master Manifest & Verification Audit', size: '3.1 MB', date: '22 July 2026', type: 'CSV' },
    { id: 'rep5', name: 'Refund Disputes & Cancellation Ledger', size: '940 KB', date: '20 July 2026', type: 'PDF' }
  ];

  const handleDownload = (report) => {
    setDownloading(report.id);
    setTimeout(() => {
      setDownloading(null);
      setDownloadSuccess(report.name);
      
      // Simulate CSV file download in browser
      const sampleData = `Report Name,${report.name}\nGenerated Date,${report.date}\nFile Size,${report.size}\nStatus,Verified Operational Audit\n`;
      const blob = new Blob([sampleData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.toLowerCase().replace(/ /g, '_')}_${report.date.replace(/ /g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => setDownloadSuccess(null), 3500);
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-blue-200">
              Staff Control Center
            </span>
            <span className="text-xs text-slate-400 font-bold">• Operations & Analytics</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Operational Reports & Export Engine
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Export station dispatches, passenger manifests, seat load factors, and revenue audit logs to CSV/PDF.
          </p>
        </div>

        <button
          onClick={() => handleDownload({ id: 'all', name: 'Master_Railway_Operations_Audit', size: '12.5 MB', date: '29 July 2026' })}
          className="flex items-center space-x-2 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 text-xs font-black shadow-md shadow-primary-500/20 active:scale-95 transition border border-primary-500"
        >
          <Download className="h-4 w-4" />
          <span>Export Master Operations Pack</span>
        </button>
      </div>

      {downloadSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between animate-slide-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Report "{downloadSuccess}" downloaded to your device successfully!</span>
          </div>
          <button onClick={() => setDownloadSuccess(null)} className="text-emerald-700 font-black">✕</button>
        </div>
      )}

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Weekly Revenue Audit', value: '₹59,16,840', change: '+12.4% vs last week', color: 'text-purple-600 bg-purple-500/10 border-purple-100', icon: IndianRupee },
          { title: 'Avg Seat Load Factor', value: '92.4%', change: '+3.1% vs average load', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-100', icon: TrendingUp },
          { title: 'Daily Passenger Flow', value: '3,842', change: '+200 passengers today', color: 'text-amber-600 bg-amber-500/10 border-amber-100', icon: Users },
          { title: 'Active Train Dispatches', value: '28 Trains', change: '100% schedule fulfillment', color: 'text-blue-600 bg-blue-500/10 border-blue-100', icon: Train }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/80 p-4 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{item.title}</span>
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${item.color} font-bold`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-black text-slate-800 tracking-tight">{item.value}</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">{item.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Stats Section */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Platform & Schedule Utilization</h3>
            <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Live Telemetry</span>
          </div>
          
          <div className="space-y-4">
            {[
              { pf: 'Platform 1 (NDLS - Main Corridor)', load: '95%', color: 'bg-emerald-500' },
              { pf: 'Platform 2 (MMCT - Western Express)', load: '82%', color: 'bg-emerald-500' },
              { pf: 'Platform 3 (SBC - Southern Corridor)', load: '64%', color: 'bg-amber-500' },
              { pf: 'Platform 4 (HWH - Eastern Line)', load: '45%', color: 'bg-amber-500' }
            ].map((p, idx) => (
              <div key={idx} className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{p.pf}</span>
                  <span className="font-mono text-primary-700 font-black">{p.load} utilization</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${p.color}`} style={{ width: p.load }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right download reports row */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Generated System Manifests</h3>
            <FileSpreadsheet className="h-4 w-4 text-slate-400" />
          </div>
          
          <div className="space-y-3">
            {reportFiles.map(rep => (
              <div 
                key={rep.id} 
                onClick={() => handleDownload(rep)}
                className="flex justify-between items-center p-3.5 border border-slate-200 rounded-2xl hover:border-primary-400 hover:bg-slate-50/60 cursor-pointer transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-primary-50 group-hover:text-primary-600 transition">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 group-hover:text-primary-700 transition block leading-tight">{rep.name}</span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-1">{rep.date} &bull; {rep.size}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {rep.type}
                  </span>
                  {downloading === rep.id ? (
                    <RefreshCw className="h-4 w-4 text-primary-600 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 text-slate-400 group-hover:text-primary-600 transition" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StaffReports;
