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
const trainRoutes = require('../routes/trains');
const authRoutes = require('../routes/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

// Initialize Test Server
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/auth', authRoutes);

const server = http.createServer(app);
const PORT = 5098;

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

const userPassenger = { id: 'usr-rac-wl-test-1', email: 'racwlpassenger@test.com', role: 'passenger' };
const tokenPassenger = generateToken(userPassenger);

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
  console.log('\n--- 🧪 RUNNING RAC/WL SEAT SELECTION & REALISTIC PAYMENT FLOW TESTS ---');

  const runId = Date.now();

  // Seed train and wallet data
  const testTrainId = 't-rac-wl-test-train';
  mockDb.trains.set(testTrainId, {
    id: testTrainId,
    train_number: '99001',
    train_name: 'Test RAC/WL Express',
    source: 'NDLS',
    destination: 'MMCT',
    total_seats: 24,
    status: 'on_time'
  });

  if (!mockDb.wallets) mockDb.wallets = new Map();
  if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();
  mockDb.wallets.set('usr-rac-wl-test-1', { user_id: 'usr-rac-wl-test-1', balance: 5000.00 });

  // 1. Confirmed availability returns selectable seats
  console.log('\nTest 1: Confirmed availability seats query...');
  const res1 = await request({
    hostname: 'localhost', port: PORT, path: `/api/trains/${testTrainId}/seats?date=2026-09-15&coach_class=1A`, method: 'GET'
  });
  assert.strictEqual(res1.status, 200);
  assert(res1.data.seats && res1.data.seats.length > 0, 'Should return seat list for confirmed class');
  assert.strictEqual(res1.data.status, 'AVL');
  assert.strictEqual(res1.data.availability_status, 'AVAILABLE');
  console.log('✅ Test 1 Passed: Confirmed availability returns selectable seat layout & AVAILABLE status.');

  // 2 & 3. RAC Booking creation rejects fake seat assignment and sets status = rac
  console.log('\nTest 2 & 3: RAC Booking Creation & Malicious Seat ID Sanitization...');
  const res2 = await request({
    hostname: 'localhost', port: PORT, path: '/api/bookings/book', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, {
    train_id: testTrainId,
    travel_date: '2026-09-15',
    coach_class: '3A',
    status: 'RAC', // Force RAC mode
    passengers: [{ name: 'RAC Passenger', age: '32', gender: 'Male', seat_id: 'fake-seat-123' }],
    total_fare: 750,
    idempotency_key: `idemp-rac-test-${runId}`
  });

  assert.strictEqual(res2.status, 201);
  assert.strictEqual(res2.data.booking.status, 'rac', 'Booking status must be rac');
  assert.strictEqual(res2.data.allocations[0].seat_id, null, 'RAC allocation must set seat_id to null');
  console.log('✅ Test 2 & 3 Passed: RAC booking created with status rac and seat_id null.');

  // 4. RAC Booking Payment retains RAC status
  console.log('\nTest 4: RAC Payment completion retains RAC status...');
  const racBookingId = res2.data.booking.id;
  const res4 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, { booking_id: racBookingId });

  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.data.booking.status, 'rac', 'Payment must retain RAC status without auto-converting to confirmed');
  assert(res4.data.payment.payment_gateway_id, 'Payment must generate valid transaction ID');
  console.log('✅ Test 4 Passed: Successful payment retains RAC booking status and produces valid transaction ID.');

  // 5 & 6. WL Booking creation sets status = waitlist and seat_id = null
  console.log('\nTest 5 & 6: WL Booking Creation & Malicious Seat ID Sanitization...');
  const res5 = await request({
    hostname: 'localhost', port: PORT, path: '/api/bookings/book', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, {
    train_id: testTrainId,
    travel_date: '2026-09-15',
    coach_class: 'SL',
    status: 'WL', // Force WL mode
    passengers: [{ name: 'WL Passenger', age: '28', gender: 'Female', seat_id: 'fake-seat-456' }],
    total_fare: 450,
    idempotency_key: `idemp-wl-test-${runId}`
  });

  assert.strictEqual(res5.status, 201);
  assert.strictEqual(res5.data.booking.status, 'waitlist', 'Booking status must be waitlist');
  assert.strictEqual(res5.data.allocations[0].seat_id, null, 'WL allocation must set seat_id to null');
  console.log('✅ Test 5 & 6 Passed: WL booking created with status waitlist and seat_id null.');

  // 7. WL Booking Payment retains WL status
  console.log('\nTest 7: WL Payment completion retains WL status...');
  const wlBookingId = res5.data.booking.id;
  const res7 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, { booking_id: wlBookingId, amount: 450 });

  assert.strictEqual(res7.status, 200);
  assert.strictEqual(res7.data.booking.status, 'waitlist', 'Payment must retain WL status');
  console.log('✅ Test 7 Passed: Successful payment retains WL status.');

  // 8, 9, 11. Payment Failure on Insufficient Balance does not confirm booking or debit wallet
  console.log('\nTest 8, 9, 11: Insufficient Balance Payment Failure Handling...');
  mockDb.wallets.set('usr-rac-wl-test-1', { user_id: 'usr-rac-wl-test-1', balance: 50.00 }); // Low balance
  const res8 = await request({
    hostname: 'localhost', port: PORT, path: '/api/bookings/book', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, {
    train_id: testTrainId, travel_date: '2026-09-16', coach_class: '2A',
    passengers: [{ name: 'Low Bal Pax', age: '40', gender: 'Male' }],
    total_fare: 1500, idempotency_key: `idemp-lowbal-${runId}`
  });

  const lowBalBookingId = res8.data.booking.id;
  const res9 = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, { booking_id: lowBalBookingId });

  assert.strictEqual(res9.status, 400);
  assert(res9.data.error.includes('Insufficient Rail Wallet balance'));
  assert.strictEqual(mockDb.wallets.get('usr-rac-wl-test-1').balance, 50.00, 'Wallet balance must not be deducted on failure');
  console.log('✅ Test 8, 9, 11 Passed: Insufficient balance rejects payment without deducting wallet or confirming booking.');

  // 12. Idempotent Payment Processing
  console.log('\nTest 12: Idempotent Payment Processing...');
  mockDb.wallets.set('usr-rac-wl-test-1', { user_id: 'usr-rac-wl-test-1', balance: 2000.00 });
  const res12_first = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, { booking_id: lowBalBookingId });

  assert.strictEqual(res12_first.status, 200);
  assert.strictEqual(res12_first.data.wallet_balance, 500.00, 'Wallet balance should be 2000 - 1500 = 500');

  const res12_repeat = await request({
    hostname: 'localhost', port: PORT, path: '/api/payments/wallet/pay', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPassenger}` }
  }, { booking_id: lowBalBookingId });

  assert.strictEqual(res12_repeat.status, 200);
  assert.strictEqual(res12_repeat.data.wallet_balance, 500.00, 'Duplicate payment request must be idempotent');
  console.log('✅ Test 12 Passed: Repeated payment request is idempotent and does not double debit.');

  // 13, 14, 15. PNR Retention, Transaction ID Generation & Security Audit
  console.log('\nTest 13, 14, 15: PNR Retention, Transaction ID & Card Data Security...');
  const savedBooking = mockDb.bookings.get(lowBalBookingId);
  const savedPayments = Array.from(mockDb.payments.values()).filter(p => p.booking_id === lowBalBookingId);
  
  assert(savedBooking.pnr_number && savedBooking.pnr_number.length === 10, 'PNR must be a valid 10-digit string');
  assert(savedPayments[0].payment_gateway_id, 'Payment entry must contain transaction ID');
  
  // Verify no raw card numbers / CVV exist in payments table
  savedPayments.forEach(p => {
    assert.strictEqual(p.card_number, undefined, 'Raw card number must never be stored');
    assert.strictEqual(p.cvv, undefined, 'CVV must never be stored');
    assert.strictEqual(p.pin, undefined, 'PIN must never be stored');
  });
  console.log('✅ Test 13, 14, 15 Passed: PNR retained, transaction ID recorded, no card credentials stored.');

  console.log('\n🎉 ALL RAC/WL SEAT SELECTION & REALISTIC PAYMENT FLOW TESTS PASSED! 🎉\n');
  server.close();
}

server.listen(PORT, () => {
  runTests().catch(err => {
    console.error('❌ REGRESSION TEST FAILED:', err);
    server.close();
    process.exit(1);
  });
});
