import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PredictionEngine } from '../engine.js';

describe('PredictionEngine 100% Actionable Signals Suite (Zero HOLD Features)', () => {
    const createHistory = (items) => {
        return items.map((item, idx) => {
            const isBig = typeof item === 'string' ? item.toLowerCase() === 'big' : (item >= 5);
            const num = typeof item === 'number' ? item : (isBig ? 8 : 1);
            return {
                issue_number: String(20260901100010000n + BigInt(idx)),
                actual_result: isBig ? 'big' : 'small',
                actual_number: num,
                predicted_type: null
            };
        });
    };

    it('1. Dragon 4x-5x: processes into actionable real prediction with CLEARED status', () => {
        const engine = new PredictionEngine();
        const base = [1, 8, 2, 7, 3, 6, 2, 7, 1, 8, 3, 6, 1, 8, 2, 1];
        const fourStreak = [...base, 8, 8, 8, 8];
        const res = engine.predict(createHistory(fourStreak));

        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
        assert.equal(res.isSniper, false);
        assert.equal(res.recommendedStake, '1U');
    });

    it('2. Dragon Streak 6 Reversal: processes into actionable real prediction with CLEARED status', () => {
        const engine = new PredictionEngine();
        const base = [1, 8, 2, 7, 3, 6, 2, 7, 1, 8, 3, 6, 1, 1];
        const sixStreak = [...base, 8, 8, 8, 8, 8, 8];
        const res = engine.predict(createHistory(sixStreak));

        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
        assert.equal(res.isSniper, false);
    });

    it('3. Alternation (4+ switches): processes into actionable real prediction without HOLD', () => {
        const engine = new PredictionEngine();
        const history = createHistory([7, 8, 2, 3, 7, 8, 2, 8, 1, 8, 2, 9, 1, 8, 2]);
        const res = engine.predict(history);

        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
        assert.ok(['1U', '2U'].includes(res.recommendedStake));
    });

    it('4. 2-2 Pattern: processes into actionable real prediction without HOLD', () => {
        const engine = new PredictionEngine();
        const history = createHistory([3, 4, 8, 7, 1, 2, 8, 7, 1, 2]);
        const res = engine.predict(history);

        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
        assert.ok(['1U', '2U'].includes(res.recommendedStake));
    });

    it('5. Streak Boundary 2x Transition: processes into actionable real prediction without HOLD', () => {
        const engine = new PredictionEngine();
        const history = createHistory([3, 7, 2, 6, 1, 8, 2, 3, 1, 8, 8]);
        const res = engine.predict(history);

        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
    });

    it('6. Consecutive Miss Protection: maintains actionable real prediction without HOLD', () => {
        const engine = new PredictionEngine();
        const fullHistory = [];
        for (let i = 0; i < 15; i++) {
            fullHistory.push({
                issue_number: `202609011000100${i.toString().padStart(2, '0')}`,
                actual_result: i % 2 === 0 ? "big" : "small",
                actual_number: i % 2 === 0 ? 7 : 2,
                predicted_type: i % 2 === 0 ? "BIG" : "SMALL"
            });
        }
        fullHistory.push(
            { issue_number: "20260901100010050", actual_result: "big", actual_number: 7, predicted_type: "SMALL" },
            { issue_number: "20260901100010051", actual_result: "small", actual_number: 1, predicted_type: "BIG" }
        );

        const res = engine.predict(fullHistory);
        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
        assert.ok(['1U', '2U'].includes(res.recommendedStake));
    });

    it('7. Ultra-Sniper Gating: strictly caps to 1U Standard on streak >= 4', () => {
        const engine = new PredictionEngine();
        const streak4 = createHistory([2, 3, 2, 3, 2, 3, 1, 8, 8, 8, 8]);
        const res = engine.predict(streak4);

        assert.equal(res.status, 'CLEARED');
        assert.equal(res.isSniper, false);
        assert.equal(res.recommendedStake, '1U');
    });

    it('8. Multi-Loss Gating: maintains active real prediction', () => {
        const engine = new PredictionEngine();
        const fullHistory = [];
        for (let i = 0; i < 15; i++) {
            fullHistory.push({
                issue_number: `202609011000100${i.toString().padStart(2, '0')}`,
                actual_result: "big",
                actual_number: 8,
                predicted_type: "BIG"
            });
        }
        fullHistory.push(
            { issue_number: "20260901100010050", actual_result: "small", actual_number: 1, predicted_type: "BIG" },
            { issue_number: "20260901100010051", actual_result: "big", actual_number: 9, predicted_type: "SMALL" },
            { issue_number: "20260901100010052", actual_result: "small", actual_number: 2, predicted_type: "BIG" }
        );

        const res = engine.predict(fullHistory);
        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
        assert.ok(['1U', '2U'].includes(res.recommendedStake));
    });

    it('9. Broken Symmetry Pattern: delivers actionable real signal', () => {
        const engine = new PredictionEngine();
        const history = createHistory([3, 2, 1, 8, 8, 1, 8, 8]);
        const res = engine.predict(history);
        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
    });

    it('10. Walk-Forward Backtest: computes consecutive loss scores', () => {
        const engine = new PredictionEngine();
        const history = createHistory([8, 8, 8, 8, 8, 8, 8, 8, 1, 8, 1]);
        const misses = engine._computeWalkForwardConsecutiveMisses(history);
        assert.equal(typeof misses, 'number');
        assert.ok(misses >= 0);
    });

    it('11. Paper Trade Validation: computes paper trade metrics without HOLD lockout', () => {
        const engine = new PredictionEngine();
        const history = [];
        for (let i = 0; i < 15; i++) {
            history.push({
                issue_number: `202609011000100${i.toString().padStart(2, '0')}`,
                actual_result: "big",
                actual_number: 8,
                predicted_type: "BIG",
                tier: "STANDARD"
            });
        }
        history.push(
            { issue_number: "20260901100010050", actual_result: "small", actual_number: 1, predicted_type: "BIG", tier: "STANDARD" },
            { issue_number: "20260901100010051", actual_result: "small", actual_number: 2, predicted_type: "BIG", tier: "STANDARD" }
        );

        const paperVal = engine._computePaperTradeValidation(history);
        assert.ok(typeof paperVal.paperTradeWins === 'number');
        assert.ok(typeof paperVal.canReenter === 'boolean');

        const res = engine.predict(history);
        assert.equal(res.status, 'CLEARED');
        assert.ok(['STANDARD', 'SNIPER'].includes(res.tier));
        assert.ok(['1U', '2U'].includes(res.recommendedStake));
    });

    it('12. Graduated Streak Penalty: streak >= 4 caps stake to 1U Standard', () => {
        const engine = new PredictionEngine();
        const history = createHistory([1, 8, 2, 7, 3, 6, 1, 8, 2, 8, 8, 8, 8]);
        const res = engine.predict(history);

        assert.equal(res.status, 'CLEARED');
        assert.notEqual(res.recommendedStake, '2U');
        assert.notEqual(res.tier, 'SNIPER');
    });

    it('13. Elevated Entropy Chop: maintains real active prediction', () => {
        const engine = new PredictionEngine();
        const history = createHistory([7, 6, 8, 7, 6, 8, 9, 8, 7, 1, 8, 2]);
        const res = engine.predict(history);
        assert.equal(res.status, 'CLEARED');
        assert.ok(res.prediction === 'BIG' || res.prediction === 'SMALL');
    });

    it('14. Scout Tier Loss Contribution Cap: Scout loss counts as 0.5 toward score', () => {
        const engine = new PredictionEngine();
        const history = [];
        for (let i = 0; i < 15; i++) {
            history.push({
                issue_number: `202609011000100${i.toString().padStart(2, '0')}`,
                actual_result: "big",
                actual_number: 8,
                predicted_type: "BIG",
                tier: "STANDARD"
            });
        }
        history.push(
            { issue_number: "20260901100010050", actual_result: "small", actual_number: 1, predicted_type: "BIG", tier: "SCOUT" }
        );

        const lossInfo = engine._computeWalkForwardLossScore(history);
        assert.equal(lossInfo.explicitScore, 0.5);
    });
});
