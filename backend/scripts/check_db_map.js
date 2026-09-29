const fs = require('fs');
const path = require('path');

const dbFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));
const trainsMap = new Map(dbFile.trains);
console.log('Total trains in db.json Map:', trainsMap.size);

const matching = Array.from(trainsMap.values()).filter(t => String(t.train_number) === '12345' || (t.train_name && t.train_name.toLowerCase().includes('udupi')));
console.log('Matching trains in db.json:');
matching.forEach(t => {
  console.log(`ID: ${t.id} | No: ${t.train_number} | Name: ${t.train_name}`);
});
