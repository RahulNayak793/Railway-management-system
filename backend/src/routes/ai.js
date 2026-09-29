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
    const cleanPnr = String(pnr || '').trim();
    if (isMockMode) {
      const booking = Array.from(mockDb.bookings.values()).find(b => 
        b && (
          String(b.pnr_number || '').trim() === cleanPnr ||
          String(b.pnr || '').trim() === cleanPnr ||
          String(b.id || '').trim() === cleanPnr
        )
      );
      if (!booking) return { error: 'PNR not found' };
      
      const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a && a.booking_id === booking.id);
      return { booking, allocations };
    } else {
      const { data: booking } = await supabase.from('bookings').select('*, allocations:seat_allocations(*)').eq('pnr_number', cleanPnr).maybeSingle();
      if (!booking) return { error: 'PNR not found' };

      return { booking, allocations: booking.allocations || [] };
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

const callGroqAPI = (userMessage, history = []) => {
  return new Promise((resolve) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || !apiKey.startsWith('gsk_')) return resolve(null);
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const systemPrompt = `You are RailBot, the official intelligent AI assistant for RailControl (Railway Management System).
Your purpose is to assist passengers, staff, and admins with train searches, timetables, bookings, PNR status, cancellation policies, Rail Wallet, seat pre-orders, and emergency alerts.
Always be polite, helpful, and concise. Format responses cleanly with markdown bold text and bullet points.`;

    const groqMessages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history)) {
      history.slice(-4).forEach(h => {
        if (h.text && h.sender) {
          groqMessages.push({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: String(h.text)
          });
        }
      });
    }

    groqMessages.push({ role: 'user', content: userMessage });

    const postData = JSON.stringify({
      model,
      messages: groqMessages,
      max_tokens: 500,
      temperature: 0.3
    });

    const req = https.request({
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.message?.content;
            resolve(text || null);
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
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

  const trimmed = String(message).trim();
  const lowerMsg = trimmed.toLowerCase();

  // =========================================================================
  // 1. DIRECT PNR STATUS VERIFICATION HANDLER
  // =========================================================================
  const pnrMatch = trimmed.match(/\b\d{10}\b/);
  const isPnrQuery = !!pnrMatch || lowerMsg.includes('pnr');

  if (pnrMatch || (isPnrQuery && /\d{4,}/.test(trimmed))) {
    const pnr = pnrMatch ? pnrMatch[0] : trimmed.match(/\d{4,}/)[0];
    const toolResult = await executeTool('getPNRStatus', { pnr }, req.user);

    if (toolResult && toolResult.booking) {
      const b = toolResult.booking;
      const allocs = toolResult.allocations || [];
      const train = (isMockMode && mockDb.trains) ? (mockDb.trains.get(b.train_id) || Array.from(mockDb.trains.values()).find(t => t.train_number === b.train_number)) : null;
      const trainName = train?.train_name || b.train_name || 'Express Service';
      const trainNum = b.train_number || train?.train_number || 'N/A';
      const dateStr = b.travel_date || 'Upcoming Journey';
      const statusUpper = String(b.status || 'CONFIRMED').toUpperCase();
      const seatDetails = allocs.length > 0 
        ? allocs.map(a => `${a.coach_id || 'B1'}-${a.seat_number} (${a.berth_type || 'Berth'})`).join(', ')
        : 'Allocated at chart preparation';
      const passengerDisplay = b.passenger_name || (allocs.length > 0 ? allocs.map(a => a.passenger_name).join(', ') : 'Confirmed Passenger');

      const isAuthorized = req.user && (
        req.user.role === 'admin' ||
        req.user.role === 'staff' ||
        b.passenger_id === req.user.id ||
        (req.user.email && b.user_email && b.user_email.toLowerCase() === req.user.email.toLowerCase())
      );

      let reply = `🎫 **PNR Status Dossier: ${pnr}**\n\n` +
        `• **Train**: **${trainName}** (#${trainNum})\n` +
        `• **Journey Date**: ${dateStr}\n` +
        `• **Route**: ${b.source_station_code || 'NDLS'} ➔ ${b.destination_station_code || 'MMCT'}\n` +
        `• **Booking Status**: **${statusUpper}**\n` +
        `• **Class**: ${b.class_type || b.coach_class || '3A'}\n`;

      if (isAuthorized) {
        reply += `• **Seat / Berth**: ${seatDetails}\n` +
                 `• **Passenger**: ${passengerDisplay}\n` +
                 `• **Fare Paid**: ₹${b.total_fare || b.fare || 0}`;
      } else {
        reply += `• **Seat / Berth**: ${seatDetails}\n` +
                 `• **Passenger Details**: *Full passenger details are hidden. Log in to view full booking details.*`;
      }

      return res.json({
        reply,
        intent: 'getPNRStatus',
        quickActions: [
          { label: 'View Full E-Ticket & PNR', route: `/passenger/pnr?pnr=${pnr}` },
          { label: 'Order Meals for Seat', route: '/passenger/catering' },
          { label: 'Track Live Train Status', route: '/passenger/track' }
        ],
        suggestedQuestions: [
          'What is the cancellation refund policy?',
          'Track this train status',
          'Order food on train'
        ]
      });
    } else {
      // PNR not found in system
      return res.json({
        reply: `🔍 **PNR Status Verification: ${pnr}**\n\n` +
               `❌ **No Booking Record Found**\n` +
               `The 10-digit PNR number **${pnr}** was not found in the Railway reservation database.\n\n` +
               `**Helpful Tips:**\n` +
               `• Please check that all 10 digits match your ticket confirmation.\n` +
               `• If you booked recently, view all your active bookings under **My Bookings**.\n` +
               `• You can also verify on the dedicated PNR inquiry page.`,
        intent: 'getPNRStatus_not_found',
        quickActions: [
          { label: 'Open PNR Inquiry Page', route: `/passenger/pnr?pnr=${pnr}` },
          { label: 'View My Bookings', route: '/passenger/bookings' },
          { label: 'Search & Book Trains', route: '/passenger/search' }
        ],
        suggestedQuestions: [
          'How to check PNR status?',
          'Search trains between stations',
          'Tatkal booking timings'
        ]
      });
    }
  }

  // =========================================================================
  // 2. DIRECT TRAIN SEARCH / SCHEDULE HANDLER
  // =========================================================================
  const isSearchQuery = lowerMsg.includes('search') || lowerMsg.includes('train from') || (lowerMsg.includes('train') && lowerMsg.includes('to'));
  if (isSearchQuery) {
    const words = trimmed.toUpperCase().split(/\s+/);
    let srcCode = null, destCode = null;
    if (isMockMode && mockDb.stations) {
      const stationCodes = Array.from(mockDb.stations.values()).map(s => s.station_code);
      words.forEach(w => {
        if (stationCodes.includes(w)) {
          if (!srcCode) srcCode = w;
          else if (!destCode) destCode = w;
        }
      });
    }
    if (!srcCode && (lowerMsg.includes('delhi') || lowerMsg.includes('ndls'))) srcCode = 'NDLS';
    if (!destCode && (lowerMsg.includes('mumbai') || lowerMsg.includes('mmct'))) destCode = 'MMCT';

    if (srcCode && destCode) {
      const searchResult = await executeTool('searchTrains', { source: srcCode, destination: destCode });
      const trains = searchResult.trains || [];
      if (trains.length > 0) {
        let reply = `🚆 **Found ${trains.length} Trains between ${srcCode} and ${destCode}:**\n\n`;
        trains.slice(0, 3).forEach(t => {
          reply += `• **${t.train_name}** (#${t.train_number}) — Dep: ${t.route?.departure_time || '06:00'}, Arr: ${t.route?.arrival_time || '14:00'}\n` +
                   `  Classes: ${(t.available_classes || ['SL', '3A', '2A']).join(', ')} | Base Fare: ₹${t.base_fare || 540}\n`;
        });
        return res.json({
          reply,
          intent: 'searchTrains',
          quickActions: [
            { label: `Book ${srcCode} to ${destCode}`, route: `/passenger/search?source=${srcCode}&destination=${destCode}` }
          ]
        });
      }
    }
  }

  // =========================================================================
  // 3. DIRECT CATERING & MEAL HANDLER
  // =========================================================================
  if (lowerMsg.includes('food') || lowerMsg.includes('cater') || lowerMsg.includes('meal') || lowerMsg.includes('pantry') || lowerMsg.includes('breakfast') || lowerMsg.includes('lunch') || lowerMsg.includes('dinner')) {
    return res.json({
      reply: `🍱 **IRCTC E-Catering Concierge**\n\n` +
             `Order restaurant meals delivered hot to your seat across 32+ major junction stations!\n\n` +
             `• **Cuisines**: Pure Veg Thali, Jain Food, North/South Indian, Biryani & Snacks\n` +
             `• **Service**: Delivered directly to your coach & berth upon arrival\n` +
             `• **Payment**: Online payment or Cash on Delivery (COD)`,
      intent: 'catering',
      quickActions: [
        { label: 'Order Meals for Seat', route: '/passenger/catering' },
        { label: 'Track Meal Order', route: '/passenger/pnr' }
      ]
    });
  }

  // =========================================================================
  // 4. DIRECT LIVE TRACKING HANDLER
  // =========================================================================
  if (lowerMsg.includes('track') || lowerMsg.includes('live') || lowerMsg.includes('where is') || lowerMsg.includes('running status') || lowerMsg.includes('delay')) {
    return res.json({
      reply: `📍 **Live Train Tracking & GPS Status**\n\n` +
             `Track live train movement, current platform arrival times, and delay telemetry in real time!\n\n` +
             `• **Live Telemetry**: Real-time speed and GPS positioning\n` +
             `• **Upcoming Halts**: Expected arrival vs scheduled departure\n` +
             `• **Delay Analysis**: Immediate platform change & delay bulletins`,
      intent: 'tracking',
      quickActions: [
        { label: 'Open Live Train Tracker', route: '/passenger/track' },
        { label: 'Check PNR Status', route: '/passenger/pnr' }
      ]
    });
  }

  // =========================================================================
  // 5. RAILWAY KNOWLEDGE BASE (Tatkal, Cancellation, RAC, Wallet, Emergency)
  // =========================================================================
  if (lowerMsg.includes('tatkal')) {
    return res.json({
      reply: `⚡ **Tatkal Booking Guidelines**\n\n` +
             `• **AC Classes (1A, 2A, 3A, 3E, CC)**: Opens at **10:00 AM** daily (1 day prior to travel).\n` +
             `• **Non-AC Classes (SL, 2S)**: Opens at **11:00 AM** daily (1 day prior to travel).\n` +
             `• **Tip**: Use your **Rail Wallet** for 1-click payment to bypass banking OTP delays and secure confirmed Tatkal berths faster.`,
      intent: 'tatkal_info',
      quickActions: [
        { label: 'Search Tatkal Trains', route: '/passenger/search' },
        { label: 'Top Up Rail Wallet', route: '/passenger/wallet' }
      ]
    });
  }

  if (lowerMsg.includes('cancel') || lowerMsg.includes('refund') || lowerMsg.includes('tdr')) {
    return res.json({
      reply: `💸 **Ticket Cancellation & Refund Rules**\n\n` +
             `• **Confirmed Tickets**: Can be cancelled up to 4 hours before chart preparation.\n` +
             `• **RAC / Waiting List**: Can be cancelled up to 30 minutes before departure for instant clerkage refund.\n` +
             `• **Refund Mode**: Refunds to **Rail Wallet** are credited **instantly** (0 seconds), or 3–5 working days to bank/cards.`,
      intent: 'cancellation_info',
      quickActions: [
        { label: 'Cancel Ticket & Claim Refund', route: '/passenger/cancel' },
        { label: 'Check Wallet Balance', route: '/passenger/wallet' }
      ]
    });
  }

  if (lowerMsg.includes('emergency') || lowerMsg.includes('sos') || lowerMsg.includes('helpline') || lowerMsg.includes('police') || lowerMsg.includes('doctor') || lowerMsg.includes('medical')) {
    return res.json({
      reply: `🚨 **Railway Emergency & SOS Support**\n\n` +
             `• **All-India Railway Helpline**: **139** (Toll-Free, 24/7)\n` +
             `• **Railway Protection Force (RPF)**: **182**\n` +
             `• **Medical Assistance on Train**: Alert on-duty TTE or dial 139 for doctor on board at next station.`,
      intent: 'emergency_sos',
      quickActions: [
        { label: 'Helpline Directory', route: '/passenger/pnr' }
      ]
    });
  }

  // =========================================================================
  // 6. LLM FALLBACK (Groq -> Gemini -> Smart Concierge)
  // =========================================================================
  try {
    // 6a. Try Groq (ultra fast < 500ms)
    const groqReply = await callGroqAPI(trimmed, history);
    if (groqReply) {
      return res.json({
        reply: groqReply,
        intent: 'groq_ai'
      });
    }
  } catch (groqErr) {
    console.warn('[RailBot] Groq call skipped or failed:', groqErr.message);
  }

  // 6b. Try Gemini if test or configured
  try {
    let contents = [];
    if (Array.isArray(history)) {
      contents = history
        .filter(msg => msg.text && msg.sender)
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));
    }
    contents.push({ role: 'user', parts: [{ text: trimmed }] });

    let geminiResponse = await callGeminiAPI(contents, railbotTools);
    const reply = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      return res.json({ reply, intent: 'gemini_ai' });
    }
  } catch (geminiErr) {
    console.warn('[RailBot] Gemini call skipped or failed:', geminiErr.message);
  }

  // 6c. Smart Concierge General Fallback
  return res.json({
    reply: `👋 **RailBot Assistant**\n\n` +
           `I can assist you with all Indian Railways ticketing, live tracking, and catering services:\n\n` +
           `• **PNR Status**: Enter any 10-digit PNR number to check current booking status.\n` +
           `• **Train Search**: Ask for trains between any cities or station codes.\n` +
           `• **Seat Meals**: Order pantry delivery to your seat.\n` +
           `• **Live Tracking**: Real-time train GPS location & delay bulletins.`,
    intent: 'general_concierge',
    quickActions: [
      { label: 'Check PNR Status', route: '/passenger/pnr' },
      { label: 'Search Trains', route: '/passenger/search' },
      { label: 'Order Seat Meals', route: '/passenger/catering' },
      { label: 'Track Live Train', route: '/passenger/track' }
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

