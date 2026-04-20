"use strict";

/**
 * Unit tests for logReader lifecycle
 */

const assert = require('assert');
const { createMockLogReader } = require('../../mocks/logReader');

describe('LogReader Lifecycle', function() {
    it('should transition through idle -> running -> stopped states', function() {
        const reader = createMockLogReader();
        
        assert.strictEqual(reader.getState(), 'idle', 'Initial state should be idle');
        
        reader.start();
        assert.strictEqual(reader.getState(), 'running', 'State should be running after start');
        
        reader.stop();
        assert.strictEqual(reader.getState(), 'stopped', 'State should be stopped after stop');
    });

    it('should reset stats on reset', function() {
        const reader = createMockLogReader();
        
        reader.start();
        reader.addLog('test1');
        reader.addLog('test2');
        assert.strictEqual(reader.getStats().totalLogs, 2, 'Should have 2 logs');
        
        reader.reset();
        assert.strictEqual(reader.getStats().totalLogs, 0, 'Should have 0 logs after reset');
        assert.strictEqual(reader.getStats().lastLogAt, null, 'lastLogAt should be null after reset');
    });

    it('should track logs correctly', function() {
        const reader = createMockLogReader();
        
        reader.start();
        reader.addLog('first');
        assert.strictEqual(reader.getStats().totalLogs, 1, 'Should have 1 log');
        
        reader.addLog('second');
        assert.strictEqual(reader.getStats().totalLogs, 2, 'Should have 2 logs');
        assert.ok(reader.getStats().lastLogAt instanceof Date, 'lastLogAt should be a Date');
    });

    it('should transition to destroyed state', function() {
        const reader = createMockLogReader();
        
        reader.start();
        reader.destroy();
        assert.strictEqual(reader.getState(), 'destroyed', 'State should be destroyed');
    });
});
