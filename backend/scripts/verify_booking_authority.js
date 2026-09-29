const { validateBookingAuthority } = require('../src/services/journeyAvailabilityService');
const { getClassDateAvailability } = require('../src/services/trainServiceInstanceService');

console.log('Testing validateBookingAuthority for Long-Distance Train 09433:');

// Test 1: Operating date 2026-10-23, class SL -> Should be VALID
const check23_SL = validateBookingAuthority({
  trainId: 't-09433',
  fromStation: 'UD',
  travelDate: '2026-10-23',
  classCode: 'SL'
});
console.log('2026-10-23 (Operating Date, SL):', check23_SL.valid ? '✅ VALID' : '❌ INVALID: ' + check23_SL.error);

// Test 2: Non-operating date 2026-10-24, class SL -> Should be INVALID
const check24_SL = validateBookingAuthority({
  trainId: 't-09433',
  fromStation: 'UD',
  travelDate: '2026-10-24',
  classCode: 'SL'
});
console.log('2026-10-24 (Non-operating Date, SL):', !check24_SL.valid ? '✅ REJECTED AS EXPECTED: ' + check24_SL.error : '❌ FAILED (was valid)');

// Test 3: Operating date 2026-10-26, class 3A -> Should be VALID
const check26_3A = validateBookingAuthority({
  trainId: 't-09433',
  fromStation: 'UD',
  travelDate: '2026-10-26',
  classCode: '3A'
});
console.log('2026-10-26 (Operating Date, 3A):', check26_3A.valid ? '✅ VALID' : '❌ INVALID: ' + check26_3A.error);

// Test 4: Operating date 2026-10-26, unconfigured class EC -> Should be INVALID
const check26_EC = validateBookingAuthority({
  trainId: 't-09433',
  fromStation: 'UD',
  travelDate: '2026-10-26',
  classCode: 'EC'
});
console.log('2026-10-26 (Unconfigured Class EC):', !check26_EC.valid ? '✅ REJECTED AS EXPECTED: ' + check26_EC.error : '❌ FAILED (was valid)');

// Test 5: Check 09433 dates for SL vs 3A
const slDates = getClassDateAvailability('09433', 'SL', '2026-10-23', 5, 'UD', 'NZM');
console.log('\nSL dates (first 5):', slDates.dates.map(d => `${d.date} (${d.status})`));

const a3Dates = getClassDateAvailability('09433', '3A', '2026-10-23', 5, 'UD', 'NZM');
console.log('3A dates (first 5):', a3Dates.dates.map(d => `${d.date} (${d.status})`));
