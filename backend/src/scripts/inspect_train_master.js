const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const trains = Array.isArray(db.trains) ? db.trains.map(t => Array.isArray(t) ? t[1] : t) : Object.values(db.trains || {});

console.log(`Total trains: ${trains.length}`);
const sample = trains.map(t => ({
  train_number: t.train_number,
  train_name: t.train_name,
  train_type: t.train_type,
  source: t.source || t.source_station_code || t.from_station_code,
  destination: t.destination || t.destination_station_code || t.to_station_code
}));

console.log('First 25 trains:');
console.table(sample.slice(0, 25));

console.log('Trains 25-50:');
console.table(sample.slice(25, 50));
