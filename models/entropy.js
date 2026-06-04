/**
 * Hiroto AI Terminal — Entropy Analyzer
 */

import { MathUtils } from '../utils/math.js';

export const EntropyEngine = {
    name: 'entropy_anal',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 10) {
            return { pred: 'big', conf: 50, reason: 'Entropy: Insufficient data' };
        }
        
        const H = MathUtils.entropy(history.slice(0, 20));
        const last = history[0].actual_result || history[0].result_type || 'big';

        if (H < 0.85) {
            // Predictable, continue last state
            return { pred: last, conf: Math.round(50 + (1 - H) * 100), reason: `Low Entropy Continuation (H=${H.toFixed(2)})` };
        } else {
            // Highly random, revert
            return { pred: last === 'big' ? 'small' : 'big', conf: 54, reason: `High Entropy Reversion (H=${H.toFixed(2)})` };
        }
    }
};
