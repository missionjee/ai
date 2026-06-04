/**
 * Hiroto AI Terminal — Feature Engineering Pipeline
 */

import { MathUtils } from '../utils/math.js';

export const FeaturePipeline = {
    /**
     * Extract features from a historical dataset slice
     * @param {Array} history - Array of outcome records
     */
    extract(history) {
        if (!history || history.length === 0) return null;
        
        const types = history.map(h => h.actual_result || h.result_type);
        const nums = history.map(h => h.actual_number).filter(n => n !== undefined && n !== null);
        const total = types.length;
        
        const bigCount = types.filter(t => t === 'big').length;
        const bigRatio = total > 0 ? bigCount / total : 0.5;

        const evens = nums.filter(n => n % 2 === 0).length;
        const oddEvenRatio = nums.length > 0 ? evens / nums.length : 0.5;

        // Transition counts
        let transBB = 0, transBS = 0, transSB = 0, transSS = 0;
        for (let i = 1; i < types.length; i++) {
            const prev = types[i];
            const curr = types[i - 1];
            if (prev === 'big' && curr === 'big') transBB++;
            else if (prev === 'big' && curr === 'small') transBS++;
            else if (prev === 'small' && curr === 'big') transSB++;
            else if (prev === 'small' && curr === 'small') transSS++;
        }

        // Current streak
        const last = types[0];
        let streakLength = 0;
        for (let i = 0; i < types.length; i++) {
            if (types[i] === last) streakLength++;
            else break;
        }

        // Gap analysis
        const gaps = { big: [], small: [] };
        let lastIdx = { big: -1, small: -1 };
        types.forEach((t, idx) => {
            if (lastIdx[t] !== -1) gaps[t].push(idx - lastIdx[t]);
            lastIdx[t] = idx;
        });
        const avgGapBig = gaps.big.length ? MathUtils.mean(gaps.big) : 2.0;
        const avgGapSmall = gaps.small.length ? MathUtils.mean(gaps.small) : 2.0;

        const binNums = types.map(t => t === 'big' ? 1 : 0);
        const entropy = MathUtils.entropy(types.slice(0, 20));
        const volatility = MathUtils.stdDev(binNums.slice(0, 20));
        const r1 = MathUtils.autocorrelation(binNums.slice(0, 20), 1);

        return {
            bigRatio,
            oddEvenRatio,
            streakLength,
            entropy,
            volatility,
            avgGapBig,
            avgGapSmall,
            autocorrLag1: r1,
            transitions: {
                pBB: transBB / (transBB + transBS || 1),
                pBS: transBS / (transBB + transBS || 1),
                pSB: transSB / (transSB + transSS || 1),
                pSS: transSS / (transSB + transSS || 1)
            }
        };
    }
};
