// ============================================================
// HIROTO AI — Core TypeScript Type Definitions
// ============================================================

// Prediction Signal Types
export type SignalType = 'BIG' | 'SMALL' | 'HOLD'
export type StatusType = 'CLEARED' | 'HOLD' | 'SNIPER' | 'STANDARD' | 'SCOUT'
export type SignalTier = 'SNIPER' | 'STANDARD' | 'SCOUT' | 'HOLD'
export type OutcomeType = 'WIN' | 'LOSS' | 'PENDING'
export type FilterType = 'ALL' | 'WINS' | 'LOSSES'
export type RegimeName = 'trending' | 'mean-reverting' | 'mixed' | 'synchronizing'
export type HoldRegime =
  | 'CHOP_OSCILLATION'
  | 'DRAGON_STREAK'
  | 'PERIODIC_2_2'
  | 'BROKEN_SYMMETRY'
  | 'WHITE_NOISE'
  | 'QUARANTINE'
  | 'MODEL_DISCORDANCE'
  | 'SYNCING'

export type HoldCounterfactual =
  | 'CORRECT_AVOIDED_LOSS'
  | 'OVERLY_CAUTIOUS_MISSED_WIN'
  | 'NEUTRAL_CHOP'
  | 'PENDING'

export interface HoldAuditItem {
  issue_number: string
  holdRegime: HoldRegime
  statusReason: string
  calibratedP: number
  unconstrainedPrediction: 'BIG' | 'SMALL'
  actualResult: string | null
  counterfactual: HoldCounterfactual
}

export interface HoldAuditSummary {
  totalRounds: number
  totalHolds: number
  holdRatePercent: number
  avoidedLosses: number
  missedWins: number
  protectionEfficiencyPercent: number
  regimeBreakdown: Record<string, {
    total: number
    avoidedLosses: number
    missedWins: number
    efficiencyPercent: number
    recommendedEntropyCutoff: number
  }>
}

export interface ConformalRiskDecision {
  isGated: boolean
  nonConformityScore: number
  calibratedThreshold: number
  empiricalRiskBound: number
  rejectionReason: string
}

// Model trackers
export interface ModelTracker {
  hits: number
  total: number
  accuracy: number
  weight: number
  inverted: boolean
}

export interface ModelTrackers {
  contextAttention: ModelTracker
  kneserNeyLM: ModelTracker
  dragonMomentum: ModelTracker
  historicalPatternAssistance: ModelTracker
  empiricalMarkov: ModelTracker
  parityHarmonic: ModelTracker
  latentTrajectory: ModelTracker
}

// Prediction result from the engine
export interface PredictionResult {
  prediction: SignalType
  confidence: number
  status: StatusType
  statusReason: string
  strategy: string
  reason: string
  bigProb: number
  smallProb: number
  calibratedP?: number
  hurstExponent?: number
  luckyDigits: [number, number]
  digitProbs: Record<number, number>
  regime: RegimeName
  volatility: string
  entropy: string
  permutationEntropy: string
  continuousVal?: number
  isSniper: boolean
  tier?: SignalTier
  recommendedStake?: string
  regimeEntropyThreshold?: number
  conformalRisk?: ConformalRiskDecision
  holdAnalysis?: {
    regime: HoldRegime
    counterfactual?: HoldCounterfactual
    explanation: string
  }
  pattern: string
  parityPrediction: string
  engineVersion: string
  modelPerformance: ModelTrackers | null
  prngForensics?: {
    lcgDetected: boolean
    diffAutocorr: number
    sampleSize?: number
  }
}

// History entry
export interface HistoryEntry {
  issue_number: string
  actual_result: string | null
  actual_number: number | null
  predicted_type: string | null
  prediction_confidence: number | null
  lucky_digits: number[] | null
}

// Supabase user profile
export interface UserProfile {
  license_key: string
  tokens_balance: number
  active_device_id: string | null
  device_name: string | null
  status: 'active' | 'ended' | 'revoked' | 'deleted' | 'suspended'
  last_login_at: string | null
  last_active_at: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AdminStats {
  totalKeys: number
  activeKeys: number
  totalTokensCirculating: number
  boundDevicesCount: number
  signals24hCount: number
  winRate24h: number
}

// Session stored in localStorage
export interface UserSession {
  key: string
  tokens_balance: number
  deviceId: string
  status: string
  syncedWithCloud: boolean
  loginTime: string
}

// Auth result
export interface AuthResult {
  success: boolean
  message?: string
  code?: string
  session?: UserSession
}

// Token consumption result
export interface TokenResult {
  success: boolean
  remainingTokens?: number
  deducted?: number
  error?: string
  message?: string
}

// Authorized prediction RPC result
export interface AuthorizedPredictionResult {
  success: boolean
  signal?: {
    predicted_type: string
    confidence: number
    status: string
    statusReason?: string
    lucky_digits: number[]
    strategy: string
    reason: string
    big_prob: number
    small_prob: number
    regime: string
    pattern: string
    is_sniper: boolean
  }
  tokensBalance?: number
  error?: string
}

// Global signal from Supabase
export interface GlobalSignal {
  issue_number: string
  predicted_type: string
  actual_result: string | null
  actual_number: number | null
  confidence: number
  status: string
  lucky_digits: number[]
  strategy: string
  reason: string
  big_prob: number
  small_prob: number
  regime: string
  pattern: string
  is_sniper: boolean
}

// Token ledger entry
export interface TokenLedgerEntry {
  period_number: string
  prediction_type: string
  created_at: string
}

// Application state
export interface AppState {
  targetPeriod: string | null
  prediction: PredictionResult | null
  history: HistoryEntry[]
  stats: { streak: number }
  tokensBalance: number
  isLiveFeed: boolean
  isResolving: boolean
  activeFilter: FilterType
  lastSettledPeriod: string | null
}
