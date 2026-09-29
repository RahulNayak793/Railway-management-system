const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

// Setup isolated test database before loading application modules
const testDbPath = path.join(__dirname, '../../data/test-db.json');
const prodDbPath = path.join(__dirname, '../../data/db.json');

// Copy prodDb to testDb for isolated testing
fs.copyFileSync(prodDbPath, testDbPath);

process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = testDbPath;
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const { isTrainRunningOnDate } = require('../utils/routeSearch');
const { mockDb } = require('../config/supabase');

const PORT = 5195;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function createToken(userId, email, role, permissions = []) {
  const payload = {
    id: userId,
    email,
    role,
    permissions,
    full_name: role.toUpperCase() + ' Test User'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function makeRequest(apiPath, options = {}) {
  const url = `${BASE_URL}${apiPath}`;
  const response = await fetch(url, {
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: response.status, body: json };
}

function computeFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE DATE-SPECIFIC TRAIN VERIFICATION SUITE');
  console.log('======================================================\n');

  try {
    // 0. Verify initial Prod DB Hash
    console.log('Step 0: Recording initial db.json SHA256 integrity...');
    const initialHash = computeFileHash(prodDbPath);
    console.log(`   ✅ Baseline SHA256 recorded: ${initialHash}`);

    // Seed staff profile with schedule management permissions
    const staffId = 'stf-test-datespec-admin';
    mockDb.profiles.set(staffId, {
      id: staffId,
      employee_id: 'EMP-SPEC-1',
      full_name: 'Schedule Manager Staff',
      email: 'sched.mgr@railway.com',
      role: 'staff',
      staff_type: 'Station Master',
      designation: 'Station Master',
      status: 'ACTIVE',
      permissions: ['VIEW_DASHBOARD', 'MANAGE_TRAIN_SCHEDULES', 'ALL']
    });

    const staffToken = createToken(staffId, 'sched.mgr@railway.com', 'staff', ['MANAGE_TRAIN_SCHEDULES', 'ALL']);
    const passengerToken = createToken('usr-datespec-pax', 'pax.datespec@gmail.com', 'passenger');

    await startServer();
    console.log(`   ✅ Test server started on http://127.0.0.1:${PORT}`);

    // 1. Verify existing trains still work
    console.log('\nStep 1: Verifying existing trains keep their recurring schedule/frequency behavior...');
    const existingTrains = Array.from(mockDb.trains.values());
    console.log(`   Found ${existingTrains.length} existing trains in database.`);
    assert.ok(existingTrains.length >= 69, 'Should have at least 69 baseline trains');

    // Verify pre-existing fleet trains are NOT marked as date-specific
    const wronglyMarked = existingTrains.filter(t => !t.is_demo && t.is_date_specific === true);
    assert.strictEqual(wronglyMarked.length, 0, 'No pre-existing fleet trains should be converted into date-specific trains!');
    console.log('   ✅ PASS: Zero existing trains were converted into date-specific trains.');

    // Search for existing train (e.g. 12951 NDLS -> MMCT)
    const existingSearch = await makeRequest('/trains/live-search?source=NDLS&destination=MMCT&date=2026-09-25');
    assert.strictEqual(existingSearch.status, 200);
    const foundExistingTrains = existingSearch.body?.trains || [];
    assert.ok(foundExistingTrains.length > 0, 'Existing trains between NDLS and MMCT should appear in search');
    console.log(`   ✅ PASS: Existing recurring trains appear in search (${foundExistingTrains.length} trains found).`);

    // 2. Create a new train for Date A (2026-09-25)
    console.log('\nStep 2: Creating a NEW train for Date A (2026-09-25)...');
    const testTrainNo = '99991';
    const dateA = '2026-09-25';
    const dateB = '2026-09-26';

    const createPayload = {
      train_number: testTrainNo,
      train_name: 'Shatabdi Date Special',
      train_type: 'Shatabdi',
      source: 'NDLS',
      destination: 'MMCT',
      departure_time: '06:00:00',
      arrival_time: '14:30:00',
      is_date_specific: true,
      journey_date: dateA,
      available_classes: ['CC', 'EC'],
      classes: ['CC', 'EC'],
      food_available: true,
      food_type: 'Both Vegetarian & Non-Vegetarian',
      vegetarian_food_price: 150,
      non_vegetarian_food_price: 220
    };

    const createRes = await makeRequest('/staff/trains/schedule', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` },
      body: createPayload
    });

    assert.strictEqual(createRes.status, 201, `Create train should return 201, got ${createRes.status}: ${JSON.stringify(createRes.body)}`);
    const createdTrain = createRes.body?.train;
    assert.ok(createdTrain, 'Created train object must exist');
    assert.strictEqual(createdTrain.train_number, testTrainNo);
    assert.strictEqual(createdTrain.is_date_specific, true, 'Created train must be marked is_date_specific = true');
    assert.strictEqual(createdTrain.journey_date, dateA, `Created train journey_date must be ${dateA}`);
    console.log(`   ✅ PASS: Created train ${testTrainNo} with is_date_specific=true, journey_date=${dateA}`);

    const trainId = createdTrain.id;

    // 3. Search Date A (2026-09-25) -> Train MUST be present
    console.log('\nStep 3: Verifying Passenger Search on Date A (2026-09-25)...');
    const searchDateA = await makeRequest(`/trains/live-search?source=NDLS&destination=MMCT&date=${dateA}`);
    assert.strictEqual(searchDateA.status, 200);
    const trainsOnDateA = searchDateA.body?.trains || [];
    const matchOnDateA = trainsOnDateA.find(t => (t.train_number || t.trainNo) === testTrainNo);
    assert.ok(matchOnDateA, `Train ${testTrainNo} MUST appear on Date A (${dateA})`);
    console.log(`   ✅ PASS: Train ${testTrainNo} correctly present in search on Date A (${dateA}).`);

    // 4. Search Date B (2026-09-26) -> Train MUST be absent
    console.log('\nStep 4: Verifying Passenger Search on Date B (2026-09-26)...');
    const searchDateB = await makeRequest(`/trains/live-search?source=NDLS&destination=MMCT&date=${dateB}`);
    assert.strictEqual(searchDateB.status, 200);
    const trainsOnDateB = searchDateB.body?.trains || [];
    const matchOnDateB = trainsOnDateB.find(t => (t.train_number || t.trainNo) === testTrainNo);
    assert.strictEqual(matchOnDateB, undefined, `Train ${testTrainNo} MUST be ABSENT on Date B (${dateB})`);
    console.log(`   ✅ PASS: Train ${testTrainNo} is strictly absent on Date B (${dateB}).`);

    // 5. Search other arbitrary date (2026-09-24) -> Train MUST be absent
    console.log('\nStep 5: Verifying Passenger Search on Date 2026-09-24...');
    const searchOther = await makeRequest('/trains/live-search?source=NDLS&destination=MMCT&date=2026-09-24');
    assert.strictEqual(searchOther.status, 200);
    const matchOther = (searchOther.body?.trains || []).find(t => (t.train_number || t.trainNo) === testTrainNo);
    assert.strictEqual(matchOther, undefined, `Train ${testTrainNo} MUST be ABSENT on 2026-09-24`);
    console.log('   ✅ PASS: Train 99991 is absent on non-matching dates.');

    // 5b. Undated Search -> Date-specific train MUST be absent
    console.log('\nStep 5b: Verifying Passenger Search WITHOUT date parameter...');
    const searchUndated = await makeRequest('/trains?source=NDLS&destination=MMCT');
    const matchUndated = (searchUndated.body || []).find(t => (t.train_number || t.trainNo) === testTrainNo);
    assert.strictEqual(matchUndated, undefined, `Train ${testTrainNo} MUST be ABSENT in undated search`);
    console.log('   ✅ PASS: Train 99991 is strictly absent in undated passenger search.');

    // 6a. Unauthorized Staff cannot edit train
    console.log('\nStep 6a: Verifying unauthorized Staff cannot modify train schedule...');
    const unauthStaffToken = createToken('stf-unauth-test', 'unauth.staff@railway.com', 'staff', ['VIEW_DASHBOARD']);
    const unauthUpdateRes = await makeRequest(`/staff/trains/${trainId}/schedule`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${unauthStaffToken}` },
      body: {
        train_number: testTrainNo,
        journey_date: dateB
      }
    });
    assert.strictEqual(unauthUpdateRes.status, 403, 'Unauthorized staff must be rejected with 403 Forbidden');
    console.log('   ✅ PASS: Unauthorized staff rejected with HTTP 403 when attempting edit.');

    // 6. Admin / Staff edits train: change Journey Date from Date A to Date B (2026-09-26)
    console.log('\nStep 6: Editing train: Changing Journey Date from Date A (2026-09-25) to Date B (2026-09-26)...');
    const updateRes = await makeRequest(`/staff/trains/${trainId}/schedule`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${staffToken}` },
      body: {
        train_number: testTrainNo,
        train_name: 'Shatabdi Date Special (Rescheduled)',
        source: 'NDLS',
        destination: 'MMCT',
        departure_time: '06:00:00',
        arrival_time: '14:30:00',
        is_date_specific: true,
        journey_date: dateB
      }
    });

    assert.strictEqual(updateRes.status, 200, `Update should return 200, got: ${JSON.stringify(updateRes.body)}`);
    console.log('   ✅ PASS: Train schedule successfully updated without error.');

    // 7. Verify search behavior after date change:
    // Absent on Date A (2026-09-25), Present on Date B (2026-09-26)
    console.log('\nStep 7: Verifying search behavior after Journey Date modification...');
    const recheckDateA = await makeRequest(`/trains/live-search?source=NDLS&destination=MMCT&date=${dateA}`);
    const matchAfterA = (recheckDateA.body?.trains || []).find(t => (t.train_number || t.trainNo) === testTrainNo);
    assert.strictEqual(matchAfterA, undefined, `Train ${testTrainNo} MUST NO LONGER appear on old Date A (${dateA})`);
    console.log(`   ✅ PASS: Train is no longer found on old Date A (${dateA}).`);

    const recheckDateB = await makeRequest(`/trains/live-search?source=NDLS&destination=MMCT&date=${dateB}`);
    const matchAfterB = (recheckDateB.body?.trains || []).find(t => (t.train_number || t.trainNo) === testTrainNo);
    assert.ok(matchAfterB, `Train ${testTrainNo} MUST NOW appear on new Date B (${dateB})`);
    console.log(`   ✅ PASS: Train is now actively found on new Date B (${dateB}).`);

    // 8. Server-side booking restriction verification
    console.log('\nStep 8: Verifying server-side booking date restrictions...');
    // A. Attempt booking on invalid date (Date A) -> MUST return 400 Bad Request
    const invalidBookingRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: {
        train_id: trainId,
        train_number: testTrainNo,
        coach_class: 'CC',
        class_type: 'CC',
        source: 'NDLS',
        destination: 'MMCT',
        travel_date: dateA, // Train is now assigned to Date B!
        journey_date: dateA,
        passengers: [{ name: 'Test Passenger', age: 30, gender: 'male', berth_preference: 'Window', irctc_id: 'IRCTC_SPEC_1' }]
      }
    });

    assert.strictEqual(invalidBookingRes.status, 400, 'Booking on non-matching date must be rejected with 400 Bad Request');
    assert.ok(
      invalidBookingRes.body?.error?.includes('exclusively') || invalidBookingRes.body?.error?.includes('date-specific') || invalidBookingRes.body?.error?.includes('operates only on'),
      `Error message should explain date mismatch, got: ${invalidBookingRes.body?.error}`
    );
    console.log(`   ✅ PASS: Booking rejected with 400 on non-matching date: "${invalidBookingRes.body?.error}"`);

    // B. Attempt booking on matching date (Date B) -> Should proceed past date check
    const validBookingRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: {
        train_id: trainId,
        train_number: testTrainNo,
        coach_class: 'CC',
        class_type: 'CC',
        source: 'NDLS',
        destination: 'MMCT',
        travel_date: dateB, // Exact matching date!
        journey_date: dateB,
        passengers: [{ name: 'Test Passenger', age: 30, gender: 'male', berth_preference: 'Window', irctc_id: 'IRCTC_SPEC_1' }]
      }
    });

    // Should proceed past date authority check
    assert.notStrictEqual(validBookingRes.status, 400, `Booking on exact journey date should not fail date check. Status: ${validBookingRes.status}, Body: ${JSON.stringify(validBookingRes.body)}`);
    console.log(`   ✅ PASS: Booking on exact Journey Date (${dateB}) accepted past date authority check.`);

    // 9. Verify baseline db.json is bit-for-bit UNTOUCHED
    console.log('\nStep 9: Verifying production db.json has NOT been modified...');
    const currentHash = computeFileHash(prodDbPath);
    assert.strictEqual(currentHash, initialHash, 'Production db.json SHA256 MUST remain identical to baseline!');
    console.log(`   ✅ PASS: Production db.json hash is perfectly preserved (${currentHash}).`);

    console.log('\n🎉 ALL DATE-SPECIFIC TRAIN VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    await stopServer();
    process.exit(1);
  }

  await stopServer();
  // Clean up test DB
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (e) {}

  process.exit(0);
}

runTests();
