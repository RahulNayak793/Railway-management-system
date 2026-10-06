const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const raw = fs.readFileSync(dbPath, 'utf8');

// 1. Calculate SHA256
const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
console.log('SHA256 of db.json before modification:', sha256);

// 2. Create complete timestamped backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, '..', '..', 'data', `db.backup.train_type_audit_${timestamp}.json`);
fs.writeFileSync(backupPath, raw, 'utf8');
console.log('Backup created at:', backupPath);

const db = JSON.parse(raw);

// 3. Entity counts
function toList(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    if (val.length > 0 && Array.isArray(val[0]) && val[0].length === 2) {
      return val.map(item => item[1]);
    }
    return val;
  }
  if (typeof val === 'object') {
    return Object.values(val);
  }
  return [];
}

const entityCounts = {};
for (const key of Object.keys(db)) {
  const list = toList(db[key]);
  entityCounts[key] = list.length;
}
console.log('Entity Counts in db.json:\n', JSON.stringify(entityCounts, null, 2));

// 4. Inspect trains
const trains = toList(db.trains);
console.log(`\nTotal trains: ${trains.length}`);
const trainSummaries = trains.map(t => ({
  id: t.id,
  train_number: t.train_number || t.number,
  train_name: t.train_name || t.name,
  train_type: t.train_type || t.type
}));

console.log('Current Trains:', JSON.stringify(trainSummaries, null, 2));
