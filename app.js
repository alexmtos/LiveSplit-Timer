/* ==================== CONFIGURAÇÃO ==================== */
const CONFIG = {
    WS_URL: 'ws://localhost:15721',
    RECONNECT_DELAY: 1000,
    MAX_AUTO_RECONNECT_ATTEMPTS: 3,
    GRAPH_DRAW_THROTTLE: 16,
    RESIZE_DEBOUNCE: 150,
    CLICK_DISTANCE_THRESHOLD: 15,
    AUTO_SHOW_SETTINGS_ON_DISCONNECT: true
};

/* ==================== CONSTANTES ==================== */
const THEMES = {
    default: { name: 'Padrão', colors: ['#00a2ff', '#40ff40', '#ff4040'] },
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
    timerState: "NotRunning",
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
    lastActiveSection: "",
    settings: {
        theme: 'default',
        showGraph: true,
        showTable: true,
        showControls: true,
        wsUrl: CONFIG.WS_URL
    },
    showConnectionError: false,
    graphAnimationFrame: null,
    canvasClickHandler: null
};

const domCache = {};
let resizeTimeout;
let lastGraphDraw = 0;
let connectionMonitorInterval = null;

/* ==================== UTILITÁRIOS ==================== */
const SECTION_REGEX = /\{([^}]*)\}/;
const SECTION_FULL_REGEX = /\{([^}]*)\}\s*(.*)/;

class DOM {
    static get(id) {
        if (!domCache[id]) {
            const el = document.getElementById(id);
            if (!el) console.warn(`Elemento não encontrado: ${id}`);
            domCache[id] = el;
        }
        return domCache[id];
    }

    static extractSectionName(name) {
        if (!name || typeof name !== 'string') return null;
        const match = name.match(SECTION_REGEX);
        return match ? match[1] : null;
    }

    static showError(message) {
        console.log(
            '%c[LiveSplit Error]%c ' + message,
            'background: #ff4040; color: white; padding: 2px 6px; border-radius: 3px;',
            'color: #ff4040;'
        );
    }

    static showSuccess(message) {
        console.log(
            '%c[LiveSplit Success]%c ' + message,
            'background: #40ff40; color: black; padding: 2px 6px; border-radius: 3px;',
            'color: #40ff40;'
        );
    }
}

class TimeUtils {
    static formatSplit(ms) {
        if (ms === null || ms === undefined) return "-";
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
        } else {
            return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
        }
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

    static formatDelta(ms) {
        if (ms === undefined || ms === null) return "-";

        const a = Math.abs(ms);
        const sign = ms >= 0 ? "+" : "-";

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
        } else {
            return `${sign}${seconds}.${deciseconds.toString().padStart(1, '0')}`;
        }
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

        this.autoReconnect = true;
        this.showSettingsOnDisconnect = true;
        this.connectionTimeoutMs = 5000;
        this.healthCheckIntervalMs = 30000;
    }

    // ==================== INICIALIZAÇÃO ====================
    init() {
        console.log('🔧 Inicializando ConnectionManager');
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
            console.error('Erro ao carregar configurações:', err);
        }
    }

    setupPageEvents() {
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);

        window.addEventListener('beforeunload', () => this.handleBeforeUnload());
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    setupEventListeners() {
        const testButton = document.getElementById('test-connection');
        if (testButton) {
            testButton.removeEventListener('click', this.handleTestConnection);
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
        this.cancelPendingReconnect();

        // ✅ CORREÇÃO: Remover esta verificação que impede tentativas
        // if (this.connectionState === 'connecting') {
        //     console.log('⚠️ Já está conectando...');
        //     return;
        // }

        // ✅ MANTER apenas esta verificação para evitar reconexões desnecessárias
        if (this.connectionState === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const currentUrl = this.ws.url;
            const newUrl = url || CONFIG.WS_URL;

            if (currentUrl === newUrl) {
                console.log('✅ Já conectado a esta URL');
                return;
            }
        }

        if (this.ws) {
            this.disconnect('Reconectando com nova URL');
        }

        const targetUrl = url || state.settings.wsUrl || CONFIG.WS_URL;

        if (url && url !== state.settings.wsUrl) {
            state.settings.wsUrl = url;
            CONFIG.WS_URL = url;
            saveSettings();
        }

        console.log(`🔗 Conectando a: ${targetUrl}`);
        this.updateConnectionState('connecting', `Conectando a ${targetUrl.replace('ws://', '')}`);

        try {
            this.ws = new WebSocket(targetUrl);

            this.connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                    console.warn('⏰ Timeout na conexão');
                    this.ws.close();
                    this.handleConnectionError('Timeout na conexão');
                }
            }, this.connectionTimeoutMs);

            this.ws.onopen = () => this.handleOpen();
            this.ws.onmessage = (e) => this.handleMessage(e);
            this.ws.onerror = (err) => this.handleError(err);
            this.ws.onclose = () => this.handleClose();

        } catch (error) {
            console.error('❌ Erro ao criar WebSocket:', error);
            this.handleConnectionError(`Erro: ${error.message}`);
        }
    }

    // ==================== HANDLERS DE EVENTOS WEBSOCKET ====================
    handleOpen() {
        console.log('✅ Conexão WebSocket aberta');
        clearTimeout(this.connectionTimeout);

        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.isManualDisconnect = false;
        this.lastMessageTime = Date.now();

        this.updateConnectionState('connected', 'Conectado ao LiveSplit');

        this.flushPendingMessages();

        state.isConnected = true;
        state.isConnecting = false;
        updateControlButtons();

        const errorNotification = document.getElementById('error-notification');
        if (errorNotification) {
            errorNotification.classList.remove('show');
        }
    }

    handleMessage(event) {
        this.lastMessageTime = Date.now();

        try {
            const data = JSON.parse(event.data);
            const timerData = data.state || data;

            state.timerState = timerData.timerState || "NotRunning";
            state.lastTime = timerData.currentTime?.realTime || 0;
            state.lastTs = performance.now();

            if (timerData.run) {
                state.runData = timerData;
                render(timerData);
            }

            updateControlButtons();

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error, event.data);
        }
    }

    handleError(error) {
        console.error('❌ Erro WebSocket:', error);

        clearTimeout(this.connectionTimeout);

        if (this.connectionState !== 'disconnecting') {
            this.handleConnectionError('Erro na conexão WebSocket');
        }
    }

    handleClose() {
        console.log('📴 Conexão WebSocket fechada');
        clearTimeout(this.connectionTimeout);

        if (this.isManualDisconnect) {
            this.updateConnectionState('disconnected', 'Desconectado manualmente');
            return;
        }

        this.handleConnectionLost('Conexão perdida');
    }

    showTestResult(result, message) {
        const indicatorDot = document.getElementById('connection-indicator-dot');
        const statusText = document.getElementById('connection-status-text');
        const testButton = document.getElementById('test-connection');

        if (indicatorDot && statusText) {
            indicatorDot.classList.remove('connected', 'connecting', 'error', 'testing');

            let statusMessage = message;
            let statusColor = '#888';

            switch (result) {
                case 'testing':
                    indicatorDot.classList.add('testing');
                    statusMessage = 'Testando conexão...';
                    statusColor = '#ffa500';
                    break;

                case 'success':
                    indicatorDot.classList.add('connected');
                    statusMessage = 'Teste bem-sucedido!';
                    statusColor = '#40ff40';
                    break;

                case 'error':
                    indicatorDot.classList.add('error');
                    statusMessage = message || 'Falha no teste';
                    statusColor = '#ff4040';
                    break;
            }

            statusText.textContent = statusMessage;
            statusText.style.color = statusColor;
        }

        if (testButton) {
            testButton.classList.remove('testing', 'success', 'error');

            switch (result) {
                case 'testing':
                    testButton.classList.add('testing');
                    testButton.textContent = 'Testando...';
                    testButton.disabled = true;
                    break;

                case 'success':
                    testButton.classList.add('success');
                    testButton.textContent = '✓ Sucesso!';
                    testButton.disabled = false;
                    break;

                case 'error':
                    testButton.classList.add('error');
                    testButton.textContent = '✗ Falha';
                    testButton.disabled = false;
                    break;
            }

            if (result !== 'testing') {
                setTimeout(() => {
                    testButton.classList.remove('success', 'error');
                    testButton.textContent = 'Testar & Salvar';
                }, 2000);
            }
        }
    }

    // ==================== MANEJO DE ERROS E RECONEXÃO ====================
    handleConnectionError(message = 'Erro de conexão') {
        console.error(`❌ ${message}`);

        this.connectionState = 'error';
        state.isConnected = false;
        state.isConnecting = false;

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.updateConnectionState('error', message);

        this.attemptReconnectOrShowSettings();
    }

    handleConnectionLost(message = 'Conexão perdida') {
        console.warn(`⚠️ ${message}`);

        this.connectionState = 'disconnected';
        state.isConnected = false;
        state.isConnecting = false;

        this.updateConnectionState('disconnected', message);

        this.attemptReconnectOrShowSettings();
    }

    attemptReconnectOrShowSettings() {
        this.reconnectAttempts++;

        if (this.autoReconnect && this.reconnectAttempts <= this.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else {
            this.showConnectionError();

            if (this.showSettingsOnDisconnect) {
                setTimeout(() => {
                    this.showSettingsModal();
                }, 500);
            }

            state.showConnectionError = true;
        }
    }

    scheduleReconnect() {
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

        console.log(`🔄 Tentando reconectar em ${Math.round(delay / 1000)}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.updateConnectionState('connecting', `Reconectando em ${Math.round(delay / 1000)}s...`);

        this.reconnectTimer = setTimeout(() => {
            if (!this.isManualDisconnect && this.reconnectAttempts <= this.maxReconnectAttempts) {
                this.connect();
            }
        }, delay);
    }

    showConnectionError() {
        console.error(`❌ Não foi possível reconectar após ${this.maxReconnectAttempts} tentativas`);

        const errorNotification = document.getElementById('error-notification');
        if (errorNotification) {
            errorNotification.classList.add('show');
        }

        state.showConnectionError = true;

        this.updateConnectionState('error', 'Falha na conexão');

        if (this.showSettingsOnDisconnect) {
            setTimeout(() => {
                const modal = document.getElementById('settings-modal');
                if (modal && !modal.classList.contains('show')) {
                    this.showSettingsModal();
                }
            }, 1000);
        }
    }

    // ==================== CONTROLE DE CONEXÃO ====================
    disconnect(reason = 'Desconectado manualmente') {
        console.log(`📴 Desconectando: ${reason}`);

        this.isManualDisconnect = true;
        this.connectionState = 'disconnecting';

        // Cancelar timers
        this.cancelPendingReconnect();
        clearTimeout(this.connectionTimeout);

        // Fechar WebSocket
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onerror = null;
            this.ws.onclose = null;

            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }

            this.ws = null;
        }

        this.connectionState = 'disconnected';
        state.isConnected = false;
        state.isConnecting = false;

        this.updateConnectionState('disconnected', reason);
        updateControlButtons();

        cleanup();
    }

    cancelPendingReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // ==================== TESTE DE CONEXÃO ====================
    async testConnection(url) {
        if (!url || (!url.startsWith('ws://') && !url.startsWith('wss://'))) {
            this.showTestResult('error', 'URL deve começar com ws:// ou wss://');
            return false;
        }

        console.log(`🧪 Testando conexão: ${url}`);
        this.showTestResult('testing', 'Testando conexão...');

        return new Promise((resolve) => {
            let testWs = null;
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    console.warn('⏰ Timeout no teste de conexão');
                    if (testWs) testWs.close();
                    resolved = true;
                    this.showTestResult('error', 'Timeout no teste de conexão');
                    resolve(false);
                }
            }, 3000);

            try {
                testWs = new WebSocket(url);

                testWs.onopen = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);

                        console.log('✅ Teste de conexão bem-sucedido');

                        setTimeout(() => {
                            testWs.close();
                            this.showTestResult('success', 'Conexão testada com sucesso!');
                            resolve(true);
                        }, 100);
                    }
                };

                testWs.onerror = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        testWs.close();

                        console.error('❌ Teste de conexão falhou');
                        this.showTestResult('error', 'Falha no teste de conexão');
                        resolve(false);
                    }
                };

            } catch (error) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);

                    console.error('❌ Erro ao criar WebSocket de teste:', error);
                    this.showTestResult('error', 'Erro ao criar conexão');
                    resolve(false);
                }
            }
        });
    }

    // ==================== INTERFACE DO USUÁRIO ====================
    updateConnectionState(status, message = '') {
        const indicatorDot = document.getElementById('connection-indicator-dot');
        const statusText = document.getElementById('connection-status-text');
        const testButton = document.getElementById('test-connection');

        this.connectionState = status;

        if (indicatorDot && statusText) {
            indicatorDot.classList.remove('connected', 'connecting', 'error', 'testing');

            switch (status) {
                case 'connected':
                    indicatorDot.classList.add('connected');
                    indicatorDot.title = message || 'Conectado ao LiveSplit';
                    statusText.textContent = message || 'Conectado';
                    statusText.style.color = '#40ff40';
                    break;

                case 'connecting':
                    indicatorDot.classList.add('connecting');
                    indicatorDot.title = message || 'Conectando...';
                    statusText.textContent = message || 'Conectando...';
                    statusText.style.color = '#ffa500';
                    break;

                case 'testing':
                    break;

                case 'error':
                case 'disconnected':
                    indicatorDot.classList.add('error');
                    indicatorDot.title = message || 'Desconectado';
                    statusText.textContent = message || 'Desconectado';
                    statusText.style.color = '#ff4040';
                    break;
            }
        }

        state.isConnected = (status === 'connected');
        state.isConnecting = (status === 'connecting');

        updateControlButtons();
    }

    updateTestButton() {
        const testButton = document.getElementById('test-connection');
        if (!testButton) return;

        if (this.connectionState === 'connecting') {
            testButton.disabled = true;
        } else {
            testButton.disabled = false;
        }
    }

    async handleTestConnection() {
        const domainInput = DOM.get('connection-domain');
        const portInput = DOM.get('connection-port');

        if (!domainInput || !portInput) {
            console.error('Campos de conexão não encontrados');
            return;
        }

        const domain = domainInput.value.trim();
        const port = portInput.value.trim();

        if (!domain || !port) {
            this.showTestResult('error', 'Preencha IP e porta');
            return;
        }

        const url = `ws://${domain}:${port}`;

        this.showTestResult('testing', 'Testando conexão...');

        const success = await this.testConnection(url);

        state.settings.wsUrl = url;
        CONFIG.WS_URL = url;
        saveSettings();

        if (success) {
            this.showTestResult('success', 'Teste bem-sucedido!');

            setTimeout(() => {
                this.connect(url);
            }, 1000);
        } else {
            this.showTestResult('error', 'Falha no teste');
            console.log('⚠️ URL salva mesmo com falha no teste:', url);
            this.updateConnectionState('disconnected', 'Falha na conexão');
        }
    }

    // ==================== FUNÇÕES AUXILIARES ====================
    performHealthCheck() {
        if (this.connectionState === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const now = Date.now();
            const lastMessage = this.lastMessageTime || 0;

            if (now - lastMessage > 60000) {
                console.warn('🩺 Verificando saúde da conexão...');

                try {
                    if (this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send('ping');
                        console.log('🏓 Ping enviado');
                    }
                } catch (err) {
                    console.error('❌ Erro ao enviar ping:', err);
                    this.handleConnectionLost('Conexão inativa');
                }
            }
        }
    }

    handleBeforeUnload() {
        console.log('📄 Página está sendo fechada');
        this.isManualDisconnect = true;
        this.disconnect('Página fechada');
    }

    handleOnline() {
        console.log('🌐 Rede online detectada');

        if (this.connectionState !== 'connected' && !this.isManualDisconnect) {
            this.updateConnectionState('connecting', 'Rede recuperada - reconectando...');

            setTimeout(() => {
                this.connect();
            }, 1000);
        }
    }

    handleOffline() {
        console.warn('📵 Rede offline');
        this.updateConnectionState('error', 'Rede offline');
    }

    sendCommand(command) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ Não é possível enviar comando: não conectado');
            DOM.showError('Não conectado ao LiveSplit');
            return;
        }

        try {
            console.log(`📤 Enviando comando: ${command}`);
            this.ws.send(command);

        } catch (error) {
            console.error('❌ Erro ao enviar comando:', error);
            DOM.showError('Erro ao enviar comando');

            if (this.connectionState === 'connected') {
                this.handleConnectionLost('Erro ao enviar comando');
            }
        }
    }

    flushPendingMessages() {
        if (this.pendingMessages.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log(`📨 Enviando ${this.pendingMessages.length} mensagens pendentes`);

            this.pendingMessages.forEach(message => {
                try {
                    this.ws.send(message);
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem pendente:', error);
                }
            });

            this.pendingMessages = [];
        }
    }

    showSettingsModal() {
        console.log('⚙️ Abrindo menu de configurações automaticamente');

        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('auto-opened');

            const connectionSection = document.querySelector('.connection-section');
            if (connectionSection) {
                connectionSection.classList.add('highlight');

                setTimeout(() => {
                    connectionSection.classList.remove('highlight');
                }, 5000);
            }
        }

        window.showSettingsModal && window.showSettingsModal();

        setTimeout(() => {
            const domainInput = document.getElementById('connection-domain');
            if (domainInput) {
                domainInput.focus();
                domainInput.select();
            }
        }, 300);
    }

    setupEventListeners() {
        const testButton = document.getElementById('test-connection');
        if (testButton) {
            testButton.addEventListener('click', () => this.handleTestConnection());
        }
    };

    // ==================== GETTERS E STATUS ====================
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

        console.log('⚙️ Configurações do ConnectionManager atualizadas:', this.getStatus());
    }

    // ==================== DESTRUIDOR ====================
    destroy() {
        console.log('♻️ Destruindo ConnectionManager');

        this.disconnect('Destruindo gerenciador');

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
                const shouldReconnect = confirm('Você está desconectado. Deseja tentar reconectar agora?');
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
                    const shouldReconnect = confirm('Você está desconectado. Deseja tentar reconectar agora?');
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
        console.warn('Alguns botões de controle não foram encontrados');
        return;
    }

    if (!state.isConnected) {
        [btnStartSplit, btnPause, btnReset, btnUndo, btnSkip].forEach(btn => {
            if (btn) btn.disabled = true;
        });
        return;
    }

    const isRunning = state.timerState === "Running";
    const isPaused = state.timerState === "Paused";
    const isNotRunning = state.timerState === "NotRunning";
    const isEnded = state.timerState === "Ended";

    let undoAvailable = false;
    if (state.runData?.run?.segments) {
        undoAvailable = state.runData.run.segments.some(seg =>
            seg.splitTime?.realTime !== undefined && seg.splitTime?.realTime !== null
        );
    }

    // Atualizar botão Start/Split/Reset
    if (btnStartSplit) {
        const runJustEnded = isEnded && state.runEndedAt && (Date.now() - state.runEndedAt) < 1000;

        if (isEnded) {
            btnStartSplit.innerHTML = '<span class="icon-reset"></span>';
            btnStartSplit.title = runJustEnded ? 'Reset (aguarde 1s)' : 'Reset';
            btnStartSplit.setAttribute('aria-label', runJustEnded ? 'Reset (aguarde 1s)' : 'Reset');
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
        btnPause.title = btnPause.disabled ? 'Pause não disponível' : 'Pause';
    }

    if (btnReset) {
        btnReset.disabled = isNotRunning || isEnded;
        btnReset.title = btnReset.disabled ? 'Reset não disponível' : 'Reset';
    }

    if (btnUndo) {
        btnUndo.disabled = !undoAvailable || isNotRunning;
        btnUndo.title = btnUndo.disabled ? 'Sem splits para desfazer' : 'Undo';
    }

    const canSkip = (isRunning || isPaused) &&
        state.runData?.run?.segments &&
        (state.runData.currentSplitIndex ?? -1) < state.runData.run.segments.length - 1;

    if (btnSkip) {
        btnSkip.disabled = !canSkip || isEnded;
        btnSkip.title = btnSkip.disabled ? 'Sem split seguinte' : 'Skip';
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

    if (btnStartSplit) btnStartSplit.addEventListener('click', () => {
        const isRunning = state.timerState === "Running";
        const isPaused = state.timerState === "Paused";
        const isEnded = state.timerState === "Ended";

        const runJustEnded = isEnded && state.runEndedAt && (Date.now() - state.runEndedAt) < 1000;
        if (runJustEnded) return;

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

    if (btnPause) btnPause.addEventListener('click', () => {
        if (state.timerState === "Running") {
            connectionManager.sendCommand('pause');
        }
    });

    if (btnReset) btnReset.addEventListener('click', () => {
        if (state.timerState === "Ended") {
            connectionManager.sendCommand('reset');
        } else if (confirm('Tem certeza que deseja resetar o timer?')) {
            connectionManager.sendCommand('reset');
        }
    });

    if (btnUndo) btnUndo.addEventListener('click', () => {
        if (state.timerState === "Ended" || state.timerState === "Running" || state.timerState === "Paused") {
            connectionManager.sendCommand('unsplit');
        }
    });

    if (btnSkip) btnSkip.addEventListener('click', () => connectionManager.sendCommand('skipsplit'));

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

    const gameNameEl = DOM.get('game-name');
    if (gameNameEl) {
        gameNameEl.style.color = colors.accent;
    }

    updateExistingSectionColors(colors.accent);

    state.settings.theme = themeName;

    console.log(`🎨 Tema aplicado: ${themeName} (${colors.accent})`);
}

function updateExistingSectionColors(accentColor) {
    const sections = document.querySelectorAll('.row-section');
    const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accentColor);
    const rgb = rgbMatch ?
        `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}` :
        '0, 162, 255';

    sections.forEach(section => {
        section.style.background = `rgba(${rgb}, 0.08)`;
        section.style.borderBottom = `1px solid rgba(${rgb}, 0.2)`;

        const span = section.querySelector('td > div > span:first-child');
        if (span) {
            span.style.color = accentColor;
        }
    });
}

function updateThemeDependentElements(colors) {
    document.querySelectorAll('[data-theme-color]').forEach(el => {
        const colorType = el.getAttribute('data-theme-color');
        if (colors[colorType]) {
            el.style.color = colors[colorType];
        }
    });

    const sections = document.querySelectorAll('.row-section');
    const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colors.accent);
    const rgb = rgbMatch ?
        `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}` :
        '0, 162, 255';

    sections.forEach(section => {
        section.style.background = `rgba(${rgb}, 0.08)`;
        section.style.borderBottom = `1px solid rgba(${rgb}, 0.2)`;

        const span = section.querySelector('td > div > span:first-child');
        if (span) {
            span.style.color = colors.accent;
        }
    });
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
        '0, 162, 255';
}

function applyThemePreview(themeName) {
    const themePreview = DOM.get('theme-preview');
    if (!themePreview) return;

    const colors = THEME_COLORS[themeName] || THEME_COLORS['default'];

    themePreview.style.setProperty('--theme-bg', colors.bg);
    themePreview.style.setProperty('--theme-text', colors.text);
    themePreview.style.setProperty('--theme-accent', colors.accent);

    const gameTitle = themePreview.querySelector('.preview-game-title');
    if (gameTitle) {
        gameTitle.style.color = colors.accent;
    }
}

function updateThemeDisplay(themeName = 'default') {
    const currentDisplay = DOM.get('theme-current-display');
    if (currentDisplay) {
        const nameElement = currentDisplay.querySelector('.theme-name');
        if (nameElement) {
            const displayName = THEMES[themeName]?.name || 'Padrão';
            nameElement.textContent = displayName;
        }
        applyColorsToElement(currentDisplay, themeName);
    }

    applyThemePreview(themeName);

    document.querySelectorAll('.theme-list-option').forEach(option => {
        option.classList.remove('active');
        const optionTheme = option.dataset.theme;

        if (optionTheme) {
            applyColorsToElement(option, optionTheme);
        }

        if (optionTheme === themeName) {
            option.classList.add('active');
        }
    });

    const themeNames = Object.keys(THEMES);
    const currentIndex = themeNames.indexOf(themeName);
    const prevBtn = document.querySelector('.prev-theme');
    const nextBtn = document.querySelector('.next-theme');

    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= themeNames.length - 1;
}

function applyColorsToElement(element, themeName) {
    const colors = THEME_COLORS[themeName] || THEME_COLORS.default;

    element.style.removeProperty('--theme-bg');
    element.style.removeProperty('--theme-text');
    element.style.removeProperty('--theme-accent');
    element.style.removeProperty('--option-bg');
    element.style.removeProperty('--option-text');
    element.style.removeProperty('--option-accent');

    element.style.setProperty('--theme-bg', colors.bg);
    element.style.setProperty('--theme-text', colors.text);
    element.style.setProperty('--theme-accent', colors.accent);
    element.style.setProperty('--option-bg', colors.bg);
    element.style.setProperty('--option-text', colors.text);
    element.style.setProperty('--option-accent', colors.accent);

    if (element.id === 'theme-current-display') {
        const themeNameEl = element.querySelector('.theme-name');
        if (themeNameEl) {
            themeNameEl.style.color = colors.accent;
        }
    }

    return colors;
}

function setupThemeSelector() {
    const themeDisplay = DOM.get('theme-current-display');
    const themeFullList = DOM.get('theme-full-list');
    const prevBtn = document.querySelector('.prev-theme');
    const nextBtn = document.querySelector('.next-theme');
    const themeListOptions = themeFullList?.querySelector('.theme-list-options');

    if (!themeDisplay || !themeFullList || !themeListOptions) {
        console.error('Elementos do seletor de tema não encontrados');
        return;
    }

    const themeNames = Object.keys(THEMES);

    function getCurrentThemeIndex() {
        const currentTheme = state.settings.theme || 'default';
        return themeNames.indexOf(currentTheme);
    }

    function generateThemeList() {
        themeListOptions.innerHTML = '';
        themeNames.forEach(themeName => {
            const theme = {
                name: themeName,
                displayName: THEMES[themeName]?.name || themeName,
                colors: THEME_COLORS[themeName] || THEME_COLORS.default
            };

            const option = document.createElement('div');
            option.className = 'theme-list-option';
            option.dataset.theme = theme.name;
            option.innerHTML = `<div class="list-theme-info"><div class="theme-list-name">${theme.displayName}</div></div>`;

            applyColorsToElement(option, theme.name);

            option.addEventListener('click', function (e) {
                e.stopPropagation();
                applyNewTheme(theme.name);
                themeFullList.style.display = 'none';
            });

            themeListOptions.appendChild(option);
        });
    }

    function applyNewTheme(themeName) {
        state.settings.theme = themeName;
        saveSettings();
        applyTheme(themeName);
        updateThemeDisplay(themeName);
    }

    if (themeDisplay) {
        themeDisplay.addEventListener('click', function (e) {
            if (e.target.closest('.theme-nav-btn')) return;

            const isVisible = themeFullList.style.display !== 'none';
            themeFullList.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                const currentOption = themeFullList.querySelector(
                    `.theme-list-option[data-theme="${state.settings.theme || 'default'}"]`
                );
                if (currentOption) {
                    currentOption.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const currentIndex = getCurrentThemeIndex();
            if (currentIndex > 0) {
                applyNewTheme(themeNames[currentIndex - 1]);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const currentIndex = getCurrentThemeIndex();
            if (currentIndex < themeNames.length - 1) {
                applyNewTheme(themeNames[currentIndex + 1]);
            }
        });
    }

    document.addEventListener('click', function (e) {
        if (themeFullList.style.display !== 'none' &&
            !themeFullList.contains(e.target) &&
            !themeDisplay.contains(e.target)) {
            themeFullList.style.display = 'none';
        }
    });

    generateThemeList();
    updateThemeDisplay(state.settings.theme || 'default');
}

function resetThemeSelector() {
    // Resetar para tema padrão
    const defaultTheme = 'default';

    // Atualizar estado
    state.settings.theme = defaultTheme;

    // Aplicar tema
    applyTheme(defaultTheme);

    // Atualizar display
    updateThemeDisplay(defaultTheme);

    // Atualizar preview
    applyThemePreview(defaultTheme);

    // Fechar lista de temas se estiver aberta
    const themeFullList = DOM.get('theme-full-list');
    if (themeFullList) {
        themeFullList.style.display = 'none';
    }

    // Salvar configurações
    saveSettings();

    console.log('🔄 Seletor de temas resetado para padrão');
}

/* ==================== FUNÇÕES DE RENDERIZAÇÃO ==================== */
function shouldHideGraphAndTable() {
    if (!state.runData?.run?.segments) return true;
    return state.runData.run.segments.length <= 1;
}

function findSegmentSection(segments, startIdx) {
    if (startIdx < 0 || startIdx >= segments.length) return "";

    for (let j = startIdx; j < segments.length; j++) {
        const sec = DOM.extractSectionName(segments[j].name);
        if (sec) return sec;
    }
    return "";
}

function updateSectionVisibility(sectionName) {
    const splitsBody = DOM.get('splits-body');
    if (!splitsBody || !sectionName) return;

    const isExpandedByUser = state.expandedSections.has(sectionName);
    const isRunning = state.timerState === "Running" || state.timerState === "Paused";
    const curIdx = state.runData?.currentSplitIndex ?? -1;

    let sectionHasCurrent = false;
    if (isRunning && curIdx >= 0) {
        const row = splitsBody.querySelector(`.row-subsplit[data-split-index="${curIdx}"]`);
        sectionHasCurrent = row?.getAttribute("data-section") === sectionName;
    }

    const shouldExpand = isExpandedByUser || sectionHasCurrent;

    splitsBody.querySelectorAll(`.row-subsplit[data-section="${sectionName}"]`).forEach(row => {
        row.classList.toggle('hidden', !shouldExpand);
    });
}

function scrollToActiveSplit() {
    const splitsContainer = document.querySelector('.splits-container');
    const activeRow = document.querySelector('.row-subsplit.active');

    if (!splitsContainer || !activeRow) return;

    const containerRect = splitsContainer.getBoundingClientRect();
    const rowRect = activeRow.getBoundingClientRect();

    if (rowRect.top < containerRect.top || rowRect.bottom > containerRect.bottom) {
        const scrollTop = activeRow.offsetTop - (splitsContainer.clientHeight / 2) + (activeRow.clientHeight / 2);
        splitsContainer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
    }
}

function scrollToSelectedSplit() {
    if (state.selectedSplitIdx === null) return;

    const splitsContainer = document.querySelector('.splits-container');
    const selectedRow = document.querySelector(`.row-subsplit[data-split-index="${state.selectedSplitIdx}"]`);

    if (!splitsContainer || !selectedRow) return;

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
            splitsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-dim);">Nenhum split carregado</td></tr>';
        }
        return;
    }

    state.runData = data;
    const run = data.run;

    const wasEnded = state.isRunEnded;
    state.isRunEnded = state.timerState === "Ended";

    if (state.isRunEnded && !wasEnded) {
        state.runEndedAt = Date.now();
        setTimeout(() => {
            if (state.timerState === "Ended") {
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
    const previousActiveSection = state.lastActiveSection;
    const currentActiveSection = findSegmentSection(run.segments, curIdx);

    const splitChanged = state.timerState === "Running" && curIdx !== previousActiveIdx && previousActiveIdx !== -1;

    if (splitChanged) {
        state.expandedSections.forEach(sec => {
            if (sec !== currentActiveSection) {
                state.expandedSections.delete(sec);
            }
        });
    }

    state.lastActiveIdx = curIdx;
    state.lastActiveSection = currentActiveSection;

    if (run.segments.length > 0 && state.settings.showGraph) {
        drawComparisonGraph();
    }

    const gameNameEl = DOM.get('game-name');
    if (gameNameEl) {
        gameNameEl.textContent = run.gameName || "-";
        gameNameEl.title = run.gameName || "-";
        const currentTheme = state.settings.theme || 'default';
        gameNameEl.style.color = THEME_COLORS[currentTheme]?.accent || '#00a2ff';
    }

    const pbDisplay = DOM.get('pb-display');
    if (pbDisplay && run.segments.length > 0) {
        const lastSplit = run.segments[run.segments.length - 1];
        const pbTime = lastSplit?.comparisons?.["Personal Best"]?.realTime;
        if (pbTime) {
            pbDisplay.textContent = `PB: ${TimeUtils.formatSplit(pbTime)}`;
        }
    }

    if (state.timerState !== "Paused") {
        state.currentDelta = 0;
        if (curIdx > 0 && curIdx < run.segments.length) {
            const lastSeg = run.segments[curIdx - 1];
            const pbT = lastSeg?.comparisons?.["Personal Best"]?.realTime;
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
    let lastSec = "";
    state.hasIcons = run.segments.some(seg => seg.icon);

    run.segments.forEach((seg, i) => {
        let name = seg.name;
        let section = "";
        let isSub = name.startsWith('-');
        let isSectionEnd = name.includes('{');

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

                    const pbTime = seg?.comparisons?.["Personal Best"]?.realTime;
                    if (pbTime) {
                        sectionDelta = sectionTime - pbTime;
                        deltaClass = sectionDelta < 0 ? 'ahead' : (sectionDelta > 0 ? 'behind' : 'neutral');
                    }
                }
            }

            if (sectionTime === null && secIdx !== undefined) {
                sectionTime = run.segments[secIdx]?.comparisons?.["Personal Best"]?.realTime;
            }

            const deltaHtml = sectionDelta !== null ? TimeUtils.formatDelta(sectionDelta) : '-';
            const currentTheme = state.settings.theme || 'default';
            const accentColor = THEME_COLORS[currentTheme]?.accent || '#00a2ff';
            const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(accentColor);
            const rgb = rgbMatch ? `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}` : '0, 162, 255';

            html += `<tr class="row-section" data-section-name="${section}" 
                    style="background: rgba(${rgb}, 0.08); border-bottom: 1px solid rgba(${rgb}, 0.2);">
                        <td class="cell-icon ${!state.hasIcons ? 'hidden' : ''}"></td>
                        <td class="cell-name" style="color: ${accentColor}; font-weight: 600; padding-left: 12px;">${section}</td>
                        <td class="cell-timer"><span class="section-time">${TimeUtils.formatSplit(sectionTime)}</span></td>
                        <td class="cell-delta ${deltaClass}">${deltaHtml}</td>
                    </tr>`;
            lastSec = section;
        }

        const pb = seg.comparisons?.["Personal Best"]?.realTime;
        const act = seg.splitTime?.realTime;
        const isSkipped = (i < curIdx && (act === null || act === undefined)) || (curIdx >= run.segments.length && (act === null || act === undefined));

        let shouldHide = false;
        if (section) {
            const isActive = i === curIdx;
            if (!isActive && section !== currentActiveSection && !state.expandedSections.has(section)) {
                shouldHide = true;
            }
        }

        let deltaHtml = "-";
        let statusClass = "";

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
            deltaHtml = "Skipped";
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

        // Determinar se é um split grande (não subsplit)
        const isLarge = !isSub;

        html += `<tr class="row-subsplit ${isLarge ? 'large' : ''} ${isActive ? 'active' : ''} ${isClicked ? 'selected' : ''} ${shouldHide ? 'hidden' : ''}" data-split-index="${i}" data-section="${section || ''}" data-has-time="${hasTime}" data-is-skipped="${isSkipped}" data-can-click="${canClick}" style="${canClick ? 'cursor:pointer;' : 'cursor:default;'}">
                    <td class="cell-icon ${!state.hasIcons ? 'hidden' : ''}">${iconHtml}</td>
                    <td class="cell-name ${isClicked ? 'active-split' : ''} ${nameColorClass}" title="${name}">${name}</td>
                    <td class="cell-timer">${act ? TimeUtils.formatSplit(act) : TimeUtils.formatSplit(pb)}</td>
                    <td class="cell-delta ${statusClass}">${act ? deltaHtml : '-'}</td>
                </tr>`;
    });

    const splitsBody = DOM.get('splits-body');
    if (!splitsBody) return;
    splitsBody.innerHTML = html;

    splitsBody.querySelectorAll(".row-section").forEach(row => {
        row.addEventListener("click", function () {
            const sectionName = this.getAttribute("data-section-name");
            if (!sectionName) return;

            const isRunning = state.timerState === "Running" || state.timerState === "Paused";
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
        if (secName) updateSectionVisibility(secName);
    });

    splitsBody.querySelectorAll(".row-subsplit").forEach(row => {
        row.addEventListener("click", function (e) {
            e.stopPropagation();

            if (e.target.closest('button') || e.target.tagName === 'BUTTON') return;

            const splitIndex = parseInt(this.getAttribute("data-split-index"));
            const canClick = this.getAttribute("data-can-click") === "true";

            if (!canClick) return;

            const splitsBody = DOM.get('splits-body');
            if (!splitsBody) return;

            const isCurrentlySelected = state.selectedSplitIdx === splitIndex;

            if (isCurrentlySelected) {
                state.selectedSplitIdx = null;
                state.selectedGraphPointIdx = null;
                splitsBody.querySelectorAll(".cell-name.active-split").forEach(el => {
                    el.classList.remove("active-split");
                });
                splitsBody.querySelectorAll(".row-subsplit.selected").forEach(el => {
                    el.classList.remove("selected");
                });

                setTimeout(() => {
                    scrollToActiveSplit();
                }, 50);

                if (state.settings.showGraph) drawComparisonGraph();
                return;
            }

            state.selectedSplitIdx = splitIndex;
            state.selectedGraphPointIdx = null;

            splitsBody.querySelectorAll(".cell-name.active-split").forEach(el => {
                el.classList.remove("active-split");
            });
            splitsBody.querySelectorAll(".row-subsplit.selected").forEach(el => {
                el.classList.remove("selected");
            });

            const cellName = this.querySelector(".cell-name");
            if (cellName) cellName.classList.add("active-split");
            this.classList.add("selected");

            const newSectionRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"]`);
            const newSectionName = newSectionRow ? newSectionRow.getAttribute("data-section") : null;

            const curIdx = state.runData?.currentSplitIndex ?? -1;
            const isSubsplitOfCurrent = (splitIndex !== curIdx) && newSectionName === state.lastActiveSection;

            if (newSectionName) {
                state.expandedSections.add(newSectionName);
                updateSectionVisibility(newSectionName);
            }

            setTimeout(() => {
                scrollToSelectedSplit();
            }, 50);

            if (state.settings.showGraph) drawComparisonGraph();
        });
    });

    splitsBody.querySelectorAll('.row-section').forEach(sec => {
        const secName = sec.getAttribute('data-section-name');
        if (secName) updateSectionVisibility(secName);
    });

    if (state.selectedSplitIdx === null && state.selectedGraphPointIdx === null) {
        setTimeout(() => {
            scrollToActiveSplit();
        }, 50);
    }
}

/* ==================== FUNÇÕES DE GRÁFICO ==================== */
function drawComparisonGraph() {
    if (state.graphAnimationFrame) {
        cancelAnimationFrame(state.graphAnimationFrame);
    }

    state.graphAnimationFrame = requestAnimationFrame(() => {
        if (!state.runData || !state.runData.run || !state.settings.showGraph) {
            state.graphAnimationFrame = null;
            return;
        }

        const canvas = DOM.get('comparison-graph');
        if (!canvas) {
            state.graphAnimationFrame = null;
            return;
        }

        const run = state.runData.run;
        const curIdx = state.runData.currentSplitIndex ?? -1;

        if (shouldHideGraphAndTable() || !state.settings.showGraph) {
            const graphContainer = DOM.get('graph-container');
            if (graphContainer) graphContainer.classList.add('hidden');
            state.graphAnimationFrame = null;
            return;
        } else {
            const graphContainer = DOM.get('graph-container');
            if (graphContainer) graphContainer.classList.remove('hidden');
        }

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
        if (state.timerState === "Running" && state.runData && state.runData.run) {
            const currentDelta = state.currentDelta;

            if (currentDelta !== undefined && currentDelta !== null) {
                const currentSegmentIndex = Math.max(0, curIdx);
                const currentSegment = run.segments[currentSegmentIndex];
                const pbTime = currentSegment?.comparisons?.["Personal Best"]?.realTime;
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
        } else if (state.timerState === "Paused" && state.runData && state.runData.run && curIdx >= 0) {
            const segmentIndexToShow = Math.max(0, curIdx);
            const segmentToShow = run.segments[segmentIndexToShow];
            const pbTime = segmentToShow?.comparisons?.["Personal Best"]?.realTime;
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
                if (isSkipped) skippedSplits.add(i);
            }
        });

        pointsWithTime.forEach((splitIdx, dataIdx) => {
            const seg = run.segments[splitIdx];
            const pb = seg.comparisons?.["Personal Best"]?.realTime;
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

            if (sectionName) sectionEnds.push({
                dataIndex: dataIdx,
                name: sectionName
            });

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
            if (prev !== null && next !== null) pt.renderDelta = (prev + next) / 2;
            else if (prev !== null) pt.renderDelta = prev;
            else if (next !== null) pt.renderDelta = next;
            else pt.renderDelta = 0;
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
        if (activeDataIdx !== -1) displayIndices.add(activeDataIdx);
        if (maxDeltaIdx !== -1) displayIndices.add(maxDeltaIdx);
        if (minDeltaIdx !== -1) displayIndices.add(minDeltaIdx);
        sectionEnds.forEach(s => displayIndices.add(s.dataIndex));

        const specialIndices = new Set();
        if (effectivePointsCount > 0) {
            specialIndices.add(0);
            specialIndices.add(effectivePointsCount - 1);
        }
        if (maxDeltaIdx !== -1) specialIndices.add(maxDeltaIdx);
        if (minDeltaIdx !== -1) specialIndices.add(minDeltaIdx);
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
            if (a.isActive && !b.isActive) return 1;
            if (!a.isActive && b.isActive) return -1;
            if (a.isSpecial && !b.isSpecial) return 1;
            if (!a.isSpecial && b.isSpecial) return -1;
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
    } else {
        return isActive ? '#fff' : '#888';
    }
}

function drawDeltaBoxWithColor(ctx, pt, idx, getX, deltaToY, width, height, footerHeight, isActive, color) {
    if (!pt) return;
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

    if (!state.graphData?.dataPoints?.length) return;
    const canvas = DOM.get('comparison-graph');
    if (!canvas) return;

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

    if (closestIdx === -1) return;

    const clickedPt = dataPoints[closestIdx];
    const splitIndex = clickedPt.index;
    const splitsBody = DOM.get('splits-body');
    if (!splitsBody) return;

    const isCurrentlySelected = state.selectedGraphPointIdx === closestIdx || state.selectedSplitIdx === splitIndex;

    if (isCurrentlySelected) {
        state.selectedGraphPointIdx = null;
        state.selectedSplitIdx = null;
        splitsBody.querySelectorAll(".cell-name.active-split").forEach(el => el.classList.remove("active-split"));
        splitsBody.querySelectorAll(".row-subsplit.selected").forEach(el => el.classList.remove("selected"));

        if (state.settings.showGraph) drawComparisonGraph();

        setTimeout(() => {
            scrollToActiveSplit();
        }, 50);
        return;
    }

    state.selectedGraphPointIdx = closestIdx;
    state.selectedSplitIdx = splitIndex;

    splitsBody.querySelectorAll(".cell-name.active-split").forEach(el => el.classList.remove("active-split"));
    splitsBody.querySelectorAll(".row-subsplit.selected").forEach(el => el.classList.remove("selected"));

    const clickedCell = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"] .cell-name`);
    const clickedRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"]`);

    if (clickedCell) clickedCell.classList.add("active-split");
    if (clickedRow) clickedRow.classList.add("selected");

    const newSectionRow = splitsBody.querySelector(`.row-subsplit[data-split-index="${splitIndex}"]`);
    const newSectionName = newSectionRow ? newSectionRow.getAttribute("data-section") : null;

    if (newSectionName) {
        state.expandedSections.clear();
        state.expandedSections.add(newSectionName);
    }

    splitsBody.querySelectorAll('.row-section').forEach(sec => {
        const secName = sec.getAttribute('data-section-name');
        if (secName) updateSectionVisibility(secName);
    });

    setTimeout(() => {
        scrollToSelectedSplit();
    }, 50);

    if (state.settings.showGraph) drawComparisonGraph();
}

/* ==================== FUNÇÕES DE TIMER ==================== */
function updateTimer() {
    const timerEl = DOM.get('timer');
    const deltaEl = DOM.get('timer-delta-live');

    if (state.timerState === "Running") {
        const nowTime = performance.now();
        const elapsed = state.lastTime + (nowTime - state.lastTs);
        const { timePart, msPart } = TimeUtils.formatTimer(elapsed);

        let currentDelta = 0;
        if (state.runData && state.runData.run) {
            const curIdx = state.runData.currentSplitIndex ?? -1;
            if (curIdx >= 0 && curIdx < state.runData.run.segments.length) {
                const segment = state.runData.run.segments[curIdx];
                const pb = segment?.comparisons?.["Personal Best"]?.realTime;
                if (pb) {
                    currentDelta = elapsed - pb;
                    state.currentDelta = currentDelta;
                }
            }
        }

        const deltaClass = currentDelta <= 0 ? "ahead" : "behind";
        timerEl.className = `timer-text ${deltaClass}`;
        timerEl.innerHTML = `${timePart}<span class="timer-ms">.${msPart}</span>`;
        if (currentDelta !== 0) {
            deltaEl.textContent = TimeUtils.formatDelta(currentDelta);
            deltaEl.className = `timer-delta-live ${deltaClass}`;
        } else {
            deltaEl.textContent = "-";
            deltaEl.className = "timer-delta-live";
        }
        if (state.runData && (nowTime - lastGraphDraw) >= CONFIG.GRAPH_DRAW_THROTTLE) {
            if (state.settings.showGraph) drawComparisonGraph();
            lastGraphDraw = nowTime;
        }
    } else if (state.timerState === "Paused") {
        const { timePart, msPart } = TimeUtils.formatTimer(state.lastTime);

        if (state.runData && state.runData.run) {
            const curIdx = state.runData.currentSplitIndex ?? -1;
            if (curIdx >= 0) {
                const segment = state.runData.run.segments[Math.max(0, curIdx - 1)];
                const pb = segment?.comparisons?.["Personal Best"]?.realTime;
                if (pb) {
                    state.currentDelta = state.lastTime - pb;
                }
            }
        }

        timerEl.className = "timer-text paused";
        timerEl.innerHTML = `${timePart}<span class="timer-ms">.${msPart}</span>`;
        if (state.currentDelta !== 0) {
            deltaEl.textContent = TimeUtils.formatDelta(state.currentDelta);
            deltaEl.className = "timer-delta-live " + (state.currentDelta <= 0 ? "ahead" : "behind");
        } else {
            deltaEl.textContent = "-";
            deltaEl.className = "timer-delta-live paused";
        }
    } else if (state.timerState === "Ended") {
        const { timePart, msPart } = TimeUtils.formatTimer(state.lastTime);
        let finalDelta = state.currentDelta ?? 0;

        if (finalDelta === 0 && state.runData && state.runData.run) {
            const run = state.runData.run;
            const lastIdx = (state.runData.currentSplitIndex ?? run.segments.length) - 1;
            if (lastIdx >= 0 && run.segments[lastIdx]) {
                const lastSeg = run.segments[lastIdx];
                const pb = lastSeg?.comparisons?.["Personal Best"]?.realTime;
                const act = lastSeg?.splitTime?.realTime;
                if (typeof pb === 'number' && typeof act === 'number') {
                    finalDelta = act - pb;
                } else {
                    finalDelta = 0;
                }
            }
        }

        state.currentDelta = finalDelta;
        const deltaClass = finalDelta <= 0 ? "ahead" : "behind";
        timerEl.className = `timer-text ${deltaClass}`;
        timerEl.innerHTML = `${timePart}<span class="timer-ms">.${msPart}</span>`;
        deltaEl.textContent = TimeUtils.formatDelta(finalDelta);
        deltaEl.className = `timer-delta-live ${deltaClass}`;
    } else if (state.timerState === "NotRunning") {
        timerEl.className = "timer-text";
        timerEl.innerHTML = `0:00<span class="timer-ms">.00</span>`;
        deltaEl.textContent = "-";
        deltaEl.className = "timer-delta-live";
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
                showGraph: parsed.showGraph !== undefined ? parsed.showGraph : true,
                showTable: parsed.showTable !== undefined ? parsed.showTable : true,
                showControls: parsed.showControls !== undefined ? parsed.showControls : true,
                wsUrl: parsed.wsUrl || 'ws://localhost:15721'
            };

            if (parsed.wsUrl) {
                CONFIG.WS_URL = parsed.wsUrl;
            }

            if (parsed.uiState) {
                state.expandedSections = new Set(parsed.uiState.expandedSections || []);
                state.selectedSplitIdx = parsed.uiState.selectedSplitIdx || null;
            }

            applyTheme(state.settings.theme);
        }
    } catch (err) {
        console.error('Erro ao carregar configurações:', err);
        state.settings = {
            theme: 'default',
            showGraph: true,
            showTable: true,
            showControls: true,
            wsUrl: 'ws://localhost:15721'
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
        DOM.showSuccess('Configurações salvas com sucesso');
    } catch (err) {
        console.error('Erro ao salvar configurações:', err);
        DOM.showError('Não foi possível salvar as configurações');
    }
}

function setupConnectionConfig() {
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

        if (domainInput) domainInput.value = domain;
        if (portInput) portInput.value = port;
    }

    function buildUrl() {
        const domain = domainInput?.value?.trim() || 'localhost';
        const port = portInput?.value?.trim() || '15721';
        if (!domain || !port) return null;
        return `ws://${domain}:${port}`;
    }

    if (testButton) {
        const newTestButton = testButton.cloneNode(true);
        testButton.parentNode.replaceChild(newTestButton, testButton);

        newTestButton.addEventListener('click', async () => {
            const url = buildUrl();
            if (!url) {
                DOM.showError('URL inválida');
                return;
            }

            const success = await connectionManager.testConnection(url);

            if (success) {
                state.settings.wsUrl = url;
                CONFIG.WS_URL = url;
                saveSettings();

                setTimeout(() => {
                    connectionManager.connect(url);
                }, 500);
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
        testButton.textContent = 'Testar & Salvar';
    }
}

function showSettingsModal() {
    const modal = DOM.get('settings-modal');
    const toggleGraph = DOM.get('toggle-graph');
    const toggleTable = DOM.get('toggle-table');
    const toggleControls = DOM.get('toggle-controls');
    const errorNotification = DOM.get('error-notification');

    if (modal) modal.classList.add('show');
    if (toggleGraph) toggleGraph.checked = state.settings.showGraph;
    if (toggleTable) toggleTable.checked = state.settings.showTable;
    if (toggleControls) toggleControls.checked = state.settings.showControls;

    applyTheme(state.settings.theme);

    if (errorNotification) {
        if (!state.isConnected) {
            errorNotification.classList.add('show');
        } else {
            errorNotification.classList.remove('show');
        }
    }

    setTimeout(() => {
        const domainInput = DOM.get('connection-domain');
        if (domainInput) {
            domainInput.focus();
            domainInput.select();
        }
    }, 100);
}

function hideSettingsModal(withAnimation = false) {
    const modal = DOM.get('settings-modal');
    if (modal) {
        if (withAnimation) {
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.classList.remove('show', 'modal-closing');
                resetModalState();
            }, 200);
        } else {
            modal.classList.remove('show');
            resetModalState();
        }
    }
}

function resetModalState() {
    clearConnectionStatus();

    const themeFullList = DOM.get('theme-full-list');
    if (themeFullList) {
        themeFullList.style.display = 'none';
    }
}

function setupSettingsModal() {
    const modalClose = DOM.get('modal-close');
    const modalReset = DOM.get('modal-reset');
    const toggleGraph = DOM.get('toggle-graph');
    const toggleTable = DOM.get('toggle-table');
    const toggleControls = DOM.get('toggle-controls');

    setupAutoReconnectSettings();

    if (toggleGraph) {
        toggleGraph.checked = state.settings.showGraph !== false;
        toggleGraph.addEventListener('change', function () {
            state.settings.showGraph = this.checked;
            saveSettings();
            if (state.runData) render(state.runData);
        });
    }

    if (toggleTable) {
        toggleTable.checked = state.settings.showTable !== false;
        toggleTable.addEventListener('change', function () {
            state.settings.showTable = this.checked;
            saveSettings();
            if (state.runData) render(state.runData);
        });
    }

    if (toggleControls) {
        toggleControls.checked = state.settings.showControls !== false;
        toggleControls.addEventListener('change', function () {
            state.settings.showControls = this.checked;
            saveSettings();
            updateControlsVisibility();
        });
    }

    setupThemeSelector();

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            clearConnectionStatus();

            if (toggleGraph) toggleGraph.checked = state.settings.showGraph !== false;
            if (toggleTable) toggleTable.checked = state.settings.showTable !== false;
            if (toggleControls) toggleControls.checked = state.settings.showControls !== false;

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

            const currentTheme = state.settings.theme || 'default';
            state.settings.theme = currentTheme;

            applyThemePreview(currentTheme);
            hideSettingsModal();
        });
    }

    if (modalReset) {
        modalReset.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja redefinir todas as configurações para os valores padrão?')) {
                state.settings = {
                    theme: 'default',
                    showGraph: true,
                    showTable: true,
                    showControls: true,
                    wsUrl: 'ws://localhost:15721'
                };

                state.expandedSections.clear();
                state.selectedSplitIdx = null;
                state.selectedGraphPointIdx = null;

                saveSettings();

                applyTheme('default');

                updateThemeDisplay('default');

                if (toggleGraph) toggleGraph.checked = true;
                if (toggleTable) toggleTable.checked = true;
                if (toggleControls) toggleControls.checked = true;

                const domainInput = DOM.get('connection-domain');
                const portInput = DOM.get('connection-port');
                if (domainInput) domainInput.value = 'localhost';
                if (portInput) portInput.value = '15721';

                applyThemePreview('default');

                CONFIG.WS_URL = 'ws://localhost:15721';

                if (state.runData) render(state.runData);

                updateControlsVisibility();

                connectionManager.disconnect('Resetando configurações');

                await new Promise(resolve => setTimeout(resolve, 500));

                const testButton = DOM.get('test-connection');
                if (testButton) {
                    const url = 'ws://localhost:15721';
                    connectionManager.testConnection(url).then(() => {
                        setTimeout(() => {
                            connectionManager.connect(url);
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
                console.log('Monitor: Sem conexão ativa, verificando necessidade de mostrar configurações...');
                // Esperar um pouco antes de mostrar para evitar pop-ups imediatos
                setTimeout(() => {
                    if (!state.isConnected && !state.isConnecting) {
                        console.log('Monitor: Mostrando configurações de conexão');
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

    /**
     * Export as Image
     */
    async exportAsImage() {
        if (this.isExporting) {
            console.warn('Export already in progress');
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
            console.log(`✅ Image export completed in ${duration.toFixed(2)}s`);
            DOM.showSuccess('Captura realizada!');

        } catch (error) {
            console.error('❌ Image export failed:', error);
            DOM.showError('Falha na exportação: ' + (error.message || 'Erro desconhecido'));
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
            console.warn('Export already in progress');
            return;
        }

        this.isExporting = true;
        this.setButtonState('export-text', 'loading', 'Gerando...');

        try {
            console.log('Starting CSV export...');

            // Validate
            await this.validateCSVData();
            
            // Get data
            const runData = this.getRunData();
            const subsplits = this.getValidSubsplits(runData.run.segments);

            if (subsplits.length === 0) {
                throw new Error('Nenhum subsplit encontrado para exportação');
            }

            // Generate content
            const csvContent = this.generateCSVContent(subsplits);

            // Download
            this.downloadCSVFile(csvContent, runData.run.gameName, subsplits.length);

            console.log(`✅ CSV export completed: ${subsplits.length} rows`);
            DOM.showSuccess(`CSV exportado! (${subsplits.length} subsplits)`);

        } catch (error) {
            console.error('❌ CSV export failed:', error);
            DOM.showError('Erro ao exportar CSV: ' + (error.message || 'Erro desconhecido'));
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
            throw new Error('Nenhum dado disponível para exportação');
        }
        if (!state.runData.run) {
            throw new Error('Dados de run inválidos');
        }
        if (!state.runData.run.segments || state.runData.run.segments.length === 0) {
            throw new Error('Nenhum segmento encontrado');
        }
        console.log('✓ Image data validated');
    },

    /**
     * Validate CSV export data
     */
    async validateCSVData() {
        if (!state.runData) {
            throw new Error('Nenhum dado disponível para exportação');
        }
        if (!state.runData.run) {
            throw new Error('Dados de run inválidos');
        }
        console.log('✓ CSV data validated');
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
        if (!segments || !Array.isArray(segments)) return [];

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
            console.log('✓ html2canvas already loaded');
            return;
        }

        console.log('Loading html2canvas...');
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.HTML2CANVAS_URL;
            script.onload = () => {
                console.log('✓ html2canvas loaded successfully');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Falha ao carregar html2canvas'));
            };
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
        console.log('Preparing DOM for export...');

        const snapshot = {
            container: document.getElementById('ls-window'),
            graphContainer: DOM.get('graph-container'),
            graphWrapper: document.getElementById('graph-wrapper'),
            canvas: DOM.get('comparison-graph'),
            expandedSections: new Set(state.expandedSections),
            styles: {}
        };

        if (!snapshot.container) {
            throw new Error('Container não encontrado');
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

        // Expand all sections
        this.expandAllSections();
        await this.wait(100);

        // Set container dimensions
        snapshot.container.style.width = this.CONTAINER_WIDTH + 'px';
        snapshot.container.style.overflow = 'visible';
        snapshot.container.style.height = 'auto';

        // Show graph
        if (snapshot.graphContainer) {
            snapshot.graphContainer.style.display = 'block';
        }

        // Set graph export height
        if (snapshot.graphWrapper) {
            snapshot.graphWrapper.style.height = this.GRAPH_EXPORT_HEIGHT + 'px';
        }

        console.log('✓ DOM prepared:', {
            containerWidth: this.CONTAINER_WIDTH,
            graphHeight: this.GRAPH_EXPORT_HEIGHT,
            expandedSections: snapshot.expandedSections.size
        });

        return snapshot;
    },

    /**
     * Set up graph for export
     */
    async setupGraphForExport(snapshot) {
        console.log('Setting up graph for export...');

        const { canvas, graphWrapper } = snapshot;

        if (!canvas || !graphWrapper) {
            console.log('⚠ Graph elements not found, skipping');
            return;
        }

        // Wait for layout
        await this.wait(200);

        // Get dimensions
        const dpr = window.devicePixelRatio || 1;
        const wrapperRect = graphWrapper.getBoundingClientRect();

        console.log('Graph dimensions:', {
            width: wrapperRect.width,
            height: this.GRAPH_EXPORT_HEIGHT,
            dpr: dpr
        });

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

        console.log('✓ Graph set up complete');
    },

    /**
     * Expand all sections
     */
    expandAllSections() {
        if (state.runData?.run?.segments) {
            const allSections = new Set();
            state.runData.run.segments.forEach(seg => {
                const sec = DOM.extractSectionName(seg.name);
                if (sec) allSections.add(sec);
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
        console.log('Starting capture...');

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
            onclone: (doc, element) => {
                const style = doc.createElement('style');
                style.textContent = this.getExportCSS();
                doc.head.appendChild(style);
                console.log('✓ Export styles injected');
            }
        };

        console.log('Capture options:', {
            width: options.width,
            height: options.height,
            scale: options.scale
        });

        const canvas = await Promise.race([
            html2canvas(snapshot.container, options),
            this.createTimeout(this.CAPTURE_TIMEOUT)
        ]);

        console.log('✓ Capture complete:', {
            width: canvas.width,
            height: canvas.height
        });

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

        console.log('Downloading image:', fileName);
        console.log('Canvas dimensions:', {
            width: canvas.width,
            height: canvas.height
        });

        try {
            const dataUrl = canvas.toDataURL('image/png');
            console.log('✓ DataURL generated, length:', dataUrl.length);

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            link.style.display = 'none';

            document.body.appendChild(link);
            console.log('✓ Link added to DOM');

            link.click();
            console.log('✓ Download triggered');

            setTimeout(() => {
                document.body.removeChild(link);
                console.log('✓ Link removed from DOM');
            }, 200);

            console.log('✅ Image download initiated');

        } catch (error) {
            console.error('❌ Error downloading image:', error);
            throw new Error('Falha ao baixar imagem: ' + error.message);
        }
    },

    /**
     * Generate CSV content
     */
    generateCSVContent(subsplits) {
        const headers = ['Nome', 'Tempo PB', 'Tempo Atual', 'Delta'];
        const headerRow = headers.map(h => this.escapeCSVValue(h)).join(';');

        const rows = subsplits.map(seg => {
            const name = seg.name.replace(/^-/, '').trim();
            const pbTime = seg.comparisons?.["Personal Best"]?.realTime;
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
     */
    downloadCSVFile(content, gameName, rowCount) {
        const timestamp = new Date().toLocaleString('pt-BR')
            .replace(/[/:\\]/g, '-')
            .replace(/,/g, '');
        const fileName = `subsplits_${(gameName || 'LiveSplit').replace(/\s+/g, '_')}_${timestamp}.csv`;

        console.log('Downloading CSV:', fileName, `(${rowCount} rows)`);

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

        console.log('✅ CSV downloaded');
    },

    /**
     * Escape CSV value
     */
    escapeCSVValue(str) {
        if (str === null || str === undefined) return '';
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
        console.log('Restoring DOM...');

        const container = document.getElementById('ls-window');
        const graphContainer = DOM.get('graph-container');
        const graphWrapper = document.getElementById('graph-wrapper');

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

        // Restore expanded sections
        if (state.runData?.run?.segments) {
            render(state.runData);
        }

        await this.wait(100);

        console.log('✓ DOM restored');
    },

    // ========================================
    // UTILITIES
    // ========================================

    /**
     * Set button state
     */
    setButtonState(btnId, state, text) {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        if (state === 'loading') {
            btn.classList.add('exporting');
            btn.disabled = true;
            btn.textContent = text;
        } else {
            btn.classList.remove('exporting');
            btn.disabled = false;
            btn.textContent = text;
        }
    },

    /**
     * Wait helper
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        if (state.runData && state.settings.showGraph) drawComparisonGraph();
    }, CONFIG.RESIZE_DEBOUNCE);
}

function setupGraphResizer() {
    const wrapper = document.getElementById('graph-wrapper');
    const resizer = document.getElementById('graph-resizer');
    if (!wrapper || !resizer) return;

    const MIN = 80;
    const MAX = 400;
    const saved = parseInt(localStorage.getItem('ls_graph_height'), 10);
    if (!isNaN(saved) && saved >= MIN && saved <= MAX) {
        wrapper.style.height = saved + 'px';
    }

    let dragging = false;
    let startY = 0;
    let startH = 0;

    function onPointerMove(ev) {
        if (!dragging) return;
        ev.preventDefault();

        const dy = (ev.clientY - startY);
        const newH = Math.round(Math.max(MIN, Math.min(MAX, startH + dy)));
        wrapper.style.height = newH + 'px';
    }

    function onPointerUp(ev) {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove('active');

        wrapper.classList.remove('dragging');

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
            console.warn('Failed to set pointer capture:', e);
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

    resizer.addEventListener('click', (ev) => {
        if (dragging) return;
        resizer.classList.add('active');
        setTimeout(() => resizer.classList.remove('active'), 1500);
    });
}

/* ==================== INICIALIZAÇÃO ==================== */
function init() {
    loadSettings();
    applyTheme(state.settings.theme || 'default');

    setupControls();
    setupSettingsModal();
    setupExportButtons(); // <-- Alterado aqui

    connectionManager.init();
    updateControlsVisibility();
    connectionManager.connect();

    setTimeout(() => {
        if (!state.isConnected && !state.isConnecting) {
            console.log('⏰ Inicialização: Nenhuma conexão estabelecida, abrindo configurações...');
            showSettingsModal();
        }
    }, 3000);

    startConnectionMonitor();

    updateTimer();

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