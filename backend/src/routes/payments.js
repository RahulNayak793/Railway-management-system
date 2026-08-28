const express = require('express');
const router = express.Router();
const stripe = require('stripe');
const { isMockMode, mockDb, supabase } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../config/nodemailer');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripeClient = !stripeSecretKey.includes('mock') ? stripe(stripeSecretKey) : null;

// Create Checkout Session
router.post('/checkout', authenticateToken, async (req, res) => {
  const { booking_id, amount } = req.body;

  if (!booking_id || !amount) {
    return res.status(400).json({ error: 'booking_id and amount are required' });
  }

  const booking = mockDb.bookings.get(booking_id);
  const payAmount = booking && booking.total_fare ? parseFloat(booking.total_fare) : parseFloat(amount);

  if (isMockMode) {
    // Generate a mock payment ID
    const paymentId = 'pay-' + Math.random().toString(36).substr(2, 9);
    
    // Add payment entry
    const newPayment = {
      id: paymentId,
      booking_id,
      payment_gateway_id: 'stripe_mock_' + Math.random().toString(36).substr(2, 9),
      amount: payAmount,
      status: 'completed',
      created_at: new Date().toISOString()
    };
    
    mockDb.payments.set(paymentId, newPayment);

    // Update booking payment status
    const booking = mockDb.bookings.get(booking_id);
    if (booking) {
      booking.status = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
      mockDb.bookings.set(booking_id, booking);
      
      // Send receipt/invoice email
      sendEmail({
        to: req.user.email,
        subject: `Payment Successful - PNR: ${booking.pnr_number}`,
        text: `We have received your payment of ₹${amount}. Your ticket status is ${booking.status.toUpperCase()}.`
      });
    }

    return res.json({
      message: 'Checkout complete (Mock Mode)',
      url: `/passenger/ticket/${booking ? booking.pnr_number : ''}?success=true`,
      payment: newPayment
    });
  } else {
    try {
      if (!stripeClient) {
        // Stripe is mock but database is live Supabase
        const gatewayId = 'stripe_mock_' + Math.random().toString(36).substr(2, 9);

        // 1. Insert payment entry in Supabase
        const { data: newPayment, error: payErr } = await supabase
          .from('payments')
          .insert({
            booking_id,
            amount: parseFloat(amount),
            status: 'completed',
            payment_gateway_id: gatewayId
          })
          .select()
          .single();

        if (payErr) throw payErr;

        // 2. Fetch the booking from Supabase to check status and get PNR
        const { data: booking, error: getErr } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', booking_id)
          .single();

        if (getErr) throw getErr;

        // 3. Update the booking status in Supabase
        const targetStatus = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
        const { error: updErr } = await supabase
          .from('bookings')
          .update({ status: targetStatus })
          .eq('id', booking_id);

        if (updErr) throw updErr;

        // Send receipt/invoice email
        sendEmail({
          to: req.user.email,
          subject: `Payment Successful - PNR: ${booking.pnr_number}`,
          text: `We have received your payment of ₹${amount}. Your ticket status is ${targetStatus.toUpperCase()}.`
        });

        return res.json({
          message: 'Checkout complete (Live Database with Mock Stripe)',
          url: `/passenger/ticket/${booking ? booking.pnr_number : ''}?success=true`,
          payment: newPayment
        });
      } else {
        // Fetch booking details first to retrieve passenger details and PNR
        const { data: booking, error: getErr } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', booking_id)
          .single();

        if (getErr) throw getErr;

        // Direct Stripe integration
        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'inr',
                product_data: {
                  name: `Train Ticket Reservation PNR: ${booking.pnr_number}`,
                },
                unit_amount: Math.round(amount * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${req.headers.origin}/passenger/ticket/${booking.pnr_number}?success=true`,
          cancel_url: `${req.headers.origin}/passenger/ticket/${booking.pnr_number}?cancelled=true`,
          client_reference_id: booking_id,
          metadata: {
            booking_id: booking_id
          }
        });

        // Insert pending payment record
        await supabase.from('payments').insert({
          booking_id,
          amount,
          status: 'pending',
          payment_gateway_id: session.id
        });

        return res.json({ url: session.url });
      }
    } catch (err) {
      console.error('Checkout Error:', err);
      return res.status(500).json({ error: 'Checkout failed: ' + err.message });
    }
  }
});

// Idempotent Stripe Webhook Route with Signature Verification
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (sig && endpointSecret && stripeClient) {
      // Validate Stripe event signature using rawBody buffer
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } else {
      // Local/test sandbox fallback
      event = req.body;
    }
  } catch (err) {
    console.error('⚠️ Webhook Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle transaction updates on checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id || session.client_reference_id;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const paymentGatewayId = session.id;

    if (!bookingId) {
      console.warn('⚠️ Webhook event missing booking identifier metadata.');
      return res.json({ received: true });
    }

    if (isMockMode) {
      const paymentId = 'pay-' + Math.random().toString(36).substr(2, 9);
      const newPayment = {
        id: paymentId,
        booking_id: bookingId,
        payment_gateway_id: paymentGatewayId,
        amount,
        status: 'completed',
        created_at: new Date().toISOString()
      };
      mockDb.payments.set(paymentId, newPayment);

      const booking = mockDb.bookings.get(bookingId);
      if (booking) {
        booking.status = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
        mockDb.bookings.set(bookingId, booking);
      }
    } else {
      try {
        // Idempotency check: Look up existing payment entry
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('*')
          .eq('payment_gateway_id', paymentGatewayId)
          .maybeSingle();

        if (!existingPayment) {
          await supabase.from('payments').insert({
            booking_id: bookingId,
            amount,
            status: 'completed',
            payment_gateway_id: paymentGatewayId
          });
        } else if (existingPayment.status !== 'completed') {
          await supabase
            .from('payments')
            .update({ status: 'completed' })
            .eq('id', existingPayment.id);
        }

        // Fetch the booking details
        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (booking) {
          // Prevent promoting CANCELLED state back to CONFIRMED
          if (booking.status !== 'cancelled') {
            const targetStatus = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
            await supabase
              .from('bookings')
              .update({ status: targetStatus })
              .eq('id', bookingId);
          }
        }
      } catch (dbErr) {
        console.error('⚠️ Webhook database processing error:', dbErr.message);
        return res.status(500).json({ error: 'Database webhook update failed' });
      }
    }
  }

  res.json({ received: true });
});

// Verify Payment Hook / Callback (Frontend redirect fallback)
router.post('/verify', authenticateToken, async (req, res) => {
  const { session_id, booking_id } = req.body;

  if (isMockMode || !stripeClient) {
    return res.json({ success: true, message: 'Mock payment verified' });
  }

  try {
    const session = await stripeClient.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      // 1. Update Payment Status in DB
      await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('payment_gateway_id', session_id);

      // 2. Fetch booking details and update status
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking_id)
        .single();

      if (booking && booking.status !== 'cancelled') {
        const targetStatus = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
        const { data: updatedBooking } = await supabase
          .from('bookings')
          .update({ status: targetStatus })
          .eq('id', booking_id)
          .select()
          .single();

        return res.json({ success: true, booking: updatedBooking });
      }

      return res.json({ success: true, booking });
    } else {
      return res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
