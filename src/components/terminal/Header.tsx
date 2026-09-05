/**
 * Header Component — AMOLED 3D tactile top bar with institutional branding & status indicator
 * Upgraded to match demo.html specification:
 * - Removed sign out button, speaker button, and reload button as instructed.
 * - Retains live feed status pill with ambient glowing beacon.
 * - Adds institutional version badge and gold subline.
 */

import { useState, useEffect } from 'react'

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

  const [isWhiteTheme, setIsWhiteTheme] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hiroto_theme') === 'white'
    }
    return false
  })

  useEffect(() => {
    if (isWhiteTheme) {
      document.documentElement.classList.add('theme-white')
      document.documentElement.setAttribute('data-theme', 'white')
      document.body.classList.add('theme-white')
      localStorage.setItem('hiroto_theme', 'white')
    } else {
      document.documentElement.classList.remove('theme-white')
      document.documentElement.setAttribute('data-theme', 'dark')
      document.body.classList.remove('theme-white')
      localStorage.setItem('hiroto_theme', 'dark')
    }
  }, [isWhiteTheme])

  const toggleTheme = () => {
    setIsWhiteTheme(prev => !prev)
  }

  return (
    <header className="top-header">
      {/* Brand Area */}
      <div className="flex items-center gap-3.5">
        <div className="brand-logo-wrap">
          <img src="/logo.jpg" alt="HIROTO AI" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-[20px] sm:text-[22px] tracking-[1.2px] leading-none brand-title">
              HIROTO
            </h1>
            <span className="font-mono text-[9px] font-semibold text-[#f59e0b] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded tracking-wider version-badge">
              v12.1 PRO
            </span>
          </div>
          <span className="text-[10px] sm:text-[10.5px] font-extrabold tracking-[1.6px] uppercase bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] bg-clip-text text-transparent leading-tight">
            AI TERMINAL • INSTITUTIONAL
          </span>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title={isWhiteTheme ? 'Switch to AMOLED Dark Theme' : 'Switch to White Theme'}
          aria-label="Toggle White Theme"
        >
          {isWhiteTheme ? '🌙' : '☀️'}
        </button>
        <div className={`status-pill ${isGreen ? '' : 'syncing'}`}>
          <span className="pulse-dot" />
          <span>{statusLabel}</span>
        </div>
      </div>
    </header>
  )
}

