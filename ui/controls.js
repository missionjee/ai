/**
 * Hiroto AI Terminal — UI Controllers & Layout Binder
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

        // Pull dynamic "Dual-Digit Intelligence" targets directly into the hero prediction HUD card
        if (numbers) {
            const total = Object.values(numbers.distribution || {}).reduce((a, b) => a + b, 0) || 1;
            const hFreq = numbers.primary ? Math.round((numbers.primary.freq / total) * 100) : 0;
            const sFreq = numbers.secondary ? Math.round((numbers.secondary.freq / total) * 100) : 0;

            const hudHighDigit = document.getElementById('hudHighDigit');
            const hudHighDigitProb = document.getElementById('hudHighDigitProb');
            const hudSecDigit = document.getElementById('hudSecDigit');
            const hudSecDigitProb = document.getElementById('hudSecDigitProb');

            if (hudHighDigit) hudHighDigit.textContent = numbers.primary?.number ?? '--';
            if (hudHighDigitProb) hudHighDigitProb.textContent = `(${hFreq}%)`;
            if (hudSecDigit) hudSecDigit.textContent = numbers.secondary?.number ?? '--';
            if (hudSecDigitProb) hudSecDigitProb.textContent = `(${sFreq}%)`;
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

        // Additional indicators
        const signalStrength = Math.round(pred.confidence * 0.65 + pred.consensus * 35);
        const signalStrengthEl = document.getElementById('signalStrengthVal');
        if (signalStrengthEl) {
            signalStrengthEl.innerHTML = `<span style="color: var(--accent-cyan); font-weight: bold;">${signalStrength}%</span>`;
        }

        const recentAccuracy = this.engineRef.getRecentAccuracy();
        const reliability = Math.round(recentAccuracy * 70 + (1.0 - pred.entropy) * 30);
        const reliabilityEl = document.getElementById('reliabilityVal');
        if (reliabilityEl) {
            reliabilityEl.innerHTML = `<span style="color: var(--accent-green); font-weight: bold;">${reliability}%</span>`;
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
     * Refresh Observatory Chart.js radar maps
     */
    refreshObservatoryCharts() {
        const weights = this.engineRef.getAdaptiveWeights();
        const stats = this.engineRef.getStrategyStats();
        
        const labels = Object.keys(weights);
        const dataWeights = Object.values(weights);
        const dataAcc = stats.map(s => s.recentAccuracy / 100);

        ChartManager.renderRadar('radarChartCanvas', labels, dataWeights);
        ChartManager.renderContribution('contributionChartCanvas', labels, dataAcc);
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

        // Populate validation checks list
        const isGated = !pred.isValid;
        validationList.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:4px;">
                <span>1. Consensus Voting Gate</span>
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

        // Populate risk metrics
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
            <p style="color: var(--text-secondary); font-size: 10px; margin-top: 12px; line-height: 1.4;">
                * System validation parameters require consensus &gt; 55% and volatility standard deviation &lt; 58% to execute automatic clearing procedures.
            </p>
        `;
    }
};
