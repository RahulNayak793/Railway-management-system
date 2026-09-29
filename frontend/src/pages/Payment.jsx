import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  CreditCard, Wallet, Smartphone, Landmark, ShieldCheck, ArrowRight, 
  CheckCircle2, FileText, Train, Calendar, Clock, User, AlertCircle, 
  Printer, ArrowLeft, RefreshCw, Lock, XCircle, RotateCcw, Banknote,
  Plus, Check, ArrowUpRight, Sparkles, Search, ChevronRight,
  Shield, ExternalLink
} from 'lucide-react';
import api from '../services/api';

const POPULAR_BANKS = [
  { id: 'sbi', name: 'State Bank of India', code: 'SBI', color: 'bg-sky-700 text-white' },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC', color: 'bg-blue-900 text-white' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICICI', color: 'bg-orange-700 text-white' },
  { id: 'axis', name: 'Axis Bank', code: 'AXIS', color: 'bg-rose-800 text-white' },
  { id: 'bob', name: 'Bank of Baroda', code: 'BOB', color: 'bg-amber-700 text-white' },
  { id: 'canara', name: 'Canara Bank', code: 'CANARA', color: 'bg-blue-600 text-white' },
  { id: 'pnb', name: 'Punjab National Bank', code: 'PNB', color: 'bg-red-800 text-white' },
  { id: 'union', name: 'Union Bank of India', code: 'UBI', color: 'bg-indigo-800 text-white' }
];

const ALL_INDIAN_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'Bank of India',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Punjab & Sind Bank',
  'IDBI Bank',
  'Federal Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDFC FIRST Bank',
  'South Indian Bank',
  'RBL Bank',
  'Bandhan Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Karnataka Bank',
  'Tamilnad Mercantile Bank',
  'Standard Chartered Bank',
  'HSBC India',
  'Citibank India',
  'Deutsche Bank'
];

const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', handle: '@okhdfcbank', color: 'hover:border-blue-500 bg-blue-50/40 text-blue-900' },
  { id: 'phonepe', name: 'PhonePe', handle: '@ybl', color: 'hover:border-purple-500 bg-purple-50/40 text-purple-900' },
  { id: 'paytm', name: 'Paytm', handle: '@paytm', color: 'hover:border-sky-500 bg-sky-50/40 text-sky-900' },
  { id: 'bhim', name: 'BHIM UPI', handle: '@upi', color: 'hover:border-amber-500 bg-amber-50/40 text-amber-900' }
];

const formatCardNumber = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const formatCardExpiry = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
};

const isExpiryValid = (expiryStr) => {
  if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiryStr)) return false;
  const [mStr, yStr] = expiryStr.split('/');
  const month = parseInt(mStr, 10);
  const year = 2000 + parseInt(yStr, 10);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
};

const getCardBrand = (numberStr) => {
  const digits = numberStr.replace(/\D/g, '');
  if (/^4/.test(digits)) return { name: 'Visa', badge: 'VISA', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/.test(digits)) return { name: 'Mastercard', badge: 'MASTERCARD', color: 'text-red-700 bg-red-50 border-red-200' };
  if (/^(60|65|81|82|508)/.test(digits)) return { name: 'RuPay', badge: 'RuPay', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (/^3[47]/.test(digits)) return { name: 'American Express', badge: 'AMEX', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' };
  return { name: 'Card', badge: 'CARD', color: 'text-slate-700 bg-slate-100 border-slate-200' };
};

const Payment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const bookingId = searchParams.get('booking_id');
  const amountParam = searchParams.get('amount');
  const initialCancelled = searchParams.get('cancelled') === 'true';

  // Booking & Train Details state
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Payment Selection States: 'upi' | 'card' | 'netbank' | 'railwallet'
  const [paymentMethod, setPaymentMethod] = useState('upi');

  // UPI Form States
  const [upiId, setUpiId] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');

  // Card Form States
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [saveCard, setSaveCard] = useState(true);

  // Net Banking Form States
  const [selectedBank, setSelectedBank] = useState('State Bank of India');
  const [netbankUserId, setNetbankUserId] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [showBankAuthModal, setShowBankAuthModal] = useState(false);
  const [bankAuthStep, setBankAuthStep] = useState('login'); // 'login' | 'otp'
  const [bankOtp, setBankOtp] = useState('');
  const [bankOtpError, setBankOtpError] = useState('');

  // Explicit Payment State Machine: 'idle' | 'processing' | 'success' | 'failed' | 'cancelled'
  const [paymentState, setPaymentState] = useState(initialCancelled ? 'cancelled' : 'idle');
  const [processingStep, setProcessingStep] = useState(1);
  const [payError, setPayError] = useState('');
  const [paidTxnDetails, setPaidTxnDetails] = useState(null);

  // Server-Side Rail Wallet Balance
  const [walletBalance, setWalletBalance] = useState(2500.00);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Rail Wallet Top Up Modal State
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [topUpMethod, setTopUpMethod] = useState('upi');
  const [topUpProcessing, setTopUpProcessing] = useState(false);

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);



  // Fetch Booking Details & Wallet Balance on Component Mount
  const fetchWalletBalance = async () => {
    try {
      const walletRes = await api.get('/payments/wallet');
      if (walletRes.data && walletRes.data.balance !== undefined) {
        setWalletBalance(parseFloat(walletRes.data.balance));
      }
    } catch (wErr) {
      console.warn('Wallet balance fetch fallback:', wErr);
      const savedBal = localStorage.getItem('railway_wallet_balance');
      if (savedBal !== null) setWalletBalance(parseFloat(savedBal));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoadingBooking(true);
      try {
        let foundBooking = null;

        if (bookingId) {
          try {
            const singleRes = await api.get(`/bookings/${bookingId}`);
            if (singleRes.data && (singleRes.data.id || singleRes.data.pnr_number)) {
              foundBooking = singleRes.data;
            }
          } catch (singleErr) {
            console.warn('Single booking direct fetch fallback to list:', singleErr?.message);
          }
        }

        if (!foundBooking) {
          const bookingsRes = await api.get('/bookings');
          const userBookings = Array.isArray(bookingsRes.data)
            ? bookingsRes.data
            : (bookingsRes.data?.data || bookingsRes.data?.bookings || []);
          
          if (bookingId) {
            foundBooking = userBookings.find(b => b.id === bookingId || b.pnr_number === bookingId);
          }
          if (!foundBooking && userBookings.length > 0) {
            foundBooking = userBookings[0];
          }
        }

        if (foundBooking) {
          setBooking(foundBooking);
        } else {
          setFetchError('Booking details could not be retrieved. Please select a valid train reservation.');
        }

        await fetchWalletBalance();

      } catch (err) {
        console.error('Payment page initialization error:', err);
        setFetchError('Failed to load reservation details. ' + (err.response?.data?.error || err.message));
      } finally {
        setLoadingBooking(false);
        setLoadingWallet(false);
      }
    };

    fetchData();
  }, [bookingId]);

  // Compute Customer-Facing Fare Breakdown
  const totalFare = booking?.total_fare ? parseFloat(booking.total_fare) : (parseFloat(amountParam) || 850.00);
  const passengerCount = booking?.allocations?.length || booking?.passengers?.length || 1;
  const convenienceFee = 62.50;
  const cateringCharge = (booking?.catering_included_in_ticket || booking?.train?.catering?.included_in_ticket)
    ? ((booking?.included_catering_value || booking?.train?.catering?.included_value || 280) * passengerCount)
    : 0;
  const baseFare = Math.max(0, totalFare - convenienceFee - cateringCharge);
  const remainingWalletBal = walletBalance - totalFare;

  // Validation Checks
  const rawCardNumber = cardNumber.replace(/\s+/g, '');
  const isCardNameValid = cardName.trim().length >= 2;
  const isCardNumberValid = /^\d{13,19}$/.test(rawCardNumber);
  const isCardExpiryValid = isExpiryValid(cardExpiry);
  const isCardCvvValid = /^\d{3,4}$/.test(cardCvv.trim());
  const isCardFormValid = isCardNameValid && isCardNumberValid && isCardExpiryValid && isCardCvvValid;
  const cardBrand = getCardBrand(cardNumber);

  const isUpiValid = upiId.trim().length >= 3 && upiId.includes('@');
  const isNetBankFormValid = selectedBank.trim() !== '' && netbankUserId.trim().length >= 3;

  const validateCurrentForm = () => {
    if (paymentMethod === 'upi') {
      if (!isUpiValid) {
        setPayError('Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).');
        return false;
      }
    } else if (paymentMethod === 'card') {
      if (!isCardNumberValid) {
        setPayError('Please enter a valid 16-digit debit or credit card number.');
        return false;
      }
      if (!isCardNameValid) {
        setPayError('Please enter the cardholder name as printed on the card.');
        return false;
      }
      if (!isCardExpiryValid) {
        setPayError('Please enter a valid expiry date (MM/YY) in the future.');
        return false;
      }
      if (!isCardCvvValid) {
        setPayError('Please enter a valid 3 or 4 digit CVV number.');
        return false;
      }
    } else if (paymentMethod === 'netbank') {
      if (!isNetBankFormValid) {
        setPayError('Please enter your Net Banking Customer ID / User ID.');
        return false;
      }
    } else if (paymentMethod === 'railwallet') {
      if (walletBalance < totalFare) {
        setPayError(`Insufficient Rail Wallet balance! Required: ₹${totalFare.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}.`);
        return false;
      }
    }
    return true;
  };

  // Quick Demo Card Pre-filler
  const handleFillTestCard = (type = 'rupay') => {
    if (type === 'rupay') {
      setCardNumber('6072 1234 5678 9012');
      setCardName('Rahul Kumar');
      setCardExpiry('08/29');
      setCardCvv('789');
    } else {
      setCardNumber('4111 1111 1111 1111');
      setCardName('Rahul Kumar');
      setCardExpiry('12/28');
      setCardCvv('123');
    }
    setPayError('');
  };

  // Quick UPI App handle selector
  const handleSelectUpiApp = (app) => {
    setSelectedUpiApp(app.id);
    const prefix = upiId.includes('@') ? upiId.split('@')[0] : (upiId || 'passenger');
    setUpiId(`${prefix}${app.handle}`);
    setPayError('');
  };

  // Top Up Handler
  const handleTopUpSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) return;

    setTopUpProcessing(true);
    try {
      const res = await api.post('/payments/wallet/topup', {
        amount: amt,
        payment_method: topUpMethod.toUpperCase()
      });

      if (res.data?.balance !== undefined) {
        setWalletBalance(parseFloat(res.data.balance));
      } else {
        await fetchWalletBalance();
      }
      setShowTopUpModal(false);
      setPayError('');
    } catch (err) {
      console.error('Top-Up error:', err);
      setPayError('Top-Up failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setTopUpProcessing(false);
    }
  };

  // Central Payment Execution Handler
  const executePayment = async () => {
    setPayError('');
    setPaymentState('processing');
    setProcessingStep(1);

    const targetBookingId = booking?.id || bookingId;
    if (!targetBookingId) {
      setPayError('No active booking reference found to process payment.');
      setPaymentState('failed');
      return;
    }

    let currentStep = 1;
    const stepInterval = setInterval(() => {
      currentStep += 1;
      if (currentStep <= 5) {
        setProcessingStep(currentStep);
      } else {
        clearInterval(stepInterval);
      }
    }, 320);

    try {
      let responseData = null;

      if (paymentMethod === 'railwallet') {
        const walletRes = await api.post('/payments/wallet/pay', {
          booking_id: targetBookingId
        });
        responseData = walletRes.data;
        if (walletRes.data?.wallet_balance !== undefined) {
          setWalletBalance(parseFloat(walletRes.data.wallet_balance));
        }

      } else if (paymentMethod === 'card') {
        const checkoutRes = await api.post('/payments/checkout', {
          booking_id: targetBookingId,
          amount: totalFare,
          payment_method: 'CARD',
          card_details: {
            cardholder_name: cardName.trim(),
            card_number: rawCardNumber,
            card_expiry: cardExpiry.trim(),
            card_cvv: cardCvv.trim()
          }
        });
        responseData = checkoutRes.data;

      } else if (paymentMethod === 'netbank') {
        const checkoutRes = await api.post('/payments/checkout', {
          booking_id: targetBookingId,
          amount: totalFare,
          payment_method: 'NETBANK',
          netbanking_details: {
            bank_name: selectedBank,
            user_id: netbankUserId.trim()
          }
        });
        responseData = checkoutRes.data;

      } else if (paymentMethod === 'upi') {
        const checkoutRes = await api.post('/payments/checkout', {
          booking_id: targetBookingId,
          amount: totalFare,
          payment_method: 'UPI',
          upi_id: upiId.trim()
        });
        responseData = checkoutRes.data;
      }

      setTimeout(() => {
        clearInterval(stepInterval);
        setProcessingStep(5);

        const paymentData = responseData?.payment || {};
        const updatedBooking = responseData?.booking || booking || {};
        const pnrNumber = updatedBooking.pnr_number || booking?.pnr_number || '2345678901';
        const finalStatus = (updatedBooking.status || booking?.status || 'confirmed').toUpperCase();

        let seatText = 'Confirmed Berth / Seat Allocated (Chart Finalized)';
        const allocs = updatedBooking.allocations || booking?.allocations || [];
        if (allocs.length > 0) {
          const seatsList = allocs.map((a, i) => 
            a.seat_id || a.coach_number ? `Coach ${a.coach_number || 'B1'} / Seat ${a.seat_number || i + 1} (${a.berth_type || 'Berth'})` : null
          ).filter(Boolean);
          if (seatsList.length > 0) seatText = seatsList.join(', ');
        }

        setBooking(updatedBooking);

        let methodText = 'Online Payment';
        if (paymentMethod === 'railwallet') {
          methodText = 'Rail Wallet';
        } else if (paymentMethod === 'card') {
          methodText = `${cardBrand.name} Card (•••• ${rawCardNumber.slice(-4)})`;
        } else if (paymentMethod === 'netbank') {
          methodText = `Net Banking (${selectedBank})`;
        } else if (paymentMethod === 'upi') {
          methodText = `UPI (${upiId || 'VPA'})`;
        }

        setPaidTxnDetails({
          txnId: paymentData.payment_gateway_id || paymentData.transaction_id || `RC-${Math.floor(10000000 + Math.random() * 90000000)}`,
          bookingId: targetBookingId,
          pnr: pnrNumber,
          amount: totalFare,
          status: 'PAID',
          bookingStatus: finalStatus,
          seatText,
          method: methodText,
          walletBefore: responseData?.wallet_balance_before !== undefined ? responseData.wallet_balance_before : (walletBalance + totalFare),
          walletAfter: responseData?.wallet_balance_after !== undefined ? responseData.wallet_balance_after : walletBalance,
          date: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        });

        setPaymentState('success');
      }, 900);

    } catch (err) {
      clearInterval(stepInterval);
      console.error('Payment submit error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Payment processing failed. Please try again.';
      setPayError(errMsg);
      setPaymentState('failed');
    }
  };

  // Trigger Pay Action
  const handlePayClick = (e) => {
    if (e) e.preventDefault();
    if (paymentState === 'processing') return;

    if (!validateCurrentForm()) return;

    if (paymentMethod === 'netbank') {
      setBankAuthStep('login');
      setBankOtp('482910');
      setShowBankAuthModal(true);
      return;
    }

    executePayment();
  };

  // Filtered Banks for search
  const filteredBanks = ALL_INDIAN_BANKS.filter(b => 
    b.toLowerCase().includes(bankSearchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* 4-Step Professional Checkout Header Indicator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-extrabold">
          <div className="flex flex-col items-center sm:flex-row sm:justify-center space-x-1.5 text-emerald-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">✓</span>
            <span className="hidden sm:inline">Train & Date</span>
          </div>
          <div className="flex flex-col items-center sm:flex-row sm:justify-center space-x-1.5 text-emerald-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">✓</span>
            <span className="hidden sm:inline">Passenger Details</span>
          </div>
          <div className="flex flex-col items-center sm:flex-row sm:justify-center space-x-1.5 text-blue-900 bg-blue-50/80 py-1.5 rounded-xl border border-blue-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-white text-[11px] font-black">3</span>
            <span className="font-black">Payment</span>
          </div>
          <div className="flex flex-col items-center sm:flex-row sm:justify-center space-x-1.5 text-slate-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black">4</span>
            <span className="hidden sm:inline">Confirmation</span>
          </div>
        </div>
      </div>

      {/* Page Title & Security Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Railway Ticket Checkout</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Complete payment to confirm your passenger reservation and generate official ticket PNR.
          </p>
        </div>

        {/* 256-Bit SSL Secured Railway Checkout Badge */}
        <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 w-fit">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>256-Bit SSL Secured Railway Checkout</span>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Responsive Layout: Desktop 2-Cols / Mobile Stacked Cards */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        
        {/* Right Sidebar: Journey & Customer-Facing Fare Summary */}
        <div className="lg:col-span-1 lg:order-2 space-y-4">
          
          {/* Journey Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="bg-[#002b49] px-5 py-3 text-white flex justify-between items-center">
              <span className="font-mono font-extrabold text-xs tracking-wider uppercase">JOURNEY SUMMARY</span>
              <span className="text-[10px] font-mono font-bold bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-md border border-white/15">
                PNR: {booking?.pnr_number || 'Generated on Pay'}
              </span>
            </div>

            <div className="p-5 space-y-3.5 text-xs font-sans">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Train</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {booking?.train?.train_name || booking?.train_name || 'Mumbai Rajdhani Express'} (#{booking?.train?.train_number || booking?.train_number || '12952'})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">From Origin</span>
                  <span className="font-bold text-slate-800">{booking?.train?.source || booking?.source || 'UD — Udupi'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">To Destination</span>
                  <span className="font-bold text-slate-800">{booking?.train?.destination || booking?.destination || 'NDLS — New Delhi'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Journey Date</span>
                  <span className="font-extrabold text-blue-900 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-blue-700" />
                    {booking?.travel_date || new Date().toISOString().split('T')[0]}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class & Quota</span>
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>{booking?.coach_class || '3A'} • {booking?.quota === 'TATKAL' ? 'Tatkal Quota' : 'General Quota'}</span>
                    {booking?.quota === 'TATKAL' && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[9px]">
                        TATKAL
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passenger Manifest</span>
                <span className="font-bold text-slate-800">
                  {booking?.allocations?.[0]?.passenger_name || booking?.passengers?.[0]?.name || 'Rahul Kumar'} ({passengerCount} {passengerCount === 1 ? 'Passenger' : 'Passengers'})
                </span>
              </div>
            </div>
          </div>

          {/* Included Food / Catering Card */}
          {(booking?.catering_included_in_ticket || booking?.train?.catering?.included_in_ticket) && (
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 space-y-2 shadow-xs text-xs">
              <div className="flex items-center justify-between border-b border-cyan-200/80 pb-2">
                <span className="font-extrabold text-cyan-950 text-xs flex items-center space-x-1.5">
                  <span>🍱</span>
                  <span>CATERING INCLUDED</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-100 text-cyan-800 border border-cyan-300">
                  Included
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 leading-tight">
                Complimentary on-board dining meals are included in your ticket fare for this class.
              </p>
            </div>
          )}

          {/* Customer-Facing Fare Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="bg-[#002b49] px-5 py-3 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-xs tracking-wider uppercase font-mono">FARE SUMMARY</h3>
              {booking?.quota === 'TATKAL' && (
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] uppercase">
                  TATKAL
                </span>
              )}
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Ticket Fare</span>
                <span className="font-mono font-bold text-slate-900">₹{baseFare.toFixed(2)}</span>
              </div>
              {(booking?.tatkal_charge > 0 || booking?.quota === 'TATKAL') && (
                <div className="flex justify-between text-amber-900 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200 font-semibold">
                  <span>Tatkal Quota Surcharge</span>
                  <span className="font-mono font-bold text-amber-900">
                    ₹{(booking?.tatkal_charge || (['1A', 'EC'].includes(booking?.coach_class) ? 500 : ['2A'].includes(booking?.coach_class) ? 400 : ['3A', '3E', 'CC'].includes(booking?.coach_class) ? 300 : ['SL'].includes(booking?.coach_class) ? 100 : 15) * passengerCount).toFixed(2)}
                  </span>
                </div>
              )}
              {cateringCharge > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Catering / Food Charge</span>
                  <span className="font-mono font-bold text-slate-900">₹{cateringCharge.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Convenience / Reservation Fee</span>
                <span className="font-mono font-bold text-slate-900">₹{convenienceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Applicable Taxes & GST</span>
                <span className="font-mono font-bold text-emerald-700">₹0.00 (Included)</span>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-slate-900">
                <span className="font-black text-sm">Total Amount</span>
                <span className="text-xl font-black text-blue-950 font-mono">₹{totalFare.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-start space-x-2 text-xs">
            <Shield className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block">Railway Security Assurance</span>
              <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                Official Indian Railway ticketing checkout. Your transaction is verified directly with the central passenger reservation engine.
              </p>
            </div>
          </div>
        </div>

        {/* Left Column (2 Cols): Payment Method Selector & Interactive Forms */}
        <div className="lg:col-span-2 lg:order-1 space-y-6">
          
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
              Select Payment Method
            </h2>

            {/* 4 Core Payment Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'upi', label: 'UPI', icon: Smartphone, desc: 'GPay, PhonePe, BHIM' },
                { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, RuPay, MC' },
                { id: 'netbank', label: 'Net Banking', icon: Landmark, desc: 'All Major Banks' },
                { id: 'railwallet', label: 'Rail Wallet', icon: Wallet, desc: 'Instant 1-Click Pay' }
              ].map(tab => {
                const Icon = tab.icon;
                const active = paymentMethod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={paymentState === 'processing'}
                    onClick={() => {
                      setPaymentMethod(tab.id);
                      setPayError('');
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl p-3.5 border text-center transition-all cursor-pointer ${
                      active 
                        ? 'border-blue-700 bg-blue-50/70 text-blue-950 font-black shadow-xs ring-2 ring-blue-600/20' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-1.5 ${active ? 'text-blue-700' : 'text-slate-500'}`} />
                    <span className="text-xs font-black">{tab.label}</span>
                    <span className="text-[10px] text-slate-400 font-normal mt-0.5">{tab.desc}</span>
                  </button>
                );
              })}
            </div>

            {payError && paymentState !== 'failed' && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            {/* TAB CONTENT: 1. UPI */}
            {paymentMethod === 'upi' && (
              <div className="space-y-5 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200/80 pb-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">UPI / Unified Payments Interface</h3>
                  <p className="text-[11px] text-slate-500">Pay using your UPI app (Google Pay, PhonePe, Paytm, BHIM) or enter your UPI ID.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Quick Select UPI Provider
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {UPI_APPS.map(app => (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => handleSelectUpiApp(app)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                            selectedUpiApp === app.id ? 'border-blue-700 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20 font-black' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{app.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Enter UPI ID / VPA <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. name@okhdfcbank or 9876543210@paytm"
                        value={upiId}
                        onChange={(e) => {
                          setUpiId(e.target.value);
                          setPayError('');
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                      {upiId.includes('@') && upiId.length >= 4 && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Valid UPI</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                      Example: rahul@okhdfcbank, username@upi, 9876543210@paytm
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePayClick}
                    disabled={paymentState === 'processing'}
                    className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider bg-[#002b49] hover:bg-blue-900 text-white transition cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Pay ₹{totalFare.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. CREDIT / DEBIT CARD */}
            {paymentMethod === 'card' && (
              <div className="space-y-5 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Credit / Debit Card</h3>
                    <p className="text-[11px] text-slate-500">All major Indian cards supported (RuPay, Visa, Mastercard, Maestro).</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black border uppercase ${cardBrand.color}`}>
                    {cardBrand.badge}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Quick-fill pills for testing */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Fill Test Card:</span>
                    <button
                      type="button"
                      onClick={() => handleFillTestCard('rupay')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] hover:bg-emerald-100 transition cursor-pointer"
                    >
                      RuPay Test Card
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillTestCard('visa')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px] hover:bg-blue-100 transition cursor-pointer"
                    >
                      Visa Test Card
                    </button>
                  </div>

                  {/* Card Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Card Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="•••• •••• •••• ••••"
                        value={cardNumber}
                        onChange={(e) => {
                          setCardNumber(formatCardNumber(e.target.value));
                          setPayError('');
                        }}
                        maxLength="23"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                      <CreditCard className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Cardholder Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Cardholder Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Name as printed on card"
                      value={cardName}
                      onChange={(e) => {
                        setCardName(e.target.value);
                        setPayError('');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  {/* Expiry & CVV Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Valid Thru (MM/YY) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          setCardExpiry(formatCardExpiry(e.target.value));
                          setPayError('');
                        }}
                        maxLength="5"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        CVV / CVC <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          placeholder="•••"
                          value={cardCvv}
                          onChange={(e) => {
                            setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setPayError('');
                          }}
                          maxLength="4"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                        />
                        <Lock className="absolute right-3.5 top-3.5 h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Save Card Checkbox */}
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>Save card securely as per RBI tokenization guidelines</span>
                  </label>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handlePayClick}
                    disabled={paymentState === 'processing'}
                    className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider bg-[#002b49] hover:bg-blue-900 text-white transition cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Pay ₹{totalFare.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. NET BANKING */}
            {paymentMethod === 'netbank' && (
              <div className="space-y-5 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200/80 pb-3">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Net Banking</h3>
                  <p className="text-[11px] text-slate-500">Authenticate through your bank's secure retail internet banking portal.</p>
                </div>

                <div className="space-y-4">
                  {/* Popular Banks Grid */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Popular Indian Banks
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {POPULAR_BANKS.map(bank => {
                        const isSelected = selectedBank === bank.name;
                        return (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => {
                              setSelectedBank(bank.name);
                              setPayError('');
                            }}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between h-16 ${
                              isSelected 
                                ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-600/20 shadow-xs' 
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded w-fit uppercase ${bank.color}`}>
                              {bank.code}
                            </span>
                            <span className="text-[11px] font-bold text-slate-900 leading-tight">
                              {bank.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* All Other Banks Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Or Select from All Banks
                    </label>
                    <select
                      value={selectedBank}
                      onChange={(e) => {
                        setSelectedBank(e.target.value);
                        setPayError('');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      {ALL_INDIAN_BANKS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Customer ID / Login ID */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Customer ID / User ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10928374 or username"
                      value={netbankUserId}
                      onChange={(e) => {
                        setNetbankUserId(e.target.value);
                        setPayError('');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handlePayClick}
                    disabled={paymentState === 'processing'}
                    className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider bg-[#002b49] hover:bg-blue-900 text-white transition cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center space-x-2"
                  >
                    <span>Proceed to {selectedBank} • Pay ₹{totalFare.toFixed(2)}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. RAIL WALLET */}
            {paymentMethod === 'railwallet' && (
              <div className="space-y-4 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between border-b border-emerald-200/70 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase text-emerald-950 tracking-wider">Rail Wallet</h3>
                    <p className="text-[11px] text-emerald-800">Prepaid balance with instant 1-click booking authorization.</p>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                    Zero Convenience Fee
                  </span>
                </div>

                {/* Balance Breakdown */}
                <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2.5 text-xs font-sans">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Available Balance:</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">₹{walletBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Amount Payable:</span>
                    <span className="font-mono font-bold text-slate-900">₹{totalFare.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex justify-between items-center font-bold">
                    <span className="text-slate-800">Balance After Payment:</span>
                    <span className={`font-mono text-sm ${remainingWalletBal >= 0 ? 'text-emerald-700 font-black' : 'text-rose-600 font-black'}`}>
                      ₹{remainingWalletBal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {walletBalance >= totalFare ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-100/70 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Sufficient balance available in Rail Wallet.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePayClick}
                      disabled={paymentState === 'processing'}
                      className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center space-x-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Pay ₹{totalFare.toFixed(2)} from Rail Wallet</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                    <div className="flex items-center space-x-2 text-rose-800 font-bold">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Insufficient Rail Wallet Balance</span>
                    </div>
                    <p className="text-[11px] text-rose-700">
                      Available: ₹{walletBalance.toFixed(2)} | Required: ₹{totalFare.toFixed(2)}. Please add money to top up your balance or choose another payment method.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTopUpModal(true)}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Money to Rail Wallet</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIMULATED NET BANKING PORTAL MODAL */}
      {showBankAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden space-y-0 animate-scale-in">
            {/* Bank Header Bar */}
            <div className="bg-[#002b49] p-5 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase bg-white/10 px-2 py-0.5 rounded">
                  RETAIL INTERNET BANKING
                </span>
                <h3 className="text-base font-black mt-1">{selectedBank}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBankAuthModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs font-sans">
              {/* Transaction Context */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-700 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Merchant</span>
                  <span className="font-bold text-slate-900">IRCTC / RailControl Ticketing</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Reference PNR</span>
                  <span className="font-mono font-black text-blue-900">{booking?.pnr_number || '2345678901'}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm">
                  <span className="font-bold text-slate-900">Payable Amount</span>
                  <span className="font-mono font-black text-blue-950">₹{totalFare.toFixed(2)}</span>
                </div>
              </div>

              {bankAuthStep === 'login' ? (
                /* Step 1: User Login */
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      User ID / Customer ID
                    </label>
                    <input
                      type="text"
                      value={netbankUserId || 'user_102938'}
                      onChange={(e) => setNetbankUserId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Internet Banking Password
                    </label>
                    <input
                      type="password"
                      defaultValue="bankpassword123"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 bg-slate-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Simulated test authentication credentials</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setBankAuthStep('otp')}
                      className="flex-1 py-3 bg-[#002b49] hover:bg-blue-900 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      Authenticate & Proceed to OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBankAuthModal(false)}
                      className="px-4 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2: High Security OTP Screen */
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <Lock className="h-6 w-6 text-blue-700 mx-auto" />
                    <h4 className="font-extrabold text-slate-900 text-sm">One-Time Password (OTP) Verification</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      A 6-digit OTP has been sent to your registered mobile number ending with <strong>••••8921</strong>.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Enter 6-Digit OTP</label>
                      <button
                        type="button"
                        onClick={() => setBankOtp('482910')}
                        className="text-[10px] font-black text-blue-700 hover:underline cursor-pointer"
                      >
                        Auto-fill Test OTP: 482910
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="482910"
                      value={bankOtp}
                      onChange={(e) => setBankOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength="6"
                      className="w-full text-center tracking-widest font-mono text-lg font-black rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBankAuthModal(false);
                        executePayment();
                      }}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                    >
                      Verify & Authorize ₹{totalFare.toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBankAuthStep('login')}
                      className="px-4 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOP-UP RAIL WALLET MODAL */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-slate-100 space-y-5 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">Add Money to Rail Wallet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Select Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {['500', '1000', '2000', '3000', '5000'].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                        topUpAmount === amt 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 font-black' 
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Or enter custom amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="mt-2.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'upi', label: 'UPI' },
                    { id: 'card', label: 'Card' },
                    { id: 'netbank', label: 'Net Banking' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTopUpMethod(m.id)}
                      className={`py-2 rounded-xl font-bold border text-center transition cursor-pointer ${
                        topUpMethod === m.id 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 font-black' 
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={topUpProcessing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {topUpProcessing ? (
                    <span className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Updating Wallet...</span>
                    </span>
                  ) : (
                    <span>Add ₹{parseFloat(topUpAmount || 0).toFixed(2)} to Rail Wallet</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP-BY-STEP PAYMENT PROCESSING SCREEN */}
      {paymentState === 'processing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-100 text-center space-y-6 animate-scale-in">
            
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <Lock className="h-8 w-8 text-blue-700" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900">Processing Payment...</h2>
              <p className="text-xs text-slate-500 font-medium">Communicating with the Indian Railways reservation engine. Please do not refresh.</p>
            </div>

            {/* Step-by-step Visual Progress Sequence */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-3 text-xs font-semibold">
              {[
                { step: 1, label: 'Authorizing payment transaction...' },
                { step: 2, label: 'Verifying payment status...' },
                { step: 3, label: 'Confirming reservation with central railways...' },
                { step: 4, label: 'Allocating coach & berth numbers...' },
                { step: 5, label: 'Generating official PNR & E-Ticket...' }
              ].map((item) => {
                const isCompleted = processingStep > item.step;
                const isCurrent = processingStep === item.step;
                return (
                  <div key={item.step} className="flex items-center space-x-3">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw className="h-4 w-4 text-blue-700 animate-spin shrink-0" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={isCompleted ? 'text-emerald-700 font-bold' : isCurrent ? 'text-blue-900 font-black' : 'text-slate-400'}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              🔒 256-Bit Bank-Grade Encrypted Session
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SUCCESS SCREEN MODAL */}
      {paymentState === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-slate-100 text-center space-y-6 animate-scale-in">
            
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-emerald-700 flex items-center justify-center gap-1.5">
                <span>✓</span> Payment Successful
              </h2>
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1 rounded-full text-xs font-black">
                <span>✓</span> Booking Confirmed
              </div>
              <p className="text-base font-black font-mono text-slate-900 pt-1">
                PNR: {paidTxnDetails?.pnr}
              </p>
            </div>

            {/* Official Payment Receipt Table */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 text-xs font-sans">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Payment Status</span>
                <span className="font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  {paidTxnDetails?.status || 'PAID'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Payment Method</span>
                <span className="font-bold text-slate-800">{paidTxnDetails?.method}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Amount Paid</span>
                <span className="font-black font-mono text-emerald-700 text-sm">₹{parseFloat(paidTxnDetails?.amount || totalFare).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Transaction ID</span>
                <span className="font-mono font-extrabold text-slate-800">{paidTxnDetails?.txnId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">PNR Reference</span>
                <span className="font-mono font-black text-blue-900">{paidTxnDetails?.pnr}</span>
              </div>
              {paidTxnDetails?.seatText && (
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Allocated Berth</span>
                  <span className="font-bold text-slate-800 text-right">{paidTxnDetails.seatText}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Date & Time</span>
                <span className="font-semibold text-slate-600 text-[11px]">{paidTxnDetails?.date}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => navigate(`/passenger/ticket/${paidTxnDetails?.pnr}?success=true`)}
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-extrabold shadow-md active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>View & Download E-Ticket</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/passenger/history')}
                  className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Go to My Bookings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT MODAL */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-slate-100 space-y-6 animate-scale-in">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  OFFICIAL RAILWAY PAYMENT RECEIPT
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">RailControl Payment Acknowledgment</h2>
                <p className="text-xs text-slate-400 font-mono">Ministry of Railways • Center for Railway Information Systems</p>
              </div>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs font-sans">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Transaction ID</span>
                <span className="font-mono font-black text-slate-900">{paidTxnDetails?.txnId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">PNR Reference</span>
                <span className="font-mono font-black text-blue-900">{paidTxnDetails?.pnr}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Train Details</span>
                <span className="font-bold text-slate-800">
                  {booking?.train?.train_name || booking?.train_name || 'Mumbai Rajdhani Express'} (#{booking?.train?.train_number || booking?.train_number || '12952'})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Payment Method</span>
                <span className="font-semibold text-slate-700">{paidTxnDetails?.method}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Total Amount</span>
                <span className="font-mono font-black text-emerald-700 text-base">₹{parseFloat(paidTxnDetails?.amount || totalFare).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Payment Status</span>
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  PAID
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Date & Time</span>
                <span className="font-mono text-slate-600">{paidTxnDetails?.date}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-[#002b49] hover:bg-blue-900 text-white rounded-xl text-xs font-extrabold shadow transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official Receipt</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT FAILED SCREEN MODAL */}
      {paymentState === 'failed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-slate-100 text-center space-y-6 animate-scale-in">
            
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <XCircle className="h-12 w-12 text-rose-600" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">Payment Failed</h2>
              <p className="text-xs text-slate-500 font-medium">Your transaction could not be authorized by your bank.</p>
            </div>

            {/* Failure Error Details */}
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200 text-left space-y-1.5 text-xs text-rose-800">
              <div className="flex justify-between items-center text-[10px] font-bold text-rose-600 uppercase">
                <span>Reason</span>
                <span className="font-mono">REF: TXN-ERR-{Math.floor(100000 + Math.random() * 900000)}</span>
              </div>
              <p className="font-semibold leading-relaxed">{payError || 'Transaction timed out or declined by issuing bank.'}</p>
            </div>

            {/* Failure Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPaymentState('idle');
                  setPayError('');
                }}
                className="w-full py-3.5 bg-[#002b49] hover:bg-blue-900 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry Payment</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentState('idle');
                    setPayError('');
                  }}
                  className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Change Method
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/passenger/search')}
                  className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Back to Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payment;
