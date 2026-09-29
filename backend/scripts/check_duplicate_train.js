const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const getObj = entry => Array.isArray(entry) ? entry[1] : entry;
const trainNumbers = {};
db.trains.map(getObj).forEach(t => {
  const num = String(t.train_number);
  trainNumbers[num] = (trainNumbers[num] || 0) + 1;
});

const dupes = Object.entries(trainNumbers).filter(([k, v]) => v > 1);
console.log('Duplicates in db.trains:', dupes);
dupes.forEach(([k, v]) => {
  const matching = db.trains.map(getObj).filter(t => String(t.train_number) === k);
  console.log('Matching trains for', k, matching.map(t => ({ id: t.id, name: t.train_name, source: t.source, dest: t.destination })));
});
