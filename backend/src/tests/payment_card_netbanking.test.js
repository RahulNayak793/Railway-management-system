const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const assert = require('assert');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const paymentRoutes = require('../routes/payments');
const bookingRoutes = require('../routes/bookings');
const authRoutes = require('../routes/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/auth', authRoutes);

const server = http.createServer(app);
const PORT = 5098;

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

const passengerA = { id: 'usr-wallet-owner-A', email: 'passenger_A@example.com', role: 'passenger' };
const passengerB = { id: 'usr-wallet-owner-B', email: 'passenger_B@example.com', role: 'passenger' };

const tokenA = generateToken(passengerA);
const tokenB = generateToken(passengerB);

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: json || data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n--- 🧪 RUNNING MASTER REALISTIC PAYMENT SUITE TESTS ---');

  // Seed test records
  const bookingA = {
    id: 'bk-master-test-A',
    passenger_id: passengerA.id,
    train_id: 't-test-1',
    pnr_number: '9988776655',
    status: 'pending_payment',
    total_fare: 850.00,
    travel_date: '2026-10-20',
    created_at: new Date().toISOString()
  };
  mockDb.bookings.set(bookingA.id, bookingA);

  const bookingB = {
    id: 'bk-master-test-B',
    passenger_id: passengerB.id,
    train_id: 't-test-1',
    pnr_number: '1122334455',
    status: 'pending_payment',
    total_fare: 1200.00,
    travel_date: '2026-10-20',
    created_at: new Date().toISOString()
  };
  mockDb.bookings.set(bookingB.id, bookingB);

  if (!mockDb.wallets) mockDb.wallets = new Map();
  if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

  mockDb.wallets.set(passengerA.id, { user_id: passengerA.id, balance: 2450.00 });
  mockDb.wallets.set(passengerB.id, { user_id: passengerB.id, balance: 500.00 });

  // ---------------------------------------------------------
  // SECTION 1: UPI TESTS
  // ---------------------------------------------------------
  console.log('\n--- 1. UPI TESTS ---');

  console.log('Test 1.1: Invalid UPI format rejected...');
  const res1_1 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'UPI', upi_id: 'invalidupiformat' });
  assert.strictEqual(res1_1.status, 400);
  assert(res1_1.data.error.includes('Invalid UPI ID format'));
  console.log('✅ Test 1.1 Passed: Invalid UPI format rejected with HTTP 400.');

  console.log('Test 1.2: Valid UPI mock payment succeeds...');
  const res1_2 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'UPI', upi_id: 'testuser@gpay' });
  assert.strictEqual(res1_2.status, 200);
  assert.strictEqual(res1_2.data.booking.status, 'confirmed');
  assert(res1_2.data.payment.payment_method.includes('testuser@gpay'));
  console.log('✅ Test 1.2 Passed: Valid UPI test payment succeeded.');

  // Reset bookingA status for further tests
  bookingA.status = 'pending_payment';
  mockDb.bookings.set(bookingA.id, bookingA);

  // ---------------------------------------------------------
  // SECTION 2: CARD TESTS
  // ---------------------------------------------------------
  console.log('\n--- 2. CARD TESTS ---');

  console.log('Test 2.1: Cardholder name required check...');
  const res2_1 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'CARD', card_details: { cardholder_name: '', card_number: '4111111111111111', card_expiry: '12/30', card_cvv: '123' } });
  assert.strictEqual(res2_1.status, 400);
  assert(res2_1.data.error.includes('Cardholder name is required'));
  console.log('✅ Test 2.1 Passed: Missing cardholder name rejected with HTTP 400.');

  console.log('Test 2.2: Invalid card number format rejected...');
  const res2_2 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'CARD', card_details: { cardholder_name: 'Rahul Kumar', card_number: '123', card_expiry: '12/30', card_cvv: '123' } });
  assert.strictEqual(res2_2.status, 400);
  assert(res2_2.data.error.includes('Invalid card number format'));
  console.log('✅ Test 2.2 Passed: Invalid card number rejected with HTTP 400.');

  console.log('Test 2.3: Expired card rejected...');
  const res2_3 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'CARD', card_details: { cardholder_name: 'Rahul Kumar', card_number: '4111111111111111', card_expiry: '01/22', card_cvv: '123' } });
  assert.strictEqual(res2_3.status, 400);
  assert(res2_3.data.error.includes('expired'));
  console.log('✅ Test 2.3 Passed: Expired card date rejected with HTTP 400.');

  console.log('Test 2.4: Invalid CVV rejected...');
  const res2_4 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'CARD', card_details: { cardholder_name: 'Rahul Kumar', card_number: '4111111111111111', card_expiry: '12/30', card_cvv: '12' } });
  assert.strictEqual(res2_4.status, 400);
  assert(res2_4.data.error.includes('CVV is required'));
  console.log('✅ Test 2.4 Passed: Invalid CVV rejected with HTTP 400.');

  console.log('Test 2.5: Valid Card test payment succeeds with masked method...');
  const res2_5 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'CARD', card_details: { cardholder_name: 'Rahul Kumar', card_number: '4111 1111 1111 1111', card_expiry: '12/30', card_cvv: '123' } });
  assert.strictEqual(res2_5.status, 200);
  assert.strictEqual(res2_5.data.booking.status, 'confirmed');
  assert(res2_5.data.payment.payment_method.includes('**** 1111'));
  console.log('✅ Test 2.5 Passed: Valid card payment succeeded with masked card method.');

  // Reset bookingA status
  bookingA.status = 'pending_payment';
  mockDb.bookings.set(bookingA.id, bookingA);

  // ---------------------------------------------------------
  // SECTION 3: NET BANKING TESTS
  // ---------------------------------------------------------
  console.log('\n--- 3. NET BANKING TESTS ---');

  console.log('Test 3.1: Bank selection required...');
  const res3_1 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'NETBANK', netbanking_details: { bank_name: '', user_id: 'sbi_user_123' } });
  assert.strictEqual(res3_1.status, 400);
  assert(res3_1.data.error.includes('Bank selection is required'));
  console.log('✅ Test 3.1 Passed: Missing bank selection rejected with HTTP 400.');

  console.log('Test 3.2: User ID required...');
  const res3_2 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'NETBANK', netbanking_details: { bank_name: 'State Bank of India', user_id: '' } });
  assert.strictEqual(res3_2.status, 400);
  assert(res3_2.data.error.includes('User ID is required'));
  console.log('✅ Test 3.2 Passed: Missing user ID rejected with HTTP 400.');

  console.log('Test 3.3: Valid Net Banking test payment succeeds...');
  const res3_3 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id, payment_method: 'NETBANK', netbanking_details: { bank_name: 'State Bank of India', user_id: 'sbi_user_123' } });
  assert.strictEqual(res3_3.status, 200);
  assert.strictEqual(res3_3.data.booking.status, 'confirmed');
  assert(res3_3.data.payment.payment_method.includes('State Bank of India'));
  console.log('✅ Test 3.3 Passed: Net Banking test payment succeeded.');

  // Reset bookingA status
  bookingA.status = 'pending_payment';
  mockDb.bookings.set(bookingA.id, bookingA);

  // ---------------------------------------------------------
  // SECTION 4: RAIL WALLET TESTS & IDEMPOTENCY
  // ---------------------------------------------------------
  console.log('\n--- 4. RAIL WALLET TESTS & IDEMPOTENCY ---');

  console.log('Test 4.1: Insufficient Rail Wallet balance rejected...');
  const res4_1 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` }
  }, { booking_id: bookingB.id }); // Fare ₹1200, Available ₹500
  assert.strictEqual(res4_1.status, 400);
  assert(res4_1.data.error.includes('Insufficient Rail Wallet balance'));
  console.log('✅ Test 4.1 Passed: Insufficient wallet balance rejected with HTTP 400.');

  console.log('Test 4.2: Passenger cannot pay another passenger\'s booking...');
  const res4_2 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingB.id }); // Passenger A trying to pay Passenger B's booking
  assert.strictEqual(res4_2.status, 403);
  assert(res4_2.data.error.includes('Access denied'));
  console.log('✅ Test 4.2 Passed: Unauthorized cross-passenger payment attempt rejected with HTTP 403.');

  console.log('Test 4.3: Sufficient balance → Payment succeeds & debits wallet balance exactly once...');
  const res4_3 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id }); // Fare ₹850, Available ₹2450
  assert.strictEqual(res4_3.status, 200);
  assert.strictEqual(res4_3.data.wallet_balance_before, 2450.00);
  assert.strictEqual(res4_3.data.wallet_balance_after, 1600.00); // 2450 - 850 = 1600
  assert.strictEqual(res4_3.data.booking.status, 'confirmed');
  console.log('✅ Test 4.3 Passed: Rail Wallet balance debited from ₹2,450.00 to ₹1,600.00.');

  console.log('Test 4.4: Duplicate pay request is idempotent and does NOT deduct wallet twice...');
  const res4_4 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  }, { booking_id: bookingA.id }); // Repeat payment request
  assert.strictEqual(res4_4.status, 200);
  assert.strictEqual(res4_4.data.wallet_balance, 1600.00); // Wallet balance stays 1600
  assert(res4_4.data.message.includes('Idempotent'));
  console.log('✅ Test 4.4 Passed: Duplicate payment attempt handled idempotently without double deduction.');

  // ---------------------------------------------------------
  // SECTION 5: SECURITY & SENSITIVE DATA AUDIT
  // ---------------------------------------------------------
  console.log('\n--- 5. SECURITY & SENSITIVE DATA AUDIT ---');

  console.log('Test 5.1: Zero sensitive card/bank credentials in database...');
  const storedPayments = Array.from(mockDb.payments.values());
  for (const pay of storedPayments) {
    assert.strictEqual(pay.card_number, undefined, 'Full card number must NEVER be stored');
    assert.strictEqual(pay.card_cvv, undefined, 'CVV must NEVER be stored');
    assert.strictEqual(pay.card_pin, undefined, 'Card PIN must NEVER be stored');
    assert.strictEqual(pay.otp, undefined, 'OTP must NEVER be stored');
    assert.strictEqual(pay.bank_password, undefined, 'Bank password must NEVER be stored');
  }
  console.log('✅ Test 5.1 Passed: Zero sensitive credentials found in database.');

  saveMockDbToFile();
  console.log('\n🎉 ALL MASTER REALISTIC PAYMENT SUITE TESTS PASSED SUCCESSFULLY! 🎉\n');
  server.close();
}

server.listen(PORT, () => {
  runTests().catch(err => {
    console.error('❌ MASTER PAYMENT TEST FAILED:', err);
    server.close();
    process.exit(1);
  });
});
