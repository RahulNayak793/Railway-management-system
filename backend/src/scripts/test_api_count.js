const http = require('http');

const adminToken = 'Bearer mock-base64-eyJpZCI6InVzci1hZG1pbiIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AcmFpbHdheS5jb20ifQ==';

function fetchApi(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': adminToken,
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('Testing GET /api/admin/routes?page=1&pageSize=25 against running server...');
  const res1 = await fetchApi('/api/admin/routes?page=1&pageSize=25');
  console.log(`Status: ${res1.status}`);
  console.log(`Response keys: ${Object.keys(res1.data).join(', ')}`);
  console.log(`Total count: ${res1.data.total}`);
  console.log(`Page 1 routes count: ${res1.data.routes.length}`);
  console.log(`First route Page 1: [${res1.data.routes[0].id}] ${res1.data.routes[0].source_station_code} ➔ ${res1.data.routes[0].destination_station_code}`);

  console.log('\nTesting GET /api/admin/routes?page=2&pageSize=25...');
  const res2 = await fetchApi('/api/admin/routes?page=2&pageSize=25');
  console.log(`Total count: ${res2.data.total}`);
  console.log(`Page 2 routes count: ${res2.data.routes.length}`);
  console.log(`First route Page 2: [${res2.data.routes[0].id}] ${res2.data.routes[0].source_station_code} ➔ ${res2.data.routes[0].destination_station_code}`);

  if (res1.data.routes[0].id !== res2.data.routes[0].id) {
    console.log('\n✅ VERIFICATION SUCCESS: Page 1 and Page 2 return different route sets as expected!');
  } else {
    console.error('❌ Error: Page 1 and Page 2 returned identical items!');
  }
}

run();
