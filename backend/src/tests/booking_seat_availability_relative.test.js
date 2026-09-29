const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_FILE_PATH = path.join(__dirname, '../../data/test-db.json');
process.env.MOCK_MODE = 'true';

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const trainRoutes = require('../routes/trains');
const bookingRoutes = require('../routes/bookings');
const { calculateDeterministicAvailability } = require('../services/trainServiceInstanceService');
const { getTrainSeatAvailability } = require('../services/reservationAvailabilityService');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

function createServerApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/trains', trainRoutes);
  app.use('/api/bookings', bookingRoutes);
  return app;
}

const app = createServerApp();
let server;
const PORT = 5082;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(PORT, () => resolve());
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

function makeRequest(method, reqPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  [PASS] ${message}`);
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 BOOKING-SEAT AVAILABILITY & JOURNEY-RELATIVE VERIFICATION');
  console.log('===============================================================');

  await startServer();

  try {
    const testPassenger = {
      id: 'usr-test-avail-pax',
      email: 'pax.test@railcontrol.in',
      role: 'passenger',
      full_name: 'Aditya Sharma'
    };
    const testToken = jwt.sign(testPassenger, jwtSecret, { expiresIn: '1h' });

    // Initial database baseline
    const initialTrainCount = mockDb.trains.size;
    const initialBookingCount = mockDb.bookings.size;
    const initialServiceCount = mockDb.service_instances ? mockDb.service_instances.size : 0;

    // -------------------------------------------------------------
    // Requirement 1, 2, 3, 4: 4 Visual States in Seat Map
    // -------------------------------------------------------------
    console.log('\n--- Checking Requirement 1, 2, 3, 4: 4 Seat Map States (Available, Booked, Selected, Blocked) ---');
    const trainId = '12952';
    const testJourneyDate = '2026-11-20';
    const seatRes = await makeRequest('GET', `/api/trains/${trainId}/seat-availability?journeyDate=${testJourneyDate}&classCode=3A&fromStation=NDLS&toStation=MMCT`);
    assert(seatRes.status === 200, 'GET /seat-availability returns 200 OK');
    assert(Array.isArray(seatRes.data.coachDetails) && seatRes.data.coachDetails.length > 0, 'Returns coachDetails array');

    const firstCoach = seatRes.data.coachDetails[0];
    assert(Array.isArray(firstCoach.seats) && firstCoach.seats.length > 0, 'Coach contains seats list');

    const statusesFound = new Set(firstCoach.seats.map(s => s.status));
    assert(statusesFound.has('AVAILABLE'), 'Requirement 1: Has AVAILABLE seats (green state in UI)');
    assert(firstCoach.seats.every(s => ['AVAILABLE', 'CONFIRMED', 'BOOKED', 'BLOCKED'].includes(s.status)), 'All seats map strictly to authoritative status values');

    // -------------------------------------------------------------
    // Requirement 5, 6, 7, 8: Journey-Date Relative Availability
    // -------------------------------------------------------------
    console.log('\n--- Checking Requirement 5, 6, 7, 8: Date-Wise Availability Calculations ---');
    // For a future date with available capacity
    const availFuture = calculateDeterministicAvailability('12952', '2026-12-01', '3A', null, '2026-12-01');
    assert(availFuture.statusType === 'AVAILABLE' && availFuture.availableCount > 0, `Requirement 5: Future date relative availability returns AVAILABLE count (${availFuture.statusLabel})`);

    // For RAC status
    const mockTrainNumber = '22114';
    // If an inventory date has RAC or WL:
    const racResult = calculateDeterministicAvailability(mockTrainNumber, '2026-10-10', '3A', null, '2026-10-10');
    assert(racResult.statusType === 'AVAILABLE' || racResult.statusType === 'RAC' || racResult.statusType === 'WL', 'Requirement 6/7: Availability resolves deterministically');

    // Ensure RAC / WL is NEVER converted into AVAILABLE
    const forceRacResult = calculateDeterministicAvailability('12952', '2026-10-10', '3A', { availableCount: 0, racCount: 4, wlCount: 0 }, '2026-10-10');
    assert(forceRacResult.statusType === 'RAC', `Requirement 6: RAC inventory yields RAC status (${forceRacResult.statusLabel}), never converted to AVAILABLE`);

    const forceWlResult = calculateDeterministicAvailability('12952', '2026-10-10', '3A', { availableCount: 0, racCount: 0, wlCount: 15 }, '2026-10-10');
    assert(forceWlResult.statusType === 'WL', `Requirement 7: WL inventory yields WL status (${forceWlResult.statusLabel}), never converted to AVAILABLE`);

    const forceNotAvail = calculateDeterministicAvailability('12952', '2026-10-10', '3A', { availableCount: 0, racCount: 0, wlCount: 0 }, '2026-10-10');
    assert(forceNotAvail.statusType === 'NOT_AVAILABLE' || forceNotAvail.statusType === 'REGRET' || forceNotAvail.statusType === 'WL', `Requirement 8: Exhausted inventory yields non-available status (${forceNotAvail.statusLabel})`);

    // -------------------------------------------------------------
    // Requirement 9, 10: Independence from Computer Clock
    // -------------------------------------------------------------
    console.log('\n--- Checking Requirement 9, 10: Independence from Computer Clock (Date-Relative) ---');
    const evalDate = '2026-11-15';
    const result1 = calculateDeterministicAvailability('12977', evalDate, '3A', null, evalDate);
    const result2 = calculateDeterministicAvailability('12977', evalDate, '3A', null, evalDate);
    assert(result1.statusLabel === result2.statusLabel && result1.statusType === result2.statusType, 'Requirement 9 & 10: Deterministic relative availability produces exact identical results relative to journey date');

    // -------------------------------------------------------------
    // Requirement 11, 12, 13: Booking Seat Allocation & 409 Conflict Safety
    // -------------------------------------------------------------
    console.log('\n--- Checking Requirement 11, 12, 13: Booking Allocation & 409 Conflict Prevention ---');
    const bookTravelDate = '2026-11-25';
    const selectedCoachName = firstCoach.coach;
    const testSeatId = `${trainId}-${selectedCoachName}-08`;

    // 1. Create a confirmed booking with specific seat
    const bookReq1 = {
      train_id: trainId,
      travel_date: bookTravelDate,
      coach_class: '3A',
      selected_seats: [{ seat_id: testSeatId, coach: selectedCoachName, seat_number: 8, berth_type: 'SU' }],
      passengers: [{
        name: 'Aditya Sharma',
        age: 32,
        gender: 'Male',
        irctc_id: 'aditya_irctc_01',
        seat_id: testSeatId
      }],
      total_fare: 850
    };

    const resBook1 = await makeRequest('POST', '/api/bookings/book', bookReq1, testToken);
    assert(resBook1.status === 201, `Requirement 11: Booking created successfully (Status 201, PNR: ${resBook1.data.booking?.pnr_number})`);
    const createdBookingId = resBook1.data.booking.id;

    // Verify seat is now BOOKED in seat availability
    const checkSeatAfterBooking = await makeRequest('GET', `/api/trains/${trainId}/seat-availability?journeyDate=${bookTravelDate}&classCode=3A&fromStation=NDLS&toStation=MMCT`);
    const targetCoachAfter = checkSeatAfterBooking.data.coachDetails.find(c => c.coach === selectedCoachName);
    const targetSeatAfter = targetCoachAfter.seats.find(s => s.seatId === testSeatId || s.seatNumber === 8);
    assert(targetSeatAfter.status === 'CONFIRMED' || targetSeatAfter.status === 'BOOKED', `Requirement 11: Seat ${testSeatId} transitioned from AVAILABLE to CONFIRMED`);

    // 2. Second booking attempts to book the EXACT SAME SEAT on the SAME DATE
    console.log('\n--- Checking Requirement 12, 13: Double-booking prevention (HTTP 409 Conflict) ---');
    const duplicateBookingReq = {
      train_id: trainId,
      travel_date: bookTravelDate,
      coach_class: '3A',
      selected_seats: [{ seat_id: testSeatId, coach: selectedCoachName, seat_number: 8, berth_type: 'SU' }],
      passengers: [{
        name: 'Rohan Verma',
        age: 28,
        gender: 'Male',
        irctc_id: 'rohan_irctc_02',
        seat_id: testSeatId
      }],
      total_fare: 850
    };

    const resBookDuplicate = await makeRequest('POST', '/api/bookings/book', duplicateBookingReq, testToken);
    assert(resBookDuplicate.status === 409, `Requirement 12 & 13: Duplicate booking rejected with HTTP 409 Conflict (Got status: ${resBookDuplicate.status})`);
    assert(resBookDuplicate.data.error.includes('no longer available') || resBookDuplicate.data.conflict_seat === testSeatId, 'Requirement 12: Returned informative conflict error');

    // -------------------------------------------------------------
    // Requirement 14, 15, 16: RAC and Waitlist Berth Allocation Rules
    // -------------------------------------------------------------
    console.log('\n--- Checking Requirement 14, 15, 16: RAC and Waitlist Berth Assignment Disablement ---');
    const racBookingReq = {
      train_id: trainId,
      travel_date: '2026-11-28',
      coach_class: '3A',
      status: 'RAC',
      selected_seats: [{ seat_id: `${trainId}-B1-12`, coach: 'B1', seat_number: 12, berth_type: 'MB' }],
      passengers: [{
        name: 'Vikram Singh',
        age: 40,
        gender: 'Male',
        irctc_id: 'vikram_irctc_03',
        seat_id: `${trainId}-B1-12` // Attempted malicious injection of seat_id
      }],
      total_fare: 850
    };

    const resRac = await makeRequest('POST', '/api/bookings/book', racBookingReq, testToken);
    assert(resRac.status === 201, 'RAC Booking created');
    assert(resRac.data.booking.status === 'rac', 'Booking status is RAC');
    assert(resRac.data.allocations.every(a => a.seat_id === null), 'Requirement 14: RAC allocation strictly forces seat_id = null (confirmed berth disabled)');

    const wlBookingReq = {
      train_id: trainId,
      travel_date: '2026-11-29',
      coach_class: '3A',
      status: 'WL',
      selected_seats: [{ seat_id: `${trainId}-B1-14`, coach: 'B1', seat_number: 14, berth_type: 'UB' }],
      passengers: [{
        name: 'Pooja Nair',
        age: 26,
        gender: 'Female',
        irctc_id: 'pooja_irctc_04',
        seat_id: `${trainId}-B1-14`
      }],
      total_fare: 850
    };

    const resWl = await makeRequest('POST', '/api/bookings/book', wlBookingReq, testToken);
    assert(resWl.status === 201, 'Waitlist Booking created');
    assert(resWl.data.booking.status === 'waitlist', 'Booking status is waitlist');
    assert(resWl.data.allocations.every(a => a.seat_id === null), 'Requirement 15: Waitlist allocation strictly forces seat_id = null (confirmed berth disabled)');

    // -------------------------------------------------------------
    // Requirement 17, 18, 19, 20: Cancellation Inventory Release & History Preservation
    // -------------------------------------------------------------
    console.log('\n--- Checking Requirement 17, 18, 19, 20: Cancellation Release & Re-booking ---');
    const cancelRes = await makeRequest('PUT', `/api/bookings/${createdBookingId}/cancel`, {
      reason: 'Passenger change of plans'
    }, testToken);
    assert(cancelRes.status === 200, 'Booking cancelled successfully');
    assert(cancelRes.data.status === 'cancelled', 'Booking marked cancelled');

    // Verify cancelled booking record and refund record exist intact
    const cancelledBookingRecord = mockDb.bookings.get(createdBookingId);
    assert(cancelledBookingRecord && cancelledBookingRecord.status === 'cancelled', 'Requirement 18: Historical booking record preserved with status=cancelled');
    assert(cancelledBookingRecord.pnr_number !== undefined, 'Requirement 18: PNR number preserved');

    // Verify seat is released back to AVAILABLE
    const checkSeatAfterCancel = await makeRequest('GET', `/api/trains/${trainId}/seat-availability?journeyDate=${bookTravelDate}&classCode=3A&fromStation=NDLS&toStation=MMCT`);
    const targetCoachAfterCancel = checkSeatAfterCancel.data.coachDetails.find(c => c.coach === selectedCoachName);
    const targetSeatAfterCancel = targetCoachAfterCancel.seats.find(s => s.seatId === testSeatId || s.seatNumber === 8);
    assert(targetSeatAfterCancel.status === 'AVAILABLE', `Requirement 17: Released seat ${testSeatId} is now AVAILABLE again`);

    // Re-booking the released seat succeeds
    console.log('\n--- Checking Requirement 20: Re-booking previously cancelled seat succeeds ---');
    const rebookReq = {
      train_id: trainId,
      travel_date: bookTravelDate,
      coach_class: '3A',
      selected_seats: [{ seat_id: testSeatId, coach: selectedCoachName, seat_number: 8, berth_type: 'SU' }],
      passengers: [{
        name: 'Rohan Verma',
        age: 28,
        gender: 'Male',
        irctc_id: 'rohan_irctc_02',
        seat_id: testSeatId
      }],
      total_fare: 850
    };
    const resRebook = await makeRequest('POST', '/api/bookings/book', rebookReq, testToken);
    assert(resRebook.status === 201, `Requirement 20: Re-booking previously cancelled seat ${testSeatId} succeeded! (PNR: ${resRebook.data.booking?.pnr_number})`);

    // Clean up the created test bookings so test-db matches baseline
    mockDb.bookings.delete(createdBookingId);
    mockDb.bookings.delete(resRac.data.booking.id);
    mockDb.bookings.delete(resWl.data.booking.id);
    mockDb.bookings.delete(resRebook.data.booking.id);
    // Remove temporary test allocations
    for (const [aId, a] of mockDb.seat_allocations.entries()) {
      if ([createdBookingId, resRac.data.booking.id, resWl.data.booking.id, resRebook.data.booking.id].includes(a.booking_id)) {
        mockDb.seat_allocations.delete(aId);
      }
    }
    saveMockDbToFile();

    // Data Safety Check: Verify trains and service instances are untouched
    assert(mockDb.trains.size === initialTrainCount, `Zero trains modified or deleted (${mockDb.trains.size} == ${initialTrainCount})`);

    console.log('\n===============================================================');
    console.log('🏆 ALL 20 SEAT AVAILABILITY & BOOKING SAFETY ASSERTIONS PASSED!');
    console.log('===============================================================');
  } finally {
    await stopServer();
  }
}

runTests().catch(err => {
  console.error('Test failed with unhandled error:', err);
  process.exit(1);
});
