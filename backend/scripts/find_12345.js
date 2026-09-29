const fs = require('fs');
const path = require('path');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const matchingTrains = (db.trains || []).filter(t => String(t.train_number) === '12345');
console.log('Matching trains in db.json for 12345:');
console.log(JSON.stringify(matchingTrains, null, 2));

const matchingRoutes = (db.routes || []).filter(r => String(r.train_number) === '12345' || matchingTrains.some(t => t.id === r.train_id));
console.log('Matching routes in db.json for 12345:');
console.log(JSON.stringify(matchingRoutes, null, 2));
