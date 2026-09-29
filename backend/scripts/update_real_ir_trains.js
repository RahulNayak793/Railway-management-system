const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: db.json not found at', dbPath);
  process.exit(1);
}

// 1. Create a timestamped backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `../data/db.json.bak.${timestamp}`);
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup created successfully at: ${backupPath}`);

// Read existing db.json
const rawData = fs.readFileSync(dbPath, 'utf8');
const db = JSON.parse(rawData);

const trainsEntries = db.trains || [];
const bookingsEntries = db.bookings || [];
const routesEntries = db.routes || [];
const seatsEntries = db.seats || [];

// Collect all train IDs referenced in bookings
const referencedTrainIds = new Set();
for (const [id, booking] of bookingsEntries) {
  if (booking && booking.train_id) {
    referencedTrainIds.add(booking.train_id);
  }
}
console.log(`🔍 Found ${referencedTrainIds.size} train IDs referenced across existing bookings.`);

// Map of referenced dummy trains to real IR details
const referencedTrainUpgrades = {
  't-co0fa2xs2': {
    train_number: '16595',
    train_name: 'Panchaganga Express',
    train_type: 'Express',
    source_station_code: 'SBC',
    destination_station_code: 'KAWR',
    source: 'SBC',
    destination: 'KAWR',
    available_classes: ['1A', '2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': false },
    stops: [
      { stationCode: 'SBC', arrTime: '18:50', depTime: '19:00', distance_km: 0 },
      { stationCode: 'YPR', arrTime: '19:10', depTime: '19:12', distance_km: 6 },
      { stationCode: 'UDU', arrTime: '04:18', depTime: '04:20', distance_km: 432 },
      { stationCode: 'NDLS', arrTime: '14:30', depTime: '14:35', distance_km: 2150 },
      { stationCode: 'KAWR', arrTime: '08:25', depTime: '08:25', distance_km: 654 }
    ]
  },
  't-kii9i4f2x': {
    train_number: '12954',
    train_name: 'August Kranti Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'MMCT',
    destination_station_code: 'NZM',
    source: 'MMCT',
    destination: 'NZM',
    available_classes: ['1A', '2A', '3A'],
    frequency: 'Daily',
    food_available: true,
    class_catering: { '1A': true, '2A': true, '3A': true },
    stops: [
      { stationCode: 'MMCT', arrTime: '17:10', depTime: '17:10', distance_km: 0 },
      { stationCode: 'ST', arrTime: '19:48', depTime: '19:53', distance_km: 263 },
      { stationCode: 'BRC', arrTime: '21:28', depTime: '21:38', distance_km: 393 },
      { stationCode: 'KOTA', arrTime: '04:05', depTime: '04:15', distance_km: 920 },
      { stationCode: 'NDLS', arrTime: '09:40', depTime: '09:45', distance_km: 1386 },
      { stationCode: 'NZM', arrTime: '10:05', depTime: '10:05', distance_km: 1379 }
    ]
  },
  't-f6llzt119': {
    train_number: '20646',
    train_name: 'Mangaluru Central - Madgaon Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'MAQ',
    destination_station_code: 'MAO',
    source: 'MAQ',
    destination: 'MAO',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Mon',
    food_available: true,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'MAQ', arrTime: '08:30', depTime: '08:30', distance_km: 0 },
      { stationCode: 'UDU', arrTime: '09:38', depTime: '09:40', distance_km: 62 },
      { stationCode: 'MMCT', arrTime: '19:30', depTime: '19:35', distance_km: 884 },
      { stationCode: 'MAO', arrTime: '13:15', depTime: '13:15', distance_km: 310 }
    ]
  },
  't-ldn34nqkb': {
    train_number: '20608',
    train_name: 'Mysuru - MGR Chennai Central Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'MYS',
    destination_station_code: 'MAS',
    source: 'MYS',
    destination: 'MAS',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Wed',
    food_available: true,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'MYS', arrTime: '06:00', depTime: '06:00', distance_km: 0 },
      { stationCode: 'UDU', arrTime: '08:15', depTime: '08:17', distance_km: 350 },
      { stationCode: 'BNC', arrTime: '07:45', depTime: '07:47', distance_km: 139 },
      { stationCode: 'SBC', arrTime: '07:55', depTime: '08:00', distance_km: 143 },
      { stationCode: 'MAS', arrTime: '12:25', depTime: '12:25', distance_km: 500 }
    ]
  },
  't-c56ljuwr0': {
    train_number: '20645',
    train_name: 'Madgaon - Mangaluru Central Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'MAO',
    destination_station_code: 'MAQ',
    source: 'MAO',
    destination: 'MAQ',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Mon',
    food_available: true,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'MAO', arrTime: '18:10', depTime: '18:10', distance_km: 0 },
      { stationCode: 'UDU', arrTime: '21:38', depTime: '21:40', distance_km: 248 },
      { stationCode: 'MMCT', arrTime: '23:15', depTime: '23:20', distance_km: 884 },
      { stationCode: 'MAQ', arrTime: '22:45', depTime: '22:45', distance_km: 310 }
    ]
  },
  't-9o36itk9w': {
    train_number: '20642',
    train_name: 'Coimbatore - KSR Bengaluru Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'CBE',
    destination_station_code: 'SBC',
    source: 'CBE',
    destination: 'SBC',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Thu',
    food_available: true,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'CBE', arrTime: '05:00', depTime: '05:00', distance_km: 0 },
      { stationCode: 'MAQ', arrTime: '07:30', depTime: '07:32', distance_km: 150 },
      { stationCode: 'BNC', arrTime: '11:13', depTime: '11:15', distance_km: 375 },
      { stationCode: 'SBC', arrTime: '11:30', depTime: '11:30', distance_km: 379 }
    ]
  },
  't-riluukz45': {
    train_number: '12432',
    train_name: 'Trivandrum Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'NZM',
    destination_station_code: 'TVC',
    source: 'NZM',
    destination: 'TVC',
    available_classes: ['1A', '2A', '3A'],
    frequency: 'Sun, Tue, Wed',
    food_available: true,
    class_catering: { '1A': true, '2A': true, '3A': true },
    stops: [
      { stationCode: 'NZM', arrTime: '06:16', depTime: '06:16', distance_km: 0 },
      { stationCode: 'NDLS', arrTime: '06:30', depTime: '06:35', distance_km: 7 },
      { stationCode: 'KOTA', arrTime: '10:40', depTime: '10:50', distance_km: 458 },
      { stationCode: 'BRC', arrTime: '17:27', depTime: '17:37', distance_km: 986 },
      { stationCode: 'MMCT', arrTime: '21:40', depTime: '21:45', distance_km: 1379 },
      { stationCode: 'MAO', arrTime: '07:00', depTime: '07:10', distance_km: 1916 },
      { stationCode: 'ERS', arrTime: '18:50', depTime: '18:55', distance_km: 2636 },
      { stationCode: 'TVC', arrTime: '23:35', depTime: '23:35', distance_km: 2848 }
    ]
  },
  't-12952': {
    train_number: '12952',
    train_name: 'Mumbai Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    source: 'NDLS',
    destination: 'MMCT',
    available_classes: ['1A', '2A', '3A', '3E'],
    frequency: 'Daily',
    food_available: true,
    class_catering: { '1A': true, '2A': true, '3A': true, '3E': true },
    stops: [
      { stationCode: 'NDLS', arrTime: '16:55', depTime: '16:55', distance_km: 0 },
      { stationCode: 'KOTA', arrTime: '21:30', depTime: '21:40', distance_km: 466 },
      { stationCode: 'RTM', arrTime: '00:35', depTime: '00:40', distance_km: 733 },
      { stationCode: 'BRC', arrTime: '03:40', depTime: '03:50', distance_km: 993 },
      { stationCode: 'ST', arrTime: '05:10', depTime: '05:15', distance_km: 1123 },
      { stationCode: 'MMCT', arrTime: '08:35', depTime: '08:35', distance_km: 1386 }
    ]
  }
};

// Comprehensive list of new real Indian Railways trains
const newRealTrains = [
  {
    id: 't-12951',
    train_number: '12951',
    train_name: 'Mumbai Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'MMCT',
    destination_station_code: 'NDLS',
    source: 'MMCT',
    destination: 'NDLS',
    available_classes: ['1A', '2A', '3A', '3E'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 250,
    non_vegetarian_food_price: 280,
    class_catering: { '1A': true, '2A': true, '3A': true, '3E': true },
    stops: [
      { stationCode: 'MMCT', arrTime: '17:00', depTime: '17:00', distance_km: 0 },
      { stationCode: 'ST', arrTime: '19:38', depTime: '19:43', distance_km: 263 },
      { stationCode: 'BRC', arrTime: '21:18', depTime: '21:28', distance_km: 393 },
      { stationCode: 'RTM', arrTime: '00:25', depTime: '00:30', distance_km: 653 },
      { stationCode: 'KOTA', arrTime: '03:15', depTime: '03:25', distance_km: 920 },
      { stationCode: 'NDLS', arrTime: '08:32', depTime: '08:32', distance_km: 1386 }
    ]
  },
  {
    id: 't-12001',
    train_number: '12001',
    train_name: 'Bhopal Shatabdi Express',
    train_type: 'Shatabdi',
    source_station_code: 'BPL',
    destination_station_code: 'NDLS',
    source: 'BPL',
    destination: 'NDLS',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 180,
    non_vegetarian_food_price: 210,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'BPL', arrTime: '15:15', depTime: '15:15', distance_km: 0 },
      { stationCode: 'VGLJ', arrTime: '18:40', depTime: '18:45', distance_km: 292 },
      { stationCode: 'GWL', arrTime: '19:40', depTime: '19:45', distance_km: 389 },
      { stationCode: 'AGC', arrTime: '21:10', depTime: '21:15', distance_km: 507 },
      { stationCode: 'NDLS', arrTime: '23:30', depTime: '23:30', distance_km: 708 }
    ]
  },
  {
    id: 't-12002',
    train_number: '12002',
    train_name: 'Bhopal Shatabdi Express',
    train_type: 'Shatabdi',
    source_station_code: 'NDLS',
    destination_station_code: 'BPL',
    source: 'NDLS',
    destination: 'BPL',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 180,
    non_vegetarian_food_price: 210,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'NDLS', arrTime: '06:00', depTime: '06:00', distance_km: 0 },
      { stationCode: 'AGC', arrTime: '07:50', depTime: '07:55', distance_km: 201 },
      { stationCode: 'GWL', arrTime: '09:23', depTime: '09:28', distance_km: 319 },
      { stationCode: 'VGLJ', arrTime: '10:45', depTime: '10:50', distance_km: 416 },
      { stationCode: 'BPL', arrTime: '14:10', depTime: '14:10', distance_km: 708 }
    ]
  },
  {
    id: 't-22436',
    train_number: '22436',
    train_name: 'Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'NDLS',
    destination_station_code: 'BSB',
    source: 'NDLS',
    destination: 'BSB',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Wed',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 220,
    non_vegetarian_food_price: 250,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'NDLS', arrTime: '06:00', depTime: '06:00', distance_km: 0 },
      { stationCode: 'CNB', arrTime: '10:08', depTime: '10:10', distance_km: 440 },
      { stationCode: 'PRYJ', arrTime: '12:08', depTime: '12:10', distance_km: 634 },
      { stationCode: 'BSB', arrTime: '14:00', depTime: '14:00', distance_km: 757 }
    ]
  },
  {
    id: 't-22435',
    train_number: '22435',
    train_name: 'Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'BSB',
    destination_station_code: 'NDLS',
    source: 'BSB',
    destination: 'NDLS',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Wed',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 220,
    non_vegetarian_food_price: 250,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'BSB', arrTime: '15:00', depTime: '15:00', distance_km: 0 },
      { stationCode: 'PRYJ', arrTime: '16:30', depTime: '16:32', distance_km: 123 },
      { stationCode: 'CNB', arrTime: '18:30', depTime: '18:32', distance_km: 317 },
      { stationCode: 'NDLS', arrTime: '23:00', depTime: '23:00', distance_km: 757 }
    ]
  },
  {
    id: 't-12301',
    train_number: '12301',
    train_name: 'Howrah Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'HWH',
    destination_station_code: 'NDLS',
    source: 'HWH',
    destination: 'NDLS',
    available_classes: ['1A', '2A', '3A'],
    frequency: 'Daily except Sun',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 240,
    non_vegetarian_food_price: 270,
    class_catering: { '1A': true, '2A': true, '3A': true },
    stops: [
      { stationCode: 'HWH', arrTime: '16:50', depTime: '16:50', distance_km: 0 },
      { stationCode: 'ASN', arrTime: '18:57', depTime: '18:59', distance_km: 200 },
      { stationCode: 'DHN', arrTime: '19:55', depTime: '20:00', distance_km: 259 },
      { stationCode: 'GAYA', arrTime: '22:31', depTime: '22:34', distance_km: 459 },
      { stationCode: 'DDU', arrTime: '00:45', depTime: '00:55', distance_km: 664 },
      { stationCode: 'PRYJ', arrTime: '02:43', depTime: '02:45', distance_km: 817 },
      { stationCode: 'CNB', arrTime: '04:50', depTime: '04:55', distance_km: 1011 },
      { stationCode: 'NDLS', arrTime: '10:05', depTime: '10:05', distance_km: 1447 }
    ]
  },
  {
    id: 't-12050',
    train_number: '12050',
    train_name: 'Gatimaan Express',
    train_type: 'Superfast',
    source_station_code: 'NZM',
    destination_station_code: 'AGC',
    source: 'NZM',
    destination: 'AGC',
    available_classes: ['EC', 'CC'],
    frequency: 'Daily except Fri',
    food_available: true,
    catering_payment_mode: 'INCLUDED_IN_TICKET',
    food_type: 'BOTH',
    vegetarian_food_price: 150,
    non_vegetarian_food_price: 180,
    class_catering: { 'EC': true, 'CC': true },
    stops: [
      { stationCode: 'NZM', arrTime: '08:10', depTime: '08:10', distance_km: 0 },
      { stationCode: 'AGC', arrTime: '09:50', depTime: '09:50', distance_km: 188 }
    ]
  },
  {
    id: 't-12625',
    train_number: '12625',
    train_name: 'Kerala Express',
    train_type: 'Superfast',
    source_station_code: 'TVC',
    destination_station_code: 'NDLS',
    source: 'TVC',
    destination: 'NDLS',
    available_classes: ['1A', '2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 120,
    non_vegetarian_food_price: 140,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    stops: [
      { stationCode: 'TVC', arrTime: '12:30', depTime: '12:30', distance_km: 0 },
      { stationCode: 'QLN', arrTime: '13:30', depTime: '13:33', distance_km: 65 },
      { stationCode: 'ERS', arrTime: '16:20', depTime: '16:25', distance_km: 220 },
      { stationCode: 'TCR', arrTime: '17:42', depTime: '17:45', distance_km: 294 },
      { stationCode: 'CBE', arrTime: '20:57', depTime: '21:00', distance_km: 427 },
      { stationCode: 'ED', arrTime: '22:30', depTime: '22:35', distance_km: 528 },
      { stationCode: 'BZA', arrTime: '10:30', depTime: '10:45', distance_km: 1300 },
      { stationCode: 'NGP', arrTime: '21:10', depTime: '21:15', distance_km: 1935 },
      { stationCode: 'BPL', arrTime: '03:45', depTime: '03:55', distance_km: 2325 },
      { stationCode: 'AGC', arrTime: '10:10', depTime: '10:15', distance_km: 2836 },
      { stationCode: 'NDLS', arrTime: '13:15', depTime: '13:15', distance_km: 3031 }
    ]
  },
  {
    id: 't-12137',
    train_number: '12137',
    train_name: 'Punjab Mail',
    train_type: 'Superfast',
    source_station_code: 'CSMT',
    destination_station_code: 'ASR',
    source: 'CSMT',
    destination: 'ASR',
    available_classes: ['1A', '2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 110,
    non_vegetarian_food_price: 130,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    stops: [
      { stationCode: 'CSMT', arrTime: '19:35', depTime: '19:35', distance_km: 0 },
      { stationCode: 'KYN', arrTime: '20:32', depTime: '20:35', distance_km: 54 },
      { stationCode: 'NK', arrTime: '23:10', depTime: '23:15', distance_km: 186 },
      { stationCode: 'BSL', arrTime: '02:50', depTime: '02:55', distance_km: 443 },
      { stationCode: 'ET', arrTime: '07:45', depTime: '07:55', distance_km: 750 },
      { stationCode: 'BPL', arrTime: '09:40', depTime: '09:45', distance_km: 842 },
      { stationCode: 'VGLJ', arrTime: '14:05', depTime: '14:15', distance_km: 1134 },
      { stationCode: 'GWL', arrTime: '15:30', depTime: '15:35', distance_km: 1231 },
      { stationCode: 'AGC', arrTime: '17:50', depTime: '17:55', distance_km: 1349 },
      { stationCode: 'NDLS', arrTime: me => '21:30', depTime: '21:40', distance_km: 1550 },
      { stationCode: 'LDH', arrTime: '02:25', depTime: '02:35', distance_km: 1860 },
      { stationCode: 'ASR', arrTime: '05:10', depTime: '05:10', distance_km: 1927 }
    ]
  },
  {
    id: 't-12639',
    train_number: '12639',
    train_name: 'Brindavan Express',
    train_type: 'Superfast',
    source_station_code: 'MAS',
    destination_station_code: 'SBC',
    source: 'MAS',
    destination: 'SBC',
    available_classes: ['CC', '2S'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 90,
    non_vegetarian_food_price: 110,
    class_catering: { 'CC': true, '2S': false },
    stops: [
      { stationCode: 'MAS', arrTime: '07:40', depTime: '07:40', distance_km: 0 },
      { stationCode: 'BNC', arrTime: '13:08', depTime: '13:10', distance_km: 355 },
      { stationCode: 'SBC', arrTime: '13:40', depTime: '13:40', distance_km: 359 }
    ]
  },
  {
    id: 't-12640',
    train_number: '12640',
    train_name: 'Brindavan Express',
    train_type: 'Superfast',
    source_station_code: 'SBC',
    destination_station_code: 'MAS',
    source: 'SBC',
    destination: 'MAS',
    available_classes: ['CC', '2S'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 90,
    non_vegetarian_food_price: 110,
    class_catering: { 'CC': true, '2S': false },
    stops: [
      { stationCode: 'SBC', arrTime: '15:10', depTime: '15:10', distance_km: 0 },
      { stationCode: 'BNC', arrTime: '15:20', depTime: '15:22', distance_km: 4 },
      { stationCode: 'MAS', arrTime: '21:10', depTime: '21:10', distance_km: 359 }
    ]
  },
  {
    id: 't-12723',
    train_number: '12723',
    train_name: 'Telangana Express',
    train_type: 'Superfast',
    source_station_code: 'HYB',
    destination_station_code: 'NDLS',
    source: 'HYB',
    destination: 'NDLS',
    available_classes: ['1A', '2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 120,
    non_vegetarian_food_price: 140,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    stops: [
      { stationCode: 'HYB', arrTime: '06:00', depTime: '06:00', distance_km: 0 },
      { stationCode: 'SC', arrTime: '06:20', depTime: '06:25', distance_km: 10 },
      { stationCode: 'KZJ', arrTime: '08:03', depTime: '08:05', distance_km: 142 },
      { stationCode: 'NGP', arrTime: '15:20', depTime: '15:25', distance_km: 584 },
      { stationCode: 'BPL', arrTime: me => '21:45', depTime: '21:55', distance_km: 974 },
      { stationCode: 'VGLJ', arrTime: '01:45', depTime: '01:53', distance_km: 1266 },
      { stationCode: 'AGC', arrTime: '04:38', depTime: '04:40', distance_km: 1481 },
      { stationCode: 'NDLS', arrTime: '07:40', depTime: '07:40', distance_km: 1677 }
    ]
  },
  {
    id: 't-12295',
    train_number: '12295',
    train_name: 'Sanghamitra Express',
    train_type: 'Superfast',
    source_station_code: 'SBC',
    destination_station_code: 'DNR',
    source: 'SBC',
    destination: 'DNR',
    available_classes: ['1A', '2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 120,
    non_vegetarian_food_price: 140,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    stops: [
      { stationCode: 'SBC', arrTime: '09:00', depTime: '09:00', distance_km: 0 },
      { stationCode: 'MAS', arrTime: '15:40', depTime: '16:05', distance_km: 359 },
      { stationCode: 'BZA', arrTime: '22:30', depTime: '22:40', distance_km: 790 },
      { stationCode: 'NGP', arrTime: '08:35', depTime: '08:40', distance_km: 1455 },
      { stationCode: 'ET', arrTime: '13:40', depTime: '13:50', distance_km: 1753 },
      { stationCode: 'JBP', arrTime: '17:10', depTime: '17:20', distance_km: 1998 },
      { stationCode: 'DDU', arrTime: '01:30', depTime: '01:40', distance_km: 2400 },
      { stationCode: 'DNR', arrTime: '07:40', depTime: '07:40', distance_km: 2595 }
    ]
  },
  {
    id: 't-12801',
    train_number: '12801',
    train_name: 'Purushottam Express',
    train_type: 'Superfast',
    source_station_code: 'PURI',
    destination_station_code: 'NDLS',
    source: 'PURI',
    destination: 'NDLS',
    available_classes: ['1A', '2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 110,
    non_vegetarian_food_price: 130,
    class_catering: { '1A': true, '2A': true, '3A': true, 'SL': true },
    stops: [
      { stationCode: 'PURI', arrTime: '21:55', depTime: '21:55', distance_km: 0 },
      { stationCode: 'BBS', arrTime: '22:50', depTime: '22:55', distance_km: 63 },
      { stationCode: 'CTC', arrTime: '23:30', depTime: '23:35', distance_km: 91 },
      { stationCode: 'KGP', arrTime: '03:40', depTime: '03:45', distance_km: 414 },
      { stationCode: 'TATA', arrTime: '06:15', depTime: '06:25', distance_km: 548 },
      { stationCode: 'BKSC', arrTime: '09:20', depTime: '09:25', distance_km: 663 },
      { stationCode: 'GAYA', arrTime: '13:40', depTime: '13:45', distance_km: 864 },
      { stationCode: 'DDU', arrTime: '16:50', depTime: '17:00', distance_km: 1069 },
      { stationCode: 'PRYJ', arrTime: '19:20', depTime: '19:30', distance_km: 1221 },
      { stationCode: 'CNB', arrTime: '21:55', depTime: '22:00', distance_km: 1415 },
      { stationCode: 'NDLS', arrTime: '04:00', depTime: '04:00', distance_km: 1867 }
    ]
  },
  {
    id: 't-12619',
    train_number: '12619',
    train_name: 'Matsyagandha Express',
    train_type: 'Superfast',
    source_station_code: 'LTT',
    destination_station_code: 'MAQ',
    source: 'LTT',
    destination: 'MAQ',
    available_classes: ['2A', '3A', 'SL'],
    frequency: 'Daily',
    food_available: true,
    catering_payment_mode: 'PAID_ON_BOARD',
    food_type: 'BOTH',
    vegetarian_food_price: 100,
    non_vegetarian_food_price: 120,
    class_catering: { '2A': true, '3A': true, 'SL': true },
    stops: [
      { stationCode: 'LTT', arrTime: '15:20', depTime: '15:20', distance_km: 0 },
      { stationCode: 'KYN', arrTime: '16:02', depTime: '16:05', distance_km: 35 },
      { stationCode: 'MAO', arrTime: '01:05', depTime: '01:15', distance_km: 574 },
      { stationCode: 'UDU', arrTime: '05:42', depTime: '05:44', distance_km: 822 },
      { stationCode: 'MAQ', arrTime: '07:40', depTime: '07:40', distance_km: 884 }
    ]
  }
];

// Re-build trains Map
const updatedTrainsMap = new Map();

// 1. Process existing trains
for (const [id, train] of trainsEntries) {
  if (referencedTrainIds.has(id)) {
    // Upgrade referenced train details to real IR train
    const upgrade = referencedTrainUpgrades[id];
    if (upgrade) {
      const updatedTrain = {
        ...train,
        train_number: upgrade.train_number,
        train_name: upgrade.train_name,
        train_type: upgrade.train_type,
        source_station_code: upgrade.source_station_code,
        destination_station_code: upgrade.destination_station_code,
        source: upgrade.source,
        destination: upgrade.destination,
        available_classes: upgrade.available_classes,
        frequency: upgrade.frequency,
        food_available: upgrade.food_available,
        class_catering: upgrade.class_catering,
        status: train.status || 'on_time',
        delay_minutes: train.delay_minutes || 0,
        updated_at: new Date().toISOString()
      };
      updatedTrainsMap.set(id, updatedTrain);
      console.log(`✅ Upgraded referenced train ID [${id}] -> ${updatedTrain.train_number} (${updatedTrain.train_name})`);
    } else {
      // Keep existing referenced train safely
      updatedTrainsMap.set(id, train);
      console.log(`ℹ️ Preserved referenced train ID [${id}] (${train.train_number} - ${train.train_name})`);
    }
  } else {
    console.log(`🗑️ Removed unreferenced dummy train ID [${id}] (${train.train_number} - ${train.train_name})`);
  }
}

// 2. Add new real IR trains if not already in map
newRealTrains.forEach(nt => {
  if (!updatedTrainsMap.has(nt.id)) {
    updatedTrainsMap.set(nt.id, {
      ...nt,
      status: 'on_time',
      delay_minutes: 0,
      record_source: 'system_real_ir',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log(`✨ Added real IR train [${nt.train_number}] - ${nt.train_name}`);
  }
});

// Re-build routes Map
const updatedRoutesMap = new Map();

// For each train in updatedTrainsMap, ensure a valid route object exists
for (const [tId, train] of updatedTrainsMap.entries()) {
  const upgradeData = referencedTrainUpgrades[tId] || newRealTrains.find(t => t.id === tId);
  const stops = upgradeData && upgradeData.stops ? upgradeData.stops : [
    { stationCode: train.source_station_code || train.source || 'NDLS', arrTime: '08:00', depTime: '08:00', distance_km: 0 },
    { stationCode: train.destination_station_code || train.destination || 'MMCT', arrTime: '18:00', depTime: '18:00', distance_km: 500 }
  ];

  const routeId = `r-${tId}`;
  const routeObj = {
    id: routeId,
    train_id: tId,
    train_number: train.train_number,
    source_station_code: train.source_station_code || train.source,
    destination_station_code: train.destination_station_code || train.destination,
    departure_time: stops[0]?.depTime ? `${stops[0].depTime}:00` : '08:00:00',
    arrival_time: stops[stops.length - 1]?.arrTime ? `${stops[stops.length - 1].arrTime}:00` : '18:00:00',
    distance_km: stops[stops.length - 1]?.distance_km || 500,
    fare_multiplier: train.train_type === 'Rajdhani' || train.train_type === 'Vande Bharat' ? 1.6 : 1.2,
    frequency: train.frequency || 'Daily',
    stops: stops.map((s, idx) => ({
      stop_number: idx + 1,
      stationCode: s.stationCode,
      station_name: s.stationCode,
      arrTime: s.arrTime,
      depTime: s.depTime,
      arrival_time: `${s.arrTime}:00`,
      departure_time: `${s.depTime}:00`,
      distance_km: s.distance_km || idx * 100
    }))
  };

  updatedRoutesMap.set(routeId, routeObj);
}

// Re-build seats Map for all updated trains
const updatedSeatsMap = new Map();

for (const [tId, train] of updatedTrainsMap.entries()) {
  const classes = Array.isArray(train.available_classes) && train.available_classes.length > 0 
    ? train.available_classes 
    : ['SL', '3A', '2A', '1A'];

  classes.forEach(cls => {
    const coachPrefix = cls === '1A' ? 'H' : cls === '2A' ? 'A' : cls === '3A' ? 'B' : cls === '3E' ? 'M' : cls === 'EC' ? 'E' : cls === 'CC' ? 'C' : 'S';
    for (let c = 1; c <= 2; c++) {
      const coachNum = `${coachPrefix}${c}`;
      for (let i = 1; i <= 24; i++) {
        const berthType = i % 6 === 1 || i % 6 === 2 ? 'LB' : i % 6 === 3 || i % 6 === 4 ? 'MB' : 'UB';
        const sId = `${tId}-${coachNum}-${i}`;
        updatedSeatsMap.set(sId, {
          id: sId,
          train_id: tId,
          coach_class: cls,
          coach_number: coachNum,
          seat_number: i,
          berth_type: berthType
        });
      }
    }
  });
}

// Preserve existing seats if referenced or still valid
for (const [sId, seat] of seatsEntries) {
  if (seat && updatedTrainsMap.has(seat.train_id)) {
    updatedSeatsMap.set(sId, seat);
  }
}

// Save updated collections into db object
db.trains = Array.from(updatedTrainsMap.entries());
db.routes = Array.from(updatedRoutesMap.entries());
db.seats = Array.from(updatedSeatsMap.entries());

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

console.log('\n==================================================');
console.log(`🎉 SUCCESS! Database updated with Real Indian Railways Trains.`);
console.log(`🚆 Total Trains: ${updatedTrainsMap.size}`);
console.log(`🗺️ Total Routes: ${updatedRoutesMap.size}`);
console.log(`💺 Total Seats: ${updatedSeatsMap.size}`);
console.log(`🎫 Bookings intact: ${bookingsEntries.length}`);
console.log('==================================================\n');
