const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const groqApiKey = process.env.GROQ_API_KEY;

function testGroqModel(modelName) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are RailBot, an intelligent AI railway assistant.' },
        { role: 'user', content: 'What is the difference between 1A, 2A, 3A and Sleeper?' }
      ]
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
  const models = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'groq/compound'];
  for (const m of models) {
    console.log(`Testing Groq Model: ${m}`);
    const res = await testGroqModel(m);
    console.log(`Status ${m}:`, res.statusCode);
    if (res.statusCode === 200) {
      const parsed = JSON.parse(res.data);
      console.log('✅ SUCCESSful GROQ ANSWER:\n', parsed.choices?.[0]?.message?.content);
    } else {
      console.log('Error:', res.data);
    }
    console.log('-------------------------------------------');
  }
}

run();
