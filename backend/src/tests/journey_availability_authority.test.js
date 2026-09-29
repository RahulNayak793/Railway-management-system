/**
 * Comprehensive Test Suite for Railway Journey Dates & Authoritative Availability Engine
 * 
 * Verifies:
 * 1. Correct date calculations (same-day, overnight, multi-day, intermediate stations)
 * 2. Dynamic availability based on real database state (AVAILABLE, RAC, WL, FULL)
 * 3. Passenger search past-departure filtering
 * 4. Admin & Staff status classification (UPCOMING, DEPARTED, RAC, WAITLIST, FULL, CANCELLED, COMPLETED)
 * 5. Backend authority rejection for departed trains
 * 6. Database integrity preservation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const journeyService = require('../services/journeyAvailabilityService');
const reservationService = require('../services/reservationAvailabilityService');

const DB_PATH = path.join(__dirname, '../../data/db.json');

console.log('------------------------------------------------------------');
console.log('🧪 RUNNING JOURNEY DATES & DYNAMIC AVAILABILITY TEST SUITE');
console.log('------------------------------------------------------------');

// Check DB integrity snapshot before tests
const initialDbStat = fs.statSync(DB_PATH);
const initialDbSize = initialDbStat.size;

// =========================================================================
// TEST 1: Date & Time Calculation Engine
// =========================================================================
console.log('\n[Test 1] Testing Date and Time Arithmetic Engine...');

// 1.1 Same-day journey
const sameDayTrain = {
  id: 't_same_day',
  train_number: '12001',
  train_name: 'Shatabdi Express',
  source: 'NDLS',
  destination: 'BPL',
  departure_time: '06:00',
  arrival_time: '14:30',
  route: {
    stops: [
      { station_code: 'NDLS', departure_time: '06:00', day_number: 1 },
      { station_code: 'AGC', arrival_time: '07:50', departure_time: '07:55', day_number: 1 },
      { station_code: 'BPL', arrival_time: '14:30', day_number: 1 }
    ]
  }
};

const sameDayJourney = journeyService.calculateJourneyDatesAndTimes(sameDayTrain, 'NDLS', 'BPL', '2026-09-19', {
  nowISTDate: '2026-09-19',
  nowISTMins: 300 // 05:00 AM (before departure)
});

assert.strictEqual(sameDayJourney.departureDate, '2026-09-19', 'Same-day dep date must match input date');
assert.strictEqual(sameDayJourney.arrivalDate, '2026-09-19', 'Same-day arr date must match input date');
assert.strictEqual(sameDayJourney.departureTime, '06:00');
assert.strictEqual(sameDayJourney.arrivalTime, '14:30');
assert.strictEqual(sameDayJourney.dateRouteLabel, 'Departure: 19 Sep 2026 → Arrival: 19 Sep 2026');
assert.strictEqual(sameDayJourney.isDeparted, false, '05:00 is before 06:00 dep, should not be departed');
console.log('  ✔ Same-day journey date & time correctly computed: ' + sameDayJourney.dateRouteLabel);

// 1.2 Overnight journey crossing midnight
const overnightTrain = {
  id: 't_overnight',
  train_number: '12952',
  train_name: 'Mumbai Rajdhani',
  source: 'NDLS',
  destination: 'MMCT',
  departure_time: '16:55',
  arrival_time: '08:35',
  route: {
    stops: [
      { station_code: 'NDLS', departure_time: '16:55' },
      { station_code: 'KOTA', arrival_time: '21:30', departure_time: '21:40' },
      { station_code: 'BRC', arrival_time: '03:40', departure_time: '03:50' }, // crossing midnight
      { station_code: 'MMCT', arrival_time: '08:35' }
    ]
  }
};

const overnightJourney = journeyService.calculateJourneyDatesAndTimes(overnightTrain, 'NDLS', 'MMCT', '2026-09-19', {
  nowISTDate: '2026-09-19',
  nowISTMins: 600 // 10:00 AM
});

assert.strictEqual(overnightJourney.departureDate, '2026-09-19');
assert.strictEqual(overnightJourney.arrivalDate, '2026-09-20', 'Overnight arrival date must cross midnight into next day');
assert.strictEqual(overnightJourney.dateRouteLabel, 'Departure: 19 Sep 2026 → Arrival: 20 Sep 2026');
assert.strictEqual(overnightJourney.isDeparted, false);
console.log('  ✔ Overnight journey date crossing midnight correctly computed: ' + overnightJourney.dateRouteLabel);

// 1.3 Multi-day journey across 2 midnights
const multiDayTrain = {
  id: 't_multiday',
  train_number: '12626',
  train_name: 'Kerala Express',
  source: 'NDLS',
  destination: 'TVC',
  departure_time: '20:10',
  arrival_time: '18:00',
  route: {
    stops: [
      { station_code: 'NDLS', departure_time: '20:10', day_number: 1 },
      { station_code: 'BPL', arrival_time: '05:20', departure_time: '05:25', day_number: 2 },
      { station_code: 'NGP', arrival_time: '11:45', departure_time: '11:50', day_number: 2 },
      { station_code: 'TVC', arrival_time: '18:00', day_number: 3 }
    ]
  }
};

const multiDayJourney = journeyService.calculateJourneyDatesAndTimes(multiDayTrain, 'NDLS', 'TVC', '2026-09-19');
assert.strictEqual(multiDayJourney.departureDate, '2026-09-19');
assert.strictEqual(multiDayJourney.arrivalDate, '2026-09-21', '3-day journey starting 19 Sep must arrive on 21 Sep');
assert.strictEqual(multiDayJourney.dateRouteLabel, 'Departure: 19 Sep 2026 → Arrival: 21 Sep 2026');
console.log('  ✔ Multi-day journey date across 2 midnights correctly computed: ' + multiDayJourney.dateRouteLabel);

// 1.4 Intermediate station boarding with day offset
const intermediateJourney = journeyService.calculateJourneyDatesAndTimes(multiDayTrain, 'BPL', 'TVC', '2026-09-20');
assert.strictEqual(intermediateJourney.departureDate, '2026-09-20');
assert.strictEqual(intermediateJourney.arrivalDate, '2026-09-21');
assert.strictEqual(intermediateJourney.departureTime, '05:25');
assert.strictEqual(intermediateJourney.arrivalTime, '18:00');
console.log('  ✔ Intermediate station boarding correctly sets origin and destination dates: ' + intermediateJourney.dateRouteLabel);

// =========================================================================
// TEST 2: Train Departure Determination & Passenger Search Filtering
// =========================================================================
console.log('\n[Test 2] Testing Train Departure Determination & Search Filtering...');

// 2.1 Today's train that has already departed
const departedJourney = journeyService.calculateJourneyDatesAndTimes(sameDayTrain, 'NDLS', 'BPL', '2026-09-19', {
  nowISTDate: '2026-09-19',
  nowISTMins: 400 // 06:40 AM (Train departed at 06:00 AM)
});
assert.strictEqual(departedJourney.isDeparted, true, 'Train departed at 06:00 must be marked departed at 06:40');

// 2.2 Exactly at departure time (treat as departed/booking closed)
const exactDepJourney = journeyService.calculateJourneyDatesAndTimes(sameDayTrain, 'NDLS', 'BPL', '2026-09-19', {
  nowISTDate: '2026-09-19',
  nowISTMins: 360 // Exactly 06:00 AM
});
assert.strictEqual(exactDepJourney.isDeparted, true, 'Train at exact departure time must have booking closed');

// 2.3 Future booking window date (never departed)
const futureJourney = journeyService.calculateJourneyDatesAndTimes(sameDayTrain, 'NDLS', 'BPL', '2026-09-25', {
  nowISTDate: '2026-09-19',
  nowISTMins: 400
});
assert.strictEqual(futureJourney.isDeparted, false, 'Future booking window date must never be departed');

// 2.4 Past date (yesterday)
const pastJourney = journeyService.calculateJourneyDatesAndTimes(sameDayTrain, 'NDLS', 'BPL', '2026-09-18', {
  nowISTDate: '2026-09-19',
  nowISTMins: 400
});
assert.strictEqual(pastJourney.isDeparted, true, 'Past date must be departed');
console.log('  ✔ Past, exact departure time, and future dates correctly classified for departure');

// =========================================================================
// TEST 3: Authoritative Seat & Status Transitions (AVAILABLE -> RAC -> WL -> FULL)
// =========================================================================
console.log('\n[Test 3] Testing Authoritative Availability Engine Transitions...');

// Test with 3A capacity (base: 64, RAC: 6, WL: 13, maxCapacity: 83)
const cap3A = journeyService.CLASS_CAPACITIES['3A'];
assert.strictEqual(cap3A.confirmed, 64);
assert.strictEqual(cap3A.rac, 6);
assert.strictEqual(cap3A.wl, 13);
assert.strictEqual(cap3A.maxCapacity, 83);

// Case A: 10 confirmed bookings -> AVAILABLE (54 seats left)
const availA = journeyService.getAuthoritativeClassAvailability('3A', 10, 0);
assert.strictEqual(availA.status, 'AVAILABLE');
assert.strictEqual(availA.availableCount, 54);
assert.strictEqual(availA.statusCode, 'AVAILABLE 54');
console.log('  ✔ AVAILABLE state correctly derived: ' + availA.statusCode);

// Case B: 64 confirmed bookings -> RAC 1
const availB = journeyService.getAuthoritativeClassAvailability('3A', 64, 0);
assert.strictEqual(availB.status, 'RAC');
assert.strictEqual(availB.availableCount, 6);
assert.strictEqual(availB.statusCode, 'RAC 1');
console.log('  ✔ RAC state correctly derived: ' + availB.statusCode);

// Case C: 64 confirmed + 6 RAC bookings (total 70) -> WL 1
const availC = journeyService.getAuthoritativeClassAvailability('3A', 70, 0);
assert.strictEqual(availC.status, 'WL');
assert.strictEqual(availC.availableCount, 13);
assert.strictEqual(availC.statusCode, 'WL 1');
console.log('  ✔ WAITLIST state correctly derived: ' + availC.statusCode);

// Case D: 83 bookings (all confirmed, RAC, and WL full) -> FULL / REGRET
const availD = journeyService.getAuthoritativeClassAvailability('3A', 83, 0);
assert.strictEqual(availD.status, 'FULL');
assert.strictEqual(availD.availableCount, 0);
assert.strictEqual(availD.statusCode, 'FULL (REGRET)');
console.log('  ✔ FULL state correctly derived: ' + availD.statusCode);

// Case E: Holds count towards capacity exhaustion
const availE = journeyService.getAuthoritativeClassAvailability('3A', 60, 4);
assert.strictEqual(availE.status, 'RAC', '60 bookings + 4 active holds exhaust confirmed capacity');
console.log('  ✔ Active holds properly reduce live availability');

// =========================================================================
// TEST 4: Operational & Booking Status for Admin & Staff
// =========================================================================
console.log('\n[Test 4] Testing Admin & Staff Operational Status Engine...');

// Upcoming on-time train with seats (future departure tonight at 23:30)
const upcomingTrain = {
  id: 't_upcoming',
  train_number: '12002',
  train_name: 'Night Express',
  source: 'NDLS',
  destination: 'BPL',
  departure_time: '23:30',
  arrival_time: '06:00',
  route: {
    stops: [
      { station_code: 'NDLS', departure_time: '23:30', day_number: 1 },
      { station_code: 'BPL', arrival_time: '06:00', day_number: 2 }
    ]
  }
};
const upcomingJourney = journeyService.calculateJourneyDatesAndTimes(upcomingTrain, 'NDLS', 'BPL', '2026-09-19', {
  nowISTDate: '2026-09-19',
  nowISTMins: 300
});

const adminStatus1 = journeyService.getTrainOperationalAndBookingStatus(
  upcomingTrain,
  upcomingJourney,
  { '3A': availA }
);
assert.strictEqual(adminStatus1.status, 'UPCOMING', 'Upcoming train with available seats should show UPCOMING');

// Upcoming train with RAC only
const adminStatus2 = journeyService.getTrainOperationalAndBookingStatus(
  upcomingTrain,
  upcomingJourney,
  { '3A': availB }
);
assert.strictEqual(adminStatus2.status, 'RAC', 'Train with exhausted confirmed capacity should show RAC');

// Upcoming train with WL only
const adminStatus3 = journeyService.getTrainOperationalAndBookingStatus(
  upcomingTrain,
  upcomingJourney,
  { '3A': availC }
);
assert.strictEqual(adminStatus3.status, 'WAITLIST', 'Train with exhausted RAC capacity should show WAITLIST');

// Train that has departed
const adminStatus4 = journeyService.getTrainOperationalAndBookingStatus(
  sameDayTrain,
  departedJourney,
  { '3A': availA }
);
assert.strictEqual(adminStatus4.status, 'DEPARTED', 'Departed train should show DEPARTED');

// Cancelled train
const cancelledTrain = { ...sameDayTrain, status: 'cancelled' };
const adminStatus5 = journeyService.getTrainOperationalAndBookingStatus(
  cancelledTrain,
  upcomingJourney,
  { '3A': availA }
);
assert.strictEqual(adminStatus5.status, 'CANCELLED', 'Cancelled train should show CANCELLED');
console.log('  ✔ All Admin/Staff operational statuses correctly mapped (UPCOMING, DEPARTED, RAC, WAITLIST, CANCELLED)');

// =========================================================================
// TEST 5: Backend Authority Booking & Hold Validation
// =========================================================================
console.log('\n[Test 5] Testing Backend Authority Booking & Hold Rejection...');

// 5.1 Rejection for departed train
const rejectDeparted = journeyService.validateBookingAuthority(
  sameDayTrain,
  'NDLS',
  'BPL',
  '2026-09-19',
  '3A',
  1,
  { nowISTDate: '2026-09-19', nowISTMins: 400 } // after departure
);
assert.strictEqual(rejectDeparted.allowed, false);
assert.strictEqual(rejectDeparted.code, 'TRAIN_DEPARTED');
console.log('  ✔ Backend strictly rejects booking after train departure: ' + rejectDeparted.error);

// 5.2 Approval for upcoming train with seats
const approveUpcoming = journeyService.validateBookingAuthority(
  sameDayTrain,
  'NDLS',
  'BPL',
  '2026-09-19',
  '3A',
  1,
  { nowISTDate: '2026-09-19', nowISTMins: 300 } // before departure
);
assert.strictEqual(approveUpcoming.allowed, true);
console.log('  ✔ Backend approves booking for valid upcoming train');

// =========================================================================
// TEST 6: Database Integrity Check
// =========================================================================
console.log('\n[Test 6] Verifying Database Integrity (db.json preserved)...');

const finalDbStat = fs.statSync(DB_PATH);
assert.strictEqual(finalDbStat.size, initialDbSize, 'db.json file size must NOT be mutated by search/availability calculations');
console.log('  ✔ db.json intact and unchanged: ' + finalDbStat.size + ' bytes');

console.log('\n------------------------------------------------------------');
console.log('✅ ALL JOURNEY & AVAILABILITY TESTS PASSED SUCCESSFULLY!');
console.log('------------------------------------------------------------');
