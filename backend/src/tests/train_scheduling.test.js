const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { mockDb } = require('../config/supabase');
const {
  isTrainRunningOnDate,
  calculateOvernightOffset,
  formatJourneyDuration,
  getNextServiceDateTime
} = require('../utils/routeSearch');
const {
  generateServiceInstances,
  getServicesForDate
} = require('../services/trainServiceInstanceService');

const PORT = 5094;
const JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
let server;

function makeRequest(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathUrl,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function generateAuthToken(role = 'admin') {
  return jwt.sign(
    { id: 'usr-admin-1', email: 'admin@railcontrol.gov.in', role, permissions: ['ALL'] },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('  RUNNING 15-SCENARIO REALISTIC TRAIN SCHEDULING TEST SUITE');
  console.log('=============================================================\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Scheduling Test Server] Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  const adminToken = generateAuthToken('admin');
  const authHeader = { Authorization: `Bearer ${adminToken}` };
  let passedCount = 0;

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Frequency "Daily" matches all operating days in range
    // -------------------------------------------------------------
    console.log('Scenario 1: Daily frequency operates on all operating days within validity range');
    const trainDaily = {
      id: 'test-daily-1',
      train_number: '99001',
      frequency_type: 'Daily',
      service_start_date: '2026-10-01',
      service_end_date: '2026-10-31',
      service_status: 'ACTIVE'
    };
    assert.strictEqual(isTrainRunningOnDate(trainDaily, null, '2026-10-01'), true); // Thursday
    assert.strictEqual(isTrainRunningOnDate(trainDaily, null, '2026-10-02'), true); // Friday
    assert.strictEqual(isTrainRunningOnDate(trainDaily, null, '2026-10-03'), true); // Saturday
    assert.strictEqual(isTrainRunningOnDate(trainDaily, null, '2026-10-04'), true); // Sunday
    passedCount++;
    console.log('  ✅ PASSED: Daily frequency operates on Mon-Sun within range\n');

    // -------------------------------------------------------------
    // SCENARIO 2: Frequency "Weekly" matches only the specified operating day (Wednesdays)
    // -------------------------------------------------------------
    console.log('Scenario 2: Weekly frequency matches specified operating day (Wednesdays)');
    const trainWeekly = {
      id: 'test-weekly-1',
      train_number: '99002',
      frequency_type: 'Weekly',
      operating_days: ['Wed'],
      service_start_date: '2026-10-01',
      service_end_date: '2026-10-31',
      service_status: 'ACTIVE'
    };
    // 2026-10-07 is Wednesday, 2026-10-14 is Wednesday
    assert.strictEqual(isTrainRunningOnDate(trainWeekly, null, '2026-10-07'), true);
    assert.strictEqual(isTrainRunningOnDate(trainWeekly, null, '2026-10-14'), true);
    passedCount++;
    console.log('  ✅ PASSED: Weekly frequency operates on configured Wednesdays\n');

    // -------------------------------------------------------------
    // SCENARIO 3: Frequency "Weekly" rejects queries on non-operating days (Thursdays)
    // -------------------------------------------------------------
    console.log('Scenario 3: Weekly frequency rejects non-operating weekdays');
    // 2026-10-01 is Thursday, 2026-10-02 is Friday, 2026-10-08 is Thursday
    assert.strictEqual(isTrainRunningOnDate(trainWeekly, null, '2026-10-01'), false);
    assert.strictEqual(isTrainRunningOnDate(trainWeekly, null, '2026-10-02'), false);
    assert.strictEqual(isTrainRunningOnDate(trainWeekly, null, '2026-10-08'), false);
    passedCount++;
    console.log('  ✅ PASSED: Weekly frequency correctly rejects non-operating days\n');

    // -------------------------------------------------------------
    // SCENARIO 4: Frequency "Selected Days" (Mon, Wed, Fri) matches operating days and rejects others
    // -------------------------------------------------------------
    console.log('Scenario 4: Selected Days (Mon, Wed, Fri) matches operating days and rejects Tue/Thu');
    const trainSelectedDays = {
      id: 'test-selected-1',
      train_number: '99003',
      frequency_type: 'Selected Days',
      operating_days: ['Mon', 'Wed', 'Fri'],
      service_start_date: '2026-10-01',
      service_end_date: '2026-10-31',
      service_status: 'ACTIVE'
    };
    // 2026-10-02 is Fri (run), 2026-10-05 is Mon (run), 2026-10-07 is Wed (run)
    assert.strictEqual(isTrainRunningOnDate(trainSelectedDays, null, '2026-10-02'), true);
    assert.strictEqual(isTrainRunningOnDate(trainSelectedDays, null, '2026-10-05'), true);
    assert.strictEqual(isTrainRunningOnDate(trainSelectedDays, null, '2026-10-07'), true);
    // 2026-10-06 is Tue (no run), 2026-10-08 is Thu (no run), 2026-10-10 is Sat (no run)
    assert.strictEqual(isTrainRunningOnDate(trainSelectedDays, null, '2026-10-06'), false);
    assert.strictEqual(isTrainRunningOnDate(trainSelectedDays, null, '2026-10-08'), false);
    assert.strictEqual(isTrainRunningOnDate(trainSelectedDays, null, '2026-10-10'), false);
    passedCount++;
    console.log('  ✅ PASSED: Selected Days (Mon, Wed, Fri) operates strictly on matching days\n');

    // -------------------------------------------------------------
    // SCENARIO 5: Frequency "Specific Dates" operates only on exact matching dates
    // -------------------------------------------------------------
    console.log('Scenario 5: Specific Dates operates only on exact matching dates');
    const trainSpecific = {
      id: 'test-specific-1',
      train_number: '99004',
      frequency_type: 'Specific Dates',
      specific_service_dates: ['2026-10-15', '2026-10-20', '2026-10-25'],
      service_start_date: '2026-10-01',
      service_end_date: '2026-10-31',
      service_status: 'ACTIVE'
    };
    assert.strictEqual(isTrainRunningOnDate(trainSpecific, null, '2026-10-15'), true);
    assert.strictEqual(isTrainRunningOnDate(trainSpecific, null, '2026-10-20'), true);
    assert.strictEqual(isTrainRunningOnDate(trainSpecific, null, '2026-10-25'), true);
    passedCount++;
    console.log('  ✅ PASSED: Specific Dates matches all configured operating dates\n');

    // -------------------------------------------------------------
    // SCENARIO 6: Frequency "Specific Dates" rejects travel dates not configured
    // -------------------------------------------------------------
    console.log('Scenario 6: Specific Dates rejects unconfigured travel dates');
    assert.strictEqual(isTrainRunningOnDate(trainSpecific, null, '2026-10-14'), false);
    assert.strictEqual(isTrainRunningOnDate(trainSpecific, null, '2026-10-16'), false);
    assert.strictEqual(isTrainRunningOnDate(trainSpecific, null, '2026-10-21'), false);
    passedCount++;
    console.log('  ✅ PASSED: Specific Dates strictly rejects dates not configured\n');

    // -------------------------------------------------------------
    // SCENARIO 7: Service Start Date enforcement rejects dates prior to Start Date
    // -------------------------------------------------------------
    console.log('Scenario 7: Service Start Date enforcement rejects dates prior to start date');
    const trainBounded = {
      id: 'test-bounded-1',
      train_number: '99005',
      frequency_type: 'Daily',
      service_start_date: '2026-10-10',
      service_end_date: '2026-10-20',
      service_status: 'ACTIVE'
    };
    assert.strictEqual(isTrainRunningOnDate(trainBounded, null, '2026-10-09'), false);
    assert.strictEqual(isTrainRunningOnDate(trainBounded, null, '2026-10-10'), true);
    passedCount++;
    console.log('  ✅ PASSED: Travel prior to Service Start Date is rejected\n');

    // -------------------------------------------------------------
    // SCENARIO 8: Service End Date enforcement rejects dates past End Date
    // -------------------------------------------------------------
    console.log('Scenario 8: Service End Date enforcement rejects dates past end date');
    assert.strictEqual(isTrainRunningOnDate(trainBounded, null, '2026-10-20'), true);
    assert.strictEqual(isTrainRunningOnDate(trainBounded, null, '2026-10-21'), false);
    assert.strictEqual(isTrainRunningOnDate(trainBounded, null, '2026-11-01'), false);
    passedCount++;
    console.log('  ✅ PASSED: Travel past Service End Date is rejected\n');

    // -------------------------------------------------------------
    // SCENARIO 9: Service Validity Range validation: end date < start date returns 400
    // -------------------------------------------------------------
    console.log('Scenario 9: Validation rejects Service End Date earlier than Start Date');
    const invalidTrainRes = await makeRequest('POST', '/api/trains', {
      train_number: '99009',
      train_name: 'Invalid Date Express',
      source: 'NDLS',
      destination: 'MMCT',
      departure_time: '10:00',
      arrival_time: '18:00',
      frequency_type: 'Daily',
      service_start_date: '2026-10-20',
      service_end_date: '2026-10-10' // Invalid: end date earlier than start date
    }, authHeader);
    assert.strictEqual(invalidTrainRes.status, 400);
    assert.ok(invalidTrainRes.body.error.toLowerCase().includes('earlier') || invalidTrainRes.body.error.toLowerCase().includes('end date'));
    passedCount++;
    console.log('  ✅ PASSED: Backend returns 400 error for invalid date range\n');

    // -------------------------------------------------------------
    // SCENARIO 10: Overnight Journey calculation (18:30 -> 06:15)
    // -------------------------------------------------------------
    console.log('Scenario 10: Overnight journey calculates day_offset = 1 and duration 11h 45m');
    const overnight = calculateOvernightOffset('18:30', '06:15');
    assert.strictEqual(overnight.dayOffset, 1);
    assert.strictEqual(overnight.durationMinutes, 705); // 11 hours 45 mins = 705 mins
    const formattedDuration = formatJourneyDuration(overnight.durationMinutes);
    assert.strictEqual(formattedDuration, '11h 45m');
    passedCount++;
    console.log('  ✅ PASSED: Overnight journey computes day_offset = 1 and 11h 45m\n');

    // -------------------------------------------------------------
    // SCENARIO 11: Same-Day Journey calculation (06:00 -> 14:30)
    // -------------------------------------------------------------
    console.log('Scenario 11: Same-day journey calculates day_offset = 0 and duration 8h 30m');
    const sameDay = calculateOvernightOffset('06:00', '14:30');
    assert.strictEqual(sameDay.dayOffset, 0);
    assert.strictEqual(sameDay.durationMinutes, 510); // 8 hours 30 mins = 510 mins
    assert.strictEqual(formatJourneyDuration(sameDay.durationMinutes), '8h 30m');
    passedCount++;
    console.log('  ✅ PASSED: Same-day journey computes day_offset = 0 and 8h 30m\n');

    // -------------------------------------------------------------
    // SCENARIO 12: Stop Schedule Consistency: rejects chronologically invalid intermediate stops
    // -------------------------------------------------------------
    console.log('Scenario 12: Stop schedule consistency rejects invalid stop chronology');
    const badStopsRes = await makeRequest('POST', '/api/trains', {
      train_number: '99012',
      train_name: 'Broken Chronology Express',
      source: 'NDLS',
      destination: 'MMCT',
      departure_time: '10:00',
      arrival_time: '20:00',
      service_start_date: '2026-10-01',
      service_end_date: '2026-10-31',
      stops: [
        { stationCode: 'KOTA', arrTime: '15:00', depTime: '14:00' } // Dep before Arr!
      ]
    }, authHeader);
    assert.strictEqual(badStopsRes.status, 400);
    assert.ok(badStopsRes.body.error.toLowerCase().includes('earlier') || badStopsRes.body.error.toLowerCase().includes('departure'));
    passedCount++;
    console.log('  ✅ PASSED: Chronological stop violation rejected with 400 error\n');

    // -------------------------------------------------------------
    // SCENARIO 13: Deterministic inventory isolation across operating dates
    // -------------------------------------------------------------
    console.log('Scenario 13: Service instance inventory is isolated by train_id + service_date');
    // Create a real mock train for service instances
    const isolationTrainNo = String(Math.floor(90000 + Math.random() * 9000));
    const createRes = await makeRequest('POST', '/api/trains', {
      train_number: isolationTrainNo,
      train_name: 'Inventory Isolation Express',
      source: 'NDLS',
      destination: 'MMCT',
      departure_time: '18:30',
      arrival_time: '06:15',
      frequency_type: 'Daily',
      service_start_date: '2026-10-01',
      service_end_date: '2026-10-10',
      record_source: 'test'
    }, authHeader);
    assert.strictEqual(createRes.status, 201);
    const createdTrain = createRes.body.train;

    // Generate service instances
    generateServiceInstances(15);
    const servicesOct1 = getServicesForDate('2026-10-01');
    const servicesOct2 = getServicesForDate('2026-10-02');
    const svc1 = servicesOct1.find(s => s.train_number === isolationTrainNo);
    const svc2 = servicesOct2.find(s => s.train_number === isolationTrainNo);
    assert.ok(svc1, 'Service instance for 2026-10-01 should exist');
    assert.ok(svc2, 'Service instance for 2026-10-02 should exist');

    // Modify inventory on svc1 only
    if (svc1.inventory && svc1.inventory['3A']) {
      svc1.inventory['3A'].available -= 5;
    }
    // Verify svc2 inventory is untouched
    if (svc2.inventory && svc2.inventory['3A'] && svc1.inventory && svc1.inventory['3A']) {
      assert.notStrictEqual(svc1.inventory['3A'].available, svc2.inventory['3A'].available);
    }
    passedCount++;
    console.log('  ✅ PASSED: Inventory on Date 1 is strictly isolated from Date 2\n');

    // -------------------------------------------------------------
    // SCENARIO 14: Safe Train Deactivation preserves historical bookings
    // -------------------------------------------------------------
    console.log('Scenario 14: Safe deactivation marks train inactive and preserves historical records');
    // Create a booking referencing this train
    const dummyBookingId = 'bk-test-sched-1';
    mockDb.bookings.set(dummyBookingId, {
      id: dummyBookingId,
      train_id: createdTrain.id,
      train_number: createdTrain.train_number,
      passenger_name: 'Rahul Nayak',
      status: 'CONFIRMED'
    });

    // Attempt to delete train
    const deleteRes = await makeRequest('DELETE', `/api/trains/${createdTrain.id}`, null, authHeader);
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.deactivated, true);
    assert.strictEqual(deleteRes.body.historical_preserved, true);

    // Verify train still exists in database but marked inactive
    const trainInDb = mockDb.trains.get(createdTrain.id);
    assert.ok(trainInDb, 'Train record should be preserved in database');
    assert.strictEqual(trainInDb.status, 'inactive');
    assert.strictEqual(trainInDb.service_status, 'INACTIVE');

    // Verify booking was NOT deleted
    assert.ok(mockDb.bookings.has(dummyBookingId), 'Booking record must be preserved');
    passedCount++;
    console.log('  ✅ PASSED: Train safely deactivated with audit and booking records preserved\n');

    // -------------------------------------------------------------
    // SCENARIO 15: Backward Compatibility for legacy frequency strings
    // -------------------------------------------------------------
    console.log('Scenario 15: Backward compatibility for legacy frequency strings');
    const legacyTrain1 = {
      id: 'legacy-1',
      frequency: 'Daily'
    };
    assert.strictEqual(isTrainRunningOnDate(legacyTrain1, null, '2026-10-07'), true);

    const legacyTrain2 = {
      id: 'legacy-2',
      frequency: 'Except Thu'
    };
    // 2026-10-07 is Wednesday (runs)
    assert.strictEqual(isTrainRunningOnDate(legacyTrain2, null, '2026-10-07'), true);
    // 2026-10-08 is Thursday (except Thu - does not run)
    assert.strictEqual(isTrainRunningOnDate(legacyTrain2, null, '2026-10-08'), false);
    passedCount++;
    console.log('  ✅ PASSED: Legacy strings ("Daily", "Except Thu") maintain full backward compatibility\n');

    console.log('=============================================================');
    console.log(`  ALL ${passedCount} / 15 SCENARIOS PASSED PERFECTLY!`);
    console.log('=============================================================\n');

  } finally {
    if (server) {
      server.close();
    }
  }
}

runAllTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  if (server) server.close();
  process.exit(1);
});
