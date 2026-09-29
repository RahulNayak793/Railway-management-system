const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
console.log('Reading db.json from:', DB_PATH);
const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);

let convertedCount = 0;
for (const [collectionName, items] of Object.entries(db)) {
  if (!Array.isArray(items)) continue;

  const newItems = items.map((item, idx) => {
    if (Array.isArray(item)) {
      return item; // already a [key, val] tuple
    }
    // Plain object that needs wrapping
    convertedCount++;
    const key = item.id || item.train_id || item.instance_key || item.train_number || item.route_id || `item_${idx}`;
    return [key, item];
  });

  db[collectionName] = newItems;
}

fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf8');
console.log(`✅ Normalized db.json entries: wrapped ${convertedCount} plain objects into [key, val] Map tuples.`);
