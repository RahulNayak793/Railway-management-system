const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

console.log('Testing GROQ_API_KEY:', groqApiKey ? groqApiKey.slice(0, 15) + '...' : 'NONE');
console.log('Testing GROQ_MODEL:', groqModel);

function testGroq(promptText) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: groqModel,
      messages: [
        { role: 'system', content: 'You are RailBot, an intelligent railway assistant for RailControl.' },
        { role: 'user', content: promptText }
      ],
      temperature: 0.2
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
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', err => resolve({ error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- Sending request to Groq API ---');
  const res = await testGroq("What is RAC in Indian Railways?");
  console.log('Status:', res.statusCode);
  if (res.statusCode === 200) {
    const parsed = JSON.parse(res.data);
    console.log('SUCCESS Groq Answer:\n', parsed.choices?.[0]?.message?.content);
  } else {
    console.log('ERROR:', res.data);
  }
}

run();
