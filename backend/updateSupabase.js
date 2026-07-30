const fs = require('fs');

const frontendData = fs.readFileSync('../frontend/src/utils/stationsData.js', 'utf8');
let jsonStr = frontendData.replace('export const indianStations = ', '').trim();
if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
const indianStations = eval(jsonStr);

let mockStationsCode = 'const stationsData = [\n';
indianStations.forEach((s, i) => {
  mockStationsCode += `    { id: 's${i+1}', station_code: '${s.code}', station_name: '${s.name.replace(/'/g, "\\'")}', state: '${s.state}' },\n`;
});
mockStationsCode += '  ];';

let supabaseJs = fs.readFileSync('./src/config/supabase.js', 'utf8');
const startMarker = 'const stationsData = [';
const endMarker = '];\n  stationsData.forEach(s => mockDb.stations.set(s.id, s));';
const startIndex = supabaseJs.indexOf(startMarker);
const endIndex = supabaseJs.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = supabaseJs.substring(0, startIndex) + mockStationsCode + '\n  stationsData.forEach(s => mockDb.stations.set(s.id, s));' + supabaseJs.substring(endIndex + endMarker.length);
  fs.writeFileSync('./src/config/supabase.js', newContent);
  console.log('Successfully updated mock stations in supabase.js with ' + indianStations.length + ' stations.');
} else {
  console.log('Markers not found.');
}
