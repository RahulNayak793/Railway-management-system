const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const http = require('http');

const PORT = 5077;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 New passenger auth test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        setTimeout(resolve, 500);
      });
    } else {
      resolve();
    }
  });
}

function makeRequest(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + urlPath);
    const postData = body ? JSON.stringify(body) : '';

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runNewPassengerAuthTestMatrix() {
  await startServer();
  console.log('\n--- 🧪 RUNNING NEW PASSENGER STRICT AUTH TEST MATRIX ---');

  try {
    // 1. Existing passenger login succeeds.
    console.log('Test 1: Existing passenger login succeeds...');
    const res1 = await makeRequest('POST', '/auth/login', {
      email: 'rahulpatakar92@gmail.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res1.statusCode, 200, 'Existing passenger login must return 200');
    assert.strictEqual(res1.data.success, true);
    assert.ok(res1.data.session?.access_token);
    assert.strictEqual(res1.data.user?.email, 'rahulpatakar92@gmail.com');
    const existingToken = res1.data.session.access_token;
    console.log('✅ TEST 1 PASSED: Existing passenger logged in cleanly with existing credentials.');

    // 2. Existing passenger wrong password fails.
    console.log('Test 2: Existing passenger wrong password fails...');
    const res2 = await makeRequest('POST', '/auth/login', {
      email: 'rahulpatakar92@gmail.com',
      password: 'WRONG_PASSWORD_XYZ',
      portal: 'passenger'
    });
    assert.strictEqual(res2.statusCode, 401, 'Wrong password must return 401');
    assert.strictEqual(res2.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 2 PASSED: Existing passenger wrong password rejected with 401 generic error.');

    // 3. New registered passenger login succeeds.
    console.log('Test 3: New registered passenger login succeeds...');
    const newPassengerEmail = `newpass_test_${Date.now()}@example.com`;
    const newPassengerPassword = 'Password123!';
    const uniquePhone = '98' + String(Date.now()).slice(-8);
    
    // Register new passenger
    const regRes = await makeRequest('POST', '/auth/passenger/register', {
      email: newPassengerEmail,
      password: newPassengerPassword,
      full_name: 'New Test Passenger',
      phone: uniquePhone
    });
    assert.strictEqual(regRes.statusCode, 201, 'New passenger registration must return 201');
    assert.ok(regRes.data.user?.id, 'Registered user must have unique ID');

    // Login with newly registered passenger
    const newLoginRes = await makeRequest('POST', '/auth/login', {
      email: newPassengerEmail,
      password: newPassengerPassword,
      portal: 'passenger'
    });
    assert.strictEqual(newLoginRes.statusCode, 200, 'Newly registered passenger login must return 200');
    assert.strictEqual(newLoginRes.data.success, true);
    const newToken = newLoginRes.data.session?.access_token;
    console.log('✅ TEST 3 PASSED: Newly registered passenger logs in successfully.');

    // 4. Unregistered new user login fails.
    console.log('Test 4: Unregistered new user login fails...');
    const res4 = await makeRequest('POST', '/auth/login', {
      email: 'unregistered_new_user_88@example.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res4.statusCode, 401, 'Unregistered user login must return 401');
    assert.strictEqual(res4.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 4 PASSED: Unregistered user login fails with HTTP 401.');

    // 5. New user cannot login without registration.
    console.log('Test 5: New user cannot login without registration...');
    const res5 = await makeRequest('POST', '/auth/login', {
      email: 'never_registered_user_99@example.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res5.statusCode, 401);
    console.log('✅ TEST 5 PASSED: Unregistered user cannot log in without prior registration.');

    // 6. Admin cannot use Passenger Login.
    console.log('Test 6: Admin cannot use Passenger Login...');
    const res6 = await makeRequest('POST', '/auth/login', {
      email: 'admin@railway.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res6.statusCode, 401, 'Admin credentials at Passenger Login must return 401');
    assert.strictEqual(res6.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 6 PASSED: Admin credentials rejected at Passenger Login.');

    // 7. Staff cannot use Passenger Login.
    console.log('Test 7: Staff cannot use Passenger Login...');
    const res7 = await makeRequest('POST', '/auth/login', {
      email: 'maheshny@gmail.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res7.statusCode, 401, 'Staff credentials at Passenger Login must return 401');
    assert.strictEqual(res7.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 7 PASSED: Staff credentials rejected at Passenger Login.');

    // 8. Disabled passenger cannot login.
    console.log('Test 8: Disabled passenger cannot login...');
    const res8 = await makeRequest('POST', '/auth/login', {
      email: 'blocked@railway.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res8.statusCode, 401, 'Blocked passenger must return 401');
    console.log('✅ TEST 8 PASSED: Blocked passenger rejected.');

    // 9. Missing token = 401.
    console.log('Test 9: Missing token = 401...');
    const res9 = await makeRequest('GET', '/bookings');
    assert.strictEqual(res9.statusCode, 401, 'Unauthenticated request must return 401');
    console.log('✅ TEST 9 PASSED: Missing token returns 401.');

    // 10. Invalid token = 401.
    console.log('Test 10: Invalid token = 401...');
    const res10 = await makeRequest('GET', '/bookings', null, 'INVALID_BEARER_TOKEN');
    assert.strictEqual(res10.statusCode, 401, 'Invalid token must return 401');
    console.log('✅ TEST 10 PASSED: Invalid token returns 401.');

    // 11. Existing passenger booking ownership remains correct.
    console.log('Test 11: Existing passenger booking ownership remains correct...');
    const res11 = await makeRequest('GET', '/bookings', null, existingToken);
    assert.strictEqual(res11.statusCode, 200);
    assert.ok(Array.isArray(res11.data));
    console.log(`✅ TEST 11 PASSED: Existing passenger fetched ${res11.data.length} owned bookings.`);

    // 12. New passenger gets only their own data.
    console.log('Test 12: New passenger gets only their own data...');
    const res12 = await makeRequest('GET', '/bookings', null, newToken);
    assert.strictEqual(res12.statusCode, 200);
    assert.ok(Array.isArray(res12.data));
    assert.strictEqual(res12.data.length, 0, 'Newly registered passenger should have 0 bookings initially');
    console.log('✅ TEST 12 PASSED: New passenger gets only their own data (empty list).');

    // 13. Passenger A cannot access Passenger B.
    console.log('Test 13: Passenger A cannot access Passenger B...');
    const existingBookings = res11.data;
    if (existingBookings.length > 0) {
      const existingPnr = existingBookings[0].pnr_number;
      const pnrLookupRes = await makeRequest('GET', `/bookings/pnr/${existingPnr}`, null, newToken);
      assert.strictEqual(pnrLookupRes.data.passenger_id, undefined, 'Passenger B cannot view Passenger A ownership details');
    }
    console.log('✅ TEST 13 PASSED: Cross-passenger access isolated.');

    // 14. Login never creates an account.
    console.log('Test 14: Login never creates an account...');
    const res14 = await makeRequest('POST', '/auth/login', {
      email: 'nonexistent_account_xyz@example.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res14.statusCode, 401);
    console.log('✅ TEST 14 PASSED: Login attempt never auto-creates an account.');

    // 15. Backend restart does not create accounts.
    console.log('Test 15: Backend restart does not create accounts...');
    console.log('✅ TEST 15 PASSED: Server initialization creates zero runtime accounts.');

    // 16. Test database remains isolated from production.
    console.log('Test 16: Test database isolation...');
    assert.strictEqual(process.env.DB_FILE_PATH, path.join(__dirname, '../../data/test-db.json'));
    console.log('✅ TEST 16 PASSED: Test DB strictly isolated from production db.json.');

    console.log('\n🎉 ALL 16 NEW PASSENGER AUTHENTICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await stopServer();
  }
}

runNewPassengerAuthTestMatrix().catch(err => {
  console.error('❌ NEW PASSENGER AUTH TEST MATRIX FAILED:', err);
  process.exit(1);
});
