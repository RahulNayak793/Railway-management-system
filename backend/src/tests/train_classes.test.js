/**
 * End-to-End Automated Test Suite: Train-Wise Travel Class Configuration & Booking Class Isolation
 * Strictly uses test-db.json via process.env.NODE_ENV = 'test'.
 */

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const app = require('../index');
const { getClassFullName, getClassLabel, normalizeClassList } = require('../utils/trainClasses');

let server;
let PORT;

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const bodyStr = postData ? (typeof postData === 'object' ? JSON.stringify(postData) : String(postData)) : null;
    const headers = {
      ...(options.headers || {}),
      ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
    };
    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body = data;
        try { body = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

// Helper mock JWT tokens
const adminToken = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-admin-test', email: 'admin@railway.com', role: 'admin', permissions: ['ALL'] })).toString('base64');
const staffToken = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-staff-test', email: 'staff@railway.com', role: 'staff', permissions: ['MANAGE_TRAIN_SCHEDULES'] })).toString('base64');
const unauthStaffToken = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-staff-no-perm', email: 'staff_noperm@railway.com', role: 'staff', permissions: ['VIEW_DASHBOARD'] })).toString('base64');
const passengerToken = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-passenger-test', email: 'passenger@railway.com', role: 'passenger' })).toString('base64');

// Populate mock staff profiles in mockDb for permission checking
mockDb.staff_profiles.set('usr-staff-test', {
  id: 'usr-staff-test',
  email: 'staff@railway.com',
  role: 'staff',
  status: 'ACTIVE',
  permissions: ['MANAGE_TRAIN_SCHEDULES']
});
mockDb.staff_permissions.set('usr-staff-test', ['MANAGE_TRAIN_SCHEDULES']);

mockDb.staff_profiles.set('usr-staff-no-perm', {
  id: 'usr-staff-no-perm',
  email: 'staff_noperm@railway.com',
  role: 'staff',
  status: 'ACTIVE',
  permissions: ['VIEW_DASHBOARD']
});
mockDb.staff_permissions.set('usr-staff-no-perm', ['VIEW_DASHBOARD']);

async function runTests() {
  console.log('🧪 Starting Train-Wise Travel Class Configuration Test Suite...');

  // Verification 1: Verify test-db isolation
  const targetDbPath = process.env.DB_FILE_PATH || path.join(__dirname, '../../data/test-db.json');
  assert.ok(targetDbPath.includes('test-db.json'), 'Tests MUST run against test-db.json!');
  console.log('✅ Test database isolation verified:', targetDbPath);

  // Start HTTP Server
  server = app.listen(0);
  PORT = server.address().port;
  console.log(`Test server running on port ${PORT}`);

  try {
    // Test 1: Admin Create Train with 1A, 2A, 3A
    const newTrainNo = '99951';
    const createRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/trains',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      train_number: newTrainNo,
      train_name: 'Test Rajdhani Express',
      train_type: 'Rajdhani',
      source: 'NDLS',
      destination: 'MMCT',
      available_classes: ['1A', '2A', '3A'],
      departure_time: '16:00',
      arrival_time: '08:00'
    });

    assert.strictEqual(createRes.status, 201, 'Admin should create train with 1A,2A,3A');
    const createdTrain = createRes.body.train;
    assert.ok(createdTrain, 'Created train should exist');
    assert.deepStrictEqual(createdTrain.available_classes, ['3A', '2A', '1A'], 'Train should store available_classes [3A, 2A, 1A] in priority order');
    console.log('✅ 1. Admin created train with classes [3A, 2A, 1A]');

    const trainId = createdTrain.id;

    // Test 2: Read classes from API
    const getRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/trains?source=NDLS&destination=MMCT`,
      method: 'GET'
    });

    assert.strictEqual(getRes.status, 200);
    const foundTrain = (getRes.body || []).find(t => t.train_number === newTrainNo);
    assert.ok(foundTrain, 'Train should be returned in passenger search API');
    assert.deepStrictEqual(foundTrain.available_classes, ['3A', '2A', '1A'], 'Passenger API must expose available_classes [3A, 2A, 1A]');
    console.log('✅ 2. Read classes persistent from API');

    // Test 3: Authorized Staff Class Update (Add SL)
    const staffUpdateRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/staff/trains/${trainId}/schedule`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      }
    }, {
      available_classes: ['1A', '2A', '3A', 'SL']
    });

    assert.strictEqual(staffUpdateRes.status, 200, 'Authorized staff should update train schedule classes');
    if (!staffUpdateRes.body || !staffUpdateRes.body.train) {
      console.error('FAILED STAFF UPDATE RES:', staffUpdateRes.body);
    } else {
      console.log('STAFF UPDATE RETURNED TRAIN:', staffUpdateRes.body.train);
    }
    assert.deepStrictEqual(staffUpdateRes.body.train.available_classes, ['SL', '3A', '2A', '1A'], 'Staff update must add SL');
    console.log('✅ 3. Authorized staff updated classes to [SL, 3A, 2A, 1A]');

    // Test 4: Unauthorized Staff Update Rejection (403)
    const unauthRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/staff/trains/${trainId}/schedule`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unauthStaffToken}`
      }
    }, {
      available_classes: ['1A']
    });

    assert.strictEqual(unauthRes.status, 403, 'Unauthorized staff edit must return 403 Forbidden');
    console.log('✅ 4. Unauthorized staff update correctly blocked (HTTP 403)');

    // Test 5: Passenger attempts to book unsupported class (EC) -> Expect 400
    const invalidBookRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/bookings/book',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      }
    }, {
      train_id: trainId,
      travel_date: '2026-09-25',
      coach_class: 'EC', // Train only supports 1A, 2A, 3A, SL
      passengers: [{ name: 'Test Passenger', age: 30, gender: 'Male', irctc_id: 'IRCTC12345' }],
      total_fare: 2500
    });

    assert.strictEqual(invalidBookRes.status, 400, 'Booking unsupported class EC must return HTTP 400');
    assert.strictEqual(invalidBookRes.body.error, 'Selected class is not available on this train.');
    console.log('✅ 5. Backend correctly rejected booking for unsupported class (HTTP 400)');

    // Test 6: Valid Passenger Booking for 3A
    const validBookRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/bookings/book',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      }
    }, {
      train_id: trainId,
      travel_date: '2026-09-25',
      coach_class: '3A',
      passengers: [{ name: 'Test Passenger', age: 30, gender: 'Male', irctc_id: 'IRCTC12345' }],
      total_fare: 1200
    });

    assert.strictEqual(validBookRes.status, 201, 'Valid booking for 3A should succeed');
    const booking = validBookRes.body.booking;
    assert.strictEqual(booking.coach_class, '3A', 'Booking record must preserve coach_class 3A');
    const pnr = booking.pnr_number;
    console.log(`✅ 6. Valid booking succeeded for 3A with PNR: ${pnr}`);

    // Test 7: PNR Lookup preserves 3A class
    const pnrRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/bookings/pnr/${pnr}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${passengerToken}`
      }
    });

    assert.strictEqual(pnrRes.status, 200);
    assert.strictEqual(pnrRes.body.coach_class, '3A', 'PNR lookup must return coach_class 3A');
    console.log('✅ 7. PNR lookup verified 3A class preservation');

    // Test 8: My Bookings API preserves 3A class
    const myBookingsRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/bookings',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${passengerToken}`
      }
    });

    assert.strictEqual(myBookingsRes.status, 200);
    const myBooking = (myBookingsRes.body || []).find(b => b.pnr_number === pnr);
    assert.ok(myBooking, 'Booking should appear in My Bookings');
    assert.strictEqual(myBooking.coach_class, '3A', 'My Bookings must reflect stored class 3A');
    console.log('✅ 8. My Bookings API verified class preservation');

    // Test 9: Class-Specific Availability & Seat Allocation
    const seatRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/trains/${trainId}/seats?date=2026-09-25&coach_class=3A`,
      method: 'GET'
    });

    assert.strictEqual(seatRes.status, 200);
    assert.ok(seatRes.body.layout, 'Seat layout returned');
    assert.strictEqual(seatRes.body.coach_class, '3A', 'Seats must be for coach class 3A');
    console.log('✅ 9. Class-specific seat availability verified');

    // Test 10: Vande Bharat Train with EC and CC ONLY
    const vbTrainRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/trains',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      train_number: '99999',
      train_name: 'Test Vande Bharat Express',
      train_type: 'Vande Bharat',
      source: 'NDLS',
      destination: 'BSB',
      available_classes: ['EC', 'CC'],
      departure_time: '06:00',
      arrival_time: '14:00'
    });

    assert.strictEqual(vbTrainRes.status, 201);
    const vbTrain = vbTrainRes.body.train;
    assert.deepStrictEqual(vbTrain.available_classes, ['EC', 'CC'], 'Vande Bharat train must have only [EC, CC]');

    // Verify rejection if passenger tries booking SL on Vande Bharat
    const vbBookFailRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/bookings/book',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${passengerToken}`
      }
    }, {
      train_id: vbTrain.id,
      travel_date: '2026-09-26',
      coach_class: 'SL',
      passengers: [{ name: 'Test Passenger', age: 30, gender: 'Male', irctc_id: 'IRCTC12345' }],
      total_fare: 600
    });

    assert.strictEqual(vbBookFailRes.status, 400, 'SL booking on Vande Bharat must fail with HTTP 400');
    console.log('✅ 10. Vande Bharat train with [EC, CC] strictly blocks SL booking');

    console.log('\n🎉 ALL 10 AUTOMATED TRAIN CLASS TEST CASES PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
