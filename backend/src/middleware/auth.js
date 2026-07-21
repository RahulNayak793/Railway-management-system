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
      const profile = mockDb.profiles.get(decoded.id);
      if (!profile) {
        return res.status(403).json({ error: 'User profile not found' });
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
        return res.status(403).json({ error: 'User profile not found in Supabase' });
      }
      req.user.role = profile.role;
      req.user.full_name = profile.full_name;
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
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
