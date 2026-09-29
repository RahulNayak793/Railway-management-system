const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const testDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'test-db.json'), 'utf8'));

console.log('=== TEST-DB.JSON STAFF DATA ===');
const staffKeys = ['staff_profiles', 'staff_permissions', 'staff_duties', 'staff_daily_reports', 'staff_incidents', 'staff_tasks', 'service_requests', 'notifications', 'staff_audit_logs'];

for (const k of staffKeys) {
  const val = testDb[k];
  console.log(`${k}: isArray=${Array.isArray(val)}, length=${val ? (Array.isArray(val) ? val.length : Object.keys(val).length) : 0}`);
}
