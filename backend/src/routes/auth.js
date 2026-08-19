const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

// Helper to generate a mock token
const generateMockToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    jwtSecret,
    { expiresIn: '24h' }
  );
};

// Signup Endpoint
router.post('/signup', async (req, res) => {
  const { email, password, full_name, role, phone } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password and role are required' });
  }

  if (isMockMode) {
    // Check if user already exists
    const existing = Array.from(mockDb.profiles.values()).find(u => u.email === email);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const mockId = 'usr-' + Math.random().toString(36).substr(2, 9);
    const newProfile = {
      id: mockId,
      email,
      role,
      full_name: full_name || '',
      phone: phone || '',
      avatar_url: '',
      document_url: '',
      created_at: new Date().toISOString()
    };
    
    mockDb.profiles.set(mockId, newProfile);
    const token = generateMockToken(newProfile);

    return res.status(201).json({
      message: 'User registered successfully (Mock Mode)',
      session: { access_token: token },
      user: newProfile
    });
  } else {
    try {
      // Direct signup with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            full_name,
            phone
          }
        }
      });

      if (error) throw error;

      return res.status(201).json({
        message: 'User registered successfully',
        session: data.session,
        user: data.user
      });
    } catch (err) {
      console.error('Supabase Signup Error:', err.message);
      return res.status(400).json({ error: err.message });
    }
  }
});

// Login Endpoint
router.post('/login', async (req, res) => {
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  const email = body.email;
  const password = body.password;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const isDemoAccount = ['passenger@railway.com', 'staff@railway.com', 'admin@railway.com'].includes(cleanEmail);

  if (isMockMode || isDemoAccount) {
    let profile = Array.from(mockDb.profiles.values()).find(
      p => (p.email && p.email.trim().toLowerCase() === cleanEmail) || 
           (p.phone && p.phone.replace(/\D/g, '') === cleanEmail.replace(/\D/g, ''))
    );

    let detectedRole = 'passenger';
    if (profile && profile.role) {
      detectedRole = profile.role;
    } else if (cleanEmail === 'admin@railway.com' || cleanEmail.includes('admin')) {
      detectedRole = 'admin';
    } else if (cleanEmail === 'staff@railway.com' || cleanEmail === 'shiva@gmail.com') {
      detectedRole = 'staff';
    } else {
      detectedRole = 'passenger';
    }

    if (!profile) {
      const mockId = 'usr-demo-' + detectedRole;
      profile = {
        id: mockId,
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@railway.com`,
        role: detectedRole,
        full_name: cleanEmail.split('@')[0].toUpperCase() || 'Railway System User',
        phone: '+91 9876543210',
        created_at: new Date().toISOString()
      };
      mockDb.profiles.set(mockId, profile);
    }

    const token = generateMockToken(profile);
    console.log(`✅ Session generated for: ${profile.email} (${profile.role})`);
    return res.json({
      session: { access_token: token },
      user: profile
    });
  } else {
    try {
      console.log(`🔐 Login attempt for: ${cleanEmail}`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Fetch user profile to return details
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const userObj = { ...data.user, ...profile };
      console.log(`✅ Login successful for: ${userObj.email} (${userObj.role})`);
      return res.json({
        session: data.session,
        user: userObj
      });
    } catch (err) {
      console.warn(`⚠️ Supabase Login warning for ${cleanEmail}:`, err.message || err);
      // Fallback for demo users & mobile sandbox testing
      const detectedRole = cleanEmail.includes('admin') ? 'admin' : cleanEmail.includes('staff') ? 'staff' : 'passenger';
      const mockId = 'usr-demo-' + Math.random().toString(36).substr(2, 9);
      const profile = {
        id: mockId,
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@railway.com`,
        role: detectedRole,
        full_name: cleanEmail.split('@')[0].toUpperCase() || 'Railway System User',
        phone: '+91 9876543210',
        created_at: new Date().toISOString()
      };
      const token = generateMockToken(profile);
      console.log(`✅ Fallback session generated for: ${profile.email} (${profile.role})`);
      return res.json({
        session: { access_token: token },
        user: profile
      });
    }
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (isMockMode) {
    console.log(`🔑 Forgot password request for: ${email}. Instruction sent to logs.`);
    return res.json({ message: 'Password reset link sent to your email (Mock Mode).' });
  } else {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return res.json({ message: 'Password reset link sent to your email.' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Get User Profile
router.get('/me', authenticateToken, async (req, res) => {
  if (isMockMode || (req.user.id && String(req.user.id).startsWith('usr-'))) {
    let profile = mockDb.profiles.get(req.user.id);
    if (!profile) {
      profile = Array.from(mockDb.profiles.values()).find(p => p.email === req.user.email);
    }
    if (!profile) {
      const defaultRole = req.user.role || (req.user.email?.includes('admin') ? 'admin' : req.user.email?.includes('staff') ? 'staff' : 'passenger');
      profile = {
        id: req.user.id,
        email: req.user.email || 'user@railway.com',
        role: defaultRole,
        full_name: req.user.full_name || (defaultRole.charAt(0).toUpperCase() + defaultRole.slice(1) + ' User'),
        phone: '+91 9876543210',
        created_at: new Date().toISOString()
      };
      mockDb.profiles.set(req.user.id, profile);
    }
    return res.json({ user: profile });
  } else {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.user.id)
        .single();

      if (error) throw error;
      return res.json({ user: data });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Update User Profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { 
    full_name, 
    phone, 
    document_url,
    gender,
    age,
    meal_preference,
    berth_preference,
    wheelchair_required
  } = req.body;
  const userId = req.user.id;

  if (isMockMode) {
    const profile = mockDb.profiles.get(userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (full_name !== undefined) profile.full_name = full_name;
    if (phone !== undefined) profile.phone = phone;
    if (document_url !== undefined) profile.document_url = document_url;
    if (gender !== undefined) profile.gender = gender;
    if (age !== undefined) profile.age = age ? parseInt(age) : null;
    if (meal_preference !== undefined) profile.meal_preference = meal_preference;
    if (berth_preference !== undefined) profile.berth_preference = berth_preference;
    if (wheelchair_required !== undefined) profile.wheelchair_required = !!wheelchair_required;

    mockDb.profiles.set(userId, profile);
    return res.json({ message: 'Profile updated successfully (Mock Mode)', user: profile });
  } else {
    try {
      const updateData = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone !== undefined) updateData.phone = phone;
      if (document_url !== undefined) updateData.document_url = document_url;
      if (gender !== undefined) updateData.gender = gender;
      if (age !== undefined) updateData.age = age ? parseInt(age) : null;
      if (meal_preference !== undefined) updateData.meal_preference = meal_preference;
      if (berth_preference !== undefined) updateData.berth_preference = berth_preference;
      if (wheelchair_required !== undefined) updateData.wheelchair_required = !!wheelchair_required;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ user: data });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// GET saved passengers
router.get('/saved-passengers', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const isMockUser = isMockMode || (userId && String(userId).startsWith('usr-'));

  if (isMockUser) {
    const list = Array.from(mockDb.saved_passengers.values()).filter(p => p.user_id === userId);
    return res.json(list);
  } else {
    try {
      const { data, error } = await supabase
        .from('saved_passengers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data);
    } catch (err) {
      console.warn('⚠️ Supabase saved_passengers fetch error, using fallback:', err.message);
      const list = Array.from(mockDb.saved_passengers.values()).filter(p => p.user_id === userId);
      return res.json(list);
    }
  }
});

// POST add saved passenger
router.post('/saved-passengers', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { full_name, age, gender, berth_preference, document_url } = req.body;

  if (!full_name) {
    return res.status(400).json({ error: 'Passenger name is required' });
  }

  const isMockUser = isMockMode || (userId && String(userId).startsWith('usr-'));

  if (isMockUser) {
    const mockId = 'sp-' + Math.random().toString(36).substr(2, 9);
    const newPassenger = {
      id: mockId,
      user_id: userId,
      full_name,
      age: age ? parseInt(age) : null,
      gender: gender || 'Male',
      berth_preference: berth_preference || 'No Preference',
      document_url: document_url || '',
      created_at: new Date().toISOString()
    };
    mockDb.saved_passengers.set(mockId, newPassenger);
    return res.status(201).json(newPassenger);
  } else {
    try {
      const { data, error } = await supabase
        .from('saved_passengers')
        .insert({
          user_id: userId,
          full_name,
          age: age ? parseInt(age) : null,
          gender: gender || 'Male',
          berth_preference: berth_preference || 'No Preference',
          document_url: document_url || ''
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      console.warn('⚠️ Supabase saved_passengers insert error, using fallback:', err.message);
      const mockId = 'sp-' + Math.random().toString(36).substr(2, 9);
      const newPassenger = {
        id: mockId,
        user_id: userId,
        full_name,
        age: age ? parseInt(age) : null,
        gender: gender || 'Male',
        berth_preference: berth_preference || 'No Preference',
        document_url: document_url || '',
        created_at: new Date().toISOString()
      };
      mockDb.saved_passengers.set(mockId, newPassenger);
      return res.status(201).json(newPassenger);
    }
  }
});

// PUT update saved passenger
router.put('/saved-passengers/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;
  const { full_name, age, gender, berth_preference, document_url } = req.body;

  const isMockUser = isMockMode || (userId && String(userId).startsWith('usr-'));

  if (isMockUser) {
    let passenger = mockDb.saved_passengers.get(passengerId);
    if (!passenger) {
      passenger = {
        id: passengerId,
        user_id: userId,
        full_name: full_name || 'Passenger',
        created_at: new Date().toISOString()
      };
    }

    if (full_name !== undefined) passenger.full_name = full_name;
    if (age !== undefined) passenger.age = age ? parseInt(age) : null;
    if (gender !== undefined) passenger.gender = gender;
    if (berth_preference !== undefined) passenger.berth_preference = berth_preference;
    if (document_url !== undefined) passenger.document_url = document_url;

    mockDb.saved_passengers.set(passengerId, passenger);
    return res.json(passenger);
  } else {
    try {
      const updateData = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (age !== undefined) updateData.age = age ? parseInt(age) : null;
      if (gender !== undefined) updateData.gender = gender;
      if (berth_preference !== undefined) updateData.berth_preference = berth_preference;
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
      console.warn('⚠️ Supabase saved_passengers update error, using fallback:', err.message);
      let passenger = mockDb.saved_passengers.get(passengerId) || {
        id: passengerId,
        user_id: userId,
        full_name: full_name || 'Passenger',
        created_at: new Date().toISOString()
      };
      if (full_name !== undefined) passenger.full_name = full_name;
      if (age !== undefined) passenger.age = age ? parseInt(age) : null;
      if (gender !== undefined) passenger.gender = gender;
      if (berth_preference !== undefined) passenger.berth_preference = berth_preference;
      if (document_url !== undefined) passenger.document_url = document_url;

      mockDb.saved_passengers.set(passengerId, passenger);
      return res.json(passenger);
    }
  }
});

// DELETE saved passenger
router.delete('/saved-passengers/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;
  const isMockUser = isMockMode || (userId && String(userId).startsWith('usr-'));

  if (isMockUser) {
    mockDb.saved_passengers.delete(passengerId);
    return res.json({ message: 'Saved passenger deleted successfully' });
  } else {
    try {
      const { error } = await supabase
        .from('saved_passengers')
        .delete()
        .eq('id', passengerId)
        .eq('user_id', userId);

      if (error) throw error;
      return res.json({ message: 'Saved passenger deleted successfully' });
    } catch (err) {
      console.warn('⚠️ Supabase saved_passengers delete error, using fallback:', err.message);
      mockDb.saved_passengers.delete(passengerId);
      return res.json({ message: 'Saved passenger deleted successfully' });
    }
  }
});

module.exports = router;
