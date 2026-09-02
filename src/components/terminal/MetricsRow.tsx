/**
 * MetricsRow — Tokens / Win Streak / AI Consensus 3D Chiseled Summary Bar
 * Upgraded to match demo.html specification with 3-card chiseled grid and luminous values.
 */

import type { PredictionResult } from '@/types'

interface MetricsRowProps {
  tokensBalance: number
  streak: number
  prediction: PredictionResult | null
}

export function MetricsRow({ tokensBalance, streak, prediction }: MetricsRowProps) {
  const consensus = prediction
    ? `${Math.max(prediction.bigProb || 50, prediction.smallProb || 50)}%`
    : '--'

  return (
    <section className="grid grid-cols-3 gap-2.5">
      {/* Tokens Left */}
      <div className="metric-box metric-tokens">
        <span className="metric-label">
          Tokens Left
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

