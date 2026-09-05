/**
 * PredictionHero — Main prediction hero card with 3D tactile depth
 * Ported directly to match demo.html layout, typography, scanlines, and Sovereign Gold action button.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PredictionResult } from '@/types'

interface PredictionHeroProps {
  prediction: PredictionResult | null
  tokensBalance: number
  periodLabel: string
  countdown: string
  isUrgent: boolean
  onCopy: () => void
  onUnlockTokens?: () => void
}

export function PredictionHero({
  prediction,
  tokensBalance,
  periodLabel,
  countdown,
  isUrgent,
  onCopy,
  onUnlockTokens,
}: PredictionHeroProps) {
  const [isCopied, setIsCopied] = useState(false)
  const isLocked = tokensBalance <= 0
  const signalKey = isLocked ? 'LOCKED' : (prediction?.prediction === 'SMALL' ? 'SMALL' : 'BIG')
  const signalText = isLocked ? 'LOCKED' : (prediction?.prediction === 'SMALL' ? 'SMALL' : 'BIGGG')
  
  const signalRange =
    signalKey === 'BIG'
      ? '5 · 6 · 7 · 8 · 9'
      : signalKey === 'SMALL'
      ? '0 · 1 · 2 · 3 · 4'
      : isLocked
      ? '0 TOKENS AVAILABLE • RECHARGE KEY'
      : '5 · 6 · 7 · 8 · 9'

  const confidence = isLocked ? 0 : (prediction?.confidence || 0)
  const defaultLuckyBig = [7, 8]
  const defaultLuckySmall = [2, 3]
  let parsedRawDigits: [number, number] | null = null
  let candidateDigits: any = prediction?.luckyDigits || (prediction as any)?.lucky_digits
  if (typeof candidateDigits === 'string') {
    try {
      const p = JSON.parse(candidateDigits.replace(/^{/, '[').replace(/}$/, ']'))
      if (Array.isArray(p)) candidateDigits = p
    } catch {
      const match = candidateDigits.match(/\d+/g)
      if (match && match.length >= 2) candidateDigits = [match[0], match[1]]
    }
  }
  if (Array.isArray(candidateDigits) && candidateDigits.length >= 2 && candidateDigits[0] !== undefined && candidateDigits[1] !== undefined) {
    const d0 = Number(candidateDigits[0])
    const d1 = Number(candidateDigits[1])
    if (!isNaN(d0) && !isNaN(d1) && !(d0 === 0 && d1 === 0)) {
      parsedRawDigits = [d0, d1]
    }
  }

  const resolvedDigits: [number, number] = parsedRawDigits
    ? parsedRawDigits
    : (prediction?.prediction === 'BIG' ? defaultLuckyBig as [number, number] : defaultLuckySmall as [number, number])

  const luckyDigit1 = isLocked ? 'X' : (prediction ? resolvedDigits[0] : '-')
  const luckyDigit2 = isLocked ? 'X' : (prediction ? resolvedDigits[1] : '-')

  const handleCopy = () => {
    onCopy()
    if (prediction) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  return (
    <main className="prediction-hero" id="predictionHero">
      {/* Target Period & Countdown Header */}
      <div className="hero-top">
        <div className="period-badge-wrap">
          <span className="period-title">TARGET</span>
          <span className="period-num">{periodLabel}</span>
        </div>
        <div className="countdown-box">
          <span className="countdown-label">DRAW IN</span>
          <span className={cn('countdown-timer', isUrgent && 'urgent')}>
            {countdown}
          </span>
        </div>
      </div>

      {/* Main Prediction Banner */}
      <div className="hero-main-banner">
        <div className={cn('signal-banner', signalKey)}>
          <span className="signal-tag whitespace-nowrap overflow-hidden text-ellipsis max-w-full block">
            {isLocked && <span>🔒 SIGNAL LOCKED</span>}
            {!isLocked && (prediction?.tier === 'SNIPER' || prediction?.isSniper) && (
              <span>🎯 ULTRA-SNIPER [{prediction?.recommendedStake || '2U'}]</span>
            )}
            {!isLocked && (!prediction?.isSniper && prediction?.tier !== 'SNIPER') && prediction && (
              <span>⚡ QUANTUM STANDARD [{prediction?.recommendedStake || '1U'}]</span>
            )}
            {!isLocked && !prediction && (
              <span>⚡ SYNCING FEED...</span>
            )}
          </span>
          <span className="signal-text">{signalText}</span>
          <span className="signal-range">{signalRange}</span>
        </div>

        {/* Quick Details & Action */}
        {!isLocked && (
          <div className="signal-action-wrap">
            {/* Confidence Bar */}
            <div className="confidence-wrap">
              <div className="confidence-header">
                <span>Quantitative Model Confidence</span>
                <div className="flex items-center gap-2">
                  {prediction?.recommendedStake && prediction.status !== 'HOLD' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00ffcc]/10 text-[#00ffcc] border border-[#00ffcc]/30 stake-tag">
                      STAKE: {prediction.recommendedStake}
                    </span>
                  )}
                  <strong>{confidence}%</strong>
                </div>
              </div>
              <div className="confidence-track">
                <div
                  className="confidence-fill"
                  style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                />
              </div>
            </div>

            {/* Target Lucky Digits & Copy Button Row */}
            <div className="action-bar-row">
              <div className="lucky-digits-box">
                <span className="lucky-label">LUCKY DIGITS</span>
                <div className="digits-group">
                  <span className="digit-chip primary">{luckyDigit1}</span>
                  <span className="digit-chip secondary">{luckyDigit2}</span>
                </div>
              </div>

              <button
                onClick={handleCopy}
                className={cn('btn-copy-signal', isCopied && 'copied')}
              >
                <span>{isCopied ? '✓' : '📋'}</span>
                <span>{isCopied ? 'COPIED!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Button When Locked */}
        {isLocked && (
          <div className="signal-action-wrap mt-2">
            <button
              onClick={onUnlockTokens}
              className="w-full btn-copy-signal justify-center py-3 text-[13px] font-black tracking-[0.8px]"
            >
              <span>🔑</span>
              <span>REDEEM ACCESS KEY</span>
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

