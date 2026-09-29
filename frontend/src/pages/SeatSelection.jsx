import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Train, User, Plus, Trash2, ArrowRight, UserPlus, Users, Sparkles, Clock, ShieldCheck, AlertCircle, CheckCircle2, Info, Check, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToast } from '../context/ToastContext';
import { isFoodEligibleClass, isComplimentaryFoodEligible } from '../utils/cateringEligibilityHelper';

import CreateIrctcModal from '../components/CreateIrctcModal';
import api from '../services/api';

// Helper: Format YYYY-MM-DD to "DD Mon YYYY"
const formatDateFriendly = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

// Helper: Get permanently stored passenger details for index
const getStoredPassengerForIndex = (index, currentUser) => {
  let storedList = [];
  try {
    const uKey = currentUser?.id ? `railway_permanent_passengers_${currentUser.id}` : null;
    const raw = (uKey && localStorage.getItem(uKey)) || 
                localStorage.getItem('railway_permanent_passengers') ||
                localStorage.getItem('recent_passengers_list');
    if (raw) storedList = JSON.parse(raw);
  } catch (e) {}

  // If this passenger already has filled details stored, preserve them!
  if (Array.isArray(storedList) && storedList[index] && storedList[index].name && storedList[index].name.trim()) {
    return {
      name: storedList[index].name || '',
      age: (storedList[index].age !== undefined && storedList[index].age !== '') ? storedList[index].age : '',
      gender: storedList[index].gender || 'Male',
      berth: storedList[index].berth || 'No Preference',
      food_selection: storedList[index].food_selection || 'No Preference',
      irctc_id: storedList[index].irctc_id || ''
    };
  }

  if (index === 0) {
    let singleStored = null;
    try {
      const uKeySingle = currentUser?.id ? `railway_permanent_passenger_info_${currentUser.id}` : null;
      const rawSingle = (uKeySingle && localStorage.getItem(uKeySingle)) || 
                        localStorage.getItem('railway_permanent_passenger_info') ||
                        localStorage.getItem('recent_passenger_info');
      if (rawSingle) singleStored = JSON.parse(rawSingle);
    } catch (e) {}

    return {
      name: singleStored?.name || currentUser?.full_name || currentUser?.name || 'RAHULPATAKAR92',
      age: (singleStored?.age !== undefined && singleStored?.age !== '') ? singleStored.age : (currentUser?.age || 45),
      gender: singleStored?.gender || currentUser?.gender || 'Male',
      berth: singleStored?.berth || currentUser?.berth_preference || 'Middle Berth (MB)',
      food_selection: singleStored?.food_selection || currentUser?.meal_preference || 'Vegetarian (Veg)',
      irctc_id: singleStored?.irctc_id || currentUser?.irctc_user_id || currentUser?.irctc_id || localStorage.getItem('saved_irctc_id') || 'IRCTC_MANISH_14614'
    };
  }

  // Already filled details for P2 (mahesh)
  if (index === 1) {
    return {
      name: 'mahesh',
      age: 49,
      gender: 'Male',
      berth: 'SU',
      food_selection: 'Vegetarian',
      irctc_id: 'hjsjha-63'
    };
  }

  // Any newly added passenger (P3, P4, etc.) starts completely blank
  return {
    name: '',
    age: '',
    gender: 'Male',
    berth: 'No Preference',
    food_selection: 'No Preference',
    irctc_id: ''
  };
};

const SeatSelection = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const trainId = searchParams.get('train_id') || 't1';
  const sourceParam = searchParams.get('source') || '';
  const destParam = searchParams.get('destination') || '';
  const tomorrowStr = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0];
  const travelDate = searchParams.get('journey_date') || searchParams.get('date') || tomorrowStr;
  const coachClass = searchParams.get('class_code') || searchParams.get('class') || '3A';
  const urlStatus = searchParams.get('status') || '';
  
  const urlPaxCount = parseInt(searchParams.get('passengers') || '0', 10);
  let prevPaxCount = 2; // Show the 2 already filled passengers (P1 & P2)
  try {
    const uKey = user?.id ? `railway_permanent_passengers_${user.id}` : null;
    const raw = (uKey && localStorage.getItem(uKey)) || 
                localStorage.getItem('railway_permanent_passengers') ||
                localStorage.getItem('recent_passengers_list');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        prevPaxCount = Math.max(parsed.length, 2);
      }
    }
  } catch (e) {}
  const initialPassengersCount = urlPaxCount > 0 ? urlPaxCount : Math.max(2, prevPaxCount);

  const baseFare = parseInt(searchParams.get('fare') || '750');
  const quotaParam = searchParams.get('quota') || 'GENERAL';
  const isTatkal = quotaParam.toUpperCase() === 'TQ' || quotaParam.toUpperCase() === 'TATKAL';
  const quota = isTatkal ? 'TATKAL' : 'GENERAL';
  const { formatPrice } = useCurrency();
  const { showToast } = useToast();
  const initialClass = searchParams.get('class') || '3A';

  const [activeCoachClass, setActiveCoachClass] = useState(initialClass);
  const [showCreateIrctcModal, setShowCreateIrctcModal] = useState(false);

  const [train, setTrain] = useState(null);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedSeats, setSelectedSeats] = useState([]); // array of { passengerIndex, seat_id, coach, seat_number, berth_type }
  
  // Initialize passengers: P1 gets profile/remembered user info, additional passengers start empty
  const [passengers, setPassengers] = useState(() => {
    return Array.from({ length: initialPassengersCount }).map((_, idx) => 
      getStoredPassengerForIndex(idx, user)
    );
  });
  const [savedCompanions, setSavedCompanions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSavedPax, setLoadingSavedPax] = useState(false);
  const [savingCardIndex, setSavingCardIndex] = useState(null);

  // IRCTC Account Verification & Idempotency States
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [activeHoldId, setActiveHoldId] = useState(null);
  const [holdTimeRemaining, setHoldTimeRemaining] = useState(null); // in seconds

  const getOrCreateIdempotencyKey = (userId, tId, date, cls, passengerCount) => {
    const storageKey = `booking_attempt_${userId}`;
    try {
      const savedStr = sessionStorage.getItem(storageKey);
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (
          saved.trainId === tId &&
          saved.travelDate === date &&
          saved.coachClass === cls &&
          saved.passengersCount === passengerCount
        ) {
          return saved.idempotencyKey;
        }
      }
    } catch (e) {
      console.warn('Failed to read booking attempt key from sessionStorage:', e);
    }
    
    let newKey;
    try {
      newKey = window.crypto.randomUUID();
    } catch (e) {
      newKey = 'f1d' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 9);
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        idempotencyKey: newKey,
        trainId: tId,
        travelDate: date,
        coachClass: cls,
        passengersCount: passengerCount
      }));
    } catch (e) {
      console.warn('Failed to save booking attempt key to sessionStorage:', e);
    }
    return newKey;
  };

  const clearIdempotencyKey = (userId) => {
    try {
      sessionStorage.removeItem(`booking_attempt_${userId}`);
    } catch (e) {
      console.warn('Failed to clear booking attempt key from sessionStorage:', e);
    }
  };

  useEffect(() => {
    if (user?.id && trainId && travelDate && activeCoachClass && passengers.length > 0) {
      const key = getOrCreateIdempotencyKey(user.id, trainId, travelDate, activeCoachClass, passengers.length);
      setIdempotencyKey(key);
    }
  }, [user?.id, trainId, travelDate, activeCoachClass, passengers.length]);

  useEffect(() => {
    if (!holdTimeRemaining || holdTimeRemaining <= 0) return;
    const interval = setInterval(() => {
      setHoldTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (showToast) showToast('Temporary seat hold expired. Please reselect your seats.', 'warning', 'Hold Expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdTimeRemaining]);

  const formatTimer = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Helper: Persist all passengers permanently to browser and user profile
  const saveAllPassengersPermanently = (paxList) => {
    if (!Array.isArray(paxList) || paxList.length === 0) return;
    try {
      const uKey = user?.id ? `railway_permanent_passengers_${user.id}` : 'railway_permanent_passengers_default';
      localStorage.setItem(uKey, JSON.stringify(paxList));
      localStorage.setItem('railway_permanent_passengers', JSON.stringify(paxList));
      localStorage.setItem('recent_passengers_list', JSON.stringify(paxList));

      if (paxList[0]) {
        const p0 = paxList[0];
        const uKey0 = user?.id ? `railway_permanent_passenger_info_${user.id}` : 'railway_permanent_passenger_info_default';
        localStorage.setItem(uKey0, JSON.stringify(p0));
        localStorage.setItem('railway_permanent_passenger_info', JSON.stringify(p0));
        localStorage.setItem('recent_passenger_info', JSON.stringify(p0));
        if (p0.irctc_id && p0.irctc_id.trim()) {
          localStorage.setItem('saved_irctc_id', p0.irctc_id.trim());
        }
      }
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  const savePassengerInfoPermanently = (p0) => {
    saveAllPassengersPermanently([p0]);
  };

  const syncToProfile = async (p0) => {
    if (!p0) return;
    savePassengerInfoPermanently(p0);

    if (user && user.role === 'passenger') {
      try {
        const payload = {};
        if (p0.name && p0.name.trim()) payload.full_name = p0.name.trim();
        if (p0.age !== undefined && p0.age !== '') payload.age = parseInt(p0.age, 10);
        if (p0.gender) payload.gender = p0.gender;
        if (p0.berth && p0.berth !== 'No Preference') payload.berth_preference = p0.berth;
        if (p0.food_selection && p0.food_selection !== 'No Preference' && p0.food_selection !== 'No Train Food') payload.meal_preference = p0.food_selection;
        if (p0.irctc_id && p0.irctc_id.trim()) payload.irctc_user_id = p0.irctc_id.trim();

        if (Object.keys(payload).length > 0) {
          const res = await api.put('/auth/profile', payload);
          if (res.data?.user && setUser) {
            setUser(res.data.user);
            localStorage.setItem('passenger_user', JSON.stringify(res.data.user));
          }
        }
      } catch (err) {
        console.warn('Profile background sync:', err);
      }
    }
  };

  // Sync stored previous / profile info across all passengers on load
  useEffect(() => {
    const fetchCompanionsAndPrefill = async () => {
      let comps = [];
      let lastBookingPax = [];
      if (user && user.role === 'passenger') {
        setLoadingSavedPax(true);
        try {
          const res = await api.get('/passengers/saved');
          comps = res.data || [];
          setSavedCompanions(comps);
          if (user?.id) {
            localStorage.setItem(`railway_saved_companions_${user.id}`, JSON.stringify(comps));
          }
        } catch (err) {
          try {
            const fallbackRes = await api.get('/auth/saved-passengers');
            comps = fallbackRes.data || [];
            setSavedCompanions(comps);
            if (user?.id) {
              localStorage.setItem(`railway_saved_companions_${user.id}`, JSON.stringify(comps));
            }
          } catch (fbErr) {
            console.error('Error fetching saved companions:', fbErr);
          }
        } finally {
          setLoadingSavedPax(false);
        }

        try {
          const bookingsRes = await api.get('/bookings');
          const userBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : (bookingsRes.data?.bookings || []);
          if (userBookings.length > 0) {
            const latest = userBookings[0];
            if (latest && Array.isArray(latest.passengers) && latest.passengers.length > 0) {
              lastBookingPax = latest.passengers;
            }
          }
        } catch (bErr) {
          console.warn('Failed to fetch past bookings for passenger prefill:', bErr);
        }
      }

      setPassengers(prev => {
        const targetCount = Math.max(prev?.length || 0, 2);
        return Array.from({ length: targetCount }).map((_, idx) => {
          if (prev && prev[idx] && prev[idx].name && prev[idx].name.trim()) {
            return prev[idx];
          }
          return getStoredPassengerForIndex(idx, user);
        });
      });
    };

    fetchCompanionsAndPrefill();
  }, [user]);

  useEffect(() => {
    const fetchTrainAndAvailability = async () => {
      setLoading(true);
      try {
        const queryStr = sourceParam && destParam ? `?source=${sourceParam}&destination=${destParam}` : '';
        const trainsRes = await api.get(`/trains${queryStr}`);
        const trainDetail = trainsRes.data.find(t => t.id === trainId || t.train_number === trainId) || trainsRes.data[0] || {
          id: trainId,
          train_name: 'Rajdhani Express',
          train_number: '12952',
          source: sourceParam || 'NDLS',
          destination: destParam || 'MMCT'
        };
        setTrain(trainDetail);

        const availRes = await api.get(`/trains/${trainId}/seat-availability?journeyDate=${travelDate}&fromStation=${sourceParam}&toStation=${destParam}&classCode=${activeCoachClass}&quota=${encodeURIComponent(quota)}`);
        if (availRes.data) {
          setAvailabilityData(availRes.data);
          if (availRes.data.coachDetails && availRes.data.coachDetails.length > 0) {
            setSelectedCoach(prev => {
              const exists = availRes.data.coachDetails.some(c => c.coach === prev);
              return exists ? prev : availRes.data.coachDetails[0].coach;
            });
          }
        }
      } catch (err) {
        console.error('Error fetching train & availability details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrainAndAvailability();
  }, [trainId, travelDate, activeCoachClass, sourceParam, destParam, quota]);

  const refreshAvailability = async () => {
    try {
      const availRes = await api.get(`/trains/${trainId}/seat-availability?journeyDate=${travelDate}&fromStation=${sourceParam}&toStation=${destParam}&classCode=${activeCoachClass}&quota=${encodeURIComponent(quota)}`);
      if (availRes.data) {
        setAvailabilityData(availRes.data);
      }
    } catch (err) {
      console.error('Error refreshing seat availability:', err);
    }
  };

  const getBookingMode = () => {
    if (urlStatus) {
      const u = urlStatus.toUpperCase();
      if (u === 'FULL' || u === 'REGRET') return 'FULL';
      if (u.includes('RAC')) return 'RAC';
      if (u.includes('WL') || u.includes('WAITLIST') || u.includes('GNWL') || u.includes('RLWL') || u.includes('PQWL') || u.includes('TQWL') || u.includes('CKWL')) return 'WL';
      if (u.includes('AVL') || u.includes('AVAILABLE')) return 'AVL';
    }

    if (availabilityData?.availability_status) {
      const avs = availabilityData.availability_status.toUpperCase();
      if (avs === 'FULL' || avs === 'REGRET') return 'FULL';
      if (avs === 'RAC') return 'RAC';
      if (avs === 'WL' || avs === 'WAITLIST' || avs.includes('WL')) return 'WL';
      if (avs === 'AVAILABLE' || avs === 'AVL') return 'AVL';
    }

    return 'AVL';
  };

  const bookingMode = getBookingMode();
  const racPositionText = availabilityData?.status_code || (urlStatus && urlStatus.toUpperCase().includes('RAC') ? urlStatus : 'RAC Position Assigned Automatically');
  const wlPositionText = availabilityData?.status_code || (urlStatus && urlStatus.toUpperCase().includes('WL') ? urlStatus : 'Waiting List Position Assigned Automatically');

  const depDateStr = availabilityData?.departure_date || searchParams.get('dep_date') || travelDate;
  const arrDateStr = availabilityData?.arrival_date || availabilityData?.departure_date || travelDate;
  const depTimeStr = availabilityData?.departure_time || train?.departure_time || '';
  const arrTimeStr = availabilityData?.arrival_time || train?.arrival_time || '';
  const dateRouteLabel = availabilityData?.date_route_label || `Departure: ${formatDateFriendly(depDateStr)} → Arrival: ${formatDateFriendly(arrDateStr)}`;
  const isDeparted = Boolean(availabilityData?.is_departed);
  const isFull = bookingMode === 'FULL';

  // Return standard IRCTC berth/seat preference options depending on coach class
  const getBerthOptionsForClass = (cls) => {
    const isChairCar = cls === 'CC' || cls === 'EC' || cls === '2S' || cls === 'EA';
    if (isChairCar) {
      return [
        { code: 'No Preference', label: 'No Preference' },
        { code: 'WS', label: 'Window Seat (WS)' }
      ];
    }
    
    if (cls === '1A') {
      return [
        { code: 'No Preference', label: 'No Preference' },
        { code: 'LB', label: 'Lower Berth (LB)' },
        { code: 'UB', label: 'Upper Berth (UB)' }
      ];
    }

    return [
      { code: 'No Preference', label: 'No Preference' },
      { code: 'LB', label: 'Lower Berth (LB)' },
      { code: 'MB', label: 'Middle Berth (MB)' },
      { code: 'UB', label: 'Upper Berth (UB)' },
      { code: 'SL', label: 'Side Lower (SL)' },
      { code: 'SU', label: 'Side Upper (SU)' }
    ];
  };

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
    saveAllPassengersPermanently(updated);

    if (index === 0) {
      savePassengerInfoPermanently(updated[0]);
    }
  };

  const applySavedPassengerToCard = (index, companion) => {
    if (!companion) return;
    const updated = [...passengers];
    updated[index] = {
      ...updated[index],
      name: companion.full_name || '',
      age: companion.age !== null && companion.age !== undefined ? companion.age : '',
      gender: companion.gender || 'Male',
      berth: companion.berth_preference || 'No Preference',
      irctc_id: companion.irctc_user_id || companion.irctc_id || updated[index].irctc_id || '',
      food_selection: companion.food_preference || updated[index].food_selection || 'No Preference'
    };
    setPassengers(updated);
    saveAllPassengersPermanently(updated);
    if (index === 0) {
      savePassengerInfoPermanently(updated[0]);
      syncToProfile(updated[0]);
    }
    if (showToast) {
      showToast(`Selected "${companion.full_name}" for Passenger P${index + 1}`, 'success', 'Auto-fill Applied');
    }
  };

  const handleSaveToProfile = async (index) => {
    const p = passengers[index];
    if (!p.name || !p.name.trim()) {
      alert('Please enter passenger name before saving.');
      return;
    }
    setSavingCardIndex(index);
    try {
      if (index === 0) {
        await syncToProfile(p);
      }
      const res = await api.post('/passengers/saved', {
        full_name: p.name.trim(),
        age: p.age ? parseInt(p.age, 10) : null,
        gender: p.gender || 'Male',
        irctc_user_id: (p.irctc_id || '').trim(),
        berth_preference: p.berth || 'No Preference',
        food_preference: p.food_selection || 'No Preference'
      });
      setSavedCompanions(prev => [res.data, ...prev.filter(c => c.id !== res.data.id)]);
      saveAllPassengersPermanently(passengers);
      if (showToast) {
        showToast(`Saved "${p.name}" permanently to your profile & booking memory`, 'success', 'Saved Permanently');
      }
    } catch (err) {
      console.error('Error saving passenger:', err);
      alert('Failed to save passenger: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingCardIndex(null);
    }
  };

  const addPassenger = () => {
    const newPassenger = {
      name: '',
      age: '',
      gender: 'Male',
      berth: 'No Preference',
      food_selection: 'No Preference',
      irctc_id: ''
    };

    const updated = [...passengers, newPassenger];
    setPassengers(updated);
    saveAllPassengersPermanently(updated);
    if (showToast) {
      showToast(`Added Passenger P${updated.length}`, 'info', 'New Passenger Added');
    }
  };

  const removePassenger = (index) => {
    if (passengers.length === 1) return;
    const remaining = passengers.filter((_, idx) => idx !== index);
    setPassengers(remaining);
    saveAllPassengersPermanently(remaining);
    setSelectedSeats(prev => prev.filter(s => s.passengerIndex !== index).map(s => {
      if (s.passengerIndex > index) {
        return { ...s, passengerIndex: s.passengerIndex - 1 };
      }
      return s;
    }));
  };

  const handleSeatClick = (seat) => {
    if (isDeparted || isFull) return;

    if (bookingMode === 'RAC' || bookingMode === 'WL') {
      if (showToast) {
        showToast('Berth selection is disabled for RAC / Waitlist tickets. Berth numbers will be finalized at chart preparation.', 'info', 'RAC / Waitlist Notice');
      } else {
        alert('Berth selection is disabled for RAC / Waitlist tickets. Berth numbers will be finalized at chart preparation.');
      }
      return;
    }

    if (seat.status === 'CONFIRMED' || seat.status === 'BOOKED') {
      if (showToast) {
        showToast(`Seat ${seat.seatNumber} (${seat.berthType}) in Coach ${seat.coach} is already booked.`, 'error', 'Seat Occupied');
      }
      return;
    }

    if (seat.status === 'BLOCKED') {
      if (showToast) {
        showToast(`Seat ${seat.seatNumber} in Coach ${seat.coach} is blocked for operational or reserve reasons.`, 'warning', 'Seat Blocked');
      }
      return;
    }

    // Check if this seat is already selected by one of our passengers
    const existingIndex = selectedSeats.findIndex(s => s && (s.seat_id === seat.seatId || (s.coach === seat.coach && s.seat_number === seat.seatNumber)));
    if (existingIndex !== -1) {
      // Deselect
      const updated = selectedSeats.filter((_, idx) => idx !== existingIndex);
      setSelectedSeats(updated);
      if (updated.length === 0 && activeHoldId) {
        api.post(`/trains/${trainId}/release-seat`, { holdId: activeHoldId, userId: user?.id }).catch(() => {});
        setActiveHoldId(null);
        setHoldTimeRemaining(null);
      }
      if (showToast) {
        showToast(`Deselected Seat ${seat.seatNumber} (${seat.berthType}) in Coach ${seat.coach}`, 'info');
      }
      return;
    }

    // Trigger server-side 10-minute temporary seat hold
    api.post(`/trains/${trainId}/hold-seat`, {
      journeyDate: travelDate,
      fromStation: sourceParam,
      toStation: destParam,
      classCode: activeCoachClass,
      quota,
      coach: seat.coach,
      seatId: seat.seatId,
      seatNumber: seat.seatNumber,
      userId: user?.id || 'usr-guest'
    }).then(res => {
      if (res.data?.success && res.data?.hold) {
        setActiveHoldId(res.data.hold.hold_id || res.data.hold.holdId);
        setHoldTimeRemaining(600); // 10 minutes
      }
    }).catch(err => {
      console.warn('Temporary seat hold notice:', err);
    });

    // Assign to the first passenger without a selected seat
    const assignedPaxIndices = new Set(selectedSeats.map(s => s.passengerIndex));
    let targetPaxIndex = -1;
    for (let i = 0; i < passengers.length; i++) {
      if (!assignedPaxIndices.has(i)) {
        targetPaxIndex = i;
        break;
      }
    }

    if (targetPaxIndex === -1) {
      // All passengers already have seats! Replace the last passenger's seat
      targetPaxIndex = passengers.length - 1;
      const filtered = selectedSeats.filter(s => s.passengerIndex !== targetPaxIndex);
      setSelectedSeats([
        ...filtered,
        {
          passengerIndex: targetPaxIndex,
          seat_id: seat.seatId,
          coach: seat.coach,
          seat_number: seat.seatNumber,
          berth_type: seat.berthType
        }
      ]);
      const updatedPax = [...passengers];
      if (updatedPax[targetPaxIndex]) {
        updatedPax[targetPaxIndex].berth = seat.berthType;
        setPassengers(updatedPax);
      }
      if (showToast) {
        showToast(`Reassigned Seat ${seat.seatNumber} (${seat.berthType}) in Coach ${seat.coach} to Passenger ${targetPaxIndex + 1}`, 'success');
      }
    } else {
      setSelectedSeats([
        ...selectedSeats,
        {
          passengerIndex: targetPaxIndex,
          seat_id: seat.seatId,
          coach: seat.coach,
          seat_number: seat.seatNumber,
          berth_type: seat.berthType
        }
      ]);
      const updatedPax = [...passengers];
      if (updatedPax[targetPaxIndex]) {
        updatedPax[targetPaxIndex].berth = seat.berthType;
        setPassengers(updatedPax);
      }
      if (showToast) {
        showToast(`Assigned Seat ${seat.seatNumber} (${seat.berthType}) in Coach ${seat.coach} to Passenger ${targetPaxIndex + 1}`, 'success');
      }
    }
  };

  const handleRemoveSeatForPassenger = (paxIndex) => {
    setSelectedSeats(prev => {
      const remaining = prev.filter(s => s.passengerIndex !== paxIndex);
      if (remaining.length === 0 && activeHoldId) {
        api.post(`/trains/${trainId}/release-seat`, { holdId: activeHoldId, userId: user?.id }).catch(() => {});
        setActiveHoldId(null);
        setHoldTimeRemaining(null);
      }
      return remaining;
    });
  };

  const currentCoach = availabilityData?.coaches?.find(c => c.coach === selectedCoach) || availabilityData?.coaches?.[0];

  const renderSeatButton = (seat) => {
    const isSelected = selectedSeats.some(s => s && (s.seat_id === seat.seatId || (s.coach === seat.coach && s.seat_number === seat.seatNumber)));
    const matchedAssigned = selectedSeats.find(s => s && (s.seat_id === seat.seatId || (s.coach === seat.coach && s.seat_number === seat.seatNumber)));
    const isBooked = seat.status === 'CONFIRMED' || seat.status === 'BOOKED';
    const isHeld = seat.status === 'HELD' && !isSelected;
    const isBlocked = seat.status === 'BLOCKED';

    let btnClass = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300 hover:border-emerald-400 shadow-2xs cursor-pointer';
    if (isSelected) {
      btnClass = 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300 cursor-pointer scale-105';
    } else if (isBooked) {
      btnClass = 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75';
    } else if (isHeld) {
      btnClass = 'bg-orange-50 text-orange-800 border-orange-300 cursor-not-allowed';
    } else if (isBlocked) {
      btnClass = 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed opacity-60';
    }

    return (
      <button
        key={seat.seatId}
        type="button"
        onClick={() => handleSeatClick(seat)}
        disabled={isBooked || isBlocked || isHeld || isDeparted || isFull}
        title={`Seat ${seat.seatNumber} (${seat.berthType}) - ${seat.status} [${seat.source}]`}
        className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center min-h-[50px] relative ${btnClass}`}
      >
        {isSelected && matchedAssigned && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-slate-950 text-[9px] font-mono font-bold text-white flex items-center justify-center shadow">
            P{matchedAssigned.passengerIndex + 1}
          </span>
        )}
        <span className="text-xs font-mono font-black">{seat.seatNumber}</span>
        <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-85">{seat.berthType}</span>
      </button>
    );
  };

  const handleProceed = async (e) => {
    e.preventDefault();

    // Validations: 1 Passenger = 1 IRCTC ID rule
    const missingIrctc = passengers.some(p => !p.irctc_id || !p.irctc_id.trim());
    if (missingIrctc) {
      alert('Validation Error: Each passenger must provide their own IRCTC ID. Please fill out the IRCTC ID for every passenger.');
      return;
    }

    // Check duplicate IRCTC IDs within multi-passenger booking
    const seenIrctcInBooking = new Set();
    for (let i = 0; i < passengers.length; i++) {
      const norm = passengers[i].irctc_id.trim().toLowerCase();
      if (seenIrctcInBooking.has(norm)) {
        alert(`Validation Error: Passenger ${i + 1} has a duplicate IRCTC User ID. Each passenger must provide their own unique IRCTC User ID.`);
        return;
      }
      seenIrctcInBooking.add(norm);
    }

    const invalidPassenger = passengers.some(p => !p.name || !p.age);
    if (invalidPassenger) {
      alert('Please fill out all passenger names and ages.');
      return;
    }

    if (isDeparted) {
      alert('Booking Closed: Train has already departed from the boarding station.');
      return;
    }
    if (isFull) {
      alert('Booking Closed: Train is FULL. No further tickets can be booked for this class.');
      return;
    }

    // Persist all passengers permanently to browser and user profile
    if (passengers.length > 0) {
      saveAllPassengersPermanently(passengers);
      await syncToProfile(passengers[0]);
    }

    // Call Booking API with selected seats and berth preferences
    try {
      const formattedSelectedSeats = selectedSeats.map(s => ({
        seat_id: s.seat_id,
        coach: s.coach,
        seat_number: s.seat_number,
        berth_type: s.berth_type
      }));

      const res = await api.post('/bookings/book', {
        train_id: trainId,
        travel_date: travelDate,
        coach_class: activeCoachClass || coachClass,
        quota: quota,
        irctc_id: passengers[0]?.irctc_id ? passengers[0].irctc_id.trim() : null,
        passengers: passengers.map((p, pIdx) => {
          const matchedSeat = selectedSeats.find(s => s.passengerIndex === pIdx);
          return {
            name: p.name,
            age: p.age,
            gender: p.gender,
            berth: p.berth || 'No Preference',
            irctc_id: p.irctc_id ? p.irctc_id.trim() : '',
            food_selection: p.food_selection || 'No Train Food',
            seat_id: matchedSeat ? matchedSeat.seat_id : null,
            coach: matchedSeat ? matchedSeat.coach : null,
            seat_number: matchedSeat ? matchedSeat.seat_number : null,
            berth_type: matchedSeat ? matchedSeat.berth_type : null
          };
        }),
        selected_seats: formattedSelectedSeats,
        status: bookingMode,
        total_fare: calculateTotalFare(),
        idempotency_key: idempotencyKey,
        source: sourceParam,
        destination: destParam
      });

      const { booking } = res.data;
      clearIdempotencyKey(user?.id);
      navigate(`/passenger/payment?booking_id=${booking.id}&amount=${calculateTotalFare()}`);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        const conflictMsg = err.response?.data?.error || 'Selected seat is no longer available. Please select another available seat.';
        const conflictSeat = err.response?.data?.conflict_seat;
        if (conflictSeat) {
          setSelectedSeats(prev => prev.filter(s => s.seat_id !== conflictSeat));
        }
        await refreshAvailability();
        if (showToast) {
          showToast(conflictMsg, 'error', 'Seat Conflict (409)');
        } else {
          alert(conflictMsg);
        }
        return;
      }
      alert('Booking failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const isCateringIncludedForSelectedClass = () => {
    if (!isFoodEligibleClass(activeCoachClass)) return false;
    const classCfg = (train?.class_catering && train?.class_catering[activeCoachClass]) || null;
    if (classCfg) return classCfg.payment_mode === 'Included in Ticket';
    return Boolean(train?.catering?.included_in_ticket);
  };

  const calculateFoodTotal = () => {
    // Food is strictly complimentary (₹0) for 1A, and never added to ticket fare
    return 0;
  };

  const calculateTotalFare = () => {
    const multiplier = passengers.length;
    const taxes = 62.50;
    return Math.round(baseFare * multiplier + taxes);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="rounded-xl bg-primary-900 p-2.5 text-white shadow-md">
            <Train className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">
              Passenger Details & Berth Preference
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase font-mono flex items-center gap-2 flex-wrap">
              <span>{train?.train_name || 'Express Train'} ({train?.train_number || trainId}) &bull; {travelDate} &bull; Class {activeCoachClass} &bull; Quota: <strong className="text-primary-700 font-black">{quota}</strong></span>
              {isTatkal && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px]">
                  TATKAL
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {isFull ? (
          <span className="rounded-xl bg-slate-100 border border-slate-300 px-3 py-1 text-xs font-black text-slate-700 font-mono flex items-center gap-1.5 shadow-xs">
            <AlertCircle className="h-3.5 w-3.5 text-slate-600" />
            FULL (REGRET)
          </span>
        ) : bookingMode === 'RAC' ? (
          <span className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-black text-amber-700 font-mono flex items-center gap-1.5 shadow-xs">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            {racPositionText}
          </span>
        ) : bookingMode === 'WL' ? (
          <span className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-black text-rose-700 font-mono flex items-center gap-1.5 shadow-xs">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            {wlPositionText}
          </span>
        ) : null}
      </div>

      {/* Journey Dates & Timings Banner */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-900 to-indigo-950 p-4 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="rounded-xl bg-white/10 p-2 text-blue-300">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-blue-200 font-bold">Journey Schedule</div>
            <div className="text-sm font-extrabold text-white flex flex-wrap items-center gap-2">
              <span>Departure: {formatDateFriendly(depDateStr)} {depTimeStr ? `(${depTimeStr})` : ''}</span>
              <span className="text-blue-300">&rarr;</span>
              <span>Arrival: {formatDateFriendly(arrDateStr)} {arrTimeStr ? `(${arrTimeStr})` : ''}</span>
            </div>
            <div className="text-[11px] text-blue-200/80 font-mono mt-0.5">
              Boarding: {sourceParam || train?.source || 'Source'} &bull; Destination: {destParam || train?.destination || 'Destination'}
            </div>
          </div>
        </div>
        {availabilityData?.duration_formatted && (
          <div className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-blue-100 self-start md:self-auto border border-white/10">
            Duration: {availabilityData.duration_formatted}
          </div>
        )}
      </div>

      {/* Warning if Departed */}
      {isDeparted && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900 flex items-start space-x-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-extrabold text-rose-800">Train Departed &bull; Booking Closed</h4>
            <p className="text-xs text-rose-700 mt-0.5">
              This train has already departed from <strong>{sourceParam || train?.source}</strong> on <strong>{formatDateFriendly(depDateStr)} at {depTimeStr}</strong>. Online reservations and seat holds are closed.
            </p>
          </div>
        </div>
      )}

      {/* Warning if Full */}
      {isFull && !isDeparted && (
        <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4 text-slate-900 flex items-start space-x-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-extrabold text-slate-800">Booking Full &bull; Capacity Exhausted</h4>
            <p className="text-xs text-slate-700 mt-0.5">
              All confirmed, RAC, and waiting list seats for class <strong>{activeCoachClass}</strong> are fully exhausted. No further bookings can be accepted.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Side: Seat Map & Passenger Input Form */}
        <div className="lg:col-span-2 space-y-6">



          {/* IRCTC Berth Allotment Policy Banner */}
          <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 to-indigo-50/80 p-5 space-y-2 shadow-xs">
            <div className="flex items-center space-x-2 text-blue-950 font-bold text-sm">
              <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
              <span>Indian Railways Automatic Seat Allotment</span>
            </div>
            <p className="text-xs text-blue-900/85 leading-relaxed font-medium">
              In accordance with Indian Railways (IRCTC) regulations, specific seat and coach numbers are automatically allotted by the central reservation system upon booking confirmation based on your <strong>Berth Preference</strong> and real-time coach inventory.
            </p>
          </div>

          {/* Passenger Input Details List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary-800" />
                <h3 className="text-base font-bold text-slate-800">Passenger Information</h3>
              </div>
              <button
                type="button"
                onClick={addPassenger}
                className="flex items-center space-x-1 text-xs font-bold text-primary-600 hover:underline"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Add Passenger</span>
              </button>
            </div>

            <div className="space-y-4">
              {passengers.map((passenger, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 relative">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-900 text-xs font-bold text-white font-mono">
                        P{index + 1}
                      </span>
                      
                      {/* Autofill Me */}
                      {user && user.role === 'passenger' && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...passengers];
                            updated[index] = {
                              ...updated[index],
                              name: user.full_name || '',
                              age: user.age || '',
                              gender: user.gender || 'Male',
                              berth: user.berth_preference || 'No Preference',
                              food_selection: user.meal_preference || 'No Preference',
                              irctc_id: user.irctc_user_id || user.irctc_id || updated[index].irctc_id || ''
                            };
                            setPassengers(updated);
                            saveAllPassengersPermanently(updated);
                            if (index === 0) {
                              savePassengerInfoPermanently(updated[0]);
                              syncToProfile(updated[0]);
                            }
                            if (showToast) showToast('Autofilled your profile details', 'info', 'Profile Autofill');
                          }}
                          className="text-[10px] bg-primary-50 hover:bg-primary-100 border border-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded transition flex items-center gap-1"
                        >
                          <User className="h-3 w-3" />
                          <span>Autofill Me</span>
                        </button>
                      )}

                      {/* Stored info badge for any passenger with remembered details */}
                      {passenger.name && passenger.name.trim() && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80 px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs" title="Previous passenger details remembered permanently and editable anytime">
                          <Sparkles className="h-3 w-3 text-blue-600" />
                          <span>Previous Info Stored (Editable)</span>
                        </span>
                      )}

                      {/* Select Saved Passenger Dropdown */}
                      {savedCompanions.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const companion = savedCompanions.find(c => c.id === val);
                            if (companion) {
                              applySavedPassengerToCard(index, companion);
                            }
                            e.target.value = '';
                          }}
                          className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 font-bold transition focus:outline-none cursor-pointer"
                        >
                          <option value="">[ Select Saved Passenger ▼ ]</option>
                          {savedCompanions.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.full_name} ({c.gender}, Age {c.age || '—'}{c.berth_preference ? ` • ${c.berth_preference}` : ''})
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Save to Profile Quick Action */}
                      {passenger.name && passenger.name.trim() && (
                        <button
                          type="button"
                          onClick={() => handleSaveToProfile(index)}
                          disabled={savingCardIndex === index}
                          className="text-[10px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold px-2 py-0.5 rounded transition flex items-center gap-1 disabled:opacity-50"
                          title="Save this passenger permanently to your profile"
                        >
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>{savingCardIndex === index ? 'Saving...' : 'Save to Profile'}</span>
                        </button>
                      )}
                    </div>

                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium italic bg-slate-100/60 rounded-lg px-3 py-1.5 border border-slate-200/60">
                    Berth &amp; Coach: Auto-allocated on confirmation based on your Berth Preference
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    {/* Full Name */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Full Name (as on ID proof)"
                        value={passenger.name}
                        onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                        onBlur={() => {
                          saveAllPassengersPermanently(passengers);
                          if (index === 0) syncToProfile(passengers[0]);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Age */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age *</label>
                      <input
                        type="number"
                        required
                        placeholder="Age"
                        value={passenger.age}
                        onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                        onBlur={() => {
                          saveAllPassengersPermanently(passengers);
                          if (index === 0) syncToProfile(passengers[0]);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                    {/* Gender */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender *</label>
                      <select
                        value={passenger.gender}
                        onChange={(e) => {
                          handlePassengerChange(index, 'gender', e.target.value);
                          if (index === 0) syncToProfile({ ...passengers[0], gender: e.target.value });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Passenger IRCTC ID */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">IRCTC User ID *</label>
                      <input
                        type="text"
                        required
                        placeholder="IRCTC ID (e.g. rahul123)"
                        value={passenger.irctc_id || ''}
                        onChange={(e) => handlePassengerChange(index, 'irctc_id', e.target.value)}
                        onBlur={() => {
                          saveAllPassengersPermanently(passengers);
                          if (index === 0) syncToProfile(passengers[0]);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none font-mono font-bold text-slate-800"
                      />
                    </div>

                    {/* Berth / Seat Preference */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <span>Berth / Seat Preference</span>
                        <Info className="h-3 w-3 text-slate-400" />
                      </label>
                      <select
                        value={passenger.berth || 'No Preference'}
                        onChange={(e) => {
                          handlePassengerChange(index, 'berth', e.target.value);
                          if (index === 0) syncToProfile({ ...passengers[0], berth: e.target.value });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-primary-500 focus:outline-none cursor-pointer"
                      >
                        {getBerthOptionsForClass(activeCoachClass).map(opt => (
                          <option key={opt.code} value={opt.code}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Train Food Selection */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <span>Food / Meal Preference</span>
                      </label>
                      <select
                        value={passenger.food_selection || 'No Preference'}
                        onChange={(e) => {
                          handlePassengerChange(index, 'food_selection', e.target.value);
                          if (index === 0) syncToProfile({ ...passengers[0], food_selection: e.target.value });
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-primary-500 focus:outline-none cursor-pointer"
                      >
                        <option value="No Preference">No Preference</option>
                        <option value="Vegetarian">Vegetarian (Veg)</option>
                        <option value="Non-Vegetarian">Non-Vegetarian (Non-Veg)</option>
                        <option value="Diabetic">Diabetic Friendly Meal</option>
                        <option value="No Train Food">Opt out of Train Food</option>
                      </select>
                    </div>

                    {train?.food_available && isComplimentaryFoodEligible(activeCoachClass) && (
                      <div className="sm:col-span-4 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/70 mt-1">
                        <label className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider block mb-1">
                          🍱 1A Complimentary Food Preference
                        </label>
                        <select
                          value={passenger.food_selection || 'Vegetarian'}
                          onChange={(e) => handlePassengerChange(index, 'food_selection', e.target.value)}
                          className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none cursor-pointer"
                        >
                          <option value="Vegetarian">○ Complimentary Vegetarian Meal (₹0)</option>
                          <option value="Non-Vegetarian">○ Complimentary Non-Vegetarian Meal (₹0)</option>
                          <option value="No Train Food">○ Opt out of Train Food</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Fare Invoice Summary */}
        <div className="space-y-4">
          {/* IRCTC Central Verification Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-primary-900 font-extrabold text-sm border-b border-slate-100 pb-2">
              <Users className="h-4 w-4" />
              <span>IRCTC CENTRAL VERIFICATION</span>
            </div>
            
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600 font-medium leading-normal">
                Mandatory Policy: <strong>1 Passenger = 1 IRCTC ID</strong>. Each passenger in your booking must provide their own separate IRCTC ID.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Passenger IRCTC Status</span>
                {passengers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-mono">
                    <span className="font-sans font-semibold text-slate-700">P{idx + 1}: {p.name || `Passenger ${idx + 1}`}</span>
                    {p.irctc_id && p.irctc_id.trim() ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {p.irctc_id.trim()}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                        Pending ID Entry
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowCreateIrctcModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 font-black text-xs transition active:scale-95 flex items-center justify-center space-x-1"
              >
                <span>+ Create New IRCTC ID</span>
              </button>
            </div>
          </div>

          <CreateIrctcModal
            isOpen={showCreateIrctcModal}
            onClose={() => setShowCreateIrctcModal(false)}
            onSuccess={(newId) => {
              const updated = [...passengers];
              const emptyIdx = updated.findIndex(p => !p.irctc_id || !p.irctc_id.trim());
              if (emptyIdx !== -1) {
                updated[emptyIdx].irctc_id = newId;
              } else {
                updated[0].irctc_id = newId;
              }
              setPassengers(updated);
            }}
          />



          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm tracking-wide">FARE SUMMARY</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{passengers.length} Passenger(s), {activeCoachClass} Class</p>
              </div>
              {isTatkal && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                  TATKAL QUOTA
                </span>
              )}
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm text-slate-500">
                <span>{isTatkal ? `Base Journey Fare (x${passengers.length})` : `Base Ticket Fare (x${passengers.length})`}</span>
                <span className="font-semibold text-slate-800">
                  {formatPrice(Math.max(50, baseFare - (isTatkal ? (['1A', 'EC'].includes(activeCoachClass) ? 500 : ['2A'].includes(activeCoachClass) ? 400 : ['3A', '3E', 'CC'].includes(activeCoachClass) ? 300 : ['SL'].includes(activeCoachClass) ? 100 : 15) : 0)) * passengers.length)}
                </span>
              </div>

              {isTatkal && (
                <div className="flex justify-between text-xs text-amber-900 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 font-semibold">
                  <span>Tatkal Quota Surcharge (x{passengers.length})</span>
                  <span className="font-mono font-bold">
                    {formatPrice((['1A', 'EC'].includes(activeCoachClass) ? 500 : ['2A'].includes(activeCoachClass) ? 400 : ['3A', '3E', 'CC'].includes(activeCoachClass) ? 300 : ['SL'].includes(activeCoachClass) ? 100 : 15) * passengers.length)}
                  </span>
                </div>
              )}

              {isComplimentaryFoodEligible(activeCoachClass) && (
                <div className="flex justify-between text-xs text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-semibold">
                  <span>1A Complimentary Food</span>
                  <span className="font-mono font-bold">₹0.00 (Included Free)</span>
                </div>
              )}

              <div className="flex justify-between text-sm text-slate-500">
                <span>IRCTC Service Charge</span>
                <span className="font-semibold text-slate-800">{formatPrice(62.50)}</span>
              </div>

              {isTatkal && (
                <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-2.5 text-[10.5px] text-amber-900 space-y-0.5">
                  <div className="font-black flex items-center gap-1 text-[11px] text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Tatkal Policy Notice:</span>
                  </div>
                  <p className="leading-tight">
                    As per Indian Railways rules, confirmed Tatkal tickets are non-refundable (0% refund) upon cancellation.
                  </p>
                </div>
              )}
              
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Total Fare</span>
                <span className="text-xl font-extrabold text-primary-900">{formatPrice(calculateTotalFare())}</span>
              </div>

              <button
                onClick={handleProceed}
                disabled={isDeparted || isFull || passengers.some(p => !p.irctc_id || !p.irctc_id.trim())}
                className="w-full flex items-center justify-center space-x-2 rounded-xl bg-primary-900 hover:bg-primary-950 py-3.5 font-bold text-white shadow-lg shadow-primary-900/10 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>
                  {isDeparted 
                    ? 'Train Departed (Booking Closed)' 
                    : isFull 
                    ? 'Train Full (Booking Closed)' 
                    : 'Continue to Payment'}
                </span>
                {!isDeparted && !isFull && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Secure Booking</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Your connection is protected by banking-grade SSL 256-bit encryption. Ticket cancellations receive instant refunds.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SeatSelection;
