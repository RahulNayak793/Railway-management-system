const fs = require('fs');
const path = require('path');

const dbFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));
const trainsMap = new Map(dbFile.trains);
const routesMap = new Map(dbFile.routes);
const bookingsMap = new Map(dbFile.bookings);

console.log('Train 1 (t-co0fa2xs2):');
console.log(JSON.stringify(trainsMap.get('t-co0fa2xs2'), null, 2));

console.log('\nTrain 2 (train-udupi-12345):');
console.log(JSON.stringify(trainsMap.get('train-udupi-12345'), null, 2));

console.log('\nRoutes for t-co0fa2xs2:');
Array.from(routesMap.values()).filter(r => r.train_id === 't-co0fa2xs2').forEach(r => console.log(JSON.stringify(r)));

console.log('\nRoutes for train-udupi-12345:');
Array.from(routesMap.values()).filter(r => r.train_id === 'train-udupi-12345').forEach(r => console.log(JSON.stringify(r)));

console.log('\nBookings for t-co0fa2xs2:');
Array.from(bookingsMap.values()).filter(b => b.train_id === 't-co0fa2xs2').forEach(b => console.log(b.id, b.pnr_number, b.passenger_name, b.travel_date));

console.log('\nBookings for train-udupi-12345:');
Array.from(bookingsMap.values()).filter(b => b.train_id === 'train-udupi-12345').forEach(b => console.log(b.id, b.pnr_number, b.passenger_name, b.travel_date));
