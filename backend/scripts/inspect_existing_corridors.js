const { mockDb } = require('../src/config/supabase');

const trains = Array.from(mockDb.trains.values());
console.log('Total trains in mockDb:', trains.length);

const pairs = [
  ['MMCT', 'NDLS'],
  ['BCT', 'NDLS'],
  ['UD', 'NDLS'],
  ['SBC', 'NDLS'],
  ['MAS', 'NDLS'],
  ['TVC', 'NDLS']
];

pairs.forEach(([src, dst]) => {
  const matches = trains.filter(t => {
    const s = t.source || t.source_station_code;
    const d = t.destination || t.destination_station_code;
    return (s === src && d === dst) || String(t.train_name).toLowerCase().includes(src.toLowerCase());
  });
  console.log(`Trains for ${src} -> ${dst}:`, matches.map(t => `${t.train_number} - ${t.train_name} (${t.service_pattern || t.frequency})`));
});
