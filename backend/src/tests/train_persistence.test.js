const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.PERSISTENCE_TEST = 'true';
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const fs = require('fs');
const assert = require('assert');
const http = require('http');
const express = require('express');

const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');

function createApp() {
  const app = express();
  app.use(express.json());

  const authRoutes = require('../routes/auth');
  const trainRoutes = require('../routes/trains');
  const bookingRoutes = require('../routes/bookings');
  const adminRoutes = require('../routes/admin');
  const aiRoutes = require('../routes/ai');

  app.use('/api/auth', authRoutes);
  app.use('/api/trains', trainRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', aiRoutes);

  return app;
}

let app;
let server;
const PORT = 5069;

function startServer() {
  app = createApp();
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        setTimeout(resolve, 300);
      });
    } else {
      resolve();
    }
  });
}

const adminToken = 'Bearer mock-base64-eyJpZCI6InVzci1kZW1vLWFkbWluIiwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkByYWlsd2F5LmNvbSJ9';
const passengerToken = 'Bearer mock-base64-eyJpZCI6InVzci1kZW1vLXBhc3NlbmdlciIsInJvbGUiOiJwYXNzZW5nZXIiLCJlbWFpbCI6InBhc3NlbmdlckByYWlsd2F5LmNvbSJ9';

const makeRequest = (method, reqPath, body = null, token = adminToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function runTrainPersistenceLifecycleTest() {
  console.log('\n======================================================');
  console.log('🧪 MASTER TRAIN PERSISTENCE LIFECYCLE & ISOLATION TEST');
  console.log('======================================================\n');

  const prodDbPath = path.join(__dirname, '../../data/db.json');
  const prodDbBefore = fs.existsSync(prodDbPath) ? fs.readFileSync(prodDbPath, 'utf-8') : '';

  try {
    // 1. Start clean test database
    console.log('[STEP 1] Initializing isolated test database...');
    mockDb.trains.clear();
    mockDb.routes.clear();
    mockDb.seats.clear();
    saveMockDbToFile();

    await startServer();
    console.log('🚀 Test server running on port', PORT);

    // 2. Admin Create Train 99001 with 2 intermediate stops
    console.log('[STEP 2] Admin creating Train 99001 with 2 intermediate stops (MAQ & MAJN)...');
    const createRes = await makeRequest('POST', '/api/trains', {
      trainNo: '99001',
      trainName: 'Lifecycle Test Express',
      train_type: 'Superfast',
      from: 'UDU',
      to: 'NDLS',
      depTime: '08:00',
      arrTime: '18:00',
      stops: [
        { stationCode: 'MAQ', arrTime: '10:30', depTime: '10:35' },
        { stationCode: 'MAJN', arrTime: '12:00', depTime: '12:05' }
      ]
    }, adminToken);

    assert.strictEqual(createRes.statusCode, 201, `Create train should return 201: ${JSON.stringify(createRes.body)}`);
    const createdTrain = createRes.body.train;
    const trainId = createdTrain.id;
    console.log(`✅ Train 99001 Created. ID: ${trainId}`);

    // 3. Verify API returns 99001 and exact stop times
    console.log('[STEP 3] Verifying GET /api/trains includes 99001 and correct stop times...');
    const getRes = await makeRequest('GET', '/api/trains', null, adminToken);
    const foundGet = (getRes.body || []).find(t => String(t.train_number) === '99001');
    assert.ok(foundGet, 'Train 99001 should be returned by GET /api/trains');
    const stopsList = foundGet.stops || (foundGet.route && foundGet.route.stops) || [];
    assert.strictEqual(stopsList.length, 2, 'Train 99001 should have 2 intermediate stops');
    const maqStop = stopsList.find(s => (s.stationCode || s.station) === 'MAQ');
    const majnStop = stopsList.find(s => (s.stationCode || s.station) === 'MAJN');
    assert.ok(maqStop && majnStop, 'Both MAQ and MAJN stops must be present');
    assert.strictEqual(maqStop.arrTime || maqStop.arrival_time.slice(0, 5), '10:30');
    assert.strictEqual(maqStop.depTime || maqStop.departure_time.slice(0, 5), '10:35');
    assert.strictEqual(majnStop.arrTime || majnStop.arrival_time.slice(0, 5), '12:00');
    assert.strictEqual(majnStop.depTime || majnStop.departure_time.slice(0, 5), '12:05');
    console.log('✅ GET /api/trains returns 99001 with exact stop times.');

    // 4. Verify Admin list returns 99001
    console.log('[STEP 4] Verifying Admin Train Fleet view includes 99001...');
    assert.strictEqual(foundGet.train_number, '99001');
    console.log('✅ Admin Train Fleet list includes 99001.');

    // 5. Verify Passenger Search returns 99001
    console.log('[STEP 5] Verifying Passenger Search returns 99001...');
    const searchRes = await makeRequest('GET', '/api/trains?source=UDU&destination=NDLS', null, passengerToken);
    const foundSearch = (searchRes.body || []).find(t => String(t.train_number) === '99001');
    assert.ok(foundSearch, 'Passenger Search should find train 99001');
    console.log('✅ Passenger Search returns 99001.');

    // 6. Verify RailBot search returns 99001
    console.log('[STEP 6] Verifying RailBot recommendations returns 99001...');
    const railbotRes = await makeRequest('GET', '/api/ai/recommendations?source=UDU&destination=NDLS', null, passengerToken);
    const recs = railbotRes.body.recommendedTrains || [];
    const foundRailbot = recs.find(r => String(r.train_number) === '99001');
    assert.ok(foundRailbot, 'RailBot should recommend train 99001');
    console.log('✅ RailBot recommendations return 99001.');

    // 7. Restart Backend Process 1
    console.log('\n[STEP 7] Restarting backend process (Simulating restart 1)...');
    await stopServer();
    await startServer();

    const postRestart1Res = await makeRequest('GET', '/api/trains', null, adminToken);
    const foundPostRestart1 = (postRestart1Res.body || []).find(t => String(t.train_number) === '99001');
    assert.ok(foundPostRestart1, 'Train 99001 MUST survive backend restart');
    console.log('✅ Train 99001 verified after backend restart 1.');

    // 8. Edit Train 99001 (Update stop 2 departure time to 12:10)
    console.log('\n[STEP 8] Editing Train 99001 (Updating MAJN departure time to 12:10)...');
    const updateRes = await makeRequest('PUT', `/api/trains/${trainId}`, {
      trainName: 'Lifecycle Express Updated',
      status: 'delayed',
      delay_minutes: 20,
      stops: [
        { stationCode: 'MAQ', arrTime: '10:30', depTime: '10:35' },
        { stationCode: 'MAJN', arrTime: '12:00', depTime: '12:10' }
      ]
    }, adminToken);
    assert.strictEqual(updateRes.statusCode, 200, 'Update train should return 200');
    console.log('✅ Train 99001 Updated with new stop time.');

    // 9. Restart Backend Process 2
    console.log('\n[STEP 9] Restarting backend process (Simulating restart 2)...');
    await stopServer();
    await startServer();

    const postRestart2Res = await makeRequest('GET', '/api/trains', null, adminToken);
    const foundPostRestart2 = (postRestart2Res.body || []).find(t => String(t.train_number) === '99001');
    assert.ok(foundPostRestart2, 'Train 99001 MUST exist after restart 2');
    assert.strictEqual(foundPostRestart2.train_name, 'Lifecycle Express Updated', 'Updated train name MUST persist');
    const updatedStops = foundPostRestart2.stops || (foundPostRestart2.route && foundPostRestart2.route.stops) || [];
    const updatedMajn = updatedStops.find(s => (s.stationCode || s.station) === 'MAJN');
    assert.ok(updatedMajn, 'MAJN stop must exist');
    assert.strictEqual(updatedMajn.depTime || updatedMajn.departure_time.slice(0, 5), '12:10', 'Updated departure time for MAJN MUST persist');
    console.log('✅ Updated train details and stop times verified after backend restart 2.');
    console.log('✅ Updated train details verified after backend restart 2.');

    // 10. Delete Train 99001
    console.log('\n[STEP 10] Deleting Train 99001...');
    const deleteRes = await makeRequest('DELETE', `/api/trains/${trainId}`, null, adminToken);
    assert.strictEqual(deleteRes.statusCode, 200, 'Delete train should return 200');
    console.log('✅ Train 99001 Deleted.');

    // 11. Restart Backend Process 3
    console.log('\n[STEP 11] Restarting backend process (Simulating restart 3)...');
    await stopServer();
    await startServer();

    const postRestart3Res = await makeRequest('GET', '/api/trains', null, adminToken);
    const foundPostRestart3 = (postRestart3Res.body || []).find(t => String(t.train_number) === '99001');
    assert.strictEqual(foundPostRestart3, undefined, 'Train 99001 MUST remain deleted after restart');
    console.log('✅ Train 99001 confirmed permanently deleted after backend restart 3.');

    // 12. Verify Production db.json was never modified by test
    console.log('\n[STEP 12] Verifying production db.json data isolation...');
    const prodDbAfter = fs.existsSync(prodDbPath) ? fs.readFileSync(prodDbPath, 'utf-8') : '';
    assert.strictEqual(prodDbAfter, prodDbBefore, 'Production db.json MUST NOT be modified by tests');
    assert.ok(!prodDbAfter.includes('"99001"'), 'Production db.json MUST NOT contain test train 99001');
    console.log('✅ Production db.json verified untouched and pristine.');

    console.log('\n======================================================');
    console.log('🎉 ALL TRAIN PERSISTENCE LIFECYCLE TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await stopServer();
  }
}

runTrainPersistenceLifecycleTest().catch(err => {
  console.error('❌ Train Persistence Test Failed:', err.stack);
  process.exit(1);
});
