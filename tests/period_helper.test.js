import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextPeriod } from '../cloudflare-worker/worker.js';

describe('Period Rollover & Calendar Arithmetic Test Suite', () => {
    it('1. Standard Sequential Next Period within same day', () => {
        const p1 = '20260901100010001';
        const next1 = calculateNextPeriod(p1);
        assert.equal(next1, '20260901100010002');

        const p999 = '20260901100010999';
        const next999 = calculateNextPeriod(p999);
        assert.equal(next999, '20260901100011000');
    });

    it('2. Midnight Rollover (Period 1440 -> Day+1 Period 0001)', () => {
        const midnightPeriod = '20260901100011440';
        const next = calculateNextPeriod(midnightPeriod);
        assert.equal(next, '20260902100010001');
    });

    it('3. Month Boundary Midnight Rollover (e.g. Aug 31 -> Sep 01)', () => {
        const endOfMonth = '20260831100011440';
        const next = calculateNextPeriod(endOfMonth);
        assert.equal(next, '20260901100010001');
    });

    it('4. Year Boundary Midnight Rollover (e.g. Dec 31 -> Jan 01 next year)', () => {
        const endOfYear = '20261231100011440';
        const next = calculateNextPeriod(endOfYear);
        assert.equal(next, '20270101100010001');
    });

    it('5. Leap Year Midnight Rollover (Feb 28 in leap year 2028 -> Feb 29)', () => {
        const leapFeb28 = '20280228100011440';
        const nextLeap = calculateNextPeriod(leapFeb28);
        assert.equal(nextLeap, '20280229100010001');

        const leapFeb29 = '20280229100011440';
        const nextMarch = calculateNextPeriod(leapFeb29);
        assert.equal(nextMarch, '20280301100010001');
    });

    it('6. Non-Standard / Shorter String Fallbacks', () => {
        const shortNum = '12345';
        const nextShort = calculateNextPeriod(shortNum);
        assert.equal(nextShort, '12346');

        assert.equal(calculateNextPeriod(''), '');
    });
});
