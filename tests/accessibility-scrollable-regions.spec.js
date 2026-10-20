const path = require('node:path');
const { test, expect } = require('@playwright/test');

const scriptPath = path.resolve(__dirname, '../js/accessibility-fixes.js');

for (const visibilityAttribute of ['class', 'hidden', 'aria-hidden']) {
  test(`revealed code supports keyboard scrolling after ${visibilityAttribute} changes`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent('<!doctype html><html lang="en"><head><title>Code answer</title></head><body><main></main></body></html>');
    await page.addStyleTag({ content: `
      .is-hidden, [aria-hidden="true"] { display: none; }
      pre { width: 160px; overflow: auto; font: 18px monospace; }
    ` });
    await page.clock.install();
    await page.addScriptTag({ path: scriptPath });
    // Answers can appear long after page load. Exhaust the startup retries so
    // they cannot accidentally make a missing reveal handler pass this test.
    await page.clock.runFor(6100);

    await page.evaluate((attribute) => {
      const main = document.querySelector('main');
      main.innerHTML = `
        <button type="button">Show answer</button>
        <section id="answer">
          <div class="highlight"><pre>print(1)</pre></div>
          <div class="highlight"><pre>print("A long answer line extends beyond the narrow code viewport.")</pre></div>
        </section>
        <button type="button">Next card</button>
      `;
      const answer = document.getElementById('answer');
      answer.setAttribute(attribute, attribute === 'class' ? 'is-hidden' : 'true');
      main.querySelector('button').addEventListener('click', () => answer.removeAttribute(attribute));
    }, visibilityAttribute);
    // Let the insertion observer inspect the answer while it is still hidden.
    await page.clock.runFor(32);
    const shortCode = page.getByText('print(1)', { exact: true });
    const longCode = page.getByText('print("A long answer line extends beyond the narrow code viewport.")', { exact: true });
    await expect(longCode).toBeHidden();
    await expect(longCode).not.toHaveAttribute('tabindex');

    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    await expect(longCode).toBeVisible();
    await expect(longCode).toHaveAttribute('tabindex', '0');
    await expect(shortCode).not.toHaveAttribute('tabindex');
    await page.keyboard.press('Tab');
    await expect(longCode).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => longCode.evaluate((element) => element.scrollLeft), {
      message: 'the focused answer must scroll horizontally with the keyboard',
    }).toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Next card', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
}
