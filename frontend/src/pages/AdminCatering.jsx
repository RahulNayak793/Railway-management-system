import React, { useState, useEffect } from 'react';
import { 
  Building2, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Plus, Edit, Eye, Search, Filter, RefreshCw, MapPin, Phone, Mail, FileText,
  TrendingUp, Award, Check, Power, Calendar, Trash2, Utensils, Train,
  Info, AlertCircle, ShoppingBag, ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const AdminCatering = () => {
  const { showToast } = useToast();

  // 3 Primary Control Tabs: 'organizations' (Food Organizations - Default) | 'trains' (On-board Fleet) | 'orders' (Manifest)
  const [activeAdminTab, setActiveAdminTab] = useState('organizations');

  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ totalCompanies: 5, authorizedCompanies: 5, totalOrders: 1482, totalRevenue: 59680 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Train On-Board Catering Configs State
  const [trainConfigs, setTrainConfigs] = useState([]);
  const [loadingTrains, setLoadingTrains] = useState(false);
  const [trainSearchQuery, setTrainSearchQuery] = useState('');
  const [trainAvailabilityFilter, setTrainAvailabilityFilter] = useState('all');

  // Station E-Catering Coverage State
  const [stationCoverage, setStationCoverage] = useState([]);
  const [stationCoverageStats, setStationCoverageStats] = useState({
    station_ecatering_partners: 5,
    covered_stations: 26,
    active_station_services: 32,
    station_food_orders: 1480
  });
  const [availableStationsList, setAvailableStationsList] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [coverageSearch, setCoverageSearch] = useState('');
  const [coverageStatusFilter, setCoverageStatusFilter] = useState('all');
  const [coverageCompanyFilter, setCoverageCompanyFilter] = useState('all');

  // Modal State for Assigning Station Coverage
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCompanyId, setAssignCompanyId] = useState('');
  const [assignStationCode, setAssignStationCode] = useState('NDLS');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Modal States for Train Configuration
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [editingTrain, setEditingTrain] = useState(null);
  const [trainNumberInput, setTrainNumberInput] = useState('');
  const [trainNameInput, setTrainNameInput] = useState('');
  const [trainAvailableInput, setTrainAvailableInput] = useState(true);
  const [trainProviderInput, setTrainProviderInput] = useState('IRCTC On-Board Catering Services');
  const [trainServiceTypeInput, setTrainServiceTypeInput] = useState('Pantry Car');
  const [trainClassesInput, setTrainClassesInput] = useState(['1A', '2A', '3A', 'CC', 'EC', 'SL']);
  const [trainActiveInput, setTrainActiveInput] = useState(true);
  const [submittingTrain, setSubmittingTrain] = useState(false);

  // All Catering Orders Manifest State
  const [manifestOrders, setManifestOrders] = useState([]);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestTypeFilter, setManifestTypeFilter] = useState('all');
  const [manifestTrainFilter, setManifestTrainFilter] = useState('all');

  // Modal States for Company Add/Edit
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [compName, setCompName] = useState('');
  const [compLegalName, setCompLegalName] = useState('');
  const [compServiceType, setCompServiceType] = useState('Station Food Delivery & Pantry');
  const [compContact, setCompContact] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compFssai, setCompFssai] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compStations, setCompStations] = useState('NDLS, BPL, BSB');
  const [compStartDate, setCompStartDate] = useState('2025-01-01');
  const [compEndDate, setCompEndDate] = useState('2027-12-31');
  const [compStatus, setCompStatus] = useState('AUTHORIZED');
  const [compPassword, setCompPassword] = useState('Catering@123');
  const [submitting, setSubmitting] = useState(false);

  // Modal State for Company Menu Inspection & Availability Toggle
  const [showMenuInspectModal, setShowMenuInspectModal] = useState(false);
  const [inspectCompany, setInspectCompany] = useState(null);
  const [inspectMenu, setInspectMenu] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [togglingDishId, setTogglingDishId] = useState(null);

  // States for Adding and Deleting Dishes
  const [showAddDishForm, setShowAddDishForm] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishCategory, setNewDishCategory] = useState('Thali & Combos');
  const [newDishType, setNewDishType] = useState('veg');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [newDishPrepTime, setNewDishPrepTime] = useState(20);
  const [submittingDish, setSubmittingDish] = useState(false);
  const [deletingDishId, setDeletingDishId] = useState(null);

  // Modal State for Organization Catering Orders View
  const [showCompanyOrdersModal, setShowCompanyOrdersModal] = useState(false);
  const [ordersCompany, setOrdersCompany] = useState(null);
  const [companyOrdersList, setCompanyOrdersList] = useState([]);
  const [loadingCompanyOrders, setLoadingCompanyOrders] = useState(false);

  // Modal State for Order Details & Status Updater in Manifest
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);

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
      console.error('Failed to load catering companies:', err);
      showToast('Unable to connect to catering server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainConfigs = async () => {
    setLoadingTrains(true);
    try {
      const res = await api.get('/catering/admin/train-configs');
      if (res.data && res.data.configs) {
        setTrainConfigs(res.data.configs);
      }
    } catch (err) {
      console.warn('Failed to load train configs:', err);
    } finally {
      setLoadingTrains(false);
    }
  };

  const fetchManifestOrders = async () => {
    setLoadingManifest(true);
    try {
      const res = await api.get('/catering/all-orders');
      if (res.data && res.data.orders) {
        setManifestOrders(res.data.orders);
      }
    } catch (err) {
      console.warn('Failed to load all catering orders:', err);
    } finally {
      setLoadingManifest(false);
    }
  };

  const fetchStationCoverage = async () => {
    setLoadingCoverage(true);
    try {
      const res = await api.get('/catering/admin/station-coverage');
      if (res.data) {
        if (Array.isArray(res.data.coverage)) {
          setStationCoverage(res.data.coverage);
        }
        if (res.data.stats) {
          setStationCoverageStats(res.data.stats);
        }
        if (Array.isArray(res.data.available_stations)) {
          setAvailableStationsList(res.data.available_stations);
        }
      }
    } catch (err) {
      console.warn('Failed to load station coverage:', err);
    } finally {
      setLoadingCoverage(false);
    }
  };

  useEffect(() => {
    fetchCompaniesAndStats();
    fetchTrainConfigs();
    fetchManifestOrders();
    fetchStationCoverage();
  }, []);

  // Open modal for Adding a new company
  const handleOpenAdd = () => {
    setEditingCompany(null);
    setCompName('');
    setCompLegalName('');
    setCompServiceType('Station Food Delivery & Pantry');
    setCompContact('');
    setCompPhone('');
    setCompEmail('');
    setCompFssai('');
    setCompAddress('');
    setCompStations('NDLS, BPL, BSB');
    setCompStartDate('2025-01-01');
    setCompEndDate('2027-12-31');
    setCompStatus('AUTHORIZED');
    setCompPassword('Catering@123');
    setShowCompanyModal(true);
  };

  // Open modal for Editing company authorization details
  const handleOpenEdit = (comp) => {
    setEditingCompany(comp);
    setCompName(comp.company_name);
    setCompLegalName(comp.legal_name || comp.company_name);
    setCompServiceType(comp.service_type || comp.business_type || 'Station Food Delivery & Pantry');
    setCompContact(comp.contact_name || '');
    setCompPhone(comp.phone || '');
    setCompEmail(comp.email || comp.login_email || '');
    setCompFssai(comp.fssai_number || '10019011000234');
    setCompAddress(comp.address || '');
    setCompStations(Array.isArray(comp.stations) ? comp.stations.join(', ') : comp.stations || '');
    setCompStartDate(comp.valid_from ? comp.valid_from.split('T')[0] : comp.authorization_start ? comp.authorization_start.split('T')[0] : '2025-01-01');
    setCompEndDate(comp.valid_until ? comp.valid_until.split('T')[0] : comp.authorization_end ? comp.authorization_end.split('T')[0] : '2027-12-31');
    setCompStatus(comp.status ? comp.status.toUpperCase() : 'AUTHORIZED');
    setCompPassword(comp.password || '');
    setShowCompanyModal(true);
  };

  // Submit Company Form
  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    if (!compName || !compEmail) {
      showToast('Organization Name and Email are required.', 'error');
      return;
    }

    setSubmitting(true);
    const stationArray = compStations.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const payload = {
      company_name: compName,
      legal_name: compLegalName || compName,
      service_type: compServiceType,
      business_type: compServiceType,
      contact_name: compContact,
      phone: compPhone,
      email: compEmail,
      login_email: compEmail,
      password: compPassword || 'Catering@123',
      status: compStatus,
      fssai_number: compFssai || `FSSAI-${Date.now()}`,
      address: compAddress,
      stations: stationArray,
      authorization_start: compStartDate,
      authorization_end: compEndDate,
      valid_from: compStartDate,
      valid_until: compEndDate
    };

    try {
      if (editingCompany) {
        await api.put(`/catering/admin/companies/${editingCompany.id}`, payload);
        showToast(`Authorization details updated for "${compName}".`, 'success');
      } else {
        await api.post('/catering/admin/companies', payload);
        showToast(`New catering organization "${compName}" registered successfully.`, 'success');
      }
      setShowCompanyModal(false);
      fetchCompaniesAndStats();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save catering organization.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Status Action Handlers: Authorize, Suspend, Reject
  const handleUpdateStatus = async (comp, newStatus) => {
    try {
      if (newStatus === 'AUTHORIZED') {
        await api.post(`/catering/admin/companies/${comp.id}/authorize`);
        showToast(`Authorized catering organization "${comp.company_name}".`, 'success');
      } else if (newStatus === 'SUSPENDED') {
        await api.post(`/catering/admin/companies/${comp.id}/suspend`);
        showToast(`Suspended authorization for "${comp.company_name}".`, 'warning');
      } else if (newStatus === 'REJECTED') {
        await api.post(`/catering/admin/companies/${comp.id}/reject`);
        showToast(`Rejected authorization for "${comp.company_name}".`, 'warning');
      }
      fetchCompaniesAndStats();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update organization status.', 'error');
    }
  };

  // Inspect Read-Only / Manage Food Availability for Organization Menu
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

  // Toggle Food Availability (Enable / Disable Food Availability)
  const handleToggleDishAvailability = async (dish) => {
    const isAvail = dish.in_stock !== false && dish.is_available !== false;
    const nextVal = !isAvail;
    setTogglingDishId(dish.id);
    try {
      const res = await api.put(`/catering/admin/menu/${dish.id}/availability`, {
        in_stock: nextVal,
        is_available: nextVal
      });
      if (res.data && res.data.dish) {
        setInspectMenu(prev => prev.map(d => d.id === dish.id ? { ...d, in_stock: nextVal, is_available: nextVal } : d));
        showToast(`"${dish.name}" availability set to ${nextVal ? 'AVAILABLE (In Stock)' : 'UNAVAILABLE (Out of Stock)'}.`, 'success');
      }
    } catch (err) {
      showToast('Failed to toggle food availability.', 'error');
    } finally {
      setTogglingDishId(null);
    }
  };

  // Inspect Catering Orders for Organization
  const handleViewCompanyOrders = async (comp) => {
    setOrdersCompany(comp);
    setShowCompanyOrdersModal(true);
    setLoadingCompanyOrders(true);
    try {
      const res = await api.get(`/catering/admin/companies/${comp.id}/orders`);
      if (res.data && res.data.orders) {
        setCompanyOrdersList(res.data.orders);
      } else {
        setCompanyOrdersList([]);
      }
    } catch (err) {
      setCompanyOrdersList([]);
    } finally {
      setLoadingCompanyOrders(false);
    }
  };

  // Delete Catering Partner Organization
  const handleDeleteCompany = async (comp) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${comp.company_name}"? All associated station coverage and food menu items will also be removed.`)) {
      return;
    }
    try {
      await api.delete(`/catering/admin/companies/${comp.id}`);
      showToast(`Catering organization "${comp.company_name}" has been deleted.`, 'success');
      fetchCompaniesAndStats();
      fetchStationCoverage();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete catering organization.', 'error');
    }
  };

  // Add Dish to Organization Menu
  const handleCreateDish = async (e) => {
    e.preventDefault();
    if (!inspectCompany) return;
    if (!newDishName.trim() || !newDishPrice) {
      showToast('Dish name and price are required.', 'error');
      return;
    }
    setSubmittingDish(true);
    try {
      const res = await api.post('/catering/admin/menu', {
        company_id: inspectCompany.id,
        name: newDishName.trim(),
        price: parseFloat(newDishPrice),
        category: newDishCategory,
        type: newDishType,
        description: newDishDesc.trim(),
        prep_time_mins: parseInt(newDishPrepTime, 10) || 20,
        in_stock: true
      });
      if (res.data && res.data.dish) {
        setInspectMenu(prev => [res.data.dish, ...prev]);
        showToast(`Added "${newDishName}" to ${inspectCompany.company_name}'s menu.`, 'success');
        setNewDishName('');
        setNewDishPrice('');
        setNewDishDesc('');
        setShowAddDishForm(false);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add dish to menu.', 'error');
    } finally {
      setSubmittingDish(false);
    }
  };

  // Delete Dish from Menu
  const handleDeleteDish = async (dish) => {
    if (!window.confirm(`Are you sure you want to remove "${dish.name}" from the menu?`)) {
      return;
    }
    setDeletingDishId(dish.id);
    try {
      await api.delete(`/catering/admin/menu/${dish.id}`);
      setInspectMenu(prev => prev.filter(d => d.id !== dish.id));
      showToast(`Dish "${dish.name}" removed from menu.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete dish.', 'error');
    } finally {
      setDeletingDishId(null);
    }
  };

  // Open Order Details Modal
  const handleOpenOrderDetails = (ord) => {
    setSelectedOrder(ord);
    setShowOrderModal(true);
  };

  // Update Order Status in Manifest
  const handleUpdateOrderStatus = async (newStatus) => {
    if (!selectedOrder) return;
    setUpdatingOrderStatus(true);
    try {
      const targetId = selectedOrder.order_id || selectedOrder.id;
      const res = await api.put(`/catering/orders/${targetId}/status`, {
        status: newStatus
      });
      if (res.data && res.data.order) {
        setSelectedOrder(res.data.order);
        setManifestOrders(prev => prev.map(o => (o.order_id === targetId || o.id === targetId) ? res.data.order : o));
        showToast(`Order #${targetId} status updated to ${newStatus}.`, 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update order status.', 'error');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  // Open modal for Adding a train configuration override
  const handleOpenAddTrain = () => {
    setEditingTrain(null);
    setTrainNumberInput('');
    setTrainNameInput('');
    setTrainAvailableInput(true);
    setTrainProviderInput('IRCTC Executive Pantry');
    setTrainServiceTypeInput('Full Pantry Car');
    setTrainClassesInput(['1A', '2A', '3A', 'CC', 'EC', 'SL']);
    setTrainActiveInput(true);
    setShowTrainModal(true);
  };

  // Open modal for Editing train configuration
  const handleOpenEditTrain = (cfg) => {
    setEditingTrain(cfg);
    setTrainNumberInput(String(cfg.train_number || ''));
    setTrainNameInput(cfg.train_name || `Train ${cfg.train_number}`);
    const isAvail = cfg.catering_available !== false && cfg.is_catering_available !== false;
    setTrainAvailableInput(isAvail);
    setTrainProviderInput(cfg.catering_provider || cfg.provider_name || 'IRCTC On-Board Catering Services');
    setTrainServiceTypeInput(cfg.service_type || cfg.pantry_type || 'Full Pantry Car');
    setTrainClassesInput(Array.isArray(cfg.applicable_classes) && cfg.applicable_classes.length > 0 ? cfg.applicable_classes : ['1A', '2A', '3A', 'CC', 'EC', 'SL']);
    setTrainActiveInput(cfg.active !== false && cfg.active_status !== 'INACTIVE');
    setShowTrainModal(true);
  };

  // Submit train configuration update
  const handleSaveTrainConfig = async (e) => {
    e.preventDefault();
    if (!trainNumberInput) {
      showToast('Train number is required.', 'error');
      return;
    }
    setSubmittingTrain(true);
    try {
      await api.put(`/catering/admin/train-configs/${trainNumberInput.trim()}`, {
        train_name: trainNameInput,
        catering_available: trainAvailableInput,
        is_catering_available: trainAvailableInput,
        catering_provider: trainProviderInput,
        provider_name: trainProviderInput,
        service_type: trainServiceTypeInput,
        pantry_type: trainServiceTypeInput,
        applicable_classes: trainClassesInput,
        journey_date: editingTrain?.journey_date || null,
        route: editingTrain?.route || null,
        active: trainActiveInput,
        active_status: trainActiveInput ? 'ACTIVE' : 'INACTIVE'
      });
      showToast(`On-board catering configuration saved for Train ${trainNumberInput}.`, 'success');
      setShowTrainModal(false);
      fetchTrainConfigs();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update train configuration.', 'error');
    } finally {
      setSubmittingTrain(false);
    }
  };

  // Helper to render journey date badge
  const renderJourneyDateBadge = (cfg) => {
    if (cfg.journey_date) {
      try {
        const d = new Date(cfg.journey_date);
        if (!isNaN(d.getTime())) {
          const formatted = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                <Calendar className="h-3 w-3 text-amber-400 shrink-0" />
                {formatted}
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono font-bold tracking-tight">
                Date-Specific
              </span>
            </div>
          );
        }
      } catch (e) {}
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
          <Calendar className="h-3 w-3 text-amber-400 shrink-0" />
          {cfg.journey_date}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
        <Clock className="h-3 w-3 text-slate-500 shrink-0" />
        Daily / Regular
      </span>
    );
  };

  // Filtered Train Configs
  const filteredTrainConfigs = trainConfigs.filter(cfg => {
    const isAvail = cfg.catering_available !== false && cfg.is_catering_available !== false;
    const searchLower = trainSearchQuery.toLowerCase();
    const matchesSearch = !trainSearchQuery || 
                          (cfg.train_number && String(cfg.train_number).toLowerCase().includes(searchLower)) ||
                          (cfg.train_name && cfg.train_name.toLowerCase().includes(searchLower)) ||
                          (cfg.route && cfg.route.toLowerCase().includes(searchLower)) ||
                          (cfg.source && cfg.source.toLowerCase().includes(searchLower)) ||
                          (cfg.destination && cfg.destination.toLowerCase().includes(searchLower)) ||
                          (cfg.journey_date && cfg.journey_date.toLowerCase().includes(searchLower)) ||
                          (cfg.catering_provider && cfg.catering_provider.toLowerCase().includes(searchLower)) ||
                          (cfg.provider_name && cfg.provider_name.toLowerCase().includes(searchLower));

    let matchesFilter = true;
    if (trainAvailabilityFilter === 'udupi_delhi') {
      matchesFilter = Boolean(cfg.is_udupi_to_delhi);
    } else if (trainAvailabilityFilter === 'available') {
      matchesFilter = isAvail;
    } else if (trainAvailabilityFilter === 'disabled') {
      matchesFilter = !isAvail;
    } else if (trainAvailabilityFilter === 'date_specific') {
      matchesFilter = Boolean(cfg.is_date_specific || cfg.journey_date);
    }

    return matchesSearch && matchesFilter;
  });

  // Available trains for manifest filtering
  const availableManifestTrains = React.useMemo(() => {
    const map = new Map();
    manifestOrders.forEach(o => {
      const num = String(o.train_number || '').trim();
      if (num && !map.has(num)) {
        map.set(num, { train_number: num, train_name: o.train_name || `Train ${num}` });
      }
    });
    trainConfigs.forEach(t => {
      const num = String(t.train_number || '').trim();
      if (num && !map.has(num)) {
        map.set(num, { train_number: num, train_name: t.train_name || `Train ${num}` });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.train_number.localeCompare(b.train_number));
  }, [manifestOrders, trainConfigs]);

  // Filtered Manifest Orders
  const filteredManifestOrders = manifestOrders.filter(ord => {
    const matchesSearch = (ord.order_id && ord.order_id.toLowerCase().includes(manifestSearch.toLowerCase())) ||
                          (ord.pnr_number && String(ord.pnr_number).includes(manifestSearch)) ||
                          (ord.train_number && String(ord.train_number).includes(manifestSearch)) ||
                          (ord.train_name && ord.train_name.toLowerCase().includes(manifestSearch.toLowerCase())) ||
                          (ord.passenger_name && ord.passenger_name.toLowerCase().includes(manifestSearch.toLowerCase()));
    const matchesType = manifestTypeFilter === 'all' ||
                        (manifestTypeFilter === 'ONBOARD' ? ord.catering_type === 'ONBOARD' : ord.catering_type !== 'ONBOARD');
    const trNum = String(ord.train_number || '').trim();
    const matchesTrain = manifestTrainFilter === 'all' || trNum === String(manifestTrainFilter).trim();
    return matchesSearch && matchesType && matchesTrain;
  });

  // Filtered Companies list
  const filteredCompanies = companies.filter(c => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
                          c.company_name.toLowerCase().includes(searchLower) ||
                          (c.legal_name && c.legal_name.toLowerCase().includes(searchLower)) ||
                          (c.fssai_number && c.fssai_number.toLowerCase().includes(searchLower)) ||
                          (c.email && c.email.toLowerCase().includes(searchLower)) ||
                          (c.service_type && c.service_type.toLowerCase().includes(searchLower)) ||
                          (c.stations && c.stations.join(', ').toLowerCase().includes(searchLower));
    
    let matchesStatus = true;
    if (statusFilter === 'AUTHORIZED') {
      matchesStatus = c.status === 'AUTHORIZED' || c.status === 'ACTIVE';
    } else if (statusFilter === 'PENDING') {
      matchesStatus = c.status === 'PENDING';
    } else if (statusFilter === 'SUSPENDED') {
      matchesStatus = c.status === 'SUSPENDED';
    } else if (statusFilter === 'REJECTED') {
      matchesStatus = c.status === 'REJECTED' || c.status === 'REVOKED';
    }

    return matchesSearch && matchesStatus;
  });

  // Filtered Station Coverage
  const filteredCoverage = stationCoverage.filter(item => {
    const searchLower = coverageSearch.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      (item.company_name && item.company_name.toLowerCase().includes(searchLower)) ||
      (item.legal_name && item.legal_name.toLowerCase().includes(searchLower)) ||
      (item.station_code && item.station_code.toLowerCase().includes(searchLower)) ||
      (item.station_name && item.station_name.toLowerCase().includes(searchLower));

    let matchesStatus = true;
    if (coverageStatusFilter === 'ACTIVE') {
      matchesStatus = item.is_active;
    } else if (coverageStatusFilter === 'DISABLED') {
      matchesStatus = !item.is_active;
    }

    let matchesCompany = true;
    if (coverageCompanyFilter !== 'all') {
      matchesCompany = item.company_id === coverageCompanyFilter;
    }

    return matchesSearch && matchesStatus && matchesCompany;
  });

  // Assign Station Coverage
  const handleAssignStationCoverage = async (e) => {
    e.preventDefault();
    const targetCompId = assignCompanyId || companies.find(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE')?.id || companies[0]?.id;
    const targetStation = assignStationCode || availableStationsList[0]?.station_code || 'NDLS';

    if (!targetCompId || !targetStation) {
      showToast('Please select both a catering organization and a station.', 'error');
      return;
    }
    setSubmittingAssign(true);
    try {
      const res = await api.post('/catering/admin/station-coverage', {
        company_id: targetCompId,
        station_code: targetStation
      });
      showToast(res.data?.message || 'Station coverage assigned successfully.', 'success');
      setShowAssignModal(false);
      fetchStationCoverage();
      fetchCompaniesAndStats();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Failed to assign station coverage.', 'error');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Toggle Enable / Disable Station Coverage
  const handleToggleStationCoverage = async (company_id, station_code, currentActive) => {
    try {
      const res = await api.put('/catering/admin/station-coverage/toggle', {
        company_id,
        station_code,
        is_active: !currentActive
      });
      showToast(res.data?.message || `Station e-Catering ${!currentActive ? 'enabled' : 'disabled'}.`, 'success');
      setStationCoverage(prev => prev.map(c => 
        (c.company_id === company_id && c.station_code === station_code) 
          ? { ...c, is_active: !currentActive, status: !currentActive ? 'ACTIVE' : 'DISABLED' } 
          : c
      ));
      fetchStationCoverage();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to toggle station service status.', 'error');
    }
  };

  // Remove Station Coverage
  const handleRemoveStationCoverage = async (company_id, station_code, compName) => {
    if (!window.confirm(`Are you sure you want to remove ${station_code} coverage from ${compName}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/catering/admin/station-coverage/${company_id}/${station_code}`);
      showToast(res.data?.message || 'Station coverage removed.', 'success');
      setStationCoverage(prev => prev.filter(c => !(c.company_id === company_id && c.station_code === station_code)));
      fetchStationCoverage();
      fetchCompaniesAndStats();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove station coverage.', 'error');
    }
  };

  // Summary counts
  const authorizedCount = companies.filter(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE').length;
  const pendingCount = companies.filter(c => c.status === 'PENDING').length;
  const activeServicesCount = trainConfigs.filter(t => t.catering_available !== false && t.is_catering_available !== false).length;
  const cateringOrdersCount = manifestOrders.length || stats.totalOrders || 1482;

  // Helper date formatter
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal).split('T')[0];
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return String(dateVal);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Banner Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-800/80 border border-slate-700/80 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-1.5 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Admin Control • Catering Authorization Authority
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono text-[10px]">
              PROJECT DATABASE / DEMO DATA
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px]">
              IRCTC / PRS LIVE: CONNECTED
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">RailControl — Catering Administration</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Authorize food organizations, set validity windows, assign service types & station coverage, view menus & orders, and manage food availability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchCompaniesAndStats();
              fetchTrainConfigs();
              fetchManifestOrders();
              fetchStationCoverage();
            }}
            className="p-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-600/50 cursor-pointer"
            title="Refresh All Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading || loadingTrains || loadingManifest || loadingCoverage ? 'animate-spin' : ''}`} />
          </button>
          
          {activeAdminTab === 'organizations' && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Food Organization
            </button>
          )}

          {activeAdminTab === 'station_ecatering' && (
            <button
              onClick={() => {
                const firstAuth = companies.find(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE') || companies[0];
                setAssignCompanyId(firstAuth?.id || 'comp-1');
                setAssignStationCode(availableStationsList[0]?.station_code || 'NDLS');
                setShowAssignModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Assign Station Coverage
            </button>
          )}

          {activeAdminTab === 'trains' && (
            <button
              onClick={handleOpenAddTrain}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Train On-Board Config
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards: Dynamic according to active tab */}
      {activeAdminTab === 'station_ecatering' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <Building2 className="h-4 w-4 text-emerald-400" /> Station E-Catering Partners
            </div>
            <p className="text-3xl font-black text-white">{stationCoverageStats.station_ecatering_partners}</p>
            <p className="text-[11px] text-emerald-400/90 font-medium mt-1">Authorized Food Organizations</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <MapPin className="h-4 w-4 text-amber-400" /> Covered Stations
            </div>
            <p className="text-3xl font-black text-white">{stationCoverageStats.covered_stations}</p>
            <p className="text-[11px] text-amber-400/90 font-medium mt-1">Distinct Railway Stations Covered</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" /> Active Station Services
            </div>
            <p className="text-3xl font-black text-white">{stationCoverageStats.active_station_services}</p>
            <p className="text-[11px] text-blue-400/90 font-medium mt-1">Station Delivery Mappings</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <ShoppingBag className="h-4 w-4 text-purple-400" /> Station Food Orders
            </div>
            <p className="text-3xl font-black text-white">{stationCoverageStats.station_food_orders}</p>
            <p className="text-[11px] text-purple-400/90 font-medium mt-1">Station Platform Delivered Orders</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Authorized Organizations
            </div>
            <p className="text-3xl font-black text-white">{authorizedCount}</p>
            <p className="text-[11px] text-emerald-400/90 font-medium mt-1">Verified & Active Providers</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <Clock className="h-4 w-4 text-amber-400" /> Pending Organizations
            </div>
            <p className="text-3xl font-black text-white">{pendingCount}</p>
            <p className="text-[11px] text-amber-400/90 font-medium mt-1">Awaiting Authorization Review</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <Train className="h-4 w-4 text-blue-400" /> Active Catering Services
            </div>
            <p className="text-3xl font-black text-white">{activeServicesCount}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Of {trainConfigs.length} configured trains</p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl shadow-lg hover:border-slate-600 transition">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-2">
              <FileText className="h-4 w-4 text-purple-400" /> Catering Orders
            </div>
            <p className="text-3xl font-black text-white">{cateringOrdersCount}</p>
            <p className="text-[11px] text-purple-400/90 font-medium mt-1">Network Catering Manifest</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveAdminTab('organizations')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'organizations'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Food Organizations</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-amber-300 font-mono">
            {companies.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('station_ecatering')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'station_ecatering'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span>Station E-Catering</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-emerald-300 font-mono">
            {stationCoverage.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('trains')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'trains'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Train className="h-4 w-4" />
          <span>Train On-Board Services</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {trainConfigs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('orders')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeAdminTab === 'orders'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Catering Orders Manifest</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-blue-300 font-mono">
            {manifestOrders.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FOOD ORGANIZATIONS (PRIMARY VIEW) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'organizations' && (
        <div className="space-y-6">
          {/* Disclaimer & Context Banner */}
          <div className="bg-slate-800/60 border border-slate-700/80 p-4 rounded-xl flex items-start justify-between gap-4 text-xs text-slate-300">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-400 block uppercase tracking-wider mb-0.5">
                  Railway Catering Organization Governance (Admin Authorization)
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Only <strong>Admin</strong> has authority to register and authorize catering organizations. Passengers will only see and order food from organizations with <strong>AUTHORIZED</strong> status.
                </p>
              </div>
            </div>
            <span className="shrink-0 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px] rounded-md font-bold">
              PROJECT DATABASE / DEMO DATA
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search organizations by name, legal name, FSSAI number, or station..."
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
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="all">All Statuses ({companies.length})</option>
                <option value="AUTHORIZED">Authorized ({authorizedCount})</option>
                <option value="PENDING">Pending ({pendingCount})</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Organization Table */}
          {loading ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Loading catering organizations...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300">No Organizations Found</h3>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your search criteria or register a new catering organization.</p>
              <button
                onClick={handleOpenAdd}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                + Add Organization
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-800/60 border border-slate-700/80 rounded-2xl shadow-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/70 text-slate-300 text-xs uppercase tracking-wider font-mono">
                    <th className="py-4 px-4 font-bold">Organization</th>
                    <th className="py-4 px-4 font-bold">Service Type</th>
                    <th className="py-4 px-4 font-bold">Coverage</th>
                    <th className="py-4 px-4 font-bold whitespace-nowrap">Valid From</th>
                    <th className="py-4 px-4 font-bold whitespace-nowrap">Valid Until</th>
                    <th className="py-4 px-4 font-bold">Status</th>
                    <th className="py-4 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredCompanies.map((comp) => {
                    const isAuthorized = comp.status === 'AUTHORIZED' || comp.status === 'ACTIVE';
                    const isPending = comp.status === 'PENDING';
                    const isSuspended = comp.status === 'SUSPENDED';
                    const isRejected = comp.status === 'REJECTED' || comp.status === 'REVOKED';

                    return (
                      <tr key={comp.id} className="hover:bg-slate-700/30 transition">
                        {/* 1. Organization */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm flex items-center gap-1.5">
                              <Building2 className="h-4 w-4 text-amber-400 shrink-0" />
                              {comp.company_name}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {comp.legal_name || comp.company_name}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                FSSAI: {comp.fssai_number || '10019011000234'}
                              </span>
                              {comp.email && (
                                <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={comp.email}>
                                  {comp.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Service Type */}
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 inline-block">
                            {comp.service_type || comp.business_type || 'Station Food Delivery & Pantry'}
                          </span>
                        </td>

                        {/* 3. Coverage */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {Array.isArray(comp.stations) && comp.stations.length > 0 ? (
                              comp.stations.slice(0, 5).map(stn => (
                                <span key={stn} className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[10px] font-bold border border-slate-700">
                                  {stn}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500 italic">Network Fleet</span>
                            )}
                            {Array.isArray(comp.stations) && comp.stations.length > 5 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] border border-slate-700">
                                +{comp.stations.length - 5}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Valid From */}
                        <td className="py-4 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                          {formatDateDisplay(comp.valid_from || comp.authorization_start)}
                        </td>

                        {/* 5. Valid Until */}
                        <td className="py-4 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                          {formatDateDisplay(comp.valid_until || comp.authorization_end)}
                        </td>

                        {/* 6. Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {isAuthorized && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> AUTHORIZED
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> PENDING
                            </span>
                          )}
                          {isSuspended && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> SUSPENDED
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 inline-flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> REJECTED
                            </span>
                          )}
                        </td>

                        {/* 7. Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Authorize action */}
                            {!isAuthorized && (
                              <button
                                onClick={() => handleUpdateStatus(comp, 'AUTHORIZED')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                title="Authorize Organization"
                              >
                                <Check className="h-3 w-3" /> Authorize
                              </button>
                            )}

                            {/* Suspend action */}
                            {isAuthorized && (
                              <button
                                onClick={() => handleUpdateStatus(comp, 'SUSPENDED')}
                                className="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                title="Suspend Organization"
                              >
                                <AlertTriangle className="h-3 w-3" /> Suspend
                              </button>
                            )}

                            {/* Reject action */}
                            {!isRejected && (
                              <button
                                onClick={() => handleUpdateStatus(comp, 'REJECTED')}
                                className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                title="Reject / Revoke"
                              >
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            )}

                            {/* Edit action */}
                            <button
                              onClick={() => handleOpenEdit(comp)}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                              title="Edit Details"
                            >
                              <Edit className="h-3 w-3" /> Edit
                            </button>

                            {/* View / Manage Menu */}
                            <button
                              onClick={() => handleInspectMenu(comp)}
                              className="px-2.5 py-1 bg-slate-700/60 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 border border-slate-600/50 cursor-pointer"
                              title="View & Manage Organization Menu"
                            >
                              <Utensils className="h-3 w-3" /> Menu
                            </button>

                            {/* View Orders */}
                            <button
                              onClick={() => handleViewCompanyOrders(comp)}
                              className="px-2.5 py-1 bg-slate-700/60 hover:bg-slate-700 text-blue-300 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 border border-slate-600/50 cursor-pointer"
                              title="View Orders Placed with this Organization"
                            >
                              <FileText className="h-3 w-3" /> Orders
                            </button>

                            {/* Delete Organization */}
                            <button
                              onClick={() => handleDeleteCompany(comp)}
                              className="p-1.5 bg-slate-700/60 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-600/50 transition cursor-pointer"
                              title="Delete Organization"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: STATION E-CATERING MANAGEMENT */}
      {/* ========================================================================= */}
      {activeAdminTab === 'station_ecatering' && (
        <div className="space-y-6">
          {/* Section Header & Railway Context */}
          <div className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-black text-white tracking-tight">Station E-Catering Management</h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-bold">
                    PROJECT DATABASE / DEMO DATA
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px]">
                    IRCTC / PRS LIVE: CONNECTED
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-3xl">
                  <strong>Station E-Catering:</strong> Food is delivered at the selected railway station terminal upon train arrival. Availability depends strictly on authorized station coverage, food availability, and configured cutoff times — it <em>does not require</em> the passenger&apos;s train to have departed.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => {
                  const firstAuth = companies.find(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE') || companies[0];
                  setAssignCompanyId(firstAuth?.id || 'comp-1');
                  setAssignStationCode(availableStationsList[0]?.station_code || 'NDLS');
                  setShowAssignModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Assign Station Coverage
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by organization, station name, or station code (e.g. NDLS, BPL, BSB, MMCT)..."
                value={coverageSearch}
                onChange={(e) => setCoverageSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={coverageStatusFilter}
                  onChange={(e) => setCoverageStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-800 text-slate-200">All Coverage ({stationCoverage.length})</option>
                  <option value="ACTIVE" className="bg-slate-800 text-emerald-400">Active Only</option>
                  <option value="DISABLED" className="bg-slate-800 text-rose-400">Disabled Only</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Partner:</span>
                <select
                  value={coverageCompanyFilter}
                  onChange={(e) => setCoverageCompanyFilter(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-bold focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="all" className="bg-slate-800 text-slate-200">All Partners</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-800 text-slate-200">
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Station Coverage Table */}
          {loadingCoverage ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Loading station coverage records...</p>
            </div>
          ) : filteredCoverage.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <MapPin className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300">No Station Coverage Found</h3>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your search criteria or assign a new station to an authorized catering partner.</p>
              <button
                onClick={() => {
                  const firstAuth = companies.find(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE') || companies[0];
                  setAssignCompanyId(firstAuth?.id || 'comp-1');
                  setAssignStationCode(availableStationsList[0]?.station_code || 'NDLS');
                  setShowAssignModal(true);
                }}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                + Assign Station Coverage
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-800/40 border border-slate-700/60 rounded-2xl shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-750 bg-slate-850/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-5">Organization</th>
                    <th className="py-4 px-5">Station</th>
                    <th className="py-4 px-5">Station Code</th>
                    <th className="py-4 px-5">Food Availability</th>
                    <th className="py-4 px-5">Valid From</th>
                    <th className="py-4 px-5">Valid Until</th>
                    <th className="py-4 px-5">Status</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredCoverage.map((item) => {
                    const comp = companies.find(c => c.id === item.company_id) || {
                      id: item.company_id,
                      company_name: item.company_name,
                      legal_name: item.legal_name,
                      fssai_number: item.fssai_number,
                      status: item.company_status
                    };

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/50 transition border-b border-slate-800/60 text-sm">
                        {/* 1. Organization */}
                        <td className="px-5 py-4">
                          <div>
                            <span className="font-bold text-white block text-sm">{item.company_name}</span>
                            <span className="text-xs text-slate-400 block">{item.legal_name}</span>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-850 border border-slate-700 text-slate-300">
                              FSSAI: {item.fssai_number}
                            </span>
                          </div>
                        </td>

                        {/* 2. Station */}
                        <td className="px-5 py-4 font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                            <span>{item.station_name}</span>
                          </div>
                        </td>

                        {/* 3. Station Code */}
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-amber-500/40 text-amber-400 font-mono font-bold text-xs tracking-wider">
                            {item.station_code}
                          </span>
                        </td>

                        {/* 4. Food Availability */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${item.available_dishes > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span className="text-xs font-semibold text-slate-200">
                              {item.available_dishes} / {item.total_dishes} Dishes Available
                            </span>
                          </div>
                          <button
                            onClick={() => handleInspectMenu(comp)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium mt-0.5 cursor-pointer block"
                          >
                            Toggle Food Items
                          </button>
                        </td>

                        {/* 5. Valid From */}
                        <td className="px-5 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">
                          {formatDateDisplay(item.valid_from)}
                        </td>

                        {/* 6. Valid Until */}
                        <td className="px-5 py-4 text-xs font-mono text-slate-300 whitespace-nowrap">
                          {formatDateDisplay(item.valid_until)}
                        </td>

                        {/* 7. Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {item.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                              DISABLED
                            </span>
                          )}
                        </td>

                        {/* 8. Actions */}
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Enable / Disable toggle button */}
                            <button
                              onClick={() => handleToggleStationCoverage(item.company_id, item.station_code, item.is_active)}
                              className={`px-2.5 py-1 rounded-lg border font-bold text-xs transition inline-flex items-center gap-1 cursor-pointer ${
                                item.is_active
                                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              }`}
                              title={item.is_active ? 'Disable Station E-Catering for this station' : 'Enable Station E-Catering for this station'}
                            >
                              <Power className="h-3 w-3" />
                              <span>{item.is_active ? 'Disable' : 'Enable'}</span>
                            </button>

                            {/* View / Manage Menu button */}
                            <button
                              onClick={() => handleInspectMenu(comp)}
                              className="px-2.5 py-1 bg-slate-700/60 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 border border-slate-600/50 cursor-pointer"
                              title="View & Toggle Food Availability"
                            >
                              <Utensils className="h-3 w-3" /> Menu
                            </button>

                            {/* View Station Orders */}
                            <button
                              onClick={() => handleViewCompanyOrders(comp)}
                              className="px-2.5 py-1 bg-slate-700/60 hover:bg-slate-700 text-blue-300 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 border border-slate-600/50 cursor-pointer"
                              title="View Station Food Orders"
                            >
                              <ShoppingBag className="h-3 w-3" /> Orders
                            </button>

                            {/* Remove Station Coverage */}
                            <button
                              onClick={() => handleRemoveStationCoverage(item.company_id, item.station_code, item.company_name)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition cursor-pointer"
                              title="Remove Station Coverage"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TRAIN ON-BOARD FLEET SERVICES */}
      {/* ========================================================================= */}
      {activeAdminTab === 'trains' && (
        <div className="space-y-6">
          <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-200">
            <Utensils className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block uppercase tracking-wider text-amber-400 mb-0.5">
                Train On-Board Catering Fleet Service Governance
              </span>
              Configure pantry car availability, assigned catering providers, and eligible passenger travel classes across express train services.
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by train number, train name, or catering provider..."
                value={trainSearchQuery}
                onChange={(e) => setTrainSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={trainAvailabilityFilter}
                onChange={(e) => setTrainAvailabilityFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Fleets ({trainConfigs.length})</option>
                <option value="available">Catering Enabled ({activeServicesCount})</option>
                <option value="disabled">Catering Disabled</option>
                <option value="date_specific">Date-Specific Services</option>
              </select>
            </div>
          </div>

          {/* Train Configs Grid */}
          {loadingTrains ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Loading train catering fleet configurations...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrainConfigs.map((cfg) => {
                const isAvail = cfg.catering_available !== false && cfg.is_catering_available !== false;
                return (
                  <div key={cfg.train_number} className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-600 transition">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-amber-400 text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          #{cfg.train_number}
                        </span>
                        {renderJourneyDateBadge(cfg)}
                      </div>
                      <h4 className="font-bold text-white text-base leading-snug">{cfg.train_name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{cfg.route || `${cfg.source} → ${cfg.destination}`}</p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-700/70 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Pantry Provider:</span>
                        <span className="font-semibold text-slate-200 truncate max-w-[170px]" title={cfg.catering_provider || cfg.provider_name}>
                          {cfg.catering_provider || cfg.provider_name || 'IRCTC On-Board Catering'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Service Type:</span>
                        <span className="text-slate-300 font-medium">{cfg.service_type || 'Full Pantry Car'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Catering Status:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAvail ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                          {isAvail ? 'AVAILABLE' : 'DISABLED'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700 flex justify-end">
                      <button
                        onClick={() => handleOpenEditTrain(cfg)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="h-3 w-3" /> Configure Fleet
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATERING ORDERS MANIFEST */}
      {/* ========================================================================= */}
      {activeAdminTab === 'orders' && (
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-xl flex items-start gap-3 text-xs text-slate-300">
            <FileText className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block uppercase tracking-wider text-blue-400 mb-0.5">
                Central Railway Catering Manifest
              </span>
              Complete log of all passenger food orders placed across On-Board Pantry services and Station Delivery partners.
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders by order ID, PNR, train number, or passenger name..."
                value={manifestSearch}
                onChange={(e) => setManifestSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={manifestTypeFilter}
                onChange={(e) => setManifestTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Service Types</option>
                <option value="ONBOARD">🍱 On-Board Train Catering</option>
                <option value="STATION">🚉 Station eCatering</option>
              </select>

              <Train className="h-4 w-4 text-slate-400 ml-1" />
              <select
                value={manifestTrainFilter}
                onChange={(e) => setManifestTrainFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="all">🚆 All Trains / Services</option>
                {availableManifestTrains.map(t => (
                  <option key={t.train_number} value={t.train_number}>
                    {t.train_number} - {t.train_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Manifest Table */}
          {loadingManifest ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Loading catering orders manifest...</p>
            </div>
          ) : filteredManifestOrders.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-slate-700/60">
              <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300">No Orders in Manifest</h3>
              <p className="text-slate-500 text-sm mt-1">Passenger catering orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-800/60 border border-slate-700/80 rounded-2xl shadow-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4 font-bold">Order ID & Time</th>
                    <th className="py-3.5 px-4 font-bold">Service Type</th>
                    <th className="py-3.5 px-4 font-bold">Train & PNR</th>
                    <th className="py-3.5 px-4 font-bold">Passenger & Target</th>
                    <th className="py-3.5 px-4 font-bold">Items & Amount</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredManifestOrders.map((ord) => {
                    const isOnboard = ord.catering_type === 'ONBOARD';
                    return (
                      <tr key={ord.order_id || ord.id} className="hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-black text-white text-xs">{ord.order_id || ord.id}</div>
                          <div className="text-[10px] text-slate-400">
                            {ord.order_time ? new Date(ord.order_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isOnboard ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                              🍱 ON-BOARD
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 inline-flex items-center gap-1">
                              🚉 STATION
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs">
                          <div className="font-bold text-white flex items-center gap-1">
                            <Train className="h-3 w-3 text-amber-400" />
                            <span>Train {ord.train_number || '12952'}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-sans font-semibold mt-0.5">
                            {ord.train_name || 'Express Service'}
                          </div>
                          <div className="text-[10px] text-slate-400">PNR: {ord.pnr_number || ord.pnr}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">{ord.passenger_name || 'Passenger'}</div>
                          {isOnboard ? (
                            <div className="text-[11px] text-amber-300 font-mono font-semibold">
                              Coach {ord.coach_number || 'B1'}, Seat {ord.seat_number || '12'}
                            </div>
                          ) : (
                            <div className="text-[11px] text-blue-300 font-mono font-semibold">
                              Station {ord.delivery_station_code || ord.station_code || 'NDLS'}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-slate-200">
                            {(ord.items || []).map(i => `${i.qty || 1}x ${i.name}`).join(', ') || 'Catering Meal'}
                          </div>
                          <div className="font-mono font-black text-amber-400 text-xs mt-0.5">
                            {ord.total_amount === 0 || ord.payment_status === 'COMPLIMENTARY' || ord.payment_status === 'Included in Ticket' ? (
                              <span className="text-emerald-400">INCLUDED</span>
                            ) : (
                              `₹${ord.total_amount}`
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                            ord.status === 'DELIVERED'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : ord.status === 'CANCELLED'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}>
                            {ord.status || 'CONFIRMED'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenOrderDetails(ord)}
                            className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 border border-slate-600/50 cursor-pointer"
                            title="View Details & Update Status"
                          >
                            <Eye className="h-3 w-3" /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT CATERING ORGANIZATION (Admin Only) */}
      {/* ========================================================================= */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-400" />
                {editingCompany ? 'Edit Catering Organization' : 'Register New Food Organization'}
              </h3>
              <button onClick={() => setShowCompanyModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmitCompany} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Organization Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Northern Rail Dining Services"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Legal Registered Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Northern Rail Dining Corp Ltd"
                    value={compLegalName}
                    onChange={(e) => setCompLegalName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Service Type *</label>
                  <select
                    value={compServiceType}
                    onChange={(e) => setCompServiceType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  >
                    <option value="Station Food Delivery & Pantry">Station Food Delivery & Pantry</option>
                    <option value="Full Pantry Car & Fleet Dining">Full Pantry Car & Fleet Dining</option>
                    <option value="Multi-Station Gourmet Delivery">Multi-Station Gourmet Delivery</option>
                    <option value="Pure Veg & Satvik Cuisine">Pure Veg & Satvik Cuisine</option>
                    <option value="Regional Station Catering">Regional Station Catering</option>
                    <option value="Express Berth Catering">Express Berth Catering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">FSSAI License Number</label>
                  <input
                    type="text"
                    placeholder="14-digit FSSAI No."
                    value={compFssai}
                    onChange={(e) => setCompFssai(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="partner@railcatering.com"
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
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Station Coverage (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="NDLS, BPL, BSB, MAQ, MMCT, PUNE, KOTA"
                  value={compStations}
                  onChange={(e) => setCompStations(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-amber-300 text-sm font-mono focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Assigned stations where this organization delivers meals to train passengers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Valid From *</label>
                  <input
                    type="date"
                    required
                    value={compStartDate}
                    onChange={(e) => setCompStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={compEndDate}
                    onChange={(e) => setCompEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Authorization Status *</label>
                  <select
                    value={compStatus}
                    onChange={(e) => setCompStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  >
                    <option value="AUTHORIZED">Authorized</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingCompany ? 'Update Organization' : 'Save Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ORGANIZATION MENU & FOOD AVAILABILITY TOGGLES (Admin Control) */}
      {/* ========================================================================= */}
      {showMenuInspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-amber-400" />
                  {inspectCompany?.company_name} — Food Menu & Availability
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage dishes, toggle availability in real-time, or add regional railway specialties.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDishForm(!showAddDishForm)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> {showAddDishForm ? 'Close Form' : '+ Add Dish'}
                </button>
                <button onClick={() => setShowMenuInspectModal(false)} className="text-slate-400 hover:text-white cursor-pointer p-1">✕</button>
              </div>
            </div>

            {/* Inline Add Dish Form */}
            {showAddDishForm && (
              <form onSubmit={handleCreateDish} className="p-4 my-3 bg-slate-800/90 border border-amber-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add New Dish to {inspectCompany?.company_name}
                  </h4>
                  <span className="text-[10px] text-slate-400">Admin Live Catalog Registration</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Dish Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Banarasi Dum Aloo with Poori"
                      value={newDishName}
                      onChange={(e) => setNewDishName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="10"
                      placeholder="180"
                      value={newDishPrice}
                      onChange={(e) => setNewDishPrice(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono text-xs focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Category</label>
                    <select
                      value={newDishCategory}
                      onChange={(e) => setNewDishCategory(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-amber-500"
                    >
                      <option value="Thali & Combos">Thali & Combos</option>
                      <option value="Regional Specials">Regional Specials</option>
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Beverages">Beverages</option>
                      <option value="Desserts">Desserts</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Food Type</label>
                    <select
                      value={newDishType}
                      onChange={(e) => setNewDishType(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-amber-500"
                    >
                      <option value="veg">🟢 Veg</option>
                      <option value="non-veg">🔴 Non-Veg</option>
                      <option value="jain">🟡 Jain / Satvik</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Prep Time (mins)</label>
                    <input
                      type="number"
                      min="5"
                      value={newDishPrepTime}
                      onChange={(e) => setNewDishPrepTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Freshly prepared with authentic spices and served hot"
                    value={newDishDesc}
                    onChange={(e) => setNewDishDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddDishForm(false)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDish}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {submittingDish ? 'Adding...' : 'Save Dish'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1">
              {loadingMenu ? (
                <div className="text-center py-10">
                  <RefreshCw className="h-6 w-6 text-amber-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading organization menu...</p>
                </div>
              ) : inspectMenu.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No menu items found for this organization. Use "+ Add Dish" above to add items.
                </div>
              ) : (
                inspectMenu.map(dish => {
                  const isAvailable = dish.in_stock !== false && dish.is_available !== false;
                  return (
                    <div key={dish.id} className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            dish.type === 'veg' ? 'bg-emerald-500/20 text-emerald-400' :
                            dish.type === 'non-veg' ? 'bg-rose-500/20 text-rose-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {(dish.type || 'VEG').toUpperCase()}
                          </span>
                          <span className="font-bold text-white text-sm">{dish.name}</span>
                          <span className="text-xs text-slate-400">({dish.category || 'Meal'})</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-snug">{dish.description}</p>
                        <div className="font-mono font-black text-amber-400 text-sm mt-1">₹{dish.price}</div>
                      </div>

                      {/* Actions: Availability Toggle & Delete Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={togglingDishId === dish.id}
                          onClick={() => handleToggleDishAvailability(dish)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                            isAvailable
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {isAvailable ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" /> In Stock (Available)
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" /> Out of Stock (Disabled)
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={deletingDishId === dish.id}
                          onClick={() => handleDeleteDish(dish)}
                          className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition cursor-pointer"
                          title="Delete Dish from Menu"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-700 text-right">
              <button
                onClick={() => setShowMenuInspectModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer"
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ORGANIZATION CATERING ORDERS VIEW (Admin Only) */}
      {/* ========================================================================= */}
      {showCompanyOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-blue-400" />
                  {ordersCompany?.company_name} — Catering Orders
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Orders fulfilled or assigned to this organization.
                </p>
              </div>
              <button onClick={() => setShowCompanyOrdersModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1">
              {loadingCompanyOrders ? (
                <div className="text-center py-10">
                  <RefreshCw className="h-6 w-6 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading orders...</p>
                </div>
              ) : companyOrdersList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No orders recorded yet for this organization.
                </div>
              ) : (
                companyOrdersList.map(ord => (
                  <div key={ord.order_id || ord.id} className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs">{ord.order_id || ord.id}</span>
                        <span className="text-slate-400">PNR: {ord.pnr_number || ord.pnr}</span>
                      </div>
                      <span className="font-mono font-bold text-amber-400">₹{ord.total_amount || 0}</span>
                    </div>
                    <div className="text-slate-300">
                      {(ord.items || []).map(i => `${i.qty || 1}x ${i.name}`).join(', ') || 'Catering meal'}
                    </div>
                    <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1 border-t border-slate-700/60">
                      <span>Passenger: {ord.passenger_name || 'Passenger'} • Train #{ord.train_number}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-emerald-400 uppercase">
                        {ord.status || 'CONFIRMED'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-700 text-right">
              <button
                onClick={() => setShowCompanyOrdersModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: TRAIN ON-BOARD FLEET CONFIG MODAL */}
      {/* ========================================================================= */}
      {showTrainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Train className="h-5 w-5 text-amber-400" />
                {editingTrain ? `Configure Train #${editingTrain.train_number}` : 'Add Train On-Board Config'}
              </h3>
              <button onClick={() => setShowTrainModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveTrainConfig} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Train Number *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingTrain)}
                    placeholder="e.g. 12952"
                    value={trainNumberInput}
                    onChange={(e) => setTrainNumberInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:border-amber-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Train Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tejas Rajdhani Express"
                    value={trainNameInput}
                    onChange={(e) => setTrainNameInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase">On-Board Catering Availability</div>
                  <div className="text-[11px] text-slate-400">Enable or disable on-board food ordering for this train</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTrainAvailableInput(!trainAvailableInput)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition inline-flex items-center gap-1.5 cursor-pointer ${
                    trainAvailableInput
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {trainAvailableInput ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> YES (Available)
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> NO (Disabled)
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">On-Board Catering Provider Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IRCTC Executive Pantry"
                  value={trainProviderInput}
                  onChange={(e) => setTrainProviderInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Service / Pantry Type</label>
                <select
                  value={trainServiceTypeInput}
                  onChange={(e) => setTrainServiceTypeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-500"
                >
                  <option value="Full Pantry Car">Full Pantry Car (Hot Meals & Kitchen On-Board)</option>
                  <option value="Mini Pantry">Mini Pantry (Snacks, Beverages, Re-heating)</option>
                  <option value="On-Board Tray Service">On-Board Tray Service (Executive Rail Dine)</option>
                  <option value="Train Side Vending (TSV)">Train Side Vending (TSV)</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowTrainModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTrain}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {submittingTrain ? 'Saving...' : editingTrain ? 'Update Train Config' : 'Save Train Config'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Assigning Station Coverage */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Assign Station Coverage</h2>
                  <p className="text-xs text-slate-400">Assign an authorized food organization to a railway terminal</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignStationCoverage} className="p-6 space-y-4">
              {/* Select Organization */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Authorized Catering Organization *
                </label>
                <select
                  value={assignCompanyId || (companies.find(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE')?.id || '')}
                  onChange={(e) => setAssignCompanyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 font-medium"
                  required
                >
                  {companies
                    .filter(c => c.status === 'AUTHORIZED' || c.status === 'ACTIVE')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.legal_name || c.id})
                      </option>
                    ))}
                </select>
              </div>

              {/* Select Station */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Railway Station Terminal *
                </label>
                <select
                  value={assignStationCode}
                  onChange={(e) => setAssignStationCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 font-medium"
                  required
                >
                  {availableStationsList.length > 0 ? (
                    availableStationsList.map(st => (
                      <option key={st.station_code} value={st.station_code}>
                        {st.station_code} — {st.station_name} ({st.state})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="NDLS">NDLS — New Delhi (Delhi)</option>
                      <option value="BPL">BPL — Bhopal Junction (Madhya Pradesh)</option>
                      <option value="BSB">BSB — Varanasi Junction (Uttar Pradesh)</option>
                      <option value="MMCT">MMCT — Mumbai Central (Maharashtra)</option>
                      <option value="MAQ">MAQ — Mangaluru Central (Karnataka)</option>
                      <option value="UD">UD — Udupi (Karnataka)</option>
                      <option value="PUNE">PUNE — Pune Junction (Maharashtra)</option>
                      <option value="KOTA">KOTA — Kota Junction (Rajasthan)</option>
                      <option value="AGC">AGC — Agra Cantt (Uttar Pradesh)</option>
                      <option value="SBC">SBC — KSR Bengaluru City (Karnataka)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Realistic Station Quick Picks */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-2">
                  Major Railway Hub Quick Picks:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['NDLS', 'BPL', 'BSB', 'MMCT', 'MAQ', 'UD', 'PUNE', 'KOTA', 'AGC', 'PRYJ', 'LKO', 'SBC'].map(code => (
                    <button
                      type="button"
                      key={code}
                      onClick={() => setAssignStationCode(code)}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition cursor-pointer ${
                        assignStationCode === code
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Important Railway Distinction Note */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-amber-300">Station E-Catering:</strong> Food will be delivered directly at the selected station platform upon train arrival. Availability is governed by station coverage and configured cutoff times, and does <em>not</em> require the train to have already departed.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  {submittingAssign ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Assign Station Coverage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal for Order Details & Live Status Update in Manifest */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{selectedOrder.order_id || selectedOrder.id}</h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                      selectedOrder.status === 'DELIVERED'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : selectedOrder.status === 'CANCELLED'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {selectedOrder.status || 'CONFIRMED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PNR: <span className="font-mono text-slate-200">{selectedOrder.pnr_number || selectedOrder.pnr}</span> • Train #{selectedOrder.train_number} ({selectedOrder.train_name || 'Express Service'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Order Context Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-850 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block font-medium">Passenger Name:</span>
                  <span className="font-bold text-white text-sm">{selectedOrder.passenger_name || 'Passenger'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Service Type:</span>
                  <span className="font-bold text-amber-300">
                    {selectedOrder.catering_type === 'ONBOARD' ? '🍱 On-Board Train Pantry' : '🚉 Station Platform Delivery'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Delivery Destination:</span>
                  {selectedOrder.catering_type === 'ONBOARD' ? (
                    <span className="font-bold text-slate-200">
                      Coach {selectedOrder.coach_number || 'B1'}, Seat/Berth {selectedOrder.seat_number || '12'}
                    </span>
                  ) : (
                    <span className="font-bold text-slate-200">
                      Station {selectedOrder.delivery_station_code || selectedOrder.station_code || 'NDLS'} Platform Delivery
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Order Placed:</span>
                  <span className="font-mono text-slate-300">
                    {selectedOrder.order_time ? new Date(selectedOrder.order_time).toLocaleString() : 'Recent'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Payment Status:</span>
                  <span className="font-bold text-emerald-400">{selectedOrder.payment_status || 'Paid (Online / Prepaid)'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Catering Partner:</span>
                  <span className="text-slate-300 font-semibold">{selectedOrder.partner_name || 'Authorized Catering Provider'}</span>
                </div>
              </div>

              {/* Itemized Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 text-amber-400" /> Ordered Items ({selectedOrder.items?.length || 1})
                </h4>
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-900/60 text-slate-400 font-mono text-[11px]">
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {(selectedOrder.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/20">
                          <td className="py-2.5 px-3 font-medium text-white">{item.name}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-300">{item.qty || 1}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">₹{item.price || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                            ₹{(item.price || 0) * (item.qty || 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-700 bg-slate-900/80 font-bold">
                        <td colSpan="3" className="py-2.5 px-3 text-right text-slate-300">Total Billed:</td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-amber-400">
                          {selectedOrder.total_amount === 0 ? 'INCLUDED' : `₹${selectedOrder.total_amount || 0}`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Live Order Status Controller */}
              <div className="p-4 bg-slate-850 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Power className="h-3.5 w-3.5 text-amber-400" /> Update Order Status & Manifest Delivery
                  </h4>
                  {updatingOrderStatus && <RefreshCw className="h-3.5 w-3.5 text-amber-400 animate-spin" />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'ORDER CONFIRMED', label: 'Confirmed', color: 'border-blue-500/40 text-blue-300 bg-blue-500/10' },
                    { key: 'PREPARING', label: 'Preparing', color: 'border-amber-500/40 text-amber-300 bg-amber-500/10' },
                    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'border-purple-500/40 text-purple-300 bg-purple-500/10' },
                    { key: 'DELIVERED', label: 'Delivered', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
                    { key: 'CANCELLED', label: 'Cancelled', color: 'border-rose-500/40 text-rose-300 bg-rose-500/10' }
                  ].map(st => {
                    const isCurrent = (selectedOrder.status || '').toUpperCase().replace(/ /g, '_') === st.key.replace(/ /g, '_');
                    return (
                      <button
                        type="button"
                        key={st.key}
                        disabled={updatingOrderStatus}
                        onClick={() => handleUpdateOrderStatus(st.key)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-bold border transition flex flex-col items-center justify-center cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                            : `${st.color} hover:opacity-90`
                        }`}
                      >
                        <span>{st.label}</span>
                        {isCurrent && <span className="text-[9px] uppercase font-mono mt-0.5 tracking-tight font-black">ACTIVE</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 text-right bg-slate-850">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl cursor-pointer"
              >
                Close Order Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCatering;
