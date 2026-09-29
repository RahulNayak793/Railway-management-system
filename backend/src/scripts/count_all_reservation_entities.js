const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const raw = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(raw);

console.log('--- RESERVATION ENTITIES BASELINE ---');
for (const [key, val] of Object.entries(data)) {
  const count = Array.isArray(val) ? val.length : Object.keys(val || {}).length;
  console.log(`${key.padEnd(25)}: ${count}`);
}
