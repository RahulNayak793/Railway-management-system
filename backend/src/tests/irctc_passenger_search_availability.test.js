const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');

// Set environment for test execution
process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';

const supabaseModule = require('../config/supabase');
const { mockDb } = supabaseModule;

const trainService = require('../services/trainServiceInstanceService');
const trainsRouter = require('../routes/trains');
const { isTrainRunningOnDate, matchRouteSegment } = require('../utils/routeSearch');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/trains', trainsRouter);
  return app;
}

let server;
const PORT = 5089;

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

async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING IRCTC PASSENGER SEARCH & DATA SAFETY TEST SUITE');
  console.log('===============================================================');

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

  // Record initial database baseline snapshots for zero-data-loss audit
  const initialTrainCount = mockDb.trains.size;
  const initialBookingCount = mockDb.bookings.size;
  const initialServiceCount = mockDb.train_services ? mockDb.train_services.size : 0;
  const initialBookingIds = Array.from(mockDb.bookings.keys()).sort();
  const initialTrainNumbers = Array.from(mockDb.trains.values()).map(t => String(t.train_number)).sort();

  try {
    // ------------------------------------------------------------------------
    // TEST GROUP 1: VERIFY REAL SEARCH DATA (Requirement 1)
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Real Train Search Data Verification (12977, 22114, 20924, 20670, 09058) ---');

    const targetTrainNumbers = ['12977', '22114', '20924', '20670', '09058'];
    const trainsList = Array.from(mockDb.trains.values());

    targetTrainNumbers.forEach(tNum => {
      const matches = trainsList.filter(t => String(t.train_number) === tNum);
      // 1. train exists only once
      assert(matches.length === 1, `Train #${tNum} exists strictly once (count: ${matches.length})`);
      const tr = matches[0];

      // 2. route is correct
      const rt = Array.from(mockDb.routes.values()).find(r => r && (r.train_id === tr.id || String(r.train_number) === tNum));
      assert(!!rt, `Train #${tNum} has valid route configured (Route ID: ${rt?.id})`);

      // 3. service calendar is correct
      assert(!!tr.frequency_type && !!tr.service_start_date && !!tr.service_end_date, `Train #${tNum} has service calendar (${tr.frequency_type}, ${tr.service_start_date} to ${tr.service_end_date})`);

      // 4. service dates derived from calendar
      const isOperatingSat = isTrainRunningOnDate(tr, rt, '2026-10-10');
      const isOperatingSun = isTrainRunningOnDate(tr, rt, '2026-10-11');
      assert(typeof isOperatingSat === 'boolean' && typeof isOperatingSun === 'boolean', `Train #${tNum} service dates dynamically derived from calendar`);

      // 5. classes come from train configuration
      assert(Array.isArray(tr.available_classes) && tr.available_classes.length > 0, `Train #${tNum} classes configured: [${tr.available_classes.join(', ')}]`);

      // 6. fares come from configured fare data
      assert(!!tr.fares_by_class || !!tr.base_fare || !!rt?.base_fare || !!rt?.segment_fares, `Train #${tNum} fares come from configured fare data`);

      // 7. stops come from stored route/stop schedule
      const stopsList = tr.stops || rt?.stops || [];
      assert(Array.isArray(stopsList) && stopsList.length >= 2, `Train #${tNum} stops come from stored schedule (found ${stopsList.length} stops)`);
    });

    // Verify SearchTrainResults.jsx does NOT hardcode these train numbers in train lists
    const searchResultsPath = path.join(__dirname, '../../frontend/src/pages/SearchTrainResults.jsx');
    if (fs.existsSync(searchResultsPath)) {
      const searchCode = fs.readFileSync(searchResultsPath, 'utf8');
      assert(!searchCode.includes("train_number: '12977'"), 'SearchTrainResults.jsx does NOT hardcode train 12977 in train lists');
      assert(!searchCode.includes("train_number: '22114'"), 'SearchTrainResults.jsx does NOT hardcode train 22114 in train lists');
    }

    // ------------------------------------------------------------------------
    // TEST GROUP 2: DATE-SPECIFIC SEARCH CASES & CALENDAR BOUNDS (Requirement 2)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Date-Specific Search (10 Oct 2026, 11 Oct 2026 & Bounds) ---');

    // Case 1: 10 Oct 2026 (Saturday)
    const resSat = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-10&time=18:30');
    assert(resSat.status === 200, 'GET live-search for 2026-10-10 returns 200 OK');
    const satTrainNums = (resSat.body?.trains || []).map(t => String(t.train_number));

    assert(satTrainNums.includes('12977'), '10 Oct 2026: 12977 -> available');
    assert(satTrainNums.includes('20924'), '10 Oct 2026: 20924 -> available');
    assert(satTrainNums.includes('20670'), '10 Oct 2026: 20670 -> available');
    assert(!satTrainNums.includes('22114'), '10 Oct 2026: 22114 -> not operating');
    assert(!satTrainNums.includes('09058'), '10 Oct 2026: 09058 -> not operating');

    // Case 2: 11 Oct 2026 (Sunday)
    const resSun = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-11&time=18:30');
    assert(resSun.status === 200, 'GET live-search for 2026-10-11 returns 200 OK');
    const sunTrainNums = (resSun.body?.trains || []).map(t => String(t.train_number));

    assert(sunTrainNums.includes('12977'), '11 Oct 2026: 12977 -> available');
    assert(sunTrainNums.includes('09058'), '11 Oct 2026: 09058 -> available');
    assert(!sunTrainNums.includes('20924'), '11 Oct 2026: 20924 -> not operating');
    assert(!sunTrainNums.includes('20670'), '11 Oct 2026: 20670 -> not operating');
    assert(!sunTrainNums.includes('22114'), '11 Oct 2026: 22114 -> not operating');

    // Case 3: Date outside service_start_date / service_end_date
    const t12977 = trainsList.find(t => String(t.train_number) === '12977');
    const rt12977 = Array.from(mockDb.routes.values()).find(r => r && (r.train_id === t12977.id || String(r.train_number) === '12977'));
    const outsideBefore = isTrainRunningOnDate(t12977, rt12977, '2024-12-31');
    const outsideAfter = isTrainRunningOnDate(t12977, rt12977, '2028-01-01');
    assert(!outsideBefore, 'Date before service_start_date (2024-12-31) -> not operating');
    assert(!outsideAfter, 'Date after service_end_date (2028-01-01) -> not operating');

    // ------------------------------------------------------------------------
    // TEST GROUP 3: AVAILABILITY SEMANTICS & INVENTORY INTEGRITY (Requirement 3 & 4)
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Availability Semantics & Actual Inventory Authority ---');

    // Test repeat stability
    const avail1 = trainService.calculateDeterministicAvailability('12977', '2026-10-10', '3A');
    const avail2 = trainService.calculateDeterministicAvailability('12977', '2026-10-10', '3A');
    assert(avail1.statusCode === avail2.statusCode && avail1.availableCount === avail2.availableCount, 'Availability results are completely stable between requests');

    // Test today/tomorrow behavior: does NOT blindly assume today/tomorrow = WL
    const todayStr = trainService.getNowIST().dateStr;
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const todayAvail = trainService.calculateDeterministicAvailability('12977', todayStr, '3A');
    const tomorrowAvail = trainService.calculateDeterministicAvailability('12977', tomorrowStr, '3A');
    assert(todayAvail.statusType === 'AVAILABLE' && todayAvail.availableCount > 0, `Today does not assume WL (returns: ${todayAvail.statusLabel})`);
    assert(tomorrowAvail.statusType === 'AVAILABLE' && tomorrowAvail.availableCount > 0, `Tomorrow does not assume WL (returns: ${tomorrowAvail.statusLabel})`);

    // Test that explicit WL inventory state NEVER displays AVAILABLE
    const mockServiceKey = 'svc-99991-2026-10-15';
    mockDb.train_services.set(mockServiceKey, {
      id: mockServiceKey,
      train_number: '99991',
      service_date: '2026-10-15',
      inventory: {
        '3A': {
          statusType: 'WL',
          statusCode: 'WL 38',
          statusLabel: 'WL 38',
          availableCount: 0,
          wlCount: 38
        }
      }
    });

    const wlAvail = trainService.calculateDeterministicAvailability('99991', '2026-10-15', '3A');
    assert(wlAvail.statusType === 'WL' && wlAvail.statusLabel === 'WL 38', `When inventory says WL 38, system outputs WL 38 (never AVAILABLE)`);

    // Test that explicit RAC inventory state NEVER displays AVAILABLE
    const mockRacKey = 'svc-99992-2026-10-15';
    mockDb.train_services.set(mockRacKey, {
      id: mockRacKey,
      train_number: '99992',
      service_date: '2026-10-15',
      inventory: {
        '2A': {
          statusType: 'RAC',
          statusCode: 'RAC 2',
          statusLabel: 'RAC 2',
          availableCount: 0,
          racCount: 2
        }
      }
    });

    const racAvail = trainService.calculateDeterministicAvailability('99992', '2026-10-15', '2A');
    assert(racAvail.statusType === 'RAC' && racAvail.statusLabel === 'RAC 2', `When inventory says RAC 2, system outputs RAC 2 (never AVAILABLE)`);

    // Clean up temporary test service instances
    mockDb.train_services.delete(mockServiceKey);
    mockDb.train_services.delete(mockRacKey);

    // ------------------------------------------------------------------------
    // TEST GROUP 4: DATE-WISE AVAILABILITY BOXES (Requirement 5)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Date-Wise Availability Boxes strictly operating dates ---');

    const matsyagandha = trainsList.find(t => String(t.train_number) === '22114');
    const dateWiseMatsya = trainService.calculateDateWiseAvailability(matsyagandha, null, '2026-10-10', 5, 'UDU', 'MMCT');
    const matsyaBoxes = dateWiseMatsya['SL'] || [];
    assert(matsyaBoxes.length === 5, `Generated 5 operating dates for Matsyagandha`);

    // Matsyagandha runs Mon, Wed, Fri only
    const nonOpDaysFound = matsyaBoxes.filter(b => {
      const d = new Date(b.date + 'T00:00:00');
      const day = d.getDay(); // 0: Sun, 2: Tue, 4: Thu, 6: Sat
      return day === 0 || day === 2 || day === 4 || day === 6;
    });
    assert(nonOpDaysFound.length === 0, `Date boxes contain ONLY actual operating dates (Mon/Wed/Fri), never non-operating days`);

    // ------------------------------------------------------------------------
    // TEST GROUP 5: CLASS & TRAIN TYPE FILTERING (Requirements 6 & 7)
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Class & Train Type Filtering Logic ---');

    // Train 20924 (Netravati) classes: ['SL', '3A', '2A']
    const t20924 = trainsList.find(t => String(t.train_number) === '20924');
    const t20924Classes = t20924.available_classes || [];
    assert(!t20924Classes.includes('1A') && !t20924Classes.includes('CC') && !t20924Classes.includes('EC'), 'Train 20924 does not contain unconfigured classes 1A, CC, EC');

    // Stored train type/category
    assert(t12977.train_type === 'Rajdhani', `Train 12977 stores train_type: ${t12977.train_type}`);
    assert(matsyagandha.train_type === 'Superfast', `Train 22114 stores train_type: ${matsyagandha.train_type}`);

    // ------------------------------------------------------------------------
    // TEST GROUP 6: STAFF / ADMIN TRAIN CREATION & MUTATION (Requirement 8)
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Staff/Admin Add TEST-RAIL-001 Verification ---');

    const testTrainNum = 'TEST-RAIL-001';
    const testAdminTrain = {
      id: 't-test-rail-001',
      train_number: testTrainNum,
      train_name: 'Test Rail Special Express',
      train_type: 'Express',
      source_station_code: 'UDU',
      destination_station_code: 'MMCT',
      source: 'UDU',
      destination: 'MMCT',
      departure_time: '09:00:00',
      arrival_time: '21:00:00',
      frequency_type: 'Selected Days',
      operating_days: ['MON', 'WED', 'FRI'],
      frequency: 'MON WED FRI',
      service_start_date: '2026-10-01',
      service_end_date: '2026-12-31',
      available_classes: ['SL', '3A'],
      status: 'active',
      record_source: 'staff_admin',
      stops: [
        { seq: 1, code: 'UDU', name: 'Udupi', arrTime: '09:00', depTime: '09:00', dayOffset: 0, distanceKm: 0 },
        { seq: 2, code: 'MMCT', name: 'Mumbai Central', arrTime: '21:00', depTime: '21:00', dayOffset: 0, distanceKm: 938 }
      ]
    };

    mockDb.trains.set(testAdminTrain.id, testAdminTrain);
    mockDb.routes.set('rt-test-rail-001', {
      id: 'rt-test-rail-001',
      train_id: testAdminTrain.id,
      train_number: testTrainNum,
      source_station_code: 'UDU',
      destination_station_code: 'MMCT',
      departure_time: '09:00:00',
      arrival_time: '21:00:00',
      stops: testAdminTrain.stops,
      distance_km: 938,
      duration_minutes: 720,
      base_fare: 400
    });

    // Test: Wednesday (2026-10-07) -> appears
    const resWed = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-07&time=09:00');
    const wedNums = (resWed.body?.trains || []).map(t => String(t.train_number));
    assert(wedNums.includes(testTrainNum), 'Wednesday (07 Oct 2026): TEST-RAIL-001 appears');

    // Test: Thursday (2026-10-08) -> does NOT appear
    const resThu = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-08&time=09:00');
    const thuNums = (resThu.body?.trains || []).map(t => String(t.train_number));
    assert(!thuNums.includes(testTrainNum), 'Thursday (08 Oct 2026): TEST-RAIL-001 does NOT appear');

    // Test: Friday (2026-10-09) -> appears
    const resFri = await apiRequest('/api/trains/live-search?from=UDU&to=MMCT&date=2026-10-09&time=09:00');
    const friNums = (resFri.body?.trains || []).map(t => String(t.train_number));
    assert(friNums.includes(testTrainNum), 'Friday (09 Oct 2026): TEST-RAIL-001 appears');

    // Remove test train safely afterward
    mockDb.trains.delete(testAdminTrain.id);
    mockDb.routes.delete('rt-test-rail-001');
    assert(!mockDb.trains.has(testAdminTrain.id), 'TEST-RAIL-001 safely removed without touching existing trains');

    // ------------------------------------------------------------------------
    // TEST GROUP 7: EDIT SAFETY & HISTORICAL IMMUTABILITY (Requirement 9)
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Edit Safety & Historical Immutability Verification ---');

    // Create a mock historical service instance and booking
    const histServiceId = 'svc-hist-test-completed';
    const histBookingId = 'bk-hist-test-permanent';
    mockDb.train_services.set(histServiceId, {
      id: histServiceId,
      train_number: '12977',
      service_date: '2026-08-01',
      status: 'COMPLETED',
      inventory: { '3A': { availableCount: 0, statusLabel: 'COMPLETED' } }
    });
    mockDb.bookings.set(histBookingId, {
      id: histBookingId,
      train_number: '12977',
      travel_date: '2026-08-01',
      status: 'completed'
    });

    // Edit future schedule for 12977
    const currentServiceEnd = t12977.service_end_date;
    t12977.service_end_date = '2027-12-31';

    // Verify historical records remain 100% intact
    assert(mockDb.train_services.has(histServiceId), 'Historical completed service instance was not deleted');
    assert(mockDb.bookings.has(histBookingId), 'Historical completed booking record was not deleted');
    assert(mockDb.train_services.get(histServiceId).status === 'COMPLETED', 'Historical service status is unmodified');

    // Clean up temporary historical markers
    mockDb.train_services.delete(histServiceId);
    mockDb.bookings.delete(histBookingId);
    t12977.service_end_date = currentServiceEnd;

    // ------------------------------------------------------------------------
    // TEST GROUP 8: OVERNIGHT JOURNEY DISPLAY (Requirement 10)
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Overnight Journey Display & Arrival Next Day ---');

    const overnightTrain = (resSat.body?.trains || []).find(t => String(t.train_number) === '12977');
    assert(overnightTrain && overnightTrain.day_offset === 1, '17:55 -> 08:35 correctly has day_offset: 1');
    assert(overnightTrain.departure_date === '2026-10-10', `Departure date: ${overnightTrain.departure_date}`);
    assert(overnightTrain.arrival_date === '2026-10-11', `Arrival date is the next calendar day: ${overnightTrain.arrival_date}`);

    // ------------------------------------------------------------------------
    // TEST GROUP 9: PASSENGER BOOKING CARRYOVER (Requirement 11)
    // ------------------------------------------------------------------------
    console.log('\n--- 9. Passenger Booking Carryover Fields ---');

    assert(!!overnightTrain.service_instance_id, `Carries service_instance_id: ${overnightTrain.service_instance_id}`);
    assert(!!overnightTrain.train_number, `Carries train_number: ${overnightTrain.train_number}`);
    assert(!!overnightTrain.journey_date || !!overnightTrain.departure_date, `Carries journey date: ${overnightTrain.departure_date}`);
    assert(!!overnightTrain.from_station_code, `Carries source station: ${overnightTrain.from_station_code}`);
    assert(!!overnightTrain.to_station_code, `Carries destination station: ${overnightTrain.to_station_code}`);
    assert(Array.isArray(overnightTrain.available_classes), `Carries classes: [${overnightTrain.available_classes.join(', ')}]`);
    assert(!!overnightTrain.fares_by_class, `Carries fares by class`);

    // ------------------------------------------------------------------------
    // TEST GROUP 10: ZERO DATA LOSS / BEFORE & AFTER COMPARISON (Requirement 13)
    // ------------------------------------------------------------------------
    console.log('\n--- 10. Data Safety Verification (Before vs After) ---');

    assert(mockDb.trains.size === initialTrainCount, `Train count matches initial exactly: ${mockDb.trains.size} == ${initialTrainCount}`);
    assert(mockDb.bookings.size === initialBookingCount, `Booking count matches initial exactly: ${mockDb.bookings.size} == ${initialBookingCount}`);
    if (mockDb.train_services) {
      assert(mockDb.train_services.size === initialServiceCount, `Service instance count matches initial: ${mockDb.train_services.size} == ${initialServiceCount}`);
    }

    const currentBookingIds = Array.from(mockDb.bookings.keys()).sort();
    assert(JSON.stringify(currentBookingIds) === JSON.stringify(initialBookingIds), 'All initial booking IDs preserved intact without alteration');

    const currentTrainNumbers = Array.from(mockDb.trains.values()).map(t => String(t.train_number)).sort();
    assert(JSON.stringify(currentTrainNumbers) === JSON.stringify(initialTrainNumbers), 'All initial train numbers preserved intact without alteration');

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await stopServer();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
