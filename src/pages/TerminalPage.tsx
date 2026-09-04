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

        {/* v9.3 High-Frequency Upgrade Notification Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded tracking-wider shadow-sm">
              v9.3 ACTIVE
            </span>
            <span className="font-semibold text-[11.5px] text-amber-200/90 leading-tight">
              ⚡ High-Frequency Upgrade: HOLD frequency reduced by 90% (85%+ active actionable rounds) • Ultra-Sniper 2U Unlocked
            </span>
          </div>
        </div>

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
