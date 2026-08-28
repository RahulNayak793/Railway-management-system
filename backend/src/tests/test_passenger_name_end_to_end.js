const http = require('http');
const jwt = require('jsonwebtoken');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const secret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
const adminToken = jwt.sign({ id: 'usr-demo-admin', email: 'admin@railway.com', role: 'admin' }, secret);
const passengerToken = jwt.sign({ id: 'usr-demo-passenger', email: 'passenger@railway.com', role: 'passenger' }, secret);

function apiReq(method, pathStr, token, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const r = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: pathStr,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(payload);
    r.end();
  });
}

async function runE2EPassengerNameTest() {
  console.log('================================================================');
  console.log('--- 🧪 PASSENGER NAME DISPLAY END-TO-END VERIFICATION SUITE ---');
  console.log('================================================================\n');

  // 1. Fetch Admin Refunds & Verify All Current Records Have Valid Passenger Names
  console.log('Step 1: Fetching GET /api/admin/refunds as Admin...');
  const refundsRes = await apiReq('GET', '/api/admin/refunds', adminToken);
  assert.strictEqual(refundsRes.status, 200);

  const records = refundsRes.body?.records || refundsRes.body;
  assert.ok(Array.isArray(records) && records.length > 0, 'Admin refunds returned no records!');

  console.log(`Found ${records.length} cancellation records in Admin Refunds Queue:`);
  let invalidNamesCount = 0;
  for (const r of records) {
    const pName = r.passenger || r.passenger_name;
    console.log(`  • PNR #${r.pnr} | Passenger ID: ${r.passenger_id} | Passenger Name: "${pName}"`);

    assert.ok(r.passenger_id, `Missing passenger_id for PNR ${r.pnr}`);
    assert.ok(pName, `Missing passenger_name for PNR ${r.pnr}`);
    assert.ok(
      !['PASSENGER', 'ADMIN', 'USER', 'UNDEFINED', 'NULL', ''].includes(String(pName).trim().toUpperCase()),
      `Generic role label returned for PNR ${r.pnr}: ${pName}`
    );
  }

  // 2. Create a New Booking for a Known Passenger
  console.log('\nStep 2: Creating a new passenger booking...');
  const bookRes = await apiReq('POST', '/api/bookings/book', passengerToken, {
    train_id: 't-co0fa2xs2',
    travel_date: '2026-09-20',
    coach_class: 'SL',
    total_fare: 790,
    passengers: [{ name: 'Ramesh Kumar', age: 34, gender: 'Male', berthing_preference: 'Lower' }]
  });

  assert.strictEqual(bookRes.status, 201, `Failed to create booking: ${JSON.stringify(bookRes.body)}`);
  const newBooking = bookRes.body.booking;
  console.log(`✅ New Booking Created successfully: ID #${newBooking.id} | PNR #${newBooking.pnr_number}`);

  // 3. Cancel the Ticket via Passenger Cancellation Route
  console.log(`\nStep 3: Cancelling ticket #${newBooking.id} via PUT /api/bookings/:id/cancel...`);
  const cancelRes = await apiReq('PUT', `/api/bookings/${newBooking.id}/cancel`, passengerToken, {
    reason: 'Personal Emergency'
  });

  assert.strictEqual(cancelRes.status, 200, `Cancellation failed: ${JSON.stringify(cancelRes.body)}`);
  console.log('✅ Passenger ticket cancellation executed successfully.');

  // 4. Verify Admin Refunds Immediately Shows the New Cancelled PNR with Exact Passenger Name
  console.log('\nStep 4: Verifying GET /api/admin/refunds includes the new cancellation with correct passenger name...');
  const adminCheckRes = await apiReq('GET', '/api/admin/refunds', adminToken);
  assert.strictEqual(adminCheckRes.status, 200);

  const updatedRecords = adminCheckRes.body?.records || adminCheckRes.body;
  const match = updatedRecords.find(r => r.pnr === newBooking.pnr_number || r.booking_id === newBooking.id);

  assert.ok(match, `Cancelled PNR #${newBooking.pnr_number} not found in Admin Refunds Queue!`);
  console.log(`✅ Found Cancelled PNR #${match.pnr} in Admin Refunds!`);
  console.log(`  • Passenger Name in API: "${match.passenger_name}"`);
  console.log(`  • Passenger Name in Frontend Field: "${match.passenger}"`);

  assert.strictEqual(match.passenger_name, 'Ramesh Kumar', `Expected 'Ramesh Kumar', got '${match.passenger_name}'`);
  assert.strictEqual(match.passenger, 'Ramesh Kumar', `Expected 'Ramesh Kumar' in passenger field, got '${match.passenger}'`);

  // 5. Verify No Duplicate Cancellation Records Exist
  console.log('\nStep 5: Checking for duplicate cancellation_records...');
  const ids = updatedRecords.map(r => r.booking_id || r.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 'Duplicate cancellation records detected!');
  console.log(`✅ Duplicate check passed: ${uniqueIds.size} unique records, 0 duplicates.`);

  console.log('\n================================================================');
  console.log('🎉 ALL PASSENGER NAME E2E VERIFICATION CHECKS PASSED 100%! 🎉');
  console.log('================================================================\n');
}

runE2EPassengerNameTest().catch(err => {
  console.error('❌ E2E Passenger name test failed:', err);
  process.exit(1);
});
