"use strict";

// Lightweight unit tests for WSAdapter using a mock WebSocket.
// These tests do not require a test runner; they illustrate expected behavior.

const assert = require('assert');
const { WSAdapter } = require('../ws_adapter');

// Mock WebSocket that auto-links to adapter events when constructed.
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    // simulate asynchronous open
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  send() {}
  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000 });
  }
}
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

describe('WSAdapter', function() {
  it('emits error if WebSocket constructor not found', function(done) {
    // Temporarily remove global WebSocket
    const old = global.WebSocket;
    delete global.WebSocket;
    // Instantiate adapter with a valid-looking URL
    const adapter = new WSAdapter('ws://example');
    adapter.on('error', (err) => {
      assert.ok(err, 'error should be emitted');
      // Restore
      global.WebSocket = old;
      done();
    });
    adapter.connect();
  });

  it('emits open when connection succeeds', function(done) {
    // Install mock WebSocket
    global.WebSocket = MockWebSocket;
    const adapter = new WSAdapter('ws://example');
    adapter.on('open', () => {
      // success
      // cleanup
      delete global.WebSocket;
      done();
    });
    adapter.connect();
  });

  it('throws on invalid URL when connect called', function() {
    global.WebSocket = MockWebSocket;
    const adapter = new WSAdapter(null);
    let threw = false;
    try {
      adapter.connect();
    } catch (e) {
      threw = true;
    }
    delete global.WebSocket;
    // Expect to throw due to invalid URL
    assert.strictEqual(threw, true);
  });
});
