const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../data/db.json');
const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);

const hash = crypto.createHash('sha256').update(raw).digest('hex');

const counts = {};
const criticalCollections = [
  'trains', 'routes', 'stations', 'train_services', 'seats',
  'seat_allocations', 'bookings', 'payments', 'profiles',
  'catering_companies', 'catering_menu', 'catering_orders'
];

for (const [key, val] of Object.entries(db)) {
  if (Array.isArray(val)) {
    counts[key] = val.length;
  }
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `db.backup_before_class_future_dates_fix_${timestamp}.json`;
const countsFilename = `audit_counts_before_class_future_dates_fix_${timestamp}.json`;

const backupPath = path.join(__dirname, '../data', backupFilename);
const countsPath = path.join(__dirname, '../data', countsFilename);

fs.writeFileSync(backupPath, raw, 'utf8');
fs.writeFileSync(countsPath, JSON.stringify({
  timestamp,
  sha256: hash,
  counts
}, null, 2), 'utf8');

console.log('=== PRE-FIX BACKUP COMPLETED ===');
console.log('SHA256:', hash);
console.log('Backup Path:', backupPath);
console.log('Critical Collection Counts:');
criticalCollections.forEach(c => {
  console.log(`  ${c}: ${counts[c] || 0}`);
});
