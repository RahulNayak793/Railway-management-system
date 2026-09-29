const fs = require('fs');
const path = require('path');
const { mockDb, saveMockDbToFile } = require('../config/supabase');

function seedRichDummyCateringData() {
  console.log('Seeding rich dummy catering data...');

  // 1. Add comp-6 (Purvanchal Rail Rasoi - PENDING) and comp-7 (Punjab Mail Kitchens - AUTHORIZED)
  const newCompanies = [
    {
      id: 'comp-6',
      company_name: 'Purvanchal Rail Rasoi',
      legal_name: 'Purvanchal Railway Catering & Hospitality Services Pvt Ltd',
      service_type: 'Eastern Region Express Catering & Thalis',
      business_type: 'Eastern Region Express Catering & Thalis',
      contact_name: 'Rameshwar Pandey',
      phone: '+91 9415002233',
      email: 'purvanchal@railrasoi.in',
      login_email: 'purvanchal@railrasoi.in',
      fssai_number: '10023011000888',
      website_app_info: 'https://purvanchalrailrasoi.in',
      service_description: 'Authentic Eastern UP and Bihar regional delicacies, Bhojpuri thalis & satvik snacks',
      address: 'Near Railway Station Platform 1, Gorakhpur, UP',
      status: 'PENDING',
      authorization_start: '2026-01-01T00:00:00Z',
      authorization_end: '2028-12-31T23:59:59Z',
      valid_from: '2026-01-01',
      valid_until: '2028-12-31',
      stations: ['LKO', 'PRYJ', 'BSB', 'GKP', 'PNBE', 'DDU', 'GAYA']
    },
    {
      id: 'comp-7',
      company_name: 'Punjab Mail Kitchens & Pantry',
      legal_name: 'Punjab Mail Railway Express Catering Ltd',
      service_type: 'North-Western Pantry & Station Delivery',
      business_type: 'North-Western Pantry & Station Delivery',
      contact_name: 'Harpreet Singh',
      phone: '+91 9814005544',
      email: 'punjabmail@catering.in',
      login_email: 'punjabmail@catering.in',
      fssai_number: '10024011000777',
      website_app_info: 'https://punjabmailcatering.in',
      service_description: 'Rich Punjabi thalis, Amritsari kulchas, parathas, makki saag and pure dairy lassi',
      address: 'GT Road Near Railway Station, Amritsar, Punjab',
      status: 'AUTHORIZED',
      authorization_start: '2025-06-01T00:00:00Z',
      authorization_end: '2027-12-31T23:59:59Z',
      valid_from: '2025-06-01',
      valid_until: '2027-12-31',
      stations: ['ASR', 'LDH', 'UMB', 'NDLS', 'JAT', 'PNP']
    }
  ];

  newCompanies.forEach(comp => {
    mockDb.catering_companies.set(comp.id, comp);
  });

  // 2. Add realistic dishes for comp-6 and comp-7
  const newDishes = [
    {
      id: 'm601',
      company_id: 'comp-6',
      name: 'Banarasi Dum Aloo & Puri Meal',
      price: 180,
      category: 'Lunch',
      type: 'veg',
      description: 'Slow-simmered baby potatoes in spiced tomato gravy with 4 piping hot puris, pickle & sweet',
      image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 15
    },
    {
      id: 'm602',
      company_id: 'comp-6',
      name: 'Bhojpuri Sattu Paratha Combo',
      price: 140,
      category: 'Breakfast',
      type: 'veg',
      description: '2 Roasted gram flour stuffed flatbreads with roasted tomato chokha, green chili and fresh curd',
      image_url: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 15
    },
    {
      id: 'm603',
      company_id: 'comp-6',
      name: 'Purvanchal Mutton Curry & Rice',
      price: 320,
      category: 'Dinner',
      type: 'non-veg',
      description: 'Slow-cooked homestyle mutton curry infused with whole garam masalas served with steamed basmati rice',
      image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 25
    },
    {
      id: 'm701',
      company_id: 'comp-7',
      name: 'Amritsari Kulcha with Chole & Lassi',
      price: 190,
      category: 'Breakfast',
      type: 'veg',
      description: 'Crispy clay-oven baked potato paneer kulcha topped with pure butter, served with pindi chole and sweet lassi',
      image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 18
    },
    {
      id: 'm702',
      company_id: 'comp-7',
      name: 'Sarson Ka Saag & Makki Roti Feast',
      price: 240,
      category: 'Lunch',
      type: 'veg',
      description: 'Traditional slow-cooked mustard greens tempered with garlic and white butter, 2 makki rotis & jaggery',
      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 20
    },
    {
      id: 'm703',
      company_id: 'comp-7',
      name: 'Punjabi Butter Chicken & Naan Platter',
      price: 310,
      category: 'Dinner',
      type: 'non-veg',
      description: 'Tender tandoori chicken cooked in rich buttery tomato cream gravy served with 2 butter garlic naans',
      image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 22
    },
    {
      id: 'm704',
      company_id: 'comp-7',
      name: 'Patiala Sweet Cream Lassi Flask',
      price: 85,
      category: 'Beverages',
      type: 'veg',
      description: 'Thick creamy Punjabi yogurt beverage topped with dry fruits and malai in sealed flask (350ml)',
      image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80',
      in_stock: true,
      is_available: true,
      prep_time_mins: 5
    }
  ];

  newDishes.forEach(d => {
    mockDb.catering_menu.set(d.id, d);
  });

  // 3. Add station coverage mappings in company_stations
  newCompanies.forEach(comp => {
    comp.stations.forEach(st => {
      const key = `${comp.id}_${st}`;
      mockDb.company_stations.set(key, {
        company_id: comp.id,
        station_code: st,
        is_active: comp.status === 'AUTHORIZED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
  });

  // Mark 1 station disabled for demonstration in comp-1 and comp-2
  const comp1Dli = mockDb.company_stations.get('comp-1_DLI');
  if (comp1Dli) {
    comp1Dli.is_active = false;
    const c1 = mockDb.catering_companies.get('comp-1');
    if (c1) {
      if (!c1.disabled_stations) c1.disabled_stations = [];
      if (!c1.disabled_stations.includes('DLI')) c1.disabled_stations.push('DLI');
    }
  }

  // 4. Add rich diverse dummy orders for Manifest
  const dummyOrders = [
    {
      order_id: 'ORD-10111',
      txn_id: 'TXN-FOOD-1A-10111',
      company_id: 'comp-1',
      partner_name: 'IRCTC Executive Pantry',
      pnr_number: '1122334455',
      train_number: '12952',
      train_name: 'New Delhi Tejas Rajdhani',
      catering_type: 'ONBOARD',
      station_code: 'NDLS',
      delivery_station_code: 'NDLS',
      station_name: 'New Delhi (NDLS)',
      passenger_name: 'Rahul Sharma',
      coach_number: 'H1',
      seat_number: '4',
      ticket_class: '1A',
      items: [
        { id: 'm1', name: 'Deluxe North Indian Thali', price: 240, qty: 1, company_id: 'comp-1' }
      ],
      total_amount: 0,
      payment_method: 'FOOD INCLUDED IN TICKET',
      payment_status: 'Included in Ticket',
      status: 'DELIVERED',
      delivery_status: 'Delivered at Berth 🍽️',
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    {
      order_id: 'ORD-10112',
      txn_id: 'TXN-FOOD-3A-10112',
      company_id: 'comp-1',
      partner_name: 'IRCTC Executive Pantry',
      pnr_number: '8819203941',
      train_number: '12952',
      train_name: 'New Delhi Tejas Rajdhani',
      catering_type: 'ONBOARD',
      station_code: 'NDLS',
      delivery_station_code: 'NDLS',
      station_name: 'New Delhi (NDLS)',
      passenger_name: 'Priya Singh',
      coach_number: 'B1',
      seat_number: '24',
      ticket_class: '3A',
      items: [
        { id: 'm2', name: 'Executive Non-Veg Meal Thali', price: 310, qty: 1, company_id: 'comp-1' }
      ],
      total_amount: 310,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'OUT_FOR_DELIVERY',
      delivery_status: 'Out For Delivery to Coach B1',
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    },
    {
      order_id: 'ORD-10113',
      txn_id: 'TXN-FOOD-CC-10113',
      company_id: 'comp-2',
      partner_name: 'MP Rail Catering Services',
      pnr_number: '7037000206',
      train_number: '12002',
      train_name: 'New Delhi Shatabdi Express',
      catering_type: 'STATION',
      station_code: 'BPL',
      delivery_station_code: 'BPL',
      station_name: 'Bhopal Junction (BPL)',
      passenger_name: 'Vikram Patel',
      coach_number: 'C1',
      seat_number: '14',
      ticket_class: 'CC',
      items: [
        { id: 'm201', name: 'Indori Poha Jalebi Royal Combo', price: 110, qty: 1, company_id: 'comp-2' },
        { id: 'm206', name: 'Shahi Kesar Lassi Glass', price: 70, qty: 1, company_id: 'comp-2' }
      ],
      total_amount: 180,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'PREPARING',
      delivery_status: 'Preparing in Kitchen at BPL Station 🍳',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      order_id: 'ORD-10114',
      txn_id: 'TXN-FOOD-EC-10114',
      company_id: 'comp-3',
      partner_name: 'Varanasi Satvik Kitchen',
      pnr_number: '2345678901',
      train_number: '22436',
      train_name: 'Varanasi Vande Bharat Express',
      catering_type: 'ONBOARD',
      station_code: 'BSB',
      delivery_station_code: 'BSB',
      station_name: 'Varanasi Junction (BSB)',
      passenger_name: 'Anita Desai',
      coach_number: 'EC1',
      seat_number: '15',
      ticket_class: 'EC',
      items: [
        { id: 'm301', name: '100% Pure Jain Satvik Special Thali', price: 240, qty: 1, company_id: 'comp-3' }
      ],
      total_amount: 240,
      payment_method: 'Net Banking',
      payment_status: 'Paid',
      status: 'DELIVERED',
      delivery_status: 'Delivered at Berth 🍽️',
      created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 240).toISOString()
    },
    {
      order_id: 'ORD-10115',
      txn_id: 'TXN-FOOD-2A-10115',
      company_id: 'comp-5',
      partner_name: 'Western Gourmet Express',
      pnr_number: '8819203941',
      train_number: '20901',
      train_name: 'Gandhinagar Vande Bharat',
      catering_type: 'STATION',
      station_code: 'MMCT',
      delivery_station_code: 'MMCT',
      station_name: 'Mumbai Central (MMCT)',
      passenger_name: 'Deepak Joshi',
      coach_number: 'A1',
      seat_number: '28',
      ticket_class: '2A',
      items: [
        { id: 'm502', name: 'Mumbai Special Butter Pav Bhaji', price: 150, qty: 2, company_id: 'comp-5' }
      ],
      total_amount: 300,
      payment_method: 'Cash on Delivery (Pay at Berth)',
      payment_status: 'Due on Delivery',
      status: 'ORDER CONFIRMED',
      delivery_status: 'Order Confirmed - Cash on Delivery 💵',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    },
    {
      order_id: 'ORD-10116',
      txn_id: 'TXN-FOOD-SL-10116',
      company_id: 'comp-4',
      partner_name: 'Coastal Rail Foods',
      pnr_number: '7037000206',
      train_number: '12626',
      train_name: 'New Delhi Kerala Express',
      catering_type: 'ONBOARD',
      station_code: 'ERS',
      delivery_station_code: 'ERS',
      station_name: 'Ernakulam Junction (ERS)',
      passenger_name: 'Suresh Verma',
      coach_number: 'S2',
      seat_number: '18',
      ticket_class: 'SL',
      items: [
        { id: 'm403', name: 'Malabar Parotta & Egg Curry Meal', price: 220, qty: 1, company_id: 'comp-4' }
      ],
      total_amount: 220,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'OUT_FOR_DELIVERY',
      delivery_status: 'Out For Delivery to Coach S2',
      created_at: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 50).toISOString()
    },
    {
      order_id: 'ORD-10117',
      txn_id: 'TXN-FOOD-1A-10117',
      company_id: 'comp-4',
      partner_name: 'Coastal Rail Foods',
      pnr_number: '1122334455',
      train_number: '22691',
      train_name: 'Bengaluru Rajdhani Express',
      catering_type: 'STATION',
      station_code: 'SBC',
      delivery_station_code: 'SBC',
      station_name: 'KSR Bengaluru (SBC)',
      passenger_name: 'Kavita Rao',
      coach_number: 'H1',
      seat_number: '2',
      ticket_class: '1A',
      items: [
        { id: 'm401', name: 'South Indian Mini Tiffin Feast', price: 180, qty: 1, company_id: 'comp-4' },
        { id: 'm405', name: 'Traditional Filter Coffee Flask', price: 65, qty: 1, company_id: 'comp-4' }
      ],
      total_amount: 245,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'DELIVERED',
      delivery_status: 'Delivered at Platform 1 SBC 🎒',
      created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 300).toISOString()
    },
    {
      order_id: 'ORD-10118',
      txn_id: 'TXN-FOOD-2A-10118',
      company_id: 'comp-5',
      partner_name: 'Western Gourmet Express',
      pnr_number: '2345678901',
      train_number: '12951',
      train_name: 'Mumbai Rajdhani Express',
      catering_type: 'ONBOARD',
      station_code: 'MMCT',
      delivery_station_code: 'MMCT',
      station_name: 'Mumbai Central (MMCT)',
      passenger_name: 'Ramesh Kumar',
      coach_number: 'A1',
      seat_number: '8',
      ticket_class: '2A',
      items: [
        { id: 'm501', name: 'Deluxe Gujarati Kathiyawadi Thali', price: 250, qty: 1, company_id: 'comp-5' }
      ],
      total_amount: 250,
      payment_method: 'Credit Card',
      payment_status: 'Paid',
      status: 'PREPARING',
      delivery_status: 'Order Confirmed - Sent to Kitchen 📋',
      created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 20).toISOString()
    },
    {
      order_id: 'ORD-10119',
      txn_id: 'TXN-FOOD-3A-10119',
      company_id: 'comp-1',
      partner_name: 'IRCTC Executive Pantry',
      pnr_number: '8819203941',
      train_number: '12424',
      train_name: 'New Delhi Dibrugarh Rajdhani',
      catering_type: 'STATION',
      station_code: 'CNB',
      delivery_station_code: 'CNB',
      station_name: 'Kanpur Central (CNB)',
      passenger_name: 'Sunil Yadav',
      coach_number: 'B2',
      seat_number: '31',
      ticket_class: '3A',
      items: [
        { id: 'm7', name: 'Lucknowi Veg Dum Biryani Bowl', price: 210, qty: 1, company_id: 'comp-1' }
      ],
      total_amount: 210,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'DELIVERED',
      delivery_status: 'Delivered at Platform 4 CNB 🎒',
      created_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 400).toISOString()
    },
    {
      order_id: 'ORD-10120',
      txn_id: 'TXN-FOOD-CC-10120',
      company_id: 'comp-2',
      partner_name: 'MP Rail Catering Services',
      pnr_number: '7037000206',
      train_number: '12001',
      train_name: 'Bhopal Shatabdi Express',
      catering_type: 'ONBOARD',
      station_code: 'BPL',
      delivery_station_code: 'BPL',
      station_name: 'Bhopal Junction (BPL)',
      passenger_name: 'Meena Gupta',
      coach_number: 'C2',
      seat_number: '12',
      ticket_class: 'CC',
      items: [
        { id: 'm202', name: 'Malwa Paneer Thali Feast', price: 230, qty: 1, company_id: 'comp-2' }
      ],
      total_amount: 230,
      payment_method: 'UPI',
      payment_status: 'Refunded to Rail Wallet 👛',
      status: 'CANCELLED',
      delivery_status: 'Cancelled & Refunded ❌',
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    {
      order_id: 'ORD-10121',
      txn_id: 'TXN-FOOD-3A-10121',
      company_id: 'comp-3',
      partner_name: 'Varanasi Satvik Kitchen',
      pnr_number: '2345678901',
      train_number: '22435',
      train_name: 'Varanasi Vande Bharat Return',
      catering_type: 'STATION',
      station_code: 'BSB',
      delivery_station_code: 'BSB',
      station_name: 'Varanasi Junction (BSB)',
      passenger_name: 'Rajesh Mishra',
      coach_number: 'C3',
      seat_number: '42',
      ticket_class: '3A',
      items: [
        { id: 'm307', name: 'Kashi Satvik Khichdi Feast', price: 170, qty: 1, company_id: 'comp-3' },
        { id: 'm305', name: 'Kulhad Masala Chai & Mathri Pack', price: 60, qty: 1, company_id: 'comp-3' }
      ],
      total_amount: 230,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'ORDER CONFIRMED',
      delivery_status: 'Order Confirmed - Sent to Kitchen 📋',
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 10).toISOString()
    },
    {
      order_id: 'ORD-10122',
      txn_id: 'TXN-FOOD-3A-10122',
      company_id: 'comp-4',
      partner_name: 'Coastal Rail Foods',
      pnr_number: '1122334455',
      train_number: '12617',
      train_name: 'Mangala Lakshadweep Express',
      catering_type: 'STATION',
      station_code: 'UD',
      delivery_station_code: 'UD',
      station_name: 'Udupi (UD)',
      passenger_name: 'Pooja Reddy',
      coach_number: 'B3',
      seat_number: '19',
      ticket_class: '3A',
      items: [
        { id: 'm407', name: 'Udupi Sambar Rice & Curd Rice Combo', price: 190, qty: 1, company_id: 'comp-4' }
      ],
      total_amount: 190,
      payment_method: 'UPI',
      payment_status: 'Paid',
      status: 'PREPARING',
      delivery_status: 'Preparing in Kitchen at UD Platform 2 🍳',
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      order_time: new Date(Date.now() - 1000 * 60 * 35).toISOString()
    }
  ];

  dummyOrders.forEach(o => {
    mockDb.catering_orders.set(o.order_id, o);
  });

  saveMockDbToFile();
  console.log(`✅ Successfully seeded:`);
  console.log(`- Total Catering Companies: ${mockDb.catering_companies.size}`);
  console.log(`- Total Company Stations: ${mockDb.company_stations.size}`);
  console.log(`- Total Menu Dishes: ${mockDb.catering_menu.size}`);
  console.log(`- Total Catering Orders: ${mockDb.catering_orders.size}`);
}

seedRichDummyCateringData();
