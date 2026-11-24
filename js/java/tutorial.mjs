// Tutorial snapshots come from the open Monaco models, including unsaved edits.
// Only the active lesson's sources participate in compilation and grading.
import { JavaWorkspace } from './workspace.mjs';
import { attachJavaEditor } from './editor.mjs';

function sameFiles(left, right) {
  return left && right && Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(path => left[path] === right[path]);
}

function sourceMatches(test, source) {
  const patterns = value => value == null ? [] : [].concat(value);
  return patterns(test.source_must_contain).every(text => source.includes(text)) &&
    patterns(test.source_must_not_contain).every(text => !source.includes(text));
}

export class JavaTutorialSession {
  constructor(tutorial, workspace = new JavaWorkspace()) {
    this.tutorial = tutorial;
    this.workspace = workspace;
    this.revision = 0;
    this.editorServices = attachJavaEditor(monaco, {
      getModels: () => tutorial.editorModels,
      analyze: files => this.analyze(files),
      openFile: (path, selection) => {
        if (!tutorial.editorModels[path]) return false;
        tutorial._setActiveFile(path);
        tutorial._renderTabs();
        const editor = tutorial.editor2?.getModel() === tutorial.editorModels[path].model
          ? tutorial.editor2 : tutorial.editor;
        if (selection) {
          editor.setSelection(selection);
          editor.revealRangeInCenterIfOutsideViewport(selection);
        }
        editor.focus();
        return true;
      },
    });
  }

  files() {
    return Object.fromEntries(Object.entries(this.tutorial.editorModels)
      .filter(([path]) => path.endsWith('.java'))
      .map(([path, entry]) => [path, entry.model.getValue()]));
  }

  analyze(files) {
    if (sameFiles(this.analysis?.files, files)) return this.analysis.promise;
    const promise = this.workspace.analyze({ files });
    this.analysis = { files, promise };
    promise.catch(() => {
      if (this.analysis?.promise === promise) this.analysis = null;
    });
    return promise;
  }

  changed() {
    this.revision++;
    this.bindings = undefined;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 400);
  }

  async refresh() {
    const host = this.tutorial;
    if (host._destroyed || host._suppressAutoSave || this.busy || this.refreshing) return;
    const files = this.files();
    if (!Object.keys(files).length) return;
    const revision = this.revision;
    this.refreshing = true;
    try {
      const result = await this.analyze(files);
      if (revision !== this.revision || host._destroyed || !sameFiles(files, this.files())) return;
      this.applyDiagnostics(result.diagnostics);
      this.bindings = result.bindings;
      if (this.bindings?.length && host._umlDiagramEnabled && host._umlViewActive) {
        host._scheduleUMLRefresh(true);
      }
    } catch {
      // Offline editing and the local diagram remain usable. An explicit Run
      // or Test retries startup and reports the runtime error in its own panel.
    } finally {
      this.refreshing = false;
      if (revision !== this.revision && !host._destroyed) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.refresh(), 400);
      }
    }
  }

  applyDiagnostics(diagnostics = []) {
    for (const [path, { model }] of Object.entries(this.tutorial.editorModels)) {
      if (!path.endsWith('.java')) continue;
      monaco.editor.setModelMarkers(model, 'java-compiler', diagnostics.filter(d => d.file === path).map(d => ({
        startLineNumber: d.line, startColumn: d.column,
        endLineNumber: d.endLine, endColumn: d.endColumn,
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        source: 'Java', message: d.message,
      })));
    }
  }

  async execute(operation) {
    this.busy = true;
    this.stopped = false;
    let completed = false;
    try {
      const result = await operation();
      completed = true;
      return result;
    } finally {
      this.busy = false;
      if (completed && !this.stopped && !this.tutorial._destroyed) this.refresh();
    }
  }

  async run(run) {
    const host = this.tutorial;
    const files = this.files();
    const revision = this.revision;
    const load = host._stepLoadSequence;
    const args = host.root.querySelector('.tvm-args-input');
    const argv = args && run.kind !== 'test-file' && run.step?.has_args ? (args.value.match(/(?:[^\s"]+|"[^"]*")+/g) || [])
      .map(value => value.replace(/^"|"$/g, '')) : [];
    host._clearOutput();
    host._appendOutput('▶ ' + run.filename + '\n', 'info');
    return this.execute(async () => {
      const result = await this.workspace.run({ files, entry: run.filename, args: argv, assertions: run.kind === 'test-file' });
      if (host._destroyed || host._stepLoadSequence !== load || host.currentStep !== run.stepIndex) return false;
      if (revision === this.revision) this.applyDiagnostics(result.diagnostics);
      if (result.stdout) host._appendOutput(result.stdout, 'stdout');
      if (result.stderr) host._appendOutput(result.stderr, 'stderr');
      host._appendOutput(result.exitCode === 0 ? '\n✓ Done\n' : '\n✗ Exited with error\n', 'info');
      return result.exitCode === 0;
    });
  }

  async grade(run) {
    const host = this.tutorial;
    const tests = host.steps[run.stepIndex].tests;
    const files = this.files();
    const source = Object.values(files).join('\n');
    const revision = this.revision;
    run.javaLoad = host._stepLoadSequence;
    const results = [];
    run.javaDetails = tests.map(() => '');
    host._showTestPanel('<p>Compiling and running Java checks…</p>');
    clearTimeout(host._testAnnouncementTimer);
    if (!run.silent) host._ensureTestAnnouncer().textContent = 'Running Java checks…';
    host._setRunTransactionControls('running', 'Testing…');
    try {
      await this.execute(async () => {
        for (const [i, test] of tests.entries()) {
          if (run.javaStopped || revision !== this.revision || host._destroyed) break;
          const matches = sourceMatches(test, source);
          if (!matches || !test.command) { results.push(matches); continue; }
          const result = await this.workspace.test({ files, code: test.command });
          results.push(result.exitCode === 0);
          if (revision === this.revision) {
            this.applyDiagnostics(result.diagnostics);
            const problem = result.diagnostics?.find(d => d.severity === 'error' && Object.hasOwn(files, d.file));
            if (problem) run.javaDetails[i] = problem.file + ':' + problem.line + ' — ' + problem.message;
          }
        }
      });
    } catch (error) {
      if (!run.javaStopped) run.javaFailure = error.message || 'Java runtime unavailable.';
    } finally {
      if (revision !== this.revision) run.javaFailure = 'Source changed during checks. Run Test My Work again.';
      if (run.javaStopped) run.javaFailure = 'Checks stopped.';
      host._renderTestResults(tests, results, run);
      if (!host._destroyed && !host._activeRunTransaction) host._setRunTransactionControls('idle');
    }
  }

  stop() {
    this.stopped = true;
    if (this.tutorial._activeTestRun) this.tutorial._activeTestRun.javaStopped = true;
    this.workspace.cancel();
    this.analysis = null;
  }

  destroy() {
    clearTimeout(this.timer);
    this.editorServices.dispose();
    this.workspace.destroy();
  }
}
