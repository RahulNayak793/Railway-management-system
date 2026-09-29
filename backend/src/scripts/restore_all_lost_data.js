const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');

// Read current db
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

// Backup files to merge from
const backupFiles = [
  'test-db.json',
  'db.json.bak.master_fix',
  'db.json.backup_before_staff_cleanup',
  'db.json.backup_before_passenger_auth_upgrade',
  'db.json.backup_before_payment_realism_upgrade',
  'db.json.backup_before_real_rac_wl_rules',
  'db.json.backup_staff_management',
  'db.json.backup-before-dummy-cleanup'
];

console.log('======================================================');
console.log('🚆 INTELLIGENT DATA MERGE & RESTORATION PROCESSOR');
console.log('======================================================\n');

const restoredStats = {};
const initialCounts = {};
const finalCounts = {};

// Collections to inspect and merge
const targetCollections = [
  'profiles', 'users', 'staff_profiles', 'staff_permissions',
  'trains', 'stations', 'routes', 'seats', 'bookings', 'seat_allocations',
  'payments', 'support_tickets', 'notifications', 'cancellation_records',
  'catering_companies', 'catering_menu', 'catering_orders',
  'staff_duties', 'staff_daily_reports', 'staff_incidents', 'staff_tasks',
  'wallets', 'wallet_transactions'
];

for (const col of targetCollections) {
  let list = currentDb[col] || [];
  initialCounts[col] = Array.isArray(list) ? list.length : 0;

  // Build key map for current database entries
  const existingMap = new Map();

  if (Array.isArray(list)) {
    list.forEach(entry => {
      if (Array.isArray(entry) && entry.length === 2) {
        const [k, v] = entry;
        existingMap.set(String(k), v);
      } else if (entry && typeof entry === 'object') {
        const idKey = entry.id || entry.pnr_number || entry.email || entry.station_code;
        if (idKey) existingMap.set(String(idKey), entry);
      }
    });
  }

  let addedForCol = 0;

  for (const backupFile of backupFiles) {
    const backupPath = path.join(dataDir, backupFile);
    if (!fs.existsSync(backupPath)) continue;

    try {
      const bData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const bList = bData[col];
      if (!bList) continue;

      const itemsToProcess = [];

      if (Array.isArray(bList)) {
        bList.forEach(entry => {
          if (Array.isArray(entry) && entry.length === 2) {
            itemsToProcess.push({ key: String(entry[0]), obj: entry[1] });
          } else if (entry && typeof entry === 'object') {
            const key = entry.id || entry.pnr_number || entry.email || entry.station_code;
            if (key) itemsToProcess.push({ key: String(key), obj: entry });
          }
        });
      }

      for (const { key, obj } of itemsToProcess) {
        if (!key || existingMap.has(key)) continue;

        // Extra safety checks against duplicate business fields
        if (col === 'profiles' || col === 'staff_profiles') {
          const email = (obj.email || '').toLowerCase();
          if (email) {
            let emailAlreadyInDb = false;
            for (const [, val] of existingMap.entries()) {
              if ((val.email || '').toLowerCase() === email) {
                emailAlreadyInDb = true;
                break;
              }
            }
            if (emailAlreadyInDb) continue;
          }
        }

        if (col === 'trains') {
          const tNum = obj.train_number;
          if (tNum) {
            let trainNumAlreadyInDb = false;
            for (const [, val] of existingMap.entries()) {
              if (val.train_number === tNum) {
                trainNumAlreadyInDb = true;
                break;
              }
            }
            if (trainNumAlreadyInDb) continue;
          }
        }

        if (col === 'bookings') {
          const pnr = obj.pnr_number;
          if (pnr) {
            let pnrAlreadyInDb = false;
            for (const [, val] of existingMap.entries()) {
              if (val.pnr_number === pnr) {
                pnrAlreadyInDb = true;
                break;
              }
            }
            if (pnrAlreadyInDb) continue;
          }
        }

        // Add record to existing map
        existingMap.set(key, obj);
        addedForCol++;
      }
    } catch (err) {
      // skip invalid format
    }
  }

  // Convert back to Array of [key, value] pairs for db.json storage format
  const mergedArray = [];
  for (const [k, v] of existingMap.entries()) {
    mergedArray.push([k, v]);
  }

  currentDb[col] = mergedArray;
  finalCounts[col] = mergedArray.length;
  restoredStats[col] = addedForCol;
}

// Write restored data to backend/data/db.json
fs.writeFileSync(currentDbPath, JSON.stringify(currentDb, null, 2), 'utf8');

console.log('RESTORATION RECORD SUMMARY:');
for (const col of targetCollections) {
  console.log(`  * ${col.padEnd(22)}: Before=${String(initialCounts[col]).padStart(3)}, Restored=+${String(restoredStats[col]).padStart(3)}, Final=${String(finalCounts[col]).padStart(3)}`);
}

console.log('\n======================================================');
console.log('✅ DATABASE RESTORATION & MERGE COMPLETED SUCCESSFULLY!');
console.log('======================================================');
