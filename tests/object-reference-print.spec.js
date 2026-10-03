// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

const CHAPTER = '/SEBook/tools/python.html';
const PRINT = '/SEBook/tools/python-tutorial/print.html';
const labs = page => page.getByRole('region', { name: /^Object reference lab:/ });
const control = (lab, name) => lab.getByRole('button', { name, exact: true });

async function expectConnectedPrintArrows(history) {
  // Public graph/port annotations identify the visible relationship. Geometry
  // is checked at its actual size; no route algorithm or exact path is assumed.
  await expect.poll(() => history.evaluate(root => {
    const failures = [];
    const nearBoundary = (point, box) => point.x >= box.left - 5 && point.x <= box.right + 5
      && point.y >= box.top - 5 && point.y <= box.bottom + 5
      && Math.min(Math.abs(point.x - box.left), Math.abs(point.x - box.right),
        Math.abs(point.y - box.top), Math.abs(point.y - box.bottom)) <= 5;
    root.querySelectorAll('.orl-graph').forEach((graph, index) => {
      const bounds = graph.getBoundingClientRect();
      if (!bounds.width) failures.push(index + ': invisible diagram');
      const routes = Array.from(graph.querySelectorAll('.orl-reference-edge'));
      const ports = Array.from(graph.querySelectorAll('[data-reference-target]'));
      if (routes.length !== ports.length) failures.push(index + ': a member arrow is missing');
      ports.forEach(port => {
        const route = routes.find(path => path.dataset.referenceId === port.dataset.referenceId);
        const target = graph.querySelector('[data-object-id="' + port.dataset.referenceTarget + '"] .orl-object');
        if (!route || !target) return;
        const matrix = route.getScreenCTM();
        const length = route.getTotalLength();
        const start = route.getPointAtLength(0).matrixTransform(matrix);
        const end = route.getPointAtLength(length).matrixTransform(matrix);
        const style = getComputedStyle(route);
        const box = route.getBoundingClientRect();
        if (!length || style.stroke === 'none' || style.markerEnd === 'none') failures.push(index + ': unpainted arrow');
        if (!nearBoundary(start, port.getBoundingClientRect())) failures.push(index + ': disconnected source');
        if (!nearBoundary(end, target.getBoundingClientRect())) failures.push(index + ': disconnected target');
        if (box.left < bounds.left - 1 || box.right > bounds.right + 1
            || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1) failures.push(index + ': clipped arrow');
      });
      if (graph.querySelector('.orl-name-slot') && !graph.querySelector('.orl-local-edges path[marker-end]')) {
        failures.push(index + ': a named reference has no arrow');
      }
    });
    return failures;
  }), { message: 'printed references connect their visible ports and objects after layout' }).toEqual([]);
}

test('beforeprint synchronously paints graphs and afterprint restores the current playback state', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(CHAPTER);
  const lab = labs(page).first();
  await control(lab, 'Forward').click();
  const currentStep = await lab.getByRole('status').innerText();
  await page.evaluate(() => {
    document.documentElement.classList.add('dark-mode');
    window.dispatchEvent(new Event('beforeprint'));
  });
  const history = lab.locator('.orl-print');
  await expect(history.getByRole('img').last()).toBeVisible();
  await expect(lab.locator('.orl-screen')).toBeHidden();
  await expect(history.locator('.orl-object').first()).toBeVisible();
  await expectConnectedPrintArrows(history);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(history).toBeHidden();
  await expect(lab.getByRole('status')).toHaveText(currentStep);
  await expect(control(lab, 'Back')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('print view shows the same object shapes and reflows arrows when text grows at unchanged width', async ({ page }) => {
  await page.goto(PRINT);
  const lab = labs(page).and(page.locator('[data-object-reference-example="shallow_copy"]'));
  const history = lab.locator('.orl-print');
  await expect(history.getByRole('img').last()).toBeVisible();
  await expect(lab.locator('.orl-screen')).toBeHidden();
  const finalSnapshot = history.locator('.orl-print-step').last();
  await expect(finalSnapshot.locator('.orl-object')).toHaveCount(5);
  await expect(finalSnapshot.locator('.orl-reference-edge')).toHaveCount(6);
  await expect(finalSnapshot.getByRole('img')).toHaveAccessibleName(/Global names:.*archived/);
  await expectConnectedPrintArrows(history);
  const diagramWidth = (await finalSnapshot.getByRole('img').boundingBox()).width;
  // The documented160mm print-width contract prevents measurement at a wide
  // browser viewport followed by narrower A4/Letter PDF pagination.
  expect(diagramWidth).toBeLessThanOrEqual(160 * 96 / 25.4 + 1);
  await page.emulateMedia({ media: 'print' });
  expect((await finalSnapshot.getByRole('img').boundingBox()).width).toBeCloseTo(diagramWidth, 0);
  await expectConnectedPrintArrows(history);
  await page.emulateMedia({ media: 'screen' });
  const before = await history.boundingBox();
  // Simulate a reader enlarging text without changing the page's column width.
  await lab.evaluate(host => { host.style.fontSize = '24px'; host.style.letterSpacing = '0.12em'; });
  await expect.poll(async () => (await history.boundingBox()).height).toBeGreaterThan(before.height);
  expect((await history.boundingBox()).width).toBeCloseTo(before.width, 0);
  await expectConnectedPrintArrows(history);
  await page.emulateMedia({ media: 'print' });
  await expectConnectedPrintArrows(history);
});

test('edited and reset programs replace printable graphs without retaining old objects', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(CHAPTER);
  const lab = labs(page).first();
  const editor = lab.getByRole('textbox', { name: 'Python code', exact: true });
  await editor.fill('solo = [7]\nprint(solo)');
  await page.emulateMedia({ media: 'print' });
  const history = lab.locator('.orl-print');
  await expect(history).toContainText('No recorded execution');
  await expect(history.getByRole('img')).toHaveCount(0);
  await page.emulateMedia({ media: 'screen' });
  await control(lab, 'Trace Python').click();
  await expect(control(lab, 'Forward')).toBeEnabled({ timeout: 90_000 });
  await page.emulateMedia({ media: 'print' });
  const finalSnapshot = history.locator('.orl-print-step').last();
  await expect(finalSnapshot.locator('.orl-object')).toHaveCount(1);
  await expect(finalSnapshot.getByRole('img')).toHaveAccessibleName(/Global names: solo →/);
  await expect(finalSnapshot).toContainText('Output:\n[7]');
  await expect(history).not.toContainText('board');
  await page.emulateMedia({ media: 'screen' });
  await control(lab, 'Reset example').click();
  await page.emulateMedia({ media: 'print' });
  await expect(history).not.toContainText('solo');
  await expect(history.locator('.orl-print-step').last().getByRole('img')).toHaveAccessibleName(/Global names:.*board/);
  await expectConnectedPrintArrows(history);
});

test('detached instructions print cards and connected arrows for their displayed lesson', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/tools/python-tutorial.html#lists');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  const popupOpened = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Open instructions in separate window$/ }).click();
  const popup = await popupOpened;
  const lab = labs(popup).first();
  await expect(control(lab, 'Forward')).toBeEnabled();
  await popup.emulateMedia({ media: 'print' });
  const history = lab.locator('.orl-print');
  await expect(history.locator('.orl-object').first()).toBeVisible();
  await expect(history.locator('.orl-reference-edge').first()).toBeVisible();
  await expectConnectedPrintArrows(history);
  await popup.close();
});

test('the chapter retains its readable prepared example when JavaScript is disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto(CHAPTER);
    await page.emulateMedia({ media: 'print' });
    const lab = labs(page).first();
    await expect(lab.locator('pre')).toContainText('board = [row, row]');
    await expect(lab.getByText('Check the references', { exact: true })).toBeVisible();
  } finally { await context.close(); }
});
