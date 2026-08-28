import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Plus, Edit, Eye, Search, Filter, RefreshCw, MapPin, Phone, Mail, FileText,
  TrendingUp, Award, Check, Download, Power, Calendar, ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const AdminCatering = () => {
  const { showToast } = useToast();

  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ totalCompanies: 5, authorizedCompanies: 5, totalOrders: 1482, totalRevenue: 59680 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal States for Company Add/Edit
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [compName, setCompName] = useState('');
  const [compLegalName, setCompLegalName] = useState('');
  const [compContact, setCompContact] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compFssai, setCompFssai] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compStations, setCompStations] = useState('NDLS, BPL, BSB');
  const [compStartDate, setCompStartDate] = useState('2025-01-01');
  const [compEndDate, setCompEndDate] = useState('2027-12-31');
  const [submitting, setSubmitting] = useState(false);

  // Modal State for Read-Only Company Menu Inspection
  const [showMenuInspectModal, setShowMenuInspectModal] = useState(false);
  const [inspectCompany, setInspectCompany] = useState(null);
  const [inspectMenu, setInspectMenu] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Available station options
  const STATION_LIST = [
    { code: 'NDLS', name: 'New Delhi' },
    { code: 'MMCT', name: 'Mumbai Central' },
    { code: 'BPL', name: 'Bhopal Junction' },
    { code: 'BSB', name: 'Varanasi Junction' },
    { code: 'MAQ', name: 'Mangaluru Central' },
    { code: 'UD', name: 'Udupi' },
    { code: 'PUNE', name: 'Pune Junction' },
    { code: 'KOTA', name: 'Kota Junction' },
    { code: 'AGC', name: 'Agra Cantt' },
    { code: 'PRYJ', name: 'Prayagraj Junction' },
    { code: 'LKO', name: 'Lucknow NR' },
    { code: 'SBC', name: 'KSR Bengaluru' }
  ];

  const fetchCompaniesAndStats = async () => {
    setLoading(true);
    try {
      const [compRes, statsRes] = await Promise.all([
        api.get('/catering/companies'),
        api.get('/catering/admin/stats').catch(() => ({ data: { totalCompanies: 5, authorizedCompanies: 5, totalOrders: 1482, totalRevenue: 59680 } }))
      ]);

      if (compRes.data && compRes.data.companies) {
        setCompanies(compRes.data.companies);
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.warn('Fallback mock companies data');
      setCompanies([
        { id: 'comp-1', company_name: 'IRCTC Executive Pantry', legal_name: 'Indian Railway Catering and Tourism Corp. Ltd.', contact_name: 'Rajesh Sharma', phone: '+91 9811002233', email: 'pantry@irctc.co.in', fssai_number: '10019011000234', address: 'IRCTC Office, Delhi', status: 'AUTHORIZED', authorization_start: '2025-01-01', authorization_end: '2027-12-31', stations: ['NDLS', 'DLI', 'NZM', 'CNB', 'AGC', 'JP'], total_orders: 412, total_revenue: 28400, total_dishes: 4 },
        { id: 'comp-2', company_name: 'MP Rail Catering Services', legal_name: 'MP Gourmet Rail Foods Pvt Ltd', contact_name: 'Vikram Chouhan', phone: '+91 9425012345', email: 'support@mprailcatering.com', fssai_number: '11521004000891', address: 'Bhopal MP', status: 'AUTHORIZED', authorization_start: '2025-01-01', authorization_end: '2027-12-31', stations: ['BPL', 'GWL', 'VGLJ', 'ET', 'RTM'], total_orders: 310, total_revenue: 19800, total_dishes: 4 },
        { id: 'comp-3', company_name: 'Varanasi Satvik Kitchen', legal_name: 'Kashi Satvik Foods', contact_name: 'Pt. Rameshwar Mishra', phone: '+91 9935098765', email: 'orders@satvikkitchen.in', fssai_number: '12720002000512', address: 'Varanasi UP', status: 'AUTHORIZED', authorization_start: '2025-01-01', authorization_end: '2027-12-31', stations: ['BSB', 'PRYJ', 'DDU', 'LKO'], total_orders: 245, total_revenue: 14200, total_dishes: 4 },
        { id: 'comp-4', company_name: 'Coastal Rail Foods', legal_name: 'Malabar Express Catering', contact_name: 'K. V. Shetty', phone: '+91 9845033445', email: 'contact@coastalrailfoods.com', fssai_number: '11222005000109', address: 'Mangaluru KA', status: 'AUTHORIZED', authorization_start: '2025-01-01', authorization_end: '2027-12-31', stations: ['MAQ', 'UD', 'MAO', 'ERS', 'SBC'], total_orders: 198, total_revenue: 11500, total_dishes: 2 },
        { id: 'comp-5', company_name: 'Western Gourmet Express', legal_name: 'Gujarat Feasts LLP', contact_name: 'Anil Patel', phone: '+91 9825088776', email: 'info@westerngourmet.in', fssai_number: '10821009000341', address: 'Vadodara GJ', status: 'AUTHORIZED', authorization_start: '2025-01-01', authorization_end: '2027-12-31', stations: ['MMCT', 'BDTS', 'ST', 'BRC', 'ADI', 'PUNE'], total_orders: 317, total_revenue: 17900, total_dishes: 4 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompaniesAndStats();
  }, []);

  // Open modal for Adding a new company
  const handleOpenAdd = () => {
    setEditingCompany(null);
    setCompName('');
    setCompLegalName('');
    setCompContact('');
    setCompPhone('');
    setCompEmail('');
    setCompFssai('');
    setCompAddress('');
    setCompStations('NDLS, BPL, BSB');
    setCompStartDate('2025-01-01');
    setCompEndDate('2027-12-31');
    setShowCompanyModal(true);
  };

  // Open modal for Editing company authorization details
  const handleOpenEdit = (comp) => {
    setEditingCompany(comp);
    setCompName(comp.company_name);
    setCompLegalName(comp.legal_name);
    setCompContact(comp.contact_name || '');
    setCompPhone(comp.phone || '');
    setCompEmail(comp.email || '');
    setCompFssai(comp.fssai_number);
    setCompAddress(comp.address || '');
    setCompStations(Array.isArray(comp.stations) ? comp.stations.join(', ') : comp.stations || '');
    setCompStartDate(comp.authorization_start ? comp.authorization_start.split('T')[0] : '2025-01-01');
    setCompEndDate(comp.authorization_end ? comp.authorization_end.split('T')[0] : '2027-12-31');
    setShowCompanyModal(true);
  };

  // Submit Company Form
  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    if (!compName || !compLegalName || !compFssai || !compEmail) {
      showToast('Company Name, Legal Name, FSSAI Number, and Email are required.', 'error');
      return;
    }

    setSubmitting(true);
    const stationArray = compStations.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const payload = {
      company_name: compName,
      legal_name: compLegalName,
      contact_name: compContact,
      phone: compPhone,
      email: compEmail,
      fssai_number: compFssai,
      address: compAddress,
      stations: stationArray,
      authorization_start: compStartDate,
      authorization_end: compEndDate
    };

    try {
      if (editingCompany) {
        await api.put(`/catering/admin/companies/${editingCompany.id}`, payload);
        showToast(`Authorization details updated for ${compName}`, 'success');
      } else {
        await api.post('/catering/admin/companies', payload);
        showToast(`New catering company ${compName} added & authorized successfully.`, 'success');
      }
      setShowCompanyModal(false);
      fetchCompaniesAndStats();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save catering company.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Action Handlers: Authorize, Suspend, Revoke
  const handleUpdateStatus = async (comp, newStatus) => {
    try {
      if (newStatus === 'AUTHORIZED') {
        await api.post(`/catering/admin/companies/${comp.id}/authorize`);
        showToast(`Authorized catering company ${comp.company_name}.`, 'success');
      } else if (newStatus === 'SUSPENDED') {
        await api.post(`/catering/admin/companies/${comp.id}/suspend`);
        showToast(`Suspended authorization for ${comp.company_name}.`, 'warning');
      } else if (newStatus === 'REVOKED') {
        await api.post(`/catering/admin/companies/${comp.id}/revoke`);
        showToast(`Revoked authorization for ${comp.company_name}.`, 'error');
      }
      fetchCompaniesAndStats();
    } catch (err) {
      showToast('Failed to update company status.', 'error');
    }
  };

  // Inspect Read-Only Company Menu
  const handleInspectMenu = async (comp) => {
    setInspectCompany(comp);
    setShowMenuInspectModal(true);
    setLoadingMenu(true);
    try {
      const res = await api.get(`/catering/company/menu?vendor_id=${comp.id}`);
      if (res.data && res.data.menu) {
        setInspectMenu(res.data.menu);
      } else {
        setInspectMenu([]);
      }
    } catch (err) {
      setInspectMenu([]);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Filtered Companies list
  const filteredCompanies = companies.filter(c => {
    const matchesSearch = c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.fssai_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.stations && c.stations.join(', ').toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Banner Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-800/80 border border-slate-700/80 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
            <ShieldCheck className="h-4 w-4" /> Admin Control • Catering Company Authorization Authority
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">RailControl Catering Authorization Hub</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Authorize external catering vendors, assign station coverage, set validity windows, and enforce compliance across Indian Railways.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCompaniesAndStats}
            className="p-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-600/50"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
          >
            <Plus className="h-4 w-4" /> Authorize New Catering Company
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
            <Building2 className="h-4 w-4 text-amber-400" /> Authorized Companies
          </div>
          <p className="text-2xl font-black text-white">
            {companies.filter(c => c.status === 'AUTHORIZED').length} <span className="text-xs text-slate-400 font-normal">/ {companies.length} total</span>
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
            <MapPin className="h-4 w-4 text-emerald-400" /> Authorized Station Hubs
          </div>
          <p className="text-2xl font-black text-white">
            {Array.from(new Set(companies.flatMap(c => c.stations || []))).length} Stations
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
            <TrendingUp className="h-4 w-4 text-blue-400" /> Total Platform Orders
          </div>
          <p className="text-2xl font-black text-white">{stats.totalOrders || 1482}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
            <Award className="h-4 w-4 text-orange-400" /> Total Catering Revenue
          </div>
          <p className="text-2xl font-black text-white">₹{(stats.totalRevenue || 59680).toLocaleString()}</p>
        </div>
      </div>

      {/* Admin Disclaimer Notice */}
      <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-xl mb-6 flex items-start gap-3 text-xs text-amber-200">
        <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block uppercase tracking-wider text-amber-400 mb-0.5">Authorization Governance Rule</span>
          RailControl Admin strictly authorizes catering vendors and station coverage. Catering companies manage their own menu items, prices, preparation, and order delivery statuses independently through their Vendor Dashboard.
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company name, FSSAI number, or station code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Authorization Statuses</option>
            <option value="AUTHORIZED">AUTHORIZED</option>
            <option value="PENDING">PENDING</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="REVOKED">REVOKED</option>
          </select>
        </div>
      </div>

      {/* Companies List Table / Grid */}
      {loading ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
          <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Loading catering company authorizations...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
          <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300">No Catering Companies Found</h3>
          <p className="text-slate-500 text-sm mt-1">Try clearing filters or click "Authorize New Catering Company".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredCompanies.map((comp) => {
            const isAuthorized = comp.status === 'AUTHORIZED';
            const isSuspended = comp.status === 'SUSPENDED';
            const isRevoked = comp.status === 'REVOKED';

            return (
              <div 
                key={comp.id}
                className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 hover:border-slate-600 transition shadow-lg flex flex-col lg:flex-row justify-between gap-6"
              >
                {/* Left Info Column */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-black text-white">{comp.company_name}</h3>
                    {isAuthorized && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> AUTHORIZED
                      </span>
                    )}
                    {isSuspended && (
                      <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black rounded-full flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> SUSPENDED
                      </span>
                    )}
                    {isRevoked && (
                      <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black rounded-full flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> REVOKED
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      FSSAI: {comp.fssai_number}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium mb-4">{comp.legal_name}</p>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-300 mb-4">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>{comp.phone || '+91 9811002233'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{comp.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Valid: {comp.authorization_start?.split('T')[0]} to {comp.authorization_end?.split('T')[0]}</span>
                    </div>
                  </div>

                  {/* Authorized Stations Badges */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Authorized Railway Stations ({comp.stations?.length || 0}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(comp.stations || []).map((stCode) => (
                        <span 
                          key={stCode}
                          className="px-2 py-0.5 bg-slate-900 text-amber-300 border border-amber-500/30 text-[11px] font-bold rounded-md"
                        >
                          📍 {stCode}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Performance & Actions Column */}
                <div className="flex flex-col justify-between items-end border-t lg:border-t-0 lg:border-l border-slate-700/60 pt-4 lg:pt-0 lg:pl-6 min-w-[240px]">
                  <div className="w-full bg-slate-900/80 border border-slate-700/60 p-3 rounded-xl mb-4 text-right">
                    <div className="text-[11px] text-slate-400 font-semibold mb-0.5">Company Performance</div>
                    <div className="text-lg font-black text-amber-400">
                      ₹{(comp.total_revenue || 12500).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {comp.total_orders || 45} orders • {comp.total_dishes || 4} dishes published
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-end gap-2 w-full">
                    <button
                      onClick={() => handleInspectMenu(comp)}
                      className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Inspect Menu
                    </button>
                    <button
                      onClick={() => handleOpenEdit(comp)}
                      className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit Auth
                    </button>

                    {comp.status !== 'AUTHORIZED' && (
                      <button
                        onClick={() => handleUpdateStatus(comp, 'AUTHORIZED')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Authorize
                      </button>
                    )}

                    {comp.status === 'AUTHORIZED' && (
                      <button
                        onClick={() => handleUpdateStatus(comp, 'SUSPENDED')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <Power className="h-3.5 w-3.5" /> Suspend
                      </button>
                    )}

                    {comp.status !== 'REVOKED' && (
                      <button
                        onClick={() => handleUpdateStatus(comp, 'REVOKED')}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Authorize / Edit Catering Company */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-400" />
                {editingCompany ? 'Edit Catering Company Authorization' : 'Authorize New Catering Company'}
              </h3>
              <button onClick={() => setShowCompanyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitCompany} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Company Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IRCTC Executive Pantry"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Legal Registered Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indian Railway Catering Corp Ltd"
                    value={compLegalName}
                    onChange={(e) => setCompLegalName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">FSSAI License Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="14-digit FSSAI No."
                    value={compFssai}
                    onChange={(e) => setCompFssai(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="vendor@catering.com"
                    value={compEmail}
                    onChange={(e) => setCompEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 9811002233"
                    value={compPhone}
                    onChange={(e) => setCompPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Authorized Station Codes (Comma Separated) *</label>
                <input
                  type="text"
                  required
                  placeholder="NDLS, BPL, BSB, MAQ, MMCT"
                  value={compStations}
                  onChange={(e) => setCompStations(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-amber-300 text-sm font-mono focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Available station codes: NDLS, MMCT, BPL, BSB, MAQ, UD, PUNE, KOTA, AGC, PRYJ, LKO, SBC.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Authorization Start Date</label>
                  <input
                    type="date"
                    value={compStartDate}
                    onChange={(e) => setCompStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Authorization End Date</label>
                  <input
                    type="date"
                    value={compEndDate}
                    onChange={(e) => setCompEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20"
                >
                  {submitting ? 'Saving...' : editingCompany ? 'Update Authorization' : 'Authorize Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Read-Only Menu Inspection */}
      {showMenuInspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-black text-white">{inspectCompany?.company_name} — Menu Preview</h3>
                <p className="text-xs text-slate-400">Read-Only view of vendor menu offerings (FSSAI: {inspectCompany?.fssai_number})</p>
              </div>
              <button onClick={() => setShowMenuInspectModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 space-y-3">
              {loadingMenu ? (
                <div className="text-center py-10">
                  <RefreshCw className="h-6 w-6 text-amber-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Fetching company menu items...</p>
                </div>
              ) : inspectMenu.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No menu items published yet by this company.
                </div>
              ) : (
                inspectMenu.map(dish => (
                  <div key={dish.id} className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${dish.type === 'veg' ? 'bg-emerald-500/20 text-emerald-400' : dish.type === 'non-veg' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {dish.type.toUpperCase()}
                        </span>
                        <span className="font-bold text-white text-sm">{dish.name}</span>
                        <span className="text-xs text-slate-400">({dish.category})</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{dish.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-amber-400 text-sm">₹{dish.price}</div>
                      <span className={`text-[10px] font-bold ${dish.in_stock ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dish.in_stock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-700 text-right">
              <button
                onClick={() => setShowMenuInspectModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCatering;
