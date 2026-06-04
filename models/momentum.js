/**
 * Hiroto AI Terminal — Momentum Detector (RSI / ROC)
 */

export const MomentumEngine = {
    name: 'momentum_det',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Momentum: Insufficient data' };
        }
        
        const recent = history.slice(0, 14).map(h => ((h.actual_result || h.result_type) === 'big' ? 1 : 0) * 100);

        let gains = 0, losses = 0;
        for (let i = 0; i < recent.length - 1; i++) {
            const diff = recent[i] - recent[i+1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }

        const rsi = losses === 0 ? 100 : 100 - (100 / (1 + (gains / losses)));
        
        if (rsi > 70) {
            return { pred: 'small', conf: Math.round(50 + (rsi - 70) * 1.3), reason: `RSI Overbought (${rsi.toFixed(0)})` };
        }
        if (rsi < 30) {
            return { pred: 'big', conf: Math.round(50 + (30 - rsi) * 1.3), reason: `RSI Oversold (${rsi.toFixed(0)})` };
        }
        
        return {
            pred: rsi > 50 ? 'big' : 'small',
            conf: 58,
            reason: `RSI Momentum follow-up: ${rsi.toFixed(0)}`
        };
    }
};
