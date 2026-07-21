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

  if (isMockMode || !stripeClient) {
    // Generate a mock payment ID
    const paymentId = 'pay-' + Math.random().toString(36).substr(2, 9);
    
    // Add payment entry
    const newPayment = {
      id: paymentId,
      booking_id,
      payment_gateway_id: 'stripe_mock_' + Math.random().toString(36).substr(2, 9),
      amount: parseFloat(amount),
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
      url: `/ticket/${booking ? booking.pnr_number : ''}?success=true`,
      payment: newPayment
    });
  } else {
    try {
      // Direct Stripe integration
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: 'Train Ticket Reservation',
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.origin}/ticket-success?booking_id=${booking_id}`,
        cancel_url: `${req.headers.origin}/ticket-cancel`,
      });

      // Insert pending payment record
      await supabase.from('payments').insert({
        booking_id,
        amount,
        status: 'pending',
        payment_gateway_id: session.id
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error('Stripe Checkout Error:', err);
      return res.status(400).json({ error: err.message });
    }
  }
});

// Verify Payment Hook / Callback
router.post('/verify', authenticateToken, async (req, res) => {
  const { session_id, booking_id } = req.body;

  if (isMockMode || !stripeClient) {
    return res.json({ success: true, message: 'Mock payment verified' });
  }

  try {
    const session = await stripeClient.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      // Update Payment Status in DB
      await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('payment_gateway_id', session_id);

      // Fetch booking details
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking_id)
        .single();

      return res.json({ success: true, booking });
    } else {
      return res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
