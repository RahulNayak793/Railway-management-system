const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.PERSISTENCE_TEST = 'true';
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const http = require('http');
const express = require('express');
const { isMockMode, mockDb } = require('../config/supabase');
const { matchRouteSegment, buildOrderedStationNodes } = require('../utils/routeSearch');

function createApp() {
  const app = express();
  app.use(express.json());

  const trainRoutes = require('../routes/trains');
  const aiRoutes = require('../routes/ai');

  app.use('/api/trains', trainRoutes);
  app.use('/api/ai', aiRoutes);
  return app;
}

let app = createApp();
let server;
const PORT = 5061;

function startServer() {
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
        setTimeout(resolve, 500);
      });
    } else {
      resolve();
    }
  });
}

const adminToken = 'Bearer mock-base64-eyJpZCI6InVzci1kZW1vLWFkbWluIiwicm9sZSI6ImFkbWluIiwiZW1haWwiOiJhZG1pbkByYWlsd2F5LmNvbSJ9';

const makeRequest = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': adminToken
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

async function runExhaustiveRouteTests() {
  console.log('\n======================================================');
  console.log('🧪 DYNAMIC EXHAUSTIVE INTERMEDIATE-ROUTE SEARCH SUITE');
  console.log('======================================================\n');

  try {
    await startServer();

    // ----------------------------------------------------
    // TEST 1: DIRECT UNIT TEST ON matchRouteSegment ALGORITHM
    // ----------------------------------------------------
    console.log('[TEST 1] Testing generic matchRouteSegment algorithm across varied route lengths...');

    const testRoutes = [
      {
        train: { id: 't1', train_number: '10001', train_name: 'Two Stop Train', source: 'STA_A', destination: 'STA_B' },
        route: { source_station_code: 'STA_A', destination_station_code: 'STA_B', departure_time: '08:00:00', arrival_time: '10:00:00', stops: [] },
        expectedChain: ['STA_A', 'STA_B']
      },
      {
        train: { id: 't2', train_number: '10002', train_name: 'Three Stop Train', source: 'STA_A', destination: 'STA_C' },
        route: {
          source_station_code: 'STA_A',
          destination_station_code: 'STA_C',
          departure_time: '06:00:00',
          arrival_time: '12:00:00',
          stops: [{ stationCode: 'STA_B', arrTime: '08:45:00', depTime: '08:55:00' }]
        },
        expectedChain: ['STA_A', 'STA_B', 'STA_C']
      },
      {
        train: { id: 't3', train_number: '10003', train_name: 'Multi Corridor Express', source: 'DEL', destination: 'GOA' },
        route: {
          source_station_code: 'DEL',
          destination_station_code: 'GOA',
          departure_time: '05:00:00',
          arrival_time: '23:00:00',
          stops: [
            { stationCode: 'PUNE', arrTime: '10:00:00', depTime: '10:10:00' },
            { stationCode: 'SURAT', arrTime: '14:00:00', depTime: '14:15:00' },
            { stationCode: 'MUM', arrTime: '18:00:00', depTime: '18:20:00' }
          ]
        },
        expectedChain: ['DEL', 'PUNE', 'SURAT', 'MUM', 'GOA']
      }
    ];

    let totalPairsEvaluated = 0;
    let totalValidPassed = 0;
    let totalInvalidBlocked = 0;

    for (const testCase of testRoutes) {
      const chain = testCase.expectedChain;
      console.log(`\n  Evaluating train "${testCase.train.train_name}" with route chain: ${chain.join(' → ')}`);

      // Test ALL possible pair combinations
      for (let i = 0; i < chain.length; i++) {
        for (let j = 0; j < chain.length; j++) {
          totalPairsEvaluated++;
          const src = chain[i];
          const dest = chain[j];

          const res = matchRouteSegment(testCase.train, testCase.route, src, dest);

          if (i < j) {
            // Forward pair -> MUST match
            if (!res || !res.matched) {
              throw new Error(`Expected forward match for ${src} → ${dest} on ${testCase.train.train_name}, but got NULL!`);
            }
            totalValidPassed++;
          } else {
            // Reverse pair or Same station -> MUST NOT match
            if (res) {
              throw new Error(`Expected NO match for invalid pair ${src} → ${dest} on ${testCase.train.train_name}, but got match!`);
            }
            totalInvalidBlocked++;
          }
        }
      }
    }

    console.log(`\n  ✅ ${totalPairsEvaluated} total station pairs evaluated across ${testRoutes.length} route configurations.`);
    console.log(`  ✅ ${totalValidPassed} valid forward pairs MATCHED.`);
    console.log(`  ✅ ${totalInvalidBlocked} invalid/reverse/same-station pairs BLOCKED.`);

    // ----------------------------------------------------
    // TEST 2: ADMIN DYNAMIC STOP MODIFICATION (ADD / DELETE STOP)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing Admin dynamic stop addition & removal...');

    // Create train via API: A -> B -> C
    const newTrainPayload = {
      trainNo: '77001',
      trainName: 'Dynamic Stop Test Express',
      from: 'STATION_A',
      to: 'STATION_C',
      depTime: '07:00 AM',
      arrTime: '01:00 PM',
      stops: [
        { stationCode: 'STATION_B', arrTime: '09:50 AM', depTime: '10:00 AM' }
      ]
    };

    const createRes = await makeRequest('POST', '/api/trains', newTrainPayload);
    if (createRes.statusCode !== 201) {
      throw new Error(`Failed to create train: ${JSON.stringify(createRes.body)}`);
    }
    const createdTrainId = createRes.body.train.id;
    console.log(`  Created Train ID: ${createdTrainId}`);

    // Verify initial searches work: A->B, B->C, A->C
    let searchB_C = await makeRequest('GET', '/api/trains?source=STATION_B&destination=STATION_C');
    if (!searchB_C.body.some(t => t.id === createdTrainId)) {
      throw new Error('Initial stop search STATION_B → STATION_C failed');
    }
    console.log('  ✅ Initial intermediate stop search STATION_B → STATION_C verified.');

    // Update train by Admin: add new stop STATION_X between B and C (STATION_A -> STATION_B -> STATION_X -> STATION_C)
    const updatePayload = {
      stops: [
        { stationCode: 'STATION_B', arrTime: '09:50 AM', depTime: '10:00 AM' },
        { stationCode: 'STATION_X', arrTime: '11:15 AM', depTime: '11:25 AM' }
      ]
    };

    const updateRes = await makeRequest('PUT', `/api/trains/${createdTrainId}`, updatePayload);
    if (updateRes.statusCode !== 200) {
      throw new Error(`Failed to update train stops: ${JSON.stringify(updateRes.body)}`);
    }

    // Verify new stop search B -> X works immediately
    let searchB_X = await makeRequest('GET', '/api/trains?source=STATION_B&destination=STATION_X');
    const matchedTrainBX = searchB_X.body.find(t => t.id === createdTrainId);
    if (!matchedTrainBX) {
      throw new Error('New Admin stop STATION_X was NOT dynamically searchable!');
    }
    if (matchedTrainBX.route.departure_time !== '10:00:00' || matchedTrainBX.route.arrival_time !== '11:15:00') {
      throw new Error(`Segment timings incorrect for B → X. Got Dep: ${matchedTrainBX.route.departure_time}, Arr: ${matchedTrainBX.route.arrival_time}`);
    }
    console.log(`  ✅ New Admin stop STATION_X dynamically searchable! Segment Dep: ${matchedTrainBX.route.departure_time}, Arr: ${matchedTrainBX.route.arrival_time}`);

    // Update train by Admin: remove STATION_X
    const removeStopPayload = {
      stops: [
        { stationCode: 'STATION_B', arrTime: '09:50 AM', depTime: '10:00 AM' }
      ]
    };
    await makeRequest('PUT', `/api/trains/${createdTrainId}`, removeStopPayload);

    // Verify search B -> X returns empty array
    let searchB_X_after = await makeRequest('GET', '/api/trains?source=STATION_B&destination=STATION_X');
    if (searchB_X_after.body.some(t => t.id === createdTrainId)) {
      throw new Error('Removed stop STATION_X was still returned in search!');
    }
    console.log('  ✅ Removed stop STATION_X automatically disappeared from search results.');

    // ----------------------------------------------------
    // TEST 3: STATION CODE & NAME NORMALIZATION / EDGE CASES
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing station casing, spacing, and normalization edge cases...');

    // Lowercase search: station_a -> station_c
    let searchLower = await makeRequest('GET', '/api/trains?source=station_a&destination=station_c');
    if (!searchLower.body.some(t => t.id === createdTrainId)) {
      throw new Error('Lowercase station search failed');
    }
    console.log('  ✅ Lowercase station search passed.');

    // Spaces search: "  STATION_A  " -> " STATION_C "
    let searchSpaces = await makeRequest('GET', '/api/trains?source=%20STATION_A%20&destination=%20STATION_C%20');
    if (!searchSpaces.body.some(t => t.id === createdTrainId)) {
      throw new Error('Trimming spaces search failed');
    }
    console.log('  ✅ Extra spaces station search passed.');

    // Same station search: STATION_A -> STATION_A -> Must return []
    let searchSame = await makeRequest('GET', '/api/trains?source=STATION_A&destination=STATION_A');
    if (searchSame.body.length !== 0) {
      throw new Error('Same source and destination search should return empty array!');
    }
    console.log('  ✅ Same-station search correctly returns empty array.');

    // Cleanup test train
    await makeRequest('DELETE', `/api/trains/${createdTrainId}`);

    console.log('\n======================================================');
    console.log('🏆 EXHAUSTIVE ROUTE SEARCH TESTS PASSED 100%!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ ROUTE SEARCH TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runExhaustiveRouteTests();
