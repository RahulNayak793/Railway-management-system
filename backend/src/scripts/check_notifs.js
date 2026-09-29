const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const bData = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json.backup_before_journey_availability_update'), 'utf8'));

const notifs = Array.from(new Map(bData.notifications || []).values());
console.log('Notifications count in backup:', notifs.length);
notifs.slice(0, 10).forEach(n => {
  console.log(`- ID: ${n.id} | user_id: ${n.user_id} | title: ${n.title} | message: ${n.message?.slice(0, 50)}`);
});
