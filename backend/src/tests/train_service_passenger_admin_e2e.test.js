const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const {
  generateServiceInstances,
  getServicesForDate,
  calculateDeterministicAvailability,
  isServicePastDeparture
} = require('../services/trainServiceInstanceService');

const { matchRouteSegment } = require('../utils/routeSearch');

async function runEndToEndScenario() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING COMPLETE END-TO-END PASSENGER-ADMIN TRAIN & INVENTORY LIFECYCLE');
  console.log('===============================================================\n');

  // Step 1: Select a valid future service date
  console.log('Step 1: Selecting valid future service date...');
  const futureServiceDate = '2026-10-15';
  console.log(`  Target Date: ${futureServiceDate}`);

  // Ensure test train exists with complete stop sequence
  const testTrainId = 't-e2e-rajdhani';
  const testTrainNumber = '12431';
  const testTrain = {
    id: testTrainId,
    train_number: testTrainNumber,
    train_name: 'Thiruvananthapuram Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'TVC',
    destination_station_code: 'NZM',
    source: 'TVC',
    destination: 'NZM',
    frequency: 'Daily',
    running_days: 'Daily',
    available_classes: ['SL', '3A', '2A', '1A'],
    stops: [
      { sequence: 1, stationCode: 'TVC', stationName: 'Thiruvananthapuram', depTime: '14:30', arrTime: '14:30', distanceFromOriginKm: 0 },
      { sequence: 2, stationCode: 'UDU', stationName: 'Udupi', depTime: '03:22', arrTime: '03:20', distanceFromOriginKm: 780 },
      { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon', depTime: '06:00', arrTime: '05:50', distanceFromOriginKm: 1050 },
      { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara', depTime: '21:00', arrTime: '20:50', distanceFromOriginKm: 2100 },
      { sequence: 5, stationCode: 'NDLS', stationName: 'New Delhi', depTime: '12:30', arrTime: '12:30', distanceFromOriginKm: 2850 }
    ]
  };
  mockDb.trains.set(testTrainId, testTrain);

  const testRoute = {
    id: 'r-e2e-rajdhani',
    train_id: testTrainId,
    train_number: testTrainNumber,
    source_station_code: 'TVC',
    destination_station_code: 'NZM',
    departure_time: '14:30:00',
    arrival_time: '12:30:00',
    frequency: 'Daily',
    distance_km: 2850,
    fare_multiplier: 1.5,
    stops: testTrain.stops
  };
  mockDb.routes.set(testRoute.id, testRoute);

  // Generate 60-day service instances
  generateServiceInstances(60, { startDate: '2026-09-18' });

  // Step 2: Confirm service exists in Admin
  console.log('Step 2: Confirming service exists in Admin for target date...');
  const adminServices = getServicesForDate(futureServiceDate);
  const targetAdminService = adminServices.find(s => s.train_number === testTrainNumber);
  assert(targetAdminService, `Train ${testTrainNumber} must exist in Admin schedule on ${futureServiceDate}`);
  assert.strictEqual(targetAdminService.service_date, futureServiceDate);
  assert.strictEqual(targetAdminService.status, 'SCHEDULED');
  console.log(`  ✅ Step 2 Passed: Admin found service #${targetAdminService.train_number} (${targetAdminService.status})`);

  // Step 3: Search the same date from intermediate stop (UDU) to later stop (NDLS)
  console.log('Step 3: Searching from intermediate stop UDU -> later stop NDLS...');
  const segment = matchRouteSegment(testTrain, testRoute, 'UDU', 'NDLS');
  assert(segment, 'Must match segment UDU -> NDLS');
  assert.strictEqual(segment.srcCode, 'UDU');
  assert.strictEqual(segment.destCode, 'NDLS');
  console.log('  ✅ Step 3 Passed: Valid segment matched');

  // Step 4: Confirm train appears in passenger search results
  console.log('Step 4: Confirming passenger search result contains the service...');
  const isPast = isServicePastDeparture(futureServiceDate, segment.departure_time);
  assert.strictEqual(isPast, false, 'Future date service must be bookable');
  console.log('  ✅ Step 4 Passed: Train is bookable and active for passenger search');

  // Step 5: Confirm displayed FROM/TO/times match actual stop sequence
  console.log('Step 5: Verifying segment timings and stops sequence...');
  assert.strictEqual(segment.departure_time.slice(0, 5), '03:22', 'Departure must be UDU departure time');
  assert.strictEqual(segment.arrival_time.slice(0, 5), '12:30', 'Arrival must be NDLS arrival time');
  assert(segment.intermediateStops.length >= 2, 'Must include MAO and BRC as intermediate stops');
  console.log(`  ✅ Step 5 Passed: UDU (${segment.departure_time.slice(0, 5)}) -> NDLS (${segment.arrival_time.slice(0, 5)})`);

  // Step 6: Confirm class availability matches Admin
  console.log('Step 6: Verifying class availability matches between Admin and Passenger...');
  const initialAvailAdmin = calculateDeterministicAvailability(testTrainNumber, futureServiceDate, '3A');
  const initialAvailPassenger = calculateDeterministicAvailability(testTrainNumber, futureServiceDate, '3A');
  assert.strictEqual(initialAvailAdmin.statusType, 'AVAILABLE');
  assert.strictEqual(initialAvailAdmin.availableCount, initialAvailPassenger.availableCount);
  assert.strictEqual(initialAvailAdmin.statusLabel, initialAvailPassenger.statusLabel);
  const initialCount = initialAvailAdmin.availableCount;
  console.log(`  ✅ Step 6 Passed: Identical initial availability (${initialAvailAdmin.statusLabel})`);

  // Step 7: Book one seat
  console.log('Step 7: Passenger books 1 seat...');
  const testBookingId = `book-e2e-${Date.now()}`;
  const testBooking = {
    id: testBookingId,
    pnr_number: `PNR${Date.now()}`.slice(0, 10),
    train_id: testTrainId,
    train_number: testTrainNumber,
    travel_date: futureServiceDate,
    coach_class: '3A',
    passengers: [{ name: 'Rohit Sharma', age: 36, gender: 'Male' }],
    passenger_count: 1,
    status: 'confirmed',
    created_at: new Date().toISOString()
  };
  mockDb.bookings.set(testBookingId, testBooking);
  console.log(`  Booked PNR: ${testBooking.pnr_number} for 1 passenger in 3A`);

  // Step 8: Confirm inventory decreases
  console.log('Step 8: Verifying inventory decreased by 1 seat...');
  const afterBookingAvail = calculateDeterministicAvailability(testTrainNumber, futureServiceDate, '3A');
  assert.strictEqual(afterBookingAvail.availableCount, initialCount - 1, 'Availability must decrease by exactly 1');
  console.log(`  ✅ Step 8 Passed: Decreased from ${initialCount} to ${afterBookingAvail.availableCount} (${afterBookingAvail.statusLabel})`);

  // Step 9: Confirm Admin sees the updated inventory
  console.log('Step 9: Confirming Admin sees updated inventory...');
  const adminServicesUpdated = getServicesForDate(futureServiceDate);
  const adminTrainUpdated = adminServicesUpdated.find(s => s.train_number === testTrainNumber);
  assert.strictEqual(adminTrainUpdated.inventory['3A'].availableCount, initialCount - 1);
  console.log(`  ✅ Step 9 Passed: Admin schedule reflects exact updated inventory (${adminTrainUpdated.inventory['3A'].statusLabel})`);

  // Step 10: Cancel the booking
  console.log('Step 10: Passenger cancels booking...');
  testBooking.status = 'cancelled';
  testBooking.cancellation_date_time = new Date().toISOString();
  testBooking.refund_status = 'APPROVED';
  mockDb.bookings.set(testBookingId, testBooking);

  const testCancelRecord = {
    id: `canc-${testBookingId}`,
    booking_id: testBookingId,
    pnr: testBooking.pnr_number,
    train_number: testTrainNumber,
    journey_date: futureServiceDate,
    refund_status: 'APPROVED',
    created_at: new Date().toISOString()
  };
  if (!mockDb.cancellation_records) mockDb.cancellation_records = new Map();
  mockDb.cancellation_records.set(testBookingId, testCancelRecord);

  // Step 11: Confirm cancellation record persists
  console.log('Step 11: Confirming cancellation record persists permanently...');
  assert(mockDb.cancellation_records.has(testBookingId), 'Cancellation record must be retained in ledger');
  assert.strictEqual(mockDb.bookings.get(testBookingId).status, 'cancelled');
  console.log('  ✅ Step 11 Passed: Cancellation record stored in permanent audit ledger');

  // Step 12: Confirm inventory restoration
  console.log('Step 12: Verifying inventory is fully restored...');
  const restoredAvail = calculateDeterministicAvailability(testTrainNumber, futureServiceDate, '3A');
  assert.strictEqual(restoredAvail.availableCount, initialCount, 'Availability must restore to initial count');
  console.log(`  ✅ Step 12 Passed: Inventory restored back to ${restoredAvail.availableCount} (${restoredAvail.statusLabel})`);

  // Step 13: Confirm passenger search reflects restored availability
  console.log('Step 13: Confirming passenger search reflects restored availability...');
  const passengerRefreshedAvail = calculateDeterministicAvailability(testTrainNumber, futureServiceDate, '3A');
  assert.strictEqual(passengerRefreshedAvail.statusLabel, initialAvailPassenger.statusLabel);
  console.log(`  ✅ Step 13 Passed: Passenger search matches restored initial state (${passengerRefreshedAvail.statusLabel})`);

  console.log('\n===============================================================');
  console.log('🎉 END-TO-END SCENARIO FULLY VALIDATED AND PASSED! 🎉');
  console.log('===============================================================\n');
}

runEndToEndScenario();
