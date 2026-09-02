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
        <footer className="system-footer">
          {deferredPwaPrompt && (
            <button
              onClick={installPwa}
              className="btn-pwa-install"
            >
              <span>📲</span>
              <span>Install Hiroto AI App (PWA)</span>
            </button>
          )}
          <div className="footer-info">
            <span>HIROTO AI</span>
            <span className="dot">•</span>
            <span>Single Device Locked</span>
            <span className="dot">•</span>
            <span>Quantum Engine v9.1</span>
          </div>
        </footer>
      </div>

      {/* Toast */}
      <Toast message={toast} />
    </div>
  )
}
