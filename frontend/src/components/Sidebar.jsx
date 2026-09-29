import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Train, Users, MessageSquare, Receipt, Settings, ShieldAlert, Home,
  Search, BookOpen, FileText, Clock, XCircle, CreditCard, User, Bell, HelpCircle,
  LogOut, Compass, Ticket, Megaphone, ChevronRight, Calendar, MapPin, Layers, BarChart3, Wallet,
  Utensils, Radio, ChefHat, CheckSquare, Send
} from 'lucide-react';

const Sidebar = ({ isOpen, mobileOpen, onClose, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isDrawerOpen = isOpen !== undefined ? isOpen : mobileOpen;
  const handleClose = onClose || onCloseMobile;

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';
  const isPassenger = user.role === 'passenger';

  const adminSections = [
    {
      group: 'MANAGEMENT',
      items: [
        { name: 'Train Fleet & Schedule', path: '/admin/trains', icon: Train },
        { name: 'Train Status & Disruptions', path: '/admin/train-status', icon: ShieldAlert },
        { name: 'Route Management', path: '/admin/routes', icon: Compass },
        { name: 'Station Management', path: '/admin/stations', icon: MapPin },
        { name: 'Fare & Policy', path: '/admin/policies', icon: Settings },
        { name: 'Class Management', path: '/admin/classes', icon: Layers },
      ]
    },
    {
      group: 'STAFF MANAGEMENT',
      items: [
        { name: 'Staff Roster & Control', path: '/admin/staff', icon: Users, end: true },
        { name: 'Staff Assigned Tasks', path: '/admin/staff/duties', icon: CheckSquare },
        { name: 'Staff Reports & Task Reviews', path: '/admin/staff/reports', icon: Send },
      ]
    },
    {
      group: 'USER MANAGEMENT',
      items: [
        { name: 'Passenger Directory', path: '/admin/users', icon: User },
      ]
    },
    {
      group: 'BOOKING & TICKETS',
      items: [
        { name: 'Reservation & Seat Control', path: '/admin/reservations', icon: Layers },
        { name: 'Bookings', path: '/admin/bookings', icon: BookOpen },
        { name: 'Payments', path: '/admin/payments', icon: CreditCard },
        { name: 'Cancellations', path: '/admin/cancellation', icon: XCircle },
      ]
    },
    {
      group: 'REPORTS',
      items: [
        { name: 'Reports & Analytics', path: '/admin/reports', icon: FileText },
      ]
    }
  ];

  const staffMenuItems = [
    { name: 'Dashboard', path: '/staff/dashboard', icon: LayoutDashboard },
    { name: 'Train Fleet & Schedule', path: '/staff/trains', icon: Train },
    { name: 'Train Status & Disruptions', path: '/staff/train-status', icon: ShieldAlert },
    { name: 'Reservation & Seat Control', path: '/staff/reservations', icon: Layers },
    { name: 'Bookings Management', path: '/staff/bookings', icon: BookOpen },
    { name: 'Passenger Directory', path: '/staff/passengers', icon: User },
    { name: 'Cancellations', path: '/staff/cancellation', icon: XCircle },
    { name: 'Ticket Checking', path: '/staff/ticket-checking', icon: Ticket },
    { name: 'RAC / Waiting List', path: '/staff/rac-waiting', icon: Clock },
    { name: 'Assigned Tasks', path: '/staff/tasks', icon: CheckSquare },
    { name: 'Submit Task', path: '/staff/daily-report', icon: Send },
    { name: 'Reports', path: '/staff/reports', icon: FileText },
    { name: 'Announcements', path: '/staff/announcements', icon: Megaphone },
    { name: 'Help & Support', path: '/staff/inquiries', icon: HelpCircle },
    { name: 'Settings', path: '/staff/profile', icon: Settings },
  ];

  const menuItems = [];
  if (isAdmin) {
    menuItems.push(
      { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
      { name: 'Train Fleet & Schedule', path: '/admin/trains', icon: Train },
      { name: 'Train Status & Disruptions', path: '/admin/train-status', icon: ShieldAlert },
      { name: 'Route Management', path: '/admin/routes', icon: Compass },
      { name: 'Station Management', path: '/admin/stations', icon: MapPin },
      { name: 'Class Management', path: '/admin/classes', icon: Layers },
      { name: 'Reservation & Seat Control', path: '/admin/reservations', icon: Layers },
      { name: 'Bookings Management', path: '/admin/bookings', icon: BookOpen },
      { name: 'Passenger Directory', path: '/admin/users', icon: User },
      { name: 'Ticket Checking', path: '/admin/ticket-checking', icon: Ticket },
      { name: 'RAC & Waiting List', path: '/admin/rac-waiting', icon: Clock },
      { name: 'Catering Management', path: '/admin/catering', icon: Utensils },
      { name: 'Live Announcements', path: '/admin/announcements', icon: Megaphone },
      { name: 'Inquiry Center', path: '/admin/inquiries', icon: MessageSquare },
      { name: 'Refund Disputes', path: '/admin/refunds', icon: Receipt },
      { name: 'Fare & Policy', path: '/admin/policies', icon: Settings },
      { name: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3 }
    );
  } else if (isPassenger) {
    menuItems.push(
      { name: 'Home', path: '/passenger', icon: Home },
      { name: 'Search Trains', path: '/passenger/search', icon: Search },
      { name: 'My Bookings', path: '/passenger/history', icon: BookOpen },
      { name: 'PNR Status', path: '/passenger/pnr', icon: FileText },
      { name: 'Live Tracking', path: '/passenger/track', icon: Compass },
      { name: 'RailControl Meals', path: '/passenger/catering', icon: Utensils },
      { name: 'Cancel Ticket', path: '/passenger/cancellations', icon: XCircle },
      { name: 'Payment History', path: '/passenger/payments', icon: CreditCard },
      { name: 'Help & Support', path: '/passenger/support', icon: HelpCircle },
    );
  }

  const handleLogout = () => { 
    const role = (user?.role || (window.location.pathname.startsWith('/admin') ? 'admin' : window.location.pathname.startsWith('/staff') ? 'staff' : 'passenger')).toLowerCase();
    logout(role); 
    if (role === 'passenger') {
      window.location.replace('/passenger/login');
    } else {
      window.location.replace('/login');
    }
  };
  const handleLinkClick = () => { if (handleClose) handleClose(); };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const sidebarBg = isPassenger
    ? 'bg-white border-r border-slate-200'
    : '';

  const sidebarStyle = !isPassenger ? {
    background: 'linear-gradient(180deg, #0b1424 0%, #091020 100%)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
  } : {};

  return (
    <aside
      className={`fixed top-16 bottom-0 left-0 z-40 w-64 ${sidebarBg} flex flex-col justify-between transition-transform duration-300 ease-in-out md:sticky md:top-16 md:translate-x-0 h-[calc(100vh-4rem)] ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      style={sidebarStyle}
    >

      {/* User profile card (non-passenger) */}
      {!isPassenger && (
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <div
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 0 12px rgba(239,68,68,0.35)',
              }}
            >
              {getInitials(user.full_name)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-black text-white truncate leading-tight">
                {user.full_name || (isAdmin ? 'Admin User' : 'Staff Officer')}
              </p>
              <span
                className="text-[9px] font-bold uppercase tracking-widest block mt-0.5"
                style={{ color: isAdmin ? '#fca5a5' : '#6ee7b7' }}
              >
                ● {isAdmin ? 'Administrator' : 'Operations Officer'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Passenger mobile close */}
      {isPassenger && (
        <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Navigation</span>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scrollable Nav */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none space-y-1">

        {isAdmin ? (
          <div className="space-y-4 py-2">
            {/* Admin Dashboard link */}
            <NavLink
              to="/admin/dashboard"
              end
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-black transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600/20 text-primary-300 border-l-2 border-primary-500 pl-3'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Home className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary-400' : 'text-slate-500'}`} />
                  <span>Dashboard</span>
                </>
              )}
            </NavLink>

            {adminSections.map((sec, sidx) => (
              <div key={sidx} className="space-y-0.5">
                <p className="px-3 text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1.5 mt-3">{sec.group}</p>
                {sec.items.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={idx}
                      to={item.path}
                      end={item.end}
                      onClick={handleLinkClick}
                      className={({ isActive }) => {
                        const isCurrentActive = isActive ||
                          (item.path === '/admin/staff/duties' && (window.location.pathname === '/admin/staff/duties' || window.location.pathname === '/admin/tasks' || window.location.pathname === '/admin/assigned-tasks')) ||
                          (item.path === '/admin/staff/reports' && (window.location.pathname === '/admin/staff/reports' || window.location.pathname === '/admin/submit-task' || window.location.pathname === '/admin/daily-report'));
                        return `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all duration-200 ${
                          isCurrentActive
                            ? 'bg-primary-600/20 text-primary-300 border-l-2 border-primary-500 pl-3'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                        }`;
                      }}
                    >
                      {({ isActive }) => {
                        const isCurrentActive = isActive ||
                          (item.path === '/admin/staff/duties' && (window.location.pathname === '/admin/staff/duties' || window.location.pathname === '/admin/tasks' || window.location.pathname === '/admin/assigned-tasks')) ||
                          (item.path === '/admin/staff/reports' && (window.location.pathname === '/admin/staff/reports' || window.location.pathname === '/admin/submit-task' || window.location.pathname === '/admin/daily-report'));
                        return (
                          <>
                            <Icon className={`h-4 w-4 flex-shrink-0 ${isCurrentActive ? 'text-primary-400' : 'text-slate-500'}`} />
                            <span>{item.name}</span>
                          </>
                        );
                      }}
                    </NavLink>
                  );
                })}
              </div>
            ))}

            <div className="pt-3">
              <button
                onClick={() => { handleLinkClick(); handleLogout(); }}
                className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-left"
              >
                <LogOut className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        ) : isStaff ? (
          <div className="space-y-1 py-2">
            {staffMenuItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={idx}
                  to={item.path}
                  end={item.path === '/staff/dashboard' || item.path === '/staff'}
                  onClick={handleLinkClick}
                  className={({ isActive }) => {
                    const isCurrentActive = isActive || 
                      (item.path === '/staff/dashboard' && (window.location.pathname === '/staff' || window.location.pathname === '/staff/dashboard')) ||
                      (item.path === '/staff/trains' && (window.location.pathname === '/staff/trains' || window.location.pathname === '/staff/schedules')) ||
                      (item.path === '/staff/train-status' && (window.location.pathname === '/staff/train-status' || window.location.pathname === '/staff/status')) ||
                      (item.path === '/staff/reservations' && (window.location.pathname === '/staff/reservations' || window.location.pathname === '/staff/seats')) ||
                      (item.path === '/staff/bookings' && (window.location.pathname === '/staff/bookings' || window.location.pathname === '/staff/bookings-management')) ||
                      (item.path === '/staff/passengers' && (window.location.pathname === '/staff/passengers' || window.location.pathname === '/staff/users')) ||
                      (item.path === '/staff/cancellation' && (window.location.pathname === '/staff/cancellation' || window.location.pathname === '/staff/cancellations' || window.location.pathname === '/staff/refunds')) ||
                      (item.path === '/staff/tasks' && (window.location.pathname === '/staff/tasks' || window.location.pathname === '/staff/duties' || window.location.pathname === '/staff/assigned-tasks')) ||
                      (item.path === '/staff/daily-report' && (window.location.pathname === '/staff/daily-report' || window.location.pathname === '/staff/submit-task')) ||
                      (item.path === '/staff/ticket-checking' && (window.location.pathname === '/staff/ticket-checking' || window.location.pathname === '/staff/checking'));
                    return `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all duration-200 ${
                      isCurrentActive
                        ? 'bg-emerald-600/20 text-emerald-300 border-l-2 border-emerald-500 pl-3'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }`;
                  }}
                >
                  {({ isActive }) => {
                    const isCurrentActive = isActive || 
                      (item.path === '/staff/dashboard' && (window.location.pathname === '/staff' || window.location.pathname === '/staff/dashboard')) ||
                      (item.path === '/staff/trains' && (window.location.pathname === '/staff/trains' || window.location.pathname === '/staff/schedules')) ||
                      (item.path === '/staff/train-status' && (window.location.pathname === '/staff/train-status' || window.location.pathname === '/staff/status')) ||
                      (item.path === '/staff/reservations' && (window.location.pathname === '/staff/reservations' || window.location.pathname === '/staff/seats')) ||
                      (item.path === '/staff/bookings' && (window.location.pathname === '/staff/bookings' || window.location.pathname === '/staff/bookings-management')) ||
                      (item.path === '/staff/passengers' && (window.location.pathname === '/staff/passengers' || window.location.pathname === '/staff/users')) ||
                      (item.path === '/staff/cancellation' && (window.location.pathname === '/staff/cancellation' || window.location.pathname === '/staff/cancellations' || window.location.pathname === '/staff/refunds')) ||
                      (item.path === '/staff/tasks' && (window.location.pathname === '/staff/tasks' || window.location.pathname === '/staff/duties' || window.location.pathname === '/staff/assigned-tasks')) ||
                      (item.path === '/staff/daily-report' && (window.location.pathname === '/staff/daily-report' || window.location.pathname === '/staff/submit-task')) ||
                      (item.path === '/staff/ticket-checking' && (window.location.pathname === '/staff/ticket-checking' || window.location.pathname === '/staff/checking'));
                    return (
                      <>
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isCurrentActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span>{item.name}</span>
                      </>
                    );
                  }}
                </NavLink>
              );
            })}

            <div className="pt-3">
              <button
                onClick={() => { handleLinkClick(); handleLogout(); }}
                className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-left"
              >
                <LogOut className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        ) : (
          <nav className="py-2">
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={idx}
                  to={item.path}
                  onClick={handleLinkClick}
                  end={['/', '/passenger', '/admin'].includes(item.path)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold mb-0.5 transition-all duration-200 ${
                      isActive
                        ? isPassenger
                          ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600 pl-3'
                          : 'bg-primary-600/15 text-primary-300 border-l-2 border-primary-500 pl-3'
                        : isPassenger
                          ? 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-4 w-4 flex-shrink-0 ${
                          isActive
                            ? isPassenger ? 'text-primary-600' : 'text-primary-400'
                            : isPassenger ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              );
            })}

          </nav>
        )}
      </div>

      {/* Bottom info banner (non-passenger) */}
      {!isPassenger && (
        <div className="px-4 py-4 flex-shrink-0">
          <div
            className="rounded-2xl p-3.5"
            style={{
              background: 'rgba(36,120,242,0.08)',
              border: '1px solid rgba(36,120,242,0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-[10px] font-black text-primary-300 uppercase tracking-wider">Operational Node</span>
            </div>
            <p className="text-[9.5px] text-slate-500 leading-relaxed">
              Secure session. All actions are logged for compliance.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
