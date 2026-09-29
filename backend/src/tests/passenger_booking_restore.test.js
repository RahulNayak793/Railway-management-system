const path = require('path');
const assert = require('assert');
const jwt = require('jsonwebtoken');

// Enforce test-db.json ONLY
process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-12345';
const testDbPath = path.join(__dirname, '../../data/test-db.json');
process.env.DB_FILE_PATH = testDbPath;

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const app = require('../index');

const PORT = 5058;
const BASE_URL = `http://localhost:${PORT}/api`;
let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Passenger restore test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log(`🔌 Test server stopped.`);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function makeRequest(pathStr, token) {
  const url = `${BASE_URL}${pathStr}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  const text = await response.text();
  let json = [];
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: response.status, body: json };
}

async function runTests() {
  console.log('\n--- 🧪 RUNNING PASSENGER BOOKING RESTORATION & ISOLATION TESTS ---');
  await startServer();

  try {
    const passengerAId = 'usr-test-restore-p1';
    const passengerAEmail = 'passengerA@test.com';
    const passengerBId = 'usr-test-restore-p2';
    const passengerBEmail = 'passengerB@test.com';

    const tokenA = jwt.sign({ id: passengerAId, email: passengerAEmail, role: 'passenger' }, process.env.JWT_SECRET);
    const tokenB = jwt.sign({ id: passengerBId, email: passengerBEmail, role: 'passenger' }, process.env.JWT_SECRET);

    // Seed test-db with test users and bookings
    mockDb.profiles.set(passengerAId, { id: passengerAId, full_name: 'Passenger A', email: passengerAEmail, role: 'passenger' });
    mockDb.profiles.set(passengerBId, { id: passengerBId, full_name: 'Passenger B', email: passengerBEmail, role: 'passenger' });

    mockDb.bookings.set('bk-restore-a1', {
      id: 'bk-restore-a1',
      pnr_number: '9900112233',
      passenger_id: passengerAId,
      train_id: 't-12952',
      train_name: 'Express Special',
      travel_date: '2026-10-01',
      total_fare: 1500,
      status: 'confirmed'
    });

    mockDb.bookings.set('bk-restore-b1', {
      id: 'bk-restore-b1',
      pnr_number: '8877665544',
      passenger_id: passengerBId,
      train_id: 't-12952',
      train_name: 'Express Special',
      travel_date: '2026-10-05',
      total_fare: 1200,
      status: 'confirmed'
    });

    mockDb.bookings.set('bk-seed-dummy-99', {
      id: 'bk-seed-dummy-99',
      pnr_number: '1111111111',
      passenger_id: 'usr-demo-test-account',
      train_id: 't-12952',
      train_name: 'Dummy Train',
      travel_date: '2026-10-10',
      total_fare: 500,
      status: 'confirmed'
    });

    saveMockDbToFile();

    // Test 1: Passenger A isolation
    const resA = await makeRequest('/bookings', tokenA);
    assert.strictEqual(resA.status, 200);
    assert(Array.isArray(resA.body), 'Response should be an array');
    assert.strictEqual(resA.body.length, 1);
    assert.strictEqual(resA.body[0].id, 'bk-restore-a1');
    console.log('✅ Test 1 Passed: Passenger A receives ONLY Passenger A bookings.');

    // Test 2: Passenger B isolation
    const resB = await makeRequest('/bookings', tokenB);
    assert.strictEqual(resB.status, 200);
    assert(Array.isArray(resB.body), 'Response should be an array');
    assert.strictEqual(resB.body.length, 1);
    assert.strictEqual(resB.body[0].id, 'bk-restore-b1');
    console.log('✅ Test 2 Passed: Passenger B receives ONLY Passenger B bookings.');

    // Test 3: Dummy seed bookings exclusion
    const hasDummyA = resA.body.some(b => b.id === 'bk-seed-dummy-99');
    const hasDummyB = resB.body.some(b => b.id === 'bk-seed-dummy-99');
    assert.strictEqual(hasDummyA, false);
    assert.strictEqual(hasDummyB, false);
    console.log('✅ Test 3 Passed: Dummy seed bookings are NEVER returned to Passenger A or B.');

    console.log('🎉 ALL PASSENGER BOOKING RESTORATION & ISOLATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test Execution Failed:', err);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
