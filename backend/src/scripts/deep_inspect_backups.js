const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

const files = fs.readdirSync(dataDir).filter(f => f.startsWith('db.json') || f.endsWith('.json') || f.endsWith('.bak'));

console.log('=== DEEP INSPECTION OF ALL BACKUP DATABASE SNAPSHOTS ===\n');

for (const file of files) {
  if (file === 'db.json' || file.startsWith('db.json.backup_before_data_restore') || file.startsWith('db.json.final_audit_backup')) continue;
  const filePath = path.join(dataDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`\n📁 Snapshot: ${file}`);

    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val)) {
        if (val.length > 0) console.log(`   - Collection '${key}': ${val.length} items`);
      } else if (val && typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length > 0) console.log(`   - Map/Object '${key}': ${keys.length} items`);
      }
    }
  } catch (e) {
    // ignore
  }
}
