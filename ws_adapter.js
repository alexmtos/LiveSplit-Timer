"use strict";

// Lightweight, deterministic WebSocket adapter with explicit lifecycle management.
// This module is designed to be imported by app.js without introducing new
// runtime dependencies. It prefers native WebSocket (browser/global) and falls
// back to Node's 'ws' if available at runtime.

const EventEmitter = typeof require !== 'undefined' ? require('events') : class {}; // safe fallback
const EventEmitterClass = EventEmitter ? EventEmitter : class {};

class WSAdapter extends EventEmitterClass {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = Object.assign({
      reconnect: true,
      maxRetries: 3,
      // Deterministic backoff sequence for retries
      reconnectDelays: [1000, 2000, 4000]
    }, options);

    this._ws = null;
    this._closedManually = false;
    this._retryCount = 0;
    this._pending = [];
  }

  _getWebSocketCtor() {
    // Try browser/global WebSocket first
    const globalWS = typeof global !== 'undefined' ? global.WebSocket : undefined;
    if (globalWS) return globalWS;
    if (typeof window !== 'undefined' && window.WebSocket) return window.WebSocket;
    // Try node ws if available
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      const ws = require('ws');
      return ws;
    } catch {
      return null;
    }
  }

  connect() {
    if (this._ws) {
      // Already attempting/connected
      return;
    }
    if (!this.url || typeof this.url !== 'string') {
      throw new Error('WSAdapter: invalid URL');
    }

    const Ctor = this._getWebSocketCtor();
    if (!Ctor) {
      // Emit error so callers can react, but do not throw synchronously to allow tests to attach listeners
      this.emit('error', new Error('WebSocket constructor not found'));
      return;
    }

    // Create socket and wire lifecycle
    try {
      this._closedManually = false;
      this._ws = new Ctor(this.url);
    } catch (e) {
      this.emit('error', e);
      this._scheduleReconnect();
      return;
    }

    const ws = this._ws;
    // Bind events, normalizing to predictable emitter events
    ws.onopen = () => {
      this._retryCount = 0;
      // Flush any queued messages
      this._flushPending();
      this.emit('open');
    };
    ws.onmessage = (ev) => this.emit('message', ev.data);
    ws.onerror = (ev) => this.emit('error', ev);
    ws.onclose = (ev) => {
      this.emit('close', ev);
      this._ws = null;
      if (!this._closedManually && this.options.reconnect) {
        this._scheduleReconnect();
      }
    };
  }

  _flushPending() {
    if (!this._ws || this._ws.readyState !== 1) return; // OPEN
    while (this._pending.length > 0) {
      try {
        const data = this._pending.shift();
        this.send(data);
      } catch (e) {
        // Best-effort only
      }
    }
  }

  _scheduleReconnect() {
    const delays = this.options.reconnectDelays;
    const idx = Math.min(this._retryCount, delays.length - 1);
    const delay = delays[idx];
    this._retryCount = Math.min(this._retryCount + 1, delays.length);
    setTimeout(() => {
      if (!this._ws) this.connect();
    }, delay);
  }

  send(data) {
    if (this._ws && this._ws.readyState === 1) {
      this._ws.send(data);
    } else {
      // Queue until connection is ready
      this._pending.push(data);
    }
  }

  disconnect() {
    this.options.reconnect = false;
    this._closedManually = true;
    if (this._ws) {
      try {
        this._ws.close();
      } catch {
        // ignore
      } finally {
        this._ws = null;
      }
    }
  }

  isConnected() {
    return !!this._ws && this._ws.readyState === 1;
  }
}

module.exports = { WSAdapter };
