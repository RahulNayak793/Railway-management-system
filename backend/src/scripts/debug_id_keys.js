const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
const masterFix = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json.bak.master_fix'), 'utf8'));
const testDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'test-db.json'), 'utf8'));

console.log('Current db.json trains:', currentDb.trains.map(t => ({ id: t.id, num: t.train_number, name: t.train_name })));
console.log('master_fix trains:', masterFix.trains.map(t => ({ id: t.id, num: t.train_number, name: t.train_name })));
console.log('testDb trains:', testDb.trains.map(t => ({ id: t.id, num: t.train_number, name: t.train_name })));

console.log('\nCurrent db.json bookings count:', currentDb.bookings.length);
console.log('master_fix bookings count:', masterFix.bookings.length);
console.log('testDb bookings count:', testDb.bookings.length);

console.log('\nCurrent db.json staff profiles count:', currentDb.staff_profiles ? currentDb.staff_profiles.length : 0);
console.log('testDb staff profiles count:', testDb.staff_profiles ? testDb.staff_profiles.length : 0);
