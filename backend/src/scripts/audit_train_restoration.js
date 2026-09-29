const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const backupPath = path.join(dataDir, 'db.json.backup_before_journey_availability_update');

console.log('=== TRAIN RESTORATION AUDIT ===');
console.log('Current DB:', currentDbPath);
console.log('Backup DB:', backupPath);

const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));
const backupDb = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

function extractEntries(colData) {
  const map = new Map();
  if (Array.isArray(colData)) {
    for (const item of colData) {
      if (Array.isArray(item) && item.length === 2) {
        map.set(String(item[0]), item[1]);
      } else if (item && typeof item === 'object') {
        const id = item.id || item.train_number || item.pnr_number || item.email || item.code;
        if (id) map.set(String(id), item);
      }
    }
  } else if (colData && typeof colData === 'object') {
    for (const [k, v] of Object.entries(colData)) {
      map.set(String(k), v);
    }
  }
  return map;
}

const currentTrains = extractEntries(currentDb.trains);
const backupTrains = extractEntries(backupDb.trains);

console.log(`\nCurrent DB Trains Count: ${currentTrains.size}`);
console.log(`Backup DB Trains Count:  ${backupTrains.size}`);

const missingTrains = [];
for (const [id, t] of backupTrains.entries()) {
  const tNum = t.train_number || t.number;
  const existingByNum = Array.from(currentTrains.values()).find(ct => (ct.train_number || ct.number) === tNum);
  if (!currentTrains.has(id) && !existingByNum) {
    missingTrains.push({ id, number: tNum, name: t.train_name || t.name, type: t.train_type || t.type });
  }
}

console.log(`Missing Trains in Current DB: ${missingTrains.length}`);
console.log('Sample missing trains:');
missingTrains.slice(0, 15).forEach(t => console.log(`  - #${t.number}: ${t.name} (${t.type}) [ID: ${t.id}]`));

// Check other collections
const collections = [
  'profiles', 'users', 'staff_profiles', 'staff_permissions',
  'trains', 'stations', 'routes', 'seats', 'bookings', 'seat_allocations',
  'payments', 'support_tickets', 'catering_companies', 'catering_menu',
  'catering_orders', 'staff_duties', 'staff_daily_reports', 'staff_incidents',
  'staff_tasks', 'policies', 'train_services'
];

console.log('\n--- COLLECTION COMPARISON ---');
console.log('Collection'.padEnd(25) + 'Current'.padEnd(12) + 'Backup'.padEnd(12) + 'Diff');
for (const c of collections) {
  const curMap = extractEntries(currentDb[c]);
  const bkpMap = extractEntries(backupDb[c]);
  console.log(c.padEnd(25) + String(curMap.size).padEnd(12) + String(bkpMap.size).padEnd(12) + `+${bkpMap.size - curMap.size}`);
}
