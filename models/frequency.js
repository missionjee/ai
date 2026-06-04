/**
 * Hiroto AI Terminal — Frequency Distribution Engine
 */

export const FrequencyEngine = {
    name: 'frequency_dist',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Frequency: Insufficient history' };
        }
        
        const recent = history.slice(0, 30);
        const bigCount = recent.filter(h => (h.actual_result || h.result_type) === 'big').length;
        const ratio = bigCount / recent.length;

        // Predict reversion to mean if deviation is high
        let pred = 'big';
        let conf = 50;
        
        if (ratio > 0.55) {
            pred = 'small';
            conf = Math.round(50 + (ratio - 0.5) * 80);
        } else if (ratio < 0.45) {
            pred = 'big';
            conf = Math.round(50 + (0.5 - ratio) * 80);
        } else {
            // Neutral, follow last state
            pred = history[0].actual_result || history[0].result_type || 'big';
            conf = 52;
        }

        return {
            pred,
            conf,
            reason: `Deviation from mean frequency: ${(ratio * 100).toFixed(0)}%`
        };
    }
};
