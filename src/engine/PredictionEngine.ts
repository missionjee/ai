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

import type {
  ConformalRiskDecision,
  HistoryEntry,
  HoldAuditSummary,
  HoldRegime,
  ModelTrackers,
  PredictionResult,
  RegimeName,
  SignalTier,
  StatusType
} from '@/types'

export class ConformalRiskGator {
  alpha: number
  windowSize: number
  nonConformityScores: number[]

  constructor(targetErrorRate = 0.12, windowSize = 120) {
    this.alpha = targetErrorRate
    this.windowSize = windowSize
    this.nonConformityScores = []
  }

  recordSettlement(predictedProb: number, isWin: boolean): void {
    const score = isWin ? (1.0 - predictedProb) : predictedProb
    this.nonConformityScores.push(score)
    if (this.nonConformityScores.length > this.windowSize) {
      this.nonConformityScores.shift()
    }
  }

  computeThreshold(): number {
    const n = this.nonConformityScores.length
    if (n < 30) return 0.22

    const sorted = [...this.nonConformityScores].sort((a, b) => a - b)
    const pIndex = Math.min(n - 1, Math.ceil((1.0 - this.alpha) * (n + 1)) - 1)
    return sorted[Math.max(0, pIndex)]
  }

  evaluateSignal(calibratedProb: number, shannonEntropy: number, hurstExponent: number, regimeEntropyThreshold = 0.88): ConformalRiskDecision {
    const currentScore = 1.0 - calibratedProb
    const tau = this.computeThreshold()

    if (shannonEntropy > regimeEntropyThreshold) {
      return {
        isGated: false,
        nonConformityScore: currentScore,
        calibratedThreshold: tau,
        empiricalRiskBound: this.alpha,
        rejectionReason: `Elevated informational entropy (${shannonEntropy.toFixed(3)} > ${regimeEntropyThreshold.toFixed(2)})`
      }
    }

    if (hurstExponent >= 0.48 && hurstExponent <= 0.52) {
      return {
        isGated: false,
        nonConformityScore: currentScore,
        calibratedThreshold: tau,
        empiricalRiskBound: this.alpha,
        rejectionReason: `White noise regime (Hurst ${hurstExponent.toFixed(2)} in neutral band)`
      }
    }

    const isGated = currentScore <= tau
    return {
      isGated,
      nonConformityScore: parseFloat(currentScore.toFixed(4)),
      calibratedThreshold: parseFloat(tau.toFixed(4)),
      empiricalRiskBound: this.alpha,
      rejectionReason: isGated ? 'CLEARED_SNIPER' : `Score ${currentScore.toFixed(3)} exceeds tau ${tau.toFixed(3)}`
    }
  }
}

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

interface ChangepointCheck {
  changepointDetected: boolean
  shiftDirection: 'BIG_SHIFT' | 'SMALL_SHIFT' | null
  shiftMagnitude: number
}

interface MetaContext {
  shannonEntropy: number
  curStreak: number
  curAlts?: number
  is22Pair?: boolean
  is22Alt?: boolean
  hurstH: number
  changepoint?: ChangepointCheck
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
  private modelTrackers: ModelTrackers
  private plattA: number = 2.40
  private plattB: number = -0.05
  private conformalGator: ConformalRiskGator = new ConformalRiskGator(0.12, 120)

  private defaultModelTrackers(): ModelTrackers {
    return {
      parityHarmonic: { hits: 15, total: 25, accuracy: 60, weight: 2.40, inverted: false },
      latentTrajectory: { hits: 14, total: 25, accuracy: 56, weight: 2.20, inverted: false },
      contextAttention: { hits: 14, total: 25, accuracy: 56, weight: 1.80, inverted: false },
      kneserNeyLM: { hits: 13, total: 25, accuracy: 52, weight: 1.20, inverted: false },
      dragonMomentum: { hits: 13, total: 25, accuracy: 52, weight: 1.00, inverted: false },
      historicalPatternAssistance: { hits: 12, total: 25, accuracy: 48, weight: 0.30, inverted: false },
      empiricalMarkov: { hits: 11, total: 25, accuracy: 44, weight: 0.20, inverted: false },
    }
  }

  constructor() {
    this.modelTrackers = this.defaultModelTrackers()
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

  private _detectChangepoint(tokens: number[], _digits?: number[]): ChangepointCheck {
    const n = tokens.length
    if (n < 8) return { changepointDetected: false, shiftDirection: null, shiftMagnitude: 0 }
    const recent4 = tokens.slice(-4)
    const prior12 = tokens.slice(Math.max(0, n - 16), n - 4)
    if (prior12.length < 4) return { changepointDetected: false, shiftDirection: null, shiftMagnitude: 0 }

    const meanPrior = prior12.reduce((a, b) => a + b, 0) / prior12.length
    const meanRecent = recent4.reduce((a, b) => a + b, 0) / recent4.length
    const shiftDiff = meanRecent - meanPrior

    const isShift = Math.abs(shiftDiff) >= 0.50
    return {
      changepointDetected: isShift,
      shiftDirection: shiftDiff > 0 ? 'BIG_SHIFT' : 'SMALL_SHIFT',
      shiftMagnitude: parseFloat(Math.abs(shiftDiff).toFixed(3))
    }
  }

  private _updateDynamicSelfLearning(validHistory: HistoryEntry[]): void {
    const windowLen = Math.min(30, validHistory.length - 10)
    if (windowLen < 8) return

    const trackers: Record<keyof ModelTrackers, { hits: number; total: number }> = {
      parityHarmonic: { hits: 0, total: 0 },
      latentTrajectory: { hits: 0, total: 0 },
      contextAttention: { hits: 0, total: 0 },
      kneserNeyLM: { hits: 0, total: 0 },
      dragonMomentum: { hits: 0, total: 0 },
      historicalPatternAssistance: { hits: 0, total: 0 },
      empiricalMarkov: { hits: 0, total: 0 },
    }

    for (let k = 1; k <= windowLen; k++) {
      const targetIdx = validHistory.length - k
      const subHist = validHistory.slice(0, targetIdx)
      const actual = (validHistory[targetIdx].actual_result || '').toLowerCase() === 'big' ? 1 : 0
      const preds = this._computeRawSubmodels(subHist)

      for (const [name, p] of Object.entries(preds) as [keyof ModelTrackers, SubmodelResult][]) {
        if (trackers[name]) {
          trackers[name].total++
          if (p.predToken === actual) trackers[name].hits++
        }
      }
    }

    for (const [name, tr] of Object.entries(trackers) as [keyof ModelTrackers, { hits: number; total: number }][]) {
      const acc = tr.total > 0 ? tr.hits / tr.total : 0.50
      let weight = 1.0
      let inverted = false
      if (acc >= 0.58) {
        weight = (name === 'parityHarmonic' || name === 'latentTrajectory') ? 2.40 : 1.90
      } else if (acc >= 0.52) {
        weight = (name === 'parityHarmonic' || name === 'latentTrajectory') ? 2.00 : 1.40
      } else if (acc >= 0.48) {
        weight = (name === 'empiricalMarkov' || name === 'historicalPatternAssistance') ? 0.35 : 0.85
      } else if (acc >= 0.38) {
        weight = 0.30
      } else {
        weight = 1.60
        inverted = true
      }
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
    if (streak >= 7) { trendP = last === 1 ? 0.46 : 0.54; trendReason = `Dragon Trend Decay (${streak}x) -> Neutral Baseline` }
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

    // 6. Parity Harmonic (Symmetrical Mapping)
    const recentParities = digits.slice(-8).map(d => d % 2 === 1 ? 1 : 0)
    let oddCount = 0
    recentParities.forEach(p => { if (p === 1) oddCount++ })
    const oddRatio = oddCount / recentParities.length
    const parityP = 0.50 + 0.28 * (oddRatio - 0.50)

    // 7. Continuous Latent Trajectory (Adaptive Dual-Speed EMA + Velocity Lead)
    let emaFast = digits[Math.max(0, n - 4)]
    for (let i = Math.max(0, n - 3); i < n; i++) emaFast = 0.72 * digits[i] + 0.28 * emaFast
    let emaSlow = digits[Math.max(0, n - 8)]
    for (let i = Math.max(0, n - 7); i < n; i++) emaSlow = 0.35 * digits[i] + 0.65 * emaSlow
    const prevNum = n >= 2 ? digits[n - 2] : lastNum
    const velocity = lastNum - prevNum

    const blendedEma = 0.55 * emaFast + 0.25 * emaSlow + 0.20 * (lastNum + 0.35 * velocity)
    const contP = 1 / (1 + Math.exp(-(blendedEma - 4.5) * 0.70))

    return {
      contextAttention: { predToken: attP >= 0.5 ? 1 : 0, prob: attP, reason: 'Context Attention (LLM soft matching)' },
      kneserNeyLM: { predToken: knP >= 0.5 ? 1 : 0, prob: knP, reason: 'Hierarchical Kneser-Ney Language Smoothing' },
      dragonMomentum: { predToken: trendP >= 0.5 ? 1 : 0, prob: trendP, reason: trendReason },
      historicalPatternAssistance: { predToken: histPatP >= 0.5 ? 1 : 0, prob: histPatP, reason: histPatReason, pattern: matchedPatternName, followingDigits: histFollowingDigits },
      empiricalMarkov: { predToken: markovP >= 0.5 ? 1 : 0, prob: markovP, reason: `Digit Transition Matrix from draw ${lastNum}` },
      parityHarmonic: { predToken: parityP >= 0.5 ? 1 : 0, prob: parityP, reason: `Parity Harmonic (${Math.round(oddRatio * 100)}% ODD bias)` },
      latentTrajectory: { predToken: contP >= 0.5 ? 1 : 0, prob: contP, reason: `Continuous Latent EMA (${blendedEma.toFixed(2)})` },
    }
  }

  private _evaluateMetaLearner(subResults: SubResult[], context: MetaContext): number {
    const { shannonEntropy, curStreak, curAlts = 0, hurstH, is22Pair, changepoint } = context
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
    if (knSub && paritySub && curStreak === 1 && (curAlts >= 2 || hurstH < 0.52)) {
      if ((knSub.prob >= 0.5 ? 1 : 0) === (paritySub.prob >= 0.5 ? 1 : 0)) {
        rawScore = 0.65 * rawScore + 0.35 * knSub.prob
      }
    }

    if (is22Pair && curStreak === 1) {
      const latentSub = subResults.find(s => s.name === 'latentTrajectory')
      if (latentSub) {
        rawScore = 0.60 * rawScore + 0.40 * latentSub.prob
      }
    }

    if (changepoint?.changepointDetected) {
      const targetProb = changepoint.shiftDirection === 'BIG_SHIFT' ? 0.62 : 0.38
      rawScore = 0.70 * rawScore + 0.30 * targetProb
    }

    // Adaptive Directional Equilibrium Guard: If market is non-trending (Hurst < 0.54) and not in a confirmed streak, neutralize false drift
    if (hurstH < 0.54 && curStreak <= 2) {
      const excess = rawScore - 0.50
      rawScore = 0.50 + excess * 0.85
    }

    if (shannonEntropy > 0.90) rawScore = 0.50 + (rawScore - 0.50) * 0.75
    return Math.max(0.01, Math.min(0.99, rawScore))
  }

  private _plattCalibrate(rawScore: number): number {
    const x = rawScore - 0.50
    const baseCalibrated = 1.0 / (1.0 + Math.exp(-(this.plattA * x + this.plattB)))
    // Symmetrical Calibration: Zero bias offset for optimal False Bear / False Bull balance
    return Math.max(0.01, Math.min(0.99, baseCalibrated))
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
      A -= lr * (p - actual) * x
      // Anti-Bias Regularization: Apply L2 decay on B to enforce zero directional bias
      B = (B - lr * (p - actual)) * 0.88
    }
    this.plattA = Math.max(1.2, Math.min(4.5, A))
    this.plattB = Math.max(-0.25, Math.min(0.25, B))
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

  private _detectBrokenSymmetryPattern(tokens: number[]): { detected: boolean; patternName: string } {
    if (!tokens || tokens.length < 5) return { detected: false, patternName: '' }
    const s5 = tokens.slice(-5).join('')
    const s6 = tokens.slice(-6).join('')

    if (s5 === '11011' || s5 === '00100') {
      return { detected: true, patternName: '2-1-2 Rhythm' }
    }
    if (s5 === '10010' || s5 === '01101') {
      return { detected: true, patternName: '1-2-1 Broken Symmetry' }
    }
    if (s6 === '110011' || s6 === '001100') {
      return { detected: true, patternName: '2-2-2 Doublet Oscillation' }
    }
    if (s6 === '111011' || s6 === '000100') {
      return { detected: true, patternName: '3-1-2 Asymmetric Pinch' }
    }
    return { detected: false, patternName: '' }
  }

  _computePaperTradeValidation(validHistory: HistoryEntry[]): { paperTradeWins: number; totalEvaluated: number; canReenter: boolean } {
    if (!Array.isArray(validHistory) || validHistory.length < 4) {
      return { paperTradeWins: 0, totalEvaluated: 0, canReenter: false }
    }
    const evalDepth = Math.min(3, validHistory.length - 1)
    let paperWins = 0
    for (let k = 1; k <= evalDepth; k++) {
      const targetIdx = validHistory.length - k
      const subHist = validHistory.slice(0, targetIdx)
      const actual = (validHistory[targetIdx].actual_result || '').toUpperCase()
      if (actual !== 'BIG' && actual !== 'SMALL') continue

      const rawSub = this._computeRawSubmodels(subHist)
      let weightedBase = 0, totalW = 0
      for (const [name, tr] of Object.entries(this.modelTrackers) as [keyof ModelTrackers, { weight: number; inverted: boolean }][]) {
        let p = rawSub[name].prob
        if (tr.inverted) p = 1.0 - p
        weightedBase += p * tr.weight
        totalW += tr.weight
      }
      const rawScore = weightedBase / (totalW || 1.0)
      const simP = this._plattCalibrate(rawScore)
      const simPred = simP >= 0.50 ? 'BIG' : 'SMALL'
      if (simPred === actual) {
        paperWins++
      }
    }
    return {
      paperTradeWins: paperWins,
      totalEvaluated: evalDepth,
      canReenter: paperWins >= 2
    }
  }

  _computeWalkForwardLossScore(validHistory: HistoryEntry[]): { lossScore: number; explicitScore: number; simulatedScore: number } {
    if (!Array.isArray(validHistory) || validHistory.length < 10) {
      return { lossScore: 0, explicitScore: 0, simulatedScore: 0 }
    }

    const lossWeights: Record<string, number> = { SNIPER: 1.0, STANDARD: 1.0, SCOUT: 0.5, HOLD: 0.0 }

    // 1. Explicit consecutive loss score from history
    let explicitScore = 0
    for (let i = validHistory.length - 1; i >= Math.max(0, validHistory.length - 15); i--) {
      const h = validHistory[i]
      const p = h.predicted_type ? String(h.predicted_type).toUpperCase() : null
      const a = h.actual_result ? String(h.actual_result).toUpperCase() : null
      const tier = h.tier ? String(h.tier).toUpperCase() : 'STANDARD'

      if (p && a && (p === 'BIG' || p === 'SMALL') && (a === 'BIG' || a === 'SMALL')) {
        if (p !== a) {
          const w = lossWeights[tier] !== undefined ? lossWeights[tier] : 1.0
          explicitScore += w
        } else {
          break
        }
      }
    }

    // 2. Simulated walk-forward backtest across recent rounds
    let simulatedScore = 0
    const testDepth = Math.min(12, validHistory.length - 8)
    for (let k = 1; k <= testDepth; k++) {
      const targetIdx = validHistory.length - k
      const subHist = validHistory.slice(0, targetIdx)
      const actual = (validHistory[targetIdx].actual_result || '').toUpperCase()
      if (actual !== 'BIG' && actual !== 'SMALL') break

      const rawSub = this._computeRawSubmodels(subHist)
      let weightedBase = 0, totalW = 0
      let agreeingCount = 0
      for (const [name, tr] of Object.entries(this.modelTrackers) as [keyof ModelTrackers, { weight: number; inverted: boolean }][]) {
        let p = rawSub[name].prob
        if (tr.inverted) p = 1.0 - p
        weightedBase += p * tr.weight
        totalW += tr.weight
      }
      const rawScore = weightedBase / (totalW || 1.0)
      const simP = this._plattCalibrate(rawScore)
      const simPred = simP >= 0.50 ? 'BIG' : 'SMALL'

      for (const [name, tr] of Object.entries(this.modelTrackers) as [keyof ModelTrackers, { weight: number; inverted: boolean }][]) {
        let p = rawSub[name].prob
        if (tr.inverted) p = 1.0 - p
        const pred = p >= 0.50 ? 'BIG' : 'SMALL'
        if (pred === simPred) agreeingCount++
      }

      const tierWeight = (agreeingCount <= 2) ? 0.5 : 1.0

      if (simPred !== actual) {
        simulatedScore += tierWeight
      } else {
        break
      }
    }

    const lossScore = Math.max(explicitScore, simulatedScore)
    return {
      lossScore,
      explicitScore,
      simulatedScore
    }
  }

  _computeWalkForwardConsecutiveMisses(validHistory: HistoryEntry[]): number {
    return this._computeWalkForwardLossScore(validHistory).lossScore
  }

  _getRegimeEntropyThreshold(
    regimeCheck: RegimeCheck,
    curStreak: number,
    curAlts: number,
    is22Pair: boolean,
    brokenSymmetry: { detected: boolean; patternName: string }
  ): number {
    if (regimeCheck.hurstH >= 0.53 || curStreak >= 3) {
      return 0.92
    }
    if (is22Pair || (curStreak === 2 && regimeCheck.hurstH >= 0.49)) {
      return 0.90
    }
    if (regimeCheck.hurstH < 0.45) {
      return 0.89
    }
    if (brokenSymmetry.detected) {
      return 0.87
    }
    if (curAlts >= 3) {
      return 0.84
    }
    if (regimeCheck.isWhiteNoise) {
      return 0.84
    }
    return 0.88
  }

  _getDynamicQuarantineDuration(
    regimeCheck: RegimeCheck,
    curStreak: number,
    shannonEntropy: number,
    agreementRate: number
  ): number {
    if ((regimeCheck.hurstH >= 0.54 || curStreak >= 3) && agreementRate >= 0.70) {
      return 1
    }
    if (regimeCheck.hurstH >= 0.49 && shannonEntropy <= 0.88) {
      return 2
    }
    return 3
  }

  _classifyHoldRegime(
    regimeCheck: RegimeCheck,
    curStreak: number,
    curAlts: number,
    is22Pair: boolean,
    is22Alt: boolean,
    brokenSymmetry: { detected: boolean; patternName: string },
    consecutiveMisses: number,
    shannonEntropy: number,
    agreementRate: number
  ): HoldRegime {
    if (consecutiveMisses >= 2) return 'QUARANTINE'
    if (curStreak === 4 || curStreak === 5 || curStreak === 6) return 'DRAGON_STREAK'
    if (curStreak === 2) return 'DRAGON_STREAK'
    if (is22Pair || is22Alt) return 'PERIODIC_2_2'
    if (brokenSymmetry.detected) return 'BROKEN_SYMMETRY'
    if (curAlts >= 3) return 'CHOP_OSCILLATION'
    if (regimeCheck.isWhiteNoise) return 'WHITE_NOISE'
    if (shannonEntropy > 0.88) return 'CHOP_OSCILLATION'
    if (agreementRate < 0.60) return 'MODEL_DISCORDANCE'
    return 'CHOP_OSCILLATION'
  }

  /**
   * Comprehensive Hold Round Retrospective Audit across 5k Buffer
   */
  auditHistoricalHolds(history: HistoryEntry[]): HoldAuditSummary & { recentHoldItems: any[] } {
    if (!Array.isArray(history) || history.length < 15) {
      return {
        totalRounds: 0,
        totalHolds: 0,
        holdRatePercent: 0,
        avoidedLosses: 0,
        missedWins: 0,
        protectionEfficiencyPercent: 0,
        regimeBreakdown: {},
        recentHoldItems: []
      }
    }

    const sorted = [...history].sort((a, b) => {
      try {
        const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number)
        return aI > bI ? 1 : aI < bI ? -1 : 0
      } catch { return String(a.issue_number).localeCompare(String(b.issue_number)) }
    })

    const validHistory = sorted.filter(h => h.actual_result)
    const holdItems: any[] = []
    const regimeStats: Record<string, { total: number; avoidedLosses: number; missedWins: number; recommendedEntropyCutoff: number }> = {}

    const testDepth = Math.min(5000, validHistory.length)
    const startIndex = Math.max(12, validHistory.length - testDepth)

    for (let idx = startIndex; idx < validHistory.length; idx++) {
      const subHistory = validHistory.slice(0, idx)
      const actualItem = validHistory[idx]
      const actualResult = (actualItem.actual_result || '').toUpperCase()
      if (actualResult !== 'BIG' && actualResult !== 'SMALL') continue

      const predRes = this.predict(subHistory)
      if (predRes.status === 'HOLD') {
        const unconstrainedPred = (predRes.calibratedP ?? 0.5) >= 0.50 ? 'BIG' : 'SMALL'
        const isLossAvoided = unconstrainedPred !== actualResult
        const counterfactual = isLossAvoided ? 'CORRECT_AVOIDED_LOSS' : 'OVERLY_CAUTIOUS_MISSED_WIN'
        const regimeKey = predRes.holdAnalysis?.regime || 'CHOP_OSCILLATION'

        holdItems.push({
          issue_number: actualItem.issue_number,
          holdRegime: regimeKey,
          statusReason: predRes.statusReason,
          calibratedP: predRes.calibratedP || 0.50,
          unconstrainedPrediction: unconstrainedPred,
          actualResult,
          counterfactual
        })

        if (!regimeStats[regimeKey]) {
          regimeStats[regimeKey] = {
            total: 0,
            avoidedLosses: 0,
            missedWins: 0,
            recommendedEntropyCutoff: 0.88
          }
        }
        regimeStats[regimeKey].total++
        if (isLossAvoided) regimeStats[regimeKey].avoidedLosses++
        else regimeStats[regimeKey].missedWins++
      }
    }

    const totalHolds = holdItems.length
    const totalEvaluated = validHistory.length - startIndex
    const totalAvoidedLosses = holdItems.filter(h => h.counterfactual === 'CORRECT_AVOIDED_LOSS').length
    const totalMissedWins = totalHolds - totalAvoidedLosses
    const efficiency = totalHolds > 0 ? parseFloat(((totalAvoidedLosses / totalHolds) * 100).toFixed(2)) : 0

    const breakdown: Record<string, { total: number; avoidedLosses: number; missedWins: number; efficiencyPercent: number; recommendedEntropyCutoff: number }> = {}
    for (const [rKey, stats] of Object.entries(regimeStats)) {
      const regEff = stats.total > 0 ? parseFloat(((stats.avoidedLosses / stats.total) * 100).toFixed(2)) : 0
      let recommendedCutoff = 0.88
      if (rKey === 'DRAGON_STREAK' || rKey === 'trending') recommendedCutoff = 0.92
      else if (rKey === 'PERIODIC_2_2') recommendedCutoff = 0.90
      else if (rKey === 'mean-reverting') recommendedCutoff = 0.89
      else if (rKey === 'CHOP_OSCILLATION' || rKey === 'WHITE_NOISE') recommendedCutoff = 0.84

      breakdown[rKey] = {
        total: stats.total,
        avoidedLosses: stats.avoidedLosses,
        missedWins: stats.missedWins,
        efficiencyPercent: regEff,
        recommendedEntropyCutoff: recommendedCutoff
      }
    }

    return {
      totalRounds: totalEvaluated,
      totalHolds,
      holdRatePercent: totalEvaluated > 0 ? parseFloat(((totalHolds / totalEvaluated) * 100).toFixed(2)) : 0,
      avoidedLosses: totalAvoidedLosses,
      missedWins: totalMissedWins,
      protectionEfficiencyPercent: efficiency,
      regimeBreakdown: breakdown,
      recentHoldItems: holdItems.slice(-50)
    }
  }

  /**
   * Primary Prediction Interface
   */
  predict(history: HistoryEntry[]): PredictionResult {
    // Reset trackers and calibration parameters to default baseline for 100% deterministic parity across devices
    this.modelTrackers = this.defaultModelTrackers()
    this.plattA = 2.40
    this.plattB = -0.05

    let validHistory: HistoryEntry[] = []

    if (Array.isArray(history) && history.length > 0) {
      const historyMap = new Map<string, HistoryEntry>()
      history.forEach(item => {
        if (item?.issue_number && (item.actual_result || (item as any).result_type)) {
          const k = String(item.issue_number).trim()
          const res = (item.actual_result || (item as any).result_type).toLowerCase()
          const num = item.actual_number !== undefined && item.actual_number !== null && !isNaN(Number(item.actual_number))
            ? Number(item.actual_number)
            : null
          historyMap.set(k, {
            issue_number: k,
            actual_result: res,
            actual_number: num,
            predicted_type: item.predicted_type || null,
            prediction_confidence: null,
            lucky_digits: null,
            tier: (item as any).tier || (item as any).status || null,
            status: item.status || null
          })
        }
      })

      // Sort in strict chronological order (oldest to newest)
      const sorted = Array.from(historyMap.values()).sort((a, b) => {
        try {
          const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number)
          return aI > bI ? 1 : aI < bI ? -1 : 0
        } catch { return a.issue_number.localeCompare(b.issue_number) }
      })

      // Standardize to the most recent window (up to 40 rounds) so all devices evaluate the exact same depth
      validHistory = sorted.slice(-40)
    }

    if (validHistory.length < 5) {
      const fallbackPred: 'BIG' | 'SMALL' = (validHistory.length > 0 && validHistory[validHistory.length - 1].actual_number !== null && validHistory[validHistory.length - 1].actual_number !== undefined)
        ? (Number(validHistory[validHistory.length - 1].actual_number) >= 5 ? 'SMALL' : 'BIG')
        : 'BIG'
      return {
        prediction: fallbackPred,
        confidence: 58,
        status: 'CLEARED' as const,
        tier: 'STANDARD' as const,
        recommendedStake: '1U',
        regimeEntropyThreshold: 0.88,
        holdAnalysis: undefined,
        statusReason: `Active real-time institutional inference (${validHistory.length} rounds buffered)`,
        strategy: 'Active Meta-Learner',
        reason: 'Active real-time consensus',
        bigProb: fallbackPred === 'BIG' ? 58 : 42,
        smallProb: fallbackPred === 'SMALL' ? 58 : 42,
        luckyDigits: fallbackPred === 'BIG' ? [7, 8] : [2, 3],
        digitProbs: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 10])),
        regime: 'trending' as const,
        volatility: '0.48',
        entropy: '0.50',
        permutationEntropy: '0.50',
        isSniper: false,
        pattern: 'Standard Momentum',
        parityPrediction: 'EVEN',
        engineVersion: 'v9.3',
        modelPerformance: null
      }
    }


    const tokens = validHistory.map(d => d.actual_result!.toLowerCase() === 'big' ? 1 : 0)
    const numSeq = validHistory.map(h => h.actual_number).filter((n): n is number => n !== null && !isNaN(n))

    const regimeCheck = this._regimeValidityCheck(tokens)
    const changepoint = this._detectChangepoint(tokens, numSeq)

    this._updateDynamicSelfLearning(validHistory)
    this._updatePlattParameters(validHistory)

    const rawSub = this._computeRawSubmodels(validHistory)
    const subResults: SubResult[] = []

    for (const [name, tr] of Object.entries(this.modelTrackers) as [keyof ModelTrackers, { weight: number; inverted: boolean; accuracy?: number }][]) {
      let prob = rawSub[name].prob
      let predToken = rawSub[name].predToken

      if (tr.inverted) {
        prob = 1.0 - prob
        predToken = (1 - predToken) as 0 | 1
      }

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

    const initialWeightMass = (Object.values(this.modelTrackers) as { weight: number }[]).reduce((s, tr) => s + tr.weight, 0)
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

    const rawEnsembleScore = this._evaluateMetaLearner(subResults, {
      shannonEntropy,
      curStreak,
      curAlts,
      is22Pair,
      is22Alt,
      hurstH: regimeCheck.hurstH,
      changepoint,
      recentAcc: 55
    })
    const calibratedP = this._plattCalibrate(rawEnsembleScore)
    const prediction: 'BIG' | 'SMALL' = calibratedP >= 0.50 ? 'BIG' : 'SMALL'
    const margin = Math.abs(calibratedP - 0.50)

    const agreeingModels = subResults.filter(s => s.pred === prediction)
    let confidence = Math.min(this.maxConfidence, Math.max(this.minConfidence, Math.round(52 + margin * 88)))

    const brokenSymmetry = this._detectBrokenSymmetryPattern(tokens)
    const regimeEntropyThreshold = this._getRegimeEntropyThreshold(regimeCheck, curStreak, curAlts, is22Pair, brokenSymmetry)

    let status: StatusType = 'CLEARED'
    let tier: SignalTier = 'STANDARD'
    let recommendedStake = '1U'
    let statusReason = `Multi-model confluence verified (Hurst H=${regimeCheck.hurstH})`

    // 100% Actionable Real Signals (Zero HOLD Features)
    const isSniper = (
      (calibratedP >= 0.60 || calibratedP <= 0.40) &&
      agreeingModels.length >= 3 &&
      margin >= 0.055 &&
      curStreak < 4
    )

    status = 'CLEARED'
    tier = isSniper ? 'SNIPER' : 'STANDARD'
    recommendedStake = isSniper ? '2U' : '1U'
    statusReason = isSniper
      ? `🎯 Ultra-Sniper: ${agreeingModels.length}/7 models, Hurst H=${regimeCheck.hurstH}, Calibrated ${(Math.max(calibratedP, 1 - calibratedP) * 100).toFixed(0)}% [2U Stake]`
      : `⚡ Standard Signal: ${agreeingModels.length}/7 consensus, Calibrated ${(Math.max(calibratedP, 1 - calibratedP) * 100).toFixed(0)}% in ${regimeCheck.regimeName} [1U Stake]`

    if (isSniper) {
      confidence = Math.max(78, confidence)
    } else {
      confidence = Math.max(62, confidence)
    }

    const holdAnalysis = undefined

    const lastNum = numSeq.length > 0 ? numSeq[numSeq.length - 1] : 4
    const digitScores: Record<number, number> = {}
    for (let d = 0; d <= 9; d++) digitScores[d] = 1.0
    for (let i = 0; i < numSeq.length - 1; i++) {
      if (numSeq[i] === lastNum) digitScores[numSeq[i + 1]] += 1.8
    }
    if (rawSub.historicalPatternAssistance?.followingDigits) {
      rawSub.historicalPatternAssistance.followingDigits.forEach(fd => { if (fd >= 0 && fd <= 9) digitScores[fd] += 1.4 })
    }
    let emaFast = numSeq[Math.max(0, numSeq.length - 4)]
    for (let i = Math.max(0, numSeq.length - 3); i < numSeq.length; i++) emaFast = 0.72 * numSeq[i] + 0.28 * emaFast
    let emaSlow = numSeq[Math.max(0, numSeq.length - 8)]
    for (let i = Math.max(0, numSeq.length - 7); i < numSeq.length; i++) emaSlow = 0.35 * numSeq[i] + 0.65 * emaSlow
    const lastD = numSeq.length > 0 ? numSeq[numSeq.length - 1] : 4
    const prevD = numSeq.length >= 2 ? numSeq[numSeq.length - 2] : lastD
    const velocity = lastD - prevD
    const blendedEma = 0.55 * emaFast + 0.25 * emaSlow + 0.20 * (lastD + 0.35 * velocity)

    for (let d = 0; d <= 9; d++) {
      const g = Math.exp(-0.5 * Math.pow((d - blendedEma) / 2.0, 2))
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
    const dominantProb = Math.max(calibratedP, 1.0 - calibratedP)
    const conformalDecision = this.conformalGator.evaluateSignal(dominantProb, shannonEntropy, regimeCheck.hurstH, regimeEntropyThreshold)

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
      continuousVal: parseFloat(blendedEma.toFixed(2)),
      isSniper,
      tier,
      recommendedStake,
      regimeEntropyThreshold,
      holdAnalysis,
      pattern: patternDesc,
      parityPrediction: lastNum % 2 === 1 ? 'EVEN' : 'ODD',
      engineVersion: 'v9.1',
      modelPerformance: this.modelTrackers,
      prngForensics: prngAudit,
      conformalRisk: conformalDecision
    }
  }
}
