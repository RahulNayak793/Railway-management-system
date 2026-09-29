const fs = require('fs');
const path = require('path');

const preAuditPath = path.join(__dirname, '../../data/pre_execution_audit_2026-09-20T16-00-13-271Z.json');
const currentDbPath = path.join(__dirname, '../../data/db.json');

const preAudit = JSON.parse(fs.readFileSync(preAuditPath, 'utf8'));
const currentDb = JSON.parse(fs.readFileSync(currentDbPath, 'utf8'));

const comparison = {
  timestamp: new Date().toISOString(),
  preAuditTimestamp: preAudit.timestamp,
  countsComparison: {},
  preservedExistingEntities: true
};

for (const [collection, preCount] of Object.entries(preAudit.counts)) {
  const currentVal = currentDb[collection];
  const postCount = Array.isArray(currentVal)
    ? currentVal.length
    : (currentVal && typeof currentVal === 'object' ? Object.keys(currentVal).length : 0);

  comparison.countsComparison[collection] = {
    pre: preCount,
    post: postCount,
    delta: postCount - preCount,
    status: postCount >= preCount ? 'PRESERVED/EXPANDED' : 'DECREASED'
  };

  if (postCount < preCount) {
    comparison.preservedExistingEntities = false;
  }
}

// Check that all pre-audit company IDs still exist in currentDb
const currentCompanyIds = new Set(
  (Array.isArray(currentDb.catering_companies) ? currentDb.catering_companies.map(c => Array.isArray(c) ? c[0] : c.id) : Object.keys(currentDb.catering_companies || {}))
);
const preCompanies = preAudit.details && preAudit.details.catering_companies ? preAudit.details.catering_companies : [];
const missingCompanies = preCompanies.filter(c => !currentCompanyIds.has(c.id));
comparison.missingPreExistingCompanies = missingCompanies.length;

const outputPath = path.join(__dirname, '../../data/post_execution_audit.json');
fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2), 'utf8');

console.log('=== AUDIT VERIFICATION RESULTS ===');
console.table(comparison.countsComparison);
console.log('All pre-existing entities preserved:', comparison.preservedExistingEntities);
console.log('Missing pre-existing companies:', missingCompanies.length);
