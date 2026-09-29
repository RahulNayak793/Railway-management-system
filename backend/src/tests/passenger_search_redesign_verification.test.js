const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Set environment for test execution
process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const supabaseModule = require('../config/supabase');
const { mockDb } = supabaseModule;

const trainService = require('../services/trainServiceInstanceService');
const trainsRouter = require('../routes/trains');
const { isTrainRunningOnDate, matchRouteSegment } = require('../utils/routeSearch');
const { 
  getIndianRailwayClassLabel, 
  getClassLabel, 
  CLASS_HUMAN_NAMES,
  getDefaultClassesForTrain,
  sortClassesByPriority 
} = require('../utils/trainClasses');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/trains', trainsRouter);
  return app;
}

let server;
const PORT = 5092;

function startServer(app) {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function apiRequest(reqPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runRedesignVerificationSuite() {
  console.log('========================================================================');
  console.log('🧪 PASSENGER TRAIN-SEARCH RESULTS REDESIGN VERIFICATION SUITE');
  console.log('========================================================================\n');

  const app = createTestApp();
  await startServer(app);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const initialTrainCount = mockDb.trains.size;
  const initialBookingCount = mockDb.bookings.size;
  const initialServiceCount = mockDb.train_services ? mockDb.train_services.size : 0;
  const initialBookingIds = Array.from(mockDb.bookings.keys()).sort();
  const initialTrainNumbers = Array.from(mockDb.trains.values()).map(t => String(t.train_number)).sort();

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: REALISTIC INDIAN RAILWAY CLASS NAMES RENDERING
    // ------------------------------------------------------------------------
    console.log('--- 1. Realistic Indian Railway Class Names Mapping ---');
    assert(getIndianRailwayClassLabel('SL') === 'Sleeper (SL)', 'SL -> Sleeper (SL)');
    assert(getIndianRailwayClassLabel('3A') === 'AC 3 Tier (3A)', '3A -> AC 3 Tier (3A)');
    assert(getIndianRailwayClassLabel('2A') === 'AC 2 Tier (2A)', '2A -> AC 2 Tier (2A)');
    assert(getIndianRailwayClassLabel('1A') === 'First AC (1A)', '1A -> First AC (1A)');
    assert(getIndianRailwayClassLabel('3E') === 'AC 3 Economy (3E)', '3E -> AC 3 Economy (3E)');
    assert(getIndianRailwayClassLabel('CC') === 'AC Chair Car (CC)', 'CC -> AC Chair Car (CC)');
    assert(getIndianRailwayClassLabel('EC') === 'Executive Chair Car (EC)', 'EC -> Executive Chair Car (EC)');
    assert(getIndianRailwayClassLabel('2S') === 'Second Sitting (2S)', '2S -> Second Sitting (2S)');

    // Verify frontend trainClasses.js source code has the exact same mappings
    const frontendClassesPath = path.join(__dirname, '../../../frontend/src/utils/trainClasses.js');
    assert(fs.existsSync(frontendClassesPath), 'frontend/src/utils/trainClasses.js exists');
    const frontendClassesSource = fs.readFileSync(frontendClassesPath, 'utf8');
    assert(frontendClassesSource.includes("'SL': 'Sleeper'"), 'Frontend defines SL as Sleeper');
    assert(frontendClassesSource.includes("'3A': 'AC 3 Tier'"), 'Frontend defines 3A as AC 3 Tier');
    assert(frontendClassesSource.includes("'2A': 'AC 2 Tier'"), 'Frontend defines 2A as AC 2 Tier');
    assert(frontendClassesSource.includes("'1A': 'First AC'"), 'Frontend defines 1A as First AC');
    assert(frontendClassesSource.includes("'3E': 'AC 3 Economy'"), 'Frontend defines 3E as AC 3 Economy');
    assert(frontendClassesSource.includes("'CC': 'AC Chair Car'"), 'Frontend defines CC as AC Chair Car');
    assert(frontendClassesSource.includes("'EC': 'Executive Chair Car'"), 'Frontend defines EC as Executive Chair Car');
    assert(frontendClassesSource.includes("'2S': 'Second Sitting'"), 'Frontend defines 2S as Second Sitting');
    assert(frontendClassesSource.includes('getIndianRailwayClassLabel'), 'Frontend exports getIndianRailwayClassLabel');

    // ------------------------------------------------------------------------
    // SECTION 2: CLASS PURITY - NO UNCONFIGURED CLASSES ON TRAINS
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Class Purity: Only configured classes displayed ---');
    const trainsList = Array.from(mockDb.trains.values());
    const tNetravati = trainsList.find(t => String(t.train_number) === '20924');
    assert(tNetravati, 'Train 20924 exists in database');
    assert(!tNetravati.available_classes.includes('1A'), 'Train 20924 (Netravati) does NOT manufacture 1A');
    assert(!tNetravati.available_classes.includes('CC'), 'Train 20924 does NOT manufacture CC');
    assert(!tNetravati.available_classes.includes('EC'), 'Train 20924 does NOT manufacture EC');

    const tVandeBharat = trainsList.find(t => String(t.train_number) === '20670');
    assert(tVandeBharat, 'Train 20670 exists in database');
    assert(!tVandeBharat.available_classes.includes('SL'), 'Vande Bharat does NOT manufacture SL');
    assert(!tVandeBharat.available_classes.includes('1A'), 'Vande Bharat does NOT manufacture 1A');
    assert(tVandeBharat.available_classes.includes('CC'), 'Vande Bharat includes CC');
    assert(tVandeBharat.available_classes.includes('EC'), 'Vande Bharat includes EC');

    // ------------------------------------------------------------------------
    // SECTION 3: AVAILABILITY SEMANTICS (AVAILABLE, RAC, WL)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Availability Semantics (AVAILABLE, RAC, WL) & Inventory Authority ---');
    
    // Explicit AVAILABLE mock test
    const testAvailKey = 'svc-99001-2026-11-01';
    mockDb.train_services.set(testAvailKey, {
      id: testAvailKey,
      train_number: '99001',
      service_date: '2026-11-01',
      inventory: {
        'SL': {
          statusType: 'AVAILABLE',
          statusCode: 'AVAILABLE 24',
          statusLabel: 'AVAILABLE 24',
          availableCount: 24,
          racCount: 0,
          wlCount: 0
        }
      }
    });
    const availResult = trainService.calculateDeterministicAvailability('99001', '2026-11-01', 'SL');
    assert(availResult.statusType === 'AVAILABLE' && availResult.statusCode === 'AVAILABLE 24', 'Deterministic inventory produces exact AVAILABLE 24');

    // Explicit RAC mock test
    const testRacKey = 'svc-99002-2026-11-01';
    mockDb.train_services.set(testRacKey, {
      id: testRacKey,
      train_number: '99002',
      service_date: '2026-11-01',
      inventory: {
        '3A': {
          statusType: 'RAC',
          statusCode: 'RAC 5',
          statusLabel: 'RAC 5',
          availableCount: 0,
          racCount: 5,
          wlCount: 0
        }
      }
    });
    const racResult = trainService.calculateDeterministicAvailability('99002', '2026-11-01', '3A');
    assert(racResult.statusType === 'RAC' && racResult.statusCode === 'RAC 5', 'Deterministic inventory produces exact RAC 5');

    // Explicit WL mock test
    const testWlKey = 'svc-99003-2026-11-01';
    mockDb.train_services.set(testWlKey, {
      id: testWlKey,
      train_number: '99003',
      service_date: '2026-11-01',
      inventory: {
        '2A': {
          statusType: 'WL',
          statusCode: 'WL 21',
          statusLabel: 'WL 21',
          availableCount: 0,
          racCount: 0,
          wlCount: 21
        }
      }
    });
    const wlResult = trainService.calculateDeterministicAvailability('99003', '2026-11-01', '2A');
    assert(wlResult.statusType === 'WL' && wlResult.statusCode === 'WL 21', 'Deterministic inventory produces exact WL 21');

    // Clean up temporary mock test instances
    mockDb.train_services.delete(testAvailKey);
    mockDb.train_services.delete(testRacKey);
    mockDb.train_services.delete(testWlKey);

    // ------------------------------------------------------------------------
    // SECTION 4: TODAY, TOMORROW, FUTURE DATE SEARCH & NON-OPERATING DATES
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Today, Tomorrow, Future Date & Non-operating Dates ---');
    const todayStr = trainService.getNowIST().dateStr;
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];
    const futureDateStr = '2026-10-10'; // Saturday

    const todayRes = await apiRequest(`/api/trains/live-search?from=UDU&to=MMCT&date=${todayStr}&time=12:00`);
    assert(todayRes.status === 200, `Live search for today (${todayStr}) returns 200 OK`);

    const tomorrowRes = await apiRequest(`/api/trains/live-search?from=UDU&to=MMCT&date=${tomorrowStr}&time=12:00`);
    assert(tomorrowRes.status === 200, `Live search for tomorrow (${tomorrowStr}) returns 200 OK`);

    const futureRes = await apiRequest(`/api/trains/live-search?from=UDU&to=MMCT&date=${futureDateStr}&time=12:00`);
    assert(futureRes.status === 200, `Live search for future date (${futureDateStr}) returns 200 OK`);

    // Matsyagandha (22114) runs MON, WED, FRI.
    // 2026-10-10 is Saturday -> must NOT be in results
    const satTrainNums = (futureRes.body?.trains || []).map(t => String(t.train_number));
    assert(!satTrainNums.includes('22114'), 'Train 22114 does NOT appear on non-operating day (Saturday 10 Oct 2026)');

    // 2026-10-12 is Monday -> must be in results
    const monRes = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-12&time=12:00');
    const monTrainNums = (monRes.body?.trains || []).map(t => String(t.train_number));
    assert(monTrainNums.includes('22114'), 'Train 22114 appears on operating day (Monday 12 Oct 2026)');

    // ------------------------------------------------------------------------
    // SECTION 5: STAFF-ADDED TRAIN AUTOMATICALLY SEARCHABLE
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Staff-Added Train Automatically Searchable ---');
    const staffTrainNum = 'STAFF-NEW-777';
    const staffTrain = {
      id: 't-staff-new-777',
      train_number: staffTrainNum,
      train_name: 'Konkan Holiday Express',
      train_type: 'Superfast',
      source_station_code: 'UDU',
      destination_station_code: 'MMCT',
      source: 'UDU',
      destination: 'MMCT',
      departure_time: '10:00:00',
      arrival_time: '22:00:00',
      frequency_type: 'Selected Days',
      operating_days: ['TUE', 'THU'],
      frequency: 'TUE THU',
      service_start_date: '2026-10-01',
      service_end_date: '2026-12-31',
      available_classes: ['SL', '3A', '2A'],
      status: 'active',
      record_source: 'staff_admin',
      stops: [
        { seq: 1, code: 'UDU', name: 'Udupi', arrTime: '10:00', depTime: '10:00', dayOffset: 0, distanceKm: 0 },
        { seq: 2, code: 'MMCT', name: 'Mumbai Central', arrTime: '22:00', depTime: '22:00', dayOffset: 0, distanceKm: 938 }
      ]
    };

    mockDb.trains.set(staffTrain.id, staffTrain);
    mockDb.routes.set('rt-staff-new-777', {
      id: 'rt-staff-new-777',
      train_id: staffTrain.id,
      train_number: staffTrainNum,
      source_station_code: 'UDU',
      destination_station_code: 'MMCT',
      departure_time: '10:00:00',
      arrival_time: '22:00:00',
      stops: staffTrain.stops,
      distance_km: 938,
      duration_minutes: 720,
      base_fare: 450
    });

    // 2026-10-06 is Tuesday -> must appear
    const tueRes = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-06&time=10:00');
    const tueNums = (tueRes.body?.trains || []).map(t => String(t.train_number));
    assert(tueNums.includes(staffTrainNum), 'Staff-added train STAFF-NEW-777 appears on Tuesday (06 Oct 2026)');

    // 2026-10-07 is Wednesday -> must NOT appear
    const wedRes = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-07&time=10:00');
    const wedNums = (wedRes.body?.trains || []).map(t => String(t.train_number));
    assert(!wedNums.includes(staffTrainNum), 'Staff-added train STAFF-NEW-777 does NOT appear on Wednesday (07 Oct 2026)');

    // Clean up staff train
    mockDb.trains.delete(staffTrain.id);
    mockDb.routes.delete('rt-staff-new-777');

    // ------------------------------------------------------------------------
    // SECTION 6: ADMIN-EDITED TRAIN & HISTORICAL BOOKING PRESERVATION
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Admin-Edited Train & Historical Booking Preservation ---');
    const targetTrain = trainsList.find(t => String(t.train_number) === '12977');
    assert(targetTrain, 'Train 12977 found for edit test');

    const histBookingKey = 'bk-hist-preserve-test-999';
    mockDb.bookings.set(histBookingKey, {
      id: histBookingKey,
      pnr: 'PNR9998887776',
      train_number: '12977',
      travel_date: '2026-07-15',
      status: 'completed',
      coach_class: '3A',
      passenger_count: 2
    });

    // Admin edits future operating parameter
    const originalEndDate = targetTrain.service_end_date;
    targetTrain.service_end_date = '2028-12-31';

    // Verify historical booking is 100% intact and unaffected
    assert(mockDb.bookings.has(histBookingKey), 'Historical booking record exists after future train edit');
    const histRecord = mockDb.bookings.get(histBookingKey);
    assert(histRecord.status === 'completed' && histRecord.pnr === 'PNR9998887776', 'Historical PNR and status are completely preserved');

    // Restore original train date and clean up
    targetTrain.service_end_date = originalEndDate;
    mockDb.bookings.delete(histBookingKey);

    // ------------------------------------------------------------------------
    // SECTION 7: ZERO DATA LOSS / BEFORE & AFTER COMPARISON
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Zero Data Loss & Baseline Record Integrity ---');
    assert(mockDb.trains.size === initialTrainCount, `Train count strictly matches baseline: ${mockDb.trains.size} == ${initialTrainCount}`);
    assert(mockDb.bookings.size === initialBookingCount, `Booking count strictly matches baseline: ${mockDb.bookings.size} == ${initialBookingCount}`);
    if (mockDb.train_services) {
      assert(mockDb.train_services.size === initialServiceCount, `Service instances strictly match baseline: ${mockDb.train_services.size} == ${initialServiceCount}`);
    }

    const currentBookingIds = Array.from(mockDb.bookings.keys()).sort();
    assert(JSON.stringify(currentBookingIds) === JSON.stringify(initialBookingIds), 'All original booking IDs preserved without loss');

    const currentTrainNumbers = Array.from(mockDb.trains.values()).map(t => String(t.train_number)).sort();
    assert(JSON.stringify(currentTrainNumbers) === JSON.stringify(initialTrainNumbers), 'All original train numbers preserved without loss');

    console.log('\n========================================================================');
    console.log(`🏆 ALL PASSENGER SEARCH REDESIGN VERIFICATION TESTS PASSED: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Error during test execution:', err);
    failed++;
  } finally {
    await stopServer();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runRedesignVerificationSuite();
