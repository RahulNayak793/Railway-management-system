const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, '..', '..', 'data', `db.backup.rac_autopromote.${timestamp}.json`);

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
const stations = toList(data.stations);
const profiles = toList(data.profiles);
const passengers = toList(data.passengers);
const payments = toList(data.payments);
const seat_allocations = toList(data.seat_allocations);
const notifications = toList(data.notifications);

const racList = bookings.filter(b => (b.booking_status && b.booking_status.toUpperCase().includes('RAC')) || (b.status && b.status.toUpperCase().includes('RAC')));
const wlList = bookings.filter(b => (b.booking_status && (b.booking_status.toUpperCase().includes('WL') || b.booking_status.toUpperCase().includes('WAITING'))) || (b.status && (b.status.toUpperCase().includes('WL') || b.status.toUpperCase().includes('WAITING'))));
const confirmedList = bookings.filter(b => (b.booking_status && b.booking_status.toUpperCase().includes('CONFIRM')) || (b.status && b.status.toUpperCase().includes('CONFIRM')));

const audit = {
  timestamp: new Date().toISOString(),
  backupPath,
  counts: {
    bookings: bookings.length,
    trains: trains.length,
    stations: stations.length,
    profiles: profiles.length,
    passengers: passengers.length,
    payments: payments.length,
    seat_allocations: seat_allocations.length,
    notifications: notifications.length,
    confirmed_bookings: confirmedList.length,
    rac_bookings: racList.length,
    wl_bookings: wlList.length
  },
  sample_rac: racList.slice(0, 5).map(b => ({ pnr: b.pnr_number, train: b.train_number, date: b.journey_date, class: b.class_type, status: b.booking_status, seat: b.allocated_seat || b.seat_number })),
  sample_wl: wlList.slice(0, 5).map(b => ({ pnr: b.pnr_number, train: b.train_number, date: b.journey_date, class: b.class_type, status: b.booking_status }))
};

const auditOutputPath = path.join(__dirname, '..', '..', 'data', `pre_rac_audit_${timestamp}.json`);
fs.writeFileSync(auditOutputPath, JSON.stringify(audit, null, 2), 'utf-8');

console.log('AUDIT_OUTPUT_PATH:', auditOutputPath);
console.log('AUDIT_COUNTS:', JSON.stringify(audit.counts, null, 2));
