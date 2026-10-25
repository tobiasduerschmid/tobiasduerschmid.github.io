// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint, interactiveA11yEnabled } = require('./a11y-helpers');

test.skip(!interactiveA11yEnabled(), 'Enable A11Y_INTERACTIVE_CHECKS=1 to exercise the interactive audit.');

const cases = [
  { rule: 'color-contrast', body: '<p class="subject">Feedback after answering</p>', selector: '.subject', badStyle: 'color: #aaa;' },
  { rule: 'target-size', body: '<button>A</button><button>B</button>', selector: 'button', badStyle: 'width: 12px; height: 12px; min-width: 0; padding: 0; border: 0; margin: 0;' },
  { rule: 'link-in-text-block', body: '<p>Read the <a href="#destination">answer explanation</a> for more information.</p>', selector: 'a', badStyle: 'color: #222; text-decoration: none;' },
];

for (const { rule, body, selector, badStyle } of cases) {
  for (const darkMode of [false, true]) {
    test(`interactive checkpoint detects ${rule} in ${darkMode ? 'dark' : 'light'} mode`, async ({ page }) => {
      await page.setContent(`<!doctype html><html lang="en"><head><title>Audit checkpoint fixture</title></head><body><main><h1>Answer review</h1>${body}<p id="destination">Explanation</p></main></body></html>`);
      await page.addStyleTag({ content: `
        html, body { background: #fff; color: #000; font: 16px Arial, sans-serif; }
        button { width: 40px; height: 40px; margin: 10px; color: #000; background: #fff; }
        a, a:visited { color: #000; text-decoration: underline; }
        ${darkMode ? 'html.dark-mode ' : ''}${selector} { ${badStyle} }
      ` });

      await expect(a11yCheckpoint(page, `${rule} fixture`, { darkMode })).rejects.toThrow(`[${rule}]`);
      await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
    });
  }
}

test('interactive checkpoint accepts spaced small targets and underlined inline links', async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head><title>Valid audit fixture</title></head><body><main><h1>Answer review</h1><button>A</button><button>B</button><p>Read the <a href="#destination">explanation</a>.</p><p id="destination">Explanation</p></main></body></html>');
  await page.addStyleTag({ content: `
    html, body { background: #fff; color: #000; font: 16px Arial, sans-serif; }
    button { width: 16px; height: 16px; padding: 0; margin: 20px; color: #000; background: #fff; }
    a, a:visited { color: #000; text-decoration: underline; }
  ` });

  await a11yCheckpoint(page, 'spacing and inline-text exceptions', { darkMode: true });
});
