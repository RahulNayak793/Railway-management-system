import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, Filter, ShieldAlert, CheckCircle, XCircle, Eye, 
  Calendar, Phone, Mail, Ticket, ArrowUpDown, RefreshCw, X, ChevronLeft, 
  ChevronRight, ChevronsLeft, ChevronsRight, ShieldCheck, UserCheck
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DUMMY_EMAILS = new Set(['m.thompson@transit.com', 'v.malhotra@rail.net', 's.patel@railmail.com', 'alex.rivers@railmail.com', 's.jenkins@globemail.org']);

// Filter to strictly display genuine, authentic passenger profiles in the Passenger Directory
const isRealPassenger = (u) => {
  if (!u) return false;

  // 1. Role: Must be a passenger (strictly exclude staff, admin, and catering providers)
  const role = String(u.role || '').toLowerCase();
  if (role && role !== 'passenger') {
    return false;
  }

  // 2. ID: Exclude internal staff, admin, catering or test IDs
  const idStr = String(u.id || '').toLowerCase();
  if (
    idStr.startsWith('stf-') ||
    idStr.startsWith('adm-') ||
    idStr.includes('staff') ||
    idStr.includes('admin') ||
    idStr.includes('cat-comp') ||
    idStr.includes('test-account') ||
    idStr.includes('test-user') ||
    idStr.includes('unauth') ||
    idStr === 'usr-lwki3j4zo'
  ) {
    return false;
  }

  // 3. Email: Exclude test, internal system, or staff emails
  const email = String(u.email || '').toLowerCase().trim();
  if (
    DUMMY_EMAILS.has(email) ||
    email.includes('testpassenger') ||
    email.includes('@railcontrol.test') ||
    email.endsWith('.test') ||
    email.includes('staff.') ||
    email.includes('@railway.gov.in') ||
    email.includes('admin@railway.com') ||
    email.includes('staff@railway.com') ||
    email.includes('pantry@irctc.co.in') ||
    email.includes('kumar@gmail.com') ||
    email.includes('maheshny@gmail.com')
  ) {
    return false;
  }

  // 4. Name: Exclude synthetic system placeholder names
  const name = String(u.full_name || '').toLowerCase().trim();
  if (
    name === 'test passenger' ||
    name === 'demo passenger' ||
    name === 'staff user' ||
    name === 'staff' ||
    name === 'admin' ||
    name === 'catering_company user' ||
    name === 'kumar' ||
    name === 'mahesh'
  ) {
    return false;
  }

  return true;
};

const AdminUsers = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const hasFullAccess = isAdmin || isStaff;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPassenger, setSelectedPassenger] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [regFilter, setRegFilter] = useState('ALL'); // ALL, NEWEST, OLDEST, CUSTOM
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [bookingActivityFilter, setBookingActivityFilter] = useState('ALL'); // ALL, HAS_BOOKINGS, NO_BOOKINGS, UPCOMING, COMPLETED, CANCELLED
  const [roleFilter, setRoleFilter] = useState('ALL'); // ALL, PASSENGER, STAFF, ADMIN

  // Sort & Pagination State
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, name_asc, email_asc, bookings_desc
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await api.get('/admin/users');
      } catch (e) {
        res = await api.get('/staff/passengers');
      }
      const rawUsers = Array.isArray(res.data) ? res.data : (res.data?.users || res.data?.passengers || []);
      if (Array.isArray(rawUsers)) {
        const filtered = rawUsers
          .filter(isRealPassenger)
          .map(u => ({
            ...u,
            full_name: (u.full_name === 'Valid Traveler' && u.email?.includes('rahul')) ? 'Rahul Patakar' : u.full_name
          }));
        setUsers(filtered);
      }
    } catch (err) {
      console.warn('Failed to fetch user directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isStaff, isAdmin]);

  const handleRoleChange = async (userId, currentRole) => {
    if (!hasFullAccess) return;
    const nextRole = currentRole === 'passenger' ? 'staff' : currentRole === 'staff' ? 'admin' : 'passenger';
    
    try {
      const res = await api.put(`/admin/users/${userId}`, { role: nextRole });
      const updated = users.map(u => {
        if (u.id === userId) {
          return { ...u, role: res.data.user?.role || nextRole };
        }
        return u;
      });
      setUsers(updated);
      alert(`User role successfully changed to ${nextRole}!`);
    } catch (err) {
      console.error('Role update error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to update role';
      alert('Failed to update user role: ' + errMsg);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    if (!hasFullAccess) return;
    const nextStatus = currentStatus === 'Active' ? 'Blocked' : 'Active';
    
    try {
      const res = await api.put(`/admin/users/${userId}`, { status: nextStatus });
      const updated = users.map(u => {
        if (u.id === userId) {
          return { ...u, status: res.data.user?.status || nextStatus };
        }
        return u;
      });
      setUsers(updated);
      alert(`Account status updated to ${nextStatus}!`);
    } catch (err) {
      console.error('Status update error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to update status';
      alert('Failed to update account status: ' + errMsg);
    }
  };

  // Filter & Sort Logic
  const filteredUsers = useMemo(() => {
    let result = users.filter(isRealPassenger);

    // 1. Search Box Filter
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.id && String(u.id).toLowerCase().includes(q)) ||
        (u.irctc_user_id && String(u.irctc_user_id).toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter(u => String(u.status || 'Active').toLowerCase() === statusFilter.toLowerCase());
    }

    // 3. Role Filter
    if (roleFilter !== 'ALL') {
      result = result.filter(u => String(u.role || 'passenger').toLowerCase() === roleFilter.toLowerCase());
    }

    // 4. Registration Filter
    if (regFilter === 'CUSTOM' || fromDate || toDate) {
      if (fromDate) result = result.filter(u => (u.created_at || '2026-01-01') >= fromDate);
      if (toDate) result = result.filter(u => (u.created_at || '2026-01-01') <= toDate + 'T23:59:59');
    }

    // 5. Booking Activity Filter
    if (bookingActivityFilter !== 'ALL') {
      const act = bookingActivityFilter.toLowerCase();
      if (act === 'has_bookings') {
        result = result.filter(u => u.bookings_count > 0 || u.has_bookings);
      } else if (act === 'no_bookings') {
        result = result.filter(u => (u.bookings_count === 0 || !u.has_bookings));
      } else if (act === 'upcoming') {
        result = result.filter(u => u.has_upcoming);
      } else if (act === 'completed') {
        result = result.filter(u => u.has_completed);
      } else if (act === 'cancelled') {
        result = result.filter(u => u.has_cancelled);
      }
    }

    // 6. Sorting
    result.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'newest':
          valA = a.created_at || ''; valB = b.created_at || '';
          return valA > valB ? -1 : 1;
        case 'oldest':
          valA = a.created_at || ''; valB = b.created_at || '';
          return valA < valB ? -1 : 1;
        case 'name_asc':
          valA = a.full_name || ''; valB = b.full_name || '';
          return valA.localeCompare(valB);
        case 'email_asc':
          valA = a.email || ''; valB = b.email || '';
          return valA.localeCompare(valB);
        case 'bookings_desc':
          valA = a.bookings_count || 0; valB = b.bookings_count || 0;
          return valB - valA;
        default:
          return 0;
      }
    });

    return result;
  }, [users, searchTerm, statusFilter, roleFilter, regFilter, fromDate, toDate, bookingActivityFilter, sortBy]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, roleFilter, regFilter, fromDate, toDate, bookingActivityFilter, sortBy, itemsPerPage]);

  // Pagination Calculation
  const totalRecords = filteredUsers.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, startIndex, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setRoleFilter('ALL');
    setRegFilter('ALL');
    setFromDate('');
    setToDate('');
    setBookingActivityFilter('ALL');
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans space-y-6 animate-slide-in">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-purple-50 text-purple-700 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-purple-200">
              Passenger Directory & User Audit
            </span>
            <span className="text-xs text-slate-400 font-bold">• Passenger Dossier Database</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
            Passenger Directory & User Audit
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Search, filter, and inspect registered passenger profiles, IRCTC IDs, and booking activity metrics.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchUsers} 
            disabled={loading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition border border-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Roster</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          {/* SEARCH INPUT */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Passenger Name, Email, Phone, IRCTC ID, User ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500">
              Showing <strong className="text-purple-700 font-mono">{filteredUsers.length}</strong> of <strong className="text-slate-700 font-mono">{users.length}</strong> accounts
            </span>

            {(searchTerm || statusFilter !== 'ALL' || roleFilter !== 'ALL' || regFilter !== 'ALL' || bookingActivityFilter !== 'ALL') && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl border border-rose-200 transition flex items-center space-x-1"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* MULTI-FILTER DROPDOWNS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
          
          {/* STATUS FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Account Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          {/* BOOKING ACTIVITY FILTER */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Booking Activity</label>
            <select
              value={bookingActivityFilter}
              onChange={(e) => setBookingActivityFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Activity</option>
              <option value="HAS_BOOKINGS">Has Bookings</option>
              <option value="NO_BOOKINGS">No Bookings</option>
              <option value="UPCOMING">Active / Upcoming Journey</option>
              <option value="COMPLETED">Completed Journey</option>
              <option value="CANCELLED">Cancelled Booking</option>
            </select>
          </div>

          {/* REGISTRATION DATE PRESET */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Registration Date</label>
            <select
              value={regFilter}
              onChange={(e) => setRegFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Dates</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* SORT BY */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="newest">Registration (Newest)</option>
              <option value="oldest">Registration (Oldest)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="email_asc">Email (A-Z)</option>
              <option value="bookings_desc">Bookings Count (High-Low)</option>
            </select>
          </div>

        </div>

        {/* CUSTOM REGISTRATION DATE RANGE */}
        {regFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Registered From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Registered To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* ROSTER DATABASE TABLE */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400 pl-8">Passenger Identity</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Contact Email & Phone</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">IRCTC User ID</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Bookings Activity</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-400">Status</th>
                <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase text-slate-400 pr-8">Audit Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-r-transparent mx-auto" />
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-xs font-bold text-slate-400">
                    No passenger records match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(u => {
                  const isUserActive = String(u.status || 'Active').toLowerCase() === 'active';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 pl-8">
                        <div className="font-black text-slate-900 text-sm">{u.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {u.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-800">{u.email}</div>
                        <div className="text-[10px] text-slate-500 font-bold">{u.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                          {u.irctc_user_id || `IRCTC_${String(u.id).slice(-6)}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{u.bookings_count || 0} Bookings</div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          {u.has_upcoming ? '● Active Journey' : u.has_completed ? '● Completed Journeys' : 'No Active Journey'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          isUserActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          ● {isUserActive ? 'ACTIVE' : 'BLOCKED'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right pr-8">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setSelectedPassenger(u)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center space-x-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect</span>
                          </button>
                          {hasFullAccess && (
                            <button
                              onClick={() => handleToggleStatus(u.id, isUserActive ? 'Active' : 'Blocked')}
                              className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white transition ${
                                isUserActive ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                              }`}
                            >
                              {isUserActive ? 'Block' : 'Unblock'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <div className="flex items-center space-x-2 font-bold text-slate-600">
            <span>Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalRecords)} of {totalRecords} accounts</span>
            <span className="text-slate-300">•</span>
            <div className="flex items-center space-x-1">
              <span>Per Page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3.5 py-1.5 bg-purple-600 text-white rounded-xl font-black text-xs">
              Page {currentPage} of {totalPages}
            </span>

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* PASSENGER PROFILE DETAIL MODAL */}
      {selectedPassenger && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedPassenger.full_name}</h3>
                  <p className="text-xs text-purple-700 font-mono font-bold">ID: {selectedPassenger.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPassenger(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Account Identity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Email Address</span>
                    <span className="font-mono font-bold text-slate-800">{selectedPassenger.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Phone Number</span>
                    <span className="font-bold text-slate-800">{selectedPassenger.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">IRCTC User ID</span>
                    <span className="font-mono font-bold text-purple-700">{selectedPassenger.irctc_user_id || `IRCTC_${String(selectedPassenger.id).slice(-6)}`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Account Status</span>
                    <span className="font-black text-emerald-700">{selectedPassenger.status || 'Active'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-900 text-white p-4 rounded-2xl border border-purple-800 space-y-2">
                <h4 className="text-[10px] font-black uppercase text-purple-300 tracking-wider">Reservation History Audit</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-300 block text-[10px] font-bold">Total Bookings</span>
                    <span className="font-mono font-black text-white text-base">{selectedPassenger.bookings_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-300 block text-[10px] font-bold">Recent PNR</span>
                    <span className="font-mono font-bold text-white">{selectedPassenger.recent_booking_pnr || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPassenger(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsers;
