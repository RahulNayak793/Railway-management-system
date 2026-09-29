const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Ensure test database isolation if desired or test with persistent mockDb
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');
const express = require('express');
const staffRouter = require('../routes/staff');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Helper to create test JWT tokens
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const staffUser = {
  id: 'staff-test-uuid',
  email: 'staff@railway.com',
  role: 'staff',
  permissions: ['VERIFY_TICKETS', 'VERIFY_TICKET', 'VIEW_MANIFEST', 'VIEW_PASSENGER_MANIFEST', 'MANAGE_RAC', 'ISSUE_EFT', 'VIEW_PNR']
};

const adminUser = {
  id: 'admin-test-uuid',
  email: 'admin@railway.com',
  role: 'admin',
  permissions: ['ALL']
};

const passengerUser = {
  id: 'passenger-test-uuid',
  email: 'passenger@gmail.com',
  role: 'passenger',
  permissions: []
};

const staffToken = createToken(staffUser);
const adminToken = createToken(adminUser);
const passengerToken = createToken(passengerUser);

// Setup lightweight test app
const app = express();
app.use(express.json());
app.use('/api/staff', staffRouter);

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/staff`;
      resolve();
    });
  });
});

test.after(() => {
  if (server) server.close();
});

test('1. Database Safety: Verify timestamped backup exists', () => {
  const bakPath = path.join(__dirname, '../../data/db.json.backup_before_tte_overhaul_20260920');
  assert.ok(fs.existsSync(bakPath), 'Timestamped backup must exist in backend/data/');
  const stat = fs.statSync(bakPath);
  assert.ok(stat.size > 1000000, `Backup file must contain real database (size: ${stat.size} bytes)`);
  console.log('   ✅ PASS: Pre-overhaul backup verified intact (' + stat.size + ' bytes).');
});

test('2. Central Reservation: GET /api/staff/checking/trains returns real trains and metadata', async () => {
  const res = await fetch(`${baseUrl}/checking/trains`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert.strictEqual(res.status, 200, 'Endpoint should return 200 OK');
  const data = await res.json();
  assert.ok(data.count > 0, 'Should return at least 1 train');
  assert.ok(Array.isArray(data.trains), 'trains should be an array');
  assert.ok(data.data_source.mode.includes('PROJECT DATABASE'), 'Transparency mode should be declared');
  assert.ok(data.data_source.live_prs_status.includes('NOT CONNECTED'), 'IRCTC disclaimer must be present');
  console.log(`   ✅ PASS: Loaded ${data.count} trains with authentic metadata from centralized database.`);
});

test('3. Coach Layout: GET /api/staff/checking/coach-layout returns authentic berths and occupancy', async () => {
  const trainsRes = await fetch(`${baseUrl}/checking/trains`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  const trainsData = await trainsRes.json();
  const trainId = trainsData.trains[0].id;

  const res = await fetch(`${baseUrl}/checking/coach-layout?train_id=${trainId}&coach=B1`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();

  assert.strictEqual(data.selected_coach, 'B1');
  assert.strictEqual(data.coach_class, '3A');
  assert.ok(Array.isArray(data.seats), 'Seats must be an array');
  assert.strictEqual(data.seats.length, 24, 'Coach layout must have 24 berths');
  
  // Verify standard berth types
  assert.strictEqual(data.seats[0].berth_type, 'LB');
  assert.strictEqual(data.seats[1].berth_type, 'MB');
  assert.strictEqual(data.seats[2].berth_type, 'UB');

  assert.ok(typeof data.summary.total_passengers === 'number');
  assert.ok(typeof data.summary.available === 'number');
  console.log(`   ✅ PASS: Coach B1 layout generated with ${data.seats.length} berths and real occupancy.`);
});

test('4. Ticket Verification: Valid PNR verifies successfully & logs audit record', async () => {
  // Find an active booking in mockDb
  const activeBooking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number && b.status !== 'cancelled');
  assert.ok(activeBooking, 'There must be at least one active booking in database');

  const pnr = activeBooking.pnr_number;
  const res = await fetch(`${baseUrl}/ticket/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({ pnr, checked_status: true })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();

  assert.strictEqual(data.valid, true);
  assert.strictEqual(data.pnr, pnr);
  assert.strictEqual(data.boarding_status, 'VERIFIED');
  assert.ok(data.passenger_name, 'Passenger name must be returned');

  // Verify audit log exists
  const audits = Array.from(mockDb.staff_audit_logs.values());
  const audit = audits.find(a => a.action === 'VERIFY_TICKET' && a.pnr === pnr);
  assert.ok(audit, 'Audit log must record VERIFY_TICKET for this PNR');
  assert.strictEqual(audit.status, 'VERIFIED');
  console.log(`   ✅ PASS: PNR ${pnr} verified successfully on-board and audit trail recorded.`);
});

test('5. Rejection: Cancelled ticket is strictly rejected with 400 and CANCELLED status', async () => {
  // Find or setup a cancelled booking
  let cancelledBooking = Array.from(mockDb.bookings.values()).find(b => b.status === 'cancelled');
  if (!cancelledBooking) {
    const bId = 'bk-canc-test-' + Date.now();
    cancelledBooking = {
      id: bId,
      pnr_number: '9988776655',
      train_id: 'train-1',
      train_number: '12952',
      status: 'cancelled',
      cancellation_reason: 'Passenger requested cancellation',
      total_fare: 1500
    };
    mockDb.bookings.set(bId, cancelledBooking);
  }

  const res = await fetch(`${baseUrl}/ticket/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({ pnr: cancelledBooking.pnr_number })
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.status, 'CANCELLED');
  assert.strictEqual(data.valid, false);
  assert.ok(data.error.includes('CANCELLED'), 'Error must clearly state CANCELLED');
  console.log(`   ✅ PASS: Cancelled PNR ${cancelledBooking.pnr_number} was blocked with explicit alert.`);
});

test('6. Rejection: Invalid / non-existent PNR returns 404', async () => {
  const res = await fetch(`${baseUrl}/ticket/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({ pnr: '0000000000' })
  });

  assert.strictEqual(res.status, 404);
  const data = await res.json();
  assert.strictEqual(data.status, 'NOT_FOUND');
  assert.strictEqual(data.valid, false);
  console.log('   ✅ PASS: Invalid PNR correctly rejected with 404 NOT_FOUND.');
});

test('7. Passenger Manifest: GET /api/staff/manifest/:trainId supports multi-parameter filters', async () => {
  const res = await fetch(`${baseUrl}/manifest/all?status=ALL`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();

  assert.ok(data.count >= 0);
  assert.ok(Array.isArray(data.manifest));
  assert.ok(data.summary);
  assert.ok(typeof data.summary.total_passengers === 'number');

  if (data.manifest.length > 0) {
    const item = data.manifest[0];
    assert.ok(item.pnr, 'Item must have PNR');
    assert.ok(item.passenger_name, 'Item must have passenger name');
    assert.ok(item.coach, 'Item must have coach');
    assert.ok(item.seat_number, 'Item must have seat number');
    assert.ok(item.ticket_status, 'Item must have ticket status');
    assert.ok(item.verification_status, 'Item must have verification status');
  }
  console.log(`   ✅ PASS: Manifest loaded with ${data.manifest.length} records and real KPIs.`);
});

test('8. No-Show & RAC Queue & Atomic Promotion End-to-End Workflow', async () => {
  // 1. Setup a confirmed booking for No-Show test
  const bId = 'bk-noshow-test-' + Date.now();
  const testPnr = '8881234567';
  const confirmedBooking = {
    id: bId,
    pnr_number: testPnr,
    train_id: 'train-1',
    train_number: '12952',
    travel_date: '2026-09-25',
    coach_number: 'B1',
    seat_number: 15,
    berth_type: 'MB',
    status: 'confirmed',
    passenger_name: 'Gaurav Test'
  };
  mockDb.bookings.set(bId, confirmedBooking);

  const allocId = 'al-noshow-' + Date.now();
  mockDb.seat_allocations.set(allocId, {
    id: allocId,
    booking_id: bId,
    seat_id: 'B1-15',
    coach_number: 'B1',
    seat_number: 15,
    berth_type: 'MB',
    travel_date: '2026-09-25',
    passenger_name: 'Gaurav Test',
    checked_in: false,
    boarding_status: 'PENDING'
  });

  // 2. Setup an RAC booking in queue
  const racBId = 'bk-rac-test-' + Date.now();
  const racPnr = '7771234567';
  const racBooking = {
    id: racBId,
    pnr_number: racPnr,
    train_id: 'train-1',
    train_number: '12952',
    travel_date: '2026-09-25',
    status: 'rac',
    coach_number: 'WL',
    seat_number: '-',
    passenger_name: 'Rohit RAC Waiting',
    created_at: new Date().toISOString()
  };
  mockDb.bookings.set(racBId, racBooking);

  // 3. Mark the confirmed passenger as NO-SHOW
  const noShowRes = await fetch(`${baseUrl}/ticket/no-show`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({ pnr: testPnr, seat_id: 'B1-15', reason: 'Absent at Delhi' })
  });

  assert.strictEqual(noShowRes.status, 200);
  const noShowData = await noShowRes.json();
  assert.strictEqual(noShowData.success, true);
  assert.strictEqual(noShowData.vacated_seat.coach_number, 'B1');
  assert.strictEqual(noShowData.vacated_seat.seat_number, 15);

  // 4. Query RAC queue
  const racQueueRes = await fetch(`${baseUrl}/rac-queue/train-1?travel_date=2026-09-25`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert.strictEqual(racQueueRes.status, 200);
  const racQueueData = await racQueueRes.json();
  assert.ok(racQueueData.count > 0, 'RAC queue should have at least 1 passenger');

  // 5. Execute atomic promotion to the vacated berth
  const promoteRes = await fetch(`${baseUrl}/ticket/promote-rac`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      rac_booking_id: racBId,
      target_seat_id: 'B1-15',
      target_coach: 'B1',
      target_seat_number: 15,
      target_berth_type: 'MB',
      vacated_from_pnr: testPnr
    })
  });

  assert.strictEqual(promoteRes.status, 200);
  const promoteData = await promoteRes.json();
  assert.strictEqual(promoteData.success, true);
  assert.strictEqual(promoteData.booking.status, 'confirmed');
  assert.strictEqual(promoteData.assigned_seat.coach_number, 'B1');
  assert.strictEqual(promoteData.assigned_seat.seat_number, 15);

  // Verify booking & allocation in mockDb
  const updatedRac = mockDb.bookings.get(racBId);
  assert.strictEqual(updatedRac.status, 'confirmed');
  assert.strictEqual(updatedRac.coach_number, 'B1');
  assert.strictEqual(updatedRac.seat_number, 15);

  console.log('   ✅ PASS: No-Show -> Vacated Berth -> RAC Queue -> Atomic Promotion verified end-to-end!');
});

test('9. Excess Fare Ticket (EFT): Issue EFT penalty and verify persistence in database', async () => {
  const res = await fetch(`${baseUrl}/eft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      train_id: 'train-1',
      train_number: '12952',
      travel_date: '2026-09-25',
      passenger_name: 'Sunil Verma',
      passenger_phone: '+91 9876543210',
      coach_number: 'B1',
      seat_number: '12',
      violation_reason: 'Traveling Without Ticket (TWT)',
      base_fare: 500,
      penalty_amount: 250,
      payment_mode: 'CASH',
      remarks: 'Issued on-board'
    })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.eft.receipt_number.startsWith('EFT-'));
  assert.strictEqual(data.eft.total_amount, 750);
  assert.strictEqual(data.eft.system_notice, 'PROJECT DATABASE / DEMO OPERATIONS');

  // Query GET /api/staff/eft
  const getRes = await fetch(`${baseUrl}/eft?search=Sunil`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert.strictEqual(getRes.status, 200);
  const getData = await getRes.json();
  assert.ok(getData.count > 0, 'EFT records list must return issued record');
  console.log(`   ✅ PASS: EFT Receipt ${data.eft.receipt_number} issued for ₹750 and persisted to mockDb.`);
});

test('10. RBAC: Unauthorized and Passenger role requests are strictly rejected', async () => {
  // 1. No token
  const noTokenRes = await fetch(`${baseUrl}/checking/trains`);
  assert.ok(noTokenRes.status === 401 || noTokenRes.status === 403, 'Request without token must be rejected with 401 or 403');

  // 2. Passenger token trying to access staff manifest
  const passRes = await fetch(`${baseUrl}/manifest/all`, {
    headers: { Authorization: `Bearer ${passengerToken}` }
  });
  assert.strictEqual(passRes.status, 403, 'Passenger role must be rejected with 403');
  console.log('   ✅ PASS: RBAC protections verified. Unauthorized access prevented.');
});
