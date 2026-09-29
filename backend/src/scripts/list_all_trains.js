const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const trains = Array.isArray(db.trains) ? db.trains.map(t => Array.isArray(t) ? t[1] : t) : Object.values(db.trains || {});

console.log('Total train records:', trains.length);
const summary = trains.map(t => `${t.train_number}: ${t.train_name} (${t.source || t.from_station_code} -> ${t.destination || t.to_station_code}) [${t.train_type || 'Unknown'}]`);
console.log(summary.join('\n'));
