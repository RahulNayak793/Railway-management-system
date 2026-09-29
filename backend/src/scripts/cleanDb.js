console.error('⛔ OPERATION BLOCKED: cleanDb.js has been permanently decommissioned to protect train master records.');
console.error('Train data filtering and deletion is strictly prohibited by system data integrity rules.');
process.exit(1);


const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const trainsMap = new Map(data.trains || []);
const routesMap = new Map(data.routes || []);

console.log('Before cleanup, total trains count:', trainsMap.size);
const removedTrains = [];

const seedNumbers = ['12952', '12002', '22436', '12301', '12050', '90001', '12001', '12295', '12627', '12649', '12951', '12622', '12953', '12009', '16316'];

for (const [id, t] of Array.from(trainsMap.entries())) {
  const name = (t.train_name || '').toLowerCase();
  const num = String(t.train_number || '');

  const isSeedOrTest = 
    name.includes('persistence test') ||
    name.includes('concurrent train') ||
    name.includes('rajdhani') ||
    name.includes('shatabdi') ||
    name.includes('vande bharat') ||
    name.includes('gatimaan') ||
    seedNumbers.includes(num) ||
    num.startsWith('8800') ||
    t.source === 'test' ||
    t.source === 'seed' ||
    t.record_source === 'test' ||
    t.record_source === 'seed' ||
    !t.source || t.source !== 'admin';

  if (isSeedOrTest) {
    trainsMap.delete(id);
    removedTrains.push(`${num} ${t.train_name}`);
    for (const [rId, r] of Array.from(routesMap.entries())) {
      if (r.train_id === id) routesMap.delete(rId);
    }
  }
}

console.log('Removed dummy/seed/test trains:', removedTrains);
console.log('After cleanup, remaining real admin trains count:', trainsMap.size);

data.trains = Array.from(trainsMap.entries());
data.routes = Array.from(routesMap.entries());

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
console.log('✅ Cleaned db.json saved successfully!');
