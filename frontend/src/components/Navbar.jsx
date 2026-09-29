import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Shield, Server, Train, Menu, ChevronDown, LogOut, Clock, Zap, User, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import api from '../services/api';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const userRole = (user?.role || 'passenger').toLowerCase();
  const { currency, setCurrency, formatPrice, rates } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileActive = location.pathname.includes('/profile');
  const isNotifActive = location.pathname.includes('/notifications');
  const isWalletActive = location.pathname.includes('/wallet');
  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem('railway_wallet_balance');
    return saved !== null ? parseFloat(saved) : 2500;
  });
  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const [time, setTime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);

  // Fetch real notifications for the user
  const fetchUserNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      const list = res.data || [];
      setNotificationsList(list);
      const unread = list.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchUserNotifications();
    const interval = setInterval(fetchUserNotifications, 15000);
    const handleUpdate = () => fetchUserNotifications();
    window.addEventListener('notification_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [user]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      setNotificationsList(prev => prev.map(n => (n.id === id || n.notification_id === id) ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new Event('notification_updated'));
    } catch (err) {}
  };

  const handleMarkAllRead = async (e) => {
    if (e) e.stopPropagation();
    try {
      await api.put('/notifications/read-all');
      setNotificationsList(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event('notification_updated'));
    } catch (err) {}
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch (e) {
      return 'Recent';
    }
  };

  const [topAnnouncement, setTopAnnouncement] = useState(() => {
    const saved = localStorage.getItem('railway_announcements');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const activeItem = parsed.find(a => a.active !== false);
        if (activeItem) return activeItem.text;
      } catch (e) {}
    }
    return 'Travel insurance up to ₹10 Lakhs available for ₹0.45/passenger • Railway Helpline: 139 • AC Tatkal: 10:00 AM | Non-AC Tatkal: 11:00 AM';
  });

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const syncNavbarAnnouncement = () => {
      const saved = localStorage.getItem('railway_announcements');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const activeItem = parsed.find(a => a.active !== false);
          if (activeItem) setTopAnnouncement(activeItem.text);
        } catch (e) {}
      }
    };

    window.addEventListener('announcement_updated', syncNavbarAnnouncement);
    return () => window.removeEventListener('announcement_updated', syncNavbarAnnouncement);
  }, []);

  useEffect(() => {
    if (userRole === 'passenger') {
      const fetchBalance = async () => {
        try {
          const res = await api.get('/payments/wallet');
          if (res.data?.balance !== undefined) {
            setWalletBalance(parseFloat(res.data.balance));
            localStorage.setItem('railway_wallet_balance', res.data.balance.toString());
          }
        } catch (e) {
          const saved = localStorage.getItem('railway_wallet_balance');
          if (saved !== null) setWalletBalance(parseFloat(saved));
        }
      };
      fetchBalance();

      const handleWalletUpdate = () => {
        const saved = localStorage.getItem('railway_wallet_balance');
        if (saved !== null) setWalletBalance(parseFloat(saved));
        else fetchBalance();
      };
      window.addEventListener('railway_wallet_updated', handleWalletUpdate);
      return () => window.removeEventListener('railway_wallet_updated', handleWalletUpdate);
    }
  }, [userRole]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateTime = (date) => {
    const days = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${days} ${month} ${year} · ${hours.toString().padStart(2,'0')}:${minutes} ${ampm}`;
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role) => {
    if (role === 'admin' || role === 'staff') return 'from-rose-500 to-red-600';
    return 'from-primary-500 to-primary-600';
  };

  const handleLogout = () => { 
    const role = (user?.role || (window.location.pathname.startsWith('/admin') ? 'admin' : window.location.pathname.startsWith('/staff') ? 'staff' : 'passenger')).toLowerCase();
    logout(role); 
    if (role === 'passenger') {
      window.location.replace('/passenger/login');
    } else {
      window.location.replace('/login');
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Top Official IRCTC Announcement Ticker */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-slate-300 text-[11px] font-semibold py-1 px-4 border-b border-white/10 flex items-center justify-between overflow-hidden">
        <div className="flex items-center space-x-2 shrink-0">
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
            RailControl Bulletin
          </span>
          <span className="hidden sm:inline text-slate-400 font-mono">Travel Advisory</span>
        </div>

        <div className="flex-1 overflow-hidden mx-4 text-center">
          <p className="truncate text-slate-300 font-medium animate-pulse">
            📢 <strong className="text-white">Live Bulletin:</strong> {topAnnouncement}
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0 text-[10px] text-slate-400">
          <span className="hidden md:inline font-mono text-emerald-400 font-bold">● 100% SSL Encrypted</span>
          <span className="bg-white/10 px-2 py-0.5 rounded text-white font-bold font-mono">139 Help</span>
        </div>
      </div>

      <header
        className="sticky top-0 z-50 w-full flex-shrink-0"
        style={{
          background: 'rgba(10, 18, 40, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
        }}
      >
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Left: Hamburger + Brand */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-xl p-2 text-slate-300 hover:text-white transition-all duration-200 hover:bg-white/10 active:scale-90"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            onClick={() => {
              if (userRole === 'passenger') navigate('/passenger');
              else navigate('/admin');
            }}
            className="flex cursor-pointer items-center gap-2.5 group"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl transition transform group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #2478f2 100%)',
                boxShadow: '0 0 16px rgba(249, 115, 22, 0.4)',
              }}
            >
              <Train className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black text-white tracking-tight">RailControl</span>
                <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[8px] font-black px-1.5 py-0.2 rounded uppercase">IRCTC</span>
              </div>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">INDIAN RAILWAYS e-TICKETING</span>
            </div>
          </div>
        </div>

        {/* Right: Badges, Clock, Bell, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Role badge */}
          {userRole === 'admin' && (
            <span
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-bold text-red-300"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Shield className="h-3 w-3" /> Admin Portal
            </span>
          )}
          {userRole === 'staff' && (
            <span
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-bold text-emerald-300"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              <Shield className="h-3 w-3" /> Staff Portal
            </span>
          )}

          {/* Live clock */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 text-primary-400" />
            <span>{formatDateTime(time)}</span>
          </div>

          {/* Rail Wallet Button (Passenger) */}
          {userRole === 'passenger' && (
            <button
              type="button"
              onClick={() => navigate('/passenger/wallet')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 focus:outline-none active:scale-95 ${
                isWalletActive
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-slate-300 hover:text-white'
              }`}
              title="Rail Wallet · Click to View & Top Up"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider hidden sm:inline">
                  Rail Wallet
                </span>
                <span className="text-xs font-black text-emerald-400">
                  {formatPrice ? formatPrice(walletBalance) : `₹${Math.round(walletBalance).toLocaleString('en-IN')}`}
                </span>
              </div>
            </button>
          )}

          {/* Notification Bell */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                if (!showNotifMenu) fetchUserNotifications();
              }}
              className={`relative rounded-xl p-2 transition-all duration-200 focus:outline-none ${
                isNotifActive
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Notifications"
            >
              {unreadCount > 0 && (
                <span
                  className="absolute right-1 top-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-black text-white animate-pulse"
                  style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <Bell className={`h-5 w-5 transition ${isNotifActive ? 'text-amber-300' : 'text-slate-200 hover:text-white'}`} />
            </button>

            {/* Notification Dropdown Center */}
            {showNotifMenu && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl z-50 overflow-hidden animate-scale-in"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div 
                    onClick={() => {
                      setShowNotifMenu(false);
                      navigate(`/${userRole}/notifications`);
                    }}
                    className="flex items-center space-x-2 cursor-pointer group"
                    title="Open Notifications Center"
                  >
                    <Bell className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-wider text-white group-hover:text-amber-300 transition">
                      Notifications {unreadCount > 0 && <span className="text-amber-400 font-mono">({unreadCount})</span>}
                    </span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition underline cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto">
                  {notificationsList.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      <Bell className="h-6 w-6 mx-auto mb-2 text-slate-600 opacity-60" />
                      No notifications at this time.
                    </div>
                  ) : (
                    notificationsList.slice(0, 6).map(n => {
                      const isUnread = !n.is_read;
                      const isDisruption = n.type === 'TRAIN_STATUS' || n.title?.toLowerCase().includes('delayed') || n.title?.toLowerCase().includes('cancelled') || n.title?.toLowerCase().includes('rescheduled');
                      return (
                        <div 
                          key={n.id}
                          onClick={() => {
                            if (isUnread) handleMarkAsRead(n.id);
                            setShowNotifMenu(false);
                            if (n.booking_id || n.pnr) {
                              navigate('/passenger/history');
                            } else {
                              navigate(`/${userRole}/notifications`);
                            }
                          }}
                          className={`p-3 hover:bg-slate-800/60 cursor-pointer transition flex items-start space-x-3 ${
                            isUnread ? 'bg-slate-800/40' : 'opacity-75'
                          }`}
                        >
                          <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${
                            isUnread ? (isDisruption ? 'bg-amber-400 animate-ping' : 'bg-blue-400') : 'bg-slate-600'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-bold truncate block ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                {n.title}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                {formatRelativeTime(n.created_at)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                              {n.message}
                            </p>
                            {n.train_number && (
                              <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-slate-500">
                                <span className="text-blue-300 font-bold">#{n.train_number}</span>
                                {n.journey_date && <span>• {n.journey_date}</span>}
                                {n.pnr && <span>• PNR: {n.pnr}</span>}
                              </div>
                            )}
                          </div>
                          {isUnread && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(n.id, e)}
                              className="text-[9px] text-slate-500 hover:text-amber-300 p-1 shrink-0"
                              title="Mark as read"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-3 bg-slate-950 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifMenu(false);
                      navigate(`/${userRole}/notifications`);
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isNotifActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-900/30'
                    }`}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>View All Notifications Page &rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Card Dropdown Container */}
          <div className="relative" ref={userMenuRef}>
            <div
              className={`flex items-center rounded-xl transition-all duration-200 ${
                isProfileActive
                  ? 'bg-primary-500/20 border border-primary-500/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {/* Profile Link (Navigates to /profile) */}
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate(`/${userRole}/profile`);
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer rounded-l-xl transition-all duration-150 hover:bg-white/10 active:scale-95 text-left focus:outline-none"
                title="View Profile"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white flex-shrink-0 bg-gradient-to-br ${getRoleColor(userRole)}`}
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                >
                  {getInitials(user?.full_name)}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-black text-white truncate max-w-[130px]">
                    {user?.full_name && typeof user.full_name === 'string' ? user.full_name.split(' ')[0] : 'User'}
                  </span>
                  <span className={`text-[9.5px] font-bold flex items-center gap-1 ${isProfileActive ? 'text-primary-300' : 'text-slate-400 group-hover:text-primary-300'}`}>
                    <User className="h-2.5 w-2.5 text-primary-400" />
                    Profile
                  </span>
                </div>
              </button>

              {/* Chevron Down Dropdown Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                }}
                className="px-2 py-2.5 text-slate-400 hover:text-white rounded-r-xl transition hover:bg-white/10 focus:outline-none border-l border-white/10"
                title="Account Menu"
              >
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showUserMenu ? 'rotate-180 text-white' : ''}`} />
              </button>
            </div>

            {/* Profile & Account Dropdown Menu */}
            {showUserMenu && (
              <div 
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl z-50 overflow-hidden animate-scale-in"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                {/* User Header Info */}
                <div 
                  onClick={() => { setShowUserMenu(false); navigate(`/${userRole}/profile`); }}
                  className="p-4 bg-slate-950 border-b border-slate-800 space-y-1 cursor-pointer hover:bg-slate-900/80 transition"
                  title="Go to Profile"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white truncate max-w-[140px]">
                      {user?.full_name || 'Rahul Patakar'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-white bg-gradient-to-r ${getRoleColor(userRole)}`}>
                      {userRole}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email || 'passenger@railway.gov.in'}</p>
                  <p className="text-[10px] text-primary-400 font-bold flex items-center gap-1 pt-1">
                    <User className="h-3 w-3" /> View & Edit Profile &rarr;
                  </p>
                </div>

                {/* Dropdown Links */}
                <div className="p-1.5 space-y-0.5 text-xs font-bold text-slate-200">
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); navigate(`/${userRole}/profile`); }}
                    className={`w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 flex items-center space-x-2.5 transition text-left ${isProfileActive ? 'bg-primary-600/20 text-primary-300' : ''}`}
                  >
                    <User className="h-4 w-4 text-primary-400" />
                    <span>Profile & Account Settings</span>
                  </button>

                  {userRole === 'passenger' && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setShowUserMenu(false); navigate('/passenger/history'); }}
                        className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 flex items-center space-x-2.5 transition text-left"
                      >
                        <Train className="h-4 w-4 text-emerald-400" />
                        <span>My Bookings & Tickets</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowUserMenu(false); navigate('/passenger/wallet'); }}
                        className={`w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 flex items-center space-x-2.5 transition text-left ${isWalletActive ? 'bg-emerald-600/20 text-emerald-300' : ''}`}
                      >
                        <Wallet className="h-4 w-4 text-emerald-400" />
                        <span>Rail Wallet & Top Up</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setShowUserMenu(false); navigate('/passenger/feedback'); }}
                        className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 flex items-center space-x-2.5 transition text-left"
                      >
                        <Bell className="h-4 w-4 text-amber-400" />
                        <span>Feedback & Reviews</span>
                      </button>
                    </>
                  )}

                  <div className="my-1 border-t border-slate-800" />

                  {/* LOGOUT BUTTON INSIDE DROPDOWN */}
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); handleLogout(); }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 flex items-center space-x-2.5 transition text-left"
                  >
                    <LogOut className="h-4 w-4 text-rose-400" />
                    <span className="font-black">Sign Out / Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop & Mobile Direct Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition active:scale-95 shrink-0"
            title="Log Out"
          >
            <LogOut className="h-4 w-4 text-rose-400" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  </>
  );
};

export default Navbar;
