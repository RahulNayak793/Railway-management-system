const { mockDb } = require('../src/config/supabase');

const trains = Array.from(mockDb.trains.values());
const matching = trains.filter(t => String(t.train_number) === '12345' || (t.train_name && t.train_name.toLowerCase().includes('udupi')));

console.log('Matching trains summary:');
matching.forEach(t => {
  console.log(`ID: ${t.id} | No: ${t.train_number} | Name: ${t.train_name} | Dep: ${t.departure_time} | Arr: ${t.arrival_time} | ${t.source_station_code} -> ${t.destination_station_code}`);
});
