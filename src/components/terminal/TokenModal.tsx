/**
 * TokenModal Component — Inbuilt AI Token Packages & License Key Redemption Modal
 * Matches main dashboard dark tinted glass design system.
 */

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { supabaseClient } from '@/services/supabase'

interface TokenModalProps {
  isOpen: boolean
  tokensBalance: number
  onClose: () => void
  onRedeemed?: () => void
}

export function TokenModal({ isOpen, tokensBalance, onClose, onRedeemed }: TokenModalProps) {
  const [keyValue, setKeyValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null)
  const [hasError, setHasError] = useState(false)

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setKeyValue('')
      setStatusMsg(null)
      setHasError(false)
    }
  }, [isOpen])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

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

  const handleRedeemKey = async () => {
    const KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
    if (!KEY_PATTERN.test(keyValue)) {
      setHasError(true)
      setStatusMsg({ text: 'Please enter a valid 12-digit key (XXXX-XXXX-XXXX)', type: 'error' })
      return
    }

    setIsLoading(true)
    setStatusMsg({ text: 'Verifying key and binding device...', type: 'info' })

    try {
      const result = await supabaseClient.loginWithKey(keyValue)
      if (result.success) {
        const bal = result.session?.tokens_balance ?? supabaseClient.getTokenBalance()
        setStatusMsg({ text: `✓ Key Activated! ${bal} tokens credited.`, type: 'success' })
        if (onRedeemed) onRedeemed()
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setHasError(true)
        setStatusMsg({ text: result.message || 'Invalid key or key expired.', type: 'error' })
      }
    } catch {
      setHasError(true)
      setStatusMsg({ text: 'Database connection failed. Please retry.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const openPackagesWindow = () => {
    window.open('/Neon%20Hiroto%20AI%20Token%20Packages.png', '_blank', 'noopener,noreferrer')
  }

  const openTelegram = () => {
    window.open('https://t.me/hirotoaii', '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  const charCount = keyValue.length
  const maxCount = 14

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Click Outside Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card (Dark Tinted Glass Aesthetic) */}
      <div
        className="relative z-10 w-full max-w-[460px] max-h-[94vh] overflow-y-auto rounded-[20px] p-4 sm:p-5 flex flex-col gap-3.5 text-white custom-scrollbar"
        style={{
          background: 'rgba(10, 14, 22, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Header with Title & Close Button */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <span className="text-[17px]">⚡</span>
            <div>
              <h2 className="font-display font-black text-[15px] sm:text-[16px] text-white tracking-[0.8px] leading-tight">
                AI TOKEN PACKAGES
              </h2>
              <span className="text-[9.5px] font-extrabold uppercase tracking-[1.4px] bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] bg-clip-text text-transparent">
                INSTITUTIONAL ACCESS & REDEMPTION
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#94a3b8] hover:text-white transition-all text-[12px]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Token Balance Indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-wider">
            Current Balance:
          </span>
          <span className="font-display text-[14px] font-black text-[#fbbf24] flex items-center gap-1">
            <span>⚡</span>
            <span>{tokensBalance} Tokens Remaining</span>
          </span>
        </div>

        {/* Compact AI Token Packages Image */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold uppercase tracking-wider text-[#cbd5e1]">
            <span>Official Packages</span>
            <button
              onClick={openPackagesWindow}
              className="text-[10px] font-bold text-[#38bdf8] hover:text-[#7dd3fc] flex items-center gap-1 underline underline-offset-2"
            >
              <span>↗ Expand in New Tab</span>
            </button>
          </div>

          <div
            onClick={openPackagesWindow}
            className="relative rounded-xl overflow-hidden border border-white/[0.08] border-t-white/[0.16] shadow-[0_4px_14px_rgba(0,0,0,0.6)] cursor-pointer group transition-all duration-200 hover:border-[#f59e0b]/50 bg-black/50"
          >
            <img
              src="/Neon%20Hiroto%20AI%20Token%20Packages.png"
              alt="Neon Hiroto AI Token Packages"
              className="w-full h-auto object-cover max-h-[125px] sm:max-h-[135px] transition-transform duration-300 group-hover:scale-[1.01]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center p-2 opacity-80 group-hover:opacity-100 transition-opacity">
              <span className="text-[9.5px] font-bold text-white bg-black/75 px-2.5 py-0.5 rounded-full border border-white/[0.1] backdrop-blur-sm flex items-center gap-1">
                <span>🔍</span> Tap to view full size
              </span>
            </div>
          </div>
        </div>

        {/* Simple Telegram Text Action Button */}
        <button
          onClick={openTelegram}
          className="w-full py-2.5 px-3 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-2 text-[#38bdf8] hover:text-white bg-[#38bdf8]/[0.08] hover:bg-[#38bdf8]/[0.18] border border-[#38bdf8]/[0.25] border-t-[#38bdf8]/[0.4] transition-all duration-150 active:translate-y-0.5"
        >
          <span>✈</span>
          <span>Contact Telegram: @hirotoaii</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-0.5">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[9.5px] font-extrabold uppercase tracking-[1.4px] text-[#64748b]">
            ENTER ACCESS KEY
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* License Key Entry Section */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-[1px] text-[#94a3b8]">
            <span>12-Digit License Key</span>
            <span className="font-mono text-[#f5b335]">{charCount} / {maxCount}</span>
          </div>

          <input
            type="text"
            value={keyValue}
            onChange={handleKeyInput}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRedeemKey()
            }}
            placeholder="XXXX-XXXX-XXXX"
            maxLength={14}
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'w-full rounded-[11px] px-3.5 py-2.5 font-mono text-[15px] font-black text-white tracking-[2px] text-center uppercase outline-none transition-all duration-200',
              'bg-[#04060a]',
              hasError
                ? 'border border-[#e11d48] border-b-[#e11d48] border-b-2'
                : 'border border-white/[0.08] border-t-black/80 border-b-2 border-b-white/[0.15] focus:border-[#f5b335] focus:border-b-[#f5b335] focus:bg-[#06090d]',
              'placeholder:text-[#475569] placeholder:text-[12px] placeholder:tracking-[1px] placeholder:normal-case placeholder:font-normal',
              'shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)]'
            )}
          />

          {/* Action Button: REDEEM KEY Only */}
          <button
            onClick={handleRedeemKey}
            disabled={isLoading}
            className="w-full btn-copy-signal justify-center py-2.5 text-[12.5px] font-black tracking-[0.8px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? '⏳' : '⚡'}</span>
            <span>{isLoading ? 'VERIFYING KEY...' : 'REDEEM KEY'}</span>
          </button>

          {/* Status Message */}
          {statusMsg && (
            <p
              className={cn(
                'text-[11px] text-center font-bold',
                statusMsg.type === 'error' && 'text-[#fb7185]',
                statusMsg.type === 'success' && 'text-[#34d399]',
                statusMsg.type === 'info' && 'text-[#f5b335]'
              )}
            >
              {statusMsg.text}
            </p>
          )}
        </div>

        {/* 2 Prominent Redesigned Features: AI Accuracy & Quantum Engine */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/[0.07]">
          {/* Feature 1: Quantitative Accuracy */}
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] border-t-white/[0.12] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-[#38bdf8]">
              <span>🎯</span>
              <span>QUANTITATIVE ACCURACY</span>
            </div>
            <p className="text-[10px] text-[#94a3b8] leading-tight">
              Multi-model Exp3 Bandit ensemble with Platt probability calibration & Hurst memory forensics.
            </p>
          </div>

          {/* Feature 2: Quantum Engine & Safety Matrix */}
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] border-t-white/[0.12] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-[#34d399]">
              <span>🛡️</span>
              <span>ANTI-DRAWDOWN SHIELD</span>
            </div>
            <p className="text-[10px] text-[#94a3b8] leading-tight">
              Real-time dragon streak gating, volatility bounds & walk-forward backtest verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
