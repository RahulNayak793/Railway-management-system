const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const backupPath = path.join(__dirname, '../../data/db.json.backup_routes_management');

console.log('=== ROUTE MANAGEMENT BACKUP & NORMALIZATION SCRIPT ===');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: backend/data/db.json does not exist!');
  process.exit(1);
}

// 1. Create Backup
fs.copyFileSync(dbPath, backupPath);
if (!fs.existsSync(backupPath)) {
  console.error('❌ Backup creation failed!');
  process.exit(1);
}
console.log(`✅ Backup successfully created at: ${backupPath}`);
console.log(`  File size: ${fs.statSync(backupPath).size} bytes`);

// 2. Audit and Normalize Routes in db.json
const rawData = fs.readFileSync(dbPath, 'utf-8');
const data = JSON.parse(rawData);

const routesMap = new Map(data.routes || []);
const trainsMap = new Map(data.trains || []);

console.log(`\nOriginal Routes Count: ${routesMap.size}`);
console.log(`Original Trains Count: ${trainsMap.size}`);

// Audit routes
const uniqueRoutes = new Map(); // key: SOURCE_DEST_SIGNATURE
const routeIdRemap = new Map();

for (const [id, route] of Array.from(routesMap.entries())) {
  if (!route) continue;
  const src = (route.source_station_code || '').trim().toUpperCase();
  const dest = (route.destination_station_code || '').trim().toUpperCase();
  if (!src || !dest) continue;

  // Build signature based on source, dest, and intermediate stop station codes
  const stopsSignature = Array.isArray(route.stops)
    ? route.stops.map(s => s.stationCode || s.station_code || s.code).filter(Boolean).join('-')
    : '';
  const signature = `${src}_${dest}_[${stopsSignature}]`;

  if (uniqueRoutes.has(signature)) {
    // Duplicate route entry! Map old route ID to primary route ID
    const primaryRoute = uniqueRoutes.get(signature);
    routeIdRemap.set(id, primaryRoute.id);
    routesMap.delete(id);
    console.log(`  - Merged duplicate route ${id} (${src} -> ${dest}) into primary route ${primaryRoute.id}`);
  } else {
    // Standardize route object fields
    route.id = id;
    route.source_station_code = src;
    route.destination_station_code = dest;
    route.distance_km = parseFloat(route.distance_km || 500);
    route.status = route.status || 'Active';
    route.created_at = route.created_at || new Date().toISOString();
    route.updated_at = new Date().toISOString();
    if (!Array.isArray(route.stops)) {
      route.stops = [];
    }
    uniqueRoutes.set(signature, route);
    routesMap.set(id, route);
  }
}

// Check trains to make sure every train source/destination has a matching route
for (const [id, train] of Array.from(trainsMap.entries())) {
  if (!train) continue;
  const src = (train.source_station_code || train.source || '').trim().toUpperCase();
  const dest = (train.destination_station_code || train.destination || '').trim().toUpperCase();
  if (!src || !dest) continue;

  // Find if a route already exists for this train's src -> dest
  let matchingRoute = Array.from(routesMap.values()).find(
    r => r.source_station_code === src && r.destination_station_code === dest
  );

  if (!matchingRoute) {
    // Create route for existing train if missing
    const newRouteId = `r-${Math.random().toString(36).substr(2, 9)}`;
    matchingRoute = {
      id: newRouteId,
      train_id: train.id,
      source_station_code: src,
      destination_station_code: dest,
      departure_time: train.departure_time || train.scheduled_departure_time || '08:00:00',
      arrival_time: train.arrival_time || train.scheduled_arrival_time || '20:00:00',
      distance_km: parseFloat(train.distance_km || 500),
      fare_multiplier: 1.0,
      frequency: train.frequency || 'Daily',
      status: 'Active',
      stops: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    routesMap.set(newRouteId, matchingRoute);
    console.log(`  + Created missing route ${newRouteId} for train ${train.train_number} (${src} -> ${dest})`);
  }
}

data.routes = Array.from(routesMap.entries());
data.trains = Array.from(trainsMap.entries());

const tmpPath = `${dbPath}.tmp.${process.pid}`;
fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
fs.renameSync(tmpPath, dbPath);

console.log(`\nFinal Routes Count: ${routesMap.size}`);
console.log('✅ Route normalization and backup complete!');
