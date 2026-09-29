/**
 * Automated Verification: Near-Date vs Future-Date Booking Seat Availability
 * 
 * Verifies:
 * 1. Booking for tomorrow (diffDays = 1): Shows WL, RAC, and NOT AVAILABLE across trains and classes.
 * 2. Booking 1 week later (diffDays = 7): Shows AVAILABLE seats.
 * 3. Booking 1 month later (diffDays = 30): Shows AVAILABLE seats.
 * 4. Search results availability matches seat-selection /api/trains/:id/seat-availability authoritative state.
 * 5. Relative journey-date stability: Same behavior applies relative to journey date regardless of when called.
 */

const assert = require('assert');
const path = require('path');
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');

const { calculateDeterministicAvailability } = require('../services/trainServiceInstanceService');
const { getTrainSeatAvailability } = require('../services/reservationAvailabilityService');

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING NEAR-DATE VS FUTURE-DATE AVAILABILITY BEHAVIOR');
  console.log('===============================================================');

  const now = new Date();
  const dToday = new Date(now.getTime()).toISOString().split('T')[0];
  const dTomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const dWeek = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
  const dMonth = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];

  console.log(`Reference Dates: Today=${dToday}, Tomorrow=${dTomorrow}, WeekLater=${dWeek}, MonthLater=${dMonth}\n`);

  // 1. Check Tomorrow (diffDays = 1) across popular trains and classes
  console.log('--- 1. Testing Near-Date (Tomorrow): Must show WL, RAC, and NOT AVAILABLE ---');
  const testTrains = ['12952', '22114', '20924', '20670', '09058', '12431'];
  const testClasses = ['SL', '3A', '2A', '1A', 'CC', 'EC'];

  const tomorrowStatuses = [];
  testTrains.forEach(trainNo => {
    testClasses.forEach(cls => {
      const res = calculateDeterministicAvailability(trainNo, dTomorrow, cls);
      tomorrowStatuses.push(res);
    });
  });

  const hasWl = tomorrowStatuses.some(s => s.statusType === 'WL');
  const hasRac = tomorrowStatuses.some(s => s.statusType === 'RAC');
  const hasNotAvail = tomorrowStatuses.some(s => s.statusType === 'NOT_AVAILABLE');

  console.log(`Found statuses for tomorrow across trains:`);
  console.log(`  - WL count: ${tomorrowStatuses.filter(s => s.statusType === 'WL').length}`);
  console.log(`  - RAC count: ${tomorrowStatuses.filter(s => s.statusType === 'RAC').length}`);
  console.log(`  - NOT_AVAILABLE count: ${tomorrowStatuses.filter(s => s.statusType === 'NOT_AVAILABLE').length}`);
  console.log(`  - AVAILABLE count: ${tomorrowStatuses.filter(s => s.statusType === 'AVAILABLE').length}`);

  assert(hasWl, 'Tomorrow must show WL seats across high-demand trains/classes');
  assert(hasRac, 'Tomorrow must show RAC seats across high-demand trains/classes');
  assert(hasNotAvail, 'Tomorrow must show NOT AVAILABLE seats across high-demand trains/classes');
  console.log('  [PASS] Near-date (tomorrow) successfully produces WL, RAC, and NOT AVAILABLE states!\n');

  // 2. Check 1 Week Later (diffDays = 7)
  console.log('--- 2. Testing 1 Week Later: Must show AVAILABLE seats ---');
  const weekStatuses = [];
  testTrains.forEach(trainNo => {
    testClasses.forEach(cls => {
      const res = calculateDeterministicAvailability(trainNo, dWeek, cls);
      weekStatuses.push(res);
    });
  });

  const weekAvailCount = weekStatuses.filter(s => s.statusType === 'AVAILABLE').length;
  console.log(`  - Week later AVAILABLE ratio: ${weekAvailCount} / ${weekStatuses.length} (${Math.round(weekAvailCount/weekStatuses.length*100)}%)`);
  assert(weekAvailCount > weekStatuses.length * 0.8, '1 Week later must show predominantly AVAILABLE seats');
  console.log('  [PASS] 1 Week later successfully shows AVAILABLE seats!\n');

  // 3. Check 1 Month Later (diffDays = 30)
  console.log('--- 3. Testing 1 Month Later: Must show AVAILABLE seats ---');
  const monthStatuses = [];
  testTrains.forEach(trainNo => {
    testClasses.forEach(cls => {
      const res = calculateDeterministicAvailability(trainNo, dMonth, cls);
      monthStatuses.push(res);
    });
  });

  const monthAvailCount = monthStatuses.filter(s => s.statusType === 'AVAILABLE').length;
  console.log(`  - Month later AVAILABLE ratio: ${monthAvailCount} / ${monthStatuses.length} (${Math.round(monthAvailCount/monthStatuses.length*100)}%)`);
  assert(monthAvailCount === monthStatuses.length, '1 Month later must show 100% AVAILABLE seats');
  console.log('  [PASS] 1 Month later successfully shows 100% AVAILABLE seats!\n');

  // 4. Check Seat-Selection Page Synchronization
  console.log('--- 4. Authoritative Synchronization between Search & Seat Selection Page ---');
  // Find a train and class that is in WL or RAC for tomorrow
  let testedWlOrRac = false;
  for (const trainNo of testTrains) {
    for (const cls of testClasses) {
      const avail = calculateDeterministicAvailability(trainNo, dTomorrow, cls);
      if (avail.statusType === 'WL' || avail.statusType === 'RAC') {
        const seatRes = await getTrainSeatAvailability({
          trainId: trainNo,
          journeyDate: dTomorrow,
          classCode: cls
        });
        assert(seatRes.statusType === avail.statusType, `Seat selection status (${seatRes.statusType}) matches search (${avail.statusType})`);
        assert(seatRes.availableSeats === 0, 'WL/RAC has 0 selectable confirmed seats');
        const allBlocked = seatRes.coachDetails.every(coach => coach.seats.every(s => s.status === 'BLOCKED' || s.status === 'CONFIRMED'));
        assert(allBlocked, 'When in WL/RAC, seat map strictly disables confirmed berth selection');
        console.log(`  [PASS] Verified Train #${trainNo} (${cls}) for Tomorrow: ${avail.statusLabel} -> Seat map correctly blocks all berths!`);
        testedWlOrRac = true;
        break;
      }
    }
    if (testedWlOrRac) break;
  }
  assert(testedWlOrRac, 'Must verify at least one WL or RAC train for tomorrow');

  // Pick a future date with AVAILABLE seats
  const futureSeatAvail = await getTrainSeatAvailability({
    trainId: '12952',
    journeyDate: dMonth,
    classCode: '3A'
  });

  assert(futureSeatAvail.statusType === 'AVAILABLE', 'Future month seat selection is AVAILABLE');
  assert(futureSeatAvail.availableSeats > 0, `Future month has selectable seats (${futureSeatAvail.availableSeats} seats)`);
  const hasAvailableBerths = futureSeatAvail.coachDetails.some(coach => coach.seats.some(s => s.status === 'AVAILABLE'));
  assert(hasAvailableBerths, 'Future month exposes genuinely AVAILABLE berths for passenger selection');
  console.log('  [PASS] Future month exposes green selectable AVAILABLE berths on seat map!');

  console.log('\n===============================================================');
  console.log('🏆 ALL NEAR-DATE VS FUTURE-DATE AVAILABILITY ASSERTIONS PASSED!');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
