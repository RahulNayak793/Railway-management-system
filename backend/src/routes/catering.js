const express = require('express');
const router = express.Router();
const { isMockMode, mockDb } = require('../config/supabase');

const fullCateringMenu = [
  // Thalis & Meals
  { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, category: 'Thali', type: 'veg', rating: 4.8, description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Gulab Jamun & Salad' },
  { id: 'm2', name: 'Super Executive Non-Veg Thali', price: 310, category: 'Thali', type: 'non-veg', rating: 4.9, description: 'Butter Chicken, Egg Curry, Basmati Rice, 3 Chapatis, Mint Raita & Sweet' },
  { id: 'm3', name: 'Jain Special Satvik Thali', price: 220, category: 'Thali', type: 'jain', rating: 4.9, description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati, Basmati Rice & Rice Kheer' },
  { id: 'm4', name: 'Maharashtrian Special Thali', price: 250, category: 'Thali', type: 'veg', rating: 4.7, description: 'Puran Poli, Pithla Bhakri, Aloo Bhaji, Steamed Rice & Solkadhi' },
  { id: 'm5', name: 'Rajasthani Dal Baati Churma Thali', price: 260, category: 'Thali', type: 'veg', rating: 4.9, description: 'Traditional Ghee-loaded Baati with Panchmel Dal & Sweet Churma' },

  // Biryanis & Rice Bowls
  { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani', price: 280, category: 'Main Course', type: 'non-veg', rating: 4.9, description: 'Aromatic Basmati Rice, Tender Chicken, Egg, Mirchi Ka Salan & Raita' },
  { id: 'm7', name: 'Lucknowi Veg Dum Biryani Bowl', price: 210, category: 'Main Course', type: 'veg', rating: 4.8, description: 'Saffron Basmati Rice with Fresh Vegetables, Paneer & Mint Raita' },
  { id: 'm8', name: 'Egg Biryani Feast Box', price: 230, category: 'Main Course', type: 'non-veg', rating: 4.7, description: '2 Boiled Eggs in Spiced Basmati Biryani served with Onion Raita' },

  // South Indian Delights
  { id: 'm9', name: 'South Indian Tiffin Combo', price: 160, category: 'South Indian', type: 'veg', rating: 4.8, description: '2 Ghee Idlis, 1 Medu Vada, 1 Mini Masala Dosa, Piping Hot Sambar & Coconut Chutney' },
  { id: 'm10', name: 'Crispy Paper Masala Dosa', price: 140, category: 'South Indian', type: 'veg', rating: 4.7, description: 'Golden Rice Crepe filled with Spiced Potato Masala & Tomato Chutney' },

  // Snacks & Kathi Rolls
  { id: 'm11', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', rating: 4.8, description: '2 Fluffy Bhature with Spiced Chickpeas, Fried Green Chili & Pickle' },
  { id: 'm12', name: 'Mumbai Butter Pav Bhaji', price: 150, category: 'Snacks', type: 'veg', rating: 4.8, description: 'Butter-toasted Pav with Spicy Vegetable Bhaji, Lemon & Salad' },
  { id: 'm13', name: 'Grilled Paneer Tikka Kathi Roll', price: 170, category: 'Snacks', type: 'veg', rating: 4.7, description: 'Smoky Cottage Cheese with Mint Chutney in Lachha Paratha' },
  { id: 'm14', name: 'Spiced Chicken Kathi Roll', price: 190, category: 'Snacks', type: 'non-veg', rating: 4.8, description: 'Succulent Chicken Tikka with Tangy Spices in Malabar Paratha' },
  { id: 'm15', name: 'Samosa & Hot Masala Tea Pack', price: 70, category: 'Snacks', type: 'veg', rating: 4.6, description: '2 Crispy Punjabi Potato Samosas with Cutting Masala Chai' },

  // Sweets & Beverages
  { id: 'm16', name: 'Gulab Jamun Pair Box', price: 80, category: 'Desserts', type: 'veg', rating: 4.9, description: '2 Warm Soft Khoya Gulab Jamuns soaked in Cardamom Syrup' },
  { id: 'm17', name: 'Bengali Spongy Rasgulla Twin', price: 80, category: 'Desserts', type: 'veg', rating: 4.8, description: '2 Fresh Cottage Cheese Balls in Light Rose Syrup' },
  { id: 'm18', name: 'Fresh Mango Lassi Bottle', price: 90, category: 'Beverages', type: 'veg', rating: 4.9, description: 'Thick Creamy Alphonso Mango Yogurt Drink (300ml)' }
];

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
  const { filter = 'all' } = req.query;
  
  let filtered = fullCateringMenu;
  if (filter !== 'all') {
    filtered = fullCateringMenu.filter(item => item.type === filter);
  }

  res.json({
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
