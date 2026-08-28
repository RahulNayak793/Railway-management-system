const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const backupPath = path.join(__dirname, '../../data/db.json.bak.root_fix');

console.log('=== ROOT DB CLEANUP & BACKUP SCRIPT ===');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: backend/data/db.json does not exist!');
  process.exit(1);
}

// 1. Create Backup
fs.copyFileSync(dbPath, backupPath);
if (!fs.existsSync(backupPath)) {
  console.error('❌ Backup creation failed!');
  process.exit(1);
}
console.log(`✅ Backup successfully created at: ${backupPath}`);
console.log(`  File size: ${fs.statSync(backupPath).size} bytes`);

// 2. Read and Audit
const rawData = fs.readFileSync(dbPath, 'utf-8');
const data = JSON.parse(rawData);

const bookingsMap = new Map(data.bookings || []);
const trainsMap = new Map(data.trains || []);
const seatAllocationsMap = new Map(data.seat_allocations || []);
const paymentsMap = new Map(data.payments || []);

console.log(`\nOriginal Bookings Count: ${bookingsMap.size}`);

const knownTestPassengerIds = new Set(['usr-test-user-pnr-check', 'usr-passenger-test', 'usr-demo-test-account']);
const knownTestPnrs = new Set(['8819203941', '7462573954', '9842105731', '2345678901']);

let genuinePreservedCount = 0;
let testPollutionRemovedCount = 0;
const removedBookingIds = [];
const preservedBookingIds = [];

for (const [id, booking] of Array.from(bookingsMap.entries())) {
  if (!booking) continue;

  const isTestId = String(id).startsWith('bk-seed-') || knownTestPassengerIds.has(booking.passenger_id) || knownTestPnrs.has(booking.pnr_number);
  const trainExists = booking.train_id && trainsMap.has(booking.train_id);

  // If train_id is missing or orphaned test train (deleted by test runs), or explicit test ID -> Test Pollution
  if (isTestId || !trainExists) {
    bookingsMap.delete(id);
    removedBookingIds.push(id);
    testPollutionRemovedCount++;

    // Remove associated allocations and payments
    for (const [allocId, alloc] of Array.from(seatAllocationsMap.entries())) {
      if (alloc && alloc.booking_id === id) {
        seatAllocationsMap.delete(allocId);
      }
    }
    for (const [payId, pay] of Array.from(paymentsMap.entries())) {
      if (pay && pay.booking_id === id) {
        paymentsMap.delete(payId);
      }
    }
  } else {
    genuinePreservedCount++;
    preservedBookingIds.push(id);
  }
}

console.log(`\nCleanup Results:`);
console.log(`  - Test pollution records removed: ${testPollutionRemovedCount}`);
console.log(`  - Genuine passenger records preserved: ${genuinePreservedCount}`);
console.log(`  - Preserved Booking IDs: ${preservedBookingIds.join(', ') || 'None'}`);

data.bookings = Array.from(bookingsMap.entries());
data.seat_allocations = Array.from(seatAllocationsMap.entries());
data.payments = Array.from(paymentsMap.entries());

// Atomic save
const tmpPath = `${dbPath}.tmp.${process.pid}`;
fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
fs.renameSync(tmpPath, dbPath);

console.log(`\nFinal Production Bookings Count: ${bookingsMap.size}`);
console.log('✅ Cleaned db.json saved successfully!');
