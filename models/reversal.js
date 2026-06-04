/**
 * Hiroto AI Terminal — Reversal Detection Engine
 */

export const ReversalEngine = {
    name: 'reversal_det',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Reversal: Insufficient data' };
        }
        
        const nums = history.slice(0, 20).map(h => h.actual_number).filter(n => n !== undefined && n !== null);
        if (nums.length < 4) {
            return { pred: 'big', conf: 50, reason: 'Reversal: No numbers' };
        }

        // Support and resistance
        const freq = {};
        nums.forEach(n => freq[n] = (freq[n] || 0) + 1);
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const support = parseInt(sorted[sorted.length - 1][0]);
        const resistance = parseInt(sorted[0][0]);
        const lastNum = nums[0];

        if (lastNum <= support + 1) {
            return { pred: 'big', conf: 68, reason: `Bounce support: pivot at ${support}` };
        }
        if (lastNum >= resistance - 1) {
            return { pred: 'small', conf: 68, reason: `Reject resistance: pivot at ${resistance}` };
        }

        return {
            pred: lastNum >= 5 ? 'small' : 'big',
            conf: 52,
            reason: 'Reversal indicator: neutral'
        };
    }
};
