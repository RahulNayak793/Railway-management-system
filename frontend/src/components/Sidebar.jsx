import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Train, 
  Users, 
  MessageSquare, 
  Receipt, 
  Settings, 
  ShieldAlert,
  Home,
  Search,
  BookOpen,
  FileText,
  Clock,
  XCircle,
  CreditCard,
  User,
  Bell,
  HelpCircle,
  LogOut,
  Compass,
  Ticket,
  Megaphone,
  ChevronRight,
  Calendar,
  MapPin,
  Layers,
  BarChart3
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';
  const isPassenger = user.role === 'passenger';

  const adminSections = [
    {
      group: 'MANAGEMENT',
      items: [
        { name: 'Train Management', path: '/admin/trains', icon: Train, expandable: true },
        { name: 'Route Management', path: '/admin/routes', icon: Compass, expandable: true },
        { name: 'Schedule Management', path: '/admin/schedules', icon: Clock, expandable: true },
        { name: 'Station Management', path: '/admin/stations', icon: MapPin, expandable: true },
        { name: 'Fare Management', path: '/admin/policies', icon: Settings, expandable: true },
        { name: 'Class Management', path: '/admin/classes', icon: Layers, expandable: true }
      ]
    },
    {
      group: 'USER MANAGEMENT',
      items: [
        { name: 'Staff Management', path: '/admin/staff', icon: Users, expandable: true },
        { name: 'Passenger Management', path: '/admin/users', icon: User, expandable: true }
      ]
    },
    {
      group: 'BOOKING & TICKETS',
      items: [
        { name: 'Bookings', path: '/admin/bookings', icon: BookOpen, expandable: true },
        { name: 'Payments', path: '/admin/payments', icon: CreditCard, expandable: true },
        { name: 'Cancellation', path: '/admin/cancellation', icon: XCircle, expandable: true }
      ]
    },
    {
      group: 'REPORTS & ANALYTICS',
      items: [
        { name: 'Reports', path: '/admin/reports', icon: FileText, expandable: true },
        { name: 'Analytics', path: '/admin/analytics', icon: BarChart3, expandable: true }
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { name: 'Settings', path: '/admin/settings', icon: Settings, expandable: false }
      ]
    }
  ];

  const menuItems = [];

  if (isAdmin) {
    menuItems.push(
      { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
      { name: 'User Management', path: '/admin/users', icon: Users },
      { name: 'Train Fleet', path: '/admin/trains', icon: Train },
      { name: 'Inquiry Center', path: '/admin/inquiries', icon: MessageSquare },
      { name: 'Refund Disputes', path: '/admin/refunds', icon: Receipt },
      { name: 'Fare & Policy Settings', path: '/admin/policies', icon: Settings }
    );
  } else if (isStaff) {
    menuItems.push(
      { name: 'Dashboard', path: '/staff', icon: LayoutDashboard },
      { name: 'Train Operations', path: '/staff/schedules', icon: Train },
      { name: 'Bookings', path: '/staff/bookings', icon: BookOpen },
      { name: 'Passenger Management', path: '/staff/passengers', icon: Users },
      { name: 'Ticket Checking', path: '/staff/ticket-checking', icon: Ticket },
      { name: 'RAC / Waiting List', path: '/staff/rac-waiting', icon: Clock },
      { name: 'Reports', path: '/staff/reports', icon: FileText },
      { name: 'Announcements', path: '/staff/announcements', icon: Megaphone },
      { name: 'Help & Support', path: '/staff/inquiries', icon: HelpCircle },
      { name: 'Settings', path: '/staff/profile', icon: Settings }
    );
  } else if (isPassenger) {
    menuItems.push(
      { name: 'Home', path: '/passenger', icon: Home },
      { name: 'Search Trains', path: '/passenger/search', icon: Search },
      { name: 'My Bookings', path: '/passenger/history', icon: BookOpen },
      { name: 'PNR Status', path: '/passenger/pnr', icon: FileText },
      { name: 'Live Tracking', path: '/passenger/track', icon: Compass },
      { name: 'Cancel Ticket', path: '/passenger/cancellations', icon: XCircle },
      { name: 'Payment History', path: '/passenger/payments', icon: CreditCard },
      { name: 'Profile', path: '/passenger/profile', icon: User },
      { name: 'Notifications', path: '/passenger/notifications', icon: Bell },
      { name: 'Help & Support', path: '/passenger/support', icon: HelpCircle }
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 ${isPassenger ? 'bg-white border-r border-slate-200 text-slate-800' : 'bg-[#091b35] border-r border-[#0d2a52] text-[#b3c4dc]'} flex flex-col justify-between py-6 transition-transform duration-300 ease-in-out md:sticky md:top-16 md:translate-x-0 h-[calc(100vh-4rem)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      
      {/* Fixed User Profile Card at Top */}
      {!isPassenger && (
        <div className="px-7 pb-4 border-b border-[#0d2a52] mb-3 flex items-center space-x-3 flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white font-extrabold border border-[#1d3d68] shadow-sm flex-shrink-0">
            {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'SU'}
          </div>
          <div>
            <h3 className="text-xs font-black text-white leading-tight">
              {user.full_name === 'Staff User' ? 'STAFF User' : (user.full_name || 'STAFF User')}
            </h3>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mt-1">
              {isAdmin ? 'ADMINISTRATOR' : 'STATION STAFF'}
            </span>
          </div>
        </div>
      )}

      {/* Scrollable Navigation Container */}
      <div className="space-y-4 px-4 flex-1 overflow-y-auto scrollbar-none">

        {isAdmin ? (
          <div className="space-y-4">
            {/* Dashboard Link (Flat, not in a group) */}
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `flex items-center justify-between rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  isActive
                    ? 'bg-[#0052cc] text-white shadow-md'
                    : 'text-[#b3c4dc] hover:bg-[#112a4d] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <div className="flex items-center space-x-3">
                  <Home className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>Dashboard</span>
                </div>
              )}
            </NavLink>

            {adminSections.map((sec, sidx) => (
              <div key={sidx} className="space-y-0.5 pt-2">
                <span className="px-4 text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  {sec.group}
                </span>
                {sec.items.map((item, idx) => {
                  const Icon = item.icon;
                  const isHash = item.path.includes('#');

                  const linkClasses = (isActive) =>
                    `flex items-center justify-between rounded-xl px-4 py-2 text-xs font-extrabold transition-all text-left w-full ${
                      isActive
                        ? 'bg-[#0052cc] text-white shadow-md'
                        : 'text-[#b3c4dc] hover:bg-[#112a4d] hover:text-white'
                    }`;

                  const linkContent = (isActive) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.expandable && (
                        <ChevronRight className={`h-3 w-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      )}
                    </>
                  );

                  if (isHash) {
                    return (
                      <a
                        key={idx}
                        href={item.path}
                        onClick={handleLinkClick}
                        className={linkClasses(false)}
                      >
                        {linkContent(false)}
                      </a>
                    );
                  }

                  return (
                    <NavLink
                      key={idx}
                      to={item.path}
                      onClick={handleLinkClick}
                      className={({ isActive }) => linkClasses(isActive)}
                    >
                      {({ isActive }) => linkContent(isActive)}
                    </NavLink>
                  );
                })}
              </div>
            ))}

            {/* Logout button */}
            <button
              onClick={() => {
                handleLinkClick();
                handleLogout();
              }}
              className="w-full flex items-center space-x-3 rounded-xl px-4 py-2 text-xs font-black transition-all text-left text-[#b3c4dc] hover:bg-red-950/20 hover:text-red-400 pt-2"
            >
              <LogOut className="h-4.5 w-4.5 text-slate-400" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <>
            <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 flex justify-between items-center mb-2">
              <span>{isPassenger ? 'Passenger' : 'Main Menu'}</span>
              
              {/* Close button on mobile */}
              {isPassenger && (
                <button 
                  onClick={onClose}
                  className="md:hidden text-slate-400 hover:text-slate-650 p-1 rounded-lg transition"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <nav className="space-y-1">
              {menuItems.map((item, idx) => {
                const Icon = item.icon;
                
                // Check if item path is a hash anchor inside passenger dashboard
                const isHash = item.path.includes('#');
                
                if (isHash) {
                  return (
                    <a
                      key={idx}
                      href={item.path}
                      onClick={handleLinkClick}
                      className={`flex items-center space-x-3 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                        isPassenger 
                          ? 'text-slate-650 hover:bg-slate-50 hover:text-slate-900' 
                          : 'text-[#b3c4dc] hover:bg-[#112a4d] hover:text-white'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5 text-slate-400" />
                      <span>{item.name}</span>
                    </a>
                  );
                }

                return (
                  <NavLink
                    key={idx}
                    to={item.path}
                    onClick={handleLinkClick}
                    end={item.path === '/passenger' || item.path === '/admin' || item.path === '/staff'}
                    className={({ isActive }) =>
                      `relative flex items-center space-x-3 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                        isActive
                          ? isPassenger
                            ? 'bg-blue-50/70 text-primary-600 shadow-sm border-l-4 border-primary-600 rounded-l-none'
                            : 'bg-[#0052cc] text-white shadow-md'
                          : isPassenger
                            ? 'text-slate-650 hover:bg-slate-50 hover:text-slate-900'
                            : 'text-[#b3c4dc] hover:bg-[#112a4d] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`h-4.5 w-4.5 ${isActive ? (isPassenger ? 'text-primary-600' : 'text-white') : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}

              {/* Common Logout menu item */}
              <button
                onClick={() => {
                  handleLinkClick();
                  handleLogout();
                }}
                className={`w-full flex items-center space-x-3 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all text-left ${
                  isPassenger 
                    ? 'text-slate-650 hover:bg-red-50 hover:text-red-600' 
                    : 'text-[#b3c4dc] hover:bg-red-950/20 hover:text-red-400'
                }`}
              >
                <LogOut className="h-4.5 w-4.5 text-slate-400" />
                <span>Logout</span>
              </button>
            </nav>
          </>
        )}
      </div>
      
      {/* Workspace banner info */}
      {!isPassenger && (
        <div className="px-6 py-4">
          <div className="rounded-xl bg-[#0b1f40] p-4 border border-[#0d2a52]">
            <div className="flex items-center space-x-2 text-white font-semibold text-xs">
              <ShieldAlert className="h-4 w-4 text-primary-400" />
              <span>Operational Node</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400 leading-normal">
              Secure console session. Actions are audited for regulatory compliance.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
