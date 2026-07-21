import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Shield, Server, Train, Menu, ChevronDown, LogOut, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (date) => {
    const days = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedHours = hours.toString().padStart(2, '0');
    
    return `${days} ${month} ${year} | ${formattedHours}:${minutes} ${ampm}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#00285a] bg-[#003366] text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left Side: Hamburger & Brand */}
        <div className="flex items-center space-x-4">
          <button 
            type="button"
            onClick={onToggleSidebar}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div 
            onClick={() => {
              if (user.role === 'passenger') navigate('/passenger');
              if (user.role === 'staff') navigate('/staff');
              if (user.role === 'admin') navigate('/admin');
            }}
            className="flex cursor-pointer items-center space-x-2 text-white"
          >
            <div className="rounded-lg bg-white/10 p-1.5 text-white">
              <Train className="h-5 w-5" />
            </div>
            <span className="font-sans text-base font-bold tracking-wide">
              Railway Management System
            </span>
          </div>
        </div>

        {/* Right Side: Quick Switches, Notifications & Profile */}
        <div className="flex items-center space-x-4">
          
          {/* Dashboard Quick Switch (Admin/Staff) */}
          {user.role === 'admin' && (
            <button 
              onClick={() => navigate('/admin')}
              className="hidden items-center space-x-1 rounded-full bg-red-500/20 px-3 h-8 text-xs font-semibold text-red-200 hover:bg-red-500/30 sm:flex border border-red-500/30"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin Console</span>
            </button>
          )}

          {user.role === 'staff' && (
            <button 
              onClick={() => navigate('/staff')}
              className="hidden items-center space-x-1 rounded-full bg-emerald-500/20 px-3 h-8 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 sm:flex border border-emerald-500/30"
            >
              <Server className="h-3.5 w-3.5" />
              <span>Staff Portal</span>
            </button>
          )}

          {/* Live Clock (Mockup Style) */}
          <div className="hidden items-center text-slate-200 text-xs font-semibold sm:flex mr-3 gap-1.5 opacity-90">
            <Clock className="h-4 w-4 text-slate-300" />
            <span>{formatDateTime(time)}</span>
          </div>

          {/* Notification Alert Bell with badge '3' */}
          <button className="relative rounded-full p-2 text-slate-200 hover:bg-white/10 hover:text-white transition">
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f83a3a] text-[9px] font-black text-white">
              3
            </span>
            <Bell className="h-5 w-5" />
          </button>

          {/* User Profile dropdown card */}
          <div 
            onClick={() => navigate(`/${user.role}/profile`)}
            className="flex items-center space-x-3 cursor-pointer hover:bg-white/10 p-1.5 rounded-xl transition border border-transparent hover:border-white/10"
            title="View Profile Settings"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white font-extrabold border border-white/25 shadow-sm text-sm">
              {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'P'}
            </div>
            <div className="hidden flex-col items-start sm:flex text-left">
              <span className="text-xs font-black text-white leading-none">
                {user.full_name || 'Passenger'}
              </span>
              <span className="text-[9.5px] text-slate-350 font-bold capitalize mt-0.5">
                {user.role}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-300 hidden sm:block" />
          </div>

          {/* Small screen logout icon just in case */}
          <button 
            onClick={handleLogout}
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
