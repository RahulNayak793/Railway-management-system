const { supabase } = require('./src/config/supabase');
const fs = require('fs');

async function seed() {
  try {
    const rawData = fs.readFileSync('../frontend/src/utils/stationsData.js', 'utf8');
    // Extract the array from the JS file
    let jsonStr = rawData.replace('export const indianStations = ', '').trim();
    if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
    
    // Evaluate the string to get the array of objects (using eval is safe here since it's local trusted data)
    const indianStations = eval(jsonStr);

    console.log(`Found ${indianStations.length} stations in stationsData.js`);

    // Fetch existing stations
    const { data: existingStations, error: fetchError } = await supabase
      .from('stations')
      .select('station_code');
      
    if (fetchError) throw fetchError;
    
    const existingCodes = new Set(existingStations.map(s => s.station_code));
    
    const stationsToInsert = indianStations
      .filter(s => !existingCodes.has(s.code))
      .map(s => ({
        station_code: s.code,
        station_name: s.name,
        state: s.state,
        platforms: s.platforms,
        zone: s.zone
      }));

    if (stationsToInsert.length === 0) {
      console.log('All stations are already in the database.');
      return;
    }

    console.log(`Inserting ${stationsToInsert.length} new stations...`);
    
    const { data, error } = await supabase
      .from('stations')
      .insert(stationsToInsert);
      
    if (error) throw error;
    
    console.log('Successfully inserted stations!');
  } catch (err) {
    console.error('Error seeding stations:', err);
  }
}

seed();
