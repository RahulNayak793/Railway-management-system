const http = require('http');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
const token = jwt.sign({ id: 'usr-demo-admin', email: 'admin@railway.com', role: 'admin' }, secret);

function req(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, resp => {
      let buf = '';
      resp.on('data', d => buf += d);
      resp.on('end', () => {
        try {
          resolve({ status: resp.statusCode, body: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: resp.statusCode, body: buf });
        }
      });
    });

    request.on('error', reject);
    if (data) request.write(JSON.stringify(data));
    request.end();
  });
}

async function runE2EVerification() {
  console.log('\n--- 🚀 RUNNING E2E REAL CANCELLATION TO ADMIN REFUND VERIFICATION ---');

  // 1. Cancel active booking bk-2cn78wtcq (PNR 9586279223)
  console.log('1. Cancelling Active Booking bk-2cn78wtcq (PNR #9586279223)...');
  const cancelRes = await req('PUT', '/api/bookings/bk-2cn78wtcq/cancel', {
    reason: 'Passenger requested cancellation - E2E Verification'
  });

  console.log('Cancellation HTTP Status:', cancelRes.status);
  console.log('Cancellation Response:', cancelRes.body?.message || cancelRes.body);

  if (cancelRes.status !== 200 && cancelRes.body?.error !== 'Booking is already cancelled.') {
    throw new Error('Cancellation failed with status ' + cancelRes.status);
  }

  // 2. Fetch Admin Refunds GET /api/admin/refunds
  console.log('\n2. Fetching Admin Refunds (GET /api/admin/refunds)...');
  const refundRes = await req('GET', '/api/admin/refunds');
  console.log('Admin Refunds HTTP Status:', refundRes.status);

  const records = Array.isArray(refundRes.body) ? refundRes.body : (refundRes.body?.records || []);
  console.log('Total refund records count in Admin API:', records.length);

  const found = records.find(r => r.pnr === '9586279223' || r.booking_id === 'bk-2cn78wtcq');
  console.log('\n3. Verification Result for PNR #9586279223 in Admin Refunds:');
  console.log(found ? JSON.stringify(found, null, 2) : '❌ PNR NOT FOUND');

  if (!found) {
    throw new Error('PNR 9586279223 missing from Admin Refunds API!');
  }

  console.log('\n✅ REAL PASSENGER CANCELLATION → ADMIN REFUND CENTER E2E VERIFICATION SUCCESSFUL!\n');
}

runE2EVerification().catch(err => {
  console.error('❌ E2E Verification failed:', err.message);
  process.exit(1);
});
