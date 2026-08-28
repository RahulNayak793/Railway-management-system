const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.PERSISTENCE_TEST = 'true';
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

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

  app.use('/api/auth', authRoutes);
  app.use('/api/trains', trainRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);

  return app;
}

let app = createApp();
let server;
const PORT = 5059;

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
const passengerToken = 'Bearer mock-base64-eyJpZCI6InVzci1kZW1vLXBhc3NlbmdlciIsInJvbGUiOiJwYXNzZW5nZXIiLCJlbWFpbCI6InBhc3NlbmdlckByYWlsd2F5LmNvbSJ9';

const makeRequest = (method, path, body = null, token = adminToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
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

async function runPersistenceTests() {
  console.log('\n======================================================');
  console.log('🧪 FORENSIC PERSISTENCE & BACKEND RESTART SUITE');
  console.log('======================================================\n');

  try {
    await startServer();
    console.log('🚀 Test server started on port', PORT);

    // Clean up pre-existing test train 90001 if left from prior run
    for (const [tId, tr] of mockDb.trains.entries()) {
      if (tr && (tr.train_number === '90001' || tr.trainNo === '90001')) {
        mockDb.trains.delete(tId);
      }
    }

    console.log('\n[STEP 1] Admin creating Train 90001 (Persistence Test Express)...');
    const trainPayload = {
      trainNo: '90001',
      trainName: 'Persistence Test Express',
      from: 'NDLS',
      to: 'MMCT',
      depTime: '10:00 AM',
      arrTime: '06:00 PM',
      stops: [
        { stationCode: 'KOTA', depTime: '02:00 PM', arrTime: '01:50 PM' }
      ]
    };

    const createTrainRes = await makeRequest('POST', '/api/trains', trainPayload, adminToken);
    if (createTrainRes.statusCode !== 201) {
      throw new Error(`Failed to create train: ${JSON.stringify(createTrainRes.body)}`);
    }
    const createdTrain = createTrainRes.body.train;
    console.log(`✅ Train Created. ID: ${createdTrain.id}, Train Number: ${createdTrain.train_number}`);

    // Verify in Search before restart
    const searchBeforeRes = await makeRequest('GET', '/api/trains?source=NDLS&destination=MMCT', null, passengerToken);
    const foundBefore = (searchBeforeRes.body || []).find(t => t.train_number === '90001');
    if (!foundBefore) {
      throw new Error('Created train 90001 not found in Passenger Search before restart!');
    }
    console.log('✅ Train 90001 verified in Passenger Search before restart.');

    // ----------------------------------------------------
    // STEP 2: PASSENGER BOOKING
    // ----------------------------------------------------
    console.log('\n[STEP 2] Passenger booking ticket on Train 90001...');
    const bookingPayload = {
      train_id: createdTrain.id,
      travel_date: '2026-09-15',
      coach_class: '3A',
      passengers: [{ name: 'Persistence Tester', age: 32, gender: 'Male' }],
      total_fare: 1550
    };

    const bookRes = await makeRequest('POST', '/api/bookings/book', bookingPayload, passengerToken);
    if (bookRes.statusCode !== 201) {
      throw new Error(`Failed to book ticket: ${JSON.stringify(bookRes.body)}`);
    }
    const booking = bookRes.body.booking;
    console.log(`✅ Ticket Booked. ID: ${booking.id}, PNR: ${booking.pnr_number}, Status: ${booking.status}`);

    // Verify GET /bookings before restart
    const myBookingsBefore = await makeRequest('GET', '/api/bookings', null, passengerToken);
    const bookingFoundBefore = (myBookingsBefore.body || []).find(b => b.id === booking.id);
    if (!bookingFoundBefore) {
      throw new Error('Booking not found in GET /api/bookings before restart!');
    }
    console.log('✅ Booking verified in My Bookings before restart.');

    // ----------------------------------------------------
    // STEP 3: STOP SERVER & SIMULATE BACKEND RESTART
    // ----------------------------------------------------
    console.log('\n[STEP 3] Stopping backend server and simulating FULL RESTART...');
    await stopServer();

    // Reload module / re-read db.json
    delete require.cache[require.resolve('../config/supabase')];
    delete require.cache[require.resolve('../routes/trains')];
    delete require.cache[require.resolve('../routes/bookings')];
    delete require.cache[require.resolve('../routes/admin')];
    delete require.cache[require.resolve('../routes/auth')];

    const reloadedSupabase = require('../config/supabase');
    app = createApp();
    await startServer();
    console.log('⚡ Server restarted and re-loaded database from db.json.');

    // ----------------------------------------------------
    // STEP 4: VERIFY RESTART PERSISTENCE
    // ----------------------------------------------------
    console.log('\n[STEP 4] Verifying data survival after backend restart...');

    // A. Verify Train 90001
    const searchAfterRes = await makeRequest('GET', '/api/trains?source=NDLS&destination=MMCT', null, passengerToken);
    const foundAfter = (searchAfterRes.body || []).find(t => t.train_number === '90001');
    if (!foundAfter) {
      throw new Error('❌ TRAIN DATA DISAPPEARED AFTER RESTART!');
    }
    console.log('🎉 PERSISTENCE SUCCESS: Train 90001 survived backend restart!');

    // B. Verify Booking
    const myBookingsAfter = await makeRequest('GET', '/api/bookings', null, passengerToken);
    const bookingFoundAfter = (myBookingsAfter.body || []).find(b => b.id === booking.id);
    if (!bookingFoundAfter) {
      throw new Error('❌ BOOKING DATA DISAPPEARED AFTER RESTART!');
    }
    console.log('🎉 PERSISTENCE SUCCESS: Booking survived backend restart!');

    // C. Verify PNR
    const pnrRes = await makeRequest('GET', `/api/bookings/pnr/${booking.pnr_number}`, null, passengerToken);
    if (pnrRes.statusCode !== 200 || pnrRes.body.pnr_number !== booking.pnr_number) {
      throw new Error('❌ PNR LOOKUP FAILED AFTER RESTART!');
    }
    console.log('🎉 PERSISTENCE SUCCESS: PNR lookup succeeded after restart!');

    // ----------------------------------------------------
    // STEP 5: CANCEL BOOKING & VERIFY CANCELLATION RESTART PERSISTENCE
    // ----------------------------------------------------
    console.log('\n[STEP 5] Cancelling booking and testing cancellation restart persistence...');
    const cancelRes = await makeRequest('PUT', `/api/bookings/${booking.id}/cancel`, {}, passengerToken);
    if (cancelRes.statusCode !== 200 || cancelRes.body.booking.status !== 'cancelled') {
      throw new Error(`Cancellation failed: ${JSON.stringify(cancelRes.body)}`);
    }
    console.log('✅ Booking cancelled successfully.');

    // Stop and Restart again
    await stopServer();
    delete require.cache[require.resolve('../config/supabase')];
    delete require.cache[require.resolve('../routes/trains')];
    delete require.cache[require.resolve('../routes/bookings')];
    delete require.cache[require.resolve('../routes/admin')];
    delete require.cache[require.resolve('../routes/auth')];

    const reloadedSupabase2 = require('../config/supabase');
    app = createApp();
    await startServer();
    console.log('⚡ Server restarted second time after cancellation.');

    const myBookingsCancelCheck = await makeRequest('GET', '/api/bookings', null, passengerToken);
    const cancelledBooking = (myBookingsCancelCheck.body || []).find(b => b.id === booking.id);
    if (!cancelledBooking || cancelledBooking.status !== 'cancelled') {
      throw new Error('❌ CANCELLATION STATE WAS LOGT AFTER RESTART!');
    }
    console.log('🎉 PERSISTENCE SUCCESS: Cancellation status strictly preserved across restart!');

    // ----------------------------------------------------
    // STEP 6: CONCURRENCY STRESS TEST
    // ----------------------------------------------------
    // Clean up any pre-existing concurrent test trains
    const activeMockDb = reloadedSupabase2.mockDb || mockDb;
    for (const [tId, tr] of activeMockDb.trains.entries()) {
      if (tr && (String(tr.train_number).startsWith('8800') || String(tr.trainNo).startsWith('8800'))) {
        activeMockDb.trains.delete(tId);
      }
    }

    console.log('\n[STEP 6] Running Concurrent Write Stress Test (10 parallel writes)...');
    const parallelTrainPromises = Array.from({ length: 10 }).map((_, idx) => {
      return makeRequest('POST', '/api/trains', {
        trainNo: `8800${idx}`,
        trainName: `Concurrent Train ${idx}`,
        from: 'NDLS',
        to: 'BPL',
        depTime: '08:00 AM',
        arrTime: '02:00 PM'
      }, adminToken);
    });

    const parallelResults = await Promise.all(parallelTrainPromises);
    const successCount = parallelResults.filter(r => r.statusCode === 201).length;
    if (successCount !== 10) {
      console.log('Parallel results:', parallelResults.map(r => ({ status: r.statusCode, body: r.body })));
      throw new Error(`Concurrent writes failed. Success count: ${successCount}/10`);
    }
    console.log('✅ 10 parallel train creations completed cleanly without write conflicts.');

    // Verify test db file is valid JSON
    const dbPath = process.env.DB_FILE_PATH || path.join(__dirname, '../../data/db.test.json');
    const dbRaw = fs.readFileSync(dbPath, 'utf-8');
    const dbParsed = JSON.parse(dbRaw);
    if (!dbParsed || !dbParsed.trains) {
      throw new Error('db.test.json corrupted after concurrent writes!');
    }
    console.log('✅ db.test.json verified valid JSON after concurrent writes.');

    console.log('\n======================================================');
    console.log('🏆 ALL PERSISTENCE FORENSIC TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ PERSISTENCE TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runPersistenceTests();
