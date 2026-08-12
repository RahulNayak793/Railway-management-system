import React, { useState, useEffect } from 'react';
import { Bell, Info, AlertTriangle, CheckCircle2, Trash2, CheckSquare } from 'lucide-react';
import api from '../services/api';

const PassengerNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      let apiNotifs = res.data || [];

      const savedAnnouncements = localStorage.getItem('railway_announcements');
      if (savedAnnouncements) {
        try {
          const parsed = JSON.parse(savedAnnouncements);
          const staffNotifs = parsed.map(a => ({
            id: `staff-anc-${a.id}`,
            title: `📢 ${a.author || 'Station Command'} Announcement`,
            message: a.text,
            type: 'announcement',
            is_read: false,
            created_at: new Date().toISOString()
          }));
          apiNotifs = [...staffNotifs, ...apiNotifs];
        } catch (e) {}
      }

      setNotifications(apiNotifs);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHrs < 24) return `${diffHrs} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 font-sans">Notifications Center</h1>
          <p className="text-xs text-slate-400">Important travel alerts, booking updates, and announcements.</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={markAllRead}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
          >
            <CheckSquare className="h-4 w-4" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          <Bell className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <p className="font-bold text-slate-600 mb-1">All caught up!</p>
          <p className="text-xs">You have no unread notifications or travel alerts at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 flex items-start gap-4 ${
                n.is_read 
                  ? 'bg-white border-slate-150 opacity-75' 
                  : 'bg-gradient-to-r from-blue-50/50 to-white border-blue-100/80 ring-1 ring-blue-50'
              }`}
            >
              {/* Type Icon indicator */}
              <div className="mt-0.5 shrink-0">
                {n.type === 'warning' ? (
                  <div className="bg-amber-100 text-amber-700 p-2 rounded-xl">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                ) : n.type === 'success' ? (
                  <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="bg-blue-100 text-blue-700 p-2 rounded-xl">
                    <Info className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Notification Message Details */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-black ${n.is_read ? 'text-slate-700' : 'text-slate-850'}`}>
                    {n.title}
                  </h4>
                  <span className="text-[10px] text-slate-455 font-bold">{formatTime(n.created_at)}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {n.message}
                </p>
                
                {/* Actions inside card */}
                <div className="flex items-center space-x-4 pt-1 text-[10px] font-bold text-slate-400">
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-primary-600 hover:text-primary-700 hover:underline transition"
                    >
                      Mark as read
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotif(n.id)}
                    className="text-slate-400 hover:text-red-600 transition flex items-center space-x-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PassengerNotifications;
