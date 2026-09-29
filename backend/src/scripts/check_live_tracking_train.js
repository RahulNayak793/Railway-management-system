const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const bookings = Array.isArray(db.bookings) ? db.bookings.map(b => Array.isArray(b) ? b[1] : b) : Object.values(db.bookings || {});

const udBookings = bookings.filter(b => {
  const src = b.source_station_code || b.source;
  const dest = b.destination_station_code || b.destination;
  return src === 'UD' || dest === 'NDLS';
});
console.log('Bookings with UD or NDLS:', udBookings.length);
udBookings.forEach(b => {
  console.log('Booking:', b.id, b.pnr, b.train_number, b.travel_date, (b.source_station_code || b.source), '->', (b.destination_station_code || b.destination), 'train_id:', b.train_id);
});
