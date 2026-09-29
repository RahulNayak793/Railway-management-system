const path = require('path');
const fs = require('fs');
const assert = require('assert');

const dbPath = path.join(__dirname, '../../data/db.json');

console.log('🔍 Executing Cold Database File Audit on:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('❌ FATAL: db.json file does not exist!');
  process.exit(1);
}

const rawData = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(rawData);

console.log('📊 Cold DB Stats:');
console.log('  - Staff Profiles:', data.staff_profiles ? data.staff_profiles.length : 0);
console.log('  - Staff Daily Reports:', data.staff_daily_reports ? data.staff_daily_reports.length : 0);
console.log('  - Staff Audit Logs:', data.staff_audit_logs ? data.staff_audit_logs.length : 0);
console.log('  - Service Requests:', data.service_requests ? data.service_requests.length : 0);
console.log('  - Catering Orders:', data.catering_orders ? data.catering_orders.length : 0);
console.log('  - Bookings:', data.bookings ? data.bookings.length : 0);
console.log('  - Trains:', data.trains ? data.trains.length : 0);
console.log('  - Routes:', data.routes ? data.routes.length : 0);
console.log('  - Stations:', data.stations ? data.stations.length : 0);

// Assertions
assert.ok(data.staff_profiles && data.staff_profiles.length > 0, 'Staff profiles persisted');
assert.ok(data.staff_daily_reports && data.staff_daily_reports.length > 0, 'Staff daily reports persisted');
assert.ok(data.staff_audit_logs && data.staff_audit_logs.length > 0, 'Staff audit logs persisted');
assert.ok(data.bookings && data.bookings.length >= 9, 'Bookings preserved');
assert.ok(data.trains && data.trains.length >= 5, 'Trains preserved');
assert.ok(data.routes && data.routes.length >= 1700, 'Routes preserved');
assert.ok(data.stations && data.stations.length >= 160, 'Stations preserved');

console.log('✅ COLD DATABASE FILE PERSISTENCE AUDIT PASSED 100%!');
