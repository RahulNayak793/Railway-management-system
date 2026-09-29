import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Utensils, ShoppingBag, Clock, CheckCircle2, AlertCircle, Plus, 
  Trash2, Edit3, Power, RefreshCw, Search, Filter, DollarSign,
  Building2, ShieldCheck, MapPin, Truck, Check, X, Tag, 
  AlertTriangle, LogOut, LayoutDashboard, Calendar, ArrowRight,
  Train, ChevronRight, Phone, Mail, HelpCircle, FileText, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Master Official Authorized Train Fleet for On-Board Catering
const DEFAULT_AUTHORIZED_TRAINS = [
  {
    train_number: '20104',
    train_name: 'Udupi - New Delhi Superfast Express',
    route: 'Udupi (UD) ⇄ New Delhi (NDLS)',
    source: 'UD',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '20103',
    train_name: 'New Delhi - Udupi Superfast Express',
    route: 'New Delhi (NDLS) ⇄ Udupi (UD)',
    source: 'NDLS',
    destination: 'UD',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12952',
    train_name: 'New Delhi Tejas Rajdhani Express',
    route: 'New Delhi (NDLS) ⇄ Mumbai Central (MMCT)',
    source: 'NDLS',
    destination: 'MMCT',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12951',
    train_name: 'Mumbai Tejas Rajdhani Express',
    route: 'Mumbai Central (MMCT) ⇄ New Delhi (NDLS)',
    source: 'MMCT',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '22436',
    train_name: 'New Delhi Vande Bharat Express',
    route: 'New Delhi (NDLS) ⇄ Varanasi Jn (BSB)',
    source: 'NDLS',
    destination: 'BSB',
    journey_date: null,
    pantry_type: 'On-Board Tray Service',
    applicable_classes: ['EC', 'CC'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '22435',
    train_name: 'Varanasi Vande Bharat Express',
    route: 'Varanasi Jn (BSB) ⇄ New Delhi (NDLS)',
    source: 'BSB',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'On-Board Tray Service',
    applicable_classes: ['EC', 'CC'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12001',
    train_name: 'New Delhi - Bhopal Shatabdi Express',
    route: 'New Delhi (NDLS) ⇄ Rani Kamalapati (RKMP)',
    source: 'NDLS',
    destination: 'RKMP',
    journey_date: null,
    pantry_type: 'Mini Pantry',
    applicable_classes: ['EC', 'CC'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12002',
    train_name: 'Rani Kamalapati - New Delhi Shatabdi Express',
    route: 'Rani Kamalapati (RKMP) ⇄ New Delhi (NDLS)',
    source: 'RKMP',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'Mini Pantry',
    applicable_classes: ['EC', 'CC'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12051',
    train_name: 'Mumbai CSMT - Madgaon Jan Shatabdi Express',
    route: 'Mumbai CSMT ⇄ Madgaon (MAO)',
    source: 'CSMT',
    destination: 'MAO',
    journey_date: null,
    pantry_type: 'Pantry Car',
    applicable_classes: ['CC', '2S'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12052',
    train_name: 'Madgaon - Mumbai CSMT Jan Shatabdi Express',
    route: 'Madgaon (MAO) ⇄ Mumbai CSMT',
    source: 'MAO',
    destination: 'CSMT',
    journey_date: null,
    pantry_type: 'Pantry Car',
    applicable_classes: ['CC', '2S'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12617',
    train_name: 'Ernakulam Mangala Lakshadweep Express',
    route: 'Ernakulam (ERS) ⇄ Hazrat Nizamuddin (NZM)',
    source: 'ERS',
    destination: 'NZM',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12618',
    train_name: 'Hazrat Nizamuddin Mangala Lakshadweep Express',
    route: 'Hazrat Nizamuddin (NZM) ⇄ Ernakulam (ERS)',
    source: 'NZM',
    destination: 'ERS',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12301',
    train_name: 'Howrah Rajdhani Express',
    route: 'Howrah (HWH) ⇄ New Delhi (NDLS)',
    source: 'HWH',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12302',
    train_name: 'New Delhi Howrah Rajdhani Express',
    route: 'New Delhi (NDLS) ⇄ Howrah (HWH)',
    source: 'NDLS',
    destination: 'HWH',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12423',
    train_name: 'Dibrugarh Rajdhani Express',
    route: 'Dibrugarh (DBRG) ⇄ New Delhi (NDLS)',
    source: 'DBRG',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12345',
    train_name: 'Howrah Saraighat Express',
    route: 'Howrah (HWH) ⇄ Guwahati (GHY)',
    source: 'HWH',
    destination: 'GHY',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '20801',
    train_name: 'Islampur Magadh Express',
    route: 'Islampur (IPR) ⇄ New Delhi (NDLS)',
    source: 'IPR',
    destination: 'NDLS',
    journey_date: null,
    pantry_type: 'Pantry Car',
    applicable_classes: ['1A', '2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12260',
    train_name: 'Bikaner - Sealdah AC Duronto Express',
    route: 'Bikaner (BKN) ⇄ Sealdah (SDAH)',
    source: 'BKN',
    destination: 'SDAH',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '12431',
    train_name: 'Trivandrum Rajdhani Express',
    route: 'Thiruvananthapuram (TVC) ⇄ Hazrat Nizamuddin (NZM)',
    source: 'TVC',
    destination: 'NZM',
    journey_date: null,
    pantry_type: 'Full Pantry Car',
    applicable_classes: ['1A', '2A', '3A'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '09401',
    train_name: 'Ahmedabad - Patna Special Fare SF',
    route: 'Ahmedabad (ADI) ⇄ Patna (PNBE)',
    source: 'ADI',
    destination: 'PNBE',
    journey_date: '2026-09-25',
    is_date_specific: true,
    pantry_type: 'On-Board Catering Staff',
    applicable_classes: ['2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  },
  {
    train_number: '02131',
    train_name: 'Pune - Jabalpur Special SF',
    route: 'Pune (PUNE) ⇄ Jabalpur (JBP)',
    source: 'PUNE',
    destination: 'JBP',
    journey_date: '2026-09-28',
    is_date_specific: true,
    pantry_type: 'On-Board Catering Staff',
    applicable_classes: ['2A', '3A', 'SL'],
    active_status: 'ACTIVE',
    catering_provider: 'IRCTC Executive Pantry'
  }
];

function getTrainNameWithStationPrefix(train) {
  if (!train) return '';
  const rawName = String(train.train_name || '').trim();
  const route = String(train.route || '').trim();

  const knownPrefixes = [
    'new delhi', 'mumbai', 'varanasi', 'bhopal', 'madgaon', 'howrah', 
    'dibrugarh', 'trivandrum', 'thiruvananthapuram', 'ahmedabad', 'pune',
    'ernakulam', 'hazrat nizamuddin', 'islampur', 'bikaner', 'sealdah',
    'udupi', 'rani kamalapati'
  ];
  const lower = rawName.toLowerCase();
  for (const p of knownPrefixes) {
    if (lower.startsWith(p)) {
      return rawName;
    }
  }

  if (route.includes('⇄') || route.includes('→') || route.includes('->')) {
    const originPart = route.split(/⇄|→|->/)[0].trim();
    const cleanOrigin = originPart.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleanOrigin && !lower.includes(cleanOrigin.toLowerCase())) {
      return `${cleanOrigin} ${rawName}`;
    }
  }

  return rawName;
}

const CateringDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, cateringUser, logout } = useAuth();
  const { showToast } = useToast();

  // Active Tab state: 'dashboard' | 'menu' | 'orders' | 'trains' | 'profile'
  const [activeTab, setActiveTab] = useState(() => {
    const path = location.pathname;
    if (path.includes('/menu')) return 'menu';
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/trains') || path.includes('/stations')) return 'trains';
    if (path.includes('/profile')) return 'profile';
    return 'dashboard';
  });

  // Company Profile & Status
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Menu State
  const [menuList, setMenuList] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Add / Edit Dish Modal State
  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishCategory, setDishCategory] = useState('Meals');
  const [dishType, setDishType] = useState('veg');
  const [dishDesc, setDishDesc] = useState('');
  const [dishPrepTime, setDishPrepTime] = useState('20');
  const [dishInStock, setDishInStock] = useState(true);
  const [submittingDish, setSubmittingDish] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStationFilter, setOrderStationFilter] = useState('all');
  const [orderTrainFilter, setOrderTrainFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Status Change Modal State
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState('');

  // Assigned Trains State
  const [stations, setStations] = useState([]);
  const [stationDetails, setStationDetails] = useState([]);
  const [assignedTrains, setAssignedTrains] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [trainsSearchQuery, setTrainsSearchQuery] = useState('');
  const [trainsFilterCategory, setTrainsFilterCategory] = useState('all'); // 'all' | 'udupi' | 'premium' | 'date_specific'
  const [stationsSubTab, setStationsSubTab] = useState('trains'); // 'trains' (train-only focus)

  // Fetch Company Data & Authenticate
  const fetchInitialData = async () => {
    setLoadingProfile(true);
    try {
      const meRes = await api.get('/catering/company/me');
      if (meRes.data && meRes.data.company) {
        setCompanyProfile(meRes.data.company);
        setStations(meRes.data.company.stations || []);
      }
    } catch (err) {
      console.error('Failed to load catering company profile:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        showToast(err.response?.data?.error || 'Access denied. Please log into your catering partner account.', 'error');
        logout('catering_company');
        navigate('/catering/login', { replace: true });
        return;
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch Menu
  const fetchMenu = async () => {
    setLoadingMenu(true);
    try {
      const res = await api.get('/catering/company/menu');
      if (res.data && res.data.menu) {
        setMenuList(res.data.menu);
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      showToast(err.response?.data?.error || 'Could not load company menu.', 'error');
    } finally {
      setLoadingMenu(false);
    }
  };

  // Fetch Orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await api.get('/catering/company/orders');
      if (res.data && res.data.orders) {
        setOrders(res.data.orders);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      showToast(err.response?.data?.error || 'Could not load company food orders.', 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch Stations & Assigned Trains
  const fetchStations = async () => {
    setLoadingStations(true);
    try {
      const [stRes, trRes] = await Promise.all([
        api.get('/catering/company/stations'),
        api.get('/catering/company/trains').catch(() => ({ data: { trains: [] } }))
      ]);
      if (stRes.data) {
        if (stRes.data.stations) setStations(stRes.data.stations);
        if (stRes.data.station_details) setStationDetails(stRes.data.station_details);
        if (stRes.data.assigned_trains && stRes.data.assigned_trains.length > 0) {
          setAssignedTrains(stRes.data.assigned_trains);
        }
      }
      if (trRes.data && trRes.data.trains && trRes.data.trains.length > 0) {
        setAssignedTrains(trRes.data.trains);
      }
    } catch (err) {
      console.error('Failed to fetch assigned stations and trains:', err);
    } finally {
      setLoadingStations(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchMenu();
    fetchOrders();
    fetchStations();
  }, []);

  const handleLogout = () => {
    logout('catering_company');
    showToast('Signed out of Catering Partner Portal.', 'info');
    navigate('/catering/login', { replace: true });
  };

  // Menu Handlers
  const handleOpenAddDish = () => {
    setEditingDish(null);
    setDishName('');
    setDishPrice('');
    setDishCategory('Meals');
    setDishType('veg');
    setDishDesc('');
    setDishPrepTime('20');
    setDishInStock(true);
    setShowDishModal(true);
  };

  const handleOpenEditDish = (dish) => {
    setEditingDish(dish);
    setDishName(dish.name);
    setDishPrice(dish.price);
    setDishCategory(dish.category || 'Meals');
    setDishType(dish.type || 'veg');
    setDishDesc(dish.description || '');
    setDishPrepTime(dish.prep_time_mins || '20');
    setDishInStock(dish.in_stock !== false);
    setShowDishModal(true);
  };

  const handleSaveDish = async (e) => {
    e.preventDefault();
    if (!dishName.trim() || !dishPrice) {
      showToast('Dish name and price are required.', 'error');
      return;
    }

    setSubmittingDish(true);
    const payload = {
      name: dishName.trim(),
      price: parseFloat(dishPrice),
      category: dishCategory,
      type: dishType,
      description: dishDesc.trim(),
      prep_time_mins: parseInt(dishPrepTime, 10) || 20,
      in_stock: Boolean(dishInStock)
    };

    try {
      if (editingDish) {
        await api.put(`/catering/company/menu/${editingDish.id}`, payload);
        showToast(`Updated "${dishName}" successfully.`, 'success');
      } else {
        await api.post('/catering/company/menu', payload);
        showToast(`Added "${dishName}" to your menu.`, 'success');
      }
      setShowDishModal(false);
      fetchMenu();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save food item.', 'error');
    } finally {
      setSubmittingDish(false);
    }
  };

  const handleToggleStock = async (dish) => {
    try {
      const updatedStock = !dish.in_stock;
      await api.put(`/catering/company/menu/${dish.id}`, { in_stock: updatedStock });
      setMenuList(prev => prev.map(m => m.id === dish.id ? { ...m, in_stock: updatedStock } : m));
      showToast(`${dish.name} is now ${updatedStock ? 'In Stock' : 'Out of Stock'}.`, 'info');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update stock status.', 'error');
    }
  };

  const handleDeleteDish = async (dish) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${dish.name}" from your company menu?`)) return;
    try {
      await api.delete(`/catering/company/menu/${dish.id}`);
      showToast(`Removed "${dish.name}" from menu.`, 'info');
      fetchMenu();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete dish.', 'error');
    }
  };

  // Order Status Handler
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await api.put(`/catering/company/orders/${orderId}/status`, { status: newStatus });
      showToast(`Order #${orderId} status updated to ${newStatus}.`, 'success');
      fetchOrders();
      setStatusModalOrder(null);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update order status.', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Filtered Menu
  const filteredMenu = menuList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesStock = stockFilter === 'all' || (stockFilter === 'in_stock' ? item.in_stock : !item.in_stock);
    return matchesSearch && matchesCat && matchesType && matchesStock;
  });

  // Combined authorized trains fleet (API assigned + master official fleet fallback)
  const effectiveAssignedTrains = React.useMemo(() => {
    const map = new Map();
    DEFAULT_AUTHORIZED_TRAINS.forEach(t => {
      const key = `${t.train_number}_${t.journey_date || 'reg'}`;
      map.set(key, t);
    });
    if (Array.isArray(assignedTrains) && assignedTrains.length > 0) {
      assignedTrains.forEach(t => {
        if (!t || !t.train_number) return;
        const key = `${t.train_number}_${t.journey_date || 'reg'}`;
        const prev = map.get(key) || {};
        map.set(key, {
          ...prev,
          ...t,
          train_number: String(t.train_number),
          train_name: prev.train_name || t.train_name || `Train ${t.train_number}`,
          route: t.route || prev.route || 'Standard Fleet Route',
          pantry_type: t.pantry_type || prev.pantry_type || 'Full Pantry Car',
          applicable_classes: Array.isArray(t.applicable_classes) && t.applicable_classes.length > 0
            ? t.applicable_classes
            : (prev.applicable_classes || ['1A', '2A', '3A']),
          active_status: t.active_status || prev.active_status || 'ACTIVE',
          catering_provider: t.catering_provider || t.provider_name || prev.catering_provider || 'IRCTC Authorized Pantry'
        });
      });
    }
    return Array.from(map.values());
  }, [assignedTrains]);

  // Available trains for order filtering
  const availableOrderTrains = React.useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      const num = String(o.train_number || o.train || '').trim();
      if (num && !map.has(num)) {
        map.set(num, { train_number: num, train_name: o.train_name || `Train ${num}` });
      }
    });
    effectiveAssignedTrains.forEach(t => {
      const num = String(t.train_number || '').trim();
      if (num && !map.has(num)) {
        map.set(num, { train_number: num, train_name: getTrainNameWithStationPrefix(t) || t.train_name || `Train ${num}` });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.train_number.localeCompare(b.train_number));
  }, [orders, effectiveAssignedTrains]);

  // Filtered Orders
  const filteredOrders = orders.filter(order => {
    const matchesStatus = orderStatusFilter === 'all' || (order.status || '').toUpperCase() === orderStatusFilter.toUpperCase();
    const stCode = (order.station_code || order.station_name || order.delivery_station || '').toUpperCase();
    const matchesStation = orderStationFilter === 'all' || stCode === orderStationFilter.toUpperCase();
    const trNum = String(order.train_number || order.train || '').trim();
    const matchesTrain = orderTrainFilter === 'all' || trNum === String(orderTrainFilter).trim();
    const q = orderSearch.toLowerCase();
    const matchesSearch = !q || (order.order_id && order.order_id.toLowerCase().includes(q)) ||
                          (order.pnr && order.pnr.toLowerCase().includes(q)) ||
                          (order.pnr_number && order.pnr_number.toLowerCase().includes(q)) ||
                          (order.train_number && String(order.train_number).toLowerCase().includes(q)) ||
                          (order.train_name && order.train_name.toLowerCase().includes(q)) ||
                          (order.passenger_name && order.passenger_name.toLowerCase().includes(q));
    return matchesStatus && matchesStation && matchesTrain && matchesSearch;
  });

  const comp = companyProfile || cateringUser || {};
  const companyName = comp.company_name || 'IRCTC Executive Pantry';
  const companyId = comp.id || 'comp-1';
  const compStatus = (comp.status || 'ACTIVE').toUpperCase();
  const validFrom = comp.authorization_start || comp.valid_from || '2025-01-01';
  const validUntil = comp.authorization_end || comp.valid_until || '2027-12-31';
  const stationList = Array.isArray(stations) && stations.length > 0 ? stations : (comp.stations || ['NDLS', 'MMCT', 'BPL']);

  const getStatusBadgeClass = (status) => {
    const s = String(status || 'ACCEPTED').toUpperCase();
    switch (s) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'CANCELLED':
        return 'bg-red-50 text-red-800 border-red-300';
      case 'ORDER CONFIRMED':
      case 'CONFIRMED':
        return 'bg-sky-50 text-sky-800 border-sky-300';
      case 'PREPARING':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'READY':
        return 'bg-cyan-50 text-cyan-800 border-cyan-300';
      case 'OUT_FOR_DELIVERY':
      case 'OUT FOR DELIVERY':
        return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'ACCEPTED':
      default:
        return 'bg-amber-50 text-amber-800 border-amber-300';
    }
  };

  const getTrainsForStation = (stCode) => {
    const clean = String(stCode || '').toUpperCase();
    const detail = stationDetails.find(d => String(d.station_code || '').toUpperCase() === clean);
    if (detail && detail.trains && detail.trains.length > 0) {
      return detail.trains;
    }
    const matches = effectiveAssignedTrains.filter(t => {
      const src = String(t.source || '').toUpperCase();
      const dest = String(t.destination || '').toUpperCase();
      const route = String(t.route || '').toUpperCase();
      return src === clean || dest === clean || route.includes(clean);
    });
    if (matches.length > 0) return matches;
    return [];
  };

  const filteredAssignedTrains = React.useMemo(() => {
    return effectiveAssignedTrains.filter(train => {
      const q = trainsSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        String(train.train_number || '').toLowerCase().includes(q) ||
        String(train.train_name || '').toLowerCase().includes(q) ||
        getTrainNameWithStationPrefix(train).toLowerCase().includes(q) ||
        String(train.route || '').toLowerCase().includes(q);

      let matchesCat = true;
      if (trainsFilterCategory === 'premium') {
        const name = String(train.train_name || '').toUpperCase();
        matchesCat = name.includes('RAJDHANI') || name.includes('VANDE') || name.includes('SHATABDI') || name.includes('TEJAS') || name.includes('DURONTO');
      } else if (trainsFilterCategory === 'pantry') {
        const p = String(train.pantry_type || '').toUpperCase();
        matchesCat = p.includes('PANTRY');
      } else if (trainsFilterCategory === 'date_specific') {
        matchesCat = Boolean(train.is_date_specific || train.journey_date);
      }

      return matchesSearch && matchesCat;
    });
  }, [effectiveAssignedTrains, trainsSearchQuery, trainsFilterCategory]);

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col font-sans antialiased">
      {/* ============================================================ */}
      {/* 1. TOP OFFICIAL GOVERNMENT/RAILWAY HEADER (64–72px) */}
      {/* ============================================================ */}
      <header className="bg-[#0B2545] text-white border-b border-[#07192F] shadow-md sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Indian Railways / IRCTC Emblem & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#0B2545] border-2 border-amber-400 flex items-center justify-center shadow-sm shrink-0">
              <Train className="h-5 w-5 stroke-[2.2] text-[#0B2545]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white uppercase">RailControl</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                  Partner Portal
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-200 uppercase tracking-wider leading-tight">
                Catering Partner Portal
              </p>
              <p className="text-[9px] text-blue-200 font-medium leading-none">
                Indian Railways Catering Operations
              </p>
            </div>
          </div>

          {/* Right: Partner Identity & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs font-bold text-white">{companyName}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                  {compStatus}
                </span>
              </div>
              <span className="text-[11px] font-mono text-blue-200">
                {comp.email || 'pantry@irctc.co.in'}
              </span>
            </div>

            <div className="h-7 w-px bg-blue-800/80 hidden sm:block" />

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900 border border-red-400/40 text-red-200 hover:text-white rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Logout from Catering Partner Portal"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Thin Secondary Railway Strip */}
        <div className="bg-[#E8EEF5] text-slate-700 text-[11px] px-4 sm:px-6 py-1 border-t border-b border-[#CFD9E5] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="font-semibold text-slate-800">
              Authorized Catering Partner • Railway Catering Operations
            </span>
          </div>
          <div className="text-slate-600 font-mono text-[10px]">
            Portal ID: <strong className="text-slate-900">{companyId}</strong> • Zone: Central & Northern Railways
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. BODY LAYOUT (WHITE SIDEBAR + MAIN CONTENT) */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* LEFT SIDEBAR: Clean Railway Admin Navigation */}
        <aside className="w-full md:w-60 bg-white border-r border-[#D9E1EA] flex flex-col justify-between shrink-0 shadow-xs">
          <div>
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Operational Navigation
              </p>
            </div>

            <nav className="space-y-0.5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent font-medium'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('menu')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs transition cursor-pointer ${
                  activeTab === 'menu'
                    ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent font-medium'
                }`}
              >
                <Utensils className="h-4 w-4" />
                <span>Menu Management</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center justify-between px-4 py-3 text-xs transition cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4" />
                  <span>Food Orders</span>
                </div>
                {orders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                    {orders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('trains')}
                className={`w-full flex items-center justify-between px-4 py-3 text-xs transition cursor-pointer ${
                  activeTab === 'trains' || activeTab === 'stations'
                    ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Train className="h-4 w-4" />
                  <span>Authorized Trains</span>
                </div>
                {assignedTrains.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900">
                    {assignedTrains.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs transition cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-blue-50 text-blue-900 font-bold border-l-4 border-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent font-medium'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Company Profile</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Bottom: Support & Official Info */}
          <div className="p-3 border-t border-slate-200 space-y-2">
            <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-md text-[11px] text-blue-900 space-y-1">
              <div className="flex items-center gap-1 font-bold text-blue-950">
                <HelpCircle className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                <span>IRCTC Catering Desk</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                Dial Railway Helpline <strong className="text-slate-900">139</strong> or contact <span className="font-mono text-blue-800">catering@railcontrol.gov.in</span>
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* 3. MAIN CONTENT AREA */}
        {/* ============================================================ */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-5">
          {/* Breadcrumb Strip */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>RailControl Operations</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span>Catering Partner</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold text-slate-800">
              {activeTab === 'trains' || activeTab === 'stations' ? 'Authorized Trains' : activeTab}
            </span>
          </div>

          {/* ========================================================== */}
          {/* TAB 1: DASHBOARD */}
          {/* ========================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Official Company Authorization Card */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-5 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                        Catering Partner Dashboard
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                        Status: {compStatus}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {companyName}
                    </h1>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      Company ID: <span className="font-mono font-bold text-slate-800">{companyId}</span> • Authorized Login: <span className="font-mono text-blue-700 font-semibold">{comp.email || 'pantry@irctc.co.in'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { fetchMenu(); fetchOrders(); }}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-[#D9E1EA] rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      title="Refresh Live Data"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                      <span>Refresh Data</span>
                    </button>
                    <button
                      onClick={handleOpenAddDish}
                      className="px-4 py-2 bg-[#00529B] hover:bg-[#003E75] text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="h-4 w-4" />
                      <span>+ Add Food Item</span>
                    </button>
                  </div>
                </div>

                {/* Authorization Parameters Details: On-Board Train Services */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                        <Train className="h-3.5 w-3.5 text-blue-700" />
                        Authorized On-Board Train Services ({effectiveAssignedTrains.length})
                      </span>
                      <button
                        onClick={() => {
                          setTrainsFilterCategory('all');
                          setTrainsSearchQuery('');
                          setActiveTab('trains');
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                      >
                        View Full Fleet ({effectiveAssignedTrains.length}) <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Authorized Train Fleet Summary Box */}
                    <div className="mb-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-[11px] text-blue-950 font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Train className="h-3.5 w-3.5 text-blue-800" />
                        <span><strong>Official Authorized On-Board Fleet</strong> ({effectiveAssignedTrains.length} Express Trains)</span>
                      </span>
                      <button
                        onClick={() => {
                          setTrainsFilterCategory('all');
                          setTrainsSearchQuery('');
                          setActiveTab('trains');
                        }}
                        className="text-[10px] uppercase font-bold text-blue-800 underline cursor-pointer hover:text-blue-950"
                      >
                        View All Trains
                      </button>
                    </div>

                    {/* Train Names & Numbers Badges */}
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {effectiveAssignedTrains.slice(0, 10).map(t => (
                        <span
                          key={t.train_number + (t.journey_date || '')}
                          onClick={() => {
                            setTrainsFilterCategory('all');
                            setTrainsSearchQuery(t.train_number);
                            setActiveTab('trains');
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-100 border border-slate-300 text-slate-800 text-xs rounded font-medium flex items-center gap-1.5 cursor-pointer transition"
                          title={`Click to view on-board catering service for ${getTrainNameWithStationPrefix(t)}`}
                        >
                          <span className="font-mono font-bold text-blue-800">{t.train_number}</span>
                          <span className="font-semibold text-slate-900">{getTrainNameWithStationPrefix(t)}</span>
                        </span>
                      ))}
                      {effectiveAssignedTrains.length > 10 && (
                        <button
                          onClick={() => {
                            setTrainsFilterCategory('all');
                            setTrainsSearchQuery('');
                            setActiveTab('trains');
                          }}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold rounded cursor-pointer transition"
                        >
                          +{effectiveAssignedTrains.length - 10} more train services...
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      On-Board Catering Validity & Coverage
                    </span>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-2">
                      <div className="font-mono text-slate-700 flex items-center gap-2">
                        <span>Valid From: <strong className="text-slate-900">{validFrom.split('T')[0]}</strong></span>
                        <span className="text-slate-400">|</span>
                        <span>Valid Until: <strong className="text-slate-900">{validUntil.split('T')[0]}</strong></span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1 border-t border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>Authorized Service Type: <strong>Full Pantry Car & Direct-to-Berth Tray Delivery</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Railway Operational Notice */}
                <div className="bg-blue-50/70 border border-blue-200 rounded p-3 text-xs text-blue-950 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="font-bold text-blue-900">On-Board Train Catering Authorization:</strong> Food services are prepared and served directly inside assigned passenger trains and pantry cars. Catering operations deliver meals directly to passenger coaches and berths on authorized train runs.
                  </p>
                </div>
              </div>

              {/* Operational Counters / KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white border border-[#D9E1EA] p-4 rounded-lg shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold text-slate-600">Active Menu Items</span>
                    <Utensils className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{menuList.length}</p>
                  <p className="text-[10px] text-slate-500 font-medium">In company pantry catalog</p>
                </div>

                <div className="bg-white border border-[#D9E1EA] p-4 rounded-lg shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold text-slate-600">Total Food Orders</span>
                    <ShoppingBag className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Station manifest orders</p>
                </div>

                <div className="bg-white border border-[#D9E1EA] p-4 rounded-lg shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold text-slate-600">Pending Orders</span>
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-amber-700">
                    {orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Kitchen preparing & pickup</p>
                </div>

                <div className="bg-white border border-[#D9E1EA] p-4 rounded-lg shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold text-slate-600">Delivered Meals</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {orders.filter(o => o.status === 'DELIVERED').length}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Delivered at berth</p>
                </div>
              </div>

              {/* Main Food Orders Table Focus */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-blue-800" />
                      <span>Recent Food Orders</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Live passenger meal orders placed for your authorized catering partner kitchen.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('orders')}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>View All Orders</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No food orders placed yet. As passengers book meals on upcoming journeys, orders will appear here automatically.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3.5">Order ID</th>
                          <th className="py-2.5 px-3.5">PNR</th>
                          <th className="py-2.5 px-3.5">Train No. & Name</th>
                          <th className="py-2.5 px-3.5">Passenger</th>
                          <th className="py-2.5 px-3.5">Coach / Berth</th>
                          <th className="py-2.5 px-3.5">Service Delivery</th>
                          <th className="py-2.5 px-3.5">Amount</th>
                          <th className="py-2.5 px-3.5">Order Date</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {orders.slice(0, 8).map(o => (
                          <tr key={o.order_id || o.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-blue-900">
                              #{o.order_id || o.id}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                              {o.pnr || o.pnr_number}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <div className="font-mono font-bold text-blue-900 text-xs flex items-center gap-1">
                                <Train className="h-3 w-3 text-amber-600 shrink-0" />
                                <span>{o.train_number || '12952'}</span>
                              </div>
                              <div className="font-semibold text-slate-800 text-[11px] leading-tight mt-0.5">
                                {o.train_name || 'Express Service'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-800">
                              {o.passenger_name || 'Passenger'}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900">
                              <div>{o.coach_number || o.coach || 'B1'} / {o.seat_number || o.seat || '12'}</div>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1">
                                At Berth
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                🍱 ON-BOARD
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                              ₹{o.total_amount}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-600">
                              {o.order_time ? new Date(o.order_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadgeClass(o.status)}`}>
                                {o.status || 'ACCEPTED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <button
                                onClick={() => {
                                  setStatusModalOrder(o);
                                  setSelectedNewStatus(o.status || 'ACCEPTED');
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-blue-300 rounded text-xs font-semibold cursor-pointer transition shadow-2xs"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: MENU MANAGEMENT */}
          {/* ========================================================== */}
          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-blue-800" />
                    <span>Menu Management</span>
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Manage food items available for authorized railway stations. Only your company can modify this catalog.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchMenu}
                    className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-[#D9E1EA] rounded-md text-xs font-semibold transition cursor-pointer"
                    title="Reload Menu"
                  >
                    <RefreshCw className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    onClick={handleOpenAddDish}
                    className="px-4 py-2 bg-[#00529B] hover:bg-[#003E75] text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Add Food Item</span>
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-3.5 shadow-xs flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search food item name or ingredients..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="all">All Categories</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Meals">Meals / Thali</option>
                  <option value="Fast Food">Fast Food</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Desserts">Desserts</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="all">All Dietary Types</option>
                  <option value="veg">Vegetarian (Veg 🟢)</option>
                  <option value="non-veg">Non-Vegetarian (Non-Veg 🔴)</option>
                  <option value="jain">Jain / Satvik (🟡)</option>
                </select>

                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="all">All Availability</option>
                  <option value="in_stock">In Stock Only</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              {/* Food Items Catalog Table */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-xs overflow-hidden">
                {loadingMenu ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Loading your company menu items...
                  </div>
                ) : filteredMenu.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                    <p className="font-semibold text-slate-700">No food items found matching your filters.</p>
                    <p className="text-slate-400">Click "+ Add Food Item" above to add meals to your partner menu.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3.5">Food Item</th>
                          <th className="py-2.5 px-3.5">Category</th>
                          <th className="py-2.5 px-3.5">Dietary Type</th>
                          <th className="py-2.5 px-3.5">Price</th>
                          <th className="py-2.5 px-3.5">Prep Time</th>
                          <th className="py-2.5 px-3.5">Availability</th>
                          <th className="py-2.5 px-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {filteredMenu.map(dish => (
                          <tr key={dish.id} className={`hover:bg-slate-50/80 transition ${!dish.in_stock ? 'bg-slate-50/50 opacity-75' : ''}`}>
                            <td className="py-2.5 px-3.5">
                              <p className="font-bold text-slate-900 leading-tight">{dish.name}</p>
                              {dish.description && (
                                <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">{dish.description}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 font-semibold text-slate-700">
                              {dish.category}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                                dish.type === 'veg' ? 'text-emerald-700' :
                                dish.type === 'non-veg' ? 'text-red-700' :
                                'text-amber-700'
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                  dish.type === 'veg' ? 'bg-emerald-600' :
                                  dish.type === 'non-veg' ? 'bg-red-600' :
                                  'bg-amber-500'
                                }`} />
                                <span className="capitalize">{dish.type}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                              ₹{dish.price}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-600">
                              {dish.prep_time_mins || 20} mins
                            </td>
                            <td className="py-2.5 px-3.5">
                              <button
                                onClick={() => handleToggleStock(dish)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  dish.in_stock
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                                }`}
                              >
                                {dish.in_stock ? 'In Stock' : 'Out of Stock'}
                              </button>
                            </td>
                            <td className="py-2.5 px-3.5 text-right space-x-1.5">
                              <button
                                onClick={() => handleOpenEditDish(dish)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                                title="Edit Dish"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDish(dish)}
                                className="px-2 py-1 bg-white hover:bg-red-50 border border-red-300 text-red-700 rounded text-[11px] font-semibold transition cursor-pointer"
                                title="Delete Dish"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: FOOD ORDERS PAGE */}
          {/* ========================================================== */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-blue-800" />
                    <span>Food Orders Management</span>
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Live operational manifest for your catering partner company. Update order preparation and platform delivery statuses.
                  </p>
                </div>

                <button
                  onClick={fetchOrders}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#D9E1EA] rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start md:self-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Refresh Orders</span>
                </button>
              </div>

              {/* Filters Bar */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-3.5 shadow-xs flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Order ID, PNR, or Passenger Name..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <select
                  value={orderTrainFilter}
                  onChange={(e) => setOrderTrainFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="all">🚆 All Trains / Services</option>
                  {availableOrderTrains.map(t => (
                    <option key={t.train_number} value={t.train_number}>
                      {t.train_number} - {t.train_name}
                    </option>
                  ))}
                </select>

                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="ORDER CONFIRMED">ORDER CONFIRMED</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="PREPARING">PREPARING</option>
                  <option value="READY">READY</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* Orders Table */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-xs overflow-hidden">
                {loadingOrders ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Loading food orders...
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No orders match your filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3.5">Order ID</th>
                          <th className="py-2.5 px-3.5">PNR</th>
                          <th className="py-2.5 px-3.5">Train No. & Name</th>
                          <th className="py-2.5 px-3.5">Passenger</th>
                          <th className="py-2.5 px-3.5">Coach / Berth</th>
                          <th className="py-2.5 px-3.5">Service Delivery</th>
                          <th className="py-2.5 px-3.5">Amount</th>
                          <th className="py-2.5 px-3.5">Order Time</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5 text-right">Update Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {filteredOrders.map(o => (
                          <tr key={o.order_id || o.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-blue-900">
                              #{o.order_id || o.id}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                              {o.pnr || o.pnr_number}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <div className="font-mono font-bold text-blue-900 text-xs flex items-center gap-1">
                                <Train className="h-3 w-3 text-amber-600 shrink-0" />
                                <span>{o.train_number || '12952'}</span>
                              </div>
                              <div className="font-semibold text-slate-800 text-[11px] leading-tight mt-0.5">
                                {o.train_name || 'Express Service'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-800">
                              {o.passenger_name || 'Passenger'}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <div className="font-mono font-bold text-slate-900">
                                {o.coach_number || o.coach || 'B1'} / {o.seat_number || o.seat || '24'}
                              </div>
                              <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 mt-0.5">
                                Direct to Berth
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                🍱 ON-BOARD
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-mono">
                              <span className="font-bold text-slate-900 block">₹{o.total_amount}</span>
                              {(o.payment_mode === 'Cash on Delivery' || o.payment_method?.toLowerCase().includes('cash') || o.payment_status === 'Due on Delivery') ? (
                                <span className={`inline-block text-[9px] font-bold rounded px-1.5 py-0.5 mt-0.5 border ${
                                  o.status === 'DELIVERED' || o.payment_status?.includes('Collected') || o.payment_status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}>
                                  {o.status === 'DELIVERED' || o.payment_status?.includes('Collected') ? '✓ Cash Collected' : '💵 COD (Collect)'}
                                </span>
                              ) : (
                                <span className="inline-block text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 mt-0.5">
                                  💳 Prepaid
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-600">
                              {o.order_time ? new Date(o.order_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadgeClass(o.status)}`}>
                                {o.status || 'ACCEPTED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <button
                                onClick={() => {
                                  setStatusModalOrder(o);
                                  setSelectedNewStatus(o.status || 'ACCEPTED');
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-blue-300 rounded text-xs font-semibold cursor-pointer transition shadow-2xs"
                              >
                                Change Status
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: AUTHORIZED TRAINS (ON-BOARD CATERING FLEET) */}
          {/* ========================================================== */}
          {(activeTab === 'trains' || activeTab === 'stations') && (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wider">
                      Railway Administrative Contract
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Train className="h-5 w-5 text-blue-800" />
                    <span>Authorized On-Board Train Services</span>
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Official Indian Railways train services where your catering company is authorized to operate pantry car and direct-to-berth meal deliveries.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setTrainsFilterCategory('all'); setTrainsSearchQuery(''); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      trainsFilterCategory === 'all'
                        ? 'bg-blue-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Authorized Trains ({effectiveAssignedTrains.length})
                  </button>
                  <button
                    onClick={() => { setTrainsFilterCategory('premium'); setTrainsSearchQuery(''); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      trainsFilterCategory === 'premium'
                        ? 'bg-blue-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>⚡ Premium Fleet (Rajdhani / Vande Bharat / Shatabdi)</span>
                  </button>
                  <button
                    onClick={() => { setTrainsFilterCategory('pantry'); setTrainsSearchQuery(''); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      trainsFilterCategory === 'pantry'
                        ? 'bg-blue-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Utensils className="h-3.5 w-3.5" />
                    <span>Pantry Car Services</span>
                  </button>
                  <button
                    onClick={() => { setTrainsFilterCategory('date_specific'); setTrainsSearchQuery(''); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      trainsFilterCategory === 'date_specific'
                        ? 'bg-blue-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Date-Specific Specials</span>
                  </button>
                </div>
              </div>

              {/* Official Policy Alert */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-950 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <strong className="block font-bold text-blue-900">On-Board Train Catering Authorization Policy:</strong>
                  <p>
                    On-board catering is authorized inside designated train pantry cars and coaches. Food is prepared and supplied en route directly to passengers at their reserved berths. Catering staff manifests must align with the authorized train numbers and routes listed below.
                  </p>
                </div>
              </div>

              {/* Search & Filter Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <Train className="h-4 w-4 text-blue-800" />
                  <span className="font-bold text-slate-900 text-sm">
                    Authorized On-Board Train Fleet
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({filteredAssignedTrains.length} services displayed)
                  </span>
                </div>

                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search train name, number, or route..."
                    value={trainsSearchQuery}
                    onChange={(e) => setTrainsSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              {/* Train Fleet Table */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider font-mono">
                      <th className="py-3 px-4">Train No.</th>
                      <th className="py-3 px-4">Train Name</th>
                      <th className="py-3 px-4">Route</th>
                      <th className="py-3 px-4">Operating Schedule / Date</th>
                      <th className="py-3 px-4">Pantry Service Type</th>
                      <th className="py-3 px-4">Eligible Classes</th>
                      <th className="py-3 px-4 text-center">Catering Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {loadingStations && effectiveAssignedTrains.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          <RefreshCw className="h-5 w-5 text-blue-700 animate-spin mx-auto mb-2" />
                          Loading authorized train fleet...
                        </td>
                      </tr>
                    ) : filteredAssignedTrains.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          No authorized train services found matching "{trainsSearchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredAssignedTrains.map((tr, idx) => (
                        <tr key={`${tr.train_number}_${tr.journey_date || idx}`} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-mono font-bold text-blue-900 text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <Train className="h-3.5 w-3.5 text-blue-800 shrink-0" />
                              {tr.train_number}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 text-xs block">{getTrainNameWithStationPrefix(tr)}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {tr.catering_provider || tr.provider_name || 'IRCTC Authorized On-Board Catering'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 font-semibold text-xs">
                            {tr.route || 'Standard Fleet Route'}
                          </td>
                          <td className="py-3 px-4">
                            {tr.journey_date ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 font-mono">
                                <Calendar className="h-3 w-3 text-amber-700 shrink-0" />
                                {tr.journey_date} <span className="text-[10px] text-amber-700">(Date-Specific)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <Clock className="h-3 w-3 text-slate-500 shrink-0" />
                                Daily Regular Service
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">
                            <span className="inline-flex items-center gap-1 text-slate-900 font-semibold">
                              <Utensils className="h-3 w-3 text-amber-600 shrink-0" />
                              {tr.pantry_type || 'Full Pantry Car'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(Array.isArray(tr.applicable_classes) ? tr.applicable_classes : ['1A', '2A', '3A']).map(c => (
                                <span key={c} className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-700">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider inline-flex items-center gap-1">
                              <Check className="h-3 w-3 text-emerald-600" /> AUTHORIZED
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 5: COMPANY PROFILE PAGE */}
          {/* ========================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-5 shadow-xs">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-800" />
                  <span>Catering Partner Official Profile</span>
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Official registration parameters, food safety certification, and enterprise authorization details.
                </p>
              </div>

              {/* Details Sections */}
              <div className="bg-white border border-[#D9E1EA] rounded-lg p-6 shadow-xs space-y-6 text-xs">
                {/* Section 1: Company Information */}
                <div>
                  <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider pb-2 border-b border-slate-200 mb-4">
                    Company Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-500 font-medium block">Company Display Name</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">{companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Legal Registered Name</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">{comp.legal_name || companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Company System ID</span>
                      <span className="text-xs font-mono font-bold text-slate-800 mt-0.5 block">{companyId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Authorized Login Identity</span>
                      <span className="text-xs font-mono font-bold text-blue-800 mt-0.5 block">{comp.email || 'pantry@irctc.co.in'}</span>
                      <span className="text-[10px] text-slate-400">Authorized by Railway Administration for portal access.</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">FSSAI License Number</span>
                      <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">{comp.fssai_number || '10019011000234'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Contact Number</span>
                      <span className="text-xs font-mono text-slate-800 mt-0.5 block">{comp.phone || '+91 11 2331 1263'}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Railway Authorization */}
                <div>
                  <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider pb-2 border-b border-slate-200 mb-4">
                    Railway Authorization Parameters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-slate-500 font-medium block">Authorization Status</span>
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{compStatus}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Valid From</span>
                      <span className="text-xs font-mono font-bold text-slate-800 mt-1 block">{validFrom.split('T')[0]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Valid Until</span>
                      <span className="text-xs font-mono font-bold text-slate-800 mt-1 block">{validUntil.split('T')[0]}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className="text-slate-500 font-medium block mb-1.5">Assigned Operating Stations</span>
                    <div className="flex flex-wrap gap-1.5">
                      {stationList.map(s => (
                        <span key={s} className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-900 font-mono font-bold text-xs rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 3: Food Safety & Operating Standards */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <strong className="font-bold text-slate-900 block">Indian Railways Food Safety & Compliance Guidelines:</strong>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                      <li>All packaged food items must carry clear manufacturing, packing, and expiry dates.</li>
                      <li>Berth delivery staff must carry official photo identity badges and wear authorized IRCTC/RailControl uniforms.</li>
                      <li>Preparation time must accurately reflect kitchen capacity to prevent train departure delivery failures.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 4. MODAL: ADD / EDIT DISH */}
      {/* ============================================================ */}
      {showDishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white border border-[#D9E1EA] rounded-lg w-full max-w-lg shadow-xl overflow-hidden my-8">
            <div className="bg-[#0B2545] text-white px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Utensils className="h-4 w-4 text-amber-300" />
                <span>{editingDish ? 'Edit Food Item' : '+ Add Food Item'}</span>
              </h3>
              <button
                onClick={() => setShowDishModal(false)}
                className="text-slate-300 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDish} className="p-5 space-y-3.5 text-xs text-slate-800">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Food Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Executive Chicken Dum Biryani Combo"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="250"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Preparation Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="20"
                    value={dishPrepTime}
                    onChange={(e) => setDishPrepTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={dishCategory}
                    onChange={(e) => setDishCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Meals">Meals / Thali</option>
                    <option value="Fast Food">Fast Food</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Dietary Type
                  </label>
                  <select
                    value={dishType}
                    onChange={(e) => setDishType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="veg">Vegetarian (Veg 🟢)</option>
                    <option value="non-veg">Non-Vegetarian (Non-Veg 🔴)</option>
                    <option value="jain">Jain / Satvik (🟡)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Description / Ingredients
                </label>
                <textarea
                  rows="2"
                  placeholder="Ingredients, accompaniments (e.g. raita, pickle), hygienic packaging details..."
                  value={dishDesc}
                  onChange={(e) => setDishDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="in-stock-checkbox"
                  checked={dishInStock}
                  onChange={(e) => setDishInStock(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="in-stock-checkbox" className="text-xs text-slate-800 font-bold cursor-pointer">
                  Available and in stock for passenger ordering
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDishModal(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDish}
                  className="px-4 py-1.5 bg-[#00529B] hover:bg-[#003E75] text-white rounded text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingDish ? 'Saving...' : (editingDish ? 'Update Food Item' : 'Save Food Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL: UPDATE ORDER STATUS */}
      {/* ============================================================ */}
      {statusModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
          <div className="bg-white border border-[#D9E1EA] rounded-lg w-full max-w-md shadow-xl overflow-hidden">
            <div className="bg-[#0B2545] text-white px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-amber-300" />
                <span>Update Order #{statusModalOrder.order_id || statusModalOrder.id}</span>
              </h3>
              <button
                onClick={() => setStatusModalOrder(null)}
                className="text-slate-300 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-800">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <p><span className="text-slate-500">PNR:</span> <strong className="font-mono text-slate-900">{statusModalOrder.pnr || statusModalOrder.pnr_number}</strong></p>
                <p><span className="text-slate-500">Train:</span> <strong className="text-slate-900">{statusModalOrder.train_number || '12051'}</strong> • Coach/Berth: <strong className="font-mono text-slate-900">{statusModalOrder.coach_number || statusModalOrder.coach || 'B1'} / {statusModalOrder.seat_number || statusModalOrder.seat || '12'}</strong></p>
                <p><span className="text-slate-500">Delivery Station:</span> <strong className="text-blue-900 font-mono">{statusModalOrder.station_code || statusModalOrder.delivery_station || 'NDLS'}</strong></p>
                <p><span className="text-slate-500">Current Status:</span> <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadgeClass(statusModalOrder.status)}`}>{statusModalOrder.status || 'ACCEPTED'}</span></p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1.5">
                  Select New Operational Status:
                </label>
                <select
                  value={selectedNewStatus}
                  onChange={(e) => setSelectedNewStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="ORDER CONFIRMED">ORDER CONFIRMED — Initial customer booking received</option>
                  <option value="ACCEPTED">ACCEPTED — Order acknowledged by kitchen</option>
                  <option value="PREPARING">PREPARING — Kitchen preparing meal</option>
                  <option value="READY">READY — Ready for platform pickup</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY — En route to coach berth</option>
                  <option value="DELIVERED">DELIVERED — Delivered at passenger seat</option>
                  <option value="CANCELLED">CANCELLED — Cancelled by kitchen</option>
                </select>
              </div>

              {(statusModalOrder.payment_mode === 'Cash on Delivery' || statusModalOrder.payment_method?.toLowerCase().includes('cash') || statusModalOrder.payment_status === 'Due on Delivery') && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded text-amber-950 font-medium space-y-0.5">
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>💵 Cash on Delivery Order:</span>
                    <span className="font-mono text-orange-700 font-black">₹{statusModalOrder.total_amount}</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    When marked as <strong>DELIVERED</strong>, payment status will automatically be recorded as "Paid (Cash Collected at Berth)".
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOrder(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingOrderId !== null}
                  onClick={() => handleUpdateOrderStatus(statusModalOrder.order_id || statusModalOrder.id, selectedNewStatus)}
                  className="px-4 py-1.5 bg-[#00529B] hover:bg-[#003E75] text-white rounded text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {updatingOrderId !== null ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CateringDashboard;
