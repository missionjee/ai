/**
 * Header Component — AMOLED 3D tactile top bar with institutional branding & controls
 */

import { cn } from '@/lib/utils'

interface HeaderProps {
  isLiveFeed: boolean
  isResolving: boolean
  soundEnabled: boolean
  deferredPwaPrompt: Event | null
  onToggleSound: () => void
  onSync: () => void
  onLogout: () => void
  onInstallPwa: () => void
}

export function Header({
  isLiveFeed,
  isResolving,
  soundEnabled,
  onToggleSound,
  onSync,
  onLogout,
}: HeaderProps) {
  const statusLabel = isResolving ? 'SYNCING' : isLiveFeed ? 'LIVE' : 'LOCAL'
  const isGreen = !isResolving && isLiveFeed

  return (
    <header
      className="flex justify-between items-center px-4 py-3.5 rounded-[18px]"
      style={{
        background: 'linear-gradient(180deg, #111622 0%, #080b11 100%)',
        border: '1px solid #2e384d',
        borderTop: '1px solid rgba(255,255,255,0.18)',
        borderBottom: '2px solid #000000',
        boxShadow: '0 10px 24px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-[52px] h-[52px] min-w-[52px] sm:w-[58px] sm:h-[58px] sm:min-w-[58px] rounded-[14px] overflow-hidden bg-black flex-shrink-0 flex items-center justify-center"
          style={{
            border: '1.5px solid #f59e0b',
            boxShadow: '0 6px 14px rgba(0,0,0,0.7)',
          }}
        >
          <img src="/logo.jpg" alt="HIROTO AI" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-display font-black text-[20px] sm:text-[22px] text-white tracking-[1.2px] leading-none">
            HIROTO
          </h1>
          <span className="text-[11px] font-extrabold text-[#f59e0b] tracking-[1.4px] uppercase mt-1">
            AI TERMINAL
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* 3D Status Pill */}
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[11px] font-bold border transition-colors',
            isGreen
              ? 'text-[#10b981] border-[#065f46] border-t-[#059669]'
              : 'text-[#38bdf8] border-[#1e3a8a] border-t-[#2563eb]'
          )}
          style={{
            background: isGreen
              ? 'linear-gradient(180deg, #062319 0%, #02110c 100%)'
              : 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            borderBottom: '2px solid #000000',
          }}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              isGreen ? 'bg-[#10b981] animate-pulse' : 'bg-[#38bdf8]'
            )}
          />
          {statusLabel}
        </div>

        {/* 3D Sound Toggle */}
        <button
          onClick={onToggleSound}
          className="btn-icon"
          title={soundEnabled ? 'Mute audio' : 'Enable audio'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>

        {/* 3D Force Sync */}
        <button
          onClick={onSync}
          className="btn-icon"
          title="Force sync"
        >
          🔄
        </button>

        {/* 3D Logout */}
        <button
          onClick={onLogout}
          className="btn-icon danger"
          title="Logout"
        >
          🚪
        </button>
      </div>
    </header>
  )
}
