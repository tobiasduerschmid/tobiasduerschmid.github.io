// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test('repeated tooltip initialization keeps one Escape listener and dismisses the live tooltip', async ({ page }) => {
  await page.goto('/shortcuts/');

  await page.evaluate(function () {
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Show lifecycle tooltip';
    trigger.setAttribute('title', 'Lifecycle tooltip help');
    document.querySelector('main').appendChild(trigger);

    for (var i = 0; i < 5; i++) {
      window.initAccessibleTooltips(trigger);
    }
  });

  // jQuery does not expose listener namespaces publicly. Inspecting its event
  // registry is intentionally limited to this lifecycle invariant: repeated
  // initialization must never retain another document-level Escape closure.
  const escapeHandlerCount = await page.evaluate(function () {
    var events = window.jQuery._data(document, 'events') || {};
    return (events.keydown || []).filter(function (handler) {
      return handler.namespace === 'a11yTooltip';
    }).length;
  });
  expect(escapeHandlerCount).toBe(1);

  const trigger = page.getByRole('button', { name: 'Show lifecycle tooltip' });
  await trigger.evaluate(function (element) {
    window.jQuery(element).tooltip('show');
  });
  const tooltip = page.getByRole('tooltip').filter({ hasText: 'Lifecycle tooltip help' });
  await expect(tooltip).toBeVisible();
  await a11yCheckpoint(page, 'dynamically initialized tooltip visible', {
    feature: 'tooltips',
    include: '.tooltip'
  });

  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
});
