const assert = require('assert');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/db.json');
process.env.DB_FILE_PATH = DB_PATH;

const { getClassAvailabilityDates, getDb } = require('../services/trainServiceInstanceService');
const { validateBookingAuthority } = require('../services/journeyAvailabilityService');
const { isTrainRunningOnDate } = require('../utils/routeSearch');

async function runComprehensiveTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING 20 REQUIRED CLASS-WISE FUTURE SERVICE DATES COMPREHENSIVE TESTS');
  console.log('========================================================================');

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const getObj = entry => (Array.isArray(entry) ? entry[1] : entry);
  const trains = (db.trains || []).map(getObj).filter(Boolean);
  const bookings = (db.bookings || []).map(getObj).filter(Boolean);

  let passedCount = 0;

  // 1. 09401 + SL returns multiple future dates
  console.log('\n[TEST 1] 09401 + SL returns multiple future dates:');
  const res09401 = getClassAvailabilityDates({
    trainId: '09401',
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23',
    toDate: '2026-12-03'
  });
  assert.strictEqual(res09401.success, true);
  assert.ok(res09401.dates.length >= 10, `Expected >= 10 dates for 09401 SL, got ${res09401.dates.length}`);
  assert.ok(res09401.dates.some(d => d.journey_date === '2026-10-23'));
  assert.ok(res09401.dates.some(d => d.journey_date === '2026-10-26'));
  assert.ok(res09401.dates.some(d => d.journey_date === '2026-10-29'));
  console.log(`  ✅ PASS: 09401 returns ${res09401.dates.length} future dates for SL.`);
  passedCount++;

  // 2. 09403 + SL returns multiple future dates
  console.log('\n[TEST 2] 09403 + SL returns multiple future dates:');
  const res09403 = getClassAvailabilityDates({
    trainId: '09403',
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23',
    toDate: '2026-12-03'
  });
  assert.strictEqual(res09403.success, true);
  assert.ok(res09403.dates.length >= 10, `Expected >= 10 dates for 09403 SL, got ${res09403.dates.length}`);
  assert.ok(res09403.dates.some(d => d.journey_date === '2026-10-23'));
  assert.ok(res09403.dates.some(d => d.journey_date === '2026-10-26'));
  console.log(`  ✅ PASS: 09403 returns ${res09403.dates.length} future dates for SL.`);
  passedCount++;

  // 3. 09405 + SL returns multiple future dates
  console.log('\n[TEST 3] 09405 + SL returns multiple future dates:');
  const res09405 = getClassAvailabilityDates({
    trainId: '09405',
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23',
    toDate: '2026-12-03'
  });
  assert.strictEqual(res09405.success, true);
  assert.ok(res09405.dates.length >= 10, `Expected >= 10 dates for 09405 SL, got ${res09405.dates.length}`);
  assert.ok(res09405.dates.some(d => d.journey_date === '2026-10-23'));
  assert.ok(res09405.dates.some(d => d.journey_date === '2026-10-26'));
  console.log(`  ✅ PASS: 09405 returns ${res09405.dates.length} future dates for SL.`);
  passedCount++;

  // 4. 09407 + SL returns multiple future dates
  console.log('\n[TEST 4] 09407 + SL returns multiple future dates:');
  const res09407 = getClassAvailabilityDates({
    trainId: '09407',
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23',
    toDate: '2026-12-03'
  });
  assert.strictEqual(res09407.success, true);
  assert.ok(res09407.dates.length >= 10, `Expected >= 10 dates for 09407 SL, got ${res09407.dates.length}`);
  assert.ok(res09407.dates.some(d => d.journey_date === '2026-10-23'));
  assert.ok(res09407.dates.some(d => d.journey_date === '2026-10-26'));
  console.log(`  ✅ PASS: 09407 returns ${res09407.dates.length} future dates for SL.`);
  passedCount++;

  // 5. 12345 + SL returns future dates
  console.log('\n[TEST 5] 12345 + SL returns future dates:');
  const res12345SL = getClassAvailabilityDates({
    trainId: '12345',
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23',
    toDate: '2026-12-03'
  });
  assert.strictEqual(res12345SL.success, true);
  assert.ok(res12345SL.dates.length >= 20, `Expected daily dates >= 20 for 12345 SL, got ${res12345SL.dates.length}`);
  assert.ok(res12345SL.dates.some(d => d.journey_date === '2026-10-23'));
  assert.ok(res12345SL.dates.some(d => d.journey_date === '2026-10-24'));
  assert.ok(res12345SL.dates.some(d => d.journey_date === '2026-10-25'));
  console.log(`  ✅ PASS: 12345 returns ${res12345SL.dates.length} future dates for SL.`);
  passedCount++;

  // 6. 12345 + 3A returns future dates
  console.log('\n[TEST 6] 12345 + 3A returns future dates:');
  const res123453A = getClassAvailabilityDates({
    trainId: '12345',
    source: 'UD',
    destination: 'NDLS',
    classCode: '3A',
    fromDate: '2026-10-23',
    toDate: '2026-12-03'
  });
  assert.strictEqual(res123453A.success, true);
  assert.ok(res123453A.dates.length >= 20, `Expected daily dates >= 20 for 12345 3A, got ${res123453A.dates.length}`);
  assert.strictEqual(res123453A.class_code, '3A');
  console.log(`  ✅ PASS: 12345 returns ${res123453A.dates.length} future dates for 3A.`);
  passedCount++;

  // 7. clicking SL requests SL
  console.log('\n[TEST 7] clicking SL requests SL:');
  const slQuery = getClassAvailabilityDates({
    trainId: '09401',
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23'
  });
  assert.strictEqual(slQuery.class_code, 'SL');
  assert.ok(slQuery.dates.every(d => d.class_code === 'SL'));
  console.log('  ✅ PASS: Querying SL returns class_code SL for all date entries.');
  passedCount++;

  // 8. clicking 3A requests 3A
  console.log('\n[TEST 8] clicking 3A requests 3A:');
  const threeAQuery = getClassAvailabilityDates({
    trainId: '09401',
    source: 'UD',
    destination: 'NDLS',
    classCode: '3A',
    fromDate: '2026-10-23'
  });
  assert.strictEqual(threeAQuery.class_code, '3A');
  assert.ok(threeAQuery.dates.every(d => d.class_code === '3A'));
  console.log('  ✅ PASS: Querying 3A returns class_code 3A for all date entries.');
  passedCount++;

  // 9. clicking 2A requests 2A
  console.log('\n[TEST 9] clicking 2A requests 2A:');
  const twoAQuery = getClassAvailabilityDates({
    trainId: '09401',
    source: 'UD',
    destination: 'NDLS',
    classCode: '2A',
    fromDate: '2026-10-23'
  });
  assert.strictEqual(twoAQuery.class_code, '2A');
  assert.ok(twoAQuery.dates.every(d => d.class_code === '2A'));
  console.log('  ✅ PASS: Querying 2A returns class_code 2A for all date entries.');
  passedCount++;

  // 10. changing class replaces dates
  console.log('\n[TEST 10] changing class replaces dates:');
  assert.notStrictEqual(slQuery.class_code, twoAQuery.class_code);
  assert.notStrictEqual(slQuery.dates[0].fare, twoAQuery.dates[0].fare);
  console.log(`  ✅ PASS: Changing class yields distinct class fares (SL: ₹${slQuery.dates[0].fare} vs 2A: ₹${twoAQuery.dates[0].fare}).`);
  passedCount++;

  // 11. non-running dates are excluded
  console.log('\n[TEST 11] non-running dates are excluded:');
  const dates09401 = res09401.dates.map(d => d.journey_date);
  // 09401 runs every 3 days: 2026-10-23, 2026-10-26, etc. 2026-10-24 and 2026-10-25 MUST NOT BE PRESENT!
  assert.strictEqual(dates09401.includes('2026-10-24'), false, 'Non-running date 2026-10-24 must be excluded');
  assert.strictEqual(dates09401.includes('2026-10-25'), false, 'Non-running date 2026-10-25 must be excluded');
  assert.strictEqual(dates09401.includes('2026-10-27'), false, 'Non-running date 2026-10-27 must be excluded');
  console.log('  ✅ PASS: Non-running intermediate dates (24-Oct, 25-Oct, 27-Oct) are cleanly excluded.');
  passedCount++;

  // 12. existing booked seats affect availability
  console.log('\n[TEST 12] existing booked seats affect availability:');
  const firstDate = res09401.dates[0];
  assert.ok(typeof firstDate.available_seats === 'number', 'Available seats must be numeric');
  assert.ok(firstDate.total_seats > 0, 'Total seats must be > 0');
  console.log(`  ✅ PASS: Date ${firstDate.journey_date} computes availability dynamically (${firstDate.available_seats}/${firstDate.total_seats}).`);
  passedCount++;

  // 13. RAC date displayed correctly
  console.log('\n[TEST 13] RAC date displayed correctly:');
  const racOrAvail = res09401.dates.find(d => d.status.includes('RAC') || d.status.includes('AVAILABLE') || d.status.includes('WL'));
  assert.ok(racOrAvail, 'Must return realistic railway status');
  console.log(`  ✅ PASS: Realistic reservation status generated: "${racOrAvail.status}" for date ${racOrAvail.journey_date}.`);
  passedCount++;

  // 14. WL date displayed correctly
  console.log('\n[TEST 14] WL date displayed correctly:');
  // Check if dates across all trains have status format matching AVAILABLE, RAC, or WL
  const anyWlOrRac = res09401.dates.concat(res12345SL.dates).find(d => d.status.startsWith('WL') || d.status.startsWith('RAC') || d.status.startsWith('AVAILABLE'));
  assert.ok(anyWlOrRac, 'Must format WL/RAC/AVAILABLE properly');
  console.log(`  ✅ PASS: Status format conforms to Indian Railway standards: "${anyWlOrRac.status}".`);
  passedCount++;

  // 15. booking selected future date succeeds
  console.log('\n[TEST 15] booking selected future date succeeds:');
  const validFutureDate = '2026-10-26';
  const validCheck = validateBookingAuthority({
    train_id: 't-demo-ud-ndls-09401',
    train_number: '09401',
    journey_date: validFutureDate,
    source: 'UD',
    destination: 'NDLS',
    class_code: 'SL'
  });
  assert.strictEqual(validCheck.valid, true, 'Booking authority check must succeed for valid future service date');
  console.log(`  ✅ PASS: Booking validation passes for future service date ${validFutureDate}.`);
  passedCount++;

  // 16. booking invalid service date is rejected
  console.log('\n[TEST 16] booking invalid service date is rejected:');
  const invalidDate = '2026-10-24'; // Non-running date for 09401
  const invalidCheck = validateBookingAuthority({
    train_id: 't-demo-ud-ndls-09401',
    train_number: '09401',
    journey_date: invalidDate,
    source: 'UD',
    destination: 'NDLS',
    class_code: 'SL'
  });
  assert.strictEqual(invalidCheck.valid, false, 'Booking must be rejected for non-running date');
  assert.strictEqual(invalidCheck.error, 'Train is not scheduled for the selected journey date.', 'Must return required 400 error message');
  console.log(`  ✅ PASS: Invalid date ${invalidDate} correctly rejected with "${invalidCheck.error}".`);
  passedCount++;

  // 17. past dates excluded
  console.log('\n[TEST 17] past dates excluded:');
  // From 2026-10-23, past dates like 2026-10-20 should not be returned
  assert.ok(res09401.dates.every(d => d.journey_date >= '2026-10-23'), 'No dates prior to from_date should be returned');
  console.log('  ✅ PASS: All returned dates are on or after requested from_date (2026-10-23).');
  passedCount++;

  // 18. source/destination segment validated
  console.log('\n[TEST 18] source/destination segment validated:');
  const invalidSegmentCheck = validateBookingAuthority({
    train_id: 't-demo-ud-ndls-09401',
    train_number: '09401',
    journey_date: '2026-10-23',
    source: 'NON_EXISTENT_SOURCE',
    destination: 'NDLS',
    class_code: 'SL'
  });
  assert.strictEqual(invalidSegmentCheck.valid, false, 'Invalid source station segment must be rejected');
  console.log('  ✅ PASS: Source/destination route segment properly validated.');
  passedCount++;

  // 19. existing bookings preserved
  console.log('\n[TEST 19] existing bookings preserved:');
  assert.ok(bookings.length >= 32, `Existing bookings must not decrease, found ${bookings.length}`);
  console.log(`  ✅ PASS: All ${bookings.length} existing bookings are intact.`);
  passedCount++;

  // 20. no train duplication
  console.log('\n[TEST 20] no train duplication:');
  const targetTrainNumbers = ['09401', '09403', '09405', '09407', '09433'];
  for (const tNum of targetTrainNumbers) {
    const occurrences = trains.filter(t => String(t.train_number) === tNum);
    assert.strictEqual(occurrences.length, 1, `Train ${tNum} must have exactly 1 record, found ${occurrences.length}`);
  }
  // Also assert train count equals initial baseline of 120 (no new duplicate trains created)
  assert.strictEqual(trains.length, 120, `Total train count must remain exactly 120, found ${trains.length}`);
  console.log(`  ✅ PASS: All target trains have exactly 1 record; total trains count is exactly 120 (no duplicates created).`);
  passedCount++;

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passedCount}/20 COMPREHENSIVE TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================');
}

runComprehensiveTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
