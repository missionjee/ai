/**
 * Hiroto AI Terminal — Mathematical & Statistical Utilities
 */

export const MathUtils = {
    /**
     * Compute Shannon Entropy of a binary sequence
     * @param {Array} sequence - Array of 'big'/'small' or 1/0
     */
    entropy(sequence) {
        if (!sequence || sequence.length < 2) return 1.0;
        const counts = { 1: 0, 0: 0 };
        sequence.forEach(val => {
            const num = val === 'big' || val === 1 ? 1 : 0;
            counts[num]++;
        });
        const total = sequence.length;
        const p1 = counts[1] / total;
        const p0 = counts[0] / total;
        let ent = 0;
        if (p1 > 0) ent -= p1 * Math.log2(p1);
        if (p0 > 0) ent -= p0 * Math.log2(p0);
        return ent;
    },

    /**
     * Compute mean of a numerical array
     */
    mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    },

    /**
     * Compute standard deviation of a numerical array
     */
    stdDev(arr) {
        if (!arr || arr.length < 2) return 0.5;
        const avg = this.mean(arr);
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
        return Math.sqrt(variance);
    },

    /**
     * Compute Chi-Square statistics for uniform binary distribution
     * @param {Array} sequence - Array of 1 and 0
     */
    chiSquareTest(sequence) {
        if (!sequence || sequence.length < 8) return { statistic: 0, pValue: 1.0 };
        const counts = { 1: 0, 0: 0 };
        sequence.forEach(val => {
            const num = val === 'big' || val === 1 ? 1 : 0;
            counts[num]++;
        });
        const expected = sequence.length / 2;
        const chiSq = Math.pow(counts[1] - expected, 2) / expected + Math.pow(counts[0] - expected, 2) / expected;
        // P-value approximation for 1 degree of freedom
        const pValue = chiSq < 0.001 ? 1.0 : Math.exp(-chiSq / 2);
        return { statistic: chiSq, pValue };
    },

    /**
     * Compute Autocorrelation of an array at a specific lag
     */
    autocorrelation(arr, lag = 1) {
        if (!arr || arr.length <= lag + 2) return 0;
        const n = arr.length;
        const avg = this.mean(arr);
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n - lag; i++) {
            numerator += (arr[i] - avg) * (arr[i + lag] - avg);
        }
        for (let i = 0; i < n; i++) {
            denominator += Math.pow(arr[i] - avg, 2);
        }
        return denominator === 0 ? 0 : numerator / denominator;
    },

    /**
     * Exponential Moving Average calculation
     */
    ema(current, prevEma, alpha) {
        return alpha * current + (1 - alpha) * prevEma;
    }
};
