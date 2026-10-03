(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const copy = value => structuredClone(value);
  /** One persistent live Workspace; isolated checks share its RuntimeHost leases. */
  class TutorialAdapter {
    #host; #fresh; #workspace = null; #subscription = null; #step = null; #saved = new Map(); #controller = null; #recovery = Promise.resolve(); #recoveryFailed = false; #disposed = false; #onEvent; #epoch = 0;
    static async create({ signal, onEvent = () => {} } = {}) {
      const host = await api.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json', signal });
      try { return new TutorialAdapter(host, await api.FreshRunner.create({ host }), onEvent); }
      catch (error) { host.dispose(); throw error; }
    }
    constructor(host, fresh, onEvent) { this.#host = host; this.#fresh = fresh; this.#onEvent = onEvent; }
    get workspace() { return this.#workspace; }
    getWorkspace() { return this.#workspace; }
    get programEpoch() { return this.#epoch; }
    getProgram() { return this.#workspace && this.#workspace.snapshot(); }
    clearSavedProgress() { this.#saved.clear(); }
    getMigratedLegacyFiles() {
      return Object.fromEntries(Array.from(this.#saved.values()).flatMap(saved => Object.entries(saved.migratedLegacyFiles || {})));
    }
    encodeProgress(previous) {
      let progress = previous;
      for (const [key, saved] of this.#saved) {
        if (key !== this.#step.key) progress = api.encodeProgress({ snapshot: () => saved.program, getDrafts: () => saved.drafts }, progress);
      }
      return api.encodeProgress(this.#workspace, progress);
    }
    async loadStep(step, { progress, legacyFiles } = {}) {
      if (this.#disposed) throw api.runtimeError('CANCELLED', 'Tutorial disposed');
      if (step.smalltalk_target) api.validateOperation('browse', { kind: 'packages', target: step.smalltalk_target, offset: 0, limit: 1 });
      const starter = api.normalizeProgram({ stepKey: step.key, files: step.files || [], runFile: step.run_file, runCommand: step.run_command });
      this.stop(); await this.#recovery;
      if (this.#workspace) {
        this.#saved.set(this.#step.key, { ...this.#saved.get(this.#step.key), program: this.#workspace.snapshot(), drafts: this.#workspace.getDrafts() });
        if (this.#subscription) this.#subscription();
        this.#workspace.dispose();
      }
      const remembered = this.#saved.get(step.key);
      const restored = api.decodeProgress(remembered ? { version: 1, steps: { [step.key]: remembered } } : progress, starter, legacyFiles);
      this.#workspace = await api.Workspace.create({ runtime: this.#host, program: restored.program, drafts: restored.drafts });
      if (this.#disposed) { this.#workspace.dispose(); throw api.runtimeError('CANCELLED', 'Tutorial disposed'); }
      this.#step = copy(step); this.#epoch++;
      this.#saved.set(step.key, { program: restored.program, drafts: restored.drafts, migratedLegacyFiles: restored.migratedLegacyFiles });
      this.#subscription = this.#workspace.subscribe(event => {
        if (event.type === 'program') this.#epoch++;
        // The terminal also restarts this Workspace directly. Its successful
        // recovery repairs the same gate awaited by Run and step replacement.
        // Only repair a rejected attempt; a later pending attempt still owns
        // its outcome even if an earlier Workspace restart succeeds first.
        if (event.type === 'runtime' && event.detail.type === 'recovered' && this.#recoveryFailed) {
          this.#recovery = Promise.resolve(); this.#recoveryFailed = false;
        }
        this.#onEvent(event);
      });
      this.#onEvent({ type: 'progressWarning', detail: { warnings: restored.warnings } });
      return this.#workspace;
    }
    async #acceptDrafts(signal) {
      const drafts = this.#workspace.getDrafts();
      const revision = this.#workspace.snapshot().revision;
      if (drafts.some(draft => draft.baseRevision !== revision)) throw api.runtimeError('STALE_REVISION', 'Review drafts after accepted source changes');
      let expectedRevision = revision;
      let acceptedCount = 0;
      try {
        for (const draft of drafts) {
          if (signal.aborted) throw api.runtimeError('CANCELLED', 'Run cancelled');
          const target = draft.target;
          const action = { method: 'acceptMethod', class: 'acceptClass', comment: 'acceptComment', file: 'acceptFile' }[target.kind];
          if (!action) throw api.runtimeError('PRECONDITION_FAILED', 'This draft cannot be accepted');
          let params = { target, source: draft.source };
          if (target.kind === 'method') params.protocol = target.protocol || 'as yet unclassified';
          if (target.kind === 'file') {
            const file = this.#workspace.snapshot().files.find(file => file.path === target.path);
            if (!file) throw api.runtimeError('PRECONDITION_FAILED', 'Draft file is absent from the program');
            params = { target, file: { ...file, content: draft.source } };
          }
          const accepted = await this.#workspace.commit({ baseRevision: expectedRevision, action, params });
          expectedRevision = accepted.revision; acceptedCount++;
        }
        if (this.#workspace.snapshot().revision !== expectedRevision) throw api.runtimeError('STALE_REVISION', 'Accepted source changed during Accept and Run');
      } catch (error) {
        if (acceptedCount) throw api.runtimeError(error.code, acceptedCount + ' earlier draft(s) accepted; entry not run. ' + error.message);
        throw error;
      }
    }
    async run({ acceptDrafts = false, signal } = {}) {
      await this.#recovery;
      if (this.#disposed || !this.#workspace) throw api.runtimeError('CANCELLED', 'Tutorial unavailable');
      if (signal && signal.aborted) throw api.runtimeError('CANCELLED', 'Run cancelled');
      if (this.#controller) throw api.runtimeError('PRECONDITION_FAILED', 'Run is already active');
      const controller = new AbortController(); this.#controller = controller;
      const cancel = () => this.#cancelRun(controller);
      if (signal) signal.addEventListener('abort', cancel, { once: true });
      try {
        if (acceptDrafts) await this.#acceptDrafts(controller.signal);
        if (controller.signal.aborted) throw api.runtimeError('CANCELLED', 'Run cancelled');
        const program = this.getProgram();
        if (!program.runCommand) return { program, revision: program.revision, result: null, excludedDrafts: this.#workspace.getDrafts().length };
        const result = await this.#workspace.evaluate(program.runCommand, { signal: controller.signal, purpose: 'run' });
        if (result.error) throw api.runtimeError(result.error.code, result.error.message);
        return { program, revision: program.revision, result, excludedDrafts: this.#workspace.getDrafts().length };
      } finally {
        if (signal) signal.removeEventListener('abort', cancel);
        if (this.#controller === controller) this.#controller = null;
      }
    }
    async replaceFiles(files) {
      const replacements = new Map(files.map(file => [file.path, file]));
      const merged = this.#step.files.map(file => replacements.get(file.path) || file);
      for (const file of files) if (!merged.some(source => source.path === file.path)) merged.push(file);
      const program = api.normalizeProgram({ stepKey: this.#step.key, files: merged, runFile: this.#step.run_file, runCommand: this.#step.run_command });
      this.stop(); await this.#recovery;
      const accepted = await this.#workspace.replaceProgram(program);
      // Reset and Apply Solution discard this step's drafts only after native
      // replacement succeeds. Restart and failed replacement preserve them.
      for (const draft of this.#workspace.getDrafts()) this.#workspace.revertDraft(draft.target);
      return accepted;
    }
    async runTests(tests, options = {}) {
      const batch = await this.#fresh.runTests(tests, { program: options.program || this.getProgram(), signal: options.signal });
      return { ...batch, revision: batch.program.revision };
    }
    restart() {
      const running = !!this.#controller;
      this.stop();
      const previous = this.#recovery;
      const workspace = this.#workspace;
      // Stop already schedules recovery for an active Run. Otherwise explicit
      // Restart owns a new attempt, even when the preceding recovery failed.
      return this.#trackRecovery(running ? previous.catch(() => workspace.restart())
        : previous.catch(() => {}).then(() => workspace.restart()));
    }
    #trackRecovery(recovery) {
      this.#recovery = recovery; this.#recoveryFailed = false;
      recovery.catch(error => {
        if (!this.#disposed && this.#recovery === recovery) {
          this.#recoveryFailed = true;
          this.#onEvent({ type: 'recoveryFailed', detail: { code: error.code, message: error.message } });
        }
      });
      return recovery;
    }
    stop() {
      this.#fresh.stop();
      if (this.#controller) this.#cancelRun(this.#controller);
    }
    #cancelRun(controller) {
      if (this.#controller === controller) {
        controller.abort(); this.#controller = null;
        // Stop terminates the live worker. Reboot accepted code before reuse,
        // explicitly losing live objects/bindings rather than silently hanging.
        const workspace = this.#workspace;
        this.#trackRecovery(workspace.restart());
      }
    }
    dispose() {
      this.#disposed = true;
      if (this.#controller) this.#controller.abort();
      this.#fresh.dispose();
      if (this.#subscription) this.#subscription();
      if (this.#workspace) this.#workspace.dispose();
      this.#host.dispose();
    }
  }
  api.TutorialAdapter = TutorialAdapter;
})(window);
