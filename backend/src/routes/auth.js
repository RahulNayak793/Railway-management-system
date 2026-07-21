const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, isMockMode, mockDb } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

// Helper to generate a mock token
const generateMockToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (isMockMode) {
    // Find mock profile by email
    const profile = Array.from(mockDb.profiles.values()).find(p => p.email === email);
    if (!profile) {
      // Create a default demo account if they input test accounts
      if (email.includes('@railway.com') || email.includes('admin') || email.includes('staff') || email.includes('passenger')) {
        const role = email.includes('admin') ? 'admin' : email.includes('staff') ? 'staff' : 'passenger';
        const demoId = 'usr-demo-' + role;
        const newDemo = {
          id: demoId,
          email,
          role,
          full_name: role.toUpperCase() + ' User',
          phone: '+919999999999',
          created_at: new Date().toISOString()
        };
        mockDb.profiles.set(demoId, newDemo);
        const token = generateMockToken(newDemo);
        return res.json({
          session: { access_token: token },
          user: newDemo
        });
      }
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = generateMockToken(profile);
    return res.json({
      session: { access_token: token },
      user: profile
    });
  } else {
    try {
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

      return res.json({
        session: data.session,
        user: {
          ...data.user,
          ...profile
        }
      });
    } catch (err) {
      console.error('Supabase Login Error:', err.message);
      return res.status(400).json({ error: err.message });
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
  if (isMockMode) {
    const profile = mockDb.profiles.get(req.user.id);
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

  if (isMockMode) {
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
      return res.status(400).json({ error: err.message });
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

  if (isMockMode) {
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
      return res.status(400).json({ error: err.message });
    }
  }
});

// PUT update saved passenger
router.put('/saved-passengers/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;
  const { full_name, age, gender, berth_preference, document_url } = req.body;

  if (isMockMode) {
    const passenger = mockDb.saved_passengers.get(passengerId);
    if (!passenger) {
      return res.status(404).json({ error: 'Saved passenger not found' });
    }
    if (passenger.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this saved passenger' });
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
      return res.status(400).json({ error: err.message });
    }
  }
});

// DELETE saved passenger
router.delete('/saved-passengers/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const passengerId = req.params.id;

  if (isMockMode) {
    const passenger = mockDb.saved_passengers.get(passengerId);
    if (!passenger) {
      return res.status(404).json({ error: 'Saved passenger not found' });
    }
    if (passenger.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this saved passenger' });
    }

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
      return res.status(400).json({ error: err.message });
    }
  }
});

module.exports = router;
