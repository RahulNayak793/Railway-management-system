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
const dummyPaymentService = require('../services/dummyPaymentService');

const PORT = 5093;
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
  console.log('  RUNNING COMPLETE 20-SCENARIO DUMMY PAYMENT TEST SUITE');
  console.log('=============================================================\n');

  // Start server on port 5093
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Test Server] Listening on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  // Setup test user
  const testUser = {
    id: 'test-passenger-dummy-001',
    email: 'dummy_passenger@railcontrol.in',
    full_name: 'Dummy Passenger',
    role: 'passenger',
    phone: '9876543210'
  };
  mockDb.profiles.set(testUser.id, testUser);

  // Setup unauthorized attacker user
  const attackerUser = {
    id: 'test-passenger-attacker-002',
    email: 'attacker@railcontrol.in',
    full_name: 'Attacker User',
    role: 'passenger',
    phone: '9999999999'
  };
  mockDb.profiles.set(attackerUser.id, attackerUser);

  const testToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });
  const authHeaders = { 'Authorization': 'Bearer ' + testToken };

  const attackerToken = jwt.sign(attackerUser, JWT_SECRET, { expiresIn: '1h' });
  const attackerHeaders = { 'Authorization': 'Bearer ' + attackerToken };

  let passedCount = 0;
  const totalCount = 20;

  try {
    // -------------------------------------------------------------
    // Test 1: Ticket UPI success
    // -------------------------------------------------------------
    console.log('[Test 1] Testing Ticket UPI payment success...');
    const booking1 = {
      id: 'bk-dummy-ticket-01',
      booking_id: 'bk-dummy-ticket-01',
      pnr_number: '9123456781',
      passenger_id: testUser.id,
      user_id: testUser.id,
      train_number: '12952',
      train_name: 'Mumbai Rajdhani',
      source_station: 'BCT',
      destination_station: 'NDLS',
      travel_date: '2026-11-20',
      coach_class: '3A',
      total_fare: '1450.00',
      status: 'pending_payment',
      payment_status: 'PENDING',
      passengers: [{ name: 'Dummy Passenger', age: 32, gender: 'M' }]
    };
    mockDb.bookings.set(booking1.id, booking1);

    const orderRes1 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      reference_id: booking1.id,
      amount: 1450.00
    }, authHeaders);

    assert.strictEqual(orderRes1.status, 201, 'Order creation should return 201');
    assert(orderRes1.body.order_id.startsWith('order_demo_'), 'Order ID should have demo prefix');
    const orderId1 = orderRes1.body.order_id;
    const paymentId1 = dummyPaymentService.generateDummyPaymentId();
    const sig1 = dummyPaymentService.generateDummySignature(orderId1, paymentId1);

    const verifyRes1 = await makeRequest('POST', '/api/payments/verify', {
      order_id: orderId1,
      payment_id: paymentId1,
      signature: sig1,
      payment_method: 'UPI'
    }, authHeaders);

    assert.strictEqual(verifyRes1.status, 200, 'Verification should return 200');
    assert.strictEqual(verifyRes1.body.success, true);
    assert.strictEqual(verifyRes1.body.payment_status, 'PAID');
    assert(verifyRes1.body.transaction_id.startsWith('RC-DEMO-'), 'Transaction ID should be formatted RC-DEMO-XXXXXXXX');
    const updatedBooking1 = mockDb.bookings.get(booking1.id);
    assert.strictEqual(updatedBooking1.payment_status, 'PAID');
    assert.strictEqual(updatedBooking1.status, 'confirmed');
    console.log('✓ Test 1 Passed: Ticket UPI success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 2: Ticket Card success
    // -------------------------------------------------------------
    console.log('[Test 2] Testing Ticket Card payment success...');
    const booking2 = {
      id: 'bk-dummy-ticket-02',
      pnr_number: '9123456782',
      passenger_id: testUser.id,
      user_id: testUser.id,
      train_number: '12952',
      total_fare: '850.00',
      status: 'pending_payment',
      payment_status: 'PENDING',
      coach_class: 'SL',
      passengers: [{ name: 'Card Passenger', age: 28, gender: 'F' }]
    };
    mockDb.bookings.set(booking2.id, booking2);

    const orderRes2 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      reference_id: booking2.id,
      amount: 850.00
    }, authHeaders);

    assert.strictEqual(orderRes2.status, 201);
    const orderId2 = orderRes2.body.order_id;
    const paymentId2 = dummyPaymentService.generateDummyPaymentId();
    const sig2 = dummyPaymentService.generateDummySignature(orderId2, paymentId2);

    const verifyRes2 = await makeRequest('POST', '/api/payments/verify', {
      order_id: orderId2,
      payment_id: paymentId2,
      signature: sig2,
      payment_method: 'Credit / Debit Card'
    }, authHeaders);

    assert.strictEqual(verifyRes2.status, 200);
    assert.strictEqual(verifyRes2.body.success, true);
    assert.strictEqual(mockDb.bookings.get(booking2.id).payment_status, 'PAID');
    console.log('✓ Test 2 Passed: Ticket Card success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 3: Ticket Net Banking success
    // -------------------------------------------------------------
    console.log('[Test 3] Testing Ticket Net Banking payment success...');
    const booking3 = {
      id: 'bk-dummy-ticket-03',
      pnr_number: '9123456783',
      passenger_id: testUser.id,
      user_id: testUser.id,
      train_number: '12952',
      total_fare: '1200.00',
      status: 'pending_payment',
      payment_status: 'PENDING',
      coach_class: '3A',
      passengers: [{ name: 'NetBank Passenger', age: 45, gender: 'M' }]
    };
    mockDb.bookings.set(booking3.id, booking3);

    const orderRes3 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      reference_id: booking3.id,
      amount: 1200.00
    }, authHeaders);

    const orderId3 = orderRes3.body.order_id;
    const paymentId3 = dummyPaymentService.generateDummyPaymentId();
    const sig3 = dummyPaymentService.generateDummySignature(orderId3, paymentId3);

    const verifyRes3 = await makeRequest('POST', '/api/payments/verify', {
      order_id: orderId3,
      payment_id: paymentId3,
      signature: sig3,
      payment_method: 'Net Banking (State Bank of India)'
    }, authHeaders);

    assert.strictEqual(verifyRes3.status, 200);
    assert.strictEqual(verifyRes3.body.success, true);
    assert.strictEqual(mockDb.bookings.get(booking3.id).payment_status, 'PAID');
    console.log('✓ Test 3 Passed: Ticket Net Banking success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 4: Ticket Wallet success (Rail Wallet direct booking payment)
    // -------------------------------------------------------------
    console.log('[Test 4] Testing Ticket Wallet payment success...');
    const booking4 = {
      id: 'bk-dummy-ticket-04',
      pnr_number: '9123456784',
      passenger_id: testUser.id,
      user_id: testUser.id,
      train_number: '12952',
      total_fare: '500.00',
      status: 'pending_payment',
      payment_status: 'PENDING',
      passengers: [{ name: 'Wallet Passenger', age: 24, gender: 'M' }]
    };
    mockDb.bookings.set(booking4.id, booking4);
    // Ensure wallet has balance
    mockDb.wallets.set(testUser.id, { user_id: testUser.id, balance: 2500.00, updated_at: new Date().toISOString() });

    const walletPayRes = await makeRequest('POST', '/api/payments/wallet/pay', {
      booking_id: booking4.id
    }, authHeaders);

    assert.strictEqual(walletPayRes.status, 200);
    assert.strictEqual(walletPayRes.body.wallet_balance, 2000.00);
    assert.strictEqual(mockDb.bookings.get(booking4.id).status, 'confirmed');
    console.log('✓ Test 4 Passed: Ticket Wallet success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 5: Ticket payment failure
    // -------------------------------------------------------------
    console.log('[Test 5] Testing Ticket payment failure...');
    const booking5 = {
      id: 'bk-dummy-ticket-05',
      pnr_number: '9123456785',
      passenger_id: testUser.id,
      user_id: testUser.id,
      train_number: '12952',
      total_fare: '650.00',
      status: 'pending_payment',
      payment_status: 'PENDING',
      passengers: [{ name: 'Failed Passenger', age: 30, gender: 'M' }]
    };
    mockDb.bookings.set(booking5.id, booking5);

    const orderRes5 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      reference_id: booking5.id,
      amount: 650.00
    }, authHeaders);

    const failRes5 = await makeRequest('POST', '/api/payments/fail', {
      order_id: orderRes5.body.order_id,
      reason: 'User cancelled demo payment or simulated failure',
      payment_type: 'TICKET_BOOKING',
      reference_id: booking5.id
    }, authHeaders);

    assert.strictEqual(failRes5.status, 200);
    assert.strictEqual(failRes5.body.payment_status, 'FAILED');
    // Verify booking was NOT confirmed
    assert.strictEqual(mockDb.bookings.get(booking5.id).status, 'pending_payment');
    assert.strictEqual(mockDb.bookings.get(booking5.id).payment_status, 'PENDING');
    console.log('✓ Test 5 Passed: Ticket payment failure');
    passedCount++;

    // -------------------------------------------------------------
    // Test 6: Ticket amount tampering rejected
    // -------------------------------------------------------------
    console.log('[Test 6] Testing Ticket amount tampering rejected...');
    const booking6 = {
      id: 'bk-dummy-ticket-06',
      pnr_number: '9123456786',
      passenger_id: testUser.id,
      user_id: testUser.id,
      total_fare: '950.00',
      status: 'pending_payment'
    };
    mockDb.bookings.set(booking6.id, booking6);

    const tamperRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      reference_id: booking6.id,
      amount: 50.00 // Tampered fare
    }, authHeaders);

    assert.strictEqual(tamperRes.status, 400, 'Tampered fare amount must return 400');
    console.log('✓ Test 6 Passed: Ticket amount tampering rejected');
    passedCount++;

    // -------------------------------------------------------------
    // Test 7: Ticket duplicate payment does not double-confirm (Idempotency)
    // -------------------------------------------------------------
    console.log('[Test 7] Testing Ticket duplicate payment does not double-confirm...');
    const duplicateVerifyRes = await makeRequest('POST', '/api/payments/verify', {
      order_id: orderId1,
      payment_id: paymentId1,
      signature: sig1,
      payment_method: 'UPI'
    }, authHeaders);

    assert.strictEqual(duplicateVerifyRes.status, 200);
    assert.strictEqual(duplicateVerifyRes.body.payment_status, 'PAID');
    assert(duplicateVerifyRes.body.message.includes('Idempotent'));
    console.log('✓ Test 7 Passed: Ticket duplicate payment does not double-confirm');
    passedCount++;

    // -------------------------------------------------------------
    // Test 8: Food UPI success
    // -------------------------------------------------------------
    console.log('[Test 8] Testing Food UPI payment success...');
    const foodOrder8 = {
      order_id: 'fod-dummy-01',
      pnr_number: '9123456781',
      passenger_id: testUser.id,
      user_id: testUser.id,
      ticket_class: '3A',
      total_amount: 280.00,
      status: 'PENDING_PAYMENT',
      payment_status: 'Pending'
    };
    if (!mockDb.catering_orders) mockDb.catering_orders = new Map();
    mockDb.catering_orders.set(foodOrder8.order_id, foodOrder8);

    const foodOrderRes8 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrder8.order_id,
      amount: 280.00
    }, authHeaders);

    assert.strictEqual(foodOrderRes8.status, 201);
    const foodOrderId8 = foodOrderRes8.body.order_id;
    const foodPayId8 = dummyPaymentService.generateDummyPaymentId();
    const foodSig8 = dummyPaymentService.generateDummySignature(foodOrderId8, foodPayId8);

    const foodVerify8 = await makeRequest('POST', '/api/payments/verify', {
      order_id: foodOrderId8,
      payment_id: foodPayId8,
      signature: foodSig8,
      payment_method: 'UPI'
    }, authHeaders);

    assert.strictEqual(foodVerify8.status, 200);
    assert.strictEqual(foodVerify8.body.payment_status, 'PAID');
    assert.strictEqual(mockDb.catering_orders.get(foodOrder8.order_id).status, 'CONFIRMED');
    assert.strictEqual(mockDb.catering_orders.get(foodOrder8.order_id).payment_status, 'Paid');
    console.log('✓ Test 8 Passed: Food UPI success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 9: Food Card success
    // -------------------------------------------------------------
    console.log('[Test 9] Testing Food Card payment success...');
    const foodOrder9 = {
      order_id: 'fod-dummy-02',
      pnr_number: '9123456781',
      passenger_id: testUser.id,
      user_id: testUser.id,
      ticket_class: '3A',
      total_amount: 190.00,
      status: 'PENDING_PAYMENT',
      payment_status: 'Pending'
    };
    mockDb.catering_orders.set(foodOrder9.order_id, foodOrder9);

    const foodOrderRes9 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrder9.order_id,
      amount: 190.00
    }, authHeaders);

    const foodOrderId9 = foodOrderRes9.body.order_id;
    const foodPayId9 = dummyPaymentService.generateDummyPaymentId();
    const foodSig9 = dummyPaymentService.generateDummySignature(foodOrderId9, foodPayId9);

    const foodVerify9 = await makeRequest('POST', '/api/payments/verify', {
      order_id: foodOrderId9,
      payment_id: foodPayId9,
      signature: foodSig9,
      payment_method: 'Credit / Debit Card'
    }, authHeaders);

    assert.strictEqual(foodVerify9.status, 200);
    assert.strictEqual(mockDb.catering_orders.get(foodOrder9.order_id).status, 'CONFIRMED');
    console.log('✓ Test 9 Passed: Food Card success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 10: Food Net Banking success
    // -------------------------------------------------------------
    console.log('[Test 10] Testing Food Net Banking payment success...');
    const foodOrder10 = {
      order_id: 'fod-dummy-03',
      pnr_number: '9123456781',
      passenger_id: testUser.id,
      user_id: testUser.id,
      ticket_class: '3A',
      total_amount: 320.00,
      status: 'PENDING_PAYMENT',
      payment_status: 'Pending'
    };
    mockDb.catering_orders.set(foodOrder10.order_id, foodOrder10);

    const foodOrderRes10 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrder10.order_id,
      amount: 320.00
    }, authHeaders);

    const foodOrderId10 = foodOrderRes10.body.order_id;
    const foodPayId10 = dummyPaymentService.generateDummyPaymentId();
    const foodSig10 = dummyPaymentService.generateDummySignature(foodOrderId10, foodPayId10);

    const foodVerify10 = await makeRequest('POST', '/api/payments/verify', {
      order_id: foodOrderId10,
      payment_id: foodPayId10,
      signature: foodSig10,
      payment_method: 'Net Banking (HDFC Bank)'
    }, authHeaders);

    assert.strictEqual(foodVerify10.status, 200);
    assert.strictEqual(mockDb.catering_orders.get(foodOrder10.order_id).status, 'CONFIRMED');
    console.log('✓ Test 10 Passed: Food Net Banking success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 11: Food Wallet success
    // -------------------------------------------------------------
    console.log('[Test 11] Testing Food Wallet payment success...');
    const foodOrder11 = {
      order_id: 'fod-dummy-04',
      pnr_number: '9123456781',
      passenger_id: testUser.id,
      user_id: testUser.id,
      ticket_class: '3A',
      total_amount: 150.00,
      status: 'PENDING_PAYMENT',
      payment_status: 'Pending'
    };
    mockDb.catering_orders.set(foodOrder11.order_id, foodOrder11);

    const foodOrderRes11 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrder11.order_id,
      amount: 150.00
    }, authHeaders);

    const foodOrderId11 = foodOrderRes11.body.order_id;
    const foodPayId11 = dummyPaymentService.generateDummyPaymentId();
    const foodSig11 = dummyPaymentService.generateDummySignature(foodOrderId11, foodPayId11);

    const foodVerify11 = await makeRequest('POST', '/api/payments/verify', {
      order_id: foodOrderId11,
      payment_id: foodPayId11,
      signature: foodSig11,
      payment_method: 'Rail Wallet'
    }, authHeaders);

    assert.strictEqual(foodVerify11.status, 200);
    assert.strictEqual(mockDb.catering_orders.get(foodOrder11.order_id).status, 'CONFIRMED');
    console.log('✓ Test 11 Passed: Food Wallet success');
    passedCount++;

    // -------------------------------------------------------------
    // Test 12: Food payment failure
    // -------------------------------------------------------------
    console.log('[Test 12] Testing Food payment failure...');
    const foodOrder12 = {
      order_id: 'fod-dummy-05',
      pnr_number: '9123456781',
      passenger_id: testUser.id,
      user_id: testUser.id,
      ticket_class: '3A',
      total_amount: 220.00,
      status: 'PENDING_PAYMENT',
      payment_status: 'Pending'
    };
    mockDb.catering_orders.set(foodOrder12.order_id, foodOrder12);

    const foodOrderRes12 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrder12.order_id,
      amount: 220.00
    }, authHeaders);

    const foodFailRes12 = await makeRequest('POST', '/api/payments/fail', {
      order_id: foodOrderRes12.body.order_id,
      reason: 'Transaction cancelled by user'
    }, authHeaders);

    assert.strictEqual(foodFailRes12.status, 200);
    assert.strictEqual(foodFailRes12.body.payment_status, 'FAILED');
    assert.strictEqual(mockDb.catering_orders.get(foodOrder12.order_id).status, 'PENDING_PAYMENT');
    console.log('✓ Test 12 Passed: Food payment failure');
    passedCount++;

    // -------------------------------------------------------------
    // Test 13: Wallet UPI recharge
    // -------------------------------------------------------------
    console.log('[Test 13] Testing Wallet UPI recharge...');
    mockDb.wallets.set(testUser.id, { user_id: testUser.id, balance: 1000.00, updated_at: new Date().toISOString() });

    const walRes13 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id,
      amount: 500.00
    }, authHeaders);

    assert.strictEqual(walRes13.status, 201);
    const walOrderId13 = walRes13.body.order_id;
    const walPayId13 = dummyPaymentService.generateDummyPaymentId();
    const walSig13 = dummyPaymentService.generateDummySignature(walOrderId13, walPayId13);

    const walVerify13 = await makeRequest('POST', '/api/payments/verify', {
      order_id: walOrderId13,
      payment_id: walPayId13,
      signature: walSig13,
      payment_method: 'UPI'
    }, authHeaders);

    assert.strictEqual(walVerify13.status, 200);
    assert.strictEqual(walVerify13.body.entity.wallet_balance, 1500.00);
    assert.strictEqual(mockDb.wallets.get(testUser.id).balance, 1500.00);
    console.log('✓ Test 13 Passed: Wallet UPI recharge');
    passedCount++;

    // -------------------------------------------------------------
    // Test 14: Wallet Card recharge
    // -------------------------------------------------------------
    console.log('[Test 14] Testing Wallet Card recharge...');
    const walRes14 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id,
      amount: 250.00
    }, authHeaders);

    const walOrderId14 = walRes14.body.order_id;
    const walPayId14 = dummyPaymentService.generateDummyPaymentId();
    const walSig14 = dummyPaymentService.generateDummySignature(walOrderId14, walPayId14);

    const walVerify14 = await makeRequest('POST', '/api/payments/verify', {
      order_id: walOrderId14,
      payment_id: walPayId14,
      signature: walSig14,
      payment_method: 'Credit / Debit Card'
    }, authHeaders);

    assert.strictEqual(walVerify14.status, 200);
    assert.strictEqual(walVerify14.body.entity.wallet_balance, 1750.00);
    console.log('✓ Test 14 Passed: Wallet Card recharge');
    passedCount++;

    // -------------------------------------------------------------
    // Test 15: Wallet Net Banking recharge
    // -------------------------------------------------------------
    console.log('[Test 15] Testing Wallet Net Banking recharge...');
    const walRes15 = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'WALLET_RECHARGE',
      reference_id: testUser.id,
      amount: 1000.00
    }, authHeaders);

    const walOrderId15 = walRes15.body.order_id;
    const walPayId15 = dummyPaymentService.generateDummyPaymentId();
    const walSig15 = dummyPaymentService.generateDummySignature(walOrderId15, walPayId15);

    const walVerify15 = await makeRequest('POST', '/api/payments/verify', {
      order_id: walOrderId15,
      payment_id: walPayId15,
      signature: walSig15,
      payment_method: 'Net Banking'
    }, authHeaders);

    assert.strictEqual(walVerify15.status, 200);
    assert.strictEqual(walVerify15.body.entity.wallet_balance, 2750.00);
    console.log('✓ Test 15 Passed: Wallet Net Banking recharge');
    passedCount++;

    // -------------------------------------------------------------
    // Test 16: Wallet recharge credits exactly once
    // -------------------------------------------------------------
    console.log('[Test 16] Testing Wallet recharge credits exactly once (Idempotency)...');
    const balBeforeDup = mockDb.wallets.get(testUser.id).balance;
    const dupWalVerify = await makeRequest('POST', '/api/payments/verify', {
      order_id: walOrderId15,
      payment_id: walPayId15,
      signature: walSig15,
      payment_method: 'Net Banking'
    }, authHeaders);

    assert.strictEqual(dupWalVerify.status, 200);
    assert.strictEqual(mockDb.wallets.get(testUser.id).balance, balBeforeDup, 'Balance must NOT increase upon retry');
    console.log('✓ Test 16 Passed: Wallet recharge credits exactly once');
    passedCount++;

    // -------------------------------------------------------------
    // Test 17: Unauthorized booking rejected
    // -------------------------------------------------------------
    console.log('[Test 17] Testing Unauthorized booking rejected...');
    const unauthBookingRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'TICKET_BOOKING',
      reference_id: booking1.id,
      amount: 1450.00
    }, attackerHeaders);

    assert.strictEqual(unauthBookingRes.status, 403, 'Unauthorized booking attempt must return 403');
    console.log('✓ Test 17 Passed: Unauthorized booking rejected');
    passedCount++;

    // -------------------------------------------------------------
    // Test 18: Unauthorized food order rejected
    // -------------------------------------------------------------
    console.log('[Test 18] Testing Unauthorized food order rejected...');
    const unauthFoodRes = await makeRequest('POST', '/api/payments/create-order', {
      payment_type: 'FOOD_ORDER',
      reference_id: foodOrder8.order_id,
      amount: 280.00
    }, attackerHeaders);

    assert.strictEqual(unauthFoodRes.status, 403, 'Unauthorized food order attempt must return 403');
    console.log('✓ Test 18 Passed: Unauthorized food order rejected');
    passedCount++;

    // -------------------------------------------------------------
    // Test 19: Invalid transaction rejected
    // -------------------------------------------------------------
    console.log('[Test 19] Testing Invalid transaction rejected...');
    const invalidSigRes = await makeRequest('POST', '/api/payments/verify', {
      order_id: orderId2,
      payment_id: paymentId2,
      signature: 'demo_sig_invalid_hex_0000000000000000000000000000000000000000000000',
      payment_method: 'UPI'
    }, authHeaders);

    assert.strictEqual(invalidSigRes.status, 400, 'Invalid signature must return 400');
    console.log('✓ Test 19 Passed: Invalid transaction rejected');
    passedCount++;

    // -------------------------------------------------------------
    // Test 20: Demo credentials/secrets are not exposed
    // -------------------------------------------------------------
    console.log('[Test 20] Testing Demo credentials/secrets are not exposed...');
    const configRes = await makeRequest('GET', '/api/payments/config');
    assert.strictEqual(configRes.status, 200);
    assert.strictEqual(configRes.body.keySecret, undefined, 'keySecret must not be exposed');
    assert.strictEqual(configRes.body.webhookSecret, undefined, 'webhookSecret must not be exposed');
    assert.strictEqual(configRes.body.salt, undefined, 'salt must not be exposed');
    console.log('✓ Test 20 Passed: Demo credentials/secrets are not exposed');
    passedCount++;

    console.log('\n=============================================================');
    console.log(`  ALL ${passedCount}/${totalCount} DUMMY PAYMENT SCENARIOS PASSED PERFECTLY!`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('\n❌ Test Suite Failure:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runAllTests();
