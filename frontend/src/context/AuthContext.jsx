import React, { createContext, useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const defaultAuthValue = {
  user: null,
  setUser: () => {},
  token: null,
  loading: false,
  error: null,
  login: async () => ({ success: false }),
  cateringLogin: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: () => {},
  setError: () => {},
  passengerUser: null,
  adminUser: null,
  staffUser: null,
  cateringUser: null,
  cateringToken: null
};

const AuthContext = createContext(defaultAuthValue);

export const AuthProvider = ({ children }) => {
  const location = useLocation();

  const [passengerUser, setPassengerUser] = useState(() => {
    try {
      const saved = localStorage.getItem('passenger_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [passengerToken, setPassengerToken] = useState(() => localStorage.getItem('passenger_token') || null);

  const [adminUser, setAdminUser] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const r = (parsed?.role || '').toLowerCase();
      if (r === 'admin') return parsed;
      return null;
    } catch {
      return null;
    }
  });
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('admin_token') || null);

  const [staffUser, setStaffUser] = useState(() => {
    try {
      const saved = localStorage.getItem('staff_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const r = (parsed?.role || '').toLowerCase();
      if (r === 'staff' || r === 'admin') return parsed;
      return null;
    } catch {
      return null;
    }
  });
  const [staffToken, setStaffToken] = useState(() => localStorage.getItem('staff_token') || null);

  const [cateringUser, setCateringUser] = useState(() => {
    try {
      const saved = localStorage.getItem('catering_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const r = (parsed?.role || '').toUpperCase();
      if (r === 'CATERING_COMPANY') return parsed;
      return null;
    } catch {
      return null;
    }
  });
  const [cateringToken, setCateringToken] = useState(() => localStorage.getItem('catering_token') || null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state across browser tabs when localStorage is updated
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key || e.key === 'passenger_user' || e.key === 'passenger_token') {
        try {
          const pUser = localStorage.getItem('passenger_user');
          setPassengerUser(pUser ? JSON.parse(pUser) : null);
        } catch { setPassengerUser(null); }
        setPassengerToken(localStorage.getItem('passenger_token') || null);
      }
      if (!e.key || e.key === 'admin_user' || e.key === 'admin_token') {
        try {
          const aUser = localStorage.getItem('admin_user');
          setAdminUser(aUser ? JSON.parse(aUser) : null);
        } catch { setAdminUser(null); }
        setAdminToken(localStorage.getItem('admin_token') || null);
      }
      if (!e.key || e.key === 'staff_user' || e.key === 'staff_token') {
        try {
          const sUser = localStorage.getItem('staff_user');
          setStaffUser(sUser ? JSON.parse(sUser) : null);
        } catch { setStaffUser(null); }
        setStaffToken(localStorage.getItem('staff_token') || null);
      }
      if (!e.key || e.key === 'catering_user' || e.key === 'catering_token') {
        try {
          const cUser = localStorage.getItem('catering_user');
          setCateringUser(cUser ? JSON.parse(cUser) : null);
        } catch { setCateringUser(null); }
        setCateringToken(localStorage.getItem('catering_token') || null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const path = location.pathname;
  let user = passengerUser;
  let token = passengerToken;

  if (path.startsWith('/admin')) {
    user = adminUser;
    token = adminToken;
  } else if (path.startsWith('/staff')) {
    user = staffUser;
    token = staffToken;
  } else if (path.startsWith('/passenger')) {
    user = passengerUser;
    token = passengerToken;
  } else if (path.startsWith('/catering')) {
    user = cateringUser;
    token = cateringToken;
  } else if (path === '/login' || path === '/login/' || path === '/catering/login') {
    user = null;
    token = null;
  } else {
    user = passengerUser || staffUser || adminUser || cateringUser;
    token = passengerToken || staffToken || adminToken || cateringToken;
  }

  const customSetUser = (u) => {
    const role = (u?.role || '').toUpperCase();
    if (role === 'CATERING_COMPANY' || path.startsWith('/catering')) {
      setCateringUser(u);
      if (u) localStorage.setItem('catering_user', JSON.stringify(u));
      else localStorage.removeItem('catering_user');
    } else if (role === 'ADMIN' || path.startsWith('/admin')) {
      setAdminUser(u);
      if (u) localStorage.setItem('admin_user', JSON.stringify(u));
      else localStorage.removeItem('admin_user');
    } else if (role === 'STAFF' || path.startsWith('/staff')) {
      setStaffUser(u);
      if (u) localStorage.setItem('staff_user', JSON.stringify(u));
      else localStorage.removeItem('staff_user');
    } else {
      setPassengerUser(u);
      if (u) localStorage.setItem('passenger_user', JSON.stringify(u));
      else localStorage.removeItem('passenger_user');
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      let activeToken = null;
      let activeRole = 'passenger';

      if (path.startsWith('/admin')) {
        activeToken = adminToken;
        activeRole = 'admin';
      } else if (path.startsWith('/staff')) {
        activeToken = staffToken;
        activeRole = 'staff';
      } else if (path.startsWith('/passenger')) {
        activeToken = passengerToken;
        activeRole = 'passenger';
      } else if (path.startsWith('/catering')) {
        activeToken = cateringToken;
        activeRole = 'catering_company';
      }

      if (activeToken) {
        try {
          const endpoint = activeRole === 'catering_company' ? '/catering/company/me' : '/auth/me';
          const res = await api.get(endpoint, {
            headers: { Authorization: `Bearer ${activeToken}` }
          });
          if (activeRole === 'catering_company') {
            const fetched = res.data?.company || res.data?.user;
            if (fetched) {
              const fullCatering = {
                ...(res.data.user || {}),
                ...(res.data.company || {}),
                role: 'CATERING_COMPANY'
              };
              setCateringUser(fullCatering);
              localStorage.setItem('catering_user', JSON.stringify(fullCatering));
            }
          } else if (res.data && res.data.user) {
            const fetchedUser = res.data.user;
            const r = (fetchedUser.role || activeRole).toLowerCase();
            if (r === 'admin') {
              setAdminUser(fetchedUser);
              localStorage.setItem('admin_user', JSON.stringify(fetchedUser));
            } else if (r === 'staff') {
              setStaffUser(fetchedUser);
              localStorage.setItem('staff_user', JSON.stringify(fetchedUser));
            } else {
              setPassengerUser(fetchedUser);
              localStorage.setItem('passenger_user', JSON.stringify(fetchedUser));
            }
          }
        } catch (err) {
          console.warn('Could not refresh session from backend:', err);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [location.pathname, adminToken, staffToken, passengerToken, cateringToken]);

  const login = async (email, password, portal) => {
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password, portal });
      const { session, user: loggedUser } = res.data;
      
      const jwtToken = session?.access_token || res.data?.token || res.data?.access_token;
      if (jwtToken && loggedUser) {
        const userRole = (loggedUser.role || portal || 'passenger').toLowerCase();
        
        if (userRole === 'admin') {
          localStorage.setItem('admin_token', jwtToken);
          localStorage.setItem('admin_user', JSON.stringify(loggedUser));
          setAdminToken(jwtToken);
          setAdminUser(loggedUser);
        } else if (userRole === 'staff') {
          localStorage.setItem('staff_token', jwtToken);
          localStorage.setItem('staff_user', JSON.stringify(loggedUser));
          setStaffToken(jwtToken);
          setStaffUser(loggedUser);
        } else {
          localStorage.setItem('passenger_token', jwtToken);
          localStorage.setItem('passenger_user', JSON.stringify(loggedUser));
          setPassengerToken(jwtToken);
          setPassengerUser(loggedUser);
        }

        setLoading(false);
        return loggedUser;
      }
      throw new Error('Authentication failed. Invalid server response.');
    } catch (err) {
      setLoading(false);
      const errorMsg = err.response?.data?.error || err.message || 'Authentication failed. Please verify credentials.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const signup = async ({ email, password, full_name, role, phone }) => {
    setError(null);
    setLoading(true);
    const userRole = (role || 'passenger').toLowerCase();

    try {
      const res = await api.post('/auth/signup', { email, password, full_name, role: userRole, phone });
      const { session, user: newUser } = res.data;
      
      const jwtToken = session?.access_token || res.data?.token || res.data?.access_token;
      if (jwtToken && newUser) {
        if (userRole === 'admin') {
          localStorage.setItem('admin_token', jwtToken);
          localStorage.setItem('admin_user', JSON.stringify(newUser));
          setAdminToken(jwtToken);
          setAdminUser(newUser);
        } else if (userRole === 'staff') {
          localStorage.setItem('staff_token', jwtToken);
          localStorage.setItem('staff_user', JSON.stringify(newUser));
          setStaffToken(jwtToken);
          setStaffUser(newUser);
        } else {
          localStorage.setItem('passenger_token', jwtToken);
          localStorage.setItem('passenger_user', JSON.stringify(newUser));
          setPassengerToken(jwtToken);
          setPassengerUser(newUser);
        }

        setLoading(false);
        return newUser;
      }
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error || err.message || 'Registration failed.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const cateringLogin = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/catering/auth/login', { email, password });
      const { token: jwtToken, user: loggedUser } = res.data;
      if (jwtToken && loggedUser) {
        localStorage.setItem('catering_token', jwtToken);
        localStorage.setItem('catering_user', JSON.stringify(loggedUser));
        setCateringToken(jwtToken);
        setCateringUser(loggedUser);
        setLoading(false);
        return loggedUser;
      }
      throw new Error('Authentication failed. Invalid server response.');
    } catch (err) {
      setLoading(false);
      const errorMsg = err.response?.data?.error || err.message || 'Authentication failed. Please verify credentials.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const logout = (targetRole) => {
    let activeRole = (targetRole || '').toLowerCase();

    if (!activeRole) {
      if (path.startsWith('/admin')) activeRole = 'admin';
      else if (path.startsWith('/staff')) activeRole = 'staff';
      else if (path.startsWith('/passenger')) activeRole = 'passenger';
      else if (path.startsWith('/catering')) activeRole = 'catering_company';
      else activeRole = (user?.role || 'passenger').toLowerCase();
    }

    if (activeRole === 'catering_company' || activeRole === 'catering') {
      localStorage.removeItem('catering_token');
      localStorage.removeItem('catering_user');
      setCateringToken(null);
      setCateringUser(null);
    } else if (activeRole === 'admin') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      setAdminToken(null);
      setAdminUser(null);
    } else if (activeRole === 'staff') {
      localStorage.removeItem('staff_token');
      localStorage.removeItem('staff_user');
      setStaffToken(null);
      setStaffUser(null);
    } else {
      localStorage.removeItem('passenger_token');
      localStorage.removeItem('passenger_user');
      setPassengerToken(null);
      setPassengerUser(null);
    }
  };

  const value = {
    user,
    setUser: customSetUser,
    token,
    loading,
    error,
    login,
    cateringLogin,
    signup,
    logout,
    setError,
    passengerUser,
    adminUser,
    staffUser,
    cateringUser,
    cateringToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  return ctx || defaultAuthValue;
};
