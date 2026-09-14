import { Routes, Route, Navigate } from 'react-router-dom';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { canAccessNavItem } from './lib/permissions';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import GanttPage from './pages/GanttPage';
import CalendarPage from './pages/CalendarPage';
import DocsPage from './pages/DocsPage';
import VaultPage from './pages/VaultPage';
import EmployeesPage from './pages/EmployeesPage';

function ProtectedLayoutRoute() {
  const { currentUser } = useAppData();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

// Blocks direct URL navigation to a page this account's role/menu-restrictions don't allow — the
// Sidebar already hides the nav link, but that alone wouldn't stop someone typing the URL in by
// hand. Shares the exact same `canAccessNavItem` check the Sidebar uses, so a page is reachable
// if and only if its nav link is actually visible.
function NavGuardRoute({ navId, children }: { navId: string; children: React.ReactNode }) {
  const { currentUser } = useAppData();
  if (!currentUser || !canAccessNavItem(currentUser, navId)) return <Navigate to="/dashboard" replace />;
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
        {/* dashboard is deliberately never restrictable — every redirect above falls back to it,
            so blocking it could dead-end someone in a redirect loop. */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<NavGuardRoute navId="tasks"><TasksPage /></NavGuardRoute>} />
        <Route path="/gantt" element={<NavGuardRoute navId="gantt"><GanttPage /></NavGuardRoute>} />
        <Route path="/calendar" element={<NavGuardRoute navId="calendar"><CalendarPage /></NavGuardRoute>} />
        <Route path="/docs" element={<NavGuardRoute navId="docs"><DocsPage /></NavGuardRoute>} />
        <Route path="/vault" element={<NavGuardRoute navId="vault"><VaultPage /></NavGuardRoute>} />
        <Route path="/employees" element={<NavGuardRoute navId="employees"><EmployeesPage /></NavGuardRoute>} />
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
