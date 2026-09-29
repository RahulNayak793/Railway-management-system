const { getClassAvailabilityDates } = require('../src/services/trainServiceInstanceService');

const trainsToTest = ['09401', '09403', '09405', '09407', '12345'];

trainsToTest.forEach(num => {
  const slRes = getClassAvailabilityDates({
    trainId: num,
    source: 'UD',
    destination: 'NDLS',
    classCode: 'SL',
    fromDate: '2026-10-23'
  });
  console.log(`\nTrain #${num} (SL): success=${slRes.success}, dates=${slRes.dates ? slRes.dates.length : 0}`);
  if (slRes.dates && slRes.dates.length > 0) {
    console.log(`  First 5 dates: ${slRes.dates.slice(0, 5).map(d => d.journey_date).join(', ')}`);
  } else {
    console.log(`  Error:`, slRes.error);
  }

  if (num === '12345') {
    const a3Res = getClassAvailabilityDates({
      trainId: num,
      source: 'UD',
      destination: 'NDLS',
      classCode: '3A',
      fromDate: '2026-10-23'
    });
    console.log(`Train #12345 (3A): success=${a3Res.success}, dates=${a3Res.dates ? a3Res.dates.length : 0}`);
    if (a3Res.dates && a3Res.dates.length > 0) {
      console.log(`  First 5 dates: ${a3Res.dates.slice(0, 5).map(d => d.journey_date).join(', ')}`);
    }
  }
});
