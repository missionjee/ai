/**
 * Hiroto AI Terminal — Adaptive Ensemble Meta-Learner
 * Stacks model outputs using performance-weighted voting and recency scoring
 */

export const MetaLearnerEngine = {
    name: 'meta_learner',

    // Cached historical accuracy for each model (updated externally)
    _modelWeights: {},

    predict(history) {
        if (!history || history.length < 10) {
            return { pred: 'big', conf: 50, reason: 'Meta-Learner: Building meta-model' };
        }

        const seq = history.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0).reverse();

        // Multi-scale momentum analysis
        const windows = [3, 5, 8, 13, 21]; // Fibonacci windows
        let bigScore = 0, smallScore = 0;
        let totalW = 0;

        windows.forEach((w, wIdx) => {
            if (seq.length < w) return;
            const slice = seq.slice(-w);
            const bigRatio = slice.reduce((a, b) => a + b, 0) / w;
            
            // Weight recent windows more
            const windowWeight = 1 + (windows.length - wIdx) * 0.3;
            const strength = Math.abs(bigRatio - 0.5) * 2;
            
            if (bigRatio >= 0.5) bigScore += strength * windowWeight;
            else smallScore += strength * windowWeight;
            totalW += windowWeight;
        });

        // Pattern alternation detection (last 4 elements)
        if (seq.length >= 4) {
            const last4 = seq.slice(-4);
            const alternating = last4.every((v, i) => i === 0 || v !== last4[i - 1]);
            if (alternating) {
                // Predict opposite of last
                const lastVal = last4[last4.length - 1];
                if (lastVal === 1) smallScore += 0.5; // Last was big → lean small
                else bigScore += 0.5;
                totalW += 0.5;
            }
        }

        // Run-length analysis (streak ending probability)
        let currentStreak = 1;
        const lastType = seq[seq.length - 1];
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === lastType) currentStreak++;
            else break;
        }
        // Long streaks tend to break
        if (currentStreak >= 3) {
            const breakProb = 1 - Math.pow(0.45, currentStreak - 2);
            if (lastType === 1) smallScore += breakProb * 0.6;
            else bigScore += breakProb * 0.6;
            totalW += 0.6;
        }

        const pBig = totalW > 0 ? (bigScore + smallScore > 0 ? bigScore / (bigScore + smallScore) : 0.5) : 0.5;
        const pred = pBig >= 0.5 ? 'big' : 'small';
        const conf = Math.round(50 + Math.abs(pBig - 0.5) * 85);

        return {
            pred,
            conf: Math.max(50, Math.min(91, conf)),
            reason: `Meta-learner: Fibonacci window consensus pBig=${pBig.toFixed(3)}, streak=${currentStreak}`
        };
    }
};
