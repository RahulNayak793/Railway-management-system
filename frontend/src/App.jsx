import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Components & Layouts
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatbotWidget from './components/ChatbotWidget';

// Pages
import Login from './pages/Login';
import PassengerDashboard from './pages/PassengerDashboard';
import SearchTrainResults from './pages/SearchTrainResults';
import SeatSelection from './pages/SeatSelection';
import Payment from './pages/Payment';
import ETicket from './pages/ETicket';
import MyBookings from './pages/MyBookings';
import LiveTracking from './pages/LiveTracking';
import SupportTickets from './pages/SupportTickets';
import PassengerCancelTicket from './pages/PassengerCancelTicket';
import PassengerPayments from './pages/PassengerPayments';
import PassengerNotifications from './pages/PassengerNotifications';
import PassengerPNRStatus from './pages/PassengerPNRStatus';
import ProfileSettings from './pages/ProfileSettings';
import PassengerWallet from './pages/PassengerWallet';
import PassengerCatering from './pages/PassengerCatering';
import EmergencySOSModal from './components/EmergencySOSModal';
import { Radio, ShieldAlert } from 'lucide-react';

import StaffDashboard from './pages/StaffDashboard';
import StaffSchedules from './pages/StaffSchedules';
import StaffInquiries from './pages/StaffInquiries';
import StaffRefunds from './pages/StaffRefunds';
import StaffBookings from './pages/StaffBookings';
import StaffPassengers from './pages/StaffPassengers';
import StaffTicketChecking from './pages/StaffTicketChecking';
import StaffRACWaiting from './pages/StaffRACWaiting';
import StaffReports from './pages/StaffReports';
import StaffAnnouncements from './pages/StaffAnnouncements';

import AdminDashboard from './pages/AdminDashboard';
import AdminRoutes from './pages/AdminRoutes';
import AdminSchedules from './pages/AdminSchedules';
import AdminStations from './pages/AdminStations';
import AdminClasses from './pages/AdminClasses';
import AdminUsers from './pages/AdminUsers';
import AdminStaff from './pages/AdminStaff';
import AdminPayments from './pages/AdminPayments';
import AdminPolicies from './pages/AdminPolicies';

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
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Emergency SOS Button */}
      <button
        onClick={() => setSosOpen(true)}
        className="fixed bottom-6 right-24 z-40 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-2xl shadow-rose-600/40 border border-rose-400/40 flex items-center space-x-2 transition active:scale-95 group animate-pulse"
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
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full">
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
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full">
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
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-slate-50">
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
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
