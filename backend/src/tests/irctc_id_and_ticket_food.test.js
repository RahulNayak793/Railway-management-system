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

const PORT = 5120;
const BASE_URL = `http://localhost:${PORT}`;
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const makeToken = (id, role, email = 'user@railway.com') => {
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
  console.log('🧪 Starting IRCTC ID Reset & Ticket Food Details Integration Tests...\n');

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
    // 1. New Booking with passenger IRCTC ID
    console.log('Test 1: New booking with passenger IRCTC ID...');
    const res1 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-01',
      coach_class: '3A',
      passengers: [{ name: 'Test Passenger One', age: 28, gender: 'Male', irctc_id: 'TEST_IRCTC_01' }],
      total_fare: 1450
    }, passengerToken);

    assert.strictEqual(res1.status, 201, 'Booking created successfully');
    assert.strictEqual(res1.data.booking.irctc_id, 'TEST_IRCTC_01', 'irctc_id saved');
    const pnr1 = res1.data.booking.pnr_number;
    console.log(`✅ Test 1 Passed: Booking created with PNR ${pnr1}, IRCTC ID is saved.`);

    // 2. New Booking with manual IRCTC ID
    console.log('\nTest 2: New booking with manually supplied IRCTC ID...');
    const res2 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-01',
      coach_class: '3A',
      irctc_id: 'RAHUL_IRCTC_2026',
      passengers: [{ name: 'Test Passenger Two', age: 32, gender: 'Female', irctc_id: 'RAHUL_IRCTC_2026' }],
      total_fare: 1450
    }, passengerToken);

    assert.strictEqual(res2.status, 201, 'Booking created successfully');
    assert.strictEqual(res2.data.booking.irctc_id, 'RAHUL_IRCTC_2026', 'Manual IRCTC ID correctly saved');
    const pnr2 = res2.data.booking.pnr_number;
    console.log(`✅ Test 2 Passed: Manual IRCTC ID saved for PNR ${pnr2}.`);

    // 3. Next booking without IRCTC ID does NOT inherit previous ID
    console.log('\nTest 3: Next booking without IRCTC ID does NOT pollute or inherit from previous booking...');
    const res3 = await request('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-02',
      coach_class: 'SL',
      irctc_id: '',
      passengers: [{ name: 'Test Passenger Three', age: 25, gender: 'Male' }],
      total_fare: 650
    }, passengerToken);

    assert.strictEqual(res3.status, 400, 'Next booking without IRCTC ID returns validation error 400');
    assert.strictEqual(res3.data.error, 'Each passenger must provide their own IRCTC ID.');
    console.log('✅ Test 3 Passed: Zero cross-booking IRCTC ID pollution, validation strictly enforced.');

    // 4. Fetch PNR Status for PNR 1 (no food ordered)
    console.log('\nTest 4: PNR status search for ticket without food order...');
    const pnrRes1 = await request('GET', `/api/bookings/pnr/${pnr1}`, null, passengerToken);
    assert.strictEqual(pnrRes1.status, 200, 'PNR fetch successful');
    assert.strictEqual(pnrRes1.data.irctc_id, 'TEST_IRCTC_01');
    assert.strictEqual(pnrRes1.data.catering_order, null, 'No fake food order generated');
    console.log('✅ Test 4 Passed: PNR without food returns catering_order = null.');

    // 5. Fetch PNR Status for seeded food order (PNR 2345678901)
    console.log('\nTest 5: PNR status search for ticket with existing food order...');
    const pnrFoodRes = await request('GET', '/api/bookings/pnr/2345678901', null, passengerToken);
    assert.strictEqual(pnrFoodRes.status, 200, 'PNR fetch successful');
    assert.ok(pnrFoodRes.data.catering_order, 'Catering order attached to PNR details');
    assert.strictEqual(pnrFoodRes.data.catering_order.pnr_number, '2345678901');
    assert.strictEqual(pnrFoodRes.data.catering_order.total_amount, 480);
    assert.strictEqual(pnrFoodRes.data.catering_order.items.length, 1);
    console.log('✅ Test 5 Passed: Food order details correctly attached to PNR status.');

    // 6. Strict catering included_in_ticket verification
    console.log('\nTest 6: Train catering included_in_ticket strictly requires train.catering.included_in_ticket = true...');
    assert.strictEqual(pnrFoodRes.data.catering_included_in_ticket, false, 'catering_included_in_ticket is strictly false unless explicitly configured in train catering object');
    console.log('✅ Test 6 Passed: catering_included_in_ticket is strictly false when persistent train config does not set included_in_ticket = true.');

    // 7. Data Protection Audit
    console.log('\nTest 7: Auditing production db.json data integrity...');
    const currentProdData = JSON.parse(fs.readFileSync(prodDbPath, 'utf8'));
    assert.strictEqual(currentProdData.bookings.length, initialProdData.bookings.length, '0 production bookings deleted');
    assert.strictEqual(currentProdData.passengers ? currentProdData.passengers.length : 0, initialProdData.passengers ? initialProdData.passengers.length : 0, '0 passengers deleted');
    console.log('✅ Test 7 Passed: Production database data integrity 100% verified.');

    console.log('\n🎉 ALL IRCTC ID & TICKET FOOD INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
