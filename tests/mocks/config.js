"use strict";

/**
 * Mock Config for testing
 */

const _mockConfig = {
    WS_URL: 'ws://localhost:16834/livesplit',
    RECONNECT_DELAY: 1000,
    MAX_AUTO_RECONNECT_ATTEMPTS: 3,
    GRAPH_DRAW_THROTTLE: 16,
    RESIZE_DEBOUNCE: 150,
    CLICK_DISTANCE_THRESHOLD: 15,
    AUTO_SHOW_SETTINGS_ON_DISCONNECT: true
};

function getMockConfig() {
    return { ..._mockConfig };
}

function setMockConfigValue(key, value) {
    _mockConfig[key] = value;
}

function resetMockConfig() {
    Object.keys(_mockConfig).forEach(k => delete _mockConfig[k]);
    Object.assign(_mockConfig, {
        WS_URL: 'ws://localhost:16834/livesplit',
        RECONNECT_DELAY: 1000,
        MAX_AUTO_RECONNECT_ATTEMPTS: 3,
        GRAPH_DRAW_THROTTLE: 16,
        RESIZE_DEBOUNCE: 150,
        CLICK_DISTANCE_THRESHOLD: 15,
        AUTO_SHOW_SETTINGS_ON_DISCONNECT: true
    });
}

module.exports = { getMockConfig, setMockConfigValue, resetMockConfig };
