import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Train, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ArrowRight, 
  Ticket, 
  Compass, 
  Utensils, 
  Activity, 
  CheckCircle2,
  ShieldCheck,
  Globe
} from 'lucide-react';

const PassengerLogin = () => {
  const { login, error, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const savedRemember = localStorage.getItem('remember_login') === 'true';
  const savedEmail = savedRemember ? (localStorage.getItem('remembered_email') || '') : '';

  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(savedRemember);
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const successMsg = location.state?.message;

  useEffect(() => {
    setError(null);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    const cleanEmail = email ? email.trim().toLowerCase() : '';

    try {
      const user = await login(cleanEmail, password, 'passenger');

      if (rememberMe) {
        localStorage.setItem('remember_login', 'true');
        localStorage.setItem('remembered_email', cleanEmail);
      } else {
        localStorage.removeItem('remember_login');
        localStorage.removeItem('remembered_email');
      }

      navigate('/passenger');
    } catch (err) {
      console.error('Passenger login error:', err.message || err);
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased relative overflow-x-hidden">
      
      {/* 1. TOP BRANDING HEADER BAR (WHITE BACKGROUND) */}
      <header className="w-full bg-white border-b border-slate-200 py-3.5 px-6 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Train className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-black tracking-tight text-slate-900">RailControl</span>
              <span className="text-slate-300 font-light">|</span>
              <span className="text-xs text-slate-500 font-medium">Passenger Portal</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Emergency Helpline: 139</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN PASSENGER AUTH CONTAINER (WHITE CANVAS) */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10 my-auto">
        <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* LEFT / HERO SECTION WITH TRAIN IMAGE */}
          <div className="lg:col-span-5 bg-[#0B1A30] text-white p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
            
            <div className="space-y-5 z-10">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-black uppercase tracking-wider">
                <Globe className="h-3.5 w-3.5 text-cyan-400" />
                <span>Passenger Portal</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  Your Journey<br />Starts Here
                </h1>
                <p className="text-xs text-slate-300 font-medium mt-2 leading-relaxed">
                  Sign in to manage your train bookings, e-Tickets, journey schedules, and railway services.
                </p>
              </div>

              {/* Feature Bullet Highlights */}
              <div className="space-y-2.5 pt-1">
                {[
                  { icon: Ticket, title: 'Book Train Tickets', desc: 'Instant seat reservation across all railway routes' },
                  { icon: Compass, title: 'Manage Your Journeys', desc: 'Track PNR status, seat location & train schedules' },
                  { icon: Utensils, title: 'Order Onboard Meals', desc: 'Fresh e-catering delivered right to your seat' },
                  { icon: Activity, title: 'Track Train Status', desc: 'Real-time GPS live location & delay updates' }
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div key={idx} className="flex items-start space-x-3 bg-white/5 p-2.5 rounded-2xl border border-white/10">
                      <div className="p-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-white">{item.title}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Restored Train Image Card */}
            <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-lg relative z-10">
              <img src="/train.png" alt="Vande Bharat Express Train" className="w-full h-36 object-cover" />
            </div>

          </div>

          {/* RIGHT / LOGIN CARD */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 md:p-10 flex flex-col justify-between space-y-6">
            
            <div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">PASSENGER ACCESS</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome Back</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Sign in to continue your journey.</p>
            </div>

            {/* Notifications */}
            {successMsg && (
              <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-start space-x-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-shake">
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="passenger@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent pl-11 pr-4 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Password
                  </label>
                  <Link
                    to="/passenger/forgot-password"
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent pl-11 pr-11 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-slate-600 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500"
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>

              {/* Primary Submit CTA */}
              <button
                type="submit"
                disabled={formLoading}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white min-h-[48px] py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {formLoading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Navigation Links */}
            <div className="pt-4 border-t border-slate-100 space-y-3 text-center">
              <div className="text-xs text-slate-600 font-medium">
                <span>Don't have an account? </span>
                <Link
                  to="/passenger/register"
                  className="font-extrabold text-blue-600 hover:text-blue-700 hover:underline ml-1"
                >
                  Create Passenger Account
                </Link>
              </div>

              <div className="text-xs text-slate-500">
                <Link
                  to="/passenger/search"
                  className="font-bold text-slate-500 hover:text-slate-800 underline underline-offset-4 transition-colors"
                >
                  Continue as Guest (Search Trains)
                </Link>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* 3. FOOTER (WHITE BACKGROUND) */}
      <footer className="w-full bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[11px] text-slate-500 font-medium">
        <span>© {new Date().getFullYear()} RailControl Passenger Services. All rights reserved.</span>
      </footer>

    </div>
  );
};

export default PassengerLogin;
