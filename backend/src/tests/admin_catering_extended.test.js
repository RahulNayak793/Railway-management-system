const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.JWT_SECRET = 'mock-jwt-secret-key-32-characters-long';
const PORT = 5388;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const { mockDb } = require('../config/supabase');
const cateringRoutes = require('../routes/catering');

const adminToken = jwt.sign({ id: 'usr-admin-1', role: 'admin', name: 'Railway Director (Admin)' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const staffToken = jwt.sign({ id: 'usr-staff-1', role: 'staff', name: 'Train Superintendant' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const passengerToken = jwt.sign({ id: 'usr-pass-1', role: 'passenger', name: 'Passenger User' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const app = express();
app.use(express.json());
app.use('/api/catering', cateringRoutes);

let server;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
}

function request(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + pathUrl);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING ADMIN CATERING EXTENDED TESTS ---');
  await startServer();

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Check all companies and dummy companies exist
    const resComps = await request('GET', '/catering/companies', null, adminToken);
    assert(resComps.status === 200, 'Companies endpoint returned 200');
    assert(resComps.data.companies && resComps.data.companies.length >= 7, `Expected at least 7 catering companies, got ${resComps.data?.companies?.length}`);
    console.log('    Found companies in DB:', resComps.data?.companies?.map(c => ({ id: c.id, name: c.company_name, status: c.status })));
    const purvanchal = resComps.data.companies.find(c => c.company_name?.includes('Purvanchal') || c.id === 'comp-6');
    assert(Boolean(purvanchal), 'Purvanchal Rail Rasoi exists in database');
    const punjab = resComps.data.companies.find(c => c.company_name?.includes('Punjab') || c.id === 'comp-7');
    assert(Boolean(punjab), 'Punjab Mail Kitchens exists in database');

    // 2. Authorize company (comp-6)
    const resAuth = await request('POST', '/catering/admin/companies/comp-6/authorize', null, adminToken);
    assert(resAuth.status === 200 && resAuth.data.company.status === 'AUTHORIZED', 'Admin successfully authorized comp-6');

    // 3. Suspend comp-6
    const resSusp = await request('POST', '/catering/admin/companies/comp-6/suspend', null, adminToken);
    assert(resSusp.status === 200 && resSusp.data.company.status === 'SUSPENDED', 'Admin successfully suspended comp-6');

    // 4. Admin Add Dish to comp-6 menu
    const newDishPayload = {
      company_id: 'comp-6',
      name: 'Special Banarasi Kheer Delight',
      price: 120,
      category: 'Desserts',
      type: 'veg',
      description: 'Rich slow-simmered basmati rice and dry fruit pudding',
      prep_time_mins: 15
    };
    const resAddDish = await request('POST', '/catering/admin/menu', newDishPayload, adminToken);
    assert(resAddDish.status === 201 && resAddDish.data.dish?.name === 'Special Banarasi Kheer Delight', 'Admin added dish to comp-6 menu');
    const createdDishId = resAddDish.data.dish.id;

    // 5. Toggle Dish Availability
    const resToggleDish = await request('PUT', `/catering/admin/menu/${createdDishId}/availability`, { in_stock: false, is_available: false }, adminToken);
    assert(resToggleDish.status === 200 && resToggleDish.data.dish.in_stock === false, 'Admin toggled dish availability to false');

    // 6. Delete Dish
    const resDelDish = await request('DELETE', `/catering/admin/menu/${createdDishId}`, null, adminToken);
    assert(resDelDish.status === 200, 'Admin deleted dish from menu');

    // 7. Check Station Coverage Stats
    const resCov = await request('GET', '/catering/admin/station-coverage', null, adminToken);
    assert(resCov.status === 200, 'Station coverage returns 200');
    assert(resCov.data.stats && resCov.data.stats.covered_stations >= 20, `Stats show ${resCov.data.stats?.covered_stations} covered stations`);
    assert(resCov.data.coverage && resCov.data.coverage.length >= 40, `Coverage mappings count: ${resCov.data.coverage?.length}`);

    // 8. Manifest Orders
    const resManifest = await request('GET', '/catering/all-orders', null, adminToken);
    assert(resManifest.status === 200 && resManifest.data.orders.length >= 15, `Manifest orders count: ${resManifest.data?.orders?.length}`);

    // 9. Update Order Status
    const targetOrder = resManifest.data.orders[0];
    const resStatusUpdate = await request('PUT', `/catering/orders/${targetOrder.order_id}/status`, { status: 'DELIVERED', delivery_status: 'Delivered to Seat 24' }, staffToken);
    assert(resStatusUpdate.status === 200 && resStatusUpdate.data.order.status === 'DELIVERED', `Staff updated order #${targetOrder.order_id} status to DELIVERED`);

    // 10. Admin Register Temporary Company and Delete It
    const tempComp = {
      company_name: 'Test Temporary Catering',
      legal_name: 'Test Temp Pvt Ltd',
      email: 'temptest@railcatering.in',
      phone: '9888877777',
      stations: ['NDLS', 'BPL']
    };
    const resCreateTemp = await request('POST', '/catering/admin/companies', tempComp, adminToken);
    assert(resCreateTemp.status === 201, 'Admin created temporary company');
    const tempId = resCreateTemp.data.company.id;

    const resDelTemp = await request('DELETE', `/catering/admin/companies/${tempId}`, null, adminToken);
    assert(resDelTemp.status === 200, 'Admin deleted temporary company');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await stopServer();
    console.log(`\n--- EXTENDED TEST RESULTS ---`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    if (failed > 0) process.exit(1);
  }
}

runTests();
