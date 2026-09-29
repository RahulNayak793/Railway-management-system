import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { LanguageProvider } from './context/LanguageContext';
import { AccessibilityProvider } from './context/AccessibilityContext';

// Components & Layouts
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import ChatbotWidget from './components/ChatbotWidget';
import EmergencySOSModal from './components/EmergencySOSModal';
import { Radio, ShieldAlert } from 'lucide-react';

// Core Pages - Imported statically to ensure instant load on Vercel host
import Login from './pages/Login';
import Register from './pages/Register';
import PassengerLogin from './pages/PassengerLogin';
import PassengerRegister from './pages/PassengerRegister';
import PassengerForgotPassword from './pages/PassengerForgotPassword';
import PassengerResetPassword from './pages/PassengerResetPassword';
import PassengerDashboard from './pages/PassengerDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Retry helper for dynamic imports of subpages
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.warn('Chunk load error encountered for subpage, reloading:', error);
      const isRefreshed = sessionStorage.getItem('chunk_retry_active');
      if (!isRefreshed) {
        sessionStorage.setItem('chunk_retry_active', 'true');
        window.location.reload();
        return new Promise(() => { });
      }
      sessionStorage.removeItem('chunk_retry_active');
      return await componentImport();
    }
  });

// Secondary Subpages - Lazy loaded
const SearchTrainResults = lazyWithRetry(() => import('./pages/SearchTrainResults'));
const SeatSelection = lazyWithRetry(() => import('./pages/SeatSelection'));
const Payment = lazyWithRetry(() => import('./pages/Payment'));
const ETicket = lazyWithRetry(() => import('./pages/ETicket'));
const MyBookings = lazyWithRetry(() => import('./pages/MyBookings'));
const LiveTracking = lazyWithRetry(() => import('./pages/LiveTracking'));
const SupportTickets = lazyWithRetry(() => import('./pages/SupportTickets'));
const PassengerCancelTicket = lazyWithRetry(() => import('./pages/PassengerCancelTicket'));
const PassengerPayments = lazyWithRetry(() => import('./pages/PassengerPayments'));
const PassengerNotifications = lazyWithRetry(() => import('./pages/PassengerNotifications'));
const PassengerPNRStatus = lazyWithRetry(() => import('./pages/PassengerPNRStatus'));
const StationSchedule = lazyWithRetry(() => import('./pages/StationSchedule'));
const ProfileSettings = lazyWithRetry(() => import('./pages/ProfileSettings'));
const PassengerWallet = lazyWithRetry(() => import('./pages/PassengerWallet'));
const PassengerCatering = lazyWithRetry(() => import('./pages/PassengerCatering'));
const PassengerFeedback = lazyWithRetry(() => import('./pages/PassengerFeedback'));

const AdminTicketChecking = lazyWithRetry(() => import('./pages/AdminTicketChecking'));
const AdminRACWaiting = lazyWithRetry(() => import('./pages/AdminRACWaiting'));

const AdminRoutes = lazyWithRetry(() => import('./pages/AdminRoutes'));
const AdminSchedules = lazyWithRetry(() => import('./pages/AdminSchedules'));
const AdminStations = lazyWithRetry(() => import('./pages/AdminStations'));
const AdminClasses = lazyWithRetry(() => import('./pages/AdminClasses'));
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'));
const AdminPayments = lazyWithRetry(() => import('./pages/AdminPayments'));
const AdminTrainStatus = lazyWithRetry(() => import('./pages/AdminTrainStatus'));
const AdminPolicies = lazyWithRetry(() => import('./pages/AdminPolicies'));
const AdminCatering = lazyWithRetry(() => import('./pages/AdminCatering'));
const CateringLogin = lazyWithRetry(() => import('./pages/CateringLogin'));
const CateringDashboard = lazyWithRetry(() => import('./pages/CateringDashboard'));
const StaffBookings = lazyWithRetry(() => import('./pages/StaffBookings'));
const StaffRefunds = lazyWithRetry(() => import('./pages/StaffRefunds'));
const AdminDiagnostics = lazyWithRetry(() => import('./pages/AdminDiagnostics'));
const AdminReports = lazyWithRetry(() => import('./pages/AdminReports'));

const AdminStaffManagement = lazyWithRetry(() => import('./pages/AdminStaffManagement'));
const AdminStaffRoster = lazyWithRetry(() => import('./pages/AdminStaffRoster'));
const AdminStaffDuties = lazyWithRetry(() => import('./pages/AdminStaffDuties'));
const AdminStaffReports = lazyWithRetry(() => import('./pages/AdminStaffReports'));
const AdminStaffControlDetail = lazyWithRetry(() => import('./pages/AdminStaffControlDetail'));
const StaffDashboard = lazyWithRetry(() => import('./pages/StaffDashboard'));
const StaffTrains = lazyWithRetry(() => import('./pages/StaffTrains'));
const StaffTrainStatus = lazyWithRetry(() => import('./pages/StaffTrainStatus'));
const StaffManifest = lazyWithRetry(() => import('./pages/StaffManifest'));
const StaffVerify = lazyWithRetry(() => import('./pages/StaffVerify'));
const StaffIncidents = lazyWithRetry(() => import('./pages/StaffIncidents'));
const StaffDailyReport = lazyWithRetry(() => import('./pages/StaffDailyReport'));
const StaffInquiries = lazyWithRetry(() => import('./pages/StaffInquiries'));
const StaffTasks = lazyWithRetry(() => import('./pages/StaffTasks'));
const AdminReservations = lazyWithRetry(() => import('./pages/AdminReservations'));
const StaffReservations = lazyWithRetry(() => import('./pages/StaffReservations'));
const StaffSchedules = lazyWithRetry(() => import('./pages/StaffSchedules'));
const StaffPassengers = lazyWithRetry(() => import('./pages/StaffPassengers'));
const StaffReports = lazyWithRetry(() => import('./pages/StaffReports'));
const StaffAnnouncements = lazyWithRetry(() => import('./pages/StaffAnnouncements'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    const pathname = window.location.pathname;
    if (pathname === '/login' || pathname === '/') {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    const pathname = window.location.pathname;
    if (pathname === '/login' || pathname === '/') {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    const pathname = window.location.pathname;
    if (this.state.hasError && pathname !== '/login' && pathname !== '/') {
      return (
        <div className="min-h-screen bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 text-center">
          <div className="w-[92%] max-w-[420px] bg-white p-5 sm:p-8 rounded-3xl shadow-2xl border border-slate-100 space-y-4 mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-xl font-bold border border-blue-100 shadow-sm">
              🚆
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">RailControl System Workspace</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Your session workspace encountered a minor display update. Click below to return to the sign in page.
            </p>
            {this.state.error && (
              <div className="text-[11px] text-red-600 bg-red-50 p-3 rounded-xl max-h-48 overflow-auto text-left font-mono border border-red-100">
                <strong>Error:</strong> {this.state.error.message || String(this.state.error)}
                {this.state.error.stack && (
                  <pre className="text-[9px] text-slate-600 mt-2 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full rounded-xl bg-blue-600 text-white min-h-[44px] py-3 text-xs font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95"
              >
                Reload Application
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/login';
                }}
                className="w-full rounded-xl bg-slate-100 text-slate-700 min-h-[44px] py-3 text-xs font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
              >
                Sign In Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading Fallback Spinner
const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-r-transparent" />
      </div>
    );
  }

  if (!user) {
    if (window.location.pathname.startsWith('/catering/company') || window.location.pathname.startsWith('/catering/login')) {
      return <Navigate to="/login" replace />;
    }
    const isStaffOrAdminPath = window.location.pathname.startsWith('/staff') || window.location.pathname.startsWith('/admin');
    return <Navigate to={isStaffOrAdminPath ? "/login" : "/passenger/login"} replace />;
  }

  const userRole = (user.role || 'passenger').toLowerCase();

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
    const isAllowed = normalizedAllowed.includes(userRole);
    if (!isAllowed) {
      if (userRole === 'catering_company') return <Navigate to="/login" replace />;
      if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
      if (userRole === 'staff') return <Navigate to="/staff/dashboard" replace />;
      return <Navigate to="/passenger" replace />;
    }
  }

  return children;
};

// Responsive Layout Wrappers
const PassengerLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 relative">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 transition-opacity"
          />
        )}
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto w-full flex flex-col justify-between">
          <div className="max-w-7xl mx-auto space-y-6 w-full">
            {children}
          </div>
          <Footer />
        </main>
      </div>

      <ChatbotWidget />
    </div>
  );
};

const StaffLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 transition-opacity"
          />
        )}
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 transition-opacity"
          />
        )}
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Root Redirect helper
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/passenger/login" replace />;
  const userRole = (user.role || '').toLowerCase();
  if (userRole === 'catering_company') return <Navigate to="/login" replace />;
  if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (userRole === 'staff') return <Navigate to="/staff/dashboard" replace />;
  return <Navigate to="/passenger" replace />;
};

// Mobile Capacitor Integration Services (Back Button, Splash, Network Status)
function CapacitorMobileServices() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0F172A' }).catch(() => {});
    }

    let networkListener;
    const initNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setIsOffline(!status.connected);

        networkListener = await Network.addListener('networkStatusChange', (status) => {
          setIsOffline(!status.connected);
        });
      } catch (e) {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
      }
    };
    initNetwork();

    return () => {
      if (networkListener && networkListener.remove) {
        networkListener.remove();
      }
    };
  }, []);

  useEffect(() => {
    let backHandler;
    const initBackButton = async () => {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        backHandler = await CapApp.addListener('backButton', ({ canGoBack }) => {
          const path = location.pathname;
          if (
            path === '/passenger' ||
            path === '/passenger/login' ||
            path === '/' ||
            path === '/login' ||
            path === '/staff/dashboard' ||
            path === '/admin/dashboard'
          ) {
            CapApp.exitApp();
          } else if (canGoBack) {
            navigate(-1);
          } else {
            CapApp.exitApp();
          }
        });
      }
    };
    initBackButton();

    return () => {
      if (backHandler && backHandler.remove) {
        backHandler.remove();
      }
    };
  }, [location.pathname, navigate]);

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-xs font-semibold py-2.5 px-4 text-center shadow-lg flex items-center justify-center space-x-2">
          <span>⚠️ Unable to connect to Railway server. Please check your network connection and try again.</span>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <CurrencyProvider>
            <LanguageProvider>
              <AccessibilityProvider>
                <ToastProvider>
                  <CapacitorMobileServices />
                  <div className="min-h-screen bg-slate-50">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Dedicated Separate Login & Auth Pages */}
                    <Route path="/login" element={<Login mode="staff" />} />
                    <Route path="/admin/login" element={<Login mode="admin" />} />
                    <Route path="/passenger/login" element={<PassengerLogin />} />
                    <Route path="/passenger/register" element={<PassengerRegister />} />
                    <Route path="/passenger/forgot-password" element={<PassengerForgotPassword />} />
                    <Route path="/passenger/reset-password" element={<PassengerResetPassword />} />
                    <Route path="/login/passenger" element={<Navigate to="/passenger/login" replace />} />
                    <Route path="/register" element={<Navigate to="/passenger/register" replace />} />
                    <Route path="/catering/login" element={<Navigate to="/login" replace />} />

                    {/* Passenger Dashboard Flow */}
                    <Route path="/passenger" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerDashboard />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/search" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <SearchTrainResults />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/search-trains" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <SearchTrainResults />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/seat-selection/:trainId" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <SeatSelection />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/seats" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <SeatSelection />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/booking" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <SeatSelection />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/payment" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <Payment />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/checkout" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <Payment />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/ticket/:pnr" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <ETicket />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/history" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <MyBookings />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/cancellations" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerCancelTicket />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/payments" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerPayments />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/pnr" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerPNRStatus />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/station-schedule" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <StationSchedule />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/track" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <LiveTracking />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/catering" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerCatering />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/meal" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerCatering />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/meals" element={<Navigate to="/passenger/catering" replace />} />
                    <Route path="/passenger/ecatering" element={<Navigate to="/passenger/catering" replace />} />
                    <Route path="/passenger/e-catering" element={<Navigate to="/passenger/catering" replace />} />
                    <Route path="/catering/login" element={<Navigate to="/login" replace />} />
                    <Route path="/catering/company" element={<Navigate to="/login" replace />} />
                    <Route path="/catering/company/*" element={<Navigate to="/login" replace />} />
                    <Route path="/vendor/catering" element={<Navigate to="/login" replace />} />
                    <Route path="/passenger/support" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <SupportTickets />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/notifications" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerNotifications />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/profile" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <ProfileSettings />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/wallet" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerWallet />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/passenger/feedback" element={
                      <ProtectedRoute allowedRoles={['passenger']}>
                        <PassengerLayout>
                          <PassengerFeedback />
                        </PassengerLayout>
                      </ProtectedRoute>
                    } />

                    {/* Staff Operations Center Routes */}
                    <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
                    <Route path="/staff/dashboard" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffDashboard />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/schedules" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffSchedules />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/trains" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTrains />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/bookings" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffBookings />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/bookings-management" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffBookings />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/passengers" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <AdminUsers />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/users" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <AdminUsers />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/cancellation" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffRefunds />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/cancellations" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffRefunds />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/refunds" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffRefunds />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/ticket-checking" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <AdminTicketChecking />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/checking" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <AdminTicketChecking />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/manifest" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffManifest />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/verify" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffVerify />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/tickets" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffVerify />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/pnr" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffVerify />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/rac" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <AdminRACWaiting />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/rac-waiting" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <AdminRACWaiting />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/seats" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffManifest />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/reservations" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffReservations />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/station-ops" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTrains />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/stations" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTrains />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/status" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTrainStatus />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/train-status" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTrainStatus />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/tasks" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTasks />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/duties" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTasks />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/assigned-tasks" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffTasks />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/notifications" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <PassengerNotifications />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/daily-report" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffDailyReport />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/submit-task" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffDailyReport />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/reports" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffReports />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/announcements" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffAnnouncements />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/service-requests" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffInquiries />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/inquiries" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <StaffInquiries />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/staff/profile" element={
                      <ProtectedRoute allowedRoles={['staff', 'admin']}>
                        <StaffLayout>
                          <ProfileSettings />
                        </StaffLayout>
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/profile" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <ProfileSettings />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />

                    {/* Admin Dashboard Flow */}
                    <Route path="/admin" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminDashboard />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/trains" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminSchedules />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/routes" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminRoutes />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/schedules" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminSchedules />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/stations" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStations />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/classes" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminClasses />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/users" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminUsers />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/passengers" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminUsers />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/staff" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffRoster />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/staff/duties" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffDuties />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/tasks" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffDuties />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/assigned-tasks" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffDuties />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/staff/reports" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffReports />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/submit-task" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffReports />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/daily-report" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffReports />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/staff/control/:staffId" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminStaffControlDetail />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                      <Route path="/admin/dashboard" element={
                        <ProtectedRoute allowedRoles={['admin', 'staff']}>
                          <AdminLayout>
                            <AdminDashboard />
                          </AdminLayout>
                        </ProtectedRoute>
                      } />
                      <Route path="/admin/train-status" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <AdminLayout>
                            <AdminTrainStatus />
                          </AdminLayout>
                        </ProtectedRoute>
                      } />
                     <Route path="/admin/ticket-checking" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminTicketChecking />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/rac-waiting" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminRACWaiting />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/reservations" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminReservations />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/announcements" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminPolicies />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/bookings" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <StaffBookings />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/payments" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminPayments />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/cancellations" element={
                      <ProtectedRoute allowedRoles={['admin', 'staff']}>
                        <AdminLayout>
                          <StaffRefunds />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/refunds" element={
                      <ProtectedRoute allowedRoles={['admin', 'staff']}>
                        <AdminLayout>
                          <StaffRefunds />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/cancellation" element={
                      <ProtectedRoute allowedRoles={['admin', 'staff']}>
                        <AdminLayout>
                          <StaffRefunds />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/inquiries" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <SupportTickets />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/reports" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminReports />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/analytics" element={<Navigate to="/admin/reports" replace />} />
                    <Route path="/admin/system-diagnostics" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminDiagnostics />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/policies" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminPolicies />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/fare-policy" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminPolicies />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/catering" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminLayout>
                          <AdminCatering />
                        </AdminLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/settings" element={<Navigate to="/admin/policies" replace />} />

                    {/* Default Route redirect */}
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </ToastProvider>
          </AccessibilityProvider>
        </LanguageProvider>
      </CurrencyProvider>
    </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
