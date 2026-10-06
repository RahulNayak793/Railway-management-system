import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, SlidersHorizontal, Train, Clock, ArrowRight, Check, 
  MapPin, Calendar, Award, Eye, X, BookOpen, PhoneCall,
  Wind, Zap, Coffee, Sparkles, Shield, ShieldCheck, HelpCircle,
  Info, AlertCircle, Briefcase, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, RotateCcw, Filter
} from 'lucide-react';
import api from '../services/api';
import TrainSearchForm from '../components/TrainSearchForm';
import TrainClassCard from '../components/TrainClassCard';
import { useCurrency } from '../context/CurrencyContext';
import { MASTER_CLASSES, getClassLabel, getClassFullName, getIndianRailwayClassLabel, getDefaultClassesForTrain, sortClassesByPriority, sortClassCodes, normalizeClassCode, CLASS_PRIORITY } from '../utils/trainClasses';
import { isFoodEligibleClass } from '../utils/cateringEligibilityHelper';
import { indianStations } from '../utils/stationsData';

const stationNameLookup = new Map();
indianStations.forEach(st => {
  if (st.code && st.name) {
    stationNameLookup.set(st.code.toUpperCase(), st.name);
  }
});
stationNameLookup.set('UD', 'Udupi');
stationNameLookup.set('UDU', 'Udupi');
stationNameLookup.set('UDUPI', 'Udupi');

const DAYS_CONFIG = [
  { key: 'M', code: 'MON', full: 'Monday', label: 'M' },
  { key: 'T', code: 'TUE', full: 'Tuesday', label: 'T' },
  { key: 'W', code: 'WED', full: 'Wednesday', label: 'W' },
  { key: 'T2', code: 'THU', full: 'Thursday', label: 'T' },
  { key: 'F', code: 'FRI', full: 'Friday', label: 'F' },
  { key: 'S', code: 'SAT', full: 'Saturday', label: 'S' },
  { key: 'S2', code: 'SUN', full: 'Sunday', label: 'S' },
];

const FILTER_CLASSES = [
  { code: 'SL', name: 'Sleeper (SL)' },
  { code: '3E', name: 'AC 3 Economy (3E)' },
  { code: '3A', name: 'AC 3 Tier (3A)' },
  { code: '2A', name: 'AC 2 Tier (2A)' },
  { code: 'CC', name: 'AC Chair Car (CC)' },
  { code: 'EC', name: 'Executive Chair Car (EC)' },
  { code: '2S', name: 'Second Sitting (2S)' },
  { code: 'GEN', name: 'General / Unreserved (GEN)' },
  { code: '1A', name: 'First AC (1A)' }
];

const FILTER_TRAIN_TYPES = [
  { code: 'Rajdhani', name: 'Rajdhani' },
  { code: 'Shatabdi', name: 'Shatabdi' },
  { code: 'Vande Bharat', name: 'Vande Bharat' },
  { code: 'Duronto', name: 'Duronto' },
  { code: 'Humsafar', name: 'Humsafar' },
  { code: 'Superfast', name: 'Superfast' },
  { code: 'Express', name: 'Express' },
  { code: 'Special / Other', name: 'Special / Other' }
];

const TIME_SLOTS = [
  { key: 'early_morning', label: 'Early Morning', time: '00:00 - 06:00' },
  { key: 'morning', label: 'Morning', time: '06:00 - 12:00' },
  { key: 'mid_day', label: 'Mid Day', time: '12:00 - 18:00' },
  { key: 'night', label: 'Night', time: '18:00 - 24:00' }
];

const getRunsOnDays = (frequency, operatingDays = null) => {
  if (Array.isArray(operatingDays) && operatingDays.length > 0) {
    const opSet = new Set(operatingDays.map(d => String(d).trim().toUpperCase().slice(0, 3)));
    return DAYS_CONFIG.map(d => ({
      ...d,
      active: opSet.has(d.code) || opSet.has(d.full.toUpperCase().slice(0, 3)) || opSet.has('ALL') || opSet.has('DAI')
    }));
  }

  if (!frequency || frequency === 'Daily' || frequency === 'DAILY' || frequency === 'ALL') {
    return DAYS_CONFIG.map(d => ({ ...d, active: true }));
  }

  const freqStr = Array.isArray(frequency) ? frequency.join(' ').toUpperCase() : String(frequency).toUpperCase();

  if (freqStr.includes('DAILY') || freqStr.includes('ALL') || freqStr.includes('EVERYDAY')) {
    return DAYS_CONFIG.map(d => ({ ...d, active: true }));
  }

  const dayNameMap = {
    MON: 0, MONDAY: 0,
    TUE: 1, TUESDAY: 1,
    WED: 2, WEDNESDAY: 2,
    THU: 3, THURSDAY: 3,
    FRI: 4, FRIDAY: 4,
    SAT: 5, SATURDAY: 5,
    SUN: 6, SUNDAY: 6
  };

  const activeIndices = new Set();
  Object.keys(dayNameMap).forEach(dayToken => {
    if (freqStr.includes(dayToken)) {
      activeIndices.add(dayNameMap[dayToken]);
    }
  });

  if (activeIndices.size === 0) {
    return DAYS_CONFIG.map(d => ({ ...d, active: true }));
  }

  return DAYS_CONFIG.map((d, index) => ({
    ...d,
    active: activeIndices.has(index)
  }));
};

const safeText = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return val.state || val.name || val.code || val.status || val.label || val.statusLabel || fallback;
  }
  return String(val);
};

const normalizeDateStr = (dStr) => {
  if (!dStr) return '';
  const clean = String(dStr).trim();
  const ddmmyyyy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  const yyyymmdd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return clean;
};

const formatDateFriendly = (dateStr) => {
  if (!dateStr) return '';
  const clean = normalizeDateStr(dateStr);
  const parts = String(clean).trim().split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
};

const extractCode = (str) => {
  if (!str) return '';
  const match = String(str).match(/\(([^)]+)\)/);
  const code = match ? match[1].trim().toUpperCase() : String(str).trim().toUpperCase();
  if (code === 'UDU' || code === 'UDUPI') return 'UD';
  return code;
};

const extractName = (str) => {
  if (!str) return '';
  const code = extractCode(str);
  if (code === 'UD' || code === 'UDU' || code === 'UDUPI') return 'Udupi';
  if (code && stationNameLookup.has(code)) {
    return stationNameLookup.get(code);
  }
  const match = String(str).match(/^([^(]+)/);
  if (match) {
    const trimmed = match[1].trim();
    if (trimmed.toUpperCase() === 'UD' || trimmed.toUpperCase() === 'UDU' || trimmed.toUpperCase() === 'UDUPI') return 'Udupi';
    if (stationNameLookup.has(trimmed.toUpperCase())) {
      return stationNameLookup.get(trimmed.toUpperCase());
    }
    return trimmed;
  }
  const upper = String(str).trim().toUpperCase();
  if (upper === 'UD' || upper === 'UDU' || upper === 'UDUPI') return 'Udupi';
  if (stationNameLookup.has(upper)) {
    return stationNameLookup.get(upper);
  }
  return String(str).trim();
};

const generateFiveDayWindow = (startDateStr) => {
  if (!startDateStr) {
    startDateStr = new Date().toISOString().split('T')[0];
  }
  const cleanDate = normalizeDateStr(startDateStr);
  const parts = cleanDate.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1;
  let day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const today = new Date();
    year = today.getFullYear();
    month = today.getMonth();
    day = today.getDate();
  }

  const days = [];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(year, month, day + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    days.push({
      dateStr,
      dayName: weekDays[d.getDay()],
      dayNum: String(d.getDate()).padStart(2, '0'),
      monthName: monthNames[d.getMonth()],
      year: d.getFullYear(),
      fullLabel: `${weekDays[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`
    });
  }

  return days;
};

const SearchTrainResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  let initialSrc = searchParams.get('source') || '';
  if (initialSrc.toUpperCase() === 'UDU' || initialSrc.toUpperCase() === 'UDUPI') initialSrc = 'UD';
  let initialDest = searchParams.get('destination') || '';
  if (initialDest.toUpperCase() === 'UDU' || initialDest.toUpperCase() === 'UDUPI') initialDest = 'UD';
  const initialDate = normalizeDateStr(searchParams.get('date')) || '';
  const searchTime = searchParams.get('time') || searchParams.get('searchTime') || '18:30';
  let rememberedPax = '1';
  try {
    const raw = localStorage.getItem('railway_permanent_passengers') || localStorage.getItem('recent_passengers_list');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rememberedPax = String(parsed.length);
      }
    }
  } catch (e) {}
  const rawPaxParam = searchParams.get('passengers');
  const initialPax = rawPaxParam || '1';
  const rawInitQuota = searchParams.get('quota') || 'GN';
  const initialQuota = (rawInitQuota.toUpperCase() === 'GENERAL' || rawInitQuota.toUpperCase() === 'GN') ? 'GN' : rawInitQuota;
  const initialClass = searchParams.get('class') || searchParams.get('selectedClass') || 'ALL';

  const [currentSource, setCurrentSource] = useState('');
  const [currentDestination, setCurrentDestination] = useState('');
  const [selectedSearchDate, setSelectedSearchDate] = useState('');
  const [baseSearchDate, setBaseSearchDate] = useState('');
  const [currentClass, setCurrentClass] = useState(initialClass);
  const [currentQuota, setCurrentQuota] = useState(initialQuota);
  const [currentPassengers, setCurrentPassengers] = useState(initialPax);

  // Active search request counter to ignore stale out-of-order responses
  const activeSearchIdRef = useRef(0);

  // Convenience aliases for backward compatibility across the rest of the component
  const source = currentSource;
  const destination = currentDestination;
  const travelDate = selectedSearchDate;
  const passengers = currentPassengers;
  const quota = currentQuota;
  const classParam = currentClass;
  const isAllClasses = !classParam || 
    classParam.toUpperCase() === 'ALL' || 
    classParam.toUpperCase() === 'ALL CLASSES' || 
    classParam.toUpperCase() === 'ALL_CLASSES' ||
    classParam.toUpperCase() === 'ALL CLASS';
  const disabilityConcession = searchParams.get('disabilityConcession') === 'true';
  const railwayPassConcession = searchParams.get('railwayPassConcession') === 'true';

  const [hasSearched, setHasSearched] = useState(false);
  const [dateTabsAvailability, setDateTabsAvailability] = useState({});
  const [trains, setTrains] = useState([]);
  const [filteredTrains, setFilteredTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataSourceLabel, setDataSourceLabel] = useState('Searching live trains...');
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');

  // Selected class & date per train card
  const [selectedClassByTrain, setSelectedClassByTrain] = useState({});
  const [selectedDateByTrain, setSelectedDateByTrain] = useState({});
  const [expandedClassByTrain, setExpandedClassByTrain] = useState({});
  const [classDatesCache, setClassDatesCache] = useState({});
  const [loadingClassDates, setLoadingClassDates] = useState({});
  const dateScrollContainerRefs = useRef({});

  // Quick Filters state
  const [quickFilterAcOnly, setQuickFilterAcOnly] = useState(false);
  const [quickFilterBestAvailable, setQuickFilterBestAvailable] = useState(false);
  const [quickFilterSleeperOnly, setQuickFilterSleeperOnly] = useState(false);
  const [quickFilterAvailableOnly, setQuickFilterAvailableOnly] = useState(false);

  // Filters state
  const [trainSearchQuery, setTrainSearchQuery] = useState('');
  const [departureTimes, setDepartureTimes] = useState([]);
  const [arrivalTimes, setArrivalTimes] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState(
    classParam && !isAllClasses ? [classParam.toUpperCase()] : []
  );
  const [selectedTrainTypes, setSelectedTrainTypes] = useState([]);
  const [selectedFromStations, setSelectedFromStations] = useState([]);
  const [selectedToStations, setSelectedToStations] = useState([]);
  const [priceRange, setPriceRange] = useState(5000);
  const [sortBy, setSortBy] = useState('price');

  // Collapsible sidebar sections
  const [collapsedFilterSections, setCollapsedFilterSections] = useState({
    class: false,
    trainType: false,
    depTime: false,
    arrTime: false,
    fromStation: false,
    toStation: false
  });

  // Mobile filters drawer
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Update selected class filter if query param changes
  useEffect(() => {
    if (classParam && !isAllClasses) {
      setSelectedClassFilter([classParam.toUpperCase()]);
    } else {
      setSelectedClassFilter([]);
    }
  }, [classParam, isAllClasses]);

  // Selected schedule modal state
  const [activeScheduleTrain, setActiveScheduleTrain] = useState(null);

  // AI Recommendation State
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [aiInsights, setAiInsights] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // AI Delay Prediction State
  const [predictedDelay, setPredictedDelay] = useState(null);
  const [predictingNumber, setPredictingNumber] = useState(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [seatAvailabilityMap, setSeatAvailabilityMap] = useState({});

  const checkClassCatering = (trainObj, cls) => {
    if (!isFoodEligibleClass(cls)) {
      return { isAvail: false, isIncluded: false };
    }
    const isFirstAC = cls === '1A' || normalizeClassCode(cls).code === '1A';

    if (trainObj?.class_catering && trainObj.class_catering[cls] !== undefined) {
      const cfg = trainObj.class_catering[cls];
      let isAvail = false;
      if (typeof cfg === 'string') {
        isAvail = cfg.toLowerCase().includes('yes') || cfg.toLowerCase().includes('available') || cfg.toLowerCase().includes('included');
      } else if (typeof cfg === 'object' && cfg !== null) {
        isAvail = cfg.food_available === true || cfg.food_available === 'YES' || cfg.food_available === 'Yes' || String(cfg.food_available).toLowerCase().includes('avail') || String(cfg.food_available).toLowerCase().includes('true');
      }
      if (isFirstAC && cfg && cfg.food_available !== false && cfg.food_available !== 'NO' && cfg.food_available !== 'No' && cfg.food_available !== 'Not Available') {
        isAvail = true;
      }
      const isIncluded = cfg ? (cfg.payment_mode === 'Included in Ticket' || cfg.included_in_ticket || isFirstAC) : true;
      return { isAvail, isIncluded };
    }

    if (isFirstAC) {
      return { isAvail: true, isIncluded: true };
    }

    const isAvail = Boolean(trainObj?.food_available);
    const isIncluded = Boolean(trainObj?.catering?.included_in_ticket || isFirstAC);
    return { isAvail, isIncluded };
  };

  const getClassFare = (multiplier, className, routeBaseFare, train) => {
    let fare = 0;
    if (train?.fares_by_class && train.fares_by_class[className]) {
      fare = train.fares_by_class[className];
    } else if (train?.route?.segment_fares?.faresByClass && train.route.segment_fares.faresByClass[className]) {
      fare = train.route.segment_fares.faresByClass[className];
    } else {
      const baseFare = train?.route?.base_fare || routeBaseFare || 350;
      const mults = {
        '1A': 3.5,
        '2A': 2.2,
        '3A': 1.5,
        '3E': 1.35,
        'EC': 2.5,
        'CC': 1.2,
        'SL': 1.0,
        '2S': 0.6,
        'GEN': 0.4
      };
      const classMult = mults[className] || 1.0;
      fare = Math.round(baseFare * (multiplier || 1.0) * classMult);
    }

    const { isAvail, isIncluded } = checkClassCatering(train, className);
    if (isAvail && isIncluded) {
      fare = Math.max(fare, Math.round(fare * 1.45 + 120));
    }

    // Add Tatkal surcharge if current quota is Tatkal
    if (quota === 'TQ' || quota === 'TATKAL') {
      const tatkalCharge = train?.tatkal_charges_by_class?.[className] !== undefined 
        ? train.tatkal_charges_by_class[className] 
        : (
          ['1A', 'EC'].includes(className) ? 500 :
          ['2A'].includes(className) ? 400 :
          ['3A', '3E', 'CC'].includes(className) ? 300 :
          ['SL'].includes(className) ? 100 : 15
        );
      fare += tatkalCharge;
    }

    return fare;
  };

  const getSeatStatus = (trainId, className, currentQuota, trainObj = null) => {
    const key = `${trainId}_${className}`;
    const activeDate = normalizeDateStr(selectedDateByTrain[trainId] || trainObj?.departure_date || selectedSearchDate);

    // 1. Priority #1: Check date_wise_availability for the active date (or first available date box)
    if (activeDate && trainObj?.date_wise_availability?.[className]) {
      const dateBoxes = trainObj.date_wise_availability[className];
      const dateMatch = dateBoxes.find(b => normalizeDateStr(b.date) === activeDate);
      const targetBox = dateMatch || dateBoxes[0];
      if (targetBox) {
        const statusUpper = String(targetBox.status || targetBox.statusCode || '').toUpperCase();
        if (targetBox.statusType === 'NOT_OPEN' || statusUpper.includes('NOT OPEN') || statusUpper.includes('OPENS')) {
          return { type: 'NOT_OPEN', code: targetBox.status || 'TATKAL NOT OPEN', actionText: 'Not Open', color: 'text-amber-700 bg-amber-50 border-amber-200' };
        }
        if (targetBox.statusType === 'TATKAL_FULL' || statusUpper.includes('TATKAL FULL') || statusUpper.includes('TQ FULL')) {
          return { type: 'TATKAL_FULL', code: targetBox.status || 'TATKAL FULL', actionText: 'Tatkal Full', color: 'text-rose-700 bg-rose-50 border-rose-200' };
        }
        const isAvail = targetBox.statusType === 'AVAILABLE' || statusUpper.includes('AVAILABLE');
        const isRac = targetBox.statusType === 'RAC' || statusUpper.includes('RAC');
        const isWl = targetBox.statusType === 'WL' || statusUpper.includes('WL') || targetBox.statusType === 'WAITLIST' || targetBox.statusType === 'TQWL' || statusUpper.includes('TQWL');
        if (isAvail) {
          return { type: 'AVL', code: targetBox.status, actionText: 'Select Seat', color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' };
        } else if (isRac) {
          return { type: 'RAC', code: targetBox.status, actionText: 'Book RAC', color: 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300' };
        } else if (isWl) {
          return { type: 'WL', code: targetBox.status, actionText: String(targetBox.status).includes('TQWL') ? 'Book TQWL' : 'Book WL', color: 'text-rose-600 bg-rose-50 border-rose-100 hover:border-rose-300' };
        } else {
          return { type: 'NOT_AVAILABLE', code: targetBox.status || 'NOT AVAILABLE', actionText: 'Not Available', color: 'text-slate-600 bg-slate-100 border-slate-200' };
        }
      }
    }

    // 2. Priority #2: Check availability_by_class / availability from trainObj
    const classAvail = trainObj?.availability_by_class?.[className] || trainObj?.availability?.[className];
    if (classAvail) {
      const code = classAvail.statusLabel || classAvail.statusCode || (classAvail.statusType === 'AVAILABLE' ? `AVAILABLE ${classAvail.availableCount}` : classAvail.statusType);
      const codeUpper = String(code).toUpperCase();
      if (classAvail.statusType === 'NOT_OPEN' || codeUpper.includes('NOT OPEN') || codeUpper.includes('OPENS')) {
        return { type: 'NOT_OPEN', code, actionText: 'Not Open', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      }
      if (classAvail.statusType === 'TATKAL_FULL' || codeUpper.includes('TATKAL FULL') || codeUpper.includes('TQ FULL')) {
        return { type: 'TATKAL_FULL', code, actionText: 'Tatkal Full', color: 'text-rose-700 bg-rose-50 border-rose-200' };
      }
      if (classAvail.statusType === 'AVAILABLE') {
        return { type: 'AVL', code, actionText: 'Select Seat', color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' };
      } else if (classAvail.statusType === 'RAC') {
        return { type: 'RAC', code, actionText: 'Book RAC', color: 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300' };
      } else if (classAvail.statusType === 'WL' || classAvail.statusType === 'TQWL' || codeUpper.includes('TQWL')) {
        return { type: 'WL', code, actionText: codeUpper.includes('TQWL') ? 'Book TQWL' : 'Book WL', color: 'text-rose-600 bg-rose-50 border-rose-100 hover:border-rose-300' };
      } else if (classAvail.statusType === 'NOT_AVAILABLE' || classAvail.statusType === 'REGRET' || classAvail.isBookable === false) {
        return { type: 'NOT_AVAILABLE', code: 'NOT AVAILABLE', actionText: 'Not Available', color: 'text-slate-600 bg-slate-100 border-slate-200' };
      }
    }

    // 3. Priority #3: Check seatAvailabilityMap if populated and not marked departed
    const realAvail = typeof seatAvailabilityMap !== 'undefined' ? seatAvailabilityMap[key] : null;
    if (realAvail && !realAvail.isDeparted && realAvail.statusType !== 'DEPARTED') {
      const code = realAvail.statusLabel || realAvail.statusCode || (realAvail.statusType === 'AVAILABLE' ? `AVAILABLE ${realAvail.availableCount}` : realAvail.statusType);
      const codeUpper = String(code).toUpperCase();
      if (realAvail.statusType === 'NOT_OPEN' || codeUpper.includes('NOT OPEN') || codeUpper.includes('OPENS')) {
        return { type: 'NOT_OPEN', code, actionText: 'Not Open', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      }
      if (realAvail.statusType === 'TATKAL_FULL' || codeUpper.includes('TATKAL FULL') || codeUpper.includes('TQ FULL')) {
        return { type: 'TATKAL_FULL', code, actionText: 'Tatkal Full', color: 'text-rose-700 bg-rose-50 border-rose-200' };
      }
      if (realAvail.statusType === 'AVAILABLE') {
        return { type: 'AVL', code, actionText: 'Select Seat', color: 'text-emerald-600 bg-emerald-50 border-emerald-100 hover:border-emerald-300' };
      } else if (realAvail.statusType === 'RAC') {
        return { type: 'RAC', code, actionText: 'Book RAC', color: 'text-amber-600 bg-amber-50 border-amber-100 hover:border-amber-300' };
      } else if (realAvail.statusType === 'WL' || realAvail.statusType === 'TQWL' || codeUpper.includes('TQWL')) {
        return { type: 'WL', code, actionText: codeUpper.includes('TQWL') ? 'Book TQWL' : 'Book WL', color: 'text-rose-600 bg-rose-50 border-rose-100 hover:border-rose-300' };
      } else if (realAvail.statusType === 'NOT_AVAILABLE' || realAvail.statusType === 'REGRET' || realAvail.isBookable === false) {
        return { type: 'NOT_AVAILABLE', code: 'NOT AVAILABLE', actionText: 'Not Available', color: 'text-slate-600 bg-slate-100 border-slate-200' };
      }
    }

    return { type: 'NOT_AVAILABLE', code: 'NOT AVAILABLE', actionText: 'Not Available', color: 'text-slate-600 bg-slate-100 border-slate-200' };
  };

  const getDateWiseBoxes = (train, activeClass) => {
    if (!activeClass) return [];
    if (train.date_wise_availability && train.date_wise_availability[activeClass] && train.date_wise_availability[activeClass].length > 1) {
      return train.date_wise_availability[activeClass];
    }
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Truly date-specific train: only return its configured journey date!
    const isTrulyDateSpecific = Boolean(
      (train.is_date_specific === true || train.service_type === 'DATE_SPECIFIC') &&
      !train.service_pattern &&
      !(Array.isArray(train.specific_service_dates) && train.specific_service_dates.length > 1) &&
      !String(train.frequency || '').toLowerCase().includes('every') &&
      !String(train.running_days || '').toLowerCase().includes('every')
    );
    if (isTrulyDateSpecific) {
      const specificDate = normalizeDateStr(train.journey_date || (Array.isArray(train.specific_service_dates) && train.specific_service_dates[0]) || train.service_start_date);
      if (specificDate) {
        const parts = specificDate.split('-').map(Number);
        const sObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const avail = getSeatStatus(train.id, activeClass, quota, train);
        const fareVal = getClassFare(train.route?.fare_multiplier, activeClass, train.route?.base_fare, train);
        return [{
          date: specificDate,
          dateFormatted: `${weekDays[sObj.getDay()]}, ${sObj.getDate()} ${monthNames[sObj.getMonth()]}`,
          dayName: weekDays[sObj.getDay()],
          dayNum: sObj.getDate(),
          monthName: monthNames[sObj.getMonth()],
          status: avail.code || 'AVAILABLE',
          statusCode: avail.code || 'AVAILABLE',
          statusType: avail.type || 'AVAILABLE',
          availableCount: avail.type === 'AVL' ? 10 : 0,
          racCount: avail.type === 'RAC' ? 2 : 0,
          wlCount: avail.type === 'WL' ? 5 : 0,
          isBookable: avail.type !== 'NOT_AVAILABLE',
          fare: fareVal
        }];
      }
    }

    const baseDate = normalizeDateStr(selectedSearchDate || travelDate || new Date().toISOString().split('T')[0]);
    const parts = baseDate.split('-').map(Number);
    const startObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const runsOn = getRunsOnDays(train.frequency || train.running_days || train.route?.frequency, train.operating_days);
    const pattern = String(train.service_pattern || train.frequency_type || train.frequency || '').toLowerCase();
    const isEvery3Days = pattern.includes('every 3 days') || pattern === 'every_3_days' || pattern === 'every-3-days';
    const isEvery2Days = pattern.includes('every 2 days') || pattern === 'every_2_days' || pattern === 'every-2-days';
    const anchorDateStr = normalizeDateStr(train.pattern_start_date || train.service_start_date || '2026-10-23');
    const [ay, am, ad] = anchorDateStr.split('-').map(Number);
    const specDates = Array.isArray(train.specific_service_dates) ? train.specific_service_dates.map(normalizeDateStr) : [];

    const fallbackList = [];
    for (let offset = 0; offset < 90 && fallbackList.length < 25; offset++) {
      const cur = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + offset);
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;

      if (specDates.length > 0) {
        if (!specDates.includes(dStr)) continue;
      } else if (isEvery3Days) {
        const diff = Math.round((Date.UTC(cur.getFullYear(), cur.getMonth(), cur.getDate()) - Date.UTC(ay, am - 1, ad)) / (1000 * 60 * 60 * 24));
        if (diff < 0 || diff % 3 !== 0) continue;
      } else if (isEvery2Days) {
        const diff = Math.round((Date.UTC(cur.getFullYear(), cur.getMonth(), cur.getDate()) - Date.UTC(ay, am - 1, ad)) / (1000 * 60 * 60 * 24));
        if (diff < 0 || diff % 2 !== 0) continue;
      } else {
        const dayIdx = (cur.getDay() + 6) % 7;
        if (runsOn && runsOn[dayIdx] && !runsOn[dayIdx].active) {
          continue;
        }
      }
      const avail = getSeatStatus(train.id, activeClass, quota, train);
      const fareVal = getClassFare(train.route?.fare_multiplier, activeClass, train.route?.base_fare, train);
      fallbackList.push({
        date: dStr,
        dateFormatted: `${weekDays[cur.getDay()]}, ${cur.getDate()} ${monthNames[cur.getMonth()]}`,
        dayName: weekDays[cur.getDay()],
        dayNum: cur.getDate(),
        monthName: monthNames[cur.getMonth()],
        status: avail.code || 'AVAILABLE',
        statusCode: avail.code || 'AVAILABLE',
        statusType: avail.type || 'AVAILABLE',
        availableCount: avail.type === 'AVL' ? 10 : 0,
        racCount: avail.type === 'RAC' ? 2 : 0,
        wlCount: avail.type === 'WL' ? 5 : 0,
        isBookable: avail.type !== 'NOT_AVAILABLE',
        fare: fareVal
      });
    }
    return fallbackList;
  };

  const fiveDayWindow = useMemo(() => {
    return generateFiveDayWindow(baseSearchDate || travelDate || new Date().toISOString().split('T')[0]);
  }, [baseSearchDate, travelDate]);

  // Stations for filters
  const availableFromStations = useMemo(() => {
    const map = new Map();
    trains.forEach(t => {
      const code = t.from_station_code || t.source || t.route?.source_station_code;
      const name = t.from_station || t.route?.source_station_name || code;
      if (code && !map.has(code)) {
        map.set(code, { code, name });
      }
    });
    return Array.from(map.values());
  }, [trains]);

  const availableToStations = useMemo(() => {
    const map = new Map();
    trains.forEach(t => {
      const code = t.to_station_code || t.destination || t.route?.destination_station_code;
      const name = t.to_station || t.route?.destination_station_name || code;
      if (code && !map.has(code)) {
        map.set(code, { code, name });
      }
    });
    return Array.from(map.values());
  }, [trains]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedClassFilter.length > 0) count += selectedClassFilter.length;
    if (selectedTrainTypes.length > 0) count += selectedTrainTypes.length;
    if (departureTimes.length > 0) count += departureTimes.length;
    if (arrivalTimes.length > 0) count += arrivalTimes.length;
    if (selectedFromStations.length > 0) count += selectedFromStations.length;
    if (selectedToStations.length > 0) count += selectedToStations.length;
    if (trainSearchQuery) count += 1;
    return count;
  }, [selectedClassFilter, selectedTrainTypes, departureTimes, arrivalTimes, selectedFromStations, selectedToStations, trainSearchQuery]);

  const toggleFilter = (list, setList, val) => {
    if (list.includes(val)) {
      setList(list.filter(item => item !== val));
    } else {
      setList([...list, val]);
    }
  };

  const toggleSection = (sectionKey) => {
    setCollapsedFilterSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleResetFilters = () => {
    setSelectedClassFilter([]);
    setSelectedTrainTypes([]);
    setDepartureTimes([]);
    setArrivalTimes([]);
    setSelectedFromStations([]);
    setSelectedToStations([]);
    setTrainSearchQuery('');
    setPriceRange(5000);
    setSortBy('price');
    setQuickFilterAcOnly(false);
    setQuickFilterBestAvailable(false);
    setQuickFilterSleeperOnly(false);
    setQuickFilterAvailableOnly(false);
  };

  const ensureDateInWindow = (targetDateStr) => {
    if (!targetDateStr) return;
    const currentBase = baseSearchDate || selectedSearchDate || new Date().toISOString().split('T')[0];
    const [ty, tm, td] = targetDateStr.split('-').map(Number);
    const [by, bm, bd] = currentBase.split('-').map(Number);
    const targetObj = new Date(ty, tm - 1, td);
    const baseObj = new Date(by, bm - 1, bd);
    const diffDays = Math.round((targetObj.getTime() - baseObj.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays >= 7) {
      setBaseSearchDate(targetDateStr);
    }
  };

  // Explicit train search execution (triggered when SEARCH TRAINS is clicked, day navigation or date tab selected)
  const executeTrainSearch = async (searchData) => {
    const searchId = ++activeSearchIdRef.current;
    const src = searchData.source || currentSource || searchParams.get('source') || '';
    const dest = searchData.destination || currentDestination || searchParams.get('destination') || '';
    const rawDate = searchData.date || selectedSearchDate || searchParams.get('date') || new Date().toISOString().split('T')[0];
    const dateStr = normalizeDateStr(rawDate);
    const timeVal = searchData.time || searchTime || '18:30';
    const quotaVal = searchData.quota || currentQuota || searchParams.get('quota') || 'GN';
    if (searchData.quota && searchData.quota !== currentQuota) {
      setCurrentQuota(searchData.quota);
    }

    if (searchData.isNewSubmission || !baseSearchDate) {
      setBaseSearchDate(dateStr);
    }

    ensureDateInWindow(dateStr);
    setSelectedSearchDate(dateStr);

    const srcCode = extractCode(src);
    const destCode = extractCode(dest);

    if (!srcCode || !destCode || srcCode === destCode) {
      setTrains([]);
      setFilteredTrains([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setHasSearched(true);
    setTrains([]);
    setFilteredTrains([]);
    setExpandedClassByTrain({});
    setLoading(true);

    try {
      const queryStr = `?from=${encodeURIComponent(srcCode)}&to=${encodeURIComponent(destCode)}&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeVal)}&quota=${encodeURIComponent(quotaVal)}`;
      const res = await api.get(`/trains/live-search${queryStr}`);
      if (searchId !== activeSearchIdRef.current) return;

      const data = res.data;
      let fetched = data && Array.isArray(data.trains) ? data.trains : [];

      fetched = fetched.filter(t => !!t && t.status !== 'cancelled' && t.status !== 'inactive');

      // Keep Udupi Express (#12345) at the very end of the list
      const isTargetUdupi = (t) => {
        const num = String(t.train_number || t.number || '').trim();
        const name = String(t.train_name || t.name || '').toLowerCase().trim();
        return num === '12345' || name === 'udupi express';
      };
      fetched = [...fetched.filter(t => !isTargetUdupi(t)), ...fetched.filter(t => isTargetUdupi(t))];

      setTrains(fetched);
      setFilteredTrains(fetched);

      let statusText = 'Not Running';
      if (fetched.length > 0) {
        let hasAvail = false;
        let hasRac = false;
        let maxAvail = 0;
        for (const t of fetched) {
          const rawCls = t.available_classes || t.classes || [];
          for (const c of rawCls) {
            const clsCode = typeof c === 'object' ? c.code : String(c);
            const avail = t.availability?.[clsCode];
            if (avail) {
              if (avail.statusType === 'AVAILABLE' || avail.statusLabel?.includes('AVAILABLE')) {
                hasAvail = true;
                const count = avail.availableCount || parseInt(String(avail.statusLabel || '').replace(/\D/g, '') || '0', 10);
                if (count > maxAvail) maxAvail = count;
              } else if (avail.statusType === 'RAC') {
                hasRac = true;
              }
            }
          }
        }
        if (hasAvail) {
          statusText = maxAvail > 25 ? 'Available' : (maxAvail <= 12 && maxAvail > 0) ? 'Few Seats' : 'Filling Fast';
        } else if (hasRac) {
          statusText = 'RAC';
        } else {
          statusText = 'WL';
        }
      }

      setDateTabsAvailability(prev => {
        const nextMap = { ...prev, [dateStr]: statusText };
        if (fetched.length > 0) {
          fetched.forEach(t => {
            if (t.date_wise_availability) {
              Object.values(t.date_wise_availability).forEach(boxes => {
                if (Array.isArray(boxes)) {
                  boxes.forEach(b => {
                    const bDate = normalizeDateStr(b.date);
                    if (bDate && !nextMap[bDate]) {
                      const isAvail = b.statusType === 'AVAILABLE' || String(b.status).toUpperCase().includes('AVAILABLE');
                      const isRac = b.statusType === 'RAC' || String(b.status).toUpperCase().includes('RAC');
                      nextMap[bDate] = isAvail ? 'Available' : isRac ? 'RAC' : 'WL';
                    }
                  });
                }
              });
            }
          });
        }
        return nextMap;
      });

      setDataSourceLabel(data?.data_source_label || (data?.source === 'railradar' ? 'Live Data Source: RailRadar' : 'LIVE DATA UNAVAILABLE - Showing RailControl scheduled train information'));
      setLastUpdatedTime(data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      if (searchId !== activeSearchIdRef.current) return;
      console.error('Error in live-search fetch:', err);
      try {
        const queryFallback = `?source=${encodeURIComponent(srcCode)}&destination=${encodeURIComponent(destCode)}`;
        const res = await api.get(`/trains${queryFallback}`);
        if (searchId !== activeSearchIdRef.current) return;
        let fetched = Array.isArray(res.data) ? res.data : [];
        const isTargetUdupi = (t) => {
          const num = String(t.train_number || t.number || '').trim();
          const name = String(t.train_name || t.name || '').toLowerCase().trim();
          return num === '12345' || name === 'udupi express';
        };
        fetched = [...fetched.filter(t => !isTargetUdupi(t)), ...fetched.filter(t => isTargetUdupi(t))];
        setTrains(fetched);
        setFilteredTrains(fetched);

        const statusText = fetched.length > 0 ? 'Trains Available' : 'No Trains';
        setDateTabsAvailability(prev => ({
          ...prev,
          [dateStr]: statusText
        }));

        setDataSourceLabel('LIVE DATA UNAVAILABLE - Showing RailControl scheduled train information');
        setLastUpdatedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } catch (fallbackErr) {
        if (searchId !== activeSearchIdRef.current) return;
        console.error('Fallback train fetch failed:', fallbackErr);
        setTrains([]);
        setFilteredTrains([]);
      }
    } finally {
      if (searchId === activeSearchIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleDateTabSelect = (clickedDateStr) => {
    if (clickedDateStr === selectedSearchDate && !loading) return;

    const src = currentSource || searchParams.get('source') || '';
    const dest = currentDestination || searchParams.get('destination') || '';

    const params = new URLSearchParams(searchParams);
    params.set('source', src);
    params.set('destination', dest);
    params.set('date', clickedDateStr);
    params.set('passengers', currentPassengers);
    params.set('class', currentClass);
    params.set('quota', currentQuota);
    setSearchParams(params, { replace: true });

    setSelectedSearchDate(clickedDateStr);
    ensureDateInWindow(clickedDateStr);

    executeTrainSearch({
      source: src,
      destination: dest,
      date: clickedDateStr,
      time: searchTime,
      passengers: currentPassengers,
      class: currentClass,
      quota: currentQuota,
      isNewSubmission: false
    });
  };

  const handleNavigateDay = (offsetDays) => {
    const curDateStr = selectedSearchDate || searchParams.get('date') || new Date().toISOString().split('T')[0];
    const cleanDate = normalizeDateStr(curDateStr);
    const parts = cleanDate.split('-').map(Number);
    const curObj = new Date(parts[0], parts[1] - 1, parts[2]);
    curObj.setDate(curObj.getDate() + offsetDays);

    const yyyy = curObj.getFullYear();
    const mm = String(curObj.getMonth() + 1).padStart(2, '0');
    const dd = String(curObj.getDate()).padStart(2, '0');
    const newDateStr = `${yyyy}-${mm}-${dd}`;

    const src = currentSource || searchParams.get('source') || '';
    const dest = currentDestination || searchParams.get('destination') || '';

    const params = new URLSearchParams(searchParams);
    params.set('source', src);
    params.set('destination', dest);
    params.set('date', newDateStr);
    params.set('passengers', currentPassengers);
    params.set('class', currentClass);
    params.set('quota', currentQuota);
    setSearchParams(params, { replace: true });

    setSelectedSearchDate(newDateStr);
    ensureDateInWindow(newDateStr);

    executeTrainSearch({
      source: src,
      destination: dest,
      date: newDateStr,
      time: searchTime,
      passengers: currentPassengers,
      class: currentClass,
      quota: currentQuota,
      isNewSubmission: false
    });
  };

  const handleBook = (trainId, coachClass, fare, t, customDate = null) => {
    const src = t?.from_station_code || t?.source || extractCode(currentSource);
    const dest = t?.to_station_code || t?.destination || extractCode(currentDestination);
    const depDate = customDate || t?.departure_date || selectedSearchDate;
    const availability = getSeatStatus(trainId, coachClass, currentQuota, t);
    const statusVal = availability?.code || availability?.statusLabel || '';
    const svcInstanceId = t?.service_instance_id || (t?.train_number ? `svc-${t.train_number}-${depDate}` : `svc-${trainId}-${depDate}`);
    const trainNum = t?.train_number || '';
    navigate(`/passenger/booking?train_id=${trainId}&train_number=${encodeURIComponent(trainNum)}&class_code=${encodeURIComponent(coachClass)}&class=${encodeURIComponent(coachClass)}&journey_date=${encodeURIComponent(depDate)}&date=${encodeURIComponent(depDate)}&service_instance_id=${svcInstanceId}&service_id=${svcInstanceId}&passengers=${currentPassengers}&fare=${fare}&source=${encodeURIComponent(src)}&destination=${encodeURIComponent(dest)}&quota=${currentQuota}&status=${encodeURIComponent(statusVal)}`);
  };

  const fetchClassDates = async (train, clsCode) => {
    if (!train || !clsCode) return;
    const cacheKey = `${train.id}_${clsCode}`;
    const numKey = `${train.train_number}_${clsCode}`;
    try {
      setLoadingClassDates(prev => ({ ...prev, [cacheKey]: true }));
      const tNumOrId = train.id || train.train_number;
      const src = train.from_station_code || train.source || extractCode(currentSource);
      const dest = train.to_station_code || train.destination || extractCode(currentDestination);
      const fromDate = selectedSearchDate || train.departure_date;
      
      const res = await api.get(`/trains/${encodeURIComponent(tNumOrId)}/class-availability-dates?source=${encodeURIComponent(src)}&destination=${encodeURIComponent(dest)}&class_code=${encodeURIComponent(clsCode)}&from_date=${encodeURIComponent(fromDate)}`);
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setClassDatesCache(prev => ({
          ...prev,
          [cacheKey]: res.data,
          [numKey]: res.data
        }));
      }
    } catch (err) {
      console.warn('Could not fetch class availability dates from backend:', err);
    } finally {
      setLoadingClassDates(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

  const handleClassClick = (trainId, clsCode) => {
    const isCurrentlyExpanded = expandedClassByTrain[trainId] === clsCode;
    const nextClass = isCurrentlyExpanded ? null : clsCode;

    setExpandedClassByTrain(prev => ({ ...prev, [trainId]: nextClass }));
    setSelectedClassByTrain(prev => ({ ...prev, [trainId]: nextClass || prev[trainId] }));

    if (nextClass) {
      const train = trains.find(tr => tr.id === trainId || String(tr.train_number) === String(trainId));
      const cacheKey = `${trainId}_${clsCode}`;
      if (!classDatesCache[cacheKey]) {
        fetchClassDates(train || { id: trainId, train_number: trainId }, clsCode);
      }
    }
  };

  const scrollDateRow = (trainId, direction) => {
    const container = dateScrollContainerRefs.current[trainId];
    if (container) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleDateCardSelect = (trainId, dateStr) => {
    setSelectedDateByTrain(prev => ({ ...prev, [trainId]: dateStr }));
  };

  const handleDateCardBook = (t, clsCode, box) => {
    const chosenDate = box.journey_date || box.date;
    setSelectedDateByTrain(prev => ({ ...prev, [t.id]: chosenDate }));
    handleBook(t.id, clsCode, box.fare, t, chosenDate);
  };

  // On mount: clear any query parameters from URL and ensure form starts completely blank
  useEffect(() => {
    try {
      localStorage.removeItem('rail_last_search_source');
      localStorage.removeItem('rail_last_search_dest');
    } catch (e) {}

    // Reset everything so the form starts clean and no details are pre-filled
    if (searchParams.toString()) {
      setSearchParams({}, { replace: true });
    }
    setCurrentSource('');
    setCurrentDestination('');
    setSelectedSearchDate('');
    setBaseSearchDate('');
    setHasSearched(false);
    setTrains([]);
    setFilteredTrains([]);
  }, []);

  // Real-time polling auto-refresh (every 25s safe interval for running trains)
  useEffect(() => {
    if (!hasSearched || loading || trains.length === 0) return;

    const hasActiveRunning = trains.some(t => {
      const st = (t.live_status?.status || t.status || '').toUpperCase();
      return st === 'RUNNING' || st === 'DELAYED' || st === 'ON_TIME';
    });

    if (!hasActiveRunning) return;

    let isCancelled = false;
    let isFetching = false;

    const intervalId = setInterval(async () => {
      if (isFetching || isCancelled) return;
      isFetching = true;
      try {
        const srcCode = extractCode(source);
        const destCode = extractCode(destination);
        const dateStr = selectedSearchDate || travelDate || new Date().toISOString().split('T')[0];

        const res = await api.get(`/trains/live-search?from=${srcCode}&to=${destCode}&date=${dateStr}&time=${searchTime}&quota=${encodeURIComponent(quota)}`);
        if (!isCancelled && res.data && Array.isArray(res.data.trains)) {
          const updated = res.data.trains.filter(t => !!t && t.status !== 'cancelled' && t.status !== 'inactive');
          setTrains(updated);
          setDataSourceLabel(res.data.data_source_label || 'Live Data Source: RailRadar');
          setLastUpdatedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (err) {
        console.error('Real-time live search refresh error:', err);
      } finally {
        isFetching = false;
      }
    }, 25000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [hasSearched, source, destination, selectedSearchDate, travelDate, searchTime, loading, trains, quota]);

  useEffect(() => {
    if (!hasSearched || trains.length === 0) {
      setAiRecommendations(null);
      setAiInsights('');
      return;
    }
    const fetchRecommendations = async () => {
      if (!source || !destination) return;
      setLoadingAi(true);
      try {
        const res = await api.get(`/ai/recommendations?source=${source}&destination=${destination}`);
        const recs = res.data.recommendedTrains || [];
        const activeTrainNumbers = new Set(trains.map(t => String(t.train_number)));
        const filteredRecs = recs.filter(r => activeTrainNumbers.has(String(r.train_number)));

        setAiRecommendations(filteredRecs.length > 0 ? filteredRecs : null);
        setAiInsights(filteredRecs.length > 0 ? res.data.insights : '');
      } catch (err) {
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoadingAi(false);
      }
    };
    fetchRecommendations();
  }, [hasSearched, source, destination, trains]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...trains];

    // Completely remove departed trains from passenger search results (Requirement 3)
    result = result.filter(t => !t.is_departed && t.live_status?.status !== 'COMPLETED');

    // Search query filter
    if (trainSearchQuery) {
      const q = trainSearchQuery.toLowerCase();
      result = result.filter(t => 
        (t.train_name && t.train_name.toLowerCase().includes(q)) ||
        (t.train_number && String(t.train_number).toLowerCase().includes(q)) ||
        (t.route?.source_station_code && t.route.source_station_code.toLowerCase().includes(q)) ||
        (t.route?.destination_station_code && t.route.destination_station_code.toLowerCase().includes(q)) ||
        (t.from_station_code && t.from_station_code.toLowerCase().includes(q)) ||
        (t.to_station_code && t.to_station_code.toLowerCase().includes(q))
      );
    }

    // Class Filter
    if (selectedClassFilter.length > 0 && !selectedClassFilter.some(c => c === 'ALL' || c === 'ALL CLASSES')) {
      result = result.filter(t => {
        const rawCls = t.available_classes || t.classes || [];
        const tClasses = (Array.isArray(rawCls) && rawCls.length > 0)
          ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
          : getDefaultClassesForTrain(t.train_name, t.train_type);
        return selectedClassFilter.some(c => tClasses.includes(c));
      });
    }

    // Train Type Filter - uses stored train type/category, not train name
    if (selectedTrainTypes.length > 0) {
      result = result.filter(t => {
        const tType = String(t.train_type || t.trainType || t.category || '').trim().toLowerCase();
        return selectedTrainTypes.some(type => {
          const typeLower = String(type).trim().toLowerCase();
          if (typeLower === 'special / other' || typeLower === 'other') {
            return tType === 'special / other' || !['rajdhani', 'shatabdi', 'vande bharat', 'duronto', 'humsafar', 'superfast', 'express'].some(k => tType.includes(k));
          }
          return tType === typeLower || tType.includes(typeLower);
        });
      });
    }

    // Departure Time filter
    if (departureTimes.length > 0) {
      result = result.filter(t => {
        const timeStr = t.departure_time || t.departureTime || t.route?.departure_time || '08:00';
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (isNaN(hour)) return true;

        if (departureTimes.includes('early_morning') && hour >= 0 && hour < 6) return true;
        if (departureTimes.includes('morning') && hour >= 6 && hour < 12) return true;
        if (departureTimes.includes('mid_day') && hour >= 12 && hour < 18) return true;
        if (departureTimes.includes('night') && hour >= 18 && hour < 24) return true;
        return false;
      });
    }

    // Arrival Time filter
    if (arrivalTimes.length > 0) {
      result = result.filter(t => {
        const timeStr = t.arrival_time || t.arrivalTime || t.route?.arrival_time || '18:00';
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (isNaN(hour)) return true;

        if (arrivalTimes.includes('early_morning') && hour >= 0 && hour < 6) return true;
        if (arrivalTimes.includes('morning') && hour >= 6 && hour < 12) return true;
        if (arrivalTimes.includes('mid_day') && hour >= 12 && hour < 18) return true;
        if (arrivalTimes.includes('night') && hour >= 18 && hour < 24) return true;
        return false;
      });
    }

    // From Stations filter
    if (selectedFromStations.length > 0) {
      result = result.filter(t => {
        const code = t.from_station_code || t.source || t.route?.source_station_code;
        return selectedFromStations.includes(code);
      });
    }

    // To Stations filter
    if (selectedToStations.length > 0) {
      result = result.filter(t => {
        const code = t.to_station_code || t.destination || t.route?.destination_station_code;
        return selectedToStations.includes(code);
      });
    }

    // Max Ticket Fare Range filter
    if (priceRange && priceRange < 5000) {
      result = result.filter(t => {
        const rawCls = t.available_classes || t.classes || [];
        const tClasses = (Array.isArray(rawCls) && rawCls.length > 0)
          ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
          : getDefaultClassesForTrain(t.train_name, t.train_type);

        const lowestFare = Math.min(...tClasses.map(cls => {
          const mult = t.route?.fare_multiplier || 1.0;
          return getClassFare(mult, cls, t.route?.base_fare, t);
        }));

        return lowestFare <= priceRange;
      });
    }

    // Quick Filter: AC Only
    if (quickFilterAcOnly) {
      const acClasses = ['1A', '2A', '3A', '3E', 'CC', 'EC'];
      result = result.filter(t => {
        const rawCls = t.available_classes || t.classes || [];
        const tClasses = (Array.isArray(rawCls) && rawCls.length > 0)
          ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
          : getDefaultClassesForTrain(t.train_name, t.train_type);
        return tClasses.some(c => acClasses.includes(c));
      });
    }

    // Quick Filter: Sleeper
    if (quickFilterSleeperOnly) {
      result = result.filter(t => {
        const rawCls = t.available_classes || t.classes || [];
        const tClasses = (Array.isArray(rawCls) && rawCls.length > 0)
          ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
          : getDefaultClassesForTrain(t.train_name, t.train_type);
        return tClasses.includes('SL');
      });
    }

    // Quick Filter: Available Only
    if (quickFilterAvailableOnly) {
      result = result.filter(t => {
        const rawCls = t.available_classes || t.classes || [];
        const tClasses = (Array.isArray(rawCls) && rawCls.length > 0)
          ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
          : getDefaultClassesForTrain(t.train_name, t.train_type);
        return tClasses.some(cls => {
          const st = getSeatStatus(t.id, cls, quota, t);
          return st.type === 'AVL' || st.code?.toUpperCase().includes('AVAILABLE');
        });
      });
    }

    // Quick Filter: Best Available
    if (quickFilterBestAvailable) {
      result.sort((a, b) => {
        const getBestAvail = (train) => {
          const rawCls = train.available_classes || train.classes || [];
          const tClasses = (Array.isArray(rawCls) && rawCls.length > 0)
            ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
            : getDefaultClassesForTrain(train.train_name, train.train_type);
          let maxCount = 0;
          for (const cls of tClasses) {
            const st = getSeatStatus(train.id, cls, quota, train);
            if (st.type === 'AVL' || st.code?.toUpperCase().includes('AVAILABLE')) {
              const num = parseInt(String(st.code).replace(/\D/g, '') || '10', 10);
              if (num > maxCount) maxCount = num;
            }
          }
          return maxCount;
        };
        return getBestAvail(b) - getBestAvail(a);
      });
    }

    // Sorting
    if (sortBy === 'price') {
      result.sort((a, b) => {
        const multA = a.route?.fare_multiplier || 1.0;
        const multB = b.route?.fare_multiplier || 1.0;
        return multA - multB;
      });
    } else if (sortBy === 'departure') {
      result.sort((a, b) => {
        const timeA = a.departure_time || a.route?.departure_time || '00:00';
        const timeB = b.departure_time || b.route?.departure_time || '00:00';
        return timeA.localeCompare(timeB);
      });
    } else if (sortBy === 'duration') {
      result.sort((a, b) => {
        const distA = a.duration_minutes || a.route?.duration_minutes || a.route?.distance_km || 1000;
        const distB = b.duration_minutes || b.route?.duration_minutes || b.route?.distance_km || 1000;
        return distA - distB;
      });
    }

    // Always place Udupi Express (#12345) at the very last position in search results
    const isTargetUdupiExpress = (t) => {
      const num = String(t.train_number || t.number || '').trim();
      const name = String(t.train_name || t.name || '').toLowerCase().trim();
      return num === '12345' || name === 'udupi express';
    };

    const regularTrains = result.filter(t => !isTargetUdupiExpress(t));
    const targetTrains = result.filter(t => isTargetUdupiExpress(t));
    result = [...regularTrains, ...targetTrains];

    setFilteredTrains(result);
  }, [trains, departureTimes, arrivalTimes, selectedClassFilter, selectedTrainTypes, selectedFromStations, selectedToStations, priceRange, sortBy, trainSearchQuery, seatAvailabilityMap, quota, quickFilterAcOnly, quickFilterBestAvailable, quickFilterSleeperOnly, quickFilterAvailableOnly]);

  useEffect(() => {
    const fetchSeatAvailabilities = async () => {
      if (!trains || trains.length === 0) return;
      const newMap = {};
      const dateVal = normalizeDateStr(selectedSearchDate || travelDate || new Date().toISOString().split('T')[0]);
      const srcCode = extractCode(source);
      const destCode = extractCode(destination);
      await Promise.all(trains.slice(0, 10).map(async (train) => {
        const rawClasses = train.available_classes || train.classes || [];
        const classesList = (Array.isArray(rawClasses) && rawClasses.length > 0)
          ? rawClasses.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
          : getDefaultClassesForTrain(train.train_name, train.train_type);

        for (const cls of classesList) {
          try {
            const res = await api.get(`/trains/${train.id}/seat-availability?journeyDate=${encodeURIComponent(dateVal)}&classCode=${encodeURIComponent(cls)}&quota=${encodeURIComponent(quota)}&fromStation=${encodeURIComponent(srcCode || '')}&toStation=${encodeURIComponent(destCode || '')}`);
            if (res.data && res.data.statusLabel && !res.data.isDeparted && res.data.statusType !== 'DEPARTED') {
              newMap[`${train.id}_${cls}`] = res.data;
            }
          } catch (e) {
            // fallback
          }
        }
      }));
      setSeatAvailabilityMap(prev => ({ ...prev, ...newMap }));
    };
    fetchSeatAvailabilities();
  }, [trains, selectedSearchDate, travelDate, quota, source, destination]);

  const getTrainSchedule = (trainNum) => {
    if (trainNum === '12952') {
      return [
        { seq: 1, name: 'New Delhi', code: 'NDLS', arr: '--:--', dep: '16:30', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Bhopal Junction', code: 'BPL', arr: '23:40', dep: '23:50', dist: '707 km', halt: '10m' },
        { seq: 3, name: 'Mumbai Central', code: 'MMCT', arr: '08:15', dep: '--:--', dist: '1384 km', halt: '--' },
      ];
    } else if (trainNum === '12002') {
      return [
        { seq: 1, name: 'New Delhi', code: 'NDLS', arr: '--:--', dep: '06:00', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Agra Cantt', code: 'AGC', arr: '07:50', dep: '07:55', dist: '188 km', halt: '5m' },
        { seq: 3, name: 'Bhopal Junction', code: 'BPL', arr: '14:25', dep: '--:--', dist: '707 km', halt: '--' },
      ];
    } else if (trainNum === '22436') {
      return [
        { seq: 1, name: 'New Delhi', code: 'NDLS', arr: '--:--', dep: '06:00', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Agra Cantt', code: 'AGC', arr: '07:45', dep: '07:48', dist: '188 km', halt: '3m' },
        { seq: 3, name: 'Gwalior Junction', code: 'GWL', arr: '09:20', dep: '09:22', dist: '313 km', halt: '2m' },
        { seq: 4, name: 'Varanasi Junction', code: 'BSB', arr: '14:00', dep: '--:--', dist: '759 km', halt: '--' },
      ];
    } else if (trainNum === '12301') {
      return [
        { seq: 1, name: 'Howrah Junction', code: 'HWH', arr: '--:--', dep: '16:55', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Patna Junction', code: 'PAT', arr: '22:10', dep: '22:20', dist: '530 km', halt: '10m' },
        { seq: 3, name: 'Delhi Junction', code: 'DEL', arr: '09:30', dep: '09:40', dist: '1445 km', halt: '10m' },
        { seq: 4, name: 'New Delhi', code: 'NDLS', arr: '10:00', dep: '--:--', dist: '1450 km', halt: '--' },
      ];
    } else {
      return [
        { seq: 1, name: 'Hazrat Nizamuddin', code: 'NZM', arr: '--:--', dep: '08:10', dist: '0 km', halt: '--' },
        { seq: 2, name: 'Agra Cantt', code: 'AGC', arr: '09:50', dep: '--:--', dist: '188 km', halt: '--' },
      ];
    }
  };

  const handlePredictDelay = async (trainNumber) => {
    setPredictingNumber(trainNumber);
    try {
      const res = await api.post('/ai/predict-delay', {
        train_number: trainNumber,
        travel_date: selectedSearchDate || travelDate
      });
      setPredictedDelay(res.data);
      setShowDelayModal(true);
    } catch (err) {
      console.error('Error predicting delay:', err);
      alert('Failed to generate delay predictions.');
    } finally {
      setPredictingNumber(null);
    }
  };

  const getQuotaName = (code) => {
    if (code === 'TQ' || code === 'TATKAL') return 'Tatkal Quota';
    if (code === 'PT' || code === 'PREMIUM_TATKAL') return 'Premium Tatkal';
    if (code === 'LD') return 'Ladies Quota';
    if (code === 'SR') return 'Lower Berth / Senior Citizen';
    if (code === 'HP') return 'Divyangjan / Disabled';
    return 'General Quota';
  };

  // Reusable Filter Sidebar
  const renderFiltersSidebar = () => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      {/* Filters Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-primary-600" />
          <h3 className="font-extrabold text-sm text-slate-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="bg-primary-50 text-primary-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-primary-100">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={handleResetFilters}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </button>
        )}
      </div>

      {/* Section 1: Journey Class */}
      <div className="border-b border-slate-100 pb-3">
        <button
          onClick={() => toggleSection('class')}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-1"
        >
          <span className="uppercase tracking-wider text-[11px] text-slate-700 font-black">Journey Class</span>
          {collapsedFilterSections.class ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        {!collapsedFilterSections.class && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {FILTER_CLASSES.map(cls => {
              const checked = selectedClassFilter.includes(cls.code);
              return (
                <label key={cls.code} className="flex items-center space-x-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFilter(selectedClassFilter, setSelectedClassFilter, cls.code)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                  />
                  <span className={`text-[11.5px] ${checked ? 'font-bold text-primary-800' : 'font-medium'}`}>
                    {cls.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Train Type */}
      <div className="border-b border-slate-100 pb-3">
        <button
          onClick={() => toggleSection('trainType')}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-1"
        >
          <span className="uppercase tracking-wider text-[11px] text-slate-700 font-black">Train Type</span>
          {collapsedFilterSections.trainType ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        {!collapsedFilterSections.trainType && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {FILTER_TRAIN_TYPES.map(tType => {
              const checked = selectedTrainTypes.includes(tType.code);
              return (
                <label key={tType.code} className="flex items-center space-x-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFilter(selectedTrainTypes, setSelectedTrainTypes, tType.code)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                  />
                  <span className={`text-[11.5px] ${checked ? 'font-bold text-primary-800' : 'font-medium'}`}>
                    {tType.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Departure Time */}
      <div className="border-b border-slate-100 pb-3">
        <button
          onClick={() => toggleSection('depTime')}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-1"
        >
          <span className="uppercase tracking-wider text-[11px] text-slate-700 font-black">Departure Time</span>
          {collapsedFilterSections.depTime ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        {!collapsedFilterSections.depTime && (
          <div className="mt-2 space-y-1.5">
            {TIME_SLOTS.map(slot => {
              const checked = departureTimes.includes(slot.key);
              return (
                <label key={slot.key} className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilter(departureTimes, setDepartureTimes, slot.key)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                    />
                    <span className={`text-[11.5px] ${checked ? 'font-bold text-primary-800' : 'font-medium'}`}>
                      {slot.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{slot.time}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 4: Arrival Time */}
      <div className="border-b border-slate-100 pb-3">
        <button
          onClick={() => toggleSection('arrTime')}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-1"
        >
          <span className="uppercase tracking-wider text-[11px] text-slate-700 font-black">Arrival Time</span>
          {collapsedFilterSections.arrTime ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        {!collapsedFilterSections.arrTime && (
          <div className="mt-2 space-y-1.5">
            {TIME_SLOTS.map(slot => {
              const checked = arrivalTimes.includes(slot.key);
              return (
                <label key={slot.key} className="flex items-center justify-between text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilter(arrivalTimes, setArrivalTimes, slot.key)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                    />
                    <span className={`text-[11.5px] ${checked ? 'font-bold text-primary-800' : 'font-medium'}`}>
                      {slot.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{slot.time}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 5: From Stations (if multiple available) */}
      {availableFromStations.length > 1 && (
        <div className="border-b border-slate-100 pb-3">
          <button
            onClick={() => toggleSection('fromStation')}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-1"
          >
            <span className="uppercase tracking-wider text-[11px] text-slate-700 font-black">From Stations</span>
            {collapsedFilterSections.fromStation ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {!collapsedFilterSections.fromStation && (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {availableFromStations.map(stn => {
                const checked = selectedFromStations.includes(stn.code);
                return (
                  <label key={stn.code} className="flex items-center space-x-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilter(selectedFromStations, setSelectedFromStations, stn.code)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                    />
                    <span className={`text-[11.5px] ${checked ? 'font-bold text-primary-800' : 'font-medium'}`}>
                      {stn.name} ({stn.code})
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 6: To Stations (if multiple available) */}
      {availableToStations.length > 1 && (
        <div>
          <button
            onClick={() => toggleSection('toStation')}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-1"
          >
            <span className="uppercase tracking-wider text-[11px] text-slate-700 font-black">To Stations</span>
            {collapsedFilterSections.toStation ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {!collapsedFilterSections.toStation && (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {availableToStations.map(stn => {
                const checked = selectedToStations.includes(stn.code);
                return (
                  <label key={stn.code} className="flex items-center space-x-2 text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilter(selectedToStations, setSelectedToStations, stn.code)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                    />
                    <span className={`text-[11.5px] ${checked ? 'font-bold text-primary-800' : 'font-medium'}`}>
                      {stn.name} ({stn.code})
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Search Form Inline Banner */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-visible z-20">
        <TrainSearchForm 
          initialData={{
            source: hasSearched && currentSource ? `${extractName(currentSource)} (${extractCode(currentSource)})` : '',
            sourceCode: hasSearched && currentSource ? extractCode(currentSource) : '',
            destination: hasSearched && currentDestination ? `${extractName(currentDestination)} (${extractCode(currentDestination)})` : '',
            destCode: hasSearched && currentDestination ? extractCode(currentDestination) : '',
            travelDate: hasSearched && selectedSearchDate ? selectedSearchDate : '',
            passengers: currentPassengers || '1',
            selectedClass: currentClass || 'ALL',
            quota: currentQuota || 'GN',
            disabilityConcession: disabilityConcession,
            railwayPassConcession: railwayPassConcession
          }}
          onSearchSubmit={(data) => {
            let src = (data.source || '').trim();
            if (src.toUpperCase() === 'UDU' || src.toUpperCase() === 'UDUPI') src = 'UD';
            let dest = (data.destination || '').trim();
            if (dest.toUpperCase() === 'UDU' || dest.toUpperCase() === 'UDUPI') dest = 'UD';
            const dStr = normalizeDateStr(data.date);
            const clsVal = data.selectedClass || data.class || currentClass || 'ALL';
            const quotaVal = data.quota || currentQuota || 'GN';
            const paxVal = data.passengers || currentPassengers || '1';

            if (!src || !dest) {
              alert('Please select both From and To stations.');
              return;
            }

            setCurrentSource(src);
            setCurrentDestination(dest);
            setSelectedSearchDate(dStr);
            setBaseSearchDate(dStr);
            setCurrentClass(clsVal);
            setCurrentQuota(quotaVal);
            setCurrentPassengers(paxVal);

            const params = new URLSearchParams({
              source: src,
              destination: dest,
              date: dStr,
              passengers: paxVal,
              class: clsVal,
              quota: quotaVal,
              disabilityConcession: data.disabilityConcession || false,
              railwayPassConcession: data.railwayPassConcession || false
            });
            setSearchParams(params, { replace: true });

            executeTrainSearch({
              ...data,
              source: src,
              destination: dest,
              date: dStr,
              passengers: paxVal,
              class: clsVal,
              quota: quotaVal,
              isNewSubmission: true
            });
          }}
          darkVariant={false}
        />
      </div>

      {/* Search Header: Route, count, and context */}
      {hasSearched && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <span>{extractName(source) || 'SOURCE'}</span>
              <span className="font-mono text-xs sm:text-sm text-primary-700 font-extrabold">({extractCode(source) || 'SRC'})</span>
              <span className="text-slate-400 font-normal">&rarr;</span>
              <span>{extractName(destination) || 'DESTINATION'}</span>
              <span className="font-mono text-xs sm:text-sm text-primary-700 font-extrabold">({extractCode(destination) || 'DST'})</span>
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[11px] border border-slate-200">
                {getQuotaName(quota)} ({quota})
              </span>
              <span className="bg-primary-50 text-primary-800 px-2 py-0.5 rounded font-bold text-[11px] border border-primary-100">
                {formatDateFriendly(selectedSearchDate)}
              </span>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">
            {filteredTrains.length} {filteredTrains.length === 1 ? 'Train' : 'Trains'} found between {extractName(source) || source} ({extractCode(source)}) to {extractName(destination) || destination} ({extractCode(destination)})
          </p>
        </div>
      )}

      {/* Horizontal Date Selector Bar with Quick Filters */}
      {hasSearched && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-primary-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">Select Journey Date</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleNavigateDay(-1)}
                disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs active:scale-95 transition disabled:opacity-50"
                title="Search Previous Day"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Previous Day</span>
              </button>
              <button
                onClick={() => handleNavigateDay(1)}
                disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs active:scale-95 transition disabled:opacity-50"
                title="Search Next Day"
              >
                <span className="hidden sm:inline">Next Day</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
            {fiveDayWindow.map((item) => {
              const isActive = item.dateStr === selectedSearchDate;
              const availLabel = dateTabsAvailability[item.dateStr] || (isActive ? (trains.length > 0 ? 'Available' : 'Not Running') : 'Check Date');
              const isNotRunning = availLabel === 'Not Running' || availLabel === 'No Trains';
              const isFew = availLabel === 'Few Seats' || availLabel === 'Filling Fast';
              const isWl = availLabel === 'WL';

              return (
                <button
                  key={item.dateStr}
                  onClick={() => handleDateTabSelect(item.dateStr)}
                  disabled={loading && isActive}
                  className={`flex-1 min-w-[100px] sm:min-w-[120px] rounded-xl p-2.5 border text-left transition-all duration-200 shrink-0 relative overflow-hidden group ${
                    isActive
                      ? 'border-primary-600 bg-gradient-to-b from-primary-50/80 via-indigo-50/30 to-white text-primary-950 ring-2 ring-primary-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary-600" />
                  )}

                  <div className="flex items-baseline justify-between">
                    <span className={`text-xs font-bold ${isActive ? 'text-primary-800 font-extrabold' : 'text-slate-700'}`}>
                      {item.dayName}, {item.dayNum}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {item.monthName}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center">
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border ${
                      isActive
                        ? isNotRunning ? 'bg-rose-50 text-rose-700 border-rose-100' : isFew ? 'bg-amber-50 text-amber-800 border-amber-200' : isWl ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : isNotRunning ? 'bg-slate-100 text-slate-500 border-slate-200' : isFew ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-200/80 group-hover:bg-primary-50 group-hover:text-primary-700'
                    }`}>
                      {availLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Filters Row */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 shrink-0 mr-1">
              Quick Filters:
            </span>
            <button
              type="button"
              onClick={() => setQuickFilterBestAvailable(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all border shrink-0 ${
                quickFilterBestAvailable
                  ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Best Available</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickFilterAcOnly(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all border shrink-0 ${
                quickFilterAcOnly
                  ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Wind className="h-3 w-3" />
              <span>AC Only</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickFilterSleeperOnly(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all border shrink-0 ${
                quickFilterSleeperOnly
                  ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Coffee className="h-3 w-3" />
              <span>Sleeper</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickFilterAvailableOnly(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all border shrink-0 ${
                quickFilterAvailableOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <Check className="h-3 w-3" />
              <span>Available Only</span>
            </button>
          </div>
        </div>
      )}

      {/* 2-COLUMN MAIN CONTENT: FILTERS SIDEBAR + RESULTS */}
      {!hasSearched || !currentSource || !currentDestination ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 sm:p-16 text-center text-slate-400 shadow-xs max-w-2xl mx-auto space-y-4 my-8">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto text-primary-600 shadow-inner">
            <Train className="h-8 w-8" />
          </div>
          <h3 className="font-black text-slate-800 text-lg">Search for Trains</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Select your source station, destination station, and journey date above, then click <strong className="text-slate-700">"SEARCH TRAINS"</strong> to check live schedules, seat availability, and fares.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* DESKTOP FILTERS SIDEBAR */}
        <div className="hidden lg:block w-72 shrink-0">
          {renderFiltersSidebar()}
        </div>

        {/* RIGHT COLUMN: RESULTS CONTENT */}
        <div className="flex-1 min-w-0 w-full space-y-4">

          {/* Results Summary Header & Date Navigator */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {filteredTrains.length} {filteredTrains.length === 1 ? 'Train' : 'Trains'} Available
                </h2>
                <span className="text-xs font-bold text-slate-500">
                  {extractName(source)} ({extractCode(source)}) &rarr; {extractName(destination)} ({extractCode(destination)})
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs font-medium text-slate-500">
                <span className="font-bold text-slate-700">{formatDateFriendly(selectedSearchDate)}</span>
                <span>•</span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[10px] border border-slate-200">
                  {getQuotaName(quota)} ({quota})
                </span>
                {disabilityConcession && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">
                    Divyang Concession
                  </span>
                )}
                {railwayPassConcession && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">
                    Pass Concession
                  </span>
                )}
              </div>
            </div>

            {/* Date Navigation & Mobile Filters Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {/* Mobile Filters Toggle Button */}
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              >
                <Filter className="h-3.5 w-3.5 text-primary-600" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-primary-600 text-white rounded-full text-[9px] px-1.5 py-0.2">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleNavigateDay(-1)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs active:scale-95 transition disabled:opacity-50"
                  title="Search Previous Day"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous Day</span>
                </button>
                <button
                  onClick={() => handleNavigateDay(1)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs active:scale-95 transition disabled:opacity-50"
                  title="Search Next Day"
                >
                  <span>Next Day</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Train Search Input & Sort Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Search train by name or number (e.g. Rajdhani, 12977, Matsyagandha)..."
                value={trainSearchQuery}
                onChange={(e) => setTrainSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary-500 transition"
              />
              {trainSearchQuery && (
                <button 
                  onClick={() => setTrainSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Sort by:</span>
              <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/60 text-xs">
                {[
                  { id: 'price', label: 'Ticket Fare' },
                  { id: 'duration', label: 'Travel Time' },
                  { id: 'departure', label: 'Departure' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSortBy(opt.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition ${
                      sortBy === opt.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trains Loop */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm animate-pulse">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-5 bg-slate-200 rounded w-24"></div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 py-3 bg-slate-50 rounded-xl p-3">
                    <div className="col-span-4 space-y-2">
                      <div className="h-6 bg-slate-200 rounded w-20"></div>
                      <div className="h-3.5 bg-slate-200 rounded w-28"></div>
                    </div>
                    <div className="col-span-4 flex flex-col items-center justify-center space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-16"></div>
                      <div className="h-1 bg-slate-200 rounded w-full"></div>
                    </div>
                    <div className="col-span-4 space-y-2 flex flex-col items-end">
                      <div className="h-6 bg-slate-200 rounded w-20"></div>
                      <div className="h-3.5 bg-slate-200 rounded w-28"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                    {[1, 2, 3, 4].map(c => (
                      <div key={c} className="h-20 bg-slate-100 rounded-xl"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTrains.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-400 shadow-xs">
              <Train className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="font-bold text-slate-800 text-base mb-1">No trains found for the selected route and date.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No trains are operating between {extractName(source) || source || 'source'} and {extractName(destination) || destination || 'destination'} on {formatDateFriendly(selectedSearchDate)}. Try navigating to a nearby date or clearing filters.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => handleNavigateDay(-1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                >
                  &larr; Previous Day
                </button>
                <button
                  onClick={() => handleNavigateDay(1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                >
                  Next Day &rarr;
                </button>
              </div>
            </div>
          ) : (
            filteredTrains.map((t) => {
              const rawClasses = t.available_classes || t.classes || [];
              const unSortedList = (Array.isArray(rawClasses) && rawClasses.length > 0)
                ? rawClasses.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
                : getDefaultClassesForTrain(t.train_name, t.train_type);

              // Authoritative centralized railway order: SL -> 3E -> 3A -> 2A -> CC -> EC -> 2S -> GEN -> 1A
              const classesList = sortClassCodes(unSortedList);

              // Active expanded class for this train (initially null: NOT expanded until clicked)
              const activeExpandedClass = expandedClassByTrain[t.id] || null;

              // Active selected class for this train
              const activeClass = activeExpandedClass || selectedClassByTrain[t.id] || null;

              // Active selected date for this train
              const activeDate = selectedDateByTrain[t.id] || t.departure_date || selectedSearchDate;

              // Date-wise availability boxes for this active expanded class (ONLY when expanded!)
              const cachedDates = activeExpandedClass ? (classDatesCache[`${t.id}_${activeExpandedClass}`] || classDatesCache[`${t.train_number}_${activeExpandedClass}`]) : null;
              const dateBoxes = (cachedDates && cachedDates.length > 0)
                ? cachedDates
                : (activeExpandedClass ? getDateWiseBoxes(t, activeExpandedClass) : []);
              const activeDateBox = dateBoxes.find(b => (b.journey_date || b.date) === activeDate) || dateBoxes[0] || {};
              const activeFare = activeDateBox.fare || (activeExpandedClass ? getClassFare(t.route?.fare_multiplier, activeExpandedClass, t.route?.base_fare, t) : (t.base_fare || 500));
              const activeStatus = activeDateBox.status || activeDateBox.statusCode || 'AVAILABLE';

              const runsOn = getRunsOnDays(t.frequency || t.running_days || t.route?.frequency, t.operating_days);

              return (
                <div key={t.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3 hover:shadow-md transition-shadow overflow-hidden">
                  
                  {/* Train Header */}
                  <div className="p-4 pb-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div>
                        <div>
                          <h4 className="font-black text-slate-900 text-base sm:text-lg uppercase leading-tight">
                            {t.train_name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="font-mono text-slate-700 font-extrabold text-sm tracking-wide">
                              {t.train_number}
                            </span>
                            <span className="text-slate-300 font-mono">&bull;</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
                              {t.train_type || 'Superfast'}
                            </span>
                            <button
                              onClick={() => setActiveScheduleTrain(t)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 ml-1 cursor-pointer"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Train Schedule</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right Header Badges */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => handlePredictDelay(t.train_number)}
                          disabled={predictingNumber === t.train_number}
                          className="inline-flex items-center space-x-1 text-[9px] font-extrabold text-indigo-700 hover:text-indigo-850 border border-indigo-150 rounded-lg px-2.5 py-1 bg-indigo-50/60 hover:bg-indigo-50 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-600 animate-spin-slow" />
                          <span>{predictingNumber === t.train_number ? 'Predicting...' : 'AI Delay Risk'}</span>
                        </button>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          safeText(t.status) === 'on_time' || safeText(t.status) === 'RUNNING' || !t.status
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : safeText(t.status) === 'delayed' || safeText(t.status) === 'DELAYED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {safeText(t.live_status?.status) || safeText(t.status, 'On Time')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Departure - Duration - Arrival Timetable Bar */}
                  <div className="bg-slate-50 border-y border-slate-100 p-4">
                    <div className="grid grid-cols-12 items-center gap-2 text-center">
                      {/* Departure */}
                      <div className="col-span-4 text-left">
                        <span className="font-mono text-2xl font-black text-slate-900 block leading-tight">
                          {(t.departure_time || t.route?.departure_time || '00:00').slice(0, 5)}
                        </span>
                        <span className="text-xs font-black text-slate-800 uppercase block mt-0.5">
                          {((t.from_station === 'admin' || t.from_station_code === 'UD' || t.source === 'UD') ? 'Udupi' : (t.from_station || extractName(source) || t.route?.source_station_name))} ({extractCode(t.from_station_code || t.source || source)})
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                          {t.departure_date_formatted || formatDateFriendly(t.departure_date || selectedSearchDate)}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="col-span-4 flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold text-slate-600 font-mono">
                          {t.journey_duration || (t.duration_minutes ? `${Math.floor(t.duration_minutes / 60)}h ${t.duration_minutes % 60}m` : 'Scheduled')}
                        </span>
                        <div className="relative flex w-full items-center justify-center py-1">
                          <div className="h-0.5 w-full bg-slate-300 border-t border-dashed border-slate-400"></div>
                          <div className="absolute h-2 w-2 rounded-full bg-primary-600 border border-white"></div>
                        </div>
                        <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">
                          {t.distance_km ? `${t.distance_km} km` : 'Segment Route'}
                        </span>
                      </div>

                      {/* Arrival */}
                      <div className="col-span-4 text-right">
                        <span className="font-mono text-2xl font-black text-slate-900 block leading-tight">
                          {(t.arrival_time || t.route?.arrival_time || '00:00').slice(0, 5)}
                          {t.day_offset > 0 && (
                            <span className="text-xs font-bold text-amber-700 ml-1.5 align-middle">
                              (+{t.day_offset} day)
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-black text-slate-800 uppercase block mt-0.5">
                          {((t.to_station === 'admin' || t.to_station_code === 'UD' || t.destination === 'UD') ? 'Udupi' : (t.to_station || extractName(destination) || t.route?.destination_station_name))} ({extractCode(t.to_station_code || t.destination || destination)})
                        </span>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {t.arrival_date_formatted || formatDateFriendly(t.arrival_date || t.departure_date || selectedSearchDate)}
                          </span>
                          {t.day_offset > 0 && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-amber-200">
                              +{t.day_offset} day
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Route Stops Preview */}
                  {Array.isArray(t.stops) && t.stops.length > 0 && (
                    <div className="px-4 py-1.5 flex items-center justify-between text-[10.5px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                        <span className="font-bold text-slate-400">Stops:</span>
                        {t.stops.slice(0, 7).map((stop, sIdx) => (
                          <React.Fragment key={sIdx}>
                            {sIdx > 0 && <span className="text-slate-300">&rarr;</span>}
                            <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                              stop.code === t.from_station_code || stop.code === t.to_station_code
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {extractCode(stop.code || stop.station_code || stop.stationCode)}
                            </span>
                          </React.Fragment>
                        ))}
                        {t.stops.length > 7 && (
                          <span className="text-slate-400 text-[9px]">+{t.stops.length - 7} more</span>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveScheduleTrain(t)}
                        className="text-primary-700 hover:text-primary-900 font-bold hover:underline shrink-0 ml-2"
                      >
                        View Full Schedule
                      </button>
                    </div>
                  )}

                  {/* Compact Horizontal Travel Classes Row */}
                  <div className="px-4 pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-primary-600" />
                        <span>Travel Classes (Click to view date availability):</span>
                      </span>
                      <span className="text-[10.5px] font-mono font-bold text-slate-400">
                        Quota: <strong className="text-primary-700">{getQuotaName(quota)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                      {classesList.map(clsCode => {
                        const isExpanded = activeExpandedClass === clsCode;
                        const clsFare = getClassFare(t.route?.fare_multiplier, clsCode, t.route?.base_fare, t);
                        const avail = getSeatStatus(t.id, clsCode, quota, t);
                        const isAvail = avail.type === 'AVL' || avail.code?.toUpperCase().includes('AVAILABLE');
                        const isRac = avail.type === 'RAC' || avail.code?.toUpperCase().includes('RAC');
                        const isWl = avail.type === 'WL' || avail.code?.toUpperCase().includes('WL');
                        const humanName = getIndianRailwayClassLabel(clsCode);

                        return (
                          <button
                            key={clsCode}
                            type="button"
                            onClick={() => handleClassClick(t.id, clsCode)}
                            className={`min-w-[125px] sm:min-w-[140px] p-2.5 rounded-xl border text-left transition-all duration-200 shrink-0 select-none relative group flex flex-col justify-between ${
                              isExpanded
                                ? 'border-orange-500 bg-amber-50/80 ring-2 ring-orange-500/20 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-xs font-black leading-tight ${isExpanded ? 'text-orange-950' : 'text-slate-900'}`}>
                                {clsCode}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-orange-600" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                              )}
                            </div>

                            <div className="mt-1 flex items-baseline justify-between w-full">
                              <span className="text-xs font-mono font-black text-slate-800">
                                {formatPrice(clsFare)}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                                isAvail
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isRac
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : isWl
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {avail.code}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[8.5px] font-medium text-slate-400">
                              <span className="truncate">{humanName}</span>
                              {isExpanded && <span className="text-orange-600 font-bold ml-1">Open</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expandable Availability Date Cards Section for Active Class */}
                  {activeExpandedClass && (
                    <div className="mx-4 my-2 p-3 bg-gradient-to-b from-orange-50/40 to-slate-50/70 rounded-xl border border-orange-200/80 shadow-xs transition-all animate-fadeIn">
                      <div className="flex items-center justify-between text-[11px] mb-2 px-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold uppercase text-slate-800 tracking-wide flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-orange-600" />
                            <span>AVAILABLE DATES FOR {getIndianRailwayClassLabel(activeExpandedClass).toUpperCase()} ({activeExpandedClass})</span>
                          </span>
                          {loadingClassDates[`${t.id}_${activeExpandedClass}`] && (
                            <span className="text-[10px] text-orange-600 font-bold animate-pulse">Loading live dates...</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {dateBoxes.length > 3 && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => scrollDateRow(t.id, 'left')}
                                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-0.5 shadow-xs"
                                title="Previous dates"
                              >
                                <ChevronLeft className="h-3 w-3" />
                                <span>Previous</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => scrollDateRow(t.id, 'right')}
                                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-0.5 shadow-xs"
                                title="Next dates"
                              >
                                <span>Next</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleClassClick(t.id, activeExpandedClass)}
                            className="text-[10.5px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-slate-200/50 transition-colors"
                            title="Collapse dates"
                          >
                            <span>Hide Dates</span>
                            <ChevronUp className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {dateBoxes.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-500 font-semibold bg-white rounded-lg border border-slate-200">
                          No operating dates available for {activeExpandedClass} in this period.
                        </div>
                      ) : (
                        <div 
                          ref={el => { if (el) dateScrollContainerRefs.current[t.id] = el; }}
                          className="flex items-stretch gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scroll-smooth"
                        >
                          {dateBoxes.map((box, bIdx) => {
                            const isDateSelected = box.date === activeDate;
                            const isAvail = box.statusType === 'AVAILABLE' || box.status?.toUpperCase().includes('AVAILABLE');
                            const isRac = box.statusType === 'RAC' || box.status?.toUpperCase().includes('RAC');
                            const isWl = box.statusType === 'WL' || box.status?.toUpperCase().includes('WL');
                            const isDepartedOrClosed = !box.isBookable || box.statusType === 'DEPARTED' || box.status?.toUpperCase().includes('DEPARTED') || box.status?.toUpperCase().includes('CLOSED');

                            return (
                              <div
                                key={box.date || bIdx}
                                onClick={() => {
                                  if (isDepartedOrClosed) return;
                                  handleDateCardSelect(t.id, box.date);
                                }}
                                className={`min-w-[130px] sm:min-w-[145px] rounded-xl p-3 border text-left transition-all duration-200 shrink-0 select-none flex flex-col justify-between ${
                                  isDepartedOrClosed
                                    ? 'border-slate-200 bg-slate-100/70 opacity-60 cursor-not-allowed'
                                    : isDateSelected
                                    ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500/20 shadow-sm cursor-pointer hover:border-orange-600'
                                    : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-slate-50/60 hover:shadow-xs cursor-pointer'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-900 block">
                                      {box.dateFormatted || `${box.dayName}, ${box.dayNum} ${box.monthName || ''}`}
                                    </span>
                                    {isDateSelected && (
                                      <span className="flex items-center gap-1 text-[9px] font-extrabold text-orange-700 bg-orange-100/80 px-1.5 py-0.2 rounded-full">
                                        <Check className="h-2.5 w-2.5" />
                                        <span>Selected</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${
                                      isAvail
                                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-300'
                                        : isRac
                                        ? 'text-amber-800 bg-amber-50 border border-amber-300'
                                        : isWl
                                        ? 'text-rose-700 bg-rose-50 border border-rose-300'
                                        : 'text-slate-600 bg-slate-100 border border-slate-300'
                                    }`}>
                                      {box.status}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-xs font-mono font-black text-slate-800">
                                    {formatPrice(box.fare || activeFare)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isDepartedOrClosed}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isDepartedOrClosed) {
                                        handleDateCardBook(t, activeExpandedClass, box);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all shadow-xs ${
                                      isDepartedOrClosed
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-orange-600 hover:bg-orange-700 active:scale-95 text-white'
                                    }`}
                                  >
                                    Book
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Action Strip */}
                  <div className="px-4 py-3 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {activeExpandedClass ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-700">
                            Selected: <strong className="text-primary-700">{getIndianRailwayClassLabel(activeExpandedClass)} ({activeExpandedClass})</strong> for <strong className="text-slate-900">{formatDateFriendly(activeDate)}</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-semibold text-slate-500">
                            Status: <strong className={activeDateBox.statusType === 'AVAILABLE' ? 'text-emerald-600' : activeDateBox.statusType === 'RAC' ? 'text-amber-600' : activeDateBox.statusType === 'WL' ? 'text-rose-600' : 'text-slate-600'}>{activeStatus}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Fare</span>
                            <span className="text-lg font-mono font-black text-slate-900">
                              {formatPrice(activeFare)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleBook(t.id, activeExpandedClass, activeFare, t, activeDate)}
                            className="bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-sm hover:shadow transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                          >
                            <span>Book Now</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between text-xs text-slate-500 py-0.5">
                        <span className="flex items-center gap-1.5">
                          <Info className="h-4 w-4 text-orange-500" />
                          <span>Click on any class button above (e.g. <strong>{classesList.slice(0, 4).join(', ')}</strong>) to view available journey dates.</span>
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">Starts from {formatPrice(getClassFare(t.route?.fare_multiplier, classesList[0], t.route?.base_fare, t))}</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}

        </div>

      </div>
      )}

      {/* MOBILE FILTERS DRAWER */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex justify-start lg:hidden">
          <div className="bg-white w-80 max-w-[85vw] h-full overflow-y-auto p-4 shadow-2xl space-y-4 animate-slide-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary-600" />
                <h3 className="font-extrabold text-sm text-slate-900">Filters</h3>
              </div>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderFiltersSidebar()}
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full bg-primary-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-sm"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* ROUTE SCHEDULE DETAIL MODAL OVERLAY */}
      {activeScheduleTrain && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl space-y-4">
            
            <div className="bg-gradient-to-r from-slate-950 to-primary-950 px-6 py-4.5 text-white flex justify-between items-center border-b border-white/5">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Train className="h-4.5 w-4.5 text-primary-400" />
                  {activeScheduleTrain.train_name} Route Schedule
                </h3>
                <span className="text-[10px] text-slate-400 font-mono font-bold block mt-0.5">Train Number: #{activeScheduleTrain.train_number}</span>
              </div>
              <button 
                onClick={() => setActiveScheduleTrain(null)}
                className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-white transition-all focus:outline-none"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto">
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 text-xs">
                {((activeScheduleTrain.stops && activeScheduleTrain.stops.length > 0)
                  ? activeScheduleTrain.stops.map((node, idx) => ({
                      seq: idx + 1,
                      name: node.name || node.station_name || node.code,
                      code: node.code || node.station_code,
                      arr: node.arrTime ? node.arrTime.slice(0, 5) : (node.arrival_time ? node.arrival_time.slice(0, 5) : (idx === 0 ? '--:--' : '00:00')),
                      dep: node.depTime ? node.depTime.slice(0, 5) : (node.departure_time ? node.departure_time.slice(0, 5) : (idx === activeScheduleTrain.stops.length - 1 ? '--:--' : '00:00')),
                      dist: `${node.distanceFromOriginKm ?? node.distance_from_origin ?? node.distance_km ?? 0} km`,
                      day: node.dateFormatted ? `${node.dateFormatted} (Day ${1 + (node.day_offset || node.dayOffset || 0)})` : (node.day_offset ? `Day ${1 + node.day_offset}` : 'Day 1')
                    }))
                  : getTrainSchedule(activeScheduleTrain.train_number)
                ).map((stop) => (
                  <div key={stop.seq} className="relative pl-6">
                    <span className={`absolute left-[-13.5px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white font-extrabold text-[9px] border-2 border-white shadow-sm font-mono ${
                      stop.code === activeScheduleTrain.from_station_code || stop.code === activeScheduleTrain.to_station_code
                        ? 'bg-emerald-600'
                        : 'bg-primary-900'
                    }`}>
                      {stop.seq}
                    </span>

                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-slate-800 font-extrabold text-xs block">{stop.name} ({stop.code})</strong>
                        <span className="text-[9.5px] text-slate-400 font-bold block mt-0.5">{stop.day || 'Scheduled Stop'}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-slate-700 font-bold block">Arr: {stop.arr} | Dep: {stop.dep}</span>
                        <span className="text-[9px] text-slate-400 font-mono font-bold">Dist: {stop.dist}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500 bg-slate-50 font-bold">
              <span className="flex items-center gap-1.5"><PhoneCall className="h-4 w-4 text-primary-650" /> Running Status Helpline: Dial 139</span>
              <button
                onClick={() => setActiveScheduleTrain(null)}
                className="rounded-xl bg-slate-900 text-white px-5 py-2 text-xs font-bold hover:bg-slate-950 transition shadow-md shadow-slate-900/10"
              >
                Close Schedule
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AI DELAY RISK PREDICTION MODAL */}
      {showDelayModal && predictedDelay && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full overflow-hidden shadow-2xl space-y-4">
            
            <div className="bg-gradient-to-r from-indigo-950 to-purple-950 px-6 py-4.5 text-white flex justify-between items-center border-b border-white/5">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-spin-slow" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">AI Delay Risk Analysis</h3>
                  <span className="text-[10px] text-slate-350 block mt-0.5">Train: #{predictedDelay.train_number} | Travel Date: {predictedDelay.travel_date}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowDelayModal(false)}
                className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-white transition-all focus:outline-none"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-700">
              
              <div className="flex items-center space-x-5 bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="relative h-16 w-16 flex items-center justify-center flex-shrink-0">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-slate-200 fill-transparent" strokeWidth="5" />
                    <circle cx="32" cy="32" r="28" className="stroke-indigo-600 fill-transparent" strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={2 * Math.PI * 28 * (1 - predictedDelay.onTimeProbability / 100)} 
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-extrabold text-indigo-900 font-mono">{predictedDelay.onTimeProbability}%</span>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">On-Time Probability</span>
                  <p className="text-base font-extrabold text-slate-800 leading-tight">
                    {predictedDelay.predictedDelayMinutes === 0 
                      ? 'Likely On Time' 
                      : `Expected delay: ${predictedDelay.predictedDelayMinutes} mins`}
                  </p>
                  <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Confidence score: High (92%)</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-600">AI Risk Assessment:</span>
                <span className={`rounded-xl px-3 py-1 font-extrabold text-[10px] uppercase tracking-wider ${
                  predictedDelay.riskLevel === 'High' 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                    : predictedDelay.riskLevel === 'Medium'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {predictedDelay.riskLevel} Risk
                </span>
              </div>

              <div className="space-y-1.5 bg-slate-50 border border-slate-100/70 p-4 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">AI Model Reasoning</span>
                <p className="text-[11px] font-semibold text-slate-600 leading-relaxed font-sans">
                  {predictedDelay.reasoning}
                </p>
              </div>

            </div>

            <div className="px-6 py-4.5 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => setShowDelayModal(false)}
                className="rounded-xl bg-slate-900 text-white px-5 py-2.5 font-bold hover:bg-slate-950 transition text-xs shadow-md"
              >
                Acknowledge
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SearchTrainResults;
