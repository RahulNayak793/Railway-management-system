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

async function runCateringPaymentFlowTests() {
  console.log('🧪 Starting RailControl Catering Payment Flow & Cutoff Test Suite...\n');

  const prodDbPath = path.join(__dirname, '../../data/db.json');
  const initialProdDbContent = fs.readFileSync(prodDbPath, 'utf8');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server started on port ${PORT}`);
      resolve();
    });
  });

  const adminToken = makeToken('usr-admin-1', 'admin', 'admin@railway.com');
  const staffToken = makeToken('usr-staff-1', 'staff', 'staff@railway.com');
  const passengerToken = makeToken('usr-pass-1', 'passenger', 'passenger@railway.com');

  try {
    // 1. Menu catalog fetch & structure
    console.log('Test 1: Passenger fetches menu catalog with full categories...');
    const menuRes = await request('GET', '/api/catering/menu', null, passengerToken);
    assert.strictEqual(menuRes.status, 200, `Expected 200, got ${menuRes.status}`);
    assert.ok(Array.isArray(menuRes.data.menu), 'Menu array must exist');
    assert.ok(menuRes.data.menu.length > 0, 'Menu items must be populated');
    const categoriesFound = Array.from(new Set(menuRes.data.menu.map(item => (item.category || '').toUpperCase())));
    assert.ok(categoriesFound.includes('BREAKFAST'), 'Must include BREAKFAST category');
    assert.ok(categoriesFound.includes('MEALS'), 'Must include MEALS category');
    console.log('✅ Test 1 Passed: Menu catalog properly structured and returned.');

    // 2. Staff/Admin RBAC menu management block
    console.log('Test 2: Verifying Staff/Admin menu creation endpoint returns 403 Forbidden...');
    const staffMenuRes = await request('POST', '/api/catering/company/menu', { name: 'Forbidden Thali', price: 200, category: 'Meals' }, staffToken);
    assert.strictEqual(staffMenuRes.status, 403, `Expected 403, got ${staffMenuRes.status}`);
    assert.ok(staffMenuRes.data.error.includes('Staff and Admin cannot add food menu items'), 'Error message must state staff/admin cannot manage food items');
    console.log('✅ Test 2 Passed: Staff/Admin menu management strictly forbidden.');

    // 3. PNR journey derivation with 10-digit PNR
    console.log('Test 3: Passenger derives journey details from valid 10-digit PNR...');
    const pnrRes = await request('GET', '/api/catering/pnr-journey/1234567890', null, passengerToken);
    assert.strictEqual(pnrRes.status, 200, `Expected 200, got ${pnrRes.status}`);
    assert.strictEqual(pnrRes.data.journey.pnr_number, '1234567890', 'PNR number matched');
    assert.ok(Array.isArray(pnrRes.data.eligible_stations), 'Eligible stations returned');
    console.log('✅ Test 3 Passed: PNR journey derivation successful.');

    // 4. Place order with server-calculated price and test payment status
    console.log('Test 4: Order creation with test payment mode...');
    const firstDish = menuRes.data.menu[0];
    const orderPayload = {
      pnr_number: '1234567890',
      train_number: '12951',
      station_code: 'NDLS',
      seat_number: 'B2-45',
      coach_number: 'B2',
      passenger_name: 'Test Passenger',
      items: [
        { id: firstDish.id, qty: 2 }
      ],
      payment_method: 'UPI',
      notes: 'Please double wrap'
    };
    const orderRes = await request('POST', '/api/catering/order', orderPayload, passengerToken);
    assert.strictEqual(orderRes.status, 200, `Expected 200, got ${orderRes.status}`);
    assert.strictEqual(orderRes.data.success, true);
    assert.strictEqual(orderRes.data.order.payment_status, 'Paid');
    assert.strictEqual(orderRes.data.order.payment_mode, 'Secure Test Payment — Development Mode');
    assert.strictEqual(orderRes.data.order.total_amount, firstDish.price * 2, 'Total amount calculated on server');
    console.log('✅ Test 4 Passed: Order successfully created with server-verified total and test payment mode.');

    // 5. Verification of DB protection
    const currentProdDbContent = fs.readFileSync(prodDbPath, 'utf8');
    assert.strictEqual(currentProdDbContent, initialProdDbContent, 'db.json must remain completely untouched during tests');
    console.log('✅ Test 5 Passed: db.json file integrity maintained.');

    console.log('\n🎉 ALL CATERING PAYMENT FLOW TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runCateringPaymentFlowTests();
