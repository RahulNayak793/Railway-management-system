/**
 * Generic dynamic route-segment matching engine for Railway Management System.
 * Works for ANY train with ANY number of intermediate stops.
 */

const stationAliasMap = {
  'UDU': 'UDUPI',
  'UDUPI': 'UDU',
  'MMCT': 'MUMBAI CENTRAL',
  'MUMBAI CENTRAL': 'MMCT',
  'NDLS': 'NEW DELHI',
  'NEW DELHI': 'NDLS',
  'CSMT': 'CHHATRAPATI SHIVAJI MAHARAJ TERMINUS',
  'SBC': 'KSR BENGALURU CITY',
  'BGLR': 'SBC',
  'BANGALORE': 'SBC',
  'BENGALURU': 'SBC',
  'MAS': 'MGR CHENNAI CENTRAL',
  'CHENNAI': 'MAS',
  'ADI': 'AHMEDABAD JUNCTION',
  'AHMEDABAD': 'ADI'
};

const extractStationCode = (str) => {
  if (!str) return '';
  const match = String(str).match(/\(([^)]+)\)/);
  if (match) return match[1].trim().toUpperCase();
  return String(str).trim().toUpperCase();
};

/**
 * Checks if a route station node matches a user station query.
 * Matches on station code, station name, or mapped aliases.
 */
const isStationMatch = (nodeCode, nodeName, query) => {
  if (!query) return false;
  const qStr = String(query).trim().toUpperCase();
  const qCode = extractStationCode(query);

  const codeClean = String(nodeCode || '').trim().toUpperCase();
  const nameClean = String(nodeName || '').trim().toUpperCase();

  const codeAlias = stationAliasMap[codeClean] || '';
  const nameAlias = stationAliasMap[nameClean] || '';
  const qAlias = stationAliasMap[qCode] || stationAliasMap[qStr] || '';

  if (codeClean && (codeClean === qCode || codeClean === qStr || codeClean === qAlias)) return true;
  if (codeAlias && (codeAlias === qCode || codeAlias === qStr || codeAlias === qAlias)) return true;
  if (nameClean && (nameClean === qStr || nameClean.includes(qStr) || qStr.includes(nameClean) || nameClean === qAlias)) return true;
  if (nameAlias && (nameAlias === qStr || nameAlias.includes(qStr) || qStr.includes(nameAlias))) return true;

  return false;
};

/**
 * Helper to check if a train operates on a given travel date based on its frequency.
 */
const isTrainRunningOnDate = (train, route, travelDate) => {
  const frequency = train?.frequency || route?.frequency || 'Daily';
  if (!frequency || frequency.toLowerCase() === 'daily') {
    return true; // Runs every day
  }
  if (!travelDate) return true;

  const dateObj = new Date(travelDate);
  if (isNaN(dateObj.getTime())) return true;

  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

  if (frequency === 'Except Thu' && dayOfWeek === 'Thu') {
    return false;
  }
  return true;
};

/**
 * Builds an ordered list of all station nodes for a train:
 * [ Origin, Stop 1, Stop 2, ..., Stop N, Destination ]
 */
const buildOrderedStationNodes = (train, route) => {
  const nodes = [];
  const fullDistance = parseFloat(route?.distance_km || train?.distance_km || 1000);

  const originCode = extractStationCode(route?.source_station_code || train?.source);
  const originDep = route?.departure_time || train?.departure_time || '10:00:00';

  if (originCode) {
    nodes.push({
      code: originCode,
      name: train?.source || originCode,
      depTime: originDep,
      arrTime: null,
      distanceFromOriginKm: 0,
      distance_km: 0,
      isOrigin: true
    });
  }

  const stops = Array.isArray(route?.stops) ? route.stops : [];
  stops.forEach(s => {
    const sCode = extractStationCode(s.stationCode || s.station || s.code || s.name);
    const sName = s.stationName || s.name || s.station || sCode;
    const sDep = s.depTime || s.departure_time || s.arrTime || s.arrival_time;
    const sArr = s.arrTime || s.arrival_time || s.depTime || s.departure_time;
    const sDist = parseFloat(s.distanceFromOriginKm ?? s.distance_km ?? s.dist ?? s.km ?? s.distance ?? -1);

    if (sCode) {
      nodes.push({
        code: sCode,
        name: sName,
        depTime: sDep || originDep,
        arrTime: sArr || originDep,
        distanceFromOriginKm: sDist >= 0 ? sDist : undefined,
        distance_km: sDist >= 0 ? sDist : undefined,
        isStop: true
      });
    }
  });

  const destCode = extractStationCode(route?.destination_station_code || train?.destination);
  const destArr = route?.arrival_time || train?.arrival_time || '18:00:00';

  if (destCode) {
    if (nodes.length === 0 || nodes[nodes.length - 1].code !== destCode) {
      nodes.push({
        code: destCode,
        name: train?.destination || destCode,
        depTime: null,
        arrTime: destArr,
        distanceFromOriginKm: fullDistance,
        distance_km: fullDistance,
        isDestination: true
      });
    }
  }

  return nodes;
};

/**
 * Evaluates whether a train's route matches the requested source and destination stations.
 * Must satisfy:
 *   sourceIndex >= 0
 *   destinationIndex >= 0
 *   sourceIndex < destinationIndex
 * 
 * Returns matched segment info or null.
 */
const matchRouteSegment = (train, route, sourceQuery, destQuery) => {
  if (!sourceQuery || !destQuery) return null;

  const srcClean = extractStationCode(sourceQuery);
  const destClean = extractStationCode(destQuery);

  if (srcClean && destClean && (srcClean === destClean || isStationMatch(srcClean, srcClean, destQuery))) {
    return null; // Same source and destination is invalid
  }

  const nodes = buildOrderedStationNodes(train, route);
  if (nodes.length < 2) return null;

  let srcIndex = -1;
  let destIndex = -1;

  for (let i = 0; i < nodes.length; i++) {
    if (srcIndex === -1 && isStationMatch(nodes[i].code, nodes[i].name, sourceQuery)) {
      srcIndex = i;
    }
    if (srcIndex !== -1 && i > srcIndex && isStationMatch(nodes[i].code, nodes[i].name, destQuery)) {
      destIndex = i;
      break; // Found valid forward pair!
    }
  }

  if (srcIndex !== -1 && destIndex !== -1 && srcIndex < destIndex) {
    const srcNode = nodes[srcIndex];
    const destNode = nodes[destIndex];

    const departure_time = srcNode.depTime || srcNode.arrTime || route?.departure_time || train?.departure_time || '10:00:00';
    const arrival_time = destNode.arrTime || destNode.depTime || route?.arrival_time || train?.arrival_time || '18:00:00';

    return {
      matched: true,
      srcCode: srcNode.code,
      destCode: destNode.code,
      srcName: srcNode.name,
      destName: destNode.name,
      departure_time,
      arrival_time,
      srcIndex,
      destIndex,
      nodes
    };
  }

  return null;
};

module.exports = {
  extractStationCode,
  isStationMatch,
  isTrainRunningOnDate,
  buildOrderedStationNodes,
  matchRouteSegment
};
