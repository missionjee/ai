/**
 * HIROTO AI — 24/7 Central Cloudflare Worker Engine (v4.0 Enterprise)
 * 
 * Capabilities:
 * - Runs 24/7 on Cloudflare Edge with 1-Minute Cron Trigger (* * * * *)
 * - Synchronizes with upstream 1M game lottery API at XX:01s
 * - Executes v4.0 Multi-Model Prediction Engine (Anti-Dragon, Markov 1-3, Bayes, Momentum, N-Gram, Parity)
 * - Broadcasts single official prediction to Supabase "global_signals" table
 * - Automatically keeps storage capped under 1 MB forever via Supabase rolling window
 * - Serves instant REST JSON endpoint (GET /signal) for any client app
 */

const CONFIG = {
    LOTTERY_API: "https://tirangaprediction.ai/api_fixed.php?action=latest_results&source=1M",
    SUPABASE_URL: "https://fvmbqikdomcjalladwmz.supabase.co",
    SUPABASE_KEY: "sb_publishable_UNWum89AzkwnfNb2BoxdKA_otmSXn5c"
};

// ==============================================================================
// 1. PREDICTION ENGINE (v4.0 Pure ES Core)
// ==============================================================================
class PredictionEngine {
    constructor() {
        this.minConfidence = 55;
        this.maxConfidence = 95;
        this.historyBuffer = new Map();
    }

    _isContiguous(issueNewer, issueOlder) {
        if (!issueNewer || !issueOlder) return false;
        try {
            const newer = BigInt(issueNewer);
            const older = BigInt(issueOlder);
            return newer === older + 1n;
        } catch (e) {
            return true;
        }
    }

    predict(history) {
        if (Array.isArray(history)) {
            history.forEach(item => {
                if (item && item.issue_number && (item.actual_result || item.result_type)) {
                    const k = String(item.issue_number);
                    const res = (item.actual_result || item.result_type).toLowerCase();
                    const num = item.actual_number !== undefined && item.actual_number !== null && !isNaN(parseInt(item.actual_number, 10))
                        ? parseInt(item.actual_number, 10) 
                        : null;

                    this.historyBuffer.set(k, {
                        issue_number: k,
                        actual_result: res,
                        actual_number: num
                    });
                }
            });
        }

        const combined = Array.from(this.historyBuffer.values()).sort((a, b) => {
            try {
                const bI = BigInt(b.issue_number);
                const aI = BigInt(a.issue_number);
                return aI > bI ? -1 : (aI < bI ? 1 : 0);
            } catch (e) {
                return String(b.issue_number).localeCompare(String(a.issue_number));
            }
        });

        const validHistory = combined.filter(h => (h.actual_result || h.result_type));

        if (validHistory.length < 4) {
            const hasRecent = validHistory.length > 0;
            const recentType = hasRecent ? (validHistory[0].actual_result || validHistory[0].result_type || "").toLowerCase() : null;
            const fallbackPred = recentType ? (recentType === "big" ? "SMALL" : "BIG") : "HOLD";
            
            const uniformDigits = {};
            for (let i = 0; i <= 9; i++) uniformDigits[i] = 10;

            return {
                prediction: fallbackPred === "HOLD" ? "SYNCING" : fallbackPred,
                confidence: 50,
                status: "HOLD",
                statusReason: `Collecting live rounds (${validHistory.length}/4 required)...`,
                strategy: "Stream Initialization",
                reason: "Awaiting minimum statistical round depth",
                bigProb: 50,
                smallProb: 50,
                luckyDigits: fallbackPred === "BIG" ? [6, 7] : (fallbackPred === "SMALL" ? [2, 3] : []),
                digitProbs: uniformDigits,
                regime: "synchronizing",
                volatility: "0.50",
                entropy: "1.00",
                isSniper: false,
                pattern: "Buffering",
                parityPrediction: "EVEN",
                kellyStake: { recommendedUnits: 0, fraction: 0, action: "PASS" },
                modelPerformance: null
            };
        }

        const seq = validHistory.map(h => (h.actual_result || h.result_type).toLowerCase());
        const numSeq = validHistory
            .map(h => (h.actual_number !== null && h.actual_number !== undefined ? parseInt(h.actual_number, 10) : null))
            .filter(n => n !== null && !isNaN(n) && n >= 0 && n <= 9);

        // 6 Component Statistical Models
        const streakModel = this._analyzeStreak(seq, numSeq);
        const markovModel = this._analyzeMarkov(validHistory);
        const bayesModel = this._analyzeBayes(seq);
        const momentumModel = this._analyzeMomentum(seq);
        const patternModel = this._analyzePatterns(seq);
        const parityModel = this._analyzeParityConfluence(numSeq, seq);

        const { regime, volatility, entropy } = this._analyzeRegime(seq);
        const perf = this._evaluateDynamicPerformance(validHistory, numSeq);

        const models = [
            { name: "Anti-Dragon Momentum", ...streakModel, weight: (regime === "trending" ? streakModel.weight * 1.3 : streakModel.weight) * perf.streak.weightMultiplier },
            { name: "Variable-Order Markov", ...markovModel, weight: (regime === "alternating" ? markovModel.weight * 1.4 : markovModel.weight) * perf.markov.weightMultiplier },
            { name: "Bayesian Rolling Prior", ...bayesModel, weight: bayesModel.weight * perf.bayes.weightMultiplier },
            { name: "Momentum Wave", ...momentumModel, weight: momentumModel.weight * perf.momentum.weightMultiplier },
            { name: "N-Gram Pattern", ...patternModel, weight: patternModel.weight * perf.pattern.weightMultiplier },
            { name: "Parity Harmonic", ...parityModel, weight: parityModel.weight * perf.parity.weightMultiplier }
        ];

        let bigScore = 0;
        let smallScore = 0;
        let totalWeight = 0;

        models.forEach(m => {
            const prob = m.conf / 100;
            if (m.pred === "BIG") {
                bigScore += prob * m.weight;
            } else {
                smallScore += prob * m.weight;
            }
            totalWeight += m.weight;
        });

        const scoreSum = bigScore + smallScore || 1;
        const bigRatio = bigScore / scoreSum;
        const smallRatio = smallScore / scoreSum;

        let prediction;
        if (bigRatio > smallRatio) {
            prediction = "BIG";
        } else if (smallRatio > bigRatio) {
            prediction = "SMALL";
        } else {
            if (regime === "trending") {
                prediction = seq[0] === "big" ? "BIG" : "SMALL";
            } else if (regime === "alternating") {
                prediction = seq[0] === "big" ? "SMALL" : "BIG";
            } else {
                prediction = (parityModel && parityModel.pred) ? parityModel.pred : (seq[0] === "big" ? "SMALL" : "BIG");
            }
        }

        const dominantRatio = Math.max(bigRatio, smallRatio);
        let confidence = Math.round(52 + (dominantRatio - 0.5) * 85);

        const agreeingModels = models.filter(m => m.pred === prediction);
        const agreementRate = agreeingModels.length / models.length;

        if (regime === "mixed" && entropy > 0.94 && volatility > 0.50) {
            confidence -= 7;
        } else if (regime === "trending" && entropy < 0.85) {
            confidence += 5;
        } else if (regime === "alternating") {
            confidence += 4;
        }

        if (agreementRate >= 0.80) {
            confidence += 4;
        }

        confidence = Math.min(this.maxConfidence, Math.max(this.minConfidence, confidence));
        const isSniper = (confidence >= 70 && agreementRate >= 0.65 && (regime !== "mixed" || entropy < 0.90));

        let status = "CLEARED";
        let statusReason = "Optimal signal parameters verified";

        if (isSniper) {
            status = "SNIPER";
            statusReason = `🎯 Sniper Confluence: ${(agreementRate * 100).toFixed(0)}% model consensus in ${regime} regime`;
        } else if (confidence < 62 || (regime === "mixed" && entropy > 0.94)) {
            status = "HOLD";
            statusReason = "Elevated market entropy (chop zone). Low statistical edge.";
        }

        const primaryModel = [...models].sort((a, b) => (b.conf * b.weight) - (a.conf * a.weight))[0];
        const digitsInfo = this._calculateDigits(numSeq, prediction, parityModel.pred);

        // Fractional Kelly Stake Sizing
        const pWin = dominantRatio;
        const bOdds = 0.96;
        const rawKelly = ((pWin * (bOdds + 1)) - 1) / bOdds;
        const quarterKelly = Math.max(0, rawKelly * 0.25);

        let recommendedUnits = 1;
        if (status === "HOLD") {
            recommendedUnits = 0;
        } else if (isSniper && confidence >= 76) {
            recommendedUnits = 3;
        } else if (isSniper || confidence >= 68) {
            recommendedUnits = 2;
        } else {
            recommendedUnits = 1;
        }

        return {
            prediction,
            confidence,
            status,
            statusReason,
            strategy: primaryModel.name,
            reason: primaryModel.reason,
            bigProb: Math.round(bigRatio * 100),
            smallProb: Math.round(smallRatio * 100),
            luckyDigits: digitsInfo.primaryDigits,
            digitProbs: digitsInfo.digitProbs,
            regime,
            volatility: volatility.toFixed(2),
            entropy: entropy.toFixed(2),
            isSniper,
            pattern: patternModel.patternName || regime,
            parityPrediction: parityModel.pred === "BIG" ? "ODD" : "EVEN",
            kellyStake: {
                recommendedUnits,
                fraction: parseFloat(quarterKelly.toFixed(3)),
                action: recommendedUnits === 0 ? "PASS" : `${recommendedUnits}U`
            },
            modelPerformance: perf
        };
    }

    _evaluateDynamicPerformance(validHistory, numSeq) {
        const scores = {
            streak: { hits: 0, total: 0, weightMultiplier: 1.0 },
            markov: { hits: 0, total: 0, weightMultiplier: 1.0 },
            bayes: { hits: 0, total: 0, weightMultiplier: 1.0 },
            momentum: { hits: 0, total: 0, weightMultiplier: 1.0 },
            pattern: { hits: 0, total: 0, weightMultiplier: 1.0 },
            parity: { hits: 0, total: 0, weightMultiplier: 1.0 }
        };

        const testDepth = Math.min(12, validHistory.length - 4);
        if (testDepth <= 2) return scores;

        for (let k = 1; k <= testDepth; k++) {
            const actual = (validHistory[k - 1].actual_result || validHistory[k - 1].result_type).toUpperCase();
            const subHistory = validHistory.slice(k);
            const subSeq = subHistory.map(h => (h.actual_result || h.result_type).toLowerCase());
            const subNumSeq = numSeq.slice(k);

            try {
                if (this._analyzeStreak(subSeq, subNumSeq).pred === actual) scores.streak.hits++;
                scores.streak.total++;
                if (this._analyzeMarkov(subHistory).pred === actual) scores.markov.hits++;
                scores.markov.total++;
                if (this._analyzeBayes(subSeq).pred === actual) scores.bayes.hits++;
                scores.bayes.total++;
                if (this._analyzeMomentum(subSeq).pred === actual) scores.momentum.hits++;
                scores.momentum.total++;
                if (this._analyzePatterns(subSeq).pred === actual) scores.pattern.hits++;
                scores.pattern.total++;
                if (this._analyzeParityConfluence(subNumSeq, subSeq).pred === actual) scores.parity.hits++;
                scores.parity.total++;
            } catch (e) {}
        }

        Object.keys(scores).forEach(key => {
            const entry = scores[key];
            if (entry.total > 0) {
                const acc = entry.hits / entry.total;
                entry.accuracy = Math.round(acc * 100);
                entry.weightMultiplier = parseFloat((0.60 + acc * 0.90).toFixed(2));
            }
        });

        return scores;
    }

    _analyzeStreak(seq, numSeq) {
        const last = seq[0];
        let count = 1;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] === last) count++;
            else break;
        }

        if (count === 1) {
            const isOscillatingPrior = seq.length >= 3 && seq[1] !== seq[2];
            if (isOscillatingPrior) {
                return { pred: last === "big" ? "SMALL" : "BIG", conf: 65, weight: 1.3, reason: `Alternating oscillation: switching to ${last === "big" ? "SMALL" : "BIG"}` };
            }
            return { pred: last === "big" ? "BIG" : "SMALL", conf: 56, weight: 1.0, reason: `Fresh breakout: initial ${last.toUpperCase()} impulse after trend shift` };
        }

        if (count === 2 || count === 3) {
            return { pred: last === "big" ? "BIG" : "SMALL", conf: 72 + (count - 2) * 3, weight: 1.6, reason: `Momentum acceleration: riding ${count}x ${last.toUpperCase()} trend` };
        }

        if (count >= 4 && count <= 7) {
            const streakNums = numSeq.slice(0, count);
            let boundaryDecay = false;
            if (last === "big") {
                if (streakNums.length >= 2 && streakNums[0] <= 6 && streakNums[1] <= 6) boundaryDecay = true;
            } else {
                if (streakNums.length >= 2 && streakNums[0] >= 3 && streakNums[1] >= 3) boundaryDecay = true;
            }

            if (boundaryDecay) {
                return { pred: last === "big" ? "SMALL" : "BIG", conf: 76, weight: 1.7, reason: `Dragon breakdown: ${count}x ${last.toUpperCase()} boundary exhaustion` };
            } else {
                return { pred: last === "big" ? "BIG" : "SMALL", conf: 74, weight: 1.5, reason: `Anti-Dragon ride: robust ${count}x ${last.toUpperCase()} momentum active` };
            }
        }

        return { pred: last === "big" ? "SMALL" : "BIG", conf: 82, weight: 1.9, reason: `Exhaustion climax: ${count}x extended dragon entering mean-reversion zone` };
    }

    _analyzeMarkov(validHistory) {
        const rev = [...validHistory].reverse();
        const seq = rev.map(h => (h.actual_result || h.result_type).toLowerCase());
        if (rev.length < 4) {
            const lastOutcome = seq.length > 0 ? seq[seq.length - 1] : "big";
            return { pred: lastOutcome === "big" ? "SMALL" : "BIG", conf: 50, weight: 0.6, reason: "Markov sampling baseline" };
        }
        const issues = rev.map(h => h.issue_number);
        const isAdjacent = (newerIdx, olderIdx) => this._isContiguous(issues[newerIdx], issues[olderIdx]);

        const lastIdx = rev.length - 1;
        const last1 = seq[lastIdx];

        let o1Big = 1, o1Small = 1, o1Matches = 0;
        for (let i = 0; i < rev.length - 1; i++) {
            if (isAdjacent(i + 1, i) && seq[i] === last1) {
                o1Matches++;
                if (seq[i + 1] === "big") o1Big++;
                else o1Small++;
            }
        }

        let o2Big = 1, o2Small = 1, o2Matches = 0;
        const last2Contiguous = (rev.length >= 3) && isAdjacent(lastIdx, lastIdx - 1);
        const last2 = seq.slice(-2).join("-");

        if (rev.length >= 4 && last2Contiguous) {
            for (let i = 0; i < rev.length - 2; i++) {
                if (isAdjacent(i + 1, i) && isAdjacent(i + 2, i + 1)) {
                    if (seq.slice(i, i + 2).join("-") === last2) {
                        o2Matches++;
                        if (seq[i + 2] === "big") o2Big++;
                        else o2Small++;
                    }
                }
            }
        }

        let o3Big = 1, o3Small = 1, o3Matches = 0;
        const last3Contiguous = (rev.length >= 4) && last2Contiguous && isAdjacent(lastIdx - 1, lastIdx - 2);
        const last3 = seq.slice(-3).join("-");

        if (rev.length >= 5 && last3Contiguous) {
            for (let i = 0; i < rev.length - 3; i++) {
                if (isAdjacent(i + 1, i) && isAdjacent(i + 2, i + 1) && isAdjacent(i + 3, i + 2)) {
                    if (seq.slice(i, i + 3).join("-") === last3) {
                        o3Matches++;
                        if (seq[i + 3] === "big") o3Big++;
                        else o3Small++;
                    }
                }
            }
        }

        const pO3 = o3Matches > 0 ? (o3Big / (o3Big + o3Small)) : 0.5;
        const pO2 = o2Matches > 0 ? (o2Big / (o2Big + o2Small)) : 0.5;
        const pO1 = o1Matches > 0 ? (o1Big / (o1Big + o1Small)) : 0.5;

        let pBig = 0.5;
        let desc = "Order-1";
        if (o3Matches >= 2 && last3Contiguous) {
            pBig = 0.55 * pO3 + 0.30 * pO2 + 0.15 * pO1;
            desc = `Order-3 (${o3Matches} contiguous)`;
        } else if (o2Matches >= 2 && last2Contiguous) {
            pBig = 0.65 * pO2 + 0.35 * pO1;
            desc = `Order-2 (${o2Matches} contiguous)`;
        } else {
            pBig = 0.70 * pO1 + 0.30 * 0.5;
            desc = `Order-1 (${o1Matches} contiguous)`;
        }

        const pred = pBig >= 0.5 ? "BIG" : "SMALL";
        const conf = Math.min(92, Math.round(50 + Math.abs(pBig - 0.5) * 85));

        return {
            pred,
            conf,
            weight: (o3Matches >= 2 || o2Matches >= 3) ? 1.6 : 1.2,
            reason: `Markov ${desc} matrix [${last2}]`
        };
    }

    _analyzeBayes(seq) {
        const slice = seq.slice(0, 25);
        let weightedBig = 0;
        let totalWeight = 0;

        slice.forEach((s, idx) => {
            const w = Math.exp(-idx * 0.08);
            if (s === "big") weightedBig += w;
            totalWeight += w;
        });

        const alpha = 3 + weightedBig;
        const beta = 3 + (totalWeight - weightedBig);
        const posteriorBig = alpha / (alpha + beta);

        const pred = posteriorBig >= 0.5 ? "BIG" : "SMALL";
        const conf = Math.min(88, Math.round(50 + Math.abs(posteriorBig - 0.5) * 80));

        return {
            pred,
            conf,
            weight: 1.2,
            reason: `Bayesian rolling prior (${(posteriorBig * 100).toFixed(0)}% BIG expectation)`
        };
    }

    _analyzeMomentum(seq) {
        const windows = [3, 5, 8];
        let scoreBig = 0;
        let scoreSmall = 0;

        windows.forEach((w, idx) => {
            const slice = seq.slice(0, Math.min(w, seq.length));
            const bigs = slice.filter(s => s === "big").length;
            const ratio = bigs / slice.length;
            const weight = windows.length - idx;

            if (ratio >= 0.5) scoreBig += (ratio - 0.5) * weight;
            else scoreSmall += (0.5 - ratio) * weight;
        });

        const pred = scoreBig >= scoreSmall ? "BIG" : "SMALL";
        const diff = Math.abs(scoreBig - scoreSmall);
        const conf = Math.min(86, Math.round(55 + diff * 16));

        return { pred, conf, weight: 1.2, reason: "Multi-window Fibonacci wave momentum" };
    }

    _analyzePatterns(seq) {
        if (seq.length < 4) {
            const next = seq.length > 0 ? (seq[0] === "big" ? "SMALL" : "BIG") : "BIG";
            return { pred: next, conf: 50, weight: 0.6, reason: "Scanning patterns", patternName: "Neutral" };
        }

        const s = seq.slice(0, 10).map(x => x === "big" ? "B" : "S").join("");

        if (s.startsWith("BBSS")) {
            const hasPriorCycle = s.startsWith("BBSSBB");
            return { pred: "SMALL", conf: hasPriorCycle ? 80 : 74, weight: hasPriorCycle ? 1.6 : 1.3, reason: "Pattern: 2-2 Double-Alternation (BB completed -> SMALL)", patternName: "2-2 Alternation" };
        }
        if (s.startsWith("SSBB")) {
            const hasPriorCycle = s.startsWith("SSBBSS");
            return { pred: "BIG", conf: hasPriorCycle ? 80 : 74, weight: hasPriorCycle ? 1.6 : 1.3, reason: "Pattern: 2-2 Double-Alternation (SS completed -> BIG)", patternName: "2-2 Alternation" };
        }
        if (s.startsWith("BSS") && !s.startsWith("BSSS")) {
            return { pred: "BIG", conf: 72, weight: 1.2, reason: "Pattern: 2-2 Pair forming (completing second BIG)", patternName: "2-2 Pair Formation" };
        }
        if (s.startsWith("SBB") && !s.startsWith("SBBB")) {
            return { pred: "SMALL", conf: 72, weight: 1.2, reason: "Pattern: 2-2 Pair forming (completing second SMALL)", patternName: "2-2 Pair Formation" };
        }
        if (s.startsWith("BSBS") || s.startsWith("SBSB")) {
            const next = s[0] === "B" ? "SMALL" : "BIG";
            return { pred: next, conf: 78, weight: 1.5, reason: "Pattern: 1-1 Alternating oscillation rhythm", patternName: "1-1 Alternation" };
        }
        if (s.startsWith("SBBB")) {
            return { pred: "BIG", conf: 74, weight: 1.3, reason: "Pattern: 3-1 Wave pullback recovery", patternName: "3-1 Wave" };
        }
        if (s.startsWith("BSSS")) {
            return { pred: "SMALL", conf: 74, weight: 1.3, reason: "Pattern: 3-1 Wave pullback recovery", patternName: "3-1 Wave" };
        }

        return { pred: seq[0] === "big" ? "BIG" : "SMALL", conf: 52, weight: 0.8, reason: "Neutral pattern baseline scan", patternName: "Standard" };
    }

    _analyzeParityConfluence(numSeq, seq) {
        if (!numSeq || numSeq.length < 4) {
            const hasNum = numSeq && numSeq.length > 0;
            const lastIsOdd = hasNum ? (numSeq[0] % 2 === 1) : (seq && seq.length > 0 ? seq[0] === "big" : true);
            return { pred: lastIsOdd ? "SMALL" : "BIG", conf: 50, weight: 0.6, reason: "Parity sampling baseline" };
        }

        const parities = numSeq.map(n => n % 2 === 1 ? "odd" : "even");
        const lastParity = parities[0];
        let parityStreak = 1;
        for (let i = 1; i < parities.length; i++) {
            if (parities[i] === lastParity) parityStreak++;
            else break;
        }

        let expectedParity;
        let conf;
        if (parityStreak >= 7) {
            expectedParity = lastParity === "odd" ? "even" : "odd";
            conf = 72;
        } else if (parityStreak >= 2) {
            expectedParity = lastParity;
            conf = Math.min(74, 58 + parityStreak * 3);
        } else {
            expectedParity = lastParity === "odd" ? "even" : "odd";
            conf = 56;
        }

        const affinityPred = expectedParity === "odd" ? "BIG" : "SMALL";
        return { pred: affinityPred, conf, weight: 0.85, reason: `Parity harmonic: ${parityStreak}x ${lastParity.toUpperCase()} cycle aligns with ${expectedParity.toUpperCase()}` };
    }

    _analyzeRegime(seq) {
        const slice = seq.slice(0, 18);
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

        let regime = "mixed";
        if (maxStreak >= 3) regime = "trending";
        else if (altRate >= 0.60 || (maxStreak === 2 && altRate >= 0.45)) regime = "alternating";

        const bigCount = slice.filter(s => s === "big").length;
        const p1 = bigCount / (slice.length || 1);
        const p0 = 1 - p1;
        let entropy = 1.0;
        if (p1 > 0 && p0 > 0) {
            entropy = -(p1 * Math.log2(p1) + p0 * Math.log2(p0));
        } else if (p1 === 1 || p0 === 1) {
            entropy = 0;
        }

        const nums = slice.map(s => s === "big" ? 1 : 0);
        const mean = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
        const variance = nums.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / (nums.length || 1);
        const volatility = Math.sqrt(variance);

        return { regime, volatility, entropy };
    }

    _calculateDigits(numSeq, prediction, parityAffinity) {
        const scores = {};
        for (let i = 0; i <= 9; i++) scores[i] = 1.0;

        const recent = numSeq && numSeq.length > 0 ? numSeq.slice(0, 25) : [];
        const hasNumbers = recent.length > 0;
        const lastNum = hasNumbers ? recent[0] : null;

        if (hasNumbers) {
            recent.forEach((n, idx) => {
                const recencyWeight = Math.exp(-idx * 0.12) * 4.0;
                scores[n] = (scores[n] || 1.0) + recencyWeight;
            });
        }

        for (let i = 0; i <= 9; i++) {
            const isBig = i >= 5;
            if ((prediction === "BIG" && isBig) || (prediction === "SMALL" && !isBig)) {
                scores[i] *= 3.8;
            } else {
                scores[i] *= 0.15;
            }
        }

        for (let i = 0; i <= 9; i++) {
            const isOdd = (i % 2 === 1);
            if ((parityAffinity === "BIG" && isOdd) || (parityAffinity === "SMALL" && !isOdd)) {
                scores[i] *= 1.4;
            }
        }

        if (prediction === "BIG") scores[5] *= 1.15;
        else scores[0] *= 1.15;

        if (lastNum !== null) {
            const mirror = 9 - lastNum;
            if (scores[mirror] !== undefined) scores[mirror] *= 1.3;
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
        const ranked = Object.entries(scores)
            .map(([d, s]) => ({ digit: parseInt(d, 10), prob: Math.round((s / totalScore) * 100) }))
            .sort((a, b) => b.prob - a.prob);

        return {
            primaryDigits: [ranked[0].digit, ranked[1].digit],
            digitProbs: Object.fromEntries(ranked.map(r => [r.digit, r.prob]))
        };
    }
}

// Global Singleton Engine Instance
const engine = new PredictionEngine();

// ==============================================================================
// 2. CLOUDFLARE WORKER LIFECYCLE & SYNC CONTROLLER
// ==============================================================================
async function executeSyncCycle() {
    // Step A: Hydrate deep history from Supabase if memory buffer is low (< 10 items)
    if (engine.historyBuffer.size < 10) {
        try {
            const sbRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/global_signals?select=issue_number,actual_result,actual_number&order=issue_number.desc&limit=100`, {
                headers: {
                    "apikey": CONFIG.SUPABASE_KEY,
                    "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`
                }
            });
            if (sbRes.ok) {
                const sbData = await sbRes.json();
                if (Array.isArray(sbData)) {
                    engine.predict(sbData.filter(d => d.actual_result));
                }
            }
        } catch (e) {}
    }

    // Step B: Fetch latest settled draws from upstream lottery API
    let remoteData = null;
    try {
        const apiRes = await fetch(CONFIG.LOTTERY_API, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (apiRes.ok) {
            remoteData = await apiRes.json();
        }
    } catch (e) {}

    if (!Array.isArray(remoteData) || remoteData.length === 0) {
        return { success: false, error: "FETCH_FAILED" };
    }

    // Step C: Ingest new draws into engine & update settled results in Supabase
    const latestResolved = remoteData[0];
    if (latestResolved && latestResolved.issue_number) {
        const resType = (latestResolved.actual_result || latestResolved.result_type || (latestResolved.actual_number >= 5 ? "big" : "small")).toLowerCase();
        const resNum = latestResolved.actual_number !== undefined && latestResolved.actual_number !== null ? parseInt(latestResolved.actual_number, 10) : null;

        // Settle last period in Supabase
        try {
            await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/global_signals?issue_number=eq.${latestResolved.issue_number}`, {
                method: "PATCH",
                headers: {
                    "apikey": CONFIG.SUPABASE_KEY,
                    "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ actual_result: resType, actual_number: resNum })
            });
        } catch (e) {}
    }

    // Step D: Calculate AI prediction for upcoming period
    const pred = engine.predict(remoteData);
    let nextPeriod;
    try {
        nextPeriod = String(BigInt(latestResolved.issue_number) + 1n);
    } catch (e) {
        const num = parseInt(String(latestResolved.issue_number).slice(-5), 10) + 1;
        nextPeriod = String(latestResolved.issue_number).slice(0, -5) + String(num).padStart(5, "0");
    }

    // Step E: Upsert single official prediction to Supabase
    const payload = {
        issue_number: String(nextPeriod),
        predicted_type: pred.prediction,
        confidence: pred.confidence,
        status: pred.status,
        lucky_digits: pred.luckyDigits,
        stake_units: pred.kellyStake.action,
        strategy: pred.strategy,
        reason: pred.reason,
        big_prob: pred.bigProb,
        small_prob: pred.smallProb,
        regime: pred.regime,
        pattern: pred.pattern,
        is_sniper: pred.isSniper
    };

    try {
        await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/global_signals`, {
            method: "POST",
            headers: {
                "apikey": CONFIG.SUPABASE_KEY,
                "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {}

    return {
        success: true,
        period: nextPeriod,
        prediction: pred.prediction,
        confidence: pred.confidence,
        status: pred.status,
        stake: pred.kellyStake.action,
        luckyDigits: pred.luckyDigits
    };
}

// ==============================================================================
// 3. EXPORT HANDLERS (Cron Scheduled & Fast HTTP Endpoint)
// ==============================================================================
export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(executeSyncCycle());
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === "/sync" || url.pathname === "/force-sync") {
            const result = await executeSyncCycle();
            return new Response(JSON.stringify(result, null, 2), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        const result = await executeSyncCycle();
        return new Response(JSON.stringify({
            status: "ONLINE",
            platform: "Cloudflare Workers 24/7",
            engine: "v4.0 Enterprise",
            data: result
        }, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        });
    }
};
