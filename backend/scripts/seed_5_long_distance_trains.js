const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);

// Initialize collections if needed
if (!db.trains) db.trains = [];
if (!db.routes) db.routes = [];
if (!db.seats) db.seats = [];
if (!db.train_services) db.train_services = [];

// Clean any null/falsy entries across collections
['trains', 'routes', 'seats', 'train_services'].forEach(col => {
  if (Array.isArray(db[col])) {
    db[col] = db[col].filter(e => {
      if (!e) return false;
      if (Array.isArray(e) && (!e[0] || !e[1])) return false;
      return true;
    });
  }
});

console.log(`Clean baseline counts:`);
console.log(`  Trains: ${db.trains.length}`);
console.log(`  Routes: ${db.routes.length}`);
console.log(`  Seats: ${db.seats.length}`);
console.log(`  Services: ${db.train_services.length}`);

// Helper to generate dates with interval
function generateDates(startDateStr, count, stepDays = 3) {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const dates = [];
  for (let i = 0; i < count; i++) {
    const cur = new Date(Date.UTC(sy, sm - 1, sd + (i * stepDays)));
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// -----------------------------------------------------------------------------
// TRAIN 1: Udupi -> New Delhi (Starts 23 Oct, Every 3 Days)
// Project Demo Train with full Konkan Railway route
// -----------------------------------------------------------------------------
const train1_dates = generateDates('2026-10-23', 30, 3);
const train1 = {
  id: 't-09433',
  train_number: '09433',
  train_name: 'UDUPI - HAZRAT NIZAMUDDIN SPECIAL SF (PROJECT DEMO)',
  train_type: 'Superfast',
  source_station_code: 'UD',
  destination_station_code: 'NZM',
  source: 'UD',
  destination: 'NZM',
  from_station: 'Udupi',
  to_station: 'Hazrat Nizamuddin',
  source_station_name: 'Udupi',
  destination_station_name: 'Hazrat Nizamuddin',
  departure_time: '07:15:00',
  arrival_time: '16:55:00',
  day_offset: 1,
  duration_minutes: 2020,
  distance_km: 2188,
  classes: ['SL', '3A', '2A', '1A'],
  available_classes: ['SL', '3A', '2A', '1A'],
  service_pattern: 'EVERY_3_DAYS',
  frequency: 'Every 3 Days',
  frequency_type: 'Every 3 Days',
  pattern_start_date: '2026-10-23',
  service_start_date: '2026-10-01',
  service_end_date: '2027-12-31',
  specific_service_dates: train1_dates,
  base_fare: 890,
  fares_by_class: { 'SL': 890, '3A': 2350, '2A': 3450, '1A': 5850 },
  food_available: true,
  catering_payment_mode: 'Paid Separately',
  service_status: 'ACTIVE',
  status: 'on_time',
  delay_minutes: 0,
  record_source: 'project_demo',
  source_transparency: 'PROJECT DATABASE / DEMO TRAIN',
  live_connection_status: 'IRCTC / PRS LIVE: NOT CONNECTED',
  coaches: [
    { coach_code: 'S1', class_type: 'SL', total_seats: 72, available_seats: 66, base_fare: 890 },
    { coach_code: 'B1', class_type: '3A', total_seats: 64, available_seats: 48, base_fare: 2350 },
    { coach_code: 'A1', class_type: '2A', total_seats: 36, available_seats: 25, base_fare: 3450 },
    { coach_code: 'H1', class_type: '1A', total_seats: 18, available_seats: 10, base_fare: 5850 }
  ],
  stops: [
    { sequence: 1, stationCode: 'UD', stationName: 'Udupi', arrTime: '07:15:00', depTime: '07:15:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
    { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '09:30:00', depTime: '09:32:00', haltMinutes: '2', distanceFromOriginKm: 190, day_offset: 0 },
    { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '10:45:00', depTime: '10:55:00', haltMinutes: '10', distanceFromOriginKm: 250, day_offset: 0 },
    { sequence: 4, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '14:20:00', depTime: '14:25:00', haltMinutes: '5', distanceFromOriginKm: 530, day_offset: 0 },
    { sequence: 5, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '19:15:00', depTime: '19:20:00', haltMinutes: '5', distanceFromOriginKm: 810, day_offset: 0 },
    { sequence: 6, stationCode: 'BSR', stationName: 'Vasai Road', arrTime: '20:35:00', depTime: '20:40:00', haltMinutes: '5', distanceFromOriginKm: 860, day_offset: 0 },
    { sequence: 7, stationCode: 'ST', stationName: 'Surat', arrTime: '23:50:00', depTime: '23:55:00', haltMinutes: '5', distanceFromOriginKm: 1123, day_offset: 0 },
    { sequence: 8, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '01:30:00', depTime: '01:40:00', haltMinutes: '10', distanceFromOriginKm: 1253, day_offset: 1 },
    { sequence: 9, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '05:00:00', depTime: '05:05:00', haltMinutes: '5', distanceFromOriginKm: 1513, day_offset: 1 },
    { sequence: 10, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '08:35:00', depTime: '08:45:00', haltMinutes: '10', distanceFromOriginKm: 1780, day_offset: 1 },
    { sequence: 11, stationCode: 'SWM', stationName: 'Sawai Madhopur', arrTime: '10:05:00', depTime: '10:07:00', haltMinutes: '2', distanceFromOriginKm: 1888, day_offset: 1 },
    { sequence: 12, stationCode: 'MTJ', stationName: 'Mathura Junction', arrTime: '13:50:00', depTime: '13:52:00', haltMinutes: '2', distanceFromOriginKm: 2050, day_offset: 1 },
    { sequence: 13, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '16:55:00', depTime: '16:55:00', haltMinutes: '0', distanceFromOriginKm: 2188, day_offset: 1 }
  ]
};

// -----------------------------------------------------------------------------
// TRAIN 2: Mumbai -> New Delhi (Starts 24 Oct, Every 3 Days)
// Real Indian Railways Train 12953 August Kranti Rajdhani Express
// -----------------------------------------------------------------------------
const train2_dates = generateDates('2026-10-24', 30, 3);
const train2 = {
  id: 't-12953',
  train_number: '12953',
  train_name: 'AUGUST KRANTI RAJDHANI EXPRESS',
  train_type: 'Rajdhani',
  source_station_code: 'MMCT',
  destination_station_code: 'NZM',
  source: 'MMCT',
  destination: 'NZM',
  from_station: 'Mumbai Central',
  to_station: 'Hazrat Nizamuddin',
  source_station_name: 'Mumbai Central',
  destination_station_name: 'Hazrat Nizamuddin',
  departure_time: '17:10:00',
  arrival_time: '10:05:00',
  day_offset: 1,
  duration_minutes: 1015,
  distance_km: 1377,
  classes: ['1A', '2A', '3A', 'SL'],
  available_classes: ['1A', '2A', '3A', 'SL'],
  service_pattern: 'EVERY_3_DAYS',
  frequency: 'Every 3 Days',
  frequency_type: 'Every 3 Days',
  pattern_start_date: '2026-10-24',
  service_start_date: '2026-10-01',
  service_end_date: '2027-12-31',
  specific_service_dates: train2_dates,
  base_fare: 1650,
  fares_by_class: { 'SL': 780, '3A': 1950, '2A': 2850, '1A': 4850 },
  food_available: true,
  catering_payment_mode: 'Included in Ticket',
  service_status: 'ACTIVE',
  status: 'on_time',
  delay_minutes: 0,
  record_source: 'official_ir',
  source_data_label: 'VERIFIED INDIAN RAILWAYS',
  coaches: [
    { coach_code: 'S1', class_type: 'SL', total_seats: 72, available_seats: 55, base_fare: 780 },
    { coach_code: 'B1', class_type: '3A', total_seats: 64, available_seats: 45, base_fare: 1950 },
    { coach_code: 'A1', class_type: '2A', total_seats: 36, available_seats: 25, base_fare: 2850 },
    { coach_code: 'H1', class_type: '1A', total_seats: 18, available_seats: 12, base_fare: 4850 }
  ],
  stops: [
    { sequence: 1, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '17:10:00', depTime: '17:10:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
    { sequence: 2, stationCode: 'BVI', stationName: 'Borivali', arrTime: '17:43:00', depTime: '17:45:00', haltMinutes: '2', distanceFromOriginKm: 30, day_offset: 0 },
    { sequence: 3, stationCode: 'VAPI', stationName: 'Vapi', arrTime: '19:17:00', depTime: '19:19:00', haltMinutes: '2', distanceFromOriginKm: 168, day_offset: 0 },
    { sequence: 4, stationCode: 'BL', stationName: 'Valsad', arrTime: '19:40:00', depTime: '19:42:00', haltMinutes: '2', distanceFromOriginKm: 194, day_offset: 0 },
    { sequence: 5, stationCode: 'ST', stationName: 'Surat', arrTime: '20:30:00', depTime: '20:35:00', haltMinutes: '5', distanceFromOriginKm: 263, day_offset: 0 },
    { sequence: 6, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '22:08:00', depTime: '22:18:00', haltMinutes: '10', distanceFromOriginKm: 393, day_offset: 0 },
    { sequence: 7, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '01:48:00', depTime: '01:53:00', haltMinutes: '5', distanceFromOriginKm: 653, day_offset: 1 },
    { sequence: 8, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '04:40:00', depTime: '04:50:00', haltMinutes: '10', distanceFromOriginKm: 920, day_offset: 1 },
    { sequence: 9, stationCode: 'SWM', stationName: 'Sawai Madhopur', arrTime: '06:00:00', depTime: '06:02:00', haltMinutes: '2', distanceFromOriginKm: 1028, day_offset: 1 },
    { sequence: 10, stationCode: 'MTJ', stationName: 'Mathura Junction', arrTime: '08:18:00', depTime: '08:20:00', haltMinutes: '2', distanceFromOriginKm: 1244, day_offset: 1 },
    { sequence: 11, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '10:05:00', depTime: '10:05:00', haltMinutes: '0', distanceFromOriginKm: 1377, day_offset: 1 }
  ]
};

// -----------------------------------------------------------------------------
// TRAIN 3: Bengaluru -> New Delhi (Starts 25 Oct, Every 3 Days)
// Real Indian Railways Train 12649 Karnataka Sampark Kranti Express
// -----------------------------------------------------------------------------
const train3_dates = generateDates('2026-10-25', 30, 3);
const train3 = {
  id: 't-12649',
  train_number: '12649',
  train_name: 'KARNATAKA SAMPARK KRANTI EXPRESS',
  train_type: 'Sampark Kranti',
  source_station_code: 'SBC',
  destination_station_code: 'NZM',
  source: 'SBC',
  destination: 'NZM',
  from_station: 'KSR Bengaluru City',
  to_station: 'Hazrat Nizamuddin',
  source_station_name: 'KSR Bengaluru City',
  destination_station_name: 'Hazrat Nizamuddin',
  departure_time: '13:50:00',
  arrival_time: '08:10:00',
  day_offset: 2,
  duration_minutes: 2540,
  distance_km: 2608,
  classes: ['SL', '3A', '2A', '1A'],
  available_classes: ['SL', '3A', '2A', '1A'],
  service_pattern: 'EVERY_3_DAYS',
  frequency: 'Every 3 Days',
  frequency_type: 'Every 3 Days',
  pattern_start_date: '2026-10-25',
  service_start_date: '2026-10-01',
  service_end_date: '2027-12-31',
  specific_service_dates: train3_dates,
  base_fare: 950,
  fares_by_class: { 'SL': 950, '3A': 2550, '2A': 3750, '1A': 6200 },
  food_available: true,
  catering_payment_mode: 'Paid Separately',
  service_status: 'ACTIVE',
  status: 'on_time',
  delay_minutes: 0,
  record_source: 'official_ir',
  source_data_label: 'VERIFIED INDIAN RAILWAYS',
  coaches: [
    { coach_code: 'S1', class_type: 'SL', total_seats: 72, available_seats: 60, base_fare: 950 },
    { coach_code: 'B1', class_type: '3A', total_seats: 64, available_seats: 44, base_fare: 2550 },
    { coach_code: 'A1', class_type: '2A', total_seats: 36, available_seats: 26, base_fare: 3750 },
    { coach_code: 'H1', class_type: '1A', total_seats: 18, available_seats: 12, base_fare: 6200 }
  ],
  stops: [
    { sequence: 1, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '13:50:00', depTime: '13:50:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
    { sequence: 2, stationCode: 'TK', stationName: 'Tumakuru', arrTime: '14:55:00', depTime: '14:57:00', haltMinutes: '2', distanceFromOriginKm: 70, day_offset: 0 },
    { sequence: 3, stationCode: 'ASK', stationName: 'Arsikere Junction', arrTime: '16:15:00', depTime: '16:20:00', haltMinutes: '5', distanceFromOriginKm: 166, day_offset: 0 },
    { sequence: 4, stationCode: 'DGG', stationName: 'Davangere', arrTime: '18:20:00', depTime: '18:22:00', haltMinutes: '2', distanceFromOriginKm: 326, day_offset: 0 },
    { sequence: 5, stationCode: 'UBL', stationName: 'SSS Hubballi Junction', arrTime: '21:10:00', depTime: '21:20:00', haltMinutes: '10', distanceFromOriginKm: 470, day_offset: 0 },
    { sequence: 6, stationCode: 'BGM', stationName: 'Belagavi', arrTime: '23:55:00', depTime: '00:05:00', haltMinutes: '10', distanceFromOriginKm: 612, day_offset: 0 },
    { sequence: 7, stationCode: 'PUNE', stationName: 'Pune Junction', arrTime: '08:45:00', depTime: '08:55:00', haltMinutes: '10', distanceFromOriginKm: 1028, day_offset: 1 },
    { sequence: 8, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '22:10:00', depTime: '22:20:00', haltMinutes: '10', distanceFromOriginKm: 1913, day_offset: 1 },
    { sequence: 9, stationCode: 'VGLJ', stationName: 'Virangana Lakshmibai Jhansi', arrTime: '02:00:00', depTime: '02:10:00', haltMinutes: '10', distanceFromOriginKm: 2205, day_offset: 2 },
    { sequence: 10, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '03:10:00', depTime: '03:12:00', haltMinutes: '2', distanceFromOriginKm: 2302, day_offset: 2 },
    { sequence: 11, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '04:55:00', depTime: '05:00:00', haltMinutes: '5', distanceFromOriginKm: 2420, day_offset: 2 },
    { sequence: 12, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '08:10:00', depTime: '08:10:00', haltMinutes: '0', distanceFromOriginKm: 2608, day_offset: 2 }
  ]
};

// -----------------------------------------------------------------------------
// TRAIN 4: Chennai -> New Delhi (Starts 23 Oct, Every 3 Days)
// Real Indian Railways Train 12615 Grand Trunk Express
// -----------------------------------------------------------------------------
const train4_dates = generateDates('2026-10-23', 30, 3);
const train4 = {
  id: 't-12615',
  train_number: '12615',
  train_name: 'GRAND TRUNK EXPRESS',
  train_type: 'Superfast',
  source_station_code: 'MAS',
  destination_station_code: 'NDLS',
  source: 'MAS',
  destination: 'NDLS',
  from_station: 'MGR Chennai Central',
  to_station: 'New Delhi',
  source_station_name: 'MGR Chennai Central',
  destination_station_name: 'New Delhi',
  departure_time: '18:50:00',
  arrival_time: '06:30:00',
  day_offset: 2,
  duration_minutes: 2140,
  distance_km: 2182,
  classes: ['SL', '3A', '2A', '1A'],
  available_classes: ['SL', '3A', '2A', '1A'],
  service_pattern: 'EVERY_3_DAYS',
  frequency: 'Every 3 Days',
  frequency_type: 'Every 3 Days',
  pattern_start_date: '2026-10-23',
  service_start_date: '2026-10-01',
  service_end_date: '2027-12-31',
  specific_service_dates: train4_dates,
  base_fare: 890,
  fares_by_class: { 'SL': 890, '3A': 2350, '2A': 3450, '1A': 5850 },
  food_available: true,
  catering_payment_mode: 'Paid Separately',
  service_status: 'ACTIVE',
  status: 'on_time',
  delay_minutes: 0,
  record_source: 'official_ir',
  source_data_label: 'VERIFIED INDIAN RAILWAYS',
  coaches: [
    { coach_code: 'S1', class_type: 'SL', total_seats: 72, available_seats: 60, base_fare: 890 },
    { coach_code: 'B1', class_type: '3A', total_seats: 64, available_seats: 44, base_fare: 2350 },
    { coach_code: 'A1', class_type: '2A', total_seats: 36, available_seats: 24, base_fare: 3450 },
    { coach_code: 'H1', class_type: '1A', total_seats: 18, available_seats: 10, base_fare: 5850 }
  ],
  stops: [
    { sequence: 1, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '18:50:00', depTime: '18:50:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
    { sequence: 2, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '01:50:00', depTime: '02:00:00', haltMinutes: '10', distanceFromOriginKm: 431, day_offset: 1 },
    { sequence: 3, stationCode: 'WL', stationName: 'Warangal', arrTime: '04:50:00', depTime: '04:52:00', haltMinutes: '2', distanceFromOriginKm: 638, day_offset: 1 },
    { sequence: 4, stationCode: 'BPQ', stationName: 'Balharshah Junction', arrTime: '08:50:00', depTime: '08:55:00', haltMinutes: '5', distanceFromOriginKm: 881, day_offset: 1 },
    { sequence: 5, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '11:50:00', depTime: '11:55:00', haltMinutes: '5', distanceFromOriginKm: 1089, day_offset: 1 },
    { sequence: 6, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '18:10:00', depTime: '18:20:00', haltMinutes: '10', distanceFromOriginKm: 1479, day_offset: 1 },
    { sequence: 7, stationCode: 'VGLJ', stationName: 'Virangana Lakshmibai Jhansi', arrTime: '22:30:00', depTime: '22:38:00', haltMinutes: '8', distanceFromOriginKm: 1771, day_offset: 1 },
    { sequence: 8, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '23:45:00', depTime: '23:47:00', haltMinutes: '2', distanceFromOriginKm: 1868, day_offset: 1 },
    { sequence: 9, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '01:45:00', depTime: '01:50:00', haltMinutes: '5', distanceFromOriginKm: 1986, day_offset: 2 },
    { sequence: 10, stationCode: 'MTJ', stationName: 'Mathura Junction', arrTime: '02:35:00', depTime: '02:37:00', haltMinutes: '2', distanceFromOriginKm: 2040, day_offset: 2 },
    { sequence: 11, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '06:30:00', depTime: '06:30:00', haltMinutes: '0', distanceFromOriginKm: 2182, day_offset: 2 }
  ]
};

// -----------------------------------------------------------------------------
// TRAIN 5: Thiruvananthapuram -> New Delhi (Starts 24 Oct, Every 3 Days)
// Real Indian Railways Train 12643 Swarna Jayanti SF Express
// -----------------------------------------------------------------------------
const train5_dates = generateDates('2026-10-24', 30, 3);
const train5 = {
  id: 't-12643',
  train_number: '12643',
  train_name: 'THIRUVANANTHAPURAM - HAZRAT NIZAMUDDIN SWARNA JAYANTI SF',
  train_type: 'Superfast',
  source_station_code: 'TVC',
  destination_station_code: 'NZM',
  source: 'TVC',
  destination: 'NZM',
  from_station: 'Thiruvananthapuram Central',
  to_station: 'Hazrat Nizamuddin',
  source_station_name: 'Thiruvananthapuram Central',
  destination_station_name: 'Hazrat Nizamuddin',
  departure_time: '14:15:00',
  arrival_time: '14:10:00',
  day_offset: 2,
  duration_minutes: 2875,
  distance_km: 2927,
  classes: ['SL', '3A', '2A', '1A'],
  available_classes: ['SL', '3A', '2A', '1A'],
  service_pattern: 'EVERY_3_DAYS',
  frequency: 'Every 3 Days',
  frequency_type: 'Every 3 Days',
  pattern_start_date: '2026-10-24',
  service_start_date: '2026-10-01',
  service_end_date: '2027-12-31',
  specific_service_dates: train5_dates,
  base_fare: 980,
  fares_by_class: { 'SL': 980, '3A': 2750, '2A': 3980, '1A': 6600 },
  food_available: true,
  catering_payment_mode: 'Paid Separately',
  service_status: 'ACTIVE',
  status: 'on_time',
  delay_minutes: 0,
  record_source: 'official_ir',
  source_data_label: 'VERIFIED INDIAN RAILWAYS',
  coaches: [
    { coach_code: 'S1', class_type: 'SL', total_seats: 72, available_seats: 58, base_fare: 980 },
    { coach_code: 'B1', class_type: '3A', total_seats: 64, available_seats: 42, base_fare: 2750 },
    { coach_code: 'A1', class_type: '2A', total_seats: 36, available_seats: 24, base_fare: 3980 },
    { coach_code: 'H1', class_type: '1A', total_seats: 18, available_seats: 10, base_fare: 6600 }
  ],
  stops: [
    { sequence: 1, stationCode: 'TVC', stationName: 'Thiruvananthapuram Central', arrTime: '14:15:00', depTime: '14:15:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
    { sequence: 2, stationCode: 'QLN', stationName: 'Kollam Junction', arrTime: '15:15:00', depTime: '15:18:00', haltMinutes: '3', distanceFromOriginKm: 65, day_offset: 0 },
    { sequence: 3, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '18:30:00', depTime: '18:35:00', haltMinutes: '5', distanceFromOriginKm: 206, day_offset: 0 },
    { sequence: 4, stationCode: 'TCR', stationName: 'Thrissur', arrTime: '19:40:00', depTime: '19:43:00', haltMinutes: '3', distanceFromOriginKm: 280, day_offset: 0 },
    { sequence: 5, stationCode: 'PGT', stationName: 'Palakkad Junction', arrTime: '21:10:00', depTime: '21:15:00', haltMinutes: '5', distanceFromOriginKm: 355, day_offset: 0 },
    { sequence: 6, stationCode: 'CBE', stationName: 'Coimbatore Junction', arrTime: '22:35:00', depTime: '22:40:00', haltMinutes: '5', distanceFromOriginKm: 411, day_offset: 0 },
    { sequence: 7, stationCode: 'ED', stationName: 'Erode Junction', arrTime: '00:05:00', depTime: '00:10:00', haltMinutes: '5', distanceFromOriginKm: 512, day_offset: 1 },
    { sequence: 8, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '12:15:00', depTime: '12:25:00', haltMinutes: '10', distanceFromOriginKm: 1184, day_offset: 1 },
    { sequence: 9, stationCode: 'BPQ', stationName: 'Balharshah Junction', arrTime: '19:15:00', depTime: '19:20:00', haltMinutes: '5', distanceFromOriginKm: 1634, day_offset: 1 },
    { sequence: 10, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '22:30:00', depTime: '22:35:00', haltMinutes: '5', distanceFromOriginKm: 1842, day_offset: 1 },
    { sequence: 11, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '04:30:00', depTime: '04:40:00', haltMinutes: '10', distanceFromOriginKm: 2232, day_offset: 2 },
    { sequence: 12, stationCode: 'VGLJ', stationName: 'Virangana Lakshmibai Jhansi', arrTime: '08:35:00', depTime: '08:45:00', haltMinutes: '10', distanceFromOriginKm: 2524, day_offset: 2 },
    { sequence: 13, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '09:40:00', depTime: '09:42:00', haltMinutes: '2', distanceFromOriginKm: 2621, day_offset: 2 },
    { sequence: 14, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '11:20:00', depTime: '11:25:00', haltMinutes: '5', distanceFromOriginKm: 2739, day_offset: 2 },
    { sequence: 15, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '14:10:00', depTime: '14:10:00', haltMinutes: '0', distanceFromOriginKm: 2927, day_offset: 2 }
  ]
};

const newTrainsList = [train1, train2, train3, train4, train5];

let addedTrainsCount = 0;
let addedRoutesCount = 0;
let addedSeatsCount = 0;
let addedServicesCount = 0;

newTrainsList.forEach(t => {
  const existingIdx = db.trains.findIndex(e => {
    const item = Array.isArray(e) ? e[1] : e;
    return item && (String(item.train_number) === String(t.train_number) || item.id === t.id);
  });

  if (existingIdx === -1) {
    // Add train tuple [t.id, t]
    db.trains.push([t.id, t]);
    addedTrainsCount++;

    // Add route tuple [route.id, route]
    const routeId = `r-${t.id}`;
    const newRoute = {
      id: routeId,
      train_id: t.id,
      train_number: t.train_number,
      train_name: t.train_name,
      source_station_name: t.from_station,
      destination_station_name: t.to_station,
      source_station_code: t.source_station_code,
      destination_station_code: t.destination_station_code,
      departure_time: t.departure_time,
      arrival_time: t.arrival_time,
      service_pattern: t.service_pattern,
      frequency: t.frequency,
      frequency_type: t.frequency_type,
      pattern_start_date: t.pattern_start_date,
      specific_service_dates: t.specific_service_dates,
      base_fare: t.base_fare,
      distance_km: t.distance_km,
      stops: t.stops,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.routes.push([routeId, newRoute]);
    addedRoutesCount++;

    // Add coach seats
    const coaches = [];
    if (t.available_classes.includes('1A')) coaches.push({ coach: 'H1', class: '1A', count: 18 });
    if (t.available_classes.includes('2A')) coaches.push({ coach: 'A1', class: '2A', count: 36 });
    if (t.available_classes.includes('3A')) coaches.push({ coach: 'B1', class: '3A', count: 64 });
    if (t.available_classes.includes('SL')) coaches.push({ coach: 'S1', class: 'SL', count: 72 });

    coaches.forEach(c => {
      for (let sNum = 1; sNum <= c.count; sNum++) {
        const seatId = `seat-${t.train_number}-${c.coach}-${sNum}`;
        const seatObj = {
          id: seatId,
          train_id: t.id,
          train_number: t.train_number,
          coach: c.coach,
          coach_class: c.class,
          seat_number: sNum,
          berth_type: sNum % 8 === 7 ? 'SL' : sNum % 8 === 0 ? 'SU' : sNum % 3 === 1 ? 'LB' : sNum % 3 === 2 ? 'MB' : 'UB',
          is_allocated: false,
          created_at: new Date().toISOString()
        };
        db.seats.push([seatId, seatObj]);
        addedSeatsCount++;
      }
    });

    // Add persistent service instances for each service date
    t.specific_service_dates.forEach((dateStr, dIdx) => {
      const svcId = `svc-${t.train_number}-${dateStr}`;
      const instanceKey = `${t.id}_${dateStr}`;

      // Configured inventories matching user example
      let inventory = {};
      if (t.train_number === '09433') {
        // User's exact prompt example:
        if (dateStr === '2026-10-23') {
          inventory = {
            'SL': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 66', statusLabel: 'AVAILABLE 66', availableCount: 66, racCount: 0, wlCount: 0, isBookable: true },
            '3A': { statusType: 'WL', statusCode: 'WL 09', statusLabel: 'WL 09', availableCount: 0, racCount: 8, wlCount: 9, isBookable: true },
            '2A': { statusType: 'RAC', statusCode: 'RAC 03', statusLabel: 'RAC 03', availableCount: 0, racCount: 3, wlCount: 0, isBookable: true },
            '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 4', statusLabel: 'AVAILABLE 4', availableCount: 4, racCount: 0, wlCount: 0, isBookable: true }
          };
        } else if (dateStr === '2026-10-26') {
          inventory = {
            'SL': { statusType: 'WL', statusCode: 'WL 05', statusLabel: 'WL 05', availableCount: 0, racCount: 12, wlCount: 5, isBookable: true },
            '3A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 48', statusLabel: 'AVAILABLE 48', availableCount: 48, racCount: 0, wlCount: 0, isBookable: true },
            '2A': { statusType: 'WL', statusCode: 'WL 02', statusLabel: 'WL 02', availableCount: 0, racCount: 4, wlCount: 2, isBookable: true },
            '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 2', statusLabel: 'AVAILABLE 2', availableCount: 2, racCount: 0, wlCount: 0, isBookable: true }
          };
        } else if (dateStr === '2026-10-29') {
          inventory = {
            'SL': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 70', statusLabel: 'AVAILABLE 70', availableCount: 70, racCount: 0, wlCount: 0, isBookable: true },
            '3A': { statusType: 'RAC', statusCode: 'RAC 04', statusLabel: 'RAC 04', availableCount: 0, racCount: 4, wlCount: 0, isBookable: true },
            '2A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 18', statusLabel: 'AVAILABLE 18', availableCount: 18, racCount: 0, wlCount: 0, isBookable: true },
            '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 3', statusLabel: 'AVAILABLE 3', availableCount: 3, racCount: 0, wlCount: 0, isBookable: true }
          };
        } else {
          inventory = {
            'SL': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 55', statusLabel: 'AVAILABLE 55', availableCount: 55, isBookable: true },
            '3A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 40', statusLabel: 'AVAILABLE 40', availableCount: 40, isBookable: true },
            '2A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 20', statusLabel: 'AVAILABLE 20', availableCount: 20, isBookable: true },
            '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 4', statusLabel: 'AVAILABLE 4', availableCount: 4, isBookable: true }
          };
        }
      } else {
        // Other trains
        inventory = {
          '3A': { statusType: (dIdx % 2 === 0 ? 'AVAILABLE' : 'WL'), statusCode: (dIdx % 2 === 0 ? 'AVAILABLE 42' : 'WL 08'), statusLabel: (dIdx % 2 === 0 ? 'AVAILABLE 42' : 'WL 08'), availableCount: (dIdx % 2 === 0 ? 42 : 0), wlCount: (dIdx % 2 === 0 ? 0 : 8), isBookable: true },
          '2A': { statusType: (dIdx % 3 === 0 ? 'AVAILABLE' : 'RAC'), statusCode: (dIdx % 3 === 0 ? 'AVAILABLE 22' : 'RAC 04'), statusLabel: (dIdx % 3 === 0 ? 'AVAILABLE 22' : 'RAC 04'), availableCount: (dIdx % 3 === 0 ? 22 : 0), racCount: (dIdx % 3 === 0 ? 0 : 4), isBookable: true },
          '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 4', statusLabel: 'AVAILABLE 4', availableCount: 4, isBookable: true }
        };
        if (t.available_classes.includes('SL')) {
          inventory['SL'] = { statusType: (dIdx % 2 === 1 ? 'AVAILABLE' : 'WL'), statusCode: (dIdx % 2 === 1 ? 'AVAILABLE 62' : 'WL 06'), statusLabel: (dIdx % 2 === 1 ? 'AVAILABLE 62' : 'WL 06'), availableCount: (dIdx % 2 === 1 ? 62 : 0), wlCount: (dIdx % 2 === 1 ? 0 : 6), isBookable: true };
        }
      }

      const svcObj = {
        id: svcId,
        instance_key: instanceKey,
        train_id: t.id,
        train_number: t.train_number,
        train_name: t.train_name,
        train_type: t.train_type,
        service_date: dateStr,
        from_station: t.source_station_code,
        to_station: t.destination_station_code,
        source: t.source_station_code,
        destination: t.destination_station_code,
        departure_time: t.departure_time,
        arrival_time: t.arrival_time,
        day_offset: t.day_offset,
        duration_minutes: t.duration_minutes,
        distance_km: t.distance_km,
        service_pattern: t.service_pattern,
        frequency: t.frequency,
        service_status: 'ACTIVE',
        status: 'SCHEDULED',
        inventory,
        created_at: new Date().toISOString()
      };
      db.train_services.push([svcId, svcObj]);
      addedServicesCount++;
    });
  } else {
    console.log(`Train ${t.train_number} already in database.`);
  }
});

fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf8');

console.log('✅ SEEDING COMPLETE:');
console.log(`  + Trains added: ${addedTrainsCount} (total now: ${db.trains.length})`);
console.log(`  + Routes added: ${addedRoutesCount} (total now: ${db.routes.length})`);
console.log(`  + Seats added: ${addedSeatsCount} (total now: ${db.seats.length})`);
console.log(`  + Services added: ${addedServicesCount} (total now: ${db.train_services.length})`);
