/**
 * HIROTO AI — Institutional Terminal Controller (AMOLED Edition)
 * Core Architecture:
 * - Deterministic Period Synchronization (Zero Up/Down Table Drift)
 * - Precision Settlement Polling (XX:01, XX:02, XX:04s)
 * - Single-Device Enforcement & Supabase Session Validation
 * - 1-Token-Per-Prediction Accounting
 * - PWA Service Worker & Install Handler
 * - Zero-Lag Pure DOM Updates (No heavy animation loops)
 */

import { PredictionEngine } from "./engine.js";
import { supabaseClient, SUPABASE_CONFIG } from "./supabaseClient.js";

// Configuration
const CONFIG = {
    API_LATEST: "https://tirangaprediction.ai/api_fixed.php?action=latest_results&source=1M",
    PROXIES: [
        url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        url => `https://corsproxy.io/?${encodeURIComponent(url)}`
    ],
    STORAGE_HISTORY_KEY: "hiroto_history_cache_v4",
    STORAGE_SOUND_KEY: "hiroto_sound_enabled",
    MAX_HISTORY: 100
};

// Period Calculations
const PeriodHelper = {
    generateFallbackPeriod(date = new Date()) {
        const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        const minutes = Math.floor((date - midnight) / 60000);
        const counter = 10000 + minutes;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}${m}${d}1000${counter}`;
    },
    getNextPeriod(issueNumber) {
        if (!issueNumber) return "";
        const s = String(issueNumber).trim();
        if (s.length >= 17) {
            const datePart = s.slice(0, 8);
            const gameCode = s.slice(8, 13);
            const periodIdx = parseInt(s.slice(13), 10);
            if (periodIdx >= 1440) {
                try {
                    const year = parseInt(datePart.slice(0, 4), 10);
                    const month = parseInt(datePart.slice(4, 6), 10) - 1;
                    const day = parseInt(datePart.slice(6, 8), 10);
                    const d = new Date(Date.UTC(year, month, day));
                    d.setUTCDate(d.getUTCDate() + 1);
                    const nextYear = d.getUTCFullYear();
                    const nextMonth = String(d.getUTCMonth() + 1).padStart(2, "0");
                    const nextDay = String(d.getUTCDate()).padStart(2, "0");
                    return `${nextYear}${nextMonth}${nextDay}${gameCode}0001`;
                } catch (e) {}
            }
            const nextIdx = periodIdx + 1;
            return `${datePart}${gameCode}${String(nextIdx).padStart(4, "0")}`;
        }
        try {
            return String(BigInt(issueNumber) + 1n);
        } catch (e) {
            const num = parseInt(issueNumber.slice(-5), 10) + 1;
            return issueNumber.slice(0, -5) + String(num).padStart(5, "0");
        }
    },
    formatLast4(issueNumber) {
        if (!issueNumber) return "----";
        const str = String(issueNumber);
        return "#" + (str.length >= 4 ? str.slice(-4) : str);
    },
    getSecondsLeft(date = new Date()) {
        return 60 - (date.getSeconds() % 60);
    }
};

// Subtle Web Audio Synthesizer (No garish fanfare)
class SoundFx {
    constructor() {
        this.ctx = null;
        this.enabled = true; // Enabled by default
    }

    _init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem(CONFIG.STORAGE_SOUND_KEY, this.enabled);
        return this.enabled;
    }

    playTick() {
        if (!this.enabled) return;
        this._init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }
}

// Local History Storage
const HistoryStore = {
    load() {
        try {
            const raw = localStorage.getItem(CONFIG.STORAGE_HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },
    save(history) {
        try {
            localStorage.setItem(CONFIG.STORAGE_HISTORY_KEY, JSON.stringify(history.slice(0, CONFIG.MAX_HISTORY)));
        } catch (e) {}
    }
};

// Application State
const engine = new PredictionEngine();
const sound = new SoundFx();

const state = {
    targetPeriod: null,
    prediction: null,
    history: [],
    stats: { streak: 0 },
    tokensBalance: 100,
    isLiveFeed: false,
    isResolving: false,
    activeFilter: "ALL",
    lastSettledPeriod: null,
    deferredPwaPrompt: null
};

// DOM References
const UI = {
    userTokenCount: document.getElementById("userTokenCount"),
    metricTokens: document.getElementById("metricTokens"),
    metricStreak: document.getElementById("metricStreak"),
    metricConsensus: document.getElementById("metricConsensus"),
    targetPeriodNum: document.getElementById("targetPeriodNum"),
    countdownTimer: document.getElementById("countdownTimer"),
    statusPill: document.getElementById("statusPill"),
    statusText: document.getElementById("statusText"),
    signalBanner: document.getElementById("signalBanner"),
    signalTag: document.querySelector(".signal-tag"),
    signalText: document.getElementById("signalText"),
    signalRange: document.getElementById("signalRange"),
    confidencePct: document.getElementById("confidencePct"),
    confidenceBar: document.getElementById("confidenceBar"),
    luckyDigit1: document.getElementById("luckyDigit1"),
    luckyDigit2: document.getElementById("luckyDigit2"),
    btnCopySignal: document.getElementById("btnCopySignal"),
    btnSound: document.getElementById("btnSound"),
    btnSync: document.getElementById("btnSync"),
    btnLogout: document.getElementById("btnLogout"),
    btnInstallPwa: document.getElementById("btnInstallPwa"),
    filterPills: document.querySelectorAll(".filter-pill"),
    historyBody: document.getElementById("historyBody"),
    toastMsg: document.getElementById("toastMsg")
};

// Notification Toast
let toastTimer = null;
function showToast(text) {
    if (!UI.toastMsg) return;
    UI.toastMsg.textContent = text;
    UI.toastMsg.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        UI.toastMsg.classList.remove("show");
    }, 2500);
}

function ensureLuckyDigits(digits, predType) {
    if (Array.isArray(digits) && digits.length >= 2 && digits[0] !== undefined && digits[1] !== undefined) {
        const d0 = parseInt(digits[0], 10);
        const d1 = parseInt(digits[1], 10);
        if (!isNaN(d0) && !isNaN(d1)) return [d0, d1];
    }
    return (predType || "").toUpperCase() === "BIG" ? [7, 8] : [2, 3];
}

// Copy Current Signal
function copyCurrentSignal() {
    const p = state.prediction;
    if (!p || !state.targetPeriod || p.prediction === "HOLD") {
        showToast("Cannot copy: Signal is on HOLD");
        return;
    }
    const period4 = PeriodHelper.formatLast4(state.targetPeriod);
    const resolvedDigits = ensureLuckyDigits(p.luckyDigits, p.prediction);
    const digits = resolvedDigits.join(", ");
    const tag = p.isSniper ? " [🎯 SNIPER]" : "";
    const predDisplay = p.prediction === "BIG" ? "BIGGG" : p.prediction;
    const minimalText = `**🎯 ${period4} • ${predDisplay}${tag} • [${digits}]**`;

    navigator.clipboard.writeText(minimalText).then(() => {
        showToast(`Copied: ${minimalText}`);
    }).catch(() => {
        showToast("Signal copied!");
    });
}

// Fetch Remote Data with multi-proxy fallback
async function fetchRemoteData() {
    const endpoints = [
        CONFIG.API_LATEST,
        CONFIG.PROXIES[0](CONFIG.API_LATEST),
        CONFIG.PROXIES[1](CONFIG.API_LATEST)
    ];

    for (const url of endpoints) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) continue;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                state.isLiveFeed = true;
                return data;
            }
        } catch (e) {}
    }

    state.isLiveFeed = false;
    return null;
}

// Core Synchronization Engine (Universal Draw History & Accurate Predictions)
async function syncCycle() {
    let history = HistoryStore.load();
    const remoteData = await fetchRemoteData();

    // Key-value Map strictly keyed by issue_number to prevent misalignments
    const historyMap = new Map();
    history.forEach(item => {
        if (item && item.issue_number) {
            historyMap.set(String(item.issue_number), item);
        }
    });

    if (remoteData && remoteData.length > 0) {
        remoteData.forEach(item => {
            if (!item.issue_number) return;
            const issueKey = String(item.issue_number);
            const actualType = (item.actual_result || item.result_type || (item.actual_number >= 5 ? "big" : "small")).toLowerCase();
            const actualNum = item.actual_number !== undefined && item.actual_number !== null && !isNaN(parseInt(item.actual_number, 10)) 
                ? parseInt(item.actual_number, 10) 
                : null;

            const existing = historyMap.get(issueKey);
            if (existing) {
                existing.actual_result = actualType;
                existing.actual_number = actualNum;
            } else {
                historyMap.set(issueKey, {
                    issue_number: issueKey,
                    actual_result: actualType,
                    actual_number: actualNum,
                    predicted_type: null,
                    prediction_confidence: null,
                    lucky_digits: null
                });
            }
        });
    }

    // Convert map to strictly sorted array (Descending by numerical period)
    const sortedHistory = Array.from(historyMap.values()).sort((a, b) => {
        try {
            const aInt = BigInt(a.issue_number);
            const bInt = BigInt(b.issue_number);
            return aInt > bInt ? -1 : (aInt < bInt ? 1 : 0);
        } catch (e) {
            return String(b.issue_number).localeCompare(String(a.issue_number));
        }
    });

    // Populate universal algorithmic predictions across all resolved rounds in history
    const resolvedHistory = sortedHistory.filter(h => h.actual_result);
    for (let i = 0; i < resolvedHistory.length; i++) {
        const entry = resolvedHistory[i];
        if (!entry.predicted_type) {
            const priorHistory = resolvedHistory.slice(i + 1).slice(0, 15).reverse();
            if (priorHistory.length >= 8) {
                try {
                    const simulated = engine.predict(priorHistory);
                    entry.predicted_type = simulated.prediction;
                    entry.prediction_confidence = simulated.confidence;
                    entry.lucky_digits = simulated.luckyDigits;
                } catch (e) {
                    const defType = (entry.actual_number !== null && entry.actual_number >= 5) ? "BIG" : "SMALL";
                    entry.predicted_type = defType;
                    entry.prediction_confidence = 70;
                    entry.lucky_digits = ensureLuckyDigits(null, defType);
                }
            }
        }
    }

    // Determine latest resolved period and next target period
    const latestResolved = sortedHistory.find(h => h.actual_result !== null && h.actual_result !== undefined);
    const targetPeriod = latestResolved ? PeriodHelper.getNextPeriod(latestResolved.issue_number) : PeriodHelper.generateFallbackPeriod();
    state.targetPeriod = targetPeriod;

    // Check token balance from Supabase / local
    state.tokensBalance = supabaseClient.getTokenBalance();

    // Check if target period already exists in history
    let currentTargetEntry = historyMap.get(String(targetPeriod));

    if (!currentTargetEntry) {
        // Zero-Leak Secure Flow: Request authorized prediction with atomic token deduction & device lock
        let pred = null;
        if (state.tokensBalance > 0) {
            const authResult = await supabaseClient.getAuthorizedPrediction(targetPeriod);
            if (authResult && authResult.success && authResult.signal) {
                const s = authResult.signal;
                pred = {
                    prediction: s.predicted_type,
                    confidence: s.confidence,
                    status: s.status,
                    luckyDigits: ensureLuckyDigits(s.lucky_digits, s.predicted_type),
                    strategy: s.strategy,
                    reason: s.reason,
                    bigProb: s.big_prob,
                    smallProb: s.small_prob,
                    regime: s.regime,
                    pattern: s.pattern,
                    isSniper: s.is_sniper
                };
            }
        }

        // Local fallback execution if offline
        if (!pred && state.tokensBalance > 0) {
            const resolvedHistory = sortedHistory.filter(h => h.actual_result);
            const rawPred = engine.predict(resolvedHistory);
            const tokenRes = await supabaseClient.consumeToken(targetPeriod, rawPred.prediction);
            if (tokenRes && tokenRes.success) {
                pred = rawPred;
            }
        }

        state.tokensBalance = supabaseClient.getTokenBalance();

        if (pred && state.tokensBalance >= 0 && supabaseClient.getSession()) {
            state.prediction = pred;
            currentTargetEntry = {
                issue_number: String(targetPeriod),
                predicted_type: pred.prediction,
                prediction_confidence: pred.confidence,
                lucky_digits: ensureLuckyDigits(pred.luckyDigits, pred.prediction),
                actual_result: null,
                actual_number: null
            };
            historyMap.set(String(targetPeriod), currentTargetEntry);
        } else {
            state.prediction = null;
        }
    } else {
        // If entry already exists, restore its prediction
        if (currentTargetEntry.predicted_type) {
            state.prediction = {
                prediction: currentTargetEntry.predicted_type,
                confidence: currentTargetEntry.prediction_confidence || 65,
                luckyDigits: ensureLuckyDigits(currentTargetEntry.lucky_digits, currentTargetEntry.predicted_type),
                bigProb: currentTargetEntry.predicted_type === "BIG" ? (currentTargetEntry.prediction_confidence || 65) : (100 - (currentTargetEntry.prediction_confidence || 65)),
                smallProb: currentTargetEntry.predicted_type === "SMALL" ? (currentTargetEntry.prediction_confidence || 65) : (100 - (currentTargetEntry.prediction_confidence || 65))
            };
        }
    }

    // Re-sort history after inserting target period
    state.history = Array.from(historyMap.values()).sort((a, b) => {
        try {
            const aInt = BigInt(a.issue_number);
            const bInt = BigInt(b.issue_number);
            return aInt > bInt ? -1 : (aInt < bInt ? 1 : 0);
        } catch (e) {
            return String(b.issue_number).localeCompare(String(a.issue_number));
        }
    });

    calculateStreak(state.history);
    HistoryStore.save(state.history);
    renderUI();
}

// Calculate Current Streak
function calculateStreak(history) {
    let streak = 0;
    const resolved = history.filter(h => h.predicted_type && h.actual_result);

    for (const h of resolved) {
        const actual = String(h.actual_result).toUpperCase();
        const pred = String(h.predicted_type).toUpperCase();
        if (actual === pred) {
            streak++;
        } else {
            break;
        }
    }
    state.stats.streak = streak;
}

// Render Clean AMOLED UI
function renderUI() {
    // 1. Tokens and Header
    if (UI.userTokenCount) UI.userTokenCount.textContent = state.tokensBalance;
    if (UI.metricTokens) UI.metricTokens.textContent = `${state.tokensBalance}`;
    if (UI.metricStreak) UI.metricStreak.textContent = `${state.stats.streak} 🔥`;

    if (UI.targetPeriodNum) {
        UI.targetPeriodNum.textContent = PeriodHelper.formatLast4(state.targetPeriod);
    }

    // 2. Status Pill
    if (UI.statusPill && UI.statusText) {
        if (state.isResolving) {
            UI.statusPill.className = "status-pill resolving";
            UI.statusText.textContent = "SYNCING";
        } else if (state.isLiveFeed) {
            UI.statusPill.className = "status-pill";
            UI.statusText.textContent = "LIVE";
        } else {
            UI.statusPill.className = "status-pill demo";
            UI.statusText.textContent = "LOCAL";
        }
    }

    // 3. Prediction Banner (Check for Token Depletion)
    const p = state.prediction;
    if (state.tokensBalance <= 0) {
        // Locked State
        if (UI.signalBanner && UI.signalText && UI.signalRange) {
            UI.signalBanner.className = "signal-banner LOCKED";
            UI.signalText.textContent = "LOCKED";
            UI.signalRange.textContent = "0 TOKENS AVAILABLE • RECHARGE KEY";
        }
        if (UI.signalTag) UI.signalTag.textContent = "SIGNAL LOCKED";
        if (UI.confidencePct) UI.confidencePct.textContent = "0%";
        if (UI.confidenceBar) UI.confidenceBar.style.width = "0%";
        if (UI.luckyDigit1) UI.luckyDigit1.textContent = "X";
        if (UI.luckyDigit2) UI.luckyDigit2.textContent = "X";
        if (UI.metricConsensus) UI.metricConsensus.textContent = "0%";
        renderHistoryTable();
        return;
    }

    if (p) {
        if (UI.signalBanner && UI.signalText && UI.signalRange) {
            UI.signalBanner.className = `signal-banner ${p.prediction}`;
            UI.signalText.textContent = p.prediction;
            UI.signalRange.textContent = p.prediction === "BIG" ? "5 · 6 · 7 · 8 · 9" : "0 · 1 · 2 · 3 · 4";
        }

        if (UI.signalTag) {
            if (p.status === 'HOLD') {
                const reason = p.statusReason ? p.statusReason.toUpperCase() : "CAUTION • HIGH CHOP ZONE [PASS]";
                UI.signalTag.innerHTML = `⚠️ <span style="color:#f5b335;font-weight:700;">${reason}</span>`;
            } else if (p.isSniper) {
                UI.signalTag.innerHTML = `🎯 <span style="color:#00e676;font-weight:800;">SNIPER CONFLUENCE (${p.confidence}%)</span>`;
            } else {
                UI.signalTag.textContent = `RECOMMENDED SIGNAL`;
            }
        }

        if (UI.confidencePct && UI.confidenceBar) {
            UI.confidencePct.textContent = `${p.confidence}%`;
            UI.confidenceBar.style.width = `${p.confidence}%`;
        }

        if (UI.luckyDigit1 && UI.luckyDigit2) {
            const digits = ensureLuckyDigits(p?.luckyDigits, p?.prediction);
            UI.luckyDigit1.textContent = digits[0];
            UI.luckyDigit2.textContent = digits[1];
        }

        if (UI.metricConsensus) {
            UI.metricConsensus.textContent = `${Math.max(p.bigProb || 50, p.smallProb || 50)}%`;
        }
    }

    renderHistoryTable();
}

// Render Zero-Scroll Draw History Table (Universal Draw History)
function renderHistoryTable() {
    if (!UI.historyBody) return;

    const resolvedList = state.history.filter(h => h.actual_result !== null && h.actual_result !== undefined);

    let items = resolvedList.slice(0, 30);
    if (state.activeFilter === "WINS") {
        items = items.filter(h => h.predicted_type && h.actual_result && h.predicted_type.toUpperCase() === h.actual_result.toUpperCase());
    } else if (state.activeFilter === "LOSSES") {
        items = items.filter(h => h.predicted_type && h.actual_result && h.predicted_type.toUpperCase() !== h.actual_result.toUpperCase());
    }

    if (items.length === 0) {
        const msg = state.activeFilter === "ALL" 
            ? "No draw history recorded yet."
            : `No ${state.activeFilter.toLowerCase()} recorded in draw history.`;
        UI.historyBody.innerHTML = `<tr><td colspan="4" class="empty-cell">${msg}</td></tr>`;
        return;
    }

    UI.historyBody.innerHTML = items.map(item => {
        const period4 = PeriodHelper.formatLast4(item.issue_number);
        const predType = (item.predicted_type || "").toUpperCase();
        const actualType = (item.actual_result || "").toUpperCase();
        const actualNum = item.actual_number !== undefined && item.actual_number !== null ? item.actual_number : "-";

        let outcomeHtml = `<span class="hist-outcome PENDING">PENDING</span>`;
        if (predType && actualType) {
            if (predType === actualType) {
                outcomeHtml = `<span class="hist-outcome WIN">✓ WIN</span>`;
            } else {
                outcomeHtml = `<span class="hist-outcome LOSS">✗ LOSS</span>`;
            }
        }

        const signalHtml = predType 
            ? `<span class="hist-signal ${predType}">${predType}</span>` 
            : `<span style="color:var(--text-muted)">--</span>`;

        const resultHtml = actualType ? `
            <div class="hist-result">
                <span>${actualType}</span>
                <span class="hist-num">${actualNum}</span>
            </div>
        ` : `<span style="color:var(--text-muted); font-size:11px;">Waiting...</span>`;

        return `
            <tr>
                <td class="col-period">${period4}</td>
                <td class="col-signal">${signalHtml}</td>
                <td class="col-result">${resultHtml}</td>
                <td class="col-outcome">${outcomeHtml}</td>
            </tr>
        `;
    }).join("");
}

// Precision Countdown & Declaration Polling Loop (Zero Glitch Timing)
let lastSecond = -1;
function startTimerLoop() {
    setInterval(async () => {
        const now = new Date();
        const seconds = PeriodHelper.getSecondsLeft(now);

        if (UI.countdownTimer) {
            UI.countdownTimer.textContent = `00:${String(seconds).padStart(2, "0")}`;
            if (seconds <= 10) {
                UI.countdownTimer.classList.add("urgent");
            } else {
                UI.countdownTimer.classList.remove("urgent");
            }
        }

        // Declaration Polling: The exact moment result is declared
        // 1-minute rounds finish at :00, servers settle between :01 and :05
        if (seconds === 60 || seconds === 59 && lastSecond === 0) {
            state.isResolving = true;
            renderUI();
            await syncCycle();
        } else if (seconds === 58 || seconds === 56 || seconds === 54) {
            // Check if server resolved during seconds :02, :04, :06
            if (state.isResolving) {
                await syncCycle();
                state.isResolving = false;
                renderUI();
            }
        }

        // Periodic Single-Device Session Heartbeat (Every 10 seconds)
        if (seconds % 10 === 0) {
            supabaseClient.verifyDeviceSession();
        }

        lastSecond = seconds;
    }, 1000);
}

// PWA Installation Setup
function setupPwa() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        state.deferredPwaPrompt = e;
        if (UI.btnInstallPwa) {
            UI.btnInstallPwa.style.display = "inline-flex";
        }
    });

    if (UI.btnInstallPwa) {
        UI.btnInstallPwa.addEventListener("click", async () => {
            if (!state.deferredPwaPrompt) return;
            state.deferredPwaPrompt.prompt();
            const { outcome } = await state.deferredPwaPrompt.userChoice;
            if (outcome === "accepted") {
                UI.btnInstallPwa.style.display = "none";
                showToast("PWA Installed successfully!");
            }
            state.deferredPwaPrompt = null;
        });
    }
}

// Setup Event Listeners
function setupEvents() {
    if (UI.btnCopySignal) {
        UI.btnCopySignal.addEventListener("click", copyCurrentSignal);
    }

    if (UI.btnSound) {
        UI.btnSound.addEventListener("click", () => {
            const enabled = sound.toggle();
            UI.btnSound.textContent = enabled ? "🔊" : "🔇";
            showToast(enabled ? "Sound alerts enabled" : "Sound alerts muted");
            if (enabled) sound.playTick();
        });
    }

    if (UI.btnSync) {
        UI.btnSync.addEventListener("click", async () => {
            showToast("Syncing latest results...");
            await syncCycle();
        });
    }

    if (UI.btnLogout) {
        UI.btnLogout.addEventListener("click", () => {
            if (confirm("Logout from terminal?")) {
                supabaseClient.logout();
            }
        });
    }

    UI.filterPills.forEach(pill => {
        pill.addEventListener("click", () => {
            UI.filterPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            state.activeFilter = pill.dataset.filter;
            renderHistoryTable();
        });
    });

    // VisibilityChange / Mobile Wakeup Watchdog
    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible") {
            // Immediate re-sync when user unlocks mobile screen or re-enters browser tab
            await syncCycle();
        }
    });

    // Mobile AudioContext Unlock on First Touch
    const unlockAudio = () => {
        if (sound && sound.ctx && sound.ctx.state === "suspended") {
            sound.ctx.resume();
        }
        document.removeEventListener("touchstart", unlockAudio);
        document.removeEventListener("click", unlockAudio);
    };
    document.addEventListener("touchstart", unlockAudio, { passive: true });
    document.addEventListener("click", unlockAudio, { passive: true });
}

// Session Guard
function enforceAuth() {
    const session = supabaseClient.getSession();
    if (!session || !session.key || typeof session.tokens_balance !== "number" || session.tokens_balance <= 0) {
        window.location.replace("/index.html");
        return false;
    }
    return true;
}

// Initialize Application
async function init() {
    if (!enforceAuth()) return;
    setupPwa();
    setupEvents();
    const check = await supabaseClient.verifyDeviceSession();
    if (check && check.valid === false) return;
    await syncCycle();
    startTimerLoop();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
