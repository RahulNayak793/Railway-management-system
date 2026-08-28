const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.PERSISTENCE_TEST = 'true';
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const http = require('http');
const express = require('express');

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
const PORT = 5062;

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

async function runAdminSearchE2ETests() {
  console.log('\n======================================================');
  console.log('🧪 ADMIN TRAIN CREATION → PASSENGER SEARCH E2E SUITE');
  console.log('======================================================\n');

  try {
    await startServer();

    // ----------------------------------------------------
    // STEP 1: ADMIN CREATES TRAIN 23415 (UDUPI EXPRESS)
    // ----------------------------------------------------
    console.log('[STEP 1] Admin creating Train 23415 (Udupi Express)...');

    const udupiTrainPayload = {
      trainNo: '23415',
      trainName: 'Udupi Express',
      from: 'UDU',
      to: 'MMCT',
      depTime: '12:10',
      arrTime: '19:00',
      frequency: 'Daily',
      baseFare: 450,
      stops: []
    };

    const createRes = await makeRequest('POST', '/api/trains', udupiTrainPayload);
    if (createRes.statusCode !== 201) {
      throw new Error(`Failed to create train: ${JSON.stringify(createRes.body)}`);
    }

    const createdTrainId = createRes.body.train.id;
    console.log(`  ✅ Train 23415 created successfully. ID: ${createdTrainId}`);

    // ----------------------------------------------------
    // STEP 2: SIMULATE PROCESS RESTART PERSISTENCE
    // ----------------------------------------------------
    console.log('\n[STEP 2] Restarting backend server to verify disk persistence...');
    await stopServer();

    // Re-require modules to simulate fresh backend boot
    delete require.cache[require.resolve('../config/supabase')];
    delete require.cache[require.resolve('../routes/trains')];
    delete require.cache[require.resolve('../routes/ai')];

    app = createApp();
    await startServer();
    console.log('  ✅ Backend server re-booted and database loaded from db.json.');

    // ----------------------------------------------------
    // STEP 3: PASSENGER SEARCH UDU → MMCT ON 2026-08-27
    // ----------------------------------------------------
    console.log('\n[STEP 3] Passenger searching UDU → MMCT on 2026-08-27...');

    const searchRes = await makeRequest('GET', '/api/trains?source=UDU&destination=MMCT&date=2026-08-27');
    if (searchRes.statusCode !== 200) {
      throw new Error(`Passenger search failed with status ${searchRes.statusCode}`);
    }

    const trainsFound = searchRes.body || [];
    const matchedUdupiTrain = trainsFound.find(t => String(t.train_number) === '23415');

    if (!matchedUdupiTrain) {
      throw new Error(`Passenger search returned 0 matches for Train 23415! Got: ${JSON.stringify(trainsFound)}`);
    }

    console.log(`  🎉 SUCCESS: Train 23415 "${matchedUdupiTrain.train_name}" found in Passenger Search!`);
    console.log(`     Route Segment: ${matchedUdupiTrain.source} → ${matchedUdupiTrain.destination}`);
    console.log(`     Departure: ${matchedUdupiTrain.route.departure_time}, Arrival: ${matchedUdupiTrain.route.arrival_time}`);

    // ----------------------------------------------------
    // STEP 4: FULL STATION NAME SEARCH (Udupi → Mumbai Central)
    // ----------------------------------------------------
    console.log('\n[STEP 4] Passenger searching full station names (Udupi → Mumbai Central)...');
    const fullSearchRes = await makeRequest('GET', '/api/trains?source=Udupi&destination=Mumbai%20Central&date=2026-08-27');
    const matchedFullTrain = (fullSearchRes.body || []).find(t => String(t.train_number) === '23415');

    if (!matchedFullTrain) {
      throw new Error('Full station name search (Udupi → Mumbai Central) failed to find Train 23415!');
    }
    console.log('  ✅ Station code/name alias resolution verified (Udupi → Mumbai Central matched Train 23415).');

    // ----------------------------------------------------
    // STEP 5: REVERSE SEARCH MATCHING PREVENTION (MMCT → UDU)
    // ----------------------------------------------------
    console.log('\n[STEP 5] Verifying reverse direction search (MMCT → UDU)...');
    const reverseSearchRes = await makeRequest('GET', '/api/trains?source=MMCT&destination=UDU&date=2026-08-27');
    const reverseMatched = (reverseSearchRes.body || []).find(t => String(t.train_number) === '23415');

    if (reverseMatched) {
      throw new Error('Reverse search MMCT → UDU incorrectly returned Train 23415!');
    }
    console.log('  ✅ Reverse direction search MMCT → UDU correctly returned 0 matches for Train 23415.');

    // ----------------------------------------------------
    // STEP 6: SAME STATION QUERY PREVENTION (UDU → UDU)
    // ----------------------------------------------------
    console.log('\n[STEP 6] Verifying same-station query (UDU → UDU)...');
    const sameSearchRes = await makeRequest('GET', '/api/trains?source=UDU&destination=UDU&date=2026-08-27');
    const sameMatched = (sameSearchRes.body || []).find(t => String(t.train_number) === '23415');

    if (sameMatched || sameSearchRes.body.length > 0) {
      throw new Error('Same-station search UDU → UDU returned invalid matches!');
    }
    console.log('  ✅ Same-station search UDU → UDU correctly returned 0 matches.');

    // Cleanup test train
    await makeRequest('DELETE', `/api/trains/${createdTrainId}`);

    console.log('\n======================================================');
    console.log('🏆 E2E ADMIN TRAIN CREATION & PASSENGER SEARCH TEST PASSED 100%!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ E2E SEARCH TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runAdminSearchE2ETests();
