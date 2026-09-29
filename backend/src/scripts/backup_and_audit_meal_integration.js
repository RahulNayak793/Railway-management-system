const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, '..', '..', 'data', `db.backup.railcontrol_meal_integration.${timestamp}.json`);

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

const bookings = toList(data.bookings);
const trains = toList(data.trains);
const profiles = toList(data.profiles);
const catering_companies = toList(data.catering_companies);
const catering_menu = toList(data.catering_menu);
const catering_orders = toList(data.catering_orders);
const payments = toList(data.payments);
const seat_allocations = toList(data.seat_allocations);

const audit = {
  timestamp: new Date().toISOString(),
  backupPath,
  counts: {
    bookings: bookings.length,
    trains: trains.length,
    profiles: profiles.length,
    catering_companies: catering_companies.length,
    catering_menu: catering_menu.length,
    catering_orders: catering_orders.length,
    payments: payments.length,
    seat_allocations: seat_allocations.length
  },
  sample_bookings: bookings.slice(0, 5).map(b => ({
    id: b.id,
    pnr: b.pnr_number,
    user_id: b.passenger_id || b.user_id,
    train: b.train_number,
    date: b.travel_date,
    class: b.coach_class || b.class,
    status: b.booking_status || b.status
  })),
  sample_orders: catering_orders.slice(0, 5).map(o => ({
    order_id: o.order_id || o.id,
    pnr: o.pnr_number || o.pnr,
    passenger_id: o.passenger_id || o.user_id,
    total: o.total_amount,
    status: o.status
  }))
};

const auditOutputPath = path.join(__dirname, '..', '..', 'data', `pre_meal_integration_audit_${timestamp}.json`);
fs.writeFileSync(auditOutputPath, JSON.stringify(audit, null, 2), 'utf-8');

console.log('AUDIT_OUTPUT_PATH:', auditOutputPath);
console.log('AUDIT_COUNTS:', JSON.stringify(audit.counts, null, 2));
