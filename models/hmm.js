/**
 * Hiroto AI Terminal — Hidden Markov Model (HMM)
 */

export const HMMEngine = {
    name: 'hidden_markov',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 15) {
            return { pred: 'big', conf: 50, reason: 'HMM: Insufficient history' };
        }
        
        const seq = history.map(h => h.actual_result || h.result_type).reverse().map(t => t === 'big' ? 1 : 0);

        // State 0: Small dominant regime, State 1: Big dominant regime
        const trans = [[0.6, 0.4], [0.4, 0.6]];
        const emit = [[0.72, 0.28], [0.28, 0.72]]; // P(Obs=Small|State), P(Obs=Big|State)

        let f = [0.5, 0.5]; // Forward probabilities
        for (let t = 0; t < seq.length; t++) {
            const obs = seq[t];
            const next_f = [0, 0];
            for (let ns = 0; ns < 2; ns++) {
                let sum = 0;
                for (let cs = 0; cs < 2; cs++) {
                    sum += f[cs] * trans[cs][ns];
                }
                next_f[ns] = sum * (ns === 1 ? emit[ns][obs] : emit[ns][1 - obs]);
            }
            const norm = next_f[0] + next_f[1];
            f = norm > 0 ? [next_f[0] / norm, next_f[1] / norm] : [0.5, 0.5];
        }

        const pNextState1 = f[0] * trans[0][1] + f[1] * trans[1][1];
        const pBig = (1 - pNextState1) * emit[0][1] + pNextState1 * emit[1][1];
        const pred = pBig >= 0.5 ? 'big' : 'small';
        const conf = Math.round(Math.max(pBig, 1 - pBig) * 100);

        return {
            pred,
            conf,
            reason: `HMM hidden state 1 bias: ${(pNextState1 * 100).toFixed(0)}%`
        };
    }
};
