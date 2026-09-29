/**
 * RailControl Dummy Payment Gateway Service
 * 100% Mock / Demo Payment Gateway for College / Demo Environment
 * 
 * Features:
 * - Generates demo order ID: order_demo_RC123456
 * - Generates demo payment ID: pay_demo_RC123456
 * - Generates demo transaction ID: txn_demo_RC123456
 * - Deterministic demo signature generation and verification
 * - Zero real credentials, zero external payment calls, zero money charged
 */

const crypto = require('crypto');

const DUMMY_SALT = 'railcontrol_dummy_secure_v2';

/**
 * Generate a randomized demo order ID in the format order_demo_RCXXXXXX
 */
function generateDummyOrderId() {
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return `order_demo_RC${randNum}`;
}

/**
 * Generate a randomized demo payment ID in the format pay_demo_RCXXXXXX
 */
function generateDummyPaymentId() {
  const randNum = Math.floor(100000 + Math.random() * 900000);
  return `pay_demo_RC${randNum}`;
}

/**
 * Generate a randomized demo transaction ID in the format txn_demo_RCXXXXXX or RC-DEMO-XXXXXXXX
 */
function generateDummyTransactionId() {
  const chars = '0123456789ABCDEF';
  let randHex = '';
  for (let i = 0; i < 8; i++) {
    randHex += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RC-DEMO-${randHex}`;
}

/**
 * Generate deterministic signature for verifying demo payments
 */
function generateDummySignature(orderId, paymentId) {
  const cleanOrder = String(orderId || '').trim();
  const cleanPay = String(paymentId || '').trim();
  const payload = `${cleanOrder}|${cleanPay}|${DUMMY_SALT}`;
  return 'demo_sig_' + crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify demo payment signature
 */
function verifyDummySignature({ order_id, payment_id, signature, razorpay_order_id, razorpay_payment_id, razorpay_signature, dummy_order_id, dummy_payment_id, dummy_signature }) {
  const targetOrderId = order_id || razorpay_order_id || dummy_order_id;
  const targetPaymentId = payment_id || razorpay_payment_id || dummy_payment_id;
  const targetSig = signature || razorpay_signature || dummy_signature;

  if (!targetOrderId || !targetPaymentId || !targetSig) {
    return false;
  }

  const expected1 = generateDummySignature(targetOrderId, targetPaymentId);
  if (targetSig === expected1) return true;

  // Compatibility with razorpayService generateDemoSignature
  const payloadLegacy = `${String(targetOrderId).trim()}|${String(targetPaymentId).trim()}|railcontrol_demo`;
  const expectedLegacy = 'demo_sig_' + crypto.createHash('sha256').update(payloadLegacy).digest('hex');
  if (targetSig === expectedLegacy) return true;

  // Standard deterministic demo sig prefix match if both are demo tokens
  if (String(targetOrderId).startsWith('order_demo_') && String(targetSig).startsWith('demo_sig_')) {
    return true;
  }

  return false;
}

/**
 * Create a Demo Payment Order
 */
function createDummyOrder({ amount, payment_type, reference_id, user_id, user_email, description, metadata = {} }) {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid order amount: Amount must be a positive number.');
  }

  const orderId = generateDummyOrderId();
  const receipt = `rcpt_demo_RC${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    id: orderId,
    order_id: orderId,
    amount: numAmount,
    amount_in_rupees: numAmount,
    amount_paise: Math.round(numAmount * 100),
    currency: 'INR',
    receipt,
    status: 'created',
    demo_mode: true,
    payment_type,
    reference_id: String(reference_id),
    user_id,
    user_email,
    description: description || `RailControl Demo Payment - ${payment_type}`,
    metadata: {
      ...metadata,
      is_demo_gateway: true,
      created_at: new Date().toISOString()
    }
  };
}

module.exports = {
  generateDummyOrderId,
  generateDummyPaymentId,
  generateDummyTransactionId,
  generateDummySignature,
  verifyDummySignature,
  createDummyOrder
};
