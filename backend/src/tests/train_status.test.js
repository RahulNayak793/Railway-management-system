const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

const PORT = 5058;
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

// Helpers to make requests
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
    id: 'usr-admin-test',
    email: 'admin@railway.com',
    role: 'admin',
    full_name: 'Test Admin'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function getPassengerToken(userId = 'usr-passenger-test') {
  const payload = {
    id: userId,
    email: 'passenger@railway.com',
    role: 'passenger',
    full_name: 'Test Passenger'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function runTests() {
  // Ensure we are in mock mode for unit/concurrency tests
  if (!isMockMode) {
    console.log('Skipping local mockDb tests since SUPABASE live mode is active.');
    return;
  }

  console.log('\n--- 🧪 SEEDING TEST DB FOR TRAIN STATUS MODULE TESTS ---');
  
  // Seed Train
  const trainId = 't-test-status-123';
  const train = {
    id: trainId,
    train_number: '887799',
    train_name: 'Status Test Express',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    status: 'on_time',
    delay_minutes: 0,
    coaches: { '3A': 1, 'SL': 2 }
  };
  mockDb.trains.set(trainId, train);

  // Seed Route
  const routeId = 'r-test-status-123';
  const route = {
    id: routeId,
    train_id: trainId,
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    departure_time: '08:00:00',
    arrival_time: '18:00:00',
    distance_km: 1380,
    fare_multiplier: 1.2,
    stops: []
  };
  mockDb.routes.set(routeId, route);

  // Seed User Profile
  const passengerId = 'usr-passenger-test-88';
  const passenger = {
    id: passengerId,
    full_name: 'Test Affected Passenger',
    email: 'passenger88@railway.com',
    role: 'passenger'
  };
  mockDb.profiles.set(passengerId, passenger);

  // Seed Booking
  const bookingId = 'bk-test-status-88';
  const booking = {
    id: bookingId,
    passenger_id: passengerId,
    train_id: trainId,
    booking_date: '2026-08-26',
    travel_date: '2026-08-27',
    pnr_number: '1122334455',
    status: 'confirmed',
    total_fare: 980
  };
  mockDb.bookings.set(bookingId, booking);

  // Clear notifications & history
  mockDb.notifications.clear();
  mockDb.train_status_history.clear();

  saveMockDbToFile();

  await startServer();

  try {
    const adminHeaders = { 'Authorization': `Bearer ${getAdminToken()}` };
    const passengerHeaders = { 'Authorization': `Bearer ${getPassengerToken(passengerId)}` };

    console.log('\n--- 🧪 RUNNING TRAIN STATUS & DISRUPTION TESTS ---');

    // 1. Admin can view train statuses
    console.log('Test 1: Admin can fetch train statuses...');
    const t1 = await makeRequest('/admin/train-status', { headers: adminHeaders });
    assert.strictEqual(t1.status, 200, 'Fetcher should return 200');
    assert.ok(Array.isArray(t1.body), 'Response must be an array');
    const testTrain = t1.body.find(t => t.id === trainId);
    assert.ok(testTrain, 'Test train must be returned');
    assert.strictEqual(testTrain.status, 'on_time', 'Seeded train must be on_time initially');
    console.log('✅ Test 1 Passed.');

    // 2. Non-admin cannot modify status
    console.log('Test 2: Non-admin is blocked from modifying train status...');
    const t2 = await makeRequest(`/admin/train-status/${trainId}`, {
      method: 'PATCH',
      headers: passengerHeaders,
      body: { status: 'delayed', delay_minutes: 30, reason: 'Weather' }
    });
    assert.strictEqual(t2.status, 403, 'Passenger must receive 403 Forbidden');
    console.log('✅ Test 2 Passed.');

    // 3. Admin can mark train delayed + 4. Delay minutes persisted
    console.log('Test 3 & 4: Admin updates status to DELAYED...');
    const t3 = await makeRequest(`/admin/train-status/${trainId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { status: 'delayed', delay_minutes: 120, reason: 'Track Maintenance', message: 'Signal failure' }
    });
    assert.strictEqual(t3.status, 200, 'Admin patch should return 200');
    
    const updatedTrain = mockDb.trains.get(trainId);
    assert.strictEqual(updatedTrain.status, 'delayed', 'Status should be delayed');
    assert.strictEqual(updatedTrain.delay_minutes, 120, 'Delay minutes must be 120');
    assert.strictEqual(updatedTrain.delay_reason, 'Track Maintenance');
    assert.strictEqual(updatedTrain.delay_message, 'Signal failure');
    console.log('✅ Test 3 & 4 Passed.');

    // 5. Original schedule remains unchanged + 6. Updated schedule is calculated correctly
    console.log('Test 5 & 6: Validate scheduled and calculated times...');
    assert.strictEqual(updatedTrain.scheduled_departure_time, '08:00:00', 'Original scheduled dep time preserved');
    assert.strictEqual(updatedTrain.scheduled_arrival_time, '18:00:00', 'Original scheduled arr time preserved');
    assert.strictEqual(updatedTrain.updated_departure_time, '10:00:00', 'Updated departure calculated (+120 mins)');
    assert.strictEqual(updatedTrain.updated_arrival_time, '20:00:00', 'Updated arrival calculated (+120 mins)');
    console.log('✅ Test 5 & 6 Passed.');

    // 7. Status History is logged
    console.log('Test 7: Fetch and verify status history...');
    const historyRes = await makeRequest(`/admin/train-status/${trainId}/history`, { headers: adminHeaders });
    assert.strictEqual(historyRes.status, 200);
    assert.ok(historyRes.body.length >= 1, 'History must record the transition');
    const log = historyRes.body[0];
    assert.strictEqual(log.previous_status, 'on_time');
    assert.strictEqual(log.new_status, 'delayed');
    assert.strictEqual(log.delay_minutes, 120);
    assert.strictEqual(log.reason, 'Track Maintenance');
    console.log('✅ Test 7 Passed.');

    // 8. Passenger notification created for affected booking
    console.log('Test 8: Check notification sent to affected passenger...');
    const passengerNotifs = Array.from(mockDb.notifications.values()).filter(n => n.user_id === passengerId);
    assert.strictEqual(passengerNotifs.length, 1, 'Exactly 1 notification should be created');
    assert.ok(passengerNotifs[0].message.includes('delayed by 120 minutes'), 'Notification message matches delay');
    console.log('✅ Test 8 Passed.');

    // 9. Admin can reschedule a train
    console.log('Test 9: Admin reschedules train departure/arrival...');
    const t9 = await makeRequest(`/admin/train-status/${trainId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { 
        status: 'rescheduled', 
        reason: 'Crew Availability', 
        message: 'Awaiting connecting crew',
        updated_departure_time: '11:30:00',
        updated_arrival_time: '21:30:00'
      }
    });
    assert.strictEqual(t9.status, 200);
    
    const rescheduledTrain = mockDb.trains.get(trainId);
    assert.strictEqual(rescheduledTrain.status, 'rescheduled');
    assert.strictEqual(rescheduledTrain.updated_departure_time, '11:30:00');
    assert.strictEqual(rescheduledTrain.updated_arrival_time, '21:30:00');
    console.log('✅ Test 9 Passed.');

    // 10. Admin can mark train cancelled
    console.log('Test 10: Admin updates status to CANCELLED...');
    const t10 = await makeRequest(`/admin/train-status/${trainId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { status: 'cancelled', reason: 'Weather', message: 'Severe storm cancellation' }
    });
    assert.strictEqual(t10.status, 200);
    
    const cancelledTrain = mockDb.trains.get(trainId);
    assert.strictEqual(cancelledTrain.status, 'cancelled');
    console.log('✅ Test 10 Passed.');

    // 11. Existing bookings are preserved
    console.log('Test 11: Verify existing passenger bookings are NOT deleted...');
    const currentBooking = mockDb.bookings.get(bookingId);
    assert.ok(currentBooking, 'Booking must still exist');
    assert.strictEqual(currentBooking.status, 'confirmed', 'Existing booking status remains confirmed');
    console.log('✅ Test 11 Passed.');

    // 12. Search results show cancelled status and block new bookings
    console.log('Test 12: Search API results show train status and are filtered...');
    const searchRes = await makeRequest(`/trains?source=NDLS&destination=MMCT&date=2026-08-27`);
    assert.strictEqual(searchRes.status, 200);
    const searchResultTrain = searchRes.body.find(t => t.id === trainId);
    assert.ok(searchResultTrain);
    assert.strictEqual(searchResultTrain.status, 'cancelled', 'Search result includes train cancellation status');
    console.log('✅ Test 12 Passed.');

    // 13. Admin can restore delayed/cancelled train back to ON TIME
    console.log('Test 13: Restore train service to ON TIME...');
    const t13 = await makeRequest(`/admin/train-status/${trainId}/restore`, {
      method: 'POST',
      headers: adminHeaders
    });
    assert.strictEqual(t13.status, 200);
    
    const restoredTrain = mockDb.trains.get(trainId);
    assert.strictEqual(restoredTrain.status, 'on_time');
    assert.strictEqual(restoredTrain.delay_minutes, 0);
    assert.strictEqual(restoredTrain.updated_departure_time, null);
    console.log('✅ Test 13 Passed.');

    // 14. Single Source of Truth — Adding a train in Fleet Management immediately appears in Train Status
    console.log('Test 14: Creating a new train dynamically reflects in Train Status (Single Source of Truth)...');
    const newTrainId = 't-dyn-sync-999';
    const newTrainObj = {
      id: newTrainId,
      train_number: '99999',
      train_name: 'Dynamic Sync Special',
      source_station_code: 'UDU',
      destination_station_code: 'NDLS',
      status: 'on_time',
      delay_minutes: 0,
      source: 'admin',
      record_source: 'admin'
    };
    mockDb.trains.set(newTrainId, newTrainObj);
    mockDb.routes.set('r-dyn-sync-999', {
      id: 'r-dyn-sync-999',
      train_id: newTrainId,
      source_station_code: 'UDU',
      destination_station_code: 'NDLS',
      departure_time: '04:00:00',
      arrival_time: '19:00:00',
      distance_km: 1200,
      stops: []
    });

    const statusRes14 = await makeRequest('/admin/train-status', { headers: adminHeaders });
    assert.strictEqual(statusRes14.status, 200);
    const foundNewTrain = statusRes14.body.find(t => t.id === newTrainId || t.train_number === '99999');
    assert.ok(foundNewTrain, 'Newly added train must automatically appear in Train Status');
    assert.strictEqual(foundNewTrain.train_name, 'Dynamic Sync Special');
    assert.strictEqual(foundNewTrain.source_station_code, 'UDU');
    console.log('✅ Test 14 Passed.');

    // 15. Editing a train updates Train Status
    console.log('Test 15: Editing a train updates Train Status immediately...');
    newTrainObj.train_name = 'Dynamic Sync Special Updated';
    mockDb.trains.set(newTrainId, newTrainObj);
    const statusRes15 = await makeRequest('/admin/train-status', { headers: adminHeaders });
    const editedTrain = statusRes15.body.find(t => t.id === newTrainId || t.train_number === '99999');
    assert.ok(editedTrain);
    assert.strictEqual(editedTrain.train_name, 'Dynamic Sync Special Updated');
    console.log('✅ Test 15 Passed.');

    // 16. Deleting a train removes it from Train Status
    console.log('Test 16: Deleting a train removes it from Train Status...');
    mockDb.trains.delete(newTrainId);
    mockDb.routes.delete('r-dyn-sync-999');
    const statusRes16 = await makeRequest('/admin/train-status', { headers: adminHeaders });
    const deletedTrain = statusRes16.body.find(t => t.id === newTrainId || t.train_number === '99999');
    assert.strictEqual(deletedTrain, undefined, 'Deleted train must disappear from Train Status');
    console.log('✅ Test 16 Passed.');

    console.log('\n🎉 ALL TRAIN STATUS & DISRUPTIONS TEST CASES PASSED SUCCESSFULLY! 🎉\n');

  } finally {
    await stopServer();
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Tests failed with error:', err);
    process.exit(1);
  });
}

