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
    const currentDecorationLines = model.getAllDecorations()
      .filter(d => {
        const cls = String(d.options?.className || '');
        const glyph = String(d.options?.glyphMarginClassName || '');
        return cls.includes('tvm-debug-current-line') || glyph.includes('tvm-debug-current-glyph');
      })
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
        expect(afterNext.output).toMatch(variant.expectedOutput);
      } finally {
        await page.close();
      }
    });
  }

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
    } finally {
      await page.close();
    }
  });
});
