const https = require('https');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function callGemini(contents, tools = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: "You are a helpful railway assistant. Use searchTrains tool for searching trains." }]
      },
      tools: tools ? [{ functionDeclarations: tools }] : undefined
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const tools = [{
  name: 'searchTrains',
  description: 'Search trains by source and destination',
  parameters: {
    type: 'OBJECT',
    properties: {
      source: { type: 'STRING' },
      destination: { type: 'STRING' }
    },
    required: ['source', 'destination']
  }
}];

async function run() {
  console.log('--- TURN 1 ---');
  const contents = [{
    role: 'user',
    parts: [{ text: 'which trains run from NDLS to MMCT?' }]
  }];
  
  let res1 = await callGemini(contents, tools);
  console.log('RES 1:', JSON.stringify(res1, null, 2));

  const candidate = res1.candidates?.[0];
  const functionCall = candidate?.content?.parts?.[0]?.functionCall;

  if (functionCall) {
    console.log('Model requested function:', functionCall);
    contents.push(candidate.content);

    contents.push({
      role: 'user',
      parts: [{
        functionResponse: {
          name: functionCall.name,
          response: {
            trains: [
              { trainNumber: '12951', name: 'Mumbai Rajdhani', source: 'NDLS', destination: 'MMCT', fare: 350 }
            ]
          }
        }
      }]
    });

    console.log('--- TURN 2 ---');
    console.log('Sending contents:', JSON.stringify(contents, null, 2));
    let res2 = await callGemini(contents);
    console.log('RES 2:', JSON.stringify(res2, null, 2));
  }
}

run().catch(console.error);
