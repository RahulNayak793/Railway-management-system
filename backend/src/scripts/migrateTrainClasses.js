const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDefaultClassesForTrain, normalizeClassList } = require('../utils/trainClasses');

function migrateFile(filePath, isProduction = false) {
  if (!fs.existsSync(filePath)) {
    console.log(`[MIGRATION] File ${filePath} does not exist. Skipping.`);
    return;
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawContent);

  const trainsEntry = data.trains;
  if (!trainsEntry) {
    console.log(`[MIGRATION] No 'trains' entry in ${filePath}. Skipping.`);
    return;
  }

  const isMapArray = Array.isArray(trainsEntry);
  const trainRecords = isMapArray ? trainsEntry.map(e => Array.isArray(e) ? e[1] : e) : Object.values(trainsEntry);

  const auditReport = [];
  let updatedCount = 0;

  trainRecords.forEach((t) => {
    if (!t) return;
    const currentClasses = t.available_classes;
    const trainNo = t.train_number || t.trainNo || 'UNKNOWN';
    const trainName = t.train_name || t.trainName || 'UNKNOWN';
    const trainType = t.train_type || t.trainType || '';

    // Determine proposed classes
    let proposed = [];
    let reason = '';

    if (Array.isArray(currentClasses) && currentClasses.length > 0) {
      proposed = normalizeClassList(currentClasses);
      reason = 'Preserved existing valid available_classes field';
    } else {
      proposed = getDefaultClassesForTrain(trainName, trainType);
      reason = `Derived from train name/type (${trainName} / ${trainType || 'N/A'})`;
      updatedCount++;
    }

    t.available_classes = proposed;

    auditReport.push({
      trainNumber: trainNo,
      trainName,
      currentClassData: currentClasses || 'NONE',
      proposedClassData: proposed,
      reason
    });
  });

  // Re-encode data preserving Map structure if used
  let newContent = '';
  if (isMapArray) {
    const newMapEntries = trainsEntry.map(entry => {
      if (Array.isArray(entry)) {
        const id = entry[0];
        const updatedObj = trainRecords.find(t => t && (t.id === id || t.train_number === id));
        return [id, updatedObj || entry[1]];
      }
      return entry;
    });
    data.trains = newMapEntries;
  }

  newContent = JSON.stringify(data, null, 2);

  // Write file atomically
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, newContent, 'utf8');
  fs.renameSync(tmpPath, filePath);

  console.log(`\n==================================================`);
  console.log(`MIGRATION REPORT FOR: ${path.basename(filePath)}`);
  console.log(`==================================================`);
  console.table(auditReport);
  console.log(`Total trains processed: ${trainRecords.length}`);
  console.log(`Total trains migrated with new available_classes: ${updatedCount}`);

  if (isProduction) {
    const shaAfter = crypto.createHash('sha256').update(newContent).digest('hex');
    console.log(`Production db.json SHA-256 AFTER: ${shaAfter}`);
  }
}

// Run migration for both db.json and test-db.json
const prodDbPath = path.join(__dirname, '../../data/db.json');
const testDbPath = path.join(__dirname, '../../data/test-db.json');

console.log('Starting Train Classes Migration...');
migrateFile(prodDbPath, true);
migrateFile(testDbPath, false);
console.log('\nMigration complete.');
