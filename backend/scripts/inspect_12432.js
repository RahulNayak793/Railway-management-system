const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const trains = Array.isArray(db.trains) ? db.trains.map(e => e[1]) : Object.values(db.trains);
const routes = Array.isArray(db.routes) ? db.routes.map(e => e[1]) : Object.values(db.routes);

const t12432 = trains.find(t => String(t.train_number) === '12432');
const r12432 = routes.find(r => r.train_id === t12432?.id || String(r.train_number) === '12432');

console.log('Train 12432:', JSON.stringify(t12432, null, 2));
console.log('Route 12432:', JSON.stringify(r12432, null, 2));
