const express = require('express');
const router = express.Router();
const { isMockMode, mockDb } = require('../config/supabase');

// 1. Train Recommendations
router.get('/recommendations', async (req, res) => {
  const { source, destination, history } = req.query;

  if (source && destination && source.trim().toUpperCase() === destination.trim().toUpperCase()) {
    return res.json({
      recommendedTrains: [],
      insights: 'Source and destination stations cannot be the same.'
    });
  }

  // Let's analyze query parameters and return a smart recommended itinerary list
  const recommendations = [
    {
      train_number: '12952',
      train_name: 'Rajdhani Express',
      reason: 'Fastest transit time (15h 45m) and highest comfort class availability.',
      matchScore: 95
    },
    {
      train_number: '12002',
      train_name: 'Shatabdi Express',
      reason: 'Most cost-effective day journey option with complimentary catering.',
      matchScore: 88
    }
  ];

  return res.json({
    recommendedTrains: recommendations,
    insights: 'Based on passenger search trends, morning slot booking has a 12% higher chance of berth upgrade promotion.'
  });
});

// 2. Train Delay Prediction
router.post('/predict-delay', async (req, res) => {
  const { train_number, travel_date } = req.body;

  if (!train_number) {
    return res.status(400).json({ error: 'train_number is required' });
  }

  // Smart delay prediction algorithm simulation
  let predictedDelayMinutes = 0;
  let riskLevel = 'Low';
  let reasoning = 'Weather is clear, track maintenance sequence is completed.';

  if (train_number === '12002') {
    predictedDelayMinutes = 18;
    riskLevel = 'Medium';
    reasoning = 'Historically delayed due to congestion on Agra-Jhansi division in the morning slot.';
  } else if (train_number === '12301') {
    predictedDelayMinutes = 45;
    riskLevel = 'High';
    reasoning = 'Heavy monsoon warning in the Eastern corridor may impact schedule operations.';
  }

  return res.json({
    train_number,
    travel_date,
    predictedDelayMinutes,
    riskLevel,
    reasoning,
    onTimeProbability: Math.round(100 - (predictedDelayMinutes / 60) * 100)
  });
});

// 3. AI Ticket Confirmation Probability Predictor
router.post('/predict-confirmation', async (req, res) => {
  const { pnr, current_status, travel_class, quota, travel_date } = req.body;

  let probabilityPercent = 95;
  let statusLevel = 'High';
  let recommendation = 'High probability of confirmation before chart preparation.';

  const statusStr = (current_status || '').toUpperCase();

  if (statusStr.includes('RAC')) {
    probabilityPercent = 92;
    statusLevel = 'High';
    recommendation = 'RAC seats are almost guaranteed to convert to full confirmed berths during final chart preparation.';
  } else if (statusStr.includes('W/L') || statusStr.includes('WAITING') || statusStr.includes('WL')) {
    const numMatch = statusStr.match(/\d+/);
    const wlNumber = numMatch ? parseInt(numMatch[0]) : 15;

    if (wlNumber <= 5) {
      probabilityPercent = 89;
      statusLevel = 'High';
      recommendation = 'Low waitlist number. High chance of berth allocation as cancellation trends peak 24 hours before travel.';
    } else if (wlNumber <= 15) {
      probabilityPercent = 74;
      statusLevel = 'Medium';
      recommendation = 'Moderate waitlist number. We recommend monitoring cancellation trends or booking an alternative Tatkal ticket as backup.';
    } else if (wlNumber <= 30) {
      probabilityPercent = 48;
      statusLevel = 'Medium';
      recommendation = 'Consider booking Tatkal quota or alternative train 12951 running on the same corridor.';
    } else {
      probabilityPercent = 22;
      statusLevel = 'Low';
      recommendation = 'Low confirmation likelihood. Please consider booking an alternative train or Vande Bharat Express.';
    }
  }

  return res.json({
    pnr: pnr || '6543210987',
    current_status: current_status || 'W/L 12',
    probabilityPercent,
    statusLevel,
    recommendation,
    historicalTrends: [
      { daysBefore: 7, probability: Math.max(10, probabilityPercent - 25) },
      { daysBefore: 3, probability: Math.max(20, probabilityPercent - 12) },
      { daysBefore: 1, probability: probabilityPercent },
      { daysBefore: 0, probability: Math.min(99, probabilityPercent + 5) }
    ]
  });
});

// 3. Chatbot Support
router.post('/chatbot', async (req, res) => {
  const { message, pnr, session_history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message content is required' });
  }

  const query = message.toLowerCase();
  let reply = '';
  let intent = 'general';
  let quickActions = [];

  // PNR 10-digit pattern recognition
  const pnrMatch = message.match(/\b\d{10}\b/);

  if (pnrMatch || query.includes('pnr') || query.includes('ticket status') || query.includes('check status')) {
    intent = 'pnr_check';
    const searchedPnr = pnrMatch ? pnrMatch[0] : (pnr || '2345678901');
    reply = `🤖 **PNR Status Lookup for ${searchedPnr}**:\n• Train: 12952 Rajdhani Express\n• Route: New Delhi (NDLS) → Mumbai Central (MMCT)\n• Status: **CONFIRMED (CNF)**\n• Coach: **B1**, Seat: **24 (Lower Berth)**\n\nWould you like to pre-order meals for your seat or view your full E-Ticket?`;
    quickActions = [
      { label: 'View E-Ticket', route: `/passenger/ticket/${searchedPnr}` },
      { label: 'Order Seat Meals', route: `/passenger/catering?pnr=${searchedPnr}` }
    ];
  } else if (query.includes('emergency') || query.includes('sos') || query.includes('medical') || query.includes('police') || query.includes('rpf') || query.includes('security')) {
    intent = 'emergency_sos';
    reply = "🚨 **EMERGENCY SOS ASSISTANCE**:\nIf you or a co-passenger need immediate medical aid, RPF security protection, or onboard maintenance, tap below to broadcast an instant 1-Click SOS Alert to the Train Superintendent & Control Room.";
    quickActions = [
      { label: 'Broadcast SOS Alert', action: 'trigger_sos' }
    ];
  } else if (query.includes('food') || query.includes('meal') || query.includes('catering') || query.includes('dinner') || query.includes('lunch') || query.includes('breakfast')) {
    intent = 'catering';
    reply = "🍱 **E-Catering Seat Delivery**:\nYou can order hot Veg Thalis, Jain meals, Biryani, and beverages delivered straight to your train berth at upcoming stations (New Delhi, Jaipur, Mumbai Central).";
    quickActions = [
      { label: 'Order Food Now', route: '/passenger/catering' }
    ];
  } else if (query.includes('status') || query.includes('track') || query.includes('where is') || query.includes('delay') || query.includes('late')) {
    intent = 'tracking';
    reply = "🚆 **Live Train Tracking & Delays**:\nYou can monitor real-time GPS position, speed, upcoming stations, and delay predictions for all major trains in real time.";
    quickActions = [
      { label: 'Track Live Train Position', route: '/passenger/track' },
      { label: 'View Station Departures', route: '/passenger/live-station' }
    ];
  } else if (query.includes('cancel') || query.includes('refund') || query.includes('policy')) {
    intent = 'cancellation';
    reply = "💳 **Ticket Cancellation & Refund Rules**:\n• Cancellation >48h before departure: Full refund minus flat clerkage fee.\n• 48h to 12h: 25% deduction.\n• 12h to 4h: 50% deduction.\nRefunds are credited directly to your Rail Wallet within 10 seconds of cancellation!";
    quickActions = [
      { label: 'My Bookings & Cancellation', route: '/passenger/bookings' },
      { label: 'Check Wallet Balance', route: '/passenger/wallet' }
    ];
  } else if (query.includes('wallet') || query.includes('balance') || query.includes('pay')) {
    intent = 'wallet';
    reply = "👛 **Rail Wallet**:\nUse Rail Wallet to enjoy **0% payment gateway surcharge** on all train bookings and seat catering orders with instant refund processing!";
    quickActions = [
      { label: 'Open Rail Wallet', route: '/passenger/wallet' }
    ];
  } else {
    reply = "Hello! I am **RailBot**, your intelligent AI Railway Assistant.\n\nI can assist you with:\n1. Live Train Tracking & Delays\n2. 10-Digit PNR Status & Berth Prediction\n3. E-Catering Seat Meal Orders\n4. Ticket Cancellations & Refunds\n5. Emergency SOS Broadcasts";
    quickActions = [
      { label: 'Check PNR Status', route: '/passenger/pnr' },
      { label: 'Order Seat Meals', route: '/passenger/catering' },
      { label: 'Live Train Position', route: '/passenger/track' }
    ];
  }

  return res.json({
    reply,
    intent,
    quickActions,
    suggestedQuestions: [
      "Track Rajdhani 12952",
      "Check PNR 2345678901",
      "Order food for seat",
      "Emergency SOS help",
      "Cancellation policy"
    ]
  });
});

// 5. AI Dynamic Fare & Surge Price Trends
router.get('/fare-trends', (req, res) => {
  const { train_number = '12952' } = req.query;
  res.json({
    train_number,
    currentPriceMultiplier: 1.05,
    recommendation: 'Prices are projected to increase by 15% in the next 48 hours as berth availability drops below 20 seats.',
    historicalPrices: [
      { date: '15 Days Prior', price: 1350 },
      { date: '10 Days Prior', price: 1380 },
      { date: '5 Days Prior', price: 1420 },
      { date: 'Today', price: 1450 },
      { date: 'Projected Tatkal', price: 1720 }
    ]
  });
});

module.exports = router;

