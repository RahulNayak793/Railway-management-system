import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  ArrowRightLeft, 
  Ticket, 
  BookOpen, 
  Clock, 
  XCircle, 
  CreditCard, 
  User, 
  Bell, 
  HelpCircle, 
  Info, 
  Sparkles, 
  ChevronRight, 
  AlertTriangle, 
  Volume2,
  Percent,
  Star,
  FileText,
  Compass,
  ShieldCheck,
  Tag,
  X,
  CheckCircle2,
  Copy,
  Utensils
} from 'lucide-react';
import api from '../services/api';
import { indianStations } from '../utils/stationsData';
import TrainSearchForm from '../components/TrainSearchForm';
import StationMapModal from '../components/StationMapModal';
import EcoImpactWidget from '../components/EcoImpactWidget';

const PassengerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [source, setSource] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [destination, setDestination] = useState('');
  const [destCode, setDestCode] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [passengerCount, setPassengerCount] = useState('1');
  const [quota, setQuota] = useState('GN');
  const [pnrInput, setPnrInput] = useState('');
  const [activeTab, setActiveTab] = useState('book'); // 'book' or 'search'
  const [isSwapping, setIsSwapping] = useState(false);

  // Auto-complete & stations state
  const [stations, setStations] = useState([]);
  const [showSourceList, setShowSourceList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);

  // Dashboard bookings & modal state
  const [bookings, setBookings] = useState([]);
  const [upcomingJourney, setUpcomingJourney] = useState(null);
  const [companions, setCompanions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [showStationMap, setShowStationMap] = useState(false);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [showLoungePassModal, setShowLoungePassModal] = useState(false);

  const [announcementsList, setAnnouncementsList] = useState(() => {
    const saved = localStorage.getItem('railway_announcements');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(a => a.active !== false);
      } catch (e) {}
    }
    return [
      { id: 1, text: 'Platform Change: Train 12952 Mumbai Rajdhani Express will arrive on Platform 1.', date: 'Just now', author: 'Station Dispatch', active: true },
      { id: 2, text: 'IRCTC Advisory: TATKAL reservation counters open daily at 10:00 AM for AC classes.', date: 'Today', author: 'Station Admin', active: true },
      { id: 3, text: 'यात्री ध्यान दें: गाड़ी संख्या 12952 मुम्बई राजधानी एक्सप्रेस प्लेटफार्म नंबर 1 पर आ रही है।', date: 'Today', author: 'Hindi Broadcaster', active: true }
    ];
  });

  const [liveAnnouncements, setLiveAnnouncements] = useState(() => {
    return announcementsList.map(a => a.text).join(' • ');
  });

  const [playingAudioId, setPlayingAudioId] = useState(null);

  const speakAnnouncement = (item) => {
    if (!('speechSynthesis' in window)) {
      alert('Audio PA Broadcaster is not supported on this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    if (playingAudioId === item.id) {
      setPlayingAudioId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onstart = () => setPlayingAudioId(item.id);
    utterance.onend = () => setPlayingAudioId(null);
    utterance.onerror = () => setPlayingAudioId(null);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const syncAnnouncements = () => {
      const saved = localStorage.getItem('railway_announcements');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const activeList = parsed.filter(a => a.active !== false);
            setAnnouncementsList(activeList);
            setLiveAnnouncements(activeList.map(a => a.text).join(' • '));
          }
        } catch (e) {}
      }
    };

    window.addEventListener('announcement_updated', syncAnnouncements);
    return () => window.removeEventListener('announcement_updated', syncAnnouncements);
  }, []);

  useEffect(() => {
    const fetchDashboardInfo = async () => {
      if (!user) return;
      setLoadingData(true);
      const stationsMock = indianStations.map((st, idx) => {
        const rawCode = (st.code || '').toUpperCase();
        const code = (rawCode === 'UDU' || rawCode === 'UDUPI') ? 'UD' : rawCode;
        return {
          id: `st-mock-${idx}`,
          station_name: (code === 'UD' || rawCode === 'UDU') ? 'Udupi' : st.name,
          station_code: code,
          state: st.state
        };
      });

      try {
        const stationsRes = await api.get('/trains/stations');
        if (stationsRes.data && stationsRes.data.length > 0) {
          setStations(stationsRes.data.map((s, idx) => {
            const rawCode = (s.station_code || s.code || '').toUpperCase();
            const code = (rawCode === 'UDU' || rawCode === 'UDUPI') ? 'UD' : rawCode;
            const name = (code === 'UD' || rawCode === 'UDU') ? 'Udupi' : (s.station_name || s.name || '');
            return {
              id: s.id || `st-db-${idx}`,
              station_name: name,
              station_code: code
            };
          }));
        } else {
          setStations(stationsMock);
        }
      } catch (err) {
        console.warn('Falling back to local indianStations list', err);
        setStations(stationsMock);
      }

      try {
        const bookingsRes = await api.get('/bookings');
        const todayStr = new Date().toISOString().split('T')[0];
        
        let bookingsData = (bookingsRes.data && Array.isArray(bookingsRes.data)) ? bookingsRes.data : [];
        
        setBookings(bookingsData);

        // Find the closest upcoming journey safely
        const upcoming = (Array.isArray(bookingsData) ? bookingsData : [])
          .filter(b => b && b.status !== 'cancelled' && b.travel_date >= todayStr)
          .sort((a, b) => new Date(a.travel_date) - new Date(b.travel_date))[0];
        setUpcomingJourney(upcoming);

        if (user?.role === 'passenger') {
          try {
            const companionsRes = await api.get('/auth/saved-passengers');
            if (companionsRes.data && Array.isArray(companionsRes.data)) {
              setCompanions(companionsRes.data.slice(0, 4));
            } else {
              setCompanions([]);
            }
          } catch (cErr) {
            setCompanions([]);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard info:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchDashboardInfo();
  }, [user]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.station-search-container')) {
        setShowSourceList(false);
        setShowDestList(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    let finalSource = (sourceCode || source || '').trim().toUpperCase();
    if (finalSource === 'UDU' || finalSource === 'UDUPI') finalSource = 'UD';
    let finalDest = (destCode || destination || '').trim().toUpperCase();
    if (finalDest === 'UDU' || finalDest === 'UDUPI') finalDest = 'UD';

    if (!finalSource || !finalDest || !travelDate) {
      alert('Please fill out all search parameters');
      return;
    }
    navigate(`/passenger/search?source=${encodeURIComponent(finalSource)}&destination=${encodeURIComponent(finalDest)}&date=${travelDate}&passengers=${passengerCount}&quota=${quota}`);
  };

  const handleCheckPnr = (e) => {
    e.preventDefault();
    if (!pnrInput) return;
    navigate(`/passenger/pnr?pnr=${pnrInput.trim()}`);
  };

  const swapStations = () => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 500);
    const tempSrc = source;
    const tempSrcCode = sourceCode;
    setSource(destination);
    setSourceCode(destCode);
    setDestination(tempSrc);
    setDestCode(tempSrcCode);
  };

  const parseTravelDate = (dateStr) => {
    if (!dateStr) return { day: '24', month: 'MAY', year: '2024' };
    try {
      const d = new Date(dateStr);
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      return {
        day: d.getDate().toString().padStart(2, '0'),
        month: months[d.getMonth()],
        year: d.getFullYear().toString()
      };
    } catch (e) {
      return { day: '24', month: 'MAY', year: '2024' };
    }
  };

  const filteredSourceStations = (stations || []).filter(s =>
    s && typeof s.station_name === 'string' && typeof s.station_code === 'string' &&
    (s.station_name.toLowerCase().includes((source || '').toLowerCase()) ||
     s.station_code.toLowerCase().includes((source || '').toLowerCase()))
  );

  const filteredDestStations = (stations || []).filter(s =>
    s && typeof s.station_name === 'string' && typeof s.station_code === 'string' &&
    (s.station_name.toLowerCase().includes((destination || '').toLowerCase()) ||
     s.station_code.toLowerCase().includes((destination || '').toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 font-sans space-y-6 animate-slide-in">
      
      {/* Ticker Tape Announcement Banner */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/20 text-slate-200 py-3 px-4 rounded-2xl flex items-center overflow-hidden text-xs shadow-lg shadow-indigo-950/20">
        <div className="flex items-center space-x-1.5 font-bold uppercase tracking-wider bg-gradient-to-r from-primary-600 to-indigo-600 px-3 py-1 rounded-lg text-[9px] z-10 flex-shrink-0 text-white shadow-md animate-pulse">
          <Volume2 className="h-3.5 w-3.5" />
          <span>Announcements</span>
        </div>
        <div className="animate-marquee whitespace-nowrap pl-4 select-none font-semibold text-slate-300">
          📢 {liveAnnouncements}
        </div>
      </div>

      {/* Identity Verification Alert */}
      {user && user.role === 'passenger' && !user.verified && !user.document_url && (
        <div className="flex flex-col sm:flex-row items-center justify-between rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 text-amber-900 backdrop-blur-md gap-4 shadow-md shadow-amber-500/5">
          <div className="flex items-center space-x-3.5">
            <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-600 flex-shrink-0 animate-bounce">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-800 tracking-wide uppercase">Identity Verification Required</p>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">Please upload Aadhaar or Passport in your Profile settings to complete passenger checks.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/passenger/profile')}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-750 text-white px-5 py-2.5 text-xs font-black transition-all duration-200 flex-shrink-0 shadow-lg shadow-amber-600/25 active:scale-95"
          >
            Verify Profile
          </button>
        </div>
      )}

      {/* Welcome & Train Graphic Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border border-indigo-950 shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between">
        {/* Ambient glow backgrounds */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        
        <div className="space-y-3 z-10 max-w-xl text-center md:text-left">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>Premium Passenger Service</span>
          </div>
          <h1 className="text-xl md:text-3xl font-semibold text-indigo-200 tracking-wide">
            Welcome back,
          </h1>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-white via-slate-100 to-primary-300 bg-clip-text text-transparent">
              {user?.full_name || 'Rahul Kumar'}!
            </span>
            <span className="ml-3 inline-block">👋</span>
          </h2>
          <p className="text-slate-400 text-xs md:text-sm font-medium pt-1">
            Plan your journey, book tickets and manage your bookings easily.
          </p>

          {/* Quick Shortcuts Bar */}
          <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
            {[
              { label: 'Search Trains', path: '/passenger/search', icon: Search },
              { label: 'PNR Status', path: '/passenger/pnr', icon: FileText },
              { label: 'Live Track', path: '/passenger/track', icon: Compass },
              { label: 'Station Schedule', path: '/passenger/station-schedule', icon: Clock },
              { label: 'Cancel Ticket', path: '/passenger/cancellations', icon: XCircle },
              { label: 'Payments', path: '/passenger/payments', icon: CreditCard }
            ].map(shortcut => {
              const IconComp = shortcut.icon;
              return (
                <button
                  key={shortcut.label}
                  onClick={() => navigate(shortcut.path)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 text-xs font-bold transition-all active:scale-95"
                >
                  <IconComp className="h-3.5 w-3.5 text-primary-400" />
                  <span>{shortcut.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Sleek inline Train Graphic on right side */}
        <div className="w-full md:w-80 lg:w-[420px] h-44 md:h-36 mt-6 md:mt-0 opacity-95 z-10">
          <svg viewBox="0 0 500 200" className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(56,189,248,0.25)]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="trainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id="neonTrail" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(56,189,248,0)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0.4)" />
              </linearGradient>
            </defs>
            <ellipse cx="250" cy="135" rx="200" ry="30" fill="#0284c7" opacity="0.1" className="blur-md" />
            <path d="M 50 150 L 450 150 M 50 155 L 450 155" stroke="#334155" strokeWidth="2" />
            <path d="M 50 150 L 450 150" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
            <path d="M 120 145 
                     L 380 145 
                     C 410 145, 430 135, 440 120 
                     C 445 110, 440 100, 420 100 
                     L 180 100 
                     C 160 100, 140 105, 120 115 
                     Z" fill="url(#trainGrad)" />
            <path d="M 190 108 L 220 108 L 220 118 L 190 118 Z 
                     M 230 108 L 260 108 L 260 118 L 230 118 Z 
                     M 270 108 L 300 108 L 300 118 L 270 118 Z 
                     M 310 108 L 340 108 L 340 118 L 310 118 Z 
                     M 350 108 L 380 108 L 380 118 L 350 118 Z" fill="#ffffff" opacity="0.95" />
            <path d="M 400 108 L 418 108 C 425 108, 428 112, 425 118 L 415 118 Z" fill="#0747a6" />
            <path d="M 100 125 L 320 125" stroke="#ffffff" strokeWidth="2" opacity="0.4" />
            <path d="M 80 132 L 280 132" stroke="#ffffff" strokeWidth="1.5" opacity="0.3" />
            <circle cx="428" cy="123" r="3.5" fill="#fef08a" className="animate-pulse" />
          </svg>
        </div>
      </div>

      {/* Book Ticket horizontal form card */}
      <div className="glass-panel rounded-3xl border border-white/60 shadow-[0_20px_50px_rgba(8,112,184,0.06)] overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/40 p-2 gap-1">
          <button 
            type="button" 
            onClick={() => setActiveTab('book')}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${activeTab === 'book' ? 'bg-white text-primary-700 shadow-sm border border-slate-100/50' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Ticket className="h-4 w-4 text-primary-500" />
            <span>Book Ticket</span>
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/passenger/pnr')}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all text-slate-500 hover:text-slate-800 hover:bg-white/60"
          >
            <FileText className="h-4 w-4 text-primary-500" />
            <span>PNR Status</span>
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/passenger/track')}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all text-slate-500 hover:text-slate-800 hover:bg-white/60"
          >
            <Compass className="h-4 w-4 text-primary-500" />
            <span>Live Running Status</span>
          </button>
          <button 
            type="button" 
            onClick={() => navigate('/passenger/station-schedule')}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all text-slate-500 hover:text-slate-800 hover:bg-white/60"
          >
            <Clock className="h-4 w-4 text-primary-500" />
            <span>Station Schedule</span>
          </button>
        </div>

        {/* Form elements & 7-Day Low Fare Slider */}
        <div className="bg-white/50 backdrop-blur-md rounded-b-3xl p-4 space-y-4">
          <TrainSearchForm />

          {/* 7-Day Low Fare Slider */}
          <div className="pt-2 border-t border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> 7-Day Fare Preview Slider
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Lowest Fare Guarantee</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 overflow-x-auto pb-1">
              {Array.from({ length: 7 }).map((_, idx) => {
                const d = new Date();
                d.setDate(d.getDate() + idx);
                const dayStr = idx === 0 ? 'TODAY' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase();
                const mockFares = [
                  { fare: '₹1,550', low: false },
                  { fare: '₹1,280', low: true },
                  { fare: '₹1,450', low: false },
                  { fare: '₹1,620', low: false },
                  { fare: '₹1,210', low: true },
                  { fare: '₹1,350', low: false },
                  { fare: '₹1,400', low: false },
                ];
                const item = mockFares[idx % mockFares.length];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const dateIso = d.toISOString().split('T')[0];
                      setTravelDate(dateIso);
                      const finalSource = sourceCode || source || '';
                      const finalDest = destCode || destination || '';
                      if (!finalSource || !finalDest) {
                        navigate(`/passenger/search?date=${dateIso}`);
                      } else {
                        navigate(`/passenger/search?source=${encodeURIComponent(finalSource)}&destination=${encodeURIComponent(finalDest)}&date=${dateIso}&passengers=${passengerCount}&quota=${quota}`);
                      }
                    }}
                    className={`flex flex-col items-center p-2 rounded-2xl border text-center transition-all ${item.low ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950' : 'bg-white/80 border-slate-200 text-slate-700'} hover:scale-105 hover:shadow-md active:scale-95`}
                  >
                    <span className="text-[9px] font-black tracking-wider uppercase text-slate-400">{dayStr}</span>
                    <span className="text-xs font-black my-0.5 text-slate-800">{dateStr}</span>
                    <span className={`text-[10px] font-extrabold ${item.low ? 'text-emerald-600' : 'text-primary-600'}`}>{item.fare}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>



      {/* Grid of Shortcuts cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        {[
          { name: 'Book Ticket', desc: 'Search & book tickets', path: '/passenger/search', icon: Ticket, colors: 'from-blue-500/10 to-blue-600/5 text-blue-600 border-blue-500/10' },
          { name: 'My Bookings', desc: 'View all bookings', path: '/passenger/history', icon: BookOpen, colors: 'from-emerald-500/10 to-emerald-600/5 text-emerald-600 border-emerald-500/10' },
          { name: 'PNR Status', desc: 'Check PNR status', path: '/passenger/pnr', icon: FileText, colors: 'from-violet-500/10 to-violet-600/5 text-violet-600 border-violet-500/10' },
          { name: 'Live Tracking', desc: 'Track live location', path: '/passenger/track', icon: Compass, colors: 'from-amber-500/10 to-amber-600/5 text-amber-600 border-amber-500/10' },
          { name: 'Cancel Ticket', desc: 'Cancel booked tickets', path: '/passenger/cancellations', icon: XCircle, colors: 'from-rose-500/10 to-rose-600/5 text-rose-600 border-rose-500/10' },
          { name: 'RailControl Meals', desc: 'Seat food delivery', path: '/passenger/catering', icon: Utensils, colors: 'from-orange-500/10 to-orange-600/5 text-orange-600 border-orange-500/10' },
          { name: 'Payment History', desc: 'View payment history', path: '/passenger/payments', icon: CreditCard, colors: 'from-cyan-500/10 to-cyan-600/5 text-cyan-600 border-cyan-500/10' }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-start p-5 rounded-3xl text-left transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${item.colors} border hover:shadow-[0_12px_24px_rgba(0,0,0,0.03)] active:scale-95`}
            >
              <div className="p-3 rounded-2xl bg-white shadow-sm mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-black text-slate-800 block">{item.name}</span>
              <span className="text-[10px] text-slate-500 font-bold leading-tight mt-1.5">{item.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Railway Miles Loyalty Program & VIP Lounge Pass Card */}
      {(() => {
        const rawMiles = user?.miles ?? user?.loyalty_miles ?? user?.loyalty_points;
        const userMiles = (typeof rawMiles === 'number' && !isNaN(rawMiles)) ? rawMiles : 12450;
        const tierName = user?.tier || user?.loyalty_tier || 'Executive VIP';
        const targetMiles = user?.tier_target || user?.next_tier_miles || 15000;
        const milesProgressPercent = Math.min(100, Math.round((userMiles / targetMiles) * 100));

        return (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-amber-500/40 rounded-3xl p-6 sm:p-7 text-white shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute left-0 top-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>

            <div className="space-y-3 z-10 flex-1">
              <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Frequent Traveler Tier &bull; {tierName}</span>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Railway Miles Loyalty Balance
              </h3>

              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                You have <strong className="text-amber-300 font-black font-mono text-base sm:text-lg tracking-wide px-1.5 py-0.5 bg-amber-500/15 rounded border border-amber-400/30 shadow-inner">{userMiles.toLocaleString()} Miles</strong> available. Complimentary Executive Lounge access active at <strong className="text-amber-200 font-extrabold font-mono border-b border-amber-400/40 pb-0.5">NDLS</strong>, <strong className="text-amber-200 font-extrabold font-mono border-b border-amber-400/40 pb-0.5">MMCT</strong> &amp; <strong className="text-amber-200 font-extrabold font-mono border-b border-amber-400/40 pb-0.5">CSMT</strong>.
              </p>

              <div className="space-y-1.5 pt-1 max-w-md">
                <div className="flex justify-between text-[11px] font-mono text-slate-300 font-bold">
                  <span>Tier Progress ({tierName})</span>
                  <span className="text-amber-300 font-extrabold">{userMiles.toLocaleString()} / {targetMiles.toLocaleString()} Miles</span>
                </div>
                <div className="w-full bg-slate-950/90 rounded-full h-3 overflow-hidden border border-slate-700/80 p-0.5 shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full rounded-full shadow-md shadow-amber-500/50 transition-all duration-700"
                    style={{ width: `${milesProgressPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLoungePassModal(true)}
              className="btn-metallic-gold px-6 py-3.5 rounded-2xl text-xs font-black flex items-center space-x-2 shadow-xl shadow-amber-500/20 shrink-0 z-10 hover:scale-105 active:scale-95 transition-all text-slate-950 cursor-pointer"
            >
              <Ticket className="h-4 w-4 text-slate-950" />
              <span>Digital VIP Lounge Pass</span>
            </button>
          </div>
        );
      })()}

      {/* Carbon Footprint & Eco-Travel Calculator Widget */}
      {(() => {
        const activeDistance = upcomingJourney?.train?.route?.distance_km || upcomingJourney?.train?.distance_km || upcomingJourney?.distance_km || 1384;
        return <EcoImpactWidget distanceKm={activeDistance} />;
      })()}

      {/* Split section: Upcoming Journey & Recent Bookings */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12" onClick={() => { setShowSourceList(false); setShowDestList(false); }}>
        
        {/* Left Side: Upcoming Journey */}
        <div className="md:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800">
              <Ticket className="h-4.5 w-4.5 text-[#003366]" />
              <h3 className="text-sm font-black text-slate-800">Upcoming Journey</h3>
            </div>
            <button onClick={() => navigate('/passenger/history')} className="text-xs font-black text-primary-600 hover:text-primary-700 transition">
              View All
            </button>
          </div>

          {upcomingJourney ? (
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl shadow-xl overflow-hidden relative flex flex-col md:flex-row transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/20 group">
              {/* Semi-circular punches for realistic ticket look */}
              <div className="absolute top-1/2 left-28 -translate-y-1/2 -translate-x-1/2 hidden md:block">
                <div className="w-5 h-5 rounded-full bg-slate-50 absolute -top-24"></div>
                <div className="w-5 h-5 rounded-full bg-slate-50 absolute -bottom-24"></div>
              </div>

              {/* Left Ticket "Stub" */}
              <div className="w-full md:w-28 bg-gradient-to-b from-primary-600 to-indigo-700 text-white flex flex-col items-center justify-center p-5 text-center border-b md:border-b-0 md:border-r border-dashed border-white/20 relative">
                {(() => {
                  const parsed = parseTravelDate(upcomingJourney.travel_date);
                  return (
                    <>
                      <span className="text-3xl font-black tracking-tight">{parsed.day}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider mt-1">{parsed.month}</span>
                      <span className="text-[10px] text-white/60 font-bold mt-0.5">{parsed.year}</span>
                    </>
                  );
                })()}
                
                {/* Visual barcode mockup for premium touch */}
                <div className="hidden md:flex items-center space-x-[2px] mt-6 opacity-40">
                  {[2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 4].map((w, idx) => (
                    <div key={idx} className="h-8 bg-white" style={{ width: `${w}px` }}></div>
                  ))}
                </div>
              </div>

              {/* Main Journey Details Section */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-white group-hover:text-primary-300 transition-colors leading-tight">
                        {upcomingJourney.train?.train_number} • {upcomingJourney.train?.train_name}
                      </h4>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-355 border border-emerald-500/20 uppercase tracking-wider animate-pulse">
                      {upcomingJourney.status}
                    </span>
                  </div>

                  {/* Train Disruptions / Warning Alert */}
                  {upcomingJourney.train && upcomingJourney.train.status && upcomingJourney.train.status !== 'on_time' && (
                    <div className={`p-3 rounded-2xl border text-[11px] font-bold flex flex-col gap-1.5 shadow-sm ${
                      upcomingJourney.train.status === 'cancelled'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : upcomingJourney.train.status === 'delayed'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                        : 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                    }`}>
                      <div className="flex items-center space-x-1.5">
                        <span className={`h-2 w-2 rounded-full ${
                          upcomingJourney.train.status === 'cancelled' ? 'bg-rose-500 animate-ping' : upcomingJourney.train.status === 'delayed' ? 'bg-amber-500 animate-pulse' : 'bg-purple-500 animate-pulse'
                        }`}></span>
                        <span className="uppercase tracking-wider font-extrabold text-[10px]">
                          TRAIN SERVICE {upcomingJourney.train.status.toUpperCase()}
                        </span>
                      </div>
                      <span>
                        {upcomingJourney.train.status === 'cancelled' && (
                          `⚠️ Cancelled. ${upcomingJourney.train.cancellation_reason ? `Reason: ${upcomingJourney.train.cancellation_reason}` : ''}`
                        )}
                        {upcomingJourney.train.status === 'delayed' && (
                          `🕒 Delayed by ${upcomingJourney.train.delay_minutes} mins. Updated departure: ${upcomingJourney.train.updated_departure_time?.slice(0,5)}`
                        )}
                        {upcomingJourney.train.status === 'rescheduled' && (
                          `📅 Rescheduled. New departure: ${upcomingJourney.train.updated_departure_time?.slice(0,5)}`
                        )}
                      </span>
                    </div>
                  )}

                  {/* Flight/Train Style Station-to-Station Layout */}
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <span className="text-2xl font-black block tracking-tight">17:10</span>
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">{upcomingJourney.train?.route?.source_station_code || 'MMCT'}</span>
                    </div>
                    
                    <div className="flex-1 px-5 flex flex-col items-center">
                      <span className="text-[9px] text-white/40 font-bold block mb-1">15h 25m</span>
                      <div className="w-full relative flex items-center justify-center">
                        <div className="h-[2px] w-full bg-gradient-to-r from-primary-500/10 via-primary-500 to-primary-500/10"></div>
                        <div className="absolute right-0 h-1.5 w-1.5 rounded-full bg-primary-400"></div>
                      </div>
                      <span className="text-[8px] text-white/30 font-extrabold uppercase mt-1">Duration</span>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black block tracking-tight">08:35</span>
                      <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">{upcomingJourney.train?.route?.destination_station_code || 'NDLS'}</span>
                    </div>
                  </div>

                  {/* Seat allocation rows */}
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/10 text-xs font-bold text-white/70">
                    <div>
                      <span className="text-[9px] text-white/40 block uppercase tracking-wider">PNR</span>
                      <span className="font-mono text-white text-xs">{upcomingJourney.pnr_number}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 block uppercase tracking-wider">Class</span>
                      <span className="text-white text-xs">2A</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 block uppercase tracking-wider">Seat</span>
                      <span className="text-white text-xs">23 (Lower)</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 block uppercase tracking-wider">Coach</span>
                      <span className="text-white text-xs">B2</span>
                    </div>
                  </div>
                </div>

                {/* View Ticket details bottom button */}
                <button 
                  onClick={() => navigate(`/passenger/ticket/${upcomingJourney.pnr_number}`)}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 border-t border-white/5 text-xs font-black text-primary-305 flex items-center justify-center space-x-1.5 transition duration-200"
                >
                  <span>View Full Journey Details</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl border border-dashed border-slate-200/80 p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-56 shadow-sm">
              <Calendar className="h-8 w-8 text-slate-300 mb-3" />
              <p className="font-black text-slate-700">No Upcoming Journeys</p>
              <p className="text-[10px] text-slate-400 mt-1.5 max-w-[240px] leading-relaxed">Book a new ticket to display your upcoming boarding card details here.</p>
            </div>
          )}
        </div>

        {/* Right Side: Recent Bookings list */}
        <div className="md:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800">
              <Clock className="h-4.5 w-4.5 text-[#003366]" />
              <h3 className="text-sm font-black text-slate-800">Recent Bookings</h3>
            </div>
            <button onClick={() => navigate('/passenger/history')} className="text-xs font-black text-primary-600 hover:text-primary-700 transition">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {bookings.slice(0, 3).map((bk) => {
              const statusColor = bk.status === 'confirmed' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : bk.status === 'rac' 
                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200';
              return (
                <div 
                  key={bk.id}
                  onClick={() => navigate(`/passenger/ticket/${bk.pnr_number}`)}
                  className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm hover:shadow-md hover:border-primary-400/40 cursor-pointer flex items-center justify-between transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600 group-hover:bg-primary-100/50 transition">
                      <Ticket className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 leading-tight">
                        {bk.train?.train_number} • {bk.train?.train_name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1.5">
                        {bk.travel_date} | {bk.train?.route?.source_station_code || 'MMCT'} &rarr; {bk.train?.route?.destination_station_code || 'NDLS'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end space-y-2">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${statusColor}`}>
                      {bk.status}
                    </span>
                    <span className="text-[9.5px] font-mono font-bold text-slate-400 tracking-wide">
                      {bk.pnr_number}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* PNR Status box section */}
      <div id="pnr-enquiry" className="bg-[#0f172a] border border-indigo-950 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white">
        <div className="absolute right-0 top-0 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="space-y-1.5 z-10">
          <h3 className="text-sm font-black tracking-wide uppercase text-slate-200">PNR Inquiry Status</h3>
          <p className="text-xs text-slate-400 font-semibold">
            Check the live confirmation and seat allocation log for waitlisted and RAC tickets.
          </p>
        </div>
        <form onSubmit={handleCheckPnr} className="flex space-x-2.5 mt-5">
          <input
            type="text"
            placeholder="Enter 10-Digit PNR Number"
            value={pnrInput}
            onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="flex-grow rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3.5 text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none font-bold text-white font-mono shadow-inner placeholder:text-slate-505"
            required
          />
          <button
            type="submit"
            className="rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white px-6 py-3.5 text-xs font-black transition-all shadow-md shadow-primary-500/10 border border-primary-600/10 active:scale-95"
          >
            Verify PNR
          </button>
        </form>
      </div>

      {/* OFFICIAL RAILWAY ANNOUNCEMENTS BOARD */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <Volume2 className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Official Railway Announcements</h3>
              <p className="text-[11px] text-slate-400 font-medium">Live broadcasts, platform changes, and travel advisories issued by station command.</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            ● Live Station Feed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {announcementsList.slice(0, 4).map((item) => (
            <div 
              key={item.id}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2 hover:border-primary-300 transition duration-200 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  📢 Railway Announcement
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">{item.date || 'Today'}</span>
              </div>

              <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                {item.text}
              </p>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 text-[10px] text-slate-500">
                <span className="font-mono font-bold text-slate-400">By: {item.author || 'TTE Command'}</span>

                <button
                  type="button"
                  onClick={() => speakAnnouncement(item)}
                  className={`px-3 py-1 rounded-xl font-black transition flex items-center space-x-1 ${
                    playingAudioId === item.id 
                      ? 'bg-rose-600 text-white shadow-sm animate-pulse' 
                      : 'bg-primary-50 hover:bg-primary-100 text-primary-700'
                  }`}
                >
                  <Volume2 className="h-3 w-3" />
                  <span>{playingAudioId === item.id ? 'Playing Audio...' : 'Listen Audio'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom 4 action banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {[
          { 
            name: 'Need Help?', 
            desc: 'Contact our support team anytime', 
            icon: HelpCircle, 
            action: () => navigate('/passenger/support') 
          },
          { 
            name: 'Travel Guidelines', 
            desc: 'Check COVID-19 and travel guidelines', 
            icon: Info, 
            action: () => setShowGuidelinesModal(true) 
          },
          { 
            name: 'Offers & Deals', 
            desc: 'Explore latest offers and discounts', 
            icon: Percent, 
            action: () => setShowOffersModal(true) 
          },
          { 
            name: 'Feedback', 
            desc: 'Share your feedback with us', 
            icon: Star, 
            action: () => navigate('/passenger/feedback') 
          }
        ].map((banner, idx) => {
          const Icon = banner.icon;
          return (
            <div 
              key={idx}
              onClick={banner.action}
              className="bg-white rounded-2xl border border-slate-200 p-4.5 flex items-center justify-between hover:border-primary-500/50 hover:shadow-md cursor-pointer hover:-translate-y-0.5 transition duration-200 group active:scale-95"
            >
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition duration-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-850 group-hover:text-primary-700 transition-colors">{banner.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">{banner.desc}</p>
                </div>
              </div>
              <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-primary-500 transition-colors" />
            </div>
          );
        })}
      </div>

      {/* Custom footer inside dashboard */}
      <footer className="pt-8 pb-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-semibold gap-3">
        <div>
          © 2026 Railway Management System. All rights reserved.
        </div>
        <div className="flex space-x-4">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <span>|</span>
          <a href="#" className="hover:underline">Terms & Conditions</a>
          <span>|</span>
          <button onClick={() => navigate('/passenger/support')} className="hover:underline">Contact Support</button>
        </div>
      </footer>

      {/* Indoor Station Map Modal */}
      <StationMapModal isOpen={showStationMap} onClose={() => setShowStationMap(false)} />

      {/* TRAVEL GUIDELINES MODAL */}
      {showGuidelinesModal && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowGuidelinesModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in my-auto">
            
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
              <button 
                onClick={() => setShowGuidelinesModal(false)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Official Railway Advisory
                  </span>
                  <h2 className="text-lg font-black tracking-tight mt-0.5">Passenger Travel Guidelines</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs font-medium text-slate-700 max-h-[70vh] overflow-y-auto">
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 1. Valid ID Proof Requirement
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Passengers must carry original government-issued photo ID (Aadhaar Card, Passport, PAN Card, Driving License, or Voter ID) during the journey for check by the TTE.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 2. Free Luggage Allowance Rules
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  1A: 70kg • 2A: 50kg • 3A/CC: 40kg • SL: 35kg. Excess baggage beyond free allowance must be booked at the station parcel office prior to boarding.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 3. Senior Citizen & Divyangjan Quota
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Lower berth priority is auto-allocated to male passengers aged 60+ and female passengers aged 45+ traveling alone or in pairs.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-primary-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 4. Health & Hygiene Safety
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Hand sanitizers are installed at all station entry gates and AC coach vestibules. RailControl Meals are prepared in FSSAI-certified kitchens.
                </p>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuidelinesModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition active:scale-95 shadow-md"
              >
                Understood & Close
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* OFFERS & PROMO DEALS MODAL */}
      {showOffersModal && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowOffersModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in my-auto">
            
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white relative">
              <button 
                onClick={() => setShowOffersModal(false)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    IRCTC Festive Discounts
                  </span>
                  <h2 className="text-lg font-black tracking-tight mt-0.5">Exclusive Offers & Coupons</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs font-medium text-slate-700 max-h-[70vh] overflow-y-auto">
              
              {[
                {
                  code: 'RAIL100',
                  title: 'Flat ₹100 Off on Vande Bharat & Rajdhani',
                  desc: 'Get instant ₹100 discount on 2A and 1A bookings across all routes.',
                  bg: 'bg-amber-50 border-amber-200 text-amber-950'
                },
                {
                  code: 'UPIFOOD15',
                  title: '15% Cashback on RailControl Meals',
                  desc: 'Use UPI payment at checkout on RailControl food orders above ₹250.',
                  bg: 'bg-emerald-50 border-emerald-200 text-emerald-950'
                },
                {
                  code: 'IRCTCSBI',
                  title: '10% Instant Discount via SBI RuPay Card',
                  desc: 'Save up to ₹300 per ticket transaction when paying with SBI Railway Card.',
                  bg: 'bg-blue-50 border-blue-200 text-blue-950'
                }
              ].map((promo, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border ${promo.bg} space-y-2 relative`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black uppercase px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-900 tracking-wider">
                      {promo.code}
                    </span>
                    <button
                      onClick={() => alert(`Promo code ${promo.code} copied to clipboard!`)}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200 transition flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copy Code
                    </button>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-xs">{promo.title}</h4>
                  <p className="text-[11px] text-slate-600 font-medium">{promo.desc}</p>
                </div>
              ))}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowOffersModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition active:scale-95 shadow-md"
              >
                Close Promo Offers
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* DIGITAL VIP LOUNGE PASS MODAL */}
      {showLoungePassModal && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowLoungePassModal(false); }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in font-sans"
        >
          <div className="bg-slate-950 border border-amber-500/40 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-scale-in my-auto text-white">
            
            <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-6 relative border-b border-amber-500/30">
              <button 
                onClick={() => setShowLoungePassModal(false)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    INDIAN RAILWAYS LOYALTY CLUB
                  </span>
                  <h2 className="text-lg font-black tracking-tight mt-0.5 text-amber-200">Executive VIP Lounge Pass</h2>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Pass Card Graphic */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 border border-amber-400/30 space-y-4 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-extrabold">PASSENGER NAME</span>
                    <h3 className="text-base font-black text-white">{user?.full_name || 'Rahul Kumar'}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500 text-slate-950 shadow-md">
                    EXECUTIVE VIP
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono border-t border-b border-white/10 py-3">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">MEMBER ID</span>
                    <span className="font-bold text-amber-300">RLY-VIP-884920</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">VALID STATIONS</span>
                    <span className="font-bold text-white">NDLS, MMCT, CSMT</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">BALANCE MILES</span>
                    <span className="font-bold text-amber-300">12,450 MILES</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">EXPIRES</span>
                    <span className="font-bold text-emerald-400">31 DEC 2026</span>
                  </div>
                </div>

                {/* QR Code Graphic Mockup */}
                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-300 block">Lounge Benefits:</span>
                    <ul className="text-[10px] text-slate-400 space-y-0.5">
                      <li>&bull; Free AC Recliner &amp; Shower</li>
                      <li>&bull; Unlimited Buffet &amp; High-speed Wi-Fi</li>
                      <li>&bull; Priority Boarding Call Desk</li>
                    </ul>
                  </div>
                  
                  {/* SVG QR Code */}
                  <div className="bg-white p-2 rounded-xl shadow-lg shrink-0">
                    <svg viewBox="0 0 100 100" className="w-16 h-16">
                      <rect width="100" height="100" fill="#ffffff"/>
                      <path d="M10 10h30v30H10zM60 10h30v30H60zM10 60h30v30H10z" fill="#0f172a"/>
                      <path d="M18 18h14v14H18zM68 18h14v14H68zM18 68h14v14H18z" fill="#ffffff"/>
                      <rect x="45" y="10" width="8" height="25" fill="#0f172a"/>
                      <rect x="10" y="45" width="25" height="8" fill="#0f172a"/>
                      <rect x="45" y="45" width="10" height="10" fill="#0f172a"/>
                      <rect x="60" y="45" width="30" height="8" fill="#0f172a"/>
                      <rect x="45" y="60" width="8" height="30" fill="#0f172a"/>
                      <rect x="60" y="60" width="12" height="12" fill="#0f172a"/>
                      <rect x="78" y="78" width="12" height="12" fill="#0f172a"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed font-medium bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <p>💡 Scan this QR code at the IRCTC Executive Lounge reception desk at New Delhi (NDLS), Mumbai Central (MMCT), or Chhatrapati Shivaji Terminus (CSMT) for instant complimentary access.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => alert('🖨️ Digital VIP Lounge Pass sent to printer!')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
              >
                Print Pass
              </button>
              <button
                type="button"
                onClick={() => setShowLoungePassModal(false)}
                className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 shadow-md"
              >
                Close Pass
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default PassengerDashboard;
