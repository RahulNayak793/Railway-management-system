const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDbPath = path.join(dataDir, 'db.json');
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

// Helper to convert Map entries or objects into plain arrays
function getCollectionList(colName) {
  const raw = currentDb[colName];
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (Array.isArray(item) && item.length === 2) {
        return item[1];
      }
      return item;
    });
  }
  if (typeof raw === 'object') {
    return Object.values(raw);
  }
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

// Map of historical backup presence
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

function findHistoricalBackups(colName, idKey) {
  const found = [];
  for (const [bFile, map] of Object.entries(backupDataMaps)) {
    if (map[colName] && map[colName].has(String(idKey))) {
      found.push(bFile);
    }
  }
  return found;
}

console.log('======================================================');
console.log('🔍 DATABASE GENUINENESS AUDIT REPORT');
console.log('======================================================\n');

const auditResults = {
  genuine: [],
  test_dummy: [],
  uncertain: []
};

// Patterns for test/dummy indicator classification
const testPatterns = /test|mock|demo|dummy|sample|temp|fake|spec|cypress|jest|placeholder/i;
const testEmails = /@test\.com|@example\.com|@domain\.com|@transit\.com|@railmail\.com|@mock\.com|@rail\.net|@globemail\.org/i;

// 1. Audit Profiles & Users
const profiles = getCollectionList('profiles');
profiles.forEach(p => {
  if (!p) return;
  const id = p.id || p.email;
  const name = p.full_name || p.name || p.email || 'Unnamed';
  const email = p.email || '';
  const history = findHistoricalBackups('profiles', id);

  const itemInfo = {
    collection: 'profiles',
    id,
    identifier: `${name} (${email})`,
    role: p.role || 'passenger',
    historicalBackups: history
  };

  if (testPatterns.test(id) || testPatterns.test(name) || testEmails.test(email)) {
    itemInfo.reason = `Matches test/dummy pattern in name '${name}' or email '${email}'`;
    auditResults.test_dummy.push(itemInfo);
  } else if (email.endsWith('@gmail.com') || email.endsWith('@yahoo.com') || email.endsWith('@outlook.com') || email.endsWith('@railway.com') || email.endsWith('@irctc.co.in')) {
    itemInfo.reason = 'Standard user format with realistic domain & details';
    auditResults.genuine.push(itemInfo);
  } else {
    itemInfo.reason = 'Uncommon email format or role metadata requiring verification';
    auditResults.uncertain.push(itemInfo);
  }
});

// 2. Audit Trains
const trains = getCollectionList('trains');
trains.forEach(t => {
  if (!t) return;
  const id = t.id || t.train_number;
  const name = t.train_name || 'Unnamed Train';
  const num = t.train_number || '---';
  const history = findHistoricalBackups('trains', id);

  const itemInfo = {
    collection: 'trains',
    id,
    identifier: `${num} - ${name}`,
    historicalBackups: history
  };

  if (testPatterns.test(id) || testPatterns.test(name) || t.record_source === 'test' || id.startsWith('t-test') || id.startsWith('t-real-rac-wl')) {
    itemInfo.reason = `Explicit test train identifier or test record source (${id})`;
    auditResults.test_dummy.push(itemInfo);
  } else if (/^\d{5}$/.test(num) && (name.includes('Express') || name.includes('Rajdhani') || name.includes('Shatabdi') || name.includes('Duronto') || name.includes('Mail') || name.includes('Superfast') || name.includes('Local') || name.includes('Special'))) {
    itemInfo.reason = 'Valid 5-digit Indian Railways train number & standard train nomenclature';
    auditResults.genuine.push(itemInfo);
  } else {
    itemInfo.reason = 'Non-standard train number format or custom staff creation';
    auditResults.uncertain.push(itemInfo);
  }
});

// 3. Audit Bookings
const bookings = getCollectionList('bookings');
bookings.forEach(b => {
  if (!b) return;
  const id = b.id || b.pnr_number;
  const pnr = b.pnr_number || '---';
  const status = b.status || b.booking_status || '---';
  const history = findHistoricalBackups('bookings', id);

  const itemInfo = {
    collection: 'bookings',
    id,
    identifier: `PNR: ${pnr} (Status: ${status}, Train: ${b.train_id || '---'})`,
    historicalBackups: history
  };

  if (testPatterns.test(id) || id.startsWith('bk-mock') || id.startsWith('bk-pnr-demo') || id.startsWith('bk-seed') || b.idempotency_key?.includes('test')) {
    itemInfo.reason = `Explicit mock/seed booking identifier (${id})`;
    auditResults.test_dummy.push(itemInfo);
  } else if (/^\d{10}$/.test(pnr) && b.passenger_id) {
    itemInfo.reason = 'Valid 10-digit PNR structure linked to valid passenger ID';
    auditResults.genuine.push(itemInfo);
  } else {
    itemInfo.reason = 'Unusual PNR length or missing passenger mapping';
    auditResults.uncertain.push(itemInfo);
  }
});

// 4. Audit Catering Companies
const cateringCompanies = getCollectionList('catering_companies');
cateringCompanies.forEach(c => {
  if (!c) return;
  const id = c.id || c.company_name;
  const name = c.company_name || 'Unnamed Partner';
  const history = findHistoricalBackups('catering_companies', id);

  const itemInfo = {
    collection: 'catering_companies',
    id,
    identifier: `${name} (FSSAI: ${c.fssai_number || 'N/A'})`,
    historicalBackups: history
  };

  if (c.company_name?.includes('IRCTC') || c.company_name?.includes('Pantry') || c.fssai_number || c.legal_name) {
    itemInfo.reason = 'Valid FSSAI registration & catering partner corporate info';
    auditResults.genuine.push(itemInfo);
  } else {
    itemInfo.reason = 'Missing FSSAI registration or legal name';
    auditResults.uncertain.push(itemInfo);
  }
});

// 5. Audit Staff Profiles
const staffProfiles = getCollectionList('staff_profiles');
staffProfiles.forEach(s => {
  if (!s) return;
  const id = s.id || s.email;
  const name = s.full_name || s.name || s.email || 'Unnamed Staff';
  const email = s.email || '';
  const history = findHistoricalBackups('staff_profiles', id);

  const itemInfo = {
    collection: 'staff_profiles',
    id,
    identifier: `${name} (${email})`,
    role: s.role || 'staff',
    historicalBackups: history
  };

  if (testPatterns.test(id) || testPatterns.test(name) || testEmails.test(email) || id.startsWith('stf-matrix') || email.includes('matrix.staff')) {
    itemInfo.reason = `Generated during automated auth matrix test suite (${id})`;
    auditResults.test_dummy.push(itemInfo);
  } else if (email.endsWith('@railway.com') || email.endsWith('@rail.gov.in') || email.endsWith('@irctc.co.in')) {
    itemInfo.reason = 'Official railway staff email credentials & assigned employee ID';
    auditResults.genuine.push(itemInfo);
  } else {
    itemInfo.reason = 'Custom staff user created during testing or manual setup';
    auditResults.uncertain.push(itemInfo);
  }
});

console.log(`Summary of Categorized Database Records:`);
console.log(`  - Genuine Records    : ${auditResults.genuine.length}`);
console.log(`  - Test / Dummy Data : ${auditResults.test_dummy.length}`);
console.log(`  - Uncertain Data    : ${auditResults.uncertain.length}\n`);

console.log(JSON.stringify(auditResults, null, 2));
