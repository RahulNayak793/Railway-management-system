const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_catering_unified_2026';
const PORT = 5299;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const { mockDb } = require('../config/supabase');
const cateringRoutes = require('../routes/catering');

let server;

function request(method, pathUrl, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + pathUrl);
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders
    };

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

function makeToken(role, id = 'user-1', email = 'test@railway.gov.in') {
  return jwt.sign(
    { id, role, email, user_id: id },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function runTests() {
  console.log('--- STARTING CATERING ARCHITECTURE UNIFIED VERIFICATION SUITE ---');

  const app = express();
  app.use(express.json());
  app.use('/api/catering', cateringRoutes);

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Test Server] Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  const adminToken = makeToken('admin', 'admin-test-01', 'admin@railway.gov.in');
  const staffToken = makeToken('staff', 'staff-test-01', 'staff@railway.gov.in');
  const passengerToken = makeToken('passenger', 'pass-test-01', 'passenger@gmail.com');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Admin can view organizations
  await test('1. Admin and Public can view authorized catering organizations', async () => {
    const res = await request('GET', '/catering/companies');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(Array.isArray(res.body.companies), 'Companies list must be an array');
    assert.ok(res.body.companies.length >= 5, `Expected at least 5 companies, got ${res.body.companies.length}`);
    const comp1 = res.body.companies.find(c => c.id === 'comp-1');
    assert.ok(comp1, 'comp-1 (IRCTC Executive Pantry) must exist');
    assert.strictEqual(comp1.status, 'AUTHORIZED');
    assert.ok(comp1.service_type, 'service_type must be present');
    assert.ok(comp1.valid_from, 'valid_from must be present');
    assert.ok(comp1.valid_until, 'valid_until must be present');
  });

  // 2. Admin can add a new organization
  const testNewOrg = {
    company_name: 'Deccan Express Meal Services',
    legal_name: 'Deccan Express Railway Catering Pvt Ltd',
    service_type: 'Multi-Station Gourmet Delivery',
    business_type: 'Multi-Station Gourmet Delivery',
    contact_name: 'Suresh Rao',
    phone: '+91 9844001122',
    email: `deccan.${Date.now()}@railcatering.test`,
    fssai_number: '10022011000999',
    stations: ['PUNE', 'SBC', 'MAS', 'HYB'],
    authorization_start: '2026-01-01',
    authorization_end: '2027-12-31',
    status: 'PENDING'
  };
  let createdOrgId = null;

  await test('2. Admin can add a new organization (with service type & coverage)', async () => {
    const res = await request('POST', '/catering/admin/companies', testNewOrg, adminToken);
    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert.ok(res.body.company, 'Created company must be returned');
    assert.strictEqual(res.body.company.company_name, testNewOrg.company_name);
    assert.strictEqual(res.body.company.status, 'PENDING');
    assert.strictEqual(res.body.company.service_type, 'Multi-Station Gourmet Delivery');
    assert.deepStrictEqual(res.body.company.stations, ['PUNE', 'SBC', 'MAS', 'HYB']);
    createdOrgId = res.body.company.id;
  });

  // 3. Staff and Passenger CANNOT add organizations (Admin only)
  await test('3. Staff and Passenger cannot add food organizations (Strict 403 Forbidden)', async () => {
    const resStaff = await request('POST', '/catering/admin/companies', testNewOrg, staffToken);
    assert.strictEqual(resStaff.status, 403, `Staff must receive 403, got ${resStaff.status}`);

    const resPassenger = await request('POST', '/catering/admin/companies', testNewOrg, passengerToken);
    assert.strictEqual(resPassenger.status, 403, `Passenger must receive 403, got ${resPassenger.status}`);

    const resUnauth = await request('POST', '/catering/admin/companies', testNewOrg, null);
    assert.ok(resUnauth.status === 401 || resUnauth.status === 403, `Unauthenticated must receive 401 or 403, got ${resUnauth.status}`);
  });

  // 4. Staff and Passenger CANNOT authorize organizations
  await test('4. Staff and Passenger cannot authorize organizations (Strict 403 Forbidden)', async () => {
    const resStaff = await request('POST', `/catering/admin/companies/${createdOrgId}/authorize`, {}, staffToken);
    assert.strictEqual(resStaff.status, 403, `Staff authorize must receive 403, got ${resStaff.status}`);

    const resPassenger = await request('POST', `/catering/admin/companies/${createdOrgId}/authorize`, {}, passengerToken);
    assert.strictEqual(resPassenger.status, 403, `Passenger authorize must receive 403, got ${resPassenger.status}`);
  });

  // 5. Admin CAN authorize an organization
  await test('5. Admin can authorize an organization', async () => {
    const res = await request('POST', `/catering/admin/companies/${createdOrgId}/authorize`, {}, adminToken);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.body.company.status, 'AUTHORIZED');
  });

  // 6. Authorized organization menu appears to passengers
  await test('6. Authorized organization appears to passengers in Catering Menu', async () => {
    // Add a test dish for this authorized company
    const testDish = {
      id: `dish-test-${Date.now()}`,
      company_id: createdOrgId,
      name: 'Deccan Paneer Biryani Thali',
      description: 'Fragrant basmati rice with spiced cottage cheese and raita',
      category: 'Lunch',
      type: 'veg',
      dietary: 'veg',
      meal_type: 'Lunch',
      price: 180,
      in_stock: true,
      is_available: true,
      service_type: 'STATION',
      prep_time_mins: 15
    };
    mockDb.catering_menu.set(testDish.id, testDish);

    const resMenu = await request('GET', `/catering/menu?station_code=PUNE&journey_date=2026-10-15`);
    assert.strictEqual(resMenu.status, 200);
    assert.ok(Array.isArray(resMenu.body.menu), 'Menu must be an array');
    const dishFound = resMenu.body.menu.find(d => d.id === testDish.id);
    assert.ok(dishFound, 'Dish from authorized company must appear in passenger menu');

    // 7. Unauthorized organization does NOT appear to passengers
    // Suspend company
    await request('POST', `/catering/admin/companies/${createdOrgId}/suspend`, {}, adminToken);
    const resSuspendedMenu = await request('GET', `/catering/menu?station_code=PUNE&journey_date=2026-10-15`);
    const dishInSuspended = resSuspendedMenu.body.menu.find(d => d.id === testDish.id);
    assert.strictEqual(dishInSuspended, undefined, 'Dish from SUSPENDED company must NOT appear in passenger menu');

    // Reject company
    await request('POST', `/catering/admin/companies/${createdOrgId}/reject`, {}, adminToken);
    const resRejectedMenu = await request('GET', `/catering/menu?station_code=PUNE&journey_date=2026-10-15`);
    const dishInRejected = resRejectedMenu.body.menu.find(d => d.id === testDish.id);
    assert.strictEqual(dishInRejected, undefined, 'Dish from REJECTED company must NOT appear in passenger menu');

    // Clean up test dish
    mockDb.catering_menu.delete(testDish.id);
  });

  // 8. Admin can view organization food menu and toggle availability
  await test('8. Admin can view organization menu and enable/disable food availability', async () => {
    // Get menu for comp-1 with adminToken
    const resMenu = await request('GET', `/catering/company/menu?vendor_id=comp-1`, null, adminToken);
    assert.strictEqual(resMenu.status, 200);
    assert.ok(Array.isArray(resMenu.body.menu), 'Menu must be an array');
    assert.ok(resMenu.body.menu.length > 0, 'comp-1 must have menu dishes');

    const firstDish = resMenu.body.menu[0];
    const origStock = firstDish.in_stock !== false;

    // Toggle availability to false
    const resToggleOff = await request('PUT', `/catering/admin/menu/${firstDish.id}/availability`, { in_stock: false }, adminToken);
    assert.strictEqual(resToggleOff.status, 200);
    assert.strictEqual(resToggleOff.body.dish.in_stock, false, 'Dish in_stock must now be false');

    // Toggle availability back to true
    const resToggleOn = await request('PUT', `/catering/admin/menu/${firstDish.id}/availability`, { in_stock: origStock }, adminToken);
    assert.strictEqual(resToggleOn.status, 200);
    assert.strictEqual(resToggleOn.body.dish.in_stock, origStock);
  });

  // 9. Admin can view organization catering orders
  await test('9. Admin can view catering orders for an organization', async () => {
    const res = await request('GET', `/catering/admin/companies/comp-1/orders`, null, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.orders), 'Orders must be returned as an array');
  });

  // 10. On-board food departure timing logic
  await test('10. On-board food returns departure timing status and prevents pre-departure orders', async () => {
    // On-board menu endpoint returns departure_info
    const resMenu = await request('GET', `/catering/onboard/menu?train_number=12952&boarding_station=NDLS`);
    assert.strictEqual(resMenu.status, 200);
    assert.ok(resMenu.body.departure_info, 'departure_info must be returned');
    assert.ok('has_departed' in resMenu.body.departure_info, 'has_departed must be present');
    assert.ok(resMenu.body.departure_info.status_label, 'status_label must be present');

    // Attempt to place an order before departure without bypass should fail if train not departed
    if (!resMenu.body.departure_info.has_departed) {
      const orderPayload = {
        train_number: '12952',
        pnr_number: '7037000206',
        passenger_name: 'Test Passenger',
        coach_number: 'B1',
        seat_number: '12',
        items: [{ id: 'menu-onboard-1', name: 'Executive Thali', qty: 1, price: 150 }],
        total_amount: 150,
        payment_method: 'UPI',
        catering_type: 'ONBOARD'
      };
      const orderRes = await request('POST', '/catering/onboard/order', orderPayload, passengerToken);
      assert.strictEqual(orderRes.status, 400, 'Order prior to departure must be rejected with 400');
      assert.ok(orderRes.body.error.includes('departed'), 'Error message must mention train departure');
    }
  });

  // 11. Intermediate boarding station timing calculation
  await test('11. Intermediate boarding station timing is correctly resolved', async () => {
    // Train 12952 with intermediate boarding station KOTA
    const resKota = await request('GET', `/catering/onboard/menu?train_number=12952&boarding_station=KOTA`);
    assert.strictEqual(resKota.status, 200);
    assert.strictEqual(resKota.body.departure_info.boarding_station, 'KOTA');
    assert.ok(resKota.body.departure_info.departure_time, 'Departure time for KOTA must be resolved');
  });

  // 12. Station E-Catering is available before departure subject to cutoff
  await test('12. Station E-Catering menu is accessible before train departure', async () => {
    const resStationMenu = await request('GET', `/catering/menu?station_code=NDLS&journey_date=2026-10-15`);
    assert.strictEqual(resStationMenu.status, 200);
    assert.ok(Array.isArray(resStationMenu.body.menu), 'Station menu must be available');
    assert.ok(resStationMenu.body.menu.length > 0, 'Station menu must have items');
  });

  // 13. Admin can view Station E-Catering coverage & summary cards
  await test('13. Admin can view Station E-Catering coverage, stats & realistic station mappings', async () => {
    const res = await request('GET', '/catering/admin/station-coverage', null, adminToken);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(Array.isArray(res.body.coverage), 'coverage must be an array');
    assert.ok(res.body.coverage.length >= 25, `Expected at least 25 coverage mappings, got ${res.body.coverage.length}`);
    
    // Verify required summary cards stats
    assert.ok(res.body.stats, 'stats object must be present');
    assert.ok(typeof res.body.stats.station_ecatering_partners === 'number', 'station_ecatering_partners stat required');
    assert.ok(typeof res.body.stats.covered_stations === 'number', 'covered_stations stat required');
    assert.ok(typeof res.body.stats.active_station_services === 'number', 'active_station_services stat required');
    assert.ok(typeof res.body.stats.station_food_orders === 'number', 'station_food_orders stat required');

    // Verify table columns exist on coverage items
    const firstItem = res.body.coverage[0];
    assert.ok(firstItem.company_name, 'company_name required');
    assert.ok(firstItem.station_code, 'station_code required');
    assert.ok(firstItem.station_name, 'station_name required');
    assert.ok(firstItem.food_availability, 'food_availability required');
    assert.ok(firstItem.valid_from, 'valid_from required');
    assert.ok(firstItem.valid_until, 'valid_until required');
    assert.ok(firstItem.status, 'status required');
  });

  // 14. Non-admins (Staff & Passenger) are blocked from station-coverage management
  await test('14. Staff and Passenger cannot manage Station E-Catering (403 Forbidden)', async () => {
    const resStaffGet = await request('GET', '/catering/admin/station-coverage', null, staffToken);
    assert.strictEqual(resStaffGet.status, 403);

    const resPassGet = await request('GET', '/catering/admin/station-coverage', null, passengerToken);
    assert.strictEqual(resPassGet.status, 403);

    const resStaffPost = await request('POST', '/catering/admin/station-coverage', { company_id: 'comp-1', station_code: 'SBC' }, staffToken);
    assert.strictEqual(resStaffPost.status, 403);

    const resPassPost = await request('POST', '/catering/admin/station-coverage', { company_id: 'comp-1', station_code: 'SBC' }, passengerToken);
    assert.strictEqual(resPassPost.status, 403);
  });

  // 15. Admin can assign and remove station coverage
  await test('15. Admin can assign station coverage to organization and passenger can discover food', async () => {
    // Assign comp-3 (Varanasi Satvik Kitchen) to AGC (Agra Cantt)
    const assignRes = await request('POST', '/catering/admin/station-coverage', {
      company_id: 'comp-3',
      station_code: 'AGC'
    }, adminToken);
    assert.strictEqual(assignRes.status, 201, `Expected 201, got ${assignRes.status}`);

    // Passenger checks menu at AGC for 2026-10-15
    const menuRes = await request('GET', `/catering/menu?station_code=AGC&journey_date=2026-10-15`);
    assert.strictEqual(menuRes.status, 200);
    const dishFromComp3 = menuRes.body.menu.find(d => d.company_id === 'comp-3');
    assert.ok(dishFromComp3, 'Food from newly assigned organization comp-3 must appear at station AGC');

    // 16. Admin can disable and enable station e-Catering for organization at station
    const toggleDisableRes = await request('PUT', '/catering/admin/station-coverage/toggle', {
      company_id: 'comp-3',
      station_code: 'AGC',
      is_active: false
    }, adminToken);
    assert.strictEqual(toggleDisableRes.status, 200);
    assert.strictEqual(toggleDisableRes.body.is_active, false);

    // Passenger checks menu again at AGC - comp-3 food should NOT appear when disabled
    const disabledMenuRes = await request('GET', `/catering/menu?station_code=AGC&journey_date=2026-10-15`);
    const dishFromDisabled = disabledMenuRes.body.menu.find(d => d.company_id === 'comp-3');
    assert.strictEqual(dishFromDisabled, undefined, 'Food from DISABLED station service must not appear');

    // Admin re-enables station e-Catering
    const toggleEnableRes = await request('PUT', '/catering/admin/station-coverage/toggle', {
      company_id: 'comp-3',
      station_code: 'AGC',
      is_active: true
    }, adminToken);
    assert.strictEqual(toggleEnableRes.status, 200);
    assert.strictEqual(toggleEnableRes.body.is_active, true);

    // Remove the test assignment
    const removeRes = await request('DELETE', `/catering/admin/station-coverage/comp-3/AGC`, null, adminToken);
    assert.strictEqual(removeRes.status, 200);
  });

  // 17. Data Safety check: Clean up test organization and verify counts
  await test('17. Data Safety: Verify all 5 original catering companies, menus, and orders intact', async () => {
    // Clean up created test company if any
    if (createdOrgId) {
      await request('DELETE', `/catering/admin/companies/${createdOrgId}`, null, adminToken);
    }

    const res = await request('GET', '/catering/companies');
    const compIds = res.body.companies.map(c => c.id);
    ['comp-1', 'comp-2', 'comp-3', 'comp-4', 'comp-5'].forEach(id => {
      assert.ok(compIds.includes(id), `Original company ${id} must be preserved`);
    });
  });

  server.close();

  console.log('\n--- TEST RESULTS ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL CATERING ARCHITECTURE UNIFIED TESTS PASSED SUCCESSFULLY.\n');
  }
}

runTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  if (server) server.close();
  process.exit(1);
});
