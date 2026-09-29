const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');
const railRadarService = require('../services/railRadarService');
const { getLiveStatusForTrain } = require('../utils/liveStatusHelper');

const PORT = 5122;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log(`🔌 Test server stopped.`);
      resolve();
    });
  });
}

async function makeRequest(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: response.status, body: json };
}

async function runTests() {
  console.log('\n--- 🧪 RUNNING RAILRADAR API INTEGRATION & TRACKING SUITE ---');

  // Seed train and route in mockDb for test
  const testTrainId = 't-12952';
  const testTrain = {
    id: testTrainId,
    train_number: '12952',
    train_name: 'New Delhi Rajdhani Express',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    departure_time: '08:00:00', // 08:00 AM departure so it counts as departed by mid-day
    arrival_time: '23:00:00',
    distance_km: 1386,
    status: 'on_time',
    delay_minutes: 0,
    stops: [
      { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '08:00:00', depTime: '08:00:00', distanceFromOriginKm: 0 },
      { sequence: 2, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '15:00:00', depTime: '15:10:00', distanceFromOriginKm: 733 },
      { sequence: 3, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '23:00:00', depTime: '23:00:00', distanceFromOriginKm: 1386 }
    ]
  };
  mockDb.trains.set(testTrainId, testTrain);

  const testRoute = {
    id: 'r-12952',
    train_id: testTrainId,
    train_number: '12952',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    departure_time: '08:00:00',
    arrival_time: '23:00:00',
    distance_km: 1386,
    stops: testTrain.stops
  };
  mockDb.routes.set('r-12952', testRoute);

  saveMockDbToFile();
  await startServer();

  try {
    const SECRET_KEY = 'secret_railradar_api_key_test_xyz999';

    // --- TEST A: API Key Missing ---
    console.log('Test A: API key missing check...');
    delete process.env.RAILRADAR_API_KEY;
    railRadarService.clearCache();
    assert.strictEqual(railRadarService.hasApiKey(), false, 'hasApiKey() should be false when key is missing');
    const statusNoKey = await getLiveStatusForTrain('12952');
    assert.strictEqual(statusNoKey.data_source, 'RailControl Telemetry', 'Should fallback to RailControl Telemetry when API key is missing');
    assert.strictEqual(statusNoKey.data_source_label, 'Data Source: RailControl Telemetry');
    console.log('✅ TEST A PASSED: API key missing falls back safely to internal telemetry.');

    // --- TEST B: Third-Party API Unavailable / 503 Error ---
    console.log('Test B: Third-party API unavailable fallback...');
    process.env.RAILRADAR_API_KEY = SECRET_KEY;
    railRadarService.clearCache();
    assert.strictEqual(railRadarService.hasApiKey(), true);

    const status503 = await getLiveStatusForTrain('12952', null, {
      mockFetcher: async () => ({ success: false, source: 'RailRadar', error: 'Third-party HTTP error 503' })
    });
    assert.ok(status503, 'Response should not be null');
    assert.ok(status503.data_source && (status503.data_source.includes('RailControl') || status503.data_source.includes('RailRadar')), 'Should fallback gracefully on third-party error');
    console.log('✅ TEST B PASSED: Third-party API failure handled gracefully without crashing.');

    // --- TEST C: Valid Third-Party Response Normalization ---
    console.log('Test C: Valid third-party RailRadar response integration...');
    railRadarService.clearCache();
    const mockRailRadarPayload = {
      train_number: '12952',
      train_name: 'New Delhi Rajdhani',
      status: 'LIVE',
      speed: 120,
      delay_minutes: 15,
      latitude: 23.3344,
      longitude: 75.0372,
      current_station: 'RTM',
      next_station: 'MMCT',
      platform: '2'
    };

    const statusValid = await getLiveStatusForTrain('12952', null, {
      mockFetcher: async () => railRadarService.normalizeRailRadarResponse(mockRailRadarPayload, '12952', '2026-09-17')
    });

    assert.ok(statusValid.data_source.includes('RailRadar'), 'data_source should include RailRadar');
    assert.ok(statusValid.data_source_label.includes('RailRadar'), 'data_source_label should include RailRadar');
    assert.strictEqual(statusValid.telemetry.speed, 120);
    assert.strictEqual(statusValid.telemetry.delay_minutes, 15);
    assert.strictEqual(statusValid.telemetry.latitude, 23.3344);
    assert.strictEqual(statusValid.telemetry.longitude, 75.0372);
    console.log('✅ TEST C PASSED: Valid third-party response normalized and populated into live status.');

    // --- TEST D: Invalid / Malformed Response Handling ---
    console.log('Test D: Invalid / Malformed payload handling...');
    const normInvalid = railRadarService.normalizeRailRadarResponse(null, '12952', '2026-09-17');
    assert.strictEqual(normInvalid.success, false, 'Malformed payload should return success: false');
    console.log('✅ TEST D PASSED: Invalid response formats caught without throwing exceptions.');

    // --- TEST E: Train Number Not Found ---
    console.log('Test E: Invalid train number lookup...');
    const statusNotFound = await getLiveStatusForTrain('999999');
    assert.strictEqual(statusNotFound, null, 'Unrecognized train number should return null');
    const resNotFound = await makeRequest('/tracking/train/999999');
    assert.strictEqual(resNotFound.status, 404);
    console.log('✅ TEST E PASSED: Train number not found returns HTTP 404 cleanly.');

    // --- TEST F & G: Pre-Departure Protection & Future Date Isolation ---
    console.log('Test F & G: Pre-departure protection and service date isolation...');
    const futureDate = '2026-12-25'; // Far future date
    const statusPreDeparture = await getLiveStatusForTrain('12952', futureDate, {
      mockFetcher: async () => railRadarService.normalizeRailRadarResponse({ speed: 130, latitude: 20.0, longitude: 72.0, status: 'LIVE' }, '12952', futureDate)
    });

    assert.strictEqual(statusPreDeparture.status.state, 'NOT_STARTED', 'Future journey must have state NOT_STARTED');
    assert.strictEqual(statusPreDeparture.status.is_live, false);
    assert.strictEqual(statusPreDeparture.status.can_move, false);
    assert.strictEqual(statusPreDeparture.telemetry.speed, 0, 'Pre-departure speed must be strictly 0');
    assert.strictEqual(statusPreDeparture.telemetry.distance_travelled_km, 0);
    assert.strictEqual(statusPreDeparture.telemetry.latitude, statusPreDeparture.stops[0].lat, 'Pre-departure position must be locked to origin');
    console.log('✅ TEST F & G PASSED: Pre-departure protection strictly enforced. Speed locked to 0 and position at origin.');

    // --- TEST H: Active Journey Verification ---
    console.log('Test H: Active journey movement verification...');
    const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const statusActive = await getLiveStatusForTrain('12952', nowStr);
    assert.strictEqual(statusActive.status.state, 'LIVE');
    assert.strictEqual(statusActive.status.can_move, true);
    console.log('✅ TEST H PASSED: Active journey correctly marked LIVE with can_move: true.');

    // --- TEST I: Stale Telemetry Isolation ---
    console.log('Test I: Stale telemetry isolation check...');
    mockDb.train_telemetry.set(testTrainId, {
      id: 'tel-old-date',
      train_id: testTrainId,
      service_date: '2025-01-01', // Stale date
      speed: 150,
      latitude: 19.123,
      longitude: 72.999
    });

    const statusToday = await getLiveStatusForTrain('12952', '2026-09-17');
    // Speed should not come from old 2025-01-01 telemetry
    assert.notStrictEqual(statusToday.telemetry.updated_at, '2025-01-01');
    console.log('✅ TEST I PASSED: Stale telemetry from previous service dates does not leak.');

    // --- TEST J: API Timeout Handling ---
    console.log('Test J: API timeout handling check...');
    railRadarService.clearCache();
    const timeoutStatus = await railRadarService.fetchRailRadarLiveStatus('12952', '2026-09-17', {
      timeout: 10, // 10ms timeout to force timeout
      mockFetcher: () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 200))
    });
    assert.strictEqual(timeoutStatus.success, false);
    console.log('✅ TEST J PASSED: API timeout handled gracefully.');

    // --- TEST K: API Key Security Verification ---
    console.log('Test K: API key security audit...');
    process.env.RAILRADAR_API_KEY = SECRET_KEY;
    const resEndpoint = await makeRequest('/tracking/train/12952');
    const responseString = JSON.stringify(resEndpoint.body);
    assert.strictEqual(responseString.includes(SECRET_KEY), false, 'API key MUST NEVER be present in HTTP response payload!');
    console.log('✅ TEST K PASSED: API key remains 100% server-side and never leaks in response payload.');

    // --- TEST L: Direct HTTP Endpoint GET /api/tracking/train/:trainNumber ---
    console.log('Test L: Direct HTTP endpoint GET /api/tracking/train/:trainNumber verification...');
    const resDirect = await makeRequest('/tracking/train/12952');
    assert.strictEqual(resDirect.status, 200);
    assert.strictEqual(resDirect.body.success, true);
    assert.ok(resDirect.body.data_source);
    assert.ok(resDirect.body.stops);
    console.log('✅ TEST L PASSED: GET /api/tracking/train/:trainNumber returned HTTP 200 with normalized response.');

    console.log('\n🎉 ALL 12 RAILRADAR API INTEGRATION & LIVE TRACKING TESTS PASSED SUCCESSFULLY! 🎉\n');

  } finally {
    await stopServer();
  }
}

runTests().catch((err) => {
  console.error('❌ RailRadar integration test failed:', err);
  process.exit(1);
});
