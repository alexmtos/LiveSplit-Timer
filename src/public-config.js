// Public browser-facing configuration for the LiveSplit Timer app
(() => {
  window.APP_CONFIG = {
    WS_URL: 'ws://localhost:16834/livesplit',
    RECONNECT_DELAY: 1000,
    MAX_AUTO_RECONNECT_ATTEMPTS: 3,
    GRAPH_DRAW_THROTTLE: 16,
    RESIZE_DEBOUNCE: 150,
    CLICK_DISTANCE_THRESHOLD: 15,
    AUTO_SHOW_SETTINGS_ON_DISCONNECT: true,
    VERSION: '1.0.0'
  };
})();
