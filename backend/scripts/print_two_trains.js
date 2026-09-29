const fs = require('fs');
const path = require('path');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const t1 = (db.trains || []).find(t => t.id === 't-co0fa2xs2');
const t2 = (db.trains || []).find(t => t.id === 'train-udupi-12345');

console.log('Train 1 (t-co0fa2xs2):');
console.log(JSON.stringify(t1, null, 2));

console.log('\nTrain 2 (train-udupi-12345):');
console.log(JSON.stringify(t2, null, 2));
