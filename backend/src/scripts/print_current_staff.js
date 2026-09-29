const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));

console.log('=== CURRENT DB.JSON STAFF DATA ===');
const staffKeys = ['staff_profiles', 'staff_permissions', 'staff_duties', 'staff_daily_reports', 'staff_incidents', 'staff_tasks', 'service_requests', 'notifications', 'staff_audit_logs'];

for (const k of staffKeys) {
  const val = currentDb[k];
  console.log(`${k}: isArray=${Array.isArray(val)}, length=${val ? (Array.isArray(val) ? val.length : Object.keys(val).length) : 0}`);
}

const staffProfilesMap = new Map(currentDb.staff_profiles || []);
const staffPermsMap = new Map(currentDb.staff_permissions || []);

console.log('\n--- Staff Profiles in current db.json (' + staffProfilesMap.size + ') ---');
for (const [id, prof] of staffProfilesMap.entries()) {
  console.log(`ID: ${id}, Name: ${prof?.full_name}, Email: ${prof?.email}, Role: ${prof?.role}, Designation: ${prof?.designation}`);
  console.log(`  Profile Permissions:`, prof?.permissions);
  console.log(`  Perms Map:`, staffPermsMap.get(id));
}
