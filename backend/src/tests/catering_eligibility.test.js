const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');

// Configure test environment
process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.JWT_SECRET = 'test_jwt_secret_key_1234567890';
const PORT = 5197;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

const { mockDb } = require('../config/supabase');
const cateringRoutes = require('../routes/catering');
const paymentRoutes = require('../routes/payments');

let server;

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'passenger', full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

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

async function runAllCateringEligibilityTests() {
  console.log('\n=============================================================');
  console.log('  RUNNING 20-SCENARIO RAILCONTROL FOOD ELIGIBILITY TEST SUITE');
  console.log('=============================================================\n');

  // Initialize Express server for testing endpoints
  const app = express();
  app.use(express.json());
  app.use('/api/catering', cateringRoutes);
  app.use('/api/payments', paymentRoutes);

  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[Catering Test Server] Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  let passed = 0;

  try {
    // Setup test passengers
    const passengerA = {
      id: 'usr-pass-001',
      email: 'passenger_a@railcontrol.in',
      full_name: 'Aditya Sharma',
      role: 'passenger'
    };
    const passengerB = {
      id: 'usr-pass-002',
      email: 'passenger_b@railcontrol.in',
      full_name: 'Priya Patel',
      role: 'passenger'
    };
    const tokenA = generateToken(passengerA);
    const tokenB = generateToken(passengerB);

    if (!mockDb.profiles) mockDb.profiles = new Map();
    mockDb.profiles.set(passengerA.id, passengerA);
    mockDb.profiles.set(passengerB.id, passengerB);

    if (!mockDb.bookings) mockDb.bookings = new Map();
    if (!mockDb.catering_orders) mockDb.catering_orders = new Map();
    if (!mockDb.catering_companies) mockDb.catering_companies = new Map();

    // Setup active catering partner
    const testCompany = {
      id: 'comp-test-1',
      company_name: 'IRCTC Executive Pantry',
      status: 'ACTIVE',
      stations: ['NDLS', 'BPL', 'MMCT', 'KOTA']
    };
    mockDb.catering_companies.set(testCompany.id, testCompany);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const pastDate = '2025-01-01';

    // 1. Setup bookings for all travel classes (Upcoming)
    const booking1A = {
      id: 'bk-1a-test',
      booking_id: 'bk-1a-test',
      pnr_number: '1111111111',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: '1A',
      total_fare: 4850.00,
      status: 'confirmed',
      booking_status: 'CONFIRMED',
      payment_status: 'PAID'
    };

    const booking2A = {
      id: 'bk-2a-test',
      booking_id: 'bk-2a-test',
      pnr_number: '2222222222',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: '2A',
      total_fare: 2850.00,
      status: 'confirmed',
      booking_status: 'CONFIRMED',
      payment_status: 'PAID'
    };

    const booking3A = {
      id: 'bk-3a-test',
      booking_id: 'bk-3a-test',
      pnr_number: '3333333333',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: '3A',
      total_fare: 1850.00,
      status: 'confirmed',
      booking_status: 'CONFIRMED',
      payment_status: 'PAID'
    };

    const bookingSL = {
      id: 'bk-sl-test',
      booking_id: 'bk-sl-test',
      pnr_number: '4444444444',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: 'SL',
      total_fare: 650.00,
      status: 'confirmed',
      booking_status: 'CONFIRMED',
      payment_status: 'PAID'
    };

    const bookingCC = {
      id: 'bk-cc-test',
      booking_id: 'bk-cc-test',
      pnr_number: '5555555555',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: 'CC',
      total_fare: 950.00,
      status: 'confirmed',
      booking_status: 'CONFIRMED',
      payment_status: 'PAID'
    };

    const bookingCancelled = {
      id: 'bk-canc-test',
      booking_id: 'bk-canc-test',
      pnr_number: '6666666666',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: tomorrow,
      coach_class: '2A',
      total_fare: 2850.00,
      status: 'cancelled',
      booking_status: 'CANCELLED',
      payment_status: 'REFUNDED'
    };

    const bookingCompleted = {
      id: 'bk-comp-test',
      booking_id: 'bk-comp-test',
      pnr_number: '7777777777',
      passenger_id: passengerA.id,
      user_id: passengerA.id,
      passenger_name: 'Aditya Sharma',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: pastDate,
      coach_class: '3A',
      total_fare: 1850.00,
      status: 'completed',
      booking_status: 'COMPLETED',
      payment_status: 'PAID'
    };

    [booking1A, booking2A, booking3A, bookingSL, bookingCC, bookingCancelled, bookingCompleted].forEach(b => {
      mockDb.bookings.set(b.id, b);
      mockDb.bookings.set(b.pnr_number, b);
    });

    // ==============================================================
    // SCENARIO 1: 1A upcoming → food allowed
    // ==============================================================
    const res1 = await request('POST', '/catering/validate-pnr', { pnr: '1111111111' }, tokenA);
    console.log('RES1_STATUS:', res1.status, 'RES1_BODY:', res1.body);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.food_ordering_allowed, true);
    assert.strictEqual(res1.body.ticket_class, '1A');
    assert.strictEqual(res1.body.journey_status, 'UPCOMING');
    console.log('✓ 1. 1A upcoming → food allowed');
    passed++;

    // ==============================================================
    // SCENARIO 2: 2A upcoming → food allowed
    // ==============================================================
    const res2 = await request('POST', '/catering/validate-pnr', { pnr: '2222222222' }, tokenA);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.success, true);
    assert.strictEqual(res2.body.food_ordering_allowed, true);
    assert.strictEqual(res2.body.ticket_class, '2A');
    assert.strictEqual(res2.body.journey_status, 'UPCOMING');
    console.log('✓ 2. 2A upcoming → food allowed');
    passed++;

    // ==============================================================
    // SCENARIO 3: 3A upcoming → food allowed
    // ==============================================================
    const res3 = await request('POST', '/catering/validate-pnr', { pnr: '3333333333' }, tokenA);
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.body.success, true);
    assert.strictEqual(res3.body.food_ordering_allowed, true);
    assert.strictEqual(res3.body.ticket_class, '3A');
    assert.strictEqual(res3.body.journey_status, 'UPCOMING');
    console.log('✓ 3. 3A upcoming → food allowed');
    passed++;

    // ==============================================================
    // SCENARIO 4: SL upcoming → food allowed
    // ==============================================================
    const res4 = await request('POST', '/catering/validate-pnr', { pnr: '4444444444' }, tokenA);
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.body.success, true);
    assert.strictEqual(res4.body.food_ordering_allowed, true);
    assert.strictEqual(res4.body.ticket_class, 'SL');
    assert.strictEqual(res4.body.journey_status, 'UPCOMING');
    console.log('✓ 4. SL upcoming → food allowed');
    passed++;

    // ==============================================================
    // SCENARIO 5: CC upcoming → food allowed
    // ==============================================================
    const res5 = await request('POST', '/catering/validate-pnr', { pnr: '5555555555' }, tokenA);
    assert.strictEqual(res5.status, 200);
    assert.strictEqual(res5.body.success, true);
    assert.strictEqual(res5.body.food_ordering_allowed, true);
    assert.strictEqual(res5.body.ticket_class, 'CC');
    assert.strictEqual(res5.body.journey_status, 'UPCOMING');
    console.log('✓ 5. CC upcoming → food allowed');
    passed++;

    // ==============================================================
    // SCENARIO 6: Valid upcoming PNR → food allowed & menu accessible
    // ==============================================================
    const res6 = await request('GET', '/catering/menu?pnr=2222222222', null, tokenA);
    assert.strictEqual(res6.status, 200);
    assert.strictEqual(res6.body.success, true);
    assert.ok(Array.isArray(res6.body.menu));
    console.log('✓ 6. Valid upcoming PNR → food allowed (menu accessible)');
    passed++;

    // ==============================================================
    // SCENARIO 7: Cancelled PNR → food blocked
    // ==============================================================
    const res7 = await request('POST', '/catering/validate-pnr', { pnr: '6666666666' }, tokenA);
    assert.strictEqual(res7.status, 200);
    assert.strictEqual(res7.body.eligible, false);
    assert.strictEqual(res7.body.food_ordering_allowed, false);
    assert.strictEqual(res7.body.booking_status, 'CANCELLED');
    assert.strictEqual(res7.body.reason_code, 'CANCELLED_TICKET');
    assert.strictEqual(res7.body.food_entitlement, 'NOT_AVAILABLE');
    assert.strictEqual(res7.body.message, 'Food ordering is unavailable for cancelled tickets.');
    console.log('✓ 7. Cancelled PNR → food blocked');
    passed++;

    // ==============================================================
    // SCENARIO 8: Cancelled PNR → menu unavailable
    // ==============================================================
    const res8 = await request('GET', '/catering/menu?pnr=6666666666', null, tokenA);
    assert.strictEqual(res8.status, 400);
    assert.strictEqual(res8.body.error, 'CANCELLED_TICKET');
    console.log('✓ 8. Cancelled PNR → menu unavailable');
    passed++;

    // ==============================================================
    // SCENARIO 9: Cancelled PNR → food-order API rejected
    // ==============================================================
    const res9 = await request('POST', '/catering/order', {
      pnr_number: '6666666666',
      station_code: 'NDLS',
      items: [{ id: 'm101', name: 'Steamed Idli', price: 110, quantity: 1 }]
    }, tokenA);
    assert.strictEqual(res9.status, 400);
    assert.strictEqual(res9.body.code, 'CANCELLED_TICKET');
    console.log('✓ 9. Cancelled PNR → food-order API rejected');
    passed++;

    // ==============================================================
    // SCENARIO 10: Cancelled PNR → Razorpay food order rejected
    // ==============================================================
    const res10 = await request('POST', '/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: '6666666666',
      amount: 110.00
    }, tokenA);
    assert.strictEqual(res10.status, 400);
    assert.strictEqual(res10.body.code, 'CANCELLED_TICKET');
    assert.strictEqual(res10.body.message, 'Food ordering is unavailable for a cancelled ticket.');
    console.log('✓ 10. Cancelled PNR → Razorpay food order rejected');
    passed++;

    // ==============================================================
    // SCENARIO 11: Completed journey → food blocked
    // ==============================================================
    const res11 = await request('POST', '/catering/validate-pnr', { pnr: '7777777777' }, tokenA);
    assert.strictEqual(res11.status, 200);
    assert.strictEqual(res11.body.eligible, false);
    assert.strictEqual(res11.body.food_ordering_allowed, false);
    assert.strictEqual(res11.body.journey_status, 'COMPLETED');
    assert.strictEqual(res11.body.reason_code, 'COMPLETED_JOURNEY');
    assert.strictEqual(res11.body.food_entitlement, 'NOT_AVAILABLE');
    assert.strictEqual(res11.body.message, 'Food ordering is unavailable because your journey has been completed.');
    console.log('✓ 11. Completed journey → food blocked');
    passed++;

    // ==============================================================
    // SCENARIO 12: Completed journey → menu unavailable
    // ==============================================================
    const res12 = await request('GET', '/catering/menu?pnr=7777777777', null, tokenA);
    assert.strictEqual(res12.status, 400);
    assert.strictEqual(res12.body.error, 'COMPLETED_JOURNEY');
    console.log('✓ 12. Completed journey → menu unavailable');
    passed++;

    // ==============================================================
    // SCENARIO 13: Completed journey → food-order API rejected
    // ==============================================================
    const res13 = await request('POST', '/catering/order', {
      pnr_number: '7777777777',
      station_code: 'NDLS',
      items: [{ id: 'm101', name: 'Steamed Idli', price: 110, quantity: 1 }]
    }, tokenA);
    assert.strictEqual(res13.status, 400);
    assert.strictEqual(res13.body.code, 'COMPLETED_JOURNEY');
    console.log('✓ 13. Completed journey → food-order API rejected');
    passed++;

    // ==============================================================
    // SCENARIO 14: Completed journey → Razorpay food order rejected
    // ==============================================================
    const res14 = await request('POST', '/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: '7777777777',
      amount: 110.00
    }, tokenA);
    assert.strictEqual(res14.status, 400);
    assert.strictEqual(res14.body.code, 'COMPLETED_JOURNEY');
    assert.strictEqual(res14.body.message, 'Food ordering is unavailable because the journey has been completed.');
    console.log('✓ 14. Completed journey → Razorpay food order rejected');
    passed++;

    // ==============================================================
    // SCENARIO 15: Future/upcoming journey → food allowed (Order creation succeeds)
    // ==============================================================
    const res15 = await request('POST', '/catering/order', {
      pnr_number: '3333333333',
      station_code: 'NDLS',
      coach_number: 'B1',
      seat_number: '24',
      passenger_name: 'Aditya Sharma',
      items: [{ id: 'm101', name: 'Steamed Idli Sambar Pair', price: 110, quantity: 1 }],
      payment_method: 'UPI'
    }, tokenA);
    assert.strictEqual(res15.status, 200);
    assert.strictEqual(res15.body.success, true);
    assert.strictEqual(res15.body.order.ticket_class, '3A');
    assert.strictEqual(res15.body.order.status, 'CONFIRMED');
    console.log('✓ 15. Future/upcoming journey → food allowed (order creation succeeds)');
    passed++;

    // ==============================================================
    // SCENARIO 16: Passenger cannot use another passenger's PNR
    // ==============================================================
    const res16 = await request('POST', '/catering/validate-pnr', { pnr: '3333333333' }, tokenB);
    assert.strictEqual(res16.status, 403);
    assert.strictEqual(res16.body.eligible, false);
    console.log('✓ 16. Passenger cannot use another passenger PNR (HTTP 403)');
    passed++;

    // ==============================================================
    // SCENARIO 17: Frontend cannot override CANCELLED status
    // ==============================================================
    const res17 = await request('POST', '/catering/order', {
      pnr_number: '6666666666',
      booking_status: 'CONFIRMED', // Attempted frontend override
      journey_status: 'UPCOMING',  // Attempted frontend override
      items: [{ id: 'm101', name: 'Steamed Idli', price: 110, quantity: 1 }]
    }, tokenA);
    assert.strictEqual(res17.status, 400);
    assert.strictEqual(res17.body.code, 'CANCELLED_TICKET');
    console.log('✓ 17. Frontend cannot override CANCELLED status (authoritative DB check)');
    passed++;

    // ==============================================================
    // SCENARIO 18: Frontend cannot override COMPLETED status
    // ==============================================================
    const res18 = await request('POST', '/catering/order', {
      pnr_number: '7777777777',
      booking_status: 'CONFIRMED', // Attempted frontend override
      journey_status: 'UPCOMING',  // Attempted frontend override
      items: [{ id: 'm101', name: 'Steamed Idli', price: 110, quantity: 1 }]
    }, tokenA);
    assert.strictEqual(res18.status, 400);
    assert.strictEqual(res18.body.code, 'COMPLETED_JOURNEY');
    console.log('✓ 18. Frontend cannot override COMPLETED status (authoritative DB check)');
    passed++;

    // ==============================================================
    // SCENARIO 19: Direct API cannot bypass cancellation restriction
    // ==============================================================
    const res19 = await request('POST', '/catering/order', {
      pnr_number: '6666666666',
      station_code: 'NDLS',
      items: [{ id: 'm101', name: 'Steamed Idli Sambar Pair', price: 110, quantity: 1 }],
      payment_method: 'UPI'
    }, null); // Direct API call bypassing UI
    assert.strictEqual(res19.status, 400);
    assert.strictEqual(res19.body.code, 'CANCELLED_TICKET');
    console.log('✓ 19. Direct API cannot bypass cancellation restriction');
    passed++;

    // ==============================================================
    // SCENARIO 20: Direct API cannot bypass completed-journey restriction
    // ==============================================================
    const res20 = await request('POST', '/catering/order', {
      pnr_number: '7777777777',
      station_code: 'NDLS',
      items: [{ id: 'm101', name: 'Steamed Idli Sambar Pair', price: 110, quantity: 1 }],
      payment_method: 'UPI'
    }, null); // Direct API call bypassing UI
    assert.strictEqual(res20.status, 400);
    assert.strictEqual(res20.body.code, 'COMPLETED_JOURNEY');
    console.log('✓ 20. Direct API cannot bypass completed-journey restriction');
    passed++;

    console.log(`\n🎉 ALL ${passed} / 20 RAILCONTROL FOOD ELIGIBILITY SCENARIOS PASSED WITH ZERO ERRORS! 🎉\n`);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runAllCateringEligibilityTests().catch(err => {
  console.error('Test runner failed:', err);
  if (server) server.close();
  process.exit(1);
});
