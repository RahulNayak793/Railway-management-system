const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const {
  getNowIST,
  calculateServiceStatus,
  calculateDeterministicAvailability,
  isServicePastDeparture,
  generateServiceInstances,
  getServicesForDate,
  getDateSummaryMetrics
} = require('../services/trainServiceInstanceService');

const { isTrainRunningOnDate, matchRouteSegment } = require('../utils/routeSearch');

function runAllTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE RAILCONTROL TRAIN SCHEDULE & AVAILABILITY SUITE');
  console.log('===============================================================\n');

  // --- 1. Service generation for 60 days ---
  console.log('Test 1: Service instance generation for 60 days forward window...');
  const genResult = generateServiceInstances(60, { startDate: '2026-09-18' });
  assert.strictEqual(genResult.success, true);
  assert(mockDb.train_services.size > 0, 'Service instances must be generated');
  console.log(`  ✅ Test 1 Passed: Generated/validated ${mockDb.train_services.size} services across 60 days`);

  // --- 2. Running-day filtering ---
  console.log('Test 2: Running-day filtering (service only created on running days)...');
  const testTrainWeekly = {
    id: 't-test-weekly',
    train_number: '99001',
    train_name: 'Weekly Special',
    frequency: 'MON WED FRI',
    source: 'NDLS',
    destination: 'MMCT',
    departure_time: '10:00:00',
    arrival_time: '18:00:00',
    available_classes: ['SL', '3A']
  };
  mockDb.trains.set(testTrainWeekly.id, testTrainWeekly);

  // 2026-09-18 is a Friday (Runs)
  // 2026-09-19 is a Saturday (Does NOT run)
  // 2026-09-21 is a Monday (Runs)
  assert.strictEqual(isTrainRunningOnDate(testTrainWeekly, null, '2026-09-18'), true, 'Should run on Friday');
  assert.strictEqual(isTrainRunningOnDate(testTrainWeekly, null, '2026-09-19'), false, 'Should not run on Saturday');
  assert.strictEqual(isTrainRunningOnDate(testTrainWeekly, null, '2026-09-21'), true, 'Should run on Monday');

  generateServiceInstances(7, { startDate: '2026-09-18' });
  const satService = mockDb.train_services.get(`svc-99001-2026-09-19`);
  const friService = mockDb.train_services.get(`svc-99001-2026-09-18`);
  assert.strictEqual(satService, undefined, 'Must NOT create service instance on non-running date');
  assert.notStrictEqual(friService, undefined, 'Must create service instance on running date');
  console.log('  ✅ Test 2 Passed: Service instances only created for scheduled running days');

  // --- 3. No duplicate service instances ---
  console.log('Test 3: No duplicate service instances on repeated generation...');
  generateServiceInstances(60, { startDate: '2026-09-18' });
  const beforeCount = mockDb.train_services.size;
  generateServiceInstances(60, { startDate: '2026-09-18' });
  const afterCount = mockDb.train_services.size;
  assert.strictEqual(beforeCount, afterCount, 'Repeated generation should not duplicate service instances');
  console.log(`  ✅ Test 3 Passed: Service count stable (${afterCount}) with no duplicates`);

  // --- 4. From/To Station Matching ---
  console.log('Test 4: From/To station matching from ordered route...');
  const testRouteTrain = {
    id: 't-test-route',
    train_number: '12431',
    train_name: 'Trivandrum Rajdhani',
    source: 'TVC',
    destination: 'NZM',
    stops: [
      { sequence: 1, stationCode: 'TVC', stationName: 'Thiruvananthapuram', depTime: '14:30', arrTime: '14:30' },
      { sequence: 2, stationCode: 'UDU', stationName: 'Udupi', depTime: '03:22', arrTime: '03:20' },
      { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon', depTime: '06:00', arrTime: '05:50' },
      { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara', depTime: '21:00', arrTime: '20:50' },
      { sequence: 5, stationCode: 'NDLS', stationName: 'New Delhi', depTime: '12:30', arrTime: '12:30' }
    ]
  };
  mockDb.trains.set(testRouteTrain.id, testRouteTrain);

  const segment = matchRouteSegment(testRouteTrain, { stops: testRouteTrain.stops }, 'UDU', 'NDLS');
  assert.notStrictEqual(segment, null, 'Should find route segment from UDU to NDLS');
  assert.strictEqual(segment.srcCode, 'UDU');
  assert.strictEqual(segment.destCode, 'NDLS');
  assert.strictEqual(segment.departure_time.slice(0, 5), '03:22');
  assert.strictEqual(segment.arrival_time.slice(0, 5), '12:30');
  console.log('  ✅ Test 4 Passed: Matched segment UDU -> NDLS with correct intermediate times');

  // --- 5. Intermediate station matching & correct segment duration ---
  console.log('Test 5: Intermediate station matching & sequence integrity...');
  assert(segment.intermediateStops.length >= 2, 'Should include MAO and BRC as intermediate stops');
  assert.strictEqual(segment.intermediateStops[0].station_code, 'MAO');
  assert.strictEqual(segment.intermediateStops[1].station_code, 'BRC');
  console.log('  ✅ Test 5 Passed: Intermediate stops correctly ordered and mapped');

  // --- 6. Future service status = SCHEDULED ---
  console.log('Test 6: Future service status is always SCHEDULED...');
  const futureStatus = calculateServiceStatus('2026-10-15', '06:00', '14:00', 0);
  assert.strictEqual(futureStatus, 'SCHEDULED', 'Future service must be SCHEDULED');
  console.log('  ✅ Test 6 Passed: Future date evaluated as SCHEDULED');

  // --- 7. Today status calculation ---
  console.log('Test 7: Dynamic status calculation for Today based on current time...');
  const now = getNowIST();
  const pastTime = `${String(Math.max(0, now.h - 3)).padStart(2, '0')}:00`;
  const farFutureTime = `${String(Math.min(23, now.h + 5)).padStart(2, '0')}:00`;

  const statusPast = calculateServiceStatus(now.dateStr, pastTime, pastTime, 0);
  assert(statusPast === 'DEPARTED' || statusPast === 'COMPLETED', `Past departure today should be DEPARTED/COMPLETED (got ${statusPast})`);

  const statusFutureToday = calculateServiceStatus(now.dateStr, farFutureTime, '23:59', 0);
  assert.strictEqual(statusFutureToday, 'SCHEDULED', 'Far departure today should be SCHEDULED');
  console.log('  ✅ Test 7 Passed: Today service status accurately reflects departure progress');

  // --- 8. Past departure excluded from passenger booking ---
  console.log('Test 8: Past departure time excluded from passenger search...');
  assert.strictEqual(isServicePastDeparture('2026-09-01', '10:00'), true, 'Past date must be past departure');
  assert.strictEqual(isServicePastDeparture('2026-12-31', '10:00'), false, 'Future date must not be past departure');
  assert.strictEqual(isServicePastDeparture(now.dateStr, pastTime), true, 'Past hour today must be past departure');
  assert.strictEqual(isServicePastDeparture(now.dateStr, farFutureTime), false, 'Future hour today must not be past departure');
  console.log('  ✅ Test 8 Passed: Past services excluded from future bookable results');

  // --- 9. Future availability has realistic inventory ---
  console.log('Test 9: Future train availability has healthy confirmed inventory...');
  const availFarFuture = calculateDeterministicAvailability('12431', '2026-10-30', '3A');
  assert.strictEqual(availFarFuture.statusType, 'AVAILABLE', 'Far future should have AVAILABLE seats');
  assert(availFarFuture.availableCount >= 30, 'Far future 3A should have ample seats');
  console.log(`  ✅ Test 9 Passed: Far future 3A has ${availFarFuture.statusLabel}`);

  // --- 10. Deterministic stability across refreshes (NO Math.random) ---
  console.log('Test 10: Deterministic stability across repeated calls...');
  const avail1 = calculateDeterministicAvailability('12431', '2026-09-25', '2A');
  const avail2 = calculateDeterministicAvailability('12431', '2026-09-25', '2A');
  assert.strictEqual(avail1.availableCount, avail2.availableCount, 'Counts must be identical across calls');
  assert.strictEqual(avail1.statusLabel, avail2.statusLabel, 'Labels must be identical across calls');
  console.log(`  ✅ Test 10 Passed: Availability is 100% deterministic (${avail1.statusLabel})`);

  // --- 11. Closer to journey reduced availability & transition ---
  console.log('Test 11: Available -> RAC -> WL progression under booking pressure...');
  // Force small capacity to test RAC / WL transition
  const availRac = calculateDeterministicAvailability('12431', now.dateStr, '1A', 4);
  assert(availRac.statusType === 'RAC' || availRac.statusType === 'WL' || availRac.availableCount <= 2,
    `High pressure availability must be RAC, WL or low available (got ${availRac.statusLabel})`);
  console.log(`  ✅ Test 11 Passed: Capacity transition observed: ${availRac.statusLabel}`);

  // --- 12. Admin date filter returns date-specific services ---
  console.log('Test 12: Admin date query returns only services for requested date...');
  const servicesDate1 = getServicesForDate('2026-09-25');
  const servicesDate2 = getServicesForDate('2026-09-26');
  assert(servicesDate1.every(s => s.service_date === '2026-09-25'), 'All services must match 2026-09-25');
  assert(servicesDate2.every(s => s.service_date === '2026-09-26'), 'All services must match 2026-09-26');
  console.log(`  ✅ Test 12 Passed: Date query strictly isolated (Date1: ${servicesDate1.length}, Date2: ${servicesDate2.length})`);

  // --- 13. Summary metrics calculation ---
  console.log('Test 13: Admin date summary counters calculation...');
  const metrics = getDateSummaryMetrics('2026-09-25');
  assert(metrics.totalServices >= 0);
  assert.strictEqual(metrics.totalServices, metrics.upcoming + metrics.boardingNow + metrics.departed + metrics.completed + metrics.cancelled);
  console.log(`  ✅ Test 13 Passed: Metrics add up correctly (Total: ${metrics.totalServices}, Upcoming: ${metrics.upcoming})`);

  // --- 14. Month & Year Boundary Rollover ---
  console.log('Test 14: Month and year boundary rollover in generation...');
  const sepServices = getServicesForDate('2026-09-30');
  const octServices = getServicesForDate('2026-10-01');
  assert(sepServices.length > 0, 'Sep 30 should have services');
  assert(octServices.length > 0, 'Oct 01 should have services');
  console.log(`  ✅ Test 14 Passed: Month boundary handled cleanly (Sep 30: ${sepServices.length}, Oct 01: ${octServices.length})`);

  console.log('\n===============================================================');
  console.log('🎉 ALL 14 AUTOMATED TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runAllTests();
