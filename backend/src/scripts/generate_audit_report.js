const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const raw = fs.readFileSync(dbPath, 'utf8');

const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

const db = JSON.parse(raw);

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

const trains = toList(db.trains);
const trainSummaries = trains.map(t => ({
  id: t.id,
  train_number: t.train_number || t.number,
  train_name: t.train_name || t.name,
  train_type: t.train_type || t.type
}));

const report = {
  sha256,
  entityCounts,
  trainsCount: trains.length,
  trainSummaries
};

fs.writeFileSync(path.join(__dirname, '..', '..', 'data', 'train_type_audit_report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('Report written with SHA256:', sha256);
