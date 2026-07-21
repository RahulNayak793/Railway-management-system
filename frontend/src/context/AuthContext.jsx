import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
        } catch (err) {
          console.error('Failed to restore session:', err);
          logout();
        }
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
      
      const jwtToken = session.access_token;
      localStorage.setItem('token', jwtToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));
      
      setToken(jwtToken);
      setUser(loggedUser);
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
      
      if (session && session.access_token) {
        const jwtToken = session.access_token;
        localStorage.setItem('token', jwtToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(jwtToken);
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
