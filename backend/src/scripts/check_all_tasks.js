const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('db.json') || f.endsWith('.json') || f.endsWith('.bak'));

for (const file of files) {
  const filePath = path.join(dataDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.staff_tasks && (data.staff_tasks.length > 0 || Object.keys(data.staff_tasks).length > 0)) {
      console.log(`\n=== Staff Tasks in ${file} (count: ${Array.isArray(data.staff_tasks) ? data.staff_tasks.length : Object.keys(data.staff_tasks).length}) ===`);
      const list = Array.isArray(data.staff_tasks) ? data.staff_tasks : Object.entries(data.staff_tasks);
      list.forEach(t => {
        const item = Array.isArray(t) ? t[1] : t;
        console.log(`Task: ${item.id} | ${item.title} | ${item.staff_id} | ${item.assigned_to_email} | ${item.status}`);
      });
    }
  } catch (e) {}
}
