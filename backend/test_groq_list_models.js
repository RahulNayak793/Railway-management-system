const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const groqApiKey = process.env.GROQ_API_KEY;

function listGroqModels() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`
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
    req.end();
  });
}

async function run() {
  const res = await listGroqModels();
  console.log('List Models Status:', res.statusCode);
  if (res.statusCode === 200) {
    const parsed = JSON.parse(res.data);
    const modelIds = parsed.data?.map(m => m.id);
    console.log('AVAILABLE GROQ MODELS:', modelIds);
  } else {
    console.log('Error:', res.data);
  }
}

run();
