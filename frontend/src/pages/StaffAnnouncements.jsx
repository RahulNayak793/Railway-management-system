import React, { useState } from 'react';
import { Megaphone, Plus, Bell, Volume2, Calendar, Trash2 } from 'lucide-react';

const StaffAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([
    { id: 1, text: 'National Railway Enquiry: TATKAL reservation counters open daily at 10:00 AM.', date: '17 July 2026', author: 'Station Admin', active: true },
    { id: 2, text: 'Platform Change: Train 12628 Karnataka Express will arrive on Platform 4 today.', date: '17 July 2026', author: 'Station Dispatch', active: true },
    { id: 3, text: 'Safety Warning: Passengers are requested to stay clear of the platform edge.', date: '16 July 2026', author: 'Security Team', active: true },
    { id: 4, text: 'Maintenance Notice: Structural repairs on Platform 3 completed successfully.', date: '15 July 2026', author: 'Maintenance Chief', active: false }
  ]);

  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState('General');

  const handlePublish = (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;

    const item = {
      id: Date.now(),
      text: `${announcementCategory} Announcement: ${newAnnouncement}`,
      date: '17 July 2026',
      author: 'Station Staff',
      active: true
    };

    setAnnouncements(prev => [item, ...prev]);
    setNewAnnouncement('');
    alert('Announcement published to public ticker and station displays!');
  };

  const removeAnnouncement = (id) => {
    setAnnouncements(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Station Announcements</h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">Compose and publish emergency delays alerts, platform modifications, and passenger instructions.</p>
      </div>

      {/* Compose Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column compose form */}
        <div className="lg:col-span-1 bg-white border border-slate-200/70 p-5 rounded-3xl shadow-sm space-y-4 self-start">
          <h3 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
            <Plus className="h-4.5 w-4.5 text-primary-600" />
            <span>Compose Announcement</span>
          </h3>

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Category</label>
              <select
                value={announcementCategory}
                onChange={(e) => setAnnouncementCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 cursor-pointer"
              >
                <option value="General">General Broadcast</option>
                <option value="Delay Alert">Train Delay Notice</option>
                <option value="Platform Change">Platform Change Notice</option>
                <option value="Emergency Warning">Security / Emergency</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Announcement Message</label>
              <textarea
                rows="4"
                placeholder="Type the announcement details to display..."
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 placeholder:text-slate-400"
                required
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-5 py-2.5 text-xs font-black shadow-lg shadow-primary-500/25 active:scale-95 transition flex items-center justify-center space-x-1.5 border border-primary-600/10"
            >
              <Megaphone className="h-4.5 w-4.5" />
              <span>Publish Announcement</span>
            </button>
          </form>
        </div>

        {/* Right column active feed log */}
        <div className="lg:col-span-2 bg-white border border-slate-200/70 p-5 rounded-3xl shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-850 flex items-center gap-1.5">
            <Volume2 className="h-4.5 w-4.5 text-rose-500" />
            <span>Active Broadcast Logs</span>
          </h3>

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <p className="text-center py-8 text-xs font-bold text-slate-400">No active announcements broadcasted</p>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className="p-4 border border-slate-100 rounded-2xl flex justify-between items-start hover:border-slate-200 transition group">
                  <div className="space-y-2 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        ann.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {ann.active ? 'Active Display' : 'Archived'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {ann.date} &bull; By {ann.author}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{ann.text}</p>
                  </div>
                  <button
                    onClick={() => removeAnnouncement(ann.id)}
                    className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Remove announcement"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default StaffAnnouncements;
