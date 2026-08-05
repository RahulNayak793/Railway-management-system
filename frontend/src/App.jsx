import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Components & Layouts
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatbotWidget from './components/ChatbotWidget';
import EmergencySOSModal from './components/EmergencySOSModal';
import { Radio, ShieldAlert } from 'lucide-react';

// Retry helper for dynamic imports to prevent ChunkLoadError when Vercel deploys new builds
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasBeenRefreshed = JSON.parse(
      window.sessionStorage.getItem('retry_chunk_refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('retry_chunk_refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasBeenRefreshed) {
        window.sessionStorage.setItem('retry_chunk_refreshed', 'true');
        window.location.reload();
      }
      throw error;
    }
  });

// Lazy-loaded Pages with automatic chunk retry
const Login = lazyWithRetry(() => import('./pages/Login'));
const PassengerDashboard = lazyWithRetry(() => import('./pages/PassengerDashboard'));
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
const ProfileSettings = lazyWithRetry(() => import('./pages/ProfileSettings'));
const PassengerWallet = lazyWithRetry(() => import('./pages/PassengerWallet'));
const PassengerCatering = lazyWithRetry(() => import('./pages/PassengerCatering'));

const StaffDashboard = lazyWithRetry(() => import('./pages/StaffDashboard'));
const StaffSchedules = lazyWithRetry(() => import('./pages/StaffSchedules'));
const StaffInquiries = lazyWithRetry(() => import('./pages/StaffInquiries'));
const StaffRefunds = lazyWithRetry(() => import('./pages/StaffRefunds'));
const StaffBookings = lazyWithRetry(() => import('./pages/StaffBookings'));
const StaffPassengers = lazyWithRetry(() => import('./pages/StaffPassengers'));
const StaffTicketChecking = lazyWithRetry(() => import('./pages/StaffTicketChecking'));
const StaffRACWaiting = lazyWithRetry(() => import('./pages/StaffRACWaiting'));
const StaffReports = lazyWithRetry(() => import('./pages/StaffReports'));
const StaffAnnouncements = lazyWithRetry(() => import('./pages/StaffAnnouncements'));

const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const AdminRoutes = lazyWithRetry(() => import('./pages/AdminRoutes'));
const AdminSchedules = lazyWithRetry(() => import('./pages/AdminSchedules'));
const AdminStations = lazyWithRetry(() => import('./pages/AdminStations'));
const AdminClasses = lazyWithRetry(() => import('./pages/AdminClasses'));
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'));
const AdminStaff = lazyWithRetry(() => import('./pages/AdminStaff'));
const AdminPayments = lazyWithRetry(() => import('./pages/AdminPayments'));
const AdminPolicies = lazyWithRetry(() => import('./pages/AdminPolicies'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-slate-800">Session Interface Refreshed</h2>
            <p className="text-xs text-slate-500">
              Your session workspace encountered a minor rendering glitch. Click below to return to your dashboard or login page.
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.href = '/login';
                }}
                className="w-1/2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Sign In Again
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="w-1/2 rounded-xl bg-blue-600 text-white py-3 text-xs font-bold hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
              >
                Reload Workspace
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
    return <Navigate to="/login" replace />;
  }

  const userRole = (user.role || 'passenger').toLowerCase();

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
    const isAllowed = normalizedAllowed.includes(userRole) || (userRole === 'admin');
    if (!isAllowed) {
      if (userRole === 'admin') return <Navigate to="/admin" replace />;
      if (userRole === 'staff') return <Navigate to="/staff" replace />;
      return <Navigate to="/passenger" replace />;
    }
  }

  return children;
};

// Responsive Layout Wrappers
const PassengerLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
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
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Emergency SOS Button */}
      <button
        onClick={() => setSosOpen(true)}
        className="fixed bottom-6 right-20 sm:right-24 z-40 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] sm:text-xs shadow-2xl shadow-rose-600/40 border border-rose-400/40 flex items-center space-x-2 transition active:scale-95 group animate-pulse"
      >
        <Radio className="h-4 w-4 text-white group-hover:rotate-12 transition" />
        <span>Emergency SOS</span>
      </button>

      <EmergencySOSModal isOpen={sosOpen} onClose={() => setSosOpen(false)} />
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
      <ChatbotWidget />
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
      <ChatbotWidget />
    </div>
  );
};

// Root Redirect helper
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'staff') return <Navigate to="/staff" replace />;
  return <Navigate to="/passenger" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-slate-50">
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Login Page */}
              <Route path="/login" element={<Login />} />

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

              {/* Staff Dashboard Flow */}
              <Route path="/staff" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffDashboard />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/schedules" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffSchedules />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/inquiries" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffInquiries />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/refunds" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffRefunds />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/bookings" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffBookings />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/passengers" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffPassengers />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/checking" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffTicketChecking />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/ticket-checking" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffTicketChecking />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/rac" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffRACWaiting />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/rac-waiting" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffRACWaiting />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/reports" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffReports />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/announcements" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <StaffAnnouncements />
                  </StaffLayout>
                </ProtectedRoute>
              } />
              <Route path="/staff/profile" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout>
                    <ProfileSettings />
                  </StaffLayout>
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
                    <StaffSchedules />
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
              <Route path="/admin/staff" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <AdminStaff />
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
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <StaffRefunds />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/cancellation" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <StaffRefunds />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/inquiries" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <StaffInquiries />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <StaffReports />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <StaffReports />
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
              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <AdminPolicies />
                  </AdminLayout>
                </ProtectedRoute>
              } />

              {/* Default Route redirect */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
