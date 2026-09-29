/**
 * Realistic On-Board Train Catering & Station eCatering Test Suite
 * 
 * Tests the complete On-Board Train Catering architecture:
 * Train -> Authorized On-Board Provider -> Pantry Staff -> Coach & Berth -> Passenger
 * alongside independent Station eCatering, dynamic ticket entitlement, and strict data safety.
 */

const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.MOCK_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const app = require('../index');
const jwt = require('jsonwebtoken');
const { mockDb } = require('../config/supabase');
const { 
  getTrainOnboardConfig, 
  setTrainOnboardConfig, 
  evaluateOnboardAvailability,
  getAllTrainOnboardConfigs,
  isTrainConnectingUdupiAndDelhi
} = require('../services/onboardCateringService');

const PORT = 5122;
const BASE_URL = `http://localhost:${PORT}`;
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const makeToken = (id, role, email = 'user@railway.com') => {
  return jwt.sign({ id, role, email }, jwtSecret, { expiresIn: '1h' });
};

let server;

async function request(method, reqPath, body = null, token = null) {
  const url = `${BASE_URL}${reqPath}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let parsed = null;
  try {
    parsed = await res.json();
  } catch (e) {
    parsed = null;
  }
  return { status: res.status, data: parsed };
}

async function runOnboardCateringTestSuite() {
  console.log('🚂 Starting Comprehensive Realistic On-Board Train Catering Test Suite...\n');

  // 1. Data Safety Baseline
  const prodDbPath = path.join(__dirname, '../../data/db.json');
  const initialProdDbContent = fs.readFileSync(prodDbPath, 'utf8');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 On-Board Catering test server running on port ${PORT}`);
      resolve();
    });
  });

  const adminToken = makeToken('admin-001', 'admin', 'admin@railway.gov.in');
  const passengerToken = makeToken('pax-001', 'passenger', 'passenger@example.com');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  async function runAsyncTest(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // GROUP 1: Train On-Board Catering Service & Config Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- GROUP 1: On-Board Catering Service Unit Tests ---');

    runTest('1.1 Default configs exist for premium trains (12952, 22436, 12001)', () => {
      const cfg12952 = getTrainOnboardConfig('12952');
      assert(cfg12952, '12952 Tejas Rajdhani config must exist');
      assert.strictEqual(cfg12952.catering_available, true, '12952 catering must be available');
      assert(cfg12952.pantry_type.includes('Pantry'), '12952 must have pantry car');

      const cfg22436 = getTrainOnboardConfig('22436');
      assert(cfg22436, '22436 Vande Bharat config must exist');
      assert.strictEqual(cfg22436.catering_available, true, '22436 catering must be available');
    });

    runTest('1.2 evaluateOnboardAvailability checks active dates and eligible classes', () => {
      const avail1A = evaluateOnboardAvailability('12952', '1A');
      assert.strictEqual(avail1A.is_available, true, '1A class should have on-board catering on 12952');

      const availGeneral = evaluateOnboardAvailability('12952', 'GEN');
      assert.strictEqual(availGeneral.is_available, false, 'Unregistered class should not have on-board catering');
    });

    runTest('1.3 setTrainOnboardConfig updates config safely in memory/test-db', () => {
      const updated = setTrainOnboardConfig('99999', {
        train_name: 'Test Superfast Express',
        catering_available: true,
        provider_name: 'Test Onboard Foods',
        pantry_type: 'Mini Pantry',
        applicable_classes: ['2A', '3A']
      });
      assert.strictEqual(updated.train_number, '99999');
      assert.strictEqual(updated.catering_available, true);
      assert.strictEqual(updated.provider_name, 'Test Onboard Foods');

      const retrieved = getTrainOnboardConfig('99999');
      assert.strictEqual(retrieved.provider_name, 'Test Onboard Foods');
    });

    // -------------------------------------------------------------
    // GROUP 2: API Endpoints for Train Configurations (Admin)
    // -------------------------------------------------------------
    console.log('\n--- GROUP 2: Admin Train Catering Config Endpoints ---');

    await runAsyncTest('2.1 GET /api/catering/admin/train-configs returns list of trains', async () => {
      const res = await request('GET', '/api/catering/admin/train-configs', null, adminToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success, 'Response must indicate success');
      assert(Array.isArray(res.data.configs), 'Configs must be an array');
      assert(res.data.configs.length > 0, 'Must return configured trains');
    });

    await runAsyncTest('2.2 PUT /api/catering/admin/train-configs/:train_number updates availability', async () => {
      const res = await request('PUT', '/api/catering/admin/train-configs/12952', {
        catering_available: true,
        service_type: 'Full Pantry Car',
        provider_name: 'IRCTC Executive Onboard Kitchen'
      }, adminToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.success, 'Update must be successful');
      assert.strictEqual(res.data.config.provider_name, 'IRCTC Executive Onboard Kitchen');
    });

    // -------------------------------------------------------------
    // GROUP 3: Passenger On-Board Menu & Dynamic Ticket Entitlement
    // -------------------------------------------------------------
    console.log('\n--- GROUP 3: Passenger On-Board Menu & Entitlement ---');

    await runAsyncTest('3.1 GET /api/catering/onboard/menu returns train pantry menu', async () => {
      const res = await request('GET', '/api/catering/onboard/menu?train_number=12952');
      assert.strictEqual(res.status, 200);
      assert(res.data.success, 'Menu request must succeed');
      assert(res.data.onboard_config, 'Must include train on-board config');
      assert(Array.isArray(res.data.menu), 'Must return menu items');
      assert(res.data.menu.length > 0, 'Should have pantry items');
    });

    await runAsyncTest('3.2 PNR-first Validation returns onboard_catering info and booking seat', async () => {
      // Seed a realistic confirmed test booking in test mockDb
      const testPnr = 'PNR-ONBOARD-TEST-99';
      mockDb.bookings.set('booking-onboard-test', {
        id: 'booking-onboard-test',
        pnr_number: testPnr,
        user_id: 'pax-001',
        train_number: '12952',
        train_name: 'Tejas Rajdhani Express',
        booking_status: 'CONFIRMED',
        status: 'CONFIRMED',
        coach_number: 'B2',
        seat_number: '19',
        berth_number: '19',
        seat_type: 'LOWER',
        ticket_class: '2A',
        travel_class: '2A',
        passenger_name: 'Anita Verma',
        passenger_phone: '9876543210',
        source_station_code: 'NDLS',
        destination_station_code: 'MMCT',
        journey_date: '2026-09-25'
      });

      const valRes = await request('POST', '/api/catering/validate-pnr', { pnr: testPnr });
      assert.strictEqual(valRes.status, 200);
      assert.strictEqual(valRes.data.valid, true);
      assert(valRes.data.onboard_catering, 'Must return onboard_catering object');
      assert.strictEqual(valRes.data.onboard_catering.is_available, true);
      assert.strictEqual(valRes.data.coach_number, 'B2');
      assert.strictEqual(valRes.data.seat_number, '19');
    });

    // -------------------------------------------------------------
    // GROUP 4: Direct-to-Berth On-Board Orders vs Station eCatering
    // -------------------------------------------------------------
    console.log('\n--- GROUP 4: Direct-to-Berth On-Board Order Lifecycle ---');

    let createdOnboardOrderId = null;

    await runAsyncTest('4.1 POST /api/catering/onboard/order places direct-to-coach meal order', async () => {
      const orderPayload = {
        pnr_number: 'PNR-ONBOARD-TEST-99',
        train_number: '12952',
        coach_number: 'B2',
        seat_number: '19',
        passenger_name: 'Anita Verma',
        passenger_phone: '9876543210',
        items: [
          { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, qty: 1 }
        ],
        payment_mode: 'Paid Online',
        payment_method: 'UPI',
        total_amount: 240
      };

      const res = await request('POST', '/api/catering/onboard/order', orderPayload, passengerToken);
      assert.strictEqual(res.status, 201, 'Order must be created with HTTP 201');
      assert(res.data.success, 'Response must indicate success');
      assert(res.data.order, 'Must return created order');
      assert.strictEqual(res.data.order.catering_type, 'ONBOARD', 'catering_type must be ONBOARD');
      assert.strictEqual(res.data.order.coach_number, 'B2', 'Coach must match');
      assert.strictEqual(res.data.order.seat_number, '19', 'Seat must match');
      assert(res.data.order.order_id.startsWith('ORD-ONB-'), 'Order ID must have ONB prefix');
      createdOnboardOrderId = res.data.order.order_id;
    });

    await runAsyncTest('4.2 On-board order appears in train-specific pantry manifest', async () => {
      assert(createdOnboardOrderId, 'Created order ID must be present');
      const res = await request('GET', '/api/catering/onboard/orders/train/12952');
      assert.strictEqual(res.status, 200);
      assert(res.data.success, 'Must succeed');
      const found = res.data.orders.find(o => o.order_id === createdOnboardOrderId);
      assert(found, 'On-board order must be in train 12952 manifest');
      assert.strictEqual(found.coach_number, 'B2');
    });

    await runAsyncTest('4.3 Central Manifest returns both ONBOARD and STATION order types', async () => {
      const res = await request('GET', '/api/catering/all-orders', null, adminToken);
      assert.strictEqual(res.status, 200);
      assert(res.data.orders, 'Must return orders list');
      const onboardOrder = res.data.orders.find(o => o.catering_type === 'ONBOARD');
      assert(onboardOrder, 'Unified manifest must include ONBOARD order');
    });

    // -------------------------------------------------------------
    // GROUP 5: UDUPI → NEW DELHI TRAINS & DATE-SPECIFIC RETENTION
    // -------------------------------------------------------------
    console.log('\n--- GROUP 5: Udupi → New Delhi Trains & Date-Specific Retention ---');

    // Populate in-memory mockDb.trains with Udupi -> Delhi trains for test evaluation
    const prodDbData = JSON.parse(initialProdDbContent);
    if (Array.isArray(prodDbData.trains)) {
      for (const [id, train] of prodDbData.trains) {
        if (isTrainConnectingUdupiAndDelhi(train)) {
          mockDb.trains.set(id, train);
        }
      }
    }

    runTest('5.1 getAllTrainOnboardConfigs includes all Udupi → New Delhi trains', () => {
      const allConfigs = getAllTrainOnboardConfigs();
      assert(allConfigs.length > 0, 'Must return train configurations');
      const udupiDelhiConfigs = allConfigs.filter(t => t.is_udupi_to_delhi);
      assert.strictEqual(udupiDelhiConfigs.length, 41, `Must find exactly 41 unique Udupi -> Delhi train services (found ${udupiDelhiConfigs.length})`);
    });

    runTest('5.2 Date-specific trains preserve exact journey_date and are not converted to daily', () => {
      const allConfigs = getAllTrainOnboardConfigs();
      const demo09401 = allConfigs.find(t => String(t.train_number) === '09401');
      assert(demo09401, '09401 festive special must be in configurations');
      assert.strictEqual(demo09401.journey_date, '2026-10-23', '09401 must preserve exact journey_date 2026-10-23');
      assert.strictEqual(demo09401.is_date_specific, true, '09401 must be flagged as date-specific');
      assert.strictEqual(demo09401.catering_available, true, '09401 must have catering enabled by default');
      assert(demo09401.provider_name.includes('IRCTC'), '09401 must have authorized catering provider');
    });

    runTest('5.3 Fleet train 12345 (present under two raw IDs in db.json) is cleanly deduplicated', () => {
      const allConfigs = getAllTrainOnboardConfigs();
      const matches12345 = allConfigs.filter(t => String(t.train_number) === '12345');
      assert.strictEqual(matches12345.length, 1, `Train 12345 must appear exactly once, but appeared ${matches12345.length} times`);
    });

    runTest('5.4 Date-specific evaluation blocks catering on mismatched date', () => {
      // 09401 is configured for 2026-10-23
      const validDate = evaluateOnboardAvailability('09401', '3A', '2026-10-23');
      assert.strictEqual(validDate.available, true, 'Must be available on its scheduled run date 2026-10-23');

      const wrongDate = evaluateOnboardAvailability('09401', '3A', '2026-11-15');
      assert.strictEqual(wrongDate.available, false, 'Must not be available on mismatched run date');
      assert.strictEqual(wrongDate.reason, 'DATE_SPECIFIC_SERVICE_MISMATCH');
    });

    await runAsyncTest('5.5 Admin API GET /api/catering/admin/train-configs returns Udupi -> Delhi trains', async () => {
      const res = await request('GET', '/api/catering/admin/train-configs');
      assert.strictEqual(res.status, 200);
      assert(res.data.success, 'Must succeed');
      const udupiDelhi = res.data.configs.filter(c => c.is_udupi_to_delhi);
      assert.strictEqual(udupiDelhi.length, 41, 'Must return 41 unique Udupi -> Delhi trains');
    });

    // -------------------------------------------------------------
    // GROUP 6: STRICT DATA SAFETY CHECK
    // -------------------------------------------------------------
    console.log('\n--- GROUP 6: Strict Database Protection Check ---');

    runTest('6.1 Confirms backend/data/db.json was NEVER modified during tests', () => {
      const currentProdDbContent = fs.readFileSync(prodDbPath, 'utf8');
      assert.strictEqual(
        currentProdDbContent.length,
        initialProdDbContent.length,
        'Production db.json file size must be EXACTLY identical'
      );
      assert.strictEqual(
        currentProdDbContent,
        initialProdDbContent,
        'Production db.json byte content must be completely untouched'
      );
    });

  } finally {
    if (server) {
      server.close();
      console.log('\n🛑 Test server stopped.');
    }
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runOnboardCateringTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
