const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `../../data/db.backup.${timestamp}.json`);

try {
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup successfully created at: ${backupPath}`);

    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    console.log('Database collections count:');
    for (const [k, v] of Object.entries(db)) {
      const count = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
      console.log(` - ${k}: ${count}`);
    }
  } else {
    console.error(`❌ Source db.json not found at: ${dbPath}`);
  }
} catch (err) {
  console.error(`❌ Backup failed:`, err.message);
  process.exit(1);
}
