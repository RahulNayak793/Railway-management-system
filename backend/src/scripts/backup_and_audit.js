const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, '..', '..', 'data', `db.backup.${timestamp}.json`);

fs.copyFileSync(dbPath, backupPath);
console.log('TIMESTAMPED_BACKUP_PATH:', backupPath);

const raw = fs.readFileSync(dbPath, 'utf-8');
const data = JSON.parse(raw);

function toList(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    if (val.length > 0 && Array.isArray(val[0]) && val[0].length === 2) {
      return val.map(item => item[1]);
    }
    return val;
  }
  if (typeof val === 'object') {
    return Object.values(val);
  }
  return [];
}

const companies = toList(data.catering_companies);
const company_stations = toList(data.company_stations);
const catering_menu = toList(data.catering_menu);
const catering_orders = toList(data.catering_orders);
const bookings = toList(data.bookings);
const trains = toList(data.trains);
const stations = toList(data.stations);
const profiles = toList(data.profiles);
const passengers = toList(data.passengers);
const payments = toList(data.payments);

const audit = {
  timestamp: new Date().toISOString(),
  backupPath,
  counts: {
    catering_companies: companies.length,
    company_stations: company_stations.length,
    catering_menu: catering_menu.length,
    catering_orders: catering_orders.length,
    bookings: bookings.length,
    trains: trains.length,
    stations: stations.length,
    profiles: profiles.length,
    passengers: passengers.length,
    payments: payments.length
  },
  details: {
    catering_companies: companies.map(c => ({ id: c.id || c.company_id, name: c.name, status: c.status, stations_count: (c.stations || []).length })),
    catering_menu_sample: catering_menu.slice(0, 10).map(m => ({ id: m.id, name: m.name, company_id: m.company_id, in_stock: m.in_stock })),
    catering_orders: catering_orders.map(o => ({ order_id: o.order_id || o.id, pnr: o.pnr_number || o.pnr, status: o.status, delivery_status: o.delivery_status, company_id: o.company_id || (o.items && o.items[0] && o.items[0].company_id) })),
    sample_bookings: bookings.slice(0, 5).map(b => ({ pnr_number: b.pnr_number, train_number: b.train_number, from: b.from_station_code, to: b.to_station_code, status: b.booking_status }))
  }
};

const auditOutputPath = path.join(__dirname, '..', '..', 'data', `pre_execution_audit_${timestamp}.json`);
fs.writeFileSync(auditOutputPath, JSON.stringify(audit, null, 2), 'utf-8');

console.log('AUDIT_OUTPUT_PATH:', auditOutputPath);
console.log('AUDIT_COUNTS:', JSON.stringify(audit.counts, null, 2));
console.log('COMPANIES:', JSON.stringify(audit.details.catering_companies, null, 2));
console.log('ORDERS:', JSON.stringify(audit.details.catering_orders, null, 2));
