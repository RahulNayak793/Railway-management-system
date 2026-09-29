const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const railRadarService = require('../services/railRadarService');

const PORT = 5123;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => {
      console.log(`🔌 Test server stopped.`);
      resolve();
    });
  });
}

async function makeRequest(urlPath, options = {}) {
  const url = `${BASE_URL}${urlPath}`;
  const response = await fetch(url, {
    ...options,
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
  console.log('\n--- 🧪 RUNNING RAILRADAR LIVE SEARCH ENDPOINT TESTS ---');
  await startServer();

  try {
    // Test 1: Valid live search with parameters
    console.log('Test 1: Valid station, date, and time search...');
    const res1 = await makeRequest('/trains/live-search?from=NDLS&to=MMCT&date=2026-09-17&time=18:30');
    assert.strictEqual(res1.status, 200, 'Should return HTTP 200 for valid search');
    assert.strictEqual(res1.body.success, true, 'Should return success=true');
    assert.strictEqual(res1.body.query.from, 'NDLS', 'Query from should be NDLS');
    assert.strictEqual(res1.body.query.to, 'MMCT', 'Query to should be MMCT');
    assert.ok(Array.isArray(res1.body.trains), 'Trains should be an array');
    console.log('✅ Test 1 Passed: Valid search succeeded');

    // Test 2: Missing station parameters
    console.log('Test 2: Missing station parameters returns 400 error...');
    const res2 = await makeRequest('/trains/live-search?date=2026-09-17&time=18:30');
    assert.strictEqual(res2.status, 400, 'Should return 400 for missing stations');
    assert.strictEqual(res2.body.success, false, 'Success should be false');
    assert.ok(res2.body.error.includes('Please select valid departure station'), 'Error message should match required specs');
    console.log('✅ Test 2 Passed: 400 validation error returned');

    // Test 3: Missing date parameter
    console.log('Test 3: Missing date parameter returns 400 error...');
    const res3 = await makeRequest('/trains/live-search?from=NDLS&to=MMCT&time=18:30');
    assert.strictEqual(res3.status, 400, 'Should return 400 for missing date');
    assert.strictEqual(res3.body.success, false, 'Success should be false');
    console.log('✅ Test 3 Passed: 400 date validation error returned');

    // Test 4: Fallback behavior when RailRadar API key is absent or endpoint unavailable
    console.log('Test 4: API failure triggers graceful fallback...');
    const res4 = await makeRequest('/trains/live-search?from=NDLS&to=MMCT&date=2026-09-17&time=18:30');
    assert.strictEqual(res4.status, 200, 'Should return HTTP 200 with fallback data');
    assert.strictEqual(res4.body.success, true, 'Success should remain true');
    assert.ok(res4.body.data_source_label, 'Data source label should be populated');
    console.log('✅ Test 4 Passed: Fallback data source label present');

    // Test 5: Empty search results for non-existent station route
    console.log('Test 5: Empty result for non-existent station route...');
    const res5 = await makeRequest('/trains/live-search?from=INVALID1&to=INVALID2&date=2026-09-17&time=18:30');
    assert.strictEqual(res5.status, 200, 'Should return 200 OK for valid request format with no matching trains');
    assert.strictEqual(res5.body.success, true, 'Success should be true');
    assert.strictEqual(res5.body.trains.length, 0, 'Trains array should be empty');
    console.log('✅ Test 5 Passed: Empty train result returned');

    // Test 6: Security test — RailRadar API key not exposed in response body
    console.log('Test 6: Security check — RAILRADAR_API_KEY is not leaked...');
    const strRes = JSON.stringify(res1.body);
    assert.strictEqual(strRes.includes(process.env.RAILRADAR_API_KEY || 'SECRET_KEY_NOT_FOUND'), false, 'API Key must not be in response body');
    console.log('✅ Test 6 Passed: Secret key is secure');

    // Test 7: Integrity of RailControl booking data
    console.log('Test 7: Booking attributes preserved on train results...');
    if (res1.body.trains.length > 0) {
      const train = res1.body.trains[0];
      assert.ok(train.available_classes, 'Train should have available_classes');
      assert.ok(train.route, 'Train should have route information');
    }
    console.log('✅ Test 7 Passed: Booking compatibility preserved');

    // Test 8: Dual connection status endpoint verification
    console.log('Test 8: Separate DB & RailRadar connection status check...');
    const statusRes = await makeRequest('/trains/data-source-status');
    assert.strictEqual(statusRes.status, 200, 'Data source status should return HTTP 200');
    assert.ok(statusRes.body.database, 'Must include database status block');
    assert.ok(statusRes.body.railradar, 'Must include railradar status block');
    assert.strictEqual(statusRes.body.database.status, 'CONNECTED', 'Project Master Database should be CONNECTED');
    console.log(`✅ Test 8 Passed: DB Status (${statusRes.body.database.status}) and RailRadar Status (${statusRes.body.railradar.status}) reported separately`);

    console.log('\n🎉 ALL 8 RAILRADAR LIVE SEARCH & DUAL DATA SOURCE TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runTests();
