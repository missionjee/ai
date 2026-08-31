/**
 * useTerminal — Main application state hook
 * Replaces all vanilla JS state management in terminal.js
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { PredictionEngine } from '@/engine/PredictionEngine'
import { PeriodHelper } from '@/engine/periodHelper'
import { SoundFx } from '@/engine/soundFx'
import { supabaseClient } from '@/services/supabase'
import type { AppState, FilterType, HistoryEntry, PredictionResult } from '@/types'

const API_LATEST = 'https://tirangaprediction.ai/api_fixed.php?action=latest_results&source=1M'
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
]
const STORAGE_HISTORY_KEY = 'hiroto_history_cache_v4'
const MAX_HISTORY = 100

// Singleton instances (persist across renders)
const engine = new PredictionEngine()
const sound = new SoundFx()

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY)
    return raw ? JSON.parse(raw) as HistoryEntry[] : []
  } catch { return [] }
}

function saveHistory(history: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch { /* noop */ }
}

async function fetchRemoteData(): Promise<{ data: HistoryEntry[] | null; isLive: boolean }> {
  const endpoints = [API_LATEST, PROXIES[0](API_LATEST), PROXIES[1](API_LATEST)]
  for (const url of endpoints) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3500)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return { data: data as HistoryEntry[], isLive: true }
    } catch { /* try next */ }
  }
  return { data: null, isLive: false }
}

export function useTerminal() {
  const [state, setState] = useState<AppState>({
    targetPeriod: null,
    prediction: null,
    history: [],
    stats: { streak: 0 },
    tokensBalance: supabaseClient.getTokenBalance(),
    isLiveFeed: false,
    isResolving: false,
    activeFilter: 'ALL',
    lastSettledPeriod: null,
  })

  const [toast, setToast] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled)
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const lastSecondRef = useRef(-1)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const calculateStreak = useCallback((history: HistoryEntry[]): number => {
    let streak = 0
    const resolved = history.filter(h => h.predicted_type && h.actual_result)
    for (const h of resolved) {
      const actual = String(h.actual_result).toUpperCase()
      const pred = String(h.predicted_type).toUpperCase()
      if (actual === pred) streak++; else break
    }
    return streak
  }, [])

  const syncCycle = useCallback(async () => {
    const localHistory = loadHistory()
    const { data: remoteData, isLive } = await fetchRemoteData()

    const historyMap = new Map<string, HistoryEntry>()
    localHistory.forEach(item => { if (item?.issue_number) historyMap.set(String(item.issue_number), item) })

    // Sync user predictions from Supabase ledger
    try {
      const ledger = await supabaseClient.getUserTakenPredictions(50)
      if (Array.isArray(ledger)) {
        ledger.forEach(entry => {
          if (!entry.period_number) return
          const k = String(entry.period_number)
          const existing = historyMap.get(k)
          if (existing) { if (!existing.predicted_type) existing.predicted_type = entry.prediction_type }
          else { historyMap.set(k, { issue_number: k, predicted_type: entry.prediction_type, prediction_confidence: 70, lucky_digits: [], actual_result: null, actual_number: null }) }
        })
      }
    } catch { /* offline */ }

    if (remoteData && remoteData.length > 0) {
      remoteData.forEach((item: HistoryEntry) => {
        if (!item.issue_number) return
        const k = String(item.issue_number)
        const actualType = (item.actual_result || (item.actual_number !== null && item.actual_number >= 5 ? 'big' : 'small')).toLowerCase()
        const actualNum = item.actual_number !== undefined && item.actual_number !== null && !isNaN(item.actual_number) ? item.actual_number : null
        const existing = historyMap.get(k)
        if (existing) { existing.actual_result = actualType; existing.actual_number = actualNum }
        else { historyMap.set(k, { issue_number: k, actual_result: actualType, actual_number: actualNum, predicted_type: null, prediction_confidence: null, lucky_digits: null }) }
      })
    }

    const sortedHistory = Array.from(historyMap.values()).sort((a, b) => {
      try { const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number); return aI > bI ? -1 : aI < bI ? 1 : 0 }
      catch { return b.issue_number.localeCompare(a.issue_number) }
    })

    const latestResolved = sortedHistory.find(h => h.actual_result !== null && h.actual_result !== undefined)
    const targetPeriod = latestResolved ? PeriodHelper.getNextPeriod(latestResolved.issue_number) : PeriodHelper.generateFallbackPeriod()

    const tokensBalance = supabaseClient.getTokenBalance()
    let currentTargetEntry = historyMap.get(String(targetPeriod))
    let prediction: PredictionResult | null = null

    if (!currentTargetEntry) {
      if (tokensBalance > 0) {
        const authResult = await supabaseClient.getAuthorizedPrediction(targetPeriod)
        if (authResult?.success && authResult.signal) {
          const s = authResult.signal
          prediction = {
            prediction: s.predicted_type as 'BIG' | 'SMALL',
            confidence: s.confidence,
            status: s.status as 'CLEARED' | 'HOLD' | 'SNIPER',
            statusReason: s.statusReason || '',
            luckyDigits: (s.lucky_digits as [number, number]) || [6, 7],
            strategy: s.strategy,
            reason: s.reason,
            bigProb: s.big_prob,
            smallProb: s.small_prob,
            regime: s.regime as 'trending' | 'mean-reverting' | 'mixed' | 'synchronizing',
            pattern: s.pattern,
            isSniper: s.is_sniper,
            digitProbs: {},
            volatility: '0.48',
            entropy: '0.50',
            permutationEntropy: '0.50',
            parityPrediction: 'EVEN',
            engineVersion: 'v8.1',
            modelPerformance: null,
          }
        }
      }

      if (!prediction && tokensBalance > 0) {
        const resolvedHistory = sortedHistory.filter(h => h.actual_result)
        const rawPred = engine.predict(resolvedHistory)
        const tokenRes = await supabaseClient.consumeToken(targetPeriod, rawPred.prediction)
        if (tokenRes?.success) prediction = rawPred
      }

      if (prediction) {
        currentTargetEntry = {
          issue_number: String(targetPeriod),
          predicted_type: prediction.prediction,
          prediction_confidence: prediction.confidence,
          lucky_digits: prediction.luckyDigits,
          actual_result: null,
          actual_number: null,
        }
        historyMap.set(String(targetPeriod), currentTargetEntry)
      }
    } else if (currentTargetEntry.predicted_type) {
      prediction = {
        prediction: currentTargetEntry.predicted_type as 'BIG' | 'SMALL',
        confidence: currentTargetEntry.prediction_confidence || 65,
        status: 'CLEARED',
        statusReason: '',
        luckyDigits: (currentTargetEntry.lucky_digits as [number, number]) || [6, 7],
        bigProb: currentTargetEntry.predicted_type === 'BIG' ? (currentTargetEntry.prediction_confidence || 65) : (100 - (currentTargetEntry.prediction_confidence || 65)),
        smallProb: currentTargetEntry.predicted_type === 'SMALL' ? (currentTargetEntry.prediction_confidence || 65) : (100 - (currentTargetEntry.prediction_confidence || 65)),
        strategy: 'Cache',
        reason: 'Restored from cache',
        isSniper: false,
        digitProbs: {},
        regime: 'mixed',
        pattern: '',
        volatility: '0.48',
        entropy: '0.50',
        permutationEntropy: '0.50',
        parityPrediction: 'EVEN',
        engineVersion: 'v8.1',
        modelPerformance: null,
      }
    }

    const finalHistory = Array.from(historyMap.values()).sort((a, b) => {
      try { const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number); return aI > bI ? -1 : aI < bI ? 1 : 0 }
      catch { return b.issue_number.localeCompare(a.issue_number) }
    })

    const finalTokens = supabaseClient.getTokenBalance()
    const streak = calculateStreak(finalHistory)

    saveHistory(finalHistory)

    setState(prev => ({
      ...prev,
      targetPeriod,
      prediction,
      history: finalHistory,
      stats: { streak },
      tokensBalance: finalTokens,
      isLiveFeed: isLive,
      isResolving: false,
    }))
  }, [calculateStreak])

  // Timer loop
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date()
      const seconds = PeriodHelper.getSecondsLeft(now)

      if (seconds === 60 || (seconds === 59 && lastSecondRef.current === 0)) {
        setState(prev => ({ ...prev, isResolving: true }))
        await syncCycle()
      } else if ([58, 56, 54].includes(seconds)) {
        setState(prev => {
          if (prev.isResolving) { syncCycle(); return { ...prev, isResolving: false } }
          return prev
        })
      }

      if (seconds % 10 === 0) supabaseClient.verifyDeviceSession()
      lastSecondRef.current = seconds
    }, 1000)

    return () => clearInterval(interval)
  }, [syncCycle])

  // PWA Install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPwaPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Visibility change re-sync
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === 'visible') await syncCycle()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [syncCycle])

  // Audio unlock
  useEffect(() => {
    const unlock = () => sound.unlockAudioContext()
    document.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('click', unlock, { passive: true })
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
  }, [])

  // Initial sync
  useEffect(() => {
    syncCycle()
  }, [syncCycle]) // eslint-disable-line react-hooks/exhaustive-deps

  const copySignal = useCallback(() => {
    const { prediction, targetPeriod } = state
    if (!prediction || !targetPeriod) { showToast('No active signal to copy'); return }
    const period4 = PeriodHelper.formatLast4(targetPeriod)
    const digits = prediction.luckyDigits?.join(', ') ?? '-'
    const tag = prediction.isSniper ? ' [🎯 SNIPER]' : prediction.status === 'HOLD' ? ' [HOLD]' : ''
    const text = `🎯 ${period4} • ${prediction.prediction}${tag} • [${digits}]`
    navigator.clipboard.writeText(text).then(() => showToast(`Copied: ${text}`)).catch(() => showToast('Signal copied!'))
  }, [state, showToast])

  const toggleSound = useCallback(() => {
    const enabled = sound.toggle()
    setSoundEnabled(enabled)
    showToast(enabled ? 'Sound alerts enabled' : 'Sound alerts muted')
    if (enabled) sound.playTick()
  }, [showToast])

  const setFilter = useCallback((filter: FilterType) => {
    setState(prev => ({ ...prev, activeFilter: filter }))
  }, [])

  const installPwa = useCallback(async () => {
    if (!deferredPwaPrompt) return
    deferredPwaPrompt.prompt()
    const { outcome } = await deferredPwaPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPwaPrompt(null)
      showToast('PWA Installed successfully!')
    }
  }, [deferredPwaPrompt, showToast])

  const manualSync = useCallback(async () => {
    showToast('Syncing latest results...')
    await syncCycle()
  }, [syncCycle, showToast])

  const logout = useCallback(() => {
    if (window.confirm('Logout from terminal?')) supabaseClient.logout()
  }, [])

  return {
    state,
    toast,
    soundEnabled,
    deferredPwaPrompt,
    showToast,
    copySignal,
    toggleSound,
    setFilter,
    installPwa,
    manualSync,
    logout,
  }
}

// BeforeInstallPromptEvent type (not in standard TS lib)
interface BeforeInstallPromptEvent extends Event {
  prompt(): void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
