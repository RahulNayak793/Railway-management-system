const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');

// Read current database
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

// List of all backup files to merge from, ordered from most relevant to oldest
const backupFiles = [
  'test-db.json',
  'db.json.backup_before_staff_cleanup',
  'db.json.bak.master_fix',
  'db.json.backup_before_passenger_auth_upgrade',
  'db.json.backup_before_payment_realism_upgrade',
  'db.json.backup_before_real_rac_wl_rules',
  'db.json.backup_staff_management',
  'db.json.backup-before-dummy-cleanup'
];

console.log('=== INTELLIGENT SAFE MERGE OF ALL RAILWAY DATABASE SNAPSHOTS ===\n');

const statsMerged = {};

function mergeCollection(colName, idKey = 'id') {
  currentDb[colName] = currentDb[colName] || [];
  if (!Array.isArray(currentDb[colName])) return;

  const existingIds = new Set(currentDb[colName].map(item => String(item[idKey] || item.id || item.pnr_number || item.email)));
  let addedCount = 0;

  for (const file of backupFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const sourceList = data[colName];
      if (!Array.isArray(sourceList)) continue;

      for (const item of sourceList) {
        if (!item) continue;
        const key = String(item[idKey] || item.id || item.pnr_number || item.email);
        if (key && key !== 'undefined' && !existingIds.has(key)) {
          // Additional duplicate check for email if profile/staff
          if (colName === 'profiles' || colName === 'staff_profiles') {
            const emailExists = currentDb[colName].some(x => x.email && x.email.toLowerCase() === (item.email || '').toLowerCase());
            if (emailExists) continue;
          }
          // Additional duplicate check for train_number if trains
          if (colName === 'trains') {
            const trainNumExists = currentDb.trains.some(x => x.train_number === item.train_number);
            if (trainNumExists) continue;
          }
          // Additional duplicate check for PNR if bookings
          if (colName === 'bookings') {
            const pnrExists = currentDb.bookings.some(x => x.pnr_number === item.pnr_number);
            if (pnrExists) continue;
          }

          currentDb[colName].push(item);
          existingIds.add(key);
          addedCount++;
        }
      }
    } catch (e) {
      console.warn(`Error reading ${file} for collection ${colName}:`, e.message);
    }
  }

  statsMerged[colName] = addedCount;
}

// Collections to merge
const collectionsToMerge = [
  'profiles',
  'staff_profiles',
  'staff_permissions',
  'trains',
  'bookings',
  'seat_allocations',
  'payments',
  'support_tickets',
  'notifications',
  'cancellation_records',
  'catering_companies',
  'catering_menu',
  'catering_orders',
  'staff_duties',
  'staff_daily_reports',
  'staff_incidents',
  'staff_tasks',
  'wallets',
  'wallet_transactions'
];

collectionsToMerge.forEach(col => mergeCollection(col));

console.log('Restoration / Merge Summary:');
for (const [col, count] of Object.entries(statsMerged)) {
  console.log(`  - ${col}: +${count} restored records (Total now: ${currentDb[col]?.length || 0})`);
}

// Write merged database to db.json
fs.writeFileSync(currentDbPath, JSON.stringify(currentDb, null, 2), 'utf8');
console.log('\n✅ Merged database successfully written to backend/data/db.json');
