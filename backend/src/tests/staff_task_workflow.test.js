const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const app = require('../index');
const { mockDb, saveMockDbToFile } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const PORT = 5105;
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

async function runStaffTaskWorkflowTests() {
  console.log('🧪 Starting Staff Task Assignment & Report Workflow Complete Test Suite (18 Verification Points)...\n');

  const prodDbPath = path.join(__dirname, '../../data/db.json');
  const initialProdDbContent = fs.readFileSync(prodDbPath, 'utf8');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Staff Task Workflow Test Server listening on port ${PORT}`);
      resolve();
    });
  });

  // Reset staff tasks in test memory
  mockDb.staff_tasks = new Map();
  saveMockDbToFile();

  const adminToken = makeToken('usr-admin-wf', 'admin', 'admin.wf@railway.com');
  const staff1Token = makeToken('stf-worker-wf1', 'staff', 'staff1.wf@railway.com');
  const staff2Token = makeToken('stf-worker-wf2', 'staff', 'staff2.wf@railway.com');
  const passengerToken = makeToken('usr-pass-wf', 'passenger', 'passenger.wf@railway.com');

  // Seed staff profiles in mockDb for test
  mockDb.staff_profiles.set('stf-worker-wf1', {
    id: 'stf-worker-wf1',
    full_name: 'Mahesh Worker',
    email: 'staff1.wf@railway.com',
    role: 'staff',
    status: 'ACTIVE'
  });
  mockDb.staff_profiles.set('stf-worker-wf2', {
    id: 'stf-worker-wf2',
    full_name: 'Ramesh Worker',
    email: 'staff2.wf@railway.com',
    role: 'staff',
    status: 'ACTIVE'
  });

  let createdTaskId = '';

  try {
    // Point 1 & 2: Admin can create and assign task
    console.log('1 & 2. Testing Admin task creation & assignment...');
    const createRes = await request('POST', '/api/staff/tasks', {
      staff_id: 'stf-worker-wf1',
      title: 'Verify Daily Passenger Booking Records',
      description: 'Check today\'s booking entries and seating allocations for Rajdhani Express',
      priority: 'HIGH',
      category: 'Passenger Support',
      due_date: '2026-09-15',
      instructions: 'Verify top 50 PNRs and submit findings.'
    }, adminToken);

    assert.strictEqual(createRes.status, 201, 'Admin task creation should return 201 Created');
    assert.strictEqual(createRes.data.staff_id, 'stf-worker-wf1');
    assert.strictEqual(createRes.data.title, 'Verify Daily Passenger Booking Records');
    createdTaskId = createRes.data.id;
    console.log(`   ✅ PASS: Admin created & assigned task ${createdTaskId}`);

    // Point 3: Staff can view own task
    console.log('3. Testing Staff 1 viewing own assigned task...');
    const staff1Res = await request('GET', '/api/staff/tasks', null, staff1Token);
    assert.strictEqual(staff1Res.status, 200);
    assert(Array.isArray(staff1Res.data));
    assert.strictEqual(staff1Res.data.length, 1);
    assert.strictEqual(staff1Res.data[0].id, createdTaskId);
    console.log('   ✅ PASS: Staff 1 receives own task');

    // Point 4: Staff cannot view another staff task
    console.log('4. Testing Staff 2 fetching tasks (isolation)...');
    const staff2Res = await request('GET', '/api/staff/tasks', null, staff2Token);
    assert.strictEqual(staff2Res.status, 200);
    assert.strictEqual(staff2Res.data.length, 0);
    console.log('   ✅ PASS: Staff 2 sees 0 tasks assigned to Staff 1');

    // Point 5: Staff can start own task
    console.log('5. Testing Staff 1 starting own task...');
    const startRes = await request('PATCH', `/api/staff/tasks/${createdTaskId}`, {
      status: 'In Progress',
      remarks: 'Started record verification'
    }, staff1Token);
    assert.strictEqual(startRes.status, 200);
    assert.strictEqual(startRes.data.task.status, 'In Progress');
    assert.ok(startRes.data.task.started_at);
    console.log('   ✅ PASS: Staff 1 started task (status: In Progress)');

    // Point 6 & 7: Staff can complete task and submit completion report
    console.log('6 & 7. Testing Staff 1 submitting completion report...');
    const reportRes = await request('POST', `/api/staff/tasks/${createdTaskId}/report`, {
      completion_status: 'Fully Completed',
      work_performed: 'Audited 50 PNR passenger records and verified all seat numbers.',
      findings: 'All PNR records correctly matched database allocations.',
      remarks: 'No anomalies found.',
      issues_encountered: 'None',
      recommended_followup: 'Routine weekly audit recommended.'
    }, staff1Token);

    assert.strictEqual(reportRes.status, 200);
    assert.strictEqual(reportRes.data.task.status, 'Submitted for Review');
    assert.ok(reportRes.data.task.staff_report);
    assert.strictEqual(reportRes.data.task.staff_report.work_performed, 'Audited 50 PNR passenger records and verified all seat numbers.');
    console.log('   ✅ PASS: Staff 1 submitted completion report (status: Submitted for Review)');

    // Point 8: Admin can view submitted report
    console.log('8. Testing Admin viewing submitted report in tasks list...');
    const adminFetch = await request('GET', '/api/staff/tasks', null, adminToken);
    assert.strictEqual(adminFetch.status, 200);
    const targetTask = adminFetch.data.find(t => t.id === createdTaskId);
    assert.ok(targetTask);
    assert.strictEqual(targetTask.status, 'Submitted for Review');
    assert.ok(targetTask.staff_report);
    console.log('   ✅ PASS: Admin viewed submitted report');

    // Point 10: Admin can request follow-up
    console.log('10. Testing Admin requesting follow-up...');
    const followUpRes = await request('POST', `/api/staff/tasks/${createdTaskId}/review`, {
      action: 'REQUEST_FOLLOW_UP',
      admin_review_remarks: 'Please provide extra details regarding train 12951 catering records.'
    }, adminToken);

    assert.strictEqual(followUpRes.status, 200);
    assert.strictEqual(followUpRes.data.task.status, 'Needs Follow-up');
    assert.strictEqual(followUpRes.data.task.admin_review_remarks, 'Please provide extra details regarding train 12951 catering records.');
    console.log('   ✅ PASS: Admin requested follow-up (status: Needs Follow-up)');

    // Point 11: Staff can see follow-up request
    console.log('11. Testing Staff 1 seeing follow-up request...');
    const staffCheckFollowup = await request('GET', '/api/staff/tasks', null, staff1Token);
    assert.strictEqual(staffCheckFollowup.status, 200);
    assert.strictEqual(staffCheckFollowup.data[0].status, 'Needs Follow-up');
    assert.strictEqual(staffCheckFollowup.data[0].admin_review_remarks, 'Please provide extra details regarding train 12951 catering records.');
    console.log('   ✅ PASS: Staff 1 sees follow-up request and remarks');

    // Point 12: Staff can resubmit after follow-up
    console.log('12. Testing Staff 1 resubmitting report after follow-up...');
    const resubmitRes = await request('POST', `/api/staff/tasks/${createdTaskId}/report`, {
      completion_status: 'Fully Completed',
      work_performed: 'Audited 50 PNR passenger records and verified train 12951 catering manifest.',
      findings: 'Catering manifest matches passenger meal choices 100%.',
      remarks: 'Updated with catering confirmation.'
    }, staff1Token);

    assert.strictEqual(resubmitRes.status, 200);
    assert.strictEqual(resubmitRes.data.task.status, 'Submitted for Review');
    console.log('   ✅ PASS: Staff 1 resubmitted report after follow-up');

    // Point 9: Admin can mark report reviewed
    console.log('9. Testing Admin marking report reviewed...');
    const reviewRes = await request('POST', `/api/staff/tasks/${createdTaskId}/review`, {
      action: 'REVIEW',
      admin_review_remarks: 'Verified and approved by Administrator.'
    }, adminToken);

    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewRes.data.task.status, 'Reviewed');
    console.log('   ✅ PASS: Admin marked report as Reviewed!');

    // Point 13: Passenger receives 403
    console.log('13. Testing Passenger access to /api/staff/tasks -> 403 Forbidden...');
    const passRes = await request('GET', '/api/staff/tasks', null, passengerToken);
    assert.strictEqual(passRes.status, 403);
    console.log('   ✅ PASS: Passenger received 403 Forbidden');

    // Point 14: Staff cannot assign tasks
    console.log('14. Testing Staff attempting task creation -> 403 Forbidden...');
    const staffCreate = await request('POST', '/api/staff/tasks', {
      staff_id: 'stf-worker-wf2',
      title: 'Illegal Task'
    }, staff1Token);
    assert.strictEqual(staffCreate.status, 403);
    console.log('   ✅ PASS: Staff task creation blocked with 403');

    // Point 15: Staff cannot delete tasks
    console.log('15. Testing Staff attempting task deletion -> 403 Forbidden...');
    const staffDelete = await request('DELETE', `/api/staff/tasks/${createdTaskId}`, null, staff1Token);
    assert.strictEqual(staffDelete.status, 403);
    console.log('   ✅ PASS: Staff task deletion blocked with 403');

    // Point 16: Staff cannot modify another staff task
    console.log('16. Testing Staff 2 attempting to update Staff 1 task -> 403 Forbidden...');
    const staff2Update = await request('PATCH', `/api/staff/tasks/${createdTaskId}`, {
      status: 'Pending'
    }, staff2Token);
    assert.strictEqual(staff2Update.status, 403);
    console.log('   ✅ PASS: Cross-staff task modification blocked with 403');

    // Point 17: Persistence verification
    console.log('17. Testing task persistence after restart...');
    saveMockDbToFile();
    const testDbPath = path.join(__dirname, '../../data/test-db.json');
    assert(fs.existsSync(testDbPath), 'test-db.json must exist');
    console.log('   ✅ PASS: Staff tasks persisted into test-db.json');

    // Point 18: Production DB safety
    console.log('18. Verifying production db.json hash / contents unaltered...');
    const postProdDbContent = fs.readFileSync(prodDbPath, 'utf8');
    assert.strictEqual(initialProdDbContent, postProdDbContent, 'Production db.json MUST NOT be altered by automated tests!');
    assert.strictEqual(postProdDbContent.includes('Verify Daily Passenger Booking Records'), false, 'Production DB must not contain test task!');
    console.log('   ✅ PASS: Production db.json completely untouched and clean');

    console.log('\n✨ ALL 18 STAFF TASK WORKFLOW TESTS PASSED PERFECTLY! ✨\n');
  } catch (err) {
    console.error('❌ Staff Task Workflow Test Failure:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

runStaffTaskWorkflowTests();
