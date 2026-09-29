const { getClassDateAvailability } = require('../src/services/trainServiceInstanceService');

const trainsToTest = [
  { num: '09433', name: 'UD -> NZM', expectedAnchor: '2026-10-23', expectedDates: ['2026-10-23', '2026-10-26', '2026-10-29', '2026-11-01', '2026-11-04'] },
  { num: '12953', name: 'MMCT -> NZM', expectedAnchor: '2026-10-24', expectedDates: ['2026-10-24', '2026-10-27', '2026-10-30', '2026-11-02', '2026-11-05'] },
  { num: '12649', name: 'SBC -> NZM', expectedAnchor: '2026-10-25', expectedDates: ['2026-10-25', '2026-10-28', '2026-10-31', '2026-11-03', '2026-11-06'] },
  { num: '12615', name: 'MAS -> NDLS', expectedAnchor: '2026-10-23', expectedDates: ['2026-10-23', '2026-10-26', '2026-10-29', '2026-11-01', '2026-11-04'] },
  { num: '12643', name: 'TVC -> NZM', expectedAnchor: '2026-10-24', expectedDates: ['2026-10-24', '2026-10-27', '2026-10-30', '2026-11-02', '2026-11-05'] }
];

console.log('--- VERIFYING ALL 5 DEMO LONG-DISTANCE TRAINS ---');
trainsToTest.forEach(item => {
  const res = getClassDateAvailability(item.num, '3A', item.expectedAnchor, 5);
  if (!res.success) {
    console.error(`❌ Train ${item.num} (${item.name}) FAILED:`, res.error);
    return;
  }
  const actualDates = res.dates.map(d => d.date);
  const match = JSON.stringify(actualDates) === JSON.stringify(item.expectedDates);
  console.log(`Train ${item.num} (${item.name}): ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
  console.log(`   Expected:`, item.expectedDates);
  console.log(`   Actual:  `, actualDates);
  console.log(`   Statuses:`, res.dates.map(d => `${d.date}: ${d.status}`));
});
