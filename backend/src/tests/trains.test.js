const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const http = require('http');
const express = require('express');
const { isMockMode, mockDb } = require('../config/supabase');

// Mock a minimal setup of index.js to run test server
const app = reportAppSetup();

function reportAppSetup() {
  const app = express();
  app.use(express.json());
  
  const trainsRouter = require('../routes/trains');
  app.use('/api/trains', trainsRouter);
  return app;
}

let server;
const PORT = 5056;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

// Helper to make HTTP requests
const makeRequest = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-base64-eyJpZCI6InVzci1hZG1pbiIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AcmFpbHdheS5jb20ifQ=='
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  // Clear persistent maps to ensure isolation
  mockDb.trains.clear();
  mockDb.routes.clear();
  mockDb.seats.clear();
  mockDb.seat_allocations.clear();

  await startServer();
  console.log('\n--- 🧪 RUNNING RAILWAY MANAGEMENT SYSTEM TRAIN SCHEDULING TESTS ---');

  try {
    // Test 1: Add new train with camelCase properties (matching StaffSchedules format)
    console.log('\nTest 1: Create Train (Staff/Admin camelCase format)...');
    const newTrainPayload = {
      trainNo: '998811',
      trainName: 'Test Duronto Express',
      from: 'NDLS',
      to: 'CSMT',
      depTime: '04:15 PM',
      arrTime: '09:45 AM',
      stops: [
        { stationCode: 'KOTA', depTime: '08:30 PM', arrTime: '08:20 PM' },
        { stationCode: 'BPL', depTime: '02:10 AM', arrTime: '02:00 AM' }
      ]
    };

    const createRes = await makeRequest('POST', '/api/trains', newTrainPayload);
    if (createRes.statusCode !== 201) {
      throw new Error(`Failed to create train: ${JSON.stringify(createRes.body)}`);
    }
    const createdTrain = createRes.body.train;
    console.log(`✅ Created Train ID: ${createdTrain.id}, Number: ${createdTrain.train_number}`);

    // Test 2: Search for train directly via Source/Destination
    console.log('\nTest 2: Direct Search (NDLS -> CSMT)...');
    const directSearchRes = await makeRequest('GET', `/api/trains?source=NDLS&destination=CSMT`);
    const directMatches = directSearchRes.body;
    const durontoDirect = directMatches.find(t => t.train_number === '998811');
    if (!durontoDirect) {
      throw new Error('Created train did not show up in direct search results');
    }
    console.log('✅ Train found in direct search. Route:', durontoDirect.route);

    // Test 3: Search for train via intermediate stops (NDLS -> KOTA)
    console.log('\nTest 3: Intermediate Search (NDLS -> KOTA)...');
    const interSearchRes1 = await makeRequest('GET', `/api/trains?source=NDLS&destination=KOTA`);
    const matches1 = interSearchRes1.body;
    const match1 = matches1.find(t => t.train_number === '998811');
    if (!match1) {
      throw new Error('Train did not show up when searching intermediate leg NDLS -> KOTA');
    }
    console.log(`✅ Train found for intermediate leg. Dep Time: ${match1.route.departure_time}, Arr Time: ${match1.route.arrival_time}`);

    // Test 4: Search for train via intermediate stops (KOTA -> BPL)
    console.log('\nTest 4: Intermediate Search (KOTA -> BPL)...');
    const interSearchRes2 = await makeRequest('GET', `/api/trains?source=KOTA&destination=BPL`);
    const matches2 = interSearchRes2.body;
    const match2 = matches2.find(t => t.train_number === '998811');
    if (!match2) {
      throw new Error('Train did not show up when searching intermediate leg KOTA -> BPL');
    }
    console.log(`✅ Train found for intermediate leg. Dep Time: ${match2.route.departure_time}, Arr Time: ${match2.route.arrival_time}`);

    // Test 5: Update train status and detail
    console.log('\nTest 5: Update Train status and details...');
    const updatePayload = {
      trainName: 'Test Duronto Express Premium',
      status: 'delayed',
      delay_minutes: 30,
      stops: [
        { stationCode: 'KOTA', depTime: '09:00 PM', arrTime: '08:50 PM' },
        { stationCode: 'BPL', depTime: '02:40 AM', arrTime: '02:30 AM' }
      ]
    };
    const updateRes = await makeRequest('PUT', `/api/trains/${createdTrain.id}`, updatePayload);
    if (updateRes.statusCode !== 200) {
      throw new Error(`Failed to update train: ${JSON.stringify(updateRes.body)}`);
    }
    console.log(`✅ Updated Train. Name: ${updateRes.body.train.train_name}, Status: ${updateRes.body.train.status}, Delay: ${updateRes.body.train.delay_minutes}m`);

    // Test 6: Verify intermediate search times updated
    console.log('\nTest 6: Verify Updated intermediate leg times (NDLS -> KOTA)...');
    const verifySearchRes = await makeRequest('GET', `/api/trains?source=NDLS&destination=KOTA`);
    const verifyMatches = verifySearchRes.body;
    const verifyMatch = verifyMatches.find(t => t.train_number === '998811');
    if (verifyMatch.route.arrival_time !== '20:50:00') {
      throw new Error(`Arrival time at KOTA was not updated. Expected 20:50:00, got ${verifyMatch.route.arrival_time}`);
    }
    console.log(`✅ Train found with updated intermediate halt arrival: ${verifyMatch.route.arrival_time}`);

    // Test 7: Delete Train
    console.log('\nTest 7: Delete Train...');
    const deleteRes = await makeRequest('DELETE', `/api/trains/${createdTrain.id}`);
    if (deleteRes.statusCode !== 200) {
      throw new Error(`Failed to delete train: ${JSON.stringify(deleteRes.body)}`);
    }
    console.log('✅ Train deleted successfully.');

    console.log('\n🎉 ALL TRAIN SCHEDULING TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runTests();
