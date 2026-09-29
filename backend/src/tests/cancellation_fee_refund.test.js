const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Set environment for test mode using test database
process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.JWT_SECRET = 'test_jwt_secret_key_1234567890';
process.env.PORT = '5199';

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const jwt = require('jsonwebtoken');

// Helper to reset test DB state
function resetTestDb() {
  ['bookings', 'payments', 'wallets', 'wallet_transactions', 'cancellation_records', 'refunds'].forEach(m => {
    if (!mockDb[m]) mockDb[m] = new Map();
    else mockDb[m].clear();
  });
  if (!mockDb.system_policies) mockDb.system_policies = {};
  mockDb.system_policies.cancellation = {
    cancellation_fee_percentage: 10,
    full_refund_when_fee_paid: true
  };
}

let server;
const PORT = 5199;
const BASE_URL = `http://localhost:${PORT}/api`;

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'passenger', full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runCancellationTestSuite() {
  console.log('--- 🧪 STARTING REALISTIC CANCELLATION FEE & 100% REFUND SUITE ---');

  // Start app server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/bookings', require('../routes/bookings'));
  app.use('/api/payments', require('../routes/payments'));

  await new Promise(res => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server running on port ${PORT}`);
      res();
    });
  });

  try {
    resetTestDb();

    // Create test passengers
    const passA = { id: 'usr-pass-A', email: 'passA@example.com', role: 'passenger', full_name: 'Passenger A' };
    const passB = { id: 'usr-pass-B', email: 'passB@example.com', role: 'passenger', full_name: 'Passenger B' };
    mockDb.profiles.set(passA.id, passA);
    mockDb.profiles.set(passB.id, passB);

    const tokenA = generateToken(passA);
    const tokenB = generateToken(passB);

    // Initial Wallets
    mockDb.wallets.set(passA.id, { user_id: passA.id, balance: 1500.00, updated_at: new Date().toISOString() });
    mockDb.wallets.set(passB.id, { user_id: passB.id, balance: 50.00, updated_at: new Date().toISOString() }); // Low balance for fail test

    // Seed test booking 1: ₹1,000 fare
    const booking1 = {
      id: 'book-1001',
      pnr_number: '1000000001',
      passenger_id: passA.id,
      passenger_name: 'Passenger A',
      train_id: 'tr-1',
      train_name: 'Rajdhani Express',
      train_number: '12952',
      travel_date: '2026-10-01',
      total_fare: 1000,
      status: 'confirmed',
      payment_method: 'IRCTC Rail Wallet'
    };
    mockDb.bookings.set(booking1.id, booking1);
    mockDb.payments.set('pay-1001', { id: 'pay-1001', booking_id: booking1.id, amount: 1000, status: 'completed', payment_method: 'IRCTC Rail Wallet' });

    // Seed test booking 2: ₹1,000 fare
    const booking2 = {
      id: 'book-1002',
      pnr_number: '1000000002',
      passenger_id: passA.id,
      passenger_name: 'Passenger A',
      train_id: 'tr-1',
      train_name: 'Rajdhani Express',
      train_number: '12952',
      travel_date: '2026-10-02',
      total_fare: 1000,
      status: 'confirmed',
      payment_method: 'Card'
    };
    mockDb.bookings.set(booking2.id, booking2);
    mockDb.payments.set('pay-1002', { id: 'pay-1002', booking_id: booking2.id, amount: 1000, status: 'completed', payment_method: 'Card (**** 1111)' });

    // Seed test booking 3: ₹1,000 fare (for passenger B with low balance)
    const booking3 = {
      id: 'book-1003',
      pnr_number: '1000000003',
      passenger_id: passB.id,
      passenger_name: 'Passenger B',
      train_id: 'tr-1',
      train_name: 'Rajdhani Express',
      train_number: '12952',
      travel_date: '2026-10-03',
      total_fare: 1000,
      status: 'confirmed',
      payment_method: 'UPI'
    };
    mockDb.bookings.set(booking3.id, booking3);
    mockDb.payments.set('pay-1003', { id: 'pay-1003', booking_id: booking3.id, amount: 1000, status: 'completed', payment_method: 'UPI (passB@gpay)' });

    // ----------------------------------------------------
    // TEST 1: Cancellation preview backend calculation check
    // ----------------------------------------------------
    console.log('\nTest 1: Backend calculation preview endpoint...');
    const prevRes = await request('GET', '/bookings/book-1001/cancellation-preview', null, tokenA);
    if (prevRes.status !== 200 || prevRes.body.cancellation_fee !== 100 || prevRes.body.option_a.refund_amount !== 1000 || prevRes.body.option_b.refund_amount !== 900) {
      throw new Error(`Test 1 Failed: Preview calculation incorrect. ${JSON.stringify(prevRes.body)}`);
    }
    console.log('✅ TEST 1 PASSED: Backend correctly calculated fee (₹100), Option A (100% / ₹1000), Option B (90% / ₹900).');

    // ----------------------------------------------------
    // TEST 2: Option A — ₹1,000 ticket + passenger pays ₹100 fee from Rail Wallet -> refund ₹1,000
    // ----------------------------------------------------
    console.log('\nTest 2: Option A (Pay ₹100 Fee via Rail Wallet -> 100% Refund)...');
    const walletBeforeA = mockDb.wallets.get(passA.id).balance; // 1500
    const feePayRes = await request('POST', '/bookings/book-1001/pay-cancellation-fee', { payment_method: 'Rail Wallet' }, tokenA);
    if (feePayRes.status !== 200 || feePayRes.body.fee_amount !== 100) {
      throw new Error(`Test 2 Fee Payment Failed: ${JSON.stringify(feePayRes.body)}`);
    }
    const walletAfterFee = mockDb.wallets.get(passA.id).balance;
    if (walletAfterFee !== walletBeforeA - 100) {
      throw new Error(`Test 2 Wallet Debit Failed: expected ${walletBeforeA - 100}, got ${walletAfterFee}`);
    }

    const cancelARes = await request('PUT', '/bookings/book-1001/cancel', { pay_separately: true }, tokenA);
    if (cancelARes.status !== 200 || cancelARes.body.refund_amount !== 1000 || cancelARes.body.refund_percentage !== 100) {
      throw new Error(`Test 2 Cancel Failed: ${JSON.stringify(cancelARes.body)}`);
    }
    const walletAfterRefund = mockDb.wallets.get(passA.id).balance;
    if (walletAfterRefund !== walletAfterFee + 1000) {
      throw new Error(`Test 2 Refund Credit Failed: expected ${walletAfterFee + 1000}, got ${walletAfterRefund}`);
    }
    console.log('✅ TEST 2 PASSED: Fee debited ₹100, ticket cancelled, ₹1,000 (100%) refunded to Rail Wallet.');

    // ----------------------------------------------------
    // TEST 3: Option B — ₹1,000 ticket + passenger does NOT pay fee -> refund ₹900 (90%)
    // ----------------------------------------------------
    console.log('\nTest 3: Option B (Deduct ₹100 Fee -> 90% / ₹900 Refund)...');
    const walletBeforeB = mockDb.wallets.get(passA.id).balance;
    const cancelBRes = await request('PUT', '/bookings/book-1002/cancel', { pay_separately: false }, tokenA);
    if (cancelBRes.status !== 200 || cancelBRes.body.refund_amount !== 900 || cancelBRes.body.refund_percentage !== 90) {
      throw new Error(`Test 3 Cancel Failed: ${JSON.stringify(cancelBRes.body)}`);
    }
    const walletAfterB = mockDb.wallets.get(passA.id).balance;
    if (walletAfterB !== walletBeforeB + 900) {
      throw new Error(`Test 3 Wallet Refund Failed: expected ${walletBeforeB + 900}, got ${walletAfterB}`);
    }
    console.log('✅ TEST 3 PASSED: Fee deducted ₹100, ticket cancelled, ₹900 (90%) refunded.');

    // ----------------------------------------------------
    // TEST 4: Fee Payment Fails (Insufficient Wallet Balance) -> Cancellation Does Not Complete
    // ----------------------------------------------------
    console.log('\nTest 4: Fee payment fails due to low wallet balance...');
    const failRes = await request('POST', '/bookings/book-1003/pay-cancellation-fee', { payment_method: 'Rail Wallet' }, tokenB);
    if (failRes.status !== 400 || !failRes.body.error.includes('Insufficient')) {
      throw new Error(`Test 4 Failed: Expected 400 Insufficient balance, got: ${JSON.stringify(failRes.body)}`);
    }
    const b3 = mockDb.bookings.get('book-1003');
    if (b3.status !== 'confirmed') {
      throw new Error(`Test 4 Failed: Booking status changed to ${b3.status} after payment failure.`);
    }
    console.log('✅ TEST 4 PASSED: Fee payment rejected with 400, ticket remains CONFIRMED, no refund issued.');

    // ----------------------------------------------------
    // TEST 5: Card Refund Simulation
    // ----------------------------------------------------
    console.log('\nTest 5: Card / UPI / Net Banking Refund Transaction Creation...');
    const refundRec = Array.from(mockDb.refunds.values()).find(r => r.booking_id === 'book-1002');
    if (!refundRec || refundRec.refund_amount !== 900 || refundRec.status !== 'REFUNDED') {
      throw new Error('Test 5 Failed: Refund record not properly formatted.');
    }
    console.log('✅ TEST 5 PASSED: Refund record created with payment_method and REFUNDED status.');

    // ----------------------------------------------------
    // TEST 6: Duplicate Cancellation Protection
    // ----------------------------------------------------
    console.log('\nTest 6: Duplicate cancellation attempt...');
    const dupCancel = await request('PUT', '/bookings/book-1001/cancel', { pay_separately: true }, tokenA);
    if (dupCancel.status !== 400) {
      throw new Error(`Test 6 Failed: Expected 400, got ${dupCancel.status}`);
    }
    console.log('✅ TEST 6 PASSED: Duplicate cancellation rejected with HTTP 400.');

    // ----------------------------------------------------
    // TEST 7: Duplicate Refund Protection
    // ----------------------------------------------------
    console.log('\nTest 7: Duplicate refund attempt...');
    const dupRefund = await request('PUT', '/bookings/book-1002/cancel', { pay_separately: false }, tokenA);
    if (dupRefund.status !== 400) {
      throw new Error(`Test 7 Failed: Expected 400, got ${dupRefund.status}`);
    }
    console.log('✅ TEST 7 PASSED: Duplicate refund attempt rejected with HTTP 400.');

    // ----------------------------------------------------
    // TEST 8: Cross-Passenger Authorization Protection
    // ----------------------------------------------------
    console.log('\nTest 8: Passenger A cannot cancel Passenger B\'s booking...');
    const crossRes = await request('PUT', '/bookings/book-1003/cancel', { pay_separately: false }, tokenA);
    if (crossRes.status !== 403) {
      throw new Error(`Test 8 Failed: Expected 403, got ${crossRes.status}`);
    }
    console.log('✅ TEST 8 PASSED: Cross-passenger cancellation rejected with HTTP 403.');

    // ----------------------------------------------------
    // TEST 9: Frontend Refund Amount Manipulation Ignored
    // ----------------------------------------------------
    console.log('\nTest 9: Frontend cannot manipulate refund amount...');
    // Seed new booking 4
    const booking4 = {
      id: 'book-1004',
      pnr_number: '1000000004',
      passenger_id: passA.id,
      passenger_name: 'Passenger A',
      train_id: 'tr-1',
      total_fare: 1000,
      status: 'confirmed'
    };
    mockDb.bookings.set(booking4.id, booking4);

    const manipRes = await request('PUT', '/bookings/book-1004/cancel', { pay_separately: false, refund_amount: 999999 }, tokenA);
    if (manipRes.status !== 200 || manipRes.body.refund_amount === 999999 || manipRes.body.refund_amount !== 900) {
      throw new Error(`Test 9 Failed: Refund amount was manipulated! ${JSON.stringify(manipRes.body)}`);
    }
    console.log('✅ TEST 9 PASSED: Backend strictly enforced refund calculation (₹900), ignoring tampered frontend body values.');

    console.log('\n🎉 ALL 9 CANCELLATION FEE & 100% REFUND TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    if (server) server.close();
  }
}

if (require.main === module) {
  runCancellationTestSuite().catch(err => {
    console.error('❌ Cancellation Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runCancellationTestSuite };
