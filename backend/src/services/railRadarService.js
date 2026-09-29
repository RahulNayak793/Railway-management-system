const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Simple in-memory cache to prevent excessive requests & respect rate limits
// Map key: `${trainNumber}_${serviceDate}` -> { timestamp, data }
const cache = new Map();
const CACHE_TTL_MS = 30000; // 30 seconds cache TTL

// In-flight request deduplication map to prevent simultaneous duplicate requests
const inFlightRequests = new Map();

/**
 * Checks if the server-side RailRadar API key is configured.
 */
function hasApiKey() {
  const key = process.env.RAILRADAR_API_KEY;
  return Boolean(key && key.trim() && key !== 'your_api_key_here' && key !== 'mock_api_key_placeholder');
}

/**
 * Normalizes third-party RailRadar payload into a stable RailControl structure.
 */
function normalizeRailRadarResponse(rawData, trainNumber, serviceDate) {
  if (!rawData || typeof rawData !== 'object') {
    return { success: false, source: 'RailRadar', error: 'Invalid response payload format' };
  }

  const payload = rawData.data || rawData.train || rawData;

  const curLoc = payload.currentLocation || {};
  const prevHalt = payload.previousHalt || {};
  const nextHalt = payload.nextHalt || {};
  const trainInfo = payload.train || {};

  const lat = payload.latitude !== undefined && payload.latitude !== null ? parseFloat(payload.latitude)
            : (payload.lat !== undefined && payload.lat !== null ? parseFloat(payload.lat)
            : (curLoc.lat !== undefined && curLoc.lat !== null ? parseFloat(curLoc.lat) : null));

  const lng = payload.longitude !== undefined && payload.longitude !== null ? parseFloat(payload.longitude)
            : (payload.lng !== undefined && payload.lng !== null ? parseFloat(payload.lng)
            : (payload.lon !== undefined && payload.lon !== null ? parseFloat(payload.lon)
            : (curLoc.lng !== undefined && curLoc.lng !== null ? parseFloat(curLoc.lng) : null)));

  const speedVal = payload.speed !== undefined && payload.speed !== null ? parseInt(payload.speed, 10)
                 : (curLoc.speed !== undefined && curLoc.speed !== null ? parseInt(curLoc.speed, 10)
                 : (trainInfo.avgSpeed ? Math.round(parseFloat(trainInfo.avgSpeed)) : 0));

  const distVal = curLoc.distanceFromOriginKm !== undefined && curLoc.distanceFromOriginKm !== null
                ? parseFloat(curLoc.distanceFromOriginKm)
                : (payload.distance_travelled_km !== undefined ? parseFloat(payload.distance_travelled_km) : null);

  const rawDelay = curLoc.delayMinutes !== undefined ? curLoc.delayMinutes
                 : (payload.delayMinutes !== undefined ? payload.delayMinutes
                 : (payload.delay_minutes !== undefined ? payload.delay_minutes : 0));

  return {
    success: true,
    source: 'RailRadar',
    train: {
      number: String(payload.trainNumber || payload.number || payload.train_number || trainInfo.number || trainNumber),
      name: payload.trainName || trainInfo.name || payload.name || payload.train_name || null,
      status: String(payload.status || 'LIVE').toUpperCase(),
      latitude: lat,
      longitude: lng,
      speed: speedVal,
      delayMinutes: parseInt(rawDelay, 10) || 0,
      currentStation: curLoc.stationCode || payload.currentStation || payload.current_station || payload.current_station_code || null,
      previousStation: prevHalt.stationCode || payload.previousStation || payload.previous_station || payload.previous_station_code || null,
      nextStation: nextHalt.stationCode || payload.nextStation || payload.next_station || payload.next_station_code || null,
      distanceTravelledKm: distVal,
      arrival: payload.arrival || payload.scheduled_arrival || payload.arrTime || null,
      departure: payload.departure || payload.scheduled_departure || payload.depTime || null,
      platform: payload.platform ? String(payload.platform) : (curLoc.platform ? String(curLoc.platform) : '1'),
      last_updated: payload.lastUpdatedAt || payload.last_updated || payload.updated_at || new Date().toISOString()
    },
    raw: rawData
  };
}

/**
 * Fetches live train status from the third-party RailRadar API.
 * Server-side only. Never exposes API key to client.
 */
async function fetchRailRadarLiveStatus(trainNumber, serviceDate, options = {}) {
  const cleanTrainNo = String(trainNumber || '').trim();
  const cleanDate = String(serviceDate || '').trim();

  if (!cleanTrainNo) {
    return { success: false, source: 'RailRadar', error: 'Train number is required' };
  }

  // 1. Check API Key presence
  if (!hasApiKey()) {
    console.log(`[RailRadar] API Key not configured. Using internal fallback for train: ${cleanTrainNo}`);
    return { success: false, source: 'RailRadar', error: 'RailRadar API Key missing' };
  }

  const cacheKey = `${cleanTrainNo}_${cleanDate}`;

  // 2. Check Cache
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log(`[RailRadar] Cache hit for train: ${cleanTrainNo}, date: ${cleanDate}`);
    return cached.data;
  }

  // 3. Deduplicate In-Flight Requests
  if (inFlightRequests.has(cacheKey)) {
    console.log(`[RailRadar] In-flight request deduplicated for train: ${cleanTrainNo}`);
    return await inFlightRequests.get(cacheKey);
  }

  const apiKey = process.env.RAILRADAR_API_KEY.trim();
  const baseUrl = (process.env.RAILRADAR_API_BASE_URL || 'https://api.railradar.in').replace(/\/+$/, '');
  const timeoutMs = options.timeout || 5000;

  const requestPromise = (async () => {
    console.log(`[RailRadar] Request started - Train: ${cleanTrainNo}, Service Date: ${cleanDate || 'Today'}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${baseUrl}/v1/trains/${encodeURIComponent(cleanTrainNo)}/live${cleanDate ? `?date=${encodeURIComponent(cleanDate)}` : ''}`;

      // Custom mock response interceptor for offline / test environments
      if (options.mockFetcher) {
        const mockPromise = options.mockFetcher(cleanTrainNo, cleanDate);
        const timeoutPromise = new Promise((_, reject) => {
          const t = setTimeout(() => {
            const err = new Error(`Request timeout after ${timeoutMs}ms`);
            err.name = 'AbortError';
            reject(err);
          }, timeoutMs);
        });

        const mockRes = await Promise.race([mockPromise, timeoutPromise]);
        clearTimeout(timer);

        if (mockRes.success) {
          console.log(`[RailRadar] Response received for train: ${cleanTrainNo}`);
          cache.set(cacheKey, { timestamp: Date.now(), data: mockRes });
        } else {
          console.log(`[RailRadar] Response unavailable for train: ${cleanTrainNo}`);
        }
        return mockRes;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
          'User-Agent': 'RailControl-System/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        console.log(`[RailRadar] Response unavailable - HTTP ${response.status} for train: ${cleanTrainNo}`);
        return { success: false, source: 'RailRadar', httpStatus: response.status, error: `Third-party HTTP error ${response.status}` };
      }

      const json = await response.json();
      console.log(`[RailRadar] Response received for train: ${cleanTrainNo}`);

      const normalized = normalizeRailRadarResponse(json, cleanTrainNo, cleanDate);
      if (normalized.success) {
        cache.set(cacheKey, { timestamp: Date.now(), data: normalized });
      }
      return normalized;

    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError';
      const errMsg = isTimeout ? `Request timeout after ${timeoutMs}ms` : err.message;
      console.log(`[RailRadar] Response unavailable for train: ${cleanTrainNo} - ${errMsg}`);
      return { success: false, source: 'RailRadar', error: errMsg };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return await requestPromise;
}

/**
 * Normalizes a single external RailRadar train object into RailControl's internal train structure.
 */
function normalizeRailRadarTrain(rawTrain, queryFrom = '', queryTo = '') {
  if (!rawTrain || typeof rawTrain !== 'object') return null;

  const trainNo = String(rawTrain.trainNumber || rawTrain.number || rawTrain.train_number || '12952');
  const trainName = rawTrain.trainName || rawTrain.name || rawTrain.train_name || 'Express Special';
  const status = String(rawTrain.status || 'SCHEDULED').toUpperCase();

  return {
    trainNumber: trainNo,
    trainName: trainName,
    source: rawTrain.source || rawTrain.from || queryFrom,
    destination: rawTrain.destination || rawTrain.to || queryTo,
    status: status,
    currentStation: rawTrain.currentStation || rawTrain.current_station || rawTrain.current_station_code || 'Not available',
    nextStation: rawTrain.nextStation || rawTrain.next_station || rawTrain.next_station_code || 'Not available',
    delayMinutes: rawTrain.delayMinutes !== undefined ? parseInt(rawTrain.delayMinutes, 10)
                 : (rawTrain.delay_minutes !== undefined ? parseInt(rawTrain.delay_minutes, 10) : 0),
    scheduledArrival: rawTrain.scheduledArrival || rawTrain.scheduled_arrival || rawTrain.arrTime || 'Not available',
    expectedArrival: rawTrain.expectedArrival || rawTrain.expected_arrival || rawTrain.arrTime || 'Not available',
    scheduledDeparture: rawTrain.scheduledDeparture || rawTrain.scheduled_departure || rawTrain.depTime || 'Not available',
    expectedDeparture: rawTrain.expectedDeparture || rawTrain.expected_departure || rawTrain.depTime || 'Not available',
    latitude: rawTrain.latitude !== undefined && rawTrain.latitude !== null ? parseFloat(rawTrain.latitude) : null,
    longitude: rawTrain.longitude !== undefined && rawTrain.longitude !== null ? parseFloat(rawTrain.longitude) : null,
    distanceTravelledKm: rawTrain.distanceTravelledKm !== undefined && rawTrain.distanceTravelledKm !== null ? parseFloat(rawTrain.distanceTravelledKm) : null,
    lastUpdated: rawTrain.lastUpdated || rawTrain.last_updated || new Date().toISOString()
  };
}

/**
 * Clears the in-memory cache (useful for automated testing)
 */
function clearCache() {
  cache.clear();
  inFlightRequests.clear();
}

module.exports = {
  hasApiKey,
  normalizeRailRadarResponse,
  normalizeRailRadarTrain,
  fetchRailRadarLiveStatus,
  clearCache
};
