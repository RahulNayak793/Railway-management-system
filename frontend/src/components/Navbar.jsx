import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Shield, Server, Train, Menu, ChevronDown, LogOut, Clock, Zap, Eye, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import CoachVRModal from './CoachVRModal';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { currency, setCurrency, rates } = useCurrency();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showVrModal, setShowVrModal] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

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
    if (role === 'admin') return 'from-rose-500 to-red-600';
    if (role === 'staff') return 'from-emerald-500 to-teal-600';
    return 'from-primary-500 to-primary-600';
  };

  const handleLogout = () => { 
    const currentRole = (user?.role || '').toLowerCase();
    logout(); 
    if (currentRole === 'admin' || currentRole === 'staff') {
      navigate('/admin/login');
    } else {
      navigate('/login');
    }
  };

  if (!user) return null;
  const userRole = (user?.role || 'passenger').toLowerCase();

  return (
    <>
      {/* Top Official IRCTC Announcement Ticker */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-slate-300 text-[11px] font-semibold py-1 px-4 border-b border-white/10 flex items-center justify-between overflow-hidden">
        <div className="flex items-center space-x-2 shrink-0">
          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
            IRCTC Official
          </span>
          <span className="hidden sm:inline text-slate-400 font-mono">CRIS Verified</span>
        </div>

        <div className="flex-1 overflow-hidden mx-4 text-center">
          <p className="truncate text-slate-300 font-medium animate-pulse">
            📢 <strong className="text-white">Live Staff Bulletin:</strong> {topAnnouncement}
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
              else if (userRole === 'staff') navigate('/staff');
              else navigate('/admin');
            }}
            className="flex cursor-pointer items-center gap-2.5 group"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #2478f2, #0f5be8)',
                boxShadow: '0 0 16px rgba(36, 120, 242, 0.4)',
              }}
            >
              <Train className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-sm font-black text-white tracking-tight">RailControl</span>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Management System</span>
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

          {/* Live clock */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 text-primary-400" />
            <span>{formatDateTime(time)}</span>
          </div>



          {/* 3D Coach VR Tour Button */}
          <button
            onClick={() => setShowVrModal(true)}
            className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition active:scale-95"
          >
            <Eye className="h-3.5 w-3.5 text-purple-400" />
            <span>3D VR Tour</span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none"
              title="Notifications"
            >
              {unreadCount > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white animate-pulse"
                  style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
                >
                  {unreadCount}
                </span>
              )}
              <Bell className="h-5 w-5 text-slate-200 hover:text-white transition" />
            </button>

            {/* Notification Dropdown Center */}
            {showNotifMenu && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl z-50 overflow-hidden animate-scale-in"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">System Notifications</span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setUnreadCount(0)}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto">
                  <div 
                    onClick={() => { setShowNotifMenu(false); navigate('/passenger/history'); }}
                    className="p-3 hover:bg-slate-800/60 cursor-pointer transition flex items-start space-x-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">🎫 Ticket Booking Confirmed</span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Booking #BK-94812 confirmed for Mumbai Rajdhani (12952) Coach B1, Seat 24.
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 block mt-1">10 mins ago</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => { setShowNotifMenu(false); navigate('/passenger/catering'); }}
                    className="p-3 hover:bg-slate-800/60 cursor-pointer transition flex items-start space-x-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">🍱 RailControl Meals Dispatch</span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Food Order #ORD-89421 is Out for Seat Delivery at NDLS Station!
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 block mt-1">25 mins ago</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => { setShowNotifMenu(false); navigate('/passenger/track'); }}
                    className="p-3 hover:bg-slate-800/60 cursor-pointer transition flex items-start space-x-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">📢 Platform Departure Update</span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Train 22436 Vande Bharat Express arriving on Platform 1 on schedule.
                      </p>
                      <span className="text-[9px] font-mono text-slate-500 block mt-1">1 hour ago</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifMenu(false);
                      navigate(`/${userRole}/notifications`);
                    }}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition"
                  >
                    View All Notifications Page &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Card Dropdown Container */}
          <div className="relative">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2.5 py-1.5 transition-all duration-200 hover:bg-white/10 active:scale-95"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              title="Account Menu"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white flex-shrink-0 bg-gradient-to-br ${getRoleColor(userRole)}`}
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                {getInitials(user?.full_name)}
              </div>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-black text-white">
                  {user?.full_name && typeof user.full_name === 'string' ? user.full_name.split(' ')[0] : 'User'}
                </span>
                <span className="text-[9.5px] text-slate-400 font-semibold capitalize">{userRole}</span>
              </div>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180 text-white' : ''}`} />
            </div>

            {/* Profile & Account Dropdown Menu */}
            {showUserMenu && (
              <div 
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700 text-white shadow-2xl z-50 overflow-hidden animate-scale-in"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                {/* User Header Info */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white truncate max-w-[140px]">
                      {user?.full_name || 'Rahul Patakar'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-white bg-gradient-to-r ${getRoleColor(userRole)}`}>
                      {userRole}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email || 'passenger@railway.gov.in'}</p>
                </div>

                {/* Dropdown Links */}
                <div className="p-1.5 space-y-0.5 text-xs font-bold text-slate-200">
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); navigate(`/${userRole}/profile`); }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 flex items-center space-x-2.5 transition text-left"
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

    {/* 3D Coach VR Modal */}
    <CoachVRModal isOpen={showVrModal} onClose={() => setShowVrModal(false)} />
  </>
  );
};

export default Navbar;
