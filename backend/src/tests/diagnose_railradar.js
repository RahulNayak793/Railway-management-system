const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function diagnose() {
  const rawKey = process.env.RAILRADAR_API_KEY ? process.env.RAILRADAR_API_KEY.trim() : '';
  const baseUrl = (process.env.RAILRADAR_BASE_URL || process.env.RAILRADAR_API_BASE_URL || 'https://api.railradar.in').replace(/\/+$/, '');

  const isConfigured = Boolean(rawKey && rawKey !== 'your_railradar_api_key_here' && rawKey !== 'mock_api_key_placeholder');

  console.log('\n==================================================');
  console.log('📡 RAILRADAR LIVE API AUTHENTICATION & DIAGNOSTIC');
  console.log('==================================================');
  console.log('Target Gateway Base URL :', baseUrl);
  console.log('API Key Status          :', isConfigured ? 'CONFIGURED IN .env' : 'NOT CONFIGURED / PLACEHOLDER');
  if (isConfigured) {
    console.log('API Key Masked          :', rawKey.slice(0, 4) + '...' + rawKey.slice(-4));
  } else {
    console.log('API Key Current Value   :', rawKey || '(empty string)');
  }

  if (!isConfigured) {
    console.log('\n--------------------------------------------------');
    console.log('ℹ️ RESULT: RAILRADAR_API_KEY is currently unconfigured/placeholder.');
    console.log('   `verifyRailRadarConnection()` returns `status: "NOT_CONNECTED"`.');
    console.log('   The system is safely executing FALLBACK MODE using the Project Master Database.');
    console.log('--------------------------------------------------\n');
    return;
  }

  const testTrain = '12952';
  const testDate = new Date().toISOString().split('T')[0];
  const url = `${baseUrl}/v1/trains/${testTrain}/live?date=${testDate}`;

  console.log('\nExecuting Authenticated Request to:', url);

  try {
    const start = Date.now();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': rawKey,
        'User-Agent': 'RailControl-System/1.0'
      }
    });
    const elapsed = Date.now() - start;
    const bodyText = await res.text();

    console.log(`\nHTTP Response Status   : ${res.status} ${res.statusText} (${elapsed}ms)`);
    console.log('Response Content-Type  :', res.headers.get('content-type') || 'unknown');

    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {}

    if (res.ok && parsed && parsed.success !== false) {
      console.log('\n==================================================');
      console.log('✅ LIVE RAILRADAR API AUTHENTICATION SUCCESSFUL!');
      console.log('   `verifyRailRadarConnection()` -> CONNECTED');
      console.log('==================================================\n');
    } else {
      console.log('\n==================================================');
      console.log(`❌ LIVE RAILRADAR API RETURNED HTTP ${res.status}`);
      if (res.status === 401 || res.status === 403) {
        console.log('   DIAGNOSIS: Authentication Failure (Invalid / Unauthorized API Key)');
        console.log('   Server Response :', parsed?.error?.message || bodyText.slice(0, 200));
        console.log('   `verifyRailRadarConnection()` -> NOT_CONNECTED (Fallback to DB)');
      } else {
        console.log('   Server Response :', bodyText.slice(0, 200));
      }
      console.log('==================================================\n');
    }
  } catch (err) {
    console.error('\n❌ Network Connection Error:', err.message);
  }
}

diagnose();
