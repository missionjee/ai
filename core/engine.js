/**
 * Hiroto AI Terminal — Core Ensemble Prediction & Self-Learning Engine
 */

import { MathUtils } from '../utils/math.js';
import { ValidationPipeline } from './pipeline.js';
import { FirebaseAdapter } from '../firebase/adapter.js';

import { BayesianEngine } from '../models/bayesian.js';
import { HMMEngine } from '../models/hmm.js';
import { MarkovEngine } from '../models/markov.js';
import { MonteCarloEngine } from '../models/montecarlo.js';
import { FrequencyEngine } from '../models/frequency.js';
import { TrendEngine } from '../models/trend.js';
import { MomentumEngine } from '../models/momentum.js';
import { EntropyEngine } from '../models/entropy.js';
import { VolatilityEngine } from '../models/volatility.js';
import { PatternEngine } from '../models/pattern.js';
import { StreakEngine } from '../models/streak.js';
import { ReversalEngine } from '../models/reversal.js';
import { RegimeEngine } from '../models/regime.js';

export class NeuralMatrixEngine {
    constructor() {
        this.engines = [
            BayesianEngine,
            HMMEngine,
            MarkovEngine,
            MonteCarloEngine,
            FrequencyEngine,
            TrendEngine,
            MomentumEngine,
            EntropyEngine,
            VolatilityEngine,
            PatternEngine,
            StreakEngine,
            ReversalEngine,
            RegimeEngine
        ];
        
        this.strategies = this.engines.map(e => e.name);
        this.performance = {};
        
        this.strategies.forEach(s => {
            this.performance[s] = {
                wins: 0,
                losses: 0,
                recent: [],
                uncertainty: 1.0
            };
        });
    }

    /**
     * Compute the adaptive ensemble prediction
     * @param {Object} lastResult - Latest result payload from API
     * @param {Array} history - Dataset history slice
     * @param {Number} minConfidence - Configured signal gating threshold
     */
    generatePrediction(lastResult, history, minConfidence = 52) {
        if (!history || history.length < 5) {
            return {
                prediction: 'big', confidence: 50, riskLevel: 'HIGH', strategy: 'default',
                reason: 'Syncing prediction cores...', breakdown: [],
                entropy: 1.0, regime: 'mixed', volatility: 0.5,
                bigProb: '50.0', smallProb: '50.0', consensus: 0, isValid: false
            };
        }

        // Run all component engines
        const results = this.engines.map(engine => {
            try {
                return { name: engine.name, ...engine.predict(history) };
            } catch (err) {
                console.error(`Error running model ${engine.name}:`, err);
                return { name: engine.name, pred: 'big', conf: 50, reason: 'Execution failure' };
            }
        });

        const weights = this.getAdaptiveWeights();
        const regime = RegimeEngine.detect(history);
        const entropy = MathUtils.entropy(history.slice(0, 20));
        const volatility = MathUtils.stdDev(history.slice(0, 15).map(h => (h.actual_result || h.result_type) === 'big' ? 1 : 0));

        const regimeBoost = {
            trending: { streak_anal: 1.5, rolling_trend: 1.4, markov_chain: 1.2, momentum_det: 1.3 },
            alternating: { pattern_persist: 1.5, autocorr: 1.4, frequency_dist: 1.2 },
            biased: { mean_revert: 1.5, bayesian_update: 1.3, hidden_markov: 1.4 },
            mixed: {}
        };

        let bigScore = 0, smallScore = 0, totalWeight = 0;
        const breakdown = [];
        let bigVotes = 0, smallVotes = 0;

        results.forEach(r => {
            let w = weights[r.name] || 1.0;
            const boost = (regimeBoost[regime] || {})[r.name] || 1.0;
            w *= boost;
            
            const perf = this.performance[r.name];
            if (perf && perf.uncertainty > 0.5) {
                w *= (1 - (perf.uncertainty - 0.5) * 0.4);
            }
            
            const score = (r.conf / 100) * w;
            if (r.pred === 'big') { bigScore += score; bigVotes++; }
            else { smallScore += score; smallVotes++; }
            
            totalWeight += w;
            breakdown.push({ name: r.name, pred: r.pred, conf: r.conf, weight: w.toFixed(2) });
        });

        const bigProb = bigScore / totalWeight;
        const smallProb = smallScore / totalWeight;
        const prediction = bigProb > smallProb ? 'big' : 'small';
        const consensus = Math.max(bigVotes, smallVotes) / results.length;

        // Confidence Engine Logic
        let confidence = Math.round(Math.max(bigProb, smallProb) * 100);
        const entropyPenalty = Math.max(0, (entropy - 0.5) * 15);
        const volatilityPenalty = Math.max(0, (volatility - 0.45) * 10);
        confidence -= (entropyPenalty + volatilityPenalty);

        const recentAccuracy = this.getRecentAccuracy();
        confidence = Math.round(confidence * (0.8 + recentAccuracy * 0.2));
        confidence = Math.max(minConfidence, Math.min(95, confidence));

        let riskLevel = 'HIGH';
        if (confidence >= 75) riskLevel = 'LOW';
        else if (confidence >= 60) riskLevel = 'MEDIUM';

        const primary = results
            .filter(r => r.pred === prediction)
            .sort((a, b) => (b.conf * (weights[b.name] || 1)) - (a.conf * (weights[a.name] || 1)))[0];

        const predResult = {
            prediction, confidence, riskLevel,
            strategy: primary ? primary.name : 'ensemble',
            reason: primary ? primary.reason : 'Weighted ensemble consensus',
            breakdown,
            bigProb: (bigProb * 100).toFixed(1),
            smallProb: (smallProb * 100).toFixed(1),
            entropy, regime, volatility, consensus
        };

        // Gating Prediction
        const validation = ValidationPipeline.validate(predResult, history, minConfidence);
        predResult.isValid = validation.isValid;
        predResult.gateReason = validation.reason;

        return predResult;
    }

    /**
     * Compute adaptive weights based on recent performance
     */
    getAdaptiveWeights() {
        const weights = {};
        let totalPerf = 0;
        this.strategies.forEach(s => {
            const perf = this.performance[s];
            const recent = perf.recent.slice(-20);
            const wins = recent.filter(r => r).length;
            const acc = recent.length ? wins / recent.length : 0.5;
            weights[s] = (0.25 + acc * 1.5) * (1.5 - perf.uncertainty);
            totalPerf += weights[s];
        });
        
        this.strategies.forEach(s => {
            weights[s] = (weights[s] / totalPerf) * this.strategies.length;
        });
        return weights;
    }

    /**
     * Compute ensemble lifetime accuracy statistics
     */
    getRecentAccuracy() {
        const all = [];
        this.strategies.forEach(s => all.push(...this.performance[s].recent.slice(-10)));
        if (all.length === 0) return 0.5;
        return all.filter(r => r).length / all.length;
    }

    /**
     * Run learning update on prediction outcome
     */
    learnFromResult(prediction, actual, strategyName, usedStrategies = [], issueNum = null) {
        const correct = prediction === actual;

        if (strategyName && this.performance[strategyName]) {
            if (correct) this.performance[strategyName].wins++;
            else this.performance[strategyName].losses++;
            this.performance[strategyName].recent.push(correct);
            if (this.performance[strategyName].recent.length > 40) this.performance[strategyName].recent.shift();
            const recent = this.performance[strategyName].recent.slice(-15);
            const acc = recent.filter(r => r).length / recent.length;
            this.performance[strategyName].uncertainty = 1.0 - acc;
        }

        usedStrategies.forEach(s => {
            if (s.name !== strategyName && this.performance[s.name]) {
                const sCorrect = s.pred === actual;
                if (sCorrect) this.performance[s.name].wins++;
                else this.performance[s.name].losses++;
                this.performance[s.name].recent.push(sCorrect);
                if (this.performance[s.name].recent.length > 40) this.performance[s.name].recent.shift();
                const recent = this.performance[s.name].recent.slice(-15);
                const acc = recent.filter(r => r).length / recent.length;
                this.performance[s.name].uncertainty = 1.0 - acc;
            }
        });

        // Trigger remote Firebase log
        const weights = this.getAdaptiveWeights();
        const recentAccuracy = this.getRecentAccuracy();
        
        FirebaseAdapter.logLearningMetrics({
            period_number: issueNum || 'unknown',
            prediction,
            actual,
            success: correct,
            overall_accuracy: Math.round(recentAccuracy * 100),
            weights: Object.keys(weights).reduce((acc, k) => { acc[k] = parseFloat(weights[k].toFixed(3)); return acc; }, {}),
            diagnostics: Object.keys(this.performance).reduce((acc, k) => {
                const p = this.performance[k];
                acc[k] = { wins: p.wins, losses: p.losses, uncertainty: parseFloat(p.uncertainty.toFixed(3)) };
                return acc;
            }, {})
        });
    }

    /**
     * Fetch strategy stats array
     */
    getStrategyStats() {
        return this.strategies.map(s => {
            const p = this.performance[s];
            const total = p.wins + p.losses;
            const recent = p.recent.slice(-15);
            const recentWins = recent.filter(r => r).length;
            return {
                name: s, wins: p.wins, losses: p.losses,
                accuracy: total ? Math.round((p.wins / total) * 100) : 0,
                recentAccuracy: recent.length ? Math.round((recentWins / recent.length) * 100) : 0,
                uncertainty: Math.round(p.uncertainty * 100)
            };
        });
    }
}
