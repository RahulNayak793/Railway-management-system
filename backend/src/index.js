const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Print requests to log
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Railway Management System API',
    status: 'healthy',
    mode: process.env.SUPABASE_URL.includes('mockproject.supabase.co') ? 'MOCK_DATABASE' : 'LIVE_DATABASE'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Railway Management System API running at http://localhost:${port}`);
});
