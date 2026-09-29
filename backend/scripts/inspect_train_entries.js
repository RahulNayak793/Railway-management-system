const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('db.trains length:', db.trains.length);
let nullCount = 0;
let tupleCount = 0;
let objCount = 0;
let otherCount = 0;

db.trains.forEach((entry, i) => {
  if (!entry) {
    nullCount++;
    console.log(`Index ${i} is null/falsy`);
  } else if (Array.isArray(entry)) {
    tupleCount++;
    const [key, val] = entry;
    if (!val) {
      console.log(`Index ${i} tuple value is null/falsy, key:`, key);
    }
  } else if (typeof entry === 'object') {
    objCount++;
    console.log(`Index ${i} is plain object with id:`, entry.id, 'train_number:', entry.train_number);
  } else {
    otherCount++;
  }
});

console.log({ nullCount, tupleCount, objCount, otherCount });
