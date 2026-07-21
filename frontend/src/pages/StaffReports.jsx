import React from 'react';
import { FileText, Download, TrendingUp, Users, Train, IndianRupee } from 'lucide-react';

const StaffReports = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Reports & Analytics</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Export station dispatches summaries, seat occupancy stats, and revenue audits logs.</p>
        </div>
        <button
          onClick={() => alert('Preparing PDF summary report for download...')}
          className="flex items-center space-x-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 text-xs font-black shadow-lg shadow-primary-500/20 active:scale-95 transition"
        >
          <Download className="h-4.5 w-4.5" />
          <span>Export All Reports</span>
        </button>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Weekly Revenue', value: '₹ 59,16,840', change: '+12.4% vs last week', color: 'text-purple-600 bg-purple-500/10', icon: IndianRupee },
          { title: 'Avg Occupancy', value: '92.4%', change: '+3.1% vs average load', color: 'text-emerald-600 bg-emerald-500/10', icon: TrendingUp },
          { title: 'Daily Passengers', value: '3,842', change: '+200 passengers today', color: 'text-amber-600 bg-amber-500/10', icon: Users },
          { title: 'Dispatched Trains', value: '28 Trains', change: '100% schedule fulfillment', color: 'text-blue-600 bg-blue-500/10', icon: Train }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/70 p-5 rounded-3xl flex flex-col justify-between shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{item.title}</span>
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${item.color} font-bold`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-slate-800 tracking-tight">{item.value}</p>
                <p className="text-[9.5px] text-emerald-600 font-bold mt-1.5">{item.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Stats Section */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-black text-slate-850">Platform Occupancy Details</h3>
          
          <div className="space-y-4">
            {[
              { pf: 'Platform 1', load: '95%', color: 'bg-emerald-500' },
              { pf: 'Platform 2', load: '82%', color: 'bg-emerald-500' },
              { pf: 'Platform 3', load: '64%', color: 'bg-amber-500' },
              { pf: 'Platform 4', load: '45%', color: 'bg-amber-500' }
            ].map((p, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{p.pf}</span>
                  <span>{p.load} utilization</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${p.color}`} style={{ width: p.load }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right download reports row */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-850">Recent Generated Reports</h3>
          
          <div className="space-y-3">
            {[
              { name: 'Daily Revenue Statement', size: '2.4 MB', date: '17 July 2026' },
              { name: 'Weekly Occupancy Summary', size: '1.8 MB', date: '14 July 2026' },
              { name: 'Station Train Dispatch Logs', size: '5.2 MB', date: '10 July 2026' },
              { name: 'Refund Dispute Claims List', size: '940 KB', date: '08 July 2026' }
            ].map((rep, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 rounded-2xl hover:border-primary-400/40 cursor-pointer transition group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 group-hover:text-primary-800 transition-colors block leading-tight">{rep.name}</span>
                    <span className="text-[9.5px] text-slate-400 font-bold block mt-1">{rep.date} &bull; {rep.size}</span>
                  </div>
                </div>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-primary-500 transition" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StaffReports;
