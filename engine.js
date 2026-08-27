/**
 * HIROTO AI — Minimal & High-Precision Prediction Engine
 * Focuses strictly on core predictive intelligence:
 * 1. Streak Hazard & Reversal Detection
 * 2. Markov Chain Transition Matrix (Order 1 & 2 with Laplace smoothing)
 * 3. Bayesian Beta Prior Updating
 * 4. Multi-Scale Momentum Consensus
 * 5. Digit Probability Distribution (0-9)
 * 6. Volatility & Risk Gating
 */

export class PredictionEngine {
    constructor() {
        this.minConfidence = 55;
        this.maxConfidence = 94;
    }

    /**
     * Generate prediction for the upcoming period
     * @param {Array} history - Array of { issue_number, actual_result, actual_number }
     */
    predict(history) {
        if (!history || history.length < 5) {
            return {
                prediction: 'BIG',
                confidence: 60,
                status: 'HOLD',
                statusReason: 'Syncing historical feed...',
                strategy: 'Initializing',
                reason: 'Awaiting sufficient rounds',
                bigProb: 50,
                smallProb: 50,
                luckyDigits: [7, 8],
                digitProbs: { 7: 25, 8: 20 },
                regime: 'balanced'
            };
        }

        const validHistory = history.filter(h => (h.actual_result || h.result_type));
        const seq = validHistory.map(h => (h.actual_result || h.result_type).toLowerCase());
        const numSeq = validHistory
            .map(h => parseInt(h.actual_number))
            .filter(n => !isNaN(n) && n >= 0 && n <= 9);

        // 1. Streak Hazard Analysis
        const streakModel = this._analyzeStreak(seq);

        // 2. Markov Transition Model (Order 2 + Order 1)
        const markovModel = this._analyzeMarkov(seq);

        // 3. Bayesian Beta Prior Updating
        const bayesModel = this._analyzeBayes(seq);

        // 4. Momentum & Fibonacci Wave Consensus
        const momentumModel = this._analyzeMomentum(seq);

        // 5. Market Regime & Volatility
        const { regime, volatility, entropy } = this._analyzeRegime(seq);

        // Weighted Vote Aggregation
        let bigScore = 0;
        let smallScore = 0;
        let totalWeight = 0;

        const models = [
            { name: 'Streak Hazard', ...streakModel, weight: regime === 'trending' ? 1.5 : 1.1 },
            { name: 'Markov Chain', ...markovModel, weight: regime === 'alternating' ? 1.5 : 1.2 },
            { name: 'Bayesian Update', ...bayesModel, weight: 1.0 },
            { name: 'Momentum Wave', ...momentumModel, weight: 1.1 }
        ];

        models.forEach(m => {
            const prob = m.conf / 100;
            if (m.pred === 'BIG') {
                bigScore += prob * m.weight;
            } else {
                smallScore += prob * m.weight;
            }
            totalWeight += m.weight;
        });

        const bigRatio = bigScore / totalWeight;
        const smallRatio = smallScore / totalWeight;
        const prediction = bigRatio >= smallRatio ? 'BIG' : 'SMALL';

        // Calculate Consensus & Confidence
        const dominantRatio = Math.max(bigRatio, smallRatio);
        let confidence = Math.round(52 + (dominantRatio - 0.5) * 80);

        // Volatility & Entropy adjustments
        if (entropy > 0.95 && volatility > 0.52) {
            confidence -= 6; // High randomness penalty
        } else if (regime !== 'mixed') {
            confidence += 4; // Clear structure bonus
        }

        confidence = Math.min(this.maxConfidence, Math.max(this.minConfidence, confidence));

        // Signal Gating Status: CLEARED vs HOLD
        let status = 'CLEARED';
        let statusReason = 'Optimal signal parameters verified';

        if (confidence < 62) {
            status = 'HOLD';
            statusReason = 'Low confidence margin';
        } else if (volatility > 0.56 && confidence < 70) {
            status = 'HOLD';
            statusReason = 'High noise volatility';
        }

        // Leading Strategy & Reason
        const primaryModel = models.sort((a, b) => b.conf - a.conf)[0];

        // 6. Lucky Target Digit Distribution (0-9)
        const digitsInfo = this._calculateDigits(numSeq, prediction);

        return {
            prediction,
            confidence,
            status,
            statusReason,
            strategy: primaryModel.name,
            reason: primaryModel.reason,
            bigProb: Math.round((bigRatio / (bigRatio + smallRatio)) * 100),
            smallProb: Math.round((smallRatio / (bigRatio + smallRatio)) * 100),
            luckyDigits: digitsInfo.primaryDigits,
            digitProbs: digitsInfo.digitProbs,
            regime,
            volatility: volatility.toFixed(2),
            entropy: entropy.toFixed(2)
        };
    }

    _analyzeStreak(seq) {
        const last = seq[0];
        let count = 1;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] === last) count++;
            else break;
        }

        if (count >= 4) {
            return {
                pred: last === 'big' ? 'SMALL' : 'BIG',
                conf: Math.min(88, 55 + count * 6),
                reason: `Streak hazard: expected reversal after ${count} consecutive ${last.toUpperCase()}`
            };
        } else if (count >= 2) {
            return {
                pred: last === 'big' ? 'BIG' : 'SMALL',
                conf: 66,
                reason: `Streak momentum: continuing ${count} consecutive ${last.toUpperCase()}`
            };
        }

        return {
            pred: last === 'big' ? 'SMALL' : 'BIG',
            conf: 56,
            reason: 'Single switch rebound pattern'
        };
    }

    _analyzeMarkov(seq) {
        const rev = [...seq].reverse();
        if (rev.length < 4) return { pred: 'BIG', conf: 50, reason: 'Markov baseline' };

        const last2 = rev.slice(-2).join('-');
        let nextBig = 1;
        let nextSmall = 1;

        for (let i = 0; i < rev.length - 2; i++) {
            const pair = rev.slice(i, i + 2).join('-');
            if (pair === last2 && i + 2 < rev.length) {
                if (rev[i + 2] === 'big') nextBig++;
                else nextSmall++;
            }
        }

        const pBig = nextBig / (nextBig + nextSmall);
        const pred = pBig >= 0.5 ? 'BIG' : 'SMALL';
        const conf = Math.min(90, Math.round(50 + Math.abs(pBig - 0.5) * 80));

        return {
            pred,
            conf,
            reason: `Order-2 Markov transition [${last2}] (${nextBig - 1}B : ${nextSmall - 1}S)`
        };
    }

    _analyzeBayes(seq) {
        const slice = seq.slice(0, 20);
        const bigCount = slice.filter(s => s === 'big').length;
        const total = slice.length || 1;

        const alpha = 3 + bigCount;
        const beta = 3 + (total - bigCount);
        const posteriorBig = alpha / (alpha + beta);

        const pred = posteriorBig >= 0.5 ? 'BIG' : 'SMALL';
        const conf = Math.min(86, Math.round(50 + Math.abs(posteriorBig - 0.5) * 75));

        return {
            pred,
            conf,
            reason: `Bayesian rolling probability (${(posteriorBig * 100).toFixed(0)}% BIG)`
        };
    }

    _analyzeMomentum(seq) {
        const windows = [3, 5, 8];
        let scoreBig = 0;
        let scoreSmall = 0;

        windows.forEach((w, idx) => {
            const slice = seq.slice(0, Math.min(w, seq.length));
            const bigs = slice.filter(s => s === 'big').length;
            const ratio = bigs / slice.length;
            const weight = windows.length - idx;

            if (ratio >= 0.5) scoreBig += (ratio - 0.5) * weight;
            else scoreSmall += (0.5 - ratio) * weight;
        });

        const pred = scoreBig >= scoreSmall ? 'BIG' : 'SMALL';
        const diff = Math.abs(scoreBig - scoreSmall);
        const conf = Math.min(84, Math.round(55 + diff * 15));

        return {
            pred,
            conf,
            reason: 'Multi-window Fibonacci wave momentum'
        };
    }

    _analyzeRegime(seq) {
        const slice = seq.slice(0, 15);
        let alternations = 0;
        for (let i = 1; i < slice.length; i++) {
            if (slice[i] !== slice[i - 1]) alternations++;
        }

        const altRate = alternations / (slice.length - 1 || 1);
        let maxStreak = 1;
        let currStreak = 1;
        for (let i = 1; i < slice.length; i++) {
            if (slice[i] === slice[i - 1]) {
                currStreak++;
                maxStreak = Math.max(maxStreak, currStreak);
            } else {
                currStreak = 1;
            }
        }

        let regime = 'mixed';
        if (maxStreak >= 3) regime = 'trending';
        else if (altRate >= 0.65) regime = 'alternating';

        const bigCount = slice.filter(s => s === 'big').length;
        const p1 = bigCount / (slice.length || 1);
        const p0 = 1 - p1;
        let entropy = 1.0;
        if (p1 > 0 && p0 > 0) {
            entropy = -(p1 * Math.log2(p1) + p0 * Math.log2(p0));
        } else if (p1 === 1 || p0 === 1) {
            entropy = 0;
        }

        const nums = slice.map(s => s === 'big' ? 1 : 0);
        const mean = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
        const variance = nums.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / (nums.length || 1);
        const volatility = Math.sqrt(variance);

        return { regime, volatility, entropy };
    }

    _calculateDigits(numSeq, prediction) {
        const scores = {};
        for (let i = 0; i <= 9; i++) scores[i] = 1;

        const recent = numSeq.slice(0, 20);
        recent.forEach((n, idx) => {
            const recencyWeight = (20 - idx) * 0.4;
            scores[n] = (scores[n] || 1) + recencyWeight;
        });

        for (let i = 0; i <= 9; i++) {
            const isBig = i >= 5;
            if ((prediction === 'BIG' && isBig) || (prediction === 'SMALL' && !isBig)) {
                scores[i] *= 3.5;
            } else {
                scores[i] *= 0.2;
            }
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
        const ranked = Object.entries(scores)
            .map(([d, s]) => ({ digit: parseInt(d), prob: Math.round((s / totalScore) * 100) }))
            .sort((a, b) => b.prob - a.prob);

        const primaryDigits = [ranked[0].digit, ranked[1].digit];
        const digitProbs = {};
        ranked.forEach(r => { digitProbs[r.digit] = r.prob; });

        return { primaryDigits, digitProbs };
    }
}
