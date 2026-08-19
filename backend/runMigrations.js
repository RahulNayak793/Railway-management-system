const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use the service role key to bypass RLS and execute direct commands if needed
const supabase = createClient(supabaseUrl, supabaseKey);

async function runFallback() {
  console.log('🏁 Executing seeding fallback via Supabase client API...');

  // Seeding default stations
  console.log('📌 Seeding Stations...');
  const stations = [
    { station_code: 'NDLS', station_name: 'New Delhi' },
    { station_code: 'MMCT', station_name: 'Mumbai Central' },
    { station_code: 'BPL', station_name: 'Bhopal Junction' },
    { station_code: 'BSB', station_name: 'Varanasi Junction' },
    { station_code: 'HWH', station_name: 'Howrah Junction' },
    { station_code: 'AGC', station_name: 'Agra Cantt' },
    { station_code: 'NZM', station_name: 'Hazrat Nizamuddin' },
    { station_code: 'GWL', station_name: 'Gwalior Junction' },
    { station_code: 'BOM', station_name: 'Mumbai CSMT' },
    { station_code: 'DEL', station_name: 'Delhi Junction' },
    { station_code: 'PAT', station_name: 'Patna Junction' },
    { station_code: 'RKMP', station_name: 'Rani Kamalapati' },
    { station_code: 'DNR', station_name: 'Danapur' },
    { station_code: 'YPR', station_name: 'Yesvantpur' },
    { station_code: 'MAS', station_name: 'Chennai Central' },
    { station_code: 'ADI', station_name: 'Ahmedabad' },
    { station_code: 'KCVL', station_name: 'Kochuveli' },
    { station_code: 'MYS', station_name: 'Mysuru' },
    { station_code: 'SBC', station_name: 'KSR Bengaluru' }
  ];

  for (const s of stations) {
    const { error } = await supabase.from('stations').insert(s);
    if (error && error.code !== '23505') console.log(`Station ${s.station_code}:`, error.message);
  }

  // Seeding default trains
  console.log('📌 Seeding Trains...');
  const trains = [
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', train_number: '12952', train_name: 'Rajdhani Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', train_number: '12002', train_name: 'Shatabdi Express', status: 'delayed', delay_minutes: 15 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', train_number: '22436', train_name: 'Vande Bharat Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', train_number: '12301', train_name: 'Kolkata Rajdhani', status: 'cancelled', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', train_number: '12050', train_name: 'Gatimaan Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', train_number: '12001', train_name: 'Shatabdi Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', train_number: '12295', train_name: 'Sanghamitra Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', train_number: '12627', train_name: 'Karnataka Express', status: 'on_time', delay_minutes: 5 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', train_number: '12649', train_name: 'Sampark Kranti Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', train_number: '12951', train_name: 'Mumbai Rajdhani Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', train_number: '12622', train_name: 'Tamil Nadu Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', train_number: '12953', train_name: 'August Kranti Rajdhani Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', train_number: '12009', train_name: 'Shatabdi Express', status: 'on_time', delay_minutes: 0 },
    { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', train_number: '16316', train_name: 'Kochuveli Express', status: 'on_time', delay_minutes: 0 }
  ];

  for (const t of trains) {
    const { error } = await supabase.from('trains').insert(t);
    if (error && error.code !== '23505') console.log(`Train ${t.train_number}:`, error.message);
  }

  console.log('🎉 Seeding check run finished.');
}

runFallback();