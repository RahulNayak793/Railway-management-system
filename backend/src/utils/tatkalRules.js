/**
 * Authoritative Indian Railways Tatkal Rules & Validation Engine
 * 
 * Rules:
 * 1. Quotas: GENERAL (GN) and TATKAL (TQ).
 * 2. Tatkal opens 1 day before the train's originating-station departure date:
 *    - AC classes: 10:00 AM IST
 *    - Non-AC classes: 11:00 AM IST
 * 3. Originating-station departure date is authoritative, NOT passenger's intermediate boarding station.
 * 4. Authoritative server-side IST evaluation.
 * 5. Reusable class-based Tatkal charges.
 * 6. Configurable Tatkal cancellation policy (IRCTC default: confirmed Tatkal = 0% refund).
 */

const AC_CLASSES = new Set(['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'EV']);

// Authoritative Indian Railways Tatkal Fare Structure per Class
const TATKAL_FARE_CONFIG = {
  '2S': { ratePct: 10, minCharge: 10, maxCharge: 15 },
  'SL': { ratePct: 30, minCharge: 100, maxCharge: 200 },
  '3A': { ratePct: 30, minCharge: 125, maxCharge: 300 },
  '3E': { ratePct: 30, minCharge: 125, maxCharge: 300 },
  'CC': { ratePct: 30, minCharge: 125, maxCharge: 225 },
  '2A': { ratePct: 30, minCharge: 400, maxCharge: 500 },
  'EC': { ratePct: 30, minCharge: 400, maxCharge: 500 },
  'EA': { ratePct: 30, minCharge: 400, maxCharge: 500 },
  'EV': { ratePct: 30, minCharge: 400, maxCharge: 500 },
  '1A': { ratePct: 30, minCharge: 400, maxCharge: 500 },
  'FC': { ratePct: 30, minCharge: 100, maxCharge: 200 }
};

// Default Tatkal seat capacity per class if not explicitly configured on train
const DEFAULT_TATKAL_CAPACITIES = {
  '1A': 2,
  '2A': 6,
  '3A': 12,
  '3E': 12,
  'CC': 10,
  'EC': 4,
  'EA': 4,
  'EV': 4,
  'SL': 16,
  '2S': 12,
  'FC': 4,
  'GEN': 6
};

/**
 * Returns true if the class code is an AC class.
 */
function isACClass(classCode) {
  const norm = String(classCode || '').trim().toUpperCase();
  return AC_CLASSES.has(norm);
}

/**
 * Returns Tatkal opening hour in IST (24-hour format).
 * AC classes: 10 (10:00 AM IST)
 * Non-AC classes: 11 (11:00 AM IST)
 */
function getTatkalOpeningHour(classCode) {
  return isACClass(classCode) ? 10 : 11;
}

/**
 * Adds (or subtracts) days from a YYYY-MM-DD date string.
 */
function addDaysToDate(dateStr, days) {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return clean;
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns current date and time components in Indian Standard Time (IST, UTC+5:30).
 * Can be overridden with simulatedNow for deterministic testing.
 */
function getNowIST(simulatedNow = null) {
  if (simulatedNow && typeof simulatedNow === 'object') {
    if (simulatedNow.dateStr) {
      const minutesFromMidnight = simulatedNow.minutesFromMidnight !== undefined
        ? simulatedNow.minutesFromMidnight
        : (simulatedNow.totalMinutes !== undefined
            ? simulatedNow.totalMinutes
            : (simulatedNow.hours !== undefined ? simulatedNow.hours * 60 + (simulatedNow.minutes || 0) : 0));
      const hours = simulatedNow.hours !== undefined ? simulatedNow.hours : Math.floor(minutesFromMidnight / 60);
      const minutes = simulatedNow.minutes !== undefined ? simulatedNow.minutes : (minutesFromMidnight % 60);
      const seconds = simulatedNow.seconds || 0;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return {
        dateStr: simulatedNow.dateStr,
        timeStr,
        hours,
        minutes,
        seconds,
        minutesFromMidnight,
        istDate: new Date(`${simulatedNow.dateStr}T${timeStr}+05:30`)
      };
    }
  }

  const baseDate = (simulatedNow instanceof Date) ? simulatedNow : new Date();
  // Format to Asia/Kolkata timezone
  const istString = baseDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);

  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const seconds = istDate.getSeconds();
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const minutesFromMidnight = hours * 60 + minutes;

  return {
    dateStr,
    timeStr,
    hours,
    minutes,
    seconds,
    minutesFromMidnight,
    totalMinutes: minutesFromMidnight,
    istDate
  };
}

/**
 * Normalizes quota string into authoritative 'GENERAL' or 'TATKAL'.
 */
function normalizeQuota(quota) {
  if (!quota) return 'GENERAL';
  const q = String(quota).trim().toUpperCase();
  if (q === 'TQ' || q === 'CK' || q === 'TATKAL' || q === 'PT' || q === 'PREMIUM_TATKAL') {
    return 'TATKAL';
  }
  return 'GENERAL';
}

/**
 * Checks if a requested quota is Tatkal.
 */
function isTatkalQuota(quota) {
  return normalizeQuota(quota) === 'TATKAL';
}

/**
 * Resolves the train's originating-station departure date.
 * If passenger boards at an intermediate station, boardingDate is dayOffset days after origin departure.
 * Origin Departure Date = boardingDepartureDate - boardingDayOffset.
 */
function resolveOriginDepartureDate(train, route, travelDate, fromStation) {
  const normTravelDate = String(travelDate || '').trim().slice(0, 10);
  if (!fromStation || !train) {
    return normTravelDate;
  }

  try {
    const { matchRouteSegment, buildOrderedStationNodes } = require('./routeSearch');
    const nodes = buildOrderedStationNodes(train, route);
    const cleanFrom = String(fromStation).trim().toUpperCase();

    // Find node matching fromStation
    const matchedNode = nodes.find(n => n.code === cleanFrom || n.name?.toUpperCase() === cleanFrom);
    if (matchedNode && matchedNode.day_offset) {
      const offset = parseInt(matchedNode.day_offset, 10) || 0;
      return addDaysToDate(normTravelDate, -offset);
    }
  } catch (e) {
    // Fallback if routeSearch is unavailable
  }

  return normTravelDate;
}

/**
 * Computes Tatkal window opening date, opening time, and current availability status.
 * Evaluates against authoritative IST time.
 */
function getTatkalWindowStatus({
  train,
  route = null,
  travelDate,
  fromStation = null,
  classCode = '3A',
  simulatedNow = null,
  mockNowIST = null
}) {
  const effectiveSimulated = simulatedNow || mockNowIST;
  const normTravelDate = String(travelDate || '').trim().slice(0, 10);
  const normClass = String(classCode || '3A').trim().toUpperCase();
  const isAC = isACClass(normClass);
  const openingHour = getTatkalOpeningHour(normClass);
  const openingTimeStr = `${String(openingHour).padStart(2, '0')}:00:00`;
  const openingTimeLabel = `${openingHour}:00 AM IST`;

  const originDepartureDate = resolveOriginDepartureDate(train, route, normTravelDate, fromStation);
  const tatkalOpeningDate = addDaysToDate(originDepartureDate, -1);

  const now = getNowIST(effectiveSimulated);
  const currentIstDate = now.dateStr;
  const currentIstMins = now.minutesFromMidnight;
  const openingMins = openingHour * 60;

  // Check if train has departed
  let isDeparted = false;
  if (train) {
    try {
      const { isDepartedFromStation } = require('../services/journeyAvailabilityService');
      const depTime = (train.departure_time || route?.departure_time || '10:00:00').slice(0, 8);
      isDeparted = isDepartedFromStation(normTravelDate, depTime, simulatedNow);
    } catch (e) {
      if (normTravelDate < currentIstDate) isDeparted = true;
    }
  }

  if (isDeparted) {
    return {
      isOpen: false,
      status: 'DEPARTED',
      statusCode: 'TRAIN DEPARTED',
      statusLabel: 'Train Departed',
      isAC,
      openingHour,
      openingTimeStr,
      openingTimeLabel,
      originDepartureDate,
      tatkalOpeningDate,
      message: 'Booking closed: Train has already departed.'
    };
  }

  // Before Tatkal opening date
  if (currentIstDate < tatkalOpeningDate) {
    return {
      isOpen: false,
      isDeparted: false,
      status: 'NOT_YET_OPEN',
      statusCode: 'TATKAL NOT OPEN',
      statusLabel: `Opens ${tatkalOpeningDate} at ${openingTimeLabel}`,
      isAC,
      openingHour,
      openingTimeStr,
      openingTimeLabel,
      originDepartureDate,
      tatkalOpeningDate,
      message: `Tatkal booking opens on ${tatkalOpeningDate} at ${openingTimeLabel} (${isAC ? 'AC Classes' : 'Non-AC Classes'}).`
    };
  }

  // On Tatkal opening date, but before opening hour
  if (currentIstDate === tatkalOpeningDate && currentIstMins < openingMins) {
    const minsLeft = openingMins - currentIstMins;
    const hoursLeft = Math.floor(minsLeft / 60);
    const remMins = minsLeft % 60;
    const countdown = hoursLeft > 0 ? `${hoursLeft}h ${remMins}m` : `${remMins}m`;

    return {
      isOpen: false,
      isDeparted: false,
      status: 'OPENS_TODAY',
      statusCode: 'TATKAL OPENS TODAY',
      statusLabel: `Opens Today at ${openingTimeLabel} (${countdown})`,
      isAC,
      openingHour,
      openingTimeStr,
      openingTimeLabel,
      originDepartureDate,
      tatkalOpeningDate,
      minutesRemaining: minsLeft,
      message: `Tatkal booking opens today at ${openingTimeLabel} (in ${countdown}).`
    };
  }

  // Window is open!
  return {
    isOpen: true,
    isDeparted: false,
    status: 'OPEN',
    statusCode: 'TATKAL OPEN',
    statusLabel: 'Tatkal Open',
    isAC,
    openingHour,
    openingTimeStr,
    openingTimeLabel,
    originDepartureDate,
    tatkalOpeningDate,
    message: 'Tatkal booking is currently open.'
  };
}

/**
 * Calculates server-authoritative Tatkal charge for a travel class and base fare.
 * Reusable across search, booking, payment, and admin views.
 */
function calculateTatkalCharge(classCode, baseFare) {
  const normClass = String(classCode || '3A').trim().toUpperCase();
  const numBaseFare = Math.max(0, parseFloat(baseFare) || 0);

  const cfg = TATKAL_FARE_CONFIG[normClass] || { ratePct: 30, minCharge: 100, maxCharge: 300 };
  const rawCharge = (numBaseFare * cfg.ratePct) / 100;
  const boundedCharge = Math.min(cfg.maxCharge, Math.max(cfg.minCharge, rawCharge));

  // Clean rounding to nearest rupee
  return Math.round(boundedCharge);
}

/**
 * Gets configured or default Tatkal seat capacity for a train and class.
 */
function getTatkalClassCapacity(train, classCode) {
  const normClass = String(classCode || '3A').trim().toUpperCase();

  // 1. Explicit per-train, per-class tatkal_quota map
  if (train?.tatkal_quota && typeof train.tatkal_quota === 'object') {
    const custom = parseInt(train.tatkal_quota[normClass], 10);
    if (!isNaN(custom) && custom >= 0) {
      return custom;
    }
  }

  // 2. Explicit per-train tatkal_capacity
  if (train?.tatkal_capacity && typeof train.tatkal_capacity === 'object') {
    const custom = parseInt(train.tatkal_capacity[normClass], 10);
    if (!isNaN(custom) && custom >= 0) {
      return custom;
    }
  }

  // 3. Default Indian Railways benchmark capacity
  return DEFAULT_TATKAL_CAPACITIES[normClass] || 10;
}

let activeCancellationConfig = {
  confirmedRefundPct: 0,
  wlClerkageFee: 60
};

/**
 * Updates dynamic Tatkal cancellation policy configuration.
 */
function setTatkalCancellationPolicy(config) {
  if (config && typeof config === 'object') {
    if (config.confirmedRefundPct !== undefined) {
      activeCancellationConfig.confirmedRefundPct = Math.max(0, Math.min(100, Number(config.confirmedRefundPct)));
    }
    if (config.wlClerkageFee !== undefined) {
      activeCancellationConfig.wlClerkageFee = Math.max(0, Number(config.wlClerkageFee));
    }
    if (config.tatkal_confirmed_refund_pct !== undefined) {
      activeCancellationConfig.confirmedRefundPct = Math.max(0, Math.min(100, Number(config.tatkal_confirmed_refund_pct)));
    }
    if (config.clerkage_fee !== undefined) {
      activeCancellationConfig.wlClerkageFee = Math.max(0, Number(config.clerkage_fee));
    }
  }
  return { ...activeCancellationConfig };
}

/**
 * Evaluates Tatkal cancellation and refund policy.
 * Configurable via system policy while defaulting to Indian Railways standard:
 * - Confirmed Tatkal Ticket: 0% refund (100% cancellation charge).
 * - Waitlisted / RAC Tatkal Ticket (TQWL/RAC): Standard refund minus clerkage fee (₹60 per passenger).
 */
function getTatkalCancellationPolicy(booking, customConfig = null) {
  const cfg = customConfig ? { ...activeCancellationConfig, ...customConfig } : activeCancellationConfig;
  const bookingStatus = String(booking?.status || booking?.booking_status || '').toLowerCase();
  const isConfirmed = bookingStatus === 'confirmed' || bookingStatus === 'cnf';
  const origAmount = Math.max(0, parseFloat(booking?.total_fare || booking?.original_amount || 0));

  if (isConfirmed) {
    const refundPct = (cfg.confirmedRefundPct !== undefined) 
      ? Number(cfg.confirmedRefundPct) 
      : (cfg.tatkal_confirmed_refund_pct !== undefined ? Number(cfg.tatkal_confirmed_refund_pct) : 0);
    const feePct = 100 - refundPct;
    const refundAmount = Math.round((origAmount * refundPct) / 100);
    const cancellationFee = origAmount - refundAmount;

    return {
      isRefundable: refundPct > 0,
      original_amount: origAmount,
      cancellation_fee: cancellationFee,
      cancellation_fee_percentage: feePct,
      refund_amount: refundAmount,
      refund_percentage: refundPct,
      clerkageFee: 0,
      rule_applied: refundPct === 0 
        ? 'Confirmed Tatkal tickets are non-refundable (0% refund)' 
        : `Tatkal cancellation: ${feePct}% fee applied`,
      ruleDescription: refundPct === 0 
        ? 'No refund is admissible on cancellation of confirmed Tatkal tickets (Indian Railways Policy).' 
        : `Tatkal cancellation: ${feePct}% fee applied`
    };
  }

  // For RAC or Waitlisted (TQWL) Tatkal bookings:
  const passengerCount = Array.isArray(booking?.passengers) && booking.passengers.length > 0
    ? booking.passengers.length
    : (parseInt(booking?.passenger_count || 1, 10) || 1);
  const clerkageFeePerPassenger = cfg.wlClerkageFee !== undefined 
    ? Number(cfg.wlClerkageFee) 
    : (cfg.clerkage_fee !== undefined ? Number(cfg.clerkage_fee) : 60);
  const totalClerkage = clerkageFeePerPassenger * passengerCount;
  const cancellationFee = Math.min(origAmount, totalClerkage);
  const refundAmount = Math.max(0, origAmount - cancellationFee);
  const refundPct = origAmount > 0 ? Math.round((refundAmount / origAmount) * 100) : 0;
  const feePct = 100 - refundPct;

  return {
    isRefundable: true,
    original_amount: origAmount,
    cancellation_fee: cancellationFee,
    cancellation_fee_percentage: feePct,
    refund_amount: refundAmount,
    refund_percentage: refundPct,
    clerkageFee: totalClerkage,
    rule_applied: `Waitlisted/RAC Tatkal cancellation: ₹${clerkageFeePerPassenger} clerkage charge deducted per passenger.`,
    ruleDescription: `Waitlisted/RAC Tatkal tickets are eligible for refund minus clerkage fee of ₹${clerkageFeePerPassenger} per passenger.`
  };
}

module.exports = {
  AC_CLASSES,
  TATKAL_FARE_CONFIG,
  DEFAULT_TATKAL_CAPACITIES,
  isACClass,
  getTatkalOpeningHour,
  addDaysToDate,
  getNowIST,
  normalizeQuota,
  isTatkalQuota,
  resolveOriginDepartureDate,
  getTatkalWindowStatus,
  calculateTatkalCharge,
  getTatkalClassCapacity,
  getTatkalCancellationPolicy,
  setTatkalCancellationPolicy
};
