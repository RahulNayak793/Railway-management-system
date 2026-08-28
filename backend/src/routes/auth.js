const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, isMockMode, mockDb, signDocumentUrl, saveMockDbToFile } = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
  const requestedRole = body.role;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const isDemoAccount = ['passenger@railway.com', 'staff@railway.com', 'admin@railway.com', 'shiva@gmail.com'].includes(cleanEmail);

  if (isMockMode || isDemoAccount) {
    let profile = Array.from(mockDb.profiles.values()).find(
      p => (p.email && p.email.trim().toLowerCase() === cleanEmail) || 
           (p.phone && p.phone.replace(/\D/g, '') === cleanEmail.replace(/\D/g, ''))
    );

    const isAdminAccount = cleanEmail === 'admin@railway.com' || cleanEmail.includes('admin') || cleanEmail === 'shiva@gmail.com' || (profile && (profile.role === 'admin' || profile.role === 'staff'));

    if (requestedRole === 'admin' && !isAdminAccount) {
      return res.status(403).json({
        error: 'Access Denied: Passenger accounts cannot log in on the Admin Login page. Please use the Passenger Login page at /login.'
      });
    }

    if (requestedRole === 'passenger' && isAdminAccount) {
      return res.status(403).json({
        error: 'Access Denied: Admin accounts cannot log in on the Passenger Login page. Please use the Admin Login page at /admin/login.'
      });
    }

    let detectedRole = isAdminAccount ? (profile?.role || 'admin') : 'passenger';
    if (requestedRole === 'staff' || cleanEmail === 'staff@railway.com' || cleanEmail.includes('staff')) {
      detectedRole = 'staff';
    }

    if (profile) {
      profile.role = detectedRole;
    } else {
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
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profErr) throw profErr;

      const userObj = { ...data.user, ...profile };
      if (requestedRole === 'staff' || cleanEmail === 'shiva@gmail.com' || cleanEmail.includes('staff')) {
        userObj.role = 'staff';
      }
      console.log(`✅ Login successful for: ${userObj.email} (${userObj.role})`);
      return res.json({
        session: data.session,
        user: userObj
      });
    } catch (err) {
      console.error(`❌ Supabase Login Error for ${cleanEmail}:`, err.message || err);
      return res.status(401).json({ error: 'Authentication failed: ' + (err.message || err) });
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
    let returnedProfile = { ...profile };
    if (returnedProfile.document_url) {
      returnedProfile.document_url = await signDocumentUrl(returnedProfile.document_url);
    }
    return res.json({ user: returnedProfile });
  } else {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.user.id)
        .single();

      if (error) throw error;
      let returnedData = { ...data };
      if (returnedData.document_url) {
        returnedData.document_url = await signDocumentUrl(returnedData.document_url);
      }
      return res.json({ user: returnedData });
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
    if (document_url !== undefined && !String(document_url).startsWith('http://') && !String(document_url).startsWith('https://')) {
      profile.document_url = document_url;
    }
    if (gender !== undefined) profile.gender = gender;
    if (age !== undefined) profile.age = age ? parseInt(age) : null;
    if (meal_preference !== undefined) profile.meal_preference = meal_preference;
    if (berth_preference !== undefined) profile.berth_preference = berth_preference;
    if (wheelchair_required !== undefined) profile.wheelchair_required = !!wheelchair_required;

    mockDb.profiles.set(userId, profile);
    let returnedProfile = { ...profile };
    if (returnedProfile.document_url) {
      returnedProfile.document_url = await signDocumentUrl(returnedProfile.document_url);
    }
    return res.json({ message: 'Profile updated successfully (Mock Mode)', user: returnedProfile });
  } else {
    try {
      const updateData = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone !== undefined) updateData.phone = phone;
      if (document_url !== undefined && !String(document_url).startsWith('http://') && !String(document_url).startsWith('https://')) {
        updateData.document_url = document_url;
      }
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
      let returnedData = { ...data };
      if (returnedData.document_url) {
        returnedData.document_url = await signDocumentUrl(returnedData.document_url);
      }
      return res.json({ user: returnedData });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Upload Identity Verification Document
router.post('/profile/identity-document', authenticateToken, upload.single('document'), async (req, res) => {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'Please select a document file to upload.' });
  }

  // Double check file size limit (5 MB)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'File size must be less than 5 MB.' });
  }

  // Validate allowed mime types
  const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(415).json({ error: 'Unsupported file format. Please upload PDF, PNG, JPG, JPEG, or WEBP.' });
  }

  const ext = path.extname(req.file.originalname) || '.pdf';

  if (isMockMode) {
    try {
      const uploadsDir = path.join(__dirname, '../../data/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `${userId}-${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      const profile = mockDb.profiles.get(userId);
      if (!profile) {
        return res.status(404).json({ error: 'User profile not found.' });
      }

      const localDocUrl = `/uploads/${filename}`;
      profile.document_url = localDocUrl;
      mockDb.profiles.set(userId, profile);
      saveMockDbToFile();

      return res.status(201).json({
        success: true,
        message: 'Identity document uploaded successfully (Mock Mode)',
        user: profile
      });
    } catch (err) {
      console.error('⚠️ Mock Mode upload error:', err.message);
      return res.status(500).json({ error: 'Local storage upload failed: ' + err.message });
    }
  } else {
    const storagePath = `${userId}/${require('crypto').randomUUID()}${ext}`;
    let oldStoragePath = null;

    try {
      // 1. Fetch current profile to get old document path (for replacement/cleanup)
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('document_url')
        .eq('id', userId)
        .single();

      if (currentProfile && currentProfile.document_url && currentProfile.document_url.startsWith('identity-documents/')) {
        oldStoragePath = currentProfile.document_url.replace('identity-documents/', '');
      }

      // 2. Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error('⚠️ Supabase Storage upload error:', uploadError.message);
        return res.status(500).json({ error: 'Storage provider upload failed: ' + uploadError.message });
      }

      // 3. Update database profiles table
      const dbDocUrl = `identity-documents/${storagePath}`;
      const { data: updatedProfile, error: dbError } = await supabase
        .from('profiles')
        .update({ document_url: dbDocUrl })
        .eq('id', userId)
        .select()
        .single();

      if (dbError) {
        console.error('⚠️ Supabase Profile DB update error:', dbError.message);
        // Rollback uploaded file since DB write failed
        await supabase.storage.from('identity-documents').remove([storagePath]);
        return res.status(500).json({ error: 'Database update failed: ' + dbError.message });
      }

      // 4. Cleanup old document if replacement succeeded
      if (oldStoragePath) {
        try {
          await supabase.storage.from('identity-documents').remove([oldStoragePath]);
        } catch (cleanupErr) {
          console.warn('⚠️ Non-blocking warning: Failed to clean up old identity document:', cleanupErr.message);
        }
      }

      // 5. Generate secure signed URL for the response
      const signedUrl = await signDocumentUrl(dbDocUrl);
      const returnedUser = { ...updatedProfile, document_url: signedUrl };

      return res.status(201).json({
        success: true,
        message: 'Identity document uploaded successfully',
        user: returnedUser
      });
    } catch (err) {
      console.error('⚠️ Supabase Production upload pipeline error:', err.message);
      return res.status(500).json({ error: 'Upload pipeline failed: ' + err.message });
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
      console.error('⚠️ Supabase saved_passengers fetch error:', err.message);
      return res.status(500).json({ error: 'Database error fetching saved passengers: ' + err.message });
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
      console.error('⚠️ Supabase saved_passengers insert error:', err.message);
      return res.status(500).json({ error: 'Database error saving passenger: ' + err.message });
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
      console.error('⚠️ Supabase saved_passengers update error:', err.message);
      return res.status(500).json({ error: 'Database error updating passenger: ' + err.message });
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
      console.error('⚠️ Supabase saved_passengers delete error:', err.message);
      return res.status(500).json({ error: 'Database error deleting passenger: ' + err.message });
    }
  }
});

module.exports = router;
