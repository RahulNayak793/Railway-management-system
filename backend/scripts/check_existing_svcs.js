const fs = require('fs');
const path = require('path');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/db.json'), 'utf8'));

const getObj = entry => Array.isArray(entry) ? entry[1] : entry;

['09433', '12953', '12649', '12615', '12643'].forEach(num => {
  const svcs = (db.train_services || []).map(getObj).filter(s => s && String(s.train_number) === num);
  console.log(num + ' existing services count:', svcs.length);
  if (svcs.length > 0) {
    console.log(num + ' dates:', svcs.slice(0, 5).map(s => s.service_date));
  }
});
