const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const express = require('express');
const http = require('http');
const assert = require('assert');

function createApp() {
  const app = express();
  app.use(express.json());

  const { router: passengerRoutes } = require('../routes/passengers');
  const authRoutes = require('../routes/auth');
  const bookingRoutes = require('../routes/bookings');
  const paymentRoutes = require('../routes/payments');

  app.use('/api/passengers', passengerRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);

  return app;
}

const app = createApp();
let server;
const PORT = 5133;

function startServer() {
  return new Promise(resolve => {
    server = app.listen(PORT, () => resolve());
  });
}

function stopServer() {
  return new Promise(resolve => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

const makeRequest = (method, reqPath, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
      method,
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function runTests() {
  console.log('\n======================================================');
  console.log('🚆 SAVED PASSENGERS & AUTO-FILL AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  try {
    await startServer();

    // Generate tokens for two distinct users
    const userA = { id: 'usr-test-a-' + Date.now(), email: 'pax.a@test.com', role: 'passenger' };
    const userB = { id: 'usr-test-b-' + Date.now(), email: 'pax.b@test.com', role: 'passenger' };

    const tokenA = 'mock-base64-' + Buffer.from(JSON.stringify(userA)).toString('base64');
    const tokenB = 'mock-base64-' + Buffer.from(JSON.stringify(userB)).toString('base64');

    let savedPassengerAId = null;

    // ----------------------------------------------------
    // TEST 1: Authenticated user can create saved passenger
    // ----------------------------------------------------
    try {
      console.log('Test 1: Authenticated user can create saved passenger...');
      const res = await makeRequest('POST', '/api/passengers/saved', {
        full_name: 'Rahul Nayak',
        age: 22,
        gender: 'Male',
        irctc_user_id: 'rahul_irctc',
        berth_preference: 'Lower Berth (LB)',
        food_preference: 'Vegetarian'
      }, tokenA);

      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.full_name, 'Rahul Nayak');
      assert.strictEqual(res.body.user_id, userA.id, 'User ID must be enforced from authentication token');
      assert.strictEqual(res.body.age, 22);
      assert.strictEqual(res.body.gender, 'Male');
      assert.strictEqual(res.body.irctc_user_id, 'rahul_irctc');
      assert.strictEqual(res.body.berth_preference, 'Lower Berth (LB)');
      assert.strictEqual(res.body.food_preference, 'Vegetarian');
      assert.ok(res.body.id, 'Saved passenger must have an id');

      savedPassengerAId = res.body.id;
      console.log('✅ Test 1 Passed: Authenticated user created saved passenger');
      passed++;
    } catch (err) {
      console.error('❌ Test 1 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 2: Authenticated user can list own saved passengers
    // ----------------------------------------------------
    try {
      console.log('Test 2: Authenticated user can list own saved passengers...');
      const res = await makeRequest('GET', '/api/passengers/saved', null, tokenA);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.body), 'Response must be an array');
      const found = res.body.find(p => p.id === savedPassengerAId);
      assert.ok(found, 'Created passenger must be in list');
      assert.strictEqual(found.full_name, 'Rahul Nayak');
      assert.strictEqual(found.user_id, userA.id);

      console.log('✅ Test 2 Passed: User can list own saved passengers');
      passed++;
    } catch (err) {
      console.error('❌ Test 2 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 3: Authenticated user can update own passenger
    // ----------------------------------------------------
    try {
      console.log('Test 3: Authenticated user can update own passenger...');
      const res = await makeRequest('PUT', `/api/passengers/saved/${savedPassengerAId}`, {
        full_name: 'Rahul Nayak',
        age: 23,
        gender: 'Male',
        berth_preference: 'Upper Berth (UB)',
        food_preference: 'Non-Vegetarian'
      }, tokenA);

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.body.age, 23);
      assert.strictEqual(res.body.berth_preference, 'Upper Berth (UB)');
      assert.strictEqual(res.body.food_preference, 'Non-Vegetarian');
      assert.ok(res.body.updated_at, 'updated_at timestamp must be present');

      console.log('✅ Test 3 Passed: User can update own passenger');
      passed++;
    } catch (err) {
      console.error('❌ Test 3 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 4: Authenticated user can delete own passenger
    // ----------------------------------------------------
    try {
      console.log('Test 4: Authenticated user can delete own passenger...');
      // Create a temporary passenger to delete
      const tempRes = await makeRequest('POST', '/api/passengers/saved', {
        full_name: 'Temporary Passenger',
        age: 40,
        gender: 'Female'
      }, tokenA);
      const tempId = tempRes.body.id;

      const delRes = await makeRequest('DELETE', `/api/passengers/saved/${tempId}`, null, tokenA);
      assert.strictEqual(delRes.statusCode, 200, `Expected 200, got ${delRes.statusCode}`);

      // Verify deletion
      const checkRes = await makeRequest('GET', `/api/passengers/saved/${tempId}`, null, tokenA);
      assert.strictEqual(checkRes.statusCode, 404, 'Deleted passenger must return 404');

      console.log('✅ Test 4 Passed: User can delete own passenger');
      passed++;
    } catch (err) {
      console.error('❌ Test 4 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 5: User cannot access another user's passenger
    // ----------------------------------------------------
    try {
      console.log('Test 5: User cannot access another user\'s passenger...');
      const res = await makeRequest('GET', `/api/passengers/saved/${savedPassengerAId}`, null, tokenB);
      assert.ok(res.statusCode === 403 || res.statusCode === 404, `Expected 403 or 404, got ${res.statusCode}`);

      // Also ensure User B's list does not include User A's passenger
      const listB = await makeRequest('GET', '/api/passengers/saved', null, tokenB);
      assert.strictEqual(listB.statusCode, 200);
      const leaked = listB.body.find(p => p.id === savedPassengerAId || p.user_id === userA.id);
      assert.strictEqual(leaked, undefined, 'User A passenger leaked in User B list');

      console.log('✅ Test 5 Passed: Strict isolation prevents accessing other user\'s passenger');
      passed++;
    } catch (err) {
      console.error('❌ Test 5 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 6: User cannot update another user's passenger
    // ----------------------------------------------------
    try {
      console.log('Test 6: User cannot update another user\'s passenger...');
      const res = await makeRequest('PUT', `/api/passengers/saved/${savedPassengerAId}`, {
        full_name: 'Hacked Name',
        age: 99
      }, tokenB);

      assert.ok(res.statusCode === 403 || res.statusCode === 404, `Expected 403/404, got ${res.statusCode}`);

      // Verify User A's passenger remained unchanged
      const verifyRes = await makeRequest('GET', `/api/passengers/saved/${savedPassengerAId}`, null, tokenA);
      assert.strictEqual(verifyRes.body.full_name, 'Rahul Nayak', 'Passenger details must not be modified by another user');

      console.log('✅ Test 6 Passed: Unauthorized update rejected');
      passed++;
    } catch (err) {
      console.error('❌ Test 6 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 7: User cannot delete another user's passenger
    // ----------------------------------------------------
    try {
      console.log('Test 7: User cannot delete another user\'s passenger...');
      const res = await makeRequest('DELETE', `/api/passengers/saved/${savedPassengerAId}`, null, tokenB);
      assert.ok(res.statusCode === 403 || res.statusCode === 404, `Expected 403/404, got ${res.statusCode}`);

      // Verify User A's passenger still exists
      const verifyRes = await makeRequest('GET', `/api/passengers/saved/${savedPassengerAId}`, null, tokenA);
      assert.strictEqual(verifyRes.statusCode, 200, 'Passenger must still exist');

      console.log('✅ Test 7 Passed: Unauthorized deletion rejected');
      passed++;
    } catch (err) {
      console.error('❌ Test 7 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 8: Duplicate passenger is not created after repeated bookings
    // ----------------------------------------------------
    try {
      console.log('Test 8: Duplicate passenger is not created after repeated bookings...');
      const bookingPax = {
        name: 'Auto Saved Pax',
        age: 28,
        gender: 'Male',
        irctc_id: 'autopax_irctc_' + Date.now(),
        berth: 'Lower Berth (LB)',
        food_selection: 'Vegetarian'
      };

      // 1st Booking with Auto Saved Pax
      const book1 = await makeRequest('POST', '/api/bookings/book', {
        train_id: 't1',
        travel_date: '2026-10-20',
        coach_class: '3A',
        passengers: [bookingPax],
        total_fare: 750
      }, tokenA);
      assert.strictEqual(book1.statusCode, 201, `Booking 1 failed: ${JSON.stringify(book1.body)}`);

      // Check saved passengers
      const listAfter1 = await makeRequest('GET', '/api/passengers/saved', null, tokenA);
      const matches1 = listAfter1.body.filter(p => p.full_name.toLowerCase() === 'auto saved pax');
      assert.strictEqual(matches1.length, 1, `Expected 1 saved passenger, got ${matches1.length}`);

      // 2nd Booking with SAME passenger but updated berth preference
      const book2 = await makeRequest('POST', '/api/bookings/book', {
        train_id: 't1',
        travel_date: '2026-10-22',
        coach_class: '3A',
        passengers: [{
          ...bookingPax,
          berth: 'Side Lower (SL)',
          food_selection: 'Non-Vegetarian'
        }],
        total_fare: 750
      }, tokenA);
      assert.strictEqual(book2.statusCode, 201, `Booking 2 failed: ${JSON.stringify(book2.body)}`);

      // Check saved passengers again -> Still exactly 1 record, with updated preferences
      const listAfter2 = await makeRequest('GET', '/api/passengers/saved', null, tokenA);
      const matches2 = listAfter2.body.filter(p => p.full_name.toLowerCase() === 'auto saved pax');
      assert.strictEqual(matches2.length, 1, `Expected still 1 saved passenger (no duplicates), got ${matches2.length}`);
      assert.strictEqual(matches2[0].berth_preference, 'Side Lower (SL)', 'Berth preference should be updated from second booking');
      assert.strictEqual(matches2[0].food_preference, 'Non-Vegetarian', 'Food preference should be updated from second booking');

      console.log('✅ Test 8 Passed: No duplicate passenger created upon repeated bookings; preferences updated');
      passed++;
    } catch (err) {
      console.error('❌ Test 8 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 9: Booking copies passenger details into historical booking
    // ----------------------------------------------------
    let bookedIdForHistTest = null;
    try {
      console.log('Test 9: Booking copies passenger details into historical booking...');
      const histPax = {
        name: 'Historical Snapshot Pax',
        age: 35,
        gender: 'Female',
        irctc_id: 'hist_pax_irctc_' + Date.now(),
        berth: 'Lower Berth (LB)',
        food_selection: 'Vegetarian'
      };

      const bookRes = await makeRequest('POST', '/api/bookings/book', {
        train_id: 't1',
        travel_date: '2026-10-25',
        coach_class: '2A',
        passengers: [histPax],
        total_fare: 1200
      }, tokenA);

      assert.strictEqual(bookRes.statusCode, 201);
      bookedIdForHistTest = bookRes.body.booking?.id || bookRes.body.id;

      // Find saved passenger profile that was created
      const list = await makeRequest('GET', '/api/passengers/saved', null, tokenA);
      const savedPax = list.body.find(p => p.full_name.toLowerCase() === 'historical snapshot pax');
      assert.ok(savedPax, 'Saved passenger must exist');

      // Update the saved passenger profile to something completely different
      await makeRequest('PUT', `/api/passengers/saved/${savedPax.id}`, {
        full_name: 'Modified Historical Pax',
        age: 50,
        berth_preference: 'Upper Berth (UB)'
      }, tokenA);

      // Verify the past booking STILL retains the original snapshot values
      const bookingFetch = await makeRequest('GET', `/api/bookings/${bookedIdForHistTest}`, null, tokenA);
      assert.strictEqual(bookingFetch.statusCode, 200);
      const bookingData = bookingFetch.body;
      const snapshotPax = bookingData.passengers && bookingData.passengers[0];
      assert.ok(snapshotPax, 'Booking must have passengers array');
      assert.strictEqual(snapshotPax.name, 'Historical Snapshot Pax', 'Past booking passenger name must not be altered');
      assert.strictEqual(snapshotPax.age, 35, 'Past booking age must not be altered');

      console.log('✅ Test 9 Passed: Booking copies passenger details into historical snapshot independently');
      passed++;
    } catch (err) {
      console.error('❌ Test 9 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 10: Deleting saved passenger does not modify old booking
    // ----------------------------------------------------
    try {
      console.log('Test 10: Deleting saved passenger does not modify old booking...');
      // Find the saved passenger profile created in test 9 and delete it
      const list = await makeRequest('GET', '/api/passengers/saved', null, tokenA);
      const savedPax = list.body.find(p => p.full_name.toLowerCase().includes('historical pax'));
      if (savedPax) {
        const delRes = await makeRequest('DELETE', `/api/passengers/saved/${savedPax.id}`, null, tokenA);
        assert.strictEqual(delRes.statusCode, 200);
      }

      // Past booking must still exist and be intact
      const bookingFetch = await makeRequest('GET', `/api/bookings/${bookedIdForHistTest}`, null, tokenA);
      assert.strictEqual(bookingFetch.statusCode, 200, 'Past booking must not be deleted');
      assert.ok(bookingFetch.body.passengers.length > 0, 'Past booking passengers must remain intact');

      console.log('✅ Test 10 Passed: Deleting saved passenger profile leaves old booking intact');
      passed++;
    } catch (err) {
      console.error('❌ Test 10 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 11: Saved passenger auto-fill returns correct fields
    // ----------------------------------------------------
    try {
      console.log('Test 11: Saved passenger auto-fill returns correct fields...');
      const fullProfile = {
        full_name: 'AutoFill Test Passenger',
        age: 26,
        gender: 'Female',
        irctc_user_id: 'autofill_user_1',
        berth_preference: 'Window Seat (WS)',
        food_preference: 'Vegetarian'
      };

      const createRes = await makeRequest('POST', '/api/passengers/saved', fullProfile, tokenA);
      assert.strictEqual(createRes.statusCode, 201);
      const pax = createRes.body;

      // Verify all required fields for auto-fill are returned
      assert.ok(pax.id, 'id is present');
      assert.strictEqual(pax.user_id, userA.id, 'user_id is present');
      assert.strictEqual(pax.full_name, fullProfile.full_name, 'full_name matches');
      assert.strictEqual(pax.age, fullProfile.age, 'age matches');
      assert.strictEqual(pax.gender, fullProfile.gender, 'gender matches');
      assert.strictEqual(pax.irctc_user_id, fullProfile.irctc_user_id, 'irctc_user_id matches');
      assert.strictEqual(pax.berth_preference, fullProfile.berth_preference, 'berth_preference matches');
      assert.strictEqual(pax.food_preference, fullProfile.food_preference, 'food_preference matches');

      console.log('✅ Test 11 Passed: Saved passenger auto-fill returns all expected fields');
      passed++;
    } catch (err) {
      console.error('❌ Test 11 Failed:', err.message);
      failed++;
    }

    // ----------------------------------------------------
    // TEST 12: Multiple saved passengers work independently
    // ----------------------------------------------------
    try {
      console.log('Test 12: Multiple saved passengers work independently...');
      const p1Res = await makeRequest('POST', '/api/passengers/saved', {
        full_name: 'Multi Passenger One',
        age: 20,
        gender: 'Male',
        berth_preference: 'Lower Berth (LB)'
      }, tokenA);

      const p2Res = await makeRequest('POST', '/api/passengers/saved', {
        full_name: 'Multi Passenger Two',
        age: 30,
        gender: 'Female',
        berth_preference: 'Upper Berth (UB)'
      }, tokenA);

      const p3Res = await makeRequest('POST', '/api/passengers/saved', {
        full_name: 'Multi Passenger Three',
        age: 40,
        gender: 'Male',
        berth_preference: 'Side Lower (SL)'
      }, tokenA);

      assert.strictEqual(p1Res.statusCode, 201);
      assert.strictEqual(p2Res.statusCode, 201);
      assert.strictEqual(p3Res.statusCode, 201);

      // Updating P2 must NOT alter P1 or P3
      await makeRequest('PUT', `/api/passengers/saved/${p2Res.body.id}`, {
        full_name: 'Multi Passenger Two Updated',
        age: 31,
        berth_preference: 'Middle Berth (MB)'
      }, tokenA);

      const checkP1 = await makeRequest('GET', `/api/passengers/saved/${p1Res.body.id}`, null, tokenA);
      const checkP2 = await makeRequest('GET', `/api/passengers/saved/${p2Res.body.id}`, null, tokenA);
      const checkP3 = await makeRequest('GET', `/api/passengers/saved/${p3Res.body.id}`, null, tokenA);

      assert.strictEqual(checkP1.body.full_name, 'Multi Passenger One');
      assert.strictEqual(checkP1.body.age, 20);
      assert.strictEqual(checkP1.body.berth_preference, 'Lower Berth (LB)');

      assert.strictEqual(checkP2.body.full_name, 'Multi Passenger Two Updated');
      assert.strictEqual(checkP2.body.age, 31);
      assert.strictEqual(checkP2.body.berth_preference, 'Middle Berth (MB)');

      assert.strictEqual(checkP3.body.full_name, 'Multi Passenger Three');
      assert.strictEqual(checkP3.body.age, 40);
      assert.strictEqual(checkP3.body.berth_preference, 'Side Lower (SL)');

      console.log('✅ Test 12 Passed: Multiple saved passengers operate independently');
      passed++;
    } catch (err) {
      console.error('❌ Test 12 Failed:', err.message);
      failed++;
    }

  } catch (globalErr) {
    console.error('Fatal Test Runner Error:', globalErr);
  } finally {
    await stopServer();
  }

  console.log('\n======================================================');
  console.log(`📊 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
