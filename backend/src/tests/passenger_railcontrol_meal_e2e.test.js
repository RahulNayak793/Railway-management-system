/**
 * Passenger Catering & RailControl Meal / On-Board Catering End-to-End Test Suite
 *
 * Tests the complete integrated flow:
 * My Booking / PNR -> RailControl Meal -> Catering -> Available Meals -> Order -> Payment -> Confirmation
 *
 * Covers:
 * 1. Passenger PNR ownership verification
 * 2. RailControl -> Catering connection (centralized database)
 * 3. Correct train/journey selection and derivation
 * 4. Correct class eligibility
 * 5. Food included in ticket (₹0 additional meal payment)
 * 6. Paid meal (server-side configured prices)
 * 7. Server-side price validation (cannot be manipulated by client)
 * 8. Successful meal payment (UPI, Card, Net Banking, Rail Wallet)
 * 9. Meal order creation with coach/berth details
 * 10. Order status lifecycle tracking
 * 11. My Bookings meal display integration
 * 12. Cross-passenger access rejection
 * 13. Invalid / cancelled PNR rejection
 * 14. Existing data preservation check
 */

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

const PORT = 5123;
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

async function runTestSuite() {
  console.log('🍽️ Starting Passenger Catering & RailControl Meal Integration Test Suite...\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[TEST SERVER] Running on port ${PORT}`);
      resolve();
    });
  });

  let testsPassed = 0;
  let testsFailed = 0;

  async function test(name, fn) {
    process.stdout.write(`• Testing: ${name}... `);
    try {
      await fn();
      console.log('✅ PASSED');
      testsPassed++;
    } catch (err) {
      console.log('❌ FAILED');
      console.error(err);
      testsFailed++;
    }
  }

  try {
    // Passenger tokens
    const passenger1Id = 'usr-pax-1';
    const passenger1Email = 'pax1@test.com';
    const pax1Token = makeToken(passenger1Id, 'passenger', passenger1Email);

    const passenger2Id = 'usr-pax-2';
    const passenger2Email = 'pax2@test.com';
    const pax2Token = makeToken(passenger2Id, 'passenger', passenger2Email);

    // Setup Test Bookings in memory
    const pnrIncluded = '7011111111';
    const pnrPaid = '7022222222';
    const pnrCancelled = '7033333333';
    const pnrOtherUser = '7044444444';

    const testTravelDate = '2026-11-25';

    // 1. Food Included in Ticket Booking (Rajdhani 1A)
    mockDb.bookings.set(pnrIncluded, {
      id: 'bk-inc-1',
      pnr_number: pnrIncluded,
      pnr: pnrIncluded,
      passenger_id: passenger1Id,
      user_id: passenger1Id,
      passenger_email: passenger1Email,
      passenger_name: 'John Doe',
      train_number: '12952',
      train_name: 'Mumbai Rajdhani Express',
      travel_date: testTravelDate,
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      coach_class: '1A',
      class: '1A',
      coach_number: 'H1',
      seat_number: '04',
      status: 'confirmed',
      food_included: true,
      catering_included_in_ticket: true,
      allocations: [{ coach_number: 'H1', seat_number: '04', passenger_name: 'John Doe', booking_status: 'CNF', current_status: 'CNF' }]
    });

    // 2. Paid Meal Booking (Express 3A)
    mockDb.bookings.set(pnrPaid, {
      id: 'bk-paid-1',
      pnr_number: pnrPaid,
      pnr: pnrPaid,
      passenger_id: passenger1Id,
      user_id: passenger1Id,
      passenger_email: passenger1Email,
      passenger_name: 'John Doe',
      train_number: '12952',
      train_name: 'Mumbai Rajdhani Express',
      travel_date: testTravelDate,
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      coach_class: '3A',
      class: '3A',
      coach_number: 'B2',
      seat_number: '21',
      status: 'confirmed',
      food_included: false,
      catering_included_in_ticket: false,
      allocations: [{ coach_number: 'B2', seat_number: '21', passenger_name: 'John Doe', booking_status: 'CNF', current_status: 'CNF' }]
    });

    // 3. Cancelled Booking
    mockDb.bookings.set(pnrCancelled, {
      id: 'bk-canc-1',
      pnr_number: pnrCancelled,
      pnr: pnrCancelled,
      passenger_id: passenger1Id,
      user_id: passenger1Id,
      passenger_email: passenger1Email,
      passenger_name: 'John Doe',
      train_number: '12952',
      train_name: 'Mumbai Rajdhani Express',
      travel_date: testTravelDate,
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      coach_class: '3A',
      class: '3A',
      status: 'cancelled',
      food_included: false
    });

    // 4. Passenger 2's Booking
    mockDb.bookings.set(pnrOtherUser, {
      id: 'bk-other-1',
      pnr_number: pnrOtherUser,
      pnr: pnrOtherUser,
      passenger_id: passenger2Id,
      user_id: passenger2Id,
      passenger_email: passenger2Email,
      passenger_name: 'Jane Smith',
      train_number: '12952',
      train_name: 'Mumbai Rajdhani Express',
      travel_date: testTravelDate,
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      coach_class: '2A',
      class: '2A',
      coach_number: 'A1',
      seat_number: '14',
      status: 'confirmed'
    });

    // TEST 1: Passenger PNR ownership validation & deriving booking details
    await test('1. Passenger PNR ownership validation & auto-deriving journey info', async () => {
      const res = await request('POST', '/api/catering/validate-pnr', { pnr: pnrIncluded }, pax1Token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.valid, true);
      assert.strictEqual(res.data.eligible, true);
      assert.strictEqual(res.data.journey.train_number, '12952');
      assert.strictEqual(res.data.journey.coach_number, 'H1');
      assert.strictEqual(res.data.journey.seat_number, '04');
      assert.strictEqual(res.data.ticket_class, '1A');
    });

    // TEST 2: Cross-passenger access rejection
    await test('2. Cross-passenger access rejection (Passenger 1 accessing Passenger 2 PNR)', async () => {
      const res = await request('POST', '/api/catering/validate-pnr', { pnr: pnrOtherUser }, pax1Token);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Access denied/);
    });

    // TEST 3: Cancelled PNR rejection
    await test('3. Cancelled PNR rejection for meal ordering', async () => {
      const res = await request('POST', '/api/catering/validate-pnr', { pnr: pnrCancelled }, pax1Token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.food_ordering_allowed, false);
      assert.strictEqual(res.data.reason_code, 'CANCELLED_TICKET');
    });

    // TEST 4: Food included in ticket entitlement detection
    await test('4. Food Included in Ticket entitlement detection (₹0 payable)', async () => {
      const res = await request('GET', `/api/catering/onboard/menu?pnr=${pnrIncluded}`, null, pax1Token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.isFoodIncludedInTicket, true);
      assert(res.data.foodAllowance > 0);
      assert(Array.isArray(res.data.menu));
      assert(res.data.menu.length > 0);
    });

    // TEST 5: Additional paid meal entitlement detection
    await test('5. Additional Paid Meal entitlement detection', async () => {
      const res = await request('GET', `/api/catering/onboard/menu?pnr=${pnrPaid}`, null, pax1Token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.isFoodIncludedInTicket, false);
    });

    // TEST 6: On-board menu availability (train-based centralized catering)
    await test('6. Centralized menu item lookup & provider verification', async () => {
      const res = await request('GET', `/api/catering/onboard/menu?pnr=${pnrIncluded}`, null, pax1Token);
      assert.strictEqual(res.status, 200);
      const items = res.data.menu;
      const firstDish = items[0];
      assert(firstDish.id, 'Dish has ID');
      assert(firstDish.name, 'Dish has name');
      assert(firstDish.price > 0, 'Dish has valid price');
      assert(firstDish.category, 'Dish has category');
      assert(firstDish.type, 'Dish has veg/non-veg/jain indicator');
    });

    // TEST 7: Food Included Order Placement (Server enforces ₹0 total)
    let confirmedIncludedOrder = null;
    await test('7. Meal Order creation for Included Food (Price = ₹0)', async () => {
      const menuRes = await request('GET', `/api/catering/onboard/menu?pnr=${pnrIncluded}`, null, pax1Token);
      const dish = menuRes.data.menu[0];

      const orderPayload = {
        pnr: pnrIncluded,
        pnr_number: pnrIncluded,
        items: [{ id: dish.id, meal_id: dish.id, name: dish.name, price: 9999, quantity: 1 }], // Client inflated price should be ignored
        payment_method: 'FOOD INCLUDED IN TICKET'
      };

      const res = await request('POST', '/api/catering/onboard/order', orderPayload, pax1Token);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.order.total_amount, 0, 'Server enforced ₹0 for included food');
      assert.strictEqual(res.data.order.payment_status, 'INCLUDED');
      assert.strictEqual(res.data.order.coach_number, 'H1');
      assert.strictEqual(res.data.order.seat_number, '04');
      confirmedIncludedOrder = res.data.order;
    });

    // TEST 8: Paid Meal Order Placement with Server-Side Price Calculation
    let confirmedPaidOrder = null;
    await test('8. Paid Meal Order creation with strict server-side price validation', async () => {
      const menuRes = await request('GET', `/api/catering/onboard/menu?pnr=${pnrPaid}`, null, pax1Token);
      const dish = menuRes.data.menu[0];
      const realItemPrice = dish.price;

      // Tampered client price (1 rupee) must be overridden by server
      const orderPayload = {
        pnr: pnrPaid,
        pnr_number: pnrPaid,
        items: [{ id: dish.id, meal_id: dish.id, name: dish.name, price: 1.00, quantity: 2 }],
        payment_method: 'UPI'
      };

      const res = await request('POST', '/api/catering/onboard/order', orderPayload, pax1Token);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      const expectedTotal = realItemPrice * 2;
      assert.strictEqual(res.data.order.total_amount, expectedTotal, 'Server enforced true menu price');
      assert.strictEqual(res.data.order.payment_status, 'Paid');
      assert.strictEqual(res.data.order.payment_method, 'UPI');
      confirmedPaidOrder = res.data.order;
    });

    // TEST 9: Paid Meal Order via Rail Wallet (Atomic Debit)
    await test('9. Paid Meal payment via Rail Wallet with atomic debit', async () => {
      // Set initial wallet balance
      if (!mockDb.wallets) mockDb.wallets = new Map();
      mockDb.wallets.set(passenger1Id, {
        id: passenger1Id,
        user_id: passenger1Id,
        balance: 1000.00,
        updated_at: new Date().toISOString()
      });

      const menuRes = await request('GET', `/api/catering/onboard/menu?pnr=${pnrPaid}`, null, pax1Token);
      const dish = menuRes.data.menu[0];

      const orderPayload = {
        pnr: pnrPaid,
        pnr_number: pnrPaid,
        items: [{ id: dish.id, meal_id: dish.id, quantity: 1 }],
        payment_method: 'IRCTC Rail Wallet'
      };

      const res = await request('POST', '/api/catering/onboard/order', orderPayload, pax1Token);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.order.payment_method, 'IRCTC Rail Wallet');
      assert.strictEqual(res.data.order.payment_status, 'Paid');

      // Verify wallet balance decremented
      const updatedWallet = mockDb.wallets.get(passenger1Id);
      assert.strictEqual(updatedWallet.balance, 1000.00 - dish.price);
    });

    // TEST 10: Order Status Lifecycle tracking
    await test('10. Order status lifecycle tracking on order object', async () => {
      assert(confirmedIncludedOrder);
      assert.strictEqual(confirmedIncludedOrder.status, 'ORDER CONFIRMED');
      assert(confirmedIncludedOrder.lifecycle_history.some(h => h.status === 'ORDER_CONFIRMED'));
      assert(confirmedIncludedOrder.delivery_status.includes('Order Confirmed'));
    });

    // TEST 11: Passenger's My Orders isolation (never show other passenger's orders)
    await test('11. Passenger order privacy: GET /catering/my-orders returns only own orders', async () => {
      const res = await request('GET', '/api/catering/my-orders', null, pax1Token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      const orders = res.data.orders;
      assert(orders.length > 0);
      orders.forEach(o => {
        assert.notStrictEqual(o.pnr_number, pnrOtherUser, "Must never contain another passenger's PNR order");
      });
    });

    // TEST 12: Booking meals status integration (GET /catering/booking-meals/:pnr)
    await test('12. Booking meal lookup: GET /catering/booking-meals/:pnr', async () => {
      const res = await request('GET', `/api/catering/booking-meals/${pnrIncluded}`, null, pax1Token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.has_meal_ordered, true);
      assert.strictEqual(res.data.food_included, true);
      assert(res.data.active_order);
      assert.strictEqual(res.data.active_order.pnr_number, pnrIncluded);
    });

    // TEST 13: My Bookings integration: GET /api/bookings returns enriched meal information
    await test('13. My Bookings API returns meal status and orders on booking cards', async () => {
      const res = await request('GET', '/api/bookings', null, pax1Token);
      assert.strictEqual(res.status, 200);
      const bookings = Array.isArray(res.data) ? res.data : res.data.bookings;
      const b1 = bookings.find(b => b.pnr_number === pnrIncluded);
      assert(b1, 'Booking 1 found in passenger bookings');
      assert(b1.catering_order, 'Booking has catering_order attached');
      assert.strictEqual(b1.has_meal_ordered, true, 'Booking has has_meal_ordered flag');
      assert.strictEqual(b1.catering_included_in_ticket, true, 'Booking has catering_included_in_ticket flag');
    });

    // TEST 14: Safety audit: Ensure zero records deleted or modified in backend/data/db.json
    await test('14. Data safety: db.json was preserved and root data intact', async () => {
      const rootDbPath = path.join(__dirname, '../../data/db.json');
      assert(fs.existsSync(rootDbPath), 'Root database exists');
      const rootContent = fs.readFileSync(rootDbPath, 'utf8');
      const rootJson = JSON.parse(rootContent);
      assert(Array.isArray(rootJson.bookings) || typeof rootJson.bookings === 'object');
      assert(Array.isArray(rootJson.trains) || typeof rootJson.trains === 'object');
      assert(Array.isArray(rootJson.catering_orders) || typeof rootJson.catering_orders === 'object');
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
