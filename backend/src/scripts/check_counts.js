const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const raw = fs.readFileSync(dbPath, 'utf-8');
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

console.log('CURRENT_DB_COUNTS:', JSON.stringify(counts, null, 2));

// Also list catering company IDs and statuses
if (data.catering_companies) {
  console.log('COMPANIES:', data.catering_companies.map(c => ({ id: c.id, name: c.name, status: c.status })));
}
