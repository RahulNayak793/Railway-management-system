const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const content = fs.readFileSync(dbPath);
const hash = crypto.createHash('sha256').update(content).digest('hex');

console.log('BASELINE_SHA256=' + hash);
console.log('BASELINE_SIZE=' + content.length);

const db = JSON.parse(content.toString('utf8'));
const counts = {};
Object.keys(db).forEach(k => {
  counts[k] = Array.isArray(db[k]) ? db[k].length : typeof db[k];
});

console.log('BASELINE_TABLE_COUNTS=' + JSON.stringify(counts, null, 2));

// Record sample IDs of critical tables to ensure zero data alteration
const sampleIds = {
  profiles_sample: (db.profiles || []).slice(0, 5).map(x => x[0]),
  trains_sample: (db.trains || []).slice(0, 5).map(x => x[0]),
  bookings_all: (db.bookings || []).map(x => ({ id: x[0], pnr: x[1]?.pnr_number, status: x[1]?.status })),
  seat_allocations_count: (db.seat_allocations || []).length
};

fs.writeFileSync(
  path.join(__dirname, '../../data/baseline_audit_before_tte_upgrade.json'),
  JSON.stringify({ baseline_hash: hash, baseline_size: content.length, counts, sampleIds, timestamp: new Date().toISOString() }, null, 2)
);

console.log('Audit baseline saved to backend/data/baseline_audit_before_tte_upgrade.json');
