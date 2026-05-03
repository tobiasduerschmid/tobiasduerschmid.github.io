// @ts-check
const { test, expect } = require('@playwright/test');

const TUTORIAL_URL = '/SEBook/tools/python-tutorial?instructor-mode=true&autosave=false';
const BOOT_TIMEOUT = 60_000;
const DEBUG_TIMEOUT = 60_000;

const LISTCOMP_CODE = `from functions import mean

def above_average(numbers):
    """Return a list of numbers strictly greater than the mean."""
    avg = mean(numbers)
    # Use a list comprehension with a condition
    pass

def squares_up_to(n):
    """Return [1**2, 2**2, ..., n**2] using range() and **."""
    pass

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
#data = [3]

print(f"Above average: {above_average(data)}")
print(f"Data:          {data}")
print(f"Above average: {above_average(data)}")
print(f"Squares to 5:  {squares_up_to(5)}")
`;

const CALLGRAPH_CODE = `def inner(x):
    y = x + 1
    z = y * 2
    return z

def outer(n):
    a = inner(n)
    return a + 3

print(outer(4))
`;

const WATCHPOINT_CODE = `total = 0
for i in range(5):
    total += i
    marker = total
print(total)
`;

const LIVE_UPDATE_CODE = `total = 0
for i in range(8):
    total += i
    marker = total
print(total)
`;

const WATCHPOINT_VALUE_CHANGE_CODE = `flag = False
for flag in [False, True, True, False]:
    marker = flag
print(flag)
`;

const WATCHPOINT_NUMBER_CHANGE_CODE = `value = 1
for value in [1, 2, 3]:
    marker = value
print(value)
`;

const WATCHPOINT_READ_ONLY_CODE = `def inspect(argv):
    first = argv[0]
    size = len(argv)
    return size

args = ["prog", "Ada"]
count = inspect(args)
print(count)
`;

const WATCHPOINT_RECORD_ASSIGN_CODE = `def make_record(name, raw_scores):
    return {"name": name, "raw_scores": raw_scores, "grade": None}

def register_student(name, raw_scores):
    record = make_record(name, raw_scores)
    return record

register_student("Ada", [95, 88, 92])
`;

const LIVE_EDIT_CODE = `def compute():
    total = 1
    marker = total
    print(marker)

compute()
`;

const LIVE_MODULE_EDIT_CODE = `total = 1
marker = total
print(marker)
`;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-output-panel', { timeout: BOOT_TIMEOUT });
  await page.waitForFunction(() => window._tutorial && window._tutorial._debuggerCtl && window._tutorial.editor,
    { timeout: BOOT_TIMEOUT });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function loadDebuggerFile(page, filename, code) {
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await page.evaluate(async ({ filename, code }) => {
    const tutorial = window._tutorial;
    tutorial.loadStep(5);
    await new Promise(resolve => setTimeout(resolve, 500));
    tutorial.openFile(filename, code, 'python');
    tutorial._setActiveFile(filename);

    const ctl = tutorial._debuggerCtl;
    ctl.breakpoints = new Map();
    ctl.persistBreakpoints();
    ctl.refreshBpDecorations();
  }, { filename, code });
}

async function breakpointHitboxPoint(page, line, xOffset = 0) {
  return page.evaluate(({ line, xOffset }) => {
    const editor = window._tutorial.editor;
    const dom = editor.getDomNode();
    const root = dom.closest('.tvm-container, .ttp-wrap, .tpp-wrap') || dom;
    const rootStyle = getComputedStyle(root);
    const offset = parseFloat(rootStyle.getPropertyValue('--tvm-debug-breakpoint-offset')) || 22;
    const dotSize = 16;
    const marginEl = dom.querySelector('.glyph-margin') || dom.querySelector('.margin-view-overlays .cgmr');
    const gutterLeft = marginEl
      ? marginEl.getBoundingClientRect().left
      : dom.getBoundingClientRect().left + (editor.getLayoutInfo().glyphMarginLeft || 0);
    const pos = editor.getScrolledVisiblePosition({ lineNumber: line, column: 1 });
    const editorRect = dom.getBoundingClientRect();
    return {
      x: gutterLeft + offset + (dotSize / 2) + xOffset,
      y: editorRect.top + pos.top + Math.max(12, pos.height / 2),
    };
  }, { line, xOffset });
}

async function codeBreakpointLines(page, filename) {
  return page.evaluate((filename) => {
    const ctl = window._tutorial._debuggerCtl;
    const path = ctl.normalizeBreakpointPath(filename);
    return Array.from(ctl.breakpoints.get(path)?.keys() || []).sort((a, b) => a - b);
  }, filename);
}

async function breakpointPreviewState(page) {
  return page.evaluate(() => {
    const editor = window._tutorial.editor;
    const decorations = editor.getModel().getAllDecorations()
      .filter(d => String(d.options?.glyphMarginClassName || '').includes('tvm-bp-preview-glyph'));
    const previewEl = editor.getDomNode().querySelector('.tvm-bp-preview-glyph');
    const style = previewEl ? getComputedStyle(previewEl) : null;
    return {
      lines: decorations.map(d => d.range.startLineNumber).sort((a, b) => a - b),
      background: style && style.backgroundColor,
      borderColor: style && style.borderColor,
      opacity: style && style.opacity,
      width: style && style.width,
      height: style && style.height,
    };
  });
}

async function prepareDebuggerAtBreakpoint(page, breakpointLine) {
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await page.evaluate(async ({ code, line }) => {
    const tutorial = window._tutorial;
    tutorial.loadStep(5);
    await new Promise(resolve => setTimeout(resolve, 500));
    tutorial.openFile('functions.py', 'def mean(numbers):\n    return sum(numbers) / len(numbers)\n', 'python');
    tutorial.openFile('listcomp.py', code, 'python');
    tutorial._setActiveFile('listcomp.py');

    const ctl = tutorial._debuggerCtl;
    ctl.breakpoints = new Map();
    ctl.persistBreakpoints();
    ctl.refreshBpDecorations();
    ctl.toggleBreakpoint('listcomp.py', line);
    ctl.startSession();
  }, { code: LISTCOMP_CODE, line: breakpointLine });

  await page.waitForFunction(() => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    return ctl && ctl.paused && ctl.historyIdx >= 0;
  }, null, { timeout: DEBUG_TIMEOUT });

  await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
  await page.waitForFunction((line) => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
    return ctl && ctl.paused && snap && snap.line === line && /listcomp\.py$/.test(snap.file);
  }, breakpointLine, { timeout: DEBUG_TIMEOUT });
}

async function prepareSingleFileDebuggerAtBreakpoint(page, filename, code, breakpointLine) {
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await page.evaluate(async ({ filename, code, line }) => {
    const tutorial = window._tutorial;
    tutorial.loadStep(5);
    await new Promise(resolve => setTimeout(resolve, 500));
    tutorial.openFile(filename, code, 'python');
    tutorial._setActiveFile(filename);

    const ctl = tutorial._debuggerCtl;
    ctl.breakpoints = new Map();
    ctl.persistBreakpoints();
    ctl.refreshBpDecorations();
    ctl.toggleBreakpoint(filename, line);
    ctl.startSession();
  }, { filename, code, line: breakpointLine });

  await page.waitForFunction(() => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    return ctl && ctl.paused && ctl.historyIdx >= 0;
  }, null, { timeout: DEBUG_TIMEOUT });

  await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
  await page.waitForFunction((line) => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
    const top = snap && snap.stack && snap.stack[snap.stack.length - 1];
    return ctl && ctl.paused && snap && snap.line === line && top && top.function === 'inner';
  }, breakpointLine, { timeout: DEBUG_TIMEOUT });
}

async function editDataAndWaitForReplay(page, breakpointLine) {
  await page.evaluate(() => {
    const ctl = window._tutorial._debuggerCtl;
    const snap = ctl.history[ctl.historyIdx];
    ctl.applyVarEdit('locals', snap.stack.length - 1, 'data', '[4, 42]');
  });

  await page.waitForFunction((line) => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
    if (!ctl || !ctl.paused || !snap || snap.line !== line || ctl.session?.replayTargetIdx != null) {
      return false;
    }
    const topIdx = snap.stack.length - 1;
    const value = ctl.resolveVar(snap, topIdx, 'locals', 'data');
    return value && (value.repr === '[4, 42]' || value.preview === '[4, 42]');
  }, breakpointLine, { timeout: DEBUG_TIMEOUT });
}

async function debuggerState(page) {
  return page.evaluate(() => {
    const ctl = window._tutorial._debuggerCtl;
    const snap = ctl.history[ctl.historyIdx];
    const topIdx = snap.stack.length - 1;
    const top = snap.stack[topIdx];
    const data = ctl.resolveVar(snap, topIdx, 'locals', 'data');
    const model = window._tutorial.editor.getModel();
    const decorations = model.getAllDecorations();
    const currentDecorations = decorations
      .filter(d => {
        const cls = String(d.options?.className || '');
        const glyph = String(d.options?.glyphMarginClassName || '');
        return cls.includes('tvm-debug-current-line') || glyph.includes('tvm-debug-current-glyph');
      });
    const currentDecorationLines = decorations
      .filter(d => String(d.options?.className || '').includes('tvm-debug-current-line'))
      .map(d => d.range.startLineNumber);
    const currentGlyphClasses = currentDecorations
      .map(d => String(d.options?.glyphMarginClassName || ''))
      .filter(Boolean);
    const breakpointGlyphLines = decorations
      .filter(d => String(d.options?.glyphMarginClassName || '').includes('tvm-bp-glyph'))
      .map(d => d.range.startLineNumber);
    const sync = ctl.sync && ctl.sync.state;
    const syncSnap = sync && sync.history && sync.history[sync.historyIdx];
    return {
      controller: {
        historyIdx: ctl.historyIdx,
        liveIdx: ctl.liveIdx,
        historyLength: ctl.history.length,
        line: snap.line,
        file: snap.file,
        functionName: top.function,
        data: data && (data.repr || data.preview),
      },
      sync: sync && {
        historyIdx: sync.historyIdx,
        liveIdx: sync.liveIdx,
        historyLength: sync.history.length,
        line: syncSnap && syncSnap.line,
        file: syncSnap && syncSnap.file,
      },
      currentDecorationLines,
      currentGlyphClasses,
      breakpointGlyphLines,
      output: document.querySelector('.tvm-output-pre')?.textContent || '',
    };
  });
}

async function waitForDebugComplete(page) {
  await page.waitForFunction(() => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    return ctl && !ctl.session &&
      ctl.historyIdx === -1 &&
      ctl.liveIdx === -1 &&
      ctl.history && ctl.history.length === 0 &&
      ctl.statusEl && ctl.statusEl.textContent === '';
  }, null, { timeout: DEBUG_TIMEOUT });
}

async function startDebuggerWithBreakpoints(page, filename, code, breakpointLines) {
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await page.evaluate(async ({ filename, code, lines }) => {
    const tutorial = window._tutorial;
    tutorial.loadStep(5);
    await new Promise(resolve => setTimeout(resolve, 500));
    tutorial.openFile(filename, code, 'python');
    tutorial._setActiveFile(filename);

    const ctl = tutorial._debuggerCtl;
    ctl.breakpoints = new Map();
    ctl.watchpoints = [];
    ctl._nextWatchpointId = 1;
    ctl._pendingWatches = [];
    ctl.persistBreakpoints();
    ctl.refreshBpDecorations();
    for (const line of lines) ctl.toggleBreakpoint(filename, line);
    ctl.startSession();
  }, { filename, code, lines: breakpointLines });

  await page.waitForFunction(() => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    return ctl && ctl.paused && ctl.historyIdx >= 0;
  }, null, { timeout: DEBUG_TIMEOUT });
}

async function continueToLine(page, line, filenamePattern) {
  await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
  await page.waitForFunction(({ line, filenamePattern }) => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
    return ctl && ctl.paused && snap && snap.line === line &&
      new RegExp(filenamePattern).test(snap.file);
  }, { line, filenamePattern }, { timeout: DEBUG_TIMEOUT });
}

async function waitForLine(page, line, filenamePattern, minLocationHit = 1) {
  await page.waitForFunction(({ line, filenamePattern, minLocationHit }) => {
    const ctl = window._tutorial && window._tutorial._debuggerCtl;
    const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
    return ctl && ctl.paused && snap && snap.line === line &&
      (snap.location_hit || 1) >= minLocationHit &&
      new RegExp(filenamePattern).test(snap.file);
  }, { line, filenamePattern, minLocationHit }, { timeout: DEBUG_TIMEOUT });
}

async function setBreakpointCondition(page, filename, line, condition, op = 'edit') {
  await page.evaluate(({ filename, line, condition, op }) => {
    const ctl = window._tutorial._debuggerCtl;
    const path = '/tutorial/' + filename;
    let bps = ctl.breakpoints.get(path);
    if (!bps) {
      bps = new Map();
      ctl.breakpoints.set(path, bps);
    }
    bps.set(line, { condition });
    ctl.persistBreakpoints();
    ctl.refreshBpDecorations();
    ctl.renderBreakpointManager();
    ctl._publishBreakpoints();
    ctl.updateSessionWatches(false);
    if (ctl.session) {
      ctl.queueBreakpointChange({ op, file: path, line, condition });
      ctl.refreshBreakpointsNow();
    }
  }, { filename, line, condition, op });
}

async function breakpointVisualTokens(page, darkMode) {
  return page.evaluate((dark) => {
    document.documentElement.classList.toggle('dark-mode', dark);

    const standalone = document.createElement('div');
    standalone.className = 'tvm-bp-glyph';
    standalone.style.position = 'absolute';
    standalone.style.left = '-9999px';
    standalone.style.top = '-9999px';
    document.body.appendChild(standalone);

    const conditional = document.createElement('div');
    conditional.className = 'tvm-bp-glyph tvm-bp-cond';
    conditional.style.position = 'absolute';
    conditional.style.left = '-9999px';
    conditional.style.top = '-9999px';
    document.body.appendChild(conditional);

    const preview = document.createElement('div');
    preview.className = 'tvm-bp-glyph tvm-bp-preview-glyph';
    preview.style.position = 'absolute';
    preview.style.left = '-9999px';
    preview.style.top = '-9999px';
    document.body.appendChild(preview);

    const chevron = document.createElement('div');
    chevron.className = 'tvm-debug-current-glyph-on-bp';
    chevron.style.position = 'absolute';
    chevron.style.left = '-9999px';
    chevron.style.top = '-9999px';
    document.body.appendChild(chevron);

    const standaloneStyle = getComputedStyle(standalone);
    const conditionalStyle = getComputedStyle(conditional);
    const conditionalQuestionStyle = getComputedStyle(conditional, '::after');
    const previewStyle = getComputedStyle(preview);
    const chevronStyle = getComputedStyle(chevron);
    const result = {
      standaloneBackground: standaloneStyle.backgroundColor,
      standaloneBorderColor: standaloneStyle.borderColor,
      standaloneShadow: standaloneStyle.boxShadow,
      standaloneWidth: standaloneStyle.width,
      standaloneHeight: standaloneStyle.height,
      conditionalWidth: conditionalStyle.width,
      conditionalHeight: conditionalStyle.height,
      conditionalQuestionDisplay: conditionalQuestionStyle.display,
      conditionalQuestionAlignItems: conditionalQuestionStyle.alignItems,
      conditionalQuestionJustifyContent: conditionalQuestionStyle.justifyContent,
      previewBackground: previewStyle.backgroundColor,
      previewBorderColor: previewStyle.borderColor,
      previewShadow: previewStyle.boxShadow,
      previewOpacity: previewStyle.opacity,
      chevronBreakpointImage: chevronStyle.backgroundImage,
      chevronFilter: chevronStyle.filter,
    };

    standalone.remove();
    conditional.remove();
    preview.remove();
    chevron.remove();
    return result;
  }, darkMode);
}

test.describe.serial('Python debugger replay variable edits', () => {
  test.setTimeout(240_000);

  const variants = [
    {
      name: 'breakpoint on first function-call print',
      breakpointLine: 17,
      nextLine: 18,
      expectedOutput: /Above average:\s+None/,
    },
    {
      name: 'breakpoint on plain data print',
      breakpointLine: 18,
      nextLine: 19,
      expectedOutput: /Data:\s+\[4, 42\]/,
    },
    {
      name: 'breakpoint on second function-call print',
      breakpointLine: 19,
      nextLine: 20,
      expectedOutput: /Above average:\s+None/,
    },
  ];

  for (const variant of variants) {
    test(`${variant.name}: edit replay keeps cursor anchored`, async ({ browser }) => {
      const page = await browser.newPage();
      try {
        await prepareDebuggerAtBreakpoint(page, variant.breakpointLine);
        await editDataAndWaitForReplay(page, variant.breakpointLine);

        const afterEdit = await debuggerState(page);
        expect(afterEdit.controller.line).toBe(variant.breakpointLine);
        expect(afterEdit.controller.file).toMatch(/listcomp\.py$/);
        expect(afterEdit.controller.data).toBe('[4, 42]');
        expect(afterEdit.sync.line).toBe(variant.breakpointLine);
        expect(afterEdit.sync.file).toMatch(/listcomp\.py$/);
        expect(afterEdit.sync.historyLength).toBe(afterEdit.controller.historyLength);
        expect(afterEdit.currentDecorationLines).toEqual([variant.breakpointLine]);
        expect(afterEdit.currentGlyphClasses).toEqual(['tvm-debug-current-glyph-on-bp']);
        expect(afterEdit.breakpointGlyphLines).toEqual([]);

        await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('next'));
        await page.waitForFunction((line) => {
          const ctl = window._tutorial && window._tutorial._debuggerCtl;
          const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
          return ctl && ctl.paused && snap && snap.line === line && /listcomp\.py$/.test(snap.file);
        }, variant.nextLine, { timeout: DEBUG_TIMEOUT });

        const afterNext = await debuggerState(page);
        expect(afterNext.controller.line).toBe(variant.nextLine);
        expect(afterNext.controller.functionName).toBe('<module>');
        expect(afterNext.currentDecorationLines).toEqual([variant.nextLine]);
        expect(afterNext.currentGlyphClasses).toEqual(['tvm-debug-current-glyph']);
        expect(afterNext.breakpointGlyphLines).toEqual([variant.breakpointLine]);
        expect(afterNext.output).toMatch(variant.expectedOutput);
      } finally {
        await page.close();
      }
    });
  }

  test('breakpoint visual tokens stay stable across light and dark mode', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);

      const light = await breakpointVisualTokens(page, false);
      const dark = await breakpointVisualTokens(page, true);

      expect(light.standaloneBackground).toBe('rgb(230, 57, 70)');
      expect(light.standaloneBorderColor).toBe('rgb(63, 63, 70)');
      expect(light.standaloneShadow).toContain('rgba(0, 0, 0, 0.62)');
      expect(light.standaloneWidth).toBe('16px');
      expect(light.standaloneHeight).toBe('16px');
      expect(light.conditionalWidth).toBe('16px');
      expect(light.conditionalHeight).toBe('16px');
      expect(light.conditionalQuestionDisplay).toBe('flex');
      expect(light.conditionalQuestionAlignItems).toBe('center');
      expect(light.conditionalQuestionJustifyContent).toBe('center');
      expect(light.previewBackground).toBe('rgba(230, 57, 70, 0.5)');
      expect(light.previewBorderColor).toBe('rgb(63, 63, 70)');
      expect(light.previewShadow).toContain('rgba(0, 0, 0, 0.42)');
      expect(light.previewOpacity).toBe('1');
      expect(light.chevronFilter).toContain('drop-shadow');
      expect(light.chevronBreakpointImage).toContain('%233f3f46');
      expect(light.chevronBreakpointImage).not.toContain('%23000000');
      expect(light.chevronBreakpointImage).not.toContain('stroke=\"%23000');
      expect(dark).toEqual(light);
    } finally {
      await page.close();
    }
  });

  test('breakpoint hitbox is centered on the visible gutter dot', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await loadDebuggerFile(page, 'hitbox.py', 'total = 0\nfor i in range(3):\n    total += i\nprint(total)\n');

      const center = await breakpointHitboxPoint(page, 3);
      await page.mouse.click(center.x, center.y);
      expect(await codeBreakpointLines(page, 'hitbox.py')).toEqual([3]);

      const rightEdge = await breakpointHitboxPoint(page, 3, 13);
      await page.mouse.click(rightEdge.x, rightEdge.y);
      expect(await codeBreakpointLines(page, 'hitbox.py')).toEqual([]);

      const leftEdge = await breakpointHitboxPoint(page, 3, -13);
      await page.mouse.click(leftEdge.x, leftEdge.y);
      expect(await codeBreakpointLines(page, 'hitbox.py')).toEqual([3]);
    } finally {
      await page.close();
    }
  });

  test('breakpoint hover preview advertises empty gutter hitbox', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await loadDebuggerFile(page, 'hover-preview.py', 'total = 0\nfor i in range(3):\n    total += i\nprint(total)\n');

      const center = await breakpointHitboxPoint(page, 3);
      await page.mouse.move(center.x, center.y);
      await page.waitForFunction(() => {
        const editor = window._tutorial.editor;
        return editor.getModel().getAllDecorations()
          .some(d => d.range.startLineNumber === 3 && String(d.options?.glyphMarginClassName || '').includes('tvm-bp-preview-glyph'));
      }, null, { timeout: DEBUG_TIMEOUT });

      const preview = await breakpointPreviewState(page);
      expect(preview.lines).toEqual([3]);
      expect(preview.background).toBe('rgba(230, 57, 70, 0.5)');
      expect(preview.borderColor).toBe('rgb(63, 63, 70)');
      expect(preview.opacity).toBe('1');
      expect(preview.width).toBe('16px');
      expect(preview.height).toBe('16px');

      await page.mouse.click(center.x, center.y);
      expect(await codeBreakpointLines(page, 'hover-preview.py')).toEqual([3]);
      await page.waitForFunction(() => {
        const editor = window._tutorial.editor;
        return !editor.getModel().getAllDecorations()
          .some(d => String(d.options?.glyphMarginClassName || '').includes('tvm-bp-preview-glyph'));
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.mouse.move(center.x + 40, center.y);
      expect((await breakpointPreviewState(page)).lines).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test('debug toolbar moves to a reachable wrapping row when actions are narrow', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);

      const layout = await page.evaluate(async () => {
        const ctl = window._tutorial._debuggerCtl;
        const actions = window._tutorial.root.querySelector('.tvm-output-actions');
        const header = actions && actions.closest('.tvm-output-header');
        if (!ctl || !actions || !header) return null;
        header.style.width = '220px';
        header.style.boxSizing = 'border-box';
        actions.style.width = '100%';
        actions.style.maxWidth = '100%';
        ctl.stepToolbar.style.display = 'flex';
        ctl.statusEl.textContent = 'PAUSED AT LINE 5';
        ctl.updateResponsiveStepToolbar(actions);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const toolbarRect = ctl.stepToolbar.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const buttonRects = Array.from(ctl.stepToolbar.querySelectorAll('.tvm-debug-step'))
          .map(btn => btn.getBoundingClientRect());
        return {
          newRow: ctl.stepToolbar.classList.contains('tvm-debug-toolbar-new-row'),
          toolbarParentIsHeader: ctl.stepToolbar.parentElement === header,
          wraps: toolbarRect.height > 34,
          toolbarFits: toolbarRect.left >= headerRect.left - 1 && toolbarRect.right <= headerRect.right + 1,
          buttonsFit: buttonRects.every(rect =>
            rect.left >= toolbarRect.left - 1 && rect.right <= toolbarRect.right + 1),
        };
      });

      expect(layout).toMatchObject({
        newRow: true,
        toolbarParentIsHeader: true,
        wraps: true,
        toolbarFits: true,
        buttonsFit: true,
      });
    } finally {
      await page.close();
    }
  });

  test('debug toolbar keeps step buttons anchored when status text changes', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);

      const positions = await page.evaluate(async () => {
        const ctl = window._tutorial._debuggerCtl;
        const actions = window._tutorial.root.querySelector('.tvm-output-actions');
        const header = actions && actions.closest('.tvm-output-header');
        if (!ctl || !actions || !header) return null;
        header.style.width = '920px';
        header.style.boxSizing = 'border-box';
        actions.style.width = '100%';
        actions.style.maxWidth = '100%';
        ctl.stepToolbar.style.display = 'flex';
        ctl.updateResponsiveStepToolbar(actions);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const continueBtn = ctl.stepToolbar.querySelector('[data-cmd="continue"]');
        const stopBtn = ctl.stepToolbar.querySelector('[data-cmd="stop"]');
        ctl.statusEl.textContent = 'PAUSED AT LINE 1';
        ctl.statusEl.title = ctl.statusEl.textContent;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const shortContinue = continueBtn.getBoundingClientRect();
        const shortStop = stopBtn.getBoundingClientRect();

        ctl.statusEl.textContent = 'PAUSED AT BREAKPOINT IN A VERY LONG FUNCTION NAME';
        ctl.statusEl.title = ctl.statusEl.textContent;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const longContinue = continueBtn.getBoundingClientRect();
        const longStop = stopBtn.getBoundingClientRect();

        return {
          continueLeftDelta: Math.abs(shortContinue.left - longContinue.left),
          continueRightDelta: Math.abs(shortContinue.right - longContinue.right),
          stopLeftDelta: Math.abs(shortStop.left - longStop.left),
          stopRightDelta: Math.abs(shortStop.right - longStop.right),
          statusOverflowHidden: getComputedStyle(ctl.statusEl).overflow,
          statusTextOverflow: getComputedStyle(ctl.statusEl).textOverflow,
        };
      });

      expect(positions).toMatchObject({
        continueLeftDelta: 0,
        continueRightDelta: 0,
        stopLeftDelta: 0,
        stopRightDelta: 0,
        statusOverflowHidden: 'hidden',
        statusTextOverflow: 'ellipsis',
      });
    } finally {
      await page.close();
    }
  });

  test('normal continue uses runtime breakpoints unless data watchpoints need scanning', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const path = '/tutorial/runtime-continue.py';
        const snap = {
          file: path,
          line: 3,
          event: 'line',
          call_id: 1,
          watches: {},
          stack: [{ file: path, line: 3, function: '<module>', first_line: 1, call_id: 1 }],
        };
        ctl.breakpoints = new Map([[path, new Map([[3, { condition: null }]])]]);
        ctl.history = [snap];
        ctl.historyIdx = 0;
        ctl.liveIdx = 0;
        ctl.paused = true;
        ctl.selectedFrameIdx = -1;
        ctl.watchpoints = [];
        ctl.session = { watches: [], runtimeSyncInFlight: false, runtimeUpdatePending: false };

        const commands = [];
        const originalSendCommand = ctl.sendCommand;
        ctl.sendCommand = (cmd) => { commands.push(cmd); };
        ctl.handleToolbarCmd('continue');
        const codeBreakpointOnly = {
          commands: commands.slice(),
          watchpointRun: !!ctl.session.watchpointRun,
          status: ctl.statusEl && ctl.statusEl.textContent,
        };

        commands.length = 0;
        ctl.watchpoints = [{ id: 'wp-1', expr: 'value', enabled: true }];
        ctl.paused = true;
        ctl.session.watchpointRun = null;
        ctl.handleToolbarCmd('continue');
        const withDataWatchpoint = {
          commands: commands.slice(),
          watchpointRun: !!ctl.session.watchpointRun,
          includeLineBreakpoints: !!(ctl.session.watchpointRun && ctl.session.watchpointRun.includeLineBreakpoints),
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
        ctl.sendCommand = originalSendCommand;
        return { codeBreakpointOnly, withDataWatchpoint };
      });

      expect(state.codeBreakpointOnly).toMatchObject({
        commands: [1],
        watchpointRun: false,
        status: 'continue…',
      });
      expect(state.withDataWatchpoint).toMatchObject({
        commands: [2],
        watchpointRun: true,
        includeLineBreakpoints: true,
        status: 'running to data change…',
      });
    } finally {
      await page.close();
    }
  });

  test('conditional breakpoint editor uses the debugger dialog and saves changes', async ({ browser }) => {
    const page = await browser.newPage();
    let nativePromptSeen = false;
    page.on('dialog', async dialog => {
      nativePromptSeen = true;
      await dialog.dismiss();
    });
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await page.evaluate(async (code) => {
        const tutorial = window._tutorial;
        tutorial.loadStep(5);
        await new Promise(resolve => setTimeout(resolve, 500));
        tutorial.openFile('listcomp.py', code, 'python');
        tutorial._setActiveFile('listcomp.py');

        const ctl = tutorial._debuggerCtl;
        ctl.breakpoints = new Map();
        ctl.persistBreakpoints();
        ctl.refreshBpDecorations();
        ctl.editBreakpointCondition('listcomp.py', 18);
      }, LISTCOMP_CODE);

      const dialog = page.locator('.tvm-bp-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.tvm-bp-dialog-title')).toHaveText('Breakpoint Condition');
      await expect(dialog.locator('.tvm-bp-dialog-location')).toHaveText('listcomp.py:18');
      await expect(dialog.locator('.tvm-bp-dialog-clear')).toBeDisabled();
      await dialog.locator('.tvm-bp-dialog-input').fill('data and len(data) > 2');
      await dialog.locator('.tvm-bp-dialog-save').click();
      await expect(dialog).toBeHidden();

      const saved = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const bp = ctl.breakpoints.get('/tutorial/listcomp.py').get(18);
        const model = window._tutorial.editor.getModel();
        const glyph = model.getAllDecorations()
          .filter(d => d.range.startLineNumber === 18)
          .map(d => String(d.options?.glyphMarginClassName || ''))
          .find(cls => cls.includes('tvm-bp-glyph')) || '';
        return { condition: bp && bp.condition, glyph };
      });
      expect(saved.condition).toBe('data and len(data) > 2');
      expect(saved.glyph).toContain('tvm-bp-cond');

      await page.evaluate(() => window._tutorial._debuggerCtl.editBreakpointCondition('listcomp.py', 18));
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.tvm-bp-dialog-input')).toHaveValue('data and len(data) > 2');
      await expect(dialog.locator('.tvm-bp-dialog-clear')).toBeEnabled();
      await dialog.locator('.tvm-bp-dialog-clear').click();
      await expect(dialog).toBeHidden();

      const cleared = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const bp = ctl.breakpoints.get('/tutorial/listcomp.py').get(18);
        const model = window._tutorial.editor.getModel();
        const glyph = model.getAllDecorations()
          .filter(d => d.range.startLineNumber === 18)
          .map(d => String(d.options?.glyphMarginClassName || ''))
          .find(cls => cls.includes('tvm-bp-glyph')) || '';
        return { condition: bp && bp.condition, glyph };
      });
      expect(cleared.condition).toBeNull();
      expect(cleared.glyph).toBe('tvm-bp-glyph');
      expect(nativePromptSeen).toBe(false);
    } finally {
      await page.close();
    }
  });

  test('finished runs clear live history and current chevron before starting again', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await prepareDebuggerAtBreakpoint(page, 17);
      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await waitForDebugComplete(page);

      const finished = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const model = window._tutorial.editor.getModel();
        const decorations = model.getAllDecorations();
        return {
          controllerHistoryLength: ctl.history.length,
          syncHistoryLength: ctl.sync.state.history.length,
          historyIdx: ctl.historyIdx,
          liveIdx: ctl.liveIdx,
          syncHistoryIdx: ctl.sync.state.historyIdx,
          syncLiveIdx: ctl.sync.state.liveIdx,
          currentGlyphClasses: decorations
            .map(d => String(d.options?.glyphMarginClassName || ''))
            .filter(cls => cls.includes('tvm-debug-current-glyph')),
          currentDecorationLines: decorations
            .filter(d => String(d.options?.className || '').includes('tvm-debug-current-line'))
            .map(d => d.range.startLineNumber),
        };
      });
      expect(finished.controllerHistoryLength).toBe(0);
      expect(finished.syncHistoryLength).toBe(0);
      expect(finished.historyIdx).toBe(-1);
      expect(finished.liveIdx).toBe(-1);
      expect(finished.syncHistoryIdx).toBe(-1);
      expect(finished.syncLiveIdx).toBe(-1);
      expect(finished.currentGlyphClasses).toEqual([]);
      expect(finished.currentDecorationLines).toEqual([]);

      await page.evaluate(() => window._tutorial._debuggerCtl.startSession());
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.session && ctl.paused && snap && snap.line === 1;
      }, null, { timeout: DEBUG_TIMEOUT });

      const firstPause = await debuggerState(page);
      expect(firstPause.controller.historyLength).toBe(1);
      expect(firstPause.sync.historyLength).toBe(1);
      expect(firstPause.sync.line).toBe(1);
      expect(firstPause.currentDecorationLines).toEqual([1]);
      expect(firstPause.currentGlyphClasses).toEqual(['tvm-debug-current-glyph']);
      expect(firstPause.breakpointGlyphLines).toEqual([17]);

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.line === 17 && /listcomp\.py$/.test(snap.file);
      }, null, { timeout: DEBUG_TIMEOUT });

      const secondBreakpoint = await debuggerState(page);
      expect(secondBreakpoint.controller.line).toBe(17);
      expect(secondBreakpoint.sync.line).toBe(17);
      expect(secondBreakpoint.sync.historyLength).toBe(secondBreakpoint.controller.historyLength);
      expect(secondBreakpoint.currentDecorationLines).toEqual([17]);
      expect(secondBreakpoint.currentGlyphClasses).toEqual(['tvm-debug-current-glyph-on-bp']);
      expect(secondBreakpoint.breakpointGlyphLines).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test('step back onto a breakpoint uses the smaller breakpoint inside the rewound chevron', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await prepareDebuggerAtBreakpoint(page, 17);

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('next'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.line === 18 && /listcomp\.py$/.test(snap.file);
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('back'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && snap && snap.line === 17 && ctl.historyIdx < ctl.liveIdx;
      }, null, { timeout: DEBUG_TIMEOUT });

      const rewoundBreakpoint = await debuggerState(page);
      expect(rewoundBreakpoint.controller.line).toBe(17);
      expect(rewoundBreakpoint.currentDecorationLines).toEqual([17]);
      expect(rewoundBreakpoint.currentGlyphClasses).toEqual(['tvm-debug-current-glyph-rewound-on-bp']);
      expect(rewoundBreakpoint.breakpointGlyphLines).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test('data watchpoints stop on value changes and can run backward to the hit', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await page.evaluate(async ({ code }) => {
        const tutorial = window._tutorial;
        tutorial.loadStep(5);
        await new Promise(resolve => setTimeout(resolve, 500));
        tutorial.openFile('watchpoints.py', code, 'python');
        tutorial._setActiveFile('watchpoints.py');

        const ctl = tutorial._debuggerCtl;
        ctl.breakpoints = new Map();
        ctl.watchpoints = [];
        ctl._nextWatchpointId = 1;
        ctl._pendingWatches = [];
        localStorage.removeItem('tutorial-debug-subsection-' + tutorial.tutorialId + '-manager-code-breakpoints');
        localStorage.removeItem('tutorial-debug-subsection-' + tutorial.tutorialId + '-manager-data-watchpoints');
        ctl.persistBreakpoints();
        ctl.refreshBpDecorations();
        ctl.toggleBreakpoint('watchpoints.py', 5);
        ctl.addWatchpoint('total >= 3');
        ctl.activateTab('dbg-combined');
        ctl.renderAll();
        ctl.startSession();
      }, { code: WATCHPOINT_CODE });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx >= 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const value = snap && snap.watches && snap.watches['total >= 3'];
        return ctl && ctl.paused && snap && snap.watchpoint_origin && snap.watchpoint_origin.line === 3 &&
          value && value.repr === 'True' &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, null, { timeout: DEBUG_TIMEOUT });

      const hit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        const manager = window._tutorial.root.querySelector('.tvm-dbg-section-body[data-section="breakpoints"]');
        const model = window._tutorial.editor.getModel();
        const currentGlyphClasses = model.getAllDecorations()
          .map(d => String(d.options?.glyphMarginClassName || ''))
          .filter(cls => cls.includes('tvm-debug-current-glyph'));
        const currentDecorationLines = model.getAllDecorations()
          .filter(d => String(d.options?.className || '').includes('tvm-debug-current-line'))
          .map(d => d.range.startLineNumber);
        return {
          hitIdx: ctl.historyIdx,
          line: snap.watchpoint_origin && snap.watchpoint_origin.line,
          rawLine: snap.line,
          status: ctl.statusEl.textContent,
          currentDecorationLines,
          currentGlyphClasses,
          normalWatches: ctl.getNormalWatches(),
          transportWatches: ctl.session.watches,
          syncWatchpoints: ctl.sync.state.watchpoints,
          codeRows: manager.querySelectorAll('.tvm-debug-manager-code-row').length,
          watchpointRows: manager.querySelectorAll('.tvm-debug-manager-watchpoint-row').length,
          managerSvgIcons: manager.querySelectorAll('.tvm-debug-manager-svg').length,
          toolbarDataButtons: window._tutorial._debuggerCtl.stepToolbar.querySelectorAll('[data-cmd="watchContinue"], [data-cmd="backWatch"]').length,
          managerText: manager.textContent,
        };
      });
      expect(hit.line).toBe(3);
      expect(hit.rawLine).toBe(4);
      expect(hit.status).toContain('data watchpoint changed');
      expect(hit.status).toContain('watchpoints.py:3');
      expect(hit.currentDecorationLines).toEqual([3]);
      expect(hit.currentGlyphClasses).toEqual(['tvm-debug-current-glyph-after']);
      expect(hit.normalWatches).toEqual([]);
      expect(hit.transportWatches).toContain('total >= 3');
      expect(hit.syncWatchpoints).toEqual([{ id: 'wp1', expr: 'total >= 3', enabled: true }]);
      expect(hit.codeRows).toBe(1);
      expect(hit.watchpointRows).toBe(1);
      expect(hit.managerSvgIcons).toBeGreaterThanOrEqual(7);
      expect(hit.toolbarDataButtons).toBe(0);
      expect(hit.managerText).toContain('watchpoints.py:5');
      expect(hit.managerText).toContain('total >= 3');

      await page.locator('[data-manager-group-toggle="manager-code-breakpoints"]').click();
      await expect(page.locator('[data-manager-group="manager-code-breakpoints"]')).toHaveClass(/collapsed/);
      await page.locator('[data-manager-group-toggle="manager-data-watchpoints"]').click();
      await expect(page.locator('[data-manager-group="manager-data-watchpoints"]')).toHaveClass(/collapsed/);
      await page.locator('[data-manager-group-toggle="manager-data-watchpoints"]').click();
      await expect(page.locator('[data-manager-group="manager-data-watchpoints"]')).not.toHaveClass(/collapsed/);

      await page.locator('.tvm-debug-watchpoint-input').fill('marker == 3');
      await page.locator('.tvm-debug-watchpoint-add-btn').click();
      await expect.poll(async () => page.evaluate(() => window._tutorial._debuggerCtl.sync.state.watchpoints.length))
        .toBe(2);

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('step'));
      await page.waitForFunction((hitIdx) => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx > hitIdx;
      }, hit.hitIdx, { timeout: DEBUG_TIMEOUT });

      await page.locator('[data-wp-back="wp1"]').click();
      await page.waitForFunction((hitIdx) => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && snap && ctl.historyIdx === hitIdx && snap.watchpoint_origin && snap.watchpoint_origin.line === 3 &&
          /rewound to data change/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, hit.hitIdx, { timeout: DEBUG_TIMEOUT });
    } finally {
      await page.close();
    }
  });

  test('data watchpoints use GDB-style value-change semantics', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'watch-change.py', WATCHPOINT_VALUE_CHANGE_CODE, [2]);
      await continueToLine(page, 2, 'watch-change\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('watch-change.py', 2);
        ctl.addWatchpoint('flag');
        ctl.handleToolbarCmd('watchContinue');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const value = snap && snap.watches && snap.watches.flag;
        return ctl && ctl.paused && snap && value && value.repr === 'True' &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, null, { timeout: DEBUG_TIMEOUT });

      const firstHit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          idx: ctl.historyIdx,
          line: snap.line,
          value: snap.watches.flag && snap.watches.flag.repr,
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
      });
      expect(firstHit.value).toBe('True');
      expect(firstHit.status).toContain('data watchpoint changed');

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('watchContinue'));
      await page.waitForFunction((firstIdx) => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const value = snap && snap.watches && snap.watches.flag;
        return ctl && ctl.paused && ctl.historyIdx > firstIdx && snap &&
          value && value.repr === 'False' &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, firstHit.idx, { timeout: DEBUG_TIMEOUT });

      const secondHit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          idx: ctl.historyIdx,
          line: snap.line,
          value: snap.watches.flag && snap.watches.flag.repr,
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
      });
      expect(secondHit.idx).toBeGreaterThan(firstHit.idx);
      expect(secondHit.value).toBe('False');
      expect(secondHit.status).toContain('data watchpoint changed');
    } finally {
      await page.close();
    }
  });

  test('numeric data watchpoints stop on truthy value changes', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'watch-number-change.py', WATCHPOINT_NUMBER_CHANGE_CODE, [2]);
      await continueToLine(page, 2, 'watch-number-change\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('watch-number-change.py', 2);
        ctl.addWatchpoint('value');
        ctl.handleToolbarCmd('watchContinue');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const value = snap && snap.watches && snap.watches.value;
        return ctl && ctl.paused && snap && value && value.repr === '2' &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, null, { timeout: DEBUG_TIMEOUT });

      const firstHit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          idx: ctl.historyIdx,
          value: snap.watches.value && snap.watches.value.repr,
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
      });
      expect(firstHit.value).toBe('2');
      expect(firstHit.status).toContain('data watchpoint changed');

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('watchContinue'));
      await page.waitForFunction((firstIdx) => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const value = snap && snap.watches && snap.watches.value;
        return ctl && ctl.paused && ctl.historyIdx > firstIdx && snap &&
          value && value.repr === '3' &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, firstHit.idx, { timeout: DEBUG_TIMEOUT });
    } finally {
      await page.close();
    }
  });

  test('data watchpoints ignore first read-only observations', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'watch-read.py', WATCHPOINT_READ_ONLY_CODE, [7]);
      await continueToLine(page, 7, 'watch-read\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('watch-read.py', 7);
        ctl.addWatchpoint('argv');
        ctl.handleToolbarCmd('watchContinue');
      });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        if (!ctl) return false;
        const snap = ctl.history && ctl.history[ctl.historyIdx];
        return !ctl.session || (ctl.paused && snap && snap.watchpoint_origin);
      }, null, { timeout: DEBUG_TIMEOUT });

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history && ctl.history[ctl.historyIdx];
        return {
          active: !!ctl.session,
          paused: !!ctl.paused,
          origin: snap && snap.watchpoint_origin,
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
      });
      expect(state.active).toBe(false);
      expect(state.origin).toBeFalsy();
    } finally {
      await page.close();
    }
  });

  test('data watchpoints on first assignments highlight the caller assignment', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'watch-record.py', WATCHPOINT_RECORD_ASSIGN_CODE, [5]);
      await continueToLine(page, 5, 'watch-record\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('watch-record.py', 5);
        ctl.addWatchpoint('record');
        ctl.handleToolbarCmd('watchContinue');
      });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.watchpoint_origin &&
          snap.watchpoint_origin.line === 5 &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, null, { timeout: DEBUG_TIMEOUT });

      const hit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        const model = window._tutorial.editor.getModel();
        const currentDecorationLines = model.getAllDecorations()
          .filter(d => String(d.options?.className || '').includes('tvm-debug-current-line'))
          .map(d => d.range.startLineNumber);
        return {
          line: snap.watchpoint_origin && snap.watchpoint_origin.line,
          rawLine: snap.line,
          value: snap.watches.record && (snap.watches.record.preview || snap.watches.record.repr),
          status: ctl.statusEl && ctl.statusEl.textContent,
          currentDecorationLines,
        };
      });
      expect(hit.line).toBe(5);
      expect(hit.rawLine).toBe(6);
      expect(hit.value).toContain("'Ada'");
      expect(hit.status).toContain('watch-record.py:5');
      expect(hit.currentDecorationLines).toEqual([5]);
    } finally {
      await page.close();
    }
  });

  test('breakpoints added while paused are synchronized before continue resumes', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await page.evaluate(async ({ code }) => {
        const tutorial = window._tutorial;
        tutorial.loadStep(5);
        await new Promise(resolve => setTimeout(resolve, 500));
        tutorial.openFile('live-sync.py', code, 'python');
        tutorial._setActiveFile('live-sync.py');

        const ctl = tutorial._debuggerCtl;
        ctl.breakpoints = new Map();
        ctl.watchpoints = [];
        ctl._pendingWatches = [];
        ctl.persistBreakpoints();
        ctl.refreshBpDecorations();
        ctl.toggleBreakpoint('live-sync.py', 3);
        ctl.startSession();
      }, { code: LIVE_UPDATE_CODE });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx >= 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.line === 3 && /live-sync\.py$/.test(snap.file);
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.toggleBreakpoint('live-sync.py', 4);
        ctl.handleToolbarCmd('continue');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.line === 4 && /live-sync\.py$/.test(snap.file);
      }, null, { timeout: DEBUG_TIMEOUT });

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          line: snap.line,
          status: ctl.statusEl && ctl.statusEl.textContent,
          breakpoints: Array.from(ctl.breakpoints.get('/tutorial/live-sync.py').keys()),
        };
      });
      expect(state.line).toBe(4);
      expect(state.breakpoints.sort()).toEqual([3, 4]);
    } finally {
      await page.close();
    }
  });

  test('breakpoints removed while paused are honored by the current continue', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'live-remove.py', LIVE_UPDATE_CODE, [3, 4]);
      await continueToLine(page, 3, 'live-remove\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('live-remove.py', 4);
        ctl.handleToolbarCmd('continue');
      });
      await waitForLine(page, 3, 'live-remove\\.py$', 2);

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          line: snap.line,
          locationHit: snap.location_hit,
          status: ctl.statusEl && ctl.statusEl.textContent,
          breakpoints: Array.from(ctl.breakpoints.get('/tutorial/live-remove.py').keys()),
        };
      });
      expect(state.line).toBe(3);
      expect(state.locationHit).toBe(2);
      expect(state.status).toContain('live-remove.py:3');
      expect(state.breakpoints).toEqual([3]);
    } finally {
      await page.close();
    }
  });

  test('removing the current breakpoint while paused lets the current session finish', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'live-remove-current.py', LIVE_UPDATE_CODE, [3]);
      await continueToLine(page, 3, 'live-remove-current\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('live-remove-current.py', 3);
        ctl.handleToolbarCmd('continue');
      });
      await waitForDebugComplete(page);

      const state = await page.evaluate(() => ({
        output: document.querySelector('.tvm-output-pre')?.textContent || '',
        breakpoints: Array.from(window._tutorial._debuggerCtl.breakpoints.get('/tutorial/live-remove-current.py') || []),
      }));
      expect(state.output).toMatch(/\b28\b/);
      expect(state.breakpoints).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test('conditional breakpoint edits while paused affect the current session', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'live-condition.py', LIVE_UPDATE_CODE, [3]);
      await continueToLine(page, 3, 'live-condition\\.py$');

      await setBreakpointCondition(page, 'live-condition.py', 4, 'total == -1', 'add');
      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await waitForLine(page, 3, 'live-condition\\.py$', 2);

      await setBreakpointCondition(page, 'live-condition.py', 4, 'total == 1');
      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await waitForLine(page, 4, 'live-condition\\.py$', 2);

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          line: snap.line,
          locationHit: snap.location_hit,
          conditionValue: snap.watches && snap.watches['total == 1'],
          breakpoints: Array.from(ctl.breakpoints.get('/tutorial/live-condition.py').entries())
            .map(([line, info]) => ({ line, condition: info.condition || null })),
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
      });
      expect(state.line).toBe(4);
      expect(state.locationHit).toBe(2);
      expect(state.conditionValue && state.conditionValue.repr).toBe('True');
      expect(state.breakpoints).toEqual([
        { line: 3, condition: null },
        { line: 4, condition: 'total == 1' },
      ]);
      expect(state.status).toContain('live-condition.py:4');
    } finally {
      await page.close();
    }
  });

  test('run to exception stops when no code or data breakpoints are set', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const code = `def boom():
    marker = 1
    raise ValueError("kaboom")

print("before")
boom()
print("after")
`;
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await page.evaluate(async ({ code }) => {
        const tutorial = window._tutorial;
        tutorial.loadStep(5);
        await new Promise(resolve => setTimeout(resolve, 500));
        tutorial.openFile('exception-only.py', code, 'python');
        tutorial._setActiveFile('exception-only.py');

        const ctl = tutorial._debuggerCtl;
        ctl.breakpoints = new Map();
        ctl.watchpoints = [];
        ctl._pendingWatches = [];
        ctl.exceptionBreakpoints = [{ id: 1, enabled: true, type: '', mode: 'uncaught' }];
        ctl._nextExceptionBpId = 2;
        localStorage.removeItem('tutorial-debug-bps-' + tutorial.tutorialId);
        localStorage.removeItem('tutorial-debug-excbps-' + tutorial.tutorialId);
        ctl.persistBreakpoints();
        ctl.persistExceptionBreakpoints();
        ctl.refreshBpDecorations();
        ctl.renderBreakpointManager();
        ctl._publishBreakpoints();
        ctl._publishWatchpoints();
        ctl._publishExceptionBreakpoints();
        ctl.startSession();
      }, { code });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx >= 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      const initialStopConditions = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        return {
          hasCodeBreakpoints: ctl.hasCodeBreakpoints(),
          hasEnabledWatchpoints: ctl.hasEnabledWatchpoints(),
          hasEnabledExceptionBreakpoints: ctl.hasEnabledExceptionBreakpoints(),
          hasForwardStopConditions: ctl.hasForwardStopConditions(),
        };
      });
      expect(initialStopConditions).toEqual({
        hasCodeBreakpoints: false,
        hasEnabledWatchpoints: false,
        hasEnabledExceptionBreakpoints: true,
        hasForwardStopConditions: true,
      });

      await page.evaluate(() => window._tutorial._debuggerCtl.runForwardToExceptionBreakpoint());
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.event === 'exception' &&
          snap.exception && snap.exception.type === 'ValueError' &&
          /exception-only\.py$/.test(snap.file);
      }, null, { timeout: DEBUG_TIMEOUT });

      const hit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        const top = snap.stack[snap.stack.length - 1];
        return {
          event: snap.event,
          line: snap.line,
          exceptionType: snap.exception && snap.exception.type,
          exceptionMessage: snap.exception && snap.exception.message,
          topFunction: top && top.function,
          output: document.querySelector('.tvm-output-pre')?.textContent || '',
        };
      });
      expect(hit).toEqual(expect.objectContaining({
        event: 'exception',
        line: 3,
        exceptionType: 'ValueError',
        exceptionMessage: 'kaboom',
        topFunction: 'boom',
      }));
      expect(hit.output).toContain('before');
      expect(hit.output).not.toContain('after');
    } finally {
      await page.close();
    }
  });

  test('data watchpoints added while paused affect the current session', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await page.evaluate(async ({ code }) => {
        const tutorial = window._tutorial;
        tutorial.loadStep(5);
        await new Promise(resolve => setTimeout(resolve, 500));
        tutorial.openFile('live-watchpoint.py', code, 'python');
        tutorial._setActiveFile('live-watchpoint.py');

        const ctl = tutorial._debuggerCtl;
        ctl.breakpoints = new Map();
        ctl.watchpoints = [];
        ctl._nextWatchpointId = 1;
        ctl._pendingWatches = [];
        ctl.persistBreakpoints();
        ctl.refreshBpDecorations();
        ctl.toggleBreakpoint('live-watchpoint.py', 3);
        ctl.startSession();
      }, { code: LIVE_UPDATE_CODE });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx >= 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.line === 3 && /live-watchpoint\.py$/.test(snap.file);
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('live-watchpoint.py', 3);
        ctl.addWatchpoint('marker == 0');
        ctl.handleToolbarCmd('watchContinue');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap && snap.watchpoint_origin &&
          snap.watchpoint_origin.line === 4 &&
          /data watchpoint changed/.test(ctl.statusEl && ctl.statusEl.textContent || '');
      }, null, { timeout: DEBUG_TIMEOUT });

      const hit = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          rawLine: snap.line,
          originLine: snap.watchpoint_origin && snap.watchpoint_origin.line,
          watch: snap.watches && snap.watches['marker == 0'],
          transportWatches: ctl.session.watches,
        };
      });
      expect(hit.rawLine).toBe(2);
      expect(hit.originLine).toBe(4);
      expect(hit.watch && hit.watch.repr).toBe('True');
      expect(hit.transportWatches).toContain('marker == 0');
    } finally {
      await page.close();
    }
  });

  test('data watchpoints removed while paused do not fire later in the current session', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'live-watch-remove.py', LIVE_UPDATE_CODE, [3]);
      await continueToLine(page, 3, 'live-watch-remove\\.py$');

      await page.evaluate(() => window._tutorial._debuggerCtl.addWatchpoint('marker == 0'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && !ctl.session?.runtimeSyncInFlight &&
          ctl.getEnabledWatchpoints().length === 1 &&
          ctl.session.watches.includes('marker == 0') &&
          snap && snap.watches && Object.prototype.hasOwnProperty.call(snap.watches, 'marker == 0');
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        ctl.removeBreakpoint('live-watch-remove.py', 3);
        ctl.removeWatchpoint('wp1');
        ctl.handleToolbarCmd('continue');
      });
      await waitForDebugComplete(page);

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        return {
          output: document.querySelector('.tvm-output-pre')?.textContent || '',
          watchpoints: ctl.getEnabledWatchpoints(),
          status: ctl.statusEl && ctl.statusEl.textContent,
        };
      });
      expect(state.output).toMatch(/\b28\b/);
      expect(state.watchpoints).toEqual([]);
      expect(state.status).toBe('');
    } finally {
      await page.close();
    }
  });

  test('normal watches added and removed while paused resync the current snapshot', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'live-watch-sync.py', LIVE_UPDATE_CODE, [3]);
      await continueToLine(page, 3, 'live-watch-sync\\.py$');

      await page.evaluate(() => window._tutorial._debuggerCtl.addNormalWatch('total'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && !ctl.session?.runtimeSyncInFlight &&
          snap && snap.watches && snap.watches.total && snap.watches.total.repr === '0' &&
          ctl.getNormalWatches().includes('total');
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.removeNormalWatch(0));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && !ctl.session?.runtimeSyncInFlight &&
          snap && snap.watches && !Object.prototype.hasOwnProperty.call(snap.watches, 'total') &&
          ctl.getNormalWatches().length === 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      const state = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          watches: ctl.getNormalWatches(),
          transportWatches: ctl.session.watches,
          snapshotWatches: Object.keys(snap.watches || {}),
        };
      });
      expect(state.watches).toEqual([]);
      expect(state.transportWatches).toEqual([]);
      expect(state.snapshotWatches).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test('any normal watch expression can become a data watchpoint', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'promote-watch.py', LIVE_UPDATE_CODE, [3]);
      await continueToLine(page, 3, 'promote-watch\\.py$');

      await page.evaluate(() => window._tutorial._debuggerCtl.addNormalWatch('total'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && !ctl.session?.runtimeSyncInFlight &&
          snap && snap.watches && snap.watches.total && snap.watches.total.repr === '0';
      }, null, { timeout: DEBUG_TIMEOUT });

      const before = await page.evaluate(() => {
        const root = window._tutorial.root;
        const ctl = window._tutorial._debuggerCtl;
        return {
          promoteButtons: root.querySelectorAll('.tvm-debug-watch-promote').length,
          watches: ctl.getNormalWatches(),
          watchpoints: ctl.getEnabledWatchpoints(),
        };
      });
      expect(before.promoteButtons).toBe(1);
      expect(before.watches).toEqual(['total']);
      expect(before.watchpoints).toEqual([]);

      await page.locator('.tvm-debug-watch-promote').click();
      await expect.poll(async () => page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        return {
          watches: ctl.getNormalWatches(),
          watchpoints: ctl.getEnabledWatchpoints().map(wp => wp.expr),
          transportWatches: ctl.session.watches,
        };
      })).toEqual({
        watches: [],
        watchpoints: ['total'],
        transportWatches: ['total'],
      });
    } finally {
      await page.close();
    }
  });

  test('live function-local variable edits update execution state before continuing', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await page.evaluate(async ({ code }) => {
        const tutorial = window._tutorial;
        tutorial.loadStep(5);
        await new Promise(resolve => setTimeout(resolve, 500));
        tutorial.openFile('live-edit.py', code, 'python');
        tutorial._setActiveFile('live-edit.py');

        const ctl = tutorial._debuggerCtl;
        ctl.breakpoints = new Map();
        ctl.watchpoints = [];
        ctl._pendingWatches = [];
        ctl.persistBreakpoints();
        ctl.refreshBpDecorations();
        ctl.toggleBreakpoint('live-edit.py', 3);
        ctl.startSession();
      }, { code: LIVE_EDIT_CODE });

      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx >= 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const top = snap && snap.stack && snap.stack[snap.stack.length - 1];
        return ctl && ctl.paused && snap && snap.line === 3 && top && top.function === 'compute';
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        ctl.applyVarEdit('locals', snap.stack.length - 1, 'total', '5');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        if (!ctl || !ctl.paused || !snap || snap.line !== 3 || ctl.session?.replayTargetIdx != null) return false;
        const topIdx = snap.stack.length - 1;
        const value = ctl.resolveVar(snap, topIdx, 'locals', 'total');
        return value && value.repr === '5';
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await waitForDebugComplete(page);
      const output = await page.evaluate(() => document.querySelector('.tvm-output-pre')?.textContent || '');
      expect(output).toMatch(/\b5\b/);
      expect(output).not.toMatch(/\b1\b/);
    } finally {
      await page.close();
    }
  });

  test('live module variable edits on a use line update execution state before continuing', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await startDebuggerWithBreakpoints(page, 'live-module-edit.py', LIVE_MODULE_EDIT_CODE, [2]);
      await continueToLine(page, 2, 'live-module-edit\\.py$');

      await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        ctl.applyVarEdit('locals', snap.stack.length - 1, 'total', '7');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        if (!ctl || !ctl.paused || !snap || snap.line !== 2 || ctl.session?.replayTargetIdx != null) return false;
        const topIdx = snap.stack.length - 1;
        const value = ctl.resolveVar(snap, topIdx, 'locals', 'total');
        return value && value.repr === '7';
      }, null, { timeout: DEBUG_TIMEOUT });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await waitForDebugComplete(page);
      const output = await page.evaluate(() => document.querySelector('.tvm-output-pre')?.textContent || '');
      expect(output).toMatch(/\b7\b/);
      expect(output).not.toMatch(/\b1\b/);
    } finally {
      await page.close();
    }
  });

  test('step back out rewinds from a callee to its caller without walking every callee line', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await prepareSingleFileDebuggerAtBreakpoint(page, 'callgraph.py', CALLGRAPH_CODE, 3);

      const inside = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        const top = snap.stack[snap.stack.length - 1];
        return {
          line: snap.line,
          topFunction: top.function,
          stackDepth: snap.stack.length,
          historyIdx: ctl.historyIdx,
          liveIdx: ctl.liveIdx,
        };
      });
      expect(inside).toMatchObject({
        line: 3,
        topFunction: 'inner',
        stackDepth: 3,
      });

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('backOut'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const top = snap && snap.stack && snap.stack[snap.stack.length - 1];
        return ctl && snap && top &&
          ctl.historyIdx < ctl.liveIdx &&
          snap.line === 7 &&
          top.function === 'outer' &&
          snap.stack.length === 2;
      }, null, { timeout: DEBUG_TIMEOUT });

      const rewoundOut = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        const top = snap.stack[snap.stack.length - 1];
        return {
          line: snap.line,
          topFunction: top.function,
          stackDepth: snap.stack.length,
          status: ctl.statusEl && ctl.statusEl.textContent,
          historyIdx: ctl.historyIdx,
          liveIdx: ctl.liveIdx,
        };
      });
      expect(rewoundOut).toMatchObject({
        line: 7,
        topFunction: 'outer',
        stackDepth: 2,
        status: expect.stringContaining('rewound out'),
      });
      expect(rewoundOut.historyIdx).toBeLessThan(rewoundOut.liveIdx);
    } finally {
      await page.close();
    }
  });

  test('run back to breakpoint stops at a prior breakpoint or the first instruction', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await prepareSingleFileDebuggerAtBreakpoint(page, 'callgraph.py', CALLGRAPH_CODE, 3);

      await page.evaluate(() => {
        window._tutorial._debuggerCtl.toggleBreakpoint('callgraph.py', 7);
        window._tutorial._debuggerCtl.handleToolbarCmd('backContinue');
      });
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        const top = snap && snap.stack && snap.stack[snap.stack.length - 1];
        return ctl && snap && top &&
          ctl.historyIdx < ctl.liveIdx &&
          snap.line === 7 &&
          top.function === 'outer';
      }, null, { timeout: DEBUG_TIMEOUT });

      const atPriorBreakpoint = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        const top = snap.stack[snap.stack.length - 1];
        return {
          line: snap.line,
          topFunction: top.function,
          status: ctl.statusEl && ctl.statusEl.textContent,
          historyIdx: ctl.historyIdx,
          liveIdx: ctl.liveIdx,
        };
      });
      expect(atPriorBreakpoint).toMatchObject({
        line: 7,
        topFunction: 'outer',
        status: expect.stringContaining('rewound to breakpoint'),
      });
      expect(atPriorBreakpoint.historyIdx).toBeLessThan(atPriorBreakpoint.liveIdx);

      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('backContinue'));
      await page.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.historyIdx === 0;
      }, null, { timeout: DEBUG_TIMEOUT });

      const atFirstInstruction = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          line: snap && snap.line,
          status: ctl.statusEl && ctl.statusEl.textContent,
          historyIdx: ctl.historyIdx,
        };
      });
      expect(atFirstInstruction.historyIdx).toBe(0);
      expect(atFirstInstruction.status).toMatch(/first instruction/);
    } finally {
      await page.close();
    }
  });
});
