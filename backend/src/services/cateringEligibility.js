const { isFoodEligibleClass, normalizeClassCode, isBookingCancelled, isJourneyCompleted } = require('../utils/cateringEligibilityHelper');

const DEFAULT_CATERING_POLICY = {
  minimum_journey_distance_km: 200,
  minimum_journey_duration_hours: 4,
  short_journey_food_enabled: false,
  food_order_cutoff_minutes_before_delivery: 120
};

const ALL_SUPPORTED_CLASSES = ['1A', '2A', '3A', '3E', 'SL', 'CC', 'EC', 'FC', '2S', 'EA', 'EV', 'VC'];

// Official / Configurable Tariff Reference Rates (per meal)
const CATERING_TARIFF_REFERENCE = {
  RAJDHANI_SHATABDI_DURONTO: {
    '1A': { breakfast: 140, lunch_dinner: 245, snacks: 90 },
    '2A': { breakfast: 120, lunch_dinner: 210, snacks: 80 },
    '3A': { breakfast: 120, lunch_dinner: 210, snacks: 80 },
    'CC': { breakfast: 100, lunch_dinner: 180, snacks: 70 },
    'SL': { breakfast: 80, lunch_dinner: 150, snacks: 50 }
  },
  VANDE_BHARAT: {
    '1A': { breakfast: 155, lunch_dinner: 244, snacks: 105 },
    'EC': { breakfast: 155, lunch_dinner: 244, snacks: 105 },
    'CC': { breakfast: 122, lunch_dinner: 222, snacks: 80 }
  },
  EXPRESS_STANDARD: {
    '1A': { breakfast: 90, lunch_dinner: 150, snacks: 60 },
    '2A': { breakfast: 80, lunch_dinner: 130, snacks: 50 },
    '3A': { breakfast: 80, lunch_dinner: 130, snacks: 50 },
    'SL': { breakfast: 60, lunch_dinner: 100, snacks: 40 }
  }
};

/**
 * Returns effective catering configuration for a train, providing safe defaults.
 * Food/Catering is available across all supported travel classes.
 */
function getTrainCateringConfig(train) {
  if (!train) {
    return {
      enabled: false,
      service_type: 'NONE',
      included_in_ticket: false,
      available_for_classes: ALL_SUPPORTED_CLASSES,
      delivery_enabled: false,
      minimum_delivery_journey_hours: DEFAULT_CATERING_POLICY.minimum_journey_duration_hours,
      status: 'UNCONFIGURED'
    };
  }

  return {
    enabled: train.catering ? train.catering.enabled !== false : true,
    service_type: train.catering?.service_type || 'ONBOARD_AND_ECATERING',
    included_in_ticket: Boolean(train.catering?.included_in_ticket),
    available_for_classes: ALL_SUPPORTED_CLASSES,
    delivery_enabled: train.catering ? train.catering.delivery_enabled !== false : true,
    minimum_delivery_journey_hours: train.catering?.minimum_delivery_journey_hours || DEFAULT_CATERING_POLICY.minimum_journey_duration_hours,
    menu_prices: train.catering?.menu_prices || null,
    status: 'CONFIGURED'
  };
}

/**
 * Core evaluation function for catering eligibility on a journey.
 * Rules:
 * - Allows all supported travel classes (1A, 2A, 3A, SL, CC, etc.)
 * - Hard rejects cancelled bookings
 * - Hard rejects completed journeys
 */
function evaluateCateringEligibility(params = {}) {
  const {
    train,
    distance_km = 0,
    duration_hours = 0,
    class_code = null,
    booking = null,
    now = new Date(),
    policy_override = {}
  } = params;

  const policy = { ...DEFAULT_CATERING_POLICY, ...policy_override };
  const config = getTrainCateringConfig(train);

  // 1. Check for Cancelled Booking
  if (booking && isBookingCancelled(booking)) {
    return {
      is_eligible: false,
      is_short_journey: false,
      reason: 'Food ordering is unavailable for cancelled tickets.',
      reason_code: 'CANCELLED_TICKET',
      badge_label: '❌ Food Unavailable (Cancelled)',
      short_journey_notice: null,
      included_in_ticket: false,
      service_type: 'NONE',
      can_order_food: false,
      catering_fee: 0
    };
  }

  // 2. Check for Completed Journey
  if (booking && isJourneyCompleted(booking, now)) {
    return {
      is_eligible: false,
      is_short_journey: false,
      reason: 'Food ordering is unavailable because your journey has been completed.',
      reason_code: 'COMPLETED_JOURNEY',
      badge_label: '🔒 Food Ordering Closed (Journey Completed)',
      short_journey_notice: null,
      included_in_ticket: false,
      service_type: 'NONE',
      can_order_food: false,
      catering_fee: 0
    };
  }

  // 3. Passenger Booking: Food is available for all passenger PNRs (except cancelled & completed)
  if (booking) {
    const isIncluded = Boolean(booking.catering_included_in_ticket || config.included_in_ticket);
    return {
      is_eligible: true,
      is_short_journey: false,
      reason: isIncluded
        ? 'Catering service included in your ticket.'
        : 'Food service is available for your journey.',
      badge_label: isIncluded ? '🍱 Catering Included in Ticket' : '🍱 Food Available for this Journey',
      short_journey_notice: null,
      included_in_ticket: isIncluded,
      service_type: config.service_type || 'ECATERING',
      can_order_food: true,
      catering_fee: 0
    };
  }

  // 4. Evaluate Class Eligibility (All supported classes allowed)
  if (class_code) {
    const normClass = normalizeClassCode(class_code);
    const trainAllowedClasses = Array.isArray(config.available_for_classes)
      ? config.available_for_classes
      : (Array.isArray(config.applicable_classes) ? config.applicable_classes : null);

    if (!isFoodEligibleClass(class_code) || (trainAllowedClasses && trainAllowedClasses.length > 0 && !trainAllowedClasses.map(c => normalizeClassCode(c)).includes(normClass))) {
      return {
        is_eligible: false,
        is_short_journey: false,
        reason: 'Food/Catering is not supported for this class code.',
        badge_label: 'Food/Catering Not Available for this Class',
        short_journey_notice: null,
        included_in_ticket: false,
        service_type: 'NONE',
        can_order_food: false,
        catering_fee: 0
      };
    }
  }


  const dist = parseFloat(distance_km) || 0;
  const dur = parseFloat(duration_hours) || 0;

  // 4. Evaluate Short Journey criteria
  const isDistanceTooShort = dist > 0 && dist < policy.minimum_journey_distance_km;
  const isDurationTooShort = dur > 0 && dur < policy.minimum_journey_duration_hours;

  const isShortJourney = (isDistanceTooShort || isDurationTooShort) && !policy.short_journey_food_enabled;

  if (isShortJourney) {
    return {
      is_eligible: false,
      is_short_journey: true,
      reason: `Short journey (${dist} km / ${dur} hrs) does not meet minimum catering threshold.`,
      badge_label: '🍱 Food Not Available for this Journey',
      short_journey_notice: 'Food service unavailable for this short journey.',
      included_in_ticket: false,
      service_type: config.service_type,
      can_order_food: false,
      catering_fee: 0
    };
  }

  // 5. Evaluate Train Level Catering Availability
  if (!config.enabled || config.service_type === 'NONE') {
    return {
      is_eligible: false,
      is_short_journey: false,
      reason: 'Catering service disabled for this train.',
      badge_label: '🍱 Food Not Available for this Journey',
      short_journey_notice: null,
      included_in_ticket: false,
      service_type: 'NONE',
      can_order_food: false,
      catering_fee: 0
    };
  }

  // 6. Eligible Journey Determination
  const isIncluded = Boolean(config.included_in_ticket);
  const badge = isIncluded
    ? '🍱 Catering Included in Ticket'
    : (config.service_type === 'ECATERING'
        ? '🍱 e-Catering Available'
        : (config.service_type === 'ONBOARD'
            ? '🍱 Food Available — Extra Charge'
            : '🍱 Food Available for this Journey'));

  return {
    is_eligible: true,
    is_short_journey: false,
    reason: isIncluded
      ? 'Catering service included in your ticket.'
      : 'Food service is available for your journey.',
    badge_label: badge,
    short_journey_notice: null,
    included_in_ticket: isIncluded,
    service_type: config.service_type,
    can_order_food: true,
    catering_fee: 0
  };
}

/**
 * Calculates delivery cutoff time string for a station arrival time.
 */
function calculateStationCutoffTime(arrivalTimeStr, cutoffMinutes = 120) {
  if (!arrivalTimeStr) return { arrivalTime: '12:00', cutoffTime: '10:00', isExpired: false };
  const cleanArr = String(arrivalTimeStr).trim().split(' ')[0];
  const [arrH, arrM] = cleanArr.split(':').map(n => parseInt(n, 10) || 0);

  let totalMins = arrH * 60 + arrM - cutoffMinutes;
  if (totalMins < 0) totalMins += 24 * 60;

  const cutH = Math.floor(totalMins / 60) % 24;
  const cutM = totalMins % 60;

  const cutoffTimeStr = `${String(cutH).padStart(2, '0')}:${String(cutM).padStart(2, '0')}`;
  return {
    arrivalTime: cleanArr,
    cutoffTime: cutoffTimeStr,
    cutoffMinutes
  };
}

module.exports = {
  DEFAULT_CATERING_POLICY,
  CATERING_TARIFF_REFERENCE,
  ALL_SUPPORTED_CLASSES,
  getTrainCateringConfig,
  evaluateCateringEligibility,
  calculateStationCutoffTime,
  isFoodEligibleClass,
  normalizeClassCode
};
