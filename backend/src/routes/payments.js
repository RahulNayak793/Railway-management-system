const express = require('express');
const router = express.Router();
const stripe = require('stripe');
const { isMockMode, mockDb, supabase, saveMockDbToFile } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../config/nodemailer');
const dummyPaymentService = require('../services/dummyPaymentService');
const razorpayService = require('../services/razorpayService');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripeClient = !stripeSecretKey.includes('mock') ? stripe(stripeSecretKey) : null;

// =========================================================================
// 1. PUBLIC DEMO PAYMENT GATEWAY CONFIGURATION
// =========================================================================
router.get('/config', (req, res) => {
  return res.json(razorpayService.getPublicRazorpayConfig());
});

// =========================================================================
// 2. CREATE DEMO PAYMENT ORDER (TICKET, WALLET, CATERING)
// =========================================================================
router.post('/create-order', authenticateToken, async (req, res) => {
  const payment_type = req.body.payment_type || 'TICKET_BOOKING';
  const reference_id = req.body.reference_id || req.body.booking_id || req.body.order_id || (payment_type === 'WALLET_RECHARGE' ? req.user.id : null);
  const amount = req.body.amount;
  const description = req.body.description;
  const metadata = req.body.metadata || {};

  if (!payment_type || !reference_id) {
    return res.status(400).json({ success: false, error: 'payment_type and reference_id are required' });
  }

  let authoritativeAmount = parseFloat(amount || 0);

  if (isMockMode) {
    // 1. Validate based on payment type
    if (payment_type === 'TICKET_BOOKING') {
      const booking = mockDb.bookings.get(reference_id) || Array.from(mockDb.bookings.values()).find(b => b.id === reference_id || b.pnr_number === reference_id);
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking reservation record not found.' });
      }

      // Check ownership
      const isOwner = (booking.passenger_id === req.user.id) ||
                      (booking.user_id === req.user.id) ||
                      (req.user.role === 'admin') ||
                      (req.user.role === 'staff');
      if (!isOwner) {
        return res.status(403).json({ success: false, error: 'Access denied: Unauthorized booking access.' });
      }

      // Enforce authoritative ticket fare & detect client tampering
      const authoritativeFare = parseFloat(booking.total_fare || 850);
      if (amount !== undefined && Math.abs(parseFloat(amount) - authoritativeFare) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `Fare amount mismatch: Expected ₹${authoritativeFare.toFixed(2)}, received ₹${parseFloat(amount).toFixed(2)}.`
        });
      }
      authoritativeAmount = authoritativeFare;

    } else if (payment_type === 'FOOD_ORDER' || payment_type === 'CATERING_ORDER') {
      // Check if reference is a booking/PNR
      const booking = mockDb.bookings.get(reference_id) || Array.from(mockDb.bookings.values()).find(b => b.pnr_number === reference_id || b.id === reference_id);
      if (booking) {
        if (booking.status === 'cancelled' || booking.booking_status === 'CANCELLED') {
          return res.status(400).json({
            success: false,
            code: 'CANCELLED_TICKET',
            message: 'Food ordering is unavailable for a cancelled ticket.'
          });
        }
        const { isJourneyCompleted } = require('../utils/cateringEligibilityHelper');
        if (isJourneyCompleted && isJourneyCompleted(booking, new Date())) {
          return res.status(400).json({
            success: false,
            code: 'COMPLETED_JOURNEY',
            message: 'Food ordering is unavailable because the journey has been completed.'
          });
        }
      }

      const cOrder = mockDb.catering_orders?.get(reference_id) || 
                     Array.from(mockDb.catering_orders?.values() || []).find(o => o.order_id === reference_id || o.id === reference_id);
      if (cOrder) {
        // Check ownership
        const isOwner = isMockMode ||
                        (cOrder.passenger_id === req.user.id) ||
                        (cOrder.user_id === req.user.id) ||
                        (req.user.role === 'admin') ||
                        (req.user.role === 'staff');
        if (!isOwner) {
          return res.status(403).json({ success: false, error: 'Access denied: Unauthorized food order access.' });
        }

        // Enforce authoritative catering amount & detect tampering
        const authoritativeFood = parseFloat(cOrder.total_amount || 0);
        if (amount !== undefined && Math.abs(parseFloat(amount) - authoritativeFood) > 0.01) {
          return res.status(400).json({
            success: false,
            error: `Fare amount mismatch: Expected ₹${authoritativeFood.toFixed(2)}, received ₹${parseFloat(amount).toFixed(2)}.`
          });
        }
        authoritativeAmount = authoritativeFood;
      } else if (!booking) {
        return res.status(404).json({ success: false, error: 'Order reference not found.' });
      } else {
        authoritativeAmount = parseFloat(amount || 0);
      }

    } else if (payment_type === 'WALLET_RECHARGE') {
      authoritativeAmount = parseFloat(amount);
      if (isNaN(authoritativeAmount) || authoritativeAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid wallet recharge amount. Amount must be positive.' });
      }
    }

    try {
      const order = dummyPaymentService.createDummyOrder({
        amount: authoritativeAmount,
        payment_type,
        reference_id,
        user_id: req.user.id,
        user_email: req.user.email,
        description: description || `RailControl Secure Demo Payment - ${payment_type}`,
        metadata: {
          ...metadata,
          source: 'RailControl Demo Gateway'
        }
      });

      const demoPayId = dummyPaymentService.generateDummyPaymentId();

      if (!mockDb.razorpay_payments) mockDb.razorpay_payments = new Map();
      const orderRecord = {
        id: 'rzp-' + Math.random().toString(36).substr(2, 9),
        user_id: req.user.id,
        payment_type,
        reference_id: String(reference_id),
        razorpay_order_id: order.order_id,
        razorpay_payment_id: demoPayId,
        payment_id: demoPayId,
        amount: authoritativeAmount,
        currency: 'INR',
        status: 'CREATED',
        demo_mode: true,
        description: order.description,
        metadata: order.metadata,
        created_at: new Date().toISOString()
      };
      mockDb.razorpay_payments.set(order.order_id, orderRecord);
      mockDb.razorpay_payments.set(order.id, orderRecord);
      mockDb.razorpay_payments.set(demoPayId, orderRecord);

      return res.status(201).json({
        success: true,
        ...order,
        order_id: order.order_id,
        payment_id: demoPayId,
        amount: authoritativeAmount,
        amount_in_rupees: authoritativeAmount,
        demo_mode: true
      });

    } catch (orderErr) {
      return res.status(400).json({ success: false, error: orderErr.message });
    }

  } else {
    // Live Supabase Mode
    try {
      if (payment_type === 'TICKET_BOOKING') {
        const { data: booking, error: bErr } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', reference_id)
          .single();

        if (bErr || !booking) {
          return res.status(404).json({ success: false, error: 'Booking reservation record not found.' });
        }

        if (booking.passenger_id !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ success: false, error: 'Access denied: Unauthorized booking access.' });
        }

        authoritativeAmount = parseFloat(booking.total_fare || amount);
      }

      const order = dummyPaymentService.createDummyOrder({
        amount: authoritativeAmount,
        payment_type,
        reference_id,
        user_id: req.user.id,
        user_email: req.user.email,
        description: description || `RailControl Secure Demo Payment - ${payment_type}`
      });

      await supabase.from('razorpay_payments').insert({
        user_id: req.user.id,
        payment_type,
        reference_id: String(reference_id),
        razorpay_order_id: order.order_id,
        amount: authoritativeAmount,
        currency: 'INR',
        status: 'CREATED',
        description: order.description
      });

      return res.status(201).json({
        success: true,
        ...order,
        order_id: order.order_id,
        amount: authoritativeAmount,
        amount_in_rupees: authoritativeAmount,
        demo_mode: true
      });

    } catch (dbErr) {
      console.error('Order creation DB error:', dbErr);
      return res.status(500).json({ success: false, error: 'Failed to create payment order: ' + dbErr.message });
    }
  }
});

// =========================================================================
// 3. VERIFY DEMO PAYMENT & FINALIZE BOOKING
// =========================================================================
router.post('/verify', authenticateToken, async (req, res) => {
  const {
    order_id,
    payment_id,
    signature,
    payment_method,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    session_id,
    booking_id,
    payment_type,
    reference_id
  } = req.body;

  // Stripe fallback if session_id is supplied
  if (session_id) {
    if (isMockMode || !stripeClient) {
      return res.json({ success: true, message: 'Mock payment verified' });
    }
    try {
      const session = await stripeClient.checkout.sessions.retrieve(session_id);
      if (session.payment_status === 'paid') {
        await supabase
          .from('payments')
          .update({ status: 'completed' })
          .eq('payment_gateway_id', session_id);

        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', booking_id)
          .single();

        if (booking && booking.status !== 'cancelled') {
          const targetStatus = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
          const { data: updatedBooking } = await supabase
            .from('bookings')
            .update({ status: targetStatus, payment_status: 'PAID' })
            .eq('id', booking_id)
            .select()
            .single();

          return res.json({ success: true, booking: updatedBooking });
        }
        return res.json({ success: true, booking });
      }
      return res.status(400).json({ error: 'Payment not completed' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Standard Demo Gateway Verification
  const targetOrderId = order_id || razorpay_order_id || req.body.dummy_order_id;
  const targetPaymentId = payment_id || razorpay_payment_id || req.body.dummy_payment_id;
  const targetSignature = signature || razorpay_signature || req.body.dummy_signature;

  if (!targetOrderId || !targetPaymentId || !targetSignature) {
    return res.status(400).json({ success: false, error: 'order_id, payment_id, and signature are required for verification.' });
  }

  const isValidSig = dummyPaymentService.verifyDummySignature({
    order_id: targetOrderId,
    payment_id: targetPaymentId,
    signature: targetSignature,
    dummy_order_id: targetOrderId,
    dummy_payment_id: targetPaymentId,
    dummy_signature: targetSignature,
    razorpay_order_id: targetOrderId,
    razorpay_payment_id: targetPaymentId,
    razorpay_signature: targetSignature
  }) || razorpayService.verifyPaymentSignature({
    razorpay_order_id: targetOrderId,
    razorpay_payment_id: targetPaymentId,
    razorpay_signature: targetSignature
  });

  if (!isValidSig) {
    return res.status(400).json({ success: false, error: 'Payment signature verification failed: Invalid demo signature.' });
  }

  const methodLabel = payment_method || 'CARD';

  if (isMockMode) {
    if (!mockDb.razorpay_payments) mockDb.razorpay_payments = new Map();
    let orderRecord = mockDb.razorpay_payments.get(targetOrderId) || mockDb.razorpay_payments.get(targetPaymentId);

    // If order was generated in memory or test
    if (!orderRecord) {
      orderRecord = {
        id: 'rzp-' + Math.random().toString(36).substr(2, 9),
        user_id: req.user.id,
        payment_type: payment_type || 'TICKET_BOOKING',
        reference_id: reference_id || 'bk-mock-ref',
        razorpay_order_id: targetOrderId,
        amount: parseFloat(req.body.amount || 850),
        status: 'CREATED',
        created_at: new Date().toISOString()
      };
      mockDb.razorpay_payments.set(targetOrderId, orderRecord);
    }

    // Idempotency check: Already processed
    if (orderRecord.status === 'CAPTURED') {
      const existingTxnId = orderRecord.transaction_id || orderRecord.razorpay_payment_id || `RC-DEMO-${Date.now()}`;
      return res.json({
        success: true,
        verified: true,
        demo_mode: true,
        payment_status: 'PAID',
        message: 'Payment verified successfully (Idempotent): already verified and captured.',
        transaction_id: existingTxnId,
        order_id: targetOrderId,
        payment_id: targetPaymentId,
        payment: orderRecord
      });
    }

    // Mark Captured
    const txnId = dummyPaymentService.generateDummyTransactionId();
    orderRecord.status = 'CAPTURED';
    orderRecord.razorpay_payment_id = targetPaymentId;
    orderRecord.payment_id = targetPaymentId;
    orderRecord.razorpay_signature = targetSignature;
    orderRecord.transaction_id = txnId;
    orderRecord.payment_method = methodLabel;
    orderRecord.paid_at = new Date().toISOString();
    orderRecord.demo_mode = true;

    mockDb.razorpay_payments.set(targetOrderId, orderRecord);
    mockDb.razorpay_payments.set(targetPaymentId, orderRecord);
    mockDb.razorpay_payments.set(orderRecord.id, orderRecord);

    let updatedEntity = null;
    const targetRef = reference_id || orderRecord.reference_id;
    const actualType = payment_type || orderRecord.payment_type;

    if (actualType === 'TICKET_BOOKING') {
      const booking = mockDb.bookings.get(targetRef) || Array.from(mockDb.bookings.values()).find(b => b.id === targetRef || b.pnr_number === targetRef);
      if (booking) {
        booking.payment_status = 'PAID';
        if (booking.status !== 'cancelled') {
          booking.status = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
          booking.booking_status = 'CNF';
        }
        booking.payment_method = methodLabel;
        mockDb.bookings.set(booking.id, booking);
        if (booking.pnr_number) mockDb.bookings.set(booking.pnr_number, booking);
        updatedEntity = booking;

        // Seat allocation
        if (!mockDb.seat_allocations) mockDb.seat_allocations = new Map();
        const existingAlloc = Array.from(mockDb.seat_allocations.values()).find(a => a.booking_id === booking.id);
        if (!existingAlloc && booking.passengers && booking.passengers.length > 0) {
          booking.passengers.forEach((p, idx) => {
            const allocId = `alloc-${booking.id}-${idx}`;
            const coach = booking.coach_class === '1A' ? 'H1' : booking.coach_class === '2A' ? 'A1' : booking.coach_class === '3A' ? 'B1' : 'S1';
            const seatNum = idx + 15;
            const berth = p.berth || (idx % 2 === 0 ? 'LOWER' : 'UPPER');
            p.coach = coach;
            p.seat = seatNum;
            p.berth = berth;
            mockDb.seat_allocations.set(allocId, {
              id: allocId,
              booking_id: booking.id,
              passenger_name: p.name,
              coach_number: coach,
              seat_number: seatNum,
              berth_type: berth,
              pnr: booking.pnr_number
            });
          });
        }

        // Record in mockDb.payments
        const payId = 'pay-' + Math.random().toString(36).substr(2, 9);
        const paymentRecord = {
          id: payId,
          booking_id: booking.id,
          transaction_id: txnId,
          payment_gateway_id: targetPaymentId,
          amount: orderRecord.amount,
          payment_method: methodLabel,
          status: 'completed',
          created_at: new Date().toISOString()
        };
        mockDb.payments.set(payId, paymentRecord);

        // Send confirmation email
        sendEmail({
          to: req.user.email,
          subject: `Payment Successful - PNR: ${booking.pnr_number}`,
          text: `Payment of ₹${orderRecord.amount.toFixed(2)} received via ${methodLabel}. Transaction ID: ${txnId}. Ticket Status: ${booking.status.toUpperCase()}.`
        });
      }

    } else if (actualType === 'CATERING_ORDER' || actualType === 'FOOD_ORDER') {
      const cOrder = mockDb.catering_orders?.get(targetRef) ||
                     Array.from(mockDb.catering_orders?.values() || []).find(o => o.order_id === targetRef || o.id === targetRef);
      if (cOrder) {
        cOrder.status = 'CONFIRMED';
        cOrder.payment_status = 'Paid';
        cOrder.payment_method = methodLabel;
        cOrder.paid_at = new Date().toISOString();
        mockDb.catering_orders.set(cOrder.order_id || cOrder.id, cOrder);
        updatedEntity = cOrder;
      }

    } else if (actualType === 'WALLET_RECHARGE') {
      if (!mockDb.wallets) mockDb.wallets = new Map();
      if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

      let wallet = mockDb.wallets.get(req.user.id);
      if (!wallet) {
        wallet = { id: req.user.id, user_id: req.user.id, balance: 2500.00, transactions: [], updated_at: new Date().toISOString() };
      }
      wallet.balance = parseFloat((wallet.balance + orderRecord.amount).toFixed(2));
      wallet.updated_at = new Date().toISOString();
      mockDb.wallets.set(req.user.id, wallet);

      const wTxnId = `txn-topup-${Date.now()}`;
      mockDb.wallet_transactions.set(wTxnId, {
        id: wTxnId,
        user_id: req.user.id,
        type: 'credit',
        title: 'Rail Wallet Recharge',
        date: new Date().toISOString(),
        amount: orderRecord.amount,
        status: 'success',
        reference: txnId
      });
      updatedEntity = {
        ...wallet,
        wallet_balance: wallet.balance
      };
    }

    saveMockDbToFile();

    return res.json({
      success: true,
      verified: true,
      demo_mode: true,
      message: 'Payment verified successfully',
      payment_status: 'PAID',
      transaction_id: txnId,
      order_id: targetOrderId,
      payment_id: targetPaymentId,
      payment_method: methodLabel,
      amount: orderRecord.amount,
      payment: orderRecord,
      entity: updatedEntity,
      booking: actualType === 'TICKET_BOOKING' ? updatedEntity : null
    });

  } else {
    // Supabase Mode
    try {
      const txnId = dummyPaymentService.generateDummyTransactionId();

      const { data: orderRecord, error: getErr } = await supabase
        .from('razorpay_payments')
        .select('*')
        .eq('razorpay_order_id', targetOrderId)
        .single();

      if (getErr || !orderRecord) {
        return res.status(404).json({ error: 'Order record not found.' });
      }

      await supabase
        .from('razorpay_payments')
        .update({
          status: 'CAPTURED',
          razorpay_payment_id: targetPaymentId,
          razorpay_signature: targetSignature,
          payment_method: methodLabel,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderRecord.id);

      if (orderRecord.payment_type === 'TICKET_BOOKING') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', orderRecord.reference_id)
          .single();

        if (booking && booking.status !== 'cancelled') {
          const targetStatus = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
          const { data: updBooking } = await supabase
            .from('bookings')
            .update({ status: targetStatus, payment_status: 'PAID' })
            .eq('id', booking.id)
            .select()
            .single();

          await supabase.from('payments').insert({
            booking_id: booking.id,
            amount: orderRecord.amount,
            status: 'completed',
            payment_gateway_id: targetPaymentId
          });

          return res.json({
            success: true,
            message: 'Payment verified successfully',
            payment_status: 'PAID',
            transaction_id: txnId,
            booking: updBooking
          });
        }
      }

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        payment_status: 'PAID',
        transaction_id: txnId
      });

    } catch (sbErr) {
      console.error('Supabase payment verify error:', sbErr);
      return res.status(500).json({ error: 'Database payment verification failed: ' + sbErr.message });
    }
  }
});

// =========================================================================
// 4. RECORD PAYMENT FAILURE (WITHOUT CONFIRMING BOOKING)
// =========================================================================
router.post('/fail', authenticateToken, async (req, res) => {
  const { order_id, reason, payment_type, reference_id } = req.body;

  if (isMockMode) {
    if (order_id && mockDb.razorpay_payments) {
      const order = mockDb.razorpay_payments.get(order_id);
      if (order) {
        order.status = 'FAILED';
        order.failure_reason = reason || 'Payment transaction failed or cancelled by user.';
        order.updated_at = new Date().toISOString();
      }
    }

    if (reference_id) {
      const booking = mockDb.bookings?.get(reference_id);
      if (booking && booking.payment_status !== 'PAID') {
        booking.payment_status = 'PENDING';
        if (booking.status === 'confirmed') {
          booking.status = 'pending_payment';
        }
      }
      if (mockDb.catering_orders) {
        const cOrder = mockDb.catering_orders.get(reference_id) || 
                       Array.from(mockDb.catering_orders.values()).find(o => o.order_id === reference_id || o.id === reference_id);
        if (cOrder && cOrder.payment_status !== 'Paid') {
          cOrder.status = 'PENDING_PAYMENT';
        }
      }
    }

    return res.json({
      success: true,
      message: 'Payment failure recorded. Booking status retained for retry.',
      status: 'FAILED',
      payment_status: 'FAILED',
      order_id
    });
  } else {
    try {
      if (order_id) {
        await supabase
          .from('razorpay_payments')
          .update({
            status: 'FAILED',
            failure_reason: reason || 'Payment transaction failed.'
          })
          .eq('razorpay_order_id', order_id);
      }
      return res.json({ success: true, message: 'Payment failure recorded.' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
});

// =========================================================================
// 5. DIRECT DEMO CHECKOUT (UPI, CARD, NETBANKING)
// =========================================================================
router.post('/checkout', authenticateToken, async (req, res) => {
  const { booking_id, amount, payment_method } = req.body;

  if (!booking_id) {
    return res.status(400).json({ error: 'booking_id is required' });
  }

  let booking = null;
  if (isMockMode) {
    booking = mockDb.bookings.get(booking_id);
  } else {
    const { data } = await supabase.from('bookings').select('*').eq('id', booking_id).single();
    booking = data;
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking reservation record not found.' });
  }

  // 1. Ownership Check: Reject cross-passenger payment attempts
  const isOwner = (booking.passenger_id === req.user.id) ||
                  (booking.user_id === req.user.id) ||
                  (req.user.role === 'admin') ||
                  (req.user.role === 'staff');
  if (!isOwner) {
    return res.status(403).json({ error: 'Access denied: Unauthorized booking payment attempt.' });
  }

  // 2. Authoritative Server Fare Enforced
  const payAmount = booking.total_fare ? parseFloat(booking.total_fare) : parseFloat(amount || 0);

  // 3. Payment Method Specific Validations
  const methodUpper = req.body.payment_method ? String(req.body.payment_method).toUpperCase() : 'DEMO';
  let formattedMethod = methodUpper === 'DEMO' ? 'RailControl Demo Gateway' : methodUpper;

  if (methodUpper === 'UPI' || (req.body.payment_method && methodUpper.includes('UPI'))) {
    const upiId = req.body.upi_id || req.body.vpa || '';
    if (!upiId || !String(upiId).includes('@') || String(upiId).trim().length < 4) {
      return res.status(400).json({ error: 'Invalid UPI ID format. Must be in the format username@bank (e.g. user@gpay).' });
    }
    formattedMethod = `UPI (${String(upiId).trim()})`;

  } else if (methodUpper === 'CARD' || methodUpper.includes('CARD')) {
    const cd = req.body.card_details || req.body;
    if (!cd.cardholder_name || !String(cd.cardholder_name).trim()) {
      return res.status(400).json({ error: 'Cardholder name is required.' });
    }
    const rawCard = String(cd.card_number || '').replace(/\s+/g, '');
    if (!rawCard || !/^\d{13,19}$/.test(rawCard)) {
      return res.status(400).json({ error: 'Invalid card number format. Must be 13 to 19 digits.' });
    }
    if (!cd.card_expiry || !/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(String(cd.card_expiry))) {
      return res.status(400).json({ error: 'Expiry date is required in MM/YY format.' });
    }
    const [mStr, yStr] = String(cd.card_expiry).split('/');
    const expMonth = parseInt(mStr, 10);
    const expYear = 2000 + parseInt(yStr, 10);
    const now = new Date();
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < (now.getMonth() + 1))) {
      return res.status(400).json({ error: 'Card has expired.' });
    }
    if (!cd.card_cvv || !/^\d{3,4}$/.test(String(cd.card_cvv).trim())) {
      return res.status(400).json({ error: 'CVV is required (3 or 4 digits).' });
    }

    // Zero sensitive storage: mask card to last 4 digits
    formattedMethod = `Credit / Debit Card (**** ${rawCard.slice(-4)})`;

  } else if (methodUpper === 'NETBANK' || methodUpper.includes('NETBANK') || methodUpper.includes('NET BANK')) {
    const nd = req.body.netbanking_details || req.body;
    const bankName = nd.bank_name || nd.bank;
    const userId = nd.user_id || nd.customer_id;
    if (!bankName || !String(bankName).trim()) {
      return res.status(400).json({ error: 'Bank selection is required for Net Banking.' });
    }
    if (!userId || !String(userId).trim()) {
      return res.status(400).json({ error: 'User ID is required for Net Banking.' });
    }
    formattedMethod = `Net Banking (${String(bankName).trim()})`;
  }

  // 4. Update Booking Status & Persist Payment Record
  const txnId = dummyPaymentService.generateDummyTransactionId();

  if (isMockMode) {
    const paymentId = 'pay-' + Math.random().toString(36).substr(2, 9);
    const newPayment = {
      id: paymentId,
      booking_id,
      transaction_id: txnId,
      payment_gateway_id: txnId,
      amount: payAmount,
      payment_method: formattedMethod,
      status: 'completed',
      created_at: new Date().toISOString()
    };
    mockDb.payments.set(paymentId, newPayment);

    // Update booking payment status (preserve RAC / WL categories)
    if (booking.status !== 'cancelled') {
      booking.status = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
    }
    booking.payment_status = 'PAID';
    booking.payment_method = formattedMethod;
    mockDb.bookings.set(booking_id, booking);

    // Send confirmation email
    sendEmail({
      to: req.user.email,
      subject: `Payment Successful - PNR: ${booking.pnr_number}`,
      text: `We have received your payment of ₹${payAmount.toFixed(2)} via ${formattedMethod}. Ticket Status: ${booking.status.toUpperCase()}.`
    });

    saveMockDbToFile();

    return res.json({
      message: 'Checkout complete (Mock Mode)',
      url: `/passenger/ticket/${booking.pnr_number}?success=true`,
      booking,
      payment: newPayment
    });

  } else {
    // Supabase Mode
    try {
      const { data: newPayment, error: payErr } = await supabase
        .from('payments')
        .insert({
          booking_id,
          amount: payAmount,
          status: 'completed',
          payment_gateway_id: txnId
        })
        .select()
        .single();

      if (payErr) throw payErr;

      const targetStatus = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
      const { data: updatedBooking } = await supabase
        .from('bookings')
        .update({ status: targetStatus, payment_status: 'PAID' })
        .eq('id', booking_id)
        .select()
        .single();

      sendEmail({
        to: req.user.email,
        subject: `Payment Successful - PNR: ${booking.pnr_number}`,
        text: `We have received your payment of ₹${payAmount.toFixed(2)}. Ticket Status: ${targetStatus.toUpperCase()}.`
      });

      return res.json({
        message: 'Checkout complete',
        url: `/passenger/ticket/${booking.pnr_number}?success=true`,
        booking: updatedBooking,
        payment: newPayment
      });

    } catch (err) {
      console.error('Checkout error:', err);
      return res.status(500).json({ error: 'Checkout failed: ' + err.message });
    }
  }
});

// =========================================================================
// 6. RAIL WALLET INSTANT PAYMENT & IDEMPOTENCY
// =========================================================================
router.post('/wallet/pay', authenticateToken, async (req, res) => {
  const { booking_id, order_id } = req.body;

  if (!booking_id && !order_id) {
    return res.status(400).json({ error: 'booking_id or order_id is required' });
  }

  if (isMockMode) {
    if (order_id) {
      const cOrder = mockDb.catering_orders?.get(order_id) ||
                     Array.from(mockDb.catering_orders?.values() || []).find(o => o.order_id === order_id || o.id === order_id);
      if (!cOrder) {
        return res.status(404).json({ error: 'Food order record not found.' });
      }

      // Ownership check
      const isOwner = isMockMode ||
                      (cOrder.passenger_id === req.user.id) ||
                      (cOrder.user_id === req.user.id) ||
                      (req.user.role === 'admin') ||
                      (req.user.role === 'staff');
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: Unauthorized food order payment attempt.' });
      }

      if (!mockDb.wallets) mockDb.wallets = new Map();
      if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

      let wallet = mockDb.wallets.get(req.user.id);
      if (!wallet) {
        wallet = { user_id: req.user.id, balance: 2500.00, updated_at: new Date().toISOString() };
        mockDb.wallets.set(req.user.id, wallet);
      }

      const payAmount = parseFloat(cOrder.total_amount || 0);

      // Idempotency: If already paid and confirmed
      if (cOrder.status === 'CONFIRMED' && (cOrder.payment_status === 'Paid' || cOrder.payment_status === 'PAID')) {
        return res.json({
          success: true,
          message: 'Meal payment already verified (Idempotent)',
          wallet_balance_before: wallet.balance,
          wallet_balance_after: wallet.balance,
          wallet_balance: wallet.balance,
          order: cOrder
        });
      }

      // Insufficient Balance Check
      if (wallet.balance < payAmount) {
        return res.status(400).json({
          error: `Insufficient Rail Wallet balance! Required: ₹${payAmount.toFixed(2)}, Available: ₹${wallet.balance.toFixed(2)}. Please top up your wallet.`,
          required: payAmount,
          available: wallet.balance
        });
      }

      // Atomic debit
      const balanceBefore = wallet.balance;
      wallet.balance = parseFloat((wallet.balance - payAmount).toFixed(2));
      wallet.updated_at = new Date().toISOString();
      mockDb.wallets.set(req.user.id, wallet);

      // Record wallet transaction
      const wTxnId = `txn-foodwal-${Date.now()}`;
      const wRef = `RW-MEAL/${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      mockDb.wallet_transactions.set(wTxnId, {
        id: wTxnId,
        user_id: req.user.id,
        order_id: cOrder.order_id,
        type: 'debit',
        title: `Seat-Side Meal Order (PNR: ${cOrder.pnr_number || 'N/A'})`,
        date: new Date().toISOString(),
        amount: payAmount,
        status: 'success',
        reference: wRef
      });

      // Update food order status
      cOrder.status = 'CONFIRMED';
      cOrder.payment_status = 'Paid';
      cOrder.payment_method = 'IRCTC Rail Wallet';
      cOrder.paid_at = new Date().toISOString();
      mockDb.catering_orders.set(cOrder.order_id || cOrder.id, cOrder);

      saveMockDbToFile();

      return res.json({
        success: true,
        message: 'Food order payment completed successfully via Rail Wallet',
        wallet_balance_before: balanceBefore,
        wallet_balance_after: wallet.balance,
        wallet_balance: wallet.balance,
        order: cOrder
      });
    }

    const booking = mockDb.bookings.get(booking_id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking reservation record not found.' });
    }

    // Ownership check
    const isOwner = (booking.passenger_id === req.user.id) ||
                    (booking.user_id === req.user.id) ||
                    (req.user.role === 'admin') ||
                    (req.user.role === 'staff');
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: Unauthorized booking payment attempt.' });
    }

    if (!mockDb.wallets) mockDb.wallets = new Map();
    if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

    let wallet = mockDb.wallets.get(req.user.id);
    if (!wallet) {
      wallet = { user_id: req.user.id, balance: 2500.00, updated_at: new Date().toISOString() };
      mockDb.wallets.set(req.user.id, wallet);
    }

    const payAmount = parseFloat(booking.total_fare || 850);

    // Idempotency: If booking is already confirmed and paid, do NOT debit wallet balance again
    const isAlreadyPaid = (booking.payment_status === 'PAID' || booking.payment_status === 'paid') &&
                          (booking.status === 'confirmed' || booking.status === 'rac' || booking.status === 'waitlist');
    if (isAlreadyPaid) {
      const existingPay = Array.from(mockDb.payments.values()).find(p => p.booking_id === booking_id);
      return res.json({
        success: true,
        message: 'Payment already verified (Idempotent)',
        wallet_balance_before: wallet.balance,
        wallet_balance_after: wallet.balance,
        wallet_balance: wallet.balance,
        booking,
        payment: existingPay
      });
    }

    // Insufficient Balance Check
    if (wallet.balance < payAmount) {
      return res.status(400).json({
        error: `Insufficient Rail Wallet balance! Required: ₹${payAmount.toFixed(2)}, Available: ₹${wallet.balance.toFixed(2)}. Please top up your wallet.`,
        required: payAmount,
        available: wallet.balance
      });
    }

    // Atomic debit
    const balanceBefore = wallet.balance;
    wallet.balance = parseFloat((wallet.balance - payAmount).toFixed(2));
    wallet.updated_at = new Date().toISOString();
    mockDb.wallets.set(req.user.id, wallet);

    // Record wallet ledger transaction
    const wTxnId = `txn-walpay-${Date.now()}`;
    const wRef = `RW-PAY/${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    mockDb.wallet_transactions.set(wTxnId, {
      id: wTxnId,
      user_id: req.user.id,
      booking_id: booking.id,
      type: 'debit',
      title: `Ticket Reservation (PNR: ${booking.pnr_number})`,
      date: new Date().toISOString(),
      amount: payAmount,
      status: 'success',
      reference: wRef
    });

    // Update booking status
    if (booking.status !== 'cancelled') {
      booking.status = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
    }
    booking.payment_status = 'PAID';
    booking.payment_method = 'IRCTC Rail Wallet';
    mockDb.bookings.set(booking.id, booking);

    // Record in mockDb.payments
    const payId = 'pay-' + Math.random().toString(36).substr(2, 9);
    const newPayment = {
      id: payId,
      booking_id: booking.id,
      transaction_id: wRef,
      payment_gateway_id: wRef,
      amount: payAmount,
      payment_method: 'IRCTC Rail Wallet',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    mockDb.payments.set(payId, newPayment);

    saveMockDbToFile();

    return res.json({
      success: true,
      message: 'Payment completed successfully via Rail Wallet',
      wallet_balance_before: balanceBefore,
      wallet_balance_after: wallet.balance,
      wallet_balance: wallet.balance,
      booking,
      payment: newPayment
    });

  } else {
    // Supabase Mode
    return res.status(501).json({ error: 'Supabase wallet payment stored in local mock mode for development.' });
  }
});

// =========================================================================
// 7. GET RAIL WALLET BALANCE & TRANSACTIONS
// =========================================================================
router.get('/wallet', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  if (isMockMode) {
    if (!mockDb.wallets) mockDb.wallets = new Map();
    if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

    let wallet = mockDb.wallets.get(userId);
    if (!wallet) {
      wallet = { user_id: userId, balance: 2500.00, updated_at: new Date().toISOString() };
      mockDb.wallets.set(userId, wallet);
    }

    const txns = Array.from(mockDb.wallet_transactions.values())
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      balance: wallet.balance,
      transactions: txns
    });

  } else {
    return res.json({ balance: 2500.00, transactions: [] });
  }
});

// =========================================================================
// 8. TOP-UP RAIL WALLET
// =========================================================================
router.post('/wallet/topup', authenticateToken, async (req, res) => {
  const { amount, payment_method } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid top-up amount. Amount must be positive.' });
  }

  const userId = req.user.id;

  if (isMockMode) {
    if (!mockDb.wallets) mockDb.wallets = new Map();
    if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

    let wallet = mockDb.wallets.get(userId);
    if (!wallet) {
      wallet = { user_id: userId, balance: 2500.00, updated_at: new Date().toISOString() };
    }

    wallet.balance = parseFloat((wallet.balance + numAmount).toFixed(2));
    wallet.updated_at = new Date().toISOString();
    mockDb.wallets.set(userId, wallet);

    const wTxnId = `txn-topup-${Date.now()}`;
    const ref = `RW-TOPUP/${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    mockDb.wallet_transactions.set(wTxnId, {
      id: wTxnId,
      user_id: userId,
      type: 'credit',
      title: `Wallet Top-Up (${payment_method || 'UPI'})`,
      date: new Date().toISOString(),
      amount: numAmount,
      status: 'success',
      reference: ref
    });

    saveMockDbToFile();

    return res.json({
      success: true,
      balance: wallet.balance,
      message: `Successfully added ₹${numAmount.toFixed(2)} to Rail Wallet.`
    });
  } else {
    return res.json({ success: true, balance: numAmount + 2500.00 });
  }
});

// =========================================================================
// 9. PASSENGER PAYMENT HISTORY (ISOLATED TO OWNER)
// =========================================================================
router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const isAdminOrStaff = req.user.role === 'admin' || req.user.role === 'staff';

  if (isMockMode) {
    const allBookings = Array.from(mockDb.bookings.values());
    const userBookingIds = new Set(
      allBookings
        .filter(b => isAdminOrStaff || b.passenger_id === userId || b.user_id === userId)
        .map(b => b.id)
    );

    const allPayments = Array.from(mockDb.payments.values())
      .filter(p => userBookingIds.has(p.booking_id));

    const enrichedHistory = allPayments.map(p => {
      const b = mockDb.bookings.get(p.booking_id);
      return {
        id: p.id,
        booking_id: p.booking_id,
        txnId: p.transaction_id || p.payment_gateway_id || p.id,
        pnr: b ? (b.pnr_number || b.pnr) : 'N/A',
        trainName: b ? (b.train_name || b.train?.train_name || 'Express Special') : 'Express Train',
        amount: parseFloat(p.amount || b?.total_fare || 0),
        payment_method: p.payment_method || 'RailControl Demo Gateway',
        method: p.payment_method || 'RailControl Demo Gateway',
        status: p.status === 'completed' ? 'Success' : p.status,
        refund_status: (b && b.status === 'cancelled') || p.status === 'REFUNDED' ? 'Refunded' : 'N/A',
        created_at: p.created_at,
        paymentDate: p.created_at
      };
    });

    enrichedHistory.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return res.json(enrichedHistory);

  } else {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          *,
          booking:bookings(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filtered = payments.filter(p => isAdminOrStaff || p.booking?.passenger_id === userId);
      return res.json(filtered);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch payment history: ' + err.message });
    }
  }
});

// =========================================================================
// 10. PAYMENT RECEIPT DETAILS
// =========================================================================
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    let payment = mockDb.payments.get(id);
    if (!payment) {
      payment = Array.from(mockDb.payments.values()).find(p => p.transaction_id === id || p.booking_id === id);
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    const booking = mockDb.bookings.get(payment.booking_id);
    return res.json({
      organization: 'RailControl Intelligent Railway System',
      transaction_id: payment.transaction_id || payment.payment_gateway_id || payment.id,
      booking_id: payment.booking_id,
      pnr: booking?.pnr_number || 'N/A',
      train_number: booking?.train_number || booking?.train?.train_number || '12952',
      train_name: booking?.train_name || booking?.train?.train_name || 'Mumbai Rajdhani Express',
      source: booking?.source_station || booking?.source || 'BCT',
      destination: booking?.destination_station || booking?.destination || 'NDLS',
      journey_date: booking?.travel_date || new Date().toISOString().split('T')[0],
      passenger_count: booking?.passengers?.length || 1,
      passengers: booking?.passengers || [{ name: 'Passenger', age: 30, gender: 'M' }],
      amount: payment.amount,
      payment_method: payment.payment_method,
      status: payment.status === 'completed' ? 'SUCCESS' : payment.status,
      date: payment.created_at
    });

  } else {
    return res.json({ message: 'Receipt endpoint' });
  }
});

// =========================================================================
// 11. STRIPE WEBHOOK COMPATIBILITY ROUTE
// =========================================================================
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (sig && endpointSecret && stripeClient) {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id || session.client_reference_id;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const paymentGatewayId = session.id;

    if (bookingId && isMockMode) {
      const paymentId = 'pay-' + Math.random().toString(36).substr(2, 9);
      mockDb.payments.set(paymentId, {
        id: paymentId,
        booking_id: bookingId,
        payment_gateway_id: paymentGatewayId,
        amount,
        status: 'completed',
        created_at: new Date().toISOString()
      });

      const booking = mockDb.bookings.get(bookingId);
      if (booking && booking.status !== 'cancelled') {
        booking.status = booking.status === 'waitlist' ? 'waitlist' : booking.status === 'rac' ? 'rac' : 'confirmed';
        booking.payment_status = 'PAID';
        mockDb.bookings.set(bookingId, booking);
      }
    }
  }

  res.json({ received: true });
});

module.exports = router;
