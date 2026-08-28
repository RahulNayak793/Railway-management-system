const express = require('express');
const router = express.Router();
const { supabase, isMockMode, mockDb, saveMockDbToFile, resolvePassengerNameForBooking } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { sendEmail } = require('../config/nodemailer');
const { sendSMS } = require('../config/twilio');
const { matchRouteSegment } = require('../utils/routeSearch');
const { calculateSegmentFare } = require('../utils/fareCalculator');

// Generate 10-digit PNR
const generatePNR = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Helper to calculate exact destination arrival date and time for a booking
function calculateDestinationArrivalDateTime(booking, train, route) {
  if (booking.destination_arrival_date_time) {
    const p = new Date(booking.destination_arrival_date_time);
    if (!isNaN(p.getTime())) return p;
  }

  const travelDateStr = booking.travel_date;
  if (!travelDateStr) return new Date();

  const departureTimeStr = route?.departure_time || train?.departure_time || booking.departure_time || '16:30';
  const arrivalTimeStr = route?.arrival_time || train?.arrival_time || booking.arrival_time || '08:15';

  const parseMins = (tStr) => {
    if (!tStr) return 0;
    const clean = String(tStr).trim().split(' ')[0];
    const parts = clean.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const depMins = parseMins(departureTimeStr);
  const arrMins = parseMins(arrivalTimeStr);

  const travelDateObj = new Date(travelDateStr + 'T00:00:00');
  if (arrMins < depMins) {
    travelDateObj.setDate(travelDateObj.getDate() + 1);
  }

  const year = travelDateObj.getFullYear();
  const month = String(travelDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(travelDateObj.getDate()).padStart(2, '0');

  const cleanArrTime = String(arrivalTimeStr).trim().split(' ')[0];
  const formattedArrTime = cleanArrTime.length === 5 ? `${cleanArrTime}:00` : cleanArrTime;

  return new Date(`${year}-${month}-${day}T${formattedArrTime}`);
}

// Compute authoritative booking status
function computeBookingStatus(booking, train, route, currentDateTime = new Date()) {
  const normStatus = String(booking.status || '').toLowerCase();

  // 1. Cancelled bookings stay CANCELLED permanently
  if (normStatus === 'cancelled') {
    return 'cancelled';
  }

  // 2. Determine completion using destination arrival date & time
  const arrivalDateTime = calculateDestinationArrivalDateTime(booking, train, route);
  if (currentDateTime.getTime() >= arrivalDateTime.getTime()) {
    return 'completed';
  }

  return normStatus === 'completed' ? 'completed' : (booking.status || 'confirmed');
}

// Check booking history for logged-in user
router.get('/', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const passengerEmail = req.user.email;
  const { role } = req.user;

  if (isMockMode || (passengerId && String(passengerId).startsWith('usr-'))) {
    let bookingsList = Array.from(mockDb.bookings.values());

    // Strict filtering: Passenger receives ONLY their own bookings
    if (role === 'passenger') {
      bookingsList = bookingsList.filter(b => b.passenger_id === passengerId);
    }

    let stateUpdated = false;

    // Attach train, route, allocations and compute authoritative status
    const enrichedBookings = bookingsList.map(b => {
      const train = mockDb.trains.get(b.train_id);
      const route = Array.from(mockDb.routes.values()).find(r => r.train_id === b.train_id);
      const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === b.id);
      const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === b.id);
      
      const arrivalDateTime = calculateDestinationArrivalDateTime(b, train, route);
      const computedStatus = computeBookingStatus(b, train, route);

      // Persist status transition to COMPLETED when destination arrival time has passed
      if (b.status !== 'cancelled' && computedStatus === 'completed' && b.status !== 'completed') {
        b.status = 'completed';
        b.completed_at = arrivalDateTime.toISOString();
        mockDb.bookings.set(b.id, b);
        stateUpdated = true;
      }

      return {
        ...b,
        status: computedStatus,
        destination_arrival_date_time: arrivalDateTime.toISOString(),
        train: train || (b.train_name || b.train_number ? {
          train_name: b.train_name,
          train_number: b.train_number,
          source: b.source || b.source_station_code || '',
          destination: b.destination || b.destination_station_code || ''
        } : null),
        route,
        allocations,
        payment
      };
    });

    if (stateUpdated) {
      saveMockDbToFile();
    }

    return res.json(enrichedBookings);
  } else {
    try {
      let query = supabase.from('bookings').select(`
        *,
        train:trains(*),
        allocations:seat_allocations(*),
        payments:payments(*)
      `);

      if (role === 'passenger') {
        query = query.eq('passenger_id', passengerId);
      } else if (role === 'staff') {
        const today = new Date().toISOString().split('T')[0];
        query = query.neq('status', 'cancelled').gte('travel_date', today);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enrichedData = data.map(b => {
        const payment = b.payments && b.payments.length > 0 ? b.payments[0] : null;
        const creq = mockDb.cancellation_requests.get(b.id);
        const arrivalDateTime = calculateDestinationArrivalDateTime(b, b.train, null);
        const computedStatus = computeBookingStatus(b, b.train, null);

        return {
          ...b,
          status: computedStatus,
          destination_arrival_date_time: arrivalDateTime.toISOString(),
          payment,
          cancellation_pending: creq && creq.status === 'pending' ? true : false
        };
      });
      return res.json(enrichedData);
    } catch (err) {
      console.error('Supabase DB error fetching bookings:', err.message);
      return res.status(500).json({ error: 'Database error fetching bookings: ' + err.message });
    }
  }
});

// Optional authentication middleware for PNR lookup
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    let decoded;
    if (token.startsWith('mock-base64-')) {
      try {
        const payloadStr = Buffer.from(token.replace('mock-base64-', ''), 'base64').toString('utf8');
        decoded = JSON.parse(payloadStr);
      } catch (e) {
        decoded = null;
      }
    } else if (token.startsWith('mock-client-jwt-token-') || token === 'mock-token') {
      decoded = {
        id: 'usr-demo-passenger',
        email: 'passenger@railway.com',
        role: 'passenger',
        full_name: 'DEMO PASSENGER'
      };
    } else {
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (verifyErr) {
        decoded = jwt.decode(token);
      }
    }

    if (decoded) {
      req.user = decoded;
    }
  } catch (error) {
    // Suppress token errors to allow unauthenticated searches
  }
  next();
};

// PNR Status Query (No Authentication Required, Optional Auth for Privacy)
router.get('/pnr/:pnr', optionalAuthenticateToken, async (req, res) => {
  const { pnr } = req.params;

  if (isMockMode) {
    const booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === pnr);
    if (!booking) return res.status(404).json({ error: 'PNR not found' });

    const train = mockDb.trains.get(booking.train_id);
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === booking.id);
    const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === booking.id);

    let status = booking.status;
    const creq = mockDb.cancellation_requests.get(booking.id);
    if (creq && creq.status === 'pending') {
      status = 'cancel_requested';
    }

    // Authorization check
    const isAuthorized = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'staff' ||
      req.user.id === booking.passenger_id ||
      (booking.passenger_id && String(booking.passenger_id).startsWith('usr-') && String(req.user.id).startsWith('usr-'))
    );

    if (isAuthorized) {
      return res.json({
        ...booking,
        status,
        train,
        allocations,
        payment
      });
    } else {
      // Sanitize details for public lookup
      return res.json({
        pnr_number: booking.pnr_number,
        travel_date: booking.travel_date,
        booking_date: booking.booking_date,
        status,
        train: train ? {
          train_name: train.train_name,
          train_number: train.train_number,
          source: train.source,
          destination: train.destination
        } : null,
        allocations: allocations.map(a => ({
          id: a.id,
          passenger_name: a.passenger_name,
          seat_id: a.seat_id,
          berth_type: a.berth_type,
          coach_number: a.coach_number,
          seat_number: a.seat_number
        }))
      });
    }
  } else {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          train:trains(*),
          allocations:seat_allocations(*),
          payments:payments(*)
        `)
        .eq('pnr_number', pnr)
        .single();

      if (error) {
        console.error('Supabase DB error finding booking:', error.message);
        return res.status(error.code === 'PGRST116' ? 404 : 500).json({ 
          error: error.code === 'PGRST116' ? 'PNR not found' : 'Database error finding booking: ' + error.message 
        });
      }

      let status = data.status;
      const creq = mockDb.cancellation_requests.get(data.id);
      if (creq && creq.status === 'pending') {
        status = 'cancel_requested';
      }

      const payment = data.payments && data.payments.length > 0 ? data.payments[0] : null;

      // Authorization check
      const isAuthorized = req.user && (
        req.user.role === 'admin' ||
        req.user.role === 'staff' ||
        req.user.id === data.passenger_id ||
        (data.passenger_id && String(data.passenger_id).startsWith('usr-') && String(req.user.id).startsWith('usr-'))
      );

      if (isAuthorized) {
        return res.json({ ...data, status, payment });
      } else {
        // Sanitize details for public lookup
        return res.json({
          pnr_number: data.pnr_number,
          travel_date: data.travel_date,
          booking_date: data.booking_date,
          status,
          train: data.train ? {
            train_name: data.train.train_name,
            train_number: data.train.train_number,
            source: data.train.source,
            destination: data.train.destination
          } : null,
          allocations: (data.allocations || []).map(a => ({
            id: a.id,
            passenger_name: a.passenger_name,
            seat_id: a.seat_id,
            berth_type: a.berth_type,
            coach_number: a.coach_number,
            seat_number: a.seat_number
          }))
        });
      }
    } catch (err) {
      console.error('Database error finding booking:', err.message);
      return res.status(500).json({ error: 'Database error finding booking: ' + err.message });
    }
  }
});

// Book Ticket (Atomic Transaction and Idempotency Key Enforced)
router.post('/book', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const { train_id, travel_date, coach_class, passengers, total_fare } = req.body;
  const idempotencyKey = req.body.idempotency_key || req.headers['idempotency-key'] || require('crypto').randomUUID();

  if (!train_id || !travel_date || !coach_class || !passengers || passengers.length === 0) {
    return res.status(400).json({ error: 'Missing booking details' });
  }

  const pnr = generatePNR();

  if (isMockMode) {
    // Check mock idempotency key
    const existingMockBooking = Array.from(mockDb.bookings.values()).find(
      b => b.idempotency_key === idempotencyKey
    );

    if (existingMockBooking) {
      // A. Ownership check
      if (existingMockBooking.passenger_id !== passengerId) {
        return res.status(403).json({ error: 'Access denied: Idempotency key belongs to another user.' });
      }

      // B. Consistency check
      const allocatedSeats = Array.from(mockDb.seat_allocations.values()).filter(
        a => a.booking_id === existingMockBooking.id
      );

      const existingNames = allocatedSeats.map(a => a.passenger_name).sort().join(',');
      const requestedNames = passengers.map(p => p.full_name || p.name).sort().join(',');

      if (
        existingMockBooking.train_id !== train_id ||
        existingMockBooking.travel_date !== travel_date ||
        allocatedSeats.length !== passengers.length ||
        existingNames !== requestedNames
      ) {
        return res.status(409).json({ error: 'Idempotency conflict: Key already used for different booking parameters.' });
      }

      console.log(`ℹ️ Booking retrieved from Mock Idempotency store for key: ${idempotencyKey}`);
      return res.status(201).json({
        message: 'Booking retrieved successfully (Idempotent)',
        booking: existingMockBooking,
        allocations: allocatedSeats
      });
    }

    let train = mockDb.trains.get(train_id);
    if (!train) {
      train = {
        id: train_id,
        train_number: '23456',
        train_name: 'Express Special',
        source: 'NDLS',
        destination: 'MMCT',
        total_seats: 120,
        status: 'on_time'
      };
      mockDb.trains.set(train_id, train);
    }

    // 1. Check seat availability for this train & coach class
    let seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === train_id && s.coach_class === coach_class
    );

    if (seats.length === 0) {
      const coachNum = coach_class === 'SL' ? 'S1' : coach_class === '3A' ? 'B1' : coach_class === '2A' ? 'A1' : 'H1';
      seats = Array.from({ length: 24 }).map((_, idx) => {
        const seatNum = idx + 1;
        const berthType = seatNum % 6 === 1 || seatNum % 6 === 2 ? 'LB' : seatNum % 6 === 3 || seatNum % 6 === 4 ? 'MB' : 'UB';
        const sId = `${train_id}-${coachNum}-${seatNum}`;
        const newSeat = {
          id: sId,
          train_id,
          coach_class,
          coach_number: coachNum,
          seat_number: seatNum,
          berth_type: berthType
        };
        mockDb.seats.set(sId, newSeat);
        return newSeat;
      });
    }

    // Filter out seats already booked on active non-cancelled bookings for this travel date
    const activeBookingIds = Array.from(mockDb.bookings.values())
      .filter(b => b.status !== 'cancelled')
      .map(b => b.id);

    const bookedSeatIds = Array.from(mockDb.seat_allocations.values())
      .filter(a => activeBookingIds.includes(a.booking_id) && a.travel_date === travel_date)
      .map(a => a.seat_id);

    const availableSeats = seats.filter(s => !bookedSeatIds.includes(s.id));

    let bookingStatus = 'confirmed';
    let allocatedSeats = [];

    // If passengers count > available seats count
    if (availableSeats.length < passengers.length) {
      // Determine if they fit into RAC (say up to 4 RAC slots per train class)
      // Check existing bookings count for RAC/Waitlist
      const activeBookings = Array.from(mockDb.bookings.values()).filter(
        b => b.train_id === train_id && b.travel_date === travel_date && b.status !== 'cancelled'
      );
      
      const racCount = activeBookings.filter(b => b.status === 'rac').length;

      if (racCount < 4) {
        bookingStatus = 'rac';
      } else {
        bookingStatus = 'waitlist';
      }
    }

    // Calculate authoritative segment fare
    const route = Array.from(mockDb.routes.values()).find(r => r.train_id === train_id);
    let calculatedFare = parseFloat(total_fare || '500');
    if (train && route) {
      const src = req.body.source || route.source_station_code || train.source;
      const dest = req.body.destination || route.destination_station_code || train.destination;
      const segment = matchRouteSegment(train, route, src, dest);
      if (segment) {
        const fareInfo = calculateSegmentFare({ train, route, srcIndex: segment.srcIndex, destIndex: segment.destIndex, nodes: segment.nodes });
        const perPassengerFare = fareInfo.fares_by_class[coach_class] || fareInfo.base_fare;
        calculatedFare = perPassengerFare * passengers.length;
      }
    }

    // Create the booking entry
    const bookingId = 'bk-' + Math.random().toString(36).substr(2, 9);
    const tomorrowDefault = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0];
    const newBooking = {
      id: bookingId,
      passenger_id: passengerId,
      train_id,
      booking_date: new Date().toISOString().split('T')[0],
      travel_date: travel_date || tomorrowDefault,
      pnr_number: pnr,
      status: bookingStatus,
      total_fare: calculatedFare,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString()
    };

    mockDb.bookings.set(bookingId, newBooking);

    // Allocate seats if booking is confirmed
    if (bookingStatus === 'confirmed') {
      passengers.forEach((p, idx) => {
        const seat = availableSeats[idx];
        if (seat) {
          const allocationId = 'al-' + Math.random().toString(36).substr(2, 9);
          const newAlloc = {
            id: allocationId,
            booking_id: bookingId,
            seat_id: seat.id,
            travel_date,
            passenger_name: p.full_name || p.name,
            passenger_age: parseInt(p.age || '30'),
            passenger_gender: p.gender || 'Male'
          };
          mockDb.seat_allocations.set(allocationId, newAlloc);
          allocatedSeats.push({ ...newAlloc, seat });
        }
      });
    } else {
      // RAC/Waitlist allocation without assigned seat numbers (just dummy mapping)
      passengers.forEach((p) => {
        const allocationId = 'al-' + Math.random().toString(36).substr(2, 9);
        const newAlloc = {
          id: allocationId,
          booking_id: bookingId,
          seat_id: null, // No seat until promoted
          travel_date,
          passenger_name: p.full_name || p.name,
          passenger_age: parseInt(p.age),
          passenger_gender: p.gender
        };
        mockDb.seat_allocations.set(allocationId, newAlloc);
        allocatedSeats.push(newAlloc);
      });
    }

    // Trigger Notification
    sendEmail({
      to: req.user.email,
      subject: `Booking Request Initiated - PNR: ${pnr}`,
      text: `Your ticket booking request for ${train.train_name} on ${travel_date} has been created. Status: ${bookingStatus.toUpperCase()}. Please complete payment.`
    });

    return res.status(201).json({
      message: 'Booking created successfully (Mock Mode)',
      booking: newBooking,
      allocations: allocatedSeats
    });
  } else {
    try {
      // 1. Check if the idempotency key already exists in Supabase
      const { data: idRow } = await supabase
        .from('idempotency_keys')
        .select('booking_id')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (idRow) {
        // Fetch the existing booking and allocations
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select(`
            *,
            train:trains(*),
            allocations:seat_allocations(*)
          `)
          .eq('id', idRow.booking_id)
          .single();

        if (existingBooking) {
          // A. Ownership check
          if (existingBooking.passenger_id !== passengerId) {
            return res.status(403).json({ error: 'Access denied: Idempotency key belongs to another user.' });
          }

          // B. Consistency check
          const existingNames = (existingBooking.allocations || []).map(a => a.passenger_name).sort().join(',');
          const requestedNames = passengers.map(p => p.full_name || p.name).sort().join(',');
          const existingSeatsCount = existingBooking.allocations ? existingBooking.allocations.length : 0;

          if (
            existingBooking.train_id !== train_id ||
            existingBooking.travel_date !== travel_date ||
            existingSeatsCount !== passengers.length ||
            existingNames !== requestedNames
          ) {
            return res.status(409).json({ error: 'Idempotency conflict: Key already used for different booking parameters.' });
          }

          // Return the existing booking and allocations
          return res.status(201).json({
            message: 'Booking retrieved successfully (Idempotent)',
            booking: existingBooking,
            allocations: existingBooking.allocations || []
          });
        }
      }

      // Direct Supabase RPC for atomic booking & idempotency checking
      const { data, error } = await supabase.rpc('create_booking_atomic', {
        p_passenger_id: passengerId,
        p_train_id: train_id,
        p_travel_date: travel_date,
        p_coach_class: coach_class,
        p_passengers: passengers,
        p_total_fare: parseFloat(total_fare || '500'),
        p_idempotency_key: idempotencyKey
      });

      if (error) {
        console.error('Supabase atomic booking RPC failed:', error.message);
        // Check for concurrency seat allocation failure (unique key violation)
        if (error.message.includes('unique') || error.code === '23505' || error.message.includes('duplicate')) {
          return res.status(409).json({ error: 'Seat already allocated. Please choose another seat.' });
        }
        return res.status(500).json({ error: 'Database booking failure: ' + error.message });
      }

      // data contains { retrieved_from_idempotency: boolean, booking: {...}, allocations: [...] }
      const { booking, allocations, retrieved_from_idempotency } = data;

      if (retrieved_from_idempotency) {
        console.log(`ℹ️ Booking retrieved from idempotency store for key: ${idempotencyKey}`);
      }

      return res.status(201).json({
        message: retrieved_from_idempotency 
          ? 'Booking retrieved successfully (Idempotent)' 
          : 'Booking created successfully',
        booking,
        allocations
      });
    } catch (err) {
      console.error('Supabase DB error during booking:', err.message);
      return res.status(500).json({ error: 'Database booking failure: ' + err.message });
    }
  }
});

// Request Cancellation (Passenger)
router.put('/:id/request-cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    mockDb.cancellation_requests.set(id, {
      booking_id: id,
      requested_at: new Date().toISOString(),
      status: 'pending'
    });
    
    // Auto-save is triggered by map interceptor
    return res.json({ message: 'Cancellation request submitted to admin for approval.', status: 'cancel_requested' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Cancel Ticket / Approve Cancellation (Admin or Owner)
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;

  // Retrieve booking first to verify existence and check authorization
  let booking;
  if (isMockMode) {
    booking = mockDb.bookings.get(id);
  } else {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();
      if (data) booking = data;
    } catch (err) {
      console.error('Error fetching booking for cancellation:', err);
    }
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Authorization check: Only Admin, Staff, or Booking Owner can cancel
  const isAuthorized = req.user.role === 'admin' || 
                       req.user.role === 'staff' || 
                       booking.passenger_id === req.user.id;
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied: Unauthorized to cancel this booking.' });
  }

  // State transition validation: Prevent double cancellation
  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'Booking is already cancelled.' });
  }

  if (isMockMode) {
    try {
      const isStaffOrAdmin = req.user.role === 'admin' || req.user.role === 'staff';
      const isOverride = isStaffOrAdmin && req.body?.is_override === true;
      const overridePenalty = req.body?.override_penalty !== undefined ? Number(req.body.override_penalty) : 0;
      const reason = req.body?.cancellation_reason || req.body?.reason || (isStaffOrAdmin ? 'Admin Initiated Cancellation' : 'Passenger requested cancellation');

      const rules = mockDb.system_policies?.cancellation;
      const totalFare = Number(booking.total_fare || 0);

      let penalty = 0;
      let calculatedRefund = totalFare;

      if (isOverride) {
        penalty = Math.min(totalFare, Math.max(0, overridePenalty));
        calculatedRefund = Math.max(0, totalFare - penalty);
      } else if (req.body?.refund_amount !== undefined) {
        calculatedRefund = Math.min(totalFare, Math.max(0, Number(req.body.refund_amount)));
        penalty = Math.max(0, totalFare - calculatedRefund);
      } else {
        const flatFee = rules?.flatFee48h !== undefined ? Number(rules.flatFee48h) : 240;
        const pct12_48 = rules?.percent12to48h !== undefined ? Number(rules.percent12to48h) : 25;
        const pct4_12 = rules?.percent4to12h !== undefined ? Number(rules.percent4to12h) : 50;

        const now = new Date();
        const journeyDate = new Date(booking.travel_date || now);
        const diffHours = (journeyDate - now) / (1000 * 60 * 60);

        if (diffHours > 48) {
          penalty = Math.min(totalFare, flatFee);
        } else if (diffHours >= 12) {
          penalty = Math.round(totalFare * (pct12_48 / 100));
        } else if (diffHours >= 4) {
          penalty = Math.round(totalFare * (pct4_12 / 100));
        } else {
          penalty = totalFare;
        }
        calculatedRefund = Math.max(0, totalFare - penalty);
      }

      // 1. Update Booking Status and metadata
      booking.status = 'cancelled';
      booking.cancellation_date_time = req.body?.cancellation_date_time || new Date().toISOString();
      booking.cancellation_reason = reason;
      booking.cancelled_by = isStaffOrAdmin ? (req.user.full_name || req.user.role.toUpperCase()) : 'Passenger';
      booking.refund_amount = calculatedRefund;
      booking.penalty_amount = penalty;
      booking.refund_status = req.body?.refund_status || (calculatedRefund > 0 ? 'APPROVED' : 'NONE');
      booking.is_override = isOverride;
      mockDb.bookings.set(id, booking);

      // 2. Preserve allocation history while releasing seat availability for searches
      const cancelledAllocations = Array.from(mockDb.seat_allocations.values()).filter(
        a => a.booking_id === id
      );

      // 3. Update Payment Status if exists (to REFUNDED)
      const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === id);
      if (payment) {
        payment.status = calculatedRefund > 0 ? 'REFUNDED' : 'CANCELLED_NO_REFUND';
        payment.refund_amount = calculatedRefund;
        mockDb.payments.set(payment.id, payment);
      }

      // 4. Create Permanent Cancellation Ledger Record
      const train = mockDb.trains.get(booking.train_id);
      const passenger = mockDb.profiles.get(booking.passenger_id);
      const cancellationType = req.body?.cancellation_type || (isStaffOrAdmin ? 'admin' : 'passenger');
      const refundStatus = req.body?.refund_status || (calculatedRefund > 0 ? 'APPROVED' : 'REJECTED');

      // Resolve actual passenger name robustly
      const resolvedPassengerName = resolvePassengerNameForBooking(id, booking.passenger_id, booking.passenger_name);

      const cancRecord = {
        id: `canc-${id}`,
        booking_id: id,
        pnr: booking.pnr_number,
        passenger_id: booking.passenger_id,
        passenger_name: resolvedPassengerName,
        train_id: booking.train_id,
        train_number: train ? train.train_number : (booking.train_number || '12952'),
        train_name: train ? train.train_name : (booking.train_name || 'Railway Express'),
        journey_date: booking.travel_date,
        original_fare: totalFare,
        deduction_amount: penalty,
        refund_amount: calculatedRefund,
        refund_status: refundStatus,
        cancellation_reason: reason,
        cancellation_type: cancellationType,
        cancelled_by_user_id: req.user.id,
        cancelled_by_role: req.user.role || 'passenger',
        cancellation_date_time: booking.cancellation_date_time,
        admin_override: isOverride,
        override_reason: req.body?.override_reason || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.cancellation_records.set(id, cancRecord);

      // 5. Mark local cancellation request as approved if exists
      if (mockDb.cancellation_requests.has(id)) {
        const creq = mockDb.cancellation_requests.get(id);
        creq.status = 'approved';
        mockDb.cancellation_requests.set(id, creq);
      }

      // 6. Create Audit Log
      if (!mockDb.audit_logs) mockDb.audit_logs = new Map();
      const logId = 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const actionType = isStaffOrAdmin ? (isOverride ? 'ADMIN_REFUND_OVERRIDE' : 'ADMIN_TICKET_CANCELLED') : 'PASSENGER_TICKET_CANCELLED';
      mockDb.audit_logs.set(logId, {
        id: logId,
        action: actionType,
        event_type: actionType,
        booking_id: id,
        pnr: booking.pnr_number,
        passenger_id: booking.passenger_id,
        cancelled_by_user_id: req.user.id,
        cancelled_by_role: req.user.role,
        target_id: booking.pnr_number || id,
        train_id: booking.train_id,
        user_id: req.user.id,
        user_role: req.user.role,
        previous_status: 'confirmed',
        new_status: 'cancelled',
        reason,
        original_amount: totalFare,
        deduction_amount: penalty,
        refund_amount: calculatedRefund,
        refund_status: refundStatus,
        penalty_amount: penalty,
        is_override: isOverride,
        timestamp: new Date().toISOString()
      });

      // Save map changes to disk
      saveMockDbToFile();

      return res.json({ 
        message: 'Ticket cancelled atomically (Mock Mode)', 
        booking,
        cancellation_record: cancRecord,
        penalty_amount: penalty,
        refund_amount: calculatedRefund,
        payment_status: payment ? payment.status : 'refund_pending'
      });
    } catch (mockErr) {
      return res.status(500).json({ error: 'Mock cancellation transaction failed: ' + mockErr.message });
    }
  } else {
    try {
      // Execute cancellation via PostgreSQL atomic transaction RPC
      const { data: result, error: rpcErr } = await supabase.rpc('cancel_booking_atomic', {
        p_booking_id: id,
        p_user_id: req.user.id,
        p_user_role: req.user.role
      });

      if (rpcErr) {
        console.error('Supabase cancellation RPC failed:', rpcErr.message);
        return res.status(550).json({ error: 'Database cancellation failed: ' + rpcErr.message });
      }

      // Clean local cancellation requests if any
      if (mockDb.cancellation_requests.has(id)) {
        const creq = mockDb.cancellation_requests.get(id);
        creq.status = 'approved';
        mockDb.cancellation_requests.set(id, creq);
        saveMockDbToFile();
      }

      return res.json({ message: 'Ticket cancelled successfully', booking: result });
    } catch (err) {
      console.error('Database error cancelling booking:', err.message);
      return res.status(500).json({ error: 'Database cancellation failed: ' + err.message });
    }
  }
});

// Promote RAC / Waitlist ticket to Confirmed berth (Admin & Staff)
router.put('/:id/promote', authenticateToken, requireRoles(['admin', 'staff']), async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    const booking = mockDb.bookings.get(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'rac' && booking.status !== 'waitlist') {
      return res.status(400).json({ error: `Booking is not in RAC or waitlist status (current status: ${booking.status})` });
    }

    // Find available unallocated seats for train and coach class
    const seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === booking.train_id && s.coach_class === (booking.coach_class || '3A')
    );

    const bookedSeatIds = Array.from(mockDb.seat_allocations.values())
      .filter(a => a.travel_date === booking.travel_date && a.seat_id)
      .map(a => a.seat_id);

    const availableSeats = seats.filter(s => !bookedSeatIds.includes(s.id));

    let assignedSeat = availableSeats[0];
    if (!assignedSeat) {
      // Generate a berth if none pre-allocated
      const coachNum = (booking.coach_class || '3A') === 'SL' ? 'S1' : 'B1';
      const seatNum = Math.floor(Math.random() * 20) + 1;
      const sId = `${booking.train_id}-${coachNum}-${seatNum}-${Date.now()}`;
      assignedSeat = {
        id: sId,
        train_id: booking.train_id,
        coach_class: booking.coach_class || '3A',
        coach_number: coachNum,
        seat_number: seatNum,
        berth_type: 'LB'
      };
      mockDb.seats.set(sId, assignedSeat);
    }

    // Update booking status
    booking.status = 'confirmed';
    mockDb.bookings.set(id, booking);

    // Update or create allocation
    let alloc = Array.from(mockDb.seat_allocations.values()).find(a => a.booking_id === id);
    if (alloc) {
      alloc.seat_id = assignedSeat.id;
      mockDb.seat_allocations.set(alloc.id, alloc);
    } else {
      const allocId = 'al-' + Math.random().toString(36).substr(2, 9);
      alloc = {
        id: allocId,
        booking_id: id,
        seat_id: assignedSeat.id,
        travel_date: booking.travel_date,
        passenger_name: 'Promoted Passenger',
        passenger_age: 30,
        passenger_gender: 'Male'
      };
      mockDb.seat_allocations.set(allocId, alloc);
    }

    saveMockDbToFile();

    return res.json({
      success: true,
      message: 'Booking promoted to CONFIRMED successfully (Mock Mode)',
      booking,
      assigned_seat: assignedSeat
    });
  } else {
    try {
      const { data, error } = await supabase.rpc('promote_rac_booking_atomic', {
        p_booking_id: id,
        p_admin_id: req.user.id
      });

      if (error) {
        console.error('Supabase RAC promotion RPC failed:', error.message);
        return res.status(400).json({ error: 'Promotion failed: ' + error.message });
      }

      return res.json({
        success: true,
        message: 'Booking promoted to CONFIRMED successfully',
        promotion: data
      });
    } catch (err) {
      console.error('Database error during RAC promotion:', err.message);
      return res.status(500).json({ error: 'Promotion error: ' + err.message });
    }
  }
});

module.exports = router;
