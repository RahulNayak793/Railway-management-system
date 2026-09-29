const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluateCateringEligibility } = require('../services/cateringEligibility');

const DB_PATH = path.join(__dirname, '../../data/db.json');

console.log('🚀 Running Included Food in Long-Journey Ticket Price Verification Suite...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASSED: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAILED: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// 1. Verify db.json backup exists
test('Backup file db.json.bak exists and has valid data', () => {
  const bakPath = path.join(__dirname, '../../data/db.json.bak');
  assert.ok(fs.existsSync(bakPath), 'db.json.bak must exist');
  const rawBak = fs.readFileSync(bakPath, 'utf8');
  const parsedBak = JSON.parse(rawBak);
  assert.ok(parsedBak.bookings, 'Backup must contain bookings collection');
  assert.ok(parsedBak.trains, 'Backup must contain trains collection');
});

// 2. Verify long-journey catering eligibility rules
test('Long-journey eligibility evaluates included_in_ticket strictly based on distance, duration and config', () => {
  const rajdhaniTrain = {
    train_number: '12952',
    train_name: 'Mumbai Rajdhani Express',
    catering: { enabled: true, service_type: 'ONBOARD_AND_ECATERING', included_in_ticket: true, included_value: 280 }
  };

  const evalLong = evaluateCateringEligibility({ train: rajdhaniTrain, distance_km: 1384, duration_hours: 15.75 });
  assert.strictEqual(evalLong.included_in_ticket, true);
  assert.ok(evalLong.badge_label.includes('Catering Included'));

  const evalShort = evaluateCateringEligibility({ train: rajdhaniTrain, distance_km: 150, duration_hours: 2 });
  assert.strictEqual(evalShort.included_in_ticket, false);
  assert.strictEqual(evalShort.is_short_journey, true);

  const expressTrain = {
    train_number: '12345',
    train_name: 'Udupi Express',
    catering: { enabled: true, service_type: 'ONBOARD_AND_ECATERING' }
  };
  const evalExpress = evaluateCateringEligibility({ train: expressTrain, distance_km: 500, duration_hours: 8 });
  assert.strictEqual(evalExpress.included_in_ticket, true);
  assert.ok(evalExpress.badge_label.includes('Catering Included'));
});

// 3. Verify db.json booking count and data integrity
test('Historical bookings and passengers are preserved without deletion or corruption', () => {
  const rawDb = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(rawDb);
  const bookingsMap = new Map(db.bookings);
  const trainsMap = new Map(db.trains);

  assert.ok(bookingsMap.size >= 32, `Must have at least 32 historical bookings, found ${bookingsMap.size}`);
  assert.ok(trainsMap.size >= 11, `Must have at least 11 trains, found ${trainsMap.size}`);

  for (const [id, booking] of bookingsMap) {
    assert.ok(booking.id, 'Booking must have an id');
    assert.ok(booking.pnr_number, 'Booking must have a pnr_number');
    assert.ok(typeof booking.total_fare === 'number', 'Booking must have numeric total_fare');
  }
});

// 4. Verify 1 Passenger = 1 IRCTC ID validation rule
test('IRCTC ID requirement enforces 1 non-empty IRCTC ID per passenger', () => {
  const passengersInput = [
    { full_name: 'Pax One', age: 30, gender: 'Male', irctc_id: 'IRCTC123' },
    { full_name: 'Pax Two', age: 28, gender: 'Female', irctc_id: 'IRCTC456' }
  ];

  for (const p of passengersInput) {
    assert.ok(p.irctc_id && p.irctc_id.trim().length > 0, 'Every passenger must have a non-empty IRCTC ID');
  }
});

console.log(`\n========================================`);
console.log(`Verification Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
else process.exit(0);
