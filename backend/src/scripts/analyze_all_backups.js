const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../../data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('db.json') || f.endsWith('.json') || f.endsWith('.bak'));

console.log(`Analyzing ${files.length} backup database files in backend/data...\n`);

const results = [];

for (const file of files) {
  const filePath = path.join(dataDir, file);
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) continue;

  let hash = 'ERROR';
  let recordCounts = {};

  try {
    const content = fs.readFileSync(filePath);
    hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
    const data = JSON.parse(content.toString('utf8'));

    // Count array or map entries across standard collections
    const collections = [
      'profiles', 'users', 'staff_profiles', 'staff_permissions',
      'trains', 'stations', 'routes', 'seats', 'bookings',
      'payments', 'support_tickets', 'catering_companies',
      'catering_menu', 'catering_orders', 'staff_duties',
      'staff_daily_reports', 'staff_incidents', 'staff_tasks'
    ];

    for (const c of collections) {
      if (Array.isArray(data[c])) {
        recordCounts[c] = data[c].length;
      } else if (data[c] && typeof data[c] === 'object') {
        recordCounts[c] = Object.keys(data[c]).length;
      } else {
        recordCounts[c] = 0;
      }
    }
  } catch (e) {
    recordCounts = { parseError: e.message };
  }

  results.push({
    file,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    hash: hash.substring(0, 16) + '...',
    fullHash: hash,
    counts: recordCounts
  });
}

console.log('\n### Database Backups Comparison Table\n');
console.log('| Backup File | Size (KB) | Mod Date | Profiles | Staff | Trains | Stations | Routes | Bookings | Payments | Catering Co | Daily Reports | Incidents | Tasks |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');

for (const r of results) {
  const kb = Math.round(r.size / 1024);
  const date = r.mtime.split('T')[0];
  const c = r.counts;
  console.log(`| ${r.file} | ${kb} KB | ${date} | ${c.profiles || 0} | ${c.staff_profiles || 0} | ${c.trains || 0} | ${c.stations || 0} | ${c.routes || 0} | ${c.bookings || 0} | ${c.payments || 0} | ${c.catering_companies || 0} | ${c.staff_daily_reports || 0} | ${c.staff_incidents || 0} | ${c.staff_tasks || 0} |`);
}

