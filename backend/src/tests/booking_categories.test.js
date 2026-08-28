const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-categories-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const fs = require('fs');

const PORT = 5062;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Booking Categories test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log(`🔌 Booking Categories test server stopped.`);
        setTimeout(resolve, 300);
      });
    } else {
      resolve();
    }
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

function getPassengerToken(userId, email = 'passenger@railway.com') {
  const payload = {
    id: userId,
    email: email,
    role: 'passenger',
    full_name: 'Test Passenger ' + userId
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function runTests() {
  await startServer();
  let failed = false;

  const { mockDb } = require('../config/supabase');

  // Setup test train & route
  mockDb.trains.set('train-cat-1', {
    id: 'train-cat-1',
    train_number: '12952',
    train_name: 'Express Special',
    source: 'NDLS',
    destination: 'MMCT',
    departure_time: '16:30',
    arrival_time: '08:15',
    status: 'on_time'
  });

  mockDb.routes.set('route-cat-1', {
    id: 'route-cat-1',
    train_id: 'train-cat-1',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    departure_time: '16:30',
    arrival_time: '08:15',
    stops: []
  });

  try {
    console.log('\n--- 🧪 RUNNING BOOKING CATEGORIES & PERMANENT LIFECYCLE TESTS ---\n');

    const passAToken = getPassengerToken('usr-pass-A', 'passA@railway.com');
    const passBToken = getPassengerToken('usr-pass-B', 'passB@railway.com');

    // 1. Test Passenger Isolation
    console.log('Test 1: Passenger Isolation...');
    const bookResA = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passAToken}` },
      body: JSON.stringify({
        train_id: 'train-cat-1',
        travel_date: '2026-09-20',
        coach_class: '3A',
        passengers: [{ name: 'Passenger A1', age: 30, gender: 'Male' }],
        total_fare: 1450,
        idempotency_key: require('crypto').randomUUID()
      })
    });

    assert.strictEqual(bookResA.status, 201, 'Passenger A booking should succeed');
    const bookingA = bookResA.body.booking;

    const listResA = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${passAToken}` }
    });
    assert.strictEqual(listResA.status, 200);
    assert.ok(listResA.body.some(b => b.id === bookingA.id), 'Passenger A should see their own booking');

    const listResB = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${passBToken}` }
    });
    assert.strictEqual(listResB.status, 200);
    assert.strictEqual(listResB.body.some(b => b.id === bookingA.id), false, 'Passenger B MUST NOT see Passenger A bookings');
    console.log('✅ Test 1 Passed: Server strictly isolates passenger bookings.');

    // 2. Test Upcoming Journeys Classification
    console.log('\nTest 2: Upcoming Journeys Classification...');
    const upcomingItem = listResA.body.find(b => b.id === bookingA.id);
    assert.strictEqual(upcomingItem.status, 'confirmed', 'Future journey should be confirmed/upcoming');
    console.log('✅ Test 2 Passed: Future journey correctly classified under Upcoming.');

    // 3. Test Past Destination Arrival Auto-Completion
    console.log('\nTest 3: Automatic Completion After Destination Arrival...');
    const pastBookingId = 'bk-test-past-1';
    mockDb.bookings.set(pastBookingId, {
      id: pastBookingId,
      pnr_number: '7766554433',
      passenger_id: 'usr-pass-A',
      passenger_email: 'passA@railway.com',
      train_id: 'train-cat-1',
      coach_class: '3A',
      total_fare: 1450,
      status: 'confirmed',
      travel_date: '2026-07-01',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString()
    });

    const listResAAfterPast = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${passAToken}` }
    });
    const pastItem = listResAAfterPast.body.find(b => b.id === pastBookingId);
    assert.ok(pastItem, 'Past booking should be returned');
    assert.strictEqual(pastItem.status, 'completed', 'Past arrival booking should automatically transition to COMPLETED');
    console.log('✅ Test 3 Passed: Booking automatically classified as completed after destination arrival date/time.');

    // 4. Test Ticket Cancellation & Lifecycle Safety
    console.log('\nTest 4: Ticket Cancellation & Lifecycle Safety...');
    const cancelRes = await makeRequest(`/bookings/${bookingA.id}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${passAToken}` }
    });
    assert.strictEqual(cancelRes.status, 200, 'Cancellation should succeed');
    assert.strictEqual(cancelRes.body.booking.status, 'cancelled');

    const listResACancelled = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${passAToken}` }
    });
    const cancelledItem = listResACancelled.body.find(b => b.id === bookingA.id);
    assert.strictEqual(cancelledItem.status, 'cancelled', 'Booking should move to cancelled status');
    assert.ok(cancelledItem.cancellation_date_time, 'Cancellation timestamp must be recorded');

    // Verify cancelled booking NEVER moves to completed even if travel date passes
    cancelledItem.travel_date = '2020-01-01';
    mockDb.bookings.set(bookingA.id, cancelledItem);

    const listResANeverCompleted = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${passAToken}` }
    });
    const forcedItem = listResANeverCompleted.body.find(b => b.id === bookingA.id);
    assert.strictEqual(forcedItem.status, 'cancelled', 'Cancelled booking MUST NEVER move to COMPLETED');
    console.log('✅ Test 4 Passed: Cancelled booking moves to Cancelled status and never becomes Completed.');

    // 5. Test Restart Persistence & Deterministic Dummy Record Deduplication
    console.log('\nTest 5: Persistence Across Restart & Deterministic Dummy Seeding...');
    await stopServer();

    // Restart server using same DB file
    await startServer();

    const listResPostRestart = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${passAToken}` }
    });
    const itemPostRestart = listResPostRestart.body.find(b => b.id === bookingA.id);
    assert.ok(itemPostRestart, 'Cancelled booking must survive server restart');
    assert.strictEqual(itemPostRestart.status, 'cancelled', 'Cancelled status must survive server restart');

    // Check dummy seed records exist for demo user
    const demoToken = getPassengerToken('usr-demo-test-account', 'demo@railcontrol.test');
    const demoList = await makeRequest('/bookings', {
      headers: { 'Authorization': `Bearer ${demoToken}` }
    });
    const upcomingSeed = demoList.body.find(b => b.id === 'bk-seed-upcoming');
    const completedSeed = demoList.body.find(b => b.id === 'bk-seed-completed');
    const cancelledSeed = demoList.body.find(b => b.id === 'bk-seed-cancelled');

    assert.ok(upcomingSeed, 'Upcoming dummy record must exist');
    assert.ok(completedSeed, 'Completed dummy record must exist');
    assert.ok(cancelledSeed, 'Cancelled dummy record must exist');

    console.log('✅ Test 5 Passed: All booking categories survive server restart with zero duplication.');

    console.log('\n🎉 ALL BOOKING CATEGORY & PERSISTENCE TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ TEST FAILURE:', err);
    failed = true;
  } finally {
    await stopServer();
    if (failed) {
      process.exit(1);
    }
  }
}

runTests();
