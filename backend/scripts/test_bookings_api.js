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
  path: '/api/bookings?all=true',
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
      console.log(`GET /api/bookings status ${res.statusCode}, count: ${Array.isArray(list) ? list.length : 'not array'}`);
    } catch (e) {
      console.log('Error parsing response:', e.message);
    }
  });
});

req.on('error', err => {
  console.log('Request error:', err.message);
});

req.end();
