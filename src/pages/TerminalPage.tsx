/**
 * Terminal Page — Main prediction dashboard
 * Replaces d.html + terminal.js — React + TypeScript + Tailwind
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTerminal } from '@/hooks/useTerminal'
import { useCountdown } from '@/hooks/useCountdown'
import { PeriodHelper } from '@/engine/periodHelper'
import { Header } from '@/components/terminal/Header'
import { MetricsRow } from '@/components/terminal/MetricsRow'
import { PredictionHero } from '@/components/terminal/PredictionHero'
import { HistoryTable } from '@/components/terminal/HistoryTable'
import { TokenModal } from '@/components/terminal/TokenModal'
import { Toast } from '@/components/ui/Toast'

export function TerminalPage() {
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
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

  const { prediction, tokensBalance, history, stats, isLiveFeed, isResolving, targetPeriod, activeFilter } = state
  const periodLabel = PeriodHelper.formatLast4(targetPeriod)

  const glowClass = !tokensBalance || tokensBalance <= 0
    ? 'glow-LOCKED'
    : prediction?.status === 'HOLD'
    ? 'glow-HOLD'
    : prediction?.isSniper
    ? 'glow-SNIPER'
    : prediction?.prediction === 'BIG'
    ? 'glow-BIG'
    : prediction?.prediction === 'SMALL'
    ? 'glow-SMALL'
    : ''

  return (
    <div className={cn('min-h-screen relative terminal-viewport', glowClass)}>
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

        {/* Metrics Row (Opens Token Packages & Key Redemption Dialog on Click) */}
        <MetricsRow
          tokensBalance={tokensBalance}
          streak={stats.streak}
          prediction={prediction}
          onClickTokens={() => setIsTokenModalOpen(true)}
        />

        {/* Prediction Hero */}
        <PredictionHero
          prediction={prediction}
          tokensBalance={tokensBalance}
          periodLabel={periodLabel}
          countdown={countdownFormatted}
          isUrgent={isUrgent}
          onCopy={copySignal}
          onUnlockTokens={() => setIsTokenModalOpen(true)}
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
            <span>Quantum Engine v9.3</span>
          </div>
        </footer>
      </div>

      {/* Inbuilt AI Token Packages & Key Redemption Dialog */}
      <TokenModal
        isOpen={isTokenModalOpen}
        tokensBalance={tokensBalance}
        onClose={() => setIsTokenModalOpen(false)}
        onRedeemed={manualSync}
      />

      {/* Toast */}
      <Toast message={toast} />
    </div>
  )
}
