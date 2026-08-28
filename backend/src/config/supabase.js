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
  audit_logs: new Map()
};

let isSavingFile = false;
let pendingSaveRequest = false;

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
    fs.writeFileSync(tmpFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
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
    if (val instanceof Map) {
      const origSet = val.set.bind(val);
      const origDelete = val.delete.bind(val);
      const origClear = val.clear.bind(val);

      val.set = function(...args) {
        const res = origSet(...args);
        saveMockDbToFile();
        return res;
      };
      val.delete = function(...args) {
        const res = origDelete(...args);
        saveMockDbToFile();
        return res;
      };
      val.clear = function(...args) {
        const res = origClear(...args);
        saveMockDbToFile();
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
    { id: 's172', station_code: 'UDU', station_name: 'Udupi', state: 'Karnataka' }
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
  const defaultTrainId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const dedicatedDemoUserId = 'usr-demo-test-account';

  if (!mockDb.trains.has('train-udupi-12345')) {
    mockDb.trains.set('train-udupi-12345', {
      id: 'train-udupi-12345',
      train_number: '12345',
      train_name: 'Udupi Express',
      source: 'UDU',
      destination: 'NDLS',
      source_station_code: 'UDU',
      destination_station_code: 'NDLS',
      status: 'on_time'
    });
  }

  const dummyBookings = [
    {
      id: 'bk-seed-upcoming',
      pnr_number: '8819203941',
      passenger_id: dedicatedDemoUserId,
      train_id: defaultTrainId,
      coach_class: '3A',
      total_fare: 1450,
      status: 'confirmed',
      travel_date: '2026-09-15',
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
  } catch (err) {
    console.error(`Failed to load ${activeDbFilePath}:`, err.message);
  }
}

function resolvePassengerNameForBooking(bookingId, passengerId, fallbackName = null) {
  const genericNames = ['passenger', 'admin', 'user', 'unknown passenger', 'undefined', 'null', ''];

  // 1. Check seat allocations for bookingId
  if (bookingId && mockDb.seat_allocations) {
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(a => a && a.booking_id === bookingId);
    const allocatedNames = allocations
      .map(a => a.passenger_name)
      .filter(n => n && !genericNames.includes(String(n).trim().toLowerCase()));

    if (allocatedNames.length > 0) {
      return Array.from(new Set(allocatedNames)).join(', ');
    }
  }

  // 2. Check booking object
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

  // 3. Check user profile by passengerId
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
          return emailName;
        }
      }
    }
  }

  // 4. Check saved_passengers
  if (passengerId && mockDb.saved_passengers) {
    const saved = Array.from(mockDb.saved_passengers.values()).find(sp => sp && (sp.user_id === passengerId || sp.passenger_id === passengerId));
    if (saved && saved.name && !genericNames.includes(String(saved.name).trim().toLowerCase())) {
      return saved.name;
    }
  }

  // 5. Check fallbackName if provided and non-generic
  if (fallbackName && !genericNames.includes(String(fallbackName).trim().toLowerCase())) {
    return fallbackName;
  }

  // 6. Final fallback
  return 'Unknown Passenger';
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
  signDocumentUrl,
  getSystemHealthDiagnostics,
  resolvePassengerNameForBooking
};

