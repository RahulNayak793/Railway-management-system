const express = require('express');
const router = express.Router();
const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');

// Get all trains (with optional search and route query)
router.get('/', async (req, res) => {
  const { source, destination, date } = req.query;

  if (isMockMode) {
    let trainsList = Array.from(mockDb.trains.values());
    let routesList = Array.from(mockDb.routes.values());

    // If source and destination filters are provided
    if (source && destination) {
      const srcUpper = source.trim().toUpperCase();
      const destUpper = destination.trim().toUpperCase();

      // Same station search yields zero trains
      if (srcUpper === destUpper) {
        return res.json([]);
      }

      const matchingRoutes = routesList.filter(
        r => r.source_station_code.toUpperCase() === srcUpper &&
             r.destination_station_code.toUpperCase() === destUpper
      );
      
      const trainIds = matchingRoutes.map(r => r.train_id);
      
      // Include trains matching route IDs OR trains whose direct source/dest match
      let filtered = trainsList.filter(t => 
        trainIds.includes(t.id) ||
        ((t.source || '').toUpperCase() === srcUpper && (t.destination || '').toUpperCase() === destUpper)
      );

      // Append route details to train objects
      trainsList = filtered.map(t => {
        const route = matchingRoutes.find(r => r.train_id === t.id) || {
          source_station_code: t.source || source,
          destination_station_code: t.destination || destination,
          departure_time: t.departure_time || '10:00:00',
          arrival_time: t.arrival_time || '18:00:00',
          distance_km: t.distance_km || 500,
          fare_multiplier: 1.2,
          stop_sequence: 1
        };
        return {
          ...t,
          route
        };
      });    } else {
      // Append default routes if any
      trainsList = trainsList.map(t => {
        const route = routesList.find(r => r.train_id === t.id) || {
          source_station_code: t.source || 'NDLS',
          destination_station_code: t.destination || 'MMCT',
          departure_time: t.departure_time || '10:00:00',
          arrival_time: t.arrival_time || '18:00:00',
          distance_km: t.distance_km || 500,
          fare_multiplier: 1.2
        };
        return { ...t, route };
      });
    }

    return res.json(trainsList);
  } else {
    try {
      let query = supabase.from('trains').select(`
        *,
        routes:routes(*)
      `);

      const { data, error } = await query;
      if (error) throw error;

      let results = data;
      if (source && destination) {
        results = data.filter(t => 
          (t.routes && t.routes.some(
            r => r.source_station_code.toLowerCase() === source.toLowerCase() &&
                 r.destination_station_code.toLowerCase() === destination.toLowerCase()
          )) ||
          (t.source && t.source.toLowerCase() === source.toLowerCase() && t.destination && t.destination.toLowerCase() === destination.toLowerCase())
        );
      }

      return res.json(results);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Add a new train (Staff & Admin)
router.post('/', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { train_number, train_name, source, destination, departure_time, arrival_time, distance_km, fare_multiplier } = req.body;

  if (!train_number || !train_name || !source || !destination) {
    return res.status(400).json({ error: 'Train number, name, source, and destination are required' });
  }

  if (isMockMode) {
    const newTrain = {
      id: 't-' + Math.random().toString(36).substr(2, 9),
      train_number,
      train_name,
      status: 'on_time',
      delay_minutes: 0,
      created_at: new Date().toISOString()
    };
    
    const newRoute = {
      id: 'r-' + Math.random().toString(36).substr(2, 9),
      train_id: newTrain.id,
      source_station_code: source,
      destination_station_code: destination,
      departure_time: departure_time || '10:00:00',
      arrival_time: arrival_time || '18:00:00',
      distance_km: parseFloat(distance_km || '500'),
      fare_multiplier: parseFloat(fare_multiplier || '1.0'),
      stop_sequence: 1
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
      train: { ...newTrain, route: newRoute }
    });
  } else {
    try {
      // 1. Insert Train
      const { data: train, error: trainError } = await supabase
        .from('trains')
        .insert({ train_number, train_name })
        .select()
        .single();

      if (trainError) throw trainError;

      // 2. Insert Route
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert({
          train_id: train.id,
          source_station_code: source,
          destination_station_code: destination,
          departure_time: departure_time || '10:00:00',
          arrival_time: arrival_time || '18:00:00',
          distance_km,
          fare_multiplier
        })
        .select()
        .single();

      if (routeError) throw routeError;

      return res.status(201).json({ train: { ...train, route } });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Update train status / delays (Staff & Admin)
router.put('/:id', authenticateToken, requireRoles(['staff', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { status, delay_minutes } = req.body;

  if (isMockMode) {
    const train = mockDb.trains.get(id);
    if (!train) return res.status(404).json({ error: 'Train not found' });

    if (status !== undefined) train.status = status;
    if (delay_minutes !== undefined) train.delay_minutes = parseInt(delay_minutes);

    mockDb.trains.set(id, train);
    return res.json({ message: 'Train updated successfully (Mock Mode)', train });
  } else {
    try {
      const { data, error } = await supabase
        .from('trains')
        .update({ status, delay_minutes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ train: data });
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
    const seats = Array.from(mockDb.seats.values()).filter(
      s => s.train_id === id && s.coach_class === coach_class
    );

    // Get allocations for this date
    const allocations = Array.from(mockDb.seat_allocations.values()).filter(
      a => a.travel_date === date && seats.some(s => s.id === a.seat_id)
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

    return res.json(layout);
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

      return res.json(layout);
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

module.exports = router;
