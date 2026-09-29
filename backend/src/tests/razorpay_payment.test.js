const path = require('path');
process.env.NODE_ENV = 'test';
process.env.RAZORPAY_MODE = 'demo';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../index');
const { mockDb } = require('../config/supabase');
const razorpayService = require('../services/razorpayService');

const PORT = 5092;
const JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
let server;

function makeRequest(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathUrl,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('\n=============================================================');
  console.log('  RUNNING COMPLETE 19-SCENARIO DEMO RAZORPAY TEST SUITE');
  console.log('=============================================================\n');

  // Start server on port 5092
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Test Server] Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  const testKeySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret_railcontrol_secure_v1';

  // Setup test user
  const testUser = {
    id: 'test-passenger-rzp-001',
    email: 'rzp_passenger@railcontrol.in',
    full_name: 'Rahul Nayak',
    role: 'passenger',
    phone: '9876543210'
  };
  mockDb.profiles.set(testUser.id, testUser);

  const testToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });
  const authHeaders = {
    'Authorization': 'Bearer ' + testToken
  };

  // Setup test booking
  const testBooking = {
    id: 'test-booking-rzp-001',
    booking_id: 'test-booking-rzp-001',
    pnr_number: '7894561230',
    passenger_id: testUser.id,
    user_id: testUser.id,
    train_number: '12952',
    train_name: 'Mumbai Tejas Rajdhani',
    source_station: 'BCT',
    destination_station: 'NDLS',
    travel_date: '2026-10-15',
    coach_class: '3A',
    total_fare: 1850.00,
    status: 'pending',
    payment_status: 'PENDING',
    passengers: [{ name: 'Rahul Nayak', age: 28, gender: 'M', berth: null }]
  };
  mockDb.bookings.set(testBooking.id, testBooking);
  mockDb.bookings.set(testBooking.pnr_number, testBooking);

  // Setup wallet
  mockDb.wallets.set(testUser.id, {
    id: testUser.id,
    user_id: testUser.id,
    balance: 1000.00,
    transactions: []
  });

  let passed = 0;

  try {
    // 1. demo ticket order
    const res1 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      booking_id: testBooking.id,
      amount: 1850.00
    }, authHeaders);
    assert.ok([200, 201].includes(res1.status), 'Test 1 status must be 200 or 201');
    assert.strictEqual(res1.body.success, true, 'Test 1 success true');
    assert.ok(res1.body.order_id, 'Test 1 order_id present');
    assert.ok(res1.body.order_id.startsWith('order_demo_'), 'Test 1 demo order id prefix');
    assert.strictEqual(res1.body.demo_mode, true, 'Test 1 demo_mode true');
    assert.strictEqual(res1.body.amount, 1850.00);
    console.log('✓ 1. Demo ticket order creation succeeds with demo order ID and authoritative fare');
    passed++;

    // 2. demo wallet order
    const res2 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 500.00,
      reference_id: testUser.id
    }, authHeaders);
    assert.ok([200, 201].includes(res2.status));
    assert.strictEqual(res2.body.success, true);
    assert.ok(res2.body.order_id.startsWith('order_demo_'));
    assert.strictEqual(res2.body.demo_mode, true);
    assert.strictEqual(res2.body.amount, 500.00);
    console.log('✓ 2. Demo wallet recharge payment order creation succeeds');
    passed++;

    // Setup test standalone food order in mockDb
    const testFoodOrder = {
      order_id: 'food-ord-demo-001',
      id: 'food-ord-demo-001',
      total_amount: 320.00,
      passenger_id: testUser.id,
      status: 'PENDING',
      payment_status: 'Unpaid'
    };
    if (mockDb.catering_orders) {
      mockDb.catering_orders.set(testFoodOrder.order_id, testFoodOrder);
    }

    // 3. demo food order
    const res3 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      amount: 320.00,
      reference_id: testFoodOrder.order_id
    }, authHeaders);
    assert.ok([200, 201].includes(res3.status));
    assert.strictEqual(res3.body.success, true);
    assert.ok(res3.body.order_id.startsWith('order_demo_'));
    assert.strictEqual(res3.body.demo_mode, true);
    assert.strictEqual(res3.body.amount, 320.00);
    console.log('✓ 3. Demo food order payment order creation succeeds');
    passed++;

    // 4. demo UPI payment
    const upiOrderRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 150.00,
      reference_id: testUser.id
    }, authHeaders);
    const upiOrderId = upiOrderRes.body.order_id;
    const upiPayId = 'pay_demo_upi_' + Date.now();
    const upiSig = razorpayService.generateDemoSignature(upiOrderId, upiPayId);

    const verifyUPI = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: upiOrderId,
      razorpay_payment_id: upiPayId,
      razorpay_signature: upiSig,
      payment_method: 'UPI',
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(verifyUPI.status, 200);
    assert.strictEqual(verifyUPI.body.success, true);
    assert.strictEqual(verifyUPI.body.payment.payment_method, 'UPI');
    assert.strictEqual(verifyUPI.body.payment_status, 'PAID');
    assert.strictEqual(verifyUPI.body.demo_mode, true);
    console.log('✓ 4. Demo UPI payment verified and method recorded as UPI');
    passed++;

    // 5. demo card payment
    const cardOrderRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 200.00,
      reference_id: testUser.id
    }, authHeaders);
    const cardOrderId = cardOrderRes.body.order_id;
    const cardPayId = 'pay_demo_card_' + Date.now();
    const cardSig = razorpayService.generateDemoSignature(cardOrderId, cardPayId);

    const verifyCard = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: cardOrderId,
      razorpay_payment_id: cardPayId,
      razorpay_signature: cardSig,
      payment_method: 'CARD',
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(verifyCard.status, 200);
    assert.strictEqual(verifyCard.body.success, true);
    assert.strictEqual(verifyCard.body.payment.payment_method, 'CARD');
    assert.strictEqual(verifyCard.body.payment_status, 'PAID');
    assert.strictEqual(verifyCard.body.demo_mode, true);
    console.log('✓ 5. Demo card payment verified and method recorded as CARD');
    passed++;

    // 6. demo net banking payment
    const nbOrderRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 250.00,
      reference_id: testUser.id
    }, authHeaders);
    const nbOrderId = nbOrderRes.body.order_id;
    const nbPayId = 'pay_demo_nb_' + Date.now();
    const nbSig = razorpayService.generateDemoSignature(nbOrderId, nbPayId);

    const verifyNB = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: nbOrderId,
      razorpay_payment_id: nbPayId,
      razorpay_signature: nbSig,
      payment_method: 'NETBANKING',
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(verifyNB.status, 200);
    assert.strictEqual(verifyNB.body.success, true);
    assert.strictEqual(verifyNB.body.payment.payment_method, 'NETBANKING');
    assert.strictEqual(verifyNB.body.payment_status, 'PAID');
    assert.strictEqual(verifyNB.body.demo_mode, true);
    console.log('✓ 6. Demo net banking payment verified and method recorded as NETBANKING');
    passed++;

    // 7. demo wallet payment
    const walOrderRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 300.00,
      reference_id: testUser.id
    }, authHeaders);
    const walOrderId = walOrderRes.body.order_id;
    const walPayId = 'pay_demo_wal_' + Date.now();
    const walSig = razorpayService.generateDemoSignature(walOrderId, walPayId);

    const verifyWal = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: walOrderId,
      razorpay_payment_id: walPayId,
      razorpay_signature: walSig,
      payment_method: 'WALLET',
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(verifyWal.status, 200);
    assert.strictEqual(verifyWal.body.success, true);
    assert.strictEqual(verifyWal.body.payment.payment_method, 'WALLET');
    assert.strictEqual(verifyWal.body.payment_status, 'PAID');
    assert.strictEqual(verifyWal.body.demo_mode, true);
    console.log('✓ 7. Demo wallet payment verified and method recorded as WALLET');
    passed++;

    // 8. successful demo verification
    const orderRes8 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 100.00,
      reference_id: testUser.id
    }, authHeaders);
    const orderId8 = orderRes8.body.order_id;
    const paymentId8 = 'pay_demo_det_' + Date.now();
    const demoSig8 = razorpayService.generateDemoSignature(orderId8, paymentId8);

    const verifyRes8 = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderId8,
      razorpay_payment_id: paymentId8,
      razorpay_signature: demoSig8,
      payment_method: 'UPI',
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(verifyRes8.status, 200);
    assert.strictEqual(verifyRes8.body.success, true);
    assert.strictEqual(verifyRes8.body.verified, true);
    assert.strictEqual(verifyRes8.body.payment_status, 'PAID');
    assert.strictEqual(verifyRes8.body.demo_mode, true);
    console.log('✓ 8. Successful demo verification with deterministic demo signature');
    passed++;

    // 9. invalid demo signature rejected
    const orderRes9 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 100.00,
      reference_id: testUser.id
    }, authHeaders);
    const verifyRes9 = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderRes9.body.order_id,
      razorpay_payment_id: 'pay_demo_tampered',
      razorpay_signature: 'demo_sig_invalid_bad_signature_000000',
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(verifyRes9.status, 400);
    assert.strictEqual(verifyRes9.body.success, false);
    assert.ok(verifyRes9.body.error.includes('signature'));
    console.log('✓ 9. Invalid demo signature strictly rejected (HTTP 400)');
    passed++;

    // 10. tampered amount rejected
    const res10 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      booking_id: testBooking.id,
      amount: 99.00 // Tampered fare (authoritative is 1850.00)
    }, authHeaders);
    assert.strictEqual(res10.status, 400);
    assert.strictEqual(res10.body.success, false);
    assert.ok(res10.body.error.includes('Fare amount mismatch'));
    console.log('✓ 10. Tampered amount strictly rejected (HTTP 400)');
    passed++;

    // 11. unauthorized reference rejected
    const res11 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      booking_id: 'unauthorized_booking_9999',
      amount: 500.00
    }, authHeaders);
    assert.strictEqual(res11.status, 404);
    assert.strictEqual(res11.body.success, false);
    console.log('✓ 11. Unauthorized or non-existent reference rejected');
    passed++;

    // 12. duplicate verification is idempotent
    const orderRes12 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: 100.00,
      reference_id: testUser.id
    }, authHeaders);
    const orderId12 = orderRes12.body.order_id;
    const paymentId12 = 'pay_demo_dup_' + Date.now();
    const sig12 = razorpayService.generateDemoSignature(orderId12, paymentId12);

    const dup1 = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderId12,
      razorpay_payment_id: paymentId12,
      razorpay_signature: sig12,
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(dup1.status, 200);

    const dup2 = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderId12,
      razorpay_payment_id: paymentId12,
      razorpay_signature: sig12,
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    assert.strictEqual(dup2.status, 200);
    assert.ok(dup2.body.message && dup2.body.message.includes('already verified'));
    assert.strictEqual(dup2.body.payment_status, 'PAID');
    assert.strictEqual(dup2.body.demo_mode, true);
    console.log('✓ 12. Duplicate verification is idempotent');
    passed++;

    // 13. ticket becomes confirmed only after verification
    const bookingToConfirm = {
      id: 'test-booking-tkt-13',
      booking_id: 'test-booking-tkt-13',
      pnr_number: '8912345670',
      passenger_id: testUser.id,
      user_id: testUser.id,
      coach_class: '3A',
      total_fare: 1200.00,
      status: 'pending',
      payment_status: 'PENDING',
      passengers: [{ name: 'Test Passenger 13', age: 30, gender: 'M', berth: null }]
    };
    mockDb.bookings.set(bookingToConfirm.id, bookingToConfirm);
    assert.strictEqual(mockDb.bookings.get(bookingToConfirm.id).status, 'pending');

    const orderRes13 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      booking_id: bookingToConfirm.id,
      amount: 1200.00
    }, authHeaders);
    const paymentId13 = 'pay_demo_tkt_13_' + Date.now();
    const sig13 = razorpayService.generateDemoSignature(orderRes13.body.order_id, paymentId13);

    const verifyRes13 = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderRes13.body.order_id,
      razorpay_payment_id: paymentId13,
      razorpay_signature: sig13,
      payment_type: 'TICKET_BOOKING',
      reference_id: bookingToConfirm.id
    }, authHeaders);
    assert.strictEqual(verifyRes13.status, 200);
    const updatedBooking13 = mockDb.bookings.get(bookingToConfirm.id);
    assert.strictEqual(updatedBooking13.status, 'confirmed');
    assert.strictEqual(updatedBooking13.booking_status, 'CNF');
    assert.strictEqual(updatedBooking13.payment_status, 'PAID');
    console.log('✓ 13. Ticket becomes confirmed only after authoritative verification');
    passed++;

    // 14. seat allocation occurs after successful payment
    const allocs14 = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === bookingToConfirm.id);
    assert.ok(allocs14.length > 0, 'Seats must be allocated in mockDb.seat_allocations');
    assert.strictEqual(allocs14[0].passenger_name, 'Test Passenger 13');
    assert.ok(allocs14[0].coach_number.length > 0);
    console.log('✓ 14. Seat allocation occurs after successful payment');
    passed++;

    // 15. failed payment does not confirm ticket
    const failBooking = {
      id: 'test-booking-fail-15',
      pnr_number: '6543217890',
      passenger_id: testUser.id,
      user_id: testUser.id,
      total_fare: 950.00,
      status: 'pending',
      payment_status: 'PENDING',
      passengers: [{ name: 'Failed Passenger', age: 35, gender: 'F' }]
    };
    mockDb.bookings.set(failBooking.id, failBooking);
    for (const [k, alloc] of mockDb.seat_allocations.entries()) {
      if (alloc && alloc.booking_id === failBooking.id) {
        mockDb.seat_allocations.delete(k);
      }
    }

    const orderRes15 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      booking_id: failBooking.id,
      amount: 950.00
    }, authHeaders);

    // Call fail endpoint
    const failRes = await makeRequest('POST', '/api/payments/fail', {
      razorpay_order_id: orderRes15.body.order_id,
      reason: 'User simulated failure',
      payment_type: 'TICKET_BOOKING',
      reference_id: failBooking.id
    }, authHeaders);
    assert.strictEqual(failRes.status, 200);
    assert.strictEqual(failRes.body.payment_status, 'FAILED');

    // Also verify bad signature rejects
    await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderRes15.body.order_id,
      razorpay_payment_id: 'pay_demo_failed',
      razorpay_signature: 'demo_sig_bad_123',
      payment_type: 'TICKET_BOOKING',
      reference_id: failBooking.id
    }, authHeaders);

    const afterFail = mockDb.bookings.get(failBooking.id);
    assert.strictEqual(afterFail.status, 'pending');
    assert.strictEqual(afterFail.payment_status, 'PENDING');
    const failAllocs = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === failBooking.id);
    assert.strictEqual(failAllocs.length, 0, 'No seats should be allocated for failed payment');
    console.log('✓ 15. Failed payment does not confirm ticket or allocate seats');
    passed++;

    // 16. wallet credited exactly once
    const initialWallet = mockDb.wallets.get(testUser.id);
    const startBalance = initialWallet ? initialWallet.balance : 0;
    const rechargeAmt = 350.00;

    const orderRes16 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      amount: rechargeAmt,
      reference_id: testUser.id
    }, authHeaders);
    const paymentId16 = 'pay_demo_wallet_once_' + Date.now();
    const sig16 = razorpayService.generateDemoSignature(orderRes16.body.order_id, paymentId16);

    await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderRes16.body.order_id,
      razorpay_payment_id: paymentId16,
      razorpay_signature: sig16,
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    const midBalance = mockDb.wallets.get(testUser.id).balance;
    assert.strictEqual(midBalance, startBalance + rechargeAmt);

    // Call verify again with identical order/payment
    await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderRes16.body.order_id,
      razorpay_payment_id: paymentId16,
      razorpay_signature: sig16,
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id
    }, authHeaders);
    const finalBalance = mockDb.wallets.get(testUser.id).balance;
    assert.strictEqual(finalBalance, startBalance + rechargeAmt);
    console.log('✓ 16. Wallet credited exactly once even after repeated verification');
    passed++;

    // 17. food order confirmed after payment
    const foodOrderRef17 = 'food-demo-ord-17';
    const foodRecord17 = {
      order_id: foodOrderRef17,
      id: foodOrderRef17,
      total_amount: 450.00,
      passenger_id: testUser.id,
      status: 'PENDING',
      payment_status: 'Unpaid'
    };
    mockDb.catering_orders.set(foodOrderRef17, foodRecord17);

    const orderRes17 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      amount: 450.00,
      reference_id: foodOrderRef17
    }, authHeaders);
    const paymentId17 = 'pay_demo_food_17_' + Date.now();
    const sig17 = razorpayService.generateDemoSignature(orderRes17.body.order_id, paymentId17);

    const verifyRes17 = await makeRequest('POST', '/api/payments/verify', {
      razorpay_order_id: orderRes17.body.order_id,
      razorpay_payment_id: paymentId17,
      razorpay_signature: sig17,
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrderRef17
    }, authHeaders);
    assert.strictEqual(verifyRes17.status, 200);
    const updatedFood17 = mockDb.catering_orders.get(foodOrderRef17);
    assert.strictEqual(updatedFood17.status, 'CONFIRMED');
    assert.strictEqual(updatedFood17.payment_status, 'Paid');
    console.log('✓ 17. Food order confirmed and marked Paid after payment verification');
    passed++;

    // 18. payment record persisted
    const persistedRecord = mockDb.razorpay_payments.get(orderRes17.body.payment_id);
    assert.ok(persistedRecord, 'Payment record must be persisted in mockDb.razorpay_payments');
    assert.strictEqual(persistedRecord.razorpay_order_id, orderRes17.body.order_id);
    assert.strictEqual(persistedRecord.razorpay_payment_id, paymentId17);
    assert.strictEqual(persistedRecord.status, 'CAPTURED');
    assert.strictEqual(persistedRecord.demo_mode, true);
    console.log('✓ 18. Payment record persisted in database with demo_mode: true and status: CAPTURED');
    passed++;

    // 19. demo mode does not expose secrets
    const configRes19 = await makeRequest('GET', '/api/payments/config');
    assert.strictEqual(configRes19.status, 200);
    assert.ok(configRes19.body.razorpay_key_id);
    assert.strictEqual(configRes19.body.mode, 'demo');
    assert.strictEqual(configRes19.body.is_demo_mode, true);
    assert.strictEqual(configRes19.body.key_secret, undefined);
    assert.strictEqual(configRes19.body.RAZORPAY_KEY_SECRET, undefined);
    assert.strictEqual(configRes19.body.webhookSecret, undefined);
    const bodyStr19 = JSON.stringify(configRes19.body);
    assert.strictEqual(bodyStr19.includes(testKeySecret), false);
    console.log('✓ 19. Demo mode does not expose secret keys or webhook secrets to frontend');
    passed++;

    console.log('\n=============================================================');
    console.log(`  ALL ${passed} / 19 RAZORPAY TESTS PASSED WITH 100% SUCCESS!`);
    console.log('=============================================================\n');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runAllTests();
