import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Bell, Volume2, Calendar, Trash2, Radio, Play, StopCircle } from 'lucide-react';

const StaffAnnouncements = () => {
  const [announcements, setAnnouncements] = useState(() => {
    const saved = localStorage.getItem('railway_announcements');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: 1, text: 'IRCTC Advisory: TATKAL reservation counters open daily at 10:00 AM for AC classes.', date: 'Today', author: 'Station Admin', active: true, lang: 'en' },
      { id: 2, text: 'Platform Change: Train 12952 Mumbai Rajdhani Express will arrive on Platform 1.', date: 'Today', author: 'Station Dispatch', active: true, lang: 'en' },
      { id: 3, text: 'यात्री ध्यान दें: गाड़ी संख्या 12952 मुम्बई राजधानी एक्सप्रेस प्लेटफार्म नंबर 1 पर आ रही है।', date: 'Today', author: 'Hindi Broadcaster', active: true, lang: 'hi' },
      { id: 4, text: 'Safety Warning: Passengers are requested to stay clear of yellow platform edge markings.', date: 'Yesterday', author: 'Security Command', active: false, lang: 'en' }
    ];
  });

  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState('Platform Change');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Sync with localStorage & dispatch custom window event for instant passenger update
  useEffect(() => {
    localStorage.setItem('railway_announcements', JSON.stringify(announcements));
    window.dispatchEvent(new Event('announcement_updated'));
  }, [announcements]);

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      alert('Audio PA Broadcaster is not supported on this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  const handlePublish = (e) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;

    const fullText = `${announcementCategory}: ${newAnnouncement}`;
    const item = {
      id: Date.now(),
      text: fullText,
      date: 'Just now',
      author: 'TTE Station Command',
      active: true,
      lang: 'en'
    };

    setAnnouncements(prev => [item, ...prev]);
    setNewAnnouncement('');
    speakText(fullText);
    alert('📢 Announcement published live to Passenger Dashboard & Station Speakers!');
  };

  const removeAnnouncement = (id) => {
    setAnnouncements(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 font-sans space-y-6 animate-slide-in">
      
      {/* Header Banner */}
      <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
            <Radio className="h-3 w-3 animate-pulse text-rose-400" />
            <span>Public Address (PA) Audio Broadcast Console</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Station Announcements & PA Audio Broadcaster</h1>
          <p className="text-xs text-slate-400 font-medium">Broadcast live audio PA notifications across platform speakers and passenger digital screens.</p>
        </div>

        {isPlayingAudio && (
          <button
            onClick={stopAudio}
            className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg animate-pulse shrink-0"
          >
            <StopCircle className="h-4 w-4" />
            <span>Stop Audio Broadcast</span>
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Compose Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-4 self-start">
          <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
            <Plus className="h-4 w-4 text-primary-600" />
            <span>Compose Announcement</span>
          </h3>

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
              <select
                value={announcementCategory}
                onChange={(e) => setAnnouncementCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary-500 cursor-pointer"
              >
                <option value="Platform Change">Platform Change</option>
                <option value="Train Delay">Train Delay</option>
                <option value="Emergency Alert">Emergency Alert</option>
                <option value="Tatkal Notice">Tatkal & Ticket Notice</option>
                <option value="General Safety">General Safety Advisory</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Announcement Content</label>
              <textarea
                rows={4}
                required
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                placeholder="Type platform announcement text (e.g. Train 12952 arriving on Platform 1)..."
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-primary-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center space-x-2"
            >
              <Megaphone className="h-4 w-4" />
              <span>Publish & Speak PA Announcement</span>
            </button>
          </form>
        </div>

        {/* Right Column Active Announcements Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
            <Volume2 className="h-4 w-4 text-primary-600" />
            <span>Live Published Announcements ({announcements.length})</span>
          </h3>

          <div className="space-y-3">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-2 flex items-start justify-between gap-4 transition hover:border-primary-400"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      PA Live
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{item.date} &bull; {item.author}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">{item.text}</p>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => speakText(item.text)}
                    className="p-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 transition"
                    title="Play Audio Broadcast"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeAnnouncement(item.id)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                    title="Remove Announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StaffAnnouncements;
