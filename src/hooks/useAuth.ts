/**
 * useAuth — Authentication state hook
 */

import { useState, useCallback } from 'react'
import { supabaseClient } from '@/services/supabase'
import type { UserSession } from '@/types'

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(supabaseClient.getSession())
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)

  const login = useCallback(async (key: string) => {
    setIsAuthenticating(true)
    setAuthError(null)
    setAuthSuccess(null)

    try {
      const result = await supabaseClient.loginWithKey(key)
      if (result.success && result.session) {
        setSession(result.session)
        setAuthSuccess('✓ Access Granted! Entering Terminal...')
        return { success: true }
      } else {
        setAuthError(result.message || 'Authentication failed. Please check your key.')
        return { success: false }
      }
    } catch (err) {
      console.error(err)
      setAuthError('Network error connecting to database.')
      return { success: false }
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const logout = useCallback(() => {
    supabaseClient.logout()
    setSession(null)
  }, [])

  const isAuthenticated = Boolean(session?.key && session?.tokens_balance > 0 && session?.status !== 'ended')

  return {
    session,
    isAuthenticated,
    isAuthenticating,
    authError,
    authSuccess,
    login,
    logout,
    clearError: () => setAuthError(null),
  }
}
