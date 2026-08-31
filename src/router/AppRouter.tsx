/**
 * App Router — React Router v6 setup
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { TerminalPage } from '@/pages/TerminalPage'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/terminal"
          element={
            <ProtectedRoute>
              <TerminalPage />
            </ProtectedRoute>
          }
        />
        {/* Legacy URL compatibility */}
        <Route path="/d" element={<Navigate to="/terminal" replace />} />
        <Route path="/app" element={<Navigate to="/terminal" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
