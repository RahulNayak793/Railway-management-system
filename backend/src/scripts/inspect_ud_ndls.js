const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const trains = Array.isArray(db.trains) ? db.trains.map(t => Array.isArray(t) ? t[1] : t) : Object.values(db.trains || {});
const routes = Array.isArray(db.routes) ? db.routes.map(r => Array.isArray(r) ? r[1] : r) : Object.values(db.routes || {});

const udNdlsTrains = trains.filter(t => (t.source === 'UD' || t.source_station_code === 'UD') && (t.destination === 'NDLS' || t.destination_station_code === 'NDLS'));
console.log('Found UD -> NDLS trains count:', udNdlsTrains.length);

udNdlsTrains.slice(0, 5).forEach(t => {
  console.log('--- TRAIN:', t.id, t.train_number, t.train_name, '---');
  console.log('Train stops:', JSON.stringify(t.stops));
  const route = routes.find(r => r.train_id === t.id || r.train_number === t.train_number);
  if (route) {
    console.log('Route stops:', JSON.stringify(route.stops));
  } else {
    console.log('No separate route record found');
  }
});

// Also check 12345
const t12345 = trains.filter(t => t.train_number === '12345');
console.log('--- 12345 Trains ---');
t12345.forEach(t => {
  console.log('12345:', t.id, t.train_name, t.source, '->', t.destination, 'stops:', JSON.stringify(t.stops));
  const r = routes.find(rt => rt.train_id === t.id || rt.train_number === t.train_number);
  if (r) console.log('Route stops:', JSON.stringify(r.stops));
});
