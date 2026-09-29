const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../../data');
const dbPath = path.join(dataDir, 'db.json');
const manifestPath = path.join(dataDir, 'deleted_dummy_records_manifest.json');

const currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Helper to extract items from Map array format [key, value]
function extractCollectionMap(colName) {
  const raw = currentDb[colName] || [];
  const itemsMap = new Map();
  if (Array.isArray(raw)) {
    raw.forEach(entry => {
      if (Array.isArray(entry) && entry.length === 2) {
        itemsMap.set(String(entry[0]), entry[1]);
      } else if (entry && typeof entry === 'object') {
        const id = entry.id || entry.pnr_number || entry.email || entry.station_code;
        if (id) itemsMap.set(String(id), entry);
      }
    });
  }
  return itemsMap;
}

// 9 Uncertain IDs that MUST BE KEPT 100%
const UNCERTAIN_IDS = new Set([
  'user-admin-1',
  'usr-partner-1',
  'stf-1788361589156',
  't-co0fa2xs2',
  't-kii9i4f2x',
  't-f6llzt119',
  't-ldn34nqkb',
  't-0qyd5vkpq',
  't-2mgu8j4rb'
]);

// Patterns matching confirmed test records
const testPatterns = /test|mock|demo|dummy|sample|temp|fake|spec|cypress|jest/i;
const testEmails = /@test\.com|@example\.com|@domain\.com|@transit\.com|@railmail\.com|@mock\.com|@rail\.net|@globemail\.org/i;

const deletedManifest = {
  deleted_at: new Date().toISOString(),
  deleted_records_count: 0,
  deleted_items: []
};

// 1. Staff & Permissions Removal
const staffProfilesMap = extractCollectionMap('staff_profiles');
const staffPermissionsMap = extractCollectionMap('staff_permissions');
const profilesMap = extractCollectionMap('profiles');
const deletedStaffIds = new Set();

for (const [id, s] of staffProfilesMap.entries()) {
  if (UNCERTAIN_IDS.has(id)) continue;

  const email = (s.email || '').toLowerCase();
  const name = s.full_name || s.name || '';

  if (testPatterns.test(id) || testPatterns.test(name) || testEmails.test(email) || id.startsWith('stf-matrix') || email.includes('matrix.staff') || email.includes('test.sm') || email.includes('test.staff')) {
    deletedStaffIds.add(id);
    deletedManifest.deleted_items.push({
      collection: 'staff_profiles',
      id,
      name,
      email,
      reason: 'Confirmed test staff account'
    });
    staffProfilesMap.delete(id);
    staffPermissionsMap.delete(id);
  }
}

// Also remove test staff profiles from main profiles collection if present
for (const [id, p] of profilesMap.entries()) {
  if (UNCERTAIN_IDS.has(id)) continue;
  const email = (p.email || '').toLowerCase();
  const name = p.full_name || p.name || '';

  if ((p.role === 'staff' || p.role === 'admin') && (testPatterns.test(id) || testPatterns.test(name) || testEmails.test(email) || id.startsWith('stf-matrix') || email.includes('matrix.staff') || email.includes('test.sm') || email.includes('test.staff'))) {
    deletedManifest.deleted_items.push({
      collection: 'profiles',
      id,
      name,
      email,
      reason: 'Confirmed test staff profile in profiles'
    });
    profilesMap.delete(id);
  }
}

// 2. Test Trains Removal
const trainsMap = extractCollectionMap('trains');
const deletedTrainIds = new Set();

for (const [id, t] of trainsMap.entries()) {
  if (UNCERTAIN_IDS.has(id)) continue;

  const name = t.train_name || '';
  const num = t.train_number || '';

  if (testPatterns.test(id) || testPatterns.test(name) || t.record_source === 'test' || id.startsWith('t-test') || id.startsWith('t-real-rac-wl') || id === 'train-123' || id === 't-op1asc6ud' || id === 't-11u6v5dob') {
    deletedTrainIds.add(id);
    deletedManifest.deleted_items.push({
      collection: 'trains',
      id,
      number: num,
      name,
      reason: 'Confirmed automated test train fixture'
    });
    trainsMap.delete(id);
  }
}

// 3. Test Bookings Removal
const bookingsMap = extractCollectionMap('bookings');
const seatAllocationsMap = extractCollectionMap('seat_allocations');
const paymentsMap = extractCollectionMap('payments');
const cancellationRecordsMap = extractCollectionMap('cancellation_records');

const deletedBookingIds = new Set();

for (const [id, b] of bookingsMap.entries()) {
  if (UNCERTAIN_IDS.has(id)) continue;

  const pnr = b.pnr_number || '';

  if (testPatterns.test(id) || id.startsWith('bk-seed') || id.startsWith('bk-mock') || id.startsWith('bk-pnr-demo') || id.startsWith('bk-staff-test') || id.startsWith('bk-test') || id.startsWith('bk-rac-test') || id.startsWith('bk-vl9zd5bri') || id.startsWith('bk-ofb5t0rzh') || id.startsWith('bk-936xzfd3y') || id.startsWith('bk-f4yrvoqbi') || id.startsWith('bk-9okkvrmma') || id.startsWith('bk-dfm0a7hw1') || deletedTrainIds.has(b.train_id)) {
    deletedBookingIds.add(id);
    deletedManifest.deleted_items.push({
      collection: 'bookings',
      id,
      pnr,
      status: b.status,
      reason: 'Confirmed test/seed booking record'
    });
    bookingsMap.delete(id);
  }
}

// Clean up associated seat allocations, payments, cancellation records tied to deleted test bookings
for (const [id, alloc] of seatAllocationsMap.entries()) {
  if (deletedBookingIds.has(alloc.booking_id) || testPatterns.test(id)) {
    seatAllocationsMap.delete(id);
  }
}

for (const [id, pay] of paymentsMap.entries()) {
  if (deletedBookingIds.has(pay.booking_id) || testPatterns.test(id) || id.startsWith('pay-bk-seed') || id.startsWith('pay-bk-test')) {
    paymentsMap.delete(id);
  }
}

for (const [id, canc] of cancellationRecordsMap.entries()) {
  if (deletedBookingIds.has(canc.booking_id) || testPatterns.test(id)) {
    cancellationRecordsMap.delete(id);
  }
}

// Convert updated Map entries back to array format [key, value]
function mapToArray(map) {
  const arr = [];
  for (const [k, v] of map.entries()) {
    arr.push([k, v]);
  }
  return arr;
}

currentDb.staff_profiles = mapToArray(staffProfilesMap);
currentDb.staff_permissions = mapToArray(staffPermissionsMap);
currentDb.profiles = mapToArray(profilesMap);
currentDb.trains = mapToArray(trainsMap);
currentDb.bookings = mapToArray(bookingsMap);
currentDb.seat_allocations = mapToArray(seatAllocationsMap);
currentDb.payments = mapToArray(paymentsMap);
currentDb.cancellation_records = mapToArray(cancellationRecordsMap);

deletedManifest.deleted_records_count = deletedManifest.deleted_items.length;

// Write manifest
fs.writeFileSync(manifestPath, JSON.stringify(deletedManifest, null, 2), 'utf8');
console.log(`✅ Deleted records manifest saved to: ${manifestPath}`);
console.log(`   Total dummy records deleted: ${deletedManifest.deleted_records_count}`);

// Write updated database back to db.json
fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2), 'utf8');
console.log(`✅ Updated production database written to: ${dbPath}`);
