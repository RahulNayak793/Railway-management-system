const http = require('http');
const jwt = require('jsonwebtoken');

const passenger = {
  id: 'usr-demo-passenger',
  email: 'rahulpatakar92@gmail.com',
  full_name: 'RAHULPATAKAR92',
  role: 'passenger'
};
const token = jwt.sign(passenger, 'mock-jwt-secret-key-32-characters-long', { expiresIn: '2h' });

function post(path, body, authToken = token) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.write(postData);
    req.end();
  });
}

function get(path, authToken = token) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.end();
  });
}

async function check() {
  console.log('=============================================================');
  console.log('  VERIFYING LIVE BACKEND RESPONSES ON http://127.0.0.1:5000');
  console.log('=============================================================\n');

  // TEST 1 — Upcoming 3A (7037000206)
  const res3A = await post('/api/catering/validate-pnr', { pnr: '7037000206' });
  console.log('TEST 1: UPCOMING 3A (7037000206)');
  console.log('  Status:', res3A.status);
  console.log('  food_ordering_allowed:', res3A.body?.food_ordering_allowed);
  console.log('  ticket_class:', res3A.body?.ticket_class);
  console.log('  journey_status:', res3A.body?.journey_status);
  console.log('  message:', res3A.body?.message);

  // TEST 2 — Upcoming 1A (8611971956)
  const res1A = await post('/api/catering/validate-pnr', { pnr: '8611971956' });
  console.log('\nTEST 2: UPCOMING 1A (8611971956)');
  console.log('  Status:', res1A.status);
  console.log('  food_ordering_allowed:', res1A.body?.food_ordering_allowed);
  console.log('  ticket_class:', res1A.body?.ticket_class);
  console.log('  food_entitlement:', res1A.body?.food_entitlement);

  // TEST 3 — Cancelled PNR (6222939872)
  const resCanc = await post('/api/catering/validate-pnr', { pnr: '6222939872' });
  console.log('\nTEST 3: CANCELLED PNR (6222939872)');
  console.log('  Status:', resCanc.status);
  console.log('  food_ordering_allowed:', resCanc.body?.food_ordering_allowed);
  console.log('  booking_status:', resCanc.body?.booking_status);
  console.log('  reason_code:', resCanc.body?.reason_code);
  console.log('  message:', resCanc.body?.message);

  // TEST 4 — Completed Journey PNR (6830165983)
  const resComp = await post('/api/catering/validate-pnr', { pnr: '6830165983' });
  console.log('\nTEST 4: COMPLETED JOURNEY PNR (6830165983)');
  console.log('  Status:', resComp.status);
  console.log('  food_ordering_allowed:', resComp.body?.food_ordering_allowed);
  console.log('  journey_status:', resComp.body?.journey_status);
  console.log('  reason_code:', resComp.body?.reason_code);
  console.log('  message:', resComp.body?.message);

  // TEST 5 — Cancelled PNR Menu check
  const resMenuCanc = await get('/api/catering/menu?pnr=6222939872');
  console.log('\nTEST 5: CANCELLED PNR MENU ACCESS');
  console.log('  Status:', resMenuCanc.status);
  console.log('  Error:', resMenuCanc.body?.error);

  // TEST 6 — Completed Journey Menu check
  const resMenuComp = await get('/api/catering/menu?pnr=6830165983');
  console.log('\nTEST 6: COMPLETED JOURNEY MENU ACCESS');
  console.log('  Status:', resMenuComp.status);
  console.log('  Error:', resMenuComp.body?.error);

  // TEST 7 — Direct Food-Order API with Cancelled PNR
  const resOrderCanc = await post('/api/catering/order', {
    pnr_number: '6222939872',
    station_code: 'NDLS',
    items: [{ id: 'm101', name: 'Steamed Idli Sambar Pair', price: 110, quantity: 1 }]
  });
  console.log('\nTEST 7: DIRECT FOOD-ORDER ON CANCELLED PNR');
  console.log('  Status:', resOrderCanc.status);
  console.log('  Code:', resOrderCanc.body?.code);
  console.log('  Message:', resOrderCanc.body?.message);

  // TEST 8 — Direct Food-Order API with Completed Journey PNR
  const resOrderComp = await post('/api/catering/order', {
    pnr_number: '6830165983',
    station_code: 'NDLS',
    items: [{ id: 'm101', name: 'Steamed Idli Sambar Pair', price: 110, quantity: 1 }]
  });
  console.log('\nTEST 8: DIRECT FOOD-ORDER ON COMPLETED JOURNEY PNR');
  console.log('  Status:', resOrderComp.status);
  console.log('  Code:', resOrderComp.body?.code);
  console.log('  Message:', resOrderComp.body?.message);

  // TEST 9 — Razorpay Create Order on Cancelled PNR
  const resRzpCanc = await post('/api/payments/create-order', {
    payment_type: 'FOOD_ORDER',
    reference_id: '6222939872',
    amount: 110.00
  });
  console.log('\nTEST 9: RAZORPAY FOOD ORDER ON CANCELLED PNR');
  console.log('  Status:', resRzpCanc.status);
  console.log('  Code:', resRzpCanc.body?.code);
  console.log('  Message:', resRzpCanc.body?.message);

  // TEST 10 — Razorpay Create Order on Completed Journey PNR
  const resRzpComp = await post('/api/payments/create-order', {
    payment_type: 'FOOD_ORDER',
    reference_id: '6830165983',
    amount: 110.00
  });
  console.log('\nTEST 10: RAZORPAY FOOD ORDER ON COMPLETED JOURNEY PNR');
  console.log('  Status:', resRzpComp.status);
  console.log('  Code:', resRzpComp.body?.code);
  console.log('  Message:', resRzpComp.body?.message);
}

check();
