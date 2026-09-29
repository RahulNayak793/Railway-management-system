import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, AlertCircle, UserCheck, UserPlus, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const CreateIrctcModal = ({ isOpen, onClose, onSuccess, currentIrctcId = '' }) => {
  const { user } = useAuth() || {};
  const [hasAccount, setHasAccount] = useState('no'); // 'no' (Create New) or 'yes' (Link Existing)
  
  // Create New Account form fields
  const [newUsername, setNewUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [securityPin, setSecurityPin] = useState('123456');

  // Existing Account form field
  const [existingIrctcId, setExistingIrctcId] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const generateRandomIrctcId = () => {
    const namePrefix = user?.full_name 
      ? user.full_name.trim().split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase() 
      : 'RAIL';
    const randNum = Math.floor(10000 + Math.random() * 90000);
    return `IRCTC_${namePrefix}_${randNum}`;
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      const saved = currentIrctcId || localStorage.getItem('saved_irctc_id') || '';
      if (saved) {
        setHasAccount('yes');
        setExistingIrctcId(saved);
      } else {
        setHasAccount('no');
        setExistingIrctcId('');
      }

      setFullName(user?.full_name || '');
      setPhone(user?.phone || '');
      setEmail(user?.email || '');
      setNewUsername(generateRandomIrctcId());
    }
  }, [isOpen, currentIrctcId, user]);

  if (!isOpen) return null;

  const handleCreateNew = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanId = newUsername.trim();
    if (!cleanId) {
      setError('Please provide a valid IRCTC Username / User ID.');
      return;
    }

    if (cleanId.length < 4) {
      setError('IRCTC User ID must be at least 4 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put('/auth/irctc-id', { irctc_user_id: cleanId });
      const savedUser = res.data?.user;
      const finalId = savedUser?.irctc_user_id || savedUser?.irctc_id || cleanId;

      localStorage.setItem('saved_irctc_id', finalId);
      setSuccessMsg(`New IRCTC Account (${finalId}) created & linked successfully!`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(finalId);
        }
        onClose();
      }, 750);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to create IRCTC Account.';
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkExisting = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanId = existingIrctcId.trim();
    if (!cleanId) {
      setError('Please enter a valid IRCTC User ID.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put('/auth/irctc-id', { irctc_user_id: cleanId });
      const savedUser = res.data?.user;
      const finalId = savedUser?.irctc_user_id || savedUser?.irctc_id || cleanId;

      localStorage.setItem('saved_irctc_id', finalId);
      setSuccessMsg(`IRCTC User ID (${finalId}) linked successfully!`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(finalId);
        }
        onClose();
      }, 750);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to link IRCTC User ID.';
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
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
              className="p-1 rounded-full hover:bg-slate-800 transition text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-black tracking-wide">IRCTC Account Identity</h2>
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
          
          {/* Section Header */}
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-black text-slate-800">
              {hasAccount === 'no' ? 'Create New IRCTC Account' : 'Link Existing IRCTC Account'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Create a new IRCTC User ID instantly or link your existing account for seamless ticket booking.
            </p>
          </div>

          {/* Mode Switch Radio Cards */}
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-2">
              Select IRCTC Account Option
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              <label 
                className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border cursor-pointer transition ${
                  hasAccount === 'no' 
                    ? 'border-orange-500 bg-orange-50 text-slate-900 font-extrabold shadow-sm' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <input
                  type="radio"
                  name="irctcAccountChoice"
                  value="no"
                  checked={hasAccount === 'no'}
                  onChange={() => { setHasAccount('no'); setError(''); setSuccessMsg(''); }}
                  className="sr-only"
                />
                <UserPlus className={`h-5 w-5 mb-1 ${hasAccount === 'no' ? 'text-orange-600' : 'text-slate-400'}`} />
                <span className="text-xs">Create New IRCTC Account</span>
              </label>

              <label 
                className={`flex flex-col items-center justify-center text-center p-3 rounded-xl border cursor-pointer transition ${
                  hasAccount === 'yes' 
                    ? 'border-orange-500 bg-orange-50 text-slate-900 font-extrabold shadow-sm' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <input
                  type="radio"
                  name="irctcAccountChoice"
                  value="yes"
                  checked={hasAccount === 'yes'}
                  onChange={() => { setHasAccount('yes'); setError(''); setSuccessMsg(''); }}
                  className="sr-only"
                />
                <UserCheck className={`h-5 w-5 mb-1 ${hasAccount === 'yes' ? 'text-orange-600' : 'text-slate-400'}`} />
                <span className="text-xs">I Have Existing IRCTC ID</span>
              </label>
            </div>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center space-x-2.5 text-xs font-bold text-emerald-700 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start space-x-2.5 text-xs font-bold text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* FORM 1: CREATE NEW IRCTC ACCOUNT */}
          {hasAccount === 'no' && (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center justify-between">
                  <span>New IRCTC User ID / Username</span>
                  <button
                    type="button"
                    onClick={() => setNewUsername(generateRandomIrctcId())}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Auto Generate</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. IRCTC_RAHUL_9824"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  This will be your unique IRCTC User ID assigned to your profile.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Passenger Name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Mobile / Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Security PIN
                  </label>
                  <input
                    type="password"
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value)}
                    placeholder="6-digit PIN"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 font-medium flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Your IRCTC account will be generated and instantly linked to your booking profile.
                </span>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !!successMsg}
                  className="w-2/3 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs tracking-wide shadow-lg shadow-orange-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{submitting ? 'Creating IRCTC Account...' : 'Create & Link IRCTC Account'}</span>
                </button>
              </div>
            </form>
          )}

          {/* FORM 2: LINK EXISTING IRCTC ACCOUNT */}
          {hasAccount === 'yes' && (
            <form onSubmit={handleLinkExisting} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center justify-between">
                  <span>IRCTC User ID</span>
                  <span className="text-[10px] font-semibold text-orange-600 lowercase">(1 Passenger = 1 Unique ID)</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your existing IRCTC User ID"
                  value={existingIrctcId}
                  onChange={(e) => setExistingIrctcId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Enter your registered IRCTC User ID. Each passenger must use their unique ID.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 font-medium flex items-center space-x-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>
                  We will save this IRCTC User ID to your passenger profile for booking verification.
                </span>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !!successMsg}
                  className="w-2/3 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs tracking-wide shadow-lg shadow-orange-500/20 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{submitting ? 'Linking IRCTC ID...' : 'Link IRCTC User ID'}</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default CreateIrctcModal;

