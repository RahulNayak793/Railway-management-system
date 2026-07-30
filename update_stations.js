const fs = require('fs');
const path = require('path');

const stationsDataPath = path.join(__dirname, 'frontend/src/utils/stationsData.js');

let rawData = fs.readFileSync(stationsDataPath, 'utf8');
let jsonStr = rawData.replace('export const indianStations = ', '').trim();
if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
let indianStations = eval(jsonStr);

const inputList = `New Delhi - NDLS
Delhi Junction - DLI
Hazrat Nizamuddin - NZM
Anand Vihar Terminal - ANVT
Old Delhi - DLI
Mumbai Central - MMCT
Chhatrapati Shivaji Maharaj Terminus - CSMT
Lokmanya Tilak Terminus - LTT
Dadar - DR
Bandra Terminus - BDTS
Pune Junction - PUNE
Nagpur Junction - NGP
Nashik Road - NK
Aurangabad - AWB
Solapur - SUR
Chennai Central - MAS
Chennai Egmore - MS
Tambaram - TBM
Coimbatore Junction - CBE
Madurai Junction - MDU
Tiruchirappalli Junction - TPJ
Salem Junction - SA
Erode Junction - ED
KSR Bengaluru - SBC
Yesvantpur Junction - YPR
Bengaluru Cantonment - BNC
Mysuru Junction - MYS
Hubballi Junction - UBL
Mangaluru Central - MAQ
Udupi - UDU
Shivamogga Town - SMET
Belagavi - BGM
Howrah Junction - HWH
Sealdah - SDAH
Kolkata Terminal - KOAA
Santragachi Junction - SHM
Durgapur - DGR
Asansol Junction - ASN
Malda Town - MLDT
New Jalpaiguri - NJP
Hyderabad Deccan - HYB
Secunderabad Junction - SC
Kacheguda - KCG
Warangal - WL
Vijayawada Junction - BZA
Visakhapatnam - VSKP
Guntur Junction - GNT
Rajahmundry - RJY
Tirupati - TPTY
Jaipur Junction - JP
Jodhpur Junction - JU
Udaipur City - UDZ
Ajmer Junction - AII
Kota Junction - KOTA
Ahmedabad Junction - ADI
Surat - ST
Vadodara Junction - BRC
Rajkot Junction - RJT
Bhavnagar Terminus - BVC
Lucknow Charbagh - LKO
Kanpur Central - CNB
Varanasi Junction - BSB
Prayagraj Junction - PRYJ
Gorakhpur Junction - GKP
Agra Cantt - AGC
Mathura Junction - MTJ
Patna Junction - PNBE
Gaya Junction - GAYA
Muzaffarpur Junction - MFP
Bhagalpur - BGP
Bhopal Junction - BPL
Jabalpur - JBP
Itarsi Junction - ET
Gwalior Junction - GWL
Raipur Junction - R
Bilaspur Junction - BSP
Bhubaneswar - BBS
Puri - PURI
Cuttack - CTC
Sambalpur - SBP
Ernakulam Junction - ERS
Thiruvananthapuram Central - TVC
Kozhikode - CLT
Alappuzha - ALLP
Kannur - CAN
Kollam Junction - QLN`;

const existingCodes = new Set(indianStations.map(s => s.code));

const lines = inputList.split('\n');
let added = 0;
for(const line of lines) {
    if(!line.trim()) continue;
    const parts = line.split(' - ');
    if(parts.length === 2) {
        const name = parts[0].trim();
        const code = parts[1].trim();
        if(!existingCodes.has(code)) {
            indianStations.push({ code, name, state: 'Unknown', platforms: 1, zone: 'Unknown' });
            existingCodes.add(code);
            added++;
        }
    }
}

console.log(`Added ${added} new stations.`);

// Write back to file
const outputData = `export const indianStations = [\n  ` + indianStations.map(s => `{ code: '${s.code}', name: '${s.name}', state: '${s.state}', platforms: ${s.platforms}, zone: '${s.zone}' }`).join(',\n  ') + `\n];\n`;

fs.writeFileSync(stationsDataPath, outputData, 'utf8');
console.log('Successfully updated stationsData.js');
