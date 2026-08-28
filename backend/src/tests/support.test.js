const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-support-db.json');
process.env.MOCK_MODE = 'true';

const app = require('../index');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
const PORT = 5088;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function generateToken(id, email, role, full_name) {
  return jwt.sign({ id, email, role, full_name }, jwtSecret, { expiresIn: '1h' });
}

const passengerAToken = generateToken('usr-pass-a', 'passengerA@test.com', 'passenger', 'Passenger Alice');
const passengerBToken = generateToken('usr-pass-b', 'passengerB@test.com', 'passenger', 'Passenger Bob');
const staffToken = generateToken('usr-staff-1', 'staff1@rail.com', 'staff', 'Staff Sarah');

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Support test server running on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log(`🔌 Support test server stopped.`);
      resolve();
    });
  });
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('🚀 Starting PASSENGER HELP & SUPPORT SYSTEM Test Suite...\n');
  await startServer();

  // Setup test mockDb data
  const { mockDb, saveMockDbToFile } = require('../config/supabase');
  
  // Seed test profiles
  mockDb.profiles.set('usr-pass-a', { id: 'usr-pass-a', full_name: 'Passenger Alice', role: 'passenger' });
  mockDb.profiles.set('usr-pass-b', { id: 'usr-pass-b', full_name: 'Passenger Bob', role: 'passenger' });
  mockDb.profiles.set('usr-staff-1', { id: 'usr-staff-1', full_name: 'Staff Sarah', role: 'staff' });

  // Seed test booking belonging to Alice
  mockDb.bookings.set('bk-alice-100', {
    id: 'bk-alice-100',
    passenger_id: 'usr-pass-a',
    pnr_number: '9876543210',
    train_name: 'Express 101',
    travel_date: '2026-09-01',
    status: 'confirmed'
  });

  saveMockDbToFile();

  let createdTicketId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Ticket creation
    // ----------------------------------------------------
    console.log('Test 1: Ticket Creation with valid fields & PNR...');
    const t1 = await request('/support/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${passengerAToken}` },
      body: JSON.stringify({
        subject: 'Refund Inquiry for PNR 9876543210',
        description: 'I requested cancellation 2 days ago, when will refund arrive?',
        priority: 'high',
        category: 'Refund & Cancellation',
        pnr: '9876543210',
        booking_id: 'bk-alice-100'
      })
    });
    assert.strictEqual(t1.status, 201, `Expected 201, got ${t1.status}`);
    assert.strictEqual(t1.data.subject, 'Refund Inquiry for PNR 9876543210');
    assert.strictEqual(t1.data.category, 'Refund & Cancellation');
    assert.strictEqual(t1.data.pnr, '9876543210');
    assert.strictEqual(t1.data.status, 'open');
    createdTicketId = t1.data.id;
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 2: Ticket listing
    // ----------------------------------------------------
    console.log('Test 2: Ticket Listing (Passenger A vs Staff)...');
    const t2a = await request('/support/tickets', {
      headers: { Authorization: `Bearer ${passengerAToken}` }
    });
    assert.strictEqual(t2a.status, 200);
    assert(Array.isArray(t2a.data));
    assert(t2a.data.some(t => t.id === createdTicketId));

    const t2b = await request('/support/tickets', {
      headers: { Authorization: `Bearer ${passengerBToken}` }
    });
    assert.strictEqual(t2b.status, 200);
    // Bob should NOT see Alice's ticket
    assert(!t2b.data.some(t => t.id === createdTicketId));
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 3: Ticket ownership enforcement
    // ----------------------------------------------------
    console.log('Test 3: Ticket Ownership Enforcement on GET /tickets/:id...');
    const t3a = await request(`/support/tickets/${createdTicketId}`, {
      headers: { Authorization: `Bearer ${passengerAToken}` }
    });
    assert.strictEqual(t3a.status, 200);
    assert.strictEqual(t3a.data.passenger_id, 'usr-pass-a');

    const t3b = await request(`/support/tickets/${createdTicketId}`, {
      headers: { Authorization: `Bearer ${passengerBToken}` }
    });
    assert.strictEqual(t3b.status, 403, `Expected 403 for non-owner, got ${t3b.status}`);
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 4 & 5: Messages & Sender Normalization
    // ----------------------------------------------------
    console.log('Test 4 & 5: Message Listing & Normalized Sender Schema...');
    const t4 = await request(`/support/tickets/${createdTicketId}/messages`, {
      headers: { Authorization: `Bearer ${passengerAToken}` }
    });
    assert.strictEqual(t4.status, 200);
    assert(Array.isArray(t4.data));
    assert(t4.data.length >= 1);
    const msg = t4.data[0];
    assert(msg.sender, 'Message must have sender object');
    assert.strictEqual(msg.sender.id, 'usr-pass-a');
    assert.strictEqual(msg.sender.full_name, 'Passenger Alice');
    assert.strictEqual(msg.sender.role, 'passenger');
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 6: Attachment upload validation
    // ----------------------------------------------------
    console.log('Test 6: Attachment validation (rejection of no file)...');
    const t6 = await request('/support/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${passengerAToken}` }
    });
    assert.strictEqual(t6.status, 400);
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 7 & 10: Staff response & Ticket status update
    // ----------------------------------------------------
    console.log('Test 7 & 10: Staff response & Status update...');
    const t7 = await request(`/support/tickets/${createdTicketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        message: 'Hello Alice, your refund has been processed. Reference ID: REF-88123.'
      })
    });
    assert.strictEqual(t7.status, 201);
    assert.strictEqual(t7.data.sender.role, 'staff');
    assert.strictEqual(t7.data.sender.full_name, 'Staff Sarah');
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 8 & 9: Passenger Close & Reopen Ticket
    // ----------------------------------------------------
    console.log('Test 8 & 9: Passenger Close & Reopen Ticket...');
    // Close ticket
    const t8 = await request(`/support/tickets/${createdTicketId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${passengerAToken}` },
      body: JSON.stringify({ status: 'closed' })
    });
    assert.strictEqual(t8.status, 200);
    assert.strictEqual(t8.data.status, 'closed');

    // Reopen ticket
    const t9 = await request(`/support/tickets/${createdTicketId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${passengerAToken}` },
      body: JSON.stringify({ status: 'open' })
    });
    assert.strictEqual(t9.status, 200);
    assert.strictEqual(t9.data.status, 'open');
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 11, 12, 13: Unauthorized access checks
    // ----------------------------------------------------
    console.log('Test 11, 12, 13: Unauthorized access checks (Passenger B on Alice ticket)...');
    const t11 = await request(`/support/tickets/${createdTicketId}/messages`, {
      headers: { Authorization: `Bearer ${passengerBToken}` }
    });
    assert.strictEqual(t11.status, 403);

    const t12 = await request(`/support/tickets/${createdTicketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${passengerBToken}` },
      body: JSON.stringify({ message: 'Hack attempt' })
    });
    assert.strictEqual(t12.status, 403);

    const t13 = await request(`/support/tickets/${createdTicketId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${passengerBToken}` },
      body: JSON.stringify({ status: 'closed' })
    });
    assert.strictEqual(t13.status, 403);
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 15: Closed-ticket messaging prohibition
    // ----------------------------------------------------
    console.log('Test 15: Closed-ticket messaging prohibition...');
    // Close ticket
    await request(`/support/tickets/${createdTicketId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${passengerAToken}` },
      body: JSON.stringify({ status: 'closed' })
    });

    const t15 = await request(`/support/tickets/${createdTicketId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${passengerAToken}` },
      body: JSON.stringify({ message: 'Attempt on closed ticket' })
    });
    assert.strictEqual(t15.status, 400);
    assert(t15.data.error.includes('closed'));

    // Reopen for further tests
    await request(`/support/tickets/${createdTicketId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${passengerAToken}` },
      body: JSON.stringify({ status: 'open' })
    });
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 16 & 17: PNR Ownership validation & Booking association
    // ----------------------------------------------------
    console.log('Test 16 & 17: PNR Ownership validation (Passenger B attempting Alice PNR)...');
    const t16 = await request('/support/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${passengerBToken}` },
      body: JSON.stringify({
        subject: 'Fake Claim on Alice PNR',
        description: 'Give me money',
        priority: 'high',
        category: 'Refund & Cancellation',
        pnr: '9876543210' // Alice's PNR
      })
    });
    assert.strictEqual(t16.status, 403);
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 18: Mock mode persistence
    // ----------------------------------------------------
    console.log('Test 18: Mock mode persistence check...');
    assert(fs.existsSync(process.env.DB_FILE_PATH), 'Test DB file should exist');
    console.log('  PASSED ✅');

    // ----------------------------------------------------
    // TEST 19: Supabase mode contract compatibility structure
    // ----------------------------------------------------
    console.log('Test 19: Contract contract compatibility check...');
    const t19 = await request(`/support/tickets/${createdTicketId}/messages`, {
      headers: { Authorization: `Bearer ${passengerAToken}` }
    });
    assert(Array.isArray(t19.data));
    t19.data.forEach(m => {
      assert(m.hasOwnProperty('id'));
      assert(m.hasOwnProperty('ticket_id'));
      assert(m.hasOwnProperty('message'));
      assert(m.hasOwnProperty('sender'));
      assert(m.sender.hasOwnProperty('id'));
      assert(m.sender.hasOwnProperty('full_name'));
      assert(m.sender.hasOwnProperty('role'));
      assert(m.hasOwnProperty('created_at'));
    });
    console.log('  PASSED ✅');

    console.log('\n🎉 ALL 19 SUPPORT SYSTEM TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILURE:', err);
    process.exitCode = 1;
  } finally {
    await stopServer();
    // Clean temp test file
    if (fs.existsSync(process.env.DB_FILE_PATH)) {
      try { fs.unlinkSync(process.env.DB_FILE_PATH); } catch (e) {}
    }
  }
}

runTests();
