/**
 * Hiroto AI Terminal — Trend Persistence Engine
 */

export const TrendEngine = {
    name: 'rolling_trend',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 10) {
            return { pred: 'big', conf: 50, reason: 'Trend: Insufficient history' };
        }
        
        const seq = history.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0).reverse();

        let level = seq[0];
        let trend = seq[1] - seq[0];
        const alpha = 0.35;
        const beta = 0.15;

        for (let i = 1; i < seq.length; i++) {
            const lastLevel = level;
            level = alpha * seq[i] + (1 - alpha) * (level + trend);
            trend = beta * (level - lastLevel) + (1 - beta) * trend;
        }

        const forecast = level + trend;
        const pred = forecast >= 0.5 ? 'big' : 'small';
        const conf = Math.round(50 + Math.min(45, Math.abs(forecast - 0.5) * 90));

        return {
            pred,
            conf,
            reason: `Double Exp Forecast: ${forecast.toFixed(2)}`
        };
    }
};
