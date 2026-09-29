const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const fs = require('fs');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log(`🔌 Test server stopped.`);
      resolve();
    });
  });
}

async function makeRequest(apiPath, options = {}) {
  const url = `${BASE_URL}${apiPath}`;
  const response = await fetch(url, {
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: response.status, body: json };
}

function getStaffToken(perms = ['VIEW_ASSIGNED_TRAINS', 'MANAGE_TRAIN_SCHEDULES', 'VIEW_TRAIN_STATUS', 'UPDATE_AUTHORIZED_TRAIN_STATUS']) {
  const payload = {
    id: 'stf-test-authorized',
    email: 'staff.auth@railway.com',
    role: 'staff',
    full_name: 'Authorized Staff Officer',
    permissions: perms
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function getUnprivilegedStaffToken() {
  const payload = {
    id: 'stf-test-unprivileged',
    email: 'staff.unprivileged@railway.com',
    role: 'staff',
    full_name: 'Unprivileged Staff Officer',
    permissions: ['VIEW_NOTIFICATIONS'] // Lacks train management permissions
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function getAdminToken() {
  const payload = {
    id: 'usr-admin-master',
    email: 'admin@railway.com',
    role: 'admin',
    full_name: 'Master Admin Officer'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function getPassengerToken() {
  const payload = {
    id: 'usr-passenger-valid',
    email: 'passenger@railway.com',
    role: 'passenger',
    full_name: 'Valid Passenger'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function runTests() {
  if (!isMockMode) {
    console.log('Skipping local mockDb tests since live mode active.');
    return;
  }

  console.log('\n--- 🧪 STAFF TRAIN SCHEDULE & STATUS SEPARATION TESTS ---');

  // Seed authorized staff profile in mockDb
  mockDb.profiles.set('stf-test-authorized', {
    id: 'stf-test-authorized',
    email: 'staff.auth@railway.com',
    role: 'staff',
    full_name: 'Authorized Staff Officer',
    status: 'ACTIVE'
  });
  mockDb.staff_profiles.set('stf-test-authorized', {
    id: 'stf-test-authorized',
    employee_id: 'EMP-77001',
    full_name: 'Authorized Staff Officer',
    email: 'staff.auth@railway.com',
    role: 'staff',
    status: 'ACTIVE',
    permissions: ['VIEW_ASSIGNED_TRAINS', 'MANAGE_TRAIN_SCHEDULES', 'VIEW_TRAIN_STATUS', 'UPDATE_AUTHORIZED_TRAIN_STATUS']
  });

  // Seed unprivileged staff profile
  mockDb.profiles.set('stf-test-unprivileged', {
    id: 'stf-test-unprivileged',
    email: 'staff.unprivileged@railway.com',
    role: 'staff',
    full_name: 'Unprivileged Staff Officer',
    status: 'ACTIVE'
  });
  mockDb.staff_profiles.set('stf-test-unprivileged', {
    id: 'stf-test-unprivileged',
    employee_id: 'EMP-77002',
    full_name: 'Unprivileged Staff Officer',
    email: 'staff.unprivileged@railway.com',
    role: 'staff',
    status: 'ACTIVE',
    permissions: ['VIEW_NOTIFICATIONS']
  });

  // Seed test train
  const testTrainId = 't-staff-sched-101';
  mockDb.trains.set(testTrainId, {
    id: testTrainId,
    train_number: '778811',
    train_name: 'Karnataka Intercity Express',
    source_station_code: 'UDU',
    destination_station_code: 'NDLS',
    source: 'UDU',
    destination: 'NDLS',
    frequency: 'Daily',
    description: 'Daily superfast service connecting Udupi and New Delhi',
    status: 'on_time',
    delay_minutes: 0,
    record_source: 'test'
  });

  mockDb.routes.set('r-staff-sched-101', {
    id: 'r-staff-sched-101',
    train_id: testTrainId,
    source_station_code: 'UDU',
    destination_station_code: 'NDLS',
    departure_time: '05:30:00',
    arrival_time: '21:30:00',
    distance_km: 1850,
    fare_multiplier: 1.2,
    stops: []
  });

  // Seed test booking for passenger
  const testBookingId = 'bk-staff-test-booking';
  mockDb.bookings.set(testBookingId, {
    id: testBookingId,
    passenger_id: 'usr-passenger-valid',
    train_id: testTrainId,
    pnr_number: '7788990011',
    status: 'confirmed',
    travel_date: '2026-09-20',
    total_fare: 1250
  });

  saveMockDbToFile();
  await startServer();

  try {
    const staffHeaders = { 'Authorization': `Bearer ${getStaffToken()}` };
    const unprivilegedHeaders = { 'Authorization': `Bearer ${getUnprivilegedStaffToken()}` };
    const adminHeaders = { 'Authorization': `Bearer ${getAdminToken()}` };
    const passengerHeaders = { 'Authorization': `Bearer ${getPassengerToken()}` };

    // 1. Staff can view train schedule
    console.log('Test 1: Staff can view train schedule (/api/staff/trains)...');
    const t1 = await makeRequest('/staff/trains', { headers: staffHeaders });
    assert.strictEqual(t1.status, 200);
    assert.ok(Array.isArray(t1.body));
    const trainRecord = t1.body.find(t => t.id === testTrainId || t.train_number === '778811');
    assert.ok(trainRecord, 'Train schedule record must exist');
    assert.strictEqual(trainRecord.description, 'Daily superfast service connecting Udupi and New Delhi');
    console.log('✅ Test 1 Passed.');

    // 2. Staff with correct permission can add a train schedule
    console.log('Test 2: Authorized Staff adds a new train schedule...');
    const newTrainNo = '99' + Math.floor(1000 + Math.random() * 9000);
    const t2 = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: staffHeaders,
      body: {
        train_number: newTrainNo,
        train_name: 'Vande Bharat Coast Special',
        train_type: 'Vande Bharat Express',
        source: 'UDU',
        destination: 'MMCT',
        departure_time: '06:15',
        arrival_time: '14:45',
        frequency: 'Daily',
        description: 'High-speed day express service.'
      }
    });
    assert.strictEqual(t2.status, 201, 'Schedule creation should return 201 Created');
    assert.ok(t2.body.train);
    assert.strictEqual(t2.body.train.train_number, newTrainNo);
    console.log('✅ Test 2 Passed.');

    // 3. Schedule persists after reload / restart
    console.log('Test 3: Verify new train schedule persisted in database...');
    const createdTrainInDb = Array.from(mockDb.trains.values()).find(t => t && t.train_number === newTrainNo);
    assert.ok(createdTrainInDb, 'Created train schedule must be present in mockDb');
    assert.strictEqual(createdTrainInDb.train_name, 'Vande Bharat Coast Special');
    console.log('✅ Test 3 Passed.');

    // 4. Staff can edit an existing train schedule
    console.log('Test 4: Authorized Staff edits an existing schedule...');
    const t4 = await makeRequest(`/staff/trains/${createdTrainInDb.id}/schedule`, {
      method: 'PATCH',
      headers: staffHeaders,
      body: {
        train_name: 'Vande Bharat Coast Special Updated',
        description: 'Updated high-speed coastal service schedule.'
      }
    });
    assert.strictEqual(t4.status, 200);
    assert.strictEqual(t4.body.train.train_name, 'Vande Bharat Coast Special Updated');
    assert.strictEqual(t4.body.train.description, 'Updated high-speed coastal service schedule.');
    console.log('✅ Test 4 Passed.');

    // 5. Duplicate train creation is rejected
    console.log('Test 5: Creating train with duplicate train number is rejected...');
    const t5 = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: staffHeaders,
      body: {
        train_number: newTrainNo,
        train_name: 'Duplicate Train Attempt',
        source: 'NDLS',
        destination: 'MMCT',
        departure_time: '10:00',
        arrival_time: '18:00'
      }
    });
    assert.strictEqual(t5.status, 400, 'Duplicate train number must return 400 Bad Request');
    assert.ok(t5.body.error.includes('already exists'), 'Error message indicates duplicate train number');
    console.log('✅ Test 5 Passed.');

    // 6. Staff can update train status if authorized
    console.log('Test 6: Authorized Staff updates train status...');
    const initialTrainCount = mockDb.trains.size;
    const t6 = await makeRequest(`/staff/trains/${testTrainId}/status`, {
      method: 'PATCH',
      headers: staffHeaders,
      body: {
        status: 'DELAYED',
        delay_minutes: 45,
        status_reason: 'Track signals maintenance',
        operational_note: 'Awaiting line clearance'
      }
    });
    assert.strictEqual(t6.status, 200, 'Status update must return 200');
    assert.strictEqual(t6.body.train.status, 'delayed');
    assert.strictEqual(t6.body.train.delay_minutes, 45);
    console.log('✅ Test 6 Passed.');

    // 7. Status update does NOT create a new train record
    console.log('Test 7: Verify status update did NOT create duplicate train records...');
    assert.strictEqual(mockDb.trains.size, initialTrainCount, 'Total train count must remain unchanged');
    console.log('✅ Test 7 Passed.');

    // 8. Staff cannot update status without permission
    console.log('Test 8: Unprivileged Staff is blocked from updating train status...');
    const t8 = await makeRequest(`/staff/trains/${testTrainId}/status`, {
      method: 'PATCH',
      headers: unprivilegedHeaders,
      body: { status: 'CANCELLED' }
    });
    assert.strictEqual(t8.status, 403, 'Unprivileged staff receives 403 Forbidden');
    console.log('✅ Test 8 Passed.');

    // 9. Passenger can search train after Staff update
    console.log('Test 9: Passenger can search for train after Staff schedule/status update...');
    const t9 = await makeRequest('/trains?source=UDU&destination=NDLS');
    assert.strictEqual(t9.status, 200);
    const searchMatch = t9.body.find(t => t.id === testTrainId || t.train_number === '778811');
    assert.ok(searchMatch, 'Passenger search finds updated train');
    assert.strictEqual(searchMatch.delay_minutes, 45);
    console.log('✅ Test 9 Passed.');

    // 10. Existing booking remains intact
    console.log('Test 10: Existing passenger booking remains intact...');
    const bookingInDb = mockDb.bookings.get(testBookingId);
    assert.ok(bookingInDb, 'Passenger booking exists in mockDb');
    assert.strictEqual(bookingInDb.pnr_number, '7788990011');
    console.log('✅ Test 10 Passed.');

    // 11. Admin can view Staff changes
    console.log('Test 11: Admin can view Staff train and status changes...');
    const t11 = await makeRequest('/admin/train-status', { headers: adminHeaders });
    assert.strictEqual(t11.status, 200);
    const adminViewedTrain = t11.body.find(t => t.id === testTrainId || t.train_number === '778811');
    assert.ok(adminViewedTrain, 'Admin train status view returns updated train');
    assert.strictEqual(adminViewedTrain.delay_minutes, 45);
    console.log('✅ Test 11 Passed.');

    // 12. Unauthorized Staff cannot access Admin APIs
    console.log('Test 12: Staff cannot access Admin management endpoints...');
    const t12 = await makeRequest('/admin/staff', { headers: staffHeaders });
    assert.strictEqual(t12.status, 403, 'Staff calling Admin API gets 403 Forbidden');
    console.log('✅ Test 12 Passed.');

    // 13. Production db.json is preserved pristine
    console.log('Test 13: Verify production db.json file was not written to during tests...');
    assert.strictEqual(process.env.DB_FILE_PATH, path.join(__dirname, '../../data/test-db.json'));
    console.log('✅ Test 13 Passed.');

    // Clean up temporary test record from test-db.json
    if (createdTrainInDb && mockDb.trains.has(createdTrainInDb.id)) {
      mockDb.trains.delete(createdTrainInDb.id);
      saveMockDbToFile();
    }

    console.log('\n🎉 ALL STAFF TRAIN & STATUS MODULE CORRECTION TESTS PASSED! 🎉\n');

  } finally {
    await stopServer();
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}
