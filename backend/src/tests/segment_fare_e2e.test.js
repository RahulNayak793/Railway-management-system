const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.PERSISTENCE_TEST = 'true';
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const http = require('http');
const express = require('express');
const { mockDb } = require('../config/supabase');
const { matchRouteSegment } = require('../utils/routeSearch');
const { calculateSegmentFare } = require('../utils/fareCalculator');

function createApp() {
  const app = express();
  app.use(express.json());

  const trainsRouter = require('../routes/trains');
  const bookingsRouter = require('../routes/bookings');
  const paymentsRouter = require('../routes/payments');
  const aiRouter = require('../routes/ai');

  app.use('/api/trains', trainsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/ai', aiRouter);
  return app;
}

let app = createApp();
let server;
const PORT = 5068;

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

const makeRequest = (method, reqPath, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
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

async function runSegmentFareE2ETests() {
  console.log('\n======================================================');
  console.log('🧪 REAL DISTANCE/TIME BASED SEGMENT FARE E2E SUITE');
  console.log('======================================================\n');

  try {
    await startServer();

    // ----------------------------------------------------
    // STEP 1: CREATE TRAIN "TEST EXPRESS" (AAA -> BBB -> CCC)
    // ----------------------------------------------------
    console.log('[STEP 1] Admin creating train "TEST EXPRESS" (AAA -> BBB -> CCC)...');

    const trainPayload = {
      trainNo: '77701',
      trainName: 'TEST EXPRESS',
      from: 'AAA',
      to: 'CCC',
      depTime: '06:00 AM',
      arrTime: '03:00 PM',
      distance_km: 600,
      stops: [
        {
          stationCode: 'BBB',
          arrTime: '09:00 AM',
          depTime: '09:10 AM',
          haltMinutes: '10',
          distanceFromOriginKm: 200
        }
      ]
    };

    const createRes = await makeRequest('POST', '/api/trains', trainPayload);
    if (createRes.statusCode !== 201) {
      throw new Error(`Failed to create TEST EXPRESS: ${JSON.stringify(createRes.body)}`);
    }

    const testTrainId = createRes.body.train.id;
    console.log(`  ✅ Train created successfully. ID: ${testTrainId}`);

    // ----------------------------------------------------
    // STEP 2: TEST SEGMENT DISTANCES & DURATION
    // ----------------------------------------------------
    console.log('\n[STEP 2] Testing distances and durations for segments (AAA->BBB, AAA->CCC, BBB->CCC)...');

    const searchAAA_BBB = await makeRequest('GET', '/api/trains?source=AAA&destination=BBB');
    const trainAAA_BBB = searchAAA_BBB.body.find(t => t.id === testTrainId);

    const searchAAA_CCC = await makeRequest('GET', '/api/trains?source=AAA&destination=CCC');
    const trainAAA_CCC = searchAAA_CCC.body.find(t => t.id === testTrainId);

    const searchBBB_CCC = await makeRequest('GET', '/api/trains?source=BBB&destination=CCC');
    const trainBBB_CCC = searchBBB_CCC.body.find(t => t.id === testTrainId);

    if (!trainAAA_BBB || !trainAAA_CCC || !trainBBB_CCC) {
      throw new Error('Failed to retrieve train segments from Search API!');
    }

    console.log(`  AAA -> BBB | Dist: ${trainAAA_BBB.distance_km}km | Duration: ${trainAAA_BBB.duration_minutes}m | SL: ₹${trainAAA_BBB.fares_by_class.SL} | 3A: ₹${trainAAA_BBB.fares_by_class['3A']}`);
    console.log(`  AAA -> CCC | Dist: ${trainAAA_CCC.distance_km}km | Duration: ${trainAAA_CCC.duration_minutes}m | SL: ₹${trainAAA_CCC.fares_by_class.SL} | 3A: ₹${trainAAA_CCC.fares_by_class['3A']}`);
    console.log(`  BBB -> CCC | Dist: ${trainBBB_CCC.distance_km}km | Duration: ${trainBBB_CCC.duration_minutes}m | SL: ₹${trainBBB_CCC.fares_by_class.SL} | 3A: ₹${trainBBB_CCC.fares_by_class['3A']}`);

    // ASSERT DISTANCES
    if (trainAAA_BBB.distance_km !== 200) {
      throw new Error(`Distance assertion failed: distance(AAA,BBB) was ${trainAAA_BBB.distance_km}, expected 200!`);
    }
    if (trainAAA_CCC.distance_km !== 600) {
      throw new Error(`Distance assertion failed: distance(AAA,CCC) was ${trainAAA_CCC.distance_km}, expected 600!`);
    }
    if (trainBBB_CCC.distance_km !== 400) {
      throw new Error(`Distance assertion failed: distance(BBB,CCC) was ${trainBBB_CCC.distance_km}, expected 400!`);
    }
    console.log('  ✅ ASSERT PASSED: distance(AAA,BBB)===200, distance(AAA,CCC)===600, distance(BBB,CCC)===400');

    // ASSERT FARES DIFFERENT
    const fareAAA_BBB = trainAAA_BBB.fares_by_class.SL;
    const fareAAA_CCC = trainAAA_CCC.fares_by_class.SL;
    const fareBBB_CCC = trainBBB_CCC.fares_by_class.SL;

    if (fareAAA_BBB === fareAAA_CCC || fareAAA_BBB === fareBBB_CCC || fareAAA_CCC === fareBBB_CCC) {
      throw new Error(`Fare assertion failed: Fares must be different! AAA->BBB: ₹${fareAAA_BBB}, AAA->CCC: ₹${fareAAA_CCC}, BBB->CCC: ₹${fareBBB_CCC}`);
    }
    console.log(`  ✅ ASSERT PASSED: fare(AAA,BBB) !== fare(AAA,CCC) !== fare(BBB,CCC)`);

    // ----------------------------------------------------
    // STEP 3: FULL END-TO-END FLOW (SEARCH -> BOOKING -> PAYMENT)
    // ----------------------------------------------------
    console.log('\n[STEP 3] Testing full end-to-end booking & payment pipeline for segment BBB -> CCC...');

    const expected3AFare = trainBBB_CCC.fares_by_class['3A'];

    const bookingPayload = {
      train_id: testTrainId,
      source: 'BBB',
      destination: 'CCC',
      travel_date: '2026-09-10',
      coach_class: '3A',
      passengers: [{ name: 'E2E Passenger', age: 30, gender: 'Male' }],
      total_fare: expected3AFare
    };

    const bookRes = await makeRequest('POST', '/api/bookings/book', bookingPayload);
    if (bookRes.statusCode !== 201) {
      throw new Error(`Booking failed: ${JSON.stringify(bookRes.body)}`);
    }

    const createdBooking = bookRes.body.booking;
    if (createdBooking.total_fare !== expected3AFare) {
      throw new Error(`Booking fare validation failed: stored fare ${createdBooking.total_fare} !== expected ${expected3AFare}`);
    }
    console.log(`  ✅ Booking confirmed with search segment fare: ₹${createdBooking.total_fare}`);

    // Payment checkout
    const payRes = await makeRequest('POST', '/api/payments/checkout', {
      booking_id: createdBooking.id,
      amount: createdBooking.total_fare
    });

    if (payRes.statusCode !== 200) {
      throw new Error(`Payment failed: ${JSON.stringify(payRes.body)}`);
    }
    if (payRes.body.payment.amount !== expected3AFare) {
      throw new Error(`Payment amount validation failed: paid ${payRes.body.payment.amount} !== expected ${expected3AFare}`);
    }
    console.log(`  ✅ Payment executed with stored booking fare: ₹${payRes.body.payment.amount}`);

    // Cleanup
    await makeRequest('DELETE', `/api/trains/${testTrainId}`);

    console.log('\n======================================================');
    console.log('🏆 REAL DISTANCE/TIME SEGMENT FARE E2E TEST PASSED 100%!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ E2E TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runSegmentFareE2ETests();
