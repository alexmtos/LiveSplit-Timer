"use strict";

/**
 * Integration tests for dynamic import readiness
 */

const assert = require('assert');
const { 
    waitForDynamicImport, 
    setDynamicImportReady, 
    setDynamicImportDelay,
    resetDynamicImport 
} = require('../mocks/dynamicImport');

describe('Dynamic Import Readiness', function() {
    beforeEach(function() {
        resetDynamicImport();
    });

    it('should return false when not ready', async function() {
        const ready = await waitForDynamicImport();
        assert.strictEqual(ready, false, 'Should not be ready initially');
    });

    it('should return true when ready', async function() {
        setDynamicImportReady(true);
        const ready = await waitForDynamicImport();
        assert.strictEqual(ready, true, 'Should be ready after setDynamicImportReady(true)');
    });

    it('should respect delay', async function() {
        setDynamicImportDelay(50);
        setDynamicImportReady(true);
        
        const start = Date.now();
        await waitForDynamicImport();
        const elapsed = Date.now() - start;
        
        assert.ok(elapsed >= 45, `Delay should be ~50ms, was ${elapsed}ms`);
    });
});
