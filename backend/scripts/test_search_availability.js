const { getClassDateAvailability, calculateDateWiseAvailability } = require('../src/services/trainServiceInstanceService');
const { searchTrains } = require('../src/utils/routeSearch');
const sb = require('../src/config/supabase');

console.log('Testing Train Search for UD -> NZM on 2026-10-23...');
const results23 = searchTrains('UD', 'NZM', '2026-10-23');
console.log(`Found ${results23.length} trains on 2026-10-23:`, results23.map(t => `${t.train_number} - ${t.train_name}`));

const results24 = searchTrains('UD', 'NZM', '2026-10-24');
console.log(`Found ${results24.length} trains on 2026-10-24 (should NOT contain 09433):`, results24.map(t => `${t.train_number} - ${t.train_name}`));

const results26 = searchTrains('UD', 'NZM', '2026-10-26');
console.log(`Found ${results26.length} trains on 2026-10-26 (SHOULD contain 09433):`, results26.map(t => `${t.train_number} - ${t.train_name}`));

console.log('\nTesting Class Date Availability for 09433 from 2026-10-23:');
['SL', '3A', '2A', '1A'].forEach(cls => {
  const res = getClassDateAvailability('09433', cls, '2026-10-23', 6, 'UD', 'NZM');
  if (res.success) {
    console.log(`Class ${cls}:`);
    res.dates.forEach(d => {
      console.log(`   ${d.dateFormatted} (${d.date}) -> ${d.status} | Fare: ${d.fare}`);
    });
  } else {
    console.error(`Class ${cls} error:`, res.error);
  }
});
