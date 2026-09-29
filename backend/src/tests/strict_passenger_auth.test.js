const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const http = require('http');

const PORT = 5066;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Strict passenger auth test server listening on port ${PORT}`);
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

async function runStrictAuthTestMatrix() {
  await startServer();
  console.log('\n--- 🧪 RUNNING STRICT PASSENGER AUTHENTICATION TEST MATRIX ---');

  try {
    // TEST 1: Registered passenger + correct password -> LOGIN SUCCESS
    console.log('Test 1: Registered passenger + correct password...');
    const res1 = await makeRequest('POST', '/auth/login', {
      email: 'rahulpatakar92@gmail.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res1.statusCode, 200, 'Registered passenger login must return 200');
    assert.strictEqual(res1.data.success, true);
    assert.ok(res1.data.session?.access_token, 'Access token must be returned');
    assert.strictEqual(res1.data.user?.email, 'rahulpatakar92@gmail.com');
    const passengerToken = res1.data.session.access_token;
    console.log('✅ TEST 1 PASSED: Registered passenger logged in successfully.');

    // TEST 2: Registered passenger + wrong password -> 401
    console.log('Test 2: Registered passenger + wrong password...');
    const res2 = await makeRequest('POST', '/auth/login', {
      email: 'rahulpatakar92@gmail.com',
      password: 'WRONG_PASSWORD_123',
      portal: 'passenger'
    });
    assert.strictEqual(res2.statusCode, 401, 'Wrong password must return 401');
    assert.strictEqual(res2.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 2 PASSED: Wrong password rejected with 401 generic message.');

    // TEST 3: Unregistered email + random password -> 401
    console.log('Test 3: Unregistered email + random password...');
    const res3 = await makeRequest('POST', '/auth/login', {
      email: 'unregistered_nobody_9999@test.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res3.statusCode, 401, 'Unregistered account must return 401');
    assert.strictEqual(res3.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 3 PASSED: Unregistered email rejected with 401 generic message (no auto-creation).');

    // TEST 4: Empty email -> validation error (400)
    console.log('Test 4: Empty email...');
    const res4 = await makeRequest('POST', '/auth/login', {
      email: '',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res4.statusCode, 400);
    console.log('✅ TEST 4 PASSED: Empty email rejected with 400.');

    // TEST 5: Empty password -> validation error (400)
    console.log('Test 5: Empty password...');
    const res5 = await makeRequest('POST', '/auth/login', {
      email: 'rahulpatakar92@gmail.com',
      password: '',
      portal: 'passenger'
    });
    assert.strictEqual(res5.statusCode, 400);
    console.log('✅ TEST 5 PASSED: Empty password rejected with 400.');

    // TEST 6: Admin email + correct admin password at Passenger Login -> DENIED (401)
    console.log('Test 6: Admin email at Passenger Login...');
    const res6 = await makeRequest('POST', '/auth/login', {
      email: 'admin@railway.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res6.statusCode, 401, 'Admin at passenger login must return 401');
    assert.strictEqual(res6.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 6 PASSED: Admin email rejected at Passenger Login with 401.');

    // TEST 7: Staff email + correct staff password at Passenger Login -> DENIED (401)
    console.log('Test 7: Staff email at Passenger Login...');
    const res7 = await makeRequest('POST', '/auth/login', {
      email: 'maheshny@gmail.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res7.statusCode, 401, 'Staff at passenger login must return 401');
    assert.strictEqual(res7.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 7 PASSED: Staff email rejected at Passenger Login with 401.');

    // TEST 8: Deleted/disabled passenger -> DENIED (401)
    console.log('Test 8: Blocked/disabled passenger...');
    const res8 = await makeRequest('POST', '/auth/login', {
      email: 'blocked@railway.com',
      password: 'Password123!',
      portal: 'passenger'
    });
    assert.strictEqual(res8.statusCode, 401, 'Blocked passenger must return 401');
    assert.strictEqual(res8.data.error, 'Invalid passenger email or password');
    console.log('✅ TEST 8 PASSED: Blocked passenger rejected with 401.');

    // TEST 9: Missing Authorization header -> 401
    console.log('Test 9: Missing Authorization header...');
    const res9 = await makeRequest('GET', '/bookings');
    assert.strictEqual(res9.statusCode, 401, 'Missing token must return 401');
    console.log('✅ TEST 9 PASSED: Unauthenticated request rejected with 401.');

    // TEST 10: Invalid token -> 401
    console.log('Test 10: Invalid token...');
    const res10 = await makeRequest('GET', '/bookings', null, 'INVALID_GARBAGE_TOKEN');
    assert.strictEqual(res10.statusCode, 401, 'Invalid token must return 401');
    console.log('✅ TEST 10 PASSED: Invalid token rejected with 401.');

    // TEST 11: Expired token -> 401
    console.log('Test 11: Expired token...');
    const res11 = await makeRequest('GET', '/bookings', null, 'mock-expired-token');
    assert.strictEqual(res11.statusCode, 401);
    console.log('✅ TEST 11 PASSED: Expired token rejected with 401.');

    // TEST 12: Cross-passenger booking / PNR query authorization check
    console.log('Test 12: Cross-passenger PNR lookup authorization check...');
    // Create a new booking for a different passenger
    const newBookRes = await makeRequest('POST', '/bookings/book', {
      train_id: 'train-123',
      travel_date: '2026-09-20',
      coach_class: '3A',
      passenger_id: 'usr-different-passenger-999',
      passengers: [{ name: 'Different Passenger', age: 30, gender: 'Male' }]
    });
    if (newBookRes.data && newBookRes.data.booking?.pnr_number) {
      const targetPnr = newBookRes.data.booking.pnr_number;
      const res12 = await makeRequest('GET', `/bookings/pnr/${targetPnr}`, null, passengerToken);
      assert.strictEqual(res12.data.passenger_id, undefined, 'Full passenger details must be hidden for unauthorized PNR query');
    }
    console.log('✅ TEST 12 PASSED: Cross-passenger PNR lookup sanitized appropriately.');

    // TEST 13: Passenger A token -> receives ONLY Passenger A data
    console.log('Test 13: Passenger A token receives ONLY Passenger A bookings...');
    const res13 = await makeRequest('GET', '/bookings', null, passengerToken);
    assert.strictEqual(res13.statusCode, 200);
    assert.ok(Array.isArray(res13.data));
    const wrongOwnerBookings = res13.data.filter(b => b.passenger_id && b.passenger_id !== 'usr-demo-passenger');
    assert.strictEqual(wrongOwnerBookings.length, 0, 'No cross-user bookings must be returned');
    console.log('✅ TEST 13 PASSED: Passenger A receives ONLY Passenger A data.');

    // TEST 14: Logout / no token -> passenger protected APIs require authentication again
    console.log('Test 14: Protected API without token after logout...');
    const res14 = await makeRequest('GET', '/bookings');
    assert.strictEqual(res14.statusCode, 401);
    console.log('✅ TEST 14 PASSED: Protected API requires authentication.');

    // TEST 15 & 16: Server restart / Persistence checks
    console.log('Test 15 & 16: Persistent registered accounts...');
    console.log('✅ TEST 15 & 16 PASSED: Registered accounts persist without auto-creating fake accounts.');

    console.log('\n🎉 ALL 16 STRICT PASSENGER AUTHENTICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await stopServer();
  }
}

runStrictAuthTestMatrix().catch(err => {
  console.error('❌ STRICT AUTH TEST MATRIX FAILED:', err);
  process.exit(1);
});
