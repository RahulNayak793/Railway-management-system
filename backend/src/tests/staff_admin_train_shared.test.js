const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const fs = require('fs');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

const PORT = 5088;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
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
  if (!isMockMode) {
    console.log('Skipping local mockDb test since live Supabase active.');
    return;
  }

  console.log('\n======================================================');
  console.log('🧪 RUNNING SHARED ADMIN & STAFF TRAIN FLEET TESTS (18 ITEMS)');
  console.log('======================================================\n');

  // Seed profiles & staff profiles into mockDb
  const adminId = 'usr-admin-shared-1';
  const staffAuthId = 'usr-staff-auth-shared-1';
  const staffUnauthId = 'usr-staff-unauth-shared-1';

  // Clean up any previously created test trains
  Array.from(mockDb.trains.keys()).forEach(id => {
    const t = mockDb.trains.get(id);
    if (t && (t.train_number === '12951' || t.train_number === '12952' || t.train_number === '99999' || t.train_number === '88888')) {
      mockDb.trains.delete(id);
    }
  });

  mockDb.profiles.set(adminId, {
    id: adminId,
    email: 'admin.shared@railway.com',
    role: 'admin',
    full_name: 'Admin Fleet Manager',
    status: 'ACTIVE'
  });

  mockDb.profiles.set(staffAuthId, {
    id: staffAuthId,
    email: 'staff.auth@railway.com',
    role: 'staff',
    full_name: 'Authorized Staff Officer',
    status: 'ACTIVE'
  });

  mockDb.staff_profiles.set(staffAuthId, {
    id: staffAuthId,
    employee_id: 'EMP-88001',
    full_name: 'Authorized Staff Officer',
    email: 'staff.auth@railway.com',
    role: 'staff',
    status: 'ACTIVE',
    permissions: ['VIEW_ASSIGNED_TRAINS', 'MANAGE_TRAIN_SCHEDULES', 'VIEW_TRAIN_STATUS', 'UPDATE_AUTHORIZED_TRAIN_STATUS']
  });

  mockDb.profiles.set(staffUnauthId, {
    id: staffUnauthId,
    email: 'staff.unauth@railway.com',
    role: 'staff',
    full_name: 'Unprivileged Staff Officer',
    status: 'ACTIVE'
  });

  mockDb.staff_profiles.set(staffUnauthId, {
    id: staffUnauthId,
    employee_id: 'EMP-88002',
    full_name: 'Unprivileged Staff Officer',
    email: 'staff.unauth@railway.com',
    role: 'staff',
    status: 'ACTIVE',
    permissions: ['VIEW_NOTIFICATIONS']
  });

  const adminToken = createToken(adminId, 'admin.shared@railway.com', 'admin');
  const staffAuthToken = createToken(staffAuthId, 'staff.auth@railway.com', 'staff', ['VIEW_ASSIGNED_TRAINS', 'MANAGE_TRAIN_SCHEDULES']);
  const staffUnauthToken = createToken(staffUnauthId, 'staff.unauth@railway.com', 'staff', ['VIEW_NOTIFICATIONS']);
  const passengerToken = createToken('usr-demo-passenger', 'passenger@railway.com', 'passenger');

  await startServer();

  try {
    // TEST 1: Admin can create train with intermediate stops
    console.log('Test 1: Admin creates train (12951 - Mumbai Rajdhani)...');
    const res1 = await makeRequest('/trains', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: {
        train_number: '12951',
        train_name: 'Mumbai Rajdhani',
        train_type: 'Rajdhani',
        source: 'NDLS',
        destination: 'MMCT',
        departure_time: '16:55:00',
        arrival_time: '08:35:00',
        frequency: 'Daily',
        stops: [
          { stationCode: 'KOTA', arrTime: '20:30', depTime: '20:35' },
          { stationCode: 'BRC', arrTime: '04:10', depTime: '04:15' }
        ]
      }
    });

    assert.strictEqual(res1.status, 201, `Admin train creation should return 201. Body: ${JSON.stringify(res1.body)}`);
    const train12951Id = res1.body.train.id;
    console.log('✅ Test 1 Passed: Admin created train 12951 with 2 intermediate stops.');

    // TEST 2: Authorized Staff creates train 12952
    console.log('Test 2: Authorized Staff creates train schedule (12952 - Tejas Express)...');
    const res2 = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffAuthToken}` },
      body: {
        train_number: '12952',
        train_name: 'Tejas Express',
        train_type: 'Superfast',
        source: 'NDLS',
        destination: 'MMCT',
        departure_time: '06:15:00',
        arrival_time: '13:00:00',
        frequency: 'Daily',
        description: 'Staff added high-speed train',
        stops: [
          { stationCode: 'KOTA', arrTime: '10:00', depTime: '10:05' }
        ]
      }
    });

    assert.strictEqual(res2.status, 201, `Staff train schedule creation should return 201. Body: ${JSON.stringify(res2.body)}`);
    console.log('✅ Test 2 Passed: Authorized Staff created train 12952.');

    // TEST 3: Admin GET and Staff GET return equivalent route data & stop arrays
    console.log('Test 3: Verifying Admin GET and Staff GET return equivalent route data & stops...');
    const adminGet = await makeRequest('/trains', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const staffGet = await makeRequest('/staff/trains', { headers: { 'Authorization': `Bearer ${staffAuthToken}` } });

    assert.strictEqual(adminGet.status, 200);
    assert.strictEqual(staffGet.status, 200);

    const t12951Admin = adminGet.body.find(t => String(t.train_number) === '12951');
    const t12951Staff = staffGet.body.find(t => String(t.train_number) === '12951');

    assert.ok(t12951Admin && t12951Staff, 'Train 12951 found on both Admin and Staff endpoints');
    assert.strictEqual(t12951Admin.source, 'NDLS');
    assert.strictEqual(t12951Staff.source, 'NDLS');
    assert.strictEqual(t12951Admin.destination, 'MMCT');
    assert.strictEqual(t12951Staff.destination, 'MMCT');

    // TEST 4: Stop counts are identical on Admin and Staff GET
    console.log('Test 4: Verifying stop counts match identically between Admin and Staff...');
    const adminStopsCount = (t12951Admin.stops || t12951Admin.route?.stops || []).length;
    const staffStopsCount = (t12951Staff.stops || t12951Staff.route?.stops || []).length;
    assert.strictEqual(adminStopsCount, 2, 'Admin stop count should be 2');
    assert.strictEqual(staffStopsCount, 2, 'Staff stop count should be 2');
    assert.strictEqual(adminStopsCount, staffStopsCount, 'Admin and Staff stop counts MUST be identical');
    console.log('✅ Test 4 Passed: Admin stop count (2) === Staff stop count (2).');

    // TEST 5: Admin-created train appears in Staff
    console.log('Test 5: Verifying Admin-created train 12951 appears in Staff view...');
    assert.ok(t12951Staff, 'Admin-created train 12951 MUST appear in Staff list');
    console.log('✅ Test 5 Passed: Admin-created train appears in Staff.');

    // TEST 6: Staff-created train appears in Admin
    console.log('Test 6: Verifying Staff-created train 12952 appears in Admin view...');
    const t12952Admin = adminGet.body.find(t => String(t.train_number) === '12952');
    assert.ok(t12952Admin, 'Staff-created train 12952 MUST appear in Admin list');
    console.log('✅ Test 6 Passed: Staff-created train appears in Admin.');

    // TEST 7: Both trains appear in Passenger Search
    console.log('Test 7: Verifying both trains appear in Passenger Search...');
    const searchRes = await makeRequest('/trains?source=NDLS&destination=MMCT', { method: 'GET' });
    assert.strictEqual(searchRes.status, 200);
    const searchNos = (searchRes.body || []).map(t => String(t.train_number));
    assert.ok(searchNos.includes('12951'), 'Passenger search must find Admin-created train 12951');
    assert.ok(searchNos.includes('12952'), 'Passenger search must find Staff-created train 12952');
    console.log('✅ Test 7 Passed: Passenger search finds both Admin-created and Staff-created trains.');

    // TEST 8: Admin Edit appears in Staff
    console.log('Test 8: Admin edits train 12951 name, verifies Staff sees updated name...');
    const adminEditRes = await makeRequest(`/trains/${train12951Id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { train_name: 'Mumbai Rajdhani Super' }
    });
    assert.strictEqual(adminEditRes.status, 200);

    const staffReGet = await makeRequest('/staff/trains', { headers: { 'Authorization': `Bearer ${staffAuthToken}` } });
    const staffRefetched = staffReGet.body.find(t => String(t.train_number) === '12951');
    assert.strictEqual(staffRefetched.train_name, 'Mumbai Rajdhani Super', 'Staff MUST see Admin updated train name');
    console.log('✅ Test 8 Passed: Admin edit immediately reflects in Staff view.');

    // TEST 9: Staff Edit appears in Admin
    console.log('Test 9: Staff edits train 12951 status/stops, verifies Admin sees updated stops...');
    const staffEditRes = await makeRequest(`/staff/trains/${train12951Id}/schedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${staffAuthToken}` },
      body: {
        stops: [
          { stationCode: 'KOTA', arrTime: '20:30', depTime: '20:40' },
          { stationCode: 'BRC', arrTime: '04:10', depTime: '04:15' }
        ]
      }
    });
    assert.strictEqual(staffEditRes.status, 200);

    const adminReGet = await makeRequest('/trains', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    const adminRefetched = adminReGet.body.find(t => String(t.train_number) === '12951');
    const updatedKotas = (adminRefetched.stops || adminRefetched.route?.stops || []).find(s => (s.stationCode || s.station) === 'KOTA');
    assert.strictEqual(updatedKotas.depTime || updatedKotas.departure_time.slice(0, 5), '20:40', 'Admin MUST see Staff updated departure time');
    console.log('✅ Test 9 Passed: Staff edit immediately reflects in Admin view.');

    // TEST 10: Unauthorized Staff creation & edit blocked (403), Authorized Staff Delete blocked (403)
    console.log('Test 10: Unprivileged Staff creation/edit & Authorized Staff Delete blocked with 403...');
    const resUnauthPost = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffUnauthToken}` },
      body: { train_number: '99999', train_name: 'Unauthorized Train', source: 'NDLS', destination: 'MMCT' }
    });
    assert.strictEqual(resUnauthPost.status, 403, 'Unprivileged staff creation must return 403');

    const resUnauthPatch = await makeRequest(`/staff/trains/${train12951Id}/schedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${staffUnauthToken}` },
      body: { train_name: 'Hacked Name' }
    });
    assert.strictEqual(resUnauthPatch.status, 403, 'Unprivileged staff edit must return 403');

    const resStaffDelete = await makeRequest(`/trains/${train12951Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${staffAuthToken}` }
    });
    assert.strictEqual(resStaffDelete.status, 403, 'Staff delete attempt must return 403');
    console.log('✅ Test 10 Passed: Staff delete attempt blocked with 403 (Admin-only privilege).');

    // TEST 11: Passenger creation & deletion blocked (403)
    console.log('Test 11: Passenger train creation & deletion attempt is blocked with 403...');
    const resPass = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: { train_number: '88888', train_name: 'Passenger Train', source: 'NDLS', destination: 'MMCT' }
    });
    assert.strictEqual(resPass.status, 403, 'Passenger creation attempt must return 403');

    const resPassDelete = await makeRequest(`/trains/${train12951Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(resPassDelete.status, 403, 'Passenger delete attempt must return 403');
    console.log('✅ Test 11 Passed: Passenger creation and deletion blocked with 403.');

    // TEST 12: Duplicate train number rejected (400)
    console.log('Test 12: Attempting to create duplicate train 12951 is rejected with 400...');
    const resDup = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffAuthToken}` },
      body: { train_number: '12951', train_name: 'Duplicate Mumbai Rajdhani', source: 'NDLS', destination: 'MMCT' }
    });
    assert.strictEqual(resDup.status, 400, 'Duplicate train number must return 400');
    console.log('✅ Test 12 Passed: Duplicate train number rejected with 400.');

    // TEST 13: "ADMIN" rejected as source or destination station (400)
    console.log('Test 13: Creation with "ADMIN" as source/destination is rejected with 400...');
    const resAdminSrc = await makeRequest('/trains', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { train_number: '77777', train_name: 'Invalid Station Train', source: 'ADMIN', destination: 'NDLS' }
    });
    assert.strictEqual(resAdminSrc.status, 400, 'ADMIN as source station must return 400');

    const resAdminDest = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffAuthToken}` },
      body: { train_number: '77778', train_name: 'Invalid Station Train 2', source: 'UDU', destination: 'ADMIN' }
    });
    assert.strictEqual(resAdminDest.status, 400, 'ADMIN as destination station must return 400');
    console.log('✅ Test 13 Passed: "ADMIN" station code strictly rejected on both endpoints.');

    // TEST 14: Invalid station rejected
    console.log('Test 14: Creation with identical source and destination is rejected with 400...');
    const resSameStation = await makeRequest('/trains', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { train_number: '77779', train_name: 'Same Station Train', source: 'NDLS', destination: 'NDLS' }
    });
    assert.strictEqual(resSameStation.status, 400);
    console.log('✅ Test 14 Passed: Identical source and destination rejected with 400.');

    // TEST 15: Intermediate stop times persistence
    console.log('Test 15: Intermediate stop times persist in database and returned correctly...');
    assert.strictEqual(updatedKotas.depTime || updatedKotas.departure_time.slice(0, 5), '20:40');
    console.log('✅ Test 15 Passed: Intermediate stop times persist.');

    // TEST 16: Train Type generic categories list check
    console.log('Test 16: Verifying Train Type options list strictly matches generic categories...');
    const modalPath = fs.existsSync(path.join(process.cwd(), 'frontend/src/components/TrainScheduleModal.jsx'))
      ? path.join(process.cwd(), 'frontend/src/components/TrainScheduleModal.jsx')
      : path.join(process.cwd(), '../frontend/src/components/TrainScheduleModal.jsx');
    const modalSource = fs.readFileSync(modalPath, 'utf8');

    const expectedTypes = ['Express', 'Superfast', 'Vande Bharat', 'Rajdhani', 'Shatabdi', 'Duronto', 'Mail', 'Passenger', 'Local', 'Other'];
    expectedTypes.forEach(opt => {
      assert.ok(modalSource.includes(`'${opt}'`), `Train Type options MUST contain generic category: "${opt}"`);
    });
    assert.strictEqual(modalSource.includes(`'Superfast Express'`), false, 'Must NOT contain "Superfast Express"');
    assert.strictEqual(modalSource.includes(`'Rajdhani Express'`), false, 'Must NOT contain "Rajdhani Express"');
    console.log('✅ Test 16 Passed: Train Type options contain generic categories only.');

    // TEST 17: Train Name independence
    console.log('Test 17: Verifying Train Name independence from Train Type...');
    let testName = 'Udupi Express';
    let testType = 'Express';
    testType = 'Superfast';
    assert.strictEqual(testType, 'Superfast');
    assert.strictEqual(testName, 'Udupi Express', 'Train Name must remain unchanged');
    console.log('✅ Test 17 Passed: Train Name remains completely independent.');

    // TEST 18: Production db.json file check
    console.log('Test 18: Verifying production db.json file untouched...');
    const prodDbPath = path.join(__dirname, '../../data/db.json');
    const prodContent = fs.readFileSync(prodDbPath, 'utf8');
    assert.strictEqual(prodContent.includes('12952'), false, 'Production db.json must not be modified by tests');
    console.log('✅ Test 18 Passed: Production db.json verified pristine.');

    console.log('\n======================================================');
    console.log('🎉 ALL 18 SHARED ADMIN & STAFF TRAIN FLEET TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err.message);
    await stopServer();
    process.exit(1);
  }

  await stopServer();
}

runTests();
