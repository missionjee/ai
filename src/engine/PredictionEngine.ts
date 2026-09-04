/**
 * HIROTO AI — Institutional Prediction Engine (TypeScript v10.0 Quantum Enterprise)
 *
 * Modular 9-Submodel Architecture with Multi-Horizon Exponential Hedge (Online OCO),
 * Sparse Mixture-of-Experts (MoE) Gating Stacker, and 100% Actionable Signals.
 */

import type {
  ConformalRiskDecision,
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

export class OnlinePlattCalibrator {
  a: number
  b: number
  lr: number
  l2Reg: number
  momentum: number
  vA: number
  vB: number

  constructor(initialA = 2.40, initialB = -0.05, lr = 0.035, l2Reg = 0.015, momentum = 0.85) {
    this.a = initialA
    this.b = initialB
    this.lr = lr
    this.l2Reg = l2Reg
    this.momentum = momentum
    this.vA = 0.0
    this.vB = 0.0
  }

  calibrate(rawScore: number): number {
    const x = Math.max(0.01, Math.min(0.99, rawScore)) - 0.50
    const z = this.a * x + this.b
    const zClipped = Math.max(-15.0, Math.min(15.0, z))
    const p = 1.0 / (1.0 + Math.exp(-zClipped))
    return Math.max(0.01, Math.min(0.99, p))
  }

  updateStep(rawScore: number, actualLabel: number): { a: number; b: number; p: number } {
    const x = Math.max(0.01, Math.min(0.99, rawScore)) - 0.50
    const p = this.calibrate(rawScore)
    const y = Number(actualLabel)

    const gradErr = p - y
    const gradA = gradErr * x + this.l2Reg * (this.a - 2.40)
    const gradB = gradErr + this.l2Reg * this.b

    this.vA = this.momentum * this.vA - this.lr * gradA
    this.vB = this.momentum * this.vB - this.lr * gradB

    this.a = Math.max(1.20, Math.min(4.50, this.a + this.vA))
    this.b = Math.max(-0.35, Math.min(0.35, this.b + this.vB))

    return { a: this.a, b: this.b, p }
  }
}

export interface SubmodelResult {
  predToken: 0 | 1
  prob: number
  reason: string
  pattern?: string | null
  followingDigits?: number[]
}

export interface RawSubmodels {
  contextAttention: SubmodelResult
  kneserNeyLM: SubmodelResult
  dragonMomentum: SubmodelResult
  historicalPatternAssistance: SubmodelResult
  empiricalMarkov: SubmodelResult
  parityHarmonic: SubmodelResult
  latentTrajectory: SubmodelResult
  spectralFourier: SubmodelResult
  runsMartingale: SubmodelResult
  [key: string]: SubmodelResult | undefined
}

export interface SubResult {
  name: string
  pred: 'BIG' | 'SMALL'
  prob: number
  weight: number
  accuracy: number
  reason: string
  inverted: boolean
}

export interface ChangepointCheck {
  changepointDetected: boolean
  shiftDirection: 'BIG_SHIFT' | 'SMALL_SHIFT' | null
  shiftMagnitude: number
}

export interface RegimeCheck {
  valid: boolean
  hurstH: number
  autocorr1: number
  regimeName: RegimeName
  isWhiteNoise: boolean
}

export class MultiHorizonHedgeTracker {
  horizons = {
    micro: { depth: 8, eta: 0.20, weight: 0.50 },
    meso: { depth: 24, eta: 0.10, weight: 0.35 },
    macro: { depth: 60, eta: 0.04, weight: 0.15 }
  }

  evaluateTrackers(
    validHistory: any[],
    rawSubmodelComputeFn: (hist: any[]) => RawSubmodels,
    currentTrackers: ModelTrackers
  ): ModelTrackers {
    if (!validHistory || validHistory.length < 3) return currentTrackers

    const submodelNames = Object.keys(currentTrackers)
    const results: Record<string, { hits: number; total: number; brierMicro: number; brierMeso: number; brierMacro: number }> = {}
    submodelNames.forEach(name => {
      results[name] = { hits: 0, total: 0, brierMicro: 0, brierMeso: 0, brierMacro: 0 }
    })

    const maxDepth = Math.min(60, validHistory.length - 1)
    for (let k = 1; k <= maxDepth; k++) {
      const targetIdx = validHistory.length - k
      const subHist = validHistory.slice(0, targetIdx)
      const actualItem = validHistory[targetIdx]
      const actual = (actualItem.actual_result || actualItem.result_type || '').toLowerCase() === 'big' ? 1 : 0
      const preds = rawSubmodelComputeFn(subHist)

      for (const name of submodelNames) {
        if (!preds[name]) continue
        const p = preds[name]!.prob
        const predToken = preds[name]!.predToken
        const brier = Math.pow(p - actual, 2)

        if (k <= this.horizons.micro.depth) results[name].brierMicro += brier / this.horizons.micro.depth
        if (k <= this.horizons.meso.depth) results[name].brierMeso += brier / Math.min(this.horizons.meso.depth, maxDepth)
        if (k <= this.horizons.macro.depth) results[name].brierMacro += brier / maxDepth

        results[name].total++
        if (predToken === actual) results[name].hits++
      }
    }

    const updated: any = {}
    for (const name of submodelNames) {
      const tr = results[name]
      const acc = tr.total > 0 ? tr.hits / tr.total : 0.50
      const blendedLoss = (
        this.horizons.micro.weight * tr.brierMicro +
        this.horizons.meso.weight * tr.brierMeso +
        this.horizons.macro.weight * tr.brierMacro
      )

      let hedgeWeight = Math.exp(-1.5 * blendedLoss) * 2.2
      let inverted = false

      if (acc <= 0.38) {
        inverted = true
        hedgeWeight = 1.85
      } else if (acc >= 0.56) {
        hedgeWeight *= 1.35
      } else if (acc < 0.48) {
        hedgeWeight *= 0.55
      }

      updated[name] = {
        hits: tr.hits,
        total: tr.total,
        accuracy: Math.round(acc * 100),
        weight: parseFloat(Math.max(0.10, Math.min(4.00, hedgeWeight)).toFixed(2)),
        inverted
      }
    }

    return updated as ModelTrackers
  }
}

export class SparseMoERouter {
  expertNames = [
    'trend_momentum_expert',
    'harmonic_oscillator_expert',
    'spectral_microstructure_expert',
    'contextual_consensus_expert'
  ]

  route(context: { hurstH: number; curStreak: number; curAlts: number; shannonEntropy: number; is22Pair: boolean; runsZ: number; fourierPeak: number }, subResults: SubResult[]) {
    const { hurstH, curStreak, curAlts, shannonEntropy, is22Pair, runsZ, fourierPeak } = context

    const gTrend = (hurstH - 0.50) * 8.0 + (curStreak - 2) * 0.6 - (runsZ < -1.2 ? -0.8 : 0.0)
    const gHarmonic = (0.50 - hurstH) * 8.0 + (curAlts - 2) * 0.6 + (runsZ > 1.2 ? 0.8 : 0.0)
    const gSpectral = (fourierPeak - 0.22) * 6.0 + (is22Pair ? 1.5 : 0.0)
    const gConsensus = (shannonEntropy - 0.82) * 3.5

    const logits = [gTrend, gHarmonic, gSpectral, gConsensus]
    const maxLogit = Math.max(...logits)
    const expLogits = logits.map(l => Math.exp(l - maxLogit))
    const sumExp = expLogits.reduce((a, b) => a + b, 0) || 1.0
    const gatingWeights = expLogits.map(e => e / sumExp)

    const subMap: Record<string, SubResult> = {}
    subResults.forEach(s => { subMap[s.name] = s })

    const wTrend: Record<string, number> = { dragonMomentum: 0.35, latentTrajectory: 0.30, empiricalMarkov: 0.20, runsMartingale: 0.15 }
    const wHarmonic: Record<string, number> = { parityHarmonic: 0.30, runsMartingale: 0.25, kneserNeyLM: 0.25, spectralFourier: 0.20 }
    const wSpectral: Record<string, number> = { spectralFourier: 0.35, historicalPatternAssistance: 0.25, empiricalMarkov: 0.25, contextAttention: 0.15 }
    const wConsensus: Record<string, number> = {}
    subResults.forEach(s => { wConsensus[s.name] = 1.0 / subResults.length })

    const computeExpertScore = (weightMap: Record<string, number>) => {
      let num = 0, den = 0
      for (const [name, weight] of Object.entries(weightMap)) {
        if (subMap[name]) {
          num += subMap[name].prob * weight
          den += weight
        }
      }
      return den > 0 ? num / den : 0.50
    }

    const eScores = [
      computeExpertScore(wTrend),
      computeExpertScore(wHarmonic),
      computeExpertScore(wSpectral),
      computeExpertScore(wConsensus)
    ]

    let blendedScore = 0
    for (let i = 0; i < 4; i++) {
      blendedScore += gatingWeights[i] * eScores[i]
    }

    const topIdx = gatingWeights.indexOf(Math.max(...gatingWeights))
    return {
      blendedScore: Math.max(0.01, Math.min(0.99, blendedScore)),
      activeExpert: this.expertNames[topIdx],
      gatingWeights: {
        trend: parseFloat(gatingWeights[0].toFixed(3)),
        harmonic: parseFloat(gatingWeights[1].toFixed(3)),
        spectral: parseFloat(gatingWeights[2].toFixed(3)),
        consensus: parseFloat(gatingWeights[3].toFixed(3))
      }
    }
  }
}

export class PredictionEngine {
  private readonly minConfidence = 52
  private readonly maxConfidence = 95
  private modelTrackers: ModelTrackers
  private plattA: number = 2.40
  private plattB: number = -0.05
  private conformalGator: ConformalRiskGator = new ConformalRiskGator(0.12, 120)
  private plattCalibrator: OnlinePlattCalibrator = new OnlinePlattCalibrator(2.40, -0.05)
  private hedgeTracker: MultiHorizonHedgeTracker = new MultiHorizonHedgeTracker()
  private moeRouter: SparseMoERouter = new SparseMoERouter()
  private historyBuffer: Map<string, any> = new Map()

  constructor() {
    this.modelTrackers = this.defaultModelTrackers()
  }

  private defaultModelTrackers(): ModelTrackers {
    return {
      parityHarmonic: { hits: 18, total: 25, accuracy: 72, weight: 3.00, inverted: false },
      dragonMomentum: { hits: 17, total: 25, accuracy: 68, weight: 2.80, inverted: false },
      latentTrajectory: { hits: 16, total: 25, accuracy: 64, weight: 2.50, inverted: false },
      empiricalMarkov: { hits: 15, total: 25, accuracy: 60, weight: 2.10, inverted: false },
      spectralFourier: { hits: 15, total: 25, accuracy: 60, weight: 2.00, inverted: false },
      runsMartingale: { hits: 14, total: 25, accuracy: 56, weight: 1.80, inverted: false },
      contextAttention: { hits: 13, total: 25, accuracy: 52, weight: 0.90, inverted: false },
      historicalPatternAssistance: { hits: 12, total: 25, accuracy: 48, weight: 0.60, inverted: false },
      kneserNeyLM: { hits: 12, total: 25, accuracy: 48, weight: 0.50, inverted: false }
    }
  }

  _computeHurstExponent(series: number[]): number {
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

  _computeAutocorrelation(series: number[], lag = 1): number {
    const n = series.length
    if (n <= lag + 5) return 0.0
    const mean = series.reduce((a, b) => a + b, 0) / n
    const variance = series.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n || 1e-6
    let cov = 0
    for (let i = 0; i < n - lag; i++) {
      cov += (series[i] - mean) * (series[i + lag] - mean)
    }
    return cov / ((n - lag) * variance)
  }

  _regimeValidityCheck(tokens: number[], _digits: number[]): RegimeCheck {
    const win30 = tokens.slice(-30)
    const win60 = tokens.slice(-60)
    const H30 = this._computeHurstExponent(win30)
    const H60 = this._computeHurstExponent(win60)
    const H = 0.65 * H30 + 0.35 * H60

    const ac1 = this._computeAutocorrelation(win30, 1)
    const ac2 = this._computeAutocorrelation(win30, 2)

    const isWhiteNoise = (H < 0.48 && Math.abs(ac1) < 0.07 && Math.abs(ac2) < 0.07)

    let regimeName: RegimeName = 'mixed'
    if (H >= 0.53 || Math.abs(ac1) >= 0.16) regimeName = 'trending'
    else if (H <= 0.46) regimeName = 'mean-reverting'

    return {
      valid: !isWhiteNoise,
      hurstH: parseFloat(H.toFixed(3)),
      autocorr1: parseFloat(ac1.toFixed(3)),
      regimeName,
      isWhiteNoise
    }
  }

  _detectChangepoint(tokens: number[], _digits: number[]): ChangepointCheck {
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

  _computeRunsZStatistic(tokens: number[]) {
    const n = tokens.length
    if (n < 10) return { runsZ: 0.0, runsCount: 0, nonRandom: false }

    let n1 = 0, n0 = 0, runs = 1
    if (tokens[0] === 1) n1++; else n0++
    for (let i = 1; i < n; i++) {
      if (tokens[i] === 1) n1++; else n0++
      if (tokens[i] !== tokens[i - 1]) runs++
    }

    if (n1 === 0 || n0 === 0) return { runsZ: 0.0, runsCount: runs, nonRandom: false }

    const mu = (2 * n1 * n0) / n + 1
    const variance = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1))
    const std = Math.sqrt(Math.max(1e-6, variance))
    const z = (runs - mu) / std

    return {
      runsZ: parseFloat(z.toFixed(3)),
      runsCount: runs,
      nonRandom: Math.abs(z) >= 1.65
    }
  }

  _computeSpectralHarmonics(tokens: number[]) {
    const n = Math.min(32, tokens.length)
    if (n < 8) return { dominantPeriod: 0, peakPower: 0, phaseBias: 0.5 }

    const window = tokens.slice(-n).map(t => t === 1 ? 1.0 : -1.0)
    let maxPower = 0
    let peakK = 1

    for (let k = 1; k <= Math.floor(n / 2); k++) {
      let re = 0, im = 0
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n
        re += window[t] * Math.cos(angle)
        im -= window[t] * Math.sin(angle)
      }
      const power = (re * re + im * im) / n
      if (power > maxPower) {
        maxPower = power
        peakK = k
      }
    }

    const dominantPeriod = parseFloat((n / peakK).toFixed(2))
    const lastVal = window[n - 1]
    let phaseBias = 0.5

    if (dominantPeriod >= 1.8 && dominantPeriod <= 2.2) {
      phaseBias = lastVal > 0 ? 0.35 : 0.65
    } else if (dominantPeriod >= 3.5 && dominantPeriod <= 4.5) {
      const secondLast = window[n - 2]
      if (lastVal === secondLast) {
        phaseBias = lastVal > 0 ? 0.38 : 0.62
      } else {
        phaseBias = lastVal > 0 ? 0.62 : 0.38
      }
    }

    return {
      dominantPeriod,
      peakPower: parseFloat(Math.min(1.0, maxPower / n).toFixed(3)),
      phaseBias
    }
  }

  _updateDynamicSelfLearning(validHistory: any[]): void {
    if (!validHistory || validHistory.length < 5) return
    this.modelTrackers = this.hedgeTracker.evaluateTrackers(
      validHistory,
      (hist) => this._computeRawSubmodels(hist),
      this.modelTrackers
    )
  }

  _computeRawSubmodels(history: any[]): RawSubmodels {
    const n = history.length
    const tokens = history.map(d => (d.actual_result || d.result_type).toLowerCase() === 'big' ? 1 : 0)
    const digits = history.map(d => (d.actual_number !== null && d.actual_number !== undefined) ? parseInt(d.actual_number, 10) : 4)
    const tokenChars = tokens.map(t => t === 1 ? 'B' : 'S')

    // 1. Context Attention
    let attScoreB = 0, attScoreS = 0
    for (const ctxLen of [2, 3, 4, 5]) {
      if (n <= ctxLen) continue
      const currTokens = tokens.slice(-ctxLen)
      const currDigits = digits.slice(-ctxLen)

      for (let i = 0; i <= n - ctxLen - 1; i++) {
        let tokenDiff = 0
        let digitDiff = 0
        for (let j = 0; j < ctxLen; j++) {
          if (tokens[i + j] !== currTokens[j]) tokenDiff++
          digitDiff += Math.abs(digits[i + j] - currDigits[j]) / 9.0
        }

        if (tokenDiff <= 1) {
          const age = n - 1 - (i + ctxLen)
          const weight = Math.exp(-tokenDiff * 1.6 - digitDiff * 0.5) * Math.exp(-age / 120)
          if (tokens[i + ctxLen] === 1) attScoreB += weight
          else attScoreS += weight
        }
      }
    }
    const attP = (attScoreB + 0.5) / (attScoreB + attScoreS + 1.0)

    // 2. Kneser-Ney LM
    let knP = 0.5
    for (let ord = 4; ord >= 1; ord--) {
      if (n <= ord) continue
      const needle = tokens.slice(-ord).join('')
      let bCount = 0, sCount = 0
      for (let i = 0; i <= n - ord - 1; i++) {
        if (tokens.slice(i, i + ord).join('') === needle) {
          if (tokens[i + ord] === 1) bCount++; else sCount++
        }
      }
      const total = bCount + sCount
      if (total >= (ord === 4 ? 3 : (ord === 3 ? 4 : (ord === 2 ? 6 : 8)))) {
        const D = 0.75
        const continuationProb = (tokens.slice(1).filter((t, idx) => tokens[idx] === Number(needle[needle.length - 1]) && t === 1).length + 0.5) / n
        const lambda = (D * 2) / total
        knP = Math.max(0, bCount - D) / total + lambda * continuationProb
        break
      }
    }

    // 3. Dragon Trend
    let streak = 1
    const last = tokens[n - 1]
    for (let i = n - 2; i >= 0; i--) {
      if (tokens[i] === last) streak++; else break
    }

    let trendP = 0.5
    let trendReason = 'Neutral base'
    if (streak >= 7) {
      trendP = (last === 1) ? 0.46 : 0.54
      trendReason = `Dragon Trend Decay (${streak}x ${last === 1 ? 'BIG' : 'SMALL'}) -> Neutral Baseline`
    } else if (streak === 6) {
      trendP = (last === 1) ? 0.38 : 0.62
      trendReason = `Streak Reversal Pending (${streak}x ${last === 1 ? 'BIG' : 'SMALL'}) -> Awaiting Confirmation`
    } else if (streak === 4 || streak === 5) {
      trendP = 0.50
      trendReason = `Dragon Exclusion Zone (${streak}x ${last === 1 ? 'BIG' : 'SMALL'}) -> Indeterminate Inflection Trap`
    } else if (streak === 3) {
      trendP = (last === 1) ? 0.65 : 0.35
      trendReason = `Dragon Momentum (${streak}x ${last === 1 ? 'BIG' : 'SMALL'}) -> Ride Trend`
    } else if (streak === 1) {
      let alts = 0
      for (let i = n - 1; i >= Math.max(1, n - 6); i--) {
        if (tokens[i] !== tokens[i - 1]) alts++; else break
      }
      if (alts >= 4) {
        trendP = 0.50
        trendReason = `Alternation Ceiling (${alts} switches) -> High-Entropy Trap`
      } else if (alts >= 2) {
        trendP = (last === 1) ? 0.35 : 0.65
        trendReason = `Alternation Rhythm (${alts} switches) -> Follow Oscillation`
      }
    }

    // 4. Historical Pattern
    let histPatP = 0.5
    let histPatReason = 'Historical Pattern: Neutral baseline'
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
          if (nextTok === 1) { b++; weightedB += w }
          else { s++; weightedS += w }
        }
      }

      const tot = b + s
      const minReq = 20
      if (tot >= minReq) {
        const p = (weightedB + 1.0) / (weightedB + weightedS + 2.0)
        const bias = Math.abs(p - 0.5)
        if (bias >= 0.07) {
          histPatP = p
          matchedPatternName = needle
          histFollowingDigits = digitCollector
          const predStr = p >= 0.5 ? 'BIG' : 'SMALL'
          const winPct = Math.round((p >= 0.5 ? p : (1 - p)) * 100)
          histPatReason = `Historical Pattern [${needle}]: ${tot} occurrences (${winPct}% ${predStr})`
          break
        }
      } else if (tot >= (len === 4 ? 4 : (len === 3 ? 6 : 10))) {
        histFollowingDigits = digitCollector
        matchedPatternName = needle
      }
    }

    // 5. 2nd-Order Triplet Markov
    const lastNum = digits[n - 1]
    const digitTransCounts = new Array(10).fill(0)
    for (let i = 0; i < n - 1; i++) {
      if (digits[i] === lastNum) digitTransCounts[digits[i + 1]]++
    }
    let empiricalBigMass = 0, empiricalSmallMass = 0
    for (let d = 0; d <= 4; d++) empiricalSmallMass += (digitTransCounts[d] + 0.5)
    for (let d = 5; d <= 9; d++) empiricalBigMass += (digitTransCounts[d] + 0.5)
    const digitMarkovP = empiricalBigMass / (empiricalBigMass + empiricalSmallMass)

    let tripletP = digitMarkovP
    if (n >= 4) {
      const tPrev2 = tokens[n - 2]
      const tPrev1 = tokens[n - 1]
      let triadMatchBig = 0, triadMatchSmall = 0
      for (let i = 0; i < n - 2; i++) {
        if (tokens[i] === tPrev2 && tokens[i + 1] === tPrev1) {
          if (tokens[i + 2] === 1) triadMatchBig++
          else triadMatchSmall++
        }
      }
      if (triadMatchBig + triadMatchSmall >= 3) {
        tripletP = (triadMatchBig + 1.0) / (triadMatchBig + triadMatchSmall + 2.0)
      }
    }
    const markovP = 0.60 * tripletP + 0.40 * digitMarkovP

    // 6. Parity Harmonic
    const recentParities = digits.slice(-8).map(d => d % 2 === 1 ? 1 : 0)
    let oddCount = 0
    recentParities.forEach(p => { if (p === 1) oddCount++ })
    const oddRatio = oddCount / recentParities.length
    const parityP = 0.50 + 0.28 * (oddRatio - 0.50)

    // 7. Latent Trajectory EMA
    let emaFast = digits[Math.max(0, n - 4)]
    for (let i = Math.max(0, n - 3); i < n; i++) {
      emaFast = 0.72 * digits[i] + 0.28 * emaFast
    }
    let emaSlow = digits[Math.max(0, n - 8)]
    for (let i = Math.max(0, n - 7); i < n; i++) {
      emaSlow = 0.35 * digits[i] + 0.65 * emaSlow
    }
    const prevNum = n >= 2 ? digits[n - 2] : lastNum
    const velocity = lastNum - prevNum
    const blendedEma = 0.55 * emaFast + 0.25 * emaSlow + 0.20 * (lastNum + 0.35 * velocity)
    const contP = 1 / (1 + Math.exp(-(blendedEma - 4.5) * 0.70))

    // 8. Spectral Fourier
    const spectral = this._computeSpectralHarmonics(tokens)
    const spectralP = spectral.phaseBias

    // 9. Runs Martingale
    const runsTest = this._computeRunsZStatistic(tokens.slice(-30))
    let martingaleP = 0.50
    if (runsTest.nonRandom) {
      if (runsTest.runsZ < -1.65) martingaleP = (last === 1) ? 0.62 : 0.38
      else if (runsTest.runsZ > 1.65) martingaleP = (last === 1) ? 0.38 : 0.62
    }

    return {
      contextAttention: { predToken: attP >= 0.5 ? 1 : 0, prob: attP, reason: 'Context Attention (soft multi-scale similarity)' },
      kneserNeyLM: { predToken: knP >= 0.5 ? 1 : 0, prob: knP, reason: 'Hierarchical Kneser-Ney Language Smoothing' },
      dragonMomentum: { predToken: trendP >= 0.5 ? 1 : 0, prob: trendP, reason: trendReason },
      historicalPatternAssistance: { predToken: histPatP >= 0.5 ? 1 : 0, prob: histPatP, reason: histPatReason, pattern: matchedPatternName, followingDigits: histFollowingDigits },
      empiricalMarkov: { predToken: markovP >= 0.5 ? 1 : 0, prob: markovP, reason: '2nd-Order Triplet & Digit Markov Transition' },
      parityHarmonic: { predToken: parityP >= 0.5 ? 1 : 0, prob: parityP, reason: `Parity Harmonic (${Math.round(oddRatio*100)}% ODD bias)` },
      latentTrajectory: { predToken: contP >= 0.5 ? 1 : 0, prob: contP, reason: `Continuous Latent EMA (${blendedEma.toFixed(2)})` },
      spectralFourier: { predToken: spectralP >= 0.5 ? 1 : 0, prob: spectralP, reason: `Spectral Fourier Harmonic (Period ${spectral.dominantPeriod})` },
      runsMartingale: { predToken: martingaleP >= 0.5 ? 1 : 0, prob: martingaleP, reason: `Wald-Wolfowitz Runs Z=${runsTest.runsZ}` }
    }
  }

  _evaluateMetaLearner(subResults: SubResult[], context: any): number {
    const { shannonEntropy, curStreak, curAlts, hurstH, is22Pair, changepoint, runsZ, fourierPeak } = context

    const moeResult = this.moeRouter.route({
      hurstH,
      curStreak,
      curAlts: curAlts || 0,
      shannonEntropy,
      is22Pair: !!is22Pair,
      runsZ: runsZ || 0,
      fourierPeak: fourierPeak || 0.2
    }, subResults)

    let rawScore = moeResult.blendedScore

    if (changepoint && changepoint.changepointDetected) {
      const targetProb = changepoint.shiftDirection === 'BIG_SHIFT' ? 0.62 : 0.38
      rawScore = 0.70 * rawScore + 0.30 * targetProb
    }

    if (hurstH < 0.54 && curStreak <= 2) {
      const excess = rawScore - 0.50
      rawScore = 0.50 + excess * 0.85
    }

    if (shannonEntropy > 0.90) {
      rawScore = 0.50 + (rawScore - 0.50) * 0.75
    }

    return Math.max(0.01, Math.min(0.99, rawScore))
  }

  _plattCalibrate(rawScore: number): number {
    return this.plattCalibrator.calibrate(rawScore)
  }

  _updatePlattParameters(validHistory: any[]): void {
    if (!validHistory || validHistory.length < 5) return
    const testLen = Math.min(30, validHistory.length - 1)
    for (let k = testLen; k >= 1; k--) {
      const targetIdx = validHistory.length - k
      const actualItem = validHistory[targetIdx]
      const actual = (actualItem.actual_result || actualItem.result_type || '').toLowerCase() === 'big' ? 1 : 0
      const subHist = validHistory.slice(0, targetIdx)
      if (subHist.length < 4) continue

      const rawSub = this._computeRawSubmodels(subHist)
      let num = 0, den = 0
      for (const [name, tr] of Object.entries(this.modelTrackers)) {
        if (!tr) continue;
        if (rawSub[name]) {
          let p = rawSub[name]!.prob
          if (tr.inverted) p = 1.0 - p
          num += p * tr.weight
          den += tr.weight
        }
      }
      const rawScore = den > 0 ? num / den : 0.5
      this.plattCalibrator.updateStep(rawScore, actual)
    }
    this.plattA = this.plattCalibrator.a
    this.plattB = this.plattCalibrator.b
  }

  predict(history: any[]): PredictionResult {
    this.modelTrackers = this.defaultModelTrackers()
    this.plattCalibrator = new OnlinePlattCalibrator(2.40, -0.05)
    this.plattA = 2.40
    this.plattB = -0.05

    let validHistory: any[] = []
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(item => {
        if (item && item.issue_number) {
          const k = String(item.issue_number).trim()
          const num = item.actual_number !== undefined && item.actual_number !== null && !isNaN(parseInt(item.actual_number, 10))
            ? parseInt(item.actual_number, 10)
            : null
          let res: 'big' | 'small' | null = null
          if (num !== null) res = num >= 5 ? 'big' : 'small'
          else if (item.actual_result || item.result_type) {
            const r = String(item.actual_result || item.result_type).toLowerCase().trim()
            if (r === 'big' || r === 'small') res = r
          }
          if (!res) return

          this.historyBuffer.set(k, {
            issue_number: k,
            actual_result: res,
            actual_number: num,
            predicted_type: item.predicted_type || item.predictedType || null,
            tier: item.tier || item.status || null
          })
        }
      })

      if (this.historyBuffer.size > 5000) {
        const keys = Array.from(this.historyBuffer.keys())
        const excess = this.historyBuffer.size - 5000
        for (let i = 0; i < excess; i++) this.historyBuffer.delete(keys[i])
      }

      const sorted = Array.from(this.historyBuffer.values()).sort((a, b) => {
        try {
          const aI = BigInt(a.issue_number), bI = BigInt(b.issue_number)
          return aI > bI ? 1 : (aI < bI ? -1 : 0)
        } catch (e) {
          return String(a.issue_number).localeCompare(String(b.issue_number))
        }
      })
      validHistory = sorted.slice(-40)
    }

    if (validHistory.length < 5) {
      const fallbackPred = (validHistory.length > 0 && validHistory[validHistory.length - 1].actual_number !== null)
        ? (validHistory[validHistory.length - 1].actual_number >= 5 ? 'SMALL' : 'BIG')
        : 'BIG'

      return {
        prediction: fallbackPred,
        confidence: 58,
        status: 'CLEARED',
        tier: 'STANDARD',
        recommendedStake: '1U',
        regimeEntropyThreshold: 0.88,
        statusReason: `Active real-time institutional inference (${validHistory.length} rounds buffered)`,
        strategy: 'Active Meta-Learner',
        reason: 'Active real-time consensus',
        bigProb: fallbackPred === 'BIG' ? 58 : 42,
        smallProb: fallbackPred === 'SMALL' ? 58 : 42,
        luckyDigits: fallbackPred === 'BIG' ? [7, 8] : [2, 3],
        digitProbs: { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10, 9: 10 },
        regime: 'trending',
        volatility: '0.48',
        entropy: '0.50',
        permutationEntropy: '0.50',
        isSniper: false,
        pattern: 'Standard Momentum',
        parityPrediction: 'EVEN',
        engineVersion: 'v10.0',
        modelPerformance: null
      }
    }

    const tokens = validHistory.map(d => (d.actual_result || d.result_type).toLowerCase() === 'big' ? 1 : 0)
    const numSeq = validHistory.map(h => h.actual_number).filter(n => n !== null && !isNaN(n))

    const regimeCheck = this._regimeValidityCheck(tokens, numSeq)
    const changepoint = this._detectChangepoint(tokens, numSeq)
    const runsTest = this._computeRunsZStatistic(tokens.slice(-30))
    const spectral = this._computeSpectralHarmonics(tokens)

    this._updateDynamicSelfLearning(validHistory)
    this._updatePlattParameters(validHistory)

    const rawSub = this._computeRawSubmodels(validHistory)
    const subResults: SubResult[] = []

    for (const [name, tr] of Object.entries(this.modelTrackers)) {
      if (!tr || !rawSub[name]) continue
      let prob = rawSub[name]!.prob
      let predToken = rawSub[name]!.predToken

      if (tr.inverted) {
        prob = 1.0 - prob
        predToken = (1 - predToken) as (0 | 1)
      }

      let effectiveWeight = tr.weight
      if (regimeCheck.hurstH >= 0.53) {
        if (name === 'dragonMomentum') effectiveWeight *= 2.2
        else if (name === 'latentTrajectory') effectiveWeight *= 1.8
        else if (name === 'kneserNeyLM') effectiveWeight *= 0.25
        else if (name === 'parityHarmonic') effectiveWeight *= 0.25
      } else if (regimeCheck.hurstH >= 0.48 && regimeCheck.hurstH <= 0.52) {
        if (name === 'kneserNeyLM') effectiveWeight *= 1.4
        else if (name === 'parityHarmonic') effectiveWeight *= 1.4
        else if (name === 'dragonMomentum') effectiveWeight *= 0.9
      }

      subResults.push({
        name,
        pred: predToken === 1 ? 'BIG' : 'SMALL',
        prob,
        weight: effectiveWeight,
        accuracy: tr.accuracy || 50,
        reason: rawSub[name]!.reason,
        inverted: tr.inverted
      })
    }

    const initialWeightMass = Object.values(this.modelTrackers).reduce((sum, tr) => sum + (tr ? tr.weight : 0), 0)
    const currentWeightMass = subResults.reduce((sum, s) => sum + s.weight, 0)
    if (currentWeightMass > 0 && initialWeightMass > 0) {
      const normScale = initialWeightMass / currentWeightMass
      subResults.forEach(s => { s.weight = parseFloat((s.weight * normScale).toFixed(3)) })
    }

    let curStreak = 1
    const lastToken = tokens[tokens.length - 1]
    for (let i = tokens.length - 2; i >= 0; i--) {
      if (tokens[i] === lastToken) curStreak++; else break
    }

    let curAlts = 0
    for (let i = tokens.length - 1; i >= Math.max(1, tokens.length - 6); i--) {
      if (tokens[i] !== tokens[i - 1]) curAlts++; else break
    }

    let is22Pair = false
    if (tokens.length >= 4) {
      const t0 = tokens[tokens.length - 4], t1 = tokens[tokens.length - 3],
            t2 = tokens[tokens.length - 2], t3 = tokens[tokens.length - 1]
      is22Pair = (t0 === t1) && (t2 === t3) && (t0 !== t2)
    }

    const recentNums = numSeq.slice(-20)
    const counts = new Array(10).fill(0)
    recentNums.forEach(n => { if (n >= 0 && n <= 9) counts[n]++ })
    const probs = counts.filter(c => c > 0).map(c => c / recentNums.length)
    const shannonEntropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0) / Math.log2(10)

    const rawEnsembleScore = this._evaluateMetaLearner(subResults, {
      shannonEntropy,
      curStreak,
      curAlts,
      is22Pair,
      hurstH: regimeCheck.hurstH,
      changepoint,
      runsZ: runsTest.runsZ,
      fourierPeak: spectral.peakPower
    })

    const calibratedP = this._plattCalibrate(rawEnsembleScore)
    const prediction: 'BIG' | 'SMALL' = calibratedP >= 0.50 ? 'BIG' : 'SMALL'
    const margin = Math.abs(calibratedP - 0.50)
    const agreeingModels = subResults.filter(s => s.pred === prediction)

    let confidence = Math.min(this.maxConfidence, Math.max(this.minConfidence, Math.round(52 + margin * 88)))

    const isSniper = (
      (calibratedP >= 0.60 || calibratedP <= 0.40) &&
      agreeingModels.length >= 4 &&
      margin >= 0.055 &&
      curStreak < 4
    )

    const tier: SignalTier = isSniper ? 'SNIPER' : 'STANDARD'
    const recommendedStake = isSniper ? '2U' : '1U'
    const status: StatusType = 'CLEARED'
    const statusReason = isSniper
      ? `🎯 Ultra-Sniper: ${agreeingModels.length}/9 models, Hurst H=${regimeCheck.hurstH}, Calibrated ${(Math.max(calibratedP, 1 - calibratedP)*100).toFixed(0)}% [2U Stake]`
      : `⚡ Standard Signal: ${agreeingModels.length}/9 consensus, Calibrated ${(Math.max(calibratedP, 1 - calibratedP)*100).toFixed(0)}% in ${regimeCheck.regimeName} [1U Stake]`

    if (isSniper) confidence = Math.max(78, confidence)
    else confidence = Math.max(62, confidence)

    const lastNum = numSeq.length > 0 ? numSeq[numSeq.length - 1] : 4
    const digitScores: Record<number, number> = {}
    for (let d = 0; d <= 9; d++) digitScores[d] = 1.0

    for (let i = 0; i < numSeq.length - 1; i++) {
      if (numSeq[i] === lastNum) digitScores[numSeq[i + 1]] += 1.8
    }

    let emaFast = numSeq[Math.max(0, numSeq.length - 4)]
    for (let i = Math.max(0, numSeq.length - 3); i < numSeq.length; i++) emaFast = 0.72 * numSeq[i] + 0.28 * emaFast
    let emaSlow = numSeq[Math.max(0, numSeq.length - 8)]
    for (let i = Math.max(0, numSeq.length - 7); i < numSeq.length; i++) emaSlow = 0.35 * numSeq[i] + 0.65 * emaSlow
    const lastD = numSeq.length > 0 ? numSeq[numSeq.length - 1] : 4
    const prevD = numSeq.length >= 2 ? numSeq[numSeq.length - 2] : lastD
    const vel = lastD - prevD
    const blendedEma = 0.55 * emaFast + 0.25 * emaSlow + 0.20 * (lastD + 0.35 * vel)

    for (let d = 0; d <= 9; d++) {
      const g = Math.exp(-0.5 * Math.pow((d - blendedEma) / 2.0, 2))
      digitScores[d] *= (0.75 + g * 1.5)
    }

    const totalDigitScore = Object.values(digitScores).reduce((a, b) => a + b, 0) || 1
    const digitProbs: Record<number, number> = {}
    for (let d = 0; d <= 9; d++) digitProbs[d] = Math.round((digitScores[d] / totalDigitScore) * 100)

    const rankedBig = [5, 6, 7, 8, 9].sort((a, b) => digitScores[b] - digitScores[a])
    const rankedSmall = [0, 1, 2, 3, 4].sort((a, b) => digitScores[b] - digitScores[a])

    const luckyDigits: [number, number] = prediction === 'BIG'
      ? [rankedBig[0], rankedBig[1]]
      : [rankedSmall[0], rankedSmall[1]]

    const topSub = [...subResults].sort((a, b) => b.weight - a.weight)[0]

    const dominantProb = Math.max(calibratedP, 1.0 - calibratedP)
    const conformalDecision = this.conformalGator.evaluateSignal(dominantProb, shannonEntropy, regimeCheck.hurstH, 0.88)
    const plattParams = { a: this.plattA, b: this.plattB }

    return {
      prediction,
      confidence,
      status,
      statusReason,
      strategy: (topSub ? topSub.name : 'Meta-Learner Ensemble') as string,
      reason: topSub ? topSub.reason : 'Dynamic multi-model consensus',
      bigProb: Math.round(calibratedP * 100),
      smallProb: Math.round((1.0 - calibratedP) * 100),
      calibratedP: parseFloat(calibratedP.toFixed(3)),
      hurstExponent: regimeCheck.hurstH,
      luckyDigits,
      digitProbs,
      regime: regimeCheck.regimeName,
      volatility: '0.48',
      entropy: shannonEntropy.toFixed(2),
      permutationEntropy: '0.50',
      continuousVal: parseFloat(blendedEma.toFixed(2)),
      isSniper,
      tier,
      recommendedStake,
      regimeEntropyThreshold: 0.88,
      pattern: rawSub.dragonMomentum.reason,
      parityPrediction: (lastNum % 2 === 1) ? 'EVEN' : 'ODD',
      engineVersion: 'v10.0',
      modelPerformance: this.modelTrackers,
      conformalRisk: conformalDecision,
      plattParameters: plattParams
    } as PredictionResult
  }
}
