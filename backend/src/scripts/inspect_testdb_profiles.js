const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const testDb = JSON.parse(fs.readFileSync(path.join(dataDir, 'test-db.json'), 'utf8'));

const testProfs = new Map(testDb.staff_profiles || []);
console.log('test-db staff profiles count:', testProfs.size);
for (const [id, p] of testProfs.entries()) {
  console.log(id, p?.full_name, p?.email, p?.designation, p?.status);
}
