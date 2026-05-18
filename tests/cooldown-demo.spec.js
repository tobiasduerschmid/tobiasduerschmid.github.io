// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests for the test-cooldown feature (`cooldown_seconds` in tutorial YAML).
 *
 * The spec under test: after clicking "Test My Work", the visible button is
 * replaced by a disabled `⏱ Test My Work (M:SS)` countdown plus an `I’m sure`
 * silent fallback. The countdown ticks down, the cooldown clears
 * automatically, the silent path hides the test result panel but still
 * unlocks Next when the tests pass, and the cooldown survives a page reload.
 *
 * The cooldown demo tutorial uses `cooldown_seconds: 3` so the tests can
 * wait through real cooldowns instead of mocking time. Each test resets the
 * cooldown state at the start so tests stay independent under any order.
 *
 * Pyodide bootup is the slowest step here — `describe.serial` shares a
 * single page across the suite to amortize it. Test isolation is preserved
 * by resetting cooldown state and code at each test's Arrange phase.
 */

const TUTORIAL_URL = '/SEBook/tools/cooldown-demo';
const COOLDOWN_SECONDS = 3;
const PYODIDE_BOOT_TIMEOUT = 60_000;
const HERO_CELEBRATION_MESSAGE = 'You aced this, keep going!';

// Locator factories — accessible-name based so layout / class refactors don't
// break the suite. The cooldown variant has aria-label "Test My Work locked,
// X seconds remaining" while the normal button's accessible name is "✓ Test
// My Work"; the I'm sure button uses its visible text. Anchoring the regular
// button match with `^.*Test My Work$` keeps it from matching the cooldown
// variant's aria-label.
const regularTestBtn  = (page) => page.getByRole('button', { name: /^✓ Test My Work$/ });
const cooldownBtn     = (page) => page.getByRole('button', { name: /Test My Work locked/ });
const sureBtn         = (page) => page.getByRole('button', { name: /I.m sure/ });
const nextBtn         = (page) => page.getByRole('button', { name: /^Next/ });

async function waitForTutorialReady(page) {
  // Wait until the runtime is fully booted: the loading veil is gone, the
  // step controls are rendered (so the test button is in DOM), and the
  // tutorial instance is exposed for the cooldown helpers below to drive.
  // We don't wait on `.tvm-output-panel` visibility — pyodide tutorials
  // can keep that panel collapsed at load on small viewports.
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: PYODIDE_BOOT_TIMEOUT });
  await page.waitForFunction(
    () => !!window._tutorial
      && window._tutorial.config.backend === 'pyodide'
      && !!window.HeroAvatar
      && !!window.SEGymHeroCelebration,
    null,
    { timeout: PYODIDE_BOOT_TIMEOUT }
  );
  await expect(regularTestBtn(page)).toBeVisible({ timeout: PYODIDE_BOOT_TIMEOUT });
}

/**
 * Restore the tutorial to a clean per-test starting point: no active cooldown,
 * the original starter file, no leftover ticker. This is the only way to keep
 * tests independent inside `describe.serial`; without it, test order becomes
 * load-bearing (a smell from the test-design skill).
 */
async function resetTutorialState(page) {
  await page.evaluate(() => {
    const t = window._tutorial;
    if (t._testCooldownTimer) {
      clearInterval(t._testCooldownTimer);
      t._testCooldownTimer = null;
    }
    if (t._testCooldownStorageKey) {
      localStorage.removeItem(t._testCooldownStorageKey);
    }
    localStorage.removeItem('se-gym-hero-avatar');
    document.querySelectorAll('.tvm-hero-celebration, .site-confetti-layer').forEach((el) => el.remove());
    t.resetStep();
    t._refreshTestButton(t.currentStep);
  });
  await expect(regularTestBtn(page)).toBeVisible();
  await expect(cooldownBtn(page)).toHaveCount(0);
}

/**
 * Replace the active editor content and flush the change to the backend.
 * The editor's onDidChangeContent handler debounces sync by 800ms, so a
 * test that clicks Test/I'm sure right after a setValue would race the
 * pyodide filesystem write — `_saveCurrentFile` is the synchronous flush.
 */
async function setActiveFileContent(page, source) {
  await page.evaluate((src) => {
    const t = window._tutorial;
    const file = t.editorModels[t.activeFileName];
    file.model.setValue(src);
    t._saveCurrentFile();
  }, source);
}

async function saveDefaultHero(page) {
  await page.evaluate(() => {
    const hero = window.HeroAvatar.normalizeAvatar(
      JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS))
    );
    window.HeroAvatar.saveAvatar(hero);
  });
}

const STARTER_CODE_FAILING = 'def answer():\n    return None\n';
const SOLUTION_CODE_PASSING = 'def answer():\n    return 42\n';

test.describe.serial('Test cooldown demo', () => {
  test.setTimeout(120_000);

  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }, testInfo) => {
    // Pyodide boot can exceed the default 30s hook timeout on cold runs.
    testInfo.setTimeout(PYODIDE_BOOT_TIMEOUT + 30_000);
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await resetTutorialState(page);
  });

  test('only the regular Test My Work button is shown before any test run', async () => {
    await expect(regularTestBtn(page)).toBeVisible();
    await expect(cooldownBtn(page)).toHaveCount(0);
    await expect(sureBtn(page)).toHaveCount(0);
  });

  test('cooldown UI replaces the regular button after a test run', async () => {
    await regularTestBtn(page).click();

    await expect(cooldownBtn(page)).toBeVisible();
    await expect(sureBtn(page)).toBeVisible();
    await expect(regularTestBtn(page)).toHaveCount(0);
    await expect(cooldownBtn(page)).toBeDisabled();
  });

  test('cooldown countdown decrements visibly while the timer is active', async () => {
    await regularTestBtn(page).click();
    // Web-first: read the initial number, then poll for any strictly smaller
    // value within a window comfortably shorter than the cooldown duration.
    // Pinning a specific later value (e.g. "0:01") would be brittle — exact
    // sampling timing depends on machine speed and Pyodide overhead.
    const initial = await cooldownBtn(page).textContent();
    const initialSeconds = readSecondsFromLabel(initial);
    expect(initialSeconds).toBeGreaterThan(0);

    await expect.poll(
      async () => readSecondsFromLabel(await cooldownBtn(page).textContent()),
      { message: 'cooldown label should tick down', timeout: 2_500 }
    ).toBeLessThan(initialSeconds);
  });

  test('cooldown clears automatically once the configured duration elapses', async () => {
    await regularTestBtn(page).click();
    await expect(cooldownBtn(page)).toBeVisible();

    // Allow the configured cooldown plus a small grace window for ticker
    // resolution on a slow runner. The wait is on the observable transition
    // back to the regular button — never a fixed sleep.
    await expect(regularTestBtn(page)).toBeVisible({ timeout: (COOLDOWN_SECONDS + 3) * 1000 });
    await expect(cooldownBtn(page)).toHaveCount(0);
    await expect(sureBtn(page)).toHaveCount(0);
  });

  test('"I’m sure" silent run does not show or update the test result panel', async () => {
    await regularTestBtn(page).click();
    // After the visible run on the failing starter code, the panel shows the
    // failure. Capture its HTML — the silent run must leave it unchanged.
    const panel = page.locator('.tvm-test-panel');
    await expect(panel).toContainText(/0\s*\/\s*1 tests passed/);
    const beforeSilentHTML = await panel.innerHTML();

    await sureBtn(page).click();
    // Give the silent run a chance to complete (it doesn't write to the panel,
    // but the worker still needs time to finish). Then re-read the panel.
    await page.waitForFunction(
      () => !window._tutorial._testRunInFlight,
      null,
      { timeout: 10_000 }
    );
    const afterSilentHTML = await panel.innerHTML();
    expect(afterSilentHTML).toBe(beforeSilentHTML);
  });

  test('"I’m sure" silent run unlocks Next when the tests pass', async () => {
    await regularTestBtn(page).click();
    await expect(cooldownBtn(page)).toBeVisible();
    await expect(nextBtn(page)).toBeDisabled();

    // Switch to passing code while the cooldown is still active, then take
    // the silent path. A passing silent run is the spec for unlock-without-
    // feedback: Next must enable, panel must NOT advance to the success state.
    await setActiveFileContent(page, SOLUTION_CODE_PASSING);
    await sureBtn(page).click();

    await expect(nextBtn(page)).toBeEnabled({ timeout: 15_000 });
    // The visible failure is still what's on screen — the silent pass did
    // not promote it to "All 1 tests passed!".
    await expect(page.locator('.tvm-test-panel')).toContainText(/0\s*\/\s*1 tests passed/);
  });

  test('passing all step tests shows the saved hero celebration and confetti', async () => {
    await saveDefaultHero(page);
    await setActiveFileContent(page, SOLUTION_CODE_PASSING);

    await regularTestBtn(page).click();

    const message = page.getByText(HERO_CELEBRATION_MESSAGE);
    await expect(page.locator('.tvm-test-summary')).toContainText(/All 1 tests passed!/);
    await expect(message).toBeVisible();
    await expect(page.locator('.tvm-hero-celebration [data-gym-hero-svg]')).toBeVisible();
    await expect.poll(
      async () => page.locator('.site-confetti-piece').count(),
      { message: 'passing tests with a saved hero should spawn confetti', timeout: 2_000 }
    ).toBeGreaterThan(0);
    await expect(message).toBeHidden({ timeout: 6_000 });
  });

  test('reduced motion suppresses the saved hero celebration and confetti', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await saveDefaultHero(page);
    await setActiveFileContent(page, SOLUTION_CODE_PASSING);

    await regularTestBtn(page).click();

    await expect(page.locator('.tvm-test-summary')).toContainText(/All 1 tests passed!/);
    await expect(page.getByText(HERO_CELEBRATION_MESSAGE)).toHaveCount(0);
    await expect(page.locator('.site-confetti-piece')).toHaveCount(0);
  });

  test('cooldown survives a page reload', async () => {
    // Pyodide reload is slower than the 3-second tutorial cooldown, so a real
    // click would expire before the post-reload assertion fires. Persist a
    // longer end time directly — that's the spec under test (the *storage*
    // is what survives reload), not the click that wrote it.
    const storageKey = await page.evaluate(() => {
      const t = window._tutorial;
      const key = t._testCooldownStorageKey;
      const map = { [t.currentStep]: Date.now() + 60_000 };
      localStorage.setItem(key, JSON.stringify(map));
      return key;
    });
    await page.reload();
    // Don't call waitForTutorialReady — it waits on the *regular* button
    // becoming visible, which won't happen while cooldown is active. Wait
    // on the post-boot signal that's universally true: pyodide ready and
    // the cooldown button rendered.
    await page.waitForFunction(
      () => !!window._tutorial && window._tutorial.config.backend === 'pyodide',
      null,
      { timeout: PYODIDE_BOOT_TIMEOUT }
    );

    await expect(cooldownBtn(page)).toBeVisible({ timeout: 10_000 });
    await expect(sureBtn(page)).toBeVisible();
    await expect(regularTestBtn(page)).toHaveCount(0);

    // localStorage round-trip: the same key + endsAt that survived the
    // reload is the actual contract.
    const persisted = await page.evaluate((k) => localStorage.getItem(k), storageKey);
    expect(persisted).toMatch(/"0":\d+/);
  });
});

/**
 * Parse the M:SS-suffixed cooldown label (e.g. "⏱ Test My Work (0:03)") into
 * total seconds. Returns NaN if the pattern doesn't match — callers assert
 * on the return value, so a malformed label fails noisily.
 */
function readSecondsFromLabel(label) {
  const match = /(\d+):(\d{2})/.exec(label || '');
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}
