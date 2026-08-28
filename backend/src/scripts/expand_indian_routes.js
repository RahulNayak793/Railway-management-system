const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');
const backupPath = path.join(__dirname, '../../data/db.json.backup_all_indian_routes');

console.log('=== INDIAN RAILWAY ROUTE NETWORK EXPANSION ===');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Error: backend/data/db.json does not exist!');
  process.exit(1);
}

// 1. Create Backup first (do not overwrite if backup exists, or save unique backup)
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup successfully created at: ${backupPath}`);
  console.log(`   Backup File size: ${fs.statSync(backupPath).size} bytes`);
} else {
  console.log(`ℹ️ Backup already exists at: ${backupPath} (${fs.statSync(backupPath).size} bytes)`);
}

// 2. Read database
const rawData = fs.readFileSync(dbPath, 'utf-8');
const data = JSON.parse(rawData);

const routesMap = new Map(data.routes || []);
const trainsMap = new Map(data.trains || []);
const stationsMap = new Map(data.stations || []);

const initialRoutesCount = routesMap.size;
const initialTrainsCount = trainsMap.size;
const initialBookingsCount = (data.bookings || []).length;
const initialPassengersCount = (data.profiles || []).length;

console.log(`\nInitial System Status:`);
console.log(`  - Total Stations: ${stationsMap.size}`);
console.log(`  - Total Routes: ${initialRoutesCount}`);
console.log(`  - Total Trains: ${initialTrainsCount}`);
console.log(`  - Total Bookings: ${initialBookingsCount}`);
console.log(`  - Total Passengers: ${initialPassengersCount}`);

// Station name lookup map
const stationLookup = new Map();
stationsMap.forEach((st) => {
  if (st && st.station_code) {
    stationLookup.set(st.station_code.toUpperCase(), {
      code: st.station_code.toUpperCase(),
      name: st.station_name,
      state: st.state || ''
    });
  }
});

// Helper for station names
function getStationName(code) {
  const clean = (code || '').toUpperCase();
  if (stationLookup.has(clean)) {
    return stationLookup.get(clean).name;
  }
  const fallback = {
    'NDLS': 'New Delhi', 'MMCT': 'Mumbai Central', 'CSMT': 'Chhatrapati Shivaji Maharaj Terminus',
    'HWH': 'Howrah Junction', 'SBC': 'KSR Bengaluru City', 'MAS': 'MGR Chennai Central',
    'ADI': 'Ahmedabad Junction', 'PNBE': 'Patna Junction', 'JAT': 'Jammu Tawi', 'JP': 'Jaipur Junction',
    'HYB': 'Hyderabad Deccan', 'SC': 'Secunderabad Junction', 'CNB': 'Kanpur Central', 'GKP': 'Gorakhpur Junction',
    'BSB': 'Varanasi Junction', 'LKO': 'Lucknow Charbagh', 'CBE': 'Coimbatore Junction', 'TVC': 'Thiruvananthapuram Central',
    'GHY': 'Guwahati Junction', 'BPL': 'Bhopal Junction', 'PUNE': 'Pune Junction', 'NGP': 'Nagpur Junction',
    'BBS': 'Bhubaneswar', 'VSKP': 'Visakhapatnam Junction', 'BZA': 'Vijayawada Junction', 'ASR': 'Amritsar Junction',
    'CDG': 'Chandigarh Junction', 'LTT': 'Lokmanya Tilak Terminus', 'KYN': 'Kalyan Junction', 'BDTS': 'Bandra Terminus',
    'TATA': 'Tatanagar Junction', 'KGP': 'Kharagpur Junction', 'SDAH': 'Sealdah', 'KOAA': 'Kolkata',
    'MS': 'Chennai Egmore', 'MDU': 'Madurai Junction', 'ERS': 'Ernakulam Junction', 'AGC': 'Agra Cantt',
    'VGLJ': 'VGL Jhansi Junction', 'KOTA': 'Kota Junction', 'RTM': 'Ratlam Junction', 'BRC': 'Vadodara Junction',
    'SUR': 'Solapur Junction', 'ET': 'Itarsi Junction', 'JBP': 'Jabalpur Junction', 'DDU': 'Pt Deen Dayal Upadhyaya',
    'GAYA': 'Gaya Junction', 'R': 'Raipur Junction', 'BSP': 'Bilaspur Junction', 'DLI': 'Old Delhi Junction',
    'ANVT': 'Anand Vihar Terminal', 'GZB': 'Ghaziabad Junction', 'GWL': 'Gwalior Junction', 'UJN': 'Ujjain Junction',
    'INDB': 'Indore Junction', 'ST': 'Surat', 'ANND': 'Anand Junction', 'VAPI': 'Vapi', 'BL': 'Valsad',
    'YPR': 'Yesvantpur Junction', 'MYS': 'Mysuru Junction', 'UBL': 'SSS Hubballi Junction', 'TPJ': 'Tiruchchirappalli',
    'ED': 'Erode Junction', 'SA': 'Salem Junction', 'TCR': 'Thrissur', 'QLN': 'Kollam Junction', 'PGT': 'Palakkad Junction',
    'SRR': 'Shoranur Junction', 'AWY': 'Aluva', 'RU': 'Renigunta Junction', 'TPTY': 'Tirupati', 'NLR': 'Nellore',
    'OGL': 'Ongole', 'TEL': 'Tenali Junction', 'WL': 'Warangal', 'KZJ': 'Kazipet Junction', 'BPQ': 'Balharshah',
    'SEGM': 'Sewagram Junction', 'BSL': 'Bhusaval Junction', 'JSG': 'Jharsuguda Junction', 'ROU': 'Rourkela Junction',
    'CTC': 'Cuttack', 'BAM': 'Brahmapur', 'VZM': 'Vizianagaram Junction', 'RJY': 'Rajahmundry', 'SPJ': 'Samastipur',
    'DBG': 'Darbhanga Junction', 'GD': 'Gonda Junction', 'DEC': 'Delhi Cantt', 'GNT': 'Guntur', 'UDU': 'Udupi',
    'MAO': 'Madgaon', 'MAQ': 'Mangaluru Central', 'RNC': 'Ranchi', 'DHN': 'Dhanbad', 'DBRG': 'Dibrugarh',
    'SCL': 'Silchar', 'NTSK': 'New Tinsukia', 'LMG': 'Lumding', 'DURG': 'Durg', 'KRBA': 'Korba', 'RIG': 'Raigarh',
    'RJT': 'Rajkot', 'BVC': 'Bhavnagar', 'GNC': 'Gandhinagar', 'JAM': 'Jamnagar', 'UMB': 'Ambala Cantt',
    'PNP': 'Panipat', 'HSR': 'Hisar', 'ROK': 'Rohtak', 'KKDE': 'Kurukshetra', 'SML': 'Shimla', 'KLK': 'Kalka',
    'UHL': 'Una Himachal', 'BKSC': 'Bokaro Steel City', 'BGM': 'Belagavi', 'SMET': 'Shivamogga', 'CLT': 'Kozhikode',
    'KTYM': 'Kottayam', 'CAN': 'Kannur', 'DR': 'Dadar', 'NK': 'Nashik Road', 'AWB': 'Aurangabad', 'DMV': 'Dimapur',
    'PURI': 'Puri', 'SBP': 'Sambalpur', 'BLS': 'Balasore', 'LDH': 'Ludhiana', 'JUC': 'Jalandhar City',
    'PTK': 'Pathankot', 'BTI': 'Bathinda', 'JU': 'Jodhpur', 'UDZ': 'Udaipur City', 'AII': 'Ajmer', 'BKN': 'Bikaner',
    'PRYJ': 'Prayagraj Junction', 'NZM': 'Hazrat Nizamuddin', 'TBM': 'Tambaram', 'BNC': 'Bengaluru Cantonment'
  };
  return fallback[clean] || clean;
}

// Generate route signature helper
function getRouteSignature(src, dest, stops = []) {
  const cleanSrc = (src || '').trim().toUpperCase();
  const cleanDest = (dest || '').trim().toUpperCase();
  const stopsSig = (stops || []).map(s => (s.stationCode || s.station_code || s.code || '').trim().toUpperCase()).filter(Boolean).join('|');
  return `${cleanSrc}|${cleanDest}|${stopsSig}`;
}

// Existing signatures set
const existingSignatures = new Set();
routesMap.forEach((r) => {
  if (r && r.source_station_code && r.destination_station_code) {
    const sig = getRouteSignature(r.source_station_code, r.destination_station_code, r.stops);
    existingSignatures.add(sig);
  }
});

// Corridor Definitions for Indian Railway Network
const corridors = [
  // 1. Delhi - Mumbai Main Line via Western Railway (NDLS - MMCT)
  { nodes: ['NDLS', 'AGC', 'GWL', 'VGLJ', 'BPL', 'RTM', 'BRC', 'ST', 'MMCT'], avgSpeed: 75 },
  { nodes: ['NDLS', 'DEC', 'JP', 'AII', 'RTM', 'BRC', 'ST', 'BDTS'], avgSpeed: 70 },
  { nodes: ['ANVT', 'GZB', 'AGC', 'KOTA', 'RTM', 'ST', 'MMCT'], avgSpeed: 72 },

  // 2. Delhi - Kolkata Main Line (NDLS - HWH)
  { nodes: ['NDLS', 'GZB', 'CNB', 'PRYJ', 'DDU', 'GAYA', 'DHN', 'HWH'], avgSpeed: 78 },
  { nodes: ['NDLS', 'CNB', 'LKO', 'BSB', 'DDU', 'PNBE', 'ASN', 'SDAH'], avgSpeed: 70 },
  { nodes: ['ANVT', 'CNB', 'PRYJ', 'DDU', 'GAYA', 'KGP', 'HWH'], avgSpeed: 72 },

  // 3. Delhi - Chennai Main Line (Grand Trunk Express) (NDLS - MAS)
  { nodes: ['NDLS', 'AGC', 'GWL', 'VGLJ', 'BPL', 'NGP', 'BPQ', 'WL', 'KZJ', 'BZA', 'MAS'], avgSpeed: 70 },
  { nodes: ['NZM', 'VGLJ', 'BPL', 'NGP', 'BPQ', 'BZA', 'NLR', 'MAS'], avgSpeed: 72 },

  // 4. Delhi - Bengaluru Main Line (NDLS - SBC)
  { nodes: ['NDLS', 'AGC', 'VGLJ', 'BPL', 'NGP', 'BPQ', 'SC', 'ATP', 'YPR', 'SBC'], avgSpeed: 68 },
  { nodes: ['NZM', 'KOTA', 'RTM', 'BRC', 'PUNE', 'SUR', 'UBL', 'SBC'], avgSpeed: 65 },

  // 5. Delhi - Hyderabad / Secunderabad (NDLS - SC)
  { nodes: ['NDLS', 'AGC', 'GWL', 'VGLJ', 'BPL', 'NGP', 'BPQ', 'KZJ', 'SC'], avgSpeed: 72 },
  { nodes: ['NZM', 'VGLJ', 'BPL', 'NGP', 'BPQ', 'WL', 'HYB'], avgSpeed: 70 },

  // 6. Delhi - Ahmedabad Main Line (NDLS - ADI)
  { nodes: ['NDLS', 'DEC', 'JP', 'AII', 'RTM', 'ADI'], avgSpeed: 75 },
  { nodes: ['NDLS', 'JP', 'UDZ', 'ADI'], avgSpeed: 65 },

  // 7. Delhi - Punjab / Jammu Line (NDLS - JAT)
  { nodes: ['NDLS', 'PNP', 'UMB', 'LDH', 'JUC', 'ASR'], avgSpeed: 75 },
  { nodes: ['NDLS', 'PNP', 'UMB', 'LDH', 'PTK', 'JAT'], avgSpeed: 70 },
  { nodes: ['NDLS', 'CDG'], avgSpeed: 80 },

  // 8. Delhi - UP / Bihar Corridors
  { nodes: ['NDLS', 'GZB', 'CNB', 'LKO', 'GD', 'GKP'], avgSpeed: 65 },
  { nodes: ['NDLS', 'CNB', 'PRYJ', 'BSB'], avgSpeed: 70 },
  { nodes: ['ANVT', 'CNB', 'PRYJ', 'DDU', 'DNR', 'PNBE'], avgSpeed: 72 },
  { nodes: ['NDLS', 'CNB', 'PRYJ', 'DDU', 'BJU', 'SPJ', 'DBG'], avgSpeed: 62 },

  // 9. Mumbai - Pune - Southern Corridors
  { nodes: ['MMCT', 'KYN', 'PUNE', 'SUR', 'UBL', 'SBC'], avgSpeed: 65 },
  { nodes: ['DR', 'KYN', 'PUNE', 'SUR', 'SC', 'HYB'], avgSpeed: 68 },
  { nodes: ['CSMT', 'KYN', 'PUNE', 'SUR', 'WADI', 'BZA'], avgSpeed: 65 },

  // 10. Konkan Railway Corridor (Mumbai - Goa - Mangaluru - Kerala)
  { nodes: ['LTT', 'KYN', 'NK', 'PUNE', 'THVM', 'KRMI', 'MAO', 'UDU', 'MAQ'], avgSpeed: 60 },
  { nodes: ['CSMT', 'DR', 'MAO', 'UDU', 'MAQ', 'CAN', 'CLT', 'SRR', 'ERS', 'TVC'], avgSpeed: 62 },
  { nodes: ['MAO', 'UDU', 'MAQ', 'CAN', 'CLT', 'SRR', 'PGT', 'CBE'], avgSpeed: 60 },

  // 11. Bengaluru - Chennai - South Corridors
  { nodes: ['SBC', 'BNC', 'JTJ', 'KPD', 'AJJ', 'MAS'], avgSpeed: 70 },
  { nodes: ['SBC', 'BNC', 'JTJ', 'SA', 'ED', 'CBE'], avgSpeed: 68 },
  { nodes: ['SBC', 'MYS'], avgSpeed: 72 },
  { nodes: ['SBC', 'SMET', 'MAQ', 'UDU'], avgSpeed: 55 },
  { nodes: ['SBC', 'BNC', 'SA', 'ED', 'PGT', 'TCR', 'AWY', 'ERS', 'KTYM', 'QLN', 'TVC'], avgSpeed: 62 },

  // 12. Chennai - Andhra / Telangana - Eastern Corridors
  { nodes: ['MAS', 'NLR', 'OGL', 'TEL', 'BZA', 'RJY', 'VSKP'], avgSpeed: 70 },
  { nodes: ['MAS', 'NLR', 'OGL', 'BZA', 'WL', 'KZJ', 'SC'], avgSpeed: 72 },
  { nodes: ['MAS', 'RU', 'TPTY', 'ATP', 'DMM', 'SBC'], avgSpeed: 65 },
  { nodes: ['MS', 'TBM', 'TPJ', 'MDU', 'TVC'], avgSpeed: 65 },

  // 13. Kolkata / Howrah - South / Odisha Corridors
  { nodes: ['HWH', 'KGP', 'BLS', 'CTC', 'BBS', 'PURI'], avgSpeed: 68 },
  { nodes: ['HWH', 'KGP', 'BLS', 'CTC', 'BBS', 'BAM', 'VZM', 'VSKP'], avgSpeed: 70 },
  { nodes: ['HWH', 'KGP', 'BLS', 'CTC', 'BBS', 'VSKP', 'BZA', 'MAS'], avgSpeed: 68 },
  { nodes: ['HWH', 'KGP', 'TATA', 'RNC', 'BKSC', 'DHN'], avgSpeed: 65 },

  // 14. Kolkata / Howrah - Northeast Corridors
  { nodes: ['HWH', 'SDAH', 'DGR', 'ASN', 'NJP', 'LMG', 'GHY'], avgSpeed: 62 },
  { nodes: ['GHY', 'LMG', 'JTTN', 'NTSK', 'DBRG'], avgSpeed: 55 },
  { nodes: ['GHY', 'LMG', 'SCL'], avgSpeed: 50 },

  // 15. Central India Corridors (Nagpur / Bhopal / Raipur / Indore / Jhansi)
  { nodes: ['NGP', 'ET', 'BPL', 'VGLJ', 'GWL', 'AGC', 'NDLS'], avgSpeed: 72 },
  { nodes: ['BPL', 'UJN', 'INDB'], avgSpeed: 68 },
  { nodes: ['BPL', 'ET', 'JBP', 'DDU'], avgSpeed: 65 },
  { nodes: ['NGP', 'SEGM', 'R', 'BSP', 'RIG', 'JSG', 'ROU', 'TATA', 'HWH'], avgSpeed: 68 },

  // 16. Western Gujarat & Rajasthan Corridors
  { nodes: ['ADI', 'ANND', 'BRC', 'ST', 'VAPI', 'MMCT'], avgSpeed: 75 },
  { nodes: ['ADI', 'RJT', 'JAM'], avgSpeed: 70 },
  { nodes: ['ADI', 'GNC'], avgSpeed: 65 },
  { nodes: ['JP', 'AII', 'JU', 'BKN'], avgSpeed: 65 },
  { nodes: ['JP', 'AII', 'UDZ'], avgSpeed: 62 },

  // 17. Hyderabad / Telangana Internal Connections
  { nodes: ['HYB', 'SC', 'KZJ', 'WL', 'BZA', 'GNT'], avgSpeed: 70 },
  { nodes: ['SC', 'WADI', 'SUR', 'PUNE'], avgSpeed: 68 },
  { nodes: ['SC', 'KZJ', 'BPQ', 'NGP'], avgSpeed: 72 }
];

// Helper to compute node distances
const distanceBetweenNodesMap = {
  'NDLS_AGC': 188, 'AGC_GWL': 118, 'GWL_VGLJ': 98, 'VGLJ_BPL': 292, 'BPL_RTM': 240, 'RTM_BRC': 260, 'BRC_ST': 130, 'ST_MMCT': 263,
  'NDLS_DEC': 14, 'DEC_JP': 294, 'JP_AII': 135, 'AII_RTM': 375, 'RTM_ADI': 260, 'ST_BDTS': 252,
  'ANVT_GZB': 13, 'GZB_AGC': 180, 'AGC_KOTA': 330, 'KOTA_RTM': 266,
  'NDLS_GZB': 25, 'GZB_CNB': 415, 'CNB_PRYJ': 194, 'PRYJ_DDU': 153, 'DDU_GAYA': 205, 'GAYA_DHN': 200, 'DHN_HWH': 259,
  'CNB_LKO': 72, 'LKO_BSB': 300, 'BSB_DDU': 18, 'DDU_PNBE': 212, 'PNBE_ASN': 330, 'ASN_SDAH': 210, 'GAYA_KGP': 380, 'KGP_HWH': 115,
  'BPL_NGP': 390, 'NGP_BPQ': 208, 'BPQ_WL': 235, 'WL_KZJ': 15, 'KZJ_BZA': 215, 'BZA_MAS': 430,
  'BPQ_BZA': 450, 'BZA_NLR': 290, 'NLR_MAS': 175,
  'BPQ_SC': 360, 'SC_ATP': 360, 'ATP_YPR': 210, 'YPR_SBC': 6,
  'PUNE_SUR': 335, 'SUR_UBL': 350, 'UBL_SBC': 470, 'SC_HYB': 10,
  'JP_UDZ': 430, 'UDZ_ADI': 300,
  'PNP_UMB': 110, 'UMB_LDH': 114, 'LDH_JUC': 57, 'JUC_ASR': 78, 'LDH_PTK': 165, 'PTK_JAT': 108, 'UMB_CDG': 45,
  'LKO_GD': 120, 'GD_GKP': 152, 'DDU_DNR': 202, 'DNR_PNBE': 10, 'DDU_BJU': 240, 'BJU_SPJ': 50, 'SPJ_DBG': 37,
  'MMCT_KYN': 54, 'KYN_PUNE': 138, 'SUR_SC': 345, 'SUR_WADI': 150, 'WADI_BZA': 520,
  'KYN_NK': 115, 'NK_BSL': 240, 'BSL_SEGM': 310, 'SEGM_NGP': 76, 'BSL_ET': 307, 'NK_PUNE': 210,
  'PUNE_THVM': 410, 'THVM_KRMI': 20, 'KRMI_MAO': 35, 'MAO_UDU': 280, 'UDU_MAQ': 60,
  'DR_MAO': 570, 'MAQ_CAN': 135, 'CAN_CLT': 88, 'CLT_SRR': 86, 'SRR_ERS': 107, 'ERS_TVC': 220,
  'SRR_PGT': 44, 'PGT_CBE': 55,
  'SBC_BNC': 4, 'BNC_JTJ': 140, 'JTJ_KPD': 84, 'KPD_AJJ': 60, 'AJJ_MAS': 68,
  'JTJ_SA': 120, 'SA_ED': 60, 'ED_CBE': 100, 'SBC_MYS': 138, 'SBC_SMET': 274, 'SMET_MAQ': 210,
  'ED_PGT': 100, 'PGT_TCR': 56, 'TCR_AWY': 55, 'AWY_ERS': 17, 'ERS_KTYM': 60, 'KTYM_QLN': 96, 'QLN_TVC': 65,
  'MAS_NLR': 175, 'NLR_OGL': 116, 'OGL_TEL': 108, 'TEL_BZA': 32, 'BZA_RJY': 150, 'RJY_VSKP': 200,
  'BZA_WL': 215, 'WL_KZJ': 15, 'MAS_RU': 135, 'RU_TPTY': 10, 'TPTY_ATP': 240, 'ATP_DMM': 40, 'DMM_SBC': 170,
  'MS_TBM': 25, 'TBM_TPJ': 310, 'TPJ_MDU': 160, 'MDU_TVC': 300,
  'HWH_KGP': 115, 'KGP_BLS': 116, 'BLS_CTC': 180, 'CTC_BBS': 27, 'BBS_PURI': 63,
  'BBS_BAM': 165, 'BAM_VZM': 210, 'VZM_VSKP': 60,
  'KGP_TATA': 134, 'TATA_RNC': 170, 'RNC_BKSC': 115, 'BKSC_DHN': 48,
  'HWH_SDAH': 5, 'SDAH_DGR': 170, 'DGR_ASN': 25, 'ASN_NJP': 430, 'NJP_LMG': 380, 'LMG_GHY': 180,
  'GHY_LMG': 180, 'LMG_JTTN': 170, 'JTTN_NTSK': 160, 'NTSK_DBRG': 42, 'LMG_SCL': 185,
  'NGP_ET': 298, 'ET_BPL': 92, 'BPL_UJN': 183, 'UJN_INDB': 62, 'JBP_DDU': 520, 'ET_JBP': 245,
  'SEGM_R': 280, 'R_BSP': 110, 'BSP_RIG': 132, 'RIG_JSG': 72, 'JSG_ROU': 100, 'ROU_TATA': 166,
  'ADI_ANND': 65, 'ANND_BRC': 35, 'ADI_RJT': 247, 'RJT_JAM': 85, 'ADI_GNC': 30,
  'JU_BKN': 250, 'HYB_SC': 10, 'SC_KZJ': 132, 'BZA_GNT': 32
};

function getDistanceBetween(st1, st2) {
  const key1 = `${st1}_${st2}`;
  const key2 = `${st2}_${st1}`;
  if (distanceBetweenNodesMap[key1]) return distanceBetweenNodesMap[key1];
  if (distanceBetweenNodesMap[key2]) return distanceBetweenNodesMap[key2];
  return 120; // Default fallback average distance per segment
}

let addedRoutesCount = 0;
let skippedDuplicatesCount = 0;
let generatedRouteSamples = [];

function buildRouteFromSegmentNodes(nodeList, isReverse = false) {
  const nodes = isReverse ? [...nodeList].reverse() : [...nodeList];
  if (nodes.length < 2) return null;

  const srcCode = nodes[0];
  const destCode = nodes[nodes.length - 1];
  const srcName = getStationName(srcCode);
  const destName = getStationName(destCode);

  // Compute total distance & cumulative stop distances
  let totalDist = 0;
  const stopDistances = [0];

  for (let i = 0; i < nodes.length - 1; i++) {
    const segDist = getDistanceBetween(nodes[i], nodes[i + 1]);
    totalDist += segDist;
    stopDistances.push(totalDist);
  }

  // Calculate duration in minutes (average 65 km/h + 5 mins per stop)
  const durationMins = Math.round((totalDist / 65) * 60) + ((nodes.length - 2) * 8) + 40;
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const estimatedDuration = `${hours}h ${String(mins).padStart(2, '0')}m`;

  // Build intermediate stops array
  const stops = [];
  const startHour = isReverse ? 14 : 8;

  for (let i = 1; i < nodes.length - 1; i++) {
    const stCode = nodes[i];
    const stDist = stopDistances[i];
    const stopMinsFromStart = Math.round((stDist / totalDist) * durationMins);

    let arrH = (startHour + Math.floor(stopMinsFromStart / 60)) % 24;
    let arrM = stopMinsFromStart % 60;
    let depM = (arrM + 5) % 60;
    let depH = arrM + 5 >= 60 ? (arrH + 1) % 24 : arrH;

    const arrTime = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}:00`;
    const depTime = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}:00`;

    stops.push({
      sequence: i,
      stationCode: stCode,
      stationName: getStationName(stCode),
      arrTime: arrTime,
      depTime: depTime,
      haltMinutes: '5',
      distanceFromOriginKm: stDist
    });
  }

  const sig = getRouteSignature(srcCode, destCode, stops);
  if (existingSignatures.has(sig)) {
    skippedDuplicatesCount++;
    return null;
  }

  existingSignatures.add(sig);

  const routeId = `r-${srcCode.toLowerCase()}-${destCode.toLowerCase()}-${Math.random().toString(36).substr(2, 6)}`;
  const nowIso = new Date().toISOString();

  const routeObj = {
    id: routeId,
    source_station_code: srcCode,
    source_station_name: srcName,
    destination_station_code: destCode,
    destination_station_name: destName,
    distance_km: totalDist,
    duration_minutes: durationMins,
    departure_time: `${String(startHour).padStart(2, '0')}:00:00`,
    arrival_time: `${String((startHour + hours) % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`,
    estimated_duration: estimatedDuration,
    status: 'Active',
    stops: stops,
    created_at: nowIso,
    updated_at: nowIso
  };

  routesMap.set(routeId, routeObj);
  addedRoutesCount++;

  if (generatedRouteSamples.length < 30) {
    generatedRouteSamples.push(`${srcCode} ➔ ${destCode} (${totalDist} km, ${estimatedDuration}, ${stops.length} stops)`);
  }

  return routeObj;
}

// Generate forward and reverse routes from all corridors and sub-segments
console.log('\n--- 🚂 GENERATING EXPANDED INDIAN RAILWAY CORRIDOR ROUTES ---');

corridors.forEach((corr) => {
  const nodes = corr.nodes;
  // Whole corridor forward & reverse
  buildRouteFromSegmentNodes(nodes, false);
  buildRouteFromSegmentNodes(nodes, true);

  // Sub-segments of length >= 3 for major regional connectivity
  if (nodes.length >= 4) {
    for (let i = 0; i < nodes.length - 2; i += 2) {
      for (let j = i + 3; j <= nodes.length; j += 2) {
        const sub = nodes.slice(i, j);
        if (sub.length >= 3) {
          buildRouteFromSegmentNodes(sub, false);
          buildRouteFromSegmentNodes(sub, true);
        }
      }
    }
  }
});

// Additional major direct & 1-stop point-to-point routes between key hubs
const majorHubs = [
  'NDLS', 'MMCT', 'HWH', 'MAS', 'SBC', 'ADI', 'PNBE', 'JP', 'HYB', 'SC', 'CNB', 'LKO',
  'BSB', 'TVC', 'ERS', 'GHY', 'BPL', 'PUNE', 'NGP', 'BBS', 'VSKP', 'BZA', 'ASR', 'JAT',
  'CDG', 'RNC', 'MAO', 'MAQ', 'UDU', 'PRYJ', 'AGC', 'VGLJ', 'KOTA', 'RTM', 'BRC', 'ST'
];

for (let i = 0; i < majorHubs.length; i++) {
  for (let j = i + 1; j < majorHubs.length; j++) {
    const h1 = majorHubs[i];
    const h2 = majorHubs[j];
    // Check if direct or 1-stop route should be created
    const sig1 = `${h1}|${h2}|`;
    const sig2 = `${h2}|${h1}|`;

    if (!existingSignatures.has(sig1)) {
      const dist = getDistanceBetween(h1, h2) * 2 + 150;
      const durMins = Math.round((dist / 65) * 60) + 30;
      const hours = Math.floor(durMins / 60);
      const mins = durMins % 60;
      const rId1 = `r-${h1.toLowerCase()}-${h2.toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`;
      const nowIso = new Date().toISOString();

      routesMap.set(rId1, {
        id: rId1,
        source_station_code: h1,
        source_station_name: getStationName(h1),
        destination_station_code: h2,
        destination_station_name: getStationName(h2),
        distance_km: dist,
        duration_minutes: durMins,
        departure_time: '09:00:00',
        arrival_time: `${String((9 + hours) % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`,
        estimated_duration: `${hours}h ${String(mins).padStart(2, '0')}m`,
        status: 'Active',
        stops: [],
        created_at: nowIso,
        updated_at: nowIso
      });
      existingSignatures.add(sig1);
      addedRoutesCount++;
      if (generatedRouteSamples.length < 30) {
        generatedRouteSamples.push(`${h1} ➔ ${h2} (${dist} km, Direct)`);
      }
    }

    if (!existingSignatures.has(sig2)) {
      const dist = getDistanceBetween(h2, h1) * 2 + 150;
      const durMins = Math.round((dist / 65) * 60) + 30;
      const hours = Math.floor(durMins / 60);
      const mins = durMins % 60;
      const rId2 = `r-${h2.toLowerCase()}-${h1.toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`;
      const nowIso = new Date().toISOString();

      routesMap.set(rId2, {
        id: rId2,
        source_station_code: h2,
        source_station_name: getStationName(h2),
        destination_station_code: h1,
        destination_station_name: getStationName(h1),
        distance_km: dist,
        duration_minutes: durMins,
        departure_time: '15:00:00',
        arrival_time: `${String((15 + hours) % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`,
        estimated_duration: `${hours}h ${String(mins).padStart(2, '0')}m`,
        status: 'Active',
        stops: [],
        created_at: nowIso,
        updated_at: nowIso
      });
      existingSignatures.add(sig2);
      addedRoutesCount++;
      if (generatedRouteSamples.length < 30) {
        generatedRouteSamples.push(`${h2} ➔ ${h1} (${dist} km, Direct)`);
      }
    }
  }
}

// 4. Save expanded routes back to db.json atomically
data.routes = Array.from(routesMap.entries());

const tmpPath = `${dbPath}.tmp.${process.pid}`;
fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
fs.renameSync(tmpPath, dbPath);

// Calculate final statistics
const finalRoutesCount = routesMap.size;
const activeRoutesCount = Array.from(routesMap.values()).filter(r => (r.status || '').toLowerCase() === 'active').length;
const inactiveRoutesCount = finalRoutesCount - activeRoutesCount;
const routesWithStopsCount = Array.from(routesMap.values()).filter(r => Array.isArray(r.stops) && r.stops.length > 0).length;

// Unique stations covered
const stationSet = new Set();
routesMap.forEach(r => {
  if (r.source_station_code) stationSet.add(r.source_station_code);
  if (r.destination_station_code) stationSet.add(r.destination_station_code);
  if (Array.isArray(r.stops)) {
    r.stops.forEach(s => {
      if (s.stationCode) stationSet.add(s.stationCode);
    });
  }
});

console.log(`\n==================================================`);
console.log(`🎉 INDIAN RAILWAY ROUTE EXPANSION SUMMARY REPORT 🎉`);
console.log(`==================================================`);
console.log(`  - TOTAL STATIONS AVAILABLE:        ${stationsMap.size}`);
console.log(`  - TOTAL STATIONS COVERED IN ROUTES: ${stationSet.size}`);
console.log(`  - TOTAL ROUTES BEFORE:             ${initialRoutesCount}`);
console.log(`  - NEW ROUTES ADDED:                ${addedRoutesCount}`);
console.log(`  - DUPLICATES SKIPPED:              ${skippedDuplicatesCount}`);
console.log(`  - TOTAL ROUTES AFTER:              ${finalRoutesCount}`);
console.log(`  - ACTIVE ROUTES:                   ${activeRoutesCount}`);
console.log(`  - INACTIVE ROUTES:                 ${inactiveRoutesCount}`);
console.log(`  - ROUTES WITH INTERMEDIATE STOPS:  ${routesWithStopsCount}`);
console.log(`  - TOTAL TRAINS IN SYSTEM:          ${trainsMap.size} (UNCHANGED)`);
console.log(`  - TOTAL BOOKINGS IN SYSTEM:        ${initialBookingsCount} (UNCHANGED)`);
console.log(`  - TOTAL PASSENGERS IN SYSTEM:      ${initialPassengersCount} (UNCHANGED)`);
console.log(`==================================================\n`);

console.log(`SAMPLE GENERATED ROUTES (30 EXAMPLES):`);
generatedRouteSamples.forEach((sample, idx) => {
  console.log(`  ${idx + 1}. ${sample}`);
});

console.log('\n✅ Expanded routes written permanently to db.json!');
