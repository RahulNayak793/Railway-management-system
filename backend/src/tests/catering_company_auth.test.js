const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.JWT_SECRET = 'test_jwt_secret_key_1234567890';
const PORT = 5198;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const { mockDb } = require('../config/supabase');
const cateringRoutes = require('../routes/catering');
const adminRoutes = require('../routes/admin');
const staffRoutes = require('../routes/staff');

let server;

function request(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + pathUrl);
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
}

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/catering', cateringRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/staff', staffRoutes);

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Catering Integration Test Server] Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  console.log('\n========================================================================');
  console.log('  RUNNING 20-SCENARIO ADMIN ↔ CATERING COMPANY PORTAL INTEGRATION SUITE');
  console.log('========================================================================\n');

  try {
    const adminToken = makeToken({ id: 'usr-admin-test', email: 'admin@railway.com', role: 'admin' });
    const runUid = Date.now();
    const testCompEmail = `feast_${runUid}@delhiexpress.com`;
    const updatedCompEmail = `updated_${runUid}@delhiexpress.com`;

    // 1. Admin creates company
    const createRes = await request('POST', '/admin/catering-companies', {
      company_name: 'Northern Rail Feast',
      legal_name: 'Northern Rail Feast Pvt Ltd',
      email: testCompEmail,
      password: 'Feast@Pass123',
      stations: ['NDLS', 'CNB'],
      authorization_start: '2025-01-01',
      authorization_end: '2027-12-31',
      status: 'ACTIVE'
    }, adminToken);
    assert.strictEqual(createRes.status, 201, 'Admin must authorize company with 201 Created');
    assert.ok(createRes.body.company && createRes.body.company.id);
    const createdCompId = createRes.body.company.id;
    console.log('✓ 1. Admin creates company');

    // 2. Company appears in Admin list
    const adminListRes = await request('GET', '/admin/catering-companies', null, adminToken);
    assert.strictEqual(adminListRes.status, 200);
    const foundInList = adminListRes.body.companies.find(c => c.id === createdCompId);
    assert.ok(foundInList, 'Created company must appear in admin list');
    assert.strictEqual(foundInList.email, testCompEmail);
    assert.deepStrictEqual(foundInList.stations, ['NDLS', 'CNB']);
    console.log('✓ 2. Company appears in Admin list');

    // 3. Created email can login
    const loginRes = await request('POST', '/catering/auth/login', {
      email: testCompEmail,
      password: 'Feast@Pass123'
    });
    assert.strictEqual(loginRes.status, 200, 'Created email must login with 200');
    assert.strictEqual(loginRes.body.success, true);
    assert.ok(loginRes.body.token, 'Token must be issued upon successful login');
    assert.strictEqual(loginRes.body.user.role, 'CATERING_COMPANY');
    assert.strictEqual(loginRes.body.user.company_id, createdCompId);
    let compAToken = loginRes.body.token;
    console.log('✓ 3. Created email can login');

    // 4. Created password works
    const decodedToken = jwt.decode(compAToken);
    assert.strictEqual(decodedToken.role, 'CATERING_COMPANY');
    assert.strictEqual(decodedToken.company_id, createdCompId);
    console.log('✓ 4. Created password works');

    // 5. Wrong email rejected
    const wrongEmailRes = await request('POST', '/catering/auth/login', {
      email: 'nonexistent@randomvendor.com',
      password: 'Feast@Pass123'
    });
    assert.strictEqual(wrongEmailRes.status, 401, 'Unknown email must be rejected with 401');
    console.log('✓ 5. Wrong email rejected');

    // 6. Wrong password rejected
    const wrongPassRes = await request('POST', '/catering/auth/login', {
      email: testCompEmail,
      password: 'WrongPassword999'
    });
    assert.strictEqual(wrongPassRes.status, 401, 'Wrong password must be rejected with 401');
    console.log('✓ 6. Wrong password rejected');

    // 7. Suspended company rejected
    await request('POST', `/admin/catering-companies/${createdCompId}/suspend`, null, adminToken);
    const suspendedLoginAttempt = await request('POST', '/catering/auth/login', {
      email: testCompEmail,
      password: 'Feast@Pass123'
    });
    assert.strictEqual(suspendedLoginAttempt.status, 403, 'Suspended company login must return 403');
    // Restore to ACTIVE for subsequent tests
    await request('POST', `/admin/catering-companies/${createdCompId}/authorize`, null, adminToken);
    console.log('✓ 7. Suspended company rejected');

    // 8. Expired company rejected
    mockDb.catering_companies.set('comp-test-expired', {
      id: 'comp-test-expired',
      company_name: 'Expired Foods Ltd',
      email: 'expired@partner.com',
      login_email: 'expired@partner.com',
      status: 'ACTIVE',
      authorization_start: '2020-01-01',
      authorization_end: '2022-01-01', // Past date
      stations: ['NDLS']
    });
    const expiredLoginAttempt = await request('POST', '/catering/auth/login', {
      email: 'expired@partner.com',
      password: 'Catering@123'
    });
    assert.strictEqual(expiredLoginAttempt.status, 403, 'Expired company login must return 403');
    console.log('✓ 8. Expired company rejected');

    // 9. Admin email change invalidates old email
    const emailChangeRes = await request('PUT', `/admin/catering-companies/${createdCompId}`, {
      email: updatedCompEmail
    }, adminToken);
    assert.strictEqual(emailChangeRes.status, 200);

    const oldEmailLogin = await request('POST', '/catering/auth/login', {
      email: testCompEmail,
      password: 'Feast@Pass123'
    });
    assert.strictEqual(oldEmailLogin.status, 401, 'Old email must be rejected with 401 after admin change');
    console.log('✓ 9. Admin email change invalidates old email');

    // 10. New email works
    const newEmailLogin = await request('POST', '/catering/auth/login', {
      email: updatedCompEmail,
      password: 'Feast@Pass123'
    });
    assert.strictEqual(newEmailLogin.status, 200, 'New email must login successfully');
    compAToken = newEmailLogin.body.token;
    console.log('✓ 10. New email works');

    // 11. Admin station change appears in catering portal
    await request('PUT', `/admin/catering-companies/${createdCompId}`, {
      stations: ['NDLS', 'CNB', 'AGC']
    }, adminToken);
    const stationViewRes = await request('GET', '/catering/company/stations', null, compAToken);
    assert.strictEqual(stationViewRes.status, 200);
    assert.deepStrictEqual(stationViewRes.body.stations, ['NDLS', 'CNB', 'AGC'], 'Portal must reflect updated station authorizations');
    console.log('✓ 11. Admin station change appears in catering portal');

    // 12. Admin password change works
    await request('PUT', `/admin/catering-companies/${createdCompId}`, {
      password: 'UpdatedSecret@789'
    }, adminToken);

    const oldPassAttempt = await request('POST', '/catering/auth/login', {
      email: updatedCompEmail,
      password: 'Feast@Pass123'
    });
    assert.strictEqual(oldPassAttempt.status, 401, 'Old password must be rejected after admin change');

    const newPassAttempt = await request('POST', '/catering/auth/login', {
      email: updatedCompEmail,
      password: 'UpdatedSecret@789'
    });
    assert.strictEqual(newPassAttempt.status, 200, 'New password must succeed');
    compAToken = newPassAttempt.body.token;
    console.log('✓ 12. Admin password change works');

    // Setup Company B for isolation tests
    const compBId = 'comp-test-b';
    mockDb.catering_companies.set(compBId, {
      id: compBId,
      company_name: 'Western Dining B',
      email: 'vendorB@partner.com',
      login_email: 'vendorB@partner.com',
      password: 'Catering@123',
      status: 'ACTIVE',
      authorization_start: '2024-01-01',
      authorization_end: '2028-01-01',
      stations: ['MMCT', 'BPL']
    });
    const compBLogin = await request('POST', '/catering/auth/login', {
      email: 'vendorB@partner.com',
      password: 'Catering@123'
    });
    assert.strictEqual(compBLogin.status, 200);
    const compBToken = compBLogin.body.token;

    // Company A creates a dish
    const dishARes = await request('POST', '/catering/company/menu', {
      name: 'Northern Feast Deluxe Thali',
      price: 270,
      category: 'Meals',
      type: 'veg'
    }, compAToken);
    assert.strictEqual(dishARes.status, 201);
    const dishAId = dishARes.body.item.id;

    // Company B creates a dish
    const dishBRes = await request('POST', '/catering/company/menu', {
      name: 'Western Mumbai Fish Fry Box',
      price: 320,
      category: 'Meals',
      type: 'non-veg'
    }, compBToken);
    assert.strictEqual(dishBRes.status, 201);
    const dishBId = dishBRes.body.item.id;

    // 13. Company sees only its own menu
    const compAMenuRes = await request('GET', '/catering/company/menu', null, compAToken);
    assert.strictEqual(compAMenuRes.status, 200);
    const compAItemIds = compAMenuRes.body.menu.map(m => m.id);
    assert.ok(compAItemIds.includes(dishAId), 'Company A must see its own dish');
    assert.ok(!compAItemIds.includes(dishBId), 'Company A must NOT see Company B dish');
    console.log('✓ 13. Company sees only its own menu');

    // Create Order for Company A and Order for Company B
    const orderA = {
      order_id: `ord-a-${runUid}`,
      company_id: createdCompId,
      pnr: '1111111111',
      train_number: '12051',
      total_amount: 270,
      status: 'ACCEPTED'
    };
    const orderB = {
      order_id: `ord-b-${runUid}`,
      company_id: compBId,
      pnr: '2222222222',
      train_number: '12051',
      total_amount: 320,
      status: 'ACCEPTED'
    };
    mockDb.catering_orders = mockDb.catering_orders || new Map();
    mockDb.catering_orders.set(orderA.order_id, orderA);
    mockDb.catering_orders.set(orderB.order_id, orderB);

    // 14. Company sees only its own orders
    const compAOrdersRes = await request('GET', '/catering/company/orders', null, compAToken);
    assert.strictEqual(compAOrdersRes.status, 200);
    const compAOrderIds = compAOrdersRes.body.orders.map(o => o.order_id || o.id);
    assert.ok(compAOrderIds.includes(orderA.order_id), 'Company A must see order A');
    assert.ok(!compAOrderIds.includes(orderB.order_id), 'Company A must NOT see order B');
    console.log('✓ 14. Company sees only its own orders');

    // 15. Company cannot access another company's data
    // Company A attempts to modify Company B dish
    const compAEditDishB = await request('PUT', `/catering/company/menu/${dishBId}`, {
      name: 'Tampered Name',
      price: 10
    }, compAToken);
    assert.strictEqual(compAEditDishB.status, 403, 'Company A cannot modify Company B dish');

    // Company A attempts to delete Company B dish
    const compADelDishB = await request('DELETE', `/catering/company/menu/${dishBId}`, null, compAToken);
    assert.strictEqual(compADelDishB.status, 403, 'Company A cannot delete Company B dish');

    // Company A attempts to update Company B order
    const compAEditOrderB = await request('PUT', `/catering/company/orders/${orderB.order_id}/status`, {
      status: 'CANCELLED'
    }, compAToken);
    assert.strictEqual(compAEditOrderB.status, 403, 'Company A cannot modify Company B order');

    // Company A attempts to spoof another company_id via query
    const spoofAttempt = await request('GET', `/catering/company/menu?company_id=${compBId}`, null, compAToken);
    assert.strictEqual(spoofAttempt.status, 403, 'Spoofing alien company_id must return 403');
    console.log("✓ 15. Company cannot access another company's data");

    // 16. Staff cannot access catering portal
    const staffToken = makeToken({ id: 'usr-staff-test', email: 'staff@railway.com', role: 'staff' });
    const staffAccessRes = await request('GET', '/catering/company/menu', null, staffToken);
    assert.strictEqual(staffAccessRes.status, 403, 'Staff must be blocked with 403 from catering portal');
    console.log('✓ 16. Staff cannot access catering portal');

    // 17. Passenger cannot access catering portal
    const passengerToken = makeToken({ id: 'usr-passenger-test', email: 'passenger@railway.com', role: 'passenger' });
    const passAccessRes = await request('GET', '/catering/company/menu', null, passengerToken);
    assert.strictEqual(passAccessRes.status, 403, 'Passenger must be blocked with 403 from catering portal');
    console.log('✓ 17. Passenger cannot access catering portal');

    // 18. Admin can activate/suspend company
    // Suspend Company A
    await request('POST', `/admin/catering-companies/${createdCompId}/suspend`, null, adminToken);
    const suspendedPortalAccess = await request('GET', '/catering/company/menu', null, compAToken);
    assert.strictEqual(suspendedPortalAccess.status, 403, 'Suspended company token must be rejected with 403 on portal API');

    // Reactivate Company A
    await request('POST', `/admin/catering-companies/${createdCompId}/authorize`, null, adminToken);
    const reactivatedPortalAccess = await request('GET', '/catering/company/menu', null, compAToken);
    assert.strictEqual(reactivatedPortalAccess.status, 200, 'Reactivated company token must succeed on portal API');
    console.log('✓ 18. Admin can activate/suspend company');

    // 19. Historical orders remain after company suspension/deactivation
    await request('POST', `/admin/catering-companies/${createdCompId}/suspend`, null, adminToken);
    const historicalOrderA = mockDb.catering_orders.get(orderA.order_id);
    assert.ok(historicalOrderA, 'Historical orders must NOT be deleted when company is suspended');
    assert.strictEqual(historicalOrderA.total_amount, 270);
    // Reactivate for station testing
    await request('POST', `/admin/catering-companies/${createdCompId}/authorize`, null, adminToken);
    console.log('✓ 19. Historical orders remain after company suspension/deactivation');

    // 20. Passenger menu authorization still works from Admin-controlled station assignments
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
    const testPnr = '99' + String(Date.now()).slice(-8);
    const passBooking = {
      id: `bk-pass-${testPnr}`,
      booking_id: `bk-pass-${testPnr}`,
      pnr_number: testPnr,
      passenger_id: 'usr-passenger-test',
      user_id: 'usr-passenger-test',
      passenger_name: 'Test Passenger',
      passenger_email: 'passenger@railway.com',
      train_number: '12051',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: '3A',
      status: 'confirmed',
      booking_status: 'CONFIRMED',
      payment_status: 'PAID'
    };
    mockDb.bookings = mockDb.bookings || new Map();
    mockDb.bookings.set(passBooking.id, passBooking);
    mockDb.bookings.set(passBooking.pnr_number, passBooking);
    mockDb.profiles.set('usr-passenger-test', {
      id: 'usr-passenger-test',
      email: 'passenger@railway.com',
      role: 'passenger',
      full_name: 'Test Passenger'
    });

    // Station NDLS is assigned to Company A -> Company A dish should be available
    const ndlsMenuRes = await request('GET', `/catering/menu?pnr=${passBooking.pnr_number}&station_code=NDLS`, null, passengerToken);
    assert.strictEqual(ndlsMenuRes.status, 200);
    assert.ok(Array.isArray(ndlsMenuRes.body.menu));
    const availableDishesNdls = ndlsMenuRes.body.menu;
    assert.ok(availableDishesNdls.length > 0, 'Authorized NDLS station must provide meal options');
    console.log('✓ 20. Passenger menu authorization still works from Admin-controlled station assignments');

    console.log('\n🎉 ALL 20 / 20 ADMIN ↔ CATERING COMPANY INTEGRATION TESTS PASSED! 🎉\n');
  } finally {
    if (server) {
      server.close();
      console.log('🔌 Test server stopped.');
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
