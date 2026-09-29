const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const app = require('../index');
const jwt = require('jsonwebtoken');

const PORT = 5109;
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

async function runNextStationEligibilityTests() {
  console.log('🧪 Starting Premium Next-Station Eligibility & Cutoff Timing Test Suite...\n');

  const prodDbPath = path.join(__dirname, '../../data/db.json');
  const initialProdDbContent = fs.readFileSync(prodDbPath, 'utf8');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server started on port ${PORT}`);
      resolve();
    });
  });

  const passengerToken = makeToken('usr-pass-1', 'passenger', 'passenger@railway.com');
  const staffToken = makeToken('usr-staff-1', 'staff', 'staff@railway.com');

  try {
    // 1. PNR Journey Auto-Derivation Test
    console.log('Test 1: PNR journey context auto-derivation...');
    const journeyRes = await request('GET', '/api/catering/pnr-journey/2345678901', null, passengerToken);
    assert.strictEqual(journeyRes.status, 200);
    assert.strictEqual(journeyRes.data.success, true);
    assert.strictEqual(journeyRes.data.journey.pnr_number, '2345678901');
    assert.ok(journeyRes.data.next_delivery_station, 'Next delivery station should be auto-selected');
    assert.ok(journeyRes.data.eligible_stations.length > 0, 'Eligible stations list should be returned');
    console.log('✅ Test 1 Passed: PNR journey context and next delivery station derived automatically.');

    // 2. Station Menu Fetch with Cutoff Timing Metadata
    console.log('Test 2: Fetch station menu with cutoff timing metadata...');
    const menuRes = await request('GET', '/api/catering/menu?station_code=BPL', null, passengerToken);
    assert.strictEqual(menuRes.status, 200);
    assert.ok(menuRes.data.station_eligibility, 'Station eligibility timing must be returned');
    assert.strictEqual(menuRes.data.station_eligibility.station_code, 'BPL');
    assert.ok(menuRes.data.station_eligibility.order_cutoff_time, 'Cutoff time string should exist');
    console.log('✅ Test 2 Passed: Station menu returns cutoff timing and station eligibility.');

    // 3. Server Price Recalculation & Order Placement
    console.log('Test 3: Server price recalculation and order placement...');
    const orderPayload = {
      pnr_number: '2345678901',
      train_number: '12952',
      station_code: 'BPL',
      journey_date: '2026-09-20',
      coach_number: 'B1',
      seat_number: '24',
      items: [{ id: 'm6', qty: 1 }, { id: 'm18', qty: 2 }], // 280 + 90*2 = 460
      payment_method: 'UPI'
    };
    const orderRes = await request('POST', '/api/catering/order', orderPayload, passengerToken);
    assert.strictEqual(orderRes.status, 200);
    assert.strictEqual(orderRes.data.success, true);
    assert.strictEqual(orderRes.data.order.total_amount, 460);
    console.log('✅ Test 3 Passed: Server-side price calculation verified (₹460).');

    // 4. Unauthorized Menu Mutation Barred
    console.log('Test 4: Staff menu addition attempt returns 403 Forbidden...');
    const staffMutationRes = await request('POST', '/api/catering/company/menu', { name: 'Staff Dish', price: 90, category: 'Snacks' }, staffToken);
    assert.strictEqual(staffMutationRes.status, 403);
    console.log('✅ Test 4 Passed: Staff menu modification attempt blocked with 403 Forbidden.');

    // 5. Database Integrity Check
    console.log('Test 5: Database integrity verification...');
    const finalProdDbContent = fs.readFileSync(prodDbPath, 'utf8');
    assert.strictEqual(initialProdDbContent, finalProdDbContent, 'db.json must remain untouched');
    console.log('✅ Test 5 Passed: Database integrity intact.');

    console.log('\n🎉 ALL PREMIUM NEXT-STATION ELIGIBILITY TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    if (server) server.close();
  }
}

if (require.main === module) {
  runNextStationEligibilityTests().catch((err) => {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = runNextStationEligibilityTests;
