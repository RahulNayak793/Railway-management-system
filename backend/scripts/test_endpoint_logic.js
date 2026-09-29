const { getClassAvailabilityDates } = require('../src/services/trainServiceInstanceService');

console.log('Testing getClassAvailabilityDates for 09433 SL from 2026-10-23:');
const res = getClassAvailabilityDates({
  trainId: '09433',
  source: 'UD',
  destination: 'NDLS',
  classCode: 'SL',
  fromDate: '2026-10-23',
  toDate: '2026-12-31'
});

console.log('Success:', res.success);
console.log('Train:', res.train_number, res.train_name);
console.log('Class:', res.class_code);
console.log('Number of dates returned:', res.dates ? res.dates.length : 0);
if (res.dates && res.dates.length > 0) {
  console.log('First 6 dates:', res.dates.slice(0, 6).map(d => ({
    journey_date: d.journey_date,
    dateFormatted: d.dateFormatted,
    status: d.status,
    available_count: d.available_count,
    waitlist_count: d.waitlist_count,
    fare: d.fare
  })));
}
