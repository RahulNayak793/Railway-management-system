const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Environment setup for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '5119';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

const jwt = require('jsonwebtoken');
const app = require('../index');
let server;

function makeRequest(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5119,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const json = resBody ? JSON.parse(resBody) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: resBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Starting Staff Daily Reports & Admin Review Verification...');
  
  await new Promise(resolve => {
    server = app.listen(5119, () => {
      console.log('  Server started on port 5119');
      resolve();
    });
  });

  try {
    const { mockDb } = require('../config/supabase');
    mockDb.staff_permissions.set('usr-staff-mahesh', ['SUBMIT_DAILY_REPORT', 'ALL']);

    const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
    const adminToken = jwt.sign({ id: 'usr-admin-1', role: 'admin', email: 'admin@railway.gov.in', full_name: 'System Administrator' }, jwtSecret, { expiresIn: '1h' });
    const staffToken = jwt.sign({ id: 'usr-staff-mahesh', role: 'staff', email: 'mahesh@railway.gov.in', full_name: 'mahesh', permissions: ['SUBMIT_DAILY_REPORT', 'ALL'] }, jwtSecret, { expiresIn: '1h' });
    console.log('  ✅ Admin & Staff test tokens created');

    // 3. Staff mahesh submits daily report
    const reportData = {
      report_date: '2026-09-16',
      shift: 'Morning Shift (06:00 - 14:00)',
      assigned_train: '12951 - Rajdhani Express',
      assigned_station: 'NDLS',
      assigned_tasks_completed: '4',
      tickets_verified: '95',
      passenger_requests_handled: '12',
      incidents_handled: '1',
      catering_orders_handled: '15',
      summary: 'Summary of website management tasks completed during your shift...',
      remarks: 'Any additional remarks...',
      declaration_confirmed: true
    };

    const submitRes = await makeRequest('POST', '/api/staff/daily-reports', reportData, staffToken);
    assert.strictEqual(submitRes.status, 201, 'Submit daily report failed');
    assert.ok(submitRes.body.id, 'Report ID missing');
    assert.strictEqual(submitRes.body.tickets_verified, 95, 'Tickets verified metric mismatch');
    assert.strictEqual(submitRes.body.catering_orders_handled, 15, 'Catering orders metric mismatch');
    const createdReportId = submitRes.body.id;
    console.log(`  ✅ Daily report submitted successfully by mahesh (ID: ${createdReportId})`);

    // 4. Admin fetches daily reports
    const getReportsRes = await makeRequest('GET', '/api/staff/daily-reports', null, adminToken);
    assert.strictEqual(getReportsRes.status, 200, 'Admin get daily reports failed');
    const foundReport = getReportsRes.body.find(r => r.id === createdReportId);
    assert.ok(foundReport, 'Submitted report not found in admin list!');
    console.log('  ✅ Submitted report visible in Admin GET /api/staff/daily-reports');

    // 5. Admin reviews daily report
    const reviewRes = await makeRequest('POST', `/api/staff/admin-reports/${createdReportId}/review`, {
      status: 'REVIEWED',
      admin_remarks: 'Verified tickets log & catering entries. Approved by Admin.'
    }, adminToken);
    assert.strictEqual(reviewRes.status, 200, 'Admin review failed');
    assert.strictEqual(reviewRes.body.report.status, 'REVIEWED');
    console.log('  ✅ Admin successfully reviewed and approved Mahesh daily report');

    // 6. Admin roster summary reflects pending/reviewed counts
    const rosterRes = await makeRequest('GET', '/api/staff/admin-roster', null, adminToken);
    assert.strictEqual(rosterRes.status, 200, 'Admin roster query failed');
    assert.ok(rosterRes.body.summary, 'Summary object missing');
    console.log('  ✅ Admin roster summary returned correctly');

    console.log('\n🎉 ALL STAFF DAILY REPORT VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

runTest();
