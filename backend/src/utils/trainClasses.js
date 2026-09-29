/**
 * Authoritative Centralized Railway Reservation Travel Class Master (Backend)
 */

const MASTER_CLASSES = [
  { code: 'SL', name: 'Sleeper', description: 'Sleeper Class (Non-AC)' },
  { code: '3E', name: 'AC 3-Tier Economy', description: 'AC 3-Tier Economy Sleeper' },
  { code: '3A', name: 'AC 3-Tier', description: 'AC 3-Tier Sleeper' },
  { code: '2A', name: 'AC 2-Tier', description: 'AC 2-Tier Sleeper' },
  { code: 'CC', name: 'AC Chair Car', description: 'AC Chair Car' },
  { code: 'EC', name: 'Executive Chair Car', description: 'Executive Anubhuti/Vande Bharat Chair Car' },
  { code: '2S', name: 'Second Sitting', description: 'Second Sitting (Reserved Non-AC)' },
  { code: 'GEN', name: 'General / Unreserved', description: 'General / Unreserved Class' },
  { code: '1A', name: 'First AC', description: 'AC 1st Class Coupe/Cabin' },
  { code: 'FC', name: 'First Class', description: 'First Class Non-AC' },
  { code: 'EA', name: 'Anubhuti Class', description: 'Anubhuti Luxury Chair Car' },
  { code: 'EV', name: 'Vistadome AC', description: 'Vistadome AC Panoramic Glass Roof' },
  { code: 'VC', name: 'Vistadome Chair Car', description: 'Vistadome Non-AC Chair Car' }
];

const CLASS_PRIORITY = {
  SL: 1,
  '3E': 2,
  '3A': 3,
  '2A': 4,
  CC: 5,
  EC: 6,
  '2S': 7,
  GEN: 8,
  '1A': 9,
  FC: 10,
  EA: 11,
  EV: 12,
  VC: 13
};

const CLASS_MAP = MASTER_CLASSES.reduce((acc, c) => {
  acc[c.code] = c.name;
  return acc;
}, {});

const CLASS_HUMAN_NAMES = {
  '1A': 'First AC',
  '2A': 'AC 2 Tier',
  '3A': 'AC 3 Tier',
  '3E': 'AC 3 Economy',
  'SL': 'Sleeper',
  'CC': 'AC Chair Car',
  'EC': 'Executive Chair Car',
  '2S': 'Second Sitting',
  'FC': 'First Class',
  'EA': 'Anubhuti Class',
  'EV': 'Vistadome AC',
  'VC': 'Vistadome Chair Car',
  'GEN': 'General'
};

const getIndianRailwayClassLabel = (code) => {
  if (!code) return '';
  const clean = String(code).trim().toUpperCase();
  const name = CLASS_HUMAN_NAMES[clean] || CLASS_MAP[clean] || clean;
  return `${name} (${clean})`;
};

const getClassLabel = (code) => {
  if (!code) return '';
  const cleanCode = String(code).trim().toUpperCase();
  return CLASS_HUMAN_NAMES[cleanCode] || CLASS_MAP[cleanCode] || cleanCode;
};

const getClassFullName = (code) => {
  if (!code) return '';
  const cleanCode = String(code).trim().toUpperCase();
  const label = CLASS_HUMAN_NAMES[cleanCode] || CLASS_MAP[cleanCode];
  if (!label) return cleanCode;
  return `${cleanCode} — ${label}`;
};

const isValidClassCode = (code) => {
  if (!code) return false;
  const clean = String(code).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CLASS_PRIORITY, clean) || Object.prototype.hasOwnProperty.call(CLASS_MAP, clean);
};

const extractCodeFromString = (str) => {
  if (!str) return '';
  const s = String(str).trim();
  const match = s.match(/\(([^)]+)\)/);
  if (match && isValidClassCode(match[1])) return match[1].trim().toUpperCase();
  const firstWord = s.split(/[\s_\-\(]+/)[0].toUpperCase();
  if (isValidClassCode(firstWord)) return firstWord;
  const clean = s.toUpperCase();
  if (isValidClassCode(clean)) return clean;
  return '';
};

const normalizeClassList = (input) => {
  if (!input) return [];
  let rawList = [];
  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === 'string') {
    rawList = input.split(',').map(s => s.trim());
  }
  const result = [];
  const seen = new Set();
  for (const item of rawList) {
    const code = typeof item === 'object' && item && item.code ? String(item.code).trim().toUpperCase() : extractCodeFromString(item);
    if (code && isValidClassCode(code) && !seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
  }

  // Sort by fixed IRCTC-style class priority
  return result.sort((a, b) => {
    const prioA = CLASS_PRIORITY[a] ?? 99;
    const prioB = CLASS_PRIORITY[b] ?? 99;
    return prioA - prioB;
  });
};

const formatClassesForResponse = (classCodes) => {
  const normalized = normalizeClassList(classCodes);
  return normalized.map(code => ({
    code,
    name: getClassLabel(code)
  }));
};

const getDefaultClassesForTrain = (trainName = '', trainType = '') => {
  const name = String(trainName).toLowerCase();
  const type = String(trainType).toLowerCase();

  let rawList = [];
  if (name.includes('rajdhani') || type.includes('rajdhani')) {
    rawList = ['1A', '2A', '3A', '3E'];
  } else if (name.includes('shatabdi') || type.includes('shatabdi') || name.includes('vande') || type.includes('vande') || name.includes('gatimaan')) {
    rawList = ['EC', 'CC', 'EA'];
  } else if (name.includes('duronto') || type.includes('duronto')) {
    rawList = ['1A', '2A', '3A', '3E', 'SL'];
  } else if (name.includes('local') || type.includes('local') || name.includes('passenger') || type.includes('passenger')) {
    rawList = ['2S', 'GEN'];
  } else {
    rawList = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
  }

  return normalizeClassList(rawList);
};

const sortClassCodes = (codesList) => {
  return normalizeClassList(codesList);
};

module.exports = {
  MASTER_CLASSES,
  CLASS_PRIORITY,
  CLASS_MAP,
  CLASS_HUMAN_NAMES,
  getIndianRailwayClassLabel,
  getClassLabel,
  getClassFullName,
  isValidClassCode,
  normalizeClassList,
  sortClassCodes,
  formatClassesForResponse,
  getDefaultClassesForTrain
};

