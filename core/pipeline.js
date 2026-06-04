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
        if (!predResult || !history || history.length < 10) {
            return { isValid: false, reason: 'Insufficient validation context' };
        }

        // 1. Ensemble Validation (Consensus check)
        if (predResult.consensus < 0.55) {
            return { isValid: false, reason: 'Ensemble consensus too low' };
        }

        // 2. Confidence Validation
        if (predResult.confidence < minConfidence) {
            return { isValid: false, reason: 'Confidence below threshold' };
        }

        // 3. Statistical Validation
        const recent = history.slice(0, 24);
        const chi = MathUtils.chiSquareTest(recent);
        // Note: We don't reject outright if random, but flag if variance is critically high
        const vol = MathUtils.stdDev(recent.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0));
        if (vol > 0.58) {
            return { isValid: false, reason: 'Volatility variance exceeds threshold limits' };
        }

        // 4. Risk Validation (Consensus vs. Volatility risk check)
        if (predResult.riskLevel === 'HIGH' && predResult.confidence < 58) {
            return { isValid: false, reason: 'High risk parameters mismatch' };
        }

        return { isValid: true, reason: 'Signal cleared' };
    }
};
