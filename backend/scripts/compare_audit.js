const fs = require('fs');
const path = require('path');

const preAuditPath = path.join(__dirname, '../data/pre_class_date_audit_2026-09-27T04-31-10-016Z.json');
const currentDbPath = path.join(__dirname, '../data/db.json');

const preAudit = JSON.parse(fs.readFileSync(preAuditPath, 'utf8'));
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

console.log('\n===============================================================');
console.log('DATABASE ENTITY COUNT AUDIT: BEFORE vs AFTER');
console.log('===============================================================');

let anyDeleted = false;
const comparison = {};

for (const [key, countBefore] of Object.entries(preAudit.counts)) {
  const currentArr = currentDb[key] || [];
  const countAfter = Array.isArray(currentArr) ? currentArr.length : (typeof currentArr === 'object' ? Object.keys(currentArr).length : 0);
  const diff = countAfter - countBefore;
  comparison[key] = { before: countBefore, after: countAfter, diff };

  if (diff < 0) {
    anyDeleted = true;
    console.error(`  ✕ REGRESSION DETECTED on ${key}: was ${countBefore}, now ${countAfter} (diff: ${diff})`);
  } else if (diff > 0) {
    console.log(`  + ${key.padEnd(25)}: ${String(countBefore).padStart(5)} → ${String(countAfter).padStart(5)} (+${diff} added)`);
  } else {
    console.log(`  = ${key.padEnd(25)}: ${String(countBefore).padStart(5)} → ${String(countAfter).padStart(5)} (intact)`);
  }
}

console.log('===============================================================');
if (anyDeleted) {
  console.error('❌ INTEGRITY CHECK FAILED: Records were deleted!');
  process.exit(1);
} else {
  console.log('✅ ALL PRE-EXISTING ENTITIES FULLY PRESERVED (0 DELETIONS)');
  console.log('===============================================================\n');
}
