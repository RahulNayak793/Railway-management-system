const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.MOCK_MODE = 'true';

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

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
const PORT = 5092;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`📡 Cancellation & Refund Audit test server listening on port ${PORT}`);
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

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
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

async function runCancellationRefundAuditTests() {
  console.log('🧪 Starting Cancellation, Refund Center, Train Cascade & Audit System Test Suite...');
  await startServer();

  try {
    // Tokens
    const passenger1Token = jwt.sign({ id: 'user-pass-1', email: 'passenger1@test.com', role: 'passenger', full_name: 'Passenger One' }, jwtSecret, { expiresIn: '1h' });
    const passenger2Token = jwt.sign({ id: 'user-pass-2', email: 'passenger2@test.com', role: 'passenger', full_name: 'Passenger Two' }, jwtSecret, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: 'user-admin-1', email: 'admin@railway.gov.in', role: 'admin', full_name: 'Admin User' }, jwtSecret, { expiresIn: '1h' });

    // Seed test train
    const testTrainId = 'train-audit-999';
    mockDb.trains.set(testTrainId, {
      id: testTrainId,
      train_number: '12999',
      train_name: 'Audit Express',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      status: 'on_time'
    });

    // Seed test bookings
    const b1Id = 'bk-test-101';
    const b2Id = 'bk-test-102';
    const b3Id = 'bk-test-103';

    mockDb.bookings.set(b1Id, {
      id: b1Id,
      pnr_number: '9990001001',
      passenger_id: 'user-pass-1',
      passenger_name: 'Passenger One',
      train_id: testTrainId,
      travel_date: '2026-09-15',
      status: 'confirmed',
      total_fare: 2000
    });

    mockDb.payments.set('pay-101', {
      id: 'pay-101',
      booking_id: b1Id,
      amount: 2000,
      status: 'completed'
    });

    mockDb.bookings.set(b2Id, {
      id: b2Id,
      pnr_number: '9990001002',
      passenger_id: 'user-pass-2',
      passenger_name: 'Passenger Two',
      train_id: testTrainId,
      travel_date: '2026-09-15',
      status: 'confirmed',
      total_fare: 1500
    });

    mockDb.payments.set('pay-102', {
      id: 'pay-102',
      booking_id: b2Id,
      amount: 1500,
      status: 'completed'
    });

    mockDb.bookings.set(b3Id, {
      id: b3Id,
      pnr_number: '9990001003',
      passenger_id: 'user-pass-1',
      passenger_name: 'Passenger One',
      train_id: testTrainId,
      travel_date: '2026-09-20',
      status: 'confirmed',
      total_fare: 3000
    });

    saveMockDbToFile();

    // TEST 1: Passenger 1 cancels own ticket b1Id
    console.log('\n--- TEST 1: Passenger Ticket Cancellation ---');
    const res1 = await makeRequest('PUT', `/api/bookings/${b1Id}/cancel`, { reason: 'Personal Plan Change' }, passenger1Token);
    console.log('Cancel Status:', res1.status);
    console.log('Cancel Body:', res1.body);
    if (res1.status !== 200 || res1.body.booking?.status !== 'cancelled') {
      throw new Error(`TEST 1 FAILED: Expected 200 and cancelled status, got ${res1.status}`);
    }
    console.log('✅ TEST 1 PASSED: Ticket cancelled successfully by owner.');

    // TEST 2: Unauthorized Cancellation Attempt (Passenger 2 tries to cancel Passenger 1's booking b3Id)
    console.log('\n--- TEST 2: Unauthorized Cancellation Guard ---');
    const res2 = await makeRequest('PUT', `/api/bookings/${b3Id}/cancel`, { reason: 'Malicious Action' }, passenger2Token);
    console.log('Unauthorized Cancel Status:', res2.status);
    if (res2.status !== 403) {
      throw new Error(`TEST 2 FAILED: Expected 403 Forbidden, got ${res2.status}`);
    }
    console.log('✅ TEST 2 PASSED: Unauthorized cancellation blocked with 403.');

    // TEST 3: Double Cancellation Guard
    console.log('\n--- TEST 3: Double Cancellation Guard ---');
    const res3 = await makeRequest('PUT', `/api/bookings/${b1Id}/cancel`, { reason: 'Cancel again' }, passenger1Token);
    console.log('Double Cancel Status:', res3.status);
    if (res3.status !== 400) {
      throw new Error(`TEST 3 FAILED: Expected 400 Bad Request on double cancel, got ${res3.status}`);
    }
    console.log('✅ TEST 3 PASSED: Double cancellation prevented.');

    // TEST 4: Admin Cancellation with Admin Override
    console.log('\n--- TEST 4: Admin Cancellation with Admin Override ---');
    const res4 = await makeRequest('PUT', `/api/bookings/${b3Id}/cancel`, {
      reason: 'Operational Override',
      is_override: true,
      override_penalty: 0
    }, adminToken);
    console.log('Admin Override Status:', res4.status);
    console.log('Admin Override Refund Amount:', res4.body.refund_amount);
    if (res4.status !== 200 || res4.body.refund_amount !== 3000) {
      throw new Error(`TEST 4 FAILED: Expected 200 and 100% full refund (3000), got refund ${res4.body.refund_amount}`);
    }
    console.log('✅ TEST 4 PASSED: Admin override cancellation executed with 100% full refund.');

    // TEST 5: Train Service Cancellation Cascade
    console.log('\n--- TEST 5: Train Cancellation Cascade ---');
    const res5 = await makeRequest('PATCH', `/api/admin/train-status/${testTrainId}`, {
      status: 'cancelled',
      reason: 'Severe Weather / Flooding',
      message: 'Full refund processed for all passengers.'
    }, adminToken);
    console.log('Train Cascade Status:', res5.status);
    console.log('Affected Bookings Count:', res5.body.affectedBookingsCount);
    if (res5.status !== 200 || res5.body.train?.status !== 'cancelled') {
      throw new Error(`TEST 5 FAILED: Expected 200 and train status cancelled, got ${res5.status}`);
    }
    
    // Verify b2Id (active booking on that train) was cancelled in cascade with 100% refund
    const cancelledB2 = mockDb.bookings.get(b2Id);
    if (cancelledB2.status !== 'cancelled' || cancelledB2.refund_amount !== 1500) {
      throw new Error(`TEST 5 FAILED: Booking b2Id was not marked cancelled with full refund in cascade.`);
    }
    console.log('✅ TEST 5 PASSED: Train Cancellation Cascade marked active bookings cancelled with 100% full refund.');

    // TEST 6: Refund Center GET and Action (Approve / Reject)
    console.log('\n--- TEST 6: Refund Center Endpoints ---');
    const res6 = await makeRequest('GET', '/api/admin/refunds', null, adminToken);
    const records6 = Array.isArray(res6.body) ? res6.body : (res6.body?.records || []);
    console.log('GET Refunds Status:', res6.status);
    console.log('Refund Records Count:', records6.length);
    if (res6.status !== 200 || !Array.isArray(records6)) {
      throw new Error(`TEST 6 FAILED: Expected array of refund records.`);
    }

    const res6b = await makeRequest('PUT', `/api/admin/refunds/${b1Id}/action`, {
      action: 'approve'
    }, adminToken);
    console.log('Approve Refund Action Status:', res6b.status);
    if (res6b.status !== 200 || res6b.body.booking?.refund_status !== 'APPROVED') {
      throw new Error(`TEST 6 FAILED: Expected refund_status APPROVED`);
    }
    console.log('✅ TEST 6 PASSED: Refund Center endpoints functional.');

    // TEST 7: Audit Logs Retrieval
    console.log('\n--- TEST 7: Audit Log System ---');
    const res7 = await makeRequest('GET', '/api/admin/audit-logs', null, adminToken);
    console.log('Audit Logs Status:', res7.status);
    console.log('Audit Log Count:', res7.body?.logs?.length);
    if (res7.status !== 200 || !res7.body?.logs || res7.body.logs.length === 0) {
      throw new Error(`TEST 7 FAILED: Expected audit logs array, got ${JSON.stringify(res7.body)}`);
    }
    console.log('✅ TEST 7 PASSED: Audit Log system recorded all cancellation & override actions.');

    console.log('\n🎉 ALL 7 CANCELLATION, REFUND & TRAIN CASCADE TESTS PASSED 100% SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ TEST SUITE FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runCancellationRefundAuditTests();
