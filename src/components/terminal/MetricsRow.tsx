/**
 * MetricsRow — Tokens / Win Streak / AI Consensus 3D Chiseled Summary Bar
 */

import type { PredictionResult } from '@/types'

interface MetricsRowProps {
  tokensBalance: number
  streak: number
  prediction: PredictionResult | null
}

function MetricBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-3 px-2 rounded-[14px] text-center"
      style={{
        background: 'linear-gradient(180deg, #0e1219 0%, #06080c 100%)',
        border: '1px solid #2e384d',
        borderTop: '1px solid rgba(255, 255, 255, 0.18)',
        borderBottom: '2px solid #000000',
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#64748b] mb-1">
        {label}
      </span>
      <span className="text-[19px] font-black font-display leading-tight">{children}</span>
    </div>
  )
}

export function MetricsRow({ tokensBalance, streak, prediction }: MetricsRowProps) {
  const consensus = prediction ? `${Math.max(prediction.bigProb || 50, prediction.smallProb || 50)}%` : '--'

  return (
    <section className="grid grid-cols-3 gap-2.5">
      <MetricBox label="Tokens Left">
        <span className="text-[#fbbf24]">⚡ {tokensBalance}</span>
      </MetricBox>
      <MetricBox label="Win Streak">
        <span className="text-[#10b981]">{streak} 🔥</span>
      </MetricBox>
      <MetricBox label="AI Consensus">
        <span className="text-[#38bdf8]">{consensus}</span>
      </MetricBox>
    </section>
  )
}
