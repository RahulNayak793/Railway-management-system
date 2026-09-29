const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

function getCollectionList(colName) {
  const raw = currentDb[colName];
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(item => Array.isArray(item) && item.length === 2 ? item[1] : item);
  }
  if (typeof raw === 'object') return Object.values(raw);
  return [];
}

const backupFiles = [
  'db.json.backup_before_data_restore',
  'test-db.json',
  'db.json.bak.master_fix',
  'db.json.backup_before_staff_cleanup',
  'db.json.backup_before_passenger_auth_upgrade',
  'db.json.backup_before_payment_realism_upgrade',
  'db.json.backup_before_real_rac_wl_rules'
];

const backupDataMaps = {};
for (const bFile of backupFiles) {
  const bPath = path.join(dataDir, bFile);
  if (!fs.existsSync(bPath)) continue;
  try {
    const bJson = JSON.parse(fs.readFileSync(bPath, 'utf8'));
    backupDataMaps[bFile] = {};
    for (const key of Object.keys(bJson)) {
      const items = bJson[key];
      const idSet = new Set();
      if (Array.isArray(items)) {
        items.forEach(it => {
          if (Array.isArray(it) && it.length === 2) {
            if (it[0]) idSet.add(String(it[0]));
            if (it[1] && (it[1].id || it[1].pnr_number || it[1].email)) {
              idSet.add(String(it[1].id || it[1].pnr_number || it[1].email));
            }
          } else if (it && typeof it === 'object') {
            const k = it.id || it.pnr_number || it.email;
            if (k) idSet.add(String(k));
          }
        });
      }
      backupDataMaps[bFile][key] = idSet;
    }
  } catch (e) {}
}

function findBackups(colName, idKey) {
  const found = [];
  for (const [bFile, map] of Object.entries(backupDataMaps)) {
    if (map[colName] && map[colName].has(String(idKey))) {
      found.push(bFile);
    }
  }
  return found;
}

const genuine = [];
const testDummy = [];
const uncertain = [];

const testPatterns = /test|mock|demo|dummy|sample|temp|fake|spec|cypress|jest|placeholder/i;
const testEmails = /@test\.com|@example\.com|@domain\.com|@transit\.com|@railmail\.com|@mock\.com|@rail\.net|@globemail\.org/i;

// Profiles
getCollectionList('profiles').forEach(p => {
  if (!p) return;
  const id = p.id || p.email;
  const name = p.full_name || p.name || p.email || 'Unnamed';
  const email = p.email || '';
  const history = findBackups('profiles', id);
  const rec = { col: 'profiles', id, name, email, history };

  if (testPatterns.test(id) || testPatterns.test(name) || testEmails.test(email)) {
    rec.reason = `Test email domain or test keyword in name (${name})`;
    testDummy.push(rec);
  } else if (email.endsWith('@gmail.com') || email.endsWith('@yahoo.com') || email.endsWith('@outlook.com') || email.endsWith('@railway.com') || email.endsWith('@irctc.co.in')) {
    rec.reason = 'Standard user format with realistic domain & profile details';
    genuine.push(rec);
  } else {
    rec.reason = 'Uncommon email format or role metadata needing review';
    uncertain.push(rec);
  }
});

// Staff Profiles
getCollectionList('staff_profiles').forEach(s => {
  if (!s) return;
  const id = s.id || s.email;
  const name = s.full_name || s.name || s.email || 'Unnamed Staff';
  const email = s.email || '';
  const history = findBackups('staff_profiles', id);
  const rec = { col: 'staff_profiles', id, name, email, history };

  if (testPatterns.test(id) || testPatterns.test(name) || testEmails.test(email) || id.startsWith('stf-matrix') || email.includes('matrix.staff')) {
    rec.reason = `Generated during automated auth matrix test suite (${id})`;
    testDummy.push(rec);
  } else if (email.endsWith('@railway.com') || email.endsWith('@rail.gov.in') || email.endsWith('@irctc.co.in')) {
    rec.reason = 'Official railway staff email credentials & assigned employee ID';
    genuine.push(rec);
  } else {
    rec.reason = 'Custom staff user created during testing or manual setup';
    uncertain.push(rec);
  }
});

// Trains
getCollectionList('trains').forEach(t => {
  if (!t) return;
  const id = t.id || t.train_number;
  const name = t.train_name || 'Unnamed Train';
  const num = t.train_number || '---';
  const history = findBackups('trains', id);
  const rec = { col: 'trains', id, name: `${num} - ${name}`, history };

  if (testPatterns.test(id) || testPatterns.test(name) || t.record_source === 'test' || id.startsWith('t-test') || id.startsWith('t-real-rac-wl')) {
    rec.reason = `Explicit test train identifier (${id})`;
    testDummy.push(rec);
  } else if (/^\d{5}$/.test(num) && (name.includes('Express') || name.includes('Rajdhani') || name.includes('Shatabdi') || name.includes('Duronto') || name.includes('Mail') || name.includes('Superfast') || name.includes('Local') || name.includes('Special'))) {
    rec.reason = 'Valid 5-digit Indian Railways train number & standard train nomenclature';
    genuine.push(rec);
  } else {
    rec.reason = 'Non-standard train number format or custom staff creation';
    uncertain.push(rec);
  }
});

// Bookings
getCollectionList('bookings').forEach(b => {
  if (!b) return;
  const id = b.id || b.pnr_number;
  const pnr = b.pnr_number || '---';
  const history = findBackups('bookings', id);
  const rec = { col: 'bookings', id, pnr, status: b.status, history };

  if (testPatterns.test(id) || id.startsWith('bk-mock') || id.startsWith('bk-pnr-demo') || id.startsWith('bk-seed') || b.idempotency_key?.includes('test')) {
    rec.reason = `Explicit mock/seed booking identifier (${id})`;
    testDummy.push(rec);
  } else if (/^\d{10}$/.test(pnr) && b.passenger_id) {
    rec.reason = 'Valid 10-digit PNR structure linked to valid passenger ID';
    genuine.push(rec);
  } else {
    rec.reason = 'Unusual PNR length or missing passenger mapping';
    uncertain.push(rec);
  }
});

// Catering Companies
getCollectionList('catering_companies').forEach(c => {
  if (!c) return;
  const id = c.id || c.company_name;
  const name = c.company_name || 'Unnamed Partner';
  const history = findBackups('catering_companies', id);
  const rec = { col: 'catering_companies', id, name, history };

  if (c.company_name?.includes('IRCTC') || c.company_name?.includes('Pantry') || c.fssai_number || c.legal_name) {
    rec.reason = 'Valid FSSAI registration & catering partner corporate info';
    genuine.push(rec);
  } else {
    rec.reason = 'Missing FSSAI registration or legal name';
    uncertain.push(rec);
  }
});

console.log('--- GENUINE RESTORED DATA ---');
console.log(JSON.stringify(genuine, null, 2));

console.log('\n--- TEST / DUMMY DATA ---');
console.log(JSON.stringify(testDummy, null, 2));

console.log('\n--- UNCERTAIN DATA ---');
console.log(JSON.stringify(uncertain, null, 2));
