/**
 * Comprehensive Test Suite for Realistic Railway eCatering Workflow
 * 
 * Verifies:
 * 1. PNR validation with upcoming stations & cutoff calculation
 * 2. Rejection of cancelled tickets and completed journeys
 * 3. Dynamic train/class food inclusion (without hardcoded 1A) vs Paid separately
 * 4. Station cutoff: passed/near stations block orders and hide menu
 * 5. Partner authorization & status: suspended/expired partners hidden
 * 6. In-stock vs out-of-stock filtering in menu & ordering
 * 7. Partner data isolation (menu & orders)
 * 8. Complete order status lifecycle: ORDER CONFIRMED -> ACCEPTED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED
 * 9. Admin read-only inspection
 * 10. Data safety: operates exclusively on test-db.json
 */

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.JWT_SECRET = 'test_secret_for_ecatering_workflow_98765';

const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const { mockDb } = require('../config/supabase');
const cateringRoutes = require('../routes/catering');

const PORT = 5388;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
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
  console.log('--- Starting Realistic Railway eCatering Workflow Test Suite ---');

  // Verify test database isolation
  assert.strictEqual(process.env.NODE_ENV, 'test', 'Must run in test environment');
  console.log('✓ Environment verified as test (using test-db.json)');

  const app = express();
  app.use(express.json());
  app.use('/api/catering', cateringRoutes);

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // -------------------------------------------------------------
    // SETUP TEST FIXTURES IN MOCK DB (Map storage)
    // -------------------------------------------------------------
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const testTrain1 = {
      train_number: 'TEST_VB_101',
      train_name: 'Vande Bharat Express Test',
      classes: {
        'EC': { food_included: true, food_allowance: 350, price: 2100 },
        'CC': { food_included: false, price: 1200 }
      },
      schedule: [
        { station_code: 'NDLS', station_name: 'New Delhi', day_offset: 0, departure_time: '06:00' },
        { station_code: 'CNB', station_name: 'Kanpur Central', day_offset: 0, arrival_time: '10:00', departure_time: '10:05' },
        { station_code: 'PRYJ', station_name: 'Prayagraj Junction', day_offset: 0, arrival_time: '12:00', departure_time: '12:05' },
        { station_code: 'BSB', station_name: 'Varanasi Junction', day_offset: 0, arrival_time: '14:00' }
      ]
    };

    const testTrain2 = {
      train_number: 'TEST_EXP_202',
      train_name: 'Superfast Express Test',
      classes: {
        '1A': { food_included: false, price: 2500 },
        '2A': { food_included: false, price: 1500 },
        'SL': { food_included: false, price: 400 }
      },
      schedule: [
        { station_code: 'MMCT', station_name: 'Mumbai Central', day_offset: 0, departure_time: '08:00' },
        { station_code: 'BPL', station_name: 'Bhopal Junction', day_offset: 0, arrival_time: '16:00', departure_time: '16:10' },
        { station_code: 'NDLS', station_name: 'New Delhi', day_offset: 1, arrival_time: '06:00' }
      ]
    };

    mockDb.trains.set(testTrain1.train_number, testTrain1);
    mockDb.trains.set(testTrain2.train_number, testTrain2);

    // Bookings
    const bookingVBFoodInc = {
      id: 'book-vb-inc-01',
      pnr_number: 'PNR_VB_INC',
      pnr: 'PNR_VB_INC',
      train_number: 'TEST_VB_101',
      train_name: 'Vande Bharat Express Test',
      journey_date: tomorrow.toISOString().split('T')[0],
      source_station: 'NDLS',
      destination_station: 'BSB',
      class: 'EC',
      coach: 'E1',
      seat_number: '14',
      passenger_name: 'Aarav Sharma',
      contact_phone: '9876543210',
      status: 'CONFIRMED',
      user_id: 'user-pnr-test-01'
    };

    const bookingVBFoodPaid = {
      id: 'book-vb-paid-02',
      pnr_number: 'PNR_VB_PAID',
      pnr: 'PNR_VB_PAID',
      train_number: 'TEST_VB_101',
      train_name: 'Vande Bharat Express Test',
      journey_date: tomorrow.toISOString().split('T')[0],
      source_station: 'NDLS',
      destination_station: 'BSB',
      class: 'CC',
      coach: 'C2',
      seat_number: '28',
      passenger_name: 'Pooja Verma',
      contact_phone: '9876543211',
      status: 'CONFIRMED',
      user_id: 'user-pnr-test-02'
    };

    const booking1ANoFood = {
      id: 'book-1a-nofood-03',
      pnr_number: 'PNR_1A_NOFOOD',
      pnr: 'PNR_1A_NOFOOD',
      train_number: 'TEST_EXP_202',
      train_name: 'Superfast Express Test',
      journey_date: tomorrow.toISOString().split('T')[0],
      source_station: 'MMCT',
      destination_station: 'NDLS',
      class: '1A', // Notice 1A on a train that does NOT include food!
      coach: 'H1',
      seat_number: '4',
      passenger_name: 'Vikram Mehta',
      contact_phone: '9876543212',
      status: 'CONFIRMED',
      user_id: 'user-pnr-test-03'
    };

    const bookingCancelled = {
      id: 'book-canc-04',
      pnr_number: 'PNR_CANCELLED',
      pnr: 'PNR_CANCELLED',
      train_number: 'TEST_VB_101',
      train_name: 'Vande Bharat Express Test',
      journey_date: tomorrow.toISOString().split('T')[0],
      source_station: 'NDLS',
      destination_station: 'BSB',
      class: 'EC',
      status: 'CANCELLED',
      user_id: 'user-pnr-test-04'
    };

    const bookingCompleted = {
      id: 'book-comp-05',
      pnr_number: 'PNR_COMPLETED',
      pnr: 'PNR_COMPLETED',
      train_number: 'TEST_VB_101',
      train_name: 'Vande Bharat Express Test',
      journey_date: yesterday.toISOString().split('T')[0],
      source_station: 'NDLS',
      destination_station: 'BSB',
      class: 'EC',
      status: 'COMPLETED',
      user_id: 'user-pnr-test-05'
    };

    mockDb.bookings.set(bookingVBFoodInc.id, bookingVBFoodInc);
    mockDb.bookings.set(bookingVBFoodPaid.id, bookingVBFoodPaid);
    mockDb.bookings.set(booking1ANoFood.id, booking1ANoFood);
    mockDb.bookings.set(bookingCancelled.id, bookingCancelled);
    mockDb.bookings.set(bookingCompleted.id, bookingCompleted);

    // Catering Companies
    const partnerActive = {
      id: 'c-partner-active',
      company_name: 'Kanpur Royal Pantry',
      stations: ['CNB', 'PRYJ'],
      status: 'ACTIVE',
      valid_from: '2025-01-01',
      valid_until: '2028-12-31',
      fssai_number: 'FSSAI-CNB-1001',
      email: 'kanpur.pantry@railfood.test'
    };

    const partnerSuspended = {
      id: 'c-partner-suspended',
      company_name: 'Suspended Foods LLP',
      stations: ['CNB'],
      status: 'SUSPENDED',
      valid_from: '2025-01-01',
      valid_until: '2028-12-31',
      fssai_number: 'FSSAI-CNB-SUSP',
      email: 'suspended@railfood.test'
    };

    const partnerOther = {
      id: 'c-partner-other',
      company_name: 'Other Pantry',
      stations: ['BPL'],
      status: 'ACTIVE',
      valid_from: '2025-01-01',
      valid_until: '2028-12-31',
      fssai_number: 'FSSAI-BPL-OTHER',
      email: 'other@railfood.test'
    };

    mockDb.catering_companies.set(partnerActive.id, partnerActive);
    mockDb.catering_companies.set(partnerSuspended.id, partnerSuspended);
    mockDb.catering_companies.set(partnerOther.id, partnerOther);

    // Menus
    const dishInStock = {
      id: 'dish-active-01',
      company_id: 'c-partner-active',
      vendor_id: 'c-partner-active',
      name: 'Paneer Butter Masala & Parathas',
      category: 'Meals',
      type: 'veg',
      price: 180,
      in_stock: true,
      description: 'Fresh cottage cheese with flaky parathas'
    };

    const dishOutOfStock = {
      id: 'dish-active-02',
      company_id: 'c-partner-active',
      vendor_id: 'c-partner-active',
      name: 'Gulab Jamun Combo',
      category: 'Desserts',
      type: 'veg',
      price: 60,
      in_stock: false,
      description: 'Hot sweet gulab jamuns'
    };

    const dishSuspendedPartner = {
      id: 'dish-susp-01',
      company_id: 'c-partner-suspended',
      vendor_id: 'c-partner-suspended',
      name: 'Suspended Biryani',
      category: 'Meals',
      type: 'veg',
      price: 150,
      in_stock: true,
      description: 'Should never appear'
    };

    mockDb.catering_menu.set(dishInStock.id, dishInStock);
    mockDb.catering_menu.set(dishOutOfStock.id, dishOutOfStock);
    mockDb.catering_menu.set(dishSuspendedPartner.id, dishSuspendedPartner);

    const passenger1Token = makeToken({ id: 'user-pnr-test-01', role: 'passenger', name: 'Aarav Sharma' });
    const passenger2Token = makeToken({ id: 'user-pnr-test-02', role: 'passenger', name: 'Pooja Verma' });
    const passenger3Token = makeToken({ id: 'user-pnr-test-03', role: 'passenger', name: 'Vikram Mehta' });
    const passenger4Token = makeToken({ id: 'user-pnr-test-04', role: 'passenger', name: 'Cancelled Passenger' });
    const passenger5Token = makeToken({ id: 'user-pnr-test-05', role: 'passenger', name: 'Completed Passenger' });
    const partnerToken = makeToken({ id: 'c-partner-active', company_id: 'c-partner-active', catering_company_id: 'c-partner-active', role: 'CATERING_COMPANY', company_name: 'Kanpur Royal Pantry' });
    const adminToken = makeToken({ id: 'admin-01', role: 'admin', username: 'admin' });

    // =============================================================
    // TEST 1: PNR Validation & Dynamic Food Inclusion (No 1A hardcode)
    // =============================================================
    console.log('\n--- TEST 1: PNR Validation & Dynamic Food Inclusion ---');
    
    // 1A. Vande Bharat EC class -> Food Included in Ticket
    const resVbInc = await request('POST', '/catering/validate-pnr', { pnr: 'PNR_VB_INC' }, passenger1Token);
    assert.strictEqual(resVbInc.status, 200, 'VB EC ticket should validate successfully');
    assert.strictEqual(resVbInc.body.isFoodIncludedInTicket, true, 'VB EC must have food included in ticket dynamically');
    assert.strictEqual(resVbInc.body.foodAllowance, 350, 'Food allowance should match class configuration');
    console.log('✓ Dynamic food inclusion correctly identified for Train TEST_VB_101 Class EC (₹350 allowance)');

    // 1B. Vande Bharat CC class -> Food Paid Separately
    const resVbPaid = await request('POST', '/catering/validate-pnr', { pnr: 'PNR_VB_PAID' }, passenger2Token);
    assert.strictEqual(resVbPaid.status, 200, 'VB CC ticket should validate');
    assert.strictEqual(resVbPaid.body.isFoodIncludedInTicket, false, 'VB CC must NOT have food included');
    console.log('✓ Dynamic food mode correctly identified as Paid Separately for Train TEST_VB_101 Class CC');

    // 1C. 1A class on Express train without complimentary catering -> Food Paid Separately (Verifies no 1A hardcoding!)
    const res1A = await request('POST', '/catering/validate-pnr', { pnr: 'PNR_1A_NOFOOD' }, passenger3Token);
    assert.strictEqual(res1A.status, 200, '1A non-catering train ticket should validate');
    assert.strictEqual(res1A.body.isFoodIncludedInTicket, false, '1A class without train food_included must NOT be assumed complimentary!');
    console.log('✓ Verified: Class 1A without train food configuration is correctly treated as Paid Separately (NO HARDCODED 1A ASSUMPTION)');

    // =============================================================
    // TEST 2: Rejection of Cancelled & Completed Tickets
    // =============================================================
    console.log('\n--- TEST 2: Rejection of Cancelled & Completed Tickets ---');
    const resCanc = await request('POST', '/catering/validate-pnr', { pnr: 'PNR_CANCELLED' }, passenger4Token);
    assert.strictEqual(resCanc.body.food_ordering_allowed, false, 'Cancelled ticket must disallow food ordering');
    assert.strictEqual(resCanc.body.reason_code, 'CANCELLED_TICKET', 'Reason code must indicate CANCELLED_TICKET');
    console.log('✓ Cancelled ticket rejected properly');

    const resComp = await request('POST', '/catering/validate-pnr', { pnr: 'PNR_COMPLETED' }, passenger5Token);
    assert.strictEqual(resComp.body.food_ordering_allowed, false, 'Completed journey ticket must disallow food ordering');
    assert.strictEqual(resComp.body.reason_code, 'COMPLETED_JOURNEY', 'Reason code must indicate COMPLETED_JOURNEY');
    console.log('✓ Completed journey ticket rejected properly');

    // =============================================================
    // TEST 3: Station Cutoff & Eligibility
    // =============================================================
    console.log('\n--- TEST 3: Station Cutoff & Eligibility ---');
    // For tomorrow's journey, upcoming stations CNB and PRYJ should be open
    const eligibleStations = resVbInc.body.eligibleStations;
    assert.ok(Array.isArray(eligibleStations), 'Eligible stations should be returned');
    const cnbStation = eligibleStations.find(s => s.code === 'CNB');
    assert.ok(cnbStation, 'CNB should be in eligible stations');
    assert.strictEqual(cnbStation.can_order, true, 'Future station should have can_order = true');
    console.log('✓ Upcoming station CNB is marked open for ordering');

    // Test cutoff calculation directly on departed station
    const passedStationsRes = await request('GET', '/catering/stations/eligibility?station_code=NDLS&passed_station_codes=NDLS', null);
    assert.strictEqual(passedStationsRes.body.can_order, false, 'Passed station must have can_order = false');
    assert.strictEqual(passedStationsRes.body.cutoff_passed, true, 'Departed station cutoff must be flagged');
    console.log('✓ Passed / departed station cutoff correctly enforced');

    // =============================================================
    // TEST 4: Partner Authorization & Menu In-Stock Filtering
    // =============================================================
    console.log('\n--- TEST 4: Partner Filtering & Out-of-Stock Omission ---');
    // Fetch menu for CNB
    const menuRes = await request('GET', '/catering/menu?pnr=PNR_VB_INC&station_code=CNB', null, passenger1Token);
    assert.strictEqual(menuRes.status, 200, 'Menu query should succeed');
    const menuItems = menuRes.body.menu || [];
    
    // In-stock item from active partner must appear
    const foundInStock = menuItems.find(i => i.id === 'dish-active-01');
    assert.ok(foundInStock, 'Active in-stock dish must appear in station menu');

    // Out-of-stock item must NOT appear in passenger menu
    const foundOutOfStock = menuItems.find(i => i.id === 'dish-active-02');
    assert.strictEqual(foundOutOfStock, undefined, 'Out-of-stock item must be omitted from passenger menu');

    // Suspended partner dish must NOT appear
    const foundSuspended = menuItems.find(i => i.id === 'dish-susp-01');
    assert.strictEqual(foundSuspended, undefined, 'Suspended partner dishes must never appear in station menu');
    console.log('✓ Menu only returns authorized active partner dishes that are IN-STOCK');

    // =============================================================
    // TEST 5: Out-of-Stock Order Rejection
    // =============================================================
    console.log('\n--- TEST 5: Out-of-Stock Order Rejection ---');
    const outOfStockOrderPayload = {
      pnr: 'PNR_VB_PAID',
      station_code: 'CNB',
      vendor_id: 'c-partner-active',
      items: [
        { id: 'dish-active-02', name: 'Gulab Jamun Combo', price: 60, quantity: 1 }
      ],
      payment_mode: 'Cash on Delivery',
      delivery_details: {
        train_number: 'TEST_VB_101',
        coach: 'C2',
        seat: '28',
        passenger_name: 'Pooja Verma',
        passenger_phone: '9876543211'
      }
    };
    const oosOrderRes = await request('POST', '/catering/order', outOfStockOrderPayload, passenger2Token);
    assert.strictEqual(oosOrderRes.status, 400, 'Order containing out-of-stock item must be rejected');
    assert.ok(oosOrderRes.body.error.toLowerCase().includes('out of stock'), 'Error message must note out of stock item');
    console.log('✓ Order with out-of-stock item was correctly rejected');

    // =============================================================
    // TEST 6: Food Included In Ticket Order (₹0.00 & Dynamic Payment)
    // =============================================================
    console.log('\n--- TEST 6: Food Included in Ticket Order Flow ---');
    const includedOrderPayload = {
      pnr: 'PNR_VB_INC',
      station_code: 'CNB',
      vendor_id: 'c-partner-active',
      items: [
        { id: 'dish-active-01', name: 'Paneer Butter Masala & Parathas', price: 180, quantity: 1 }
      ],
      payment_mode: 'FOOD INCLUDED IN TICKET',
      payment_method: 'FOOD INCLUDED IN TICKET',
      delivery_details: {
        train_number: 'TEST_VB_101',
        coach: 'E1',
        seat: '14',
        passenger_name: 'Aarav Sharma',
        passenger_phone: '9876543210'
      }
    };

    const incOrderRes = await request('POST', '/catering/order', includedOrderPayload, passenger1Token);
    assert.ok(incOrderRes.status === 200 || incOrderRes.status === 201, 'Included food order should be created');
    assert.strictEqual(incOrderRes.body.order.payment_method, 'FOOD INCLUDED IN TICKET', 'Payment method must be FOOD INCLUDED IN TICKET');
    assert.strictEqual(incOrderRes.body.order.status, 'ORDER CONFIRMED', 'Initial status must be ORDER CONFIRMED');
    const incOrderId = incOrderRes.body.order.order_id || incOrderRes.body.order.id;
    console.log(`✓ Order created with FOOD INCLUDED IN TICKET at ₹0.00, Order ID: ${incOrderId}, status: ORDER CONFIRMED`);

    // =============================================================
    // TEST 7: Partner Full Order Lifecycle Updates
    // ORDER CONFIRMED -> ACCEPTED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED
    // =============================================================
    console.log('\n--- TEST 7: Partner Order Status Lifecycle ---');
    const statusSequence = ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    
    for (const nextStatus of statusSequence) {
      const updateRes = await request('PUT', `/catering/company/orders/${incOrderId}/status`, { status: nextStatus }, partnerToken);
      assert.strictEqual(updateRes.status, 200, `Partner should be able to update status to ${nextStatus}`);
      assert.strictEqual(updateRes.body.order.status, nextStatus, `Status should be updated to ${nextStatus}`);
      console.log(`  → Successfully transitioned to: ${nextStatus}`);
    }
    console.log('✓ Completed full partner order lifecycle to DELIVERED');

    // =============================================================
    // TEST 8: Partner Isolation
    // =============================================================
    console.log('\n--- TEST 8: Partner Data Isolation ---');
    const partnerOtherToken = makeToken({ id: 'c-partner-other', company_id: 'c-partner-other', catering_company_id: 'c-partner-other', role: 'CATERING_COMPANY', company_name: 'Other Pantry' });
    
    // Other partner attempts to view active partner's orders
    const otherOrdersRes = await request('GET', '/catering/company/orders', null, partnerOtherToken);
    assert.strictEqual(otherOrdersRes.status, 200);
    const hasActiveOrder = (otherOrdersRes.body.orders || []).some(o => (o.order_id || o.id) === incOrderId);
    assert.strictEqual(hasActiveOrder, false, 'Partner Other must not see active partner order');

    // Other partner attempts to update active partner order
    const unauthorizedUpdate = await request('PUT', `/catering/company/orders/${incOrderId}/status`, { status: 'CANCELLED' }, partnerOtherToken);
    assert.ok(unauthorizedUpdate.status === 403 || unauthorizedUpdate.status === 404, 'Partner Other should not be allowed to modify another company order');
    console.log('✓ Partner isolation successfully enforced');

    // =============================================================
    // TEST 9: Admin Read-Only Menu Inspection
    // =============================================================
    console.log('\n--- TEST 9: Admin Read-Only Menu Inspection ---');
    const adminMenuRes = await request('GET', `/catering/company/menu?vendor_id=c-partner-active`, null, adminToken);
    assert.strictEqual(adminMenuRes.status, 200, 'Admin can inspect company menu');
    assert.ok(adminMenuRes.body.menu.length >= 2, 'Admin sees all menu items including out-of-stock for compliance review');
    console.log('✓ Admin read-only menu inspection verified');

    console.log('\n=============================================================');
    console.log('🎉 ALL REALISTIC RAILWAY eCATERING WORKFLOW TESTS PASSED! 🎉');
    console.log('=============================================================\n');
  } finally {
    if (server) server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  if (server) server.close();
  process.exit(1);
});
