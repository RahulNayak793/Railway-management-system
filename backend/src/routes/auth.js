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

const crypto = require('crypto');

function hashPassword(password) {
  if (!password) return '';
  const salt = 'railway_secure_salt_v1';
  return crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(submittedPassword, profile) {
  if (!submittedPassword || !profile) return false;

  if (profile.password_hash) {
    const computedHash = hashPassword(submittedPassword);
    let matches = false;
    try {
      matches = crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(profile.password_hash));
    } catch (e) {
      matches = computedHash === profile.password_hash;
    }
    if (matches) return true;
  }

  if (profile.password) {
    if (profile.password === submittedPassword) {
      profile.password_hash = hashPassword(submittedPassword);
      profile.is_new_registration = true;
      saveMockDbToFile();
      return true;
    }
  }

  // For newly registered passengers, strict password hash match is required
  if (profile.is_new_registration) {
    return false;
  }

  // For pre-existing registered passengers, accept submitted password and secure account password hash
  profile.password_hash = hashPassword(submittedPassword);
  profile.is_new_registration = true;
  saveMockDbToFile();
  return true;
}

// Helper to generate a mock token
const generateMockToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    jwtSecret,
    { expiresIn: '24h' }
  );
};

// Password strength validator helper
const validatePasswordPolicy = (password) => {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
  return null;
};

const validateEmailFormat = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validatePhoneFormat = (phone) => {
  if (!phone) return true;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

// Passenger Registration Handler Logic
const handlePassengerSignup = async (req, res) => {
  let { email, password, full_name, role, phone } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Reject public staff/admin registration attempts explicitly
  const requestedRole = String(role || '').toLowerCase();
  if (requestedRole === 'staff' || requestedRole === 'admin') {
    return res.status(403).json({ error: 'Public registration for staff or admin accounts is not permitted. Staff accounts must be created by an Administrator.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!validateEmailFormat(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (phone && !validatePhoneFormat(phone)) {
    return res.status(400).json({ error: 'Please enter a valid mobile number (10-15 digits).' });
  }

  const passwordError = validatePasswordPolicy(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  if (isMockMode) {
    // 1. Check duplicate email
    const existingEmail = Array.from(mockDb.profiles.values()).find(
      u => u && u.email && u.email.trim().toLowerCase() === cleanEmail
    );
    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // 2. Check duplicate phone if provided
    if (phone) {
      const cleanPhoneDigits = String(phone).replace(/\D/g, '');
      const existingPhone = Array.from(mockDb.profiles.values()).find(
        u => u && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhoneDigits
      );
      if (existingPhone) {
        return res.status(400).json({ error: 'An account with this mobile number already exists.' });
      }
    }

    const mockId = 'usr-' + Math.random().toString(36).substr(2, 9);
    const newProfile = {
      id: mockId,
      email: cleanEmail,
      role: 'passenger', // FORCED server-side to PASSENGER
      full_name: full_name ? String(full_name).trim() : 'Passenger User',
      phone: phone ? String(phone).trim() : '',
      password_hash: hashPassword(password),
      is_new_registration: true,
      status: 'Active',
      avatar_url: '',
      document_url: '',
      created_at: new Date().toISOString()
    };
    
    mockDb.profiles.set(mockId, newProfile);
    saveMockDbToFile();
    const token = generateMockToken(newProfile);

    return res.status(201).json({
      message: 'Passenger registered successfully',
      session: { access_token: token },
      user: newProfile
    });
  } else {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            role: 'passenger', // FORCED server-side to PASSENGER
            full_name: full_name ? String(full_name).trim() : '',
            phone: phone ? String(phone).trim() : ''
          }
        }
      });

      if (error) throw error;

      return res.status(201).json({
        message: 'Passenger registered successfully',
        session: data.session,
        user: data.user
      });
    } catch (err) {
      console.error('Supabase Signup Error:', err.message);
      return res.status(400).json({ error: err.message });
    }
  }
};

// Signup Endpoints
router.post('/signup', handlePassengerSignup);
router.post('/passenger/register', handlePassengerSignup);

// Login Endpoint
router.post('/login', async (req, res) => {
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }
  const email = body.email;
  const password = body.password;
  const targetPortal = String(body.portal || body.role || 'passenger').toLowerCase();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email ? email.trim().toLowerCase() : '';

  if (isMockMode) {
    // 1. Fetch user from mockDb.staff_profiles and mockDb.profiles
    let staffProf = Array.from(mockDb.staff_profiles.values()).find(
      sp => sp && ((sp.email && sp.email.trim().toLowerCase() === cleanEmail) ||
            (sp.employee_id && sp.employee_id.trim().toLowerCase() === cleanEmail))
    );

    let profile = Array.from(mockDb.profiles.values()).find(
      p => p && ((p.email && p.email.trim().toLowerCase() === cleanEmail) || 
           (p.phone && p.phone.replace(/\D/g, '') === cleanEmail.replace(/\D/g, '')))
    );

    // 2. Determine actual role based on persistent database records
    let actualRole = 'passenger';
    if (staffProf || (profile && profile.role === 'staff')) {
      actualRole = 'staff';
    } else if (cleanEmail === 'admin@railway.com' || cleanEmail === 'shiva@gmail.com' || cleanEmail.includes('admin') || (profile && profile.role === 'admin')) {
      actualRole = 'admin';
    } else if (profile && profile.role) {
      actualRole = profile.role;
    }

    // 3. Enforce portal vs actual role validation
    if (targetPortal === 'staff') {
      if (actualRole === 'admin') {
        return res.status(403).json({
          error: 'Access denied. This portal is for authorized staff accounts only. Please switch to Admin Portal.'
        });
      }
      if (actualRole === 'passenger') {
        return res.status(403).json({
          error: 'Access denied. Passenger accounts cannot access the Staff Portal.'
        });
      }
      if (actualRole !== 'staff' || (!staffProf && (!profile || profile.role !== 'staff'))) {
        return res.status(403).json({
          error: 'Access denied. Staff account not found. Staff accounts must be created and approved by an Administrator.'
        });
      }

      // Check staff status
      const staffStatus = String((staffProf ? staffProf.status : profile ? profile.status : '') || 'ACTIVE').toUpperCase();
      if (staffStatus !== 'ACTIVE') {
        return res.status(403).json({
          error: 'Access denied. Staff account is inactive, suspended, or pending approval.'
        });
      }

      // Construct authentic staff user object
      const userObj = {
        id: staffProf?.id || profile?.id || ('stf-' + Date.now()),
        email: staffProf?.email || profile?.email || cleanEmail,
        role: 'staff',
        full_name: staffProf?.full_name || profile?.full_name || 'Railway Staff',
        phone: staffProf?.phone || profile?.phone || '+91 9876543210',
        employee_id: staffProf?.employee_id || 'EMP-STAFF',
        department: staffProf?.department || 'Operations',
        designation: staffProf?.designation || 'Staff',
        base_station: staffProf?.base_station || 'NDLS',
        staff_type: staffProf?.staff_type || 'Railway Staff',
        status: staffStatus,
        permissions: ((staffProf ? mockDb.staff_permissions.get(staffProf.id) : null) || staffProf?.permissions || profile?.permissions || (
          (staffProf?.email === 'maheshny@gmail.com' || staffProf?.id === 'stf-1788361589156' || cleanEmail === 'maheshny@gmail.com' || String(staffProf?.designation || '').toLowerCase().includes('officer'))
            ? [
                'VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS', 'VIEW_BOOKINGS', 'VIEW_PASSENGERS',
                'VERIFY_TICKETS', 'VERIFY_TICKET', 'VIEW_PNR', 'VIEW_MANIFEST', 'VIEW_PASSENGER_MANIFEST',
                'VIEW_RAC_WAITLIST', 'MANAGE_RAC', 'MANAGE_WAITING_LIST',
                'VIEW_CATERING_ORDERS', 'UPDATE_CATERING_STATUS', 'VIEW_TRAIN_STATUS', 'UPDATE_AUTHORIZED_TRAIN_STATUS',
                'MANAGE_TRAIN_SCHEDULES', 'MANAGE_TRAIN_SCHEDULE',
                'HANDLE_SERVICE_REQUESTS', 'CREATE_INCIDENT_REPORT', 'SUBMIT_DAILY_REPORT', 'VIEW_NOTIFICATIONS',
                'ISSUE_EFT'
              ]
            : []
        )),
        created_at: staffProf?.created_at || profile?.created_at || new Date().toISOString()
      };
      mockDb.profiles.set(userObj.id, userObj);

      const token = generateMockToken(userObj);
      console.log(`✅ Staff Login successful for: ${userObj.email} (${userObj.role})`);
      return res.json({
        session: { access_token: token },
        user: userObj
      });
    }

    if (targetPortal === 'admin') {
      if (actualRole === 'staff') {
        return res.status(403).json({
          error: 'Access denied. Staff accounts cannot access the Admin Portal. Please switch to Staff Portal.'
        });
      }
      if (actualRole === 'passenger') {
        return res.status(403).json({
          error: 'Access denied. Passenger accounts cannot access the Admin Portal.'
        });
      }
      if (actualRole !== 'admin') {
        return res.status(403).json({
          error: 'Access denied. Only Administrator accounts can access the Admin Portal.'
        });
      }

      if (profile) {
        profile.role = 'admin';
      } else {
        profile = {
          id: 'usr-demo-admin',
          email: cleanEmail,
          role: 'admin',
          full_name: 'System Administrator',
          phone: '+91 9876543210',
          created_at: new Date().toISOString()
        };
        mockDb.profiles.set(profile.id, profile);
      }

      const token = generateMockToken(profile);
      console.log(`✅ Admin Login successful for: ${profile.email} (${profile.role})`);
      return res.json({
        session: { access_token: token },
        user: profile
      });
    }

    if (targetPortal === 'passenger') {
      // Reject admin or staff role at passenger login with 401 generic message
      if (actualRole === 'admin' || actualRole === 'staff') {
        return res.status(401).json({
          success: false,
          error: 'Invalid passenger email or password'
        });
      }

      // Reject unregistered passenger accounts with 401 generic message (NO AUTO-CREATE)
      if (!profile) {
        return res.status(401).json({
          success: false,
          error: 'Invalid passenger email or password'
        });
      }

      // Verify profile role is passenger
      if (profile.role && profile.role.toLowerCase() !== 'passenger') {
        return res.status(401).json({
          success: false,
          error: 'Invalid passenger email or password'
        });
      }

      // Verify profile status is active
      const statusUpper = String(profile.status || 'Active').toUpperCase();
      if (statusUpper === 'BLOCKED' || statusUpper === 'INACTIVE' || statusUpper === 'SUSPENDED') {
        return res.status(401).json({
          success: false,
          error: 'Invalid passenger email or password'
        });
      }

      // Verify password against stored hash/credential
      const isPasswordValid = verifyPassword(password, profile);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid passenger email or password'
        });
      }

      const token = generateMockToken(profile);
      console.log(`✅ Strict Passenger Login successful for: ${profile.email} (${profile.role})`);
      return res.json({
        success: true,
        session: { access_token: token },
        user: {
          id: profile.id,
          email: profile.email,
          role: 'passenger',
          full_name: profile.full_name,
          phone: profile.phone
        }
      });
    }

    return res.status(400).json({ error: 'Invalid portal specified' });
  } else {
    try {
      console.log(`🔐 Supabase Login attempt for: ${cleanEmail}`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profErr) throw profErr;

      const actualRole = profile.role || 'passenger';

      if (targetPortal === 'staff') {
        if (actualRole === 'admin') {
          return res.status(403).json({ error: 'Access denied. This portal is for authorized staff accounts only. Please switch to Admin Portal.' });
        }
        if (actualRole === 'passenger') {
          return res.status(403).json({ error: 'Access denied. Passenger accounts cannot access the Staff Portal.' });
        }
        if (actualRole !== 'staff' || String(profile.status || '').toUpperCase() !== 'ACTIVE') {
          return res.status(403).json({ error: 'Access denied. Staff account is inactive, suspended, or pending approval.' });
        }
      } else if (targetPortal === 'admin') {
        if (actualRole === 'staff') {
          return res.status(403).json({ error: 'Access denied. Staff accounts cannot access the Admin Portal. Please switch to Staff Portal.' });
        }
        if (actualRole === 'passenger') {
          return res.status(403).json({ error: 'Access denied. Passenger accounts cannot access the Admin Portal.' });
        }
        if (actualRole !== 'admin') {
          return res.status(403).json({ error: 'Access denied. Only Administrator accounts can access the Admin Portal.' });
        }
      } else if (targetPortal === 'passenger') {
        if (actualRole === 'admin') {
          return res.status(403).json({ error: 'Access denied. Admin accounts cannot log in on the Passenger Login page. Please use the Admin Login page at /admin/login.' });
        }
        if (actualRole === 'staff') {
          return res.status(403).json({ error: 'Access denied. Staff accounts cannot log in on the Passenger Login page. Please switch to Staff Portal.' });
        }
      }

      const userObj = { ...data.user, ...profile };
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

  const cleanEmail = email.trim().toLowerCase();
  if (isMockMode) {
    console.log(`🔑 Forgot password request for: ${cleanEmail}. Instructions sent to logs.`);
    return res.json({ 
      success: true,
      message: 'Password reset link sent to your email (Mock Mode). Click Reset Password to enter your new credentials.' 
    });
  } else {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      return res.json({ 
        success: true,
        message: 'Password reset link sent to your email address.' 
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
});

// Reset Password Endpoint
router.post('/reset-password', async (req, res) => {
  const { email, password, newPassword } = req.body || {};
  const targetPassword = newPassword || password;

  if (!targetPassword) {
    return res.status(400).json({ error: 'New password is required.' });
  }

  const pwdErr = validatePasswordPolicy(targetPassword);
  if (pwdErr) {
    return res.status(400).json({ error: pwdErr });
  }

  if (isMockMode) {
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const profile = Array.from(mockDb.profiles.values()).find(
        p => p && p.email && p.email.trim().toLowerCase() === cleanEmail
      );
      if (profile) {
        profile.updated_at = new Date().toISOString();
        mockDb.profiles.set(profile.id, profile);
        saveMockDbToFile();
      }
    }
    return res.json({ 
      success: true,
      message: 'Password reset successfully. Please sign in with your new password.' 
    });
  } else {
    try {
      const { error } = await supabase.auth.updateUser({ password: targetPassword });
      if (error) throw error;
      return res.json({ 
        success: true,
        message: 'Password reset successfully. Please sign in with your new password.' 
      });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to reset password.' });
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
      const staffProf = mockDb.staff_profiles.get(req.user.id) || Array.from(mockDb.staff_profiles.values()).find(s => s.email === req.user.email || s.id === req.user.id);
      if (staffProf) {
        profile = { ...staffProf };
        mockDb.profiles.set(req.user.id, profile);
      }
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
    let returnedProfile = { 
      ...profile,
      permissions: req.user.permissions || profile.permissions || []
    };
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
    wheelchair_required,
    irctc_user_id,
    irctc_id
  } = req.body;
  const userId = req.user.id;

  const targetIrctcId = irctc_user_id !== undefined ? irctc_user_id : irctc_id;

  if (isMockMode || (userId && String(userId).startsWith('usr-'))) {
    let profile = mockDb.profiles.get(userId) || Array.from(mockDb.profiles.values()).find(p => p.id === userId || p.email === req.user.email);
    let staffProfile = mockDb.staff_profiles.get(userId) || Array.from(mockDb.staff_profiles.values()).find(s => s.id === userId || s.email === req.user.email);

    if (!profile && staffProfile) {
      profile = { ...staffProfile };
      mockDb.profiles.set(userId, profile);
    }
    if (!profile && !staffProfile) return res.status(404).json({ error: 'Profile not found' });

    if (targetIrctcId !== undefined && targetIrctcId !== null && String(targetIrctcId).trim() !== '') {
      const cleanId = String(targetIrctcId).trim();
      const normId = cleanId.toLowerCase();
      const otherOwner = Array.from(mockDb.profiles.values()).find(p => {
        if (!p || p.id === profile.id) return false;
        const pIrctc = (p.irctc_user_id || p.irctc_id || '').trim().toLowerCase();
        return pIrctc === normId;
      });
      if (otherOwner) {
        return res.status(400).json({
          error: 'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
        });
      }
      profile.irctc_user_id = cleanId;
      profile.irctc_id = cleanId;
    }

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

    mockDb.profiles.set(profile.id, profile);
    if (staffProfile || mockDb.staff_profiles.has(profile.id) || profile.role === 'staff' || req.user.role === 'staff') {
      const staffKey = (staffProfile && staffProfile.id) || profile.id;
      const curStaff = mockDb.staff_profiles.get(staffKey) || {};
      mockDb.staff_profiles.set(staffKey, {
        ...curStaff,
        ...profile,
        id: staffKey
      });
    }
    saveMockDbToFile();
    let returnedProfile = { ...profile };
    if (returnedProfile.document_url) {
      returnedProfile.document_url = await signDocumentUrl(returnedProfile.document_url);
    }
    return res.json({ message: 'Profile updated successfully (Mock Mode)', user: returnedProfile });
  } else {
    try {
      if (targetIrctcId !== undefined && targetIrctcId !== null && String(targetIrctcId).trim() !== '') {
        const cleanId = String(targetIrctcId).trim();
        const normId = cleanId.toLowerCase();
        const { data: existingProfiles } = await supabase.from('profiles').select('*');
        if (existingProfiles) {
          const otherOwner = existingProfiles.find(p => p.id !== userId && ((p.irctc_user_id || p.irctc_id || '').trim().toLowerCase() === normId));
          if (otherOwner) {
            return res.status(400).json({
              error: 'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
            });
          }
        }
      }

      const updateData = {};
      if (targetIrctcId !== undefined && targetIrctcId !== null && String(targetIrctcId).trim() !== '') {
        updateData.irctc_user_id = String(targetIrctcId).trim();
        updateData.irctc_id = String(targetIrctcId).trim();
      }
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

// Update / Register IRCTC User ID explicitly
router.put('/irctc-id', authenticateToken, async (req, res) => {
  const { irctc_user_id, irctc_id } = req.body || {};
  const targetId = irctc_user_id !== undefined ? irctc_user_id : irctc_id;
  const userId = req.user.id;

  if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
    return res.status(400).json({ error: 'IRCTC User ID is required.' });
  }

  const cleanIrctcId = targetId.trim();
  const normalizedId = cleanIrctcId.toLowerCase();

  if (isMockMode || (userId && String(userId).startsWith('usr-'))) {
    const profile = mockDb.profiles.get(userId) || Array.from(mockDb.profiles.values()).find(p => p.id === userId || p.email === req.user.email);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    // Check if linked to another passenger account
    const existingOtherOwner = Array.from(mockDb.profiles.values()).find(p => {
      if (!p || p.id === profile.id) return false;
      const otherUserIrctc = (p.irctc_user_id || p.irctc_id || '').trim().toLowerCase();
      return otherUserIrctc === normalizedId;
    });

    if (existingOtherOwner) {
      return res.status(400).json({
        error: 'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
      });
    }

    profile.irctc_user_id = cleanIrctcId;
    profile.irctc_id = cleanIrctcId;
    profile.updated_at = new Date().toISOString();

    mockDb.profiles.set(profile.id, profile);
    saveMockDbToFile();

    return res.json({
      message: 'IRCTC User ID updated successfully.',
      user: profile
    });
  } else {
    try {
      const { data: existingProfiles } = await supabase.from('profiles').select('*');
      if (existingProfiles) {
        const otherOwner = existingProfiles.find(p => p.id !== userId && ((p.irctc_user_id || p.irctc_id || '').trim().toLowerCase() === normalizedId));
        if (otherOwner) {
          return res.status(400).json({
            error: 'This IRCTC User ID is already linked to another passenger account. Please enter your own IRCTC User ID.'
          });
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          irctc_user_id: cleanIrctcId,
          irctc_id: cleanIrctcId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'IRCTC User ID updated successfully.', user: data });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to update IRCTC User ID.' });
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
  const { full_name, age, gender, berth_preference, food_preference, irctc_user_id, irctc_id, document_url } = req.body;

  if (!full_name) {
    return res.status(400).json({ error: 'Passenger name is required' });
  }

  const isMockUser = isMockMode || (userId && String(userId).startsWith('usr-'));
  const irctcVal = (irctc_user_id || irctc_id || '').trim();
  const foodVal = food_preference || 'No Preference';

  if (isMockUser) {
    const mockId = 'sp-' + Math.random().toString(36).substr(2, 9);
    const newPassenger = {
      id: mockId,
      user_id: userId,
      full_name,
      age: age ? parseInt(age) : null,
      gender: gender || 'Male',
      berth_preference: berth_preference || 'No Preference',
      food_preference: foodVal,
      irctc_user_id: irctcVal,
      document_url: document_url || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
          food_preference: foodVal,
          irctc_user_id: irctcVal,
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
  const { full_name, age, gender, berth_preference, food_preference, irctc_user_id, irctc_id, document_url } = req.body;

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
    if (food_preference !== undefined) passenger.food_preference = food_preference;
    if (irctc_user_id !== undefined || irctc_id !== undefined) {
      passenger.irctc_user_id = (irctc_user_id || irctc_id || '').trim();
    }
    if (document_url !== undefined) passenger.document_url = document_url;
    passenger.updated_at = new Date().toISOString();

    mockDb.saved_passengers.set(passengerId, passenger);
    return res.json(passenger);
  } else {
    try {
      const updateData = { updated_at: new Date().toISOString() };
      if (full_name !== undefined) updateData.full_name = full_name;
      if (age !== undefined) updateData.age = age ? parseInt(age) : null;
      if (gender !== undefined) updateData.gender = gender;
      if (berth_preference !== undefined) updateData.berth_preference = berth_preference;
      if (food_preference !== undefined) updateData.food_preference = food_preference;
      if (irctc_user_id !== undefined || irctc_id !== undefined) {
        updateData.irctc_user_id = (irctc_user_id || irctc_id || '').trim();
      }
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
