const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

const files = fs.readdirSync(dataDir).filter(f => f.startsWith('db.json') || f.endsWith('.json') || f.endsWith('.bak'));

const collections = [
  'profiles', 'users', 'staff_profiles', 'staff_permissions',
  'trains', 'stations', 'routes', 'seats', 'bookings',
  'payments', 'support_tickets', 'catering_companies',
  'catering_menu', 'catering_orders', 'staff_duties',
  'staff_daily_reports', 'staff_incidents', 'staff_tasks'
];

console.log('--- MISSING RECORDS IDENTIFICATION ---\n');

const currentIds = {};
for (const c of collections) {
  currentIds[c] = new Set();
  const list = currentDb[c] || [];
  if (Array.isArray(list)) {
    list.forEach(item => { if (item.id) currentIds[c].add(String(item.id)); });
  }
}

for (const file of files) {
  if (file === 'db.json' || file.startsWith('db.json.backup_before_data_restore') || file.startsWith('db.json.final_audit_backup')) continue;

  const filePath = path.join(dataDir, file);
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) continue;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let missingFound = 0;

    for (const c of collections) {
      const list = data[c] || [];
      if (Array.isArray(list)) {
        const missing = list.filter(item => item && item.id && !currentIds[c].has(String(item.id)));
        if (missing.length > 0) {
          if (missingFound === 0) console.log(`\n📄 Backup File: ${file}`);
          missingFound += missing.length;
          console.log(`  - Missing in collection '${c}': ${missing.length} items`);
          if (c === 'trains') {
            missing.forEach(t => console.log(`    * Train: ${t.id} (${t.train_number} - ${t.train_name})`));
          } else if (c === 'bookings') {
            missing.forEach(b => console.log(`    * Booking: ${b.id} (PNR: ${b.pnr_number}, Status: ${b.status}, Train: ${b.train_id})`));
          } else if (c === 'profiles') {
            missing.forEach(p => console.log(`    * Profile: ${p.id} (${p.email}, Role: ${p.role})`));
          } else if (c === 'staff_profiles') {
            missing.forEach(s => console.log(`    * Staff: ${s.id} (${s.email}, Role: ${s.role})`));
          }
        }
      }
    }
  } catch (e) {
    // skip parse errors
  }
}
