const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
function toList(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    if (val.length > 0 && Array.isArray(val[0]) && val[0].length === 2) return val.map(item => item[1]);
    return val;
  }
  return typeof val === 'object' ? Object.values(val) : [];
}
const trains = toList(db.trains);
const targets = ['09090', '11111', '22222', '22223', '33333'];
const targetTrains = trains.filter(t => targets.includes(String(t.train_number || t.number)));
console.log(JSON.stringify(targetTrains.map(t => ({
  id: t.id,
  train_number: t.train_number,
  train_name: t.train_name,
  train_type: t.train_type,
  source: t.source || t.source_station_code,
  destination: t.destination || t.destination_station_code
})), null, 2));
