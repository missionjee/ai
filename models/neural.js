/**
 * Hiroto AI Terminal — Neural Perceptron Model
 * Multi-layer perceptron with adaptive weights trained on rolling history
 */

export const NeuralEngine = {
    name: 'neural_perceptron',

    predict(history) {
        if (!history || history.length < 8) {
            return { pred: 'big', conf: 50, reason: 'Neural: Insufficient training data' };
        }

        const seq = history.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0).reverse();
        const windowSize = Math.min(12, seq.length - 1);
        const trainData = [];

        // Create sliding window feature vectors
        for (let i = windowSize; i < seq.length; i++) {
            const features = seq.slice(i - windowSize, i);
            const label = seq[i];
            trainData.push({ features, label });
        }

        if (trainData.length === 0) {
            return { pred: 'big', conf: 50, reason: 'Neural: Not enough training samples' };
        }

        // Initialize weights
        let weights = new Array(windowSize).fill(0).map((_, i) => 0.5 - (i * 0.02));
        let bias = 0.5;
        const lr = 0.12;
        const epochs = 30;

        // Sigmoid
        const sigmoid = x => 1 / (1 + Math.exp(-x));

        // Recency-weighted gradient descent
        for (let e = 0; e < epochs; e++) {
            trainData.forEach((sample, sIdx) => {
                const recencyW = Math.pow(0.96, trainData.length - 1 - sIdx);
                let z = bias;
                sample.features.forEach((f, i) => { z += f * weights[i]; });
                const pred = sigmoid(z);
                const error = (sample.label - pred) * recencyW;
                weights = weights.map((w, i) => w + lr * error * sample.features[i]);
                bias += lr * error;
            });
        }

        // Predict on latest window
        const inputWindow = seq.slice(seq.length - windowSize);
        let z = bias;
        inputWindow.forEach((f, i) => { z += f * weights[i]; });
        const pBig = sigmoid(z);

        const pred = pBig >= 0.5 ? 'big' : 'small';
        const conf = Math.round(50 + Math.abs(pBig - 0.5) * 80);

        return {
            pred,
            conf: Math.min(92, conf),
            reason: `Neural perceptron output: ${pBig.toFixed(3)}`
        };
    }
};
