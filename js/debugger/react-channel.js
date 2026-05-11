/**
 * Time-travel debugger — React-tutorial (iframe) channel.
 *
 * Parent-side adapter. Listens for trace events posted by the
 * `__ttd` runtime in the React preview iframe (see js/debugger/react/tracer.js)
 * and translates them into the controller's existing `paused` / `debugComplete`
 * shape. From the controller's perspective the React backend is just another
 * source of line-event snapshots: the same gutter / history / variables-panel
 * code that drives pyodide / browser / node sessions handles React sessions
 * unchanged.
 *
 * MVP scope (matches the "E" half of the A+E hybrid plan):
 *   - Record the user's full run as it happens; surface one snapshot per
 *     `__ttd.line` event so the existing time-travel UI lets the learner
 *     scrub forward/back.
 *   - Filter out events from React renders that never committed (concurrent
 *     mode discards them). Authors opt in to "see every render attempt"
 *     via `debugger_options.show_all_renders: true` in the tutorial YAML.
 *   - Surface phase markers (render / commit) so the gutter can show
 *     "render boundary" affordances later.
 *   - Forward DOM-event-handler invocations the same way; React's synthetic
 *     event system calls handlers like regular functions so the existing
 *     `__ttd.call` markers cover them.
 *
 * Out of scope for v1 (live stepping — the "A" half):
 *   - Mid-execution pause/step. iframes can't use SharedArrayBuffer to
 *     `Atomics.wait` like the worker backends, and an async pause via
 *     `await` would change React's synchronous hook ordering rules — a
 *     correctness regression that's worse than not having live step.
 *   - For now `sendCommand(CMD_STEP)` re-renders from the current scrub
 *     point + 1; this is implemented controller-side by advancing
 *     `historyIdx`, not by talking to the iframe.
 */

'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SEBookReactChannel = factory().ReactChannel;
  }
}(typeof self !== 'undefined' ? self : this, function () {

  var IFRAME_TAG = 'sebook-react-debugger';
  var IFRAME_CMD_TAG = 'sebook-react-debugger-cmd';

  // CMD codes — same set the other backends use.
  var CMD_QUIT = 4;

  function ReactChannel(controller, tutorial) {
    if (!controller) throw new Error('ReactChannel: controller is required');
    this.controller = controller;
    this.tutorial = tutorial;
    this._msgListener = null;
    this._active = false;
    this._showAllRenders = false;
    // Snapshot batching: trace events arrive at framerate; we don't want
    // one `paused` message per `__ttd.line`. Aggregate up to FLUSH_BUDGET
    // events or until a `commit` boundary, whichever comes first.
    this._buffer = [];
  }

  ReactChannel.prototype.install = function () {
    // Wired lazily on startSession; nothing to do here. The presence of an
    // `install` method matches the other channel modules' contract.
  };

  ReactChannel.prototype.startSession = function (cfg) {
    this._active = true;
    this._buffer = [];
    var opts = (cfg && cfg.options) || {};
    var dbgOpts = opts.debuggerOptions || (this.tutorial && this.tutorial.debuggerOptions) || {};
    this._showAllRenders = !!dbgOpts.show_all_renders;

    var self = this;
    this._msgListener = function (e) { self._onMessage(e); };
    window.addEventListener('message', this._msgListener);

    // Tell the iframe whether to suppress uncommitted-render events.
    this._postToIframe({ cmd: 'showAllRenders', value: this._showAllRenders });

    if (this.controller.setStatus) {
      this.controller.setStatus('recording…');
    }
  };

  ReactChannel.prototype.endSession = function () {
    if (!this._active) return;
    this._active = false;
    if (this._msgListener) {
      window.removeEventListener('message', this._msgListener);
      this._msgListener = null;
    }
  };

  ReactChannel.prototype._onMessage = function (e) {
    var d = e && e.data;
    if (!d || d.tag !== IFRAME_TAG || !d.event) return;
    var ev = d.event;
    if (ev.type === 'line') {
      this._buffer.push(this._snapshotFromLineEvent(ev));
      return;
    }
    if (ev.type === 'phase' && ev.phase === 'commit') {
      // Commit boundary: ship the accumulated snapshots. The controller
      // ingests them into history; the existing scrubber takes it from there.
      this._flush();
      return;
    }
    if (ev.type === 'done') {
      this._flush();
      this.controller.onDebugComplete({ exitCode: ev.exitCode | 0 });
      this.endSession();
    }
    // 'call' / 'return' / other 'phase' types are dropped in MVP — the
    // line stream alone already drives the gutter; the call/return events
    // are reserved for the variables-panel follow-up.
  };

  ReactChannel.prototype._flush = function () {
    if (!this._buffer.length) return;
    this.controller.onPaused({ snapshots: this._buffer });
    this._buffer = [];
  };

  // Convert a `{type:'line', file, line, scope}` event into the same
  // snapshot shape pyodide / node / gdb backends emit. Locals stay empty
  // in MVP (the Babel pass passes null scopeFn; capturing locals safely
  // requires per-scope identifier walking, deferred).
  ReactChannel.prototype._snapshotFromLineEvent = function (ev) {
    return {
      file: ev.file,
      line: ev.line,
      event: 'line',
      stack: [{
        file: ev.file,
        line: ev.line,
        function: '<jsx>',
        locals: {},
      }],
    };
  };

  ReactChannel.prototype.sendCommand = function (cmdCode) {
    // MVP: only CMD_QUIT does anything iframe-side (tear down listener).
    // The controller's scrubber owns step/continue navigation through the
    // recorded history; no iframe round-trip needed.
    if (cmdCode === CMD_QUIT) this.endSession();
  };

  ReactChannel.prototype.sendBreakpointChanges = function () { /* breakpoints
    are evaluated against the recorded history on the controller side; the
    iframe doesn't need to know about them. */ };
  ReactChannel.prototype.sendWatches = function () { /* no live edits in MVP */ };
  ReactChannel.prototype.sendLiveEdits = function () { /* no live edits in MVP */ };
  ReactChannel.prototype.sendExceptionBreakpoints = function () { /* no exception
    breakpoints in MVP */ };

  ReactChannel.prototype._postToIframe = function (payload) {
    var iframe = this.tutorial && this.tutorial._reactFrame;
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        Object.assign({ tag: IFRAME_CMD_TAG }, payload),
        '*'
      );
    } catch (e) { /* iframe gone */ }
  };

  return { ReactChannel: ReactChannel };
}));
