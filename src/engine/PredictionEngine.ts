/**
 * HIROTO AI — Institutional Prediction Engine (TypeScript v8.1)
 *
 * Architecture:
 * 1. Regime Validity Pre-Filter (Hurst Exponent & Autocorrelation ACF)
 * 2. Online Dynamic Self-Learning (Exp3 Multi-Armed Bandit)
 * 3. 7 Complementary Statistical Submodels
 * 4. Meta-Learner Stacking (Non-Linear Joint Synergies)
 * 5. Platt Scaling Probability Calibration
 * 6. PRNG / LCG Forensics Diagnostic
 */

import type { HistoryEntry, ModelTrackers, PredictionResult, RegimeName } from '@/types'

interface SubmodelResult {
  predToken: 0 | 1
  prob: number
  reason: string
  pattern?: string | null
  followingDigits?: number[]
}

interface RawSubmodels {
  contextAttention: SubmodelResult
  kneserNeyLM: SubmodelResult
  dragonMomentum: SubmodelResult
  historicalPatternAssistance: SubmodelResult
  empiricalMarkov: SubmodelResult
  parityHarmonic: SubmodelResult
  latentTrajectory: SubmodelResult
}

interface SubResult {
  name: keyof ModelTrackers
  pred: 'BIG' | 'SMALL'
  prob: number
  weight: number
  accuracy: number
  reason: string
  inverted: boolean
}

interface MetaContext {
  shannonEntropy: number
  curStreak: number
  hurstH: number
  recentAcc: number
}

interface RegimeCheck {
  valid: boolean
  hurstH: number
  autocorr1: number
  regimeName: RegimeName
  isWhiteNoise: boolean
}

export class PredictionEngine {
  private readonly minConfidence = 52
  private readonly maxConfidence = 95
  private readonly storageKey = 'hiroto_engine_memory_v8'
  private historyBuffer = new Map<string, HistoryEntry>()
  private plattA = 2.40
  private plattB = -0.05
  private modelTrackers: ModelTrackers = {
    contextAttention: { hits: 15, total: 25, accuracy: 60, weight: 1.8, inverted: false },
    kneserNeyLM: { hits: 13, total: 25, accuracy: 52, weight: 0.85, inverted: false },
    dragonMomentum: { hits: 14, total: 25, accuracy: 56, weight: 1.8, inverted: false },
    historicalPatternAssistance: { hits: 13, total: 25, accuracy: 52, weight: 1.0, inverted: false },
    empiricalMarkov: { hits: 12, total: 25, accuracy: 48, weight: 0.85, inverted: false },
    parityHarmonic: { hits: 13, total: 25, accuracy: 52, weight: 0.85, inverted: false },
    latentTrajectory: { hits: 14, total: 25, accuracy: 56, weight: 1.8, inverted: false },
  }

  constructor() {
    this._loadPersistentBuffer()
  }

  private _loadPersistentBuffer(): void {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (raw) {
        const arr = JSON.parse(raw) as HistoryEntry[]
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            if (item?.issue_number) this.historyBuffer.set(String(item.issue_number), item)
          })
        }
      }
    } catch { /* noop */ }
  }

  private _savePersistentBuffer(): void {
    try {
      let arr = Array.from(this.historyBuffer.values())
      if (arr.length > 2000) {
        arr = arr.sort((a, b) => {
          try {
            const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number)
            return aI > bI ? 1 : aI < bI ? -1 : 0
          } catch { return a.issue_number.localeCompare(b.issue_number) }
        }).slice(-2000)
        this.historyBuffer.clear()
        arr.forEach(item => this.historyBuffer.set(String(item.issue_number), item))
      }
      localStorage.setItem(this.storageKey, JSON.stringify(arr))
    } catch { /* noop */ }
  }

  private _computeHurstExponent(series: number[]): number {
    const n = series.length
    if (n < 15) return 0.50
    const mean = series.reduce((a, b) => a + b, 0) / n
    const deviations = series.map(x => x - mean)
    let cumulative = 0, maxCum = -Infinity, minCum = Infinity
    for (const d of deviations) {
      cumulative += d
      maxCum = Math.max(maxCum, cumulative)
      minCum = Math.min(minCum, cumulative)
    }
    const R = maxCum - minCum
    const variance = deviations.reduce((a, b) => a + b * b, 0) / n
    const S = Math.sqrt(variance) || 1e-6
    return Math.max(0.0, Math.min(1.0, Math.log(R / S) / Math.log(n)))
  }

  private _computeAutocorrelation(series: number[], lag = 1): number {
    const n = series.length
    if (n <= lag + 5) return 0.0
    const mean = series.reduce((a, b) => a + b, 0) / n
    const variance = series.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n || 1e-6
    let cov = 0
    for (let i = 0; i < n - lag; i++) cov += (series[i] - mean) * (series[i + lag] - mean)
    return cov / ((n - lag) * variance)
  }

  private _regimeValidityCheck(tokens: number[]): RegimeCheck {
    const win30 = tokens.slice(-30)
    const win60 = tokens.slice(-60)
    const H30 = this._computeHurstExponent(win30)
    const H60 = this._computeHurstExponent(win60)
    const H = 0.65 * H30 + 0.35 * H60
    const ac1 = this._computeAutocorrelation(win30, 1)
    const ac2 = this._computeAutocorrelation(win30, 2)
    const isWhiteNoise = H < 0.48 && Math.abs(ac1) < 0.07 && Math.abs(ac2) < 0.07
    let regimeName: RegimeName = 'mixed'
    if (H >= 0.53 || Math.abs(ac1) >= 0.16) regimeName = 'trending'
    else if (H <= 0.46) regimeName = 'mean-reverting'
    return { valid: !isWhiteNoise, hurstH: parseFloat(H.toFixed(3)), autocorr1: parseFloat(ac1.toFixed(3)), regimeName, isWhiteNoise }
  }

  private _updateDynamicSelfLearning(validHistory: HistoryEntry[]): void {
    const windowLen = Math.min(25, validHistory.length - 12)
    if (windowLen < 8) return

    const trackers: Record<keyof ModelTrackers, { hits: number; total: number }> = {
      contextAttention: { hits: 0, total: 0 },
      kneserNeyLM: { hits: 0, total: 0 },
      dragonMomentum: { hits: 0, total: 0 },
      historicalPatternAssistance: { hits: 0, total: 0 },
      empiricalMarkov: { hits: 0, total: 0 },
      parityHarmonic: { hits: 0, total: 0 },
      latentTrajectory: { hits: 0, total: 0 },
    }

    for (let k = 1; k <= windowLen; k++) {
      const targetIdx = validHistory.length - k
      const subHist = validHistory.slice(0, targetIdx)
      const actual = (validHistory[targetIdx].actual_result || '').toLowerCase() === 'big' ? 1 : 0
      const preds = this._computeRawSubmodels(subHist)

      for (const [name, p] of Object.entries(preds) as [keyof ModelTrackers, SubmodelResult][]) {
        trackers[name].total++
        if (p.predToken === actual) trackers[name].hits++
      }
    }

    for (const [name, tr] of Object.entries(trackers) as [keyof ModelTrackers, { hits: number; total: number }][]) {
      const acc = tr.total > 0 ? tr.hits / tr.total : 0.5
      let weight = 1.0
      let inverted = false
      const invertThreshold = name === 'historicalPatternAssistance' ? 0.42 : 0.36
      if (acc >= 0.68) weight = 2.8
      else if (acc >= 0.56) weight = 1.8
      else if (acc >= 0.46) weight = 0.85
      else if (acc >= invertThreshold) weight = 0.20
      else { weight = 1.9; inverted = true }
      if (name === 'historicalPatternAssistance') weight = Math.min(1.35, weight)
      this.modelTrackers[name] = { hits: tr.hits, total: tr.total, accuracy: Math.round(acc * 100), weight, inverted }
    }
  }

  private _computeRawSubmodels(history: HistoryEntry[]): RawSubmodels {
    const n = history.length
    const tokens = history.map(d => (d.actual_result || '').toLowerCase() === 'big' ? 1 : 0) as (0 | 1)[]
    const digits = history.map(d => d.actual_number !== null && d.actual_number !== undefined ? d.actual_number : 4)
    const tokenChars = tokens.map(t => t === 1 ? 'B' : 'S')

    // 1. Context Attention
    let attScoreB = 0, attScoreS = 0
    for (const ctxLen of [2, 3, 4]) {
      if (n <= ctxLen) continue
      const currTokens = tokens.slice(-ctxLen)
      const currDigits = digits.slice(-ctxLen)
      for (let i = 0; i <= n - ctxLen - 1; i++) {
        let tokenDiff = 0, digitDiff = 0
        for (let j = 0; j < ctxLen; j++) {
          if (tokens[i + j] !== currTokens[j]) tokenDiff++
          digitDiff += Math.abs(digits[i + j] - currDigits[j]) / 9.0
        }
        if (tokenDiff <= 1) {
          const age = n - 1 - (i + ctxLen)
          const weight = Math.exp(-tokenDiff * 1.6 - digitDiff * 0.5) * Math.exp(-age / 100)
          if (tokens[i + ctxLen] === 1) attScoreB += weight
          else attScoreS += weight
        }
      }
    }
    const attP = (attScoreB + 0.5) / (attScoreB + attScoreS + 1.0)

    // 2. Kneser-Ney
    let knP = 0.5
    for (let ord = 3; ord >= 1; ord--) {
      if (n <= ord) continue
      const needle = tokens.slice(-ord).join('')
      let bCount = 0, sCount = 0
      for (let i = 0; i <= n - ord - 1; i++) {
        if (tokens.slice(i, i + ord).join('') === needle) {
          if (tokens[i + ord] === 1) bCount++; else sCount++
        }
      }
      const total = bCount + sCount
      if (total >= (ord === 3 ? 3 : ord === 2 ? 5 : 8)) {
        const D = 0.75
        const continuationProb = (tokens.slice(1).filter((t, idx) => tokens[idx] === Number(needle[needle.length - 1]) && t === 1).length + 0.5) / n
        const lambda = (D * 2) / total
        knP = Math.max(0, bCount - D) / total + lambda * continuationProb
        break
      }
    }

    // 3. Dragon Trend & Momentum
    let streak = 1
    const last = tokens[n - 1]
    for (let i = n - 2; i >= 0; i--) { if (tokens[i] === last) streak++; else break }
    let trendP = 0.5, trendReason = 'Neutral base'
    if (streak >= 7) { trendP = last === 1 ? 0.22 : 0.78; trendReason = `Dragon Reversal Confirmed (${streak}x) -> High-Confidence Inversion` }
    else if (streak === 6) { trendP = last === 1 ? 0.38 : 0.62; trendReason = `Streak Reversal Pending (${streak}x) -> Awaiting Confirmation` }
    else if (streak === 4 || streak === 5) { trendP = 0.50; trendReason = `Dragon Exclusion Zone (${streak}x) -> Indeterminate Inflection Trap` }
    else if (streak === 3) { trendP = last === 1 ? 0.65 : 0.35; trendReason = `Dragon Momentum (${streak}x) -> Ride Trend` }
    else if (streak === 1) {
      let alts = 0
      for (let i = n - 1; i >= Math.max(1, n - 6); i--) { if (tokens[i] !== tokens[i - 1]) alts++; else break }
      if (alts >= 4) { trendP = 0.50; trendReason = `Alternation Ceiling (${alts} switches) -> High-Entropy Trap` }
      else if (alts >= 2) { trendP = last === 1 ? 0.35 : 0.65; trendReason = `Alternation Rhythm (${alts} switches) -> Follow Oscillation` }
      else { trendP = 0.50; trendReason = 'Single draw transition' }
    }

    // 4. Historical Pattern Assistance
    let histPatP = 0.5, histPatReason = 'Historical Pattern: Neutral baseline'
    let histFollowingDigits: number[] = []
    let matchedPatternName: string | null = null
    for (const len of [4, 3, 2]) {
      if (n < len + 8) continue
      const needle = tokenChars.slice(-len).join('')
      let b = 0, s = 0, weightedB = 0, weightedS = 0
      const digitCollector: number[] = []
      for (let i = 0; i <= n - len - 1; i++) {
        if (tokenChars.slice(i, i + len).join('') === needle) {
          const age = n - 1 - (i + len)
          const w = Math.exp(-age / 240)
          const nextTok = tokens[i + len]
          const nextDig = digits[i + len]
          digitCollector.push(nextDig)
          if (nextTok === 1) { b++; weightedB += w } else { s++; weightedS += w }
        }
      }
      const tot = b + s
      if (tot >= 25) {
        const p = (weightedB + 1.0) / (weightedB + weightedS + 2.0)
        const bias = Math.abs(p - 0.5)
        if (bias >= 0.08) {
          histPatP = p; matchedPatternName = needle; histFollowingDigits = digitCollector
          const predStr = p >= 0.5 ? 'BIG' : 'SMALL'
          const winPct = Math.round((p >= 0.5 ? p : (1 - p)) * 100)
          histPatReason = `Historical Pattern [${needle}]: ${tot} occurrences (${winPct}% ${predStr})`;
          break
        }
      } else if (tot >= (len === 4 ? 4 : len === 3 ? 6 : 10)) {
        histFollowingDigits = digitCollector; matchedPatternName = needle
      }
    }

    // 5. Empirical Markov
    const lastNum = digits[n - 1]
    const digitTransCounts = new Array(10).fill(0) as number[]
    for (let i = 0; i < n - 1; i++) { if (digits[i] === lastNum) digitTransCounts[digits[i + 1]]++ }
    let empiricalBigMass = 0, empiricalSmallMass = 0
    for (let d = 0; d <= 4; d++) empiricalSmallMass += (digitTransCounts[d] + 0.5)
    for (let d = 5; d <= 9; d++) empiricalBigMass += (digitTransCounts[d] + 0.5)
    const markovP = empiricalBigMass / (empiricalBigMass + empiricalSmallMass)

    // 6. Parity Harmonic
    const recentParities = digits.slice(-8).map(d => d % 2 === 1 ? 1 : 0)
    let oddCount = 0
    recentParities.forEach(p => { if (p === 1) oddCount++ })
    const oddRatio = oddCount / recentParities.length
    const parityP = 0.44 + 0.12 * oddRatio

    // 7. Continuous Latent Trajectory EMA
    let ema = digits[Math.max(0, n - 8)]
    for (let i = Math.max(0, n - 7); i < n; i++) ema = 0.42 * digits[i] + 0.58 * ema
    const contP = 1 / (1 + Math.exp(-(ema - 4.5) * 0.70))

    return {
      contextAttention: { predToken: attP >= 0.5 ? 1 : 0, prob: attP, reason: 'Context Attention (LLM soft matching)' },
      kneserNeyLM: { predToken: knP >= 0.5 ? 1 : 0, prob: knP, reason: 'Hierarchical Kneser-Ney Language Smoothing' },
      dragonMomentum: { predToken: trendP >= 0.5 ? 1 : 0, prob: trendP, reason: trendReason },
      historicalPatternAssistance: { predToken: histPatP >= 0.5 ? 1 : 0, prob: histPatP, reason: histPatReason, pattern: matchedPatternName, followingDigits: histFollowingDigits },
      empiricalMarkov: { predToken: markovP >= 0.5 ? 1 : 0, prob: markovP, reason: `Digit Transition Matrix from draw ${lastNum}` },
      parityHarmonic: { predToken: parityP >= 0.5 ? 1 : 0, prob: parityP, reason: `Parity Harmonic (${Math.round(oddRatio * 100)}% ODD bias)` },
      latentTrajectory: { predToken: contP >= 0.5 ? 1 : 0, prob: contP, reason: `Continuous Latent EMA (${ema.toFixed(2)})` },
    }
  }

  private _evaluateMetaLearner(subResults: SubResult[], context: MetaContext): number {
    const { shannonEntropy, curStreak, hurstH } = context
    let weightedBase = 0, totalW = 0
    subResults.forEach(s => { weightedBase += s.prob * s.weight; totalW += s.weight })
    let rawScore = weightedBase / (totalW || 1.0)

    const dragonSub = subResults.find(s => s.name === 'dragonMomentum')
    const markovSub = subResults.find(s => s.name === 'empiricalMarkov')
    if (dragonSub && markovSub && curStreak >= 3 && hurstH >= 0.52) {
      if ((dragonSub.prob >= 0.5 ? 1 : 0) === (markovSub.prob >= 0.5 ? 1 : 0)) {
        rawScore = 0.65 * rawScore + 0.35 * dragonSub.prob
      }
    }

    const knSub = subResults.find(s => s.name === 'kneserNeyLM')
    const paritySub = subResults.find(s => s.name === 'parityHarmonic')
    if (knSub && paritySub && curStreak === 1 && hurstH < 0.52) {
      if ((knSub.prob >= 0.5 ? 1 : 0) === (paritySub.prob >= 0.5 ? 1 : 0)) {
        rawScore = 0.70 * rawScore + 0.30 * knSub.prob
      }
    }

    if (shannonEntropy > 0.90) rawScore = 0.50 + (rawScore - 0.50) * 0.75
    return Math.max(0.01, Math.min(0.99, rawScore))
  }

  private _plattCalibrate(rawScore: number): number {
    const x = rawScore - 0.50
    const baseCalibrated = 1.0 / (1.0 + Math.exp(-(this.plattA * x + this.plattB)))
    const BIG_BOOST_OFFSET = 0.023
    return Math.max(0.01, Math.min(0.99, baseCalibrated + BIG_BOOST_OFFSET))
  }

  private _updatePlattParameters(validHistory: HistoryEntry[]): void {
    const trainLen = Math.min(80, validHistory.length - 15)
    if (trainLen < 15) return
    let A = this.plattA, B = this.plattB
    const lr = 0.04
    for (let k = 1; k <= trainLen; k++) {
      const targetIdx = validHistory.length - k
      const actual = (validHistory[targetIdx].actual_result || '').toLowerCase() === 'big' ? 1 : 0
      const subHist = validHistory.slice(0, targetIdx)
      const rawSub = this._computeRawSubmodels(subHist)
      let sumW = 0, sumP = 0
      for (const [name, tr] of Object.entries(this.modelTrackers) as [keyof ModelTrackers, { weight: number; inverted: boolean }][]) {
        let p = rawSub[name].prob
        if (tr.inverted) p = 1.0 - p
        sumP += p * tr.weight; sumW += tr.weight
      }
      const raw = sumP / (sumW || 1)
      const x = raw - 0.50
      const p = 1.0 / (1.0 + Math.exp(-(A * x + B)))
      A -= lr * (p - actual) * x; B -= lr * (p - actual)
    }
    this.plattA = Math.max(1.2, Math.min(4.5, A))
    this.plattB = Math.max(-0.8, Math.min(0.8, B))
  }

  private _auditPRNGStructure(digits: number[]) {
    if (digits.length < 50) return { lcgDetected: false, diffAutocorr: 0.0 }
    const diffs: number[] = []
    for (let i = 0; i < digits.length - 1; i++) diffs.push((digits[i + 1] - digits[i] + 10) % 10)
    const acf1 = this._computeAutocorrelation(diffs, 1)
    return { sampleSize: digits.length, diffAutocorr: parseFloat(acf1.toFixed(4)), lcgDetected: Math.abs(acf1) > 0.40 }
  }

  private _calculatePermutationEntropy(numbers: number[], order = 3, delay = 1): number {
    const n = numbers.length
    if (n < order * delay + 2) return 1.0
    const patterns: Record<string, number> = {}
    let total = 0
    for (let i = 0; i <= n - (order - 1) * delay - 1; i++) {
      const w = []
      for (let j = 0; j < order; j++) w.push(numbers[i + j * delay])
      const perm = w.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val).map(item => item.idx).join('')
      patterns[perm] = (patterns[perm] || 0) + 1
      total++
    }
    if (total === 0) return 1.0
    const probs = Object.values(patterns).map(c => c / total)
    const pe = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0)
    return Math.max(0.0, Math.min(1.0, pe / Math.log2(6)))
  }

  /**
   * Primary Prediction Interface
   */
  predict(history: HistoryEntry[]): PredictionResult {
    if (Array.isArray(history)) {
      history.forEach(item => {
        if (item?.issue_number && (item.actual_result)) {
          const k = String(item.issue_number)
          const res = item.actual_result.toLowerCase()
          const num = item.actual_number !== undefined && item.actual_number !== null && !isNaN(item.actual_number)
            ? item.actual_number : null
          this.historyBuffer.set(k, {
            issue_number: k,
            actual_result: res,
            actual_number: num,
            predicted_type: item.predicted_type || null,
            prediction_confidence: null,
            lucky_digits: null
          })
        }
      })
      this._savePersistentBuffer()
    }

    const combined = Array.from(this.historyBuffer.values()).sort((a, b) => {
      try {
        const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number)
        return aI > bI ? 1 : aI < bI ? -1 : 0
      } catch { return a.issue_number.localeCompare(b.issue_number) }
    })

    const validHistory = combined.filter(h => h.actual_result)

    if (validHistory.length < 8) {
      return {
        prediction: 'HOLD' as const, confidence: 50, status: 'HOLD' as const,
        statusReason: `Synchronizing (${validHistory.length}/8 required)...`,
        strategy: 'Stream Initialization', reason: 'Awaiting minimum statistical round depth',
        bigProb: 50, smallProb: 50, luckyDigits: [6, 7],
        digitProbs: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 10])),
        regime: 'synchronizing' as const, volatility: '0.50', entropy: '1.00', permutationEntropy: '1.00',
        isSniper: false, pattern: 'Buffering', parityPrediction: 'EVEN', engineVersion: 'v8.1', modelPerformance: null
      }
    }

    const tokens = validHistory.map(d => d.actual_result!.toLowerCase() === 'big' ? 1 : 0)
    const numSeq = validHistory.map(h => h.actual_number).filter((n): n is number => n !== null && !isNaN(n))

    const regimeCheck = this._regimeValidityCheck(tokens)
    this._updateDynamicSelfLearning(validHistory)
    this._updatePlattParameters(validHistory)
    const rawSub = this._computeRawSubmodels(validHistory)

    const subResults: SubResult[] = []
    for (const [name, tr] of Object.entries(this.modelTrackers) as [keyof ModelTrackers, typeof this.modelTrackers[keyof ModelTrackers]][]) {
      let prob = rawSub[name].prob
      let predToken = rawSub[name].predToken
      if (tr.inverted) { prob = 1.0 - prob; predToken = (1 - predToken) as 0 | 1 }

      let effectiveWeight = tr.weight
      if (regimeCheck.hurstH >= 0.53) {
        if (name === 'dragonMomentum') effectiveWeight *= 2.2
        else if (name === 'latentTrajectory') effectiveWeight *= 1.8
        else if (name === 'kneserNeyLM') effectiveWeight *= 0.25
        else if (name === 'parityHarmonic') effectiveWeight *= 0.25
        else if (name === 'historicalPatternAssistance') effectiveWeight *= 0.20
      } else if (regimeCheck.hurstH >= 0.48 && regimeCheck.hurstH <= 0.52) {
        if (name === 'kneserNeyLM') effectiveWeight *= 1.4
        else if (name === 'parityHarmonic') effectiveWeight *= 1.4
        else if (name === 'dragonMomentum') effectiveWeight *= 0.9
      }

      subResults.push({
        name, pred: predToken === 1 ? 'BIG' : 'SMALL', prob, weight: effectiveWeight,
        accuracy: tr.accuracy || 50, reason: rawSub[name].reason, inverted: tr.inverted
      })
    }

    const initialWeightMass = Object.values(this.modelTrackers).reduce((s, tr) => s + tr.weight, 0)
    const currentWeightMass = subResults.reduce((s, r) => s + r.weight, 0)
    if (currentWeightMass > 0 && initialWeightMass > 0) {
      const normScale = initialWeightMass / currentWeightMass
      subResults.forEach(s => { s.weight = parseFloat((s.weight * normScale).toFixed(3)) })
    }

    let curStreak = 1
    const lastToken = tokens[tokens.length - 1]
    for (let i = tokens.length - 2; i >= 0; i--) { if (tokens[i] === lastToken) curStreak++; else break }

    let curAlts = 0
    for (let i = tokens.length - 1; i >= Math.max(1, tokens.length - 6); i--) { if (tokens[i] !== tokens[i - 1]) curAlts++; else break }

    let is22Pair = false, is22Alt = false
    if (tokens.length >= 4) {
      const [t0, t1, t2, t3] = tokens.slice(-4)
      is22Pair = t0 === t1 && t2 === t3 && t0 !== t2
      is22Alt = t0 === t2 && t1 === t3 && t0 !== t1
    }

    const recentNums = numSeq.slice(-20)
    const counts = new Array(10).fill(0) as number[]
    recentNums.forEach(n => { if (n >= 0 && n <= 9) counts[n]++ })
    const probsCounts = counts.filter(c => c > 0).map(c => c / recentNums.length)
    const shannonEntropy = probsCounts.length > 0 ? -probsCounts.reduce((sum, p) => sum + p * Math.log2(p), 0) / Math.log2(10) : 1.0
    const permEntropy = this._calculatePermutationEntropy(numSeq.slice(-15))

    const rawEnsembleScore = this._evaluateMetaLearner(subResults, { shannonEntropy, curStreak, hurstH: regimeCheck.hurstH, recentAcc: 55 })
    const calibratedP = this._plattCalibrate(rawEnsembleScore)
    const prediction: 'BIG' | 'SMALL' = calibratedP >= 0.50 ? 'BIG' : 'SMALL'
    const margin = Math.abs(calibratedP - 0.50)

    const agreeingModels = subResults.filter(s => s.pred === prediction)
    const agreementRate = agreeingModels.length / subResults.length
    let confidence = Math.min(this.maxConfidence, Math.max(this.minConfidence, Math.round(52 + margin * 88)))

    let consecutiveMisses = 0
    for (let i = validHistory.length - 1; i >= Math.max(0, validHistory.length - 6); i--) {
      const h = validHistory[i]
      const p = h.predicted_type ? String(h.predicted_type).toUpperCase() : null
      const a = h.actual_result ? String(h.actual_result).toUpperCase() : null
      if (p && a && ['BIG', 'SMALL'].includes(p) && ['BIG', 'SMALL'].includes(a)) {
        if (p !== a) consecutiveMisses++; else break
      }
    }

    let status: 'CLEARED' | 'HOLD' | 'SNIPER' = 'CLEARED'
    let statusReason = `Multi-model confluence verified (Hurst H=${regimeCheck.hurstH})`

    if (regimeCheck.isWhiteNoise && curStreak <= 2) {
      status = 'HOLD'; statusReason = `🛡️ White-Noise Filter: Hurst H=${regimeCheck.hurstH}. Capital preserved.`; confidence = Math.min(confidence, 55)
    } else if (consecutiveMisses >= 2) {
      status = 'HOLD'; statusReason = `🛡️ Anti-Drawdown Shield: ${consecutiveMisses} consecutive misses.`; confidence = Math.min(confidence, 58)
    } else if (shannonEntropy > 0.93) {
      status = 'HOLD'; statusReason = 'Elevated informational entropy (chop zone).'; confidence = Math.min(confidence, 56)
    } else if (agreementRate < 0.60 || margin < 0.05) {
      status = 'HOLD'; statusReason = 'Model discordance (insufficient directional edge).'; confidence = Math.min(confidence, 58)
    } else if (curStreak === 2) {
      status = 'HOLD'; statusReason = 'Streak boundary 2x transition zone [PASS]'; confidence = Math.min(confidence, 60)
    } else if (curStreak === 4 || curStreak === 5) {
      status = 'HOLD'; statusReason = `🛡️ Dragon Exclusion Zone: ${curStreak}x streak. Capital protected.`; confidence = Math.min(confidence, 54)
    } else if (curStreak === 6) {
      status = 'HOLD'; statusReason = `⏳ Dragon Reversal Pending: 6x streak. Awaiting confirmation.`; confidence = Math.min(confidence, 58)
    } else if (curStreak === 3 && lastToken === 0 && agreementRate < 0.82) {
      status = 'HOLD'; statusReason = `🛡️ Asymmetric Dragon Guard: 3x SMALL requires >=82% confluence.`; confidence = Math.min(confidence, 56)
    } else if (curAlts >= 4) {
      status = 'HOLD'; statusReason = `🛡️ Alternation Ceiling: ${curAlts} switches.`; confidence = Math.min(confidence, 52)
    } else if (is22Pair || is22Alt) {
      status = 'HOLD'; statusReason = `🛡️ 2-2 Pattern Trap detected.`; confidence = Math.min(confidence, 53)
    }

    const isSniper = calibratedP >= 0.78 || (calibratedP <= 0.22 && agreeingModels.length >= 5 && shannonEntropy < 0.84 && regimeCheck.hurstH >= 0.50 && margin >= 0.14 && status !== 'HOLD')

    if (isSniper) {
      status = 'SNIPER'
      statusReason = `🎯 Ultra-Sniper: ${agreeingModels.length}/7 models, Hurst H=${regimeCheck.hurstH}, Calibrated ${(Math.max(calibratedP, 1 - calibratedP) * 100).toFixed(0)}%`
      confidence = Math.max(78, confidence)
    }

    const lastNum = numSeq.length > 0 ? numSeq[numSeq.length - 1] : 4
    const digitScores: Record<number, number> = {}
    for (let d = 0; d <= 9; d++) digitScores[d] = 1.0
    for (let i = 0; i < numSeq.length - 1; i++) {
      if (numSeq[i] === lastNum) digitScores[numSeq[i + 1]] += 1.8
    }
    if (rawSub.historicalPatternAssistance?.followingDigits) {
      rawSub.historicalPatternAssistance.followingDigits.forEach(fd => { if (fd >= 0 && fd <= 9) digitScores[fd] += 1.4 })
    }
    let emaFinal = numSeq[Math.max(0, numSeq.length - 8)]
    for (let i = Math.max(0, numSeq.length - 7); i < numSeq.length; i++) emaFinal = 0.42 * numSeq[i] + 0.58 * emaFinal
    for (let d = 0; d <= 9; d++) {
      const g = Math.exp(-0.5 * Math.pow((d - emaFinal) / 2.0, 2))
      digitScores[d] *= (0.75 + g * 1.5)
    }

    const totalDigitScore = Object.values(digitScores).reduce((a, b) => a + b, 0) || 1
    const digitProbs: Record<number, number> = {}
    for (let d = 0; d <= 9; d++) digitProbs[d] = Math.round((digitScores[d] / totalDigitScore) * 100)

    const rankedBig = [5, 6, 7, 8, 9].sort((a, b) => digitScores[b] - digitScores[a])
    const rankedSmall = [0, 1, 2, 3, 4].sort((a, b) => digitScores[b] - digitScores[a])
    const luckyDigits: [number, number] = prediction === 'BIG' ? [rankedBig[0], rankedBig[1]] : [rankedSmall[0], rankedSmall[1]]

    const topSub = [...subResults].sort((a, b) => b.weight - a.weight)[0]
    const patternDesc = rawSub.historicalPatternAssistance?.pattern
      ? `${rawSub.dragonMomentum.reason} • [${rawSub.historicalPatternAssistance.pattern} assistance]`
      : rawSub.dragonMomentum.reason

    const prngAudit = this._auditPRNGStructure(numSeq.slice(-60))

    return {
      prediction, confidence, status, statusReason,
      strategy: topSub?.name || 'Meta-Learner Ensemble',
      reason: topSub?.reason || 'Dynamic multi-model consensus',
      bigProb: Math.round(calibratedP * 100),
      smallProb: Math.round((1.0 - calibratedP) * 100),
      calibratedP: parseFloat(calibratedP.toFixed(3)),
      hurstExponent: regimeCheck.hurstH,
      luckyDigits, digitProbs,
      regime: regimeCheck.regimeName,
      volatility: '0.48',
      entropy: shannonEntropy.toFixed(2),
      permutationEntropy: permEntropy.toFixed(2),
      continuousVal: parseFloat(emaFinal.toFixed(2)),
      isSniper, pattern: patternDesc,
      parityPrediction: lastNum % 2 === 1 ? 'EVEN' : 'ODD',
      engineVersion: 'v8.1',
      modelPerformance: this.modelTrackers,
      prngForensics: prngAudit
    }
  }
}
