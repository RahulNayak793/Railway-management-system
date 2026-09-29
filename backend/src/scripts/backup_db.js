const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const backupPath = path.join(__dirname, '../../data/db.json.backup_before_unique_irctc_passenger_update');

try {
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup successfully created at: ${backupPath}`);
  } else {
    console.error(`❌ Source db.json not found at: ${dbPath}`);
  }
} catch (err) {
  console.error(`❌ Backup failed:`, err.message);
}
