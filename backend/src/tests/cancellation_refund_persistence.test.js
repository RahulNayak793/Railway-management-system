const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-canc-persistence-db.json');
process.env.MOCK_MODE = 'true';
process.env.PERSISTENCE_TEST = 'true';

const fs = require('fs');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const assert = require('assert');

const supabaseModule = require('../config/supabase');
const { mockDb, saveMockDbToFile } = supabaseModule;

const adminRoutes = require('../routes/admin');
const bookingRoutes = require('../routes/bookings');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

function createServerApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/bookings', bookingRoutes);
  return app;
}

let app = createServerApp();
let server;
const PORT = 5098;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function makeRequest(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: pathUrl,
      method,
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
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
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

const passengerUser = {
  id: 'usr-test-passenger-101',
  email: 'testpassenger101@railway.com',
  role: 'passenger',
  full_name: 'Test Passenger 101'
};

const passengerUser2 = {
  id: 'usr-test-passenger-102',
  email: 'testpassenger102@railway.com',
  role: 'passenger',
  full_name: 'Test Passenger 102'
};

const adminUser = {
  id: 'usr-test-admin-101',
  email: 'admin101@railway.com',
  role: 'admin',
  full_name: 'Test Admin 101'
};

const passengerToken = jwt.sign(passengerUser, jwtSecret, { expiresIn: '1h' });
const passengerToken2 = jwt.sign(passengerUser2, jwtSecret, { expiresIn: '1h' });
const adminToken = jwt.sign(adminUser, jwtSecret, { expiresIn: '1h' });

function setupFreshBooking(id, pnr, fare = 1500, ownerId = passengerUser.id) {
  mockDb.bookings.set(id, {
    id,
    passenger_id: ownerId,
    train_id: 'train-canc-101',
    pnr_number: pnr,
    total_fare: fare,
    status: 'confirmed',
    travel_date: '2026-09-20',
    created_at: new Date().toISOString()
  });

  mockDb.seat_allocations.set(`alloc-${id}`, {
    id: `alloc-${id}`,
    booking_id: id,
    seat_id: `seat-${id}`,
    travel_date: '2026-09-20',
    passenger_name: 'Test Passenger',
    passenger_age: 30,
    passenger_gender: 'Male'
  });

  mockDb.cancellation_records.delete(id);
}

function getRecordsList(resBody) {
  if (Array.isArray(resBody)) return resBody;
  if (resBody && Array.isArray(resBody.records)) return resBody.records;
  return [];
}

async function runTests() {
  console.log('\n--- 🧪 RUNNING RAILCONTROL CANCELLATION & REFUND PERSISTENCE TESTS ---');

  const testDbPath = process.env.DB_FILE_PATH;
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  }

  mockDb.profiles.set(passengerUser.id, passengerUser);
  mockDb.profiles.set(passengerUser2.id, passengerUser2);
  mockDb.profiles.set(adminUser.id, adminUser);

  mockDb.trains.set('train-canc-101', {
    id: 'train-canc-101',
    train_number: '12999',
    train_name: 'Superfast Test Express',
    source: 'NDLS',
    destination: 'MMCT',
    status: 'on_time'
  });

  saveMockDbToFile();
  await startServer();

  try {
    // 1. Passenger cancellation updates booking status and creates permanent cancellation_records row
    console.log('Test 1: Passenger cancellation updates booking status and creates cancellation record...');
    setupFreshBooking('bk-t1', '9000000001');
    const res1 = await makeRequest('PUT', '/api/bookings/bk-t1/cancel', { reason: 'Personal Emergency' }, passengerToken);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.booking.status, 'cancelled');
    const cancRecord1 = mockDb.cancellation_records.get('bk-t1');
    assert.ok(cancRecord1);
    assert.strictEqual(cancRecord1.pnr, '9000000001');
    assert.strictEqual(cancRecord1.cancellation_type, 'passenger');
    assert.strictEqual(cancRecord1.cancellation_reason, 'Personal Emergency');
    console.log('✅ Test 1 Passed.');

    // 2. Passenger cancellation appears in GET /api/admin/refunds
    console.log('Test 2: Passenger cancellation appears in GET /api/admin/refunds...');
    setupFreshBooking('bk-t2', '9000000002');
    await makeRequest('PUT', '/api/bookings/bk-t2/cancel', { reason: 'Medical Reason' }, passengerToken);
    const res2 = await makeRequest('GET', '/api/admin/refunds', null, adminToken);
    assert.strictEqual(res2.status, 200);
    const records2 = getRecordsList(res2.body);
    assert.ok(records2.length > 0);
    const found2 = records2.find(r => r.pnr === '9000000002' || r.booking_id === 'bk-t2');
    assert.ok(found2);
    assert.strictEqual(found2.cancelledBy, 'Passenger');
    assert.ok(Number(found2.refund_amount || found2.refundAmount) > 0);
    console.log('✅ Test 2 Passed.');

    // 3. Cancellation remains in GET /api/admin/refunds after multiple re-fetches
    console.log('Test 3: Multiple re-fetches maintain records...');
    setupFreshBooking('bk-t3', '9000000003');
    await makeRequest('PUT', '/api/bookings/bk-t3/cancel', { reason: 'Schedule Change' }, passengerToken);
    const res3a = await makeRequest('GET', '/api/admin/refunds', null, adminToken);
    const res3b = await makeRequest('GET', '/api/admin/refunds', null, adminToken);
    assert.ok(getRecordsList(res3a.body).some(r => r.pnr === '9000000003'));
    assert.ok(getRecordsList(res3b.body).some(r => r.pnr === '9000000003'));
    console.log('✅ Test 3 Passed.');

    // 4. Admin approval updates status to APPROVED and preserves the record
    console.log('Test 4: Admin approval updates status to APPROVED...');
    setupFreshBooking('bk-t4', '9000000004');
    await makeRequest('PUT', '/api/bookings/bk-t4/cancel', { reason: 'Need Refund' }, passengerToken);
    const res4 = await makeRequest('PUT', '/api/admin/refunds/bk-t4/action', { action: 'approve' }, adminToken);
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.body.cancellation_record?.refund_status, 'APPROVED');
    const checkRes4 = await makeRequest('GET', '/api/admin/refunds', null, adminToken);
    const found4 = getRecordsList(checkRes4.body).find(r => r.pnr === '9000000004');
    assert.ok(found4);
    assert.strictEqual(found4.status, 'APPROVED');
    console.log('✅ Test 4 Passed.');

    // 5. Admin rejection updates status to REJECTED and preserves the record
    console.log('Test 5: Admin rejection updates status to REJECTED...');
    setupFreshBooking('bk-t5', '9000000005');
    await makeRequest('PUT', '/api/bookings/bk-t5/cancel', { reason: 'Late Request' }, passengerToken);
    const res5 = await makeRequest('PUT', '/api/admin/refunds/bk-t5/action', { action: 'reject', reason: 'Invalid Claim Window' }, adminToken);
    assert.strictEqual(res5.status, 200);
    assert.strictEqual(res5.body.cancellation_record.refund_status, 'REJECTED');
    const checkRes5 = await makeRequest('GET', '/api/admin/refunds?status=Rejected', null, adminToken);
    const found5 = getRecordsList(checkRes5.body).find(r => r.pnr === '9000000005');
    assert.ok(found5);
    assert.strictEqual(found5.status, 'REJECTED');
    console.log('✅ Test 5 Passed.');

    // 6. Duplicate cancellation request is rejected with 400
    console.log('Test 6: Duplicate cancellation is rejected with 400...');
    setupFreshBooking('bk-t7', '9000000007');
    await makeRequest('PUT', '/api/bookings/bk-t7/cancel', {}, passengerToken);
    const res6 = await makeRequest('PUT', '/api/bookings/bk-t7/cancel', {}, passengerToken);
    assert.strictEqual(res6.status, 400);
    assert.ok(res6.body.error.includes('already cancelled'));
    console.log('✅ Test 6 Passed.');

    // 7. Admin cancellation creates cancellation_records entry
    console.log('Test 7: Admin cancellation creates cancellation record...');
    setupFreshBooking('bk-t8', '9000000008');
    const res7 = await makeRequest('PUT', '/api/bookings/bk-t8/cancel', { reason: 'Admin Discretion' }, adminToken);
    assert.strictEqual(res7.status, 200);
    const cancRecord7 = mockDb.cancellation_records.get('bk-t8');
    assert.ok(cancRecord7);
    assert.strictEqual(cancRecord7.cancellation_type, 'admin');
    assert.strictEqual(cancRecord7.cancelled_by_role, 'admin');
    console.log('✅ Test 7 Passed.');

    // 8. Train-level cancellation creates permanent records with 100% refund
    console.log('Test 8: Train-level cancellation creates records with 100% refund...');
    const trainId = 'train-disrupt-555';
    mockDb.trains.set(trainId, {
      id: trainId,
      train_number: '55555',
      train_name: 'Disrupted Express',
      status: 'on_time'
    });

    const bkId = 'bk-disrupt-88';
    mockDb.bookings.set(bkId, {
      id: bkId,
      passenger_id: passengerUser.id,
      train_id: trainId,
      pnr_number: '5555555555',
      total_fare: 2500,
      status: 'confirmed',
      travel_date: '2026-10-10',
      created_at: new Date().toISOString()
    });

    const res8 = await makeRequest('PATCH', `/api/admin/train-status/${trainId}`, {
      status: 'cancelled',
      reason: 'Severe Track Damage'
    }, adminToken);
    assert.strictEqual(res8.status, 200);
    const cancRecord8 = mockDb.cancellation_records.get(bkId);
    assert.ok(cancRecord8);
    assert.strictEqual(cancRecord8.cancellation_type, 'train_service');
    assert.strictEqual(cancRecord8.deduction_amount, 0);
    assert.strictEqual(cancRecord8.refund_amount, 2500);
    assert.strictEqual(cancRecord8.refund_status, 'APPROVED');
    console.log('✅ Test 8 Passed.');

    // 9. Unauthorized user cannot cancel another user booking
    console.log('Test 9: Unauthorized user cannot cancel another user booking...');
    setupFreshBooking('bk-t12', '9000000012', 1500, passengerUser2.id);
    const res9 = await makeRequest('PUT', '/api/bookings/bk-t12/cancel', {}, passengerToken);
    assert.strictEqual(res9.status, 403);
    assert.ok(res9.body.error.includes('Access denied'));
    console.log('✅ Test 9 Passed.');

    // 10. Backfill safely generates cancellation_records for cancelled bookings
    console.log('Test 10: Backfill safely generates records for pre-existing cancelled bookings...');
    const unledgeredBookingId = 'bk-unledgered-777';
    mockDb.bookings.set(unledgeredBookingId, {
      id: unledgeredBookingId,
      passenger_id: passengerUser.id,
      train_id: 'train-canc-101',
      pnr_number: '7777777777',
      total_fare: 1200,
      status: 'cancelled',
      travel_date: '2026-09-25',
      created_at: new Date().toISOString()
    });

    const res10 = await makeRequest('GET', '/api/admin/refunds', null, adminToken);
    assert.strictEqual(res10.status, 200);
    const found10 = getRecordsList(res10.body).find(r => r.pnr === '7777777777');
    assert.ok(found10);
    assert.ok(Number(found10.refund_amount || found10.refundAmount) > 0);
    console.log('✅ Test 10 Passed.');

    console.log('\n🎉 ALL CANCELLATION & ADMIN REFUND PERSISTENCE TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await stopServer();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
}
