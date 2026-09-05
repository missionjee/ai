import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import workerHandler, { PredictionEngine as WorkerEngine } from '../cloudflare-worker/worker.js';
import { PredictionEngine as ClientEngine } from '../engine.js';

describe('Cloudflare Worker Edge Engine & Client Parity Test Suite', () => {
    const createSampleHistory = (len = 25) => {
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

    it('1. Engine Parity: Worker PredictionEngine and Client PredictionEngine produce identical output', () => {
        const workerEng = new WorkerEngine();
        const clientEng = new ClientEngine();

        const history = createSampleHistory(30);

        const workerRes = workerEng.predict(history);
        const clientRes = clientEng.predict(history);

        assert.equal(workerRes.prediction, clientRes.prediction, 'Prediction mismatch');
        assert.equal(workerRes.confidence, clientRes.confidence, 'Confidence mismatch');
        assert.equal(workerRes.status, clientRes.status, 'Status mismatch');
        assert.equal(workerRes.tier, clientRes.tier, 'Tier mismatch');
        assert.equal(workerRes.recommendedStake, clientRes.recommendedStake, 'Stake mismatch');
        assert.equal(workerRes.isSniper, clientRes.isSniper, 'isSniper mismatch');
        assert.equal(workerRes.bigProb, clientRes.bigProb, 'bigProb mismatch');
        assert.equal(workerRes.smallProb, clientRes.smallProb, 'smallProb mismatch');
        assert.deepEqual(workerRes.luckyDigits, clientRes.luckyDigits, 'luckyDigits mismatch');
        assert.equal(workerRes.regime, clientRes.regime, 'regime mismatch');
    });

    it('2. Worker HTTP Handler /health Endpoint', async () => {
        const req = new Request('https://worker.local/health');
        const res = await workerHandler.fetch(req, {}, {});

        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Content-Type'), 'application/json');
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');

        const body = await res.json();
        assert.equal(body.status, 'HEALTHY');
        assert.equal(body.platform, 'Cloudflare Workers 24/7');
        assert.equal(body.buffer_target, '5,000-Round FIFO Ring Buffer');
        assert.ok(typeof body.historical_rounds_buffered === 'number');
        assert.ok(typeof body.platt_parameters === 'object');
    });

    it('3. Worker HTTP Handler Root / Endpoint', async () => {
        const req = new Request('https://worker.local/');
        const res = await workerHandler.fetch(req, {}, {});

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ONLINE');
        assert.ok(body.engine_version === 'v12.2' || body.engine_version === 'v12.1' || body.engine_version === 'v12.0' || body.engine_version === 'v11.3' || body.engine_version === 'v11.2' || body.engine_version === 'v10.0' || body.engine_version === 'v9.3');
        assert.equal(body.diagnostics_url, '/report');
    });

    it('4. Worker HTTP Handler /report Diagnostic Report Endpoint', async () => {
        const req = new Request('https://worker.local/report');
        const res = await workerHandler.fetch(req, {}, {});

        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ONLINE');
        assert.ok(body.engine_version.includes('v12.2') || body.engine_version.includes('v12.1') || body.engine_version.includes('v12.0') || body.engine_version.includes('v11.3') || body.engine_version.includes('v11.2') || body.engine_version.includes('v10.0') || body.engine_version.includes('v9.3'));
        assert.equal(body.buffer_capacity, 5000);
        assert.ok(typeof body.hold_audit_summary === 'object');
        assert.ok(typeof body.meta_learner_models === 'object');
        assert.ok(typeof body.active_regime === 'object');
        assert.ok(typeof body.recommendations === 'string');
    });

    it('5. Worker HTTP Handler 404 Route', async () => {
        const req = new Request('https://worker.local/non-existent-path');
        const res = await workerHandler.fetch(req, {}, {});

        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.error, 'NOT_FOUND');
        assert.equal(body.code, 404);
    });
});
