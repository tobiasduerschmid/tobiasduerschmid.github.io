const { test, expect } = require('@playwright/test');

// Cold worker boot is controlled at the platform boundary. Compilation itself
// is covered by cpp-worker.spec.js with the real compiler; this suite checks
// the navigation/Stop contract while a replacement runtime is still loading.
function installControlledCompilers() {
  const NativeWorker = window.Worker;
  const workers = [];
  let holdBackend = null;
  let holdNextRun = false;
  window.compilerBootControl = {
    holdReplacement(backend) { holdBackend = backend; holdNextRun = true; },
    lateError() {
      const old = workers.find(worker => worker.held && worker.terminated);
      if (old && old.onerror) old.onerror({ message: 'obsolete worker failure' });
    },
  };
  window.Worker = class ControlledCompiler {
    constructor(url, options) {
      const match = String(url).match(/\/(cpp|pyodide)-worker\.js(?:\?|$)/);
      if (!match) return new NativeWorker(url, options);
      this.backend = match[1];
      this.held = holdBackend === this.backend;
      workers.push(this);
      if (!this.held) queueMicrotask(() => this.deliver({ type: 'ready' }));
    }
    deliver(data) {
      if (!this.terminated && this.onmessage) this.onmessage({ data });
    }
    terminate() { this.terminated = true; }
    postMessage(message) {
      if (message.type === 'run' && holdNextRun) {
        holdNextRun = false;
        return;
      }
      queueMicrotask(() => {
        if (message.type === 'write') {
          this.deliver({ type: 'write_ok', id: message.id });
        } else {
          if (message.type === 'run') this.deliver({ type: 'stdout', text: 'selected runtime ran\n' });
          this.deliver({ type: 'run_done', id: message.id, exitCode: 0, phase: 'run' });
        }
      });
    }
  };
}

const runButton = page => page.getByRole('button', { name: /▶ Run/ });
const stepButton = (page, index) => page.getByRole('button', { name: new RegExp(`^Step ${index}:`) });

for (const [backend, startingStep, destinationStep] of [['cpp', 1, 2], ['pyodide', 2, 1]]) {
  test(`switching away during ${backend} restart cancels its boot and preserves the selected runtime`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(installControlledCompilers);
    await page.goto('/SEBook/tools/cs131-refresher-tutorial?instructor-mode=true&autosave=false');
    await expect(runButton(page)).toBeEnabled();
    await stepButton(page, startingStep).click();
    await expect(runButton(page)).toBeEnabled();
    // Install the clock after initial application startup, then advance only
    // the obsolete boot deadline; no real 120-second wait is needed.
    await page.clock.install();
    await page.evaluate(language => window.compilerBootControl.holdReplacement(language), backend);
    await runButton(page).click();
    await page.getByRole('button', { name: /Stop$/ }).click();
    await expect(page.getByText(/^Loading (C\+\+ compiler|Python runtime)/)).toBeVisible();
    // Popout navigation invokes the same public API while the parent workspace
    // is covered by its loading panel.
    await page.evaluate(index => window._tutorial.loadStep(index - 1), destinationStep);
    await expect(runButton(page)).toBeEnabled();
    await page.clock.fastForward(120_001);
    await page.evaluate(() => window.compilerBootControl.lateError());
    await expect(runButton(page)).toBeEnabled();
    await runButton(page).click();
    await expect(page.getByText('selected runtime ran', { exact: false })).toBeVisible();
    await expect(runButton(page)).toBeEnabled();
    await expect(page.getByText(/Failed to restart|initialization timed out|obsolete worker failure/)).toHaveCount(0);
  });
}
