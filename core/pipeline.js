/**
 * Hiroto AI Terminal — Prediction Validation Pipeline
 */

import { MathUtils } from '../utils/math.js';

export const ValidationPipeline = {
    /**
     * Run predictions through a multi-stage validation check
     * @param {Object} predResult - Prediction result from the ensemble
     * @param {Array} history - Historical dataset slice
     * @returns {Object} Validation status and explanation
     */
    validate(predResult, history, minConfidence = 52) {
        if (!predResult || !history || history.length < 5) {
            return { isValid: false, reason: 'Insufficient validation context' };
        }

        // Adjust thresholds dynamically for short startup histories
        const targetConsensus = history.length < 15 ? 0.51 : 0.55;
        const targetMinConf = history.length < 15 ? 50 : minConfidence;

        // 1. Ensemble Validation (Consensus check)
        if (predResult.consensus < targetConsensus) {
            return { isValid: false, reason: 'Ensemble consensus too low' };
        }

        // 2. Confidence Validation
        if (predResult.confidence < targetMinConf) {
            return { isValid: false, reason: 'Confidence below threshold' };
        }

        // 3. Statistical Validation
        const recent = history.slice(0, 24);
        const chi = MathUtils.chiSquareTest(recent);
        const vol = MathUtils.stdDev(recent.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0));
        if (vol > 0.58) {
            return { isValid: false, reason: 'Volatility variance exceeds threshold limits' };
        }

        // 4. Risk Validation (Consensus vs. Volatility risk check)
        if (predResult.riskLevel === 'HIGH' && predResult.confidence < 58 && history.length >= 15) {
            return { isValid: false, reason: 'High risk parameters mismatch' };
        }

        return { isValid: true, reason: 'Signal cleared' };
    }
};
