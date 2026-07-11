/**
 * SebookPopoutClient — popup-side companion to TutorialPopoutManager.
 *
 * Encapsulates the boilerplate shared across all popup HTML files
 * (tab / pane / output / instructions): joining the BroadcastChannel,
 * heartbeat watching, hello+retry handshake, beforeunload graceful
 * close, force-close handling, dark-mode mirroring, and the standard
 * "Saved ✓" flash on save-confirmed.
 *
 * Each popup just supplies its role-specific message handler and
 * (optionally) a callback to compute its final-state payload before
 * the window closes.
 *
 * Every message is bound to the tab-scoped session passed in the popup URL,
 * so two main tabs on the same tutorial cannot control each other's popouts.
 */
(function () {
  'use strict';

  var HEARTBEAT_DEAD_MS = 12000;
  var HEARTBEAT_WARN_MS = 6000;
  var HEARTBEAT_POLL_MS = 1500;
  var HELLO_RETRY_MS = 400;
  var HELLO_TIMEOUT_MS = 2000;

  function genSourceId(role) {
    var prefix = String(role).split(':')[0] || 'popup';
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * @param {Object} opts
   * @param {string} opts.role           e.g. 'tab:foo.py' / 'pane:left' / 'output' / 'instructions'
   * @param {HTMLElement} [opts.statusEl]    Status indicator DOM element.
   * @param {string} [opts.statusClass='status']  Base CSS class; sub-classes ok / warn / bad are appended.
   * @param {Function} opts.onMessage    (msg, ctx) => void — role-specific message handler.
   * @param {Function} [opts.getFinalState] () => Object — payload merged into popup-closing.
   * @param {Function} [opts.onDarkModeChange] (enabled:boolean) => void — fires when dark-mode toggles.
   * @param {HTMLElement} [opts.overlayEl]  Overlay shown until the first state arrives; auto-hidden on connect.
   *
   * @returns {{
   *   post: (type:string, payload?:Object) => void,
   *   setStatus: (text:string, cls?:string) => void,
   *   flashStatus: (text:string, cls?:string, ms?:number) => void,
   *   role: string,
   *   sourceId: string,
   *   sessionId: string,
   *   params: URLSearchParams,
   *   tutorialTitle: string,
   *   channel: BroadcastChannel,
   *   markConnected: () => void,
   * }}
   */
  function connect(opts) {
    if (!opts || !opts.role || typeof opts.onMessage !== 'function') {
      throw new Error('SebookPopoutClient.connect: role + onMessage required');
    }
    var params = new URLSearchParams(location.search);
    var chName = params.get('channel');
    var sessionId = params.get('session');
    if (!chName || !sessionId) {
      if (opts.overlayEl) opts.overlayEl.textContent = 'Invalid popup URL (missing session).';
      throw new Error('SebookPopoutClient: missing channel or session param');
    }

    var role = opts.role;
    var sourceId = genSourceId(role);
    var tutorialTitle = params.get('title') || 'Tutorial';
    var channel = new BroadcastChannel(chName);
    var statusEl = opts.statusEl || null;
    if (statusEl && !statusEl.hasAttribute('role')) {
      statusEl.setAttribute('role', 'status');
      statusEl.setAttribute('aria-live', 'polite');
    }
    var statusBaseClass = opts.statusClass || 'status';
    var lastHeartbeat = 0;
    var connected = false;

    // ── Helpers ────────────────────────────────────────────────────────────
    function post(type, payload) {
      var msg = { type: type, sourceId: sourceId, sessionId: sessionId, ts: Date.now() };
      if (payload) for (var k in payload) msg[k] = payload[k];
      try { channel.postMessage(msg); } catch (e) { /* ignore */ }
    }

    function setStatus(text, cls) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className = statusBaseClass + (cls ? ' ' + cls : '');
    }

    var flashTimer;
    function flashStatus(text, cls, ms) {
      setStatus(text, cls || 'ok');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        if (connected) setStatus('Connected', 'ok');
      }, ms || 1500);
    }

    function markConnected() {
      if (!connected) {
        connected = true;
        if (opts.overlayEl) opts.overlayEl.style.display = 'none';
      }
      setStatus('Connected', 'ok');
    }

    function applyDarkMode(enabled) {
      document.documentElement.classList.toggle('dark-mode', !!enabled);
      if (typeof opts.onDarkModeChange === 'function') {
        try { opts.onDarkModeChange(!!enabled); } catch (e) { /* ignore */ }
      }
    }

    // ── Built-in message handling (heartbeat, dark-mode, force-close, save) ─
    channel.addEventListener('message', function (e) {
      var msg = e.data || {};
      if (msg.sessionId !== sessionId || msg.sourceId === sourceId) return;
      switch (msg.type) {
        case 'heartbeat':
          lastHeartbeat = Date.now();
          markConnected();
          post('heartbeat-ack', { role: role });
          return;
        case 'dark-mode':
          applyDarkMode(msg.enabled);
          return;
        case 'force-close':
          if (msg.targetRole === role) {
            try { sendClosing(); } catch (err) { /* ignore */ }
            setTimeout(function () { window.close(); }, 30);
          }
          return;
      }
      // Hand off everything else to the role-specific handler.
      try {
        opts.onMessage(msg, ctx);
      } catch (err) {
        console.error('[popout-client] onMessage threw:', err);
      }
    });

    function sendClosing() {
      var payload = { role: role };
      if (typeof opts.getFinalState === 'function') {
        try {
          var extra = opts.getFinalState();
          if (extra) for (var k in extra) payload[k] = extra[k];
        } catch (e) { /* ignore */ }
      }
      post('popup-closing', payload);
    }

    window.addEventListener('beforeunload', sendClosing);

    // ── Heartbeat watchdog ─────────────────────────────────────────────────
    setInterval(function () {
      if (!lastHeartbeat) return;
      var age = Date.now() - lastHeartbeat;
      if (age > HEARTBEAT_DEAD_MS) setStatus('Disconnected', 'bad');
      else if (age > HEARTBEAT_WARN_MS) setStatus('Reconnecting…', 'warn');
    }, HEARTBEAT_POLL_MS);

    // ── Hello handshake (with retry + cold-start fallback) ─────────────────
    post('hello', { role: role });
    setTimeout(function () { if (!connected) post('hello', { role: role }); }, HELLO_RETRY_MS);
    setTimeout(function () {
      if (!connected) {
        if (opts.overlayEl) opts.overlayEl.textContent = 'Reconnecting to tutorial…';
        setStatus('Reconnecting…', 'warn');
      }
    }, HELLO_TIMEOUT_MS);

    // ── Initial dark-mode from URL (already applied pre-paint by the
    //     popup HTML's tiny inline script, but mirror to onDarkModeChange
    //     so Monaco's theme can flip too without waiting for a message).
    var initialDark = params.get('dark') === '1';
    if (typeof opts.onDarkModeChange === 'function' && initialDark) {
      try { opts.onDarkModeChange(true); } catch (e) { /* ignore */ }
    }

    var ctx = {
      post: post,
      setStatus: setStatus,
      flashStatus: flashStatus,
      role: role,
      sourceId: sourceId,
      sessionId: sessionId,
      params: params,
      tutorialTitle: tutorialTitle,
      channel: channel,
      markConnected: markConnected,
    };
    return ctx;
  }

  window.SebookPopoutClient = { connect: connect };
})();
