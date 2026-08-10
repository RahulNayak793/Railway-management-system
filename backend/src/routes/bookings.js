const express = require('express');
const router = express.Router();
const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../config/nodemailer');
const { sendSMS } = require('../config/twilio');

// Generate 10-digit PNR
const generatePNR = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Check booking history for logged-in user
router.get('/', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const { role } = req.user;

  if (isMockMode || (passengerId && String(passengerId).startsWith('usr-'))) {
    let bookingsList = Array.from(mockDb.bookings.values());

    // Filter bookings based on role
    if (role === 'passenger') {
      const userBookings = bookingsList.filter(b => 
        b.passenger_id === passengerId || 
        b.passenger_id === 'usr-demo-passenger' ||
        (passengerId && String(b.passenger_id).startsWith('usr-'))
      );
      if (userBookings.length > 0) {
        bookingsList = userBookings;
      }
    }

    // Attach train, route, seats and payment info to each booking
    const enrichedBookings = bookingsList.map(b => {
      const train = mockDb.trains.get(b.train_id);
      const route = Array.from(mockDb.routes.values()).find(r => r.train_id === b.train_id);
      const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === b.id);
      const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === b.id);
      return {
        ...b,
        train,
        route,
        allocations,
        payment
      };
    });

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
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// PNR Status Query (No Authentication Required)
router.get('/pnr/:pnr', async (req, res) => {
  const { pnr } = req.params;

  if (isMockMode) {
    const booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === pnr);
    if (!booking) return res.status(404).json({ error: 'PNR not found' });

    const train = mockDb.trains.get(booking.train_id);
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === booking.id);
    const payment = Array.from(mockDb.payments.values()).find(p => p.booking_id === booking.id);

    return res.json({
      ...booking,
      train,
      allocations,
      payment
    });
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

      if (error) return res.status(404).json({ error: 'PNR not found' });
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Book Ticket
router.post('/book', authenticateToken, async (req, res) => {
  const passengerId = req.user.id;
  const { train_id, travel_date, coach_class, passengers, total_fare } = req.body;

  if (!train_id || !travel_date || !coach_class || !passengers || passengers.length === 0) {
    return res.status(400).json({ error: 'Missing booking details' });
  }

  const pnr = generatePNR();

  if (isMockMode) {
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

    // Filter out seats already booked on this travel date
    const bookedSeatIds = Array.from(mockDb.seat_allocations.values())
      .filter(a => a.travel_date === travel_date)
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
      total_fare: parseFloat(total_fare || '500'),
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
      // Production database transaction simulation using Supabase RPC or individual steps
      // 1. Fetch seats
      const { data: seats, error: seatsErr } = await supabase
        .from('seats')
        .select('*')
        .eq('train_id', train_id)
        .eq('coach_class', coach_class);

      if (seatsErr) throw seatsErr;

      // 2. Fetch allocations on this date
      const seatIds = seats.map(s => s.id);
      const { data: activeAllocations, error: allocErr } = await supabase
        .from('seat_allocations')
        .select('seat_id')
        .eq('travel_date', travel_date)
        .in('seat_id', seatIds);

      if (allocErr) throw allocErr;

      const bookedIds = activeAllocations.map(a => a.seat_id);
      const available = seats.filter(s => !bookedIds.includes(s.id));

      let bookingStatus = 'confirmed';
      if (available.length < passengers.length) {
        // Fallback to RAC / Waitlist
        const { data: activeBookings } = await supabase
          .from('bookings')
          .select('status')
          .eq('train_id', train_id)
          .eq('travel_date', travel_date)
          .neq('status', 'cancelled');

        const racCount = activeBookings.filter(b => b.status === 'rac').length;
        bookingStatus = racCount < 4 ? 'rac' : 'waitlist';
      }

      // Create Booking
      const { data: booking, error: bkErr } = await supabase
        .from('bookings')
        .insert({
          passenger_id: passengerId,
          train_id,
          travel_date,
          pnr_number: pnr,
          status: bookingStatus,
          total_fare
        })
        .select()
        .single();

      if (bkErr) throw bkErr;

      // Insert seat allocations
      const allocationsToInsert = passengers.map((p, idx) => {
        return {
          booking_id: booking.id,
          seat_id: bookingStatus === 'confirmed' ? available[idx].id : null,
          travel_date,
          passenger_name: p.full_name || p.name,
          passenger_age: p.age,
          passenger_gender: p.gender
        };
      });

      const { data: insertedAllocations, error: insErr } = await supabase
        .from('seat_allocations')
        .insert(allocationsToInsert)
        .select();

      if (insErr) throw insErr;

      return res.status(201).json({
        booking,
        allocations: insertedAllocations
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Cancel Ticket and trigger auto promotion
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    const booking = mockDb.bookings.get(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = 'cancelled';
    mockDb.bookings.set(id, booking);

    // Get allocations for this booking
    const cancelledAllocations = Array.from(mockDb.seat_allocations.values()).filter(
      a => a.booking_id === id
    );

    // Free the seats
    const freedSeatIds = cancelledAllocations.map(a => a.seat_id).filter(sid => sid !== null);
    
    // Delete current allocations or clear seat assignments
    cancelledAllocations.forEach(a => {
      mockDb.seat_allocations.delete(a.id);
    });

    // Check if there are waitlisted/RAC bookings on this train class and date to promote
    const pendingBookings = Array.from(mockDb.bookings.values())
      .filter(b => b.train_id === booking.train_id && b.travel_date === booking.travel_date && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Promote RAC to Confirmed and Waitlist to RAC
    let seatIndex = 0;
    for (const pb of pendingBookings) {
      if (pb.status === 'rac' && seatIndex < freedSeatIds.length) {
        // Promote RAC to Confirmed
        pb.status = 'confirmed';
        mockDb.bookings.set(pb.id, pb);

        // Assign a freed seat
        const pAllocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === pb.id);
        pAllocations.forEach(pa => {
          if (!pa.seat_id && seatIndex < freedSeatIds.length) {
            pa.seat_id = freedSeatIds[seatIndex++];
            mockDb.seat_allocations.set(pa.id, pa);
          }
        });
      } else if (pb.status === 'waitlist') {
        // Promote waitlist to RAC
        pb.status = 'rac';
        mockDb.bookings.set(pb.id, pb);
      }
    }

    return res.json({ message: 'Ticket cancelled and promotions updated successfully (Mock Mode)', booking });
  } else {
    try {
      // Cancel booking
      const { data: booking, error: bkErr } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (bkErr) throw bkErr;

      // In real SQL database: trigger/procedure or manual updates would allocate freed seats to RAC
      // Let's return cancellation success
      return res.json({ message: 'Ticket cancelled successfully', booking });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

module.exports = router;
