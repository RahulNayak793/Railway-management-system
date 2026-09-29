const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const getObj = entry => Array.isArray(entry) ? entry[1] : entry;

const t12345_1 = db.trains.map(getObj).find(t => t && t.id === 't-co0fa2xs2');
const r12345_1 = db.routes.map(getObj).find(r => r && r.id === 'r-45jgxi0z5');
const r12345_2 = db.routes.map(getObj).find(r => r && r.id === 'r-12345');

console.log('t-co0fa2xs2:', {
  id: t12345_1.id,
  name: t12345_1.train_name,
  number: t12345_1.train_number,
  source: t12345_1.source,
  dest: t12345_1.destination,
  dest_code: t12345_1.destination_station_code,
  stops: (t12345_1.stops || []).map(s => s.stationCode)
});

console.log('r-45jgxi0z5:', {
  id: r12345_1.id,
  train_id: r12345_1.train_id,
  train_number: r12345_1.train_number,
  stops: (r12345_1.stops || []).map(s => s.stationCode)
});

console.log('r-12345:', {
  id: r12345_2.id,
  train_id: r12345_2.train_id,
  train_number: r12345_2.train_number,
  stops: (r12345_2.stops || []).map(s => s.stationCode)
});
