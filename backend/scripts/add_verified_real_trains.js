const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: db.json not found at', dbPath);
  process.exit(1);
}

// 1. Create a timestamped backup before any modifications
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `../data/db.backup.real_ir_trains_update_${timestamp}.json`);
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ [1/5] Backup created successfully at: ${backupPath}`);

// 2. Read existing db.json
const rawData = fs.readFileSync(dbPath, 'utf8');
const db = JSON.parse(rawData);

// Read before counts
const beforeCounts = {};
for (const k of Object.keys(db)) {
  const val = db[k];
  beforeCounts[k] = Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : 1);
}
console.log('\n📊 [2/5] BEFORE Database Record Counts:');
console.log(`   Trains: ${beforeCounts.trains || 0}`);
console.log(`   Routes: ${beforeCounts.routes || 0}`);
console.log(`   Bookings: ${beforeCounts.bookings || 0}`);
console.log(`   Profiles: ${beforeCounts.profiles || 0}`);
console.log(`   Seats: ${beforeCounts.seats || 0}`);
console.log(`   Payments: ${beforeCounts.payments || 0}`);
console.log(`   Catering Orders: ${beforeCounts.catering_orders || 0}`);

// Convert trains and routes to Map / lookup
const trainsMap = new Map(db.trains || []);
const routesMap = new Map(db.routes || []);
const seatsMap = new Map(db.seats || []);

// Helper to check existing train by number
function findTrainByNumber(num) {
  for (const [id, t] of trainsMap.entries()) {
    if (t && String(t.train_number).trim() === String(num).trim()) {
      return { id, train: t };
    }
  }
  return null;
}

// Helper to find route by train ID or train number
function findRouteByTrain(trainId, trainNum) {
  for (const [id, r] of routesMap.entries()) {
    if (r && (r.train_id === trainId || String(r.train_number).trim() === String(trainNum).trim())) {
      return { id, route: r };
    }
  }
  return null;
}

// Define verified real Indian Railways trains
const verifiedRealTrains = [
  {
    train_number: '12051',
    train_name: 'Jan Shatabdi Express',
    train_type: 'Jan Shatabdi',
    source_station_code: 'DR',
    destination_station_code: 'MAO',
    source: 'DR',
    destination: 'MAO',
    source_station_name: 'Dadar Central',
    destination_station_name: 'Madgaon Junction',
    departure_time: '05:25:00',
    arrival_time: '14:05:00',
    duration: '8h 40m',
    duration_minutes: 520,
    day_offset: 0,
    distance_km: 571,
    frequency: 'Daily',
    running_days: 'Daily',
    frequency_type: 'Daily',
    operating_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    available_classes: ['2S', 'CC'],
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 90,
    non_vegetarian_food_price: 110,
    class_catering: { '2S': false, 'CC': true },
    record_source: 'system_real_ir',
    service_status: 'ACTIVE',
    status: 'on_time',
    delay_minutes: 0,
    stops: [
      { sequence: 1, stationCode: 'DR', stationName: 'Dadar Central', arrTime: '05:25:00', depTime: '05:25:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 0, distance_km: 0 },
      { sequence: 2, stationCode: 'TNA', stationName: 'Thane', arrTime: '05:48:00', depTime: '05:50:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 24, distance_km: 24 },
      { sequence: 3, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '06:28:00', depTime: '06:30:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 57, distance_km: 57 },
      { sequence: 4, stationCode: 'ROHA', stationName: 'Roha', arrTime: '07:45:00', depTime: '07:47:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 132, distance_km: 132 },
      { sequence: 5, stationCode: 'MNI', stationName: 'Mangaon', arrTime: '08:08:00', depTime: '08:10:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 163, distance_km: 163 },
      { sequence: 6, stationCode: 'KHED', stationName: 'Khed', arrTime: '09:00:00', depTime: '09:02:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 230, distance_km: 230 },
      { sequence: 7, stationCode: 'CHI', stationName: 'Chiplun', arrTime: '09:28:00', depTime: '09:30:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 260, distance_km: 260 },
      { sequence: 8, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '10:40:00', depTime: '10:45:00', haltMinutes: '5', day_offset: 0, distanceFromOriginKm: 335, distance_km: 335 },
      { sequence: 9, stationCode: 'KANK', stationName: 'Kankavali', arrTime: '12:08:00', depTime: '12:10:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 447, distance_km: 447 },
      { sequence: 10, stationCode: 'KUDL', stationName: 'Kudal', arrTime: '12:34:00', depTime: '12:36:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 475, distance_km: 475 },
      { sequence: 11, stationCode: 'SWV', stationName: 'Sawantwadi Road', arrTime: '12:56:00', depTime: '12:58:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 496, distance_km: 496 },
      { sequence: 12, stationCode: 'THVM', stationName: 'Thivim', arrTime: '13:28:00', depTime: '13:30:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 525, distance_km: 525 },
      { sequence: 13, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '14:05:00', depTime: '14:05:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 571, distance_km: 571 }
    ]
  },
  {
    train_number: '12007',
    train_name: 'Chennai - Mysuru Shatabdi Express',
    train_type: 'Shatabdi',
    source_station_code: 'MAS',
    destination_station_code: 'MYS',
    source: 'MAS',
    destination: 'MYS',
    source_station_name: 'MGR Chennai Central',
    destination_station_name: 'Mysuru Junction',
    departure_time: '06:00:00',
    arrival_time: '13:00:00',
    duration: '7h 00m',
    duration_minutes: 420,
    day_offset: 0,
    distance_km: 497,
    frequency: 'Daily except Thu',
    running_days: 'Daily except Thu',
    frequency_type: 'Selected Days',
    operating_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
    available_classes: ['EC', 'CC'],
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 180,
    non_vegetarian_food_price: 210,
    class_catering: { 'EC': true, 'CC': true },
    record_source: 'system_real_ir',
    service_status: 'ACTIVE',
    status: 'on_time',
    delay_minutes: 0,
    stops: [
      { sequence: 1, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 0, distance_km: 0 },
      { sequence: 2, stationCode: 'KPD', stationName: 'Katpadi Junction', arrTime: '07:38:00', depTime: '07:40:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 130, distance_km: 130 },
      { sequence: 3, stationCode: 'JTJ', stationName: 'Jolarpettai Junction', arrTime: '08:48:00', depTime: '08:50:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 214, distance_km: 214 },
      { sequence: 4, stationCode: 'BNC', stationName: 'Bengaluru Cantt', arrTime: '10:28:00', depTime: '10:30:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 355, distance_km: 355 },
      { sequence: 5, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '10:45:00', depTime: '10:50:00', haltMinutes: '5', day_offset: 0, distanceFromOriginKm: 359, distance_km: 359 },
      { sequence: 6, stationCode: 'MYS', stationName: 'Mysuru Junction', arrTime: '13:00:00', depTime: '13:00:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 497, distance_km: 497 }
    ]
  },
  {
    train_number: '12619',
    train_name: 'Matsyagandha Express',
    train_type: 'Superfast',
    source_station_code: 'LTT',
    destination_station_code: 'MAQ',
    source: 'LTT',
    destination: 'MAQ',
    source_station_name: 'Lokmanya Tilak Terminus',
    destination_station_name: 'Mangaluru Central',
    departure_time: '15:20:00',
    arrival_time: '07:40:00',
    duration: '16h 20m',
    duration_minutes: 980,
    day_offset: 1,
    distance_km: 884,
    frequency: 'Daily',
    running_days: 'Daily',
    frequency_type: 'Daily',
    operating_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    available_classes: ['2A', '3A', 'SL', '2S'],
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 100,
    non_vegetarian_food_price: 120,
    class_catering: { '2A': true, '3A': true, 'SL': true, '2S': false },
    record_source: 'system_real_ir',
    service_status: 'ACTIVE',
    status: 'on_time',
    delay_minutes: 0,
    stops: [
      { sequence: 1, stationCode: 'LTT', stationName: 'Lokmanya Tilak Terminus', arrTime: '15:20:00', depTime: '15:20:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 0, distance_km: 0 },
      { sequence: 2, stationCode: 'TNA', stationName: 'Thane', arrTime: '15:37:00', depTime: '15:40:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 16, distance_km: 16 },
      { sequence: 3, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '16:20:00', depTime: '16:25:00', haltMinutes: '5', day_offset: 0, distanceFromOriginKm: 49, distance_km: 49 },
      { sequence: 4, stationCode: 'MNI', stationName: 'Mangaon', arrTime: '18:00:00', depTime: '18:02:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 154, distance_km: 154 },
      { sequence: 5, stationCode: 'KHED', stationName: 'Khed', arrTime: '19:00:00', depTime: '19:02:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 222, distance_km: 222 },
      { sequence: 6, stationCode: 'CHI', stationName: 'Chiplun', arrTime: '19:32:00', depTime: '19:34:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 252, distance_km: 252 },
      { sequence: 7, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '21:15:00', depTime: '21:20:00', haltMinutes: '5', day_offset: 0, distanceFromOriginKm: 328, distance_km: 328 },
      { sequence: 8, stationCode: 'KUDL', stationName: 'Kudal', arrTime: '23:38:00', depTime: '23:40:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 467, distance_km: 467 },
      { sequence: 9, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '01:05:00', depTime: '01:15:00', haltMinutes: '10', day_offset: 1, distanceFromOriginKm: 564, distance_km: 564 },
      { sequence: 10, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '02:10:00', depTime: '02:12:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 624, distance_km: 624 },
      { sequence: 11, stationCode: 'ANKL', stationName: 'Ankola', arrTime: '02:36:00', depTime: '02:38:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 652, distance_km: 652 },
      { sequence: 12, stationCode: 'GOK', stationName: 'Gokarna Road', arrTime: '02:48:00', depTime: '02:50:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 660, distance_km: 660 },
      { sequence: 13, stationCode: 'KT', stationName: 'Kumta', arrTime: '03:08:00', depTime: '03:10:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 679, distance_km: 679 },
      { sequence: 14, stationCode: 'MRDW', stationName: 'Murdeshwar', arrTime: '03:50:00', depTime: '03:52:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 719, distance_km: 719 },
      { sequence: 15, stationCode: 'BTJL', stationName: 'Bhatkal', arrTime: '04:08:00', depTime: '04:10:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 734, distance_km: 734 },
      { sequence: 16, stationCode: 'BYNR', stationName: 'Byndoor Mookambika Road', arrTime: '04:28:00', depTime: '04:30:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 749, distance_km: 749 },
      { sequence: 17, stationCode: 'KUDA', stationName: 'Kundapura', arrTime: '05:02:00', depTime: '05:04:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 782, distance_km: 782 },
      { sequence: 18, stationCode: 'UD', stationName: 'Udupi', arrTime: '05:36:00', depTime: '05:38:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 814, distance_km: 814 },
      { sequence: 19, stationCode: 'SL', stationName: 'Surathkal', arrTime: '06:34:00', depTime: '06:36:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 856, distance_km: 856 },
      { sequence: 20, stationCode: 'MAQ', stationName: 'Mangaluru Central', arrTime: '07:40:00', depTime: '07:40:00', haltMinutes: '0', day_offset: 1, distanceFromOriginKm: 884, distance_km: 884 }
    ]
  },
  {
    train_number: '12627',
    train_name: 'Karnataka Express',
    train_type: 'Superfast',
    source_station_code: 'SBC',
    destination_station_code: 'NDLS',
    source: 'SBC',
    destination: 'NDLS',
    source_station_name: 'KSR Bengaluru City',
    destination_station_name: 'New Delhi',
    departure_time: '19:20:00',
    arrival_time: '09:00:00',
    duration: '37h 40m',
    duration_minutes: 2260,
    day_offset: 2,
    distance_km: 2406,
    frequency: 'Daily',
    running_days: 'Daily',
    frequency_type: 'Daily',
    operating_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    available_classes: ['1A', '2A', '3A', 'SL'],
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 120,
    non_vegetarian_food_price: 140,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    record_source: 'system_real_ir',
    service_status: 'ACTIVE',
    status: 'on_time',
    delay_minutes: 0,
    stops: [
      { sequence: 1, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '19:20:00', depTime: '19:20:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 0, distance_km: 0 },
      { sequence: 2, stationCode: 'YPR', stationName: 'Yesvantpur Junction', arrTime: '19:30:00', depTime: '19:32:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 6, distance_km: 6 },
      { sequence: 3, stationCode: 'DMM', stationName: 'Dharmavaram Junction', arrTime: '22:20:00', depTime: '22:22:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 181, distance_km: 181 },
      { sequence: 4, stationCode: 'GTL', stationName: 'Guntakal Junction', arrTime: '00:05:00', depTime: '00:10:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 282, distance_km: 282 },
      { sequence: 5, stationCode: 'RC', stationName: 'Raichur', arrTime: '01:58:00', depTime: '02:00:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 404, distance_km: 404 },
      { sequence: 6, stationCode: 'WADI', stationName: 'Wadi Junction', arrTime: '03:50:00', depTime: '03:55:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 512, distance_km: 512 },
      { sequence: 7, stationCode: 'KLBG', stationName: 'Kalaburagi Junction', arrTime: '04:32:00', depTime: '04:35:00', haltMinutes: '3', day_offset: 1, distanceFromOriginKm: 549, distance_km: 549 },
      { sequence: 8, stationCode: 'SUR', stationName: 'Solapur', arrTime: '06:30:00', depTime: '06:35:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 662, distance_km: 662 },
      { sequence: 9, stationCode: 'DD', stationName: 'Daund Junction', arrTime: '09:30:00', depTime: '09:35:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 849, distance_km: 849 },
      { sequence: 10, stationCode: 'MMR', stationName: 'Manmad Junction', arrTime: '13:55:00', depTime: '14:00:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 1087, distance_km: 1087 },
      { sequence: 11, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '16:20:00', depTime: '16:25:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 1271, distance_km: 1271 },
      { sequence: 12, stationCode: 'ET', stationName: 'Itarsi Junction', arrTime: '21:00:00', depTime: '21:10:00', haltMinutes: '10', day_offset: 1, distanceFromOriginKm: 1578, distance_km: 1578 },
      { sequence: 13, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '22:50:00', depTime: '22:55:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 1670, distance_km: 1670 },
      { sequence: 14, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '02:40:00', depTime: '02:48:00', haltMinutes: '8', day_offset: 2, distanceFromOriginKm: 1962, distance_km: 1962 },
      { sequence: 15, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '04:05:00', depTime: '04:10:00', haltMinutes: '5', day_offset: 2, distanceFromOriginKm: 2059, distance_km: 2059 },
      { sequence: 16, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '05:45:00', depTime: '05:50:00', haltMinutes: '5', day_offset: 2, distanceFromOriginKm: 2177, distance_km: 2177 },
      { sequence: 17, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '09:00:00', depTime: '09:00:00', haltMinutes: '0', day_offset: 2, distanceFromOriginKm: 2372, distance_km: 2372 }
    ]
  },
  {
    train_number: '12625',
    train_name: 'Kerala Express',
    train_type: 'Superfast',
    source_station_code: 'TVC',
    destination_station_code: 'NDLS',
    source: 'TVC',
    destination: 'NDLS',
    source_station_name: 'Thiruvananthapuram Central',
    destination_station_name: 'New Delhi',
    departure_time: '12:30:00',
    arrival_time: '13:15:00',
    duration: '48h 45m',
    duration_minutes: 2925,
    day_offset: 2,
    distance_km: 3031,
    frequency: 'Daily',
    running_days: 'Daily',
    frequency_type: 'Daily',
    operating_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    available_classes: ['1A', '2A', '3A', 'SL'],
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 120,
    non_vegetarian_food_price: 140,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    record_source: 'system_real_ir',
    service_status: 'ACTIVE',
    status: 'on_time',
    delay_minutes: 0,
    stops: [
      { sequence: 1, stationCode: 'TVC', stationName: 'Thiruvananthapuram Central', arrTime: '12:30:00', depTime: '12:30:00', haltMinutes: '0', day_offset: 0, distanceFromOriginKm: 0, distance_km: 0 },
      { sequence: 2, stationCode: 'QLN', stationName: 'Kollam Junction', arrTime: '13:30:00', depTime: '13:33:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 65, distance_km: 65 },
      { sequence: 3, stationCode: 'KYJ', stationName: 'Kayamkulam Junction', arrTime: '14:13:00', depTime: '14:15:00', haltMinutes: '2', day_offset: 0, distanceFromOriginKm: 106, distance_km: 106 },
      { sequence: 4, stationCode: 'ALLP', stationName: 'Alappuzha', arrTime: '15:02:00', depTime: '15:05:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 149, distance_km: 149 },
      { sequence: 5, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '16:20:00', depTime: '16:25:00', haltMinutes: '5', day_offset: 0, distanceFromOriginKm: 206, distance_km: 206 },
      { sequence: 6, stationCode: 'TCR', stationName: 'Thrissur', arrTime: '17:42:00', depTime: '17:45:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 280, distance_km: 280 },
      { sequence: 7, stationCode: 'PGT', stationName: 'Palakkad Junction', arrTime: '19:12:00', depTime: '19:15:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 355, distance_km: 355 },
      { sequence: 8, stationCode: 'CBE', stationName: 'Coimbatore Junction', arrTime: '20:57:00', depTime: '21:00:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 411, distance_km: 411 },
      { sequence: 9, stationCode: 'ED', stationName: 'Erode Junction', arrTime: '22:30:00', depTime: '22:35:00', haltMinutes: '5', day_offset: 0, distanceFromOriginKm: 512, distance_km: 512 },
      { sequence: 10, stationCode: 'SA', stationName: 'Salem Junction', arrTime: '23:27:00', depTime: '23:30:00', haltMinutes: '3', day_offset: 0, distanceFromOriginKm: 571, distance_km: 571 },
      { sequence: 11, stationCode: 'KPD', stationName: 'Katpadi Junction', arrTime: '02:58:00', depTime: '03:00:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 776, distance_km: 776 },
      { sequence: 12, stationCode: 'RU', stationName: 'Renigunta Junction', arrTime: '04:40:00', depTime: '04:45:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 890, distance_km: 890 },
      { sequence: 13, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '10:30:00', depTime: '10:45:00', haltMinutes: '15', day_offset: 1, distanceFromOriginKm: 1268, distance_km: 1268 },
      { sequence: 14, stationCode: 'WL', stationName: 'Warangal', arrTime: '13:38:00', depTime: '13:40:00', haltMinutes: '2', day_offset: 1, distanceFromOriginKm: 1475, distance_km: 1475 },
      { sequence: 15, stationCode: 'BPQ', stationName: 'Balharshah', arrTime: '17:45:00', depTime: '17:50:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 1718, distance_km: 1718 },
      { sequence: 16, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '21:10:00', depTime: '21:15:00', haltMinutes: '5', day_offset: 1, distanceFromOriginKm: 1926, distance_km: 1926 },
      { sequence: 17, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '03:45:00', depTime: '03:55:00', haltMinutes: '10', day_offset: 2, distanceFromOriginKm: 2316, distance_km: 2316 },
      { sequence: 18, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '07:45:00', depTime: '07:53:00', haltMinutes: '8', day_offset: 2, distanceFromOriginKm: 2608, distance_km: 2608 },
      { sequence: 19, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '09:00:00', depTime: '09:02:00', haltMinutes: '2', day_offset: 2, distanceFromOriginKm: 2705, distance_km: 2705 },
      { sequence: 20, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '10:35:00', depTime: '10:40:00', haltMinutes: '5', day_offset: 2, distanceFromOriginKm: 2823, distance_km: 2823 },
      { sequence: 21, stationCode: 'MTJ', stationName: 'Mathura Junction', arrTime: '11:23:00', depTime: '11:25:00', haltMinutes: '2', day_offset: 2, distanceFromOriginKm: 2877, distance_km: 2877 },
      { sequence: 22, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '12:50:00', depTime: '12:52:00', haltMinutes: '2', day_offset: 2, distanceFromOriginKm: 3011, distance_km: 3011 },
      { sequence: 23, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '13:15:00', depTime: '13:15:00', haltMinutes: '0', day_offset: 2, distanceFromOriginKm: 3018, distance_km: 3018 }
    ]
  }
];

let addedTrainCount = 0;
let updatedTrainCount = 0;

for (const tInfo of verifiedRealTrains) {
  const existingTrain = findTrainByNumber(tInfo.train_number);

  let trainId;
  if (existingTrain) {
    trainId = existingTrain.id;
    console.log(`ℹ️ Train #${tInfo.train_number} exists (${existingTrain.train.train_name}). Enriching route stops without deleting.`);
    
    // Update stops and details while strictly preserving ID, createdAt, and historical fields
    const mergedTrain = {
      ...existingTrain.train,
      train_number: tInfo.train_number,
      train_name: tInfo.train_name,
      train_type: tInfo.train_type,
      source_station_code: tInfo.source_station_code,
      destination_station_code: tInfo.destination_station_code,
      source: tInfo.source,
      destination: tInfo.destination,
      departure_time: tInfo.departure_time,
      arrival_time: tInfo.arrival_time,
      duration: tInfo.duration,
      duration_minutes: tInfo.duration_minutes,
      day_offset: tInfo.day_offset,
      distance_km: tInfo.distance_km,
      frequency: tInfo.frequency,
      running_days: tInfo.running_days,
      frequency_type: tInfo.frequency_type,
      operating_days: tInfo.operating_days,
      available_classes: tInfo.available_classes,
      food_available: tInfo.food_available,
      catering_payment_mode: tInfo.catering_payment_mode,
      food_type: tInfo.food_type,
      vegetarian_food_price: tInfo.vegetarian_food_price,
      non_vegetarian_food_price: tInfo.non_vegetarian_food_price,
      class_catering: tInfo.class_catering,
      stops: tInfo.stops,
      updated_at: new Date().toISOString()
    };
    trainsMap.set(trainId, mergedTrain);
    updatedTrainCount++;
  } else {
    trainId = `t-${tInfo.train_number}`;
    console.log(`✨ Adding new verified Real Indian Railways Train #${tInfo.train_number} (${tInfo.train_name})...`);
    
    const newTrain = {
      id: trainId,
      train_number: tInfo.train_number,
      train_name: tInfo.train_name,
      train_type: tInfo.train_type,
      source_station_code: tInfo.source_station_code,
      destination_station_code: tInfo.destination_station_code,
      source: tInfo.source,
      destination: tInfo.destination,
      source_station_name: tInfo.source_station_name,
      destination_station_name: tInfo.destination_station_name,
      departure_time: tInfo.departure_time,
      arrival_time: tInfo.arrival_time,
      duration: tInfo.duration,
      duration_minutes: tInfo.duration_minutes,
      day_offset: tInfo.day_offset,
      distance_km: tInfo.distance_km,
      frequency: tInfo.frequency,
      running_days: tInfo.running_days,
      frequency_type: tInfo.frequency_type,
      operating_days: tInfo.operating_days,
      available_classes: tInfo.available_classes,
      food_available: tInfo.food_available,
      catering_payment_mode: tInfo.catering_payment_mode,
      food_type: tInfo.food_type,
      vegetarian_food_price: tInfo.vegetarian_food_price,
      non_vegetarian_food_price: tInfo.non_vegetarian_food_price,
      class_catering: tInfo.class_catering,
      service_start_date: '2025-01-01',
      service_end_date: '2027-12-31',
      service_status: 'ACTIVE',
      status: 'on_time',
      delay_minutes: 0,
      record_source: 'system_real_ir',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stops: tInfo.stops
    };
    trainsMap.set(trainId, newTrain);
    addedTrainCount++;
  }

  // Ensure route object is in routesMap
  const existingRoute = findRouteByTrain(trainId, tInfo.train_number);
  const routeId = existingRoute ? existingRoute.id : `r-${tInfo.train_number}`;
  const routeObj = {
    id: routeId,
    train_id: trainId,
    train_number: tInfo.train_number,
    train_name: tInfo.train_name,
    source_station_code: tInfo.source_station_code,
    destination_station_code: tInfo.destination_station_code,
    departure_time: tInfo.departure_time,
    arrival_time: tInfo.arrival_time,
    duration: tInfo.duration,
    duration_minutes: tInfo.duration_minutes,
    distance_km: tInfo.distance_km,
    day_offset: tInfo.day_offset,
    frequency: tInfo.frequency,
    running_days: tInfo.running_days,
    frequency_type: tInfo.frequency_type,
    operating_days: tInfo.operating_days,
    fare_multiplier: 1.2,
    service_start_date: '2025-01-01',
    service_end_date: '2027-12-31',
    service_status: 'ACTIVE',
    status: 'Active',
    stops: tInfo.stops,
    created_at: existingRoute?.route?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  routesMap.set(routeId, routeObj);

  // Link route_id to train
  const tr = trainsMap.get(trainId);
  tr.route_id = routeId;
  trainsMap.set(trainId, tr);

  // Seed default seats for new train classes if not present
  for (const cls of tInfo.available_classes) {
    const seatPrefix = `seat-${trainId}-${cls}`;
    let hasSeat = false;
    for (const [sId, s] of seatsMap.entries()) {
      if (s && s.train_id === trainId && s.class_type === cls) {
        hasSeat = true;
        break;
      }
    }
    if (!hasSeat) {
      const totalSeats = cls === '1A' ? 24 : (cls === '2A' || cls === 'EC' ? 48 : (cls === '3A' || cls === 'CC' ? 64 : 72));
      for (let num = 1; num <= 10; num++) {
        const sKey = `${seatPrefix}-${num}`;
        seatsMap.set(sKey, {
          id: sKey,
          train_id: trainId,
          coach_number: `${cls}1`,
          seat_number: num,
          berth_type: num % 2 === 0 ? 'UB' : 'LB',
          class_type: cls,
          is_booked: false
        });
      }
    }
  }
}

// 3. Assemble and persist updated db
db.trains = Array.from(trainsMap.entries());
db.routes = Array.from(routesMap.entries());
db.seats = Array.from(seatsMap.entries());

fs.writeFileSync(dbPath, JSON.stringify(db), 'utf8');
console.log(`\n💾 [3/5] Database updated successfully in ${dbPath}`);

// 4. Read after counts and verify
const afterDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const afterCounts = {};
for (const k of Object.keys(afterDb)) {
  const val = afterDb[k];
  afterCounts[k] = Array.isArray(val) ? val.length : (typeof val === 'object' ? Object.keys(val).length : 1);
}

console.log('\n📊 [4/5] BEFORE vs AFTER Database Record Counts:');
console.log(`   Trains:          Before = ${beforeCounts.trains}  -->  After = ${afterCounts.trains} (+${afterCounts.trains - beforeCounts.trains})`);
console.log(`   Routes:          Before = ${beforeCounts.routes}  -->  After = ${afterCounts.routes} (+${afterCounts.routes - beforeCounts.routes})`);
console.log(`   Bookings:        Before = ${beforeCounts.bookings}  -->  After = ${afterCounts.bookings} (UNCHANGED: ${beforeCounts.bookings === afterCounts.bookings})`);
console.log(`   Profiles:        Before = ${beforeCounts.profiles}  -->  After = ${afterCounts.profiles} (UNCHANGED: ${beforeCounts.profiles === afterCounts.profiles})`);
console.log(`   Seats:           Before = ${beforeCounts.seats}  -->  After = ${afterCounts.seats} (+${afterCounts.seats - beforeCounts.seats})`);
console.log(`   Payments:        Before = ${beforeCounts.payments}  -->  After = ${afterCounts.payments} (UNCHANGED: ${beforeCounts.payments === afterCounts.payments})`);
console.log(`   Catering Orders: Before = ${beforeCounts.catering_orders}  -->  After = ${afterCounts.catering_orders} (UNCHANGED: ${beforeCounts.catering_orders === afterCounts.catering_orders})`);

// 5. Verification checks
console.log('\n🔍 [5/5] Verification of Target Real Trains:');
for (const num of ['12619', '12051', '12627', '12625', '12007']) {
  let found = null;
  for (const [id, t] of afterDb.trains) {
    if (t && String(t.train_number) === num) {
      found = t;
      break;
    }
  }
  if (found) {
    console.log(`   ✅ Train #${found.train_number} - "${found.train_name}" [${found.train_type}]`);
    console.log(`      Route: ${found.source} -> ${found.destination} | Dep: ${found.departure_time} | Arr: ${found.arrival_time} | Stops: ${found.stops?.length || 0}`);
    console.log(`      Stops Path: ${found.stops?.map(s => s.stationCode).join(' -> ')}`);
  } else {
    console.error(`   ❌ Missing Train #${num}`);
  }
}
