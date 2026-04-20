"use strict";

/**
 * Config module - extracted from app.js
 * Contains all configuration values for the LiveSplit Timer UI.
 * Can be overridden via environment variables or direct assignment.
 */

const _config = {
    WS_URL: 'ws://localhost:16834/livesplit',
    RECONNECT_DELAY: 1000,
    MAX_AUTO_RECONNECT_ATTEMPTS: 3,
    GRAPH_DRAW_THROTTLE: 16,
    RESIZE_DEBOUNCE: 150,
    CLICK_DISTANCE_THRESHOLD: 15,
    AUTO_SHOW_SETTINGS_ON_DISCONNECT: true
};

/**
 * Get the full config object
 * @returns {Object} Configuration object
 */
function getConfig() {
    return { ..._config };
}

/**
 * Get a specific config value
 * @param {string} key - Config key
 * @returns {*} Config value or undefined
 */
function getConfigValue(key) {
    return _config[key];
}

/**
 * Set a config value (runtime override)
 * @param {string} key - Config key
 * @param {*} value - New value
 */
function setConfigValue(key, value) {
    _config[key] = value;
}

/**
 * Reset config to defaults
 */
function resetConfig() {
    Object.keys(_config).forEach(k => delete _config[k]);
    Object.assign(_config, {
        WS_URL: 'ws://localhost:16834/livesplit',
        RECONNECT_DELAY: 1000,
        MAX_AUTO_RECONNECT_ATTEMPTS: 3,
        GRAPH_DRAW_THROTTLE: 16,
        RESIZE_DEBOUNCE: 150,
        CLICK_DISTANCE_THRESHOLD: 15,
        AUTO_SHOW_SETTINGS_ON_DISCONNECT: true
    });
}

module.exports = { getConfig, getConfigValue, setConfigValue, resetConfig };
