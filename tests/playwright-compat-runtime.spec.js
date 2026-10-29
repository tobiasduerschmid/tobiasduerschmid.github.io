// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

const runnerPath = path.resolve(__dirname, '../js/playwright-compat/runner.js');
const brokerPath = path.resolve(__dirname, '../js/react-assertion-broker.js');
let server;
let origin;

// Serve the real runner and private broker without loading an unrelated lesson
// or its CDN dependencies. Every test still uses an actual browser document.
test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const source = request.url === '/js/playwright-compat/runner.js' ? runnerPath
      : request.url === '/broker.js' ? brokerPath : null;
    response.setHeader('Content-Type', source ? 'text/javascript' : 'text/html');
    response.end(source ? fs.readFileSync(source) : '<!doctype html><title>Compatibility fixture</title><script src="/js/playwright-compat/runner.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test.beforeEach(async ({ page }) => { await page.goto(origin); });

async function installAgent(page, html) {
  await page.setContent(html);
  await page.addScriptTag({ path: runnerPath });
  const source = await page.evaluate(() => window.SEBookPlaywrightCompat.agentScript());
  await page.addScriptTag({ content: source });
}

async function command(page, type, payload) {
  return page.evaluate(({ type, payload }) => window.__sebookPlaywrightCompatCommand({ type, payload }), { type, payload });
}

const text = value => ({ type: 'text', value });
const role = (name, options = {}) => [{ kind: 'role', role: name, options }];
const listText = values => ({ assertion: 'text', locator: role('listitem'), expected: { type: 'array', items: values.map(text) } });

test('text arrays require every list item in order, including repeated values', async ({ page }) => {
  await installAgent(page, '<ul><li>Milk</li><li>Eggs</li><li>Milk</li></ul>');
  await expect(page.getByRole('listitem')).toHaveText(['Milk', 'Eggs', 'Milk']);
  expect(await command(page, 'assert', listText(['Milk', 'Eggs', 'Milk']))).toMatchObject({ pass: true });
  expect(await command(page, 'assert', listText(['Milk', 'Milk', 'Eggs']))).toMatchObject({ pass: false });
  expect(await command(page, 'assert', listText(['Milk', 'Eggs']))).toMatchObject({ pass: false });
  await page.getByRole('listitem').last().evaluate(element => element.remove());
  expect(await command(page, 'assert', listText(['Milk', 'Eggs', 'Milk']))).toMatchObject({ pass: false });
});

test('contains-text arrays match an ordered subset and empty lists have explicit semantics', async ({ page }) => {
  await installAgent(page, '<ul><li>Milk carton</li><li>Bread loaf</li><li>Eggs box</li></ul>');
  const subset = { ...listText(['Milk', 'Eggs']), assertion: 'containText' };
  await expect(page.getByRole('listitem')).toContainText(['Milk', 'Eggs']);
  expect(await command(page, 'assert', subset)).toMatchObject({ pass: true });
  expect(await command(page, 'assert', { ...subset, expected: { type: 'array', items: [text('milk')] } })).toMatchObject({ pass: false });
  expect(await command(page, 'assert', { ...subset, expected: { type: 'array', items: [text('Eggs'), text('Milk')] } })).toMatchObject({ pass: false });
  expect(await command(page, 'assert', listText([]))).toMatchObject({ pass: false });
  await page.getByRole('list').evaluate(element => element.replaceChildren());
  expect(await command(page, 'assert', listText([]))).toMatchObject({ pass: true });
});

test('role queries exclude inaccessible duplicates and honor pressed state', async ({ page }) => {
  await installAgent(page, '<button aria-pressed="true">Milk</button><button aria-pressed="false">Eggs</button><div aria-hidden="true"><button>Milk</button></div><button hidden>Milk</button>');
  await expect(page.getByRole('button', { name: 'Milk' })).toHaveCount(1);
  expect(await command(page, 'count', { locator: role('button', { name: text('Milk') }) })).toBe(1);
  expect(await command(page, 'count', { locator: role('button', { name: text('Milk'), includeHidden: true }) })).toBe(3);
  expect(await command(page, 'count', { locator: role('button', { pressed: true }) })).toBe(1);
  expect(await command(page, 'count', { locator: role('button', { pressed: false }) })).toBe(1);
});

test('role queries honor checked, selected, expanded, disabled and heading level filters', async ({ page }) => {
  await installAgent(page, `<input type="checkbox" aria-label="Done" checked>
    <select aria-label="Drink"><option selected>Tea</option><option>Coffee</option></select>
    <button aria-expanded="true">Details</button><button aria-expanded="false">More</button>
    <fieldset disabled><button>Unavailable</button></fieldset>
    <h2>Overview</h2><div role="heading" aria-level="3">Details heading</div>`);
  for (const [name, options] of [
    ['checkbox', { checked: true }], ['option', { selected: true }],
    ['button', { expanded: true }], ['button', { disabled: true }], ['heading', { level: 3 }],
  ]) {
    await expect(page.getByRole(name, options)).toHaveCount(1);
    expect(await command(page, 'count', { locator: role(name, options) })).toBe(1);
  }
});

test('native form-control roles follow their HTML control type', async ({ page }) => {
  await installAgent(page, '<input type="search" aria-label="Search"><input type="number" aria-label="Amount"><input type="password" aria-label="Password"><select multiple aria-label="Drinks"><option>Tea</option></select>');
  for (const [name, count] of [['searchbox', 1], ['spinbutton', 1], ['textbox', 1], ['listbox', 1], ['combobox', 0]]) {
    await expect(page.getByRole(name)).toHaveCount(count);
    expect(await command(page, 'count', { locator: role(name) })).toBe(count);
  }
});

test('a click waits until its button exists and becomes enabled', async ({ page }) => {
  await installAgent(page, '<p role="status">Waiting</p>');
  // The fixture intentionally changes asynchronously; the test itself waits
  // on the action and visible result, rather than sleeping for a guessed time.
  await page.evaluate(() => {
    setTimeout(() => {
      const button = document.createElement('button');
      button.textContent = 'Save'; button.disabled = true;
      button.onclick = () => { document.querySelector('[role=status]').textContent = 'Saved'; };
      document.body.appendChild(button);
      setTimeout(() => { button.disabled = false; }, 80);
    }, 80);
  });
  await command(page, 'action', { action: 'click', locator: role('button', { name: text('Save') }), options: { timeout: 1000 } });
  await expect(page.getByRole('status')).toHaveText('Saved');
});

for (const [state, attributes] of [['hidden', 'hidden'], ['disabled', 'disabled'], ['covered', '']]) {
  test(`a ${state} button is not activated by a synthetic click`, async ({ page }) => {
    await installAgent(page, `<button ${attributes} onclick="document.querySelector('output').textContent='Clicked'">Save</button><output role="status">Untouched</output>` +
      (state === 'covered' ? '<div style="position:fixed;inset:0;background:white">Cover</div>' : ''));
    await expect(command(page, 'action', { action: 'click', locator: role('button', { name: text('Save'), includeHidden: true }), options: { timeout: 100 } })).rejects.toThrow(/timed out/);
    await expect(page.getByRole('status')).toHaveText('Untouched');
  });
}

test('cancelled action retries never activate a control that becomes available later', async ({ page }) => {
  await installAgent(page, '<button disabled onclick="document.querySelector(\'output\').textContent=\'Clicked\'">Save</button><output role="status">Untouched</output>');
  const result = await page.evaluate(async locator => {
    const pending = window.__sebookPlaywrightCompatCommand({ type: 'action', payload: { action: 'click', locator, options: { timeout: 1000 } } });
    window.__sebookPlaywrightCompatCommand({ type: 'cancel-actions', payload: {} });
    document.querySelector('button').disabled = false;
    try { await pending; return 'completed'; } catch (error) { return error.message; }
  }, role('button', { name: text('Save') }));
  expect(result).toMatch(/cancelled/);
  await expect(page.getByRole('status')).toHaveText('Untouched');
});

test('check and uncheck are idempotent and dispatch only actual state changes', async ({ page }) => {
  await installAgent(page, '<label><input type="checkbox" onchange="document.querySelector(\'output\').textContent=String(Number(document.querySelector(\'output\').textContent)+1)">Done</label><output role="status">0</output>');
  const locator = role('checkbox', { name: text('Done') });
  for (const action of ['check', 'check']) await command(page, 'action', { action, locator });
  await expect(page.getByRole('checkbox', { name: 'Done' })).toBeChecked();
  await expect(page.getByRole('status')).toHaveText('1');
  for (const action of ['uncheck', 'uncheck']) await command(page, 'action', { action, locator });
  await expect(page.getByRole('checkbox', { name: 'Done' })).not.toBeChecked();
  await expect(page.getByRole('status')).toHaveText('2');
});

async function installRunnerFixture(page, html) {
  await page.evaluate(({ html, origin }) => {
    let previous;
    window.compatFixture = {
      mounts: 0,
      async rebuild() {
        if (previous) { previous.port.close(); previous.frame.remove(); }
        const frame = document.createElement('iframe');
        frame.title = 'Test application'; frame.setAttribute('sandbox', 'allow-scripts');
        const portReady = new Promise(resolve => {
          function ready(event) {
            if (event.source !== frame.contentWindow || event.data?.type !== 'sebook-react-assertion-broker-ready') return;
            window.removeEventListener('message', ready);
            resolve(event.ports[0]);
          }
          window.addEventListener('message', ready);
        });
        const loaded = new Promise(resolve => { frame.onload = resolve; });
        frame.srcdoc = '<!doctype html><body>' + html + '<script>' + window.SEBookPlaywrightCompat.agentScript() + '</' + 'script><script src="' + origin + '/broker.js"></' + 'script>';
        document.body.appendChild(frame);
        const [port] = await Promise.all([portReady, loaded]);
        previous = { frame, port };
        this.mounts++;
        return previous;
      },
      async run(source, options = {}) {
        const preview = await this.rebuild();
        return window.SEBookPlaywrightCompat.run({
          previewFrame: preview.frame, port: preview.port,
          files: { 'learner.spec.js': source }, testFiles: ['learner.spec.js'],
          timeout: 800, freshPreview: true, rebuildPreview: () => this.rebuild(), ...options,
        });
      },
    };
  }, { html, origin });
}

test('a failing learner assertion returns expected and actual text for feedback', async ({ page }) => {
  await installRunnerFixture(page, '<ul><li>Milk</li></ul>');
  const result = await page.evaluate(() => window.compatFixture.run(`
    test('submitted todo keeps its text', async ({ page }) => {
      await expect(page.getByRole('listitem')).toHaveText('Bread', { timeout: 150 });
    });`));
  expect(result.results).toEqual([false]);
  expect(result.details[0]).toContain('Bread');
  expect(result.details[0]).toContain('Milk');
});

test('collection errors include the learner error while preserving the result shape', async ({ page }) => {
  await installRunnerFixture(page, '<h1>Example</h1>');
  const result = await page.evaluate(() => window.compatFixture.run('test('));
  expect(result.tests).toEqual([{ description: 'Load learner.spec.js' }]);
  expect(result.results).toEqual([false]);
  expect(result.details[0]).toMatch(/Unexpected|expected/i);
});

test('a negated assertion cannot pass because its locator is ambiguous', async ({ page }) => {
  await installRunnerFixture(page, '<button>Save</button><button>Save</button>');
  const result = await page.evaluate(() => window.compatFixture.run(`
    test('save is hidden', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Save' })).not.toBeVisible({ timeout: 100 });
    });`));
  expect(result.results).toEqual([false]);
  expect(result.details[0]).toContain('Strict locator');
});

for (const freshPreview of [true, false]) test(`a ${freshPreview ? 'fresh' : 'previously used'} preview preserves isolation without redundant resets`, async ({ page }) => {
  await installRunnerFixture(page, '<button onclick="document.querySelector(\'output\').textContent=String(Number(document.querySelector(\'output\').textContent)+1)">Increment</button><output role="status">0</output>');
  const result = await page.evaluate(async freshPreview => {
    const run = await window.compatFixture.run(`
      for (const title of ['first isolated test', 'second isolated test']) {
        test(title, async ({ page }) => {
          await page.getByRole('button', { name: 'Increment' }).click();
          await expect(page.getByRole('status')).toHaveText('1');
        });
      }`, { freshPreview });
    return { ...run, mounts: window.compatFixture.mounts };
  }, freshPreview);
  expect(result.results).toEqual([true, true]);
  expect(result.details).toEqual(['', '']);
  expect(result.mounts, 'reset before the first test only when the supplied preview is not fresh').toBe(freshPreview ? 2 : 3);
});

test('afterEach cleanup runs after a failed assertion before the next test starts', async ({ page }) => {
  await installRunnerFixture(page, '<button onclick="document.querySelector(\'output\').textContent=\'Clean\'">Reset</button><output role="status">Dirty</output>');
  const result = await page.evaluate(() => window.compatFixture.run(`
    test.afterEach(async ({ page }) => { await page.getByRole('button', { name: 'Reset' }).click(); });
    test('failing behavior', async ({ page }) => { await expect(page.getByRole('status')).toHaveText('Wrong', { timeout: 100 }); });
    test('following behavior', async ({ page }) => { await expect(page.getByRole('status')).toHaveText('Clean'); });
  `, { resetBetweenTests: false }));
  expect(result.results).toEqual([false, true]);
  expect(result.details[0]).toContain('Wrong');
});

for (const bodyFails of [true, false]) test(`all cleanup hooks run while preserving the ${bodyFails ? 'body' : 'first cleanup'} failure`, async ({ page }) => {
  await installRunnerFixture(page, '<h1>Cleanup fixture</h1>');
  const result = await page.evaluate(bodyFails => window.compatFixture.run(`
    const cleanups = [];
    test.afterEach(() => { cleanups.push('outer'); });
    test.describe('nested scope', () => {
      test.afterEach(() => { cleanups.push('first'); throw new Error('first cleanup failure'); });
      test.afterEach(() => { cleanups.push('later'); throw new Error('later cleanup failure'); });
      test('subject', () => { ${bodyFails ? "throw new Error('original body failure');" : ''} });
    });
    test('later and outer cleanup completed', () => {
      expect(cleanups).toEqual(['first', 'later', 'outer']);
    });
  `), bodyFails);
  expect(result.results).toEqual([false, true]);
  expect(result.details[0]).toBe(bodyFails ? 'original body failure' : 'first cleanup failure');
});

test('aborting a running learner worker leaves the next run usable', async ({ page }) => {
  await installRunnerFixture(page, '<button onclick="document.querySelector(\'output\').textContent=\'Running\'">Start</button><output role="status">Ready</output>');
  const pending = page.evaluate(async () => {
    window.compatAbort = new AbortController();
    try {
      await window.compatFixture.run(`test('stuck learner code', async ({ page }) => {
        await page.getByRole('button', { name: 'Start' }).click();
        while (true) {}
      });`, { signal: window.compatAbort.signal, timeout: 5000 });
      return 'completed';
    } catch (error) { return error.name; }
  });
  await expect(page.frameLocator('iframe').getByRole('status')).toHaveText('Running');
  await page.evaluate(() => window.compatAbort.abort());
  expect(await pending).toBe('AbortError');
  const recovery = await page.evaluate(() => window.compatFixture.run(`test('recovery', async ({ page }) => {
    await expect(page.getByRole('status')).toHaveText('Ready');
  });`));
  expect(recovery.results).toEqual([true]);
});

test('a pre-aborted run rejects immediately without evaluating learner source', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const controller = new AbortController(); controller.abort();
    try {
      await window.SEBookPlaywrightCompat.run({ signal: controller.signal });
      return 'completed';
    } catch (error) { return error.name; }
  });
  expect(result).toBe('AbortError');
});
