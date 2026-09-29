const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `db.json.backup_pre_tatkal_${timestamp}`;
const backupPath = path.join(__dirname, '../../data', backupFilename);

fs.copyFileSync(dbPath, backupPath);
console.log('BACKUP_FILENAME:', backupFilename);
console.log('BACKUP_PATH:', backupPath);

const raw = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(raw);

const trainCount = Array.isArray(data.trains) ? data.trains.length : Object.keys(data.trains || {}).length;
const bookingCount = Array.isArray(data.bookings) ? data.bookings.length : Object.keys(data.bookings || {}).length;
const profileCount = Array.isArray(data.profiles) ? data.profiles.length : Object.keys(data.profiles || {}).length;
const savedPaxCount = Array.isArray(data.saved_passengers) ? data.saved_passengers.length : Object.keys(data.saved_passengers || {}).length;

console.log('BEFORE_COUNTS:');
console.log('Trains:', trainCount);
console.log('Bookings:', bookingCount);
console.log('Profiles/Users:', profileCount);
console.log('Saved Passengers:', savedPaxCount);
