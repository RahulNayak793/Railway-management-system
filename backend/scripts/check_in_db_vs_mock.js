const fs = require('fs');
const path = require('path');

const dbFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));
console.log('db.json trains length:', dbFile.trains.length);
const inDb = dbFile.trains.filter(t => t.id === 't-co0fa2xs2' || t.id === 'train-udupi-12345' || String(t.train_number) === '12345');
console.log('inDb count:', inDb.length);
inDb.forEach(t => console.log('inDb:', t.id, t.train_number, t.train_name));

const { mockDb } = require('../src/config/supabase');
const inMock = Array.from(mockDb.trains.values()).filter(t => t.id === 't-co0fa2xs2' || t.id === 'train-udupi-12345' || String(t.train_number) === '12345');
console.log('inMock count:', inMock.length);
inMock.forEach(t => console.log('inMock:', t.id, t.train_number, t.train_name));
