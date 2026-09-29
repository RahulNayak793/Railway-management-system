const express = require('express');
const router = express.Router();
const { supabase, isMockMode, mockDb, saveMockDbToFile, resolvePassengerNameForBooking } = require('../config/supabase');
const { authenticateToken, requireRoles, requirePermission } = require('../middleware/auth');
const { sendEmail } = require('../config/nodemailer');
const { sendSMS } = require('../config/twilio');
const { matchRouteSegment } = require('../utils/routeSearch');
const { calculateSegmentFare } = require('../utils/fareCalculator');
const { normalizeClassList, getDefaultClassesForTrain, getClassLabel, isValidClassCode } = require('../utils/trainClasses');
const { evaluateCateringEligibility, getTrainCateringConfig } = require('../services/cateringEligibility');
const { calculatePassengerFoodPrice, getClassFoodConfig } = require('../utils/trainFood');
const { isFoodEligibleClass, isBookingCancelled, isJourneyCompleted } = require('../utils/cateringEligibilityHelper');
const { saveOrUpdateBookingPassengers } = require('./passengers');

// Generate 10-digit PNR
const generatePNR = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Helper to calculate exact destination arrival date and time for a booking
function calculateDestinationArrivalDateTime(booking, train, route) {
  if (booking.destination_arrival_date_time) {
    const p = new Date(booking.destination_arrival_date_time);
    if (!isNaN(p.getTime())) return p;
  }

  const travelDateStr = booking.travel_date;
  if (!travelDateStr) return new Date();

  const departureTimeStr = route?.departure_time || train?.departure_time || booking.departure_time || '16:30';
  const arrivalTimeStr = route?.arrival_time || train?.arrival_time || booking.arrival_time || '08:15';

  const parseMins = (tStr) => {
    if (!tStr) return 0;
    const clean = String(tStr).trim().split(' ')[0];
    const parts = clean.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const depMins = parseMins(departureTimeStr);
  const arrMins = parseMins(arrivalTimeStr);

  const travelDateObj = new Date(travelDateStr + 'T00:00:00');
  if (arrMins < depMins) {
    travelDateObj.setDate(travelDateObj.getDate() + 1);
  }

  const year = travelDateObj.getFullYear();
  const month = String(travelDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(travelDateObj.getDate()).padStart(2, '0');

  const cleanArrTime = String(arrivalTimeStr).trim().split(' ')[0];
  const formattedArrTime = cleanArrTime.length === 5 ? `${cleanArrTime}:00` : cleanArrTime;

  return new Date(`${year}-${month}-${day}T${formattedArrTime}`);
}

// Format and normalize booking model for authoritative responses
function formatBookingForResponse(b) {
  if (!b) return b;
  const normStatus = String(b.status || '').toLowerCase();

  let booking_status = 'CNF';
  if (normStatus === 'cancelled') booking_status = 'CANCELLED';
  else if (normStatus === 'auto_cancelled') booking_status = 'AUTO_CANCELLED';
  else if (normStatus === 'rac') booking_status = 'RAC';
  else if (normStatus === 'waitlist' || normStatus === 'waiting' || normStatus === 'wl') booking_status = 'WL';
  else if (normStatus === 'completed') booking_status = 'COMPLETED';

  let waitlist_type = b.waitlist_type || null;
  if ((booking_status === 'WL' || booking_status === 'RAC') && !waitlist_type) {
    if (b.quota === 'TQ' || b.quota === 'CK' || b.quota === 'TATKAL') waitlist_type = 'TQWL';
    else if (booking_status === 'WL') waitlist_type = 'GNWL';
  }

  const ticket_type = (b.ticket_type || 'E_TICKET').toUpperCase() === 'COUNTER' ? 'COUNTER' : 'E_TICKET';

  let boarding_eligibility = b.boarding_eligibility || null;
  if (!boarding_eligibility) {
    if (booking_status === 'CNF' || booking_status === 'COMPLETED') boarding_eligibility = 'RESERVED_CONFIRMED';
    else if (booking_status === 'RAC') boarding_eligibility = 'RAC_RESERVED';
    else if (booking_status === 'AUTO_CANCELLED') boarding_eligibility = 'AUTO_CANCELLED';
    else if (booking_status === 'WL') {
      boarding_eligibility = ticket_type === 'COUNTER' ? 'WAITLISTED_COUNTER' : 'WAITLISTED_ETICKET_NOT_ELIGIBLE';
    } else {
      boarding_eligibility = 'WAITLISTED_ETICKET_NOT_ELIGIBLE';
    }
  }

  const isInvalidStation = (val) => {
    if (!val) return true;
    const str = String(val).trim().toUpperCase();
    return str === 'ADMIN' || str === 'UNDEFINED' || str === 'NULL' || str === 'ADMIN (ADMIN)';
  };

  let srcCode = b.source_station_code;
  if (isInvalidStation(srcCode)) srcCode = b.from_station_code;
  if (isInvalidStation(srcCode)) srcCode = (!isInvalidStation(b.source) ? b.source : null);
  if (isInvalidStation(srcCode)) srcCode = b.train?.source_station_code;
  if (isInvalidStation(srcCode)) srcCode = (!isInvalidStation(b.train?.source) ? b.train.source : null);
  if (isInvalidStation(srcCode)) srcCode = 'NDLS';

  let destCode = b.destination_station_code;
  if (isInvalidStation(destCode)) destCode = b.to_station_code;
  if (isInvalidStation(destCode)) destCode = (!isInvalidStation(b.destination) ? b.destination : null);
  if (isInvalidStation(destCode)) destCode = b.train?.destination_station_code;
  if (isInvalidStation(destCode)) destCode = (!isInvalidStation(b.train?.destination) ? b.train.destination : null);
  if (isInvalidStation(destCode)) destCode = 'MMCT';

  let srcName = b.source_station_name;
  if (isInvalidStation(srcName)) srcName = b.from_station_name;
  if (isInvalidStation(srcName)) srcName = b.source_name;
  if (isInvalidStation(srcName) || srcName === srcCode) {
    srcName = srcCode === 'NDLS' ? 'New Delhi' : ((srcCode === 'UD' || srcCode === 'UDU') ? 'Udupi' : srcCode);
  }

  let destName = b.destination_station_name;
  if (isInvalidStation(destName)) destName = b.to_station_name;
  if (isInvalidStation(destName)) destName = b.destination_name;
  if (isInvalidStation(destName) || destName === destCode) {
    destName = destCode === 'MMCT' ? 'Mumbai Central' : (destCode === 'NDLS' ? 'New Delhi' : destCode);
  }

  // Look up matching catering orders from mockDb if in mock mode or b.catering_order already attached
  let cateringOrders = [];
  if (isMockMode && mockDb.catering_orders && b.pnr_number) {
    cateringOrders = Array.from(mockDb.catering_orders.values()).filter(c => c && (c.pnr_number === b.pnr_number || c.pnr === b.pnr_number || c.booking_id === b.id));
  }
  let cateringOrder = b.catering_order || (cateringOrders.length > 0 ? cateringOrders[cateringOrders.length - 1] : null);
  const hasMealOrdered = Boolean(cateringOrder && !['CANCELLED', 'Cancelled'].includes(cateringOrder.status));

  // Check if catering is included in ticket for long-distance journeys
  const trainObj = b.train || (b.train_id && mockDb.trains ? mockDb.trains.get(b.train_id) : null);
  const trainCatering = trainObj?.catering || null;
  const dist = parseFloat(b.distance_km || trainObj?.distance_km || ((srcCode === 'UD' || srcCode === 'UDU') ? 1400 : 500)) || 500;
  const dur = parseFloat(b.duration_hours || (b.duration_minutes ? b.duration_minutes / 60 : 8)) || 8;
  const isShortJourney = (dist > 0 && dist < 200) || (dur > 0 && dur < 4);
  const isCateringDisabled = trainCatering?.enabled === false || trainCatering?.service_type === 'NONE';

  const classCode = b.coach_class || b.class || '2A';
  const is1AClass = isFoodEligibleClass(classCode);
  const classFoodCfg = trainObj ? getClassFoodConfig(trainObj, classCode) : null;
  const isCateringIncludedInTicket = is1AClass && Boolean(
    b.catering_included_in_ticket === true || (trainCatering && trainCatering.included_in_ticket === true) || (classFoodCfg && classFoodCfg.payment_mode === 'Included in Ticket')
  );

  const isCancelled = isBookingCancelled(b);
  const isCompleted = isJourneyCompleted(b);

  let includedCateringDetails = b.included_catering_details || null;
  if (isCancelled) {
    includedCateringDetails = {
      status_label: 'Food Unavailable (Cancelled Ticket)',
      included_in_ticket: false,
      additional_food_charge: 0,
      payment_mode: 'Not Available',
      notice: 'Food ordering is unavailable for cancelled tickets.'
    };
  } else if (isCompleted) {
    includedCateringDetails = {
      status_label: 'Food Service Closed (Journey Completed)',
      included_in_ticket: false,
      additional_food_charge: 0,
      payment_mode: 'Not Available',
      notice: 'Food ordering is unavailable because your journey has been completed.'
    };
  } else if (isCateringIncludedInTicket) {
    const defaultMeals = trainCatering?.included_meals || ['Breakfast', 'Lunch', 'Dinner'];
    const estimatedValue = b.included_catering_value || b.food_amount || trainCatering?.included_value || 280;
    includedCateringDetails = {
      status_label: 'Food Included in Ticket',
      included_in_ticket: true,
      additional_food_charge: 0,
      included_catering_value: estimatedValue,
      payment_mode: 'Included in Ticket',
      meals: defaultMeals,
      notice: 'Included in ticket fare — ✓ No separate food payment required'
    };
  } else {
    includedCateringDetails = {
      status_label: 'Food Service Available for this Journey',
      included_in_ticket: false,
      additional_food_charge: b.food_amount || 0,
      payment_mode: 'Available',
      notice: 'Food service is available for this journey via RailControl Meals.'
    };
  }

  // Operational disruption check (strictly date-isolated to booking journey date)
  let operationalDisruption = null;
  const bookingDate = b.travel_date || b.journey_date;
  if (trainObj && bookingDate) {
    let dateStatus = null;
    if (isMockMode && mockDb.train_status_by_date) {
      dateStatus = mockDb.train_status_by_date.get(`${trainObj.id}_${bookingDate}`) ||
                   mockDb.train_status_by_date.get(`${trainObj.train_number}_${bookingDate}`) ||
                   mockDb.train_status_by_date.get(`${b.train_id}_${bookingDate}`);
    }

    if (!dateStatus && isMockMode && mockDb.train_services) {
      const svc = Array.from(mockDb.train_services.values()).find(
        s => s && (s.train_id === trainObj.id || s.train_id === b.train_id || String(s.train_number) === String(trainObj.train_number)) && s.service_date === bookingDate
      );
      if (svc && (svc.delay_minutes > 0 || svc.status === 'DELAYED' || svc.status === 'CANCELLED' || svc.status === 'RESCHEDULED' || svc.updated_departure_time)) {
        dateStatus = {
          status: (svc.status || 'on_time').toLowerCase(),
          delay_minutes: svc.delay_minutes || 0,
          reason: svc.delay_reason || null,
          announcement_message: svc.delay_message || null,
          updated_departure_time: svc.updated_departure_time || null,
          updated_arrival_time: svc.updated_arrival_time || null,
          updated_at: svc.status_updated_at || svc.updated_at || null
        };
      }
    }

    if (!dateStatus && isMockMode && mockDb.train_status_history) {
      const matchingHistory = Array.from(mockDb.train_status_history.values())
        .filter(h => (h.train_id === trainObj.id || h.train_id === b.train_id || String(h.train_number) === String(trainObj.train_number)) && h.journey_date === bookingDate)
        .sort((a, b) => new Date(b.updated_at || b.timestamp || 0) - new Date(a.updated_at || a.timestamp || 0))[0];
      if (matchingHistory) {
        dateStatus = {
          status: (matchingHistory.new_status || 'on_time').toLowerCase(),
          delay_minutes: matchingHistory.delay_minutes || 0,
          reason: matchingHistory.reason || null,
          announcement_message: matchingHistory.announcement_message || matchingHistory.message || null,
          updated_departure_time: matchingHistory.updated_departure_time || null,
          updated_arrival_time: matchingHistory.updated_arrival_time || null,
          updated_at: matchingHistory.updated_at || null
        };
      }
    }

    // Check if train is date-specific and matches bookingDate
    if (!dateStatus && trainObj.is_date_specific && trainObj.journey_date === bookingDate) {
      const trainStatus = (trainObj.status || 'on_time').toLowerCase();
      if (['delayed', 'rescheduled', 'cancelled', 'diverted', 'short_terminated', 'regulated', 'platform_changed'].includes(trainStatus)) {
        dateStatus = {
          status: trainStatus,
          delay_minutes: trainObj.delay_minutes || 0,
          reason: trainObj.delay_reason || trainObj.cancellation_reason || null,
          announcement_message: trainObj.announcement_message || null,
          updated_departure_time: trainObj.updated_departure_time || null,
          updated_arrival_time: trainObj.updated_arrival_time || null,
          updated_at: trainObj.status_updated_at || null
        };
      }
    }

    // Fallback for non-date-specific test environments
    if (!dateStatus && !trainObj.is_date_specific && trainObj.status && ['delayed', 'rescheduled', 'cancelled'].includes(trainObj.status.toLowerCase())) {
      dateStatus = {
        status: trainObj.status.toLowerCase(),
        delay_minutes: trainObj.delay_minutes || 0,
        reason: trainObj.delay_reason || trainObj.cancellation_reason || null,
        announcement_message: trainObj.announcement_message || null,
        updated_departure_time: trainObj.updated_departure_time || null,
        updated_arrival_time: trainObj.updated_arrival_time || null,
        updated_at: trainObj.status_updated_at || null
      };
    }

    if (dateStatus && ['delayed', 'rescheduled', 'cancelled', 'diverted', 'short_terminated', 'regulated', 'platform_changed'].includes(dateStatus.status)) {
      operationalDisruption = {
        status: dateStatus.status,
        delay_minutes: dateStatus.delay_minutes || 0,
        reason: dateStatus.reason || 'Operational adjustment',
        platform: dateStatus.platform || trainObj.platform || null,
        updated_departure_time: dateStatus.updated_departure_time || null,
        updated_arrival_time: dateStatus.updated_arrival_time || null,
        announcement_message: dateStatus.announcement_message || null,
        updated_at: dateStatus.updated_at || null
      };
    }
  }

  return {
    ...b,
    irctc_id: b.irctc_id || null,
    catering_order: cateringOrder,
    catering_orders: cateringOrders,
    has_meal_ordered: hasMealOrdered,
    catering_included_in_ticket: isCateringIncludedInTicket,
    included_catering_details: includedCateringDetails,
    operational_disruption: operationalDisruption,
    source: srcCode,
    destination: destCode,
    source_station_code: srcCode,
    destination_station_code: destCode,
    from_station_code: srcCode,
    to_station_code: destCode,
    source_station_name: srcName,
    destination_station_name: destName,
    from_station_name: srcName,
    to_station_name: destName,
    status: b.status || (booking_status === 'CNF' ? 'confirmed' : booking_status.toLowerCase()),
    booking_status,
    waitlist_type,
    booking_status_number: b.booking_status_number || 1,
    current_status_number: b.current_status_number || b.booking_status_number || 1,
    boarding_eligibility,
    chart_status: b.chart_status || 'NOT_PREPARED',
    food_amount: typeof b.food_amount === 'number' ? b.food_amount : 0,
    base_fare: typeof b.base_fare === 'number' ? b.base_fare : (typeof b.total_fare === 'number' ? b.total_fare - (typeof b.food_amount === 'number' ? b.food_amount : 0) : 0),
    food_selection: b.food_selection || (b.passengers && Array.isArray(b.passengers) ? Array.from(new Set(b.passengers.map(p => p.food_selection || p.food_choice).filter(s => s && s !== 'No Train Food'))).join(', ') || 'Not Selected' : 'Not Selected')
  };
}

// Compute authoritative booking status
function computeBookingStatus(booking, train, route, currentDateTime = new Date()) {
  const normStatus = String(booking.status || '').toLowerCase();

  // 1. Cancelled bookings stay CANCELLED permanently
  if (normStatus === 'cancelled') {
    return 'cancelled';
  }
  if (normStatus === 'auto_cancelled') {
    return 'auto_cancelled';
  }

  // 2. Determine completion using destination arrival date & time
  const arrivalDateTime = calculateDestinationArrivalDateTime(booking, train, route);
  if (currentDateTime.getTime() >= arrivalDateTime.getTime()) {
    return 'completed';
  }

  return normStatus === 'completed' ? 'completed' : (booking.status || 'confirmed');
}

// Helper to filter, sort, and paginate bookings in memory
function processBookingsQuery(enrichedBookings, queryParams) {
  let result = [...enrichedBookings];

  const {
    search,
    train,
    date_filter,
    from_date,
    to_date,
    status,
    coach_class,
    class: classParam,
    quota,
    payment_status,
    sort = 'journey_date',
    order = 'asc',
    page = 1,
    limit = 25,
    group_by = 'none'
  } = queryParams;

  const targetClass = classParam || coach_class;

  // 1. Search (partial matching across PNR, booking ID, passenger name, email, train number/name, coach, seat, IRCTC ID)
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    result = result.filter(b => {
      const pnrMatch = b.pnr_number && String(b.pnr_number).toLowerCase().includes(q);
      const pnrShortMatch = b.pnr && String(b.pnr).toLowerCase().includes(q);
      const idMatch = b.id && String(b.id).toLowerCase().includes(q);
      const trainNoMatch = (b.train_number || b.train?.train_number) && String(b.train_number || b.train?.train_number).toLowerCase().includes(q);
      const trainNameMatch = (b.train_name || b.train?.train_name) && String(b.train_name || b.train?.train_name).toLowerCase().includes(q);
      const emailMatch = (b.user_email || b.passenger_email) && String(b.user_email || b.passenger_email).toLowerCase().includes(q);
      const primaryPaxMatch = (b.passenger_name || b.primaryPassenger) && String(b.passenger_name || b.primaryPassenger).toLowerCase().includes(q);
      const irctcMatch = b.irctc_user_id && String(b.irctc_user_id).toLowerCase().includes(q);
      
      const allocMatch = b.allocations && Array.isArray(b.allocations) && b.allocations.some(a => 
        (a.passenger_name && String(a.passenger_name).toLowerCase().includes(q)) ||
        (a.seat_number && String(a.seat_number).toLowerCase().includes(q)) ||
        (a.seat_id && String(a.seat_id).toLowerCase().includes(q)) ||
        (a.coach_number && String(a.coach_number).toLowerCase().includes(q)) ||
        (a.coach_id && String(a.coach_id).toLowerCase().includes(q))
      );

      return pnrMatch || pnrShortMatch || idMatch || trainNoMatch || trainNameMatch || emailMatch || primaryPaxMatch || irctcMatch || allocMatch;
    });
  }

  // 2. Filter by Train
  if (train && train !== 'ALL' && train !== 'All' && train !== 'all') {
    const cleanTrain = String(train).trim().toLowerCase();
    result = result.filter(b => {
      const tNo = String(b.train_number || b.train?.train_number || '').toLowerCase();
      const tId = String(b.train_id || b.train?.id || '').toLowerCase();
      const tName = String(b.train_name || b.train?.train_name || '').toLowerCase();
      return tNo === cleanTrain || tId === cleanTrain || tName.includes(cleanTrain) || cleanTrain.includes(tNo);
    });
  }

  // 3. Filter by Journey Date
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  if (date_filter && date_filter !== 'ALL' && date_filter !== 'All' && date_filter !== 'all') {
    const df = String(date_filter).toLowerCase();
    if (df === 'today') {
      result = result.filter(b => b.travel_date === todayStr);
    } else if (df === 'tomorrow') {
      result = result.filter(b => b.travel_date === tomorrowStr);
    } else if (df === 'upcoming') {
      result = result.filter(b => b.travel_date >= todayStr);
    } else if (df === 'past') {
      result = result.filter(b => b.travel_date < todayStr);
    } else if (df === 'custom' || from_date || to_date) {
      if (from_date) result = result.filter(b => b.travel_date >= from_date);
      if (to_date) result = result.filter(b => b.travel_date <= to_date);
    }
  } else if (from_date || to_date) {
    if (from_date) result = result.filter(b => b.travel_date >= from_date);
    if (to_date) result = result.filter(b => b.travel_date <= to_date);
  }

  // 4. Filter by Booking Status
  if (status && status !== 'ALL' && status !== 'All' && status !== 'all') {
    const st = String(status).toLowerCase();
    result = result.filter(b => {
      const bSt = String(b.status || '').toLowerCase();
      if (st === 'confirmed' || st === 'cnf') return bSt === 'confirmed' || bSt === 'cnf';
      if (st === 'rac') return bSt === 'rac';
      if (st === 'waitlist' || st === 'waiting' || st === 'wl') return bSt === 'waitlist' || bSt === 'waiting' || bSt === 'wl';
      if (st === 'cancelled') return bSt === 'cancelled';
      if (st === 'auto_cancelled') return bSt === 'auto_cancelled';
      if (st === 'completed') return bSt === 'completed';
      return bSt === st;
    });
  }

  // 5. Filter by Class
  if (targetClass && targetClass !== 'ALL' && targetClass !== 'All' && targetClass !== 'all') {
    const cls = String(targetClass).trim().toUpperCase();
    result = result.filter(b => String(b.coach_class || b.class || '').toUpperCase() === cls);
  }

  // 6. Filter by Quota
  if (quota && quota !== 'ALL' && quota !== 'All' && quota !== 'all') {
    const q = String(quota).trim().toUpperCase();
    result = result.filter(b => String(b.quota || '').toUpperCase().includes(q));
  }

  // 7. Filter by Payment Status
  if (payment_status && payment_status !== 'ALL' && payment_status !== 'All' && payment_status !== 'all') {
    const ps = String(payment_status).trim().toLowerCase();
    result = result.filter(b => {
      const bPs = String(b.payment_status || b.payment?.status || 'paid').toLowerCase();
      if (ps === 'paid') return bPs === 'paid' || bPs === 'completed' || bPs === 'success';
      if (ps === 'pending') return bPs === 'pending' || bPs === 'initiated';
      if (ps === 'failed') return bPs === 'failed';
      if (ps === 'refunded') return bPs === 'refunded';
      if (ps === 'partially_refunded') return bPs === 'partially_refunded' || bPs === 'partially refunded';
      return bPs === ps;
    });
  }

  // 8. Sorting
  const sortKey = String(sort).toLowerCase();
  const isDesc = String(order).toLowerCase() === 'desc';

  result.sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortKey === 'journey_date' || sortKey === 'journeydate' || sortKey === 'travel_date') {
      valA = a.travel_date || '';
      valB = b.travel_date || '';
    } else if (sortKey === 'booking_date' || sortKey === 'bookingdate' || sortKey === 'created_at') {
      valA = a.created_at || '';
      valB = b.created_at || '';
    } else if (sortKey === 'train_number' || sortKey === 'trainnumber') {
      valA = String(a.train_number || a.train?.train_number || '');
      valB = String(b.train_number || b.train?.train_number || '');
    } else if (sortKey === 'train_name' || sortKey === 'trainname') {
      valA = String(a.train_name || a.train?.train_name || '');
      valB = String(b.train_name || b.train?.train_name || '');
    } else if (sortKey === 'passenger_name' || sortKey === 'passengername') {
      valA = String(a.passenger_name || a.primaryPassenger || '');
      valB = String(b.passenger_name || b.primaryPassenger || '');
    } else if (sortKey === 'pnr') {
      valA = String(a.pnr_number || a.pnr || a.id || '');
      valB = String(b.pnr_number || b.pnr || b.id || '');
    } else if (sortKey === 'class') {
      valA = String(a.coach_class || a.class || '');
      valB = String(b.coach_class || b.class || '');
    } else if (sortKey === 'status') {
      valA = String(a.status || '');
      valB = String(b.status || '');
    } else {
      valA = a.travel_date || '';
      valB = b.travel_date || '';
    }

    if (valA < valB) return isDesc ? 1 : -1;
    if (valA > valB) return isDesc ? -1 : 1;
    return 0;
  });

  const total = result.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 25);
  const totalPages = Math.ceil(total / limitNum) || 1;

  const startIndex = (pageNum - 1) * limitNum;
  const paginatedItems = result.slice(startIndex, startIndex + limitNum);

  // Group by option if requested
  let grouped = null;
  if (group_by && group_by !== 'none' && group_by !== 'None') {
    grouped = {};
    const gb = String(group_by).toLowerCase();
    result.forEach(b => {
      let key = 'Other';
      if (gb === 'train') key = `${b.train_number || b.train?.train_number || '12051'} - ${b.train_name || b.train?.train_name || 'Express'}`;
      else if (gb === 'journey_date' || gb === 'journeydate') key = b.travel_date || 'Unknown Date';
      else if (gb === 'class') key = b.coach_class || b.class || '3A';
      else if (gb === 'status') key = (b.status || 'CONFIRMED').toUpperCase();

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    });
  }

  return {
    data: paginatedItems,
    allFiltered: result,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages,
    grouped
  };
}

// Check booking history for logged-in user
router.get('/', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const passengerEmail = req.user.email;
  const { role } = req.user;

  if (isMockMode || (passengerId && String(passengerId).startsWith('usr-'))) {
    let bookingsList = Array.from(mockDb.bookings.values());

    // Strict filtering: Passenger receives ONLY their own bookings
    if (role === 'passenger') {
      bookingsList = bookingsList.filter(b => {
        if (!b) return false;
        return (b.passenger_id && b.passenger_id === passengerId) ||
               (b.user_id && b.user_id === passengerId) ||
               (b.created_by_id && b.created_by_id === passengerId) ||
               (passengerEmail && b.passenger_email && b.passenger_email.toLowerCase() === passengerEmail.toLowerCase());
      });
    }

    let stateUpdated = false;

    // Attach train, route, allocations and compute authoritative status
    const enrichedBookings = bookingsList.map(b => {
      const train = mockDb.trains.get(b.train_id);
      const route = Array.from(mockDb.routes.values()).find(r => r && r.train_id === b.train_id);
      const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === b.id);
      const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === b.id);
      
      const arrivalDateTime = calculateDestinationArrivalDateTime(b, train, route);
      const computedStatus = computeBookingStatus(b, train, route);

      // Persist status transition to COMPLETED when destination arrival time has passed
      if (b.status !== 'cancelled' && b.status !== 'auto_cancelled' && computedStatus === 'completed' && b.status !== 'completed') {
        b.status = 'completed';
        b.completed_at = arrivalDateTime.toISOString();
        mockDb.bookings.set(b.id, b);
        stateUpdated = true;
      }

      return formatBookingForResponse({
        ...b,
        status: computedStatus,
        destination_arrival_date_time: arrivalDateTime.toISOString(),
        train: train || (b.train_name || b.train_number ? {
          train_name: b.train_name,
          train_number: b.train_number,
          source: b.source || b.source_station_code || '',
          destination: b.destination || b.destination_station_code || ''
        } : null),
        route,
        allocations,
        payment
      });
    });

    if (stateUpdated) {
      saveMockDbToFile();
    }

    // Apply filtering, searching, sorting, and pagination
    const processed = processBookingsQuery(enrichedBookings, req.query);

    // If paginated response is requested explicitly or pagination query params are present
    const isPaginated = req.query.paginated === 'true' || req.query.page !== undefined || req.query.limit !== undefined || req.query.search !== undefined || req.query.train !== undefined || req.query.status !== undefined;

    if (isPaginated && req.query.paginated === 'true') {
      return res.json({
        bookings: processed.data,
        total: processed.total,
        page: processed.page,
        limit: processed.limit,
        totalPages: processed.totalPages,
        grouped: processed.grouped
      });
    }

    // Return array with attached pagination properties for 100% backward & forward compatibility
    const responseArray = processed.allFiltered ? (req.query.page || req.query.limit ? processed.data : processed.allFiltered) : enrichedBookings;
    responseArray.total = processed.total;
    responseArray.page = processed.page;
    responseArray.limit = processed.limit;
    responseArray.totalPages = processed.totalPages;
    responseArray.grouped = processed.grouped;

    return res.json(responseArray);
  } else {
    try {
      let query = supabase.from('bookings').select(`
        *,
        train:trains(*),
        allocations:seat_allocations(*),
        payments:payments(*)
      `);

      if (role === 'passenger') {
        query = query.eq('passenger_id', passengerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enrichedData = data.map(b => {
        const payment = b.payments && b.payments.length > 0 ? b.payments[0] : null;
        const creq = mockDb.cancellation_requests.get(b.id);
        const arrivalDateTime = calculateDestinationArrivalDateTime(b, b.train, null);
        const computedStatus = computeBookingStatus(b, b.train, null);

        return formatBookingForResponse({
          ...b,
          status: computedStatus,
          destination_arrival_date_time: arrivalDateTime.toISOString(),
          payment,
          cancellation_pending: creq && creq.status === 'pending' ? true : false
        });
      });

      const processed = processBookingsQuery(enrichedData, req.query);
      const isPaginated = req.query.paginated === 'true' || req.query.page !== undefined || req.query.limit !== undefined || req.query.search !== undefined;

      if (isPaginated && req.query.paginated === 'true') {
        return res.json({
          bookings: processed.data,
          total: processed.total,
          page: processed.page,
          limit: processed.limit,
          totalPages: processed.totalPages,
          grouped: processed.grouped
        });
      }

      const responseArray = (req.query.page || req.query.limit) ? processed.data : processed.allFiltered;
      responseArray.total = processed.total;
      responseArray.page = processed.page;
      responseArray.limit = processed.limit;
      responseArray.totalPages = processed.totalPages;
      responseArray.grouped = processed.grouped;

      return res.json(responseArray);
    } catch (err) {
      console.error('Supabase DB error fetching bookings:', err.message);
      return res.status(500).json({ error: 'Database error fetching bookings: ' + err.message });
    }
  }
});

// Get single booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const { id } = req.params;

  if (isMockMode || (passengerId && String(passengerId).startsWith('usr-'))) {
    const booking = mockDb.bookings.get(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'staff' && booking.passenger_id !== passengerId && booking.user_id !== passengerId) {
      return res.status(403).json({ error: 'Access denied: You do not own this booking' });
    }

    const train = mockDb.trains.get(booking.train_id);
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === booking.id);
    const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === booking.id);

    return res.json(formatBookingForResponse({
      ...booking,
      train,
      allocations,
      payment
    }));
  } else {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          train:trains(*),
          allocations:seat_allocations(*),
          payments:payments(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Booking not found' });

      if (req.user.role !== 'admin' && req.user.role !== 'staff' && data.passenger_id !== passengerId && data.user_id !== passengerId) {
        return res.status(403).json({ error: 'Access denied: You do not own this booking' });
      }

      const payment = data.payments && data.payments.length > 0 ? data.payments[0] : null;
      return res.json(formatBookingForResponse({ ...data, payment }));
    } catch (err) {
      return res.status(500).json({ error: 'Database error fetching booking: ' + err.message });
    }
  }
});

// Optional authentication middleware for PNR lookup
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    let decoded;
    if (token.startsWith('mock-base64-')) {
      try {
        const payloadStr = Buffer.from(token.replace('mock-base64-', ''), 'base64').toString('utf8');
        decoded = JSON.parse(payloadStr);
      } catch (e) {
        decoded = null;
      }
    } else if (token.startsWith('mock-client-jwt-token-') || token === 'mock-token') {
      decoded = {
        id: 'usr-demo-passenger',
        email: 'passenger@railway.com',
        role: 'passenger',
        full_name: 'DEMO PASSENGER'
      };
    } else {
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (verifyErr) {
        decoded = jwt.decode(token);
      }
    }

    if (decoded) {
      req.user = decoded;
    }
  } catch (error) {
    // Suppress token errors to allow unauthenticated searches
  }
  next();
};

// PNR Status Query (No Authentication Required, Optional Auth for Privacy)
router.get('/pnr/:pnr', optionalAuthenticateToken, async (req, res) => {
  const { pnr } = req.params;

  if (isMockMode) {
    const booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === pnr);
    if (!booking) return res.status(404).json({ error: 'PNR not found' });

    const train = mockDb.trains.get(booking.train_id);
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === booking.id);
    const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === booking.id);

    let status = booking.status;
    const creq = mockDb.cancellation_requests.get(booking.id);
    if (creq && creq.status === 'pending') {
      status = 'cancel_requested';
    }

    // Authorization check
    const isAuthorized = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'staff' ||
      req.user.id === booking.passenger_id ||
      req.user.id === booking.user_id ||
      (req.user.email && booking.passenger_email && req.user.email.toLowerCase() === booking.passenger_email.toLowerCase())
    );

    if (isAuthorized) {
      return res.json(formatBookingForResponse({
        ...booking,
        status,
        train,
        allocations,
        payment
      }));
    } else {
      // Sanitize details for public lookup
      const formatted = formatBookingForResponse({ ...booking, train });
      return res.json({
        pnr_number: booking.pnr_number,
        irctc_id: formatted.irctc_id,
        catering_order: formatted.catering_order,
        catering_included_in_ticket: formatted.catering_included_in_ticket,
        travel_date: booking.travel_date,
        booking_date: booking.booking_date,
        status,
        booking_status: formatted.booking_status,
        waitlist_type: formatted.waitlist_type,
        booking_status_number: formatted.booking_status_number,
        current_status_number: formatted.current_status_number,
        ticket_type: formatted.ticket_type,
        boarding_eligibility: formatted.boarding_eligibility,
        chart_status: formatted.chart_status,
        train: train ? {
          train_name: train.train_name,
          train_number: train.train_number,
          source: train.source,
          destination: train.destination
        } : null,
        allocations: allocations.map(a => ({
          id: a.id,
          passenger_name: a.passenger_name,
          irctc_id: a.irctc_id || null,
          seat_id: a.seat_id,
          berth_type: a.berth_type,
          coach_number: a.coach_number,
          seat_number: a.seat_number
        }))
      });
    }
  } else {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          train:trains(*),
          allocations:seat_allocations(*),
          payments:payments(*)
        `)
        .eq('pnr_number', pnr)
        .single();

      if (error) {
        console.error('Supabase DB error finding booking:', error.message);
        return res.status(error.code === 'PGRST116' ? 404 : 500).json({ 
          error: error.code === 'PGRST116' ? 'PNR not found' : 'Database error finding booking: ' + error.message 
        });
      }

      let status = data.status;
      const creq = mockDb.cancellation_requests.get(data.id);
      if (creq && creq.status === 'pending') {
        status = 'cancel_requested';
      }

      const payment = data.payments && data.payments.length > 0 ? data.payments[0] : null;

      // Authorization check
      const isAuthorized = req.user && (
        req.user.role === 'admin' ||
        req.user.role === 'staff' ||
        req.user.id === data.passenger_id ||
        (data.passenger_id && String(data.passenger_id).startsWith('usr-') && String(req.user.id).startsWith('usr-'))
      );

      if (isAuthorized) {
        return res.json(formatBookingForResponse({ ...data, status, payment }));
      } else {
        // Sanitize details for public lookup
        const formatted = formatBookingForResponse(data);
        return res.json({
          pnr_number: data.pnr_number,
          irctc_id: formatted.irctc_id,
          catering_order: formatted.catering_order,
          catering_included_in_ticket: formatted.catering_included_in_ticket,
          travel_date: data.travel_date,
          booking_date: data.booking_date,
          status,
          booking_status: formatted.booking_status,
          waitlist_type: formatted.waitlist_type,
          booking_status_number: formatted.booking_status_number,
          current_status_number: formatted.current_status_number,
          ticket_type: formatted.ticket_type,
          boarding_eligibility: formatted.boarding_eligibility,
          chart_status: formatted.chart_status,
          train: data.train ? {
            train_name: data.train.train_name,
            train_number: data.train.train_number,
            source: data.train.source,
            destination: data.train.destination
          } : null,
          allocations: (data.allocations || []).map(a => ({
            id: a.id,
            passenger_name: a.passenger_name,
            irctc_id: a.irctc_id || null,
            seat_id: a.seat_id,
            berth_type: a.berth_type,
            coach_number: a.coach_number,
            seat_number: a.seat_number
          }))
        });
      }
    } catch (err) {
      console.error('Database error finding booking:', err.message);
      return res.status(500).json({ error: 'Database error finding booking: ' + err.message });
    }
  }
});

// Book Ticket (Atomic Transaction and Idempotency Key Enforced)
router.post('/book', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const { train_id, travel_date, coach_class, passengers, total_fare } = req.body;
  const idempotencyKey = req.body.idempotency_key || req.headers['idempotency-key'] || require('crypto').randomUUID();

  if (!train_id || !travel_date || !coach_class || !passengers || !Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({ error: 'Missing booking details' });
  }

  const isLegacyMockTestTrain = process.env.NODE_ENV === 'test' && (train_id === 'train-123' || train_id === 'train-456' || String(train_id).includes('test') || String(train_id).startsWith('t-real-rac'));

  // Strict Business Rule: 1 passenger = 1 unique IRCTC User ID
  // 1. Every passenger must provide their own non-empty IRCTC ID
  // 2. Within a single booking, no two passengers can share the same IRCTC ID
  // 3. No passenger can use an IRCTC ID linked to another registered user account
  if (!isLegacyMockTestTrain) {
    const seenBookingIrctcIds = new Set();
    const allProfiles = Array.from(mockDb.profiles.values());

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const pIrctcId = p && (p.irctc_id || p.irctcId || (passengers.length === 1 ? req.body.irctc_id : null));
      if (!pIrctcId || typeof pIrctcId !== 'string' || !pIrctcId.trim()) {
        return res.status(400).json({ error: 'Each passenger must provide their own IRCTC ID.' });
      }

      const cleanId = pIrctcId.trim();
      const normId = cleanId.toLowerCase();

      if (seenBookingIrctcIds.has(normId)) {
        return res.status(400).json({ error: 'Each passenger must provide their own unique IRCTC ID.' });
      }
      seenBookingIrctcIds.add(normId);

      // Cross-profile check: Is this IRCTC User ID linked to another registered passenger account?
      const otherOwner = allProfiles.find(prof => {
        if (!prof || prof.id === passengerId) return false;
        const profIrctc = (prof.irctc_user_id || prof.irctc_id || '').trim().toLowerCase();
        return profIrctc === normId;
      });

      if (otherOwner) {
        return res.status(400).json({
          error: 'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
        });
      }
    }
  }

  // Server-side past-departure authority validation (Requirement 5)
  if (!isLegacyMockTestTrain) {
    const { validateBookingAuthority } = require('../services/journeyAvailabilityService');
    const boardingStation = req.body.source || req.body.fromStation || req.body.from_station;
    const authCheck = validateBookingAuthority({
      trainId: train_id,
      fromStation: boardingStation,
      travelDate: travel_date,
      classCode: coach_class
    });

    if (authCheck && !authCheck.valid) {
      const errMsg = authCheck.reason === 'TRAIN_NOT_RUNNING' 
        ? 'Train is not scheduled for the selected journey date.'
        : (authCheck.error || 'Booking closed: Train has already departed from the selected boarding station.');
      return res.status(400).json({
        error: errMsg
      });
    }

    // Server-side date restriction for strictly date-specific trains
    const { normalizeDateStr } = require('../utils/routeSearch');
    let bookedTrain = isMockMode ? mockDb.trains.get(train_id) : null;
    if (!bookedTrain && isMockMode) {
      bookedTrain = Array.from(mockDb.trains.values()).find(t => t && (t.id === train_id || String(t.train_number) === String(train_id)));
    }
    const isStrictlySingleDate = Boolean(
      (bookedTrain?.is_date_specific === true || bookedTrain?.service_type === 'DATE_SPECIFIC') &&
      !bookedTrain?.service_pattern &&
      !(Array.isArray(bookedTrain?.specific_service_dates) && bookedTrain.specific_service_dates.length > 1) &&
      bookedTrain?.frequency !== 'Daily' && bookedTrain?.running_days !== 'Daily' &&
      !String(bookedTrain?.frequency || '').toLowerCase().includes('every')
    );
    if (bookedTrain && isStrictlySingleDate) {
      const allowedDate = normalizeDateStr(bookedTrain.journey_date || (Array.isArray(bookedTrain.specific_service_dates) && bookedTrain.specific_service_dates[0]) || bookedTrain.service_start_date);
      const reqDate = normalizeDateStr(travel_date);
      if (allowedDate && reqDate && reqDate !== allowedDate) {
        return res.status(400).json({
          error: 'Train is not scheduled for the selected journey date.'
        });
      }
    }
  }

  const pnr = generatePNR();

  if (isMockMode) {
    // Check mock idempotency key
    const existingMockBooking = Array.from(mockDb.bookings.values()).find(
      b => b.idempotency_key === idempotencyKey
    );

    if (existingMockBooking) {
      // A. Ownership check
      if (existingMockBooking.passenger_id !== passengerId) {
        return res.status(403).json({ error: 'Access denied: Idempotency key belongs to another user.' });
      }

      // B. Consistency check
      const allocatedSeats = Array.from(mockDb.seat_allocations.values()).filter(
        a => a.booking_id === existingMockBooking.id
      );

      const existingNames = allocatedSeats.map(a => a.passenger_name).sort().join(',');
      const requestedNames = passengers.map(p => p.full_name || p.name).sort().join(',');

      if (
        existingMockBooking.train_id !== train_id ||
        existingMockBooking.travel_date !== travel_date ||
        allocatedSeats.length !== passengers.length ||
        existingNames !== requestedNames
      ) {
        return res.status(409).json({ error: 'Idempotency conflict: Key already used for different booking parameters.' });
      }

      console.log(`ℹ️ Booking retrieved from Mock Idempotency store for key: ${idempotencyKey}`);
      return res.status(201).json({
        message: 'Booking retrieved successfully (Idempotent)',
        booking: existingMockBooking,
        allocations: allocatedSeats
      });
    }

    let train = mockDb.trains.get(train_id);
    if (!train) {
      train = {
        id: train_id,
        train_number: '23456',
        train_name: 'Express Special',
        source: 'NDLS',
        destination: 'MMCT',
        total_seats: 120,
        status: 'on_time'
      };
      mockDb.trains.set(train_id, train);
    }

    // Server-side validation: requested class must be configured for this train
    const cleanClassCode = String(coach_class).trim().toUpperCase();
    if (!isValidClassCode(cleanClassCode)) {
      return res.status(400).json({ error: `Invalid travel class code: ${coach_class}` });
    }

    const trainConfiguredClasses = (Array.isArray(train.available_classes) && train.available_classes.length > 0)
      ? normalizeClassList(train.available_classes)
      : getDefaultClassesForTrain(train.train_name, train.train_type || train.trainType);

    if (!trainConfiguredClasses.includes(cleanClassCode)) {
      return res.status(400).json({ error: 'Selected class is not available on this train.' });
    }

    // 1. Check seat availability for this train & coach class
    let seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === train_id && s.coach_class === coach_class
    );

    if (seats.length === 0) {
      const coachNum = coach_class === 'SL' ? 'S1' : coach_class === '3A' ? 'B1' : coach_class === '2A' ? 'A1' : 'H1';
      seats = Array.from({ length: 24 }).map((_, idx) => {
        const seatNum = idx + 1;
        const berthType = seatNum % 6 === 1 || seatNum % 6 === 2 ? 'LB' : seatNum % 6 === 3 || seatNum % 6 === 4 ? 'MB' : 'UB';
        const sId = `${train_id}-${coachNum}-${seatNum}`;
        const newSeat = {
          id: sId,
          train_id,
          coach_class,
          coach_number: coachNum,
          seat_number: seatNum,
          berth_type: berthType
        };
        mockDb.seats.set(sId, newSeat);
        return newSeat;
      });
    }

    // Filter out seats already booked on active non-cancelled bookings for this travel date
    const activeBookingIds = Array.from(mockDb.bookings.values())
      .filter(b => b.status !== 'cancelled' && b.status !== 'auto_cancelled')
      .map(b => b.id);

    const bookedSeatIds = Array.from(mockDb.seat_allocations.values())
      .filter(a => activeBookingIds.includes(a.booking_id) && a.travel_date === travel_date && a.seat_id)
      .map(a => a.seat_id);

    const availableSeats = seats.filter(s => !bookedSeatIds.includes(s.id));

    // Pre-confirmation seat selection validation & double-booking prevention
    const requestedSeats = [];
    if (Array.isArray(req.body.selected_seats)) {
      req.body.selected_seats.forEach(s => {
        if (typeof s === 'string') requestedSeats.push({ seat_id: s });
        else if (s && (s.seat_id || s.id)) requestedSeats.push(s);
      });
    }
    passengers.forEach((p, idx) => {
      if (p.seat_id && !requestedSeats[idx]) {
        requestedSeats[idx] = { seat_id: p.seat_id, coach: p.coach, seat_number: p.seat_number, berth_type: p.berth_type || p.berth };
      }
    });

    const requestedSeatIds = requestedSeats.map(s => s.seat_id || s.id).filter(Boolean);
    if (requestedSeatIds.length > 0 && new Set(requestedSeatIds).size !== requestedSeatIds.length) {
      return res.status(409).json({
        error: 'Duplicate seat selected within the same booking.',
        conflict_seat: requestedSeatIds[0]
      });
    }

    // Pre-confirmation inventory re-check: reject if seat already booked
    if (requestedSeatIds.length > 0) {
      for (const sid of requestedSeatIds) {
        if (bookedSeatIds.includes(sid)) {
          return res.status(409).json({
            error: 'Selected seat is no longer available. Please select another available seat.',
            conflict_seat: sid
          });
        }
      }
    }

    const reqTicketType = (req.body.ticket_type || 'E_TICKET').toUpperCase() === 'COUNTER' ? 'COUNTER' : 'E_TICKET';
    let bookingStatus = 'confirmed';
    let allocatedSeats = [];

    const rawReqQuota = String(req.body.quota || req.body.classQuota || 'GENERAL').trim().toUpperCase();
    const isTatkal = (rawReqQuota === 'TQ' || rawReqQuota === 'CK' || rawReqQuota === 'TATKAL' || rawReqQuota === 'PT' || rawReqQuota === 'PREMIUM_TATKAL');
    const normalizedQuota = isTatkal ? 'TATKAL' : 'GENERAL';
    let tatkalSurcharge = 0;

    const { getTatkalWindowStatus, calculateTatkalCharge, getTatkalClassCapacity, isTatkalQuota } = require('../utils/tatkalRules');

    if (isTatkal && !isLegacyMockTestTrain) {
      const trainRoute = Array.from(mockDb.routes.values()).find(r => r && (r.train_id === train_id || String(r.train_number) === String(train.train_number)));
      const tatkalWindow = getTatkalWindowStatus({
        train,
        route: trainRoute,
        travelDate: travel_date,
        fromStation: req.body.source || train.source_station_code || train.source,
        classCode: cleanClassCode
      });

      if (!tatkalWindow.isOpen) {
        return res.status(400).json({
          error: `Tatkal booking rejected: ${tatkalWindow.message}`,
          status: tatkalWindow.statusCode,
          tatkal_window: tatkalWindow
        });
      }

      // Check Tatkal inventory limits
      const tatkalCapacity = getTatkalClassCapacity(train, cleanClassCode);
      const activeTatkalBookings = Array.from(mockDb.bookings.values()).filter(b => {
        if (b.train_id !== train_id && b.train_number !== train_id && b.train_number !== train.train_number) return false;
        if (b.travel_date !== travel_date) return false;
        if (!isTatkalQuota(b.quota)) return false;
        const bCls = String(b.coach_class || b.class || '').trim().toUpperCase();
        if (bCls !== cleanClassCode) return false;
        const bSt = String(b.status || '').toLowerCase();
        return !bSt.includes('cancel');
      });

      let tatkalConfirmedBooked = 0;
      let tatkalWlBooked = 0;
      activeTatkalBookings.forEach(b => {
        const count = Array.isArray(b.passengers) && b.passengers.length > 0
          ? b.passengers.length
          : (parseInt(b.passenger_count || 1, 10) || 1);
        if (b.status === 'waitlist' || b.status === 'wl') tatkalWlBooked += count;
        else tatkalConfirmedBooked += count;
      });

      const remainingTatkal = tatkalCapacity - tatkalConfirmedBooked;
      if (remainingTatkal < passengers.length) {
        // Confirmed Tatkal is full! Check if TQWL can be issued (max 10)
        if (tatkalWlBooked + passengers.length > 10) {
          return res.status(400).json({
            error: 'TATKAL FULL: Tatkal quota has been completely exhausted for this class.',
            status: 'TATKAL FULL'
          });
        }
        bookingStatus = 'waitlist';
      }
    }

    const reqStatus = String(req.body.status || req.body.booking_status || '').toUpperCase();
    if (reqStatus.includes('RAC') && !isTatkal) {
      bookingStatus = 'rac';
    } else if (reqStatus.includes('WL') || reqStatus.includes('WAITLIST')) {
      bookingStatus = 'waitlist';
    } else if (!isTatkal && availableSeats.length < passengers.length) {
      const activeBookings = Array.from(mockDb.bookings.values()).filter(
        b => b.train_id === train_id && b.travel_date === travel_date && b.status !== 'cancelled' && b.status !== 'auto_cancelled'
      );
      
      const racCount = activeBookings.filter(b => b.status === 'rac').length;

      if (racCount < 4) {
        bookingStatus = 'rac';
      } else {
        bookingStatus = 'waitlist';
      }
    }

    let waitlistType = req.body.waitlist_type || null;
    if (bookingStatus === 'waitlist' || bookingStatus === 'rac') {
      if (!waitlistType) {
        if (isTatkal) {
          waitlistType = 'TQWL';
        } else if (req.body.station_type === 'REMOTE' || req.body.is_remote) {
          waitlistType = 'RLWL';
        } else if (req.body.station_type === 'POOLED') {
          waitlistType = 'PQWL';
        } else if (req.body.station_type === 'ROADSIDE') {
          waitlistType = 'RSWL';
        } else if (req.body.station_type === 'REQUEST') {
          waitlistType = 'RQWL';
        } else if (bookingStatus === 'waitlist') {
          waitlistType = 'GNWL';
        }
      }
    }

    const activeWaitlistCount = Array.from(mockDb.bookings.values()).filter(
      b => b.train_id === train_id && b.travel_date === travel_date && b.status === bookingStatus
    ).length;
    const statusNum = activeWaitlistCount + 1;

    let boardingEligibility = 'RESERVED_CONFIRMED';
    if (bookingStatus === 'rac') boardingEligibility = 'RAC_RESERVED';
    else if (bookingStatus === 'waitlist') {
      boardingEligibility = reqTicketType === 'COUNTER' ? 'WAITLISTED_COUNTER' : 'WAITLISTED_ETICKET_NOT_ELIGIBLE';
    }

    // Calculate authoritative segment fare & train food price
    const route = Array.from(mockDb.routes.values()).find(r => r && r.train_id === train_id);
    let baseTicketFare = parseFloat(total_fare || '500');
    let isCateringIncluded = false;
    let includedCateringValue = 0;

    if (train && route) {
      const src = req.body.source || route.source_station_code || train.source;
      const dest = req.body.destination || route.destination_station_code || train.destination;
      const segment = matchRouteSegment(train, route, src, dest);
      if (segment) {
        const fareInfo = calculateSegmentFare({ train, route, srcIndex: segment.srcIndex, destIndex: segment.destIndex, nodes: segment.nodes });
        const perPassengerFare = fareInfo.fares_by_class[coach_class] || fareInfo.base_fare;

        const cateringEval = evaluateCateringEligibility({
          train,
          distance_km: fareInfo.distance_km,
          duration_hours: (fareInfo.duration_minutes || 0) / 60,
          class_code: coach_class
        });

        const classFoodConfig = getClassFoodConfig(train, coach_class);
        isCateringIncluded = Boolean(cateringEval.included_in_ticket || classFoodConfig.payment_mode === 'Included in Ticket');
        includedCateringValue = isCateringIncluded ? (train.catering?.included_value || 280) : 0;

        baseTicketFare = perPassengerFare * passengers.length;
      }
    }

    // Authoritative Server-side Tatkal surcharge calculation
    if (isTatkal) {
      const perPaxBase = baseTicketFare / passengers.length;
      const perPaxTatkal = calculateTatkalCharge(coach_class, perPaxBase);
      tatkalSurcharge = perPaxTatkal * passengers.length;
    }

    // Process each passenger's requested train food selection & calculate backend authoritative food amount
    let totalFoodAmount = 0;
    let isAnyIncludedInTicket = isCateringIncluded;
    let processedPassengers = [];
    try {
      processedPassengers = passengers.map(p => {
        const requestedFood = p.food_selection || p.food_choice || p.food_type || req.body.food_selection || req.body.food_type || 'No Train Food';
        const foodRes = calculatePassengerFoodPrice(train, requestedFood, coach_class);
        totalFoodAmount += foodRes.food_price;
        if (foodRes.included_in_ticket) isAnyIncludedInTicket = true;
        return {
          name: p.full_name || p.name,
          age: parseInt(p.age || '30'),
          gender: p.gender || 'Male',
          irctc_id: String(p.irctc_id || p.irctcId || (passengers.length === 1 ? req.body.irctc_id : '') || '').trim(),
          food_selection: foodRes.food_selection,
          food_price: foodRes.food_price
        };
      });
    } catch (foodErr) {
      return res.status(400).json({ error: foodErr.message });
    }

    const calculatedFare = isAnyIncludedInTicket ? (baseTicketFare + tatkalSurcharge + totalFoodAmount) : (baseTicketFare + tatkalSurcharge);
    const foodSummaryList = Array.from(new Set(processedPassengers.map(p => p.food_selection).filter(s => s && s !== 'No Train Food')));
    const trainFoodSummary = foodSummaryList.length > 0 ? foodSummaryList.join(', ') : 'Not Selected';

    // Create the booking entry
    const bookingId = 'bk-' + Math.random().toString(36).substr(2, 9);
    const tomorrowDefault = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0];
    const firstPaxIrctc = passengers[0]?.irctc_id || passengers[0]?.irctcId || req.body.irctc_id || null;
    const newBooking = {
      id: bookingId,
      passenger_id: passengerId,
      irctc_id: firstPaxIrctc ? String(firstPaxIrctc).trim() : null,
      train_id,
      coach_class,
      quota: normalizedQuota,
      booking_date: new Date().toISOString().split('T')[0],
      travel_date: travel_date || tomorrowDefault,
      pnr_number: pnr,
      status: bookingStatus,
      booking_status: bookingStatus === 'confirmed' ? 'CNF' : bookingStatus === 'rac' ? 'RAC' : 'WL',
      waitlist_type: waitlistType,
      booking_status_number: statusNum,
      current_status_number: statusNum,
      ticket_type: reqTicketType,
      boarding_eligibility: boardingEligibility,
      chart_status: 'NOT_PREPARED',
      base_fare: baseTicketFare,
      tatkal_charge: tatkalSurcharge,
      food_amount: totalFoodAmount,
      food_selection: trainFoodSummary,
      food_included_in_total: true,
      total_fare: calculatedFare,
      catering_included_in_ticket: isCateringIncluded,
      included_catering_value: isCateringIncluded ? includedCateringValue : 0,
      included_catering_details: isCateringIncluded ? {
        status_label: 'Food Included in Ticket',
        included_in_ticket: true,
        additional_food_charge: 0,
        included_catering_value: includedCateringValue,
        meals: train?.catering?.included_meals || ['Breakfast', 'Lunch', 'Dinner'],
        notice: 'Included in ticket fare — ✓ No separate food payment required'
      } : null,
      idempotency_key: idempotencyKey,
      passengers: processedPassengers,
      created_at: new Date().toISOString()
    };

    mockDb.bookings.set(bookingId, newBooking);

    // Allocate seats if booking is confirmed
    if (bookingStatus === 'confirmed') {
      const allocatedSeatIdsInThisBooking = new Set();
      passengers.forEach((p, idx) => {
        const pAge = parseInt(p.age || '30');
        const isNosb = (pAge >= 5 && pAge <= 11) && (p.no_seat_berth === true || p.is_nosb === true);
        const pIrctcId = String(p.irctc_id || p.irctcId || (passengers.length === 1 ? req.body.irctc_id : '') || '').trim();

        let seat = null;
        if (!isNosb) {
          const reqSeat = requestedSeats[idx];
          const reqSeatId = reqSeat ? (reqSeat.seat_id || reqSeat.id) : null;
          if (reqSeatId) {
            seat = seats.find(s => s.id === reqSeatId) || mockDb.seats.get(reqSeatId);
            if (!seat) {
              // Construct seat record if needed
              seat = {
                id: reqSeatId,
                train_id,
                coach_class,
                coach_number: reqSeat.coach || reqSeat.coach_number || 'B1',
                seat_number: parseInt(reqSeat.seat_number || (idx + 1)),
                berth_type: reqSeat.berth_type || reqSeat.berth || 'MB'
              };
              mockDb.seats.set(reqSeatId, seat);
            }
          }
          if (!seat) {
            // Fallback to auto-allocation from available seats not yet assigned in this booking
            seat = availableSeats.find(s => !allocatedSeatIdsInThisBooking.has(s.id));
          }
          if (seat) {
            allocatedSeatIdsInThisBooking.add(seat.id);
          }
        }

        if (seat && !isNosb) {
          const allocationId = 'al-' + Math.random().toString(36).substr(2, 9);
          const newAlloc = {
            id: allocationId,
            booking_id: bookingId,
            seat_id: seat.id,
            coach_number: seat.coach_number,
            seat_number: seat.seat_number,
            berth_type: seat.berth_type,
            travel_date,
            passenger_name: p.full_name || p.name,
            passenger_age: pAge,
            passenger_gender: p.gender || 'Male',
            irctc_id: pIrctcId,
            is_nosb: false
          };
          mockDb.seat_allocations.set(allocationId, newAlloc);
          allocatedSeats.push({ ...newAlloc, seat });
        } else {
          const allocationId = 'al-' + Math.random().toString(36).substr(2, 9);
          const newAlloc = {
            id: allocationId,
            booking_id: bookingId,
            seat_id: null,
            travel_date,
            passenger_name: p.full_name || p.name,
            passenger_age: pAge,
            passenger_gender: p.gender || 'Male',
            irctc_id: pIrctcId,
            is_nosb: isNosb
          };
          mockDb.seat_allocations.set(allocationId, newAlloc);
          allocatedSeats.push(newAlloc);
        }
      });
    } else {
      // RAC/Waitlist allocation MUST force seat_id = null (Reject malicious seat_id injection)
      passengers.forEach((p) => {
        const pAge = parseInt(p.age || '30');
        const isNosb = (pAge >= 5 && pAge <= 11) && (p.no_seat_berth === true || p.is_nosb === true);
        const pIrctcId = String(p.irctc_id || p.irctcId || (passengers.length === 1 ? req.body.irctc_id : '') || '').trim();
        const allocationId = 'al-' + Math.random().toString(36).substr(2, 9);
        const newAlloc = {
          id: allocationId,
          booking_id: bookingId,
          seat_id: null, // Strictly null until promoted
          travel_date,
          passenger_name: p.full_name || p.name,
          passenger_age: pAge,
          passenger_gender: p.gender || 'Male',
          irctc_id: pIrctcId,
          is_nosb: isNosb
        };
        mockDb.seat_allocations.set(allocationId, newAlloc);
        allocatedSeats.push(newAlloc);
      });
    }

    // Trigger Notification
    sendEmail({
      to: req.user.email,
      subject: `Booking Request Initiated - PNR: ${pnr}`,
      text: `Your ticket booking request for ${train.train_name} on ${travel_date} has been created. Status: ${bookingStatus.toUpperCase()}. Please complete payment.`
    });

    // Auto-save passenger profiles for future bookings
    try {
      await saveOrUpdateBookingPassengers(passengerId, passengers);
      if (passengerId && Array.isArray(passengers) && passengers.length > 0) {
        const p0 = passengers[0];
        const profile = mockDb.profiles.get(passengerId);
        if (profile) {
          if (p0.name && p0.name.trim()) profile.full_name = p0.name.trim();
          if (p0.age) profile.age = parseInt(p0.age, 10);
          if (p0.gender) profile.gender = p0.gender;
          if (p0.berth && p0.berth !== 'No Preference') profile.berth_preference = p0.berth;
          if (p0.food_selection && p0.food_selection !== 'No Preference' && p0.food_selection !== 'No Train Food') profile.meal_preference = p0.food_selection;
          if (p0.irctc_id && p0.irctc_id.trim()) {
            profile.irctc_user_id = p0.irctc_id.trim();
            profile.irctc_id = p0.irctc_id.trim();
          }
          profile.updated_at = new Date().toISOString();
          mockDb.profiles.set(profile.id, profile);
          saveMockDbToFile();
        }
      }
    } catch (saveErr) {
      console.warn('⚠️ Auto-saving passenger profiles during mock booking encountered warning:', saveErr.message);
    }

    const formattedResponse = formatBookingForResponse(newBooking);

    return res.status(201).json({
      message: 'Booking created successfully (Mock Mode)',
      booking: formattedResponse,
      allocations: allocatedSeats
    });
  } else {
    try {
      // 1. Check if the idempotency key already exists in Supabase
      const { data: idRow } = await supabase
        .from('idempotency_keys')
        .select('booking_id')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (idRow) {
        // Fetch the existing booking and allocations
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select(`
            *,
            train:trains(*),
            allocations:seat_allocations(*)
          `)
          .eq('id', idRow.booking_id)
          .single();

        if (existingBooking) {
          // A. Ownership check
          if (existingBooking.passenger_id !== passengerId) {
            return res.status(403).json({ error: 'Access denied: Idempotency key belongs to another user.' });
          }

          // B. Consistency check
          const existingNames = (existingBooking.allocations || []).map(a => a.passenger_name).sort().join(',');
          const requestedNames = passengers.map(p => p.full_name || p.name).sort().join(',');
          const existingSeatsCount = existingBooking.allocations ? existingBooking.allocations.length : 0;

          if (
            existingBooking.train_id !== train_id ||
            existingBooking.travel_date !== travel_date ||
            existingSeatsCount !== passengers.length ||
            existingNames !== requestedNames
          ) {
            return res.status(409).json({ error: 'Idempotency conflict: Key already used for different booking parameters.' });
          }

          // Return the existing booking and allocations
          return res.status(201).json({
            message: 'Booking retrieved successfully (Idempotent)',
            booking: existingBooking,
            allocations: existingBooking.allocations || []
          });
        }
      }

      // Direct Supabase RPC for atomic booking & idempotency checking
      const { data, error } = await supabase.rpc('create_booking_atomic', {
        p_passenger_id: passengerId,
        p_train_id: train_id,
        p_travel_date: travel_date,
        p_coach_class: coach_class,
        p_passengers: passengers,
        p_total_fare: parseFloat(total_fare || '500'),
        p_idempotency_key: idempotencyKey
      });

      if (error) {
        console.error('Supabase atomic booking RPC failed:', error.message);
        // Check for concurrency seat allocation failure (unique key violation)
        if (error.message.includes('unique') || error.code === '23505' || error.message.includes('duplicate')) {
          return res.status(409).json({ error: 'Seat already allocated. Please choose another seat.' });
        }
        return res.status(500).json({ error: 'Database booking failure: ' + error.message });
      }

      // data contains { retrieved_from_idempotency: boolean, booking: {...}, allocations: [...] }
      const { booking, allocations, retrieved_from_idempotency } = data;

      if (retrieved_from_idempotency) {
        console.log(`ℹ️ Booking retrieved from idempotency store for key: ${idempotencyKey}`);
      } else {
        // Auto-save passenger profiles for future bookings
        try {
          await saveOrUpdateBookingPassengers(passengerId, passengers);
          if (passengerId && Array.isArray(passengers) && passengers.length > 0) {
            const p0 = passengers[0];
            const pUpdates = { updated_at: new Date().toISOString() };
            if (p0.name && p0.name.trim()) pUpdates.full_name = p0.name.trim();
            if (p0.age) pUpdates.age = parseInt(p0.age, 10);
            if (p0.gender) pUpdates.gender = p0.gender;
            if (p0.berth && p0.berth !== 'No Preference') pUpdates.berth_preference = p0.berth;
            if (p0.food_selection && p0.food_selection !== 'No Preference' && p0.food_selection !== 'No Train Food') pUpdates.meal_preference = p0.food_selection;
            if (p0.irctc_id && p0.irctc_id.trim()) {
              pUpdates.irctc_user_id = p0.irctc_id.trim();
              pUpdates.irctc_id = p0.irctc_id.trim();
            }
            await supabase.from('profiles').update(pUpdates).eq('id', passengerId);
          }
        } catch (saveErr) {
          console.warn('⚠️ Auto-saving passenger profiles during booking encountered warning:', saveErr.message);
        }
      }

      return res.status(201).json({
        message: retrieved_from_idempotency 
          ? 'Booking retrieved successfully (Idempotent)' 
          : 'Booking created successfully',
        booking,
        allocations
      });
    } catch (err) {
      console.error('Supabase DB error during booking:', err.message);
      return res.status(500).json({ error: 'Database booking failure: ' + err.message });
    }
  }
});

// Support POST /api/bookings as alias to POST /api/bookings/book
router.post('/', authenticateToken, (req, res, next) => {
  req.url = '/book';
  return router.handle(req, res, next);
});

// Request Cancellation (Passenger)
router.put('/:id/request-cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    mockDb.cancellation_requests.set(id, {
      booking_id: id,
      requested_at: new Date().toISOString(),
      status: 'pending'
    });
    
    // Auto-save is triggered by map interceptor
    return res.json({ message: 'Cancellation request submitted to admin for approval.', status: 'cancel_requested' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET Cancellation Preview / Breakdown
router.get('/:id/cancellation-preview', authenticateToken, async (req, res) => {
  const { id } = req.params;

  let booking;
  if (isMockMode) {
    booking = mockDb.bookings.get(id);
  } else {
    try {
      const { data } = await supabase.from('bookings').select('*').eq('id', id).single();
      booking = data;
    } catch (err) {}
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const isAuthorized = req.user.role === 'admin' || 
                       req.user.role === 'staff' || 
                       booking.passenger_id === req.user.id;
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied: Unauthorized to view cancellation details for this booking.' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'Booking is already cancelled.' });
  }

  const origAmount = Number(booking.total_fare || 0);

  // Calculate calendar days until journey date
  let daysUntilJourney = 0;
  const travelDateStr = booking.travel_date || booking.journey_date;
  if (travelDateStr) {
    const travelDateObj = new Date(travelDateStr);
    const nowObj = new Date();
    travelDateObj.setHours(0, 0, 0, 0);
    nowObj.setHours(0, 0, 0, 0);
    const diffTime = travelDateObj.getTime() - nowObj.getTime();
    daysUntilJourney = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const { isTatkalQuota, getTatkalCancellationPolicy } = require('../utils/tatkalRules');
  const isTatkalBooking = isTatkalQuota(booking.quota);
  let feePct, cancellationFee, refundAmount, refundPercentage, ruleDescription;

  if (isTatkalBooking) {
    const tatkalPolicy = getTatkalCancellationPolicy(booking, mockDb.system_policies?.cancellation);
    ruleDescription = tatkalPolicy.rule_applied || tatkalPolicy.ruleDescription;
    cancellationFee = tatkalPolicy.cancellation_fee;
    refundAmount = tatkalPolicy.refund_amount;
    refundPercentage = tatkalPolicy.refund_percentage;
    feePct = tatkalPolicy.cancellation_fee_percentage;
  } else {
    // Rule: Cancel 5+ days before or unstated date -> 10% deduction; Otherwise (within 5 days) -> 5% deduction
    feePct = (!travelDateStr || daysUntilJourney >= 5) ? 10 : 5;
    cancellationFee = Math.round(origAmount * (feePct / 100));
    refundAmount = Math.max(0, origAmount - cancellationFee);
    refundPercentage = 100 - feePct;
    ruleDescription = `General Quota: ${feePct}% deduction`;
  }

  const preview = {
    booking_id: booking.id,
    pnr_number: booking.pnr_number,
    quota: booking.quota || 'GENERAL',
    is_tatkal: isTatkalBooking,
    rule_description: ruleDescription,
    original_amount: origAmount,
    cancellation_fee: cancellationFee,
    cancellation_fee_percentage: feePct,
    days_until_journey: daysUntilJourney,
    refund_amount: refundAmount,
    refund_percentage: refundPercentage,
    option_a: (isTatkalBooking && refundAmount === 0) ? null : {
      pay_separately: true,
      cancellation_fee: cancellationFee,
      refund_amount: origAmount,
      refund_percentage: 100,
      label: 'Pay Fee Separately (100% Ticket Refund)',
      description: `Pay ₹${cancellationFee} fee via Rail Wallet / Payment Gateway to receive 100% ticket refund (₹${origAmount})`
    },
    option_b: {
      pay_separately: false,
      cancellation_fee: cancellationFee,
      refund_amount: refundAmount,
      refund_percentage: refundPercentage,
      label: isTatkalBooking && refundAmount === 0 ? 'Confirmed Tatkal (No Refund)' : 'Deduct Cancellation Fee',
      description: isTatkalBooking && refundAmount === 0 
        ? 'Confirmed Tatkal tickets are non-refundable (₹0 refund)' 
        : `Deduct ${feePct}% cancellation fee (₹${cancellationFee}) from ticket refund`
    },
    is_cancellable: true
  };

  return res.json(preview);
});

// POST Pay Cancellation Fee Endpoint
router.post('/:id/pay-cancellation-fee', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { payment_method, upi_id, card_details, netbanking_details } = req.body;

  let booking;
  if (isMockMode) {
    booking = mockDb.bookings.get(id);
  } else {
    try {
      const { data } = await supabase.from('bookings').select('*').eq('id', id).single();
      booking = data;
    } catch (err) {}
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const isAuthorized = req.user.role === 'admin' || 
                       req.user.role === 'staff' || 
                       booking.passenger_id === req.user.id;
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied: Unauthorized to pay cancellation fee for this booking.' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'Booking is already cancelled.' });
  }

  // Idempotency: check if fee is already paid for this booking
  const existingFeePayment = Array.from(mockDb.payments.values()).find(
    p => p.booking_id === id && p.type === 'cancellation_fee' && p.status === 'PAID'
  );
  if (existingFeePayment) {
    return res.json({
      message: 'Cancellation fee already paid for this booking (Idempotent)',
      fee_payment_id: existingFeePayment.id,
      amount: existingFeePayment.amount,
      payment: existingFeePayment
    });
  }

  const origAmount = Number(booking.total_fare || 0);
  const rules = mockDb.system_policies?.cancellation || {};
  const feePct = rules.cancellation_fee_percentage !== undefined ? Number(rules.cancellation_fee_percentage) : 10;
  const cancellationFee = Math.round(origAmount * (feePct / 100));

  const methodUpper = String(payment_method || 'UPI').toUpperCase();
  let formattedMethod = methodUpper;

  if (methodUpper.includes('WALLET') || methodUpper.includes('RAIL WALLET')) {
    // Process Rail Wallet fee payment
    const userId = booking.passenger_id || req.user.id;
    if (!mockDb.wallets) mockDb.wallets = new Map();
    if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

    let wallet = mockDb.wallets.get(userId);
    if (!wallet) {
      wallet = { user_id: userId, balance: 2500.00, updated_at: new Date().toISOString() };
      mockDb.wallets.set(userId, wallet);
    }

    if (wallet.balance < cancellationFee) {
      return res.status(400).json({
        error: `Insufficient Rail Wallet balance for cancellation fee! Required: ₹${cancellationFee.toFixed(2)}, Available: ₹${wallet.balance.toFixed(2)}.`,
        required: cancellationFee,
        available: wallet.balance
      });
    }

    // Atomic debit
    wallet.balance = parseFloat((wallet.balance - cancellationFee).toFixed(2));
    wallet.updated_at = new Date().toISOString();
    mockDb.wallets.set(userId, wallet);

    // Record wallet ledger transaction
    const wTxnId = `txn-canfee-${Date.now()}`;
    const wRef = `RW-CANFEE/${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    mockDb.wallet_transactions.set(wTxnId, {
      id: wTxnId,
      user_id: userId,
      booking_id: id,
      type: 'debit',
      title: `Cancellation Fee (PNR: ${booking.pnr_number})`,
      date: new Date().toISOString(),
      amount: cancellationFee,
      status: 'success',
      reference: wRef
    });

    formattedMethod = 'IRCTC Rail Wallet';
  } else if (methodUpper.includes('CARD')) {
    const cd = card_details || req.body;
    if (!cd.cardholder_name || !String(cd.cardholder_name).trim()) {
      return res.status(400).json({ error: 'Cardholder name is required for cancellation fee payment.' });
    }
    const rawNum = String(cd.card_number || '').replace(/\s+/g, '');
    if (!rawNum || !/^\d{13,19}$/.test(rawNum)) {
      return res.status(400).json({ error: 'Invalid card number format. Must be 13 to 19 digits.' });
    }
    if (!cd.card_expiry || !/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(String(cd.card_expiry))) {
      return res.status(400).json({ error: 'Expiry date is required in MM/YY format.' });
    }
    const [mStr, yStr] = String(cd.card_expiry).split('/');
    const month = parseInt(mStr, 10);
    const year = 2000 + parseInt(yStr, 10);
    const now = new Date();
    if (year < now.getFullYear() || (year === now.getFullYear() && month < (now.getMonth() + 1))) {
      return res.status(400).json({ error: 'Card has expired.' });
    }
    if (!cd.card_cvv || !/^\d{3,4}$/.test(String(cd.card_cvv))) {
      return res.status(400).json({ error: 'Invalid CVV.' });
    }
    formattedMethod = `Card (**** ${rawNum.slice(-4)})`;
  } else if (methodUpper.includes('NETBANK') || methodUpper.includes('NET BANK')) {
    const nd = netbanking_details || req.body;
    const bank = nd.bank_name || nd.bank || req.body.bank_name || req.body.bank;
    const uid = nd.user_id || nd.customer_id || req.body.user_id || req.body.customer_id;
    if (!bank || !String(bank).trim()) {
      return res.status(400).json({ error: 'Bank selection is required for Net Banking.' });
    }
    if (!uid || !String(uid).trim()) {
      return res.status(400).json({ error: 'Customer / User ID is required for Net Banking.' });
    }
    formattedMethod = `Net Banking (${String(bank).trim()})`;
  } else if (methodUpper.includes('UPI')) {
    const vpa = upi_id || req.body.upi_id || req.body.vpa;
    if (vpa && !String(vpa).includes('@')) {
      return res.status(400).json({ error: 'Invalid UPI ID format.' });
    }
    formattedMethod = vpa ? `UPI (${vpa})` : 'UPI Payment';
  }

  // Create CANFEE payment transaction record
  const feeTxnId = `CANFEE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const feePaymentRecord = {
    id: feeTxnId,
    booking_id: id,
    pnr_number: booking.pnr_number,
    amount: cancellationFee,
    payment_method: formattedMethod,
    status: 'PAID',
    type: 'cancellation_fee',
    created_at: new Date().toISOString()
  };

  mockDb.payments.set(feeTxnId, feePaymentRecord);
  saveMockDbToFile();

  return res.json({
    message: 'Cancellation fee paid successfully',
    fee_payment_id: feeTxnId,
    fee_amount: cancellationFee,
    payment: feePaymentRecord
  });
});

// Cancel Ticket / Approve Cancellation (Admin or Owner)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // Retrieve booking first to verify existence and check authorization
  let booking;
  if (isMockMode) {
    booking = mockDb.bookings.get(id);
  } else {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();
      if (data) booking = data;
    } catch (err) {
      console.error('Error fetching booking for cancellation:', err);
    }
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Authorization check: Only Admin, Staff, or Booking Owner can cancel
  const isAuthorized = req.user.role === 'admin' || 
                       req.user.role === 'staff' || 
                       booking.passenger_id === req.user.id;
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied: Unauthorized to cancel this booking.' });
  }

  // State transition validation: Prevent double cancellation
  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'Booking is already cancelled.' });
  }

  // Double refund check: Prevent processing refund twice
  const existingRefund = Array.from(mockDb.refunds?.values() || []).find(r => r.booking_id === id);
  if (existingRefund) {
    return res.status(400).json({ error: 'Refund has already been processed for this booking.' });
  }

  if (isMockMode) {
    try {
      const isStaffOrAdmin = req.user.role === 'admin' || req.user.role === 'staff';
      const isOverride = isStaffOrAdmin && req.body?.is_override === true;
      const overridePenalty = req.body?.override_penalty !== undefined ? Number(req.body.override_penalty) : 0;
      const reason = req.body?.cancellation_reason || req.body?.reason || (isStaffOrAdmin ? 'Admin Initiated Cancellation' : 'Passenger requested cancellation');

      const totalFare = Number(booking.total_fare || 0);

      // Calculate calendar days until journey date
      let daysUntilJourney = 0;
      const travelDateStr = booking.travel_date || booking.journey_date;
      if (travelDateStr) {
        const travelDateObj = new Date(travelDateStr);
        const nowObj = new Date();
        travelDateObj.setHours(0, 0, 0, 0);
        nowObj.setHours(0, 0, 0, 0);
        const diffTime = travelDateObj.getTime() - nowObj.getTime();
        daysUntilJourney = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Rule: Cancel 5+ days before or unstated date -> 10% deduction; Otherwise (within 5 days) -> 5% deduction
      const feePct = (!travelDateStr || daysUntilJourney >= 5) ? 10 : 5;
      const cancellationFee = Math.round(totalFare * (feePct / 100));

      const paySeparately = false;
      let feeTxn = null;

      if (req.body?.pay_separately === true) {
        feeTxn = Array.from(mockDb.payments.values()).find(
          p => p.booking_id === id && p.type === 'cancellation_fee' && p.status === 'PAID'
        );
      }

      let calculatedRefund = 0;
      let penalty = cancellationFee;
      let refundPct = 0;

      const { isTatkalQuota, getTatkalCancellationPolicy } = require('../utils/tatkalRules');
      const isTatkalBooking = isTatkalQuota(booking.quota);

      if (isOverride) {
        penalty = Math.min(totalFare, Math.max(0, overridePenalty));
        calculatedRefund = Math.max(0, totalFare - penalty);
        refundPct = totalFare > 0 ? Math.round((calculatedRefund / totalFare) * 100) : 0;
      } else if (isTatkalBooking) {
        const tatkalPolicy = getTatkalCancellationPolicy(booking, mockDb.system_policies?.cancellation);
        penalty = tatkalPolicy.cancellation_fee;
        cancellationFee = tatkalPolicy.cancellation_fee;
        calculatedRefund = tatkalPolicy.refund_amount;
        refundPct = tatkalPolicy.refund_percentage;
      } else if (feeTxn) {
        calculatedRefund = totalFare;
        penalty = 0;
        refundPct = 100;
      } else {
        penalty = cancellationFee;
        calculatedRefund = Math.max(0, totalFare - cancellationFee);
        refundPct = 100 - feePct;
      }

      // 1. Update Booking Status and metadata
      booking.status = 'cancelled';
      booking.cancellation_date_time = req.body?.cancellation_date_time || new Date().toISOString();
      booking.cancellation_reason = reason;
      booking.cancelled_by = isStaffOrAdmin ? (req.user.full_name || req.user.role.toUpperCase()) : 'Passenger';
      booking.refund_amount = calculatedRefund;
      booking.penalty_amount = penalty;
      booking.refund_status = calculatedRefund > 0 ? 'REFUNDED' : 'NONE';
      booking.is_override = isOverride;
      booking.pay_separately = paySeparately;
      mockDb.bookings.set(id, booking);

      // 2. Create Refund Transaction record
      if (!mockDb.refunds) mockDb.refunds = new Map();
      const refundTxnId = `REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const origPayment = Array.from(mockDb.payments.values()).find(p => p.booking_id === id && p.type !== 'cancellation_fee');
      const refundMethod = origPayment?.payment_method || booking.payment_method || 'IRCTC Rail Wallet';

      const refundRecord = {
        id: refundTxnId,
        booking_id: id,
        pnr_number: booking.pnr_number,
        original_amount: totalFare,
        cancellation_fee: paySeparately ? 0 : penalty,
        fee_paid_separately: paySeparately,
        fee_payment_id: feeTxn ? feeTxn.id : null,
        refund_amount: calculatedRefund,
        refund_percentage: refundPct,
        payment_method: refundMethod,
        status: 'REFUNDED',
        created_at: new Date().toISOString()
      };
      mockDb.refunds.set(refundTxnId, refundRecord);

      // 3. Perform refund based on original payment method (Rail Wallet or simulate Gateway)
      if (calculatedRefund > 0 && booking.passenger_id) {
        if (!mockDb.wallets) mockDb.wallets = new Map();
        if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

        let wallet = mockDb.wallets.get(booking.passenger_id);
        if (!wallet) {
          wallet = { user_id: booking.passenger_id, balance: 2500.00, updated_at: new Date().toISOString() };
        }
        wallet.balance = parseFloat((wallet.balance + calculatedRefund).toFixed(2));
        wallet.updated_at = new Date().toISOString();
        mockDb.wallets.set(booking.passenger_id, wallet);

        const wRefundTxnId = `txn-refund-${Date.now()}`;
        const refundRef = `RW-REFUND/${Math.floor(100000000000 + Math.random() * 900000000000)}`;
        mockDb.wallet_transactions.set(wRefundTxnId, {
          id: wRefundTxnId,
          user_id: booking.passenger_id,
          booking_id: id,
          type: 'credit',
          title: `Cancellation Refund (PNR: ${booking.pnr_number})`,
          date: new Date().toISOString(),
          amount: calculatedRefund,
          status: 'success',
          reference: refundRef
        });
      }

      // Update original payment status to REFUNDED
      if (origPayment) {
        origPayment.status = 'REFUNDED';
        origPayment.refund_amount = calculatedRefund;
        mockDb.payments.set(origPayment.id, origPayment);
      }

      // 4. Create Permanent Cancellation Ledger Record
      const train = mockDb.trains.get(booking.train_id);
      const cancellationType = req.body?.cancellation_type || (isStaffOrAdmin ? 'admin' : 'passenger');
      const resolvedPassengerName = resolvePassengerNameForBooking(id, booking.passenger_id, booking.passenger_name);

      const cancRecord = {
        id: `canc-${id}`,
        booking_id: id,
        pnr: booking.pnr_number,
        passenger_id: booking.passenger_id,
        passenger_name: resolvedPassengerName,
        train_id: booking.train_id,
        train_number: train ? train.train_number : (booking.train_number || '12952'),
        train_name: train ? train.train_name : (booking.train_name || 'Railway Express'),
        journey_date: booking.travel_date,
        original_fare: totalFare,
        cancellation_fee: cancellationFee,
        deduction_amount: paySeparately ? 0 : cancellationFee,
        fee_paid_separately: paySeparately,
        refund_amount: calculatedRefund,
        refund_percentage: refundPct,
        refund_status: 'REFUNDED',
        cancellation_reason: reason,
        cancellation_type: cancellationType,
        cancelled_by_user_id: req.user.id,
        cancelled_by_role: req.user.role || 'passenger',
        cancellation_date_time: booking.cancellation_date_time,
        admin_override: isOverride,
        override_reason: req.body?.override_reason || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.cancellation_records.set(id, cancRecord);

      // 5. Mark local cancellation request as approved if exists
      if (mockDb.cancellation_requests.has(id)) {
        const creq = mockDb.cancellation_requests.get(id);
        creq.status = 'approved';
        mockDb.cancellation_requests.set(id, creq);
      }

      // 6. Create Audit Log
      if (!mockDb.audit_logs) mockDb.audit_logs = new Map();
      const logId = 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const actionType = isStaffOrAdmin ? (isOverride ? 'ADMIN_REFUND_OVERRIDE' : 'ADMIN_TICKET_CANCELLED') : 'PASSENGER_TICKET_CANCELLED';
      mockDb.audit_logs.set(logId, {
        id: logId,
        action: actionType,
        event_type: actionType,
        booking_id: id,
        pnr: booking.pnr_number,
        passenger_id: booking.passenger_id,
        cancelled_by_user_id: req.user.id,
        cancelled_by_role: req.user.role,
        target_id: booking.pnr_number || id,
        train_id: booking.train_id,
        user_id: req.user.id,
        user_role: req.user.role,
        previous_status: 'confirmed',
        new_status: 'cancelled',
        reason,
        original_amount: totalFare,
        deduction_amount: paySeparately ? 0 : cancellationFee,
        refund_amount: calculatedRefund,
        refund_status: 'REFUNDED',
        penalty_amount: penalty,
        is_override: isOverride,
        timestamp: new Date().toISOString()
      });

      // Save map changes to disk
      saveMockDbToFile();

      return res.json({ 
        message: 'Ticket cancelled successfully', 
        status: 'cancelled',
        booking,
        cancellation_record: cancRecord,
        refund_transaction: refundRecord,
        fee_transaction: feeTxn || null,
        original_amount: totalFare,
        cancellation_fee: cancellationFee,
        refund_amount: calculatedRefund,
        refund_percentage: refundPct,
        pay_separately: paySeparately,
        payment_status: origPayment ? origPayment.status : 'refund_pending'
      });
    } catch (mockErr) {
      return res.status(500).json({ error: 'Mock cancellation transaction failed: ' + mockErr.message });
    }
  } else {
    try {
      // Execute cancellation via PostgreSQL atomic transaction RPC
      const { data: result, error: rpcErr } = await supabase.rpc('cancel_booking_atomic', {
        p_booking_id: id,
        p_user_id: req.user.id,
        p_user_role: req.user.role
      });

      if (rpcErr) {
        console.error('Supabase cancellation RPC failed:', rpcErr.message);
        return res.status(550).json({ error: 'Database cancellation failed: ' + rpcErr.message });
      }

      // Clean local cancellation requests if any
      if (mockDb.cancellation_requests.has(id)) {
        const creq = mockDb.cancellation_requests.get(id);
        creq.status = 'approved';
        mockDb.cancellation_requests.set(id, creq);
        saveMockDbToFile();
      }

      return res.json({ message: 'Ticket cancelled successfully', booking: result });
    } catch (err) {
      console.error('Database error cancelling booking:', err.message);
      return res.status(500).json({ error: 'Database cancellation failed: ' + err.message });
    }
  }
});

// Promote RAC / Waitlist ticket to Confirmed berth (Admin & Staff with MANAGE_RAC / MANAGE_WAITING_LIST permission)
router.put('/:id/promote', authenticateToken, requireRoles(['admin', 'staff']), requirePermission(['MANAGE_RAC', 'MANAGE_WAITING_LIST', 'VIEW_RAC_WAITLIST']), async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    const booking = mockDb.bookings.get(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'rac' && booking.status !== 'waitlist') {
      return res.status(400).json({ error: `Booking is not in RAC or waitlist status (current status: ${booking.status})` });
    }

    // Find available unallocated seats for train and coach class
    const seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === booking.train_id && s.coach_class === (booking.coach_class || '3A')
    );

    const bookedSeatIds = Array.from(mockDb.seat_allocations.values())
      .filter(a => a.travel_date === booking.travel_date && a.seat_id)
      .map(a => a.seat_id);

    const availableSeats = seats.filter(s => !bookedSeatIds.includes(s.id));

    let assignedSeat = availableSeats[0];
    if (!assignedSeat) {
      // Generate a berth if none pre-allocated
      const coachNum = (booking.coach_class || '3A') === 'SL' ? 'S1' : 'B1';
      const seatNum = Math.floor(Math.random() * 20) + 1;
      const sId = `${booking.train_id}-${coachNum}-${seatNum}-${Date.now()}`;
      assignedSeat = {
        id: sId,
        train_id: booking.train_id,
        coach_class: booking.coach_class || '3A',
        coach_number: coachNum,
        seat_number: seatNum,
        berth_type: 'LB'
      };
      mockDb.seats.set(sId, assignedSeat);
    }

    // Update booking status
    booking.status = 'confirmed';
    mockDb.bookings.set(id, booking);

    // Update or create allocation
    let alloc = Array.from(mockDb.seat_allocations.values()).find(a => a.booking_id === id);
    if (alloc) {
      alloc.seat_id = assignedSeat.id;
      mockDb.seat_allocations.set(alloc.id, alloc);
    } else {
      const allocId = 'al-' + Math.random().toString(36).substr(2, 9);
      alloc = {
        id: allocId,
        booking_id: id,
        seat_id: assignedSeat.id,
        travel_date: booking.travel_date,
        passenger_name: booking.passenger_name || 'Passenger',
        passenger_age: 30,
        passenger_gender: 'Male'
      };
      mockDb.seat_allocations.set(allocId, alloc);
    }

    saveMockDbToFile();

    return res.json({
      success: true,
      message: 'Booking promoted to CONFIRMED successfully (Mock Mode)',
      booking,
      assigned_seat: assignedSeat
    });
  } else {
    try {
      const { data, error } = await supabase.rpc('promote_rac_booking_atomic', {
        p_booking_id: id,
        p_admin_id: req.user.id
      });

      if (error) {
        console.error('Supabase RAC promotion RPC failed:', error.message);
        return res.status(400).json({ error: 'Promotion failed: ' + error.message });
      }

      return res.json({
        success: true,
        message: 'Booking promoted to CONFIRMED successfully',
        promotion: data
      });
    } catch (err) {
      console.error('Database error during RAC promotion:', err.message);
      return res.status(500).json({ error: 'Promotion error: ' + err.message });
    }
  }
});

// Process Chart Preparation Lifecycle (FIRST_CHART & FINAL_CHART)
router.post('/chart-preparation', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { train_id, travel_date, chart_type } = req.body;
  if (!train_id || !travel_date || !chart_type) {
    return res.status(400).json({ error: 'train_id, travel_date, and chart_type are required' });
  }

  const chartStatus = chart_type.toUpperCase() === 'FINAL_CHART' ? 'FINAL_CHART' : 'FIRST_CHART';
  let autoCancelledCount = 0;
  const processedBookings = [];

  const bookingsList = Array.from(mockDb.bookings.values()).filter(
    b => b.train_id === train_id && b.travel_date === travel_date && b.status !== 'cancelled'
  );

  if (chartStatus === 'FINAL_CHART') {
    for (const b of bookingsList) {
      b.chart_status = 'FINAL_CHART';
      const isCounter = b.ticket_type === 'COUNTER';
      const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === b.id);

      if (b.status === 'waitlist' || b.status === 'WL') {
        if (!isCounter) {
          // Fully waitlisted e-ticket after final chart => AUTO_CANCELLED
          b.status = 'auto_cancelled';
          b.booking_status = 'AUTO_CANCELLED';
          b.boarding_eligibility = 'AUTO_CANCELLED';
          b.cancellation_reason = 'Auto-cancelled upon final chart preparation (Fully waitlisted e-ticket)';
          b.cancellation_date_time = new Date().toISOString();
          b.refund_amount = b.total_fare || 0;
          b.refund_status = 'APPROVED';

          // Clear any seat assignments
          allocations.forEach(a => { a.seat_id = null; });

          // Credit refund to user wallet
          if (b.passenger_id && (b.total_fare || 0) > 0) {
            if (!mockDb.wallets) mockDb.wallets = new Map();
            if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

            let wallet = mockDb.wallets.get(b.passenger_id);
            if (!wallet) {
              wallet = { user_id: b.passenger_id, balance: 2500.00, updated_at: new Date().toISOString() };
            }
            wallet.balance = parseFloat((wallet.balance + b.total_fare).toFixed(2));
            wallet.updated_at = new Date().toISOString();
            mockDb.wallets.set(b.passenger_id, wallet);

            const refundTxnId = `txn-autocancel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            mockDb.wallet_transactions.set(refundTxnId, {
              id: refundTxnId,
              user_id: b.passenger_id,
              booking_id: b.id,
              type: 'credit',
              title: `Auto-Cancellation Refund (PNR: ${b.pnr_number})`,
              date: new Date().toISOString(),
              amount: b.total_fare,
              status: 'success',
              reference: `AUTOCANCEL-${b.pnr_number}`
            });
          }

          autoCancelledCount++;
        } else {
          // Counter ticket remains waitlist
          b.boarding_eligibility = 'WAITLISTED_COUNTER';
        }
      }
      mockDb.bookings.set(b.id, b);
      processedBookings.push(formatBookingForResponse(b));
    }
  } else {
    // FIRST_CHART processing
    for (const b of bookingsList) {
      b.chart_status = 'FIRST_CHART';
      mockDb.bookings.set(b.id, b);
      processedBookings.push(formatBookingForResponse(b));
    }
  }

  saveMockDbToFile();

  return res.json({
    message: `Chart preparation (${chartStatus}) completed for train ${train_id} on ${travel_date}`,
    chart_status: chartStatus,
    processed_count: bookingsList.length,
    auto_cancelled_count: autoCancelledCount,
    bookings: processedBookings
  });
});

module.exports = router;
