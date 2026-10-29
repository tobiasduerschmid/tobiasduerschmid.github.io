const { test: base, expect } = require('@playwright/test');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const test = base.extend({
  cleanConsole: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use();
    expect(errors, 'workspace must render without JavaScript errors').toEqual([]);
  }, { auto: true }]
});

// Component contract tests: the real view receives engine-independent result data.
// The callback spy is the boundary to the controller, not a replacement checker.
async function mount(page) {
  await page.setContent('<!doctype html><html lang="en"><head><title>TLA+ workspace component</title></head><body><main><h1>Model checking</h1><h2>Practice</h2><div id="workspace"></div><output aria-label="Last workspace action"></output></main></body></html>');
  await page.addStyleTag({ content: 'html { font-size:62.5%; } body { margin:0; font: 18px/1.5 sans-serif; }' });
  await page.addStyleTag({ path: path.resolve(__dirname, '../css/tla-workspace.css') });
  await page.addScriptTag({ path: path.resolve(__dirname, '../js/tla/view.js') });
  await page.evaluate(() => {
    const record = (action, value) => {
      document.querySelector('output').textContent = JSON.stringify({ action, value });
    };
    window.workspaceView = window.SEBookTLAView.mount(document.getElementById('workspace'), {
      onCheck: () => record('check'), onExplore: () => record('explore'),
      onParse: () => record('parse'), onStop: () => record('stop'),
      onSelectState: index => record('select', index), onNextState: index => record('choose', index),
      onBack: () => record('back'), onEvaluate: expression => record('evaluate', expression),
      onSourceLocation: location => record('source', location)
    });
  });
}

function exampleState(overrides = {}) {
  return {
    phase: 'complete', mode: 'check', selectedIndex: 1,
    result: {
      status: 'counterexample', summary: 'Both processes entered the critical section.',
      trace: [
        { action: 'Init', variables: [{ name: 'inside', value: '{}', type: 'set' }, { name: 'limit', value: '2', type: 'number' }] },
        { action: 'Enter(p1)', location: { module: 'Mutex', line: 7 }, variables: [{ name: 'inside', value: '{p1}', type: 'set' }, { name: 'limit', value: '2', type: 'number' }] }
      ],
      loopTo: 1, stats: { 'Distinct states': 4 }, output: 'Invariant MutualExclusion is violated.'
    },
    ...overrides
  };
}

async function render(page, state) {
  await page.evaluate(value => window.workspaceView.render(value), state);
}

test.beforeEach(async ({ page }) => { await mount(page); });

test('explains checking versus exploration and exposes both to keyboard users', async ({ page }) => {
  await expect(page.getByText('Exploring one behavior is not a full check.', { exact: false })).toBeVisible();
  const check = page.getByRole('button', { name: 'Check every reachable state', exact: true });
  await check.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"check"}');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Explore one behavior', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"explore"}');
  await expect(page.getByRole('table')).toHaveCount(0);
  await a11yCheckpoint(page, 'tla-idle');
});

test('preserves TLA value syntax, identifies changed variables, and explains the loop', async ({ page }) => {
  await render(page, exampleState());
  await expect(page.getByRole('row', { name: /inside/ })).toContainText('{p1}');
  await expect(page.getByRole('row', { name: /inside/ })).toContainText('Changed');
  await expect(page.getByRole('row', { name: /limit/ })).toContainText('Unchanged');
  await page.getByText('Previous value', { exact: true }).click();
  await expect(page.getByRole('row', { name: /inside/ })).toContainText('{}');
  await page.getByLabel('Show only changed variables').check();
  await expect(page.getByRole('row', { name: /limit/ })).toHaveCount(0);
  await expect(page.getByText(/after state 2, return to state 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Show this step in the source' }).click();
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"source","value":{"module":"Mutex","line":7}}');
  await a11yCheckpoint(page, 'tla-counterexample');
});

test('navigates long traces without dropping distant states', async ({ page }) => {
  const states = Array.from({ length: 30 }, (_, index) => ({ variables: [{ name: 'count', value: String(index) }] }));
  await render(page, exampleState({ selectedIndex: 15, result: { status: 'counterexample', trace: states } }));
  await page.getByLabel('Jump to state').selectOption('29');
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"select","value":29}');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"back"}');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"select","value":16}');
});

test('offers the possible starting states before a behavior has been chosen', async ({ page }) => {
  await render(page, { phase: 'exploring', mode: 'explore', choices: [{ label: 'count = 0' }, { label: 'count = 1' }] });
  await expect(page.getByRole('heading', { name: 'Choose a starting state' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose count = 1' }).click();
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"choose","value":1}');
});

test('a completed check explains the bounds of its conclusion', async ({ page }) => {
  await render(page, { phase: 'complete', mode: 'check', result: { status: 'complete' } });
  await expect(page.getByRole('heading', { name: 'No violation found in this model' })).toBeVisible();
  await expect(page.getByText(/does not prove correctness for larger bounds/)).toBeVisible();
  await expect(page.getByText(/this specification, its configuration, and the selected properties/)).toBeVisible();
});

test('a shortened trace does not present its last visible state as the end of the counterexample', async ({ page }) => {
  const state = exampleState();
  state.result.traceTruncated = true;
  state.result.outputTruncated = true;
  await render(page, state);
  await expect(page.getByText(/Only the first 2 states are shown/)).toBeVisible();
  await expect(page.getByText(/violating state or repeating cycle may lie beyond/)).toBeVisible();
  await expect(page.getByText(/Repeating behavior: after/)).toBeHidden();
  await page.getByText('Tool output', { exact: true }).click();
  await expect(page.getByText(/tool output was shortened/)).toBeVisible();
});

test('keeps old results visible but prevents using them after source changes', async ({ page }) => {
  await render(page, exampleState({ mode: 'explore', choices: [{ label: 'Enter(p2)' }] }));
  await page.evaluate(() => window.workspaceView.markStale());
  await expect(page.getByText(/results describe an earlier version/)).toBeVisible();
  await expect(page.getByRole('row', { name: /inside/ })).toContainText('{p1}');
  await expect(page.getByRole('button', { name: 'Choose Enter(p2)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Show this step in the source' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Check every reachable state' })).toBeEnabled();
});

test('keeps cancellation available while a check is running', async ({ page }) => {
  await render(page, { phase: 'checking', mode: 'check', message: 'Checking the configured model…' });
  await expect(page.getByRole('button', { name: 'Check every reachable state' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Explore one behavior' })).toBeDisabled();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"stop"}');
});

for (const name of ['Check every reachable state', 'Explore one behavior', 'Check syntax / translate PlusCal']) {
  test(`restores keyboard focus to ${name} after its asynchronous operation`, async ({ page }) => {
    await page.evaluate(() => {
      window.workspaceView.destroy();
      const start = () => window.workspaceView.render({ phase: 'loading', mode: 'check' });
      window.workspaceView = window.SEBookTLAView.mount(document.getElementById('workspace'), {
        onCheck: start, onExplore: start, onParse: start
      });
    });
    const action = page.getByRole('button', { name, exact: true });
    await action.focus();
    await page.keyboard.press('Enter');
    await expect(action).toBeDisabled();
    await render(page, { phase: 'checking', mode: 'check' });
    await render(page, { phase: 'complete', mode: 'check', result: { status: 'complete' } });
    await expect(action).toBeFocused();
  });
}

test('finishing a check does not reclaim focus after the learner moves to the editor', async ({ page }) => {
  await page.evaluate(() => {
    const label = document.createElement('label');
    label.textContent = 'Source editor';
    label.append(document.createElement('textarea'));
    document.querySelector('main').append(label);
  });
  const action = page.getByRole('button', { name: 'Check every reachable state', exact: true });
  const editor = page.getByLabel('Source editor');
  await action.focus();
  await page.keyboard.press('Enter');
  await render(page, { phase: 'checking', mode: 'check' });
  await editor.focus();
  await render(page, { phase: 'working', mode: 'check' });
  await expect(editor).toBeFocused();
  // Losing editor focus later must not revive an earlier button-focus request.
  await editor.evaluate(node => node.blur());
  await render(page, { phase: 'complete', mode: 'check', result: { status: 'complete' } });
  await expect(action).not.toBeFocused();
});

test('evaluates a named operator and preserves it when an error arrives', async ({ page }) => {
  const state = exampleState();
  await render(page, state);
  await page.getByText('Watch an operator', { exact: true }).click();
  const input = page.getByLabel('Operator name');
  await input.fill('TypeOK');
  await input.press('Enter');
  await expect(page.getByLabel('Last workspace action')).toHaveText('{"action":"evaluate","value":"TypeOK"}');
  await render(page, { ...state, evaluation: { error: 'Unknown operator: TypeOK' } });
  await expect(input).toHaveValue('TypeOK');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Unknown operator: TypeOK', { exact: true })).toBeVisible();
});

test('reports exploration errors as errors and treats source values as plain text', async ({ page }) => {
  const state = exampleState({ mode: 'explore' });
  state.result.status = 'error';
  state.result.trace[1].variables[0].value = '<script>throw new Error("not markup")</script>';
  await render(page, state);
  await expect(page.getByRole('heading', { name: 'The model could not be checked' })).toBeVisible();
  await expect(page.getByRole('row', { name: /inside/ })).toContainText('<script>throw new Error("not markup")</script>');
});

for (const theme of ['light', 'dark']) {
  test(`${theme} workspace stays readable and accessible at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), theme === 'dark');
    await render(page, exampleState());
    await a11yCheckpoint(page, `tla-${theme}-narrow`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bodyCell = page.getByRole('rowheader', { name: /limit.*Unchanged/ });
    expect(await bodyCell.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await page.addStyleTag({ content: '.tla-workspace { line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important; } .tla-workspace p { margin-bottom:2em !important; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Check every reachable state' })).toBeVisible();
  });
}

test('prints light colors even when the screen is in dark mode', async ({ page }) => {
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await render(page, exampleState());
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('region', { name: 'Model checking and exploration' })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('region', { name: 'Model checking and exploration' })).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.getByRole('table')).toBeVisible();
});
