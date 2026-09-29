const { getClassAvailabilityDates } = require('../src/services/trainServiceInstanceService');

const res1 = getClassAvailabilityDates({
  trainId: "t-co0fa2xs2",
  source: "UD",
  destination: "NDLS",
  classCode: "SL",
  fromDate: "2026-10-23"
});
console.log("t-co0fa2xs2 dates length:", res1.dates ? res1.dates.length : 'NO DATES', res1.error);

const res2 = getClassAvailabilityDates({
  trainId: "train-udupi-12345",
  source: "UD",
  destination: "NDLS",
  classCode: "SL",
  fromDate: "2026-10-23"
});
console.log("train-udupi-12345 dates length:", res2.dates ? res2.dates.length : 'NO DATES', res2.error);
