const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.resolve(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const app = require('../index');
const { mockDb, saveMockDbToFile } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}`;
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
const prodDbPath = path.resolve(__dirname, '../../data/db.json');

const makeToken = (id, role, email = 'passenger@railway.com') => {
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

async function runPassengerAuthTests() {
  console.log('🧪 Starting Passenger Authentication & Registration Verification Test Suite...\n');

  const prodDbBefore = fs.readFileSync(prodDbPath, 'utf8');

  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Passenger Auth Test Server listening on port ${PORT}`);
      resolve();
    });
  });

  const uniqueEmail = `passenger.test.${Date.now()}@domain.com`;
  const uniquePhone = `98765${Math.floor(10005 + Math.random() * 89995)}`;
  const validPassword = 'Password123!';

  try {
    // 1. Missing required fields rejected
    console.log('TEST 1: Missing required fields rejected (400)...');
    const t1 = await request('POST', '/api/auth/signup', { email: '' });
    assert.strictEqual(t1.status, 400);
    console.log('   ✅ PASS: Missing email/password rejected with 400.');

    // 2. Invalid email format rejected
    console.log('TEST 2: Invalid email format rejected (400)...');
    const t2 = await request('POST', '/api/auth/signup', {
      email: 'not-an-email',
      password: validPassword
    });
    assert.strictEqual(t2.status, 400);
    assert.ok(t2.data.error.includes('valid email address'));
    console.log('   ✅ PASS: Invalid email format rejected with 400.');

    // 3. Weak password rejected (no uppercase, no special char)
    console.log('TEST 3: Weak password rejected (400)...');
    const t3 = await request('POST', '/api/auth/signup', {
      email: 'weak.password@test.com',
      password: 'simple'
    });
    assert.strictEqual(t3.status, 400);
    assert.ok(t3.data.error.includes('8 characters') || t3.data.error.includes('uppercase'));
    console.log('   ✅ PASS: Weak password rejected with 400.');

    // 4. Passenger registration success
    console.log('TEST 4: Passenger registration success (201)...');
    const t4 = await request('POST', '/api/auth/passenger/register', {
      email: uniqueEmail,
      password: validPassword,
      full_name: 'Test Passenger User',
      phone: uniquePhone
    });
    assert.strictEqual(t4.status, 201);
    assert.strictEqual(t4.data.user.email, uniqueEmail);
    assert.strictEqual(t4.data.user.role, 'passenger');
    assert.strictEqual(t4.data.user.password, undefined);
    assert.strictEqual(t4.data.user.password_hash, undefined);
    console.log('   ✅ PASS: Passenger registered successfully with forced PASSENGER role, password omitted.');

    // 5. Duplicate email rejected
    console.log('TEST 5: Duplicate email rejected (400)...');
    const t5 = await request('POST', '/api/auth/signup', {
      email: uniqueEmail,
      password: validPassword,
      full_name: 'Duplicate User'
    });
    assert.strictEqual(t5.status, 400);
    assert.ok(t5.data.error.includes('already exists'));
    console.log('   ✅ PASS: Duplicate email registration rejected with 400.');

    // 6. Privilege Escalation Prevention (role=ADMIN in signup request)
    console.log('TEST 6: Privilege Escalation Prevention (role=ADMIN submitted)...');
    const t6 = await request('POST', '/api/auth/signup', {
      email: `admin.hack.${Date.now()}@domain.com`,
      password: validPassword,
      role: 'ADMIN'
    });
    assert.strictEqual(t6.status, 403);
    assert.ok(t6.data.error.includes('Public registration for staff or admin accounts is not permitted'));
    console.log('   ✅ PASS: Client attempt to register role=ADMIN rejected with 403.');

    // 7. Passenger login success
    console.log('TEST 7: Passenger login success...');
    const t7 = await request('POST', '/api/auth/login', {
      email: uniqueEmail,
      password: validPassword,
      portal: 'passenger'
    });
    assert.strictEqual(t7.status, 200);
    assert.strictEqual(t7.data.user.role, 'passenger');
    assert.ok(t7.data.session.access_token);
    const passengerToken = t7.data.session.access_token;
    console.log('   ✅ PASS: Passenger logged in successfully at /passenger/login endpoint handler.');

    // 8. Staff cannot login through passenger portal
    console.log('TEST 8: Staff cannot login through passenger portal...');
    const staffEmail = 'maheshny@gmail.com';
    const t8 = await request('POST', '/api/auth/login', {
      email: staffEmail,
      password: 'password',
      portal: 'passenger'
    });
    assert.strictEqual(t8.status, 403);
    assert.ok(t8.data.error.includes('Staff accounts cannot log in on the Passenger Login page'));
    console.log('   ✅ PASS: Staff login via passenger portal rejected with 403.');

    // 9. Admin cannot login through passenger portal
    console.log('TEST 9: Admin cannot login through passenger portal...');
    const t9 = await request('POST', '/api/auth/login', {
      email: 'admin@railway.com',
      password: 'password',
      portal: 'passenger'
    });
    assert.strictEqual(t9.status, 403);
    assert.ok(t9.data.error.includes('Admin accounts cannot log in on the Passenger Login page'));
    console.log('   ✅ PASS: Admin login via passenger portal rejected with 403.');

    // 10. Passenger cannot access staff endpoints
    console.log('TEST 10: Passenger cannot access staff endpoints...');
    const t10 = await request('GET', '/api/staff/dashboard', null, passengerToken);
    assert.strictEqual(t10.status, 403);
    console.log('   ✅ PASS: Passenger access to /api/staff/dashboard blocked with 403.');

    // 11. Passenger cannot access admin endpoints
    console.log('TEST 11: Passenger cannot access admin endpoints...');
    const t11 = await request('GET', '/api/admin/users', null, passengerToken);
    assert.strictEqual(t11.status, 403);
    console.log('   ✅ PASS: Passenger access to /api/admin/users blocked with 403.');

    // 12. Password Reset Request & Execution
    console.log('TEST 12: Password Reset Request & Execution...');
    const t12a = await request('POST', '/api/auth/forgot-password', { email: uniqueEmail });
    assert.strictEqual(t12a.status, 200);
    assert.ok(t12a.data.message.includes('Password reset link sent'));

    const t12b = await request('POST', '/api/auth/reset-password', {
      email: uniqueEmail,
      newPassword: 'NewPassword456!'
    });
    assert.strictEqual(t12b.status, 200);
    assert.ok(t12b.data.message.includes('reset successfully'));
    console.log('   ✅ PASS: Password reset request and password update flow succeeded.');

    // 13. Production DB checksum verification
    console.log('\nVerifying production db.json data isolation...');
    const prodDbAfter = fs.readFileSync(prodDbPath, 'utf8');
    assert.strictEqual(prodDbAfter, prodDbBefore, 'Production db.json MUST NOT be modified during test runs!');
    console.log('   ✅ PASS: Production db.json remained untouched.');

    console.log('\n🎉 ALL PASSENGER AUTHENTICATION VERIFICATION TESTS PASSED!');
  } finally {
    if (server) server.close();
  }
}

runPassengerAuthTests().catch((err) => {
  console.error('❌ Passenger Auth Test Suite Failed:', err);
  process.exit(1);
});
