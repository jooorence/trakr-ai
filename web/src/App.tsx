import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AuthGate } from './components/AuthGate'
import { SectionPlaceholder } from './components/SectionPlaceholder'

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<SectionPlaceholder title="Dashboard" />}
          />
          <Route
            path="/food-log"
            element={<SectionPlaceholder title="Food Log" />}
          />
          <Route
            path="/meal-plans"
            element={<SectionPlaceholder title="Meal Plans" />}
          />
          <Route
            path="/training"
            element={<SectionPlaceholder title="Training Split" />}
          />
          <Route
            path="/routines"
            element={<SectionPlaceholder title="Routines" />}
          />
          <Route
            path="/rules"
            element={<SectionPlaceholder title="Rules" />}
          />
          <Route
            path="/longevity"
            element={<SectionPlaceholder title="Longevity" />}
          />
          <Route
            path="/creed"
            element={<SectionPlaceholder title="Creed" />}
          />
          <Route
            path="/insights"
            element={<SectionPlaceholder title="Insights" />}
          />
          <Route
            path="/coach"
            element={<SectionPlaceholder title="CoachGPT" />}
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthGate>
  )
}
