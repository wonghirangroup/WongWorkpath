import { Routes, Route, Navigate } from 'react-router-dom';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import GanttPage from './pages/GanttPage';
import CalendarPage from './pages/CalendarPage';
import DocsPage from './pages/DocsPage';
import VaultPage from './pages/VaultPage';
import ReportsPage from './pages/ReportsPage';
import EmployeesPage from './pages/EmployeesPage';

function ProtectedLayoutRoute() {
  const { currentUser } = useAppData();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

// Blocks direct URL navigation to admin-only pages for non-admin accounts — the Sidebar already
// hides the nav link, but that alone wouldn't stop someone typing /employees into the address bar.
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppData();
  if (!currentUser?.isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isRestoringSession, currentUser } = useAppData();

  if (isRestoringSession) {
    return <div className="min-h-dvh bg-[#FCFAF8]" />;
  }

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={<ProtectedLayoutRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/gantt" element={<GanttPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/employees" element={<AdminOnlyRoute><EmployeesPage /></AdminOnlyRoute>} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  );
}
