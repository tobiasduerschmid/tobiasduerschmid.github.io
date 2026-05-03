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
});
