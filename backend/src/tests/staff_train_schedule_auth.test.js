const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const fs = require('fs');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

const PORT = 5089;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function createToken(userId, email, role, permissions = []) {
  const payload = {
    id: userId,
    email,
    role,
    permissions,
    full_name: role.toUpperCase() + ' Test User'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
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

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING STAFF TRAIN FLEET SCHEDULE AUTHENTICATION & PERSISTENCE SUITE');
  console.log('======================================================\n');

  // Seed test profiles into mockDb
  const maheshId = 'stf-test-mahesh-auth';
  const rameshId = 'stf-test-ramesh-auth';
  const unauthStaffId = 'stf-test-unauth-auth';
  const passengerId = 'usr-test-passenger-auth';
  const adminId = 'usr-test-admin-auth';

  const maheshProfile = {
    id: maheshId,
    employee_id: '12345',
    full_name: 'Mahesh',
    email: 'maheshny@gmail.com',
    role: 'staff',
    staff_type: 'Passenger Support Officer',
    designation: 'Passenger Support Officer',
    status: 'ACTIVE',
    permissions: [
      'VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS', 'VIEW_BOOKINGS', 'VERIFY_TICKETS',
      'VIEW_TRAIN_STATUS', 'MANAGE_TRAIN_SCHEDULES'
    ]
  };

  const rameshProfile = {
    id: rameshId,
    employee_id: 'EMP-54321',
    full_name: 'Ramesh Kumar',
    email: 'ramesh.kumar@railway.com',
    role: 'staff',
    staff_type: 'Station Master',
    designation: 'Station Master',
    status: 'ACTIVE',
    permissions: ['ALL']
  };

  const unauthStaffProfile = {
    id: unauthStaffId,
    employee_id: 'EMP-99999',
    full_name: 'Unauth Staff',
    email: 'unauth.staff@railway.com',
    role: 'staff',
    staff_type: 'Ticket Checker',
    designation: 'Ticket Checker',
    status: 'ACTIVE',
    permissions: ['VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS']
  };

  const passengerProfile = {
    id: passengerId,
    full_name: 'Test Passenger',
    email: 'passenger.auth@railway.com',
    role: 'passenger',
    status: 'ACTIVE'
  };

  const adminProfile = {
    id: adminId,
    full_name: 'Test Admin',
    email: 'admin.auth@railway.com',
    role: 'admin',
    status: 'ACTIVE'
  };

  mockDb.profiles.set(maheshId, maheshProfile);
  mockDb.profiles.set(rameshId, rameshProfile);
  mockDb.profiles.set(unauthStaffId, unauthStaffProfile);
  mockDb.profiles.set(passengerId, passengerProfile);
  mockDb.profiles.set(adminId, adminProfile);

  mockDb.staff_profiles.set(maheshId, maheshProfile);
  mockDb.staff_profiles.set(rameshId, rameshProfile);
  mockDb.staff_profiles.set(unauthStaffId, unauthStaffProfile);

  mockDb.staff_permissions.set(maheshId, maheshProfile.permissions);
  mockDb.staff_permissions.set(rameshId, rameshProfile.permissions);
  mockDb.staff_permissions.set(unauthStaffId, unauthStaffProfile.permissions);

  // Clean up any test trains from prior runs
  for (const [tId, t] of Array.from(mockDb.trains.entries())) {
    if (['88991', '88992', '88993'].includes(String(t?.train_number))) {
      mockDb.trains.delete(tId);
    }
  }

  saveMockDbToFile();

  const maheshToken = createToken(maheshId, maheshProfile.email, 'staff', maheshProfile.permissions);
  const rameshToken = createToken(rameshId, rameshProfile.email, 'staff', rameshProfile.permissions);
  const unauthStaffToken = createToken(unauthStaffId, unauthStaffProfile.email, 'staff', unauthStaffProfile.permissions);
  const passengerToken = createToken(passengerId, passengerProfile.email, 'passenger');
  const adminToken = createToken(adminId, adminProfile.email, 'admin');

  await startServer();

  const testTrainNo = '88991';

  try {
    // 1. Mahesh POST /api/staff/trains/schedule -> 201 Created
    console.log('Test 1: Mahesh POST /api/staff/trains/schedule...');
    const res1 = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${maheshToken}` },
      body: {
        train_number: testTrainNo,
        train_name: 'Mahesh Real Train',
        train_type: 'Superfast',
        source: 'UDU',
        destination: 'NDLS',
        departure_time: '07:30:00',
        arrival_time: '19:45:00',
        frequency: 'Daily',
        stops: [
          { stationCode: 'KOTA', arrTime: '13:00', depTime: '13:10', haltMinutes: '10' }
        ]
      }
    });
    assert.strictEqual(res1.status, 201, `Mahesh schedule POST must return 201 Created (got ${res1.status}: ${JSON.stringify(res1.body)})`);
    assert.ok(res1.body.train, 'Response should contain created train object');
    const createdTrainId = res1.body.train.id;
    console.log('   ✅ PASS: Mahesh created train schedule 88991 with 201 Created.');

    // 2. Mahesh PATCH schedule -> 200 OK
    console.log('Test 2: Mahesh PATCH /api/staff/trains/:id/schedule...');
    const res2 = await makeRequest(`/staff/trains/${createdTrainId}/schedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${maheshToken}` },
      body: {
        train_name: 'Mahesh Real Train Updated',
        frequency: 'Bi-Weekly'
      }
    });
    assert.strictEqual(res2.status, 200, `Mahesh schedule PATCH must return 200 OK (got ${res2.status})`);
    console.log('   ✅ PASS: Mahesh updated train schedule with 200 OK.');

    // 3. Mahesh DELETE train -> 403 Forbidden
    console.log('Test 3: Mahesh DELETE train -> 403 Forbidden...');
    const res3a = await makeRequest(`/staff/trains/${createdTrainId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${maheshToken}` }
    });
    assert.strictEqual(res3a.status, 403, `Mahesh DELETE on /api/staff/trains must return 403 (got ${res3a.status})`);

    const res3b = await makeRequest(`/trains/${createdTrainId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${maheshToken}` }
    });
    assert.strictEqual(res3b.status, 403, `Mahesh DELETE on /api/trains must return 403 (got ${res3b.status})`);
    console.log('   ✅ PASS: Mahesh train DELETE correctly blocked with 403 Forbidden.');

    // 4. Ramesh POST & PATCH -> 201/200, DELETE -> 403
    console.log('Test 4: Ramesh schedule permissions & DELETE block...');
    const res4a = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${rameshToken}` },
      body: {
        train_number: '88992',
        train_name: 'Ramesh Express',
        train_type: 'Rajdhani',
        source: 'SBC',
        destination: 'MAS',
        departure_time: '06:00',
        arrival_time: '12:00'
      }
    });
    assert.strictEqual(res4a.status, 201, `Ramesh POST must return 201 (got ${res4a.status})`);
    const rameshTrainId = res4a.body.train.id;

    const res4b = await makeRequest(`/staff/trains/${rameshTrainId}/schedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${rameshToken}` },
      body: { train_name: 'Ramesh Express Modified' }
    });
    assert.strictEqual(res4b.status, 200, `Ramesh PATCH must return 200 (got ${res4b.status})`);

    const res4c = await makeRequest(`/trains/${rameshTrainId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${rameshToken}` }
    });
    assert.strictEqual(res4c.status, 403, `Ramesh DELETE must return 403 (got ${res4c.status})`);
    console.log('   ✅ PASS: Ramesh POST=201, PATCH=200, DELETE=403.');

    // 5. Unauthorized Staff POST -> 403
    console.log('Test 5: Unauthorized Staff POST -> 403 Forbidden...');
    const res5 = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${unauthStaffToken}` },
      body: {
        train_number: '88993',
        train_name: 'Unauth Express',
        source: 'NDLS',
        destination: 'MMCT'
      }
    });
    assert.strictEqual(res5.status, 403, `Unauthorized staff POST must return 403 (got ${res5.status})`);
    console.log('   ✅ PASS: Unauthorized staff schedule POST blocked with 403 Forbidden.');

    // 6. Passenger POST, PATCH, DELETE -> 403
    console.log('Test 6: Passenger schedule mutations -> 403 Forbidden...');
    const res6a = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: { train_number: '88994', train_name: 'Passenger Train', source: 'NDLS', destination: 'MMCT' }
    });
    assert.strictEqual(res6a.status, 403);

    const res6b = await makeRequest(`/staff/trains/${createdTrainId}/schedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: { train_name: 'Hacked Train' }
    });
    assert.strictEqual(res6b.status, 403);

    const res6c = await makeRequest(`/trains/${createdTrainId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(res6c.status, 403);
    console.log('   ✅ PASS: Passenger schedule POST, PATCH, DELETE blocked with 403 Forbidden.');

    // 7. Created Staff train appears in GET /api/staff/trains & /api/trains
    console.log('Test 7: Created train visible in GET endpoints...');
    const getStaffRes = await makeRequest('/staff/trains', {
      headers: { 'Authorization': `Bearer ${maheshToken}` }
    });
    assert.strictEqual(getStaffRes.status, 200);
    const foundInStaff = getStaffRes.body.find(t => t.train_number === testTrainNo);
    assert.ok(foundInStaff, 'Staff-created train 88991 must appear in GET /api/staff/trains');

    const getAdminRes = await makeRequest('/trains?include_all=true', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(getAdminRes.status, 200);
    const foundInAdmin = getAdminRes.body.find(t => t.train_number === testTrainNo);
    assert.ok(foundInAdmin, 'Staff-created train 88991 must appear in Admin GET /api/trains');
    console.log('   ✅ PASS: Created train visible across Staff and Admin endpoints.');

    // 8. Duplicate train number is rejected (400)
    console.log('Test 8: Duplicate train number rejected...');
    const resDup = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${maheshToken}` },
      body: {
        train_number: testTrainNo,
        train_name: 'Duplicate Train',
        source: 'UDU',
        destination: 'NDLS'
      }
    });
    assert.strictEqual(resDup.status, 400, 'Duplicate train number must return HTTP 400');
    console.log('   ✅ PASS: Duplicate train number rejected with 400 Bad Request.');

    // 9. ADMIN station code is rejected (400)
    console.log('Test 9: ADMIN station code rejected...');
    const resAdminSt = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${maheshToken}` },
      body: {
        train_number: '88999',
        train_name: 'Invalid Station Train',
        source: 'ADMIN',
        destination: 'NDLS'
      }
    });
    assert.strictEqual(resAdminSt.status, 400, 'ADMIN station code must return 400 Bad Request');
    console.log('   ✅ PASS: ADMIN station code rejected with 400 Bad Request.');

    // 10. Intermediate stop times persist
    console.log('Test 10: Intermediate stop times persistence...');
    assert.ok(foundInStaff.stops && foundInStaff.stops.length > 0, 'Stops array must exist on train');
    const stopKota = foundInStaff.stops.find(s => (s.stationCode || s.station) === 'KOTA');
    assert.ok(stopKota, 'Stop KOTA must exist');
    assert.strictEqual(stopKota.arrTime || stopKota.arrival_time?.slice(0, 5), '13:00');
    console.log('   ✅ PASS: Intermediate stop KOTA times (13:00) persisted correctly.');

    // 11. Persistence check & DB isolation
    console.log('Test 11: Production DB isolation check...');
    const testDbContent = fs.readFileSync(process.env.DB_FILE_PATH, 'utf8');
    assert.ok(testDbContent.includes(testTrainNo), 'Test database must contain newly created train 88991');

    const prodDbPath = path.resolve(__dirname, '../../data/db.json');
    if (fs.existsSync(prodDbPath)) {
      const prodDbContent = fs.readFileSync(prodDbPath, 'utf8');
      assert.strictEqual(prodDbContent.includes('Mahesh Real Train'), false, 'Production db.json must NOT contain test train!');
    }
    console.log('   ✅ PASS: Test isolated strictly to test-db.json; Production db.json unmodified.');

    console.log('\n🎉 ALL STAFF TRAIN SCHEDULE AUTH & PERSISTENCE TESTS PASSED! 🎉\n');

  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err.message);
    await stopServer();
    process.exit(1);
  }

  await stopServer();
}

runTests();
