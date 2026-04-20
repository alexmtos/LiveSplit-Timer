"use strict";

/**
 * Mock WebSocket for testing
 */

function createMockWebSocket() {
    let _readyState = 0; // CONNECTING
    const listeners = {};

    return {
        get readyState() { return _readyState; },
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        addEventListener: (event, cb) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(cb);
        },
        removeEventListener: (event, cb) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(l => l !== cb);
            }
        },
        _simulateOpen: () => {
            _readyState = 1;
            if (listeners.open) listeners.open.forEach(cb => cb({}));
        },
        _simulateMessage: (data) => {
            if (listeners.message) listeners.message.forEach(cb => cb({ data }));
        },
        _simulateError: (err) => {
            if (listeners.error) listeners.error.forEach(cb => cb(err));
        },
        _simulateClose: () => {
            _readyState = 3;
            if (listeners.close) listeners.close.forEach(cb => cb({ code: 1000 }));
        },
        close: () => { _readyState = 3; }
    };
}

function createMockWebSocketServer() {
    let _running = false;
    const connections = [];

    return {
        start: () => { _running = true; },
        stop: () => { _running = false; connections.forEach(c => c.close()); },
        isRunning: () => _running,
        getConnections: () => connections.length
    };
}

module.exports = { createMockWebSocket, createMockWebSocketServer };
