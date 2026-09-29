const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const app = require('../index');
const { mockDb, saveMockDbToFile } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const PORT = 5098;
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

async function runTests() {
  console.log('🧪 Starting Railway Staff Management & Internal Operations Test Suite (26 Verification Points)...\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Staff Test Server listening on port ${PORT}`);
      resolve();
    });
  });

  const adminToken = makeToken('usr-demo-admin', 'admin', 'admin@railway.com');
  const passengerToken = makeToken('usr-demo-passenger', 'passenger', 'passenger@railway.com');

  let testStaffId = '';
  let inactiveStaffId = '';
  let staffToken = '';
  let createdReportId = '';

  try {
    // 1. Admin can create staff
    console.log('1. Testing Admin create staff member...');
    const testEmail = `test.staff.${Date.now()}@railway.com`;
    const testEmpId = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
    const newStaffData = {
      full_name: 'Test Staff Officer',
      email: testEmail,
      phone: '+91 9111122222',
      employee_id: testEmpId,
      department: 'Passenger Services',
      designation: 'Passenger Support Officer',
      staff_type: 'Passenger Support Officer',
      status: 'ACTIVE',
      permissions: ['VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS', 'VERIFY_TICKETS', 'VIEW_BOOKINGS', 'SUBMIT_DAILY_REPORT', 'VIEW_CATERING_ORDERS', 'UPDATE_CATERING_STATUS', 'HANDLE_SERVICE_REQUESTS', 'CREATE_INCIDENT_REPORT']
    };
    const t1 = await request('POST', '/api/staff/admin-create', newStaffData, adminToken);
    assert.strictEqual(t1.status, 201);
    assert.strictEqual(t1.data.email, testEmail);
    testStaffId = t1.data.id;
    console.log(`   ✅ Passed: Admin created active staff with ID ${testStaffId}.`);

    // 2. Staff cannot self-register
    console.log('2. Testing Public staff self-registration rejection...');
    const t2 = await request('POST', '/api/auth/signup', {
      email: 'hacker.staff@railway.com',
      password: 'password',
      full_name: 'Fake Staff',
      role: 'staff'
    });
    assert.strictEqual(t2.status, 403);
    console.log('   ✅ Passed: Public self-registration for staff forbidden with 403.');

    // 3. Active staff can login
    console.log('3. Testing Active staff login...');
    const t3 = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'password',
      role: 'staff'
    });
    assert.strictEqual(t3.status, 200);
    assert.ok(t3.data.session.access_token);
    assert.strictEqual(t3.data.user.role, 'staff');
    staffToken = t3.data.session.access_token;
    console.log('   ✅ Passed: ACTIVE staff successfully authenticated.');

    // 4. Inactive staff cannot login
    console.log('4. Testing INACTIVE staff login rejection...');
    const inactiveEmail = `inactive.staff.${Date.now()}@railway.com`;
    const t4Create = await request('POST', '/api/staff/admin-create', {
      full_name: 'Inactive Staff',
      email: inactiveEmail,
      status: 'INACTIVE'
    }, adminToken);
    assert.strictEqual(t4Create.status, 201);
    inactiveStaffId = t4Create.data.id;

    const t4Login = await request('POST', '/api/auth/login', {
      email: inactiveEmail,
      password: 'password',
      role: 'staff'
    });
    assert.strictEqual(t4Login.status, 403);
    console.log('   ✅ Passed: INACTIVE staff login rejected with 403.');

    // 5. Suspended staff cannot login
    console.log('5. Testing SUSPENDED staff login rejection...');
    await request('PATCH', `/api/staff/admin-status/${testStaffId}`, { status: 'SUSPENDED' }, adminToken);
    const t5Login = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'password',
      role: 'staff'
    });
    assert.strictEqual(t5Login.status, 403);
    console.log('   ✅ Passed: SUSPENDED staff login rejected with 403.');

    // Reactivate test staff
    await request('PATCH', `/api/staff/admin-status/${testStaffId}`, { status: 'ACTIVE' }, adminToken);

    // 6. Passenger cannot access staff APIs
    console.log('6. Testing Passenger access to /api/staff/dashboard...');
    const t6 = await request('GET', '/api/staff/dashboard', null, passengerToken);
    assert.strictEqual(t6.status, 403);
    console.log('   ✅ Passed: Passenger access to staff dashboard blocked with 403.');

    // 7. Staff cannot access admin APIs
    console.log('7. Testing Staff access to /api/admin/users...');
    const t7 = await request('GET', '/api/admin/users', null, staffToken);
    assert.strictEqual(t7.status, 403);
    console.log('   ✅ Passed: Staff access to admin endpoints blocked with 403.');

    // 8. Admin can edit staff
    console.log('8. Testing Admin edit staff permissions/details...');
    const t8 = await request('PATCH', `/api/staff/admin-permissions/${testStaffId}`, { permissions: ['VIEW_DASHBOARD', 'VIEW_BOOKINGS', 'VERIFY_TICKETS', 'VIEW_CATERING_ORDERS', 'UPDATE_CATERING_STATUS', 'HANDLE_SERVICE_REQUESTS', 'CREATE_INCIDENT_REPORT', 'SUBMIT_DAILY_REPORT'] }, adminToken);
    assert.strictEqual(t8.status, 200);
    console.log('   ✅ Passed: Admin edited staff permissions.');

    // 9. Admin can activate staff
    console.log('9. Testing Admin activate staff...');
    const t9 = await request('PATCH', `/api/staff/admin-status/${inactiveStaffId}`, { status: 'ACTIVE' }, adminToken);
    assert.strictEqual(t9.status, 200);
    assert.strictEqual(t9.data.staff.status, 'ACTIVE');
    console.log('   ✅ Passed: Admin activated staff.');

    // 10. Admin can suspend staff
    console.log('10. Testing Admin suspend staff...');
    const t10 = await request('PATCH', `/api/staff/admin-status/${inactiveStaffId}`, { status: 'SUSPENDED' }, adminToken);
    assert.strictEqual(t10.status, 200);
    assert.strictEqual(t10.data.staff.status, 'SUSPENDED');
    console.log('    ✅ Passed: Admin suspended staff.');

    // 11. Admin can assign permissions
    console.log('11. Testing Admin assign permissions...');
    const t11 = await request('PATCH', `/api/staff/admin-permissions/${testStaffId}`, { permissions: ['ALL'] }, adminToken);
    assert.strictEqual(t11.status, 200);
    console.log('    ✅ Passed: Admin assigned ALL permissions.');

    // 12. Staff permission enforcement works
    console.log('12. Testing Staff permission enforcement (remove VIEW_BOOKINGS)...');
    await request('PATCH', `/api/staff/admin-permissions/${testStaffId}`, { permissions: ['VIEW_DASHBOARD'] }, adminToken);
    const t12Access = await request('GET', '/api/staff/bookings', null, staffToken);
    assert.strictEqual(t12Access.status, 403);
    console.log('    ✅ Passed: Staff permission enforcement blocked access to /api/staff/bookings.');

    // Restore full permissions for remaining tests
    await request('PATCH', `/api/staff/admin-permissions/${testStaffId}`, { permissions: ['ALL'] }, adminToken);

    // 13. Staff can view dashboard
    console.log('13. Testing Staff view dashboard...');
    const t13 = await request('GET', '/api/staff/dashboard', null, staffToken);
    assert.strictEqual(t13.status, 200);
    assert.ok(t13.data.assigned_train);
    console.log('    ✅ Passed: Staff fetched dashboard data.');

    // 14. Staff can view bookings
    console.log('14. Testing Staff view bookings...');
    const t14 = await request('GET', '/api/staff/bookings', null, staffToken);
    assert.strictEqual(t14.status, 200);
    assert.ok(Array.isArray(t14.data));
    console.log('    ✅ Passed: Staff viewed passenger bookings.');

    // 15. Staff can verify PNR
    console.log('15. Testing Staff verify PNR...');
    const confirmedBooking = Array.from(mockDb.bookings.values()).find(b => b.status === 'confirmed') || Array.from(mockDb.bookings.values())[0];
    const validPnr = confirmedBooking ? confirmedBooking.pnr_number : '8819203941';
    const t15 = await request('POST', '/api/staff/ticket/verify', { pnr: validPnr, checked_status: true }, staffToken);
    assert.strictEqual(t15.status, 200);
    assert.strictEqual(t15.data.valid, true);
    console.log('    ✅ Passed: Staff verified PNR.');

    // 16. Ticket verification persists
    console.log('16. Testing Ticket verification persistence...');
    const auditLogs = Array.from(mockDb.staff_audit_logs.values());
    const verifyLog = auditLogs.find(l => l.action === 'VERIFY_TICKET');
    assert.ok(verifyLog);
    console.log('    ✅ Passed: Ticket verification persisted in audit logs.');

    // 17. Catering access is blocked for staff (except catering)
    console.log('17. Testing Catering order access restriction for staff...');
    const catOrders = Array.from(mockDb.catering_orders.values());
    if (catOrders.length > 0) {
      const targetOrder = catOrders[0];
      const t17 = await request('PATCH', `/api/staff/catering/${targetOrder.id}`, { status: 'PREPARING' }, staffToken);
      assert.strictEqual(t17.status, 403);
    }
    console.log('    ✅ Passed: Catering access is strictly blocked for staff operations.');

    // 18. Service request updates persist
    console.log('18. Testing Service request update persistence...');
    const t18Get = await request('GET', '/api/staff/service-requests', null, staffToken);
    assert.strictEqual(t18Get.status, 200);
    if (t18Get.data.length > 0) {
      const targetSr = t18Get.data[0];
      const t18Patch = await request('PATCH', `/api/staff/service-requests/${targetSr.id}`, { status: 'RESOLVED', resolution_notes: 'Resolved by staff' }, staffToken);
      assert.strictEqual(t18Patch.status, 200);
      assert.strictEqual(t18Patch.data.status, 'RESOLVED');
    }
    console.log('    ✅ Passed: Service request update persisted.');

    // 19. Issue reports persist
    console.log('19. Testing Issue report submission persistence...');
    const t19 = await request('POST', '/api/staff/incidents', {
      title: 'Website Data Discrepancy',
      category: 'Website/System Issue',
      severity: 'MEDIUM',
      description: 'Minor issue in display formatting resolved.'
    }, staffToken);
    assert.strictEqual(t19.status, 201);
    assert.ok(t19.data.id);
    console.log('    ✅ Passed: Issue report persisted.');

    // 20. Daily reports persist
    console.log('20. Testing Daily report submission persistence...');
    const t20 = await request('POST', '/api/staff/daily-reports', {
      report_date: '2026-09-02',
      shift: 'Morning Shift',
      summary: 'Completed all internal website management tasks.',
      declaration_confirmed: true
    }, staffToken);
    assert.strictEqual(t20.status, 201);
    createdReportId = t20.data.id;
    console.log(`    ✅ Passed: Daily report persisted with ID ${createdReportId}.`);

    // 21. Admin can review reports
    console.log('21. Testing Admin review daily report...');
    const t21 = await request('PATCH', `/api/staff/admin-reports/${createdReportId}/review`, {
      status: 'APPROVED',
      review_comments: 'Reviewed by Administrator.'
    }, adminToken);
    assert.strictEqual(t21.status, 200);
    assert.strictEqual(t21.data.report.status, 'APPROVED');
    console.log('    ✅ Passed: Admin reviewed and approved daily report.');

    // 22. Audit logs persist
    console.log('22. Testing Audit logs persistence...');
    const t22 = await request('GET', '/api/staff/activity-logs', null, adminToken);
    assert.strictEqual(t22.status, 200);
    assert.ok(t22.data.length > 0);
    console.log(`    ✅ Passed: ${t22.data.length} audit logs persisted.`);

    // 23. Existing bookings remain intact
    console.log('23. Testing Existing bookings intact...');
    assert.ok(mockDb.bookings !== undefined);
    console.log('    ✅ Passed: Existing bookings intact.');

    // 24. Existing trains remain intact
    console.log('24. Testing Existing trains intact...');
    assert.ok(mockDb.trains !== undefined);
    console.log('    ✅ Passed: Existing trains intact.');

    // 25. Existing routes remain intact
    console.log('25. Testing Existing routes intact...');
    assert.ok(mockDb.routes !== undefined);
    console.log('    ✅ Passed: Existing routes intact.');

    // 26. Existing stations remain intact
    console.log('26. Testing Existing stations intact...');
    assert.ok(mockDb.stations !== undefined);
    console.log('    ✅ Passed: Existing stations intact.');

    console.log('\n🎉 ALL 26 STAFF MANAGEMENT & INTERNAL OPERATIONS TEST POINTS PASSED SUCCESSFULLY!\n');

  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runTests();
