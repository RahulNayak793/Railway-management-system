const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase, isMockMode, mockDb, saveMockDbToFile } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

/**
 * Core Helper: Save or Update passengers used in a booking without creating duplicates.
 * Matches on: user_id + full_name + gender (case-insensitive)
 */
async function saveOrUpdateBookingPassengers(userId, passengersList) {
  if (!userId || !Array.isArray(passengersList) || passengersList.length === 0) {
    return [];
  }

  const isMockUser = isMockMode || (userId && (String(userId).startsWith('usr-') || String(userId).startsWith('test-')));
  const results = [];

  for (const p of passengersList) {
    const rawName = p.full_name || p.name || '';
    const fullName = String(rawName).trim();
    if (!fullName || fullName.toLowerCase() === 'passenger' || fullName.toLowerCase() === 'unknown passenger') {
      continue;
    }

    const age = p.age ? parseInt(p.age, 10) : null;
    const gender = p.gender || 'Male';
    const irctcUserId = (p.irctc_user_id || p.irctc_id || p.irctcId || '').trim();
    const berthPref = p.berth_preference || p.berth || 'No Preference';
    const foodPref = p.food_preference || p.food_selection || p.food_choice || 'No Preference';

    if (isMockUser) {
      const allUserPassengers = Array.from(mockDb.saved_passengers.values()).filter(
        sp => sp && sp.user_id === userId
      );

      const existing = allUserPassengers.find(sp => {
        const nameMatch = sp.full_name && sp.full_name.trim().toLowerCase() === fullName.toLowerCase();
        const genderMatch = !sp.gender || !gender || sp.gender.trim().toLowerCase() === gender.trim().toLowerCase();
        return nameMatch && genderMatch;
      });

      const now = new Date().toISOString();

      if (existing) {
        // Update existing passenger with latest preferences
        if (age !== null && !isNaN(age)) existing.age = age;
        if (gender) existing.gender = gender;
        if (irctcUserId) existing.irctc_user_id = irctcUserId;
        if (berthPref && berthPref !== 'No Preference') existing.berth_preference = berthPref;
        if (foodPref && foodPref !== 'No Preference') existing.food_preference = foodPref;
        existing.updated_at = now;
        mockDb.saved_passengers.set(existing.id, existing);
        results.push(existing);
      } else {
        // Create new saved passenger
        const newId = 'sp-' + crypto.randomUUID();
        const newPassenger = {
          id: newId,
          user_id: userId,
          full_name: fullName,
          age,
          gender,
          irctc_user_id: irctcUserId,
          berth_preference: berthPref,
          food_preference: foodPref,
          document_url: p.document_url || '',
          created_at: now,
          updated_at: now
        };
        mockDb.saved_passengers.set(newId, newPassenger);
        results.push(newPassenger);
      }
      saveMockDbToFile();
    } else {
      try {
        // Supabase lookup
        const { data: existingList, error: fetchErr } = await supabase
          .from('saved_passengers')
          .select('*')
          .eq('user_id', userId);

        if (fetchErr) throw fetchErr;

        const existing = (existingList || []).find(sp => {
          const nameMatch = sp.full_name && sp.full_name.trim().toLowerCase() === fullName.toLowerCase();
          const genderMatch = !sp.gender || !gender || sp.gender.trim().toLowerCase() === gender.trim().toLowerCase();
          return nameMatch && genderMatch;
        });

        const now = new Date().toISOString();

        if (existing) {
          const updateData = { updated_at: now };
          if (age !== null && !isNaN(age)) updateData.age = age;
          if (gender) updateData.gender = gender;
          if (irctcUserId) updateData.irctc_user_id = irctcUserId;
          if (berthPref && berthPref !== 'No Preference') updateData.berth_preference = berthPref;
          if (foodPref && foodPref !== 'No Preference') updateData.food_preference = foodPref;

          const { data: updated, error: updateErr } = await supabase
            .from('saved_passengers')
            .update(updateData)
            .eq('id', existing.id)
            .eq('user_id', userId)
            .select()
            .single();

          if (!updateErr && updated) results.push(updated);
        } else {
          const { data: created, error: insertErr } = await supabase
            .from('saved_passengers')
            .insert({
              user_id: userId,
              full_name: fullName,
              age,
              gender,
              irctc_user_id: irctcUserId,
              berth_preference: berthPref,
              food_preference: foodPref,
              document_url: p.document_url || '',
              created_at: now,
              updated_at: now
            })
            .select()
            .single();

          if (!insertErr && created) results.push(created);
        }
      } catch (dbErr) {
        console.error('⚠️ Error auto-saving passenger to Supabase:', dbErr.message);
      }
    }
  }

  return results;
}

// GET /api/passengers/saved - List authenticated user's saved passengers
router.get('/saved', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const isMockUser = isMockMode || (userId && (String(userId).startsWith('usr-') || String(userId).startsWith('test-')));

  if (isMockUser) {
    const list = Array.from(mockDb.saved_passengers.values())
      .filter(p => p && p.user_id === userId)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return res.json(list);
  } else {
    try {
      const { data, error } = await supabase
        .from('saved_passengers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error('⚠️ Supabase saved_passengers fetch error:', err.message);
      return res.status(500).json({ error: 'Database error fetching saved passengers: ' + err.message });
    }
  }
});

// GET /api/passengers/saved/:id - Get a single saved passenger owned by authenticated user
router.get('/saved/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;
  const isMockUser = isMockMode || (userId && (String(userId).startsWith('usr-') || String(userId).startsWith('test-')));

  if (isMockUser) {
    const passenger = mockDb.saved_passengers.get(passengerId);
    if (!passenger) {
      return res.status(404).json({ error: 'Saved passenger not found' });
    }
    if (passenger.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this saved passenger profile' });
    }
    return res.json(passenger);
  } else {
    try {
      const { data, error } = await supabase
        .from('saved_passengers')
        .select('*')
        .eq('id', passengerId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: 'Saved passenger not found' });
      }
      if (data.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this saved passenger profile' });
      }
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Database error fetching passenger: ' + err.message });
    }
  }
});

// POST /api/passengers/saved - Create a new saved passenger
router.post('/saved', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    full_name,
    age,
    gender,
    irctc_user_id,
    irctc_id,
    berth_preference,
    food_preference,
    document_url
  } = req.body;

  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ error: 'Passenger name is required' });
  }

  const cleanName = String(full_name).trim();
  const parsedAge = age ? parseInt(age, 10) : null;
  const cleanGender = gender || 'Male';
  const cleanIrctc = (irctc_user_id || irctc_id || '').trim();
  const cleanBerth = berth_preference || 'No Preference';
  const cleanFood = food_preference || 'No Preference';
  const now = new Date().toISOString();

  const isMockUser = isMockMode || (userId && (String(userId).startsWith('usr-') || String(userId).startsWith('test-')));

  if (isMockUser) {
    const mockId = 'sp-' + crypto.randomUUID();
    const newPassenger = {
      id: mockId,
      user_id: userId,
      full_name: cleanName,
      age: parsedAge,
      gender: cleanGender,
      irctc_user_id: cleanIrctc,
      berth_preference: cleanBerth,
      food_preference: cleanFood,
      document_url: document_url || '',
      created_at: now,
      updated_at: now
    };
    mockDb.saved_passengers.set(mockId, newPassenger);
    saveMockDbToFile();
    return res.status(201).json(newPassenger);
  } else {
    try {
      const { data, error } = await supabase
        .from('saved_passengers')
        .insert({
          user_id: userId,
          full_name: cleanName,
          age: parsedAge,
          gender: cleanGender,
          irctc_user_id: cleanIrctc,
          berth_preference: cleanBerth,
          food_preference: cleanFood,
          document_url: document_url || '',
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      console.error('⚠️ Supabase saved_passengers insert error:', err.message);
      return res.status(500).json({ error: 'Database error saving passenger: ' + err.message });
    }
  }
});

// PUT /api/passengers/saved/:id - Update an existing saved passenger owned by user
router.put('/saved/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;
  const {
    full_name,
    age,
    gender,
    irctc_user_id,
    irctc_id,
    berth_preference,
    food_preference,
    document_url
  } = req.body;

  const isMockUser = isMockMode || (userId && (String(userId).startsWith('usr-') || String(userId).startsWith('test-')));

  if (isMockUser) {
    const passenger = mockDb.saved_passengers.get(passengerId);
    if (!passenger) {
      return res.status(404).json({ error: 'Saved passenger not found' });
    }
    if (passenger.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this passenger profile' });
    }

    if (full_name !== undefined) passenger.full_name = String(full_name).trim();
    if (age !== undefined) passenger.age = age ? parseInt(age, 10) : null;
    if (gender !== undefined) passenger.gender = gender;
    if (irctc_user_id !== undefined || irctc_id !== undefined) {
      passenger.irctc_user_id = (irctc_user_id || irctc_id || '').trim();
    }
    if (berth_preference !== undefined) passenger.berth_preference = berth_preference;
    if (food_preference !== undefined) passenger.food_preference = food_preference;
    if (document_url !== undefined) passenger.document_url = document_url;
    passenger.updated_at = new Date().toISOString();

    mockDb.saved_passengers.set(passengerId, passenger);
    saveMockDbToFile();
    return res.json(passenger);
  } else {
    try {
      // First verify ownership
      const { data: existing, error: findErr } = await supabase
        .from('saved_passengers')
        .select('*')
        .eq('id', passengerId)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!existing) {
        return res.status(404).json({ error: 'Saved passenger not found' });
      }
      if (existing.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this passenger profile' });
      }

      const updateData = { updated_at: new Date().toISOString() };
      if (full_name !== undefined) updateData.full_name = String(full_name).trim();
      if (age !== undefined) updateData.age = age ? parseInt(age, 10) : null;
      if (gender !== undefined) updateData.gender = gender;
      if (irctc_user_id !== undefined || irctc_id !== undefined) {
        updateData.irctc_user_id = (irctc_user_id || irctc_id || '').trim();
      }
      if (berth_preference !== undefined) updateData.berth_preference = berth_preference;
      if (food_preference !== undefined) updateData.food_preference = food_preference;
      if (document_url !== undefined) updateData.document_url = document_url;

      const { data, error } = await supabase
        .from('saved_passengers')
        .update(updateData)
        .eq('id', passengerId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      console.error('⚠️ Supabase saved_passengers update error:', err.message);
      return res.status(500).json({ error: 'Database error updating passenger: ' + err.message });
    }
  }
});

// DELETE /api/passengers/saved/:id - Delete a saved passenger owned by user
router.delete('/saved/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;
  const isMockUser = isMockMode || (userId && (String(userId).startsWith('usr-') || String(userId).startsWith('test-')));

  if (isMockUser) {
    const passenger = mockDb.saved_passengers.get(passengerId);
    if (!passenger) {
      return res.status(404).json({ error: 'Saved passenger not found' });
    }
    if (passenger.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this passenger profile' });
    }

    mockDb.saved_passengers.delete(passengerId);
    saveMockDbToFile();
    return res.json({ message: 'Saved passenger deleted successfully', id: passengerId });
  } else {
    try {
      const { data: existing, error: findErr } = await supabase
        .from('saved_passengers')
        .select('*')
        .eq('id', passengerId)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!existing) {
        return res.status(404).json({ error: 'Saved passenger not found' });
      }
      if (existing.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied: You do not own this passenger profile' });
      }

      const { error } = await supabase
        .from('saved_passengers')
        .delete()
        .eq('id', passengerId)
        .eq('user_id', userId);

      if (error) throw error;
      return res.json({ message: 'Saved passenger deleted successfully', id: passengerId });
    } catch (err) {
      console.error('⚠️ Supabase saved_passengers delete error:', err.message);
      return res.status(500).json({ error: 'Database error deleting passenger: ' + err.message });
    }
  }
});

module.exports = {
  router,
  saveOrUpdateBookingPassengers
};
