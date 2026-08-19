import React, { useState } from 'react';
import { X, ArrowLeft, Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

const generateCaptcha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const CreateIrctcModal = ({ isOpen, onClose, onSuccess }) => {
  const [userName, setUserName] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [captchaCode, setCaptchaCode] = useState(generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  if (!isOpen) return null;

  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptcha());
    setCaptchaInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!userName.trim()) {
      setError('User Name is required.');
      return;
    }
    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    if (!email.trim()) {
      setEmailTouched(true);
      setError('Email is required.');
      return;
    }
    if (!mobile.trim() || mobile.length < 10) {
      setError('Valid 10-digit Mobile Number is required.');
      return;
    }
    if (captchaInput.trim().toLowerCase() !== captchaCode.toLowerCase()) {
      setError('Invalid CAPTCHA code. Please enter the code correctly.');
      refreshCaptcha();
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const createdId = userName.trim().toLowerCase();
      localStorage.setItem('saved_irctc_id', createdId);
      if (onSuccess) {
        onSuccess(createdId);
      }
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden my-8 animate-scale-in">
        
        {/* Top Header Bar */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-slate-800 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-black tracking-wide">Create IRCTC Account</h2>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 transition text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {/* Main Title Row */}
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-black text-slate-800">Create Your IRCTC account</h3>
          </div>

          {/* Guidelines Callout Box */}
          <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-2 text-[11px] text-slate-700 font-medium leading-relaxed">
            <p>1. Garbage / Junk values in profile may lead to deactivation of IRCTC account.</p>
            <p>2. Opening Advance Reservation Period (ARP) ticket and Tatkal ticket booking for unauthenticated users is allowed only after Aadhaar profile authentication.</p>
          </div>

          {/* Alert Message if any */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center space-x-2 text-xs font-bold text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* User Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">User Name</label>
              <input
                type="text"
                placeholder="Enter User Name (e.g. shiva_irctc)"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                required
              />
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                placeholder="Enter Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Email Info Banner */}
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-[11px] font-medium text-sky-800">
              Invalid email ID may lead to deactivation of IRCTC account.
            </div>

            {/* Email Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Email</label>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onBlur={() => setEmailTouched(true)}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border ${
                  emailTouched && !email ? 'border-red-500 bg-red-50/20' : 'border-slate-200 bg-white'
                } px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10`}
                required
              />
              {emailTouched && !email && (
                <div className="rounded-md bg-red-50 border border-red-200 p-1.5 text-[10px] font-bold text-red-600 flex items-center space-x-1.5 w-fit">
                  <AlertCircle className="h-3 w-3" />
                  <span>Email is required.</span>
                </div>
              )}
            </div>


            {/* Mobile Info Banner */}
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-[11px] font-medium text-sky-800">
              Please submit Mobile Number without ISD Code
            </div>

            {/* Mobile Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Mobile</label>
              <input
                type="text"
                placeholder="10-digit Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                required
              />
            </div>

            {/* CAPTCHA Box */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Verification CAPTCHA</label>
              <div className="flex items-center space-x-3">
                <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-white font-mono text-lg font-black tracking-widest flex items-center justify-between flex-1 select-none">
                  <span>t={captchaCode}</span>
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Enter Captcha"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none"
                required
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black text-sm tracking-wide shadow-lg shadow-orange-500/20 transition disabled:opacity-50"
              >
                {submitting ? 'Creating Account...' : 'Submit'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateIrctcModal;
