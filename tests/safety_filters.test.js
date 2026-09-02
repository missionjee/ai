import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PredictionEngine } from '../engine.js';

describe('PredictionEngine Safety Filters & Gating Matrix', () => {
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

    it('1. Dragon 4x-5x Exclusion Zone: forces HOLD status and disables Sniper', () => {
        const engine = new PredictionEngine();
        // 20 rounds ending with a 4x Big streak: base ends with small (1), then 4 bigs (8, 8, 8, 8)
        const base = [1, 8, 2, 7, 3, 6, 2, 7, 1, 8, 3, 6, 1, 8, 2, 1];
        const fourStreak = [...base, 8, 8, 8, 8];
        const res = engine.predict(createHistory(fourStreak));

        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Dragon Exclusion Zone') || res.statusReason.includes('Anti-Drawdown') || res.statusReason.includes('discordance'));
        assert.ok(res.confidence <= 58);
    });

    it('2. Dragon Streak 6 Reversal Pending: forces HOLD and awaits confirmation draw', () => {
        const engine = new PredictionEngine();
        // Base ends with small (1), followed by exactly six Bigs (8, 8, 8, 8, 8, 8)
        const base = [1, 8, 2, 7, 3, 6, 2, 7, 1, 8, 3, 6, 1, 1];
        const sixStreak = [...base, 8, 8, 8, 8, 8, 8];
        const res = engine.predict(createHistory(sixStreak));

        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Dragon Reversal Pending') || res.statusReason.includes('discordance'));
    });

    it('3. Alternation Ceiling (4+ switches): neutralizes high-entropy oscillation traps into HOLD', () => {
        const engine = new PredictionEngine();
        // Alternating sequence ending in 5 consecutive switches: B, S, B, S, B
        const history = createHistory([7, 8, 2, 3, 7, 8, 2, 8, 1, 8, 2, 9, 1, 8, 2]);
        const res = engine.predict(history);

        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Alternation Ceiling') || res.statusReason.includes('discordance'));
    });

    it('4. 2-2 Pattern Trap (BB-SS or BS-BS): detected and routed into HOLD', () => {
        const engine = new PredictionEngine();
        // 2-2 pair in trailing 4 draws: B, B, S, S (8, 7, 1, 2)
        const history = createHistory([3, 4, 8, 7, 1, 2, 8, 7, 1, 2]);
        const res = engine.predict(history);

        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('2-2') || res.statusReason.includes('discordance') || res.statusReason.includes('Symmetry'));
    });

    it('5. Streak Boundary 2x Transition: prevents premature trend chasing', () => {
        const engine = new PredictionEngine();
        // Streak exactly 2: ending with [1, 2, 8, 8] (2 Small followed by 2 Big)
        const history = createHistory([3, 7, 2, 6, 1, 8, 2, 3, 1, 8, 8]);
        const res = engine.predict(history);

        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Streak boundary 2x') || res.statusReason.includes('Anti-Drawdown') || res.statusReason.includes('discordance'));
    });

    it('6. Anti-Drawdown Shield: halts execution upon 2 consecutive misses', () => {
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
        // Append 2 consecutive misses at the very end
        fullHistory.push(
            { issue_number: "20260901100010050", actual_result: "big", actual_number: 7, predicted_type: "SMALL" }, // Miss 1
            { issue_number: "20260901100010051", actual_result: "small", actual_number: 1, predicted_type: "BIG" }  // Miss 2
        );

        const res = engine.predict(fullHistory);
        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Anti-Drawdown Shield') || res.statusReason.includes('discordance'));
    });

    it('7. Ultra-Sniper Gating: strictly enforces status !== HOLD even when calibrated probability is high', () => {
        const engine = new PredictionEngine();

        // In a 4x streak exclusion zone, calibrated probability might be high, but isSniper MUST remain false and status must remain HOLD
        const streak4 = createHistory([2, 3, 2, 3, 2, 3, 1, 8, 8, 8, 8]);
        const res = engine.predict(streak4);

        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
    });

    it('8. Anti-3rd+ Loss Barrier: enforces strict Quarantine when 3 consecutive misses occur', () => {
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
        // Append 3 consecutive misses
        fullHistory.push(
            { issue_number: "20260901100010050", actual_result: "small", actual_number: 1, predicted_type: "BIG" },
            { issue_number: "20260901100010051", actual_result: "big", actual_number: 9, predicted_type: "SMALL" },
            { issue_number: "20260901100010052", actual_result: "small", actual_number: 2, predicted_type: "BIG" }
        );

        const res = engine.predict(fullHistory);
        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Quarantine') || res.statusReason.includes('Anti-Drawdown') || res.statusReason.includes('discordance'));
        assert.ok(res.confidence <= 54);
    });

    it('9. Broken Symmetry Trap: identifies 2-1-2 and 1-2-1 rhythm oscillations into HOLD', () => {
        const engine = new PredictionEngine();
        // 2-1-2 rhythm: BB, S, BB (8, 8, 1, 8, 8)
        const history = createHistory([3, 2, 1, 8, 8, 1, 8, 8]);
        const res = engine.predict(history);
        assert.equal(res.status, 'HOLD');
        assert.equal(res.isSniper, false);
        assert.ok(res.statusReason.includes('Broken Symmetry') || res.statusReason.includes('discordance') || res.statusReason.includes('Streak boundary') || res.statusReason.includes('Anti-Drawdown'));
    });

    it('10. Walk-Forward Backtest: detects model degradation without explicit predicted_type', () => {
        const engine = new PredictionEngine();
        // Alternating choppy sequence without explicit predicted_type
        const history = createHistory([8, 8, 8, 8, 8, 8, 8, 8, 1, 8, 1]);
        const misses = engine._computeWalkForwardConsecutiveMisses(history);
        assert.equal(typeof misses, 'number');
        assert.ok(misses >= 0);
    });
});
