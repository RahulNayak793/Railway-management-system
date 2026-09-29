const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('db.json') || f.endsWith('.json') || f.endsWith('.bak'));

for (const file of files) {
  const filePath = path.join(dataDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.staff_duties && (data.staff_duties.length > 0 || Object.keys(data.staff_duties).length > 0)) {
      console.log(`Found staff_duties in ${file}:`, data.staff_duties);
    }
  } catch (e) {}
}
