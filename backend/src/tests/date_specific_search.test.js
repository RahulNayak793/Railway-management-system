const assert = require('assert');
const { isTrainRunningOnDate, matchRouteSegment } = require('../utils/routeSearch');

// Mock 5-day date generator helper matching frontend implementation
const generateFiveDayWindow = (startDateStr) => {
  if (!startDateStr) {
    startDateStr = new Date().toISOString().split('T')[0];
  }
  const parts = String(startDateStr).split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1;
  let day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const today = new Date();
    year = today.getFullYear();
    month = today.getMonth();
    day = today.getDate();
  }

  const days = [];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 5; i++) {
    const d = new Date(year, month, day + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    days.push({
      dateStr,
      dayName: weekDays[d.getDay()],
      dayNum: d.getDate(),
      monthName: monthNames[d.getMonth()],
      year: d.getFullYear(),
      fullLabel: `${weekDays[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`
    });
  }

  return days;
};

// Mock train data with different running day frequencies
const mockTrain1 = {
  id: 't-12952',
  train_number: '12952',
  train_name: 'Mumbai Rajdhani Express',
  train_type: 'Superfast',
  source_station_code: 'NDLS',
  destination_station_code: 'MMCT',
  frequency: 'Daily',
  stops: [
    { sequence: 1, stationCode: 'NDLS', stationName: 'NEW DELHI', depTime: '16:30', arrTime: '16:30', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'ST', stationName: 'SURAT', depTime: '09:05', arrTime: '09:00', distanceFromOriginKm: 1350, day_offset: 1 },
    { sequence: 3, stationCode: 'MMCT', stationName: 'MUMBAI CENTRAL', depTime: '12:10', arrTime: '12:10', distanceFromOriginKm: 1384, day_offset: 1 }
  ]
};

const mockTrain2 = {
  id: 't-22633',
  train_number: '22633',
  train_name: 'TVC NZM SF EXP',
  train_type: 'Superfast',
  source_station_code: 'TVC',
  destination_station_code: 'NZM',
  frequency: 'MON WED FRI',
  stops: [
    { sequence: 1, stationCode: 'TVC', stationName: 'TRIVANDRUM', depTime: '14:30', arrTime: '14:30', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'UDU', stationName: 'UDUPI', depTime: '03:22', arrTime: '03:20', distanceFromOriginKm: 780, day_offset: 1 },
    { sequence: 3, stationCode: 'NDLS', stationName: 'NEW DELHI', depTime: '12:30', arrTime: '12:30', distanceFromOriginKm: 2850, day_offset: 2 }
  ]
};

const runTests = () => {
  console.log('\n--- 🧪 RUNNING MULTI-DATE TRAIN SEARCH & 5-DAY WINDOW SUITE ---');

  // Test 1: 5-Day Window Standard Date Generation
  console.log('Test 1: 5-Day Window Standard Date Generation...');
  const window1 = generateFiveDayWindow('2026-09-18');
  assert.strictEqual(window1.length, 5);
  assert.strictEqual(window1[0].dateStr, '2026-09-18');
  assert.strictEqual(window1[0].dayName, 'Fri');
  assert.strictEqual(window1[4].dateStr, '2026-09-22');
  assert.strictEqual(window1[4].dayName, 'Tue');
  console.log('  ✅ Test 1 Passed: 5 consecutive dates generated starting Fri 18 Sep');

  // Test 2: Month Boundary Date Generation (Sep 30 -> Oct 04)
  console.log('Test 2: Month Boundary Date Shift (Sep 30 -> Oct 04)...');
  const windowMonth = generateFiveDayWindow('2026-09-30');
  assert.strictEqual(windowMonth[0].dateStr, '2026-09-30');
  assert.strictEqual(windowMonth[0].monthName, 'Sep');
  assert.strictEqual(windowMonth[1].dateStr, '2026-10-01');
  assert.strictEqual(windowMonth[1].monthName, 'Oct');
  assert.strictEqual(windowMonth[4].dateStr, '2026-10-04');
  console.log('  ✅ Test 2 Passed: Correctly transitions Sep 30 to Oct 01-04');

  // Test 3: Year Boundary Date Generation (Dec 30 -> Jan 03)
  console.log('Test 3: Year Boundary Date Shift (Dec 30 -> Jan 03)...');
  const windowYear = generateFiveDayWindow('2026-12-30');
  assert.strictEqual(windowYear[0].dateStr, '2026-12-30');
  assert.strictEqual(windowYear[0].year, 2026);
  assert.strictEqual(windowYear[2].dateStr, '2027-01-01');
  assert.strictEqual(windowYear[2].year, 2027);
  assert.strictEqual(windowYear[4].dateStr, '2027-01-03');
  console.log('  ✅ Test 3 Passed: Correctly transitions Dec 30, 2026 to Jan 01-03, 2027');

  // Test 4: Intermediate Station Stop-Sequence Search
  console.log('Test 4: Intermediate Station Stop-Sequence Search (NDLS -> ST)...');
  const match1 = matchRouteSegment(mockTrain1, null, 'NDLS', 'ST');
  assert.notStrictEqual(match1, null);
  assert.strictEqual(match1.srcCode, 'NDLS');
  assert.strictEqual(match1.destCode, 'ST');
  assert.strictEqual(match1.departure_time.slice(0, 5), '16:30');
  assert.strictEqual(match1.arrival_time.slice(0, 5), '09:00');
  console.log('  ✅ Test 4 Passed: Segment-specific times and station codes returned');

  // Test 5: Running-Day Validation (Mon vs Tue for weekly train)
  console.log('Test 5: Running-Day Validation for Weekly Train...');
  // 2026-09-21 is Monday (MON)
  const isMonRunning = isTrainRunningOnDate(mockTrain2, mockTrain2.route, '2026-09-21');
  assert.strictEqual(isMonRunning, true);

  // 2026-09-22 is Tuesday (TUE - 22633 does NOT run on TUE)
  const isTueRunning = isTrainRunningOnDate(mockTrain2, mockTrain2.route, '2026-09-22');
  assert.strictEqual(isTueRunning, false);
  console.log('  ✅ Test 5 Passed: Train running on MON (true), omitted on TUE (false)');

  // Test 6: Reverse Route Match Fails
  console.log('Test 6: Reverse Route Invalid Search...');
  const matchReverse = matchRouteSegment(mockTrain1, null, 'MMCT', 'NDLS');
  assert.strictEqual(matchReverse, null);
  console.log('  ✅ Test 6 Passed: Null returned for reverse route match');

  console.log('\n🎉 ALL MULTI-DATE & 5-DAY WINDOW TEST CASES PASSED SUCCESSFULLY! 🎉\n');
};

runTests();
