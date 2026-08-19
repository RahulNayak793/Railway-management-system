const express = require('express');
const router = express.Router();
const { isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');

let fullCateringMenu = [
  // Thalis & Meals
  { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, category: 'Thali', type: 'veg', rating: 4.8, description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Gulab Jamun & Salad', in_stock: true },
  { id: 'm2', name: 'Super Executive Non-Veg Thali', price: 310, category: 'Thali', type: 'non-veg', rating: 4.9, description: 'Butter Chicken, Egg Curry, Basmati Rice, 3 Chapatis, Mint Raita & Sweet', in_stock: true },
  { id: 'm3', name: 'Jain Special Satvik Thali', price: 220, category: 'Thali', type: 'jain', rating: 4.9, description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati, Basmati Rice & Rice Kheer', in_stock: true },
  { id: 'm4', name: 'Maharashtrian Special Thali', price: 250, category: 'Thali', type: 'veg', rating: 4.7, description: 'Puran Poli, Pithla Bhakri, Aloo Bhaji, Steamed Rice & Solkadhi', in_stock: true },
  { id: 'm5', name: 'Rajasthani Dal Baati Churma Thali', price: 260, category: 'Thali', type: 'veg', rating: 4.9, description: 'Traditional Ghee-loaded Baati with Panchmel Dal & Sweet Churma', in_stock: true },

  // Biryanis & Rice Bowls
  { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani', price: 280, category: 'Main Course', type: 'non-veg', rating: 4.9, description: 'Aromatic Basmati Rice, Tender Chicken, Egg, Mirchi Ka Salan & Raita', in_stock: true },
  { id: 'm7', name: 'Lucknowi Veg Dum Biryani Bowl', price: 210, category: 'Main Course', type: 'veg', rating: 4.8, description: 'Saffron Basmati Rice with Fresh Vegetables, Paneer & Mint Raita', in_stock: true },
  { id: 'm8', name: 'Egg Biryani Feast Box', price: 230, category: 'Main Course', type: 'non-veg', rating: 4.7, description: '2 Boiled Eggs in Spiced Basmati Biryani served with Onion Raita', in_stock: true },

  // South Indian Delights
  { id: 'm9', name: 'South Indian Tiffin Combo', price: 160, category: 'South Indian', type: 'veg', rating: 4.8, description: '2 Ghee Idlis, 1 Medu Vada, 1 Mini Masala Dosa, Piping Hot Sambar & Coconut Chutney', in_stock: true },
  { id: 'm10', name: 'Crispy Paper Masala Dosa', price: 140, category: 'South Indian', type: 'veg', rating: 4.7, description: 'Golden Rice Crepe filled with Spiced Potato Masala & Tomato Chutney', in_stock: true },

  // Snacks & Kathi Rolls
  { id: 'm11', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', rating: 4.8, description: '2 Fluffy Bhature with Spiced Chickpeas, Fried Green Chili & Pickle', in_stock: true },
  { id: 'm12', name: 'Mumbai Butter Pav Bhaji', price: 150, category: 'Snacks', type: 'veg', rating: 4.8, description: 'Butter-toasted Pav with Spicy Vegetable Bhaji, Lemon & Salad', in_stock: true },
  { id: 'm13', name: 'Grilled Paneer Tikka Kathi Roll', price: 170, category: 'Snacks', type: 'veg', rating: 4.7, description: 'Smoky Cottage Cheese with Mint Chutney in Lachha Paratha', in_stock: true },
  { id: 'm14', name: 'Spiced Chicken Kathi Roll', price: 190, category: 'Snacks', type: 'non-veg', rating: 4.8, description: 'Succulent Chicken Tikka with Tangy Spices in Malabar Paratha', in_stock: true },
  { id: 'm15', name: 'Samosa & Hot Masala Tea Pack', price: 70, category: 'Snacks', type: 'veg', rating: 4.6, description: '2 Crispy Punjabi Potato Samosas with Cutting Masala Chai', in_stock: true },

  // Sweets & Beverages
  { id: 'm16', name: 'Gulab Jamun Pair Box', price: 80, category: 'Desserts', type: 'veg', rating: 4.9, description: '2 Warm Soft Khoya Gulab Jamuns soaked in Cardamom Syrup', in_stock: true },
  { id: 'm17', name: 'Bengali Spongy Rasgulla Twin', price: 80, category: 'Desserts', type: 'veg', rating: 4.8, description: '2 Fresh Cottage Cheese Balls in Light Rose Syrup', in_stock: true },
  { id: 'm18', name: 'Fresh Mango Lassi Bottle', price: 90, category: 'Beverages', type: 'veg', rating: 4.9, description: 'Thick Creamy Alphonso Mango Yogurt Drink (300ml)', in_stock: true }
];

// Seeded food orders store
let mockFoodOrders = [
  {
    order_id: 'ORD-98421',
    txn_id: 'TXN-FOOD-948201',
    pnr_number: '2345678901',
    train_number: '12952',
    train_name: 'Rajdhani Express',
    station_code: 'NDLS',
    station_name: 'New Delhi (NDLS)',
    passenger_name: 'Rahul Sharma',
    coach_number: 'B1',
    seat_number: '24',
    items: [
      { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, qty: 2 }
    ],
    total_amount: 480,
    payment_method: 'UPI',
    payment_status: 'Paid',
    status: 'Confirmed',
    delivery_status: 'Out For Delivery to Coach B1',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    order_id: 'ORD-84910',
    txn_id: 'TXN-FOOD-849102',
    pnr_number: '7462573954',
    train_number: '12002',
    train_name: 'Shatabdi Express',
    station_code: 'BPL',
    station_name: 'Bhopal Junction (BPL)',
    passenger_name: 'Anita Verma',
    coach_number: 'C2',
    seat_number: '12',
    items: [
      { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani', price: 280, qty: 1 },
      { id: 'm18', name: 'Fresh Mango Lassi Bottle', price: 90, qty: 1 }
    ],
    total_amount: 370,
    payment_method: 'CARD',
    payment_status: 'Paid',
    status: 'Confirmed',
    delivery_status: 'Kitchen Preparing Meal 👨‍🍳',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    order_id: 'ORD-72910',
    txn_id: 'TXN-FOOD-729104',
    pnr_number: '9842105731',
    train_number: '22436',
    train_name: 'Vande Bharat Express',
    station_code: 'BSB',
    station_name: 'Varanasi Junction (BSB)',
    passenger_name: 'Suresh Patel',
    coach_number: 'C1',
    seat_number: '44',
    items: [
      { id: 'm3', name: 'Jain Special Satvik Thali', price: 220, qty: 1 }
    ],
    total_amount: 220,
    payment_method: 'COD',
    payment_status: 'Pay at Seat',
    status: 'Confirmed',
    delivery_status: 'Delivered at Berth 🍽️',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  }
];

// 1. Get Food Menu for Station / Train (Public / Passenger)
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

// 2. Place E-Catering Food Order (Passenger)
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
    train_name: 'Express Train',
    station_code: station_code || 'NDLS',
    station_name: station_code === 'MMCT' ? 'Mumbai Central (MMCT)' : station_code === 'JP' ? 'Jaipur Junction (JP)' : 'New Delhi (NDLS)',
    passenger_name: passenger_name || 'Valued Passenger',
    coach_number: coach_number || 'B1',
    seat_number: seat_number || '24',
    items,
    total_amount: total_amount || 350,
    payment_method: payment_method || 'UPI',
    payment_status: isPayOnDelivery ? 'Pay at Seat' : 'Paid',
    status: 'Confirmed',
    delivery_status: 'Kitchen Preparing Meal 👨‍🍳',
    created_at: new Date().toISOString()
  };

  mockFoodOrders.unshift(newOrder);

  return res.json({
    success: true,
    message: 'Food order placed successfully! Kitchen has received your request.',
    order: newOrder
  });
});

// 3. Get Food Orders by PNR (Passenger)
router.get('/orders', (req, res) => {
  const { pnr } = req.query;
  if (!pnr) {
    return res.json({ orders: mockFoodOrders });
  }
  const filtered = mockFoodOrders.filter(o => o.pnr_number === pnr);
  return res.json({ orders: filtered.length > 0 ? filtered : mockFoodOrders });
});

// 3.5. CANCEL Food Order (Passenger / Staff / Admin)
router.post('/orders/:order_id/cancel', (req, res) => {
  const { order_id } = req.params;

  const targetOrder = mockFoodOrders.find(o => o.order_id === order_id);
  if (!targetOrder) {
    return res.status(404).json({ error: 'Food order not found.' });
  }

  if (targetOrder.status === 'Cancelled') {
    return res.status(400).json({ error: 'Food order is already cancelled.' });
  }

  if (targetOrder.delivery_status.includes('Delivered')) {
    return res.status(400).json({ error: 'Cannot cancel an order that has already been delivered to berth.' });
  }

  targetOrder.status = 'Cancelled';
  targetOrder.delivery_status = 'Cancelled & Refunded ❌';
  if (targetOrder.payment_status === 'Paid') {
    targetOrder.payment_status = 'Refunded to Rail Wallet 👛';
  } else {
    targetOrder.payment_status = 'Cancelled (No Charge)';
  }

  return res.json({
    success: true,
    message: `Food Order #${order_id} has been cancelled successfully. Refund processed to Rail Wallet.`,
    order: targetOrder
  });
});

// 4. GET All Food Orders (Staff & Admin Pantry Management)
router.get('/all-orders', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  return res.json({
    orders: mockFoodOrders
  });
});

// 5. UPDATE Order Delivery Status (Staff & Admin)
router.put('/orders/:order_id/status', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { order_id } = req.params;
  const { delivery_status } = req.body;

  const targetOrder = mockFoodOrders.find(o => o.order_id === order_id);
  if (!targetOrder) {
    return res.status(404).json({ error: 'Food order not found' });
  }

  if (delivery_status) {
    targetOrder.delivery_status = delivery_status;
    if (delivery_status.includes('Delivered')) {
      targetOrder.status = 'Completed';
      if (targetOrder.payment_status === 'Pay at Seat') {
        targetOrder.payment_status = 'Paid (Collected at Seat)';
      }
    }
  }

  return res.json({
    success: true,
    message: `Order #${order_id} status updated successfully.`,
    order: targetOrder
  });
});

// 6. Admin Catering Stats
router.get('/admin/stats', authenticateToken, requireRoles(['admin']), (req, res) => {
  const totalOrders = mockFoodOrders.length;
  const totalRevenue = mockFoodOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const activeKitchens = 14;
  const avgRating = 4.8;

  res.json({
    totalOrders,
    totalRevenue,
    activeKitchens,
    avgRating,
    totalDishes: fullCateringMenu.length
  });
});

// 7. Admin Add New Dish to Master Menu
router.post('/admin/menu', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { name, price, category, type, description, rating = 4.8 } = req.body;

  if (!name || !price || !category || !type) {
    return res.status(400).json({ error: 'Dish name, price, category, and diet type are required.' });
  }

  const newItem = {
    id: `m${fullCateringMenu.length + 1}`,
    name,
    price: parseFloat(price),
    category,
    type,
    rating: parseFloat(rating),
    description: description || '',
    in_stock: true
  };

  fullCateringMenu.unshift(newItem);

  return res.status(201).json({
    success: true,
    message: 'New dish added to station menu successfully.',
    item: newItem
  });
});

// 8. Admin Update / Toggle Dish Stock
router.put('/admin/menu/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { name, price, category, type, description, in_stock } = req.body;

  const itemIndex = fullCateringMenu.findIndex(m => m.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Menu item not found' });
  }

  if (name !== undefined) fullCateringMenu[itemIndex].name = name;
  if (price !== undefined) fullCateringMenu[itemIndex].price = parseFloat(price);
  if (category !== undefined) fullCateringMenu[itemIndex].category = category;
  if (type !== undefined) fullCateringMenu[itemIndex].type = type;
  if (description !== undefined) fullCateringMenu[itemIndex].description = description;
  if (in_stock !== undefined) fullCateringMenu[itemIndex].in_stock = in_stock;

  return res.json({
    success: true,
    message: 'Menu item updated successfully.',
    item: fullCateringMenu[itemIndex]
  });
});

// 9. Admin Delete Dish
router.delete('/admin/menu/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  fullCateringMenu = fullCateringMenu.filter(m => m.id !== id);
  return res.json({
    success: true,
    message: 'Dish removed from menu.'
  });
});

module.exports = router;
