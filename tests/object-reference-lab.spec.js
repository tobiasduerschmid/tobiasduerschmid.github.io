// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint, auditInteractiveState } = require('./a11y-helpers');

const CHAPTER = '/SEBook/tools/python.html';
const TRACE_TIMEOUT = 120_000; // A cold browser loads the local Python WebAssembly runtime.
const labs = page => page.getByRole('region', { name: /^Object reference lab:/ });
const button = (lab, name) => lab.getByRole('button', { name, exact: true });

async function openLab(page) {
  await page.goto(CHAPTER);
  const lab = labs(page).first();
  await expect(button(lab, 'Forward')).toBeEnabled();
  return lab;
}

async function openEditor(lab) {
  const editor = lab.getByRole('textbox', { name: 'Python code', exact: true });
  if (!await editor.isVisible()) await lab.getByText('Edit Python code', { exact: true }).click();
  await expect(editor).toBeVisible();
  return editor;
}

async function traceCode(lab, code) {
  await (await openEditor(lab)).fill(code);
  await expect(button(lab, 'Forward')).toBeDisabled();
  await button(lab, 'Trace Python').click();
  await expect(button(lab, 'Forward')).toBeEnabled({ timeout: TRACE_TIMEOUT });
  await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
}

async function advanceToEnd(lab) {
  const forward = button(lab, 'Forward');
  // Drive a bounded user journey; all terminal assertions remain unconditional.
  for (let step = 0; step < 100 && await forward.isEnabled(); step += 1) {
    await forward.click();
  }
  await expect(forward, 'short programs must reach the final trace state').toBeDisabled();
}

async function advanceToLine(lab, line) {
  const nextLine = new RegExp('Next: line ' + line + '(?:\\D|$)');
  const status = lab.getByRole('status');
  for (let step = 0; step < 100 && !nextLine.test(await status.innerText()); step += 1) {
    await button(lab, 'Forward').click();
  }
  await expect(status).toContainText(nextLine);
}

async function openReferenceDetails(lab) {
  await lab.getByText('Reference details', { exact: true }).click();
  // orl-details is the documented text-snapshot styling hook shared by the
  // controller and css/object-reference-lab.css; controls use accessible locators.
  const details = lab.locator('.orl-details');
  await expect(details).toBeVisible();
  return details;
}

function referencedObject(text, name) {
  const match = text.match(new RegExp('\\b' + name + '\\s*→\\s*(o\\d+)\\b'));
  expect(match, `${name} must have an explicit object-reference target`).not.toBeNull();
  return match[1];
}

test.describe('Python object reference lab', () => {
  test('chapter examples show editable code with independent prepared traces', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const first = await openLab(page);
    await expect(labs(page)).toHaveCount(8);
    const editors = labs(page).getByRole('textbox', { name: 'Python code', exact: true });
    await expect(editors, 'each chapter example exposes its editor immediately').toHaveCount(8);
    for (const editor of await editors.all()) await expect(editor).toBeVisible();
    const second = labs(page).nth(1);
    await expect(first.getByRole('status')).toContainText(/Step 1 of \d+/);
    await expect(second.getByRole('status')).toContainText(/Step 1 of \d+/);

    await button(first, 'Forward').click();
    await expect(first.getByRole('status')).toContainText(/Step 2 of \d+/);
    await expect(button(first, 'Back')).toBeEnabled();
    await expect(second.getByRole('status')).toContainText(/Step 1 of \d+/);
    await expect(button(second, 'Back')).toBeDisabled();

    await a11yCheckpoint(page, 'object-reference-lab: first statement', {
      feature: 'object-reference-lab', include: '.object-reference-lab'
    });
    expect(pageErrors, 'object reference examples must render without JavaScript errors').toEqual([]);
  });

  test('edited Python shows aliasing, mutation, rebinding, and reversible output', async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT + 30_000);
    const lab = await openLab(page);
    await traceCode(lab, [
      'items = [3]',
      'alias = items',
      'items.append(5)',
      'items = [8]',
      'print(alias, items)'
    ].join('\n'));
    await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toBeVisible();
    const details = await openReferenceDetails(lab);

    await advanceToLine(lab, 3);
    await expect(details).toContainText(/alias\s*→\s*o\d+/);
    const shared = await details.innerText();
    expect(referencedObject(shared, 'items')).toBe(referencedObject(shared, 'alias'));

    await advanceToLine(lab, 4);
    const mutated = await details.innerText();
    expect(referencedObject(mutated, 'items')).toBe(referencedObject(shared, 'items'));
    expect(referencedObject(mutated, 'alias')).toBe(referencedObject(shared, 'items'));
    const appendedEntry = mutated.match(new RegExp('^' + referencedObject(shared, 'items')
      + ' · list;[^\\n]*\\[1\\] → (o\\d+)', 'm'));
    expect(appendedEntry, 'mutation adds index 1 to the shared list').not.toBeNull();
    await expect(details).toContainText(new RegExp(appendedEntry[1] + ' · int; 5(?:\\n|$)'));

    await advanceToLine(lab, 5);
    const rebound = await details.innerText();
    expect(referencedObject(rebound, 'items')).not.toBe(referencedObject(rebound, 'alias'));
    expect(referencedObject(rebound, 'alias')).toBe(referencedObject(shared, 'alias'));

    await advanceToEnd(lab);
    await expect(lab.getByLabel('Program output', { exact: true })).toHaveText('[3, 5] [8]');
    await button(lab, 'Back').click();
    await expect(lab.getByLabel('Program output', { exact: true })).not.toContainText('[3, 5] [8]');
    await button(lab, 'Back').click();
    const restored = await details.innerText();
    expect(referencedObject(restored, 'items')).toBe(referencedObject(restored, 'alias'));
    await button(lab, 'Forward').click();
    await advanceToEnd(lab);
    await expect(lab.getByLabel('Program output', { exact: true })).toHaveText('[3, 5] [8]');

    await button(lab, 'Reset example').click();
    await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toBeVisible();
  });

  test('editing invalidates a trace and resetting restores the original example', async ({ page }) => {
    const lab = await openLab(page);
    const editor = await openEditor(lab);
    const original = await editor.inputValue();
    await button(lab, 'Forward').click();
    await editor.fill('different = [91]');
    await expect(button(lab, 'Forward')).toBeDisabled();
    await expect(button(lab, 'Back')).toBeDisabled();
    await expect(button(lab, 'Play')).toBeDisabled();

    await button(lab, 'Reset example').click();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue(original);
    await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
    await expect(button(lab, 'Forward')).toBeEnabled();
  });

  test('a suggested change stays visible while its answer is revealed separately and reset', async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT + 30_000);
    const lab = await openLab(page);
    const examples = await (await page.request.get('/assets/object-reference-labs.json')).json();
    const example = examples.shared_slots;
    // Authored strings are inputs to this display contract, not an oracle for
    // Python behavior. Content/output accuracy is covered by the trace journeys.
    expect(example.variation, 'the authored example supplies a change to predict').toBeTruthy();
    expect(example.variation_explanation, 'the suggested change supplies feedback').toBeTruthy();
    const screen = lab.locator('.orl-screen');
    const prompt = screen.getByText(example.variation, { exact: true });
    const answer = screen.getByText(example.variation_explanation, { exact: true });
    const reveal = screen.getByText('Check the suggested change', { exact: true });
    await expect(prompt).toBeVisible();
    await expect(answer).toBeHidden();
    await screen.getByText('Explain the prepared example', { exact: true }).click();
    await expect(answer, 'prepared-example feedback must not reveal the variation answer').toBeHidden();

    await (await openEditor(lab)).fill('unrelated = [9]\nprint(unrelated)');
    await expect(prompt, 'editing must not remove the suggested change').toBeVisible();
    await expect(screen.getByText('Explain the prepared example', { exact: true })).toBeHidden();
    await reveal.focus();
    await page.keyboard.press('Enter');
    await expect(answer).toBeVisible();
    await expect(reveal).toBeFocused();
    await expect(reveal).not.toHaveCSS('outline-style', 'none');
    await page.keyboard.press('Enter');
    await expect(answer).toBeHidden();
    await reveal.click();
    await button(lab, 'Reset example').click();
    await expect(prompt).toBeVisible();
    await expect(answer, 'reset returns the suggested-change feedback to its closed state').toBeHidden();

    await page.emulateMedia({ media: 'print' });
    const history = lab.locator('.orl-print');
    await expect(history).toContainText(example.variation);
    await expect(history).toContainText(example.variation_explanation);
    await page.emulateMedia({ media: 'screen' });
    await traceCode(lab, 'unrelated = [9]\nprint(unrelated)');
    await advanceToEnd(lab);
    await page.emulateMedia({ media: 'print' });
    await expect(history).toContainText('Output:\n[9]');
    await expect(history, 'prepared guidance must not describe arbitrary edited code').not.toContainText(example.variation);
    await expect(history).not.toContainText(example.variation_explanation);
  });

  test('an inline example without optional variation fields still mounts', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/assets/object-reference-labs.json');
    // Exercise the documented inline-JSON entry point with only required fields.
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
      <title>Minimal object-reference example</title></head><body><main>
      <div data-object-reference-lab data-object-reference-editor="inline">
      <script type="application/json">{"title":"Minimal example","code":"items = [1]"}</script>
      </div></main></body></html>`);
    await page.addScriptTag({ url: '/js/object-reference-graph.js' });
    await page.addScriptTag({ url: '/js/object-reference-print.js' });
    await page.addScriptTag({ url: '/js/object-reference-lab.js' });
    const lab = page.getByRole('region', { name: 'Object reference lab: Minimal example', exact: true });
    await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toHaveValue('items = [1]');
    await expect(button(lab, 'Trace Python')).toBeEnabled();
    await expect(lab.getByText('Try one change', { exact: true })).toHaveCount(0);
    await expect(lab.getByText('Check the suggested change', { exact: true })).toHaveCount(0);
    await expect(lab.getByRole('alert')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('nested calls show caller, receiver, and helper bindings and can be revisited', async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT + 30_000);
    const lab = await openLab(page);
    // Exercise nested caller/receiver/helper scopes independently of the
    // examples currently selected for the chapter's teaching sequence.
    await traceCode(lab, [
      'def add(folder, name):',
      '    folder.files.append(name)',
      '',
      'class Folder:',
      '    def __init__(self):',
      '        self.files = []',
      '',
      '    def replace(self):',
      '        add(self, "draft")',
      '        self = Folder()',
      '        add(self, "final")',
      '        return self',
      '',
      'work = Folder()',
      'saved = work.files',
      'published = work.replace()',
      'saved.append("notes")',
      'print(work.files)',
      'print(published.files)'
    ].join('\n'));
    const details = await openReferenceDetails(lab);
    for (let step = 0; step < 100 && !/^add: /m.test(await details.innerText()); step += 1) {
      await button(lab, 'Forward').click();
    }
    await expect(details).toContainText(/^add: /m);
    await expect(details).toContainText(/^replace: /m);
    const nested = await details.innerText();
    expect(referencedObject(nested, 'folder')).toBe(referencedObject(nested, 'work'));
    expect(referencedObject(nested, 'self')).toBe(referencedObject(nested, 'work'));

    await button(lab, 'Back').click();
    await button(lab, 'Forward').click();
    await expect(details).toHaveText(nested, { useInnerText: true });
    await advanceToEnd(lab);
    await expect(lab.getByLabel('Program output', { exact: true }))
      .toHaveText("['draft', 'notes']\n['final']");
    const finished = await details.innerText();
    expect(referencedObject(finished, 'published')).not.toBe(referencedObject(finished, 'work'));
    expect(referencedObject(finished, 'saved')).toBe(referencedObject(nested, 'saved'));
    await expect(details).not.toContainText(/^replace: /m);
    await expect(details).not.toContainText(/^add: /m);
    const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
    await expect(diagram).not.toContainText('Global names');
    await expect(diagram).not.toContainText('function');
  });

  test('primitive values stay in place without separate object cards', async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT + 30_000);
    const lab = await openLab(page);
    await traceCode(lab, 'destination = "Oslo"\nqueued = destination + " via Paris"\ndestination = "Rome"');
    await advanceToEnd(lab);
    const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
    await expect(diagram).toContainText("'Oslo via Paris'");
    await expect(diagram).toContainText("'Rome'");
    await expect(diagram.locator('.orl-object')).toHaveCount(0);
  });

  test('every list slot has a routed arrow to its object after replacement and resize', async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT + 30_000);
    const lab = await openLab(page);
    await traceCode(lab, 'samples = [12]\nchannels = [samples, samples]\nsamples.append(18)\nchannels[0] = [99]\nprint(channels)');
    await advanceToEnd(lab);
    const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });

    for (const width of [1100, 320]) {
      await page.setViewportSize({ width, height: 800 });
      // Connector coverage and measured endpoints are the visual contract;
      // the test deliberately does not prescribe a particular lane or bend.
      await expect.poll(() => diagram.evaluate(region => {
        const buttons = [...region.querySelectorAll('[data-reference-target]')];
        const paths = [...region.querySelectorAll('.orl-reference-edge')];
        if (buttons.length !== 2 || paths.length !== buttons.length) return false;
        const cards = [...region.querySelectorAll('.orl-object-row')].map(row => ({
          id: row.dataset.objectId, rect: row.querySelector('.orl-object').getBoundingClientRect()
        }));
        return buttons.every(button => {
          const path = paths.find(candidate => candidate.dataset.referenceId === button.dataset.referenceId);
          if (!path || path.dataset.targetObject !== button.dataset.referenceTarget) return false;
          const target = cards.find(card => card.id === button.dataset.referenceTarget).rect;
          const source = button.getBoundingClientRect();
          const matrix = path.getScreenCTM();
          const length = path.getTotalLength();
          const first = path.getPointAtLength(0).matrixTransform(matrix);
          const last = path.getPointAtLength(length).matrixTransform(matrix);
          if (Math.abs(first.x - source.right) > 2 || Math.abs(first.y - (source.top + source.height / 2)) > 2
              || Math.abs(last.x - target.right - 2) > 2 || last.y < target.top || last.y > target.bottom) return false;
          for (let distance = 0; distance <= length; distance += 2) {
            const point = path.getPointAtLength(distance).matrixTransform(matrix);
            if (cards.some(card => card.id !== path.dataset.sourceObject && card.id !== path.dataset.targetObject
                && point.x > card.rect.left + 1 && point.x < card.rect.right - 1
                && point.y > card.rect.top + 1 && point.y < card.rect.bottom - 1)) return false;
          }
          return true;
        });
      })).toBe(true);
    }
    const reference = diagram.getByRole('button', { name: /^Follow \[0\] to o\d+: list$/ });
    const identity = (await reference.getAttribute('aria-label')).match(/to (o\d+):/)[1];
    await reference.focus();
    await page.keyboard.press('Enter');
    await expect(diagram.getByRole('region', { name: identity + ': list', exact: true })).toBeFocused();
    await auditInteractiveState(page, 'object-reference-lab: routed member references', { include: '.object-reference-lab' });
  });

  for (const example of [
    { name: 'syntax', code: 'items = [', error: /SyntaxError/ },
    { name: 'runtime', code: 'items = [3]\nprint(1 / 0)', error: /ZeroDivisionError/ }
  ]) {
    test(`${example.name} errors explain the failure and allow another trace`, async ({ page }) => {
      test.setTimeout(TRACE_TIMEOUT + 30_000);
      const lab = await openLab(page);
      await (await openEditor(lab)).fill(example.code);
      await button(lab, 'Trace Python').click();
      await expect(lab.getByRole('alert')).toContainText(example.error, { timeout: TRACE_TIMEOUT });
      await expect(button(lab, 'Stop')).toBeDisabled();

      await traceCode(lab, 'fixed = [7]\nprint(fixed)');
      await advanceToEnd(lab);
      await expect(lab.getByLabel('Program output', { exact: true })).toHaveText('[7]');
      await expect(lab.getByRole('alert')).toBeHidden();
    });
  }

  test('Stop cancels running Python and the next run starts cleanly', async ({ page }) => {
    test.setTimeout(TRACE_TIMEOUT + 30_000);
    const lab = await openLab(page);
    await traceCode(lab, 'ready = [1]');
    await (await openEditor(lab)).fill('total = sum(range(10**12))');
    await button(lab, 'Trace Python').click();
    await expect(button(lab, 'Stop')).toBeEnabled();
    await expect(lab.getByRole('status')).toContainText('Recording execution', { timeout: TRACE_TIMEOUT });
    await button(lab, 'Stop').click();
    await expect(lab.getByRole('status')).toContainText(/stop|cancel/i);
    await expect(button(lab, 'Stop')).toBeDisabled();

    await traceCode(lab, 'result = [6]\nprint(result)');
    await advanceToEnd(lab);
    await expect(lab.getByLabel('Program output', { exact: true })).toHaveText('[6]');
  });

  test('native controls support keyboard stepping without losing focus', async ({ page }) => {
    const lab = await openLab(page);
    const forward = button(lab, 'Forward');
    await forward.focus();
    await page.keyboard.press('Enter');
    await expect(lab.getByRole('status')).toContainText(/Step 2 of \d+/);
    await expect(forward).toBeFocused();
    await expect(forward).not.toHaveCSS('outline-style', 'none');

    const back = button(lab, 'Back');
    await back.focus();
    await page.keyboard.press('Space');
    await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
    await expect(back).toBeDisabled();
  });

  test('Play advances the trace and Pause holds the displayed state', async ({ page }) => {
    const lab = await openLab(page);
    await page.clock.install();
    await button(lab, 'Play').click();
    await expect(button(lab, 'Pause')).toBeVisible();
    await page.clock.fastForward(60_000);
    await expect(lab.getByRole('status')).not.toContainText(/Step 1 of \d+/);

    await button(lab, 'Pause').click();
    const pausedState = await lab.getByRole('status').innerText();
    await page.clock.fastForward(60_000);
    await expect(lab.getByRole('status')).toHaveText(pausedState);
    await expect(button(lab, 'Play')).toBeVisible();
  });

  test('reference controls and populated diagrams pass light and dark accessibility checks', async ({ page }) => {
    const lab = await openLab(page);
    await button(lab, 'Forward').click();
    await button(lab, 'Forward').click();
    await openReferenceDetails(lab);
    await auditInteractiveState(page, 'object-reference-lab: visible references', {
      include: '.object-reference-lab'
    });
  });

  test('at 320 pixels the compact diagram fits and its text remains readable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const lab = await openLab(page);
    await button(lab, 'Forward').click();
    await openReferenceDetails(lab);
    const dimensions = await lab.evaluate(element => {
      const graph = element.querySelector('.orl-graph-scroll');
      const editor = element.querySelector('textarea');
      return {
        viewport: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        width: element.getBoundingClientRect().width,
        graphWidth: graph.clientWidth,
        diagramWidth: graph.scrollWidth,
        editorFont: parseFloat(getComputedStyle(editor).fontSize),
        paragraphFont: parseFloat(getComputedStyle(element.querySelector('p')).fontSize)
      };
    });
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.diagramWidth).toBeLessThanOrEqual(dimensions.graphWidth + 1);
    expect(dimensions.editorFont).toBeGreaterThanOrEqual(dimensions.paragraphFont);
    await expect(lab.getByRole('list', { name: 'Recorded Python source', exact: true })).toHaveAttribute('tabindex', '0');
  });

  test('reduced motion keeps manual stepping available with no CSS animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const lab = await openLab(page);
    await button(lab, 'Forward').click();
    await expect(lab.getByRole('status')).toContainText(/Step 2 of \d+/);
    await expect(button(lab, 'Forward')).toHaveCSS('transition-duration', '0s');
    await expect(lab.getByRole('region', { name: 'Object reference diagram', exact: true }).locator('.orl-graph'))
      .toHaveCSS('animation-name', 'none');
    await expect(button(lab, 'Back')).toBeEnabled();
  });

  test('printing includes a reference visualization for every visible step from a dark-mode session', async ({ page }) => {
    const lab = await openLab(page);
    const stepCount = Number((await lab.getByRole('status').innerText()).match(/of (\d+)/)[1]);
    await button(lab, 'Forward').click();
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await page.emulateMedia({ media: 'print' });
    // The print/screen hooks are the component's explicit media contract.
    const history = lab.locator('.orl-print');
    await expect(history).toBeVisible();
    await expect(lab.locator('.orl-screen')).toBeHidden();
    await expect(history).toContainText(/Step 1/);
    await expect(history.getByText(/^Step \d+:/)).toHaveCount(stepCount);
    await expect(history.getByRole('img')).toHaveCount(stepCount);
    await expect(history.locator('.orl-object').first()).toBeVisible();
    await expect(history.locator('.orl-reference-edge').first()).toBeVisible();
    await expect(history).toContainText('End of execution');
    await expect(history).toContainText(/→/);
    await expect(lab).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(lab).toHaveCSS('color', 'rgb(17, 17, 17)');
  });
});
