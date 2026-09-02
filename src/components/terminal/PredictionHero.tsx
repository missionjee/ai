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
}

export function PredictionHero({
  prediction,
  tokensBalance,
  periodLabel,
  countdown,
  isUrgent,
  onCopy,
}: PredictionHeroProps) {
  const [isCopied, setIsCopied] = useState(false)
  const isLocked = tokensBalance <= 0
  const signalKey = isLocked ? 'LOCKED' : (prediction?.prediction || 'HOLD')
  const signalText = isLocked ? 'LOCKED' : (prediction?.prediction === 'BIG' ? 'BIGGG' : (prediction?.prediction || 'HOLD'))
  
  const signalRange =
    signalKey === 'BIG'
      ? '5 · 6 · 7 · 8 · 9'
      : signalKey === 'SMALL'
      ? '0 · 1 · 2 · 3 · 4'
      : isLocked
      ? '0 TOKENS AVAILABLE • RECHARGE KEY'
      : 'EVALUATING REGIME...'

  const confidence = isLocked ? 0 : (prediction?.confidence || 0)
  const defaultLuckyBig = [7, 8]
  const defaultLuckySmall = [2, 3]
  const resolvedDigits = (Array.isArray(prediction?.luckyDigits) && prediction.luckyDigits.length >= 2 && prediction.luckyDigits[0] !== undefined && prediction.luckyDigits[1] !== undefined)
    ? prediction.luckyDigits
    : (prediction?.prediction === 'BIG' ? defaultLuckyBig : defaultLuckySmall)

  const luckyDigit1 = isLocked ? 'X' : (prediction ? resolvedDigits[0] : '-')
  const luckyDigit2 = isLocked ? 'X' : (prediction ? resolvedDigits[1] : '-')

  const handleCopy = () => {
    onCopy()
    if (prediction && prediction.prediction !== 'HOLD') {
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
          <span className="signal-tag">
            {isLocked && <span>🔒 SIGNAL LOCKED</span>}
            {!isLocked && prediction?.status === 'HOLD' && (
              <span>⚠️ {prediction?.statusReason ? prediction.statusReason.toUpperCase() : 'CAUTION • HIGH CHOP ZONE [PASS]'}</span>
            )}
            {!isLocked && prediction?.isSniper && (
              <span>🎯 SNIPER CONFLUENCE ({prediction.confidence}%)</span>
            )}
            {!isLocked && prediction?.status === 'CLEARED' && !prediction?.isSniper && (
              <span>⚡ QUANTUM SIGNAL ({confidence}%)</span>
            )}
            {!isLocked && !prediction && (
              <span>SYNCHRONIZING EDGE FEED...</span>
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
                <strong>{confidence}%</strong>
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
                <span>{isCopied ? 'COPIED!' : 'Copy Signal'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

