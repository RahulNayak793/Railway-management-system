const { getClassAvailabilityDates } = require('../src/services/trainServiceInstanceService');

console.log('Testing 12345 by train number:');
const res12345Num = getClassAvailabilityDates({
  trainId: '12345',
  source: 'UD',
  destination: 'NDLS',
  classCode: 'SL',
  fromDate: '2026-10-23'
});
console.log('Result for 12345 by number:', res12345Num);

console.log('\nTesting 12345 by ID t-co0fa2xs2:');
const res12345Id1 = getClassAvailabilityDates({
  trainId: 't-co0fa2xs2',
  source: 'UD',
  destination: 'NDLS',
  classCode: 'SL',
  fromDate: '2026-10-23'
});
console.log('Result for t-co0fa2xs2:', res12345Id1);

console.log('\nTesting 12345 by ID train-udupi-12345:');
const res12345Id2 = getClassAvailabilityDates({
  trainId: 'train-udupi-12345',
  source: 'UD',
  destination: 'NDLS',
  classCode: 'SL',
  fromDate: '2026-10-23'
});
console.log('Result for train-udupi-12345:', res12345Id2);

console.log('\nTesting 09401:');
const res09401 = getClassAvailabilityDates({
  trainId: '09401',
  source: 'UD',
  destination: 'NDLS',
  classCode: 'SL',
  fromDate: '2026-10-23'
});
console.log('Result for 09401:', res09401);
