const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

const backupPath = path.join(dataDir, 'db.json.backup_before_journey_availability_update');
const backupDb = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log('=== RESTORATION PREVIEW ===');
console.log('CURRENT DB:');
console.log('  Trains:', currentDb.trains?.length);
console.log('  Bookings:', currentDb.bookings?.length);
console.log('  Routes:', currentDb.routes?.length);
console.log('  Stations:', currentDb.stations?.length);
console.log('  Profiles:', currentDb.profiles?.length);
console.log('  Staff Profiles:', currentDb.staff_profiles?.length);
console.log('  Staff Permissions:', currentDb.staff_permissions?.length);
console.log('  Staff Tasks:', currentDb.staff_tasks?.length);
console.log('  Staff Daily Reports:', currentDb.staff_daily_reports?.length);
console.log('  Staff Incidents:', currentDb.staff_incidents?.length);
console.log('  Service Requests:', currentDb.service_requests?.length);
console.log('  Notifications:', currentDb.notifications?.length);

console.log('\nBACKUP DB TO RESTORE FROM:');
console.log('  Staff Profiles in backup:', backupDb.staff_profiles?.length);
console.log('  Staff Permissions in backup:', backupDb.staff_permissions?.length);
console.log('  Staff Tasks in backup:', backupDb.staff_tasks?.length);
console.log('  Staff Daily Reports in backup:', backupDb.staff_daily_reports?.length);
console.log('  Staff Incidents in backup:', backupDb.staff_incidents?.length);
console.log('  Service Requests in backup:', backupDb.service_requests?.length);
console.log('  Notifications in backup:', backupDb.notifications?.length);
console.log('  Staff Audit Logs in backup:', backupDb.staff_audit_logs?.length);
