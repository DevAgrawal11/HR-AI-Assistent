import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AppShell from './components/AppShell'
import JobsPage from './pages/JobsPage'
import RequirementsPage from './pages/RequirementsPage'
import ResumeUploadPage from './pages/ResumeUploadPage'
import CandidatesPage from './pages/CandidatesPage'


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <AppShell>
              <DashboardPage />
            </AppShell>
          }
        />
        <Route
  path="/jobs"
  element={
    <AppShell>
      <JobsPage />
    </AppShell>
  }
/>

<Route
  path="/jobs/:id/requirements"
  element={
    <AppShell>
      <RequirementsPage />
    </AppShell>
  }
/>


<Route
  path="/jobs/:id/upload"
  element={
    <AppShell>
      <ResumeUploadPage />
    </AppShell>
  }
/>

<Route
  path="/jobs/:id/candidates"
  element={
    <AppShell>
      <CandidatesPage />
    </AppShell>
  }
/>



        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App