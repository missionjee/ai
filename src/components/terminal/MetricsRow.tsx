/**
 * MetricsRow — Tokens / Win Streak / AI Consensus 3D Chiseled Summary Bar
 * Upgraded to match demo.html specification with 3-card chiseled grid and luminous values.
 */

import type { PredictionResult } from '@/types'

interface MetricsRowProps {
  tokensBalance: number
  streak: number
  prediction: PredictionResult | null
  onClickTokens?: () => void
}

export function MetricsRow({ tokensBalance, streak, prediction, onClickTokens }: MetricsRowProps) {
  const consensus = prediction
    ? `${Math.max(prediction.bigProb || 50, prediction.smallProb || 50)}%`
    : '--'

  return (
    <section className="grid grid-cols-3 gap-2.5">
      {/* Tokens Left (Interactive Trigger for Token Packages & Key Redemption) */}
      <div
        onClick={onClickTokens}
        role={onClickTokens ? 'button' : undefined}
        tabIndex={onClickTokens ? 0 : undefined}
        className="metric-box metric-tokens cursor-pointer select-none group transition-transform active:scale-95"
        title="Click to View Token Packages & Redeem Key"
      >
        <span className="metric-label flex items-center justify-center gap-1 group-hover:text-[#f59e0b] transition-colors">
          Tokens Left ↗
        </span>
        <span className="font-display text-[20px] sm:text-[22px] font-black leading-none flex items-center justify-center gap-1 text-[#fbbf24] metric-value">
          <span className="text-[14px]">⚡</span>
          <span>{tokensBalance}</span>
        </span>
      </div>

      {/* Win Streak */}
      <div className="metric-box metric-streak">
        <span className="metric-label">
          Win Streak
        </span>
        <span className="font-display text-[20px] sm:text-[22px] font-black leading-none flex items-center justify-center gap-1 text-[#34d399] metric-value">
          <span>{streak}</span>
          <span className="text-[14px]">🔥</span>
        </span>
      </div>

      {/* AI Consensus */}
      <div className="metric-box metric-consensus">
        <span className="metric-label">
          AI Consensus
        </span>
        <span className="font-display text-[20px] sm:text-[22px] font-black leading-none text-[#38bdf8] metric-value">
          {consensus}
        </span>
      </div>
    </section>
  )
}

