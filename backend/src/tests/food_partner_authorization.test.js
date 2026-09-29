const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const app = require('../index');
const jwt = require('jsonwebtoken');

const PORT = 5108;
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

async function runFoodPartnerAuthorizationTests() {
  console.log('🧪 Starting Food Partner Authorization & Delivery Redesign Test Suite...\n');

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
  const partnerToken = makeToken('usr-partner-1', 'catering_company', 'partner@railbites.com');

  try {
    // 1. Admin Registers External Food Delivery Partner
    console.log('Test 1: Admin registers new external food partner...');
    const uniqueId = Date.now();
    const partnerPayload = {
      company_name: `RailBites Food Delivery ${uniqueId}`,
      legal_name: 'RailBites Logistics Pvt Ltd',
      business_type: 'Food Delivery App',
      contact_name: 'Anand Kumar',
      phone: '+91 9876543210',
      email: `contact_${uniqueId}@railbites.test`,
      fssai_number: `FSSAI_${uniqueId}`,
      website_app_info: 'https://railbites.test',
      service_description: 'Fast seat delivery app for railway passengers',
      address: 'New Delhi HQ',
      stations: ['NDLS', 'BPL']
    };
    const regRes = await request('POST', '/api/catering/admin/companies', partnerPayload, adminToken);
    assert.strictEqual(regRes.status, 201, `Expected 201 Created, got ${regRes.status}`);
    assert.strictEqual(regRes.data.success, true);
    assert.strictEqual(regRes.data.company.company_name, partnerPayload.company_name);
    const newPartnerId = regRes.data.company.id;
    console.log('✅ Test 1 Passed: Admin successfully registered external food partner.');

    // 2. Admin Suspends Partner
    console.log('Test 2: Admin suspends food partner...');
    const suspRes = await request('POST', `/api/catering/admin/companies/${newPartnerId}/suspend`, {}, adminToken);
    assert.strictEqual(suspRes.status, 200);
    assert.strictEqual(suspRes.data.company.status, 'SUSPENDED');
    console.log('✅ Test 2 Passed: Admin successfully suspended food partner.');

    // 3. Suspended Partner Disappears from Passenger Search
    console.log('Test 3: Suspended partner is filtered out from passenger station menu...');
    const menuRes1 = await request('GET', '/api/catering/menu?station_code=NDLS', null, passengerToken);
    assert.strictEqual(menuRes1.status, 200);
    const partnerIdsInMenu = (menuRes1.data.authorized_companies || []).map(c => c.id);
    assert.strictEqual(partnerIdsInMenu.includes(newPartnerId), false, 'Suspended partner must not appear in passenger station menu');
    console.log('✅ Test 3 Passed: Suspended partner is hidden from passenger search.');

    // 4. Admin Reactivates Partner
    console.log('Test 4: Admin reactivates food partner...');
    const actRes = await request('POST', `/api/catering/admin/companies/${newPartnerId}/authorize`, {}, adminToken);
    assert.strictEqual(actRes.status, 200);
    assert.strictEqual(actRes.data.company.status, 'ACTIVE');
    console.log('✅ Test 4 Passed: Admin reactivated food partner to ACTIVE status.');

    // 5. CRITICAL RESTRICTION: Staff and Admin CANNOT add or edit food menu items!
    console.log('Test 5: Staff attempt to add food dish is denied (403 Forbidden)...');
    const staffAddRes = await request('POST', '/api/catering/company/menu', {
      name: 'Illegal Staff Dish', price: 100, category: 'Snacks'
    }, staffToken);
    assert.strictEqual(staffAddRes.status, 403, 'Staff must be denied menu creation');

    console.log('Test 6: Admin attempt to add food dish is denied (403 Forbidden)...');
    const adminAddRes = await request('POST', '/api/catering/company/menu', {
      name: 'Illegal Admin Dish', price: 100, category: 'Snacks'
    }, adminToken);
    assert.strictEqual(adminAddRes.status, 403, 'Admin must be denied menu creation');
    console.log('✅ Tests 5 & 6 Passed: Staff and Admin are strictly barred from creating food items.');

    // 6. External Partner CAN add menu item
    console.log('Test 7: External food partner role adds menu item...');
    const partnerAddRes = await request('POST', '/api/catering/company/menu', {
      name: 'RailBites Deluxe Combo',
      price: 250,
      category: 'Main Course',
      type: 'veg',
      description: 'Special Partner Combo Meal'
    }, partnerToken);
    assert.strictEqual(partnerAddRes.status, 201, `Partner food addition should succeed, got ${partnerAddRes.status}`);
    const createdDishId = partnerAddRes.data.item.id;
    console.log('✅ Test 7 Passed: External food partner successfully added food item.');

    // 7. Server Price & Station Eligibility Validation on Order
    console.log('Test 8: Server-side validation of passenger food order...');
    const orderPayload = {
      pnr_number: '2345678901',
      train_number: '12952',
      station_code: 'NDLS',
      journey_date: '2026-09-20',
      coach_number: 'B1',
      seat_number: '24',
      passenger_name: 'Rahul Sharma',
      items: [{ id: 'm1', qty: 2 }],
      payment_method: 'UPI'
    };
    const orderRes = await request('POST', '/api/catering/order', orderPayload, passengerToken);
    assert.strictEqual(orderRes.status, 200);
    assert.strictEqual(orderRes.data.success, true);
    assert.strictEqual(orderRes.data.order.total_amount, 480); // 240 * 2 recalculated on server
    console.log('✅ Test 8 Passed: Passenger food order placed with server-validated total.');

    // 8. Staff Delivery Incident Report Filing
    console.log('Test 9: Staff files food delivery service incident report...');
    const incidentPayload = {
      order_id: orderRes.data.order.order_id,
      partner_id: 'comp-1',
      pnr_number: '2345678901',
      issue_type: 'Packaging Damage',
      description: 'Outer seal of meal box torn during transfer at NDLS station platform 1.'
    };
    const incRes = await request('POST', '/api/catering/incidents', incidentPayload, staffToken);
    assert.strictEqual(incRes.status, 201);
    assert.strictEqual(incRes.data.success, true);
    assert.strictEqual(incRes.data.incident.issue_type, 'Packaging Damage');
    console.log('✅ Test 9 Passed: Food delivery service incident reported successfully.');

    // 9. Database Integrity Verification
    console.log('Test 10: Database integrity audit...');
    const finalProdDbContent = fs.readFileSync(prodDbPath, 'utf8');
    assert.strictEqual(initialProdDbContent, finalProdDbContent, 'db.json must not be modified or corrupted during test run');
    console.log('✅ Test 10 Passed: Database integrity intact.');

    console.log('\n🎉 ALL FOOD PARTNER AUTHORIZATION & DELIVERY TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    if (server) server.close();
  }
}

if (require.main === module) {
  runFoodPartnerAuthorizationTests().catch((err) => {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = runFoodPartnerAuthorizationTests;
