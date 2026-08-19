const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const isMockMode = !supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('mockproject.supabase.co');

let supabase;

const DB_FILE_PATH = path.join(__dirname, '../../data/db.json');

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
  notifications: new Map()
};

function saveMockDbToFile() {
  try {
    const dataToSave = {};
    for (const [key, val] of Object.entries(mockDb)) {
      if (val instanceof Map) {
        dataToSave[key] = Array.from(val.entries());
      } else {
        dataToSave[key] = val;
      }
    }
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database to file:', err.message);
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
    { id: 's155', station_code: 'TEN', station_name: 'Tirunelveli', state: 'Tamil Nadu' },
    { id: 's156', station_code: 'KCG', station_name: 'Kacheguda', state: 'Telangana' },
    { id: 's157', station_code: 'AGTL', station_name: 'Agartala', state: 'Tripura' },
    { id: 's158', station_code: 'DMR', station_name: 'Dharmanagar', state: 'Tripura' },
    { id: 's159', station_code: 'UDPT', station_name: 'Udaipur Tripura', state: 'Tripura' },
    { id: 's160', station_code: 'PRYJ', station_name: 'Prayagraj Junction', state: 'Uttar Pradesh' },
    { id: 's161', station_code: 'MTJ', station_name: 'Mathura Junction', state: 'Uttar Pradesh' },
    { id: 's162', station_code: 'DDN', station_name: 'Dehradun', state: 'Uttarakhand' },
    { id: 's163', station_code: 'HW', station_name: 'Haridwar', state: 'Uttarakhand' },
    { id: 's164', station_code: 'KGM', station_name: 'Kathgodam', state: 'Uttarakhand' },
    { id: 's165', station_code: 'RKSH', station_name: 'Rishikesh', state: 'Uttarakhand' },
    { id: 's166', station_code: 'NJP', station_name: 'New Jalpaiguri', state: 'West Bengal' },
    { id: 's167', station_code: 'DGR', station_name: 'Durgapur', state: 'West Bengal' },
    { id: 's168', station_code: 'ASN', station_name: 'Asansol', state: 'West Bengal' },
    { id: 's169', station_code: 'NZM', station_name: 'Hazrat Nizamuddin', state: 'Unknown' },
    { id: 's170', station_code: 'TBM', station_name: 'Tambaram', state: 'Unknown' },
    { id: 's171', station_code: 'BNC', station_name: 'Bengaluru Cantonment', state: 'Unknown' },
    { id: 's172', station_code: 'UDU', station_name: 'Udupi', state: 'Unknown' },
    { id: 's173', station_code: 'SHM', station_name: 'Santragachi Junction', state: 'Unknown' },
    { id: 's174', station_code: 'MLDT', station_name: 'Malda Town', state: 'Unknown' },
    { id: 's175', station_code: 'ALLP', station_name: 'Alappuzha', state: 'Unknown' }
  ];
  stationsData.forEach(s => mockDb.stations.set(s.id, s));

  // Seed trains
  const trainsData = [
    { id: 't1', train_number: '12952', train_name: 'Rajdhani Express', status: 'on_time', delay_minutes: 0 },
    { id: 't2', train_number: '12002', train_name: 'Shatabdi Express', status: 'delayed', delay_minutes: 15 },
    { id: 't3', train_number: '22436', train_name: 'Vande Bharat Express', status: 'on_time', delay_minutes: 0 },
    { id: 't4', train_number: '12301', train_name: 'Kolkata Rajdhani', status: 'cancelled', delay_minutes: 0 },
    { id: 't5', train_number: '12050', train_name: 'Gatimaan Express', status: 'on_time', delay_minutes: 0 },
    { id: 't6', train_number: '22671', train_name: 'Tejas Express', status: 'on_time', delay_minutes: 0 },
    { id: 't7', train_number: '12627', train_name: 'Karnataka Express', status: 'on_time', delay_minutes: 5 },
    { id: 't8', train_number: '12953', train_name: 'August Kranti Rajdhani', status: 'on_time', delay_minutes: 0 },
    { id: 't9', train_number: '12262', train_name: 'Howrah Duronto Express', status: 'delayed', delay_minutes: 10 },
    { id: 't10', train_number: '12216', train_name: 'Garib Rath Express', status: 'on_time', delay_minutes: 0 },
    { id: 't11', train_number: '20701', train_name: 'Secunderabad Vande Bharat', status: 'on_time', delay_minutes: 0 },
    { id: 't12', train_number: '12650', train_name: 'Karnataka Sampark Kranti', status: 'on_time', delay_minutes: 0 },
    { id: 't13', train_number: '12841', train_name: 'Coromandel Express', status: 'on_time', delay_minutes: 0 },
    { id: 't14', train_number: '12859', train_name: 'Geetanjali Express', status: 'delayed', delay_minutes: 20 },
    { id: 't15', train_number: '12615', train_name: 'Grand Trunk Express', status: 'on_time', delay_minutes: 0 },
    { id: 't16', train_number: '12001', train_name: 'Shatabdi Express', status: 'on_time', delay_minutes: 0 },
    { id: 't17', train_number: '12295', train_name: 'Sanghamitra Express', status: 'on_time', delay_minutes: 0 },
    { id: 't18', train_number: '12649', train_name: 'Sampark Kranti Express', status: 'on_time', delay_minutes: 0 },
    { id: 't19', train_number: '12951', train_name: 'Mumbai Rajdhani Express', status: 'on_time', delay_minutes: 0 },
    { id: 't20', train_number: '12622', train_name: 'Tamil Nadu Express', status: 'on_time', delay_minutes: 0 },
    { id: 't21', train_number: '12009', train_name: 'Shatabdi Express', status: 'on_time', delay_minutes: 0 },
    { id: 't22', train_number: '16316', train_name: 'Kochuveli Express', status: 'on_time', delay_minutes: 0 }
  ];
  trainsData.forEach(t => mockDb.trains.set(t.id, t));

  // Seed routes
  const routesData = [
    { id: 'r1', train_id: 't1', source_station_code: 'NDLS', destination_station_code: 'MMCT', departure_time: '16:30', arrival_time: '08:15', distance_km: 1384, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r2', train_id: 't2', source_station_code: 'NDLS', destination_station_code: 'BPL', departure_time: '06:00', arrival_time: '14:25', distance_km: 707, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r3', train_id: 't3', source_station_code: 'NDLS', destination_station_code: 'BSB', departure_time: '06:00', arrival_time: '14:00', distance_km: 759, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r4', train_id: 't4', source_station_code: 'HWH', destination_station_code: 'NDLS', departure_time: '16:55', arrival_time: '10:00', distance_km: 1450, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r5', train_id: 't5', source_station_code: 'NZM', destination_station_code: 'AGC', departure_time: '08:10', arrival_time: '09:50', distance_km: 188, fare_multiplier: 1.1, stop_sequence: 1 },
    { id: 'r6', train_id: 't6', source_station_code: 'MAS', destination_station_code: 'MDU', departure_time: '06:00', arrival_time: '12:15', distance_km: 497, fare_multiplier: 1.4, stop_sequence: 1 },
    { id: 'r7', train_id: 't7', source_station_code: 'SBC', destination_station_code: 'NDLS', departure_time: '19:20', arrival_time: '09:00', distance_km: 2400, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r8', train_id: 't8', source_station_code: 'MMCT', destination_station_code: 'NDLS', departure_time: '17:10', arrival_time: '09:43', distance_km: 1377, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r9', train_id: 't9', source_station_code: 'HWH', destination_station_code: 'CSMT', departure_time: '05:45', arrival_time: '08:15', distance_km: 1968, fare_multiplier: 1.4, stop_sequence: 1 },
    { id: 'r10', train_id: 't10', source_station_code: 'DEE', destination_station_code: 'BDTS', departure_time: '11:00', arrival_time: '07:15', distance_km: 1431, fare_multiplier: 1.0, stop_sequence: 1 },
    { id: 'r11', train_id: 't11', source_station_code: 'SC', destination_station_code: 'TPTY', departure_time: '06:00', arrival_time: '14:30', distance_km: 661, fare_multiplier: 1.4, stop_sequence: 1 },
    { id: 'r12', train_id: 't12', source_station_code: 'SBC', destination_station_code: 'NZM', departure_time: '13:50', arrival_time: '08:20', distance_km: 2378, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r13', train_id: 't13', source_station_code: 'HWH', destination_station_code: 'MAS', departure_time: '15:20', arrival_time: '16:50', distance_km: 1659, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r14', train_id: 't14', source_station_code: 'CSMT', destination_station_code: 'HWH', departure_time: '06:00', arrival_time: '12:30', distance_km: 1968, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r15', train_id: 't15', source_station_code: 'MAS', destination_station_code: 'NDLS', departure_time: '18:50', arrival_time: '06:30', distance_km: 2182, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r16', train_id: 't16', source_station_code: 'NDLS', destination_station_code: 'RKMP', departure_time: '06:00', arrival_time: '14:25', distance_km: 707, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r17', train_id: 't17', source_station_code: 'SBC', destination_station_code: 'DNR', departure_time: '09:00', arrival_time: '09:00', distance_km: 2600, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r18', train_id: 't18', source_station_code: 'YPR', destination_station_code: 'NZM', departure_time: '13:50', arrival_time: '08:20', distance_km: 2378, fare_multiplier: 1.2, stop_sequence: 1 },
    { id: 'r19', train_id: 't19', source_station_code: 'MMCT', destination_station_code: 'NDLS', departure_time: '17:00', arrival_time: '08:32', distance_km: 1384, fare_multiplier: 1.5, stop_sequence: 1 },
    { id: 'r20', train_id: 't20', source_station_code: 'NDLS', destination_station_code: 'MAS', departure_time: '21:05', arrival_time: '06:15', distance_km: 2182, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r21', train_id: 't21', source_station_code: 'MMCT', destination_station_code: 'ADI', departure_time: '06:20', arrival_time: '12:45', distance_km: 493, fare_multiplier: 1.3, stop_sequence: 1 },
    { id: 'r22', train_id: 't22', source_station_code: 'KCVL', destination_station_code: 'MYS', departure_time: '16:45', arrival_time: '11:15', distance_km: 825, fare_multiplier: 1.0, stop_sequence: 1 }
  ];
  routesData.forEach(r => mockDb.routes.set(r.id, r));

  // Seed seats for all trains
  trainsData.forEach(t => {
    const classes = ['SL', '3A', '2A', '1A'];
    classes.forEach(cls => {
      const coachNum = cls === 'SL' ? 'S1' : cls === '3A' ? 'B1' : cls === '2A' ? 'A1' : 'H1';
      for (let i = 1; i <= 24; i++) {
        const berthType = i % 6 === 1 || i % 6 === 2 ? 'LB' : i % 6 === 3 || i % 6 === 4 ? 'MB' : 'UB';
        const id = `${t.id}-${coachNum}-${i}`;
        mockDb.seats.set(id, {
          id,
          train_id: t.id,
          coach_class: cls,
          coach_number: coachNum,
          seat_number: i,
          berth_type: berthType
        });
      }
    });
  });

  // Seed registered passenger profiles
  const seededPassengers = [
    { id: 'usr-1', full_name: 'Ramesh Kumar', email: 'ramesh.kumar@gmail.com', phone: '+91 9876543210', role: 'passenger', age: 42, gender: 'Male', document_type: 'Aadhaar Card', document_number: '4829-1092-4921', document_url: 'aadhaar_ramesh.pdf', verified: true, created_at: '2023-01-12T10:00:00Z' },
    { id: 'usr-2', full_name: 'Suresh Patel', email: 'suresh.patel@yahoo.com', phone: '+91 8765432109', role: 'passenger', age: 48, gender: 'Male', document_type: 'Passport', document_number: 'Z8901234', document_url: 'passport_suresh.pdf', verified: false, created_at: '2023-08-20T14:30:00Z' },
    { id: 'usr-3', full_name: 'Anita Sharma', email: 'anita.sharma@gmail.com', phone: '+91 7654321098', role: 'passenger', age: 34, gender: 'Female', document_type: 'PAN Card', document_number: 'ABCDE1234F', document_url: 'pan_anita.pdf', verified: true, created_at: '2023-03-04T09:15:00Z' },
    { id: 'usr-4', full_name: 'Vikram Singh', email: 'vikram.singh@outlook.com', phone: '+91 6543210987', role: 'passenger', age: 29, gender: 'Male', document_type: 'Aadhaar Card', document_number: '9921-8812-3341', document_url: 'aadhaar_vikram.pdf', verified: true, created_at: '2023-10-10T11:20:00Z' },
    { id: 'usr-5', full_name: 'Neha Gupta', email: 'neha.gupta@gmail.com', phone: '+91 5432109876', role: 'passenger', age: 31, gender: 'Female', document_type: 'Passport', document_number: 'K9910293', document_url: null, verified: false, created_at: '2024-01-14T16:45:00Z' },
    { id: 'usr-6', full_name: 'Priya Sharma', email: 'priya.sharma@domain.com', phone: '+91 9123456780', role: 'passenger', age: 36, gender: 'Female', document_type: 'Aadhaar Card', document_number: '8821-3910-1029', document_url: 'aadhaar_priya.pdf', verified: true, created_at: '2023-06-01T08:00:00Z' }
  ];
  seededPassengers.forEach(p => mockDb.profiles.set(p.id, p));

  // Seed default bookings for mockDb
  const defaultTrainId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const sampleBookings = [
    {
      id: 'bk-seed-1',
      pnr_number: '2345678901',
      passenger_id: 'usr-demo-passenger',
      train_id: defaultTrainId,
      coach_class: '3A',
      total_fare: 1450,
      status: 'confirmed',
      travel_date: '2026-08-05',
      created_at: new Date().toISOString()
    },
    {
      id: 'bk-seed-2',
      pnr_number: '7462573954',
      passenger_id: 'usr-demo-passenger',
      train_id: defaultTrainId,
      coach_class: 'CC',
      total_fare: 1120,
      status: 'completed',
      travel_date: '2026-07-20',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString()
    },
    {
      id: 'bk-seed-3',
      pnr_number: '9842105731',
      passenger_id: 'usr-demo-passenger',
      train_id: defaultTrainId,
      coach_class: '3A',
      total_fare: 1680,
      status: 'cancelled',
      travel_date: '2026-07-25',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
    }
  ];

  sampleBookings.forEach(b => {
    mockDb.bookings.set(b.id, b);
    mockDb.seat_allocations.set(`alloc-${b.id}`, {
      id: `alloc-${b.id}`,
      booking_id: b.id,
      coach_number: 'B1',
      seat_number: 24,
      berth_type: 'LB',
      passenger_name: 'Passenger'
    });
    mockDb.payments.set(`pay-${b.id}`, {
      id: `pay-${b.id}`,
      booking_id: b.id,
      amount: b.total_fare,
      payment_method: 'UPI',
      status: b.status === 'cancelled' ? 'REFUNDED' : 'SUCCESS'
    });
  });
}

if (isMockMode) {
  let fileLoaded = false;
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const rawData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(rawData);
      for (const [key, val] of Object.entries(parsed)) {
        if (Array.isArray(val)) {
          mockDb[key] = new Map(val);
        } else {
          mockDb[key] = val;
        }
      }
      console.log('✅ Loaded persistent local database from backend/data/db.json');
      fileLoaded = true;
    } catch (err) {
      console.error('Failed to load db.json, re-seeding default database:', err.message);
    }
  }

  if (!fileLoaded) {
    console.log('⚡ Initializing and seeding local persistent database...');
    seedInitialMockData();
    saveMockDbToFile();
  }

  enableAutoSave(mockDb);
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err.message);
  }
}

module.exports = {
  supabase,
  isMockMode,
  mockDb,
  saveMockDbToFile
};

