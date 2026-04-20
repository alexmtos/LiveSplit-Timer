"use strict";

/**
 * Translations module - i18n support for LiveSplit Timer UI
 * Provides language-specific strings for the UI.
 */

const _translations = {
    'pt-BR': {
        // General
        appName: 'LiveSplit Timer',
        loading: 'Carregando...',
        settings: 'Configurações',
        save: 'Salvar',
        cancel: 'Cancelar',
        reset: 'Resetar',
        close: 'Fechar',
        
        // Timer
        timer: 'Timer',
        start: 'Iniciar',
        pause: 'Pausar',
        stop: 'Parar',
        reset: 'Resetar',
        split: 'Split',
        skip: 'Pular',
        
        // Connection
        connected: 'Conectado',
        disconnected: 'Desconectado',
        connecting: 'Conectando...',
        connectionError: 'Erro de conexão',
        
        // Settings
        language: 'Idioma',
        theme: 'Tema',
        autoConnect: 'Conectar automaticamente',
        showGraph: 'Mostrar gráfico',
        
        // Errors
        errorLoadingSettings: 'Erro ao carregar configurações',
        errorSavingSettings: 'Erro ao salvar configurações',
        errorConnection: 'Erro ao conectar com LiveSplit'
    },
    'en-US': {
        // General
        appName: 'LiveSplit Timer',
        loading: 'Loading...',
        settings: 'Settings',
        save: 'Save',
        cancel: 'Cancel',
        reset: 'Reset',
        close: 'Close',
        
        // Timer
        timer: 'Timer',
        start: 'Start',
        pause: 'Pause',
        stop: 'Stop',
        reset: 'Reset',
        split: 'Split',
        skip: 'Skip',
        
        // Connection
        connected: 'Connected',
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        connectionError: 'Connection error',
        
        // Settings
        language: 'Language',
        theme: 'Theme',
        autoConnect: 'Auto-connect',
        showGraph: 'Show graph',
        
        // Errors
        errorLoadingSettings: 'Error loading settings',
        errorSavingSettings: 'Error saving settings',
        errorConnection: 'Error connecting to LiveSplit'
    }
};

// Default language
const DEFAULT_LANG = 'en-US';

/**
 * Get a translation string
 * @param {string} lang - Language code (e.g., 'pt-BR', 'en-US')
 * @param {string} key - Translation key
 * @returns {string} Translation string or key as fallback
 */
function getTranslation(lang, key) {
    const langData = _translations[lang] || _translations[DEFAULT_LANG];
    return langData[key] || key;
}

/**
 * Get all translations for a language
 * @param {string} lang - Language code
 * @returns {Object} Translation object
 */
function getTranslations(lang) {
    return { ...(_translations[lang] || _translations[DEFAULT_LANG]) };
}

/**
 * Get available languages
 * @returns {string[]} Array of language codes
 */
function getAvailableLanguages() {
    return Object.keys(_translations);
}

/**
 * Add or update translations for a language
 * @param {string} lang - Language code
 * @param {Object} strings - Key-value pairs of translations
 */
function setTranslations(lang, strings) {
    if (!_translations[lang]) {
        _translations[lang] = {};
    }
    Object.assign(_translations[lang], strings);
}

/**
 * Get the default language
 * @returns {string} Default language code
 */
function getDefaultLanguage() {
    return DEFAULT_LANG;
}

/**
 * Get a Proxy for TRANSLATIONS-style access (translations.lang.key)
 * This maintains backward compatibility with existing code that uses TRANSLATIONS.en.key
 * @param {string} lang - Language code
 * @returns {Proxy} Proxy object for chained access
 */
function createTranslationsProxy(lang) {
    return new Proxy({}, {
        get: (_, key) => {
            if (key === 'then' || key === 'catch') return undefined; // Prevent Promise-like behavior
            return getTranslation(lang, key);
        }
    });
}

/**
 * Create a multi-language Proxy that allows TRANSLATIONS[lang][key] access
 * @returns {Proxy}
 */
function createMultiLangProxy() {
    return new Proxy({}, {
        get: (_, lang) => {
            if (lang === 'then' || lang === 'catch') return undefined;
            return createTranslationsProxy(lang);
        }
    });
}

module.exports = {
    getTranslation,
    getTranslations,
    getAvailableLanguages,
    setTranslations,
    getDefaultLanguage,
    createTranslationsProxy,
    createMultiLangProxy
};
