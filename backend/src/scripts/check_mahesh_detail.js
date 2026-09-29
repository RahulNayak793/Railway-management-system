const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const bData = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json.backup_before_journey_availability_update'), 'utf8'));

const staffProfiles = new Map(bData.staff_profiles || []);
const staffPerms = new Map(bData.staff_permissions || []);

const mahesh = staffProfiles.get('stf-1788361589156');
console.log('Mahesh Profile:', mahesh);
console.log('Mahesh Perms in map:', staffPerms.get('stf-1788361589156'));

console.log('\nAll Staff Profiles in backup:');
for (const [id, p] of staffProfiles.entries()) {
  console.log(id, p.full_name, p.email, p.designation, p.status);
}

console.log('\nAll Staff Tasks in backup:');
const tasks = new Map(bData.staff_tasks || []);
for (const [id, t] of tasks.entries()) {
  console.log(id, t);
}

console.log('\nAll Service Requests in backup:');
const sreqs = new Map(bData.service_requests || []);
for (const [id, sr] of sreqs.entries()) {
  console.log(id, sr);
}

console.log('\nSample Daily Reports in backup:');
const reports = new Map(bData.staff_daily_reports || []);
let rCount = 0;
for (const [id, r] of reports.entries()) {
  if (rCount++ < 3) console.log(id, r.staff_name, r.report_date, r.shift, r.status);
}

console.log('\nSample Incidents in backup:');
const incidents = new Map(bData.staff_incidents || []);
let iCount = 0;
for (const [id, inc] of incidents.entries()) {
  if (iCount++ < 3) console.log(id, inc.title, inc.category, inc.severity, inc.status);
}
