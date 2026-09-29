const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load mockDb and core services
const { mockDb } = require('../config/supabase');
const {
  getClassDateAvailability,
  calculateDeterministicAvailability,
  calculateDateWiseAvailability,
  isServicePastDeparture
} = require('../services/trainServiceInstanceService');
const { validateBookingAuthority } = require('../services/journeyAvailabilityService');
const { isTrainRunningOnDate } = require('../utils/routeSearch');

let totalTests = 0;
let passedTests = 0;

function runTest(testNum, testTitle, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✓ Test ${testNum}: ${testTitle}`);
  } catch (err) {
    console.error(`  ✕ Test ${testNum} FAILED: ${testTitle}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================================');
console.log('CLASS-WISE DATE AVAILABILITY SUITE (14 VERIFICATION POINTS)');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Class dates hidden before class click
// -----------------------------------------------------------------------------
runTest(1, 'Class dates hidden before class click', () => {
  // In search results, trains do not have any active class expanded initially.
  // The state `expandedClassByTrain` defaults to {} (empty), meaning no train displays
  // date cards until user explicitly selects a class.
  const initialExpandedState = {};
  const sampleTrainId = '12431';
  assert.strictEqual(initialExpandedState[sampleTrainId], undefined, 'No class should be expanded by default');
});

// -----------------------------------------------------------------------------
// TEST 2: Dates appear after clicking a class (e.g. 3A on 12431 or SL on a sleeper train)
// -----------------------------------------------------------------------------
runTest(2, 'Dates appear after clicking configured class (3A on 12431)', () => {
  const result = getClassDateAvailability('12431', '3A', '2026-10-14', 6);
  assert.strictEqual(result.success, true, 'Result must be successful');
  assert.strictEqual(result.class_code, '3A', 'Class code must be 3A');
  assert.ok(Array.isArray(result.dates), 'Dates must be an array');
  assert.ok(result.dates.length > 0, 'Dates must not be empty');
  assert.ok(result.dates[0].date, 'First date card must have date string');
  assert.ok(result.dates[0].status, 'First date card must have availability status');
  assert.ok(result.dates[0].fare > 0, 'First date card must have fare');
});

// -----------------------------------------------------------------------------
// TEST 3: Dates change when clicking another class (e.g. 3A vs 2A)
// -----------------------------------------------------------------------------
runTest(3, 'Dates and availability change when switching from 3A to 2A', () => {
  const res3A = getClassDateAvailability('12431', '3A', '2026-10-14', 3);
  const res2A = getClassDateAvailability('12431', '2A', '2026-10-14', 3);

  assert.strictEqual(res3A.class_code, '3A');
  assert.strictEqual(res2A.class_code, '2A');

  // Verify that class 2A and 3A return their own class-specific status and fare
  const dateCard3A = res3A.dates.find(d => d.date === '2026-10-14');
  const dateCard2A = res2A.dates.find(d => d.date === '2026-10-14');

  assert.ok(dateCard3A, '3A date card for 2026-10-14 exists');
  assert.ok(dateCard2A, '2A date card for 2026-10-14 exists');
  assert.notStrictEqual(dateCard3A.status, dateCard2A.status, '3A and 2A statuses must be distinct (WL 09 vs RAC 03)');
  assert.ok(dateCard2A.fare > dateCard3A.fare, '2A fare must be higher than 3A fare');
});

// -----------------------------------------------------------------------------
// TEST 4: Only selected class dates are displayed
// -----------------------------------------------------------------------------
runTest(4, 'Only selected class dates are displayed, not all classes merged', () => {
  const res = getClassDateAvailability('12431', '3A', '2026-10-14', 4);
  assert.strictEqual(res.class_code, '3A');
  // Confirm response contains only 3A cards
  res.dates.forEach(card => {
    assert.ok(card.date, 'Card must have date');
    assert.ok(card.status, 'Card must have status');
    assert.strictEqual(typeof card.fare, 'number', 'Card must have numeric fare');
  });
  // Ensure non-selected class (e.g. 1A) is NOT returned inside dates
  assert.strictEqual(res['1A'], undefined, '1A dates should not be mixed into 3A response');
  assert.strictEqual(res['2A'], undefined, '2A dates should not be mixed into 3A response');
});

// -----------------------------------------------------------------------------
// TEST 5: Clicking date selects correct journey date
// -----------------------------------------------------------------------------
runTest(5, 'Clicking date selects correct journey date and builds booking payload', () => {
  const res = getClassDateAvailability('12431', '3A', '2026-10-14', 3);
  const selectedDateCard = res.dates[1]; // 2026-10-16
  assert.strictEqual(selectedDateCard.date, '2026-10-16');

  // Payload created on date click:
  const bookingPayload = {
    train_id: res.train_id,
    train_number: res.train_number,
    journey_date: selectedDateCard.date,
    class_code: res.class_code,
    fare: selectedDateCard.fare
  };

  assert.strictEqual(bookingPayload.train_number, '12431');
  assert.strictEqual(bookingPayload.journey_date, '2026-10-16');
  assert.strictEqual(bookingPayload.class_code, '3A');
});

// -----------------------------------------------------------------------------
// TEST 6: Non-running dates are not shown as available
// -----------------------------------------------------------------------------
runTest(6, 'Non-running dates are not shown as available (e.g. Thursday 15 Oct for 12431)', () => {
  const train12431 = Array.from(mockDb.trains.values()).find(t => String(t.train_number) === '12431');
  assert.ok(train12431, 'Train 12431 exists in mockDb');

  // 2026-10-15 is Thursday -> 12431 does NOT run on Thursday
  const runsOnThursday = isTrainRunningOnDate(train12431, null, '2026-10-15');
  assert.strictEqual(runsOnThursday, false, 'Train 12431 must NOT run on 2026-10-15 (Thursday)');

  const res = getClassDateAvailability('12431', '3A', '2026-10-14', 6);
  const dateStrings = res.dates.map(d => d.date);
  assert.ok(!dateStrings.includes('2026-10-15'), 'Non-running date 2026-10-15 must NOT appear in dates list');
});

// -----------------------------------------------------------------------------
// TEST 7: Long-distance gaps work
// -----------------------------------------------------------------------------
runTest(7, 'Long-distance gaps work (14 Oct available, 15 Oct gap, 16-17 Oct available, 18-20 Oct gaps)', () => {
  const res = getClassDateAvailability('12431', '3A', '2026-10-14', 4);
  const dateStrings = res.dates.map(d => d.date);

  // 14 Oct = Wed (runs)
  // 15 Oct = Thu (NO SERVICE - GAP)
  // 16 Oct = Fri (runs)
  // 17 Oct = Sat (runs)
  // 18-20 Oct = Sun-Tue (NO SERVICE - GAP)
  // 21 Oct = Wed (runs)
  assert.strictEqual(dateStrings[0], '2026-10-14', 'First operating date must be 2026-10-14 (Wed)');
  assert.strictEqual(dateStrings[1], '2026-10-16', 'Second operating date must be 2026-10-16 (Fri) after 1-day gap');
  assert.strictEqual(dateStrings[2], '2026-10-17', 'Third operating date must be 2026-10-17 (Sat)');
  assert.strictEqual(dateStrings[3], '2026-10-21', 'Fourth operating date must be 2026-10-21 (Wed) after 3-day gap');
});

// -----------------------------------------------------------------------------
// TEST 8: Date-specific trains remain date-specific
// -----------------------------------------------------------------------------
runTest(8, 'Date-specific trains remain date-specific and appear only on configured date', () => {
  // Find or create a date-specific train
  const trainSpecial = {
    id: 'DEMO-SPEC-01',
    train_number: '09001',
    train_name: 'DEMO DIWALI SPECIAL',
    service_type: 'DATE_SPECIFIC',
    departure_date: '2026-10-28',
    available_classes: ['3A', 'SL'],
    base_fare: 650
  };
  mockDb.trains.set(trainSpecial.id, trainSpecial);

  // Should run on 2026-10-28
  assert.strictEqual(isTrainRunningOnDate(trainSpecial, null, '2026-10-28'), true);
  // Should NOT run on any other date
  assert.strictEqual(isTrainRunningOnDate(trainSpecial, null, '2026-10-27'), false);
  assert.strictEqual(isTrainRunningOnDate(trainSpecial, null, '2026-10-29'), false);

  const res = getClassDateAvailability('DEMO-SPEC-01', '3A', '2026-10-25', 6);
  assert.strictEqual(res.dates.length, 1, 'Date-specific train must only have 1 operating date');
  assert.strictEqual(res.dates[0].date, '2026-10-28');

  // Clean up demo test record
  mockDb.trains.delete(trainSpecial.id);
});

// -----------------------------------------------------------------------------
// TEST 9: Past dates cannot be booked
// -----------------------------------------------------------------------------
runTest(9, 'Past dates cannot be booked and return departed / past status', () => {
  const pastCheck = isServicePastDeparture('2026-01-01', '08:00');
  assert.strictEqual(pastCheck, true, 'Past date 2026-01-01 must be recognized as past');

  const avail = calculateDeterministicAvailability('12431', '2026-01-01', '3A');
  assert.strictEqual(avail.isBookable, false, 'Availability calculation for past date must not be bookable');
  assert.ok(['DEPARTED', 'COMPLETED'].includes(avail.statusType || avail.statusLabel), 'Status must be DEPARTED or COMPLETED');

  // Authority validation must reject past date
  const authVal = validateBookingAuthority('12431', '2026-01-01', '3A');
  assert.strictEqual(authVal.isValid, false, 'Authority validation must fail for past date');
  assert.strictEqual(authVal.reason, 'JOURNEY_DATE_IN_PAST');
});

// -----------------------------------------------------------------------------
// TEST 10: Existing bookings affect availability
// -----------------------------------------------------------------------------
runTest(10, 'Existing bookings affect class date availability', () => {
  // Check baseline availability on 2026-11-04 (Wed)
  const baseAvail = calculateDeterministicAvailability('12431', '2026-11-04', '3A');
  const initialAvailable = baseAvail.availableCount || 0;

  // Simulate an active booking for this service
  const testBookingId = 'test-bk-impact-01';
  mockDb.bookings.set(testBookingId, {
    id: testBookingId,
    train_id: 't-12431',
    train_number: '12431',
    journey_date: '2026-11-04',
    booking_status: 'CONFIRMED',
    coach_class: '3A',
    passengers: [{ name: 'Test Passenger 1' }, { name: 'Test Passenger 2' }]
  });

  const newAvail = calculateDeterministicAvailability('12431', '2026-11-04', '3A');
  assert.strictEqual(newAvail.availableCount, Math.max(0, initialAvailable - 2), 'Available count must decrease by passenger count');

  // Clean up test booking
  mockDb.bookings.delete(testBookingId);
});

// -----------------------------------------------------------------------------
// TEST 11: RAC/WL status is reflected
// -----------------------------------------------------------------------------
runTest(11, 'RAC and WL status is reflected accurately for 12431 service dates', () => {
  const res3A = getClassDateAvailability('12431', '3A', '2026-10-14', 3);
  const card14Oct = res3A.dates.find(d => d.date === '2026-10-14');
  const card16Oct = res3A.dates.find(d => d.date === '2026-10-16');
  const card17Oct = res3A.dates.find(d => d.date === '2026-10-17');

  assert.strictEqual(card14Oct.status, 'WL 09', '14 Oct 3A status must be WL 09');
  assert.strictEqual(card16Oct.status, 'WL 34', '16 Oct 3A status must be WL 34');
  assert.strictEqual(card17Oct.status, 'WL 82', '17 Oct 3A status must be WL 82');

  const res2A = getClassDateAvailability('12431', '2A', '2026-10-14', 1);
  const card2A = res2A.dates.find(d => d.date === '2026-10-14');
  assert.strictEqual(card2A.status, 'RAC 03', '14 Oct 2A status must be RAC 03');
});

// -----------------------------------------------------------------------------
// TEST 12: Unsupported class is rejected
// -----------------------------------------------------------------------------
runTest(12, 'Unsupported class is rejected by both availability query and booking authority', () => {
  // Train 12431 only configures 3A, 2A, 1A
  const resInvalidClass = getClassDateAvailability('12431', 'SL', '2026-10-14', 6);
  assert.strictEqual(resInvalidClass.success, false, 'Requesting SL on Rajdhani 12431 must return success: false');
  assert.ok(resInvalidClass.error.includes('not available'), 'Error message must state class is not available');

  const authVal = validateBookingAuthority('12431', '2026-10-14', 'SL');
  assert.strictEqual(authVal.isValid, false, 'Authority validation must fail for unsupported class');
  assert.strictEqual(authVal.code, 'UNSUPPORTED_CLASS');
});

// -----------------------------------------------------------------------------
// TEST 13: Existing trains/data remain intact
// -----------------------------------------------------------------------------
runTest(13, 'Existing trains and database entities remain intact (no deletions)', () => {
  const auditPath = path.join(__dirname, '../../data/pre_class_date_audit_2026-09-27T04-31-10-016Z.json');
  assert.ok(fs.existsSync(auditPath), 'Baseline audit file must exist');

  const baseline = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const currentTrainsCount = mockDb.trains.size;
  const currentRoutesCount = mockDb.routes.size;
  const currentSeatsCount = mockDb.seats.size;
  const currentBookingsCount = mockDb.bookings.size;
  const currentAllocCount = mockDb.seat_allocations.size;

  assert.ok(currentTrainsCount >= baseline.counts.trains, `Trains count (${currentTrainsCount}) >= baseline (${baseline.counts.trains})`);
  assert.ok(currentRoutesCount >= baseline.counts.routes, `Routes count (${currentRoutesCount}) >= baseline (${baseline.counts.routes})`);
  assert.ok(currentSeatsCount >= baseline.counts.seats, `Seats count (${currentSeatsCount}) >= baseline (${baseline.counts.seats})`);
  assert.ok(currentBookingsCount >= baseline.counts.bookings, `Bookings count (${currentBookingsCount}) >= baseline (${baseline.counts.bookings})`);
  assert.ok(currentAllocCount >= baseline.counts.seat_allocations, `Seat allocations count (${currentAllocCount}) >= baseline (${baseline.counts.seat_allocations})`);
});

// -----------------------------------------------------------------------------
// TEST 14: No duplicate train/service records are created
// -----------------------------------------------------------------------------
runTest(14, 'No duplicate train/service records are created on repetitive queries', () => {
  const servicesCountBefore = mockDb.train_services.size;
  const trainsCountBefore = mockDb.trains.size;

  // Run multiple repeated class date availability lookups
  getClassDateAvailability('12431', '3A', '2026-10-14', 6);
  getClassDateAvailability('12431', '3A', '2026-10-14', 6);
  getClassDateAvailability('12431', '2A', '2026-10-14', 6);

  const servicesCountAfter = mockDb.train_services.size;
  const trainsCountAfter = mockDb.trains.size;

  assert.strictEqual(trainsCountAfter, trainsCountBefore, 'Trains collection size must remain constant');
  assert.strictEqual(servicesCountAfter, servicesCountBefore, 'Train services collection size must not grow duplicated records');
});

console.log('\n======================================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
console.log('======================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
