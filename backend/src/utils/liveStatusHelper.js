const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { buildOrderedStationNodes, extractStationCode } = require('./routeSearch');

const STATION_COORDINATES_MAP = {
  'NDLS': { lat: 28.6424, lng: 77.2195, name: 'New Delhi' },
  'MMCT': { lat: 18.9696, lng: 72.8193, name: 'Mumbai Central' },
  'CSMT': { lat: 18.9400, lng: 72.8353, name: 'Mumbai CSMT' },
  'KOTA': { lat: 25.2215, lng: 75.8648, name: 'Kota Junction' },
  'RTM':  { lat: 23.3344, lng: 75.0372, name: 'Ratlam Junction' },
  'BRC':  { lat: 22.3107, lng: 73.1812, name: 'Vadodara Junction' },
  'AGC':  { lat: 27.1574, lng: 78.0081, name: 'Agra Cantt' },
  'GWL':  { lat: 26.2124, lng: 78.1772, name: 'Gwalior Junction' },
  'VGLJ': { lat: 25.4484, lng: 78.5685, name: 'VGL Jhansi' },
  'BPL':  { lat: 23.2599, lng: 77.4126, name: 'Bhopal Junction' },
  'CNB':  { lat: 26.4542, lng: 80.3500, name: 'Kanpur Central' },
  'PRYJ': { lat: 25.4452, lng: 81.8315, name: 'Prayagraj Junction' },
  'BSB':  { lat: 25.3267, lng: 82.9894, name: 'Varanasi Junction' },
  'HWH':  { lat: 22.5839, lng: 88.3426, name: 'Howrah Junction' },
  'ASN':  { lat: 23.6889, lng: 86.9661, name: 'Asansol Junction' },
  'PNBE': { lat: 25.6022, lng: 85.1376, name: 'Patna Junction' },
  'DDU':  { lat: 25.2818, lng: 83.1232, name: 'Pt Deen Dayal Upadhyaya' },
  'NZM':  { lat: 28.5892, lng: 77.2514, name: 'Hazrat Nizamuddin' },
  'SBC':  { lat: 12.9781, lng: 77.5697, name: 'KSR Bengaluru' },
  'MAS':  { lat: 13.0827, lng: 80.2707, name: 'MGR Chennai Central' },
  'PUNE': { lat: 18.5289, lng: 73.8744, name: 'Pune Junction' },
  'ADI':  { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad Junction' },
  'ST':   { lat: 21.2052, lng: 72.8407, name: 'Surat' },
  'UDU':  { lat: 13.3409, lng: 74.7421, name: 'Udupi' },
  'JP':   { lat: 26.9200, lng: 75.7873, name: 'Jaipur Junction' },
  'GKP':  { lat: 26.7606, lng: 83.3732, name: 'Gorakhpur Junction' },
  'LKO':  { lat: 26.8322, lng: 80.9234, name: 'Lucknow Charbagh' },
  'BBS':  { lat: 20.2520, lng: 85.8364, name: 'Bhubaneswar' },
  'VSKP': { lat: 17.7231, lng: 83.2906, name: 'Visakhapatnam' },
  'BZA':  { lat: 16.5186, lng: 80.6200, name: 'Vijayawada' },
  'ET':   { lat: 22.6105, lng: 77.7667, name: 'Itarsi Junction' },
  'JBP':  { lat: 23.1610, lng: 79.9497, name: 'Jabalpur Junction' },
  'R':    { lat: 21.2514, lng: 81.6296, name: 'Raipur Junction' },
  'BSP':  { lat: 22.0797, lng: 82.1391, name: 'Bilaspur Junction' },
  'GAYA': { lat: 24.7969, lng: 84.9994, name: 'Gaya Junction' },
  'DLI':  { lat: 28.6611, lng: 77.2275, name: 'Old Delhi Junction' },
  'ANVT': { lat: 28.6469, lng: 77.3150, name: 'Anand Vihar Terminal' },
  'GZB':  { lat: 28.6667, lng: 77.4333, name: 'Ghaziabad Junction' },
  'YPR':  { lat: 13.0238, lng: 77.5510, name: 'Yesvantpur Junction' },
  'MYS':  { lat: 12.3164, lng: 76.6462, name: 'Mysuru Junction' },
  'UBL':  { lat: 15.3517, lng: 75.1419, name: 'Hubballi Junction' },
  'TPJ':  { lat: 10.7938, lng: 78.6836, name: 'Tiruchchirappalli' },
  'CBE':  { lat: 11.0018, lng: 76.9629, name: 'Coimbatore Junction' },
  'MDU':  { lat: 9.9176,  lng: 78.1189, name: 'Madurai Junction' },
  'TVC':  { lat: 8.4871,  lng: 76.9524, name: 'Thiruvananthapuram' },
  'ERS':  { lat: 9.9680,  lng: 76.2890, name: 'Ernakulam Junction' },
  'CLT':  { lat: 11.2476, lng: 75.7804, name: 'Kozhikode' },
  'GHY':  { lat: 26.1822, lng: 91.7523, name: 'Guwahati' },
  'SDAH': { lat: 22.5670, lng: 88.3711, name: 'Sealdah' },
  'HYB':  { lat: 17.3930, lng: 78.4680, name: 'Hyderabad Deccan' },
  'SC':   { lat: 17.4344, lng: 78.5015, name: 'Secunderabad Junction' },
  'KCG':  { lat: 17.3872, lng: 78.4908, name: 'Kacheguda' },
  'WL':   { lat: 17.9689, lng: 79.6050, name: 'Warangal' }
};

function getStationCoords(code, name) {
  const cleanCode = extractStationCode(code || name);
  if (STATION_COORDINATES_MAP[cleanCode]) {
    return STATION_COORDINATES_MAP[cleanCode];
  }
  let hash = 0;
  for (let i = 0; i < cleanCode.length; i++) hash = cleanCode.charCodeAt(i) + ((hash << 5) - hash);
  const lat = 15.0 + Math.abs(hash % 1200) / 100.0;
  const lng = 73.0 + Math.abs((hash >> 3) % 1200) / 100.0;
  return { lat, lng, name: name || cleanCode };
}

/**
 * Returns current date (YYYY-MM-DD) and current minutes from midnight in Indian Standard Time (Asia/Kolkata).
 */
function getISTDateAndMinutes() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;
  const currentMinsFromMidnight = hours * 60 + minutes;
  return { dateStr, currentMinsFromMidnight, timeStr: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` };
}

/**
 * Parses time string e.g. "16:30", "06:00:00", "04:15 PM" into minutes from midnight.
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || timeStr === '--:--') return null;
  const clean = String(timeStr).trim();
  if (clean.toUpperCase().includes('AM') || clean.toUpperCase().includes('PM')) {
    const parts = clean.split(/\s+/);
    const [hStr, mStr] = parts[0].split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;
    const ampm = parts[1].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = clean.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

async function fetchTrainAndRoute(trainIdOrNumber) {
  if (isMockMode) {
    let train = mockDb.trains.get(trainIdOrNumber);
    if (!train) {
      train = Array.from(mockDb.trains.values()).find(t => t.train_number === trainIdOrNumber || t.id === trainIdOrNumber);
    }
    if (!train) return null;

    let route = Array.from(mockDb.routes.values()).find(r => r.train_id === train.id);
    return { train, route };
  } else {
    try {
      let query = supabase.from('trains').select('*, routes(*)');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trainIdOrNumber);
      if (isUuid) {
        query = query.eq('id', trainIdOrNumber);
      } else {
        query = query.eq('train_number', trainIdOrNumber);
      }
      const { data, error } = await query.single();
      if (error || !data) return null;
      const train = data;
      const route = train.routes && train.routes.length > 0 ? train.routes[0] : null;
      return { train, route };
    } catch (e) {
      console.error('Error fetching train in liveStatusHelper:', e.message);
      return null;
    }
  }
}

async function fetchTelemetry(trainId, serviceDate) {
  if (isMockMode) {
    // Find telemetry matching train_id and service_date (or default match if test telemetry)
    const telemetryList = Array.from(mockDb.train_telemetry.values()).filter(t => t.train_id === trainId);
    if (serviceDate) {
      const matched = telemetryList.find(t => t.service_date === serviceDate);
      if (matched) return matched;
    }
    const genericMatch = telemetryList.find(t => !t.service_date || t.service_date === serviceDate);
    return genericMatch || null;
  } else {
    try {
      let query = supabase.from('train_telemetry').select('*').eq('train_id', trainId);
      if (serviceDate) {
        query = query.eq('service_date', serviceDate);
      }
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(1);
      if (error || !data || data.length === 0) return null;
      return data[0];
    } catch (e) {
      return null;
    }
  }
}

async function getLiveStatusForTrain(trainIdOrNumber, requestedServiceDate = null) {
  const trainAndRoute = await fetchTrainAndRoute(trainIdOrNumber);
  if (!trainAndRoute) return null;

  const { train, route } = trainAndRoute;
  const rawNodes = buildOrderedStationNodes(train, route);
  const totalDistance = parseFloat(route?.distance_km || train?.distance_km || 1000);

  const ist = getISTDateAndMinutes();
  const serviceDate = requestedServiceDate || ist.dateStr;

  const originNode = rawNodes[0] || {};
  const originDepartureTime = originNode.depTime || route?.departure_time || train?.departure_time || '08:00';
  const depMinsFromMidnight = parseTimeToMinutes(originDepartureTime);

  // Determine Journey State strictly by actual schedule date and IST time
  let state = 'NOT_STARTED';
  let isLive = false;
  let canMove = false;
  let minsUntilDeparture = 0;

  if (!serviceDate || depMinsFromMidnight === null) {
    state = 'SCHEDULE_UNAVAILABLE';
  } else if (ist.dateStr < serviceDate) {
    // Journey is scheduled for a future date (tomorrow or later)
    state = 'NOT_STARTED';
    const serviceDateObj = new Date(serviceDate + 'T00:00:00');
    const todayObj = new Date(ist.dateStr + 'T00:00:00');
    const diffDays = Math.ceil((serviceDateObj - todayObj) / (1000 * 60 * 60 * 24));
    minsUntilDeparture = (diffDays * 24 * 60) + (depMinsFromMidnight - ist.currentMinsFromMidnight);
  } else if (ist.dateStr === serviceDate) {
    if (ist.currentMinsFromMidnight < depMinsFromMidnight) {
      // Departure time has NOT passed yet today
      state = 'NOT_STARTED';
      minsUntilDeparture = depMinsFromMidnight - ist.currentMinsFromMidnight;
    } else {
      // Departure time has arrived or passed today
      state = 'LIVE';
      isLive = true;
      canMove = true;
    }
  } else {
    // Service date is in the past (yesterday or older)
    state = 'COMPLETED';
  }

  // Fetch telemetry matching THIS journey/service date
  const telemetry = (isLive || state === 'LIVE' || state === 'COMPLETED') ? await fetchTelemetry(train.id, serviceDate) : null;

  // Enrich stops nodes with lat/lng & distances
  const stops = rawNodes.map((node, idx) => {
    const coords = getStationCoords(node.code, node.name);
    let distFromOrigin = node.distanceFromOriginKm ?? node.distance_km;
    if (distFromOrigin === undefined || distFromOrigin === null || isNaN(parseFloat(distFromOrigin))) {
      distFromOrigin = Math.round((idx / Math.max(1, rawNodes.length - 1)) * totalDistance);
    }
    return {
      ...node,
      code: node.code,
      name: node.name,
      lat: coords.lat,
      lng: coords.lng,
      arrTime: node.arrTime || '--:--',
      depTime: node.depTime || '--:--',
      platform: node.platform || '1',
      distanceFromOriginKm: parseFloat(distFromOrigin)
    };
  });

  const originCoords = stops[0] ? { lat: stops[0].lat, lng: stops[0].lng } : { lat: 28.6424, lng: 77.2195 };
  const destCoords = stops[stops.length - 1] ? { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng } : originCoords;

  let speed = 0;
  let delayMinutes = train.delay_minutes || 0;
  let delayReason = null;
  let currentStationCode = stops[0]?.code;
  let nextStationCode = stops.length > 1 ? stops[1].code : stops[0]?.code;
  let platform = stops[0]?.platform || '1';
  let latitude = originCoords.lat;
  let longitude = originCoords.lng;
  let distanceTravelledKm = 0;
  let updatedAt = new Date().toISOString();
  let isTelemetryAvailable = false;

  if (state === 'NOT_STARTED') {
    // PRE-DEPARTURE STRICT HARD STATE: No speed, no movement, no progress, location locked to origin
    speed = 0;
    distanceTravelledKm = 0;
    latitude = originCoords.lat;
    longitude = originCoords.lng;
    currentStationCode = stops[0]?.code;
    nextStationCode = stops.length > 1 ? stops[1].code : stops[0]?.code;
  } else if (state === 'COMPLETED') {
    // COMPLETED STRICT STATE: Location locked to destination, 100% progress, 0 speed
    speed = 0;
    distanceTravelledKm = totalDistance;
    latitude = destCoords.lat;
    longitude = destCoords.lng;
    currentStationCode = stops[stops.length - 1]?.code;
    nextStationCode = stops[stops.length - 1]?.code;
  } else if (telemetry) {
    isTelemetryAvailable = true;
    if (telemetry.status && ['LIVE', 'DELAYED', 'STOPPED', 'COMPLETED', 'DATA UNAVAILABLE'].includes(telemetry.status)) {
      state = telemetry.status;
    }
    speed = canMove ? (telemetry.speed ?? 0) : 0;
    delayMinutes = telemetry.delay_minutes ?? train.delay_minutes ?? 0;
    delayReason = telemetry.delay_reason || null;
    currentStationCode = telemetry.current_station_code || currentStationCode;
    nextStationCode = telemetry.next_station_code || nextStationCode;
    platform = telemetry.platform || platform;
    latitude = telemetry.latitude !== null && telemetry.latitude !== undefined ? parseFloat(telemetry.latitude) : latitude;
    longitude = telemetry.longitude !== null && telemetry.longitude !== undefined ? parseFloat(telemetry.longitude) : longitude;
    distanceTravelledKm = telemetry.distance_travelled_km !== null && telemetry.distance_travelled_km !== undefined ? parseFloat(telemetry.distance_travelled_km) : distanceTravelledKm;
    updatedAt = telemetry.updated_at || telemetry.created_at || updatedAt;
  }

  // Calculate progress percentage
  const progressPercent = state === 'NOT_STARTED' ? 0 : (state === 'COMPLETED' ? 100 : Math.min(100, Math.max(0, parseFloat(((distanceTravelledKm / totalDistance) * 100).toFixed(1)))));

  // Resolve station timeline states
  let currentStopIndex = 0;
  let nextStopIndex = stops.length > 1 ? 1 : 0;

  if (state === 'COMPLETED') {
    currentStopIndex = stops.length - 1;
    nextStopIndex = stops.length - 1;
  } else if (state === 'LIVE' || state === 'DELAYED' || state === 'STOPPED') {
    if (currentStationCode) {
      const idx = stops.findIndex(s => s.code === currentStationCode);
      if (idx !== -1) currentStopIndex = idx;
    }
    if (nextStationCode) {
      const idx = stops.findIndex(s => s.code === nextStationCode);
      if (idx !== -1) nextStopIndex = idx;
    }
  }

  const enrichedStops = stops.map((stop, idx) => {
    let stationStatus = 'UPCOMING';
    if (state === 'COMPLETED' || idx < currentStopIndex) {
      stationStatus = 'COMPLETED';
    } else if (idx === currentStopIndex) {
      stationStatus = 'CURRENT';
    } else if (idx === nextStopIndex) {
      stationStatus = 'NEXT';
    } else {
      stationStatus = 'UPCOMING';
    }

    return {
      ...stop,
      status: stationStatus,
      actualArrTime: (stationStatus === 'COMPLETED') ? stop.arrTime : null,
      actualDepTime: (stationStatus === 'COMPLETED') ? stop.depTime : null,
      delayMinutes: (stationStatus === 'CURRENT' || stationStatus === 'NEXT') ? delayMinutes : 0
    };
  });

  // Calculate ETA to next station
  let etaNextStation = 'ETA unavailable';
  let etaDestination = 'ETA unavailable';

  if (state === 'NOT_STARTED') {
    etaNextStation = 'ETA unavailable';
    etaDestination = 'ETA unavailable';
  } else if (state === 'COMPLETED') {
    etaNextStation = 'Arrived';
    etaDestination = 'Arrived';
  } else {
    const nextStopNode = stops[nextStopIndex];
    if (nextStopNode && speed > 0) {
      const distToNext = Math.max(0, nextStopNode.distanceFromOriginKm - distanceTravelledKm);
      const minsToNext = Math.round((distToNext / speed) * 60);
      if (minsToNext < 1) etaNextStation = 'Approaching...';
      else if (minsToNext < 60) etaNextStation = `In ${minsToNext} mins`;
      else etaNextStation = `In ${Math.floor(minsToNext / 60)}h ${minsToNext % 60}m`;
    }

    const destNode = stops[stops.length - 1];
    if (destNode && speed > 0) {
      const distToDest = Math.max(0, totalDistance - distanceTravelledKm);
      const minsToDest = Math.round((distToDest / speed) * 60);
      if (minsToDest < 60) etaDestination = `In ${minsToDest} mins`;
      else etaDestination = `In ${Math.floor(minsToDest / 60)}h ${minsToDest % 60}m`;
    }
  }

  return {
    train: {
      id: train.id,
      train_number: train.train_number,
      train_name: train.train_name,
      status: train.status,
      delay_minutes: delayMinutes,
      source: train.source_station_code || train.source,
      destination: train.destination_station_code || train.destination
    },
    status: {
      state, // "NOT_STARTED" | "LIVE" | "DELAYED" | "STOPPED" | "COMPLETED" | "SCHEDULE_UNAVAILABLE"
      is_live: isLive,
      can_move: canMove,
      service_date: serviceDate,
      scheduled_departure_date: serviceDate,
      scheduled_departure_time: originDepartureTime,
      origin_station: stops[0]?.name || train.source,
      current_time_ist: ist.timeStr,
      mins_until_departure: Math.max(0, minsUntilDeparture)
    },
    telemetry: {
      is_available: isTelemetryAvailable,
      status: state,
      speed,
      latitude,
      longitude,
      current_station_code: currentStationCode,
      next_station_code: nextStationCode,
      distance_travelled_km: distanceTravelledKm,
      delay_minutes: delayMinutes,
      delay_reason: delayReason,
      platform,
      updated_at: updatedAt
    },
    journey: {
      total_distance_km: totalDistance,
      progress_percent: progressPercent,
      eta_next_station: etaNextStation,
      eta_destination: etaDestination
    },
    stops: enrichedStops
  };
}

module.exports = {
  STATION_COORDINATES_MAP,
  getStationCoords,
  getISTDateAndMinutes,
  parseTimeToMinutes,
  getLiveStatusForTrain,
  fetchTrainAndRoute,
  fetchTelemetry
};
