/**
 * Hiroto AI Terminal — Kalman Filter Trend Predictor
 * Optimal linear state estimator for noisy binary sequence prediction
 */

export const KalmanEngine = {
    name: 'kalman_filter',

    predict(history) {
        if (!history || history.length < 6) {
            return { pred: 'big', conf: 50, reason: 'Kalman: Insufficient observations' };
        }

        const seq = history.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0).reverse();

        // Kalman filter state tracking
        let x = 0.5;       // State estimate (probability of big)
        let P = 1.0;       // Estimate uncertainty
        const Q = 0.05;    // Process noise (how much state changes)
        const R = 0.3;     // Measurement noise (how noisy the observations are)

        // Apply recency decay on observation noise
        seq.forEach((obs, idx) => {
            // Predict step
            const x_pred = x;
            const P_pred = P + Q;

            // Adaptive measurement noise — recent obs trusted more
            const recencyFactor = Math.pow(0.92, seq.length - 1 - idx);
            const R_adaptive = R / (recencyFactor + 0.01);

            // Update step (Kalman gain)
            const K = P_pred / (P_pred + R_adaptive);
            x = x_pred + K * (obs - x_pred);
            P = (1 - K) * P_pred;
        });

        // x is now our filtered probability estimate
        const pBig = Math.max(0.01, Math.min(0.99, x));
        const pred = pBig >= 0.5 ? 'big' : 'small';
        
        // Confidence: scaled by certainty (1 - P) and separation from 0.5
        const certainty = Math.max(0, 1 - P * 3);
        const separation = Math.abs(pBig - 0.5) * 2;
        const conf = Math.round(50 + separation * certainty * 40);

        return {
            pred,
            conf: Math.max(50, Math.min(93, conf)),
            reason: `Kalman filtered estimate: ${pBig.toFixed(3)} (P=${P.toFixed(3)})`
        };
    }
};
