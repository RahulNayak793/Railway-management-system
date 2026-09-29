const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const TEST_DB_PATH = path.join(__dirname, '../data/test-db.json');

if (fs.existsSync(TEST_DB_PATH)) {
  const prod = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const testDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));

  const demoNums = ['09433', '12953', '12649', '12615', '12643'];

  // Sync trains
  demoNums.forEach(num => {
    const prodEntry = prod.trains.find(e => {
      const t = Array.isArray(e) ? e[1] : e;
      return t && String(t.train_number) === num;
    });
    if (prodEntry) {
      const existingIdx = testDb.trains.findIndex(e => {
        const t = Array.isArray(e) ? e[1] : e;
        return t && String(t.train_number) === num;
      });
      if (existingIdx === -1) {
        testDb.trains.push(prodEntry);
      } else {
        testDb.trains[existingIdx] = prodEntry;
      }
    }
  });

  // Sync routes
  demoNums.forEach(num => {
    const prodRoute = prod.routes.find(e => {
      const r = Array.isArray(e) ? e[1] : e;
      return r && String(r.train_number) === num;
    });
    if (prodRoute) {
      const existingIdx = testDb.routes.findIndex(e => {
        const r = Array.isArray(e) ? e[1] : e;
        return r && String(r.train_number) === num;
      });
      if (existingIdx === -1) {
        testDb.routes.push(prodRoute);
      } else {
        testDb.routes[existingIdx] = prodRoute;
      }
    }
  });

  // Sync train_services
  demoNums.forEach(num => {
    const prodSvcs = prod.train_services.filter(e => {
      const s = Array.isArray(e) ? e[1] : e;
      return s && String(s.train_number) === num;
    });
    prodSvcs.forEach(ps => {
      const sObj = Array.isArray(ps) ? ps[1] : ps;
      const existingIdx = testDb.train_services.findIndex(e => {
        const s = Array.isArray(e) ? e[1] : e;
        return s && String(s.train_number) === num && s.service_date === sObj.service_date;
      });
      if (existingIdx === -1) {
        testDb.train_services.push(ps);
      } else {
        testDb.train_services[existingIdx] = ps;
      }
    });
  });

  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(testDb), 'utf8');
  console.log('✅ Synchronized 5 demo trains to test-db.json');
}
