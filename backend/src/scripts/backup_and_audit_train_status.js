const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
if (!fs.existsSync(dbPath)) {
  console.error('db.json does not exist!');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `../../data/db.json.backup_train_status_date_isolation_${timestamp}`);

fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup created at: ${backupPath}`);

const dbRaw = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(dbRaw);

const counts = {};
for (const [key, val] of Object.entries(data)) {
  counts[key] = Array.isArray(val) ? val.length : (typeof val === 'object' && val !== null ? Object.keys(val).length : 0);
}

console.log('--- 📊 PRE-CHANGE DATABASE ENTITY COUNTS ---');
console.log(JSON.stringify(counts, null, 2));

const manifestPath = path.join(__dirname, `../../data/train_status_pre_audit_${timestamp}.json`);
fs.writeFileSync(manifestPath, JSON.stringify({ backupPath, timestamp, counts }, null, 2));
console.log(`Saved manifest to ${manifestPath}`);
