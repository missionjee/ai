/**
 * ProtectedRoute — Wraps routes that require authentication
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseClient } from '@/services/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const session = supabaseClient.getSession()
    if (!session?.key || !session?.tokens_balance || session.tokens_balance <= 0) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  return <>{children}</>
}
