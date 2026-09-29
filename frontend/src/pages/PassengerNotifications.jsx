import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, Info, AlertTriangle, CheckCircle2, Trash2, CheckSquare, 
  Train, Clock, ArrowRight, ShieldAlert, RotateCcw, XCircle, 
  MapPin, Compass, ExternalLink, Calendar, Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PassengerNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'train_updates', 'booking', 'payment', 'other'

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      let apiNotifs = res.data || [];

      // Include staff broadcast announcements if any exist in local storage
      const savedAnnouncements = localStorage.getItem('railway_announcements');
      if (savedAnnouncements) {
        try {
          const parsed = JSON.parse(savedAnnouncements);
          const staffNotifs = parsed.map(a => ({
            id: `staff-anc-${a.id}`,
            notification_id: `staff-anc-${a.id}`,
            title: `📢 ${a.author || 'Station Command'} Broadcast`,
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
      window.dispatchEvent(new Event('notification_updated'));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => (n.id === id || n.notification_id === id) ? { ...n, is_read: true } : n));
      window.dispatchEvent(new Event('notification_updated'));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id && n.notification_id !== id));
      window.dispatchEvent(new Event('notification_updated'));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHrs < 24) return `${diffHrs} hours ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays} days ago`;
    } catch (e) {
      return '';
    }
  };

  // Helper to categorize notifications
  const categorize = (n) => {
    const title = (n.title || '').toLowerCase();
    const type = (n.type || '').toUpperCase();
    if (type === 'TRAIN_STATUS' || n.train_number || title.includes('train') || title.includes('delayed') || title.includes('cancelled') || title.includes('platform') || title.includes('rescheduled')) {
      return 'train_updates';
    }
    if (type === 'BOOKING' || title.includes('booking') || title.includes('ticket') || title.includes('confirmed') || title.includes('berth')) {
      return 'booking';
    }
    if (type === 'PAYMENT' || title.includes('payment') || title.includes('refund') || title.includes('wallet')) {
      return 'payment';
    }
    return 'other';
  };

  // Filtered Notifications based on active tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeTab === 'all') return true;
      if (activeTab === 'unread') return !n.is_read;
      const cat = categorize(n);
      return cat === activeTab;
    });
  }, [notifications, activeTab]);

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter(n => !n.is_read).length,
      train_updates: notifications.filter(n => categorize(n) === 'train_updates').length,
      booking: notifications.filter(n => categorize(n) === 'booking').length,
      payment: notifications.filter(n => categorize(n) === 'payment').length,
      other: notifications.filter(n => categorize(n) === 'other').length
    };
  }, [notifications]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-white">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Bell className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black uppercase tracking-tight text-white font-sans">
                Passenger Alerts & Notifications
              </h1>
              {counts.unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black font-mono px-2 py-0.5 rounded-full">
                  {counts.unread} UNREAD
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Official operational disruption alerts, platform updates, and booking notifications.
            </p>
          </div>
        </div>

        {counts.unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition active:scale-95 border border-slate-700 shadow-sm shrink-0"
          >
            <CheckSquare className="h-4 w-4 text-amber-400" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-slate-200">
        {[
          { id: 'all', label: 'All', count: counts.all },
          { id: 'unread', label: 'Unread', count: counts.unread },
          { id: 'train_updates', label: 'Train Updates', count: counts.train_updates },
          { id: 'booking', label: 'Booking Updates', count: counts.booking },
          { id: 'payment', label: 'Payment', count: counts.payment },
          { id: 'other', label: 'Other', count: counts.other }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
          <Bell className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="font-bold text-slate-700 mb-1 text-sm">No notifications found</p>
          <p className="text-xs text-slate-400">
            {activeTab === 'unread' 
              ? 'You are all caught up! There are no unread alerts at this time.' 
              : `There are no notifications in the ${activeTab.replace('_', ' ')} category.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredNotifications.map((n) => {
            const isUnread = !n.is_read;
            const isTrainAlert = n.type === 'TRAIN_STATUS' || n.train_number;
            const isDelayed = (n.title || '').toLowerCase().includes('delayed');
            const isCancelled = (n.title || '').toLowerCase().includes('cancelled');
            const isPlatform = (n.title || '').toLowerCase().includes('platform');

            return (
              <div
                key={n.id}
                className={`rounded-2xl border p-5 shadow-xs transition-all duration-200 flex flex-col sm:flex-row items-start justify-between gap-4 ${
                  isUnread
                    ? 'bg-gradient-to-r from-blue-50/70 via-white to-white border-blue-200 ring-1 ring-blue-100'
                    : 'bg-white border-slate-200 opacity-85'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {isCancelled ? (
                      <div className="bg-red-100 text-red-700 p-2.5 rounded-xl border border-red-200">
                        <XCircle className="h-5 w-5" />
                      </div>
                    ) : isDelayed ? (
                      <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl border border-amber-200">
                        <Clock className="h-5 w-5" />
                      </div>
                    ) : isPlatform ? (
                      <div className="bg-cyan-100 text-cyan-700 p-2.5 rounded-xl border border-cyan-200">
                        <MapPin className="h-5 w-5" />
                      </div>
                    ) : isTrainAlert ? (
                      <div className="bg-blue-100 text-blue-700 p-2.5 rounded-xl border border-blue-200">
                        <Train className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="bg-slate-100 text-slate-700 p-2.5 rounded-xl border border-slate-200">
                        <Info className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h3 className={`text-sm font-black tracking-tight ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {n.title}
                      </h3>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                      )}
                      {n.type === 'TRAIN_STATUS' && (
                        <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                          Train Disruption
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {n.message}
                    </p>

                    {/* Rich Train Meta */}
                    {isTrainAlert && (
                      <div className="flex items-center gap-3 flex-wrap pt-1 text-[11px] font-mono text-slate-500">
                        {n.train_number && (
                          <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Train #{n.train_number} {n.train_name && `(${n.train_name})`}
                          </span>
                        )}
                        {n.journey_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            Journey: <strong>{n.journey_date}</strong>
                          </span>
                        )}
                        {n.pnr && (
                          <span>
                            PNR: <strong className="text-slate-700">{n.pnr}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Links */}
                    <div className="flex items-center space-x-4 pt-2 text-xs font-bold text-slate-500">
                      {(n.booking_id || n.pnr) && (
                        <button
                          type="button"
                          onClick={() => navigate('/passenger/history')}
                          className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>View Affected Booking</span>
                        </button>
                      )}
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="text-slate-600 hover:text-blue-600"
                        >
                          Mark as read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteNotif(n.id)}
                        className="text-slate-400 hover:text-red-600 flex items-center space-x-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono font-bold text-slate-500 block">
                    {formatTime(n.created_at)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    {n.created_at ? new Date(n.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default PassengerNotifications;
