const { mockDb } = require('../src/config/supabase');

const routes = Array.from(mockDb.routes.values());
const matchingRoutes = routes.filter(r => r.train_id === 't-co0fa2xs2' || r.train_id === 'train-udupi-12345' || String(r.train_number) === '12345');

console.log('Matching routes:');
matchingRoutes.forEach(r => {
  console.log(`Route ID: ${r.id} | TrainID: ${r.train_id} | No: ${r.train_number} | Dep: ${r.departure_time} | Arr: ${r.arrival_time} | ${r.source_station_code} -> ${r.destination_station_code}`);
});
