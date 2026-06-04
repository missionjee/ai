/**
 * Hiroto AI Terminal — Firebase Adapter
 */

export const FirebaseAdapter = {
    /**
     * Store model weights and adaptive learning state in Firestore
     * @param {Object} metrics - Calculated weights and contribution scores
     */
    async logLearningMetrics(metrics) {
        if (!window.db || !window.collection || !window.addDoc) {
            console.warn("[FIREBASE] Firestore connection not established. Skipping network write.");
            return null;
        }

        try {
            const dataPayload = {
                ...metrics,
                timestamp: new Date().toISOString()
            };
            const docRef = await window.addDoc(window.collection(window.db, 'learning_metrics'), dataPayload);
            console.log("[FIREBASE] Learning metrics logged successfully under ID:", docRef.id);
            return docRef.id;
        } catch (error) {
            console.error("[FIREBASE] Firestore write failed:", error);
            return null;
        }
    }
};
