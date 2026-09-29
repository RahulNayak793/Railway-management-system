/**
 * On-Board Train Catering Service
 * 
 * Manages train-specific on-board catering configurations, provider assignment,
 * pantry service types, class eligibility, and on-board food menu availability.
 * 
 * Architecture:
 * Train -> Authorized On-Board Catering Provider -> Pantry/Catering Staff -> Coach & Berth -> Passenger
 */

const { mockDb, saveMockDbToFile } = require('../config/supabase');
const { normalizeClassCode } = require('../utils/cateringEligibilityHelper');

// Known default train on-board catering setups for realistic Indian Railway operation
const DEFAULT_ONBOARD_TRAIN_CONFIGS = {
  // Udupi - New Delhi Superfast Express
  '20104': {
    train_number: '20104',
    train_name: 'Udupi - New Delhi Superfast Express',
    route: 'Udupi (UD) ⇄ New Delhi (NDLS)',
    source: 'UD',
    destination: 'NDLS',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Full Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
    applicable_classes: ['1A', '2A', '3A', 'SL'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 48,
    cutoff_minutes_before_destination: 60
  },
  '20103': {
    train_number: '20103',
    train_name: 'New Delhi - Udupi Superfast Express',
    route: 'New Delhi (NDLS) ⇄ Udupi (UD)',
    source: 'NDLS',
    destination: 'UD',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Full Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
    applicable_classes: ['1A', '2A', '3A', 'SL'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 48,
    cutoff_minutes_before_destination: 60
  },
  // New Delhi - Mumbai Central Tejas Rajdhani Express
  '12952': {
    train_number: '12952',
    train_name: 'New Delhi Tejas Rajdhani Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Full Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
    applicable_classes: ['1A', '2A', '3A'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 48,
    cutoff_minutes_before_destination: 60
  },
  '12951': {
    train_number: '12951',
    train_name: 'Mumbai Tejas Rajdhani Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Full Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
    applicable_classes: ['1A', '2A', '3A'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 48,
    cutoff_minutes_before_destination: 60
  },
  // Vande Bharat Express (New Delhi - Varanasi)
  '22436': {
    train_number: '22436',
    train_name: 'New Delhi Vande Bharat Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'On-Board Tray Service',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages'],
    applicable_classes: ['EC', 'CC'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 24,
    cutoff_minutes_before_destination: 45
  },
  '22435': {
    train_number: '22435',
    train_name: 'Varanasi Vande Bharat Express',
    catering_available: true,
    provider_id: 'comp-3',
    provider_name: 'Varanasi Satvik Kitchen',
    pantry_type: 'On-Board Tray Service',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages'],
    applicable_classes: ['EC', 'CC'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 24,
    cutoff_minutes_before_destination: 45
  },
  // Bhopal Shatabdi Express
  '12001': {
    train_number: '12001',
    train_name: 'New Delhi - Bhopal Shatabdi Express',
    catering_available: true,
    provider_id: 'comp-2',
    provider_name: 'MP Rail Catering Services',
    pantry_type: 'Mini Pantry',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages'],
    applicable_classes: ['EC', 'CC'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 24,
    cutoff_minutes_before_destination: 45
  },
  '12002': {
    train_number: '12002',
    train_name: 'Rani Kamalapati - New Delhi Shatabdi Express',
    catering_available: true,
    provider_id: 'comp-2',
    provider_name: 'MP Rail Catering Services',
    pantry_type: 'Mini Pantry',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages'],
    applicable_classes: ['EC', 'CC'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 24,
    cutoff_minutes_before_destination: 45
  },
  '12051': {
    train_number: '12051',
    train_name: 'Mumbai CSMT - Madgaon Jan Shatabdi Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages'],
    applicable_classes: ['CC', '2S'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 24,
    cutoff_minutes_before_destination: 45
  },
  '12052': {
    train_number: '12052',
    train_name: 'Madgaon - Mumbai CSMT Jan Shatabdi Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages'],
    applicable_classes: ['CC', '2S'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 24,
    cutoff_minutes_before_destination: 45
  },
  '12617': {
    train_number: '12617',
    train_name: 'Ernakulam Mangala Lakshadweep Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Full Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
    applicable_classes: ['2A', '3A', 'SL'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 48,
    cutoff_minutes_before_destination: 60
  },
  '12618': {
    train_number: '12618',
    train_name: 'Hazrat Nizamuddin Mangala Lakshadweep Express',
    catering_available: true,
    provider_id: 'comp-1',
    provider_name: 'IRCTC Executive Pantry',
    pantry_type: 'Full Pantry Car',
    food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
    applicable_classes: ['2A', '3A', 'SL'],
    service_start_date: '2025-01-01',
    service_end_date: '2028-12-31',
    active_status: 'ACTIVE',
    ordering_window_hours_before_journey: 48,
    cutoff_minutes_before_destination: 60
  }
};

/**
 * Helper to check if a train connects Udupi (UD) and New Delhi (NDLS/NZM/Delhi)
 */
function isTrainConnectingUdupiAndDelhi(train) {
  if (!train) return false;
  const src = String(train.source || train.source_station_code || train.from || '').trim().toUpperCase();
  const dest = String(train.destination || train.destination_station_code || train.to || '').trim().toUpperCase();
  const name = String(train.train_name || train.name || '').toUpperCase();

  const isUdupi = (code) => code === 'UD' || code === 'UDU' || code.includes('UDUPI');
  const isDelhi = (code) => code === 'NDLS' || code === 'NZM' || code === 'DLI' || code === 'ANVT' || code.includes('DELHI');

  if (isUdupi(src) && isDelhi(dest)) return true;

  if (Array.isArray(train.stops) && train.stops.length > 0) {
    const udIdx = train.stops.findIndex(s => {
      const c = String(s.stationCode || s.station_code || s.code || s.station || '').toUpperCase();
      return isUdupi(c);
    });
    const delIdx = train.stops.findIndex(s => {
      const c = String(s.stationCode || s.station_code || s.code || s.station || '').toUpperCase();
      return isDelhi(c);
    });
    if (udIdx !== -1 && delIdx !== -1 && udIdx < delIdx) return true;
  }

  if (name.includes('UDUPI') && (isDelhi(dest) || name.includes('DELHI') || name.includes('NIZAMUDDIN'))) return true;

  return false;
}

// Dedicated On-Board Train Pantry & Tray Food Catalog
const ONBOARD_PANTRY_DISHES = [
  {
    id: 'ob-m1',
    company_id: 'comp-1',
    name: 'Rajdhani Deluxe Veg Thali',
    price: 240,
    category: 'Meals',
    type: 'veg',
    is_veg: true,
    description: 'Freshly prepared in train pantry: Paneer Butter Masala, Dal Makhani, Jeera Rice, 3 Butter Tawa Rotis, Gulab Jamun & Salad',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 15,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-m2',
    company_id: 'comp-1',
    name: 'Rajdhani Executive Non-Veg Thali',
    price: 310,
    category: 'Meals',
    type: 'non-veg',
    is_veg: false,
    description: 'Hot pantry preparation: Tender Butter Chicken, Egg Curry, Basmati Pulao, 3 Butter Rotis, Mint Raita & Sweet',
    image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 20,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-m3',
    company_id: 'comp-1',
    name: 'Pantry Hyderabadi Chicken Dum Biryani',
    price: 280,
    category: 'Meals',
    type: 'non-veg',
    is_veg: false,
    description: 'Slow-cooked fragrant basmati rice with spiced chicken, boiled egg, mirchi ka salan & cooling mint raita',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 15,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-m4',
    company_id: 'comp-1',
    name: 'Shahi Paneer Dum Biryani Bowl',
    price: 220,
    category: 'Meals',
    type: 'veg',
    is_veg: true,
    description: 'Aromatic saffron basmati rice layered with marinated cottage cheese, caramelized onions & fresh mint raita',
    image_url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 15,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-m5',
    company_id: 'comp-1',
    name: 'Pure Jain Special Satvik Thali',
    price: 230,
    category: 'Meals',
    type: 'jain',
    is_veg: true,
    is_jain: true,
    description: '100% Satvik (No Onion, No Garlic): Paneer Makhani, Yellow Moong Dal, 3 Phulkas with Desi Ghee, Basmati Rice & Sweet',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 15,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-b1',
    company_id: 'comp-1',
    name: 'Executive Bread Omelette Combo',
    price: 110,
    category: 'Breakfast',
    type: 'non-veg',
    is_veg: false,
    description: 'Fresh 2-egg spiced herb omelette with 2 toasted butter breads, ketchup & cutting masala chai',
    image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 10,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-b2',
    company_id: 'comp-1',
    name: 'Hot Steamed Idli Sambar & Medu Vada Pair',
    price: 120,
    category: 'Breakfast',
    type: 'veg',
    is_veg: true,
    description: '2 Soft steamed idlis & 1 crispy medu vada served with piping hot dal sambar & fresh coconut chutney',
    image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 10,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-b3',
    company_id: 'comp-1',
    name: 'Amritsari Aloo Paratha with Curd',
    price: 130,
    category: 'Breakfast',
    type: 'veg',
    is_veg: true,
    description: '2 Crispy whole wheat flatbreads stuffed with spiced mashed potatoes, served with fresh Amul butter & curd',
    image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 12,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-s1',
    company_id: 'comp-1',
    name: 'Pantry Special Chole Bhature',
    price: 160,
    category: 'Snacks',
    type: 'veg',
    is_veg: true,
    description: '2 Fluffy golden bhaturas served with spiced Pindi chickpeas, pickled onions and fried green chilies',
    image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 12,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-s2',
    company_id: 'comp-1',
    name: 'Crispy Vegetable Cutlets (2 Pcs)',
    price: 90,
    category: 'Snacks',
    type: 'veg',
    is_veg: true,
    description: 'Golden fried beetroot and mixed vegetable patties served with sweet date chutney and tangy mint sauce',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 10,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-s3',
    company_id: 'comp-1',
    name: 'Hot Samosa Duo with Masala Chai',
    price: 70,
    category: 'Snacks',
    type: 'veg',
    is_veg: true,
    description: '2 Crispy Punjabi spiced potato samosas paired with steaming hot cardamom cutting chai',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 8,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-bv1',
    company_id: 'comp-1',
    name: 'RailControl Special Ginger Cardamom Tea',
    price: 35,
    category: 'Beverages',
    type: 'veg',
    is_veg: true,
    description: 'Freshly brewed piping hot milk tea infused with crushed ginger and green cardamom pods',
    image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 5,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-bv2',
    company_id: 'comp-1',
    name: 'Chilled Sweet Mango Lassi Bottle (300ml)',
    price: 85,
    category: 'Beverages',
    type: 'veg',
    is_veg: true,
    description: 'Thick, creamy yogurt beverage blended with authentic Alphonso mango pulp and pistachios',
    image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 3,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-bv3',
    company_id: 'comp-1',
    name: 'South Indian Filter Coffee Flask (300ml)',
    price: 55,
    category: 'Beverages',
    type: 'veg',
    is_veg: true,
    description: 'Authentic chicory blend filtered coffee served steaming hot in an insulated thermal flask',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 5,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-bv4',
    company_id: 'comp-1',
    name: 'Fresh Nimbu Masala Soda (Sweet & Salt)',
    price: 45,
    category: 'Beverages',
    type: 'veg',
    is_veg: true,
    description: 'Refreshing sparkling soda with freshly squeezed lime, rock salt, mint leaves & roasted cumin',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 3,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-bv5',
    company_id: 'comp-1',
    name: 'IRCTC Rail Neer Packaged Water (1 Litre)',
    price: 15,
    category: 'Beverages',
    type: 'veg',
    is_veg: true,
    description: 'Official purified mineral drinking water processed under highest Indian Railway standards',
    image_url: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 1,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-bv6',
    company_id: 'comp-1',
    name: 'Spiced Mint Masala Buttermilk (Chaas 250ml)',
    price: 35,
    category: 'Beverages',
    type: 'veg',
    is_veg: true,
    description: 'Cooling probiotic churned curd tempered with ginger, green chili, roasted jeera & fresh coriander',
    image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 2,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-m6',
    company_id: 'comp-1',
    name: 'Pantry Special Egg Dum Biryani (2 Eggs)',
    price: 210,
    category: 'Meals',
    type: 'non-veg',
    is_veg: false,
    description: 'Fragrant basmati rice dum-cooked with spiced boiled eggs, caramelized onions, mint & cooling raita',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 15,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-m7',
    company_id: 'comp-1',
    name: 'Kadhai Paneer & Butter Naan Combo',
    price: 220,
    category: 'Meals',
    type: 'veg',
    is_veg: true,
    description: 'Cottage cheese cubes tossed with bell peppers and whole spices, served with 2 butter naans & salad',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 15,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-b4',
    company_id: 'comp-1',
    name: 'Indori Poha with Sev & 2 Jalebis',
    price: 95,
    category: 'Breakfast',
    type: 'veg',
    is_veg: true,
    description: 'Steamed spiced flattened rice garnished with crispy Ratlami sev and onions, paired with 2 hot jalebis',
    image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 8,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-s4',
    company_id: 'comp-1',
    name: 'Paneer Tikka Kathi Frankie Roll',
    price: 150,
    category: 'Snacks',
    type: 'veg',
    is_veg: true,
    description: 'Smoky spiced cottage cheese cubes wrapped in flaky paratha with mint chutney and crunchy pickled onions',
    image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 10,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-s5',
    company_id: 'comp-1',
    name: 'Mumbai Batata Vada Pav Pair (2 Pcs)',
    price: 70,
    category: 'Snacks',
    type: 'veg',
    is_veg: true,
    description: '2 Spiced mashed potato fritters in soft pav buns served with garlic chutney and fried green chili',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 6,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-d1',
    company_id: 'comp-1',
    name: 'Warm Gulab Jamun in Saffron Syrup (2 Pcs)',
    price: 80,
    category: 'Desserts',
    type: 'veg',
    is_veg: true,
    description: 'Soft melt-in-mouth khoya dumplings soaked in warm green cardamom and rose sugar syrup',
    image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 3,
    catering_type: 'ONBOARD',
    is_onboard: true
  },
  {
    id: 'ob-d2',
    company_id: 'comp-1',
    name: 'Traditional Kesar Pista Matka Kulfi',
    price: 75,
    category: 'Desserts',
    type: 'veg',
    is_veg: true,
    description: 'Rich slow-churned condensed milk kulfi infused with Kashmiri saffron strands and crushed pistachios',
    image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
    in_stock: true,
    is_available: true,
    prep_time_mins: 2,
    catering_type: 'ONBOARD',
    is_onboard: true
  }
];

/**
 * Initializes train on-board catering collection and dishes without erasing existing data
 */
function ensureOnboardCateringSeeded() {
  if (mockDb.train_onboard_catering) {
    for (const [trainNum, cfg] of Object.entries(DEFAULT_ONBOARD_TRAIN_CONFIGS)) {
      if (!mockDb.train_onboard_catering.has(trainNum)) {
        mockDb.train_onboard_catering.set(trainNum, { ...cfg });
      }
    }
  }
}
ensureOnboardCateringSeeded();

function ensureOnboardFoodSeeded() {
  ensureOnboardCateringSeeded();
  let modified = false;
  if (mockDb.catering_menu) {
    ONBOARD_PANTRY_DISHES.forEach(dish => {
      if (!mockDb.catering_menu.has(dish.id)) {
        mockDb.catering_menu.set(dish.id, { ...dish });
        modified = true;
      }
    });
    if (modified) {
      saveMockDbToFile();
    }
  }
}
ensureOnboardFoodSeeded();

/**
 * Get On-Board Catering Configuration for a train
 */
function getTrainOnboardConfig(trainNumber, journeyDate = null) {
  ensureOnboardCateringSeeded();
  const cleanNumber = String(trainNumber || '').trim();
  const defaultConfig = DEFAULT_ONBOARD_TRAIN_CONFIGS[cleanNumber];

  // 1. Check explicit mockDb.train_onboard_catering map
  let explicitCfg = null;
  if (mockDb.train_onboard_catering) {
    if (journeyDate && mockDb.train_onboard_catering.has(`${cleanNumber}_${journeyDate}`)) {
      explicitCfg = mockDb.train_onboard_catering.get(`${cleanNumber}_${journeyDate}`);
    } else if (mockDb.train_onboard_catering.has(cleanNumber)) {
      explicitCfg = mockDb.train_onboard_catering.get(cleanNumber);
    }
  }

  if (defaultConfig) {
    return {
      ...defaultConfig,
      ...explicitCfg,
      catering_available: true,
      active_status: 'ACTIVE',
      is_date_specific: false,
      applicable_classes: ['ALL', '1A', '2A', '3A', '3E', 'CC', 'EC', 'SL'],
      service_start_date: '2024-01-01',
      service_end_date: '2030-12-31'
    };
  }

  if (explicitCfg && explicitCfg.catering_available) {
    return explicitCfg;
  }

  // 2. Look up train object in mockDb.trains
  let train = null;
  if (mockDb.trains && mockDb.trains.size > 0) {
    const allTrains = Array.from(mockDb.trains.values());
    if (journeyDate) {
      const targetDateStr = String(journeyDate).split('T')[0];
      train = allTrains.find(t => t && String(t.train_number || t.number) === cleanNumber &&
        String(t.journey_date || t.travel_date || '').split('T')[0] === targetDateStr);
    }
    if (!train) {
      train = allTrains.find(t => t && String(t.train_number || t.number) === cleanNumber);
    }
  }

  // If train has an embedded onboard_catering object or catering config
  if (train && train.onboard_catering) {
    return {
      train_number: cleanNumber,
      train_name: train.train_name || `Train ${cleanNumber}`,
      journey_date: train.journey_date || train.travel_date || null,
      is_date_specific: Boolean(train.is_date_specific || train.is_demo || train.journey_date),
      ...train.onboard_catering
    };
  }

  // If train connects Udupi and New Delhi, default to enabled On-Board Catering
  if (train && isTrainConnectingUdupiAndDelhi(train)) {
    const src = train.source_station_code || train.source || 'UD';
    const dest = train.destination_station_code || train.destination || 'NDLS';
    const jDate = train.journey_date || train.travel_date || null;
    return {
      train_number: cleanNumber,
      train_name: train.train_name || `Udupi - New Delhi Express ${cleanNumber}`,
      catering_available: true,
      provider_id: 'comp-1',
      provider_name: 'IRCTC Coastal & Konkan Executive Pantry',
      pantry_type: 'Full Pantry Car',
      food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
      applicable_classes: ['1A', '2A', '3A', '3E', 'CC', 'EC', 'SL'],
      service_start_date: '2025-01-01',
      service_end_date: '2028-12-31',
      active_status: 'ACTIVE',
      journey_date: jDate,
      is_date_specific: Boolean(train.is_date_specific || train.is_demo || jDate),
      route: `${src} → ${dest}`,
      source: src,
      destination: dest,
      is_udupi_to_delhi: true,
      ordering_window_hours_before_journey: 48,
      cutoff_minutes_before_destination: 60
    };
  }

  // Default: Train does NOT have on-board catering configured
  return {
    train_number: cleanNumber,
    train_name: train ? (train.train_name || `Train ${cleanNumber}`) : `Train ${cleanNumber}`,
    route: train ? `${train.source_station_code || train.source || ''} → ${train.destination_station_code || train.destination || ''}` : 'Standard Fleet Route',
    source: train ? (train.source_station_code || train.source || '') : '',
    destination: train ? (train.destination_station_code || train.destination || '') : '',
    journey_date: train ? (train.journey_date || train.travel_date || null) : null,
    is_date_specific: Boolean(train?.is_date_specific || train?.is_demo || train?.journey_date),
    is_udupi_to_delhi: false,
    catering_available: false,
    provider_id: null,
    provider_name: null,
    pantry_type: 'None',
    food_categories: [],
    applicable_classes: [],
    service_start_date: null,
    service_end_date: null,
    active_status: 'INACTIVE',
    message: 'On-board catering is not available for this train.'
  };
}

/**
 * Check if on-board catering is currently available and active for a train & class
 */
function evaluateOnboardAvailability(trainNumber, travelClass = null, travelDateStr = null) {
  const config = getTrainOnboardConfig(trainNumber, travelDateStr);

  if (!config.catering_available || config.active_status !== 'ACTIVE') {
    return {
      available: false,
      is_available: false,
      reason: 'ONBOARD_CATERING_NOT_AVAILABLE',
      message: `On-board pantry catering is not available on Train ${config.train_name || trainNumber}. Please use Station eCatering for platform meal delivery.`,
      config,
      onboard_config: config
    };
  }

  // Check validity date window
  const checkDate = travelDateStr ? new Date(travelDateStr) : new Date();
  if (config.service_start_date && new Date(config.service_start_date) > checkDate) {
    return {
      available: false,
      is_available: false,
      reason: 'SERVICE_NOT_STARTED',
      message: `On-board catering service for this train starts on ${config.service_start_date}.`,
      config,
      onboard_config: config
    };
  }
  if (config.service_end_date && new Date(config.service_end_date) < checkDate) {
    return {
      available: false,
      is_available: false,
      reason: 'SERVICE_EXPIRED',
      message: `On-board catering service for this train ended on ${config.service_end_date}.`,
      config,
      onboard_config: config
    };
  }

  // Check Date-Specific train matching
  if (config.is_date_specific && config.journey_date && travelDateStr) {
    const configuredDate = String(config.journey_date).split('T')[0];
    const requestedDate = String(travelDateStr).split('T')[0];
    if (configuredDate !== requestedDate) {
      return {
        available: false,
        is_available: false,
        reason: 'DATE_SPECIFIC_SERVICE_MISMATCH',
        message: `On-board catering on Train ${config.train_name || trainNumber} is specifically scheduled for journey date ${configuredDate}.`,
        config,
        onboard_config: config
      };
    }
  }

  // Check class eligibility
  if (travelClass) {
    const normClass = normalizeClassCode(travelClass);
    const applicable = Array.isArray(config.applicable_classes) ? config.applicable_classes : [];
    const isAll = applicable.includes('ALL') || applicable.length === 0;
    const isClassSupported = isAll || applicable.map(c => normalizeClassCode(c)).includes(normClass);

    if (!isClassSupported) {
      return {
        available: false,
        is_available: false,
        reason: 'CLASS_NOT_ELIGIBLE',
        message: `On-board catering on this train is reserved for classes: ${applicable.join(', ')}. Not available for class ${normClass}.`,
        config,
        onboard_config: config
      };
    }
  }

  return {
    available: true,
    is_available: true,
    reason: 'ONBOARD_CATERING_AVAILABLE',
    message: `On-board ${config.pantry_type || 'pantry'} service is active on Train ${config.train_name || trainNumber}. Meals are delivered directly to your coach and seat.`,
    config,
    onboard_config: config
  };
}

/**
 * Get on-board food menu for a train and passenger class
 */
function getOnboardMenuForTrain(trainNumber, travelClass = null, travelDateStr = null) {
  ensureOnboardFoodSeeded();
  const evalResult = evaluateOnboardAvailability(trainNumber, travelClass, travelDateStr);
  if (!evalResult.available) {
    return {
      success: false,
      available: false,
      is_available: false,
      reason: evalResult.reason,
      message: evalResult.message,
      menu: [],
      provider: null,
      config: evalResult.config,
      onboard_config: evalResult.config
    };
  }

  const config = evalResult.config;
  const rawProviderId = config.provider_id || 'comp-1';

  // Fetch provider info
  let provider = null;
  if (mockDb.catering_companies && mockDb.catering_companies.size > 0) {
    provider = mockDb.catering_companies.get(rawProviderId) || 
               Array.from(mockDb.catering_companies.values()).find(c => 
                 c.id === rawProviderId || 
                 c.company_name === rawProviderId ||
                 (String(rawProviderId).toLowerCase().includes('irctc') && c.id === 'comp-1') ||
                 (String(config.provider_name || config.catering_provider || '').toLowerCase().includes('irctc') && c.id === 'comp-1')
               );
  }
  if (!provider && mockDb.catering_companies && mockDb.catering_companies.size > 0) {
    provider = mockDb.catering_companies.get('comp-1') || Array.from(mockDb.catering_companies.values())[0];
  }
  const providerId = provider ? provider.id : (String(rawProviderId).toLowerCase().includes('irctc') ? 'comp-1' : rawProviderId);

  // Fetch dishes belonging to this provider or on-board pantry from mockDb.catering_menu
  let dishes = [];
  if (mockDb.catering_menu && mockDb.catering_menu.size > 0) {
    dishes = Array.from(mockDb.catering_menu.values()).filter(d => {
      const dComp = d.company_id || d.vendor_id;
      const isProviderMatch = (dComp === providerId) || 
                              (dComp === rawProviderId) || 
                              d.catering_type === 'ONBOARD' || 
                              d.is_onboard === true ||
                              ((providerId === 'comp-1' || String(rawProviderId).toLowerCase().includes('irctc')) && (dComp === 'comp-1' || String(dComp).toLowerCase().includes('irctc')));
      if (!isProviderMatch) return false;
      if (d.in_stock === false || d.is_available === false) return false;
      // Filter by food categories if specified (case-insensitive)
      if (Array.isArray(config.food_categories) && config.food_categories.length > 0) {
        const catNorm = (d.category || '').toLowerCase().trim();
        const allowedCats = config.food_categories.map(c => c.toLowerCase().trim());
        if (!allowedCats.includes(catNorm) && !allowedCats.includes('all')) {
          return false;
        }
      }
      return true;
    });
  }

  // Fallback: if dishes still empty, use ONBOARD_PANTRY_DISHES
  if (dishes.length === 0) {
    dishes = ONBOARD_PANTRY_DISHES.filter(d => {
      if (Array.isArray(config.food_categories) && config.food_categories.length > 0) {
        const catNorm = (d.category || '').toLowerCase().trim();
        const allowedCats = config.food_categories.map(c => c.toLowerCase().trim());
        if (!allowedCats.includes(catNorm) && !allowedCats.includes('all')) {
          return false;
        }
      }
      return true;
    });
    // Ensure they are recorded in mockDb.catering_menu
    if (mockDb.catering_menu) {
      dishes.forEach(d => {
        if (!mockDb.catering_menu.has(d.id)) {
          mockDb.catering_menu.set(d.id, { ...d });
        }
      });
      saveMockDbToFile();
    }
  }

  // Enrich with On-Board Pantry specific details
  const enrichedMenu = dishes.map(d => ({
    ...d,
    catering_type: 'ONBOARD',
    delivery_mode: 'COACH_SEAT_DELIVERY',
    pantry_type: config.pantry_type || 'Pantry Car',
    provider_name: provider?.company_name || config.provider_name || config.catering_provider || 'IRCTC On-Board Catering Services',
    company_name: provider?.company_name || config.provider_name || config.catering_provider || 'IRCTC On-Board Catering Services'
  }));

  return {
    success: true,
    available: true,
    is_available: true,
    message: evalResult.message,
    pantry_type: config.pantry_type || 'Pantry Car',
    provider: {
      id: providerId,
      name: provider?.company_name || config.provider_name || config.catering_provider || 'IRCTC On-Board Catering Services',
      fssai_number: provider?.fssai_number || '10019011000234',
      phone: provider?.phone || '+91 9811002233'
    },
    config,
    onboard_config: config,
    menu: enrichedMenu
  };
}

/**
 * Admin: Update or save on-board catering configuration for a train
 */
function setTrainOnboardConfig(trainNumber, updateData = {}) {
  ensureOnboardCateringSeeded();
  const cleanNumber = String(trainNumber || '').trim();
  if (!cleanNumber) {
    throw new Error('Train number is required');
  }

  const existing = getTrainOnboardConfig(cleanNumber, updateData.journey_date);
  const updated = {
    ...existing,
    ...updateData,
    train_number: cleanNumber,
    train_name: updateData.train_name || existing.train_name || `Train ${cleanNumber}`,
    catering_available: Boolean(updateData.catering_available ?? existing.catering_available),
    active_status: updateData.active_status || (updateData.catering_available ? 'ACTIVE' : existing.active_status || 'ACTIVE'),
    updated_at: new Date().toISOString()
  };

  mockDb.train_onboard_catering.set(cleanNumber, updated);
  if (updateData.journey_date) {
    mockDb.train_onboard_catering.set(`${cleanNumber}_${updateData.journey_date}`, updated);
  }
  saveMockDbToFile();
  return updated;
}

/**
 * Admin: List all trains with their on-board catering configuration
 */
function getAllTrainOnboardConfigs() {
  ensureOnboardCateringSeeded();
  const configuredMap = new Map();

  // Load configured entries from mockDb.train_onboard_catering
  if (mockDb.train_onboard_catering) {
    for (const [num, cfg] of mockDb.train_onboard_catering.entries()) {
      configuredMap.set(String(num), cfg);
    }
  }

  const trainList = mockDb.trains ? Array.from(mockDb.trains.values()) : [];
  const results = [];
  const seenKey = new Set();

  for (const train of trainList) {
    const tNum = String(train.train_number || train.number || '').trim();
    if (!tNum) continue;

    const jDate = train.journey_date || train.travel_date || null;
    const isDateSpecific = Boolean(train.is_date_specific || train.is_demo || jDate);
    const dedupeKey = `${tNum}_${jDate || 'regular'}`;

    if (seenKey.has(dedupeKey)) continue;
    seenKey.add(dedupeKey);

    const isUdupiDelhi = isTrainConnectingUdupiAndDelhi(train);
    const src = train.source_station_code || train.source || (isUdupiDelhi ? 'UD' : '');
    const dest = train.destination_station_code || train.destination || (isUdupiDelhi ? 'NDLS' : '');
    const routeStr = (src && dest) ? `${src} → ${dest}` : (isUdupiDelhi ? 'UD → NDLS' : 'Standard Fleet Route');

    // Check if configured in map
    const explicitCfg = configuredMap.get(tNum) || (jDate ? configuredMap.get(`${tNum}_${jDate}`) : null);

    if (explicitCfg) {
      results.push({
        ...explicitCfg,
        train_number: tNum,
        train_name: train.train_name || explicitCfg.train_name || `Train ${tNum}`,
        route: routeStr,
        source: src,
        destination: dest,
        journey_date: jDate,
        is_date_specific: isDateSpecific,
        is_udupi_to_delhi: isUdupiDelhi,
        active_status: explicitCfg.active_status || (explicitCfg.catering_available ? 'ACTIVE' : 'INACTIVE')
      });
      configuredMap.delete(tNum);
      if (jDate) configuredMap.delete(`${tNum}_${jDate}`);
    } else if (isUdupiDelhi) {
      // Udupi -> New Delhi train: realistic on-board catering enabled by default
      results.push({
        train_number: tNum,
        train_name: train.train_name || `Udupi - New Delhi Express ${tNum}`,
        route: routeStr,
        source: src,
        destination: dest,
        journey_date: jDate,
        is_date_specific: isDateSpecific,
        is_udupi_to_delhi: true,
        catering_available: true,
        provider_id: 'comp-1',
        provider_name: 'IRCTC Coastal & Konkan Executive Pantry',
        pantry_type: 'Full Pantry Car',
        food_categories: ['Breakfast', 'Meals', 'Snacks', 'Beverages', 'Desserts'],
        applicable_classes: ['1A', '2A', '3A', '3E', 'CC', 'EC', 'SL'],
        service_start_date: '2025-01-01',
        service_end_date: '2028-12-31',
        active_status: 'ACTIVE',
        ordering_window_hours_before_journey: 48,
        cutoff_minutes_before_destination: 60
      });
    } else {
      // Other regular trains without configured on-board catering
      results.push({
        train_number: tNum,
        train_name: train.train_name || `Train ${tNum}`,
        route: routeStr,
        source: src,
        destination: dest,
        journey_date: jDate,
        is_date_specific: isDateSpecific,
        is_udupi_to_delhi: false,
        catering_available: false,
        provider_id: null,
        provider_name: null,
        pantry_type: 'None',
        food_categories: [],
        applicable_classes: [],
        service_start_date: null,
        service_end_date: null,
        active_status: 'INACTIVE'
      });
    }
  }

  // Add any remaining configured trains that may not be in mockDb.trains
  for (const [num, cfg] of configuredMap.entries()) {
    if (!seenKey.has(`${num}_regular`) && !seenKey.has(num)) {
      results.push({
        ...cfg,
        route: cfg.route || 'Standard Fleet Route',
        journey_date: null,
        is_date_specific: false,
        is_udupi_to_delhi: false
      });
    }
  }

  return results;
}

module.exports = {
  getTrainOnboardConfig,
  evaluateOnboardAvailability,
  getOnboardMenuForTrain,
  setTrainOnboardConfig,
  getAllTrainOnboardConfigs,
  isTrainConnectingUdupiAndDelhi,
  DEFAULT_ONBOARD_TRAIN_CONFIGS,
  ONBOARD_PANTRY_DISHES,
  ensureOnboardFoodSeeded,
  ensureOnboardCateringSeeded
};
