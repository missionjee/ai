/**
 * Hiroto AI Terminal — Security & Authentication Route Guard
 */

export const SecurityGuard = {
    /**
     * Verify session credentials in local storage
     * @returns {Object|null} Authorized session data or null if invalid
     */
    verifySession() {
        const saved = localStorage.getItem('hiroto_signals_session');
        if (!saved) return null;
        try {
            const session = JSON.parse(saved);
            let expiryDate = new Date(session.expires || session.expiry || session.expiration || session.validUntil);
            if (isNaN(expiryDate.getTime())) {
                if (session.created) expiryDate = new Date(new Date(session.created).getTime() + 604800000);
                else expiryDate = new Date(Date.now() + 604800000);
            }
            if (expiryDate < new Date()) {
                localStorage.removeItem('hiroto_signals_session');
                return null;
            }
            // Enhance session object
            session.parsedExpiry = expiryDate.toISOString();
            session.daysRemaining = Math.ceil((expiryDate - new Date()) / 86400000);
            return session;
        } catch (e) {
            localStorage.removeItem('hiroto_signals_session');
            return null;
        }
    },

    /**
     * Enforce access block in UI if unauthorized
     */
    enforceClearance() {
        const session = this.verifySession();
        const deniedEl = document.getElementById('accessDenied');
        const dashboardEl = document.getElementById('dashboardContent');

        if (!session) {
            if (deniedEl) deniedEl.classList.remove('hidden');
            if (dashboardEl) dashboardEl.classList.add('hidden');
            return false;
        } else {
            if (deniedEl) deniedEl.classList.add('hidden');
            if (dashboardEl) dashboardEl.classList.remove('hidden');
            return true;
        }
    }
};
