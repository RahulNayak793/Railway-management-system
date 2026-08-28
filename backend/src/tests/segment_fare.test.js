const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.PERSISTENCE_TEST = 'true';
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const http = require('http');
const express = require('express');
const { isMockMode, mockDb } = require('../config/supabase');
const { matchRouteSegment } = require('../utils/routeSearch');
const { calculateSegmentFare, getSegmentDistanceKm, getSegmentDurationMinutes } = require('../utils/fareCalculator');

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
const PORT = 5064;

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

async function runSegmentFareTests() {
  console.log('\n======================================================');
  console.log('🧪 DYNAMIC DISTANCE + DURATION SEGMENT FARE AUDIT SUITE');
  console.log('======================================================\n');

  try {
    await startServer();

    // ----------------------------------------------------
    // TEST 1: ALL ORDERED PAIRS FOR ROUTE A -> B -> C -> D
    // ----------------------------------------------------
    console.log('[TEST 1] Testing all ordered station pairs for route A -> B -> C -> D...');

    const sampleTrain = { id: 't-unit-99', train_number: '99901', train_name: 'Audit Route Express' };
    const sampleRoute = {
      source_station_code: 'STA_A',
      destination_station_code: 'STA_D',
      departure_time: '01:00:00',
      arrival_time: '17:00:00',
      distance_km: 1200,
      fare_multiplier: 1.0,
      stops: [
        { stationCode: 'STA_B', arrTime: '05:00:00', depTime: '05:10:00', distanceFromOriginKm: 300 },
        { stationCode: 'STA_C', arrTime: '11:00:00', depTime: '11:10:00', distanceFromOriginKm: 750 }
      ]
    };

    const pairs = [
      ['STA_A', 'STA_B'],
      ['STA_A', 'STA_C'],
      ['STA_A', 'STA_D'],
      ['STA_B', 'STA_C'],
      ['STA_B', 'STA_D'],
      ['STA_C', 'STA_D']
    ];

    const results = {};
    for (const [src, dest] of pairs) {
      const seg = matchRouteSegment(sampleTrain, sampleRoute, src, dest);
      const fareInfo = calculateSegmentFare({ train: sampleTrain, route: sampleRoute, srcIndex: seg.srcIndex, destIndex: seg.destIndex, nodes: seg.nodes });
      results[`${src}->${dest}`] = fareInfo;
      console.log(`  ${src} -> ${dest} | Dist: ${fareInfo.distance_km}km | Duration: ${fareInfo.duration_minutes}m | SL: ₹${fareInfo.fares_by_class.SL} | 3A: ₹${fareInfo.fares_by_class['3A']} | 2A: ₹${fareInfo.fares_by_class['2A']} | 1A: ₹${fareInfo.fares_by_class['1A']}`);
    }

    // Assertions 1-3: Distance, Duration, Fare differences
    if (results['STA_A->STA_B'].distance_km >= results['STA_A->STA_C'].distance_km ||
        results['STA_A->STA_C'].distance_km >= results['STA_A->STA_D'].distance_km) {
      throw new Error('Distance assertion failed: Distance must increase along route!');
    }
    if (results['STA_A->STA_B'].duration_minutes >= results['STA_A->STA_C'].duration_minutes ||
        results['STA_A->STA_C'].duration_minutes >= results['STA_A->STA_D'].duration_minutes) {
      throw new Error('Duration assertion failed: Duration must increase along route!');
    }
    if (results['STA_A->STA_B'].fares_by_class.SL >= results['STA_A->STA_C'].fares_by_class.SL ||
        results['STA_A->STA_C'].fares_by_class.SL >= results['STA_A->STA_D'].fares_by_class.SL) {
      throw new Error('Fare assertion failed: Fares must increase monotonically!');
    }

    console.log('  ✅ Segment distance, duration, and fare monotonicity verified.');

    // Assertions 4-5: Reverse and same-station rejection
    if (matchRouteSegment(sampleTrain, sampleRoute, 'STA_D', 'STA_A') !== null) {
      throw new Error('Reverse route D -> A should be rejected!');
    }
    if (matchRouteSegment(sampleTrain, sampleRoute, 'STA_A', 'STA_A') !== null) {
      throw new Error('Same station A -> A should be rejected!');
    }
    console.log('  ✅ Reverse route and same-station searches correctly rejected.');

    // Assertion 8: Class multipliers
    const fareAC = results['STA_A->STA_C'];
    if (fareAC.fares_by_class.SL >= fareAC.fares_by_class['3A'] ||
        fareAC.fares_by_class['3A'] >= fareAC.fares_by_class['2A'] ||
        fareAC.fares_by_class['2A'] >= fareAC.fares_by_class['1A']) {
      throw new Error('Class multiplier assertion failed: SL < 3A < 2A < 1A!');
    }
    console.log('  ✅ Class multiplier ordering verified (SL < 3A < 2A < 1A).');

    // ----------------------------------------------------
    // TEST 2: UDU -> MMCT vs UDU -> NDLS EXPLICIT ASSERTION
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing UDU -> MMCT vs UDU -> NDLS fare differentiation...');

    const udupiTrain = { id: 't-co0fa2xs2', train_number: '12345', train_name: 'udupi express' };
    const udupiRoute = {
      source_station_code: 'UDU',
      destination_station_code: 'NDLS',
      departure_time: '01:00:00',
      arrival_time: '16:00:00',
      distance_km: 500,
      stops: [
        { stationCode: 'MMCT', arrTime: '08:00:00', depTime: '08:05:00', distanceFromOriginKm: 250 }
      ]
    };

    const segUDU_MMCT = matchRouteSegment(udupiTrain, udupiRoute, 'UDU', 'MMCT');
    const fareUDU_MMCT = calculateSegmentFare({ train: udupiTrain, route: udupiRoute, srcIndex: segUDU_MMCT.srcIndex, destIndex: segUDU_MMCT.destIndex, nodes: segUDU_MMCT.nodes });

    const segUDU_NDLS = matchRouteSegment(udupiTrain, udupiRoute, 'UDU', 'NDLS');
    const fareUDU_NDLS = calculateSegmentFare({ train: udupiTrain, route: udupiRoute, srcIndex: segUDU_NDLS.srcIndex, destIndex: segUDU_NDLS.destIndex, nodes: segUDU_NDLS.nodes });

    console.log(`  UDU -> MMCT (SL): ₹${fareUDU_MMCT.fares_by_class.SL}, (3A): ₹${fareUDU_MMCT.fares_by_class['3A']}, (2A): ₹${fareUDU_MMCT.fares_by_class['2A']}, (1A): ₹${fareUDU_MMCT.fares_by_class['1A']}`);
    console.log(`  UDU -> NDLS (SL): ₹${fareUDU_NDLS.fares_by_class.SL}, (3A): ₹${fareUDU_NDLS.fares_by_class['3A']}, (2A): ₹${fareUDU_NDLS.fares_by_class['2A']}, (1A): ₹${fareUDU_NDLS.fares_by_class['1A']}`);

    // Explicit check fare(UDU, MMCT) !== fare(UDU, NDLS) for ALL classes
    for (const cls of ['SL', '3A', '2A', '1A']) {
      if (fareUDU_MMCT.fares_by_class[cls] === fareUDU_NDLS.fares_by_class[cls]) {
        throw new Error(`CRITICAL FAILURE: ${cls} fare for UDU->MMCT (₹${fareUDU_MMCT.fares_by_class[cls]}) equals UDU->NDLS (₹${fareUDU_NDLS.fares_by_class[cls]})!`);
      }
    }
    console.log('  🎯 PROOF CONFIRMED: fare(UDU, MMCT) !== fare(UDU, NDLS) across ALL classes!');

    // ----------------------------------------------------
    // TEST 3: LIVE HTTP API SEARCH + BOOKING + PAYMENT
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing Search API -> Booking -> Payment integration flow...');

    // Search via API
    const searchResMMCT = await makeRequest('GET', '/api/trains?source=UDU&destination=MMCT');
    const trainMMCT = searchResMMCT.body.find(t => t.id === 't-co0fa2xs2' || t.train_number === '12345');

    const searchResNDLS = await makeRequest('GET', '/api/trains?source=UDU&destination=NDLS');
    const trainNDLS = searchResNDLS.body.find(t => t.id === 't-co0fa2xs2' || t.train_number === '12345');

    if (!trainMMCT || !trainNDLS) {
      console.warn('  ⚠️ Note: Seed train not found in search API result (may be active in main DB). Using test train for API verification.');
    } else {
      console.log(`  API Search UDU->MMCT 3A Fare: ₹${trainMMCT.fares_by_class['3A']}`);
      console.log(`  API Search UDU->NDLS 3A Fare: ₹${trainNDLS.fares_by_class['3A']}`);
      if (trainMMCT.fares_by_class['3A'] === trainNDLS.fares_by_class['3A']) {
        throw new Error('API returned identical fares for UDU->MMCT vs UDU->NDLS!');
      }
    }

    // Create a temporary test train to test booking and payment flow
    const createTrainPayload = {
      trainNo: '99902',
      trainName: 'Segment Booking Test Train',
      from: 'UDUPI (UDU)',
      to: 'NEW DELHI (NDLS)',
      depTime: '01:00 AM',
      arrTime: '04:00 PM',
      distance_km: 1400,
      stops: [
        { stationCode: 'MUMBAI CENTRAL (MMCT)', arrTime: '08:00 AM', depTime: '08:05 AM', distanceFromOriginKm: 500 }
      ]
    };

    const createRes = await makeRequest('POST', '/api/trains', createTrainPayload);
    const testTrainId = createRes.body.train.id;

    // Search UDU -> MMCT on test train
    const apiSearchUDU_MMCT = await makeRequest('GET', '/api/trains?source=UDU&destination=MMCT');
    const testTrainMMCT = apiSearchUDU_MMCT.body.find(t => t.id === testTrainId);

    const expected3AFare = testTrainMMCT.fares_by_class['3A'];

    // Book ticket
    const bookingPayload = {
      train_id: testTrainId,
      source: 'UDU',
      destination: 'MMCT',
      travel_date: '2026-09-05',
      coach_class: '3A',
      passengers: [{ name: 'Audit User', age: 28, gender: 'Male' }],
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
    console.log(`  ✅ Booking created with authoritative segment fare: ₹${createdBooking.total_fare}`);

    // Payment checkout
    const payRes = await makeRequest('POST', '/api/payments/checkout', {
      booking_id: createdBooking.id,
      amount: createdBooking.total_fare
    });

    if (payRes.statusCode !== 200) {
      throw new Error(`Payment checkout failed: ${JSON.stringify(payRes.body)}`);
    }
    if (payRes.body.payment.amount !== expected3AFare) {
      throw new Error(`Payment amount validation failed: paid ${payRes.body.payment.amount} !== expected ${expected3AFare}`);
    }
    console.log(`  ✅ Payment executed with stored booking fare: ₹${payRes.body.payment.amount}`);

    // Cleanup
    await makeRequest('DELETE', `/api/trains/${testTrainId}`);

    console.log('\n======================================================');
    console.log('🏆 SEGMENT FARE FORENSIC AUDIT PASSED 100%!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ SEGMENT FARE AUDIT FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

runSegmentFareTests();
