const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

function getCount(colName) {
  const raw = currentDb[colName];
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === 'object') return Object.keys(raw).length;
  return 0;
}

console.log('=== VERIFY CLEANED DATABASE RECORD COUNTS ===\n');
console.log('Profiles          :', getCount('profiles'));
console.log('Staff Profiles    :', getCount('staff_profiles'));
console.log('Trains            :', getCount('trains'));
console.log('Stations          :', getCount('stations'));
console.log('Routes            :', getCount('routes'));
console.log('Bookings          :', getCount('bookings'));
console.log('Seat Allocations  :', getCount('seat_allocations'));
console.log('Payments          :', getCount('payments'));
console.log('Catering Companies:', getCount('catering_companies'));
console.log('Wallets           :', getCount('wallets'));
console.log('Wallet Txns       :', getCount('wallet_transactions'));

// Verify Uncertain IDs are 100% present in db.json
const UNCERTAIN_IDS = [
  'user-admin-1',
  'usr-partner-1',
  'stf-1788361589156',
  't-co0fa2xs2',
  't-kii9i4f2x',
  't-f6llzt119',
  't-ldn34nqkb',
  't-0qyd5vkpq',
  't-2mgu8j4rb'
];

console.log('\n--- VERIFYING ALL 9 UNCERTAIN RECORDS ARE KEPT ---');
for (const id of UNCERTAIN_IDS) {
  let found = false;
  for (const col of ['profiles', 'staff_profiles', 'trains']) {
    const list = currentDb[col] || [];
    if (list.some(entry => Array.isArray(entry) && String(entry[0]) === id)) {
      found = true;
      break;
    }
  }
  console.log(`  * Uncertain Record '${id}': ${found ? '✅ PRESERVED' : '❌ MISSING'}`);
}
