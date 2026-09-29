const { mockDb } = require('../src/config/supabase');

const trains = Array.from(mockDb.trains.values());
console.log(`Total trains in mockDb: ${trains.length}`);

const matching = trains.filter(t => String(t.train_number) === '12345' || (t.train_name && t.train_name.toLowerCase().includes('udupi')));
console.log('Matching trains:');
console.log(JSON.stringify(matching, null, 2));
