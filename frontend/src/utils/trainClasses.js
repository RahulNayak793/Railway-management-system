/**
 * Centralized Railway Reservation Travel Class Master Definition & IRCTC-Style Class Priority Engine
 */

export const MASTER_CLASSES = [
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

export const CLASS_PRIORITY = {
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

export const CLASS_MAP = MASTER_CLASSES.reduce((acc, c) => {
  acc[c.code] = c.name;
  return acc;
}, {});

export const CLASS_HUMAN_NAMES = {
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

export const getIndianRailwayClassLabel = (code) => {
  if (!code) return '';
  const clean = String(code).trim().toUpperCase();
  const name = CLASS_HUMAN_NAMES[clean] || CLASS_MAP[clean] || clean;
  return `${name} (${clean})`;
};

export const getClassLabel = (code) => {
  if (!code) return '';
  const cleanCode = String(code).trim().toUpperCase();
  return CLASS_HUMAN_NAMES[cleanCode] || CLASS_MAP[cleanCode] || cleanCode;
};

export const getClassFullName = (code) => {
  if (!code) return '';
  const cleanCode = String(code).trim().toUpperCase();
  const label = CLASS_HUMAN_NAMES[cleanCode] || CLASS_MAP[cleanCode];
  if (!label) return cleanCode;
  return `${cleanCode} — ${label}`;
};

export const isValidClassCode = (code) => {
  if (!code) return false;
  const clean = String(code).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(CLASS_PRIORITY, clean) || Object.prototype.hasOwnProperty.call(CLASS_MAP, clean);
};

/**
 * Normalizes any class input (code string, full label, or object) safely into a standardized object:
 * { code: 'SL', name: 'Sleeper', fullName: 'Sleeper (SL)' }
 */
export const normalizeClassCode = (raw) => {
  if (!raw) return { code: 'SL', name: 'Sleeper', fullName: 'Sleeper (SL)' };
  
  if (typeof raw === 'object' && raw !== null) {
    const code = String(raw.code || raw.classCode || raw.value || 'SL').trim().toUpperCase();
    const name = raw.name || raw.label || getClassLabel(code);
    return { code, name, fullName: `${name} (${code})` };
  }

  const str = String(raw).trim();
  const match = str.match(/\(([^)]+)\)/);
  let code = match ? match[1].trim().toUpperCase() : '';

  if (!code) {
    const cleanStr = str.toUpperCase();
    if (CLASS_PRIORITY[cleanStr]) {
      code = cleanStr;
    } else {
      const found = MASTER_CLASSES.find(m => 
        m.code.toUpperCase() === cleanStr || 
        m.name.toUpperCase() === cleanStr || 
        cleanStr.includes(m.name.toUpperCase()) ||
        m.name.toUpperCase().includes(cleanStr)
      );
      code = found ? found.code : cleanStr;
    }
  }

  const name = getClassLabel(code) || str;
  return { code, name, fullName: `${name} (${code})` };
};

/**
 * Sorts any list of classes in strict IRCTC-style fixed priority order:
 * SL -> 3E -> 3A -> 2A -> 1A -> EC -> CC -> FC -> 2S -> EA -> EV -> VC -> GEN
 */
export const sortClassesByPriority = (classList) => {
  if (!Array.isArray(classList) || classList.length === 0) return [];

  const normalizedList = [];
  const seenCodes = new Set();

  for (const item of classList) {
    const norm = normalizeClassCode(item);
    if (norm.code && !seenCodes.has(norm.code)) {
      seenCodes.add(norm.code);
      normalizedList.push(norm);
    }
  }

  return normalizedList.sort((a, b) => {
    const prioA = CLASS_PRIORITY[a.code] ?? 99;
    const prioB = CLASS_PRIORITY[b.code] ?? 99;
    return prioA - prioB;
  });
};

/**
 * Returns a sorted array of class code strings in strict priority order:
 * ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A']
 */
export const sortClassCodes = (classList) => {
  if (!Array.isArray(classList) || classList.length === 0) return [];
  return sortClassesByPriority(classList).map(c => c.code);
};

export const getDefaultClassesForTrain = (trainName = '', trainType = '') => {
  const name = String(trainName).toLowerCase();
  const type = String(trainType).toLowerCase();

  let rawList = [];
  if (name.includes('rajdhani') || type.includes('rajdhani')) {
    rawList = ['3E', '3A', '2A', '1A'];
  } else if (name.includes('shatabdi') || type.includes('shatabdi') || name.includes('vande') || type.includes('vande')) {
    rawList = ['CC', 'EC', 'EA'];
  } else if (name.includes('duronto') || type.includes('duronto')) {
    rawList = ['SL', '3E', '3A', '2A', '1A'];
  } else if (name.includes('local') || type.includes('local') || name.includes('passenger') || type.includes('passenger')) {
    rawList = ['2S', 'GEN'];
  } else {
    rawList = ['SL', '3E', '3A', '2A', 'CC', 'EC', '2S', 'GEN', '1A'];
  }

  return sortClassesByPriority(rawList).map(c => c.code);
};

