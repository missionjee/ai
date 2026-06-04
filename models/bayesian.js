/**
 * Hiroto AI Terminal — Bayesian Inference Model
 */

import { MathUtils } from '../utils/math.js';

export const BayesianEngine = {
    name: 'bayesian_update',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Bayesian: Insufficient data' };
        }
        
        const seq = history.map(h => h.actual_result || h.result_type).reverse();
        let alpha = 5, beta = 5;
        const decay = 0.95;

        for (let i = 0; i < seq.length; i++) {
            alpha *= decay;
            beta *= decay;
            if (seq[i] === 'big') alpha += 1.0;
            else beta += 1.0;
        }

        const pBig = alpha / (alpha + beta);
        const pred = pBig >= 0.5 ? 'big' : 'small';
        const conf = Math.round(Math.max(pBig, 1 - pBig) * 100);

        return {
            pred,
            conf,
            reason: `Bayesian posterior probability: ${pBig.toFixed(3)}`
        };
    }
};
