const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const currentDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));

const profiles = new Map(currentDb.profiles || []);
console.log('Profiles in current db:');
for (const [id, p] of profiles.entries()) {
  if (p && p.email && p.email.includes('mahesh')) {
    console.log('Found Mahesh in profiles:', id, p);
  }
}
