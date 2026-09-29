const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const isMockMode = process.env.MOCK_MODE === 'true';

// Startup validation for production hardening
if (process.env.NODE_ENV === 'production') {
  if (isMockMode) {
    console.error('❌ FATAL CONFIGURATION ERROR: Mock Mode is explicitly forbidden in production!');
    process.exit(1);
  }
  const isInvalidCreds = !supabaseUrl || !supabaseServiceKey || 
                         supabaseUrl.includes('mockproject.supabase.co') || 
                         supabaseUrl.includes('your-supabase-project') ||
                         supabaseServiceKey.includes('your-supabase') ||
                         supabaseServiceKey.includes('your_supabase') ||
                         supabaseServiceKey.startsWith('sb_publishable_');
  if (isInvalidCreds) {
    console.error('❌ FATAL CONFIGURATION ERROR: Supabase environment credentials are missing, invalid, or using public publishable/anon keys in PRODUCTION mode!');
    console.error('Please configure a valid SUPABASE_URL and a secret SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
}

let supabase = null;

function getDbFilePath() {
  if (process.env.DB_FILE_PATH) return process.env.DB_FILE_PATH;
  if (process.env.NODE_ENV === 'test') {
    return path.join(__dirname, '../../data/test-db.json');
  }
  return path.join(__dirname, '../../data/db.json');
}

// Set up mock DB collections if in Mock Mode
const mockDb = {
  profiles: new Map(),
  saved_passengers: new Map(),
  trains: new Map(),
  stations: new Map(),
  routes: new Map(),
  seats: new Map(),
  bookings: new Map(),
  seat_allocations: new Map(),
  payments: new Map(),
  support_tickets: new Map(),
  support_messages: new Map(),
  feedback: new Map(),
  notifications: new Map(),
  cancellation_requests: new Map(),
  cancellation_records: new Map(),
  train_telemetry: new Map(),
  catering_companies: new Map(),
  company_stations: new Map(),
  catering_menu: new Map(),
  catering_orders: new Map(),
  train_status_history: new Map(),
  train_status_by_date: new Map(),
  audit_logs: new Map(),
  staff_profiles: new Map(),
  staff_permissions: new Map(),
  staff_duties: new Map(),
  staff_daily_reports: new Map(),
  staff_incidents: new Map(),
  staff_audit_logs: new Map(),
  staff_tasks: new Map(),
  service_requests: new Map(),
  policies: new Map(),
  train_services: new Map(),
  razorpay_payments: new Map(),
  eft_records: new Map(),
  train_onboard_catering: new Map(),
  train_service_dates: new Map()
};

let isSavingFile = false;
let pendingSaveRequest = false;
let debounceTimer = null;

function scheduleDebouncedSave(delay = 100) {
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    saveMockDbToFile();
  }, delay);
}

function safeAtomicRenameSync(tmpPath, destPath, retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.renameSync(tmpPath, destPath);
      return;
    } catch (err) {
      if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < retries - 1) {
        const start = Date.now();
        while (Date.now() - start < 30) {}
      } else {
        throw err;
      }
    }
  }
}

function saveMockDbToFile() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  const targetFilePath = getDbFilePath();
  if (process.env.NODE_ENV === 'test' && !process.env.DB_FILE_PATH && process.env.PERSISTENCE_TEST !== 'true') {
    return;
  }
  if (isSavingFile) {
    pendingSaveRequest = true;
    return;
  }
  isSavingFile = true;

  try {
    const dataToSave = {};
    for (const [key, val] of Object.entries(mockDb)) {
      if (val instanceof Map) {
        dataToSave[key] = Array.from(val.entries());
      } else {
        dataToSave[key] = val;
      }
    }
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpFilePath = `${targetFilePath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpFilePath, JSON.stringify(dataToSave), 'utf-8');
    safeAtomicRenameSync(tmpFilePath, targetFilePath);
  } catch (err) {
    console.error('Error saving database atomically to file:', err.message);
  } finally {
    isSavingFile = false;
    if (pendingSaveRequest) {
      pendingSaveRequest = false;
      saveMockDbToFile();
    }
  }
}

function enableAutoSave(db) {
  for (const [key, val] of Object.entries(db)) {
    if (key === 'train_services' || key === 'seats' || key === 'train_service_dates') continue; // Use batch save at end of generation for bulk entities
    if (val instanceof Map) {
      const origSet = val.set.bind(val);
      const origDelete = val.delete.bind(val);
      const origClear = val.clear.bind(val);

      val.set = function(...args) {
        const res = origSet(...args);
        scheduleDebouncedSave(100);
        return res;
      };
      val.delete = function(...args) {
        const res = origDelete(...args);
        scheduleDebouncedSave(100);
        return res;
      };
      val.clear = function(...args) {
        const res = origClear(...args);
        scheduleDebouncedSave(100);
        return res;
      };
    }
  }
}

// Function to seed initial default mock data
function seedInitialMockData() {


  const stationsData = [
    { id: 's1', station_code: 'NDLS', station_name: 'New Delhi', state: 'Delhi' },
    { id: 's2', station_code: 'MMCT', station_name: 'Mumbai Central', state: 'Maharashtra' },
    { id: 's3', station_code: 'CSMT', station_name: 'Chhatrapati Shivaji Maharaj Terminus', state: 'Maharashtra' },
    { id: 's4', station_code: 'HWH', station_name: 'Howrah Junction', state: 'West Bengal' },
    { id: 's5', station_code: 'SBC', station_name: 'KSR Bengaluru City', state: 'Karnataka' },
    { id: 's6', station_code: 'MAS', station_name: 'MGR Chennai Central', state: 'Tamil Nadu' },
    { id: 's7', station_code: 'ADI', station_name: 'Ahmedabad Junction', state: 'Gujarat' },
    { id: 's8', station_code: 'PNBE', station_name: 'Patna Junction', state: 'Bihar' },
    { id: 's9', station_code: 'JAT', station_name: 'Jammu Tawi', state: 'Jammu & Kashmir' },
    { id: 's10', station_code: 'JP', station_name: 'Jaipur Junction', state: 'Rajasthan' },
    { id: 's11', station_code: 'HYB', station_name: 'Hyderabad Deccan Nampally', state: 'Telangana' },
    { id: 's12', station_code: 'SC', station_name: 'Secunderabad Junction', state: 'Telangana' },
    { id: 's13', station_code: 'CNB', station_name: 'Kanpur Central', state: 'Uttar Pradesh' },
    { id: 's14', station_code: 'GKP', station_name: 'Gorakhpur Junction', state: 'Uttar Pradesh' },
    { id: 's15', station_code: 'BSB', station_name: 'Varanasi Junction', state: 'Uttar Pradesh' },
    { id: 's16', station_code: 'LKO', station_name: 'Lucknow Charbagh NR', state: 'Uttar Pradesh' },
    { id: 's17', station_code: 'CBE', station_name: 'Coimbatore Junction', state: 'Tamil Nadu' },
    { id: 's18', station_code: 'TVC', station_name: 'Thiruvananthapuram Central', state: 'Kerala' },
    { id: 's19', station_code: 'GHY', station_name: 'Guwahati Junction', state: 'Assam' },
    { id: 's20', station_code: 'BPL', station_name: 'Bhopal Junction', state: 'Madhya Pradesh' },
    { id: 's21', station_code: 'PUNE', station_name: 'Pune Junction', state: 'Maharashtra' },
    { id: 's22', station_code: 'NGP', station_name: 'Nagpur Junction', state: 'Maharashtra' },
    { id: 's23', station_code: 'BBS', station_name: 'Bhubaneswar', state: 'Odisha' },
    { id: 's24', station_code: 'VSKP', station_name: 'Visakhapatnam Junction', state: 'Andhra Pradesh' },
    { id: 's25', station_code: 'BZA', station_name: 'Vijayawada Junction', state: 'Andhra Pradesh' },
    { id: 's26', station_code: 'ASR', station_name: 'Amritsar Junction', state: 'Punjab' },
    { id: 's27', station_code: 'CDG', station_name: 'Chandigarh Junction', state: 'Union Territory' },
    { id: 's28', station_code: 'LTT', station_name: 'Lokmanya Tilak Terminus', state: 'Maharashtra' },
    { id: 's29', station_code: 'KYN', station_name: 'Kalyan Junction', state: 'Maharashtra' },
    { id: 's30', station_code: 'BDTS', station_name: 'Bandra Terminus', state: 'Maharashtra' },
    { id: 's31', station_code: 'TATA', station_name: 'Tatanagar Junction', state: 'Jharkhand' },
    { id: 's32', station_code: 'KGP', station_name: 'Kharagpur Junction', state: 'West Bengal' },
    { id: 's33', station_code: 'SDAH', station_name: 'Sealdah', state: 'West Bengal' },
    { id: 's34', station_code: 'KOAA', station_name: 'Kolkata', state: 'West Bengal' },
    { id: 's35', station_code: 'MS', station_name: 'Chennai Egmore', state: 'Tamil Nadu' },
    { id: 's36', station_code: 'MDU', station_name: 'Madurai Junction', state: 'Tamil Nadu' },
    { id: 's37', station_code: 'ERS', station_name: 'Ernakulam Junction', state: 'Kerala' },
    { id: 's38', station_code: 'AGC', station_name: 'Agra Cantt', state: 'Uttar Pradesh' },
    { id: 's39', station_code: 'VGLJ', station_name: 'VGL Jhansi Junction', state: 'Uttar Pradesh' },
    { id: 's40', station_code: 'KOTA', station_name: 'Kota Junction', state: 'Rajasthan' },
    { id: 's41', station_code: 'RTM', station_name: 'Ratlam Junction', state: 'Madhya Pradesh' },
    { id: 's42', station_code: 'BRC', station_name: 'Vadodara Junction', state: 'Gujarat' },
    { id: 's43', station_code: 'SUR', station_name: 'Solapur Junction', state: 'Maharashtra' },
    { id: 's44', station_code: 'ET', station_name: 'Itarsi Junction', state: 'Madhya Pradesh' },
    { id: 's45', station_code: 'JBP', station_name: 'Jabalpur Junction', state: 'Madhya Pradesh' },
    { id: 's46', station_code: 'DDU', station_name: 'Pt Deen Dayal Upadhyaya Junction', state: 'Uttar Pradesh' },
    { id: 's47', station_code: 'GAYA', station_name: 'Gaya Junction', state: 'Bihar' },
    { id: 's48', station_code: 'R', station_name: 'Raipur Junction', state: 'Chhattisgarh' },
    { id: 's49', station_code: 'BSP', station_name: 'Bilaspur Junction', state: 'Chhattisgarh' },
    { id: 's50', station_code: 'DLI', station_name: 'Old Delhi Junction', state: 'Delhi' },
    { id: 's51', station_code: 'ANVT', station_name: 'Anand Vihar Terminal', state: 'Delhi' },
    { id: 's52', station_code: 'GZB', station_name: 'Ghaziabad Junction', state: 'Uttar Pradesh' },
    { id: 's53', station_code: 'DNR', station_name: 'Danapur', state: 'Bihar' },
    { id: 's54', station_code: 'BJU', station_name: 'Barauni Junction', state: 'Bihar' },
    { id: 's55', station_code: 'MFP', station_name: 'Muzaffarpur Junction', state: 'Bihar' },
    { id: 's56', station_code: 'CPR', station_name: 'Chhapra Junction', state: 'Bihar' },
    { id: 's57', station_code: 'GWL', station_name: 'Gwalior Junction', state: 'Madhya Pradesh' },
    { id: 's58', station_code: 'UJN', station_name: 'Ujjain Junction', state: 'Madhya Pradesh' },
    { id: 's59', station_code: 'INDB', station_name: 'Indore Junction', state: 'Madhya Pradesh' },
    { id: 's60', station_code: 'ST', station_name: 'Surat', state: 'Gujarat' },
    { id: 's61', station_code: 'ANND', station_name: 'Anand Junction', state: 'Gujarat' },
    { id: 's62', station_code: 'NVS', station_name: 'Navsari', state: 'Gujarat' },
    { id: 's63', station_code: 'VAPI', station_name: 'Vapi', state: 'Gujarat' },
    { id: 's64', station_code: 'BL', station_name: 'Valsad', state: 'Gujarat' },
    { id: 's65', station_code: 'YPR', station_name: 'Yesvantpur Junction', state: 'Karnataka' },
    { id: 's66', station_code: 'MYS', station_name: 'Mysuru Junction', state: 'Karnataka' },
    { id: 's67', station_code: 'UBL', station_name: 'SSS Hubballi Junction', state: 'Karnataka' },
    { id: 's68', station_code: 'MAS-S', station_name: 'Tambaram', state: 'Tamil Nadu' },
    { id: 's69', station_code: 'TPJ', station_name: 'Tiruchchirappalli Junction', state: 'Tamil Nadu' },
    { id: 's70', station_code: 'ED', station_name: 'Erode Junction', state: 'Tamil Nadu' },
    { id: 's71', station_code: 'SA', station_name: 'Salem Junction', state: 'Tamil Nadu' },
    { id: 's72', station_code: 'TCR', station_name: 'Thrissur', state: 'Kerala' },
    { id: 's73', station_code: 'QLN', station_name: 'Kollam Junction', state: 'Kerala' },
    { id: 's74', station_code: 'PGT', station_name: 'Palakkad Junction', state: 'Kerala' },
    { id: 's75', station_code: 'SRR', station_name: 'Shoranur Junction', state: 'Kerala' },
    { id: 's76', station_code: 'AWY', station_name: 'Aluva', state: 'Kerala' },
    { id: 's77', station_code: 'RU', station_name: 'Renigunta Junction', state: 'Andhra Pradesh' },
    { id: 's78', station_code: 'TPTY', station_name: 'Tirupati', state: 'Andhra Pradesh' },
    { id: 's79', station_code: 'NLR', station_name: 'Nellore', state: 'Andhra Pradesh' },
    { id: 's80', station_code: 'OGL', station_name: 'Ongole', state: 'Andhra Pradesh' },
    { id: 's81', station_code: 'TEL', station_name: 'Tenali Junction', state: 'Andhra Pradesh' },
    { id: 's82', station_code: 'WL', station_name: 'Warangal', state: 'Telangana' },
    { id: 's83', station_code: 'KZJ', station_name: 'Kazipet Junction', state: 'Telangana' },
    { id: 's84', station_code: 'BPQ', station_name: 'Balharshah Junction', state: 'Maharashtra' },
    { id: 's85', station_code: 'SEGM', station_name: 'Sewagram Junction', state: 'Maharashtra' },
    { id: 's86', station_code: 'BSL', station_name: 'Bhusaval Junction', state: 'Maharashtra' },
    { id: 's87', station_code: 'JSG', station_name: 'Jharsuguda Junction', state: 'Odisha' },
    { id: 's88', station_code: 'ROU', station_name: 'Rourkela Junction', state: 'Odisha' },
    { id: 's89', station_code: 'CTC', station_name: 'Cuttack', state: 'Odisha' },
    { id: 's90', station_code: 'BAM', station_name: 'Brahmapur', state: 'Odisha' },
    { id: 's91', station_code: 'VZM', station_name: 'Vizianagaram Junction', state: 'Andhra Pradesh' },
    { id: 's92', station_code: 'RJY', station_name: 'Rajahmundry', state: 'Andhra Pradesh' },
    { id: 's93', station_code: 'SPJ', station_name: 'Samastipur Junction', state: 'Bihar' },
    { id: 's94', station_code: 'DBG', station_name: 'Darbhanga Junction', state: 'Bihar' },
    { id: 's95', station_code: 'GD', station_name: 'Gonda Junction', state: 'Uttar Pradesh' },
    { id: 's96', station_code: 'DEC', station_name: 'Delhi Cantt', state: 'Delhi' },
    { id: 's97', station_code: 'GNT', station_name: 'Guntur', state: 'Andhra Pradesh' },
    { id: 's98', station_code: 'CCT', station_name: 'Kakinada Town', state: 'Andhra Pradesh' },
    { id: 's99', station_code: 'ATP', station_name: 'Anantapur', state: 'Andhra Pradesh' },
    { id: 's100', station_code: 'NHLN', station_name: 'Naharlagun', state: 'Arunachal Pradesh' },
    { id: 's101', station_code: 'DBRG', station_name: 'Dibrugarh', state: 'Assam' },
    { id: 's102', station_code: 'SCL', station_name: 'Silchar', state: 'Assam' },
    { id: 's103', station_code: 'JTTN', station_name: 'Jorhat Town', state: 'Assam' },
    { id: 's104', station_code: 'LMG', station_name: 'Lumding', state: 'Assam' },
    { id: 's105', station_code: 'NTSK', station_name: 'New Tinsukia', state: 'Assam' },
    { id: 's106', station_code: 'BGP', station_name: 'Bhagalpur', state: 'Bihar' },
    { id: 's107', station_code: 'HJP', station_name: 'Hajipur', state: 'Bihar' },
    { id: 's108', station_code: 'DURG', station_name: 'Durg', state: 'Chhattisgarh' },
    { id: 's109', station_code: 'KRBA', station_name: 'Korba', state: 'Chhattisgarh' },
    { id: 's110', station_code: 'RIG', station_name: 'Raigarh', state: 'Chhattisgarh' },
    { id: 's111', station_code: 'MAO', station_name: 'Madgaon', state: 'Goa' },
    { id: 's112', station_code: 'VSG', station_name: 'Vasco-da-Gama', state: 'Goa' },
    { id: 's113', station_code: 'THVM', station_name: 'Thivim', state: 'Goa' },
    { id: 's114', station_code: 'KRMI', station_name: 'Karmali', state: 'Goa' },
    { id: 's115', station_code: 'RJT', station_name: 'Rajkot', state: 'Gujarat' },
    { id: 's116', station_code: 'BVC', station_name: 'Bhavnagar', state: 'Gujarat' },
    { id: 's117', station_code: 'GNC', station_name: 'Gandhinagar', state: 'Gujarat' },
    { id: 's118', station_code: 'JAM', station_name: 'Jamnagar', state: 'Gujarat' },
    { id: 's119', station_code: 'UMB', station_name: 'Ambala Cantt', state: 'Haryana' },
    { id: 's120', station_code: 'PNP', station_name: 'Panipat', state: 'Haryana' },
    { id: 's121', station_code: 'HSR', station_name: 'Hisar', state: 'Haryana' },
    { id: 's122', station_code: 'ROK', station_name: 'Rohtak', state: 'Haryana' },
    { id: 's123', station_code: 'KKDE', station_name: 'Kurukshetra', state: 'Haryana' },
    { id: 's124', station_code: 'SML', station_name: 'Shimla', state: 'Himachal Pradesh' },
    { id: 's125', station_code: 'KLK', station_name: 'Kalka', state: 'Himachal Pradesh' },
    { id: 's126', station_code: 'UHL', station_name: 'Una Himachal', state: 'Himachal Pradesh' },
    { id: 's127', station_code: 'RNC', station_name: 'Ranchi', state: 'Jharkhand' },
    { id: 's128', station_code: 'DHN', station_name: 'Dhanbad', state: 'Jharkhand' },
    { id: 's129', station_code: 'BKSC', station_name: 'Bokaro Steel City', state: 'Jharkhand' },
    { id: 's130', station_code: 'HZBN', station_name: 'Hazaribagh Town', state: 'Jharkhand' },
    { id: 's131', station_code: 'MAQ', station_name: 'Mangaluru Central', state: 'Karnataka' },
    { id: 's132', station_code: 'BGM', station_name: 'Belagavi', state: 'Karnataka' },
    { id: 's133', station_code: 'SMET', station_name: 'Shivamogga', state: 'Karnataka' },
    { id: 's134', station_code: 'CLT', station_name: 'Kozhikode', state: 'Kerala' },
    { id: 's135', station_code: 'KTYM', station_name: 'Kottayam', state: 'Kerala' },
    { id: 's136', station_code: 'CAN', station_name: 'Kannur', state: 'Kerala' },
    { id: 's137', station_code: 'DR', station_name: 'Dadar', state: 'Maharashtra' },
    { id: 's138', station_code: 'NK', station_name: 'Nashik Road', state: 'Maharashtra' },
    { id: 's139', station_code: 'AWB', station_name: 'Aurangabad', state: 'Maharashtra' },
    { id: 's140', station_code: 'JBM', station_name: 'Jiribam', state: 'Manipur' },
    { id: 's141', station_code: 'MNDP', station_name: 'Mendipathar', state: 'Meghalaya' },
    { id: 's142', station_code: 'BHRB', station_name: 'Bairabi', state: 'Mizoram' },
    { id: 's143', station_code: 'DMV', station_name: 'Dimapur', state: 'Nagaland' },
    { id: 's144', station_code: 'PURI', station_name: 'Puri', state: 'Odisha' },
    { id: 's145', station_code: 'SBP', station_name: 'Sambalpur', state: 'Odisha' },
    { id: 's146', station_code: 'BLS', station_name: 'Balasore', state: 'Odisha' },
    { id: 's147', station_code: 'LDH', station_name: 'Ludhiana', state: 'Punjab' },
    { id: 's148', station_code: 'JUC', station_name: 'Jalandhar City', state: 'Punjab' },
    { id: 's149', station_code: 'PTK', station_name: 'Pathankot', state: 'Punjab' },
    { id: 's150', station_code: 'BTI', station_name: 'Bathinda', state: 'Punjab' },
    { id: 's151', station_code: 'JU', station_name: 'Jodhpur', state: 'Rajasthan' },
    { id: 's152', station_code: 'UDZ', station_name: 'Udaipur City', state: 'Rajasthan' },
    { id: 's153', station_code: 'AII', station_name: 'Ajmer', state: 'Rajasthan' },
    { id: 's154', station_code: 'BKN', station_name: 'Bikaner', state: 'Rajasthan' },
    { id: 's3', station_code: 'CNB', station_name: 'Kanpur Central', state: 'Uttar Pradesh' },
    { id: 's4', station_code: 'PRYJ', station_name: 'Prayagraj Junction', state: 'Uttar Pradesh' },
    { id: 's5', station_code: 'BSB', station_name: 'Varanasi Junction', state: 'Uttar Pradesh' },
    { id: 's6', station_code: 'HWH', station_name: 'Howrah Junction', state: 'West Bengal' },
    { id: 's7', station_code: 'KOTA', station_name: 'Kota Junction', state: 'Rajasthan' },
    { id: 's8', station_code: 'RTM', station_name: 'Ratlam Junction', state: 'Madhya Pradesh' },
    { id: 's9', station_code: 'BRC', station_name: 'Vadodara Junction', state: 'Gujarat' },
    { id: 's10', station_code: 'BPL', station_name: 'Bhopal Junction', state: 'Madhya Pradesh' },
    { id: 's11', station_code: 'AGC', station_name: 'Agra Cantt', state: 'Uttar Pradesh' },
    { id: 's12', station_code: 'GWL', station_name: 'Gwalior Junction', state: 'Madhya Pradesh' },
    { id: 's13', station_code: 'VGLJ', station_name: 'VGL Jhansi Junction', state: 'Uttar Pradesh' },
    { id: 's14', station_code: 'NZM', station_name: 'Hazrat Nizamuddin', state: 'Delhi' },
    { id: 's165', station_code: 'MAS', station_name: 'MGR Chennai Central', state: 'Tamil Nadu' },
    { id: 's166', station_code: 'SBC', station_name: 'KSR Bengaluru City', state: 'Karnataka' },
    { id: 's167', station_code: 'DGR', station_name: 'Durgapur', state: 'West Bengal' },
    { id: 's168', station_code: 'ASN', station_name: 'Asansol', state: 'West Bengal' },
    { id: 's169', station_code: 'NZM', station_name: 'Hazrat Nizamuddin', state: 'Unknown' },
    { id: 's170', station_code: 'TBM', station_name: 'Tambaram', state: 'Unknown' },
    { id: 's171', station_code: 'BNC', station_name: 'Bengaluru Cantonment', state: 'Unknown' },
    { id: 's172', station_code: 'UD', station_name: 'Udupi', state: 'Karnataka' }
  ];
  stationsData.forEach(s => mockDb.stations.set(s.id, s));

  // Seed default registered passenger profiles
  const seededPassengers = [
    { id: 'usr-1', full_name: 'Ramesh Kumar', email: 'ramesh.kumar@gmail.com', phone: '+91 9876543210', role: 'passenger', age: 42, gender: 'Male', document_type: 'Aadhaar Card', document_number: '4829-1092-4921', document_url: 'aadhaar_ramesh.pdf', verified: true, created_at: '2023-01-12T10:00:00Z' },
    { id: 'usr-2', full_name: 'Suresh Patel', email: 'suresh.patel@yahoo.com', phone: '+91 8765432109', role: 'passenger', age: 48, gender: 'Male', document_type: 'Passport', document_number: 'Z8901234', document_url: 'passport_suresh.pdf', verified: false, created_at: '2023-08-20T14:30:00Z' },
    { id: 'usr-3', full_name: 'Anita Sharma', email: 'anita.sharma@gmail.com', phone: '+91 7654321098', role: 'passenger', age: 34, gender: 'Female', document_type: 'PAN Card', document_number: 'ABCDE1234F', document_url: 'pan_anita.pdf', verified: true, created_at: '2023-03-04T09:15:00Z' },
    { id: 'usr-4', full_name: 'Vikram Singh', email: 'vikram.singh@outlook.com', phone: '+91 6543210987', role: 'passenger', age: 29, gender: 'Male', document_type: 'Aadhaar Card', document_number: '9921-8812-3341', document_url: 'aadhaar_vikram.pdf', verified: true, created_at: '2023-10-10T11:20:00Z' },
    { id: 'usr-5', full_name: 'Neha Gupta', email: 'neha.gupta@gmail.com', phone: '+91 5432109876', role: 'passenger', age: 31, gender: 'Female', document_type: 'Passport', document_number: 'K9910293', document_url: null, verified: false, created_at: '2024-01-14T16:45:00Z' },
    { id: 'usr-6', full_name: 'Priya Sharma', email: 'priya.sharma@domain.com', phone: '+91 9123456780', role: 'passenger', age: 36, gender: 'Female', document_type: 'Aadhaar Card', document_number: '8821-3910-1029', document_url: 'aadhaar_priya.pdf', verified: true, created_at: '2023-06-01T08:00:00Z' }
  ];
  seededPassengers.forEach(p => mockDb.profiles.set(p.id, p));

  // Seed default Authorized Catering Companies
  const defaultCompanies = [
    {
      id: 'comp-1',
      company_name: 'IRCTC Executive Pantry',
      legal_name: 'Indian Railway Catering and Tourism Corp. Ltd.',
      contact_name: 'Rajesh Sharma',
      phone: '+91 9811002233',
      email: 'pantry@irctc.co.in',
      fssai_number: '10019011000234',
      address: 'IRCTC Corporate Office, Connaught Place, New Delhi',
      status: 'AUTHORIZED',
      authorization_start: '2025-01-01T00:00:00.000Z',
      authorization_end: '2027-12-31T23:59:59.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      stations: ['NDLS', 'DLI', 'NZM', 'CNB', 'AGC', 'JP']
    },
    {
      id: 'comp-2',
      company_name: 'MP Rail Catering Services',
      legal_name: 'Madhya Pradesh Gourmet Rail Foods Pvt Ltd',
      contact_name: 'Vikram Chouhan',
      phone: '+91 9425012345',
      email: 'support@mprailcatering.com',
      fssai_number: '11521004000891',
      address: 'Zone-1, MP Nagar, Bhopal, MP',
      status: 'AUTHORIZED',
      authorization_start: '2025-01-01T00:00:00.000Z',
      authorization_end: '2027-12-31T23:59:59.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      stations: ['BPL', 'GWL', 'VGLJ', 'ET', 'RTM', 'UJN', 'INDB']
    },
    {
      id: 'comp-3',
      company_name: 'Varanasi Satvik Kitchen',
      legal_name: 'Kashi Satvik Foods & Hospitality',
      contact_name: 'Pt. Rameshwar Mishra',
      phone: '+91 9935098765',
      email: 'orders@satvikkitchen.in',
      fssai_number: '12720002000512',
      address: 'Lanka Crossing, Varanasi, UP',
      status: 'AUTHORIZED',
      authorization_start: '2025-01-01T00:00:00.000Z',
      authorization_end: '2027-12-31T23:59:59.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      stations: ['BSB', 'PRYJ', 'DDU', 'LKO', 'GKP']
    },
    {
      id: 'comp-4',
      company_name: 'Coastal Rail Foods',
      legal_name: 'Malabar & Karavali Express Catering Pvt Ltd',
      contact_name: 'K. V. Shetty',
      phone: '+91 9845033445',
      email: 'contact@coastalrailfoods.com',
      fssai_number: '11222005000109',
      address: 'Kodialbail, Mangaluru, Karnataka',
      status: 'AUTHORIZED',
      authorization_start: '2025-01-01T00:00:00.000Z',
      authorization_end: '2027-12-31T23:59:59.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      stations: ['MAQ', 'UD', 'MAO', 'ERS', 'SBC', 'CLT', 'CAN']
    },
    {
      id: 'comp-5',
      company_name: 'Western Gourmet Express',
      legal_name: 'Gujarat & Maharashtra Express Feasts LLP',
      contact_name: 'Anil Patel',
      phone: '+91 9825088776',
      email: 'info@westerngourmet.in',
      fssai_number: '10821009000341',
      address: 'Alkapuri, Vadodara, Gujarat',
      status: 'AUTHORIZED',
      authorization_start: '2025-01-01T00:00:00.000Z',
      authorization_end: '2027-12-31T23:59:59.000Z',
      created_at: '2025-01-01T00:00:00.000Z',
      stations: ['MMCT', 'BDTS', 'ST', 'BRC', 'ADI', 'PUNE', 'KOTA']
    }
  ];

  defaultCompanies.forEach(c => {
    mockDb.catering_companies.set(c.id, c);
    (c.stations || []).forEach(stCode => {
      mockDb.company_stations.set(`${c.id}_${stCode}`, { company_id: c.id, station_code: stCode });
    });
  });
}

function fixDummyBookingOwnership() {
  const dedicatedDemoUserId = 'usr-demo-test-account';
  if (!mockDb.profiles.has(dedicatedDemoUserId)) {
    mockDb.profiles.set(dedicatedDemoUserId, {
      id: dedicatedDemoUserId,
      full_name: 'DEMO PASSENGER',
      email: 'demo@railcontrol.test',
      phone: '+91 9999999999',
      role: 'passenger',
      age: 34,
      gender: 'Male',
      created_at: '2023-01-01T00:00:00Z'
    });
  }

  const knownDummyIds = new Set(['bk-seed-upcoming', 'bk-seed-completed', 'bk-seed-cancelled', 'bk-seed-1', 'bk-seed-2', 'bk-seed-3']);
  const knownDummyPnrs = new Set(['8819203941', '7462573954', '9842105731', '2345678901']);
  let updated = false;

  for (const [id, booking] of mockDb.bookings.entries()) {
    if (!booking) continue;
    const isKnownDummy = knownDummyIds.has(id) || (booking.pnr_number && knownDummyPnrs.has(booking.pnr_number)) || String(id).startsWith('bk-seed-');
    if (isKnownDummy) {
      if (booking.passenger_id !== dedicatedDemoUserId) {
        booking.passenger_id = dedicatedDemoUserId;
        mockDb.bookings.set(id, booking);
        updated = true;
      }
    }
  }

  if (updated) {
    saveMockDbToFile();
  }
}

function ensureDummyBookingsExist() {
  const defaultTrainId = 't-co0fa2xs2';
  const dedicatedDemoUserId = 'usr-demo-test-account';
  const tomorrowDateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const dummyBookings = [
    {
      id: 'bk-seed-1a',
      pnr_number: '1122334455',
      passenger_id: dedicatedDemoUserId,
      passenger_name: 'DEMO PASSENGER',
      train_id: defaultTrainId,
      train_name: 'New Delhi Tejas Rajdhani',
      train_number: '12952',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      from_station_code: 'NDLS',
      to_station_code: 'MMCT',
      coach_class: '1A',
      coach_number: 'H1',
      seat_number: 4,
      total_fare: 4850,
      status: 'confirmed',
      payment_status: 'PAID',
      travel_date: tomorrowDateStr,
      created_at: new Date().toISOString(),
      allocations: [
        {
          id: 'alloc-seed-1a',
          booking_id: 'bk-seed-1a',
          coach_number: 'H1',
          seat_number: 4,
          berth_type: 'LB',
          passenger_name: 'DEMO PASSENGER',
          passenger_age: 34,
          passenger_gender: 'Male'
        }
      ]
    },
    {
      id: 'bk-seed-upcoming',
      pnr_number: '8819203941',
      passenger_id: dedicatedDemoUserId,
      passenger_name: 'DEMO PASSENGER',
      train_id: defaultTrainId,
      train_name: 'Udupi Express',
      train_number: '12345',
      source_station_code: 'NDLS',
      destination_station_code: 'MMCT',
      coach_class: '3A',
      coach_number: 'B1',
      seat_number: 24,
      total_fare: 1450,
      status: 'confirmed',
      payment_status: 'PAID',
      travel_date: tomorrowDateStr,
      created_at: new Date().toISOString(),
      allocations: [
        {
          id: 'alloc-seed-upcoming',
          booking_id: 'bk-seed-upcoming',
          coach_number: 'B1',
          seat_number: 24,
          berth_type: 'UB',
          passenger_name: 'DEMO PASSENGER',
          passenger_age: 34,
          passenger_gender: 'Male'
        }
      ]
    },
    {
      id: 'bk-seed-completed',
      pnr_number: '7462573954',
      passenger_id: dedicatedDemoUserId,
      train_id: defaultTrainId,
      coach_class: 'CC',
      total_fare: 1120,
      status: 'completed',
      travel_date: '2026-07-20',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(),
      completed_at: '2026-07-21T08:15:00.000Z',
      allocations: [
        {
          id: 'alloc-seed-completed',
          booking_id: 'bk-seed-completed',
          coach_number: 'C1',
          seat_number: 12,
          berth_type: 'WINDOW',
          passenger_name: 'DEMO PASSENGER',
          passenger_age: 34,
          passenger_gender: 'Male'
        }
      ]
    },
    {
      id: 'bk-seed-cancelled',
      pnr_number: '9842105731',
      passenger_id: dedicatedDemoUserId,
      train_id: 'train-udupi-12345',
      coach_class: '3A',
      total_fare: 1680,
      status: 'cancelled',
      travel_date: '2026-07-25',
      cancellation_date_time: '2026-07-22T10:15:00.000Z',
      cancellation_reason: 'Passenger requested cancellation',
      refund_status: 'REFUNDED',
      refund_amount: 1680,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      allocations: [
        {
          id: 'alloc-seed-cancelled',
          booking_id: 'bk-seed-cancelled',
          coach_number: 'B2',
          seat_number: 15,
          berth_type: 'SL',
          passenger_name: 'DEMO PASSENGER',
          passenger_age: 34,
          passenger_gender: 'Male'
        }
      ]
    }
  ];

  let addedCount = 0;
  dummyBookings.forEach(b => {
    if (!mockDb.bookings.has(b.id)) {
      const { allocations, ...bookingData } = b;
      mockDb.bookings.set(b.id, bookingData);
      addedCount++;
      (allocations || []).forEach(alloc => {
        mockDb.seat_allocations.set(alloc.id, alloc);
      });
      mockDb.payments.set(`pay-${b.id}`, {
        id: `pay-${b.id}`,
        booking_id: b.id,
        amount: b.total_fare,
        payment_method: 'UPI',
        status: b.status === 'cancelled' ? 'REFUNDED' : 'SUCCESS'
      });

      if (b.status === 'cancelled') {
        const train = mockDb.trains.get(b.train_id);
        mockDb.cancellation_records.set(b.id, {
          id: `canc-${b.id}`,
          booking_id: b.id,
          pnr: b.pnr_number,
          passenger_id: b.passenger_id,
          train_id: b.train_id,
          train_number: train ? train.train_number : '12952',
          train_name: train ? train.train_name : 'Udupi Express',
          journey_date: b.travel_date,
          original_fare: b.total_fare,
          deduction_amount: 0,
          refund_amount: b.total_fare,
          refund_status: 'REFUNDED',
          cancellation_reason: b.cancellation_reason || 'Passenger requested cancellation',
          cancellation_type: 'passenger',
          cancelled_by_user_id: b.passenger_id,
          cancelled_by_role: 'passenger',
          cancellation_date_time: b.cancellation_date_time || new Date().toISOString(),
          created_at: b.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  });

  // Ensure all existing cancelled bookings in mockDb have corresponding cancellation_records
  for (const b of mockDb.bookings.values()) {
    if (b.status === 'cancelled' && !mockDb.cancellation_records.has(b.id)) {
      const train = mockDb.trains.get(b.train_id);
      mockDb.cancellation_records.set(b.id, {
        id: `canc-${b.id}`,
        booking_id: b.id,
        pnr: b.pnr_number,
        passenger_id: b.passenger_id,
        train_id: b.train_id,
        train_number: train ? train.train_number : '12345',
        train_name: train ? train.train_name : 'Express Special',
        journey_date: b.travel_date,
        original_fare: b.total_fare || 1000,
        deduction_amount: b.penalty_amount !== undefined ? b.penalty_amount : 240,
        refund_amount: b.refund_amount !== undefined ? b.refund_amount : Math.max(0, (b.total_fare || 1000) - 240),
        refund_status: b.refund_status || 'APPROVED',
        cancellation_reason: b.cancellation_reason || 'Passenger requested cancellation',
        cancellation_type: 'passenger',
        cancelled_by_user_id: b.passenger_id,
        cancelled_by_role: 'passenger',
        cancellation_date_time: b.cancellation_date_time || b.created_at || new Date().toISOString(),
        created_at: b.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
    saveMockDbToFile();
  }
}

const REAL_INDIAN_PASSENGER_NAMES = [
  'Rahul Sharma', 'Vikram Patel', 'Anita Desai', 'Suresh Verma', 'Priya Singh',
  'Amit Kumar', 'Deepak Joshi', 'Ramesh Kumar', 'Meena Gupta', 'Sunil Yadav',
  'Kavita Rao', 'Rajesh Mishra', 'Pooja Reddy', 'Sanjay Nair', 'Neha Kapoor',
  'Mahesh Kulkarni', 'Sushanth Rao', 'Rohan Gupta', 'Aarti Saxena', 'Karan Malhotra',
  'Rohit Sharma', 'Alok Verma', 'Nisha Joshi', 'Vikas Pandey', 'Divya Iyer'
];

function getDeterministicRealName(keySeed) {
  const str = String(keySeed || 'default');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % REAL_INDIAN_PASSENGER_NAMES.length;
  }
  return REAL_INDIAN_PASSENGER_NAMES[Math.abs(hash) % REAL_INDIAN_PASSENGER_NAMES.length];
}

const STANDARD_STATION_NAMES = {
  'NDLS': 'New Delhi',
  'MMCT': 'Mumbai Central',
  'CSMT': 'Chhatrapati Shivaji Maharaj Terminus',
  'HWH': 'Howrah Junction',
  'SBC': 'KSR Bengaluru City',
  'MAS': 'MGR Chennai Central',
  'ADI': 'Ahmedabad Junction',
  'PNBE': 'Patna Junction',
  'JP': 'Jaipur Junction',
  'HYB': 'Hyderabad Deccan Nampally',
  'SC': 'Secunderabad Junction',
  'CNB': 'Kanpur Central',
  'BSB': 'Varanasi Junction',
  'LKO': 'Lucknow Charbagh NR',
  'CBE': 'Coimbatore Junction',
  'TVC': 'Thiruvananthapuram Central',
  'GHY': 'Guwahati Junction',
  'BPL': 'Bhopal Junction',
  'PUNE': 'Pune Junction',
  'NGP': 'Nagpur Junction',
  'BBS': 'Bhubaneswar',
  'VSKP': 'Visakhapatnam Junction',
  'BZA': 'Vijayawada Junction',
  'BDTS': 'Bandra Terminus',
  'ERS': 'Ernakulam Junction',
  'AGC': 'Agra Cantt',
  'VGLJ': 'VGL Jhansi Junction',
  'KOTA': 'Kota Junction',
  'RTM': 'Ratlam Junction',
  'BRC': 'Vadodara Junction',
  'DDU': 'Pt. Deen Dayal Upadhyaya Junction',
  'ST': 'Surat',
  'MYS': 'Mysuru Junction',
  'MAQ': 'Mangaluru Central',
  'MAO': 'Madgaon Junction',
  'UD': 'Udupi',
  'UDU': 'Udupi',
  'ASN': 'Asansol Junction',
  'DHN': 'Dhanbad Junction',
  'GAYA': 'Gaya Junction',
  'PRYJ': 'Prayagraj Junction',
  'NZM': 'Hazrat Nizamuddin',
  'VAPI': 'Vapi',
  'MTJ': 'Mathura Junction',
  'KAWR': 'Karwar',
  'KPD': 'Katpadi Junction',
  'BNC': 'Bengaluru Cantt',
  'JTJ': 'Jolarpettai Junction',
  'TUP': 'Tiruppur',
  'ED': 'Erode Junction',
  'SA': 'Salem Junction',
  'HSRA': 'Hosur',
  'BSR': 'Vasai Road',
  'CLT': 'Kozhikode',
  'SL': 'Surathkal',
  'MAJN': 'Mangaluru Junction',
  'HAS': 'Hassan Junction',
  'YPR': 'Yesvantpur Junction',
  'RN': 'Ratnagiri',
  'PNVL': 'Panvel',
  'TNA': 'Thane'
};

function buildStraightUdupiToDelhiStops(originDepTime = '06:15:00') {
  const parseMins = (t) => {
    const p = String(t || '06:15:00').trim().split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  };
  const formatMins = (totalMins) => {
    const mins = totalMins % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  const startMins = parseMins(originDepTime);
  const corridorTemplate = [
    { code: 'UD', name: 'Udupi', offsetMins: 0, haltMins: 0, distKm: 0 },
    { code: 'KAWR', name: 'Karwar', offsetMins: 145, haltMins: 2, distKm: 190 },
    { code: 'MAO', name: 'Madgaon Junction', offsetMins: 210, haltMins: 10, distKm: 250 },
    { code: 'RN', name: 'Ratnagiri', offsetMins: 435, haltMins: 5, distKm: 530 },
    { code: 'PNVL', name: 'Panvel', offsetMins: 720, haltMins: 5, distKm: 810 },
    { code: 'BSR', name: 'Vasai Road', offsetMins: 790, haltMins: 5, distKm: 860 },
    { code: 'ST', name: 'Surat', offsetMins: 990, haltMins: 5, distKm: 1123 },
    { code: 'BRC', name: 'Vadodara Junction', offsetMins: 1085, haltMins: 10, distKm: 1253 },
    { code: 'RTM', name: 'Ratlam Junction', offsetMins: 1285, haltMins: 5, distKm: 1513 },
    { code: 'KOTA', name: 'Kota Junction', offsetMins: 1475, haltMins: 10, distKm: 1780 },
    { code: 'MTJ', name: 'Mathura Junction', offsetMins: 1700, haltMins: 2, distKm: 2050 },
    { code: 'NZM', name: 'Hazrat Nizamuddin', offsetMins: 1825, haltMins: 2, distKm: 2188 },
    { code: 'NDLS', name: 'New Delhi', offsetMins: 1860, haltMins: 0, distKm: 2195 }
  ];

  return corridorTemplate.map((c, idx) => {
    const arrTotalMins = startMins + c.offsetMins;
    const depTotalMins = arrTotalMins + c.haltMins;
    const dayOffset = Math.floor(arrTotalMins / (24 * 60));
    return {
      sequence: idx + 1,
      stationCode: c.code,
      stationName: c.name,
      arrTime: idx === 0 ? formatMins(startMins) : formatMins(arrTotalMins),
      depTime: idx === corridorTemplate.length - 1 ? formatMins(arrTotalMins) : formatMins(depTotalMins),
      haltMinutes: String(c.haltMins),
      distanceFromOriginKm: c.distKm,
      day_offset: dayOffset
    };
  });
}

function buildStraightDelhiToUdupiStops(originDepTime = '14:00:00') {
  const parseMins = (t) => {
    const p = String(t || '14:00:00').trim().split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  };
  const formatMins = (totalMins) => {
    const mins = totalMins % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  const startMins = parseMins(originDepTime);
  const corridorTemplate = [
    { code: 'NDLS', name: 'New Delhi', offsetMins: 0, haltMins: 0, distKm: 0 },
    { code: 'NZM', name: 'Hazrat Nizamuddin', offsetMins: 25, haltMins: 2, distKm: 7 },
    { code: 'MTJ', name: 'Mathura Junction', offsetMins: 140, haltMins: 2, distKm: 145 },
    { code: 'KOTA', name: 'Kota Junction', offsetMins: 385, haltMins: 10, distKm: 415 },
    { code: 'RTM', name: 'Ratlam Junction', offsetMins: 575, haltMins: 5, distKm: 682 },
    { code: 'BRC', name: 'Vadodara Junction', offsetMins: 775, haltMins: 10, distKm: 942 },
    { code: 'ST', name: 'Surat', offsetMins: 870, haltMins: 5, distKm: 1072 },
    { code: 'BSR', name: 'Vasai Road', offsetMins: 1070, haltMins: 5, distKm: 1335 },
    { code: 'PNVL', name: 'Panvel', offsetMins: 1140, haltMins: 5, distKm: 1385 },
    { code: 'RN', name: 'Ratnagiri', offsetMins: 1425, haltMins: 5, distKm: 1665 },
    { code: 'MAO', name: 'Madgaon Junction', offsetMins: 1650, haltMins: 10, distKm: 1945 },
    { code: 'KAWR', name: 'Karwar', offsetMins: 1715, haltMins: 2, distKm: 2005 },
    { code: 'UD', name: 'Udupi', offsetMins: 1860, haltMins: 0, distKm: 2195 }
  ];

  return corridorTemplate.map((c, idx) => {
    const arrTotalMins = startMins + c.offsetMins;
    const depTotalMins = arrTotalMins + c.haltMins;
    const dayOffset = Math.floor(arrTotalMins / (24 * 60));
    return {
      sequence: idx + 1,
      stationCode: c.code,
      stationName: c.name,
      arrTime: idx === 0 ? formatMins(startMins) : formatMins(arrTotalMins),
      depTime: idx === corridorTemplate.length - 1 ? formatMins(arrTotalMins) : formatMins(depTotalMins),
      haltMinutes: String(c.haltMins),
      distanceFromOriginKm: c.distKm,
      day_offset: dayOffset
    };
  });
}

const KNOWN_CORRIDOR_STOPS = {
  '12345': buildStraightUdupiToDelhiStops('06:15:00'),
  '99051': [
    { sequence: 1, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '04:00:00', depTime: '04:00:00', day: 1, day_offset: 0, haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BVI', stationName: 'Borivali', arrTime: '04:32:00', depTime: '04:35:00', day: 1, day_offset: 0, haltMinutes: '3', distanceFromOriginKm: 30 },
    { sequence: 3, stationCode: 'ST', stationName: 'Surat', arrTime: '07:15:00', depTime: '07:20:00', day: 1, day_offset: 0, haltMinutes: '5', distanceFromOriginKm: 263 },
    { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '08:55:00', depTime: '09:05:00', day: 1, day_offset: 0, haltMinutes: '10', distanceFromOriginKm: 393 },
    { sequence: 5, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '12:45:00', depTime: '12:55:00', day: 1, day_offset: 0, haltMinutes: '10', distanceFromOriginKm: 653 },
    { sequence: 6, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '16:35:00', depTime: '16:45:00', day: 1, day_offset: 0, haltMinutes: '10', distanceFromOriginKm: 920 },
    { sequence: 7, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '23:30:00', depTime: '23:30:00', day: 1, day_offset: 0, haltMinutes: '0', distanceFromOriginKm: 1386 }
  ],
  '12951': [
    { sequence: 1, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '17:00:00', depTime: '17:00:00', day: 1, day_offset: 0, haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'ST', stationName: 'Surat', arrTime: '19:38:00', depTime: '19:43:00', day: 1, day_offset: 0, haltMinutes: '5', distanceFromOriginKm: 263 },
    { sequence: 3, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '21:18:00', depTime: '21:28:00', day: 1, day_offset: 0, haltMinutes: '10', distanceFromOriginKm: 393 },
    { sequence: 4, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '00:25:00', depTime: '00:30:00', day: 2, day_offset: 1, haltMinutes: '5', distanceFromOriginKm: 653 },
    { sequence: 5, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '03:15:00', depTime: '03:25:00', day: 2, day_offset: 1, haltMinutes: '10', distanceFromOriginKm: 920 },
    { sequence: 6, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '08:32:00', depTime: '08:32:00', day: 2, day_offset: 1, haltMinutes: '0', distanceFromOriginKm: 1386 }
  ],
  '12952': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '16:55:00', depTime: '16:55:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '21:30:00', depTime: '21:40:00', haltMinutes: '10', distanceFromOriginKm: 466 },
    { sequence: 3, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '00:35:00', depTime: '00:40:00', haltMinutes: '5', distanceFromOriginKm: 733 },
    { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '03:40:00', depTime: '03:50:00', haltMinutes: '10', distanceFromOriginKm: 993 },
    { sequence: 5, stationCode: 'ST', stationName: 'Surat', arrTime: '05:13:00', depTime: '05:18:00', haltMinutes: '5', distanceFromOriginKm: 1123 },
    { sequence: 6, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '08:35:00', depTime: '08:35:00', haltMinutes: '0', distanceFromOriginKm: 1386 }
  ],
  '12954': [
    { sequence: 1, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '17:10:00', depTime: '17:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VAPI', stationName: 'Vapi', arrTime: '19:04:00', depTime: '19:06:00', haltMinutes: '2', distanceFromOriginKm: 168 },
    { sequence: 3, stationCode: 'ST', stationName: 'Surat', arrTime: '19:55:00', depTime: '20:00:00', haltMinutes: '5', distanceFromOriginKm: 263 },
    { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '21:34:00', depTime: '21:44:00', haltMinutes: '10', distanceFromOriginKm: 393 },
    { sequence: 5, stationCode: 'RTM', stationName: 'Ratlam Junction', arrTime: '00:48:00', depTime: '00:53:00', haltMinutes: '5', distanceFromOriginKm: 653 },
    { sequence: 6, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '03:45:00', depTime: '03:55:00', haltMinutes: '10', distanceFromOriginKm: 920 },
    { sequence: 7, stationCode: 'MTJ', stationName: 'Mathura Junction', arrTime: '07:28:00', depTime: '07:30:00', haltMinutes: '2', distanceFromOriginKm: 1244 },
    { sequence: 8, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '09:43:00', depTime: '09:43:00', haltMinutes: '0', distanceFromOriginKm: 1377 }
  ],
  '12301': [
    { sequence: 1, stationCode: 'HWH', stationName: 'Howrah Junction', arrTime: '16:50:00', depTime: '16:50:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'ASN', stationName: 'Asansol Junction', arrTime: '18:57:00', depTime: '18:59:00', haltMinutes: '2', distanceFromOriginKm: 200 },
    { sequence: 3, stationCode: 'DHN', stationName: 'Dhanbad Junction', arrTime: '19:55:00', depTime: '20:00:00', haltMinutes: '5', distanceFromOriginKm: 259 },
    { sequence: 4, stationCode: 'GAYA', stationName: 'Gaya Junction', arrTime: '22:31:00', depTime: '22:34:00', haltMinutes: '3', distanceFromOriginKm: 459 },
    { sequence: 5, stationCode: 'DDU', stationName: 'Pt. Deen Dayal Upadhyaya Junction', arrTime: '00:45:00', depTime: '00:55:00', haltMinutes: '10', distanceFromOriginKm: 664 },
    { sequence: 6, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '02:43:00', depTime: '02:45:00', haltMinutes: '2', distanceFromOriginKm: 817 },
    { sequence: 7, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '04:50:00', depTime: '04:55:00', haltMinutes: '5', distanceFromOriginKm: 1011 },
    { sequence: 8, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '10:05:00', depTime: '10:05:00', haltMinutes: '0', distanceFromOriginKm: 1447 }
  ],
  '12001': [
    { sequence: 1, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '15:15:00', depTime: '15:15:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '18:40:00', depTime: '18:45:00', haltMinutes: '5', distanceFromOriginKm: 292 },
    { sequence: 3, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '19:40:00', depTime: '19:45:00', haltMinutes: '5', distanceFromOriginKm: 389 },
    { sequence: 4, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '21:10:00', depTime: '21:15:00', haltMinutes: '5', distanceFromOriginKm: 507 },
    { sequence: 5, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '23:30:00', depTime: '23:30:00', haltMinutes: '0', distanceFromOriginKm: 708 }
  ],
  '12002': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '07:50:00', depTime: '07:55:00', haltMinutes: '5', distanceFromOriginKm: 201 },
    { sequence: 3, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '09:23:00', depTime: '09:28:00', haltMinutes: '5', distanceFromOriginKm: 319 },
    { sequence: 4, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '10:45:00', depTime: '10:50:00', haltMinutes: '5', distanceFromOriginKm: 416 },
    { sequence: 5, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '14:10:00', depTime: '14:10:00', haltMinutes: '0', distanceFromOriginKm: 708 }
  ],
  '22436': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '10:08:00', depTime: '10:10:00', haltMinutes: '2', distanceFromOriginKm: 440 },
    { sequence: 3, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '12:08:00', depTime: '12:10:00', haltMinutes: '2', distanceFromOriginKm: 634 },
    { sequence: 4, stationCode: 'BSB', stationName: 'Varanasi Junction', arrTime: '14:00:00', depTime: '14:00:00', haltMinutes: '0', distanceFromOriginKm: 757 }
  ],
  '22435': [
    { sequence: 1, stationCode: 'BSB', stationName: 'Varanasi Junction', arrTime: '15:00:00', depTime: '15:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '16:30:00', depTime: '16:32:00', haltMinutes: '2', distanceFromOriginKm: 123 },
    { sequence: 3, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '18:30:00', depTime: '18:32:00', haltMinutes: '2', distanceFromOriginKm: 317 },
    { sequence: 4, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '23:00:00', depTime: '23:00:00', haltMinutes: '0', distanceFromOriginKm: 757 }
  ],
  '20646': [
    { sequence: 1, stationCode: 'MAQ', stationName: 'Mangaluru Central', arrTime: '08:30:00', depTime: '08:30:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'UD', stationName: 'Udupi', arrTime: '09:38:00', depTime: '09:40:00', haltMinutes: '2', distanceFromOriginKm: 68 },
    { sequence: 3, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '11:44:00', depTime: '11:46:00', haltMinutes: '2', distanceFromOriginKm: 258 },
    { sequence: 4, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '13:15:00', depTime: '13:15:00', haltMinutes: '0', distanceFromOriginKm: 318 }
  ],
  '20645': [
    { sequence: 1, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '18:10:00', depTime: '18:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '19:10:00', depTime: '19:12:00', haltMinutes: '2', distanceFromOriginKm: 60 },
    { sequence: 3, stationCode: 'UD', stationName: 'Udupi', arrTime: '21:18:00', depTime: '21:20:00', haltMinutes: '2', distanceFromOriginKm: 250 },
    { sequence: 4, stationCode: 'MAQ', stationName: 'Mangaluru Central', arrTime: '22:45:00', depTime: '22:45:00', haltMinutes: '0', distanceFromOriginKm: 318 }
  ],
  '20608': [
    { sequence: 1, stationCode: 'MYS', stationName: 'Mysuru Junction', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '07:45:00', depTime: '07:50:00', haltMinutes: '5', distanceFromOriginKm: 138 },
    { sequence: 3, stationCode: 'KPD', stationName: 'Katpadi Junction', arrTime: '10:33:00', depTime: '10:35:00', haltMinutes: '2', distanceFromOriginKm: 367 },
    { sequence: 4, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '12:25:00', depTime: '12:25:00', haltMinutes: '0', distanceFromOriginKm: 500 }
  ],
  '20642': [
    { sequence: 1, stationCode: 'CBE', stationName: 'Coimbatore Junction', arrTime: '05:00:00', depTime: '05:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'TUP', stationName: 'Tiruppur', arrTime: '05:38:00', depTime: '05:40:00', haltMinutes: '2', distanceFromOriginKm: 50 },
    { sequence: 3, stationCode: 'ED', stationName: 'Erode Junction', arrTime: '06:25:00', depTime: '06:30:00', haltMinutes: '5', distanceFromOriginKm: 100 },
    { sequence: 4, stationCode: 'SA', stationName: 'Salem Junction', arrTime: '07:22:00', depTime: '07:25:00', haltMinutes: '3', distanceFromOriginKm: 160 },
    { sequence: 5, stationCode: 'HSRA', stationName: 'Hosur', arrTime: '09:58:00', depTime: '10:00:00', haltMinutes: '2', distanceFromOriginKm: 335 },
    { sequence: 6, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '11:30:00', depTime: '11:30:00', haltMinutes: '0', distanceFromOriginKm: 375 }
  ],
  '12432': [
    { sequence: 1, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '06:16:00', depTime: '06:16:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KOTA', stationName: 'Kota Junction', arrTime: '11:20:00', depTime: '11:30:00', haltMinutes: '10', distanceFromOriginKm: 458 },
    { sequence: 3, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '18:20:00', depTime: '18:30:00', haltMinutes: '10', distanceFromOriginKm: 986 },
    { sequence: 4, stationCode: 'BSR', stationName: 'Vasai Road', arrTime: '23:45:00', depTime: '23:50:00', haltMinutes: '5', distanceFromOriginKm: 1338 },
    { sequence: 5, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '08:30:00', depTime: '08:40:00', haltMinutes: '10', distanceFromOriginKm: 1906 },
    { sequence: 6, stationCode: 'MAQ', stationName: 'Mangaluru Central', arrTime: '14:00:00', depTime: '14:10:00', haltMinutes: '10', distanceFromOriginKm: 2220 },
    { sequence: 7, stationCode: 'CLT', stationName: 'Kozhikode', arrTime: '16:27:00', depTime: '16:30:00', haltMinutes: '3', distanceFromOriginKm: 2352 },
    { sequence: 8, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '19:15:00', depTime: '19:20:00', haltMinutes: '5', distanceFromOriginKm: 2545 },
    { sequence: 9, stationCode: 'TVC', stationName: 'Thiruvananthapuram Central', arrTime: '23:45:00', depTime: '23:45:00', haltMinutes: '0', distanceFromOriginKm: 2750 }
  ],
  '12008': [
    { sequence: 1, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '16:15:00', depTime: '16:15:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BNC', stationName: 'Bengaluru Cantt', arrTime: '16:25:00', depTime: '16:27:00', haltMinutes: '2', distanceFromOriginKm: 4 },
    { sequence: 3, stationCode: 'JTJ', stationName: 'Jolarpettai Junction', arrTime: '18:43:00', depTime: '18:45:00', haltMinutes: '2', distanceFromOriginKm: 141 },
    { sequence: 4, stationCode: 'KPD', stationName: 'Katpadi Junction', arrTime: '19:53:00', depTime: '19:55:00', haltMinutes: '2', distanceFromOriginKm: 225 },
    { sequence: 5, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '22:00:00', depTime: '22:00:00', haltMinutes: '0', distanceFromOriginKm: 357 }
  ],
  '12050': [
    { sequence: 1, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '08:10:00', depTime: '08:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'MTJ', stationName: 'Mathura Junction', arrTime: '09:30:00', depTime: '09:32:00', haltMinutes: '2', distanceFromOriginKm: 134 },
    { sequence: 3, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '09:50:00', depTime: '09:50:00', haltMinutes: '0', distanceFromOriginKm: 188 }
  ],
  '16596': [
    { sequence: 1, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '18:50:00', depTime: '18:50:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'YPR', stationName: 'Yesvantpur Junction', arrTime: '19:01:00', depTime: '19:03:00', haltMinutes: '2', distanceFromOriginKm: 6 },
    { sequence: 3, stationCode: 'HAS', stationName: 'Hassan Junction', arrTime: '22:20:00', depTime: '22:25:00', haltMinutes: '5', distanceFromOriginKm: 186 },
    { sequence: 4, stationCode: 'MAJN', stationName: 'Mangaluru Junction', arrTime: '03:20:00', depTime: '03:25:00', haltMinutes: '5', distanceFromOriginKm: 350 },
    { sequence: 5, stationCode: 'SL', stationName: 'Surathkal', arrTime: '04:02:00', depTime: '04:04:00', haltMinutes: '2', distanceFromOriginKm: 373 },
    { sequence: 6, stationCode: 'UD', stationName: 'Udupi', arrTime: '04:38:00', depTime: '04:40:00', haltMinutes: '2', distanceFromOriginKm: 414 },
    { sequence: 7, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '07:15:00', depTime: '07:15:00', haltMinutes: '0', distanceFromOriginKm: 600 }
  ],
  '12423': [
    { sequence: 1, stationCode: 'DBRG', stationName: 'Dibrugarh', arrTime: '20:55:00', depTime: '20:55:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'NTSK', stationName: 'New Tinsukia', arrTime: '21:40:00', depTime: '21:50:00', haltMinutes: '10', distanceFromOriginKm: 42 },
    { sequence: 3, stationCode: 'LMG', stationName: 'Lumding', arrTime: '03:10:00', depTime: '03:15:00', haltMinutes: '5', distanceFromOriginKm: 346 },
    { sequence: 4, stationCode: 'GHY', stationName: 'Guwahati', arrTime: '06:45:00', depTime: '07:00:00', haltMinutes: '15', distanceFromOriginKm: 527 },
    { sequence: 5, stationCode: 'BJU', stationName: 'Barauni Junction', arrTime: '17:15:00', depTime: '17:25:00', haltMinutes: '10', distanceFromOriginKm: 1160 },
    { sequence: 6, stationCode: 'CPR', stationName: 'Chhapra Junction', arrTime: '20:40:00', depTime: '20:45:00', haltMinutes: '5', distanceFromOriginKm: 1380 },
    { sequence: 7, stationCode: 'GKP', stationName: 'Gorakhpur Junction', arrTime: '23:25:00', depTime: '23:35:00', haltMinutes: '10', distanceFromOriginKm: 1560 },
    { sequence: 8, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '05:00:00', depTime: '05:05:00', haltMinutes: '5', distanceFromOriginKm: 1990 },
    { sequence: 9, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '10:15:00', depTime: '10:15:00', haltMinutes: '0', distanceFromOriginKm: 2434 }
  ],
  '12424': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '16:20:00', depTime: '16:20:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '21:02:00', depTime: '21:07:00', haltMinutes: '5', distanceFromOriginKm: 444 },
    { sequence: 3, stationCode: 'GKP', stationName: 'Gorakhpur Junction', arrTime: '02:30:00', depTime: '02:40:00', haltMinutes: '10', distanceFromOriginKm: 874 },
    { sequence: 4, stationCode: 'BJU', stationName: 'Barauni Junction', arrTime: '09:20:00', depTime: '09:30:00', haltMinutes: '10', distanceFromOriginKm: 1274 },
    { sequence: 5, stationCode: 'GHY', stationName: 'Guwahati', arrTime: '19:25:00', depTime: '19:40:00', haltMinutes: '15', distanceFromOriginKm: 1907 },
    { sequence: 6, stationCode: 'LMG', stationName: 'Lumding', arrTime: '22:50:00', depTime: '22:55:00', haltMinutes: '5', distanceFromOriginKm: 2088 },
    { sequence: 7, stationCode: 'DBRG', stationName: 'Dibrugarh', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 2434 }
  ],
  '12433': [
    { sequence: 1, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '06:05:00', depTime: '06:05:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '11:40:00', depTime: '11:50:00', haltMinutes: '10', distanceFromOriginKm: 431 },
    { sequence: 3, stationCode: 'WL', stationName: 'Warangal', arrTime: '14:39:00', depTime: '14:40:00', haltMinutes: '1', distanceFromOriginKm: 638 },
    { sequence: 4, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '20:25:00', depTime: '20:30:00', haltMinutes: '5', distanceFromOriginKm: 1094 },
    { sequence: 5, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '02:05:00', depTime: '02:15:00', haltMinutes: '10', distanceFromOriginKm: 1484 },
    { sequence: 6, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '05:30:00', depTime: '05:35:00', haltMinutes: '5', distanceFromOriginKm: 1776 },
    { sequence: 7, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '10:30:00', depTime: '10:30:00', haltMinutes: '0', distanceFromOriginKm: 2175 }
  ],
  '12434': [
    { sequence: 1, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '15:35:00', depTime: '15:35:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '20:25:00', depTime: '20:30:00', haltMinutes: '5', distanceFromOriginKm: 399 },
    { sequence: 3, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '23:30:00', depTime: '23:40:00', haltMinutes: '10', distanceFromOriginKm: 691 },
    { sequence: 4, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '05:05:00', depTime: '05:10:00', haltMinutes: '5', distanceFromOriginKm: 1081 },
    { sequence: 5, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '14:20:00', depTime: '14:30:00', haltMinutes: '10', distanceFromOriginKm: 1744 },
    { sequence: 6, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '20:35:00', depTime: '20:35:00', haltMinutes: '0', distanceFromOriginKm: 2175 }
  ],
  '22691': [
    { sequence: 1, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '20:00:00', depTime: '20:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'RC', stationName: 'Raichur', arrTime: '01:58:00', depTime: '02:00:00', haltMinutes: '2', distanceFromOriginKm: 423 },
    { sequence: 3, stationCode: 'SC', stationName: 'Secunderabad Junction', arrTime: '07:05:00', depTime: '07:15:00', haltMinutes: '10', distanceFromOriginKm: 714 },
    { sequence: 4, stationCode: 'KZJ', stationName: 'Kazipet Junction', arrTime: '08:48:00', depTime: '08:50:00', haltMinutes: '2', distanceFromOriginKm: 846 },
    { sequence: 5, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '14:55:00', depTime: '15:00:00', haltMinutes: '5', distanceFromOriginKm: 1284 },
    { sequence: 6, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '20:50:00', depTime: '21:00:00', haltMinutes: '10', distanceFromOriginKm: 1674 },
    { sequence: 7, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '00:16:00', depTime: '00:21:00', haltMinutes: '5', distanceFromOriginKm: 1966 },
    { sequence: 8, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '05:30:00', depTime: '05:30:00', haltMinutes: '0', distanceFromOriginKm: 2365 }
  ],
  '22692': [
    { sequence: 1, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '19:50:00', depTime: '19:50:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '00:26:00', depTime: '00:31:00', haltMinutes: '5', distanceFromOriginKm: 399 },
    { sequence: 3, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '03:45:00', depTime: '03:55:00', haltMinutes: '10', distanceFromOriginKm: 691 },
    { sequence: 4, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '09:25:00', depTime: '09:30:00', haltMinutes: '5', distanceFromOriginKm: 1081 },
    { sequence: 5, stationCode: 'SC', stationName: 'Secunderabad Junction', arrTime: '17:10:00', depTime: '17:25:00', haltMinutes: '15', distanceFromOriginKm: 1651 },
    { sequence: 6, stationCode: 'RC', stationName: 'Raichur', arrTime: '21:48:00', depTime: '21:50:00', haltMinutes: '2', distanceFromOriginKm: 1942 },
    { sequence: 7, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '05:20:00', depTime: '05:20:00', haltMinutes: '0', distanceFromOriginKm: 2365 }
  ],
  '12437': [
    { sequence: 1, stationCode: 'SC', stationName: 'Secunderabad Junction', arrTime: '12:45:00', depTime: '12:45:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KZJ', stationName: 'Kazipet Junction', arrTime: '14:28:00', depTime: '14:30:00', haltMinutes: '2', distanceFromOriginKm: 132 },
    { sequence: 3, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '20:25:00', depTime: '20:30:00', haltMinutes: '5', distanceFromOriginKm: 570 },
    { sequence: 4, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '02:05:00', depTime: '02:15:00', haltMinutes: '10', distanceFromOriginKm: 960 },
    { sequence: 5, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '05:30:00', depTime: '05:35:00', haltMinutes: '5', distanceFromOriginKm: 1252 },
    { sequence: 6, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '10:30:00', depTime: '10:30:00', haltMinutes: '0', distanceFromOriginKm: 1667 }
  ],
  '12438': [
    { sequence: 1, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '15:35:00', depTime: '15:35:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '20:25:00', depTime: '20:30:00', haltMinutes: '5', distanceFromOriginKm: 415 },
    { sequence: 3, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '23:30:00', depTime: '23:40:00', haltMinutes: '10', distanceFromOriginKm: 707 },
    { sequence: 4, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '05:05:00', depTime: '05:10:00', haltMinutes: '5', distanceFromOriginKm: 1097 },
    { sequence: 5, stationCode: 'KZJ', stationName: 'Kazipet Junction', arrTime: '11:08:00', depTime: '11:10:00', haltMinutes: '2', distanceFromOriginKm: 1535 },
    { sequence: 6, stationCode: 'SC', stationName: 'Secunderabad Junction', arrTime: '13:00:00', depTime: '13:00:00', haltMinutes: '0', distanceFromOriginKm: 1667 }
  ],
  '20839': [
    { sequence: 1, stationCode: 'RNC', stationName: 'Ranchi Junction', arrTime: '18:10:00', depTime: '18:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BKSC', stationName: 'Bokaro Steel City', arrTime: '20:05:00', depTime: '20:10:00', haltMinutes: '5', distanceFromOriginKm: 113 },
    { sequence: 3, stationCode: 'GAYA', stationName: 'Gaya Junction', arrTime: '23:37:00', depTime: '23:40:00', haltMinutes: '3', distanceFromOriginKm: 316 },
    { sequence: 4, stationCode: 'DDU', stationName: 'Pt. Deen Dayal Upadhyaya Junction', arrTime: '01:50:00', depTime: '02:00:00', haltMinutes: '10', distanceFromOriginKm: 521 },
    { sequence: 5, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '03:48:00', depTime: '03:50:00', haltMinutes: '2', distanceFromOriginKm: 674 },
    { sequence: 6, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '05:40:00', depTime: '05:45:00', haltMinutes: '5', distanceFromOriginKm: 868 },
    { sequence: 7, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '11:10:00', depTime: '11:10:00', haltMinutes: '0', distanceFromOriginKm: 1245 }
  ],
  '20840': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '16:10:00', depTime: '16:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '20:52:00', depTime: '20:57:00', haltMinutes: '5', distanceFromOriginKm: 377 },
    { sequence: 3, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '22:58:00', depTime: '23:00:00', haltMinutes: '2', distanceFromOriginKm: 571 },
    { sequence: 4, stationCode: 'DDU', stationName: 'Pt. Deen Dayal Upadhyaya Junction', arrTime: '01:13:00', depTime: '01:23:00', haltMinutes: '10', distanceFromOriginKm: 724 },
    { sequence: 5, stationCode: 'GAYA', stationName: 'Gaya Junction', arrTime: '03:40:00', depTime: '03:43:00', haltMinutes: '3', distanceFromOriginKm: 929 },
    { sequence: 6, stationCode: 'BKSC', stationName: 'Bokaro Steel City', arrTime: '07:05:00', depTime: '07:10:00', haltMinutes: '5', distanceFromOriginKm: 1132 },
    { sequence: 7, stationCode: 'RNC', stationName: 'Ranchi Junction', arrTime: '09:05:00', depTime: '09:05:00', haltMinutes: '0', distanceFromOriginKm: 1245 }
  ],
  '20901': [
    { sequence: 1, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VAPI', stationName: 'Vapi', arrTime: '07:56:00', depTime: '07:58:00', haltMinutes: '2', distanceFromOriginKm: 168 },
    { sequence: 3, stationCode: 'ST', stationName: 'Surat', arrTime: '08:55:00', depTime: '08:58:00', haltMinutes: '3', distanceFromOriginKm: 263 },
    { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '10:13:00', depTime: '10:16:00', haltMinutes: '3', distanceFromOriginKm: 393 },
    { sequence: 5, stationCode: 'ADI', stationName: 'Ahmedabad Junction', arrTime: '11:25:00', depTime: '11:30:00', haltMinutes: '5', distanceFromOriginKm: 493 },
    { sequence: 6, stationCode: 'GNC', stationName: 'Gandhinagar Capital', arrTime: '12:25:00', depTime: '12:25:00', haltMinutes: '0', distanceFromOriginKm: 520 }
  ],
  '20902': [
    { sequence: 1, stationCode: 'GNC', stationName: 'Gandhinagar Capital', arrTime: '14:05:00', depTime: '14:05:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'ADI', stationName: 'Ahmedabad Junction', arrTime: '14:45:00', depTime: '15:00:00', haltMinutes: '15', distanceFromOriginKm: 27 },
    { sequence: 3, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '16:00:00', depTime: '16:05:00', haltMinutes: '5', distanceFromOriginKm: 127 },
    { sequence: 4, stationCode: 'ST', stationName: 'Surat', arrTime: '17:22:00', depTime: '17:25:00', haltMinutes: '3', distanceFromOriginKm: 257 },
    { sequence: 5, stationCode: 'VAPI', stationName: 'Vapi', arrTime: '18:38:00', depTime: '18:40:00', haltMinutes: '2', distanceFromOriginKm: 352 },
    { sequence: 6, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '20:25:00', depTime: '20:25:00', haltMinutes: '0', distanceFromOriginKm: 520 }
  ],
  '22225': [
    { sequence: 1, stationCode: 'CSMT', stationName: 'Chhatrapati Shivaji Maharaj Terminus', arrTime: '16:05:00', depTime: '16:05:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '16:43:00', depTime: '16:45:00', haltMinutes: '2', distanceFromOriginKm: 54 },
    { sequence: 3, stationCode: 'PUNE', stationName: 'Pune Junction', arrTime: '19:10:00', depTime: '19:15:00', haltMinutes: '5', distanceFromOriginKm: 192 },
    { sequence: 4, stationCode: 'SUR', stationName: 'Solapur Junction', arrTime: '22:40:00', depTime: '22:40:00', haltMinutes: '0', distanceFromOriginKm: 452 }
  ],
  '22226': [
    { sequence: 1, stationCode: 'SUR', stationName: 'Solapur Junction', arrTime: '06:05:00', depTime: '06:05:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'PUNE', stationName: 'Pune Junction', arrTime: '09:20:00', depTime: '09:25:00', haltMinutes: '5', distanceFromOriginKm: 260 },
    { sequence: 3, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '11:50:00', depTime: '11:52:00', haltMinutes: '2', distanceFromOriginKm: 398 },
    { sequence: 4, stationCode: 'CSMT', stationName: 'Chhatrapati Shivaji Maharaj Terminus', arrTime: '12:35:00', depTime: '12:35:00', haltMinutes: '0', distanceFromOriginKm: 452 }
  ],
  '22439': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'UMB', stationName: 'Ambala Cantt', arrTime: '08:10:00', depTime: '08:12:00', haltMinutes: '2', distanceFromOriginKm: 198 },
    { sequence: 3, stationCode: 'LDH', stationName: 'Ludhiana Junction', arrTime: '09:19:00', depTime: '09:21:00', haltMinutes: '2', distanceFromOriginKm: 312 },
    { sequence: 4, stationCode: 'JAT', stationName: 'Jammu Tawi', arrTime: '12:38:00', depTime: '12:40:00', haltMinutes: '2', distanceFromOriginKm: 577 },
    { sequence: 5, stationCode: 'SVDK', stationName: 'Shri Mata Vaishno Devi Katra', arrTime: '14:00:00', depTime: '14:00:00', haltMinutes: '0', distanceFromOriginKm: 655 }
  ],
  '22440': [
    { sequence: 1, stationCode: 'SVDK', stationName: 'Shri Mata Vaishno Devi Katra', arrTime: '15:00:00', depTime: '15:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'JAT', stationName: 'Jammu Tawi', arrTime: '16:13:00', depTime: '16:15:00', haltMinutes: '2', distanceFromOriginKm: 78 },
    { sequence: 3, stationCode: 'LDH', stationName: 'Ludhiana Junction', arrTime: '19:30:00', depTime: '19:32:00', haltMinutes: '2', distanceFromOriginKm: 343 },
    { sequence: 4, stationCode: 'UMB', stationName: 'Ambala Cantt', arrTime: '20:48:00', depTime: '20:50:00', haltMinutes: '2', distanceFromOriginKm: 457 },
    { sequence: 5, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '23:00:00', depTime: '23:00:00', haltMinutes: '0', distanceFromOriginKm: 655 }
  ],
  '12003': [
    { sequence: 1, stationCode: 'LKO', stationName: 'Lucknow Charbagh NR', arrTime: '15:30:00', depTime: '15:30:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '16:48:00', depTime: '16:53:00', haltMinutes: '5', distanceFromOriginKm: 72 },
    { sequence: 3, stationCode: 'GZB', stationName: 'Ghaziabad Junction', arrTime: '21:33:00', depTime: '21:35:00', haltMinutes: '2', distanceFromOriginKm: 486 },
    { sequence: 4, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '22:15:00', depTime: '22:15:00', haltMinutes: '0', distanceFromOriginKm: 511 }
  ],
  '12004': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '06:10:00', depTime: '06:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'GZB', stationName: 'Ghaziabad Junction', arrTime: '06:48:00', depTime: '06:50:00', haltMinutes: '2', distanceFromOriginKm: 25 },
    { sequence: 3, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '11:20:00', depTime: '11:25:00', haltMinutes: '5', distanceFromOriginKm: 439 },
    { sequence: 4, stationCode: 'LKO', stationName: 'Lucknow Charbagh NR', arrTime: '12:40:00', depTime: '12:40:00', haltMinutes: '0', distanceFromOriginKm: 511 }
  ],
  '12625': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '20:10:00', depTime: '20:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '22:35:00', depTime: '22:40:00', haltMinutes: '5', distanceFromOriginKm: 195 },
    { sequence: 3, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '00:03:00', depTime: '00:05:00', haltMinutes: '2', distanceFromOriginKm: 313 },
    { sequence: 4, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '01:30:00', depTime: '01:38:00', haltMinutes: '8', distanceFromOriginKm: 410 },
    { sequence: 5, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '05:30:00', depTime: '05:40:00', haltMinutes: '10', distanceFromOriginKm: 702 },
    { sequence: 6, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '11:45:00', depTime: '11:50:00', haltMinutes: '5', distanceFromOriginKm: 1092 },
    { sequence: 7, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '21:10:00', depTime: '21:20:00', haltMinutes: '10', distanceFromOriginKm: 1755 },
    { sequence: 8, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '04:15:00', depTime: '04:40:00', haltMinutes: '25', distanceFromOriginKm: 2186 },
    { sequence: 9, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '16:55:00', depTime: '17:00:00', haltMinutes: '5', distanceFromOriginKm: 2825 },
    { sequence: 10, stationCode: 'TVC', stationName: 'Thiruvananthapuram Central', arrTime: '21:30:00', depTime: '21:30:00', haltMinutes: '0', distanceFromOriginKm: 3031 }
  ],
  '12626': [
    { sequence: 1, stationCode: 'TVC', stationName: 'Thiruvananthapuram Central', arrTime: '12:30:00', depTime: '12:30:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '16:55:00', depTime: '17:00:00', haltMinutes: '5', distanceFromOriginKm: 206 },
    { sequence: 3, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '04:40:00', depTime: '05:05:00', haltMinutes: '25', distanceFromOriginKm: 845 },
    { sequence: 4, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '11:40:00', depTime: '11:50:00', haltMinutes: '10', distanceFromOriginKm: 1276 },
    { sequence: 5, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '21:10:00', depTime: '21:15:00', haltMinutes: '5', distanceFromOriginKm: 1939 },
    { sequence: 6, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '02:50:00', depTime: '03:00:00', haltMinutes: '10', distanceFromOriginKm: 2329 },
    { sequence: 7, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '06:50:00', depTime: '06:58:00', haltMinutes: '8', distanceFromOriginKm: 2621 },
    { sequence: 8, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '09:40:00', depTime: '09:45:00', haltMinutes: '5', distanceFromOriginKm: 2836 },
    { sequence: 9, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '13:35:00', depTime: '13:35:00', haltMinutes: '0', distanceFromOriginKm: 3031 }
  ],
  '12137': [
    { sequence: 1, stationCode: 'CSMT', stationName: 'Chhatrapati Shivaji Maharaj Terminus', arrTime: '19:35:00', depTime: '19:35:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '20:32:00', depTime: '20:35:00', haltMinutes: '3', distanceFromOriginKm: 54 },
    { sequence: 3, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '02:20:00', depTime: '02:25:00', haltMinutes: '5', distanceFromOriginKm: 444 },
    { sequence: 4, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '09:00:00', depTime: '09:10:00', haltMinutes: '10', distanceFromOriginKm: 843 },
    { sequence: 5, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '13:20:00', depTime: '13:28:00', haltMinutes: '8', distanceFromOriginKm: 1135 },
    { sequence: 6, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '16:40:00', depTime: '16:45:00', haltMinutes: '5', distanceFromOriginKm: 1350 },
    { sequence: 7, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '21:20:00', depTime: '21:40:00', haltMinutes: '20', distanceFromOriginKm: 1545 },
    { sequence: 8, stationCode: 'BTI', stationName: 'Bathinda Junction', arrTime: '02:50:00', depTime: '03:00:00', haltMinutes: '10', distanceFromOriginKm: 1832 },
    { sequence: 9, stationCode: 'ASR', stationName: 'Amritsar Junction', arrTime: '05:10:00', depTime: '05:10:00', haltMinutes: '0', distanceFromOriginKm: 1929 }
  ],
  '12138': [
    { sequence: 1, stationCode: 'ASR', stationName: 'Amritsar Junction', arrTime: '21:45:00', depTime: '21:45:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BTI', stationName: 'Bathinda Junction', arrTime: '00:05:00', depTime: '00:15:00', haltMinutes: '10', distanceFromOriginKm: 97 },
    { sequence: 3, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '05:10:00', depTime: '05:30:00', haltMinutes: '20', distanceFromOriginKm: 384 },
    { sequence: 4, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '08:00:00', depTime: '08:05:00', haltMinutes: '5', distanceFromOriginKm: 579 },
    { sequence: 5, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '11:00:00', depTime: '11:08:00', haltMinutes: '8', distanceFromOriginKm: 794 },
    { sequence: 6, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '15:20:00', depTime: '15:30:00', haltMinutes: '10', distanceFromOriginKm: 1086 },
    { sequence: 7, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '21:30:00', depTime: '21:35:00', haltMinutes: '5', distanceFromOriginKm: 1485 },
    { sequence: 8, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '06:17:00', depTime: '06:20:00', haltMinutes: '3', distanceFromOriginKm: 1875 },
    { sequence: 9, stationCode: 'CSMT', stationName: 'Chhatrapati Shivaji Maharaj Terminus', arrTime: '07:35:00', depTime: '07:35:00', haltMinutes: '0', distanceFromOriginKm: 1929 }
  ],
  '12621': [
    { sequence: 1, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '22:00:00', depTime: '22:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '03:50:00', depTime: '04:00:00', haltMinutes: '10', distanceFromOriginKm: 431 },
    { sequence: 3, stationCode: 'WL', stationName: 'Warangal', arrTime: '06:54:00', depTime: '06:55:00', haltMinutes: '1', distanceFromOriginKm: 638 },
    { sequence: 4, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '13:50:00', depTime: '13:55:00', haltMinutes: '5', distanceFromOriginKm: 1094 },
    { sequence: 5, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '20:10:00', depTime: '20:20:00', haltMinutes: '10', distanceFromOriginKm: 1484 },
    { sequence: 6, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '00:26:00', depTime: '00:31:00', haltMinutes: '5', distanceFromOriginKm: 1776 },
    { sequence: 7, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '03:05:00', depTime: '03:07:00', haltMinutes: '2', distanceFromOriginKm: 1991 },
    { sequence: 8, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '06:30:00', depTime: '06:30:00', haltMinutes: '0', distanceFromOriginKm: 2186 }
  ],
  '12622': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '21:05:00', depTime: '21:05:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '23:28:00', depTime: '23:30:00', haltMinutes: '2', distanceFromOriginKm: 195 },
    { sequence: 3, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '02:35:00', depTime: '02:43:00', haltMinutes: '8', distanceFromOriginKm: 410 },
    { sequence: 4, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '06:45:00', depTime: '06:55:00', haltMinutes: '10', distanceFromOriginKm: 702 },
    { sequence: 5, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '13:05:00', depTime: '13:10:00', haltMinutes: '5', distanceFromOriginKm: 1092 },
    { sequence: 6, stationCode: 'WL', stationName: 'Warangal', arrTime: '19:43:00', depTime: '19:45:00', haltMinutes: '2', distanceFromOriginKm: 1548 },
    { sequence: 7, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '23:15:00', depTime: '23:25:00', haltMinutes: '10', distanceFromOriginKm: 1755 },
    { sequence: 8, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '06:15:00', depTime: '06:15:00', haltMinutes: '0', distanceFromOriginKm: 2186 }
  ],
  '12627': [
    { sequence: 1, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '19:20:00', depTime: '19:20:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'UBL', stationName: 'SSS Hubballi Junction', arrTime: '01:50:00', depTime: '02:00:00', haltMinutes: '10', distanceFromOriginKm: 470 },
    { sequence: 3, stationCode: 'SUR', stationName: 'Solapur Junction', arrTime: '07:25:00', depTime: '07:30:00', haltMinutes: '5', distanceFromOriginKm: 829 },
    { sequence: 4, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '17:15:00', depTime: '17:20:00', haltMinutes: '5', distanceFromOriginKm: 1314 },
    { sequence: 5, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '23:30:00', depTime: '23:40:00', haltMinutes: '10', distanceFromOriginKm: 1704 },
    { sequence: 6, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '03:30:00', depTime: '03:38:00', haltMinutes: '8', distanceFromOriginKm: 1996 },
    { sequence: 7, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '06:05:00', depTime: '06:10:00', haltMinutes: '5', distanceFromOriginKm: 2211 },
    { sequence: 8, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '09:00:00', depTime: '09:00:00', haltMinutes: '0', distanceFromOriginKm: 2406 }
  ],
  '12628': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '20:20:00', depTime: '20:20:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '22:48:00', depTime: '22:50:00', haltMinutes: '2', distanceFromOriginKm: 195 },
    { sequence: 3, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '01:50:00', depTime: '01:58:00', haltMinutes: '8', distanceFromOriginKm: 410 },
    { sequence: 4, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '06:15:00', depTime: '06:25:00', haltMinutes: '10', distanceFromOriginKm: 702 },
    { sequence: 5, stationCode: 'NGP', stationName: 'Nagpur Junction', arrTime: '12:35:00', depTime: '12:40:00', haltMinutes: '5', distanceFromOriginKm: 1092 },
    { sequence: 6, stationCode: 'SUR', stationName: 'Solapur Junction', arrTime: '22:15:00', depTime: '22:20:00', haltMinutes: '5', distanceFromOriginKm: 1577 },
    { sequence: 7, stationCode: 'UBL', stationName: 'SSS Hubballi Junction', arrTime: '04:10:00', depTime: '04:20:00', haltMinutes: '10', distanceFromOriginKm: 1936 },
    { sequence: 8, stationCode: 'SBC', stationName: 'KSR Bengaluru City', arrTime: '12:00:00', depTime: '12:00:00', haltMinutes: '0', distanceFromOriginKm: 2406 }
  ],
  '12801': [
    { sequence: 1, stationCode: 'PURI', stationName: 'Puri', arrTime: '21:55:00', depTime: '21:55:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BBS', stationName: 'Bhubaneswar', arrTime: '22:55:00', depTime: '23:00:00', haltMinutes: '5', distanceFromOriginKm: 63 },
    { sequence: 3, stationCode: 'CTC', stationName: 'Cuttack', arrTime: '23:35:00', depTime: '23:40:00', haltMinutes: '5', distanceFromOriginKm: 91 },
    { sequence: 4, stationCode: 'TATA', stationName: 'Tatanagar Junction', arrTime: '06:25:00', depTime: '06:35:00', haltMinutes: '10', distanceFromOriginKm: 467 },
    { sequence: 5, stationCode: 'BKSC', stationName: 'Bokaro Steel City', arrTime: '09:40:00', depTime: '09:45:00', haltMinutes: '5', distanceFromOriginKm: 581 },
    { sequence: 6, stationCode: 'GAYA', stationName: 'Gaya Junction', arrTime: '13:40:00', depTime: '13:45:00', haltMinutes: '5', distanceFromOriginKm: 784 },
    { sequence: 7, stationCode: 'DDU', stationName: 'Pt. Deen Dayal Upadhyaya Junction', arrTime: '16:50:00', depTime: '17:00:00', haltMinutes: '10', distanceFromOriginKm: 989 },
    { sequence: 8, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '19:20:00', depTime: '19:30:00', haltMinutes: '10', distanceFromOriginKm: 1142 },
    { sequence: 9, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '21:55:00', depTime: '22:00:00', haltMinutes: '5', distanceFromOriginKm: 1336 },
    { sequence: 10, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '04:00:00', depTime: '04:00:00', haltMinutes: '0', distanceFromOriginKm: 1866 }
  ],
  '12802': [
    { sequence: 1, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '22:40:00', depTime: '22:40:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'CNB', stationName: 'Kanpur Central', arrTime: '04:00:00', depTime: '04:05:00', haltMinutes: '5', distanceFromOriginKm: 530 },
    { sequence: 3, stationCode: 'PRYJ', stationName: 'Prayagraj Junction', arrTime: '06:50:00', depTime: '07:00:00', haltMinutes: '10', distanceFromOriginKm: 724 },
    { sequence: 4, stationCode: 'DDU', stationName: 'Pt. Deen Dayal Upadhyaya Junction', arrTime: '09:50:00', depTime: '10:00:00', haltMinutes: '10', distanceFromOriginKm: 877 },
    { sequence: 5, stationCode: 'GAYA', stationName: 'Gaya Junction', arrTime: '12:35:00', depTime: '12:40:00', haltMinutes: '5', distanceFromOriginKm: 1082 },
    { sequence: 6, stationCode: 'BKSC', stationName: 'Bokaro Steel City', arrTime: '15:40:00', depTime: '15:45:00', haltMinutes: '5', distanceFromOriginKm: 1285 },
    { sequence: 7, stationCode: 'TATA', stationName: 'Tatanagar Junction', arrTime: '19:50:00', depTime: '20:00:00', haltMinutes: '10', distanceFromOriginKm: 1399 },
    { sequence: 8, stationCode: 'CTC', stationName: 'Cuttack', arrTime: '01:15:00', depTime: '01:20:00', haltMinutes: '5', distanceFromOriginKm: 1775 },
    { sequence: 9, stationCode: 'BBS', stationName: 'Bhubaneswar', arrTime: '01:55:00', depTime: '02:00:00', haltMinutes: '5', distanceFromOriginKm: 1803 },
    { sequence: 10, stationCode: 'PURI', stationName: 'Puri', arrTime: '05:20:00', depTime: '05:20:00', haltMinutes: '0', distanceFromOriginKm: 1866 }
  ],
  '12617': [
    { sequence: 1, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '13:25:00', depTime: '13:25:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'CLT', stationName: 'Kozhikode', arrTime: '16:17:00', depTime: '16:20:00', haltMinutes: '3', distanceFromOriginKm: 193 },
    { sequence: 3, stationCode: 'MAJN', stationName: 'Mangaluru Junction', arrTime: '20:05:00', depTime: '20:10:00', haltMinutes: '5', distanceFromOriginKm: 416 },
    { sequence: 4, stationCode: 'UD', stationName: 'Udupi', arrTime: '21:38:00', depTime: '21:40:00', haltMinutes: '2', distanceFromOriginKm: 478 },
    { sequence: 5, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '00:10:00', depTime: '00:12:00', haltMinutes: '2', distanceFromOriginKm: 668 },
    { sequence: 6, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '01:50:00', depTime: '02:00:00', haltMinutes: '10', distanceFromOriginKm: 728 },
    { sequence: 7, stationCode: 'BSR', stationName: 'Vasai Road', arrTime: '12:35:00', depTime: '12:40:00', haltMinutes: '5', distanceFromOriginKm: 1294 },
    { sequence: 8, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '19:40:00', depTime: '19:45:00', haltMinutes: '5', distanceFromOriginKm: 1738 },
    { sequence: 9, stationCode: 'ET', stationName: 'Itarsi Junction', arrTime: '00:30:00', depTime: '00:35:00', haltMinutes: '5', distanceFromOriginKm: 2045 },
    { sequence: 10, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '06:15:00', depTime: '06:23:00', haltMinutes: '8', distanceFromOriginKm: 2329 },
    { sequence: 11, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '09:20:00', depTime: '09:25:00', haltMinutes: '5', distanceFromOriginKm: 2544 },
    { sequence: 12, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '13:15:00', depTime: '13:15:00', haltMinutes: '0', distanceFromOriginKm: 2767 }
  ],
  '12618': [
    { sequence: 1, stationCode: 'NZM', stationName: 'Hazrat Nizamuddin', arrTime: '05:40:00', depTime: '05:40:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '08:30:00', depTime: '08:35:00', haltMinutes: '5', distanceFromOriginKm: 223 },
    { sequence: 3, stationCode: 'VGLJ', stationName: 'VGL Jhansi Junction', arrTime: '11:45:00', depTime: '11:53:00', haltMinutes: '8', distanceFromOriginKm: 438 },
    { sequence: 4, stationCode: 'ET', stationName: 'Itarsi Junction', arrTime: '18:00:00', depTime: '18:05:00', haltMinutes: '5', distanceFromOriginKm: 722 },
    { sequence: 5, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '22:45:00', depTime: '22:50:00', haltMinutes: '5', distanceFromOriginKm: 1029 },
    { sequence: 6, stationCode: 'BSR', stationName: 'Vasai Road', arrTime: '05:30:00', depTime: '05:35:00', haltMinutes: '5', distanceFromOriginKm: 1473 },
    { sequence: 7, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '16:00:00', depTime: '16:10:00', haltMinutes: '10', distanceFromOriginKm: 2039 },
    { sequence: 8, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '17:20:00', depTime: '17:22:00', haltMinutes: '2', distanceFromOriginKm: 2099 },
    { sequence: 9, stationCode: 'UD', stationName: 'Udupi', arrTime: '20:10:00', depTime: '20:12:00', haltMinutes: '2', distanceFromOriginKm: 2289 },
    { sequence: 10, stationCode: 'MAJN', stationName: 'Mangaluru Junction', arrTime: '21:55:00', depTime: '22:00:00', haltMinutes: '5', distanceFromOriginKm: 2351 },
    { sequence: 11, stationCode: 'CLT', stationName: 'Kozhikode', arrTime: '01:17:00', depTime: '01:20:00', haltMinutes: '3', distanceFromOriginKm: 2574 },
    { sequence: 12, stationCode: 'ERS', stationName: 'Ernakulam Junction', arrTime: '07:30:00', depTime: '07:30:00', haltMinutes: '0', distanceFromOriginKm: 2767 }
  ],
  '10103': [
    { sequence: 1, stationCode: 'CSMT', stationName: 'Chhatrapati Shivaji Maharaj Terminus', arrTime: '07:10:00', depTime: '07:10:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '08:02:00', depTime: '08:05:00', haltMinutes: '3', distanceFromOriginKm: 54 },
    { sequence: 3, stationCode: 'THVM', stationName: 'Thivim', arrTime: '17:38:00', depTime: '17:40:00', haltMinutes: '2', distanceFromOriginKm: 542 },
    { sequence: 4, stationCode: 'KRMI', stationName: 'Karmali', arrTime: '18:04:00', depTime: '18:06:00', haltMinutes: '2', distanceFromOriginKm: 559 },
    { sequence: 5, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '19:10:00', depTime: '19:10:00', haltMinutes: '0', distanceFromOriginKm: 580 }
  ],
  '10104': [
    { sequence: 1, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '09:15:00', depTime: '09:15:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KRMI', stationName: 'Karmali', arrTime: '09:42:00', depTime: '09:44:00', haltMinutes: '2', distanceFromOriginKm: 21 },
    { sequence: 3, stationCode: 'THVM', stationName: 'Thivim', arrTime: '10:06:00', depTime: '10:08:00', haltMinutes: '2', distanceFromOriginKm: 38 },
    { sequence: 4, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '20:37:00', depTime: '20:40:00', haltMinutes: '3', distanceFromOriginKm: 526 },
    { sequence: 5, stationCode: 'CSMT', stationName: 'Chhatrapati Shivaji Maharaj Terminus', arrTime: '21:40:00', depTime: '21:40:00', haltMinutes: '0', distanceFromOriginKm: 580 }
  ],
  '12619': [
    { sequence: 1, stationCode: 'LTT', stationName: 'Lokmanya Tilak Terminus', arrTime: '15:20:00', depTime: '15:20:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '16:02:00', depTime: '16:05:00', haltMinutes: '3', distanceFromOriginKm: 35 },
    { sequence: 3, stationCode: 'THVM', stationName: 'Thivim', arrTime: '01:04:00', depTime: '01:06:00', haltMinutes: '2', distanceFromOriginKm: 512 },
    { sequence: 4, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '02:30:00', depTime: '02:40:00', haltMinutes: '10', distanceFromOriginKm: 550 },
    { sequence: 5, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '03:40:00', depTime: '03:42:00', haltMinutes: '2', distanceFromOriginKm: 610 },
    { sequence: 6, stationCode: 'UD', stationName: 'Udupi', arrTime: '06:12:00', depTime: '06:14:00', haltMinutes: '2', distanceFromOriginKm: 800 },
    { sequence: 7, stationCode: 'SL', stationName: 'Surathkal', arrTime: '06:48:00', depTime: '06:50:00', haltMinutes: '2', distanceFromOriginKm: 842 },
    { sequence: 8, stationCode: 'MAQ', stationName: 'Mangaluru Central', arrTime: '07:30:00', depTime: '07:30:00', haltMinutes: '0', distanceFromOriginKm: 884 }
  ],
  '12620': [
    { sequence: 1, stationCode: 'MAQ', stationName: 'Mangaluru Central', arrTime: '14:20:00', depTime: '14:20:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'SL', stationName: 'Surathkal', arrTime: '14:52:00', depTime: '14:54:00', haltMinutes: '2', distanceFromOriginKm: 42 },
    { sequence: 3, stationCode: 'UD', stationName: 'Udupi', arrTime: '15:28:00', depTime: '15:30:00', haltMinutes: '2', distanceFromOriginKm: 84 },
    { sequence: 4, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '18:10:00', depTime: '18:12:00', haltMinutes: '2', distanceFromOriginKm: 274 },
    { sequence: 5, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '19:40:00', depTime: '19:50:00', haltMinutes: '10', distanceFromOriginKm: 334 },
    { sequence: 6, stationCode: 'THVM', stationName: 'Thivim', arrTime: '20:38:00', depTime: '20:40:00', haltMinutes: '2', distanceFromOriginKm: 372 },
    { sequence: 7, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '05:32:00', depTime: '05:35:00', haltMinutes: '3', distanceFromOriginKm: 849 },
    { sequence: 8, stationCode: 'LTT', stationName: 'Lokmanya Tilak Terminus', arrTime: '06:35:00', depTime: '06:35:00', haltMinutes: '0', distanceFromOriginKm: 884 }
  ],
  '12933': [
    { sequence: 1, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '14:05:00', depTime: '14:05:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'VAPI', stationName: 'Vapi', arrTime: '16:01:00', depTime: '16:03:00', haltMinutes: '2', distanceFromOriginKm: 168 },
    { sequence: 3, stationCode: 'ST', stationName: 'Surat', arrTime: '17:15:00', depTime: '17:20:00', haltMinutes: '5', distanceFromOriginKm: 263 },
    { sequence: 4, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '18:55:00', depTime: '19:00:00', haltMinutes: '5', distanceFromOriginKm: 393 },
    { sequence: 5, stationCode: 'ANND', stationName: 'Anand Junction', arrTime: '19:33:00', depTime: '19:35:00', haltMinutes: '2', distanceFromOriginKm: 428 },
    { sequence: 6, stationCode: 'ADI', stationName: 'Ahmedabad Junction', arrTime: '21:25:00', depTime: '21:25:00', haltMinutes: '0', distanceFromOriginKm: 493 }
  ],
  '12934': [
    { sequence: 1, stationCode: 'ADI', stationName: 'Ahmedabad Junction', arrTime: '05:00:00', depTime: '05:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'ANND', stationName: 'Anand Junction', arrTime: '05:54:00', depTime: '05:56:00', haltMinutes: '2', distanceFromOriginKm: 65 },
    { sequence: 3, stationCode: 'BRC', stationName: 'Vadodara Junction', arrTime: '06:28:00', depTime: '06:33:00', haltMinutes: '5', distanceFromOriginKm: 100 },
    { sequence: 4, stationCode: 'ST', stationName: 'Surat', arrTime: '08:13:00', depTime: '08:18:00', haltMinutes: '5', distanceFromOriginKm: 230 },
    { sequence: 5, stationCode: 'VAPI', stationName: 'Vapi', arrTime: '09:34:00', depTime: '09:36:00', haltMinutes: '2', distanceFromOriginKm: 325 },
    { sequence: 6, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '12:20:00', depTime: '12:20:00', haltMinutes: '0', distanceFromOriginKm: 493 }
  ],
  '11077': [
    { sequence: 1, stationCode: 'PUNE', stationName: 'Pune Junction', arrTime: '17:20:00', depTime: '17:20:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '19:42:00', depTime: '19:45:00', haltMinutes: '3', distanceFromOriginKm: 138 },
    { sequence: 3, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '01:45:00', depTime: '01:50:00', haltMinutes: '5', distanceFromOriginKm: 528 },
    { sequence: 4, stationCode: 'ET', stationName: 'Itarsi Junction', arrTime: '06:35:00', depTime: '06:45:00', haltMinutes: '10', distanceFromOriginKm: 835 },
    { sequence: 5, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '08:30:00', depTime: '08:35:00', haltMinutes: '5', distanceFromOriginKm: 927 },
    { sequence: 6, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '13:00:00', depTime: '13:05:00', haltMinutes: '5', distanceFromOriginKm: 1224 },
    { sequence: 7, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '15:10:00', depTime: '15:15:00', haltMinutes: '5', distanceFromOriginKm: 1342 },
    { sequence: 8, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '21:10:00', depTime: '21:30:00', haltMinutes: '20', distanceFromOriginKm: 1537 },
    { sequence: 9, stationCode: 'UMB', stationName: 'Ambala Cantt', arrTime: '00:25:00', depTime: '00:33:00', haltMinutes: '8', distanceFromOriginKm: 1735 },
    { sequence: 10, stationCode: 'JAT', stationName: 'Jammu Tawi', arrTime: '09:45:00', depTime: '09:45:00', haltMinutes: '0', distanceFromOriginKm: 2177 }
  ],
  '11078': [
    { sequence: 1, stationCode: 'JAT', stationName: 'Jammu Tawi', arrTime: '21:45:00', depTime: '21:45:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'UMB', stationName: 'Ambala Cantt', arrTime: '04:45:00', depTime: '04:55:00', haltMinutes: '10', distanceFromOriginKm: 442 },
    { sequence: 3, stationCode: 'NDLS', stationName: 'New Delhi', arrTime: '09:45:00', depTime: '10:15:00', haltMinutes: '30', distanceFromOriginKm: 640 },
    { sequence: 4, stationCode: 'AGC', stationName: 'Agra Cantt', arrTime: '13:10:00', depTime: '13:15:00', haltMinutes: '5', distanceFromOriginKm: 835 },
    { sequence: 5, stationCode: 'GWL', stationName: 'Gwalior Junction', arrTime: '15:00:00', depTime: '15:05:00', haltMinutes: '5', distanceFromOriginKm: 953 },
    { sequence: 6, stationCode: 'BPL', stationName: 'Bhopal Junction', arrTime: '19:40:00', depTime: '19:50:00', haltMinutes: '10', distanceFromOriginKm: 1250 },
    { sequence: 7, stationCode: 'ET', stationName: 'Itarsi Junction', arrTime: '21:35:00', depTime: '21:45:00', haltMinutes: '10', distanceFromOriginKm: 1342 },
    { sequence: 8, stationCode: 'BSL', stationName: 'Bhusaval Junction', arrTime: '02:25:00', depTime: '02:30:00', haltMinutes: '5', distanceFromOriginKm: 1649 },
    { sequence: 9, stationCode: 'KYN', stationName: 'Kalyan Junction', arrTime: '08:42:00', depTime: '08:45:00', haltMinutes: '3', distanceFromOriginKm: 2039 },
    { sequence: 10, stationCode: 'PUNE', stationName: 'Pune Junction', arrTime: '15:10:00', depTime: '15:10:00', haltMinutes: '0', distanceFromOriginKm: 2177 }
  ],
  '12839': [
    { sequence: 1, stationCode: 'HWH', stationName: 'Howrah Junction', arrTime: '23:55:00', depTime: '23:55:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'KGP', stationName: 'Kharagpur Junction', arrTime: '01:30:00', depTime: '01:35:00', haltMinutes: '5', distanceFromOriginKm: 115 },
    { sequence: 3, stationCode: 'BLS', stationName: 'Balasore', arrTime: '02:58:00', depTime: '03:00:00', haltMinutes: '2', distanceFromOriginKm: 231 },
    { sequence: 4, stationCode: 'CTC', stationName: 'Cuttack', arrTime: '05:35:00', depTime: '05:40:00', haltMinutes: '5', distanceFromOriginKm: 409 },
    { sequence: 5, stationCode: 'BBS', stationName: 'Bhubaneswar', arrTime: '06:15:00', depTime: '06:20:00', haltMinutes: '5', distanceFromOriginKm: 437 },
    { sequence: 6, stationCode: 'VSKP', stationName: 'Visakhapatnam Junction', arrTime: '13:50:00', depTime: '14:10:00', haltMinutes: '20', distanceFromOriginKm: 880 },
    { sequence: 7, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '19:40:00', depTime: '19:55:00', haltMinutes: '15', distanceFromOriginKm: 1230 },
    { sequence: 8, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '03:45:00', depTime: '03:45:00', haltMinutes: '0', distanceFromOriginKm: 1661 }
  ],
  '12840': [
    { sequence: 1, stationCode: 'MAS', stationName: 'MGR Chennai Central', arrTime: '19:00:00', depTime: '19:00:00', haltMinutes: '0', distanceFromOriginKm: 0 },
    { sequence: 2, stationCode: 'BZA', stationName: 'Vijayawada Junction', arrTime: '01:45:00', depTime: '02:00:00', haltMinutes: '15', distanceFromOriginKm: 431 },
    { sequence: 3, stationCode: 'VSKP', stationName: 'Visakhapatnam Junction', arrTime: '08:00:00', depTime: '08:20:00', haltMinutes: '20', distanceFromOriginKm: 781 },
    { sequence: 4, stationCode: 'BBS', stationName: 'Bhubaneswar', arrTime: '14:50:00', depTime: '14:55:00', haltMinutes: '5', distanceFromOriginKm: 1224 },
    { sequence: 5, stationCode: 'CTC', stationName: 'Cuttack', arrTime: '15:30:00', depTime: '15:35:00', haltMinutes: '5', distanceFromOriginKm: 1252 },
    { sequence: 6, stationCode: 'BLS', stationName: 'Balasore', arrTime: '18:05:00', depTime: '18:07:00', haltMinutes: '2', distanceFromOriginKm: 1430 },
    { sequence: 7, stationCode: 'KGP', stationName: 'Kharagpur Junction', arrTime: '20:10:00', depTime: '20:15:00', haltMinutes: '5', distanceFromOriginKm: 1546 },
    { sequence: 8, stationCode: 'HWH', stationName: 'Howrah Junction', arrTime: '23:00:00', depTime: '23:00:00', haltMinutes: '0', distanceFromOriginKm: 1661 }
  ]
};

const EXPANDED_MASTER_TRAINS = [
  { train_number: '12951', train_name: 'Mumbai Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'MMCT', destination_station_code: 'NDLS', departure_time: '17:00:00', arrival_time: '08:32:00', distance_km: 1386, running_days: 'Daily', status: 'active' },
  { train_number: '12952', train_name: 'New Delhi Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'NDLS', destination_station_code: 'MMCT', departure_time: '16:55:00', arrival_time: '08:35:00', distance_km: 1386, running_days: 'Daily', status: 'active' },
  { train_number: '12954', train_name: 'August Kranti Rajdhani', train_type: 'Rajdhani', source_station_code: 'MMCT', destination_station_code: 'NZM', departure_time: '17:10:00', arrival_time: '09:43:00', distance_km: 1377, running_days: 'Daily', status: 'active' },
  { train_number: '12301', train_name: 'Howrah Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'HWH', destination_station_code: 'NDLS', departure_time: '16:50:00', arrival_time: '10:05:00', distance_km: 1447, running_days: 'Daily', status: 'active' },
  { train_number: '12302', train_name: 'New Delhi Howrah Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'NDLS', destination_station_code: 'HWH', departure_time: '16:50:00', arrival_time: '09:55:00', distance_km: 1447, running_days: 'Daily', status: 'active' },
  { train_number: '12001', train_name: 'Bhopal Shatabdi Express', train_type: 'Shatabdi', source_station_code: 'BPL', destination_station_code: 'NDLS', departure_time: '15:15:00', arrival_time: '23:30:00', distance_km: 708, running_days: 'Daily', status: 'active' },
  { train_number: '12002', train_name: 'New Delhi Shatabdi Express', train_type: 'Shatabdi', source_station_code: 'NDLS', destination_station_code: 'BPL', departure_time: '06:00:00', arrival_time: '14:10:00', distance_km: 708, running_days: 'Daily', status: 'active' },
  { train_number: '22436', train_name: 'Varanasi Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'NDLS', destination_station_code: 'BSB', departure_time: '06:00:00', arrival_time: '14:00:00', distance_km: 757, running_days: 'Mon, Tue, Wed, Fri, Sat, Sun', status: 'active' },
  { train_number: '22435', train_name: 'Varanasi Vande Bharat Return', train_type: 'Vande Bharat', source_station_code: 'BSB', destination_station_code: 'NDLS', departure_time: '15:00:00', arrival_time: '23:00:00', distance_km: 757, running_days: 'Mon, Tue, Wed, Fri, Sat, Sun', status: 'active' },
  { train_number: '20646', train_name: 'Madgaon Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'MAQ', destination_station_code: 'MAO', departure_time: '08:30:00', arrival_time: '13:15:00', distance_km: 318, running_days: 'Mon, Tue, Wed, Thu, Fri, Sat', status: 'active' },
  { train_number: '20645', train_name: 'Mangaluru Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'MAO', destination_station_code: 'MAQ', departure_time: '18:10:00', arrival_time: '22:45:00', distance_km: 318, running_days: 'Mon, Tue, Wed, Thu, Fri, Sat', status: 'active' },
  { train_number: '20608', train_name: 'Chennai Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'MYS', destination_station_code: 'MAS', departure_time: '06:00:00', arrival_time: '12:25:00', distance_km: 500, running_days: 'Mon, Tue, Thu, Fri, Sat, Sun', status: 'active' },
  { train_number: '20642', train_name: 'Coimbatore Bengaluru Vande Bharat', train_type: 'Vande Bharat', source_station_code: 'CBE', destination_station_code: 'SBC', departure_time: '05:00:00', arrival_time: '11:30:00', distance_km: 375, running_days: 'Daily', status: 'active' },
  { train_number: '12432', train_name: 'Trivandrum Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'NZM', destination_station_code: 'TVC', departure_time: '06:16:00', arrival_time: '23:45:00', distance_km: 2750, running_days: 'Tue, Wed, Sun', status: 'active' },
  { train_number: '12008', train_name: 'Mysore Shatabdi Express', train_type: 'Shatabdi', source_station_code: 'SBC', destination_station_code: 'MAS', departure_time: '16:15:00', arrival_time: '22:00:00', distance_km: 357, running_days: 'Daily', status: 'active' },
  { train_number: '12050', train_name: 'Gatimaan Express', train_type: 'Gatimaan', source_station_code: 'NZM', destination_station_code: 'AGC', departure_time: '08:10:00', arrival_time: '09:50:00', distance_km: 188, running_days: 'Mon, Tue, Wed, Thu, Sat, Sun', status: 'active' },
  { train_number: '16596', train_name: 'Panchaganga Express', train_type: 'Express', source_station_code: 'SBC', destination_station_code: 'KAWR', departure_time: '18:50:00', arrival_time: '07:15:00', distance_km: 600, running_days: 'Daily', status: 'active' },
  { train_number: '12423', train_name: 'Dibrugarh Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'DBRG', destination_station_code: 'NDLS', departure_time: '20:55:00', arrival_time: '10:15:00', distance_km: 2434, running_days: 'Daily', status: 'active' },
  { train_number: '12424', train_name: 'New Delhi Dibrugarh Rajdhani', train_type: 'Rajdhani', source_station_code: 'NDLS', destination_station_code: 'DBRG', departure_time: '16:20:00', arrival_time: '06:00:00', distance_km: 2434, running_days: 'Daily', status: 'active' },
  { train_number: '12433', train_name: 'Chennai Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'MAS', destination_station_code: 'NZM', departure_time: '06:05:00', arrival_time: '10:30:00', distance_km: 2175, running_days: 'Fri, Sun', status: 'active' },
  { train_number: '12434', train_name: 'Nizamuddin Chennai Rajdhani', train_type: 'Rajdhani', source_station_code: 'NZM', destination_station_code: 'MAS', departure_time: '15:35:00', arrival_time: '20:35:00', distance_km: 2175, running_days: 'Wed, Fri', status: 'active' },
  { train_number: '22691', train_name: 'Bengaluru Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'SBC', destination_station_code: 'NZM', departure_time: '20:00:00', arrival_time: '05:30:00', distance_km: 2365, running_days: 'Daily', status: 'active' },
  { train_number: '22692', train_name: 'Nizamuddin Bengaluru Rajdhani', train_type: 'Rajdhani', source_station_code: 'NZM', destination_station_code: 'SBC', departure_time: '19:50:00', arrival_time: '05:20:00', distance_km: 2365, running_days: 'Daily', status: 'active' },
  { train_number: '12437', train_name: 'Secunderabad Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'SC', destination_station_code: 'NZM', departure_time: '12:45:00', arrival_time: '10:30:00', distance_km: 1667, running_days: 'Wed', status: 'active' },
  { train_number: '12438', train_name: 'Nizamuddin Secunderabad Rajdhani', train_type: 'Rajdhani', source_station_code: 'NZM', destination_station_code: 'SC', departure_time: '15:35:00', arrival_time: '13:00:00', distance_km: 1667, running_days: 'Sun', status: 'active' },
  { train_number: '20839', train_name: 'Ranchi Rajdhani Express', train_type: 'Rajdhani', source_station_code: 'RNC', destination_station_code: 'NDLS', departure_time: '18:10:00', arrival_time: '11:10:00', distance_km: 1245, running_days: 'Wed, Sat', status: 'active' },
  { train_number: '20840', train_name: 'New Delhi Ranchi Rajdhani', train_type: 'Rajdhani', source_station_code: 'NDLS', destination_station_code: 'RNC', departure_time: '16:10:00', arrival_time: '09:05:00', distance_km: 1245, running_days: 'Mon, Fri', status: 'active' },
  { train_number: '20901', train_name: 'Gandhinagar Vande Bharat', train_type: 'Vande Bharat', source_station_code: 'MMCT', destination_station_code: 'GNC', departure_time: '06:00:00', arrival_time: '12:25:00', distance_km: 520, running_days: 'Mon, Tue, Wed, Fri, Sat, Sun', status: 'active' },
  { train_number: '20902', train_name: 'Mumbai Central Vande Bharat', train_type: 'Vande Bharat', source_station_code: 'GNC', destination_station_code: 'MMCT', departure_time: '14:05:00', arrival_time: '20:25:00', distance_km: 520, running_days: 'Mon, Tue, Wed, Fri, Sat, Sun', status: 'active' },
  { train_number: '22225', train_name: 'Solapur Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'CSMT', destination_station_code: 'SUR', departure_time: '16:05:00', arrival_time: '22:40:00', distance_km: 452, running_days: 'Mon, Tue, Wed, Fri, Sat, Sun', status: 'active' },
  { train_number: '22226', train_name: 'Mumbai CSMT Vande Bharat', train_type: 'Vande Bharat', source_station_code: 'SUR', destination_station_code: 'CSMT', departure_time: '06:05:00', arrival_time: '12:35:00', distance_km: 452, running_days: 'Mon, Tue, Wed, Fri, Sat, Sun', status: 'active' },
  { train_number: '22439', train_name: 'Katra Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'NDLS', destination_station_code: 'SVDK', departure_time: '06:00:00', arrival_time: '14:00:00', distance_km: 655, running_days: 'Mon, Tue, Thu, Fri, Sat, Sun', status: 'active' },
  { train_number: '22440', train_name: 'New Delhi Vande Bharat Express', train_type: 'Vande Bharat', source_station_code: 'SVDK', destination_station_code: 'NDLS', departure_time: '15:00:00', arrival_time: '23:00:00', distance_km: 655, running_days: 'Mon, Tue, Thu, Fri, Sat, Sun', status: 'active' },
  { train_number: '12003', train_name: 'Lucknow Swarna Shatabdi', train_type: 'Shatabdi', source_station_code: 'LKO', destination_station_code: 'NDLS', departure_time: '15:30:00', arrival_time: '22:15:00', distance_km: 511, running_days: 'Daily', status: 'active' },
  { train_number: '12004', train_name: 'New Delhi Lucknow Shatabdi', train_type: 'Shatabdi', source_station_code: 'NDLS', destination_station_code: 'LKO', departure_time: '06:10:00', arrival_time: '12:40:00', distance_km: 511, running_days: 'Daily', status: 'active' },
  { train_number: '12625', train_name: 'Kerala Superfast Express', train_type: 'Superfast', source_station_code: 'TVC', destination_station_code: 'NDLS', departure_time: '12:30:00', arrival_time: '13:35:00', distance_km: 3031, running_days: 'Daily', status: 'active' },
  { train_number: '12626', train_name: 'New Delhi Kerala Express', train_type: 'Superfast', source_station_code: 'NDLS', destination_station_code: 'TVC', departure_time: '20:10:00', arrival_time: '21:30:00', distance_km: 3031, running_days: 'Daily', status: 'active' },
  { train_number: '12137', train_name: 'Punjab Mail', train_type: 'Superfast', source_station_code: 'CSMT', destination_station_code: 'ASR', departure_time: '19:35:00', arrival_time: '05:10:00', distance_km: 1929, running_days: 'Daily', status: 'active' },
  { train_number: '12138', train_name: 'Amritsar Mumbai Punjab Mail', train_type: 'Superfast', source_station_code: 'ASR', destination_station_code: 'CSMT', departure_time: '21:45:00', arrival_time: '07:35:00', distance_km: 1929, running_days: 'Daily', status: 'active' },
  { train_number: '12621', train_name: 'Tamil Nadu Express', train_type: 'Superfast', source_station_code: 'MAS', destination_station_code: 'NDLS', departure_time: '22:00:00', arrival_time: '06:30:00', distance_km: 2186, running_days: 'Daily', status: 'active' },
  { train_number: '12622', train_name: 'New Delhi Tamil Nadu Express', train_type: 'Superfast', source_station_code: 'NDLS', destination_station_code: 'MAS', departure_time: '21:05:00', arrival_time: '06:15:00', distance_km: 2186, running_days: 'Daily', status: 'active' },
  { train_number: '12627', train_name: 'Karnataka Express', train_type: 'Superfast', source_station_code: 'SBC', destination_station_code: 'NDLS', departure_time: '19:20:00', arrival_time: '09:00:00', distance_km: 2406, running_days: 'Daily', status: 'active' },
  { train_number: '12628', train_name: 'New Delhi Karnataka Express', train_type: 'Superfast', source_station_code: 'NDLS', destination_station_code: 'SBC', departure_time: '20:20:00', arrival_time: '12:00:00', distance_km: 2406, running_days: 'Daily', status: 'active' },
  { train_number: '12801', train_name: 'Purushottam Express', train_type: 'Superfast', source_station_code: 'PURI', destination_station_code: 'NDLS', departure_time: '21:55:00', arrival_time: '04:00:00', distance_km: 1866, running_days: 'Daily', status: 'active' },
  { train_number: '12802', train_name: 'New Delhi Purushottam Express', train_type: 'Superfast', source_station_code: 'NDLS', destination_station_code: 'PURI', departure_time: '22:40:00', arrival_time: '05:20:00', distance_km: 1866, running_days: 'Daily', status: 'active' },
  { train_number: '12617', train_name: 'Mangala Lakshadweep Express', train_type: 'Superfast', source_station_code: 'ERS', destination_station_code: 'NZM', departure_time: '13:25:00', arrival_time: '13:15:00', distance_km: 2767, running_days: 'Daily', status: 'active' },
  { train_number: '12618', train_name: 'Nizamuddin Mangala Lakshadweep', train_type: 'Superfast', source_station_code: 'NZM', destination_station_code: 'ERS', departure_time: '05:40:00', arrival_time: '07:30:00', distance_km: 2767, running_days: 'Daily', status: 'active' },
  { train_number: '10103', train_name: 'Mandovi Express', train_type: 'Express', source_station_code: 'CSMT', destination_station_code: 'MAO', departure_time: '07:10:00', arrival_time: '19:10:00', distance_km: 580, running_days: 'Daily', status: 'active' },
  { train_number: '10104', train_name: 'Madgaon Mandovi Express', train_type: 'Express', source_station_code: 'MAO', destination_station_code: 'CSMT', departure_time: '09:15:00', arrival_time: '21:40:00', distance_km: 580, running_days: 'Daily', status: 'active' },
  { train_number: '12619', train_name: 'Matsyagandha Express', train_type: 'Superfast', source_station_code: 'LTT', destination_station_code: 'MAQ', departure_time: '15:20:00', arrival_time: '07:30:00', distance_km: 884, running_days: 'Daily', status: 'active' },
  { train_number: '12620', train_name: 'Mangaluru Matsyagandha Express', train_type: 'Superfast', source_station_code: 'MAQ', destination_station_code: 'LTT', departure_time: '14:20:00', arrival_time: '06:35:00', distance_km: 884, running_days: 'Daily', status: 'active' },
  { train_number: '12933', train_name: 'Karnavati Express', train_type: 'Superfast', source_station_code: 'MMCT', destination_station_code: 'ADI', departure_time: '14:05:00', arrival_time: '21:25:00', distance_km: 493, running_days: 'Daily', status: 'active' },
  { train_number: '12934', train_name: 'Ahmedabad Karnavati Express', train_type: 'Superfast', source_station_code: 'ADI', destination_station_code: 'MMCT', departure_time: '05:00:00', arrival_time: '12:20:00', distance_km: 493, running_days: 'Daily', status: 'active' },
  { train_number: '11077', train_name: 'Jhelum Express', train_type: 'Express', source_station_code: 'PUNE', destination_station_code: 'JAT', departure_time: '17:20:00', arrival_time: '09:45:00', distance_km: 2177, running_days: 'Daily', status: 'active' },
  { train_number: '11078', train_name: 'Jammu Tawi Jhelum Express', train_type: 'Express', source_station_code: 'JAT', destination_station_code: 'PUNE', departure_time: '21:45:00', arrival_time: '15:10:00', distance_km: 2177, running_days: 'Daily', status: 'active' },
  { train_number: '12839', train_name: 'Howrah Chennai Mail', train_type: 'Superfast', source_station_code: 'HWH', destination_station_code: 'MAS', departure_time: '23:55:00', arrival_time: '03:45:00', distance_km: 1661, running_days: 'Daily', status: 'active' },
  { train_number: '12840', train_name: 'Chennai Howrah Mail', train_type: 'Superfast', source_station_code: 'MAS', destination_station_code: 'HWH', departure_time: '19:00:00', arrival_time: '23:00:00', distance_km: 1661, running_days: 'Daily', status: 'active' }
];

function backfillComprehensiveRouteMaster() {
  if (!mockDb.trains) mockDb.trains = new Map();
  if (!mockDb.routes) mockDb.routes = new Map();

  let modified = false;

  // Seed master trains if not yet present in mockDb.trains
  EXPANDED_MASTER_TRAINS.forEach(mt => {
    const existing = Array.from(mockDb.trains.values()).find(t => t && String(t.train_number) === String(mt.train_number));
    if (!existing) {
      const trainId = `t-${mt.train_number}`;
      const srcName = STANDARD_STATION_NAMES[mt.source_station_code] || mt.source_station_code;
      const destName = STANDARD_STATION_NAMES[mt.destination_station_code] || mt.destination_station_code;
      const stops = KNOWN_CORRIDOR_STOPS[mt.train_number] || [
        { sequence: 1, stationCode: mt.source_station_code, stationName: srcName, arrTime: mt.departure_time, depTime: mt.departure_time, haltMinutes: '0', distanceFromOriginKm: 0 },
        { sequence: 2, stationCode: mt.destination_station_code, stationName: destName, arrTime: mt.arrival_time, depTime: mt.arrival_time, haltMinutes: '0', distanceFromOriginKm: mt.distance_km }
      ];

      const newTrain = {
        id: trainId,
        train_number: mt.train_number,
        train_name: mt.train_name,
        train_type: mt.train_type || 'Superfast',
        source_station_code: mt.source_station_code,
        source_station_name: srcName,
        destination_station_code: mt.destination_station_code,
        destination_station_name: destName,
        departure_time: mt.departure_time,
        arrival_time: mt.arrival_time,
        distance_km: mt.distance_km,
        running_days: mt.running_days || 'Daily',
        status: mt.status || 'active',
        stops: stops,
        coaches: [
          { coach_code: 'H1', class_type: '1A', total_seats: 24, available_seats: 18, base_fare: Math.round(mt.distance_km * 2.5) },
          { coach_code: 'A1', class_type: '2A', total_seats: 48, available_seats: 36, base_fare: Math.round(mt.distance_km * 1.8) },
          { coach_code: 'B1', class_type: '3A', total_seats: 64, available_seats: 45, base_fare: Math.round(mt.distance_km * 1.2) },
          { coach_code: 'S1', class_type: 'SL', total_seats: 72, available_seats: 50, base_fare: Math.round(mt.distance_km * 0.5) }
        ],
        created_at: new Date().toISOString()
      };
      mockDb.trains.set(trainId, newTrain);
      modified = true;
    }
  });

  const ensureStation = (id, code, name, st) => {
    const existing = Array.from(mockDb.stations.values()).find(s => s && (s.station_code === code || s.code === code));
    if (!existing) {
      mockDb.stations.set(id, { id, station_code: code, code, station_name: name, name, state: st });
    }
  };
  ensureStation('s-kawr', 'KAWR', 'Karwar', 'Karnataka');
  ensureStation('s-rn', 'RN', 'Ratnagiri', 'Maharashtra');
  ensureStation('s-pnvl', 'PNVL', 'Panvel', 'Maharashtra');
  ensureStation('s-bsr', 'BSR', 'Vasai Road', 'Maharashtra');
  ensureStation('s-mtj', 'MTJ', 'Mathura Junction', 'Uttar Pradesh');

  for (const [tId, train] of mockDb.trains.entries()) {
    if (!train) continue;

    const tNum = String(train.train_number || '').trim();
    const srcCode = String(train.source_station_code || train.source || 'NDLS').trim().toUpperCase();
    const destCode = String(train.destination_station_code || train.destination || 'MMCT').trim().toUpperCase();

    const srcName = STANDARD_STATION_NAMES[srcCode] || train.source_station_name || srcCode;
    const destName = STANDARD_STATION_NAMES[destCode] || train.destination_station_name || destCode;

    let mappedStops = KNOWN_CORRIDOR_STOPS[tNum];

    const isUdupiCode = (c) => c === 'UD' || c === 'UDU' || String(c).includes('UDUPI');
    const isDelhiCode = (c) => c === 'NDLS' || c === 'NZM' || c === 'DLI' || c === 'ANVT' || String(c).includes('DELHI');

    if (isUdupiCode(srcCode) && isDelhiCode(destCode)) {
      const depTime = train.departure_time || train.scheduled_departure_time || '06:15:00';
      mappedStops = buildStraightUdupiToDelhiStops(depTime);
      train.distance_km = 2195;
    } else if (isDelhiCode(srcCode) && isUdupiCode(destCode)) {
      const depTime = train.departure_time || train.scheduled_departure_time || '14:00:00';
      mappedStops = buildStraightDelhiToUdupiStops(depTime);
      train.distance_km = 2195;
    }

    if (!mappedStops || mappedStops.length === 0) {
      if (Array.isArray(train.stops) && train.stops.length >= 2) {
        mappedStops = train.stops.map((s, idx) => {
          const stCode = String(s.stationCode || s.code || s.station || '').trim().toUpperCase();
          const stName = s.stationName || s.name || STANDARD_STATION_NAMES[stCode] || stCode;
          const dayVal = s.day !== undefined ? s.day : (s.day_offset !== undefined ? s.day_offset + 1 : 1);
          const dayOffsetVal = s.day_offset !== undefined ? s.day_offset : (dayVal - 1);
          return {
            sequence: s.sequence !== undefined ? parseInt(s.sequence, 10) : idx + 1,
            stationCode: stCode,
            stationName: stName,
            arrTime: s.arrTime || s.arrival_time || '12:00:00',
            depTime: s.depTime || s.departure_time || '12:05:00',
            day: dayVal,
            day_offset: dayOffsetVal,
            haltMinutes: s.haltMinutes !== undefined ? String(s.haltMinutes) : '5',
            distanceFromOriginKm: s.distanceFromOriginKm !== undefined ? parseFloat(s.distanceFromOriginKm) : (parseFloat(s.distance_km) || idx * 100)
          };
        });
      } else {
        const depTime = train.departure_time || train.scheduled_departure_time || '08:00:00';
        const arrTime = train.arrival_time || train.scheduled_arrival_time || '20:00:00';
        const totalDist = parseFloat(train.distance_km || 500);

        mappedStops = [
          {
            sequence: 1,
            stationCode: srcCode,
            stationName: srcName,
            arrTime: depTime,
            depTime: depTime,
            haltMinutes: '0',
            distanceFromOriginKm: 0
          },
          {
            sequence: 2,
            stationCode: destCode,
            stationName: destName,
            arrTime: arrTime,
            depTime: arrTime,
            haltMinutes: '0',
            distanceFromOriginKm: totalDist
          }
        ];
      }
    }

    train.stops = mappedStops;
    train.source_station_code = srcCode;
    train.destination_station_code = destCode;
    mockDb.trains.set(tId, train);

    let existingRoute = mockDb.routes.get(tId) || mockDb.routes.get(`r-${tNum}`) || Array.from(mockDb.routes.values()).find(r => r && (r.train_id === tId || String(r.train_number) === tNum));

    const routeId = existingRoute ? existingRoute.id : `r-${tNum || tId}`;
    const totalDist = mappedStops.length > 0 ? (mappedStops[mappedStops.length - 1].distanceFromOriginKm || 500) : 500;
    const firstStopDep = mappedStops[0]?.depTime || '08:00:00';
    const lastStopArr = mappedStops[mappedStops.length - 1]?.arrTime || '20:00:00';
    const runningDays = train.running_days || train.frequency || 'Daily';

    const routeData = {
      id: routeId,
      train_id: tId,
      train_number: tNum,
      train_name: train.train_name,
      source_station_code: srcCode,
      source_station_name: srcName,
      destination_station_code: destCode,
      destination_station_name: destName,
      departure_time: firstStopDep,
      arrival_time: lastStopArr,
      distance_km: totalDist,
      running_days: runningDays,
      status: train.status === 'inactive' ? 'Inactive' : 'Active',
      stops: mappedStops,
      created_at: existingRoute?.created_at || train.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockDb.routes.set(routeId, routeData);
    modified = true;
  }

  if (modified) {
    saveMockDbToFile();
  }
}

function backfillSchedulingFieldsAndRouteVariety() {
  let modified = false;

  // 1. Safe default migration for existing trains lacking scheduling fields
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const [tId, train] of mockDb.trains.entries()) {
    if (!train) continue;
    let trainChanged = false;

    if (!train.service_start_date) {
      train.service_start_date = '2025-01-01';
      trainChanged = true;
    }
    if (!train.service_end_date) {
      train.service_end_date = '2027-12-31';
      trainChanged = true;
    }
    if (!train.service_status) {
      train.service_status = train.status === 'inactive' ? 'INACTIVE' : 'ACTIVE';
      trainChanged = true;
    }

    const freqStr = String(train.frequency || train.running_days || 'Daily').trim();
    if (!train.frequency_type) {
      const lower = freqStr.toLowerCase();
      if (lower.includes('daily') || lower === 'all') {
        train.frequency_type = 'Daily';
      } else if (lower.includes(',') || lower.split(/\s+/).length > 1) {
        train.frequency_type = 'Selected Days';
      } else if (shortDays.some(d => lower.includes(d.toLowerCase()))) {
        train.frequency_type = 'Weekly';
      } else {
        train.frequency_type = 'Daily';
      }
      trainChanged = true;
    }

    if (!Array.isArray(train.operating_days) || train.operating_days.length === 0) {
      const lower = freqStr.toLowerCase();
      if (lower.includes('daily') || lower === 'all') {
        train.operating_days = [...shortDays];
      } else {
        const foundDays = shortDays.filter(d => lower.includes(d.toLowerCase()));
        train.operating_days = foundDays.length > 0 ? foundDays : [...shortDays];
      }
      trainChanged = true;
    }

    if (trainChanged) {
      mockDb.trains.set(tId, train);
      modified = true;
    }
  }

  // 2. Additive idempotent variety trains for UDUPI (UDU) <-> MUMBAI CENTRAL (MMCT)
  const existingNumbers = new Set();
  for (const t of mockDb.trains.values()) {
    if (t && t.train_number) existingNumbers.add(String(t.train_number));
  }

  const varietyTrains = [
    {
      id: 't-12977',
      train_number: '12977',
      train_name: 'Konkan Rajdhani Express',
      train_type: 'Rajdhani',
      source_station_code: 'UD',
      source_station_name: 'Udupi',
      destination_station_code: 'MMCT',
      destination_station_name: 'Mumbai Central',
      source: 'UD',
      destination: 'MMCT',
      departure_time: '17:55:00',
      arrival_time: '08:35:00',
      day_offset: 1,
      duration_minutes: 880,
      distance_km: 884,
      frequency: 'Daily',
      running_days: 'Daily',
      frequency_type: 'Daily',
      operating_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      service_start_date: '2025-01-01',
      service_end_date: '2027-12-31',
      service_status: 'ACTIVE',
      status: 'active',
      available_classes: ['SL', '3A', '2A', '1A'],
      base_fare: 580,
      record_source: 'system_curated_variety',
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
      stops: [
        { sequence: 1, stationCode: 'UD', stationName: 'Udupi', arrTime: '17:55:00', depTime: '17:55:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
        { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '20:10:00', depTime: '20:12:00', haltMinutes: '2', distanceFromOriginKm: 190, day_offset: 0 },
        { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '21:20:00', depTime: '21:30:00', haltMinutes: '10', distanceFromOriginKm: 250, day_offset: 0 },
        { sequence: 4, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '00:45:00', depTime: '00:50:00', haltMinutes: '5', distanceFromOriginKm: 530, day_offset: 1 },
        { sequence: 5, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '06:30:00', depTime: '06:35:00', haltMinutes: '5', distanceFromOriginKm: 810, day_offset: 1 },
        { sequence: 6, stationCode: 'TNA', stationName: 'Thane', arrTime: '07:15:00', depTime: '07:18:00', haltMinutes: '3', distanceFromOriginKm: 850, day_offset: 1 },
        { sequence: 7, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '08:35:00', depTime: '08:35:00', haltMinutes: '0', distanceFromOriginKm: 884, day_offset: 1 }
      ]
    },
    {
      id: 't-22114',
      train_number: '22114',
      train_name: 'Matsyagandha Superfast Express',
      train_type: 'Superfast',
      source_station_code: 'UD',
      source_station_name: 'Udupi',
      destination_station_code: 'MMCT',
      destination_station_name: 'Mumbai Central',
      source: 'UD',
      destination: 'MMCT',
      departure_time: '19:20:00',
      arrival_time: '12:35:00',
      day_offset: 1,
      duration_minutes: 1035,
      distance_km: 884,
      frequency: 'Mon, Wed, Fri',
      running_days: 'Mon, Wed, Fri',
      frequency_type: 'Selected Days',
      operating_days: ['Mon', 'Wed', 'Fri'],
      service_start_date: '2025-01-01',
      service_end_date: '2027-12-31',
      service_status: 'ACTIVE',
      status: 'active',
      available_classes: ['SL', '3A', '2A'],
      base_fare: 540,
      record_source: 'system_curated_variety',
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
      stops: [
        { sequence: 1, stationCode: 'UD', stationName: 'Udupi', arrTime: '19:20:00', depTime: '19:20:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
        { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '21:50:00', depTime: '21:52:00', haltMinutes: '2', distanceFromOriginKm: 190, day_offset: 0 },
        { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '23:10:00', depTime: '23:20:00', haltMinutes: '10', distanceFromOriginKm: 250, day_offset: 0 },
        { sequence: 4, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '03:30:00', depTime: '03:35:00', haltMinutes: '5', distanceFromOriginKm: 530, day_offset: 1 },
        { sequence: 5, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '09:40:00', depTime: '09:45:00', haltMinutes: '5', distanceFromOriginKm: 810, day_offset: 1 },
        { sequence: 6, stationCode: 'TNA', stationName: 'Thane', arrTime: '10:50:00', depTime: '10:53:00', haltMinutes: '3', distanceFromOriginKm: 850, day_offset: 1 },
        { sequence: 7, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '12:35:00', depTime: '12:35:00', haltMinutes: '0', distanceFromOriginKm: 884, day_offset: 1 }
      ]
    },
    {
      id: 't-20924',
      train_number: '20924',
      train_name: 'Netravati Express',
      train_type: 'Express',
      source_station_code: 'UD',
      source_station_name: 'Udupi',
      destination_station_code: 'MMCT',
      destination_station_name: 'Mumbai Central',
      source: 'UD',
      destination: 'MMCT',
      departure_time: '21:40:00',
      arrival_time: '14:10:00',
      day_offset: 1,
      duration_minutes: 990,
      distance_km: 884,
      frequency: 'Tue, Thu, Sat',
      running_days: 'Tue, Thu, Sat',
      frequency_type: 'Selected Days',
      operating_days: ['Tue', 'Thu', 'Sat'],
      service_start_date: '2025-01-01',
      service_end_date: '2027-12-31',
      service_status: 'ACTIVE',
      status: 'active',
      available_classes: ['SL', '3A'],
      base_fare: 490,
      record_source: 'system_curated_variety',
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
      stops: [
        { sequence: 1, stationCode: 'UD', stationName: 'Udupi', arrTime: '21:40:00', depTime: '21:40:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
        { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '00:15:00', depTime: '00:17:00', haltMinutes: '2', distanceFromOriginKm: 190, day_offset: 1 },
        { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '01:40:00', depTime: '01:50:00', haltMinutes: '10', distanceFromOriginKm: 250, day_offset: 1 },
        { sequence: 4, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '06:05:00', depTime: '06:10:00', haltMinutes: '5', distanceFromOriginKm: 530, day_offset: 1 },
        { sequence: 5, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '11:50:00', depTime: '11:55:00', haltMinutes: '5', distanceFromOriginKm: 810, day_offset: 1 },
        { sequence: 6, stationCode: 'TNA', stationName: 'Thane', arrTime: '12:45:00', depTime: '12:48:00', haltMinutes: '3', distanceFromOriginKm: 850, day_offset: 1 },
        { sequence: 7, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '14:10:00', depTime: '14:10:00', haltMinutes: '0', distanceFromOriginKm: 884, day_offset: 1 }
      ]
    },
    {
      id: 't-20670',
      train_number: '20670',
      train_name: 'Konkan Vande Bharat Express',
      train_type: 'Vande Bharat',
      source_station_code: 'UD',
      source_station_name: 'Udupi',
      destination_station_code: 'MMCT',
      destination_station_name: 'Mumbai Central',
      source: 'UD',
      destination: 'MMCT',
      departure_time: '06:00:00',
      arrival_time: '13:30:00',
      day_offset: 0,
      duration_minutes: 450,
      distance_km: 884,
      frequency: 'Mon, Tue, Wed, Thu, Fri, Sat',
      running_days: 'Mon, Tue, Wed, Thu, Fri, Sat',
      frequency_type: 'Selected Days',
      operating_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      service_start_date: '2025-01-01',
      service_end_date: '2027-12-31',
      service_status: 'ACTIVE',
      status: 'active',
      available_classes: ['CC', 'EC'],
      base_fare: 950,
      record_source: 'system_curated_variety',
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
      stops: [
        { sequence: 1, stationCode: 'UD', stationName: 'Udupi', arrTime: '06:00:00', depTime: '06:00:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
        { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '07:45:00', depTime: '07:47:00', haltMinutes: '2', distanceFromOriginKm: 190, day_offset: 0 },
        { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '08:45:00', depTime: '08:50:00', haltMinutes: '5', distanceFromOriginKm: 250, day_offset: 0 },
        { sequence: 4, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '10:45:00', depTime: '10:48:00', haltMinutes: '3', distanceFromOriginKm: 530, day_offset: 0 },
        { sequence: 5, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '12:30:00', depTime: '12:33:00', haltMinutes: '3', distanceFromOriginKm: 810, day_offset: 0 },
        { sequence: 6, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '13:30:00', depTime: '13:30:00', haltMinutes: '0', distanceFromOriginKm: 884, day_offset: 0 }
      ]
    },
    {
      id: 't-09058',
      train_number: '09058',
      train_name: 'Konkan AC Weekly Special',
      train_type: 'Superfast',
      source_station_code: 'UD',
      source_station_name: 'Udupi',
      destination_station_code: 'MMCT',
      destination_station_name: 'Mumbai Central',
      source: 'UD',
      destination: 'MMCT',
      departure_time: '22:15:00',
      arrival_time: '15:30:00',
      day_offset: 1,
      duration_minutes: 1035,
      distance_km: 884,
      frequency: 'Sunday',
      running_days: 'Sunday',
      frequency_type: 'Weekly',
      operating_days: ['Sun'],
      service_start_date: '2025-01-01',
      service_end_date: '2027-12-31',
      service_status: 'ACTIVE',
      status: 'active',
      available_classes: ['SL', '3A', '2A'],
      base_fare: 560,
      record_source: 'system_curated_variety',
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
      stops: [
        { sequence: 1, stationCode: 'UD', stationName: 'Udupi', arrTime: '22:15:00', depTime: '22:15:00', haltMinutes: '0', distanceFromOriginKm: 0, day_offset: 0 },
        { sequence: 2, stationCode: 'KAWR', stationName: 'Karwar', arrTime: '00:45:00', depTime: '00:47:00', haltMinutes: '2', distanceFromOriginKm: 190, day_offset: 1 },
        { sequence: 3, stationCode: 'MAO', stationName: 'Madgaon Junction', arrTime: '02:10:00', depTime: '02:20:00', haltMinutes: '10', distanceFromOriginKm: 250, day_offset: 1 },
        { sequence: 4, stationCode: 'RN', stationName: 'Ratnagiri', arrTime: '06:40:00', depTime: '06:45:00', haltMinutes: '5', distanceFromOriginKm: 530, day_offset: 1 },
        { sequence: 5, stationCode: 'PNVL', stationName: 'Panvel', arrTime: '12:50:00', depTime: '12:55:00', haltMinutes: '5', distanceFromOriginKm: 810, day_offset: 1 },
        { sequence: 6, stationCode: 'MMCT', stationName: 'Mumbai Central', arrTime: '15:30:00', depTime: '15:30:00', haltMinutes: '0', distanceFromOriginKm: 884, day_offset: 1 }
      ]
    }
  ];

  varietyTrains.forEach(newTrain => {
    if (!existingNumbers.has(newTrain.train_number)) {
      mockDb.trains.set(newTrain.id, newTrain);
      const routeId = `r-${newTrain.train_number}`;
      const routeData = {
        id: routeId,
        train_id: newTrain.id,
        train_number: newTrain.train_number,
        train_name: newTrain.train_name,
        source_station_code: newTrain.source_station_code,
        source_station_name: newTrain.source_station_name,
        destination_station_code: newTrain.destination_station_code,
        destination_station_name: newTrain.destination_station_name,
        departure_time: newTrain.departure_time,
        arrival_time: newTrain.arrival_time,
        distance_km: newTrain.distance_km,
        running_days: newTrain.running_days,
        frequency: newTrain.frequency,
        frequency_type: newTrain.frequency_type,
        operating_days: newTrain.operating_days,
        service_start_date: newTrain.service_start_date,
        service_end_date: newTrain.service_end_date,
        service_status: newTrain.service_status,
        status: 'Active',
        stops: newTrain.stops,
        created_at: newTrain.created_at,
        updated_at: newTrain.updated_at
      };
      mockDb.routes.set(routeId, routeData);
      existingNumbers.add(newTrain.train_number);
      modified = true;
    }
  });

  if (modified) {
    saveMockDbToFile();
  }
}

let fileLoaded = false;
const activeDbFilePath = getDbFilePath();
if (fs.existsSync(activeDbFilePath)) {
  try {
    const rawData = fs.readFileSync(activeDbFilePath, 'utf-8');
    const parsed = JSON.parse(rawData);
    for (const [key, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        mockDb[key] = new Map(val);
      } else {
        mockDb[key] = val;
      }
    }
    console.log(`✅ Loaded persistent local database from ${activeDbFilePath}`);
    fileLoaded = true;
    backfillRouteDistances();
    backfillCancellationLedger();
    fixDummyBookingOwnership();
    cleanAndEnrichManifestBookings();
    backfillComprehensiveRouteMaster();
    backfillSchedulingFieldsAndRouteVariety();
    process.nextTick(() => {
      if (process.env.NODE_ENV === 'test') return;
      try {
        const { generateServiceInstances } = require('../services/trainServiceInstanceService');
        generateServiceInstances(60);
      } catch (e) {
        console.error('Failed to initialize train services:', e.message);
      }
    });
    // ensureDummyBookingsExist(); // Disabled to prevent re-creation of deleted dummy seed records
  } catch (err) {
    console.error(`Failed to load ${activeDbFilePath}:`, err.message);
  }
}

function resolvePassengerNameForBooking(bookingId, passengerId, fallbackName = null) {
  const genericNames = ['passenger', 'admin', 'user', 'unknown passenger', 'valued passenger', 'undefined', 'null', ''];

  // 1. Check fallbackName if provided and non-generic
  if (fallbackName && !genericNames.includes(String(fallbackName).trim().toLowerCase())) {
    return String(fallbackName).trim();
  }

  // 2. Check seat allocations for bookingId
  if (bookingId && mockDb.seat_allocations) {
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a && a.booking_id === bookingId);
    const allocatedNames = allocations
      .map(a => a.passenger_name)
      .filter(n => n && !genericNames.includes(String(n).trim().toLowerCase()));

    if (allocatedNames.length > 0) {
      return Array.from(new Set(allocatedNames)).join(', ');
    }
  }

  // 3. Check booking object
  if (bookingId && mockDb.bookings) {
    const b = mockDb.bookings.get(bookingId);
    if (b) {
      if (b.passenger_name && !genericNames.includes(String(b.passenger_name).trim().toLowerCase())) {
        return b.passenger_name;
      }
      if (Array.isArray(b.passengers) && b.passengers.length > 0) {
        const pNames = b.passengers
          .map(p => typeof p === 'string' ? p : (p.name || p.passenger_name))
          .filter(n => n && !genericNames.includes(String(n).trim().toLowerCase()));
        if (pNames.length > 0) return pNames.join(', ');
      }
    }
  }

  // 4. Check user profile by passengerId
  if (passengerId && mockDb.profiles) {
    const profile = mockDb.profiles.get(passengerId);
    if (profile) {
      if (profile.full_name && !genericNames.includes(String(profile.full_name).trim().toLowerCase())) {
        return profile.full_name;
      }
      if (profile.name && !genericNames.includes(String(profile.name).trim().toLowerCase())) {
        return profile.name;
      }
      if (profile.email && typeof profile.email === 'string') {
        const emailName = profile.email.split('@')[0];
        if (emailName && !genericNames.includes(emailName.toLowerCase())) {
          return emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
      }
    }
  }

  // 5. Check saved_passengers
  if (passengerId && mockDb.saved_passengers) {
    const saved = Array.from(mockDb.saved_passengers.values()).find(sp => sp && (sp.user_id === passengerId || sp.passenger_id === passengerId));
    if (saved && saved.name && !genericNames.includes(String(saved.name).trim().toLowerCase())) {
      return saved.name;
    }
  }

  // 6. Deterministic realistic name fallback instead of "Passenger"
  return getDeterministicRealName(bookingId || passengerId || fallbackName);
}

function cleanAndEnrichManifestBookings() {
  const genericNames = ['passenger', 'admin', 'user', 'unknown passenger', 'valued passenger', 'undefined', 'null', ''];
  let modified = false;

  // 1. Audit & enrich mockDb.bookings
  for (const [id, booking] of mockDb.bookings.entries()) {
    if (!booking) continue;

    // Remove empty/dummy corrupt entries
    if (!booking.pnr_number || String(booking.status || '').toLowerCase() === 'dummy') {
      mockDb.bookings.delete(id);
      modified = true;
      continue;
    }

    // Check if passenger_name is missing or generic
    if (!booking.passenger_name || genericNames.includes(String(booking.passenger_name).trim().toLowerCase())) {
      booking.passenger_name = resolvePassengerNameForBooking(id, booking.passenger_id, null);
      mockDb.bookings.set(id, booking);
      modified = true;
    }

    // Assign realistic coach/seat to booking if missing or Unassigned
    if (!booking.coach_number || booking.coach_number === 'Unassigned') {
      booking.coach_number = 'B1';
      booking.seat_number = booking.seat_number && booking.seat_number !== '-' ? booking.seat_number : 24;
      booking.berth_type = booking.berth_type && booking.berth_type !== 'Unallocated' ? booking.berth_type : 'SL';
      mockDb.bookings.set(id, booking);
      modified = true;
    }
  }

  // 2. Audit & enrich mockDb.seat_allocations
  for (const [id, alloc] of mockDb.seat_allocations.entries()) {
    if (!alloc) continue;

    const b = mockDb.bookings.get(alloc.booking_id);
    
    // Check if passenger_name is generic
    if (!alloc.passenger_name || genericNames.includes(String(alloc.passenger_name).trim().toLowerCase())) {
      alloc.passenger_name = resolvePassengerNameForBooking(alloc.booking_id, alloc.passenger_id, b?.passenger_name);
      mockDb.seat_allocations.set(id, alloc);
      modified = true;
    }

    // Fix unassigned coach/seat numbers in seat_allocations
    if (!alloc.coach_number || alloc.coach_number === 'Unassigned') {
      alloc.coach_number = 'B1';
      alloc.seat_number = alloc.seat_number && alloc.seat_number !== '-' ? alloc.seat_number : 18;
      alloc.berth_type = alloc.berth_type && alloc.berth_type !== 'Unallocated' ? alloc.berth_type : 'SL';
      mockDb.seat_allocations.set(id, alloc);
      modified = true;
    }
  }

  // 3. Ensure every valid booking has at least 1 seat_allocation entry
  for (const [id, booking] of mockDb.bookings.entries()) {
    if (!booking) continue;
    const bStatus = String(booking.status || '').toLowerCase();
    if (bStatus.includes('cancel') || bStatus === 'deleted') continue;

    const existingAllocations = Array.from(mockDb.seat_allocations.values()).filter(a => a && a.booking_id === id);
    if (existingAllocations.length === 0) {
      const pName = resolvePassengerNameForBooking(id, booking.passenger_id, booking.passenger_name);
      const newAlloc = {
        id: `alloc-${id}-1`,
        booking_id: id,
        passenger_id: booking.passenger_id || 'usr-1',
        passenger_name: pName,
        passenger_age: booking.passenger_age || 34,
        passenger_gender: booking.passenger_gender || 'Male',
        coach_number: booking.coach_number && booking.coach_number !== 'Unassigned' ? booking.coach_number : 'B1',
        seat_number: booking.seat_number && booking.seat_number !== '-' ? booking.seat_number : 24,
        berth_type: booking.berth_type && booking.berth_type !== 'Unallocated' ? booking.berth_type : 'SL',
        checked_in: false,
        allocated_at: new Date().toISOString()
      };
      mockDb.seat_allocations.set(newAlloc.id, newAlloc);
      modified = true;
    }
  }

  if (modified) {
    saveMockDbToFile();
  }
}

function backfillCancellationLedger() {
  let backfilledCount = 0;
  if (!mockDb.cancellation_records) mockDb.cancellation_records = new Map();
  for (const b of mockDb.bookings.values()) {
    if (b && b.status === 'cancelled' && !mockDb.cancellation_records.has(b.id)) {
      const train = mockDb.trains.get(b.train_id);
      const originalFare = Number(b.total_fare || 1000);
      const deductionAmount = b.penalty_amount !== undefined ? Number(b.penalty_amount) : 240;
      const refundAmount = b.refund_amount !== undefined ? Number(b.refund_amount) : Math.max(0, originalFare - deductionAmount);
      
      const resolvedPassengerName = resolvePassengerNameForBooking(b.id, b.passenger_id, b.passenger_name);

      const rec = {
        id: `canc-${b.id}`,
        booking_id: b.id,
        pnr: b.pnr_number,
        passenger_id: b.passenger_id,
        passenger_name: resolvedPassengerName,
        train_id: b.train_id,
        train_number: train ? train.train_number : (b.train_number || '12952'),
        train_name: train ? train.train_name : (b.train_name || 'Express Special'),
        journey_date: b.travel_date,
        original_fare: originalFare,
        deduction_amount: deductionAmount,
        refund_amount: refundAmount,
        refund_status: (b.refund_status || 'APPROVED').toUpperCase(),
        cancellation_reason: b.cancellation_reason || 'Passenger requested cancellation',
        cancellation_type: 'passenger',
        cancelled_by_user_id: b.passenger_id,
        cancelled_by_role: 'passenger',
        cancellation_date_time: b.cancellation_date_time || b.created_at || new Date().toISOString(),
        created_at: b.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDb.cancellation_records.set(b.id, rec);
      backfilledCount++;
    }
  }

  // Repair existing records with generic or missing names
  for (const [key, rec] of mockDb.cancellation_records.entries()) {
    if (!rec) continue;
    const curName = rec.passenger_name;
    const genericNames = ['passenger', 'admin', 'user', 'unknown passenger', 'undefined', 'null', ''];
    if (!curName || genericNames.includes(String(curName).trim().toLowerCase())) {
      const resolvedName = resolvePassengerNameForBooking(rec.booking_id, rec.passenger_id, curName);
      if (resolvedName !== curName) {
        rec.passenger_name = resolvedName;
        rec.updated_at = new Date().toISOString();
        mockDb.cancellation_records.set(key, rec);
        backfilledCount++;
      }
    }
  }

  if (backfilledCount > 0) {
    saveMockDbToFile();
  }
}

function backfillRouteDistances() {
  for (const [id, route] of mockDb.routes.entries()) {
    if (!route || !Array.isArray(route.stops) || route.stops.length === 0) continue;
    const fullDist = parseFloat(route.distance_km || 1000);

    const parseTimeToMinutes = (tStr) => {
      if (!tStr) return 0;
      const clean = String(tStr).trim().split(' ')[0];
      const parts = clean.split(':');
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const getDurationMins = (depStr, arrStr) => {
      if (!depStr || !arrStr) return 180;
      const dep = parseTimeToMinutes(depStr);
      const arr = parseTimeToMinutes(arrStr);
      let diff = arr - dep;
      if (diff <= 0) diff += 24 * 60;
      return Math.max(15, diff);
    };

    const totalDuration = getDurationMins(route.departure_time, route.arrival_time);
    
    let updated = false;
    route.stops.forEach((stop, idx) => {
      if (stop.distanceFromOriginKm === undefined || stop.distanceFromOriginKm === null || isNaN(parseFloat(stop.distanceFromOriginKm))) {
        const stopDuration = getDurationMins(route.departure_time, stop.arrTime || stop.depTime);
        if (totalDuration > 0 && stopDuration > 0 && stopDuration < totalDuration) {
          const ratio = stopDuration / totalDuration;
          stop.distanceFromOriginKm = Math.round(fullDist * ratio);
        } else {
          const ratio = (idx + 1) / (route.stops.length + 1);
          stop.distanceFromOriginKm = Math.round(fullDist * ratio);
        }
        stop.distance_km = stop.distanceFromOriginKm;
        updated = true;
      }
    });
    if (updated) {
      mockDb.routes.set(id, route);
    }
  }
}

if (!isMockMode) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('⚡ Connected to LIVE Supabase at', supabaseUrl);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
  }
} else {
  if (!fileLoaded || !mockDb.catering_companies || mockDb.catering_companies.size === 0) {
    console.log('⚡ Initializing local persistent database & catering companies...');
    seedInitialMockData();
    saveMockDbToFile();
  }
}

enableAutoSave(mockDb);

async function signDocumentUrl(documentUrl) {
  if (!documentUrl) return '';
  if (String(documentUrl).startsWith('identity-documents/')) {
    if (isMockMode || !supabase) {
      return documentUrl;
    }
    try {
      const cleanPath = String(documentUrl).replace('identity-documents/', '');
      const { data, error } = await supabase.storage
        .from('identity-documents')
        .createSignedUrl(cleanPath, 300); // 5 minutes expiry
      if (error) {
        console.error('⚠️ Supabase Storage signed URL creation failed:', error.message);
        return '';
      }
      return data.signedUrl;
    } catch (err) {
      console.error('⚠️ Failed to sign document URL:', err.message);
      return '';
    }
  }
  return documentUrl;
}

async function getSystemHealthDiagnostics() {
  const isInvalidKey = !supabaseServiceKey ||
                        supabaseServiceKey.includes('your-supabase') ||
                        supabaseServiceKey.includes('your_supabase') ||
                        supabaseServiceKey.startsWith('sb_publishable_');

  const supabaseUrlStatus = supabaseUrl && !supabaseUrl.includes('mockproject') ? 'CONFIGURED' : 'NOT_CONFIGURED';
  const supabaseKeyStatus = !isInvalidKey ? 'VALID' : (supabaseServiceKey ? 'INVALID_PUBLISHABLE_OR_PLACEHOLDER' : 'NOT_CONFIGURED');
  
  let dbConnection = isMockMode ? 'MOCK_MODE_ACTIVE' : 'NOT_VERIFIED';
  let schemaStatus = isMockMode ? 'MOCK_MODE_ACTIVE' : 'NOT_VERIFIED';
  let rlsStatus = isMockMode ? 'MOCK_MODE_ACTIVE' : 'NOT_VERIFIED';
  let storageStatus = isMockMode ? 'MOCK_MODE_ACTIVE' : 'NOT_VERIFIED';

  if (!isMockMode && supabase && !isInvalidKey) {
    try {
      const { data, error } = await supabase.from('trains').select('count', { count: 'exact', head: true });
      if (error) {
        dbConnection = 'FAILED';
        schemaStatus = 'FAILED';
      } else {
        dbConnection = 'CONNECTED';
        schemaStatus = 'PASS';
        rlsStatus = 'PASS';
      }
    } catch (e) {
      dbConnection = 'FAILED';
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeStatus = (stripeKey && !stripeKey.includes('mock') && !stripeKey.includes('placeholder')) ? 'CONFIGURED' : 'MOCK_MODE';
  
  const smtpHost = process.env.SMTP_HOST;
  const emailStatus = (smtpHost && !smtpHost.includes('ethereal') && !smtpHost.includes('mock')) ? 'CONFIGURED' : 'MOCK_MODE';

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const smsStatus = (twilioSid && !twilioSid.includes('mock')) ? 'CONFIGURED' : 'MOCK_MODE';

  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiStatus = geminiKey ? 'CONFIGURED' : 'NOT_CONFIGURED';

  return {
    mode: isMockMode ? 'MOCK_MODE' : 'LIVE_PRODUCTION',
    supabase_url: supabaseUrlStatus,
    supabase_key: supabaseKeyStatus,
    database_connection: dbConnection,
    schema: schemaStatus,
    rls: rlsStatus,
    storage: storageStatus,
    stripe: stripeStatus,
    email: emailStatus,
    sms: smsStatus,
    gemini: geminiStatus
  };
}

module.exports = {
  supabase,
  isMockMode,
  mockDb,
  saveMockDbToFile,
  scheduleDebouncedSave,
  signDocumentUrl,
  getSystemHealthDiagnostics,
  resolvePassengerNameForBooking
};

