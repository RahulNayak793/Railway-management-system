const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
if (!fs.existsSync(dbPath)) {
  console.error('db.json does not exist at', dbPath);
  process.exit(1);
}

const now = new Date();
const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
const backupPath = path.join(__dirname, `../../data/db.backup.pre_catering_connection_${timestamp}.json`);

// Read original file
const rawData = fs.readFileSync(dbPath, 'utf-8');
// Write exact raw backup
fs.writeFileSync(backupPath, rawData, 'utf-8');

console.log('BACKUP_PATH=' + backupPath);

const db = JSON.parse(rawData);
const counts = {};
const idsSummary = {};

for (const [key, val] of Object.entries(db)) {
  if (Array.isArray(val)) {
    counts[key] = val.length;
    // Collect sample IDs if entries are tuples [id, obj]
    if (val.length > 0 && Array.isArray(val[0])) {
      idsSummary[key] = val.slice(0, 10).map(entry => entry[0]);
    }
  } else if (val && typeof val === 'object') {
    counts[key] = Object.keys(val).length;
  } else {
    counts[key] = typeof val;
  }
}

console.log('--- DATABASE PRE-MIGRATION COUNTS ---');
console.log(JSON.stringify(counts, null, 2));

console.log('--- CATERING SPECIFIC METRICS ---');
console.log('catering_companies count:', counts.catering_companies || 0);
console.log('company_stations count:', counts.company_stations || 0);
console.log('catering_menu count:', counts.catering_menu || 0);
console.log('catering_orders count:', counts.catering_orders || 0);
console.log('bookings count:', counts.bookings || 0);
console.log('trains count:', counts.trains || 0);
console.log('stations count:', counts.stations || 0);
console.log('profiles count:', counts.profiles || 0);
console.log('payments count:', counts.payments || 0);

// Also write report to file
const reportPath = path.join(__dirname, `../../data/catering_pre_counts_${timestamp}.json`);
fs.writeFileSync(reportPath, JSON.stringify({ backupPath, counts, idsSummary }, null, 2), 'utf-8');
console.log('REPORT_PATH=' + reportPath);
