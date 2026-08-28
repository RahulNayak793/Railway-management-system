const express = require('express');
const router = express.Router();
const { isMockMode, mockDb, supabase } = require('../config/supabase');
const { optionalAuthenticateToken } = require('../middleware/auth');
const { extractStationCode, matchRouteSegment } = require('../utils/routeSearch');
const { calculateSegmentFare } = require('../utils/fareCalculator');
const https = require('https');

// 1. Train Recommendations
router.get('/recommendations', async (req, res) => {
  const { source, destination } = req.query;

  if (source && destination && extractStationCode(source) === extractStationCode(destination)) {
    return res.json({
      recommendedTrains: [],
      insights: 'Source and destination stations cannot be the same.'
    });
  }

  const trainsList = Array.from(mockDb.trains.values()).filter(t => !!t);
  const routesList = Array.from(mockDb.routes.values());

  const activeStaffTrains = [];
  for (const t of trainsList) {
    if (source && destination) {
      const route = routesList.find(r => r.train_id === t.id);
      const segment = matchRouteSegment(t, route, source, destination);
      if (segment) {
        activeStaffTrains.push(t);
      }
    } else {
      activeStaffTrains.push(t);
    }
  }

  const recommendations = activeStaffTrains.map((t, idx) => ({
    train_number: t.train_number,
    train_name: t.train_name,
    reason: idx === 0 ? 'Fastest transit time and highest comfort class availability.' : 'Most cost-effective journey option with verified pantry service.',
    matchScore: Math.max(75, 95 - idx * 7)
  }));

  return res.json({
    recommendedTrains: recommendations,
    insights: recommendations.length > 0
      ? 'Based on passenger search trends, morning slot booking has a higher chance of berth upgrade promotion.'
      : ''
  });
});

// 2. Train Delay Prediction
router.post('/predict-delay', async (req, res) => {
  const { train_number, travel_date } = req.body;

  if (!train_number) {
    return res.status(400).json({ error: 'train_number is required' });
  }

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
    travel_class: travel_class || '3A',
    quota: quota || 'GN',
    travel_date: travel_date || new Date().toISOString().split('T')[0],
    probabilityPercent,
    statusLevel,
    recommendation
  });
});

const systemPrompt = `You are RailBot, an intelligent and polite AI assistant for the Railway Management System...`;

const railbotTools = [
  {
    name: 'searchTrains',
    description: 'Search for available trains running between a source and destination station.',
    parameters: {
      type: 'OBJECT',
      properties: {
        source: { type: 'STRING', description: 'Source station code or name (e.g. NDLS, New Delhi)' },
        destination: { type: 'STRING', description: 'Destination station code or name (e.g. MMCT, Mumbai Central)' },
        travel_date: { type: 'STRING', description: 'Travel date in YYYY-MM-DD format (optional)' }
      },
      required: ['source', 'destination']
    }
  },
  {
    name: 'getBookingStatus',
    description: 'Check status of a booking by booking ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        booking_id: { type: 'STRING', description: 'The booking ID (e.g. bk-12345)' }
      },
      required: ['booking_id']
    }
  },
  {
    name: 'getPNRStatus',
    description: 'Check status and details of a booking using a 10-digit PNR number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pnr: { type: 'STRING', description: 'The 10-digit PNR number' }
      },
      required: ['pnr']
    }
  },
  {
    name: 'getStationDetails',
    description: 'Lookup station details by station code.',
    parameters: {
      type: 'OBJECT',
      properties: {
        station_code: { type: 'STRING', description: 'Station code (e.g. NDLS)' }
      },
      required: ['station_code']
    }
  },
  {
    name: 'getTrainDetails',
    description: 'Lookup train details by train number.',
    parameters: {
      type: 'OBJECT',
      properties: {
        train_number: { type: 'STRING', description: 'Train number (e.g. 12952)' }
      },
      required: ['train_number']
    }
  }
];

const executeTool = async (name, args, userContext) => {
  if (name === 'searchTrains') {
    const { source, destination } = args;
    if (!source || !destination) {
      return { error: 'source and destination are required' };
    }

    if (isMockMode) {
      const trainsList = Array.from(mockDb.trains.values()).filter(t => !!t);
      const routesList = Array.from(mockDb.routes.values());
      const matchedTrains = [];

      for (const t of trainsList) {
        const route = routesList.find(r => r.train_id === t.id);
        const segment = matchRouteSegment(t, route, source, destination);
        if (segment) {
          const fareInfo = calculateSegmentFare(t, route, segment.srcIndex, segment.destIndex, segment.nodes);
          matchedTrains.push({
            ...t,
            source: segment.srcCode,
            destination: segment.destCode,
            fares_by_class: fareInfo.faresByClass,
            base_fare: fareInfo.baseFare,
            distance_km: fareInfo.segmentDistanceKm,
            route: {
              ...(route || {}),
              source_station_code: segment.srcCode,
              destination_station_code: segment.destCode,
              departure_time: segment.departure_time,
              arrival_time: segment.arrival_time,
              distance_km: fareInfo.segmentDistanceKm,
              segment_fares: fareInfo
            }
          });
        }
      }
      return { trains: matchedTrains };
    } else {
      const { data: trains } = await supabase.from('trains').select('*, routes:routes(*)');
      const matchedTrains = [];

      for (const t of trains || []) {
        const route = t.routes && t.routes.length > 0 ? t.routes[0] : null;
        const segment = matchRouteSegment(t, route, source, destination);
        if (segment) {
          const fareInfo = calculateSegmentFare(t, route, segment.srcIndex, segment.destIndex, segment.nodes);
          matchedTrains.push({
            ...t,
            source: segment.srcCode,
            destination: segment.destCode,
            fares_by_class: fareInfo.faresByClass,
            base_fare: fareInfo.baseFare,
            distance_km: fareInfo.segmentDistanceKm,
            route: {
              ...(route || {}),
              source_station_code: segment.srcCode,
              destination_station_code: segment.destCode,
              departure_time: segment.departure_time,
              arrival_time: segment.arrival_time,
              distance_km: fareInfo.segmentDistanceKm,
              segment_fares: fareInfo
            }
          });
        }
      }
      return { trains: matchedTrains };
    }
  }

  if (name === 'getBookingStatus') {
    const { booking_id } = args;
    if (!userContext) {
      return { error: 'Authentication required to view booking status' };
    }
    if (isMockMode) {
      const booking = mockDb.bookings.get(booking_id);
      if (!booking) return { error: 'Booking not found' };
      if (booking.passenger_id !== userContext.id && userContext.role !== 'admin' && userContext.role !== 'staff') {
        return { error: 'Unauthorized to view this booking' };
      }
      return { booking };
    } else {
      const { data: booking } = await supabase.from('bookings').select('*').eq('id', booking_id).single();
      if (!booking) return { error: 'Booking not found' };
      if (booking.passenger_id !== userContext.id && userContext.role !== 'admin' && userContext.role !== 'staff') {
        return { error: 'Unauthorized to view this booking' };
      }
      return { booking };
    }
  }

  if (name === 'getPNRStatus') {
    const { pnr } = args;
    if (isMockMode) {
      const booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === pnr);
      if (!booking) return { error: 'PNR not found' };
      
      const isAuthorized = userContext && (
        userContext.role === 'admin' ||
        userContext.role === 'staff' ||
        booking.passenger_id === userContext.id
      );

      if (isAuthorized) {
        const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a.booking_id === booking.id);
        return { booking, allocations };
      } else {
        return { 
          pnr_number: booking.pnr_number, 
          travel_date: booking.travel_date, 
          status: booking.status,
          message: 'Full passenger details are hidden. Log in to view full booking details.'
        };
      }
    } else {
      const { data: booking } = await supabase.from('bookings').select('*, allocations:seat_allocations(*)').eq('pnr_number', pnr).single();
      if (!booking) return { error: 'PNR not found' };

      const isAuthorized = userContext && (
        userContext.role === 'admin' ||
        userContext.role === 'staff' ||
        booking.passenger_id === userContext.id
      );

      if (isAuthorized) {
        return { booking, allocations: booking.allocations };
      } else {
        return {
          pnr_number: booking.pnr_number,
          travel_date: booking.travel_date,
          status: booking.status,
          message: 'Full passenger details are hidden. Log in to view full booking details.'
        };
      }
    }
  }

  if (name === 'getStationDetails') {
    const { station_code } = args;
    const code = String(station_code).toUpperCase().trim();
    if (isMockMode) {
      const station = Array.from(mockDb.stations.values()).find(s => s.station_code === code);
      return station ? { station } : { error: 'Station not found' };
    } else {
      const { data: station } = await supabase.from('stations').select('*').eq('station_code', code).single();
      return station ? { station } : { error: 'Station not found' };
    }
  }

  if (name === 'getTrainDetails') {
    const { train_number } = args;
    const num = String(train_number).trim();
    if (isMockMode) {
      const train = Array.from(mockDb.trains.values()).find(t => t.train_number === num);
      return train ? { train } : { error: 'Train not found' };
    } else {
      const { data: train } = await supabase.from('trains').select('*').eq('train_number', num).single();
      return train ? { train } : { error: 'Train not found' };
    }
  }

  return { error: 'Tool not supported' };
};

const callGeminiAPI = (contents, tools = null) => {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    
    if (!apiKey || apiKey.includes('mock-gemini-api-key') || process.env.NODE_ENV === 'test') {
      // Simulate Gemini API responses ONLY during automated tests
      if (process.env.NODE_ENV === 'test') {
        const lastMsg = contents[contents.length - 1];
        const text = lastMsg.parts?.[0]?.text || '';
                const isFuncResponse = lastMsg.parts?.[0]?.functionResponse ? true : false;

        if (isFuncResponse) {
          const funcResponseObj = lastMsg.parts[0].functionResponse;
          return resolve({
            candidates: [{
              content: {
                parts: [{ text: `Simulated Gemini response with tool output: ${JSON.stringify(funcResponseObj.response)}` }]
              }
            }]
          });
        }

        if (text.toLowerCase().includes('search')) {
          return resolve({
            candidates: [{
              content: {
                parts: [{
                  functionCall: {
                    name: 'searchTrains',
                    args: { source: 'NDLS', destination: 'MMCT', travel_date: '2026-09-10' }
                  }
                }]
              }
            }]
          });
        }

        if (text.toLowerCase().includes('pnr')) {
          const pnrMatch = text.match(/\b\d{10}\b/);
          const pnrVal = pnrMatch ? pnrMatch[0] : '2345678901';
          return resolve({
            candidates: [{
              content: {
                parts: [{
                  functionCall: {
                    name: 'getPNRStatus',
                    args: { pnr: pnrVal }
                  }
                }]
              }
            }]
          });
        }

        return resolve({
          candidates: [{
            content: {
              parts: [{ text: 'Hello! I am RailBot, how can I help you today?' }]
            }
          }]
        });
      }
      return reject(new Error('Invalid or missing GEMINI_API_KEY environment variable. Please check your backend/.env file.'));
    }

    const postData = JSON.stringify({
      contents,
      systemInstruction: {
         parts: [{ text: `You are RailBot, the official intelligent AI assistant for RailControl (Railway Management System).
Your purpose is to assist passengers, staff, and admins with searches, timetables, bookings, PNR status, cancellation policies, Rail Wallet, seat pre-orders, and emergency alerts.
Always be polite, helpful, and highly precise.
CRITICAL SAFETY & TRUTH RULES:
1. ONLY return train details, schedules, fares, and booking statuses that you retrieve from the database via your tools.
2. DO NOT invent or hallucinate PNR numbers, train numbers, booking statuses, refund statuses, fares, or seat availability.
3. If a search query or PNR lookup yields no results or is unavailable, state clearly that the information could not be found or is unavailable in the system.
4. For general railway policies or usage questions, you may answer using your general knowledge, but clearly distinguish it from live system data.
5. NEVER execute arbitrary SQL or perform unauthorized actions. You must validate all inputs.
6. If the user asks a general question about available trains or bookings without specifying a route (source and destination), ask a concise clarification (e.g. "Sure. Which route would you like to travel — for example NDLS to MMCT?") instead of prompting them with a list of instruction fields.` }]
      },
      tools: tools ? [{ functionDeclarations: tools }] : undefined
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Gemini API returned status code ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Malformed JSON response from Gemini API'));
          }
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini API request timed out'));
    });

    req.write(postData);
    req.end();
  });
};

router.post('/chatbot', optionalAuthenticateToken, async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message content is required' });
  }

  // Build Gemini's contents history context from frontend messages
  let contents = [];
  if (Array.isArray(history)) {
    contents = history
      .filter(msg => msg.text && msg.sender)
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
  }

  // Remove initial greeting to prevent polluting context
  if (contents.length > 0 && contents[0].role === 'model' && contents[0].parts[0].text.includes('RailBot')) {
    contents.shift();
  }

  // Append new user message
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  try {
    let geminiResponse = await callGeminiAPI(contents, railbotTools);
    
    let candidate = geminiResponse.candidates?.[0];
    let functionCall = candidate?.content?.parts?.[0]?.functionCall;
    let loopCount = 0;
    let lastFunctionCall = null;

    // Loop support for model -> tool -> result -> model -> final response workflows
    while (functionCall && loopCount < 3) {
      loopCount++;
      lastFunctionCall = functionCall;
      const { name, args } = functionCall;
      
      console.log(`[RailBot] Gemini requested tool: ${name} with args:`, args);
      const toolResult = await executeTool(name, args, req.user);
      console.log(`[RailBot] Tool ${name} execution result:`, toolResult);

      contents.push(candidate.content);
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: toolResult
          }
        }]
      });

      geminiResponse = await callGeminiAPI(contents);
      candidate = geminiResponse.candidates?.[0];
      functionCall = candidate?.content?.parts?.[0]?.functionCall;
    }

    const reply = candidate?.content?.parts?.[0]?.text || 'No response generated';
    console.log(`[RailBot] Gemini final response generated (length: ${reply.length})`);

    return res.json({
      reply,
      intent: lastFunctionCall ? lastFunctionCall.name : 'general'
    });
  } catch (err) {
    console.error('RailBot Chatbot error:', err.message);
    return res.json({
      reply: '🤖 **RailBot Service Offline**:\nRailBot is temporarily unable to connect to the AI service. Please try again.',
      intent: 'general_offline'
    });
  }
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

