const { test: base, expect } = require('@playwright/test');
const { waitForTutorialReady, passCurrentStepTests } = require('./tutorial-helpers');

const test = base.extend({ forceColdBoot: [false, { option: true }] });
const SHELL_PROMPT = /(?:^|\n)(?:root@)?tutorial:[^\n]*[#\$] $/;

async function terminalCommand(page, command) {
  await page.evaluate((input) => {
    window.__shellRecoveryOutput = '';
    window._tutorial.sendCommand(input);
  }, command);
  let output = '';
  await expect.poll(async () => {
    output = await page.evaluate(() => window.__shellRecoveryOutput)
      .then(text => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, ''));
    return SHELL_PROMPT.test(output) || output.includes('Kernel panic');
  }, { message: `The shell must return to a prompt after ${command}`, timeout: 15_000 }).toBe(true);
  expect(output, `Running ${command} must not crash the VM`).not.toContain('Kernel panic');
  expect(output).toMatch(SHELL_PROMPT);
  return output;
}

async function expectWorkPreserved(page) {
  const output = await terminalCommand(page, 'cat /tutorial/recovery-work.txt');
  expect(output).toMatch(/\nmy saved work\n/);
}

async function expectPermissionRecovery({ page }) {
  expect(await terminalCommand(page, '. ./recovery.sh')).toMatch(/\nmorning-ran\n/);

  const denied = await terminalCommand(page, './recovery.sh');
  expect(denied).toMatch(/permission denied/i);
  await expectWorkPreserved(page);

  expect(await terminalCommand(page, '. ./recovery.sh')).toMatch(/\nmorning-ran\n/);
  await terminalCommand(page, 'chmod +x recovery.sh');
  expect(await terminalCommand(page, './recovery.sh')).toMatch(/\nmorning-ran\n/);
}

test.describe('Tutorial VM shell recovery', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page, forceColdBoot }) => {
    // A missing prebuilt snapshot must also recover through the cold-boot path.
    if (forceColdBoot) await page.route('**/state.bin.gz*', route => route.abort());
    await page.goto('/SEBook/tools/shell-tutorial');
    await waitForTutorialReady(page, {
      readySelector: '.tvm-terminal-container',
      bootTimeout: 90_000,
    });
    expect(await page.evaluate(() => window._tutorial._usingSnapshot),
      'The regression must exercise the requested VM startup path').toBe(!forceColdBoot);
    await page.evaluate(async () => {
      const tutorial = window._tutorial;
      await tutorial._runSilent(':');
      window.__shellRecoveryOutput = '';
      // Observe the serial terminal itself: wrapping learner commands in a
      // helper shell would hide the interactive shell's inherited errexit.
      tutorial.emulator.add_listener('serial0-output-byte', byte => {
        window.__shellRecoveryOutput += String.fromCharCode(byte);
      });
    });
    await terminalCommand(page,
      "printf '%s\\n' '#!/bin/bash' 'set -e' 'echo morning-ran' > recovery.sh; chmod 644 recovery.sh; printf '%s\\n' 'my saved work' > recovery-work.txt");
  });

  test('a permission failure after sourcing a script leaves a usable shell and preserves work', expectPermissionRecovery);

  test('an unknown command after sourcing a script leaves a usable shell and preserves work', async ({ page }) => {
    await terminalCommand(page, '. ./recovery.sh');

    const missing = await terminalCommand(page, 'recovery.sh');
    expect(missing).toMatch(/command not found/i);
    await expectWorkPreserved(page);
  });

  test('exiting the interactive shell preserves work and leaves tutorial tests usable', async ({ page }) => {
    await terminalCommand(page, 'exit 42');
    await expectWorkPreserved(page);
    await passCurrentStepTests(page, 30_000);
  });

  test.describe('cold boot', () => {
    // The service worker otherwise serves the snapshot outside page routing.
    test.use({ forceColdBoot: true, serviceWorkers: 'block' });
    test('a permission failure after sourcing a script leaves a usable shell and preserves work', expectPermissionRecovery);
  });
});
