const { mockDb } = require('../src/config/supabase');
const { isTrainRunningOnDate } = require('../src/utils/routeSearch');
const { getClassDateAvailability } = require('../src/services/trainServiceInstanceService');

console.log('Total trains in mockDb:', mockDb.trains.size);

// Test Train A (09433)
const trainA = Array.from(mockDb.trains.values()).find(t => String(t.train_number) === '09433');
console.log('Train A found:', trainA ? trainA.train_name : 'NOT FOUND');

if (trainA) {
  console.log('Train A runs on 2026-10-23 (Fri):', isTrainRunningOnDate(trainA, null, '2026-10-23')); // Should be true
  console.log('Train A runs on 2026-10-24 (Sat):', isTrainRunningOnDate(trainA, null, '2026-10-24')); // Should be false
  console.log('Train A runs on 2026-10-25 (Sun):', isTrainRunningOnDate(trainA, null, '2026-10-25')); // Should be false
  console.log('Train A runs on 2026-10-26 (Mon):', isTrainRunningOnDate(trainA, null, '2026-10-26')); // Should be true
  console.log('Train A runs on 2026-10-27 (Tue):', isTrainRunningOnDate(trainA, null, '2026-10-27')); // Should be false
  console.log('Train A runs on 2026-10-28 (Wed):', isTrainRunningOnDate(trainA, null, '2026-10-28')); // Should be false
  console.log('Train A runs on 2026-10-29 (Thu):', isTrainRunningOnDate(trainA, null, '2026-10-29')); // Should be true
  console.log('Train A runs on 2026-11-01 (Sun):', isTrainRunningOnDate(trainA, null, '2026-11-01')); // Should be true
  console.log('Train A runs on 2026-11-04 (Wed):', isTrainRunningOnDate(trainA, null, '2026-11-04')); // Should be true

  const slDates = getClassDateAvailability('09433', 'SL', '2026-10-23', 6);
  console.log('SL dates for Train A:', slDates.dates.map(d => `${d.date} (${d.status})`));

  const a3Dates = getClassDateAvailability('09433', '3A', '2026-10-23', 6);
  console.log('3A dates for Train A:', a3Dates.dates.map(d => `${d.date} (${d.status})`));
}
