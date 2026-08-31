/**
 * Terminal Page — Main prediction dashboard
 * Replaces d.html + terminal.js — React + TypeScript + Tailwind
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseClient } from '@/services/supabase'
import { useTerminal } from '@/hooks/useTerminal'
import { useCountdown } from '@/hooks/useCountdown'
import { PeriodHelper } from '@/engine/periodHelper'
import { Header } from '@/components/terminal/Header'
import { MetricsRow } from '@/components/terminal/MetricsRow'
import { PredictionHero } from '@/components/terminal/PredictionHero'
import { HistoryTable } from '@/components/terminal/HistoryTable'
import { Toast } from '@/components/ui/Toast'

export function TerminalPage() {
  const navigate = useNavigate()
  const {
    state,
    toast,
    soundEnabled,
    deferredPwaPrompt,
    copySignal,
    toggleSound,
    setFilter,
    installPwa,
    manualSync,
    logout,
  } = useTerminal()

  const { formatted: countdownFormatted, isUrgent } = useCountdown()

  // Strict session check
  useEffect(() => {
    const session = supabaseClient.getSession()
    if (!session?.key || !session?.tokens_balance || session.tokens_balance <= 0) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const { prediction, tokensBalance, history, stats, isLiveFeed, isResolving, targetPeriod, activeFilter } = state
  const periodLabel = PeriodHelper.formatLast4(targetPeriod)

  return (
    <div className="min-h-screen relative">
      <div className="max-w-[740px] mx-auto px-3.5 py-4 pb-12 flex flex-col gap-3.5 relative z-10">
        {/* Header */}
        <Header
          isLiveFeed={isLiveFeed}
          isResolving={isResolving}
          soundEnabled={soundEnabled}
          deferredPwaPrompt={deferredPwaPrompt}
          onToggleSound={toggleSound}
          onSync={manualSync}
          onLogout={logout}
          onInstallPwa={installPwa}
        />

        {/* Metrics Row */}
        <MetricsRow
          tokensBalance={tokensBalance}
          streak={stats.streak}
          prediction={prediction}
        />

        {/* Prediction Hero */}
        <PredictionHero
          prediction={prediction}
          tokensBalance={tokensBalance}
          periodLabel={periodLabel}
          countdown={countdownFormatted}
          isUrgent={isUrgent}
          onCopy={copySignal}
        />

        {/* Draw History */}
        <HistoryTable
          history={history}
          activeFilter={activeFilter}
          onFilterChange={setFilter}
        />

        {/* Footer */}
        <footer className="flex flex-col items-center gap-3 pt-2">
          {deferredPwaPrompt && (
            <button
              onClick={installPwa}
              className="rounded-[12px] px-4 py-2.5 text-[12px] font-extrabold flex items-center gap-2 transition-all hover:brightness-115 hover:-translate-y-px active:translate-y-px"
              style={{
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid #38bdf8',
                borderTop: '1px solid #7dd3fc',
                borderBottom: '2px solid #0369a1',
                color: '#38bdf8',
                boxShadow: '0 4px 15px rgba(56,189,248,0.15)',
              }}
            >
              <span>📲</span>
              <span>Install Hiroto AI App (PWA)</span>
            </button>
          )}
          <p className="text-[11px] text-[#64748b] font-mono tracking-[0.5px]">
            HIROTO AI • Single Device Locked
          </p>
        </footer>
      </div>

      {/* Toast */}
      <Toast message={toast} />
    </div>
  )
}
