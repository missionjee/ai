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
      <div className="metric-box">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#64748b] mb-1">
          Tokens Left
        </span>
        <span className="font-display text-[20px] sm:text-[21px] font-black leading-none flex items-center justify-center gap-1 text-[#fbbf24] drop-shadow-[0_0_14px_rgba(245,158,11,0.22)]">
          <span className="text-[15px]">⚡</span>
          <span>{tokensBalance}</span>
        </span>
      </div>

      {/* Win Streak */}
      <div className="metric-box">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#64748b] mb-1">
          Win Streak
        </span>
        <span className="font-display text-[20px] sm:text-[21px] font-black leading-none flex items-center justify-center gap-1 text-[#34d399] drop-shadow-[0_0_14px_rgba(16,185,129,0.2)]">
          <span>{streak}</span>
          <span className="text-[15px]">🔥</span>
        </span>
      </div>

      {/* AI Consensus */}
      <div className="metric-box">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#64748b] mb-1">
          AI Consensus
        </span>
        <span className="font-display text-[20px] sm:text-[21px] font-black leading-none text-[#38bdf8] drop-shadow-[0_0_14px_rgba(56,189,248,0.28)]">
          {consensus}
        </span>
      </div>
    </section>
  )
}

