/**
 * App Router — React Router v6 setup
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TerminalPage } from '@/pages/TerminalPage'
import { AdminPage } from '@/pages/AdminPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TerminalPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin-panel" element={<AdminPage />} />
        <Route path="/terminal" element={<Navigate to="/" replace />} />
        <Route path="/d" element={<Navigate to="/" replace />} />
        <Route path="/app" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
