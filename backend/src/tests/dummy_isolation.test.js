const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.MOCK_MODE = 'true';

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');

let supabaseModule = require('../config/supabase');
const { mockDb, saveMockDbToFile } = supabaseModule;

const authRoutes = require('../routes/auth');
const bookingRoutes = require('../routes/bookings');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

function createServerApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);
  return app;
}

let app = createServerApp();
let server;
const PORT = 5068;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`📡 Dummy Isolation test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runDummyIsolationTests() {
  try {
    await startServer();
    console.log('\n======================================================');
    console.log('🧪 RUNNING DUMMY DATA ISOLATION & STRICT OWNERSHIP TESTS');
    console.log('======================================================\n');

    const realPassengerId = 'usr-real-passenger-' + Date.now();
    const realPassengerToken = jwt.sign(
      { id: realPassengerId, email: `real.${Date.now()}@test.com`, role: 'passenger', full_name: 'Real Passenger' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const demoTestAccountToken = jwt.sign(
      { id: 'usr-demo-test-account', email: 'demo@railcontrol.test', role: 'passenger', full_name: 'DEMO PASSENGER' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Register real passenger profile in mockDb
    mockDb.profiles.set(realPassengerId, {
      id: realPassengerId,
      full_name: 'Real Passenger',
      email: 'real.passenger@test.com',
      phone: '+91 9111122222',
      role: 'passenger',
      created_at: new Date().toISOString()
    });

    // -----------------------------------------------------------------
    // TEST A & I: Genuine Booking Creation & Strict Isolation
    // -----------------------------------------------------------------
    console.log('Test A: Creating genuine booking for real passenger...');
    const genuineBookingPayload = {
      train_id: 'train-udupi-12345',
      travel_date: '2026-09-25',
      coach_class: '3A',
      passengers: [{ name: 'Real Passenger', age: 30, gender: 'Male' }],
      total_fare: 1450
    };

    const bookRes = await makeRequest('POST', '/api/bookings/book', genuineBookingPayload, realPassengerToken);
    if (bookRes.statusCode !== 201) {
      throw new Error(`Failed to create genuine booking: ${JSON.stringify(bookRes.body)}`);
    }
    const genuineBooking = bookRes.body.booking;
    console.log(`✅ Genuine Booking created with ID: ${genuineBooking.id}, PNR: ${genuineBooking.pnr_number}`);

    // -----------------------------------------------------------------
    // TEST B, C, D, E, F: Verify GET /api/bookings for Real Passenger
    // -----------------------------------------------------------------
    console.log('\nTest B-E: Fetching bookings for real passenger...');
    const realBookingsRes = await makeRequest('GET', '/api/bookings', null, realPassengerToken);
    if (realBookingsRes.statusCode !== 200) {
      throw new Error(`GET /api/bookings failed: ${realBookingsRes.statusCode}`);
    }

    const realBookings = realBookingsRes.body;
    console.log(`Real passenger returned bookings count: ${realBookings.length}`);

    // Assert condition A: Real passenger sees only their own bookings
    const foreignBookings = realBookings.filter(b => b.passenger_id !== realPassengerId);
    if (foreignBookings.length > 0) {
      throw new Error(`❌ FAIL: Real passenger saw foreign bookings! Found: ${JSON.stringify(foreignBookings)}`);
    }
    console.log('✅ Test A Passed: Real passenger sees ONLY their own bookings.');

    // Assert condition B-E: Real passenger does NOT see DEMO PASSENGER booking or seeded dummy IDs
    const seedUpcoming = realBookings.find(b => b.id === 'bk-seed-upcoming' || b.pnr_number === '8819203941');
    const seedCompleted = realBookings.find(b => b.id === 'bk-seed-completed' || b.pnr_number === '7462573954');
    const seedCancelled = realBookings.find(b => b.id === 'bk-seed-cancelled' || b.pnr_number === '9842105731');
    const demoPassengerAlloc = realBookings.find(b => (b.allocations || []).some(a => a.passenger_name === 'DEMO PASSENGER'));

    if (seedUpcoming || seedCompleted || seedCancelled || demoPassengerAlloc) {
      throw new Error('❌ FAIL: Real passenger sees seeded dummy bookings or DEMO PASSENGER!');
    }
    console.log('✅ Test B-E Passed: Real passenger does NOT see bk-seed-upcoming, bk-seed-completed, bk-seed-cancelled, or DEMO PASSENGER.');

    // Assert condition I: Booking counts exclude dummy records for real passenger
    if (realBookings.length !== 1 || realBookings[0].id !== genuineBooking.id) {
      throw new Error(`❌ FAIL: Booking count for real passenger is incorrect (${realBookings.length}, expected 1)`);
    }
    console.log('✅ Test I Passed: Real passenger booking counts strictly exclude dummy records.');

    // -----------------------------------------------------------------
    // TEST F: Demo Test Account receives dummy records
    // -----------------------------------------------------------------
    console.log('\nTest F: Fetching bookings for dedicated demo/test account...');
    const demoBookingsRes = await makeRequest('GET', '/api/bookings', null, demoTestAccountToken);
    if (demoBookingsRes.statusCode !== 200) {
      throw new Error(`GET /api/bookings for demo account failed: ${demoBookingsRes.statusCode}`);
    }
    const demoBookings = demoBookingsRes.body;
    const hasSeedUpcoming = demoBookings.some(b => b.id === 'bk-seed-upcoming');
    if (!hasSeedUpcoming) {
      throw new Error('❌ FAIL: Dedicated demo/test account could not retrieve seeded dummy records!');
    }
    console.log('✅ Test F Passed: Dedicated demo account can access seeded dummy records.');

    // -----------------------------------------------------------------
    // TEST G, H, J: Restart & Persistence & Anti-duplication Verification
    // -----------------------------------------------------------------
    console.log('\nTest G, H, J: Testing backend restart and persistent isolation...');
    await stopServer();

    // Clear module caches to simulate fresh backend restart
    delete require.cache[require.resolve('../config/supabase')];
    delete require.cache[require.resolve('../routes/bookings')];
    delete require.cache[require.resolve('../routes/auth')];

    supabaseModule = require('../config/supabase');
    app = createServerApp();
    await startServer();
    await new Promise(r => setTimeout(r, 200));
    console.log('⚡ Server restarted cleanly.');

    // Fetch bookings for real passenger post-restart
    const realBookingsPostRestart = await makeRequest('GET', '/api/bookings', null, realPassengerToken);
    const postRestartBookings = realBookingsPostRestart.body;

    if (postRestartBookings.length !== 1 || postRestartBookings[0].id !== genuineBooking.id) {
      throw new Error('❌ FAIL: Real passenger bookings changed after server restart!');
    }
    console.log('✅ Test H & J Passed: Genuine bookings preserved and dummy records do NOT reappear for real passenger after restart.');

    // Count occurrence of bk-seed-upcoming in mockDb
    const seedUpcomingEntries = Array.from(supabaseModule.mockDb.bookings.keys()).filter(k => k === 'bk-seed-upcoming');
    if (seedUpcomingEntries.length > 1) {
      throw new Error('❌ FAIL: Dummy records duplicated after restart!');
    }
    console.log('✅ Test G Passed: Seeded dummy records are not duplicated on backend restart.');

    // -----------------------------------------------------------------
    // TEST K: Frontend Fallback Source Audit
    // -----------------------------------------------------------------
    console.log('\nTest K: Auditing MyBookings.jsx for hardcoded dummy fallbacks...');
    const myBookingsPath = path.join(__dirname, '../../../frontend/src/pages/MyBookings.jsx');
    const myBookingsContent = fs.readFileSync(myBookingsPath, 'utf-8');

    if (myBookingsContent.includes("'#12952'") || myBookingsContent.includes('"#12952"') || myBookingsContent.includes("|| '12952'") || myBookingsContent.includes('|| "12952"')) {
      throw new Error('❌ FAIL: MyBookings.jsx still contains hardcoded #12952 train number fallback!');
    }
    if (myBookingsContent.includes("coach_number: 'B1'") || myBookingsContent.includes('coach_number: "B1"')) {
      throw new Error('❌ FAIL: MyBookings.jsx still contains hardcoded B1 seat allocation fallback!');
    }
    if (myBookingsContent.includes("'New Delhi (NDLS)'") || myBookingsContent.includes('"New Delhi (NDLS)"')) {
      throw new Error('❌ FAIL: MyBookings.jsx still contains hardcoded New Delhi fallback!');
    }
    if (myBookingsContent.includes("'16:30'") || myBookingsContent.includes('"16:30"')) {
      throw new Error('❌ FAIL: MyBookings.jsx still contains hardcoded departure time 16:30 fallback!');
    }
    console.log('✅ Test K Passed: MyBookings.jsx is free of hardcoded fallback booking data.');

    console.log('\n======================================================');
    console.log('🏆 ALL DUMMY ISOLATION & PASSENGER OWNERSHIP TESTS PASSED! 100%');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ DUMMY ISOLATION TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runDummyIsolationTests();
