const http = require('http');

const adminPayload = {
  id: 'usr-admin-test',
  email: 'admin@railway.com',
  role: 'admin',
  full_name: 'Test Admin'
};
const token = 'mock-base64-' + Buffer.from(JSON.stringify(adminPayload)).toString('base64');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/admin/train-status?date=2026-09-24',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const list = JSON.parse(data);
      const matches12345 = list.filter(t => String(t.train_number) === '12345');
      console.log(`Matching 12345 count: ${matches12345.length}`);
      matches12345.forEach(t => {
        console.log(`ID: ${t.id} | Train: #${t.train_number} ${t.train_name} | ${t.source_station_code} -> ${t.destination_station_code} | Dep: ${t.departure_time} | Arr: ${t.arrival_time} | Status: ${t.status}`);
      });
    } catch (e) {
      console.log('Error parsing response:', e.message);
    }
  });
});

req.on('error', err => {
  console.log('Request error:', err.message);
});

req.end();
