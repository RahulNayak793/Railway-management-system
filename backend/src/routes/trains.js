const express = require('express');
const router = express.Router();
const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { extractStationCode, matchRouteSegment, isTrainRunningOnDate } = require('../utils/routeSearch');
const { calculateSegmentFare } = require('../utils/fareCalculator');

const { getLiveStatusForTrain } = require('../utils/liveStatusHelper');
const { broadcastTelemetryUpdate } = require('./tracking');

const ensure24HourTime = (timeStr) => {
  if (!timeStr) return '12:00:00';
  const cleanStr = String(timeStr).trim();
  if (cleanStr.toUpperCase().includes('AM') || cleanStr.toUpperCase().includes('PM')) {
    const parts = cleanStr.split(/\s+/);
    const timePart = parts[0];
    const ampm = parts[1] ? parts[1].toUpperCase() : 'AM';
    let [hours, minutes] = timePart.split(':');
    let h = parseInt(hours, 10);
    if (h === 12) {
      h = 0;
    }
    if (ampm === 'PM') {
      h += 12;
    }
    return `${String(h).padStart(2, '0')}:${minutes || '00'}:00`;
  }
  if (cleanStr.length === 5) return `${cleanStr}:00`;
  return cleanStr;
};

// GET /api/trains/:id/live-status
router.get('/:id/live-status', async (req, res) => {
  try {
    const { id } = req.params;
    const date = req.query.date || req.query.service_date || req.query.travel_date;
    const liveStatus = await getLiveStatusForTrain(id, date);
    if (!liveStatus) {
      return res.status(404).json({ error: 'Train not found or route data unavailable' });
    }
    return res.json(liveStatus);
  } catch (err) {
    console.error('Error fetching live status:', err);
    return res.status(500).json({ error: 'Failed to fetch live tracking status: ' + err.message });
  }
});

// POST /api/trains/:id/telemetry or PUT /api/trains/:id/telemetry (Staff & Admin only)
const updateTelemetryHandler = async (req, res) => {
  const { id } = req.params;
  const {
    latitude,
    longitude,
    speed,
    current_station_code,
    next_station_code,
    distance_travelled_km,
    delay_minutes,
    status,
    delay_reason,
    platform,
    service_date
  } = req.body;

  const nowIso = new Date().toISOString();
  const targetServiceDate = service_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (isMockMode) {
    let train = mockDb.trains.get(id);
    if (!train) {
      train = Array.from(mockDb.trains.values()).find(t => t.id === id || t.train_number === id);
    }
    if (!train) return res.status(404).json({ error: 'Train not found' });

    let telemetry = mockDb.train_telemetry.get(train.id);
    if (!telemetry) {
      telemetry = {
        id: 'tel-' + Math.random().toString(36).substr(2, 9),
        train_id: train.id,
        service_date: targetServiceDate,
        created_at: nowIso
      };
    }

    telemetry.service_date = targetServiceDate;
    if (latitude !== undefined) telemetry.latitude = latitude !== null ? parseFloat(latitude) : null;
    if (longitude !== undefined) telemetry.longitude = longitude !== null ? parseFloat(longitude) : null;
    if (speed !== undefined) telemetry.speed = parseInt(speed, 10);
    if (current_station_code !== undefined) telemetry.current_station_code = extractStationCode(current_station_code);
    if (next_station_code !== undefined) telemetry.next_station_code = extractStationCode(next_station_code);
    if (distance_travelled_km !== undefined) telemetry.distance_travelled_km = parseFloat(distance_travelled_km);
    if (delay_minutes !== undefined) telemetry.delay_minutes = parseInt(delay_minutes, 10);
    if (status !== undefined) telemetry.status = status;
    if (delay_reason !== undefined) telemetry.delay_reason = delay_reason;
    if (platform !== undefined) telemetry.platform = platform;
    telemetry.updated_at = nowIso;

    mockDb.train_telemetry.set(train.id, telemetry);

    if (delay_minutes !== undefined) train.delay_minutes = parseInt(delay_minutes, 10);
    if (status === 'DELAYED' || (delay_minutes > 0 && train.status === 'on_time')) {
      train.status = 'delayed';
    } else if (status === 'LIVE' && delay_minutes === 0) {
      train.status = 'on_time';
    }
    mockDb.trains.set(train.id, train);

    const fullLiveStatus = await getLiveStatusForTrain(train.id, targetServiceDate);
    broadcastTelemetryUpdate(train.id, fullLiveStatus, targetServiceDate);

    return res.json({ message: 'Telemetry updated successfully', liveStatus: fullLiveStatus });
  } else {
    try {
      let trainId = id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUuid) {
        const { data: trainObj, error: tErr } = await supabase.from('trains').select('id').eq('train_number', id).single();
        if (tErr || !trainObj) return res.status(404).json({ error: 'Train not found' });
        trainId = trainObj.id;
      }

      const telemetryData = {
        train_id: trainId,
        service_date: targetServiceDate,
        updated_at: nowIso
      };
      if (latitude !== undefined) telemetryData.latitude = latitude !== null ? parseFloat(latitude) : null;
      if (longitude !== undefined) telemetryData.longitude = longitude !== null ? parseFloat(longitude) : null;
      if (speed !== undefined) telemetryData.speed = parseInt(speed, 10);
      if (current_station_code !== undefined) telemetryData.current_station_code = extractStationCode(current_station_code);
      if (next_station_code !== undefined) telemetryData.next_station_code = extractStationCode(next_station_code);
      if (distance_travelled_km !== undefined) telemetryData.distance_travelled_km = parseFloat(distance_travelled_km);
      if (delay_minutes !== undefined) telemetryData.delay_minutes = parseInt(delay_minutes, 10);
      if (status !== undefined) telemetryData.status = status;
      if (delay_reason !== undefined) telemetryData.delay_reason = delay_reason;
      if (platform !== undefined) telemetryData.platform = platform;

      const { data, error } = await supabase
        .from('train_telemetry')
        .upsert(telemetryData, { onConflict: 'train_id,service_date' })
        .select()
        .single();

      if (error) throw error;

      if (delay_minutes !== undefined || status !== undefined) {
        const tUpdates = { updated_at: nowIso };
        if (delay_minutes !== undefined) tUpdates.delay_minutes = parseInt(delay_minutes, 10);
        if (status === 'DELAYED' || (delay_minutes > 0)) tUpdates.status = 'delayed';
        else if (status === 'LIVE' && delay_minutes === 0) tUpdates.status = 'on_time';
        await supabase.from('trains').update(tUpdates).eq('id', trainId);
      }

      const fullLiveStatus = await getLiveStatusForTrain(trainId, targetServiceDate);
      broadcastTelemetryUpdate(trainId, fullLiveStatus, targetServiceDate);

      return res.json({ message: 'Telemetry updated successfully', liveStatus: fullLiveStatus });
    } catch (err) {
      console.error('Telemetry update failed:', err.message);
      return res.status(400).json({ error: 'Telemetry update failed: ' + err.message });
    }
  }
};

router.post('/:id/telemetry', authenticateToken, requireRoles(['staff', 'admin']), updateTelemetryHandler);
router.put('/:id/telemetry', authenticateToken, requireRoles(['staff', 'admin']), updateTelemetryHandler);

// Get all trains (with optional search and route query)
router.get('/', async (req, res) => {
  const { source, destination, date, include_seed, include_all } = req.query;

  if (isMockMode) {
    let trainsList = Array.from(mockDb.trains.values()).filter(t => !!t && t.status !== 'inactive');
    
    // Filter out test records unless specifically running tests
    if (process.env.NODE_ENV !== 'test') {
      trainsList = trainsList.filter(t => t.source !== 'test' && t.record_source !== 'test');
    }

    const routesList = Array.from(mockDb.routes.values());

    if (source && destination) {
      const results = [];

      for (const t of trainsList) {
        const route = routesList.find(r => r.train_id === t.id);
        if (date && !isTrainRunningOnDate(t, route, date)) {
          continue;
        }

        const segment = matchRouteSegment(t, route, source, destination);

        if (segment) {
          const fareInfo = calculateSegmentFare({ train: t, route, srcIndex: segment.srcIndex, destIndex: segment.destIndex, nodes: segment.nodes });

          const enrichedRoute = {
            ...(route || {}),
            source_station_code: segment.srcCode,
            destination_station_code: segment.destCode,
            departure_time: segment.departure_time,
            arrival_time: segment.arrival_time,
            original_source: route?.source_station_code || t.source_station_code || t.source,
            original_destination: route?.destination_station_code || t.destination_station_code || t.destination,
            stops: route?.stops || [],
            distance_km: fareInfo.distance_km,
            duration_minutes: fareInfo.duration_minutes,
            base_fare: fareInfo.base_fare,
            segment_fares: fareInfo
          };

          results.push({
            ...t,
            source: segment.srcCode,
            destination: segment.destCode,
            segment: fareInfo.segment,
            distance_km: fareInfo.distance_km,
            duration_minutes: fareInfo.duration_minutes,
            fares_by_class: fareInfo.fares_by_class,
            base_fare: fareInfo.base_fare,
            route: enrichedRoute
          });
        }
      }

      return res.json(results);
    } else {
      // Admin list view (or general list without search parameters)
      let results = trainsList;
      if (include_all !== 'true' && include_seed !== 'true') {
        const adminTrains = trainsList.filter(t => t.source === 'admin' || t.record_source === 'admin');
        if (adminTrains.length > 0 || trainsList.length > 0) {
          results = adminTrains.length > 0 ? adminTrains : trainsList;
        }
      }

      results = results
        .filter(t => !date || isTrainRunningOnDate(t, routesList.find(r => r.train_id === t.id), date))
        .map(t => {
          const route = routesList.find(r => r.train_id === t.id) || {
            source_station_code: t.source_station_code || extractStationCode(t.source) || 'NDLS',
            destination_station_code: t.destination_station_code || extractStationCode(t.destination) || 'MMCT',
            departure_time: t.departure_time || '10:00:00',
            arrival_time: t.arrival_time || '18:00:00',
            distance_km: t.distance_km || 500,
            fare_multiplier: 1.2,
            stops: []
          };
          return {
            ...t,
            source: t.source_station_code || route.source_station_code || extractStationCode(t.source),
            destination: t.destination_station_code || route.destination_station_code || extractStationCode(t.destination),
            route
          };
        });
      return res.json(results);
    }
  } else {
    try {
      const { data, error } = await supabase.from('trains').select(`
        *,
        routes:routes(*)
      `);
      if (error) throw error;

      let activeTrains = (data || []).filter(t => t.status !== 'inactive');
      if (process.env.NODE_ENV !== 'test') {
        activeTrains = activeTrains.filter(t => t.source !== 'test' && t.record_source !== 'test');
      }

      if (source && destination) {
        const results = [];

        for (const t of activeTrains) {
          const route = t.routes && t.routes.length > 0 ? t.routes[0] : null;
          if (date && !isTrainRunningOnDate(t, route, date)) {
            continue;
          }

          const segment = matchRouteSegment(t, route, source, destination);

          if (segment) {
            const fareInfo = calculateSegmentFare({ train: t, route, srcIndex: segment.srcIndex, destIndex: segment.destIndex, nodes: segment.nodes });

            const enrichedRoute = {
              ...(route || {}),
              source_station_code: segment.srcCode,
              destination_station_code: segment.destCode,
              departure_time: segment.departure_time,
              arrival_time: segment.arrival_time,
              original_source: route?.source_station_code || t.source,
              original_destination: route?.destination_station_code || t.destination,
              stops: route?.stops || [],
              distance_km: fareInfo.distance_km,
              duration_minutes: fareInfo.duration_minutes,
              base_fare: fareInfo.base_fare,
              segment_fares: fareInfo
            };

            results.push({
              ...t,
              source: segment.srcCode,
              destination: segment.destCode,
              segment: fareInfo.segment,
              distance_km: fareInfo.distance_km,
              duration_minutes: fareInfo.duration_minutes,
              fares_by_class: fareInfo.fares_by_class,
              base_fare: fareInfo.base_fare,
              route: enrichedRoute
            });
          }
        }

        return res.json(results);
      } else {
        let resultsList = activeTrains;
        if (include_all !== 'true' && include_seed !== 'true') {
          const adminTrains = activeTrains.filter(t => t.source === 'admin' || t.record_source === 'admin');
          if (adminTrains.length > 0) resultsList = adminTrains;
        }

        const results = resultsList
          .filter(t => {
            const mainRoute = t.routes && t.routes.length > 0 ? t.routes[0] : null;
            return !date || isTrainRunningOnDate(t, mainRoute, date);
          })
          .map(t => {
            const mainRoute = t.routes && t.routes.length > 0 ? t.routes[0] : null;
            return {
              ...t,
              source: t.source_station_code || (mainRoute ? mainRoute.source_station_code : t.source),
              destination: t.destination_station_code || (mainRoute ? mainRoute.destination_station_code : t.destination),
              route: mainRoute
            };
          });
        return res.json(results);
      }
    } catch (err) {
      console.error('⚠️ Supabase DB error during trains query:', err.message);
      return res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  }
});

// Add a new train (Staff & Admin)
router.post('/', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const train_number = req.body.train_number || req.body.trainNo;
  const train_name = req.body.train_name || req.body.trainName;
  const source = req.body.source || req.body.from;
  const destination = req.body.destination || req.body.to;
  const departure_time = req.body.departure_time || req.body.depTime;
  const arrival_time = req.body.arrival_time || req.body.arrTime;
  const distance_km = req.body.distance_km || 500;
  const fare_multiplier = req.body.fare_multiplier || (req.body.baseFare ? parseFloat(req.body.baseFare) / 350 : 1.2);
  const frequency = req.body.frequency || 'Daily';
  
  if (!train_number || !String(train_number).trim()) {
    return res.status(400).json({ error: 'Train number is required' });
  }
  if (!train_name || !String(train_name).trim()) {
    return res.status(400).json({ error: 'Train name is required' });
  }
  if (!source || !destination) {
    return res.status(400).json({ error: 'Source and destination stations are required' });
  }

  const srcCode = extractStationCode(source);
  const destCode = extractStationCode(destination);

  if (!srcCode || !destCode) {
    return res.status(400).json({ error: 'Invalid source or destination station code' });
  }

  if (srcCode === destCode) {
    return res.status(400).json({ error: 'Source and destination stations cannot be the same' });
  }

  const stops = (req.body.stops || []).map(s => ({
    ...s,
    stationCode: extractStationCode(s.stationCode || s.station),
    depTime: ensure24HourTime(s.depTime || s.departure_time),
    arrTime: ensure24HourTime(s.arrTime || s.arrival_time)
  }));

  // Duplicate train_number validation
  if (isMockMode) {
    const duplicate = Array.from(mockDb.trains.values()).find(
      t => String(t.train_number) === String(train_number).trim()
    );
    if (duplicate) {
      return res.status(400).json({ error: `Train number ${train_number} already exists` });
    }
  }

  const nowIso = new Date().toISOString();
  const createdBy = req.user ? (req.user.id || req.user.email || 'usr-admin') : 'usr-admin';
  const recordSource = req.body.record_source || req.body.source_type || (process.env.NODE_ENV === 'test' ? 'test' : 'admin');

  if (isMockMode) {
    const newTrain = {
      id: 't-' + Math.random().toString(36).substr(2, 9),
      train_number: String(train_number).trim(),
      train_name: String(train_name).trim(),
      source_station_code: srcCode,
      destination_station_code: destCode,
      source: recordSource,
      record_source: recordSource,
      frequency,
      status: req.body.status || 'on_time',
      delay_minutes: 0,
      createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
      created_at: nowIso,
      updated_at: nowIso
    };
    
    const newRoute = {
      id: 'r-' + Math.random().toString(36).substr(2, 9),
      train_id: newTrain.id,
      source_station_code: srcCode,
      destination_station_code: destCode,
      departure_time: ensure24HourTime(departure_time),
      arrival_time: ensure24HourTime(arrival_time),
      distance_km: parseFloat(distance_km || '500'),
      fare_multiplier: parseFloat(fare_multiplier || '1.0'),
      frequency,
      stop_sequence: 1,
      stops: stops
    };

    mockDb.trains.set(newTrain.id, newTrain);
    mockDb.routes.set(newRoute.id, newRoute);

    // Seed mock seats for the new train
    const classes = ['SL', '3A', '2A', '1A'];
    classes.forEach(cls => {
      const coachNum = cls === 'SL' ? 'S1' : cls === '3A' ? 'B1' : cls === '2A' ? 'A1' : 'H1';
      for (let i = 1; i <= 24; i++) {
        const berthType = i % 6 === 1 || i % 6 === 2 ? 'LB' : i % 6 === 3 || i % 6 === 4 ? 'MB' : 'UB';
        const sId = `${newTrain.id}-${coachNum}-${i}`;
        mockDb.seats.set(sId, {
          id: sId,
          train_id: newTrain.id,
          coach_class: cls,
          coach_number: coachNum,
          seat_number: i,
          berth_type: berthType
        });
      }
    });

    return res.status(201).json({
      message: 'Train and route successfully created (Mock Mode)',
      train: { ...newTrain, source: srcCode, destination: destCode, route: newRoute }
    });
  } else {
    try {
      // 1. Insert Train
      const { data: train, error: trainError } = await supabase
        .from('trains')
        .insert({
          train_number: String(train_number).trim(),
          train_name: String(train_name).trim(),
          source_station_code: srcCode,
          destination_station_code: destCode,
          source: recordSource,
          record_source: recordSource,
          created_by: createdBy,
          created_at: nowIso,
          updated_at: nowIso
        })
        .select()
        .single();

      if (trainError) throw trainError;

      // 2. Insert Route
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({
          train_id: train.id,
          source_station_code: srcCode,
          destination_station_code: destCode,
          departure_time: ensure24HourTime(departure_time),
          arrival_time: ensure24HourTime(arrival_time),
          distance_km,
          fare_multiplier,
          stops: stops
        })
        .select()
        .single();

      if (routeError) throw routeError;

      return res.status(201).json({ train: { ...train, source: srcCode, destination: destCode, route } });
    } catch (err) {
      console.error('⚠️ Supabase DB error during train insert:', err.message);
      return res.status(500).json({ error: 'Database train insert failed: ' + err.message });
    }
  }
});

// Update train status / delays / details (Staff & Admin)
router.put('/:id', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { id } = req.params;
  const train_number = req.body.train_number || req.body.trainNo;
  const train_name = req.body.train_name || req.body.trainName;
  const status = req.body.status;
  const delay_minutes = req.body.delay_minutes;
  const source = req.body.source || req.body.from;
  const destination = req.body.destination || req.body.to;
  const departure_time = req.body.departure_time || req.body.depTime;
  const arrival_time = req.body.arrival_time || req.body.arrTime;
  const distance_km = req.body.distance_km;
  const fare_multiplier = req.body.fare_multiplier || (req.body.baseFare ? parseFloat(req.body.baseFare) / 350 : undefined);
  const frequency = req.body.frequency;
  
  const stops = req.body.stops !== undefined ? req.body.stops.map(s => ({
    ...s,
    stationCode: extractStationCode(s.stationCode || s.station),
    depTime: ensure24HourTime(s.depTime || s.departure_time),
    arrTime: ensure24HourTime(s.arrTime || s.arrival_time)
  })) : undefined;

  const nowIso = new Date().toISOString();

  if (isMockMode) {
    const train = mockDb.trains.get(id);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    if (train_number !== undefined && String(train_number).trim() !== train.train_number) {
      const dup = Array.from(mockDb.trains.values()).find(
        t => t.id !== id && String(t.train_number) === String(train_number).trim()
      );
      if (dup) {
        return res.status(400).json({ error: `Train number ${train_number} already exists` });
      }
      train.train_number = String(train_number).trim();
    }

    if (train_name !== undefined) train.train_name = String(train_name).trim();
    if (status !== undefined) train.status = status;
    if (delay_minutes !== undefined) train.delay_minutes = parseInt(delay_minutes);
    if (frequency !== undefined) train.frequency = frequency;
    if (source !== undefined) train.source_station_code = extractStationCode(source);
    if (destination !== undefined) train.destination_station_code = extractStationCode(destination);
    train.updatedAt = nowIso;
    train.updated_at = nowIso;

    mockDb.trains.set(id, train);

    // Update route
    const route = Array.from(mockDb.routes.values()).find(r => r.train_id === id);
    if (route) {
      if (source !== undefined) route.source_station_code = extractStationCode(source);
      if (destination !== undefined) route.destination_station_code = extractStationCode(destination);
      if (departure_time !== undefined) route.departure_time = ensure24HourTime(departure_time);
      if (arrival_time !== undefined) route.arrival_time = ensure24HourTime(arrival_time);
      if (distance_km !== undefined) route.distance_km = parseFloat(distance_km);
      if (fare_multiplier !== undefined) route.fare_multiplier = parseFloat(fare_multiplier);
      if (frequency !== undefined) route.frequency = frequency;
      if (stops !== undefined) route.stops = stops;
      mockDb.routes.set(route.id, route);
    }

    return res.json({ message: 'Train updated successfully (Mock Mode)', train: { ...train, route } });
  } else {
    try {
      const trainUpdates = { updated_at: nowIso };
      if (train_number !== undefined) trainUpdates.train_number = String(train_number).trim();
      if (train_name !== undefined) trainUpdates.train_name = String(train_name).trim();
      if (status !== undefined) trainUpdates.status = status;
      if (delay_minutes !== undefined) trainUpdates.delay_minutes = parseInt(delay_minutes);
      if (source !== undefined) trainUpdates.source_station_code = extractStationCode(source);
      if (destination !== undefined) trainUpdates.destination_station_code = extractStationCode(destination);

      let trainData = null;
      if (Object.keys(trainUpdates).length > 0) {
        const { data, error } = await supabase
          .from('trains')
          .update(trainUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        trainData = data;
      }

      const routeUpdates = {};
      if (source !== undefined) routeUpdates.source_station_code = extractStationCode(source);
      if (destination !== undefined) routeUpdates.destination_station_code = extractStationCode(destination);
      if (departure_time !== undefined) routeUpdates.departure_time = ensure24HourTime(departure_time);
      if (arrival_time !== undefined) routeUpdates.arrival_time = ensure24HourTime(arrival_time);
      if (distance_km !== undefined) routeUpdates.distance_km = parseFloat(distance_km);
      if (fare_multiplier !== undefined) routeUpdates.fare_multiplier = parseFloat(fare_multiplier);
      if (stops !== undefined) routeUpdates.stops = stops;

      let routeData = null;
      if (Object.keys(routeUpdates).length > 0) {
        const { data, error } = await supabase
          .from('routes')
          .update(routeUpdates)
          .eq('train_id', id)
          .select();

        if (error) throw error;
        routeData = data && data.length > 0 ? data[0] : null;
      }

      return res.json({ train: trainData, route: routeData });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Delete train (Admin only)
router.delete('/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    if (!mockDb.trains.has(id)) return res.status(404).json({ error: 'Train not found' });
    mockDb.trains.delete(id);

    // Cascade delete associated route and seats
    for (const [rId, r] of Array.from(mockDb.routes.entries())) {
      if (r.train_id === id) mockDb.routes.delete(rId);
    }
    for (const [sId, s] of Array.from(mockDb.seats.entries())) {
      if (s.train_id === id) mockDb.seats.delete(sId);
    }

    return res.json({ message: 'Train deleted successfully (Mock Mode)' });
  } else {
    try {
      const { error } = await supabase.from('trains').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Train deleted successfully' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Get seat layout and availability for a specific train
router.get('/:id/seats', async (req, res) => {
  const { id } = req.params;
  const { date, coach_class } = req.query;

  if (!date || !coach_class) {
    return res.status(400).json({ error: 'Date and coach_class query parameters are required' });
  }

  if (isMockMode) {
    // Get all seats for train
    let seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === id && s.coach_class === coach_class
    );

    // If no seats exist for this specific train and class, generate 24 standard berths on the fly
    if (seats.length === 0) {
      const coachNum = coach_class === 'SL' ? 'S1' : coach_class === '3A' ? 'B1' : coach_class === '2A' ? 'A1' : 'H1';
      seats = Array.from({ length: 24 }).map((_, idx) => {
        const seatNum = idx + 1;
        const berthType = seatNum % 6 === 1 || seatNum % 6 === 2 ? 'LB' : seatNum % 6 === 3 || seatNum % 6 === 4 ? 'MB' : 'UB';
        const sId = `${id}-${coachNum}-${seatNum}`;
        const newSeat = {
          id: sId,
          train_id: id,
          coach_class,
          coach_number: coachNum,
          seat_number: seatNum,
          berth_type: berthType
        };
        mockDb.seats.set(sId, newSeat);
        return newSeat;
      });
    }

    // Get allocations for active non-cancelled bookings on this date
    const activeBookingIds = Array.from(mockDb.bookings.values())
      .filter(b => b.status !== 'cancelled')
      .map(b => b.id);

    const allocations = Array.from(mockDb.seat_allocations.values()).filter(
      a => activeBookingIds.includes(a.booking_id) && a.travel_date === date && seats.some(s => s.id === a.seat_id)
    );

    // Build representation
    const layout = seats.map(s => {
      const alloc = allocations.find(a => a.seat_id === s.id);
      return {
        ...s,
        is_booked: !!alloc,
        passenger_name: alloc ? alloc.passenger_name : null
      };
    });

    // Calculate availability status
    const availableCount = layout.filter(s => !s.is_booked).length;
    const activeBookings = Array.from(mockDb.bookings.values()).filter(
      b => b.train_id === id && b.travel_date === date && b.status !== 'cancelled'
    );
    const racCount = activeBookings.filter(b => b.status === 'rac').length;
    const wlCount = activeBookings.filter(b => b.status === 'waitlist').length;

    let status = 'AVL';
    let position = availableCount;
    let statusCode = `AVL ${availableCount}`;

    if (availableCount === 0) {
      if (racCount < 4) {
        status = 'RAC';
        position = racCount + 1;
        statusCode = `RAC ${position}`;
      } else {
        status = 'WL';
        position = wlCount + 1;
        statusCode = `WL ${position}`;
      }
    }

    return res.json({
      status,
      available_count: availableCount,
      position,
      status_code: statusCode,
      seats: layout
    });
  } else {
    try {
      // 1. Fetch matching seats
      const { data: seats, error: seatsErr } = await supabase
        .from('seats')
        .select('*')
        .eq('train_id', id)
        .eq('coach_class', coach_class);

      if (seatsErr) throw seatsErr;

      // 2. Fetch active allocations for these seats on the travel date
      const seatIds = seats.map(s => s.id);
      const { data: allocations, error: allocErr } = await supabase
        .from('seat_allocations')
        .select('*')
        .eq('travel_date', date)
        .in('seat_id', seatIds);

      if (allocErr) throw allocErr;

      const layout = seats.map(s => {
        const alloc = allocations.find(a => a.seat_id === s.id);
        return {
          ...s,
          is_booked: !!alloc,
          passenger_name: alloc ? alloc.passenger_name : null
        };
      });

      const availableCount = layout.filter(s => !s.is_booked).length;
      let status = availableCount > 0 ? 'AVL' : 'RAC';
      let position = availableCount;
      let statusCode = availableCount > 0 ? `AVL ${availableCount}` : 'RAC 1';

      return res.json({
        status,
        available_count: availableCount,
        position,
        status_code: statusCode,
        seats: layout
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// GET all stations
router.get('/stations', async (req, res) => {
  if (isMockMode) {
    const stationsList = Array.from(mockDb.stations.values());
    return res.json(stationsList);
  } else {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .order('station_name');
      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Create a new station (Staff & Admin)
router.post('/stations', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { station_code, station_name, state, platforms } = req.body;
  
  if (!station_code || !String(station_code).trim()) {
    return res.status(400).json({ error: 'Station code is required' });
  }
  if (!station_name || !String(station_name).trim()) {
    return res.status(400).json({ error: 'Station name is required' });
  }

  const cleanCode = String(station_code).trim().toUpperCase();
  const cleanName = String(station_name).trim();

  if (isMockMode) {
    const existing = Array.from(mockDb.stations.values()).find(s => s.station_code === cleanCode);
    if (existing) {
      return res.status(400).json({ error: `Station code ${cleanCode} already exists` });
    }
    const newId = 'st-' + Math.random().toString(36).substr(2, 9);
    const newStation = {
      id: newId,
      station_code: cleanCode,
      station_name: cleanName,
      state: state || 'Unknown',
      platforms: platforms ? parseInt(platforms) : 2,
      created_at: new Date().toISOString()
    };
    mockDb.stations.set(newId, newStation);
    return res.status(201).json(newStation);
  } else {
    try {
      const { data, error } = await supabase
        .from('stations')
        .insert({
          station_code: cleanCode,
          station_name: cleanName,
          state: state || 'Unknown',
          platforms: platforms ? parseInt(platforms) : 2
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Update station (Staff & Admin)
router.put('/stations/:id', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { station_code, station_name, state, platforms } = req.body;

  if (isMockMode) {
    const station = mockDb.stations.get(id);
    if (!station) return res.status(404).json({ error: 'Station not found' });

    if (station_code !== undefined) station.station_code = String(station_code).trim().toUpperCase();
    if (station_name !== undefined) station.station_name = String(station_name).trim();
    if (state !== undefined) station.state = state;
    if (platforms !== undefined) station.platforms = parseInt(platforms);

    mockDb.stations.set(id, station);
    return res.json(station);
  } else {
    try {
      const updateData = {};
      if (station_code !== undefined) updateData.station_code = String(station_code).trim().toUpperCase();
      if (station_name !== undefined) updateData.station_name = String(station_name).trim();
      if (state !== undefined) updateData.state = state;
      if (platforms !== undefined) updateData.platforms = parseInt(platforms);

      const { data, error } = await supabase
        .from('stations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Delete station (Admin only)
router.delete('/stations/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  const { id } = req.params;

  if (isMockMode) {
    if (!mockDb.stations.has(id)) return res.status(404).json({ error: 'Station not found' });
    mockDb.stations.delete(id);
    return res.json({ message: 'Station deleted successfully' });
  } else {
    try {
      const { error } = await supabase.from('stations').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Station deleted successfully' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

module.exports = router;
