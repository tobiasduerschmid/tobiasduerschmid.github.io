const { test, expect } = require('@playwright/test');
const path = require('path');

async function newHarness(page, terminalReady) {
  await page.setContent('<main><div id="tutorial-root"></div></main>');
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'tutorial-code.js') });
  return page.evaluate((ready) => {
    const tutorial = new window.TutorialCode('#tutorial-root', {
      backend: 'v86',
      steps: [],
      gitGraph: true,
      gitGraphPath: '/tutorial/myproject',
      gitGutter: true,
    });
    const calls = [];
    tutorial.booted = true;
    tutorial._terminalReadyForInput = ready;
    tutorial.emulator = {
      read_file() {
        return Promise.reject(new Error('missing gitgraph_state'));
      },
    };
    tutorial._probeRPCDaemon = function () {
      return Promise.resolve(false);
    };
    tutorial._runSilent = function (cmd) {
      calls.push(cmd);
      return Promise.resolve();
    };
    tutorial._runRPC = function (cmd) {
      calls.push('RPC:' + cmd);
      return Promise.resolve('');
    };
    window.__tutorialHarness = { tutorial, calls };
    return true;
  }, terminalReady);
}

test.describe('v86 terminal background sync', () => {
  test('syncs the v86 guest clock to the host before setup commands run', async ({ page }) => {
    await page.setContent('<main><div id="tutorial-root"></div></main>');
    await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'tutorial-code.js') });

    const calls = await page.evaluate(async () => {
      const realNow = Date.now;
      Date.now = () => 1778123456789;
      try {
        const tutorial = new window.TutorialCode('#tutorial-root', {
          backend: 'v86',
          steps: [],
        });
        const runSilentCalls = [];
        tutorial.term = { cols: 88, rows: 24 };
        tutorial._runSilent = function (cmd) {
          runSilentCalls.push(cmd);
          return Promise.resolve();
        };
        await tutorial._setupFilesystem();
        return runSilentCalls;
      } finally {
        Date.now = realNow;
      }
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]).toContain('date -u -s @1778123456');
    expect(calls[0].indexOf('date -u -s @1778123456')).toBeLessThan(calls[0].indexOf('stty cols 88 rows 24'));
  });

  test('make DAG refresh does not rewrite source or artifact mtimes', async ({ page }) => {
    await page.setContent('<main><div id="tutorial-root"></div></main>');
    await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'tutorial-code.js') });

    const dump = await page.evaluate(() => {
      const tutorial = new window.TutorialCode('#tutorial-root', {
        backend: 'v86',
        steps: [],
        makeDagPath: '/tutorial/make_project',
      });
      return tutorial._buildMakeDagDumpCommand();
    });

    expect(dump).toContain('make -pn --no-builtin-rules');
    expect(dump).not.toContain('-newermt');
    expect(dump).not.toContain('SRC_REF');
    expect(dump).not.toContain('touch ');
    expect(dump).not.toContain('touch\t');
  });

  test('does not send git graph or gutter fallback commands through serial after prompt reveal', async ({ page }) => {
    await newHarness(page, true);

    const result = await page.evaluate(async () => {
      const { tutorial, calls } = window.__tutorialHarness;
      await tutorial._installGitGraphPromptHook();
      await tutorial._dumpGitState();
      const gutter = await tutorial._v86GitFileAtHead('myproject/app.js');
      return {
        calls,
        gutter,
        hookInstalled: tutorial._gitGraphHookInstalled,
      };
    });

    expect(result.calls).toEqual([]);
    expect(result.gutter).toEqual({ content: null, notReady: true });
    expect(result.hookInstalled).toBe(false);
  });

  test('still allows legacy serial fallback before the terminal is interactive', async ({ page }) => {
    await newHarness(page, false);

    const result = await page.evaluate(async () => {
      const { tutorial, calls } = window.__tutorialHarness;
      await tutorial._installGitGraphPromptHook();
      await tutorial._dumpGitState();
      return {
        calls,
        hookInstalled: tutorial._gitGraphHookInstalled,
      };
    });

    expect(result.calls.length).toBe(2);
    expect(result.calls[0]).toContain('__gg_prompt');
    expect(result.calls[1]).toContain('gitgraph_state');
    expect(result.hookInstalled).toBe(true);
  });

  test('does not use serial fallback after prompt reveal has started', async ({ page }) => {
    await newHarness(page, false);

    const result = await page.evaluate(async () => {
      const { tutorial, calls } = window.__tutorialHarness;
      tutorial._terminalPromptRevealAttempted = true;
      await tutorial._installGitGraphPromptHook();
      await tutorial._dumpGitState();
      return {
        calls,
        hookInstalled: tutorial._gitGraphHookInstalled,
      };
    });

    expect(result.calls).toEqual([]);
    expect(result.hookInstalled).toBe(false);
  });

  test('accepts user terminal input only after the prompt is visible and serial is idle', async ({ page }) => {
    await newHarness(page, true);

    const result = await page.evaluate(() => {
      const { tutorial } = window.__tutorialHarness;
      tutorial.emulator = { serial0_send() {} };
      const states = [
        { ready: false, mute: 0, running: false, queued: 0, listeners: 0 },
        { ready: true, mute: 1, running: false, queued: 0, listeners: 0 },
        { ready: true, mute: 0, running: true, queued: 0, listeners: 0 },
        { ready: true, mute: 0, running: false, queued: 1, listeners: 0 },
        { ready: true, mute: 0, running: false, queued: 0, listeners: 1 },
        { ready: true, mute: 0, running: false, queued: 0, listeners: 0 },
      ];
      return states.map((state) => {
        tutorial._terminalReadyForInput = state.ready;
        tutorial._muteCount = state.mute;
        tutorial._silentRunning = state.running;
        tutorial._silentQueue = new Array(state.queued).fill({});
        tutorial._silentListeners = new Array(state.listeners).fill({});
        return tutorial._canAcceptTerminalInput();
      });
    });

    expect(result).toEqual([false, false, false, false, false, true]);
  });
});
