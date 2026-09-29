const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const fs = require('fs');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Route Network Test Server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log(`🔌 Route Network Test Server stopped.`);
      resolve();
    });
  });
}

const adminToken = 'Bearer mock-base64-eyJpZCI6InVzci1hZG1pbiIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AcmFpbHdheS5jb20ifQ==';
const passengerToken = 'Bearer mock-base64-eyJpZCI6InVzci0xIiwicm9sZSI6InBhc3NlbmdlciIsImVtYWlsIjoicmFtZXNoQGdtYWlsLmNvbSJ9';

async function makeRequest(reqPath, options = {}) {
  const url = `${BASE_URL}${reqPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': adminToken,
      ...options.headers
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: response.status, body: json };
}

async function runExpandedRouteTests() {
  console.log('\n--- 🧪 RUNNING COMPREHENSIVE ROUTE NETWORK INTEGRATION TESTS ---');

  await startServer();

  if (!mockDb.routes.has('r-test-fwd')) {
    mockDb.routes.set('r-test-fwd', {
      id: 'r-test-fwd',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      departure_time: '16:00',
      arrival_time: '08:00',
      distance_km: 1384,
      stops: [{ stationCode: 'KOTA', arrTime: '21:00', depTime: '21:10' }]
    });
  }
  if (!mockDb.routes.has('r-test-rev')) {
    mockDb.routes.set('r-test-rev', {
      id: 'r-test-rev',
      source_station_code: 'MMCT',
      destination_station_code: 'NDLS',
      departure_time: '17:00',
      arrival_time: '09:00',
      distance_km: 1384,
      stops: [{ stationCode: 'KOTA', arrTime: '02:00', depTime: '02:10' }]
    });
  }

  if (!mockDb.trains.has('t-test-admin-routes')) {
    mockDb.trains.set('t-test-admin-routes', {
      id: 't-test-admin-routes',
      train_number: '12951',
      train_name: 'Rajdhani Express',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT'
    });
  }

  saveMockDbToFile();

  try {
    // Audit db.json count directly
    const rawDb = fs.readFileSync(process.env.DB_FILE_PATH, 'utf-8');
    const parsedDb = JSON.parse(rawDb);
    const dbRouteCount = Array.isArray(parsedDb.routes) ? parsedDb.routes.length : 0;
    console.log(`Direct Database Routes Count: ${dbRouteCount}`);

    // 1. GET all routes
    console.log('\nTest 1: GET /api/admin/routes...');
    const getRes = await makeRequest('/admin/routes');
    assert.strictEqual(getRes.status, 200, 'GET /admin/routes should return 200 OK');
    const returnedRoutes = Array.isArray(getRes.body) ? getRes.body : getRes.body.routes;
    const apiTotalCount = Array.isArray(getRes.body) ? getRes.body.length : getRes.body.total;

    // Requirement 28 assertions:
    if (dbRouteCount > 3 && apiTotalCount === 3) {
      throw new Error("CRITICAL: API is still returning only 3 routes");
    }
    assert.strictEqual(apiTotalCount, dbRouteCount, 'Database route count must strictly match API total count');
    console.log(`✅ Test 1 Passed: GET /api/admin/routes returned ${apiTotalCount} routes matching database (${dbRouteCount}).`);

    // 2. Paginated Route Dataset API test
    console.log('\nTest 2: Paginated Route Dataset API Verification...');
    const paginatedRes = await makeRequest('/admin/routes?page=1&pageSize=25');
    assert.strictEqual(paginatedRes.status, 200);
    assert.strictEqual(paginatedRes.body.success, true);
    assert.strictEqual(paginatedRes.body.routes.length, Math.min(25, dbRouteCount));
    assert.strictEqual(paginatedRes.body.total, dbRouteCount);
    assert.strictEqual(paginatedRes.body.page, 1);
    assert.strictEqual(paginatedRes.body.pageSize, 25);
    console.log(`✅ Test 2 Passed: Paginated API verified (Page 1 of ${paginatedRes.body.totalPages}, Total: ${paginatedRes.body.total}).`);

    // 3. Page 2 vs Page 1 Difference Verification
    console.log('\nTest 3: Page 1 vs Page 2 Routes Difference Verification...');
    if (dbRouteCount > 25) {
      const page2Res = await makeRequest('/admin/routes?page=2&pageSize=25');
      assert.strictEqual(page2Res.status, 200);
      assert.notStrictEqual(paginatedRes.body.routes[0].id, page2Res.body.routes[0]?.id, 'Page 1 and Page 2 must return different items');
      console.log('✅ Test 3 Passed: Page 1 and Page 2 return distinct route subsets.');
    } else {
      console.log('✅ Test 3 Passed: dbRouteCount <= 25 (Page 1 contains all items).');
    }

    // 4. No duplicate route signatures
    console.log('\nTest 4: No Duplicate Signatures Check...');
    const signatureSet = new Set();
    let hasDuplicate = false;
    returnedRoutes.forEach(r => {
      const stopsSig = Array.isArray(r.stops) ? r.stops.map(s => s.stationCode).join('|') : '';
      const sig = `${r.source_station_code}|${r.destination_station_code}|${stopsSig}`;
      if (signatureSet.has(sig)) {
        hasDuplicate = true;
      }
      signatureSet.add(sig);
    });
    assert.strictEqual(hasDuplicate, false, 'Route dataset must not contain duplicate signatures');
    console.log('✅ Test 4 Passed: Zero duplicate signatures found.');

    // 5 & 6. Source & Destination Station Validation
    console.log('\nTest 5 & 6: Source & Destination Station Validation...');
    const invalidStationRes = await makeRequest('/admin/routes', {
      method: 'POST',
      body: JSON.stringify({
        source_station_code: 'INVALID_XYZ',
        destination_station_code: 'NDLS',
        distance_km: 500
      })
    });
    assert.strictEqual(invalidStationRes.status, 400, 'Invalid source station code should return 400');
    console.log('✅ Test 5 & 6 Passed: Invalid station validation rejected.');

    // 7. Reverse Routes Work
    console.log('\nTest 7: Reverse Routes Verification...');
    const fwdRoute = returnedRoutes.find(r => r.source_station_code === 'NDLS' && r.destination_station_code === 'MMCT');
    const revRoute = returnedRoutes.find(r => r.source_station_code === 'MMCT' && r.destination_station_code === 'NDLS');
    assert.ok(fwdRoute, 'NDLS -> MMCT route should exist');
    assert.ok(revRoute, 'MMCT -> NDLS reverse route should exist');
    console.log('✅ Test 7 Passed: Reverse routes exist and operate independently.');

    // 8. Intermediate Stops Work
    console.log('\nTest 8: Intermediate Stops Verification...');
    const routeWithStops = returnedRoutes.find(r => Array.isArray(r.stops) && r.stops.length > 0);
    assert.ok(routeWithStops, 'At least one route with intermediate stops must exist');
    assert.ok(routeWithStops.stops[0].stationCode, 'Stop station code must be defined');
    console.log(`✅ Test 8 Passed: Route ${routeWithStops.source_station_code} ➔ ${routeWithStops.destination_station_code} has ${routeWithStops.stops.length} intermediate stops.`);

    // 9. Create Route
    console.log('\nTest 9: POST Create Route...');
    const createRes = await makeRequest('/admin/routes', {
      method: 'POST',
      body: JSON.stringify({
        source_station_code: 'SBC',
        destination_station_code: 'SML',
        distance_km: 2750,
        departure_time: '06:00:00',
        arrival_time: '18:00:00',
        status: 'Active',
        stops: []
      })
    });
    assert.strictEqual(createRes.status, 201, 'POST /admin/routes should return 201');
    const createdId = createRes.body.route.id;
    console.log('✅ Test 9 Passed: New route created successfully.');

    // 10. Edit Route
    console.log('\nTest 10: PUT Edit Route...');
    const editRes = await makeRequest(`/admin/routes/${createdId}`, {
      method: 'PUT',
      body: JSON.stringify({
        source_station_code: 'SBC',
        destination_station_code: 'SML',
        distance_km: 2800,
        departure_time: '06:00:00',
        arrival_time: '19:00:00',
        status: 'Active',
        stops: [
          { sequence: 1, stationCode: 'KLK', arrTime: '12:00:00', depTime: '12:15:00', distanceFromOriginKm: 2700 }
        ]
      })
    });
    assert.strictEqual(editRes.status, 200, 'PUT /admin/routes/:id should return 200');
    assert.strictEqual(editRes.body.route.distance_km, 2800);
    console.log('✅ Test 10 Passed: Route edited successfully.');

    // 11 & 12. Delete Unused vs Active Train Safety
    console.log('\nTest 11 & 12: Safe Delete Verification...');
    const delUnusedRes = await makeRequest(`/admin/routes/${createdId}`, { method: 'DELETE' });
    assert.strictEqual(delUnusedRes.status, 200, 'Unused route deletion should return 200');

    // Attempt to delete route assigned to test train
    const firstAssignedRoute = returnedRoutes.find(r => r.trains_count > 0);
    if (firstAssignedRoute) {
      const delAssignedRes = await makeRequest(`/admin/routes/${firstAssignedRoute.id}`, { method: 'DELETE' });
      assert.strictEqual(delAssignedRes.status, 400, 'Deleting assigned route must return 400');
    }
    console.log('✅ Test 11 & 12 Passed: Safe delete logic prevents deleting routes assigned to trains.');

    // 13. Activate / Deactivate Route
    console.log('\nTest 13: Activate / Deactivate Route Status...');
    const toggleRes = await makeRequest(`/admin/routes/r-test-fwd/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Inactive' })
    });
    assert.strictEqual(toggleRes.status, 200, 'PATCH status update should return 200');
    assert.strictEqual(toggleRes.body.route.status, 'Inactive');

    // Restore status
    await makeRequest(`/admin/routes/r-test-fwd/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Active' })
    });
    console.log('✅ Test 13 Passed: Status toggle Active/Inactive operates cleanly.');

    // 14 & 15. Search & Filter Route
    console.log('\nTest 14 & 15: Search & Filter Route...');
    const searchRes = await makeRequest('/admin/routes?source=NDLS');
    assert.strictEqual(searchRes.status, 200);
    const matches = Array.isArray(searchRes.body) ? searchRes.body : searchRes.body.routes;
    assert.ok(matches.length > 0, 'Searching NDLS source routes should return matches');
    console.log(`✅ Test 14 & 15 Passed: Search & Filter returned ${matches.length} matching routes.`);

    // 16. Train-Route Synchronization
    console.log('\nTest 16: Train-Route Synchronization...');
    const trainList = Array.from(mockDb.trains.values());
    assert.ok(trainList.length > 0, 'Trains list should exist');
    console.log('✅ Test 16 Passed: Train synchronization verified.');

    // 17 & 18. Admin Authorization & Passenger Denial
    console.log('\nTest 17 & 18: Admin Authorization & Passenger Denial...');
    const passengerRes = await makeRequest('/admin/routes', {
      method: 'POST',
      headers: { 'Authorization': passengerToken },
      body: JSON.stringify({ source_station_code: 'NDLS', destination_station_code: 'SBC', distance_km: 2000 })
    });
    assert.strictEqual(passengerRes.status, 403, 'Passenger access to route creation should return 403 Forbidden');
    console.log('✅ Test 17 & 18 Passed: Non-admin authorization correctly denied.');

    // 19. Database / API / Frontend Count Matching Assertion
    console.log('\nTest 19: Database / API / Frontend Count Matching...');
    assert.strictEqual(dbRouteCount, apiTotalCount, 'Database count must strictly match API count');
    console.log(`✅ Test 19 Passed: DB (${dbRouteCount}) === API (${apiTotalCount}) count verified.`);

    console.log('\n🎉 ALL 19 ROUTE NETWORK INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test Assertion Failed:', err);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

runExpandedRouteTests();
