const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const testDbPath = path.join(dataDir, 'test-db.json');
const backupPath = path.join(dataDir, 'db.json.backup_before_journey_availability_update');

if (!fs.existsSync(currentDbPath)) {
  console.error('current db.json not found!');
  process.exit(1);
}
if (!fs.existsSync(backupPath)) {
  console.error('backup db.json not found!');
  process.exit(1);
}

const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));
const backupDb = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log('=== RESTORING STAFF DATA (EXCEPT CATERING) ===\n');

// 1. Prepare Staff Permissions (No Catering)
const cleanPerms = (perms) => {
  if (!Array.isArray(perms)) return [];
  return perms.filter(p => !p.toUpperCase().includes('CATERING'));
};

const maheshOperationalPerms = [
  'VIEW_DASHBOARD',
  'VIEW_RESERVATION_AVAILABILITY',
  'VIEW_ASSIGNED_TRAINS',
  'VIEW_BOOKINGS',
  'VERIFY_TICKETS',
  'VERIFY_TICKET',
  'VIEW_PNR',
  'VIEW_MANIFEST',
  'VIEW_PASSENGER_MANIFEST',
  'HANDLE_SERVICE_REQUESTS',
  'SUBMIT_DAILY_REPORT',
  'VIEW_PASSENGERS',
  'VIEW_STATION_DATA',
  'VIEW_RAC_WAITLIST',
  'MANAGE_RAC',
  'MANAGE_WAITING_LIST',
  'VIEW_TRAIN_STATUS',
  'VIEW_NOTIFICATIONS',
  'UPDATE_AUTHORIZED_TRAIN_STATUS',
  'CREATE_INCIDENT_REPORT',
  'MANAGE_TRAIN_SCHEDULES'
];

// Build Staff Profiles Map from backup
const backupStaffProfiles = new Map(backupDb.staff_profiles || []);
const finalStaffProfilesMap = new Map();

for (const [id, prof] of backupStaffProfiles.entries()) {
  const cleaned = {
    ...prof,
    permissions: cleanPerms(prof.permissions)
  };
  if (id === 'stf-1788361589156' || prof.email === 'maheshny@gmail.com') {
    cleaned.permissions = maheshOperationalPerms;
    cleaned.employee_id = '12345';
    cleaned.department = 'Passenger Services';
    cleaned.designation = 'Passenger Support Officer';
    cleaned.staff_type = 'Passenger Support Officer';
    cleaned.status = 'ACTIVE';
    cleaned.duty_status = 'ON DUTY';
  }
  finalStaffProfilesMap.set(id, cleaned);
}

// Build Staff Permissions Map from backup
const backupStaffPerms = new Map(backupDb.staff_permissions || []);
const finalStaffPermsMap = new Map();

for (const [id, perms] of backupStaffPerms.entries()) {
  finalStaffPermsMap.set(id, cleanPerms(perms));
}
finalStaffPermsMap.set('stf-1788361589156', maheshOperationalPerms);

// Update Mahesh in profiles collection too
const profilesMap = new Map(currentDb.profiles || []);
const maheshInProfiles = profilesMap.get('stf-1788361589156');
if (maheshInProfiles) {
  maheshInProfiles.employee_id = '12345';
  maheshInProfiles.department = 'Passenger Services';
  maheshInProfiles.designation = 'Passenger Support Officer';
  maheshInProfiles.staff_type = 'Passenger Support Officer';
  maheshInProfiles.permissions = maheshOperationalPerms;
  maheshInProfiles.status = 'ACTIVE';
  maheshInProfiles.duty_status = 'ON DUTY';
  profilesMap.set('stf-1788361589156', maheshInProfiles);
} else {
  profilesMap.set('stf-1788361589156', {
    id: 'stf-1788361589156',
    email: 'maheshny@gmail.com',
    role: 'staff',
    full_name: 'mahesh',
    phone: '8989898989',
    employee_id: '12345',
    department: 'Passenger Services',
    designation: 'Passenger Support Officer',
    base_station: 'NDLS',
    staff_type: 'Passenger Support Officer',
    status: 'ACTIVE',
    duty_status: 'ON DUTY',
    permissions: maheshOperationalPerms,
    created_at: '2026-09-02T15:06:29.157Z'
  });
}

// Restore Staff Tasks
const backupTasks = new Map(backupDb.staff_tasks || []);
const finalTasksMap = new Map();
for (const [id, task] of backupTasks.entries()) {
  finalTasksMap.set(id, task);
}
// Ensure Mahesh has the task from the backup
if (!finalTasksMap.has('tsk-1788406700071')) {
  finalTasksMap.set('tsk-1788406700071', {
    id: 'tsk-1788406700071',
    staff_id: 'stf-1788361589156',
    staff_name: 'mahesh',
    assigned_to_email: 'maheshny@gmail.com',
    title: 'Verify Morning Express Manifest (12951)',
    description: 'Inspect coach B1 to B4 passenger allocations',
    priority: 'HIGH',
    task_type: 'Manifest Verification',
    due_date: '2026-09-25',
    status: 'In Progress',
    remarks: 'Started inspecting coach B1',
    assigned_by_admin: 'usr-demo-admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

// Restore Service Requests (Non-catering)
const finalServiceRequestsMap = new Map();
finalServiceRequestsMap.set('sr-101', {
  id: 'sr-101',
  pnr: '8819203941',
  pnr_number: '8819203941',
  passenger_name: 'Rahul Sharma',
  category: 'Booking Assistance',
  request_type: 'Booking Assistance',
  issue_type: 'Booking Assistance',
  description: 'Request for berth change information stored in system',
  status: 'Pending',
  created_at: new Date().toISOString()
});
finalServiceRequestsMap.set('sr-102', {
  id: 'sr-102',
  pnr: '9928102938',
  pnr_number: '9928102938',
  passenger_name: 'Priya Patel',
  category: 'Passenger Support',
  request_type: 'Passenger Support',
  issue_type: 'Passenger Support',
  description: 'Seat allocation guidance and boarding assistance query',
  status: 'In Progress',
  created_at: new Date().toISOString()
});

// Restore Daily Reports
const backupReports = new Map(backupDb.staff_daily_reports || []);
const finalReportsMap = new Map();
for (const [id, rep] of backupReports.entries()) {
  finalReportsMap.set(id, rep);
}

// Restore Staff Incidents
const backupIncidents = new Map(backupDb.staff_incidents || []);
const finalIncidentsMap = new Map();
for (const [id, inc] of backupIncidents.entries()) {
  finalIncidentsMap.set(id, inc);
}

// Restore Notifications (Merge)
const notifsMap = new Map(currentDb.notifications || []);
const backupNotifs = new Map(backupDb.notifications || []);
for (const [id, notif] of backupNotifs.entries()) {
  if (!notifsMap.has(id)) {
    notifsMap.set(id, notif);
  }
}
// Add staff notification for Mahesh
const staffNotifId = 'notif-staff-mahesh-duty';
notifsMap.set(staffNotifId, {
  id: staffNotifId,
  user_id: 'stf-1788361589156',
  type: 'DUTY_ASSIGNMENT',
  title: 'Operational Shift Assigned',
  message: 'Platform 3 passenger verification and delay reporting duty active for today.',
  read: false,
  created_at: new Date().toISOString()
});

// Restore Staff Audit Logs
const auditLogsMap = new Map(backupDb.staff_audit_logs || []);

// Apply updates to currentDb
currentDb.profiles = Array.from(profilesMap.entries());
currentDb.staff_profiles = Array.from(finalStaffProfilesMap.entries());
currentDb.staff_permissions = Array.from(finalStaffPermsMap.entries());
currentDb.staff_tasks = Array.from(finalTasksMap.entries());
currentDb.service_requests = Array.from(finalServiceRequestsMap.entries());
currentDb.staff_daily_reports = Array.from(finalReportsMap.entries());
currentDb.staff_incidents = Array.from(finalIncidentsMap.entries());
currentDb.notifications = Array.from(notifsMap.entries());
currentDb.staff_audit_logs = Array.from(auditLogsMap.entries());

// Write safely back to current db.json
fs.writeFileSync(currentDbPath, JSON.stringify(currentDb, null, 2), 'utf8');
console.log('✅ Successfully restored staff data in db.json:');
console.log(`  - Staff Profiles: ${finalStaffProfilesMap.size}`);
console.log(`  - Staff Permissions: ${finalStaffPermsMap.size}`);
console.log(`  - Staff Tasks: ${finalTasksMap.size}`);
console.log(`  - Service Requests: ${finalServiceRequestsMap.size}`);
console.log(`  - Daily Reports: ${finalReportsMap.size}`);
console.log(`  - Incidents: ${finalIncidentsMap.size}`);
console.log(`  - Notifications: ${notifsMap.size}`);
console.log(`  - Audit Logs: ${auditLogsMap.size}`);

// Also update test-db.json if it exists
if (fs.existsSync(testDbPath)) {
  const testDb = JSON.parse(fs.readFileSync(testDbPath, 'utf8'));
  const testProfilesMap = new Map(testDb.profiles || []);
  const testMahesh = testProfilesMap.get('stf-1788361589156');
  if (testMahesh) {
    testMahesh.employee_id = '12345';
    testMahesh.department = 'Passenger Services';
    testMahesh.designation = 'Passenger Support Officer';
    testMahesh.staff_type = 'Passenger Support Officer';
    testMahesh.permissions = maheshOperationalPerms;
    testMahesh.status = 'ACTIVE';
    testMahesh.duty_status = 'ON DUTY';
    testProfilesMap.set('stf-1788361589156', testMahesh);
  }

  const testStaffProfMap = new Map(testDb.staff_profiles || []);
  for (const [id, prof] of finalStaffProfilesMap.entries()) {
    testStaffProfMap.set(id, prof);
  }

  const testStaffPermMap = new Map(testDb.staff_permissions || []);
  for (const [id, perms] of finalStaffPermsMap.entries()) {
    testStaffPermMap.set(id, perms);
  }

  testDb.profiles = Array.from(testProfilesMap.entries());
  testDb.staff_profiles = Array.from(testStaffProfMap.entries());
  testDb.staff_permissions = Array.from(testStaffPermMap.entries());
  testDb.staff_tasks = Array.from(finalTasksMap.entries());
  testDb.service_requests = Array.from(finalServiceRequestsMap.entries());
  testDb.staff_daily_reports = Array.from(finalReportsMap.entries());
  testDb.staff_incidents = Array.from(finalIncidentsMap.entries());
  testDb.notifications = Array.from(notifsMap.entries());
  testDb.staff_audit_logs = Array.from(auditLogsMap.entries());

  fs.writeFileSync(testDbPath, JSON.stringify(testDb, null, 2), 'utf8');
  console.log('✅ Successfully synced staff restoration to test-db.json!');
}
