const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const express = require('express');
const http = require('http');

function createApp() {
  const app = express();
  app.use(express.json());

  const authRoutes = require('../routes/auth');
  const bookingRoutes = require('../routes/bookings');

  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);
  return app;
}

const app = createApp();
let server;
const PORT = 5122;

function startServer() {
  return new Promise(resolve => {
    server = app.listen(PORT, () => resolve());
  });
}

function stopServer() {
  return new Promise(resolve => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

const makeRequest = (method, reqPath, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
      method,
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

async function runOwnershipTests() {
  console.log('\n======================================================');
  console.log('🧪 PASSENGER BOOKING OWNERSHIP & ISOLATION TEST SUITE');
  console.log('======================================================\n');

  try {
    await startServer();

    // 1. Create Passenger A token
    const tokenA = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-owner-a-101', email: 'pass.a@railway.com', role: 'passenger' })).toString('base64');
    const tokenB = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-owner-b-202', email: 'pass.b@railway.com', role: 'passenger' })).toString('base64');
    const adminToken = 'mock-base64-' + Buffer.from(JSON.stringify({ id: 'usr-admin-shared', email: 'admin@railway.com', role: 'admin' })).toString('base64');

    // 2. Passenger A creates Booking A
    console.log('[TEST 1] Passenger A creates Booking A...');
    const bookResA = await makeRequest('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-15',
      coach_class: '3A',
      passengers: [{ name: 'Passenger A', age: 30, gender: 'Male' }],
      total_fare: 750
    }, tokenA);

    if (bookResA.statusCode !== 201 && bookResA.statusCode !== 200) {
      throw new Error(`Booking creation failed for Passenger A: ${JSON.stringify(bookResA.body)}`);
    }
    const bookingIdA = bookResA.body.booking?.id || bookResA.body.id;
    console.log(`✅ Passenger A created Booking A (ID: ${bookingIdA}, PNR: ${bookResA.body.booking?.pnr_number})`);

    // 3. Passenger A fetches bookings -> Returns ONLY Booking A
    console.log('[TEST 2] Passenger A fetches my-bookings...');
    const getResA = await makeRequest('GET', '/api/bookings', null, tokenA);
    const bookingsA = getResA.body;
    if (!Array.isArray(bookingsA) || !bookingsA.some(b => b.id === bookingIdA)) {
      throw new Error('Passenger A could not retrieve Booking A');
    }
    const hasOnlyA = bookingsA.every(b => b.passenger_id === 'usr-owner-a-101');
    if (!hasOnlyA) {
      throw new Error('Passenger A received bookings belonging to other users/tests!');
    }
    console.log(`✅ PASS: Passenger A received ONLY 1 booking belonging strictly to Passenger A.`);

    // 4. Passenger B fetches bookings -> Does NOT return Booking A
    console.log('[TEST 3] Passenger B fetches my-bookings...');
    const getResB1 = await makeRequest('GET', '/api/bookings', null, tokenB);
    const bookingsB1 = getResB1.body;
    if (Array.isArray(bookingsB1) && bookingsB1.some(b => b.id === bookingIdA)) {
      throw new Error('SECURITY VIOLATION: Passenger B received Passenger A\'s booking!');
    }
    console.log(`✅ PASS: Passenger B cannot see Passenger A\'s booking.`);

    // 5. Passenger B creates Booking B
    console.log('[TEST 4] Passenger B creates Booking B...');
    const bookResB = await makeRequest('POST', '/api/bookings/book', {
      train_id: 't-12952',
      travel_date: '2026-10-16',
      coach_class: '2A',
      passengers: [{ name: 'Passenger B', age: 28, gender: 'Female' }],
      total_fare: 1050
    }, tokenB);
    const bookingIdB = bookResB.body.booking?.id || bookResB.body.id;
    console.log(`✅ Passenger B created Booking B (ID: ${bookingIdB})`);

    // 6. Passenger B fetches my-bookings -> Returns ONLY Booking B
    const getResB2 = await makeRequest('GET', '/api/bookings', null, tokenB);
    const bookingsB2 = getResB2.body;
    if (!Array.isArray(bookingsB2) || !bookingsB2.some(b => b.id === bookingIdB) || bookingsB2.some(b => b.id === bookingIdA)) {
      throw new Error('Passenger B bookings isolation failed');
    }
    console.log(`✅ PASS: Passenger B sees ONLY Booking B.`);

    // 7. Admin fetches bookings -> Can access system bookings
    console.log('[TEST 5] Admin fetches system bookings...');
    const adminRes = await makeRequest('GET', '/api/bookings', null, adminToken);
    if (!Array.isArray(adminRes.body) || adminRes.body.length < 2) {
      throw new Error('Admin booking system access failed');
    }
    console.log(`✅ PASS: Admin successfully retains system-wide booking visibility.`);

    console.log('\n======================================================');
    console.log('🏆 ALL PASSENGER BOOKING ISOLATION TESTS PASSED 100%!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ OWNERSHIP TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await stopServer();
  }
}

runOwnershipTests();
