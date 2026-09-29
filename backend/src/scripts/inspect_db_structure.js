const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
const masterFix = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json.bak.master_fix'), 'utf8'));

console.log('--- DB STRUCTURE ANALYSIS ---');

console.log('\nType of currentDb.trains:', typeof currentDb.trains, Array.isArray(currentDb.trains) ? 'Array' : 'Object');
if (Array.isArray(currentDb.trains)) {
  console.log('First 2 trains in currentDb:', currentDb.trains.slice(0, 2));
} else if (typeof currentDb.trains === 'object') {
  console.log('Keys of currentDb.trains:', Object.keys(currentDb.trains).slice(0, 5));
  console.log('Sample item:', currentDb.trains[Object.keys(currentDb.trains)[0]]);
}

console.log('\nType of masterFix.trains:', typeof masterFix.trains, Array.isArray(masterFix.trains) ? 'Array' : 'Object');
if (Array.isArray(masterFix.trains)) {
  console.log('First 2 trains in masterFix:', masterFix.trains.slice(0, 2));
} else if (typeof masterFix.trains === 'object') {
  console.log('Keys of masterFix.trains:', Object.keys(masterFix.trains).slice(0, 5));
  console.log('Sample item:', masterFix.trains[Object.keys(masterFix.trains)[0]]);
}
