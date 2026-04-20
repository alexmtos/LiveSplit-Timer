"use strict";

/**
 * Mock LogReader for testing
 */

function createMockLogReader() {
    let _state = 'idle';
    let _totalLogs = 0;
    let _lastLogAt = null;

    return {
        getState: () => _state,
        start: () => { _state = 'running'; },
        stop: () => { _state = 'stopped'; },
        reset: () => { _state = 'idle'; _totalLogs = 0; _lastLogAt = null; },
        destroy: () => { _state = 'destroyed'; },
        addLog: (msg) => { _totalLogs++; _lastLogAt = new Date(); },
        getStats: () => ({ totalLogs: _totalLogs, lastLogAt: _lastLogAt })
    };
}

module.exports = { createMockLogReader };
