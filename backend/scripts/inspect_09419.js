const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const trains = Array.isArray(db.trains) ? db.trains.map(e => e[1]) : Object.values(db.trains);
const t09419 = trains.find(t => String(t.train_number) === '09419');
console.log('09419:', JSON.stringify(t09419, null, 2));
