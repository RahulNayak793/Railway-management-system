const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');

console.log('==================================================');
console.log('🔍 ROUTE MANAGEMENT DATABASE AUDIT DIAGNOSTIC 🔍');
console.log('==================================================');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: backend/data/db.json does not exist!');
  process.exit(1);
}

const raw = fs.readFileSync(dbPath, 'utf-8');
const data = JSON.parse(raw);

const routesMap = new Map(data.routes || []);
const trainsMap = new Map(data.trains || []);
const stationsMap = new Map(data.stations || []);

const totalRoutes = routesMap.size;
let activeRoutes = 0;
let inactiveRoutes = 0;
let routesWithStops = 0;
let routesWithoutStops = 0;
let routesWithTrains = 0;

const stationSet = new Set();
const signatureSet = new Set();
let duplicateCount = 0;

const sampleRoutes = [];

routesMap.forEach((r, id) => {
  if (!r) return;
  const status = (r.status || 'active').toLowerCase();
  if (status === 'active') activeRoutes++;
  else inactiveRoutes++;

  const src = (r.source_station_code || r.source || '').trim().toUpperCase();
  const dest = (r.destination_station_code || r.destination || '').trim().toUpperCase();

  if (src) stationSet.add(src);
  if (dest) stationSet.add(dest);

  const stops = Array.isArray(r.stops) ? r.stops : [];
  if (stops.length > 0) {
    routesWithStops++;
    stops.forEach(s => {
      const code = (s.stationCode || s.station_code || s.code || '').trim().toUpperCase();
      if (code) stationSet.add(code);
    });
  } else {
    routesWithoutStops++;
  }

  const stopsSig = stops.map(s => (s.stationCode || s.station_code || s.code || '').trim().toUpperCase()).filter(Boolean).join('|');
  const sig = `${src}|${dest}|${stopsSig}`;
  if (signatureSet.has(sig)) {
    duplicateCount++;
  } else {
    signatureSet.add(sig);
  }

  // Check assigned trains
  let hasTrain = false;
  trainsMap.forEach(t => {
    if (t.route_id === id || (t.source_station_code === src && t.destination_station_code === dest)) {
      hasTrain = true;
    }
  });
  if (hasTrain) routesWithTrains++;

  if (sampleRoutes.length < 20) {
    sampleRoutes.push({
      id: id,
      src: src,
      dest: dest,
      distance: r.distance_km || 500,
      duration: r.estimated_duration || '12h 00m',
      stopsCount: stops.length,
      status: r.status || 'Active'
    });
  }
});

console.log(`  - TOTAL ROUTES IN DB:                ${totalRoutes}`);
console.log(`  - ACTIVE ROUTES:                     ${activeRoutes}`);
console.log(`  - INACTIVE ROUTES:                   ${inactiveRoutes}`);
console.log(`  - UNIQUE ROUTE SIGNATURES:           ${signatureSet.size}`);
console.log(`  - DUPLICATE ROUTE SIGNATURES:        ${duplicateCount}`);
console.log(`  - TOTAL STATIONS IN MASTER:          ${stationsMap.size}`);
console.log(`  - STATIONS USED BY ROUTES:           ${stationSet.size}`);
console.log(`  - ROUTES WITH INTERMEDIATE STOPS:    ${routesWithStops}`);
console.log(`  - ROUTES WITHOUT STOPS (DIRECT):     ${routesWithoutStops}`);
console.log(`  - ROUTES WITH ASSIGNED TRAINS:       ${routesWithTrains}`);
console.log(`==================================================\n`);

console.log('FIRST 20 ROUTES IN DATABASE:');
sampleRoutes.forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(2, ' ')}. [${r.id}] ${r.src} ➔ ${r.dest} (${r.distance} km, ${r.duration}, ${r.stopsCount} stops, Status: ${r.status})`);
});
console.log('==================================================');
