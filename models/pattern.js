/**
 * Hiroto AI Terminal — Pattern Recognition Engine
 */

export const PatternEngine = {
    name: 'pattern_persist',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Pattern: Insufficient history' };
        }
        
        const seq = history.map(h => h.actual_result || h.result_type).reverse();

        for (let len = 4; len >= 2; len--) {
            const pattern = seq.slice(-len).join('');
            let nextBig = 0, nextSmall = 0;
            
            for (let i = 0; i < seq.length - len - 1; i++) {
                const match = seq.slice(i, i + len).join('');
                if (match === pattern) {
                    if (seq[i + len] === 'big') nextBig++;
                    else nextSmall++;
                }
            }
            
            const total = nextBig + nextSmall;
            if (total >= 2) {
                const pBig = nextBig / total;
                const pred = pBig >= 0.5 ? 'big' : 'small';
                const conf = Math.round(Math.max(pBig, 1 - pBig) * 100);
                return {
                    pred,
                    conf,
                    reason: `Pattern match [${pattern}] (Score: ${nextBig}:${nextSmall})`
                };
            }
        }
        
        return { pred: seq[seq.length - 1], conf: 51, reason: 'Pattern: Default fallback' };
    }
};
