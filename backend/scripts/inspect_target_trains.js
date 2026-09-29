const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const getObj = entry => Array.isArray(entry) ? entry[1] : entry;
const trains = db.trains.map(getObj).filter(Boolean);
const routes = db.routes.map(getObj).filter(Boolean);

const targetNums = ['09401', '09403', '09405', '09407', '12345', '09433'];

console.log('=== INSPECTION OF TARGET TRAINS IN DB ===');
targetNums.forEach(num => {
  const matchingTrains = trains.filter(t => String(t.train_number) === num);
  console.log(`\nTrain #${num} (Found ${matchingTrains.length} records):`);
  matchingTrains.forEach(t => {
    console.log({
      id: t.id,
      train_number: t.train_number,
      train_name: t.train_name,
      source: t.source,
      source_station_code: t.source_station_code,
      destination: t.destination,
      destination_station_code: t.destination_station_code,
      is_date_specific: t.is_date_specific,
      service_type: t.service_type,
      journey_date: t.journey_date,
      departure_date: t.departure_date,
      service_start_date: t.service_start_date,
      service_end_date: t.service_end_date,
      frequency: t.frequency,
      frequency_type: t.frequency_type,
      running_days: t.running_days,
      operating_days: t.operating_days,
      service_pattern: t.service_pattern,
      specific_service_dates: t.specific_service_dates,
      classes: t.classes || t.available_classes
    });
  });

  const matchingRoutes = routes.filter(r => String(r.train_number) === num || matchingTrains.some(t => t.id === r.train_id));
  console.log(`Matching routes for #${num}: ${matchingRoutes.length}`);
  matchingRoutes.forEach(r => {
    console.log({
      id: r.id,
      train_id: r.train_id,
      train_number: r.train_number,
      is_date_specific: r.is_date_specific,
      service_type: r.service_type,
      journey_date: r.journey_date,
      running_days: r.running_days,
      frequency: r.frequency,
      stopsCount: (r.stops || []).length
    });
  });
});
