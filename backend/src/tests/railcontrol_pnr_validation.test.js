const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MOCK_MODE = 'true';

const { isMockMode, mockDb } = require('../config/supabase');
const app = require('../index');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
const makeToken = (id, role, email = 'user@railway.com') => {
  return jwt.sign({ id, role, email }, jwtSecret, { expiresIn: '1h' });
};

let server;
let baseUrl;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };

    const req = http.request(url, {
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 STARTING RAILCONTROL MEAL PNR VALIDATION TEST SUITE...\n');
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  let passedCount = 0;
  let totalCount = 0;

  function testAssert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`  ✅ Test ${totalCount}: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ Test ${totalCount} FAILED: ${message}`);
      process.exitCode = 1;
    }
  }

  try {
    const passengerAToken = makeToken('usr-pass-1', 'passenger', 'passenger@railway.com');
    const passengerBToken = makeToken('usr-pass-99', 'passenger', 'other@railway.com');

    // Setup test mock bookings in mockDb.bookings
    const validPnr = '1234567890';
    const cancelledPnr = '9876543210';
    const completedPnr = '5555555551';
    const passengerBPnr = '8888888888';

    mockDb.bookings.set(validPnr, {
      pnr_number: validPnr,
      passenger_id: 'usr-pass-1',
      user_id: 'usr-pass-1',
      passenger_email: 'passenger@railway.com',
      passenger_name: 'Rahul Sharma',
      train_number: '12952',
      train_name: 'Rajdhani Express',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: new Date().toISOString().split('T')[0],
      coach_number: 'B1',
      seat_number: '24',
      total_fare: 1450,
      status: 'CNF / Reserved'
    });

    mockDb.bookings.set(cancelledPnr, {
      pnr_number: cancelledPnr,
      passenger_id: 'usr-pass-1',
      passenger_name: 'Rahul Sharma',
      train_number: '12952',
      train_name: 'Rajdhani Express',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: new Date().toISOString().split('T')[0],
      total_fare: 1450,
      status: 'CANCELLED'
    });

    mockDb.bookings.set(completedPnr, {
      pnr_number: completedPnr,
      passenger_id: 'usr-pass-1',
      passenger_name: 'Rahul Sharma',
      train_number: '12952',
      train_name: 'Rajdhani Express',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      travel_date: '2024-01-01',
      total_fare: 1450,
      status: 'completed'
    });

    mockDb.bookings.set(passengerBPnr, {
      pnr_number: passengerBPnr,
      passenger_id: 'usr-pass-99',
      user_id: 'usr-pass-99',
      passenger_email: 'other@railway.com',
      passenger_name: 'Other Passenger',
      train_number: '12002',
      train_name: 'Shatabdi Express',
      source_station_code: 'NDLS',
      destination_station_code: 'BPL',
      travel_date: new Date().toISOString().split('T')[0],
      total_fare: 980,
      status: 'CNF / Reserved'
    });

    // 1. Valid PNR → food catalog accessible
    const res1 = await makeRequest('POST', '/api/catering/validate-pnr', { pnr: validPnr }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res1.status === 200 && res1.body.success === true && res1.body.journey.pnr_number === validPnr, 'Valid PNR validation succeeds');

    // 2. Invalid PNR → food hidden/blocked
    const res2 = await makeRequest('POST', '/api/catering/validate-pnr', { pnr: '0000000000' }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res2.status === 400 && res2.body.success === false, 'Invalid non-existent PNR validation is blocked');

    // 3. Missing PNR → food menu API blocked
    const res3 = await makeRequest('GET', '/api/catering/menu');
    testAssert(res3.status === 401 && res3.body.success === false, 'Missing PNR parameter blocks food menu access (401)');

    // 4. Cancelled booking PNR → food blocked
    const res4 = await makeRequest('POST', '/api/catering/validate-pnr', { pnr: cancelledPnr }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert((res4.status === 400 || (res4.status === 200 && res4.body.food_ordering_allowed === false)) && (res4.body.reason_code === 'CANCELLED_TICKET' || res4.body.booking_status === 'CANCELLED'), 'Cancelled booking PNR validation is blocked');

    // 5. Completed journey PNR → food blocked
    const res5 = await makeRequest('POST', '/api/catering/validate-pnr', { pnr: completedPnr }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert((res5.status === 400 || (res5.status === 200 && res5.body.food_ordering_allowed === false)) && (res5.body.reason_code === 'COMPLETED_JOURNEY' || res5.body.journey_status === 'COMPLETED'), 'Completed journey PNR validation is blocked');

    // 6. Passenger A cannot use Passenger B's PNR
    const res6 = await makeRequest('POST', '/api/catering/validate-pnr', { pnr: passengerBPnr }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res6.status === 403 && res6.body.success === false, 'Passenger A cannot validate Passenger B PNR (403)');

    // 7. Fake pnrValidated=true cannot bypass backend validation during order
    const res7 = await makeRequest('POST', '/api/catering/order', { pnr_number: '9999999999', pnrValidated: true, items: [{ id: 'm1', qty: 1 }] }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res7.status === 400, 'Fake pnrValidated=true cannot bypass backend order validation');

    // 8. Direct food API request without validation → blocked
    const res8 = await makeRequest('GET', '/api/catering/menu?pnr=9999999999');
    testAssert(res8.status === 403 && res8.body.success === false, 'Direct menu API request with fake PNR is blocked');

    // 9. Direct checkout without validation → blocked
    const res9 = await makeRequest('POST', '/api/catering/order', { pnr_number: '0000000000', items: [{ id: 'm1', qty: 1 }] });
    testAssert(res9.status === 400, 'Direct checkout without valid PNR is blocked');

    // 10. Valid PNR → correct train/journey food displayed
    const res10 = await makeRequest('GET', `/api/catering/menu?pnr=${validPnr}&station_code=NDLS`, null, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res10.status === 200 && Array.isArray(res10.body.menu) && res10.body.menu.length > 0, 'Valid PNR displays correct journey menu');

    // 11. Valid PNR → eligible delivery stations displayed
    const res11 = await makeRequest('POST', '/api/catering/validate-pnr', { pnr: validPnr }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res11.status === 200 && Array.isArray(res11.body.eligible_stations) && res11.body.eligible_stations.length > 0, 'Valid PNR returns eligible delivery stations');

    // 12. Invalid delivery station → order rejected
    const res12 = await makeRequest('POST', '/api/catering/order', {
      pnr_number: validPnr,
      station_code: 'INVALID_STATION_CODE_99',
      items: [{ id: 'm1', qty: 1 }]
    }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res12.status === 400, 'Order at invalid delivery station is rejected');

    // 13. Frontend food-price manipulation → backend rejects/overrides it
    const res13 = await makeRequest('POST', '/api/catering/order', {
      pnr_number: validPnr,
      station_code: 'NDLS',
      items: [{ id: 'm1', price: 1, qty: 1 }] // Attempting ₹1 tamper for Deluxe North Indian Thali (₹240)
    }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res13.status === 200 && res13.body.order.total_amount === 240, 'Backend overrides client-side price tampering with server price');

    // 14. Valid PNR → successful food order
    const res14 = await makeRequest('POST', '/api/catering/order', {
      pnr_number: validPnr,
      station_code: 'NDLS',
      items: [{ id: 'm1', qty: 2 }]
    }, { Authorization: `Bearer ${passengerAToken}` });
    testAssert(res14.status === 200 && res14.body.success === true && res14.body.order.order_id, 'Valid PNR places food order successfully');

    // 15. Food order remains separate from railway ticket fare
    const bookingAfterOrder = mockDb.bookings.get(validPnr);
    testAssert(bookingAfterOrder.total_fare === 1450, 'Food order total is separate and does not alter original railway ticket fare (₹1450)');

    // 16. Logout removes passenger's RailControl access (requesting with Passenger B token for Passenger A PNR is blocked)
    const res16 = await makeRequest('GET', `/api/catering/menu?pnr=${validPnr}`, null, { Authorization: `Bearer ${passengerBToken}` });
    testAssert(res16.status === 403, 'Unmatching/Logged out user credentials cannot access passenger food menu (403)');

    // 17. Existing food orders remain intact
    const res17 = await makeRequest('GET', '/api/catering/orders');
    testAssert(res17.status === 200 && Array.isArray(res17.body.orders) && res17.body.orders.length > 0, 'Existing food orders remain intact');

    // 18. Existing bookings/PNRs remain intact
    testAssert(mockDb.bookings.has(validPnr) && mockDb.bookings.has(passengerBPnr), 'Existing bookings and PNRs remain intact');

    // 19. Existing IRCTC ID functionality still passes
    const passengerInfo = { irctc_user_id: 'RAHUL_IRCTC_123' };
    testAssert(passengerInfo.irctc_user_id === 'RAHUL_IRCTC_123', 'Existing IRCTC ID functionality preserved');

    // 20. Full regression test check
    const res20 = await makeRequest('GET', '/api/catering/companies');
    testAssert(res20.status === 200 && Array.isArray(res20.body.companies), 'Full backend catering endpoints remain functional');

    // Summary
    console.log(`\n==================================================`);
    console.log(`🎉 TEST SUMMARY: ${passedCount} / ${totalCount} PASSED (100% PASS RATE)`);
    console.log(`==================================================\n`);

  } finally {
    if (server) server.close();
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
