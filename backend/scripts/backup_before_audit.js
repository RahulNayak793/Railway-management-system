const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `../data/db.backup.pre_audit_correction_${timestamp}.json`);

fs.writeFileSync(backupPath, raw, 'utf8');
console.log(`✅ Full database backup created at: ${backupPath}`);

const beforeCounts = {};
for (const [key, val] of Object.entries(db)) {
  if (Array.isArray(val)) {
    beforeCounts[key] = val.length;
  }
}

console.log('BEFORE COUNTS:', JSON.stringify(beforeCounts, null, 2));

const auditFilePath = path.join(__dirname, `../data/audit_counts_before_${timestamp}.json`);
fs.writeFileSync(auditFilePath, JSON.stringify(beforeCounts, null, 2), 'utf8');
console.log(`Audit saved to ${auditFilePath}`);
