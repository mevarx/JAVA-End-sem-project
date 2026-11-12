import { lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { Role } from './api/types'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppLayout } from './components/Layout'
import { ToastProvider } from './components/feedback'
import { Spinner } from './components/ui'
import { ROLE_HOME } from './nav'
import { LoginPage } from './pages/auth/Login'
import { RegisterPage } from './pages/auth/Register'

const DashboardPage = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.DashboardPage })),
)
const AdminDepartmentsPage = lazy(() =>
  import('./pages/admin/Departments').then((module) => ({ default: module.AdminDepartmentsPage })),
)
const AdminUsersPage = lazy(() =>
  import('./pages/admin/Users').then((module) => ({ default: module.AdminUsersPage })),
)
const ReportsPage = lazy(() =>
  import('./pages/admin/Reports').then((module) => ({ default: module.ReportsPage })),
)
const AvailabilityPage = lazy(() =>
  import('./pages/doctor/Availability').then((module) => ({ default: module.AvailabilityPage })),
)
const SchedulePage = lazy(() =>
  import('./pages/doctor/Schedule').then((module) => ({ default: module.SchedulePage })),
)
const EmergencyBoardPage = lazy(() =>
  import('./pages/emergency/EmergencyBoard').then((module) => ({
    default: module.EmergencyBoardPage,
  })),
)
const MyAppointmentsPage = lazy(() =>
  import('./pages/patient/MyAppointments').then((module) => ({
    default: module.MyAppointmentsPage,
  })),
)
const MyEmergenciesPage = lazy(() =>
  import('./pages/patient/MyEmergencies').then((module) => ({
    default: module.MyEmergenciesPage,
  })),
)
const BookAppointmentPage = lazy(() =>
  import('./pages/patient/BookAppointment').then((module) => ({
    default: module.BookAppointmentPage,
  })),
)
const AllAppointmentsPage = lazy(() =>
  import('./pages/staff/AllAppointments').then((module) => ({
    default: module.AllAppointmentsPage,
  })),
)
const WaitlistPage = lazy(() =>
  import('./pages/staff/Waitlist').then((module) => ({ default: module.WaitlistPage })),
)

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Loading your workspace…" />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Loading…" />
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <>{children}</>
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Loading…" />
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/book"
                element={
                  <RequireRole roles={['PATIENT', 'RECEPTIONIST']}>
                    <BookAppointmentPage />
                  </RequireRole>
                }
              />
              <Route
                path="/appointments"
                element={
                  <RequireRole roles={['PATIENT']}>
                    <MyAppointmentsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/emergencies"
                element={
                  <RequireRole roles={['PATIENT']}>
                    <MyEmergenciesPage />
                  </RequireRole>
                }
              />
              <Route
                path="/schedule"
                element={
                  <RequireRole roles={['DOCTOR']}>
                    <SchedulePage />
                  </RequireRole>
                }
              />
              <Route
                path="/availability"
                element={
                  <RequireRole roles={['DOCTOR']}>
                    <AvailabilityPage />
                  </RequireRole>
                }
              />
              <Route
                path="/all-appointments"
                element={
                  <RequireRole roles={['RECEPTIONIST', 'ER_STAFF', 'ADMIN']}>
                    <AllAppointmentsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/waitlist"
                element={
                  <RequireRole roles={['RECEPTIONIST', 'ADMIN']}>
                    <WaitlistPage />
                  </RequireRole>
                }
              />
              <Route
                path="/board"
                element={
                  <RequireRole roles={['DOCTOR', 'RECEPTIONIST', 'ER_STAFF', 'ADMIN']}>
                    <EmergencyBoardPage />
                  </RequireRole>
                }
              />
              <Route
                path="/users"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <AdminUsersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/departments"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <AdminDepartmentsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <ReportsPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<HomeRedirect />} />
            </Route>
          </Route>
        </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
