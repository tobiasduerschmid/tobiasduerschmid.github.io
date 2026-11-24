/**
 * Tutorial adapter for the `c4` backend (spec §11). The C4 editor (ArchUMLC4Editor) is the visual surface of one
 * ordinary tutorial file; that file's Monaco model is the YAML surface, the only undo stack, and what autosave,
 * Reset, and Show Solution already handle. Grading reads a frozen copy of the model's text through ArchUMLC4.query.
 */
(function (root) {
  'use strict';

  const CONFIG_KEYS = ['file', 'view', 'profile', 'scaffolds', 'checks', 'locked_fields', 'reveal', 'read_only'];
  // The host option's camelCase keys (spec §3.4, §11): one shape for YAML and for the editor.
  const SCAFFOLD_KEYS = ['definitions', 'sentenceFrames', 'inlineLint', 'carryDown', 'trace', 'emptyStateGuide'];
  const CHECK_KEYS = ['display', 'disable', 'severity', 'thresholds', 'honorFileIgnores'];
  const DEFAULT_FILE = 'design.yml';
  // YAML typed on the YAML surface reaches the visual editor after this pause, as the editor's own YAML tab does.
  const YAML_SETTLE_MS = 250;
  const GATE_REASON = 'Submit for review first; Test My Work opens after that.';
  const SUBMIT_LABEL = 'Submit for review';
  const YAML_ERRORS = 'Fix the YAML errors first';
  // The one hint card shown while the design cannot be read; it replaces every hint of the unchecked tests (§11).
  const YAML_ERRORS_HINT = 'The design file has a YAML error, so none of the checks could run. The error message in the '
    + 'editor names the first line that cannot be read. Switch to **YAML**, repair that line, and choose **Test My Work** again.';
  const AUTHOR_ERROR = 'This check has an error in the tutorial, so it cannot pass yet. Please tell your instructor.';
  const CHECK_FAILED = 'This check could not run. Please tell your instructor; the details are in the browser console.';
  const STALE_RUN = 'The design changed while it was being checked. Results discarded; run Test My Work again.';
  // What a lock on the YAML surface did to the learner's change, in the words of the editor's lockedSentence.
  const LOCK_OUTCOME = 'your change was undone';
  // How many other undone changes a lock message names before it counts the rest.
  const NAMED_UNDONE_CHANGES = 3;
  /**
   * The core's messages a learner may read under a check: a view, scenario, or environment their model does not
   * name yet, or a saved view whose own selector names nothing. Every other core message is a diagnostic (it may
   * serialise the predicate or name the target), so the check shows only its authored description and its mark.
   */
  const LEARNER_FAILURES = [/^No (view|scenario|environment) named \S+ yet$/, /^The view \S+ cannot be drawn\. There is no \w+ named \S+$/];

  // ---- Configuration (spec §11) ------------------------------------------------------------------

  /** The step's `c4` over the tutorial's, key by key; `scaffolds` and `checks` merge by sub-key. */
  function effectiveConfig(tutorialConfig, stepConfig) {
    const base = tutorialConfig || {};
    const step = stepConfig || {};
    const merged = Object.assign({}, base, step);
    merged.scaffolds = Object.assign({}, base.scaffolds, step.scaffolds);
    merged.checks = Object.assign({}, base.checks, step.checks);
    merged.file = merged.file || DEFAULT_FILE;
    return merged;
  }

  /** Author errors in one `c4` block: every key outside the configuration, its scaffolds, or its checks. */
  function configErrors(config, where) {
    if (config === undefined || config === null) return [];
    if (typeof config !== 'object' || Array.isArray(config)) return [`${where}: c4 must be a map`];
    const unknown = (value, allowed, prefix) => (value && typeof value === 'object' ? Object.keys(value) : [])
      .filter((key) => !allowed.includes(key))
      .map((key) => `${where}: unknown key ${prefix}${key} (allowed: ${allowed.join(', ')})`);
    return unknown(config, CONFIG_KEYS, 'c4.')
      .concat(unknown(config.scaffolds, SCAFFOLD_KEYS, 'c4.scaffolds.'))
      .concat(unknown(config.checks, CHECK_KEYS, 'c4.checks.'));
  }

  // ---- Locked fields on the YAML surface (spec §11) ------------------------------------------------

  /**
   * The first path, as an array, at which `before` and `after` (plain YAML data) differ and which a lock reaches
   * (`touchesLocked(path)`: the editor's own rule), or null. Differences are collected at the shallowest node that
   * differs in kind, or at the scalar or the added or removed entry, so a lock inside a replaced node counts.
   */
  function changedLockedPath(before, after, touchesLocked) {
    const differences = [];
    collectDifferences(before, after, [], differences);
    return differences.find(touchesLocked) || null;
  }

  function collectDifferences(before, after, path, out) {
    const bothMaps = isNode(before) && isNode(after) && Array.isArray(before) === Array.isArray(after);
    if (!bothMaps) {
      if (JSON.stringify(before) !== JSON.stringify(after)) out.push(path);
      return;
    }
    new Set(Object.keys(before).concat(Object.keys(after)))
      .forEach((key) => collectDifferences(before[key], after[key], path.concat(key), out));
  }

  function isNode(value) {
    return value !== null && typeof value === 'object';
  }

  /**
   * `text` with every locked part it changes put back as `baseline` has it, and every other change kept, or null when
   * that cannot be done: a locked node was removed or replaced by one of another shape, or the result does not read
   * back. `load(text)` is the core's load; `locks` has `touches(path)` and `nodeOf(path)` (the editor's lock rules).
   * Each round splices the source of one locked node from `baseline` over the same node in the text, and parses again.
   */
  function restoreLockedParts(baseline, text, load, locks) {
    const before = load(baseline).parsed.document;
    const restored = new Set();
    let current = text;
    for (;;) {
      const design = load(current);
      if (!isReadable(design)) return null;
      const changed = changedLockedPath(before.toJS(), design.parsed.document.toJS(), locks.touches);
      if (changed === null) return current;
      const nodePath = locks.nodeOf(changed);
      const key = JSON.stringify(nodePath);
      if (restored.has(key)) return null;
      restored.add(key);
      const from = before.getIn(nodePath, true);
      const into = design.parsed.document.getIn(nodePath, true);
      if (!from || !into || !from.range || !into.range) return null;
      current = current.slice(0, into.range[0]) + baseline.slice(from.range[0], from.range[1]) + current.slice(into.range[1]);
    }
  }

  /** The dotted paths at which `after` differs from `before` without touching a lock: the learner's other edits. */
  function unlockedChanges(before, after, touchesLocked) {
    const differences = [];
    collectDifferences(before, after, [], differences);
    return differences.filter((path) => !touchesLocked(path)).map((path) => path.join('.'));
  }

  function isReadable(design) {
    return Boolean(design.parsed && design.parsed.document && design.parsed.errors.length === 0);
  }

  /** `text` with `{offset, length, text}` splices applied, the last first so earlier offsets stay valid. */
  function applySplices(text, edits) {
    return edits.slice().sort((a, b) => b.offset - a.offset)
      .reduce((result, edit) => result.slice(0, edit.offset) + edit.text + result.slice(edit.offset + edit.length), text);
  }

  /** The one splice that turns `before` into `after`: the span between their common start and common end. */
  function spliceBetween(before, after) {
    const shorter = Math.min(before.length, after.length);
    let start = 0;
    while (start < shorter && before[start] === after[start]) start += 1;
    let end = 0;
    while (end < shorter - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1;
    return { offset: start, length: before.length - start - end, text: after.slice(start, after.length - end) };
  }

  /** "a", "a and b", "a, b, and c", or the first NAMED_UNDONE_CHANGES and how many more. */
  function namedList(items) {
    const shown = items.slice(0, NAMED_UNDONE_CHANGES);
    const rest = items.length - shown.length;
    if (rest > 0) return `${shown.join(', ')}, and ${rest} more`;
    return shown.length < 3 ? shown.join(' and ') : `${shown.slice(0, -1).join(', ')}, and ${shown[shown.length - 1]}`;
  }

  // ---- Grading -------------------------------------------------------------------------------------

  /** The detail line a learner sees for one core result: a missing-selector message, or '' for every other one. */
  function learnerDetail(result) {
    const message = result.passed === false && typeof result.message === 'string' ? result.message : '';
    return LEARNER_FAILURES.some((pattern) => pattern.test(message)) ? message : '';
  }

  // ---- Installation --------------------------------------------------------------------------------

  /**
   * Adds the backend's methods to the tutorial runtime, once. Each installer below adds one concern: the workspace
   * (configuration, surfaces, status line), the editor binding, changes of the design file's model, the Submit for
   * review gate, and grading. They share the tutorial instance (`this`) and nothing else.
   */
  function install(TutorialCode) {
    const prototype = TutorialCode.prototype;
    if (prototype._initC4) return;
    installWorkspace(prototype);
    installEditorBinding(prototype);
    installModelChanges(prototype);
    installReviewGate(prototype);
    installGrading(prototype);
  }

  function core() {
    return root.ArchUMLC4;
  }

  function editorState() {
    return root.ArchUMLC4EditorParts.state;
  }

  // ---- The workspace: configuration, surfaces, and status line (spec §11) ------------------------------

  function installWorkspace(prototype) {
    prototype._c4StepConfig = function (index) {
      const step = this.steps[index == null ? this.currentStep : index] || {};
      return effectiveConfig(this.config.c4, step.c4);
    };

    /** Rejects unknown configuration keys in the tutorial and in every step before anything mounts. */
    prototype._initC4 = function () {
      if (this.setupCommands.length) throw new Error('C4 tutorials use a design file, not setup_commands.');
      const errors = configErrors(this.config.c4, 'Tutorial')
        .concat(...this.steps.map((step, index) => configErrors(step.c4, `Step ${index + 1}`)));
      if (errors.length) {
        const message = `This tutorial's C4 configuration has author errors. ${errors.join('; ')}.`;
        console.error(message);
        throw new Error(message);
      }
      if (!root.ArchUMLC4 || !root.ArchUMLC4Editor) throw new Error('The C4 editor scripts did not load.');
      this._buildC4Surface();
      this.booted = true;
      return Promise.resolve();
    };

    /** The surface switch ("Visual" / "YAML"), the lock message line, and the element the editor mounts in. */
    prototype._buildC4Surface = function () {
      const panel = this.root.querySelector('.tvm-editor-panel');
      const body = panel.querySelector('.tvm-editor-body');
      const doc = this.root.ownerDocument;
      const bar = doc.createElement('div');
      bar.className = 'c4-tutorial-bar';
      const group = doc.createElement('div');
      group.className = 'c4-tutorial-surfaces';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Editing surface');
      ['visual', 'yaml'].forEach((surface) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'c4-tutorial-surface';
        button.dataset.c4Surface = surface;
        button.textContent = surface === 'visual' ? 'Visual' : 'YAML';
        button.addEventListener('click', () => this._showC4Surface(surface));
        group.appendChild(button);
      });
      const status = doc.createElement('p');
      status.className = 'c4-tutorial-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      bar.append(group, status);
      const host = doc.createElement('div');
      host.className = 'c4-tutorial-editor';
      panel.insertBefore(bar, body);
      panel.insertBefore(host, body);
      this._c4Host = host;
      this._c4Status = status;
      this._showC4Surface('visual');
    };

    /** Shows one surface. A lock or review message belongs to the surface it was given on, so it goes first. */
    prototype._showC4Surface = function (surface) {
      this._setC4Status('');
      this._flushC4Yaml();
      this._c4Surface = surface;
      this.root.classList.toggle('c4-tutorial--yaml', surface === 'yaml');
      this.root.querySelectorAll('.c4-tutorial-surface').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.c4Surface === surface));
      });
      if (surface === 'yaml' && this.editor) this.editor.layout();
    };

    prototype._setC4Status = function (message) {
      if (this._c4Status) this._c4Status.textContent = message || '';
    };

    /** Every route to Test My Work (button, key, popout) passes `_runTests`, whose gate check explains a refusal. */
    prototype._c4RequestTests = function () {
      this._runTests();
    };
  }

  // ---- The editor binding: one editor per step visit, host undo on the Monaco model (spec §3.4, §11) ----

  function installEditorBinding(prototype) {
    /** Mounts the editor on the step's design file with the step's effective configuration. */
    prototype._loadC4Step = function (index) {
      this._teardownC4Editor();
      this._c4Submitted = false;
      this._c4LastRun = null;
      this._setC4Status('');
      const config = this._c4StepConfig(index);
      const entry = this.editorModels[config.file];
      if (!entry || !this._c4Host) return;
      const model = entry.model;
      const text = model.getValue();
      const session = { file: config.file, model, writing: false, timer: null, baseline: null, editor: null };
      session.baseline = this._c4Readable(text) ? text : null;
      this._c4Session = session;
      if (this.editor) this.editor.updateOptions({ readOnly: Boolean(config.read_only) });
      session.editor = root.ArchUMLC4Editor.mount(this._c4Host, {
        text,
        view: config.view,
        profile: config.profile,
        scaffolds: config.scaffolds,
        checks: config.checks,
        lockedFields: config.locked_fields || [],
        reveal: config.reveal,
        sourceEditor: false,
        readOnly: Boolean(config.read_only),
        // The workspace pane gives the editor its height; the drawing takes what the toolbar leaves of it.
        size: 'fill',
        outline: this._c4OutlineStart(),
        host: this._c4HostFor(session),
      });
      this._c4Editor = session.editor;
      this._showC4Surface('visual');
    };

    /**
     * The outline starts collapsed in a workspace column narrower than 60em, where it would take a column of the
     * drawing's row (or a row above it below 45em, js/ArchUML/css/c4-editor.css); its button opens it. Wider, it
     * starts open. The column is the editor panel's width, which the YAML surface does not hide.
     */
    prototype._c4OutlineStart = function () {
      const host = this._c4Host;
      const em = parseFloat(host.ownerDocument.defaultView.getComputedStyle(host).fontSize);
      return host.parentElement.clientWidth < 60 * em ? 'collapsed' : 'open';
    };

    prototype._teardownC4Editor = function () {
      const session = this._c4Session;
      if (!session) return;
      clearTimeout(session.timer);
      if (session.editor) session.editor.destroy();
      this._c4Session = null;
      this._c4Editor = null;
    };

    prototype._destroyC4 = function () {
      this._teardownC4Editor();
    };

    /**
     * The host side of the editor contract (spec §3.4): host undo on the Monaco model, no internal YAML tab. The
     * editor routes Ctrl/Cmd+Enter (Test My Work) and Ctrl/Cmd+S (save) here, and tells the tutorial when the learner
     * chose its own Submit for review, which opens Test My Work as the tutorial's button does.
     */
    prototype._c4HostFor = function (session) {
      return {
        onTextChange: (text, info) => this._writeC4Edits(session, text, info),
        confirm: (request) => (root.SebookConfirmation
          ? root.SebookConfirmation.confirm({ title: request.title, message: request.message, confirmLabel: request.confirmLabel })
          : Promise.resolve(false)),
        onRequestCheck: () => this._c4RequestTests(),
        onRequestSave: () => this._saveCurrentFile(),
        onSubmitForReview: () => this._markC4Submitted(),
        undo: 'host',
        performUndo: () => { session.model.undo(); this._flushC4Yaml(); },
        performRedo: () => { session.model.redo(); this._flushC4Yaml(); },
        canUndo: () => session.model.canUndo(),
        canRedo: () => session.model.canRedo(),
      };
    };

    /**
     * Applies the editor's splices to the model as one undo step. Splices that would not give the editor's text (a
     * defect, reported in the console) are replaced by the one splice that does: never `setValue`, which would clear
     * the learner's undo history.
     */
    prototype._writeC4Edits = function (session, text, info) {
      this._setC4Status('');
      let edits = info.edits || [];
      const current = session.model.getValue();
      if (applySplices(current, edits) !== text) {
        console.error(`C4 editor change ${info.version}: its splices do not give the editor's text; the model takes that text as one edit.`);
        edits = [spliceBetween(current, text)];
      }
      this._pushC4Edits(session, edits);
    };

    /** `{offset, length, text}` splices as one undo step of the model; the `writing` guard keeps them from echoing. */
    prototype._pushC4Edits = function (session, edits) {
      const model = session.model;
      const operations = edits.map((edit) => {
        const start = model.getPositionAt(edit.offset);
        const end = model.getPositionAt(edit.offset + edit.length);
        return {
          range: new root.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          text: edit.text,
          forceMoveMarkers: true,
        };
      });
      session.writing = true;
      try {
        model.pushStackElement();
        model.pushEditOperations([], operations, () => null);
        model.pushStackElement();
      } finally {
        session.writing = false;
      }
    };
  }

  // ---- Model changes: the YAML surface, its locks, and credit (spec §11) ------------------------------

  function installModelChanges(prototype) {
    /**
     * Every change of a tutorial file's model. The editor's own writes only invalidate credit; programmatic text
     * (restore, Reset, Show Solution) goes to the editor as external text; YAML the learner types reaches the
     * editor after a short pause, unless it changes a locked part, which is undone with a message.
     */
    prototype._c4EditorChanged = function (filename) {
      const session = this._c4Session;
      if (!session || filename !== session.file) {
        if (!this._suppressAutoSave) {
          this._invalidateC4();
          this._autoSaveProgress();
        }
        return;
      }
      const text = session.model.getValue();
      if (session.writing) {
        if (this._c4Readable(text)) session.baseline = text;
        this._invalidateC4();
        this._autoSaveProgress();
        return;
      }
      if (this._suppressAutoSave) {
        clearTimeout(session.timer);
        session.timer = null;
        session.baseline = this._c4Readable(text) ? text : null;
        session.editor.setText(text, { reason: 'external' });
        return;
      }
      this._invalidateC4();
      clearTimeout(session.timer);
      session.timer = setTimeout(() => this._settleC4Yaml(session), YAML_SETTLE_MS);
    };

    prototype._flushC4Yaml = function () {
      const session = this._c4Session;
      if (session && session.timer !== null) {
        clearTimeout(session.timer);
        this._settleC4Yaml(session);
      }
    };

    prototype._settleC4Yaml = function (session) {
      session.timer = null;
      if (this._c4Session !== session) return;
      const text = session.model.getValue();
      const locked = this._c4LockedChange(session, text);
      if (locked) {
        this._undoC4LockedChange(session, text, locked);
        return;
      }
      this._setC4Status('');
      if (this._c4Readable(text)) session.baseline = text;
      session.editor.setText(text, { reason: 'source' });
      this._autoSaveProgress();
    };

    /** The step's lock rules as the editor states them: which paths a lock reaches, and which node keeps it. */
    prototype._c4LockRules = function () {
      const locks = this._c4StepConfig().locked_fields || [];
      return {
        any: locks.length > 0,
        touches: (path) => editorState().touchesLockedPath(path, locks),
        nodeOf: (path) => editorState().lockedNodeOf(path, locks),
      };
    };

    /** The dotted path of a locked part the text changes, compared with the last readable text, or null. */
    prototype._c4LockedChange = function (session, text) {
      const rules = this._c4LockRules();
      if (!rules.any || session.baseline === null || !this._c4Readable(text)) return null;
      const path = changedLockedPath(this._c4Data(session.baseline), this._c4Data(text), rules.touches);
      return path === null ? null : path.join('.');
    };

    /**
     * Undoes a change to a locked part typed on the YAML surface (spec §11), as one undo step. The learner's other
     * edits stay when the locked parts can be put back alone; otherwise the text goes back to the last readable text,
     * and the message names the other edits that went with it.
     */
    prototype._undoC4LockedChange = function (session, text, lockedPath) {
      const rules = this._c4LockRules();
      const kept = restoreLockedParts(session.baseline, text, (source) => core().load(source), rules);
      const next = kept === null ? session.baseline : kept;
      let message = editorState().lockedSentence(lockedPath, LOCK_OUTCOME);
      if (kept === null) {
        const others = unlockedChanges(this._c4Data(session.baseline), this._c4Data(text), rules.touches);
        if (others.length > 0) message += ` That part could not be put back on its own, so your other changes made with it were undone too: ${namedList(others)}.`;
      }
      this._pushC4Edits(session, [spliceBetween(text, next)]);
      session.baseline = next;
      session.editor.setText(next, { reason: kept === null ? 'external' : 'source' });
      this._setC4Status(message);
    };

    prototype._c4Readable = function (text) {
      return isReadable(core().load(text));
    };

    prototype._c4Data = function (text) {
      return core().load(text).parsed.document.toJS();
    };

    prototype._invalidateC4 = function () {
      this._stepsPassed.delete(this.currentStep);
      this._testResults = [];
      this.stepContentEl.querySelector('.tvm-test-panel')?.replaceChildren();
      this._renderStepNav();
      this._refreshTestButton(this.currentStep);
      const next = this.stepControlsEl.querySelector('.tvm-btn-next');
      if (next) next.disabled = this._isNextStepLocked();
      if (this._popoutManager) {
        this._popoutManager.broadcastTestResult({ resultsHTML: '', results: [], allPassed: false, stepIndex: this.currentStep });
        this._broadcastNavState();
      }
    };
  }

  // ---- Display modes and Submit for review (spec §9.3, §11) ---------------------------------------------

  function installReviewGate(prototype) {
    prototype._c4TestsBlocked = function () {
      return this._c4StepConfig().checks.display === 'after-submit' && !this._c4Submitted;
    };

    /** The gate as the instructions popout shows it: the visible reason and the action that opens it, or null. */
    prototype._c4TestGate = function () {
      return this._c4TestsBlocked() ? { reason: GATE_REASON, actionLabel: SUBMIT_LABEL } : null;
    };

    /** Refuses a gated run with the visible reason, so no route to Test My Work fails silently (WCAG 4.1.3). */
    prototype._c4RefuseGatedRun = function () {
      if (!this._c4TestsBlocked()) return false;
      this._setC4Status(GATE_REASON);
      return true;
    };

    /**
     * The test controls under `after-submit`, or null for the shared ones: Submit for review beside Test My Work, which
     * waits for it with a visible reason. Once submitted, `testControls` (the shared Test My Work, or its cooldown and
     * I'm sure buttons, one HTML string each) follow, so the failed-run cooldown applies as on every other step.
     */
    prototype._c4TestControlsHTML = function (index, testControls) {
      if (this._c4StepConfig(index).checks.display !== 'after-submit') return null;
      const submit = '<button type="button" class="tvm-btn c4-submit-review">' + SUBMIT_LABEL + '</button>';
      const waiting = this._c4Submitted && index === this.currentStep ? testControls.join('')
        : '<button class="tvm-btn tvm-btn-test" disabled aria-describedby="c4-test-gate-reason">✓ Test My Work</button>'
          + '<span id="c4-test-gate-reason" class="c4-test-gate-reason">' + GATE_REASON + '</span>';
      return '<span class="tvm-test-btn-group c4-review-controls">' + submit + waiting + '</span>';
    };

    prototype._wireC4Review = function (container) {
      const submit = container.querySelector('.c4-submit-review');
      if (!submit) return;
      submit.addEventListener('click', () => this._submitC4ForReview());
    };

    /** `keepFocus` is set when the request came from the popout, whose window keeps the focus. */
    prototype._submitC4ForReview = function (options = {}) {
      if (!this._c4Editor) return;
      this._flushC4Yaml();
      this._c4Editor.submitForReview();
      this._markC4Submitted();
      if (!options.keepFocus) this.stepControlsEl.querySelector('.c4-submit-review')?.focus();
    };

    prototype._markC4Submitted = function () {
      if (this._c4Submitted) return;
      this._c4Submitted = true;
      this._setC4Status('Submitted for review: the editor now shows its diagnostics, and Test My Work is available.');
      this._refreshTestButton(this.currentStep);
      if (this._popoutManager) this._broadcastNavState();
    };
  }

  // ---- Grading (spec §8) ------------------------------------------------------------------------------

  function installGrading(prototype) {
    /** The frozen design, the step's authored starter, and its check configuration: what every check reads. */
    prototype._c4Snapshot = function (index) {
      const stepIndex = index == null ? this.currentStep : index;
      const config = this._c4StepConfig(stepIndex);
      const entry = this.editorModels[config.file];
      const starter = ((this.steps[stepIndex] || {}).files || []).find((file) => file.path === config.file);
      return {
        design: core().load(entry ? entry.model.getValue() : ''),
        seedModel: starter ? core().load(starter.content || '').model : null,
        checksConfig: config.checks,
      };
    };

    /**
     * Grades the step's `tests[].c4` on one frozen copy of the design file. Each check gets `true`, `false`, or
     * `null` (the YAML cannot be read) and a detail line; the shared renderer shows them unless the run went stale.
     */
    prototype._runTestsC4 = function (run) {
      const tests = this.steps[run.stepIndex].tests;
      const results = tests.map(() => null);
      run.c4Load = this._stepLoadSequence;
      run.c4Details = tests.map(() => '');
      // Hint conditions read the snapshot of this run; a run that cannot take one leaves none from an earlier run.
      this._c4LastRun = null;
      try {
        this._flushC4Yaml();
        const snapshot = this._c4Snapshot(run.stepIndex);
        run.c4Text = snapshot.design.text;
        this._c4LastRun = snapshot;
        if (snapshot.design.model === null) {
          run.c4Details.fill(YAML_ERRORS);
        } else {
          tests.forEach((check, index) => {
            const verdict = this._c4Grade(snapshot, check);
            results[index] = verdict.passed;
            run.c4Details[index] = verdict.message;
          });
        }
      } catch (error) {
        console.error(error);
        run.c4Details.fill(CHECK_FAILED);
      } finally {
        if (!this._destroyed) this._renderTestResults(tests, results, run);
      }
    };

    /**
     * One check of a run: `{passed, message}`, where `message` is the learner's detail line ('' for none). Its own
     * author error or defect fails it alone, with a plain line for the learner.
     */
    prototype._c4Grade = function (snapshot, check) {
      if (this._c4ReportsAuthorError(snapshot, check.c4, `the check "${check.description}"`)) return { passed: false, message: AUTHOR_ERROR };
      try {
        const result = this._c4Evaluate(snapshot, check.c4);
        return { passed: result.passed, message: learnerDetail(result) };
      } catch (error) {
        console.error(`C4 check "${check.description}" could not run:`, error);
        return { passed: false, message: CHECK_FAILED };
      }
    };

    /** Logs an invalid predicate (unknown keys, malformed selectors: the author's mistake) and says whether it was one. */
    prototype._c4ReportsAuthorError = function (snapshot, predicate, where) {
      const validation = core().query.validate(predicate, { checks: snapshot.checksConfig });
      if (validation.ok) return false;
      console.error(`C4 tutorial author error in ${where}:`, validation.errors.map((error) => error.message).join('; '));
      return true;
    };

    /** A predicate against a snapshot: missing views, scenarios, and elements fail with a learner-facing message. */
    prototype._c4Evaluate = function (snapshot, predicate) {
      return core().query.evaluate(snapshot.design, predicate, { seedModel: snapshot.seedModel, checksConfig: snapshot.checksConfig });
    };

    /**
     * Whether a finished run is stale and must not be shown: the step was loaded again, or the design text is no
     * longer the text it graded. A changed design gets a visible notice; a new step visit owns its panel already.
     */
    prototype._discardStaleC4Run = function (run) {
      if (this._stepLoadSequence !== run.c4Load) return true;
      const entry = this.editorModels[this._c4StepConfig(run.stepIndex).file];
      if (run.c4Text === undefined || !entry || entry.model.getValue() === run.c4Text) return false;
      if (!run.silent) {
        const html = '<p>' + STALE_RUN + '</p>';
        this._showTestPanel(html);
        this._ensureTestAnnouncer().textContent = STALE_RUN;
        if (this._popoutManager) {
          this._popoutManager.broadcastTestResult({ resultsHTML: html, results: [], allPassed: false, stepIndex: run.stepIndex });
          this._broadcastNavState();
        }
      }
      return true;
    };

    /** A hint condition `{c4: predicate}` against the last test run's snapshot; false whenever it cannot hold. */
    prototype._evaluateC4Hint = function (predicate) {
      const snapshot = this._c4LastRun;
      if (!snapshot || snapshot.design.model === null) return false;
      try {
        return !this._c4ReportsAuthorError(snapshot, predicate, 'a hint condition')
          && this._c4Evaluate(snapshot, predicate).passed === true;
      } catch (error) {
        console.error(error);
        return false;
      }
    };

    /** The hint card that replaces the hints of unchecked tests: the YAML card when the last run could not read the design. */
    prototype._hintForUncheckedTests = function () {
      const snapshot = this._c4LastRun;
      return snapshot && snapshot.design.model === null ? { title: YAML_ERRORS, body: YAML_ERRORS_HINT } : null;
    };
  }

  root.TutorialC4 = { install, effectiveConfig, configErrors, changedLockedPath };
  if (root.TutorialCode) install(root.TutorialCode);
})(window);
