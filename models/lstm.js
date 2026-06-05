/**
 * Hiroto AI Terminal — LSTM-like Sequence Memory Engine
 * Simulates Long Short-Term Memory gating behavior without neural network overhead
 */

export const LSTMEngine = {
    name: 'lstm_sequence',

    predict(history) {
        if (!history || history.length < 8) {
            return { pred: 'big', conf: 50, reason: 'LSTM: Building sequence memory' };
        }

        const seq = history.map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0).reverse();

        // LSTM-inspired gating: Forget gate, Input gate, Cell state, Output gate
        let cellState = 0.5;
        let hiddenState = 0.5;

        const sigmoid = x => 1 / (1 + Math.exp(-x));
        const tanh = x => Math.tanh(x);

        // Learnable-style weights (fixed heuristic initialization)
        const Wf = 0.7, Uf = 0.5, bf = -0.3;  // Forget gate
        const Wi = 0.6, Ui = 0.5, bi = 0.1;   // Input gate
        const Wc = 0.8, Uc = 0.3, bc = 0.0;   // Cell gate
        const Wo = 0.5, Uo = 0.4, bo = 0.0;   // Output gate

        seq.forEach((x_t, idx) => {
            const recencyWeight = Math.pow(0.97, seq.length - 1 - idx);

            // Forget gate: what to keep from cell state
            const fg = sigmoid(Wf * x_t + Uf * hiddenState + bf);
            // Input gate: what new info to write
            const ig = sigmoid(Wi * x_t + Ui * hiddenState + bi);
            // Cell candidate
            const cg = tanh(Wc * x_t + Uc * hiddenState + bc);
            // Output gate
            const og = sigmoid(Wo * x_t + Uo * hiddenState + bo);

            // Update cell state with recency weighting
            const newCell = fg * cellState * recencyWeight + ig * cg;
            cellState = newCell;

            // Update hidden state
            hiddenState = og * tanh(cellState);
        });

        // hiddenState is our prediction signal
        const pBig = sigmoid(hiddenState * 3 + cellState - 0.5);
        const pred = pBig >= 0.5 ? 'big' : 'small';
        const conf = Math.round(50 + Math.abs(pBig - 0.5) * 90);

        return {
            pred,
            conf: Math.max(50, Math.min(94, conf)),
            reason: `LSTM cell state: ${cellState.toFixed(3)}, hidden: ${hiddenState.toFixed(3)}`
        };
    }
};
