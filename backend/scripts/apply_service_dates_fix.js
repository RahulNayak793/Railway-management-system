const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const getObj = entry => Array.isArray(entry) ? entry[1] : entry;

function generate3DayDates(anchorDateStr, count = 25) {
  const dates = [];
  const [y, m, d] = anchorDateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  
  for (let i = 0; i < count; i++) {
    const cur = new Date(start.getTime() + i * 3 * 24 * 60 * 60 * 1000);
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

const dates23OctPattern = generate3DayDates('2026-10-23', 25);
const demoTargetNums = ['09401', '09403', '09405', '09407'];

// Check existing service instance keys
const existingServiceKeys = new Set();
(db.train_services || []).forEach(entry => {
  const s = getObj(entry);
  if (s) {
    existingServiceKeys.add(s.id);
    if (s.instance_key) existingServiceKeys.add(s.instance_key);
    existingServiceKeys.add(`${s.train_number}_${s.service_date}`);
    existingServiceKeys.add(`${s.train_id}_${s.service_date}`);
  }
});

let addedServices = 0;

// 1. Update 09401, 09403, 09405, 09407
db.trains.forEach(entry => {
  const t = getObj(entry);
  if (!t) return;
  const num = String(t.train_number);
  
  if (demoTargetNums.includes(num)) {
    t.is_date_specific = false;
    t.service_type = 'RECURRING';
    t.service_start_date = '2026-10-23';
    t.service_end_date = '2027-12-31';
    t.frequency = 'Every 3 Days';
    t.frequency_type = 'Every 3 Days';
    t.running_days = 'Every 3 Days';
    t.service_pattern = 'EVERY_3_DAYS';
    t.pattern_start_date = '2026-10-23';
    t.specific_service_dates = dates23OctPattern;
    t.record_source = 'project_demo';
    t.source_transparency = 'PROJECT DATABASE / DEMO DATA';
    t.live_connection_status = 'IRCTC / PRS LIVE: NOT CONNECTED';
    t.source_data_label = 'PROJECT DATABASE / DEMO DATA - IRCTC / PRS LIVE: NOT CONNECTED';
    t.classes = t.classes || ['SL', '3A', '2A', '1A'];
    t.available_classes = t.available_classes || ['SL', '3A', '2A', '1A'];
    t.updated_at = new Date().toISOString();

    // Create real train_services records
    dates23OctPattern.forEach(dStr => {
      const svcId = `svc-${num}-${dStr}`;
      const instKey = `${t.id}_${dStr}`;
      if (!existingServiceKeys.has(svcId) && !existingServiceKeys.has(instKey)) {
        const newSvc = {
          id: svcId,
          instance_key: instKey,
          train_id: t.id,
          train_number: num,
          train_name: t.train_name,
          train_type: t.train_type || 'Superfast',
          service_date: dStr,
          from_station: t.source,
          to_station: t.destination,
          source: t.source,
          destination: t.destination,
          departure_time: t.departure_time || '08:00:00',
          arrival_time: t.arrival_time || '15:00:00',
          day_offset: t.day_offset || 1,
          duration: t.duration || '20h',
          duration_minutes: t.duration_minutes || 1200,
          distance_km: t.distance_km || 2195,
          running_days: 'Every 3 Days',
          frequency: 'Every 3 Days',
          frequency_type: 'Every 3 Days',
          service_start_date: dates23OctPattern[0],
          service_end_date: dates23OctPattern[dates23OctPattern.length - 1],
          operating_days: [],
          specific_service_dates: dates23OctPattern,
          service_status: 'ACTIVE',
          status: 'SCHEDULED',
          classes: t.classes,
          available_classes: t.available_classes,
          stops: t.stops || [],
          primary_availability: 'AVAILABLE 12',
          inventory: {
            SL: { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 18', statusLabel: 'AVAILABLE 18', availableCount: 18, racCount: 0, wlCount: 0, isBookable: true },
            '3A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 12', statusLabel: 'AVAILABLE 12', availableCount: 12, racCount: 0, wlCount: 0, isBookable: true },
            '2A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 8', statusLabel: 'AVAILABLE 8', availableCount: 8, racCount: 0, wlCount: 0, isBookable: true },
            '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 4', statusLabel: 'AVAILABLE 4', availableCount: 4, racCount: 0, wlCount: 0, isBookable: true }
          },
          base_fare: t.base_fare || 890,
          fares_by_class: t.fares_by_class || { SL: 890, '3A': 2350, '2A': 3450, '1A': 5850 },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (Array.isArray(db.train_services)) {
          if (db.train_services.length > 0 && Array.isArray(db.train_services[0])) {
            db.train_services.push([svcId, newSvc]);
          } else {
            db.train_services.push(newSvc);
          }
          existingServiceKeys.add(svcId);
          existingServiceKeys.add(instKey);
          addedServices++;
        }
      }
    });
  }

  // 2. Fix 12345
  if (num === '12345') {
    t.destination = 'NDLS';
    t.destination_station_code = 'NDLS';
    t.destination_station_name = 'New Delhi';
    t.classes = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
    t.available_classes = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
    t.frequency = 'Daily';
    t.frequency_type = 'Daily';
    t.running_days = 'Daily';
    t.operating_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    t.source_transparency = 'PROJECT DATABASE / DEMO DATA';
    t.live_connection_status = 'IRCTC / PRS LIVE: NOT CONNECTED';
    t.source_data_label = 'PROJECT DATABASE / DEMO DATA - IRCTC / PRS LIVE: NOT CONNECTED';
    t.updated_at = new Date().toISOString();
  }
});

// Update routes for 09401, 09403, 09405, 09407 and 12345
db.routes.forEach(entry => {
  const r = getObj(entry);
  if (!r) return;
  const num = String(r.train_number);
  
  if (demoTargetNums.includes(num)) {
    r.running_days = 'Every 3 Days';
    r.frequency = 'Every 3 Days';
    r.service_pattern = 'EVERY_3_DAYS';
    r.pattern_start_date = '2026-10-23';
    r.is_date_specific = false;
  }

  if (num === '12345' || r.id === 'r-45jgxi0z5') {
    r.train_number = '12345';
    r.train_name = 'udupi express';
    r.destination_station_code = 'NDLS';
    r.destination_station_name = 'New Delhi';
    r.running_days = 'Daily';
    r.frequency = 'Daily';
    
    // Copy complete 13 stops if it only had 1 stop
    if (!r.stops || r.stops.length <= 1) {
      const fullRoute = db.routes.map(getObj).find(x => x && x.id === 'r-12345');
      if (fullRoute && Array.isArray(fullRoute.stops)) {
        r.stops = fullRoute.stops;
        r.distance_km = fullRoute.distance_km || 2195;
      }
    }
  }
});

fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf8');
console.log(`✅ Applied updates to db.json. Added ${addedServices} train_services records.`);

// Sync to test-db.json
const TEST_DB_PATH = path.join(__dirname, '../data/test-db.json');
if (fs.existsSync(TEST_DB_PATH)) {
  const testDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
  testDb.trains.forEach(entry => {
    const t = getObj(entry);
    if (!t) return;
    const num = String(t.train_number);
    if (demoTargetNums.includes(num)) {
      t.is_date_specific = false;
      t.service_start_date = '2026-10-23';
      t.service_end_date = '2027-12-31';
      t.frequency = 'Every 3 Days';
      t.frequency_type = 'Every 3 Days';
      t.running_days = 'Every 3 Days';
      t.service_pattern = 'EVERY_3_DAYS';
      t.pattern_start_date = '2026-10-23';
      t.specific_service_dates = dates23OctPattern;
      t.record_source = 'project_demo';
      t.source_transparency = 'PROJECT DATABASE / DEMO DATA';
      t.live_connection_status = 'IRCTC / PRS LIVE: NOT CONNECTED';
      t.source_data_label = 'PROJECT DATABASE / DEMO DATA - IRCTC / PRS LIVE: NOT CONNECTED';
      t.classes = t.classes || ['SL', '3A', '2A', '1A'];
      t.available_classes = t.available_classes || ['SL', '3A', '2A', '1A'];
    }
    if (num === '12345') {
      t.destination = 'NDLS';
      t.destination_station_code = 'NDLS';
      t.destination_station_name = 'New Delhi';
      t.classes = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
      t.available_classes = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
      t.frequency = 'Daily';
      t.frequency_type = 'Daily';
      t.running_days = 'Daily';
      t.operating_days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }
  });

  testDb.routes.forEach(entry => {
    const r = getObj(entry);
    if (!r) return;
    const num = String(r.train_number);
    if (demoTargetNums.includes(num)) {
      r.running_days = 'Every 3 Days';
      r.frequency = 'Every 3 Days';
      r.service_pattern = 'EVERY_3_DAYS';
      r.pattern_start_date = '2026-10-23';
      r.is_date_specific = false;
    }
    if (num === '12345' || r.id === 'r-45jgxi0z5') {
      r.train_number = '12345';
      r.destination_station_code = 'NDLS';
      r.destination_station_name = 'New Delhi';
      r.running_days = 'Daily';
      r.frequency = 'Daily';
      if (!r.stops || r.stops.length <= 1) {
        const fullRoute = testDb.routes.map(getObj).find(x => x && x.id === 'r-12345');
        if (fullRoute && Array.isArray(fullRoute.stops)) {
          r.stops = fullRoute.stops;
        }
      }
    }
  });

  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(testDb), 'utf8');
  console.log('✅ Synchronized updates to test-db.json.');
}
