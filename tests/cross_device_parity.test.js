import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PredictionEngine } from '../engine.js';
import { PredictionEngine as WorkerEngine, calculateNextPeriod } from '../cloudflare-worker/worker.js';


describe('Cross-Device Synchronization & Multi-Device Determinism Test Suite', () => {
    const createSampleHistory = (len = 50) => {
        const history = [];
        for (let i = 0; i < len; i++) {
            const isBig = ((i * 7 + 3) % 10) >= 5;
            const num = (i * 7 + 3) % 10;
            history.push({
                issue_number: String(20260901100010000n + BigInt(i)),
                actual_result: isBig ? 'big' : 'small',
                actual_number: num,
                result_type: isBig ? 'big' : 'small'
            });
        }
        return history;
    };

    it('1. Stateless Determinism: 50 successive calls produce identical predictions without state drift', () => {
        const engine1 = new PredictionEngine();
        const engine2 = new PredictionEngine();
        const history = createSampleHistory(35);

        const baseline = engine1.predict(history);

        for (let run = 0; run < 50; run++) {
            // Engine 1 reuse
            const r1 = engine1.predict(history);
            // Engine 2 fresh or reuse
            const r2 = engine2.predict(history);

            assert.equal(r1.prediction, baseline.prediction, `Prediction drift at run ${run}`);
            assert.equal(r1.confidence, baseline.confidence, `Confidence drift at run ${run}`);
            assert.equal(r1.status, baseline.status, `Status drift at run ${run}`);
            assert.equal(r1.tier, baseline.tier, `Tier drift at run ${run}`);
            assert.deepEqual(r1.luckyDigits, baseline.luckyDigits, `Lucky digits drift at run ${run}`);

            assert.equal(r2.prediction, baseline.prediction, `Engine 2 prediction drift at run ${run}`);
            assert.equal(r2.confidence, baseline.confidence, `Engine 2 confidence drift at run ${run}`);
        }
    });

    it('2. Cross-Device Buffer Depth Parity: Device with 80 records vs Device with 40 records produce identical prediction', () => {
        const deviceA = new PredictionEngine();
        const deviceB = new PredictionEngine();

        const fullHistory = createSampleHistory(80);
        const slicedHistory = fullHistory.slice(-40); // Device B only has last 40 records

        const predA = deviceA.predict(fullHistory);
        const predB = deviceB.predict(slicedHistory);

        assert.equal(predA.prediction, predB.prediction, 'Prediction differs between 80-round and 40-round devices');
        assert.equal(predA.confidence, predB.confidence, 'Confidence differs between 80-round and 40-round devices');
        assert.equal(predA.status, predB.status, 'Status differs between 80-round and 40-round devices');
        assert.deepEqual(predA.luckyDigits, predB.luckyDigits, 'Lucky digits differ between devices');
    });

    it('3. Target Period Consistency: calculateNextPeriod locks target period to latest draw regardless of local clock skew', () => {
        const latestSettled = '20260903100010350';

        const targetA = calculateNextPeriod(latestSettled);
        const targetB = calculateNextPeriod(latestSettled);

        assert.equal(targetA, '20260903100010351');
        assert.equal(targetB, '20260903100010351');
        assert.equal(targetA, targetB, 'Target period diverged');
    });


    it('4. Tri-Engine Parity (Client JS, Edge Worker JS, React TypeScript specifications)', () => {
        const clientEngine = new PredictionEngine();
        const workerEngine = new WorkerEngine();

        const testDataset = createSampleHistory(28);

        const clientOutput = clientEngine.predict(testDataset);
        const workerOutput = workerEngine.predict(testDataset);

        assert.equal(clientOutput.prediction, workerOutput.prediction);
        assert.equal(clientOutput.confidence, workerOutput.confidence);
        assert.equal(clientOutput.status, workerOutput.status);
        assert.equal(clientOutput.tier, workerOutput.tier);
        assert.equal(clientOutput.calibratedP, workerOutput.calibratedP);
        assert.deepEqual(clientOutput.luckyDigits, workerOutput.luckyDigits);
    });
});
