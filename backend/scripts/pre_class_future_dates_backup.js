const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../data/db.json');
const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);

// 1. Calculate DB Hash
const hash = crypto.createHash('sha256').update(raw).digest('hex');

// 2. Count all collections
const counts = {};
for (const [key, val] of Object.entries(db)) {
  if (Array.isArray(val)) {
    counts[key] = val.length;
  }
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `db.backup.pre_class_future_dates_${timestamp}.json`;
const countsFilename = `audit_counts_before_class_future_dates_${timestamp}.json`;

const backupPath = path.join(__dirname, '../data', backupFilename);
const countsPath = path.join(__dirname, '../data', countsFilename);

fs.writeFileSync(backupPath, raw, 'utf8');
fs.writeFileSync(countsPath, JSON.stringify({
  timestamp,
  sha256: hash,
  counts
}, null, 2), 'utf8');

console.log('=== DATA SAFETY BACKUP COMPLETED ===');
console.log('SHA256 Hash:', hash);
console.log('Backup Path:', backupPath);
console.log('Counts Path:', countsPath);
console.log('Baseline Counts:', JSON.stringify(counts, null, 2));
