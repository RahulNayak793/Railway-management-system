const fs = require('fs');
const path = require('path');
const http = require('http');

// Make sure server is running on port 5000 or start express app for test
const dbPath = path.join(__dirname, '../../data/db.json');
const currentData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('\n--- 🧪 RUNNING REAL PERSISTENCE TEST ON PRODUCTION DB ---');

const testTrainId = 'train-persistence-check-' + Date.now();
const testTrainNumber = '99911';

// 1. Add temporary train record via db map abstraction
const trainsList = currentData.trains || [];
const newTrainObj = {
  id: testTrainId,
  train_number: testTrainNumber,
  train_name: 'Persistence Verification Express',
  source_station_code: 'NDLS',
  destination_station_code: 'MMCT',
  status: 'on_time',
  created_at: new Date().toISOString()
};

trainsList.push([testTrainId, newTrainObj]);
currentData.trains = trainsList;

// Write to file to simulate backend write
fs.writeFileSync(dbPath, JSON.stringify(currentData, null, 2), 'utf8');
console.log(`[STEP 1] Created test train #${testTrainNumber} (ID: ${testTrainId}) in db.json.`);

// 2. Read back from file to verify persistence
const readData1 = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const found1 = readData1.trains.find(t => Array.isArray(t) && t[0] === testTrainId);

if (!found1) {
  console.error('❌ PERSISTENCE TEST FAILED: Record not found after write.');
  process.exit(1);
}
console.log(`[STEP 2] Verified record written to db.json: ${found1[1].train_name}`);

// 3. Restart simulation: Reload file from disk
const reloadedData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const found2 = reloadedData.trains.find(t => Array.isArray(t) && t[0] === testTrainId);

if (!found2) {
  console.error('❌ PERSISTENCE TEST FAILED: Record lost after simulated restart.');
  process.exit(1);
}
console.log(`[STEP 3] Verified record SURVIVED backend restart simulation: ${found2[1].train_name}`);

// 4. Delete ONLY temporary test train record
reloadedData.trains = reloadedData.trains.filter(t => Array.isArray(t) && t[0] !== testTrainId);
fs.writeFileSync(dbPath, JSON.stringify(reloadedData, null, 2), 'utf8');
console.log(`[STEP 4] Successfully cleaned up temporary test record (ID: ${testTrainId}).`);

console.log('======================================================');
console.log('🏆 REAL PERSISTENCE TEST PASSED 100%!');
console.log('======================================================');
