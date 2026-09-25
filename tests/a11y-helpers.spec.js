// @ts-check
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');

async function showFixture(page, css, content) {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head><title>Interactive accessibility fixture</title><style>${css}</style></head>
      <body><main><h1>Practice</h1>${content}</main></body>
    </html>
  `);
}

test('compliant interactive controls pass in light and dark mode', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    html.dark-mode body { background: #111; color: #fff; }
    button { min-width: 44px; min-height: 44px; }
    a, a:visited { color: #0645ad; text-decoration: underline; }
    html.dark-mode a, html.dark-mode a:visited { color: #9cc7ff; }
  `, '<p>Read the <a href="/guide">practice guide</a>.</p><button>Check</button>');

  await expect(auditInteractiveState(page, 'compliant controls')).resolves.toBeUndefined();
});

test('contrast failure revealed after interaction is caught', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    button { min-width: 44px; min-height: 44px; }
    #feedback { color: #eee; }
  `, '<button onclick="feedback.hidden = false">Reveal</button><p id="feedback" hidden>Answer saved</p>');
  await page.getByRole('button', { name: 'Reveal' }).click();

  await expect(auditInteractiveState(page, 'revealed feedback', { darkMode: false }))
    .rejects.toThrow(/color-contrast/);
});

test('undersized adjacent buttons revealed after interaction are caught', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    #reveal { min-width: 44px; min-height: 44px; }
    #choices button { width: 16px; height: 16px; padding: 0; }
  `, '<button id="reveal" onclick="choices.hidden = false">Reveal</button><div id="choices" hidden><button>A</button><button>B</button></div>');
  await page.getByRole('button', { name: 'Reveal' }).click();

  await expect(auditInteractiveState(page, 'small choices', { darkMode: false }))
    .rejects.toThrow(/target-size/);
});

test('unmarked text link revealed after interaction is caught', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    button { min-width: 44px; min-height: 44px; }
    a, a:visited { color: #111; text-decoration: none; }
  `, '<button onclick="instructions.hidden = false">Reveal</button><p id="instructions" hidden>Read the <a href="/guide">practice guide</a> first.</p>');
  await page.getByRole('button', { name: 'Reveal' }).click();

  await expect(auditInteractiveState(page, 'unmarked link', { darkMode: false }))
    .rejects.toThrow(/link-in-text-block/);
});

test('contrasting text link with a focus and hover cue passes', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    a, a:visited { color: #1468cb; text-decoration: none; }
    a:hover, a:focus-visible { text-decoration: underline; }
    button { min-width: 44px; min-height: 44px; }
    .spacer { height: 2000px; }
  `, '<button id="keep-focus">Keep focus</button><p>Read the <a href="/guide">practice guide</a> first.</p><div class="spacer"></div>');

  await page.locator('#keep-focus').focus();
  await page.evaluate(() => window.scrollTo(0, 200));
  const before = await page.evaluate(() => ({ focused: document.activeElement.id, scrollY }));

  await expect(auditInteractiveState(page, 'contrasting link', { darkMode: false }))
    .resolves.toBeUndefined();
  const after = await page.evaluate(() => ({ focused: document.activeElement.id, scrollY }));
  expect(after).toEqual(before);
});

test('permanently underlined link remains valid while hovered and focused', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    a, a:visited { color: #1468cb; text-decoration: underline; }
  `, '<p>Read the <a href="/guide">practice guide</a> first.</p>');
  const link = page.getByRole('link', { name: 'practice guide' });
  await link.hover();
  await link.focus();

  await expect(auditInteractiveState(page, 'active underlined link', { darkMode: false }))
    .resolves.toBeUndefined();
  await expect(link).toBeFocused();
});

test('contrasting text link without a hover cue is caught', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    a, a:visited { color: #1468cb; text-decoration: none; }
    a:hover { color: #0d4e9a; }
    a:focus-visible { outline: 3px solid #111; }
  `, '<p>Read the <a href="/guide">practice guide</a> first.</p>');

  await expect(auditInteractiveState(page, 'color-only hover', { darkMode: false }))
    .rejects.toThrow(/link-in-text-block.*hover/s);
});

test('contrasting text link without a keyboard focus cue is caught', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    a, a:visited { color: #1468cb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    a:focus, a:focus-visible { outline: none; }
  `, '<p>Read the <a href="/guide">practice guide</a> first.</p>');

  await expect(auditInteractiveState(page, 'missing focus cue', { darkMode: false }))
    .rejects.toThrow(/link-in-text-block.*keyboard focus/s);
});

test('dark-mode contrast failure is caught without an explicit darkMode option', async ({ page }) => {
  await showFixture(page, `
    body { background: #fff; color: #111; }
    html.dark-mode body { background: #111; color: #111; }
    button { min-width: 44px; min-height: 44px; }
  `, '<p>Study progress</p><button>Continue</button>');

  await expect(auditInteractiveState(page, 'dark feedback'))
    .rejects.toThrow(/dark mode.*color-contrast/s);
});
