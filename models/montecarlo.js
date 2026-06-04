/**
 * Hiroto AI Terminal — Monte Carlo Simulator
 */

export const MonteCarloEngine = {
    name: 'monte_carlo',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Monte Carlo: Insufficient data' };
        }
        
        const recent = history.slice(0, 24);
        const types = recent.map(h => h.actual_result || h.result_type);
        const bigProb = types.filter(t => t === 'big').length / types.length;
        
        // Dynamic regime adjustments
        let adjustedBigProb = bigProb;
        // Determine streak/regime state from recent inputs
        const last = types[0];
        let streak = 1;
        for (let i = 1; i < types.length; i++) {
            if (types[i] === last) streak++; else break;
        }
        
        if (streak >= 4) {
            // High reversion probability
            adjustedBigProb = last === 'big' ? Math.max(0.2, bigProb - 0.15) : Math.min(0.8, bigProb + 0.15);
        } else if (streak === 2 || streak === 3) {
            // Momentum continuation
            adjustedBigProb = last === 'big' ? Math.min(0.78, bigProb + 0.08) : Math.max(0.22, bigProb - 0.08);
        }

        const runs = 10000;
        let bigWins = 0;
        for (let i = 0; i < runs; i++) {
            if (Math.random() < adjustedBigProb) bigWins++;
        }

        const finalProb = bigWins / runs;
        const pred = finalProb >= 0.5 ? 'big' : 'small';
        const conf = Math.round(Math.max(finalProb, 1 - finalProb) * 100);

        return {
            pred,
            conf,
            reason: `Monte Carlo: ${bigWins} / 10k paths`,
            bigWins,
            smallWins: runs - bigWins,
            bigProb: adjustedBigProb
        };
    }
};
