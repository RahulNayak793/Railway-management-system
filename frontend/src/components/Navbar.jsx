import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Shield, Server, Train, Menu, ChevronDown, LogOut, Clock, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
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
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role) => {
    if (role === 'admin') return 'from-rose-500 to-red-600';
    if (role === 'staff') return 'from-emerald-500 to-teal-600';
    return 'from-primary-500 to-primary-600';
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  if (!user) return null;

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
            📢 <strong className="text-white">IRCTC Bulletin:</strong> Travel insurance up to ₹10 Lakhs available for ₹0.45/passenger • Railway Helpline: <strong className="text-amber-300">139</strong> • AC Tatkal: 10:00 AM | Non-AC Tatkal: 11:00 AM
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
              if (user.role === 'passenger') navigate('/passenger');
              else if (user.role === 'staff') navigate('/staff');
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
          {user.role === 'admin' && (
            <span
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-bold text-red-300"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Shield className="h-3 w-3" /> Admin
            </span>
          )}
          {user.role === 'staff' && (
            <span
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-bold text-emerald-300"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              <Zap className="h-3 w-3" /> Staff Portal
            </span>
          )}

          {/* Live clock */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 text-primary-400" />
            <span>{formatDateTime(time)}</span>
          </div>

          {/* Notification Bell */}
          <button
            className="relative rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <span
              className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white"
              style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
            >
              3
            </span>
            <Bell className="h-5 w-5" />
          </button>

          {/* User Profile Card */}
          <div
            onClick={() => navigate(`/${user.role}/profile`)}
            className="flex items-center gap-2.5 cursor-pointer rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-white/8"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            title="Profile Settings"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white flex-shrink-0 bg-gradient-to-br ${getRoleColor(user.role)}`}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
            >
              {getInitials(user.full_name)}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-xs font-black text-white">
                {user.full_name ? user.full_name.split(' ')[0] : 'User'}
              </span>
              <span className="text-[9.5px] text-slate-400 font-semibold capitalize">{user.role}</span>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-500 hidden sm:block" />
          </div>

          {/* Mobile Logout */}
          <button
            onClick={handleLogout}
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  </>
  );
};

export default Navbar;
