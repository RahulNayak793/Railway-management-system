import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Shield, Lock, Mail, Phone, ArrowRight, ShieldCheck, 
  CheckCircle, RefreshCw, Eye, EyeOff, FileText, Sparkles, Award, CreditCard
} from 'lucide-react';

const generateCaptcha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const Register = () => {
  const { signup, error, setError } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [docType, setDocType] = useState('Aadhaar Card');
  const [docNumber, setDocNumber] = useState('');
  const [concessionCategory, setConcessionCategory] = useState('General');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Captcha
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');

  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptcha());
    setCaptchaInput('');
  };

  // Password strength logic
  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-200', text: 'text-slate-400' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score === 1) return { score: 25, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-500' };
    if (score === 2) return { score: 50, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-500' };
    if (score === 3) return { score: 75, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
    return { score: 100, label: 'Ultra-Secure 🛡️', color: 'bg-cyan-400', text: 'text-cyan-400' };
  };

  const strength = getPasswordStrength();
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your entries.');
      return;
    }

    if (captchaInput.trim() !== captchaCode) {
      setError('Invalid CAPTCHA code. Please re-enter the verification code.');
      refreshCaptcha();
      return;
    }

    if (!agreeTerms) {
      setError('You must accept the IRCTC Travel Terms & Conditions to register.');
      return;
    }

    setFormLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const user = await signup({
        email: cleanEmail,
        password,
        full_name: fullName,
        role: 'passenger',
        phone
      });
      alert('🎉 Registration Successful! Welcome to RailControl Management System.');
      navigate('/passenger');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information.');
      refreshCaptcha();
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-5xl bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Side: Branding & Info Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 p-8 text-white flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          <div className="space-y-6 z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span>Verified Passenger Portal</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Create Your RailControl Account</h1>
              <p className="text-xs text-slate-300 font-medium mt-2 leading-relaxed">
                Enjoy priority Tatkal booking access, 7-Day budget fare alerts, e-catering pantry orders, and instant refund processing.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              {[
                { icon: ShieldCheck, title: 'Identity Verified KYC', desc: 'Secure encryption for Aadhaar & Passport linked tickets' },
                { icon: Award, title: 'Railway Miles VIP Loyalty', desc: 'Earn miles on every journey for Executive Lounge passes' },
                { icon: CreditCard, title: 'Instant Refund Engine', desc: 'Auto-refund processing within 24 hours of ticket cancellation' }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start space-x-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{item.title}</h4>
                      <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 z-10 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Already registered?</span>
            <Link to="/login" className="text-cyan-400 font-bold hover:underline flex items-center space-x-1">
              <span>Sign In to Account</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Side: Registration Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 md:p-10 space-y-5 overflow-y-auto max-h-[85vh]">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Passenger Sign Up Registration</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Please provide your legal identity details as on official travel ID.</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Full Name</label>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500 transition">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Rahul Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-3 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Mobile Phone Number</label>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500 transition">
                  <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-3 py-3 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Email Address</label>
              <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500 transition">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="rahul.kumar@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent pl-10 pr-3 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* KYC Identity Verification Section */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Identity Document (KYC) & Concession</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">ID Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Document Number</label>
                  <input
                    type="text"
                    placeholder="12-digit / Alphanumeric ID"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Concession Category</label>
                  <select
                    value={concessionCategory}
                    onChange={(e) => setConcessionCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="General">General Quota</option>
                    <option value="Senior Citizen">Senior Citizen</option>
                    <option value="Student">Student Concession</option>
                    <option value="Divyangjan">Divyangjan / Differently Abled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Password</label>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500 transition">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-9 py-3 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-1.5 space-y-1">
                    <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${strength.score}%` }}></div>
                    </div>
                    <span className={`text-[9px] font-bold ${strength.text}`}>Strength: {strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">Confirm Password</label>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500 transition">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-3 py-3 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                {confirmPassword && (
                  <span className={`text-[9px] font-bold mt-1 block ${passwordsMatch ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {passwordsMatch ? '✓ Passwords match' : '❌ Passwords do not match'}
                  </span>
                )}
              </div>
            </div>

            {/* CAPTCHA Code Box */}
            <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-2 bg-slate-900 text-cyan-400 px-4 py-2 rounded-xl font-mono text-sm font-black tracking-widest select-none shadow">
                <span>{captchaCode}</span>
                <button type="button" onClick={refreshCaptcha} className="text-slate-400 hover:text-white">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Enter CAPTCHA"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Terms Agreement Checkbox */}
            <label className="flex items-start space-x-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
              />
              <span>
                I agree to the <strong>IRCTC Railway Booking Regulations</strong>, Travel Insurance policy, and Privacy Terms.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-600/20 transition active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{formLoading ? 'Creating Account...' : 'Complete Passenger Registration'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Register;
