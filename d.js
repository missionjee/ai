/**
 * Hiroto AI Terminal — Central Gateway Coordinator & Bootstrapper
 */

import { NeuralMatrixEngine } from './core/engine.js';
import { SecurityGuard } from './security/guard.js';
import { UIControls } from './ui/controls.js';
import { NeuralCanvas } from './visualization/canvas.js';
import { TrendEngine } from './trends/trendEngine.js';
import { FeaturePipeline } from './features/pipeline.js';
import { MathUtils } from './utils/math.js';

const CONFIG = {
    API_LATEST: 'https://tirangaprediction.ai/api_fixed.php?action=latest_results&source=1M',
    API_HISTORY: 'https://tirangaprediction.ai/api_fixed.php?action=history&source=1M',
    PROXY_LATEST: 'https://api.allorigins.win/raw?url=https://tirangaprediction.ai/api_fixed.php?action=latest_results&source=1M',
    PROXY_HISTORY: 'https://api.allorigins.win/raw?url=https://tirangaprediction.ai/api_fixed.php?action=history&source=1M',
    USE_PROXY: false,
    REFRESH_INTERVAL: 5000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    HISTORY_DISPLAY_LIMIT: 50,
    LOCAL_HISTORY_MAX: 1000,
    MIN_CONFIDENCE: 52,
    MAX_CONFIDENCE: 95
};

const PeriodCalculator = {
    DAILY_RESET_VALUE: 9671,
    calculateCounter(date = new Date()) {
        const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        return this.DAILY_RESET_VALUE + Math.floor((date - midnight) / 60000);
    },
    getCurrentPeriodNumber(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}${m}${d}1000${String(this.calculateCounter(date)).padStart(5, '0')}`;
    }
};

const state = {
    lastIssue: null,
    lastResults: [],
    fullHistory: [],
    pendingPredictions: new Map(),
    highProbNumber: null,
    secProbNumber: null,
    isConnected: false,
    retryCount: 0,
    session: null,
    stats: { wins: 0, losses: 0, total: 0, streak: 0, bestStreak: 0 },
    isFirstPrediction: true,
    currentTargetPeriod: null,
    currentPeriodNumber: null,
    lastPrediction: null,
    activePanel: 'predict',
    trendReport: {}
};

const HistoryManager = {
    STORAGE_KEY: 'cipher_full_history_v3',
    load() {
        try {
            const d = localStorage.getItem(this.STORAGE_KEY);
            return d ? JSON.parse(d) : [];
        } catch (e) {
            return [];
        }
    },
    save(history) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history.slice(0, CONFIG.LOCAL_HISTORY_MAX)));
    },
    merge(apiResults, latestResults) {
        const stored = this.load();
        const allNew = [...latestResults, ...apiResults];
        const map = new Map();
        
        stored.forEach(item => {
            if (item.issue_number) map.set(item.issue_number, item);
        });
        
        allNew.forEach(item => {
            if (!item.issue_number) return;
            const existing = map.get(item.issue_number);
            if (existing) {
                map.set(item.issue_number, {
                    ...existing,
                    ...item,
                    predicted_type: existing.predicted_type || item.predicted_type,
                    prediction_confidence: existing.prediction_confidence || item.prediction_confidence,
                    strategy_used: existing.strategy_used || item.strategy_used
                });
            } else {
                map.set(item.issue_number, item);
            }
        });
        
        const sorted = Array.from(map.values()).sort((a, b) => parseInt(b.issue_number) - parseInt(a.issue_number));
        this.save(sorted);
        return sorted;
    },
    addPrediction(issueNumber, prediction, confidence, strategy) {
        const history = this.load();
        const item = history.find(h => h.issue_number === issueNumber);
        if (item) {
            item.predicted_type = prediction;
            item.prediction_confidence = confidence;
            item.strategy_used = strategy;
            item.prediction_time = new Date().toISOString();
        } else {
            history.unshift({
                issue_number: issueNumber,
                predicted_type: prediction,
                prediction_confidence: confidence,
                strategy_used: strategy,
                prediction_time: new Date().toISOString(),
                actual_result: null,
                actual_number: null
            });
        }
        this.save(history);
    },
    updateOutcome(issueNumber, actualResult, actualNumber) {
        const history = this.load();
        const item = history.find(h => h.issue_number === issueNumber);
        if (item) {
            item.actual_result = actualResult;
            item.actual_number = actualNumber;
            item.outcome_time = new Date().toISOString();
        }
        this.save(history);
    },
    getForDisplay(limit = CONFIG.HISTORY_DISPLAY_LIMIT) {
        return this.load().slice(0, limit);
    },
    getForAnalysis() {
        return this.load().filter(h => h.actual_result || h.result_type);
    }
};

const engine = new NeuralMatrixEngine();

/**
 * Periodically fetch outcome archives from feeds
 */
async function fetchData() {
    const urls = CONFIG.USE_PROXY ?
        [CONFIG.PROXY_LATEST, CONFIG.PROXY_HISTORY] :
        [CONFIG.API_LATEST, CONFIG.API_HISTORY];
        
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const [latestRes, historyRes] = await Promise.all([
            fetch(urls[0], { signal: controller.signal, headers: { 'Accept': 'application/json' } }),
            fetch(urls[1], { signal: controller.signal, headers: { 'Accept': 'application/json' } })
        ]);
        
        clearTimeout(timeoutId);
        
        if (!latestRes.ok || !historyRes.ok) throw new Error(`HTTP Status Error`);
        
        const latest = await latestRes.json();
        const apiHistory = await historyRes.json();
        
        if (!Array.isArray(latest) || latest.length === 0) throw new Error('Invalid data payload');
        
        updateConnectionStatus(true);
        const currentIssue = latest[0]?.issue_number;
        
        if (currentIssue !== state.lastIssue) {
            state.lastIssue = currentIssue;
            state.lastResults = latest;
            state.fullHistory = HistoryManager.merge(apiHistory || [], latest);
            processData(latest);
            showToast('Signal synchronization completed', 'success');
        }
        state.retryCount = 0;
    } catch (error) {
        handleFetchError(error);
    }
}

/**
 * Handle API failure backoffs
 */
function handleFetchError(error) {
    state.retryCount++;
    if (error.message.includes('CORS') && state.retryCount === 1 && !CONFIG.USE_PROXY) {
        CONFIG.USE_PROXY = true;
        setTimeout(fetchData, 1000);
        return;
    }
    updateConnectionStatus(false);
    if (state.retryCount >= CONFIG.MAX_RETRIES) {
        showToast('Telemetry streams unstable', 'error');
        state.retryCount = 0;
    } else {
        setTimeout(fetchData, CONFIG.RETRY_DELAY);
    }
}

/**
 * Process new target sequence results
 */
function processData(latest) {
    const lastResult = latest[0];
    state.currentPeriodNumber = PeriodCalculator.getCurrentPeriodNumber();
    state.currentTargetPeriod = state.currentPeriodNumber;

    const analysisHistory = HistoryManager.getForAnalysis();
    
    // Generate prediction and trend matrices
    const prediction = engine.generatePrediction(lastResult, analysisHistory, CONFIG.MIN_CONFIDENCE);
    state.lastPrediction = prediction;
    
    const numbers = engine.calculateNumberDistribution(analysisHistory, prediction.prediction);
    const mcResult = engine.monteCarloSimulation(analysisHistory, 10000);
    const chiResult = MathUtils.chiSquareTest(analysisHistory);
    const autoCorr = MathUtils.autocorrelation(analysisHistory.map(h => h.actual_result === 'big' ? 1 : 0), 1);
    
    state.trendReport = TrendEngine.analyze(analysisHistory);

    state.highProbNumber = numbers.primary?.number ?? null;
    state.secProbNumber = numbers.secondary?.number ?? null;

    // Cache prediction state
    state.pendingPredictions.set(state.currentTargetPeriod, {
        prediction: prediction.prediction,
        timestamp: new Date().toISOString(),
        period_number: state.currentTargetPeriod,
        confidence: prediction.confidence,
        strategy: prediction.strategy,
        breakdown: prediction.breakdown,
        regime: prediction.regime,
        entropy: prediction.entropy,
        mcResult, chiResult, autoCorr
    });

    HistoryManager.addPrediction(state.currentTargetPeriod, prediction.prediction, prediction.confidence, prediction.strategy);
    resolvePendingPredictions();

    // Trigger HUD and visualizations updates
    UIControls.updateHUD(prediction, state.currentTargetPeriod, numbers);
    updateNumberIntelligence(numbers);
    updateMonteCarlo(mcResult);
    updateUncertaintyMetrics(prediction, chiResult, autoCorr);
    updateLatestResults(latest);
    updateHistoryDisplay();
    updateStats();

    if (state.activePanel === 'models') UIControls.refreshObservatoryCharts();
    if (state.activePanel === 'trends') UIControls.refreshTrendPanel();
    if (state.activePanel === 'risk') UIControls.refreshRiskPanel();

    if (state.isFirstPrediction) state.isFirstPrediction = false;
}

/**
 * Match pending signals with cleared inputs
 */
function resolvePendingPredictions() {
    const history = HistoryManager.load();
    state.pendingPredictions.forEach((pred, issueNum) => {
        const result = history.find(h => h.issue_number === issueNum && (h.actual_result || h.result_type));
        if (result) {
            const actual = result.actual_result || result.result_type;
            const isCorrect = pred.prediction === actual;
            HistoryManager.updateOutcome(issueNum, actual, result.actual_number);
            engine.learnFromResult(pred.prediction, actual, pred.strategy, pred.breakdown, issueNum);
            state.stats.total++;
            if (isCorrect) {
                state.stats.wins++;
                state.stats.streak++;
                if (state.stats.streak > state.stats.bestStreak) state.stats.bestStreak = state.stats.streak;
            } else {
                state.stats.losses++;
                state.stats.streak = 0;
            }
            state.pendingPredictions.delete(issueNum);
        }
    });
    recalculateStats();
}

function recalculateStats() {
    const history = HistoryManager.getForAnalysis().slice(0, 50);
    const valid = history.filter(h => h.predicted_type && (h.actual_result || h.result_type));
    const wins = valid.filter(h => h.predicted_type === (h.actual_result || h.result_type)).length;
    state.stats.total = valid.length;
    state.stats.wins = wins;
    state.stats.losses = valid.length - wins;
}

// --- VISUALIZATION HELPERS BINDINGS (compatibility mapping) ---

function updateNumberIntelligence(numbers) {
    const highEl = document.getElementById('highProbNumber');
    const secEl = document.getElementById('secProbNumber');
    const highFreq = document.getElementById('highProbFreq');
    const secFreq = document.getElementById('secProbFreq');
    const highBar = document.getElementById('highProbBar');
    const secBar = document.getElementById('secProbBar');

    if (highEl) highEl.textContent = numbers.primary?.number ?? '--';
    if (secEl) secEl.textContent = numbers.secondary?.number ?? '--';

    const total = Object.values(numbers.distribution || {}).reduce((a, b) => a + b, 0) || 1;
    const hFreq = numbers.primary ? Math.round((numbers.primary.freq / total) * 100) : 0;
    const sFreq = numbers.secondary ? Math.round((numbers.secondary.freq / total) * 100) : 0;

    if (highFreq) highFreq.textContent = hFreq + '% probability';
    if (secFreq) secFreq.textContent = sFreq + '% probability';
    if (highBar) highBar.style.width = Math.min(100, hFreq * 2) + '%';
    if (secBar) secBar.style.width = Math.min(100, sFreq * 2) + '%';

    const chart = document.getElementById('numberDistChart');
    if (chart) {
        chart.innerHTML = '';
        const maxCount = Math.max(...Object.values(numbers.distribution || {0:1})) || 1;
        for (let i = 0; i <= 9; i++) {
            const count = numbers.distribution?.[i] || 0;
            const height = Math.max(4, (count / maxCount) * 100);
            const bar = document.createElement('div');
            bar.className = 'dist-bar' + (i === numbers.primary?.number || i === numbers.secondary?.number ? ' highlight' : '');
            bar.style.height = height + '%';
            bar.title = `${i}: ${count} times`;
            chart.appendChild(bar);
        }
    }

    const heatmap = document.getElementById('numberHeatmap');
    if (heatmap) {
        heatmap.innerHTML = '';
        const maxCount = Math.max(...Object.values(numbers.distribution || {0:1})) || 1;
        for (let i = 0; i <= 9; i++) {
            const count = numbers.distribution?.[i] || 0;
            const intensity = count / maxCount;
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.textContent = i;
            
            const r = Math.round(10 + (0 - 10) * intensity);
            const g = Math.round(191 + (245 - 191) * intensity);
            const b = Math.round(255 + (255 - 255) * intensity);
            
            cell.style.background = `rgba(${r}, ${g}, ${b}, ${0.05 + intensity * 0.45})`;
            cell.style.color = intensity > 0.5 ? '#ffffff' : 'var(--text-secondary)';
            cell.style.borderColor = `rgba(0, 191, 255, ${0.1 + intensity * 0.3})`;
            cell.style.boxShadow = intensity > 0.6 ? '0 0 6px rgba(0, 191, 255, 0.2)' : 'none';
            cell.title = `${i}: ${count} hits`;
            heatmap.appendChild(cell);
        }
    }
}

function updateMonteCarlo(mcResult) {
    const chart = document.getElementById('monteCarloChart');
    if (!chart) return;
    chart.innerHTML = '';
    const pBig = mcResult.bigProb || 0.5;
    const bins = 24;
    const sigma = 0.08;
    
    for (let i = 0; i < bins; i++) {
        const x = i / (bins - 1);
        const y = Math.exp(-Math.pow(x - pBig, 2) / (2 * Math.pow(sigma, 2)));
        const height = Math.max(4, y * 100);
        
        const bar = document.createElement('div');
        const isBig = x >= 0.5;
        bar.className = 'mc-bar ' + (isBig ? 'big' : 'small');
        bar.style.height = height + '%';
        bar.style.flex = '1';
        bar.style.margin = '0 1px';
        bar.style.transition = 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        chart.appendChild(bar);
    }
    
    document.getElementById('mcBigWins').textContent = mcResult.bigWins;
    document.getElementById('mcSmallWins').textContent = mcResult.smallWins;
}

function updateUncertaintyMetrics(pred, chiResult, autoCorr) {
    const entropyPct = Math.min(100, pred.entropy * 100);
    const entropyBar = document.getElementById('entropyBar');
    const entropyVal = document.getElementById('entropyVal');
    if (entropyBar) entropyBar.style.width = entropyPct + '%';
    if (entropyVal) entropyVal.textContent = pred.entropy.toFixed(2);

    const chiPct = Math.min(100, (1 - chiResult.pValue) * 100);
    const chiBar = document.getElementById('chiBar');
    const chiVal = document.getElementById('chiVal');
    if (chiBar) chiBar.style.width = chiPct + '%';
    if (chiVal) chiVal.textContent = chiResult.pValue < 0.05 ? 'Non-random' : 'Random';

    const autoPct = Math.min(100, Math.abs(autoCorr) * 200);
    const autoBar = document.getElementById('autoBar');
    const autoVal = document.getElementById('autoVal');
    if (autoBar) autoBar.style.width = autoPct + '%';
    if (autoVal) autoVal.textContent = autoCorr.toFixed(2);

    const patternPct = Math.min(100, (1 - pred.entropy) * 100);
    const patternBar = document.getElementById('patternBar');
    const patternVal = document.getElementById('patternVal');
    if (patternBar) patternBar.style.width = patternPct + '%';
    if (patternVal) patternVal.textContent = patternPct.toFixed(0) + '%';
}

function updateLatestResults(data) {
    const container = document.getElementById('streamContent');
    if (!container) return;
    container.innerHTML = data.slice(0, 6).map((r, index) => {
        const type = r.result_type || 'small';
        const isLatest = index === 0;
        return `<div class="stream-item ${type} ${isLatest ? 'latest' : ''}">${r.actual_number ?? '--'}</div>`;
    }).join('');
}

function updateHistoryDisplay() {
    const tbody = document.getElementById('historyBody');
    const meta = document.getElementById('historyMeta');
    if (!tbody || !meta) return;
    const displayHistory = HistoryManager.getForDisplay(CONFIG.HISTORY_DISPLAY_LIMIT);
    meta.textContent = `${displayHistory.length} records decrypted // DB Size: ${HistoryManager.load().length}`;
    if (displayHistory.length === 0) {
        tbody.innerHTML = `<tr class="loading-row"><td colspan="6"><div class="table-loader"><div class="loader-ring"></div><span>Decrypting logs...</span></div></td></tr>`;
        return;
    }
    tbody.innerHTML = displayHistory.map((r, index) => {
        const actual = r.actual_result || r.result_type;
        let outcome;
        if (r.predicted_type && actual) {
            outcome = r.predicted_type === actual
                ? '<span class="outcome-badge win">WIN</span>'
                : '<span class="outcome-badge loss">LOSS</span>';
        } else if (r.predicted_type) {
            outcome = '<span class="outcome-badge pending">PENDING</span>';
        } else {
            outcome = '<span class="outcome-badge pending">---</span>';
        }
        const predClass = r.predicted_type || 'pending';
        const predText = r.predicted_type ? r.predicted_type.toUpperCase() : '---';
        const actualClass = actual || 'small';
        const actualText = actual ? actual.toUpperCase() : '---';
        return `
            <tr class="${index === 0 ? 'new-result' : ''}">
                <td class="cell-issue">${r.issue_number || '--'}</td>
                <td class="cell-prediction ${predClass}">${predText}</td>
                <td class="cell-actual ${actualClass}">${actualText}</td>
                <td class="cell-number">${r.actual_number ?? '--'}</td>
                <td class="cell-conf">${r.prediction_confidence ?? '--'}%</td>
                <td class="cell-outcome">${outcome}</td>
            </tr>`;
    }).join('');
}

function updateStats() {
    const accuracy = state.stats.total > 0 ? Math.round((state.stats.wins / state.stats.total) * 100) : 0;
    const els = ['miniAccuracy', 'miniSignals', 'miniWins', 'miniLosses'];
    const vals = [accuracy + '%', state.stats.total, state.stats.wins, state.stats.losses];
    els.forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = vals[i]; });

    const total = state.stats.total || 1;
    const winBar = document.getElementById('winBar');
    const lossBar = document.getElementById('lossBar');
    if (winBar) winBar.style.width = (state.stats.wins / total * 100) + '%';
    if (lossBar) lossBar.style.width = (state.stats.losses / total * 100) + '%';

    // Live Accuracy Ring
    const chart = document.getElementById('accuracyChart');
    if (chart) {
        chart.innerHTML = '';
        chart.style.display = 'flex';
        chart.style.alignItems = 'center';
        chart.style.justifyContent = 'center';
        chart.style.height = '100%';
        chart.style.width = '64px';
        chart.style.margin = '0 auto';
        
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (accuracy / 100) * circumference;
        
        chart.innerHTML = `
            <svg width="60" height="60" viewBox="0 0 60 60" style="transform: rotate(-90deg); filter: drop-shadow(0 0 4px var(--accent-blue));">
                <circle cx="30" cy="30" r="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="4"></circle>
                <circle cx="30" cy="30" r="${radius}" fill="none" stroke="var(--accent-blue)" stroke-width="4"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}"
                    stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease;"></circle>
                <text x="30" y="-27" transform="rotate(90)" text-anchor="middle" dominant-baseline="middle" 
                    style="fill: white; font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold;">
                    ${accuracy}%
                </text>
            </svg>
        `;
    }

    const trend = document.getElementById('signalTrend');
    if (trend) {
        const recent = HistoryManager.getForAnalysis().slice(0, 10);
        const recentWins = recent.filter(h => h.predicted_type === (h.actual_result || h.result_type)).length;
        const diff = recentWins - 5;
        trend.textContent = (diff >= 0 ? '+' : '') + diff;
        trend.className = 'stat-trend ' + (diff >= 0 ? 'up' : 'down');
    }
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('connDot');
    const text = document.getElementById('connText');
    if (!dot || !text) return;
    state.isConnected = connected;
    dot.className = 'status-dot ' + (connected ? 'connected' : 'error');
    text.textContent = connected ? 'ONLINE' : 'OFFLINE';
    text.style.color = connected ? 'var(--accent-green)' : 'var(--accent-red)';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('cipherToast');
    if (!toast) return;
    const textEl = toast.querySelector('.toast-text');
    if (textEl) textEl.textContent = message;
    toast.style.borderLeftColor = type === 'error' ? 'var(--accent-red)' : 'var(--accent-blue)';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- BOOTSTRAP INITIALIZATION ---

function init() {
    console.log('[HIROTO TERMINAL v4.0] Initializing core modules...');
    new NeuralCanvas();
    
    // Auth Clearence Guard check
    if (!SecurityGuard.enforceClearance()) return;
    
    state.session = SecurityGuard.verifySession();
    const badge = document.getElementById('sessionBadge');
    if (badge && state.session) {
        const chipText = badge.querySelector('.badge-text');
        if (chipText) chipText.textContent = `${state.session.daysRemaining} DAYS CLEARANCE`;
    }

    UIControls.bind(state, engine);
    state.fullHistory = HistoryManager.load();
    
    // Restore pending states
    state.fullHistory.forEach(h => {
        if (h.predicted_type && !h.actual_result && !h.result_type) {
            state.pendingPredictions.set(h.issue_number, {
                prediction: h.predicted_type,
                timestamp: h.prediction_time,
                period_number: h.issue_number,
                confidence: h.prediction_confidence,
                strategy: h.strategy_used
            });
        }
    });

    fetchData();
    setInterval(fetchData, CONFIG.REFRESH_INTERVAL);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.session) fetchData();
});
