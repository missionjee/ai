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

  const openTelegram = () => {
    window.open('https://t.me/hirotoaii', '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  const charCount = keyValue.length
  const maxCount = 14

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 token-modal-backdrop animate-fadeIn">
      {/* Click Outside Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-[20px] p-5 sm:p-6 flex flex-col gap-4 token-modal-card">
        {/* Header with Title & Close Button */}
        <div className="flex items-center justify-between pb-3 border-b token-modal-header">
          <div className="flex items-center gap-2.5">
            <span className="text-[18px]">🔑</span>
            <div>
              <h2 className="font-display font-black text-[15px] sm:text-[16px] tracking-[0.8px] leading-tight token-modal-title">
                REDEEM ACCESS KEY
              </h2>
              <span className="text-[9.5px] font-extrabold uppercase tracking-[1.4px] bg-gradient-to-r from-[#00ffcc] to-[#38bdf8] bg-clip-text text-transparent token-modal-subtitle">
                LICENSE KEY ACTIVATION
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all text-[12px] cursor-pointer token-modal-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Current Token Balance Indicator */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl token-modal-balance">
          <span className="text-[11px] font-bold uppercase tracking-wider token-modal-balance-label">
            Current Balance:
          </span>
          <span className="font-display text-[14px] font-black flex items-center gap-1.5 token-modal-balance-val">
            <span>⚡</span>
            <span>{tokensBalance} Tokens Remaining</span>
          </span>
        </div>

        {/* License Key Entry Form */}
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-[10.5px] font-extrabold uppercase tracking-[1px] token-modal-label-row">
            <span>Enter 12-Digit License Key</span>
            <span className="font-mono token-modal-charcount">{charCount} / {maxCount}</span>
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
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'w-full rounded-[12px] px-3.5 py-3 font-mono text-[16px] font-black tracking-[3px] text-center uppercase outline-none transition-all duration-200 token-modal-input',
              hasError && 'input-error'
            )}
          />

          {/* Action Button: REDEEM KEY */}
          <button
            onClick={handleRedeemKey}
            disabled={isLoading || keyValue.length < 14}
            className="w-full btn-copy-signal justify-center py-3 text-[13px] font-black tracking-[1px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-[0.98]"
          >
            <span>{isLoading ? '⏳' : '⚡'}</span>
            <span>{isLoading ? 'VERIFYING KEY...' : 'REDEEM KEY'}</span>
          </button>

          {/* Status Feedback Message */}
          {statusMsg && (
            <div
              className={cn(
                'text-[11.5px] text-center font-bold px-3 py-2 rounded-lg border transition-all animate-fadeIn',
                statusMsg.type === 'error' && 'text-[#fb7185] bg-[#fb7185]/10 border-[#fb7185]/30',
                statusMsg.type === 'success' && 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30',
                statusMsg.type === 'info' && 'text-[#00ffcc] bg-[#00ffcc]/10 border-[#00ffcc]/30'
              )}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Minimal Telegram Support / Purchase Link */}
        <div className="pt-2 border-t border-white/[0.07] text-center">
          <button
            onClick={openTelegram}
            className="text-[11px] font-bold text-[#38bdf8] hover:text-[#7dd3fc] transition-colors inline-flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0"
          >
            <span>Need an access key or tokens?</span>
            <span className="underline underline-offset-2">Contact @hirotoaii ↗</span>
          </button>
        </div>
      </div>
    </div>
  )
}
