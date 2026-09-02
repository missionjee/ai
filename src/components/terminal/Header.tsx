/**
 * Header Component — AMOLED 3D tactile top bar with institutional branding & status indicator
 * Upgraded to match demo.html specification:
 * - Removed sign out button, speaker button, and reload button as instructed.
 * - Retains live feed status pill with ambient glowing beacon.
 * - Adds institutional version badge and gold subline.
 */

interface HeaderProps {
  isLiveFeed: boolean
  isResolving: boolean
  soundEnabled?: boolean
  deferredPwaPrompt?: Event | null
  onToggleSound?: () => void
  onSync?: () => void
  onLogout?: () => void
  onInstallPwa?: () => void
}

export function Header({
  isLiveFeed,
  isResolving,
}: HeaderProps) {
  const statusLabel = isResolving ? 'SYNCING' : isLiveFeed ? 'LIVE' : 'LOCAL'
  const isGreen = !isResolving && isLiveFeed

  return (
    <header className="top-header">
      {/* Brand Area */}
      <div className="flex items-center gap-3.5">
        <div className="brand-logo-wrap">
          <img src="/logo.jpg" alt="HIROTO AI" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-[20px] sm:text-[22px] text-white tracking-[1.2px] leading-none">
              HIROTO
            </h1>
            <span className="font-mono text-[10px] font-bold text-[#38bdf8] bg-[#38bdf8]/[0.12] border border-[#38bdf8]/[0.28] px-1.5 py-0.5 rounded">
              v9.1 PRO
            </span>
          </div>
          <span className="text-[10px] sm:text-[10.5px] font-extrabold tracking-[1.6px] uppercase bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] bg-clip-text text-transparent leading-tight">
            AI TERMINAL • INSTITUTIONAL
          </span>
        </div>
      </div>

      {/* Header Controls — Status Pill ONLY (sign out, speaker, and reload buttons removed) */}
      <div className="flex items-center">
        <div className={`status-pill ${isGreen ? '' : 'syncing'}`}>
          <span className="pulse-dot" />
          <span>{statusLabel}</span>
        </div>
      </div>
    </header>
  )
}

