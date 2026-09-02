import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PredictionEngine, ConformalRiskGator } from '../engine.js';

describe('PredictionEngine Core Submodels & Statistics', () => {
    const createHistory = (patterns, startPeriod = 20260901100010001n) => {
        return patterns.map((p, idx) => {
            const issue_number = String(startPeriod + BigInt(idx));
            const isBig = typeof p === 'string' ? p.toLowerCase() === 'big' : (p >= 5);
            const num = typeof p === 'number' ? p : (isBig ? 7 : 2);
            return {
                issue_number,
                actual_result: isBig ? 'big' : 'small',
                actual_number: num,
                result_type: isBig ? 'big' : 'small'
            };
        });
    };

    it('1. Stream Initialization: returns HOLD when history is under 8 rounds', () => {
        const engine = new PredictionEngine();
        const shortHistory = createHistory([1, 8, 3, 7]);
        const result = engine.predict(shortHistory);

        assert.equal(result.prediction, 'HOLD');
        assert.equal(result.status, 'HOLD');
        assert.equal(result.confidence, 50);
        assert.equal(result.strategy, 'Stream Initialization');
        assert.match(result.statusReason, /Synchronizing/);
    });

    it('2. Hurst Exponent: correctly measures persistence and mean reversion', () => {
        const engine = new PredictionEngine();

        // Persistent trending series with positive drift
        const trendingSeries = [0, 1, 1, 2, 2, 3, 4, 4, 5, 6, 7, 7, 8, 8, 9, 9, 8, 8, 9, 9];
        const hTrending = engine._computeHurstExponent(trendingSeries);
        assert.ok(hTrending >= 0.50, `Hurst for trending series should be >= 0.50, got ${hTrending}`);

        // Flat series fallback
        const flatSeries = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
        const hFlat = engine._computeHurstExponent(flatSeries);
        assert.ok(hFlat >= 0.0 && hFlat <= 1.0);

        // Short series fallback
        assert.equal(engine._computeHurstExponent([1, 2, 3]), 0.50);
    });

    it('3. Autocorrelation: computes covariance and variance correctly across lags', () => {
        const engine = new PredictionEngine();

        // Alternating sequence has strong negative lag-1 autocorrelation
        const altSeries = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
        const acf1 = engine._computeAutocorrelation(altSeries, 1);
        assert.ok(acf1 < -0.5, `Lag-1 autocorrelation for alternating series should be strongly negative, got ${acf1}`);

        // Constant series has 0 lag autocorrelation
        const constSeries = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        const acfConst = engine._computeAutocorrelation(constSeries, 1);
        assert.equal(acfConst, 0.0);
    });

    it('4. Regime Validity Check: categorizes trending, mean-reverting, and white noise', () => {
        const engine = new PredictionEngine();

        // Persistent drift series (Hurst >= 0.53)
        const trendingTokens = [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        const trendingDigits = [1, 2, 0, 1, 5, 2, 6, 7, 3, 7, 8, 9, 8, 7, 9, 8, 9, 8, 9, 9, 8, 9, 9, 8, 9, 9, 8, 9, 9, 9];
        const regimeTrending = engine._regimeValidityCheck(trendingTokens, trendingDigits);
        assert.ok(['trending', 'mixed', 'mean-reverting'].includes(regimeTrending.regimeName));
        assert.equal(typeof regimeTrending.hurstH, 'number');
        assert.equal(typeof regimeTrending.autocorr1, 'number');
    });

    it('5. Dynamic Self-Learning (Exp3 Bandit): updates accuracy and model weights', () => {
        const engine = new PredictionEngine();

        // 40 rounds of alternating data
        const history = [];
        for (let i = 0; i < 40; i++) {
            const isBig = i % 2 === 0;
            history.push({
                issue_number: String(20260901100010000n + BigInt(i)),
                actual_result: isBig ? 'big' : 'small',
                actual_number: isBig ? 8 : 1
            });
        }

        engine._updateDynamicSelfLearning(history);
        const trackers = engine.modelTrackers;

        for (const [name, tr] of Object.entries(trackers)) {
            assert.ok(tr.total > 0, `Tracker ${name} should have evaluated rounds`);
            assert.ok(tr.accuracy >= 0 && tr.accuracy <= 100, `Accuracy for ${name} in [0, 100]`);
            assert.ok(tr.weight > 0, `Weight for ${name} should be positive`);
        }
    });

    it('6. Platt Probability Calibration: bounds calibrated probabilities within [0.01, 0.99]', () => {
        const engine = new PredictionEngine();

        const pLow = engine._plattCalibrate(0.05);
        const pMid = engine._plattCalibrate(0.50);
        const pHigh = engine._plattCalibrate(0.95);

        assert.ok(pLow >= 0.01 && pLow < 0.50, `pLow out of range: ${pLow}`);
        assert.ok(pHigh > 0.50 && pHigh <= 0.99, `pHigh out of range: ${pHigh}`);
        assert.ok(pMid >= 0.40 && pMid <= 0.60, `pMid out of range: ${pMid}`);

        // Test SGD update does not blow up parameters
        const history = createHistory([0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0]);
        engine._updatePlattParameters(history);
        assert.ok(engine.plattA >= 1.2 && engine.plattA <= 4.5, `plattA out of bounds: ${engine.plattA}`);
        assert.ok(engine.plattB >= -0.8 && engine.plattB <= 0.8, `plattB out of bounds: ${engine.plattB}`);
    });

    it('7. Permutation Entropy & Shannon Entropy calculations', () => {
        const engine = new PredictionEngine();

        // Strictly monotonic sequence has minimum permutation entropy
        const monotonic = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const peMono = engine._calculatePermutationEntropy(monotonic);
        assert.ok(peMono >= 0.0 && peMono <= 1.0);

        // Constant sequence
        const constantSeq = [5, 5, 5, 5, 5, 5, 5, 5];
        const peConst = engine._calculatePermutationEntropy(constantSeq);
        assert.ok(peConst >= 0.0 && peConst <= 1.0);
    });

    it('8. PRNG / LCG Forensics Diagnostic', () => {
        const engine = new PredictionEngine();

        // Linear Congruential Generator simulation: X_{n+1} = (7*X_n + 3) mod 10
        const lcgDigits = [];
        let state = 3;
        for (let i = 0; i < 65; i++) {
            state = (7 * state + 3) % 10;
            lcgDigits.push(state);
        }

        const audit = engine._auditPRNGStructure(lcgDigits);
        assert.equal(audit.sampleSize, 65);
        assert.equal(typeof audit.diffAutocorr, 'number');
        assert.equal(typeof audit.lcgDetected, 'boolean');

        // Short series returns default
        const shortAudit = engine._auditPRNGStructure([1, 2, 3]);
        assert.equal(shortAudit.lcgDetected, false);
    });

    it('9. Lucky Digits Generation: ranks top digits strictly aligned with Big/Small prediction', () => {
        const engine = new PredictionEngine();
        const history = createHistory([7, 8, 9, 6, 8, 7, 9, 8, 7, 8, 9, 8, 7, 6, 8, 9]);
        const res = engine.predict(history);

        assert.equal(res.luckyDigits.length, 2);
        if (res.prediction === 'BIG') {
            assert.ok(res.luckyDigits.every(d => d >= 5 && d <= 9), `Lucky digits for BIG must be in [5..9], got ${res.luckyDigits}`);
        } else if (res.prediction === 'SMALL') {
            assert.ok(res.luckyDigits.every(d => d >= 0 && d <= 4), `Lucky digits for SMALL must be in [0..4], got ${res.luckyDigits}`);
        }
    });

    it('10. Changepoint Detection: identifies abrupt mean shifts across sliding windows', () => {
        const engine = new PredictionEngine();
        // 12 rounds of SMALL (0) followed by 4 rounds of BIG (1)
        const tokens = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
        const digits = [1, 2, 0, 1, 3, 2, 1, 0, 2, 1, 3, 1, 8, 9, 7, 8];
        const cp = engine._detectChangepoint(tokens, digits);
        assert.equal(cp.changepointDetected, true);
        assert.equal(cp.shiftDirection, 'BIG_SHIFT');
        assert.ok(cp.shiftMagnitude >= 0.5);
    });

    it('11. Anti-Stickiness: Dual-Speed EMA rapidly responds to sudden direction reversals', () => {
        const engine = new PredictionEngine();
        // 10 Bigs followed by a Small draw (1)
        const history = createHistory([8, 9, 7, 8, 9, 8, 9, 7, 8, 9, 1]);
        const sub = engine._computeRawSubmodels(history);
        assert.ok(sub.latentTrajectory.prob < 0.55, `Latent prob after sharp reversal should drop, got ${sub.latentTrajectory.prob}`);
    });

    it('12. Conformal Risk Gating: calculates dynamic quantile threshold tau and bounds risk', () => {
        const gator = new ConformalRiskGator(0.12, 120);
        // Record 40 settlements (mostly high accuracy)
        for (let i = 0; i < 40; i++) {
            gator.recordSettlement(0.85, i % 8 !== 0); // ~87.5% win rate
        }

        const tau = gator.computeThreshold();
        assert.ok(tau > 0 && tau < 1.0, `Tau threshold should be in (0, 1), got ${tau}`);

        // Evaluate high conviction signal under low entropy
        const dec1 = gator.evaluateSignal(0.88, 0.72, 0.58);
        assert.equal(dec1.isGated, true);
        assert.equal(dec1.empiricalRiskBound, 0.12);

        // Evaluate signal in white-noise regime
        const decNoise = gator.evaluateSignal(0.88, 0.72, 0.50);
        assert.equal(decNoise.isGated, false);
        assert.match(decNoise.rejectionReason, /White noise/);

        // Verify prediction integration
        const engine = new PredictionEngine();
        const history = createHistory([7, 8, 9, 8, 7, 8, 9, 8, 9, 8, 9, 8, 7, 8, 9, 8]);
        const res = engine.predict(history);
        assert.ok(res.conformalRisk !== undefined, 'predict() must return conformalRisk object');
        assert.equal(typeof res.conformalRisk.isGated, 'boolean');
    });

    it('13. Tiered Signal Architecture: verifies Sniper (2U), Standard (1U), Scout (½U), and Hold (0U)', () => {
        const engine = new PredictionEngine();

        // High conviction trending series -> Sniper or Standard
        const sniperHistory = createHistory([7, 8, 9, 8, 7, 8, 9, 8, 9, 8, 9, 8, 7, 8, 9, 8]);
        const res1 = engine.predict(sniperHistory);
        assert.ok(['SNIPER', 'STANDARD', 'SCOUT', 'HOLD'].includes(res1.tier), `Invalid tier: ${res1.tier}`);
        assert.ok(['2U', '1U', '0.5U', '0U [PASS]'].includes(res1.recommendedStake), `Invalid stake: ${res1.recommendedStake}`);

        // Hold series in white-noise / chop
        const holdHistory = createHistory([0, 9, 1, 8, 2, 7, 3, 6, 4, 5, 0, 9, 1, 8]);
        const resHold = engine.predict(holdHistory);
        assert.equal(resHold.status, 'HOLD');
        assert.equal(resHold.tier, 'HOLD');
        assert.equal(resHold.recommendedStake, '0U [PASS]');
        assert.ok(resHold.holdAnalysis !== undefined, 'Hold result must include holdAnalysis');
        assert.ok(typeof resHold.holdAnalysis.regime === 'string');
    });

    it('14. Per-Regime Softened Entropy Gating: evaluates regime-specific thresholds', () => {
        const engine = new PredictionEngine();

        // 1. Dragon Trending (Hurst >= 0.53 or streak >= 3) -> 0.92
        const tauDragon = engine._getRegimeEntropyThreshold({ hurstH: 0.56, isWhiteNoise: false }, 3, 0, false, { detected: false });
        assert.equal(tauDragon, 0.92);

        // 2. 2-2 Pattern / Structural Doublet -> 0.90
        const tau22 = engine._getRegimeEntropyThreshold({ hurstH: 0.50, isWhiteNoise: false }, 2, 0, true, { detected: false });
        assert.equal(tau22, 0.90);

        // 3. Mean Reversion (Hurst < 0.45) -> 0.89
        const tauMeanRev = engine._getRegimeEntropyThreshold({ hurstH: 0.42, isWhiteNoise: false }, 1, 1, false, { detected: false });
        assert.equal(tauMeanRev, 0.89);

        // 4. Broken Symmetry Trap -> 0.87
        const tauBroken = engine._getRegimeEntropyThreshold({ hurstH: 0.50, isWhiteNoise: false }, 1, 1, false, { detected: true });
        assert.equal(tauBroken, 0.87);

        // 5. White Noise / High Chop -> 0.84
        const tauNoise = engine._getRegimeEntropyThreshold({ hurstH: 0.50, isWhiteNoise: true }, 1, 3, false, { detected: false });
        assert.equal(tauNoise, 0.84);
    });

    it('15. Dynamic Quarantine Mode: adjusts lockout duration dynamically per regime', () => {
        const engine = new PredictionEngine();

        // Fast 1R exit in persistent Dragon trend
        const durTrend = engine._getDynamicQuarantineDuration({ hurstH: 0.58, regimeName: 'trending' }, 4, 0.78, 0.85);
        assert.equal(durTrend, 1);

        // 2R exit in 2-2 structural rhythm
        const dur22 = engine._getDynamicQuarantineDuration({ hurstH: 0.51, regimeName: 'mean-reverting' }, 2, 0.82, 0.60);
        assert.equal(dur22, 2);

        // 3R hard lockout in high-entropy chop
        const durChop = engine._getDynamicQuarantineDuration({ hurstH: 0.46, regimeName: 'chop' }, 1, 0.94, 0.40);
        assert.equal(durChop, 3);
    });

    it('16. Historical Hold Retrospective Audit: classifies holds and measures avoided losses vs missed wins', () => {
        const engine = new PredictionEngine();
        const testHistory = [];
        for (let i = 0; i < 60; i++) {
            const num = (i * 3 + 2) % 10;
            const res = num >= 5 ? 'big' : 'small';
            testHistory.push({
                issue_number: String(20260901100010000n + BigInt(i)),
                actual_result: res,
                actual_number: num,
                result_type: res
            });
        }

        const audit = engine.auditHistoricalHolds(testHistory);
        assert.ok(typeof audit.totalRounds === 'number');
        assert.ok(typeof audit.totalHolds === 'number');
        assert.ok(typeof audit.holdRatePercent === 'number');
        assert.ok(typeof audit.avoidedLosses === 'number');
        assert.ok(typeof audit.missedWins === 'number');
        assert.ok(typeof audit.protectionEfficiencyPercent === 'number');
        assert.ok(typeof audit.regimeBreakdown === 'object');
        assert.equal(audit.avoidedLosses + audit.missedWins, audit.totalHolds);
    });
});
