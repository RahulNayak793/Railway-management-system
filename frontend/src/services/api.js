import axios from 'axios';

// Get API base URL dynamically for mobile native (Capacitor), web dev, & production
const getApiBaseUrl = () => {
  // 1. Check explicit Vite environment variables
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  
  // Is running inside Capacitor native webview?
  const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

  if (envUrl) {
    // If envUrl is relative '/api' but we are inside Capacitor native app, map to absolute localhost or host
    if (isCapacitor && envUrl.startsWith('/')) {
      return 'http://10.0.2.2:5000/api';
    }
    // Append /api suffix if not included and it's a full URL
    if (envUrl.startsWith('http') && !envUrl.endsWith('/api') && !envUrl.includes('/api/')) {
      return `${envUrl.replace(/\/$/, '')}/api`;
    }
    return envUrl;
  }

  // 2. Mobile Native fallback (Capacitor)
  if (isCapacitor) {
    // Android emulator host loopback is 10.0.2.2
    return 'http://10.0.2.2:5000/api';
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }

  // Local network testing on mobile web via local IP (e.g. 192.168.x.x)
  const isLocalIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
  if (isLocalIp) {
    return `http://${hostname}:5000/api`;
  }

  // Production web hosting (Vercel, Render, custom domains) - use relative path /api
  return '/api';
};

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000, // 45s timeout for network resilience
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const pathname = window.location.pathname;
    let token = null;
    if (pathname.startsWith('/admin')) {
      token = localStorage.getItem('admin_token') || localStorage.getItem('token');
    } else if (pathname.startsWith('/staff')) {
      token = localStorage.getItem('staff_token') || localStorage.getItem('token');
    } else if (pathname.startsWith('/passenger')) {
      token = localStorage.getItem('passenger_token') || localStorage.getItem('token');
    } else if (pathname.startsWith('/catering')) {
      token = localStorage.getItem('catering_token') || localStorage.getItem('token');
    } else {
      token = localStorage.getItem('catering_token') || localStorage.getItem('passenger_token') || localStorage.getItem('staff_token') || localStorage.getItem('admin_token') || localStorage.getItem('token');
    }
    if (!token) {
      token = localStorage.getItem('catering_token') || localStorage.getItem('admin_token') || localStorage.getItem('staff_token') || localStorage.getItem('passenger_token') || localStorage.getItem('token');
    }
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token errors safely and format network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized token request:', error.config?.url);
    } else if (!error.response) {
      // Network error / connection refused / offline
      error.customMessage = 'Unable to connect to Railway server. Please check your network connection and try again.';
    }
    return Promise.reject(error);
  }
);

export default api;

