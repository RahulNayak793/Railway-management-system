const fs = require('fs');
const path = require('path');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

console.log('Is Array(db.trains)?', Array.isArray(db.trains));
const foundById = db.trains.find(t => t.id === 't-co0fa2xs2');
console.log('foundById t-co0fa2xs2:', foundById ? { id: foundById.id, train_number: foundById.train_number, train_name: foundById.train_name } : null);

const foundBy12345 = db.trains.filter(t => String(t.train_number) === '12345' || (t.train_name && t.train_name.toLowerCase().includes('udupi')));
console.log('foundBy12345 or udupi count:', foundBy12345.length);
foundBy12345.forEach(t => {
  console.log(`ID: ${t.id} | No: ${t.train_number} | Name: ${t.train_name}`);
});
