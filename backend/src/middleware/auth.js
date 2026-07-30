const jwt = require('jsonwebtoken');
const { isMockMode, mockDb, supabase } = require('../config/supabase');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // Contains id, email, and metadata

    // Verify user exists and fetch role details
    if (isMockMode) {
      let profile = mockDb.profiles.get(decoded.id);
      if (!profile && decoded.email) {
        profile = Array.from(mockDb.profiles.values()).find(p => p.email === decoded.email);
      }
      if (!profile) {
        const userRole = decoded.role || (decoded.email?.includes('admin') ? 'admin' : decoded.email?.includes('staff') ? 'staff' : 'passenger');
        profile = {
          id: decoded.id || 'usr-demo-' + userRole,
          email: decoded.email || 'user@railway.com',
          role: userRole,
          full_name: userRole.toUpperCase() + ' User',
          phone: '+919999999999',
          created_at: new Date().toISOString()
        };
        mockDb.profiles.set(profile.id, profile);
      }
      req.user.role = profile.role;
      req.user.full_name = profile.full_name;
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', decoded.id)
        .single();
      
      if (error || !profile) {
        req.user.role = decoded.role || (decoded.email?.includes('admin') ? 'admin' : decoded.email?.includes('staff') ? 'staff' : 'passenger');
        req.user.full_name = decoded.full_name || 'Railway System User';
      } else {
        req.user.role = profile.role;
        req.user.full_name = profile.full_name;
      }
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRoles = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires one of: ${roles.join(', ')}` });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRoles
};
