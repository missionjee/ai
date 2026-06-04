/**
 * Hiroto AI Terminal — Volatility Analyzer
 */

import { MathUtils } from '../utils/math.js';

export const VolatilityEngine = {
    name: 'volatility_anal',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Volatility: Insufficient history' };
        }
        
        const nums = history.slice(0, 15).map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0);
        const vol = MathUtils.stdDev(nums);
        const last = history[0].actual_result || history[0].result_type || 'big';

        if (vol < 0.43) {
            // Low volatility - trend continues
            return { pred: last, conf: 62, reason: `Low Volatility State (${vol.toFixed(2)})` };
        } else {
            // High volatility - mean reversion
            return { pred: last === 'big' ? 'small' : 'big', conf: 64, reason: `High Volatility State (${vol.toFixed(2)})` };
        }
    }
};
