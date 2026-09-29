const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

console.log('Total train_services:', db.train_services ? db.train_services.length : 0);
if (db.train_services && db.train_services.length > 0) {
  console.log('Sample train_service:', JSON.stringify(db.train_services[0], null, 2));
}

// Find train 09433 and its services
const t09433 = db.trains.find(t => String(t.train_number) === '09433');
console.log('Train 09433:', t09433);
const s09433 = (db.train_services || []).filter(s => String(s.train_number) === '09433');
console.log('Services for 09433 count:', s09433.length);
console.log('Services for 09433 dates:', s09433.map(s => s.service_date));

// Check if train_service_dates collection is used anywhere
console.log('train_service_dates in db:', db.train_service_dates ? db.train_service_dates.length : 'none');
