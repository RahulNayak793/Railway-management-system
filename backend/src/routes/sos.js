const express = require('express');
const router = express.Router();

// Mock store for SOS Alerts
let mockSosAlerts = [
  {
    id: 'SOS-8812',
    pnr_number: '2345678901',
    train_number: '12952',
    train_name: 'Rajdhani Express',
    coach_number: 'B1',
    seat_number: 24,
    passenger_name: 'Rahul Sharma',
    contact_phone: '+91 98765 43210',
    category: 'Medical',
    severity: 'CRITICAL',
    description: 'Severe fever and dizziness reported by passenger in Berth 24.',
    status: 'DISPATCHED',
    dispatched_to: 'Dr. A. Verma (On-board Medical Officer & TTE B-Block)',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  }
];

// 1. Create Emergency SOS Alert
router.post('/alert', (req, res) => {
  const { pnr_number, train_number, train_name, coach_number, seat_number, passenger_name, contact_phone, category, description } = req.body;

  if (!category || !description) {
    return res.status(400).json({ error: 'Emergency category and details are required.' });
  }

  const newAlert = {
    id: `SOS-${Math.floor(1000 + Math.random() * 9000)}`,
    pnr_number: pnr_number || '2345678901',
    train_number: train_number || '12952',
    train_name: train_name || 'Rajdhani Express',
    coach_number: coach_number || 'B1',
    seat_number: seat_number || 24,
    passenger_name: passenger_name || 'Passenger',
    contact_phone: contact_phone || '+91 98765 43210',
    category: category || 'Medical',
    severity: category === 'Medical' || category === 'Security' ? 'HIGH' : 'MEDIUM',
    description,
    status: 'ACTIVE',
    dispatched_to: category === 'Security' ? 'RPF Escort Team' : category === 'Medical' ? 'On-board Medical Unit' : 'Train Cleanliness Crew',
    created_at: new Date().toISOString()
  };

  mockSosAlerts.unshift(newAlert);

  return res.json({
    success: true,
    message: 'Emergency SOS Broadcasted! Staff & Control Room have been alerted.',
    alert: newAlert
  });
});

// 2. Fetch Active SOS Alerts (for Staff & Passenger status)
router.get('/alerts', (req, res) => {
  const { pnr } = req.query;
  if (pnr) {
    const pnrAlerts = mockSosAlerts.filter(a => a.pnr_number === pnr);
    return res.json({ alerts: pnrAlerts });
  }
  return res.json({ alerts: mockSosAlerts });
});

// 3. Update SOS Alert Status (Staff action)
router.put('/alert/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  const alert = mockSosAlerts.find(a => a.id === id);
  if (!alert) {
    return res.status(404).json({ error: 'SOS Alert record not found' });
  }

  if (status) alert.status = status;
  if (note) alert.dispatched_note = note;

  return res.json({
    success: true,
    message: `SOS Alert ${id} updated to ${status}`,
    alert
  });
});

module.exports = router;
