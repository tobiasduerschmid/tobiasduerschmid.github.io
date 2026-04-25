/**
 * TutorialPopoutManager — robust multi-window sync for the tutorial editor.
 *
 * Owns:
 *   - one BroadcastChannel  (channel:  'ttsync-' + pathname)
 *   - a registry of open popup Window references keyed by role
 *     ('tab:<filename>' or 'instructions')
 *   - heartbeat + closed-poll loops for liveness detection
 *   - a localStorage mirror of detached file content so reload of the main
 *     window can recover student work even before reattach
 *
 * Lives next to tutorial-code.js and is wired in from there. The main window
 * supplies hook callbacks; popups talk to it via the message protocol below.
 *
 * Message protocol
 *   {type, sourceId, ts, ...payload}
 *   sourceId lets the manager ignore its own broadcasts (BroadcastChannel
 *   does not echo to the same context, but we still tag for clarity / for
 *   future wires that may not have that guarantee).
 */
(function () {
  'use strict';

  var CHANNEL_PREFIX = 'ttsync-';
  var STORAGE_PREFIX = 'tutorial-popout-state-';
  var HEARTBEAT_MS = 2000;
  var DEAD_AFTER_MS = 6000;
  var CLOSE_POLL_MS = 1000;

  function uid() {
    return 'm-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * @param {Object} opts
   * @param {string} opts.tutorialId
   * @param {string} opts.pathname
   * @param {Object} opts.hooks       see init()
   * @param {string} opts.tabPopupUrl  resolved by Jekyll
   * @param {string} opts.instructionsPopupUrl
   */
  function TutorialPopoutManager(opts) {
    this.tutorialId = opts.tutorialId || 'default';
    this.pathname = opts.pathname || window.location.pathname;
    this.tabPopupUrl = opts.tabPopupUrl || '/tutorial-tab-popup.html';
    this.instructionsPopupUrl = opts.instructionsPopupUrl || '/tutorial-instructions-popup.html';
    this.panePopupUrl = opts.panePopupUrl || '/tutorial-pane-popup.html';
    this.outputPopupUrl = opts.outputPopupUrl || '/tutorial-output-popup.html';
    this.graphPopupUrl = opts.graphPopupUrl || '/tutorial-graph-popup.html';
    this.tutorialTitle = opts.tutorialTitle || '';
    this.hooks = opts.hooks || {};

    this.sourceId = 'main-' + uid();
    this.channelName = CHANNEL_PREFIX + this.pathname;
    this.storageKey = STORAGE_PREFIX + this.pathname;

    this.channel = null;
    this._popups = {};         // role -> {window, openedAt}
    this._fileVersions = {};   // filename -> integer version counter
    this._closePollTimer = null;
    this._heartbeatTimer = null;
    this._available = !!(window.BroadcastChannel);
  }

  TutorialPopoutManager.prototype.init = function () {
    if (!this._available) return;
    var self = this;
    try {
      this.channel = new BroadcastChannel(this.channelName);
    } catch (e) {
      this._available = false;
      return;
    }
    this.channel.addEventListener('message', function (e) {
      self._onMessage(e.data || {});
    });
    this._heartbeatTimer = setInterval(function () { self._heartbeat(); }, HEARTBEAT_MS);
    this._closePollTimer = setInterval(function () { self._pollClosed(); }, CLOSE_POLL_MS);

    // If there is leftover popup state from a previous main-window session,
    // restore the detached-file content into our mirror so reattach is instant.
    this._restoreStateMirror();
  };

  TutorialPopoutManager.prototype.isAvailable = function () { return this._available; };

  TutorialPopoutManager.prototype.isDetached = function (role) {
    var p = this._popups[role];
    return !!(p && p.window && !p.window.closed);
  };

  TutorialPopoutManager.prototype.getDetachedRoles = function () {
    var out = [];
    for (var role in this._popups) {
      if (this.isDetached(role)) out.push(role);
    }
    return out;
  };

  // ---------------------------------------------------------------------------
  // Detach: tab
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype.detachFile = function (filename, fileMeta) {
    if (!this._available) return null;
    var role = 'tab:' + filename;
    var existing = this._popups[role];
    if (existing && existing.window && !existing.window.closed) {
      existing.window.focus();
      // Re-broadcast the snapshot so the popup can rebuild if it was reloaded.
      this._sendFileSnapshot(filename, fileMeta);
      return existing.window;
    }
    var winName = this._windowNameForFile(filename);
    var darkMode = document.documentElement.classList.contains('dark-mode');
    var url = this.tabPopupUrl
      + '?channel=' + encodeURIComponent(this.channelName)
      + '&filename=' + encodeURIComponent(filename)
      + '&dark=' + (darkMode ? '1' : '0')
      + (this.tutorialTitle ? '&title=' + encodeURIComponent(this.tutorialTitle) : '');
    var w = window.open(url, winName, 'width=900,height=700,resizable=yes,scrollbars=yes');
    if (!w) return null;
    this._popups[role] = { window: w, openedAt: Date.now() };
    // Initial snapshot — popup will also send 'hello' once loaded; both are safe.
    var self = this;
    setTimeout(function () { self._sendFileSnapshot(filename, fileMeta); }, 50);
    this._notifyPopupOpened(role);
    this._writeStateMirror();
    return w;
  };

  // ---------------------------------------------------------------------------
  // Detach: pane (split-mode left or right)
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype.detachPane = function (pane, meta) {
    if (!this._available) return null;
    var role = 'pane:' + pane;
    var existing = this._popups[role];
    if (existing && existing.window && !existing.window.closed) {
      existing.window.focus();
      this._sendPaneSnapshot(pane, meta);
      return existing.window;
    }
    var winName = 'tpane-' + this.pathname + '-' + pane;
    var darkMode = (meta && meta.darkMode)
      || document.documentElement.classList.contains('dark-mode');
    var url = this.panePopupUrl
      + '?channel=' + encodeURIComponent(this.channelName)
      + '&pane=' + encodeURIComponent(pane)
      + '&dark=' + (darkMode ? '1' : '0')
      + (this.tutorialTitle ? '&title=' + encodeURIComponent(this.tutorialTitle) : '');
    var w = window.open(url, winName, 'width=1000,height=720,resizable=yes,scrollbars=yes');
    if (!w) return null;
    this._popups[role] = { window: w, openedAt: Date.now(), pane: pane };
    var self = this;
    setTimeout(function () { self._sendPaneSnapshot(pane, meta); }, 50);
    this._notifyPopupOpened(role);
    this._writeStateMirror();
    return w;
  };

  TutorialPopoutManager.prototype._sendPaneSnapshot = function (pane, meta) {
    if (!meta) return;
    var files = (meta.files || []).map(function (f) { return f.filename; });
    var fileMap = {};
    var self = this;
    (meta.files || []).forEach(function (f) {
      var v = (self._fileVersions[f.filename] || 0) + 1;
      self._fileVersions[f.filename] = v;
      fileMap[f.filename] = {
        content: f.content || '',
        language: f.language || '',
        version: v,
      };
    });
    this._post('pane-snapshot', {
      pane: pane,
      activeFile: meta.activeFile || files[0] || null,
      files: fileMap,
      filenames: files,
      darkMode: !!meta.darkMode,
    });
  };

  // ---------------------------------------------------------------------------
  // Detach: output / terminal / preview
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype.detachOutput = function (meta) {
    if (!this._available) return null;
    var role = 'output';
    var existing = this._popups[role];
    if (existing && existing.window && !existing.window.closed) {
      existing.window.focus();
      this._sendOutputSnapshot(meta);
      return existing.window;
    }
    var winName = 'toutput-' + this.pathname;
    var darkMode = (meta && meta.darkMode)
      || document.documentElement.classList.contains('dark-mode');
    var url = this.outputPopupUrl
      + '?channel=' + encodeURIComponent(this.channelName)
      + '&kind=' + encodeURIComponent((meta && meta.kind) || 'output')
      + '&dark=' + (darkMode ? '1' : '0')
      + (this.tutorialTitle ? '&title=' + encodeURIComponent(this.tutorialTitle) : '');
    var w = window.open(url, winName, 'width=900,height=600,resizable=yes,scrollbars=yes');
    if (!w) return null;
    this._popups[role] = { window: w, openedAt: Date.now() };
    var self = this;
    setTimeout(function () { self._sendOutputSnapshot(meta); }, 50);
    this._notifyPopupOpened(role);
    this._writeStateMirror();
    return w;
  };

  TutorialPopoutManager.prototype._sendOutputSnapshot = function (meta) {
    if (!meta) return;
    this._post('output-snapshot', {
      kind: meta.kind || 'output',
      content: meta.content || '',
      darkMode: !!meta.darkMode,
    });
  };

  TutorialPopoutManager.prototype.broadcastOutputUpdate = function (payload) {
    this._post('output-update', payload || {});
  };

  TutorialPopoutManager.prototype.broadcastOutputControlsState = function (controls) {
    this._post('controls-state', { controls: controls || {} });
  };

  /**
   * Forward a React hot-reload patch to any preview popout. The popup's
   * iframe registered the same `react-hot-reload` postMessage listener
   * (via the original srcdoc), so re-posting the patch into the popup's
   * contentWindow re-renders without a full srcdoc swap.
   */
  TutorialPopoutManager.prototype.broadcastReactPatch = function (payload) {
    this._post('react-patch', { payload: payload });
  };

  // ---------------------------------------------------------------------------
  // Detach: git graph
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype.detachGraph = function (meta) {
    if (!this._available) return null;
    var role = 'graph';
    var existing = this._popups[role];
    if (existing && existing.window && !existing.window.closed) {
      existing.window.focus();
      this._sendGraphSnapshot(meta);
      return existing.window;
    }
    var winName = 'tgraph-' + this.pathname;
    var darkMode = (meta && meta.darkMode)
      || document.documentElement.classList.contains('dark-mode');
    var url = this.graphPopupUrl
      + '?channel=' + encodeURIComponent(this.channelName)
      + '&dark=' + (darkMode ? '1' : '0')
      + (this.tutorialTitle ? '&title=' + encodeURIComponent(this.tutorialTitle) : '');
    var w = window.open(url, winName, 'width=900,height=720,resizable=yes,scrollbars=yes');
    if (!w) return null;
    this._popups[role] = { window: w, openedAt: Date.now() };
    var self = this;
    setTimeout(function () { self._sendGraphSnapshot(meta); }, 50);
    this._notifyPopupOpened(role);
    this._writeStateMirror();
    return w;
  };

  TutorialPopoutManager.prototype._sendGraphSnapshot = function (meta) {
    if (!meta) return;
    this._post('graph-snapshot', {
      html: meta.html || '',
      darkMode: !!meta.darkMode,
    });
  };

  TutorialPopoutManager.prototype.broadcastGraphUpdate = function (payload) {
    this._post('graph-update', payload || {});
  };

  // ---------------------------------------------------------------------------
  // Detach: instructions
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype.detachInstructions = function () {
    if (!this._available) return null;
    var role = 'instructions';
    var existing = this._popups[role];
    if (existing && existing.window && !existing.window.closed) {
      existing.window.focus();
      if (this.hooks.getInstructionsSnapshot) {
        var snap = this.hooks.getInstructionsSnapshot();
        if (snap) this._post('state-snapshot', { instructions: snap });
      }
      return existing.window;
    }
    var darkMode = document.documentElement.classList.contains('dark-mode');
    var url = this.instructionsPopupUrl
      + '?channel=' + encodeURIComponent(this.channelName)
      + '&dark=' + (darkMode ? '1' : '0')
      + (this.tutorialTitle ? '&title=' + encodeURIComponent(this.tutorialTitle) : '');
    var winName = 'tinstr-' + this.pathname;
    var w = window.open(url, winName, 'width=720,height=820,resizable=yes,scrollbars=yes');
    if (!w) return null;
    this._popups[role] = { window: w, openedAt: Date.now() };
    var self = this;
    setTimeout(function () {
      if (self.hooks.getInstructionsSnapshot) {
        var snap = self.hooks.getInstructionsSnapshot();
        if (snap) self._post('state-snapshot', { instructions: snap });
      }
    }, 50);
    this._notifyPopupOpened(role);
    this._writeStateMirror();
    return w;
  };

  // Force a popup to close (used when the user clicks the in-main "(detached)" placeholder
  // to reattach without hunting down the popup window).
  TutorialPopoutManager.prototype.requestPopupClose = function (role) {
    var p = this._popups[role];
    if (!p || !p.window || p.window.closed) return;
    this._post('force-close', { targetRole: role });
    // Best-effort direct close too (allowed for windows we opened).
    try { p.window.close(); } catch (e) { /* ignore */ }
  };

  // Close every tab/pane popup (instructions popup is left untouched). Called
  // when the editor layout mode (tabs ↔ split) changes — files in popups must
  // come back to the main view so the new layout has consistent state.
  TutorialPopoutManager.prototype.closeEditorPopups = function () {
    var roles = Object.keys(this._popups || {});
    for (var i = 0; i < roles.length; i++) {
      var role = roles[i];
      if (role.indexOf('tab:') === 0 || role.indexOf('pane:') === 0) {
        this.requestPopupClose(role);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Outgoing broadcasts (main -> popups)
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype.broadcastStepChange = function (payload) {
    this._post('step-change', payload);
  };

  TutorialPopoutManager.prototype.broadcastTestStarted = function () {
    this._post('test-started', {});
  };

  TutorialPopoutManager.prototype.broadcastTestResult = function (payload) {
    this._post('test-result', payload);
  };

  TutorialPopoutManager.prototype.broadcastDarkMode = function (enabled) {
    this._post('dark-mode', { enabled: !!enabled });
  };

  TutorialPopoutManager.prototype.broadcastNavState = function (payload) {
    this._post('nav-state', payload);
  };

  // ---------------------------------------------------------------------------
  // Incoming routing (popup -> main)
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype._onMessage = function (msg) {
    if (!msg || msg.sourceId === this.sourceId) return;
    switch (msg.type) {
      case 'hello': this._handleHello(msg); break;
      case 'file-edit': this._handleFileEdit(msg); break;
      case 'request-step-change': this._safeHook('onStepChangeRequest', msg.stepIndex); break;
      case 'request-prev-step': this._safeHook('onPrevStepRequest'); break;
      case 'request-next-step': this._safeHook('onNextStepRequest'); break;
      case 'request-run-tests': this._safeHook('onRunTestsRequest'); break;
      case 'request-save': this._safeHook('onSaveFileRequest', msg.filename); break;
      case 'quiz-passed': this._safeHook('onQuizPassedFromPopup', msg.stepIndex); break;
      case 'request-run': this._safeHook('onRunOutputRequest', msg.args || ''); break;
      case 'request-stop': this._safeHook('onStopOutputRequest'); break;
      case 'request-clear': this._safeHook('onClearOutputRequest'); break;
      case 'request-refresh': this._safeHook('onRefreshOutputRequest'); break;
      case 'args-change': this._safeHook('onArgsChange', msg.args || ''); break;
      case 'stream-filter-change': this._safeHook('onStreamFilterChange', msg.filter || 'all'); break;
      case 'popup-closing': this._handlePopupClosing(msg); break;
      case 'heartbeat-ack': /* informational */ break;
      default: break;
    }
  };

  TutorialPopoutManager.prototype._handleHello = function (msg) {
    var role = msg.role;
    if (!role) return;
    // We may already track the window from window.open(); also remember the
    // role even if the user opened a popup directly via URL (rare).
    if (!this._popups[role] || !this._popups[role].window) {
      this._popups[role] = { window: null, openedAt: Date.now() };
    }
    if (role.indexOf('tab:') === 0) {
      var filename = role.slice(4);
      if (this.hooks.getFileMeta) {
        var meta = this.hooks.getFileMeta(filename);
        if (meta) this._sendFileSnapshot(filename, meta);
      }
    } else if (role.indexOf('pane:') === 0) {
      var pane = role.slice(5);
      if (this.hooks.getPaneMeta) {
        var pmeta = this.hooks.getPaneMeta(pane);
        if (pmeta) this._sendPaneSnapshot(pane, pmeta);
      }
    } else if (role === 'output') {
      if (this.hooks.getOutputMeta) {
        var ometa = this.hooks.getOutputMeta();
        if (ometa) this._sendOutputSnapshot(ometa);
      }
    } else if (role === 'graph') {
      if (this.hooks.getGraphMeta) {
        var gmeta = this.hooks.getGraphMeta();
        if (gmeta) this._sendGraphSnapshot(gmeta);
      }
    } else if (role === 'instructions') {
      if (this.hooks.getInstructionsSnapshot) {
        var snap = this.hooks.getInstructionsSnapshot();
        if (snap) this._post('state-snapshot', { instructions: snap });
      }
    }
    this._notifyPopupOpened(role);
  };

  TutorialPopoutManager.prototype._handleFileEdit = function (msg) {
    var fn = msg.filename;
    if (!fn) return;
    var v = this._fileVersions[fn] || 0;
    if (typeof msg.version === 'number' && msg.version < v) return; // stale
    this._fileVersions[fn] = (typeof msg.version === 'number') ? msg.version : (v + 1);
    this._safeHook('onFileEditFromPopup', fn, msg.content, this._fileVersions[fn]);
    // Mirror to localStorage so a main reload doesn't lose work
    this._writeStateMirror({ filename: fn, content: msg.content });
  };

  TutorialPopoutManager.prototype._handlePopupClosing = function (msg) {
    var role = msg.role;
    if (!role) return;
    var passthrough = msg.finalContent;
    // Apply final content if a tab is closing
    if (role.indexOf('tab:') === 0 && typeof msg.finalContent === 'string') {
      this._safeHook('onFileEditFromPopup', role.slice(4), msg.finalContent,
        (this._fileVersions[role.slice(4)] || 0) + 1);
    }
    // Apply final per-file contents map for pane closures
    if (role.indexOf('pane:') === 0 && msg.finalContents && typeof msg.finalContents === 'object') {
      var self = this;
      Object.keys(msg.finalContents).forEach(function (fn) {
        self._safeHook('onFileEditFromPopup', fn, msg.finalContents[fn],
          (self._fileVersions[fn] || 0) + 1);
      });
      passthrough = msg.finalContents;
    }
    var entry = this._popups[role];
    delete this._popups[role];
    this._safeHook('onPopupClosed', role, passthrough);
    this._writeStateMirror();
    // window may not be fully closed yet; don't poke it.
    if (entry && entry.window) {
      try { /* allow GC */ entry.window = null; } catch (e) { /* ignore */ }
    }
  };

  // ---------------------------------------------------------------------------
  // Liveness
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype._heartbeat = function () {
    this._post('heartbeat', { ts: Date.now() });
  };

  TutorialPopoutManager.prototype._pollClosed = function () {
    var changed = false;
    for (var role in this._popups) {
      var p = this._popups[role];
      if (!p) continue;
      if (p.window && p.window.closed) {
        delete this._popups[role];
        this._safeHook('onPopupClosed', role, null);
        changed = true;
      }
    }
    if (changed) this._writeStateMirror();
  };

  // ---------------------------------------------------------------------------
  // Snapshot helpers
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype._sendFileSnapshot = function (filename, meta) {
    if (!meta) return;
    var v = (this._fileVersions[filename] || 0) + 1;
    this._fileVersions[filename] = v;
    this._post('file-snapshot', {
      filename: filename,
      content: meta.content || '',
      language: meta.language || '',
      version: v,
      darkMode: !!meta.darkMode,
    });
    this._writeStateMirror();
  };

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  TutorialPopoutManager.prototype._post = function (type, payload) {
    if (!this.channel) return;
    var msg = { type: type, sourceId: this.sourceId, ts: Date.now() };
    if (payload) {
      for (var k in payload) msg[k] = payload[k];
    }
    try { this.channel.postMessage(msg); } catch (e) { /* ignore */ }
  };

  TutorialPopoutManager.prototype._safeHook = function (name) {
    var fn = this.hooks[name];
    if (typeof fn !== 'function') return;
    var args = Array.prototype.slice.call(arguments, 1);
    try { fn.apply(null, args); } catch (e) { console.error('[popout-manager] hook ' + name + ' threw', e); }
  };

  TutorialPopoutManager.prototype._notifyPopupOpened = function (role) {
    this._safeHook('onPopupOpened', role);
  };

  TutorialPopoutManager.prototype._windowNameForFile = function (filename) {
    return 'ttab-' + this.pathname + '-' + filename;
  };

  TutorialPopoutManager.prototype._writeStateMirror = function (extra) {
    try {
      var detached = this.getDetachedRoles();
      var existing = this._readStateMirror() || { files: {} };
      var snapshot = { detached: detached, files: existing.files || {}, ts: Date.now() };
      if (extra && extra.filename) {
        snapshot.files[extra.filename] = { content: extra.content, ts: Date.now() };
      }
      localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch (e) { /* quota or unavailable — fine, sync still works in-memory */ }
  };

  TutorialPopoutManager.prototype._readStateMirror = function () {
    try {
      var raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  };

  TutorialPopoutManager.prototype._restoreStateMirror = function () {
    var snap = this._readStateMirror();
    if (!snap || !snap.files) return;
    // Hand the recovered file contents back to main so any popups that survived
    // a reload get their work preserved. Main applies these on file open.
    if (this.hooks.onMirrorRecover) {
      try { this.hooks.onMirrorRecover(snap); } catch (e) { /* ignore */ }
    }
  };

  // Public method for main to clear the mirror after all popups are closed and
  // changes are merged into normal autosave.
  TutorialPopoutManager.prototype.clearStateMirror = function () {
    try { localStorage.removeItem(this.storageKey); } catch (e) { /* ignore */ }
  };

  window.TutorialPopoutManager = TutorialPopoutManager;
})();
