const http = require('http');
const jwt = require('jsonwebtoken');
const assert = require('assert');

const secret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
const adminToken = jwt.sign({ id: 'usr-demo-admin', email: 'admin@railway.com', role: 'admin' }, secret);

function req(method, path) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + adminToken,
        'Content-Type': 'application/json'
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
    r.end();
  });
}

async function runPassengerNameTest() {
  console.log('\n--- 🧪 RUNNING PASSENGER NAME PROPAGATION VERIFICATION TEST ---');

  const res = await req('GET', '/api/admin/refunds');
  assert.strictEqual(res.status, 200);

  const records = res.body?.records || res.body;
  assert.ok(records.length > 0);

  console.log(`Checking ${records.length} cancellation records for real passenger names...`);

  let invalidCount = 0;
  for (const r of records) {
    const pName = r.passenger || r.passenger_name;
    console.log(`- PNR #${r.pnr}: Passenger Display Name = "${pName}"`);

    // Verify name is NOT generic ADMIN / PASSENGER / USER / undefined
    if (!pName || ['ADMIN', 'PASSENGER', 'USER', 'UNDEFINED', 'NULL'].includes(String(pName).toUpperCase())) {
      console.error(`❌ INVALID PASSENGER NAME FOR PNR ${r.pnr}: ${pName}`);
      invalidCount++;
    }
  }

  assert.strictEqual(invalidCount, 0, 'Generic role labels found instead of actual passenger names!');

  console.log('\n🎉 PASSENGER NAME PROPAGATION TEST PASSED 100%! All records display actual passenger names.\n');
}

runPassengerNameTest().catch(err => {
  console.error('❌ Passenger name propagation test failed:', err);
  process.exit(1);
});
