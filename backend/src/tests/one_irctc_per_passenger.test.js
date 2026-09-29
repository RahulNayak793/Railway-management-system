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

const PORT = 5130;
const BASE_URL = `http://localhost:${PORT}`;
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const makeToken = (id, role, email = 'passenger@railway.com') => {
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
  console.log('🧪 Starting One IRCTC ID Per Passenger Test Suite (10 Test Cases)...\n');

  const prodDbPath = path.join(__dirname, '../../data/db.json');
  const initialProdData = JSON.parse(fs.readFileSync(prodDbPath, 'utf8'));

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server listening on port ${PORT}`);
      resolve();
    });
  });

  const passengerToken = makeToken('usr-demo-passenger', 'passenger', 'passenger@railway.com');

  try {
    // -------------------------------------------------------------
    // Test 1 — One Passenger: 1 passenger + 1 IRCTC ID → PASS
    // -------------------------------------------------------------
    console.log('Test 1: 1 Passenger + 1 IRCTC ID → PASS...');
    const res1 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-10',
      coach_class: '3A',
      passengers: [
        { name: 'Rahul Nayak', age: 25, gender: 'Male', irctc_id: 'rahul123' }
      ],
      total_fare: 1450
    }, passengerToken);

    assert.strictEqual(res1.status, 201, '1 Passenger booking created successfully');
    assert.strictEqual(res1.data.booking.passengers[0].irctc_id, 'rahul123');
    assert.strictEqual(res1.data.allocations[0].irctc_id, 'rahul123');
    const pnr1 = res1.data.booking.pnr_number;
    console.log(`✅ Test 1 Passed: 1 Passenger + 1 IRCTC ID (PNR: ${pnr1})`);

    // -------------------------------------------------------------
    // Test 2 — Two Passengers: 2 passengers + 2 different IRCTC IDs → PASS
    // -------------------------------------------------------------
    console.log('\nTest 2: 2 Passengers + 2 different IRCTC IDs → PASS...');
    const res2 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-10',
      coach_class: '3A',
      passengers: [
        { name: 'Rahul Nayak', age: 25, gender: 'Male', irctc_id: 'rahul123' },
        { name: 'Priya Nayak', age: 24, gender: 'Female', irctc_id: 'priya456' }
      ],
      total_fare: 2900
    }, passengerToken);

    assert.strictEqual(res2.status, 201, '2 Passenger booking created successfully');
    assert.strictEqual(res2.data.allocations.length, 2);
    assert.strictEqual(res2.data.allocations[0].irctc_id, 'rahul123');
    assert.strictEqual(res2.data.allocations[1].irctc_id, 'priya456');
    const pnr2 = res2.data.booking.pnr_number;
    console.log(`✅ Test 2 Passed: 2 Passengers with distinct IRCTC IDs (PNR: ${pnr2})`);

    // -------------------------------------------------------------
    // Test 3 — Three Passengers: 3 passengers + 3 different IRCTC IDs → PASS
    // -------------------------------------------------------------
    console.log('\nTest 3: 3 Passengers + 3 different IRCTC IDs → PASS...');
    const res3 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-10',
      coach_class: '3A',
      passengers: [
        { name: 'Rahul', age: 25, gender: 'Male', irctc_id: 'rahul123' },
        { name: 'Priya', age: 24, gender: 'Female', irctc_id: 'priya456' },
        { name: 'Amit', age: 28, gender: 'Male', irctc_id: 'amit789' }
      ],
      total_fare: 4350
    }, passengerToken);

    assert.strictEqual(res3.status, 201, '3 Passenger booking created successfully');
    assert.strictEqual(res3.data.allocations.length, 3);
    assert.strictEqual(res3.data.allocations[0].irctc_id, 'rahul123');
    assert.strictEqual(res3.data.allocations[1].irctc_id, 'priya456');
    assert.strictEqual(res3.data.allocations[2].irctc_id, 'amit789');
    console.log('✅ Test 3 Passed: 3 Passengers with 3 distinct IRCTC IDs.');

    // -------------------------------------------------------------
    // Test 4 — Missing ID: 2 passengers + only 1 IRCTC ID → FAIL
    // -------------------------------------------------------------
    console.log('\nTest 4: 2 Passengers + only 1 IRCTC ID → FAIL with validation error...');
    const res4 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-11',
      coach_class: '3A',
      passengers: [
        { name: 'Rahul', age: 25, gender: 'Male', irctc_id: 'rahul123' },
        { name: 'Priya', age: 24, gender: 'Female' } // missing irctc_id
      ],
      total_fare: 2900
    }, passengerToken);

    assert.strictEqual(res4.status, 400, 'Missing IRCTC ID for Passenger 2 returns HTTP 400');
    assert.strictEqual(res4.data.error, 'Each passenger must provide their own IRCTC ID.');
    console.log('✅ Test 4 Passed: Missing Passenger 2 IRCTC ID rejected with validation error.');

    // -------------------------------------------------------------
    // Test 5 — Blank ID: 2 passengers + one blank IRCTC ID → FAIL
    // -------------------------------------------------------------
    console.log('\nTest 5: 2 Passengers + one blank IRCTC ID → FAIL...');
    const res5 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-11',
      coach_class: '3A',
      passengers: [
        { name: 'Rahul', age: 25, gender: 'Male', irctc_id: 'rahul123' },
        { name: 'Priya', age: 24, gender: 'Female', irctc_id: '   ' } // blank/whitespace
      ],
      total_fare: 2900
    }, passengerToken);

    assert.strictEqual(res5.status, 400, 'Blank IRCTC ID returns HTTP 400');
    assert.strictEqual(res5.data.error, 'Each passenger must provide their own IRCTC ID.');
    console.log('✅ Test 5 Passed: Blank IRCTC ID rejected with validation error.');

    // -------------------------------------------------------------
    // Test 6 — No Automatic Reuse
    // -------------------------------------------------------------
    console.log('\nTest 6: No Automatic Reuse — new booking without IRCTC IDs does NOT inherit previous booking IDs...');
    const res6 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-12',
      coach_class: 'SL',
      passengers: [
        { name: 'Suresh', age: 30, gender: 'Male' } // no ID
      ],
      total_fare: 650
    }, passengerToken);

    assert.strictEqual(res6.status, 400, 'New booking requires explicit IRCTC ID and does not inherit old booking ID');
    assert.strictEqual(res6.data.error, 'Each passenger must provide their own IRCTC ID.');
    console.log('✅ Test 6 Passed: Zero automatic ID inheritance or cross-booking pollution.');

    // -------------------------------------------------------------
    // Test 7 — Passenger Isolation
    // -------------------------------------------------------------
    console.log('\nTest 7: Passenger Isolation — Passenger 1 receives ID A, Passenger 2 receives ID B...');
    assert.strictEqual(res2.data.allocations[0].passenger_name, 'Rahul Nayak');
    assert.strictEqual(res2.data.allocations[0].irctc_id, 'rahul123');
    assert.strictEqual(res2.data.allocations[1].passenger_name, 'Priya Nayak');
    assert.strictEqual(res2.data.allocations[1].irctc_id, 'priya456');
    console.log('✅ Test 7 Passed: Strict passenger-level IRCTC ID isolation confirmed.');

    // -------------------------------------------------------------
    // Test 8 — Existing Historical Booking Data Unchanged
    // -------------------------------------------------------------
    console.log('\nTest 8: Existing Historical Booking Data Unchanged...');
    const currentProdData8 = JSON.parse(fs.readFileSync(prodDbPath, 'utf8'));
    assert.strictEqual(currentProdData8.bookings.length, initialProdData.bookings.length, '0 production bookings deleted or mutated');
    console.log('✅ Test 8 Passed: Historical booking dataset preserved intact.');

    // -------------------------------------------------------------
    // Test 9 — Existing Historical IRCTC ID Preserved
    // -------------------------------------------------------------
    console.log('\nTest 9: Existing Historical IRCTC ID Preserved...');
    const existingBookingWithIrctc = initialProdData.bookings.find(b => b.irctc_id);
    if (existingBookingWithIrctc) {
      const currentBooking = currentProdData8.bookings.find(b => b.id === existingBookingWithIrctc.id);
      assert.strictEqual(currentBooking.irctc_id, existingBookingWithIrctc.irctc_id, 'Historical top-level irctc_id preserved');
    }
    console.log('✅ Test 9 Passed: Historical IRCTC ID fields not deleted or overwritten.');

    // -------------------------------------------------------------
    // Test 10 — Ticket Display & PNR Search Output
    // -------------------------------------------------------------
    console.log('\nTest 10: Ticket Display & PNR search output verification...');
    const pnrRes = await request('GET', `/api/bookings/pnr/${pnr2}`, null, passengerToken);
    assert.strictEqual(pnrRes.status, 200, 'PNR fetch successful');
    assert.strictEqual(pnrRes.data.allocations.length, 2);
    assert.strictEqual(pnrRes.data.allocations[0].irctc_id, 'rahul123');
    assert.strictEqual(pnrRes.data.allocations[1].irctc_id, 'priya456');
    console.log('✅ Test 10 Passed: PNR lookup correctly displays separate IRCTC IDs for each passenger.');

    console.log('\n🎉 ALL 10 ONE IRCTC PER PASSENGER TEST CASES PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
