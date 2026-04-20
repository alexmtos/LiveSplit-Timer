"use strict";

/**
 * Mock Dynamic Import Readiness for testing
 */

let _ready = false;
let _delay = 0;

function setDynamicImportReady(ready) {
    _ready = ready;
}

function setDynamicImportDelay(ms) {
    _delay = ms;
}

async function waitForDynamicImport() {
    if (_delay > 0) {
        await new Promise(resolve => setTimeout(resolve, _delay));
    }
    return _ready;
}

function isDynamicImportReady() {
    return _ready;
}

function resetDynamicImport() {
    _ready = false;
    _delay = 0;
}

module.exports = {
    setDynamicImportReady,
    setDynamicImportDelay,
    waitForDynamicImport,
    isDynamicImportReady,
    resetDynamicImport
};
