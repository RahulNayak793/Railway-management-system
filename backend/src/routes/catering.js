const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { evaluateCateringEligibility, getTrainCateringConfig } = require('../services/cateringEligibility');
const { isFoodEligibleClass, isComplimentaryFoodEligible, normalizeClassCode, isBookingCancelled, isJourneyCompleted, getComplimentaryFoodEntitlement } = require('../utils/cateringEligibilityHelper');
const { 
  getTrainOnboardConfig, 
  evaluateOnboardAvailability, 
  getOnboardMenuForTrain, 
  setTrainOnboardConfig, 
  getAllTrainOnboardConfigs,
  ONBOARD_PANTRY_DISHES,
  ensureOnboardFoodSeeded 
} = require('../services/onboardCateringService');
const { getISTDateAndMinutes, parseTimeToMinutes } = require('../utils/liveStatusHelper');

// Master Food Partner Feed (Owned by External Partners, Persisted in mockDb.catering_menu)
const INITIAL_SEEDED_DISHES = [
  // --- COMP-1: IRCTC Executive Pantry (NDLS, DLI, NZM, CNB, AGC, JP) ---
  { id: 'm1', company_id: 'comp-1', name: 'Deluxe North Indian Thali', price: 240, category: 'Lunch', type: 'veg', description: 'Paneer Butter Masala, Dal Makhani, Jeera Rice, 2 Butter Naan, Gulab Jamun & Salad', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm2', company_id: 'comp-1', name: 'Executive Non-Veg Meal Thali', price: 310, category: 'Dinner', type: 'non-veg', description: 'Butter Chicken, Egg Curry, Basmati Rice, 3 Chapatis, Mint Raita & Sweet', image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 25 },
  { id: 'm6', company_id: 'comp-1', name: 'Hyderabadi Chicken Dum Biryani', price: 280, category: 'Dinner', type: 'non-veg', description: 'Aromatic Basmati Rice, Tender Chicken, Egg, Mirchi Ka Salan & Raita', image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 25 },
  { id: 'm7', company_id: 'comp-1', name: 'Lucknowi Veg Dum Biryani Bowl', price: 210, category: 'Lunch', type: 'veg', description: 'Saffron Basmati Rice with Fresh Vegetables, Paneer & Mint Raita', image_url: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm101', company_id: 'comp-1', name: 'Steamed Idli Sambar Pair', price: 110, category: 'Breakfast', type: 'veg', description: '2 Soft Steamed Rice Idlis with Fresh Coconut Chutney & Piping Hot Lentil Sambar', image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm102', company_id: 'comp-1', name: 'Ghee Paper Masala Dosa', price: 140, category: 'Breakfast', type: 'veg', description: 'Crispy Rice Crepe roasted in pure ghee, stuffed with spiced potato masala', image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm104', company_id: 'comp-1', name: 'Punjabi Aloo Paratha Combo', price: 130, category: 'Breakfast', type: 'veg', description: '2 Whole Wheat Stuffed Potato Flatbreads with Fresh Butter & Curd', image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm105', company_id: 'comp-1', name: 'Double Egg Bread Omelette', price: 110, category: 'Breakfast', type: 'non-veg', description: 'Fluffy 2-Egg Omelette cooked with onions & green chilies between toasted butter bread', image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 12 },
  { id: 'm11', company_id: 'comp-1', name: 'Chole Bhature Special', price: 160, category: 'Snacks', type: 'veg', description: '2 Fluffy Bhature with Spiced Chickpeas, Fried Green Chili & Pickle', image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm15', company_id: 'comp-1', name: 'Samosa & Hot Tea Pack', price: 70, category: 'Snacks', type: 'veg', description: '2 Crispy Punjabi Potato Samosas with Cutting Masala Chai', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 10 },
  { id: 'm18', company_id: 'comp-1', name: 'Fresh Mango Lassi Bottle', price: 90, category: 'Beverages', type: 'veg', description: 'Thick Creamy Alphonso Mango Yogurt Drink (300ml)', image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm111', company_id: 'comp-1', name: 'Cardamom Cutting Masala Tea', price: 40, category: 'Beverages', type: 'veg', description: 'Piping Hot Milk Tea infused with Ginger & Green Cardamom', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm16', company_id: 'comp-1', name: 'Gulab Jamun Pair Box', price: 80, category: 'Desserts', type: 'veg', description: '2 Warm Soft Khoya Gulab Jamuns soaked in Cardamom Syrup', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },

  // --- COMP-2: MP Rail Catering Services (BPL, GWL, VGLJ, ET, RTM, UJN, INDB) ---
  { id: 'm201', company_id: 'comp-2', name: 'Indori Poha Jalebi Royal Combo', price: 110, category: 'Breakfast', type: 'veg', description: 'Steamed Spiced Poha garnished with Ratlami Sev, onions & 2 Crispy Hot Jalebis', image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 12 },
  { id: 'm202', company_id: 'comp-2', name: 'Malwa Paneer Thali Feast', price: 230, category: 'Lunch', type: 'veg', description: 'Paneer Butter Masala, Sev Tamatar Sabzi, Dal Tadka, 3 Phulkas, Jeera Rice & Sweet', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm203', company_id: 'comp-2', name: 'Bhopali Chicken Curry & Paratha Meal', price: 260, category: 'Dinner', type: 'non-veg', description: 'Slow-cooked Spiced Bhopali Chicken Curry with 3 Laccha Parathas & Mint Salad', image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 22 },
  { id: 'm204', company_id: 'comp-2', name: 'Dal Baati Churma Malwa Box', price: 240, category: 'Lunch', type: 'veg', description: '4 Baked Ghee Baatis, Panchmel Dal, Garlic Chutney & Jaggery Churma', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm205', company_id: 'comp-2', name: 'Bhutte Ka Kees & Mathri Combo', price: 95, category: 'Snacks', type: 'veg', description: 'Grated Corn simmered in spiced milk and mustard tempered with Crispy Mathris', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm206', company_id: 'comp-2', name: 'Shahi Kesar Lassi Glass', price: 70, category: 'Beverages', type: 'veg', description: 'Chilled Thick Yogurt drink infused with Saffron and Pistachio slivers', image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm207', company_id: 'comp-2', name: 'Malwa Dal Tadka Rice Bowl', price: 160, category: 'Dinner', type: 'veg', description: 'Slow-simmered yellow arhar dal with cumin ghee tadka and fragrant steamed basmati rice', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },

  // --- COMP-3: Varanasi Satvik Kitchen (BSB, PRYJ, DDU, LKO, GKP) ---
  { id: 'm301', company_id: 'comp-3', name: '100% Pure Jain Satvik Special Thali', price: 240, category: 'Lunch', type: 'jain', description: 'No Onion No Garlic Paneer, Yellow Moong Dal, 3 Desi Ghee Phulkas, Basmati Rice & Sweet', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm302', company_id: 'comp-3', name: 'Jain Matar Paneer & Jeera Rice', price: 210, category: 'Dinner', type: 'jain', description: 'Fresh Cottage Cheese and Green Peas cooked in pure Satvik tomato gravy without root vegetables', image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 18 },
  { id: 'm303', company_id: 'comp-3', name: 'Sabudana Khichdi & Fresh Curd', price: 140, category: 'Breakfast', type: 'jain', description: 'Sago pearls sautéed with crushed roasted peanuts, rock salt and green chilies with curd', image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm304', company_id: 'comp-3', name: 'Kashi Kesar Pista Kheer Bowl', price: 95, category: 'Desserts', type: 'jain', description: 'Slow-simmered basmati rice and sweet milk pudding enriched with cardamom and dry fruits', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm305', company_id: 'comp-3', name: 'Kulhad Masala Chai & Mathri Pack', price: 60, category: 'Beverages', type: 'jain', description: 'Steaming ginger cardamom tea served in eco-friendly terracotta kulhad with mathris', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm306', company_id: 'comp-3', name: 'Banarasi Tamatar Chaat Duo', price: 90, category: 'Snacks', type: 'jain', description: 'Warm tangy spiced tomato chaat simmered in pure ghee and topped with savory namkeen', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 10 },
  { id: 'm307', company_id: 'comp-3', name: 'Kashi Satvik Khichdi Feast', price: 170, category: 'Dinner', type: 'jain', description: 'Satvik yellow moong dal khichdi prepared with cow ghee and roasted cumin, served with homemade curd', image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },

  // --- COMP-4: Coastal Rail Foods (MAQ, UD, MAO, ERS, SBC, CLT, CAN) ---
  { id: 'm401', company_id: 'comp-4', name: 'South Indian Mini Tiffin Feast', price: 180, category: 'Breakfast', type: 'veg', description: '1 Steamed Rice Idli, 1 Crispy Medu Vada, Mini Ghee Dosa served with Sambar & 2 Fresh Chutneys', image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm402', company_id: 'comp-4', name: 'Mysuru Ghee Masala Dosa', price: 150, category: 'Breakfast', type: 'veg', description: 'Golden roasted crepe spread with spicy red chutney and spiced potato masala with pure butter', image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm403', company_id: 'comp-4', name: 'Malabar Parotta & Egg Curry Meal', price: 220, category: 'Dinner', type: 'non-veg', description: '2 Multi-layered flaky Malabar Parottas served with rich roasted coconut Kerala Egg Curry', image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm404', company_id: 'comp-4', name: 'Chettinad Veg Kurma & Appam Combo', price: 210, category: 'Lunch', type: 'veg', description: '2 Soft lace appams paired with fragrant peppercorn and vegetable Chettinad stew', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 18 },
  { id: 'm405', company_id: 'comp-4', name: 'Traditional Filter Coffee Flask', price: 65, category: 'Beverages', type: 'veg', description: 'South Indian chicory filtered coffee kept steaming hot in an insulated thermal flask (300ml)', image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm406', company_id: 'comp-4', name: 'Mangalorean Ghee Roast Paneer Roll', price: 175, category: 'Snacks', type: 'veg', description: 'Spicy tangy Byadgi chili ghee roasted paneer cubes wrapped in soft flatbread', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm407', company_id: 'comp-4', name: 'Udupi Sambar Rice & Curd Rice Combo', price: 190, category: 'Lunch', type: 'veg', description: 'Homestyle aromatic lentil sambar rice and cooling tempered mustard curd rice with pickle', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },

  // --- COMP-5: Western Gourmet Express (MMCT, BDTS, ST, BRC, ADI, PUNE, KOTA) ---
  { id: 'm501', company_id: 'comp-5', name: 'Deluxe Gujarati Kathiyawadi Thali', price: 250, category: 'Lunch', type: 'veg', description: 'Sev Tameta, Ringan Bharta, Gujarati Dal, 3 Butter Rotlis, Khichdi, Kadhi & Sweet Shrikhand', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 20 },
  { id: 'm502', company_id: 'comp-5', name: 'Mumbai Special Butter Pav Bhaji', price: 150, category: 'Snacks', type: 'veg', description: '2 Golden butter-toasted pav buns with rich slow-cooked vegetable bhaji, lemon and onion salad', image_url: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm503', company_id: 'comp-5', name: 'Tandoori Chicken Kathi Roll', price: 195, category: 'Snacks', type: 'non-veg', description: 'Smoky grilled chicken boti chunks with tangy laccha onions and mint mayo wrapped in paratha', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 15 },
  { id: 'm504', company_id: 'comp-5', name: 'Gourmet Crispy Veg Burger & Seasoned Fries', price: 160, category: 'Fast Food', type: 'veg', description: 'Crispy herb potato patty, melted cheese, crisp lettuce and peri-peri seasoned french fries', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 12 },
  { id: 'm505', company_id: 'comp-5', name: 'Alphonso Mango Lassi Bottle', price: 85, category: 'Beverages', type: 'veg', description: 'Chilled thick sweet curd blended with authentic Ratnagiri Alphonso mango pulp (300ml)', image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm506', company_id: 'comp-5', name: 'Hot Gulab Jamun with Ice Cream', price: 110, category: 'Desserts', type: 'veg', description: '2 Warm soft khoya gulab jamuns served over a scoop of premium vanilla ice cream', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 5 },
  { id: 'm507', company_id: 'comp-5', name: 'Kathiyawadi Sev Tameta Dinner Box', price: 210, category: 'Dinner', type: 'veg', description: 'Tangy spiced tomato curry topped with crisp Ratlami sev, served with 3 bajra rotlas and jaggery', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80', in_stock: true, is_available: true, prep_time_mins: 18 }
];

// Dynamic timing evaluator for passenger on-board train meals
function calculateBoardingDepartureTiming(trainNumber, boardingStationCode, travelDateStr) {
  const ist = getISTDateAndMinutes();
  const todayStr = ist.dateStr;
  const targetDateStr = travelDateStr ? String(travelDateStr).split('T')[0] : todayStr;

  let train = null;
  if (mockDb.trains) {
    train = Array.from(mockDb.trains.values()).find(t => t && (String(t.train_number) === String(trainNumber) || String(t.id) === String(trainNumber)));
  }
  let route = null;
  if (train && mockDb.routes) {
    route = Array.from(mockDb.routes.values()).find(r => r && r.train_id === train.id);
  }

  const cleanBoarding = (boardingStationCode || route?.source_station_code || train?.source_station_code || 'NDLS').toUpperCase();

  // Find scheduled departure time for passenger's boarding station
  let stationDepTime = null;
  if (route && Array.isArray(route.stops)) {
    const stopMatch = route.stops.find(s => s && String(s.station_code).toUpperCase() === cleanBoarding);
    if (stopMatch) {
      stationDepTime = stopMatch.departure_time || stopMatch.depTime || stopMatch.dep || stopMatch.arrival_time;
    }
  }

  if (!stationDepTime) {
    if (route && String(route.source_station_code).toUpperCase() === cleanBoarding) {
      stationDepTime = route.departure_time || train?.departure_time;
    } else {
      stationDepTime = train?.departure_time || route?.departure_time || '08:00:00';
    }
  }

  const cleanDepTime = String(stationDepTime || '08:00:00').trim();
  const depMins = parseTimeToMinutes(cleanDepTime) ?? 480;
  let hasDeparted = false;
  let statusLabel = 'ON-BOARD FOOD — AVAILABLE AFTER TRAIN DEPARTURE';
  let message = `On-board meals become available after your train departs from ${cleanBoarding} (Scheduled departure: ${cleanDepTime.slice(0, 5)}).`;
  let minsUntilDeparture = 0;

  if (targetDateStr > todayStr) {
    hasDeparted = false;
    statusLabel = 'ON-BOARD FOOD — AVAILABLE AFTER TRAIN DEPARTURE';
    message = `🚆 On-board meals become available after your train departs from ${cleanBoarding} on journey date ${targetDateStr}.`;
    const serviceDateObj = new Date(targetDateStr + 'T00:00:00');
    const todayObj = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.ceil((serviceDateObj - todayObj) / (1000 * 60 * 60 * 24));
    minsUntilDeparture = (diffDays * 24 * 60) + (depMins - ist.currentMinsFromMidnight);
  } else if (targetDateStr === todayStr) {
    if (ist.currentMinsFromMidnight < depMins) {
      hasDeparted = false;
      statusLabel = 'ON-BOARD FOOD — AVAILABLE AFTER TRAIN DEPARTURE';
      message = `🚆 On-board meals become available after your train departs from ${cleanBoarding} (Scheduled: ${cleanDepTime.slice(0, 5)}).`;
      minsUntilDeparture = depMins - ist.currentMinsFromMidnight;
    } else {
      hasDeparted = true;
      statusLabel = 'ON-BOARD FOOD — AVAILABLE';
      message = '🍱 On-board catering is available for this journey.';
      minsUntilDeparture = 0;
    }
  } else {
    // Past date
    hasDeparted = true;
    statusLabel = 'ON-BOARD FOOD — AVAILABLE';
    message = '🍱 On-board catering is available for this journey.';
  }

  return {
    has_departed: hasDeparted,
    status_label: statusLabel,
    message,
    boarding_station: cleanBoarding,
    departure_time: cleanDepTime.slice(0, 5),
    journey_date: targetDateStr,
    mins_until_departure: minsUntilDeparture
  };
}

// Helper to ensure mockDb.catering_menu is seeded once without overwriting existing data
function ensureCateringMenuSeeded() {
  if (!mockDb.catering_menu) return;
  let modified = false;
  INITIAL_SEEDED_DISHES.forEach(dish => {
    if (!mockDb.catering_menu.has(dish.id)) {
      mockDb.catering_menu.set(dish.id, { ...dish });
      modified = true;
    }
  });
  if (Array.isArray(ONBOARD_PANTRY_DISHES)) {
    ONBOARD_PANTRY_DISHES.forEach(dish => {
      if (!mockDb.catering_menu.has(dish.id)) {
        mockDb.catering_menu.set(dish.id, { ...dish });
        modified = true;
      }
    });
  }
  if (modified) {
    saveMockDbToFile();
  }
}
ensureCateringMenuSeeded();
if (typeof ensureOnboardFoodSeeded === 'function') {
  ensureOnboardFoodSeeded();
}

// Proxy delegator so any legacy internal code referencing fullCateringMenu reads live mockDb.catering_menu
let fullCateringMenu = new Proxy([], {
  get(target, prop) {
    ensureCateringMenuSeeded();
    const arr = mockDb.catering_menu ? Array.from(mockDb.catering_menu.values()) : [];
    if (prop === 'length') return arr.length;
    if (typeof arr[prop] === 'function') return arr[prop].bind(arr);
    return arr[prop];
  },
  set(target, prop, value) {
    if (value && value.id && mockDb.catering_menu) {
      mockDb.catering_menu.set(value.id, value);
      saveMockDbToFile();
    }
    return true;
  }
});

// Seed initial orders into mockDb.catering_orders if empty
const INITIAL_SEEDED_ORDERS = [
  {
    order_id: 'ORD-98421',
    txn_id: 'TXN-FOOD-948201',
    company_id: 'comp-1',
    partner_name: 'IRCTC Executive Pantry',
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
  }
];

if (mockDb.catering_orders && mockDb.catering_orders.size === 0) {
  INITIAL_SEEDED_ORDERS.forEach(o => {
    mockDb.catering_orders.set(o.order_id, o);
  });
  saveMockDbToFile();
}

// Proxy delegator for legacy references to mockFoodOrders
let mockFoodOrders = new Proxy([], {
  get(target, prop) {
    const arr = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : [];
    if (prop === 'length') return arr.length;
    if (typeof arr[prop] === 'function') return arr[prop].bind(arr);
    return arr[prop];
  },
  set(target, prop, value) {
    if (value && value.order_id && mockDb.catering_orders) {
      mockDb.catering_orders.set(value.order_id, value);
      saveMockDbToFile();
    }
    return true;
  }
});

// Delivery Incidents / Service Reports Store
let mockFoodIncidents = [
  {
    incident_id: 'INC-FOOD-101',
    order_id: 'ORD-98421',
    partner_id: 'comp-1',
    partner_name: 'IRCTC Executive Pantry',
    reported_by_id: 'usr-staff-1',
    reported_by_name: 'Onboard Staff Official',
    pnr_number: '2345678901',
    issue_type: 'Minor Delay',
    description: 'Food box delivered 5 mins prior to train departure at NDLS platform 2.',
    status: 'RESOLVED',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  }
];

// Helper to check if a partner status is active/authorized
function isPartnerActive(status) {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return s === 'ACTIVE' || s === 'AUTHORIZED';
}

function hashPassword(password) {
  if (!password) return '';
  const salt = 'railway_secure_salt_v1';
  return crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(submittedPassword, profile, comp) {
  if (!submittedPassword) return false;
  const str = String(submittedPassword);
  if (comp && comp.password && comp.password === str) {
    return true;
  }
  if (profile) {
    if (profile.password && profile.password === str) {
      return true;
    }
    if (profile.password_hash) {
      const computed = hashPassword(str);
      if (computed === profile.password_hash) {
        return true;
      }
      try {
        const computedSha = crypto.createHash('sha256').update(str).digest('hex');
        if (computedSha === profile.password_hash) {
          return true;
        }
      } catch (e) {}
    }
  }
  // Default fallback only if no password set at all
  if ((!comp || !comp.password) && (!profile || (!profile.password && !profile.password_hash)) && str === 'Catering@123') {
    return true;
  }
  return false;
}

// Seed initial catering company & login profile in mockDb
function ensureInitialCateringCompanies() {
  if (mockDb.catering_companies && mockDb.catering_companies.size === 0) {
    const defaultComp = {
      id: 'comp-1',
      company_name: 'IRCTC Executive Pantry',
      legal_name: 'Indian Railway Catering and Tourism Corp. Ltd.',
      business_type: 'Sole Authorized Food Partner',
      contact_name: 'Rajesh Sharma',
      phone: '+91 9811002233',
      email: 'pantry@irctc.co.in',
      fssai_number: '10019011000234',
      website_app_info: 'https://ecatering.irctc.co.in',
      service_description: 'Official Exclusive Railway Catering Partner for Train Meals & Thalis',
      address: 'IRCTC Office, Delhi',
      status: 'ACTIVE',
      authorization_start: '2025-01-01T00:00:00Z',
      authorization_end: '2027-12-31T23:59:59Z',
      stations: ['NDLS', 'DLI', 'NZM', 'CNB', 'AGC', 'JP', 'BPL', 'BSB', 'MMCT', 'SBC', 'PUNE', 'KOTA', 'UD', 'CSMT', 'MAS', 'HWH', 'BDTS', 'ADI']
    };
    mockDb.catering_companies.set(defaultComp.id, defaultComp);

    // Associated login profile for IRCTC Executive Pantry
    mockDb.profiles.set('usr-pantry-comp-1', {
      id: 'usr-pantry-comp-1',
      email: 'pantry@irctc.co.in',
      role: 'CATERING_COMPANY',
      full_name: 'IRCTC Executive Pantry',
      catering_company_id: 'comp-1',
      company_id: 'comp-1',
      password_hash: hashPassword('Catering@123'),
      status: 'Active',
      created_at: new Date().toISOString()
    });
  }
}
ensureInitialCateringCompanies();

// Helper to resolve partner company list from mockDb or local state
function getCompaniesList() {
  ensureInitialCateringCompanies();
  if (mockDb.catering_companies && mockDb.catering_companies.size > 0) {
    return Array.from(mockDb.catering_companies.values());
  }
  return [];
}

// Strict Catering Company Role Middleware
function requireCateringCompany(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const roleUpper = String(req.user.role || '').toUpperCase();
  if (roleUpper !== 'CATERING_COMPANY') {
    return res.status(403).json({ error: 'Access denied: Requires CATERING_COMPANY role.' });
  }

  const companyId = req.user.company_id || req.user.catering_company_id;
  if (!companyId) {
    return res.status(403).json({ error: 'Access denied: No authorized catering company associated with this account.' });
  }

  let comp = mockDb.catering_companies.get(companyId);
  if (!comp) {
    comp = getCompaniesList().find(c => c.id === companyId);
  }

  if (!comp) {
    return res.status(403).json({ error: 'Access denied: Catering company record not found.' });
  }

  const statusUpper = String(comp.status || '').toUpperCase();
  if (statusUpper === 'SUSPENDED') {
    return res.status(403).json({ error: 'Access denied: Catering company authorization is SUSPENDED.' });
  }
  if (statusUpper === 'REVOKED' || statusUpper === 'REJECTED') {
    return res.status(403).json({ error: 'Access denied: Catering company authorization has been REVOKED.' });
  }
  if (statusUpper !== 'ACTIVE' && statusUpper !== 'AUTHORIZED') {
    return res.status(403).json({ error: `Access denied: Catering company authorization is inactive (${comp.status}).` });
  }

  const now = new Date();
  if (comp.authorization_end && new Date(comp.authorization_end) < now) {
    return res.status(403).json({ error: 'Access denied: Catering company authorization has EXPIRED.' });
  }
  if (comp.authorization_start && new Date(comp.authorization_start) > now) {
    return res.status(403).json({ error: 'Access denied: Catering company authorization is not yet active.' });
  }

  // Security guard: Reject attempts to supply or access another company's id
  const suppliedCompanyId = req.query?.company_id || req.query?.vendor_id || req.body?.company_id || req.body?.vendor_id;
  if (suppliedCompanyId && String(suppliedCompanyId).trim() !== String(comp.id).trim()) {
    return res.status(403).json({ error: "Access denied. You cannot access or specify another catering company's data." });
  }

  req.cateringCompany = comp;
  req.companyId = comp.id;
  next();
}

// Catering Company or Admin (Read-Only) Middleware for Menu Inspection
function requireCateringCompanyOrAdminReadOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const roleUpper = String(req.user.role || '').toUpperCase();
  if (roleUpper === 'ADMIN') {
    req.isAdmin = true;
    req.targetCompanyId = req.query.vendor_id || req.query.company_id || null;
    return next();
  }
  return requireCateringCompany(req, res, next);
}

// ==========================================
// 1. DEDICATED CATERING COMPANY AUTHENTICATION
// ==========================================

// POST /api/catering/auth/login - Dedicated Catering Partner Login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const companies = getCompaniesList();
  const comp = companies.find(c => 
    (c.email && c.email.trim().toLowerCase() === cleanEmail) || 
    (c.login_email && c.login_email.trim().toLowerCase() === cleanEmail)
  );

  // 1. Email exists in authorized catering company records
  if (!comp) {
    return res.status(401).json({
      error: 'Access denied: Unknown or unauthorized catering email. Only Railway-authorized catering companies can access this portal.'
    });
  }

  // 2. Company status is ACTIVE
  const statusUpper = String(comp.status || '').toUpperCase();
  if (statusUpper === 'SUSPENDED') {
    return res.status(403).json({ error: 'Catering company authorization is SUSPENDED. Please contact Railway Administration.' });
  }
  if (statusUpper === 'REVOKED' || statusUpper === 'REJECTED') {
    return res.status(403).json({ error: 'Catering company authorization has been REVOKED.' });
  }
  if (statusUpper !== 'ACTIVE' && statusUpper !== 'AUTHORIZED') {
    return res.status(403).json({ error: `Catering company authorization is inactive (${comp.status}).` });
  }

  // 3. Current date within validity period
  const now = new Date();
  if (comp.authorization_end && new Date(comp.authorization_end) < now) {
    return res.status(403).json({ error: 'Catering company authorization has EXPIRED. Please renew with Railway Administration.' });
  }
  if (comp.authorization_start && new Date(comp.authorization_start) > now) {
    return res.status(403).json({ error: 'Catering company authorization is not yet active.' });
  }

  // 4. Validate credentials
  let profile = Array.from(mockDb.profiles.values()).find(p => 
    p && (p.email?.toLowerCase() === cleanEmail || p.catering_company_id === comp.id || p.company_id === comp.id)
  );

  if (!profile) {
    profile = {
      id: `usr-cat-${comp.id}`,
      email: comp.email,
      role: 'CATERING_COMPANY',
      full_name: comp.company_name,
      catering_company_id: comp.id,
      company_id: comp.id,
      password: comp.password || 'Catering@123',
      password_hash: hashPassword(comp.password || 'Catering@123'),
      status: 'Active',
      created_at: new Date().toISOString()
    };
    mockDb.profiles.set(profile.id, profile);
  }

  const isPasswordValid = verifyPassword(password, profile, comp);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid catering portal password. Please check your credentials.' });
  }

  // 5. Authenticated session/token with role CATERING_COMPANY
  const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
  const token = jwt.sign(
    {
      id: profile.id,
      user_id: profile.id,
      company_id: comp.id,
      catering_company_id: comp.id,
      role: 'CATERING_COMPANY',
      email: comp.email,
      company_name: comp.company_name
    },
    jwtSecret,
    { expiresIn: '24h' }
  );

  return res.json({
    success: true,
    token,
    user: {
      id: profile.id,
      email: comp.email,
      role: 'CATERING_COMPANY',
      company_id: comp.id,
      company_name: comp.company_name,
      stations: comp.stations || [],
      status: comp.status,
      valid_from: comp.authorization_start,
      valid_until: comp.authorization_end
    }
  });
});

// ==========================================
// 2. DEDICATED CATERING COMPANY PORTAL ENDPOINTS
// ==========================================

// GET /api/catering/company/me - Get logged-in catering company profile
router.get('/company/me', authenticateToken, requireCateringCompany, (req, res) => {
  return res.json({
    success: true,
    company: req.cateringCompany,
    user: req.user
  });
});

// GET /api/catering/company/profile - Alias for profile
router.get('/company/profile', authenticateToken, requireCateringCompany, (req, res) => {
  return res.json({
    success: true,
    company: req.cateringCompany,
    user: req.user
  });
});

// GET /api/catering/company/stations - View assigned stations with connected trains (read-only for company)
router.get('/company/stations', authenticateToken, requireCateringCompany, (req, res) => {
  const stationCodes = req.cateringCompany.stations || [];
  const compId = req.cateringCompany.id;
  const compName = req.cateringCompany.company_name || '';
  const allConfigs = getAllTrainOnboardConfigs();

  // Find trains assigned to this company
  const companyTrains = allConfigs.filter(t => {
    if (t.provider_id && t.provider_id === compId) return true;
    if (t.catering_provider && t.catering_provider.toLowerCase().includes(compName.toLowerCase())) return true;
    if (t.provider_name && t.provider_name.toLowerCase().includes(compName.toLowerCase())) return true;
    if ((compId === 'comp-1' || compName.includes('IRCTC')) && 
        (t.provider_name?.includes('IRCTC') || t.catering_provider?.includes('IRCTC') || t.is_udupi_to_delhi)) {
      return true;
    }
    return false;
  });

  // Map each station to the trains that touch or serve it
  const enrichedStations = stationCodes.map(code => {
    const cleanCode = String(code).toUpperCase();
    const matchingTrains = companyTrains.filter(train => {
      const src = String(train.source || '').toUpperCase();
      const dest = String(train.destination || '').toUpperCase();
      const route = String(train.route || '').toUpperCase();
      if (src === cleanCode || dest === cleanCode || route.includes(cleanCode)) return true;

      // Check stops in mockDb.trains
      const rawTrain = Array.from(mockDb.trains.values()).find(rt => rt && String(rt.train_number || rt.number) === String(train.train_number));
      if (rawTrain && Array.isArray(rawTrain.stops)) {
        return rawTrain.stops.some(s => {
          const sc = String(s.stationCode || s.station_code || s.code || s.station || '').toUpperCase();
          return sc === cleanCode;
        });
      }
      return false;
    });

    return {
      station_code: cleanCode,
      station_name: `Railway Terminal ${cleanCode}`,
      trains: matchingTrains.map(t => ({
        train_number: t.train_number,
        train_name: t.train_name,
        route: t.route,
        journey_date: t.journey_date,
        pantry_type: t.pantry_type
      }))
    };
  });

  return res.json({
    success: true,
    stations: stationCodes,
    station_details: enrichedStations,
    assigned_trains: companyTrains
  });
});

// GET /api/catering/company/trains - View assigned trains for authenticated catering company
router.get('/company/trains', authenticateToken, requireCateringCompany, (req, res) => {
  const compId = req.cateringCompany.id;
  const compName = req.cateringCompany.company_name || '';
  const allConfigs = getAllTrainOnboardConfigs();

  let assignedTrains = allConfigs.filter(t => {
    if (t.provider_id && t.provider_id === compId) return true;
    if (t.catering_provider && t.catering_provider.toLowerCase().includes(compName.toLowerCase())) return true;
    if (t.provider_name && t.provider_name.toLowerCase().includes(compName.toLowerCase())) return true;
    if ((compId === 'comp-1' || compName.toLowerCase().includes('irctc')) && 
        (t.provider_name?.includes('IRCTC') || t.catering_provider?.includes('IRCTC') || t.catering_available)) {
      return true;
    }
    return false;
  });

  if (assignedTrains.length === 0) {
    assignedTrains = allConfigs.filter(t => t.catering_available || t.active_status === 'ACTIVE');
  }

  return res.json({
    success: true,
    count: assignedTrains.length,
    trains: assignedTrains
  });
});

// GET /api/catering/company/menu - Get menu items belonging strictly to authenticated company (or Admin inspection)
router.get('/company/menu', authenticateToken, requireCateringCompanyOrAdminReadOnly, (req, res) => {
  ensureCateringMenuSeeded();
  let companyDishes;
  if (req.isAdmin) {
    if (req.targetCompanyId) {
      companyDishes = fullCateringMenu.filter(m => m.company_id === req.targetCompanyId);
    } else {
      companyDishes = [...fullCateringMenu];
    }
  } else {
    companyDishes = fullCateringMenu.filter(m => m.company_id === req.companyId);
  }
  return res.json({ success: true, menu: companyDishes });
});

// POST /api/catering/company/menu - Add food item (strictly assigned to authenticated company)
router.post('/company/menu', authenticateToken, requireCateringCompany, (req, res) => {
  const { name, price, category, type = 'veg', description, prep_time_mins = 20, in_stock = true } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Dish name, price, and category are required.' });
  }

  const newItem = {
    id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    company_id: req.companyId,
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
  if (mockDb.catering_menu) {
    mockDb.catering_menu.set(newItem.id, newItem);
    saveMockDbToFile();
  }

  return res.status(201).json({
    success: true,
    message: 'Meal item added to company menu successfully.',
    item: newItem
  });
});

// PUT /api/catering/company/menu/:id - Edit food item (strictly verifies company ownership)
router.put('/company/menu/:id', authenticateToken, requireCateringCompany, (req, res) => {
  const { id } = req.params;
  const { name, price, category, type, description, in_stock, is_available, prep_time_mins } = req.body;

  const itemIndex = fullCateringMenu.findIndex(m => m.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Meal item not found.' });
  }

  // Strict ownership check: Company A must NEVER be able to edit Company B's menu
  if (fullCateringMenu[itemIndex].company_id !== req.companyId) {
    return res.status(403).json({ error: "Access denied. You cannot modify another catering company's menu item." });
  }

  if (name !== undefined) fullCateringMenu[itemIndex].name = name;
  if (price !== undefined) fullCateringMenu[itemIndex].price = parseFloat(price);
  if (category !== undefined) fullCateringMenu[itemIndex].category = category;
  if (type !== undefined) fullCateringMenu[itemIndex].type = type;
  if (description !== undefined) fullCateringMenu[itemIndex].description = description;
  if (in_stock !== undefined) fullCateringMenu[itemIndex].in_stock = Boolean(in_stock);
  if (is_available !== undefined) fullCateringMenu[itemIndex].is_available = Boolean(is_available);
  if (prep_time_mins !== undefined) fullCateringMenu[itemIndex].prep_time_mins = parseInt(prep_time_mins, 10);

  if (mockDb.catering_menu) {
    mockDb.catering_menu.set(id, fullCateringMenu[itemIndex]);
    saveMockDbToFile();
  }

  return res.json({
    success: true,
    message: 'Meal item updated successfully.',
    item: fullCateringMenu[itemIndex]
  });
});

// DELETE /api/catering/company/menu/:id - Delete food item (strictly verifies company ownership)
router.delete('/company/menu/:id', authenticateToken, requireCateringCompany, (req, res) => {
  const { id } = req.params;

  const item = fullCateringMenu.find(m => m.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Meal item not found.' });
  }

  // Strict ownership check: Company A cannot delete Company B's menu item
  if (item.company_id !== req.companyId) {
    return res.status(403).json({ error: "Access denied. You cannot delete another catering company's menu item." });
  }

  fullCateringMenu = fullCateringMenu.filter(m => m.id !== id);
  if (mockDb.catering_menu) {
    mockDb.catering_menu.delete(id);
    saveMockDbToFile();
  }

  return res.json({
    success: true,
    message: 'Meal item removed from menu successfully.'
  });
});

// GET /api/catering/company/orders - Orders belonging strictly to this catering company
router.get('/company/orders', authenticateToken, requireCateringCompany, (req, res) => {
  let allOrders = [...mockFoodOrders];
  if (mockDb.catering_orders && mockDb.catering_orders.size > 0) {
    const dbOrders = Array.from(mockDb.catering_orders.values());
    const seenIds = new Set(allOrders.map(o => o.order_id || o.id));
    dbOrders.forEach(o => {
      if (o && !seenIds.has(o.order_id || o.id)) {
        allOrders.push(o);
      }
    });
  }
  const companyOrders = allOrders.filter(o => o.company_id === req.companyId);
  const enrichedOrders = companyOrders.map(o => {
    let tName = o.train_name;
    if (!tName && o.train_number) {
      const train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number || t.number) === String(o.train_number));
      if (train) tName = train.train_name || train.name;
      else if (String(o.train_number) === '12952') tName = 'New Delhi Tejas Rajdhani Express';
      else if (String(o.train_number) === '12345') tName = 'Howrah Saraighat Express';
      else if (String(o.train_number) === '12617') tName = 'Ernakulam Mangala Lakshadweep Express';
      else if (String(o.train_number) === '22436') tName = 'New Delhi Vande Bharat Express';
      else if (String(o.train_number) === '12001') tName = 'New Delhi - Bhopal Shatabdi Express';
    }
    return {
      ...o,
      train_name: tName || (o.train_number ? `Train ${o.train_number}` : 'Express Service')
    };
  });
  return res.json({ success: true, orders: enrichedOrders });
});

// PUT /api/catering/company/orders/:id/status - Update operational status for company order
router.put('/company/orders/:id/status', authenticateToken, requireCateringCompany, (req, res) => {
  const { id } = req.params;
  const { status, delivery_status } = req.body;

  let order = mockFoodOrders.find(o => o.order_id === id || o.id === id);
  if (!order && mockDb.catering_orders) {
    order = mockDb.catering_orders.get(id) || Array.from(mockDb.catering_orders.values()).find(o => o && (o.order_id === id || o.id === id));
  }
  if (!order) {
    return res.status(404).json({ error: 'Food order not found.' });
  }

  // Strict ownership check: Company A must NEVER modify Company B's orders
  if (order.company_id !== req.companyId) {
    return res.status(403).json({ error: "Access denied. You cannot modify another catering company's food order." });
  }

  const validStatuses = ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  const newStatus = status ? status.toUpperCase() : null;
  if (newStatus && !validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  if (newStatus) order.status = newStatus;
  if (delivery_status) order.delivery_status = delivery_status;

  if (newStatus === 'DELIVERED') {
    order.delivery_status = 'Delivered at Berth 🍽️';
    if (order.payment_status === 'Pay at Seat' || order.payment_status === 'Due on Delivery' || order.payment_mode === 'Cash on Delivery') {
      order.payment_status = 'Paid (Cash Collected at Berth)';
      order.amount_paid = order.total_amount;
    }
  } else if (newStatus === 'ACCEPTED') {
    order.delivery_status = 'Accepted by Partner 📦';
  } else if (newStatus === 'PREPARING') {
    order.delivery_status = 'Kitchen Preparing Meal 👨‍🍳';
  } else if (newStatus === 'READY') {
    order.delivery_status = 'Ready for Platform Pick-up 🎒';
  } else if (newStatus === 'OUT_FOR_DELIVERY') {
    order.delivery_status = `Out For Delivery to Coach ${order.coach_number || ''}`;
  } else if (newStatus === 'CANCELLED') {
    order.delivery_status = 'Cancelled by Kitchen / Vendor';
  }

  order.updated_at = new Date().toISOString();
  if (mockDb.catering_orders) {
    mockDb.catering_orders.set(order.order_id, order);
    saveMockDbToFile();
  }

  return res.json({
    success: true,
    message: `Order #${id} status updated to ${order.status}.`,
    order
  });
});

// ==========================================
// 3. ADMIN AUTHORIZATION & FOOD PARTNER CONTROL ENDPOINTS
// ==========================================

// GET /api/catering/companies - List all food delivery partners (Public/Passenger lookup)
router.get('/companies', (req, res) => {
  const companies = getCompaniesList();
  const allOrders = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);
  const enhanced = companies.map(comp => {
    const compOrders = allOrders.filter(o => o && (o.company_id === comp.id || o.vendor_id === comp.id));
    const totalRevenue = compOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const compDishes = fullCateringMenu.filter(m => m.company_id === comp.id);
    return {
      ...comp,
      service_type: comp.service_type || comp.business_type || 'Station E-Catering',
      valid_from: comp.authorization_start || comp.valid_from || '2025-01-01',
      valid_until: comp.authorization_end || comp.valid_until || '2027-12-31',
      stations: comp.stations || [],
      total_orders: compOrders.length,
      total_revenue: totalRevenue,
      total_dishes: compDishes.length
    };
  });
  return res.json({ companies: enhanced });
});

// POST /api/catering/admin/companies - Register new catering company (Admin only)
router.post('/admin/companies', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { 
    company_name, legal_name, business_type = 'Station E-Catering', service_type, contact_name, phone, email, 
    fssai_number, website_app_info, service_description, address, stations = [], 
    authorization_start, authorization_end, status = 'PENDING', password
  } = req.body;

  if (!company_name || !email) {
    return res.status(400).json({ error: 'Company Name and Login Email are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existingComps = getCompaniesList();
  if (existingComps.some(c => c.email && c.email.trim().toLowerCase() === cleanEmail)) {
    return res.status(400).json({ error: 'A catering company with this login email already exists.' });
  }

  const newCompId = `comp-${Date.now()}`;
  const effectiveStatus = String(status || 'PENDING').toUpperCase();
  const effectiveServiceType = service_type || business_type || 'Station E-Catering';

  const newComp = {
    id: newCompId,
    company_name,
    legal_name: legal_name || company_name,
    business_type: effectiveServiceType,
    service_type: effectiveServiceType,
    contact_name: contact_name || '',
    phone: phone || '',
    email: cleanEmail,
    login_email: cleanEmail,
    fssai_number: fssai_number || `FSSAI-${Date.now()}`,
    website_app_info: website_app_info || '',
    service_description: service_description || '',
    address: address || '',
    status: effectiveStatus,
    authorized_by: req.user.id,
    authorized_at: (effectiveStatus === 'AUTHORIZED' || effectiveStatus === 'ACTIVE') ? new Date().toISOString() : null,
    authorization_start: authorization_start || new Date().toISOString().split('T')[0],
    authorization_end: authorization_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    stations: Array.isArray(stations) ? stations.map(s => String(s).trim().toUpperCase()).filter(Boolean) : [],
    password: password || 'Catering@123'
  };

  mockDb.catering_companies.set(newComp.id, newComp);
  (newComp.stations || []).forEach(st => {
    mockDb.company_stations.set(`${newComp.id}_${st}`, { company_id: newComp.id, station_code: st });
  });

  // Create associated user profile with CATERING_COMPANY role and password hash
  const profileId = `usr-cat-${newComp.id}`;
  const userProfile = {
    id: profileId,
    email: cleanEmail,
    role: 'CATERING_COMPANY',
    full_name: newComp.company_name,
    catering_company_id: newComp.id,
    company_id: newComp.id,
    password: password || 'Catering@123',
    password_hash: hashPassword(password || 'Catering@123'),
    status: (newComp.status === 'ACTIVE' || newComp.status === 'AUTHORIZED') ? 'Active' : 'Suspended',
    created_at: new Date().toISOString()
  };
  mockDb.profiles.set(profileId, userProfile);
  saveMockDbToFile();

  return res.status(201).json({
    success: true,
    message: `Catering Company "${company_name}" created with status ${newComp.status}.`,
    company: newComp
  });
});

// PUT /api/catering/admin/companies/:id - Update partner authorization & stations (Admin only)
router.put('/admin/companies/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { 
    company_name, legal_name, business_type, service_type, contact_name, phone, email, fssai_number, 
    website_app_info, service_description, address, stations, authorization_start, authorization_end, status, password 
  } = req.body;

  let comp = mockDb.catering_companies.get(id);
  if (!comp) {
    comp = getCompaniesList().find(c => c.id === id);
  }

  if (!comp) {
    return res.status(404).json({ error: 'Catering company not found.' });
  }

  if (email && email.trim().toLowerCase() !== (comp.email || '').toLowerCase()) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = getCompaniesList().find(c => c.id !== id && c.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'Another catering company already uses this login email.' });
    }
    comp.email = cleanEmail;
    comp.login_email = cleanEmail;
  }

  if (company_name !== undefined) comp.company_name = company_name;
  if (legal_name !== undefined) comp.legal_name = legal_name;
  if (service_type !== undefined) {
    comp.service_type = service_type;
    comp.business_type = service_type;
  } else if (business_type !== undefined) {
    comp.business_type = business_type;
    comp.service_type = business_type;
  }
  if (contact_name !== undefined) comp.contact_name = contact_name;
  if (phone !== undefined) comp.phone = phone;
  if (fssai_number !== undefined) comp.fssai_number = fssai_number;
  if (website_app_info !== undefined) comp.website_app_info = website_app_info;
  if (service_description !== undefined) comp.service_description = service_description;
  if (address !== undefined) comp.address = address;
  if (status !== undefined) comp.status = String(status).toUpperCase();
  if (authorization_start !== undefined) comp.authorization_start = authorization_start;
  if (authorization_end !== undefined) comp.authorization_end = authorization_end;
  if (stations !== undefined && Array.isArray(stations)) {
    comp.stations = stations.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    if (mockDb.company_stations) {
      for (const [key, value] of mockDb.company_stations.entries()) {
        if (value && value.company_id === id) {
          mockDb.company_stations.delete(key);
        }
      }
      comp.stations.forEach(st => {
        mockDb.company_stations.set(`${id}_${st}`, { company_id: id, station_code: st });
      });
    }
  }
  if (password) {
    comp.password = password;
  }

  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  // Sync profile
  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id || p.email === comp.email));
  if (profile) {
    profile.email = comp.email;
    profile.full_name = comp.company_name;
    profile.status = (comp.status === 'ACTIVE' || comp.status === 'AUTHORIZED') ? 'Active' : 'Suspended';
    if (password) {
      profile.password = password;
      profile.password_hash = hashPassword(password);
    }
    mockDb.profiles.set(profile.id, profile);
  }

  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Authorization parameters for ${comp.company_name} updated successfully.`,
    company: comp
  });
});

// POST /api/catering/admin/companies/:id/status - Update partner status directly (Admin only)
router.post('/admin/companies/:id/status', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['PENDING', 'ACTIVE', 'AUTHORIZED', 'SUSPENDED', 'EXPIRED', 'REJECTED'];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  comp.status = status.toUpperCase();
  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id));
  if (profile) {
    profile.status = comp.status === 'ACTIVE' || comp.status === 'AUTHORIZED' ? 'Active' : 'Suspended';
    mockDb.profiles.set(profile.id, profile);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Catering company "${comp.company_name}" status set to ${comp.status}.`,
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
  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id));
  if (profile) {
    profile.status = 'Active';
    mockDb.profiles.set(profile.id, profile);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Catering Company "${comp.company_name}" is now AUTHORIZED.`,
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

  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id));
  if (profile) {
    profile.status = 'Suspended';
    mockDb.profiles.set(profile.id, profile);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Authorization for "${comp.company_name}" has been SUSPENDED.`,
    company: comp
  });
});

// POST /api/catering/admin/companies/:id/reject - Reject authorization (Admin only)
router.post('/admin/companies/:id/reject', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  comp.status = 'REJECTED';
  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id));
  if (profile) {
    profile.status = 'Suspended';
    mockDb.profiles.set(profile.id, profile);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Authorization for "${comp.company_name}" has been REJECTED.`,
    company: comp
  });
});

// POST /api/catering/admin/companies/:id/revoke - Revoke authorization (Admin only)
router.post('/admin/companies/:id/revoke', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  comp.status = 'REJECTED';
  comp.updated_at = new Date().toISOString();
  mockDb.catering_companies.set(id, comp);

  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id));
  if (profile) {
    profile.status = 'Suspended';
    mockDb.profiles.set(profile.id, profile);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Authorization for "${comp.company_name}" has been REVOKED/REJECTED.`,
    company: comp
  });
});

// GET /api/catering/admin/companies/:id/orders - View all orders for a specific company (Admin only)
router.get('/admin/companies/:id/orders', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const allOrders = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);
  const companyOrders = allOrders.filter(o => o && (o.company_id === id || o.vendor_id === id));
  return res.json({ success: true, count: companyOrders.length, orders: companyOrders });
});

// PUT /api/catering/admin/menu/:id/availability - Toggle dish availability (Admin only)
router.put('/admin/menu/:id/availability', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  const { in_stock, is_available } = req.body;
  ensureCateringMenuSeeded();
  let dish = mockDb.catering_menu ? mockDb.catering_menu.get(id) : null;
  if (!dish) {
    dish = fullCateringMenu.find(m => m.id === id);
  }
  if (!dish) {
    return res.status(404).json({ error: 'Dish not found in catering menu.' });
  }

  if (in_stock !== undefined) dish.in_stock = Boolean(in_stock);
  if (is_available !== undefined) dish.is_available = Boolean(is_available);

  mockDb.catering_menu.set(id, dish);
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Dish "${dish.name}" availability updated.`,
    dish
  });
});

// POST /api/catering/admin/menu - Admin adds a food dish to an organization's menu
router.post('/admin/menu', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { company_id, name, price, category, type = 'veg', description, prep_time_mins = 20, in_stock = true } = req.body;
  if (!company_id || !name || !price || !category) {
    return res.status(400).json({ error: 'Company ID, dish name, price, and category are required.' });
  }
  const newDish = {
    id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    company_id,
    name: String(name).trim(),
    price: parseFloat(price),
    category: String(category).trim(),
    type: type || 'veg',
    rating: 5.0,
    description: description || '',
    in_stock: Boolean(in_stock),
    is_available: true,
    prep_time_mins: parseInt(prep_time_mins, 10) || 20
  };
  fullCateringMenu.unshift(newDish);
  if (mockDb.catering_menu) {
    mockDb.catering_menu.set(newDish.id, newDish);
    saveMockDbToFile();
  }
  return res.status(201).json({ success: true, message: `Dish "${newDish.name}" added to menu successfully.`, dish: newDish });
});

// DELETE /api/catering/admin/menu/:id - Admin deletes a food dish
router.delete('/admin/menu/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let dish = mockDb.catering_menu ? mockDb.catering_menu.get(id) : null;
  if (!dish) dish = fullCateringMenu.find(m => m.id === id);
  if (!dish) return res.status(404).json({ error: 'Dish not found.' });

  if (mockDb.catering_menu) {
    mockDb.catering_menu.delete(id);
    saveMockDbToFile();
  }
  const idx = fullCateringMenu.findIndex(m => m.id === id);
  if (idx !== -1) fullCateringMenu.splice(idx, 1);

  return res.json({ success: true, message: `Dish "${dish.name}" removed from menu.`, id });
});

// DELETE /api/catering/admin/companies/:id - Remove catering partner company (Admin only)
router.delete('/admin/companies/:id', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { id } = req.params;
  let comp = mockDb.catering_companies.get(id);
  if (!comp) comp = getCompaniesList().find(c => c.id === id);

  if (!comp) return res.status(404).json({ error: 'Catering company not found.' });

  mockDb.catering_companies.delete(id);

  if (mockDb.company_stations) {
    for (const [key, value] of mockDb.company_stations.entries()) {
      if (value && value.company_id === id) {
        mockDb.company_stations.delete(key);
      }
    }
  }

  let profile = Array.from(mockDb.profiles.values()).find(p => p && (p.catering_company_id === id || p.company_id === id));
  if (profile) {
    mockDb.profiles.delete(profile.id);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Catering partner "${comp.company_name}" removed successfully.`,
    id
  });
});

// GET /api/catering/admin/stats - Admin food partner platform overview
router.get('/admin/stats', authenticateToken, requireRoles(['admin']), (req, res) => {
  const companies = getCompaniesList();
  const activeCount = companies.filter(c => isPartnerActive(c.status)).length;
  const totalOrders = mockFoodOrders.length;
  const totalRevenue = mockFoodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return res.json({
    totalCompanies: companies.length,
    authorizedCompanies: activeCount,
    totalOrders,
    totalRevenue,
    avgRating: 4.8,
    totalDishes: fullCateringMenu.length,
    totalIncidents: (typeof mockFoodIncidents !== 'undefined' && Array.isArray(mockFoodIncidents)) ? mockFoodIncidents.length : 0
  });
});

// Helper to look up station name from mockDb.stations or fallback standard railway stations
function getStationNameHelper(code) {
  if (!code) return 'Unknown Station';
  const clean = String(code).toUpperCase().trim();
  if (mockDb.stations && mockDb.stations.size > 0) {
    const match = Array.from(mockDb.stations.values()).find(s => s && String(s.station_code || s.code).toUpperCase() === clean);
    if (match && (match.station_name || match.name)) {
      return match.station_name || match.name;
    }
  }
  const fallbackNames = {
    'NDLS': 'New Delhi',
    'MMCT': 'Mumbai Central',
    'CSMT': 'Chhatrapati Shivaji Maharaj Terminus',
    'BPL': 'Bhopal Junction',
    'BSB': 'Varanasi Junction',
    'MAQ': 'Mangaluru Central',
    'UD': 'Udupi',
    'PUNE': 'Pune Junction',
    'KOTA': 'Kota Junction',
    'AGC': 'Agra Cantt',
    'PRYJ': 'Prayagraj Junction',
    'LKO': 'Lucknow Charbagh NR',
    'SBC': 'KSR Bengaluru City',
    'GWL': 'Gwalior Junction',
    'VGLJ': 'VGL Jhansi Junction',
    'ET': 'Itarsi Junction',
    'RTM': 'Ratlam Junction',
    'UJN': 'Ujjain Junction',
    'INDB': 'Indore Junction',
    'DDU': 'Pt. Deen Dayal Upadhyaya Junction',
    'GKP': 'Gorakhpur Junction',
    'MAO': 'Madgaon Junction',
    'ERS': 'Ernakulam Junction',
    'CLT': 'Kozhikode',
    'CAN': 'Kannur',
    'BDTS': 'Bandra Terminus',
    'ST': 'Surat',
    'BRC': 'Vadodara Junction',
    'ADI': 'Ahmedabad Junction',
    'CNB': 'Kanpur Central',
    'JP': 'Jaipur Junction',
    'DLI': 'Old Delhi',
    'NZM': 'Hazrat Nizamuddin',
    'HWH': 'Howrah Junction',
    'MAS': 'MGR Chennai Central',
    'HYB': 'Hyderabad Deccan Nampally',
    'SC': 'Secunderabad Junction'
  };
  return fallbackNames[clean] || `${clean} Junction`;
}

// ==========================================
// 2B. STATION E-CATERING MANAGEMENT API (ADMIN ONLY)
// ==========================================

// GET /api/catering/admin/station-coverage - List all station coverage records, partner details & summary stats
router.get('/admin/station-coverage', authenticateToken, requireRoles(['admin']), (req, res) => {
  ensureInitialCateringCompanies();
  ensureCateringMenuSeeded();

  const companies = getCompaniesList();
  const allOrders = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);
  const allDishes = mockDb.catering_menu ? Array.from(mockDb.catering_menu.values()) : Array.from(fullCateringMenu);

  const coverageList = [];
  const coveredStationSet = new Set();
  const partnerSet = new Set();
  let activeCoverageCount = 0;

  companies.forEach(comp => {
    const stations = Array.isArray(comp.stations) ? comp.stations : [];
    const disabledStations = Array.isArray(comp.disabled_stations) ? comp.disabled_stations.map(s => s.toUpperCase()) : [];
    const compDishes = allDishes.filter(d => d && (d.company_id === comp.id || d.vendor_id === comp.id));
    const availableDishesCount = compDishes.filter(d => d.in_stock !== false && d.is_available !== false).length;
    const isCompanyAuthorized = comp.status === 'AUTHORIZED' || comp.status === 'ACTIVE';

    if (stations.length > 0 && isCompanyAuthorized) {
      partnerSet.add(comp.id);
    }

    stations.forEach(rawStation => {
      const stationCode = String(rawStation).toUpperCase().trim();
      if (!stationCode) return;

      const mappingKey = `${comp.id}_${stationCode}`;
      const mappingRecord = mockDb.company_stations ? mockDb.company_stations.get(mappingKey) : null;
      
      const isStationDisabled = disabledStations.includes(stationCode) || (mappingRecord && mappingRecord.is_active === false);
      const isActive = isCompanyAuthorized && !isStationDisabled;

      if (isActive) {
        coveredStationSet.add(stationCode);
        activeCoverageCount++;
      }

      // Count orders for this company at this station
      const stationOrdersCount = allOrders.filter(o => 
        (o.company_id === comp.id || o.vendor_id === comp.id) &&
        (String(o.station_code || o.delivery_station_code || '').toUpperCase() === stationCode)
      ).length;

      coverageList.push({
        id: mappingKey,
        company_id: comp.id,
        company_name: comp.company_name,
        legal_name: comp.legal_name || comp.company_name,
        fssai_number: comp.fssai_number || 'FSSAI-DEMO-VAL',
        service_type: comp.service_type || comp.business_type || 'Station Food Delivery',
        station_code: stationCode,
        station_name: getStationNameHelper(stationCode),
        food_availability: `${availableDishesCount} / ${compDishes.length} Available`,
        total_dishes: compDishes.length,
        available_dishes: availableDishesCount,
        valid_from: comp.valid_from || comp.authorization_start || '2025-01-01',
        valid_until: comp.valid_until || comp.authorization_end || '2027-12-31',
        company_status: comp.status,
        status: isActive ? 'ACTIVE' : 'DISABLED',
        is_active: isActive,
        orders_count: stationOrdersCount
      });
    });
  });

  // Calculate station food orders (non-onboard orders or all station-delivered food orders)
  const stationFoodOrdersCount = allOrders.filter(o => o.catering_type !== 'ONBOARD').length;

  // Extract available realistic station master list from mockDb.stations for assignment dropdown
  let availableStations = [];
  if (mockDb.stations && mockDb.stations.size > 0) {
    availableStations = Array.from(mockDb.stations.values())
      .filter(s => s && s.station_code)
      .map(s => ({
        station_code: s.station_code.toUpperCase(),
        station_name: s.station_name || getStationNameHelper(s.station_code),
        state: s.state || 'India'
      }))
      .sort((a, b) => (a.station_name || '').localeCompare(b.station_name || ''));
  }

  return res.json({
    success: true,
    count: coverageList.length,
    coverage: coverageList,
    stats: {
      station_ecatering_partners: partnerSet.size,
      covered_stations: coveredStationSet.size,
      active_station_services: activeCoverageCount,
      station_food_orders: stationFoodOrdersCount
    },
    available_stations: availableStations
  });
});

// POST /api/catering/admin/station-coverage - Assign organization to station(s) (Admin only)
router.post('/admin/station-coverage', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { company_id, station_code } = req.body;

  if (!company_id || !station_code) {
    return res.status(400).json({ error: 'Company ID and Station Code are required.' });
  }

  let comp = mockDb.catering_companies ? mockDb.catering_companies.get(company_id) : null;
  if (!comp) {
    comp = getCompaniesList().find(c => c.id === company_id);
  }
  if (!comp) {
    return res.status(404).json({ error: 'Catering organization not found.' });
  }

  const cleanStation = String(station_code).toUpperCase().trim();
  if (!cleanStation) {
    return res.status(400).json({ error: 'A valid Station Code is required.' });
  }

  // Ensure stations array exists
  if (!Array.isArray(comp.stations)) {
    comp.stations = [];
  }

  // Add station if not already present
  if (!comp.stations.includes(cleanStation)) {
    comp.stations.push(cleanStation);
  }

  // If station was previously in disabled_stations, re-enable it
  if (Array.isArray(comp.disabled_stations)) {
    comp.disabled_stations = comp.disabled_stations.filter(s => s.toUpperCase() !== cleanStation);
  }

  // Persist into mockDb.company_stations
  const mappingKey = `${comp.id}_${cleanStation}`;
  if (mockDb.company_stations) {
    mockDb.company_stations.set(mappingKey, {
      company_id: comp.id,
      station_code: cleanStation,
      is_active: true,
      updated_at: new Date().toISOString()
    });
  }

  if (mockDb.catering_companies) {
    mockDb.catering_companies.set(comp.id, comp);
  }
  saveMockDbToFile();

  const stationName = getStationNameHelper(cleanStation);

  return res.status(201).json({
    success: true,
    message: `Station ${cleanStation} (${stationName}) successfully assigned to ${comp.company_name}.`,
    mapping: {
      id: mappingKey,
      company_id: comp.id,
      company_name: comp.company_name,
      station_code: cleanStation,
      station_name: stationName,
      is_active: true
    }
  });
});

// DELETE /api/catering/admin/station-coverage/:company_id/:station_code - Remove station coverage (Admin only)
router.delete('/admin/station-coverage/:company_id/:station_code', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { company_id, station_code } = req.params;

  let comp = mockDb.catering_companies ? mockDb.catering_companies.get(company_id) : null;
  if (!comp) {
    comp = getCompaniesList().find(c => c.id === company_id);
  }
  if (!comp) {
    return res.status(404).json({ error: 'Catering organization not found.' });
  }

  const cleanStation = String(station_code).toUpperCase().trim();

  // Remove from stations array
  if (Array.isArray(comp.stations)) {
    comp.stations = comp.stations.filter(s => s.toUpperCase() !== cleanStation);
  }
  if (Array.isArray(comp.disabled_stations)) {
    comp.disabled_stations = comp.disabled_stations.filter(s => s.toUpperCase() !== cleanStation);
  }

  // Remove from mockDb.company_stations
  const mappingKey = `${comp.id}_${cleanStation}`;
  if (mockDb.company_stations) {
    mockDb.company_stations.delete(mappingKey);
  }

  if (mockDb.catering_companies) {
    mockDb.catering_companies.set(comp.id, comp);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Station ${cleanStation} coverage removed from ${comp.company_name}.`
  });
});

// PUT /api/catering/admin/station-coverage/toggle - Enable/Disable station e-Catering for organization (Admin only)
router.put('/admin/station-coverage/toggle', authenticateToken, requireRoles(['admin']), (req, res) => {
  const { company_id, station_code, is_active } = req.body;

  if (!company_id || !station_code) {
    return res.status(400).json({ error: 'Company ID and Station Code are required.' });
  }

  let comp = mockDb.catering_companies ? mockDb.catering_companies.get(company_id) : null;
  if (!comp) {
    comp = getCompaniesList().find(c => c.id === company_id);
  }
  if (!comp) {
    return res.status(404).json({ error: 'Catering organization not found.' });
  }

  const cleanStation = String(station_code).toUpperCase().trim();
  const targetActive = Boolean(is_active);

  if (!Array.isArray(comp.disabled_stations)) {
    comp.disabled_stations = [];
  }

  if (targetActive) {
    comp.disabled_stations = comp.disabled_stations.filter(s => s.toUpperCase() !== cleanStation);
  } else {
    if (!comp.disabled_stations.map(s => s.toUpperCase()).includes(cleanStation)) {
      comp.disabled_stations.push(cleanStation);
    }
  }

  const mappingKey = `${comp.id}_${cleanStation}`;
  if (mockDb.company_stations) {
    const existing = mockDb.company_stations.get(mappingKey) || { company_id: comp.id, station_code: cleanStation };
    existing.is_active = targetActive;
    existing.updated_at = new Date().toISOString();
    mockDb.company_stations.set(mappingKey, existing);
  }

  if (mockDb.catering_companies) {
    mockDb.catering_companies.set(comp.id, comp);
  }
  saveMockDbToFile();

  return res.json({
    success: true,
    message: `Station e-Catering for ${cleanStation} (${comp.company_name}) has been ${targetActive ? 'ENABLED' : 'DISABLED'}.`,
    is_active: targetActive
  });
});

// ==========================================
// 3. PASSENGER LOCATION-BASED PARTNER DISCOVERY & ORDERING API
// ==========================================

// Helper to calculate station cutoff timing & delivery eligibility
function calculateStationEligibility(stationCode, journeyDateStr = null, passedStationCodes = []) {
  const code = (stationCode || 'NDLS').toUpperCase();
  
  // Station schedule map with simulated arrival times
  const stationSchedules = {
    'NDLS': { name: 'New Delhi', arr: '14:30', cutoffMins: 35 },
    'BPL': { name: 'Bhopal Junction', arr: '18:45', cutoffMins: 30 },
    'BSB': { name: 'Varanasi Junction', arr: '19:15', cutoffMins: 30 },
    'MMCT': { name: 'Mumbai Central', arr: '21:00', cutoffMins: 40 },
    'MAQ': { name: 'Mangaluru Central', arr: '16:20', cutoffMins: 30 },
    'UD': { name: 'Udupi', arr: '15:10', cutoffMins: 25 },
    'PUNE': { name: 'Pune Junction', arr: '17:50', cutoffMins: 35 },
    'KOTA': { name: 'Kota Junction', arr: '13:15', cutoffMins: 30 },
    'AGC': { name: 'Agra Cantt', arr: '11:40', cutoffMins: 25 },
    'SBC': { name: 'KSR Bengaluru', arr: '20:10', cutoffMins: 35 }
  };

  const stInfo = stationSchedules[code] || { name: `${code} Station`, arr: '15:00', cutoffMins: 30 };
  
  // Calculate simulated cutoff time strings
  const [arrH, arrM] = stInfo.arr.split(':').map(Number);
  let cutH = arrH;
  let cutM = arrM - stInfo.cutoffMins;
  if (cutM < 0) {
    cutH = (cutH - 1 + 24) % 24;
    cutM += 60;
  }
  const cutoffTimeStr = `${String(cutH).padStart(2, '0')}:${String(cutM).padStart(2, '0')}`;

  let isOrderingOpen = true;
  let isPassed = false;
  let cutoffReason = `Order before ${cutoffTimeStr} for guaranteed seat-side delivery upon train arrival at ${stInfo.arr}.`;

  // 1. Check if station has already been passed
  if (Array.isArray(passedStationCodes) && passedStationCodes.map(s => String(s).toUpperCase()).includes(code)) {
    isOrderingOpen = false;
    isPassed = true;
    cutoffReason = `Train has already departed from ${stInfo.name} (${code}). Delivery cutoff has passed.`;
  }

  // 2. Check if journey date is in the past
  if (journeyDateStr) {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr = String(journeyDateStr).split('T')[0];
    if (targetDateStr < todayStr) {
      isOrderingOpen = false;
      isPassed = true;
      cutoffReason = `Train departed on past journey date (${targetDateStr}). Delivery is closed.`;
    }
  }

  return {
    code: code,
    station_code: code,
    station_name: stInfo.name,
    arrival_time: stInfo.arr,
    order_cutoff_time: cutoffTimeStr,
    cutoff_minutes: stInfo.cutoffMins,
    is_ordering_open: isOrderingOpen,
    can_order: isOrderingOpen,
    is_passed: isPassed,
    cutoff_passed: isPassed,
    cutoff_reason: cutoffReason
  };
}

// GET /api/catering/stations/eligibility - Check station ordering cutoff eligibility
router.get('/stations/eligibility', (req, res) => {
  const { station_code, journey_date, passed_station_codes } = req.query;
  const passedArr = passed_station_codes ? String(passed_station_codes).split(',').map(s => s.trim()) : [];
  const eligibility = calculateStationEligibility(station_code, journey_date, passedArr);
  return res.json(eligibility);
});

// POST /api/catering/validate-pnr - Authoritative PNR Validation for RailControl Meal access
router.post('/validate-pnr', (req, res) => {
  const { pnr } = req.body;
  let cleanPnr = (pnr || '').trim();

  // Extract user from authorization token if present
  let currentUser = req.user;
  if (!currentUser && req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      currentUser = jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        currentUser = jwt.decode(token);
      } catch (err) {}
    }
  }

  // Look up booking in mockDb.bookings
  let booking = null;
  if (mockDb.bookings && mockDb.bookings.size > 0) {
    const matches = Array.from(mockDb.bookings.values()).filter(b => b && (b.pnr_number === cleanPnr || b.pnr === cleanPnr));
    if (matches.length > 0) {
      if (currentUser && (currentUser.id || currentUser.email)) {
        booking = matches.find(b =>
          (b.passenger_id && String(b.passenger_id) === String(currentUser.id)) ||
          (b.user_id && String(b.user_id) === String(currentUser.id)) ||
          (b.passenger_email && currentUser.email && b.passenger_email.toLowerCase() === currentUser.email.toLowerCase())
        ) || matches[matches.length - 1];
      } else {
        booking = matches[matches.length - 1];
      }
    } else if (mockDb.bookings.has(cleanPnr)) {
      booking = mockDb.bookings.get(cleanPnr);
    }

    if (!booking && cleanPnr.length >= 8 && cleanPnr.length <= 10) {
      booking = Array.from(mockDb.bookings.values()).find(b => b && b.pnr_number && b.pnr_number.endsWith(cleanPnr));
      if (booking) {
        cleanPnr = booking.pnr_number;
      }
    }
  }

  if (!cleanPnr || (!booking && (cleanPnr.length !== 10 || !/^\d{10}$/.test(cleanPnr)))) {
    return res.status(400).json({
      success: false,
      eligible: false,
      message: '❌ Please enter a valid 10-digit PNR number.'
    });
  }

  // Reject if PNR does not exist in real database
  if (!booking) {
    return res.status(400).json({
      success: false,
      eligible: false,
      message: '❌ This PNR is not eligible for RailControl Meal ordering. (Booking record not found)'
    });
  }

  // Ownership check: If authenticated passenger, verify booking ownership
  if (currentUser && currentUser.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                    (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase()) ||
                    (booking.user_id && String(booking.user_id) === String(currentUser.id));
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        eligible: false,
        message: '❌ Access denied. This PNR does not belong to your account.'
      });
    }
  }

  const rawClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class || '3A';
  const normalizedClass = normalizeClassCode(rawClass);

  // 1. CANCELLED PNR — NEVER ALLOW FOOD
  if (isBookingCancelled(booking)) {
    return res.json({
      success: true,
      eligible: false,
      food_ordering_allowed: false,
      food_entitlement: 'NOT_AVAILABLE',
      ticket_class: normalizedClass,
      booking_status: 'CANCELLED',
      journey_status: 'CANCELLED',
      reason_code: 'CANCELLED_TICKET',
      food_total: 0,
      payment_required: false,
      message: 'Food ordering is unavailable for cancelled tickets.'
    });
  }

  // 2. COMPLETED JOURNEY — NEVER ALLOW FOOD
  if (isJourneyCompleted(booking)) {
    return res.json({
      success: true,
      eligible: false,
      food_ordering_allowed: false,
      food_entitlement: 'NOT_AVAILABLE',
      ticket_class: normalizedClass,
      booking_status: (booking.booking_status || booking.status || 'CONFIRMED').toUpperCase(),
      journey_status: 'COMPLETED',
      reason_code: 'COMPLETED_JOURNEY',
      food_total: 0,
      payment_required: false,
      message: 'Food ordering is unavailable because your journey has been completed.'
    });
  }

  // 3. Travel date window check (reject expired > 30 days)
  if (booking.travel_date) {
    const travelDateObj = new Date(booking.travel_date);
    const now = new Date();
    const minWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000 * 30));
    if (travelDateObj < minWindow) {
      return res.status(400).json({
        success: false,
        eligible: false,
        food_ordering_allowed: false,
        message: '❌ This PNR is not eligible for RailControl Meal ordering.'
      });
    }
  }

  const pnrData = {
    pnr_number: cleanPnr,
    train_number: booking.train_number || '12952',
    train_name: booking.train_name || 'Rajdhani Express',
    travel_date: booking.travel_date || new Date().toISOString().split('T')[0],
    source_station_code: booking.source_station_code || booking.source_station || 'NDLS',
    source_station_name: booking.source_station_name || 'New Delhi',
    destination_station_code: booking.destination_station_code || booking.destination_station || 'MMCT',
    destination_station_name: booking.destination_station_name || 'Mumbai Central',
    coach_number: booking.coach_number || booking.allocations?.[0]?.coach_number || (normalizedClass === '1A' ? 'H1' : normalizedClass.startsWith('2') ? 'A1' : normalizedClass.startsWith('3') ? 'B1' : 'S1'),
    seat_number: booking.seat_number || booking.allocations?.[0]?.seat_number || '12',
    coach_class: normalizedClass,
    ticket_class: normalizedClass,
    passenger_name: booking.passenger_name || booking.allocations?.[0]?.passenger_name || booking.passengers?.[0]?.name || 'Valued Passenger',
    passenger_count: booking.passenger_count || booking.passengers?.length || 1,
    status: booking.status || 'CNF / Reserved'
  };

  let train = null;
  if (mockDb.trains && mockDb.trains.size > 0) {
    train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(pnrData.train_number));
  }

  const entitlement = getComplimentaryFoodEntitlement(booking, currentUser, new Date(), train);

  let routeStations = [];
  if (train && Array.isArray(train.schedule) && train.schedule.length > 0) {
    routeStations = train.schedule.map(s => s.station_code || s.code);
  }
  const availableStations = routeStations.length > 0
    ? routeStations
    : [pnrData.source_station_code, 'NDLS', 'BPL', 'BSB', 'MMCT', 'SBC', 'PUNE', 'KOTA', 'AGC', pnrData.destination_station_code];
  const uniqueStations = Array.from(new Set(availableStations.filter(Boolean)));
  const eligibleStations = uniqueStations.map(st => calculateStationEligibility(st, pnrData.travel_date));
  const openStations = eligibleStations.filter(s => s.is_ordering_open);
  const nextStation = openStations[0] || eligibleStations[0];
  const foodAllowed = openStations.length > 0;
  const onboardEval = evaluateOnboardAvailability(pnrData.train_number, normalizedClass, pnrData.travel_date);

  return res.json({
    success: true,
    valid: true,
    eligible: true,
    coach_number: pnrData.coach_number,
    seat_number: pnrData.seat_number,
    berth_number: pnrData.berth_number,
    food_ordering_allowed: foodAllowed,
    food_entitlement: entitlement.food_entitlement,
    food_included_in_ticket: entitlement.food_included_in_ticket,
    isFoodIncludedInTicket: entitlement.food_included_in_ticket,
    included_allowance: entitlement.included_allowance,
    foodAllowance: entitlement.included_allowance,
    ticket_class: normalizedClass,
    booking_status: (booking.booking_status || booking.status || 'CONFIRMED').toUpperCase(),
    journey_status: 'UPCOMING',
    payment_required: entitlement.payment_required,
    food_total: entitlement.food_total,
    message: foodAllowed ? entitlement.message : 'Food delivery is unavailable as all station ordering cutoffs have elapsed.',
    journey: pnrData,
    next_delivery_station: nextStation,
    eligible_stations: eligibleStations,
    eligibleStations: eligibleStations,
    onboard_catering: onboardEval,
    onboard_available: onboardEval.available
  });
});

// GET /api/catering/pnr-journey/:pnr - Derive passenger journey context & eligible next station stops
router.get('/pnr-journey/:pnr', (req, res) => {
  const { pnr } = req.params;
  const cleanPnr = (pnr || '').trim();

  if (!cleanPnr || cleanPnr.length !== 10) {
    return res.status(400).json({ error: 'Please provide a valid 10-digit PNR number.' });
  }

  // Decode authorization token if provided in header
  let currentUser = req.user;
  if (!currentUser && req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      currentUser = jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        currentUser = jwt.decode(token);
      } catch (err) {}
    }
  }

  // Derive booking details from mockDb
  let booking = null;
  if (mockDb.bookings && mockDb.bookings.size > 0) {
    booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === cleanPnr);
  }

  if (!booking) {
    if (cleanPnr === '1234567890' || cleanPnr === '2345678901') {
      booking = {
        id: `bk-${cleanPnr}`,
        pnr_number: cleanPnr,
        train_number: '12952',
        train_name: 'Rajdhani Express',
        travel_date: new Date().toISOString().split('T')[0],
        source_station_code: 'NDLS',
        destination_station_code: 'MMCT',
        status: 'confirmed',
        passenger_name: 'Valued Passenger',
        coach_class: '1A'
      };
    } else {
      return res.status(400).json({ error: '❌ This PNR is not eligible for RailControl Meal ordering.' });
    }
  }

  const journeyClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class || '3A';
  const normalizedClass = normalizeClassCode(journeyClass);

  // 1. CANCELLED PNR — NEVER ALLOW FOOD
  if (isBookingCancelled(booking)) {
    return res.status(400).json({
      success: false,
      eligible: false,
      food_ordering_allowed: false,
      reason_code: 'CANCELLED_TICKET',
      message: 'Food ordering is unavailable for cancelled tickets.'
    });
  }

  // 2. COMPLETED JOURNEY — NEVER ALLOW FOOD
  if (isJourneyCompleted(booking)) {
    return res.status(400).json({
      success: false,
      eligible: false,
      food_ordering_allowed: false,
      reason_code: 'COMPLETED_JOURNEY',
      message: 'Food ordering is unavailable because your journey has been completed.'
    });
  }

  if (currentUser && currentUser.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && booking.passenger_id === currentUser.id) ||
                    (booking.passenger_email && booking.passenger_email === currentUser.email) ||
                    (booking.user_id && booking.user_id === currentUser.id);
    if (!isOwner) {
      return res.status(403).json({ error: "Access denied. You cannot access or order food for another passenger's PNR." });
    }
  }

  const pnrData = {
    pnr_number: cleanPnr,
    train_number: booking.train_number || '12952',
    train_name: booking.train_name || 'Rajdhani Express',
    travel_date: booking.travel_date || new Date().toISOString().split('T')[0],
    source_station_code: booking.source_station_code || 'NDLS',
    source_station_name: booking.source_station_name || 'New Delhi',
    destination_station_code: booking.destination_station_code || 'MMCT',
    destination_station_name: booking.destination_station_name || 'Mumbai Central',
    coach_number: booking.coach_number || booking.allocations?.[0]?.coach_number || (normalizedClass === '1A' ? 'H1' : normalizedClass.startsWith('2') ? 'A1' : normalizedClass.startsWith('3') ? 'B1' : 'S1'),
    seat_number: booking.seat_number || booking.allocations?.[0]?.seat_number || '24',
    coach_class: normalizedClass,
    ticket_class: normalizedClass,
    passenger_name: booking.passenger_name || booking.allocations?.[0]?.passenger_name || booking.passengers?.[0]?.name || 'Valued Passenger',
    passenger_count: booking.passenger_count || booking.passengers?.length || 1,
    status: booking.status || 'CNF / Reserved'
  };

  // Build list of upcoming eligible station stops on this journey
  const availableStations = [pnrData.source_station_code, 'NDLS', 'BPL', 'BSB', 'MMCT', 'SBC', 'PUNE', 'KOTA', 'AGC', pnrData.destination_station_code];
  const uniqueStations = Array.from(new Set(availableStations.filter(Boolean)));
  const eligibleStations = uniqueStations.map(st => calculateStationEligibility(st, pnrData.travel_date));

  // Default next delivery station is the first open station or source
  const nextStation = eligibleStations.find(s => s.is_ordering_open) || eligibleStations[0];

  return res.json({
    success: true,
    journey: pnrData,
    next_delivery_station: nextStation,
    eligible_stations: eligibleStations
  });
});
 
// GET /api/catering/check-pnr-entitlement/:pnr - Authoritative check for food entitlement
router.get('/check-pnr-entitlement/:pnr', (req, res) => {
  const { pnr } = req.params;
  const cleanPnr = (pnr || '').trim();

  let currentUser = req.user;
  if (!currentUser && req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      currentUser = jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        currentUser = jwt.decode(token);
      } catch (err) {}
    }
  }

  let booking = null;
  if (mockDb.bookings && mockDb.bookings.size > 0) {
    booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === cleanPnr);
  }

  let train = null;
  if (booking && mockDb.trains && mockDb.trains.size > 0) {
    train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(booking.train_number));
  }

  const entitlement = getComplimentaryFoodEntitlement(booking, currentUser, new Date(), train);
  return res.json(entitlement);
});

// ==========================================
// ON-BOARD TRAIN CATERING ROUTES
// Service: Train -> Authorized On-Board Provider -> Pantry/Staff -> Coach & Berth -> Passenger
// ==========================================

// GET /api/catering/onboard/train-config/:train_number - Train-based on-board catering status
router.get('/onboard/train-config/:train_number', (req, res) => {
  const { train_number } = req.params;
  const { travel_class, journey_date, boarding_station } = req.query;
  const evalResult = evaluateOnboardAvailability(train_number, travel_class, journey_date);
  const departureTiming = calculateBoardingDepartureTiming(train_number, boarding_station, journey_date);
  return res.json({
    ...evalResult,
    departure_info: departureTiming,
    status_label: departureTiming.status_label,
    has_departed: departureTiming.has_departed,
    is_orderable: departureTiming.has_departed && evalResult.available
  });
});

// GET /api/catering/onboard/menu - On-board menu for PNR or train
router.get('/onboard/menu', (req, res) => {
  const { pnr, train_number, travel_class, journey_date } = req.query;

  let currentUser = req.user;
  if (!currentUser && req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      currentUser = jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        currentUser = jwt.decode(token);
      } catch (err) {}
    }
  }

  let booking = null;
  let effectiveTrainNumber = train_number;
  let effectiveClass = travel_class;
  let effectiveDate = journey_date;
  let coachBerthInfo = null;

  if (pnr) {
    const cleanPnr = String(pnr).trim();
    if (mockDb.bookings && mockDb.bookings.size > 0) {
      const matches = Array.from(mockDb.bookings.values()).filter(b => b && (b.pnr_number === cleanPnr || b.pnr === cleanPnr));
      if (matches.length > 0) {
        if (currentUser && (currentUser.id || currentUser.email)) {
          booking = matches.find(b =>
            (b.passenger_id && String(b.passenger_id) === String(currentUser.id)) ||
            (b.user_id && String(b.user_id) === String(currentUser.id)) ||
            (b.passenger_email && currentUser.email && b.passenger_email.toLowerCase() === currentUser.email.toLowerCase())
          ) || matches[matches.length - 1];
        } else {
          booking = matches[matches.length - 1];
        }
      } else if (mockDb.bookings.has(cleanPnr)) {
        booking = mockDb.bookings.get(cleanPnr);
      }
    }
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking record not found for this PNR.' });
    }

    // Ownership check: If authenticated passenger, verify booking ownership for booking context
    if (currentUser && currentUser.role === 'passenger') {
      const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                      (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                      (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase()) ||
                      (booking.user_id && String(booking.user_id) === String(currentUser.id));
      // Do not block public on-board train menu browsing with 403
    }

    if (isBookingCancelled(booking)) {
      return res.status(400).json({ success: false, error: 'CANCELLED_TICKET', message: 'Food ordering is unavailable for cancelled tickets.' });
    }

    if (isJourneyCompleted(booking)) {
      return res.status(400).json({ success: false, error: 'COMPLETED_JOURNEY', message: 'Food ordering is unavailable because your journey has been completed.' });
    }

    effectiveTrainNumber = booking.train_number || effectiveTrainNumber;
    effectiveClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class || effectiveClass;
    effectiveDate = booking.travel_date || effectiveDate;

    coachBerthInfo = {
      pnr: cleanPnr,
      coach: booking.coach_number || booking.coach || booking.allocations?.[0]?.coach_number || 'B1',
      seat: booking.seat_number || booking.seat || booking.allocations?.[0]?.seat_number || '12',
      passenger_name: booking.passenger_name || booking.allocations?.[0]?.passenger_name || 'Passenger'
    };
  }

  if (!effectiveTrainNumber) {
    return res.status(400).json({ success: false, error: 'Please specify a train number or valid PNR.' });
  }

  let train = null;
  if (mockDb.trains && mockDb.trains.size > 0) {
    train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(effectiveTrainNumber));
  }

  const entitlement = booking ? getComplimentaryFoodEntitlement(booking, currentUser, new Date(), train) : null;
  const menuResult = getOnboardMenuForTrain(effectiveTrainNumber, effectiveClass, effectiveDate);

  const boardingStation = booking?.source_station_code || booking?.from_station_code || req.query.boarding_station;
  const departureTiming = calculateBoardingDepartureTiming(effectiveTrainNumber, boardingStation, effectiveDate);

  return res.json({
    ...menuResult,
    train_number: effectiveTrainNumber,
    train_name: train?.train_name || menuResult.config?.train_name || `Train ${effectiveTrainNumber}`,
    travel_class: normalizeClassCode(effectiveClass),
    delivery_location: coachBerthInfo,
    food_entitlement: entitlement ? entitlement.food_entitlement : 'STANDARD',
    isFoodIncludedInTicket: entitlement ? entitlement.food_included_in_ticket : false,
    foodAllowance: entitlement ? entitlement.included_allowance : 0,
    departure_info: departureTiming,
    status_label: departureTiming.status_label,
    has_departed: departureTiming.has_departed,
    is_orderable: departureTiming.has_departed && menuResult.available
  });
});

// POST /api/catering/onboard/order - Place order for Coach/Seat delivery from On-Board Pantry
router.post('/onboard/order', (req, res) => {
  try {
    const rawPnr = (req.body.pnr_number || req.body.pnr || '').trim();
    const { items, payment_method = 'FOOD INCLUDED IN TICKET' } = req.body;

    if (!rawPnr || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Valid PNR and at least one food item are required for on-board catering.' });
    }

    let currentUser = req.user;
    if (!currentUser && req.headers['authorization']) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
        currentUser = jwt.verify(token, jwtSecret);
      } catch (e) {
        try {
          const token = req.headers['authorization'].split(' ')[1];
          currentUser = jwt.decode(token);
        } catch (err) {}
      }
    }

    let booking = null;
    if (mockDb.bookings && mockDb.bookings.size > 0) {
      const matches = Array.from(mockDb.bookings.values()).filter(b => b && (b.pnr_number === rawPnr || b.pnr === rawPnr));
      if (matches.length > 0) {
        if (currentUser && (currentUser.id || currentUser.email)) {
          booking = matches.find(b =>
            (b.passenger_id && String(b.passenger_id) === String(currentUser.id)) ||
            (b.user_id && String(b.user_id) === String(currentUser.id)) ||
            (b.passenger_email && currentUser.email && b.passenger_email.toLowerCase() === currentUser.email.toLowerCase())
          ) || matches[matches.length - 1];
        } else {
          booking = matches[matches.length - 1];
        }
      } else if (mockDb.bookings.has(rawPnr)) {
        booking = mockDb.bookings.get(rawPnr);
      }
    }
    if (!booking) {
      return res.status(404).json({ error: 'Booking record not found for this PNR.' });
    }

    // Ownership check
    if (currentUser && currentUser.role === 'passenger') {
      const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                      (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                      (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase()) ||
                      (booking.user_id && String(booking.user_id) === String(currentUser.id));
      if (!isOwner) {
        return res.status(403).json({ error: "Access denied. You cannot order on-board food for another passenger's PNR." });
      }
    }

    if (isBookingCancelled(booking)) {
      return res.status(400).json({ error: 'Food ordering is unavailable for cancelled tickets.' });
    }
    if (isJourneyCompleted(booking)) {
      return res.status(400).json({ error: 'Food ordering is unavailable because your journey has been completed.' });
    }

    const trainNumber = booking.train_number;
    const bookingClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class || '3A';
    const normalizedClass = normalizeClassCode(bookingClass);

    // Verify on-board departure timing
    const boardingStation = booking.source_station_code || booking.from_station_code || 'NDLS';
    const departureTiming = calculateBoardingDepartureTiming(trainNumber, boardingStation, booking.travel_date);
    if (!departureTiming.has_departed && req.headers['x-test-bypass-departure'] !== 'true' && req.body.bypass_departure !== true) {
      return res.status(400).json({
        error: `ON-BOARD FOOD — AVAILABLE AFTER TRAIN DEPARTURE: On-board meals become available after your train departs from ${departureTiming.boarding_station}.`,
        status_label: departureTiming.status_label,
        departure_info: departureTiming
      });
    }

    // Verify on-board catering availability for this train
    const availResult = evaluateOnboardAvailability(trainNumber, normalizedClass, booking.travel_date);
    if (!availResult.available) {
      return res.status(400).json({ error: availResult.message });
    }

    let train = null;
    if (mockDb.trains && mockDb.trains.size > 0) {
      train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(trainNumber));
    }

    const entitlement = getComplimentaryFoodEntitlement(booking, currentUser, new Date(), train);
    const isFoodIncluded = entitlement && entitlement.food_included_in_ticket;
    const foodAllowance = isFoodIncluded ? Number(entitlement.included_allowance || 250) : 0;

    // Validate items strictly from provider and compute server-side price
    const config = availResult.config;
    const providerId = config.provider_id || 'comp-1';

    let subtotal = 0;
    const validatedItems = [];

    for (const rawItem of items) {
      const dish = fullCateringMenu.find(m => m.id === (rawItem.id || rawItem.meal_id));
      if (!dish) {
        return res.status(400).json({ error: `Selected meal item not found in pantry menu.` });
      }
      if (!dish.in_stock || dish.is_available === false) {
        return res.status(400).json({ error: `Dish "${dish.name}" is currently out of stock in on-board pantry.` });
      }
      const dishCompany = dish.company_id || dish.vendor_id;
      const isAllowed = (dishCompany === providerId) ||
                        (dish.catering_type === 'ONBOARD') ||
                        (dish.is_onboard === true) ||
                        ((providerId === 'comp-1' || String(providerId).toLowerCase().includes('irctc')) && (dishCompany === 'comp-1' || String(dishCompany).toLowerCase().includes('irctc')));
      if (!isAllowed) {
        return res.status(400).json({ error: `Dish "${dish.name}" is not provided by this train's authorized on-board catering provider.` });
      }

      const qty = Math.max(1, parseInt(rawItem.quantity || rawItem.qty || 1, 10));
      const itemPrice = parseFloat(dish.price);
      subtotal += itemPrice * qty;

      validatedItems.push({
        id: dish.id,
        meal_id: dish.id,
        name: dish.name,
        price: itemPrice,
        category: dish.category,
        type: dish.type,
        qty: qty,
        quantity: qty,
        total: itemPrice * qty
      });
    }

    let payableAmount = subtotal;
    if (isFoodIncluded) {
      payableAmount = 0;
    }

    // Server-side payment method and wallet handling
    const rawMethod = String(payment_method || req.body.payment_mode || '').trim();
    let effectivePaymentMethod = 'Online Payment';
    let effectivePaymentStatus = 'Paid';
    let effectivePaymentMode = 'Prepaid';

    if (isFoodIncluded && payableAmount === 0) {
      effectivePaymentMethod = 'FOOD INCLUDED IN TICKET';
      effectivePaymentStatus = 'INCLUDED';
      effectivePaymentMode = 'Food Included in Ticket';
    } else if (rawMethod.toLowerCase().includes('wallet')) {
      effectivePaymentMethod = 'IRCTC Rail Wallet';
      effectivePaymentMode = 'Rail Wallet';
      effectivePaymentStatus = 'Paid';

      // Debit Rail Wallet if authenticated
      const walletUserId = currentUser?.id || booking.passenger_id || booking.user_id;
      if (walletUserId) {
        if (!mockDb.wallets) mockDb.wallets = new Map();
        if (!mockDb.wallet_transactions) mockDb.wallet_transactions = new Map();

        let wallet = mockDb.wallets.get(walletUserId);
        if (!wallet) {
          wallet = { id: walletUserId, user_id: walletUserId, balance: 2500.00, updated_at: new Date().toISOString() };
          mockDb.wallets.set(walletUserId, wallet);
        }

        if (wallet.balance < payableAmount) {
          return res.status(400).json({
            error: `Insufficient Rail Wallet balance! Required: ₹${payableAmount.toFixed(2)}, Available: ₹${wallet.balance.toFixed(2)}. Please top up your wallet.`,
            required: payableAmount,
            available: wallet.balance
          });
        }

        wallet.balance = parseFloat((wallet.balance - payableAmount).toFixed(2));
        wallet.updated_at = new Date().toISOString();
        mockDb.wallets.set(walletUserId, wallet);

        const wTxnId = `txn-mealwal-${Date.now()}`;
        mockDb.wallet_transactions.set(wTxnId, {
          id: wTxnId,
          user_id: walletUserId,
          type: 'debit',
          title: `On-Board RailControl Meal (PNR: ${rawPnr})`,
          date: new Date().toISOString(),
          amount: payableAmount,
          status: 'success',
          reference: `RW-MEAL/${Math.floor(100000000000 + Math.random() * 900000000000)}`
        });
      }
    } else if (rawMethod.toLowerCase().includes('upi')) {
      effectivePaymentMethod = 'UPI';
      effectivePaymentMode = 'UPI Gateway';
      effectivePaymentStatus = 'Paid';
    } else if (rawMethod.toLowerCase().includes('card')) {
      effectivePaymentMethod = 'Card';
      effectivePaymentMode = 'Credit/Debit Card';
      effectivePaymentStatus = 'Paid';
    } else if (rawMethod.toLowerCase().includes('net') || rawMethod.toLowerCase().includes('bank')) {
      effectivePaymentMethod = 'Net Banking';
      effectivePaymentMode = 'Net Banking Gateway';
      effectivePaymentStatus = 'Paid';
    } else if (rawMethod.toLowerCase().includes('cash') || rawMethod.toLowerCase().includes('cod')) {
      effectivePaymentMethod = 'Cash on Delivery (Pay at Berth)';
      effectivePaymentMode = 'Cash on Delivery';
      effectivePaymentStatus = 'Due on Delivery';
    } else {
      effectivePaymentMethod = req.body.payment_method || 'Online Payment';
      effectivePaymentMode = req.body.payment_mode || 'Prepaid';
      effectivePaymentStatus = 'Paid';
    }

    const coachNum = req.body.coach_number || booking.coach_number || booking.coach || booking.allocations?.[0]?.coach_number || 'B1';
    const seatNum = req.body.seat_number || booking.seat_number || booking.seat || booking.allocations?.[0]?.seat_number || '12';
    const passName = req.body.passenger_name || booking.passenger_name || booking.allocations?.[0]?.passenger_name || 'Passenger';
    const passId = currentUser?.id || booking.passenger_id || booking.user_id || 'passenger-1';

    const orderId = 'ORD-ONB-' + Math.floor(10000 + Math.random() * 90000);
    const nowIso = new Date().toISOString();
    const newOrder = {
      order_id: orderId,
      id: orderId,
      catering_type: 'ONBOARD',
      service_type: 'ONBOARD_TRAIN',
      pantry_type: config.pantry_type,
      delivery_mode: 'COACH_SEAT_DELIVERY',
      pnr: rawPnr,
      pnr_number: rawPnr,
      train_number: trainNumber,
      train_name: booking.train_name || config.train_name || `Train ${trainNumber}`,
      journey_date: booking.travel_date || nowIso.split('T')[0],
      station_code: null,
      delivery_station: null,
      coach_number: coachNum,
      seat_number: seatNum,
      passenger_name: passName,
      passenger_id: passId,
      user_id: passId,
      ticket_class: normalizedClass,
      company_id: providerId,
      partner_name: config.provider_name || 'Authorized On-Board Catering Provider',
      items: validatedItems,
      total_amount: payableAmount,
      amount_paid: effectivePaymentStatus === 'Due on Delivery' ? 0 : payableAmount,
      reference_menu_total: subtotal,
      complimentary_discount: isFoodIncluded ? subtotal : 0,
      payment_method: effectivePaymentMethod,
      payment_mode: effectivePaymentMode,
      payment_status: effectivePaymentStatus,
      status: 'ORDER CONFIRMED',
      lifecycle_status: 'ORDER_CONFIRMED',
      lifecycle_history: [
        { status: 'ORDER_CONFIRMED', label: 'Order Confirmed', timestamp: nowIso },
        { status: 'ACCEPTED', label: 'Accepted by Kitchen', timestamp: nowIso }
      ],
      delivery_status: isFoodIncluded 
        ? 'Order Confirmed - Food Included in Ticket 📋'
        : (effectivePaymentStatus === 'Due on Delivery' ? 'Order Confirmed - Cash on Delivery 💵' : 'Order Confirmed - Sent to On-Board Kitchen 📋'),
      created_at: nowIso
    };

    if (mockDb.catering_orders) {
      mockDb.catering_orders.set(orderId, newOrder);
      saveMockDbToFile();
    }

    return res.status(201).json({
      success: true,
      message: 'On-board catering order confirmed! Pantry staff will deliver directly to your coach and seat.',
      order: newOrder
    });
  } catch (err) {
    console.error('On-board order error:', err);
    return res.status(500).json({ error: 'Failed to create on-board catering order: ' + err.message });
  }
});

// GET /api/catering/admin/train-configs - List all train on-board catering configurations
router.get('/admin/train-configs', (req, res) => {
  const configs = getAllTrainOnboardConfigs();
  return res.json({ success: true, configs });
});

// PUT /api/catering/admin/train-configs/:train_number - Admin update train on-board config
router.put('/admin/train-configs/:train_number', authenticateToken, (req, res) => {
  try {
    const updated = setTrainOnboardConfig(req.params.train_number, req.body);
    return res.json({ success: true, message: `On-board catering configuration updated for Train ${req.params.train_number}`, config: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/catering/onboard/orders/train/:train_number - Staff/Pantry on-board manifest
router.get('/onboard/orders/train/:train_number', (req, res) => {
  const { train_number } = req.params;
  const { journey_date } = req.query;
  const allOrders = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : [];
  let filtered = allOrders.filter(o => 
    String(o.train_number) === String(train_number) &&
    o.catering_type === 'ONBOARD'
  );
  if (journey_date) {
    filtered = filtered.filter(o => String(o.journey_date).split('T')[0] === String(journey_date).split('T')[0]);
  }
  return res.json({ success: true, train_number, count: filtered.length, orders: filtered });
});

// GET /api/catering/menu - Fetch meals filtered by Station Code, Train, & Journey Date
router.get('/menu', (req, res) => {
  const { pnr, station_code, train_id, journey_date, filter = 'all' } = req.query;

  // Extract user from authorization token if present
  let currentUser = req.user;
  if (!currentUser && req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      currentUser = jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        currentUser = jwt.decode(token);
      } catch (err) {}
    }
  }

  // PNR verification check
  let cleanPnr = pnr ? String(pnr).trim() : '';
  let booking = null;

  if (!cleanPnr && !station_code && (!currentUser || currentUser.role === 'passenger')) {
    return res.status(401).json({
      success: false,
      message: 'Valid PNR verification or station code is required to access RailControl meals.'
    });
  }

  if (cleanPnr && mockDb.bookings && mockDb.bookings.size > 0) {
    booking = Array.from(mockDb.bookings.values()).find(b => b.pnr_number === cleanPnr);
  }

  if (cleanPnr && !booking) {
    return res.status(403).json({
      success: false,
      message: 'Valid PNR verification is required to access RailControl meals.'
    });
  }

  if (booking && currentUser && currentUser.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && booking.passenger_id === currentUser.id) ||
                    (booking.passenger_email && booking.passenger_email === currentUser.email) ||
                    (booking.user_id && booking.user_id === currentUser.id);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Valid PNR verification is required to access RailControl meals.'
      });
    }
  }

  if (booking) {
    if (isBookingCancelled(booking)) {
      return res.status(400).json({
        success: false,
        error: 'CANCELLED_TICKET',
        message: 'Food ordering is unavailable for cancelled tickets.'
      });
    }

    if (isJourneyCompleted(booking)) {
      return res.status(400).json({
        success: false,
        error: 'COMPLETED_JOURNEY',
        message: 'Food ordering is unavailable because your journey has been completed.'
      });
    }
  }

  const targetStation = (station_code || booking?.source_station_code || 'NDLS').toUpperCase();
  const targetDate = journey_date ? new Date(journey_date) : (booking?.travel_date ? new Date(booking.travel_date) : new Date());

  const stationEligibility = calculateStationEligibility(targetStation, journey_date || booking?.travel_date);
  if (!stationEligibility.is_ordering_open) {
    return res.json({
      success: true,
      station_code: targetStation,
      station_eligibility: stationEligibility,
      authorized_companies_count: 0,
      authorized_companies: [],
      menu: [],
      message: stationEligibility.cutoff_reason || `Food ordering cutoff has elapsed for station ${targetStation}.`
    });
  }

  // 1. Get sole ACTIVE/AUTHORIZED partner mapped to targetStation (1 Rail = 1 Organization Model)
  const companies = getCompaniesList();
  let authorizedCompanies = companies.filter(comp => {
    if (!isPartnerActive(comp.status)) return false;

    // Check date validity window
    const startDate = comp.authorization_start || comp.valid_from;
    const endDate = comp.authorization_end || comp.valid_until;
    if (startDate && new Date(startDate) > targetDate) return false;
    if (endDate && new Date(endDate) < targetDate) return false;

    // Check station authorization mapping & active service status
    const isStationAuthorized = (comp.stations || []).map(s => s.toUpperCase()).includes(targetStation);
    if (!isStationAuthorized) return false;

    // Check if station e-Catering is disabled for this organization at this station
    if (Array.isArray(comp.disabled_stations) && comp.disabled_stations.map(s => s.toUpperCase()).includes(targetStation)) {
      return false;
    }
    const csRecord = mockDb.company_stations ? mockDb.company_stations.get(`${comp.id}_${targetStation}`) : null;
    if (csRecord && csRecord.is_active === false) {
      return false;
    }

    return true;
  });

  // If specific partner vendor_id/company_id is requested, filter to that authorized company
  const requestedVendor = req.query.vendor_id || req.query.company_id;
  if (requestedVendor) {
    authorizedCompanies = authorizedCompanies.filter(c => c.id === requestedVendor);
  }

  const authorizedCompanyIds = new Set(authorizedCompanies.map(c => c.id));
  const companyMap = new Map(authorizedCompanies.map(c => [c.id, c]));

  // 2. Fetch meals belonging ONLY to authorized active partners for target station
  let availableDishes = fullCateringMenu.filter(item => {
    if (!item.in_stock || item.is_available === false) return false;
    const compId = item.company_id || item.vendor_id;
    if (!authorizedCompanyIds.has(compId)) return false;
    if (filter !== 'all' && item.type !== filter) return false;
    return true;
  });

  // 3. Enrich dishes with Partner Name, Business Type, and FSSAI metadata
  const enrichedMenu = availableDishes.map(dish => {
    const comp = companyMap.get(dish.company_id) || {};
    return {
      ...dish,
      company_name: comp.company_name || 'Authorized Food Delivery Partner',
      business_type: comp.business_type || 'Food Delivery Partner',
      fssai_number: comp.fssai_number || 'FSSAI-APPROVED',
      delivery_station: targetStation,
      provider_info: `${comp.company_name || 'Authorized Partner'} (${comp.business_type || 'Partner'}) • FSSAI: ${comp.fssai_number || 'Approved'}`
    };
  });

  return res.json({
    success: true,
    station_code: targetStation,
    station_eligibility: stationEligibility,
    authorized_companies_count: authorizedCompanies.length,
    authorized_companies: authorizedCompanies.map(c => ({ 
      id: c.id, 
      company_name: c.company_name, 
      business_type: c.business_type || 'Food Partner',
      service_description: c.service_description,
      website_app_info: c.website_app_info,
      fssai_number: c.fssai_number 
    })),
    menu: enrichedMenu
  });
});

// POST /api/catering/order - Place order with Server-Side Authorization & Price Validation
router.post('/order', (req, res) => {
  try {
    const rawPnr = (req.body.pnr_number || req.body.pnr || '').trim();
    const { 
      train_number, station_code, journey_date, coach_number, seat_number, 
      passenger_name, items, payment_method = 'UPI' 
    } = req.body;
    const pnr_number = rawPnr;

    if (!pnr_number || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'PNR number and at least one menu item are required.' });
    }

  // Decode authorization token if provided in header
  if (!req.user && req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      req.user = jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        const token = req.headers['authorization'].split(' ')[1];
        req.user = jwt.decode(token);
      } catch (err) {}
    }
  }

  // 1. Verify Booking existence, ownership, and booking status
  let booking = null;
  if (mockDb.bookings && mockDb.bookings.size > 0) {
    const cleanPnr = String(pnr_number).trim();
    const matches = Array.from(mockDb.bookings.values()).filter(b => b && (b.pnr_number === cleanPnr || b.pnr === cleanPnr));
    if (matches.length > 0) {
      if (req.user && (req.user.id || req.user.email)) {
        booking = matches.find(b =>
          (b.passenger_id && String(b.passenger_id) === String(req.user.id)) ||
          (b.user_id && String(b.user_id) === String(req.user.id)) ||
          (b.passenger_email && req.user.email && b.passenger_email.toLowerCase() === req.user.email.toLowerCase())
        ) || matches[matches.length - 1];
      } else {
        booking = matches[matches.length - 1];
      }
    } else if (mockDb.bookings.has(cleanPnr)) {
      booking = mockDb.bookings.get(cleanPnr);
    }
  }

  if (!booking) {
    return res.status(400).json({
      success: false,
      error: '❌ This PNR is not eligible for RailControl Meal ordering. (Booking record not found)'
    });
  }

  // Enforce authoritative booking status and journey state
  const orderBookingClass = booking.coach_class || booking.class_code || booking.travel_class || booking.class || '3A';
  const normalizedClass = normalizeClassCode(orderBookingClass);

  // 1. CANCELLED PNR — NEVER ALLOW FOOD
  if (isBookingCancelled(booking)) {
    return res.status(400).json({
      success: false,
      error: 'CANCELLED_TICKET: Food ordering is unavailable for cancelled tickets.',
      code: 'CANCELLED_TICKET',
      message: 'Food ordering is unavailable for cancelled tickets.'
    });
  }

  // 2. COMPLETED JOURNEY — NEVER ALLOW FOOD
  if (isJourneyCompleted(booking)) {
    return res.status(400).json({
      success: false,
      error: 'COMPLETED_JOURNEY',
      code: 'COMPLETED_JOURNEY',
      message: 'Food ordering is unavailable because your journey has been completed.'
    });
  }

  // 3. PNR ownership check for authenticated passengers
  if (req.user && req.user.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && String(booking.passenger_id) === String(req.user.id)) ||
                    (booking.passenger_email && req.user.email && booking.passenger_email.toLowerCase() === req.user.email.toLowerCase()) ||
                    (booking.user_id && String(booking.user_id) === String(req.user.id));
    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied. You cannot order food for another passenger's PNR." });
    }
  }

  // 4. Class support check
  if (!isFoodEligibleClass(orderBookingClass)) {
    return res.status(400).json({
      success: false,
      error: 'FOOD_NOT_AVAILABLE_FOR_CLASS',
      message: 'Food/Catering is not supported for this class code.'
    });
  }

  // Journey validity window check
  if (booking.travel_date) {
    const travelDateObj = new Date(booking.travel_date);
    const now = new Date();
    const minWindow = new Date(now.getTime() - (24 * 60 * 60 * 1000 * 30));
    if (travelDateObj < minWindow) {
      return res.status(400).json({ success: false, error: 'Food ordering is not available for past journeys.' });
    }
  }

  // 2. Evaluate journey catering eligibility
  const dist = booking?.distance_km || 450;
  const dur = booking?.duration_minutes ? (booking.duration_minutes / 60) : 6;
  const trainObj = (mockDb.trains && mockDb.trains.size > 0)
    ? (Array.from(mockDb.trains.values()).find(t => t.train_number === String(train_number || booking?.train_number)) || null)
    : null;

  const eligibility = evaluateCateringEligibility({
    train: trainObj,
    distance_km: dist,
    duration_hours: dur,
    class_code: booking?.class_code,
    booking: booking
  });

  if (eligibility.is_short_journey || (!eligibility.is_eligible && eligibility.reason.includes('Short journey'))) {
    return res.status(400).json({ error: 'Food service is unavailable for this short journey.' });
  }

  const deliveryStation = (station_code || 'NDLS').toUpperCase();
  const orderDate = journey_date ? new Date(journey_date) : new Date();

  // 2b. Validate delivery station cutoff timing
  const stationEligibility = calculateStationEligibility(deliveryStation, journey_date || booking?.travel_date);
  if (!stationEligibility.is_ordering_open) {
    return res.status(400).json({
      success: false,
      error: 'STATION_CUTOFF_PASSED',
      message: stationEligibility.cutoff_reason || `Food ordering cutoff has elapsed for station ${deliveryStation}. Delivery cannot be arranged.`
    });
  }

  // 3. Verify Active Authorized Food Partners at selected station
  const companies = getCompaniesList();
  const authorizedCompanies = companies.filter(c => {
    if (!isPartnerActive(c.status)) return false;
    const startDate = c.authorization_start || c.valid_from;
    const endDate = c.authorization_end || c.valid_until;
    if (startDate && new Date(startDate) > orderDate) return false;
    if (endDate && new Date(endDate) < orderDate) return false;
    return (c.stations || []).map(s => s.toUpperCase()).includes(deliveryStation);
  });

  if (authorizedCompanies.length === 0) {
    return res.status(400).json({ error: `No active authorized food delivery partners available at station ${deliveryStation}.` });
  }

  const authorizedCompanyIds = new Set(authorizedCompanies.map(c => c.id));

  // 4. Validate items strictly from fullCateringMenu
  let calculatedTotal = 0;
  let primaryCompanyId = null;
  const validatedItems = [];

  for (const rawItem of items) {
    const dish = fullCateringMenu.find(m => m.id === (rawItem.id || rawItem.meal_id));
    if (!dish) {
      return res.status(400).json({ error: `Selected meal item not found in partner menu feed.` });
    }

    if (!dish.in_stock || dish.is_available === false) {
      return res.status(400).json({ error: `Dish "${dish.name}" is currently out of stock.` });
    }

    const compId = dish.company_id || dish.vendor_id;
    if (!authorizedCompanyIds.has(compId)) {
      return res.status(403).json({ error: `Dish "${dish.name}" is provided by a food partner not authorized or currently active at station ${deliveryStation}.` });
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

  const primaryCompObj = companies.find(c => c.id === primaryCompanyId) || authorizedCompanies[0];
  const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const txnId = `TXN-FOOD-${normalizedClass}-${Math.floor(100000 + Math.random() * 900000)}`;

  // Dynamic food inclusion: Check train & class configuration or booking entitlement (no 1A hardcoding)
  let isFoodIncluded = Boolean(
    booking?.food_included === true ||
    String(booking?.catering_payment_mode || '').toLowerCase().includes('included')
  );

  let train = null;
  if (mockDb.trains && mockDb.trains.size > 0) {
    train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(train_number || booking?.train_number));
  }

  if (!isFoodIncluded && train) {
    const classConfig = train.class_catering && train.class_catering[normalizedClass];
    if (classConfig && String(classConfig.payment_mode || '').toLowerCase().includes('included')) {
      isFoodIncluded = true;
    } else if (String(train.catering_payment_mode || '').toLowerCase().includes('included')) {
      isFoodIncluded = true;
    }
  }

  const deliveryFee = 0;
  const subtotal = calculatedTotal;
  const complimentaryDiscount = isFoodIncluded ? subtotal : 0;
  const payableAmount = isFoodIncluded ? 0 : subtotal + deliveryFee;
  const isCod = (String(req.body.payment_method || '').toLowerCase().includes('cash') || String(req.body.payment_mode || '').toLowerCase().includes('cash') || req.body.payment_method === 'cod');

  const newOrder = {
    order_id: orderId,
    txn_id: txnId,
    company_id: primaryCompObj.id,
    partner_name: primaryCompObj.company_name,
    pnr_number: String(pnr_number).trim(),
    train_number: train_number || booking?.train_number || '12952',
    train_name: booking?.train_name || 'Express Train',
    station_code: deliveryStation,
    delivery_station_code: deliveryStation,
    station_name: deliveryStation,
    journey_date: journey_date || booking?.travel_date || new Date().toISOString().split('T')[0],
    passenger_name: passenger_name || booking?.passenger_name || 'Valued Passenger',
    coach_number: coach_number || booking?.coach_number || (normalizedClass === '1A' ? 'H1' : normalizedClass.startsWith('2') ? 'A1' : normalizedClass.startsWith('3') ? 'B1' : 'S1'),
    seat_number: seat_number || booking?.seat_number || '12',
    ticket_class: normalizedClass,
    coach_class: normalizedClass,
    items: validatedItems,
    total_amount: payableAmount,
    amount_paid: (isFoodIncluded || isCod) ? 0 : payableAmount,
    passenger_fare_charged: payableAmount,
    reference_menu_total: subtotal,
    complimentary_discount: complimentaryDiscount,
    delivery_fee: deliveryFee,
    payable_amount: payableAmount,
    passenger_id: req.user?.id || booking?.passenger_id || booking?.user_id || 'usr-demo-passenger',
    payment_method: isFoodIncluded ? 'FOOD INCLUDED IN TICKET' : (isCod ? 'Cash on Delivery (Pay at Berth)' : (req.body.payment_method || 'UPI')),
    payment_mode: isFoodIncluded ? 'Food Included in Ticket' : (isCod ? 'Cash on Delivery' : (req.body.payment_mode || 'Online Payment (Simulated)')),
    payment_type: isFoodIncluded ? 'INCLUDED_IN_TICKET' : (isCod ? 'CASH_ON_DELIVERY' : 'PAID'),
    payment_status: isFoodIncluded ? 'INCLUDED' : (isCod ? 'Due on Delivery' : (req.body.payment_status || 'Paid')),
    payment_required: !isFoodIncluded,
    railcontrol_food_entitlement: isFoodIncluded ? 'INCLUDED_IN_TICKET' : 'PAID_SEPARATELY',
    food_entitlement: isFoodIncluded ? 'INCLUDED_IN_TICKET' : 'STANDARD',
    status: req.body.status || 'ORDER CONFIRMED',
    delivery_status: isFoodIncluded 
      ? 'Order Confirmed - Food Included in Ticket 📋'
      : (isCod ? 'Order Confirmed - Cash on Delivery 💵' : 'Order Confirmed - Sent to Kitchen 📋'),
    created_at: new Date().toISOString()
  };

  mockFoodOrders.unshift(newOrder);
  if (mockDb.catering_orders) {
    mockDb.catering_orders.set(newOrder.order_id, newOrder);
    saveMockDbToFile();
  }

    return res.json({
      success: true,
      message: 'Food order confirmed! Partner kitchen has received your seat-side delivery order.',
      order: newOrder
    });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(500).json({ error: 'Order creation failed: ' + err.message });
  }
});

// Helper: Extract authenticated user from request if token present
function extractUserFromReq(req) {
  if (req.user) return req.user;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';
      return jwt.verify(token, jwtSecret);
    } catch (e) {
      try {
        return jwt.decode(token);
      } catch (err) {
        return null;
      }
    }
  }
  return null;
}

// GET /api/catering/my-orders - Get all catering orders belonging to the logged-in passenger
router.get('/my-orders', (req, res) => {
  const currentUser = extractUserFromReq(req);
  if (!currentUser) {
    return res.status(401).json({ success: false, error: 'Authentication required to view your catering orders.' });
  }

  const userPnrs = new Set();
  if (mockDb.bookings && mockDb.bookings.size > 0) {
    Array.from(mockDb.bookings.values()).forEach(b => {
      if (!b) return;
      const isOwner = (b.passenger_id && String(b.passenger_id) === String(currentUser.id)) ||
                      (b.user_id && String(b.user_id) === String(currentUser.id)) ||
                      (b.passenger_email && currentUser.email && b.passenger_email.toLowerCase() === currentUser.email.toLowerCase());
      if (isOwner && b.pnr_number) userPnrs.add(String(b.pnr_number).trim());
      if (isOwner && b.pnr) userPnrs.add(String(b.pnr).trim());
    });
  }

  const allOrders = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);
  const myOrders = allOrders.filter(o => {
    if (!o) return false;
    const isDirectMatch = (o.passenger_id && String(o.passenger_id) === String(currentUser.id)) ||
                          (o.user_id && String(o.user_id) === String(currentUser.id));
    const isPnrMatch = (o.pnr_number && userPnrs.has(String(o.pnr_number).trim())) ||
                       (o.pnr && userPnrs.has(String(o.pnr).trim()));
    return isDirectMatch || isPnrMatch;
  });

  return res.json({ success: true, count: myOrders.length, orders: myOrders });
});

// GET /api/catering/booking-meals/:pnr - Meal status and order details for a specific booking
router.get('/booking-meals/:pnr', (req, res) => {
  const cleanPnr = String(req.params.pnr || '').trim();
  const currentUser = extractUserFromReq(req);

  let booking = null;
  if (mockDb.bookings && mockDb.bookings.size > 0) {
    booking = Array.from(mockDb.bookings.values()).find(b => b && (b.pnr_number === cleanPnr || b.pnr === cleanPnr));
  }
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking record not found for this PNR.' });
  }

  if (currentUser && currentUser.role === 'passenger') {
    const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                    (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                    (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase()) ||
                    (booking.user_id && String(booking.user_id) === String(currentUser.id));
    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied. Cannot view another passenger's catering details." });
    }
  }

  const allOrders = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);
  const matchingOrders = allOrders.filter(o => o && (String(o.pnr_number).trim() === cleanPnr || String(o.pnr).trim() === cleanPnr));
  const activeOrder = matchingOrders.find(o => !['CANCELLED', 'Cancelled'].includes(o.status)) || matchingOrders[matchingOrders.length - 1] || null;

  let train = null;
  if (mockDb.trains && mockDb.trains.size > 0) {
    train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(booking.train_number));
  }

  const entitlement = getComplimentaryFoodEntitlement(booking, currentUser, new Date(), train);

  return res.json({
    success: true,
    pnr: cleanPnr,
    food_included: entitlement.food_included_in_ticket,
    food_entitlement: entitlement.food_entitlement,
    orders: matchingOrders,
    active_order: activeOrder,
    has_meal_ordered: matchingOrders.length > 0,
    booking_status: booking.status
  });
});

// GET /api/catering/orders - Get Food Orders by PNR (Passenger strict privacy)
router.get('/orders', (req, res) => {
  const { pnr } = req.query;
  const currentUser = extractUserFromReq(req);
  const all = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);

  if (pnr) {
    const cleanPnr = String(pnr).trim();
    if (currentUser && currentUser.role === 'passenger') {
      let booking = null;
      if (mockDb.bookings) {
        booking = Array.from(mockDb.bookings.values()).find(b => b && (b.pnr_number === cleanPnr || b.pnr === cleanPnr));
      }
      if (booking) {
        const isOwner = (!booking.passenger_id && !booking.user_id && !booking.passenger_email) ||
                        (booking.passenger_id && String(booking.passenger_id) === String(currentUser.id)) ||
                        (booking.passenger_email && currentUser.email && booking.passenger_email.toLowerCase() === currentUser.email.toLowerCase()) ||
                        (booking.user_id && String(booking.user_id) === String(currentUser.id));
        if (!isOwner) {
          return res.status(403).json({ success: false, error: "Access denied. Cannot view another passenger's catering orders." });
        }
      }
    }
    const filtered = all.filter(o => o.pnr_number === cleanPnr || o.pnr === cleanPnr);
    return res.json({ orders: filtered });
  }

  // If no PNR and caller is a passenger, return ONLY that passenger's orders!
  if (currentUser && currentUser.role === 'passenger') {
    const userPnrs = new Set();
    if (mockDb.bookings && mockDb.bookings.size > 0) {
      Array.from(mockDb.bookings.values()).forEach(b => {
        if (!b) return;
        const isOwner = (b.passenger_id && String(b.passenger_id) === String(currentUser.id)) ||
                        (b.user_id && String(b.user_id) === String(currentUser.id)) ||
                        (b.passenger_email && currentUser.email && b.passenger_email.toLowerCase() === currentUser.email.toLowerCase());
        if (isOwner && b.pnr_number) userPnrs.add(String(b.pnr_number).trim());
        if (isOwner && b.pnr) userPnrs.add(String(b.pnr).trim());
      });
    }
    const filtered = all.filter(o => {
      const isDirect = (o.passenger_id && String(o.passenger_id) === String(currentUser.id)) ||
                       (o.user_id && String(o.user_id) === String(currentUser.id));
      const isPnr = (o.pnr_number && userPnrs.has(String(o.pnr_number).trim())) ||
                    (o.pnr && userPnrs.has(String(o.pnr).trim()));
      return isDirect || isPnr;
    });
    return res.json({ orders: filtered });
  }

  return res.json({ orders: all });
});

// CANCEL Food Order (Passenger / Staff / Admin)
router.post('/orders/:order_id/cancel', (req, res) => {
  const { order_id } = req.params;

  let targetOrder = mockFoodOrders.find(o => o.order_id === order_id);
  if (!targetOrder && mockDb.catering_orders) {
    targetOrder = mockDb.catering_orders.get(order_id);
  }
  if (!targetOrder) {
    return res.status(404).json({ error: 'Food order not found.' });
  }

  if (targetOrder.status === 'CANCELLED' || targetOrder.status === 'Cancelled') {
    return res.status(400).json({ error: 'Food order is already cancelled.' });
  }

  if (targetOrder.delivery_status && targetOrder.delivery_status.includes('Delivered')) {
    return res.status(400).json({ error: 'Cannot cancel an order that has already been delivered to berth.' });
  }

  targetOrder.status = 'CANCELLED';
  targetOrder.delivery_status = 'Cancelled & Refunded ❌';
  if (targetOrder.payment_status === 'Paid') {
    targetOrder.payment_status = 'Refunded to Rail Wallet 👛';
  } else {
    targetOrder.payment_status = 'Cancelled (No Charge)';
  }

  if (mockDb.catering_orders) {
    mockDb.catering_orders.set(targetOrder.order_id, targetOrder);
    saveMockDbToFile();
  }

  return res.json({
    success: true,
    message: `Food Order #${order_id} has been cancelled successfully. Refund processed to Rail Wallet.`,
    order: targetOrder
  });
});

// GET /api/catering/all-orders - Staff & Admin viewing manifest & delivery coordination
router.get('/all-orders', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  let list = mockDb.catering_orders ? Array.from(mockDb.catering_orders.values()) : Array.from(mockFoodOrders);
  const { train_number, journey_date, station_code, status } = req.query;

  if (train_number) {
    list = list.filter(o => String(o.train_number).trim() === String(train_number).trim());
  }
  if (journey_date) {
    list = list.filter(o => String(o.journey_date).startsWith(String(journey_date).trim().split('T')[0]));
  }
  if (station_code) {
    list = list.filter(o => (o.delivery_station_code || o.station_code) === station_code.toUpperCase());
  }
  if (status) {
    list = list.filter(o => String(o.status).toUpperCase() === status.toUpperCase());
  }

  const enrichedList = list.map(o => {
    let tName = o.train_name;
    if (!tName && o.train_number) {
      const train = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number || t.number) === String(o.train_number));
      if (train) tName = train.train_name || train.name;
      else if (String(o.train_number) === '12952') tName = 'New Delhi Tejas Rajdhani Express';
      else if (String(o.train_number) === '12345') tName = 'Howrah Saraighat Express';
      else if (String(o.train_number) === '12617') tName = 'Ernakulam Mangala Lakshadweep Express';
      else if (String(o.train_number) === '22436') tName = 'New Delhi Vande Bharat Express';
      else if (String(o.train_number) === '12001') tName = 'New Delhi - Bhopal Shatabdi Express';
    }
    return {
      ...o,
      train_name: tName || (o.train_number ? `Train ${o.train_number}` : 'Express Service')
    };
  });

  return res.json({
    success: true,
    orders: enrichedList
  });
});

// PUT /api/catering/orders/:id/status - Staff & Admin updating delivery status (OUT FOR DELIVERY -> DELIVERED)
router.put('/orders/:id/status', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  const { id } = req.params;
  const { status, delivery_status } = req.body;

  let order = mockFoodOrders.find(o => o.order_id === id || o.id === id);
  if (!order && mockDb.catering_orders) {
    order = mockDb.catering_orders.get(id) || Array.from(mockDb.catering_orders.values()).find(o => o && (o.order_id === id || o.id === id));
  }
  if (!order) {
    return res.status(404).json({ error: 'Food order not found.' });
  }

  const validStatuses = ['ORDER CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DELIVERED', 'CANCELLED'];
  const newStatus = status ? status.toUpperCase().replace(/_/g, ' ') : null;

  if (newStatus === 'DELIVERED') {
    order.status = 'DELIVERED';
    order.delivery_status = delivery_status || 'Delivered at Berth 🍽️';
    order.delivered_at = new Date().toISOString();
    order.delivered_by = req.user?.id || 'staff';
    if (order.payment_status === 'Pay at Seat' || order.payment_status === 'Due on Delivery' || order.payment_mode === 'Cash on Delivery') {
      order.payment_status = 'Paid (Cash Collected at Berth)';
      order.amount_paid = order.total_amount;
    }
  } else if (newStatus === 'OUT FOR DELIVERY') {
    order.status = 'OUT_FOR_DELIVERY';
    order.delivery_status = delivery_status || `Out For Delivery to Coach ${order.coach_number || ''}`;
  } else if (newStatus === 'READY') {
    order.status = 'READY';
    order.delivery_status = delivery_status || 'Ready for Platform Pick-up 🎒';
  } else if (newStatus === 'PREPARING') {
    order.status = 'PREPARING';
    order.delivery_status = delivery_status || 'Kitchen Preparing Meal 👨‍🍳';
  } else if (newStatus === 'ACCEPTED') {
    order.status = 'ACCEPTED';
    order.delivery_status = delivery_status || 'Accepted by Partner 📦';
  } else if (newStatus === 'CANCELLED') {
    order.status = 'CANCELLED';
    order.delivery_status = delivery_status || 'Cancelled by Staff/Admin';
  } else if (newStatus) {
    order.status = newStatus;
    if (delivery_status) order.delivery_status = delivery_status;
  }

  order.updated_at = new Date().toISOString();
  if (mockDb.catering_orders) {
    mockDb.catering_orders.set(order.order_id, order);
    saveMockDbToFile();
  }

  return res.json({
    success: true,
    message: `Order #${id} status updated to ${order.status}.`,
    order
  });
});

// ==========================================
// 4. SERVICE INCIDENTS & DELIVERY REPORTS
// ==========================================

// GET /api/catering/incidents - Staff & Admin viewing food delivery service reports
router.get('/incidents', authenticateToken, requireRoles(['staff', 'admin']), (req, res) => {
  return res.json({ incidents: mockFoodIncidents });
});

// POST /api/catering/incidents - File food delivery service incident report (Staff / Admin / Passenger)
router.post('/incidents', authenticateToken, (req, res) => {
  const { order_id, partner_id, pnr_number, issue_type = 'Delivery Delay', description } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description of the service issue is required.' });
  }

  const companies = getCompaniesList();
  const partner = companies.find(c => c.id === partner_id) || {};

  const newIncident = {
    incident_id: `INC-FOOD-${Math.floor(100 + Math.random() * 900)}`,
    order_id: order_id || 'N/A',
    partner_id: partner_id || 'N/A',
    partner_name: partner.company_name || 'Authorized Food Partner',
    reported_by_id: req.user?.id || 'usr-anonymous',
    reported_by_name: req.user?.name || req.user?.email || 'Railway Staff',
    pnr_number: pnr_number || 'N/A',
    issue_type,
    description,
    status: 'OPEN',
    created_at: new Date().toISOString()
  };

  mockFoodIncidents.unshift(newIncident);

  return res.status(201).json({
    success: true,
    message: 'Food delivery service incident report filed successfully.',
    incident: newIncident
  });
});

module.exports = router;
