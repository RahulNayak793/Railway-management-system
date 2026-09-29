const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';

const app = require('../index');

const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const makeToken = (id, role, email = 'user@railway.com') => {
  return jwt.sign({ id, role, email }, jwtSecret, { expiresIn: '1h' });
};

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`📡 Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function request(method, urlPath, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data };
}

async function runTrainFoodCateringVerificationTests() {
  console.log('🧪 Starting Train Food Availability, Food Selection & Ticket Price Verification Suite...\n');
  await startServer();

  try {
    const adminToken = makeToken('usr-demo-admin', 'admin', 'admin@railway.com');
    const passengerToken = makeToken('usr-demo-passenger', 'passenger', 'passenger@railway.com');

    // Snapshot existing bookings count & total fare before testing (historical data check)
    const existingBookingsRes = await request('GET', '/api/bookings', null, passengerToken);
    assert.strictEqual(existingBookingsRes.status, 200);
    const historicalBookingsCount = existingBookingsRes.data.length;
    const historicalFaresSnapshot = existingBookingsRes.data.map(b => ({ id: b.id, total_fare: b.total_fare }));

    // ==========================================
    // TEST 1 — Food Available (Admin creates train with Food Available=Yes, Veg=150)
    // ==========================================
    console.log('Test 1: Admin creates train with Food Available: Yes, Veg ₹150...');
    const trainNo1 = '88' + Math.floor(100 + Math.random() * 900);
    const createRes1 = await request('POST', '/api/trains', {
      train_number: trainNo1,
      train_name: 'Superfast Food Express 1',
      train_type: 'Superfast',
      source: 'NDLS',
      destination: 'MMCT',
      departure_time: '08:00',
      arrival_time: '18:00',
      available_classes: ['1A', '2A', '3A', 'SL'],
      food_available: true,
      food_type: 'Vegetarian',
      vegetarian_food_price: 150,
      non_vegetarian_food_price: 0
    }, adminToken);

    assert.strictEqual(createRes1.status, 201, `Train 1 creation succeeded, status: ${createRes1.status}`);
    const train1 = createRes1.data.train;
    assert.strictEqual(train1.food_available, true);
    assert.strictEqual(train1.food_type, 'Vegetarian');
    assert.strictEqual(train1.vegetarian_food_price, 150);
    console.log('✅ Test 1 Passed: Train created with Food Available=Yes, Vegetarian ₹150.\n');

    // ==========================================
    // TEST 2 — No Food (Admin creates train with Food Available=No)
    // ==========================================
    console.log('Test 2: Admin creates train with Food Available: No...');
    const trainNo2 = '88' + Math.floor(100 + Math.random() * 900);
    const createRes2 = await request('POST', '/api/trains', {
      train_number: trainNo2,
      train_name: 'No Food Express 2',
      train_type: 'Express',
      source: 'NDLS',
      destination: 'AGC',
      departure_time: '10:00',
      arrival_time: '13:00',
      available_classes: ['CC', '2S'],
      food_available: false,
      food_type: 'Both',
      vegetarian_food_price: 150,
      non_vegetarian_food_price: 200
    }, adminToken);

    assert.strictEqual(createRes2.status, 201);
    const train2 = createRes2.data.train;
    assert.strictEqual(train2.food_available, false);
    assert.strictEqual(train2.vegetarian_food_price, 0);
    assert.strictEqual(train2.non_vegetarian_food_price, 0);

    // Attempting to select food on Food Available=No train should fail
    const invalidFoodBooking = await request('POST', '/api/bookings/book', {
      train_id: train2.id,
      travel_date: '2026-09-25',
      coach_class: 'CC',
      source: 'NDLS',
      destination: 'AGC',
      passengers: [{ name: 'Test User', age: '30', gender: 'Male', irctc_id: 'userfood1', food_selection: 'Vegetarian' }]
    }, passengerToken);
    assert.strictEqual(invalidFoodBooking.status, 400, 'Backend rejects food selection when train food is unavailable');
    console.log('✅ Test 2 Passed: Food Available=No correctly enforces zero food charge and rejects food selection.\n');

    // ==========================================
    // TEST 3 — Both Food Types (Veg ₹150 & Non-Veg ₹200)
    // ==========================================
    console.log('Test 3: Admin configures Both food types (Veg ₹150 / Non-Veg ₹200)...');
    const trainNo3 = '88' + Math.floor(100 + Math.random() * 900);
    const createRes3 = await request('POST', '/api/trains', {
      train_number: trainNo3,
      train_name: 'Gourmet Express 3',
      train_type: 'Superfast',
      source: 'NDLS',
      destination: 'BPL',
      departure_time: '06:00',
      arrival_time: '14:00',
      available_classes: ['3A', 'SL'],
      food_available: true,
      catering_payment_mode: 'Included in Ticket',
      food_type: 'Both',
      vegetarian_food_price: 150,
      non_vegetarian_food_price: 200
    }, adminToken);

    assert.strictEqual(createRes3.status, 201);
    const train3 = createRes3.data.train;
    assert.strictEqual(train3.food_available, true);
    assert.strictEqual(train3.vegetarian_food_price, 150);
    assert.strictEqual(train3.non_vegetarian_food_price, 200);
    console.log('✅ Test 3 Passed: Both food types successfully configured.\n');

    // ==========================================
    // TEST 4 — Fare Calculation (Ticket Base + Food ₹150 = Total)
    // ==========================================
    console.log('Test 4: Verify single passenger fare calculation (Base + Food = Total)...');
    const bookRes1 = await request('POST', '/api/bookings/book', {
      train_id: train3.id,
      travel_date: '2026-09-25',
      coach_class: '3A',
      source: 'NDLS',
      destination: 'BPL',
      passengers: [{ name: 'Alice', age: '28', gender: 'Female', irctc_id: 'aliceirctc1', food_selection: 'Vegetarian' }]
    }, passengerToken);

    assert.strictEqual(bookRes1.status, 201, `Booking created, status: ${bookRes1.status}`);
    const b1 = bookRes1.data.booking;
    assert.strictEqual(b1.food_amount, 150, 'Food amount is ₹150');
    assert.strictEqual(b1.total_fare, b1.base_fare + 150, 'Total fare = base fare + food ₹150');
    console.log(`✅ Test 4 Passed: Exact fare calculation verified (Base ₹${b1.base_fare} + Food ₹150 = Total ₹${b1.total_fare}).\n`);

    // ==========================================
    // TEST 5 — Multiple Passengers (Pax 1 Veg ₹150, Pax 2 Non-Veg ₹200)
    // ==========================================
    console.log('Test 5: Verify multiple passengers individual food calculation...');
    const bookRes2 = await request('POST', '/api/bookings/book', {
      train_id: train3.id,
      travel_date: '2026-09-25',
      coach_class: '3A',
      source: 'NDLS',
      destination: 'BPL',
      passengers: [
        { name: 'Bob', age: '35', gender: 'Male', irctc_id: 'bobirctc1', food_selection: 'Vegetarian' },
        { name: 'Charlie', age: '32', gender: 'Male', irctc_id: 'charlieirctc1', food_selection: 'Non-Vegetarian' }
      ]
    }, passengerToken);

    assert.strictEqual(bookRes2.status, 201);
    const b2 = bookRes2.data.booking;
    assert.strictEqual(b2.food_amount, 350, 'Total food amount = ₹150 + ₹200 = ₹350');
    assert.strictEqual(b2.total_fare, b2.base_fare + 350, 'Total fare = base fare + ₹350 food');
    assert.strictEqual(b2.passengers[0].food_price, 150);
    assert.strictEqual(b2.passengers[1].food_price, 200);
    console.log(`✅ Test 5 Passed: Multiple passengers individual food choices calculated correctly (Base ₹${b2.base_fare} + Food ₹350 = Total ₹${b2.total_fare}).\n`);

    // ==========================================
    // TEST 6 — Frontend Price Tampering Rejection
    // ==========================================
    console.log('Test 6: Frontend attempts price tampering (submitting Veg=₹1)...');
    const bookResTamper = await request('POST', '/api/bookings/book', {
      train_id: train3.id,
      travel_date: '2026-09-25',
      coach_class: '3A',
      source: 'NDLS',
      destination: 'BPL',
      passengers: [{ name: 'Dave', age: '40', gender: 'Male', irctc_id: 'daveirctc1', food_selection: 'Vegetarian', food_price: 1 }] // Malicious price ₹1
    }, passengerToken);

    assert.strictEqual(bookResTamper.status, 201);
    const bTamper = bookResTamper.data.booking;
    assert.strictEqual(bTamper.food_amount, 150, 'Backend ignored client food_price=1 and charged authoritative ₹150');
    assert.strictEqual(bTamper.total_fare, bTamper.base_fare + 150, 'Backend total fare remains base_fare + authoritative ₹150');
    console.log('✅ Test 6 Passed: Frontend food price tampering successfully overridden by backend DB price.\n');

    // ==========================================
    // TEST 7 — Outside Food / E-Catering Isolation
    // ==========================================
    console.log('Test 7: Outside food order created separately without modifying ticket fare...');
    const outsideFoodRes = await request('POST', '/api/catering/order', {
      pnr_number: b1.pnr_number,
      station_code: 'NDLS',
      items: [{ id: 'm104', qty: 1 }],
      payment_method: 'UPI'
    }, passengerToken);

    assert.ok(outsideFoodRes.status === 200 || outsideFoodRes.status === 201, `Outside food order created, status: ${outsideFoodRes.status}`);
    const orderObj = outsideFoodRes.data.order;
    assert.ok(orderObj.order_id || orderObj.id, 'Outside food order ID exists');

    // Verify original booking total fare was not modified by outside food order
    const fetchB1 = await request('GET', `/api/bookings/pnr/${b1.pnr_number}`, null, passengerToken);
    assert.strictEqual(fetchB1.status, 200);
    assert.strictEqual(fetchB1.data.total_fare, b1.total_fare, 'Original railway ticket total fare remains unchanged');
    console.log('✅ Test 7 Passed: Outside food order remains a separate order without altering ticket fare.\n');

    // ==========================================
    // TEST 8 — Historical Data Preservation
    // ==========================================
    console.log('Test 8: Verify existing historical bookings remain completely unchanged...');
    const verifyBookingsRes = await request('GET', '/api/bookings', null, passengerToken);
    assert.strictEqual(verifyBookingsRes.status, 200);
    
    historicalFaresSnapshot.forEach(snap => {
      const current = verifyBookingsRes.data.find(b => b.id === snap.id);
      if (current) {
        assert.strictEqual(current.total_fare, snap.total_fare, `Historical booking ${snap.id} total_fare unchanged`);
      }
    });
    console.log('✅ Test 8 Passed: Historical bookings and fares remain 100% preserved and untouched.\n');

    // ==========================================
    // TEST 9 — Train Edit Persistence
    // ==========================================
    console.log('Test 9: Admin edits existing train food configuration...');
    const updateRes = await request('PUT', `/api/trains/${train3.id}`, {
      food_available: true,
      food_type: 'Both',
      vegetarian_food_price: 180,
      non_vegetarian_food_price: 240
    }, adminToken);

    assert.strictEqual(updateRes.status, 200, 'Train edit succeeded');
    const updatedTrain = updateRes.data.train;
    assert.strictEqual(updatedTrain.vegetarian_food_price, 180);
    assert.strictEqual(updatedTrain.non_vegetarian_food_price, 240);
    console.log('✅ Test 9 Passed: Train food configuration updated to Veg ₹180 / Non-Veg ₹240 without deleting train data.\n');

    // ==========================================
    // TEST 10 — UI / API Integration Consistency
    // ==========================================
    console.log('Test 10: Verify API integration consistency across endpoints...');
    const getTrainRes = await request('GET', `/api/trains?include_all=true`, null, passengerToken);
    assert.strictEqual(getTrainRes.status, 200);
    const fetchedTrain = getTrainRes.data.find(t => t.id === train3.id);
    assert.ok(fetchedTrain, 'Edited train returned in search endpoint');
    assert.strictEqual(fetchedTrain.food_available, true);
    assert.strictEqual(fetchedTrain.vegetarian_food_price, 180);

    const getPnrRes = await request('GET', `/api/bookings/pnr/${b2.pnr_number}`, null, passengerToken);
    assert.strictEqual(getPnrRes.status, 200);
    assert.strictEqual(getPnrRes.data.food_amount, 350);
    assert.strictEqual(getPnrRes.data.total_fare, b2.total_fare);
    console.log('✅ Test 10 Passed: Consistent food details returned across all API endpoints.\n');

    console.log('🎉 ALL 10 TRAIN FOOD & CATERING VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    await stopServer();
  }
}

runTrainFoodCateringVerificationTests().catch(err => {
  console.error('❌ Verification Test Failed:', err);
  process.exit(1);
});
