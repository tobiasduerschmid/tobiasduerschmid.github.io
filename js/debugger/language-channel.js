/** Message-based debugger transport for Prolog and Haskell.
 * Each session owns an executor; cancellation destroys it without disturbing Run.
 * Pauses are cooperative interpreter boundaries, so neither backend needs SAB.
 */
(function () {
  'use strict';

  class LanguageChannel {
    constructor(controller, tutorial) {
      this.controller = controller;
      this.tutorial = tutorial;
      this.executor = null;
      this.deadline = null;
      this.generation = 0;
      this.readOnlyHistory = true;
    }

    dispose() {
      clearTimeout(this.deadline);
      this.deadline = null;
      const executor = this.executor;
      this.executor = null;
      this.generation += 1;
      if (executor) executor.terminate();
    }

    startSession(config) {
      this.dispose();
      const generation = this.generation;
      const timeout = Number(config.options.execution_timeout_ms);
      this.timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : 30000;
      try {
        this.executor = this.tutorial.config.backend === 'haskell'
          ? this.tutorial._createHaskellExecutor()
          : new Worker('/js/debugger/prolog/runtime.js');
        this.executor.onmessage = event => {
          if (generation !== this.generation) return;
          const message = event.data;
          if (message.type === 'ready') {
            this.executor.postMessage(Object.assign({}, config, { type: 'start' }));
            this.armDeadline(this.timeoutMs);
          } else {
            this.receive(message);
          }
        };
        this.executor.onerror = event => {
          if (generation === this.generation) this.fail(event.message || 'Debugger runtime failed');
        };
        this.armDeadline(120000);
      } catch (error) {
        this.fail(error.message);
      }
    }

    armDeadline(milliseconds) {
      clearTimeout(this.deadline);
      this.deadline = setTimeout(() => this.fail('Debugger execution timed out. Stop or simplify the program and try again.'), milliseconds);
    }

    receive(message) {
      const controller = this.controller;
      if (message.type === 'paused') {
        clearTimeout(this.deadline);
        this.deadline = null;
        controller.onPaused(message);
      } else if (message.type === 'debugComplete') {
        this.dispose();
        controller.onDebugComplete(message);
      } else if (message.type === 'stdout' || message.type === 'stderr') {
        this.tutorial._appendOutput(message.text || '', message.type);
      } else if (message.type === 'breakpointError') {
        controller.onBreakpointError(message);
      } else if (message.type === 'capReached') {
        controller.onCapReached(message);
      } else if (message.type === 'error' || message.type === 'debuggerError') {
        this.fail(message.message || 'Debugger runtime failed');
      }
    }

    fail(error) {
      this.dispose();
      this.controller.onDebugComplete({ exitCode: 1, error: String(error) });
    }

    sendCommand(command) {
      if (command === 5) {
        this.dispose();
        const generation = this.generation;
        Promise.resolve().then(() => {
          if (generation === this.generation) this.controller.onDebugComplete({ exitCode: 0, stopped: true });
        });
      } else if (this.executor) {
        this.armDeadline(this.timeoutMs);
        this.executor.postMessage({ type: 'command', command: command });
      }
    }

    sendBreakpointChanges(changes) {
      if (!this.executor) return false;
      this.executor.postMessage({ type: 'breakpoints', changes: changes });
      return true;
    }

    sendWatches(watches) {
      if (!this.executor) return false;
      this.executor.postMessage({ type: 'watches', watches: watches });
      return true;
    }

    sendExceptionBreakpoints() { return false; }
    sendLiveEdits() { return false; }
  }

  window.SEBookLanguageChannel = LanguageChannel;
})();
