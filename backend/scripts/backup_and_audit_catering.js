const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.resolve(__dirname, `../data/db.backup.pre_catering_upgrade_${timestamp}.json`);

if (!fs.existsSync(dbPath)) {
  console.error(`❌ db.json does not exist at ${dbPath}`);
  process.exit(1);
}

// 1. Create full atomic backup
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Full database backup created successfully at:\n   ${backupPath}`);

// 2. Count records
const rawData = fs.readFileSync(dbPath, 'utf8');
const db = JSON.parse(rawData);

function countMapOrArray(item) {
  if (!item) return 0;
  if (Array.isArray(item)) return item.length;
  if (typeof item === 'object') return Object.keys(item).length;
  return 0;
}

const counts = {
  trains: countMapOrArray(db.trains),
  stations: countMapOrArray(db.stations),
  routes: countMapOrArray(db.routes),
  profiles: countMapOrArray(db.profiles),
  bookings: countMapOrArray(db.bookings),
  payments: countMapOrArray(db.payments),
  catering_companies: countMapOrArray(db.catering_companies),
  company_stations: countMapOrArray(db.company_stations),
  catering_menu: countMapOrArray(db.catering_menu),
  catering_orders: countMapOrArray(db.catering_orders),
  seat_allocations: countMapOrArray(db.seat_allocations),
  train_onboard_catering: countMapOrArray(db.train_onboard_catering)
};

console.log('\n📊 BASELINE DATABASE COUNTS:');
console.log(JSON.stringify(counts, null, 2));

const report = {
  timestamp: new Date().toISOString(),
  backupPath,
  counts
};

const reportPath = path.resolve(__dirname, '../data/pre_catering_upgrade_counts.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\n✅ Counts saved to ${reportPath}`);
