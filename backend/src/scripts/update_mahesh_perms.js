const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const staffProfilesMap = new Map(db.staff_profiles);
const staffPermsMap = new Map(db.staff_permissions);

const maheshId = 'stf-1788361589156';
const maheshProfile = staffProfilesMap.get(maheshId) || Array.from(staffProfilesMap.values()).find(s => s && s.email === 'maheshny@gmail.com');

if (!maheshProfile) {
  console.error('Mahesh profile not found!');
  process.exit(1);
}

console.log('BEFORE Mahesh Profile Permissions:', maheshProfile.permissions);
console.log('BEFORE Mahesh Perms Map:', staffPermsMap.get(maheshProfile.id));

if (!maheshProfile.permissions.includes('MANAGE_TRAIN_SCHEDULES')) {
  maheshProfile.permissions.push('MANAGE_TRAIN_SCHEDULES');
}

const updatedMapPerms = Array.from(new Set([...(staffPermsMap.get(maheshProfile.id) || []), 'MANAGE_TRAIN_SCHEDULES']));

staffProfilesMap.set(maheshProfile.id, maheshProfile);
staffPermsMap.set(maheshProfile.id, updatedMapPerms);

db.staff_profiles = Array.from(staffProfilesMap.entries());
db.staff_permissions = Array.from(staffPermsMap.entries());

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

console.log('AFTER Mahesh Profile Permissions:', maheshProfile.permissions);
console.log('AFTER Mahesh Perms Map:', staffPermsMap.get(maheshProfile.id));
console.log('✅ Mahesh permissions updated successfully in db.json!');
