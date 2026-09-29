const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

console.log('Sample train:', JSON.stringify(db.trains[0], null, 2));

const getTrainObj = entry => Array.isArray(entry) ? entry[1] : entry;
const trainsList = db.trains.map(getTrainObj).filter(Boolean);

console.log('Total train objects:', trainsList.length);
const t09433 = trainsList.find(t => String(t.train_number) === '09433');
console.log('Found 09433:', t09433 ? {
  id: t09433.id,
  train_number: t09433.train_number,
  train_name: t09433.train_name,
  source: t09433.source,
  destination: t09433.destination,
  running_days: t09433.running_days,
  service_pattern: t09433.service_pattern,
  pattern_start_date: t09433.pattern_start_date
} : 'NOT FOUND');

// Check target trains: 12953, 12649, 12615, 12643
['12953', '12649', '12615', '12643', '09433'].forEach(num => {
  const t = trainsList.find(x => String(x.train_number) === num);
  console.log(num, t ? `${t.id} - ${t.train_name} (${t.source} -> ${t.destination})` : 'NOT FOUND');
});
