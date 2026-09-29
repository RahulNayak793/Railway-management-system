const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const trains = Array.isArray(db.trains) ? db.trains.map(e => e[1]) : Object.values(db.trains);
console.log('Total trains in db:', trains.length);

const targetTrains = trains.filter(t => 
  (t.train_name && t.train_name.toUpperCase().includes('RAJDHANI')) ||
  String(t.train_number).includes('12431') ||
  String(t.train_number).includes('12951')
);

console.log('Sample matched trains:');
targetTrains.forEach(t => {
  console.log({
    id: t.id,
    number: t.train_number,
    name: t.train_name,
    source: t.source || t.source_station_code,
    dest: t.destination || t.destination_station_code,
    running_days: t.running_days,
    frequency: t.frequency,
    frequency_type: t.frequency_type,
    operating_days: t.operating_days,
    available_classes: t.available_classes
  });
});
