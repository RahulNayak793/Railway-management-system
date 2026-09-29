const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const getObj = entry => Array.isArray(entry) ? entry[1] : entry;
const trains = db.trains.map(getObj).filter(Boolean);
const routes = db.routes.map(getObj).filter(Boolean);

const t09433 = trains.find(t => String(t.train_number) === '09433');
console.log('09433 train:', t09433);
const r09433 = routes.filter(r => String(r.train_number) === '09433' || r.train_id === t09433.id);
console.log('09433 routes:', r09433);

// Also check search for UD -> NDLS on 2026-10-23
const { searchTrains } = require('../src/routes/trains'); // or let's check matching logic
console.log('09433 stops:', (t09433.stops || []).map(s => s.stationCode || s.code));
if (r09433[0]) {
  console.log('09433 route stops:', (r09433[0].stops || []).map(s => s.stationCode || s.code));
}
