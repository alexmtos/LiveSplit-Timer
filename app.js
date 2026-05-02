/* ==================== CONFIGURATION ==================== */
console.log('[App] Loading app.js...');

// Note: For Node.js/testing environments, src/config.js provides modular config.
// For browser, we use inline CONFIG below.
const CONFIG = {
    WS_URL: 'ws://localhost:16834/livesplit',  // Porta correta do LiveSplit Server
    RECONNECT_DELAY: 1000,
    MAX_AUTO_RECONNECT_ATTEMPTS: 3,
    GRAPH_DRAW_THROTTLE: 16,
    RESIZE_DEBOUNCE: 150,
    CLICK_DISTANCE_THRESHOLD: 15,
    AUTO_SHOW_SETTINGS_ON_DISCONNECT: true
};

/* ==================== LOGGER ==================== */
class Logger {
    static _enabled = true;

    /**
     * Format timestamp
     * @returns {string}
     */
    static _getTimestamp() {
        return new Date().toISOString().split('T')[1].slice(0, -1);
    }

    /**
     * Format log message with prefix
     * @param {string} level - Log level
     * @param {string} prefix - Component prefix
     * @param {...any} args - Message args
     */
    static _format(level, prefix, ...args) {
        if (!this._enabled) { return; }

        const timestamp = this._getTimestamp();
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        const fullMessage = `[${timestamp}] [${level}]${prefix ? ` [${prefix}]` : ''} ${message}`;

        switch (level) {
            case 'debug':
                console.debug(fullMessage);
                break;
            case 'info':
                console.info(fullMessage);
                break;
            case 'warn':
                console.warn(fullMessage);
                break;
            case 'error':
                console.error(fullMessage);
                break;
            default:
                console.log(fullMessage);
        }
    }

    static debug(prefix, ...args) {
        this._format('DEBUG', prefix, ...args);
    }

    static info(prefix, ...args) {
        this._format('INFO', prefix, ...args);
    }

    static warn(prefix, ...args) {
        this._format('WARN', prefix, ...args);
    }

    static error(prefix, ...args) {
        this._format('ERROR', prefix, ...args);
    }

    /**
     * Enable/disable logging
     * @param {boolean} enabled
     */
    static setEnabled(enabled) {
        this._enabled = enabled;
    }
}

// Log reader para debugging do LiveSplit
// Internal LogReader implementation (no external module)
class LogReaderInternal {
    constructor() {
        this._connected = false;
        this._stats = { totalLogs: 0, lastLogAt: null, connected: false };
    }
    connect() {
        this._connected = true;
        this._stats.connected = true;
        return true;
    }
    getStats() {
        if (!this._connected) {
            throw new Error('LogReaderInternal not connected');
        }
        return { totalLogs: this._stats.totalLogs, lastLogAt: this._stats.lastLogAt, connected: true };
    }
}

// Internal singleton instance (not exposed as a public module)
let _logReaderInstance = null;

// Expose a stable, global API surface for UI/runtimes without relying on
// dynamic imports. This provides:
//  - window.logReader.connect()
//  - window.logReader.getStats()
// The internal implementation remains LogReaderInternal, eliminating any shadowing
// risks from re-declarations.
function _initializeLogReaderSingleton() {
    // Do not recreate if already initialized
    if (_logReaderInstance) {
        return _logReaderInstance;
    }
    _logReaderInstance = new LogReaderInternal();
    // Deterministic startup readiness: attempt immediate connect
    try {
        _logReaderInstance.connect();
    } catch (e) {
        console.error('[App] Error during LogReader startup:', e);
    }
    // Emit a custom event to signal readiness for external listeners (Strategy 2)
    if (typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent('logReaderReady', { detail: { reader: _logReaderInstance } }));
        } catch (e) {
            // Ignore if environment doesn't support events
        }
    }
    return _logReaderInstance;
}

// Build a tiny public wrapper surface around the internal singleton.
if (typeof window !== 'undefined') {
    window.logReader = {
        connect: function () {
            const inst = _initializeLogReaderSingleton();
            // The concrete connect is synchronous in this implementation, but keep a
            // promise-friendly surface for future changes.
            try {
                return inst.connect();
            } catch (e) {
                console.error('[App] LogReader connect failed:', e);
                return false;
            }
        },
        getStats: function () {
            // Ensure initialization happened before accessing stats
            const inst = _logReaderInstance || _initializeLogReaderSingleton();
            try {
                return inst.getStats();
            } catch (e) {
                console.error('[App] LogReader getStats failed:', e);
                return null;
            }
        }
    };
}

// Initialize on script load to satisfy deterministic readiness contract
_initializeLogReaderSingleton();

// Readiness gating for logReader API to avoid race conditions when UI code
// interacts with the log reader before it's fully initialized.
// We wrap the existing window.logReader with a Proxy that queues calls
// until the internal _logReaderInstance is ready. This preserves the public
// API surface while ensuring deterministic startup regardless of timing.
if (typeof window !== 'undefined' && window.logReader) {
    try {
        const originalLogReader = window.logReader;
        window.logReader = new Proxy(originalLogReader, {
            get(target, prop) {
                const value = target[prop];
                if (typeof value !== 'function') {
                    return value;
                }
                // Return a wrapper that defers execution until the internal reader is ready
                return function (...args) {
                    if (_logReaderInstance) {
                        try {
                            return value.apply(target, args);
                        } catch (e) {
                            // Propagate errors from the actual logReader method
                            throw e;
                        }
                    }
                    // Wait for readiness, then invoke
                    return new Promise((resolve, reject) => {
                        const interval = setInterval(() => {
                            if (_logReaderInstance) {
                                clearInterval(interval);
                                try {
                                    const res = value.apply(target, args);
                                    resolve(res);
                                } catch (err) {
                                    reject(err);
                                }
                            }
                        }, 5);
                    });
                };
            }
        });
    } catch (e) {
        console.warn('[App] Failed to apply logReader readiness gate:', e);
    }
}

// Backward-compatible alias for environments that may still reference a
// global LogReaderInternal (for debugging/testing only). Do not expose in prod
// runtime except for debugging; kept here to avoid breaking existing code paths.
if (typeof window !== 'undefined') {
    window.LogReaderInternal = LogReaderInternal;
}
if (typeof global !== 'undefined') {
    global.LogReaderInternal = LogReaderInternal;
}

/**
 * Inicializa o leitor de logs do LiveSplit
 */
function initializeLogReader() {
    try {
        // Verifica se estamos em ambiente browser
        if (typeof window !== 'undefined') {
            // Usar implementação interna para evitar carregamento dinâmico
            logReader = new LogReaderInternal();
            console.log('[App] Inicializando log reader (interno)...');
            if (logReader.connect()) {
                console.log('[App] Log reader conectado com sucesso (interno)!');
                // Envia comandos para obter dados de previsão, se houver API disponível
                setTimeout(() => {
                    if (connectionManager && connectionManager.isConnected && typeof connectionManager.getBestPossibleTime === 'function') {
                        console.log('[App] Solicitando dados de previsão...');
                        connectionManager.getBestPossibleTime();
                        setTimeout(() => {
                            if (typeof connectionManager.getPredictedTime === 'function') {
                                connectionManager.getPredictedTime();
                            }
                        }, 500);
                    }
                }, 1000);
            } else {
                console.log('[App] Não foi possível conectar ao log reader (interno)');
            }
        } else {
            console.log('[App] Log reader não disponível em ambiente browser');
        }
    } catch (error) {
        console.error('[App] Erro ao inicializar log reader:', error);
    }
}

/**
 * Obtém estatísticas do log reader
 */
function getLogReaderStats() {
    // Prefer global wrapper surface to avoid relying on private singleton
    try {
        return (window.logReader && typeof window.logReader.getStats === 'function')
            ? window.logReader.getStats()
            : null;
    } catch (e) {
        console.error('[App] getLogReaderStats failed:', e);
        return null;
    }
}

/* ==================== TRANSLATIONS ==================== */
const LANGUAGES = {
    'pt-BR': { name: 'Português (Brasil)', flag: '🇧🇷', code: 'pt-BR' },
    'en-US': { name: 'English (US)', flag: '🇺🇸', code: 'en-US' },
    'fr': { name: 'Français', flag: '🇫🇷', code: 'fr' },
    'de': { name: 'Deutsch', flag: '🇩🇪', code: 'de' },
    'es': { name: 'Español', flag: '🇪🇸', code: 'es' }
};


let currentLanguage = 'pt-BR';
let isBrowsingThemes = false;
let themeAutoReopenTimeout = null;

/**
 * Detect browser's preferred language
 * @returns {string} Language code (pt-BR, en-US, fr, de, es)
 */
function detectSystemLanguage() {
    const browserLang = navigator.language || navigator.userLanguage || 'pt-BR';
    // Map browser language codes to supported languages
    const langMap = {
        'pt-BR': 'pt-BR',
        'pt': 'pt-BR',
        'en-US': 'en-US',
        'en': 'en-US',
        'fr': 'fr',
        'fr-FR': 'fr',
        'de': 'de',
        'de-DE': 'de',
        'es': 'es',
        'es-ES': 'es',
        'es-MX': 'es'
    };
    return langMap[browserLang] || 'pt-BR';
}

/**
 * Update the language selector UI
 */
function updateLanguageSelector() {
    const lang = state.settings.language || currentLanguage;
    const langData = LANGUAGES[lang];
    const languageFlag = document.getElementById('language-flag');
    const languageCode = document.getElementById('language-code');

    if (languageFlag && languageCode && langData) {
        languageFlag.textContent = langData.flag;
        languageCode.textContent = langData.code;
    }

    // Update active state in dropdown
    document.querySelectorAll('.language-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.lang === lang) {
            option.classList.add('active');
        }
    });
}

/**
 * Initialize language on first load
 * Prioritizes saved user preference, then system language, defaults to Portuguese
 */
function initLanguage() {
    if (state.settings.language) {
        // User has a saved preference, use it
        currentLanguage = state.settings.language;
    } else {
        // First visit: detect system language
        currentLanguage = detectSystemLanguage();
        // Save the detected language as user's preference
        state.settings.language = currentLanguage;
        saveSettings();
    }
    applyTranslations();
    updateLanguageSelector();
}

/**
 * Get translation for current language
 * @param {string} key - Translation key
 * @returns {string} Translated text
 */
function translate(key) {
    const lang = state.settings.language || currentLanguage;
    const translations = (window.TRANSLATIONS && window.TRANSLATIONS[lang]) ? window.TRANSLATIONS[lang] : (TRANSLATIONS[lang] || {});

    if (translations[key]) {
        return translations[key];
    }

    // Fallback to Portuguese
    const fallback = (window.TRANSLATIONS && window.TRANSLATIONS['pt-BR']) ? window.TRANSLATIONS['pt-BR'] : (TRANSLATIONS['pt-BR'] || {});
    return fallback[key] || key;
}

/**
 * Set current language
 * @param {string} lang - Language code (pt-BR, en-US, fr, de, es)
 */
function setLanguage(lang) {
    if (LANGUAGES[lang]) {
        state.settings.language = lang;
        currentLanguage = lang;
        saveSettings();
        applyTranslations();
    }
}

/**
 * Apply translations to all translatable elements
 */
function applyTranslations() {
    // Settings modal title
    const settingsTitle = document.querySelector('.modal-title');
    if (settingsTitle) {
        settingsTitle.textContent = translate('settings_title');
    }

    // Settings modal close button
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.title = translate('settings_close');
    }

    // Connection section
    const connectionTitle = document.querySelector('.connection-section .settings-section-title');
    if (connectionTitle) {
        connectionTitle.textContent = translate('connection_title');
    }

    const connectionLabels = document.querySelectorAll('.connection-label');
    if (connectionLabels.length >= 2) {
        connectionLabels[0].textContent = translate('connection_ip');
        connectionLabels[1].textContent = translate('connection_port');
    }

    const testButton = document.getElementById('test-connection');
    if (testButton) {
        testButton.textContent = translate('connection_test');
    }

    // Theme section
    const themeTitle = document.querySelector('.theme-section .settings-section-title');
    if (themeTitle) {
        themeTitle.textContent = translate('theme_title');
    }

    const transparentOption = document.querySelector('.chroma-key-option');
    if (transparentOption) {
        const optionTitle = transparentOption.querySelector('.option-title');
        const optionDesc = transparentOption.querySelector('.option-description');
        if (optionTitle) { optionTitle.textContent = translate('theme_transparent'); }
        if (optionDesc) { optionDesc.textContent = translate('theme_transparent_desc'); }
    }

    // Display section
    const displayTitle = document.querySelector('.display-section .settings-section-title');
    if (displayTitle) {
        displayTitle.textContent = translate('display_title');
    }

    const displayOptions = document.querySelectorAll('.display-section .display-option');
    if (displayOptions.length >= 4) {
        const titles = displayOptions[0].querySelectorAll('.option-title, .option-description');
        if (titles[0]) { titles[0].textContent = translate('display_controls'); }
        if (titles[1]) { titles[1].textContent = translate('display_controls_desc'); }

        const graphTitles = displayOptions[1].querySelectorAll('.option-title, .option-description');
        if (graphTitles[0]) { graphTitles[0].textContent = translate('display_graph'); }
        if (graphTitles[1]) { graphTitles[1].textContent = translate('display_graph_desc'); }

        const tableTitles = displayOptions[2].querySelectorAll('.option-title, .option-description');
        if (tableTitles[0]) { tableTitles[0].textContent = translate('display_table'); }
        if (tableTitles[1]) { tableTitles[1].textContent = translate('display_table_desc'); }

        const expandedTitles = displayOptions[3].querySelectorAll('.option-title, .option-description');
        if (expandedTitles[0]) { expandedTitles[0].textContent = translate('display_expanded'); }
        if (expandedTitles[1]) { expandedTitles[1].textContent = translate('display_expanded_desc'); }
    }

    // Error notification
    const errorNotificationTitle = document.querySelector('.error-notification-title');
    if (errorNotificationTitle) {
        errorNotificationTitle.textContent = translate('error_notification_title');
    }

    const errorNotificationText = document.querySelector('.error-notification-text');
    if (errorNotificationText) {
        const intro = translate('error_notification_text');
        const li1 = translate('error_notification_1');
        const li2 = translate('error_notification_2');
        const li3 = translate('error_notification_3');
        const li4 = translate('error_notification_4');
        errorNotificationText.innerHTML = `${intro}<ul><li>${li1}</li><li>${li2}</li><li>${li3}</li><li>${li4}</li></ul>`;
    }

    // Export section
    const exportTitle = document.querySelector('.export-section .settings-section-title');
    if (exportTitle) {
        exportTitle.textContent = translate('export_title');
    }

    const exportInfoTitle = document.querySelector('.export-info-title');
    if (exportInfoTitle) {
        exportInfoTitle.textContent = translate('export_save');
    }

    const exportInfoDesc = document.querySelector('.export-info-description');
    if (exportInfoDesc) {
        exportInfoDesc.textContent = translate('export_desc');
    }

    const exportImageBtn = document.getElementById('export-image');
    if (exportImageBtn) {
        const imageText = exportImageBtn.querySelector('.export-button-text');
        if (imageText) {
            imageText.textContent = translate('export_image');
        }
        exportImageBtn.title = translate('export_image_title');
    }

    const exportTextBtn = document.getElementById('export-text');
    if (exportTextBtn) {
        const csvText = exportTextBtn.querySelector('.export-button-text');
        if (csvText) {
            csvText.textContent = translate('export_csv');
        }
        exportTextBtn.title = translate('export_csv_title');
    }

    // Reset section
    const resetTitle = document.querySelector('.reset-section .settings-section-title');
    if (resetTitle) {
        resetTitle.textContent = translate('reset_title');
    }

    const resetWarning = document.querySelector('.reset-warning p');
    if (resetWarning) {
        resetWarning.textContent = translate('reset_warning_text');
    }

    const resetButton = document.getElementById('modal-reset');
    if (resetButton) {
        resetButton.textContent = translate('reset_button');
    }

    // Version and credits
    const versionText = document.querySelector('.version');
    if (versionText) {
        const version = (window.APP_CONFIG && window.APP_CONFIG.VERSION) || '0.0.1';
        versionText.textContent = `${translate('version_label')} ${version}`;
    }

    const credits = document.querySelector('.credits');
    if (credits) {
        credits.innerHTML = translate('made_with_full');
    }

    // Timer controls
    const startBtn = document.getElementById('btn-start-split');
    if (startBtn) { startBtn.setAttribute('aria-label', translate('btn_start')); }

    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) { pauseBtn.setAttribute('aria-label', translate('btn_pause')); }

    const skipBtn = document.getElementById('btn-skip');
    if (skipBtn) { skipBtn.setAttribute('aria-label', translate('btn_skip')); }

    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) { undoBtn.setAttribute('aria-label', translate('btn_undo')); }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) { resetBtn.setAttribute('aria-label', translate('btn_reset')); }

    // PB display
    const pbDisplay = document.getElementById('pb-display');
    if (pbDisplay) {
        pbDisplay.textContent = `${translate('pb_display')}: -`;
    }
}

/* ==================== CONSTANTES ==================== */
const THEMES = {
    default: { name: 'Default', colors: ['#00a2ff', '#40ff40', '#ff4040'] },
    dark: { name: 'Escuro', colors: ['#4a4a4a', '#6a6a6a', '#8a8a8a'] },
    purple: { name: 'Roxo', colors: ['#8a2be2', '#da70d6', '#ff69b4'] },
    orange: { name: 'Laranja', colors: ['#ff8c00', '#ffd700', '#ff4500'] },
    retro: { name: 'Retro', colors: ['#00ffff', '#00ff00', '#ff00ff'] },
    blue: { name: 'Azul', colors: ['#4dabf7', '#51cf66', '#ff6b6b'] },
    green: { name: 'Verde', colors: ['#38b000', '#70e000', '#ff595e'] },
    pink: { name: 'Rosa', colors: ['#ff6b9d', '#a0e7a0', '#ff9a9e'] },
    matrix: { name: 'Matrix', colors: ['#00ff41', '#00ff41', '#ff0040'] },
    sunset: { name: 'Sunset', colors: ['#ff9a76', '#a8e6cf', '#ff6f91'] },
    midnight: { name: 'Midnight', colors: ['#6c5ce7', '#00cec9', '#fd79a8'] }
};

const THEME_COLORS = {
    default: { bg: '#050505', text: '#888', accent: '#00a2ff' },
    dark: { bg: '#0a0a0a', text: '#666', accent: '#4a4a4a' },
    purple: { bg: '#0a050f', text: '#a882d8', accent: '#8a2be2' },
    orange: { bg: '#0f0a05', text: '#d8a882', accent: '#ff8c00' },
    retro: { bg: '#000000', text: '#808080', accent: '#00ffff' },
    blue: { bg: '#0d1b2a', text: '#778da9', accent: '#4dabf7' },
    green: { bg: '#0a1f0a', text: '#8ac926', accent: '#38b000' },
    pink: { bg: '#1a0a14', text: '#f48fb1', accent: '#ff6b9d' },
    matrix: { bg: '#000000', text: '#008f11', accent: '#00ff41' },
    sunset: { bg: '#1a0f2e', text: '#d4a5a5', accent: '#ff9a76' },
    midnight: { bg: '#00072d', text: '#5465ff', accent: '#6c5ce7' }
};

/* ==================== ESTADO GLOBAL ==================== */
const state = {
    timerState: 'NotRunning',
    lastTime: 0,
    lastTs: performance.now(),
    currentDelta: 0,
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    runData: null,
    manualDisconnect: false,
    graphData: null,
    selectedGraphPointIdx: null,
    selectedSplitIdx: null,
    expandedSections: new Set(),
    hasIcons: false,
    isRunEnded: false,
    runEndedAt: null,
    lastActiveIdx: -1,
    lastActiveSection: '',
    settings: {
        language: 'pt-BR',
        theme: 'default',
        showGraph: true,
        showTable: true,
        showControls: true,
        alwaysExpandedSplits: false,
        wsUrl: CONFIG.WS_URL,
        chromaKey: {
            enabled: false
        },
        worldRecordGameId: '',
        worldRecordCategoryId: ''
    },
    showConnectionError: false,
    graphAnimationFrame: null,
    canvasClickHandler: null,
    lastGraphDrawTime: null,
    worldRecordTime: null,
    worldRecordLoading: false
};

const domCache = {};
let resizeTimeout;
let lastGraphDraw = 0;
let connectionMonitorInterval = null;

/* ==================== UTILITÁRIOS ==================== */
const SECTION_REGEX = /\{([^}]*)\}/;
const SECTION_FULL_REGEX = /\{([^}]*)\}\s*(.*)/;

class DOM {
    /**
     * Get element from DOM with caching
     * @param {string} id - Element ID
     * @returns {any} - DOM element or null
     */
    static get(id) {
        if (!domCache[id]) {
            const el = document.getElementById(id);
            if (!el) { Logger.warn('DOM', `Element not found: ${id}`); }
            domCache[id] = el;
        }
        return domCache[id];
    }

    static extractSectionName(name) {
        if (!name || typeof name !== 'string') { return null; }
        const match = name.match(SECTION_REGEX);
        return match ? match[1] : null;
    }

    static showError(message) {
        Logger.error('DOM', message);
        // Show themed toast with error styling
        const currentTheme = state.settings.theme || 'default';
        const themeColors = THEME_COLORS[currentTheme] || THEME_COLORS.default;
        showToastWithTheme(message, themeColors.accent, themeColors.bg, themeColors.text);
    }

    static showSuccess(message) {
        Logger.info('DOM', message);
        // Show themed toast
        const currentTheme = state.settings.theme || 'default';
        const themeColors = THEME_COLORS[currentTheme] || THEME_COLORS.default;
        showToastWithTheme(message, themeColors.accent, themeColors.bg, themeColors.text);
    }
}

let toastTimeout = null;
let settingsModalTimeout = null;

/**
 * Show toast notification at bottom of screen
 * @param {string} message - Message to display
 * @param {number} [duration] - Duration in ms (default: 3000)
 */
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) {
        return;
    }

    // Clear existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    // Apply current theme colors to toast
    const currentTheme = state.settings.theme || 'default';
    const themeColors = THEME_COLORS[currentTheme] || THEME_COLORS.default;

    toast.style.setProperty('--theme-bg', themeColors.bg);
    toast.style.setProperty('--theme-text', themeColors.text);
    toast.style.setProperty('--theme-accent', themeColors.accent);

    // Set message and show
    toastMessage.textContent = message;
    toast.classList.add('show');

    // Hide after duration
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeout = null;
    }, duration);
}

/**
 * Show toast notification with custom theme colors
 * @param {string} message - Message to display
 * @param {string} accentColor - Accent color for the toast
 * @param {string} bgColor - Background color for the toast
 * @param {string} textColor - Text color for the toast
 * @param {number} [duration] - Duration in ms (default: 3000)
 */
function showToastWithTheme(message, accentColor, bgColor, textColor, duration = 3000) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) {
        return;
    }

    // Clear existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    // Apply custom theme colors to toast
    toast.style.setProperty('--theme-bg', bgColor);
    toast.style.setProperty('--theme-text', textColor);
    toast.style.setProperty('--theme-accent', accentColor);

    // Set message and show
    toastMessage.textContent = message;
    toast.classList.add('show');

    // Hide after duration
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeout = null;
    }, duration);
}

/**
 * Hide toast notification immediately
 */
function hideToast() {
    const toast = document.getElementById('toast-notification');
    if (toast) {
        toast.classList.remove('show');
    }
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
}

/**
 * Hide modal temporarily and show toast notification
 * @param {string} message - Toast message
 */
function hideModalWithToast(message) {
    // Stop any pending theme browse timeouts
    isBrowsingThemes = false;
    if (settingsModalTimeout) {
        clearTimeout(settingsModalTimeout);
        settingsModalTimeout = null;
    }
    if (themeAutoReopenTimeout) {
        clearTimeout(themeAutoReopenTimeout);
        themeAutoReopenTimeout = null;
    }

    hideSettingsModal();
    showToast(message);
    settingsModalTimeout = setTimeout(() => {
        showSettingsModal();
        hideToast();
        settingsModalTimeout = null;
    }, 3000);
}

class TimeUtils {
    static formatSplit(ms) {
        if (ms === null || ms === undefined) { return '-'; }
        const a = Math.abs(ms);

        const days = Math.floor(a / 86400000);
        const hours = Math.floor((a % 86400000) / 3600000);
        const minutes = Math.floor((a % 3600000) / 60000);
        const seconds = Math.floor((a % 60000) / 1000);
        const centiseconds = Math.floor((a % 1000) / 10);

        if (days > 0) {
            return `${days}d${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        } else if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        } else if (minutes > 0) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
        }
        return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;

    }

    static formatTimer(ms) {
        const a = Math.abs(ms || 0);

        const days = Math.floor(a / 86400000);
        const hours = Math.floor((a % 86400000) / 3600000);
        const minutes = Math.floor((a % 3600000) / 60000);
        const seconds = Math.floor((a % 60000) / 1000);
        const centiseconds = Math.floor((a % 1000) / 10);

        let timePart;
        if (days > 0) {
            timePart = `${days}d${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (hours > 0) {
            timePart = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (minutes > 0) {
            timePart = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            timePart = `${seconds}`;
        }

        return {
            timePart,
            msPart: centiseconds.toString().padStart(2, '0')
        };
    }

    /**
     * Converte tempo do LiveSplit de string para milissegundos
     * @param {string} timeString - Tempo formatado do LiveSplit
     * @returns {number|null} - Tempo em milissegundos
     */
    static parseLiveSplitTime(timeString) {
        if (!timeString || timeString === '-') { return null; }

        // Formato esperado: "1:23.45" ou "1d2:34:56.78"
        const timeParts = timeString.split('.');
        if (timeParts.length !== 2) { return null; }

        const mainPart = timeParts[0];
        const csPart = timeParts[1];

        let totalMs = 0;

        // Processa dias, horas, minutos, segundos
        const mainTimeParts = mainPart.split(':');

        if (mainTimeParts.length === 1) {
            // Apenas segundos
            totalMs = parseFloat(mainTimeParts[0]) * 1000;
        } else if (mainTimeParts.length === 2) {
            // Minutos:segundos
            totalMs = parseFloat(mainTimeParts[0]) * 60000 + parseFloat(mainTimeParts[1]) * 1000;
        } else if (mainTimeParts.length === 3) {
            // Horas:minutos:segundos
            totalMs = parseFloat(mainTimeParts[0]) * 3600000 +
                parseFloat(mainTimeParts[1]) * 60000 +
                parseFloat(mainTimeParts[2]) * 1000;
        } else if (mainTimeParts.length === 4) {
            // Dias:horas:minutos:segundos
            totalMs = parseFloat(mainTimeParts[0]) * 86400000 +
                parseFloat(mainTimeParts[1]) * 3600000 +
                parseFloat(mainTimeParts[2]) * 60000 +
                parseFloat(mainTimeParts[3]) * 1000;
        }

        // Adiciona centissegundos
        const cs = parseFloat(csPart);
        if (!isNaN(cs)) {
            totalMs += cs * 10; // centiseconds para ms
        }

        return totalMs;
    }

    static formatDelta(ms) {
        if (ms === undefined || ms === null) { return '-'; }

        const a = Math.abs(ms);
        const sign = ms >= 0 ? '+' : '-';

        const days = Math.floor(a / 86400000);
        const hours = Math.floor((a % 86400000) / 3600000);
        const minutes = Math.floor((a % 3600000) / 60000);
        const seconds = Math.floor((a % 60000) / 1000);
        const deciseconds = Math.floor((a % 1000) / 100);

        if (days > 0) {
            return `${sign}${days}d${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (hours > 0) {
            return `${sign}${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (minutes > 0) {
            return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}.${deciseconds.toString().padStart(1, '0')}`;
        }
        return `${sign}${seconds}.${deciseconds.toString().padStart(1, '0')}`;
    }

    /**
     * Converte tempo do LiveSplit de string para milissegundos
     * @param {string} timeString - Tempo formatado do LiveSplit
     * @returns {number|null} - Tempo em milissegundos
     */
    static parseLiveSplitTime(timeString) {
        if (!timeString || timeString === '-') { return null; }

        // Formato esperado: "1:23.45" ou "1d2:34:56.78"
        const timeParts = timeString.split('.');
        if (timeParts.length !== 2) { return null; }

        const mainPart = timeParts[0];
        const csPart = timeParts[1];

        let totalMs = 0;

        // Processa dias, horas, minutos, segundos
        const mainTimeParts = mainPart.split(':');

        if (mainTimeParts.length === 1) {
            // Apenas segundos
            totalMs = parseFloat(mainTimeParts[0]) * 1000;
        } else if (mainTimeParts.length === 2) {
            // Minutos:segundos
            totalMs = parseFloat(mainTimeParts[0]) * 60000 + parseFloat(mainTimeParts[1]) * 1000;
        } else if (mainTimeParts.length === 3) {
            // Horas:minutos:segundos
            totalMs = parseFloat(mainTimeParts[0]) * 3600000 +
                parseFloat(mainTimeParts[1]) * 60000 +
                parseFloat(mainTimeParts[2]) * 1000;
        } else if (mainTimeParts.length === 4) {
            // Dias:horas:minutos:segundos
            totalMs = parseFloat(mainTimeParts[0]) * 86400000 +
                parseFloat(mainTimeParts[1]) * 3600000 +
                parseFloat(mainTimeParts[2]) * 60000 +
                parseFloat(mainTimeParts[3]) * 1000;
        }

        // Adiciona centissegundos
        const cs = parseFloat(csPart);
        if (!isNaN(cs)) {
            totalMs += cs * 10; // centiseconds para ms
        }

        return totalMs;
    }

    /**
     * Calcula o tempo previsto com base no progresso atual
     * @param {Object} runData - Dados da run do LiveSplit
     * @param {number} currentTime - Tempo atual em milissegundos
     * @param {number} currentSplitIndex - Índice do split atual
     * @returns {number|null} - Tempo previsto em milissegundos
     */
    static calculatePredictedTime(runData, currentTime, currentSplitIndex) {
        if (!runData?.run?.segments) { return null; }

        const segments = runData.run.segments;
        let predictedTime = currentTime || 0;

        // Para tempo previsto, somamos o tempo ATUAL com os segmentos RESTANTES
        const startIndex = currentSplitIndex >= 0 ? currentSplitIndex + 1 : 0;

        for (let i = startIndex; i < segments.length; i++) {
            const segment = segments[i];
            const pbTime = segment?.comparisons?.['Personal Best']?.realTime;

            if (typeof pbTime === 'number' && pbTime > 0) {
                predictedTime += pbTime;
            }
        }

        return predictedTime;
    }

    /**
     * Calcula o tempo previsto com base na performance atual (delta acumulado)
     * @param {Object} runData - Dados da run do LiveSplit
     * @param {number} currentTime - Tempo atual em milissegundos
     * @param {number} currentDelta - Delta atual em milissegundos
     * @param {number} currentSplitIndex - Índice do split atual
     * @returns {number|null} - Tempo previsto baseado na performance em milissegundos
     */
    static calculatePerformancePredictedTime(runData, currentTime, currentDelta, currentSplitIndex) {
        if (!runData?.run?.segments) { return null; }

        const segments = runData.run.segments;
        let predictedTime = currentTime || 0;

        // Usa o delta atual para prever splits futuros
        for (let i = (currentSplitIndex >= 0 ? currentSplitIndex + 1 : 0); i < segments.length; i++) {
            const segment = segments[i];
            const pbTime = segment?.comparisons?.['Personal Best']?.realTime;

            if (typeof pbTime === 'number' && pbTime > 0) {
                // Ajusta com base na performance atual
                const adjustedTime = pbTime + (currentDelta || 0);
                predictedTime += Math.max(0, adjustedTime);
            }
        }

        return predictedTime;
    }
}

/**
 * World Record Loader - Fetches world record times from speedrun.com API
 * Uses gameId and categoryId directly when available
 * @class
 */
class WorldRecordLoader {
    static API_BASE = 'https://www.speedrun.com/api/v1';
    static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    static CACHE_KEY = 'ls_world_record_cache';

    /**
     * Parse ISO 8601 Duration format (e.g., "PT1H23M45S") to milliseconds
     * @param {string} timeString - ISO 8601 Duration string
     * @returns {number|null} Time in milliseconds or null if invalid
     */
    static parseTimeToMs(timeString) {
        if (!timeString || typeof timeString !== 'string') {
            return null;
        }

        try {
            // Handle ISO 8601 Duration format from speedrun.com (e.g., "PT1H23M45S")
            // Format: P[n]Y[n]M[n]DT[n]H[n]M[n]S
            if (timeString.startsWith('PT')) {
                const isoString = timeString.slice(2); // Remove "PT"
                let hours = 0, minutes = 0, seconds = 0;

                // Extract hours
                const hourMatch = isoString.match(/(\d+)H/);
                if (hourMatch) {
                    hours = parseInt(hourMatch[1], 10);
                }

                // Extract minutes
                const minuteMatch = isoString.match(/(\d+)M/);
                if (minuteMatch) {
                    minutes = parseInt(minuteMatch[1], 10);
                }

                // Extract seconds
                const secondMatch = isoString.match(/(\d+(?:\.\d+)?)S/);
                if (secondMatch) {
                    seconds = parseFloat(secondMatch[1]);
                }

                return (hours * 3600 + minutes * 60 + seconds) * 1000;
            }

            // Handle standard colon format (e.g., "1:23:45", "23:45.678")
            const parts = timeString.split(':');

            if (parts.length === 3) {
                // Format: H:MM:SS.sss
                const hours = parseInt(parts[0], 10);
                const minutes = parseInt(parts[1], 10);
                const seconds = parseFloat(parts[2]);
                return (hours * 3600 + minutes * 60 + seconds) * 1000;
            } else if (parts.length === 2) {
                // Format: M:SS.sss
                const minutes = parseInt(parts[0], 10);
                const seconds = parseFloat(parts[1]);
                return (minutes * 60 + seconds) * 1000;
            } else if (parts.length === 1) {
                // Format: SS.sss
                return parseFloat(parts[0]) * 1000;
            }

            return null;
        } catch (error) {
            console.warn('[WorldRecordLoader] Failed to parse time:', timeString, error);
            return null;
        }
    }

    /**
     * Format milliseconds to display string
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time string
     */
    static formatTime(ms) {
        return TimeUtils.formatSplit(ms);
    }

    /**
     * Get cached world record data
     * @returns {Object|null} Cached data or null if expired/not found
     */
    static getCachedData() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                const now = Date.now();

                if (now - data.timestamp < this.CACHE_DURATION) {
                    console.log('[WorldRecordLoader] Using cached world record');
                    return data;
                }
                console.log('[WorldRecordLoader] Cache expired, will fetch fresh data');
            }
        } catch (error) {
            console.warn('[WorldRecordLoader] Failed to read cache:', error);
        }
        return null;
    }

    /**
     * Cache world record data
     * @param {Object} data - World record data to cache
     */
    static cacheData(data) {
        try {
            const cacheData = {
                ...data,
                timestamp: Date.now()
            };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('[WorldRecordLoader] Failed to cache data:', error);
        }
    }

    /**
     * Fetch world record from speedrun.com API using gameId and categoryId
     * @param {string} gameId - Game ID from speedrun.com
     * @param {string} categoryId - Category ID from speedrun.com
     * @param {Object|null} [variables] - Custom variable filters (optional, e.g., { "varId1": "val1", "varId2": "val2" })
     * @returns {Promise<Object>} World record data with time and player info
     */
    static async fetchWorldRecord(gameId, categoryId, variables = null) {
        if (!gameId || !categoryId) {
            console.warn('[WorldRecordLoader] Missing gameId or categoryId', { gameId, categoryId });
            return { error: 'Missing gameId or categoryId' };
        }

        console.log('[WorldRecordLoader] fetchWorldRecord called with:', { gameId, categoryId, variables });

        // Build query params for filters
        const queryParams = ['top=1', 'embed=players'];
        // Emulator filter removed - get all runs regardless of emulator
        if (variables && typeof variables === 'object') {
            for (const [varId, valueId] of Object.entries(variables)) {
                if (varId && valueId) {
                    queryParams.push(`var-${varId}=${valueId}`);
                }
            }
        }

        const queryString = queryParams.join('&');
        const url = `${this.API_BASE}/leaderboards/${gameId}/category/${categoryId}?${queryString}`;

        console.log('[WorldRecordLoader] API URL:', url);

        // Check cache first (include filters in cache key)
        const cached = this.getCachedData();
        if (cached &&
            cached.gameId === gameId &&
            cached.categoryId === categoryId &&
            JSON.stringify(cached.variables) === JSON.stringify(variables)) {
            return cached;
        }

        console.log(`[WorldRecordLoader] Fetching world record for game: ${gameId}, category: ${categoryId}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('[WorldRecordLoader] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[WorldRecordLoader] API error:', response.status, errorText);

                if (response.status === 404) {
                    return { error: 'Game or category not found on speedrun.com' };
                }
                if (response.status === 420) {
                    return { error: 'Rate limit exceeded. Please try again later.' };
                }
                return { error: `API error: ${response.status}` };
            }

            const data = await response.json();

            if (!data.data || !data.data.runs || data.data.runs.length === 0) {
                console.warn('[WorldRecordLoader] No runs found in leaderboard');
                return { error: 'No runs found in leaderboard' };
            }

            // Get first place run
            const firstPlace = data.data.runs[0];
            const run = firstPlace.run;
            const primaryTime = run.times?.primary;

            if (!primaryTime) {
                console.warn('[WorldRecordLoader] No time data in run');
                return { error: 'No time data in run' };
            }

            // Parse time to milliseconds
            const timeMs = this.parseTimeToMs(primaryTime);

            // Get player name(s)
            let playerName = 'Unknown';
            if (run.players && run.players.length > 0) {
                const playersData = data.data.players?.data || [];
                const playerIds = run.players.map(p => p.id);
                const player = playersData.find(p => playerIds.includes(p.id));

                if (player) {
                    playerName = player.name || player.names?.international || 'Unknown';
                }
            }

            const result = {
                timeMs: timeMs,
                timeString: primaryTime,
                formattedTime: timeMs ? this.formatTime(timeMs) : primaryTime,
                player: playerName,
                gameId: gameId,
                categoryId: categoryId,
                variables: variables,
                platform: run.platform || null,
                date: run.date || null,
                url: run.weblink || null,
                error: null
            };

            // Cache the result
            this.cacheData(result);

            console.log('[WorldRecordLoader] World record loaded:', result);
            return result;

        } catch (error) {
            console.error('[WorldRecordLoader] Failed to fetch world record:', error);
            return { error: error.message || 'Failed to fetch world record' };
        }
    }

    /**
     * Load world record using gameId and categoryId directly
     * @param {string} gameId - Game ID from speedrun.com
     * @param {string} categoryId - Category ID from speedrun.com
     * @param {Object|null} [variables] - Custom variable filters (optional)
     * @returns {Promise<Object>} World record data
     */
    static async load(gameId, categoryId, variables = null) {
        state.worldRecordLoading = true;
        updateWorldRecordDisplay();

        const result = await this.fetchWorldRecord(gameId, categoryId, variables);

        if (result.error) {
            state.worldRecordTime = null;
            console.warn('[WorldRecordLoader] Failed to load:', result.error);
        } else {
            state.worldRecordTime = result;
        }

        state.worldRecordLoading = false;
        updateWorldRecordDisplay();

        return result;
    }
}

/**
 * Update world record display in UI
 */
function updateWorldRecordDisplay() {
    const wrDisplay = DOM.get('wr-display');

    if (!wrDisplay) {
        return;
    }

    if (state.worldRecordLoading) {
        wrDisplay.textContent = `${translate('wr_loading')}`;
        wrDisplay.classList.add('loading');
        return;
    }

    wrDisplay.classList.remove('loading');

    if (state.worldRecordTime && state.worldRecordTime.error) {
        wrDisplay.textContent = `${translate('wr_display')}: -`;
        wrDisplay.title = translate('wr_not_found');
        wrDisplay.style.cursor = 'default';
        wrDisplay.onclick = null;
    } else if (state.worldRecordTime) {
        const wr = state.worldRecordTime;
        const formattedTime = wr.formattedTime || TimeUtils.formatSplit(wr.timeMs);
        const player = wr.player || 'Unknown';

        // Ex: WR: 1:23:45 by Player
        wrDisplay.textContent = `${translate('wr_display')}: ${formattedTime} ${translate('wr_by') || 'by'} ${player}`;

        // Tooltip with link info
        const tooltip = translate('tooltip_wr').replace('{0}', formattedTime).replace('{1}', player);
        const clickHint = translate('tooltip_wr_click');
        wrDisplay.title = `${tooltip}${wr.url ? '\n' + clickHint : ''}`;

        if (wr.url) {
            wrDisplay.style.cursor = 'pointer';
            wrDisplay.onclick = () => window.open(wr.url, '_blank');
        } else {
            wrDisplay.style.cursor = 'default';
            wrDisplay.onclick = null;
        }
    } else {
        wrDisplay.textContent = `${translate('wr_display')}: -`;
        wrDisplay.title = '';
        wrDisplay.style.cursor = 'default';
        wrDisplay.onclick = null;
    }
}

/**
 * Initialize world record loader with saved settings or auto-detect from WebSocket
 */
function initWorldRecord() {
    // First try saved settings (explicit configuration)
    const savedSettings = localStorage.getItem('livesplit-settings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            const gameId = settings.worldRecordGameId;
            const categoryId = settings.worldRecordCategoryId;

            if (gameId && categoryId) {
                console.log('[WorldRecord] Loading with saved IDs');
                WorldRecordLoader.load(gameId, categoryId);
                return;
            }
        } catch (error) {
            console.warn('[WorldRecord] Failed to load saved settings:', error);
        }
    }

    // Try to auto-detect from WebSocket run data
    loadWorldRecordFromRunData();
}

/**
 * Load world record for current run data from WebSocket
 * Uses IDs directly from run.metadata
 */
function loadWorldRecordFromRunData() {
    if (!state.runData) {
        return;
    }

    const gameId = state.runData.gameId || state.settings.worldRecordGameId;
    const categoryId = state.runData.categoryId || state.settings.worldRecordCategoryId;
    // Emulator filter removed from WR API
    const variables = state.runData.variables || null;

    if (gameId && categoryId) {
        console.log('[WorldRecord] Loading WR with filters:', { gameId, categoryId, variables });
        WorldRecordLoader.load(gameId, categoryId, variables);
    } else {
        console.log('[WorldRecord] No gameId/categoryId available for WR lookup');
    }
}

/* ==================== CONNECTION MANAGER ==================== */
class ConnectionManager {
    constructor() {
        this.ws = null;
        this.connectionTimeout = null;
        this.healthCheckInterval = null;
        this.lastMessageTime = null;
        this.isManualDisconnect = false;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000;
        this.connectionState = 'disconnected';
        this.pendingMessages = [];
        this.worldRecordTimeout = null;
        this.connectionId = 0; // Track current connection to ignore old close events

        this.autoReconnect = true;
        this.showSettingsOnDisconnect = true;
        this.connectionTimeoutMs = 5000;
        this.healthCheckIntervalMs = 30000;
    }

    // ==================== INICIALIZAÇÃO ====================
    init() {
        console.log('[ConnectionManager] Initializing ConnectionManager');
        this.setupHealthCheck();
        this.setupPageEvents();
        this.setupEventListeners();
        this.loadSettings();
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('livesplit-settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (parsed.wsUrl) {
                    CONFIG.WS_URL = parsed.wsUrl;
                }
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }

    setupPageEvents() {
        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    setupEventListeners() {
        const testButton = document.getElementById('test-connection');
        if (testButton) {
            testButton.addEventListener('click', () => this.handleTestConnection());
        }
    }

    setupHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckIntervalMs);
    }

    // ==================== CONEXÃO PRINCIPAL ====================
    connect(url = null) {
        const targetUrl = url || state.settings.wsUrl || CONFIG.WS_URL;

        // Já conectado - verificar se é a mesma URL
        if (this.connectionState === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const currentUrl = this.ws.url;
            if (currentUrl === targetUrl) {
                console.log('[ConnectionManager] Already connected to this URL');
                return;
            }
            // URL diferente, desconectar para reconectar
            console.log('[ConnectionManager] URL changed, reconnecting...');
            this.disconnect('URL changed');
        } else if (this.ws) {
            // Não está conectado mas tem ws, fechar antes de criar novo
            this.disconnect('Creating new connection');
        }

        if (url && url !== state.settings.wsUrl) {
            state.settings.wsUrl = url;
            CONFIG.WS_URL = url;
            saveSettings();
        }

        console.log(`[ConnectionManager] Connecting to: ${targetUrl}`);
        this.updateConnectionState('connecting');
        this.showConnectingMessage(targetUrl.replace('ws://', ''));

        try {
            // Increment connection ID to track this connection
            this.connectionId++;
            const currentConnectionId = this.connectionId;

            // Close existing WebSocket if any, before creating new one
            if (this.ws) {
                console.log('[ConnectionManager] Closing existing WebSocket before creating new one');
                this.isManualDisconnect = true;
                this.ws.close();
                this.ws = null;
                this.isManualDisconnect = false;
            }

            this.ws = new WebSocket(targetUrl);

            this.connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                    console.warn('[ConnectionManager] Connection timeout');
                    this.ws.close();
                    this.handleConnectionError('Connection timeout');
                }
            }, this.connectionTimeoutMs);

            this.ws.onopen = () => this.handleOpen(currentConnectionId);
            this.ws.onmessage = (e) => this.handleMessage(e);
            this.ws.onerror = (err) => this.handleError(err);
            this.ws.onclose = () => this.handleClose(currentConnectionId);

        } catch (error) {
            console.error('[ConnectionManager] Failed to create WebSocket:', error);
            this.handleConnectionError(`Error: ${error.message}`);
        }
    }

    // ==================== HANDLERS DE EVENTOS WEBSOCKET ====================
    handleOpen(connectionId) {
        // Ignore if this connection is already obsolete
        if (connectionId !== this.connectionId) {
            console.log('[ConnectionManager] Ignoring handleOpen for obsolete connection');
            return;
        }

        console.log('[ConnectionManager] WebSocket connection opened');
        clearTimeout(this.connectionTimeout);

        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.isManualDisconnect = false;
        this.lastMessageTime = Date.now();

        this.updateConnectionState('connected');

        this.flushPendingMessages();

        state.isConnected = true;
        state.isConnecting = false;
        updateControlButtons();

        const errorNotification = document.getElementById('error-notification');
        if (errorNotification) {
            errorNotification.classList.remove('show');
        }
    }

    disconnect(reason = 'Manual disconnect') {
        console.log(`[ConnectionManager] Disconnecting: ${reason}`);

        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        // Set isManualDisconnect to prevent handleClose from scheduling a reconnect
        this.isManualDisconnect = true;

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Reset for next connection
        this.isManualDisconnect = false;

        this.connectionState = 'disconnected';
        state.isConnected = false;
        state.isConnecting = false;

        this.updateConnectionState('disconnected');
        updateControlButtons();
    }

    handleMessage(event) {
        this.lastMessageTime = Date.now();

        try {
            // Tenta parsear como JSON primeiro (para backward compatibility)
            let data, timerData;

            try {
                data = JSON.parse(event.data);
                timerData = data.state || data;
            } catch (jsonError) {
                // Se falhar, trata como texto puro do LiveSplit Server
                const message = event.data.trim();

                // Verifica se é resposta de previsão
                if (this.lastCommand === 'getbestpossibletime') {
                    handlePredictionResponse(message, 'bestPossible');
                    return;
                } else if (this.lastCommand === 'getpredictedtime Personal Best') {
                    handlePredictionResponse(message, 'predicted');
                    return;
                }

                // Se não for previsão, ignora (mantém comportamento existente)
                console.log('[ConnectionManager] Ignoring non-prediction response:', message);
                return;
            }

            // Processa dados JSON normais
            if (!timerData || typeof timerData !== 'object') {
                console.warn('[ConnectionManager] Invalid timer data structure:', typeof timerData);
                return;
            }

            state.timerState = timerData.timerState || 'NotRunning';
            state.lastTime = timerData.currentTime?.realTime || 0;
            state.lastTs = performance.now();

            if (timerData.run) {
                // Validate run data structure
                if (!timerData.run.segments || !Array.isArray(timerData.run.segments)) {
                    console.warn('[ConnectionManager] Invalid run segments data:', timerData.run);
                } else {
                    // Extract game/category info from WebSocket data
                    // IDs come from run.metadata (speedrun.com IDs)
                    const metadata = timerData.run?.metadata || {};
                    const runInfo = {
                        gameName: timerData.gameName || timerData.game,
                        categoryName: timerData.categoryName || timerData.category,
                        gameId: metadata.gameId || null,
                        categoryId: metadata.categoryId || null,
                        emulator: metadata.emulator || null,
                        variables: metadata.variables || null
                    };

                    state.runData = { ...timerData, ...runInfo };

                    render(timerData);

                    // Load world record if we have gameId and categoryId
                    const currentWR = state.worldRecordTime;

                    // Determine which IDs to use
                    const effectiveGameId = runInfo.gameId || state.settings.worldRecordGameId || null;
                    const effectiveCategoryId = runInfo.categoryId || state.settings.worldRecordCategoryId || null;
                    // Emulator filter removed from WR API
                    const effectiveVariables = runInfo.variables || null;
                    const hasEffectiveIds = !!(effectiveGameId && effectiveCategoryId);

                    // Check if we need to reload (different IDs or no WR yet)
                    const shouldReload = !currentWR ||
                        (currentWR.gameId !== effectiveGameId) ||
                        (currentWR.categoryId !== effectiveCategoryId) ||
                        JSON.stringify(currentWR.variables) !== JSON.stringify(effectiveVariables);

                    if (hasEffectiveIds && shouldReload) {
                        // Debounce WR loading to avoid too many API calls
                        if (this.worldRecordTimeout) {
                            clearTimeout(this.worldRecordTimeout);
                        }
                        this.worldRecordTimeout = setTimeout(() => {
                            console.log('[ConnectionManager] Loading WR with filters:', {
                                gameId: effectiveGameId,
                                categoryId: effectiveCategoryId,
                                variables: effectiveVariables
                            });
                            WorldRecordLoader.load(
                                effectiveGameId,
                                effectiveCategoryId,
                                effectiveVariables
                            );
                        }, 2000);
                    }
                }
            }

            updateControlButtons();

        } catch (error) {
            console.error('[ConnectionManager] Failed to process message:', error);
            console.debug('[ConnectionManager] Raw message data:', event.data?.substring(0, 500));
        }
    }

    handleError(error) {
        console.error('[ConnectionManager] WebSocket error:', error);
        console.debug('[ConnectionManager] Error details:', {
            message: error?.message,
            stack: error?.stack,
            wsState: this.ws?.readyState,
            connectionState: this.connectionState
        });

        clearTimeout(this.connectionTimeout);

        if (this.connectionState !== 'disconnecting') {
            this.handleConnectionError('WebSocket connection error');
        }
    }

    handleClose(connectionId) {
        // Ignore if this connection is already obsolete (replaced by new connection)
        if (connectionId !== this.connectionId) {
            console.log('[ConnectionManager] Ignoring handleClose for obsolete connection');
            return;
        }

        console.log('[ConnectionManager] WebSocket connection closed');
        console.debug('[ConnectionManager] Close details:', {
            wsReadyState: this.ws?.readyState,
            wasManualDisconnect: this.isManualDisconnect,
            reconnectAttempts: this.reconnectAttempts,
            connectionState: this.connectionState
        });
        clearTimeout(this.connectionTimeout);

        if (this.isManualDisconnect) {
            this.updateConnectionState('disconnected');
            return;
        }

        this.handleConnectionLost(translate('connection_connection_lost'));
    }

    handleConnectionLost(reason) {
        console.log(`[ConnectionManager] Connection lost: ${reason}`);

        this.connectionState = 'disconnected';
        state.isConnected = false;
        state.isConnecting = false;

        this.updateConnectionState('disconnected');
        updateControlButtons();

        if (this.autoReconnect && !this.isManualDisconnect) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[ConnectionManager] Max reconnect attempts reached');
            this.updateConnectionState('error');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

        console.log(`[ConnectionManager] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay / 1000)}s`);

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    showTestResult(result) {
        /** @type {HTMLElement|null} */
        const indicatorDot = document.getElementById('connection-indicator-dot');
        /** @type {HTMLElement|null} */
        const statusText = document.getElementById('connection-status-text');

        if (indicatorDot && statusText) {
            indicatorDot.classList.remove('connected', 'connecting', 'error', 'testing');

            let statusMessage = '';
            let statusColor = '#888';

            switch (result) {
                case 'testing':
                    indicatorDot.classList.add('testing');
                    statusMessage = translate('connection_testing');
                    statusColor = '#ffa500';
                    break;
                case 'success':
                    indicatorDot.classList.add('connected');
                    statusMessage = translate('connection_test_success');
                    statusColor = '#40ff40';
                    break;
                case 'error':
                    indicatorDot.classList.add('error');
                    statusMessage = translate('connection_test_failed');
                    statusColor = '#ff4040';
                    break;
            }

            statusText.textContent = statusMessage;
            statusText.style.color = statusColor;
        }
    }

    updateConnectionState(status) {
        const indicatorDot = document.getElementById('connection-indicator-dot');
        const statusText = document.getElementById('connection-status-text');

        this.connectionState = status;

        if (indicatorDot && statusText) {
            indicatorDot.classList.remove('connected', 'connecting', 'error', 'testing');

            let statusMessage = '';
            let statusColor = '#888';
            let titleKey = null;

            switch (status) {
                case 'connected':
                    indicatorDot.classList.add('connected');
                    titleKey = 'connection_connected_livesplit';
                    statusMessage = translate('connection_status');
                    statusColor = '#40ff40';
                    break;

                case 'connecting':
                    indicatorDot.classList.add('connecting');
                    titleKey = 'connection_connecting';
                    statusMessage = translate('connection_connecting');
                    statusColor = '#ffa500';
                    break;

                case 'testing':
                    indicatorDot.classList.add('testing');
                    statusMessage = translate('connection_testing');
                    statusColor = '#ffa500';
                    break;

                case 'success':
                    indicatorDot.classList.add('connected');
                    statusMessage = translate('connection_test_success');
                    statusColor = '#40ff40';
                    break;

                case 'error':
                case 'disconnected':
                    indicatorDot.classList.add('error');
                    titleKey = 'connection_disconnected';
                    statusMessage = translate('connection_disconnected');
                    statusColor = '#ff4040';
                    break;
            }

            // Set title for indicator dot
            if (titleKey) {
                indicatorDot.title = translate(titleKey);
            }

            statusText.textContent = statusMessage;
            statusText.style.color = statusColor;
        }

        state.isConnected = (status === 'connected');
        state.isConnecting = (status === 'connecting');

        updateControlButtons();
    }

    showConnectingMessage(host) {
        const statusText = document.getElementById('connection-status-text');
        if (statusText) {
            statusText.textContent = `${translate('connection_connecting_to')} ${host}`;
        }
    }

    updateTestButton(result) {
        /** @type {HTMLButtonElement|null} */
        const testButton = document.getElementById('test-connection');
        if (!testButton) { return; }

        testButton.classList.remove('testing', 'success', 'error');

        switch (result) {
            case 'testing':
                testButton.classList.add('testing');
                testButton.textContent = translate('connection_testing_button');
                testButton.disabled = true;
                break;
            case 'success':
                testButton.classList.add('success');
                testButton.textContent = translate('connection_test_success_button');
                testButton.disabled = false;
                break;
            case 'error':
                testButton.classList.add('error');
                testButton.textContent = translate('connection_test_failed_button');
                testButton.disabled = false;
                break;
            default:
                testButton.textContent = translate('connection_test');
                testButton.disabled = false;
        }
    }

    async handleTestConnection() {
        const domainInput = DOM.get('connection-domain');
        const portInput = DOM.get('connection-port');

        if (!domainInput || !portInput) {
            console.error('[ConnectionManager] Connection fields not found');
            return;
        }

        const domain = domainInput.value.trim();
        const port = portInput.value.trim();

        if (!domain || !port) {
            this.showTestResult('error');
            return;
        }

        const url = `ws://${domain}:${port}`;

        this.showTestResult('testing');

        const success = await this.testConnection(url);

        state.settings.wsUrl = url;
        CONFIG.WS_URL = url;
        saveSettings();

        if (success) {
            this.showTestResult('success');

            // Close any existing connection before connecting
            if (this.ws) {
                this.isManualDisconnect = true;
                this.ws.close();
                this.ws = null;
            }

            // Small delay to ensure previous connection is fully closed
            setTimeout(() => {
                this.connect(url);
            }, 200);
        } else {
            this.showTestResult('error');
            this.updateConnectionState('disconnected');
        }
    }

    /**
     * Test WebSocket connection
     * @param {string} url - WebSocket URL to test
     * @returns {Promise<boolean>}
     */
    async testConnection(url) {
        console.log(`[ConnectionManager] Testing connection to: ${url}`);
        return new Promise((resolve) => {
            const ws = new WebSocket(url);
            const timeout = setTimeout(() => {
                ws.close();
                resolve(false);
            }, 3000);

            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                ws.close();
                resolve(false);
            };
        });
    }

    // ==================== FUNÇÕES AUXILIARES ====================
    performHealthCheck() {
        if (this.connectionState === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const now = Date.now();
            const lastMessage = this.lastMessageTime || 0;

            if (now - lastMessage > 60000) {
                console.warn('[ConnectionManager] Checking connection health...');

                try {
                    if (this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send('ping');
                        console.log('[ConnectionManager] Ping sent');
                    }
                } catch (err) {
                    console.error('[ConnectionManager] Failed to send ping:', err);
                    this.handleConnectionLost(translate('connection_timeout'));
                }
            }
        }
    }

    handleBeforeUnload() {
        console.log('[ConnectionManager] Page is being closed');
        this.isManualDisconnect = true;
        this.disconnect(translate('connection_page_closed'));
    }

    handleOnline() {
        console.log('[ConnectionManager] Network online detected');

        if (this.connectionState !== 'connected' && !this.isManualDisconnect) {
            this.updateConnectionState('connecting');

            setTimeout(() => {
                this.connect();
            }, 1000);
        }
    }

    handleOffline() {
        console.warn('[ConnectionManager] Network offline');
        this.updateConnectionState('error');
    }

    sendCommand(command) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('[ConnectionManager] Cannot send command: not connected');
            DOM.showError(translate('connection_not_connected'));
            return;
        }

        try {
            console.log(`[ConnectionManager] Sending command: ${command}`);
            this.ws.send(command);

        } catch (error) {
            console.error('[ConnectionManager] Failed to send command:', error);
            DOM.showError(translate('connection_error_sending'));

            if (this.connectionState === 'connected') {
                this.handleConnectionLost(translate('connection_error_sending'));
            }
        }
    }

    flushPendingMessages() {
        if (this.pendingMessages.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`[ConnectionManager] Sending ${this.pendingMessages.length} pending messages`);

            this.pendingMessages.forEach(message => {
                try {
                    this.ws.send(message);
                } catch (error) {
                    console.error('[ConnectionManager] Failed to send pending message:', error);
                }
            });

            this.pendingMessages = [];
        }
    }

    /**
     * Envia comando para obter melhor tempo possível
     */
    getBestPossibleTime() {
        this.sendCommand('getbestpossibletime');
    }

    /**
     * Envia comando para obter tempo previsto
     */
    getPredictedTime() {
        this.sendCommand('getpredictedtime Personal Best');
    }

    showSettingsModal() {
        console.log('[Settings] Opening settings modal');

        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('show');
        }

        window.showSettingsModal && window.showSettingsModal();

        setTimeout(() => {
            const modalClose = document.getElementById('modal-close');
            if (modalClose) {
                modalClose.focus();
            }
        }, 100);
    }

    getStatus() {
        return {
            state: this.connectionState,
            isConnected: state.isConnected,
            isConnecting: state.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            wsState: this.ws ? this.ws.readyState : 'NO_WS',
            lastMessageTime: this.lastMessageTime,
            isManualDisconnect: this.isManualDisconnect,
            autoReconnect: this.autoReconnect,
            showSettingsOnDisconnect: this.showSettingsOnDisconnect
        };
    }

    isAlive() {
        return this.connectionState === 'connected' &&
            this.ws &&
            this.ws.readyState === WebSocket.OPEN;
    }

    // ==================== CONFIGURAÇÃO ====================
    updateSettings(settings) {
        if (settings.autoReconnect !== undefined) {
            this.autoReconnect = settings.autoReconnect;
        }

        if (settings.showSettingsOnDisconnect !== undefined) {
            this.showSettingsOnDisconnect = settings.showSettingsOnDisconnect;
        }

        if (settings.maxReconnectAttempts !== undefined) {
            this.maxReconnectAttempts = settings.maxReconnectAttempts;
        }

        if (settings.reconnectDelay !== undefined) {
            this.reconnectDelay = settings.reconnectDelay;
        }

        console.log('[ConnectionManager] ConnectionManager settings updated');
    }

    // ==================== DESTRUIDOR ====================
    destroy() {
        console.log('[ConnectionManager] Destroying ConnectionManager');

        this.disconnect('Destroying manager');

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);

        this.pendingMessages = [];
        this.reconnectAttempts = 0;
        this.connectionState = 'destroyed';
    }
}

function setupAutoReconnectSettings() {
    const modalClose = DOM.get('modal-close');
    if (modalClose) {
        const originalCloseHandler = modalClose.onclick;
        modalClose.onclick = function (e) {
            if (!state.isConnected && !state.isConnecting) {
                const shouldReconnect = confirm('You are disconnected. Would you like to try reconnecting now?');
                if (shouldReconnect) {
                    connectionManager.connect();
                }
            }

            if (typeof originalCloseHandler === 'function') {
                originalCloseHandler.call(this, e);
            } else {
                clearConnectionStatus();
                hideSettingsModal();
            }
        };
    }

    const modal = DOM.get('settings-modal');
    if (modal) {
        const originalClickHandler = modal.onclick;
        modal.onclick = function (e) {
            if (e.target === modal) {
                if (!state.isConnected && !state.isConnecting) {
                    const shouldReconnect = confirm('You are disconnected. Would you like to try reconnecting now?');
                    if (shouldReconnect) {
                        connectionManager.connect();
                        hideSettingsModal();
                        return;
                    }
                }

                if (typeof originalClickHandler === 'function') {
                    originalClickHandler.call(this, e);
                } else {
                    clearConnectionStatus();
                    hideSettingsModal();
                }
            }
        };
    }
}

const connectionManager = new ConnectionManager();

/* ==================== FUNÇÕES DE CONTROLE ==================== */
function updateControlButtons() {
    const btnStartSplit = DOM.get('btn-start-split');
    const btnPause = DOM.get('btn-pause');
    const btnReset = DOM.get('btn-reset');
    const btnUndo = DOM.get('btn-undo');
    const btnSkip = DOM.get('btn-skip');

    // Verificar se os elementos existem
    if (!btnStartSplit || !btnPause || !btnReset || !btnUndo || !btnSkip) {
        console.warn('Some control buttons not found');
        return;
    }

    if (!state.isConnected) {
        [btnStartSplit, btnPause, btnReset, btnUndo, btnSkip].forEach(btn => {
            if (btn) { btn.disabled = true; }
        });
        return;
    }

    const isRunning = state.timerState === 'Running';
    const isPaused = state.timerState === 'Paused';
    const isNotRunning = state.timerState === 'NotRunning';
    const isEnded = state.timerState === 'Ended';

    let undoAvailable = false;
    if (state.runData?.run?.segments) {
        // Permite undo se houver splits processados (splitados ou skipados)
        // currentSplitIndex indica em qual split estamos; se > 0, há o que desfazer
        const currentIdx = state.runData.currentSplitIndex ?? 0;
        undoAvailable = currentIdx > 0;
    }

    // Atualizar botão Start/Split/Reset
    if (btnStartSplit) {
        const runJustEnded = isEnded && state.runEndedAt && (Date.now() - state.runEndedAt) < 1000;

        if (isEnded) {
            btnStartSplit.innerHTML = '<span class="icon-reset"></span>';
            btnStartSplit.title = runJustEnded ? 'Reset (wait 1s)' : 'Reset';
            btnStartSplit.setAttribute('aria-label', runJustEnded ? 'Reset (wait 1s)' : 'Reset');
            btnStartSplit.disabled = runJustEnded;

            if (runJustEnded) {
                btnStartSplit.classList.remove('danger', 'primary');
                btnStartSplit.classList.add('disabled-state');
            } else {
                btnStartSplit.classList.add('danger');
                btnStartSplit.classList.remove('primary', 'disabled-state');
            }
        } else if (isNotRunning) {
            btnStartSplit.innerHTML = '<span class="icon-start"></span>';
            btnStartSplit.title = 'Start';
            btnStartSplit.setAttribute('aria-label', 'Start');
            btnStartSplit.disabled = false;
            btnStartSplit.classList.remove('danger', 'disabled-state');
            btnStartSplit.classList.add('primary');
        } else if (isRunning) {
            btnStartSplit.innerHTML = '<span class="icon-split"></span>';
            btnStartSplit.title = 'Split';
            btnStartSplit.setAttribute('aria-label', 'Split');
            btnStartSplit.disabled = false;
            btnStartSplit.classList.remove('danger', 'disabled-state');
            btnStartSplit.classList.add('primary');
        } else if (isPaused) {
            btnStartSplit.innerHTML = '<span class="icon-start"></span>';
            btnStartSplit.title = 'Resume';
            btnStartSplit.setAttribute('aria-label', 'Resume');
            btnStartSplit.disabled = false;
            btnStartSplit.classList.remove('danger', 'disabled-state');
            btnStartSplit.classList.add('primary');
        }
    }

    if (btnPause) {
        btnPause.disabled = !isRunning;
        btnPause.title = btnPause.disabled ? 'Pause unavailable' : 'Pause';
    }

    if (btnReset) {
        btnReset.disabled = isNotRunning || isEnded;
        btnReset.title = btnReset.disabled ? 'Reset unavailable' : 'Reset';
    }

    if (btnUndo) {
        btnUndo.disabled = !undoAvailable || isNotRunning;
        btnUndo.title = btnUndo.disabled ? 'No splits to undo' : 'Undo';
    }

    const canSkip = (isRunning || isPaused) &&
        state.runData?.run?.segments &&
        (state.runData.currentSplitIndex ?? -1) < state.runData.run.segments.length - 1;

    if (btnSkip) {
        btnSkip.disabled = !canSkip || isEnded;
        btnSkip.title = btnSkip.disabled ? 'No next split' : 'Skip';
    }
}

function setupControls() {
    const settingsToggle = DOM.get('settings-toggle');
    if (settingsToggle) {
        settingsToggle.addEventListener('click', showSettingsModal);
    }

    const btnStartSplit = DOM.get('btn-start-split');
    const btnPause = DOM.get('btn-pause');
    const btnReset = DOM.get('btn-reset');
    const btnUndo = DOM.get('btn-undo');
    const btnSkip = DOM.get('btn-skip');

    if (btnStartSplit) {
        btnStartSplit.addEventListener('click', () => {
            const isRunning = state.timerState === 'Running';
            const isPaused = state.timerState === 'Paused';
            const isEnded = state.timerState === 'Ended';

            const runJustEnded = isEnded && state.runEndedAt && (Date.now() - state.runEndedAt) < 1000;
            if (runJustEnded) { return; }

            if (isEnded) {
                connectionManager.sendCommand('reset');
            } else if (isRunning) {
                connectionManager.sendCommand('split');
            } else if (isPaused) {
                connectionManager.sendCommand('resume');
            } else {
                connectionManager.sendCommand('starttimer');
            }
        });
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
            if (state.timerState === 'Running') {
                connectionManager.sendCommand('pause');
            }
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (state.timerState === 'Ended') {
                connectionManager.sendCommand('reset');
            } else if (confirm('Are you sure you want to reset the timer?')) {
                connectionManager.sendCommand('reset');
            }
        });
    }

    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            if (state.timerState === 'Ended' || state.timerState === 'Running' || state.timerState === 'Paused') {
                connectionManager.sendCommand('unsplit');
            }
        });
    }

    if (btnSkip) { btnSkip.addEventListener('click', () => connectionManager.sendCommand('skipsplit')); }

    updateControlButtons();
    setupGraphResizer();
}

function updateControlsVisibility() {
    const controlsContainer = DOM.get('controls-container');
    if (controlsContainer) {
        controlsContainer.style.display = state.settings.showControls ? 'flex' : 'none';
    }
}

/* ==================== FUNÇÕES DE TEMA ==================== */
function applyTheme(themeName) {
    const root = document.documentElement;
    const colors = THEME_COLORS[themeName] || THEME_COLORS['default'];

    root.style.removeProperty('--theme-bg');
    root.style.removeProperty('--theme-text');
    root.style.removeProperty('--theme-accent');

    root.style.setProperty('--bg-main', colors.bg);
    root.style.setProperty('--text-dim', colors.text);
    root.style.setProperty('--blue', colors.accent);

    root.style.setProperty('--header-bg', colors.bg);
    root.style.setProperty('--timer-bg', colors.bg);
    root.style.setProperty('--controls-bg', colors.bg);

    // Extract RGB from accent color for transparent backgrounds
    const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colors.accent);
    const rgb = rgbMatch ?
        `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}` :
        '0, 162, 255';

    // Set theme CSS variables for immediate updates
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-accent-rgb', rgb);

    const gameNameEl = DOM.get('game-name');
    if (gameNameEl) {
        gameNameEl.style.color = colors.accent;
    }

    state.settings.theme = themeName;

    console.log(`[Theme] Theme applied: ${themeName}`);
}

function updateThemeDisplay(themeName = 'default') {
    const currentDisplay = DOM.get('theme-current-display');
    if (currentDisplay) {
        const nameElement = currentDisplay.querySelector('.theme-name');
        if (nameElement) {
            const displayName = translate('theme_' + themeName);
            nameElement.textContent = displayName;
        }
        const colors = THEME_COLORS[themeName] || THEME_COLORS.default;
        const nameEl = currentDisplay.querySelector('.theme-name');
        if (nameEl) {
            nameEl.style.color = colors.accent;
        }
    }

    /** @type {HTMLButtonElement|null} */
    const prevBtn = document.querySelector('.prev-theme');
    /** @type {HTMLButtonElement|null} */
    const nextBtn = document.querySelector('.next-theme');

    // Theme navigation is cyclic - buttons are always enabled
    if (prevBtn) { prevBtn.disabled = false; }
    if (nextBtn) { nextBtn.disabled = false; }
}

function setupThemeSelector() {
    const themeSelector = document.querySelector('.theme-selector');
    const themeDisplay = DOM.get('theme-current-display');
    const themeGrid = DOM.get('theme-grid');
    const prevBtn = document.querySelector('.prev-theme');
    const nextBtn = document.querySelector('.next-theme');

    if (!themeSelector || !themeDisplay || !themeGrid) {
        console.warn('Theme selector elements not found');
        return;
    }

    const themeNames = Object.keys(THEMES);

    function getCurrentThemeIndex() {
        const currentTheme = state.settings.theme || 'default';
        return themeNames.indexOf(currentTheme);
    }

    function applyNewTheme(themeName) {
        const themeDisplayName = THEMES[themeName]?.name || themeName;

        // Cancel any pending timeouts
        if (settingsModalTimeout) {
            clearTimeout(settingsModalTimeout);
            settingsModalTimeout = null;
        }
        if (themeAutoReopenTimeout) {
            clearTimeout(themeAutoReopenTimeout);
            themeAutoReopenTimeout = null;
        }

        // Mark that we're browsing themes (to keep modal open)
        isBrowsingThemes = true;

        state.settings.theme = themeName;
        saveSettings();
        applyTheme(themeName);
        updateThemeDisplay(themeName);

        // Update active class in grid
        document.querySelectorAll('.theme-block').forEach(block => {
            block.classList.toggle('active', block.dataset.themeId === themeName);
        });

        // Wait 2 seconds, then close modal and show toast
        settingsModalTimeout = setTimeout(() => {
            hideSettingsModal();
            showToast(`Aplicando tema: ${themeDisplayName}...`);
            settingsModalTimeout = null;

            // After closing, wait 3 seconds then reopen and hide toast
            themeAutoReopenTimeout = setTimeout(() => {
                isBrowsingThemes = false;
                showSettingsModal();
                hideToast();
                themeAutoReopenTimeout = null;
            }, 3000);
        }, 2000);
    }

    // Build the grid
    themeGrid.innerHTML = '';
    themeNames.forEach(themeId => {
        const theme = THEMES[themeId];
        const colors = THEME_COLORS[themeId] || THEME_COLORS.default;
        const block = document.createElement('div');
        block.className = 'theme-block';
        if ((state.settings.theme || 'default') === themeId) block.classList.add('active');
        block.dataset.themeId = themeId;

        // Use diagonal gradient for the block background
        block.style.background = `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg} 50%, ${colors.accent} 50%, ${colors.accent} 100%)`;

        block.innerHTML = `
            <div class="theme-block-name">${translate('theme_' + themeId)}</div>
        `;

        block.addEventListener('click', (e) => {
            e.stopPropagation();
            applyNewTheme(themeId);
        });

        themeGrid.appendChild(block);
    });

    // Toggle grid - make entire theme-nav container clickable
    const themeNav = document.querySelector('.theme-nav');
    if (themeNav) {
        themeNav.addEventListener('click', (e) => {
            // Don't toggle if clicking on navigation buttons
            if (e.target.closest('.theme-nav-btn')) return;
            themeSelector.classList.toggle('expanded');
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const currentIndex = getCurrentThemeIndex();
            const newIndex = (currentIndex - 1 + themeNames.length) % themeNames.length;
            applyNewTheme(themeNames[newIndex]);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const currentIndex = getCurrentThemeIndex();
            const newIndex = (currentIndex + 1) % themeNames.length;
            applyNewTheme(themeNames[newIndex]);
        });
    }

    updateThemeDisplay(state.settings.theme || 'default');
}

function _resetThemeSelector() {
    // Reset to default theme
    const defaultTheme = 'default';

    // Update state
    state.settings.theme = defaultTheme;

    // Apply theme
    applyTheme(defaultTheme);

    // Update display
    updateThemeDisplay(defaultTheme);

    // Save settings
    saveSettings();
}

/* ==================== FUNÇÕES DE RENDERIZAÇÃO ==================== */
function shouldHideGraphAndTable() {
    if (!state.runData?.run?.segments) { return true; }
    return state.runData.run.segments.length <= 1;
}

function findSegmentSection(segments, startIdx) {
    if (startIdx < 0 || startIdx >= segments.length) { return ''; }

    for (let j = startIdx; j < segments.length; j++) {
        const sec = DOM.extractSectionName(segments[j].name);
        if (sec) { return sec; }
    }
    return '';
}

function updateSectionVisibility(sectionName) {
    const splitsBody = DOM.get('splits-body');
    if (!splitsBody || !sectionName) { return; }

    // When alwaysExpandedSplits is enabled, never hide any section
    if (state.settings.alwaysExpandedSplits === true) {
        splitsBody.querySelectorAll(`.row-subsplit[data-section="${sectionName}"]`).forEach(row => {
            row.classList.remove('hidden');
        });
        return;
    }

    const isExpandedByUser = state.expandedSections.has(sectionName);
    const isRunning = state.timerState === 'Running' || state.timerState === 'Paused';
    const curIdx = state.runData?.currentSplitIndex ?? -1;

    let sectionHasCurrent = false;
    if (isRunning && curIdx >= 0) {
        const row = splitsBody.querySelector(`.row-subsplit[data-split-index="${curIdx}"]`);
        sectionHasCurrent = row?.getAttribute('data-section') === sectionName;
    }

    const shouldExpand = isExpandedByUser || sectionHasCurrent;

    splitsBody.querySelectorAll(`.row-subsplit[data-section="${sectionName}"]`).forEach(row => {
        row.classList.toggle('hidden', !shouldExpand);
    });
}

/**
 * Atualiza o display de previsões (best possible e predicted time)
 */
function updatePredictionDisplay() {
    const bestPossibleTimeEl = DOM.get('best-possible-time');
    const predictedTimeEl = DOM.get('predicted-time');

    if (!bestPossibleTimeEl || !predictedTimeEl) { return; }

    // Se não há dados da run, mostrar valores padrão
    if (!state.runData?.run?.segments) {
        bestPossibleTimeEl.textContent = '-';
        predictedTimeEl.textContent = '-';
        bestPossibleTimeEl.className = 'prediction-time';
        predictedTimeEl.className = 'prediction-time';
        return;
    }
}

/**
 * Processa respostas de previsão do LiveSplit Server
 */
function handlePredictionResponse(data, type) {
    const bestPossibleTimeEl = DOM.get('best-possible-time');
    const predictedTimeEl = DOM.get('predicted-time');

    if (!bestPossibleTimeEl || !predictedTimeEl) { return; }

    let parsedTime = null;

    // Try to parse as number if simple time format
    const numericTime = parseFloat(data);
    if (!isNaN(numericTime)) {
        parsedTime = numericTime * 1000; // Assume seconds to ms
    } else {
        // Try complex parsing
        parsedTime = TimeUtils.parseLiveSplitTime(data);
    }

    if (parsedTime !== null) {
        if (type === 'bestPossible') {
            bestPossibleTimeEl.textContent = TimeUtils.formatSplit(parsedTime / 1000);
            bestPossibleTimeEl.className = 'prediction-time best';
            state.bestPossibleTime = parsedTime;
        } else if (type === 'predicted') {
            predictedTimeEl.textContent = TimeUtils.formatSplit(parsedTime / 1000);

            // Define cor baseada na comparação com o best possible
            if (state.bestPossibleTime !== null) {
                const diff = parsedTime - state.bestPossibleTime;
                if (diff <= 0) {
                    predictedTimeEl.className = 'prediction-time best';
                } else {
                    predictedTimeEl.className = 'prediction-time behind';
                }
            } else {
                predictedTimeEl.className = 'prediction-time';
            }
            state.predictedTime = parsedTime;
        }
    } else {
        // Se não conseguiu parsear, mostra o original
        if (type === 'bestPossible') {
            bestPossibleTimeEl.textContent = data;
            bestPossibleTimeEl.className = 'prediction-time best';
        } else if (type === 'predicted') {
            predictedTimeEl.textContent = data;
            predictedTimeEl.className = 'prediction-time';
        }
    }
}

function scrollToActiveSplit() {
    const splitsContainer = document.querySelector('.splits-container');
    /** @type {HTMLElement|null} */
    const activeRow = document.querySelector('.row-subsplit.active');

    if (!splitsContainer || !activeRow) { return; }

    const containerRect = splitsContainer.getBoundingClientRect();
    const rowRect = activeRow.getBoundingClientRect();

    if (rowRect.top < containerRect.top || rowRect.bottom > containerRect.bottom) {
        const scrollTop = activeRow.offsetTop - (splitsContainer.clientHeight / 2) + (activeRow.clientHeight / 2);
        splitsContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
    }
}

function scrollToSelectedSplit() {
    if (state.selectedSplitIdx === null) { return; }

    const splitsContainer = document.querySelector('.splits-container');
    const selectedRow = document.querySelector(`.row-subsplit[data-split-index="${state.selectedSplitIdx}"]`);

    if (!splitsContainer || !selectedRow) { return; }

    const containerRect = splitsContainer.getBoundingClientRect();
    const rowRect = selectedRow.getBoundingClientRect();

    if (rowRect.top < containerRect.top || rowRect.bottom > containerRect.bottom) {
        const scrollTop = selectedRow.offsetTop - (splitsContainer.clientHeight / 2) + (selectedRow.clientHeight / 2);
        splitsContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
    }
}

function render(data) {
    if (!data?.run?.segments || !Array.isArray(data.run.segments) || data.run.segments.length === 0) {
        const splitsBody = DOM.get('splits-body');
        if (splitsBody) {
            splitsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-dim);">No splits loaded</td></tr>';
        }
        return;
    }

    state.runData = data;
    const run = data.run;

    // Trigger world record load if game/category available
    const gameName = data.gameName || data.game;
    const categoryName = data.categoryName || data.category;
    if (gameName && categoryName && connectionManager) {
        if (connectionManager.worldRecordTimeout) {
            clearTimeout(connectionManager.worldRecordTimeout);
        }
        connectionManager.worldRecordTimeout = setTimeout(() => {
            loadWorldRecordFromRunData();
        }, 2000);
    }

    const wasEnded = state.isRunEnded;
    state.isRunEnded = state.timerState === 'Ended';

    if (state.isRunEnded && !wasEnded) {
        state.runEndedAt = Date.now();
        setTimeout(() => {
            if (state.timerState === 'Ended') {
                updateControlButtons();
            }
        }, 1000);
    }

    const graphContainer = DOM.get('graph-container');
    const splitsContainer = document.querySelector('.splits-container');
    const splitsTable = document.getElementById('splits-table');

    const shouldHide = shouldHideGraphAndTable();

    if (graphContainer) {
        graphContainer.classList.toggle('hidden', !state.settings.showGraph || shouldHide);
    }

    if (splitsContainer) {
        splitsContainer.classList.toggle('hidden', !state.settings.showTable || shouldHide);
    }

    if (splitsTable) {
        splitsTable.classList.toggle('splits-hidden', !state.settings.showTable || shouldHide);
    }

    const curIdx = data.currentSplitIndex ?? -1;
    const previousActiveIdx = state.lastActiveIdx !== undefined ? state.lastActiveIdx : -1;
    const currentActiveSection = findSegmentSection(run.segments, curIdx);

    const splitChanged = state.timerState === 'Running' && curIdx !== previousActiveIdx && previousActiveIdx !== -1;

    if (splitChanged) {
        state.expandedSections.forEach(sec => {
            if (sec !== currentActiveSection) {
                state.expandedSections.delete(sec);
            }
        });

        // Scroll to the new active split
        setTimeout(() => {
            scrollToActiveSplit();
        }, 50);
    }

    state.lastActiveIdx = curIdx;
    state.lastActiveSection = currentActiveSection;

    if (run.segments.length > 0 && state.settings.showGraph) {
        drawComparisonGraph();
    }

    const gameNameEl = DOM.get('game-name');
    const categoryNameEl = DOM.get('category-name');
    const currentTheme = state.settings.theme || 'default';
    const accentColor = THEME_COLORS[currentTheme]?.accent || '#00a2ff';

    if (gameNameEl) {
        gameNameEl.textContent = run.gameName || '-';
        gameNameEl.title = run.gameName || '-';
        gameNameEl.style.color = accentColor;
    }

    if (categoryNameEl) {
        categoryNameEl.textContent = run.categoryName || '-';
        categoryNameEl.title = run.categoryName || '-';
    }

    const pbDisplay = DOM.get('pb-display');
    if (pbDisplay && run.segments.length > 0) {
        const lastSplit = run.segments[run.segments.length - 1];
        const pbTime = lastSplit?.comparisons?.['Personal Best']?.realTime;
        if (pbTime) {
            pbDisplay.textContent = `PB: ${TimeUtils.formatSplit(pbTime)}`;
        }
    }

    if (state.timerState !== 'Paused') {
        state.currentDelta = 0;
        if (curIdx > 0 && curIdx < run.segments.length) {
            const lastSeg = run.segments[curIdx - 1];
            const pbT = lastSeg?.comparisons?.['Personal Best']?.realTime;
            const actT = lastSeg?.splitTime?.realTime;
            if (pbT && actT) {
                state.currentDelta = actT - pbT;
            }
        }
    }

    const sectionMap = new Map();
    run.segments.forEach((seg, i) => {
        const sec = DOM.extractSectionName(seg.name);
        if (sec && !sectionMap.has(sec)) {
            sectionMap.set(sec, i);
        }
    });

    let html = '';
    let lastSec = '';
    state.hasIcons = run.segments.some(seg => seg.icon);

    run.segments.forEach((seg, i) => {
        let name = seg.name;
        let section = '';
        let isSub = name.startsWith('-');
        const isSectionEnd = name.includes('{');

        if (isSectionEnd) {
            const m = name.match(SECTION_FULL_REGEX);
            if (m) {
                section = m[1];
                name = m[2] || m[1];
                isSub = false;
            }
        } else if (isSub) {
            name = name.substring(1).trim();
            for (let j = i; j < run.segments.length; j++) {
                const sec = DOM.extractSectionName(run.segments[j].name);
                if (sec) {
                    section = sec;
                    break;
                }
            }
        }

        if (section && section !== lastSec) {
            const secIdx = sectionMap.get(section);
            let sectionTime = null;
            let sectionDelta = null;
            let deltaClass = 'neutral';

            if (secIdx !== undefined && secIdx < curIdx) {
                const seg = run.segments[secIdx];
                if (seg?.splitTime?.realTime) {
                    sectionTime = seg.splitTime.realTime;

                    const pbTime = seg?.comparisons?.['Personal Best']?.realTime;
                    if (pbTime) {
                        sectionDelta = sectionTime - pbTime;
                        deltaClass = sectionDelta < 0 ? 'ahead' : (sectionDelta > 0 ? 'behind' : 'neutral');
                    }
                }
            }

            if (sectionTime === null && secIdx !== undefined) {
                sectionTime = run.segments[secIdx]?.comparisons?.['Personal Best']?.realTime;
            }

            const deltaHtml = sectionDelta !== null ? TimeUtils.formatDelta(sectionDelta) : '-';

            html += `<tr class="row-section" data-section-name="${section}">
                        <td class="cell-icon ${!state.hasIcons ? 'hidden' : ''}"></td>
                        <td class="cell-name">${section}</td>
                        <td class="cell-timer"><span class="section-time">${TimeUtils.formatSplit(sectionTime)}</span></td>
                        <td class="cell-delta ${deltaClass}">${deltaHtml}</td>
                    </tr>`;
            lastSec = section;
        }

        const pb = seg.comparisons?.['Personal Best']?.realTime;
        const act = seg.splitTime?.realTime;
        const isSkipped = (i < curIdx && (act === null || act === undefined)) || (curIdx >= run.segments.length && (act === null || act === undefined));

        let shouldHide = false;
        // When alwaysExpandedSplits is enabled, never hide splits
        const alwaysExpanded = state.settings.alwaysExpandedSplits === true;
        if (!alwaysExpanded && section) {
            const isActive = i === curIdx;
            if (!isActive && section !== currentActiveSection && !state.expandedSections.has(section)) {
                shouldHide = true;
            }
        } else if (alwaysExpanded) {
            shouldHide = false;
        }

        let deltaHtml = '-';
        let statusClass = '';

        if (typeof act === 'number') {
            if (typeof pb === 'number') {
                const diff = act - pb;
                deltaHtml = TimeUtils.formatDelta(diff);
                if (diff === 0) {
                    statusClass = 'neutral';
                } else if (diff < 0) {
                    statusClass = 'ahead';
                } else {
                    statusClass = 'behind';
                }
            } else {
                statusClass = 'neutral';
            }
        } else if (isSkipped) {
            deltaHtml = 'Skipped';
            statusClass = 'neutral';
        }

        const isActive = i === curIdx;
        const isClicked = i === state.selectedSplitIdx;
        const hasTime = typeof act === 'number' || isSkipped;
        const canClick = hasTime || isActive;

        let iconHtml = '';
        if (seg.icon && seg.icon.trim() !== '') {
            iconHtml = `<img src="${seg.icon}" alt="">`;
        }

        let nameColorClass = '';
        if (isActive || i < curIdx) {
            nameColorClass = '';
        } else {
            nameColorClass = 'disabled';
        }

        html += `<tr class="row-subsplit ${isActive ? 'active' : ''} ${isClicked ? 'selected' : ''} ${shouldHide ? 'hidden' : ''}" data-split-index="${i}" data-section="${section || ''}" data-has-time="${hasTime}" data-is-skipped="${isSkipped}" data-can-click="${canClick}" style="${canClick ? 'cursor:pointer;' : 'cursor:default;'}">
                    <td class="cell-icon ${!state.hasIcons ? 'hidden' : ''}">${iconHtml}</td>
                    <td class="cell-name ${nameColorClass}" title="${name}">${name}</td>
                    <td class="cell-timer">${act ? TimeUtils.formatSplit(act) : TimeUtils.formatSplit(pb)}</td>
                    <td class="cell-delta ${statusClass}">${act ? deltaHtml : '-'}</td>
                </tr>`;
    });

    const splitsBody = DOM.get('splits-body');
    if (!splitsBody) { return; }
    splitsBody.innerHTML = html;

    // Apply active-split to the section name if there's a selected split
    if (state.selectedSplitIdx !== null && state.selectedSplitIdx !== undefined) {
        const selectedRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${state.selectedSplitIdx}"]`);
        if (selectedRow) {
            const sectionName = selectedRow.getAttribute('data-section');
            if (sectionName) {
                const sectionCellName = splitsBody.querySelector(`.row-section[data-section-name="${sectionName}"] .cell-name`);
                if (sectionCellName) {
                    sectionCellName.classList.add('active-split');
                }
            }
        }
    }

    splitsBody.querySelectorAll('.row-section').forEach(row => {
        row.addEventListener('click', function () {
            const sectionName = this.getAttribute('data-section-name');
            if (!sectionName) { return; }

            // Don't toggle when alwaysExpanded is enabled
            if (state.settings.alwaysExpandedSplits) {
                return;
            }

            const isRunning = state.timerState === 'Running' || state.timerState === 'Paused';
            const activeSection = state.lastActiveSection;

            if (isRunning && sectionName === activeSection) {
                updateSectionVisibility(sectionName);
                return;
            }

            if (state.expandedSections.has(sectionName)) {
                state.expandedSections.delete(sectionName);
            } else {
                state.expandedSections.add(sectionName);
            }

            updateSectionVisibility(sectionName);
        });
    });

    state.expandedSections.forEach(sectionName => {
        updateSectionVisibility(sectionName);
    });

    splitsBody.querySelectorAll('.row-section').forEach(sec => {
        const secName = sec.getAttribute('data-section-name');
        if (secName) { updateSectionVisibility(secName); }
    });

    splitsBody.querySelectorAll('.row-subsplit').forEach(row => {
        row.addEventListener('click', function (e) {
            e.stopPropagation();

            if (e.target.closest('button') || e.target.tagName === 'BUTTON') { return; }

            const splitIndex = parseInt(this.getAttribute('data-split-index'));
            const canClick = this.getAttribute('data-can-click') === 'true';

            if (!canClick) { return; }

            const splitsBody = DOM.get('splits-body');
            if (!splitsBody) { return; }

            const isCurrentlySelected = state.selectedSplitIdx === splitIndex;

            if (isCurrentlySelected) {
                state.selectedSplitIdx = null;
                state.selectedGraphPointIdx = null;
                splitsBody.querySelectorAll('.cell-name.active-split').forEach(el => {
                    el.classList.remove('active-split');
                });
                splitsBody.querySelectorAll('.row-subsplit.selected').forEach(el => {
                    el.classList.remove('selected');
                });

                setTimeout(() => {
                    scrollToActiveSplit();
                }, 50);

                if (state.settings.showGraph) { drawComparisonGraph(); }
                return;
            }

            state.selectedSplitIdx = splitIndex;
            state.selectedGraphPointIdx = null;

            splitsBody.querySelectorAll('.cell-name.active-split').forEach(el => {
                el.classList.remove('active-split');
            });
            splitsBody.querySelectorAll('.row-subsplit.selected').forEach(el => {
                el.classList.remove('selected');
            });

            // Apply active-split to the section name, not to the subsplit
            const sectionName = this.getAttribute('data-section');
            const sectionCellName = sectionName ? splitsBody.querySelector(`.row-section[data-section-name="${sectionName}"] .cell-name`) : null;
            if (sectionCellName) { sectionCellName.classList.add('active-split'); }
            this.classList.add('selected');

            const newSectionRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"]`);
            const newSectionName = newSectionRow ? newSectionRow.getAttribute('data-section') : null;

            if (newSectionName) {
                state.expandedSections.add(newSectionName);
                updateSectionVisibility(newSectionName);
            }

            setTimeout(() => {
                scrollToSelectedSplit();
            }, 50);

            if (state.settings.showGraph) { drawComparisonGraph(); }
        });
    });

    splitsBody.querySelectorAll('.row-section').forEach(sec => {
        const secName = sec.getAttribute('data-section-name');
        if (secName) { updateSectionVisibility(secName); }
    });

    if (state.selectedSplitIdx === null && state.selectedGraphPointIdx === null) {
        setTimeout(() => {
            scrollToActiveSplit();
        }, 50);
    }

    // Atualiza display de previsões
    updatePredictionDisplay();
}

/* ==================== FUNÇÕES DE GRÁFICO ==================== */
function drawComparisonGraph() {
    if (state.graphAnimationFrame) {
        cancelAnimationFrame(state.graphAnimationFrame);
    }

    state.graphAnimationFrame = requestAnimationFrame(() => {
        const canvas = DOM.get('comparison-graph');
        if (!canvas) {
            state.graphAnimationFrame = null;
            return;
        }

        const run = state.runData.run;
        const curIdx = state.runData.currentSplitIndex ?? -1;

        if (shouldHideGraphAndTable() || !state.settings.showGraph) {
            const graphContainer = DOM.get('graph-container');
            if (graphContainer) { graphContainer.classList.add('hidden'); }
            state.graphAnimationFrame = null;
            return;
        }
        const graphContainer = DOM.get('graph-container');
        if (graphContainer) { graphContainer.classList.remove('hidden'); }

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const width = rect.width;
        const height = rect.height;
        const paddingTop = 20;
        const paddingSides = 15;
        const footerHeight = 28;
        const graphHeight = height - paddingTop - footerHeight - 5;
        const graphBottom = paddingTop + graphHeight;
        ctx.clearRect(0, 0, width, height);

        let currentRealTimePoint = null;
        if (state.timerState === 'Running' && state.runData && state.runData.run) {
            const currentDelta = state.currentDelta;

            if (currentDelta !== undefined && currentDelta !== null) {
                const currentSegmentIndex = Math.max(0, curIdx);
                const currentSegment = run.segments[currentSegmentIndex];
                const pbTime = currentSegment?.comparisons?.['Personal Best']?.realTime;
                const isNeutral = typeof pbTime !== 'number';

                currentRealTimePoint = {
                    index: currentSegmentIndex,
                    delta: currentDelta,
                    neutral: isNeutral,
                    isActive: true,
                    isRealTime: true,
                    isLiveExtension: true
                };
            }
        } else if (state.timerState === 'Paused' && state.runData && state.runData.run && curIdx >= 0) {
            const segmentIndexToShow = Math.max(0, curIdx);
            const segmentToShow = run.segments[segmentIndexToShow];
            const pbTime = segmentToShow?.comparisons?.['Personal Best']?.realTime;
            const currentTime = state.lastTime;

            if (typeof pbTime === 'number' && typeof currentTime === 'number') {
                const delta = currentTime - pbTime;

                currentRealTimePoint = {
                    index: segmentIndexToShow,
                    delta: delta,
                    neutral: false,
                    isActive: true,
                    isRealTime: false,
                    isLiveExtension: false
                };
            } else if (typeof pbTime !== 'number') {
                currentRealTimePoint = {
                    index: segmentIndexToShow,
                    delta: null,
                    neutral: true,
                    isActive: true,
                    isRealTime: false,
                    isLiveExtension: false
                };
            }
        }

        const dataPoints = [];
        const sectionEnds = [];
        let maxDeltaValue = -Infinity;
        let minDeltaValue = Infinity;
        let maxDeltaIdx = -1;
        let minDeltaIdx = -1;
        let activeDataIdx = -1;

        const pointsWithTime = [];
        const skippedSplits = new Set();

        run.segments.forEach((seg, i) => {
            const act = seg.splitTime?.realTime;
            const isSkipped = (i < curIdx && typeof act !== 'number') ||
                (curIdx >= run.segments.length && typeof act !== 'number');

            if (typeof act === 'number' || isSkipped) {
                pointsWithTime.push(i);
                if (isSkipped) { skippedSplits.add(i); }
            }
        });

        pointsWithTime.forEach((splitIdx, dataIdx) => {
            const seg = run.segments[splitIdx];
            const pb = seg.comparisons?.['Personal Best']?.realTime;
            const act = seg.splitTime?.realTime;
            const name = seg.name;
            const sectionName = DOM.extractSectionName(name);

            let delta = null;
            let neutral = false;
            const isSkipped = skippedSplits.has(splitIdx);

            if (isSkipped) {
                neutral = true;
                delta = null;
            } else if (typeof act === 'number' && typeof pb === 'number') {
                delta = act - pb;
                neutral = (delta === 0);
            } else {
                neutral = true;
            }

            const point = {
                index: splitIdx,
                delta: delta,
                neutral: neutral,
                isActive: false,
                sectionEnd: sectionName,
                isCompleted: true,
                isSkipped: isSkipped,
                isRealTime: false
            };

            dataPoints.push(point);

            if (sectionName) {
                sectionEnds.push({
                    dataIndex: dataIdx,
                    name: sectionName
                });
            }

            if (!neutral && delta !== null) {
                if (delta >= maxDeltaValue) {
                    maxDeltaValue = delta;
                    maxDeltaIdx = dataIdx;
                }
                if (delta <= minDeltaValue) {
                    minDeltaValue = delta;
                    minDeltaIdx = dataIdx;
                }
            }
        });

        if (currentRealTimePoint) {
            if (dataPoints.length === 0) {
                dataPoints.push(currentRealTimePoint);
                activeDataIdx = 0;

                if (currentRealTimePoint.delta !== null) {
                    maxDeltaValue = Math.abs(currentRealTimePoint.delta);
                    minDeltaValue = -Math.abs(currentRealTimePoint.delta);
                    maxDeltaIdx = 0;
                    minDeltaIdx = 0;
                }
            } else {
                currentRealTimePoint.index = dataPoints[dataPoints.length - 1].index + 1;
                dataPoints.push(currentRealTimePoint);
                activeDataIdx = dataPoints.length - 1;

                if (currentRealTimePoint.delta !== null) {
                    if (currentRealTimePoint.delta > maxDeltaValue) {
                        maxDeltaValue = currentRealTimePoint.delta;
                        maxDeltaIdx = activeDataIdx;
                    }
                    if (currentRealTimePoint.delta < minDeltaValue) {
                        minDeltaValue = currentRealTimePoint.delta;
                        minDeltaIdx = activeDataIdx;
                    }
                }
            }
        } else if (dataPoints.length > 0) {
            activeDataIdx = dataPoints.length - 1;
            dataPoints[activeDataIdx].isActive = true;
        }

        dataPoints.forEach((pt, idx) => {
            if (pt.isRealTime) {
                pt.renderDelta = pt.delta;
                return;
            }

            if (!pt.neutral && typeof pt.delta === 'number') {
                pt.renderDelta = pt.delta;
                return;
            }

            let prev = null;
            for (let j = idx - 1; j >= 0; j--) {
                if (!dataPoints[j].neutral && typeof dataPoints[j].delta === 'number') {
                    prev = dataPoints[j].delta;
                    break;
                }
            }
            let next = null;
            for (let j = idx + 1; j < dataPoints.length; j++) {
                if (!dataPoints[j].neutral && typeof dataPoints[j].delta === 'number') {
                    next = dataPoints[j].delta;
                    break;
                }
            }
            if (prev !== null && next !== null) { pt.renderDelta = (prev + next) / 2; } else if (prev !== null) { pt.renderDelta = prev; } else if (next !== null) { pt.renderDelta = next; } else { pt.renderDelta = 0; }
        });

        if (dataPoints.length === 0) {
            state.graphAnimationFrame = null;
            return;
        }

        const effectivePointsCount = dataPoints.length;

        let deltaRange;
        const allDeltas = dataPoints.filter(pt => pt.delta !== null && !pt.neutral).map(pt => pt.delta);

        if (allDeltas.length === 0) {
            deltaRange = 1;
        } else {
            const maxAbsDelta = Math.max(...allDeltas.map(d => Math.abs(d)));
            deltaRange = Math.max(maxAbsDelta * 1.25, 1);
        }

        const viewMax = deltaRange;
        const viewMin = -deltaRange;
        const deltaToY = delta => {
            const normalized = ((delta ?? 0) - viewMin) / (viewMax - viewMin);
            const clamped = Math.max(0, Math.min(1, normalized));
            return paddingTop + graphHeight * (1 - clamped);
        };
        const zeroY = deltaToY(0);
        const xStep = effectivePointsCount <= 1 ? 0 : (width - (paddingSides * 2)) / Math.max(effectivePointsCount - 1, 1);
        const getX = i => paddingSides + (i * xStep);

        for (let i = 0; i < dataPoints.length - 1; i++) {
            const p1 = dataPoints[i];
            const p2 = dataPoints[i + 1];
            const x1 = getX(i);
            const x2 = getX(i + 1);
            const y1 = deltaToY(p1.renderDelta ?? 0);
            const y2 = deltaToY(p2.renderDelta ?? 0);

            let fillStyle;
            if (p2.neutral || p2.isSkipped) {
                fillStyle = 'rgba(136, 136, 136, 0.12)';
            } else {
                if (typeof p2.delta === 'number') {
                    if (p2.delta < 0) {
                        fillStyle = 'rgba(64, 255, 64, 0.12)';
                    } else if (p2.delta > 0) {
                        fillStyle = 'rgba(255, 64, 64, 0.12)';
                    } else {
                        fillStyle = 'rgba(136, 136, 136, 0.12)';
                    }
                } else {
                    fillStyle = 'rgba(136, 136, 136, 0.12)';
                }
            }

            ctx.beginPath();
            ctx.moveTo(x1, zeroY);
            ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x2, zeroY);
            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paddingSides, zeroY);
        ctx.lineTo(width - paddingSides, zeroY);
        ctx.stroke();

        if (sectionEnds.length > 0) {
            const sectionColors = ['rgba(0, 162, 255, 0.6)', 'rgba(255, 184, 0, 0.6)', 'rgba(64, 255, 64, 0.6)'];
            sectionEnds.forEach((s, idx) => {
                const x = getX(s.dataIndex);
                ctx.strokeStyle = sectionColors[idx % sectionColors.length];
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 3]);
                ctx.beginPath();
                ctx.moveTo(x, paddingTop - 5);
                ctx.lineTo(x, graphBottom + 5);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                const text = s.name.toUpperCase();
                const maxWidth = width - 10;
                let displayText = text;
                if (ctx.measureText(text).width > maxWidth) {
                    while (displayText.length > 3 && ctx.measureText(displayText + '...').width > maxWidth) {
                        displayText = displayText.slice(0, -1);
                    }
                    displayText += '...';
                }
                const textWidth = ctx.measureText(displayText).width;
                let textX = x;
                const minTextX = textWidth / 2 + 5;
                const maxTextX = width - (textWidth / 2) - 5;
                textX = Math.max(minTextX, Math.min(maxTextX, textX));
                ctx.fillText(displayText, textX, paddingTop - 8);
            });
        }

        for (let i = 0; i < dataPoints.length - 1; i++) {
            const p1 = dataPoints[i];
            const p2 = dataPoints[i + 1];
            const x1 = getX(i);
            const y1 = deltaToY(p1.renderDelta ?? 0);
            const x2 = getX(i + 1);
            const y2 = deltaToY(p2.renderDelta ?? 0);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);

            let strokeColor;
            if (p1.neutral || p2.neutral || p1.isSkipped || p2.isSkipped) {
                strokeColor = '#888';
            } else {
                if (typeof p2.delta === 'number') {
                    if (p2.delta < 0) {
                        strokeColor = '#40ff40';
                    } else if (p2.delta > 0) {
                        strokeColor = '#ff4040';
                    } else {
                        strokeColor = '#888';
                    }
                } else {
                    strokeColor = '#888';
                }
            }

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = (p1.neutral || p2.neutral || p1.isSkipped || p2.isSkipped) ? 2.5 : 3;
            ctx.stroke();
        }

        const displayIndices = new Set();
        if (effectivePointsCount > 0) {
            displayIndices.add(0);
            displayIndices.add(effectivePointsCount - 1);
        }
        if (activeDataIdx !== -1) { displayIndices.add(activeDataIdx); }
        if (maxDeltaIdx !== -1) { displayIndices.add(maxDeltaIdx); }
        if (minDeltaIdx !== -1) { displayIndices.add(minDeltaIdx); }
        sectionEnds.forEach(s => displayIndices.add(s.dataIndex));

        const specialIndices = new Set();
        if (effectivePointsCount > 0) {
            specialIndices.add(0);
            specialIndices.add(effectivePointsCount - 1);
        }
        if (maxDeltaIdx !== -1) { specialIndices.add(maxDeltaIdx); }
        if (minDeltaIdx !== -1) { specialIndices.add(minDeltaIdx); }
        const regularIndices = Array.from(displayIndices).filter(idx => !specialIndices.has(idx));

        dataPoints.forEach((pt, i) => {
            const x = getX(i);
            const y = deltaToY(pt.renderDelta ?? 0);
            const isActive = i === activeDataIdx;
            const hasBox = displayIndices.has(i);

            ctx.beginPath();
            const radius = pt.isRealTime ? 6 : (isActive ? 5 : 3);

            let pointColor;
            if (pt.neutral || pt.delta === null || pt.delta === undefined || pt.isSkipped) {
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0)';
                ctx.fill();
                ctx.strokeStyle = pt.isRealTime ? '#fff' : (isActive ? '#fff' : '#888');
                ctx.lineWidth = pt.isRealTime ? 3 : (isActive ? 2 : 1);
                ctx.stroke();

                if (pt.isSkipped) {
                    ctx.beginPath();
                    ctx.moveTo(x - 4, y - 4);
                    ctx.lineTo(x + 4, y + 4);
                    ctx.moveTo(x + 4, y - 4);
                    ctx.lineTo(x - 4, y + 4);
                    ctx.strokeStyle = '#ff4040';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }

                if (pt.isRealTime) {
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                }
            } else {
                if (pt.delta < 0) {
                    pointColor = '#40ff40';
                } else if (pt.delta > 0) {
                    pointColor = '#ff4040';
                } else {
                    pointColor = '#888';
                }

                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = pointColor;
                ctx.fill();

                if (pt.isRealTime) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = pointColor;
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1.0;
                } else if (hasBox) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = isActive ? 2 : 1;
                    ctx.stroke();
                }
            }
        });

        const deltaBoxes = [];
        regularIndices.forEach(idx => {
            if (idx < dataPoints.length) {
                const pt = dataPoints[idx];
                if (pt) {
                    deltaBoxes.push({
                        idx,
                        pt,
                        isActive: idx === activeDataIdx,
                        isSpecial: false
                    });
                }
            }
        });

        specialIndices.forEach(idx => {
            if (idx < dataPoints.length) {
                const pt = dataPoints[idx];
                if (pt) {
                    deltaBoxes.push({
                        idx,
                        pt,
                        isActive: idx === activeDataIdx,
                        isSpecial: true
                    });
                }
            }
        });

        deltaBoxes.sort((a, b) => {
            if (a.isActive && !b.isActive) { return 1; }
            if (!a.isActive && b.isActive) { return -1; }
            if (a.isSpecial && !b.isSpecial) { return 1; }
            if (!a.isSpecial && b.isSpecial) { return -1; }
            return 0;
        });

        deltaBoxes.forEach(box => {
            const color = getDeltaBoxColor(box.pt.delta, box.isActive);
            drawDeltaBoxWithColor(ctx, box.pt, box.idx, getX, deltaToY, width, height, footerHeight, box.isActive, color);
        });

        state.graphData = {
            dataPoints,
            getX,
            deltaToY,
            width,
            height,
            paddingSides,
            footerHeight,
            xStep,
            effectivePointsCount
        };

        const pointIndexToHighlight = state.selectedGraphPointIdx !== null ? state.selectedGraphPointIdx : state.selectedSplitIdx;

        if (pointIndexToHighlight !== null && pointIndexToHighlight < dataPoints.length) {
            const clickedPt = dataPoints[pointIndexToHighlight];
            if (clickedPt) {
                const x = getX(pointIndexToHighlight);
                const y = deltaToY(clickedPt.renderDelta ?? 0);
                const isNeutral = !!clickedPt.neutral || clickedPt.delta === null || clickedPt.delta === undefined || clickedPt.isSkipped;
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                if (isNeutral) {
                    ctx.fillStyle = 'rgba(0,0,0,0)';
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();

                    if (clickedPt.isSkipped) {
                        ctx.beginPath();
                        ctx.moveTo(x - 4, y - 4);
                        ctx.lineTo(x + 4, y + 4);
                        ctx.moveTo(x + 4, y - 4);
                        ctx.lineTo(x - 4, y + 4);
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                } else {
                    const color = (clickedPt.delta <= 0 ? '#40ff40' : '#ff4040');
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }

                const txt = TimeUtils.formatDelta(clickedPt.delta);
                drawDeltaTooltip(ctx, x, y, txt);
            }
        }

        state.graphAnimationFrame = null;
    });
}

function getDeltaBoxColor(delta, isActive) {
    if (delta === null || delta === undefined) {
        return isActive ? '#fff' : '#888';
    }

    if (delta < 0) {
        return '#40ff40';
    } else if (delta > 0) {
        return '#ff4040';
    }
    return isActive ? '#fff' : '#888';

}

function drawDeltaBoxWithColor(ctx, pt, idx, getX, deltaToY, width, height, footerHeight, isActive, color) {
    if (!pt) { return; }
    const x = getX(idx);

    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(x, deltaToY(pt.renderDelta ?? pt.delta ?? 0) + 5);
    ctx.lineTo(x, height - footerHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    const txt = TimeUtils.formatDelta(pt.delta);
    ctx.font = isActive ? (txt.length > 8 ? 'bold 9px monospace' : 'bold 11px monospace') : (txt.length > 8 ? '8px monospace' : '10px monospace');

    const m = ctx.measureText(txt);
    const bw = m.width + 6;
    const bh = 16;
    let bx = x - bw / 2;
    const minX = 5;
    const maxX = width - bw - 5;
    bx = Math.max(minX, Math.min(maxX, bx));
    const by = height - footerHeight;

    ctx.fillStyle = '#000';
    ctx.fillRect(bx, by, bw, bh);

    ctx.strokeStyle = isActive ? '#fff' : color;
    ctx.lineWidth = isActive ? 1.5 : 1;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = isActive ? '#fff' : color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, bx + bw / 2, by + bh / 2 + 1);
}

function drawDeltaTooltip(ctx, x, y, text) {
    ctx.font = 'bold 12px monospace';
    const m = ctx.measureText(text);
    const bw = m.width + 8;
    const bh = 18;
    let bx = x - bw / 2;
    const minX = 5;
    const maxX = state.graphData.width - bw - 5;
    bx = Math.max(minX, Math.min(maxX, bx));
    const by = y - 25;

    ctx.fillStyle = '#000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + bw / 2, by + bh / 2 + 1);
}

function handleCanvasClick(e) {
    if (e.type === 'touchend') {
        e.preventDefault();
    }

    if (!state.graphData?.dataPoints?.length) { return; }
    const canvas = DOM.get('comparison-graph');
    if (!canvas) { return; }

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.type === 'touchend') {
        const touch = e.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { dataPoints, getX, deltaToY } = state.graphData;

    let closestIdx = -1;
    let minDist = Infinity;

    dataPoints.forEach((pt, i) => {
        const deltaValue = pt.renderDelta !== undefined ? pt.renderDelta : pt.delta;
        const ptX = getX(i);
        const ptY = deltaToY(deltaValue || 0);
        const dx = x - ptX;
        const dy = y - ptY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist < CONFIG.CLICK_DISTANCE_THRESHOLD) {
            minDist = dist;
            closestIdx = i;
        }
    });

    if (closestIdx === -1) { return; }

    const clickedPt = dataPoints[closestIdx];
    const splitIndex = clickedPt.index;
    const splitsBody = DOM.get('splits-body');
    if (!splitsBody) { return; }

    const isCurrentlySelected = state.selectedGraphPointIdx === closestIdx || state.selectedSplitIdx === splitIndex;

    if (isCurrentlySelected) {
        state.selectedGraphPointIdx = null;
        state.selectedSplitIdx = null;
        splitsBody.querySelectorAll('.cell-name.active-split').forEach(el => el.classList.remove('active-split'));
        splitsBody.querySelectorAll('.row-subsplit.selected').forEach(el => el.classList.remove('selected'));

        if (state.settings.showGraph) { drawComparisonGraph(); }

        setTimeout(() => {
            scrollToActiveSplit();
        }, 50);
        return;
    }

    state.selectedGraphPointIdx = closestIdx;
    state.selectedSplitIdx = splitIndex;

    splitsBody.querySelectorAll('.cell-name.active-split').forEach(el => el.classList.remove('active-split'));
    splitsBody.querySelectorAll('.row-subsplit.selected').forEach(el => el.classList.remove('selected'));

    const clickedRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"]`);

    if (clickedRow) { clickedRow.classList.add('selected'); }

    // Apply active-split to the section name, not to the subsplit
    const newSectionRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"]`);
    const newSectionName = newSectionRow ? newSectionRow.getAttribute('data-section') : null;

    const clickedSectionRow = splitsBody.querySelector(`.row-section[data-section-name="${newSectionName}"] .cell-name`);
    if (clickedSectionRow) { clickedSectionRow.classList.add('active-split'); }

    if (newSectionName) {
        state.expandedSections.clear();
        state.expandedSections.add(newSectionName);
    }

    splitsBody.querySelectorAll('.row-section').forEach(sec => {
        const secName = sec.getAttribute('data-section-name');
        if (secName) { updateSectionVisibility(secName); }
    });

    setTimeout(() => {
        scrollToSelectedSplit();
    }, 50);

    if (state.settings.showGraph) { drawComparisonGraph(); }
}

/* ==================== FUNÇÕES DE TIMER ==================== */
function updateTimer() {
    const timerEl = DOM.get('timer');
    const deltaEl = DOM.get('timer-delta-live');

    if (state.timerState === 'Running') {
        const nowTime = performance.now();
        const elapsed = state.lastTime + (nowTime - state.lastTs);
        const { timePart, msPart } = TimeUtils.formatTimer(elapsed);

        let currentDelta = 0;
        if (state.runData && state.runData.run) {
            const curIdx = state.runData.currentSplitIndex ?? -1;
            if (curIdx >= 0 && curIdx < state.runData.run.segments.length) {
                const segment = state.runData.run.segments[curIdx];
                const pb = segment?.comparisons?.['Personal Best']?.realTime;
                if (pb) {
                    currentDelta = elapsed - pb;
                    state.currentDelta = currentDelta;
                }
            }
        }

        const deltaClass = currentDelta <= 0 ? 'ahead' : 'behind';
        timerEl.className = `timer-text ${deltaClass}`;
        timerEl.innerHTML = `${timePart}<span class="timer-ms">.${msPart}</span>`;
        if (currentDelta !== 0) {
            deltaEl.textContent = TimeUtils.formatDelta(currentDelta);
            deltaEl.className = `timer-delta-live ${deltaClass}`;
        } else {
            deltaEl.textContent = '-';
            deltaEl.className = 'timer-delta-live';
        }
        if (state.runData && (nowTime - lastGraphDraw) >= CONFIG.GRAPH_DRAW_THROTTLE) {
            updatePredictionDisplay();
            if (state.settings.showGraph) { drawComparisonGraph(); }
            lastGraphDraw = nowTime;
        }
    } else if (state.timerState === 'Paused') {
        const { timePart, msPart } = TimeUtils.formatTimer(state.lastTime);

        if (state.runData && state.runData.run) {
            const curIdx = state.runData.currentSplitIndex ?? -1;
            if (curIdx >= 0) {
                const segment = state.runData.run.segments[Math.max(0, curIdx - 1)];
                const pb = segment?.comparisons?.['Personal Best']?.realTime;
                if (pb) {
                    state.currentDelta = state.lastTime - pb;
                }
            }
        }

        timerEl.className = 'timer-text paused';
        timerEl.innerHTML = `${timePart}<span class="timer-ms">.${msPart}</span>`;
        if (state.currentDelta !== 0) {
            deltaEl.textContent = TimeUtils.formatDelta(state.currentDelta);
            deltaEl.className = 'timer-delta-live ' + (state.currentDelta <= 0 ? 'ahead' : 'behind');
        } else {
            deltaEl.textContent = '-';
            deltaEl.className = 'timer-delta-live paused';
        }
    } else if (state.timerState === 'Ended') {
        const { timePart, msPart } = TimeUtils.formatTimer(state.lastTime);
        let finalDelta = state.currentDelta ?? 0;

        if (finalDelta === 0 && state.runData && state.runData.run) {
            const run = state.runData.run;
            const lastIdx = (state.runData.currentSplitIndex ?? run.segments.length) - 1;
            if (lastIdx >= 0 && run.segments[lastIdx]) {
                const lastSeg = run.segments[lastIdx];
                const pb = lastSeg?.comparisons?.['Personal Best']?.realTime;
                const act = lastSeg?.splitTime?.realTime;
                if (typeof pb === 'number' && typeof act === 'number') {
                    finalDelta = act - pb;
                } else {
                    finalDelta = 0;
                }
            }
        }

        state.currentDelta = finalDelta;
        const deltaClass = finalDelta <= 0 ? 'ahead' : 'behind';
        timerEl.className = `timer-text ${deltaClass}`;
        timerEl.innerHTML = `${timePart}<span class="timer-ms">.${msPart}</span>`;
        deltaEl.textContent = TimeUtils.formatDelta(finalDelta);
        deltaEl.className = `timer-delta-live ${deltaClass}`;
    } else if (state.timerState === 'NotRunning') {
        timerEl.className = 'timer-text';
        timerEl.innerHTML = '0:00<span class="timer-ms">.00</span>';
        deltaEl.textContent = '-';
        deltaEl.className = 'timer-delta-live';
    }
    requestAnimationFrame(updateTimer);
}

/* ==================== FUNÇÕES DE CONFIGURAÇÃO ==================== */
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('livesplit-settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            state.settings = {
                theme: parsed.theme || 'default',
                language: parsed.language || null,  // Load saved language
                showGraph: parsed.showGraph !== undefined ? parsed.showGraph : true,
                showTable: parsed.showTable !== undefined ? parsed.showTable : true,
                showControls: parsed.showControls !== undefined ? parsed.showControls : true,
                alwaysExpandedSplits: parsed.alwaysExpandedSplits !== undefined ? parsed.alwaysExpandedSplits : false,
                wsUrl: parsed.wsUrl || 'ws://localhost:15721',
                chromaKey: parsed.chromaKey || {
                    enabled: false
                }
            };

            if (parsed.wsUrl) {
                CONFIG.WS_URL = parsed.wsUrl;
            }

            if (parsed.uiState) {
                state.expandedSections = new Set(parsed.uiState.expandedSections || []);
                state.selectedSplitIdx = parsed.uiState.selectedSplitIdx || null;
            }

            applyTheme(state.settings.theme);
        } else {
            // No saved settings, use defaults
            state.settings = {
                theme: 'default',
                language: null,  // Will be detected by initLanguage
                showGraph: true,
                showTable: true,
                showControls: true,
                wsUrl: 'ws://localhost:15721',
                chromaKey: {
                    enabled: false
                }
            };
        }
    } catch (err) {
        console.error('Error loading settings:', err);
        state.settings = {
            theme: 'default',
            language: null,
            showGraph: true,
            showTable: true,
            showControls: true,
            wsUrl: 'ws://localhost:15721',
            chromaKey: {
                enabled: false
            }
        };
        applyTheme('default');
    }
}

function saveSettings() {
    try {
        const uiState = {
            expandedSections: Array.from(state.expandedSections),
            selectedSplitIdx: state.selectedSplitIdx,
            graphHeight: localStorage.getItem('ls_graph_height'),
            lastSaved: Date.now()
        };

        const allSettings = {
            ...state.settings,
            uiState: uiState
        };

        localStorage.setItem('livesplit-settings', JSON.stringify(allSettings));
        // DOM.showSuccess('Settings saved successfully');
    } catch (err) {
        console.error('Failed to save settings:', err);
        DOM.showError('Could not save settings');
    }
}

function applyChromaKey() {
    const lsWindow = document.getElementById('ls-window');
    if (!lsWindow) { return; }

    const isEnabled = state.settings.chromaKey.enabled;

    if (isEnabled) {
        lsWindow.classList.add('chroma-key-enabled');
    } else {
        lsWindow.classList.remove('chroma-key-enabled');
    }
}

function setupChromaKeyControls() {
    const toggleChromaKey = DOM.get('toggle-chroma-key');

    if (toggleChromaKey) {
        toggleChromaKey.checked = state.settings.chromaKey.enabled !== false;

        toggleChromaKey.addEventListener('change', function () {
            state.settings.chromaKey.enabled = this.checked;
            saveSettings();
            applyChromaKey();
            hideModalWithToast(translate(this.checked ? 'notification_chroma_key_enabled' : 'notification_chroma_key_disabled'));
        });
    }

    applyChromaKey();
}

function _setupConnectionConfig() {
    const domainInput = DOM.get('connection-domain');
    const portInput = DOM.get('connection-port');
    const testButton = DOM.get('test-connection');

    function loadCurrentUrl() {
        const currentUrl = state.settings.wsUrl || CONFIG.WS_URL;
        let domain = 'localhost';
        let port = '15721';

        if (currentUrl && currentUrl.startsWith('ws://')) {
            const urlParts = currentUrl.replace('ws://', '').split(':');
            if (urlParts.length === 2) {
                domain = urlParts[0];
                port = urlParts[1];
            }
        }

        if (domainInput) { domainInput.value = domain; }
        if (portInput) { portInput.value = port; }
    }

    function buildUrl() {
        const domain = domainInput?.value?.trim() || 'localhost';
        const port = portInput?.value?.trim() || '15721';
        if (!domain || !port) { return null; }
        return `ws://${domain}:${port}`;
    }

    if (testButton) {
        const newTestButton = testButton.cloneNode(true);
        testButton.parentNode.replaceChild(newTestButton, testButton);

        newTestButton.addEventListener('click', async () => {
            const url = buildUrl();
            if (!url) {
                DOM.showError('Invalid URL');
                return;
            }

            const success = await connectionManager.testConnection(url);

            if (success) {
                state.settings.wsUrl = url;
                CONFIG.WS_URL = url;
                saveSettings();
            }
        });
    }

    loadCurrentUrl();

    return {
        buildUrl,
        loadCurrentUrl
    };
}

function clearConnectionStatus() {
    const testButton = DOM.get('test-connection');
    if (testButton) {
        testButton.classList.remove('testing', 'success', 'error');
        testButton.disabled = false;
        testButton.textContent = translate('connection_test');
    }
}

function showSettingsModal() {
    const modal = DOM.get('settings-modal');
    const toggleGraph = DOM.get('toggle-graph');
    const toggleTable = DOM.get('toggle-table');
    const toggleControls = DOM.get('toggle-controls');
    const errorNotification = DOM.get('error-notification');

    if (modal) { modal.classList.add('show'); }
    if (toggleGraph) { toggleGraph.checked = state.settings.showGraph; }
    if (toggleTable) { toggleTable.checked = state.settings.showTable; }
    if (toggleControls) { toggleControls.checked = state.settings.showControls; }

    applyTheme(state.settings.theme);

    if (errorNotification) {
        if (!state.isConnected) {
            errorNotification.classList.add('show');
        } else {
            errorNotification.classList.remove('show');
        }
    }

    setTimeout(() => {
        const modalClose = DOM.get('modal-close');
        if (modalClose) {
            modalClose.focus();
        }
    }, 100);
}

function hideSettingsModal() {
    // If user is browsing themes, cancel the theme browse timeout
    if (isBrowsingThemes) {
        isBrowsingThemes = false;
        if (settingsModalTimeout) {
            clearTimeout(settingsModalTimeout);
            settingsModalTimeout = null;
        }
        if (themeAutoReopenTimeout) {
            clearTimeout(themeAutoReopenTimeout);
            themeAutoReopenTimeout = null;
        }
    }

    const modal = DOM.get('settings-modal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.classList.remove('show', 'modal-closing');
            resetModalState();
        }, 200);
    }
}

function resetModalState() {
    clearConnectionStatus();
}

function setupSettingsModal() {
    const modalClose = DOM.get('modal-close');
    const modalReset = DOM.get('modal-reset');
    const toggleGraph = DOM.get('toggle-graph');
    const toggleTable = DOM.get('toggle-table');
    const toggleControls = DOM.get('toggle-controls');

    // Language Selector Setup
    const languageSelector = document.getElementById('language-selector');
    const languageDropdown = document.getElementById('language-dropdown');
    const languageFlag = document.getElementById('language-flag');
    const languageCode = document.getElementById('language-code');

    // Translate language selector title
    if (languageSelector) {
        languageSelector.title = translate('language_selector_title') || 'Idioma';
    }

    console.log('[Language] Elements found:', {
        selector: !!languageSelector,
        dropdown: !!languageDropdown,
        flag: !!languageFlag,
        code: !!languageCode
    });

    if (languageSelector && languageDropdown) {
        console.log('[Language] Setting up click handlers');

        // Toggle dropdown
        languageSelector.addEventListener('click', (e) => {
            console.log('[Language] Selector clicked');
            e.stopPropagation();
            languageDropdown.classList.toggle('show');
        });

        // Handle language selection
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', () => {
                const selectedLang = option.dataset.lang;
                console.log('[Language] Selected:', selectedLang);
                setLanguage(selectedLang);
                updateLanguageSelector();
                languageDropdown.classList.remove('show');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!languageSelector.contains(e.target) && !languageDropdown.contains(e.target)) {
                languageDropdown.classList.remove('show');
            }
        });

        // Initialize language selector
        updateLanguageSelector();
        initLanguage();
    } else {
        console.warn('[Language] Elements not found');
    }

    setupAutoReconnectSettings();

    if (toggleGraph) {
        toggleGraph.checked = state.settings.showGraph !== false;
        toggleGraph.addEventListener('change', function () {
            state.settings.showGraph = this.checked;
            saveSettings();
            if (state.runData) { render(state.runData); }
            hideModalWithToast(translate(this.checked ? 'notification_graph_enabled' : 'notification_graph_disabled'));
        });
    }

    if (toggleTable) {
        toggleTable.checked = state.settings.showTable !== false;
        toggleTable.addEventListener('change', function () {
            state.settings.showTable = this.checked;
            saveSettings();
            if (state.runData) { render(state.runData); }
            hideModalWithToast(translate(this.checked ? 'notification_table_enabled' : 'notification_table_disabled'));
        });
    }

    if (toggleControls) {
        toggleControls.checked = state.settings.showControls !== false;
        toggleControls.addEventListener('change', function () {
            state.settings.showControls = this.checked;
            saveSettings();
            updateControlsVisibility();
            hideModalWithToast(translate(this.checked ? 'notification_controls_enabled' : 'notification_controls_disabled'));
        });
    }

    const toggleAlwaysExpanded = DOM.get('toggle-always-expanded');
    if (toggleAlwaysExpanded) {
        toggleAlwaysExpanded.checked = state.settings.alwaysExpandedSplits !== false;
        toggleAlwaysExpanded.addEventListener('change', function () {
            state.settings.alwaysExpandedSplits = this.checked;
            saveSettings();
            if (state.runData) { render(state.runData); }
        });
    }

    setupThemeSelector();
    setupChromaKeyControls();

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            // Stop any pending theme browse timeouts
            isBrowsingThemes = false;
            if (settingsModalTimeout) {
                clearTimeout(settingsModalTimeout);
                settingsModalTimeout = null;
            }
            if (themeAutoReopenTimeout) {
                clearTimeout(themeAutoReopenTimeout);
                themeAutoReopenTimeout = null;
            }

            clearConnectionStatus();

            if (toggleGraph) { toggleGraph.checked = state.settings.showGraph !== false; }
            if (toggleTable) { toggleTable.checked = state.settings.showTable !== false; }
            if (toggleControls) { toggleControls.checked = state.settings.showControls !== false; }
            if (toggleAlwaysExpanded) { toggleAlwaysExpanded.checked = state.settings.alwaysExpandedSplits !== false; }

            // Re-apply chroma key state
            applyChromaKey();

            hideSettingsModal();
            return;
        });
    }

    const domainInput = DOM.get('connection-domain');
    const portInput = DOM.get('connection-port');
    if (domainInput && portInput) {
        const currentUrl = state.settings.wsUrl || CONFIG.WS_URL;
        let domain = 'localhost';
        let port = '15721';

        if (currentUrl && currentUrl.startsWith('ws://')) {
            const urlParts = currentUrl.replace('ws://', '').split(':');
            if (urlParts.length === 2) {
                domain = urlParts[0];
                port = urlParts[1];
            }
        }

        domainInput.value = domain;
        portInput.value = port;
    }

    if (modalReset) {
        modalReset.addEventListener('click', async () => {
            // First ask about IP and Port
            const keepIpPort = confirm(
                translate('reset_ip_port_title') + '\n\n' +
                translate('reset_ip_port_message') + '\n\n' +
                translate('reset_keep_current') + ': ' + (domainInput?.value || 'localhost') + ':' + (portInput?.value || '15721') + '\n' +
                translate('reset_restore_default') + ': localhost:15721'
            );

            // Then ask about resetting all settings
            if (confirm(translate('reset_warning'))) {
                const wsUrl = keepIpPort && domainInput?.value && portInput?.value
                    ? `ws://${domainInput.value}:${portInput.value}`
                    : 'ws://localhost:15721';

                state.settings = {
                    theme: 'default',
                    showGraph: true,
                    showTable: true,
                    showControls: true,
                    alwaysExpandedSplits: false,
                    wsUrl: wsUrl,
                    chromaKey: {
                        enabled: false
                    }
                };

                state.expandedSections.clear();
                state.selectedSplitIdx = null;
                state.selectedGraphPointIdx = null;

                saveSettings();

                applyTheme('default');

                updateThemeDisplay('default');

                if (toggleGraph) { toggleGraph.checked = true; }
                if (toggleTable) { toggleTable.checked = true; }
                if (toggleControls) { toggleControls.checked = true; }
                if (toggleAlwaysExpanded) { toggleAlwaysExpanded.checked = false; }

                const newDomainInput = DOM.get('connection-domain');
                const newPortInput = DOM.get('connection-port');
                if (keepIpPort && newDomainInput && newPortInput) {
                    newDomainInput.value = domainInput.value;
                    newPortInput.value = portInput.value;
                } else {
                    if (newDomainInput) { newDomainInput.value = 'localhost'; }
                    if (newPortInput) { newPortInput.value = '15721'; }
                }

                applyChromaKey();

                CONFIG.WS_URL = wsUrl;

                if (state.runData) { render(state.runData); }

                updateControlsVisibility();

                connectionManager.disconnect('Resetting settings');

                await new Promise(resolve => {
                    setTimeout(resolve, 500);
                });

                const testButton = DOM.get('test-connection');
                if (testButton) {
                    connectionManager.testConnection(wsUrl).then(() => {
                        setTimeout(() => {
                            connectionManager.connect(wsUrl);
                        }, 1000);
                    });
                }
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        const modal = DOM.get('settings-modal');
        if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
            clearConnectionStatus();
            hideSettingsModal();
        }
    });

    const modal = DOM.get('settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                clearConnectionStatus();
                hideSettingsModal();
            }
        });
    }
}

function startConnectionMonitor() {
    connectionMonitorInterval = setInterval(() => {
        if (!state.isConnected && !state.isConnecting && !state.manualDisconnect) {
            const modal = DOM.get('settings-modal');
            // Só mostrar se o modal não estiver já aberto
            if (modal && !modal.classList.contains('show')) {
                console.log('[Monitor] No active connection, checking if settings should be shown...');
                // Esperar um pouco antes de mostrar para evitar pop-ups imediatos
                setTimeout(() => {
                    if (!state.isConnected && !state.isConnecting) {
                        console.log('[Monitor] Showing connection settings');
                        showSettingsModal();
                    }
                }, 2000);
            }
        }
    }, 30000); // Verificar a cada 30 segundos
}

/* ==================== EXPORT MANAGER ==================== */
const ExportManager = {
    // Configuration
    HTML2CANVAS_URL: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    CONTAINER_WIDTH: 500,
    GRAPH_EXPORT_HEIGHT: 300,
    GRAPH_MIN_HEIGHT: 80,
    GRAPH_MAX_HEIGHT: 400,
    CAPTURE_TIMEOUT: 5000,
    BOM: '\uFEFF',

    // State
    isExporting: false,
    currentSnapshot: null,

    /**
     * Export as Image
     */
    async exportAsImage() {
        if (this.isExporting) {
            console.warn('[Export] Export already in progress');
            return;
        }

        this.isExporting = true;
        this.setButtonState('export-image', 'loading', 'Capturando...');

        try {
            const startTime = Date.now();

            // Validate
            await this.validateImageData();

            // Load library
            await this.loadHtml2Canvas();

            // Prepare DOM
            const snapshot = await this.prepareDOMForExport();

            // Set up graph for export
            await this.setupGraphForExport(snapshot);

            // Capture
            const canvas = await this.captureDOM(snapshot);

            // Download
            await this.downloadImage(canvas);

            const duration = (Date.now() - startTime) / 1000;
            console.log(`[Export] Image export completed in ${duration.toFixed(2)}s`);
            DOM.showSuccess(translate('notification_capture_success'));

        } catch (error) {
            console.error('[Export] Image export failed:', error);
            DOM.showError(translate('notification_export_failed') + ': ' + (error.message || ''));
        } finally {
            await this.restoreDOM();
            this.setButtonState('export-image', 'ready', 'Imagem');
            this.isExporting = false;
        }
    },

    /**
     * Export as CSV
     */
    async exportAsCSV() {
        if (this.isExporting) {
            console.warn('[Export] Export already in progress');
            return;
        }

        this.isExporting = true;
        this.setButtonState('export-text', 'loading', 'Gerando...');

        try {
            console.log('[Export] Starting CSV export...');

            // Validate
            await this.validateCSVData();

            // Get data
            const runData = this.getRunData();
            const subsplits = this.getValidSubsplits(runData.run.segments);

            // Determine export type
            const isSubsplitExport = subsplits.length > 0;
            const groupName = isSubsplitExport ? 'Subsplits' : 'Segments';

            // If no subsplits, export all segments
            const dataToExport = isSubsplitExport ? subsplits : runData.run.segments;

            if (dataToExport.length === 0) {
                throw new Error('No segments found for export');
            }

            // Generate content
            const csvContent = this.generateCSVContent(dataToExport, groupName);

            // Download
            this.downloadCSVFile(csvContent, runData.run.gameName, groupName);

            console.log(`[Export] CSV export completed: ${dataToExport.length} ${groupName.toLowerCase()}`);

        } catch (error) {
            console.error('[Export] CSV export failed:', error);
            DOM.showError(translate('notification_export_failed') + ': ' + (error.message || ''));
        } finally {
            this.setButtonState('export-text', 'ready', 'Texto');
            this.isExporting = false;
        }
    },

    // ========================================
    // VALIDATION METHODS
    // ========================================

    /**
     * Validate image export data
     */
    async validateImageData() {
        if (!state.runData) {
            throw new Error('No data available for export');
        }
        if (!state.runData.run) {
            throw new Error('Invalid run data');
        }
        if (!state.runData.run.segments || state.runData.run.segments.length === 0) {
            throw new Error('No segments found');
        }
    },

    /**
     * Validate CSV export data
     */
    async validateCSVData() {
        if (!state.runData) {
            throw new Error('No data available for export');
        }
        if (!state.runData.run) {
            throw new Error('Invalid run data');
        }
    },

    /**
     * Get run data
     */
    getRunData() {
        return state.runData;
    },

    /**
     * Get valid subsplits (starting with '-')
     */
    getValidSubsplits(segments) {
        if (!segments || !Array.isArray(segments)) { return []; }

        return segments.filter(seg => {
            const name = seg.name ? seg.name.trim() : '';
            return name.startsWith('-') && name.length > 1;
        });
    },

    // ========================================
    // LIBRARY LOADING
    // ========================================

    /**
     * Load html2canvas library
     */
    async loadHtml2Canvas() {
        if (window.html2canvas) {
            return;
        }

        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.HTML2CANVAS_URL;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
        });
    },

    // ========================================
    // DOM PREPARATION
    // ========================================

    /**
     * Prepare DOM for export - returns snapshot
     */
    async prepareDOMForExport() {
        const snapshot = {
            container: document.getElementById('ls-window'),
            graphContainer: DOM.get('graph-container'),
            graphWrapper: document.getElementById('graph-wrapper'),
            canvas: DOM.get('comparison-graph'),
            splitsContainer: document.querySelector('.splits-container'),
            controlsContainer: document.querySelector('.controls-container'),
            controlsWrapper: document.querySelector('.controls-wrapper'),
            expandedSections: new Set(state.expandedSections),
            styles: {}
        };

        if (!snapshot.container) {
            throw new Error('Container not found');
        }

        // Save original styles
        snapshot.styles.container = {
            width: snapshot.container.style.width,
            height: snapshot.container.style.height,
            overflow: snapshot.container.style.overflow
        };

        if (snapshot.graphWrapper) {
            snapshot.styles.graphWrapper = {
                height: snapshot.graphWrapper.style.height
            };
        }

        if (snapshot.graphContainer) {
            snapshot.styles.graphContainer = {
                display: snapshot.graphContainer.style.display
            };
        }

        if (snapshot.controlsWrapper) {
            snapshot.styles.controlsWrapper = {
                display: window.getComputedStyle(snapshot.controlsWrapper).display
            };
        }

        // Expand all sections
        this.expandAllSections();
        await this.wait(100);

        // Set container dimensions
        snapshot.container.style.width = this.CONTAINER_WIDTH + 'px';
        snapshot.container.style.overflow = 'visible';
        snapshot.container.style.height = 'auto';

        // Add export mode class to remove safe area padding
        if (snapshot.splitsContainer) {
            snapshot.splitsContainer.classList.add('export-mode');
            snapshot.splitsContainer.style.overflow = 'hidden';
            snapshot.splitsContainer.style.paddingBottom = '0px';
        }

        // Hide controls wrapper during export to remove empty space
        if (snapshot.controlsWrapper) {
            snapshot.controlsWrapper.classList.add('export-mode');
            snapshot.controlsWrapper.style.display = 'none';
        }

        // Show graph
        if (snapshot.graphContainer) {
            snapshot.graphContainer.style.display = 'block';
        }

        // Set graph export height
        if (snapshot.graphWrapper) {
            snapshot.graphWrapper.style.height = this.GRAPH_EXPORT_HEIGHT + 'px';
        }

        // Store snapshot for restoreDOM
        this.currentSnapshot = snapshot;

        return snapshot;
    },

    /**
     * Set up graph for export
     */
    async setupGraphForExport(snapshot) {
        console.log('[Export] Setting up graph for export...');

        const { canvas, graphWrapper } = snapshot;

        if (!canvas || !graphWrapper) {
            console.log('[Export] Graph elements not found, skipping');
            return;
        }

        // Wait for layout
        await this.wait(200);

        // Get dimensions
        const dpr = window.devicePixelRatio || 1;
        const wrapperRect = graphWrapper.getBoundingClientRect();

        // Resize canvas
        canvas.width = wrapperRect.width * dpr;
        canvas.height = this.GRAPH_EXPORT_HEIGHT * dpr;

        // Clear and set context
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        // Draw graph
        drawComparisonGraph();

        // Wait for render
        await this.wait(300);
    },

    /**
     * Expand all sections
     */
    expandAllSections() {
        if (state.runData?.run?.segments) {
            const allSections = new Set();
            state.runData.run.segments.forEach(seg => {
                const sec = DOM.extractSectionName(seg.name);
                if (sec) { allSections.add(sec); }
            });
            state.expandedSections = allSections;
            render(state.runData);
        }
    },

    // ========================================
    // CAPTURE
    // ========================================

    /**
     * Capture DOM as image
     */
    async captureDOM(snapshot) {
        const options = {
            scale: 2,
            backgroundColor: '#050505',
            width: this.CONTAINER_WIDTH,
            height: snapshot.container.scrollHeight,
            useCORS: true,
            logging: false,
            timeout: this.CAPTURE_TIMEOUT,
            ignoreElements: (element) => {
                const className = String(element.className || '');
                return className.includes('settings-toggle') ||
                    className.includes('control-btn') ||
                    className.includes('graph-resizer') ||
                    className.includes('export-button');
            },
            onclone: (doc, _element) => {
                const style = doc.createElement('style');
                style.textContent = this.getExportCSS();
                doc.head.appendChild(style);
            }
        };

        const canvas = await Promise.race([
            html2canvas(snapshot.container, options),
            this.createTimeout(this.CAPTURE_TIMEOUT)
        ]);

        return canvas;
    },

    /**
     * Get export CSS
     */
    getExportCSS() {
        return `
            .timer-text {
                font-size: 56px !important;
                font-weight: 800 !important;
                line-height: 0.9 !important;
                letter-spacing: -1px !important;
                font-family: 'Consolas', 'Courier New', monospace !important;
            }
            .timer-ms {
                font-size: 28px !important;
            }
            .timer-delta-live {
                font-size: 32px !important;
                font-weight: 700 !important;
                letter-spacing: -0.5px !important;
                font-family: 'Consolas', 'Courier New', monospace !important;
            }
            .game-title {
                font-size: 16px !important;
                font-weight: 600 !important;
            }
            .cell-timer, .cell-delta {
                font-size: 14px !important;
                font-family: 'Consolas', 'Courier New', monospace !important;
            }
            .cell-name {
                font-size: 14px !important;
            }
            .row-section .cell-timer {
                font-size: 16px !important;
                font-weight: 700 !important;
            }
            .meta-grid, #pb-display {
                font-size: 12px !important;
            }
            #comparison-graph {
                width: 100% !important;
                height: 100% !important;
                display: block !important;
            }
            .graph-container {
                display: block !important;
            }
            .graph-canvas-wrapper {
                height: ${this.GRAPH_EXPORT_HEIGHT}px !important;
                max-height: ${this.GRAPH_EXPORT_HEIGHT}px !important;
                min-height: ${this.GRAPH_EXPORT_HEIGHT}px !important;
            }
            #graph-wrapper {
                height: ${this.GRAPH_EXPORT_HEIGHT}px !important;
            }
            body, #ls-window, .timer-container, .header, .graph-container {
                transform: none !important;
                zoom: 1 !important;
            }
            button, .settings-toggle, .control-btn, .graph-resizer, .export-button {
                display: none !important;
            }
        `;
    },

    /**
     * Create timeout promise
     */
    createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Capture timeout after ${ms}ms`));
            }, ms);
        });
    },

    // ========================================
    // DOWNLOAD
    // ========================================

    /**
     * Download image
     */
    async downloadImage(canvas) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const gameName = state.runData?.run?.gameName || 'LiveSplit';
        const fileName = `livesplit-${gameName.replace(/\s+/g, '-')}-${timestamp}.png`;

        try {
            const dataUrl = canvas.toDataURL('image/png');

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
            }, 200);

        } catch (error) {
            console.error('[Export] Failed to download image:', error);
            throw new Error('Failed to download image: ' + error.message);
        }
    },

    /**
     * Generate CSV content
     * @param {Array} segments - Segments to export
     * @param {string} [groupName] - Optional group name for the export type
     */
    generateCSVContent(segments, groupName) {
        const headers = ['Nome', 'Tempo PB', 'Tempo Atual', 'Delta'];
        const headerRow = headers.map(h => this.escapeCSVValue(h)).join(';');

        const rows = segments.map(seg => {
            // Only remove "-" prefix if it's a subsplit (starts with "-")
            let name = seg.name.trim();
            const isSubsplit = name.startsWith('-');
            if (isSubsplit) {
                name = name.replace(/^-/, '').trim();
            }

            const pbTime = seg.comparisons?.['Personal Best']?.realTime;
            const actTime = seg.splitTime?.realTime;

            const pbFormatted = pbTime ? TimeUtils.formatSplit(pbTime) : '-';
            const actFormatted = actTime ? TimeUtils.formatSplit(actTime) : '-';

            let deltaFormatted = '-';
            if (pbTime && actTime) {
                const diff = actTime - pbTime;
                deltaFormatted = TimeUtils.formatDelta(diff);
            }

            return [
                this.escapeCSVValue(name),
                this.escapeCSVValue(pbFormatted),
                this.escapeCSVValue(actFormatted),
                this.escapeCSVValue(deltaFormatted)
            ].join(';');
        });

        return this.BOM + [headerRow, ...rows].join('\r\n');
    },

    /**
     * Download CSV file
     * @param {string} content - CSV content
     * @param {string} gameName - Game name
     * @param {string} [groupName] - Optional group name for file naming (default: 'segments')
     */
    downloadCSVFile(content, gameName, groupName) {
        const typeName = (groupName || 'segments').replace(/\s+/g, '_').toLowerCase();
        const timestamp = new Date().toLocaleString('pt-BR')
            .replace(/[/:\\]/g, '-')
            .replace(/,/g, '');
        const fileName = `${typeName}_${(gameName || 'LiveSplit').replace(/\s+/g, '_')}_${timestamp}.csv`;

        const blob = new Blob([content], {
            type: 'text/csv;charset=utf-8'
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(link.href), 100);
    },

    /**
     * Escape CSV value
     */
    escapeCSVValue(str) {
        if (str === null || str === undefined) { return ''; }
        const strValue = String(str);
        if (/[";,\r\n]/.test(strValue)) {
            return '"' + strValue.replace(/"/g, '""') + '"';
        }
        return strValue;
    },

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Restore DOM state
     */
    async restoreDOM() {
        const container = document.getElementById('ls-window');
        const graphContainer = DOM.get('graph-container');
        const graphWrapper = document.getElementById('graph-wrapper');
        const splitsContainer = document.querySelector('.splits-container');
        const controlsWrapper = document.querySelector('.controls-wrapper');

        if (container) {
            container.style.width = '';
            container.style.overflow = '';
            container.style.height = '';
        }

        if (graphContainer) {
            graphContainer.style.display = '';
        }

        if (graphWrapper) {
            graphWrapper.style.height = '';
        }

        // Remove export mode class and restore styles
        if (splitsContainer) {
            splitsContainer.classList.remove('export-mode');
            splitsContainer.style.overflow = '';
            splitsContainer.style.paddingBottom = '';
        }

        // Restore controls wrapper visibility
        if (controlsWrapper) {
            controlsWrapper.classList.remove('export-mode');
            controlsWrapper.style.display = this.currentSnapshot?.styles?.controlsWrapper?.display || '';
        }

        // Clear snapshot reference
        this.currentSnapshot = null;

        // Restore expanded sections
        if (state.runData?.run?.segments) {
            render(state.runData);
        }

        await this.wait(100);
    },

    // ========================================
    // UTILITIES
    // ========================================

    /**
     * Set button state
     */
    setButtonState(btnId, state, text) {
        const btn = document.getElementById(btnId);
        if (!btn) { return; }

        const textSpan = btn.querySelector('.export-button-text');

        if (state === 'loading') {
            btn.classList.add('exporting');
            btn.disabled = true;
            if (textSpan) {
                textSpan.textContent = text;
            }
        } else {
            btn.classList.remove('exporting');
            btn.disabled = false;
            if (textSpan) {
                textSpan.textContent = text;
            }
        }
    },

    /**
     * Wait helper
     */
    wait(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
};

/* ==================== EXPORT FUNCTIONS ==================== */
function setupExportButtons() {
    const exportImageBtn = document.getElementById('export-image');
    const exportTextBtn = document.getElementById('export-text');

    if (exportImageBtn) {
        exportImageBtn.addEventListener('click', async () => {
            await ExportManager.exportAsImage();
        });
    }

    if (exportTextBtn) {
        exportTextBtn.addEventListener('click', () => {
            ExportManager.exportAsCSV();
        });
    }
}

/* ==================== AUXILIARY FUNCTIONS ==================== */
function cleanup() {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
    }

    if (connectionManager.healthCheckInterval) {
        clearInterval(connectionManager.healthCheckInterval);
        connectionManager.healthCheckInterval = null;
    }

    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }

    if (state.graphAnimationFrame) {
        cancelAnimationFrame(state.graphAnimationFrame);
        state.graphAnimationFrame = null;
    }

    state.graphData = null;

    const canvas = DOM.get('comparison-graph');
    if (canvas) {
        canvas.onclick = null;
        canvas.ontouchend = null;
    }

    Object.keys(domCache).forEach(key => {
        delete domCache[key];
    });
}

function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (state.runData && state.settings.showGraph) { drawComparisonGraph(); }
    }, CONFIG.RESIZE_DEBOUNCE);
}

function setupGraphResizer() {
    const wrapper = document.getElementById('graph-wrapper');
    const resizer = document.getElementById('graph-resizer');
    if (!wrapper || !resizer) { return; }

    const MIN = 80;
    const MAX = 400;
    const saved = parseInt(localStorage.getItem('ls_graph_height'), 10);
    if (!isNaN(saved) && saved >= MIN && saved <= MAX) {
        wrapper.style.height = saved + 'px';
    }

    let dragging = false;
    let startY = 0;
    let startH = 0;
    let graphRedrawReq = null;

    function onPointerMove(ev) {
        if (!dragging) { return; }
        ev.preventDefault();

        const dy = (ev.clientY - startY);
        const newH = Math.round(Math.max(MIN, Math.min(MAX, startH + dy)));
        wrapper.style.height = newH + 'px';

        // Throttle graph redraw to 60fps using requestAnimationFrame
        if (!graphRedrawReq && state.runData && state.settings.showGraph) {
            graphRedrawReq = requestAnimationFrame(() => {
                drawComparisonGraph();
                graphRedrawReq = null;
            });
        }
    }

    function onPointerUp(_ev) {
        if (!dragging) { return; }
        dragging = false;
        resizer.classList.remove('active');

        wrapper.classList.remove('dragging');

        if (graphRedrawReq) {
            cancelAnimationFrame(graphRedrawReq);
            graphRedrawReq = null;
        }

        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove);
        document.removeEventListener('touchend', onPointerUp);
        document.removeEventListener('touchcancel', onPointerUp);

        localStorage.setItem('ls_graph_height', parseInt(wrapper.getBoundingClientRect().height, 10));

        if (state.runData && state.settings.showGraph) {
            drawComparisonGraph();
        }
    }

    function onPointerDown(ev) {
        dragging = true;
        startY = ev.clientY || ev.touches[0].clientY;
        startH = wrapper.getBoundingClientRect().height;
        resizer.classList.add('active');

        wrapper.classList.add('dragging');

        try {
            if (ev.pointerId) {
                resizer.setPointerCapture(ev.pointerId);
            }
        } catch (e) {
            // setPointerCapture may fail if element is not a valid target or pointerId is invalid
            console.warn('[Export] Failed to set pointer capture:', e);
        }

        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('touchend', onPointerUp);
        document.addEventListener('touchcancel', onPointerUp);

        ev.preventDefault();
    }

    resizer.addEventListener('pointerdown', onPointerDown);
    resizer.addEventListener('touchstart', onPointerDown, { passive: false });

    resizer.addEventListener('click', (_ev) => {
        if (dragging) { return; }
        resizer.classList.add('active');
        setTimeout(() => resizer.classList.remove('active'), 1500);
    });
}

/* ==================== DEBUGGING UTILITIES ==================== */
const DebugUtils = {
    /**
     * Get detailed connection diagnostics
     * @returns {Object} Connection diagnostic information
     */
    getConnectionDiagnostics() {
        return {
            connectionState: connectionManager.connectionState,
            isConnected: state.isConnected,
            isConnecting: state.isConnecting,
            wsReadyState: connectionManager.ws?.readyState,
            wsUrl: CONFIG.WS_URL,
            reconnectAttempts: connectionManager.reconnectAttempts,
            lastMessageTime: connectionManager.lastMessageTime,
            timerState: state.timerState,
            runDataLoaded: !!state.runData,
            segmentsCount: state.runData?.run?.segments?.length || 0
        };
    },

    /**
     * Log detailed connection diagnostics
     */
    logConnectionDiagnostics() {
        const diagnostics = this.getConnectionDiagnostics();
        console.group('[Connection Diagnostics]');
        console.log('Connection State:', diagnostics.connectionState);
        console.log('Is Connected:', diagnostics.isConnected);
        console.log('Is Connecting:', diagnostics.isConnecting);
        console.log('WebSocket Ready State:', diagnostics.wsReadyState);
        console.log('WebSocket URL:', diagnostics.wsUrl);
        console.log('Reconnect Attempts:', diagnostics.reconnectAttempts);
        console.log('Last Message Time:', diagnostics.lastMessageTime ? new Date(diagnostics.lastMessageTime).toISOString() : 'Never');
        console.log('Timer State:', diagnostics.timerState);
        console.log('Run Data Loaded:', diagnostics.runDataLoaded);
        console.log('Segments Count:', diagnostics.segmentsCount);
        console.groupEnd();
    },

    /**
     * Test WebSocket connection manually
     * @param {string} url - WebSocket URL to test
     */
    async testConnection(url) {
        console.log(`[Debug] Testing connection to: ${url}`);
        return new Promise((resolve) => {
            const ws = new WebSocket(url);
            const timeout = setTimeout(() => {
                ws.close();
                resolve({ success: false, error: 'Timeout' });
            }, 3000);

            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve({ success: true });
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                ws.close();
                resolve({ success: false, error: 'Connection failed' });
            };
        });
    },

    /**
     * Enable verbose logging for debugging
     */
    enableVerboseLogging() {
        Logger.setEnabled(true);
        console.log('[Debug] Verbose logging enabled');
    },

    /**
     * Disable verbose logging
     */
    disableVerboseLogging() {
        Logger.setEnabled(false);
        console.log('[Debug] Verbose logging disabled');
    }
};

// Expose debug utilities to window for browser console access
if (typeof window !== 'undefined') {
    window.LiveSplitDebug = DebugUtils;
    window.getConnectionDiagnostics = DebugUtils.getConnectionDiagnostics;
    window.logConnectionDiagnostics = DebugUtils.logConnectionDiagnostics;
    window.testConnection = DebugUtils.testConnection;
}

/* ==================== INICIALIZAÇÃO ==================== */
function init() {
    loadSettings();
    currentLanguage = state.settings.language || 'pt-BR';
    applyTranslations();

    setupControls();
    setupSettingsModal();
    setupExportButtons(); // <-- Alterado aqui

    initWorldRecord();

    connectionManager.init();
    updateControlsVisibility();
    initializeLogReader();

    // Auto-connect to LiveSplit server on startup
    console.log('[App] Auto-connecting to LiveSplit server...');
    connectionManager.connect();

    setTimeout(() => {
        if (!state.isConnected && !state.isConnecting) {
            console.log('[Monitor] No connection established, opening settings...');
            showSettingsModal();
        }
    }, 3000);

    startConnectionMonitor();

    updateTimer();
    updatePredictionDisplay();

    const canvas = DOM.get('comparison-graph');
    if (canvas) {
        canvas.onclick = handleCanvasClick;
        canvas.ontouchend = handleCanvasClick;
    }

    window.addEventListener('resize', handleResize);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
