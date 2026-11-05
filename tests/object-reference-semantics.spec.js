// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test('one renderer distinguishes owned values, aliases, and individual pointer slots in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/assets/object-reference-labs.json');
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>Binding comparison</title><link rel="stylesheet" href="/css/object-reference-lab.css"></head>
    <body><main><h1>Binding comparison</h1>
    <div class="object-reference-lab" role="region" aria-label="Binding comparison">
      <div class="orl-graph-scroll"><div class="orl-graph"></div></div><pre id="description" class="orl-reference-text"></pre>
    </div></main></body></html>`);
  await page.addScriptTag({ url: '/js/object-reference-graph.js' });
  await page.evaluate(async () => {
    // A producer-defined type called "function" must not inherit Python's
    // incidental-object policy. These are public renderer input snapshots.
    const state = {
      scopes: [{ id: 'global', name: 'Names', bindings: [
        { name: 'original', target: 's1', semantics: 'value' },
        { name: 'borrowed', target: 's1', semantics: 'reference' },
        { name: 'pointer', target: 's1', semantics: 'object-reference' },
        { name: 'copy', target: 's2', semantics: 'value' }
      ] }],
      objects: [
        { id: 's1', type: 'function', value: '7', entries: [{ label: 'count', value: '3', semantics: 'value' }] },
        { id: 's2', type: 'function', value: '7' },
        { id: 'incidental', type: 'bookkeeping', hidden: true }
      ]
    };
    const graph = new window.ObjectReferenceGraph.ReferenceGraph(document.querySelector('.orl-graph'));
    await graph.render({ ...state, scopes: state.scopes.map(scope => ({ ...scope,
      bindings: scope.bindings.filter(binding => binding.name !== 'borrowed')
    })) });
    await graph.render(state);
    document.getElementById('description').textContent = window.ObjectReferenceGraph.describeState(state);
  });
  const fixture = page.getByRole('region', { name: 'Binding comparison', exact: true });
  const shared = fixture.getByRole('region', { name: 's1: function', exact: true });
  await expect(shared.getByText('original', { exact: true })).toBeVisible();
  await expect(shared.getByText('borrowed', { exact: true })).toBeVisible();
  await expect(shared.getByText('count', { exact: true })).toBeVisible();
  await expect(shared.getByText('3', { exact: true })).toBeVisible();
  await expect(fixture.getByRole('region', { name: 's2: function', exact: true }).getByText('copy', { exact: true })).toBeVisible();
  await expect(fixture.getByRole('region', { name: 'incidental: bookkeeping' })).toHaveCount(0);
  await expect(fixture.getByText(/original occupies s1; borrowed aliases s1; pointer → s1; copy occupies s2/)).toBeVisible();

  async function checkAddedAliasCue() {
    // The alias is new while its object is unchanged. Its drawing hook lets us
    // verify the visible outline independently of the object's change badge.
    const alias = shared.locator('.orl-direct-binding').filter({ hasText: 'borrowed' });
    expect(await alias.ariaSnapshot()).toContain('Added binding.');
    await expect.poll(() => alias.evaluate(node => {
      const style = getComputedStyle(node);
      const background = getComputedStyle(node.closest('.orl-object')).backgroundColor;
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(channel => {
          const value = Number(channel) / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(style.outlineColor), surface = luminance(background);
      const contrast = (Math.max(foreground, surface) + 0.05) / (Math.min(foreground, surface) + 0.05);
      return parseFloat(style.outlineWidth) >= 1 && style.outlineStyle !== 'none' && contrast >= 3;
    }), { message: 'a newly added alias has a discernible outline in this theme' }).toBe(true);
  }

  async function checkPointerGeometry() {
    // These documented drawing hooks identify the painted glyphs; assertions
    // concern visible boxes and arrow attachment, never chosen routing lanes.
    await expect.poll(() => fixture.evaluate(root => {
      const slots = [...root.querySelectorAll('.orl-name-slot')];
      const paths = [...root.querySelectorAll('.orl-binding-edge')];
      if (slots.length !== 1 || paths.length !== 1) return false;
      const slot = slots[0].getBoundingClientRect();
      const path = paths[0];
      const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
      const style = getComputedStyle(slots[0]);
      return slot.width > 0 && slot.height > 0 && parseFloat(style.borderWidth) >= 1
        && Math.abs(start.x - slot.right) < 1 && Math.abs(start.y - (slot.top + slot.height / 2)) < 1;
    }), { message: 'only the indirect binding has a boxed, connected pointer origin' }).toBe(true);
  }
  await checkPointerGeometry();
  await checkAddedAliasCue();
  await page.setViewportSize({ width: 320, height: 720 });
  await checkPointerGeometry();
  await a11yCheckpoint(page, 'value-reference-pointer-comparison', { feature: 'object-reference-semantics' });
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await checkPointerGeometry();
  await checkAddedAliasCue();
});

async function finishReplay(lab) {
  const next = lab.getByRole('button', { name: 'Forward', exact: true });
  await expect(next).toBeEnabled();
  // This is bounded navigation through user-visible recorded states. The final
  // status/output below are the oracle; exhausting a cap is never success.
  for (let step = 0; step < 100 && await next.isEnabled(); step++) await next.click();
  await expect(lab.getByRole('status')).toContainText('End of execution');
}

test('editing a C++ parameter recompiles its trace and restoring recovers the prepared program', async ({ page }) => {
  test.setTimeout(240000); // Cold local compiler startup is part of this real-runtime journey.
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/cpp-parameter-passing-lab.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: A value parameter gets a copy', exact: true });
  const editor = lab.getByRole('textbox', { name: 'C++ code', exact: true });
  await finishReplay(lab);
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('draft\n');
  const original = await editor.inputValue();
  await editor.fill(original.replace('std::string label', 'std::string& label'));
  await expect(lab.getByRole('status')).toContainText('End of execution', { timeout: 180000 });
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('replacement\n');
  await editor.fill(original.replace('std::string label', 'const std::string& label'));
  await expect(lab.getByRole('alert')).toBeVisible({ timeout: 90000 });
  await expect(lab.getByRole('status')).toContainText('Could not update');
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('replacement\n');
  await a11yCheckpoint(page, 'cpp-compile-error', { feature: 'object-reference-semantics', include: '.object-reference-lab' });
  await lab.getByRole('button', { name: 'Restore original code', exact: true }).click();
  await expect(editor).toHaveValue(original);
  await finishReplay(lab);
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('draft\n');
  expect(errors).toEqual([]);
});

test('the C++ lab prints language-correct source and storage descriptions alongside Python', async ({ page }) => {
  await page.goto('/SEBook/tools/cpp-parameter-passing-lab.html');
  const referenceLab = page.getByRole('region', { name: 'Object reference lab: A reference parameter aliases caller storage', exact: true });
  await expect(referenceLab.getByRole('textbox', { name: 'C++ code', exact: true })).toBeVisible();
  // Advance through main entry and initialization to decorate's entry. The
  // highlighted-source hook is documented in docs/object-reference-layout.md.
  for (let step = 0; step < 3; step++) await referenceLab.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(referenceLab.getByRole('status').or(referenceLab.locator('.orl-source-line.is-current'))).toHaveText([
    /Entering a scope · Line 4$/,
    'void decorate(std::string& label) {'
  ]);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.ObjectReferencePrint.prepareAll());
  await expect(referenceLab.getByRole('paragraph').filter({ hasText: /^C\+\+ code$/ })).toBeVisible();
  await expect(referenceLab.getByRole('img', { name: /original occupies (\w+)[\s\S]*label aliases \1/ }).first()).toBeVisible();
  await expect(referenceLab.getByText('Python code', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('paragraph').filter({ hasText: /^Python code$/ })).toBeVisible();
  await a11yCheckpoint(page, 'parameter-lab-print', { feature: 'object-reference-semantics', darkMode: false });
});
