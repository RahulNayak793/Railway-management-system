const express = require('express');
const router = express.Router();
const { isMockMode, mockDb } = require('../config/supabase');

// Mock Station Menu Items
const stationMenus = {
  'NDLS': [
    { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, category: 'Thali', type: 'veg', rating: 4.8, station: 'New Delhi (NDLS)', description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Sweet & Salad' },
    { id: 'm2', name: 'Butter Chicken Meal Box', price: 290, category: 'Main Course', type: 'non-veg', rating: 4.9, station: 'New Delhi (NDLS)', description: 'Tender Butter Chicken with Jeera Rice, Garlic Naan & Gulab Jamun' },
    { id: 'm3', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', rating: 4.7, station: 'New Delhi (NDLS)', description: '2 Fluffy Bhature with Spiced Chickpeas & Mint Chutney' },
    { id: 'm4', name: 'Jain Special Satvik Thali', price: 220, category: 'Thali', type: 'jain', rating: 4.9, station: 'New Delhi (NDLS)', description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati, Basmati Rice & Kheer' }
  ],
  'MMCT': [
    { id: 'm5', name: 'Mumbai Pav Bhaji Combo', price: 150, category: 'Snacks', type: 'veg', rating: 4.8, station: 'Mumbai Central (MMCT)', description: 'Butter-toasted Pav with spicy vegetable bhaji, extra butter & salad' },
    { id: 'm6', name: 'Maharashtrian Special Thali', price: 250, category: 'Thali', type: 'veg', rating: 4.7, station: 'Mumbai Central (MMCT)', description: 'Puran Poli, Pithla Bhakri, Aloo Bhaji, Steamed Rice & Solkadhi' },
    { id: 'm7', name: 'Chicken Biryani Handi', price: 280, category: 'Main Course', type: 'non-veg', rating: 4.9, station: 'Mumbai Central (MMCT)', description: 'Aromatic Dum Biryani with Raita, Salan & Egg' }
  ],
  'JP': [
    { id: 'm8', name: 'Rajasthani Dal Baati Churma', price: 260, category: 'Thali', type: 'veg', rating: 4.9, station: 'Jaipur Junction (JP)', description: 'Traditional Ghee-loaded Baati with Panchmel Dal & Sweet Churma' },
    { id: 'm9', name: 'Paneer Tikka Roll', price: 170, category: 'Snacks', type: 'veg', rating: 4.6, station: 'Jaipur Junction (JP)', description: 'Grilled Cottage Cheese with mint chutney rolled in Wheat Lachha Paratha' }
  ]
};

// In-memory food orders store for mock mode
let mockFoodOrders = [
  {
    order_id: 'ORD-98421',
    pnr_number: '2345678901',
    train_number: '12952',
    station_code: 'NDLS',
    station_name: 'New Delhi (NDLS)',
    passenger_name: 'Rahul Sharma',
    coach_number: 'B1',
    seat_number: 24,
    items: [
      { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, qty: 2 }
    ],
    total_amount: 480,
    status: 'Confirmed',
    delivery_status: 'Out For Delivery to Coach B1',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  }
];

// 1. Get Food Menu for Station / Train
router.get('/menu', (req, res) => {
  const { station = 'NDLS', filter = 'all' } = req.query;
  const menuList = stationMenus[station.toUpperCase()] || stationMenus['NDLS'];
  
  let filtered = menuList;
  if (filter !== 'all') {
    filtered = menuList.filter(item => item.type === filter);
  }

  res.json({
    station: station.toUpperCase(),
    availableStations: [
      { code: 'NDLS', name: 'New Delhi (NDLS)' },
      { code: 'MMCT', name: 'Mumbai Central (MMCT)' },
      { code: 'JP', name: 'Jaipur Junction (JP)' }
    ],
    menu: filtered
  });
});

// 2. Place E-Catering Food Order
router.post('/order', (req, res) => {
  const { pnr_number, train_number, station_code, coach_number, seat_number, passenger_name, items, total_amount, payment_method = 'UPI' } = req.body;

  if (!pnr_number || !items || items.length === 0) {
    return res.status(400).json({ error: 'PNR number and at least one menu item are required.' });
  }

  const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const txnId = `TXN-FOOD-${Math.floor(100000 + Math.random() * 900000)}`;
  const isPayOnDelivery = payment_method === 'COD' || payment_method === 'Pay on Delivery';

  const newOrder = {
    order_id: orderId,
    txn_id: txnId,
    pnr_number,
    train_number: train_number || '12952',
    station_code: station_code || 'NDLS',
    station_name: station_code === 'MMCT' ? 'Mumbai Central (MMCT)' : station_code === 'JP' ? 'Jaipur Junction (JP)' : 'New Delhi (NDLS)',
    passenger_name: passenger_name || 'Valued Passenger',
    coach_number: coach_number || 'B1',
    seat_number: seat_number || 24,
    items,
    total_amount: total_amount || 350,
    payment_method: payment_method || 'UPI',
    payment_status: isPayOnDelivery ? 'Pay at Seat' : 'Paid',
    status: 'Confirmed',
    delivery_status: 'Order Placed & Paid - Kitchen Preparing Meal',
    created_at: new Date().toISOString()
  };

  mockFoodOrders.unshift(newOrder);

  return res.json({
    success: true,
    message: 'Food order placed successfully! Kitchen has received your request.',
    order: newOrder
  });
});

// 3. Get Food Orders by PNR
router.get('/orders', (req, res) => {
  const { pnr } = req.query;
  if (!pnr) {
    return res.json({ orders: mockFoodOrders });
  }
  const filtered = mockFoodOrders.filter(o => o.pnr_number === pnr);
  return res.json({ orders: filtered.length > 0 ? filtered : mockFoodOrders });
});

module.exports = router;
