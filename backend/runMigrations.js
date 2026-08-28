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

  console.log('🎉 Station seeding check finished (train database relies on admin creation).');
}

runFallback();