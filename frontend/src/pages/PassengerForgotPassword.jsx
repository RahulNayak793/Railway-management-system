import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Train, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

const PassengerForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: cleanEmail });
      setSuccess(res.data?.message || 'Password recovery instructions sent to your email.');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased relative overflow-x-hidden">
      
      {/* BRANDING HEADER (WHITE BACKGROUND) */}
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

        <Link
          to="/passenger/login"
          className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 border border-slate-200 hover:border-blue-300 px-3.5 py-1.5 rounded-full flex items-center space-x-1.5"
        >
          <span>Back to Sign In</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10 my-auto">
        <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-3xl shadow-xl space-y-6">
          
          <div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">PASSWORD RECOVERY</span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Forgot Password?</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Enter your registered email address and we'll send you recovery instructions.
            </p>
          </div>

          {success && (
            <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold space-y-3">
              <div className="flex items-start space-x-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
              <div className="pt-2 border-t border-emerald-200">
                <Link
                  to={`/passenger/reset-password?email=${encodeURIComponent(email)}`}
                  className="w-full inline-block text-center py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition"
                >
                  Proceed to Reset Password
                </Link>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start space-x-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white min-h-[48px] py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send Recovery Instructions</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600 font-medium">
            <Link to="/passenger/login" className="font-extrabold text-blue-600 hover:text-blue-700 hover:underline">
              Back to Sign In
            </Link>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[11px] text-slate-500 font-medium">
        <span>© {new Date().getFullYear()} RailControl Passenger Services. All rights reserved.</span>
      </footer>

    </div>
  );
};

export default PassengerForgotPassword;
