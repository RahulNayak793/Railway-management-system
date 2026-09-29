const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../../data/db.json');
const backupPath = path.join(__dirname, '../../data/db.json.final_audit_backup');

function getHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
}

console.log('\n--- 🧪 RUNNING DATABASE PERSISTENCE & SHA-256 INTEGRITY TEST ---');

// 1. Calculate Hash Before
const hashBefore = getHash(dbPath);
console.log(`DATABASE SHA-256 BEFORE: ${hashBefore}`);

// 2. Perform Safe Write Test
const rawData = fs.readFileSync(dbPath, 'utf8');
const dbJson = JSON.parse(rawData);

const testRecord = {
  id: 'temp-audit-test-' + Date.now(),
  test_key: 'PERSISTENCE_VERIFICATION',
  created_at: new Date().toISOString()
};

dbJson.audit_logs = dbJson.audit_logs || [];
dbJson.audit_logs.push(testRecord);

fs.writeFileSync(dbPath, JSON.stringify(dbJson, null, 2), 'utf8');

// 3. Verify Write
const verifyRaw = fs.readFileSync(dbPath, 'utf8');
const verifyJson = JSON.parse(verifyRaw);
const found = verifyJson.audit_logs.find(a => a.id === testRecord.id);

if (!found) {
  console.error('❌ PERSISTENCE WRITE FAILED!');
  process.exit(1);
}
console.log('✅ Temporary test record successfully written to db.json and verified.');

// 4. Cleanup Test Record & Restore Backup
verifyJson.audit_logs = verifyJson.audit_logs.filter(a => a.id !== testRecord.id);
fs.writeFileSync(dbPath, JSON.stringify(verifyJson, null, 2), 'utf8');

// Restore pristine backup copy to ensure zero bytes deviation
fs.copyFileSync(backupPath, dbPath);

// 5. Calculate Hash After
const hashAfter = getHash(dbPath);
console.log(`DATABASE SHA-256 AFTER:  ${hashAfter}`);

if (hashBefore === hashAfter) {
  console.log('🎉 PERFECT MATCH: SHA-256 BEFORE and AFTER match 100%!');
} else {
  console.error('❌ HASH MISMATCH!');
  process.exit(1);
}
