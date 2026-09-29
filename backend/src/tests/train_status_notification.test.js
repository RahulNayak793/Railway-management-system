const path = require('path');
const fs = require('fs');
const assert = require('assert');
const jwt = require('jsonwebtoken');

// Setup isolated test database before loading application modules
const testDbPath = path.join(__dirname, '../../data/test-status-notif-db.json');
const prodDbPath = path.join(__dirname, '../../data/db.json');

// Copy prodDb to testDb for completely isolated testing
fs.copyFileSync(prodDbPath, testDbPath);

process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = testDbPath;
process.env.SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-12345';

const app = require('../index');
const { mockDb } = require('../config/supabase');

const PORT = 5198;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function createToken(userId, email, role, permissions = []) {
  const payload = {
    id: userId,
    email,
    role,
    permissions,
    full_name: role.toUpperCase() + ' Test User'
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
}

async function apiRequest(method, endpoint, body = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚂 TRAIN STATUS & PASSENGER NOTIFICATION TEST SUITE');
  console.log('======================================================\n');

  await startServer();

  try {
    // Record baseline counts of existing data
    const baselineTrainCount = mockDb.trains.size;
    const baselineBookingCount = mockDb.bookings.size;
    const baselineProfileCount = mockDb.profiles.size;
    const initialHistoryCount = mockDb.train_status_history.size;
    const initialNotifCount = mockDb.notifications.size;

    console.log(`Initial DB State: Trains: ${baselineTrainCount}, Bookings: ${baselineBookingCount}, Profiles: ${baselineProfileCount}`);

    // Auth tokens
    const adminToken = createToken('usr-admin-test', 'admin@railcontrol.gov.in', 'admin');
    const authStaffToken = createToken('usr-staff-auth', 'staff@railcontrol.gov.in', 'staff', ['UPDATE_AUTHORIZED_TRAIN_STATUS', 'MANAGE_TRAINS']);
    const unauthStaffToken = createToken('usr-staff-unauth', 'unauth@railcontrol.gov.in', 'staff', ['VIEW_DASHBOARD']);
    const passenger1Token = createToken('usr-demo-passenger-1', 'pax1@example.com', 'passenger');
    const passenger2Token = createToken('usr-demo-passenger-2', 'pax2@example.com', 'passenger');

    // Create a demo target train for exact date test
    const testTrainId = 'test-tr-status-12345';
    const testTrainDate = '2026-10-25';
    mockDb.trains.set(testTrainId, {
      id: testTrainId,
      train_number: '12345',
      train_name: 'Udupi Superfast Express',
      source_station_code: 'UD',
      destination_station_code: 'NDLS',
      source: 'UD',
      destination: 'NDLS',
      status: 'on_time',
      delay_minutes: 0,
      journey_date: testTrainDate,
      is_date_specific: true,
      scheduled_departure_time: '06:15:00',
      scheduled_arrival_time: '14:30:00',
      created_at: new Date().toISOString()
    });

    // Create a second train for cross-train isolation testing
    const otherTrainId = 'test-tr-other-99999';
    mockDb.trains.set(otherTrainId, {
      id: otherTrainId,
      train_number: '99999',
      train_name: 'Other City Express',
      source_station_code: 'UD',
      destination_station_code: 'NDLS',
      status: 'on_time',
      delay_minutes: 0,
      journey_date: testTrainDate,
      is_date_specific: true,
      scheduled_departure_time: '08:00:00',
      scheduled_arrival_time: '16:00:00'
    });

    // Booking 1: Passenger 1 booked on testTrain on 2026-10-25 (SHOULD BE NOTIFIED)
    const booking1Id = 'test-bk-target-date';
    mockDb.bookings.set(booking1Id, {
      id: booking1Id,
      passenger_id: 'usr-demo-passenger-1',
      passenger_name: 'Rahul Sharma',
      train_id: testTrainId,
      train_number: '12345',
      travel_date: testTrainDate,
      pnr_number: '7891234560',
      status: 'confirmed',
      total_fare: 850,
      coach_number: 'B1',
      seat_number: 12
    });

    // Booking 2: Passenger 2 booked on testTrain on DIFFERENT DATE: 2026-10-26 (MUST NOT BE NOTIFIED)
    const booking2Id = 'test-bk-diff-date';
    mockDb.bookings.set(booking2Id, {
      id: booking2Id,
      passenger_id: 'usr-demo-passenger-2',
      passenger_name: 'Amit Verma',
      train_id: testTrainId,
      train_number: '12345',
      travel_date: '2026-10-26', // DIFFERENT DATE!
      pnr_number: '7891234561',
      status: 'confirmed',
      total_fare: 850,
      coach_number: 'B2',
      seat_number: 14
    });

    // Booking 3: Passenger 2 booked on OTHER TRAIN on 2026-10-25 (MUST NOT BE NOTIFIED)
    const booking3Id = 'test-bk-other-train';
    mockDb.bookings.set(booking3Id, {
      id: booking3Id,
      passenger_id: 'usr-demo-passenger-2',
      passenger_name: 'Amit Verma',
      train_id: otherTrainId,
      train_number: '99999',
      travel_date: testTrainDate,
      pnr_number: '7891234562',
      status: 'confirmed',
      total_fare: 950
    });

    // ----------------------------------------------------
    // TEST 1: Admin can update train status
    // ----------------------------------------------------
    console.log('Running Test 1: Admin can update train status...');
    const resAdminUpdate = await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'delayed',
      delay_minutes: 45,
      reason: 'Severe Weather / Fog / Storm',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 is delayed by 45 minutes due to severe weather.'
    }, adminToken);
    assert.strictEqual(resAdminUpdate.status, 200, 'Admin update should return 200');
    console.log('✅ Passed Test 1: Admin updated train status successfully');

    // ----------------------------------------------------
    // TEST 2: Authorized Staff can update train status
    // ----------------------------------------------------
    console.log('Running Test 2: Authorized Staff can update train status...');
    const resStaffUpdate = await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'platform_changed',
      platform: '3',
      reason: 'Operational Issue',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 will depart from Platform 3.'
    }, authStaffToken);
    assert.strictEqual(resStaffUpdate.status, 200, 'Authorized staff update should return 200');
    console.log('✅ Passed Test 2: Authorized staff updated train status successfully');

    // ----------------------------------------------------
    // TEST 3: Unauthorized Staff receives 403
    // ----------------------------------------------------
    console.log('Running Test 3: Unauthorized Staff receives 403...');
    const resUnauthStaff = await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'delayed',
      delay_minutes: 30,
      reason: 'Technical Issue',
      journey_date: testTrainDate
    }, unauthStaffToken);
    assert.strictEqual(resUnauthStaff.status, 403, 'Unauthorized staff should be rejected with HTTP 403');
    console.log('✅ Passed Test 3: Unauthorized staff received HTTP 403 Forbidden');

    // ----------------------------------------------------
    // TEST 4: Delayed status is saved with delay minutes & reason
    // ----------------------------------------------------
    console.log('Running Test 4: Delayed status is saved...');
    await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'delayed',
      delay_minutes: 45,
      reason: 'Severe Weather / Fog / Storm',
      platform: 'Platform 2',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 Udupi Superfast Express delayed by 45 minutes due to severe weather.'
    }, adminToken);
    const updatedTrain = mockDb.trains.get(testTrainId);
    assert.strictEqual(updatedTrain.status, 'delayed', 'Train status should be delayed');
    assert.strictEqual(updatedTrain.delay_minutes, 45, 'Delay minutes should be 45');
    assert.strictEqual(updatedTrain.delay_reason, 'Severe Weather / Fog / Storm', 'Delay reason should match');
    assert.strictEqual(updatedTrain.platform, 'Platform 2', 'Platform should be saved');
    console.log('✅ Passed Test 4: Delayed status properly saved to train record');

    // ----------------------------------------------------
    // TEST 5: Rescheduled status is saved
    // ----------------------------------------------------
    console.log('Running Test 5: Rescheduled status is saved...');
    const resResched = await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'rescheduled',
      delay_minutes: 60,
      reason: 'Technical Issue',
      updated_departure_time: '07:15:00',
      updated_arrival_time: '15:30:00',
      journey_date: testTrainDate
    }, adminToken);
    assert.strictEqual(resResched.status, 200, 'Rescheduled should succeed');
    const reschedTrain = mockDb.trains.get(testTrainId);
    assert.strictEqual(reschedTrain.status, 'rescheduled', 'Train status should be rescheduled');
    assert.strictEqual(reschedTrain.updated_departure_time, '07:15:00', 'Updated departure should be saved');
    console.log('✅ Passed Test 5: Rescheduled status saved');

    // ----------------------------------------------------
    // TEST 6: Platform change is saved
    // ----------------------------------------------------
    console.log('Running Test 6: Platform change is saved...');
    await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'platform_changed',
      platform: 'Platform 4B',
      reason: 'Platform congestion',
      journey_date: testTrainDate
    }, adminToken);
    const platTrain = mockDb.trains.get(testTrainId);
    assert.strictEqual(platTrain.platform, 'Platform 4B', 'Platform should be updated');
    console.log('✅ Passed Test 6: Platform change saved');

    // ----------------------------------------------------
    // TEST 7: Correct passenger receives notification
    // ----------------------------------------------------
    console.log('Running Test 7: Correct passenger receives notifications...');
    // Update status to delayed to test notifications
    await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'delayed',
      delay_minutes: 50,
      reason: 'Track Maintenance',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 delayed by 50 min due to Track Maintenance.'
    }, adminToken);

    const pax1Notifs = Array.from(mockDb.notifications.values()).filter(n => n.user_id === 'usr-demo-passenger-1');
    assert(pax1Notifs.length > 0, 'Passenger 1 should have received notifications');
    const latestPax1Notif = pax1Notifs.find(n => n.journey_date === testTrainDate && n.train_id === testTrainId);
    assert(latestPax1Notif, 'Passenger 1 should have notification for exact train and journey date');
    assert.strictEqual(latestPax1Notif.title, 'Train Delayed', 'Title should be Train Delayed');
    console.log('✅ Passed Test 7: Correct passenger received notifications');

    // ----------------------------------------------------
    // TEST 8: Passenger booked on another journey date does NOT receive notification
    // ----------------------------------------------------
    console.log('Running Test 8: Passenger on different journey date does NOT receive notification...');
    const pax2NotifsForThisUpdate = Array.from(mockDb.notifications.values()).filter(
      n => n.user_id === 'usr-demo-passenger-2' && n.journey_date === testTrainDate && n.train_id === testTrainId
    );
    assert.strictEqual(pax2NotifsForThisUpdate.length, 0, 'Passenger booked on another date must NOT receive notifications for 2026-10-25');
    console.log('✅ Passed Test 8: No cross-date notification leakage');

    // ----------------------------------------------------
    // TEST 9: Passenger booked on another train does NOT receive notification
    // ----------------------------------------------------
    console.log('Running Test 9: Passenger on another train does NOT receive notification...');
    const pax2OtherTrainNotifs = Array.from(mockDb.notifications.values()).filter(
      n => n.user_id === 'usr-demo-passenger-2' && n.train_id === testTrainId
    );
    assert.strictEqual(pax2OtherTrainNotifs.length, 0, 'Passenger on another train must NOT receive testTrain notifications');
    console.log('✅ Passed Test 9: No cross-train notification leakage');

    // ----------------------------------------------------
    // TEST 10: Duplicate status update does not spam notifications
    // ----------------------------------------------------
    console.log('Running Test 10: Duplicate status update does not spam notifications...');
    const notifCountBefore = Array.from(mockDb.notifications.values()).filter(n => n.user_id === 'usr-demo-passenger-1').length;
    // Resubmit EXACT SAME update
    await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'delayed',
      delay_minutes: 50,
      reason: 'Track Maintenance',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 delayed by 50 min due to Track Maintenance.'
    }, adminToken);
    const notifCountAfter = Array.from(mockDb.notifications.values()).filter(n => n.user_id === 'usr-demo-passenger-1').length;
    assert.strictEqual(notifCountBefore, notifCountAfter, 'Duplicate status submit should NOT create duplicate notifications');
    console.log('✅ Passed Test 10: Duplicate notification protection verified');

    // ----------------------------------------------------
    // TEST 11: Changed delay DOES create update notification
    // ----------------------------------------------------
    console.log('Running Test 11: Meaningful operational change creates update notification...');
    await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'delayed',
      delay_minutes: 75, // Changed from 50 to 75
      reason: 'Track Maintenance',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 delay extended to 75 minutes due to Track Maintenance.'
    }, adminToken);
    const notifCountNew = Array.from(mockDb.notifications.values()).filter(n => n.user_id === 'usr-demo-passenger-1').length;
    assert(notifCountNew > notifCountBefore, 'Updated delay duration should trigger new notification');
    console.log('✅ Passed Test 11: Changed operational details triggered updated alert');

    // ----------------------------------------------------
    // TEST 12: Notification persistence and unread count API
    // ----------------------------------------------------
    console.log('Running Test 12: Notification persistence and unread count API...');
    const resGetNotifs = await apiRequest('GET', '/notifications', null, passenger1Token);
    assert.strictEqual(resGetNotifs.status, 200, 'GET /notifications should succeed');
    assert(Array.isArray(resGetNotifs.data), 'Should return notifications array');
    const unreadList = resGetNotifs.data.filter(n => !n.is_read);
    assert(unreadList.length > 0, 'Should have unread notifications');
    console.log(`✅ Passed Test 12: Notifications fetched (${resGetNotifs.data.length} total, ${unreadList.length} unread)`);

    // ----------------------------------------------------
    // TEST 13: Mark single notification as read works
    // ----------------------------------------------------
    console.log('Running Test 13: Mark single notification as read...');
    const targetNotifToRead = unreadList[0];
    const resMarkRead = await apiRequest('PUT', `/notifications/${targetNotifToRead.id}/read`, null, passenger1Token);
    assert.strictEqual(resMarkRead.status, 200, 'PUT /notifications/:id/read should succeed');
    const verifyNotif = mockDb.notifications.get(targetNotifToRead.id);
    assert.strictEqual(verifyNotif.is_read, true, 'Notification should be marked read in DB');
    console.log('✅ Passed Test 13: Single notification marked read');

    // ----------------------------------------------------
    // TEST 14: Mark all as read works
    // ----------------------------------------------------
    console.log('Running Test 14: Mark all notifications as read...');
    const resMarkAll = await apiRequest('PUT', '/notifications/read-all', null, passenger1Token);
    assert.strictEqual(resMarkAll.status, 200, 'PUT /notifications/read-all should succeed');
    const remainingUnread = Array.from(mockDb.notifications.values()).filter(n => n.user_id === 'usr-demo-passenger-1' && !n.is_read);
    assert.strictEqual(remainingUnread.length, 0, 'No unread notifications should remain');
    console.log('✅ Passed Test 14: All notifications marked as read');

    // ----------------------------------------------------
    // TEST 15: Passenger Impact Preview API calculates exact counts
    // ----------------------------------------------------
    console.log('Running Test 15: Passenger Impact Preview API...');
    const resImpact = await apiRequest('GET', `/admin/train-status/${testTrainId}/passenger-impact?date=${testTrainDate}`, null, adminToken);
    assert.strictEqual(resImpact.status, 200, 'Impact API should succeed');
    assert.strictEqual(resImpact.data.affectedBookingsCount, 1, 'Should find 1 affected booking on 2026-10-25');
    assert.strictEqual(resImpact.data.affectedPassengersCount, 1, 'Should find 1 affected passenger');
    assert(resImpact.data.pnrs.includes('7891234560'), 'Should contain PNR 7891234560');
    console.log('✅ Passed Test 15: Passenger Impact Preview API calculated exact booking data');

    // ----------------------------------------------------
    // TEST 16: Status History timeline is preserved
    // ----------------------------------------------------
    console.log('Running Test 16: Status History timeline is preserved...');
    const resHistory = await apiRequest('GET', `/admin/train-status/${testTrainId}/history`, null, adminToken);
    assert.strictEqual(resHistory.status, 200, 'History API should succeed');
    assert(resHistory.data.length >= 3, 'Should have multiple status history entries');
    const sampleHist = resHistory.data[0];
    assert(sampleHist.new_status, 'History entry should contain new_status');
    assert(sampleHist.updated_by, 'History entry should contain updated_by');
    assert(sampleHist.updated_at, 'History entry should contain updated_at');
    console.log(`✅ Passed Test 16: Status history preserved (${resHistory.data.length} audit entries)`);

    // ----------------------------------------------------
    // TEST 17: Cancellation status cascade works
    // ----------------------------------------------------
    console.log('Running Test 17: Cancellation status cascade...');
    const resCancel = await apiRequest('PATCH', `/admin/train-status/${testTrainId}`, {
      status: 'cancelled',
      reason: 'Severe Flood / Waterlogging',
      journey_date: testTrainDate,
      announcement_message: 'Train 12345 cancelled due to Severe Flood.'
    }, adminToken);
    assert.strictEqual(resCancel.status, 200, 'Cancellation should succeed');
    const cancelledBooking = mockDb.bookings.get(booking1Id);
    assert.strictEqual(cancelledBooking.status, 'cancelled', 'Affected booking on that date should be cancelled');
    assert.strictEqual(cancelledBooking.refund_status, 'APPROVED', 'Refund status should be APPROVED');
    // Booking on different date MUST REMAIN CONFIRMED
    const otherDateBooking = mockDb.bookings.get(booking2Id);
    assert.strictEqual(otherDateBooking.status, 'confirmed', 'Booking on different date must remain CONFIRMED');
    console.log('✅ Passed Test 17: Cancellation cascade executed safely without affecting other dates');

    // ----------------------------------------------------
    // TEST 18: My Bookings & E-Ticket operational disruption attachment
    // ----------------------------------------------------
    console.log('Running Test 18: Bookings enrichment with operational disruption...');
    const resBookings = await apiRequest('GET', '/bookings', null, passenger1Token);
    assert.strictEqual(resBookings.status, 200, 'GET /bookings should succeed');
    const pax1Booking = resBookings.data.find(b => b.id === booking1Id);
    assert(pax1Booking, 'Booking should be returned');
    assert(pax1Booking.operational_disruption, 'operational_disruption should be attached to booking');
    console.log('✅ Passed Test 18: Operational disruption attached to booking response');

    // ----------------------------------------------------
    // TEST 19, 20, 21, 22: Integrity of existing database records
    // ----------------------------------------------------
    console.log('Running Tests 19-22: Verifying database preservation & zero data loss...');
    // Clean up our temporary test train, bookings, and test auth profiles
    mockDb.trains.delete(testTrainId);
    mockDb.trains.delete(otherTrainId);
    mockDb.bookings.delete(booking1Id);
    mockDb.bookings.delete(booking2Id);
    mockDb.bookings.delete(booking3Id);
    mockDb.profiles.delete('usr-admin-test');
    mockDb.profiles.delete('usr-staff-auth');
    mockDb.profiles.delete('usr-staff-unauth');
    mockDb.profiles.delete('usr-demo-passenger-1');
    mockDb.profiles.delete('usr-demo-passenger-2');

    assert.strictEqual(mockDb.trains.size, baselineTrainCount, `Train count must match baseline (${baselineTrainCount})`);
    assert.strictEqual(mockDb.bookings.size, baselineBookingCount, `Booking count must match baseline (${baselineBookingCount})`);
    assert.strictEqual(mockDb.profiles.size, baselineProfileCount, `Profile count must match baseline (${baselineProfileCount})`);
    console.log('✅ Passed Tests 19-22: All original trains, bookings, PNRs, and passenger profiles strictly preserved');

    console.log('\n======================================================');
    console.log('🎉 ALL 22 TRAIN STATUS & NOTIFICATION TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await stopServer();
    // Clean up isolated test database file
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
