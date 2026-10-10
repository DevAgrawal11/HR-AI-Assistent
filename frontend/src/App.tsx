import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import JobsPage from './pages/JobsPage'
import RequirementsPage from './pages/RequirementsPage'
import ResumeUploadPage from './pages/ResumeUploadPage'
import CandidatesPage from './pages/CandidatesPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/jobs"
          element={
            <ProtectedRoute>
              <AppShell>
                <JobsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/jobs/:id/requirements"
          element={
            <ProtectedRoute>
              <AppShell>
                <RequirementsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/jobs/:id/upload"
          element={
            <ProtectedRoute>
              <AppShell>
                <ResumeUploadPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/jobs/:id/candidates"
          element={
            <ProtectedRoute>
              <AppShell>
                <CandidatesPage />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* Redirect unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
