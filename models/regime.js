/**
 * Hiroto AI Terminal — Regime Detection Engine
 */

export const RegimeEngine = {
    name: 'regime_det',
    
    /**
     * Detect market regime
     * @param {Array} history - Array of outcome records
     */
    detect(history) {
        if (!history || history.length < 15) return 'mixed';
        const recent = history.slice(0, 20);
        const types = recent.map(h => h.actual_result || h.result_type);
        const bigRatio = types.filter(t => t === 'big').length / types.length;
        
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

        if (maxStreak >= 4) return 'trending';
        if (altRate > 0.65) return 'alternating';
        if (Math.abs(bigRatio - 0.5) > 0.15) return 'biased';
        return 'mixed';
    },

    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 10) {
            return { pred: 'big', conf: 50, reason: 'Regime: Insufficient data' };
        }
        
        const regime = this.detect(history);
        const last = history[0].actual_result || history[0].result_type || 'big';
        const recent = history.slice(0, 15).map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0);
        const sum = recent.reduce((a, b) => a + b, 0);
        const ratio = sum / recent.length;

        if (regime === 'trending') {
            return { pred: last, conf: 64, reason: `Regime: Trending (${last} continuation)` };
        }
        if (regime === 'alternating') {
            const opposite = last === 'big' ? 'small' : 'big';
            return { pred: opposite, conf: 66, reason: `Regime: Alternating (${opposite} expected)` };
        }
        if (regime === 'biased') {
            const bias = ratio > 0.5 ? 'small' : 'big'; // Mean reversion target
            return { pred: bias, conf: 62, reason: `Regime: Biased (Reverting to counter bias)` };
        }

        return {
            pred: ratio > 0.5 ? 'small' : 'big',
            conf: 52,
            reason: 'Regime: Mixed / Random'
        };
    }
};
