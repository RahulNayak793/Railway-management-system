import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../services/api';
import { 
  User, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ArrowRight, 
  Clock, 
  Train, 
  Info,
  ShieldAlert
} from 'lucide-react';

const Login = ({ mode }) => {
  const { login, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initialPortal = mode === 'admin' || location.pathname.includes('/admin') ? 'admin' : 'staff';
  const [portal, setPortal] = useState(initialPortal);

  const savedRemember = localStorage.getItem('remember_login') === 'true';
  const savedEmail = savedRemember ? (localStorage.getItem('remembered_email') || '') : '';

  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(savedRemember);
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  useEffect(() => {
    setError(null);
  }, [portal]);

  const handlePortalSwitch = (targetPortal) => {
    setPortal(targetPortal);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    const cleanEmail = email ? email.trim().toLowerCase() : '';

    try {
      const user = await login(cleanEmail, password, portal);

      if (rememberMe) {
        localStorage.setItem('remember_login', 'true');
        localStorage.setItem('remembered_email', cleanEmail);
      } else {
        localStorage.removeItem('remember_login');
        localStorage.removeItem('remembered_email');
      }

      if (user?.role === 'admin' || portal === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/staff/dashboard');
      }
    } catch (err) {
      console.error('Internal auth error:', err.message || err);
      const friendlyMsg = err.response?.data?.error || err.message || 'Authentication failed. Please verify credentials.';
      setError(friendlyMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess('');
    setFormLoading(true);

    const cleanForgotEmail = forgotEmail ? forgotEmail.trim().toLowerCase() : '';

    try {
      const res = await api.post('/auth/forgot-password', { email: cleanForgotEmail });
      setForgotSuccess(res.data?.message || 'Security recovery link sent to official email.');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to process recovery request.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased relative overflow-x-hidden">
      
      {/* 1. TOP NEUTRAL SECURITY ALERT TICKER BANNER */}
      <div className="w-full bg-[#0B182B] text-white text-[11px] font-semibold py-1.5 px-4 flex items-center justify-between border-b border-white/10 z-30">
        <div className="flex items-center space-x-2 overflow-hidden w-full sm:w-auto">
          <span className="bg-amber-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded tracking-wider shrink-0">
            SECURITY ALERT
          </span>
          <p className="text-slate-200 truncate text-[11px] font-medium">
            AUTHORIZED PERSONNEL ONLY: Unauthorised access attempts to official Railway Systems are monitored & logged.
          </p>
        </div>
      </div>

      {/* 2. TOP WHITE BRANDING HEADER BAR */}
      <div className="w-full bg-white border-b border-slate-200 py-3.5 px-6 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Train className="h-5 w-5" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-black tracking-tight text-slate-900">RailControl</span>
            <span className="text-slate-300 font-light">|</span>
            <span className="text-xs text-slate-500 font-medium">Railway Management Operations & Administration</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Operations Helpline: 139</span>
          </div>
          <Link
            to="/passenger/login"
            className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 border border-slate-200 hover:border-blue-300 px-3.5 py-1.5 rounded-full flex items-center space-x-1.5"
          >
            <span>Passenger Portal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. MAIN CONTENT CONTAINER (WHITE CANVAS) */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 items-center justify-center gap-8 z-10 my-auto">
        
        {/* LEFT DARK NAVY SIDEBAR CARD WITH TRAIN IMAGE */}
        <div className="hidden lg:flex flex-col justify-between w-full lg:w-5/12 bg-[#0B1A30] text-white rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden min-h-[580px]">
          <div className="space-y-6 z-10">
            
            {/* Category Badge & Title */}
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-blue-500/20 border border-blue-400/30 text-cyan-300 text-[10px] font-black uppercase tracking-widest">
                <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
                <span>STAFF & ADMINISTRATOR ACCESS</span>
              </div>
              <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight">
                Railway<br />Management System
              </h2>
              <p className="text-xs text-slate-300 font-medium">Secure access for authorized railway staff and administrators.</p>
            </div>

            {/* Feature Bullet List */}
            <ul className="space-y-3.5 pt-1">
              <li className="flex items-start space-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-cyan-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">PROTECTED ACCREDITATION</h4>
                  <p className="text-[11px] text-slate-400">Multi-level authentication for authorized personnel.</p>
                </div>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-cyan-400">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">ROLE-BASED PERMISSIONS</h4>
                  <p className="text-[11px] text-slate-400">Strict isolation between Staff duties & Admin control.</p>
                </div>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-cyan-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">REAL-TIME OPERATIONS</h4>
                  <p className="text-[11px] text-slate-400">Manage schedules, manifests, status & system parameters.</p>
                </div>
              </li>
            </ul>

            {/* Security Advisory Box */}
            <div className="bg-[#081324] border border-slate-800 p-3 rounded-2xl z-10">
              <span className="text-[11px] font-extrabold text-amber-400 tracking-wider flex items-center mb-0.5">
                <Info className="h-3.5 w-3.5 mr-1 shrink-0" />
                SECURITY NOTICE
              </span>
              <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                Never share credentials or OTP. Staff accounts are provisioned exclusively by system administrators.
              </p>
            </div>
          </div>

          {/* Restored Vande Bharat Train Image */}
          <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-lg relative z-10">
            <img src="/train.png" alt="Vande Bharat Express Train" className="w-full h-36 object-cover" />
          </div>
        </div>

        {/* RIGHT SIDE MAIN AUTH PANEL */}
        <div className="w-full lg:w-7/12 flex flex-col justify-center items-center">
          <div className="w-full max-w-[460px] bg-white rounded-3xl p-6 sm:p-8 shadow-xl text-slate-800 border border-slate-200">
            
            {/* Top Icon & Header */}
            <div className="text-center mb-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3 shadow-inner">
                <Lock className="h-6 w-6" />
              </div>
              
              {showForgotPassword ? (
                <>
                  <h3 className="text-xl font-black text-slate-900">Reset Official Password</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Enter your registered official email address to receive recovery instructions</p>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">STAFF & ADMINISTRATOR ACCESS</span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {portal === 'staff' ? 'Staff Operations Portal' : 'Administrator Control Portal'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {portal === 'staff' 
                      ? 'Sign in to access Railway Operations Control Panel' 
                      : 'Sign in to access Railway System Administration Portal'}
                  </p>
                </>
              )}
            </div>

            {/* Staff / Admin Portal Selector Tabs */}
            {!showForgotPassword && (
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-5 border border-slate-200 text-xs font-bold shadow-inner">
                <button
                  type="button"
                  onClick={() => handlePortalSwitch('staff')}
                  className={`flex-1 py-2.5 rounded-xl transition-all ${
                    portal === 'staff' 
                      ? 'bg-white text-emerald-700 shadow-md font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Staff Portal
                </button>
                <button
                  type="button"
                  onClick={() => handlePortalSwitch('admin')}
                  className={`flex-1 py-2.5 rounded-xl transition-all ${
                    portal === 'admin' 
                      ? 'bg-white text-indigo-700 shadow-md font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Admin Portal
                </button>
              </div>
            )}

            {/* Error / Success Alerts */}
            {error && (
              <div role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-600 mb-4 font-bold animate-shake">
                {error}
              </div>
            )}
            {forgotSuccess && (
              <div role="status" className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-600 mb-4 font-bold">
                {forgotSuccess}
              </div>
            )}

            {showForgotPassword ? (
              /* Forgot Password Form */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">OFFICIAL EMAIL ADDRESS</label>
                  <div className="relative rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition-all">
                    <Mail className="text-slate-400 absolute left-3 top-3.5 h-4 w-4" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="official.email@railway.gov.in"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-4 py-3 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotSuccess('');
                      setError(null);
                    }}
                    className="w-1/2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-1/2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3 text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {formLoading ? 'Sending...' : 'Send Recovery Link'}
                  </button>
                </div>
              </form>
            ) : (
              /* Main Internal Auth Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Email Address */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    {portal === 'admin' ? 'ADMINISTRATOR EMAIL' : 'OFFICIAL STAFF EMAIL'}
                  </label>
                  <div className="relative rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition-all">
                    <Mail className="text-slate-400 absolute left-3 top-3.5 h-4 w-4" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={portal === 'admin' ? 'admin@railway.com' : 'staff@railway.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-4 py-3 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">PASSWORD</label>
                  <div className="relative rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition-all">
                    <Lock className="text-slate-400 absolute left-3 top-3.5 h-4 w-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-10 py-3 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex justify-between items-center pt-1">
                  <label className="flex items-center space-x-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" 
                    />
                    <span className="font-semibold">Remember Me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotEmail(email);
                      setError(null);
                    }}
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Main Submit Button */}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>
                    {formLoading 
                      ? 'Authenticating...' 
                      : portal === 'staff' ? 'Sign In to Staff Portal' : 'Sign In to Admin Portal'}
                  </span>
                  {!formLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            )}

            {/* Small Neutral Link to Passenger Portal */}
            <div className="pt-6 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500">Passenger looking for bookings & tickets? </span>
              <Link to="/passenger/login" className="text-xs font-extrabold text-blue-600 hover:underline ml-1">
                Sign in to Passenger Portal
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* FOOTER (WHITE BACKGROUND) */}
      <div className="w-full bg-white border-t border-slate-200 py-3.5 px-4 text-center text-[11px] text-slate-500 space-y-1 z-20">
        <p>© {new Date().getFullYear()} National Railway Management System. Internal Personnel Operations.</p>
      </div>

    </div>
  );
};

export default Login;
