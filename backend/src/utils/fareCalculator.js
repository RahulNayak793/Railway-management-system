/**
 * Authoritative dynamic segment-based fare calculator for Railway Management System.
 * Calculates fares based on actual travelled segment distance (KM), journey duration (Minutes), and coach class.
 */

const { buildOrderedStationNodes } = require('./routeSearch');
const { calculateTatkalCharge } = require('./tatkalRules');

// Authoritative Centralized Constants
const BASE_RATE_PER_KM = 0.45;       // ₹0.45 per km for Sleeper base rate
const TIME_RATE_PER_MINUTE = 0.15;   // ₹0.15 per minute journey duration rate

const CLASS_MULTIPLIERS = {
  'SL': 1.0,
  '3A': 1.5,
  '2A': 2.2,
  '1A': 3.5,
  '3E': 1.35,
  'CC': 1.2,
  'EC': 2.5,
  '2S': 0.6,
  'GEN': 0.4
};

/**
 * Calculates duration in minutes between departure time and arrival time.
 * Handles 24-hour time strings (HH:mm or HH:mm:ss) and overnight midnight crossing.
 */
const getSegmentDurationMinutes = (depTimeStr, arrTimeStr) => {
  if (!depTimeStr || !arrTimeStr) return 180; // Default 3 hours if missing

  const parseMinutes = (tStr) => {
    if (!tStr) return 0;
    const clean = String(tStr).trim().split(' ')[0];
    const parts = clean.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const depMins = parseMinutes(depTimeStr);
  const arrMins = parseMinutes(arrTimeStr);

  let diff = arrMins - depMins;
  if (diff <= 0) {
    // Overnight midnight crossing
    diff += 24 * 60;
  }
  return Math.max(15, diff); // Minimum 15 minutes
};

/**
 * Determines actual segment distance in KM using available data sources:
 * 1. Explicit station/stop distances if stored on nodes
 * 2. Stop distance differences if available
 * 3. Segment duration-proportional distance calculation
 * 4. Hop-based ratio of full route distance
 */
const getSegmentDistanceKm = (train, route, srcNode, destNode, srcIndex, destIndex, nodes) => {
  if (!nodes || nodes.length < 2 || srcIndex < 0 || destIndex <= srcIndex) {
    return 100;
  }

  // Source 1: Check node explicit distances
  const srcDist = parseFloat(srcNode?.distanceFromOriginKm ?? srcNode?.distance_km ?? srcNode?.dist ?? srcNode?.km ?? srcNode?.distance ?? -1);
  const destDist = parseFloat(destNode?.distanceFromOriginKm ?? destNode?.distance_km ?? destNode?.dist ?? destNode?.km ?? destNode?.distance ?? -1);

  if (srcDist >= 0 && destDist > srcDist) {
    return Math.round(destDist - srcDist);
  }

  const fullDistance = parseFloat(route?.distance_km || train?.distance_km || 1000);

  // Source 2: Calculate duration ratio if node timings exist
  const totalDurationMinutes = getSegmentDurationMinutes(nodes[0].depTime, nodes[nodes.length - 1].arrTime);
  const segmentDurationMinutes = getSegmentDurationMinutes(srcNode?.depTime || srcNode?.arrTime, destNode?.arrTime || destNode?.depTime);

  if (totalDurationMinutes > 0 && segmentDurationMinutes > 0 && segmentDurationMinutes < totalDurationMinutes) {
    const durationRatio = segmentDurationMinutes / totalDurationMinutes;
    const durationBasedDist = Math.round(fullDistance * durationRatio);
    if (durationBasedDist > 0) {
      return Math.max(30, durationBasedDist);
    }
  }

  // Source 3: Hop ratio of full route distance
  const totalHops = nodes.length - 1;
  const segmentHops = destIndex - srcIndex;
  const hopRatio = segmentHops / totalHops;
  const hopBasedDist = Math.round(fullDistance * hopRatio);

  return Math.max(30, hopBasedDist);
};

/**
 * Authoritative backend fare calculator.
 * Supports both object signature `{ train, route, source, destination, srcIndex, destIndex, nodes, classCode }`
 * and positional signature `calculateSegmentFare(train, source, destination, classCode)`.
 */
const calculateSegmentFare = (arg1, arg2, arg3, arg4) => {
  let train, route, source, destination, srcIndex, destIndex, nodes, classCode;

  if (arg1 && typeof arg1 === 'object' && (arg1.train !== undefined || arg1.nodes !== undefined)) {
    train = arg1.train;
    route = arg1.route;
    source = arg1.source;
    destination = arg1.destination;
    srcIndex = arg1.srcIndex;
    destIndex = arg1.destIndex;
    nodes = arg1.nodes;
    classCode = arg1.classCode || arg1.coach_class;
  } else {
    train = arg1;
    source = arg2;
    destination = arg3;
    classCode = arg4;
  }

  // If source and destination strings provided without pre-matched segment nodes
  if ((!nodes || srcIndex === undefined || destIndex === undefined) && source && destination) {
    const { matchRouteSegment } = require('./routeSearch');
    const seg = matchRouteSegment(train, route, source, destination);
    if (!seg) {
      return null;
    }
    srcIndex = seg.srcIndex;
    destIndex = seg.destIndex;
    nodes = seg.nodes;
  }

  if (!nodes || nodes.length < 2) {
    nodes = buildOrderedStationNodes(train, route);
    srcIndex = 0;
    destIndex = nodes.length - 1;
  }

  const srcNode = nodes[srcIndex] || nodes[0];
  const destNode = nodes[destIndex] || nodes[nodes.length - 1];

  const depTime = srcNode?.depTime || srcNode?.arrTime || route?.departure_time || train?.departure_time || '10:00:00';
  const arrTime = destNode?.arrTime || destNode?.depTime || route?.arrival_time || train?.arrival_time || '18:00:00';

  const segmentDistanceKm = getSegmentDistanceKm(train, route, srcNode, destNode, srcIndex, destIndex, nodes);
  const segmentDurationMinutes = getSegmentDurationMinutes(depTime, arrTime);

  const fareMultiplier = parseFloat(route?.fare_multiplier || train?.fare_multiplier || 1.0);

  // Distance component (KM * BASE_RATE)
  const distanceComponent = segmentDistanceKm * BASE_RATE_PER_KM;

  // Duration component (Minutes * TIME_RATE)
  const timeComponent = segmentDurationMinutes * TIME_RATE_PER_MINUTE;

  // Raw base fare before rounding
  let rawBaseFare = (distanceComponent + timeComponent) * fareMultiplier;

  // Ensure minimum segment fare threshold to prevent unreasonable low fares
  rawBaseFare = Math.max(50, rawBaseFare);

  // Round to nearest ₹5 for clean railway fare standards
  const baseFareSL = Math.round(rawBaseFare / 5) * 5;

  const faresByClass = {};
  const tatkalChargesByClass = {};

  for (const [cls, mult] of Object.entries(CLASS_MULTIPLIERS)) {
    const classFare = Math.max(40, Math.round((baseFareSL * mult) / 5) * 5);
    faresByClass[cls] = classFare;
    tatkalChargesByClass[cls] = calculateTatkalCharge(cls, classFare);
  }

  const selectedClassFare = (classCode && typeof classCode === 'string')
    ? faresByClass[classCode.toUpperCase()] || baseFareSL
    : baseFareSL;

  const selectedTatkalCharge = (classCode && typeof classCode === 'string')
    ? tatkalChargesByClass[classCode.toUpperCase()] || calculateTatkalCharge(classCode, selectedClassFare)
    : calculateTatkalCharge('SL', selectedClassFare);

  // Developer logging for verification
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[FARE CALCULATOR] Train #${train?.train_number || 'N/A'}: ${srcNode?.code} -> ${destNode?.code} | Dist: ${segmentDistanceKm} km | Duration: ${segmentDurationMinutes} mins | Base: ₹${baseFareSL} | SL: ₹${faresByClass.SL} | 3A: ₹${faresByClass['3A']} | 2A: ₹${faresByClass['2A']} | 1A: ₹${faresByClass['1A']}`);
  }

  return {
    source: srcNode?.code,
    destination: destNode?.code,
    segment: {
      distance_km: segmentDistanceKm,
      duration_minutes: segmentDurationMinutes,
      departure: depTime.slice(0, 5),
      arrival: arrTime.slice(0, 5)
    },
    distance_km: segmentDistanceKm,
    duration_minutes: segmentDurationMinutes,
    base_fare: baseFareSL,
    fares_by_class: faresByClass,
    faresByClass,
    tatkal_charges_by_class: tatkalChargesByClass,
    tatkalChargesByClass,
    tatkal_charge: selectedTatkalCharge,
    class_fare: selectedClassFare
  };
};

/**
 * Calculates complete passenger fare breakdown including Tatkal surcharge and catering
 */
function calculateFareBreakdown({ baseFare = 500, coachClass = '3A', quota = 'GENERAL', passengersCount = 1, cateringCharge = 0 }) {
  const normQuota = (quota || 'GENERAL').toUpperCase();
  const isTatkal = normQuota === 'TQ' || normQuota === 'TATKAL' || normQuota === 'CK';
  const count = Math.max(1, parseInt(passengersCount, 10) || 1);
  const tatkalChargePerPassenger = isTatkal ? calculateTatkalCharge(coachClass, baseFare) : 0;
  const tatkalChargeTotal = tatkalChargePerPassenger * count;
  const baseFareTotal = baseFare * count;
  const cateringTotal = (cateringCharge || 0) * count;
  const totalFare = baseFareTotal + tatkalChargeTotal + cateringTotal;

  return {
    quota: isTatkal ? 'TATKAL' : 'GENERAL',
    isTatkal,
    passengersCount: count,
    baseFarePerPassenger: baseFare,
    baseFareTotal,
    tatkalChargePerPassenger,
    tatkalChargeTotal,
    cateringTotal,
    totalFare
  };
}

module.exports = {
  BASE_RATE_PER_KM,
  TIME_RATE_PER_MINUTE,
  CLASS_MULTIPLIERS,
  getSegmentDurationMinutes,
  getSegmentDistanceKm,
  calculateSegmentFare,
  calculateFareBreakdown,
  calculateTatkalCharge
};
