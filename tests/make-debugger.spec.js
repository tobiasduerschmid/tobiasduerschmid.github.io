// @ts-check
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');

const repoRoot = path.resolve(__dirname, '..');

function loadMakeDebuggerSandbox() {
  const sandbox = {
    console,
    window: {},
    Object,
    String,
    Number,
    Array,
    Promise,
    Error,
  };
  const source = fs.readFileSync(path.join(repoRoot, 'js/debugger/make-channel.js'), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: 'js/debugger/make-channel.js' });
  return sandbox;
}

function loadMakeDebuggerHelpers() {
  const sandbox = loadMakeDebuggerSandbox();
  return sandbox.window.SEBookMakeChannelTest;
}

test.describe('Make debugger trace mapping', () => {
  test('maps dry-run commands to Makefile recipe lines through variables and pattern rules', () => {
    const make = loadMakeDebuggerHelpers();
    const source = [
      'CC = gcc',
      'APP = app',
      'OBJS = main.o math.o',
      '',
      '$(APP): $(OBJS)',
      '\t$(CC) $(OBJS) -o $@',
      '',
      '%.o: %.c',
      '\t$(CC) -c $< -o $@',
    ].join('\n');
    const output = [
      'GNU Make 4.3',
      'Updating goal targets....',
      " File 'main.o' does not exist.",
      " Must remake target 'main.o'.",
      'gcc -c main.c -o main.o',
      " Successfully remade target file 'main.o'.",
      "Must remake target 'app'.",
      'gcc main.o math.o -o app',
      "Successfully remade target file 'app'.",
    ].join('\n');

    const trace = make.buildPlan({
      makefilePath: '/tutorial/project/Makefile',
      source,
      output,
    });

    expect(trace.items.map((item) => ({
      target: item.target,
      ruleLine: item.ruleLine,
      line: item.line,
      command: item.command,
    }))).toEqual([
      {
        target: 'main.o',
        ruleLine: 8,
        line: 9,
        command: 'gcc -c main.c -o main.o',
      },
      {
        target: 'app',
        ruleLine: 5,
        line: 6,
        command: 'gcc main.o math.o -o app',
      },
    ]);
  });

  test('honors breakpoints placed on either a rule line or its recipe line', () => {
    const make = loadMakeDebuggerHelpers();
    const source = [
      'APP = app',
      '',
      '$(APP): main.o',
      '\tgcc main.o -o $@',
    ].join('\n');
    const output = [
      "Must remake target 'app'.",
      'gcc main.o -o app',
    ].join('\n');
    const trace = make.buildPlan({
      makefilePath: '/tutorial/project/Makefile',
      source,
      output,
    });
    const item = trace.items[0];

    expect(make.breakpointLineForItem(item, [
      { file: '/tutorial/project/Makefile', line: 3 },
    ], '/tutorial/project/Makefile')).toBe(3);
    expect(make.breakpointLineForItem(item, [
      { file: '/tutorial/project/Makefile', line: 4 },
    ], '/tutorial/project/Makefile')).toBe(4);
  });

  test('exposes automatic variables and parsed Make variables in pause snapshots', () => {
    const sandbox = loadMakeDebuggerSandbox();
    const Channel = sandbox.window.SEBookMakeChannel;
    const channel = new Channel({}, {});
    channel.makefilePath = '/tutorial/project/Makefile';
    channel.cwd = '/tutorial/project';
    channel.goal = 'default';
    channel.makeVariables = {
      CC: 'gcc',
      OBJS: 'main.o math.o',
    };

    const snap = channel._snapshotForItem({
      index: 0,
      target: 'app',
      command: 'gcc main.o math.o -o app',
      ruleLine: 5,
      ruleTargets: ['app'],
      prereqs: ['main.o', 'math.o', 'main.o'],
    }, 6);
    const frame = snap.stack[0];

    expect(frame.locals['$@'].repr).toBe('app');
    expect(frame.locals['$<'].repr).toBe('main.o');
    expect(frame.locals['$^'].repr).toBe('main.o math.o');
    expect(frame.globals.CC.repr).toBe('gcc');
    expect(frame.globals.OBJS.repr).toBe('main.o math.o');
  });

  test('renders the shared debugger UI without time-travel controls in forward-only mode', async ({ page }) => {
    await page.setContent('<main><div id="toolbar"></div><div id="debug"></div></main>');
    await page.addScriptTag({ path: path.join(repoRoot, 'js/debugger/ui-render.js') });

    const visibility = await page.evaluate(() => {
      const state = {
        tutorialId: 'makefile',
        capabilities: {
          forwardOnly: true,
          reverse: false,
          history: false,
          watches: false,
          watchpoints: false,
          exceptions: false,
          breakpointConditions: false,
          variableEditing: false,
        },
        session: { active: true, stepButtonsDisabled: false, status: 'paused' },
        breakpoints: { '/tutorial/project/Makefile': { 3: {} } },
        watchpoints: [{ id: 'wp1', expr: 'x' }],
        exceptionBreakpoints: [{ id: 'ex1', enabled: true }],
        history: [],
        historyIdx: -1,
      };
      const dispatch = () => {};
      const helpers = {
        getSectionCollapsed: () => false,
        setSectionCollapsed: () => {},
        getSubsectionCollapsed: () => false,
        setSubsectionCollapsed: () => {},
      };
      window.SEBookDebuggerUI.renderToolbar(
        document.getElementById('toolbar'),
        state,
        dispatch,
        helpers
      );
      window.SEBookDebuggerUI.renderDebugView(
        document.getElementById('debug'),
        state,
        dispatch,
        helpers
      );
      return {
        backButton: !!document.querySelector('[data-cmd="back"], [data-cmd="backContinue"], [data-cmd="backOut"]'),
        watchSection: !!document.querySelector('[data-section="watch"]'),
        historySection: !!document.querySelector('[data-section="history"]'),
        watchpointGroup: !!document.querySelector('[data-manager-group="manager-data-watchpoints"]'),
        exceptionGroup: !!document.querySelector('[data-manager-group="manager-exception-breakpoints"]'),
        editBreakpointButton: !!document.querySelector('[data-bp-edit]'),
        stopButton: !!document.querySelector('[data-cmd="stop"]'),
        codeBreakpoint: document.querySelector('.tvm-debug-manager-title')?.textContent || '',
      };
    });

    expect(visibility).toEqual({
      backButton: false,
      watchSection: false,
      historySection: false,
      watchpointGroup: false,
      exceptionGroup: false,
      editBreakpointButton: false,
      stopButton: true,
      codeBreakpoint: 'Makefile:3',
    });
  });

  test('adds start controls inside the Debug tab when the output action bar is absent', async ({ page }) => {
    await page.setContent([
      '<main>',
      '  <div id="tutorial-root">',
      '    <section class="tvm-instructions-panel">',
      '      <div class="tvm-steps-view"></div>',
      '    </section>',
      '  </div>',
      '</main>',
    ].join(''));
    await page.evaluate(() => {
      Object.defineProperty(window, 'crossOriginIsolated', { value: true, configurable: true });
      Object.defineProperty(window, 'SharedArrayBuffer', { value: ArrayBuffer, configurable: true });
      window.monaco = {
        languages: { registerHoverProvider: () => {} },
      };
    });
    await page.addScriptTag({ path: path.join(repoRoot, 'js/debugger/make-channel.js') });
    await page.addScriptTag({ path: path.join(repoRoot, 'js/debugger/main.js') });

    const controls = await page.evaluate(() => {
      const tutorial = {
        root: document.getElementById('tutorial-root'),
        tutorialId: 'makefile',
        config: { backend: 'v86' },
        steps: [],
        currentStep: 0,
        editorModels: {},
        activeFileName: null,
      };
      window.SEBookDebugger.attach(tutorial);
      const debugButton = document.querySelector('.tvm-debug-panel-controls .tvm-debug-btn');
      const toolbar = document.querySelector('.tvm-debug-panel-controls .tvm-debug-toolbar');
      return {
        debugButtonText: debugButton?.textContent?.replace(/\s+/g, ' ').trim() || '',
        debugButtonAria: debugButton?.getAttribute('aria-label') || '',
        toolbarInitiallyHidden: toolbar?.style.display === 'none',
        outputActionsPresent: !!document.querySelector('.tvm-output-actions'),
      };
    });

    expect(controls).toEqual({
      debugButtonText: 'Start Debugging',
      debugButtonAria: 'Start debugger',
      toolbarInitiallyHidden: true,
      outputActionsPresent: false,
    });
  });

  test('shows current Make variable values on editor hover', async ({ page }) => {
    await page.setContent('<main></main>');
    await page.evaluate(() => {
      window.hoverProviders = {};
      window.monaco = {
        Range: class {
          constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
            this.startLineNumber = startLineNumber;
            this.startColumn = startColumn;
            this.endLineNumber = endLineNumber;
            this.endColumn = endColumn;
          }
        },
        languages: {
          registerHoverProvider: (language, provider) => {
            window.hoverProviders[language] = provider;
          },
        },
      };
    });
    await page.addScriptTag({ path: path.join(repoRoot, 'js/debugger/editor-attach.js') });

    const hovers = await page.evaluate(() => {
      const scalar = (type, repr) => ({ kind: 'scalar', type, repr });
      const sync = {
        state: {
          historyIdx: 0,
          selectedFrameIdx: -1,
          history: [{
            stack: [{
              call_id: 'make:app',
              locals: {
                '$@': scalar('automatic', 'app'),
                '$<': scalar('automatic', 'main.o'),
              },
              globals: {
                CC: scalar('make', 'gcc'),
              },
            }],
          }],
        },
      };
      window.SEBookDebuggerEditor.registerHoverProvider(window.monaco, sync, { languages: ['makefile'] });
      const model = {
        getLineContent: () => '$(CC) -c $< -o $@',
        getWordAtPosition: () => null,
      };
      const provider = window.hoverProviders.makefile;
      return {
        cc: provider.provideHover(model, { lineNumber: 1, column: 3 }).contents[0].value,
        firstPrereq: provider.provideHover(model, { lineNumber: 1, column: 11 }).contents[0].value,
        target: provider.provideHover(model, { lineNumber: 1, column: 17 }).contents[0].value,
      };
    });

    expect(hovers.cc).toContain('gcc');
    expect(hovers.firstPrereq).toContain('main.o');
    expect(hovers.target).toContain('app');
  });
});
