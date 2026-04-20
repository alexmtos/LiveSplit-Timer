"use strict";

/**
 * Tests for src/config.js and src/translations.js modules
 * Run with: node tests/src_modules.test.js
 */

const assert = require('assert');

// Test config module
console.log('[Test] Testing config module...');
const { getConfig, getConfigValue, setConfigValue, resetConfig } = require('../src/config');

const config = getConfig();
assert.strictEqual(typeof config, 'object', 'getConfig() should return an object');
assert.strictEqual(config.WS_URL, 'ws://localhost:16834/livesplit', 'WS_URL should be correct');
assert.strictEqual(config.RECONNECT_DELAY, 1000, 'RECONNECT_DELAY should be 1000');
console.log('  ✓ getConfig() returns correct object');

assert.strictEqual(getConfigValue('WS_URL'), 'ws://localhost:16834/livesplit', 'getConfigValue() works');
console.log('  ✓ getConfigValue() works');

setConfigValue('WS_URL', 'ws://test.local');
assert.strictEqual(getConfigValue('WS_URL'), 'ws://test.local', 'setConfigValue() works');
resetConfig();
assert.strictEqual(getConfigValue('WS_URL'), 'ws://localhost:16834/livesplit', 'resetConfig() works');
console.log('  ✓ setConfigValue() and resetConfig() work');

// Test translations module
console.log('[Test] Testing translations module...');
const { getTranslation, getAvailableLanguages, createTranslationsProxy, createMultiLangProxy } = require('../src/translations');

const languages = getAvailableLanguages();
assert.ok(Array.isArray(languages), 'getAvailableLanguages() should return array');
assert.ok(languages.includes('pt-BR'), 'Should include pt-BR');
assert.ok(languages.includes('en-US'), 'Should include en-US');
console.log('  ✓ getAvailableLanguages() works');

assert.strictEqual(getTranslation('pt-BR', 'start'), 'Iniciar', 'pt-BR translation works');
assert.strictEqual(getTranslation('en-US', 'start'), 'Start', 'en-US translation works');
assert.strictEqual(getTranslation('xx', 'unknown'), 'unknown', 'Fallback to key works');
console.log('  ✓ getTranslation() works');

// Test TRANSLATIONS proxy style access
const translations = createMultiLangProxy();
assert.strictEqual(translations['pt-BR'].start, 'Iniciar', 'Proxy access works for pt-BR');
assert.strictEqual(translations['en-US'].start, 'Start', 'Proxy access works for en-US');
console.log('  ✓ TRANSLATIONS proxy style access works');

console.log('\n✅ All src module tests passed!');
