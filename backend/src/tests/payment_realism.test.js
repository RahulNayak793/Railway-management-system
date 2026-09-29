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
const adminRoutes = require('../routes/admin');
const authRoutes = require('../routes/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

// Initialize Test Server
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

const server = http.createServer(app);
const PORT = 5099;

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

const userPassenger1 = { id: 'usr-pay-test-1', email: 'passenger1@test.com', role: 'passenger' };
const userPassenger2 = { id: 'usr-pay-test-2', email: 'passenger2@test.com', role: 'passenger' };
const userAdmin = { id: 'usr-admin-test-1', email: 'admin@test.com', role: 'admin' };

const tokenPassenger1 = generateToken(userPassenger1);
const tokenPassenger2 = generateToken(userPassenger2);
const tokenAdmin = generateToken(userAdmin);

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
  console.log('\n--- 🧪 RUNNING PAYMENT SYSTEM REALISM & SECURITY TESTS ---');

  // Setup seed mockDb records for testing
  mockDb.bookings.set('bk-test-pay-1', {
    id: 'bk-test-pay-1',
    passenger_id: 'usr-pay-test-1',
    train_id: 't-test-1',
    pnr_number: '1122334455',
    status: 'pending_payment',
    total_fare: 850.00,
    travel_date: '2026-09-12',
    created_at: new Date().toISOString()
  });

  mockDb.bookings.set('bk-test-pay-2', {
    id: 'bk-test-pay-2',
    passenger_id: 'usr-pay-test-2',
    train_id: 't-test-1',
    pnr_number: '9988776655',
    status: 'pending_payment',
    total_fare: 1200.00,
    travel_date: '2026-09-12',
    created_at: new Date().toISOString()
  });

  // Set initial wallet balances
  if (!mockDb.wallets) mockDb.wallets = new Map();
  if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();
  mockDb.wallets.set('usr-pay-test-1', { user_id: 'usr-pay-test-1', balance: 2500.00 });
  mockDb.wallets.set('usr-pay-test-2', { user_id: 'usr-pay-test-2', balance: 300.00 }); // Low balance

  // 1. Authoritative Server Fare & Amount Verification Test
  console.log('\nTest 1: Server Fare Calculation & Client Fare Override Rejection...');
  const res1 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger1}` }
  }, { booking_id: 'bk-test-pay-1', amount: 50.00 }); // Attempted client fare tampering (₹50 vs ₹850)

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.payment.amount, 850.00, 'Server must enforce booking.total_fare over client amount');
  console.log('✅ Test 1 Passed: Server total_fare enforced accurately.');

  // 2. Ownership Check: Passenger cannot pay another passenger\'s booking
  console.log('\nTest 2: Payment Ownership Bypass Rejection...');
  const res2 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger1}` }
  }, { booking_id: 'bk-test-pay-2' }); // Passenger 1 trying to pay Passenger 2's booking

  assert.strictEqual(res2.status, 403, 'Unauthorized passenger payment attempt must return 403');
  console.log('✅ Test 2 Passed: Unauthorized payment attempt rejected with 403.');

  // 3. Rail Wallet Balance Check: Insufficient balance rejection
  console.log('\nTest 3: Rail Wallet Insufficient Balance Rejection...');
  const res3 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger2}` }
  }, { booking_id: 'bk-test-pay-2' }); // Fare ₹1200, Wallet balance ₹300

  assert.strictEqual(res3.status, 400);
  assert(res3.data.error.includes('Insufficient Rail Wallet balance'), 'Low balance must be rejected');
  console.log('✅ Test 3 Passed: Insufficient wallet balance correctly rejected.');

  // 4. Rail Wallet Atomic Checkout & Idempotency Test
  console.log('\nTest 4: Rail Wallet Atomic Payment & Idempotency...');
  mockDb.bookings.set('bk-test-pay-wallet-1', {
    id: 'bk-test-pay-wallet-1',
    passenger_id: 'usr-pay-test-1',
    train_id: 't-test-1',
    pnr_number: '5544332211',
    status: 'pending_payment',
    total_fare: 850.00,
    travel_date: '2026-09-12',
    created_at: new Date().toISOString()
  });

  const res4 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger1}` }
  }, { booking_id: 'bk-test-pay-wallet-1' });

  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.data.wallet_balance, 1650.00, 'Wallet balance should be 2500 - 850 = 1650');
  
  // Repeated payment request with same booking (Idempotency)
  const res4_repeat = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger1}` }
  }, { booking_id: 'bk-test-pay-wallet-1' });

  assert.strictEqual(res4_repeat.status, 200);
  assert.strictEqual(res4_repeat.data.wallet_balance, 1650.00, 'Repeated payment must not deduct wallet balance twice');
  console.log('✅ Test 4 Passed: Rail Wallet payment debited atomically & repeated request is idempotent.');

  // 5. Payment History Ownership Enforced
  console.log('\nTest 5: Payment History Ownership Enforced...');
  const res5 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/history', method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenPassenger2}` }
  });

  assert.strictEqual(res5.status, 200);
  const p2Records = res5.data.filter(p => p.booking_id === 'bk-test-pay-1');
  assert.strictEqual(p2Records.length, 0, 'Passenger 2 must not see Passenger 1 payment records');
  console.log('✅ Test 5 Passed: Payment history strictly isolated to booking owner.');

  // 6. Admin Payment Management Endpoint
  console.log('\nTest 6: Admin Financial Audit Access...');
  const res6 = await request({
    hostname: 'localhost', port: PORT, path: '/api/admin/payments', method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });

  assert.strictEqual(res6.status, 200);
  assert(Array.isArray(res6.data), 'Admin should receive list of all payment transactions');
  console.log('✅ Test 6 Passed: Admin can access financial audit records.');

  console.log('\n🎉 ALL PAYMENT SYSTEM REALISM & SECURITY TESTS PASSED! 🎉\n');
  server.close();
}

server.listen(PORT, () => {
  runTests().catch(err => {
    console.error('❌ PAYMENT TEST FAILED:', err);
    server.close();
    process.exit(1);
  });
});
