/**
 * Hiroto AI Terminal — Core Ensemble Prediction & Self-Learning Engine
 * v5.0 — 17-Engine Ensemble with Neural, Kalman, LSTM, Meta-Learner
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
import { NeuralEngine } from '../models/neural.js';
import { KalmanEngine } from '../models/kalman.js';
import { LSTMEngine } from '../models/lstm.js';
import { MetaLearnerEngine } from '../models/metalearner.js';

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
            RegimeEngine,
            NeuralEngine,
            KalmanEngine,
            LSTMEngine,
            MetaLearnerEngine
        ];
        
        this.strategies = this.engines.map(e => e.name);
        this.performance = {};
        
        // Confidence history for trend chart
        this.confidenceHistory = [];
        
        this.strategies.forEach(s => {
            this.performance[s] = {
                wins: 0,
                losses: 0,
                recent: [],
                uncertainty: 0.5  // Start neutral (not fully uncertain)
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

        // Enhanced regime boosts now cover new models
        const regimeBoost = {
            trending: { 
                streak_anal: 1.6, rolling_trend: 1.5, markov_chain: 1.3, momentum_det: 1.4,
                lstm_sequence: 1.4, kalman_filter: 1.3, neural_perceptron: 1.2
            },
            alternating: { 
                pattern_persist: 1.6, autocorr: 1.5, frequency_dist: 1.3,
                meta_learner: 1.5, reversal_detect: 1.4
            },
            biased: { 
                mean_revert: 1.5, bayesian_update: 1.4, hidden_markov: 1.5,
                kalman_filter: 1.4, neural_perceptron: 1.3
            },
            mixed: { meta_learner: 1.3, lstm_sequence: 1.2 }
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
                w *= (1 - (perf.uncertainty - 0.5) * 0.3); // Lighter penalty
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

        // ---- Enhanced Confidence Engine v2 ----
        let confidence = Math.round(Math.max(bigProb, smallProb) * 100);
        const sampleScale = history.length < 15 ? (history.length / 15) : 1.0;
        
        // Very relaxed penalties — only trigger on extreme entropy/volatility
        const entropyPenalty = Math.max(0, (entropy - 0.65) * 6) * sampleScale;
        const volatilityPenalty = Math.max(0, (volatility - 0.50) * 5) * sampleScale;
        confidence -= (entropyPenalty + volatilityPenalty);

        // Strong consensus bonus — reward agreement across 17 models
        if (consensus >= 0.55) {
            const bonus = Math.round((consensus - 0.50) * 30); // up to +15% bonus
            confidence += bonus;
        }

        // Boost from recent accuracy
        const recentAccuracy = this.getRecentAccuracy();
        confidence = Math.round(confidence * (0.82 + recentAccuracy * 0.18));
        
        // Hard floor / ceiling
        confidence = Math.max(minConfidence, Math.min(97, confidence));

        // Track confidence history for the trend chart
        this.confidenceHistory.push({
            ts: Date.now(),
            conf: confidence,
            consensus: Math.round(consensus * 100),
            pred: prediction
        });
        if (this.confidenceHistory.length > 60) this.confidenceHistory.shift();

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
            const acc = recent.length ? wins / recent.length : 0.5; // default 50% not 0%
            // Base weight: all models start at 1.0 equivalent 
            weights[s] = (0.4 + acc * 1.2) * (1.2 - perf.uncertainty * 0.4);
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
        if (all.length === 0) return 0.55; // Optimistic prior
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
            if (this.performance[strategyName].recent.length > 50) this.performance[strategyName].recent.shift();
            const recent = this.performance[strategyName].recent.slice(-20);
            const acc = recent.filter(r => r).length / recent.length;
            this.performance[strategyName].uncertainty = 1.0 - acc;
        }

        usedStrategies.forEach(s => {
            if (s.name !== strategyName && this.performance[s.name]) {
                const sCorrect = s.pred === actual;
                if (sCorrect) this.performance[s.name].wins++;
                else this.performance[s.name].losses++;
                this.performance[s.name].recent.push(sCorrect);
                if (this.performance[s.name].recent.length > 50) this.performance[s.name].recent.shift();
                const recent = this.performance[s.name].recent.slice(-20);
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
     * Calculate digit probability distribution from history, transition stats, and prediction bias
     */
    calculateNumberDistribution(history, predictedType = 'big') {
        const distribution = {};
        for (let i = 0; i <= 9; i++) distribution[i] = 0.0001;
        
        const valid = history.filter(h => h.actual_number !== undefined && h.actual_number !== null);
        const seq = valid.map(h => parseInt(h.actual_number)).filter(n => !isNaN(n) && n >= 0 && n <= 9).reverse();
        
        // 1. Overall base historical frequency
        const baseFreq = {};
        for (let i = 0; i <= 9; i++) baseFreq[i] = 0;
        seq.forEach(num => baseFreq[num]++);
        
        // 2. Recency-weighted frequency (last 20 items get 3x weight)
        const recentSeq = seq.slice(-20);
        const recentFreq = {};
        for (let i = 0; i <= 9; i++) recentFreq[i] = 0;
        recentSeq.forEach(num => recentFreq[num] += 3);
        
        // 3. Transition Markov Chain for digits
        const transitionCounts = {};
        for (let i = 0; i <= 9; i++) transitionCounts[i] = 0;
        
        let transitionWeightSum = 0;
        if (seq.length >= 2) {
            const lastNum = seq[seq.length - 1];
            for (let i = 0; i < seq.length - 1; i++) {
                if (seq[i] === lastNum) {
                    const nextNum = seq[i + 1];
                    const recencyWeight = Math.pow(0.94, seq.length - 1 - i);
                    transitionCounts[nextNum] += recencyWeight;
                    transitionWeightSum += recencyWeight;
                }
            }
        }
        
        // 4. Blend: 50% transition, 30% recency freq, 20% base freq
        for (let i = 0; i <= 9; i++) {
            const transProb = transitionWeightSum > 0 ? (transitionCounts[i] / transitionWeightSum) : (baseFreq[i] / (seq.length || 1));
            const baseProb = baseFreq[i] / (seq.length || 1);
            const recentProb = recentFreq[i] / (recentSeq.length * 3 || 1);
            distribution[i] = (transProb * 0.5) + (recentProb * 0.3) + (baseProb * 0.2);
        }
        
        // 5. Apply prediction bias (BIG/SMALL gating) — strong bias to focus on correct range
        for (let i = 0; i <= 9; i++) {
            if (predictedType === 'big') {
                distribution[i] *= (i >= 5 ? 3.0 : 0.08);
            } else {
                distribution[i] *= (i < 5 ? 3.0 : 0.08);
            }
        }
        
        // 6. Convert to normalized percentages
        const totalScore = Object.values(distribution).reduce((sum, v) => sum + v, 0) || 1.0;
        const sorted = Object.entries(distribution)
            .map(([num, score]) => {
                const percentage = (score / totalScore) * 100;
                return { number: parseInt(num), freq: Math.round(percentage) };
            })
            .sort((a, b) => b.freq - a.freq);
            
        const compatDist = {};
        for (let i = 0; i <= 9; i++) {
            const score = distribution[i] / totalScore;
            compatDist[i] = Math.round(score * seq.length) || 1;
        }

        return {
            primary: sorted[0] || { number: predictedType === 'big' ? 7 : 2, freq: 20 },
            secondary: sorted[1] || { number: predictedType === 'big' ? 8 : 1, freq: 15 },
            distribution: compatDist
        };
    }

    /**
     * Run Monte Carlo simulation paths
     */
    monteCarloSimulation(history, runs = 10000) {
        return MonteCarloEngine.predict(history);
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
                accuracy: total ? Math.round((p.wins / total) * 100) : 50,
                recentAccuracy: recent.length ? Math.round((recentWins / recent.length) * 100) : 50,
                uncertainty: Math.round(p.uncertainty * 100)
            };
        });
    }
    
    /**
     * Get confidence history for trend visualization
     */
    getConfidenceHistory() {
        return this.confidenceHistory;
    }
}
