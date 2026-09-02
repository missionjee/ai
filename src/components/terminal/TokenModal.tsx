/**
 * TokenModal Component — Inbuilt AI Token Packages & License Key Redemption Modal
 * Opens on "Tokens Left" box click or unlock trigger.
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

  const openBuyWindow = () => {
    window.open('https://t.me/MISSION_JE', '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  const charCount = keyValue.length
  const maxCount = 14

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Click Outside Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div
        className="relative z-10 w-full max-w-[480px] max-h-[92vh] overflow-y-auto rounded-[22px] p-5 sm:p-6 flex flex-col gap-4 text-white custom-scrollbar"
        style={{
          background: 'linear-gradient(180deg, #141c2c 0%, #0c121e 40%, #05080f 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderTop: '1.5px solid rgba(255, 255, 255, 0.32)',
          borderBottom: '5px solid #000000',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.95), 0 6px 18px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header with Title & Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <span className="text-[20px]">⚡</span>
            <div>
              <h2 className="font-display font-black text-[16px] sm:text-[17px] text-white tracking-[0.8px] leading-tight">
                AI TOKEN PACKAGES
              </h2>
              <span className="text-[10px] font-extrabold uppercase tracking-[1.4px] bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] bg-clip-text text-transparent">
                INSTITUTIONAL ACCESS & REDEEM
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] flex items-center justify-center text-[#94a3b8] hover:text-white transition-all"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Token Balance Indicator */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#04070d] border border-white/[0.08] shadow-inner">
          <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">
            Current Balance:
          </span>
          <span className="font-display text-[15px] font-black text-[#fbbf24] flex items-center gap-1">
            <span>⚡</span>
            <span>{tokensBalance} Tokens Remaining</span>
          </span>
        </div>

        {/* AI Token Packages Image Preview */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#cbd5e1]">
            <span>Official Token Packages</span>
            <button
              onClick={openPackagesWindow}
              className="text-[10.5px] font-bold text-[#38bdf8] hover:text-[#7dd3fc] flex items-center gap-1 underline underline-offset-2"
            >
              <span>↗ Open Fullscreen Image</span>
            </button>
          </div>

          <div
            onClick={openPackagesWindow}
            className="relative rounded-xl overflow-hidden border border-white/[0.12] border-t-white/[0.22] shadow-[0_8px_20px_rgba(0,0,0,0.8)] cursor-pointer group transition-all duration-200 hover:border-[#f59e0b]"
          >
            <img
              src="/Neon%20Hiroto%20AI%20Token%20Packages.png"
              alt="Neon Hiroto AI Token Packages"
              className="w-full h-auto object-cover max-h-[190px] sm:max-h-[220px] transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center p-2.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <span className="text-[10.5px] font-bold text-white bg-black/70 px-3 py-1 rounded-full border border-white/[0.15] backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                <span>🔍</span> Tap to Expand Packages in New Tab
              </span>
            </div>
          </div>
        </div>

        {/* Buy Token Packages Button (Opens in New Window) */}
        <button
          onClick={openBuyWindow}
          className="w-full rounded-xl py-3 text-[13px] font-extrabold flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-110 active:translate-y-0.5"
          style={{
            background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 60%, #075985 100%)',
            borderTop: '1.5px solid #7dd3fc',
            borderBottom: '3.5px solid #082f49',
            color: '#ffffff',
            boxShadow: '0 6px 18px rgba(2, 132, 199, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
          }}
        >
          <span>🛒</span>
          <span>GET PACKAGES / CONTACT ADMIN (NEW WINDOW)</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-0.5">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[10px] font-extrabold uppercase tracking-[1.4px] text-[#64748b]">
            OR REDEEM ACCESS KEY
          </span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* License Key Entry Section */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-[1px] text-[#94a3b8]">
            <span>Enter 12-Digit License Key</span>
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
              'w-full rounded-[12px] px-4 py-3 font-mono text-[16px] font-black text-white tracking-[2px] text-center uppercase outline-none transition-all duration-200',
              'bg-[#020408]',
              hasError
                ? 'border border-[#e11d48] border-b-[#e11d48] border-b-2'
                : 'border border-[#1e293b] border-t-[#0a0d14] border-b-2 border-b-[#334155] focus:border-[#f5b335] focus:border-b-[#f5b335] focus:bg-[#06090d]',
              'placeholder:text-[#475569] placeholder:text-[13px] placeholder:tracking-[1px] placeholder:normal-case placeholder:font-normal',
              'shadow-[inset_0_2px_6px_rgba(0,0,0,0.95)]'
            )}
          />

          {/* 3D Gold Action Button */}
          <button
            onClick={handleRedeemKey}
            disabled={isLoading}
            className="w-full btn-copy-signal justify-center py-3 text-[13px] tracking-[0.8px] mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? '⏳' : '⚡'}</span>
            <span>{isLoading ? 'VERIFYING KEY...' : 'REDEEM & ACTIVATE KEY'}</span>
          </button>

          {/* Status Message */}
          {statusMsg && (
            <p
              className={cn(
                'mt-1 text-[11.5px] text-center font-bold',
                statusMsg.type === 'error' && 'text-[#fb7185]',
                statusMsg.type === 'success' && 'text-[#34d399]',
                statusMsg.type === 'info' && 'text-[#f5b335]'
              )}
            >
              {statusMsg.text}
            </p>
          )}
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.08]">
          {[
            { icon: '⚡', label: '1 Token = 1 Round' },
            { icon: '🔒', label: 'Single Device Locked' },
            { icon: '🎯', label: 'Quantum Engine v9.1' },
            { icon: '🚀', label: 'Instant Auto-Sync' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-[10px] text-[#94a3b8] font-bold rounded-lg px-2 py-1.5 bg-white/[0.02] border border-white/[0.05]"
            >
              <span className="text-[#f5b335]">{icon}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
