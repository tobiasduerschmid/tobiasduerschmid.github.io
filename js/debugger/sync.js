/**
 * DebuggerSync — single source of truth bus for the time-travel debugger.
 *
 * Authority (main window) holds the writable state and the worker/SAB session.
 * Mirrors (popout windows) hold a frozen copy and can dispatch action requests
 * upstream. Patches and history-appends flow authority → mirrors automatically;
 * actions flow mirrors → authority.
 *
 * Wire format (all messages on the existing tutorial BroadcastChannel,
 * tagged with `dbg:` prefix to coexist with TutorialPopoutManager messages):
 *
 *   dbg:hello       {role}                          mirror joining
 *   dbg:snapshot    {state, history}                authority's full reply
 *   dbg:patch       {patch}                         small state diffs
 *   dbg:hist-append {snaps, replaceLast}            incremental history growth
 *   dbg:action      {action: {type, ...}}           mirror -> authority request
 *   dbg:bye         {role}                          mirror closing (optional)
 *
 * Why split `patch` from `hist-append`? A debug session can produce thousands
 * of snapshots; if every tick re-broadcast the full history we'd freeze the
 * UI thread on JSON cloning. Patches carry small state (historyIdx, paused,
 * status, breakpoints, watches), history grows append-only.
 *
 * subscribe(fn) callbacks fire after every state change with the full state
 * AND a Set of top-level keys that changed since last call — so renderers can
 * cheaply skip work when their relevant slice is unchanged.
 */
(function () {
  'use strict';

  var TAG = 'dbg:';

  /**
   * @param {Object} opts
   * @param {BroadcastChannel} opts.channel  required
   * @param {string} opts.sourceId           required (used to ignore self-echo)
   * @param {boolean} opts.isAuthority       true on main, false on popouts
   * @param {string} [opts.role]             popout role label (debug only)
   * @param {Object} [opts.initialState]     authority seed
   */
  function DebuggerSync(opts) {
    if (!opts || !opts.channel || !opts.sourceId) {
      throw new Error('DebuggerSync: channel + sourceId required');
    }
    this.channel = opts.channel;
    this.sourceId = opts.sourceId;
    this.isAuthority = !!opts.isAuthority;
    this.role = opts.role || (this.isAuthority ? 'main' : 'mirror');
    this.state = opts.initialState ? clone(opts.initialState) : defaultState();
    this._listeners = [];
    this._actionHandler = null;
    this._helloHandler = null;
    this._helloRetries = 0;
    var self = this;
    this._onMessage = function (e) { self._dispatchMessage(e.data); };
    this.channel.addEventListener('message', this._onMessage);
  }

  function defaultState() {
    return {
      tutorialId: null,
      backend: null,
      debuggerEnabled: false,
      activeFile: null,
      paneForFile: {},
      filesAvailable: [],
      // breakpoints[path] = { line: { condition, condError } }
      breakpoints: {},
      watches: [],
      session: {
        active: false,
        capReached: false,
        status: '',
        statusKind: 'idle',
        stepButtonsDisabled: true,
      },
      history: [],
      historyIdx: -1,
      liveIdx: -1,
      selectedFrameIdx: -1,
      paused: false,
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // -- Subscriptions --------------------------------------------------------
  DebuggerSync.prototype.subscribe = function (fn) {
    if (typeof fn !== 'function') return function () {};
    this._listeners.push(fn);
    var self = this;
    return function () {
      var i = self._listeners.indexOf(fn);
      if (i >= 0) self._listeners.splice(i, 1);
    };
  };

  DebuggerSync.prototype._fire = function (changedKeys) {
    var s = this.state;
    var keys = changedKeys || new Set();
    for (var i = 0; i < this._listeners.length; i++) {
      try { this._listeners[i](s, keys); }
      catch (e) { console.error('[DebuggerSync] subscriber threw', e); }
    }
  };

  // -- Authority API --------------------------------------------------------

  /** Apply a partial patch to top-level state keys and broadcast. */
  DebuggerSync.prototype.publish = function (patch) {
    if (!this.isAuthority) {
      console.warn('[DebuggerSync] publish() called on mirror; dropped');
      return;
    }
    var changed = this._applyPatch(patch);
    if (changed.size === 0) return;
    this._send('patch', { patch: patch });
    this._fire(changed);
  };

  /** Append snapshots to history (incremental, cheap on the wire). */
  DebuggerSync.prototype.appendHistory = function (snaps, replaceLast) {
    if (!this.isAuthority) {
      console.warn('[DebuggerSync] appendHistory() called on mirror; dropped');
      return;
    }
    if (!snaps || !snaps.length) return;
    if (replaceLast && this.state.history.length > 0) {
      this.state.history[this.state.history.length - 1] = snaps[0];
      for (var i = 1; i < snaps.length; i++) this.state.history.push(snaps[i]);
    } else {
      for (var j = 0; j < snaps.length; j++) this.state.history.push(snaps[j]);
    }
    this._send('hist-append', { snaps: snaps, replaceLast: !!replaceLast });
    var keys = new Set(); keys.add('history');
    this._fire(keys);
  };

  /** Replace state wholesale (e.g. step-change resets). */
  DebuggerSync.prototype.replaceState = function (next) {
    if (!this.isAuthority) return;
    this.state = clone(next);
    this._send('snapshot', { state: this.state, history: this.state.history });
    this._fire(new Set(Object.keys(this.state)));
  };

  /** Register handler for actions sent by mirrors. fn(action). */
  DebuggerSync.prototype.onAction = function (fn) {
    this._actionHandler = fn;
  };

  /** Register handler called when a mirror says hello (so authority can
   *  refresh dependent state). fn(role). */
  DebuggerSync.prototype.onHello = function (fn) {
    this._helloHandler = fn;
  };

  // -- Mirror API -----------------------------------------------------------

  /** Mirror sends an action request to authority. */
  DebuggerSync.prototype.dispatch = function (action) {
    if (this.isAuthority) {
      // On main: dispatch is local — call the action handler synchronously.
      if (this._actionHandler) {
        try { this._actionHandler(action); }
        catch (e) { console.error('[DebuggerSync] action handler threw', e); }
      }
      return;
    }
    this._send('action', { action: action });
  };

  /** Ask the authority for a fresh full snapshot. */
  DebuggerSync.prototype.requestSnapshot = function () {
    if (this.isAuthority) return;
    this._send('hello', { role: this.role });
  };

  // -- Patch logic ----------------------------------------------------------

  // Applies a top-level shallow patch: each key in `patch` overwrites the
  // corresponding key in state. Returns the Set of keys actually changed.
  DebuggerSync.prototype._applyPatch = function (patch) {
    var changed = new Set();
    if (!patch) return changed;
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var nextVal = patch[k];
      var prevVal = this.state[k];
      if (!shallowEqual(prevVal, nextVal)) {
        this.state[k] = nextVal;
        changed.add(k);
      }
    }
    return changed;
  };

  function shallowEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    var ak = Object.keys(a); var bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (var i = 0; i < ak.length; i++) {
      if (a[ak[i]] !== b[ak[i]]) return false;
    }
    return true;
  }

  // -- Wire ----------------------------------------------------------------

  DebuggerSync.prototype._send = function (kind, payload) {
    var msg = { type: TAG + kind, sourceId: this.sourceId, ts: Date.now() };
    if (payload) for (var k in payload) msg[k] = payload[k];
    try { this.channel.postMessage(msg); } catch (e) { /* ignore */ }
  };

  DebuggerSync.prototype._dispatchMessage = function (msg) {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.sourceId === this.sourceId) return;
    if (msg.type.indexOf(TAG) !== 0) return;
    var kind = msg.type.slice(TAG.length);
    switch (kind) {
      case 'hello':
        if (this.isAuthority) {
          // Reply with full snapshot, including history.
          this._send('snapshot', { state: this.state, history: this.state.history });
          if (this._helloHandler) {
            try { this._helloHandler(msg.role); }
            catch (e) { console.error('[DebuggerSync] hello handler threw', e); }
          }
        }
        break;
      case 'snapshot':
        if (!this.isAuthority) {
          var next = msg.state || {};
          if (msg.history) next.history = msg.history;
          var prev = this.state;
          this.state = clone(next);
          var changed = new Set();
          for (var k in this.state) changed.add(k);
          for (var pk in prev) changed.add(pk);
          this._fire(changed);
        }
        break;
      case 'patch':
        if (!this.isAuthority) {
          var changedP = this._applyPatch(msg.patch || {});
          if (changedP.size > 0) this._fire(changedP);
        }
        break;
      case 'hist-append':
        if (!this.isAuthority && msg.snaps && msg.snaps.length) {
          if (msg.replaceLast && this.state.history.length > 0) {
            this.state.history[this.state.history.length - 1] = msg.snaps[0];
            for (var i = 1; i < msg.snaps.length; i++) this.state.history.push(msg.snaps[i]);
          } else {
            for (var j = 0; j < msg.snaps.length; j++) this.state.history.push(msg.snaps[j]);
          }
          var keysH = new Set(); keysH.add('history');
          this._fire(keysH);
        }
        break;
      case 'action':
        if (this.isAuthority && this._actionHandler && msg.action) {
          try { this._actionHandler(msg.action); }
          catch (e) { console.error('[DebuggerSync] action handler threw', e); }
        }
        break;
    }
  };

  DebuggerSync.prototype.dispose = function () {
    this.channel.removeEventListener('message', this._onMessage);
    this._listeners = [];
  };

  window.DebuggerSync = DebuggerSync;
})();
