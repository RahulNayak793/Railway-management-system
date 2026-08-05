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
app.use(express.json());
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

// Mount Routes for both /api/* and /* Vercel serverless pathing
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/trains', trainRoutes);
app.use('/trains', trainRoutes);

app.use('/api/bookings', bookingRoutes);
app.use('/bookings', bookingRoutes);

app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

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

// Base API Status Route
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the Railway Management System API',
    status: 'healthy',
    mode: (process.env.SUPABASE_URL && process.env.SUPABASE_URL.includes('mockproject.supabase.co')) || !process.env.SUPABASE_URL ? 'MOCK_DATABASE' : 'LIVE_DATABASE'
  });
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
