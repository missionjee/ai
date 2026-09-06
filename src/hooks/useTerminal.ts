/**
 * useTerminal — Main application state hook
 * High-precision UTC period synchronization, aggressive zero-lag settlement loop,
 * and resilient multi-proxy data fetching.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { PeriodHelper } from '@/engine/periodHelper'
import { SoundFx } from '@/engine/soundFx'
import { PredictionEngine } from '@/engine/PredictionEngine'
import { supabaseClient } from '@/services/supabase'
import type { AppState, FilterType, HistoryEntry, PredictionResult, SignalTier } from '@/types'

const API_LATEST = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json'
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]
const STORAGE_HISTORY_KEY = 'hiroto_history_cache_v4'
const MAX_HISTORY = 100

// Singleton sound instance
const sound = new SoundFx()

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(history: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {
    /* noop */
  }
}

function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0
    if (promises.length === 0) return reject(new Error('No promises provided'))
    promises.forEach(p => {
      p.then(resolve).catch(() => {
        rejectedCount++
        if (rejectedCount === promises.length) {
          reject(new Error('All proxy promises rejected'))
        }
      })
    })
  })
}

function normalizeRemoteData(raw: any): HistoryEntry[] | null {
  if (!raw) return null
  const list = Array.isArray(raw) ? raw : (raw?.data?.list || raw?.data || [])
  if (!Array.isArray(list) || list.length === 0) return null
  return list.map((item: any) => {
    const issue = item.issue_number || item.issueNumber
    const rawNum = item.actual_number !== undefined && item.actual_number !== null ? item.actual_number : item.number
    const num = rawNum !== undefined && rawNum !== null && !isNaN(parseInt(rawNum, 10)) ? parseInt(rawNum, 10) : null
    const rawType = item.actual_result || item.result_type
    const resType = num !== null ? (num >= 5 ? 'big' : 'small') : (rawType ? String(rawType).toLowerCase() : null)
    return {
      issue_number: String(issue).trim(),
      actual_number: num,
      actual_result: resType,
      predicted_type: null,
      prediction_confidence: null,
      lucky_digits: null,
    } as HistoryEntry
  }).filter((x: HistoryEntry) => Boolean(x.issue_number))
}

async function fetchRemoteData(): Promise<{ data: HistoryEntry[] | null; isLive: boolean }> {
  const timestamp = Date.now()
  const targetUrl = API_LATEST.includes('?') ? `${API_LATEST}&ts=${timestamp}` : `${API_LATEST}?ts=${timestamp}`

  // 1. Direct fetch first with fast timeout (CORS supported, ~300ms latency)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(targetUrl, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timeout)
    if (res.ok) {
      const raw = await res.json()
      const data = normalizeRemoteData(raw)
      if (Array.isArray(data) && data.length > 0) {
        return { data, isLive: true }
      }
    }
  } catch {
    /* fallback to parallel proxy race */
  }

  // 2. Fallback: Race proxies concurrently if direct fetch failed
  try {
    const proxyPromises = PROXIES.map(async proxyFn => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2500)
      const res = await fetch(proxyFn(targetUrl), { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timeout)
      if (!res.ok) throw new Error('Proxy HTTP error')
      const raw = await res.json()
      const data = normalizeRemoteData(raw)
      if (Array.isArray(data) && data.length > 0) return data
      throw new Error('Empty proxy data')
    })
    const data = await promiseAny(proxyPromises)
    return { data, isLive: true }
  } catch {
    return { data: null, isLive: false }
  }
}

function ensureLuckyDigits(digits: any, predType?: string | null): [number, number] {
  if (typeof digits === 'string') {
    try {
      const parsed = JSON.parse(digits.replace(/^{/, '[').replace(/}$/, ']'))
      if (Array.isArray(parsed)) digits = parsed
    } catch {
      const match = digits.match(/\d+/g)
      if (match && match.length >= 2) digits = [match[0], match[1]]
    }
  }
  if (Array.isArray(digits) && digits.length >= 2 && digits[0] !== undefined && digits[1] !== undefined) {
    const d0 = Number(digits[0]),
      d1 = Number(digits[1])
    if (!isNaN(d0) && !isNaN(d1) && !(d0 === 0 && d1 === 0)) return [d0, d1]
  }
  return (predType || '').toUpperCase() === 'BIG' ? [7, 8] : [2, 3]
}

export function useTerminal() {
  const [state, setState] = useState<AppState>(() => {
    const initialTarget = PeriodHelper.getCurrentPeriod()
    return {
      targetPeriod: initialTarget,
      prediction: null,
      history: loadHistory(),
      stats: { streak: 0 },
      tokensBalance: supabaseClient.getTokenBalance(),
      isLiveFeed: false,
      isResolving: false,
      activeFilter: 'ALL',
      lastSettledPeriod: null,
    }
  })

  const [toast, setToast] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled)
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const syncInProgressRef = useRef(false)
  const lastResolvedIssueRef = useRef<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetPeriodPredictionRef = useRef<{
    period: string;
    prediction: PredictionResult;
    isAuthoritative: boolean;
  } | null>(null)
  const authRequestedPeriodRef = useRef<string | null>(null)

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const calculateStreak = useCallback((history: HistoryEntry[]): number => {
    let streak = 0
    const resolved = history.filter(h => {
      const hasNum = h.actual_number !== null && h.actual_number !== undefined
      const hasRes = h.actual_result !== null && h.actual_result !== undefined && String(h.actual_result).toLowerCase() !== 'waiting'
      return (hasNum || hasRes) && h.predicted_type
    })
    for (const h of resolved) {
      const num = (h.actual_number !== null && h.actual_number !== undefined && !isNaN(Number(h.actual_number)))
        ? Number(h.actual_number)
        : null
      const actual = num !== null ? (num >= 5 ? 'BIG' : 'SMALL') : String(h.actual_result || '').toUpperCase()
      const pred = String(h.predicted_type).toUpperCase()
      if (actual && pred && actual === pred) streak++
      else break
    }
    return streak
  }, [])

  /**
   * Main sync cycle: fetches latest draw results, reconciles history,
   * detects newly settled periods, updates streak, and provides target prediction.
   */
  const syncCycle = useCallback(async () => {
    if (syncInProgressRef.current) return
    syncInProgressRef.current = true

    try {
      const localHistory = loadHistory()
      const { data: remoteData, isLive } = await fetchRemoteData()

      const historyMap = new Map<string, HistoryEntry>()
      localHistory.forEach(item => {
        if (item?.issue_number) historyMap.set(String(item.issue_number), item)
      })

      // Always hydrate authoritative historical dataset from Supabase global_signals
      try {
        const cloudHistory = await supabaseClient.getRecentGlobalSignals(5000)
        if (Array.isArray(cloudHistory)) {
          cloudHistory.forEach(s => {
            if (s?.issue_number) {
              const k = String(s.issue_number).trim()
              const existing = historyMap.get(k)
              const rawDigits = s.lucky_digits || (s as any).luckyDigits || (existing ? existing.lucky_digits : null)
              const mappedDigits = rawDigits ? ensureLuckyDigits(rawDigits, s.predicted_type) : null
              
              const num = (s.actual_number !== undefined && s.actual_number !== null && !isNaN(Number(s.actual_number)))
                ? Number(s.actual_number)
                : (existing?.actual_number !== undefined && existing?.actual_number !== null ? Number(existing.actual_number) : null)
              const resType = num !== null
                ? (num >= 5 ? 'big' : 'small')
                : (s.actual_result ? String(s.actual_result).toLowerCase() : (existing?.actual_result ? String(existing.actual_result).toLowerCase() : null))

              const cloudIsSniper = s.is_sniper !== undefined ? !!s.is_sniper : (s.tier === 'SNIPER' || !!existing?.isSniper || !!existing?.is_sniper)
              const cloudRecoveryLevel = s.recovery_level || (s as any).recoveryLevel || existing?.recovery_level || existing?.recoveryLevel || 1
              const cloudTier = s.tier || existing?.tier || (s.stake_units === '0U' ? 'PASS' : (cloudRecoveryLevel === 3 ? 'MAX-COVER-L3' : (cloudRecoveryLevel === 2 ? 'RECOVERY-L2' : (cloudIsSniper ? 'SNIPER' : 'STANDARD'))))
              const cloudStake = s.stake_units || existing?.stake_units || existing?.recommendedStake || (cloudTier === 'PASS' ? '0U' : (cloudTier === 'MAX-COVER-L3' ? '4U' : ((cloudTier === 'RECOVERY-L2' || cloudIsSniper) ? '2U' : '1U')))

              historyMap.set(k, {
                issue_number: k,
                actual_result: resType,
                actual_number: num,
                predicted_type: (s.predicted_type as 'BIG' | 'SMALL') || (existing ? existing.predicted_type : null),
                prediction_confidence: s.confidence || (existing ? existing.prediction_confidence : null),
                lucky_digits: mappedDigits,
                status: s.status || existing?.status || 'CLEARED',
                strategy: s.strategy || existing?.strategy || (cloudIsSniper ? 'Ultra-Sniper Holographic Stacker' : 'GPT 6 ASTRA Holographic Stacker'),
                reason: s.reason || existing?.reason || null,
                tier: cloudTier,
                is_sniper: cloudIsSniper,
                isSniper: cloudIsSniper,
                recommendedStake: cloudStake,
                stake_units: cloudStake,
                recovery_level: cloudRecoveryLevel,
                recoveryLevel: cloudRecoveryLevel,
              })
            }
          })
        }
      } catch { /* noop */ }

      let newlySettled = false
      let latestSettledIssue: string | null = null

      if (remoteData && remoteData.length > 0) {
        // Keep Supabase updated with settled draw numbers and outcomes
        supabaseClient.settlePastDrawsInSupabase(remoteData).catch(() => {})

        remoteData.forEach((item: any) => {
          if (!item.issue_number) return
          const k = String(item.issue_number).trim()
          const rawType = item.actual_result || item.result_type
          const num =
            item.actual_number !== undefined && item.actual_number !== null && !isNaN(Number(item.actual_number))
              ? Number(item.actual_number)
              : null
          const actualType = num !== null ? (num >= 5 ? 'big' : 'small') : (rawType ? String(rawType).toLowerCase() : null)

          // Track latest settled issue number across remote items
          if (!latestSettledIssue) {
            latestSettledIssue = k
          } else {
            try {
              if (BigInt(k) > BigInt(latestSettledIssue)) latestSettledIssue = k
            } catch {
              if (k.localeCompare(latestSettledIssue) > 0) latestSettledIssue = k
            }
          }

          const existing = historyMap.get(k)
          if (existing) {
            if (!existing.actual_result && actualType) {
              newlySettled = true
            }
            existing.actual_result = actualType
            existing.actual_number = num
          } else {
            historyMap.set(k, {
              issue_number: k,
              actual_result: actualType,
              actual_number: num,
              predicted_type: null,
              prediction_confidence: null,
              lucky_digits: null,
            })
            newlySettled = true
          }
        })
      }

      // Synchronize Target Period and Previous Period strictly with the latest settled draw
      const currentTargetPeriod = latestSettledIssue
        ? PeriodHelper.getNextPeriod(latestSettledIssue)
        : PeriodHelper.getCurrentPeriod()
      const previousPeriod = latestSettledIssue || PeriodHelper.getPreviousPeriod()

      const sortedHistory = Array.from(historyMap.values()).sort((a, b) => {
        try {
          const aI = BigInt(a.issue_number),
            bI = BigInt(b.issue_number)
          return aI > bI ? -1 : aI < bI ? 1 : 0
        } catch {
          return b.issue_number.localeCompare(a.issue_number)
        }
      })

      // Strictly completed draws only (guarantees draw history table is free of ghost rows)
      const resolvedHistory = sortedHistory.filter(h => {
        const hasNum = h.actual_number !== null && h.actual_number !== undefined
        const hasRes = h.actual_result !== null && h.actual_result !== undefined && String(h.actual_result).toLowerCase() !== 'waiting' && String(h.actual_result).toLowerCase() !== 'pending'
        return hasNum || hasRes
      })

      const engine = new PredictionEngine()

      // Canonicalize actual results & backfill missing historical signals deterministically
      for (let i = 0; i < resolvedHistory.length; i++) {
        const entry = resolvedHistory[i]
        const num = entry.actual_number !== null && entry.actual_number !== undefined && !isNaN(Number(entry.actual_number))
          ? Number(entry.actual_number)
          : null
        const actualStr = num !== null ? (num >= 5 ? 'BIG' : 'SMALL') : String(entry.actual_result || 'BIG').toUpperCase()
        entry.actual_result = actualStr
        entry.actual_number = num

        if (!entry.predicted_type) {
          const priorSlice = resolvedHistory.slice(i + 1, i + 31)
          if (priorSlice.length >= 5) {
            const histPred = engine.predict(priorSlice)
            entry.predicted_type = histPred.prediction
            entry.prediction_confidence = histPred.confidence
            entry.lucky_digits = histPred.luckyDigits
          } else {
            const fallback: 'BIG' | 'SMALL' = num !== null ? (num >= 5 ? 'BIG' : 'SMALL') : 'BIG'
            entry.predicted_type = fallback
            entry.prediction_confidence = 55
            entry.lucky_digits = ensureLuckyDigits(null, fallback)
          }
        }
      }

      // Check if the previous period has settled
      const prevEntry = historyMap.get(previousPeriod)
      const isPreviousSettled = prevEntry && prevEntry.actual_result !== null && prevEntry.actual_result !== undefined
      const isResolvingNow = !isPreviousSettled

      if (newlySettled && isPreviousSettled && lastResolvedIssueRef.current !== previousPeriod) {
        lastResolvedIssueRef.current = previousPeriod
        sound.playTick()
      }

      // Clear sticky cache if target period has progressed to a new draw
      if (targetPeriodPredictionRef.current && targetPeriodPredictionRef.current.period !== currentTargetPeriod) {
        targetPeriodPredictionRef.current = null
        authRequestedPeriodRef.current = null
      }

      // Prepare target period prediction
      const session = supabaseClient.getSession()
      const hasActiveSession = !!(session && session.key)
      const tokensBalance = hasActiveSession ? supabaseClient.getTokenBalance() : 0
      let currentTargetEntry = historyMap.get(currentTargetPeriod)
      let prediction: PredictionResult | null = null

      if (tokensBalance > 0 && hasActiveSession) {
        // Reuse sticky locked prediction if already established for this exact period
        if (targetPeriodPredictionRef.current && targetPeriodPredictionRef.current.period === currentTargetPeriod) {
          prediction = targetPeriodPredictionRef.current.prediction
        } else if (currentTargetEntry && currentTargetEntry.predicted_type) {
          const centralDigits = ensureLuckyDigits(currentTargetEntry.lucky_digits, currentTargetEntry.predicted_type)
          const isSniper = !!(currentTargetEntry.isSniper ?? currentTargetEntry.is_sniper ?? (currentTargetEntry.tier === 'SNIPER'))
          const recoveryLevel = currentTargetEntry.recovery_level || currentTargetEntry.recoveryLevel || 1
          const tier: SignalTier = (currentTargetEntry.tier as SignalTier) || (currentTargetEntry.stake_units === '0U' || currentTargetEntry.recommendedStake === '0U' ? 'PASS' : (recoveryLevel === 3 ? 'MAX-COVER-L3' : (recoveryLevel === 2 ? 'RECOVERY-L2' : (isSniper ? 'SNIPER' : 'STANDARD'))))
          const recommendedStake = currentTargetEntry.recommendedStake || currentTargetEntry.stake_units || (tier === 'PASS' ? '0U' : (tier === 'MAX-COVER-L3' ? '4U' : ((tier === 'RECOVERY-L2' || isSniper) ? '2U' : '1U')))
          const strategy = currentTargetEntry.strategy || (tier === 'PASS' ? '0U [PASS] Filter Gate' : (tier === 'MAX-COVER-L3' ? 'Active Level 3 Recovery' : (tier === 'RECOVERY-L2' ? 'Active Level 2 Recovery' : (isSniper ? 'Ultra-Sniper Holographic Stacker' : 'GPT 6 ASTRA Holographic Stacker'))))
          const statusReason = currentTargetEntry.reason || (tier === 'PASS' ? `⏸️ GPT 6 ASTRA [PASS - 0U]: Low conviction, holding bankroll` : (isSniper ? `🎯 GPT 6 ASTRA Ultra-Sniper Signal [${recommendedStake} Stake]` : (tier === 'MAX-COVER-L3' ? `🔥 GPT 6 ASTRA [LEVEL 3 MAX COVER]: 4U final cover` : (tier === 'RECOVERY-L2' ? `🛡️ GPT 6 ASTRA [LEVEL 2 RECOVERY]: 2U recovery cover` : `⚡ GPT 6 ASTRA Standard Signal [${recommendedStake} Stake]`))))

          prediction = {
            prediction: currentTargetEntry.predicted_type as 'BIG' | 'SMALL',
            confidence: currentTargetEntry.prediction_confidence || 54,
            status: (currentTargetEntry.status as any) || 'CLEARED',
            statusReason,
            luckyDigits: centralDigits,
            strategy,
            reason: currentTargetEntry.reason || 'Central Model Consensus',
            bigProb: currentTargetEntry.predicted_type === 'BIG' ? (currentTargetEntry.prediction_confidence || 54) : (100 - (currentTargetEntry.prediction_confidence || 54)),
            smallProb: currentTargetEntry.predicted_type === 'SMALL' ? (currentTargetEntry.prediction_confidence || 54) : (100 - (currentTargetEntry.prediction_confidence || 54)),
            regime: 'trending',
            pattern: 'Standard',
            isSniper,
            tier,
            recommendedStake,
            recoveryLevel,
            digitProbs: {},
            volatility: '0.48',
            entropy: '0.50',
            permutationEntropy: '0.50',
            parityPrediction: 'EVEN',
            engineVersion: 'gpt 6 astra',
            modelPerformance: null,
          }
          targetPeriodPredictionRef.current = {
            period: currentTargetPeriod,
            prediction,
            isAuthoritative: true
          }
        } else {
          // Zero-Lag Autonomous Fallback: Instantaneous local engine inference!
          const localEngineResult = engine.predict(resolvedHistory, { autoRecovery: true })
          prediction = localEngineResult

          // Save in historyMap for stability with full fidelity
          historyMap.set(currentTargetPeriod, {
            issue_number: currentTargetPeriod,
            predicted_type: localEngineResult.prediction,
            prediction_confidence: localEngineResult.confidence,
            lucky_digits: localEngineResult.luckyDigits,
            actual_result: null,
            actual_number: null,
            status: localEngineResult.status,
            reason: localEngineResult.statusReason || localEngineResult.reason,
            strategy: localEngineResult.strategy,
            tier: localEngineResult.tier || (localEngineResult.isSniper ? 'SNIPER' : 'STANDARD'),
            is_sniper: localEngineResult.isSniper,
            isSniper: localEngineResult.isSniper,
            recommendedStake: localEngineResult.recommendedStake || (localEngineResult.isSniper ? '2U' : '1U'),
            stake_units: localEngineResult.recommendedStake || (localEngineResult.isSniper ? '2U' : '1U'),
            recovery_level: localEngineResult.recoveryLevel || 1,
            recoveryLevel: localEngineResult.recoveryLevel || 1,
          })

          targetPeriodPredictionRef.current = {
            period: currentTargetPeriod,
            prediction: localEngineResult,
            isAuthoritative: false
          }

          // Asynchronously publish to Supabase so other devices share this exact prediction
          supabaseClient.publishGlobalSignal({
            issue_number: currentTargetPeriod,
            predicted_type: localEngineResult.prediction,
            confidence: localEngineResult.confidence,
            status: localEngineResult.status,
            lucky_digits: localEngineResult.luckyDigits,
            stake_units: localEngineResult.recommendedStake || '1U',
            strategy: localEngineResult.strategy,
            reason: localEngineResult.statusReason || localEngineResult.reason,
            big_prob: localEngineResult.bigProb,
            small_prob: localEngineResult.smallProb,
            regime: localEngineResult.regime,
            pattern: localEngineResult.pattern,
            is_sniper: localEngineResult.isSniper,
            engine_version: 'gpt 6 astra'
          }).catch(() => {})
        }

        // Fetch authoritative backend signal from Supabase / Cloudflare Worker (Single source of truth)
        // Strictly request once per period to eliminate any single-period network jitter
        if (authRequestedPeriodRef.current !== currentTargetPeriod && (!targetPeriodPredictionRef.current || !targetPeriodPredictionRef.current.isAuthoritative)) {
          authRequestedPeriodRef.current = currentTargetPeriod
          supabaseClient.getAuthorizedPrediction(currentTargetPeriod).then(authRes => {
            if (authRes) {
              if (authRes.error === 'DEVICE_MISMATCH') {
                showToast('⚠️ Session conflict: key active on another device')
              } else if (authRes.error === 'INSUFFICIENT_TOKENS' || (typeof authRes.tokensBalance === 'number' && authRes.tokensBalance <= 0)) {
                setState(prev => ({ ...prev, tokensBalance: 0 }))
                showToast('⚡ Token balance empty (0). Please recharge.')
              } else if (typeof authRes.tokensBalance === 'number') {
                const updatedBal = authRes.tokensBalance
                setState(prev => prev.tokensBalance !== updatedBal ? { ...prev, tokensBalance: updatedBal } : prev)
              }

              if (authRes.success && authRes.signal && authRes.signal.issue_number === currentTargetPeriod) {
                const s = authRes.signal as any
                const rawCloudPred = String(s.predicted_type || '').toUpperCase()
                const cloudPred: 'BIG' | 'SMALL' = rawCloudPred === 'BIG' ? 'BIG' : 'SMALL'
                const cloudConf = s.confidence || s.prediction_confidence || 54
                const cloudStatus = (s.status as any) || (s.prediction_status as any) || 'CLEARED'
                const cloudDigits = ensureLuckyDigits(s.lucky_digits || s.luckyDigits, cloudPred)
                const cloudIsSniper = s.is_sniper !== undefined ? !!s.is_sniper : (s.tier === 'SNIPER')
                const cloudRecovery = s.recovery_level || s.recoveryLevel || 1
                const cloudTier: SignalTier = (s.tier as SignalTier) || (cloudRecovery === 3 ? 'MAX-COVER-L3' : (cloudRecovery === 2 ? 'RECOVERY-L2' : (cloudIsSniper ? 'SNIPER' : 'STANDARD')))
                const cloudStake = s.stake_units || (cloudTier === 'MAX-COVER-L3' ? '4U' : ((cloudTier === 'RECOVERY-L2' || cloudIsSniper) ? '2U' : '1U'))

                // Update history map & universal cache with central signal
                const entry = historyMap.get(currentTargetPeriod)
                if (entry) {
                  entry.predicted_type = cloudPred
                  entry.prediction_confidence = cloudConf
                  entry.lucky_digits = cloudDigits
                  entry.status = cloudStatus
                  entry.strategy = s.strategy || s.strategy_used || entry.strategy
                  entry.reason = s.reason || s.statusReason || entry.reason
                  entry.is_sniper = cloudIsSniper
                  entry.isSniper = cloudIsSniper
                  entry.tier = cloudTier
                  entry.recommendedStake = cloudStake
                  entry.stake_units = cloudStake
                  entry.recovery_level = cloudRecovery
                  entry.recoveryLevel = cloudRecovery
                }

                setState(prev => {
                  if (prev.targetPeriod !== currentTargetPeriod) return prev
                  // Single-period stabilization: once sniper or 2U stake is detected for this period, NEVER downgrade it
                  const isSniper = cloudIsSniper || prev.prediction?.isSniper || targetPeriodPredictionRef.current?.prediction.isSniper || false
                  const recoveryLevel = cloudRecovery || prev.prediction?.recoveryLevel || 1
                  const tier: SignalTier = (cloudTier || prev.prediction?.tier || (cloudStake === '0U' ? 'PASS' : (isSniper ? 'SNIPER' : 'STANDARD'))) as SignalTier
                  const recommendedStake = cloudStake || prev.prediction?.recommendedStake || (tier === 'PASS' ? '0U' : (tier === 'MAX-COVER-L3' ? '4U' : ((tier === 'RECOVERY-L2' || isSniper) ? '2U' : '1U')))
                  const strategy = s.strategy || s.strategy_used || prev.prediction?.strategy || (tier === 'PASS' ? '0U [PASS] Filter Gate' : (tier === 'MAX-COVER-L3' ? 'Active Level 3 Recovery' : (tier === 'RECOVERY-L2' ? 'Active Level 2 Recovery' : (isSniper ? 'Ultra-Sniper Holographic Stacker' : 'GPT 6 ASTRA Holographic Stacker'))))
                  const statusReason = s.statusReason || s.reason || prev.prediction?.statusReason || (tier === 'PASS' ? `⏸️ GPT 6 ASTRA [PASS - 0U]: Low conviction, holding bankroll` : (tier === 'MAX-COVER-L3' ? `🔥 GPT 6 ASTRA [LEVEL 3 MAX COVER]: 4U final cover` : (tier === 'RECOVERY-L2' ? `🛡️ GPT 6 ASTRA [LEVEL 2 RECOVERY]: 2U recovery cover` : (isSniper ? `🎯 GPT 6 ASTRA Ultra-Sniper Signal [2U Stake]` : `⚡ GPT 6 ASTRA Standard Signal [1U Stake]`))))

                  const updatedPred: PredictionResult = {
                    prediction: cloudPred,
                    confidence: cloudConf,
                    status: cloudStatus,
                    statusReason,
                    luckyDigits: cloudDigits,
                    strategy,
                    reason: s.reason || 'Edge Ensemble Convergence',
                    bigProb: s.big_prob ?? (cloudPred === 'BIG' ? cloudConf : 100 - cloudConf),
                    smallProb: s.small_prob ?? (cloudPred === 'SMALL' ? cloudConf : 100 - cloudConf),
                    regime: (s.regime as any) || 'trending',
                    pattern: s.pattern || 'Standard',
                    isSniper,
                    tier,
                    recommendedStake,
                    recoveryLevel,
                    digitProbs: prev.prediction?.digitProbs || {},
                    volatility: '0.48',
                    entropy: '0.50',
                    permutationEntropy: '0.50',
                    parityPrediction: 'EVEN',
                    engineVersion: 'gpt 6 astra',
                    modelPerformance: null,
                  }

                  targetPeriodPredictionRef.current = {
                    period: currentTargetPeriod,
                    prediction: updatedPred,
                    isAuthoritative: true
                  }

                  return {
                    ...prev,
                    prediction: updatedPred,
                    tokensBalance: typeof authRes.tokensBalance === 'number' ? authRes.tokensBalance : supabaseClient.getTokenBalance(),
                  }
                })
              }
            }
          }).catch(() => {})
        }
      }

      // Save exclusively resolved settled draws to localStorage cache
      saveHistory(resolvedHistory)

      const finalTokens = supabaseClient.getTokenBalance()
      const streak = calculateStreak(resolvedHistory)

      setState(prev => {
        let finalPrediction: PredictionResult | null = null
        if (tokensBalance > 0) {
          // Absolute Single-Period Lock: Reuse sticky locked prediction if already present
          if (targetPeriodPredictionRef.current && targetPeriodPredictionRef.current.period === currentTargetPeriod) {
            finalPrediction = targetPeriodPredictionRef.current.prediction
          } else if (prev.targetPeriod === currentTargetPeriod && prev.prediction) {
            finalPrediction = {
              ...prev.prediction,
              ...(prediction || {}),
              // Strict anti-fluctuation invariant: NEVER downgrade tier, stake, or statusReason within the same period
              isSniper: prev.prediction.isSniper || (prediction?.isSniper ?? false),
              tier: (prev.prediction.tier === 'SNIPER' || prediction?.tier === 'SNIPER') ? 'SNIPER' : (prediction?.tier || prev.prediction.tier || 'STANDARD'),
              recommendedStake: (prev.prediction.recommendedStake === '2U' || prediction?.recommendedStake === '2U') ? '2U' : (prediction?.recommendedStake || prev.prediction.recommendedStake || '1U'),
              prediction: prev.prediction.prediction || prediction?.prediction || 'BIG',
              confidence: prediction?.confidence || prev.prediction.confidence,
              luckyDigits: prediction?.luckyDigits || prev.prediction.luckyDigits,
              strategy: (prev.prediction.isSniper || prediction?.isSniper) ? 'Ultra-Sniper Holographic Stacker' : (prediction?.strategy || prev.prediction.strategy),
              statusReason: (prev.prediction.isSniper || prediction?.isSniper)
                ? (prev.prediction.statusReason?.includes('Ultra-Sniper') ? prev.prediction.statusReason : (prediction?.statusReason || prev.prediction.statusReason))
                : (prediction?.statusReason || prev.prediction.statusReason),
            }
            targetPeriodPredictionRef.current = {
              period: currentTargetPeriod,
              prediction: finalPrediction,
              isAuthoritative: false
            }
          } else {
            finalPrediction = prediction
          }
        }

        return {
          ...prev,
          targetPeriod: currentTargetPeriod,
          prediction: finalPrediction,
          history: resolvedHistory,
          stats: { streak },
          tokensBalance: finalTokens,
          isLiveFeed: isLive,
          isResolving: isResolvingNow,
          lastSettledPeriod: isPreviousSettled ? previousPeriod : prev.lastSettledPeriod,
        }
      })
    } finally {
      syncInProgressRef.current = false
    }
  }, [calculateStreak])

  // Precision 250ms sub-interval execution loop for instantaneous zero-delay transitions
  useEffect(() => {
    let lastCheckedSecond = -1

    const timer = setInterval(() => {
      const now = new Date()
      const secondOfMinute = now.getSeconds() // 0 to 59

      if (secondOfMinute !== lastCheckedSecond) {
        lastCheckedSecond = secondOfMinute

        // Fast resolution polling: between :00 and :15 seconds of the minute,
        // poll aggressively every 1-2 seconds until the draw settles.
        if (secondOfMinute <= 15) {
          syncCycle()
        }
        // Background heartbeat checks every 10 seconds for the remainder of the minute
        else if (secondOfMinute % 10 === 0) {
          syncCycle()
          supabaseClient.verifyDeviceSession()
        }
      }
    }, 250)

    return () => clearInterval(timer)
  }, [syncCycle])

  // PWA Install prompt handler
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPwaPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Immediate sync on tab visibility, focus, and network reconnection
  useEffect(() => {
    const handleReSync = () => {
      if (document.visibilityState === 'visible') {
        syncCycle()
      }
    }
    const handleFocus = () => syncCycle()
    const handleOnline = () => syncCycle()

    document.addEventListener('visibilitychange', handleReSync)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleReSync)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [syncCycle])

  // AudioContext unlock on first user interaction
  useEffect(() => {
    const unlock = () => sound.unlockAudioContext()
    document.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('click', unlock, { passive: true })
    return () => {
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('click', unlock)
    }
  }, [])

  // Initial sync on mount
  useEffect(() => {
    syncCycle()
  }, [syncCycle])

  const copySignal = useCallback(() => {
    const { prediction, targetPeriod } = state
    if (!prediction || !targetPeriod) {
      showToast('No active signal to copy')
      return
    }
    const period4 = PeriodHelper.formatLast4(targetPeriod)
    const digits = prediction.luckyDigits?.join(', ') ?? '-'
    const tag = (prediction.isSniper || prediction.tier === 'SNIPER') ? ' [🎯 SNIPER]' : ''
    const predDisplay = prediction.prediction === 'BIG' ? 'BIGGG' : prediction.prediction
    const text = `**🎯 ${period4} • ${predDisplay}${tag} • [${digits}]**`
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(`✓ Copied: ${predDisplay} [${digits}]`))
      .catch(() => showToast('✓ Copied to clipboard!'))
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
    const session = supabaseClient.getSession()
    const bal = (session && session.key) ? supabaseClient.getTokenBalance() : 0
    setState(prev => ({ ...prev, tokensBalance: bal }))
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
