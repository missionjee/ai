/**
 * Login / Access Gateway Page
 * Replaces index.html — React + TypeScript + Tailwind
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseClient } from '@/services/supabase'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const navigate = useNavigate()
  const [keyValue, setKeyValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null)
  const [hasError, setHasError] = useState(false)
  const [existingSession, setExistingSession] = useState<string | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)

  // Check for existing active session
  useEffect(() => {
    const session = supabaseClient.getSession()
    if (session?.key && session?.tokens_balance > 0) {
      setExistingSession(session.key)
    }
  }, [])

  // Check for multi-device logout reason in query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'multi_device') {
      setStatusMsg({ text: 'Logged out: Account accessed from another device.', type: 'error' })
    }
  }, [])

  // PWA Install prompt listener
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const formatKey = useCallback((raw: string): string => {
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12)
    const parts: string[] = []
    for (let i = 0; i < cleaned.length; i += 4) parts.push(cleaned.slice(i, i + 4))
    return parts.join('-')
  }, [])

  const handleKeyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatKey(e.target.value)
    setKeyValue(formatted)
    setHasError(false)
    setStatusMsg(null)
  }

  const verifyKey = useCallback(async () => {
    const KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
    if (!KEY_PATTERN.test(keyValue)) {
      setHasError(true)
      setStatusMsg({ text: 'Please enter a valid 12-digit key (XXXX-XXXX-XXXX)', type: 'error' })
      return
    }

    setIsLoading(true)
    setStatusMsg({ text: 'Binding device and verifying tokens in Supabase...', type: 'info' })

    try {
      const result = await supabaseClient.loginWithKey(keyValue)
      if (result.success) {
        setStatusMsg({ text: '✓ Access Granted! Entering Terminal...', type: 'success' })
        setTimeout(() => {
          navigate('/terminal', { replace: true })
        }, 500)
      } else {
        setHasError(true)
        setStatusMsg({ text: result.message || 'Authentication failed. Please check your key.', type: 'error' })
      }
    } catch {
      setHasError(true)
      setStatusMsg({ text: 'Network error connecting to database.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [keyValue, navigate])

  const installPwa = useCallback(async () => {
    if (!deferredPrompt) return
    ;(deferredPrompt as BeforeInstallPromptEvent).prompt()
    const { outcome } = await (deferredPrompt as BeforeInstallPromptEvent).userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }, [deferredPrompt])

  const charCount = keyValue.length
  const maxCount = 14

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 relative overflow-x-hidden">
      {/* Login Card Container */}
      <div className="relative z-10 w-full max-w-[420px]">
        <div
          className="rounded-[20px] p-[34px_26px] relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0e1219 0%, #06080c 100%)',
            border: '1px solid #263143',
            borderTop: '1px solid rgba(255,255,255,0.18)',
            borderBottom: '3px solid #000000',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Brand */}
          <div className="text-center mb-6">
            <div
              className="w-[62px] h-[62px] mx-auto mb-[14px] rounded-[16px] overflow-hidden bg-black flex items-center justify-center"
              style={{
                border: '1px solid #f5b335',
                boxShadow: '0 6px 16px rgba(0,0,0,0.7)',
              }}
            >
              <img src="/logo.jpg" alt="HIROTO AI" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-display font-black text-[22px] tracking-[1.2px] text-white mb-1">
              HIROTO AI
            </h1>
            <p className="text-[11px] text-[#f5b335] font-extrabold tracking-[0.8px]">
              INSTITUTIONAL SIGNAL GATEWAY
            </p>
          </div>

          {/* Device Guard Badge */}
          <div
            className="flex items-center justify-center gap-1.5 mx-auto mb-5 rounded-lg px-3.5 py-1.5 text-[11px] font-bold text-[#10b981] w-fit"
            style={{
              background: 'linear-gradient(180deg, #062319 0%, #02110c 100%)',
              border: '1px solid #065f46',
              borderTop: '1px solid #059669',
              borderBottom: '2px solid #000000',
            }}
          >
            <span>🔒</span> Single-Device Security Active
          </div>

          {/* Key Input */}
          <div className="mb-[18px]">
            <div className="flex justify-between items-center text-[11px] font-extrabold uppercase tracking-[1px] text-[#94a3b8] mb-2">
              <span>License Access Key</span>
              <span className="font-mono text-[#f5b335]">{charCount} / {maxCount}</span>
            </div>
            <input
              type="text"
              value={keyValue}
              onChange={handleKeyInput}
              onKeyDown={e => {
                if (e.key === 'Enter') verifyKey()
              }}
              placeholder="XXXX-XXXX-XXXX"
              maxLength={14}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'w-full rounded-[12px] px-4 py-[14px] font-mono text-[17px] font-extrabold text-white tracking-[2px] text-center uppercase outline-none transition-all duration-200',
                'bg-[#030507]',
                hasError
                  ? 'border border-[#e11d48] border-b-[#e11d48] border-b-2'
                  : 'border border-[#1e293b] border-t-[#0a0d14] border-b-2 border-b-[#334155] focus:border-[#f5b335] focus:border-b-[#f5b335] focus:bg-[#06090d]',
                'placeholder:text-[#64748b] placeholder:text-[13px] placeholder:tracking-[1px] placeholder:normal-case placeholder:font-normal',
                'shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)]'
              )}
            />
          </div>

          {/* 3D Gold Submit Button */}
          <button
            onClick={verifyKey}
            disabled={isLoading}
            className="w-full btn-gold py-[14px] text-[14px] tracking-[1px] flex items-center justify-center gap-2 mt-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'AUTHENTICATING...' : 'AUTHENTICATE KEY'}
          </button>

          {/* Status Message */}
          {statusMsg && (
            <p
              className={cn(
                'mt-3.5 text-[12px] text-center font-bold',
                statusMsg.type === 'error' && 'text-[#fb7185]',
                statusMsg.type === 'success' && 'text-[#10b981]',
                statusMsg.type === 'info' && 'text-[#f5b335]'
              )}
            >
              {statusMsg.text}
            </p>
          )}

          {/* Resume Session */}
          {existingSession && (
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/terminal')}
                className="w-full rounded-[10px] px-4 py-2.5 text-[12px] font-bold text-white transition-all hover:brightness-110"
                style={{
                  background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                  border: '1px solid #334155',
                  borderTop: '1px solid #475569',
                  borderBottom: '2px solid #000',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                }}
              >
                Resume Active Session →
              </button>
            </div>
          )}

          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-2 mt-[22px] pt-[18px] border-t border-[#1e293b]">
            {[
              { icon: '⚡', label: '1 Token = 1 Round' },
              { icon: '🔒', label: 'Anti-Multi Device' },
              { icon: '🎯', label: 'Real-time Sync' },
              { icon: '📱', label: 'PWA Standalone' },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[11px] text-[#94a3b8] font-semibold rounded-lg px-2.5 py-1.5"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid #1e2533',
                }}
              >
                <span className="text-[#f5b335]">{icon}</span> {label}
              </div>
            ))}
          </div>

          {/* PWA Install Button */}
          {deferredPrompt && (
            <button
              onClick={installPwa}
              className="w-full mt-4 rounded-[12px] py-[11px] text-[12px] font-extrabold flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-115 hover:-translate-y-px"
              style={{
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid #38bdf8',
                borderTop: '1px solid #7dd3fc',
                borderBottom: '2px solid #0369a1',
                color: '#38bdf8',
                boxShadow: '0 4px 15px rgba(56,189,248,0.15)',
              }}
            >
              <span>📲 Install Hiroto AI App (PWA)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
