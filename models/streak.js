/**
 * Hiroto AI Terminal — Streak Detection Engine
 */

export const StreakEngine = {
    name: 'streak_anal',
    
    /**
     * Generate prediction from historical observations
     * @param {Array} history - Array of outcome records
     */
    predict(history) {
        if (!history || history.length < 5) {
            return { pred: 'big', conf: 50, reason: 'Streak: Insufficient history' };
        }
        
        const seq = history.map(h => h.actual_result || h.result_type);
        const last = seq[0];
        let currentStreak = 1;
        
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] === last) currentStreak++;
            else break;
        }

        let continueCount = 0, breakCount = 0;
        for (let i = 0; i < seq.length - currentStreak - 1; i++) {
            let matches = true;
            for (let j = 0; j < currentStreak; j++) {
                if (seq[i + j] !== seq[i]) { matches = false; break; }
            }
            if (matches && seq[i + currentStreak] !== seq[i]) {
                if (seq[i + currentStreak + 1] === seq[i]) continueCount++;
                else breakCount++;
            }
        }

        const total = continueCount + breakCount;
        if (total >= 2) {
            const pBreak = breakCount / total;
            const pred = pBreak >= 0.5 ? (last === 'big' ? 'small' : 'big') : last;
            const conf = Math.round(50 + Math.abs(pBreak - 0.5) * 90);
            return {
                pred,
                conf,
                reason: `Streak Hazard analysis: P(break|${currentStreak}x)=${(pBreak * 100).toFixed(0)}%`
            };
        }

        // Hard threshold fallback
        if (currentStreak >= 4) {
            return { pred: last === 'big' ? 'small' : 'big', conf: 75, reason: `Streak reversal alert (${currentStreak}x)` };
        }
        return { pred: last, conf: 55, reason: `Streak continuation momentum (${currentStreak}x)` };
    }
};
