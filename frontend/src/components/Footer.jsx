import React from 'react';
import { Link } from 'react-router-dom';
import { Train, ShieldCheck, HeartHandshake, PhoneCall, Globe, Eye, Sun, Moon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';

const Footer = () => {
  const { lang, setLang, t } = useLanguage();
  const { fontSize, setFontSize, highContrast, toggleHighContrast } = useAccessibility();

  return (
    <footer className="bg-slate-900 text-slate-300 font-sans border-t border-slate-800 mt-16 print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand & Description */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-white">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Train className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-lg font-black tracking-tight">RailControl</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Intelligent railway management system providing seamless train search, PNR status tracking, live timetables, and seat reservation.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>SSL 256-bit Secure Platform</span>
            </div>
          </div>

          {/* Passenger Tools */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Passenger Services</h4>
            <ul className="space-y-2 text-xs font-semibold text-slate-400">
              <li>
                <Link to="/passenger/search" className="hover:text-white transition">Book Train Ticket</Link>
              </li>
              <li>
                <Link to="/passenger/pnr" className="hover:text-white transition">Check PNR Status</Link>
              </li>
              <li>
                <Link to="/passenger/track" className="hover:text-white transition">Live Train Running Status</Link>
              </li>
              <li>
                <Link to="/passenger/station-schedule" className="hover:text-white transition">Station Timetable</Link>
              </li>
              <li>
                <Link to="/passenger/history" className="hover:text-white transition">My Booking History</Link>
              </li>
            </ul>
          </div>

          {/* Travel & On-Board */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">On-Board & Support</h4>
            <ul className="space-y-2 text-xs font-semibold text-slate-400">
              <li>
                <Link to="/passenger/catering" className="hover:text-white transition">E-Catering Food Orders</Link>
              </li>
              <li>
                <Link to="/passenger/support" className="hover:text-white transition">Customer Support Helpline</Link>
              </li>
              <li>
                <Link to="/passenger/cancellations" className="hover:text-white transition">Ticket Cancellation & Refunds</Link>
              </li>
              <li>
                <Link to="/passenger/feedback" className="hover:text-white transition">Passenger Ratings & Reviews</Link>
              </li>
            </ul>
          </div>

          {/* Accessibility & Settings Controls */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Preferences & Accessibility</h4>
            
            {/* Font Size Selector */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Text Size</span>
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl w-fit border border-slate-700">
                <button
                  type="button"
                  onClick={() => setFontSize('small')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition ${
                    fontSize === 'small' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Small Text Size"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('normal')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                    fontSize === 'normal' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Default Text Size"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('large')}
                  className={`px-2.5 py-1 rounded-lg text-sm font-black transition ${
                    fontSize === 'large' ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Large Text Size"
                >
                  A+
                </button>
              </div>
            </div>

            {/* High Contrast Toggle */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contrast</span>
              <button
                type="button"
                onClick={toggleHighContrast}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                  highContrast ? 'bg-amber-400 border-amber-300 text-slate-950 font-black' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{highContrast ? 'High Contrast: ON' : 'High Contrast: OFF'}</span>
              </button>
            </div>


          </div>

        </div>

        {/* Bottom copyright */}
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between text-slate-500 text-xs gap-3">
          <p>© {new Date().getFullYear()} RailControl Systems. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
