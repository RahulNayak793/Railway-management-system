const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Helper to get object from [key, obj] or obj
const getObj = entry => Array.isArray(entry) ? entry[1] : entry;

// Generate 3-day pattern dates starting from anchorDate for N occurrences
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

const patternConfigs = {
  '09433': { anchor: '2026-10-23' }, // Train A: 23-Oct, 26-Oct, 29-Oct, 01-Nov...
  '12953': { anchor: '2026-10-24' }, // Train B: 24-Oct, 27-Oct, 30-Oct, 02-Nov...
  '12649': { anchor: '2026-10-25' }, // Train C: 25-Oct, 28-Oct, 31-Oct, 03-Nov...
  '12615': { anchor: '2026-10-23' },
  '12643': { anchor: '2026-10-24' }
};

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

let addedServicesCount = 0;

// Update each target train with full deterministic specific_service_dates
db.trains.forEach(entry => {
  const train = getObj(entry);
  if (!train) return;
  const tNum = String(train.train_number);
  if (patternConfigs[tNum]) {
    const cfg = patternConfigs[tNum];
    const dates = generate3DayDates(cfg.anchor, 25); // ~75 days
    train.service_pattern = 'EVERY_3_DAYS';
    train.frequency = 'Every 3 Days';
    train.frequency_type = 'Every 3 Days';
    train.running_days = 'Every 3 Days';
    train.pattern_start_date = cfg.anchor;
    train.specific_service_dates = dates;

    // Create real train_services records for each date if not already existing
    dates.forEach(dateStr => {
      const svcId = `svc-${tNum}-${dateStr}`;
      const instanceKey = `${train.id}_${dateStr}`;
      if (!existingServiceKeys.has(svcId) && !existingServiceKeys.has(instanceKey)) {
        const newService = {
          id: svcId,
          instance_key: instanceKey,
          train_id: train.id,
          train_number: tNum,
          train_name: train.train_name,
          train_type: train.train_type || 'Superfast',
          service_date: dateStr,
          from_station: train.source,
          to_station: train.destination,
          source: train.source,
          destination: train.destination,
          departure_time: train.departure_time || '07:15:00',
          arrival_time: train.arrival_time || '14:15:00',
          day_offset: train.day_offset || 1,
          duration: train.duration || '20h',
          duration_minutes: train.duration_minutes || 1200,
          distance_km: train.distance_km || 2000,
          running_days: 'Every 3 Days',
          frequency: 'Every 3 Days',
          frequency_type: 'Every 3 Days',
          service_start_date: dates[0],
          service_end_date: dates[dates.length - 1],
          operating_days: [],
          specific_service_dates: dates,
          service_status: 'ACTIVE',
          status: 'SCHEDULED',
          classes: train.classes || ['SL', '3A', '2A', '1A'],
          available_classes: train.available_classes || ['SL', '3A', '2A', '1A'],
          stops: train.stops || [],
          primary_availability: 'AVAILABLE 12',
          inventory: {
            SL: { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 18', statusLabel: 'AVAILABLE 18', availableCount: 18, racCount: 0, wlCount: 0, isBookable: true },
            '3A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 12', statusLabel: 'AVAILABLE 12', availableCount: 12, racCount: 0, wlCount: 0, isBookable: true },
            '2A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 8', statusLabel: 'AVAILABLE 8', availableCount: 8, racCount: 0, wlCount: 0, isBookable: true },
            '1A': { statusType: 'AVAILABLE', statusCode: 'AVAILABLE 4', statusLabel: 'AVAILABLE 4', availableCount: 4, racCount: 0, wlCount: 0, isBookable: true }
          },
          base_fare: train.base_fare || 890,
          fares_by_class: train.fares_by_class || { SL: 890, '3A': 2350, '2A': 3450, '1A': 5850 },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (Array.isArray(db.train_services)) {
          // If train_services stores [id, obj]
          if (db.train_services.length > 0 && Array.isArray(db.train_services[0])) {
            db.train_services.push([svcId, newService]);
          } else {
            db.train_services.push(newService);
          }
          existingServiceKeys.add(svcId);
          existingServiceKeys.add(instanceKey);
          addedServicesCount++;
        }
      }
    });
  }
});

// Update routes for target trains to match
db.routes.forEach(entry => {
  const r = getObj(entry);
  if (!r) return;
  const tNum = String(r.train_number);
  if (patternConfigs[tNum]) {
    const cfg = patternConfigs[tNum];
    r.running_days = 'Every 3 Days';
    r.frequency = 'Every 3 Days';
    r.service_pattern = 'EVERY_3_DAYS';
    r.pattern_start_date = cfg.anchor;
  }
});

fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf8');
console.log('✅ Updated db.json: Added ' + addedServicesCount + ' real service date records.');

// Sync to test-db.json
const TEST_DB_PATH = path.join(__dirname, '../data/test-db.json');
if (fs.existsSync(TEST_DB_PATH)) {
  const testDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
  testDb.trains.forEach(entry => {
    const t = getObj(entry);
    if (t && patternConfigs[String(t.train_number)]) {
      const cfg = patternConfigs[String(t.train_number)];
      t.service_pattern = 'EVERY_3_DAYS';
      t.frequency = 'Every 3 Days';
      t.frequency_type = 'Every 3 Days';
      t.running_days = 'Every 3 Days';
      t.pattern_start_date = cfg.anchor;
      t.specific_service_dates = generate3DayDates(cfg.anchor, 25);
    }
  });
  testDb.routes.forEach(entry => {
    const r = getObj(entry);
    if (r && patternConfigs[String(r.train_number)]) {
      const cfg = patternConfigs[String(r.train_number)];
      r.running_days = 'Every 3 Days';
      r.frequency = 'Every 3 Days';
      r.service_pattern = 'EVERY_3_DAYS';
      r.pattern_start_date = cfg.anchor;
    }
  });
  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(testDb), 'utf8');
  console.log('✅ Synchronized to test-db.json.');
}
