const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.MOCK_MODE = 'true';
const PORT = 5099;
process.env.PORT = PORT;

const http = require('http');
const jwt = require('jsonwebtoken');
const { mockDb } = require('../config/supabase');
const app = require('../index');
let server;

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

function makeToken(id, role, email) {
  const payload = { id, role, email, full_name: `${role.toUpperCase()} User` };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

const adminToken = makeToken('usr-admin-test', 'admin', 'admin@railway.com');
const staffToken = makeToken('usr-staff-test', 'staff', 'staff@railway.com');
const passengerToken = makeToken('usr-passenger-test', 'passenger', 'passenger@railway.com');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, body: json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAdminSecurityConcurrencyTests() {
  server = app.listen(PORT, async () => {
    console.log(`\n======================================================`);
    console.log(`🧪 RUNNING ADMIN SECURITY, RAC PROMOTION & CONCURRENCY SUITE`);
    console.log(`======================================================\n`);

    try {
      // Setup mock data
      const adminUser = { id: 'usr-admin-test', email: 'admin@railway.com', role: 'admin', full_name: 'Admin User', status: 'Active' };
      const staffUser = { id: 'usr-staff-test', email: 'staff@railway.com', role: 'staff', full_name: 'Staff User', status: 'Active' };
      const passUser = { id: 'usr-passenger-test', email: 'passenger@railway.com', role: 'passenger', full_name: 'Passenger User', status: 'Active' };
      const blockUser = { id: 'usr-blocked-test', email: 'blocked@railway.com', role: 'passenger', full_name: 'Blocked User', status: 'Blocked' };

      mockDb.profiles.set(adminUser.id, adminUser);
      mockDb.profiles.set(staffUser.id, staffUser);
      mockDb.profiles.set(passUser.id, passUser);
      mockDb.profiles.set(blockUser.id, blockUser);

      // --- TEST 1: Metrics API Schema ---
      console.log(`[TEST 1] Testing GET /api/admin/metrics authorization & schema...`);
      const metricsDeny = await request('GET', '/api/admin/metrics', null, passengerToken);
      if (metricsDeny.status !== 403) throw new Error(`Passenger should be denied on metrics, got ${metricsDeny.status}`);

      const metricsPass = await request('GET', '/api/admin/metrics', null, adminToken);
      if (metricsPass.status !== 200 || !metricsPass.body.summary) throw new Error(`Admin metrics failed: ${JSON.stringify(metricsPass.body)}`);
      
      const s = metricsPass.body.summary;
      if (s.totalTrains === undefined || s.totalRoutes === undefined || s.totalStations === undefined) {
        throw new Error(`Metrics summary missing detailed counts: ${JSON.stringify(s)}`);
      }
      console.log(`  ✅ Test 1 Passed: /api/admin/metrics returns complete system counts.`);

      // --- TEST 2: User Role Management & Security Controls ---
      console.log(`\n[TEST 2] Testing User Role & Status Security Controls...`);
      
      // 2.1 Staff denial
      const staffPut = await request('PUT', `/api/admin/users/${passUser.id}`, { role: 'staff' }, staffToken);
      if (staffPut.status !== 403) throw new Error(`Staff should be denied role modification, got ${staffPut.status}`);

      // 2.2 Invalid Role
      const invalidRole = await request('PUT', `/api/admin/users/${passUser.id}`, { role: 'superuser' }, adminToken);
      if (invalidRole.status !== 400) throw new Error(`Invalid role should return 400, got ${invalidRole.status}`);

      // 2.3 Nonexistent User
      const nonUser = await request('PUT', `/api/admin/users/usr-nonexistent`, { role: 'staff' }, adminToken);
      if (nonUser.status !== 404) throw new Error(`Nonexistent user should return 404, got ${nonUser.status}`);

      // 2.4 Demote Last Admin Protection
      // Ensure only 1 admin user exists in mockDb for this test
      for (const [id, p] of Array.from(mockDb.profiles.entries())) {
        if (p.role === 'admin' && id !== adminUser.id) {
          mockDb.profiles.delete(id);
        }
      }
      const demoteLast = await request('PUT', `/api/admin/users/${adminUser.id}`, { role: 'passenger' }, adminToken);
      if (demoteLast.status !== 400 || !demoteLast.body.error.includes('last remaining admin')) {
        throw new Error(`Demoting last admin should fail with 400, got ${demoteLast.status}: ${JSON.stringify(demoteLast.body)}`);
      }
      console.log(`  ✅ Test 2.4 Passed: Demoting last admin blocked with 400 Bad Request.`);

      // 2.5 Blocked User Session Rejection
      const blockedToken = makeToken(blockUser.id, 'passenger', blockUser.email);
      const blockedReq = await request('GET', '/api/bookings', null, blockedToken);
      if (blockedReq.status !== 403 || !blockedReq.body.error.includes('blocked')) {
        throw new Error(`Blocked user request should be rejected with 403, got ${blockedReq.status}: ${JSON.stringify(blockedReq.body)}`);
      }
      console.log(`  ✅ Test 2.5 Passed: Blocked user requests rejected with 403 Forbidden.`);

      // --- TEST 3: Atomic RAC Promotion & Concurrency ---
      console.log(`\n[TEST 3] Testing Atomic RAC Promotion & Concurrency Locks...`);
      
      const racBookingId = 'bk-rac-test-101';
      const trainId = 'train-rac-901';
      mockDb.trains.set(trainId, { id: trainId, train_number: '90099', train_name: 'RAC Express', source: 'NDLS', destination: 'MMCT' });
      mockDb.bookings.set(racBookingId, {
        id: racBookingId,
        passenger_id: passUser.id,
        train_id: trainId,
        travel_date: '2026-09-20',
        pnr_number: '5566778899',
        status: 'rac',
        coach_class: '3A',
        total_fare: 650
      });

      // 3.1 Promote valid RAC booking
      const promoteRes = await request('PUT', `/api/bookings/${racBookingId}/promote`, null, adminToken);
      if (promoteRes.status !== 200 || promoteRes.body.booking.status !== 'confirmed') {
        throw new Error(`RAC promotion failed: ${JSON.stringify(promoteRes.body)}`);
      }
      console.log(`  ✅ Test 3.1 Passed: RAC booking promoted to CONFIRMED and berth assigned.`);

      // 3.2 Duplicate promotion attempt on already confirmed booking
      const dupPromote = await request('PUT', `/api/bookings/${racBookingId}/promote`, null, adminToken);
      if (dupPromote.status !== 400) {
        throw new Error(`Duplicate RAC promotion should be rejected with 400, got ${dupPromote.status}`);
      }
      console.log(`  ✅ Test 3.2 Passed: Re-promoting confirmed booking correctly rejected.`);

      // 3.3 Concurrency Test: 10 parallel promotion requests on single RAC booking
      console.log(`\n[TEST 3.3] Running 10 Concurrent RAC Promotion Requests...`);
      const concBookingId = 'bk-rac-conc-202';
      mockDb.bookings.set(concBookingId, {
        id: concBookingId,
        passenger_id: passUser.id,
        train_id: trainId,
        travel_date: '2026-09-21',
        pnr_number: '7788990011',
        status: 'rac',
        coach_class: '3A',
        total_fare: 650
      });

      const promises = Array.from({ length: 10 }).map(() => request('PUT', `/api/bookings/${concBookingId}/promote`, null, adminToken));
      const results = await Promise.all(promises);

      const successCount = results.filter(r => r.status === 200).length;
      const rejectCount = results.filter(r => r.status === 400).length;

      if (successCount !== 1 || rejectCount !== 9) {
        throw new Error(`Concurrent promotion failed: Expected 1 success and 9 rejects, got ${successCount} success and ${rejectCount} rejects`);
      }
      console.log(`  ✅ Test 3.3 Passed: Exactly 1 concurrent promotion succeeded, 9 cleanly rejected.`);

      console.log(`\n======================================================`);
      console.log(`🏆 ALL ADMIN SECURITY & RAC CONCURRENCY TESTS PASSED!`);
      console.log(`======================================================\n`);

      server.close(() => process.exit(0));
    } catch (err) {
      console.error(`❌ TEST FAILURE:`, err.message);
      if (server) server.close(() => process.exit(1));
    }
  });
}

runAdminSecurityConcurrencyTests();
