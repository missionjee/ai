/**
 * HIROTO AI — Supabase Database & Session Manager
 * Project: fvmbqikdomcjalladwmz
 * Features:
 * - Direct REST / RPC communication with Supabase
 * - Single-Device Session Lock (Strict Device ID Verification)
 * - 1-Token-Per-Prediction Accounting
 * - Resilient Local Fallback Engine
 */

const safeStorage = {
    _memory: {},
    getItem(key) {
        if (typeof localStorage !== "undefined") {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        }
        return this._memory[key] || null;
    },
    setItem(key, val) {
        if (typeof localStorage !== "undefined") {
            try { localStorage.setItem(key, val); } catch (e) {}
        }
        this._memory[key] = String(val);
    },
    removeItem(key) {
        if (typeof localStorage !== "undefined") {
            try { localStorage.removeItem(key); } catch (e) {}
        }
        delete this._memory[key];
    }
};

export const SUPABASE_CONFIG = {
    PROJECT_REF: "fvmbqikdomcjalladwmz",
    API_URL: "https://fvmbqikdomcjalladwmz.supabase.co",
    ANON_KEY: safeStorage.getItem("hiroto_supabase_anon_key") || "sb_publishable_UNWum89AzkwnfNb2BoxdKA_otmSXn5c",
    DEFAULT_TOKENS: 100,
    STORAGE_SESSION_KEY: "hiroto_signals_session",
    STORAGE_DEVICE_KEY: "hiroto_device_id",
    STORAGE_TOKENS_KEY: "hiroto_tokens_balance"
};

class SupabaseService {
    constructor() {
        this.deviceId = this._getOrCreateDeviceId();
        this.session = this.getSession();
    }

    _getOrCreateDeviceId() {
        let id = safeStorage.getItem(SUPABASE_CONFIG.STORAGE_DEVICE_KEY);
        if (!id) {
            if (typeof crypto !== "undefined" && crypto.randomUUID) {
                id = `DEV-${crypto.randomUUID()}`;
            } else {
                id = `DEV-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
            }
            safeStorage.setItem(SUPABASE_CONFIG.STORAGE_DEVICE_KEY, id);
        }
        return id;
    }

    getSession() {
        try {
            const raw = safeStorage.getItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    getTokenBalance() {
        const session = this.getSession();
        if (session && typeof session.tokens_balance === "number") {
            return session.tokens_balance;
        }
        const cached = safeStorage.getItem(SUPABASE_CONFIG.STORAGE_TOKENS_KEY);
        return cached !== null ? parseInt(cached, 10) : SUPABASE_CONFIG.DEFAULT_TOKENS;
    }

    _setTokenBalance(count) {
        safeStorage.setItem(SUPABASE_CONFIG.STORAGE_TOKENS_KEY, String(count));
        const session = this.getSession();
        if (session) {
            session.tokens_balance = count;
            safeStorage.setItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY, JSON.stringify(session));
        }
    }

    /**
     * Authenticate License Key against Supabase & Enforce Single Device Lock
     * STRICT AUTHENTICATION: Only authorized keys stored in Supabase with tokens > 0 can enter.
     */
    async loginWithKey(licenseKey) {
        const cleanKey = licenseKey ? licenseKey.trim().toUpperCase() : "";
        if (!cleanKey) {
            return { success: false, message: "Please enter a license key." };
        }
        const deviceId = this.deviceId;
        const deviceName = (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.includes("Mobile")) ? "Mobile Device" : "Workstation";

        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`, {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });

            if (!res.ok) {
                return { success: false, message: `Authentication server responded with error ${res.status}.` };
            }

            const rows = await res.json();
            if (!Array.isArray(rows) || rows.length === 0) {
                return {
                    success: false,
                    code: "KEY_NOT_FOUND",
                    message: "Invalid license key. Key does not exist in database."
                };
            }

            const user = rows[0];

            // 1. Check if revoked or deleted
            if (user.status === "revoked" || user.status === "deleted") {
                return {
                    success: false,
                    code: "KEY_REVOKED",
                    message: "Access Denied: This license key has been deleted or revoked by administration."
                };
            }

            // 2. Token-Only Validity: A key strictly ends when tokens reach 0
            const tokenBalance = parseInt(user.tokens_balance, 10);
            if (isNaN(tokenBalance) || tokenBalance <= 0 || user.status === "ended") {
                // Update status in Supabase to ended
                fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`, {
                    method: "PATCH",
                    headers: {
                        "apikey": SUPABASE_CONFIG.ANON_KEY,
                        "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ status: "ended", tokens_balance: 0 })
                }).catch(() => {});

                return {
                    success: false,
                    code: "KEY_ENDED",
                    message: "This key has ended: 0 tokens remaining. Please recharge or generate a new key."
                };
            }

            // 3. Strict Single Device Enforcement:
            // Check if key is already locked to a different device
            if (user.active_device_id && user.active_device_id !== deviceId) {
                return {
                    success: false,
                    code: "DEVICE_LOCKED",
                    message: "🔒 ACCESS DENIED: This license key is already locked to another device. Only 1 device is permitted per key. Reset device lock in Key Master to transfer."
                };
            }

            // 4. Bind key to this device (if unbound) and update activity
            await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(cleanKey)}`, {
                method: "PATCH",
                headers: {
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    active_device_id: deviceId,
                    device_name: deviceName,
                    status: "active",
                    last_login_at: new Date().toISOString(),
                    last_active_at: new Date().toISOString()
                })
            });

            const session = {
                key: cleanKey,
                tokens_balance: tokenBalance,
                deviceId: deviceId,
                status: "active",
                syncedWithCloud: true,
                loginTime: new Date().toISOString()
            };

            safeStorage.setItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY, JSON.stringify(session));
            this._setTokenBalance(tokenBalance);
            return { success: true, session };

        } catch (err) {
            console.error("[Supabase Auth] Network connection error:", err);
            return {
                success: false,
                message: "Authentication server unreachable. Please check your network connection."
            };
        }
    }

    /**
     * Consume 1 Token for a Prediction Round
     * Returns: { success: boolean, remainingTokens: number, error?: string }
     */
    async consumeToken(periodNumber, predictionType) {
        const session = this.getSession();
        if (!session || !session.key) {
            return { success: false, error: "AUTH_REQUIRED" };
        }

        const deviceId = this.deviceId;
        const currentTokens = this.getTokenBalance();

        if (currentTokens <= 0) {
            return {
                success: false,
                error: "INSUFFICIENT_TOKENS",
                remainingTokens: 0,
                message: "Tokens depleted. 1 token is required per prediction."
            };
        }

        // Try Supabase RPC for cloud-synchronized token deduction & device lock
        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/rpc/consume_prediction_token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                },
                body: JSON.stringify({
                    p_license_key: session.key,
                    p_device_id: deviceId,
                    p_period: String(periodNumber),
                    p_prediction_type: predictionType
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.success) {
                    this._setTokenBalance(data.tokens_balance);
                    return { success: true, remainingTokens: data.tokens_balance, deducted: data.deducted };
                } else if (data && data.error === "DEVICE_MISMATCH") {
                    this.logoutDueToDeviceConflict();
                    return { success: false, error: "DEVICE_MISMATCH" };
                } else if (data && data.error === "INSUFFICIENT_TOKENS") {
                    this._setTokenBalance(0);
                    return { success: false, error: "INSUFFICIENT_TOKENS", remainingTokens: 0 };
                } else if (data && (data.error === "KEY_NOT_FOUND" || data.error === "INVALID_KEY" || data.error === "KEY_DELETED")) {
                    this.logout();
                    return { success: false, error: "KEY_DELETED" };
                }
            }
        } catch (e) {
            // Local fallback execution
        }

        // Check if already deducted locally for this period
        const ledgerKey = `hiroto_deducted_${periodNumber}`;
        if (safeStorage.getItem(ledgerKey)) {
            return { success: true, remainingTokens: currentTokens, deducted: 0 };
        }

        // Deduct 1 token locally
        const newBalance = Math.max(0, currentTokens - 1);
        safeStorage.setItem(ledgerKey, "1");
        this._setTokenBalance(newBalance);

        return {
            success: true,
            remainingTokens: newBalance,
            deducted: 1
        };
    }

    /**
     * Real-time Device Lock & Token Verification
     */
    async verifyDeviceSession() {
        const session = this.getSession();
        if (!session || !session.key) return { valid: false };

        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/user_profiles?license_key=eq.${encodeURIComponent(session.key)}&select=active_device_id,tokens_balance,status`, {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });

            if (res.ok) {
                const rows = await res.json();
                if (!Array.isArray(rows) || rows.length === 0) {
                    this.logout();
                    return { valid: false, reason: "DELETED" };
                }
                const row = rows[0];
                // 1. Strict Device Lock Check: Another device cannot use this key
                if (row.active_device_id && row.active_device_id !== this.deviceId) {
                    this.logoutDueToDeviceConflict();
                    return { valid: false, reason: "DEVICE_MISMATCH" };
                }
                // 2. Token Check: Depleted or deleted
                if (row.status === "ended" || row.status === "revoked" || row.status === "deleted" || row.tokens_balance <= 0) {
                    this.logout();
                    return { valid: false, reason: "ENDED" };
                }
                if (typeof row.tokens_balance === "number") {
                    this._setTokenBalance(row.tokens_balance);
                }
                return { valid: true };
            }
        } catch (e) {
            console.error("Device verification error:", e);
        }

        return { valid: true };
    }

    /**
     * Fetch Central 24/7 Global Signal from Cloud (Single Source of Truth)
     */
    async getGlobalSignal(periodNumber) {
        if (!periodNumber) return null;
        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/global_signals?issue_number=eq.${encodeURIComponent(periodNumber)}&select=*`, {
                headers: {
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows) && rows.length > 0) {
                    return rows[0];
                }
            }
        } catch (e) {}
        return null;
    }

    /**
     * Fetch recent global signals strictly filtered to lottery periods (like.20*)
     */
    async getRecentGlobalSignals(limit = 60) {
        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/global_signals?issue_number=like.20*&order=issue_number.desc&limit=${limit}`, {
                headers: {
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows)) {
                    return rows.filter(r => r.issue_number && String(r.issue_number).startsWith("20"));
                }
            }
        } catch (e) {}
        return [];
    }

    /**
     * Zero-Leak Secure RPC: Get Authorized Prediction
     * 1. Consumes token via atomic RPC and verifies device validity
     * 2. Fetches authoritative central signal from Supabase global_signals
     * 3. If edge cron was delayed, triggers Cloudflare Worker /signal directly to ensure 100% deterministic parity across all devices
     */
    async getAuthorizedPrediction(periodNumber) {
        const session = this.getSession();
        if (!session || !session.key) return { success: false, error: "AUTH_REQUIRED" };

        // 1. Consume token atomically
        const tokenResult = await this.consumeToken(periodNumber, "PRED");
        if (!tokenResult.success) {
            if (tokenResult.error === "DEVICE_MISMATCH") {
                return { success: false, error: "DEVICE_MISMATCH" };
            }
            if (tokenResult.error === "INSUFFICIENT_TOKENS") {
                return { success: false, error: "INSUFFICIENT_TOKENS", tokensBalance: 0 };
            }
        }

        // 2. Fetch Central Signal from Supabase
        let cloudSignal = await this.getGlobalSignal(periodNumber);

        // 3. If signal not yet in Supabase, query 24/7 Cloudflare Edge Worker directly
        if (!cloudSignal || !cloudSignal.predicted_type) {
            try {
                const workerController = new AbortController();
                const workerTimeout = setTimeout(() => workerController.abort(), 6000);
                const workerRes = await fetch(`https://hiroto-engine-worker.diveshsah2.workers.dev/signal?period=${encodeURIComponent(periodNumber)}`, {
                    signal: workerController.signal,
                    cache: "no-store"
                });
                clearTimeout(workerTimeout);
                if (workerRes.ok) {
                    const workerJson = await workerRes.json();
                    if (workerJson && workerJson.data && workerJson.data.prediction) {
                        const d = workerJson.data;
                        cloudSignal = {
                            issue_number: d.period || periodNumber,
                            predicted_type: d.prediction,
                            confidence: d.confidence || 55,
                            status: d.status || "CLEARED",
                            lucky_digits: d.luckyDigits || d.lucky_digits || [7, 8],
                            stake_units: d.recommendedStake || "1U",
                            strategy: d.strategy || "Autonomous Meta-Learner",
                            reason: d.reason || "Edge Ensemble Convergence",
                            big_prob: d.bigProb || 50,
                            small_prob: d.smallProb || 50,
                            regime: d.regime || "trending",
                            pattern: d.pattern || "Standard",
                            is_sniper: !!d.isSniper,
                            engine_version: d.engine_version || "v9.3",
                            created_at: new Date().toISOString()
                        };
                    }
                }
            } catch (e) {}
        }

        // Re-check Supabase if worker just populated it
        if (!cloudSignal) {
            cloudSignal = await this.getGlobalSignal(periodNumber);
        }

        return {
            success: !!cloudSignal,
            signal: cloudSignal,
            tokensBalance: this.getTokenBalance()
        };
    }

    /**
     * Fetch user's taken predictions history from Supabase token_ledger
     */
    async getUserTakenPredictions(limit = 60) {
        const session = this.getSession();
        if (!session || !session.key) return [];
        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/token_ledger?license_key=eq.${encodeURIComponent(session.key)}&select=period_number,prediction_type,created_at&order=id.desc&limit=${limit}`, {
                headers: {
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                }
            });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows)) return rows;
            }
        } catch (e) {}
        return [];
    }

    /**
     * Force logout when multi-device conflict is detected
     */
    logoutDueToDeviceConflict() {
        safeStorage.removeItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY);
        alert("⚠️ ACCESS TERMINATED: This license key is locked to another device. Multi-device access is prohibited.");
        window.location.replace("/index.html?reason=multi_device");
    }

    /**
     * Manual Logout
     */
    logout() {
        safeStorage.removeItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY);
        window.location.replace("/index.html");
    }
}

export const supabaseClient = new SupabaseService();
