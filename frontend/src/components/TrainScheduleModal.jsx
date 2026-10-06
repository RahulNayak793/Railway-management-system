import React, { useState, useEffect, useMemo } from 'react';
import { Train, Clock, Plus, Trash2, X, AlertCircle, CheckCircle2, Calendar, ChevronRight, Check, Info } from 'lucide-react';
import { MASTER_CLASSES, getDefaultClassesForTrain, sortClassCodes } from '../utils/trainClasses';
import { indianStations } from '../utils/stationsData';

export const DAYS_LIST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TRAIN_TYPE_OPTIONS = [
  'Rajdhani',
  'Shatabdi',
  'Vande Bharat',
  'Duronto',
  'Humsafar',
  'Superfast',
  'Express',
  'Special / Other'
];

export const SCHEDULE_CLASSES = [
  { code: 'SL', name: 'Sleeper', description: 'Sleeper Class (Non-AC)' },
  { code: '3E', name: 'AC 3-Tier Economy', description: 'AC 3-Tier Economy Sleeper' },
  { code: '3A', name: 'AC 3-Tier', description: 'AC 3-Tier Sleeper' },
  { code: '2A', name: 'AC 2-Tier', description: 'AC 2-Tier Sleeper' },
  { code: 'CC', name: 'AC Chair Car', description: 'AC Chair Car' },
  { code: 'EC', name: 'Executive Chair Car', description: 'Executive Chair Car' },
  { code: '2S', name: 'Second Sitting', description: 'Second Sitting (Reserved Non-AC)' },
  { code: 'GEN', name: 'General / Unreserved', description: 'General / Unreserved Class' },
  { code: '1A', name: 'First AC', description: 'AC 1st Class Coupe/Cabin' }
];

export const normalizeTrainType = (typeStr) => {
  if (!typeStr) return 'Superfast';
  const clean = String(typeStr).trim();
  if (TRAIN_TYPE_OPTIONS.includes(clean)) return clean;
  const lower = clean.toLowerCase();
  if (lower.includes('rajdhani')) return 'Rajdhani';
  if (lower.includes('shatabdi')) return 'Shatabdi';
  if (lower.includes('vande bharat')) return 'Vande Bharat';
  if (lower.includes('duronto')) return 'Duronto';
  if (lower.includes('humsafar')) return 'Humsafar';
  if (lower.includes('superfast') || lower.includes('tejas') || lower.includes('sampark kranti')) return 'Superfast';
  if (lower.includes('express') || lower.includes('mail')) return 'Express';
  return 'Special / Other';
};

const convertTo24Hour = (timeStr) => {
  if (!timeStr) return '12:00:00';
  const cleanStr = String(timeStr).trim();
  if (!cleanStr.toUpperCase().includes('AM') && !cleanStr.toUpperCase().includes('PM')) {
    return cleanStr.length === 5 ? `${cleanStr}:00` : cleanStr;
  }
  const parts = cleanStr.split(/\s+/);
  const timePart = parts[0];
  const ampm = parts[1] ? parts[1].toUpperCase() : 'AM';
  let [hours, minutes] = timePart.split(':');
  let h = parseInt(hours, 10);
  if (h === 12) h = 0;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minutes || '00'}:00`;
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
};

const addDaysToDate = (dateStr, days) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d + days);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
};

const calculateDurationInfo = (depTime, arrTime) => {
  if (!depTime || !arrTime) return { durationText: '--', isOvernight: false, dayOffset: 0 };
  const [dh, dm] = depTime.slice(0, 5).split(':').map(Number);
  const [ah, am] = arrTime.slice(0, 5).split(':').map(Number);
  if (isNaN(dh) || isNaN(dm) || isNaN(ah) || isNaN(am)) return { durationText: '--', isOvernight: false, dayOffset: 0 };

  const depMinutes = dh * 60 + dm;
  const arrMinutes = ah * 60 + am;

  let dayOffset = 0;
  let duration = arrMinutes - depMinutes;
  if (arrMinutes < depMinutes) {
    dayOffset = 1;
    duration = (1440 - depMinutes) + arrMinutes;
  } else if (arrMinutes === depMinutes) {
    duration = 1440;
  }

  const h = Math.floor(duration / 60);
  const m = duration % 60;
  const durationText = `${h}h ${m > 0 ? `${m}m` : '00m'}`.trim();
  return { durationText, isOvernight: dayOffset > 0, dayOffset };
};

const TrainScheduleModal = ({
  isOpen,
  onClose,
  onSubmit,
  editingTrain = null,
  title = null,
  subtitle = null,
  showFareField = false,
  existingTrains = []
}) => {
  const todayIst = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }, []);

  // Train Identification
  const [trainNo, setTrainNo] = useState('');
  const [trainName, setTrainName] = useState('');
  const [trainType, setTrainType] = useState('Superfast');
  const [status, setStatus] = useState('on_time');
  const [description, setDescription] = useState('');
  const [baseFare, setBaseFare] = useState(350);

  // Terminals & Core Timings
  const [source, setSource] = useState('NDLS');
  const [dest, setDest] = useState('MMCT');
  const [depTime, setDepTime] = useState('18:30');
  const [arrTime, setArrTime] = useState('06:15');

  // Date-Specific Train vs Recurring Fleet
  const [journeyDate, setJourneyDate] = useState(todayIst);
  const [isDateSpecific, setIsDateSpecific] = useState(true);

  // Realistic Frequency Selector (Preserved for existing recurring trains)
  const [frequencyType, setFrequencyType] = useState('Daily');
  const [weeklyDay, setWeeklyDay] = useState('Wed');
  const [selectedDays, setSelectedDays] = useState(['Mon', 'Wed', 'Fri']);
  const [specificDates, setSpecificDates] = useState([]);
  const [newSpecificDate, setNewSpecificDate] = useState('');

  // Mandatory Service Validity Period
  const [serviceStartDate, setServiceStartDate] = useState(todayIst);
  const [serviceEndDate, setServiceEndDate] = useState(addDaysToDate(todayIst, 90));

  // Intermediate Stops
  const [stopsInput, setStopsInput] = useState([]);

  // Travel Classes & Food
  const [selectedClasses, setSelectedClasses] = useState(['SL', '3A', '2A', '2S', '1A']);
  const [foodAvailable, setFoodAvailable] = useState('No');
  const [foodType, setFoodType] = useState('Both Vegetarian & Non-Vegetarian');
  const [vegFoodPrice, setVegFoodPrice] = useState(150);
  const [nonVegFoodPrice, setNonVegFoodPrice] = useState(200);
  const [classCatering, setClassCatering] = useState({});

  // UI state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getStationName = (code) => {
    if (!code) return '';
    const clean = String(code).trim().toUpperCase();
    if (clean === 'ADMIN') return '';
    const match = clean.match(/\(([^)]+)\)/);
    const stationCode = match ? match[1] : clean;
    const st = indianStations.find(s => s.code.toUpperCase() === stationCode);
    return st ? st.name : clean;
  };

  // Duration & Overnight Info
  const durationInfo = useMemo(() => {
    return calculateDurationInfo(depTime, arrTime);
  }, [depTime, arrTime]);

  // Upcoming Runs Preview
  const upcomingRuns = useMemo(() => {
    if (isDateSpecific) {
      if (!journeyDate) return [];
      const [y, m, d] = journeyDate.split('-').map(Number);
      const curDate = new Date(y, m - 1, d);
      const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = shortDays[curDate.getDay()];
      const arrDateObj = new Date(curDate);
      if (durationInfo.dayOffset > 0) {
        arrDateObj.setDate(arrDateObj.getDate() + durationInfo.dayOffset);
      }
      const arrDateStr = `${arrDateObj.getFullYear()}-${String(arrDateObj.getMonth() + 1).padStart(2, '0')}-${String(arrDateObj.getDate()).padStart(2, '0')}`;
      return [{
        departureDate: journeyDate,
        departureTime: depTime,
        arrivalDate: arrDateStr,
        arrivalTime: arrTime,
        dayName
      }];
    }

    if (!serviceStartDate || !serviceEndDate) return [];
    const searchStart = serviceStartDate > todayIst ? serviceStartDate : todayIst;
    if (searchStart > serviceEndDate) return [];

    const runs = [];
    const [sy, sm, sd] = searchStart.split('-').map(Number);
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 180 && runs.length < 5; i++) {
      const curDate = new Date(sy, sm - 1, sd + i);
      const yyyy = curDate.getFullYear();
      const mm = String(curDate.getMonth() + 1).padStart(2, '0');
      const dd = String(curDate.getDate()).padStart(2, '0');
      const curDateStr = `${yyyy}-${mm}-${dd}`;
      if (curDateStr > serviceEndDate) break;

      const dayName = shortDays[curDate.getDay()];

      let runsThisDate = false;
      if (frequencyType === 'Daily') {
        runsThisDate = true;
      } else if (frequencyType === 'Weekly') {
        runsThisDate = dayName.toLowerCase().startsWith(weeklyDay.toLowerCase().slice(0, 3));
      } else if (frequencyType === 'Selected Days') {
        runsThisDate = selectedDays.some(d => d.toLowerCase().startsWith(dayName.toLowerCase().slice(0, 3)));
      } else if (frequencyType === 'Specific Dates') {
        runsThisDate = specificDates.includes(curDateStr);
      }

      if (runsThisDate) {
        const arrDateObj = new Date(curDate);
        if (durationInfo.dayOffset > 0) {
          arrDateObj.setDate(arrDateObj.getDate() + durationInfo.dayOffset);
        }
        const arrDateStr = `${arrDateObj.getFullYear()}-${String(arrDateObj.getMonth() + 1).padStart(2, '0')}-${String(arrDateObj.getDate()).padStart(2, '0')}`;
        runs.push({
          departureDate: curDateStr,
          departureTime: depTime,
          arrivalDate: arrDateStr,
          arrivalTime: arrTime,
          dayName
        });
      }
    }
    return runs;
  }, [isDateSpecific, journeyDate, serviceStartDate, serviceEndDate, todayIst, frequencyType, weeklyDay, selectedDays, specificDates, depTime, arrTime, durationInfo.dayOffset]);

  // Live Service Pattern Summary Text
  const servicePatternSummary = useMemo(() => {
    if (isDateSpecific) {
      return `Single Journey Service (${formatDateDisplay(journeyDate)})`;
    }
    if (frequencyType === 'Daily') return 'Daily (Mon - Sun, All 7 Days)';
    if (frequencyType === 'Weekly') return `Weekly (Every ${weeklyDay})`;
    if (frequencyType === 'Selected Days') {
      return selectedDays.length > 0 ? `Selected Days: ${selectedDays.join(', ')}` : 'No days selected';
    }
    if (frequencyType === 'Specific Dates') {
      return specificDates.length > 0 ? `${specificDates.length} Specific Operating Date(s)` : 'No operating dates picked';
    }
    return 'Daily';
  }, [isDateSpecific, journeyDate, frequencyType, weeklyDay, selectedDays, specificDates]);

  // Route Station Chain Sequence for preview
  const routeChain = useMemo(() => {
    const chain = [source.trim().toUpperCase() || 'ORIGIN'];
    stopsInput.forEach(s => {
      const code = String(s.stationCode || s.station || '').trim().toUpperCase();
      if (code && !chain.includes(code)) chain.push(code);
    });
    const destCode = dest.trim().toUpperCase() || 'DEST';
    if (!chain.includes(destCode)) chain.push(destCode);
    return chain;
  }, [source, dest, stopsInput]);

  // Initialize or Populate Form on Open
  useEffect(() => {
    if (editingTrain) {
      const isDateSpec = editingTrain.is_date_specific === true || 
                         editingTrain.is_date_specific === 'true' || 
                         Boolean(editingTrain.journey_date);
      setIsDateSpecific(isDateSpec);

      const currentJourneyDate = editingTrain.journey_date || 
                                 (editingTrain.specific_service_dates && editingTrain.specific_service_dates[0]) || 
                                 editingTrain.service_start_date || 
                                 todayIst;
      setJourneyDate(currentJourneyDate);

      setTrainNo(editingTrain.trainNo || editingTrain.train_number || '');
      setTrainName(editingTrain.trainName || editingTrain.train_name || '');
      setTrainType(normalizeTrainType(editingTrain.train_type || editingTrain.trainType));
      setStatus(editingTrain.status || 'on_time');
      setSource(editingTrain.source || editingTrain.source_station_code || 'NDLS');
      setDest(editingTrain.dest || editingTrain.destination || editingTrain.destination_station_code || 'MMCT');
      setDepTime(editingTrain.depTime || (editingTrain.departure_time ? editingTrain.departure_time.slice(0, 5) : '18:30'));
      setArrTime(editingTrain.arrTime || (editingTrain.arrival_time ? editingTrain.arrival_time.slice(0, 5) : '06:15'));

      // Service Calendar Fields
      const startDt = isDateSpec ? currentJourneyDate : (editingTrain.service_start_date || editingTrain.startDate || todayIst);
      setServiceStartDate(startDt);
      const endDt = isDateSpec ? currentJourneyDate : (editingTrain.service_end_date || editingTrain.endDate || addDaysToDate(startDt, 90));
      setServiceEndDate(endDt);

      // Frequency Type
      let freqT = editingTrain.frequency_type || 'Daily';
      const rawFreqStr = String(editingTrain.frequency || editingTrain.running_days || '').toLowerCase();
      if (!editingTrain.frequency_type) {
        if (rawFreqStr.includes('specific')) freqT = 'Specific Dates';
        else if (rawFreqStr.includes('weekly') && !rawFreqStr.includes('bi')) freqT = 'Weekly';
        else if (rawFreqStr.includes('selected') || rawFreqStr.includes('bi-weekly') || rawFreqStr.includes(',')) freqT = 'Selected Days';
        else freqT = 'Daily';
      }
      setFrequencyType(isDateSpec ? 'Specific Dates' : freqT);

      // Operating Days
      const opDays = editingTrain.operating_days || editingTrain.weekly_days || [];
      if (Array.isArray(opDays) && opDays.length > 0) {
        setSelectedDays(opDays);
        setWeeklyDay(opDays[0] || 'Wed');
      } else {
        setSelectedDays(['Mon', 'Wed', 'Fri']);
        setWeeklyDay('Wed');
      }

      // Specific Service Dates
      const specDts = editingTrain.specific_service_dates || editingTrain.specific_dates || [];
      if (isDateSpec) {
        setSpecificDates([currentJourneyDate]);
      } else if (Array.isArray(specDts) && specDts.length > 0) {
        setSpecificDates(specDts);
      } else {
        setSpecificDates([]);
      }

      setDescription(editingTrain.description || '');
      setBaseFare(editingTrain.baseFare || 350);

      // Stops
      const rawStops = editingTrain.stops || (editingTrain.route && editingTrain.route.stops) || [];
      const cleanSrc = String(editingTrain.source || editingTrain.source_station_code || 'NDLS').trim().toUpperCase();
      const cleanDst = String(editingTrain.dest || editingTrain.destination || editingTrain.destination_station_code || 'MMCT').trim().toUpperCase();

      const formatted = rawStops
        .filter(s => {
          const code = String(s.stationCode || s.station || s.code || s.station_code || s.station_name || '').trim().toUpperCase();
          return code && code !== cleanSrc && code !== cleanDst && code !== 'ADMIN';
        })
        .map(s => {
          const code = String(s.stationCode || s.station || s.code || s.station_code || s.station_name || '').trim().toUpperCase();
          const arr = String(s.arrTime || s.arrival_time || s.arr || '').slice(0, 5);
          const dep = String(s.depTime || s.departure_time || s.dep || '').slice(0, 5);
          return {
            stationCode: code,
            station: code,
            arrTime: arr,
            arrival_time: arr.length === 5 ? `${arr}:00` : arr,
            depTime: dep,
            departure_time: dep.length === 5 ? `${dep}:00` : dep,
            haltMinutes: s.haltMinutes || s.halt_minutes || '2',
            distanceFromOriginKm: s.distanceFromOriginKm || s.distance_km || ''
          };
        });
      setStopsInput(formatted);

      // Classes
      const rawCls = editingTrain.available_classes || editingTrain.classes || [];
      const initCls = Array.isArray(rawCls) && rawCls.length > 0 
        ? rawCls.map(c => typeof c === 'object' ? c.code : String(c).trim().toUpperCase())
        : getDefaultClassesForTrain(editingTrain.trainName || editingTrain.train_name, editingTrain.trainType || editingTrain.train_type);
      setSelectedClasses(initCls);

      // Food / Catering
      const isFoodAvail = editingTrain.food_available === true || (editingTrain.food_available !== false && (Number(editingTrain.vegetarian_food_price) > 0 || Number(editingTrain.non_vegetarian_food_price) > 0));
      setFoodAvailable(isFoodAvail ? 'Yes' : 'No');

      let rawFt = editingTrain.food_type || 'Both';
      if (rawFt.toLowerCase().includes('both')) rawFt = 'Both Vegetarian & Non-Vegetarian';
      else if (rawFt.toLowerCase().includes('non')) rawFt = 'Non-Vegetarian';
      else if (rawFt.toLowerCase().includes('veg')) rawFt = 'Vegetarian';
      setFoodType(rawFt);

      setVegFoodPrice(editingTrain.vegetarian_food_price !== undefined && editingTrain.vegetarian_food_price !== null ? editingTrain.vegetarian_food_price : 150);
      setNonVegFoodPrice(editingTrain.non_vegetarian_food_price !== undefined && editingTrain.non_vegetarian_food_price !== null ? editingTrain.non_vegetarian_food_price : 200);
      setClassCatering(editingTrain.class_catering || {});
    } else {
      // New Train Defaults - Strictly Date-Specific
      setIsDateSpecific(true);
      setJourneyDate(todayIst);
      setTrainNo('');
      setTrainName('');
      setTrainType('Superfast');
      setStatus('on_time');
      setSource('NDLS');
      setDest('MMCT');
      setDepTime('18:30');
      setArrTime('06:15');
      setFrequencyType('Specific Dates');
      setWeeklyDay('Wed');
      setSelectedDays(['Mon', 'Wed', 'Fri']);
      setSpecificDates([todayIst]);
      setNewSpecificDate('');
      setServiceStartDate(todayIst);
      setServiceEndDate(todayIst);
      setDescription('');
      setBaseFare(350);
      setStopsInput([]);
      setSelectedClasses(['SL', '3A', '2A', '2S', '1A']);
      setFoodAvailable('No');
      setFoodType('Both Vegetarian & Non-Vegetarian');
      setVegFoodPrice(150);
      setNonVegFoodPrice(200);
      setClassCatering({});
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [editingTrain, isOpen, todayIst]);

  if (!isOpen) return null;

  const handleAddSpecificDate = () => {
    if (!newSpecificDate) return;
    if (newSpecificDate < serviceStartDate || newSpecificDate > serviceEndDate) {
      setErrorMsg(`Operating date must fall between Service Start Date (${serviceStartDate}) and Service End Date (${serviceEndDate}).`);
      return;
    }
    if (specificDates.includes(newSpecificDate)) {
      setErrorMsg('This date is already in the list.');
      return;
    }
    setSpecificDates(prev => [...prev, newSpecificDate].sort());
    setNewSpecificDate('');
    setErrorMsg('');
  };

  const handleRemoveSpecificDate = (dt) => {
    setSpecificDates(prev => prev.filter(d => d !== dt));
  };

  const handleAddStopInput = () => {
    setStopsInput(prev => [
      ...prev,
      {
        stationCode: '',
        station: '',
        arrTime: '',
        arrival_time: '',
        depTime: '',
        departure_time: '',
        haltMinutes: '2',
        distanceFromOriginKm: ''
      }
    ]);
  };

  const handleRemoveStopInput = (index) => {
    setStopsInput(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleStopChange = (index, field, value) => {
    setStopsInput(prev => prev.map((s, idx) => {
      if (idx !== index) return s;
      const updated = { ...s, [field]: value };
      if (field === 'stationCode') {
        const code = value.toUpperCase();
        updated.stationCode = code;
        updated.station = code;
      } else if (field === 'arrTime') {
        updated.arrTime = value;
        updated.arrival_time = value.length === 5 ? `${value}:00` : value;
      } else if (field === 'depTime') {
        updated.depTime = value;
        updated.departure_time = value.length === 5 ? `${value}:00` : value;
      }
      return updated;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanSource = source.trim().toUpperCase();
    const cleanDest = dest.trim().toUpperCase();

    if (!trainNo.trim() || !trainName.trim() || !cleanSource || !cleanDest) {
      setErrorMsg('Please fill out all required train schedule fields (Train Number, Name, Terminals).');
      return;
    }

    // Client-side duplicate train number check
    if (!editingTrain && existingTrains && Array.isArray(existingTrains)) {
      const cleanNo = trainNo.trim();
      const duplicate = existingTrains.find(t => String(t.trainNo || t.train_number || '').trim() === cleanNo);
      if (duplicate) {
        setErrorMsg(`Train number ${cleanNo} already exists in fleet schedule.`);
        return;
      }
    } else if (editingTrain && existingTrains && Array.isArray(existingTrains)) {
      const cleanNo = trainNo.trim();
      const currentNo = String(editingTrain.trainNo || editingTrain.train_number || '').trim();
      if (cleanNo !== currentNo) {
        const duplicate = existingTrains.find(t => {
          const tId = t.id || t.trainId;
          const editId = editingTrain.id || editingTrain.trainId;
          return tId !== editId && String(t.trainNo || t.train_number || '').trim() === cleanNo;
        });
        if (duplicate) {
          setErrorMsg(`Train number ${cleanNo} is already assigned to another train.`);
          return;
        }
      }
    }
    if (cleanSource === 'ADMIN' || cleanDest === 'ADMIN') {
      setErrorMsg('"ADMIN" is not a valid station code.');
      return;
    }
    if (cleanSource === cleanDest) {
      setErrorMsg('Source and Destination terminals cannot be the same station.');
      return;
    }

    if (!depTime || !arrTime) {
      setErrorMsg('Departure and Arrival times are mandatory.');
      return;
    }

    // Journey Date / Validity Range validation
    let finalOperatingDays = [];
    let finalFrequencyString = frequencyType;

    if (isDateSpecific) {
      if (!journeyDate) {
        setErrorMsg('Please select a valid Journey Date for this train.');
        return;
      }
      if (!editingTrain && journeyDate < todayIst) {
        setErrorMsg('Journey Date cannot be in the past.');
        return;
      }
      finalOperatingDays = [];
      finalFrequencyString = formatDateDisplay(journeyDate);
    } else {
      if (!serviceStartDate || !serviceEndDate) {
        setErrorMsg('Service Start Date and Service End Date are mandatory.');
        return;
      }
      if (serviceEndDate < serviceStartDate) {
        setErrorMsg('Service End Date cannot be earlier than Service Start Date.');
        return;
      }
      if (!editingTrain && serviceStartDate < todayIst) {
        setErrorMsg('Service Start Date cannot be in the past.');
        return;
      }

      if (frequencyType === 'Daily') {
        finalOperatingDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        finalFrequencyString = 'Daily';
      } else if (frequencyType === 'Weekly') {
        if (!weeklyDay) {
          setErrorMsg('Please select a running day of the week for Weekly frequency.');
          return;
        }
        finalOperatingDays = [weeklyDay];
        finalFrequencyString = `Weekly (${weeklyDay})`;
      } else if (frequencyType === 'Selected Days') {
        if (selectedDays.length === 0) {
          setErrorMsg('Please select at least one operating day for Selected Days frequency.');
          return;
        }
        finalOperatingDays = selectedDays;
        finalFrequencyString = `Selected Days (${selectedDays.join(', ')})`;
      } else if (frequencyType === 'Specific Dates') {
        if (specificDates.length === 0) {
          setErrorMsg('Please add at least one specific operating date.');
          return;
        }
        finalOperatingDays = [];
        finalFrequencyString = `Specific Dates (${specificDates.length} dates)`;
      }
    }

    // Validate intermediate route stops
    const validStops = [];
    const seenStations = new Set();

    for (let i = 0; i < stopsInput.length; i++) {
      const st = stopsInput[i];
      const stCode = String(st.stationCode || st.station || '').trim().toUpperCase();
      const arr = String(st.arrTime || st.arrival_time || '').trim();
      const dep = String(st.depTime || st.departure_time || '').trim();

      if (!stCode && !arr && !dep) continue;

      if (!stCode) {
        setErrorMsg(`Stop #${i + 1}: Station code is required.`);
        return;
      }
      if (stCode === 'ADMIN') {
        setErrorMsg(`Stop #${i + 1}: "ADMIN" is not a valid station code.`);
        return;
      }
      if (stCode === cleanSource || stCode === cleanDest) {
        continue;
      }
      if (seenStations.has(stCode)) {
        setErrorMsg(`Stop #${i + 1} (${stCode}): Duplicate station in route.`);
        return;
      }
      seenStations.add(stCode);

      if (!arr || !dep) {
        setErrorMsg(`Stop #${i + 1} (${stCode}): Both arrival and departure times are required.`);
        return;
      }

      validStops.push({
        stationCode: stCode,
        station: stCode,
        arrTime: arr.slice(0, 5),
        arrival_time: arr.length === 5 ? `${arr}:00` : arr,
        depTime: dep.slice(0, 5),
        departure_time: dep.length === 5 ? `${dep}:00` : dep,
        haltMinutes: st.haltMinutes || '2',
        distanceFromOriginKm: st.distanceFromOriginKm || ''
      });
    }

    if (selectedClasses.length === 0) {
      setErrorMsg('At least one travel class must be selected for the train.');
      return;
    }

    if (foodAvailable === 'Yes') {
      if (foodType.includes('Vegetarian') || foodType.includes('Both')) {
        if (vegFoodPrice === '' || isNaN(vegFoodPrice) || Number(vegFoodPrice) < 0) {
          setErrorMsg('Vegetarian food price must be a valid non-negative number.');
          return;
        }
      }
      if (foodType.includes('Non') || foodType.includes('Both')) {
        if (nonVegFoodPrice === '' || isNaN(nonVegFoodPrice) || Number(nonVegFoodPrice) < 0) {
          setErrorMsg('Non-Vegetarian food price must be a valid non-negative number.');
          return;
        }
      }
    }

    const classCateringPayload = {};
    selectedClasses.forEach(cls => {
      const isDefaultInc = cls === '1A' || trainType === 'Vande Bharat';
      const cfg = classCatering[cls] || {};
      const isFoodAvail = cfg.food_available !== undefined ? Boolean(cfg.food_available) : (foodAvailable === 'Yes' || isDefaultInc);
      const defaultPayMode = isDefaultInc ? 'Included in Ticket' : 'Paid Separately';
      classCateringPayload[cls] = {
        food_available: isFoodAvail,
        payment_mode: cfg.payment_mode || defaultPayMode,
        food_type: cfg.food_type || foodType || 'Both',
        vegetarian_food_price: Number(cfg.vegetarian_food_price !== undefined ? cfg.vegetarian_food_price : vegFoodPrice),
        non_vegetarian_food_price: Number(cfg.non_vegetarian_food_price !== undefined ? cfg.non_vegetarian_food_price : nonVegFoodPrice)
      };
    });

    setSaving(true);

    const payload = {
      train_number: trainNo.trim(),
      train_name: trainName.trim(),
      train_type: trainType.trim(),
      status: status || 'on_time',
      source: cleanSource,
      destination: cleanDest,
      departure_time: convertTo24Hour(depTime),
      arrival_time: convertTo24Hour(arrTime),
      is_date_specific: isDateSpecific,
      journey_date: isDateSpecific ? journeyDate : null,
      frequency_type: isDateSpecific ? 'Specific Dates' : frequencyType,
      frequency: finalFrequencyString,
      service_start_date: isDateSpecific ? journeyDate : serviceStartDate,
      service_end_date: isDateSpecific ? journeyDate : serviceEndDate,
      operating_days: isDateSpecific ? [] : finalOperatingDays,
      specific_service_dates: isDateSpecific ? [journeyDate] : (frequencyType === 'Specific Dates' ? specificDates : []),
      service_status: editingTrain?.service_status || 'ACTIVE',
      day_offset: durationInfo.dayOffset,
      available_classes: sortClassCodes(selectedClasses),
      classes: sortClassCodes(selectedClasses),
      food_available: foodAvailable === 'Yes',
      food_type: foodType,
      vegetarian_food_price: foodAvailable === 'Yes' && (foodType.includes('Vegetarian') || foodType.includes('Both')) ? Number(vegFoodPrice) : 0,
      non_vegetarian_food_price: foodAvailable === 'Yes' && (foodType.includes('Non') || foodType.includes('Both')) ? Number(nonVegFoodPrice) : 0,
      class_catering: classCateringPayload,
      catering_payment_mode: 'Paid Separately',
      distance_km: 500,
      fare_multiplier: parseFloat(baseFare) / 350 || 1.0,
      description: description.trim() || null,
      stops: validStops
    };

    try {
      await onSubmit(payload);
      setSuccessMsg('Train service schedule saved successfully.');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save train schedule.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = title || (editingTrain ? `Edit Schedule (Train #${editingTrain.trainNo || editingTrain.train_number})` : 'Add New Train Route & Stops');
  const modalSubtitle = subtitle || (editingTrain 
    ? (isDateSpecific ? 'Modify railway route, journey date, timetable and travel classes.' : 'Modify railway route, timetable and travel classes.')
    : 'Configure railway route, timetable, travel classes, and journey date.');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-3 sm:pt-5 md:pt-6 pb-3 sm:pb-5 md:pb-6 px-3 sm:px-4 md:px-6 bg-slate-900/60 backdrop-blur-xs overflow-hidden">
      
      {/* Autocomplete Datalist */}
      <datalist id="train-modal-station-list">
        {indianStations.map(st => (
          <option key={st.code} value={st.code}>{st.name} ({st.code})</option>
        ))}
      </datalist>

      {/* 3-Part Modal Container: Header (fixed) - Body (scrollable) - Footer (fixed) */}
      <form 
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2.5rem)] md:max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden animate-scale-in"
      >
        
        {/* 1. FIXED HEADER */}
        <div className="flex-shrink-0 px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Train className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">{modalTitle}</h3>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">{modalSubtitle}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inline Alerts */}
        {errorMsg && (
          <div className="flex-shrink-0 mx-6 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2 font-bold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex-shrink-0 mx-6 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-slate-800 text-xs">
          
          {/* SECTION 1: TRAIN IDENTIFICATION */}
          <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                1. Train Identification
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Core Master Specs</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Train Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 12951"
                  value={trainNo}
                  onChange={(e) => setTrainNo(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Train Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai Rajdhani Express"
                  value={trainName}
                  onChange={(e) => setTrainName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Train Type *</label>
                <select
                  value={trainType}
                  onChange={(e) => setTrainType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {TRAIN_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Operational Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="on_time">On Time</option>
                  <option value="delayed">Delayed</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>

            {showFareField && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Base Standard Fare (₹)</label>
                  <input
                    type="number"
                    min="50"
                    step="10"
                    value={baseFare}
                    onChange={(e) => setBaseFare(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Operational Remarks</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Regular express service via Kota"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: TERMINALS & TIMETABLE */}
          <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                2. Terminals & Timetable
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Origin & Destination Timings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Origin Terminal */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Origin Terminal *</label>
                <input
                  type="text"
                  list="train-modal-station-list"
                  placeholder="e.g. NDLS"
                  value={source}
                  onChange={(e) => setSource(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-blue-500"
                  required
                />
                {source && (
                  <span className="block text-[10px] text-blue-700 font-bold truncate">
                    📍 {getStationName(source)}
                  </span>
                )}
              </div>

              {/* Destination Terminal */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Destination Terminal *</label>
                <input
                  type="text"
                  list="train-modal-station-list"
                  placeholder="e.g. MMCT"
                  value={dest}
                  onChange={(e) => setDest(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-blue-500"
                  required
                />
                {dest && (
                  <span className="block text-[10px] text-blue-700 font-bold truncate">
                    🏁 {getStationName(dest)}
                  </span>
                )}
              </div>

              {/* Departure Time */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Departure Time *</label>
                <input
                  type="time"
                  value={depTime}
                  onChange={(e) => setDepTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>

              {/* Arrival Time */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Arrival Time *</label>
                <input
                  type="time"
                  value={arrTime}
                  onChange={(e) => setArrTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>
            </div>

            {/* Compact Journey Duration & Overnight Summary */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Estimated Journey Duration: <strong className="font-mono text-slate-900">{durationInfo.durationText}</strong></span>
              </div>
              <span className="text-slate-300">•</span>
              {durationInfo.isOvernight ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                  <span>🌙 Overnight Journey • Arrival next day (+1 day)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <span>☀️ Same Day Service</span>
                </span>
              )}
            </div>
          </div>

          {/* SECTION 3: JOURNEY DATE (Date-Specific Train) vs SERVICE CALENDAR (Existing Recurring Fleet) */}
          {(isDateSpecific || !editingTrain) ? (
            <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>3. Train Journey Date</span>
                </h4>
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Exact Date Service
                </span>
              </div>

              {/* Single Journey Date Selection Card */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block">
                      Journey Date *
                    </label>
                    <p className="text-[10px] text-slate-400">
                      This train runs exclusively on the assigned journey date and is searchable only for this date.
                    </p>
                  </div>

                  {/* Quick Journey Date Chips */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setJourneyDate(todayIst)}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition cursor-pointer ${
                        journeyDate === todayIst 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setJourneyDate(addDaysToDate(todayIst, 1))}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition cursor-pointer ${
                        journeyDate === addDaysToDate(todayIst, 1) 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => setJourneyDate(addDaysToDate(todayIst, 2))}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition cursor-pointer ${
                        journeyDate === addDaysToDate(todayIst, 2) 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      +2 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setJourneyDate(addDaysToDate(todayIst, 7))}
                      className={`text-[10px] font-bold px-2 py-1 rounded border transition cursor-pointer ${
                        journeyDate === addDaysToDate(todayIst, 7) 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      +1 Week
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Select Journey Date</label>
                    <input
                      type="date"
                      min={editingTrain ? undefined : todayIst}
                      value={journeyDate}
                      onChange={(e) => setJourneyDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] font-medium text-blue-600 block">Assigned Service Date</span>
                      <strong className="text-xs font-mono font-black text-blue-950">
                        {formatDateDisplay(journeyDate) || 'Select a date'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start space-x-2">
                  <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Date-Specific Train:</strong> This train is assigned to exactly one journey date. Passenger search and bookings are restricted to this date only.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>3. Service Calendar & Operating Frequency</span>
                </h4>
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {frequencyType}
                </span>
              </div>

              {/* Frequency Options Selector Pills (Existing Trains) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['Daily', 'Weekly', 'Selected Days', 'Specific Dates'].map((opt) => {
                  const isSelected = frequencyType === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFrequencyType(opt)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-black transition border cursor-pointer text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Frequency Detail controls */}
              {frequencyType === 'Daily' && (
                <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Runs Mon - Sun (All 7 Days of the Week)</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Daily Service
                  </span>
                </div>
              )}

              {frequencyType === 'Weekly' && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-600 uppercase block">
                    Runs every [Weekday] *
                  </label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_LIST.map((day) => {
                      const isSelected = weeklyDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setWeeklyDay(day)}
                          className={`py-1 rounded text-xs font-black transition cursor-pointer text-center ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-blue-50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {frequencyType === 'Selected Days' && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">
                      Operating Days of the Week *
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 hover:bg-blue-50 cursor-pointer"
                      >
                        Mon-Fri
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDays(['Sat', 'Sun'])}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 hover:bg-blue-50 cursor-pointer"
                      >
                        Sat-Sun
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([...DAYS_LIST])}
                        className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 hover:bg-blue-50 cursor-pointer"
                      >
                        All 7
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_LIST.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDays(prev => prev.filter(d => d !== day));
                            } else {
                              setSelectedDays(prev => [...prev, day]);
                            }
                          }}
                          className={`py-1 rounded text-xs font-black transition cursor-pointer text-center ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {frequencyType === 'Specific Dates' && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase block">
                    Add Operating Dates (Within Service Period) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      min={serviceStartDate}
                      max={serviceEndDate}
                      value={newSpecificDate}
                      onChange={(e) => setNewSpecificDate(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddSpecificDate}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {specificDates.length === 0 ? (
                      <span className="text-[10px] text-slate-400 italic">No specific dates added yet. Pick a date above.</span>
                    ) : (
                      specificDates.map((dt) => (
                        <span key={dt} className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-[11px] font-bold font-mono">
                          <span>{formatDateDisplay(dt)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecificDate(dt)}
                            className="hover:text-rose-600 text-blue-500 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Service Validity Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Service Start Date *</label>
                  <input
                    type="date"
                    min={editingTrain ? undefined : todayIst}
                    value={serviceStartDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setServiceStartDate(newStart);
                      if (serviceEndDate && serviceEndDate < newStart) {
                        setServiceEndDate(addDaysToDate(newStart, 90));
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Service End Date *</label>
                    <div className="flex items-center space-x-1">
                      {[30, 90, 120, 180].map(days => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setServiceEndDate(addDaysToDate(serviceStartDate, days))}
                          className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                        >
                          +{days}D
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="date"
                    min={serviceStartDate}
                    value={serviceEndDate}
                    onChange={(e) => setServiceEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Live Service Calendar Summary Bar */}
              <div className="bg-white border border-blue-200 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-blue-900">{servicePatternSummary}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600 font-semibold">
                    Valid: <strong>{formatDateDisplay(serviceStartDate) || '--'}</strong> to <strong>{formatDateDisplay(serviceEndDate) || '--'}</strong>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  STATUS: ACTIVE
                </span>
              </div>
            </div>
          )}

          {/* SECTION 4: INTERMEDIATE ROUTE STOPS (Timeline Layout) */}
          <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  4. Intermediate Stops ({stopsInput.length})
                </h4>
                <p className="text-[10px] text-slate-500">Maintains chronological arrival and departure halts before destination.</p>
              </div>
              <button
                type="button"
                onClick={handleAddStopInput}
                className="text-[10px] font-black text-blue-700 hover:text-blue-800 flex items-center space-x-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs hover:bg-blue-50"
              >
                <Plus className="h-3 w-3" />
                <span>Add Stop</span>
              </button>
            </div>

            {/* Route Sequence Chain */}
            <div className="flex items-center space-x-1 overflow-x-auto py-1 px-2 bg-white rounded-lg border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
              {routeChain.map((stCode, idx) => (
                <React.Fragment key={idx}>
                  <span className={`px-1.5 py-0.5 rounded ${idx === 0 || idx === routeChain.length - 1 ? 'bg-blue-600 text-white font-black' : 'bg-slate-100 text-slate-800'}`}>
                    {stCode}
                  </span>
                  {idx < routeChain.length - 1 && <span className="text-slate-400">➔</span>}
                </React.Fragment>
              ))}
            </div>

            {stopsInput.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                Direct non-stop service between {source} and {dest}. Click "Add Stop" to add intermediate halts.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {stopsInput.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    <span className="font-mono text-slate-400 font-bold text-[10px] w-4">{idx + 1}.</span>
                    <div className="w-28">
                      <input
                        type="text"
                        list="train-modal-station-list"
                        placeholder="Station Code"
                        value={st.stationCode || ''}
                        onChange={(e) => handleStopChange(idx, 'stationCode', e.target.value.toUpperCase())}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-blue-500"
                        required
                      />
                      {st.stationCode && (
                        <span className="text-[9px] text-slate-500 font-bold truncate block max-w-[110px]">
                          {getStationName(st.stationCode)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="time"
                        value={st.arrTime || ''}
                        onChange={(e) => handleStopChange(idx, 'arrTime', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                        title="Arrival Time"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="time"
                        value={st.depTime || ''}
                        onChange={(e) => handleStopChange(idx, 'depTime', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                        title="Departure Time"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStopInput(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer self-center"
                      title="Delete Stop"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: TRAVEL CLASSES & CATERING */}
          <div className="space-y-2.5 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                5. Travel Classes & Onboard Catering
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Available Accommodations</span>
            </div>

            {/* Travel Classes Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {SCHEDULE_CLASSES.map((cls) => {
                const isSelected = selectedClasses.includes(cls.code);
                return (
                  <button
                    key={cls.code}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedClasses(prev => prev.filter(c => c !== cls.code));
                      } else {
                        setSelectedClasses(prev => [...prev, cls.code]);
                      }
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="truncate pr-1">
                      <span className="font-black font-mono text-xs block text-slate-900">{cls.code}</span>
                      <span className="text-[9px] font-semibold text-slate-500 block truncate">{cls.name}</span>
                    </div>
                    <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center text-[9px] shrink-0 ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white font-black' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && '✓'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Compact Catering Config Bar */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-slate-700">🍱 Onboard Catering:</span>
                <label className="inline-flex items-center space-x-1 cursor-pointer">
                  <input
                    type="radio"
                    name="foodAvailable"
                    value="Yes"
                    checked={foodAvailable === 'Yes'}
                    onChange={() => setFoodAvailable('Yes')}
                    className="text-blue-600"
                  />
                  <span className="font-bold text-slate-800">Available</span>
                </label>
                <label className="inline-flex items-center space-x-1 cursor-pointer">
                  <input
                    type="radio"
                    name="foodAvailable"
                    value="No"
                    checked={foodAvailable === 'No'}
                    onChange={() => setFoodAvailable('No')}
                    className="text-blue-600"
                  />
                  <span className="font-bold text-slate-800">No Food</span>
                </label>
              </div>

              {foodAvailable === 'Yes' && (
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 font-bold">Veg: ₹{vegFoodPrice}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] text-slate-500 font-bold">Non-Veg: ₹{nonVegFoodPrice}</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 6: SCHEDULE PREVIEW */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Schedule Preview</span>
              </span>
              <span className="font-mono text-[10px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                #{trainNo || '00000'} • {trainName || 'Train Name'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-slate-700 bg-white p-2.5 rounded-lg border border-blue-100">
              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Route & Timetable</span>
                <span className="font-extrabold text-slate-800 font-mono">
                  {source} ({depTime}) ➔ {dest} ({arrTime}){durationInfo.isOvernight && ' (+1)'}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Operating Pattern</span>
                <span className="font-bold text-slate-800">{servicePatternSummary}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-bold text-slate-400 uppercase block">
                  {(isDateSpecific || !editingTrain) ? 'Journey Run' : 'Next 3 Services'}
                </span>
                <span className="font-bold text-blue-800 font-mono">
                  {(isDateSpecific || !editingTrain)
                    ? (formatDateDisplay(journeyDate) || 'No date selected')
                    : (upcomingRuns.slice(0, 3).map(r => formatDateDisplay(r.departureDate)).join(' • ') || 'No upcoming runs')}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 3. FIXED FOOTER */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center space-x-1.5"
          >
            {saving ? (
              <span>Saving Train Schedule...</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>{editingTrain ? 'Save Schedule Changes' : 'Save Train Schedule'}</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};

export default TrainScheduleModal;
