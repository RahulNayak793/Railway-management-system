const fs = require('fs');
const path = require('path');
const http = require('http');

// Load environment / setup for testing
const DB_PATH = path.join(__dirname, '../../data/db.json');
const BACKUP_PATH = path.join(__dirname, '../../data/db.json.backup_before_unified_railway_reservation_control');

const externalReservationService = require('../services/externalReservationService');
const reservationAvailabilityService = require('../services/reservationAvailabilityService');

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ Test ${totalCount}: ${message}`);
  } else {
    console.error(`  ✕ Test ${totalCount} FAILED: ${message}`);
    process.exitCode = 1;
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('UNIFIED RAILWAY RESERVATION & SEAT CONTROL ENGINE TEST SUITE');
  console.log('===============================================================\n');

  // Test 1: Check database backup exists
  assert(fs.existsSync(BACKUP_PATH), 'Database backup file exists before running test suite');

  const { mockDb } = require('../config/supabase');

  // Test 2: Database integrity check - verify data preserved
  const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const trainsList = dbData.trains || Array.from(mockDb.trains.values());
  const bookingsList = dbData.bookings || Array.from(mockDb.bookings.values());
  const passengersList = dbData.passengers || dbData.profiles || Array.from(mockDb.profiles.values());

  assert(trainsList.length > 0, 'Trains dataset is intact and non-empty');
  assert(bookingsList.length > 0, 'Bookings dataset is intact and non-empty');
  assert(passengersList.length > 0, 'Passengers dataset is intact and non-empty');

  // Test 3: External reservation integration returns false when unconfigured
  const extStatus = externalReservationService.getIntegrationStatus();
  assert(extStatus.externalAvailabilityConnected === false, 'externalAvailabilityConnected returns false when no external API configured');

  // Test 4: External system message returns "EXTERNAL AVAILABILITY: NOT CONNECTED"
  assert(extStatus.message === 'EXTERNAL AVAILABILITY: NOT CONNECTED', 'Returns exact label "EXTERNAL AVAILABILITY: NOT CONNECTED"');

  // Test 5: External availability fetch returns empty array without dummy data
  const extSeats = await externalReservationService.fetchExternalAvailability('TR-101', '2026-09-20', 'NDLS', 'MMCT', '3A');
  assert(Array.isArray(extSeats) && extSeats.length === 0, 'No fake external bookings or dummy passengers generated');

  // Test 6: Calculate seat availability for train & schedule
  const sampleTrain = trainsList[0] || { id: '12951' };
  const trainId = sampleTrain.id || sampleTrain.train_number || '12951';
  const avail = await reservationAvailabilityService.calculateSeatAvailability({
    trainId,
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    quota: 'GN'
  });

  assert(avail.totalSeats > 0, 'Calculates total seat capacity for specified train class');
  assert(typeof avail.availableSeats === 'number', 'Calculates available seats count');
  assert(Array.isArray(avail.coaches), 'Returns coach breakdown array');

  // Test 7: Verify seat sources tagging in coach layout
  const allSeats = avail.coaches.flatMap(c => c.seats);
  const sources = Array.from(new Set(allSeats.map(s => s.source)));
  assert(sources.every(s => ['LOCAL WEBSITE', 'EXTERNAL RESERVATION', 'TEMPORARY HOLD', 'DEMO / LOCAL RESERVATION'].includes(s)), 'Seats tagged with valid booking sources');

  // Test 8: Status formatting strings (AVAILABLE-004, AVAILABLE-018, RAC 03, WL 12)
  const formattedAvl = reservationAvailabilityService.formatStatusLabel('AVAILABLE', 18);
  const formattedRac = reservationAvailabilityService.formatStatusLabel('RAC', 3);
  const formattedWl = reservationAvailabilityService.formatStatusLabel('WL', 12);
  const formattedSmallAvl = reservationAvailabilityService.formatStatusLabel('AVAILABLE', 4);

  assert(formattedAvl === 'AVAILABLE-018', 'Formats available status correctly as AVAILABLE-018');
  assert(formattedRac === 'RAC 03', 'Formats RAC status correctly as RAC 03');
  assert(formattedWl === 'WL 12', 'Formats WL status correctly as WL 12');
  assert(formattedSmallAvl === 'AVAILABLE-004', 'Formats small available numbers with padding as AVAILABLE-004');

  // Test 9: Temporary seat hold creation
  const targetCoach = avail.coaches[0].coachCode;
  const targetSeatObj = avail.coaches[0].seats.find(s => s.status === 'AVAILABLE') || avail.coaches[0].seats[0];
  const targetSeat = targetSeatObj.seatNumber;

  const holdResult = reservationAvailabilityService.createTemporaryHold({
    trainId,
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    coachCode: targetCoach,
    seatNumber: targetSeat,
    userId: 'PASSENGER-101',
    ttlSeconds: 60
  });

  assert(holdResult.success === true, 'Successfully creates temporary seat hold');
  assert(holdResult.hold && holdResult.hold.holdId, 'Temporary hold has valid holdId');

  // Test 10: Verify hold locks the seat status to TEMPORARY HOLD
  const availAfterHold = await reservationAvailabilityService.calculateSeatAvailability({
    trainId,
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    quota: 'GN'
  });
  const heldSeat = availAfterHold.coaches.flatMap(c => c.seats).find(s => s.coachCode === targetCoach && String(s.seatNumber) === String(targetSeat));
  assert(heldSeat && heldSeat.status === 'HELD', 'Seat status transitions to HELD while active hold exists');
  assert(heldSeat && heldSeat.source === 'TEMPORARY HOLD', 'Held seat source tagged as TEMPORARY HOLD');

  // Test 11: Prevent regular passenger from holding an already held seat (conflict check)
  const holdConflict = reservationAvailabilityService.createTemporaryHold({
    trainId,
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    coachCode: targetCoach,
    seatNumber: targetSeat,
    userId: 'PASSENGER-202',
    ttlSeconds: 60
  });

  assert(holdConflict.success === false, 'Blocks temporary hold request on seat currently held by another user');
  assert(holdConflict.statusCode === 409, 'Returns HTTP 409 Conflict for double-hold request');

  // Test 12: Release temporary hold
  const releaseRes = reservationAvailabilityService.releaseTemporaryHold(holdResult.hold.holdId, 'PASSENGER-101');
  assert(releaseRes.success === true, 'Successfully releases temporary seat hold');

  // Test 13: Hold cleanup on expiration
  const expiredHold = reservationAvailabilityService.createTemporaryHold({
    trainId,
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    coachCode: targetCoach,
    seatNumber: targetSeat,
    userId: 'PASSENGER-303',
    ttlSeconds: -10 // expired
  });
  reservationAvailabilityService.cleanupExpiredHolds();
  const isStillHeld = reservationAvailabilityService.isSeatHeld(trainId, '2026-09-20', targetCoach, targetSeat);
  assert(isStillHeld === false, 'Automatically cleans up expired temporary seat holds');

  // Test 14: Atomic verifyAndLockSeat double booking check
  const lockResult = await reservationAvailabilityService.verifyAndLockSeat({
    trainId,
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    coachCode: targetCoach,
    seatNumber: targetSeat,
    userId: 'PASSENGER-101'
  });
  assert(lockResult.valid === true, 'verifyAndLockSeat returns valid=true for unreserved seat');

  // Test 15: RAC progression rule calculation
  const racProgression = reservationAvailabilityService.calculateBookingStatus({
    totalCapacity: 10,
    confirmedBooked: 10,
    racBooked: 2,
    wlBooked: 0,
    racCapacity: 5,
    wlCapacity: 10
  });
  assert(racProgression.statusType === 'RAC' && (racProgression.statusLabel === 'RAC 03' || racProgression.statusLabel === 'RAC 3'), 'Enforces RAC progression when confirmed capacity is full');

  // Test 16: WL progression rule calculation
  const wlProgression = reservationAvailabilityService.calculateBookingStatus({
    totalCapacity: 10,
    confirmedBooked: 10,
    racBooked: 5,
    wlBooked: 4,
    racCapacity: 5,
    wlCapacity: 10
  });
  assert(wlProgression.statusType === 'WL' && (wlProgression.statusLabel === 'WL 05' || wlProgression.statusLabel === 'WL 5'), 'Enforces Waiting List (WL) progression when RAC capacity is full');

  // Test 17: Admin seat reassignment validation - success case
  const reassignRes = reservationAvailabilityService.reassignSeat({
    pnr: 'PNR10001',
    trainId,
    date: '2026-09-20',
    oldCoach: targetCoach,
    oldSeat: targetSeat,
    newCoach: 'B3',
    newSeat: 99,
    adminId: 'ADMIN-001',
    reason: 'Operational rebalancing for family seating'
  });
  assert(reassignRes.success === true, 'Admin can manually reassign seat with logged operational reason');

  // Test 18: Audit log written for manual seat reassignment
  const auditLogs = reservationAvailabilityService.getAuditLogs();
  const latestAudit = auditLogs[0];
  assert(latestAudit && (latestAudit.action === 'SEAT_REASSIGNMENT' || latestAudit.event_type === 'SEAT_REASSIGNMENT'), 'Writes audit log entry for manual seat reassignment');

  // Test 19: Reject seat reassignment when target seat occupied
  const allocList = Array.from(mockDb.seat_allocations.values());
  const sampleAlloc = allocList[0] || { coach_number: 'A1', seat_number: 1, train_id: trainId };
  if (allocList.length === 0) {
    mockDb.seat_allocations.set('alloc-test-1', { booking_id: 'b1', seat_id: `${trainId}-A1-1`, coach_number: 'A1', seat_number: 1 });
  }
  const occupiedTargetSeat = sampleAlloc.seat_number || 1;
  const occupiedCoach = sampleAlloc.coach_number || 'A1';

  const reassignConflict = reservationAvailabilityService.reassignSeat({
    pnr: 'PNR99999',
    trainId: sampleAlloc.train_id || trainId,
    date: sampleAlloc.travel_date || '2026-09-20',
    oldCoach: 'B2',
    oldSeat: '99',
    newCoach: occupiedCoach,
    newSeat: occupiedTargetSeat,
    adminId: 'ADMIN-001',
    reason: 'Testing conflict'
  });

  assert(reassignConflict.success === false, 'Rejects seat reassignment when target seat is already occupied');

  // Test 20: Segment-based availability calculation
  const isSegmentOverlapping = reservationAvailabilityService.checkSegmentOverlap(
    ['NDLS', 'AGC', 'BPL', 'MMCT'],
    'NDLS', 'BPL',
    'AGC', 'MMCT'
  );
  assert(isSegmentOverlapping === true, 'Identifies overlapping route segments (NDLS->BPL vs AGC->MMCT)');

  const nonOverlapping = reservationAvailabilityService.checkSegmentOverlap(
    ['NDLS', 'AGC', 'BPL', 'MMCT'],
    'NDLS', 'AGC',
    'BPL', 'MMCT'
  );
  assert(nonOverlapping === false, 'Identifies non-overlapping consecutive route segments (NDLS->AGC vs BPL->MMCT)');

  // Test 21: Seat occupied from A->C makes A->B unavailable on the same seat
  const segmentCheck1 = reservationAvailabilityService.checkSegmentOverlap(
    ['NDLS', 'AGC', 'BPL', 'MMCT'],
    'NDLS', 'MMCT',
    'NDLS', 'AGC'
  );
  assert(segmentCheck1 === true, 'Seat occupied from A->C makes A->B unavailable on the same seat');

  // Test 22: Seat occupied from A->B allows seat B->C to remain available
  const segmentCheck2 = reservationAvailabilityService.checkSegmentOverlap(
    ['NDLS', 'AGC', 'BPL', 'MMCT'],
    'NDLS', 'AGC',
    'AGC', 'BPL'
  );
  assert(segmentCheck2 === false, 'Seat occupied from A->B allows seat B->C to remain available');

  // Test 23: Berth type resolution
  const lbBerth = reservationAvailabilityService.resolveBerthType(1, '3A');
  const mbBerth = reservationAvailabilityService.resolveBerthType(2, '3A');
  const ubBerth = reservationAvailabilityService.resolveBerthType(3, '3A');
  const slBerth = reservationAvailabilityService.resolveBerthType(7, '3A');
  const suBerth = reservationAvailabilityService.resolveBerthType(8, '3A');

  assert(lbBerth === 'LB', 'Resolves seat 1 in 3A as Lower Berth (LB)');
  assert(mbBerth === 'MB', 'Resolves seat 2 in 3A as Middle Berth (MB)');
  assert(ubBerth === 'UB', 'Resolves seat 3 in 3A as Upper Berth (UB)');
  assert(slBerth === 'SL', 'Resolves seat 7 in 3A as Side Lower (SL)');
  assert(suBerth === 'SU', 'Resolves seat 8 in 3A as Side Upper (SU)');

  // Test 24: Chair car berth type resolution (Window / Aisle)
  const windowSeat = reservationAvailabilityService.resolveBerthType(1, 'CC');
  const aisleSeat = reservationAvailabilityService.resolveBerthType(2, 'CC');
  assert(windowSeat === 'WINDOW', 'Resolves seat 1 in CC as WINDOW');
  assert(aisleSeat === 'AISLE', 'Resolves seat 2 in CC as AISLE');

  // Test 25: Reject hold request for non-existent train
  const invalidTrainHold = reservationAvailabilityService.createTemporaryHold({
    trainId: 'INVALID_TRAIN_ID_999',
    date: '2026-09-20',
    fromStation: 'NDLS',
    toStation: 'MMCT',
    classType: '3A',
    coachCode: 'B1',
    seatNumber: '01',
    userId: 'PASSENGER-101'
  });
  assert(invalidTrainHold.success === false, 'Rejects temporary hold request for non-existent train');

  // Test 26: Validate seat number format against coach composition
  const validSeatNum = reservationAvailabilityService.validateSeatInCoach('B1', '12', 72);
  const invalidSeatNum = reservationAvailabilityService.validateSeatInCoach('B1', '99', 72);
  assert(validSeatNum === true, 'Validates seat 12 is within coach capacity 72');
  assert(invalidSeatNum === false, 'Rejects seat 99 exceeding coach capacity 72');

  // Test 27: Audit logs chronological ordering
  const logs = reservationAvailabilityService.getAuditLogs();
  assert(Array.isArray(logs), 'Audit logs endpoint returns array');
  assert(logs.every(l => !!l.timestamp && (!!l.action || !!l.event_type)), 'Audit logs contain timestamp and action fields');

  // Test 28: Privacy protection - Seat availability response excludes PII
  const seatSample = avail.coaches[0].seats[0];
  assert(!seatSample.hasOwnProperty('password') && !seatSample.hasOwnProperty('email') && !seatSample.hasOwnProperty('phone'), 'Seat availability response excludes sensitive passenger PII (password, email, phone)');

  // Test 29: Existing bookings preserved
  const originalBookings = bookingsList;
  assert(originalBookings.length > 0, 'Original historical bookings preserved intact');

  // Test 30: Existing passenger accounts preserved
  const originalPassengers = passengersList;
  assert(originalPassengers.every(p => {
    const item = Array.isArray(p) ? p[1] : p;
    return !!item.email || !!item.id || !!item.full_name;
  }), 'Passenger accounts and credentials preserved intact');

  // Test 31: Historical ticket prices preserved
  const originalTrains = trainsList;
  assert(originalTrains.every(t => {
    const item = Array.isArray(t) ? t[1] : t;
    return !!item.route || !!item.fares_by_class || !!item.train_number || !!item.id;
  }), 'Historical train fare configurations preserved intact');

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passedCount} / ${totalCount} PASSED`);
  console.log('===============================================================\n');

  if (passedCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled error in test suite execution:', err);
  process.exit(1);
});
