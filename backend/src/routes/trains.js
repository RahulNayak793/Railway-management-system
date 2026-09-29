const express = require('express');
const router = express.Router();
const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken, requireRoles, requirePermission } = require('../middleware/auth');
const {
  extractStationCode,
  matchRouteSegment,
  isTrainRunningOnDate,
  calculateOvernightOffset,
  formatDateFriendly,
  getNextServiceDateTime,
  formatJourneyDuration,
  normalizeDateStr
} = require('../utils/routeSearch');
const { calculateSegmentFare } = require('../utils/fareCalculator');
const { normalizeClassList, getDefaultClassesForTrain } = require('../utils/trainClasses');
const { evaluateCateringEligibility, getTrainCateringConfig } = require('../services/cateringEligibility');
const { parseAndValidateFoodConfig } = require('../utils/trainFood');

const { getLiveStatusForTrain } = require('../utils/liveStatusHelper');
const { broadcastTelemetryUpdate } = require('./tracking');

const {
  getTrainSeatAvailability,
  createTemporaryHold,
  releaseTemporaryHold,
  verifyAndLockSeat,
  reassignSeat,
  getAuditLogs
} = require('../services/reservationAvailabilityService');

const {
  isServicePastDeparture,
  calculateDeterministicAvailability,
  calculateDateWiseAvailability,
  getClassDateAvailability,
  getClassAvailabilityDates,
  generateServiceInstances,
  getServicesForDate,
  getDateSummaryMetrics
} = require('../services/trainServiceInstanceService');

const {
  calculateJourneyDatesAndTimes,
  getAuthoritativeClassAvailability,
  getTrainAvailabilityMap,
  validateBookingAuthority
} = require('../services/journeyAvailabilityService');

const ensure24HourTime = (timeStr) => {
  if (!timeStr) return '12:00:00';
  const cleanStr = String(timeStr).trim();
  if (cleanStr.toUpperCase().includes('AM') || cleanStr.toUpperCase().includes('PM')) {
    const parts = cleanStr.split(/\s+/);
    const timePart = parts[0];
    const ampm = parts[1] ? parts[1].toUpperCase() : 'AM';
    let [hours, minutes] = timePart.split(':');
    let h = parseInt(hours, 10);
    if (h === 12) {
      h = 0;
    }
    if (ampm === 'PM') {
      h += 12;
    }
    return `${String(h).padStart(2, '0')}:${minutes || '00'}:00`;
  }
  if (cleanStr.length === 5) return `${cleanStr}:00`;
  return cleanStr;
};

/**
 * Validates intermediate stop chronology, halt durations, and overnight progression.
 */
const validateStopChronology = (departure_time, arrival_time, stops, day_offset = 0) => {
  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    return { valid: true, enrichedStops: [] };
  }

  const parseMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = String(timeStr).trim().slice(0, 5).split(':').map(Number);
    if (isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  const originDepM = parseMinutes(departure_time);
  const destArrM = parseMinutes(arrival_time);

  if (originDepM === null || destArrM === null) {
    return { valid: false, error: 'Origin departure time and destination arrival time must be valid HH:MM format.' };
  }

  let finalDestM = destArrM + (day_offset || 0) * 1440;
  if (finalDestM <= originDepM && (!day_offset || day_offset === 0)) {
    finalDestM += 1440;
  }

  let currentMinute = originDepM;
  let currentDayOffset = 0;
  const enrichedStops = [];

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const stCode = extractStationCode(s.stationCode || s.station || s.code);
    if (!stCode) {
      return { valid: false, error: `Stop #${i + 1} is missing a valid station code.` };
    }

    const arrStr = s.arrTime || s.arrival_time;
    const depStr = s.depTime || s.departure_time;

    const stopArrM = parseMinutes(arrStr);
    const stopDepM = parseMinutes(depStr);

    if (stopArrM === null || stopDepM === null) {
      return { valid: false, error: `Stop ${stCode} has invalid arrival or departure time format (expected HH:MM).` };
    }

    // Determine stop arrival in absolute cumulative minutes
    let absStopArr = stopArrM + currentDayOffset * 1440;
    if (absStopArr < currentMinute) {
      currentDayOffset += 1;
      absStopArr = stopArrM + currentDayOffset * 1440;
    }

    // Determine stop departure in absolute cumulative minutes
    let absStopDep = stopDepM + currentDayOffset * 1440;
    if (absStopDep < absStopArr) {
      currentDayOffset += 1;
      absStopDep = stopDepM + currentDayOffset * 1440;
    }

    const haltMinutes = absStopDep - absStopArr;
    if (haltMinutes < 0) {
      return { valid: false, error: `Stop ${stCode} departure time cannot be earlier than arrival time.` };
    }

    if (absStopArr < originDepM) {
      return { valid: false, error: `Stop ${stCode} arrival cannot be before train origin departure.` };
    }

    if (absStopDep > finalDestM) {
      return { valid: false, error: `Stop ${stCode} departure (${depStr}) exceeds destination arrival time.` };
    }

    currentMinute = absStopDep;

    enrichedStops.push({
      ...s,
      stationCode: stCode,
      station: stCode,
      arrTime: ensure24HourTime(arrStr).slice(0, 5),
      arrival_time: ensure24HourTime(arrStr),
      depTime: ensure24HourTime(depStr).slice(0, 5),
      departure_time: ensure24HourTime(depStr),
      haltMinutes,
      day_offset: currentDayOffset
    });
  }

  return { valid: true, enrichedStops };
};

/**
 * Checks whether any bookings exist for a train (for safe deactivation vs hard delete).
 */
const checkTrainBookings = async (trainId, trainNumber) => {
  if (isMockMode) {
    const bookings = Array.from(mockDb.bookings.values());
    return bookings.some(b => 
      b && (
        String(b.train_id) === String(trainId) || 
        String(b.train_number) === String(trainNumber) || 
        String(b.trainId) === String(trainId) || 
        String(b.trainNo) === String(trainNumber)
      )
    );
  } else {
    try {
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .or(`train_id.eq.${trainId},train_number.eq.${trainNumber}`);
      if (error) throw error;
      return (count || 0) > 0;
    } catch (e) {
      console.error('Error checking bookings for train:', e.message);
      return false;
    }
  }
};

const { getRailwaySystemStatus } = require('../services/railwayIntegrationService');

// GET /api/trains/data-source-status - Railway Data Source & System Connection Status
router.get('/data-source-status', async (req, res) => {
  const status = await getRailwaySystemStatus();
  return res.json(status);
});

// GET /api/trains/live-search - Real-Time RailRadar Train Search Integration
router.get('/live-search', async (req, res) => {
  try {
    const from = req.query.from || req.query.source;
    const to = req.query.to || req.query.destination;
    const rawDate = req.query.date;
    const date = normalizeDateStr(rawDate);
    const time = req.query.time || req.query.searchTime || '18:30';
    const reqQuota = (req.query.quota || req.query.classQuota || 'GN').toUpperCase();

    if (!from || !to || !rawDate) {
      return res.status(400).json({
        success: false,
        error: 'Please select valid departure station, destination station, date and time.'
      });
    }

    const fromCode = extractStationCode(from);
    const toCode = extractStationCode(to);

    if (!fromCode || !toCode || fromCode === toCode) {
      return res.status(400).json({
        success: false,
        error: 'Please select valid departure station and destination station.'
      });
    }

    let trainsList = [];
    let routesList = [];

    if (isMockMode) {
      trainsList = Array.from(mockDb.trains.values()).filter(t => !!t && t.status !== 'inactive' && t.status !== 'cancelled');
      routesList = Array.from(mockDb.routes.values());
    } else {
      try {
        const { data: dbTrains, error: tErr } = await supabase.from('trains').select('*, routes(*)');
        if (tErr) throw tErr;
        trainsList = (dbTrains || []).filter(t => !!t && t.status !== 'inactive' && t.status !== 'cancelled');
        routesList = trainsList.flatMap(t => t.routes || []);
      } catch (dbErr) {
        trainsList = Array.from(mockDb.trains.values()).filter(t => !!t && t.status !== 'inactive' && t.status !== 'cancelled');
        routesList = Array.from(mockDb.routes.values());
      }
    }

    if (process.env.NODE_ENV !== 'test') {
      trainsList = trainsList.filter(t => t.record_source !== 'test');
    }

    const matchedTrains = [];
    const seenTrainKeys = new Set();

    for (const t of trainsList) {
      if (!t) continue;
      const route = routesList.find(r => r && (r.train_id === t.id || String(r.train_number) === String(t.train_number) || r.id === t.route_id)) || { stops: t.stops || [] };

      // Validate running date
      if (date && !isTrainRunningOnDate(t, route, date)) {
        continue;
      }

      // Match route segment using complete stop sequence & alias matching
      const segment = matchRouteSegment(t, route, from, to);

      if (segment) {
        const uniqueKey = `${String(t.train_number)}_${date}_${segment.srcCode}_${segment.destCode}`;
        if (seenTrainKeys.has(uniqueKey)) {
          continue; // Prevent duplicate train entries
        }
        seenTrainKeys.add(uniqueKey);

        const journey = calculateJourneyDatesAndTimes({
          train: t,
          route,
          fromStation: from,
          toStation: to,
          travelDate: date
        });

        // Requirement 3: Once train departure time from passenger's selected boarding station has passed,
        // completely remove that train from Passenger Search.
        if (journey.isDeparted) {
          continue;
        }

        const fareInfo = calculateSegmentFare({
          train: t,
          route,
          srcIndex: segment.srcIndex,
          destIndex: segment.destIndex,
          nodes: segment.nodes
        });

        const journeyDurationStr = journey.durationFormatted || formatJourneyDuration(fareInfo.duration_minutes);

        const enrichedRoute = {
          ...(route || {}),
          source_station_code: segment.srcCode,
          destination_station_code: segment.destCode,
          source_station_name: segment.srcName,
          destination_station_name: segment.destName,
          departure_time: journey.departureTime || segment.departure_time,
          arrival_time: journey.arrivalTime || segment.arrival_time,
          departure_date: journey.departureDate,
          arrival_date: journey.arrivalDate,
          departure_date_formatted: journey.departureDateFormatted,
          arrival_date_formatted: journey.arrivalDateFormatted,
          date_route_label: journey.dateRouteLabel,
          original_source: route?.source_station_code || t.source_station_code || t.source,
          original_destination: route?.destination_station_code || t.destination_station_code || t.destination,
          stops: journey.stops && journey.stops.length > 0 ? journey.stops : (segment.nodes || route?.stops || []),
          distance_km: fareInfo.distance_km,
          duration_minutes: journey.durationMinutes || fareInfo.duration_minutes,
          journey_duration: journeyDurationStr,
          base_fare: fareInfo.base_fare,
          segment_fares: fareInfo
        };

        const trainClasses = (Array.isArray(t.available_classes) && t.available_classes.length > 0)
          ? normalizeClassList(t.available_classes)
          : getDefaultClassesForTrain(t.train_name, t.train_type || t.trainType);

        let liveStatusData = null;
        try {
          liveStatusData = await getLiveStatusForTrain(t.train_number, journey.departureDate || date);
        } catch (e) {
          console.error(`Live status lookup error for train ${t.train_number}:`, e.message);
        }

        const liveStatusSource = liveStatusData
          ? (String(liveStatusData.data_source || liveStatusData.source || '').toLowerCase().includes('railradar') ? 'railradar' : 'railcontrol_fallback')
          : 'railcontrol_fallback';

        // Check if journey date is in future relative to today IST
        const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const isFutureJourney = (journey.departureDate || date) > todayIst;

        const serviceKey = `svc-${t.train_number}-${journey.departureDate || date}`;
        const serviceInstance = isMockMode 
          ? (mockDb.train_services?.get(serviceKey) || Array.from(mockDb.train_services?.values() || []).find(s => String(s.train_number) === String(t.train_number) && s.service_date === (journey.departureDate || date)))
          : null;

        let liveStatusState = 'SCHEDULED';
        if (isFutureJourney || liveStatusData?.status?.state === 'NOT_STARTED') {
          liveStatusState = 'SCHEDULED';
        } else if (liveStatusData?.status?.state === 'LIVE') {
          liveStatusState = 'RUNNING';
        } else if (liveStatusData?.status?.state) {
          liveStatusState = liveStatusData.status.state;
        } else if (serviceInstance?.status) {
          liveStatusState = serviceInstance.status;
        } else {
          liveStatusState = 'SCHEDULED';
        }

        const liveStatusObj = liveStatusData ? {
          ...liveStatusData,
          status: liveStatusState,
          current_station: isFutureJourney ? segment.srcCode : (liveStatusData.telemetry?.current_station_code || segment.srcCode),
          next_station: isFutureJourney ? segment.destCode : (liveStatusData.telemetry?.next_station_code || segment.destCode),
          delay_minutes: isFutureJourney ? 0 : (liveStatusData.telemetry?.delay_minutes ?? 0),
          speed: isFutureJourney ? 0 : (liveStatusData.telemetry?.speed ?? 0),
          source: liveStatusSource,
          data_source_label: liveStatusData.data_source_label || (liveStatusSource === 'railradar' ? 'Live Data Source: RailRadar' : 'LIVE DATA UNAVAILABLE - Showing RailControl scheduled train information')
        } : {
          trainNumber: String(t.train_number),
          trainName: t.train_name,
          status: 'SCHEDULED',
          currentStation: segment.srcCode,
          current_station: segment.srcCode,
          nextStation: segment.destCode,
          next_station: segment.destCode,
          delayMinutes: 0,
          delay_minutes: 0,
          speed: 0,
          scheduledArrival: journey.arrivalTimeFormatted || segment.arrival_time,
          expectedArrival: journey.arrivalTimeFormatted || segment.arrival_time,
          scheduledDeparture: journey.departureTimeFormatted || segment.departure_time,
          expectedDeparture: journey.departureTimeFormatted || segment.departure_time,
          latitude: null,
          longitude: null,
          distanceTravelledKm: 0,
          lastUpdated: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
          source: 'railcontrol_fallback',
          data_source_label: 'LIVE DATA UNAVAILABLE - Showing RailControl scheduled train information'
        };

        const deterministicAvailMap = {};
        trainClasses.forEach(cls => {
          deterministicAvailMap[cls] = calculateDeterministicAvailability(t.train_number, journey.departureDate || date, cls, null, null, reqQuota, segment.srcCode);
        });

        const dateWiseAvail = calculateDateWiseAvailability(t, route, journey.departureDate || date, 25, from, to, reqQuota);

        const formattedTrain = {
          ...t,
          train_number: String(t.train_number),
          train_name: t.train_name,
          train_type: t.train_type || t.trainType || 'Superfast',
          service_instance_id: serviceInstance ? serviceInstance.id : `svc-${t.train_number}-${journey.departureDate || date}`,
          service_status: serviceInstance ? serviceInstance.status : undefined,
          service_date: journey.departureDate || date,
          departure_date: journey.departureDate,
          departure_time: journey.departureTime,
          departure_date_formatted: journey.departureDateFormatted,
          arrival_date: journey.arrivalDate,
          arrival_time: journey.arrivalTime,
          arrival_date_formatted: journey.arrivalDateFormatted,
          date_route_label: journey.dateRouteLabel,
          from_station: segment.srcName,
          from_station_code: segment.srcCode,
          to_station: segment.destName,
          to_station_code: segment.destCode,
          source: segment.srcCode,
          destination: segment.destCode,
          source_station_code: segment.srcCode,
          destination_station_code: segment.destCode,
          journey_date: journey.departureDate || date,
          journey_duration: journeyDurationStr,
          duration_minutes: journey.durationMinutes || fareInfo.duration_minutes,
          day_offset: journey.dayOffset,
          origin_index: segment.srcIndex,
          destination_index: segment.destIndex,
          intermediate_stops: segment.intermediateStops,
          stops: journey.stops && journey.stops.length > 0 ? journey.stops : segment.nodes,
          running_days: t.running_days || t.frequency || route?.frequency || 'Daily',
          frequency: t.frequency || route?.frequency || 'Daily',
          classes: trainClasses,
          available_classes: trainClasses,
          fares: fareInfo.fares_by_class,
          fares_by_class: fareInfo.fares_by_class,
          base_fare: fareInfo.base_fare,
          tatkal_charges_by_class: fareInfo.tatkal_charges_by_class || {},
          tatkal_charge: fareInfo.tatkal_charge || 0,
          quota: reqQuota,
          segment: fareInfo.segment,
          distance_km: fareInfo.distance_km,
          live_status: liveStatusObj,
          current_station: liveStatusObj.current_station,
          next_station: liveStatusObj.next_station,
          delay_minutes: liveStatusObj.delay_minutes,
          availability: deterministicAvailMap,
          availability_by_class: deterministicAvailMap,
          date_wise_availability: dateWiseAvail,
          data_source: liveStatusSource,
          route: enrichedRoute
        };

        matchedTrains.push(formattedTrain);
      }
    }

    // Sort matching trains chronologically by departure time, keeping Udupi Express (#12345) at the very end
    matchedTrains.sort((a, b) => {
      const isTargetA = String(a.train_number) === '12345' || String(a.train_name).toLowerCase().trim() === 'udupi express';
      const isTargetB = String(b.train_number) === '12345' || String(b.train_name).toLowerCase().trim() === 'udupi express';
      if (isTargetA && !isTargetB) return 1;
      if (!isTargetA && isTargetB) return -1;

      const getMins = (tStr) => {
        if (!tStr) return 0;
        const [h, m] = String(tStr).split(':');
        return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
      };
      return getMins(a.departure_time) - getMins(b.departure_time);
    });

    const isRailRadarActive = matchedTrains.some(t => t.live_status?.source === 'railradar');
    const primaryLabel = isRailRadarActive
      ? 'Live Data Source: RailRadar'
      : (process.env.RAILRADAR_API_KEY
          ? 'Live Data Source: RailRadar'
          : 'LIVE DATA UNAVAILABLE - Showing RailControl scheduled train information');

    return res.json({
      success: true,
      from: fromCode,
      to: toCode,
      date,
      time,
      total: matchedTrains.length,
      trains: matchedTrains,
      source: isRailRadarActive ? 'railradar' : 'railcontrol_fallback',
      data_source_label: primaryLabel,
      query: {
        from: fromCode,
        to: toCode,
        date,
        time
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error in live-search route:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to process live train search: ' + err.message
    });
  }
});

// GET /api/trains/reservation/audit-logs - Reservation Event Audit Log (Admin & Staff)
router.get('/reservation/audit-logs', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { train_id, journey_date } = req.query;
  const logs = getAuditLogs({ train_id, journey_date });
  return res.json({ logs });
});

// POST /api/trains/reservation/reassign-seat - Controlled Manual Seat Reassignment (Admin & Staff)
router.post('/reservation/reassign-seat', authenticateToken, requireRoles(['admin', 'staff']), (req, res) => {
  try {
    const { bookingId, oldSeatId, newSeatId, reason, pnr, trainId, date, oldCoach, oldSeat, newCoach, newSeat } = req.body;
    if (!bookingId && (!pnr || !newCoach || !newSeat)) {
      return res.status(400).json({ error: 'Booking ID or PNR, and target seat details are required.' });
    }
    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: 'A valid reassignment reason is required.' });
    }

    const result = reassignSeat({
      bookingId,
      oldSeatId,
      newSeatId,
      pnr,
      trainId,
      date,
      oldCoach,
      oldSeat,
      newCoach,
      newSeat,
      adminUser: req.user,
      reason
    });

    if (result && result.success === false) {
      return res.status(result.statusCode || 400).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/trains/:trainId/seat-availability - Unified Authoritative Reservation & Seat Map Engine
router.get('/:trainId/seat-availability', async (req, res) => {
  try {
    const { trainId } = req.params;
    const rawDate = req.query.journeyDate || req.query.date || req.query.travel_date || req.query.travelDate || req.query.service_date;
    const fromStation = req.query.fromStation || req.query.from || req.query.source || req.query.src;
    const toStation = req.query.toStation || req.query.to || req.query.destination || req.query.dest;
    const classCode = req.query.classCode || req.query.class_type || req.query.class || req.query.coach_class || req.query.coachClass || '2A';
    const quota = req.query.quota || 'GN';
    const coach = req.query.coach || req.query.coachFilter;
    const targetDate = normalizeDateStr(rawDate) || rawDate || new Date().toISOString().split('T')[0];

    // Determine sensible station fallbacks from train details if not provided
    let fallbackFrom = 'NDLS';
    let fallbackTo = 'MMCT';
    const trainObj = Array.from(mockDb.trains.values()).find(t => String(t.train_number) === String(trainId) || t.id === trainId);
    if (trainObj) {
      fallbackFrom = trainObj.source_station_code || trainObj.source || 'NDLS';
      fallbackTo = trainObj.destination_station_code || trainObj.destination || 'MMCT';
    }

    const availability = await getTrainSeatAvailability({
      trainId,
      journeyDate: targetDate,
      fromStation: fromStation || fallbackFrom,
      toStation: toStation || fallbackTo,
      classCode,
      quota,
      coachFilter: coach || null
    });

    return res.json(availability);
  } catch (err) {
    console.error('Error fetching seat availability:', err);
    return res.status(500).json({ error: 'Failed to calculate seat availability: ' + err.message });
  }
});

// POST /api/trains/:trainId/hold-seat - Temporary Seat Hold during payment flow
router.post('/:trainId/hold-seat', (req, res) => {
  try {
    const { trainId } = req.params;
    const { journeyDate, fromStation, toStation, classCode, quota = 'GN', coach, seatId, userId } = req.body;

    if (!journeyDate || !classCode || (!seatId && (!coach || !req.body.seatNumber))) {
      return res.status(400).json({ error: 'Journey date, class code, and seat identifier are required.' });
    }

    const hold = createTemporaryHold({
      userId: userId || req.user?.id || 'usr-guest',
      trainId,
      journeyDate,
      fromStation,
      toStation,
      classCode,
      quota,
      coach: coach || (seatId ? seatId.split('-')[1] : 'B1'),
      seatId: seatId || `${trainId}-${coach}-${req.body.seatNumber}`,
      durationMinutes: 10
    });

    if (hold && hold.success === false) {
      return res.status(hold.statusCode || 400).json({ success: false, error: hold.message });
    }

    return res.json({ success: true, message: 'Temporary seat hold created for 10 minutes.', hold });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create temporary seat hold: ' + err.message });
  }
});

// POST /api/trains/:trainId/release-seat - Release a temporary seat hold
router.post('/:trainId/release-seat', (req, res) => {
  try {
    const { holdId, hold_id, userId } = req.body;
    const targetHoldId = holdId || hold_id;
    if (!targetHoldId) {
      return res.status(400).json({ error: 'holdId is required.' });
    }
    const result = releaseTemporaryHold(targetHoldId, userId || req.user?.id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to release hold: ' + err.message });
  }
});

// GET /api/trains/:id/live-status
router.get('/:id/live-status', async (req, res) => {
  try {
    const { id } = req.params;
    const date = req.query.date || req.query.service_date || req.query.travel_date;
    const liveStatus = await getLiveStatusForTrain(id, date);
    if (!liveStatus) {
      return res.status(404).json({ error: 'Train not found or route data unavailable' });
    }
    return res.json(liveStatus);
  } catch (err) {
    console.error('Error fetching live status:', err);
    return res.status(500).json({ error: 'Failed to fetch live tracking status: ' + err.message });
  }
});

// POST /api/trains/:id/telemetry or PUT /api/trains/:id/telemetry (Staff & Admin only)
const updateTelemetryHandler = async (req, res) => {
  const { id } = req.params;
  const {
    latitude,
    longitude,
    speed,
    current_station_code,
    next_station_code,
    distance_travelled_km,
    delay_minutes,
    status,
    delay_reason,
    platform,
    service_date
  } = req.body;

  const nowIso = new Date().toISOString();
  const targetServiceDate = service_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (isMockMode) {
    let train = mockDb.trains.get(id);
    if (!train) {
      train = Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
    }
    if (!train) return res.status(404).json({ error: 'Train not found' });

    let telemetry = mockDb.train_telemetry.get(train.id);
    if (!telemetry) {
      telemetry = {
        id: 'tel-' + Math.random().toString(36).substr(2, 9),
        train_id: train.id,
        service_date: targetServiceDate,
        created_at: nowIso
      };
    }

    telemetry.service_date = targetServiceDate;
    if (latitude !== undefined) telemetry.latitude = latitude !== null ? parseFloat(latitude) : null;
    if (longitude !== undefined) telemetry.longitude = longitude !== null ? parseFloat(longitude) : null;
    if (speed !== undefined) telemetry.speed = parseInt(speed, 10);
    if (current_station_code !== undefined) telemetry.current_station_code = extractStationCode(current_station_code);
    if (next_station_code !== undefined) telemetry.next_station_code = extractStationCode(next_station_code);
    if (distance_travelled_km !== undefined) telemetry.distance_travelled_km = parseFloat(distance_travelled_km);
    if (delay_minutes !== undefined) telemetry.delay_minutes = parseInt(delay_minutes, 10);
    if (status !== undefined) telemetry.status = status;
    if (delay_reason !== undefined) telemetry.delay_reason = delay_reason;
    if (platform !== undefined) telemetry.platform = platform;
    telemetry.updated_at = nowIso;

    mockDb.train_telemetry.set(train.id, telemetry);

    if (delay_minutes !== undefined) train.delay_minutes = parseInt(delay_minutes, 10);
    if (status === 'DELAYED' || (delay_minutes > 0 && train.status === 'on_time')) {
      train.status = 'delayed';
    } else if (status === 'LIVE' && delay_minutes === 0) {
      train.status = 'on_time';
    }
    mockDb.trains.set(train.id, train);

    const fullLiveStatus = await getLiveStatusForTrain(train.id, targetServiceDate);
    broadcastTelemetryUpdate(train.id, fullLiveStatus, targetServiceDate);

    return res.json({ message: 'Telemetry updated successfully', liveStatus: fullLiveStatus });
  } else {
    try {
      let trainId = id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) {
        const { data: trainObj, error: tErr } = await supabase.from('trains').select('id').eq('train_number', id).single();
        if (tErr || !trainObj) return res.status(404).json({ error: 'Train not found' });
        trainId = trainObj.id;
      }

      const telemetryData = {
        train_id: trainId,
        service_date: targetServiceDate,
        updated_at: nowIso
      };
      if (latitude !== undefined) telemetryData.latitude = latitude !== null ? parseFloat(latitude) : null;
      if (longitude !== undefined) telemetryData.longitude = longitude !== null ? parseFloat(longitude) : null;
      if (speed !== undefined) telemetryData.speed = parseInt(speed, 10);
      if (current_station_code !== undefined) telemetryData.current_station_code = extractStationCode(current_station_code);
      if (next_station_code !== undefined) telemetryData.next_station_code = extractStationCode(next_station_code);
      if (distance_travelled_km !== undefined) telemetryData.distance_travelled_km = parseFloat(distance_travelled_km);
      if (delay_minutes !== undefined) telemetryData.delay_minutes = parseInt(delay_minutes, 10);
      if (status !== undefined) telemetryData.status = status;
      if (delay_reason !== undefined) telemetryData.delay_reason = delay_reason;
      if (platform !== undefined) telemetryData.platform = platform;

      const { data, error } = await supabase
        .from('train_telemetry')
        .upsert(telemetryData, { onConflict: 'train_id,service_date' })
        .select()
        .single();

      if (error) throw error;

      if (delay_minutes !== undefined || status !== undefined) {
        const tUpdates = { updated_at: nowIso };
        if (delay_minutes !== undefined) tUpdates.delay_minutes = parseInt(delay_minutes, 10);
        if (status === 'DELAYED' || (delay_minutes > 0)) tUpdates.status = 'delayed';
        else if (status === 'LIVE' && delay_minutes === 0) tUpdates.status = 'on_time';
        await supabase.from('trains').update(tUpdates).eq('id', trainId);
      }

      const fullLiveStatus = await getLiveStatusForTrain(trainId, targetServiceDate);
      broadcastTelemetryUpdate(trainId, fullLiveStatus, targetServiceDate);

      return res.json({ message: 'Telemetry updated successfully', liveStatus: fullLiveStatus });
    } catch (err) {
      console.error('Telemetry update failed:', err.message);
      return res.status(400).json({ error: 'Telemetry update failed: ' + err.message });
    }
  }
};

router.post('/:id/telemetry', authenticateToken, requireRoles(['staff', 'admin']), updateTelemetryHandler);
router.put('/:id/telemetry', authenticateToken, requireRoles(['staff', 'admin']), updateTelemetryHandler);

// Get all trains (with optional search and route query)
router.get('/', async (req, res) => {
  const { source, destination, date, include_seed, include_all } = req.query;

  if (isMockMode) {
    let trainsList = Array.from(mockDb.trains.values()).filter(t => !!t && (include_all === 'true' || t.status !== 'inactive'));
    
    // Filter out test records unless specifically running tests
    if (process.env.NODE_ENV !== 'test') {
      trainsList = trainsList.filter(t => t.source !== 'test' && t.record_source !== 'test');
    }

    const routesList = Array.from(mockDb.routes.values());

    if (source && destination) {
      const results = [];

      for (const t of trainsList) {
        if (!t) continue;
        const route = routesList.find(r => r && (r.train_id === t.id || String(r.train_number) === String(t.train_number) || r.id === t.route_id)) || { stops: t.stops || [] };

        const isDateSpecificTrain = Boolean(
          t.is_date_specific === true || t.is_date_specific === 'true' ||
          route?.is_date_specific === true || route?.is_date_specific === 'true' ||
          t.journey_date || route?.journey_date
        );

        // Date-specific trains require an exact journey date and must NEVER appear in undated searches
        if (!date && isDateSpecificTrain) {
          continue;
        }

        if (date && !isTrainRunningOnDate(t, route, date) && t.status !== 'cancelled') {
          continue;
        }

        const segment = matchRouteSegment(t, route, source, destination);

        if (segment) {
          const journey = calculateJourneyDatesAndTimes({
            train: t,
            route,
            fromStation: source,
            toStation: destination,
            travelDate: date
          });

          if (date && include_all !== 'true' && req.user?.role !== 'admin' && req.user?.role !== 'staff' && journey.isDeparted && t.status !== 'cancelled') {
            continue;
          }

          const fareInfo = calculateSegmentFare({ train: t, route, srcIndex: segment.srcIndex, destIndex: segment.destIndex, nodes: segment.nodes });

          const enrichedRoute = {
            ...(route || {}),
            source_station_code: segment.srcCode,
            destination_station_code: segment.destCode,
            departure_time: journey.departureTime || segment.departure_time,
            arrival_time: journey.arrivalTime || segment.arrival_time,
            departure_date: journey.departureDate,
            arrival_date: journey.arrivalDate,
            departure_date_formatted: journey.departureDateFormatted,
            arrival_date_formatted: journey.arrivalDateFormatted,
            date_route_label: journey.dateRouteLabel,
            original_source: route?.source_station_code || t.source_station_code || t.source,
            original_destination: route?.destination_station_code || t.destination_station_code || t.destination,
            stops: journey.stops && journey.stops.length > 0 ? journey.stops : (route?.stops || []),
            distance_km: fareInfo.distance_km,
            duration_minutes: journey.durationMinutes || fareInfo.duration_minutes,
            journey_duration: journey.durationFormatted,
            base_fare: fareInfo.base_fare,
            segment_fares: fareInfo
          };

          const trainClasses = (Array.isArray(t.available_classes) && t.available_classes.length > 0)
            ? normalizeClassList(t.available_classes)
            : getDefaultClassesForTrain(t.train_name, t.train_type || t.trainType);

          const distanceKm = fareInfo.distance_km || 0;
          const durationHours = (fareInfo.duration_minutes || 0) / 60;
          const cateringEval = evaluateCateringEligibility({ train: t, distance_km: distanceKm, duration_hours: durationHours });

          const classCateringMap = {};
          for (const cls of trainClasses) {
            classCateringMap[cls] = evaluateCateringEligibility({ train: t, distance_km: distanceKm, duration_hours: durationHours, class_code: cls });
          }
          const deterministicAvailMap = {};
          trainClasses.forEach(cls => {
            deterministicAvailMap[cls] = calculateDeterministicAvailability(t.train_number, journey.departureDate || date, cls, null, null, 'GN', segment.srcCode);
          });
          const dateWiseAvail = calculateDateWiseAvailability(t, route, journey.departureDate || date, 25, segment.srcCode, segment.destCode, 'GN');

          results.push({
            ...t,
            source: segment.srcCode,
            destination: segment.destCode,
            departure_date: journey.departureDate,
            arrival_date: journey.arrivalDate,
            departure_time: journey.departureTime,
            arrival_time: journey.arrivalTime,
            departure_date_formatted: journey.departureDateFormatted,
            arrival_date_formatted: journey.arrivalDateFormatted,
            date_route_label: journey.dateRouteLabel,
            available_classes: trainClasses,
            segment: fareInfo.segment,
            distance_km: fareInfo.distance_km,
            duration_minutes: journey.durationMinutes || fareInfo.duration_minutes,
            fares_by_class: fareInfo.fares_by_class,
            base_fare: fareInfo.base_fare,
            catering_config: getTrainCateringConfig(t),
            catering_eligibility: cateringEval,
            catering_eligibility_by_class: classCateringMap,
            availability: deterministicAvailMap,
            availability_by_class: deterministicAvailMap,
            date_wise_availability: dateWiseAvail,
            route: enrichedRoute
          });
        }
      }

      return res.json(results);
    } else {
      // General train list view
      let results = trainsList;

      results = results
        .filter(t => t && (!date || isTrainRunningOnDate(t, routesList.find(r => r && (r.train_id === t.id || String(r.train_number) === String(t.train_number) || r.route_code === t.train_number || r.id === t.route_id)), date)))
        .map(t => {
          const route = routesList.find(r => r && (r.train_id === t.id || String(r.train_number) === String(t.train_number) || r.route_code === t.train_number || r.id === t.route_id)) || {
            source_station_code: t.source_station_code || extractStationCode(t.source) || 'NDLS',
            destination_station_code: t.destination_station_code || extractStationCode(t.destination) || 'MMCT',
            departure_time: t.departure_time || '10:00:00',
            arrival_time: t.arrival_time || '18:00:00',
            distance_km: t.distance_km || 500,
            fare_multiplier: 1.2,
            stops: []
          };
          const safeSource = t.source_station_code || route.source_station_code || (t.source && t.source.toUpperCase() !== 'ADMIN' ? extractStationCode(t.source) : '');
          const safeDest = t.destination_station_code || route.destination_station_code || (t.destination && t.destination.toUpperCase() !== 'ADMIN' ? extractStationCode(t.destination) : '');

          const routeStops = (Array.isArray(t.stops) && t.stops.length > 0) ? t.stops : ((route && Array.isArray(route.stops) && route.stops.length > 0) ? route.stops : []);

          const trainClasses = (Array.isArray(t.available_classes) && t.available_classes.length > 0)
            ? normalizeClassList(t.available_classes)
            : getDefaultClassesForTrain(t.train_name, t.train_type || t.trainType);

          const merged = { ...t, ...route };
          const nextService = getNextServiceDateTime(merged);
          const overnight = calculateOvernightOffset(route.departure_time || t.departure_time, route.arrival_time || t.arrival_time);

          return {
            ...t,
            source: safeSource,
            destination: safeDest,
            source_station_code: safeSource,
            destination_station_code: safeDest,
            available_classes: trainClasses,
            frequency_type: t.frequency_type || route.frequency_type || 'Daily',
            service_start_date: t.service_start_date || route.service_start_date || null,
            service_end_date: t.service_end_date || route.service_end_date || null,
            operating_days: t.operating_days || route.operating_days || [],
            specific_service_dates: t.specific_service_dates || route.specific_service_dates || [],
            service_status: t.service_status || (t.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'),
            day_offset: t.day_offset ?? route.day_offset ?? overnight.dayOffset,
            departure_time: route.departure_time || t.departure_time || '10:00:00',
            arrival_time: route.arrival_time || t.arrival_time || '18:00:00',
            next_service: nextService,
            stops: routeStops,
            route: {
              ...route,
              source_station_code: safeSource,
              destination_station_code: safeDest,
              frequency_type: t.frequency_type || route.frequency_type || 'Daily',
              service_start_date: t.service_start_date || route.service_start_date || null,
              service_end_date: t.service_end_date || route.service_end_date || null,
              operating_days: t.operating_days || route.operating_days || [],
              specific_service_dates: t.specific_service_dates || route.specific_service_dates || [],
              service_status: t.service_status || (t.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'),
              day_offset: t.day_offset ?? route.day_offset ?? overnight.dayOffset,
              stops: routeStops
            }
          };
        });
      return res.json(results);
    }
  } else {
    try {
      const { data, error } = await supabase.from('trains').select(`
        *,
        routes:routes(*)
      `);
      if (error) throw error;

      let activeTrains = (data || []).filter(t => include_all === 'true' || t.status !== 'inactive');
      if (process.env.NODE_ENV !== 'test') {
        activeTrains = activeTrains.filter(t => t.source !== 'test' && t.record_source !== 'test');
      }

      if (source && destination) {
        const results = [];

        for (const t of activeTrains) {
          const route = t.routes && t.routes.length > 0 ? t.routes[0] : null;
          if (date && !isTrainRunningOnDate(t, route, date)) {
            continue;
          }

          const segment = matchRouteSegment(t, route, source, destination);

          if (segment) {
            const fareInfo = calculateSegmentFare({ train: t, route, srcIndex: segment.srcIndex, destIndex: segment.destIndex, nodes: segment.nodes });

            const enrichedRoute = {
              ...(route || {}),
              source_station_code: segment.srcCode,
              destination_station_code: segment.destCode,
              departure_time: segment.departure_time,
              arrival_time: segment.arrival_time,
              original_source: route?.source_station_code || t.source,
              original_destination: route?.destination_station_code || t.destination,
              stops: route?.stops || [],
              distance_km: fareInfo.distance_km,
              duration_minutes: fareInfo.duration_minutes,
              base_fare: fareInfo.base_fare,
              segment_fares: fareInfo
            };

            const distanceKm = fareInfo.distance_km || 0;
            const durationHours = (fareInfo.duration_minutes || 0) / 60;
            const trainClasses = (Array.isArray(t.available_classes) && t.available_classes.length > 0)
              ? normalizeClassList(t.available_classes)
              : getDefaultClassesForTrain(t.train_name, t.train_type || t.trainType);

            const cateringEval = evaluateCateringEligibility({ train: t, distance_km: distanceKm, duration_hours: durationHours });
            const classCateringMap = {};
            for (const cls of trainClasses) {
              classCateringMap[cls] = evaluateCateringEligibility({ train: t, distance_km: distanceKm, duration_hours: durationHours, class_code: cls });
            }

            results.push({
              ...t,
              source: segment.srcCode,
              destination: segment.destCode,
              segment: fareInfo.segment,
              distance_km: fareInfo.distance_km,
              duration_minutes: fareInfo.duration_minutes,
              fares_by_class: fareInfo.fares_by_class,
              base_fare: fareInfo.base_fare,
              catering_config: getTrainCateringConfig(t),
              catering_eligibility: cateringEval,
              catering_eligibility_by_class: classCateringMap,
              route: enrichedRoute
            });
          }
        }

        return res.json(results);
      } else {
        let resultsList = activeTrains;

        const results = resultsList
          .filter(t => {
            const mainRoute = t.routes && t.routes.length > 0 ? t.routes[0] : null;
            return !date || isTrainRunningOnDate(t, mainRoute, date);
          })
          .map(t => {
            const mainRoute = t.routes && t.routes.length > 0 ? t.routes[0] : null;
            const merged = { ...t, ...(mainRoute || {}) };
            const nextService = getNextServiceDateTime(merged);
            const overnight = calculateOvernightOffset(mainRoute?.departure_time, mainRoute?.arrival_time);
            return {
              ...t,
              source: t.source_station_code || (mainRoute ? mainRoute.source_station_code : t.source),
              destination: t.destination_station_code || (mainRoute ? mainRoute.destination_station_code : t.destination),
              frequency_type: t.frequency_type || mainRoute?.frequency_type || 'Daily',
              service_start_date: t.service_start_date || mainRoute?.service_start_date || null,
              service_end_date: t.service_end_date || mainRoute?.service_end_date || null,
              operating_days: t.operating_days || mainRoute?.operating_days || [],
              specific_service_dates: t.specific_service_dates || mainRoute?.specific_service_dates || [],
              service_status: t.service_status || (t.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'),
              day_offset: t.day_offset ?? mainRoute?.day_offset ?? overnight.dayOffset,
              departure_time: mainRoute?.departure_time || t.departure_time || '10:00:00',
              arrival_time: mainRoute?.arrival_time || t.arrival_time || '18:00:00',
              next_service: nextService,
              route: mainRoute
            };
          });
        return res.json(results);
      }
    } catch (err) {
      console.error('⚠️ Supabase DB error during trains query:', err.message);
      return res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  }
});

// GET /api/trains/:id/class-date-availability - Fetch authoritative class-wise date availability
router.get('/:id/class-date-availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { class: reqClass, from, to, date, quota, numDates } = req.query;
    if (!reqClass) {
      return res.status(400).json({ success: false, error: 'class query parameter is required (e.g. class=3A)' });
    }
    const result = getClassDateAvailability(id, reqClass, date, parseInt(numDates || '6', 10), from, to, quota || 'GN');
    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 400;
      return res.status(statusCode).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/trains/:trainId/class-availability-dates - Return future service dates array for train and class
router.get('/:trainId/class-availability-dates', async (req, res) => {
  try {
    const { trainId } = req.params;
    const source = req.query.source || req.query.from || req.query.src;
    const destination = req.query.destination || req.query.to || req.query.dest;
    const classCode = req.query.class_code || req.query.class || req.query.classCode;
    const fromDate = req.query.from_date || req.query.date || req.query.startDate;
    const toDate = req.query.to_date || req.query.endDate;
    const quota = req.query.quota || 'GN';

    if (!classCode) {
      return res.status(400).json({ error: 'class_code query parameter is required (e.g. class_code=SL)' });
    }

    const result = getClassAvailabilityDates({
      trainId,
      source,
      destination,
      classCode,
      fromDate,
      toDate,
      quota
    });

    if (!result.success) {
      const statusCode = result.status || (result.error?.includes('not found') ? 404 : 400);
      return res.status(statusCode).json({ error: result.error, configured_classes: result.configured_classes });
    }

    return res.json(result.dates);
  } catch (err) {
    console.error('Error in /class-availability-dates:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/trains/:id - Fetch single train details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Train ID is required' });

  if (isMockMode) {
    let train = mockDb.trains.get(id);
    if (!train) {
      train = Array.from(mockDb.trains.values()).find(t => 
        t && (String(t.id) === String(id) || String(t.train_number) === String(id) || String(t.train_no) === String(id))
      );
    }
    if (!train) {
      return res.status(404).json({ error: 'Train not found' });
    }
    const routesList = Array.from(mockDb.routes.values());
    const mainRoute = routesList.find(r => r && (r.train_id === train.id || String(r.train_number) === String(train.train_number)));
    const enrichedTrain = {
      ...train,
      route: mainRoute || null,
      stops: train.stops && train.stops.length > 0 ? train.stops : (mainRoute?.stops || [])
    };
    return res.json(enrichedTrain);
  } else {
    try {
      const { data, error } = await supabase.from('trains').select('*, routes(*)').or(`id.eq.${id},train_number.eq.${id}`).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Train not found' });
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
});

// Add a new train (Staff with MANAGE_TRAIN_SCHEDULES & Admin)
router.post('/', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), async (req, res) => {
  const train_number = req.body.train_number || req.body.trainNo;
  const train_name = req.body.train_name || req.body.trainName;
  const source = req.body.source || req.body.from;
  const destination = req.body.destination || req.body.to;
  const departure_time = req.body.departure_time || req.body.depTime;
  const arrival_time = req.body.arrival_time || req.body.arrTime;
  const distance_km = req.body.distance_km || 500;
  const fare_multiplier = req.body.fare_multiplier || (req.body.baseFare ? parseFloat(req.body.baseFare) / 350 : 1.2);
  const frequency_type = req.body.frequency_type || req.body.frequencyType || 'Daily';
  const frequency = req.body.frequency || frequency_type;
  
  if (!train_number || !String(train_number).trim()) {
    return res.status(400).json({ error: 'Train number is required' });
  }
  if (!train_name || !String(train_name).trim()) {
    return res.status(400).json({ error: 'Train name is required' });
  }
  if (!source || !destination) {
    return res.status(400).json({ error: 'Source and destination stations are required' });
  }
  if (!departure_time || !arrival_time) {
    return res.status(400).json({ error: 'Departure and arrival times are required' });
  }

  const srcCode = extractStationCode(source);
  const destCode = extractStationCode(destination);

  if (!srcCode || !destCode || srcCode.toUpperCase() === 'ADMIN' || destCode.toUpperCase() === 'ADMIN') {
    return res.status(400).json({ error: 'Invalid source or destination station code. ADMIN cannot be used as a station.' });
  }

  if (srcCode === destCode) {
    return res.status(400).json({ error: 'Source and destination stations cannot be the same' });
  }

  // Mandatory Service Validity Period validation
  // Mandatory Service Validity Period & Journey Date validation
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const is_date_specific = req.body.is_date_specific === true || req.body.is_date_specific === 'true' || Boolean(req.body.journey_date || req.body.journeyDate);
  const rawJourneyDate = req.body.journey_date || req.body.journeyDate;
  let journey_date = null;
  if (is_date_specific) {
    const candidateDate = rawJourneyDate || req.body.service_start_date || req.body.startDate || todayIst;
    journey_date = normalizeDateStr(candidateDate);
    if (!journey_date || !/^\d{4}-\d{2}-\d{2}$/.test(journey_date)) {
      return res.status(400).json({ error: 'Valid Journey Date (YYYY-MM-DD) is required for date-specific train.' });
    }
    if (process.env.NODE_ENV !== 'test' && journey_date < todayIst) {
      return res.status(400).json({ error: 'Journey Date cannot be in the past.' });
    }
  }

  const rawStartDate = is_date_specific ? journey_date : (req.body.service_start_date || req.body.startDate || todayIst);
  const service_start_date = normalizeDateStr(rawStartDate);

  if (!service_start_date || !/^\d{4}-\d{2}-\d{2}$/.test(service_start_date)) {
    return res.status(400).json({ error: 'Valid Service Start Date (YYYY-MM-DD) is required.' });
  }

  if (process.env.NODE_ENV !== 'test' && service_start_date < todayIst) {
    return res.status(400).json({ error: 'Service Start Date cannot be in the past.' });
  }

  let defaultEndDate = '';
  try {
    const [sy, sm, sd] = service_start_date.split('-').map(Number);
    const endD = new Date(sy, sm - 1, sd + 90);
    defaultEndDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
  } catch (e) {
    defaultEndDate = service_start_date;
  }

  const rawEndDate = is_date_specific ? journey_date : (req.body.service_end_date || req.body.endDate || defaultEndDate);
  const service_end_date = normalizeDateStr(rawEndDate);

  if (!service_end_date || !/^\d{4}-\d{2}-\d{2}$/.test(service_end_date)) {
    return res.status(400).json({ error: 'Valid Service End Date (YYYY-MM-DD) is required.' });
  }

  if (service_end_date < service_start_date) {
    return res.status(400).json({ error: 'Service End Date cannot be earlier than Service Start Date.' });
  }

  // Frequency Type & Schedule Validation
  let operating_days = is_date_specific ? [] : (req.body.operating_days || req.body.operatingDays || req.body.weekly_days || []);
  if (!Array.isArray(operating_days)) {
    if (typeof operating_days === 'string') {
      operating_days = operating_days.split(',').map(d => d.trim()).filter(Boolean);
    } else {
      operating_days = [];
    }
  }

  let specific_service_dates = is_date_specific ? [journey_date] : (req.body.specific_service_dates || req.body.specificDates || []);
  if (!Array.isArray(specific_service_dates)) {
    if (typeof specific_service_dates === 'string') {
      specific_service_dates = specific_service_dates.split(',').map(d => d.trim()).filter(Boolean);
    } else {
      specific_service_dates = [];
    }
  }
  specific_service_dates = Array.from(new Set(specific_service_dates.map(d => normalizeDateStr(d)).filter(Boolean)));

  const normFreqType = is_date_specific ? 'Specific Dates' : String(frequency_type).trim();
  const finalFrequency = is_date_specific ? formatDateFriendly(journey_date) : frequency;

  if (!is_date_specific && (normFreqType === 'Weekly' || normFreqType === 'Selected Days')) {
    if (operating_days.length === 0) {
      return res.status(400).json({ error: `Please select at least one operating day for ${normFreqType} frequency.` });
    }
  }

  if (!is_date_specific && normFreqType === 'Specific Dates') {
    if (specific_service_dates.length === 0) {
      return res.status(400).json({ error: 'Please select at least one operating date for Specific Dates frequency.' });
    }
    for (const dt of specific_service_dates) {
      if (process.env.NODE_ENV !== 'test' && dt < todayIst) {
        return res.status(400).json({ error: `Specific service date ${dt} cannot be in the past.` });
      }
      if (dt < service_start_date || dt > service_end_date) {
        return res.status(400).json({ error: `Specific service date ${dt} must fall within Service Period [${service_start_date} to ${service_end_date}].` });
      }
    }
  }

  // Overnight & Journey Duration Calculation
  const { dayOffset, durationMinutes } = calculateOvernightOffset(departure_time, arrival_time);
  const day_offset = req.body.day_offset !== undefined ? parseInt(req.body.day_offset, 10) : dayOffset;

  // Stop Chronology Validation
  const stopValidation = validateStopChronology(departure_time, arrival_time, req.body.stops || [], day_offset);
  if (!stopValidation.valid) {
    return res.status(400).json({ error: stopValidation.error });
  }
  const stops = stopValidation.enrichedStops;

  const seenStations = new Set([srcCode, destCode]);
  for (const s of stops) {
    if (seenStations.has(s.stationCode)) {
      return res.status(400).json({ error: `Station ${s.stationCode} cannot appear multiple times in route/stops.` });
    }
    seenStations.add(s.stationCode);
  }

  // Duplicate train_number validation
  if (isMockMode) {
    const duplicate = Array.from(mockDb.trains.values()).find(
      t => t && t.train_number && String(t.train_number).trim() === String(train_number).trim()
    );
    if (duplicate) {
      return res.status(400).json({ error: `Train number ${train_number} already exists` });
    }
  }

  const nowIso = new Date().toISOString();
  const createdBy = req.user ? (req.user.id || req.user.email || 'usr-admin') : 'usr-admin';
  const recordSource = req.body.record_source || req.body.source_type || (process.env.NODE_ENV === 'test' ? 'test' : 'admin');

  const rawClasses = req.body.available_classes || req.body.availableClasses || req.body.classes;
  let available_classes = [];
  if (rawClasses !== undefined) {
    available_classes = normalizeClassList(rawClasses);
    if (available_classes.length === 0) {
      return res.status(400).json({ error: 'At least one travel class must be selected for the train.' });
    }
  } else {
    available_classes = getDefaultClassesForTrain(train_name, req.body.train_type || req.body.trainType);
  }

  const foodVal = parseAndValidateFoodConfig(req.body);
  if (!foodVal.valid) {
    return res.status(400).json({ error: foodVal.error });
  }

  if (isMockMode) {
    const newTrain = {
      id: 't-' + Math.random().toString(36).substr(2, 9),
      train_number: String(train_number).trim(),
      train_name: String(train_name).trim(),
      train_type: req.body.train_type || req.body.trainType || 'Superfast',
      source_station_code: srcCode,
      destination_station_code: destCode,
      source: srcCode,
      destination: destCode,
      available_classes,
      food_available: foodVal.config.food_available,
      catering_payment_mode: foodVal.config.catering_payment_mode,
      food_type: foodVal.config.food_type,
      vegetarian_food_price: foodVal.config.vegetarian_food_price,
      non_vegetarian_food_price: foodVal.config.non_vegetarian_food_price,
      class_catering: foodVal.config.class_catering,
      record_source: recordSource,
      is_date_specific: Boolean(is_date_specific),
      journey_date: journey_date || null,
      frequency_type: normFreqType,
      frequency: finalFrequency,
      service_start_date,
      service_end_date,
      operating_days,
      specific_service_dates,
      service_status: req.body.service_status || 'ACTIVE',
      day_offset,
      status: req.body.status || 'on_time',
      delay_minutes: 0,
      createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
      created_at: nowIso,
      updated_at: nowIso
    };
    
    const newRoute = {
      id: 'r-' + Math.random().toString(36).substr(2, 9),
      train_id: newTrain.id,
      source_station_code: srcCode,
      destination_station_code: destCode,
      departure_time: ensure24HourTime(departure_time),
      arrival_time: ensure24HourTime(arrival_time),
      distance_km: parseFloat(distance_km || '500'),
      fare_multiplier: parseFloat(fare_multiplier || '1.0'),
      is_date_specific: Boolean(is_date_specific),
      journey_date: journey_date || null,
      frequency_type: normFreqType,
      frequency: finalFrequency,
      service_start_date,
      service_end_date,
      operating_days,
      specific_service_dates,
      service_status: req.body.service_status || 'ACTIVE',
      day_offset,
      stop_sequence: 1,
      stops: stops
    };

    mockDb.trains.set(newTrain.id, newTrain);
    mockDb.routes.set(newRoute.id, newRoute);

    // Seed mock seats for all available classes of the new train
    const coachPrefixMap = {
      '1A': 'H', '2A': 'A', '3A': 'B', '3E': 'M', 'EC': 'E', 'CC': 'C', 'SL': 'S', '2S': 'D', 'GEN': 'GS'
    };
    const seatClasses = (Array.isArray(available_classes) && available_classes.length > 0)
      ? available_classes
      : ['SL', '3A', '2A', '1A'];

    seatClasses.forEach(cls => {
      const pfx = coachPrefixMap[cls] || 'C';
      const coachNum = `${pfx}1`;
      for (let i = 1; i <= 24; i++) {
        const berthType = i % 6 === 1 || i % 6 === 2 ? 'LB' : i % 6 === 3 || i % 6 === 4 ? 'MB' : 'UB';
        const sId = `${newTrain.id}-${coachNum}-${i}`;
        mockDb.seats.set(sId, {
          id: sId,
          train_id: newTrain.id,
          coach_class: cls,
          coach_number: coachNum,
          seat_number: i,
          berth_type: berthType
        });
      }
    });

    // Regenerate service instances for the new train (targeted to this train)
    try {
      generateServiceInstances(60, { trainId: newTrain.id, trainNumber: newTrain.train_number });
    } catch (e) {
      console.error('Error generating services after train create:', e.message);
    }

    const nextService = getNextServiceDateTime({ ...newTrain, ...newRoute });

    return res.status(201).json({
      message: 'Train and route successfully created (Mock Mode)',
      train: { ...newTrain, source: srcCode, destination: destCode, next_service: nextService, route: newRoute }
    });
  } else {
    try {
      // 1. Insert Train
      const { data: train, error: trainError } = await supabase
        .from('trains')
        .insert({
          train_number: String(train_number).trim(),
          train_name: String(train_name).trim(),
          source_station_code: srcCode,
          destination_station_code: destCode,
          source: srcCode,
          destination: destCode,
          is_date_specific: Boolean(is_date_specific),
          journey_date: journey_date || null,
          frequency_type: normFreqType,
          frequency: finalFrequency,
          service_start_date,
          service_end_date,
          operating_days,
          specific_service_dates,
          service_status: req.body.service_status || 'ACTIVE',
          day_offset,
          record_source: recordSource,
          created_by: createdBy,
          created_at: nowIso,
          updated_at: nowIso
        })
        .select()
        .single();

      if (trainError) throw trainError;

      // 2. Insert Route
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({
          train_id: train.id,
          source_station_code: srcCode,
          destination_station_code: destCode,
          departure_time: ensure24HourTime(departure_time),
          arrival_time: ensure24HourTime(arrival_time),
          distance_km,
          fare_multiplier,
          is_date_specific: Boolean(is_date_specific),
          journey_date: journey_date || null,
          frequency_type: normFreqType,
          frequency: finalFrequency,
          service_start_date,
          service_end_date,
          operating_days,
          specific_service_dates,
          service_status: req.body.service_status || 'ACTIVE',
          day_offset,
          stops: stops
        })
        .select()
        .single();

      if (routeError) throw routeError;

      const nextService = getNextServiceDateTime({ ...train, ...route });

      return res.status(201).json({ train: { ...train, source: srcCode, destination: destCode, next_service: nextService, route } });
    } catch (err) {
      console.error('⚠️ Supabase DB error during train insert:', err.message);
      return res.status(500).json({ error: 'Database train insert failed: ' + err.message });
    }
  }
});

// Update train status / delays / details (Staff with MANAGE_TRAIN_SCHEDULES & Admin)
router.put('/:id', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), async (req, res) => {
  const { id } = req.params;
  const train_number = req.body.train_number || req.body.trainNo;
  const train_name = req.body.train_name || req.body.trainName;
  const status = req.body.status;
  const delay_minutes = req.body.delay_minutes;
  const source = req.body.source || req.body.from;
  const destination = req.body.destination || req.body.to;
  const departure_time = req.body.departure_time || req.body.depTime;
  const arrival_time = req.body.arrival_time || req.body.arrTime;
  const distance_km = req.body.distance_km;
  const fare_multiplier = req.body.fare_multiplier || (req.body.baseFare ? parseFloat(req.body.baseFare) / 350 : undefined);
  const frequency_type = req.body.frequency_type || req.body.frequencyType;
  const frequency = req.body.frequency || frequency_type;
  const service_status = req.body.service_status;

  let service_start_date = req.body.service_start_date || req.body.startDate;
  let service_end_date = req.body.service_end_date || req.body.endDate;

  if (service_start_date !== undefined) {
    service_start_date = normalizeDateStr(service_start_date);
    if (!service_start_date || !/^\d{4}-\d{2}-\d{2}$/.test(service_start_date)) {
      return res.status(400).json({ error: 'Valid Service Start Date (YYYY-MM-DD) is required.' });
    }
  }

  if (service_end_date !== undefined) {
    service_end_date = normalizeDateStr(service_end_date);
    if (!service_end_date || !/^\d{4}-\d{2}-\d{2}$/.test(service_end_date)) {
      return res.status(400).json({ error: 'Valid Service End Date (YYYY-MM-DD) is required.' });
    }
  }

  let operating_days = req.body.operating_days !== undefined ? req.body.operating_days : req.body.operatingDays;
  if (operating_days !== undefined && !Array.isArray(operating_days)) {
    operating_days = typeof operating_days === 'string' ? operating_days.split(',').map(d => d.trim()).filter(Boolean) : [];
  }

  let specific_service_dates = req.body.specific_service_dates !== undefined ? req.body.specific_service_dates : req.body.specificDates;
  if (specific_service_dates !== undefined) {
    if (!Array.isArray(specific_service_dates)) {
      specific_service_dates = typeof specific_service_dates === 'string' ? specific_service_dates.split(',').map(d => d.trim()).filter(Boolean) : [];
    }
    specific_service_dates = Array.from(new Set(specific_service_dates.map(d => normalizeDateStr(d)).filter(Boolean)));
  }

  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const train = mockDb.trains.get(id);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    const route = Array.from(mockDb.routes.values()).find(r => r.train_id === id);

    const effStartDate = service_start_date !== undefined ? service_start_date : (train.service_start_date || route?.service_start_date);
    const effEndDate = service_end_date !== undefined ? service_end_date : (train.service_end_date || route?.service_end_date);
    if (effStartDate && effEndDate && effEndDate < effStartDate) {
      return res.status(400).json({ error: 'Service End Date cannot be earlier than Service Start Date.' });
    }

    const effDep = departure_time !== undefined ? ensure24HourTime(departure_time) : (route?.departure_time || '10:00:00');
    const effArr = arrival_time !== undefined ? ensure24HourTime(arrival_time) : (route?.arrival_time || '18:00:00');
    const { dayOffset: calcOffset } = calculateOvernightOffset(effDep, effArr);
    const day_offset = req.body.day_offset !== undefined ? parseInt(req.body.day_offset, 10) : calcOffset;

    let stops = undefined;
    if (req.body.stops !== undefined) {
      const stopValidation = validateStopChronology(effDep, effArr, req.body.stops, day_offset);
      if (!stopValidation.valid) {
        return res.status(400).json({ error: stopValidation.error });
      }
      stops = stopValidation.enrichedStops;
    }

    const foodVal = parseAndValidateFoodConfig(req.body, true, train);
    if (!foodVal.valid) {
      return res.status(400).json({ error: foodVal.error });
    }

    const rawClasses = req.body.available_classes || req.body.availableClasses || req.body.classes;
    if (rawClasses !== undefined) {
      const parsedClasses = normalizeClassList(rawClasses);
      if (parsedClasses.length === 0) {
        return res.status(400).json({ error: 'At least one travel class must be selected for the train.' });
      }
      train.available_classes = parsedClasses;
    }

    if (train_number !== undefined && String(train_number).trim() !== train.train_number) {
      const dup = Array.from(mockDb.trains.values()).find(
        t => t.id !== id && String(t.train_number) === String(train_number).trim()
      );
      if (dup) {
        return res.status(400).json({ error: `Train number ${train_number} already exists` });
      }
      train.train_number = String(train_number).trim();
    }

    if (train_name !== undefined) train.train_name = String(train_name).trim();
    if (status !== undefined) train.status = status;
    if (delay_minutes !== undefined) train.delay_minutes = parseInt(delay_minutes);
    if (frequency_type !== undefined) train.frequency_type = frequency_type;
    if (frequency !== undefined) train.frequency = frequency;
    if (service_start_date !== undefined) train.service_start_date = service_start_date;
    if (service_end_date !== undefined) train.service_end_date = service_end_date;
    if (operating_days !== undefined) train.operating_days = operating_days;
    if (specific_service_dates !== undefined) train.specific_service_dates = specific_service_dates;
    if (service_status !== undefined) train.service_status = service_status;
    train.day_offset = day_offset;

    if (source !== undefined) train.source_station_code = extractStationCode(source);
    if (destination !== undefined) train.destination_station_code = extractStationCode(destination);
    
    train.food_available = foodVal.config.food_available;
    train.catering_payment_mode = foodVal.config.catering_payment_mode;
    train.food_type = foodVal.config.food_type;
    train.vegetarian_food_price = foodVal.config.vegetarian_food_price;
    train.non_vegetarian_food_price = foodVal.config.non_vegetarian_food_price;
    train.class_catering = foodVal.config.class_catering;

    if (req.body.tatkal_quota !== undefined) train.tatkal_quota = req.body.tatkal_quota;
    if (req.body.tatkal_capacity !== undefined) train.tatkal_capacity = req.body.tatkal_capacity;

    train.updatedAt = nowIso;
    train.updated_at = nowIso;

    const reqJourneyDate = req.body.journey_date || req.body.journeyDate;
    if (reqJourneyDate !== undefined) {
      const normJDate = normalizeDateStr(reqJourneyDate);
      if (!normJDate || !/^\d{4}-\d{2}-\d{2}$/.test(normJDate)) {
        return res.status(400).json({ error: 'Valid Journey Date (YYYY-MM-DD) is required.' });
      }
      train.journey_date = normJDate;
      train.service_start_date = normJDate;
      train.service_end_date = normJDate;
      train.specific_service_dates = [normJDate];
      train.operating_days = [];
      train.frequency_type = 'Specific Dates';
      train.frequency = formatDateFriendly(normJDate);
      train.is_date_specific = true;
    }

    mockDb.trains.set(id, train);

    // Update route
    if (route) {
      if (reqJourneyDate !== undefined) {
        const normJDate = normalizeDateStr(reqJourneyDate);
        route.journey_date = normJDate;
        route.service_start_date = normJDate;
        route.service_end_date = normJDate;
        route.specific_service_dates = [normJDate];
        route.operating_days = [];
        route.frequency_type = 'Specific Dates';
        route.frequency = formatDateFriendly(normJDate);
        route.is_date_specific = true;

        if (mockDb.train_services) {
          for (const [sKey, sVal] of mockDb.train_services.entries()) {
            if (sVal && (sVal.train_id === id || String(sVal.train_number) === String(train.train_number))) {
              if (sVal.service_date !== normJDate) {
                mockDb.train_services.delete(sKey);
              }
            }
          }
        }
      }
      if (source !== undefined) route.source_station_code = extractStationCode(source);
      if (destination !== undefined) route.destination_station_code = extractStationCode(destination);
      if (departure_time !== undefined) route.departure_time = ensure24HourTime(departure_time);
      if (arrival_time !== undefined) route.arrival_time = ensure24HourTime(arrival_time);
      if (distance_km !== undefined) route.distance_km = parseFloat(distance_km);
      if (fare_multiplier !== undefined) route.fare_multiplier = parseFloat(fare_multiplier);
      if (frequency_type !== undefined) route.frequency_type = frequency_type;
      if (frequency !== undefined) route.frequency = frequency;
      if (service_start_date !== undefined) route.service_start_date = service_start_date;
      if (service_end_date !== undefined) route.service_end_date = service_end_date;
      if (operating_days !== undefined) route.operating_days = operating_days;
      if (specific_service_dates !== undefined) route.specific_service_dates = specific_service_dates;
      if (service_status !== undefined) route.service_status = service_status;
      route.day_offset = day_offset;
      if (stops !== undefined) route.stops = stops;
      mockDb.routes.set(route.id, route);
    }

    // Regenerate service instances for updated train (targeted to this train)
    try {
      generateServiceInstances(60, { trainId: id, trainNumber: train.train_number });
    } catch (e) {
      console.error('Error generating services after train update:', e.message);
    }

    const nextService = getNextServiceDateTime({ ...train, ...route });

    return res.json({ message: 'Train updated successfully (Mock Mode)', train: { ...train, next_service: nextService, route } });
  } else {
    try {
      const trainUpdates = { updated_at: nowIso };
      if (train_number !== undefined) {
        const cleanNo = String(train_number).trim();
        const { data: dupTrain } = await supabase
          .from('trains')
          .select('id')
          .eq('train_number', cleanNo)
          .neq('id', id)
          .maybeSingle();
        if (dupTrain) {
          return res.status(400).json({ error: `Train number ${cleanNo} already exists` });
        }
        trainUpdates.train_number = cleanNo;
      }
      if (train_name !== undefined) trainUpdates.train_name = String(train_name).trim();
      if (status !== undefined) trainUpdates.status = status;
      if (delay_minutes !== undefined) trainUpdates.delay_minutes = parseInt(delay_minutes);
      if (source !== undefined) trainUpdates.source_station_code = extractStationCode(source);
      if (destination !== undefined) trainUpdates.destination_station_code = extractStationCode(destination);
      if (frequency_type !== undefined) trainUpdates.frequency_type = frequency_type;
      if (service_start_date !== undefined) trainUpdates.service_start_date = service_start_date;
      if (service_end_date !== undefined) trainUpdates.service_end_date = service_end_date;
      if (operating_days !== undefined) trainUpdates.operating_days = operating_days;
      if (specific_service_dates !== undefined) trainUpdates.specific_service_dates = specific_service_dates;
      if (service_status !== undefined) trainUpdates.service_status = service_status;
      if (reqJourneyDate !== undefined) {
        const normJDate = normalizeDateStr(reqJourneyDate);
        trainUpdates.journey_date = normJDate;
        trainUpdates.service_start_date = normJDate;
        trainUpdates.service_end_date = normJDate;
        trainUpdates.specific_service_dates = [normJDate];
        trainUpdates.operating_days = [];
        trainUpdates.frequency_type = 'Specific Dates';
        trainUpdates.frequency = formatDateFriendly(normJDate);
        trainUpdates.is_date_specific = true;
      }

      let trainData = null;
      if (Object.keys(trainUpdates).length > 0) {
        const { data, error } = await supabase
          .from('trains')
          .update(trainUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        trainData = data;
      }

      const routeUpdates = {};
      if (reqJourneyDate !== undefined) {
        const normJDate = normalizeDateStr(reqJourneyDate);
        routeUpdates.journey_date = normJDate;
        routeUpdates.service_start_date = normJDate;
        routeUpdates.service_end_date = normJDate;
        routeUpdates.specific_service_dates = [normJDate];
        routeUpdates.operating_days = [];
        routeUpdates.frequency_type = 'Specific Dates';
        routeUpdates.frequency = formatDateFriendly(normJDate);
        routeUpdates.is_date_specific = true;
      }
      if (source !== undefined) routeUpdates.source_station_code = extractStationCode(source);
      if (destination !== undefined) routeUpdates.destination_station_code = extractStationCode(destination);
      if (departure_time !== undefined) routeUpdates.departure_time = ensure24HourTime(departure_time);
      if (arrival_time !== undefined) routeUpdates.arrival_time = ensure24HourTime(arrival_time);
      if (distance_km !== undefined) routeUpdates.distance_km = parseFloat(distance_km);
      if (fare_multiplier !== undefined) routeUpdates.fare_multiplier = parseFloat(fare_multiplier);
      if (frequency_type !== undefined) routeUpdates.frequency_type = frequency_type;
      if (service_start_date !== undefined) routeUpdates.service_start_date = service_start_date;
      if (service_end_date !== undefined) routeUpdates.service_end_date = service_end_date;
      if (operating_days !== undefined) routeUpdates.operating_days = operating_days;
      if (specific_service_dates !== undefined) routeUpdates.specific_service_dates = specific_service_dates;
      if (service_status !== undefined) routeUpdates.service_status = service_status;
      if (req.body.stops !== undefined) routeUpdates.stops = req.body.stops;

      let routeData = null;
      if (Object.keys(routeUpdates).length > 0) {
        const { data, error } = await supabase
          .from('routes')
          .update(routeUpdates)
          .eq('train_id', id)
          .select();

        if (error) throw error;
        routeData = data && data.length > 0 ? data[0] : null;
      }

      const nextService = getNextServiceDateTime({ ...trainData, ...routeData });

      return res.json({ train: { ...trainData, next_service: nextService }, route: routeData });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Safely deactivate train schedule (Staff with MANAGE_TRAIN_SCHEDULES & Admin)
router.post('/:id/deactivate', authenticateToken, requireRoles(['staff', 'admin']), requirePermission(['MANAGE_TRAIN_SCHEDULES']), async (req, res) => {
  const { id } = req.params;
  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const train = mockDb.trains.get(id) || Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    train.status = 'inactive';
    train.service_status = 'INACTIVE';
    train.updated_at = nowIso;
    mockDb.trains.set(train.id, train);

    const route = Array.from(mockDb.routes.values()).find(r => r.train_id === train.id);
    if (route) {
      route.service_status = 'INACTIVE';
      mockDb.routes.set(route.id, route);
    }

    if (mockDb.train_services) {
      for (const [sKey, s] of Array.from(mockDb.train_services.entries())) {
        if (s.train_id === train.id || String(s.train_number) === String(train.train_number)) {
          s.service_status = 'INACTIVE';
          s.status = 'CANCELLED';
        }
      }
    }

    return res.json({
      message: `Train ${train.train_number} (${train.train_name}) service schedule deactivated. Historical booking records preserved.`,
      train
    });
  } else {
    try {
      const { data: train, error } = await supabase
        .from('trains')
        .update({ status: 'inactive', service_status: 'INACTIVE', updated_at: nowIso })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('routes').update({ service_status: 'INACTIVE' }).eq('train_id', id);
      await supabase.from('train_services').update({ service_status: 'INACTIVE', status: 'CANCELLED' }).eq('train_id', id);

      return res.json({
        message: `Train ${train.train_number} (${train.train_name}) service schedule deactivated. Historical booking records preserved.`,
        train
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Delete or safely deactivate train (Admin only)
router.delete('/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const train = mockDb.trains.get(id) || Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    const hasBookings = await checkTrainBookings(train.id, train.train_number);
    if (hasBookings) {
      // Soft-deactivate to protect historical booking records and audit integrity
      train.status = 'inactive';
      train.service_status = 'INACTIVE';
      train.updated_at = nowIso;
      mockDb.trains.set(train.id, train);

      if (mockDb.train_services) {
        for (const [sKey, s] of Array.from(mockDb.train_services.entries())) {
          if (s.train_id === train.id || String(s.train_number) === String(train.train_number)) {
            s.service_status = 'INACTIVE';
            s.status = 'CANCELLED';
          }
        }
      }

      return res.json({
        message: `Train ${train.train_number} has existing bookings. Safely deactivated without deleting historical records.`,
        deactivated: true,
        historical_preserved: true
      });
    }

    mockDb.trains.delete(train.id);

    // Cascade delete associated route and seats
    for (const [rId, r] of Array.from(mockDb.routes.entries())) {
      if (r.train_id === train.id) mockDb.routes.delete(rId);
    }
    for (const [sId, s] of Array.from(mockDb.seats.entries())) {
      if (s.train_id === train.id) mockDb.seats.delete(sId);
    }

    return res.json({ message: 'Train deleted successfully (Mock Mode)' });
  } else {
    try {
      const { data: train } = await supabase.from('trains').select('id, train_number, train_name').eq('id', id).single();
      if (!train) return res.status(404).json({ error: 'Train not found' });

      const hasBookings = await checkTrainBookings(train.id, train.train_number);
      if (hasBookings) {
        await supabase.from('trains').update({ status: 'inactive', service_status: 'INACTIVE', updated_at: nowIso }).eq('id', train.id);
        await supabase.from('routes').update({ service_status: 'INACTIVE' }).eq('train_id', train.id);
        await supabase.from('train_services').update({ service_status: 'INACTIVE', status: 'CANCELLED' }).eq('train_id', train.id);
        return res.json({
          message: `Train ${train.train_number} has existing bookings. Safely deactivated without deleting historical records.`,
          deactivated: true,
          historical_preserved: true
        });
      }

      const { error } = await supabase.from('trains').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Train deleted successfully' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Get seat layout and availability for a specific train
router.get('/:id/seats', async (req, res) => {
  const { id } = req.params;
  const { date, coach_class } = req.query;

  if (!date || !coach_class) {
    return res.status(400).json({ error: 'Date and coach_class query parameters are required' });
  }

  if (isMockMode) {
    const train = mockDb.trains.get(id) || Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
    if (train) {
      const trainClasses = (Array.isArray(train.available_classes) && train.available_classes.length > 0)
        ? normalizeClassList(train.available_classes)
        : getDefaultClassesForTrain(train.train_name, train.train_type || train.trainType);
      
      const requestedClass = normalizeClassList([coach_class])[0];
      if (requestedClass && !trainClasses.includes(requestedClass)) {
        return res.status(400).json({ error: `Selected class ${coach_class} is not available on this train.` });
      }
    }

    // Get all seats for train
    let seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === id && s.coach_class === coach_class
    );

    // If no seats exist for this specific train and class, generate 24 standard berths on the fly
    if (seats.length === 0) {
      const coachNum = coach_class === 'SL' ? 'S1' : coach_class === '3A' ? 'B1' : coach_class === '2A' ? 'A1' : coach_class === '1A' ? 'H1' : 'C1';
      seats = Array.from({ length: 24 }).map((_, idx) => {
        const seatNum = idx + 1;
        const berthType = seatNum % 6 === 1 || seatNum % 6 === 2 ? 'LB' : seatNum % 6 === 3 || seatNum % 6 === 4 ? 'MB' : 'UB';
        const sId = `${id}-${coachNum}-${seatNum}`;
        const newSeat = {
          id: sId,
          train_id: id,
          coach_class,
          coach_number: coachNum,
          seat_number: seatNum,
          berth_type: berthType
        };
        // Keep in-memory layout representation without mutating baseline mockDb.seats
        return newSeat;
      });
    }

    // Get allocations for active non-cancelled bookings on this date
    const activeBookingIds = Array.from(mockDb.bookings.values())
      .filter(b => b.status !== 'cancelled')
      .map(b => b.id);

    const allocations = Array.from(mockDb.seat_allocations.values()).filter(
      a => activeBookingIds.includes(a.booking_id) && a.travel_date === date && seats.some(s => s.id === a.seat_id)
    );

    // Build representation
    const layout = seats.map(s => {
      const alloc = allocations.find(a => a.seat_id === s.id);
      return {
        ...s,
        is_booked: !!alloc,
        passenger_name: alloc ? alloc.passenger_name : null
      };
    });

    // Calculate availability status
    const availableCount = layout.filter(s => !s.is_booked).length;
    const activeBookings = Array.from(mockDb.bookings.values()).filter(
      b => b.train_id === id && b.travel_date === date && b.status !== 'cancelled'
    );
    const racCount = activeBookings.filter(b => b.status === 'rac').length;
    const wlCount = activeBookings.filter(b => b.status === 'waitlist').length;

    let status = 'AVL';
    let position = availableCount;
    let statusCode = `AVL ${availableCount}`;
    let waitlistType = null;

    if (availableCount === 0) {
      if (racCount < 4) {
        status = 'RAC';
        position = racCount + 1;
        statusCode = `RAC ${position}`;
      } else {
        status = 'WL';
        position = wlCount + 1;
        const reqQuota = String(req.query.quota || '').toUpperCase();
        waitlistType = (reqQuota === 'TQ' || reqQuota === 'CK' || reqQuota === 'TATKAL') ? 'TQWL' : 'GNWL';
        statusCode = `${waitlistType} ${position}`;
      }
    }

    let availability_status = status === 'AVL' ? 'AVAILABLE' : status === 'RAC' ? 'RAC' : 'WL';

    return res.json({
      status,
      availability_status,
      waitlist_type: waitlistType,
      available_count: availableCount,
      position,
      status_code: statusCode,
      coach_class,
      seats: layout,
      layout: layout
    });
  } else {
    try {
      // 1. Fetch matching seats
      const { data: seats, error: seatsErr } = await supabase
        .from('seats')
        .select('*')
        .eq('train_id', id)
        .eq('coach_class', coach_class);

      if (seatsErr) throw seatsErr;

      // 2. Fetch active allocations for these seats on the travel date
      const seatIds = seats.map(s => s.id);
      const { data: allocations, error: allocErr } = await supabase
        .from('seat_allocations')
        .select('*')
        .eq('travel_date', date)
        .in('seat_id', seatIds);

      if (allocErr) throw allocErr;

      const layout = seats.map(s => {
        const alloc = allocations.find(a => a.seat_id === s.id);
        return {
          ...s,
          is_booked: !!alloc,
          passenger_name: alloc ? alloc.passenger_name : null
        };
      });

      const availableCount = layout.filter(s => !s.is_booked).length;
      let status = availableCount > 0 ? 'AVL' : 'RAC';
      let position = availableCount;
      let statusCode = availableCount > 0 ? `AVL ${availableCount}` : 'RAC 1';
      let availability_status = availableCount > 0 ? 'AVAILABLE' : 'RAC';

      return res.json({
        status,
        availability_status,
        available_count: availableCount,
        position,
        status_code: statusCode,
        seats: layout
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// GET all stations
router.get('/stations', async (req, res) => {
  if (isMockMode) {
    const stationsList = Array.from(mockDb.stations.values());
    return res.json(stationsList);
  } else {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('station_name');
      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Create a new station (Staff & Admin)
router.post('/stations', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { station_code, station_name, state, platforms } = req.body;
  
  if (!station_code || !String(station_code).trim()) {
    return res.status(400).json({ error: 'Station code is required' });
  }
  if (!station_name || !String(station_name).trim()) {
    return res.status(400).json({ error: 'Station name is required' });
  }

  const cleanCode = String(station_code).trim().toUpperCase();
  const cleanName = String(station_name).trim();

  if (isMockMode) {
    const existing = Array.from(mockDb.stations.values()).find(s => s.station_code === cleanCode);
    if (existing) {
      return res.status(400).json({ error: `Station code ${cleanCode} already exists` });
    }
    const newId = 'st-' + Math.random().toString(36).substr(2, 9);
    const newStation = {
      id: newId,
      station_code: cleanCode,
      station_name: cleanName,
      state: state || 'Unknown',
      platforms: platforms ? parseInt(platforms) : 2,
      created_at: new Date().toISOString()
    };
    mockDb.stations.set(newId, newStation);
    return res.status(201).json(newStation);
  } else {
    try {
      const { data, error } = await supabase
        .from('stations')
        .insert({
          station_code: cleanCode,
          station_name: cleanName,
          state: state || 'Unknown',
          platforms: platforms ? parseInt(platforms) : 2
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Update station (Staff & Admin)
router.put('/stations/:id', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { station_code, station_name, state, platforms } = req.body;

  if (isMockMode) {
    const station = mockDb.stations.get(id);
    if (!station) return res.status(404).json({ error: 'Station not found' });

    if (station_code !== undefined) station.station_code = String(station_code).trim().toUpperCase();
    if (station_name !== undefined) station.station_name = String(station_name).trim();
    if (state !== undefined) station.state = state;
    if (platforms !== undefined) station.platforms = parseInt(platforms);

    mockDb.stations.set(id, station);
    return res.json(station);
  } else {
    try {
      const updateData = {};
      if (station_code !== undefined) updateData.station_code = String(station_code).trim().toUpperCase();
      if (station_name !== undefined) updateData.station_name = String(station_name).trim();
      if (state !== undefined) updateData.state = state;
      if (platforms !== undefined) updateData.platforms = parseInt(platforms);

      const { data, error } = await supabase
        .from('stations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Delete station (Admin only)
router.delete('/stations/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    if (!mockDb.stations.has(id)) return res.status(404).json({ error: 'Station not found' });
    mockDb.stations.delete(id);
    return res.json({ message: 'Station deleted successfully' });
  } else {
    try {
      const { error } = await supabase.from('stations').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Station deleted successfully' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// GET /api/trains/:id/tatkal-status - Returns authoritative Tatkal window & inventory status
router.get('/:id/tatkal-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, travelDate, classCode = '3A', fromStation } = req.query;
    const targetDate = normalizeDateStr(travelDate || date) || getNowIST().dateStr;

    const mockDb = getDb();
    let train = mockDb?.trains?.get(id) || Array.from(mockDb?.trains?.values() || []).find(t => String(t.train_number) === String(id) || t.id === id);
    if (!train) {
      return res.status(404).json({ error: 'Train not found' });
    }

    const route = Array.from(mockDb?.routes?.values() || []).find(r => r && (r.train_id === train.id || String(r.train_number) === String(train.train_number)));
    const { getTatkalWindowStatus, getTatkalClassCapacity, calculateTatkalCharge } = require('../utils/tatkalRules');

    const windowStatus = getTatkalWindowStatus({
      train,
      route,
      travelDate: targetDate,
      fromStation: fromStation || train.source_station_code || train.source,
      classCode
    });

    const capacity = getTatkalClassCapacity(train, classCode);
    const avail = calculateDeterministicAvailability(train.train_number, targetDate, classCode, null, null, 'TATKAL', fromStation);
    const tatkalCharge = calculateTatkalCharge(classCode, train.base_fare || 500);

    return res.json({
      train_id: train.id,
      train_number: train.train_number,
      travel_date: targetDate,
      class_code: classCode,
      tatkal_window: windowStatus,
      tatkal_capacity: capacity,
      tatkal_available: avail.availableCount,
      tatkal_status: avail.statusCode,
      tatkal_charge: tatkalCharge,
      is_open: windowStatus.isOpen,
      is_bookable: windowStatus.isOpen && avail.isBookable
    });
  } catch (err) {
    console.error('Error fetching tatkal status:', err);
    return res.status(500).json({ error: 'Failed to fetch Tatkal status' });
  }
});

module.exports = router;
