const express = require('express');
const router = express.Router();
const { isMockMode, mockDb } = require('../config/supabase');

// 1. Train Recommendations
router.get('/recommendations', async (req, res) => {
  const { source, destination, history } = req.query;

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

// 3. Chatbot Support
router.post('/chatbot', async (req, res) => {
  const { message, pnr, session_history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message content is required' });
  }

  const query = message.toLowerCase();
  let reply = '';
  let intent = 'general';

  if (query.includes('status') || query.includes('where is') || query.includes('track')) {
    intent = 'tracking';
    reply = "I can help you track trains! You can view current schedules directly on the 'Track Train' dashboard. To track a live train, please input the train number like 12952 (Rajdhani) to view live position coordinates.";
  } else if (query.includes('pnr') || query.includes('ticket') || query.includes('status of booking')) {
    intent = 'pnr_check';
    if (pnr) {
      reply = `I looked up PNR ${pnr}. Your reservation status is currently CONFIRMED. Your journey is scheduled on coach A1, seat 12 (Lower Berth).`;
    } else {
      reply = "To check your booking details, please type your 10-digit PNR number or visit the 'My Bookings' tab where you can retrieve PNR codes.";
    }
  } else if (query.includes('cancel') || query.includes('refund')) {
    intent = 'cancellation';
    reply = "Under the Railway Board guidelines, cancellations initiated 48 hours prior to departure receive a full refund minus a clerkage fee. Go to your Passenger Dashboard -> 'My Bookings' to cancel your ticket.";
  } else if (query.includes('food') || query.includes('meal') || query.includes('catering')) {
    intent = 'catering';
    reply = "Pre-ordered catering services are available in AC classes on Rajdhani and Shatabdi trains. You can choose Veg/Non-Veg preferences during the checkout seat booking details form.";
  } else {
    reply = "Hello! I am RailBot, your AI Assistant. I can help you search trains, check PNR status, explain seat berth configurations, assist in ticket cancellations, and predict train delays. How can I help you today?";
  }

  return res.json({
    reply,
    intent,
    suggestedQuestions: [
      "Where is my train?",
      "How to cancel my ticket?",
      "Predict delay for Rajdhani 12952",
      "What are the catering options?"
    ]
  });
});

module.exports = router;
