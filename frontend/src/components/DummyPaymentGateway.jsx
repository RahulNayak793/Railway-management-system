import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Smartphone,
  CreditCard,
  Building2,
  Wallet as WalletIcon,
  QrCode,
  ArrowRight,
  RefreshCw,
  Info,
  Check
} from 'lucide-react';
import api from '../services/api';

/**
 * Pure JS fallback SHA-256 implementation
 * Guarantees 100% consistent deterministic signature generation across all environments
 */
function sha256Pure(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Compute deterministic demo signature matching backend dummyPaymentService.generateDummySignature
 */
async function computeDemoSignature(orderId, paymentId) {
  const cleanOrder = String(orderId || '').trim();
  const cleanPay = String(paymentId || '').trim();
  const payload = `${cleanOrder}|${cleanPay}|railcontrol_dummy_secure_v2`;
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(payload);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return 'demo_sig_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  return 'demo_sig_' + sha256Pure(payload);
}

const INDIAN_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'Other Banks'
];

const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', badge: 'GPay' },
  { id: 'phonepe', name: 'PhonePe', badge: 'PhonePe' },
  { id: 'paytm', name: 'Paytm', badge: 'Paytm' },
  { id: 'bhim', name: 'BHIM', badge: 'BHIM UPI' }
];

export default function DummyPaymentGateway({
  isOpen,
  onClose,
  paymentType = 'TICKET_BOOKING',
  referenceId,
  amount,
  description,
  preferredMethod = 'upi',
  prefill = {},
  onSuccess,
  onFailure,
  onBeforeOpen,
  buttonText = 'PROCEED TO PAYMENT',
  className = '',
  disabled = false
}) {
  // Modal visibility state (supports controlled or uncontrolled via button)
  const isControlled = isOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const showModal = isControlled ? isOpen : internalOpen;

  // Active Tab: 'upi' | 'card' | 'netbanking' | 'wallet'
  const [activeTab, setActiveTab] = useState(preferredMethod || 'upi');

  // Form Fields
  const [upiId, setUpiId] = useState('passenger@upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [showQrCode, setShowQrCode] = useState(false);

  const [cardNumber, setCardNumber] = useState('4532 8901 2345 6789');
  const [cardHolder, setCardHolder] = useState(prefill?.name || 'Passenger Name');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('321');
  const [saveCard, setSaveCard] = useState(true);

  const [selectedBank, setSelectedBank] = useState('State Bank of India');
  const [selectedWallet, setSelectedWallet] = useState(paymentType === 'WALLET_RECHARGE' ? 'paytm' : 'railwallet');

  // Flow State Machine: 'idle' | 'initializing' | 'step1' | 'step2' | 'step3' | 'success' | 'failed'
  const [flowState, setFlowState] = useState('idle');
  const [flowError, setFlowError] = useState('');
  const [activeOrder, setActiveOrder] = useState(null);
  const [successDetails, setSuccessDetails] = useState(null);

  // Sync preferredMethod when changed
  useEffect(() => {
    if (preferredMethod) {
      if (preferredMethod === 'card' || preferredMethod === 'cards') setActiveTab('card');
      else if (preferredMethod === 'netbanking' || preferredMethod === 'netbank') setActiveTab('netbanking');
      else if (preferredMethod === 'wallet' || preferredMethod === 'railwallet') setActiveTab('wallet');
      else setActiveTab('upi');
    }
  }, [preferredMethod]);

  // Open modal and initialize authoritative order
  const handleStartPayment = async () => {
    if (disabled) return;
    setFlowError('');
    setFlowState('initializing');
    if (!isControlled) setInternalOpen(true);

    try {
      if (typeof onBeforeOpen === 'function') {
        await onBeforeOpen();
      }

      // Create Authoritative Order on Server
      const res = await api.post('/payments/create-order', {
        payment_type: paymentType,
        reference_id: referenceId,
        amount: amount,
        description: description || `RailControl Secure Payment - ${paymentType}`
      });

      if (res.data && res.data.success) {
        setActiveOrder(res.data);
        setFlowState('idle');
      } else {
        throw new Error(res.data?.error || 'Failed to initialize payment order on server');
      }
    } catch (err) {
      console.error('Demo payment initialization failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Payment server connection failed';
      setFlowError(errMsg);
      setFlowState('failed');
      if (typeof onFailure === 'function') {
        onFailure({ message: errMsg });
      }
    }
  };

  const handleClose = () => {
    if (flowState === 'step1' || flowState === 'step2' || flowState === 'step3') return;
    if (isControlled && typeof onClose === 'function') {
      onClose();
    } else {
      setInternalOpen(false);
    }
    setFlowState('idle');
    setFlowError('');
  };

  // Realistic 3-Step Payment Progression
  const handleExecutePayment = async () => {
    if (!activeOrder && !referenceId) {
      setFlowError('No active payment order found.');
      return;
    }

    setFlowError('');
    
    // Step 1: Connecting to Secure Payment Gateway...
    setFlowState('step1');
    await new Promise(r => setTimeout(r, 650));

    // Step 2: Authenticating Payment...
    setFlowState('step2');
    await new Promise(r => setTimeout(r, 750));

    // Step 3: Processing Transaction...
    setFlowState('step3');
    await new Promise(r => setTimeout(r, 700));

    try {
      const orderId = activeOrder?.order_id || activeOrder?.id || `order_demo_RC${Math.floor(100000 + Math.random() * 900000)}`;
      const paymentId = `pay_demo_RC${Math.floor(100000 + Math.random() * 900000)}`;
      const signature = await computeDemoSignature(orderId, paymentId);

      let methodLabel = 'UPI';
      if (activeTab === 'card') methodLabel = 'CREDIT / DEBIT CARD';
      else if (activeTab === 'netbanking') methodLabel = `NET BANKING (${selectedBank})`;
      else if (activeTab === 'wallet') methodLabel = selectedWallet === 'railwallet' ? 'RAIL WALLET' : 'WALLET';

      // Call Backend Authoritative Verification
      const verifyRes = await api.post('/payments/verify', {
        order_id: orderId,
        payment_id: paymentId,
        signature: signature,
        payment_method: methodLabel
      });

      if (verifyRes.data && verifyRes.data.success) {
        const txnId = verifyRes.data.transaction_id || `RC-DEMO-${Math.floor(10000000 + Math.random() * 90000000)}`;
        const details = {
          transactionId: txnId,
          orderId: orderId,
          paymentId: paymentId,
          paymentMethod: methodLabel,
          amount: activeOrder?.amount || amount || 0,
          status: 'SUCCESS',
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          raw: verifyRes.data
        };
        setSuccessDetails(details);
        setFlowState('success');

        if (typeof onSuccess === 'function') {
          onSuccess(verifyRes.data);
        }
      } else {
        throw new Error(verifyRes.data?.error || 'Payment signature verification rejected by server');
      }

    } catch (verErr) {
      console.error('Verification failed:', verErr);
      const errMsg = verErr.response?.data?.error || verErr.message || 'Payment verification failed';
      setFlowError(errMsg);
      setFlowState('failed');
      if (typeof onFailure === 'function') {
        onFailure({ message: errMsg });
      }
    }
  };

  // Simulate Payment Failure
  const handleSimulateFailure = async () => {
    setFlowState('step1');
    await new Promise(r => setTimeout(r, 600));

    try {
      const targetOrderId = activeOrder?.order_id || activeOrder?.id;
      if (targetOrderId) {
        await api.post('/payments/fail', {
          order_id: targetOrderId,
          reason: 'User triggered demo simulated failure',
          payment_type: paymentType,
          reference_id: referenceId
        }).catch(() => {});
      }
    } catch (e) {}

    setFlowError('Your payment was not completed. No money has been charged.');
    setFlowState('failed');
    if (typeof onFailure === 'function') {
      onFailure({ message: 'Simulated payment failure: No money charged.' });
    }
  };

  const displayAmount = activeOrder?.amount ? (activeOrder.amount).toFixed(2) : Number(amount || 0).toFixed(2);

  return (
    <>
      {/* Uncontrolled Launcher Button */}
      {!isControlled && (
        <button
          type="button"
          onClick={handleStartPayment}
          disabled={disabled}
          className={className || 'w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-blue-700 hover:bg-blue-800 text-white transition active:scale-[0.99] flex items-center justify-center space-x-2 shadow cursor-pointer disabled:opacity-50'}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <span>{buttonText}</span>
        </button>
      )}

      {/* Payment Gateway Modal */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto transition-all animate-scale-in">
            
            {/* Header: Official Railway Navy Header */}
            <div className="bg-[#002b49] text-white px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <ShieldCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-base tracking-wide flex items-center space-x-2">
                    <span>RailControl Secure Payment</span>
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    Indian Railways • Secure Online Payment
                  </p>
                </div>
              </div>

              {flowState !== 'step1' && flowState !== 'step2' && flowState !== 'step3' && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Close Modal"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Official CRIS / Railway Secure Payment Banner */}
            <div className="bg-emerald-50/90 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-950 font-semibold">
              <div className="flex items-center space-x-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="font-bold tracking-tight">
                  CRIS • Secure Payment Processing System
                </span>
              </div>
              <span className="hidden sm:inline-flex text-[11px] bg-emerald-200/80 text-emerald-900 px-2.5 py-0.5 rounded-full font-mono font-bold">
                256-bit SSL Encrypted
              </span>
            </div>

            {/* Order & Amount Ribbon */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Transaction Reference
                </span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {referenceId ? `REF: ${referenceId}` : activeOrder?.order_id || 'RC-GATEWAY-INIT'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Amount Payable
                </span>
                <span className="text-xl font-black font-mono text-[#002b49]">
                  ₹{displayAmount}
                </span>
              </div>
            </div>

            {/* Modal Body Based on flowState */}
            <div className="p-6">

              {/* 1. INITIALIZING STATE */}
              {flowState === 'initializing' && (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="h-10 w-10 text-blue-700 animate-spin mx-auto" />
                  <p className="text-sm font-bold text-slate-700">Connecting to RailControl Payment Gateway...</p>
                  <p className="text-xs text-slate-500">Verifying authoritative fare with server...</p>
                </div>
              )}

              {/* 2. REALISTIC STEP 1 / 2 / 3 PROGRESSION */}
              {(flowState === 'step1' || flowState === 'step2' || flowState === 'step3') && (
                <div className="py-10 text-center space-y-6 animate-fade-in">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-75"></div>
                    <div className="relative w-16 h-16 rounded-full bg-blue-50 border-4 border-blue-600 flex items-center justify-center text-blue-700">
                      <RefreshCw className="h-7 w-7 animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-2 max-w-sm mx-auto">
                    <h4 className="text-base font-extrabold text-slate-900">
                      {flowState === 'step1' && 'Connecting to Secure Payment Gateway...'}
                      {flowState === 'step2' && 'Authenticating Payment...'}
                      {flowState === 'step3' && 'Processing Transaction...'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Please do not close or refresh this window while we verify your transaction.
                    </p>
                  </div>

                  {/* Visual Progress Steps */}
                  <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto text-[11px] font-bold">
                    <div className={`p-2 rounded-lg border ${flowState === 'step1' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      1. Gateway
                    </div>
                    <div className={`p-2 rounded-lg border ${flowState === 'step2' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      2. Auth
                    </div>
                    <div className={`p-2 rounded-lg border ${flowState === 'step3' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      3. Confirm
                    </div>
                  </div>
                </div>
              )}

              {/* 3. SUCCESS SCREEN */}
              {flowState === 'success' && successDetails && (
                <div className="py-4 space-y-6 text-center animate-scale-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center border-4 border-emerald-50 shadow-inner">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>

                  <div>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      ✓ Payment Successful
                    </span>
                    <h4 className="text-xl font-black text-slate-900 mt-2">
                      Transaction Completed
                    </h4>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5 text-left font-medium">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Transaction ID:</span>
                      <span className="font-mono font-black text-slate-900">{successDetails.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Payment Method:</span>
                      <span className="font-bold text-slate-800">{successDetails.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Amount:</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">₹{displayAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Status:</span>
                      <span className="font-black text-emerald-700">SUCCESS</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider bg-blue-700 hover:bg-blue-800 text-white transition cursor-pointer shadow-md active:scale-95"
                  >
                    Return to RailControl
                  </button>
                </div>
              )}

              {/* 4. FAILED SCREEN */}
              {flowState === 'failed' && (
                <div className="py-4 space-y-6 text-center animate-scale-in">
                  <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center border-4 border-rose-50 shadow-inner">
                    <AlertCircle className="h-9 w-9" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      Payment Failed
                    </span>
                    <h4 className="text-lg font-black text-slate-900 mt-2">
                      Transaction Incomplete
                    </h4>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto">
                      {flowError || 'Your payment was not completed. No money has been charged.'}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFlowState('idle')}
                      className="flex-1 py-3 rounded-xl font-bold text-xs bg-blue-700 hover:bg-blue-800 text-white transition cursor-pointer shadow"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-xl font-bold text-xs border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* 5. IDLE STATE: PAYMENT METHOD SELECTION & FORMS */}
              {flowState === 'idle' && (
                <div className="space-y-5">
                  
                  {/* Payment Method Tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-200 pb-3">
                    {[
                      { id: 'upi', label: 'UPI / QR', icon: Smartphone },
                      { id: 'card', label: 'Debit / Credit Card', icon: CreditCard },
                      { id: 'netbanking', label: 'Net Banking', icon: Building2 },
                      { id: 'wallet', label: 'Wallet', icon: WalletIcon }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                          activeTab === tab.id
                            ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-blue-700' : 'text-slate-400'}`} />
                        <span className="text-center leading-tight">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* TAB A: UPI / QR */}
                  {activeTab === 'upi' && (
                    <div className="space-y-4">
                      {/* App Quick Select */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {UPI_APPS.map(app => (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => {
                              setSelectedUpiApp(app.id);
                              setUpiId(`passenger@${app.id}`);
                            }}
                            className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                              selectedUpiApp === app.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{app.name}</span>
                          </button>
                        ))}
                      </div>

                      {/* UPI ID Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          Enter Virtual Payment Address (UPI ID)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="passenger@upi"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Example: passenger@okhdfcbank, user@paytm, 9876543210@upi
                        </p>
                      </div>

                      {/* QR Toggle Button */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowQrCode(!showQrCode)}
                          className="w-full py-2 px-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
                        >
                          <QrCode className="h-4 w-4 text-slate-600" />
                          <span>{showQrCode ? 'Hide QR Code' : 'Scan & Pay via UPI QR Code'}</span>
                        </button>

                        {showQrCode && (
                          <div className="mt-3 p-4 rounded-xl bg-slate-100 border border-slate-200 text-center space-y-2 animate-fade-in">
                            <div className="w-36 h-36 mx-auto bg-white p-2 rounded-lg border border-slate-300 flex items-center justify-center shadow-inner">
                              <svg className="w-full h-full text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm8-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm2-2h2v2h-2v-2zm0 4h2v2h-2v-2zM8 8h2v2H8V8zm6 0h2v2h-2V8zM8 14h2v2H8v-2zm0 4h2v2H8v-2z"/>
                              </svg>
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 block">
                              Scan with any UPI App (GPay, PhonePe, Paytm, BHIM)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB B: DEBIT / CREDIT CARD */}
                  {activeTab === 'card' && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Card Details</span>
                        <div className="flex space-x-1.5 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">VISA</span>
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded">Mastercard</span>
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">RuPay</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 block">Card Number</label>
                        <input
                          type="text"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4532 8901 2345 6789"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 block">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          placeholder="Name as printed on card"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600 block">Expiry (MM/YY)</label>
                          <input
                            type="text"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600 block">CVV</label>
                          <input
                            type="password"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="•••"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </div>

                      <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span>Securely save this card for faster railway checkouts</span>
                      </label>
                    </div>
                  )}

                  {/* TAB C: NET BANKING */}
                  {activeTab === 'netbanking' && (
                    <div className="space-y-3.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        Select Your Bank
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {INDIAN_BANKS.slice(0, 6).map(bank => (
                          <button
                            key={bank}
                            type="button"
                            onClick={() => setSelectedBank(bank)}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                              selectedBank === bank
                                ? 'bg-blue-50 border-blue-600 text-blue-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1 pt-1">
                        <label className="text-xs font-semibold text-slate-600 block">Other Banks</label>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          {INDIAN_BANKS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        You will be redirected to the secure demo net banking portal for authorization.
                      </p>
                    </div>
                  )}

                  {/* TAB D: WALLET */}
                  {activeTab === 'wallet' && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-700 block">
                        Choose Wallet
                      </label>
                      <div className="space-y-2">
                        {[
                          ...(paymentType !== 'WALLET_RECHARGE' ? [{ id: 'railwallet', name: 'Rail Wallet', desc: 'IRCTC Fast 1-Click Ticket Booking' }] : []),
                          { id: 'paytm', name: 'Paytm Wallet', desc: 'Pay using linked Paytm balance' },
                          { id: 'phonepe', name: 'PhonePe Wallet', desc: 'Pay using PhonePe Wallet' },
                          { id: 'other', name: 'Other Mobile Wallets', desc: 'Mobikwik, Freecharge, Airtel Money' }
                        ].map(w => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWallet(w.id)}
                            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                              selectedWallet === w.id
                                ? 'bg-blue-50 border-blue-600 text-blue-900 ring-1 ring-blue-600'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div>
                              <span className="font-bold text-xs block">{w.name}</span>
                              <span className="text-[11px] text-slate-500">{w.desc}</span>
                            </div>
                            {selectedWallet === w.id && (
                              <Check className="h-4 w-4 text-blue-700" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary Action Button */}
                  <div className="pt-3 space-y-2">
                    <button
                      type="button"
                      onClick={handleExecutePayment}
                      className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider bg-blue-700 hover:bg-blue-800 text-white transition cursor-pointer shadow-lg shadow-blue-700/20 active:scale-[0.99] flex items-center justify-center space-x-2"
                    >
                      <Lock className="h-4 w-4 text-emerald-300" />
                      <span>Pay ₹{displayAmount}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 text-center">
              <span className="text-[10px] text-slate-500 font-medium flex items-center justify-center space-x-1">
                <Lock className="h-3 w-3 text-slate-400" />
                <span>256-Bit SSL Encrypted • Center for Railway Information Systems (CRIS)</span>
              </span>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}
