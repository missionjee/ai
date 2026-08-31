/**
 * PredictionHero — Main prediction banner card with 3D tactile depth
 * Faithfully ports original AMOLED styling: Corporate Crimson for BIG, Deep Sapphire for SMALL,
 * sunken countdown pod, chiseled lucky digit chips, and Sovereign Gold 3D copy button.
 */

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
  const isLocked = tokensBalance <= 0
  const signalKey = isLocked ? 'LOCKED' : (prediction?.prediction || 'HOLD')

  const signalText = isLocked ? 'LOCKED' : (prediction?.prediction || 'HOLD')
  const signalRange =
    signalKey === 'BIG'
      ? '5 · 6 · 7 · 8 · 9'
      : signalKey === 'SMALL'
      ? '0 · 1 · 2 · 3 · 4'
      : isLocked
      ? '0 TOKENS AVAILABLE • RECHARGE KEY'
      : 'EVALUATING REGIME...'

  const confidence = isLocked ? 0 : (prediction?.confidence || 0)
  const luckyDigit1 = isLocked ? 'X' : (prediction?.luckyDigits?.[0] ?? '-')
  const luckyDigit2 = isLocked ? 'X' : (prediction?.luckyDigits?.[1] ?? '-')

  return (
    <main
      className="rounded-[20px] p-4 sm:p-5 flex flex-col gap-4"
      style={{
        background: 'linear-gradient(180deg, #0d1117 0%, #05070a 100%)',
        border: '1px solid #2e384d',
        borderTop: '1px solid rgba(255,255,255,0.18)',
        borderBottom: '3px solid #000000',
        boxShadow: '0 16px 36px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Period & Sunken Countdown Box */}
      <div className="flex justify-between items-center pb-3 border-b border-[#1e2532]">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-[10px] font-extrabold uppercase tracking-[1px] text-[#64748b] bg-white/[0.04] px-2 py-1 rounded border border-[#1e293b]">
            TARGET
          </span>
          <span className="font-mono text-[18px] sm:text-[21px] font-extrabold text-white tracking-[0.5px]">
            {periodLabel}
          </span>
        </div>

        {/* 3D Sunken Countdown Pod */}
        <div className="countdown-pod">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">
            DRAW IN
          </span>
          <span
            className={cn(
              'font-mono text-[18px] sm:text-[19px] font-extrabold tracking-[1px] transition-colors',
              isUrgent ? 'text-[#f43f5e] animate-pulse' : 'text-[#38bdf8]'
            )}
          >
            {countdown}
          </span>
        </div>
      </div>

      {/* Main 3D Tactile Signal Slab */}
      <div
        className={cn(
          'rounded-[16px] p-4 sm:p-5 flex flex-col items-center justify-center gap-1.5 text-center transition-all duration-250 relative',
          signalKey === 'BIG' && 'signal-slab-big',
          signalKey === 'SMALL' && 'signal-slab-small',
          (signalKey === 'LOCKED' || signalKey === 'HOLD') && 'signal-slab-locked'
        )}
      >
        {/* Signal Tag / Reasoning */}
        <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[1.2px] mb-1">
          {isLocked && <span className="text-[#64748b]">SIGNAL LOCKED</span>}
          {!isLocked && prediction?.status === 'HOLD' && (
            <span className="text-[#f59e0b] font-bold">
              ⚠️ {prediction?.statusReason ? prediction.statusReason.toUpperCase() : 'CAUTION • HIGH CHOP ZONE [PASS]'}
            </span>
          )}
          {!isLocked && prediction?.isSniper && (
            <span className="text-[#10b981] font-extrabold">
              🎯 SNIPER CONFLUENCE ({prediction.confidence}%)
            </span>
          )}
          {!isLocked && prediction?.status === 'CLEARED' && !prediction?.isSniper && (
            <span className="text-[#94a3b8]">RECOMMENDED SIGNAL</span>
          )}
          {!isLocked && !prediction && (
            <span className="text-[#64748b]">SYNCHRONIZING EDGE FEED...</span>
          )}
        </div>

        {/* Signal Text */}
        <div
          className={cn(
            'font-display font-black tracking-[3px] leading-none text-center',
            signalKey === 'BIG' && 'text-[46px] sm:text-[52px] text-[#fb7185] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]',
            signalKey === 'SMALL' && 'text-[46px] sm:text-[52px] text-[#38bdf8] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]',
            (signalKey === 'LOCKED' || signalKey === 'HOLD') && 'text-[28px] sm:text-[32px] text-[#64748b]'
          )}
        >
          {signalText}
        </div>

        {/* Signal Range */}
        {signalRange && (
          <div className="font-mono text-[12px] font-bold text-[#94a3b8] tracking-[1.2px] mt-1">
            {signalRange}
          </div>
        )}
      </div>

      {/* Confidence Bar & Lucky Digits Action Bar */}
      {!isLocked && (
        <div className="flex flex-col gap-3">
          {/* Recessed Confidence Bar */}
          <div className="flex flex-col gap-1.5 bg-[#06090e] border border-[#1e2532] rounded-[12px] p-2.5 sm:p-3">
            <div className="flex justify-between items-center text-[11px] font-bold text-[#94a3b8]">
              <span>Model Confidence</span>
              <strong className="text-white font-mono">{confidence}%</strong>
            </div>
            <div className="w-full h-2 rounded-[6px] bg-[#020406] border border-[#1e293b] overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)]">
              <div
                className="h-full rounded-[4px] transition-all duration-500"
                style={{
                  width: `${confidence}%`,
                  background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
                }}
              />
            </div>
          </div>

          {/* Action Bar: Lucky Digits + Sovereign Gold Copy Button */}
          <div
            className="flex items-center justify-between gap-2.5 rounded-[14px] p-2.5 sm:p-3"
            style={{
              background: 'linear-gradient(180deg, #0e1219 0%, #07090d 100%)',
              border: '1px solid #2e384d',
              borderTop: '1px solid rgba(255,255,255,0.18)',
              borderBottom: '2px solid #000000',
              boxShadow: '0 6px 14px rgba(0,0,0,0.5)',
            }}
          >
            {/* Lucky Digits */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">
                LUCKY
              </span>
              <div className="flex gap-1.5">
                <span className="w-8 h-8 rounded-[8px] flex items-center justify-center font-mono text-[14px] font-extrabold digit-chip-primary">
                  {luckyDigit1}
                </span>
                <span className="w-8 h-8 rounded-[8px] flex items-center justify-center font-mono text-[14px] font-extrabold digit-chip-secondary">
                  {luckyDigit2}
                </span>
              </div>
            </div>

            {/* Sovereign Gold 3D Action Button */}
            <button
              onClick={onCopy}
              className="btn-gold px-3.5 py-2 sm:px-4 sm:py-2.5 text-[12px] flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Copy Signal</span>
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
