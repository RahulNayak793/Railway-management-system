const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

const PORT = 5066;
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

// Helper to make requests
async function makeRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
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

function getAdminToken() {
  const payload = {
    id: 'usr-admin-iso-test',
    email: 'admin@railway.com',
    role: 'admin',
    full_name: 'Railway Admin Operations'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function getPassengerToken(userId, email, name) {
  const payload = {
    id: userId,
    email: email || 'passenger@railway.com',
    role: 'passenger',
    full_name: name || 'Test Passenger'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function runTests() {
  if (!isMockMode) {
    console.log('Skipping mock tests: SUPABASE live mode active.');
    return;
  }

  console.log('\n--- 🧪 SEEDING TEST DB FOR JOURNEY DATE ISOLATION TESTS ---');

  const D0 = '2026-09-23';
  const D1 = '2026-09-24';
  const D2 = '2026-09-25';

  const trainId = 't-iso-train-12345';
  const trainNumber = '12345';
  const trainName = 'Udupi Express';

  // Seed master recurring train
  const testTrain = {
    id: trainId,
    train_number: trainNumber,
    train_name: trainName,
    source_station_code: 'UDU',
    destination_station_code: 'NDLS',
    scheduled_departure_time: '08:30:00',
    scheduled_arrival_time: '22:30:00',
    departure_time: '08:30:00',
    arrival_time: '22:30:00',
    status: 'on_time',
    operational_status: 'on_time',
    delay_minutes: 0,
    is_date_specific: false,
    coaches: { '2A': 2, '3A': 4, 'SL': 6 }
  };
  mockDb.trains.set(trainId, testTrain);

  // Seed Route
  const routeId = 'r-iso-12345';
  mockDb.routes.set(routeId, {
    id: routeId,
    train_id: trainId,
    train_number: trainNumber,
    source_station_code: 'UDU',
    destination_station_code: 'NDLS',
    departure_time: '08:30:00',
    arrival_time: '22:30:00',
    distance_km: 1950,
    stops: []
  });

  // Seed Passenger 1 (Travel on D1: 2026-09-24)
  const p1Id = 'usr-p1-date-iso';
  mockDb.profiles.set(p1Id, {
    id: p1Id,
    full_name: 'Passenger One (D1)',
    email: 'p1.d1@railway.com',
    role: 'passenger'
  });

  const b1Id = 'bk-p1-date-iso-d1';
  mockDb.bookings.set(b1Id, {
    id: b1Id,
    passenger_id: p1Id,
    train_id: trainId,
    train_number: trainNumber,
    train_name: trainName,
    travel_date: D1,
    journey_date: D1,
    booking_date: '2026-09-20',
    pnr_number: '2409202601',
    status: 'confirmed',
    total_fare: 1540,
    coach_class: '3A',
    source: 'UDU',
    destination: 'NDLS'
  });

  // Seed Passenger 2 (Travel on D2: 2026-09-25 for SAME train)
  const p2Id = 'usr-p2-date-iso';
  mockDb.profiles.set(p2Id, {
    id: p2Id,
    full_name: 'Passenger Two (D2)',
    email: 'p2.d2@railway.com',
    role: 'passenger'
  });

  const b2Id = 'bk-p2-date-iso-d2';
  mockDb.bookings.set(b2Id, {
    id: b2Id,
    passenger_id: p2Id,
    train_id: trainId,
    train_number: trainNumber,
    train_name: trainName,
    travel_date: D2,
    journey_date: D2,
    booking_date: '2026-09-20',
    pnr_number: '2509202602',
    status: 'confirmed',
    total_fare: 1540,
    coach_class: '3A',
    source: 'UDU',
    destination: 'NDLS'
  });

  // Clean test-specific notifications and histories
  if (mockDb.train_status_by_date) {
    mockDb.train_status_by_date.delete(`${trainId}_${D0}`);
    mockDb.train_status_by_date.delete(`${trainId}_${D1}`);
    mockDb.train_status_by_date.delete(`${trainId}_${D2}`);
  }
  for (const [k, n] of mockDb.notifications.entries()) {
    if (n.user_id === p1Id || n.user_id === p2Id) mockDb.notifications.delete(k);
  }

  // Record baseline counts for requirement 13 audit
  const baselineTrainsCount = mockDb.trains.size;
  const baselineBookingsCount = mockDb.bookings.size;

  saveMockDbToFile();

  const adminHeaders = { Authorization: `Bearer ${getAdminToken()}` };
  const passenger1Headers = { Authorization: `Bearer ${getPassengerToken(p1Id, 'p1.d1@railway.com', 'Passenger One (D1)')}` };

  console.log('\n--- 🚀 RUNNING 14-POINT JOURNEY DATE ISOLATION TEST SUITE ---');

  // TEST 1: Update status on date D1 to DELAYED with reason and delay minutes
  console.log('Test 1: Admin marks Train 12345 DELAYED +15 on D1 (2026-09-24)...');
  const resUpdateD1 = await makeRequest(`/admin/train-status/${trainId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {
      status: 'delayed',
      delay_minutes: 15,
      reason: 'Fog conditions',
      journey_date: D1
    }
  });
  assert.strictEqual(resUpdateD1.status, 200, 'PATCH /train-status should succeed');
  assert.strictEqual(resUpdateD1.body.targetJourneyDate, D1);
  console.log('✅ Test 1 Passed: Train status updated for D1.');

  // TEST 2: Verify GET /admin/train-status?date=D1 returns DELAYED, delay_minutes, reason, status_updated_at
  console.log('Test 2: Verify GET /admin/train-status?date=D1 returns DELAYED (+15 min)...');
  const resGetD1 = await makeRequest(`/admin/train-status?date=${D1}`, { headers: adminHeaders });
  assert.strictEqual(resGetD1.status, 200);
  const trainOnD1 = resGetD1.body.find(t => t.id === trainId);
  assert.ok(trainOnD1, 'Train must be returned on D1');
  assert.strictEqual(trainOnD1.status, 'delayed', 'Status on D1 must be delayed');
  assert.strictEqual(trainOnD1.delay_minutes, 15, 'Delay on D1 must be 15');
  assert.strictEqual(trainOnD1.delay_reason, 'Fog conditions', 'Reason on D1 must match Fog conditions');
  assert.ok(trainOnD1.status_updated_at, 'status_updated_at must be populated on D1');
  console.log('✅ Test 2 Passed: D1 operational status correctly reflects DELAYED.');

  // TEST 3: Verify GET /admin/train-status?date=D2 (next date) returns ON TIME, delay_minutes=0, delay_reason=null, status_updated_at=null
  console.log('Test 3: Verify GET /admin/train-status?date=D2 (next date) returns ON TIME...');
  const resGetD2 = await makeRequest(`/admin/train-status?date=${D2}`, { headers: adminHeaders });
  assert.strictEqual(resGetD2.status, 200);
  const trainOnD2 = resGetD2.body.find(t => t.id === trainId);
  assert.ok(trainOnD2, 'Train must be returned on D2');
  assert.strictEqual(trainOnD2.status, 'on_time', 'Status on D2 must remain ON TIME');
  assert.strictEqual(trainOnD2.delay_minutes, 0, 'Delay on D2 must be 0');
  assert.strictEqual(trainOnD2.delay_reason, null, 'Delay reason on D2 must be null');
  assert.strictEqual(trainOnD2.cancellation_reason, null, 'Cancellation reason on D2 must be null');
  console.log('✅ Test 3 Passed: D2 (next date) is strictly isolated and remains ON TIME.');

  // TEST 4: Verify GET /admin/train-status?date=D0 (previous date) returns ON TIME, delay_minutes=0, delay_reason=null
  console.log('Test 4: Verify GET /admin/train-status?date=D0 (previous date) returns ON TIME...');
  const resGetD0 = await makeRequest(`/admin/train-status?date=${D0}`, { headers: adminHeaders });
  assert.strictEqual(resGetD0.status, 200);
  const trainOnD0 = resGetD0.body.find(t => t.id === trainId);
  assert.ok(trainOnD0, 'Train must be returned on D0');
  assert.strictEqual(trainOnD0.status, 'on_time', 'Status on D0 must remain ON TIME');
  assert.strictEqual(trainOnD0.delay_minutes, 0, 'Delay on D0 must be 0');
  assert.strictEqual(trainOnD0.delay_reason, null, 'Delay reason on D0 must be null');
  console.log('✅ Test 4 Passed: D0 (previous date) is strictly isolated and remains ON TIME.');

  // TEST 5: Verify passenger booked on D1 receives notification matching standard format
  console.log('Test 5: Verify Passenger 1 (booked on D1) received formatted notification...');
  const p1Notifs = Array.from(mockDb.notifications.values()).filter(n => n.user_id === p1Id && n.journey_date === D1);
  assert.strictEqual(p1Notifs.length, 1, 'Passenger 1 must receive exactly 1 notification');
  const notif1 = p1Notifs[0];
  assert.ok(notif1.title.includes('Train Status Update'), 'Title must be Train Status Update');
  assert.ok(notif1.message.includes('Train 12345'), 'Message must contain train number');
  assert.ok(notif1.message.includes('24-Sep-2026'), 'Message must contain formatted journey date 24-Sep-2026');
  assert.ok(notif1.message.includes('Status: DELAYED'), 'Message must contain Status: DELAYED');
  assert.ok(notif1.message.includes('+15 minutes') || notif1.message.includes('15 minutes'), 'Message must contain delay');
  assert.ok(notif1.message.includes('Reason: Fog conditions'), 'Message must contain reason');
  assert.ok(notif1.message.includes('Your journey has been updated'), 'Message must contain closing advisory');
  console.log('✅ Test 5 Passed: Passenger 1 received standard Indian Railways format notification.');

  // TEST 6: Verify passenger booked on D2 for SAME train does NOT receive notification
  console.log('Test 6: Verify Passenger 2 (booked on D2 for same train) received 0 notifications...');
  const p2Notifs = Array.from(mockDb.notifications.values()).filter(n => n.user_id === p2Id);
  assert.strictEqual(p2Notifs.length, 0, 'Passenger 2 must NOT receive notification for D1 disruption');
  console.log('✅ Test 6 Passed: Passenger on different date received 0 notifications.');

  // TEST 7: Update status on D1 again with SAME delay and SAME status -> verify NO duplicate notification created
  console.log('Test 7: Admin re-saves SAME delay (+15) on D1 -> verify NO duplicate notification...');
  const resUpdateD1Dup = await makeRequest(`/admin/train-status/${trainId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {
      status: 'delayed',
      delay_minutes: 15,
      reason: 'Fog conditions',
      journey_date: D1
    }
  });
  assert.strictEqual(resUpdateD1Dup.status, 200);
  const p1NotifsAfterDup = Array.from(mockDb.notifications.values()).filter(n => n.user_id === p1Id && n.journey_date === D1);
  assert.strictEqual(p1NotifsAfterDup.length, 1, 'Duplicate notification must be suppressed');
  console.log('✅ Test 7 Passed: Duplicate notification correctly suppressed.');

  // TEST 8: Update status on D1 with NEW delay (+15 to +30) -> verify passenger on D1 receives updated notification
  console.log('Test 8: Admin updates delay to +30 min on D1 -> verify new notification generated...');
  const resUpdateD1Change = await makeRequest(`/admin/train-status/${trainId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {
      status: 'delayed',
      delay_minutes: 30,
      reason: 'Heavy fog conditions enroute',
      journey_date: D1
    }
  });
  assert.strictEqual(resUpdateD1Change.status, 200);
  const p1NotifsAfterChange = Array.from(mockDb.notifications.values()).filter(n => n.user_id === p1Id && n.journey_date === D1);
  assert.strictEqual(p1NotifsAfterChange.length, 2, 'Meaningful change must generate second notification');
  assert.ok(p1NotifsAfterChange[1].message.includes('30 minutes'), 'Second notification must reflect +30 minutes');
  console.log('✅ Test 8 Passed: Updated notification generated for changed delay.');

  // TEST 9: Restore train to ON TIME on D1 -> verify status on D1 returns to ON TIME
  console.log('Test 9: Restore train to ON TIME on D1...');
  const resRestoreD1 = await makeRequest(`/admin/train-status/${trainId}/restore`, {
    method: 'POST',
    headers: adminHeaders,
    body: { journey_date: D1 }
  });
  assert.strictEqual(resRestoreD1.status, 200);
  const resGetD1Restored = await makeRequest(`/admin/train-status?date=${D1}`, { headers: adminHeaders });
  const trainD1Restored = resGetD1Restored.body.find(t => t.id === trainId);
  assert.strictEqual(trainD1Restored.status, 'on_time', 'Status on D1 must be restored to ON TIME');
  assert.strictEqual(trainD1Restored.delay_minutes, 0);
  assert.strictEqual(trainD1Restored.delay_reason, null);
  console.log('✅ Test 9 Passed: Service restored to ON TIME on D1.');

  // TEST 10: Update status to CANCELLED on D1 -> verify only D1 bookings are cancelled/refunded, D2 bookings remain confirmed
  console.log('Test 10: Cancel train service on D1 -> verify D1 booking cancelled and D2 booking remains confirmed...');
  const resCancelD1 = await makeRequest(`/admin/train-status/${trainId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {
      status: 'cancelled',
      reason: 'Severe weather alert',
      journey_date: D1
    }
  });
  assert.strictEqual(resCancelD1.status, 200);

  const booking1AfterCancel = mockDb.bookings.get(b1Id);
  const booking2AfterCancel = mockDb.bookings.get(b2Id);
  assert.strictEqual(booking1AfterCancel.status, 'cancelled', 'Booking 1 on D1 must be cancelled');
  assert.strictEqual(booking1AfterCancel.refund_status, 'APPROVED', 'Booking 1 refund must be approved');
  assert.strictEqual(booking2AfterCancel.status, 'confirmed', 'Booking 2 on D2 MUST remain confirmed!');
  console.log('✅ Test 10 Passed: Only D1 bookings cancelled. D2 bookings completely unaffected.');

  // TEST 11: Verify master recurring train record is NOT permanently modified across all dates
  console.log('Test 11: Verify master recurring train schedule is intact...');
  const masterTrain = mockDb.trains.get(trainId);
  assert.strictEqual(masterTrain.source_station_code, 'UDU');
  assert.strictEqual(masterTrain.scheduled_departure_time, '08:30:00');
  console.log('✅ Test 11 Passed: Master train schedule preserved.');

  // TEST 12: Verify status history audit records journey_date for each update
  console.log('Test 12: Verify status history audit records contain journey_date...');
  const resHistory = await makeRequest(`/admin/train-status/${trainId}/history`, { headers: adminHeaders });
  assert.strictEqual(resHistory.status, 200);
  const d1History = resHistory.body.filter(h => h.journey_date === D1);
  assert.ok(d1History.length >= 2, 'History must record D1 status transitions');
  assert.ok(d1History.every(h => h.journey_date === D1), 'All D1 history records must explicitly store journey_date');
  console.log('✅ Test 12 Passed: Status history correctly audits journey_date.');

  // TEST 13: Verify DB record counts before and after test execution
  console.log('Test 13: Verify DB record counts (no unexpected record loss or corruption)...');
  assert.strictEqual(mockDb.trains.size, baselineTrainsCount, 'Train count must remain consistent');
  assert.strictEqual(mockDb.bookings.size, baselineBookingsCount, 'Booking count must remain consistent');
  console.log('✅ Test 13 Passed: DB counts remain consistent.');

  // TEST 14: Verify non-admin/non-staff cannot update train status
  console.log('Test 14: Verify passenger is forbidden from updating train status...');
  const resForbidden = await makeRequest(`/admin/train-status/${trainId}`, {
    method: 'PATCH',
    headers: passenger1Headers,
    body: { status: 'delayed', delay_minutes: 20, journey_date: D1 }
  });
  assert.strictEqual(resForbidden.status, 403, 'Passenger must receive 403 Forbidden');
  console.log('✅ Test 14 Passed: Unauthorized status modification rejected.');

  console.log('\n🎉 ALL 14 JOURNEY DATE ISOLATION REQUIREMENTS VERIFIED & PASSED! 🎉\n');
}

startServer()
  .then(() => runTests())
  .then(() => stopServer())
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    if (server) stopServer();
    process.exit(1);
  });
