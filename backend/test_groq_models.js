const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const groqApiKey = process.env.GROQ_API_KEY;

function testGroqModel(modelName) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: 'Hello' }]
    });

    const options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ modelName, statusCode: res.statusCode, data });
      });
    });

    req.on('error', err => resolve({ modelName, error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function run() {
  const models = [
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  for (const m of models) {
    const res = await testGroqModel(m);
    console.log(`Model ${m} => Status ${res.statusCode}`);
    if (res.statusCode === 200) {
      console.log('✅ WORKING GROQ MODEL:', m);
      const parsed = JSON.parse(res.data);
      console.log('Reply:', parsed.choices?.[0]?.message?.content?.slice(0, 150));
    } else {
      console.log('Error:', res.data?.slice(0, 150));
    }
    console.log('-----------------------------------');
  }
}

run();
