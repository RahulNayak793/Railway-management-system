const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PORT = 5000;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

function createToken(userId, email, role, permissions = []) {
  const payload = {
    id: userId,
    email,
    role,
    permissions,
    full_name: role.toUpperCase() + ' User'
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
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function runVerification() {
  console.log('======================================================');
  console.log('🧪 RUNNING DEMO TRAINS (UD -> NDLS) & UDUP FIX SUITE');
  console.log('======================================================\n');

  // Test 1: Udupi Station Code
  console.log('Step 1: Verifying Udupi station code is UD in database and stations API...');
  const stRes = await makeRequest('/trains/stations');
  assert.strictEqual(stRes.status, 200, 'Stations API returns 200');
  const stations = Array.isArray(stRes.data) ? stRes.data : (stRes.data.stations || []);
  const udupiStation = stations.find(s => s.station_code === 'UD' || s.code === 'UD');
  assert.ok(udupiStation, 'Station with code "UD" found in stations API');
  assert.strictEqual(udupiStation.station_name || udupiStation.name, 'Udupi', 'Station name is Udupi');
  console.log('   ✅ PASS: Udupi station code is UD and station name is Udupi.');

  // Test 2: Verify Exact Date-Wise Train Counts (23-29 Oct 2026)
  console.log('\nStep 2: Verifying Passenger Search for UD -> NDLS on 23-29 Oct 2026...');
  const expectedDateCounts = [
    { date: '2026-10-23', demoCount: 4, totalCount: 5 },
    { date: '2026-10-24', demoCount: 5, totalCount: 6 },
    { date: '2026-10-25', demoCount: 6, totalCount: 7 },
    { date: '2026-10-26', demoCount: 7, totalCount: 8 },
    { date: '2026-10-27', demoCount: 6, totalCount: 7 },
    { date: '2026-10-28', demoCount: 6, totalCount: 7 },
    { date: '2026-10-29', demoCount: 5, totalCount: 6 }
  ];

  for (const exp of expectedDateCounts) {
    const searchRes = await makeRequest(`/trains/live-search?source=UD&destination=NDLS&date=${exp.date}`);
    assert.strictEqual(searchRes.status, 200, `Live search for ${exp.date} returns 200`);
    const trains = searchRes.data.trains || [];
    const demoTrains = trains.filter(t => t.is_demo || t.is_date_specific);
    const existingTrains = trains.filter(t => !t.is_date_specific && !t.is_demo);

    console.log(`   ${exp.date}: Found ${trains.length} total trains (${existingTrains.length} existing + ${demoTrains.length} demo).`);
    assert.strictEqual(demoTrains.length, exp.demoCount, `Exact demo train count for ${exp.date} must be ${exp.demoCount}`);
    assert.strictEqual(trains.length, exp.totalCount, `Total train count for ${exp.date} must be ${exp.totalCount}`);

    // Verify all demo trains for this date match this exact journey date
    demoTrains.forEach(dt => {
      assert.strictEqual(dt.journey_date, exp.date, `Train ${dt.train_number} journey_date is ${exp.date}`);
      assert.strictEqual(dt.is_date_specific, true, `Train ${dt.train_number} is_date_specific is true`);
    });
  }
  console.log('   ✅ PASS: All 7 dates return exact demo train counts and include existing recurring fleet trains.');

  // Test 3: Cross-Date Isolation
  console.log('\nStep 3: Verifying cross-date isolation...');
  const search23 = await makeRequest('/trains/live-search?source=UD&destination=NDLS&date=2026-10-23');
  const numbers23 = (search23.data.trains || []).map(t => t.train_number);
  const search24 = await makeRequest('/trains/live-search?source=UD&destination=NDLS&date=2026-10-24');
  const numbers24 = (search24.data.trains || []).map(t => t.train_number);

  // 09401 is an Oct 23 demo train. It must not be in Oct 24.
  assert.ok(numbers23.includes('09401'), 'Train 09401 is present on 23 Oct');
  assert.ok(!numbers24.includes('09401'), 'Train 09401 is strictly absent on 24 Oct');

  // 09411 is an Oct 24 demo train. It must not be in Oct 23.
  assert.ok(numbers24.includes('09411'), 'Train 09411 is present on 24 Oct');
  assert.ok(!numbers23.includes('09411'), 'Train 09411 is strictly absent on 23 Oct');

  // Random other date (2026-10-22) must have 0 demo trains
  const search22 = await makeRequest('/trains/live-search?source=UD&destination=NDLS&date=2026-10-22');
  const demo22 = (search22.data.trains || []).filter(t => t.is_demo || t.is_date_specific);
  assert.strictEqual(demo22.length, 0, 'No demo trains appear on 2026-10-22');

  // Random other date (2026-10-30) must have 0 demo trains
  const search30 = await makeRequest('/trains/live-search?source=UD&destination=NDLS&date=2026-10-30');
  const demo30 = (search30.data.trains || []).filter(t => t.is_demo || t.is_date_specific);
  assert.strictEqual(demo30.length, 0, 'No demo trains appear on 2026-10-30');

  console.log('   ✅ PASS: Cross-date isolation verified. Demo trains appear ONLY on their matching date.');

  // Test 4: Undated search API protection
  console.log('\nStep 4: Verifying undated /api/trains search protection...');
  const undatedRes = await makeRequest('/trains?source=UD&destination=NDLS');
  assert.strictEqual(undatedRes.status, 200, 'Undated search returns 200');
  const undatedDemoTrains = (undatedRes.data.trains || []).filter(t => t.is_date_specific || t.is_demo);
  assert.strictEqual(undatedDemoTrains.length, 0, 'Zero date-specific demo trains returned without date parameter');
  console.log('   ✅ PASS: Undated search strictly excludes date-specific demo trains.');

  // Test 5: Server-side Booking Validation
  console.log('\nStep 5: Verifying server-side booking date authority check...');
  const passengerToken = createToken('usr-demo-passenger', 'pax.demo@gmail.com', 'passenger');

  // Attempt booking train 09401 (scheduled for 2026-10-23) with wrong journey date 2026-10-24
  const wrongDateBooking = await makeRequest('/bookings/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${passengerToken}` },
    body: {
      train_id: 't-demo-ud-ndls-09401',
      source: 'UD',
      destination: 'NDLS',
      travel_date: '2026-10-24',
      journey_date: '2026-10-24',
      coach_class: '3A',
      passengers: [{ name: 'Test Traveler', age: 30, gender: 'M', irctc_id: 'IRCTC_TRAVEL_1' }]
    }
  });
  assert.strictEqual(wrongDateBooking.status, 400, 'Booking with mismatched date is rejected with 400');
  assert.ok(wrongDateBooking.data.error.includes('operates exclusively on 2026-10-23'), 'Error message specifies operating date');
  console.log('   ✅ PASS: Booking on non-matching date rejected:', wrongDateBooking.data.error);

  // Attempt booking train 09401 with matching journey date 2026-10-23
  const validDateBooking = await makeRequest('/bookings/book', {
    method: 'POST',
    headers: { Authorization: `Bearer ${passengerToken}` },
    body: {
      train_id: 't-demo-ud-ndls-09401',
      source: 'UD',
      destination: 'NDLS',
      travel_date: '2026-10-23',
      journey_date: '2026-10-23',
      coach_class: '3A',
      passengers: [{ name: 'Valid Traveler', age: 32, gender: 'M', irctc_id: 'IRCTC_TRAVEL_2' }]
    }
  });
  assert.strictEqual(validDateBooking.status, 201, 'Booking with valid date succeeds with 201 Created');
  assert.ok(validDateBooking.data.booking?.pnr_number, 'PNR number generated');
  console.log(`   ✅ PASS: Booking on exact journey date accepted with PNR: ${validDateBooking.data.booking.pnr_number}`);

  // Test 6: Admin and Staff Rescheduling Behavior & RBAC
  console.log('\nStep 6: Verifying Admin/Staff reschedule and RBAC...');
  const unauthorizedStaffToken = createToken('usr-unauth-staff', 'staff.unauth@railway.gov.in', 'staff', ['VIEW_TRAIN_STATUS']);
  const authorizedStaffToken = createToken('usr-auth-staff', 'staff.auth@railway.gov.in', 'staff', ['MANAGE_TRAIN_SCHEDULES']);

  // Unauthorized staff attempting to edit demo train 09509
  const unauthEdit = await makeRequest('/staff/trains/t-demo-ud-ndls-09509/schedule', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${unauthorizedStaffToken}` },
    body: { journey_date: '2026-10-29' }
  });
  assert.strictEqual(unauthEdit.status, 403, 'Unauthorized staff receives 403 Forbidden');
  console.log('   ✅ PASS: Unauthorized staff blocked with 403 Forbidden.');

  // Authorized staff reschedules 09509 from 2026-10-29 to 2026-10-31
  const authEdit = await makeRequest('/staff/trains/t-demo-ud-ndls-09509/schedule', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${authorizedStaffToken}` },
    body: { journey_date: '2026-10-31' }
  });
  assert.strictEqual(authEdit.status, 200, 'Authorized staff successfully updates schedule');
  console.log('   ✅ PASS: Authorized staff rescheduled train 09509 to 2026-10-31.');

  // Verify search on 2026-10-29 no longer has 09509
  const recheck29 = await makeRequest('/trains/live-search?source=UD&destination=NDLS&date=2026-10-29');
  const numbersAfter29 = (recheck29.data.trains || []).map(t => t.train_number);
  assert.ok(!numbersAfter29.includes('09509'), 'Train 09509 no longer returned on 29 Oct');

  // Verify search on 2026-10-31 now contains 09509
  const recheck31 = await makeRequest('/trains/live-search?source=UD&destination=NDLS&date=2026-10-31');
  const numbersAfter31 = (recheck31.data.trains || []).map(t => t.train_number);
  assert.ok(numbersAfter31.includes('09509'), 'Train 09509 actively found on 31 Oct');
  console.log('   ✅ PASS: Rescheduled train cleanly moved from old date to new date in Passenger Search.');

  // Restore 09509 back to 2026-10-29 so all 39 demo trains match their planned dates
  const restoreEdit = await makeRequest('/staff/trains/t-demo-ud-ndls-09509/schedule', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${authorizedStaffToken}` },
    body: { journey_date: '2026-10-29' }
  });
  assert.strictEqual(restoreEdit.status, 200, 'Restored train 09509 back to 2026-10-29');
  console.log('   ✅ PASS: Restored train 09509 back to 2026-10-29.');

  // Test 7: Database Record Integrity Check
  console.log('\nStep 7: Verifying preservation of pre-existing database records...');
  const dbData = JSON.parse(fs.readFileSync('C:/Railway management/backend/data/db.json', 'utf8'));
  const trainsList = dbData.trains ? dbData.trains.map(t => t[1]) : [];
  const nonDemoTrains = trainsList.filter(t => !t.is_demo);
  assert.strictEqual(nonDemoTrains.length, 69, 'All 69 original fleet trains preserved in database');
  console.log(`   ✅ PASS: 69 original fleet trains preserved (Total trains: ${trainsList.length}).`);

  console.log('\n🎉 ALL DEMO TRAINS & UDUP FIX VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runVerification().catch(err => {
  console.error('❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
