const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');

const candidateBackups = [
  'db.json.backup_before_journey_availability_update',
  'db.json.backup_route_master_20260917',
  'db.json.bak.1789647671347',
  'db.json.backup_before_staff_cleanup',
  'db.json.backup_before_upcoming_train_filtering',
  'db.json.backup_before_railcontrol_pnr_validation',
  'test-db.json'
];

for (const b of candidateBackups) {
  const filePath = path.join(dataDir, b);
  if (!fs.existsSync(filePath)) continue;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`\n========================================`);
    console.log(`SNAPSHOT: ${b}`);
    console.log(`========================================`);
    
    // Profiles
    const profs = Array.isArray(data.staff_profiles) ? data.staff_profiles : Object.entries(data.staff_profiles || {});
    console.log(`Staff Profiles count: ${profs.length}`);
    profs.slice(0, 5).forEach(p => {
      const item = Array.isArray(p) ? p[1] : p;
      console.log(`  - ${item.id} | ${item.full_name} | ${item.email} | ${item.designation} | perms: ${item.permissions?.length || 0}`);
    });

    // Duties
    const duties = Array.isArray(data.staff_duties) ? data.staff_duties : Object.entries(data.staff_duties || {});
    console.log(`Staff Duties count: ${duties.length}`);
    duties.slice(0, 5).forEach(d => {
      const item = Array.isArray(d) ? d[1] : d;
      console.log(`  - Duty: ${item.id} | staff: ${item.staff_id || item.staff_name} | shift: ${item.shift} | train: ${item.train_number || item.train_name}`);
    });

    // Tasks
    const tasks = Array.isArray(data.staff_tasks) ? data.staff_tasks : Object.entries(data.staff_tasks || {});
    console.log(`Staff Tasks count: ${tasks.length}`);
    tasks.forEach(t => {
      const item = Array.isArray(t) ? t[1] : t;
      console.log(`  - Task: ${item.id} | ${item.title} | staff: ${item.staff_id || item.staff_email || item.assigned_to} | status: ${item.status}`);
    });

    // Service requests
    const sreqs = Array.isArray(data.service_requests) ? data.service_requests : Object.entries(data.service_requests || {});
    console.log(`Service Requests count: ${sreqs.length}`);
    sreqs.forEach(sr => {
      const item = Array.isArray(sr) ? sr[1] : sr;
      console.log(`  - SR: ${item.id} | ${item.pnr || item.pnr_number} | ${item.category || item.request_type} | ${item.status}`);
    });

    // Reports
    const reports = Array.isArray(data.staff_daily_reports) ? data.staff_daily_reports : Object.entries(data.staff_daily_reports || {});
    console.log(`Daily Reports count: ${reports.length}`);

    // Incidents
    const incidents = Array.isArray(data.staff_incidents) ? data.staff_incidents : Object.entries(data.staff_incidents || {});
    console.log(`Incidents count: ${incidents.length}`);

  } catch (e) {
    console.error(`Error reading ${b}:`, e.message);
  }
}
