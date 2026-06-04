/**
 * Hiroto AI Terminal — Trend Engine (Multi-Period Analysis)
 */

import { MathUtils } from '../utils/math.js';

export const TrendEngine = {
    name: 'trend_intelligence',

    /**
     * Compute comprehensive metrics for multiple periods
     * @param {Array} history - Array of outcome records
     */
    analyze(history) {
        if (!history || history.length === 0) return {};
        
        const windows = [10, 25, 50, 100, 250, 500];
        const report = {};

        windows.forEach(w => {
            const slice = history.slice(0, w);
            if (slice.length === 0) return;
            
            const types = slice.map(h => h.actual_result || h.result_type);
            const bin = types.map(t => t === 'big' ? 1 : 0);
            
            const bigs = types.filter(t => t === 'big').length;
            const ratio = bigs / slice.length;
            
            // Trend strength: distance from 50% equilibrium
            const trendStrength = Math.abs(ratio - 0.5) * 2; // Range [0, 1]
            
            // Trend stability: inverse of volatility
            const vol = MathUtils.stdDev(bin);
            const trendStability = Math.max(0, 1 - vol * 2); // Higher means more stable

            // Autocorrelation at lag-1
            const r1 = MathUtils.autocorrelation(bin, 1);
            
            // Continuation probability
            let continuationProb = 0.5;
            if (r1 > 0) continuationProb = 0.5 + r1 * 0.4;
            else if (r1 < 0) continuationProb = 0.5 + r1 * 0.2; // Alternating trend implies continuation of the alternation pattern
            
            // Reversal probability
            const reversalProb = 1 - continuationProb;
            
            // Entropy as patterns persistence proxy
            const entropy = MathUtils.entropy(types);
            const patternPersistence = Math.max(0, 1 - entropy);

            // Classification
            let regime = 'mixed';
            if (slice.length >= 10) {
                let alts = 0;
                for (let i = 1; i < types.length; i++) {
                    if (types[i] !== types[i - 1]) alts++;
                }
                const altRate = alts / (types.length - 1);
                
                let maxStreak = 1, currStreak = 1;
                for (let i = 1; i < types.length; i++) {
                    if (types[i] === types[i - 1]) {
                        currStreak++;
                        maxStreak = Math.max(maxStreak, currStreak);
                    } else {
                        currStreak = 1;
                    }
                }
                if (maxStreak >= 4) regime = 'trending';
                else if (altRate > 0.65) regime = 'alternating';
                else if (Math.abs(ratio - 0.5) > 0.15) regime = 'biased';
            }

            report[w] = {
                window: w,
                bigRatio: ratio,
                trendStrength,
                trendStability,
                continuationProb,
                reversalProb,
                patternPersistence,
                regime
            };
        });

        return report;
    }
};
