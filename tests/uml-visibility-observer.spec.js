// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');

const bundlePath = path.resolve(__dirname, '../js/ArchUML/uml-bundle.js');

for (const hasDiagram of [false, true]) {
  test(`decorative SVG updates leave the next frame responsive ${hasDiagram ? 'with' : 'without'} a diagram`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'The CPU throttle uses Chromium DevTools.');
    await page.setContent('<html lang="en"><head><title>Diagram integration</title></head><body><main><button>Continue</button></main></body></html>');
    await page.evaluate(() => {
      // Match the scale of the Gym illustrations without coupling the fixture to
      // their artwork or private avatar APIs. Hidden artwork still receives edits.
      const artwork = '<path d="M0 0h1v1z"/>'.repeat(10000);
      for (let i = 0; i < 7; i++) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.display = 'none';
        svg.innerHTML = artwork;
        document.body.appendChild(svg);
      }
    });
    if (hasDiagram) {
      await page.evaluate(() => {
        const diagram = document.createElement('div');
        diagram.className = 'uml-class-diagram-container';
        diagram.setAttribute('role', 'img');
        diagram.setAttribute('aria-label', 'Example diagram');
        diagram.innerHTML = '<svg width="200" height="100" viewBox="0 0 200 100"><g><rect width="200" height="100"/><text x="20" y="30" font-size="16">Example</text></g></svg>';
        document.querySelector('main').appendChild(diagram);
      });
    }
    await page.addScriptTag({ path: bundlePath });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    try {
      const elapsed = await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        const start = performance.now();
        for (const svg of document.querySelectorAll('svg[aria-hidden="true"]')) {
          for (let i = 0; i < 100; i++) svg.style.setProperty('--artwork-color-' + i, String(i));
        }
        // Include MutationObserver delivery and the next paint opportunity, not
        // just the synchronous style writes that trigger the observer workload.
        await new Promise(requestAnimationFrame);
        return performance.now() - start;
      });
      // A generous half-second responsiveness ceiling under 4x CPU slowdown.
      // The regression spent several seconds scanning unrelated SVG descendants.
      expect(elapsed, 'decorative updates must not stall the next interactive frame').toBeLessThan(500);
    } finally {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await session.detach();
    }
  });
}

for (const reveal of ['class', 'style', 'hidden', 'open', 'diagram-hidden']) {
  for (const dynamic of [false, true]) {
    test(`${dynamic ? 'newly inserted' : 'existing'} diagram fits its content after ${reveal} reveals it`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install();
      await page.setContent('<html lang="en"><head><title>Reveal a diagram</title></head><body><main><button>Show diagram</button><section id="example"></section></main></body></html>');
      await page.addStyleTag({ content: '.is-hidden { display: none; }' });
      await page.evaluate(({ reveal, dynamic }) => {
        const wrapper = document.createElement(reveal === 'open' ? 'details' : 'div');
        if (reveal === 'open') wrapper.innerHTML = '<summary>Diagram details</summary>';
        if (reveal === 'class') wrapper.className = 'is-hidden';
        if (reveal === 'style') wrapper.style.display = 'none';
        if (reveal === 'hidden') wrapper.hidden = true;
        document.getElementById('example').appendChild(wrapper);

        const diagram = document.createElement('div');
        diagram.className = 'uml-class-diagram-container';
        diagram.setAttribute('role', 'img');
        diagram.setAttribute('aria-label', 'Example diagram');
        if (reveal === 'diagram-hidden') diagram.hidden = true;
        if (!dynamic) wrapper.appendChild(diagram);

        document.querySelector('button').addEventListener('click', () => {
          if (dynamic) wrapper.appendChild(diagram);
          // Models a diagram generated while an answer/explanation is hidden.
          // Its initial viewport cannot contain the full drawing until refitted.
          diagram.innerHTML = '<svg width="48" height="48" viewBox="-24 -24 48 48"><g><rect x="100" y="50" width="260" height="160"/><text x="120" y="90" font-size="16">Example</text></g></svg>';
          if (reveal === 'class') wrapper.classList.remove('is-hidden');
          if (reveal === 'style') wrapper.style.removeProperty('display');
          if (reveal === 'hidden') wrapper.hidden = false;
          if (reveal === 'open') wrapper.setAttribute('open', '');
          if (reveal === 'diagram-hidden') diagram.hidden = false;
        });
      }, { reveal, dynamic });
      await page.addScriptTag({ path: bundlePath });
      // Exhaust initial auto-fit retries so only the later reveal can resize
      // the newly generated drawing. The browser clock avoids a real sleep.
      await page.clock.runFor(4000);
      await page.getByRole('button', { name: 'Show diagram' }).click();
      await page.clock.runFor(250);

      const diagram = page.getByRole('img', { name: 'Example diagram' });
      await expect(diagram).toBeVisible();
      await expect.poll(() => diagram.locator('svg').evaluate(svg => {
        const view = svg.viewBox.baseVal;
        return view.x <= 100 && view.y <= 50
          && view.x + view.width >= 360 && view.y + view.height >= 210;
      }), { message: 'the viewport must include the entire revealed drawing' }).toBe(true);
      await expect(diagram.getByText('Example', { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
