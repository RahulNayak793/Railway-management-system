const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const trains = Array.isArray(db.trains) ? db.trains.map(e => e[1]) : Object.values(db.trains);
const t12431 = trains.find(t => String(t.train_number) === '12431');
console.log('12431 exists:', Boolean(t12431), t12431 ? { id: t12431.id, name: t12431.train_name, source: t12431.source, dest: t12431.destination, days: t12431.running_days || t12431.frequency || t12431.operating_days } : null);
