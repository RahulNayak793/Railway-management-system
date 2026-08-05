import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Shield, 
  Briefcase, 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  ArrowRight, 
  Zap, 
  Headphones, 
  Clock, 
  Train, 
  Smartphone, 
  ShieldCheck,
  Phone,
  RefreshCw,
  Info
} from 'lucide-react';

// CAPTCHA helper
const generateCaptcha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Multilingual texts
const locales = {
  en: {
    welcome: "Welcome Back",
    welcomeSub: "Sign in to continue to RailControl",
    passenger: "Passenger",
    staff: "Staff",
    admin: "Admin",
    email: "Email Address",
    password: "Password",
    rememberMe: "Remember Me",
    forgotPassword: "Forgot Password?",
    loginAs: "Login as",
    signUp: "Sign Up",
    signIn: "Sign In",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    registerAs: "Register as",
    welcomeAboard: "Welcome Aboard",
    welcomeAboardSub: "Sign up to create your RailControl account",
    secure: "Secure",
    secureSub: "Your data is always protected",
    fastAccess: "Fast Access",
    fastAccessSub: "Quick & easy authentication",
    support: "Support",
    supportSub: "We're here to help you 24/7",
    enterCaptcha: "Enter Verification Code",
    captchaPlaceholder: "Enter CAPTCHA",
    advisoryTitle: "⚠️ SECURITY ADVISORY",
    advisoryText: "Never share your OTP or Password. RailControl staff never asks for login credentials. Report security concerns to helpline 139.",
    tickerText: "📢 LATEST UPDATE: Special summer trains running between New Delhi (NDLS) and Mumbai Central (MMCT). Please verify schedules. | Avoid sharing OTPs. RailControl will never ask for your password. | E-Ticketing and support services are available 24/7.",
    emergencyHelpline: "Emergency Helpline: 139",
    selectLang: "Select Language",
    fullName: "Full Name",
    phone: "Phone Number",
    resetPassword: "Reset Password",
    resetSub: "Enter your details to restore your workspace access",
    sendRecovery: "Send Recovery Link",
    backSignIn: "Back to Sign In"
  },
  hi: {
    welcome: "स्वागत है",
    welcomeSub: "रेलकंट्रोल पर जारी रखने के लिए लॉगिन करें",
    passenger: "यात्री",
    staff: "कर्मचारी",
    admin: "प्रशासक",
    email: "ईमेल पता",
    password: "पासवर्ड",
    rememberMe: "मुझे याद रखें",
    forgotPassword: "पासवर्ड भूल गए?",
    loginAs: "लॉगिन करें",
    signUp: "पंजीकरण करें",
    signIn: "लॉगिन करें",
    dontHaveAccount: "खाता नहीं है?",
    alreadyHaveAccount: "पहले से खाता है?",
    registerAs: "रजिस्टर करें",
    welcomeAboard: "स्वागत है",
    welcomeAboardSub: "रेलकंट्रोल पर अपना खाता बनाएं",
    secure: "सुरक्षित",
    secureSub: "आपका डेटा हमेशा सुरक्षित है",
    fastAccess: "त्वरित पहुँच",
    fastAccessSub: "आसान और सुरक्षित लॉगिन",
    support: "सहायता",
    supportSub: "24/7 आपातकालीन सहायता",
    enterCaptcha: "सत्यापन कोड दर्ज करें",
    captchaPlaceholder: "कैप्चा दर्ज करें",
    advisoryTitle: "⚠️ सुरक्षा चेतावनी",
    advisoryText: "अपना ओटीपी या पासवर्ड किसी से साझा न करें। रेलकंट्रोल कर्मचारी कभी क्रेडेंशियल नहीं मांगते।",
    tickerText: "📢 नवीनतम अपडेट: नई दिल्ली (NDLS) और मुंबई सेंट्रल (MMCT) के बीच विशेष ग्रीष्मकालीन ट्रेनें। कृपया समय सारिणी सत्यापित करें। | पासवर्ड साझा करने से बचें। | ई-टिकटिंग सेवाएं 24/7 उपलब्ध हैं।",
    emergencyHelpline: "आपातकालीन हेल्पलाइन: 139",
    selectLang: "भाषा चुनें",
    fullName: "पूरा नाम",
    phone: "फ़ोन नंबर",
    resetPassword: "पासवर्ड रीसेट",
    resetSub: "अपना क्रेडेंशियल पुनर्स्थापित करने के लिए विवरण दर्ज करें",
    sendRecovery: "रिकवरी लिंक भेजें",
    backSignIn: "लॉगिन पर वापस जाएं"
  }
};

const Login = () => {
  const { login, signup, error, setError } = useAuth();
  const navigate = useNavigate();

  const [lang, setLang] = useState('en'); // 'en' | 'hi'
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('passenger'); // 'passenger' | 'staff' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Captcha States
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');

  const t = locales[lang] || locales.en;

  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptcha());
    setCaptchaInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (isSignUp && role === 'staff') {
      setError(lang === 'hi' ? 'कर्मचारी खाते स्वयं-पंजीकृत नहीं किए जा सकते। कृपया व्यवस्थापक से संपर्क करें।' : 'Staff accounts cannot be self-registered. Please contact the administrator.');
      setFormLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const user = await signup({
          email: cleanEmail,
          password,
          full_name: fullName,
          role,
          phone
        });
        redirectUser(user.role);
      } else {
        const user = await login(cleanEmail, password);
        redirectUser(user.role);
      }
    } catch (err) {
      console.error(err);
      refreshCaptcha();
    } finally {
      setFormLoading(false);
    }
  };

  const redirectUser = (userRole) => {
    if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'staff') {
      navigate('/staff');
    } else {
      navigate('/passenger');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess('');
    try {
      setForgotSuccess(lang === 'hi' ? 'पासवर्ड पुनर्प्राप्ति लिंक आपके ईमेल पर भेज दिया गया है।' : 'A recovery access pin link has been dispatched.');
    } catch (err) {
      setError(lang === 'hi' ? 'लिंक भेजने में विफल।' : 'Failed to send reset link.');
    }
  };

  const loadDemoCredentials = () => {
    const demoEmail = role === 'admin' 
      ? 'admin@railway.com' 
      : role === 'staff' 
        ? 'staff@railway.com' 
        : 'passenger@railway.com';
    setEmail(demoEmail);
    setPassword('password');
    // Auto-fill Captcha for developer convenience
    setCaptchaInput(captchaCode);
  };

  const handleOTPStub = () => {
    alert(lang === 'hi' ? 'सैंडबॉक्स मोड: कृपया क्रेडेंशियल का उपयोग करें।' : 'OTP authorization stub active. Use Demo Credentials / Google option for Sandbox login.');
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f4f7fa] font-sans antialiased overflow-x-hidden">
      
      {/* 1. TOP RAILWAY ALERT MARQUEE STRIP */}
      <div className="w-full bg-[#1e293b] text-yellow-400 py-1.5 px-2 border-b border-yellow-500/20 text-xs tracking-wide flex items-center shrink-0 select-none">
        <div className="bg-red-600 text-white font-bold px-2 sm:px-3 py-0.5 mx-2 sm:mx-3 rounded text-[9px] sm:text-[10px] uppercase shrink-0 animate-pulse">
          Alert
        </div>
        <marquee scrollamount="4" className="font-medium text-[11px] sm:text-xs">
          {t.tickerText}
        </marquee>
      </div>

      {/* 2. TOP NAV HEADER */}
      <header className="w-full bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center shadow-sm z-20 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          <Train className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
          <div>
            <span className="font-extrabold text-slate-800 text-base sm:text-lg leading-none">Rail<span className="text-blue-600">Control</span></span>
            <span className="hidden sm:inline-block border-l border-slate-300 ml-3 pl-3 text-xs font-semibold text-slate-500">
              National Railway Portal
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Emergency helpline badge */}
          <div className="hidden md:flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>📞 {t.emergencyHelpline}</span>
          </div>

          {/* Interactive Language Selector Toggle */}
          <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setLang('en')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all ${
                lang === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang('hi')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all ${
                lang === 'hi' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </header>

      {/* 3. MAIN WORKSPACE VIEWPORT */}
      <div className="flex-grow flex">
        
        {/* LEFT SIDE PANEL (Sidebar with train image) - Visible on lg and above */}
        <div className="hidden lg:flex lg:w-[38%] xl:w-[35%] flex-col bg-gradient-to-b from-[#091b33] via-[#0d2a4a] to-[#0e3c6b] text-white p-12 relative overflow-hidden shrink-0 shadow-2xl">
          
          {/* Subtle background glow */}
          <div className="absolute top-[-20%] right-[-20%] w-96 h-96 rounded-full bg-blue-500/10 blur-[80px]" />
          
          {/* Top Branding / Description */}
          <div className="relative z-10 flex items-center space-x-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/30 backdrop-blur-md border border-white/10 shadow-lg">
              <Train className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">RailControl</h1>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">National Railway Authority of India</span>
            </div>
          </div>

          {/* Center Welcome Text, List & Advisory packed together */}
          <div className="relative z-10 space-y-7 mb-8">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Safe. Smart. Seamless.</span>
              <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4">
                Railway <br />Management
              </h2>
              <p className="text-sm text-slate-300 font-medium">Your journey. Our responsibility.</p>
              <div className="w-16 h-1 bg-blue-500 rounded-full mt-6" />
            </div>

            {/* List items */}
            <ul className="space-y-5">
              <li className="flex items-start space-x-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <ShieldCheck className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Secure Access</h4>
                  <p className="text-xs text-slate-400">Advanced security for all user accounts</p>
                </div>
              </li>
              <li className="flex items-start space-x-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Role Based</h4>
                  <p className="text-xs text-slate-400">Access tailored for Passengers & Staff</p>
                </div>
              </li>
              <li className="flex items-start space-x-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">24x7 Availability</h4>
                  <p className="text-xs text-slate-400">Access services anytime, anywhere</p>
                </div>
              </li>
            </ul>

            {/* Advisory banner card */}
            <div className="bg-slate-900/50 border border-slate-700/40 p-4 rounded-xl backdrop-blur-sm">
              <span className="text-xs font-bold text-amber-400 tracking-wider flex items-center mb-1.5">
                <Info className="h-4 w-4 mr-1.5 shrink-0" />
                {t.advisoryTitle}
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                {t.advisoryText}
              </p>
            </div>
          </div>

          {/* Bottom Train Image Container - Fills all remaining blank space */}
          <div className="relative flex-1 -mx-12 -mb-12 mt-6 overflow-hidden rounded-t-[32px] min-h-[220px] z-10">
            {/* Top fade gradient to blend with the sidebar background */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0d2a4a] to-transparent z-10" />
            <img 
              src="/train.png" 
              alt="Modern Indian Train" 
              className="absolute inset-0 w-full h-full object-cover select-none opacity-90 hover:scale-105 transition-transform duration-700" 
            />
          </div>
        </div>

        {/* RIGHT SIDE MAIN CONTENT (Forms & Details) */}
        <div className="flex-1 flex flex-col justify-center items-center py-4 sm:py-8 px-3 sm:px-6 lg:px-8 overflow-y-auto w-full min-h-0">
          
          {/* Auth Panel Card */}
          <div className="w-full max-w-[440px] sm:max-w-[480px] bg-white rounded-2xl sm:rounded-[32px] p-5 sm:p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-100/80 my-2 sm:my-auto">
            
            {/* Header Area */}
            <div className="text-center mb-5 sm:mb-8">
              <div className="mx-auto flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3 sm:mb-4 shadow-inner">
                <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              {showForgotPassword ? (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{t.resetPassword}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{t.resetSub}</p>
                </>
              ) : (
                <>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{isSignUp ? t.welcomeAboard : t.welcome}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {isSignUp ? t.welcomeAboardSub : t.welcomeSub}
                  </p>
                </>
              )}
            </div>

            {/* Toggle Tab header for login vs signup (Only show when not in forgot password mode) */}
            {!showForgotPassword && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
                {[
                  { id: 'passenger', label: t.passenger, icon: User },
                  { id: 'staff', label: t.staff, icon: Briefcase }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = role === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setRole(item.id);
                        setError(null);
                        if (item.id === 'staff') {
                          setIsSignUp(false);
                        }
                      }}
                      className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? 'border-white bg-white text-blue-600 font-bold shadow-md shadow-slate-200'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/40'
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Display Notification Messages */}
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-xs text-red-600 mb-6 font-medium animate-shake">
                {error}
              </div>
            )}
            {forgotSuccess && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs text-emerald-600 mb-6 font-medium">
                {forgotSuccess}
              </div>
            )}

            {/* Views Selector */}
            {showForgotPassword ? (
              /* Forgot Password Form */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 pl-1">{t.email}</label>
                  <div className="relative rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                    <Mail className="text-slate-400 absolute left-3 top-3.5 h-5 w-5" />
                    <input
                      type="email"
                      required
                      placeholder="Enter registered email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-transparent pl-11 pr-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
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
                    className="w-1/2 rounded-xl border border-slate-200 bg-white py-3.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    {t.backSignIn}
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3.5 text-xs font-bold active:scale-[0.98] transition shadow-lg shadow-blue-500/10"
                  >
                    {t.sendRecovery}
                  </button>
                </div>
              </form>
            ) : (
              /* Sign In / Sign Up Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Full Name & Phone - Register Mode Only */}
                {isSignUp && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 pl-1">{t.fullName}</label>
                        <div className="relative rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                          <User className="text-slate-400 absolute left-3 top-3.5 h-5 w-5" />
                          <input
                            type="text"
                            required
                            placeholder="Full Name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-transparent pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 pl-1">{t.phone}</label>
                        <div className="relative rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                          <Phone className="text-slate-400 absolute left-3 top-3.5 h-5 w-5" />
                          <input
                            type="tel"
                            required
                            placeholder="Phone Number"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-transparent pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Email Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 pl-1">{t.email}</label>
                  <div className="relative rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                    <Mail className="text-slate-400 absolute left-3 top-3.5 h-5 w-5" />
                    <input
                      type="email"
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      inputMode="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent pl-11 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex justify-between items-center mb-2 pl-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">{t.password}</label>
                  </div>
                  <div className="relative rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                    <Lock className="text-slate-400 absolute left-3 top-3.5 h-5 w-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent pl-11 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Remember me & Forgot Password */}
                {!isSignUp && (
                  <div className="flex justify-between items-center pt-1">
                    <label className="flex items-center space-x-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" 
                      />
                      <span>{t.rememberMe}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError(null);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                )}

                {/* Main Submit Button */}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>{formLoading ? 'Connecting...' : isSignUp ? `${t.registerAs} ${role}` : `${t.loginAs} ${role}`}</span>
                  {!formLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            )}

            {/* Social login divider (Only show when not resetting password) */}
            {!showForgotPassword && (
              <>
                <div className="relative flex items-center justify-center my-6">
                  <div className="w-full border-t border-slate-100"></div>
                  <span className="relative bg-white px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    OR CONTINUE WITH
                  </span>
                  <div className="w-full border-t border-slate-100"></div>
                </div>

                {/* Google and OTP Auth */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={loadDemoCredentials}
                    className="flex items-center justify-center py-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] text-slate-600 text-sm font-bold transition-all shadow-sm"
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Google</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleOTPStub}
                    className="flex items-center justify-center py-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] text-slate-600 text-sm font-bold transition-all shadow-sm"
                  >
                    <Smartphone className="h-5 w-5 mr-2 text-slate-400" />
                    <span>OTP</span>
                  </button>
                </div>

                {/* Bottom login/register toggle */}
                {role !== 'staff' && (
                  <div className="mt-8 text-center text-sm text-slate-500">
                    <span>{isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                      }}
                      className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-1.5 focus:outline-none"
                    >
                      {isSignUp ? t.signIn : t.signUp}
                    </button>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Feature badges below Card */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-[440px] sm:max-w-[480px] w-full text-center mt-3 mb-4 bg-white/60 backdrop-blur-sm p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100/80">
            <div>
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mx-auto mb-1" />
              <h4 className="text-[11px] sm:text-xs font-bold text-slate-800">{t.secure}</h4>
              <p className="hidden sm:block text-[10px] text-slate-400 leading-tight">{t.secureSub}</p>
            </div>
            <div>
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mx-auto mb-1" />
              <h4 className="text-[11px] sm:text-xs font-bold text-slate-800">{t.fastAccess}</h4>
              <p className="hidden sm:block text-[10px] text-slate-400 leading-tight">{t.fastAccessSub}</p>
            </div>
            <div>
              <Headphones className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mx-auto mb-1" />
              <h4 className="text-[11px] sm:text-xs font-bold text-slate-800">{t.support}</h4>
              <p className="hidden sm:block text-[10px] text-slate-400 leading-tight">{t.supportSub}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] sm:text-[11px] text-slate-400 space-y-1">
            <p>© 2026 National Railway Authority of India. All rights reserved.</p>
            <div className="flex justify-center space-x-2 sm:space-x-3">
              <a href="#" className="hover:text-slate-600 hover:underline">Privacy Policy</a>
              <span>|</span>
              <a href="#" className="hover:text-slate-600 hover:underline">Terms of Service</a>
              <span>|</span>
              <a href="#" className="hover:text-slate-600 hover:underline">Help Desk</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
