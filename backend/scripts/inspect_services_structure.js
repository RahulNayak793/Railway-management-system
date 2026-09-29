const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const services = Array.isArray(db.train_services) ? db.train_services.map(e => e[1]) : Object.values(db.train_services || {});
console.log('Total train_services:', services.length);

if (services.length > 0) {
  console.log('Sample service:', JSON.stringify(services[0], null, 2));
}
