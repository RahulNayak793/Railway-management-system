const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const trainsMap = new Map(db.trains);
const routesMap = new Map(db.routes);

let removedTrain = null;
let removedRoute = null;

for (const [id, t] of trainsMap.entries()) {
  if (t && String(t.train_number) === '99887') {
    removedTrain = t;
    trainsMap.delete(id);
  }
}

for (const [id, r] of routesMap.entries()) {
  if (r && (r.train_number === '99887' || (removedTrain && r.train_id === removedTrain.id))) {
    removedRoute = r;
    routesMap.delete(id);
  }
}

if (removedTrain) {
  db.trains = Array.from(trainsMap.entries());
  db.routes = Array.from(routesMap.entries());
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('✅ Temporary browser test train 99887 cleaned up from db.json successfully.');
} else {
  console.log('No temporary test train 99887 found in db.json.');
}
