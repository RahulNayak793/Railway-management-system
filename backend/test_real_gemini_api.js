const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log('GEMINI_API_KEY:', apiKey ? apiKey.slice(0, 10) + '...' : 'NONE');

function testGemini(promptText, modelName = 'gemini-1.5-flash') {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: promptText }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', err => resolve({ error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- Testing model: gemini-1.5-flash ---');
  const res1 = await testGemini("how many trains avaliable for booking", "gemini-1.5-flash");
  console.log('Status 1.5:', res1.statusCode);
  console.log('Data 1.5:', res1.data?.slice(0, 300));

  console.log('\n--- Testing model: gemini-2.0-flash ---');
  const res2 = await testGemini("how many trains avaliable for booking", "gemini-2.0-flash");
  console.log('Status 2.0:', res2.statusCode);
  console.log('Data 2.0:', res2.data?.slice(0, 300));
}

run();
