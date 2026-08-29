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

            // 3. Single Device Enforcement: Lock session to this hardware device ID
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
     * Heartbeat: Verify this device is the solely authorized active session
     */
    async verifyDeviceSession() {
        const session = this.getSession();
        if (!session || !session.key) return { valid: false };

        try {
            const res = await fetch(`${SUPABASE_CONFIG.API_URL}/rest/v1/rpc/verify_single_device`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_CONFIG.ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
                },
                body: JSON.stringify({
                    p_license_key: session.key,
                    p_device_id: this.deviceId
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data && !data.valid && data.reason === "DEVICE_MISMATCH") {
                    this.logoutDueToDeviceConflict();
                    return { valid: false, reason: "DEVICE_MISMATCH" };
                }
                if (data && typeof data.tokens_balance === "number") {
                    this._setTokenBalance(data.tokens_balance);
                }
            }
        } catch (e) {}

        return { valid: true };
    }

    /**
     * Force logout when multi-device conflict is detected
     */
    logoutDueToDeviceConflict() {
        safeStorage.removeItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY);
        alert("⚠️ ACCESS TERMINATED: Your license key was used on another device. Multi-device access is not permitted.");
        window.location.href = "index.html?reason=multi_device";
    }

    /**
     * Manual Logout
     */
    logout() {
        safeStorage.removeItem(SUPABASE_CONFIG.STORAGE_SESSION_KEY);
        window.location.href = "index.html";
    }
}

export const supabaseClient = new SupabaseService();
