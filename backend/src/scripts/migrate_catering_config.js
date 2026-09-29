const fs = require('fs');
const path = require('path');
const { getTrainCateringConfig } = require('../services/cateringEligibility');

function migrateDbFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return;
  }

  console.log(`\n📦 Auditing and migrating database file: ${filePath}...`);
  const rawData = fs.readFileSync(filePath, 'utf8');
  const db = JSON.parse(rawData);

  const initialCollectionCounts = {};
  for (const [key, val] of Object.entries(db)) {
    initialCollectionCounts[key] = Array.isArray(val) ? val.length : (val && typeof val === 'object' ? Object.keys(val).length : 0);
  }

  console.log('📊 Pre-migration record counts:');
  console.dir(initialCollectionCounts);

  let updatedTrainsCount = 0;

  if (Array.isArray(db.trains)) {
    db.trains = db.trains.map(entry => {
      let id, trainObj;
      if (Array.isArray(entry) && entry.length === 2) {
        id = entry[0];
        trainObj = entry[1];
      } else {
        id = entry.id;
        trainObj = entry;
      }

      if (trainObj && typeof trainObj === 'object') {
        if (!trainObj.catering) {
          const derivedConfig = getTrainCateringConfig(trainObj);
          trainObj.catering = {
            enabled: derivedConfig.enabled,
            service_type: derivedConfig.service_type,
            included_in_ticket: derivedConfig.included_in_ticket,
            available_for_classes: derivedConfig.available_for_classes,
            delivery_enabled: derivedConfig.delivery_enabled,
            minimum_delivery_journey_hours: derivedConfig.minimum_delivery_journey_hours,
            status: 'CONFIGURED'
          };
          updatedTrainsCount++;
        }
      }

      return Array.isArray(entry) ? [id, trainObj] : trainObj;
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf8');

  const finalCollectionCounts = {};
  for (const [key, val] of Object.entries(db)) {
    finalCollectionCounts[key] = Array.isArray(val) ? val.length : (val && typeof val === 'object' ? Object.keys(val).length : 0);
  }

  console.log('✅ Migration complete!');
  console.log(`✨ Trains updated with persistent catering config: ${updatedTrainsCount}`);
  console.log('📊 Post-migration record counts:');
  console.dir(finalCollectionCounts);

  let recordLossDetected = false;
  for (const key of Object.keys(initialCollectionCounts)) {
    if ((finalCollectionCounts[key] || 0) < initialCollectionCounts[key]) {
      console.error(`❌ CRITICAL: Record loss detected in collection "${key}"! Before: ${initialCollectionCounts[key]}, After: ${finalCollectionCounts[key]}`);
      recordLossDetected = true;
    }
  }

  if (recordLossDetected) {
    throw new Error('Migration failed record loss check!');
  } else {
    console.log('🎉 VERIFICATION PASSED: 0 records deleted. All existing records preserved intact.');
  }
}

function runMigration() {
  const mainDbPath = path.join(__dirname, '../../data/db.json');
  const testDbPath = path.join(__dirname, '../../data/test-db.json');

  migrateDbFile(mainDbPath);
  migrateDbFile(testDbPath);
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
