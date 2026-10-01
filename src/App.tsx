import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { canAccessNavItem } from './lib/permissions';
import { Employee } from './types';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';

// Where an account lands after login, and where every guard/catch-all route below falls back to.
// Normally "/dashboard" (see its own route's comment), but admin/superadmin can't reach it at all
// (2569-10-01: back-office-only roles, see isNavAllowedByRole) — their home is "/employees" instead,
// the one page they can always reach, so routing them to "/dashboard" would just bounce them again.
function homeRouteFor(currentUser: Pick<Employee, 'accountType'> | null): string {
  if (currentUser?.accountType === 'admin' || currentUser?.accountType === 'superadmin') return '/employees';
  return '/dashboard';
}

// Each page is its own chunk, fetched the first time it's opened — the login screen and the first
// page after it no longer have to download the Gantt, Drive, vault and every other module up front.
// (AppLayout wraps the routed page in a Suspense boundary for the brief loading state.)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const GanttPage = lazy(() => import('./pages/GanttPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const VaultPage = lazy(() => import('./pages/VaultPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

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
  if (!currentUser || !canAccessNavItem(currentUser, navId)) return <Navigate to={homeRouteFor(currentUser)} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isRestoringSession, currentUser } = useAppData();

  if (isRestoringSession) {
    return <div className="min-h-dvh bg-[#FCFAF8]" />;
  }

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to={homeRouteFor(currentUser)} replace /> : <LoginPage />} />

      <Route element={<ProtectedLayoutRoute />}>
        {/* dashboard is everyone's fallback EXCEPT admin/superadmin (see homeRouteFor) — guarded
            like every other module now so a direct URL visit can't bypass the sidebar hiding it. */}
        <Route path="/dashboard" element={<NavGuardRoute navId="dashboard"><DashboardPage /></NavGuardRoute>} />
        <Route path="/tasks" element={<NavGuardRoute navId="tasks"><TasksPage /></NavGuardRoute>} />
        <Route path="/gantt" element={<NavGuardRoute navId="gantt"><GanttPage /></NavGuardRoute>} />
        <Route path="/calendar" element={<NavGuardRoute navId="calendar"><CalendarPage /></NavGuardRoute>} />
        <Route path="/docs" element={<NavGuardRoute navId="docs"><DocsPage /></NavGuardRoute>} />
        <Route path="/vault" element={<NavGuardRoute navId="vault"><VaultPage /></NavGuardRoute>} />
        <Route path="/employees" element={<NavGuardRoute navId="employees"><EmployeesPage /></NavGuardRoute>} />
        {/* settings is open to everyone and never restrictable per-account — it's where each
            person manages their own account, so blocking it would just strand them. */}
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to={homeRouteFor(currentUser)} replace />} />
      <Route path="*" element={<Navigate to={homeRouteFor(currentUser)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <ConfirmProvider>
        <AppRoutes />
      </ConfirmProvider>
    </AppDataProvider>
  );
}
