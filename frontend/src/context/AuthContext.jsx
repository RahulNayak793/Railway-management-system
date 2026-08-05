import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.data && res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.warn('Could not refresh session from backend, preserving local session:', err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { session, user: loggedUser } = res.data;
      
      const jwtToken = session?.access_token || res.data?.token || res.data?.access_token;
      if (jwtToken) {
        localStorage.setItem('token', jwtToken);
        setToken(jwtToken);
      }
      if (loggedUser) {
        localStorage.setItem('user', JSON.stringify(loggedUser));
        setUser(loggedUser);
      }
      setLoading(false);
      return loggedUser;
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.error || 'Login failed. Please check credentials.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const signup = async ({ email, password, full_name, role, phone }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/signup', { email, password, full_name, role, phone });
      const { session, user: newUser } = res.data;
      
      const jwtToken = session?.access_token || res.data?.token || res.data?.access_token;
      if (jwtToken) {
        localStorage.setItem('token', jwtToken);
        setToken(jwtToken);
      }
      if (newUser) {
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
      }
      
      setLoading(false);
      return newUser;
    } catch (err) {
      setLoading(false);
      const errMsg = err.response?.data?.error || 'Signup failed. Please try again.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    setUser,
    token,
    loading,
    error,
    login,
    signup,
    logout,
    setError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
