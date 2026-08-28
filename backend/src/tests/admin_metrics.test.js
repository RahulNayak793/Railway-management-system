const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');

const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Metrics Test Server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log(`🔌 Metrics Test Server stopped.`);
      resolve();
    });
  });
}

const adminToken = 'Bearer mock-base64-eyJpZCI6InVzci1hZG1pbiIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AcmFpbHdheS5jb20ifQ==';

async function makeRequest(reqPath) {
  const url = `${BASE_URL}${reqPath}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': adminToken
    }
  });
  const json = await response.json();
  return { status: response.status, body: json };
}

async function runMetricsTests() {
  console.log('\n--- 🧪 RUNNING ADMIN METRICS API INTEGRATION TESTS ---');
  await startServer();

  try {
    // Test 1: GET /api/admin/metrics (default 7d period)
    console.log('\nTest 1: Default GET /api/admin/metrics...');
    const res1 = await makeRequest('/admin/metrics');
    assert.strictEqual(res1.status, 200, 'Metrics endpoint should return 200 OK');
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.period, '7d');
    assert.ok(res1.body.summary, 'Summary must exist');
    assert.strictEqual(res1.body.summary.totalStaff, undefined, 'Total Staff must NOT be present in summary metric');
    assert.ok(typeof res1.body.summary.totalTrains === 'number');
    assert.ok(typeof res1.body.summary.totalRoutes === 'number');
    assert.ok(typeof res1.body.summary.totalStations === 'number');
    assert.ok(res1.body.trainStatus, 'trainStatus map must exist');
    assert.ok(res1.body.bookingStatus, 'bookingStatus map must exist');
    assert.ok(Array.isArray(res1.body.bookingTrend), 'bookingTrend must be an array');
    console.log('✅ Test 1 Passed: Default metrics endpoint returns dynamic structure without Total Staff.');

    // Test 2: Period 30d
    console.log('\nTest 2: GET /api/admin/metrics?period=30d...');
    const res2 = await makeRequest('/admin/metrics?period=30d');
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.period, '30d');
    assert.strictEqual(res2.body.bookingTrend.length, 30, '30d trend should contain 30 items');
    console.log('✅ Test 2 Passed: 30d period parameters work correctly.');

    // Test 3: Period Month
    console.log('\nTest 3: GET /api/admin/metrics?period=month...');
    const res3 = await makeRequest('/admin/metrics?period=month');
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.body.period, 'month');
    console.log('✅ Test 3 Passed: Monthly period parameter works.');

    // Test 4: Period Year
    console.log('\nTest 4: GET /api/admin/metrics?period=year...');
    const res4 = await makeRequest('/admin/metrics?period=year');
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.body.period, 'year');
    assert.strictEqual(res4.body.bookingTrend.length, 12, 'Year trend should contain 12 month items');
    console.log('✅ Test 4 Passed: Yearly period parameter works.');

    console.log('\n🎉 ALL ADMIN METRICS API TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Metrics Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runMetricsTests();
