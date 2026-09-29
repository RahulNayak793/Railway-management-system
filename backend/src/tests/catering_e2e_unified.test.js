const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_1234567890';
const PORT = 5299;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const cateringRoutes = require('../routes/catering');

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
  return jwt.sign(payload, process.env.JWT_SECRET);
}

async function runTests() {
  console.log('--- Starting Unified Catering E2E Flow Tests ---');

  // Setup express app
  const app = express();
  app.use(express.json());
  app.use('/api/catering', cateringRoutes);

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  const adminToken = makeToken({ id: 'usr-admin-1', role: 'admin', email: 'admin@railway.gov.in' });
  const staffToken = makeToken({ id: 'stf-1', role: 'staff', email: 'staff@railway.gov.in' });
  const comp1Token = makeToken({ id: 'usr-pantry-comp-1', company_id: 'comp-1', catering_company_id: 'comp-1', role: 'CATERING_COMPANY', email: 'pantry@irctc.co.in' });
  const comp2Token = makeToken({ id: 'usr-comp-2', company_id: 'comp-2', catering_company_id: 'comp-2', role: 'CATERING_COMPANY', email: 'contact@mpcatering.com' });
  const sampleBooking = Array.from(mockDb.bookings.values()).find(b => b.status === 'confirmed' && b.pnr_number) || Array.from(mockDb.bookings.values())[0];
  assert.ok(sampleBooking, 'Booking record must exist');
  const passengerToken = makeToken({
    id: sampleBooking.passenger_id || sampleBooking.user_id || 'usr-1',
    role: 'passenger',
    email: sampleBooking.passenger_email || 'passenger@railcontrol.in',
    full_name: sampleBooking.passenger_name || 'Rahul Sharma'
  });

  try {
    // 1. Check partner seeding
    console.log('TEST 1: Partner Seeding & Isolation');
    const res1 = await request('GET', '/catering/company/menu', null, comp1Token);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.success, true);
    assert.ok(res1.body.menu.length > 0, 'comp-1 should have menu dishes');
    assert.ok(res1.body.menu.every(m => m.company_id === 'comp-1'), 'comp-1 menu must only contain comp-1 dishes');

    const res2 = await request('GET', '/catering/company/menu', null, comp2Token);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.success, true);
    assert.ok(res2.body.menu.length > 0, 'comp-2 should have menu dishes');
    assert.ok(res2.body.menu.every(m => m.company_id === 'comp-2'), 'comp-2 menu must only contain comp-2 dishes');
    console.log('  Passed!');

    // 2. Out of stock toggling & immediate catalog disappearance
    console.log('TEST 2: Out-of-Stock Toggle & Visibility');
    const dishId = 'm1';

    // Toggle stock OFF
    const offRes = await request('PUT', `/catering/company/menu/${dishId}`, { in_stock: false }, comp1Token);
    assert.strictEqual(offRes.status, 200);
    assert.strictEqual(offRes.body.item.in_stock, false);

    // Query passenger menu
    const menuOffRes = await request('GET', `/catering/menu?pnr=${sampleBooking.pnr_number}&station_code=NDLS`);
    assert.strictEqual(menuOffRes.status, 200);
    const hasDishOff = (menuOffRes.body.menu || []).some(m => m.id === dishId);
    assert.strictEqual(hasDishOff, false, 'Dish marked out of stock must not appear to passengers');

    // Verify no dynamic fallback dummy dishes
    const hasDummy = (menuOffRes.body.menu || []).some(m => String(m.id).startsWith('dyn-'));
    assert.strictEqual(hasDummy, false, 'No fake fallback items must be generated');

    // Toggle stock back ON
    const onRes = await request('PUT', `/catering/company/menu/${dishId}`, { in_stock: true }, comp1Token);
    assert.strictEqual(onRes.status, 200);
    assert.strictEqual(onRes.body.item.in_stock, true);

    const menuOnRes = await request('GET', `/catering/menu?pnr=${sampleBooking.pnr_number}&station_code=NDLS`);
    assert.strictEqual(menuOnRes.status, 200);
    const hasDishOn = (menuOnRes.body.menu || []).some(m => m.id === dishId);
    assert.strictEqual(hasDishOn, true, 'In-stock dish must appear to passengers');
    console.log('  Passed!');

    // 3. Admin read-only inspection & mutation guard
    console.log('TEST 3: Admin Read-Only Inspection');
    const inspectRes = await request('GET', '/catering/company/menu?vendor_id=comp-2', null, adminToken);
    assert.strictEqual(inspectRes.status, 200);
    assert.strictEqual(inspectRes.body.success, true);
    assert.ok(inspectRes.body.menu.every(m => m.company_id === 'comp-2'), 'Admin can inspect partner menu');

    const mutateRes = await request('PUT', '/catering/company/menu/m201', { price: 999 }, adminToken);
    assert.strictEqual(mutateRes.status, 403, 'Admin cannot mutate partner menu items');
    console.log('  Passed!');

    // 4. Lifecycle: Order Placement -> Partner Lifecycle -> Staff Handshake -> Delivery
    console.log('TEST 4: Full End-to-End Order & Delivery Lifecycle');
    const orderPayload = {
      pnr_number: sampleBooking.pnr_number,
      train_number: sampleBooking.train_number,
      station_code: 'NDLS',
      journey_date: sampleBooking.travel_date || new Date().toISOString().split('T')[0],
      coach_number: sampleBooking.coach_number || 'B1',
      seat_number: sampleBooking.seat_number || '24',
      passenger_name: sampleBooking.passenger_name || 'Rahul Sharma',
      items: [{ id: 'm1', qty: 1 }],
      payment_method: 'UPI'
    };

    const placeRes = await request('POST', '/catering/order', orderPayload, passengerToken);
    assert.strictEqual(placeRes.status, 200);
    assert.strictEqual(placeRes.body.success, true);
    const order = placeRes.body.order;
    assert.ok(order && order.order_id);
    assert.ok(order.status === 'CONFIRMED' || order.status === 'ORDER CONFIRMED');
    const orderId = order.order_id;

    // Partner accepts
    const accRes = await request('PUT', `/catering/company/orders/${orderId}/status`, { status: 'ACCEPTED' }, comp1Token);
    assert.strictEqual(accRes.status, 200);
    assert.strictEqual(accRes.body.order.status, 'ACCEPTED');

    // Partner prepares
    const prepRes = await request('PUT', `/catering/company/orders/${orderId}/status`, { status: 'PREPARING' }, comp1Token);
    assert.strictEqual(prepRes.status, 200);
    assert.strictEqual(prepRes.body.order.status, 'PREPARING');

    // Partner ready
    const readyRes = await request('PUT', `/catering/company/orders/${orderId}/status`, { status: 'READY' }, comp1Token);
    assert.strictEqual(readyRes.status, 200);
    assert.strictEqual(readyRes.body.order.status, 'READY');

    // Partner out for delivery
    const outRes = await request('PUT', `/catering/company/orders/${orderId}/status`, { status: 'OUT_FOR_DELIVERY' }, comp1Token);
    assert.strictEqual(outRes.status, 200);
    assert.strictEqual(outRes.body.order.status, 'OUT_FOR_DELIVERY');

    // Staff queries manifest catering orders
    const staffOrdersRes = await request('GET', `/catering/all-orders?train_number=${order.train_number}`, null, staffToken);
    assert.strictEqual(staffOrdersRes.status, 200);
    const staffOrder = staffOrdersRes.body.orders.find(o => o.order_id === orderId);
    assert.ok(staffOrder, 'Staff must see train catering orders');
    assert.strictEqual(staffOrder.status, 'OUT_FOR_DELIVERY');

    // Staff delivers to berth
    const delivRes = await request('PUT', `/catering/orders/${orderId}/status`, { status: 'DELIVERED' }, staffToken);
    assert.strictEqual(delivRes.status, 200);
    assert.strictEqual(delivRes.body.order.status, 'DELIVERED');
    assert.ok(delivRes.body.order.delivery_status.includes('Delivered'));

    // Passenger checks order history
    const passOrdersRes = await request('GET', `/catering/orders?pnr=${sampleBooking.pnr_number}`);
    assert.strictEqual(passOrdersRes.status, 200);
    const passOrder = passOrdersRes.body.orders.find(o => o.order_id === orderId);
    assert.ok(passOrder, 'Passenger must see their order');
    assert.strictEqual(passOrder.status, 'DELIVERED');
    console.log('  Passed!');

    // 5. PNR Isolation check
    console.log('TEST 5: PNR Isolation');
    const isoRes = await request('GET', '/catering/orders?pnr=9999999999');
    assert.strictEqual(isoRes.status, 200);
    assert.deepStrictEqual(isoRes.body.orders, [], 'Unknown PNR must return empty list');
    console.log('  Passed!');

    console.log('\n✅ ALL UNIFIED CATERING E2E TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runTests();
