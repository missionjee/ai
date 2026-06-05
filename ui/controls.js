/**
 * Hiroto AI Terminal — UI Controllers & Layout Binder v5.0
 */

import { ChartManager } from '../visualization/charts.js';

export const UIControls = {
    stateRef: null,
    engineRef: null,

    /**
     * Bind dashboard controls and hook elements
     */
    bind(state, engine) {
        this.stateRef = state;
        this.engineRef = engine;

        this.initNavigation();
        this.initSidebarToggle();
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
    },

    /**
     * Setup sidebar tab routing
     */
    initNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = item.dataset.panel;
                if (!panel) return;

                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                const targetPanel = document.getElementById('panel-' + panel);
                if (targetPanel) targetPanel.classList.add('active');

                const titles = {
                    predict: ['AI Command Center', 'Real-time predictive signal intelligence'],
                    models: ['Model Observatory', 'Ensemble weightings and accuracy distribution'],
                    trends: ['Trend Laboratory', 'Multi-period macro momentum analysis'],
                    risk: ['Risk Analytics Center', 'Verification pipelines and entropy variance'],
                    history: ['Historical Logs', 'Decryption logs and confidence calibration history']
                };

                const titleEl = document.getElementById('pageTitle');
                const subEl = document.getElementById('pageSubtitle');
                if (titleEl && titles[panel]) titleEl.textContent = titles[panel][0];
                if (subEl && titles[panel]) subEl.textContent = titles[panel][1];

                this.stateRef.activePanel = panel;
                
                // Route specific refresh calls
                if (panel === 'models') this.refreshObservatoryCharts();
                if (panel === 'trends') this.refreshTrendPanel();
                if (panel === 'risk') this.refreshRiskPanel();
                if (panel === 'history') this.refreshConfidenceTrendChart();
            });
        });
    },

    /**
     * Bind sidebar slide in/out toggle handler
     */
    initSidebarToggle() {
        const toggleBtn = document.getElementById('sidebarToggle');
        const appContainer = document.getElementById('dashboardContent');
        if (!toggleBtn || !appContainer) return;

        // Load state from localStorage so it persists across refreshes
        const isCollapsed = localStorage.getItem('hiroto_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            appContainer.classList.add('sidebar-collapsed');
            toggleBtn.textContent = '▶';
        }

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const collapsed = appContainer.classList.toggle('sidebar-collapsed');
            localStorage.setItem('hiroto_sidebar_collapsed', collapsed);
            toggleBtn.textContent = collapsed ? '▶' : '◀';
        });

        // Auto-close sidebar on mobile when clicking outside
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('click', (ev) => {
                if (window.innerWidth <= 768 && !appContainer.classList.contains('sidebar-collapsed')) {
                    // Don't close if user clicked the toggle button itself
                    if (ev.target === toggleBtn || toggleBtn.contains(ev.target)) return;
                    appContainer.classList.add('sidebar-collapsed');
                    localStorage.setItem('hiroto_sidebar_collapsed', 'true');
                    toggleBtn.textContent = '▶';
                }
            });
        }
    },

    /**
     * Tick clock interface
     */
    updateClock() {
        const timer = document.getElementById('cipherTimer');
        const dateEl = document.getElementById('cipherDate');
        const now = new Date();
        if (timer) timer.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    /**
     * Render active signal outcomes in AI Command Center
     */
    updateHUD(pred, targetPeriod, numbers) {
        const valueEl = document.getElementById('predictionValue');
        if (!valueEl) return;

        const targetEl = document.getElementById('targetPeriod');
        if (targetEl) targetEl.textContent = targetPeriod;

        const confEl = document.getElementById('confidenceDisplay');
        const stratEl = document.getElementById('strategyName');
        const consensusEl = document.getElementById('consensusVal');

        if (!pred.isValid) {
            valueEl.textContent = pred.prediction.toUpperCase();
            valueEl.className = "pred-value hold";
            valueEl.style.color = "var(--accent-gold)";
            valueEl.style.textShadow = "0 0 10px var(--accent-gold)";

            if (confEl) {
                confEl.innerHTML = `${pred.confidence}% <span style="font-size:10px;color:var(--accent-gold);font-weight:bold;display:block;margin-top:4px;">GATED / HOLD</span>`;
            }
            if (stratEl) stratEl.textContent = pred.gateReason ? pred.gateReason.toUpperCase() : "GATING CRITERIA BLOCKED";
            if (consensusEl) consensusEl.textContent = (pred.consensus * 100).toFixed(0) + '% (SPLIT)';
        } else {
            valueEl.textContent = pred.prediction.toUpperCase();
            valueEl.className = 'pred-value ' + pred.prediction;
            valueEl.style.color = "";
            valueEl.style.textShadow = "";

            if (confEl) confEl.textContent = pred.confidence + '%';
            if (stratEl) stratEl.textContent = pred.strategy.toUpperCase().replace(/_/g, ' ');
            if (consensusEl) consensusEl.textContent = (pred.consensus * 100).toFixed(0) + '%';
        }

        // Update active models count
        const activeModelsEl = document.getElementById('activeModels');
        if (activeModelsEl) activeModelsEl.textContent = '17 Cores';

        // Pull dynamic "Dual-Digit Intelligence" targets
        if (numbers) {
            const total = Object.values(numbers.distribution || {}).reduce((a, b) => a + b, 0) || 1;
            const hFreq = numbers.primary ? Math.round((numbers.primary.freq / total) * 100) : 0;
            const sFreq = numbers.secondary ? Math.round((numbers.secondary.freq / total) * 100) : 0;

            const hudHighDigit = document.getElementById('hudHighDigit');
            const hudHighDigitProb = document.getElementById('hudHighDigitProb');
            const hudSecDigit = document.getElementById('hudSecDigit');
            const hudSecDigitProb = document.getElementById('hudSecDigitProb');

            if (hudHighDigit) hudHighDigit.textContent = numbers.primary?.number ?? '--';
            if (hudHighDigitProb) hudHighDigitProb.textContent = `(${numbers.primary?.freq ?? 0}%)`;
            if (hudSecDigit) hudSecDigit.textContent = numbers.secondary?.number ?? '--';
            if (hudSecDigitProb) hudSecDigitProb.textContent = `(${numbers.secondary?.freq ?? 0}%)`;
        }

        // Probability distribution slider
        const probSmall = parseFloat(pred.smallProb);
        const probBig = parseFloat(pred.bigProb);
        const pSmallEl = document.getElementById('probSmall');
        const pBigEl = document.getElementById('probBig');
        if (pSmallEl) pSmallEl.textContent = probSmall + '%';
        if (pBigEl) pBigEl.textContent = probBig + '%';
        
        const fSmall = document.getElementById('probFillSmall');
        const fBig = document.getElementById('probFillBig');
        const marker = document.getElementById('probMarker');
        if (fSmall) fSmall.style.width = probSmall + '%';
        if (fBig) fBig.style.width = probBig + '%';
        if (marker) marker.style.left = probBig + '%';

        // Signal Strength — improved formula using consensus of 17 models
        const signalStrength = Math.round(pred.confidence * 0.60 + pred.consensus * 100 * 0.40);
        const signalStrengthEl = document.getElementById('signalStrengthVal');
        if (signalStrengthEl) {
            const color = signalStrength >= 70 ? 'var(--accent-green)' : signalStrength >= 55 ? 'var(--accent-cyan)' : 'var(--accent-gold)';
            signalStrengthEl.innerHTML = `<span style="color: ${color}; font-weight: bold;">${signalStrength}%</span>`;
        }

        const recentAccuracy = this.engineRef.getRecentAccuracy();
        const reliability = Math.round(recentAccuracy * 65 + (1.0 - pred.entropy) * 35);
        const reliabilityEl = document.getElementById('reliabilityVal');
        if (reliabilityEl) {
            const color = reliability >= 65 ? 'var(--accent-green)' : 'var(--accent-gold)';
            reliabilityEl.innerHTML = `<span style="color: ${color}; font-weight: bold;">${reliability}%</span>`;
        }

        const riskLevelEl = document.getElementById('riskLevelVal');
        if (riskLevelEl) {
            let color = 'var(--accent-red)';
            if (pred.riskLevel === 'LOW') color = 'var(--accent-green)';
            else if (pred.riskLevel === 'MEDIUM') color = 'var(--accent-gold)';
            riskLevelEl.innerHTML = `<span style="color: ${color}; font-weight: bold; text-shadow: 0 0 6px ${color};">${pred.riskLevel}</span>`;
        }
    },

    /**
     * Refresh Observatory Chart.js radar maps + weight matrix bars
     */
    refreshObservatoryCharts() {
        const weights = this.engineRef.getAdaptiveWeights();
        const stats = this.engineRef.getStrategyStats();
        
        const labels = Object.keys(weights);
        const dataWeights = Object.values(weights);
        const dataAcc = stats.map(s => s.recentAccuracy / 100);

        ChartManager.renderRadar('radarChartCanvas', labels, dataWeights);
        ChartManager.renderContribution('contributionChartCanvas', labels, dataAcc);

        // Populate the Ensemble Weights Matrix (the empty div)
        this._renderWeightsMatrix(weights, stats);
        
        // Populate Feature Contribution list
        this._renderFeatureList(stats);
        
        // Populate diagnostics
        this._renderDiagnostics(stats);
    },

    /**
     * Render the Ensemble Weights Matrix as styled bar rows
     */
    _renderWeightsMatrix(weights, stats) {
        const container = document.getElementById('weightsChart');
        if (!container) return;

        const maxWeight = Math.max(...Object.values(weights)) || 1;
        const rows = Object.keys(weights).map(name => {
            const w = weights[name];
            const stat = stats.find(s => s.name === name) || { recentAccuracy: 50, wins: 0, losses: 0 };
            const pct = (w / maxWeight * 100).toFixed(0);
            const acc = stat.recentAccuracy;
            const accColor = acc >= 60 ? 'var(--accent-green)' : acc >= 50 ? 'var(--accent-cyan)' : 'var(--accent-red)';
            const displayName = name.replace(/_/g, ' ').toUpperCase();
            
            // Category badges for new models
            let badge = '';
            if (['neural_perceptron', 'kalman_filter', 'lstm_sequence', 'meta_learner'].includes(name)) {
                badge = '<span style="background: rgba(0,255,136,0.15); color: var(--accent-green); font-size: 8px; padding: 1px 5px; border-radius: 3px; margin-left: 6px; border: 1px solid rgba(0,255,136,0.3);">NEW</span>';
            }

            return `
                <div style="display:flex; align-items:center; gap:10px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <span style="width:130px; font-family:'Share Tech Mono',monospace; font-size:9px; color:var(--text-secondary); flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${displayName}">${displayName}${badge}</span>
                    <div style="flex:1; height:6px; background:rgba(255,255,255,0.04); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, var(--accent-blue), var(--accent-cyan)); border-radius:3px; transition:width 0.6s ease;"></div>
                    </div>
                    <span style="width:36px; text-align:right; font-family:'Share Tech Mono',monospace; font-size:9px; color:var(--accent-cyan);">${parseFloat(w).toFixed(2)}</span>
                    <span style="width:36px; text-align:right; font-family:'Share Tech Mono',monospace; font-size:9px; color:${accColor};">${acc}%</span>
                    <span style="width:28px; text-align:right; font-family:'Share Tech Mono',monospace; font-size:9px; color:var(--text-secondary);">${stat.wins}W</span>
                </div>
            `;
        });

        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; padding: 4px 0 8px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px;">
                <span style="width:130px; font-family:'Share Tech Mono',monospace; font-size:8px; color:var(--text-secondary); opacity:0.6;">ENGINE</span>
                <span style="flex:1; font-family:'Share Tech Mono',monospace; font-size:8px; color:var(--text-secondary); opacity:0.6;">ADAPTIVE WEIGHT</span>
                <span style="width:36px; text-align:right; font-family:'Share Tech Mono',monospace; font-size:8px; color:var(--text-secondary); opacity:0.6;">W</span>
                <span style="width:36px; text-align:right; font-family:'Share Tech Mono',monospace; font-size:8px; color:var(--text-secondary); opacity:0.6;">ACC</span>
                <span style="width:28px; text-align:right; font-family:'Share Tech Mono',monospace; font-size:8px; color:var(--text-secondary); opacity:0.6;">WINS</span>
            </div>
            ${rows.join('')}
        `;
    },

    /**
     * Render Feature Contribution list
     */
    _renderFeatureList(stats) {
        const container = document.getElementById('featureList');
        if (!container) return;

        const sorted = [...stats].sort((a, b) => b.recentAccuracy - a.recentAccuracy);
        container.innerHTML = sorted.map(s => {
            const acc = s.recentAccuracy;
            const color = acc >= 60 ? 'var(--accent-green)' : acc >= 50 ? 'var(--accent-cyan)' : 'var(--accent-red)';
            const name = s.name.replace(/_/g, ' ').toUpperCase();
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <span style="font-family:'Share Tech Mono',monospace; font-size:9px; color:var(--text-secondary);">${name}</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div style="width:60px; height:4px; background:rgba(255,255,255,0.04); border-radius:2px; overflow:hidden;">
                            <div style="height:100%; width:${acc}%; background:${color}; border-radius:2px;"></div>
                        </div>
                        <span style="font-family:'Share Tech Mono',monospace; font-size:9px; color:${color}; width:28px; text-align:right;">${acc}%</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render Observatory diagnostics
     */
    _renderDiagnostics(stats) {
        const container = document.getElementById('diagnostics');
        if (!container) return;

        const totalWins = stats.reduce((a, s) => a + s.wins, 0);
        const totalLosses = stats.reduce((a, s) => a + s.losses, 0);
        const totalGames = totalWins + totalLosses;
        const overallAcc = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 50;
        const bestModel = stats.sort((a, b) => b.recentAccuracy - a.recentAccuracy)[0];
        const worstModel = stats.sort((a, b) => a.recentAccuracy - b.recentAccuracy)[0];

        container.innerHTML = `
            <div style="font-family:'Share Tech Mono',monospace; font-size:10px; line-height:1.8; color:var(--text-secondary);">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span>Active Engines</span>
                    <span style="color:var(--accent-cyan); font-weight:bold;">${stats.length}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span>Total Predictions</span>
                    <span style="color:var(--accent-cyan);">${totalGames}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span>Overall Accuracy</span>
                    <span style="color:${overallAcc >= 60 ? 'var(--accent-green)' : 'var(--accent-gold)'};">${overallAcc}%</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span>Best Engine</span>
                    <span style="color:var(--accent-green); font-size:8px;">${(bestModel?.name || '?').replace(/_/g,' ').toUpperCase()}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>Weakest Engine</span>
                    <span style="color:var(--accent-red); font-size:8px;">${(worstModel?.name || '?').replace(/_/g,' ').toUpperCase()}</span>
                </div>
            </div>
        `;
    },

    /**
     * Render the multi-period Trend Lab reports
     */
    refreshTrendPanel() {
        const reports = this.stateRef.trendReport || {};
        const tbody = document.getElementById('trendEngineBody');
        if (!tbody) return;

        const keys = Object.keys(reports);
        if (keys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);">Calculating trend analytics...</td></tr>`;
            return;
        }

        tbody.innerHTML = keys.map(k => {
            const r = reports[k];
            return `
                <tr>
                    <td style="color: var(--accent-blue); font-weight: bold; font-family: var(--font-mono);">Last ${r.window}</td>
                    <td style="font-family: var(--font-mono);">${(r.bigRatio * 100).toFixed(0)}%</td>
                    <td style="font-family: var(--font-mono);">${(r.trendStrength * 100).toFixed(0)}%</td>
                    <td style="font-family: var(--font-mono);">${(r.trendStability * 100).toFixed(0)}%</td>
                    <td style="font-family: var(--font-mono);">${(r.continuationProb * 100).toFixed(0)}%</td>
                    <td style="font-family: var(--font-mono);">${(r.reversalProb * 100).toFixed(0)}%</td>
                    <td style="font-family: var(--font-mono);">${(r.patternPersistence * 100).toFixed(0)}%</td>
                    <td style="font-family: var(--font-header); font-size: 10px; font-weight: bold;">
                        <span style="color: ${r.regime === 'trending' ? 'var(--accent-red)' : r.regime === 'alternating' ? 'var(--accent-cyan)' : 'var(--accent-blue)'}">
                            ${r.regime.toUpperCase()}
                        </span>
                    </td>
                </tr>`;
        }).join('');
    },

    /**
     * Render Risk Validation details
     */
    refreshRiskPanel() {
        const pred = this.stateRef.lastPrediction;
        const validationList = document.getElementById('pipelineValidationList');
        const riskMetricsList = document.getElementById('riskAnalysisMetrics');
        if (!pred || !validationList || !riskMetricsList) return;

        const isGated = !pred.isValid;
        validationList.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:4px;">
                <span>1. Consensus Voting Gate (17 engines)</span>
                <span style="color: ${pred.consensus >= 0.55 ? 'var(--accent-green)' : 'var(--accent-red)'}">${pred.consensus >= 0.55 ? 'PASSED' : 'FAILED'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:4px;">
                <span>2. Gating Confidence Level</span>
                <span style="color: ${!isGated ? 'var(--accent-green)' : 'var(--accent-red)'}">${!isGated ? 'PASSED' : 'FAILED'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:4px;">
                <span>3. Local Variance Threshold</span>
                <span style="color: ${pred.volatility <= 0.58 ? 'var(--accent-green)' : 'var(--accent-red)'}">${pred.volatility <= 0.58 ? 'PASSED' : 'FAILED'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top: 14px; font-weight: bold; font-size: 13px;">
                <span>CLEARANCE STATUS</span>
                <span style="color: ${pred.isValid ? 'var(--accent-green)' : 'var(--accent-gold)'}">${pred.isValid ? 'CLEARED' : 'BLOCKED'}</span>
            </div>
        `;

        let color = 'var(--accent-red)';
        if (pred.riskLevel === 'LOW') color = 'var(--accent-green)';
        else if (pred.riskLevel === 'MEDIUM') color = 'var(--accent-gold)';

        riskMetricsList.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span>Signal Risk Level:</span>
                <span style="color: ${color}; font-weight: bold;">${pred.riskLevel}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span>Entropy Instability:</span>
                <span>${(pred.entropy * 100).toFixed(0)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span>Local GARCH Volatility:</span>
                <span>${(pred.volatility * 100).toFixed(0)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span>Consensus Score:</span>
                <span style="color: var(--accent-cyan);">${(pred.consensus * 100).toFixed(0)}%</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 10px; margin-top: 12px; line-height: 1.4;">
                * 17-engine system requires consensus &gt; 55% and volatility &lt; 58% for clearance.
            </p>
        `;
    },

    /**
     * Render ensemble confidence trend chart in History panel
     */
    refreshConfidenceTrendChart() {
        const container = document.getElementById('confidenceTrendChart');
        if (!container) return;

        const history = this.engineRef.getConfidenceHistory();
        if (!history || history.length === 0) {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:8px; font-family:'Share Tech Mono',monospace; font-size:11px; color:var(--text-secondary);">
                    <div style="width:18px; height:18px; border:2px solid rgba(0,191,255,0.2); border-left-color:var(--accent-blue); border-radius:50%; animation: rotateCW 1s linear infinite;"></div>
                    <span>Accumulating confidence data...</span>
                </div>`;
            return;
        }

        const maxConf = Math.max(...history.map(h => h.conf));
        const minConf = Math.min(...history.map(h => h.conf));
        const range = (maxConf - minConf) || 10;

        // Mini sparkline bars
        const bars = history.slice(-40).map((h, i) => {
            const height = Math.max(4, ((h.conf - minConf) / range) * 85 + 10);
            const color = h.pred === 'big' ? 'var(--accent-cyan)' : 'var(--accent-red)';
            return `<div style="flex:1; min-width:4px; max-width:12px; height:${height}%; background:${color}; border-radius:2px 2px 0 0; opacity:${0.4 + (i / 40) * 0.6}; margin:0 1px;" title="Conf: ${h.conf}% | ${h.pred.toUpperCase()}"></div>`;
        }).join('');

        const avgConf = Math.round(history.reduce((a, h) => a + h.conf, 0) / history.length);
        const avgConsensus = Math.round(history.reduce((a, h) => a + h.consensus, 0) / history.length);
        const lastConf = history[history.length - 1];

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-end; font-family:'Share Tech Mono',monospace; font-size:9px; color:var(--text-secondary); margin-bottom:8px;">
                <span>CONFIDENCE OVER TIME (${history.length} signals)</span>
                <div style="display:flex; gap:16px;">
                    <span>AVG: <b style="color:var(--accent-cyan);">${avgConf}%</b></span>
                    <span>CONSENSUS: <b style="color:var(--accent-green);">${avgConsensus}%</b></span>
                    <span>LAST: <b style="color:${lastConf.pred === 'big' ? 'var(--accent-cyan)' : 'var(--accent-red)'};">${lastConf.conf}%</b></span>
                </div>
            </div>
            <div style="display:flex; align-items:flex-end; height:80px; padding: 0 4px; gap:0; border-bottom: 1px solid rgba(255,255,255,0.05); border-left: 1px solid rgba(255,255,255,0.05);">
                ${bars}
            </div>
            <div style="display:flex; justify-content:space-between; font-family:'Share Tech Mono',monospace; font-size:8px; color:var(--text-secondary); margin-top:4px; padding: 0 4px;">
                <span>${minConf}%</span>
                <span style="color:var(--accent-cyan);">● BIG</span>
                <span style="color:var(--accent-red);">● SMALL</span>
                <span>${maxConf}%</span>
            </div>
        `;
    }
};
