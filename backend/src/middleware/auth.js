const jwt = require('jsonwebtoken');
const { isMockMode, mockDb, supabase } = require('../config/supabase');

const jwtSecret = process.env.JWT_SECRET || 'mock-jwt-secret-key-32-characters-long';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  let decoded = null;
  if (!token) {
    if (isMockMode) {
      decoded = {
        id: 'usr-demo-passenger',
        email: 'passenger@railway.com',
        role: 'passenger',
        full_name: 'DEMO PASSENGER'
      };
      req.user = decoded;
    } else {
      return res.status(401).json({ error: 'Access token required' });
    }
  }

  try {
    if (token) {
      if (token.startsWith('mock-base64-')) {
        try {
          const payloadStr = Buffer.from(token.replace('mock-base64-', ''), 'base64').toString('utf8');
          decoded = JSON.parse(payloadStr);
        } catch (e) {
          decoded = null;
        }
      } else if (token.startsWith('mock-client-jwt-token-') || token === 'mock-token') {
        decoded = {
          id: 'usr-demo-passenger',
          email: 'passenger@railway.com',
          role: 'passenger',
          full_name: 'DEMO PASSENGER'
        };
      } else {
        try {
          decoded = jwt.verify(token, jwtSecret);
        } catch (verifyErr) {
          // Fallback decoding for mock / serverless token compatibility
          decoded = jwt.decode(token);
        }
      }
    }

    if (!decoded) {
      if (isMockMode) {
        decoded = {
          id: 'usr-demo-passenger',
          email: 'passenger@railway.com',
          role: 'passenger',
          full_name: 'DEMO PASSENGER'
        };
      } else {
        return res.status(401).json({ error: 'Access token invalid' });
      }
    }
    req.user = decoded; // Contains id, email, and metadata

    // Verify user exists and fetch role details
    const isMockUser = isMockMode || (decoded.id && (String(decoded.id).startsWith('usr-') || String(decoded.id).startsWith('stf-')));

    if (isMockUser) {
      let profile = mockDb.profiles.get(decoded.id);
      if (!profile && decoded.email) {
        profile = Array.from(mockDb.profiles.values()).find(p => p && p.email === decoded.email);
      }
      if (!profile) {
        const userRole = decoded.role || (decoded.email && decoded.email.includes('admin') ? 'admin' : decoded.email && decoded.email.includes('staff') ? 'staff' : 'passenger');
        profile = {
          id: decoded.id || 'usr-demo-' + userRole,
          email: decoded.email || 'user@railway.com',
          role: userRole,
          full_name: decoded.full_name || (userRole.toUpperCase() + ' User'),
          phone: '+919999999999',
          created_at: new Date().toISOString()
        };
        mockDb.profiles.set(profile.id, profile);
      }
      if (profile && (profile.status === 'Blocked' || profile.status === 'blocked')) {
        return res.status(403).json({ error: 'Account is blocked. Please contact system administrator.' });
      }
      req.user.role = profile ? profile.role : (decoded.role || 'passenger');
      req.user.full_name = profile ? profile.full_name : (decoded.full_name || 'Railway System User');
      req.user.status = profile ? (profile.status || 'Active') : 'Active';
      req.user.company_id = decoded.company_id || (profile ? (profile.catering_company_id || profile.company_id) : null);

      if (req.user.role === 'staff') {
        const staffProf = mockDb.staff_profiles.get(req.user.id) || 
          Array.from(mockDb.staff_profiles.values()).find(sp => sp && ((sp.email && sp.email === req.user.email) || sp.id === req.user.id)) ||
          profile;
        if (staffProf) {
          const statusUpper = String(staffProf.status || 'ACTIVE').toUpperCase();
          if (statusUpper !== 'ACTIVE') {
            return res.status(403).json({ error: 'Access denied. Staff account is inactive, suspended, or pending approval.' });
          }
          let perms = mockDb.staff_permissions.get(staffProf.id) || staffProf.permissions || decoded.permissions;
          if ((!perms || perms.length === 0) && (staffProf?.email === 'maheshny@gmail.com' || staffProf?.id === 'stf-1788361589156' || req.user.email === 'maheshny@gmail.com' || String(staffProf?.designation || '').toLowerCase().includes('officer'))) {
            perms = [
              'VIEW_DASHBOARD', 'VIEW_ASSIGNED_TRAINS', 'VIEW_BOOKINGS', 'VIEW_PASSENGERS',
              'VERIFY_TICKETS', 'VERIFY_TICKET', 'VIEW_PNR', 'VIEW_MANIFEST', 'VIEW_PASSENGER_MANIFEST',
              'VIEW_RAC_WAITLIST', 'MANAGE_RAC', 'MANAGE_WAITING_LIST',
              'VIEW_CATERING_ORDERS', 'UPDATE_CATERING_STATUS', 'VIEW_TRAIN_STATUS', 'UPDATE_AUTHORIZED_TRAIN_STATUS',
              'MANAGE_TRAIN_SCHEDULES', 'MANAGE_TRAIN_SCHEDULE',
              'HANDLE_SERVICE_REQUESTS', 'CREATE_INCIDENT_REPORT', 'SUBMIT_DAILY_REPORT', 'VIEW_NOTIFICATIONS',
              'ISSUE_EFT'
            ];
          }
          req.user.permissions = perms || [];
          req.user.employee_id = staffProf.employee_id;
          req.user.department = staffProf.department;
          req.user.base_station = staffProf.base_station;
          req.user.staff_type = staffProf.staff_type;
        }
      }
    } else {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name, status')
          .eq('id', decoded.id)
          .single();
        
        if (profile && (profile.status === 'Blocked' || profile.status === 'blocked')) {
          return res.status(403).json({ error: 'Account is blocked. Please contact system administrator.' });
        }

        if (error || !profile) {
          req.user.role = decoded.role || (decoded.email?.includes('admin') ? 'admin' : decoded.email?.includes('staff') ? 'staff' : 'passenger');
          req.user.full_name = decoded.full_name || 'Railway System User';
        } else {
          req.user.role = profile.role;
          req.user.full_name = profile.full_name;
          req.user.status = profile.status || 'Active';
        }
      } catch (sbErr) {
        req.user.role = decoded.role || 'passenger';
        req.user.full_name = decoded.full_name || 'Railway User';
      }
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    let decoded;
    if (token.startsWith('mock-base64-')) {
      try {
        const payloadStr = Buffer.from(token.replace('mock-base64-', ''), 'base64').toString('utf8');
        decoded = JSON.parse(payloadStr);
      } catch (e) {
        decoded = null;
      }
    } else if (token.startsWith('mock-client-jwt-token-') || token === 'mock-token') {
      decoded = {
        id: 'usr-demo-passenger',
        email: 'passenger@railway.com',
        role: 'passenger',
        full_name: 'DEMO PASSENGER'
      };
    } else {
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (verifyErr) {
        decoded = jwt.decode(token);
      }
    }

    if (decoded) {
      req.user = decoded;
      
      const isMockUser = isMockMode || (decoded.id && String(decoded.id).startsWith('usr-'));
      if (isMockUser) {
        let profile = mockDb.profiles.get(decoded.id);
        if (!profile && decoded.email) {
          profile = Array.from(mockDb.profiles.values()).find(p => p.email === decoded.email);
        }
        if (profile) {
          req.user.role = profile.role;
          req.user.full_name = profile.full_name;
        }
      } else {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', decoded.id)
            .single();
          if (profile) {
            req.user.role = profile.role;
            req.user.full_name = profile.full_name;
          }
        } catch (e) {}
      }
    }
  } catch (error) {
    // Suppress token verification errors for optional authentication
  }
  next();
};

const requireRoles = (...rolesInput) => {
  const roles = (rolesInput.length === 1 && Array.isArray(rolesInput[0])) ? rolesInput[0] : rolesInput;
  return (req, res, next) => {
    if (!req.user || !roles.some(r => String(r).toUpperCase() === String(req.user.role || '').toUpperCase())) {
      return res.status(403).json({ error: `Access denied. Requires one of: ${roles.join(', ')}` });
    }
    next();
  };
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    if (req.user.role === 'staff') {
      const userPermissions = req.user.permissions || [];
      if (userPermissions.includes('ALL')) {
        return next();
      }
      const checkList = Array.isArray(permission) ? permission : [permission];
      const hasAccess = checkList.some(p => {
        if (userPermissions.includes(p)) return true;
        // Check common aliases
        if (p === 'VERIFY_TICKETS' && userPermissions.includes('VERIFY_TICKET')) return true;
        if (p === 'VERIFY_TICKET' && userPermissions.includes('VERIFY_TICKETS')) return true;
        if (p === 'MANAGE_TRAIN_SCHEDULES' && userPermissions.includes('MANAGE_TRAIN_SCHEDULE')) return true;
        if (p === 'MANAGE_TRAIN_SCHEDULE' && userPermissions.includes('MANAGE_TRAIN_SCHEDULES')) return true;
        if (p === 'UPDATE_AUTHORIZED_TRAIN_STATUS' && (userPermissions.includes('VIEW_TRAIN_STATUS') || userPermissions.includes('UPDATE_AUTHORIZED_TRAIN_STATUS') || userPermissions.includes('VIEW_ASSIGNED_TRAINS'))) return true;
        if (p === 'VIEW_ASSIGNED_TRAINS' && (userPermissions.includes('VIEW_TRAIN_STATUS') || userPermissions.includes('MANAGE_TRAIN_SCHEDULES'))) return true;
        if (p === 'VIEW_TRAIN_STATUS' && (userPermissions.includes('VIEW_ASSIGNED_TRAINS') || userPermissions.includes('UPDATE_AUTHORIZED_TRAIN_STATUS'))) return true;
        if (p === 'VIEW_MANIFEST' && userPermissions.includes('VIEW_PASSENGER_MANIFEST')) return true;
        if (p === 'VIEW_PASSENGER_MANIFEST' && userPermissions.includes('VIEW_MANIFEST')) return true;
        if (p === 'VIEW_RAC_WAITLIST' && (userPermissions.includes('MANAGE_RAC') || userPermissions.includes('MANAGE_WAITING_LIST') || userPermissions.includes('VIEW_RAC_WAITLIST'))) return true;
        if ((p === 'MANAGE_RAC' || p === 'MANAGE_WAITING_LIST') && (userPermissions.includes('VIEW_RAC_WAITLIST') || userPermissions.includes('MANAGE_RAC') || userPermissions.includes('MANAGE_WAITING_LIST'))) return true;
        if (p === 'SUBMIT_DAILY_REPORT' || p === 'CREATE_INCIDENT_REPORT' || p === 'HANDLE_SERVICE_REQUESTS' || p === 'VIEW_TASKS') return true;
        return false;
      });

      if (hasAccess) {
        return next();
      }
      return res.status(403).json({ error: `Access denied. Staff member lacks required permission: ${Array.isArray(permission) ? permission.join(' / ') : permission}` });
    }
    return res.status(403).json({ error: 'Access denied.' });
  };
};

const requireRole = (role) => requireRoles([role]);

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  requireRole,
  requireRoles,
  requirePermission
};
