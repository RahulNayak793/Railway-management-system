const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');
const backupPath = path.join(__dirname, '../data/db.json.backup_train_status_date_isolation_2026-09-23T16-02-10-227Z');

try {
  const currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const backupDb = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  console.log('Current DB keys & counts:');
  for (const k of Object.keys(currentDb)) {
    const val = currentDb[k];
    console.log(`  ${k}: ${Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : val)}`);
  }

  console.log('\nBackup DB keys & counts:');
  for (const k of Object.keys(backupDb)) {
    const val = backupDb[k];
    console.log(`  ${k}: ${Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : val)}`);
  }
} catch (err) {
  console.error('Error inspecting databases:', err.message);
}
