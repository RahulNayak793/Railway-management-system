import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldAlert, ArrowRight, ShieldCheck, Train, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const CateringLogin = () => {
  const navigate = useNavigate();
  const { cateringLogin, user, cateringUser } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already authenticated as catering company, redirect to portal
  useEffect(() => {
    const activeCatering = cateringUser || (user?.role === 'CATERING_COMPANY' ? user : null);
    if (activeCatering) {
      navigate('/catering/company', { replace: true });
    }
  }, [cateringUser, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please provide your authorized partner email and password.');
      return;
    }

    setLoading(true);
    try {
      const loggedIn = await cateringLogin(cleanEmail, password);
      showToast(`Welcome back, ${loggedIn?.company_name || 'Catering Partner'}!`, 'success');
      navigate('/catering/company', { replace: true });
    } catch (err) {
      const msg = err.message || 'Authentication failed. Please verify credentials.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Official Government/Railway Header */}
      <header className="bg-[#0B2545] text-white border-b border-[#07192F] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#0B2545] border-2 border-amber-400 flex items-center justify-center shadow-xs shrink-0">
              <Train className="h-5 w-5 stroke-[2.2] text-[#0B2545]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white uppercase">RailControl</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                  AUTHORIZED
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-200 uppercase tracking-wider leading-tight">
                Catering Partner Portal
              </p>
              <p className="text-[9px] text-blue-200 font-medium leading-none">
                Indian Railways Catering Operations
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block text-xs text-blue-200">
            <span className="block font-semibold text-white">IRCTC Catering Administration</span>
            <span className="text-[10px] text-blue-300">Contractor Operating Terminal</span>
          </div>
        </div>

        {/* Thin Secondary Railway Strip */}
        <div className="bg-[#E8EEF5] text-slate-700 text-[11px] px-4 sm:px-6 py-1 border-t border-b border-[#CFD9E5]">
          <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="font-semibold text-slate-800">
                Authorized Catering Partner • Railway Catering Operations
              </span>
            </div>
            <div className="text-slate-600 font-mono text-[10px]">
              Security Zone: Production • Catering Contractor Gateway
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          {/* Card Container */}
          <div className="bg-white border border-[#D9E1EA] rounded-lg shadow-sm p-6 sm:p-8 space-y-5">
            {/* Header inside form */}
            <div className="text-center pb-4 border-b border-slate-200 space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-900 border border-blue-200 mb-2">
                <ShieldCheck className="h-6 w-6 text-[#00529B]" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Catering Partner Login
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Authorized contractor operations & pantry station gateway
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-900">
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <strong className="block font-bold text-red-800">Authorization Rejected</strong>
                  <span>{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Authorized Registered Email *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="catering-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pantry@irctc.co.in"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Must match the company email registered in Railway Administration records.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contractor Password *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="catering-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#00529B] hover:bg-[#003E75] text-white font-bold text-xs uppercase tracking-wider rounded-md shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Partner Authorization...</span>
                  </div>
                ) : (
                  <>
                    <span>Login to Catering Portal</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Official Statutory / Security Notice */}
            <div className="pt-3 border-t border-slate-200 text-center space-y-1.5">
              <div className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-bold">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
                <span>Indian Railways Security Compliance</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                "Only Railway-authorized catering companies can access this portal. Unauthorized access to Railway Information Systems is strictly prohibited."
              </p>
            </div>
          </div>

          {/* Demonstration Credentials Info Box */}
          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-md text-xs text-blue-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <HelpCircle className="h-3.5 w-3.5 text-blue-700" />
              <span>Demonstration Catering Partner Access</span>
            </div>
            <p className="text-[11px] text-slate-700">
              Registered Email: <span className="font-mono font-bold text-blue-900">pantry@irctc.co.in</span>
            </p>
            <p className="text-[11px] text-slate-700">
              Password: <span className="font-mono font-bold text-blue-900">Catering@123</span>
            </p>
          </div>
        </div>
      </main>

      {/* Official Government Footer */}
      <footer className="bg-white border-t border-[#D9E1EA] py-3 text-center text-slate-500 text-[11px]">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2025–2026 RailControl Catering Operations • Indian Railway Catering & Tourism Corporation (IRCTC)</p>
        </div>
      </footer>
    </div>
  );
};

export default CateringLogin;
