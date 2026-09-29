const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const app = require('../index');
const jwt = require('jsonwebtoken');
const { mockDb } = require('../config/supabase');

const PORT = 5140;
const BASE_URL = `http://localhost:${PORT}`;
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const makeToken = (id, role = 'passenger', email = 'passenger@railway.com') => {
  return jwt.sign({ id, role, email }, jwtSecret, { expiresIn: '1h' });
};

let server;

async function request(method, reqPath, body = null, token = null) {
  const url = `${BASE_URL}${reqPath}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let parsed = null;
  try {
    parsed = await res.json();
  } catch (e) {
    parsed = null;
  }
  return { status: res.status, data: parsed };
}

async function runTests() {
  console.log('🧪 Starting Unique IRCTC User ID Per Passenger Test Suite...\n');

  // Setup test mockDb profiles
  const passengerA = {
    id: 'usr-pass-A',
    email: 'passengerA@railway.com',
    full_name: 'Passenger A',
    role: 'passenger',
    status: 'Active',
    irctc_user_id: null
  };
  const passengerB = {
    id: 'usr-pass-B',
    email: 'passengerB@railway.com',
    full_name: 'Passenger B',
    role: 'passenger',
    status: 'Active',
    irctc_user_id: null
  };

  mockDb.profiles.set(passengerA.id, passengerA);
  mockDb.profiles.set(passengerB.id, passengerB);

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server listening on port ${PORT}`);
      resolve();
    });
  });

  const tokenA = makeToken(passengerA.id, 'passenger', passengerA.email);
  const tokenB = makeToken(passengerB.id, 'passenger', passengerB.email);

  try {
    // -------------------------------------------------------------
    // Test 1 — New unique ID: Passenger A enters rahul12345 -> Success
    // -------------------------------------------------------------
    console.log('Test 1: Passenger A enters rahul12345 (New Unique ID) -> Success...');
    const res1 = await request('PUT', '/api/auth/irctc-id', { irctc_user_id: 'rahul12345' }, tokenA);
    assert.strictEqual(res1.status, 200, 'HTTP 200 expected for unique ID assignment');
    assert.strictEqual(res1.data.user.irctc_user_id, 'rahul12345', 'IRCTC User ID correctly linked to Passenger A');
    assert.strictEqual(mockDb.profiles.get(passengerA.id).irctc_user_id, 'rahul12345');
    console.log('✅ Test 1 Passed: Passenger A linked rahul12345 successfully.');

    // -------------------------------------------------------------
    // Test 2 — Duplicate ID: Passenger B attempts to enter rahul12345 -> Rejected
    // -------------------------------------------------------------
    console.log('\nTest 2: Passenger B attempts to enter rahul12345 (Duplicate ID) -> Rejected...');
    const res2 = await request('PUT', '/api/auth/irctc-id', { irctc_user_id: 'rahul12345' }, tokenB);
    assert.strictEqual(res2.status, 400, 'HTTP 400 expected for duplicate IRCTC ID');
    assert.strictEqual(
      res2.data.error,
      'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.',
      'Exact duplicate rejection error message verified'
    );
    assert.notStrictEqual(mockDb.profiles.get(passengerB.id).irctc_user_id, 'rahul12345', 'Passenger B ID unchanged');
    console.log('✅ Test 2 Passed: Duplicate IRCTC User ID rejected with exact required error message.');

    // -------------------------------------------------------------
    // Test 3 — Existing passenger updates own ID: Passenger A enters rahul12345 -> Allowed
    // -------------------------------------------------------------
    console.log('\nTest 3: Passenger A updates/saves their already-linked rahul12345 -> Allowed...');
    const res3 = await request('PUT', '/api/auth/irctc-id', { irctc_user_id: 'rahul12345' }, tokenA);
    assert.strictEqual(res3.status, 200, 'HTTP 200 expected when updating own ID');
    assert.strictEqual(res3.data.user.irctc_user_id, 'rahul12345');
    console.log('✅ Test 3 Passed: Owner re-submitting own IRCTC ID allowed.');

    // -------------------------------------------------------------
    // Test 4 — Different passenger: Passenger B enters Passenger A\'s ID -> Rejected
    // -------------------------------------------------------------
    console.log('\nTest 4: Passenger B tries entering Passenger A\'s ID via profile update -> Rejected...');
    const res4 = await request('PUT', '/api/auth/profile', { irctc_user_id: 'RAHUL12345' }, tokenB);
    assert.strictEqual(res4.status, 400, 'HTTP 400 expected for case-insensitive duplicate check');
    assert.strictEqual(
      res4.data.error,
      'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
    );
    console.log('✅ Test 4 Passed: Case-insensitive duplicate check rejected Passenger B.');

    // -------------------------------------------------------------
    // Test 5 — Two new passengers: Passenger A -> rahul12345, Passenger B -> anita786 -> Both succeed
    // -------------------------------------------------------------
    console.log('\nTest 5: Passenger B enters anita786 (Separate unique ID) -> Success...');
    const res5 = await request('PUT', '/api/auth/irctc-id', { irctc_user_id: 'anita786' }, tokenB);
    assert.strictEqual(res5.status, 200, 'HTTP 200 expected for distinct new ID');
    assert.strictEqual(res5.data.user.irctc_user_id, 'anita786');
    assert.strictEqual(mockDb.profiles.get(passengerA.id).irctc_user_id, 'rahul12345');
    assert.strictEqual(mockDb.profiles.get(passengerB.id).irctc_user_id, 'anita786');
    console.log('✅ Test 5 Passed: Two distinct passengers linked to unique IRCTC User IDs.');

    // -------------------------------------------------------------
    // Test 6 — Booking Flow: Multi-passenger booking with distinct IDs vs duplicate IDs
    // -------------------------------------------------------------
    console.log('\nTest 6: Multi-passenger booking verification...');
    
    // 6a. Attempt booking where Passenger 2 reuses Passenger 1's ID -> Rejection expected
    const res6a = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-11-01',
      coach_class: '3A',
      passengers: [
        { name: 'Passenger A', age: 25, gender: 'Male', irctc_id: 'rahul12345' },
        { name: 'Companion B', age: 24, gender: 'Female', irctc_id: 'rahul12345' } // duplicate in booking
      ],
      total_fare: 2900
    }, tokenA);
    assert.strictEqual(res6a.status, 400, 'Duplicate IRCTC ID in booking returns HTTP 400');
    assert.strictEqual(res6a.data.error, 'Each passenger must provide their own unique IRCTC ID.');
    console.log('✅ Test 6a Passed: Duplicate IRCTC ID inside single booking rejected.');

    // 6b. Attempt booking where Passenger 2 uses another registered user's ID -> Rejection expected
    const res6b = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-11-01',
      coach_class: '3A',
      passengers: [
        { name: 'Guest User', age: 30, gender: 'Male', irctc_id: 'guest99' },
        { name: 'Stolen User', age: 28, gender: 'Female', irctc_id: 'anita786' } // anita786 belongs to Passenger B!
      ],
      total_fare: 2900
    }, tokenA);
    assert.strictEqual(res6b.status, 400, 'IRCTC ID belonging to another profile returns HTTP 400');
    assert.strictEqual(
      res6b.data.error,
      'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
    );
    console.log('✅ Test 6b Passed: Attempting to use another registered passenger\'s IRCTC ID during booking rejected.');

    // 6c. Booking with two valid unique unassigned IDs -> Success
    const res6c = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-11-01',
      coach_class: '3A',
      passengers: [
        { name: 'Passenger A', age: 25, gender: 'Male', irctc_id: 'rahul12345' },
        { name: 'Companion C', age: 24, gender: 'Female', irctc_id: 'uniquecomp99' }
      ],
      total_fare: 2900
    }, tokenA);
    assert.strictEqual(res6c.status, 201, 'Booking created with distinct IRCTC IDs');
    assert.strictEqual(res6c.data.allocations[0].irctc_id, 'rahul12345');
    assert.strictEqual(res6c.data.allocations[1].irctc_id, 'uniquecomp99');
    console.log('✅ Test 6c Passed: Booking created successfully with distinct IRCTC User IDs.');

    console.log('\n🎉 ALL 6 UNIQUE IRCTC USER ID PER PASSENGER TEST CASES PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
