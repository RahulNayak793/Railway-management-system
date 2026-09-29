const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.resolve(__dirname, `../data/db.backup.pre_class_date_availability_${timestamp}.json`);

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

const counts = {};
for (const key of Object.keys(db)) {
  counts[key] = countMapOrArray(db[key]);
}

console.log('\n📊 BASELINE DATABASE COUNTS:');
console.log(JSON.stringify(counts, null, 2));

const reportPath = path.resolve(__dirname, `../data/pre_class_date_audit_${timestamp}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  backupPath,
  counts
}, null, 2));

console.log(`✅ Audit report written to: ${reportPath}`);
