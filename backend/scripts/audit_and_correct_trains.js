const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');
const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);

const targetTrains = {
  '12953': {
    updatedName: 'AUGUST KRANTI RAJDHANI EXPRESS (PROJECT DEMO)',
    officialName: 'August Kranti Tejas Rajdhani Express',
    officialFrequency: 'Daily',
    officialOperatingDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    officialRoute: 'Mumbai Central (MMCT) -> Hazrat Nizamuddin (NZM)'
  },
  '12649': {
    updatedName: 'KARNATAKA SAMPARK KRANTI EXPRESS (PROJECT DEMO)',
    officialName: 'Karnataka Sampark Kranti Express',
    officialFrequency: 'Sun, Mon, Wed, Fri, Sat (5 Days/Week)',
    officialOperatingDays: ['Sun', 'Mon', 'Wed', 'Fri', 'Sat'],
    officialRoute: 'Yesvantpur / KSR Bengaluru (SBC) -> Hazrat Nizamuddin (NZM)'
  },
  '12615': {
    updatedName: 'GRAND TRUNK EXPRESS (PROJECT DEMO)',
    officialName: 'Grand Trunk Express',
    officialFrequency: 'Daily',
    officialOperatingDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    officialRoute: 'MGR Chennai Central (MAS) -> New Delhi (NDLS)'
  },
  '12643': {
    updatedName: 'THIRUVANANTHAPURAM - HAZRAT NIZAMUDDIN SWARNA JAYANTI SF (PROJECT DEMO)',
    officialName: 'Thiruvananthapuram - Hazrat Nizamuddin Swarna Jayanti Superfast Express',
    officialFrequency: 'Weekly (Tue)',
    officialOperatingDays: ['Tue'],
    officialRoute: 'Thiruvananthapuram Central (TVC) -> Hazrat Nizamuddin (NZM)'
  }
};

const changedAudit = [];

// 1. Correct train metadata in db.trains
db.trains.forEach((entry, idx) => {
  const train = Array.isArray(entry) ? entry[1] : entry;
  if (!train) return;

  const tNum = String(train.train_number);
  if (targetTrains[tNum]) {
    const info = targetTrains[tNum];
    const prevSourceLabel = train.source_data_label || train.record_source;
    
    // Update classification to PROJECT DEMO
    train.train_name = info.updatedName;
    train.record_source = 'project_demo';
    train.source_transparency = 'PROJECT DATABASE / DEMO DATA';
    train.live_connection_status = 'IRCTC / PRS LIVE: NOT CONNECTED';
    train.source_data_label = 'PROJECT DATABASE / DEMO DATA - IRCTC / PRS LIVE: NOT CONNECTED';
    train.is_demo_service_pattern = true;
    train.demo_pattern_notice = 'Configured with EVERY_3_DAYS service pattern for demonstration purposes';
    train.official_ir_train_name = info.officialName;
    train.official_ir_frequency = info.officialFrequency;
    train.official_ir_operating_days = info.officialOperatingDays;
    train.official_ir_route = info.officialRoute;
    train.updated_at = new Date().toISOString();

    changedAudit.push({
      train_number: tNum,
      previous_name: train.official_ir_train_name || info.officialName,
      new_name: info.updatedName,
      previous_classification: prevSourceLabel,
      new_classification: 'PROJECT DATABASE / DEMO DATA (IRCTC / PRS LIVE: NOT CONNECTED)',
      configured_demo_pattern: train.service_pattern || 'EVERY_3_DAYS',
      actual_verified_frequency: info.officialFrequency,
      actual_verified_operating_days: info.officialOperatingDays
    });
  }
});

// 2. Update train_name in matching db.routes
db.routes.forEach(entry => {
  const route = Array.isArray(entry) ? entry[1] : entry;
  if (!route) return;
  const tNum = String(route.train_number);
  if (targetTrains[tNum]) {
    route.train_name = targetTrains[tNum].updatedName;
    route.updated_at = new Date().toISOString();
  }
});

// 3. Update train_name in matching db.train_services
db.train_services.forEach(entry => {
  const svc = Array.isArray(entry) ? entry[1] : entry;
  if (!svc) return;
  const tNum = String(svc.train_number);
  if (targetTrains[tNum]) {
    svc.train_name = targetTrains[tNum].updatedName;
  }
});

// 4. Save updated db.json safely
fs.writeFileSync(DB_PATH, JSON.stringify(db), 'utf8');
console.log('✅ Corrected metadata in db.json successfully.');

// 5. Sync updates to test-db.json if it exists
const TEST_DB_PATH = path.join(__dirname, '../data/test-db.json');
if (fs.existsSync(TEST_DB_PATH)) {
  const testDb = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
  testDb.trains.forEach(entry => {
    const t = Array.isArray(entry) ? entry[1] : entry;
    if (t && targetTrains[String(t.train_number)]) {
      const info = targetTrains[String(t.train_number)];
      t.train_name = info.updatedName;
      t.record_source = 'project_demo';
      t.source_transparency = 'PROJECT DATABASE / DEMO DATA';
      t.live_connection_status = 'IRCTC / PRS LIVE: NOT CONNECTED';
      t.source_data_label = 'PROJECT DATABASE / DEMO DATA - IRCTC / PRS LIVE: NOT CONNECTED';
      t.is_demo_service_pattern = true;
      t.demo_pattern_notice = 'Configured with EVERY_3_DAYS service pattern for demonstration purposes';
      t.official_ir_train_name = info.officialName;
      t.official_ir_frequency = info.officialFrequency;
      t.official_ir_operating_days = info.officialOperatingDays;
    }
  });
  testDb.routes.forEach(entry => {
    const r = Array.isArray(entry) ? entry[1] : entry;
    if (r && targetTrains[String(r.train_number)]) {
      r.train_name = targetTrains[String(r.train_number)].updatedName;
    }
  });
  testDb.train_services.forEach(entry => {
    const s = Array.isArray(entry) ? entry[1] : entry;
    if (s && targetTrains[String(s.train_number)]) {
      s.train_name = targetTrains[String(s.train_number)].updatedName;
    }
  });
  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(testDb), 'utf8');
  console.log('✅ Synchronized metadata corrections to test-db.json.');
}

console.log('\n--- TRAINS METADATA CORRECTION AUDIT ---');
console.log(JSON.stringify(changedAudit, null, 2));

// Verify counts
const afterCounts = {};
for (const [key, val] of Object.entries(db)) {
  if (Array.isArray(val)) {
    afterCounts[key] = val.length;
  }
}
console.log('\nAFTER COUNTS:', JSON.stringify(afterCounts, null, 2));
