const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_PATH = path.join(__dirname, `../data/db.backup.pre_long_distance_${timestamp}.json`);
const AUDIT_PATH = path.join(__dirname, `../data/pre_long_distance_audit_${timestamp}.json`);

console.log('Backing up database from:', DB_PATH);
const dbRaw = fs.readFileSync(DB_PATH, 'utf8');
fs.writeFileSync(BACKUP_PATH, dbRaw, 'utf8');
console.log('✅ Backup created at:', BACKUP_PATH);

const db = JSON.parse(dbRaw);
const counts = {};
for (const key of Object.keys(db)) {
  const val = db[key];
  counts[key] = Array.isArray(val) ? val.length : (typeof val === 'object' && val !== null ? Object.keys(val).length : 0);
}

const audit = {
  timestamp: new Date().toISOString(),
  backupPath: BACKUP_PATH,
  counts
};

fs.writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2), 'utf8');
console.log('✅ Baseline entity audit written to:', AUDIT_PATH);
console.log('Total trains in baseline:', counts.trains);
console.log('Total routes in baseline:', counts.routes);
console.log('Total services in baseline:', counts.train_services);
console.log('Total seats in baseline:', counts.seats);
console.log('Total bookings in baseline:', counts.bookings);
