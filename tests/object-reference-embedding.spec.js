// @ts-check
const { test, expect } = require('@playwright/test');

async function expectSharedReferenceArrows(lab) {
  await expect(lab.getByRole('button', { name: 'Follow [0] to o1: list', exact: true })).toBeVisible();
  await expect(lab.getByRole('button', { name: 'Follow [1] to o1: list', exact: true })).toBeVisible();
  await expect(lab.getByRole('region', { name: 'o1: list', exact: true })).toBeVisible();

  // These are measurements of the rendered connector contract: each member
  // arrow must touch its source/target and remain visible beside the cards.
  // The path's reference annotations identify the same edges as the accessible
  // Follow controls; no routing algorithm or exact path shape is prescribed.
  await expect.poll(() => lab.evaluate(host => {
    const graph = host.querySelector('.orl-graph');
    const viewport = host.querySelector('[aria-label="Object reference diagram"]');
    const target = graph.querySelector('[aria-label="o1: list"]');
    const viewportBounds = viewport.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const nearBoundary = (point, box) => {
      const within = point.x >= box.left - 5 && point.x <= box.right + 5
        && point.y >= box.top - 5 && point.y <= box.bottom + 5;
      return within && Math.min(Math.abs(point.x - box.left), Math.abs(point.x - box.right),
        Math.abs(point.y - box.top), Math.abs(point.y - box.bottom)) <= 5;
    };
    const failures = [];
    for (const entry of ['[0]', '[1]']) {
      const source = graph.querySelector('[aria-label="Follow ' + entry + ' to o1: list"]');
      const routes = Array.from(graph.querySelectorAll('path[data-reference-id]'))
        .filter(route => route.dataset.referenceId === source.dataset.referenceId
          && route.dataset.targetObject === 'o1');
      if (routes.length !== 1) {
        failures.push(entry + ': expected one drawn arrow to o1, received ' + routes.length);
        continue;
      }
      const route = routes[0];
      const transform = route.getScreenCTM();
      const length = route.getTotalLength();
      const start = route.getPointAtLength(0).matrixTransform(transform);
      const end = route.getPointAtLength(length).matrixTransform(transform);
      const routeBounds = route.getBoundingClientRect();
      const style = getComputedStyle(route);
      if (length <= 0 || style.stroke === 'none' || parseFloat(style.strokeWidth) < 1) {
        failures.push(entry + ': arrow has no visible stroke');
      }
      if (!nearBoundary(start, source.getBoundingClientRect())) failures.push(entry + ': source is disconnected');
      if (!nearBoundary(end, targetBounds)) failures.push(entry + ': target o1 is disconnected');
      if (routeBounds.right > viewportBounds.right + 1 || routeBounds.left < viewportBounds.left - 1) {
        failures.push(entry + ': arrow is clipped horizontally');
      }
      if (routeBounds.right > innerWidth + 1 || routeBounds.left < -1) {
        failures.push(entry + ': arrow extends beyond the browser viewport');
      }
      if (routeBounds.top < viewportBounds.top - 1 || routeBounds.bottom > viewportBounds.bottom + 1) {
        failures.push(entry + ': arrow is clipped vertically');
      }
    }
    return failures;
  }), { message: 'both list slots must have connected, unclipped arrows' }).toEqual([]);
}

test('the documented standalone embed draws shared references through replay and narrow theme changes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Establish the real site's origin without inheriting any chapter/runtime
  // scripts. The fixture models a host embedding only the documented assets.
  await page.goto('/assets/object-reference-labs.json');
  await page.setContent(`<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Object reference embed</title>
    <link rel="stylesheet" href="/css/object-reference-lab.css"></head>
    <body><main><h1>Object reference embed</h1>
    <div data-object-reference-example="shared_slots" data-object-reference-editor="inline"></div>
    </main></body></html>`);
  await page.addScriptTag({ url: '/js/object-reference-graph.js' });
  await page.addScriptTag({ url: '/js/object-reference-code.js' });
  await page.addScriptTag({ url: '/js/object-reference-print.js' });
  await page.addScriptTag({ url: '/js/object-reference-lab.js' });

  const lab = page.getByRole('region', { name: /^Object reference lab:/ });
  await expect(lab).toHaveAccessibleName(/^Object reference lab: .+/);
  const forward = lab.getByRole('button', { name: 'Forward', exact: true });
  const back = lab.getByRole('button', { name: 'Back', exact: true });
  await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toBeVisible();
  await expect(forward).toBeEnabled();
  // After line 2, row and both board slots reference the original list o1.
  await forward.click();
  await forward.click();
  await forward.click();
  await expect(lab.getByRole('status')).toContainText(/Step 4 of \d+ · Line 2/);
  await expectSharedReferenceArrows(lab);

  await forward.click();
  await expect(lab.getByRole('status')).toContainText(/Line 3/);
  await expectSharedReferenceArrows(lab);
  await back.click();
  await expect(lab.getByRole('status')).toContainText(/Step 4 of \d+ · Line 2/);
  await expectSharedReferenceArrows(lab);

  await page.setViewportSize({ width: 320, height: 720 });
  await expectSharedReferenceArrows(lab);
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await expectSharedReferenceArrows(lab);
  await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
  await expectSharedReferenceArrows(lab);
  expect(errors, 'the public embed must not depend on an undeclared routing script').toEqual([]);
});
