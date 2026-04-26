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

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-output-panel', { timeout: BOOT_TIMEOUT });
  await page.waitForFunction(() => window._tutorial && window._tutorial._debuggerCtl && window._tutorial.editor,
    { timeout: BOOT_TIMEOUT });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
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
    const currentDecorationLines = currentDecorations.map(d => d.range.startLineNumber);
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
    return ctl && !ctl.session && ctl.statusEl && ctl.statusEl.textContent === 'finished';
  }, null, { timeout: DEBUG_TIMEOUT });
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

    const chevron = document.createElement('div');
    chevron.className = 'tvm-debug-current-glyph-on-bp';
    chevron.style.position = 'absolute';
    chevron.style.left = '-9999px';
    chevron.style.top = '-9999px';
    document.body.appendChild(chevron);

    const standaloneStyle = getComputedStyle(standalone);
    const conditionalStyle = getComputedStyle(conditional);
    const conditionalQuestionStyle = getComputedStyle(conditional, '::after');
    const chevronStyle = getComputedStyle(chevron);
    const result = {
      standaloneBackground: standaloneStyle.backgroundColor,
      standaloneOutline: standaloneStyle.boxShadow,
      standaloneWidth: standaloneStyle.width,
      standaloneHeight: standaloneStyle.height,
      conditionalWidth: conditionalStyle.width,
      conditionalHeight: conditionalStyle.height,
      conditionalQuestionDisplay: conditionalQuestionStyle.display,
      conditionalQuestionAlignItems: conditionalQuestionStyle.alignItems,
      conditionalQuestionJustifyContent: conditionalQuestionStyle.justifyContent,
      chevronBreakpointImage: chevronStyle.backgroundImage,
    };

    standalone.remove();
    conditional.remove();
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
      expect(light.standaloneOutline).toContain('rgb(0, 0, 0)');
      expect(light.standaloneWidth).toBe('16px');
      expect(light.standaloneHeight).toBe('16px');
      expect(light.conditionalWidth).toBe('16px');
      expect(light.conditionalHeight).toBe('16px');
      expect(light.conditionalQuestionDisplay).toBe('flex');
      expect(light.conditionalQuestionAlignItems).toBe('center');
      expect(light.conditionalQuestionJustifyContent).toBe('center');
      expect(dark).toEqual(light);
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

  test('starting again after a finished run resets synced history', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await prepareDebuggerAtBreakpoint(page, 17);
      await page.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));
      await waitForDebugComplete(page);

      const finished = await page.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        return {
          controllerHistoryLength: ctl.history.length,
          syncHistoryLength: ctl.sync.state.history.length,
        };
      });
      expect(finished.controllerHistoryLength).toBeGreaterThan(1);
      expect(finished.syncHistoryLength).toBe(finished.controllerHistoryLength);

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
