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

const PORT = 5062;
const BASE_URL = `http://localhost:${PORT}/api`;
let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Station repair test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
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
  console.log('\n--- 🧪 RUNNING STATION DATA REPAIR & FORMATTING TESTS ---');
  await startServer();

  try {
    const passengerId = 'usr-test-station-p1';
    const email = 'stationtest@railway.com';
    const token = jwt.sign({ id: passengerId, email, role: 'passenger' }, process.env.JWT_SECRET);

    mockDb.profiles.set(passengerId, { id: passengerId, full_name: 'Station Test User', email, role: 'passenger' });

    // Seed test booking with complete station codes and names
    mockDb.bookings.set('bk-station-test-1', {
      id: 'bk-station-test-1',
      pnr_number: '7788990022',
      passenger_id: passengerId,
      train_id: 't-12952',
      train_name: 'Udupi Express',
      train_number: '12345',
      source: 'UDU',
      destination: 'NDLS',
      source_station_code: 'UDU',
      destination_station_code: 'NDLS',
      source_station_name: 'UDUPI',
      destination_station_name: 'NEW DELHI',
      travel_date: '2026-10-20',
      total_fare: 1450,
      status: 'confirmed'
    });

    saveMockDbToFile();

    const res = await makeRequest('/bookings', token);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body), 'Response should be an array');
    assert.strictEqual(res.body.length, 1);

    const b = res.body[0];
    console.log('Returned Booking Station Data:', {
      source: b.source,
      destination: b.destination,
      source_station_name: b.source_station_name,
      destination_station_name: b.destination_station_name
    });

    // Validations
    assert.notStrictEqual(b.source, 'undefined', 'Source code must not be "undefined"');
    assert.notStrictEqual(b.destination, 'undefined', 'Destination code must not be "undefined"');
    assert.notStrictEqual(b.source, 'ADMIN', 'Source code must not be ADMIN');
    assert.notStrictEqual(b.destination, 'ADMIN', 'Destination code must not be ADMIN');
    assert.strictEqual(b.source_station_code, 'UDU');
    assert.strictEqual(b.destination_station_code, 'NDLS');
    assert(b.source_station_name && b.source_station_name !== 'undefined', 'Source station name must be populated');
    assert(b.destination_station_name && b.destination_station_name !== 'undefined', 'Destination station name must be populated');

    console.log('✅ Test 1 Passed: Boarding and destination station codes resolve cleanly without ADMIN/undefined.');
    console.log('✅ Test 2 Passed: Station names are correctly formatted and returned by GET /api/bookings.');
    console.log('🎉 ALL STATION DATA REPAIR & FORMATTING TESTS PASSED SUCCESSFULLY!\n');
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
