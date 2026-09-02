/**
 * HIROTO AI — Supabase Database & Session Manager (TypeScript)
 *
 * Features:
 * - Direct REST / RPC communication with Supabase
 * - Single-Device Session Lock (Strict Device ID Verification)
 * - 1-Token-Per-Prediction Accounting
 * - Resilient Local Fallback Engine
 */

import {
  AdminStats,
  AuthResult,
  AuthorizedPredictionResult,
  GlobalSignal,
  TokenLedgerEntry,
  TokenResult,
  UserProfile,
  UserSession
} from '@/types'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config/env'

// Safe localStorage wrapper
const safeStorage = {
  _memory: {} as Record<string, string>,
  getItem(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return this._memory[key] || null }
  },
  setItem(key: string, val: string): void {
    try { localStorage.setItem(key, val) } catch { /* noop */ }
    this._memory[key] = val
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key) } catch { /* noop */ }
    delete this._memory[key]
  }
}

export const SUPABASE_CONFIG = {
  API_URL: SUPABASE_URL || 'https://fvmbqikdomcjalladwmz.supabase.co',
  ANON_KEY: SUPABASE_ANON_KEY || 'sb_publishable_UNWum89AzkwnfNb2BoxdKA_otmSXn5c',
  DEFAULT_TOKENS: 100,
  STORAGE_SESSION_KEY: 'hiroto_signals_session',
  STORAGE_DEVICE_KEY: 'hiroto_device_id',
  STORAGE_TOKENS_KEY: 'hiroto_tokens_balance',
}

class SupabaseService {
  deviceId: string

  constructor() {
    this.deviceId = this._getOrCreateDeviceId()
  }

  private _getOrCreateDeviceId(): string {
    let id = safeStorage.getItem(SUPABASE_CONFIG.STORAGE_DEVICE_KEY)
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = `DEV-${crypto.randomUUID()}`
      } else {
        id = `DEV-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`
      }
      safeStorage.setItem(SUPABASE_CONFIG.STORAGE_DEVICE_KEY, id)
    }
    return id
  }

  getSession(): UserSession | null {
    try {
      const raw = safeStorage.getItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY)
      return raw ? (JSON.parse(raw) as UserSession) : null
    } catch { return null }
  }

  getTokenBalance(): number {
    const session = this.getSession()
    if (session && typeof session.tokens_balance === 'number') return session.tokens_balance
    const cached = safeStorage.getItem(SUPABASE_CONFIG.STORAGE_TOKENS_KEY)
    return cached !== null ? parseInt(cached, 10) : SUPABASE_CONFIG.DEFAULT_TOKENS
  }

  private _setTokenBalance(count: number): void {
    safeStorage.setItem(SUPABASE_CONFIG.STORAGE_TOKENS_KEY, String(count))
    const session = this.getSession()
    if (session) {
      session.tokens_balance = count
      safeStorage.setItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY, JSON.stringify(session))
    }
  }

  private get _headers() {
    return {
      'apikey': SUPABASE_CONFIG.ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Authenticate License Key against Supabase & Enforce Single Device Lock
   */
  async loginWithKey(licenseKey: string): Promise<AuthResult> {
    const cleanKey = licenseKey.trim().toUpperCase()
    if (!cleanKey) return { success: false, message: 'Please enter a license key.' }

    const deviceName = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Workstation'

    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/rpc/auth_license_device`,
        {
          method: 'POST',
          headers: this._headers,
          body: JSON.stringify({
            p_license_key: cleanKey,
            p_device_id: this.deviceId,
            p_device_name: deviceName
          })
        }
      )

      if (!res.ok) {
        // Fallback check if RPC endpoint is unreachable
        return { success: false, message: `Authentication server error ${res.status}.` }
      }

      const data = await res.json()
      if (!data || !data.success) {
        const code = data?.code || 'AUTH_FAILED'
        const message = data?.message || 'Invalid license key. Please check and retry.'
        return { success: false, code, message }
      }

      const tokenBalance = parseInt(data.tokens_balance, 10)
      if (isNaN(tokenBalance) || tokenBalance <= 0) {
        return { success: false, code: 'KEY_ENDED', message: 'This key has ended: 0 tokens remaining. Please recharge.' }
      }

      const session: UserSession = {
        key: cleanKey,
        tokens_balance: tokenBalance,
        deviceId: this.deviceId,
        status: data.status || 'active',
        syncedWithCloud: true,
        loginTime: new Date().toISOString()
      }

      safeStorage.setItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY, JSON.stringify(session))
      this._setTokenBalance(tokenBalance)
      return { success: true, session }

    } catch (err) {
      console.error('[Supabase Auth] Error:', err)
      return { success: false, message: 'Authentication server unreachable. Check your network connection.' }
    }
  }

  /**
   * Consume 1 Token for a Prediction Round
   */
  async consumeToken(periodNumber: string, predictionType: string): Promise<TokenResult> {
    const session = this.getSession()
    if (!session?.key) return { success: false, error: 'AUTH_REQUIRED' }

    const currentTokens = this.getTokenBalance()
    if (currentTokens <= 0) {
      return { success: false, error: 'INSUFFICIENT_TOKENS', remainingTokens: 0, message: 'Tokens depleted.' }
    }

    try {
      const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/rpc/consume_prediction_token`, {
        method: 'POST', headers: this._headers,
        body: JSON.stringify({
          p_license_key: session.key,
          p_device_id: this.deviceId,
          p_period: String(periodNumber),
          p_prediction_type: predictionType
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data?.success) {
          this._setTokenBalance(data.tokens_balance)
          return { success: true, remainingTokens: data.tokens_balance, deducted: data.deducted }
        } else if (data?.error === 'DEVICE_MISMATCH') {
          this.logoutDueToDeviceConflict()
          return { success: false, error: 'DEVICE_MISMATCH' }
        } else if (data?.error === 'INSUFFICIENT_TOKENS') {
          this._setTokenBalance(0)
          return { success: false, error: 'INSUFFICIENT_TOKENS', remainingTokens: 0 }
        } else if (['KEY_NOT_FOUND', 'INVALID_KEY', 'KEY_DELETED'].includes(data?.error)) {
          this.logout()
          return { success: false, error: 'KEY_DELETED' }
        }
      }
    } catch { /* fall through to local */ }

    const ledgerKey = `hiroto_deducted_${periodNumber}`
    if (safeStorage.getItem(ledgerKey)) {
      return { success: true, remainingTokens: currentTokens, deducted: 0 }
    }

    const newBalance = Math.max(0, currentTokens - 1)
    safeStorage.setItem(ledgerKey, '1')
    this._setTokenBalance(newBalance)
    return { success: true, remainingTokens: newBalance, deducted: 1 }
  }

  /**
   * Real-time Device Lock & Token Verification
   */
  async verifyDeviceSession(): Promise<{ valid: boolean; reason?: string }> {
    const session = this.getSession()
    if (!session?.key) return { valid: false }

    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(session.key)}&select=active_device_id,tokens_balance,status`,
        { method: 'GET', headers: this._headers }
      )

      if (res.ok) {
        const rows = await res.json()
        if (!Array.isArray(rows) || rows.length === 0) {
          this.logout()
          return { valid: false, reason: 'DELETED' }
        }
        const row = rows[0]
        if (row.active_device_id && row.active_device_id !== this.deviceId) {
          this.logoutDueToDeviceConflict()
          return { valid: false, reason: 'DEVICE_MISMATCH' }
        }
        if (['ended', 'revoked', 'deleted'].includes(row.status) || row.tokens_balance <= 0) {
          this.logout()
          return { valid: false, reason: 'ENDED' }
        }
        if (typeof row.tokens_balance === 'number') this._setTokenBalance(row.tokens_balance)
        return { valid: true }
      }
    } catch (e) { console.error('Device verification error:', e) }

    return { valid: true }
  }

  /**
   * Fetch Central 24/7 Global Signal from Cloud
   */
  async getGlobalSignal(periodNumber: string): Promise<GlobalSignal | null> {
    if (!periodNumber) return null
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/global_signals?issue_number=eq.${encodeURIComponent(periodNumber)}&select=*`,
        { headers: this._headers }
      )
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows) && rows.length > 0) return rows[0] as GlobalSignal
      }
    } catch { /* noop */ }
    return null
  }

  /**
   * Zero-Leak Secure RPC: Get Authorized Prediction
   */
  async getAuthorizedPrediction(periodNumber: string): Promise<AuthorizedPredictionResult> {
    const session = this.getSession()
    if (!session?.key) return { success: false, error: 'AUTH_REQUIRED' }

    try {
      const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/rpc/get_authorized_prediction`, {
        method: 'POST', headers: this._headers,
        body: JSON.stringify({
          p_license_key: session.key,
          p_device_id: this.deviceId,
          p_period: String(periodNumber)
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data) {
          if (data.tokens_balance !== undefined) this._setTokenBalance(data.tokens_balance)
          if (data.error === 'DEVICE_MISMATCH') { this.logoutDueToDeviceConflict(); return { success: false, error: 'DEVICE_MISMATCH' } }
          if (data.error === 'INSUFFICIENT_TOKENS') { this._setTokenBalance(0); return { success: false, error: 'INSUFFICIENT_TOKENS' } }
          if (data.success && data.signal) return { success: true, signal: data.signal, tokensBalance: data.tokens_balance }
        }
      }
    } catch (e) { console.error('RPC Error:', e) }

    if (this.getTokenBalance() <= 0) {
      return { success: false, error: 'INSUFFICIENT_TOKENS', tokensBalance: 0 }
    }

    const fallbackSignal = await this.getGlobalSignal(periodNumber)
    return { success: !!fallbackSignal, signal: fallbackSignal as AuthorizedPredictionResult['signal'], tokensBalance: this.getTokenBalance() }
  }

  /**
   * Fetch user's taken predictions history from Supabase token_ledger
   */
  async getUserTakenPredictions(limit = 60): Promise<TokenLedgerEntry[]> {
    const session = this.getSession()
    if (!session?.key) return []
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/token_ledger?license_key=eq.${encodeURIComponent(session.key)}&select=period_number,prediction_type,created_at&order=id.desc&limit=${limit}`,
        { headers: this._headers }
      )
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows)) return rows as TokenLedgerEntry[]
      }
    } catch { /* noop */ }
    return []
  }

  /**
   * ============================================================================
   * ADMINISTRATIVE CONTROL SUITE (Admin Panel APIs)
   * ============================================================================
   */

  /**
   * Fetch all user profiles / license keys
   */
  async getAllUserProfiles(): Promise<UserProfile[]> {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?select=*&order=created_at.desc`,
        { headers: this._headers }
      )
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows)) return rows as UserProfile[]
      }
    } catch (err) {
      console.error('[Admin] Error fetching user profiles:', err)
    }
    return []
  }

  /**
   * Create a new license key in Supabase
   */
  async createUserProfile(licenseKey: string, tokens: number = 100): Promise<{ success: boolean; message?: string }> {
    const cleanKey = licenseKey.trim().toUpperCase()
    if (!cleanKey) return { success: false, message: 'License key cannot be empty.' }

    try {
      const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles`, {
        method: 'POST',
        headers: {
          ...this._headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          license_key: cleanKey,
          tokens_balance: tokens,
          status: 'active',
          created_at: new Date().toISOString()
        })
      })

      if (res.ok || res.status === 201) {
        return { success: true }
      }
      const err = await res.json().catch(() => ({}))
      return { success: false, message: err?.message || `Error ${res.status}: Key may already exist.` }
    } catch {
      return { success: false, message: 'Network error creating license key.' }
    }
  }

  /**
   * Credit or adjust tokens for a license key
   */
  async creditUserTokens(licenseKey: string, amount: number): Promise<{ success: boolean; newBalance?: number; message?: string }> {
    const cleanKey = licenseKey.trim().toUpperCase()
    try {
      const fetchRes = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}&select=tokens_balance`,
        { headers: this._headers }
      )
      if (fetchRes.ok) {
        const rows = await fetchRes.json()
        if (rows.length > 0) {
          const current = Number(rows[0].tokens_balance) || 0
          const updated = Math.max(0, current + amount)
          const patchRes = await fetch(
            `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`,
            {
              method: 'PATCH',
              headers: { ...this._headers, 'Prefer': 'return=representation' },
              body: JSON.stringify({ tokens_balance: updated, status: 'active', updated_at: new Date().toISOString() })
            }
          )
          if (patchRes.ok) return { success: true, newBalance: updated }
        }
      }
      return { success: false, message: 'License key not found.' }
    } catch {
      return { success: false, message: 'Network error updating token balance.' }
    }
  }

  /**
   * Unbind device lock (Reset active_device_id)
   */
  async resetDeviceLock(licenseKey: string): Promise<{ success: boolean; message?: string }> {
    const cleanKey = licenseKey.trim().toUpperCase()
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`,
        {
          method: 'PATCH',
          headers: { ...this._headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ active_device_id: null, device_name: null, updated_at: new Date().toISOString() })
        }
      )
      return { success: res.ok }
    } catch {
      return { success: false, message: 'Network error resetting device lock.' }
    }
  }

  /**
   * Update key status (active | suspended | revoked)
   */
  async updateKeyStatus(licenseKey: string, status: 'active' | 'suspended' | 'revoked'): Promise<{ success: boolean }> {
    const cleanKey = licenseKey.trim().toUpperCase()
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`,
        {
          method: 'PATCH',
          headers: { ...this._headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() })
        }
      )
      return { success: res.ok }
    } catch {
      return { success: false }
    }
  }

  /**
   * Delete a license key and cascade delete associated records
   */
  async deleteLicenseKey(licenseKey: string): Promise<{ success: boolean }> {
    const cleanKey = licenseKey.trim().toUpperCase()
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`,
        { method: 'DELETE', headers: this._headers }
      )
      return { success: res.ok }
    } catch {
      return { success: false }
    }
  }

  /**
   * Fetch recent global signals with win/loss calculations
   */
  async getRecentGlobalSignals(limit = 40): Promise<GlobalSignal[]> {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/global_signals?select=*&order=issue_number.desc&limit=${limit}`,
        { headers: this._headers }
      )
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows)) return rows as GlobalSignal[]
      }
    } catch { /* noop */ }
    return []
  }

  /**
   * Fetch full recent token ledger entries
   */
  async getRecentTokenLedger(limit = 60): Promise<any[]> {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.API_URL}/rest/v1/token_ledger?select=*&order=id.desc&limit=${limit}`,
        { headers: this._headers }
      )
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows)) return rows
      }
    } catch { /* noop */ }
    return []
  }

  /**
   * Calculate aggregated admin statistics
   */
  async getAdminStats(): Promise<AdminStats> {
    const [profiles, signals] = await Promise.all([
      this.getAllUserProfiles(),
      this.getRecentGlobalSignals(100)
    ])

    const totalKeys = profiles.length
    const activeKeys = profiles.filter(p => p.status === 'active' && p.tokens_balance > 0).length
    const totalTokensCirculating = profiles.reduce((sum, p) => sum + (Number(p.tokens_balance) || 0), 0)
    const boundDevicesCount = profiles.filter(p => !!p.active_device_id).length

    const settledSignals = signals.filter(s => !!s.actual_result && s.predicted_type !== 'HOLD')
    const winCount = settledSignals.filter(s => s.predicted_type?.toUpperCase() === s.actual_result?.toUpperCase()).length
    const winRate24h = settledSignals.length > 0 ? Math.round((winCount / settledSignals.length) * 100) : 0

    return {
      totalKeys,
      activeKeys,
      totalTokensCirculating,
      boundDevicesCount,
      signals24hCount: signals.length,
      winRate24h
    }
  }

  logoutDueToDeviceConflict(): void {
    safeStorage.removeItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY)
    alert('⚠️ ACCESS TERMINATED: This license key is locked to another device.')
    window.location.replace('/?reason=multi_device')
  }

  logout(): void {
    safeStorage.removeItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY)
    window.location.replace('/')
  }
}

export const supabaseClient = new SupabaseService()
