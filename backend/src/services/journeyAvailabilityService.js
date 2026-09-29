/**
 * Authoritative Centralized Railway Journey Time, Dates & Availability Engine
 * 
 * Shared by Passenger Search, Seat Selection, Admin, Staff, Bookings, and Seat Holds.
 * 
 * Responsibilities:
 * 1. Calculate correct departure and arrival dates across midnight and multi-day routes
 * 2. Calculate intermediate-station departure and arrival dates with accurate day offsets
 * 3. Authoritative dynamic seat availability: AVAILABLE, RAC, WL, FULL based on real bookings & capacity
 * 4. Determine if a train has departed from the passenger's selected boarding station
 * 5. Provide train statuses for Admin & Staff: UPCOMING, DEPARTED, RAC, WAITLIST, FULL, CANCELLED, COMPLETED
 * 6. Provide strict backend validation to reject booking and seat-holds after departure
 */

const { isTrainRunningOnDate, matchRouteSegment, buildOrderedStationNodes } = require('../utils/routeSearch');
const { normalizeClassList, getDefaultClassesForTrain } = require('../utils/trainClasses');

// Standard coach & berth capacities per travel class
const CLASS_CAPACITIES = {
  '1A': { capacity: 18, confirmed: 18, racLimit: 2, rac: 2, wlLimit: 10, wl: 10, maxCapacity: 30 },
  '2A': { capacity: 36, confirmed: 36, racLimit: 4, rac: 4, wlLimit: 15, wl: 15, maxCapacity: 55 },
  '3A': { capacity: 64, confirmed: 64, racLimit: 6, rac: 6, wlLimit: 13, wl: 13, maxCapacity: 83 },
  '3E': { capacity: 72, confirmed: 72, racLimit: 8, rac: 8, wlLimit: 25, wl: 25, maxCapacity: 105 },
  'EC': { capacity: 40, confirmed: 40, racLimit: 4, rac: 4, wlLimit: 15, wl: 15, maxCapacity: 59 },
  'CC': { capacity: 56, confirmed: 56, racLimit: 6, rac: 6, wlLimit: 20, wl: 20, maxCapacity: 82 },
  'FC': { capacity: 24, confirmed: 24, racLimit: 4, rac: 4, wlLimit: 15, wl: 15, maxCapacity: 43 },
  'SL': { capacity: 84, confirmed: 84, racLimit: 12, rac: 12, wlLimit: 40, wl: 40, maxCapacity: 136 },
  '2S': { capacity: 90, confirmed: 90, racLimit: 10, rac: 10, wlLimit: 30, wl: 30, maxCapacity: 130 },
  'GEN': { capacity: 100, confirmed: 100, racLimit: 0, rac: 0, wlLimit: 0, wl: 0, maxCapacity: 100 }
};

function getDb() {
  const sb = require('../config/supabase');
  return sb.mockDb || {};
}

/**
 * Returns current Indian Standard Time (IST) components
 */
function getNowIST() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }); // HH:MM:SS
  const [h, m, s] = timeStr.split(':').map(Number);
  const minutesFromMidnight = (h || 0) * 60 + (m || 0);
  return { now, dateStr, timeStr, minutesFromMidnight, h: h || 0, m: m || 0, s: s || 0 };
}

/**
 * Converts a time string (HH:MM or HH:MM:SS) to minutes past midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const clean = String(timeStr).trim().split(' ')[0];
  const parts = clean.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Adds integer days to YYYY-MM-DD string
 */
function addDaysToDateStr(dateStr, days = 0) {
  if (!dateStr) return '';
  const numDays = parseInt(days, 10) || 0;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + numDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a YYYY-MM-DD string to friendly format: "19 Sep 2026"
 */
function formatDateFriendly(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).trim().split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [y, m, d] = parts;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

/**
 * Formats duration in minutes to readable string: e.g. "8h 15m"
 */
function formatDuration(durationMinutes) {
  if (!durationMinutes || isNaN(durationMinutes) || durationMinutes <= 0) return '0h 0m';
  const hrs = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Resolves sequential day offsets for ordered station nodes along a route.
 * Accurately tracks midnight crossing even if stops lack explicit day_offset.
 */
function resolveRouteNodeDayOffsets(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const resolved = [];
  let currentDayOffset = 0;
  let prevDepMins = -1;

  for (let i = 0; i < nodes.length; i++) {
    const node = { ...nodes[i] };
    let explicitDay = -1;
    if (node.day_number !== undefined || node.dayNumber !== undefined) {
      const dNum = parseInt(node.day_number ?? node.dayNumber, 10);
      if (dNum > 0) explicitDay = dNum - 1;
    }
    if (explicitDay < 0) {
      explicitDay = parseInt(node.day_offset ?? node.dayOffset ?? node.day ?? -1, 10);
    }

    const arrMins = node.arrTime ? parseTimeToMinutes(node.arrTime) : -1;
    const depMins = node.depTime ? parseTimeToMinutes(node.depTime) : -1;

    if (i > 0 && prevDepMins >= 0) {
      const currentStationArrivalMins = arrMins >= 0 ? arrMins : depMins;
      if (currentStationArrivalMins >= 0 && currentStationArrivalMins < prevDepMins) {
        currentDayOffset += 1;
      }
    }

    if (arrMins >= 0 && depMins >= 0 && depMins < arrMins) {
      // Station halt crosses midnight
      currentDayOffset += 1;
    }

    if (explicitDay >= 0) {
      currentDayOffset = Math.max(currentDayOffset, explicitDay);
    }

    node.day_offset = currentDayOffset;
    resolved.push(node);

    if (depMins >= 0) {
      prevDepMins = depMins;
    } else if (arrMins >= 0) {
      prevDepMins = arrMins;
    }
  }

  return resolved;
}

/**
 * Checks if the train has already departed from a station at a specified date and time.
 * Evaluates against current IST server time (or simulated time for testing).
 */
function isDepartedFromStation(departureDate, departureTime, simulatedNow = null) {
  if (!departureDate) return false;
  const now = simulatedNow || getNowIST();
  const todayIst = now.dateStr || now.nowISTDate || getNowIST().dateStr;
  const currentMins = now.minutesFromMidnight !== undefined 
    ? now.minutesFromMidnight 
    : (now.nowISTMins !== undefined ? now.nowISTMins : getNowIST().minutesFromMidnight);
  if (departureDate < todayIst) return true;
  if (departureDate > todayIst) return false;
  const depMins = parseTimeToMinutes(departureTime);
  return currentMins >= depMins;
}

/**
 * Calculates complete, authoritative journey dates, times, and day offsets for a train segment.
 * Supports both object parameter `{ train, route, fromStation, toStation, travelDate, options }`
 * and positional parameters `(train, fromStation, toStation, travelDate, options)`.
 */
function calculateJourneyDatesAndTimes(param1, fromStationArg, toStationArg, travelDateArg, optionsArg) {
  let train, route, fromStation, toStation, travelDate, options;
  if (param1 && typeof param1 === 'object' && ('train' in param1 || (!param1.train_number && !param1.train_name && ('fromStation' in param1 || 'travelDate' in param1)))) {
    train = param1.train;
    route = param1.route || train?.route;
    fromStation = param1.fromStation;
    toStation = param1.toStation;
    travelDate = param1.travelDate;
    options = param1.options || optionsArg;
  } else {
    train = param1;
    route = train?.route;
    fromStation = fromStationArg;
    toStation = toStationArg;
    travelDate = travelDateArg;
    options = optionsArg;
  }

  const normDate = (travelDate || getNowIST().dateStr).trim();
  const rawNodes = buildOrderedStationNodes(train, route);
  const nodesWithOffsets = resolveRouteNodeDayOffsets(rawNodes);

  // Match the route segment
  const segment = matchRouteSegment(train, { ...(route || {}), stops: nodesWithOffsets }, fromStation, toStation);

  if (!segment) {
    // Fallback for direct train
    const depTime = (train?.departure_time || train?.scheduled_departure_time || route?.departure_time || '10:00:00').slice(0, 8);
    const arrTime = (train?.arrival_time || train?.scheduled_arrival_time || route?.arrival_time || '18:00:00').slice(0, 8);
    const depMins = parseTimeToMinutes(depTime);
    const arrMins = parseTimeToMinutes(arrTime);
    const dayOffset = arrMins < depMins ? 1 : (parseInt(train?.day_offset || route?.day_offset || 0, 10) || 0);

    const departureDate = normDate;
    const arrivalDate = addDaysToDateStr(departureDate, dayOffset);
    const durationMinutes = dayOffset * 1440 + (arrMins - depMins);

    const depFormatted = formatDateFriendly(departureDate);
    const arrFormatted = formatDateFriendly(arrivalDate);
    const isDeparted = isDepartedFromStation(departureDate, depTime, options);

    return {
      success: true,
      fromStationCode: train?.source_station_code || train?.source || 'NDLS',
      toStationCode: train?.destination_station_code || train?.destination || 'MMCT',
      fromStationName: train?.source_station_name || train?.source || 'New Delhi',
      toStationName: train?.destination_station_name || train?.destination || 'Mumbai Central',
      departureDate,
      departureTime: depTime.slice(0, 5),
      departureTimeFull: depTime,
      departureDateFormatted: depFormatted,
      arrivalDate,
      arrivalTime: arrTime.slice(0, 5),
      arrivalTimeFull: arrTime,
      arrivalDateFormatted: arrFormatted,
      dateRouteLabel: `Departure: ${depFormatted} → Arrival: ${arrFormatted}`,
      departureTimeFormatted: depTime.slice(0, 5),
      arrivalTimeFormatted: arrTime.slice(0, 5),
      durationMinutes: durationMinutes > 0 ? durationMinutes : 480,
      durationFormatted: formatDuration(durationMinutes > 0 ? durationMinutes : 480),
      dayOffset,
      isDeparted,
      stops: []
    };
  }

  const srcNode = segment.segmentNodes[0] || {};
  const destNode = segment.segmentNodes[segment.segmentNodes.length - 1] || {};

  // For boarding station, user searches with travelDate = departure date from that station
  const boardingDepartureDate = normDate;
  const boardingDepartureTime = (segment.departure_time || '10:00:00').slice(0, 8);

  const srcDayOffset = srcNode.day_offset || 0;
  const destDayOffset = destNode.day_offset || 0;
  let relativeDayOffset = Math.max(0, destDayOffset - srcDayOffset);

  const depMins = parseTimeToMinutes(boardingDepartureTime);
  const arrMins = parseTimeToMinutes(segment.arrival_time);

  if (relativeDayOffset === 0 && arrMins < depMins) {
    relativeDayOffset = 1;
  }

  const destinationArrivalDate = addDaysToDateStr(boardingDepartureDate, relativeDayOffset);
  const destinationArrivalTime = (segment.arrival_time || '18:00:00').slice(0, 8);

  const totalDurationMinutes = relativeDayOffset * 1440 + (arrMins - depMins);
  const durationFormatted = formatDuration(totalDurationMinutes > 0 ? totalDurationMinutes : 480);

  const depFormatted = formatDateFriendly(boardingDepartureDate);
  const arrFormatted = formatDateFriendly(destinationArrivalDate);
  const dateRouteLabel = `Departure: ${depFormatted} → Arrival: ${arrFormatted}`;

  const isDeparted = isDepartedFromStation(boardingDepartureDate, boardingDepartureTime, options);

  // Calculate dates for each intermediate stop along the segment
  const enrichedSegmentStops = segment.segmentNodes.map((node, idx) => {
    const nodeRelativeDay = Math.max(0, (node.day_offset || 0) - srcDayOffset);
    const nodeDate = addDaysToDateStr(boardingDepartureDate, nodeRelativeDay);
    return {
      sequence: idx + 1,
      stationCode: node.code,
      station_code: node.code,
      stationName: node.name,
      station_name: node.name,
      date: nodeDate,
      dateFormatted: formatDateFriendly(nodeDate),
      arrTime: node.arrTime ? node.arrTime.slice(0, 5) : '--:--',
      arrival_time: node.arrTime ? node.arrTime.slice(0, 5) : '--:--',
      depTime: node.depTime ? node.depTime.slice(0, 5) : '--:--',
      departure_time: node.depTime ? node.depTime.slice(0, 5) : '--:--',
      dayOffset: nodeRelativeDay,
      day_offset: nodeRelativeDay,
      distanceFromOriginKm: node.distanceFromOriginKm ?? node.distance_km ?? 0
    };
  });

  return {
    success: true,
    fromStationCode: segment.srcCode,
    toStationCode: segment.destCode,
    fromStationName: segment.srcName,
    toStationName: segment.destName,
    departureDate: boardingDepartureDate,
    departureTime: boardingDepartureTime.slice(0, 5),
    departureTimeFull: boardingDepartureTime,
    departureDateFormatted: depFormatted,
    arrivalDate: destinationArrivalDate,
    arrivalTime: destinationArrivalTime.slice(0, 5),
    arrivalTimeFull: destinationArrivalTime,
    arrivalDateFormatted: arrFormatted,
    dateRouteLabel,
    departureTimeFormatted: boardingDepartureTime.slice(0, 5),
    arrivalTimeFormatted: destinationArrivalTime.slice(0, 5),
    durationMinutes: totalDurationMinutes > 0 ? totalDurationMinutes : 480,
    durationFormatted,
    dayOffset: relativeDayOffset,
    isDeparted,
    stops: enrichedSegmentStops,
    segment,
    options,
    nowISTDate: options?.nowISTDate,
    nowISTMins: options?.nowISTMins
  };
}

/**
 * Centralized Authoritative Dynamic Seat Availability Calculation
 * 
 * Uses real bookings from the database (excluding cancelled) and configured class capacity.
 * Output statuses:
 * - AVAILABLE: confirmed seats are available
 * - RAC: confirmed capacity exhausted, RAC seats available
 * - WL: confirmed & RAC exhausted, waiting list available
 * - FULL: confirmed, RAC, and WL capacity exhausted
 */
function getAuthoritativeClassAvailability(param1, arg2, arg3, arg4, arg5) {
  let trainId, trainNumber, journeyDate, classCode, quota, trainObj;
  let confirmedBookedCount = 0;
  let activeHoldsCount = 0;
  let racBookedCount = 0;
  let wlBookedCount = 0;
  let isDirectCountCall = false;

  const { isTatkalQuota, getTatkalClassCapacity, getTatkalWindowStatus } = require('../utils/tatkalRules');

  if (typeof param1 === 'string') {
    isDirectCountCall = true;
    classCode = param1;
    confirmedBookedCount = parseInt(arg2 || 0, 10) || 0;
    activeHoldsCount = parseInt(arg3 || 0, 10) || 0;
    racBookedCount = parseInt(arg4 || 0, 10) || 0;
    wlBookedCount = parseInt(arg5 || 0, 10) || 0;
    quota = 'GN';
  } else if (param1 && typeof param1 === 'object') {
    trainId = param1.trainId || param1.train?.id;
    trainNumber = param1.trainNumber || param1.train?.train_number;
    journeyDate = param1.journeyDate || param1.travelDate;
    classCode = param1.classCode || '3A';
    quota = param1.quota || 'GN';
    trainObj = param1.train;
  } else {
    classCode = '3A';
    quota = 'GN';
  }

  const isTatkal = isTatkalQuota(quota);
  const normClass = String(classCode || '3A').trim().toUpperCase();
  const classCfg = CLASS_CAPACITIES[normClass] || { capacity: 48, confirmed: 48, racLimit: 6, rac: 6, wlLimit: 20, wl: 20, maxCapacity: 74 };
  
  const mockDb = getDb();
  if (!trainObj && mockDb && mockDb.trains) {
    trainObj = mockDb.trains.get(trainId) || 
      Array.from(mockDb.trains.values()).find(t => String(t.train_number) === String(trainNumber || trainId));
  }

  // Authoritative Tatkal Window check: if Tatkal requested and window is not yet open
  if (isTatkal && trainObj && journeyDate) {
    const route = mockDb && mockDb.routes ? Array.from(mockDb.routes.values()).find(r => r && (r.train_id === trainObj.id || String(r.train_number) === String(trainObj.train_number))) : null;
    const mockNowIST = param1?.mockNowIST || param1?.simulatedNow;
    const tatkalWin = getTatkalWindowStatus({
      train: trainObj,
      route,
      travelDate: journeyDate,
      classCode: normClass,
      simulatedNow: mockNowIST
    });

    if (!tatkalWin.isOpen) {
      return {
        status: tatkalWin.status,
        statusType: tatkalWin.status === 'DEPARTED' ? 'DEPARTED' : 'NOT_OPEN',
        statusCode: tatkalWin.statusCode,
        statusLabel: tatkalWin.statusLabel,
        availableCount: 0,
        confirmedCount: 0,
        racCount: 0,
        wlCount: 0,
        totalCapacity: getTatkalClassCapacity(trainObj, normClass),
        racLimit: 0,
        wlLimit: 10,
        tatkalWindow: tatkalWin,
        isBookable: false
      };
    }
  }

  const totalCapacity = isTatkal 
    ? getTatkalClassCapacity(trainObj, normClass)
    : (parseInt(trainObj?.capacity?.[normClass], 10) || classCfg.capacity || classCfg.confirmed || 48);
  const racLimit = isTatkal ? 0 : (classCfg.racLimit || classCfg.rac || 6);
  const wlLimit = isTatkal ? 10 : (classCfg.wlLimit || classCfg.wl || 20);

  if (!isDirectCountCall) {
    const strTrainId = String(trainId || '');
    const strTrainNo = String(trainNumber || '');

    const bookingsSource = param1.activeBookings || param1.bookings || (mockDb && mockDb.bookings ? Array.from(mockDb.bookings.values()) : []);
    for (const b of bookingsSource) {
      if (!b) continue;
      const bTrainId = String(b.train_id || '');
      const bTrainNum = String(b.train_number || b.trainNo || (mockDb.trains?.get(b.train_id)?.train_number) || '');

      const matchesTrain = (strTrainId && (bTrainId === strTrainId || bTrainNum === strTrainId)) ||
                           (strTrainNo && (bTrainId === strTrainNo || bTrainNum === strTrainNo));

      if (!matchesTrain) continue;
        if (b.travel_date !== journeyDate) continue;

        const bStatus = String(b.status || b.booking_status || '').toLowerCase();
        if (bStatus.includes('cancel') || bStatus === 'auto_cancelled') continue;

        // Quota Isolation: Tatkal inventory counts only Tatkal bookings; General counts only non-Tatkal bookings
        const bIsTatkal = isTatkalQuota(b.quota);
        if (isTatkal !== bIsTatkal) continue;

        const bClass = String(b.coach_class || b.class || b.class_code || '').trim().toUpperCase();
        if (bClass !== normClass) continue;

        const seatsCount = Array.isArray(b.passengers) && b.passengers.length > 0
          ? b.passengers.length
          : (parseInt(b.passenger_count || b.passengers || 1, 10) || 1);

        if (bStatus.includes('rac')) {
          racBookedCount += seatsCount;
        } else if (bStatus.includes('wait') || bStatus.includes('wl')) {
          wlBookedCount += seatsCount;
        } else {
          confirmedBookedCount += seatsCount;
        }
      }

    try {
      const { getActiveHolds } = require('./reservationAvailabilityService');
      if (typeof getActiveHolds === 'function') {
        const holds = getActiveHolds(trainId, journeyDate, normClass, quota);
        activeHoldsCount = Array.isArray(holds) ? holds.length : 0;
      }
    } catch (e) {
      activeHoldsCount = 0;
    }
  }

  // Handle count overflow from confirmed -> RAC -> WL -> FULL
  let effectiveConfirmed = confirmedBookedCount + activeHoldsCount;
  let overflowToRac = 0;
  if (effectiveConfirmed > totalCapacity) {
    overflowToRac = effectiveConfirmed - totalCapacity;
    effectiveConfirmed = totalCapacity;
  }
  let effectiveRac = racBookedCount + overflowToRac;
  let overflowToWl = 0;
  if (effectiveRac > racLimit) {
    overflowToWl = effectiveRac - racLimit;
    effectiveRac = racLimit;
  }
  let effectiveWl = wlBookedCount + overflowToWl;

  if (effectiveConfirmed < totalCapacity) {
    const available = totalCapacity - effectiveConfirmed;
    return {
      status: 'AVAILABLE',
      statusType: 'AVAILABLE',
      statusCode: `AVAILABLE ${available}`,
      statusLabel: `AVAILABLE ${available}`,
      availableCount: available,
      confirmedCount: effectiveConfirmed,
      racCount: 0,
      wlCount: 0,
      totalCapacity,
      racLimit,
      wlLimit,
      quota: isTatkal ? 'TATKAL' : 'GENERAL',
      isBookable: true
    };
  }

  if (racLimit > 0 && effectiveRac < racLimit) {
    const racPosition = effectiveRac + 1;
    return {
      status: 'RAC',
      statusType: 'RAC',
      statusCode: `RAC ${racPosition}`,
      statusLabel: `RAC ${racPosition}`,
      availableCount: racLimit - effectiveRac,
      confirmedCount: totalCapacity,
      racCount: racPosition,
      wlCount: 0,
      totalCapacity,
      racLimit,
      wlLimit,
      quota: isTatkal ? 'TATKAL' : 'GENERAL',
      isBookable: true
    };
  }

  if (effectiveWl < wlLimit) {
    const wlPosition = effectiveWl + 1;
    const wlCode = isTatkal ? `TQWL ${wlPosition}` : `WL ${wlPosition}`;
    return {
      status: isTatkal ? 'TQWL' : 'WL',
      statusType: isTatkal ? 'TQWL' : 'WL',
      statusCode: wlCode,
      statusLabel: wlCode,
      availableCount: wlLimit - effectiveWl,
      confirmedCount: totalCapacity,
      racCount: racLimit,
      wlCount: wlPosition,
      totalCapacity,
      racLimit,
      wlLimit,
      quota: isTatkal ? 'TATKAL' : 'GENERAL',
      waitlistType: isTatkal ? 'TQWL' : 'GNWL',
      isBookable: true
    };
  }

  return {
    status: isTatkal ? 'TATKAL_FULL' : 'FULL',
    statusType: isTatkal ? 'TATKAL_FULL' : 'FULL',
    statusCode: isTatkal ? 'TATKAL FULL' : 'FULL (REGRET)',
    statusLabel: isTatkal ? 'TATKAL FULL' : 'FULL (REGRET)',
    availableCount: 0,
    confirmedCount: totalCapacity,
    racCount: racLimit,
    wlCount: wlLimit,
    totalCapacity,
    racLimit,
    wlLimit,
    quota: isTatkal ? 'TATKAL' : 'GENERAL',
    isBookable: false
  };
}

/**
 * Computes availability map across all configured classes of a train.
 */
function getTrainAvailabilityMap(train, journeyDate, quota = 'GN') {
  const trainClasses = (Array.isArray(train.available_classes) && train.available_classes.length > 0)
    ? normalizeClassList(train.available_classes)
    : getDefaultClassesForTrain(train.train_name, train.train_type || train.trainType);

  const availabilityMap = {};
  for (const cls of trainClasses) {
    availabilityMap[cls] = getAuthoritativeClassAvailability({
      trainId: train.id,
      trainNumber: train.train_number,
      journeyDate,
      classCode: cls,
      quota
    });
  }
  return availabilityMap;
}

/**
 * Determines comprehensive train status for Admin & Staff:
 * UPCOMING, DEPARTED, RAC, WAITLIST, FULL, CANCELLED, COMPLETED
 */
function getTrainOperationalAndBookingStatus(param1, param2, param3) {
  let train, route, journey, date, availabilityMap;

  if (param1 && typeof param1 === 'object' && ('train' in param1)) {
    train = param1.train;
    route = param1.route;
    date = param1.date;
  } else {
    train = param1;
    if (param2 && (param2.departureDate || param2.departure_date || 'isDeparted' in param2)) {
      journey = param2;
    } else {
      route = param2;
    }
    if (param3 && typeof param3 === 'object') {
      availabilityMap = param3;
    } else if (typeof param3 === 'string') {
      date = param3;
    }
  }

  const targetDate = date || (journey?.departureDate) || train?.service_date || train?.run_date || getNowIST().dateStr;
  const isCancelled = String(train?.status || '').toLowerCase() === 'cancelled' ||
                      String(train?.service_status || '').toLowerCase() === 'cancelled';

  if (!journey) {
    journey = calculateJourneyDatesAndTimes({
      train,
      route,
      fromStation: train?.source_station_code || train?.source,
      toStation: train?.destination_station_code || train?.destination,
      travelDate: targetDate
    });
  }

  if (isCancelled) {
    const result = {
      status: 'CANCELLED',
      operationalStatus: 'CANCELLED',
      bookingStatus: 'CANCELLED',
      departureDate: journey.departureDate,
      departureTime: journey.departureTime,
      departureDateFormatted: journey.departureDateFormatted,
      arrivalDate: journey.arrivalDate,
      arrivalTime: journey.arrivalTime,
      arrivalDateFormatted: journey.arrivalDateFormatted,
      dateRouteLabel: journey.dateRouteLabel,
      durationFormatted: journey.durationFormatted,
      isUpcoming: false,
      isDeparted: false,
      isCompleted: false
    };
    result[Symbol.toPrimitive] = () => 'CANCELLED';
    result.toString = () => 'CANCELLED';
    return result;
  }

  const ist = getNowIST();
  const todayIst = journey.nowISTDate || journey.options?.nowISTDate || ist.dateStr;
  const currentMins = journey.nowISTMins !== undefined ? journey.nowISTMins : (journey.options?.nowISTMins !== undefined ? journey.options?.nowISTMins : ist.minutesFromMidnight);
  const depDate = journey.departureDate;
  const arrDate = journey.arrivalDate;
  const depMins = parseTimeToMinutes(journey.departureTime);
  const arrMins = parseTimeToMinutes(journey.arrivalTime);

  let operationalStatus = 'UPCOMING';
  if (journey.isDeparted) {
    operationalStatus = 'DEPARTED';
  } else if (arrDate < todayIst || (arrDate === todayIst && currentMins >= arrMins)) {
    operationalStatus = 'COMPLETED';
  } else if (depDate < todayIst || (depDate === todayIst && currentMins >= depMins)) {
    operationalStatus = 'DEPARTED';
  } else {
    operationalStatus = 'UPCOMING';
  }

  // Capacity / Reservation status for upcoming trains
  let bookingStatus = 'AVAILABLE';
  if (operationalStatus === 'UPCOMING') {
    if (availabilityMap) {
      let anyAvailable = false;
      let anyRac = false;
      let anyWl = false;

      for (const av of Object.values(availabilityMap)) {
        if (!av) continue;
        const st = av.statusType || av.status;
        if (st === 'AVAILABLE') anyAvailable = true;
        else if (st === 'RAC') anyRac = true;
        else if (st === 'WL') anyWl = true;
      }

      if (anyAvailable) bookingStatus = 'AVAILABLE';
      else if (anyRac) bookingStatus = 'RAC';
      else if (anyWl) bookingStatus = 'WAITLIST';
      else bookingStatus = 'FULL';
    } else {
      const classes = train?.available_classes || ['3A', '2A', 'SL'];
      let anyAvailable = false;
      let anyRac = false;
      let anyWl = false;

      for (const c of classes) {
        const clsCode = typeof c === 'object' ? c.code : c;
        const av = getAuthoritativeClassAvailability({
          trainId: train?.id,
          trainNumber: train?.train_number,
          journeyDate: depDate,
          classCode: clsCode
        });
        if (av.statusType === 'AVAILABLE') anyAvailable = true;
        else if (av.statusType === 'RAC') anyRac = true;
        else if (av.statusType === 'WL') anyWl = true;
      }

      if (anyAvailable) bookingStatus = 'AVAILABLE';
      else if (anyRac) bookingStatus = 'RAC';
      else if (anyWl) bookingStatus = 'WAITLIST';
      else bookingStatus = 'FULL';
    }
  }

  // Primary status shown on status badges
  let primaryStatus = operationalStatus;
  if (operationalStatus === 'UPCOMING') {
    if (bookingStatus === 'RAC') primaryStatus = 'RAC';
    else if (bookingStatus === 'WAITLIST') primaryStatus = 'WAITLIST';
    else if (bookingStatus === 'FULL') primaryStatus = 'FULL';
    else primaryStatus = 'UPCOMING';
  }

  const result = {
    status: primaryStatus,
    operationalStatus,
    bookingStatus,
    departureDate: journey.departureDate,
    departureTime: journey.departureTime,
    departureDateFormatted: journey.departureDateFormatted,
    arrivalDate: journey.arrivalDate,
    arrivalTime: journey.arrivalTime,
    arrivalDateFormatted: journey.arrivalDateFormatted,
    dateRouteLabel: journey.dateRouteLabel,
    durationFormatted: journey.durationFormatted,
    isUpcoming: operationalStatus === 'UPCOMING',
    isDeparted: operationalStatus === 'DEPARTED',
    isCompleted: operationalStatus === 'COMPLETED'
  };

  result[Symbol.toPrimitive] = () => primaryStatus;
  result.toString = () => primaryStatus;
  return result;
}

/**
 * Authoritative backend check: Rejects booking or seat-hold if departure time has passed.
 */
function validateBookingAuthority(param1, fromStationArg, toStationArg, travelDateArg, classCodeArg, countArg, optionsArg) {
  let train, trainId, fromStation, toStation, travelDate, classCode, passengerCount, options;
  if (param1 && typeof param1 === 'object' && ('trainId' in param1 || 'train_id' in param1 || 'travelDate' in param1 || 'journey_date' in param1 || 'source' in param1 || 'fromStation' in param1)) {
    trainId = param1.trainId || param1.train_id || param1.trainNumber || param1.train_number;
    fromStation = param1.fromStation || param1.source || param1.from_station;
    toStation = param1.toStation || param1.destination || param1.to_station;
    travelDate = param1.travelDate || param1.journey_date || param1.journeyDate;
    classCode = param1.classCode || param1.class_code || param1.coachClass || '3A';
    passengerCount = param1.passengerCount || param1.passengersCount || 1;
    options = param1.options || optionsArg;
  } else {
    train = (typeof param1 === 'object') ? param1 : null;
    trainId = train?.id || train?.train_number || (typeof param1 === 'string' ? param1 : null);
    
    // Support flexible signature: (trainId, travelDate, classCode)
    if (typeof fromStationArg === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromStationArg)) {
      travelDate = fromStationArg;
      classCode = toStationArg || '3A';
      fromStation = null;
      toStation = null;
    } else {
      fromStation = fromStationArg;
      toStation = toStationArg;
      travelDate = travelDateArg;
      classCode = classCodeArg || '3A';
    }
    passengerCount = countArg || 1;
    options = optionsArg;
  }

  const mockDb = getDb();
  if (!train) {
    train = mockDb.trains?.get(trainId);
    if (!train && mockDb.trains) {
      train = Array.from(mockDb.trains.values()).find(t => t.id === trainId || String(t.train_number) === String(trainId) || t.train_number === trainId);
    }
  }

  if (!train) {
    return { valid: true, isValid: true, allowed: true, isAllowed: true };
  }

  // Check past travel date immediately
  const { normalizeDateStr, isTrainRunningOnDate } = require('../utils/routeSearch');
  const ist = getNowIST();
  const effectiveTodayIst = options?.nowISTDate || ist.dateStr;
  if (travelDate && normalizeDateStr(travelDate) < effectiveTodayIst) {
    return {
      valid: false,
      isValid: false,
      allowed: false,
      isAllowed: false,
      code: 'TRAIN_DEPARTED',
      reason: 'JOURNEY_DATE_IN_PAST',
      error: `Booking unavailable: Travel date ${travelDate} has already passed.`,
      isPast: true,
      isDeparted: true
    };
  }

  const routes = Array.from(mockDb.routes?.values() || []);
  const route = train?.route || routes.find(r => r && (r.train_id === train.id || (train.train_number && String(r.train_number) === String(train.train_number)) || (train.route_id && r.id === train.route_id))) || null;

  // Validate station segment if provided
  if (fromStation && toStation) {
    const normFrom = String(fromStation).trim().toUpperCase();
    const normTo = String(toStation).trim().toUpperCase();
    const stops = Array.isArray(route?.stops) && route.stops.length > 0 ? route.stops : null;
    if (stops) {
      const fromIdx = stops.findIndex(s => (s.station_code || s.stationCode || s.code || '').toUpperCase() === normFrom);
      const toIdx = stops.findIndex(s => (s.station_code || s.stationCode || s.code || '').toUpperCase() === normTo);
      if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) {
        return {
          valid: false,
          isValid: false,
          allowed: false,
          isAllowed: false,
          code: 'INVALID_SEGMENT',
          reason: 'INVALID_SEGMENT',
          error: `Invalid journey segment: ${fromStation} to ${toStation} is not a valid route segment for Train #${train.train_number}.`
        };
      }
    } else {
      const trainSrc = (train.source_station_code || train.source || '').toUpperCase();
      const trainDest = (train.destination_station_code || train.destination || '').toUpperCase();
      if ((trainSrc && normFrom !== trainSrc) || (trainDest && normTo !== trainDest)) {
        return {
          valid: false,
          isValid: false,
          allowed: false,
          isAllowed: false,
          code: 'INVALID_SEGMENT',
          reason: 'INVALID_SEGMENT',
          error: `Invalid journey segment: ${fromStation} to ${toStation} does not match Train #${train.train_number}.`
        };
      }
    }
  }

  const journey = calculateJourneyDatesAndTimes({
    train,
    route,
    fromStation: fromStation || train.source_station_code || train.source,
    toStation: toStation || train.destination_station_code || train.destination,
    travelDate,
    options
  });

  if (journey.isDeparted) {
    return {
      valid: false,
      isValid: false,
      allowed: false,
      isAllowed: false,
      code: 'TRAIN_DEPARTED',
      reason: 'TRAIN_DEPARTED',
      error: `Booking closed: Train #${train.train_number} (${train.train_name}) has already departed from ${journey.fromStationName || fromStation} on ${journey.departureDateFormatted} at ${journey.departureTimeFormatted}.`,
      isDeparted: true,
      departureDate: journey.departureDate,
      departureTime: journey.departureTime
    };
  }

  // Validate that requested travel class is configured on this train
  const normClass = String(classCode || '').trim().toUpperCase();
  if (normClass && Array.isArray(train.available_classes) && train.available_classes.length > 0) {
    const supportedClasses = normalizeClassList(train.available_classes);
    if (!supportedClasses.includes(normClass)) {
      return {
        valid: false,
        isValid: false,
        allowed: false,
        isAllowed: false,
        code: 'UNSUPPORTED_CLASS',
        reason: 'UNSUPPORTED_CLASS',
        error: `Booking unavailable: Class ${normClass} is not available on Train #${train.train_number} (${train.train_name}). Configured classes: ${supportedClasses.join(', ')}.`,
        supportedClasses
      };
    }
  }

  // Validate train running days
  if (travelDate && !isTrainRunningOnDate(train, route, travelDate) && String(train.status).toLowerCase() !== 'cancelled') {
    return {
      valid: false,
      isValid: false,
      allowed: false,
      isAllowed: false,
      code: 'TRAIN_NOT_RUNNING',
      reason: 'TRAIN_NOT_RUNNING',
      error: 'Train is not scheduled for the selected journey date.',
      operatingDays: train.operating_days || train.frequency || train.running_days
    };
  }

  const isStrictlySingleDateTrain = Boolean(
    (train?.is_date_specific === true || route?.is_date_specific === true || train?.service_type === 'DATE_SPECIFIC') &&
    !train?.service_pattern && !route?.service_pattern &&
    !(Array.isArray(train?.specific_service_dates) && train.specific_service_dates.length > 1) &&
    !(Array.isArray(route?.specific_service_dates) && route.specific_service_dates.length > 1) &&
    train?.frequency !== 'Daily' && train?.running_days !== 'Daily' &&
    !String(train?.frequency || '').toLowerCase().includes('every')
  );

  if (isStrictlySingleDateTrain) {
    const targetDate = normalizeDateStr(train.journey_date || route?.journey_date || train.service_start_date);
    const reqDate = normalizeDateStr(travelDate);
    if (targetDate && reqDate && reqDate !== targetDate) {
      return {
        valid: false,
        isValid: false,
        allowed: false,
        isAllowed: false,
        code: 'INVALID_JOURNEY_DATE',
        reason: 'INVALID_JOURNEY_DATE',
        error: 'Train is not scheduled for the selected journey date.',
        targetDate
      };
    }
  }

  return {
    valid: true,
    isValid: true,
    allowed: true,
    isAllowed: true,
    code: 'OK',
    journey
  };
}

module.exports = {
  getNowIST,
  parseTimeToMinutes,
  addDaysToDateStr,
  formatDateFriendly,
  formatDuration,
  resolveRouteNodeDayOffsets,
  isDepartedFromStation,
  calculateJourneyDatesAndTimes,
  getAuthoritativeClassAvailability,
  getTrainAvailabilityMap,
  getTrainOperationalAndBookingStatus,
  validateBookingAuthority,
  CLASS_CAPACITIES
};
