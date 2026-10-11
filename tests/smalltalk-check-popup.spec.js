const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test.setTimeout(180000);
const checkResults = page => page.getByRole('region', { name: 'Smalltalk check results', exact: true });

async function openInstructions(page) {
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Open instructions in separate window$/ }).click();
  const popup = await opened;
  await expect(popup.getByRole('button', { name: /Test My Work/ })).toBeEnabled();
  return popup;
}

async function holdNativeCheck(page) {
  await page.evaluate(() => {
    window._tutorial.steps[0].tests = [{
      description: 'A fresh counter starts at zero.', command: 'SEBookCounter new value = 0',
    }];
    // Gate only delivery of the real native receipt. Source, evaluation, and
    // cancellation still use production code; no fabricated pass/fail result.
    const prototype = SEBookSmalltalk.RuntimeHost.prototype;
    const request = prototype.request;
    const delivered = new Promise(resolve => { window.releaseSmalltalkCheck = resolve; });
    window.smalltalkCheckHeld = new Promise(resolve => {
      prototype.request = async function (session, operation, payload, options = {}) {
        const result = await request.call(this, session, operation, payload, options);
        if (operation === 'evaluate' && options.purpose === 'check') {
          prototype.request = request;
          resolve();
          await delivered;
        }
        return result;
      };
    });
  });
}

for (const interruption of ['stop', 'accepted source change']) {
  test(`detached instructions finish checks after ${interruption} and allow another run`, async ({ page }) => {
    const popup = await openInstructions(page);
    if (interruption === 'accepted source change') {
      const theme = page.getByRole('checkbox', { name: 'Toggle dark mode' });
      await theme.focus();
      await theme.press('Space');
      await expect(theme).toBeChecked();
      // html.dark-mode is the documented shared theme contract.
      await expect(popup.locator('html')).toHaveClass(/dark-mode/);
    }
    await holdNativeCheck(page);
    await popup.getByRole('button', { name: /Test My Work/ }).click();
    await expect(popup.getByText('Running tests…', { exact: true })).toBeVisible();
    await page.evaluate(() => window.smalltalkCheckHeld);

    try {
      if (interruption === 'stop') {
        await page.getByRole('button', { name: /Stop$/ }).click();
      } else {
        // Public Workspace acceptance changes the live revision while the
        // independent check still owns its earlier accepted-source snapshot.
        await page.evaluate(() => {
          const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
          return workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
            target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
            source: 'increment count := count + 2. ^ self', protocol: 'counting',
          } });
        });
      }
    } finally {
      await page.evaluate(() => window.releaseSmalltalkCheck());
    }

    const message = interruption === 'stop'
      ? 'Checks stopped. No completion credit awarded.'
      : 'Accepted source changed during checks. Results discarded; run Test My Work again.';
    await expect(checkResults(popup)).toContainText(message, { timeout: 30000 });
    await expect(popup.getByText('Running tests…', { exact: true })).toHaveCount(0);
    await expect(popup.getByText(/0\s*\/\s*1 tests passed|All 1 tests passed!/)).toHaveCount(0);
    await a11yCheckpoint(popup, `Smalltalk popup after ${interruption}`, { feature: 'smalltalk-tutorial' });

    await expect(popup.getByRole('button', { name: /Test My Work/ })).toBeEnabled();
    await popup.getByRole('button', { name: /Test My Work/ }).click();
    await expect(checkResults(popup)).toContainText('All 1 tests passed!', { timeout: 120000 });
    await expect(popup.getByRole('button', { name: /Test My Work/ })).toBeEnabled();
    await a11yCheckpoint(popup, `Smalltalk popup recheck after ${interruption}`, { feature: 'smalltalk-tutorial' });
  });
}
