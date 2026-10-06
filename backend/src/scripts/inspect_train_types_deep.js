const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

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

const trains = toList(db.trains);
const types = new Set();
const issues = [];

trains.forEach((t, i) => {
  const tType = t.train_type || t.type;
  const tName = t.train_name || t.name;
  const tNum = t.train_number || t.number;
  types.add(tType);

  const lowerName = String(tName || '').trim().toLowerCase();
  const lowerType = String(tType || '').trim().toLowerCase();

  // If train_name is exactly equal to a category (e.g. "vande bharat", "rajdhani", etc.)
  if (['rajdhani', 'shatabdi', 'vande bharat', 'duronto', 'humsafar', 'superfast', 'express'].includes(lowerName)) {
    issues.push({
      index: i,
      id: t.id,
      train_number: tNum,
      train_name: tName,
      train_type: tType,
      reason: 'train_name is just category name'
    });
  }

  if (!tType) {
    issues.push({
      index: i,
      id: t.id,
      train_number: tNum,
      train_name: tName,
      train_type: tType,
      reason: 'missing train_type'
    });
  }
});

console.log('Distinct train_type values in DB:', Array.from(types));
console.log(`Found ${issues.length} potential train issues:`, JSON.stringify(issues, null, 2));
