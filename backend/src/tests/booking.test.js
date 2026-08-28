const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';

const app = require('../index');
const assert = require('assert');
const crypto = require('crypto');

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`📡 Test server listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => {
      console.log(`🔌 Test server stopped.`);
      resolve();
    });
  });
}

// Helper to make requests
async function makeRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: response.status, body: json };
}

// Helper to create mock passenger authorization token
function getPassengerToken(userId = 'usr-test-user-' + Math.random().toString(36).substr(2, 9)) {
  const payload = {
    id: userId,
    email: 'testpassenger@railway.com',
    role: 'passenger',
    full_name: 'Test Passenger'
  };
  return 'mock-base64-' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function runTests() {
  await startServer();
  let failed = false;

  // Initialize test train for booking tests in test-db.json
  const { mockDb } = require('../config/supabase');
  mockDb.trains.set('train-123', {
    id: 'train-123',
    train_number: '23456',
    train_name: 'Express Special',
    source: 'NDLS',
    destination: 'MMCT',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    status: 'on_time'
  });
  mockDb.routes.set('route-123', {
    id: 'route-123',
    train_id: 'train-123',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    departure_time: '10:00:00',
    arrival_time: '18:00:00',
    stops: []
  });

  try {
    console.log('\n--- 🧪 RUNNING RAILWAY MANAGEMENT SYSTEM HARDENING TESTS ---\n');

    // Test 1: PNR Status Lookup Sanitization for Anonymous Searches
    console.log('Test 1: Public PNR Lookup Sanitization...');
    const passengerId = 'usr-test-user-pnr-check';
    const passengerToken = getPassengerToken(passengerId);
    const idempotencyKey = crypto.randomUUID();

    // 1. Create a booking
    const bookRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: JSON.stringify({
        train_id: 'train-123',
        travel_date: '2026-09-10',
        coach_class: '3A',
        passengers: [{ name: 'Secret Passenger', age: 45, gender: 'Female' }],
        total_fare: 750,
        idempotency_key: idempotencyKey
      })
    });
    
    assert.strictEqual(bookRes.status, 201, 'Booking creation should succeed');
    const pnr = bookRes.body.booking.pnr_number;
    assert.ok(pnr, 'Should return a valid PNR number');

    // 2. Fetch anonymously (No Authorization header)
    const anonLookup = await makeRequest(`/bookings/pnr/${pnr}`);
    assert.strictEqual(anonLookup.status, 200, 'Anonymous lookup should succeed');
    assert.strictEqual(anonLookup.body.pnr_number, pnr, 'PNR should match');
    assert.strictEqual(anonLookup.body.allocations[0].passenger_name, 'Secret Passenger', 'Passenger name should be visible');
    assert.strictEqual(anonLookup.body.allocations[0].passenger_age, undefined, 'Passenger age MUST be censored/sanitized for anonymous searches');
    assert.strictEqual(anonLookup.body.allocations[0].passenger_gender, undefined, 'Passenger gender MUST be censored/sanitized for anonymous searches');
    console.log('✅ Test 1 Passed: Public PNR lookup correctly sanitizes passenger details.');

    // Test 2: Idempotency Key Deduplication
    console.log('\nTest 2: Idempotency Key Deduplication...');
    // Repeat booking request with same idempotency key
    const retryRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: JSON.stringify({
        train_id: 'train-123',
        travel_date: '2026-09-10',
        coach_class: '3A',
        passengers: [{ name: 'Secret Passenger', age: 45, gender: 'Female' }],
        total_fare: 750,
        idempotency_key: idempotencyKey
      })
    });

    assert.strictEqual(retryRes.status, 201, 'Retry should succeed');
    assert.strictEqual(retryRes.body.booking.pnr_number, pnr, 'PNR of idempotent return must match first booking');
    assert.ok(retryRes.body.message.includes('retrieved') || retryRes.body.message.includes('Idempotent'), 'Should indicate retrieval from idempotency store');
    console.log('✅ Test 2 Passed: Idempotency key successfully deduplicated duplicate requests.');

    // Test 3: Concurrency / Error Handling
    console.log('\nTest 3: Error Handling & Parameters Validation...');
    const invalidRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(invalidRes.status, 400, 'Invalid request should return HTTP 400');
    console.log('✅ Test 3 Passed: Error handling and parameter validation works.');

    // Test 4: Same key + different payload -> 409 Conflict
    console.log('\nTest 4: Same key + different payload -> 409 Conflict...');
    const diffPayloadRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: JSON.stringify({
        train_id: 'train-456', // Modified train_id parameter
        travel_date: '2026-09-10',
        coach_class: '3A',
        passengers: [{ name: 'Secret Passenger', age: 45, gender: 'Female' }],
        total_fare: 750,
        idempotency_key: idempotencyKey
      })
    });
    assert.strictEqual(diffPayloadRes.status, 409, 'Should reject modified payload with HTTP 409 Conflict');
    console.log('✅ Test 4 Passed: Payload changes correctly return 409.');

    // Test 5: Same key + different user -> 403 Forbidden
    console.log('\nTest 5: Same key + different user -> 403 Forbidden...');
    const otherUserToken = getPassengerToken('usr-other-passenger');
    const diffUserRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${otherUserToken}` },
      body: JSON.stringify({
        train_id: 'train-123',
        travel_date: '2026-09-10',
        coach_class: '3A',
        passengers: [{ name: 'Secret Passenger', age: 45, gender: 'Female' }],
        total_fare: 750,
        idempotency_key: idempotencyKey
      })
    });
    assert.strictEqual(diffUserRes.status, 403, 'Should reject different user with HTTP 403 Forbidden');
    console.log('✅ Test 5 Passed: Different users correctly return 403.');

    // Test 6: Completed booking -> new booking gets new key
    console.log('\nTest 6: Completed booking -> new booking gets new key...');
    const newKey = crypto.randomUUID();
    const newBookRes = await makeRequest('/bookings/book', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: JSON.stringify({
        train_id: 'train-123',
        travel_date: '2026-09-10',
        coach_class: '3A',
        passengers: [{ name: 'Different Passenger', age: 29, gender: 'Male' }],
        total_fare: 750,
        idempotency_key: newKey
      })
    });
    assert.strictEqual(newBookRes.status, 201, 'Should create a new booking with a new key');
    assert.notStrictEqual(newBookRes.body.booking.pnr_number, pnr, 'PNR should be different');
    console.log('✅ Test 6 Passed: New booking with new key successfully creates a separate reservation.');

    // Test 7: Booking Cancellation Persistence & Transaction
    console.log('\nTest 7: Booking Cancellation Persistence & Transaction...');
    const bookingIdToCancel = newBookRes.body.booking.id;
    
    // 1. Try to cancel with unauthorized user
    const unauthCancel = await makeRequest(`/bookings/${bookingIdToCancel}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${otherUserToken}` }
    });
    assert.strictEqual(unauthCancel.status, 403, 'Unauthorized user should be rejected with 403');

    // 2. Cancel with owner
    const cancelRes = await makeRequest(`/bookings/${bookingIdToCancel}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(cancelRes.status, 200, 'Cancellation should succeed');
    assert.strictEqual(cancelRes.body.booking.status, 'cancelled', 'Booking status should update to cancelled');
    assert.strictEqual(cancelRes.body.payment_status, 'refund_pending', 'Payment status should update to refund_pending');

    // 3. Try to cancel again
    const doubleCancel = await makeRequest(`/bookings/${bookingIdToCancel}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(doubleCancel.status, 400, 'Double cancellation should return 400');

    // 4. Verify in GET /bookings that status remains cancelled
    const listRes = await makeRequest('/bookings', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    const cancelledBookingInList = listRes.body.find(b => b.id === bookingIdToCancel);
    assert.ok(cancelledBookingInList, 'Cancelled booking must exist in history');
    assert.strictEqual(cancelledBookingInList.status, 'cancelled', 'Status must be cancelled in history');
    console.log('✅ Test 7 Passed: Booking cancellation persists and enforces transitions and auth.');

    // Test 8: RailBot AI Chatbot Tools Authorization & Sanitization
    console.log('\nTest 8: RailBot AI Chatbot Tools Authorization & Sanitization...');
    const botPath = '/ai/chatbot';

    // 1. Search Trains Tool via Chatbot message
    const botSearch = await makeRequest(botPath, {
      method: 'POST',
      body: JSON.stringify({
        message: 'Search trains from NDLS to MMCT on 2026-09-10'
      })
    });
    assert.strictEqual(botSearch.status, 200, 'AI search query should succeed');
    assert.ok(botSearch.body.reply, 'Should return a response');
    assert.ok(botSearch.body.reply.includes('NDLS') || botSearch.body.reply.includes('tool output'), 'Reply should present tool result details');
    console.log('✅ Test 8.1 Passed: RailBot search trains tool executes.');

    // 2. Anonymous PNR Check (sanitized)
    const botAnonPnr = await makeRequest(botPath, {
      method: 'POST',
      body: JSON.stringify({
        message: `Check PNR status for ${pnr}`
      })
    });
    assert.strictEqual(botAnonPnr.status, 200, 'Anonymous PNR check should succeed');
    assert.ok(botAnonPnr.body.reply.includes('status'), 'Should return status');
    assert.ok(!botAnonPnr.body.reply.includes('Secret Passenger'), 'Should censor passenger names/details for anonymous searches');
    console.log('✅ Test 8.2 Passed: Anonymous PNR query correctly sanitizes details.');

    // 3. Authenticated Owner PNR Check (full details)
    const botOwnerPnr = await makeRequest(botPath, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` },
      body: JSON.stringify({
        message: `Check PNR status for ${pnr}`
      })
    });
    assert.strictEqual(botOwnerPnr.status, 200, 'Owner PNR check should succeed');
    assert.ok(botOwnerPnr.body.reply.includes('Secret Passenger') || botOwnerPnr.body.reply.includes('tool output'), 'Authenticated owner PNR query should return passenger names/details');
    console.log('✅ Test 8.3 Passed: Authenticated owner PNR query returns full details.');

    // Helper to upload a mock file via multipart/form-data
    async function uploadMockFile(token, filename, content, mimeType) {
      const boundary = '----TestBoundary' + Math.random().toString(36).substr(2, 9);
      const header = 
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      
      const bodyBuffer = Buffer.concat([
        Buffer.from(header, 'utf-8'),
        Buffer.from(content),
        Buffer.from(footer, 'utf-8')
      ]);
      
      const response = await fetch(`${BASE_URL}/auth/profile/identity-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: bodyBuffer
      });
      
      const text = await response.text();
      let json = {};
      try { json = JSON.parse(text); } catch (e) {}
      return { status: response.status, body: json };
    }

    // Test 9: Identity Document Upload API Endpoint
    console.log('\nTest 9: Identity Document Upload API...');
    
    // Test 9.1: Unauthenticated request -> 401
    const unauthUpload = await makeRequest('/auth/profile/identity-document', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer invalid-token-value' }
    });
    assert.strictEqual(unauthUpload.status, 401, 'Unauthenticated upload should be rejected with 401');
    console.log('✅ Test 9.1 Passed: Unauthenticated request rejected.');

    // Test 9.2: Authenticated upload with missing file -> 400
    const emptyUpload = await makeRequest('/auth/profile/identity-document', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(emptyUpload.status, 400, 'Upload with no file should be rejected with 400');
    console.log('✅ Test 9.2 Passed: Missing file rejected.');

    // Test 9.3: Valid upload -> 201
    const validUpload = await uploadMockFile(passengerToken, 'test_identity.pdf', '%PDF-1.4 mock content', 'application/pdf');
    assert.strictEqual(validUpload.status, 201, 'Valid upload should succeed with 201');
    assert.ok(validUpload.body.success, 'Should indicate success');
    assert.ok(validUpload.body.user.document_url, 'Should return user with document_url');
    console.log('✅ Test 9.3 Passed: Valid file upload succeeds.');

    // Test 9.4: Invalid format (EXE) -> 415
    const invalidUpload = await uploadMockFile(passengerToken, 'malicious.exe', 'mock exe content', 'application/x-msdownload');
    assert.strictEqual(invalidUpload.status, 415, 'Invalid format should return 415');
    console.log('✅ Test 9.4 Passed: Unsupported file format rejected.');

    // Test 9.5: File size too large (>5MB) -> 413
    const oversizedContent = Buffer.alloc(6 * 1024 * 1024); // 6 MB
    const largeUpload = await uploadMockFile(passengerToken, 'large.pdf', oversizedContent, 'application/pdf');
    assert.ok([400, 413].includes(largeUpload.status), 'Oversized file should return 413 or 400');
    console.log('✅ Test 9.5 Passed: Oversized file rejected.');

    // Test 9.6: Persistence check
    const meRes = await makeRequest('/auth/me', {
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });
    assert.strictEqual(meRes.status, 200);
    assert.ok(meRes.body.user.document_url.includes('test_identity.pdf') || meRes.body.user.document_url.includes('/uploads/'), 'Document URL should persist');
    console.log('✅ Test 9.6 Passed: Persisted reference retrieved successfully.');

    console.log('\n🎉 ALL HARDENING, CANCELLATION & UPLOAD PERSISTENCE TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (error) {
    console.error('\n❌ Test Failure detected:', error.message);
    failed = true;
  } finally {
    await stopServer();
    setTimeout(() => {
      process.exit(failed ? 1 : 0);
    }, 100);
  }
}

runTests();
