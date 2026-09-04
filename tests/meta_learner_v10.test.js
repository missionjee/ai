import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    PredictionEngine,
    OnlinePlattCalibrator,
    MultiHorizonHedgeTracker,
    SparseMoERouter
} from '../engine.js';
import { PredictionEngine as WorkerEngine } from '../cloudflare-worker/worker.js';

describe('Meta-Learner v10.0 Quantum Enterprise Test Suite', () => {
    const createHistory = (patterns, startPeriod = 20260901100010001n) => {
        return patterns.map((p, idx) => {
            const issue_number = String(startPeriod + BigInt(idx));
            const isBig = typeof p === 'string' ? p.toLowerCase() === 'big' : (p >= 5);
            const num = typeof p === 'number' ? p : (isBig ? 8 : 1);
            return {
                issue_number,
                actual_result: isBig ? 'big' : 'small',
                actual_number: num,
                result_type: isBig ? 'big' : 'small'
            };
        });
    };

    it('1. Spectral Fourier: accurately computes harmonic period and phase bias', () => {
        const engine = new PredictionEngine();

        // 1A. Period-2 Alternation series: 1, 0, 1, 0, 1, 0, 1, 0...
        const altTokens = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
        const specAlt = engine._computeSpectralHarmonics(altTokens);
        assert.ok(specAlt.dominantPeriod >= 1.8 && specAlt.dominantPeriod <= 2.2, `Expected period ~2.0, got ${specAlt.dominantPeriod}`);
        assert.ok(specAlt.peakPower > 0.30, `Expected strong peak power, got ${specAlt.peakPower}`);
        assert.equal(specAlt.phaseBias, 0.65, 'Last was 0 (SMALL), alternation should predict BIG (0.65)');

        // 1B. Period-4 Doublet series: 1, 1, 0, 0, 1, 1, 0, 0...
        const pairTokens = [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0];
        const specPair = engine._computeSpectralHarmonics(pairTokens);
        assert.ok(specPair.dominantPeriod >= 3.5 && specPair.dominantPeriod <= 4.5, `Expected period ~4.0, got ${specPair.dominantPeriod}`);
    });

    it('2. Wald-Wolfowitz Runs Test: detects clustering and excess alternation', () => {
        const engine = new PredictionEngine();

        // 2A. Strong clustering (too few runs): Z < -1.65
        const clustered = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
        const zClustered = engine._computeRunsZStatistic(clustered);
        assert.ok(zClustered.runsZ < -1.65, `Expected negative Z for clustering, got ${zClustered.runsZ}`);
        assert.equal(zClustered.nonRandom, true);

        // 2B. Extreme alternation (too many runs): Z > +1.65
        const alternating = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
        const zAlternating = engine._computeRunsZStatistic(alternating);
        assert.ok(zAlternating.runsZ > 1.65, `Expected positive Z for alternation, got ${zAlternating.runsZ}`);
        assert.equal(zAlternating.nonRandom, true);
    });

    it('3. Multi-Horizon Exponential Hedge: updates weights across micro, meso, and macro horizons', () => {
        const hedge = new MultiHorizonHedgeTracker();
        const initialTrackers = {
            m1: { hits: 10, total: 20, accuracy: 50, weight: 1.0, inverted: false },
            m2: { hits: 10, total: 20, accuracy: 50, weight: 1.0, inverted: false }
        };

        const history = [];
        for (let i = 0; i < 30; i++) {
            history.push({
                issue_number: String(20260901100010000n + BigInt(i)),
                actual_result: 'big',
                actual_number: 8
            });
        }

        // m1 predicts BIG (100% win), m2 predicts SMALL (0% win)
        const mockSubmodels = () => ({
            m1: { prob: 0.90, predToken: 1 },
            m2: { prob: 0.10, predToken: 0 }
        });

        const updated = hedge.evaluateTrackers(history, mockSubmodels, initialTrackers);
        assert.ok(updated.m1.weight > updated.m2.weight, 'Winning submodel must have higher weight than losing submodel');
        assert.equal(updated.m1.accuracy, 100);
        assert.equal(updated.m2.accuracy, 0);
        assert.equal(updated.m2.inverted, true, 'Submodel with 0% accuracy must be dynamically inverted');
    });

    it('4. Sparse MoE Router: correctly routes across regime contexts', () => {
        const moe = new SparseMoERouter();
        const subResults = [
            { name: 'dragonMomentum', prob: 0.85, weight: 2.0, pred: 'BIG', accuracy: 70, reason: '', inverted: false },
            { name: 'parityHarmonic', prob: 0.30, weight: 2.0, pred: 'SMALL', accuracy: 70, reason: '', inverted: false },
            { name: 'spectralFourier', prob: 0.70, weight: 2.0, pred: 'BIG', accuracy: 65, reason: '', inverted: false },
            { name: 'latentTrajectory', prob: 0.80, weight: 2.0, pred: 'BIG', accuracy: 65, reason: '', inverted: false },
            { name: 'empiricalMarkov', prob: 0.75, weight: 2.0, pred: 'BIG', accuracy: 60, reason: '', inverted: false },
            { name: 'kneserNeyLM', prob: 0.40, weight: 1.0, pred: 'SMALL', accuracy: 50, reason: '', inverted: false },
            { name: 'runsMartingale', prob: 0.70, weight: 1.5, pred: 'BIG', accuracy: 55, reason: '', inverted: false },
            { name: 'contextAttention', prob: 0.60, weight: 1.0, pred: 'BIG', accuracy: 52, reason: '', inverted: false },
            { name: 'historicalPatternAssistance', prob: 0.55, weight: 0.8, pred: 'BIG', accuracy: 50, reason: '', inverted: false }
        ];

        // 4A. Trending regime (Hurst = 0.65, Streak = 4)
        const resTrend = moe.route({
            hurstH: 0.65,
            curStreak: 4,
            curAlts: 0,
            shannonEntropy: 0.75,
            is22Pair: false,
            runsZ: -2.1,
            fourierPeak: 0.20
        }, subResults);

        assert.equal(resTrend.activeExpert, 'trend_momentum_expert');
        assert.ok(resTrend.gatingWeights.trend > resTrend.gatingWeights.harmonic);
        assert.ok(resTrend.blendedScore > 0.65);

        // 4B. Mean-Reverting regime (Hurst = 0.40, Alts = 4)
        const resHarmonic = moe.route({
            hurstH: 0.40,
            curStreak: 1,
            curAlts: 4,
            shannonEntropy: 0.78,
            is22Pair: false,
            runsZ: 2.3,
            fourierPeak: 0.20
        }, subResults);

        assert.equal(resHarmonic.activeExpert, 'harmonic_oscillator_expert');
        assert.ok(resHarmonic.gatingWeights.harmonic > resHarmonic.gatingWeights.trend);
    });

    it('5. Online Platt SGD Calibrator: adapts parameters dynamically under loss gradients', () => {
        const calibrator = new OnlinePlattCalibrator(2.40, -0.05);

        // Calibrate raw score 0.70
        const p1 = calibrator.calibrate(0.70);
        assert.ok(p1 > 0.50 && p1 < 1.0);

        // Update step on repeated BIG actuals
        for (let i = 0; i < 20; i++) {
            calibrator.updateStep(0.75, 1);
        }

        assert.ok(calibrator.a >= 1.20 && calibrator.a <= 4.50);
        assert.ok(calibrator.b >= -0.35 && calibrator.b <= 0.35);
    });

    it('6. Fractional Kelly Stake Sizing & Zero-HOLD Guarantee', () => {
        const engine = new PredictionEngine();

        // High conviction trending series
        const highConviction = createHistory([8, 9, 8, 9, 8, 9, 8, 9, 8, 9, 8, 9, 8, 9, 8, 9]);
        const resSniper = engine.predict(highConviction);

        assert.equal(resSniper.status, 'CLEARED');
        assert.ok(['SNIPER', 'STANDARD'].includes(resSniper.tier));
        assert.ok(['2U', '1U'].includes(resSniper.recommendedStake));
        assert.ok(resSniper.luckyDigits.length === 2);
        assert.ok(resSniper.luckyDigits.every(d => d >= 0 && d <= 9));

        // Mixed chop series
        const chopSeries = createHistory([1, 8, 2, 7, 3, 6, 2, 7, 1, 8, 3, 6, 2, 8, 1, 7]);
        const resChop = engine.predict(chopSeries);

        assert.equal(resChop.status, 'CLEARED');
        assert.ok(['STANDARD', 'SCOUT'].includes(resChop.tier) || resChop.tier === 'SNIPER');
        assert.ok(['1U', '0.5U', '2U'].includes(resChop.recommendedStake));
    });

    it('7. Cross-Stack Parity: Node.js vs Cloudflare Worker Edge Engine produces identical output', () => {
        const nodeEngine = new PredictionEngine();
        const edgeEngine = new WorkerEngine();

        const testDatasets = [
            createHistory([7, 8, 9, 8, 7, 8, 9, 8, 9, 8, 9, 8]),
            createHistory([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]),
            createHistory([3, 4, 8, 7, 1, 2, 8, 7, 1, 2, 8, 7]),
            createHistory([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5])
        ];

        for (const data of testDatasets) {
            const rNode = nodeEngine.predict(data);
            const rEdge = edgeEngine.predict(data);

            assert.equal(rNode.prediction, rEdge.prediction);
            assert.equal(rNode.confidence, rEdge.confidence);
            assert.equal(rNode.status, rEdge.status);
            assert.equal(rNode.tier, rEdge.tier);
            assert.equal(rNode.recommendedStake, rEdge.recommendedStake);
            assert.equal(rNode.bigProb, rEdge.bigProb);
            assert.equal(rNode.smallProb, rEdge.smallProb);
            assert.equal(rNode.calibratedP, rEdge.calibratedP);
            assert.deepEqual(rNode.luckyDigits, rEdge.luckyDigits);
        }
    });

    it('8. Simulation Benchmark: evaluates meta-learner accuracy over 100 historical rounds', () => {
        const engine = new PredictionEngine();
        const fullHistory = [];
        for (let i = 0; i < 120; i++) {
            const num = (i * 7 + 3) % 10;
            const res = num >= 5 ? 'big' : 'small';
            fullHistory.push({
                issue_number: String(20260901100010000n + BigInt(i)),
                actual_result: res,
                actual_number: num,
                result_type: res
            });
        }

        let correct = 0;
        let evaluated = 0;
        for (let idx = 25; idx < fullHistory.length; idx++) {
            const slice = fullHistory.slice(0, idx);
            const actual = fullHistory[idx].actual_result.toUpperCase();
            const pred = engine.predict(slice);

            if (pred.prediction === actual) correct++;
            evaluated++;
        }

        const winRate = (correct / evaluated) * 100;
        assert.ok(evaluated > 80, `Expected at least 80 evaluated rounds, got ${evaluated}`);
        assert.ok(winRate >= 50.0, `Expected win rate >= 50%, got ${winRate.toFixed(1)}%`);
    });
});
