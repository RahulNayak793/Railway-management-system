const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const app = require('../index');
const { mockDb, saveMockDbToFile } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const makeToken = (id, role, email = 'user@railway.com') => {
  return jwt.sign({ id, role, email }, jwtSecret, { expiresIn: '1h' });
};

let server;

async function request(method, reqPath, body = null, token = null) {
  const url = `${BASE_URL}${reqPath}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let parsed = null;
  try {
    parsed = await res.json();
  } catch (e) {
    parsed = null;
  }
  return { status: res.status, data: parsed };
}

async function runTaskAuthTests() {
  console.log('🧪 Starting System Role Security, Task Authorization & Endpoint Protection Test Suite...\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Task Test Server listening on port ${PORT}`);
      resolve();
    });
  });

  // Reset staff tasks in test memory
  mockDb.staff_tasks = new Map();
  saveMockDbToFile();

  const passengerToken = makeToken('usr-passenger-1', 'passenger', 'passenger1@railway.com');
  const staffToken1 = makeToken('stf-worker-1', 'staff', 'staff1@railway.com');
  const staffToken2 = makeToken('stf-worker-2', 'staff', 'staff2@railway.com');
  const adminToken = makeToken('usr-admin-1', 'admin', 'admin@railway.com');

  // Seed staff profiles in mockDb for test
  mockDb.staff_profiles.set('stf-worker-1', {
    id: 'stf-worker-1',
    full_name: 'Staff Worker One',
    email: 'staff1@railway.com',
    role: 'staff',
    status: 'ACTIVE'
  });
  mockDb.staff_profiles.set('stf-worker-2', {
    id: 'stf-worker-2',
    full_name: 'Staff Worker Two',
    email: 'staff2@railway.com',
    role: 'staff',
    status: 'ACTIVE'
  });

  try {
    // 1. Admin creates and assigns task to staff1
    console.log('Test 1: Admin creates and assigns task to staff1...');
    const createRes = await request('POST', '/api/staff/tasks', {
      staff_id: 'stf-worker-1',
      title: 'Verify Platform 3 Manifest',
      description: 'Check ticket allocations for train 12951',
      priority: 'HIGH',
      due_date: '2026-09-10'
    }, adminToken);
    assert.strictEqual(createRes.status, 201, 'Admin task creation should return HTTP 201');
    assert.strictEqual(createRes.data.staff_id, 'stf-worker-1');
    const createdTaskId = createRes.data.id;
    console.log('   ✅ PASS: Admin successfully created task', createdTaskId);

    // 2. Staff attempts to create task -> Rejected 403 Forbidden
    console.log('Test 2: Staff attempts to create task...');
    const staffCreateRes = await request('POST', '/api/staff/tasks', {
      staff_id: 'stf-worker-2',
      title: 'Unauthorized Self Task'
    }, staffToken1);
    assert.strictEqual(staffCreateRes.status, 403, 'Staff task creation attempt must return 403 Forbidden');
    console.log('   ✅ PASS: Staff task creation blocked with HTTP 403 Forbidden');

    // 3. Staff 1 fetches assigned tasks -> receives only staff 1 tasks
    console.log('Test 3: Staff 1 fetches assigned tasks...');
    const staff1TasksRes = await request('GET', '/api/staff/tasks', null, staffToken1);
    assert.strictEqual(staff1TasksRes.status, 200);
    assert(Array.isArray(staff1TasksRes.data));
    assert.strictEqual(staff1TasksRes.data.length, 1);
    assert.strictEqual(staff1TasksRes.data[0].id, createdTaskId);
    console.log('   ✅ PASS: Staff 1 sees only their own assigned task');

    // 4. Staff 2 fetches assigned tasks -> receives 0 tasks
    console.log('Test 4: Staff 2 fetches assigned tasks...');
    const staff2TasksRes = await request('GET', '/api/staff/tasks', null, staffToken2);
    assert.strictEqual(staff2TasksRes.status, 200);
    assert.strictEqual(staff2TasksRes.data.length, 0);
    console.log('   ✅ PASS: Staff 2 receives 0 tasks');

    // 5. Staff 1 updates status and remarks of their own task -> Success
    console.log('Test 5: Staff 1 updates task status & remarks...');
    const updateRes = await request('PATCH', `/api/staff/tasks/${createdTaskId}`, {
      status: 'In Progress',
      remarks: 'Manifest verification in progress'
    }, staffToken1);
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.task.status, 'In Progress');
    console.log('   ✅ PASS: Staff 1 updated status to In Progress');

    // 6. Staff 2 attempts to update Staff 1 task -> Rejected 403 Forbidden
    console.log('Test 6: Staff 2 attempts to update Staff 1 task...');
    const staff2UpdateRes = await request('PATCH', `/api/staff/tasks/${createdTaskId}`, {
      status: 'Completed'
    }, staffToken2);
    assert.strictEqual(staff2UpdateRes.status, 403, 'Updating another staff task must return 403');
    console.log('   ✅ PASS: Cross-staff task modification blocked with HTTP 403');

    // 7. Staff 1 attempts to delete task -> Rejected 403 Forbidden
    console.log('Test 7: Staff 1 attempts to delete task...');
    const deleteAttemptRes = await request('DELETE', `/api/staff/tasks/${createdTaskId}`, null, staffToken1);
    assert.strictEqual(deleteAttemptRes.status, 403, 'Staff task deletion must return 403');
    console.log('   ✅ PASS: Staff task deletion blocked with HTTP 403 Forbidden');

    // 8. Passenger attempts to access Staff API -> Rejected 403 Forbidden
    console.log('Test 8: Passenger attempts to access Staff API...');
    const passStaffRes = await request('GET', '/api/staff/tasks', null, passengerToken);
    assert.strictEqual(passStaffRes.status, 403, 'Passenger accessing staff API must return 403');
    console.log('   ✅ PASS: Passenger access to Staff API blocked with HTTP 403');

    // 9. Passenger attempts to access Admin API -> Rejected 403 Forbidden
    console.log('Test 9: Passenger attempts to access Admin API...');
    const passAdminRes = await request('GET', '/api/admin/metrics', null, passengerToken);
    assert.strictEqual(passAdminRes.status, 403, 'Passenger accessing admin API must return 403');
    console.log('   ✅ PASS: Passenger access to Admin API blocked with HTTP 403');

    // 10. Staff attempts to access Admin API -> Rejected 403 Forbidden
    console.log('Test 10: Staff attempts to access Admin API...');
    const staffAdminRes = await request('GET', '/api/admin/metrics', null, staffToken1);
    assert.strictEqual(staffAdminRes.status, 403, 'Staff accessing admin API must return 403');
    console.log('   ✅ PASS: Staff access to Admin API blocked with HTTP 403');

    // 11. Admin deletes task -> Success 200 OK
    console.log('Test 11: Admin deletes task...');
    const adminDeleteRes = await request('DELETE', `/api/staff/tasks/${createdTaskId}`, null, adminToken);
    assert.strictEqual(adminDeleteRes.status, 200);
    console.log('   ✅ PASS: Admin deleted task successfully');

    console.log('\n✨ ALL 11 SYSTEM ROLE SECURITY & TASK AUTHORIZATION TESTS PASSED! ✨\n');
  } catch (err) {
    console.error('❌ Task Auth Test Failure:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

runTaskAuthTests();
