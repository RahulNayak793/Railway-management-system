// RailControl System Server Entry Point - Updated Task Routes
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable Middlewares with complete CORS support for Vercel host & mobile browsers
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Middleware to ensure req.body is parsed as object in Vercel Serverless environment
app.use((req, res, next) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.warn('Could not parse req.body as JSON string:', e.message);
    }
  }
  next();
});

// Print detailed requests to log for serverless debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} Path: ${req.path} URL: ${req.url}`);
  next();
});

const { getRailwaySystemStatus } = require('./services/railwayIntegrationService');

// Railway System Connection & Data Source Status Endpoint
app.get(['/api/railway-system/status', '/railway-system/status'], (req, res) => {
  return res.json(getRailwaySystemStatus());
});

// Import Routes
const authRoutes = require('./routes/auth');
const trainRoutes = require('./routes/trains');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const supportRoutes = require('./routes/support');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const notificationsRoutes = require('./routes/notifications');
const cateringRoutes = require('./routes/catering');
const sosRoutes = require('./routes/sos');
const staffRoutes = require('./routes/staff');
const { router: trackingRoutes } = require('./routes/tracking');
const { router: passengerRoutes } = require('./routes/passengers');

// Mount Routes for both /api/* and /* Vercel serverless pathing
app.use('/api/passengers', passengerRoutes);
app.use('/passengers', passengerRoutes);

app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/staff', staffRoutes);
app.use('/staff', staffRoutes);

app.use('/api/trains', trainRoutes);
app.use('/trains', trainRoutes);

app.use('/api/tracking', trackingRoutes);
app.use('/tracking', trackingRoutes);

app.use('/api/bookings', bookingRoutes);
app.use('/bookings', bookingRoutes);

app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

app.use('/api/wallet', paymentRoutes);
app.use('/wallet', paymentRoutes);

app.use('/api/support', supportRoutes);
app.use('/support', supportRoutes);

app.use('/api/feedback', feedbackRoutes);
app.use('/feedback', feedbackRoutes);

app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

app.use('/api/ai', aiRoutes);
app.use('/ai', aiRoutes);

app.use('/api/notifications', notificationsRoutes);
app.use('/notifications', notificationsRoutes);

app.use('/api/catering', cateringRoutes);
app.use('/catering', cateringRoutes);

app.use('/api/sos', sosRoutes);
app.use('/sos', sosRoutes);

const path = require('path');

// Serve compiled frontend production build files if dist folder exists
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// Base API Status Route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the Railway Management System API',
    status: 'healthy',
    mode: (process.env.SUPABASE_URL && process.env.SUPABASE_URL.includes('mockproject.supabase.co')) || !process.env.SUPABASE_URL ? 'MOCK_DATABASE' : 'LIVE_DATABASE',
    docs: 'http://localhost:5000/api/docs'
  });
});

// Interactive API Documentation Route
app.get('/api/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Railway Management System - API Documentation</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Outfit', 'Inter', sans-serif; background: #070B19; color: #E2E8F0; margin: 0; padding: 2rem; }
        .container { max-width: 1000px; margin: 0 auto; }
        h1 { color: #00F2FE; font-size: 2rem; margin-bottom: 0.5rem; }
        .badge { background: rgba(0, 242, 254, 0.15); color: #00F2FE; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; border: 1px solid rgba(0, 242, 254, 0.3); font-weight: bold; }
        .endpoint-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1rem; backdrop-filter: blur(10px); }
        .method { font-family: monospace; font-weight: bold; padding: 0.2rem 0.5rem; border-radius: 0.4rem; font-size: 0.8rem; margin-right: 0.5rem; }
        .get { background: rgba(16, 185, 129, 0.2); color: #34D399; }
        .post { background: rgba(59, 130, 246, 0.2); color: #60A5FA; }
        .path { font-family: monospace; font-size: 0.95rem; font-weight: bold; color: #F8FAFC; }
        .desc { font-size: 0.85rem; color: #94A3B8; margin-top: 0.5rem; }
        a { color: #00F2FE; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚆 Railway Management System API Docs</h1>
        <p><span class="badge">HEALTHY</span> <span class="badge">V1.0</span> <span class="badge">MOCK & LIVE DB SUPPORTED</span></p>
        <p className="desc">Explore interactive endpoints below. Access live JSON status at <a href="/api">/api</a>.</p>

        <div class="endpoint-card">
          <span class="method get">GET</span><span class="path">/api/trains</span>
          <p class="desc">Search active trains by source, destination, date, and coach class quotas. Query params: <code>source</code>, <code>destination</code>.</p>
        </div>

        <div class="endpoint-card">
          <span class="method get">GET</span><span class="path">/api/trains/stations</span>
          <p class="desc">Get full master database of 160+ railway stations across India with station codes and state classifications.</p>
        </div>

        <div class="endpoint-card">
          <span class="method post">POST</span><span class="path">/api/bookings/book</span>
          <p class="desc">Process new ticket reservation, allocate coach/seat berths, and return generated PNR code.</p>
        </div>

        <div class="endpoint-card">
          <span class="method get">GET</span><span class="path">/api/bookings/pnr/:pnr</span>
          <p class="desc">Retrieve complete PNR status, passenger allocations, travel date, and e-ticket manifest.</p>
        </div>

        <div class="endpoint-card">
          <span class="method post">POST</span><span class="path">/api/sos/alert</span>
          <p class="desc">Trigger emergency SOS medical/security alert to Railway Protection Force (RPF) and Station Master.</p>
        </div>

        <div class="endpoint-card">
          <span class="method post">POST</span><span class="path">/api/ai/predict-delay</span>
          <p class="desc">Compute AI predictive delay risk and route weather telemetry based on historical corridor performance.</p>
        </div>

        <div class="endpoint-card">
          <span class="method post">POST</span><span class="path">/api/catering/order</span>
          <p class="desc">Place in-train pantry meal orders delivered directly to coach berth number.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Single-page application fallback for production deployment
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.json({
        message: 'Railway Management System API is running smoothly.',
        status: 'healthy'
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File size must be less than 5 MB.' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: 'Multipart form upload error: ' + err.message });
  }
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Export app for serverless deployment
if (require.main === module) {
  // Start Server locally
  app.listen(port, () => {
    console.log(`🚀 Railway Management System API running at http://localhost:${port}`);
  });
}

module.exports = app;
