import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Train, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

const PassengerRegister = () => {
  const { signup, error, setError } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Live password policy checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!phone || !/^\+?[0-9\s\-]{10,15}$/.test(phone)) {
      setError('Please enter a valid mobile number (10 to 15 digits).');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all security requirements listed below.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match. Please verify your password entry.');
      return;
    }

    if (!agreeTerms) {
      setError('You must accept the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }

    setFormLoading(true);

    try {
      await signup({
        email: cleanEmail,
        password,
        full_name: fullName.trim(),
        role: 'passenger',
        phone: phone.trim()
      });

      navigate('/passenger', { replace: true });
    } catch (err) {
      console.error('Registration error:', err.message || err);
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased relative overflow-x-hidden">
      
      {/* 1. BRANDING HEADER BAR (WHITE BACKGROUND) */}
      <header className="w-full bg-white border-b border-slate-200 py-3.5 px-6 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Train className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-black tracking-tight text-slate-900">RailControl</span>
              <span className="text-slate-300 font-light">|</span>
              <span className="text-xs text-slate-500 font-medium">Passenger Registration</span>
            </div>
          </div>
        </div>

        <Link
          to="/passenger/login"
          className="text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 border border-slate-200 hover:border-blue-300 px-3.5 py-1.5 rounded-full flex items-center space-x-1.5"
        >
          <span>Sign In</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* 2. MAIN REGISTRATION CONTAINER */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10 my-auto">
        <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* LEFT SIDEBAR HERO WITH TRAIN IMAGE */}
          <div className="lg:col-span-5 bg-[#0B1A30] text-white p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
            
            <div className="space-y-5 z-10">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span>Join RailControl Today</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  Create Your<br />Passenger Account
                </h1>
                <p className="text-xs text-slate-300 font-medium mt-2 leading-relaxed">
                  Register once and manage all your railway journeys, e-Tickets, and meal preferences in one place.
                </p>
              </div>

              {/* Benefits checklist */}
              <div className="space-y-2.5 pt-1">
                {[
                  'Instant e-Ticket booking & PNR tracking',
                  'Auto refund processing on cancellation',
                  'Custom berth & meal preferences saving',
                  'Live train tracking & emergency alerts'
                ].map((text, idx) => (
                  <div key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Restored Train Image Card */}
            <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 shadow-lg relative z-10">
              <img src="/train.png" alt="Vande Bharat Express Train" className="w-full h-36 object-cover" />
            </div>
          </div>

          {/* RIGHT REGISTRATION FORM */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 md:p-10 space-y-6">
            
            <div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">PASSENGER REGISTRATION</span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Create your RailControl account</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Register once and manage all your railway journeys in one place.</p>
            </div>

            {error && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start space-x-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* SECTION: PERSONAL INFORMATION */}
              <div className="space-y-3.5">
                <h3 className="text-[11px] font-black uppercase text-blue-600 tracking-wider">Personal Information</h3>
                
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Full Name *</label>
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                    <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Rahul Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-transparent pl-11 pr-4 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Email Address & Mobile Number grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Email Address *</label>
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                      <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="rahul@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent pl-11 pr-3 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Mobile Number *</label>
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                      <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        placeholder="+91 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-transparent pl-11 pr-3 py-3 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: SECURITY */}
              <div className="space-y-3.5 pt-1">
                <h3 className="text-[11px] font-black uppercase text-blue-600 tracking-wider">Security</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Password *</label>
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-transparent pl-11 pr-11 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Confirm Password *</label>
                    <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 transition">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-transparent pl-11 pr-11 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Policy Indicator Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                    Password Security Requirements:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      <span>{hasMinLength ? '✓' : '○'} At least 8 characters</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      <span>{hasUppercase ? '✓' : '○'} One uppercase letter</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasLowercase ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      <span>{hasLowercase ? '✓' : '○'} One lowercase letter</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      <span>{hasNumber ? '✓' : '○'} One number</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${hasSpecial ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      <span>{hasSpecial ? '✓' : '○'} One special character</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 ${passwordsMatch ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      <span>{passwordsMatch ? '✓' : '○'} Passwords match</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-600 font-medium select-none">
                  <input
                    type="checkbox"
                    required
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <span>
                    I agree to the <span className="text-blue-600 font-bold">RailControl Travel Terms & Conditions</span> and <span className="text-blue-600 font-bold">Privacy Policy</span>.
                  </span>
                </label>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={formLoading}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white min-h-[48px] py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {formLoading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600 font-medium">
              <span>Already have an account? </span>
              <Link to="/passenger/login" className="font-extrabold text-blue-600 hover:text-blue-700 hover:underline ml-1">
                Sign In
              </Link>
            </div>

          </div>

        </div>
      </main>

      {/* FOOTER (WHITE BACKGROUND) */}
      <footer className="w-full bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[11px] text-slate-500 font-medium">
        <span>© {new Date().getFullYear()} RailControl Passenger Services. All rights reserved.</span>
      </footer>

    </div>
  );
};

export default PassengerRegister;
