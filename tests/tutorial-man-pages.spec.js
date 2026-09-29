const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

// Exercise the shipped VM through its interactive shell so the same startup
// configuration and terminal behavior used by learners are part of the check.
async function runTerminalCommand(page, command) {
  return page.evaluate(async (shellCommand) => {
    const tutorial = window._tutorial;
    await tutorial._runSilent(':');
    return new Promise((resolve) => {
      let output = '';
      const capture = (byte) => {
        output += String.fromCharCode(byte);
        if (/\n__MAN_EXIT__=\d+\r?\n/.test(output)) {
          tutorial.emulator.remove_listener('serial0-output-byte', capture);
          // Normalize terminal styling, including the overstrikes used by man.
          resolve(output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/.\x08/g, ''));
        }
      };
      tutorial.emulator.add_listener('serial0-output-byte', capture);
      tutorial.sendCommand(`${shellCommand}; printf '\\n__MAN_EXIT__=%s\\n' "$?"`);
    });
  }, command);
}

// xterm renders to canvas; its public buffer API exposes the same text that
// learners can read and scroll through without depending on renderer markup.
async function terminalText(page) {
  return page.evaluate(() => {
    const buffer = window._tutorial.term.buffer.active;
    return Array.from({ length: buffer.length }, (_, index) =>
      buffer.getLine(index).translateToString(true)).join('\n');
  });
}

test.describe('Linux tutorial manual pages', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/tools/shell-tutorial');
    await waitForTutorialReady(page, {
      readySelector: '.tvm-terminal-container',
      bootTimeout: 90_000,
    });
  });

  for (const { command, heading, content } of [
    { command: 'man date', heading: 'DATE(1)', content: /(?:print|display) or set[\s\S]*date and time/i },
    { command: 'man echo', heading: 'ECHO(1)', content: /display a line of text/i },
    { command: 'man chmod', heading: 'CHMOD(1)', content: /change file mode bits/i },
    { command: 'man 1 date', heading: 'DATE(1)', content: /(?:print|display) or set[\s\S]*date and time/i },
  ]) {
    test(`${command} displays its manual and returns to the shell`, async ({ page }) => {
      const output = await runTerminalCommand(page, command);
      expect(output).toContain(heading);
      expect(output).toMatch(/\bNAME\b/);
      expect(output).toMatch(/\bSYNOPSIS\b/);
      expect(output).toMatch(content);
      expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
    });
  }

  test('manual pages can be piped into another command and remain readable in scrollback', async ({ page }) => {
    const output = await runTerminalCommand(page, '(set -o pipefail; man date | cat)');
    expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
    await expect.poll(() => terminalText(page)).toContain('DATE(1)');
    await expect.poll(() => terminalText(page)).toMatch(/date - (?:print|display) or set/);
  });

  test('an unknown manual reports the missing page and fails', async ({ page }) => {
    const output = await runTerminalCommand(page, 'man tutorial-no-such-command');
    expect(output).toMatch(/(?:no (?:manual|entry)|not found).*tutorial-no-such-command/i);
    expect(output).toMatch(/__MAN_EXIT__=[1-9]\d*\r?\n/);
  });
});
