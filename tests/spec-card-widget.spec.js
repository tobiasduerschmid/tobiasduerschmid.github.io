// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: Spec Card widget (`_includes/spec-card-form.html`).
 *
 * The widget is the new fillable artifact behind the Playwright tutorial's
 * Step 2 Spec Card concept. It auto-saves to `localStorage` under
 * `spec-card-<id>`, exports as Markdown, and reset-clears the entry.
 *
 * Verifies behavior, not implementation:
 *  - All five labeled fields render as semantic form controls.
 *  - Typing into a field is persisted (round-trip across reload).
 *  - Reset clears the form AND the localStorage entry.
 *  - Status pill reports the right state.
 *  - Two card ids stored separately don't collide.
 *  - Light + dark mode both render legibly.
 */

const TOOL_URL = '/SEBook/tools/spec-card';

const FIELDS = ['behavior', 'should_pass_when', 'should_fail_when', 'locator_contract', 'oracle'];

async function clearSpecCardKeys(page) {
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('spec-card-') === 0) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  });
}

test.describe('Spec Card widget — structure & accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOL_URL);
    await clearSpecCardKeys(page);
    await page.reload();
  });

  test('all five labeled fields render as form controls', async ({ page }) => {
    const widget = page.getByRole('region', { name: /spec card/i }).first();
    await expect(widget).toBeVisible();

    // Every field has a programmatic label.
    await expect(widget.getByLabel(/behavior/i)).toBeVisible();
    await expect(widget.getByLabel(/should pass when/i)).toBeVisible();
    await expect(widget.getByLabel(/should fail when/i)).toBeVisible();
    await expect(widget.getByLabel(/locator contract/i)).toBeVisible();
    await expect(widget.getByLabel(/oracle/i)).toBeVisible();
  });

  test('starts in the "Empty" state', async ({ page }) => {
    const status = page.locator('[data-spec-card-status]').first();
    await expect(status).toHaveText(/empty/i);
    await expect(status).toHaveAttribute('data-state', 'empty');
  });

  test('action buttons are present and have semantic names', async ({ page }) => {
    const widget = page.getByRole('region', { name: /spec card/i }).first();
    await expect(widget.getByRole('button', { name: /export/i })).toBeVisible();
    await expect(widget.getByRole('button', { name: /copy/i })).toBeVisible();
    await expect(widget.getByRole('button', { name: /reset/i })).toBeVisible();
  });
});

test.describe('Spec Card widget — persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TOOL_URL);
    await clearSpecCardKeys(page);
    await page.reload();
  });

  test('typing into Behavior is persisted across reload', async ({ page }) => {
    const widget = page.getByRole('region', { name: /spec card/i }).first();
    await widget.getByLabel(/behavior/i).fill('User can add a todo');

    // Status flips to "Saved" after the debounced auto-save.
    await expect(page.locator('[data-spec-card-status]').first())
      .toHaveAttribute('data-state', 'saved', { timeout: 2_000 });

    await page.reload();

    // After reload, the same field still holds the value, and status is "Saved".
    const widgetAfter = page.getByRole('region', { name: /spec card/i }).first();
    await expect(widgetAfter.getByLabel(/behavior/i)).toHaveValue('User can add a todo');
    await expect(page.locator('[data-spec-card-status]').first()).toHaveText(/saved/i);
  });

  test('all five fields round-trip through localStorage', async ({ page }) => {
    const widget = page.getByRole('region', { name: /spec card/i }).first();
    const values = {
      behavior: 'User can sign in',
      should_pass_when: 'CSS rename, button restyle',
      should_fail_when: 'Wrong password silently accepted',
      locator_contract: 'Email + password textboxes; Sign in button',
      oracle: 'User lands on /dashboard',
    };

    await widget.getByLabel(/^✓ behavior$/i).fill(values.behavior);
    await widget.getByLabel(/should pass when/i).fill(values.should_pass_when);
    await widget.getByLabel(/should fail when/i).fill(values.should_fail_when);
    await widget.getByLabel(/locator contract/i).fill(values.locator_contract);
    await widget.getByLabel(/oracle/i).fill(values.oracle);

    await expect(page.locator('[data-spec-card-status]').first())
      .toHaveAttribute('data-state', 'saved', { timeout: 2_000 });

    // Inspect the persisted JSON shape directly.
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('spec-card-default');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored).toMatchObject(values);
  });

  test('reset clears all fields AND removes the localStorage key', async ({ page }) => {
    const widget = page.getByRole('region', { name: /spec card/i }).first();
    await widget.getByLabel(/behavior/i).fill('to-be-cleared');

    // Auto-confirm the "are you sure" prompt before the reset click.
    page.on('dialog', (dialog) => dialog.accept());
    await widget.getByRole('button', { name: /reset/i }).click();

    await expect(widget.getByLabel(/behavior/i)).toHaveValue('');
    await expect(page.locator('[data-spec-card-status]').first()).toHaveText(/empty/i);

    const stored = await page.evaluate(() => localStorage.getItem('spec-card-default'));
    expect(stored).toBeNull();
  });

  test('two cards with different ids persist independently', async ({ page }) => {
    // Programmatically write a second card under a different id, then verify
    // both keys coexist and the default-id widget only renders the default.
    await page.evaluate(() => {
      localStorage.setItem(
        'spec-card-other',
        JSON.stringify({
          behavior: 'Other card behavior',
          should_pass_when: '',
          should_fail_when: '',
          locator_contract: '',
          oracle: '',
        })
      );
    });

    const widget = page.getByRole('region', { name: /spec card/i }).first();
    await widget.getByLabel(/behavior/i).fill('Default card behavior');

    await expect(page.locator('[data-spec-card-status]').first())
      .toHaveAttribute('data-state', 'saved', { timeout: 2_000 });

    const both = await page.evaluate(() => ({
      def: JSON.parse(localStorage.getItem('spec-card-default') || 'null'),
      other: JSON.parse(localStorage.getItem('spec-card-other') || 'null'),
    }));
    expect(both.def && both.def.behavior).toBe('Default card behavior');
    expect(both.other && both.other.behavior).toBe('Other card behavior');
  });
});

test.describe('Spec Card widget — appearance', () => {
  test('renders legibly in light mode', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));

    const widget = page.getByRole('region', { name: /spec card/i }).first();
    const bg = await widget.evaluate((el) => getComputedStyle(el).backgroundColor);
    const fg = await widget.evaluate((el) => getComputedStyle(el).color);

    // Light: light background, dark text.
    expect(bg).toBe('rgb(255, 255, 255)');
    expect(fg).toBe('rgb(31, 41, 55)');
  });

  test('renders legibly in dark mode', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));

    const widget = page.getByRole('region', { name: /spec card/i }).first();
    const bg = await widget.evaluate((el) => getComputedStyle(el).backgroundColor);
    const fg = await widget.evaluate((el) => getComputedStyle(el).color);

    // Dark: dark background, light text. (Specific values from spec-card-form.html.)
    expect(bg).toBe('rgb(35, 42, 54)');
    expect(fg).toBe('rgb(230, 237, 243)');
  });
});

test.describe('Spec Card widget — cookies inventory integration', () => {
  test('a saved spec card appears on /cookies/ under "Standalone tools"', async ({ page }) => {
    // Seed a spec card.
    await page.goto(TOOL_URL);
    await clearSpecCardKeys(page);
    const widget = page.getByRole('region', { name: /spec card/i }).first();
    await widget.getByLabel(/behavior/i).fill('Inventory check card');
    await expect(page.locator('[data-spec-card-status]').first())
      .toHaveAttribute('data-state', 'saved', { timeout: 2_000 });

    // Navigate to cookies inventory and look for the dynamic row.
    await page.goto('/cookies/');
    const standaloneToolsTable = page.locator('table[data-category="standalone-tools"]');
    await expect(standaloneToolsTable).toBeVisible();

    // The row for spec-card-default should be present with status "set".
    const row = standaloneToolsTable.locator('tr[data-key="spec-card-default"]');
    await expect(row).toBeVisible({ timeout: 5_000 });
    await expect(row.locator('.storage-badge.set')).toBeVisible();

    // Cleanup so subsequent tests aren't affected.
    await page.evaluate(() => localStorage.removeItem('spec-card-default'));
  });
});
