const express = require('express');
const router = express.Router();
const { isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Initial Master Catering Menu mapped to Authorized Companies
let fullCateringMenu = [
  // IRCTC Executive Pantry (comp-1) - Stations: NDLS, DLI, NZM, CNB, AGC, JP
  { id: 'm1', company_id: 'comp-1', name: 'Deluxe North Indian Thali', price: 240, category: 'Thali', type: 'veg', rating: 4.8, description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Gulab Jamun & Salad', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm2', company_id: 'comp-1', name: 'Super Executive Non-Veg Thali', price: 310, category: 'Thali', type: 'non-veg', rating: 4.9, description: 'Butter Chicken, Egg Curry, Basmati Rice, 3 Chapatis, Mint Raita & Sweet', in_stock: true, is_available: true, prep_time_mins: 25 },
  { id: 'm11', company_id: 'comp-1', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', rating: 4.8, description: '2 Fluffy Bhature with Spiced Chickpeas, Fried Green Chili & Pickle', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm15', company_id: 'comp-1', name: 'Samosa & Hot Masala Tea Pack', price: 70, category: 'Snacks', type: 'veg', rating: 4.6, description: '2 Crispy Punjabi Potato Samosas with Cutting Masala Chai', in_stock: true, is_available: true, prep_time_mins: 10 },

  // MP Rail Catering Services (comp-2) - Stations: BPL, GWL, VGLJ, ET, RTM, UJN, INDB
  { id: 'm4', company_id: 'comp-2', name: 'Maharashtrian Special Thali', price: 250, category: 'Thali', type: 'veg', rating: 4.7, description: 'Puran Poli, Pithla Bhakri, Aloo Bhaji, Steamed Rice & Solkadhi', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm6', company_id: 'comp-2', name: 'Hyderabadi Chicken Dum Biryani', price: 280, category: 'Main Course', type: 'non-veg', rating: 4.9, description: 'Aromatic Basmati Rice, Tender Chicken, Egg, Mirchi Ka Salan & Raita', in_stock: true, is_available: true, prep_time_mins: 25 },
  { id: 'm12', company_id: 'comp-2', name: 'Mumbai Butter Pav Bhaji', price: 150, category: 'Snacks', type: 'veg', rating: 4.8, description: 'Butter-toasted Pav with Spicy Vegetable Bhaji, Lemon & Salad', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm18', company_id: 'comp-2', name: 'Fresh Mango Lassi Bottle', price: 90, category: 'Beverages', type: 'veg', rating: 4.9, description: 'Thick Creamy Alphonso Mango Yogurt Drink (300ml)', in_stock: true, is_available: true, prep_time_mins: 5 },

  // Varanasi Satvik Kitchen (comp-3) - Stations: BSB, PRYJ, DDU, LKO, GKP
  { id: 'm3', company_id: 'comp-3', name: 'Jain Special Satvik Thali', price: 220, category: 'Thali', type: 'jain', rating: 4.9, description: 'No Onion No Garlic Paneer, Yellow Dal, Chapati, Basmati Rice & Rice Kheer', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm7', company_id: 'comp-3', name: 'Lucknowi Veg Dum Biryani Bowl', price: 210, category: 'Main Course', type: 'veg', rating: 4.8, description: 'Saffron Basmati Rice with Fresh Vegetables, Paneer & Mint Raita', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm16', company_id: 'comp-3', name: 'Gulab Jamun Pair Box', price: 80, category: 'Desserts', type: 'veg', rating: 4.9, description: '2 Warm Soft Khoya Gulab Jamuns soaked in Cardamom Syrup', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm17', company_id: 'comp-3', name: 'Bengali Spongy Rasgulla Twin', price: 80, category: 'Desserts', type: 'veg', rating: 4.8, description: '2 Fresh Cottage Cheese Balls in Light Rose Syrup', in_stock: true, is_available: true, prep_time_mins: 5 },

  // Coastal Rail Foods (comp-4) - Stations: MAQ, UD, MAO, ERS, SBC, CLT, CAN
  { id: 'm9', company_id: 'comp-4', name: 'South Indian Tiffin Combo', price: 160, category: 'South Indian', type: 'veg', rating: 4.8, description: '2 Ghee Idlis, 1 Medu Vada, 1 Mini Masala Dosa, Piping Hot Sambar & Coconut Chutney', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm10', company_id: 'comp-4', name: 'Crispy Paper Masala Dosa', price: 140, category: 'South Indian', type: 'veg', rating: 4.7, description: 'Golden Rice Crepe filled with Spiced Potato Masala & Tomato Chutney', in_stock: true, is_available: true, prep_time_mins: 15 },

  // Western Gourmet Express (comp-5) - Stations: MMCT, BDTS, ST, BRC, ADI, PUNE, KOTA
  { id: 'm5', company_id: 'comp-5', name: 'Rajasthani Dal Baati Churma Thali', price: 260, category: 'Thali', type: 'veg', rating: 4.9, description: 'Traditional Ghee-loaded Baati with Panchmel Dal & Sweet Churma', in_stock: true, is_available: true, prep_time_mins: 25 },
  { id: 'm8', company_id: 'comp-5', name: 'Egg Biryani Feast Box', price: 230, category: 'Main Course', type: 'non-veg', rating: 4.7, description: '2 Boiled Eggs in Spiced Basmati Biryani served with Onion Raita', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm13', company_id: 'comp-5', name: 'Grilled Paneer Tikka Kathi Roll', price: 170, category: 'Snacks', type: 'veg', rating: 4.7, description: 'Smoky Cottage Cheese with Mint Chutney in Lachha Paratha', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm14', company_id: 'comp-5', name: 'Spiced Chicken Kathi Roll', price: 190, category: 'Snacks', type: 'non-veg', rating: 4.8, description: 'Succulent Chicken Tikka with Tangy Spices in Malabar Paratha', in_stock: true, is_available: true, prep_time_mins: 15 }
];

// Seeded food orders store with company_id attribute
let mockFoodOrders = [
  {
    order_id: 'ORD-98421',
    txn_id: 'TXN-FOOD-948201',
    company_id: 'comp-1',
    pnr_number: '2345678901',
    train_number: '12952',
    train_name: 'Rajdhani Express',
    station_code: 'NDLS',
    delivery_station_code: 'NDLS',
    station_name: 'New Delhi (NDLS)',
    passenger_name: 'Rahul Sharma',
    coach_number: 'B1',
    seat_number: '24',
    items: [
      { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, qty: 2, company_id: 'comp-1' }
    ],
    total_amount: 480,
    payment_method: 'UPI',
    payment_status: 'Paid',
    status: 'OUT_FOR_DELIVERY',
    delivery_status: 'Out For Delivery to Coach B1',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    order_id: 'ORD-84910',
    txn_id: 'TXN-FOOD-849102',
    company_id: 'comp-2',
    pnr_number: '7462573954',
    train_number: '12002',
    train_name: 'Shatabdi Express',
    station_code: 'BPL',
    delivery_station_code: 'BPL',
    station_name: 'Bhopal Junction (BPL)',
    passenger_name: 'Anita Verma',
    coach_number: 'C2',
    seat_number: '12',
    items: [
      { id: 'm6', name: 'Hyderabadi Chicken Dum Biryani', price: 280, qty: 1, company_id: 'comp-2' },
      { id: 'm18', name: 'Fresh Mango Lassi Bottle', price: 90, qty: 1, company_id: 'comp-2' }
    ],
    total_amount: 370,
    payment_method: 'CARD',
    payment_status: 'Paid',
    status: 'PREPARING',
    delivery_status: 'Kitchen Preparing Meal 👨‍🍳',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    order_id: 'ORD-72910',
    txn_id: 'TXN-FOOD-729104',
    company_id: 'comp-3',
    pnr_number: '9842105731',
    train_number: '22436',
    train_name: 'Vande Bharat Express',
    station_code: 'BSB',
    delivery_station_code: 'BSB',
    station_name: 'Varanasi Junction (BSB)',
    passenger_name: 'Suresh Patel',
    coach_number: 'C1',
    seat_number: '44',
    items: [
      { id: 'm3', name: 'Jain Special Satvik Thali', price: 220, qty: 1, company_id: 'comp-3' }
    ],
    total_amount: 220,
    payment_method: 'COD',
    payment_status: 'Pay at Seat',
    status: 'DELIVERED',
    delivery_status: 'Delivered at Berth 🍽️',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  }
];

// Helper to resolve company list from mockDb or local state
function getCompaniesList() {
  if (mockDb.catering_companies && mockDb.catering_companies.size > 0) {
    return Array.from(mockDb.catering_companies.values());
  }
  return [
    { id: 'comp-1', company_name: 'IRCTC Executive Pantry', legal_name: 'Indian Railway Catering and Tourism Corp. Ltd.', contact_name: 'Rajesh Sharma', phone: '+91 9811002233', email: 'pantry@irctc.co.in', fssai_number: '10019011000234', address: 'IRCTC Office, Delhi', status: 'AUTHORIZED', authorization_start: '2025-01-01T00:00:00Z', authorization_end: '2027-12-31T23:59:59Z', stations: ['NDLS', 'DLI', 'NZM', 'CNB', 'AGC', 'JP'] },
    { id: 'comp-2', company_name: 'MP Rail Catering Services', legal_name: 'MP Gourmet Rail Foods Pvt Ltd', contact_name: 'Vikram Chouhan', phone: '+91 9425012345', email: 'support@mprailcatering.com', fssai_number: '11521004000891', address: 'Bhopal MP', status: 'AUTHORIZED', authorization_start: '2025-01-01T00:00:00Z', authorization_end: '2027-12-31T23:59:59Z', stations: ['BPL', 'GWL', 'VGLJ', 'ET', 'RTM', 'UJN', 'INDB'] },
    { id: 'comp-3', company_name: 'Varanasi Satvik Kitchen', legal_name: 'Kashi Satvik Foods', contact_name: 'Pt. Rameshwar Mishra', phone: '+91 9935098765', email: 'orders@satvikkitchen.in', fssai_number: '12720002000512', address: 'Varanasi UP', status: 'AUTHORIZED', authorization_start: '2025-01-01T00:00:00Z', authorization_end: '2027-12-31T23:59:59Z', stations: ['BSB', 'PRYJ', 'DDU', 'LKO', 'GKP'] },
    { id: 'comp-4', company_name: 'Coastal Rail Foods', legal_name: 'Malabar Express Catering', contact_name: 'K. V. Shetty', phone: '+91 9845033445', email: 'contact@coastalrailfoods.com', fssai_number: '11222005000109', address: 'Mangaluru KA', status: 'AUTHORIZED', authorization_start: '2025-01-01T00:00:00Z', authorization_end: '2027-12-31T23:59:59Z', stations: ['MAQ', 'UD', 'MAO', 'ERS', 'SBC', 'CLT', 'CAN'] },
    { id: 'comp-5', company_name: 'Western Gourmet Express', legal_name: 'Gujarat Feasts LLP', contact_name: 'Anil Patel', phone: '+91 9825088776', email: 'info@westerngourmet.in', fssai_number: '10821009000341', address: 'Vadodara GJ', status: 'AUTHORIZED', authorization_start: '2025-01-01T00:00:00Z', authorization_end: '2027-12-31T23:59:59Z', stations: ['MMCT', 'BDTS', 'ST', 'BRC', 'ADI', 'PUNE', 'KOTA'] }
  ];
}

// Helper to resolve user's vendor company id
function resolveVendorCompanyId(req) {
  if (req.user && req.user.catering_company_id) {
    return req.user.catering_company_id;
  }
  // Fallback demo mapping for development / testing
  if (req.query.vendor_id) return req.query.vendor_id;
  if (req.headers['x-company-id']) return req.headers['x-company-id'];
  return 'comp-1'; // Default fallback vendor
}

// ==========================================
// 1. ADMIN AUTHORIZATION & VENDOR CONTROL ENDPOINTS
// ==========================================

// GET /api/catering/companies - List all companies with station mappings & stats
router.get('/companies', (req, res) => {
  const companies = getCompaniesList();
  const enhanced = companies.map(comp => {
    const compOrders = mockFoodOrders.filter(o => o.company_id === comp.id);
    const totalRevenue = compOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const compDishes = fullCateringMenu.filter(m => m.company_id === comp.id);
    return {
      ...comp,
      stations: comp.stations || [],
      total_orders: compOrders.length,
      total_revenue: totalRevenue,
      total_dishes: compDishes.length
    };
  });
  return res.json({ companies: enhanced });
});

// POST /api/catering/admin/companies - Add new catering company (Admin only)
router.post('/admin/companies', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { company_name, legal_name, contact_name, phone, email, fssai_number, address, stations = [], authorization_start, authorization_end } = req.body;

  if (!company_name || !legal_name || !fssai_number || !email) {
    return res.status(400).json({ error: 'Company Name, Legal Name, FSSAI Number and Email are required.' });
  }

  const existingComps = getCompaniesList();
  if (existingComps.some(c => c.fssai_number === fssai_number || c.email === email)) {
    return res.status(400).json({ error: 'A catering company with this FSSAI Number or Email already exists.' });
  }

  const newComp = {
    id: `comp-${Date.now()}`,
    company_name,
    legal_name,
    contact_name: contact_name || '',
    phone: phone || '',
    email,
    fssai_number,
    address: address || '',
    status: 'AUTHORIZED',
    authorized_by: req.user.id,
    authorized_at: new Date().toISOString(),
    authorization_start: authorization_start || new Date().toISOString(),
    authorization_end: authorization_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    stations: Array.isArray(stations) ? stations : []
  };

  mockDb.catering_companies.set(newComp.id, newComp);
  (newComp.stations || []).forEach(st => {
    mockDb.company_stations.set(`${newComp.id}_${st}`, { company_id: newComp.id, station_code: st });
  });

  return res.status(201).json({
    success: true,
    message: `Catering Company "${company_name}" created & authorized successfully.`,
    company: newComp
  });
});

// PUT /api/catering/admin/companies/:id - Update company authorization details (Admin only)
router.put('/admin/companies/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { company_name, legal_name, contact_name, phone, email, fssai_number, address, stations, authorization_start, authorization_end, status } = req.body;

  let comp = mockDb.catering_companies.get(id);
  if (!comp) {
    const list = getCompaniesList();
    comp = list.find(c => c.id === id);
  }

  if (!comp) {
    return res.status(404).json({ error: 'Catering company not found.' });
  }

  if (company_name !== undefined) comp.company_name = company_name;
  if (legal_name !== undefined) comp.legal_name = legal_name;
  if (contact_name !== undefined) comp.contact_name = contact_name;
  if (phone !== undefined) comp.phone = phone;
  if (email !== undefined) comp.email = email;
  if (fssai_number !== undefined) comp.fssai_number = fssai_number;
  if (address !== undefined) comp.address = address;
  if (status !== undefined) comp.status = status;
  if (authorization_start !== undefined) comp.authorization_start = authorization_start;
  if (authorization_end !== undefined) comp.authorization_end = authorization_end;
  if (stations !== undefined && Array.isArray(stations)) {
    comp.stations = stations;
  }

  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  return res.json({
    success: true,
    message: `Authorization parameters for ${comp.company_name} updated successfully.`,
    company: comp
  });
});

// POST /api/catering/admin/companies/:id/authorize - Authorize company (Admin only)
router.post('/admin/companies/:id/authorize', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  comp.status = 'AUTHORIZED';
  comp.authorized_at = new Date().toISOString();
  comp.authorized_by = req.user.id;
  mockDb.catering_companies.set(id, comp);

  return res.json({
    success: true,
    message: `Catering Company "${comp.company_name}" has been AUTHORIZED.`,
    company: comp
  });
});

// POST /api/catering/admin/companies/:id/suspend - Suspend authorization (Admin only)
router.post('/admin/companies/:id/suspend', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  comp.status = 'SUSPENDED';
  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  return res.json({
    success: true,
    message: `Authorization for "${comp.company_name}" has been SUSPENDED.`,
    company: comp
  });
});

// POST /api/catering/admin/companies/:id/revoke - Revoke authorization (Admin only)
router.post('/admin/companies/:id/revoke', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  comp.status = 'REVOKED';
  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  return res.json({
    success: true,
    message: `Authorization for "${comp.company_name}" has been REVOKED.`,
    company: comp
  });
});

// GET /api/catering/admin/stats - Admin platform overview
router.get('/admin/stats', authenticateToken, requireRoles(['admin']), (req, res) => {
  const companies = getCompaniesList();
  const authorizedCount = companies.filter(c => c.status === 'AUTHORIZED').length;
  const totalOrders = mockFoodOrders.length;
  const totalRevenue = mockFoodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return res.json({
    totalCompanies: companies.length,
    authorizedCompanies: authorizedCount,
    totalOrders,
    totalRevenue,
    avgRating: 4.8,
    totalDishes: fullCateringMenu.length
  });
});

// ==========================================
// 2. CATERING COMPANY / VENDOR DASHBOARD ENDPOINTS
// ==========================================

// GET /api/catering/company/profile - Company Vendor profile
router.get('/company/profile', authenticateToken, requireRoles(['catering_company', 'admin', 'staff', 'passenger']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  let comp = mockDb.catering_companies.get(companyId);
  if (!comp) comp = getCompaniesList().find(c => c.id === companyId) || getCompaniesList()[0];

  return res.json({ company: comp });
});

// GET /api/catering/company/menu - Get menu owned strictly by authenticated company
router.get('/company/menu', authenticateToken, requireRoles(['catering_company', 'admin', 'staff', 'passenger']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  const companyDishes = fullCateringMenu.filter(m => m.company_id === companyId);
  return res.json({ menu: companyDishes });
});

// POST /api/catering/company/menu - Add meal dish owned by company
router.post('/company/menu', authenticateToken, requireRoles(['catering_company', 'admin', 'staff']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  const { name, price, category, type = 'veg', description, prep_time_mins = 20, in_stock = true } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Dish name, price, and category are required.' });
  }

  // Check company is authorized
  const comp = getCompaniesList().find(c => c.id === companyId);
  if (comp && comp.status !== 'AUTHORIZED') {
    return res.status(403).json({ error: 'Unauthorized vendor cannot publish menu items.' });
  }

  const newItem = {
    id: `m-${Date.now()}`,
    company_id: companyId,
    name,
    price: parseFloat(price),
    category,
    type,
    rating: 5.0,
    description: description || '',
    in_stock: Boolean(in_stock),
    is_available: true,
    prep_time_mins: parseInt(prep_time_mins, 10) || 20
  };

  fullCateringMenu.unshift(newItem);

  return res.status(201).json({
    success: true,
    message: 'Meal item added to your company menu successfully.',
    item: newItem
  });
});

// PUT /api/catering/company/menu/:id - Edit meal dish owned strictly by company
router.put('/company/menu/:id', authenticateToken, requireRoles(['catering_company', 'admin', 'staff']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  const { id } = req.params;
  const { name, price, category, type, description, in_stock, is_available, prep_time_mins } = req.body;

  const itemIndex = fullCateringMenu.findIndex(m => m.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Meal item not found.' });
  }

  // Enforce company ownership!
  if (fullCateringMenu[itemIndex].company_id !== companyId && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. You can only edit meals belonging to your company.' });
  }

  if (name !== undefined) fullCateringMenu[itemIndex].name = name;
  if (price !== undefined) fullCateringMenu[itemIndex].price = parseFloat(price);
  if (category !== undefined) fullCateringMenu[itemIndex].category = category;
  if (type !== undefined) fullCateringMenu[itemIndex].type = type;
  if (description !== undefined) fullCateringMenu[itemIndex].description = description;
  if (in_stock !== undefined) fullCateringMenu[itemIndex].in_stock = Boolean(in_stock);
  if (is_available !== undefined) fullCateringMenu[itemIndex].is_available = Boolean(is_available);
  if (prep_time_mins !== undefined) fullCateringMenu[itemIndex].prep_time_mins = parseInt(prep_time_mins, 10);

  return res.json({
    success: true,
    message: 'Meal item updated successfully.',
    item: fullCateringMenu[itemIndex]
  });
});

// DELETE /api/catering/company/menu/:id - Delete meal dish owned strictly by company
router.delete('/company/menu/:id', authenticateToken, requireRoles(['catering_company', 'admin', 'staff']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  const { id } = req.params;

  const item = fullCateringMenu.find(m => m.id === id);
  if (!item) return res.status(404).json({ error: 'Meal item not found.' });

  if (item.company_id !== companyId && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. You can only delete meals belonging to your company.' });
  }

  fullCateringMenu = fullCateringMenu.filter(m => m.id !== id);

  return res.json({
    success: true,
    message: 'Meal item removed from your menu.'
  });
});

// GET /api/catering/company/orders - Get orders assigned to the vendor company
router.get('/company/orders', authenticateToken, requireRoles(['catering_company', 'admin', 'staff', 'passenger']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  const companyOrders = mockFoodOrders.filter(o => o.company_id === companyId);
  return res.json({ orders: companyOrders });
});

// PUT /api/catering/company/orders/:id/status - Update delivery status by company staff
router.put('/company/orders/:id/status', authenticateToken, requireRoles(['catering_company', 'staff', 'admin']), (req, res) => {
  const companyId = resolveVendorCompanyId(req);
  const { id } = req.params;
  const { status, delivery_status } = req.body;

  const order = mockFoodOrders.find(o => o.order_id === id || o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Food order not found.' });
  }

  // Enforce company order ownership
  if (order.company_id !== companyId && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. You cannot modify orders assigned to another company.' });
  }

  if (status) order.status = status;
  if (delivery_status) order.delivery_status = delivery_status;

  if (status === 'DELIVERED') {
    order.delivery_status = 'Delivered at Berth 🍽️';
    if (order.payment_status === 'Pay at Seat') {
      order.payment_status = 'Paid (Collected at Seat)';
    }
  } else if (status === 'PREPARING') {
    order.delivery_status = 'Kitchen Preparing Meal 👨‍🍳';
  } else if (status === 'OUT_FOR_DELIVERY') {
    order.delivery_status = `Out For Delivery to Coach ${order.coach_number || ''}`;
  }

  return res.json({
    success: true,
    message: `Order #${id} status updated to ${status || delivery_status}.`,
    order
  });
});

// ==========================================
// 3. PASSENGER LOCATION-BASED MEAL API & ORDERING
// ==========================================

// GET /api/catering/menu - Fetch meals filtered by Station Code, Train, & Journey Date
router.get('/menu', (req, res) => {
  const { station_code, train_id, journey_date, filter = 'all' } = req.query;
  const targetStation = (station_code || 'NDLS').toUpperCase();
  const targetDate = journey_date ? new Date(journey_date) : new Date();

  // 1. Get all authorized companies mapped to targetStation
  const companies = getCompaniesList();
  const authorizedCompanies = companies.filter(comp => {
    if (comp.status !== 'AUTHORIZED') return false;

    // Check date validity window
    if (comp.authorization_start && new Date(comp.authorization_start) > targetDate) return false;
    if (comp.authorization_end && new Date(comp.authorization_end) < targetDate) return false;

    // Check station authorization mapping
    const isStationAuthorized = (comp.stations || []).map(s => s.toUpperCase()).includes(targetStation);
    return isStationAuthorized;
  });

  const authorizedCompanyIds = new Set(authorizedCompanies.map(c => c.id));
  const companyMap = new Map(authorizedCompanies.map(c => [c.id, c]));

  // 2. Fetch meals belonging ONLY to authorized companies for target station
  let availableDishes = fullCateringMenu.filter(item => {
    if (!item.in_stock || item.is_available === false) return false;
    if (!authorizedCompanyIds.has(item.company_id)) return false;
    if (filter !== 'all' && item.type !== filter) return false;
    return true;
  });

  // 3. Enrich dishes with Company Name and FSSAI metadata
  const enrichedMenu = availableDishes.map(dish => {
    const comp = companyMap.get(dish.company_id) || {};
    return {
      ...dish,
      company_name: comp.company_name || 'Authorized Rail Caterer',
      fssai_number: comp.fssai_number || 'FSSAI-APPROVED',
      delivery_station: targetStation,
      provider_info: `${comp.company_name || 'Authorized Caterer'} (FSSAI: ${comp.fssai_number || 'Approved'})`
    };
  });

  return res.json({
    station_code: targetStation,
    authorized_companies_count: authorizedCompanies.length,
    authorized_companies: authorizedCompanies.map(c => ({ id: c.id, company_name: c.company_name, fssai_number: c.fssai_number })),
    menu: enrichedMenu
  });
});

// POST /api/catering/order - Place order with Server-Side Authorization & Price Validation
router.post('/order', (req, res) => {
  const { pnr_number, train_number, station_code, journey_date, coach_number, seat_number, passenger_name, items, payment_method = 'UPI' } = req.body;

  if (!pnr_number || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'PNR number and at least one menu item are required.' });
  }

  const deliveryStation = (station_code || 'NDLS').toUpperCase();
  const orderDate = journey_date ? new Date(journey_date) : new Date();

  // 1. Verify Authorized Companies at the selected station
  const companies = getCompaniesList();
  const authorizedCompanies = companies.filter(c => {
    if (c.status !== 'AUTHORIZED') return false;
    if (c.authorization_start && new Date(c.authorization_start) > orderDate) return false;
    if (c.authorization_end && new Date(c.authorization_end) < orderDate) return false;
    return (c.stations || []).map(s => s.toUpperCase()).includes(deliveryStation);
  });

  if (authorizedCompanies.length === 0) {
    return res.status(400).json({ error: `No authorized catering companies available at station ${deliveryStation}.` });
  }

  const authorizedCompanyIds = new Set(authorizedCompanies.map(c => c.id));

  // 2. Validate items & Recalculate price on SERVER (do NOT trust client price)
  let calculatedTotal = 0;
  let primaryCompanyId = null;
  const validatedItems = [];

  for (const rawItem of items) {
    const dish = fullCateringMenu.find(m => m.id === (rawItem.id || rawItem.meal_id));
    if (!dish) {
      return res.status(400).json({ error: `Selected meal dish item not found.` });
    }

    if (!dish.in_stock || dish.is_available === false) {
      return res.status(400).json({ error: `Dish "${dish.name}" is currently out of stock.` });
    }

    if (!authorizedCompanyIds.has(dish.company_id)) {
      return res.status(403).json({ error: `Dish "${dish.name}" is provided by a vendor not authorized at station ${deliveryStation}.` });
    }

    const qty = Math.max(1, parseInt(rawItem.qty || 1, 10));
    calculatedTotal += dish.price * qty;
    if (!primaryCompanyId) primaryCompanyId = dish.company_id;

    validatedItems.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      qty,
      company_id: dish.company_id
    });
  }

  const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const txnId = `TXN-FOOD-${Math.floor(100000 + Math.random() * 900000)}`;
  const isPayOnDelivery = payment_method === 'COD' || payment_method === 'Pay at Seat';

  const newOrder = {
    order_id: orderId,
    txn_id: txnId,
    company_id: primaryCompanyId || authorizedCompanies[0].id,
    pnr_number,
    train_number: train_number || '12952',
    train_name: 'Express Train',
    station_code: deliveryStation,
    delivery_station_code: deliveryStation,
    station_name: deliveryStation,
    journey_date: journey_date || new Date().toISOString().split('T')[0],
    passenger_name: passenger_name || 'Valued Passenger',
    coach_number: coach_number || 'B1',
    seat_number: seat_number || '24',
    items: validatedItems,
    total_amount: calculatedTotal, // Verified Server-Side Total
    payment_method,
    payment_status: isPayOnDelivery ? 'Pay at Seat' : 'Paid',
    status: 'PLACED',
    delivery_status: 'Kitchen Preparing Meal 👨‍🍳',
    created_at: new Date().toISOString()
  };

  mockFoodOrders.unshift(newOrder);

  return res.json({
    success: true,
    message: 'Food order validated & placed successfully! Authorized catering kitchen has received your request.',
    order: newOrder
  });
});

// GET /api/catering/orders - Get Food Orders by PNR (Passenger)
router.get('/orders', (req, res) => {
  const { pnr } = req.query;
  if (!pnr) {
    return res.json({ orders: mockFoodOrders });
  }
  const filtered = mockFoodOrders.filter(o => o.pnr_number === pnr);
  return res.json({ orders: filtered.length > 0 ? filtered : mockFoodOrders });
});

// CANCEL Food Order (Passenger / Staff / Admin)
router.post('/orders/:order_id/cancel', (req, res) => {
  const { order_id } = req.params;

  const targetOrder = mockFoodOrders.find(o => o.order_id === order_id);
  if (!targetOrder) {
    return res.status(404).json({ error: 'Food order not found.' });
  }

  if (targetOrder.status === 'CANCELLED' || targetOrder.status === 'Cancelled') {
    return res.status(400).json({ error: 'Food order is already cancelled.' });
  }

  if (targetOrder.delivery_status.includes('Delivered')) {
    return res.status(400).json({ error: 'Cannot cancel an order that has already been delivered to berth.' });
  }

  targetOrder.status = 'CANCELLED';
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

// GET /api/catering/all-orders - Staff & Admin viewing manifest
router.get('/all-orders', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  return res.json({
    orders: mockFoodOrders
  });
});

module.exports = router;
