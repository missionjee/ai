/**
 * Hiroto AI Terminal — Markov Chain Predictor (Order 1, 2, 3)
 */

export const MarkovEngine = {
    name: 'markov_chain',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Markov: Insufficient data' };
        }
        
        const seq = history.map(h => h.actual_result || h.result_type).reverse();
        const last3 = seq.slice(-3).join('');
        const last2 = seq.slice(-2).join('');
        const last1 = seq.slice(-1).join('');

        const getTransitions = (len) => {
            const trans = {};
            for (let i = 0; i <= seq.length - len - 1; i++) {
                const ctx = seq.slice(i, i + len).join('');
                const next = seq[i + len];
                if (!trans[ctx]) trans[ctx] = { big: 0, small: 0 };
                trans[ctx][next]++;
            }
            return trans;
        };

        // Try Order 3
        const trans3 = getTransitions(3)[last3];
        if (trans3 && (trans3.big + trans3.small) >= 3) {
            const tot = trans3.big + trans3.small;
            const pBig = trans3.big / tot;
            return {
                pred: pBig >= 0.5 ? 'big' : 'small',
                conf: Math.round(Math.max(pBig, 1 - pBig) * 100),
                reason: `Markov Order 3 matched [${last3}]`
            };
        }

        // Try Order 2
        const trans2 = getTransitions(2)[last2];
        if (trans2 && (trans2.big + trans2.small) >= 3) {
            const tot = trans2.big + trans2.small;
            const pBig = trans2.big / tot;
            return {
                pred: pBig >= 0.5 ? 'big' : 'small',
                conf: Math.round(Math.max(pBig, 1 - pBig) * 100),
                reason: `Markov Order 2 matched [${last2}]`
            };
        }

        // Try Order 1
        const trans1 = getTransitions(1)[last1];
        if (trans1 && (trans1.big + trans1.small) > 0) {
            const tot = trans1.big + trans1.small;
            const pBig = trans1.big / tot;
            return {
                pred: pBig >= 0.5 ? 'big' : 'small',
                conf: Math.round(Math.max(pBig, 1 - pBig) * 100),
                reason: `Markov Order 1 matched [${last1}]`
            };
        }

        return { pred: 'big', conf: 50, reason: 'Markov: Fallback prediction' };
    }
};
