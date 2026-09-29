/**
 * RailControl Catering Eligibility Helper
 * Canonical Single Source of Truth for Food/Catering Class Eligibility.
 * Rules:
 *  - Food is available for ALL passenger travel classes (1A, 2A, 3A, 3E, SL, CC, EC, FC, 2S, EA, EV, VC, etc.).
 *  - STRICT RESTRICTION 1: CANCELLED PNR — NEVER ALLOW FOOD.
 *  - STRICT RESTRICTION 2: COMPLETED JOURNEY — NEVER ALLOW FOOD.
 *  - UPCOMING / ACTIVE JOURNEY — FOOD ALLOWED.
 */

export const SUPPORTED_CLASSES = new Set([
  '1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', 'FC', '2S', 'EA', 'EV', 'VC', 'GEN', 'UR', 'GN'
]);

export function normalizeClassCode(travelClass) {
  if (!travelClass) return '3A';
  const str = String(travelClass).trim().toUpperCase();
  if (
    str === '1A' ||
    str === 'AC FIRST CLASS' ||
    str === 'AC FIRST' ||
    str === 'FIRST CLASS' ||
    str === '1ST CLASS' ||
    str === 'AC 1ST CLASS' ||
    str === 'FIRST AC'
  ) {
    return '1A';
  }
  if (str === '2A' || str === 'AC 2 TIER' || str === '2ND AC' || str === 'AC 2-TIER') {
    return '2A';
  }
  if (str === '3A' || str === 'AC 3 TIER' || str === '3RD AC' || str === 'AC 3-TIER') {
    return '3A';
  }
  if (str === '3E' || str === 'AC 3 ECONOMY' || str === '3 ECONOMY') {
    return '3E';
  }
  if (str === 'SL' || str === 'SLEEPER' || str === 'SLEEPER CLASS') {
    return 'SL';
  }
  if (str === 'CC' || str === 'CHAIR CAR' || str === 'AC CHAIR CAR') {
    return 'CC';
  }
  if (str === 'EC' || str === 'EXECUTIVE CHAIR CAR' || str === 'EXEC CHAIR CAR') {
    return 'EC';
  }
  if (str === '2S' || str === 'SECOND SITTING') {
    return '2S';
  }
  return str;
}

/**
 * Returns true for all supported travel classes.
 * Food ordering is open to all passenger classes.
 */
export function isFoodEligibleClass(travelClass) {
  if (!travelClass) return true;
  const normalized = normalizeClassCode(travelClass);
  return SUPPORTED_CLASSES.has(normalized) || Boolean(normalized);
}

/**
 * Authoritative check if a booking is cancelled.
 */
export function isBookingCancelled(booking) {
  if (!booking) return false;
  const status = String(booking.status || booking.booking_status || '').trim().toUpperCase();
  return status === 'CANCELLED' || status === 'CANCELED';
}

/**
 * Authoritative check if a journey has completed.
 */
export function isJourneyCompleted(booking, now = new Date()) {
  if (!booking) return false;

  const status = String(booking.status || booking.booking_status || '').trim().toUpperCase();
  if (status === 'COMPLETED' || status === 'ARRIVED') {
    return true;
  }

  if (booking.travel_date) {
    const travelDateStr = String(booking.travel_date).trim().split('T')[0];
    const destArrival = booking.destination_arrival_time || booking.arrival_time || '23:59';
    const [arrH, arrM] = String(destArrival).trim().split(':').map(n => parseInt(n, 10) || 0);

    const [y, m, d] = travelDateStr.split('-').map(n => parseInt(n, 10));
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const journeyEndDate = new Date(y, m - 1, d, arrH, arrM, 0, 0);
      if (now.getTime() > journeyEndDate.getTime()) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper to determine if a booking qualifies for complimentary food.
 */
export function isComplimentaryFoodEligible(booking, currentUser = null, now = new Date()) {
  if (!booking) return false;

  // 1. CANCELLED PNR — NEVER ALLOW FOOD
  if (isBookingCancelled(booking)) {
    return false;
  }

  // 2. COMPLETED JOURNEY — NEVER ALLOW FOOD
  if (isJourneyCompleted(booking, now)) {
    return false;
  }

  if (currentUser && currentUser.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                    (booking.user_id && String(booking.user_id) === String(currentUser.id)) ||
                    (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase());
    if (!isOwner) {
      return false;
    }
  }

  const travelClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class;
  return isFoodEligibleClass(travelClass);
}

/**
 * Returns structured food entitlement details for a booking.
 */
export function getComplimentaryFoodEntitlement(booking, currentUser = null, now = new Date()) {
  if (!booking) {
    return {
      success: false,
      eligible: false,
      food_ordering_allowed: false,
      food_entitlement: 'NOT_AVAILABLE',
      ticket_class: 'UNKNOWN',
      booking_status: 'UNKNOWN',
      journey_status: 'UNKNOWN',
      food_total: 0,
      payment_required: false,
      message: 'Booking record not found.'
    };
  }

  const rawClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class || '3A';
  const normalizedClass = normalizeClassCode(rawClass);
  const rawBookingStatus = String(booking.booking_status || booking.status || 'CONFIRMED').toUpperCase();

  // 1. CANCELLED PNR — NEVER ALLOW FOOD
  if (isBookingCancelled(booking)) {
    return {
      success: true,
      eligible: false,
      food_ordering_allowed: false,
      food_entitlement: 'NOT_AVAILABLE',
      ticket_class: normalizedClass,
      booking_status: 'CANCELLED',
      journey_status: 'CANCELLED',
      reason_code: 'CANCELLED_TICKET',
      food_total: 0,
      payment_required: false,
      message: 'Food ordering is unavailable for cancelled tickets.'
    };
  }

  // 2. COMPLETED JOURNEY — NEVER ALLOW FOOD
  if (isJourneyCompleted(booking, now)) {
    return {
      success: true,
      eligible: false,
      food_ordering_allowed: false,
      food_entitlement: 'NOT_AVAILABLE',
      ticket_class: normalizedClass,
      booking_status: rawBookingStatus.includes('CANCEL') ? 'CANCELLED' : (booking.status || 'CONFIRMED').toUpperCase(),
      journey_status: 'COMPLETED',
      reason_code: 'COMPLETED_JOURNEY',
      food_total: 0,
      payment_required: false,
      message: 'Food ordering is unavailable because your journey has been completed.'
    };
  }

  // 3. Ownership check for authenticated passenger
  if (currentUser && currentUser.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                    (booking.user_id && String(booking.user_id) === String(currentUser.id)) ||
                    (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase());
    if (!isOwner) {
      return {
        success: false,
        eligible: false,
        food_ordering_allowed: false,
        food_entitlement: 'NOT_AVAILABLE',
        ticket_class: normalizedClass,
        booking_status: rawBookingStatus,
        journey_status: 'UNAUTHORIZED',
        reason_code: 'UNAUTHORIZED_PNR',
        food_total: 0,
        payment_required: false,
        message: '❌ Access denied. This PNR does not belong to your account.'
      };
    }
  }

  // 4. UPCOMING / ACTIVE JOURNEY — FOOD ALLOWED FOR ALL CLASSES
  return {
    success: true,
    eligible: true,
    food_ordering_allowed: true,
    food_entitlement: 'COMPLIMENTARY',
    ticket_class: normalizedClass,
    booking_status: rawBookingStatus.includes('CNF') || rawBookingStatus.includes('CONFIRM') ? 'CONFIRMED' : rawBookingStatus,
    journey_status: 'UPCOMING',
    food_total: 0,
    payment_required: false,
    message: '✓ Food ordering is available for your journey.'
  };
}
