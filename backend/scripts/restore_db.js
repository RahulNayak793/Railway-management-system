const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '../data/db.json.backup_train_status_date_isolation_2026-09-23T16-02-10-227Z');
const dbPath = path.join(__dirname, '../data/db.json');

fs.copyFileSync(backupPath, dbPath);
console.log('Successfully restored db.json from backup:', backupPath);
