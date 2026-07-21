const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isMockMode = !supabaseUrl || supabaseUrl.includes('mockproject.supabase.co');

let supabase;

// Set up mock DB collections if in Mock Mode
const mockDb = {
  profiles: new Map(),
  saved_passengers: new Map(),
  trains: new Map(),
  stations: new Map(),
  routes: new Map(),
  seats: new Map(),
  bookings: new Map(),
  seat_allocations: new Map(),
  payments: new Map(),
  support_tickets: new Map(),
  support_messages: new Map(),
  feedback: new Map(),
  notifications: new Map()
};

// Seed mockDb with initial data matching supabase/seed.sql
if (isMockMode) {
  console.log('⚠️ Running in Mock Database Mode. Database changes will persist in-memory.');
  
  // Seed stations
  const stationsData = [
    { id: 's1', station_code: 'NDLS', station_name: 'New Delhi', state: 'Delhi' },
    { id: 's2', station_code: 'MMCT', station_name: 'Mumbai Central', state: 'Maharashtra' },
    { id: 's3', station_code: 'BPL', station_name: 'Bhopal Junction', state: 'Madhya Pradesh' },
    { id: 's4', station_code: 'BSB', station_name: 'Varanasi Junction', state: 'Uttar Pradesh' },
    { id: 's5', station_code: 'HWH', station_name: 'Howrah Junction', state: 'West Bengal' },
    { id: 's6', station_code: 'AGC', station_name: 'Agra Cantt', state: 'Uttar Pradesh' },
    { id: 's7', station_code: 'NZM', station_name: 'Hazrat Nizamuddin', state: 'Delhi' },
    { id: 's8', station_code: 'SBC', station_name: 'KSR Bengaluru', state: 'Karnataka' },
    { id: 's9', station_code: 'MAS', station_name: 'Puratchi Thalaivar Dr. M.G. Ramachandran Central', state: 'Tamil Nadu' },
    { id: 's10', station_code: 'PNBE', station_name: 'Patna Junction', state: 'Bihar' },
    { id: 's11', station_code: 'JAT', station_name: 'Jammu Tawi', state: 'Jammu and Kashmir' },
    { id: 's12', station_code: 'PUNE', station_name: 'Pune Junction', state: 'Maharashtra' },
    { id: 's13', station_code: 'VSKP', station_name: 'Visakhapatnam Junction', state: 'Andhra Pradesh' },
    { id: 's14', station_code: 'BZA', station_name: 'Vijayawada Junction', state: 'Andhra Pradesh' },
    { id: 's15', station_code: 'ADI', station_name: 'Ahmedabad Junction', state: 'Gujarat' },
    { id: 's16', station_code: 'LKO', station_name: 'Lucknow Charbagh', state: 'Uttar Pradesh' },
    { id: 's17', station_code: 'GKP', station_name: 'Gorakhpur Junction', state: 'Uttar Pradesh' },
    { id: 's18', station_code: 'HYB', station_name: 'Hyderabad Deccan', state: 'Telangana' },
    { id: 's19', station_code: 'RNC', station_name: 'Ranchi Junction', state: 'Jharkhand' },
    { id: 's20', station_code: 'GHY', station_name: 'Guwahati', state: 'Assam' },
    { id: 's21', station_code: 'JP', station_name: 'Jaipur Junction', state: 'Rajasthan' },
    { id: 's22', station_code: 'CNB', station_name: 'Kanpur Central', state: 'Uttar Pradesh' },
    { id: 's23', station_code: 'CSMT', station_name: 'Chhatrapati Shivaji Maharaj Terminus', state: 'Maharashtra' },
    { id: 's24', station_code: 'SEC', station_name: 'Secunderabad Junction', state: 'Telangana' },
    { id: 's25', station_code: 'SC', station_name: 'Secunderabad', state: 'Telangana' }
  ];
  stationsData.forEach(s => mockDb.stations.set(s.id, s));

  // Seed trains
  const trainsData = [
    { id: 't1', train_number: '12952', train_name: 'Rajdhani Express', status: 'on_time', delay_minutes: 0 },
    { id: 't2', train_number: '12002', train_name: 'Shatabdi Express', status: 'delayed', delay_minutes: 15 },
    { id: 't3', train_number: '22436', train_name: 'Vande Bharat Express', status: 'on_time', delay_minutes: 0 },
    { id: 't4', train_number: '12301', train_name: 'Kolkata Rajdhani', status: 'cancelled', delay_minutes: 0 },
    { id: 't5', train_number: '12050', train_name: 'Gatimaan Express', status: 'on_time', delay_minutes: 0 },
    { id: 't6', train_number: '22671', train_name: 'Tejas Express', status: 'on_time', delay_minutes: 0 },
    { id: 't7', train_number: '12627', train_name: 'Karnataka Express', status: 'on_time', delay_minutes: 5 },
    { id: 't8', train_number: '12953', train_name: 'August Kranti Rajdhani', status: 'on_time', delay_minutes: 0 },
    { id: 't9', train_number: '12262', train_name: 'Howrah Duronto Express', status: 'delayed', delay_minutes: 10 },
    { id: 't10', train_number: '12216', train_name: 'Garib Rath Express', status: 'on_time', delay_minutes: 0 },
    { id: 't11', train_number: '20701', train_name: 'Secunderabad Vande Bharat', status: 'on_time', delay_minutes: 0 },
    { id: 't12', train_number: '12650', train_name: 'Karnataka Sampark Kranti', status: 'on_time', delay_minutes: 0 },
    { id: 't13', train_number: '12841', train_name: 'Coromandel Express', status: 'on_time', delay_minutes: 0 },
    { id: 't14', train_number: '12859', train_name: 'Geetanjali Express', status: 'delayed', delay_minutes: 20 },
    { id: 't15', train_number: '12615', train_name: 'Grand Trunk Express', status: 'on_time', delay_minutes: 0 }
  ];
  trainsData.forEach(t => mockDb.trains.set(t.id, t));

  // Seed routes
  const routesData = [
    { id: 'r1', train_id: 't1', source_station_code: 'NDLS', destination_station_code: 'MMCT', departure_time: '16:30', arrival_time: '08:15', distance_km: 1384, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r2', train_id: 't2', source_station_code: 'NDLS', destination_station_code: 'BPL', departure_time: '06:00', arrival_time: '14:25', distance_km: 707, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r3', train_id: 't3', source_station_code: 'NDLS', destination_station_code: 'BSB', departure_time: '06:00', arrival_time: '14:00', distance_km: 759, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r4', train_id: 't4', source_station_code: 'HWH', destination_station_code: 'NDLS', departure_time: '16:55', arrival_time: '10:00', distance_km: 1450, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r5', train_id: 't5', source_station_code: 'NZM', destination_station_code: 'AGC', departure_time: '08:10', arrival_time: '09:50', distance_km: 188, fare_multiplier: 1.1, stop_sequence: 1 },
    { id: 'r6', train_id: 't6', source_station_code: 'MAS', destination_station_code: 'MDU', departure_time: '06:00', arrival_time: '12:15', distance_km: 497, fare_multiplier: 1.4, stop_sequence: 1 },
    { id: 'r7', train_id: 't7', source_station_code: 'SBC', destination_station_code: 'NDLS', departure_time: '19:20', arrival_time: '09:00', distance_km: 2400, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r8', train_id: 't8', source_station_code: 'MMCT', destination_station_code: 'NDLS', departure_time: '17:10', arrival_time: '09:43', distance_km: 1377, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r9', train_id: 't9', source_station_code: 'HWH', destination_station_code: 'CSMT', departure_time: '05:45', arrival_time: '08:15', distance_km: 1968, fare_multiplier: 1.4, stop_sequence: 1 },
    { id: 'r10', train_id: 't10', source_station_code: 'DEE', destination_station_code: 'BDTS', departure_time: '11:00', arrival_time: '07:15', distance_km: 1431, fare_multiplier: 1.0, stop_sequence: 1 },
    { id: 'r11', train_id: 't11', source_station_code: 'SC', destination_station_code: 'TPTY', departure_time: '06:00', arrival_time: '14:30', distance_km: 661, fare_multiplier: 1.4, stop_sequence: 1 },
    { id: 'r12', train_id: 't12', source_station_code: 'SBC', destination_station_code: 'NZM', departure_time: '13:50', arrival_time: '08:20', distance_km: 2378, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r13', train_id: 't13', source_station_code: 'HWH', destination_station_code: 'MAS', departure_time: '15:20', arrival_time: '16:50', distance_km: 1659, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r14', train_id: 't14', source_station_code: 'CSMT', destination_station_code: 'HWH', departure_time: '06:00', arrival_time: '12:30', distance_km: 1968, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r15', train_id: 't15', source_station_code: 'MAS', destination_station_code: 'NDLS', departure_time: '18:50', arrival_time: '06:30', distance_km: 2182, fare_multiplier: 1.3, stop_sequence: 1 }
  ];
  routesData.forEach(r => mockDb.routes.set(r.id, r));

  // Seed seats for all trains
  trainsData.forEach(t => {
    const classes = ['SL', '3A', '2A', '1A'];
    classes.forEach(cls => {
      const coachNum = cls === 'SL' ? 'S1' : cls === '3A' ? 'B1' : cls === '2A' ? 'A1' : 'H1';
      for (let i = 1; i <= 24; i++) {
        const berthType = i % 6 === 1 || i % 6 === 2 ? 'LB' : i % 6 === 3 || i % 6 === 4 ? 'MB' : 'UB';
        const id = `${t.id}-${coachNum}-${i}`;
        mockDb.seats.set(id, {
          id,
          train_id: t.id,
          coach_class: cls,
          coach_number: coachNum,
          seat_number: i,
          berth_type: berthType
        });
      }
    });
  });
} else {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = {
  supabase,
  isMockMode,
  mockDb
};
