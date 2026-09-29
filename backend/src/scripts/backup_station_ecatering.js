const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, '..', '..', 'data', `db.backup.station_ecatering_${timestamp}.json`);

fs.copyFileSync(srcPath, backupPath);
console.log('BACKUP_CREATED_AT:', backupPath);

const raw = fs.readFileSync(srcPath, 'utf-8');
const data = JSON.parse(raw);

const counts = {
  catering_companies: (data.catering_companies || []).length,
  company_stations: (data.company_stations || []).length,
  catering_menu: (data.catering_menu || []).length,
  catering_orders: (data.catering_orders || []).length,
  bookings: (data.bookings || []).length,
  trains: (data.trains || []).length,
  stations: (data.stations || []).length,
  profiles: (data.profiles || []).length,
  passengers: (data.passengers || []).length,
  payments: (data.payments || []).length
};

const preCountsPath = path.join(__dirname, '..', '..', 'data', 'pre_station_ecatering_counts.json');
fs.writeFileSync(preCountsPath, JSON.stringify(counts, null, 2));

console.log('RECORDED_PRE_COUNTS:', JSON.stringify(counts, null, 2));
